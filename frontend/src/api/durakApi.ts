import {
  AnimMode,
  DeckSize,
  Room,
  RoomPlayer,
  RoomStatus,
  UserAccount,
} from '../types/durak';
import {
  apiRequest,
  buildRoomWebSocketUrl,
  clearAccessToken,
  isBackendEnabled,
  setAccessToken,
} from './client';

export interface ApiUserDTO {
  id: string;
  username: string;
  email: string;
  avatar_url: string;
  games_played: number;
  wins: number;
  losses: number;
  created_at: string;
}

export interface ApiAuthResponseDTO {
  access_token: string;
  token_type: string;
  user: ApiUserDTO;
}

export interface ApiRoomPlayerDTO {
  id: string;
  username: string;
  avatar_url: string;
  is_bot: boolean;
  is_ready: boolean;
}

export interface ApiRoomDTO {
  id: string;
  code: string;
  title: string;
  mode: 'classic';
  deck_size: DeckSize;
  max_players: 2 | 3 | 4;
  anim_mode: AnimMode;
  is_private: boolean;
  host_name: string;
  status: RoomStatus;
  players: ApiRoomPlayerDTO[];
  created_at: string;
}

export function mapUserFromApi(dto: ApiUserDTO): UserAccount {
  return {
    id: dto.id,
    username: dto.username,
    email: dto.email,
    avatarUrl: dto.avatar_url,
    gamesPlayed: dto.games_played,
    wins: dto.wins,
    losses: dto.losses,
    createdAt: dto.created_at,
  };
}

export function mapRoomPlayerFromApi(dto: ApiRoomPlayerDTO): RoomPlayer {
  return {
    id: dto.id,
    username: dto.username,
    avatarUrl: dto.avatar_url,
    isBot: dto.is_bot,
    isReady: dto.is_ready,
  };
}

export function mapRoomFromApi(dto: ApiRoomDTO): Room {
  return {
    id: dto.id,
    code: dto.code,
    title: dto.title,
    mode: dto.mode,
    deckSize: dto.deck_size,
    maxPlayers: dto.max_players,
    animMode: dto.anim_mode,
    isPrivate: dto.is_private,
    hostName: dto.host_name,
    status: dto.status,
    players: dto.players.map(mapRoomPlayerFromApi),
    createdAt: dto.created_at,
  };
}

export const authApi = {
  async login(identifier: string, password: string): Promise<UserAccount> {
    const res = await apiRequest<ApiAuthResponseDTO>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    });
    setAccessToken(res.access_token);
    return mapUserFromApi(res.user);
  },

  async register(username: string, email: string, password: string): Promise<UserAccount> {
    const res = await apiRequest<ApiAuthResponseDTO>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });
    setAccessToken(res.access_token);
    return mapUserFromApi(res.user);
  },

  async me(): Promise<UserAccount> {
    const dto = await apiRequest<ApiUserDTO>('/api/auth/me');
    return mapUserFromApi(dto);
  },

  async logout(): Promise<void> {
    try {
      await apiRequest<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
    } finally {
      clearAccessToken();
    }
  },

  async requestPasswordRecovery(email: string): Promise<{ message: string }> {
    return apiRequest<{ message: string }>('/api/auth/password-recovery', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },
};

export const profileApi = {
  async updateProfile(updates: {
    username?: string;
    avatarUrl?: string;
  }): Promise<UserAccount> {
    const dto = await apiRequest<ApiUserDTO>('/api/profile', {
      method: 'PATCH',
      body: JSON.stringify({
        username: updates.username,
        avatar_url: updates.avatarUrl,
      }),
    });
    return mapUserFromApi(dto);
  },

  async requestEmailRebind(newEmail: string): Promise<{ message: string }> {
    return apiRequest<{ message: string }>('/api/profile/email-rebind', {
      method: 'POST',
      body: JSON.stringify({ new_email: newEmail }),
    });
  },

  async requestPasswordChangeCode(): Promise<{ message: string }> {
    return apiRequest<{ message: string }>('/api/profile/password-change-code', {
      method: 'POST',
    });
  },
};

export const lobbyApi = {
  async listRooms(params?: {
    status?: 'waiting' | 'playing';
    search?: string;
  }): Promise<Room[]> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    const qs = query.toString();
    const list = await apiRequest<ApiRoomDTO[]>(`/api/rooms${qs ? `?${qs}` : ''}`);
    return list.map(mapRoomFromApi);
  },

  async createRoom(payload: {
    title: string;
    deckSize: DeckSize;
    maxPlayers: 2 | 3 | 4;
    animMode: AnimMode;
    isPrivate: boolean;
  }): Promise<Room> {
    const dto = await apiRequest<ApiRoomDTO>('/api/rooms', {
      method: 'POST',
      body: JSON.stringify({
        title: payload.title,
        deck_size: payload.deckSize,
        max_players: payload.maxPlayers,
        anim_mode: payload.animMode,
        is_private: payload.isPrivate,
      }),
    });
    return mapRoomFromApi(dto);
  },

  async joinRoom(roomId: string): Promise<Room> {
    const dto = await apiRequest<ApiRoomDTO>(
      `/api/rooms/${encodeURIComponent(roomId)}/join`,
      { method: 'POST' }
    );
    return mapRoomFromApi(dto);
  },

  async joinByCode(code: string): Promise<Room> {
    const dto = await apiRequest<ApiRoomDTO>('/api/rooms/join-by-code', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    return mapRoomFromApi(dto);
  },

  async leaveRoom(roomId: string): Promise<void> {
    await apiRequest<{ ok: boolean }>(
      `/api/rooms/${encodeURIComponent(roomId)}/leave`,
      { method: 'POST' }
    );
  },
};

export const gameApi = {
  async recordResult(
    roomId: string,
    outcome: 'player_win' | 'bot_win' | 'draw'
  ): Promise<UserAccount> {
    const dto = await apiRequest<ApiUserDTO>(
      `/api/games/${encodeURIComponent(roomId)}/result`,
      {
        method: 'POST',
        body: JSON.stringify({ outcome }),
      }
    );
    return mapUserFromApi(dto);
  },
};

export type ClientGameWsEvent =
  | { type: 'player_ready'; is_ready: boolean }
  | { type: 'play_card'; card_id: string }
  | { type: 'bito' }
  | { type: 'take' }
  | { type: 'surrender' };

export type ServerGameWsEvent =
  | { type: 'room_state'; room: ApiRoomDTO }
  | { type: 'player_ready'; user_id: string; is_ready: boolean }
  | { type: 'game_started'; payload: unknown }
  | { type: 'game_update'; payload: unknown }
  | { type: 'error'; detail: string };

export function connectGameRoomSocket(
  roomId: string,
  onEvent: (event: ServerGameWsEvent) => void,
  onClose?: () => void
): {
  send: (event: ClientGameWsEvent) => void;
  close: () => void;
} | null {
  if (!isBackendEnabled() || typeof WebSocket === 'undefined') {
    return null;
  }

  const ws = new WebSocket(buildRoomWebSocketUrl(roomId));
  ws.onmessage = (msg) => {
    try {
      const parsed = JSON.parse(String(msg.data)) as ServerGameWsEvent;
      onEvent(parsed);
    } catch {
      // Ignore malformed JSON frames
    }
  };
  ws.onclose = () => {
    onClose?.();
  };

  return {
    send(event) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(event));
      }
    },
    close() {
      ws.close();
    },
  };
}

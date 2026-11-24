import { useEffect, useState } from 'react';
import { ArrowLeft, Clock, User } from 'lucide-react';
import {
  AVATAR_PRESETS,
  INITIAL_ACCOUNTS,
  INITIAL_ROOMS,
} from './data/presets';
import { AnimMode, DeckSize, Room, UserAccount } from './types/durak';
import { ApiError, getAccessToken, isBackendEnabled } from './api/client';
import { authApi, gameApi, lobbyApi } from './api/durakApi';
import { ProfileView } from './components/ProfileView';
import { LobbyView } from './components/LobbyView';
import { GameTableView } from './components/GameTableView';

type AppPage = 'lobby' | 'profile' | 'table';

export default function App() {
  const backendMode = isBackendEnabled();

  const [page, setPage] = useState<AppPage>('lobby');
  const [accounts, setAccounts] = useState<UserAccount[]>(
    backendMode ? [] : INITIAL_ACCOUNTS
  );
  const [currentUserId, setCurrentUserId] = useState<string | null>(
    backendMode ? null : INITIAL_ACCOUNTS[0].id
  );
  const [rooms, setRooms] = useState<Room[]>(backendMode ? [] : INITIAL_ROOMS);
  const [infoModalText, setInfoModalText] = useState<string | null>(null);

  const [activeMatch, setActiveMatch] = useState<{
    roomId: string | null;
    roomTitle: string;
    deckSize: DeckSize;
    maxPlayers: 2 | 3 | 4;
    animMode: AnimMode;
    initialOpponents: Array<{ id: string; username: string; avatarUrl: string }>;
  }>({
    roomId: null,
    roomTitle: 'Быстрая партия · Классика',
    deckSize: 36,
    maxPlayers: 2,
    animMode: 'classic',
    initialOpponents: [
      { id: 'bot-alina', username: 'Алина_К', avatarUrl: AVATAR_PRESETS[1].url },
    ],
  });

  const currentUser = accounts.find((a) => a.id === currentUserId) ?? null;

  useEffect(() => {
    if (!backendMode) return;

    let cancelled = false;
    const bootstrap = async () => {
      if (getAccessToken()) {
        try {
          const me = await authApi.me();
          if (!cancelled) {
            setAccounts([me]);
            setCurrentUserId(me.id);
          }
        } catch {
          if (!cancelled) {
            setCurrentUserId(null);
          }
        }
      }

      try {
        const list = await lobbyApi.listRooms();
        if (!cancelled) {
          setRooms(list);
        }
      } catch {
        // Keep empty list until backend is reachable
      }
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [backendMode]);

  useEffect(() => {
    if (!backendMode || page !== 'lobby') return;
    let cancelled = false;
    lobbyApi
      .listRooms()
      .then((list) => {
        if (!cancelled) setRooms(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [backendMode, page]);

  const handleLogin = (account: UserAccount) => {
    setAccounts((prev) => {
      const exists = prev.some((a) => a.id === account.id);
      return exists
        ? prev.map((a) => (a.id === account.id ? account : a))
        : [account, ...prev];
    });
    setCurrentUserId(account.id);
  };

  const handleRegister = (newAccount: UserAccount) => {
    setAccounts((prev) => [newAccount, ...prev]);
    setCurrentUserId(newAccount.id);
  };

  const handleLogout = async () => {
    if (backendMode) {
      await authApi.logout().catch(() => {});
    }
    setCurrentUserId(null);
  };

  const handleUpdateProfile = (updates: Partial<UserAccount>) => {
    if (!currentUserId) return;
    setAccounts((prev) =>
      prev.map((a) => (a.id === currentUserId ? { ...a, ...updates } : a))
    );
  };

  const enterRoomTable = (room: Room, user: UserAccount) => {
    const opponents = room.players
      .filter((p) => p.id !== user.id)
      .map((p) => ({ id: p.id, username: p.username, avatarUrl: p.avatarUrl }));

    setInfoModalText(null);
    setActiveMatch({
      roomId: room.id,
      roomTitle: room.title,
      deckSize: room.deckSize,
      maxPlayers: room.maxPlayers,
      animMode: room.animMode,
      initialOpponents: opponents,
    });
    setPage('table');
  };

  const handleCreateRoom = async (roomData: {
    title: string;
    deckSize: DeckSize;
    maxPlayers: 2 | 3 | 4;
    animMode: AnimMode;
    isPrivate: boolean;
  }) => {
    if (!currentUser) {
      setPage('profile');
      return;
    }

    if (backendMode) {
      try {
        const created = await lobbyApi.createRoom(roomData);
        setRooms((prev) => [created, ...prev]);
        enterRoomTable(created, currentUser);
      } catch (err) {
        setInfoModalText(
          err instanceof ApiError ? err.message : 'Не удалось создать стол.'
        );
      }
      return;
    }

    const newCode = String(Math.floor(1000 + Math.random() * 9000));
    const newRoom: Room = {
      id: `room-${Date.now()}`,
      code: newCode,
      title: roomData.title,
      mode: 'classic',
      deckSize: roomData.deckSize,
      maxPlayers: roomData.maxPlayers,
      animMode: roomData.animMode,
      isPrivate: roomData.isPrivate,
      hostName: currentUser.username,
      status: 'waiting',
      createdAt: 'Только что',
      players: [
        {
          id: currentUser.id,
          username: currentUser.username,
          avatarUrl: currentUser.avatarUrl,
          isBot: false,
          isReady: false,
        },
      ],
    };
    setRooms((prev) => [newRoom, ...prev]);
    enterRoomTable(newRoom, currentUser);
  };

  const handleJoinRoom = async (roomId: string) => {
    if (!currentUser) {
      setPage('profile');
      return;
    }

    if (backendMode) {
      try {
        const joined = await lobbyApi.joinRoom(roomId);
        setRooms((prev) => prev.map((r) => (r.id === joined.id ? joined : r)));
        enterRoomTable(joined, currentUser);
      } catch (err) {
        setInfoModalText(
          err instanceof ApiError ? err.message : 'Не удалось войти в стол.'
        );
      }
      return;
    }

    const targetRoom = rooms.find((r) => r.id === roomId);
    if (!targetRoom) return;
    enterRoomTable(targetRoom, currentUser);
  };

  const handleJoinByCode = async (code: string): Promise<string | null> => {
    if (!currentUser) {
      setPage('profile');
      return null;
    }

    if (backendMode) {
      try {
        const joined = await lobbyApi.joinByCode(code);
        setRooms((prev) =>
          prev.some((r) => r.id === joined.id)
            ? prev.map((r) => (r.id === joined.id ? joined : r))
            : [joined, ...prev]
        );
        enterRoomTable(joined, currentUser);
        return null;
      } catch (err) {
        return err instanceof ApiError ? err.message : 'Стол с таким кодом не найден.';
      }
    }

    const target = rooms.find((r) => r.code === code);
    if (!target) {
      return 'Стол с таким кодом не найден.';
    }
    enterRoomTable(target, currentUser);
    return null;
  };

  const handleQuickPlay = () => {
    setInfoModalText(null);
    setActiveMatch({
      roomId: null,
      roomTitle: 'Быстрая партия · Классика',
      deckSize: 36,
      maxPlayers: 2,
      animMode: 'classic',
      initialOpponents: [
        { id: 'bot-alina', username: 'Алина_К', avatarUrl: AVATAR_PRESETS[1].url },
      ],
    });
    setPage('table');
  };

  const handleRecordResult = async (outcome: 'player_win' | 'bot_win' | 'draw') => {
    if (!currentUserId) return;

    if (backendMode && activeMatch.roomId) {
      try {
        const updated = await gameApi.recordResult(activeMatch.roomId, outcome);
        setAccounts((prev) =>
          prev.map((acc) => (acc.id === updated.id ? updated : acc))
        );
        return;
      } catch {
        // Fallback locally if request fails
      }
    }

    setAccounts((prev) =>
      prev.map((acc) => {
        if (acc.id !== currentUserId) return acc;
        return {
          ...acc,
          gamesPlayed: acc.gamesPlayed + 1,
          wins: outcome === 'player_win' ? acc.wins + 1 : acc.wins,
          losses: outcome === 'bot_win' ? acc.losses + 1 : acc.losses,
        };
      })
    );
  };

  const handleExitToLobby = (reason?: string) => {
    if (backendMode && activeMatch.roomId) {
      lobbyApi.leaveRoom(activeMatch.roomId).catch(() => {});
    }
    if (reason) setInfoModalText(reason);
    setPage('lobby');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0F1412] text-[#F3EFE6]">
      {/* Minimal Header (hidden completely during battle) */}
      {page !== 'table' && (
        <header className="border-b border-white/10 bg-[#0F1412]/95 sticky top-0 z-20 backdrop-blur-xs">
          <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
            <button
              type="button"
              onClick={() => setPage('lobby')}
              className="font-display text-xl font-bold tracking-tight text-[#F3EFE6] whitespace-nowrap shrink-0 hover:text-[#D6A954] transition-colors"
            >
              Дурак Онлайн
            </button>

            <button
              type="button"
              onClick={() => setPage(page === 'profile' ? 'lobby' : 'profile')}
              className="inline-flex items-center gap-2.5 px-4 py-2 rounded-xl border border-[#D6A954]/45 bg-[#161F1B] text-sm font-medium text-[#F3EFE6] shadow-[0_2px_10px_rgba(0,0,0,0.3)] hover:border-[#D6A954] hover:bg-[#1D2A24] transition-all duration-150 whitespace-nowrap shrink-0"
            >
              {page === 'profile' ? (
                <>
                  <ArrowLeft className="w-4 h-4 text-[#D6A954]" />
                  <span>Назад</span>
                </>
              ) : currentUser ? (
                <>
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.username}
                    referrerPolicy="no-referrer"
                    className="w-5 h-5 rounded-full object-cover scale-105 border border-[#D6A954]/60"
                  />
                  <span>Профиль</span>
                </>
              ) : (
                <>
                  <User className="w-4 h-4 text-[#D6A954]" />
                  <span>Войти</span>
                </>
              )}
            </button>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className="flex-1">
        {page === 'lobby' && (
          <LobbyView
            rooms={rooms}
            currentUser={currentUser}
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            onJoinByCode={handleJoinByCode}
            onQuickPlay={handleQuickPlay}
            onOpenAuth={() => setPage('profile')}
          />
        )}

        {page === 'profile' && (
          <ProfileView
            key={currentUser?.id ?? 'guest'}
            user={currentUser}
            accounts={accounts}
            onLogin={handleLogin}
            onRegister={handleRegister}
            onUpdateProfile={handleUpdateProfile}
            onLogout={handleLogout}
          />
        )}

        {page === 'table' && (
          <GameTableView
            currentUser={currentUser}
            roomTitle={activeMatch.roomTitle}
            deckSize={activeMatch.deckSize}
            maxPlayers={activeMatch.maxPlayers}
            animMode={activeMatch.animMode}
            initialOpponents={activeMatch.initialOpponents}
            onRecordResult={handleRecordResult}
            onExitToLobby={handleExitToLobby}
          />
        )}
      </main>

      {/* Info Modal: Timeout / Kicked to Lobby ("Время ожидания превышено" + "Так точно") */}
      {infoModalText && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="timeout-modal-title"
        >
          <div className="w-full max-w-sm bg-[#151C19] border border-[#D6A954]/45 rounded-xl p-6 shadow-2xl text-center">
            <div className="w-11 h-11 rounded-full bg-[#D6A954]/15 border border-[#D6A954]/40 flex items-center justify-center mx-auto text-[#D6A954]">
              <Clock className="w-5 h-5" />
            </div>
            <h2 id="timeout-modal-title" className="text-lg font-semibold text-[#F3EFE6] mt-4">
              {infoModalText.startsWith('Время ожидания')
                ? 'Время ожидания превышено'
                : 'Уведомление'}
            </h2>
            <p className="text-sm text-[#94A099] mt-2">{infoModalText}</p>
            <button
              type="button"
              onClick={() => setInfoModalText(null)}
              className="mt-6 w-full py-2.5 px-5 rounded-lg bg-[#D6A954] text-[#111714] font-semibold text-sm hover:bg-[#E1B96B] transition-colors"
            >
              Так точно
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

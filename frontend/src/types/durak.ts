export type ViewTab = 'lobby' | 'table' | 'profile' | 'auth';

export type AuthMode = 'login' | 'register' | 'recovery';

export type AnimMode = 'classic' | 'fast';

export interface UserAccount {
  id: string;
  username: string;
  email: string;
  passwordHash?: string;
  avatarUrl: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  createdAt: string;
}

export type RoomStatus = 'waiting' | 'playing';
export type GameMode = 'classic';
export type DeckSize = 36 | 52;

export interface RoomPlayer {
  id: string;
  username: string;
  avatarUrl: string;
  isBot: boolean;
  isReady: boolean;
}

export interface Room {
  id: string;
  code: string;
  title: string;
  mode: GameMode;
  deckSize: DeckSize;
  maxPlayers: 2 | 3 | 4;
  animMode: AnimMode;
  isPrivate: boolean;
  hostName: string;
  status: RoomStatus;
  players: RoomPlayer[];
  createdAt: string;
}

export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
}

export interface TablePair {
  attack: Card;
  defense: Card | null;
}

export type RoundOutcome = 'player_win' | 'bot_win' | 'draw' | null;

export interface MultiDurakGameState {
  roomTitle: string;
  deckSize: DeckSize;
  playerCount: number;
  deck: Card[];
  trumpCard: Card | null;
  trumpSuit: Suit;
  discardCount: number;
  hands: Card[][];
  finishedOrder: number[];
  attackerIndex: number;
  defenderIndex: number;
  activeActorIndex: number;
  outcome: RoundOutcome;
  tablePairs: TablePair[];
}

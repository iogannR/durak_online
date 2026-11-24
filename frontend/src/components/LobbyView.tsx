import React, { useState } from 'react';
import { Lock, Play, Plus, Search, Users, X } from 'lucide-react';
import { AnimMode, DeckSize, Room, UserAccount } from '../types/durak';

interface LobbyViewProps {
  rooms: Room[];
  currentUser: UserAccount | null;
  onCreateRoom: (roomData: {
    title: string;
    deckSize: DeckSize;
    maxPlayers: 2 | 3 | 4;
    animMode: AnimMode;
    isPrivate: boolean;
  }) => void | Promise<void>;
  onJoinRoom: (roomId: string) => void | Promise<void>;
  onJoinByCode: (code: string) => Promise<string | null>;
  onQuickPlay: () => void;
  onOpenAuth: () => void;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  rooms,
  currentUser,
  onCreateRoom,
  onJoinRoom,
  onJoinByCode,
  onQuickPlay,
  onOpenAuth,
}) => {
  const [filter, setFilter] = useState<'all' | 'waiting' | 'playing'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState('');

  // Modal state for creating a room
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [title, setTitle] = useState('Вечерняя партия · Классика');
  const [deckSize, setDeckSize] = useState<DeckSize>(36);
  const [maxPlayers, setMaxPlayers] = useState<2 | 3 | 4>(2);
  const [animMode, setAnimMode] = useState<AnimMode>('classic');
  const [isPrivate, setIsPrivate] = useState(false);

  const filteredRooms = rooms.filter((room) => {
    if (filter !== 'all' && room.status !== filter) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      room.title.toLowerCase().includes(q) ||
      room.hostName.toLowerCase().includes(q) ||
      room.code.includes(q)
    );
  });

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setCodeError('');
    const cleanCode = codeInput.trim();
    if (!cleanCode) {
      setCodeError('Введите код стола.');
      return;
    }
    const errMsg = await onJoinByCode(cleanCode);
    if (errMsg) {
      setCodeError(errMsg);
      return;
    }
    setCodeInput('');
  };

  const handleOpenCreateModal = () => {
    if (!currentUser) {
      onOpenAuth();
      return;
    }
    setIsCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim() || 'Классический стол';
    await onCreateRoom({
      title: cleanTitle,
      deckSize,
      maxPlayers,
      animMode,
      isPrivate,
    });
    setIsCreateModalOpen(false);
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Header & Primary Lobby Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <h1 className="text-3xl font-semibold text-[#F3EFE6]">Игровые столы</h1>
          <p className="text-sm text-[#94A099] mt-1">Классический Дурак в браузере</p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onQuickPlay}
            className="px-4 py-2.5 rounded-lg border border-white/15 text-sm font-medium text-[#F3EFE6] hover:border-[#D6A954] transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Play className="w-4 h-4 text-[#D6A954]" />
            Быстрая игра
          </button>
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="px-4 py-2.5 rounded-lg bg-[#D6A954] text-[#111714] font-semibold text-sm hover:bg-[#E1B96B] transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            Создать стол
          </button>
        </div>
      </div>

      {/* Filters, Search & Private Code */}
      <div className="mt-6 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-[#151C19] border border-white/10 rounded-lg">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filter === 'all' ? 'bg-[#222E29] text-[#F3EFE6]' : 'text-[#94A099] hover:text-[#F3EFE6]'
              }`}
            >
              Все ({rooms.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('waiting')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filter === 'waiting'
                  ? 'bg-[#222E29] text-[#F3EFE6]'
                  : 'text-[#94A099] hover:text-[#F3EFE6]'
              }`}
            >
              Ожидают ({rooms.filter((r) => r.status === 'waiting').length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('playing')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filter === 'playing'
                  ? 'bg-[#222E29] text-[#F3EFE6]'
                  : 'text-[#94A099] hover:text-[#F3EFE6]'
              }`}
            >
              В игре ({rooms.filter((r) => r.status === 'playing').length})
            </button>
          </div>

          <div className="relative w-full sm:w-60">
            <Search className="w-4 h-4 text-[#6E7A74] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск стола..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#151C19] border border-white/15 text-sm text-[#F3EFE6] placeholder:text-[#6E7A74] focus:outline-none focus:border-[#D6A954]"
            />
          </div>
        </div>

        <form onSubmit={handleJoinByCode} className="flex items-center gap-2">
          <input
            type="text"
            maxLength={4}
            value={codeInput}
            onChange={(e) => {
              setCodeInput(e.target.value);
              setCodeError('');
            }}
            placeholder="Код (4812)"
            className="w-32 px-3 py-2 rounded-lg bg-[#151C19] border border-white/15 text-sm text-[#F3EFE6] font-mono placeholder:font-sans placeholder:text-[#6E7A74] focus:outline-none focus:border-[#D6A954]"
          />
          <button
            type="submit"
            className="px-3.5 py-2 rounded-lg border border-white/15 text-sm text-[#D6D0C4] hover:border-[#D6A954] hover:text-[#F3EFE6] transition-colors whitespace-nowrap shrink-0"
          >
            Войти по коду
          </button>
        </form>
      </div>

      {codeError && <p className="mt-3 text-xs text-[#F28B82]">{codeError}</p>}

      {/* Room List */}
      <div className="mt-6 bg-[#151C19] border border-white/10 rounded-xl divide-y divide-white/10">
        {filteredRooms.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#94A099]">Нет подходящих столов.</div>
        ) : (
          filteredRooms.map((room) => {
            const isFull = room.players.length >= room.maxPlayers;
            const canJoin = room.status === 'waiting' && !isFull;

            return (
              <div
                key={room.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {room.isPrivate && (
                      <Lock className="w-3.5 h-3.5 text-[#D6A954] shrink-0" aria-label="Приватный стол" />
                    )}
                    <h3 className="text-base font-semibold text-[#F3EFE6] truncate">{room.title}</h3>
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#94A099] tabular-nums">
                    <span>Классика</span>
                    <span aria-hidden="true">·</span>
                    <span>{room.deckSize} карт</span>
                    <span aria-hidden="true">·</span>
                    <span>{room.animMode === 'fast' ? 'Быстрые анимации' : 'Плавные анимации'}</span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {room.players.length} из {room.maxPlayers}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{room.hostName}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-[#D6D0C4]">#{room.code}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <span
                    className={`text-xs font-medium ${
                      room.status === 'waiting' ? 'text-[#7CD4A0]' : 'text-[#94A099]'
                    }`}
                  >
                    {room.status === 'waiting' ? 'Открыт' : 'В игре'}
                  </span>

                  <button
                    type="button"
                    onClick={() => onJoinRoom(room.id)}
                    disabled={!canJoin}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                      canJoin
                        ? 'bg-[#D6A954] text-[#111714] hover:bg-[#E1B96B]'
                        : 'border border-white/10 text-[#6E7A74] cursor-not-allowed'
                    }`}
                  >
                    {canJoin ? 'Войти' : 'Занят'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Room Modal */}
      {isCreateModalOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-room-title"
        >
          <div className="w-full max-w-md bg-[#151C19] border border-white/15 rounded-xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <h2 id="create-room-title" className="text-lg font-semibold text-[#F3EFE6]">
                Создать стол
              </h2>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                aria-label="Закрыть окно"
                className="text-[#94A099] hover:text-[#F3EFE6] p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-5 space-y-5">
              <div>
                <label className="block text-sm text-[#D6D0C4] mb-1.5">Название стола</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={48}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#0F1412] border border-white/15 text-sm text-[#F3EFE6] focus:outline-none focus:border-[#D6A954]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-sm text-[#D6D0C4] mb-1.5">Колода</span>
                  <div className="grid grid-cols-2 gap-1 p-1 bg-[#0F1412] border border-white/10 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setDeckSize(36)}
                      className={`py-1.5 text-xs font-medium rounded-md tabular-nums ${
                        deckSize === 36
                          ? 'bg-[#222E29] text-[#F3EFE6]'
                          : 'text-[#94A099] hover:text-[#F3EFE6]'
                      }`}
                    >
                      36 карт
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeckSize(52)}
                      className={`py-1.5 text-xs font-medium rounded-md tabular-nums ${
                        deckSize === 52
                          ? 'bg-[#222E29] text-[#F3EFE6]'
                          : 'text-[#94A099] hover:text-[#F3EFE6]'
                      }`}
                    >
                      52 карты
                    </button>
                  </div>
                </div>

                <div>
                  <span className="block text-sm text-[#D6D0C4] mb-1.5">Игроков</span>
                  <div className="grid grid-cols-3 gap-1 p-1 bg-[#0F1412] border border-white/10 rounded-lg">
                    {([2, 3, 4] as const).map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setMaxPlayers(count)}
                        className={`py-1.5 text-xs font-medium rounded-md tabular-nums ${
                          maxPlayers === count
                            ? 'bg-[#222E29] text-[#F3EFE6]'
                            : 'text-[#94A099] hover:text-[#F3EFE6]'
                        }`}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <span className="block text-sm text-[#D6D0C4] mb-1.5">Скорость анимаций</span>
                <div className="grid grid-cols-2 gap-1 p-1 bg-[#0F1412] border border-white/10 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setAnimMode('classic')}
                    className={`py-2 text-xs font-medium rounded-md ${
                      animMode === 'classic'
                        ? 'bg-[#222E29] text-[#F3EFE6]'
                        : 'text-[#94A099] hover:text-[#F3EFE6]'
                    }`}
                  >
                    Классика (плавно)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnimMode('fast')}
                    className={`py-2 text-xs font-medium rounded-md ${
                      animMode === 'fast'
                        ? 'bg-[#222E29] text-[#F3EFE6]'
                        : 'text-[#94A099] hover:text-[#F3EFE6]'
                    }`}
                  >
                    Быстрые
                  </button>
                </div>
              </div>

              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <span className="text-sm text-[#D6D0C4]">Приватный вход по коду</span>
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="w-4 h-4 accent-[#D6A954]"
                />
              </label>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-white/15 text-sm text-[#D6D0C4] hover:bg-white/5"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#D6A954] text-[#111714] font-semibold text-sm hover:bg-[#E1B96B]"
                >
                  Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, animate, motion, useMotionValue } from 'motion/react';
import { Clock, Flag, LogOut, Volume2, VolumeX, WifiOff } from 'lucide-react';
import {
  AnimMode,
  Card,
  DeckSize,
  MultiDurakGameState,
  UserAccount,
} from '../types/durak';
import { AVATAR_PRESETS, TABLE_FELT_IMAGE } from '../data/presets';
import {
  canAttackWith,
  canBeat,
  chooseBotAttackCard,
  chooseBotDefenseCard,
  createMultiInitialGame,
  getNextActivePlayer,
  isRedSuit,
  refillMultiHands,
  sortHand,
  SUIT_SYMBOLS,
  updateFinishedAndOutcome,
} from '../utils/durakEngine';
import { soundFX } from '../utils/sound';
import { PlayingCard } from './PlayingCard';

interface GameTableViewProps {
  currentUser: UserAccount | null;
  roomTitle: string;
  deckSize: DeckSize;
  maxPlayers: 2 | 3 | 4;
  animMode: AnimMode;
  initialOpponents: Array<{ id: string; username: string; avatarUrl: string }>;
  onRecordResult: (outcome: 'player_win' | 'bot_win' | 'draw') => void;
  onExitToLobby: (reason?: string) => void;
}

type TablePhase = 'WAITING' | 'READY_CHECK' | 'PLAYING' | 'ROUND_END';

interface SeatSlot {
  seatIndex: number;
  occupant: {
    id: string;
    username: string;
    avatarUrl: string;
    isBot: boolean;
  } | null;
  isReady: boolean;
  disconnected: boolean;
}

interface Vec2 {
  x: number;
  y: number;
}

const READY_SECONDS = 12;
const TURN_SECONDS = 30;

const BOT_POOL = [
  { id: 'bot-alina', username: 'Алина_К', avatarUrl: AVATAR_PRESETS[1].url },
  { id: 'bot-artem', username: 'Артём_ФМ', avatarUrl: AVATAR_PRESETS[3].url },
  { id: 'bot-egor', username: 'Егор_ВШЭ', avatarUrl: AVATAR_PRESETS[2].url },
];

function measureDelta(fromEl: HTMLElement | null, toEl: HTMLElement | null, fallback: Vec2): Vec2 {
  if (!fromEl || !toEl) return fallback;
  const f = fromEl.getBoundingClientRect();
  const t = toEl.getBoundingClientRect();
  return {
    x: f.left + f.width / 2 - (t.left + t.width / 2),
    y: f.top + f.height / 2 - (t.top + t.height / 2),
  };
}

function measureDeltaFromDeckPoint(toEl: HTMLElement | null, fallback: Vec2): Vec2 {
  if (!toEl || typeof window === 'undefined') return fallback;
  const t = toEl.getBoundingClientRect();
  const deckX = window.innerWidth - 52;
  const deckY = window.innerHeight * 0.45;
  return {
    x: deckX - (t.left + t.width / 2),
    y: deckY - (t.top + t.height / 2),
  };
}

const tablePairVariants = {
  initial: (origin: Vec2) => ({
    opacity: 0,
    x: origin.x,
    y: origin.y,
    scale: 0.72,
    rotate: -10,
  }),
  animate: {
    opacity: 1,
    x: 0,
    y: 0,
    scale: 1,
    rotate: 0,
  },
  exit: (exitVec: Vec2) => ({
    opacity: 0,
    x: exitVec.x,
    y: exitVec.y,
    scale: 0.45,
    rotate: -18,
  }),
};

function isMobileOrTouchInput(pointerType?: string): boolean {
  if (pointerType === 'touch' || pointerType === 'pen') return true;
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768
  );
}

interface DraggableHandCardProps {
  card: Card;
  idx: number;
  dealId: number;
  playable: boolean;
  shouldDim: boolean;
  isTrump: boolean;
  overlapClass: string;
  angle: number;
  dropY: number;
  entryOrigin: Vec2;
  isInitialDealPhase: boolean;
  dealCardDuration: number;
  dealStagger: number;
  isClassic: boolean;
  isDraggingThis: boolean;
  anyDragging: boolean;
  wasPlayedByDrag: boolean;
  onDragStartCard: (card: Card) => void;
  onDragMoveCard: (point: { x: number; y: number }, offset: { x: number; y: number }) => void;
  onDragEndCard: (
    card: Card,
    point: { x: number; y: number },
    offset: { x: number; y: number },
    movedDuringDrag: boolean
  ) => boolean;
  onClickCard: (
    card: Card,
    pointerType: string,
    e: React.MouseEvent<HTMLButtonElement>
  ) => void;
}

const DraggableHandCard: React.FC<DraggableHandCardProps> = ({
  card,
  idx,
  dealId,
  playable,
  shouldDim,
  isTrump,
  overlapClass,
  angle,
  dropY,
  entryOrigin,
  isInitialDealPhase,
  dealCardDuration,
  dealStagger,
  isClassic,
  isDraggingThis,
  anyDragging,
  wasPlayedByDrag,
  onDragStartCard,
  onDragMoveCard,
  onDragEndCard,
  onClickCard,
}) => {
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);
  const movedBeyondTapRef = useRef(false);
  const pointerTypeRef = useRef<string>('mouse');

  useEffect(() => {
    if (!playable) {
      animate(dragX, 0, { type: 'spring', stiffness: 460, damping: 34 });
      animate(dragY, 0, { type: 'spring', stiffness: 460, damping: 34 });
    }
  }, [playable, dragX, dragY]);

  const disableHoverLift = isMobileOrTouchInput(pointerTypeRef.current);

  return (
    <motion.div
      key={`${dealId}-hand-${card.id}`}
      layout={!isDraggingThis ? 'position' : false}
      animate={{
        y: dropY,
        rotate: angle,
      }}
      exit={{
        opacity: 0,
        transition: { duration: 0.04 },
      }}
      transition={{
        duration: 0.2,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={`shrink-0 ${idx === 0 ? '' : overlapClass}`}
      style={{ zIndex: isDraggingThis ? 60 : idx + 1 }}
    >
      <motion.div
        initial={{
          opacity: 0,
          x: entryOrigin.x,
          y: entryOrigin.y,
          scale: 0.52,
          rotate: 14,
        }}
        animate={{
          opacity: 1,
          x: 0,
          y: 0,
          scale: 1,
          rotate: 0,
        }}
        transition={{
          duration: dealCardDuration,
          ease: [0.22, 1, 0.36, 1],
          delay: isInitialDealPhase ? idx * dealStagger : 0,
        }}
      >
        <motion.div
        drag={playable}
        dragMomentum={false}
        dragElastic={0}
        style={{ x: dragX, y: dragY }}
        onPointerDown={(e) => {
          pointerTypeRef.current = e.pointerType;
          movedBeyondTapRef.current = false;
        }}
        onDragStart={() => {
          if (!playable) return;
          movedBeyondTapRef.current = false;
          onDragStartCard(card);
        }}
        onDrag={(_, info) => {
          if (!playable) return;
          if (Math.hypot(info.offset.x, info.offset.y) > 8) {
            movedBeyondTapRef.current = true;
          }
          onDragMoveCard(info.point, info.offset);
        }}
        onDragEnd={(_, info) => {
          const moved =
            movedBeyondTapRef.current || Math.hypot(info.offset.x, info.offset.y) > 8;
          const played = onDragEndCard(card, info.point, info.offset, moved);
          if (!played) {
            animate(dragX, 0, { type: 'spring', stiffness: 460, damping: 32 });
            animate(dragY, 0, { type: 'spring', stiffness: 460, damping: 32 });
          }
        }}
        whileHover={
          !disableHoverLift && playable && !anyDragging
            ? { y: -12, transition: { duration: 0.14 } }
            : undefined
        }
        whileDrag={{
          scale: 1.06,
        }}
        className={`w-16 h-24 sm:w-22 sm:h-32 md:w-24 md:h-34 shrink-0 ${
          playable ? 'touch-none' : ''
        }`}
      >
        <PlayingCard
          card={card}
          size="md"
          playable={playable}
          dimmed={shouldDim}
          isTrump={isTrump}
          onPointerDown={(e) => {
            pointerTypeRef.current = e.pointerType;
          }}
          onClick={(e) => onClickCard(card, pointerTypeRef.current, e)}
        />
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

export const GameTableView: React.FC<GameTableViewProps> = ({
  currentUser,
  roomTitle,
  deckSize,
  maxPlayers,
  animMode,
  initialOpponents,
  onRecordResult,
  onExitToLobby,
}) => {
  const playerDisplayName = currentUser?.username ?? 'Гость';
  const playerAvatar = currentUser?.avatarUrl ?? AVATAR_PRESETS[0].url;

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [tablePhase, setTablePhase] = useState<TablePhase>('WAITING');
  const [readyTimeLeft, setReadyTimeLeft] = useState(READY_SECONDS);
  const [readyCheckKey, setReadyCheckKey] = useState(0);
  const [roundResultText, setRoundResultText] = useState('');
  const [showSurrenderConfirm, setShowSurrenderConfirm] = useState(false);

  // Physical DOM refs for exact card flight paths
  const deckElRef = useRef<HTMLDivElement | null>(null);
  const discardElRef = useRef<HTMLDivElement | null>(null);
  const tableCenterElRef = useRef<HTMLDivElement | null>(null);
  const seatElRefs = useRef<Array<HTMLDivElement | null>>([null, null, null, null]);

  // Dynamic vector origins/exits per card
  const attackOriginMapRef = useRef<Record<string, Vec2>>({});
  const defenseOriginMapRef = useRef<Record<string, Vec2>>({});
  const handCardOriginMapRef = useRef<Record<string, Vec2>>({});
  const botTakeAnimRef = useRef<Record<number, boolean>>({});
  const [clearExitDelta, setClearExitDelta] = useState<Vec2>({ x: -240, y: -80 });
  const [dealOriginMap, setDealOriginMap] = useState<Record<number, Vec2>>({});
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [isOverDropZone, setIsOverDropZone] = useState(false);
  const lastDragEndTimeRef = useRef(0);
  const lastDraggedCardIdRef = useRef<string | null>(null);
  const dragMovedBeyondTapRef = useRef(false);
  const lastPlayedViaDragIdRef = useRef<string | null>(null);

  // Seats: 0 = player (bottom), 1..maxPlayers-1 = opponents
  const [seats, setSeats] = useState<SeatSlot[]>(() => {
    const initial: SeatSlot[] = [
      {
        seatIndex: 0,
        occupant: {
          id: currentUser?.id ?? 'guest',
          username: playerDisplayName,
          avatarUrl: playerAvatar,
          isBot: false,
        },
        isReady: false,
        disconnected: false,
      },
    ];
    for (let i = 1; i < maxPlayers; i++) {
      const opp = initialOpponents[i - 1] ?? null;
      initial.push({
        seatIndex: i,
        occupant: opp
          ? { id: opp.id, username: opp.username, avatarUrl: opp.avatarUrl, isBot: true }
          : null,
        isReady: false,
        disconnected: false,
      });
    }
    return initial;
  });

  const [game, setGame] = useState<MultiDurakGameState>(() =>
    createMultiInitialGame(roomTitle, deckSize, maxPlayers)
  );
  const [dealId, setDealId] = useState(1);
  const [isInitialDealPhase, setIsInitialDealPhase] = useState(false);
  const [resultRecorded, setResultRecorded] = useState(false);

  const isClassic = animMode === 'classic';
  const cardMoveDuration = isClassic ? 0.95 : 0.35;
  const dealCardDuration = isClassic ? 1.35 : 0.52;
  const dealStagger = isClassic ? 0.17 : 0.055;
  const botThinkDelay = isClassic ? 1150 : 480;

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundFX.enabled = next;
  };

  // Compute exact deck -> seat vectors BEFORE switching into PLAYING so cards never jump
  const computeDealOrigins = (): Record<number, Vec2> => {
    const next: Record<number, Vec2> = {};
    for (let i = 0; i < maxPlayers; i++) {
      next[i] = deckElRef.current
        ? measureDelta(deckElRef.current, seatElRefs.current[i], {
            x: 240,
            y: i === 0 ? -160 : 80,
          })
        : measureDeltaFromDeckPoint(seatElRefs.current[i], {
            x: 240,
            y: i === 0 ? -160 : 80,
          });
    }
    return next;
  };

  // 1. WAITING phase
  useEffect(() => {
    if (tablePhase !== 'WAITING') return;

    const emptySeat = seats.find((s) => s.seatIndex > 0 && s.occupant === null);
    if (!emptySeat) {
      setReadyTimeLeft(READY_SECONDS);
      setReadyCheckKey((k) => k + 1);
      setSeats((prev) => prev.map((s) => ({ ...s, isReady: false, disconnected: false })));
      setTablePhase('READY_CHECK');
      return;
    }

    const joinTimer = window.setTimeout(() => {
      const usedIds = new Set(seats.map((s) => s.occupant?.id).filter(Boolean));
      const candidate =
        BOT_POOL.find((b) => !usedIds.has(b.id)) ??
        BOT_POOL[(emptySeat.seatIndex - 1) % BOT_POOL.length];

      setSeats((prev) =>
        prev.map((s) =>
          s.seatIndex === emptySeat.seatIndex
            ? {
                ...s,
                occupant: {
                  id: `${candidate.id}-${emptySeat.seatIndex}`,
                  username: candidate.username,
                  avatarUrl: candidate.avatarUrl,
                  isBot: true,
                },
                isReady: false,
                disconnected: false,
              }
            : s
        )
      );
    }, 1000);

    return () => window.clearTimeout(joinTimer);
  }, [tablePhase, seats]);

  // 2. READY_CHECK phase
  useEffect(() => {
    if (tablePhase !== 'READY_CHECK') return;

    const allReady = seats.every((s) => s.occupant !== null && s.isReady);
    if (allReady) {
      const startDelay = window.setTimeout(() => {
        setResultRecorded(false);
        setShowSurrenderConfirm(false);
        attackOriginMapRef.current = {};
        defenseOriginMapRef.current = {};
        handCardOriginMapRef.current = {};
        botTakeAnimRef.current = {};
        lastPlayedViaDragIdRef.current = null;
        dragMovedBeyondTapRef.current = false;
        setDraggingCardId(null);
        setIsOverDropZone(false);
        setDealOriginMap(computeDealOrigins());
        setDealId((d) => d + 1);
        setIsInitialDealPhase(true);
        setGame(createMultiInitialGame(roomTitle, deckSize, maxPlayers));
        setTablePhase('PLAYING');
      }, 300);
      return () => window.clearTimeout(startDelay);
    }

    const unreadyBots = seats.filter((s) => s.occupant?.isBot && !s.isReady);
    const botTimers = unreadyBots.map((botSeat, i) =>
      window.setTimeout(() => {
        setSeats((prev) =>
          prev.map((s) =>
            s.seatIndex === botSeat.seatIndex ? { ...s, isReady: true } : s
          )
        );
      }, 1100 + i * 700)
    );

    const tick = window.setInterval(() => {
      setReadyTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    return () => {
      botTimers.forEach((t) => window.clearTimeout(t));
      window.clearInterval(tick);
    };
  }, [tablePhase, seats, roomTitle, deckSize, maxPlayers]);

  // READY_CHECK timeout
  useEffect(() => {
    if (tablePhase !== 'READY_CHECK' || readyTimeLeft > 0) return;

    if (!seats[0].isReady) {
      onExitToLobby('Время ожидания превышено. Вы не успели нажать «Готов».');
      return;
    }

    setSeats((prev) =>
      prev.map((s) =>
        s.seatIndex > 0 && !s.isReady
          ? { ...s, occupant: null, isReady: false, disconnected: false }
          : { ...s, isReady: false }
      )
    );
    setTablePhase('WAITING');
  }, [tablePhase, readyTimeLeft, seats, onExitToLobby]);

  useEffect(() => {
    if (!isInitialDealPhase) return;
    const totalMs = isClassic ? 2600 : 1000;
    const t = window.setTimeout(() => setIsInitialDealPhase(false), totalMs);
    return () => window.clearTimeout(t);
  }, [isInitialDealPhase, dealId, isClassic]);

  useEffect(() => {
    if (tablePhase !== 'PLAYING') return;
    setSeats((prev) =>
      prev.map((s) => {
        if (s.seatIndex === 0 || !s.occupant) return s;
        const finished = game.finishedOrder.includes(s.seatIndex);
        return finished && !s.disconnected ? { ...s, disconnected: true } : s;
      })
    );
  }, [tablePhase, game.finishedOrder]);

  useEffect(() => {
    if (tablePhase !== 'PLAYING' || !game.outcome) return;

    if (!resultRecorded) {
      setResultRecorded(true);
      if (game.outcome === 'player_win') {
        soundFX.playWin();
        setRoundResultText('Победа!');
      } else if (game.outcome === 'bot_win') {
        setRoundResultText('Вы остались в дураках');
      } else {
        setRoundResultText('Ничья');
      }
      onRecordResult(game.outcome);
    }

    setShowSurrenderConfirm(false);
    setTablePhase('ROUND_END');
  }, [tablePhase, game.outcome, resultRecorded, onRecordResult]);

  useEffect(() => {
    if (tablePhase !== 'ROUND_END') return;

    const resetTimer = window.setTimeout(() => {
      setRoundResultText('');
      setReadyTimeLeft(READY_SECONDS);
      setSeats((prev) => {
        const nextSeats = prev.map((s) =>
          s.disconnected
            ? { ...s, occupant: null, isReady: false, disconnected: false }
            : { ...s, isReady: false }
        );
        const hasEmpty = nextSeats.some((s) => s.occupant === null);
        if (!hasEmpty) {
          setReadyCheckKey((k) => k + 1);
        }
        setTablePhase(hasEmpty ? 'WAITING' : 'READY_CHECK');
        return nextSeats;
      });
    }, 2200);

    return () => window.clearTimeout(resetTimer);
  }, [tablePhase]);

  // Bot turn automation
  useEffect(() => {
    if (tablePhase !== 'PLAYING' || game.outcome || game.activeActorIndex === 0) return;

    const timer = window.setTimeout(() => {
      // Pre-compute exit destination before state update
      const discardVec = measureDelta(discardElRef.current, tableCenterElRef.current, {
        x: -240,
        y: -80,
      });

      setGame((prev) => {
        if (prev.outcome || prev.activeActorIndex === 0) return prev;

        const actor = prev.activeActorIndex;
        const actorHand = prev.hands[actor];

        if (actor === prev.attackerIndex) {
          const defenderLen = prev.hands[prev.defenderIndex].length;
          const attackCard = chooseBotAttackCard(
            actorHand,
            prev.tablePairs,
            defenderLen,
            prev.trumpSuit
          );

          if (attackCard) {
            attackOriginMapRef.current[attackCard.id] = measureDelta(
              seatElRefs.current[actor],
              tableCenterElRef.current,
              { x: 0, y: -140 }
            );
            soundFX.playCard();
            const nextHands = prev.hands.map((h, idx) =>
              idx === actor ? h.filter((c) => c.id !== attackCard.id) : h
            );
            return {
              ...prev,
              hands: nextHands,
              tablePairs: [...prev.tablePairs, { attack: attackCard, defense: null }],
              activeActorIndex: prev.defenderIndex,
            };
          }

          if (prev.tablePairs.length > 0) {
            setClearExitDelta(discardVec);
            soundFX.playBeat();
            const discarded = prev.tablePairs.reduce(
              (acc, pair) => acc + (pair.defense ? 2 : 1),
              0
            );
            const refilled = refillMultiHands(
              prev.deck,
              prev.hands,
              prev.attackerIndex,
              prev.defenderIndex,
              prev.trumpSuit
            );
            botTakeAnimRef.current = {};
            setDealOriginMap(computeDealOrigins());
            const nextAttacker =
              refilled.hands[prev.defenderIndex].length > 0
                ? prev.defenderIndex
                : getNextActivePlayer(prev.defenderIndex, refilled.hands, prev.playerCount);
            const nextDefender = getNextActivePlayer(
              nextAttacker,
              refilled.hands,
              prev.playerCount
            );

            return updateFinishedAndOutcome({
              ...prev,
              deck: refilled.deck,
              trumpCard: refilled.trumpCardLeft ? prev.trumpCard : null,
              hands: refilled.hands,
              discardCount: prev.discardCount + discarded,
              tablePairs: [],
              attackerIndex: nextAttacker,
              defenderIndex: nextDefender,
              activeActorIndex: nextAttacker,
            });
          }

          const nextAttacker = getNextActivePlayer(
            prev.attackerIndex,
            prev.hands,
            prev.playerCount
          );
          const nextDefender = getNextActivePlayer(
            nextAttacker,
            prev.hands,
            prev.playerCount
          );
          return updateFinishedAndOutcome({
            ...prev,
            attackerIndex: nextAttacker,
            defenderIndex: nextDefender,
            activeActorIndex: nextAttacker,
          });
        }

        const undefendedIndex = prev.tablePairs.findIndex((p) => p.defense === null);
        if (undefendedIndex === -1) {
          return { ...prev, activeActorIndex: prev.attackerIndex };
        }

        const attackCard = prev.tablePairs[undefendedIndex].attack;
        const defenseCard = chooseBotDefenseCard(actorHand, attackCard, prev.trumpSuit);

        if (defenseCard) {
          defenseOriginMapRef.current[defenseCard.id] = measureDelta(
            seatElRefs.current[actor],
            tableCenterElRef.current,
            { x: 0, y: -140 }
          );
          soundFX.playCard();
          const nextHands = prev.hands.map((h, idx) =>
            idx === actor ? h.filter((c) => c.id !== defenseCard.id) : h
          );
          const nextPairs = prev.tablePairs.map((pair, idx) =>
            idx === undefendedIndex ? { ...pair, defense: defenseCard } : pair
          );
          return {
            ...prev,
            hands: nextHands,
            tablePairs: nextPairs,
            activeActorIndex: prev.attackerIndex,
          };
        }

        setClearExitDelta(
          measureDelta(seatElRefs.current[actor], tableCenterElRef.current, {
            x: 0,
            y: -180,
          })
        );
        botTakeAnimRef.current[actor] = true;
        soundFX.playTake();
        const takenCards: Card[] = [];
        for (const pair of prev.tablePairs) {
          takenCards.push(pair.attack);
          if (pair.defense) takenCards.push(pair.defense);
        }
        const handsWithTaken = prev.hands.map((h, idx) =>
          idx === actor ? sortHand([...h, ...takenCards], prev.trumpSuit) : h
        );
        const refilled = refillMultiHands(
          prev.deck,
          handsWithTaken,
          prev.attackerIndex,
          prev.defenderIndex,
          prev.trumpSuit
        );
        setDealOriginMap(computeDealOrigins());
        const nextAttacker = getNextActivePlayer(
          prev.defenderIndex,
          refilled.hands,
          prev.playerCount
        );
        const nextDefender = getNextActivePlayer(
          nextAttacker,
          refilled.hands,
          prev.playerCount
        );

        return updateFinishedAndOutcome({
          ...prev,
          deck: refilled.deck,
          trumpCard: refilled.trumpCardLeft ? prev.trumpCard : null,
          hands: refilled.hands,
          tablePairs: [],
          attackerIndex: nextAttacker,
          defenderIndex: nextDefender,
          activeActorIndex: nextAttacker,
        });
      });
    }, botThinkDelay);

    return () => window.clearTimeout(timer);
  }, [tablePhase, game.activeActorIndex, game.outcome, game.tablePairs.length, botThinkDelay]);

  const undefendedPair = game.tablePairs.find((p) => p.defense === null) ?? null;
  const allDefended =
    game.tablePairs.length > 0 && game.tablePairs.every((p) => p.defense !== null);

  const isCardPlayable = (card: Card): boolean => {
    if (tablePhase !== 'PLAYING' || game.outcome || game.activeActorIndex !== 0) {
      return false;
    }
    if (game.attackerIndex === 0) {
      return canAttackWith(card, game.tablePairs, game.hands[game.defenderIndex].length);
    }
    if (game.defenderIndex === 0 && undefendedPair) {
      return canBeat(undefendedPair.attack, card, game.trumpSuit);
    }
    return false;
  };

  const playCardWithOrigin = (card: Card, originVec: Vec2) => {
    if (!isCardPlayable(card)) return;

    setGame((prev) => {
      if (prev.outcome || prev.activeActorIndex !== 0) return prev;
      if (!prev.hands[0].some((c) => c.id === card.id)) return prev;
      if (
        prev.tablePairs.some(
          (p) => p.attack.id === card.id || p.defense?.id === card.id
        )
      ) {
        return prev;
      }

      const nextHands = prev.hands.map((h, idx) =>
        idx === 0 ? h.filter((c) => c.id !== card.id) : h
      );

      if (prev.attackerIndex === 0) {
        if (!canAttackWith(card, prev.tablePairs, prev.hands[prev.defenderIndex].length)) {
          return prev;
        }
        soundFX.playCard();
        attackOriginMapRef.current[card.id] = originVec;
        return {
          ...prev,
          hands: nextHands,
          tablePairs: [...prev.tablePairs, { attack: card, defense: null }],
          activeActorIndex: prev.defenderIndex,
        };
      }

      const targetIdx = prev.tablePairs.findIndex((p) => p.defense === null);
      if (targetIdx === -1) return prev;
      if (!canBeat(prev.tablePairs[targetIdx].attack, card, prev.trumpSuit)) {
        return prev;
      }
      soundFX.playCard();
      defenseOriginMapRef.current[card.id] = originVec;
      const nextPairs = prev.tablePairs.map((pair, idx) =>
        idx === targetIdx ? { ...pair, defense: card } : pair
      );
      return {
        ...prev,
        hands: nextHands,
        tablePairs: nextPairs,
        activeActorIndex: prev.attackerIndex,
      };
    });
  };

  const isPointInTableCenter = (point: { x: number; y: number }): boolean => {
    const tableEl = tableCenterElRef.current;
    if (!tableEl || typeof window === 'undefined') return false;
    const rect = tableEl.getBoundingClientRect();
    // Motion info.point is in page coordinates; convert to viewport coordinates to match getBoundingClientRect
    const clientX = point.x - window.scrollX;
    const clientY = point.y - window.scrollY;
    const padX = 12;
    const padTop = 18;
    const padBottom = 6;
    return (
      clientX >= rect.left - padX &&
      clientX <= rect.right + padX &&
      clientY >= rect.top - padTop &&
      clientY <= rect.bottom + padBottom
    );
  };

  const handlePlayerCardClick = (
    card: Card,
    pointerType: string,
    e: React.MouseEvent<HTMLButtonElement> | undefined
  ) => {
    // Disable tap-to-play on mobile phones / touchscreens (must drag into center)
    if (isMobileOrTouchInput(pointerType)) {
      return;
    }
    const recentlyDraggedSameCard =
      lastDraggedCardIdRef.current === card.id &&
      performance.now() - lastDragEndTimeRef.current < 500;
    if (
      recentlyDraggedSameCard ||
      dragMovedBeyondTapRef.current ||
      draggingCardId !== null
    ) {
      return;
    }
    if (!isCardPlayable(card)) return;
    lastPlayedViaDragIdRef.current = null;
    const cardBtnEl = e?.currentTarget ?? seatElRefs.current[0];
    const originVec = measureDelta(cardBtnEl, tableCenterElRef.current, { x: 0, y: 180 });
    playCardWithOrigin(card, originVec);
  };

  const handlePlayerCardDrag = (
    point: { x: number; y: number },
    offset: { x: number; y: number }
  ) => {
    const dist = Math.hypot(offset.x, offset.y);
    if (dist > 8) {
      dragMovedBeyondTapRef.current = true;
    }
    const over = dragMovedBeyondTapRef.current && isPointInTableCenter(point);
    setIsOverDropZone((prev) => (prev === over ? prev : over));
  };

  const handlePlayerCardDragEnd = (
    card: Card,
    point: { x: number; y: number },
    offset: { x: number; y: number },
    movedDuringDragFromChild: boolean
  ): boolean => {
    const movedDuringDrag =
      movedDuringDragFromChild ||
      dragMovedBeyondTapRef.current ||
      Math.hypot(offset.x, offset.y) > 8;
    const droppedInZone = movedDuringDrag && isPointInTableCenter(point);

    setDraggingCardId(null);
    setIsOverDropZone(false);
    dragMovedBeyondTapRef.current = false;

    if (movedDuringDrag) {
      lastDraggedCardIdRef.current = card.id;
      lastDragEndTimeRef.current = performance.now();
    }

    if (!droppedInZone || !isCardPlayable(card)) {
      return false;
    }

    const tableEl = tableCenterElRef.current;
    let originVec: Vec2 = { x: 0, y: 60 };
    if (tableEl && typeof window !== 'undefined') {
      const rect = tableEl.getBoundingClientRect();
      const clientX = point.x - window.scrollX;
      const clientY = point.y - window.scrollY;
      originVec = {
        x: clientX - (rect.left + rect.width / 2),
        y: clientY - (rect.top + rect.height / 2),
      };
    }

    lastPlayedViaDragIdRef.current = card.id;
    playCardWithOrigin(card, originVec);
    return true;
  };

  const handlePlayerBito = () => {
    if (
      tablePhase !== 'PLAYING' ||
      game.outcome ||
      game.activeActorIndex !== 0 ||
      game.attackerIndex !== 0 ||
      !allDefended
    ) {
      return;
    }
    setClearExitDelta(
      measureDelta(discardElRef.current, tableCenterElRef.current, { x: -240, y: -80 })
    );
    soundFX.playBeat();
    setGame((prev) => {
      if (
        prev.outcome ||
        prev.activeActorIndex !== 0 ||
        prev.attackerIndex !== 0 ||
        prev.tablePairs.length === 0
      ) {
        return prev;
      }
      const discarded = prev.tablePairs.reduce(
        (acc, pair) => acc + (pair.defense ? 2 : 1),
        0
      );
      const refilled = refillMultiHands(
        prev.deck,
        prev.hands,
        prev.attackerIndex,
        prev.defenderIndex,
        prev.trumpSuit
      );
      botTakeAnimRef.current = {};
      setDealOriginMap(computeDealOrigins());
      const nextAttacker =
        refilled.hands[prev.defenderIndex].length > 0
          ? prev.defenderIndex
          : getNextActivePlayer(prev.defenderIndex, refilled.hands, prev.playerCount);
      const nextDefender = getNextActivePlayer(
        nextAttacker,
        refilled.hands,
        prev.playerCount
      );

      return updateFinishedAndOutcome({
        ...prev,
        deck: refilled.deck,
        trumpCard: refilled.trumpCardLeft ? prev.trumpCard : null,
        hands: refilled.hands,
        discardCount: prev.discardCount + discarded,
        tablePairs: [],
        attackerIndex: nextAttacker,
        defenderIndex: nextDefender,
        activeActorIndex: nextAttacker,
      });
    });
  };

  const handlePlayerTake = () => {
    if (
      tablePhase !== 'PLAYING' ||
      game.outcome ||
      game.activeActorIndex !== 0 ||
      game.defenderIndex !== 0 ||
      game.tablePairs.length === 0
    ) {
      return;
    }
    const tableToPlayerDelta = measureDelta(
      tableCenterElRef.current,
      seatElRefs.current[0],
      { x: 0, y: -190 }
    );
    setClearExitDelta(
      measureDelta(seatElRefs.current[0], tableCenterElRef.current, { x: 0, y: 200 })
    );
    soundFX.playTake();
    setGame((prev) => {
      if (
        prev.outcome ||
        prev.activeActorIndex !== 0 ||
        prev.defenderIndex !== 0 ||
        prev.tablePairs.length === 0
      ) {
        return prev;
      }
      const takenCards: Card[] = [];
      for (const pair of prev.tablePairs) {
        takenCards.push(pair.attack);
        if (pair.defense) takenCards.push(pair.defense);
      }
      for (const tc of takenCards) {
        handCardOriginMapRef.current[tc.id] = tableToPlayerDelta;
      }
      const handsWithTaken = prev.hands.map((h, idx) =>
        idx === 0 ? sortHand([...h, ...takenCards], prev.trumpSuit) : h
      );
      const refilled = refillMultiHands(
        prev.deck,
        handsWithTaken,
        prev.attackerIndex,
        prev.defenderIndex,
        prev.trumpSuit
      );
      setDealOriginMap(computeDealOrigins());
      const nextAttacker = getNextActivePlayer(
        prev.defenderIndex,
        refilled.hands,
        prev.playerCount
      );
      const nextDefender = getNextActivePlayer(
        nextAttacker,
        refilled.hands,
        prev.playerCount
      );

      return updateFinishedAndOutcome({
        ...prev,
        deck: refilled.deck,
        trumpCard: refilled.trumpCardLeft ? prev.trumpCard : null,
        hands: refilled.hands,
        tablePairs: [],
        attackerIndex: nextAttacker,
        defenderIndex: nextDefender,
        activeActorIndex: nextAttacker,
      });
    });
  };

  // Instant surrender after confirmation modal ("при нажатии да моментально сдается")
  const handleConfirmSurrender = () => {
    setShowSurrenderConfirm(false);
    if (tablePhase !== 'PLAYING') return;
    soundFX.playTake();
    if (!resultRecorded) {
      setResultRecorded(true);
      onRecordResult('bot_win');
    }
    setRoundResultText('Вы сдались');
    setTablePhase('ROUND_END');
  };

  const handlePlayerReadyClick = () => {
    if (tablePhase !== 'READY_CHECK') return;
    soundFX.playBeat();
    setSeats((prev) =>
      prev.map((s) => (s.seatIndex === 0 ? { ...s, isReady: true } : s))
    );
  };

  const playerSeat = seats[0];
  const actionButton = (() => {
    if (tablePhase === 'WAITING') {
      return { label: 'Готов', enabled: false, variant: 'gold' as const, onClick: () => {} };
    }
    if (tablePhase === 'READY_CHECK') {
      return {
        label: playerSeat.isReady ? 'Готов ✓' : 'Готов',
        enabled: !playerSeat.isReady,
        variant: 'gold' as const,
        onClick: handlePlayerReadyClick,
      };
    }
    if (tablePhase === 'ROUND_END') {
      return { label: 'Пас', enabled: false, variant: 'gold' as const, onClick: () => {} };
    }
    if (game.attackerIndex === 0) {
      const canFinish = game.activeActorIndex === 0 && allDefended;
      return {
        label: game.tablePairs.length === 0 ? 'Пас' : 'Бито',
        enabled: canFinish,
        variant: 'gold' as const,
        onClick: handlePlayerBito,
      };
    }
    const canTake =
      game.activeActorIndex === 0 && game.defenderIndex === 0 && game.tablePairs.length > 0;
    return {
      label: 'Взять',
      enabled: canTake,
      variant: 'crimson' as const,
      onClick: handlePlayerTake,
    };
  })();

  const trumpRed = isRedSuit(game.trumpSuit);
  const playerHand = game.hands[0] ?? [];
  const playerCount = playerHand.length;
  const showCardsOnTable = tablePhase === 'PLAYING';

  const renderSeatAvatar = (seat: SeatSlot, showCardsFan: boolean) => {
    const isTurnActive =
      tablePhase === 'PLAYING' && game.activeActorIndex === seat.seatIndex;
    const isAttacker = tablePhase === 'PLAYING' && game.attackerIndex === seat.seatIndex;
    const isDefender = tablePhase === 'PLAYING' && game.defenderIndex === seat.seatIndex;

    const showReadyBar =
      tablePhase === 'READY_CHECK' && seat.occupant !== null && !seat.isReady;
    const showTurnBar = showCardsOnTable && isTurnActive && !seat.disconnected && !game.outcome;

    const frameBorderClass = seat.disconnected
      ? 'border-[#C93838]/75 opacity-60'
      : tablePhase === 'READY_CHECK' && seat.isReady
      ? 'border-[#7CD4A0] ring-2 ring-[#7CD4A0]/55'
      : isTurnActive && tablePhase === 'PLAYING'
      ? 'border-[#D6A954] ring-2 ring-[#D6A954]/50'
      : 'border-white/25';

    const exactOppCount = (game.hands[seat.seatIndex] ?? []).length;
    const oppDealOrigin = dealOriginMap[seat.seatIndex] ?? { x: 200, y: 100 };
    const oppEntryOrigin = botTakeAnimRef.current[seat.seatIndex]
      ? measureDelta(tableCenterElRef.current, seatElRefs.current[seat.seatIndex], {
          x: 0,
          y: 150,
        })
      : oppDealOrigin;
    const compactSpread = maxPlayers >= 4;
    const angleStep =
      exactOppCount > 1 ? Math.min(compactSpread ? 6.5 : 8, 56 / (exactOppCount - 1)) : 0;
    const xStep =
      exactOppCount > 1
        ? Math.min(compactSpread ? 7 : 10, (compactSpread ? 56 : 104) / (exactOppCount - 1))
        : 0;

    return (
      <div
        ref={(el) => {
          seatElRefs.current[seat.seatIndex] = el;
        }}
        className="flex flex-col items-center"
      >
        <div className="w-14 sm:w-16 h-1 rounded-full bg-black/45 overflow-hidden mb-1">
          {showReadyBar && (
            <motion.div
              key={`ready-${readyCheckKey}-${seat.seatIndex}`}
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: READY_SECONDS, ease: 'linear' }}
              style={{ transformOrigin: 'left' }}
              className="w-full h-full bg-[#7CD4A0]"
            />
          )}
          {!showReadyBar && showTurnBar && (
            <motion.div
              key={`turn-${dealId}-${game.activeActorIndex}-${game.tablePairs.length}`}
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: TURN_SECONDS, ease: 'linear' }}
              style={{ transformOrigin: 'left' }}
              className="w-full h-full bg-[#D6A954]"
            />
          )}
        </div>

        {seat.occupant ? (
          <div className="relative">
            <div
              className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border-2 transition-all duration-200 ${frameBorderClass}`}
            >
              <img
                src={seat.occupant.avatarUrl}
                alt={seat.occupant.username}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover scale-105"
              />
            </div>
            {seat.disconnected && (
              <div
                className="absolute -bottom-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#151C19] border border-[#C93838] flex items-center justify-center text-[#F28B82]"
                title="Вышел из партии"
              >
                <WifiOff className="w-3 h-3" />
              </div>
            )}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0.6, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-dashed border-white/30 bg-[#0D1A14]/65 flex items-center justify-center text-[#94A099]"
            title="Ожидание игрока"
          >
            <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
          </motion.div>
        )}

        {/* Short nickname only — no numeric card counter ("пусть будет просто как карты") */}
        <span className="text-[11px] sm:text-xs font-medium text-[#F3EFE6] mt-1 text-center leading-tight max-w-[92px] sm:max-w-[160px] truncate">
          {seat.occupant
            ? seat.disconnected
              ? `${seat.occupant.username} (вышел)`
              : seat.occupant.username
            : 'Ожидание'}
        </span>

        {showCardsOnTable && !seat.disconnected && (isAttacker || isDefender) && (
          <span className="text-[10px] text-[#D6A954] font-medium leading-tight">
            {isAttacker ? 'Атакует' : 'Отбивается'}
          </span>
        )}

        {/* Opponent corner-fanned cards (exact count, starts opacity: 0 inside deck/table so zero teleport) */}
        {showCardsFan && showCardsOnTable && !seat.disconnected && (
          <div
            className={`relative h-12 sm:h-16 mt-1.5 flex items-start justify-center origin-top ${
              maxPlayers >= 3
                ? 'w-24 sm:w-52 scale-[0.82] sm:scale-100'
                : 'w-32 sm:w-52'
            }`}
          >
            <AnimatePresence>
              {Array.from({ length: exactOppCount }).map((_, idx) => {
                const mid = (exactOppCount - 1) / 2;
                const offset = idx - mid;
                const angle = offset * angleStep;
                const shiftX = offset * xStep;
                const shiftY = Math.abs(offset) * 1.6;
                return (
                  <motion.div
                    key={`${dealId}-seat-${seat.seatIndex}-${idx}`}
                    initial={{
                      opacity: 0,
                      x: oppEntryOrigin.x,
                      y: oppEntryOrigin.y,
                      scale: 0.45,
                      rotate: 16,
                    }}
                    animate={{
                      opacity: 1,
                      x: shiftX,
                      y: shiftY,
                      scale: 1,
                      rotate: angle,
                    }}
                    exit={{ opacity: 0, y: 35, scale: 0.7 }}
                    transition={{
                      duration: dealCardDuration,
                      ease: [0.22, 1, 0.36, 1],
                      delay: isInitialDealPhase
                        ? (idx * maxPlayers + seat.seatIndex) * (dealStagger * 0.45)
                        : 0,
                    }}
                    className="absolute top-0"
                    style={{
                      transformOrigin: '50% -14px',
                      zIndex: idx + 1,
                    }}
                  >
                    <PlayingCard faceDown size="xs" />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    );
  };

  const opponentSeats = seats.slice(1);
  const playerDealOrigin = dealOriginMap[0] ?? { x: 240, y: -160 };
  const playerOverlapClass =
    playerCount > 9
      ? '-ml-11 sm:-ml-12'
      : playerCount > 6
      ? '-ml-9 sm:-ml-10'
      : '-ml-7 sm:-ml-9';

  return (
    <div
      className="relative min-h-screen w-full overflow-hidden flex flex-col justify-between px-3 py-3 sm:p-6"
      style={{
        backgroundImage: `radial-gradient(circle at 50% 48%, rgba(16, 82, 54, 0.86), rgba(7, 30, 21, 0.96)), url(${TABLE_FELT_IMAGE})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* TOP-LEFT ONLY: "Сдаться" during battle, or "Выйти" when waiting/ready */}
      {tablePhase === 'PLAYING' ? (
        <button
          type="button"
          onClick={() => setShowSurrenderConfirm(true)}
          className="fixed top-3 left-3 sm:top-4 sm:left-4 z-30 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg border border-white/15 bg-[#121D18]/85 backdrop-blur-xs text-xs sm:text-sm font-medium text-[#F3EFE6] hover:border-[#C93838] hover:text-[#F28B82] transition-colors inline-flex items-center gap-1.5 sm:gap-2"
        >
          <Flag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          Сдаться
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onExitToLobby()}
          className="fixed top-3 left-3 sm:top-4 sm:left-4 z-30 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg border border-white/15 bg-[#121D18]/85 backdrop-blur-xs text-xs sm:text-sm font-medium text-[#F3EFE6] hover:border-[#D6A954] transition-colors inline-flex items-center gap-1.5 sm:gap-2"
        >
          <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          Выйти
        </button>
      )}

      {/* LEFT-TOP EDGE: Отбой (no empty placeholder; appears once without re-animating on subsequent Бито) */}
      <div
        ref={discardElRef}
        className="fixed left-1.5 sm:left-5 top-[30%] sm:top-16 z-20 scale-[0.68] sm:scale-95 origin-top-left w-14 h-20 sm:w-16 sm:h-24 pointer-events-none"
      >
        {showCardsOnTable && game.discardCount > 0 && (
          <motion.div
            key="discard-pile-static"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="relative w-14 h-20 sm:w-16 sm:h-24"
          >
            <div className="absolute inset-0 -rotate-12 opacity-75">
              <PlayingCard faceDown size="sm" />
            </div>
            <div className="absolute inset-0 rotate-6">
              <PlayingCard faceDown size="sm" />
            </div>
          </motion.div>
        )}
      </div>

      {/* LEFT SCREEN EDGE: Large Active Action Button */}
      <button
        type="button"
        onClick={actionButton.onClick}
        disabled={!actionButton.enabled}
        className={`fixed left-0 top-1/2 -translate-y-1/2 z-30 pl-3 pr-4 py-3.5 sm:pl-5 sm:pr-7 sm:py-5 rounded-r-xl sm:rounded-r-2xl text-sm sm:text-lg font-bold shadow-[0_12px_32px_rgba(0,0,0,0.55)] border border-l-0 transition-all duration-150 whitespace-nowrap ${
          !actionButton.enabled
            ? 'bg-[#121D18]/75 border-white/10 text-[#6E7A74] cursor-not-allowed'
            : actionButton.variant === 'crimson'
            ? 'bg-[#C93838] border-[#E06666]/50 text-white hover:bg-[#D94848] sm:hover:pl-7'
            : 'bg-[#D6A954] border-[#F0D08B]/60 text-[#111714] hover:bg-[#E1B96B] sm:hover:pl-7'
        }`}
      >
        {actionButton.label}
      </button>

      {/* RIGHT SCREEN EDGE: Draw Deck & Trump Card */}
      {showCardsOnTable && (
        <div
          ref={deckElRef}
          className="fixed right-2 sm:right-6 top-[45%] -translate-y-1/2 z-20 scale-75 sm:scale-100 origin-right"
        >
          {game.deck.length > 1 && (
            <div className="relative w-28 h-24">
              {game.trumpCard && (
                <div className="absolute right-8 top-0 z-0 transform -rotate-90 origin-center">
                  <PlayingCard card={game.trumpCard} size="sm" isTrump />
                </div>
              )}
              <div className="absolute right-0 top-0 z-10">
                <PlayingCard faceDown size="sm" overlayText={game.deck.length} />
              </div>
            </div>
          )}

          {game.deck.length === 1 && game.trumpCard && (
            <div className="relative w-16 h-24">
              <PlayingCard card={game.trumpCard} size="sm" isTrump />
              <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[#151C19] border border-[#D6A954] text-[11px] font-mono font-bold text-[#F3EFE6] flex items-center justify-center tabular-nums">
                1
              </span>
            </div>
          )}

          {game.deck.length === 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-16 h-24 rounded-lg border border-white/15 bg-[#0B1812]/55 flex items-center justify-center"
            >
              <span
                className={`text-4xl leading-none select-none ${
                  trumpRed ? 'text-[#E05252]' : 'text-[#F3EFE6]'
                }`}
              >
                {SUIT_SYMBOLS[game.trumpSuit]}
              </span>
            </motion.div>
          )}
        </div>
      )}

      {/* BOTTOM-RIGHT: Sound Toggle */}
      <button
        type="button"
        onClick={toggleSound}
        aria-label={soundEnabled ? 'Выключить звук' : 'Включить звук'}
        className="fixed bottom-3 right-3 sm:bottom-4 sm:right-4 z-30 p-2 sm:p-2.5 rounded-lg border border-white/15 bg-[#121D18]/85 text-[#D6D0C4] hover:border-[#D6A954] transition-colors"
      >
        {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
      </button>

      {/* TOP ZONE: Opponent Seats — always stays in a single horizontal line */}
      <div
        className={`pt-11 sm:pt-1 px-1 sm:px-24 w-full max-w-4xl mx-auto ${
          opponentSeats.length === 3
            ? 'grid grid-cols-3 items-start justify-items-center gap-1 sm:gap-8'
            : opponentSeats.length === 2
            ? 'grid grid-cols-2 items-start justify-items-center gap-3 sm:flex sm:justify-center sm:gap-16'
            : 'flex items-start justify-center'
        }`}
      >
        {opponentSeats.map((oppSeat) => (
          <div key={oppSeat.seatIndex} className="w-full sm:w-auto flex justify-center">
            {renderSeatAvatar(oppSeat, true)}
          </div>
        ))}
      </div>

      {/* MIDDLE ZONE: Center Battle Arena */}
      <div className="flex-1 my-2 flex items-center justify-center w-full max-w-5xl mx-auto px-16 sm:px-36">
        <div
          ref={tableCenterElRef}
          className={`relative flex items-center justify-center min-h-[150px] sm:min-h-[190px] w-full rounded-2xl transition-all duration-150 ${
            isOverDropZone
              ? 'ring-2 ring-[#D6A954] bg-[#D6A954]/[0.16] shadow-[0_0_28px_rgba(214,169,84,0.22)]'
              : draggingCardId
              ? 'ring-2 ring-dashed ring-[#D6A954]/45 bg-[#D6A954]/[0.05]'
              : ''
          }`}
        >
          {tablePhase === 'PLAYING' && draggingCardId && game.tablePairs.length === 0 && (
            <span className="pointer-events-none text-xs sm:text-sm font-medium text-[#E5C98E]/80 select-none">
              {isOverDropZone ? 'Отпустите, чтобы походить' : 'Перетащите карту сюда'}
            </span>
          )}
          {tablePhase === 'ROUND_END' && roundResultText && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="px-5 py-3 sm:px-7 sm:py-4 rounded-xl bg-[#121D18]/90 border border-[#D6A954]/50 text-lg sm:text-2xl font-display font-semibold text-[#F3EFE6] shadow-2xl text-center"
            >
              {roundResultText}
            </motion.div>
          )}

          {tablePhase === 'PLAYING' && (
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              <AnimatePresence mode="popLayout" custom={clearExitDelta}>
                {game.tablePairs.map((pair) => {
                  const attackOrigin = attackOriginMapRef.current[pair.attack.id] ?? {
                    x: 0,
                    y: 120,
                  };
                  const defenseOrigin = pair.defense
                    ? defenseOriginMapRef.current[pair.defense.id] ?? { x: 0, y: -120 }
                    : { x: 0, y: -120 };

                  const attackDroppedByDrag =
                    lastPlayedViaDragIdRef.current === pair.attack.id;
                  const defenseDroppedByDrag =
                    pair.defense && lastPlayedViaDragIdRef.current === pair.defense.id;

                  return (
                    <motion.div
                      key={`${dealId}-pair-${pair.attack.id}`}
                      layout="position"
                      custom={clearExitDelta}
                      variants={tablePairVariants}
                      initial={
                        attackDroppedByDrag
                          ? {
                              opacity: 1,
                              x: attackOrigin.x,
                              y: attackOrigin.y,
                              scale: 1.06,
                              rotate: 0,
                            }
                          : tablePairVariants.initial(attackOrigin)
                      }
                      animate="animate"
                      exit="exit"
                      transition={{
                        duration: attackDroppedByDrag ? 0.24 : cardMoveDuration,
                        layout: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className="relative w-16 h-24 sm:w-22 sm:h-32 md:w-24 md:h-34"
                    >
                      <PlayingCard
                        card={pair.attack}
                        size="md"
                        isTrump={pair.attack.suit === game.trumpSuit}
                      />

                      {pair.defense && (
                        <motion.div
                          key={`${dealId}-def-${pair.defense.id}`}
                          initial={
                            defenseDroppedByDrag
                              ? {
                                  opacity: 1,
                                  x: defenseOrigin.x,
                                  y: defenseOrigin.y,
                                  scale: 1.06,
                                  rotate: 0,
                                }
                              : {
                                  opacity: 0,
                                  x: defenseOrigin.x,
                                  y: defenseOrigin.y,
                                  scale: 1.18,
                                  rotate: -14,
                                }
                          }
                          animate={{ opacity: 1, x: 0, y: 0, scale: 1, rotate: 4 }}
                          transition={{
                            duration: defenseDroppedByDrag ? 0.28 : cardMoveDuration,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                          className="absolute top-2.5 left-2.5 sm:top-4 sm:left-4 z-10"
                        >
                          <PlayingCard
                            card={pair.defense}
                            size="md"
                            isTrump={pair.defense.suit === game.trumpSuit}
                          />
                          <motion.div
                            initial={{ opacity: 0.85, scale: 0.9 }}
                            animate={{ opacity: 0, scale: 1.18 }}
                            transition={{ duration: isClassic ? 0.65 : 0.3 }}
                            className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-[#D6A954]"
                          />
                        </motion.div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM ZONE: Player Frame + Hand (cards fly directly from Deck with initial opacity 0) */}
      <div className="flex flex-col items-center pb-1 sm:pb-2">
        {renderSeatAvatar(playerSeat, false)}

        <div className="flex items-end justify-center min-h-[120px] sm:min-h-[152px] pt-2 sm:pt-3 pb-1 px-2 sm:px-4 max-w-full">
          {showCardsOnTable && (
            <AnimatePresence mode="popLayout">
              {playerHand.map((card, idx) => {
                const playable = isCardPlayable(card);
                const shouldDim =
                  tablePhase === 'PLAYING' && game.activeActorIndex === 0 && !playable;
                const mid = (playerCount - 1) / 2;
                const offset = idx - mid;
                const angle = offset * (playerCount > 8 ? 2.1 : 3.2);
                const dropY = Math.abs(offset) * 2.4;
                const cardEntryOrigin =
                  handCardOriginMapRef.current[card.id] ?? playerDealOrigin;

                const isDraggingThis = draggingCardId === card.id;
                const wasPlayedByDrag = lastPlayedViaDragIdRef.current === card.id;

                return (
                  <DraggableHandCard
                    key={`${dealId}-hand-${card.id}`}
                    card={card}
                    idx={idx}
                    dealId={dealId}
                    playable={playable}
                    shouldDim={shouldDim}
                    isTrump={card.suit === game.trumpSuit}
                    overlapClass={playerOverlapClass}
                    angle={angle}
                    dropY={dropY}
                    entryOrigin={cardEntryOrigin}
                    isInitialDealPhase={isInitialDealPhase}
                    dealCardDuration={dealCardDuration}
                    dealStagger={dealStagger}
                    isClassic={isClassic}
                    isDraggingThis={isDraggingThis}
                    anyDragging={draggingCardId !== null}
                    wasPlayedByDrag={wasPlayedByDrag}
                    onDragStartCard={(c) => {
                      dragMovedBeyondTapRef.current = false;
                      setDraggingCardId(c.id);
                    }}
                    onDragMoveCard={handlePlayerCardDrag}
                    onDragEndCard={handlePlayerCardDragEnd}
                    onClickCard={handlePlayerCardClick}
                  />
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Confirmation Modal: Surrender ("вы уверены что хотите сдаться?") */}
      <AnimatePresence>
        {showSurrenderConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="surrender-confirm-title"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 10 }}
              className="w-full max-w-sm bg-[#151C19] border border-white/15 rounded-xl p-6 shadow-2xl text-center"
            >
              <h2
                id="surrender-confirm-title"
                className="text-lg font-semibold text-[#F3EFE6]"
              >
                Сдаться?
              </h2>
              <p className="text-sm text-[#94A099] mt-2">
                Вы уверены, что хотите сдаться и завершить текущую партию?
              </p>
              <div className="mt-6 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowSurrenderConfirm(false)}
                  className="flex-1 py-2.5 px-4 rounded-lg border border-white/15 text-sm font-medium text-[#D6D0C4] hover:bg-white/5 transition-colors"
                >
                  Нет
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSurrender}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-[#C93838] text-white font-semibold text-sm hover:bg-[#D94848] transition-colors"
                >
                  Да, сдаться
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

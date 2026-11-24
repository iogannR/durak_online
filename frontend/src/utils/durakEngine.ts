import {
  Card,
  DeckSize,
  MultiDurakGameState,
  Rank,
  Suit,
  TablePair,
} from '../types/durak';

export const SUIT_SYMBOLS: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

export const SUIT_NAMES_RU: Record<Suit, string> = {
  spades: 'Пики',
  hearts: 'Черви',
  diamonds: 'Бубны',
  clubs: 'Трефы',
};

export const RANK_LABELS: Record<Rank, string> = {
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'В',
  12: 'Д',
  13: 'К',
  14: 'Т',
};

export function isRedSuit(suit: Suit): boolean {
  return suit === 'hearts' || suit === 'diamonds';
}

export function createShuffledDeck(deckSize: DeckSize): Card[] {
  const suits: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
  const minRank: Rank = deckSize === 36 ? 6 : 2;
  const ranks: Rank[] = [];
  for (let r = minRank; r <= 14; r++) {
    ranks.push(r as Rank);
  }

  const deck: Card[] = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ id: `${suit}-${rank}`, suit, rank });
    }
  }

  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function sortHand(hand: Card[], trumpSuit: Suit): Card[] {
  return [...hand].sort((a, b) => {
    const aTrump = a.suit === trumpSuit ? 1 : 0;
    const bTrump = b.suit === trumpSuit ? 1 : 0;
    if (aTrump !== bTrump) return aTrump - bTrump;
    if (a.rank !== b.rank) return a.rank - b.rank;
    return a.suit.localeCompare(b.suit);
  });
}

export function canBeat(attackCard: Card, defenseCard: Card, trumpSuit: Suit): boolean {
  if (defenseCard.suit === attackCard.suit) {
    return defenseCard.rank > attackCard.rank;
  }
  if (defenseCard.suit === trumpSuit && attackCard.suit !== trumpSuit) {
    return true;
  }
  return false;
}

export function canAttackWith(
  card: Card,
  tablePairs: TablePair[],
  defenderHandLength: number
): boolean {
  if (tablePairs.length === 0) {
    return defenderHandLength > 0;
  }
  const openAttacks = tablePairs.filter((p) => p.defense === null).length;
  if (openAttacks >= defenderHandLength) {
    return false;
  }
  if (tablePairs.length >= 6) {
    return false;
  }
  const tableRanks = new Set<Rank>();
  for (const pair of tablePairs) {
    tableRanks.add(pair.attack.rank);
    if (pair.defense) tableRanks.add(pair.defense.rank);
  }
  return tableRanks.has(card.rank);
}

export function getNextActivePlayer(
  fromIndex: number,
  hands: Card[][],
  playerCount: number
): number {
  for (let step = 1; step <= playerCount; step++) {
    const idx = (fromIndex + step) % playerCount;
    if (hands[idx].length > 0) return idx;
  }
  return fromIndex;
}

export function createMultiInitialGame(
  roomTitle: string,
  deckSize: DeckSize,
  playerCount: number
): MultiDurakGameState {
  const deck = createShuffledDeck(deckSize);
  const rawHands: Card[][] = [];
  for (let p = 0; p < playerCount; p++) {
    rawHands.push(deck.splice(0, 6));
  }

  const trumpCard = deck[deck.length - 1] ?? null;
  const trumpSuit: Suit = trumpCard ? trumpCard.suit : 'spades';
  const hands = rawHands.map((h) => sortHand(h, trumpSuit));

  // Player with lowest trump goes first
  let firstAttacker = 0;
  let lowestTrumpRank = 99;
  for (let p = 0; p < playerCount; p++) {
    const lowest = hands[p]
      .filter((c) => c.suit === trumpSuit)
      .sort((a, b) => a.rank - b.rank)[0];
    if (lowest && lowest.rank < lowestTrumpRank) {
      lowestTrumpRank = lowest.rank;
      firstAttacker = p;
    }
  }

  const firstDefender = (firstAttacker + 1) % playerCount;

  return {
    roomTitle,
    deckSize,
    playerCount,
    deck,
    trumpCard,
    trumpSuit,
    discardCount: 0,
    hands,
    finishedOrder: [],
    attackerIndex: firstAttacker,
    defenderIndex: firstDefender,
    activeActorIndex: firstAttacker,
    outcome: null,
    tablePairs: [],
  };
}

export function refillMultiHands(
  deck: Card[],
  hands: Card[][],
  attackerIndex: number,
  defenderIndex: number,
  trumpSuit: Suit
): { deck: Card[]; hands: Card[][]; trumpCardLeft: boolean } {
  const nextDeck = [...deck];
  const nextHands = hands.map((h) => [...h]);
  const n = nextHands.length;

  // Attacker draws first, then other players clockwise, defender draws last
  const drawOrder: number[] = [];
  drawOrder.push(attackerIndex);
  for (let step = 1; step < n; step++) {
    const idx = (attackerIndex + step) % n;
    if (idx !== defenderIndex) drawOrder.push(idx);
  }
  if (defenderIndex !== attackerIndex) {
    drawOrder.push(defenderIndex);
  }

  for (const idx of drawOrder) {
    while (nextHands[idx].length < 6 && nextDeck.length > 0) {
      const card = nextDeck.shift();
      if (card) nextHands[idx].push(card);
    }
    nextHands[idx] = sortHand(nextHands[idx], trumpSuit);
  }

  return {
    deck: nextDeck,
    hands: nextHands,
    trumpCardLeft: nextDeck.length > 0,
  };
}

export function updateFinishedAndOutcome(
  state: MultiDurakGameState
): MultiDurakGameState {
  const nextFinished = [...state.finishedOrder];
  if (state.deck.length === 0) {
    for (let i = 0; i < state.playerCount; i++) {
      if (state.hands[i].length === 0 && !nextFinished.includes(i)) {
        nextFinished.push(i);
      }
    }
  }

  const playersWithCards = state.hands
    .map((h, i) => ({ i, len: h.length }))
    .filter((x) => x.len > 0);

  let outcome = state.outcome;
  if (state.deck.length === 0 && state.tablePairs.length === 0) {
    if (playersWithCards.length === 0) {
      outcome = 'draw';
    } else if (playersWithCards.length === 1) {
      outcome = playersWithCards[0].i === 0 ? 'bot_win' : 'player_win';
    } else if (state.hands[0].length === 0) {
      // Human player already emptied their hand and won!
      outcome = 'player_win';
    }
  }

  return {
    ...state,
    finishedOrder: nextFinished,
    outcome,
  };
}

export function chooseBotAttackCard(
  botHand: Card[],
  tablePairs: TablePair[],
  defenderHandLength: number,
  trumpSuit: Suit
): Card | null {
  const candidates = botHand.filter((c) => canAttackWith(c, tablePairs, defenderHandLength));
  if (candidates.length === 0) return null;

  const sorted = [...candidates].sort((a, b) => {
    const aTrump = a.suit === trumpSuit ? 1 : 0;
    const bTrump = b.suit === trumpSuit ? 1 : 0;
    if (aTrump !== bTrump) return aTrump - bTrump;
    return a.rank - b.rank;
  });

  if (tablePairs.length > 0 && sorted[0].suit === trumpSuit && sorted[0].rank >= 11) {
    return null;
  }
  return sorted[0];
}

export function chooseBotDefenseCard(
  botHand: Card[],
  attackCard: Card,
  trumpSuit: Suit
): Card | null {
  const candidates = botHand.filter((c) => canBeat(attackCard, c, trumpSuit));
  if (candidates.length === 0) return null;

  return [...candidates].sort((a, b) => {
    const aTrump = a.suit === trumpSuit ? 1 : 0;
    const bTrump = b.suit === trumpSuit ? 1 : 0;
    if (aTrump !== bTrump) return aTrump - bTrump;
    return a.rank - b.rank;
  })[0];
}

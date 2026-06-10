/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Card, Suit, Rank, HandEvaluation } from './types';

export const RANK_VALUES: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

export const RANK_NAMES: Record<Rank, string> = {
  '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
  'T': '10', 'J': 'แจ็ค', 'Q': 'แหม่ม', 'K': 'คิง', 'A': 'เอซ'
};

export const RANK_PLURALS: Record<Rank, string> = {
  '2': 'เลข 2', '3': 'เลข 3', '4': 'เลข 4', '5': 'เลข 5', '6': 'เลข 6', '7': 'เลข 7', '8': 'เลข 8', '9': 'เลข 9',
  'T': 'เลข 10', 'J': 'แจ็ค', 'Q': 'แหม่ม', 'K': 'คิง', 'A': 'เอซ'
};

export const SUIT_SYMBOLS: Record<Suit, { symbol: string; label: string; color: string; bg: string }> = {
  'S': { symbol: '♠', label: 'Spades', color: 'text-slate-900 dark:text-slate-100', bg: 'bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-800' },
  'H': { symbol: '♥', label: 'Hearts', color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900' },
  'D': { symbol: '♦', label: 'Diamonds', color: 'text-sky-600', bg: 'bg-sky-50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-900' },
  'C': { symbol: '♣', label: 'Clubs', color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900' }
};

/**
 * Generate a standard 52-card deck
 */
export function createDeck(): Card[] {
  const suits: Suit[] = ['S', 'H', 'D', 'C'];
  const ranks: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
  const deck: Card[] = [];

  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

/**
 * Shuffles a deck of cards securely using cryptographic pseudo-randomness
 * Works portably across both Node JS (v15+) and standard browsers using the Web Crypto API
 */
export function secureShuffle(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    let j: number;
    // Access global Web Crypto safely
    const cryptoObj = typeof globalThis !== 'undefined' ? globalThis.crypto : (typeof window !== 'undefined' ? window.crypto : null);
    
    if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
      const array = new Uint32Array(1);
      cryptoObj.getRandomValues(array);
      j = array[0] % (i + 1);
    } else {
      // Insecure fallback (development / pure isolation only)
      j = Math.floor(Math.random() * (i + 1));
    }
    // Swap elements i and j
    const temp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = temp;
  }
  return shuffled;
}

/**
 * Evaluates the absolute strength of a 5-card hand
 */
export function evaluate5CardHand(cards: Card[]): HandEvaluation {
  if (cards.length !== 5) {
    throw new Error('Must hold exactly 5 cards to evaluate hand strength');
  }

  // Sort cards in descending order of value
  const sorted = [...cards].sort((a, b) => RANK_VALUES[b.rank] - RANK_VALUES[a.rank]);
  const ranks = sorted.map(c => c.rank);
  const values = sorted.map(c => RANK_VALUES[c.rank]);
  const suits = sorted.map(c => c.suit);

  // Group by ranks
  const counts: Record<string, number> = {};
  for (const r of ranks) {
    counts[r] = (counts[r] || 0) + 1;
  }

  const grouped = Object.entries(counts)
    .map(([rank, count]) => ({ rank: rank as Rank, count, value: RANK_VALUES[rank as Rank] }))
    .sort((a, b) => b.count - a.count || b.value - a.value);

  const isFlush = suits.every(s => s === suits[0]);

  // Check for Straight
  let isStraight = false;
  let straightHighValue = 0;

  // Check normal straights (e.g., T-J-Q-K-A or 5-6-7-8-9) or Wheel (A-2-3-4-5)
  // Let's filter unique values in descending order
  const uniqueValues = Array.from(new Set(values));
  if (uniqueValues.length === 5) {
    if (uniqueValues[0] - uniqueValues[4] === 4) {
      isStraight = true;
      straightHighValue = uniqueValues[0];
    } else if (
      uniqueValues[0] === 14 && // Ace
      uniqueValues[1] === 5 &&
      uniqueValues[2] === 4 &&
      uniqueValues[3] === 3 &&
      uniqueValues[4] === 2
    ) {
      isStraight = true;
      straightHighValue = 5; // 5 is high in A-2-3-4-5 straight
    }
  }

  // Identify Poker categories (Royal Flush = 9 down to High Card = 0)
  
  // Royal Flush & Straight Flush
  if (isStraight && isFlush) {
    if (straightHighValue === 14) {
      return {
        rankValue: 9,
        handName: 'รอยัล ฟลัช (Royal Flush)',
        sortCombination: [9, 14],
        cardsUsed: sorted
      };
    }
    return {
      rankValue: 8,
      handName: 'สเตรท ฟลัช (Straight Flush)',
      sortCombination: [8, straightHighValue],
      cardsUsed: sorted
    };
  }

  // Four of a Kind
  if (grouped[0].count === 4) {
    return {
      rankValue: 7,
      handName: `โฟร์การ์ด (Four of a Kind)`,
      sortCombination: [7, grouped[0].value, grouped[1].value],
      // Re-order cards used (4 of a kind cards first, then kicker)
      cardsUsed: [
        ...sorted.filter(c => c.rank === grouped[0].rank),
        ...sorted.filter(c => c.rank === grouped[1].rank)
      ]
    };
  }

  // Full House
  if (grouped[0].count === 3 && grouped[1].count >= 2) {
    return {
      rankValue: 6,
      handName: 'ฟูลเฮาส์ (Full House)',
      sortCombination: [6, grouped[0].value, grouped[1].value],
      cardsUsed: [
        ...sorted.filter(c => c.rank === grouped[0].rank),
        ...sorted.filter(c => c.rank === grouped[1].rank).slice(0, 2)
      ]
    };
  }

  // Flush
  if (isFlush) {
    return {
      rankValue: 5,
      handName: 'ฟลัช หรือ สี (Flush)',
      sortCombination: [5, ...values],
      cardsUsed: sorted
    };
  }

  // Straight
  if (isStraight) {
    // If straight is a wheel, reorder cards so Ace is at the end
    const orderedCards = [...sorted];
    if (straightHighValue === 5) {
      const aceIndex = orderedCards.findIndex(c => c.rank === 'A');
      if (aceIndex > -1) {
        const ace = orderedCards.splice(aceIndex, 1)[0];
        orderedCards.push(ace);
      }
    }
    return {
      rankValue: 4,
      handName: 'สเตรท หรือ เรียง (Straight)',
      sortCombination: [4, straightHighValue],
      cardsUsed: orderedCards
    };
  }

  // Three of a Kind
  if (grouped[0].count === 3) {
    return {
      rankValue: 3,
      handName: 'ตอง (Three of a Kind)',
      sortCombination: [3, grouped[0].value, grouped[1].value, grouped[2].value],
      cardsUsed: [
        ...sorted.filter(c => c.rank === grouped[0].rank),
        ...sorted.filter(c => c.rank !== grouped[0].rank)
      ]
    };
  }

  // Two Pair
  if (grouped[0].count === 2 && grouped[1].count === 2) {
    return {
      rankValue: 2,
      handName: '2 คู่ (Two Pair)',
      sortCombination: [2, grouped[0].value, grouped[1].value, grouped[2].value],
      cardsUsed: [
        ...sorted.filter(c => c.rank === grouped[0].rank),
        ...sorted.filter(c => c.rank === grouped[1].rank),
        ...sorted.filter(c => c.rank !== grouped[0].rank && c.rank !== grouped[1].rank)
      ]
    };
  }

  // One Pair
  if (grouped[0].count === 2) {
    return {
      rankValue: 1,
      handName: '1 คู่ (One Pair)',
      sortCombination: [1, grouped[0].value, grouped[1].value, grouped[2].value, grouped[3].value],
      cardsUsed: [
        ...sorted.filter(c => c.rank === grouped[0].rank),
        ...sorted.filter(c => c.rank !== grouped[0].rank)
      ]
    };
  }

  // High Card
  return {
    rankValue: 0,
    handName: 'ไพ่สูง (High Card)',
    sortCombination: [0, ...values],
    cardsUsed: sorted
  };
}

/**
 * Core Texas Hold'em evaluator: chooses the best 5-card combination out of a set of cards (typically 7: 2 hole + 5 community)
 */
export function evaluate7CardHand(holeCards: Card[], communityCards: Card[]): HandEvaluation {
  const allCards = [...holeCards, ...communityCards];
  if (allCards.length < 5) {
    // If not enough cards, just evaluate whatever is available
    if (allCards.length === 0) {
      return { rankValue: 0, handName: 'No Cards', sortCombination: [0], cardsUsed: [] };
    }
    // Pad or evaluate mock 5-card combination
    const padded = [...allCards];
    while (padded.length < 5) {
      padded.push({ rank: '2', suit: 'S' });
    }
    return evaluate5CardHand(padded);
  }

  // Helper to get combinations
  const combos: Card[][] = [];
  const getCombosHelper = (active: Card[], rest: Card[]) => {
    if (active.length === 5) {
      combos.push(active);
      return;
    }
    for (let i = 0; i < rest.length; i++) {
      getCombosHelper([...active, rest[i]], rest.slice(i + 1));
    }
  };
  getCombosHelper([], allCards);

  // Evaluate each 5-card combination and choose the one with the strongest score
  let bestEval = evaluate5CardHand(combos[0]);

  for (let i = 1; i < combos.length; i++) {
    const currentEval = evaluate5CardHand(combos[i]);
    if (compareHandEvaluations(currentEval, bestEval) > 0) {
      bestEval = currentEval;
    }
  }

  // Enhance hand name with readable specifics
  if (bestEval.rankValue === 1) {
    const pRank = bestEval.cardsUsed[0].rank;
    bestEval.handName = `Pair of ${RANK_PLURALS[pRank]}`;
  } else if (bestEval.rankValue === 2) {
    const p1 = bestEval.cardsUsed[0].rank;
    const p2 = bestEval.cardsUsed[2].rank;
    bestEval.handName = `Two Pair, ${RANK_PLURALS[p1]} and ${RANK_PLURALS[p2]}`;
  } else if (bestEval.rankValue === 3) {
    const r = bestEval.cardsUsed[0].rank;
    bestEval.handName = `Three of a Kind, ${RANK_PLURALS[r]}`;
  } else if (bestEval.rankValue === 4) {
    const r = bestEval.cardsUsed[0].rank;
    bestEval.handName = `Straight, ${RANK_NAMES[r]} High`;
  } else if (bestEval.rankValue === 5) {
    const r = bestEval.cardsUsed[0].rank;
    bestEval.handName = `Flush, ${RANK_NAMES[r]} High`;
  } else if (bestEval.rankValue === 6) {
    const r3 = bestEval.cardsUsed[0].rank;
    const r2 = bestEval.cardsUsed[3].rank;
    bestEval.handName = `Full House, ${RANK_PLURALS[r3]} over ${RANK_PLURALS[r2]}`;
  } else if (bestEval.rankValue === 7) {
    const r = bestEval.cardsUsed[0].rank;
    bestEval.handName = `Four of a Kind, ${RANK_PLURALS[r]}`;
  } else if (bestEval.rankValue === 8) {
    const r = bestEval.cardsUsed[0].rank;
    bestEval.handName = `Straight Flush, ${RANK_NAMES[r]} High`;
  } else if (bestEval.rankValue === 0 && bestEval.cardsUsed.length > 0) {
    const r = bestEval.cardsUsed[0].rank;
    bestEval.handName = `High Card, ${RANK_NAMES[r]}`;
  }

  return bestEval;
}

/**
 * Compares two hand evaluations. Returns positive if a is better, negative if b is better, 0 if perfect tie.
 */
export function compareHandEvaluations(a: HandEvaluation, b: HandEvaluation): number {
  const len = Math.max(a.sortCombination.length, b.sortCombination.length);
  for (let i = 0; i < len; i++) {
    const valA = a.sortCombination[i] || 0;
    const valB = b.sortCombination[i] || 0;
    if (valA !== valB) {
      return valA - valB;
    }
  }
  return 0;
}

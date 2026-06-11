/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Suit = 'S' | 'H' | 'D' | 'C'; // Spades, Hearts, Diamonds, Clubs
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  suit: Suit;
  rank: Rank;
}

export type RoomStatus = 'LOBBY' | 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN';

export type PlayerActionType = 'CHECK' | 'CALL' | 'BET' | 'RAISE' | 'FOLD' | 'SMALL_BLIND' | 'BIG_BLIND' | 'WAITING' | '';

export interface Player {
  id: string;
  name: string;
  chips: number;
  currentBet: number; // how much they have bet in the current betting round
  isFolded: boolean;
  isAllIn: boolean;
  isActive: boolean; // turn indicator
  isBot: boolean;
  seatIndex: number;
  lastAction: PlayerActionType;
  lastActionAmount?: number;
}

export interface RoomPublicState {
  roomId: string;
  roomName?: string;
  hasPassword?: boolean;
  status: RoomStatus;
  pot: number;
  currentBet: number; // current required bet to stay in (e.g. BB size or highest raise)
  minRaise: number;
  activePlayerId: string | null;
  dealerIndex: number;
  communityCards: Card[];
  updatedAt: number;
  smallBlind: number;
  bigBlind: number;
  winnerIds?: string[] | null;
  winDesc?: string | null;
  inviteCode?: string;
  handHistory?: any[];
}

export interface RoomPrivateState {
  holeCards: Card[];
}

export interface HandEvaluation {
  rankValue: number;       // 0-9 matching hand types
  handName: string;        // 'Full House', 'Flush', etc.
  sortCombination: number[]; // Ranks for tie-breaking: [comb_rank, secondary, kicker1, kicker2...]
  cardsUsed: Card[];       // The exact 5 cards used for the combination
}

// ----------------- Auth Types -----------------
export type UserRole = 'admin' | 'player';

export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
  displayName: string;
  token?: string;
  chips?: number;
}

// Complete layout reflecting the Firebase Realtime DB schema representation
export interface FirebaseRealtimeDBSchema {
  rooms: {
    [roomId: string]: {
      public: RoomPublicState;
      players: {
        [playerId: string]: Player;
      };
      // Private folder readable ONLY by authenticated owners: auth.uid === playerId
      private: {
        [playerId: string]: RoomPrivateState;
      };
      // Server-only data (hidden from ALL client SDK reads via ".read": "false")
      serverOnly?: {
        deck: Card[];
        allHoleCards: {
          [playerId: string]: Card[];
        };
      };
    };
  };
}

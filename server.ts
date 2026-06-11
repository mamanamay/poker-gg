/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { Card, Player, RoomPublicState, RoomStatus, PlayerActionType, AuthUser, UserRole } from './src/types';
import { createDeck, secureShuffle, evaluate7CardHand, compareHandEvaluations } from './src/poker';
import crypto from 'crypto';
import admin from 'firebase-admin';
import fs from 'fs';

// --- FIREBASE INITIALIZATION ---
let db: admin.firestore.Firestore | null = null;
try {
  let serviceAccount;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else if (fs.existsSync('./firebase-service-account.json')) {
    serviceAccount = JSON.parse(fs.readFileSync('./firebase-service-account.json', 'utf8'));
  }

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    db = admin.firestore();
    console.log('[Poker Server] Firebase Firestore initialized successfully.');
  } else {
    console.warn('[Poker Server] No Firebase credentials found. Running in ephemeral memory mode.');
  }
} catch (e) {
  console.error('[Poker Server] Failed to initialize Firebase:', e);
}
const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

interface RoomInternal {
  roomId: string;
  status: RoomStatus;
  pot: number;
  currentBet: number;
  minRaise: number;
  activePlayerId: string | null;
  dealerIndex: number;
  communityCards: Card[];
  smallBlind: number;
  bigBlind: number;
  winnerIds: string[] | null;
  winDesc: string | null;
  inviteCode?: string; // Phase 2 Invite Code
  
  players: Record<string, Player>;
  deck: Card[];
  allHoleCards: Record<string, Card[]>;
}

// In-memory Database of Active Rooms
const rooms: Record<string, RoomInternal> = {};

// In-memory Database of Users (For simplicity, not using real DB in this version)
const users: Record<string, AuthUser & { passwordHash: string }> = {
  admin: {
    id: 'admin',
    username: 'admin',
    role: 'admin',
    displayName: 'System Admin',
    passwordHash: 'admin' // In real app, this MUST be hashed!
  }
};

const activeTokens: Record<string, string> = {}; // token -> userId

// Helper to seed standard rooms for gameplay of bots and players
function seedRooms() {
  const seedRoom = (id: string, name: string) => {
    rooms[id] = {
      roomId: id,
      status: 'LOBBY',
      pot: 0,
      currentBet: 0,
      minRaise: 20,
      activePlayerId: null,
      dealerIndex: 0,
      communityCards: [],
      smallBlind: 10,
      bigBlind: 20,
      winnerIds: null,
      winDesc: null,
      inviteCode: id === 'poker-lounge-1' ? 'FELT01' : 'DOJO99',
      players: {
        'player-1': {
          id: 'player-1',
          name: 'Hero (You)',
          chips: 1000,
          currentBet: 0,
          isFolded: false,
          isAllIn: false,
          isActive: false,
          isBot: false,
          seatIndex: 0,
          lastAction: '',
        },
        'bot-alpha': {
          id: 'bot-alpha',
          name: 'Bot Alpha (Conservative)',
          chips: 1000,
          currentBet: 0,
          isFolded: false,
          isAllIn: false,
          isActive: false,
          isBot: true,
          seatIndex: 1,
          lastAction: '',
        },
        'bot-omega': {
          id: 'bot-omega',
          name: 'Bot Omega (Aggressive)',
          chips: 1000,
          currentBet: 0,
          isFolded: false,
          isAllIn: false,
          isActive: false,
          isBot: true,
          seatIndex: 2,
          lastAction: '',
        }
      },
      deck: [],
      allHoleCards: {}
    };
    (rooms[id] as any).roomName = name;
    (rooms[id] as any).handHistory = [];
  };

  seedRoom('poker-lounge-1', "The Royal Felt Lounge");
  seedRoom('bot-training', "High Stakes Bot Dojo");
}

seedRooms();

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'ระบุชื่อผู้ใช้และรหัสผ่าน' });
  }

  let user = Object.values(users).find(u => u.username === username);

  if (db) {
    try {
      const snap = await db.collection('users').where('username', '==', username).limit(1).get();
      if (!snap.empty) {
        const doc = snap.docs[0];
        const data = doc.data();
        user = { id: doc.id, ...data } as any;
        users[user!.id] = user as any; // update cache
      }
    } catch (e) {
      console.error('[Poker Server] Firestore error during login', e);
    }
  }

  if (!user || user.passwordHash !== password) {
    return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
  }

  const token = crypto.randomBytes(16).toString('hex');
  activeTokens[token] = user.id;

  res.json({
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      displayName: user.displayName,
      token,
      chips: user.chips || 10000
    }
  });
});

app.post('/api/register', async (req, res) => {
  const { username, password, displayName } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'ระบุชื่อผู้ใช้และรหัสผ่าน' });
  }

  let exists = Object.values(users).some(u => u.username === username);
  if (db && !exists) {
    try {
      const snap = await db.collection('users').where('username', '==', username).limit(1).get();
      if (!snap.empty) exists = true;
    } catch (e) {
      console.error('[Poker Server] Firestore error checking user exists', e);
    }
  }

  if (exists) {
    return res.status(400).json({ error: 'ชื่อผู้ใช้นี้มีผู้ใช้งานแล้ว' });
  }

  const id = `user-${crypto.randomUUID()}`;
  const newUser = {
    id,
    username,
    role: 'player' as UserRole,
    displayName: displayName || username,
    passwordHash: password,
    chips: 10000
  };
  users[id] = newUser;

  if (db) {
    try {
      await db.collection('users').doc(id).set(newUser);
    } catch (e) {
      console.error('[Poker Server] Firestore error during register', e);
    }
  }

  const token = crypto.randomBytes(16).toString('hex');
  activeTokens[token] = id;

  res.json({
    user: {
      id,
      username: newUser.username,
      role: 'player',
      displayName: newUser.displayName,
      token,
      chips: 10000
    }
  });
});

// Middleware to authenticate
const authenticate = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const userId = activeTokens[token];
    if (userId && users[userId]) {
      (req as any).user = users[userId];
    }
  }
  next();
};

app.get('/api/me', async (req, res) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  // Sync with Firestore if available to get fresh chips
  if (db && !user.id.startsWith('bot-')) {
    try {
      const snap = await db.collection('users').doc(user.id).get();
      if (snap.exists) {
        const data = snap.data();
        users[user.id].chips = data?.chips || users[user.id].chips;
      }
    } catch(e) {}
  }

  res.json({ user: users[user.id] });
});

app.use(authenticate);

// Helper to sync chips to Firebase
async function syncRoomChips(room: RoomInternal) {
  if (!db) return;
  for (const p of Object.values(room.players)) {
    if (!p.isBot && users[p.id]) {
      users[p.id].chips = p.chips;
      try {
        await db.collection('users').doc(p.id).update({ chips: p.chips });
      } catch (e) {
        console.error(`[Poker Server] Failed to sync chips for ${p.id}`, e);
      }
    }
  }

  // Save Hand History
  try {
    if (room.winDesc) {
      const historyDoc = {
        roomId: room.roomId,
        roomName: (room as any).roomName || room.roomId,
        pot: room.pot,
        winDesc: room.winDesc,
        winners: room.winnerIds || [],
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      };
      await db.collection('history').add(historyDoc);
      
      // Also push to transient room history for UI
      if (!(room as any).handHistory) (room as any).handHistory = [];
      (room as any).handHistory.unshift({
        winDesc: room.winDesc,
        pot: room.pot,
        time: Date.now()
      });
      // Keep only last 10 logs
      if ((room as any).handHistory.length > 10) (room as any).handHistory.pop();
    }
  } catch (e) {
    console.error(`[Poker Server] Failed to save hand history`, e);
  }
}

// --- POKER ROOM API ---

// Get list of secure rooms
app.get('/api/rooms', (req, res) => {
  const roomList = Object.values(rooms).map(room => ({
    roomId: room.roomId,
    roomName: (room as any).roomName || room.roomId,
    hasPassword: !!(room as any).password,
    status: room.status,
    pot: room.pot,
    playerCount: Object.keys(room.players).length,
    activePlayerId: room.activePlayerId,
    communityCardCount: room.communityCards.length,
    inviteCode: room.inviteCode,
    players: Object.values(room.players).map(p => ({
      id: p.id,
      name: p.name,
      chips: p.chips,
      isBot: p.isBot
    }))
  }));
  res.json(roomList);
});

// Admin ONLY: delete a room
app.delete('/api/rooms/:roomId', (req, res) => {
  const user = (req as any).user as AuthUser;
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { roomId } = req.params;
  if (rooms[roomId]) {
    delete rooms[roomId];
    res.json({ success: true, message: `Room ${roomId} deleted.` });
  } else {
    res.status(404).json({ error: 'Room not found.' });
  }
});

// Create a new room with a cryptographically clean, 6-character short invite code
app.post('/api/rooms', (req, res) => {
  const user = (req as any).user as AuthUser;
  if (!user) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อนสร้างห้อง' });

  const { roomName, mode, password } = req.body;
  
  // Find next available room name (room1, room2) if roomName is empty
  let newRoomId = '';
  let i = 1;
  while(true) {
    if (!rooms[`room${i}`]) {
      newRoomId = `room${i}`;
      break;
    }
    i++;
  }

  // Generate high-entropy short 6-character uppercase join code
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Omitted confusing O, I, 0, 1 characters
  let inviteCode = '';
  for (let i = 0; i < 6; i++) {
    inviteCode += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  const newRoom: RoomInternal = {
    roomId: newRoomId,
    status: 'LOBBY',
    pot: 0,
    currentBet: 0,
    minRaise: 20,
    activePlayerId: null,
    dealerIndex: 0,
    communityCards: [],
    smallBlind: 10,
    bigBlind: 20,
    winnerIds: null,
    winDesc: null,
    inviteCode,
    players: {
      [user.id]: {
        id: user.id,
        name: user.displayName,
        chips: 1000,
        currentBet: 0,
        isFolded: false,
        isAllIn: false,
        isActive: false,
        isBot: false,
        seatIndex: 0,
        lastAction: '',
      }
    },
    deck: [],
    allHoleCards: {}
  };

  (newRoom as any).roomName = roomName || newRoomId;
  if (password) {
    (newRoom as any).password = password;
  }
  (newRoom as any).handHistory = [];

  rooms[newRoomId] = newRoom;

  if (mode === 'bots') {
    const botNames = ['Bot Alpha', 'Bot Omega', 'Bot Gamma', 'Bot Delta'];
    for (let i = 1; i <= 4; i++) {
      const botId = `bot-${i}`;
      rooms[newRoomId].players[botId] = {
        id: botId,
        name: botNames[i-1],
        chips: 1000,
        currentBet: 0,
        isFolded: false,
        isAllIn: false,
        isActive: false,
        isBot: true,
        seatIndex: i,
        lastAction: ''
      };
    }
  }

  res.status(201).json({ success: true, roomId: newRoomId, inviteCode, message: `Room ${roomName || inviteCode} created successfully.` });
});

// Join an existing room via invite code or room ID
app.post('/api/rooms/join', (req, res) => {
  const user = (req as any).user as AuthUser;
  if (!user) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อนเข้าร่วมห้อง' });

  const { inviteCode, roomId, password } = req.body;
  if (!inviteCode && !roomId) {
    return res.status(400).json({ error: 'ระบุรหัสห้อง' });
  }

  let room;
  if (inviteCode) {
    const codeUpper = inviteCode.trim().toUpperCase();
    room = Object.values(rooms).find(r => r.inviteCode === codeUpper);
  } else if (roomId) {
    room = rooms[roomId];
  }
  
  if (!room) {
    return res.status(404).json({ error: `ไม่พบห้องที่ระบุ กรุณาตรวจสอบให้ถูกต้อง` });
  }

  // Check password
  if ((room as any).password && (room as any).password !== password) {
    return res.status(401).json({ error: 'รหัสผ่านห้องไม่ถูกต้อง' });
  }

  const id = user.id;
  
  if (room.players[id]) {
    return res.json({ success: true, roomId: room.roomId }); // Already in room
  }

  // Find standard seat placement
  const seatIndexes = (Object.values(room.players) as Player[]).map(p => p.seatIndex);
  let seat = 0;
  while (seatIndexes.includes(seat)) {
    seat++;
  }

  if (seat >= 5) {
    return res.status(400).json({ error: 'This room is at full capacity (5 players maximum).' });
  }

  room.players[id] = {
    id,
    name: user.displayName,
    chips: users[id]?.chips || 10000,
    currentBet: 0,
    isFolded: false,
    isAllIn: false,
    isActive: false,
    isBot: false,
    seatIndex: seat,
    lastAction: 'WAITING',
  };

  res.json({ success: true, roomId: room.roomId, message: `Joined ${room.roomId}` });
});

// Helper to add bot
app.post('/api/rooms/:roomId/add-bot', (req, res) => {
  const user = (req as any).user as AuthUser;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const { roomId } = req.params;
  const room = rooms[roomId];
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (room.status !== 'LOBBY') return res.status(400).json({ error: 'Game already started' });

  const playerCount = Object.keys(room.players).length;
  if (playerCount >= 5) return res.status(400).json({ error: 'Room is full' });

  const seatIndexes = Object.values(room.players).map(p => p.seatIndex);
  let seat = 0;
  while (seatIndexes.includes(seat)) seat++;

  const botNames = ['Alpha', 'Omega', 'Gamma', 'Delta', 'Sigma'];
  const botId = `bot-${crypto.randomBytes(4).toString('hex')}`;
  
  room.players[botId] = {
    id: botId,
    name: `Bot ${botNames[playerCount % botNames.length]}`,
    chips: 10000,
    currentBet: 0,
    isFolded: false,
    isAllIn: false,
    isActive: false,
    isBot: true,
    seatIndex: seat,
    lastAction: 'WAITING',
  };

  res.json({ success: true, message: 'Bot added' });
});

// Helper to remove bot
app.post('/api/rooms/:roomId/remove-bot', (req, res) => {
  const user = (req as any).user as AuthUser;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const { roomId } = req.params;
  const room = rooms[roomId];
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (room.status !== 'LOBBY') return res.status(400).json({ error: 'Game already started' });

  // Find a bot to remove
  const botIds = Object.keys(room.players).filter(id => room.players[id].isBot);
  if (botIds.length === 0) return res.status(400).json({ error: 'No bots to remove' });
  
  delete room.players[botIds[0]];
  res.json({ success: true, message: 'Bot removed' });
});

// Handle player leaves/disconnects gracefully during hands and lobbies
app.post('/api/rooms/:roomId/leave', (req, res) => {
  const { roomId } = req.params;
  const user = (req as any).user;
  const room = rooms[roomId];

  if (room && room.players[user.id]) {
    removePlayerFromRoom(room, user.id);
  }

  res.json({ success: true });
});

// Admin API: Kick player
app.delete('/api/rooms/:roomId/admin/kick/:playerId', (req, res) => {
  const user = (req as any).user as AuthUser;
  if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { roomId, playerId } = req.params;
  const room = rooms[roomId];
  if (!room) return res.status(404).json({ error: 'Room not found' });

  if (room.players[playerId]) {
    removePlayerFromRoom(room, playerId);
  }
  res.json({ success: true });
});

app.post('/api/logout', (req, res) => {
  res.json({ success: true });
});

app.get('/api/user/me', authenticate, async (req: express.Request, res: express.Response) => {
  const reqUser = (req as any).user;
  let userObj = users[reqUser.id];
  if (db) {
    const doc = await db.collection('users').doc(reqUser.id).get();
    if (doc.exists) {
      userObj = { id: doc.id, ...doc.data() } as any;
      users[reqUser.id] = userObj; // keep memory in sync
    }
  }
  if (!userObj) return res.status(404).json({ error: 'User not found' });
  res.json({ 
    id: userObj.id, 
    username: userObj.username, 
    displayName: userObj.displayName, 
    chips: userObj.chips, 
    role: userObj.role,
    rejectedChipRequest: userObj.rejectedChipRequest
  });
});

app.post('/api/user/clear-notification', authenticate, async (req: express.Request, res: express.Response) => {
  const reqUser = (req as any).user;
  if (users[reqUser.id]) {
    users[reqUser.id].rejectedChipRequest = false;
  }
  if (db) {
    try {
      await db.collection('users').doc(reqUser.id).update({ rejectedChipRequest: false });
    } catch(err) {}
  }
  res.json({ success: true });
});

// Admin API: Rig deck (Force Winner)
app.post('/api/rooms/:roomId/admin/rig', (req, res) => {
  const user = (req as any).user as AuthUser;
  if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { roomId } = req.params;
  const { winnerId } = req.body;
  const room = rooms[roomId];
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (!room.players[winnerId]) return res.status(400).json({ error: 'Player not in room' });

  (room as any).riggedWinnerId = winnerId;
  res.json({ success: true, message: `Next hand rigged for ${room.players[winnerId].name}` });
});

function removePlayerFromRoom(room: RoomInternal, playerId: string) {
  const player = room.players[playerId];
  if (!player) {
    return;
  }

  const wasActiveTurn = room.activePlayerId === playerId;
  
  // Fold player securely inside in-progress sessions before deletion to prevent frozen loops
  if (room.status !== 'LOBBY' && room.status !== 'SHOWDOWN') {
    player.isFolded = true;
    player.lastAction = 'FOLD';

    if (wasActiveTurn) {
      // Pass turn forward to next active player
      const sortedPlayers = Object.values(room.players).sort((a, b) => a.seatIndex - b.seatIndex);
      let nextIndex = (sortedPlayers.findIndex(p => p.id === playerId) + 1) % sortedPlayers.length;
      
      while (sortedPlayers[nextIndex].isFolded || sortedPlayers[nextIndex].isAllIn) {
        nextIndex = (nextIndex + 1) % sortedPlayers.length;
        if (sortedPlayers[nextIndex].id === playerId) break;
      }
      
      room.activePlayerId = sortedPlayers[nextIndex].id;
      sortedPlayers[nextIndex].isActive = true;
    }
  }

  // Delete from current player map
  delete room.players[playerId];

  // Auto clean empty customized rooms to prevent server memory bloat
  if (Object.keys(room.players).length === 0 && !['poker-lounge-1', 'bot-training'].includes(room.roomId)) {
    delete rooms[room.roomId];
  }
}

// Guess the Card Color (Red/Black) mini-game to win 500 chips back when busted!
app.post('/api/mini-game/guess', (req, res) => {
  const { playerId, roomId, guess } = req.body; // 'RED' or 'BLACK'
  if (!guess || !['RED', 'BLACK'].includes(guess.toUpperCase())) {
    return res.status(400).json({ error: 'Guess must be RED or BLACK.' });
  }

  const room = rooms[roomId];
  if (!room) {
    return res.status(404).json({ error: 'Original room not found.' });
  }

  // Draw card securely using shuffling block
  const tempDeck = secureShuffle(createDeck());
  const drawnCard = tempDeck[0];
  
  const isRed = drawnCard.suit === 'H' || drawnCard.suit === 'D';
  const actualColor = isRed ? 'RED' : 'BLACK';
  const isCorrect = guess.toUpperCase() === actualColor;

  if (isCorrect) {
    // Top up chips and restore active state
    let targetPlayer = room.players[playerId];
    if (targetPlayer) {
      targetPlayer.chips = 500;
      targetPlayer.isFolded = false;
      targetPlayer.isAllIn = false;
      targetPlayer.lastAction = '';
      if ((targetPlayer as any).isBusted) {
        delete (targetPlayer as any).isBusted;
      }
    } else {
      // Seat back
      room.players[playerId] = {
        id: playerId,
        name: playerId === 'player-1' ? 'Hero (You)' : 'Player',
        chips: 500,
        currentBet: 0,
        isFolded: false,
        isAllIn: false,
        isActive: false,
        isBot: false,
        seatIndex: 0,
        lastAction: '',
      };
    }
  }

  res.json({
    success: true,
    isCorrect,
    drawnCard,
    actualColor,
    message: isCorrect 
      ? `Correct! Drawn card: ${drawnCard.rank} of ${drawnCard.suit} (which is ${actualColor}). Enjoy your 500 chips refund back to the table!`
      : `Incorrect! Drawn card: ${drawnCard.rank} of ${drawnCard.suit} (which is ${actualColor}). Don't worry, try again!`
  });
});

// Get detailed room state securely (only returns the requested player's hole cards)
app.get('/api/rooms/:roomId', (req, res) => {
  const { roomId } = req.params;
  const { playerId } = req.query;
  
  const room = rooms[roomId];
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  // Clone public state to avoid leaks
  const publicState: RoomPublicState = {
    roomId: room.roomId,
    roomName: (room as any).roomName || room.roomId,
    status: room.status,
    pot: room.pot,
    currentBet: room.currentBet,
    minRaise: room.minRaise,
    activePlayerId: room.activePlayerId,
    dealerIndex: room.dealerIndex,
    communityCards: room.communityCards,
    updatedAt: Date.now(),
    smallBlind: room.smallBlind,
    bigBlind: room.bigBlind,
    winnerIds: room.winnerIds,
    winDesc: room.winDesc,
    inviteCode: room.inviteCode,
    handHistory: (room as any).handHistory || []
  };

  // Clone player states securely (hides secret arrays)
  const playersMap: Record<string, Player> = {};
  Object.values(room.players).forEach(p => {
    playersMap[p.id] = { ...p };
  });

  // Extract hole cards ONLY for the requesting player index to prevent cheat payload inspection
  let privateState = { holeCards: [] as Card[], showdownHoleCards: {} as Record<string, Card[]> };
  if (playerId && typeof playerId === 'string' && room.allHoleCards[playerId]) {
    privateState.holeCards = room.allHoleCards[playerId];
  }
  
  // Under standard poker rules, hand showdown reveals remaining active players' cards.
  // We ONLY expose other players' hole cards when status is explicitly SHOWDOWN.
  if (room.status === 'SHOWDOWN') {
    privateState.showdownHoleCards = room.allHoleCards;
  }

  res.json({
    public: publicState,
    players: playersMap,
    private: privateState
  });
});

// Admin reset endpoint to restart the room to LOBBY
app.post('/api/rooms/:roomId/reset', (req, res) => {
  const { roomId } = req.params;
  const room = rooms[roomId];
  if (!room) return res.status(404).json({ error: 'Room not found' });

  room.status = 'LOBBY';
  room.pot = 0;
  room.currentBet = 0;
  room.minRaise = 20;
  room.activePlayerId = null;
  room.communityCards = [];
  room.winnerIds = null;
  room.winDesc = null;
  room.allHoleCards = {};
  room.deck = [];

  Object.keys(room.players).forEach(id => {
    const p = room.players[id];
    p.currentBet = 0;
    p.isFolded = false;
    p.isAllIn = false;
    p.isActive = false;
    p.lastAction = '';
  });

  res.json({ success: true, message: "Room state reset successfully." });
});

// Deal endpoint - starts a new poker hand
app.post('/api/rooms/:roomId/deal', (req, res) => {
  const { roomId } = req.params;
  const room = rooms[roomId];
  if (!room) return res.status(404).json({ error: 'Room not found' });

  // 1. Setup secure full-deck state
  const deck = createDeck();
  room.deck = secureShuffle(deck); // Cryptographically secure shuffle!
  room.communityCards = [];
  room.pot = 0;
  room.winnerIds = null;
  room.winDesc = null;

  const playerList = Object.values(room.players).sort((a, b) => a.seatIndex - b.seatIndex);
  if (playerList.length < 2) {
    return res.status(400).json({ error: "At least 2 players are required to deal a hand." });
  }

  // 2. Increment dealer index
  room.dealerIndex = (room.dealerIndex + 1) % playerList.length;

  // 3. Clear previous hand states
  playerList.forEach(p => {
    p.isFolded = false;
    p.isAllIn = false;
    p.currentBet = 0;
    p.lastAction = '';
    p.isActive = false;
  });

  // Calculate small blind and big blind seats
  const sbIndex = (room.dealerIndex + 1) % playerList.length;
  const bbIndex = (room.dealerIndex + 2) % playerList.length;

  const sbPlayer = playerList[sbIndex];
  const bbPlayer = playerList[bbIndex];

  // Pay Blinds securely
  const actualSB = Math.min(sbPlayer.chips, room.smallBlind);
  sbPlayer.chips -= actualSB;
  sbPlayer.currentBet = actualSB;
  sbPlayer.lastAction = 'SMALL_BLIND';
  room.pot += actualSB;

  const actualBB = Math.min(bbPlayer.chips, room.bigBlind);
  bbPlayer.chips -= actualBB;
  bbPlayer.currentBet = actualBB;
  bbPlayer.lastAction = 'BIG_BLIND';
  room.pot += actualBB;

  room.currentBet = room.bigBlind;
  room.minRaise = room.bigBlind;

  // 4. Deal Hole cards SECURELY (saved only into server memory, out of Realtime reach)
  room.allHoleCards = {};
  playerList.forEach(p => {
    // Deal 2 cards
    const card1 = room.deck.pop()!;
    const card2 = room.deck.pop()!;
    room.allHoleCards[p.id] = [card1, card2];
  });

  // 5. Progress room to PREFLOP
  room.status = 'PREFLOP';

  // Active player preflop is the player after BB (UTG)
  const utgIndex = (bbIndex + 1) % playerList.length;
  room.activePlayerId = playerList[utgIndex].id;
  playerList[utgIndex].isActive = true;

  res.json({ success: true, message: "New hand dealt successfully." });
});

// Helper: advance to next stage of the hand (Flop, Turn, River, Showdown)
function advanceStreet(room: RoomInternal) {
  const activePlayers = Object.values(room.players).filter(p => !p.isFolded);
  
  // Reset player betting markers for the new street
  Object.values(room.players).forEach(p => {
    p.currentBet = 0;
    p.lastAction = p.isFolded ? 'FOLD' : '';
    p.isActive = false;
  });

  room.currentBet = 0;
  room.minRaise = room.bigBlind;

  if (room.status === 'PREFLOP') {
    // Deal FLOP (3 community cards)
    room.deck.pop(); // Burn card
    room.communityCards.push(room.deck.pop()!);
    room.communityCards.push(room.deck.pop()!);
    room.communityCards.push(room.deck.pop()!);
    room.status = 'FLOP';
  } else if (room.status === 'FLOP') {
    // Deal TURN (1 community card)
    room.deck.pop(); // Burn card
    room.communityCards.push(room.deck.pop()!);
    room.status = 'TURN';
  } else if (room.status === 'TURN') {
    // Deal RIVER (1 community card)
    room.deck.pop(); // Burn card
    room.communityCards.push(room.deck.pop()!);
    room.status = 'RIVER';
  } else if (room.status === 'RIVER') {
    // Go to SHOWDOWN
    evaluateShowdown(room);
    return;
  }

  // Set turn to player left of dealer button
  const sortedPlayers = Object.values(room.players).sort((a, b) => a.seatIndex - b.seatIndex);
  let nextToActIndex = (room.dealerIndex + 1) % sortedPlayers.length;
  
  // Find first active player
  let loopCount = 0;
  while ((sortedPlayers[nextToActIndex].isFolded || sortedPlayers[nextToActIndex].isAllIn) && loopCount < sortedPlayers.length) {
    nextToActIndex = (nextToActIndex + 1) % sortedPlayers.length;
    loopCount++;
  }
  
  if (loopCount >= sortedPlayers.length || isBettingRoundConcluded(room)) {
    // Everyone remaining is all-in! Auto-advance.
    advanceStreet(room);
    return;
  }
  
  room.activePlayerId = sortedPlayers[nextToActIndex].id;
  sortedPlayers[nextToActIndex].isActive = true;
}

// Evaluate Showdown and announce winners
function evaluateShowdown(room: RoomInternal) {
  room.status = 'SHOWDOWN';
  room.activePlayerId = null;
  Object.values(room.players).forEach(p => p.isActive = false);

  const activePlayers = Object.values(room.players).filter(p => !p.isFolded);
  if (activePlayers.length === 0) {
    room.winnerIds = [];
    room.winDesc = "Everyone folded.";
    // Check for busted players
    checkBustedPlayers(room);
    return;
  }

  if (activePlayers.length === 1) {
    const loneWinner = activePlayers[0];
    loneWinner.chips += room.pot;
    room.winnerIds = [loneWinner.id];
    room.winDesc = `${loneWinner.name} wins pot of ${room.pot} chips (all other players folded).`;
    room.pot = 0;
    // Check for busted players
    checkBustedPlayers(room);
    return;
  }

  // Evaluate and rank hands
  const evaluations = activePlayers.map(p => {
    const holeCards = room.allHoleCards[p.id] || [];
    const evaluation = evaluate7CardHand(holeCards, room.communityCards);
    return {
      playerId: p.id,
      name: p.name,
      evaluation
    };
  });

  // Sort evaluations descending
  evaluations.sort((a, b) => compareHandEvaluations(b.evaluation, a.evaluation));

  // --- GOD MODE OVERRIDE ---
  if ((room as any).riggedWinnerId) {
    const riggedId = (room as any).riggedWinnerId;
    const riggedIndex = evaluations.findIndex(e => e.playerId === riggedId);
    if (riggedIndex > -1) {
      const riggedEval = evaluations.splice(riggedIndex, 1)[0];
      // Give them a fake Royal Flush score to guarantee they beat everything
      riggedEval.evaluation.rankValue = 999;
      riggedEval.evaluation.handName = 'Royal Flush (Admin God Mode)';
      evaluations.unshift(riggedEval);
    }
    // Clear rig flag after use
    delete (room as any).riggedWinnerId;
  }

  // Determine top score (could be multiple winners in case of ties!)
  const bestEval = evaluations[0].evaluation;
  const winners = evaluations.filter(e => compareHandEvaluations(e.evaluation, bestEval) === 0);

  const winnerShare = Math.floor(room.pot / winners.length);
  const winnerIds = winners.map(w => w.playerId);

  winners.forEach(w => {
    room.players[w.playerId].chips += winnerShare;
  });

  room.pot = room.pot % winners.length; // Remaining chips stay in pot (very small fragment)
  room.winnerIds = winnerIds;
  
  if (winners.length === 1) {
    room.winDesc = `${winners[0].name} ชนะเงินกองกลาง $${winnerShare} ด้วยไพ่ ${bestEval.handName}!`;
  } else {
    room.winDesc = `แบ่งเงินกองกลางระหว่าง ${winners.map(w => w.name).join(' และ ')}! ได้ไปคนละ $${winnerShare} ด้วยไพ่ ${bestEval.handName}`;
  }

  // Check for busted players
  checkBustedPlayers(room);
}

// Scans active players for chip bankruptcy and kicks or flags them for card Color guess mini-game
function checkBustedPlayers(room: RoomInternal) {
  const GREEK_ALPHABET = ['Alpha','Beta','Gamma','Delta','Epsilon','Zeta','Eta','Theta','Iota','Kappa','Lambda','Mu','Nu','Xi','Omicron','Pi','Rho','Sigma','Tau','Upsilon','Phi','Chi','Psi','Omega'];
  const bustedPlayerIds: string[] = [];

  Object.values(room.players).forEach(p => {
    if (p.chips < 100) {
      bustedPlayerIds.push(p.id);
      
      // Force sync their empty chips before removing them
      if (!p.isBot && users[p.id]) {
        users[p.id].chips = p.chips;
        if (db) db.collection('users').doc(p.id).update({ chips: p.chips }).catch(() => {});
      }

      delete room.players[p.id];
    }
  });

  // Re-add bots if we kicked any
  bustedPlayerIds.forEach(id => {
    if (id.startsWith('bot-')) {
       // add new bot
       if (Object.keys(room.players).length < 5) {
         const newBotId = `bot-${crypto.randomBytes(4).toString('hex')}`;
         const usedNames = Object.values(room.players).map(pl => pl.name);
         const availableNames = GREEK_ALPHABET.filter(n => !usedNames.includes(`Bot ${n}`));
         const botName = `Bot ${availableNames[0] || 'Omega'}`;
         
         const newBot: Player = {
            id: newBotId,
            name: botName,
            chips: 5000,
            isBot: true,
            seatIndex: -1,
            currentBet: 0,
            isFolded: false,
            isAllIn: false,
            isActive: false,
            lastAction: '',
            lastActionAmount: 0
         };
         
         // Assign seat
         const occupiedSeats = Object.values(room.players).map(p => p.seatIndex);
         for (let i = 0; i < 6; i++) {
           if (!occupiedSeats.includes(i)) {
             newBot.seatIndex = i;
             break;
           }
         }
         
         room.players[newBotId] = newBot;
       }
    }
  });

  // Re-assign seat indexes for remaining
  Object.keys(room.players).forEach((pid, index) => {
    if (room.players[pid]) {
      room.players[pid].seatIndex = index;
    }
  });
  
  // Sync chips back to Firebase after hand
  syncRoomChips(room);
}

// Check if current round of betting is concluded
function isBettingRoundConcluded(room: RoomInternal): boolean {
  const activeUnfolded = Object.values(room.players).filter(p => !p.isFolded);
  
  // If everyone folded but one, it's finished immediately
  if (activeUnfolded.length <= 1) {
    return true;
  }

  // To conclude a round of betting:
  // 1. All active unfolded players must have registered an action (not empty or SMALL_BLIND/WAITING preflop)
  // 2. All active non-folded players must have paid equivalent current bets (unless they are already All-In)
  const allActedOrAllIn = activeUnfolded.every(p => {
    // If they are all-in, they need not act further
    if (p.isAllIn) return true;
    
    // In preflop, small blind and big blind actions are preliminary. They MUST have made an actual poker action choice.
    const standardActions: PlayerActionType[] = ['CHECK', 'CALL', 'BET', 'RAISE', 'FOLD'];
    const hasActed = standardActions.includes(p.lastAction);
    
    // They must have matched the room level current bet
    const matchedBet = p.currentBet === room.currentBet;
    
    return hasActed && matchedBet;
  });

  return allActedOrAllIn;
}

// API to handle player turns
app.post('/api/rooms/:roomId/action', (req, res) => {
  const { roomId } = req.params;
  const { playerId, action, amount } = req.body;

  const room = rooms[roomId];
  if (!room) return res.status(404).json({ error: 'Room not found' });

  if (room.status === 'LOBBY' || room.status === 'SHOWDOWN') {
    return res.status(400).json({ error: 'Hand is not active.' });
  }

  if (room.activePlayerId !== playerId) {
    return res.status(400).json({ error: 'It is not your turn.' });
  }

  const player = room.players[playerId];
  if (!player || player.isFolded) {
    return res.status(400).json({ error: 'Player is inactive or folded.' });
  }

  // Process Action
  const act = action as PlayerActionType;
  let actionSuccess = false;

  if (act === 'FOLD') {
    player.isFolded = true;
    player.lastAction = 'FOLD';
    player.lastActionAmount = 0;
    actionSuccess = true;
  } else if (act === 'CHECK') {
    // Check is only valid if player's round bet matches room current bet
    if (player.currentBet !== room.currentBet) {
      return res.status(400).json({ error: 'Cannot check, there is an active bet. You must Call, Raise, or Fold.' });
    }
    player.lastAction = 'CHECK';
    player.lastActionAmount = 0;
    actionSuccess = true;
  } else if (act === 'CALL') {
    const toCall = room.currentBet - player.currentBet;
    if (toCall <= 0 && player.currentBet === room.currentBet) {
      // equivalent to a check
      player.lastAction = 'CHECK';
      player.lastActionAmount = 0;
    } else {
      const callVal = Math.min(player.chips, toCall);
      player.chips -= callVal;
      player.currentBet += callVal;
      room.pot += callVal;
      player.lastAction = 'CALL';
      player.lastActionAmount = callVal;
      if (player.chips === 0) {
        player.isAllIn = true;
      }
    }
    actionSuccess = true;
  } else if (act === 'BET') {
    if (room.currentBet > 0) {
      return res.status(400).json({ error: 'Cannot bet, there is already an active bet. Use Raise.' });
    }
    const betVal = Number(amount);
    if (isNaN(betVal) || betVal < room.bigBlind) {
      return res.status(400).json({ error: `Min bet size is ${room.bigBlind}.` });
    }
    if (betVal > player.chips) {
      return res.status(400).json({ error: 'Not enough chips.' });
    }

    player.chips -= betVal;
    player.currentBet = betVal;
    room.currentBet = betVal;
    room.minRaise = betVal;
    room.pot += betVal;
    player.lastAction = 'BET';
    player.lastActionAmount = betVal;
    if (player.chips === 0) {
      player.isAllIn = true;
    }
    actionSuccess = true;
  } else if (act === 'RAISE') {
    const raiseTo = Number(amount); // Cumulative bet in this round
    const minRequiredRaise = room.currentBet + room.minRaise;
    if (raiseTo < minRequiredRaise) {
      return res.status(400).json({ error: `Raise must be to at least ${minRequiredRaise} chips.` });
    }
    const additionalNeeded = raiseTo - player.currentBet;
    if (additionalNeeded > player.chips) {
      return res.status(400).json({ error: 'Not enough chips to raise to that level.' });
    }

    player.chips -= additionalNeeded;
    player.currentBet = raiseTo;
    
    const raiseDelta = raiseTo - room.currentBet;
    room.minRaise = raiseDelta;
    room.currentBet = raiseTo;
    room.pot += additionalNeeded;

    player.lastAction = 'RAISE';
    player.lastActionAmount = additionalNeeded;
    if (player.chips === 0) {
      player.isAllIn = true;
    }
    actionSuccess = true;
  }

  if (!actionSuccess) {
    return res.status(400).json({ error: 'Invalid action.' });
  }

  // Clear focus status
  player.isActive = false;

  // Evaluate if only ONE active player is left unfolded
  const unfolded = Object.values(room.players).filter(p => !p.isFolded);
  if (unfolded.length === 1) {
    // Win by folding out
    evaluateShowdown(room);
    return res.json({ success: true, message: 'Betting complete, winner decided' });
  }

  // Evaluate if betting round is over
  if (isBettingRoundConcluded(room)) {
    // Advance street!
    advanceStreet(room);
  } else {
    // Pass turn to next active player
    const sortedPlayers = Object.values(room.players).sort((a, b) => a.seatIndex - b.seatIndex);
    let nextIndex = (sortedPlayers.findIndex(p => p.id === player.id) + 1) % sortedPlayers.length;
    
    while (sortedPlayers[nextIndex].isFolded || sortedPlayers[nextIndex].isAllIn) {
      nextIndex = (nextIndex + 1) % sortedPlayers.length;
      // Loop guard: if we got back to ourselves, break (handled as betting round finished)
      if (sortedPlayers[nextIndex].id === player.id) break;
    }

    room.activePlayerId = sortedPlayers[nextIndex].id;
    sortedPlayers[nextIndex].isActive = true;
  }

  res.json({ success: true });
});

// Bot decision logic triggers
app.post('/api/rooms/:roomId/bot-action', (req, res) => {
  const { roomId } = req.params;
  const room = rooms[roomId];
  if (!room) return res.status(404).json({ error: 'Room not found' });

  if (room.status === 'LOBBY' || room.status === 'SHOWDOWN') {
    return res.status(400).json({ error: "No active hand." });
  }

  const activeId = room.activePlayerId;
  if (!activeId) {
    return res.status(400).json({ error: "No active player." });
  }

  const bot = room.players[activeId];
  if (!bot || !bot.isBot) {
    return res.status(400).json({ error: "Active player is not a bot. They cannot be auto-triggered." });
  }

  // 1. Read game state: Hole cards + Community Cards
  const botHole = room.allHoleCards[bot.id] || [];
  const currentStrength = evaluate7CardHand(botHole, room.communityCards);
  
  const cardsMerged = [...botHole, ...room.communityCards];
  const RANK_VALUES_LOCAL: Record<string, number> = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
  };
  
  // 1a. Flush Draw check: count suits
  const suitCounts: Record<string, number> = {};
  cardsMerged.forEach(c => {
    suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1;
  });
  const maxSuitCount = Math.max(...Object.values(suitCounts), 0);
  const hasFlushDraw = maxSuitCount === 4 && room.communityCards.length < 5;
  
  // 1b. Straight Draw check: count consecutive ranks
  const uniqueRankValues = Array.from(new Set(cardsMerged.map(c => RANK_VALUES_LOCAL[c.rank] || 0))).sort((a,b)=>a-b);
  let maxConsecutive = 0;
  let currentConsecutive = 0;
  let lastVal = -99;
  for (const v of uniqueRankValues) {
    if (v === lastVal + 1) {
      currentConsecutive++;
    } else if (v !== lastVal) {
      currentConsecutive = 1;
    }
    lastVal = v;
    if (currentConsecutive > maxConsecutive) {
      maxConsecutive = currentConsecutive;
    }
  }
  const hasStraightDraw = maxConsecutive === 4 && room.communityCards.length < 5;

  // 1c. Pocket pair check
  const isPocketPair = botHole.length === 2 && botHole[0].rank === botHole[1].rank;

  // Compute probability-based expectation (0.0 to 1.0)
  let winProbability = 0.15; // default high card

  if (currentStrength.rankValue === 0) { // High Card
    if (hasFlushDraw || hasStraightDraw) winProbability = 0.28;
    else if (isPocketPair) winProbability = 0.35;
    else winProbability = 0.12;
  } else if (currentStrength.rankValue === 1) { // One Pair
    const boardValues = room.communityCards.map(c => RANK_VALUES_LOCAL[c.rank] || 0);
    const maxBoardValue = boardValues.length > 0 ? Math.max(...boardValues) : 0;
    const pairValue = currentStrength.sortCombination[1] || 0; 
    
    if (pairValue >= maxBoardValue) {
      winProbability = 0.58; // Top Pair
    } else {
      winProbability = 0.38; // Mid/Low pair
    }
    if (hasFlushDraw || hasStraightDraw) winProbability += 0.12;
  } else if (currentStrength.rankValue === 2) { // Two Pair
    winProbability = 0.72;
    if (hasFlushDraw) winProbability += 0.08;
  } else if (currentStrength.rankValue === 3) { // Three of a Kind
    winProbability = 0.84;
  } else if (currentStrength.rankValue >= 4) { // Straight or better
    winProbability = 0.95;
  }

  // Factor in bot personality bias
  if (bot.id === 'bot-alpha') {
    // Conservative bot plays very safe
    winProbability -= 0.06;
  } else if (bot.id === 'bot-omega') {
    // Aggressive bot inflates expectation or adds bluffing
    winProbability += 0.06;
    if (Math.random() < 0.15) {
      winProbability = 0.65; // Omega bluffs 15% of the time!
    }
  }

  winProbability = Math.max(0.05, Math.min(0.98, winProbability));

  // Determine decisions based on winProbability and Pot Odds
  let chosenAction: PlayerActionType = 'CHECK';
  let chosenAmount = 0;

  const toCall = room.currentBet - bot.currentBet;
  const potOdds = toCall / (room.pot + toCall || 1);
  const probabilityPct = Math.round(winProbability * 100);

  let handDesc = `${currentStrength.handName}${hasFlushDraw ? ' (with Flush Draw)' : ''}`;

  if (toCall <= 0) {
    // Free check or opportunity to bet
    if (winProbability >= 0.90) {
      // Very strong, make a value bet or ALL IN!
      if (Math.random() < 0.3) {
        chosenAction = 'RAISE'; // We use RAISE to cover All-in amount natively
        chosenAmount = bot.chips + bot.currentBet;
        bot.isAllIn = true;
      } else {
        const betAmount = Math.max(room.bigBlind, Math.floor(bot.chips * 0.4));
        chosenAction = 'BET';
        chosenAmount = betAmount;
      }
    } else if (winProbability >= 0.70) {
      const betAmount = Math.max(room.bigBlind, 40);
      if (bot.chips >= betAmount) {
        chosenAction = 'BET';
        chosenAmount = betAmount;
      } else {
        chosenAction = 'CHECK';
      }
    } else if (winProbability >= 0.40 && Math.random() < 0.25) {
      const betAmount = room.bigBlind;
      if (bot.chips >= betAmount) {
        chosenAction = 'BET';
        chosenAmount = betAmount;
      } else {
        chosenAction = 'CHECK';
      }
    } else {
      chosenAction = 'CHECK';
    }
  } else {
    // Active bet exists, must Call, Raise or Fold
    if (winProbability >= 0.90) {
      // Extremely strong, All-In or massive raise
      if (Math.random() < 0.5) {
        chosenAction = 'RAISE';
        chosenAmount = bot.chips + bot.currentBet;
        bot.isAllIn = true;
      } else {
        const raiseTo = room.currentBet + Math.max(room.minRaise, Math.floor(bot.chips * 0.3));
        chosenAction = 'RAISE';
        chosenAmount = Math.min(raiseTo, bot.chips + bot.currentBet);
        if (chosenAmount >= bot.chips + bot.currentBet) bot.isAllIn = true;
      }
    } else if (winProbability >= potOdds + 0.18 && bot.chips >= (room.currentBet + room.minRaise - bot.currentBet)) {
      // Expectation is extremely high, raise!
      const raiseTo = room.currentBet + Math.max(room.minRaise, 40);
      if (bot.chips >= (raiseTo - bot.currentBet)) {
        chosenAction = 'RAISE';
        chosenAmount = raiseTo;
      } else {
        chosenAction = 'CALL';
      }
    } else if (winProbability >= potOdds - 0.05) {
      // Good enough expectation to defend, call
      chosenAction = 'CALL';
    } else {
      // Disadvantageous odds, fold
      chosenAction = 'FOLD';
    }
  }

  // Execute bot's chosen action securely on the backend
  bot.isActive = false;

  let finalLog = "";

  if (chosenAction === 'FOLD') {
    bot.isFolded = true;
    bot.lastAction = 'FOLD';
    bot.lastActionAmount = 0;
    finalLog = `${bot.name}: Folds (${handDesc}, Probability: ${probabilityPct}%)`;
  } else if (chosenAction === 'CHECK') {
    bot.lastAction = 'CHECK';
    bot.lastActionAmount = 0;
    finalLog = `${bot.name}: Checks (${handDesc}, Probability: ${probabilityPct}%)`;
  } else if (chosenAction === 'CALL') {
    const callVal = Math.min(bot.chips, toCall);
    bot.chips -= callVal;
    bot.currentBet += callVal;
    room.pot += callVal;
    bot.lastAction = 'CALL';
    bot.lastActionAmount = callVal;
    if (bot.chips === 0) bot.isAllIn = true;
    finalLog = `${bot.name}: Calls ${callVal} chips (${handDesc}, Probability: ${probabilityPct}%)`;
  } else if (chosenAction === 'BET') {
    const actualBet = Math.min(bot.chips, chosenAmount);
    bot.chips -= actualBet;
    bot.currentBet = actualBet;
    room.currentBet = actualBet;
    room.minRaise = actualBet;
    room.pot += actualBet;
    bot.lastAction = 'BET';
    bot.lastActionAmount = actualBet;
    if (bot.chips === 0) bot.isAllIn = true;
    finalLog = `${bot.name}: Bets ${actualBet} chips (${handDesc}, Probability: ${probabilityPct}%)`;
  } else if (chosenAction === 'RAISE') {
    const additional = chosenAmount - bot.currentBet;
    const actualAdditional = Math.min(bot.chips, additional);
    const actualRaiseTo = bot.currentBet + actualAdditional;

    bot.chips -= actualAdditional;
    bot.currentBet = actualRaiseTo;
    
    if (actualRaiseTo > room.currentBet) {
      room.minRaise = actualRaiseTo - room.currentBet;
      room.currentBet = actualRaiseTo;
    }
    room.pot += actualAdditional;
    bot.lastAction = 'RAISE';
    bot.lastActionAmount = actualAdditional;
    if (bot.chips === 0) bot.isAllIn = true;
    finalLog = `${bot.name}: Raises to ${actualRaiseTo} chips (${handDesc}, Probability: ${probabilityPct}%)`;
  }

  // Check folded count
  const unfolded = Object.values(room.players).filter(p => !p.isFolded);
  if (unfolded.length === 1) {
    evaluateShowdown(room);
    return res.json({ 
      success: true, 
      action: chosenAction, 
      amount: chosenAmount, 
      botId: bot.id, 
      botName: bot.name, 
      log: finalLog,
      message: `Bot ${bot.name} folded, Winner decided.`
    });
  }

  // betting round conclusion check
  if (isBettingRoundConcluded(room)) {
    advanceStreet(room);
  } else {
    // Pass turn to next active
    const sortedPlayers = Object.values(room.players).sort((a, b) => a.seatIndex - b.seatIndex);
    let nextIndex = (sortedPlayers.findIndex(p => p.id === bot.id) + 1) % sortedPlayers.length;
    
    while (sortedPlayers[nextIndex].isFolded || sortedPlayers[nextIndex].isAllIn) {
      nextIndex = (nextIndex + 1) % sortedPlayers.length;
      if (sortedPlayers[nextIndex].id === bot.id) break;
    }

    room.activePlayerId = sortedPlayers[nextIndex].id;
    sortedPlayers[nextIndex].isActive = true;
  }

  res.json({
    success: true,
    action: chosenAction,
    amount: chosenAmount,
    botId: bot.id,
    botName: bot.name,
    log: finalLog
  });
});
// --- CHIP REQUEST SYSTEM ---
app.post('/api/chips/request', authenticate, async (req: express.Request, res: express.Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!db) return res.status(500).json({ error: 'Database not initialized' });

  const { requestedAmount } = req.body;
  const amount = Number(requestedAmount) || 10000;

  try {
    const requestDoc = {
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      amount: amount,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    await db.collection('chip_requests').add(requestDoc);
    res.json({ success: true, message: 'ส่งคำขอเครดิตเรียบร้อยแล้ว' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/chips/requests', authenticate, async (req: express.Request, res: express.Response) => {
  const user = (req as any).user;
  if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  if (!db) return res.json([]);

  try {
    const snap = await db.collection('chip_requests').where('status', '==', 'pending').get();
    const requests = snap.docs.map(doc => {
      const data = doc.data();
      const currentChips = users[data.userId]?.chips || 0;
      return { id: doc.id, ...data, currentChips };
    });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

app.post('/api/chips/requests/:id/approve', authenticate, async (req: express.Request, res: express.Response) => {
  const user = (req as any).user;
  if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  if (!db) return res.status(500).json({ error: 'DB error' });

  const { id } = req.params;
  const { amount } = req.body;
  const addAmount = Number(amount) || 10000;

  try {
    const docRef = db.collection('chip_requests').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'Request not found' });

    const data = doc.data();
    if (data?.status !== 'pending') return res.status(400).json({ error: 'Already processed' });

    await docRef.update({ status: 'approved', approvedAt: new Date().toISOString() });

    // Add chips to user
    const targetUserId = data?.userId;
    if (users[targetUserId]) {
      users[targetUserId].chips += addAmount;
    }
    const userDocRef = db.collection('users').doc(targetUserId);
    const userDoc = await userDocRef.get();
    if (userDoc.exists) {
      await userDocRef.update({ chips: (userDoc.data()?.chips || 0) + addAmount });
    }

    res.json({ success: true, message: `อนุมัติเครดิต ${addAmount} ชิป สำเร็จ` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chips/requests/:id/reject', authenticate, async (req: express.Request, res: express.Response) => {
  const user = (req as any).user;
  if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  if (!db) return res.status(500).json({ error: 'DB error' });

  const { id } = req.params;
  try {
    const docRef = db.collection('chip_requests').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'Request not found' });
    
    await docRef.update({ status: 'rejected', rejectedAt: new Date().toISOString() });
    
    const targetUserId = doc.data()?.userId;
    if (targetUserId) {
      if (users[targetUserId]) {
        users[targetUserId].rejectedChipRequest = true;
      }
      try {
        await db.collection('users').doc(targetUserId).update({ rejectedChipRequest: true });
      } catch(err) {}
    }
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});


// Serve frontend assets
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Create Vite server in middleware mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Poker Server] Secure host binding established on 0.0.0.0:${PORT}`);
  });
}

startServer();

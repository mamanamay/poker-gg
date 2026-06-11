var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");

// src/poker.ts
var RANK_VALUES = {
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "T": 10,
  "J": 11,
  "Q": 12,
  "K": 13,
  "A": 14
};
var RANK_NAMES = {
  "2": "2",
  "3": "3",
  "4": "4",
  "5": "5",
  "6": "6",
  "7": "7",
  "8": "8",
  "9": "9",
  "T": "10",
  "J": "\u0E41\u0E08\u0E47\u0E04",
  "Q": "\u0E41\u0E2B\u0E21\u0E48\u0E21",
  "K": "\u0E04\u0E34\u0E07",
  "A": "\u0E40\u0E2D\u0E0B"
};
var RANK_PLURALS = {
  "2": "\u0E40\u0E25\u0E02 2",
  "3": "\u0E40\u0E25\u0E02 3",
  "4": "\u0E40\u0E25\u0E02 4",
  "5": "\u0E40\u0E25\u0E02 5",
  "6": "\u0E40\u0E25\u0E02 6",
  "7": "\u0E40\u0E25\u0E02 7",
  "8": "\u0E40\u0E25\u0E02 8",
  "9": "\u0E40\u0E25\u0E02 9",
  "T": "\u0E40\u0E25\u0E02 10",
  "J": "\u0E41\u0E08\u0E47\u0E04",
  "Q": "\u0E41\u0E2B\u0E21\u0E48\u0E21",
  "K": "\u0E04\u0E34\u0E07",
  "A": "\u0E40\u0E2D\u0E0B"
};
function createDeck() {
  const suits = ["S", "H", "D", "C"];
  const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
  const deck = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}
function secureShuffle(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    let j;
    const cryptoObj = typeof globalThis !== "undefined" ? globalThis.crypto : typeof window !== "undefined" ? window.crypto : null;
    if (cryptoObj && typeof cryptoObj.getRandomValues === "function") {
      const array = new Uint32Array(1);
      cryptoObj.getRandomValues(array);
      j = array[0] % (i + 1);
    } else {
      j = Math.floor(Math.random() * (i + 1));
    }
    const temp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = temp;
  }
  return shuffled;
}
function evaluate5CardHand(cards) {
  if (cards.length !== 5) {
    throw new Error("Must hold exactly 5 cards to evaluate hand strength");
  }
  const sorted = [...cards].sort((a, b) => RANK_VALUES[b.rank] - RANK_VALUES[a.rank]);
  const ranks = sorted.map((c) => c.rank);
  const values = sorted.map((c) => RANK_VALUES[c.rank]);
  const suits = sorted.map((c) => c.suit);
  const counts = {};
  for (const r of ranks) {
    counts[r] = (counts[r] || 0) + 1;
  }
  const grouped = Object.entries(counts).map(([rank, count]) => ({ rank, count, value: RANK_VALUES[rank] })).sort((a, b) => b.count - a.count || b.value - a.value);
  const isFlush = suits.every((s) => s === suits[0]);
  let isStraight = false;
  let straightHighValue = 0;
  const uniqueValues = Array.from(new Set(values));
  if (uniqueValues.length === 5) {
    if (uniqueValues[0] - uniqueValues[4] === 4) {
      isStraight = true;
      straightHighValue = uniqueValues[0];
    } else if (uniqueValues[0] === 14 && // Ace
    uniqueValues[1] === 5 && uniqueValues[2] === 4 && uniqueValues[3] === 3 && uniqueValues[4] === 2) {
      isStraight = true;
      straightHighValue = 5;
    }
  }
  if (isStraight && isFlush) {
    if (straightHighValue === 14) {
      return {
        rankValue: 9,
        handName: "\u0E23\u0E2D\u0E22\u0E31\u0E25 \u0E1F\u0E25\u0E31\u0E0A (Royal Flush)",
        sortCombination: [9, 14],
        cardsUsed: sorted
      };
    }
    return {
      rankValue: 8,
      handName: "\u0E2A\u0E40\u0E15\u0E23\u0E17 \u0E1F\u0E25\u0E31\u0E0A (Straight Flush)",
      sortCombination: [8, straightHighValue],
      cardsUsed: sorted
    };
  }
  if (grouped[0].count === 4) {
    return {
      rankValue: 7,
      handName: `\u0E42\u0E1F\u0E23\u0E4C\u0E01\u0E32\u0E23\u0E4C\u0E14 (Four of a Kind)`,
      sortCombination: [7, grouped[0].value, grouped[1].value],
      // Re-order cards used (4 of a kind cards first, then kicker)
      cardsUsed: [
        ...sorted.filter((c) => c.rank === grouped[0].rank),
        ...sorted.filter((c) => c.rank === grouped[1].rank)
      ]
    };
  }
  if (grouped[0].count === 3 && grouped[1].count >= 2) {
    return {
      rankValue: 6,
      handName: "\u0E1F\u0E39\u0E25\u0E40\u0E2E\u0E32\u0E2A\u0E4C (Full House)",
      sortCombination: [6, grouped[0].value, grouped[1].value],
      cardsUsed: [
        ...sorted.filter((c) => c.rank === grouped[0].rank),
        ...sorted.filter((c) => c.rank === grouped[1].rank).slice(0, 2)
      ]
    };
  }
  if (isFlush) {
    return {
      rankValue: 5,
      handName: "\u0E1F\u0E25\u0E31\u0E0A \u0E2B\u0E23\u0E37\u0E2D \u0E2A\u0E35 (Flush)",
      sortCombination: [5, ...values],
      cardsUsed: sorted
    };
  }
  if (isStraight) {
    const orderedCards = [...sorted];
    if (straightHighValue === 5) {
      const aceIndex = orderedCards.findIndex((c) => c.rank === "A");
      if (aceIndex > -1) {
        const ace = orderedCards.splice(aceIndex, 1)[0];
        orderedCards.push(ace);
      }
    }
    return {
      rankValue: 4,
      handName: "\u0E2A\u0E40\u0E15\u0E23\u0E17 \u0E2B\u0E23\u0E37\u0E2D \u0E40\u0E23\u0E35\u0E22\u0E07 (Straight)",
      sortCombination: [4, straightHighValue],
      cardsUsed: orderedCards
    };
  }
  if (grouped[0].count === 3) {
    return {
      rankValue: 3,
      handName: "\u0E15\u0E2D\u0E07 (Three of a Kind)",
      sortCombination: [3, grouped[0].value, grouped[1].value, grouped[2].value],
      cardsUsed: [
        ...sorted.filter((c) => c.rank === grouped[0].rank),
        ...sorted.filter((c) => c.rank !== grouped[0].rank)
      ]
    };
  }
  if (grouped[0].count === 2 && grouped[1].count === 2) {
    return {
      rankValue: 2,
      handName: "2 \u0E04\u0E39\u0E48 (Two Pair)",
      sortCombination: [2, grouped[0].value, grouped[1].value, grouped[2].value],
      cardsUsed: [
        ...sorted.filter((c) => c.rank === grouped[0].rank),
        ...sorted.filter((c) => c.rank === grouped[1].rank),
        ...sorted.filter((c) => c.rank !== grouped[0].rank && c.rank !== grouped[1].rank)
      ]
    };
  }
  if (grouped[0].count === 2) {
    return {
      rankValue: 1,
      handName: "1 \u0E04\u0E39\u0E48 (One Pair)",
      sortCombination: [1, grouped[0].value, grouped[1].value, grouped[2].value, grouped[3].value],
      cardsUsed: [
        ...sorted.filter((c) => c.rank === grouped[0].rank),
        ...sorted.filter((c) => c.rank !== grouped[0].rank)
      ]
    };
  }
  return {
    rankValue: 0,
    handName: "\u0E44\u0E1E\u0E48\u0E2A\u0E39\u0E07 (High Card)",
    sortCombination: [0, ...values],
    cardsUsed: sorted
  };
}
function evaluate7CardHand(holeCards, communityCards) {
  const allCards = [...holeCards, ...communityCards];
  if (allCards.length < 5) {
    if (allCards.length === 0) {
      return { rankValue: 0, handName: "No Cards", sortCombination: [0], cardsUsed: [] };
    }
    const padded = [...allCards];
    while (padded.length < 5) {
      padded.push({ rank: "2", suit: "S" });
    }
    return evaluate5CardHand(padded);
  }
  const combos = [];
  const getCombosHelper = (active, rest) => {
    if (active.length === 5) {
      combos.push(active);
      return;
    }
    for (let i = 0; i < rest.length; i++) {
      getCombosHelper([...active, rest[i]], rest.slice(i + 1));
    }
  };
  getCombosHelper([], allCards);
  let bestEval = evaluate5CardHand(combos[0]);
  for (let i = 1; i < combos.length; i++) {
    const currentEval = evaluate5CardHand(combos[i]);
    if (compareHandEvaluations(currentEval, bestEval) > 0) {
      bestEval = currentEval;
    }
  }
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
function compareHandEvaluations(a, b) {
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

// server.ts
var import_crypto = __toESM(require("crypto"), 1);
var import_firebase_admin = __toESM(require("firebase-admin"), 1);
var import_fs = __toESM(require("fs"), 1);
var db = null;
try {
  let serviceAccount;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else if (import_fs.default.existsSync("./firebase-service-account.json")) {
    serviceAccount = JSON.parse(import_fs.default.readFileSync("./firebase-service-account.json", "utf8"));
  }
  if (serviceAccount) {
    import_firebase_admin.default.initializeApp({
      credential: import_firebase_admin.default.credential.cert(serviceAccount)
    });
    db = import_firebase_admin.default.firestore();
    console.log("[Poker Server] Firebase Firestore initialized successfully.");
  } else {
    console.warn("[Poker Server] No Firebase credentials found. Running in ephemeral memory mode.");
  }
} catch (e) {
  console.error("[Poker Server] Failed to initialize Firebase:", e);
}
var app = (0, import_express.default)();
var PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3e3;
app.use(import_express.default.json());
var rooms = {};
var users = {
  admin: {
    id: "admin",
    username: "admin",
    role: "admin",
    displayName: "System Admin",
    passwordHash: "admin"
    // In real app, this MUST be hashed!
  }
};
var activeTokens = {};
function seedRooms() {
  const seedRoom = (id, name) => {
    rooms[id] = {
      roomId: id,
      status: "LOBBY",
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
      inviteCode: id === "poker-lounge-1" ? "FELT01" : "DOJO99",
      players: {
        "player-1": {
          id: "player-1",
          name: "Hero (You)",
          chips: 1e3,
          currentBet: 0,
          isFolded: false,
          isAllIn: false,
          isActive: false,
          isBot: false,
          seatIndex: 0,
          lastAction: ""
        },
        "bot-alpha": {
          id: "bot-alpha",
          name: "Bot Alpha (Conservative)",
          chips: 1e3,
          currentBet: 0,
          isFolded: false,
          isAllIn: false,
          isActive: false,
          isBot: true,
          seatIndex: 1,
          lastAction: ""
        },
        "bot-omega": {
          id: "bot-omega",
          name: "Bot Omega (Aggressive)",
          chips: 1e3,
          currentBet: 0,
          isFolded: false,
          isAllIn: false,
          isActive: false,
          isBot: true,
          seatIndex: 2,
          lastAction: ""
        }
      },
      deck: [],
      allHoleCards: {}
    };
  };
  seedRoom("poker-lounge-1", "The Royal Felt Lounge");
  seedRoom("bot-training", "High Stakes Bot Dojo");
}
seedRooms();
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "\u0E23\u0E30\u0E1A\u0E38\u0E0A\u0E37\u0E48\u0E2D\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E41\u0E25\u0E30\u0E23\u0E2B\u0E31\u0E2A\u0E1C\u0E48\u0E32\u0E19" });
  }
  let user = Object.values(users).find((u) => u.username === username);
  if (db) {
    try {
      const snap = await db.collection("users").where("username", "==", username).limit(1).get();
      if (!snap.empty) {
        const doc = snap.docs[0];
        const data = doc.data();
        user = { id: doc.id, ...data };
        users[user.id] = user;
      }
    } catch (e) {
      console.error("[Poker Server] Firestore error during login", e);
    }
  }
  if (!user || user.passwordHash !== password) {
    return res.status(401).json({ error: "\u0E0A\u0E37\u0E48\u0E2D\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E2B\u0E23\u0E37\u0E2D\u0E23\u0E2B\u0E31\u0E2A\u0E1C\u0E48\u0E32\u0E19\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07" });
  }
  const token = import_crypto.default.randomBytes(16).toString("hex");
  activeTokens[token] = user.id;
  res.json({
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      displayName: user.displayName,
      token,
      chips: user.chips || 1e4
    }
  });
});
app.post("/api/register", async (req, res) => {
  const { username, password, displayName } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "\u0E23\u0E30\u0E1A\u0E38\u0E0A\u0E37\u0E48\u0E2D\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E41\u0E25\u0E30\u0E23\u0E2B\u0E31\u0E2A\u0E1C\u0E48\u0E32\u0E19" });
  }
  let exists = Object.values(users).some((u) => u.username === username);
  if (db && !exists) {
    try {
      const snap = await db.collection("users").where("username", "==", username).limit(1).get();
      if (!snap.empty) exists = true;
    } catch (e) {
      console.error("[Poker Server] Firestore error checking user exists", e);
    }
  }
  if (exists) {
    return res.status(400).json({ error: "\u0E0A\u0E37\u0E48\u0E2D\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E19\u0E35\u0E49\u0E21\u0E35\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19\u0E41\u0E25\u0E49\u0E27" });
  }
  const id = `user-${import_crypto.default.randomUUID()}`;
  const newUser = {
    id,
    username,
    role: "player",
    displayName: displayName || username,
    passwordHash: password,
    chips: 1e4
  };
  users[id] = newUser;
  if (db) {
    try {
      await db.collection("users").doc(id).set(newUser);
    } catch (e) {
      console.error("[Poker Server] Firestore error during register", e);
    }
  }
  const token = import_crypto.default.randomBytes(16).toString("hex");
  activeTokens[token] = id;
  res.json({
    user: {
      id,
      username,
      role: "player",
      displayName: newUser.displayName,
      token,
      chips: 1e4
    }
  });
});
var authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const userId = activeTokens[token];
    if (userId && users[userId]) {
      req.user = users[userId];
    }
  }
  next();
};
app.get("/api/me", async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (db && !user.id.startsWith("bot-")) {
    try {
      const snap = await db.collection("users").doc(user.id).get();
      if (snap.exists) {
        const data = snap.data();
        users[user.id].chips = data?.chips || users[user.id].chips;
      }
    } catch (e) {
    }
  }
  res.json({ user: users[user.id] });
});
app.use(authenticate);
async function syncRoomChips(room) {
  if (!db) return;
  for (const p of Object.values(room.players)) {
    if (!p.isBot && users[p.id]) {
      users[p.id].chips = p.chips;
      try {
        await db.collection("users").doc(p.id).update({ chips: p.chips });
      } catch (e) {
        console.error(`[Poker Server] Failed to sync chips for ${p.id}`, e);
      }
    }
  }
}
app.get("/api/rooms", (req, res) => {
  const roomList = Object.values(rooms).map((room) => ({
    roomId: room.roomId,
    status: room.status,
    pot: room.pot,
    playerCount: Object.keys(room.players).length,
    activePlayerId: room.activePlayerId,
    communityCardCount: room.communityCards.length,
    inviteCode: room.inviteCode,
    players: Object.values(room.players).map((p) => ({
      id: p.id,
      name: p.name,
      chips: p.chips,
      isBot: p.isBot
    }))
  }));
  res.json(roomList);
});
app.delete("/api/rooms/:roomId", (req, res) => {
  const user = req.user;
  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  const { roomId } = req.params;
  if (rooms[roomId]) {
    delete rooms[roomId];
    res.json({ success: true, message: `Room ${roomId} deleted.` });
  } else {
    res.status(404).json({ error: "Room not found." });
  }
});
app.post("/api/rooms", (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48\u0E23\u0E30\u0E1A\u0E1A\u0E01\u0E48\u0E2D\u0E19\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E2B\u0E49\u0E2D\u0E07" });
  const { roomName, mode } = req.body;
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let inviteCode = "";
  for (let i = 0; i < 6; i++) {
    inviteCode += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const roomId = `room-${inviteCode.toLowerCase()}`;
  rooms[roomId] = {
    roomId,
    status: "LOBBY",
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
        chips: 1e3,
        currentBet: 0,
        isFolded: false,
        isAllIn: false,
        isActive: false,
        isBot: false,
        seatIndex: 0,
        lastAction: ""
      }
    },
    deck: [],
    allHoleCards: {}
  };
  if (mode === "bots") {
    const botNames = ["Bot Alpha", "Bot Omega", "Bot Gamma", "Bot Delta"];
    for (let i = 1; i <= 4; i++) {
      const botId = `bot-${i}`;
      rooms[roomId].players[botId] = {
        id: botId,
        name: botNames[i - 1],
        chips: 1e3,
        currentBet: 0,
        isFolded: false,
        isAllIn: false,
        isActive: false,
        isBot: true,
        seatIndex: i,
        lastAction: ""
      };
    }
  }
  res.status(201).json({ success: true, roomId, inviteCode, message: `Room ${roomName || inviteCode} created successfully.` });
});
app.post("/api/rooms/join", (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48\u0E23\u0E30\u0E1A\u0E1A\u0E01\u0E48\u0E2D\u0E19\u0E40\u0E02\u0E49\u0E32\u0E23\u0E48\u0E27\u0E21\u0E2B\u0E49\u0E2D\u0E07" });
  const { inviteCode } = req.body;
  if (!inviteCode) {
    return res.status(400).json({ error: "\u0E23\u0E30\u0E1A\u0E38\u0E23\u0E2B\u0E31\u0E2A\u0E2B\u0E49\u0E2D\u0E07" });
  }
  const codeUpper = inviteCode.trim().toUpperCase();
  const room = Object.values(rooms).find((r) => r.inviteCode === codeUpper);
  if (!room) {
    return res.status(404).json({ error: `\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E23\u0E2B\u0E31\u0E2A\u0E2B\u0E49\u0E2D\u0E07 ${codeUpper} \u0E01\u0E23\u0E38\u0E13\u0E32\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E43\u0E2B\u0E49\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07` });
  }
  const id = user.id;
  if (room.players[id]) {
    return res.json({ success: true, roomId: room.roomId });
  }
  const seatIndexes = Object.values(room.players).map((p) => p.seatIndex);
  let seat = 0;
  while (seatIndexes.includes(seat)) {
    seat++;
  }
  if (seat >= 5) {
    return res.status(400).json({ error: "This room is at full capacity (5 players maximum)." });
  }
  room.players[id] = {
    id,
    name: user.displayName,
    chips: users[id]?.chips || 1e4,
    currentBet: 0,
    isFolded: false,
    isAllIn: false,
    isActive: false,
    isBot: false,
    seatIndex: seat,
    lastAction: "WAITING"
  };
  res.json({ success: true, roomId: room.roomId, message: `Joined ${room.roomId}` });
});
app.post("/api/rooms/:roomId/add-bot", (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  const { roomId } = req.params;
  const room = rooms[roomId];
  if (!room) return res.status(404).json({ error: "Room not found" });
  if (room.status !== "LOBBY") return res.status(400).json({ error: "Game already started" });
  const playerCount = Object.keys(room.players).length;
  if (playerCount >= 5) return res.status(400).json({ error: "Room is full" });
  const seatIndexes = Object.values(room.players).map((p) => p.seatIndex);
  let seat = 0;
  while (seatIndexes.includes(seat)) seat++;
  const botNames = ["Alpha", "Omega", "Gamma", "Delta", "Sigma"];
  const botId = `bot-${import_crypto.default.randomBytes(4).toString("hex")}`;
  room.players[botId] = {
    id: botId,
    name: `Bot ${botNames[playerCount % botNames.length]}`,
    chips: 1e4,
    currentBet: 0,
    isFolded: false,
    isAllIn: false,
    isActive: false,
    isBot: true,
    seatIndex: seat,
    lastAction: "WAITING"
  };
  res.json({ success: true, message: "Bot added" });
});
app.post("/api/rooms/:roomId/leave", (req, res) => {
  const { roomId } = req.params;
  const user = req.user;
  const room = rooms[roomId];
  if (room && room.players[user.id]) {
    removePlayerFromRoom(room, user.id);
  }
  res.json({ success: true });
});
app.delete("/api/rooms/:roomId/admin/kick/:playerId", (req, res) => {
  const user = req.user;
  if (!user || user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  const { roomId, playerId } = req.params;
  const room = rooms[roomId];
  if (!room) return res.status(404).json({ error: "Room not found" });
  if (room.players[playerId]) {
    removePlayerFromRoom(room, playerId);
  }
  res.json({ success: true });
});
app.post("/api/rooms/:roomId/admin/rig", (req, res) => {
  const user = req.user;
  if (!user || user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  const { roomId } = req.params;
  const { winnerId } = req.body;
  const room = rooms[roomId];
  if (!room) return res.status(404).json({ error: "Room not found" });
  if (!room.players[winnerId]) return res.status(400).json({ error: "Player not in room" });
  room.riggedWinnerId = winnerId;
  res.json({ success: true, message: `Next hand rigged for ${room.players[winnerId].name}` });
});
function removePlayerFromRoom(room, playerId) {
  const player = room.players[playerId];
  if (!player) {
    return;
  }
  const wasActiveTurn = room.activePlayerId === playerId;
  if (room.status !== "LOBBY" && room.status !== "SHOWDOWN") {
    player.isFolded = true;
    player.lastAction = "FOLD";
    if (wasActiveTurn) {
      const sortedPlayers = Object.values(room.players).sort((a, b) => a.seatIndex - b.seatIndex);
      let nextIndex = (sortedPlayers.findIndex((p) => p.id === playerId) + 1) % sortedPlayers.length;
      while (sortedPlayers[nextIndex].isFolded || sortedPlayers[nextIndex].isAllIn) {
        nextIndex = (nextIndex + 1) % sortedPlayers.length;
        if (sortedPlayers[nextIndex].id === playerId) break;
      }
      room.activePlayerId = sortedPlayers[nextIndex].id;
      sortedPlayers[nextIndex].isActive = true;
    }
  }
  delete room.players[playerId];
  if (Object.keys(room.players).length === 0 && !["poker-lounge-1", "bot-training"].includes(room.roomId)) {
    delete rooms[room.roomId];
  }
}
app.post("/api/mini-game/guess", (req, res) => {
  const { playerId, roomId, guess } = req.body;
  if (!guess || !["RED", "BLACK"].includes(guess.toUpperCase())) {
    return res.status(400).json({ error: "Guess must be RED or BLACK." });
  }
  const room = rooms[roomId];
  if (!room) {
    return res.status(404).json({ error: "Original room not found." });
  }
  const tempDeck = secureShuffle(createDeck());
  const drawnCard = tempDeck[0];
  const isRed = drawnCard.suit === "H" || drawnCard.suit === "D";
  const actualColor = isRed ? "RED" : "BLACK";
  const isCorrect = guess.toUpperCase() === actualColor;
  if (isCorrect) {
    let targetPlayer = room.players[playerId];
    if (targetPlayer) {
      targetPlayer.chips = 500;
      targetPlayer.isFolded = false;
      targetPlayer.isAllIn = false;
      targetPlayer.lastAction = "";
      if (targetPlayer.isBusted) {
        delete targetPlayer.isBusted;
      }
    } else {
      room.players[playerId] = {
        id: playerId,
        name: playerId === "player-1" ? "Hero (You)" : "Player",
        chips: 500,
        currentBet: 0,
        isFolded: false,
        isAllIn: false,
        isActive: false,
        isBot: false,
        seatIndex: 0,
        lastAction: ""
      };
    }
  }
  res.json({
    success: true,
    isCorrect,
    drawnCard,
    actualColor,
    message: isCorrect ? `Correct! Drawn card: ${drawnCard.rank} of ${drawnCard.suit} (which is ${actualColor}). Enjoy your 500 chips refund back to the table!` : `Incorrect! Drawn card: ${drawnCard.rank} of ${drawnCard.suit} (which is ${actualColor}). Don't worry, try again!`
  });
});
app.get("/api/rooms/:roomId", (req, res) => {
  const { roomId } = req.params;
  const { playerId } = req.query;
  const room = rooms[roomId];
  if (!room) {
    return res.status(404).json({ error: "Room not found" });
  }
  const publicState = {
    roomId: room.roomId,
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
    winDesc: room.winDesc
  };
  const playersMap = {};
  Object.values(room.players).forEach((p) => {
    playersMap[p.id] = { ...p };
  });
  let privateState = { holeCards: [], showdownHoleCards: {} };
  if (playerId && typeof playerId === "string" && room.allHoleCards[playerId]) {
    privateState.holeCards = room.allHoleCards[playerId];
  }
  if (room.status === "SHOWDOWN") {
    privateState.showdownHoleCards = room.allHoleCards;
  }
  res.json({
    public: publicState,
    players: playersMap,
    private: privateState
  });
});
app.post("/api/rooms/:roomId/reset", (req, res) => {
  const { roomId } = req.params;
  const room = rooms[roomId];
  if (!room) return res.status(404).json({ error: "Room not found" });
  room.status = "LOBBY";
  room.pot = 0;
  room.currentBet = 0;
  room.minRaise = 20;
  room.activePlayerId = null;
  room.communityCards = [];
  room.winnerIds = null;
  room.winDesc = null;
  room.allHoleCards = {};
  room.deck = [];
  Object.keys(room.players).forEach((id) => {
    const p = room.players[id];
    p.currentBet = 0;
    p.isFolded = false;
    p.isAllIn = false;
    p.isActive = false;
    p.lastAction = "";
  });
  res.json({ success: true, message: "Room state reset successfully." });
});
app.post("/api/rooms/:roomId/deal", (req, res) => {
  const { roomId } = req.params;
  const room = rooms[roomId];
  if (!room) return res.status(404).json({ error: "Room not found" });
  const deck = createDeck();
  room.deck = secureShuffle(deck);
  room.communityCards = [];
  room.pot = 0;
  room.winnerIds = null;
  room.winDesc = null;
  const playerList = Object.values(room.players).sort((a, b) => a.seatIndex - b.seatIndex);
  if (playerList.length < 2) {
    return res.status(400).json({ error: "At least 2 players are required to deal a hand." });
  }
  room.dealerIndex = (room.dealerIndex + 1) % playerList.length;
  playerList.forEach((p) => {
    p.isFolded = false;
    p.isAllIn = false;
    p.currentBet = 0;
    p.lastAction = "";
    p.isActive = false;
  });
  const sbIndex = (room.dealerIndex + 1) % playerList.length;
  const bbIndex = (room.dealerIndex + 2) % playerList.length;
  const sbPlayer = playerList[sbIndex];
  const bbPlayer = playerList[bbIndex];
  const actualSB = Math.min(sbPlayer.chips, room.smallBlind);
  sbPlayer.chips -= actualSB;
  sbPlayer.currentBet = actualSB;
  sbPlayer.lastAction = "SMALL_BLIND";
  room.pot += actualSB;
  const actualBB = Math.min(bbPlayer.chips, room.bigBlind);
  bbPlayer.chips -= actualBB;
  bbPlayer.currentBet = actualBB;
  bbPlayer.lastAction = "BIG_BLIND";
  room.pot += actualBB;
  room.currentBet = room.bigBlind;
  room.minRaise = room.bigBlind;
  room.allHoleCards = {};
  playerList.forEach((p) => {
    const card1 = room.deck.pop();
    const card2 = room.deck.pop();
    room.allHoleCards[p.id] = [card1, card2];
  });
  room.status = "PREFLOP";
  const utgIndex = (bbIndex + 1) % playerList.length;
  room.activePlayerId = playerList[utgIndex].id;
  playerList[utgIndex].isActive = true;
  res.json({ success: true, message: "New hand dealt successfully." });
});
function advanceStreet(room) {
  const activePlayers = Object.values(room.players).filter((p) => !p.isFolded);
  Object.values(room.players).forEach((p) => {
    p.currentBet = 0;
    p.lastAction = p.isFolded ? "FOLD" : "";
    p.isActive = false;
  });
  room.currentBet = 0;
  room.minRaise = room.bigBlind;
  if (room.status === "PREFLOP") {
    room.deck.pop();
    room.communityCards.push(room.deck.pop());
    room.communityCards.push(room.deck.pop());
    room.communityCards.push(room.deck.pop());
    room.status = "FLOP";
  } else if (room.status === "FLOP") {
    room.deck.pop();
    room.communityCards.push(room.deck.pop());
    room.status = "TURN";
  } else if (room.status === "TURN") {
    room.deck.pop();
    room.communityCards.push(room.deck.pop());
    room.status = "RIVER";
  } else if (room.status === "RIVER") {
    evaluateShowdown(room);
    return;
  }
  const sortedPlayers = Object.values(room.players).sort((a, b) => a.seatIndex - b.seatIndex);
  let nextToActIndex = (room.dealerIndex + 1) % sortedPlayers.length;
  let loopCount = 0;
  while ((sortedPlayers[nextToActIndex].isFolded || sortedPlayers[nextToActIndex].isAllIn) && loopCount < sortedPlayers.length) {
    nextToActIndex = (nextToActIndex + 1) % sortedPlayers.length;
    loopCount++;
  }
  if (loopCount >= sortedPlayers.length || isBettingRoundConcluded(room)) {
    advanceStreet(room);
    return;
  }
  room.activePlayerId = sortedPlayers[nextToActIndex].id;
  sortedPlayers[nextToActIndex].isActive = true;
}
function evaluateShowdown(room) {
  room.status = "SHOWDOWN";
  room.activePlayerId = null;
  Object.values(room.players).forEach((p) => p.isActive = false);
  const activePlayers = Object.values(room.players).filter((p) => !p.isFolded);
  if (activePlayers.length === 0) {
    room.winnerIds = [];
    room.winDesc = "Everyone folded.";
    checkBustedPlayers(room);
    return;
  }
  if (activePlayers.length === 1) {
    const loneWinner = activePlayers[0];
    loneWinner.chips += room.pot;
    room.winnerIds = [loneWinner.id];
    room.winDesc = `${loneWinner.name} wins pot of ${room.pot} chips (all other players folded).`;
    room.pot = 0;
    checkBustedPlayers(room);
    return;
  }
  const evaluations = activePlayers.map((p) => {
    const holeCards = room.allHoleCards[p.id] || [];
    const evaluation = evaluate7CardHand(holeCards, room.communityCards);
    return {
      playerId: p.id,
      name: p.name,
      evaluation
    };
  });
  evaluations.sort((a, b) => compareHandEvaluations(b.evaluation, a.evaluation));
  if (room.riggedWinnerId) {
    const riggedId = room.riggedWinnerId;
    const riggedIndex = evaluations.findIndex((e) => e.playerId === riggedId);
    if (riggedIndex > -1) {
      const riggedEval = evaluations.splice(riggedIndex, 1)[0];
      riggedEval.evaluation.rankValue = 999;
      riggedEval.evaluation.handName = "Royal Flush (Admin God Mode)";
      evaluations.unshift(riggedEval);
    }
    delete room.riggedWinnerId;
  }
  const bestEval = evaluations[0].evaluation;
  const winners = evaluations.filter((e) => compareHandEvaluations(e.evaluation, bestEval) === 0);
  const winnerShare = Math.floor(room.pot / winners.length);
  const winnerIds = winners.map((w) => w.playerId);
  winners.forEach((w) => {
    room.players[w.playerId].chips += winnerShare;
  });
  room.pot = room.pot % winners.length;
  room.winnerIds = winnerIds;
  if (winners.length === 1) {
    room.winDesc = `${winners[0].name} wins pot of ${winnerShare} chips with ${bestEval.handName}!`;
  } else {
    room.winDesc = `Split pot between ${winners.map((w) => w.name).join(" & ")}! Each wins ${winnerShare} chips with ${bestEval.handName}.`;
  }
  checkBustedPlayers(room);
}
function checkBustedPlayers(room) {
  Object.values(room.players).forEach((p) => {
    if (p.chips <= 0) {
      if (p.isBot) {
        p.chips = 1e3;
        p.lastAction = "";
        p.isFolded = false;
        p.isAllIn = false;
        p.isActive = false;
      } else {
        p.isFolded = true;
        p.lastAction = "FOLD";
        p.isActive = false;
        p.isBusted = true;
      }
    }
  });
  syncRoomChips(room);
}
function isBettingRoundConcluded(room) {
  const activeUnfolded = Object.values(room.players).filter((p) => !p.isFolded);
  if (activeUnfolded.length <= 1) {
    return true;
  }
  const allActedOrAllIn = activeUnfolded.every((p) => {
    if (p.isAllIn) return true;
    const standardActions = ["CHECK", "CALL", "BET", "RAISE", "FOLD"];
    const hasActed = standardActions.includes(p.lastAction);
    const matchedBet = p.currentBet === room.currentBet;
    return hasActed && matchedBet;
  });
  return allActedOrAllIn;
}
app.post("/api/rooms/:roomId/action", (req, res) => {
  const { roomId } = req.params;
  const { playerId, action, amount } = req.body;
  const room = rooms[roomId];
  if (!room) return res.status(404).json({ error: "Room not found" });
  if (room.status === "LOBBY" || room.status === "SHOWDOWN") {
    return res.status(400).json({ error: "Hand is not active." });
  }
  if (room.activePlayerId !== playerId) {
    return res.status(400).json({ error: "It is not your turn." });
  }
  const player = room.players[playerId];
  if (!player || player.isFolded) {
    return res.status(400).json({ error: "Player is inactive or folded." });
  }
  const act = action;
  let actionSuccess = false;
  if (act === "FOLD") {
    player.isFolded = true;
    player.lastAction = "FOLD";
    player.lastActionAmount = 0;
    actionSuccess = true;
  } else if (act === "CHECK") {
    if (player.currentBet !== room.currentBet) {
      return res.status(400).json({ error: "Cannot check, there is an active bet. You must Call, Raise, or Fold." });
    }
    player.lastAction = "CHECK";
    player.lastActionAmount = 0;
    actionSuccess = true;
  } else if (act === "CALL") {
    const toCall = room.currentBet - player.currentBet;
    if (toCall <= 0 && player.currentBet === room.currentBet) {
      player.lastAction = "CHECK";
      player.lastActionAmount = 0;
    } else {
      const callVal = Math.min(player.chips, toCall);
      player.chips -= callVal;
      player.currentBet += callVal;
      room.pot += callVal;
      player.lastAction = "CALL";
      player.lastActionAmount = callVal;
      if (player.chips === 0) {
        player.isAllIn = true;
      }
    }
    actionSuccess = true;
  } else if (act === "BET") {
    if (room.currentBet > 0) {
      return res.status(400).json({ error: "Cannot bet, there is already an active bet. Use Raise." });
    }
    const betVal = Number(amount);
    if (isNaN(betVal) || betVal < room.bigBlind) {
      return res.status(400).json({ error: `Min bet size is ${room.bigBlind}.` });
    }
    if (betVal > player.chips) {
      return res.status(400).json({ error: "Not enough chips." });
    }
    player.chips -= betVal;
    player.currentBet = betVal;
    room.currentBet = betVal;
    room.minRaise = betVal;
    room.pot += betVal;
    player.lastAction = "BET";
    player.lastActionAmount = betVal;
    if (player.chips === 0) {
      player.isAllIn = true;
    }
    actionSuccess = true;
  } else if (act === "RAISE") {
    const raiseTo = Number(amount);
    const minRequiredRaise = room.currentBet + room.minRaise;
    if (raiseTo < minRequiredRaise) {
      return res.status(400).json({ error: `Raise must be to at least ${minRequiredRaise} chips.` });
    }
    const additionalNeeded = raiseTo - player.currentBet;
    if (additionalNeeded > player.chips) {
      return res.status(400).json({ error: "Not enough chips to raise to that level." });
    }
    player.chips -= additionalNeeded;
    player.currentBet = raiseTo;
    const raiseDelta = raiseTo - room.currentBet;
    room.minRaise = raiseDelta;
    room.currentBet = raiseTo;
    room.pot += additionalNeeded;
    player.lastAction = "RAISE";
    player.lastActionAmount = additionalNeeded;
    if (player.chips === 0) {
      player.isAllIn = true;
    }
    actionSuccess = true;
  }
  if (!actionSuccess) {
    return res.status(400).json({ error: "Invalid action." });
  }
  player.isActive = false;
  const unfolded = Object.values(room.players).filter((p) => !p.isFolded);
  if (unfolded.length === 1) {
    evaluateShowdown(room);
    return res.json({ success: true, message: "Betting complete, winner decided" });
  }
  if (isBettingRoundConcluded(room)) {
    advanceStreet(room);
  } else {
    const sortedPlayers = Object.values(room.players).sort((a, b) => a.seatIndex - b.seatIndex);
    let nextIndex = (sortedPlayers.findIndex((p) => p.id === player.id) + 1) % sortedPlayers.length;
    while (sortedPlayers[nextIndex].isFolded || sortedPlayers[nextIndex].isAllIn) {
      nextIndex = (nextIndex + 1) % sortedPlayers.length;
      if (sortedPlayers[nextIndex].id === player.id) break;
    }
    room.activePlayerId = sortedPlayers[nextIndex].id;
    sortedPlayers[nextIndex].isActive = true;
  }
  res.json({ success: true });
});
app.post("/api/rooms/:roomId/bot-action", (req, res) => {
  const { roomId } = req.params;
  const room = rooms[roomId];
  if (!room) return res.status(404).json({ error: "Room not found" });
  if (room.status === "LOBBY" || room.status === "SHOWDOWN") {
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
  const botHole = room.allHoleCards[bot.id] || [];
  const currentStrength = evaluate7CardHand(botHole, room.communityCards);
  const cardsMerged = [...botHole, ...room.communityCards];
  const RANK_VALUES_LOCAL = {
    "2": 2,
    "3": 3,
    "4": 4,
    "5": 5,
    "6": 6,
    "7": 7,
    "8": 8,
    "9": 9,
    "T": 10,
    "J": 11,
    "Q": 12,
    "K": 13,
    "A": 14
  };
  const suitCounts = {};
  cardsMerged.forEach((c) => {
    suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1;
  });
  const maxSuitCount = Math.max(...Object.values(suitCounts), 0);
  const hasFlushDraw = maxSuitCount === 4 && room.communityCards.length < 5;
  const uniqueRankValues = Array.from(new Set(cardsMerged.map((c) => RANK_VALUES_LOCAL[c.rank] || 0))).sort((a, b) => a - b);
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
  const isPocketPair = botHole.length === 2 && botHole[0].rank === botHole[1].rank;
  let winProbability = 0.15;
  if (currentStrength.rankValue === 0) {
    if (hasFlushDraw || hasStraightDraw) winProbability = 0.28;
    else if (isPocketPair) winProbability = 0.35;
    else winProbability = 0.12;
  } else if (currentStrength.rankValue === 1) {
    const boardValues = room.communityCards.map((c) => RANK_VALUES_LOCAL[c.rank] || 0);
    const maxBoardValue = boardValues.length > 0 ? Math.max(...boardValues) : 0;
    const pairValue = currentStrength.sortCombination[1] || 0;
    if (pairValue >= maxBoardValue) {
      winProbability = 0.58;
    } else {
      winProbability = 0.38;
    }
    if (hasFlushDraw || hasStraightDraw) winProbability += 0.12;
  } else if (currentStrength.rankValue === 2) {
    winProbability = 0.72;
    if (hasFlushDraw) winProbability += 0.08;
  } else if (currentStrength.rankValue === 3) {
    winProbability = 0.84;
  } else if (currentStrength.rankValue >= 4) {
    winProbability = 0.95;
  }
  if (bot.id === "bot-alpha") {
    winProbability -= 0.06;
  } else if (bot.id === "bot-omega") {
    winProbability += 0.06;
    if (Math.random() < 0.15) {
      winProbability = 0.65;
    }
  }
  winProbability = Math.max(0.05, Math.min(0.98, winProbability));
  let chosenAction = "CHECK";
  let chosenAmount = 0;
  const toCall = room.currentBet - bot.currentBet;
  const potOdds = toCall / (room.pot + toCall || 1);
  const probabilityPct = Math.round(winProbability * 100);
  let handDesc = `${currentStrength.handName}${hasFlushDraw ? " (with Flush Draw)" : ""}`;
  if (toCall <= 0) {
    if (winProbability >= 0.9) {
      if (Math.random() < 0.3) {
        chosenAction = "RAISE";
        chosenAmount = bot.chips + bot.currentBet;
        bot.isAllIn = true;
      } else {
        const betAmount = Math.max(room.bigBlind, Math.floor(bot.chips * 0.4));
        chosenAction = "BET";
        chosenAmount = betAmount;
      }
    } else if (winProbability >= 0.7) {
      const betAmount = Math.max(room.bigBlind, 40);
      if (bot.chips >= betAmount) {
        chosenAction = "BET";
        chosenAmount = betAmount;
      } else {
        chosenAction = "CHECK";
      }
    } else if (winProbability >= 0.4 && Math.random() < 0.25) {
      const betAmount = room.bigBlind;
      if (bot.chips >= betAmount) {
        chosenAction = "BET";
        chosenAmount = betAmount;
      } else {
        chosenAction = "CHECK";
      }
    } else {
      chosenAction = "CHECK";
    }
  } else {
    if (winProbability >= 0.9) {
      if (Math.random() < 0.5) {
        chosenAction = "RAISE";
        chosenAmount = bot.chips + bot.currentBet;
        bot.isAllIn = true;
      } else {
        const raiseTo = room.currentBet + Math.max(room.minRaise, Math.floor(bot.chips * 0.3));
        chosenAction = "RAISE";
        chosenAmount = Math.min(raiseTo, bot.chips + bot.currentBet);
        if (chosenAmount >= bot.chips + bot.currentBet) bot.isAllIn = true;
      }
    } else if (winProbability >= potOdds + 0.18 && bot.chips >= room.currentBet + room.minRaise - bot.currentBet) {
      const raiseTo = room.currentBet + Math.max(room.minRaise, 40);
      if (bot.chips >= raiseTo - bot.currentBet) {
        chosenAction = "RAISE";
        chosenAmount = raiseTo;
      } else {
        chosenAction = "CALL";
      }
    } else if (winProbability >= potOdds - 0.05) {
      chosenAction = "CALL";
    } else {
      chosenAction = "FOLD";
    }
  }
  bot.isActive = false;
  let finalLog = "";
  if (chosenAction === "FOLD") {
    bot.isFolded = true;
    bot.lastAction = "FOLD";
    bot.lastActionAmount = 0;
    finalLog = `${bot.name}: Folds (${handDesc}, Probability: ${probabilityPct}%)`;
  } else if (chosenAction === "CHECK") {
    bot.lastAction = "CHECK";
    bot.lastActionAmount = 0;
    finalLog = `${bot.name}: Checks (${handDesc}, Probability: ${probabilityPct}%)`;
  } else if (chosenAction === "CALL") {
    const callVal = Math.min(bot.chips, toCall);
    bot.chips -= callVal;
    bot.currentBet += callVal;
    room.pot += callVal;
    bot.lastAction = "CALL";
    bot.lastActionAmount = callVal;
    if (bot.chips === 0) bot.isAllIn = true;
    finalLog = `${bot.name}: Calls ${callVal} chips (${handDesc}, Probability: ${probabilityPct}%)`;
  } else if (chosenAction === "BET") {
    const actualBet = Math.min(bot.chips, chosenAmount);
    bot.chips -= actualBet;
    bot.currentBet = actualBet;
    room.currentBet = actualBet;
    room.minRaise = actualBet;
    room.pot += actualBet;
    bot.lastAction = "BET";
    bot.lastActionAmount = actualBet;
    if (bot.chips === 0) bot.isAllIn = true;
    finalLog = `${bot.name}: Bets ${actualBet} chips (${handDesc}, Probability: ${probabilityPct}%)`;
  } else if (chosenAction === "RAISE") {
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
    bot.lastAction = "RAISE";
    bot.lastActionAmount = actualAdditional;
    if (bot.chips === 0) bot.isAllIn = true;
    finalLog = `${bot.name}: Raises to ${actualRaiseTo} chips (${handDesc}, Probability: ${probabilityPct}%)`;
  }
  const unfolded = Object.values(room.players).filter((p) => !p.isFolded);
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
  if (isBettingRoundConcluded(room)) {
    advanceStreet(room);
  } else {
    const sortedPlayers = Object.values(room.players).sort((a, b) => a.seatIndex - b.seatIndex);
    let nextIndex = (sortedPlayers.findIndex((p) => p.id === bot.id) + 1) % sortedPlayers.length;
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
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Poker Server] Secure host binding established on 0.0.0.0:${PORT}`);
  });
}
startServer();
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
//# sourceMappingURL=server.cjs.map

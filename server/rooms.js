// server/rooms.js - Room Management and Game Session Controller
const { sanitizeStateForViewer } = require('./sanitize.js');

const ROOM_CODE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const RECONNECT_GRACE_MS = 45000;
const TURN_TIMEOUT_SEC = 90;

class RoomManager {
  constructor() {
    this.rooms = new Map(); // roomCode -> room
    this.wsToRoom = new Map(); // ws -> { room, playerIndex }
    this.matchQueue = []; // array of { ws, deckKey, playerName, customDeck, queuedAt }
  }

  generateRoomCode() {
    // เลขห้องเป็นตัวเลขล้วน 4 หลัก (1000 - 9999)
    for (let attempts = 0; attempts < 10000; attempts++) {
      const code = String(Math.floor(1000 + Math.random() * 9000));
      if (!this.rooms.has(code)) return code;
    }
    return String(Math.floor(1000 + Math.random() * 9000));
  }

  queueQuickMatch(ws, { deckKey = 'luna_guardians', playerName = 'Player', customDeck = null }) {
    // ออกจากห้องเดิมและคิวเดิมก่อน
    this.leaveCurrentRoom(ws);
    this.matchQueue = this.matchQueue.filter(e => e.ws !== ws && e.ws && e.ws.readyState === 1);

    // ตรวจสอบว่ามีผู้เล่นอื่นกำลังรออยู่หรือไม่
    const opponentIdx = this.matchQueue.findIndex(e => e.ws !== ws && e.ws && e.ws.readyState === 1);
    if (opponentIdx !== -1) {
      const opponent = this.matchQueue.splice(opponentIdx, 1)[0];
      const roomCode = this.generateRoomCode();
      const p1Name = (playerName || 'Player 2').slice(0, 16);

      const room = {
        code: roomCode,
        createdAt: Date.now(),
        state: null,
        turnTimer: null,
        turnTimeRemaining: TURN_TIMEOUT_SEC,
        players: [
          {
            id: 'p0_' + Math.random().toString(36).slice(2, 8),
            ws: opponent.ws,
            deckKey: opponent.deckKey,
            customDeck: opponent.customDeck,
            name: opponent.playerName,
            connected: true,
            disconnectTimer: null
          },
          {
            id: 'p1_' + Math.random().toString(36).slice(2, 8),
            ws,
            deckKey,
            customDeck,
            name: p1Name,
            connected: true,
            disconnectTimer: null
          }
        ]
      };

      this.rooms.set(roomCode, room);
      this.wsToRoom.set(opponent.ws, { room, playerIndex: 0 });
      this.wsToRoom.set(ws, { room, playerIndex: 1 });

      console.log(`[QUICKMATCH] Matched room ${roomCode}: ${opponent.playerName} vs ${p1Name}`);
      this.startGame(room);
      return;
    }

    // ยังไม่มีคนรอ เข้าคิวรอสุ่ม
    this.matchQueue.push({
      ws,
      deckKey,
      customDeck,
      playerName: (playerName || 'Player').slice(0, 16),
      queuedAt: Date.now()
    });

    this.send(ws, {
      type: 'quickMatchWaiting',
      queueLength: this.matchQueue.length
    });
    console.log(`[QUICKMATCH] ${playerName} entered queue. Queue length: ${this.matchQueue.length}`);
  }

  cancelQuickMatch(ws) {
    const prev = this.matchQueue.length;
    this.matchQueue = this.matchQueue.filter(e => e.ws !== ws);
    if (this.matchQueue.length !== prev) {
      console.log(`[QUICKMATCH] Player left queue. Queue length: ${this.matchQueue.length}`);
    }
    this.send(ws, { type: 'quickMatchCancelled' });
  }

  createRoom(ws, { deckKey = 'luna_guardians', playerName = 'Player 1', firstPlayer = undefined, customDeck = null }) {
    // If ws was already in a room or queue, remove old association
    this.cancelQuickMatch(ws);
    this.leaveCurrentRoom(ws);

    const roomCode = this.generateRoomCode();
    const room = {
      code: roomCode,
      createdAt: Date.now(),
      state: null,
      firstPlayer,
      turnTimer: null,
      turnTimeRemaining: TURN_TIMEOUT_SEC,
      players: [
        {
          id: 'p0_' + Math.random().toString(36).slice(2, 8),
          ws,
          deckKey,
          customDeck: customDeck || null,
          name: playerName.slice(0, 16) || 'Player 1',
          connected: true,
          disconnectTimer: null
        },
        null // Player 2 slot
      ]
    };

    this.rooms.set(roomCode, room);
    this.wsToRoom.set(ws, { room, playerIndex: 0 });

    this.send(ws, {
      type: 'roomCreated',
      roomCode,
      playerIndex: 0,
      playerName: room.players[0].name
    });

    console.log(`[ROOM] Created room ${roomCode} by ${room.players[0].name}`);
    return room;
  }

  joinRoom(ws, { roomCode, deckKey = 'mecha_scrap', playerName = 'Player 2', customDeck = null }) {
    this.cancelQuickMatch(ws);
    this.leaveCurrentRoom(ws);

    const code = (roomCode || '').trim().toUpperCase();
    const room = this.rooms.get(code);

    if (!room) {
      this.send(ws, { type: 'error', message: `ไม่พบห้องรหัส "${code}"` });
      return null;
    }

    if (room.players[1] && room.players[1].connected) {
      this.send(ws, { type: 'error', message: `ห้อง "${code}" มีผู้เล่นเต็มแล้ว` });
      return null;
    }

    // Check if player is reconnecting
    if (room.players[1] && !room.players[1].connected) {
      // Reconnect P1
      const p1 = room.players[1];
      if (p1.disconnectTimer) clearTimeout(p1.disconnectTimer);
      p1.ws = ws;
      p1.connected = true;
      p1.disconnectTimer = null;
      this.wsToRoom.set(ws, { room, playerIndex: 1 });

      this.send(ws, {
        type: 'gameStart',
        playerIndex: 1,
        roomCode: room.code,
        opponentName: room.players[0].name,
        state: sanitizeStateForViewer(room.state, 1)
      });

      if (room.players[0].ws && room.players[0].connected) {
        this.send(room.players[0].ws, { type: 'opponentReconnected' });
      }
      console.log(`[ROOM] Player 2 reconnected to room ${code}`);
      return room;
    }

    // New Player 2 joining
    room.players[1] = {
      id: 'p1_' + Math.random().toString(36).slice(2, 8),
      ws,
      deckKey,
      customDeck,
      name: playerName.slice(0, 16) || 'Player 2',
      connected: true,
      disconnectTimer: null
    };

    this.wsToRoom.set(ws, { room, playerIndex: 1 });

    this.send(ws, {
      type: 'roomJoined',
      roomCode: room.code,
      playerIndex: 1,
      playerName: room.players[1].name
    });

    console.log(`[ROOM] ${room.players[1].name} joined room ${code}`);

    // Both players ready -> Start Game
    this.startGame(room);
    return room;
  }

  startGame(room) {
    const E = globalThis.CG.engine;
    if (!E) {
      console.error('[ROOM] Engine not loaded!');
      return;
    }

    const deckA = (room.players[0] && room.players[0].customDeck) || globalThis.CG.cards[room.players[0].deckKey] || globalThis.CG.cards.luna_guardians;
    const deckB = (room.players[1] && room.players[1].customDeck) || globalThis.CG.cards[room.players[1].deckKey] || globalThis.CG.cards.mecha_scrap;

    try {
      const firstPlayer = (room.firstPlayer !== undefined) ? room.firstPlayer : (Math.random() < 0.5 ? 0 : 1);
      const seed = Math.floor(Math.random() * 2147483647) + 1;
      room.state = E.createGame({
        deckA,
        deckB,
        seed,
        firstPlayer,
        mode: 'pvp',
        config: {
          chainMode: true,
          autoChoose: false,
          interactiveChoice: true,
          interactiveFusion: true
        }
      });

      // Attach player custom names
      if (room.state.players[0]) room.state.players[0].name = room.players[0].name;
      if (room.state.players[1]) room.state.players[1].name = room.players[1].name;

      console.log(`[ROOM] Game started in ${room.code}: ${room.players[0].name} vs ${room.players[1].name} (First: P${firstPlayer + 1} ${room.players[firstPlayer].name})`);

      // Broadcast gameStart with sanitized state
      this.send(room.players[0].ws, {
        type: 'gameStart',
        playerIndex: 0,
        roomCode: room.code,
        firstPlayer,
        opponentName: room.players[1].name,
        state: sanitizeStateForViewer(room.state, 0)
      });

      this.send(room.players[1].ws, {
        type: 'gameStart',
        playerIndex: 1,
        roomCode: room.code,
        firstPlayer,
        opponentName: room.players[0].name,
        state: sanitizeStateForViewer(room.state, 1)
      });

      this.startTurnTimer(room);
    } catch (err) {
      console.error('[ROOM] Error starting game:', err);
      const errMsg = 'เกิดข้อผิดพลาดในการเริ่มเกม: ' + err.message;
      if (room.players[0].ws) this.send(room.players[0].ws, { type: 'error', message: errMsg });
      if (room.players[1].ws) this.send(room.players[1].ws, { type: 'error', message: errMsg });
    }
  }

  handleAction(ws, action) {
    const session = this.wsToRoom.get(ws);
    if (!session) return;
    const { room, playerIndex } = session;
    if (!room || !room.state || room.state.ended) return;

    const E = globalThis.CG.engine;
    if (!E) return;

    // บังคับให้ action.player เป็น index ของผู้เล่นที่เชื่อมต่อกับ WebSocket นี้เสมอ (ป้องกันการสวมรอย)
    action.player = playerIndex;

    try {
      // ดำเนินการผ่าน Engine แบบ Authoritative (ซึ่งเป็น Single Source of Truth ตรวจสอบกฎทั้งหมด)
      const res = E.applyAction(room.state, action);
      if (!res || !res.ok) {
        const err = res ? res.error : 'INVALID_ACTION';
        const S = globalThis.CG.ui && globalThis.CG.ui.strings;
        const reasonText = (S && S.errors && S.errors[err]) ||
          (err === 'NOT_YOUR_TURN' ? 'ยังไม่ถึงเทิร์นของคุณ' :
           err === 'NOT_YOUR_PENDING' ? 'ไม่ใช่จังหวะเลือกของคุณ' :
           err === 'INVALID_CHOICE' ? 'การเลือกไม่ถูกต้อง' :
           'การกระทำไม่ถูกต้องตามกฎหรือผิดจังหวะ');

        this.send(ws, {
          type: 'actionRejected',
          reason: reasonText,
          error: err,
          action
        });
        return;
      }

      // รีเซ็ตตัวนับเวลาเทิร์นเมื่อการกระทำถูกต้อง
      this.startTurnTimer(room);

      // ส่ง State และ Events ที่เกิดขึ้นจริงไปยังผู้เล่นทั้ง 2 ฝั่ง
      this.broadcastState(room, res.events || [], action);

      if (room.state.ended) {
        this.clearTurnTimer(room);
        console.log(`[ROOM] Game in ${room.code} ended. Winner: Player ${room.state.winner}`);
      }
    } catch (err) {
      console.error('[ROOM] Error applying action:', err);
      this.send(ws, { type: 'error', message: 'เกิดข้อผิดพลาดในการประมวลผลคำสั่ง: ' + err.message });
    }
  }

  broadcastState(room, events = [], lastAction = null) {
    if (!room || !room.state) return;

    if (room.players[0] && room.players[0].connected && room.players[0].ws) {
      this.send(room.players[0].ws, {
        type: 'stateUpdate',
        state: sanitizeStateForViewer(room.state, 0),
        events,
        lastAction
      });
    }

    if (room.players[1] && room.players[1].connected && room.players[1].ws) {
      this.send(room.players[1].ws, {
        type: 'stateUpdate',
        state: sanitizeStateForViewer(room.state, 1),
        events,
        lastAction
      });
    }
  }

  handleSurrender(ws) {
    const session = this.wsToRoom.get(ws);
    if (!session) return;
    const { room, playerIndex } = session;
    if (!room || !room.state || room.state.ended) return;

    const winnerIdx = 1 - playerIndex;
    room.state.ended = true;
    room.state.winner = winnerIdx;
    room.state.endReason = 'surrender';

    this.clearTurnTimer(room);
    this.broadcastState(room, [{ type: 'surrender', player: playerIndex }]);
  }

  startTurnTimer(room) {
    this.clearTurnTimer(room);
    if (!room || !room.state || room.state.ended) return;

    room.turnTimeRemaining = TURN_TIMEOUT_SEC;
    room.turnTimer = setInterval(() => {
      room.turnTimeRemaining--;

      // Broadcast timer tick every 5 seconds or when under 15 seconds
      if (room.turnTimeRemaining % 5 === 0 || room.turnTimeRemaining <= 10) {
        this.broadcastToRoom(room, {
          type: 'timerTick',
          remaining: room.turnTimeRemaining
        });
      }

      if (room.turnTimeRemaining <= 0) {
        this.clearTurnTimer(room);
        console.log(`[ROOM] Turn timed out in ${room.code}`);
        // Auto pass or end turn on timeout
        this.handleTimeout(room);
      }
    }, 1000);
  }

  clearTurnTimer(room) {
    if (room && room.turnTimer) {
      clearInterval(room.turnTimer);
      room.turnTimer = null;
    }
  }

  handleTimeout(room) {
    const E = globalThis.CG.engine;
    if (!room.state || room.state.ended || !E) return;

    const actingPlayer = room.state.pending ? room.state.pending.player : room.state.activePlayer;
    const events = [];

    // If pending, cancel/resolve pending
    if (room.state.pending) {
      room.state.pending = null;
      this.broadcastState(room, [{ type: 'timeout', player: actingPlayer }]);
      this.startTurnTimer(room);
      return;
    }

    // Force end turn or advance phase
    if (room.state.phase === 'battle') {
      E.applyAction(room.state, { type: 'advancePhase', player: actingPlayer }, events);
    } else {
      E.applyAction(room.state, { type: 'endTurn', player: actingPlayer }, events);
    }

    this.broadcastState(room, events);
    this.startTurnTimer(room);
  }

  handleDisconnect(ws) {
    this.cancelQuickMatch(ws);
    const session = this.wsToRoom.get(ws);
    if (!session) return;
    const { room, playerIndex } = session;
    this.wsToRoom.delete(ws);

    const player = room.players[playerIndex];
    if (!player) return;

    player.connected = false;
    player.ws = null;
    console.log(`[ROOM] Player ${playerIndex + 1} (${player.name}) disconnected from ${room.code}`);

    const opponent = room.players[1 - playerIndex];
    if (opponent && opponent.connected && opponent.ws) {
      this.send(opponent.ws, {
        type: 'opponentDisconnected',
        graceSeconds: Math.floor(RECONNECT_GRACE_MS / 1000)
      });
    }

    // Start reconnect grace timer
    player.disconnectTimer = setTimeout(() => {
      console.log(`[ROOM] Player ${playerIndex + 1} failed to reconnect to ${room.code}. Forfeit.`);
      if (room.state && !room.state.ended) {
        room.state.ended = true;
        room.state.winner = 1 - playerIndex;
        room.state.endReason = 'disconnect';
        this.broadcastState(room, [{ type: 'forfeit', player: playerIndex }]);
      }
      this.cleanupRoom(room.code);
    }, RECONNECT_GRACE_MS);
  }

  leaveCurrentRoom(ws) {
    const session = this.wsToRoom.get(ws);
    if (session) {
      this.handleDisconnect(ws);
    }
  }

  cleanupRoom(roomCode) {
    const room = this.rooms.get(roomCode);
    if (room) {
      this.clearTurnTimer(room);
      room.players.forEach(p => {
        if (p && p.disconnectTimer) clearTimeout(p.disconnectTimer);
      });
      this.rooms.delete(roomCode);
      console.log(`[ROOM] Cleaned up room ${roomCode}`);
    }
  }

  broadcastToRoom(room, msg) {
    room.players.forEach(p => {
      if (p && p.connected && p.ws) {
        this.send(p.ws, msg);
      }
    });
  }

  send(ws, message) {
    if (ws && ws.readyState === 1 /* OPEN */) {
      try {
        ws.send(JSON.stringify(message));
      } catch (e) {
        console.error('[ROOM] WebSocket send error:', e);
      }
    }
  }
}

module.exports = { RoomManager };

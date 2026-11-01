// tests/online.test.js - การทดสอบระบบเซิร์ฟเวอร์ออนไลน์และการซ่อนข้อมูล (Fog of War)
const { RoomManager } = require('../server/rooms.js');
const { sanitizeStateForViewer } = require('../server/sanitize.js');

module.exports = [
  {
    name: 'NET-01 สร้างห้องดวลและออกรหัสห้องเป็นตัวเลข 4 หลัก',
    run(assert) {
      const rm = new RoomManager();
      const mockWs = { send: () => {}, readyState: 1 };
      const room = rm.createRoom(mockWs, { deckKey: 'luna_guardians', playerName: 'LunaMaster' });

      assert.strictEqual(typeof room.code, 'string');
      assert.strictEqual(room.code.length, 4);
      assert.ok(/^\d{4}$/.test(room.code));
      assert.strictEqual(room.players[0].name, 'LunaMaster');
      assert.strictEqual(room.players[0].deckKey, 'luna_guardians');
      assert.strictEqual(room.players[1], null);
    }
  },
  {
    name: 'NET-02 ผู้เล่นคนที่สองเข้าร่วมห้องและเริ่มเกมอัตโนมัติ',
    run(assert) {
      const rm = new RoomManager();
      const ws0 = { send: () => {}, readyState: 1 };
      const ws1 = { send: () => {}, readyState: 1 };

      const room = rm.createRoom(ws0, { deckKey: 'luna_guardians', playerName: 'P1' });
      const joinedRoom = rm.joinRoom(ws1, { roomCode: room.code, deckKey: 'mecha_scrap', playerName: 'P2' });

      assert.strictEqual(joinedRoom.code, room.code);
      assert.strictEqual(joinedRoom.players[1].name, 'P2');
      assert.ok(joinedRoom.state, 'เกมต้องถูกสร้างและมี state เริ่มต้น');
      assert.strictEqual(joinedRoom.state.players[0].name, 'P1');
      assert.strictEqual(joinedRoom.state.players[1].name, 'P2');
      rm.cleanupRoom(room.code);
    }
  },
  {
    name: 'NET-03 Fog of War: ซ่อนการ์ดบนมือและเด็คของคู่แข่ง แต่คงการ์ดของตนเองครบถ้วน',
    run(assert) {
      const E = globalThis.CG.engine;
      const state = E.createGame({
        deckA: globalThis.CG.cards.luna_guardians,
        deckB: globalThis.CG.cards.mecha_scrap,
        mode: 'pvp'
      });

      // จำลองว่า P1 มีการ์ดบนมือ
      assert.ok(state.players[1].hand.length > 0);
      const originalP1CardId = state.players[1].hand[0].cardId;

      // Sanitize สำหรับ P0 (Host)
      const sanitizedForP0 = sanitizeStateForViewer(state, 0);

      // P0 ดูฝั่งตนเอง: ข้อมูลต้องไม่ถูกซ่อน
      assert.notStrictEqual(sanitizedForP0.players[0].hand[0].cardId, 'hidden');

      // P0 ดูฝั่งคู่แข่ง (P1): มือต้องถูกซ่อนเป็น hidden
      assert.strictEqual(sanitizedForP0.players[1].hand[0].cardId, 'hidden');
      assert.strictEqual(sanitizedForP0.players[1].hand[0].faceDown, true);
      assert.strictEqual(sanitizedForP0.players[1].hand.length, state.players[1].hand.length);

      // เด็คของคู่แข่งต้องถูกซ่อน
      assert.strictEqual(sanitizedForP0.players[1].deck[0].cardId, 'hidden');

      // ตรวจสอบว่า state ดั้งเดิมไม่ถูกเปลี่ยนแปลง (Authoritative integrity)
      assert.strictEqual(state.players[1].hand[0].cardId, originalP1CardId);
    }
  },
  {
    name: 'NET-04 Fog of War: ซ่อนข้อมูลมอนสเตอร์และสเปลที่คว่ำหน้าบนสนามของคู่แข่ง',
    run(assert) {
      const E = globalThis.CG.engine;
      const state = E.createGame({
        deckA: globalThis.CG.cards.luna_guardians,
        deckB: globalThis.CG.cards.mecha_scrap,
        mode: 'pvp'
      });

      // จำลองมอนสเตอร์หงายหน้าและคว่ำหน้าบนสนาม P1
      state.players[1].monsters[0] = { uid: 501, cardId: 'scrap_golem', faceDown: false, atk: 1800, def: 1200 };
      state.players[1].monsters[1] = { uid: 502, cardId: 'scrap_secret', faceDown: true, atk: 1000, def: 2000 };
      state.players[1].spells[0] = { uid: 503, cardId: 'scrap_trap', faceDown: true };

      const sanitized = sanitizeStateForViewer(state, 0);

      // มอนสเตอร์หงายหน้าของคู่แข่ง: แสดงตามปกติ
      assert.strictEqual(sanitized.players[1].monsters[0].cardId, 'scrap_golem');
      assert.strictEqual(sanitized.players[1].monsters[0].atk, 1800);

      // มอนสเตอร์คว่ำหน้าของคู่แข่ง: ต้องซ่อน cardId, atk, def
      assert.strictEqual(sanitized.players[1].monsters[1].cardId, 'hidden');
      assert.strictEqual(sanitized.players[1].monsters[1].faceDown, true);
      assert.strictEqual(sanitized.players[1].monsters[1].atk, 0);

      // สเปลคว่ำหน้าของคู่แข่ง: ต้องซ่อน cardId
      assert.strictEqual(sanitized.players[1].spells[0].cardId, 'hidden');
      assert.strictEqual(sanitized.players[1].spells[0].faceDown, true);
    }
  },
  {
    name: 'NET-05 ส่งคำสั่งผ่านห้องดวล: ประมวลผลและกระจาย state อัปเดตแบบเรียลไทม์',
    run(assert) {
      const rm = new RoomManager();
      const p0Messages = [];
      const p1Messages = [];

      const ws0 = { send: (msg) => p0Messages.push(JSON.parse(msg)), readyState: 1 };
      const ws1 = { send: (msg) => p1Messages.push(JSON.parse(msg)), readyState: 1 };

      const room = rm.createRoom(ws0, { deckKey: 'luna_guardians', playerName: 'P1' });
      rm.joinRoom(ws1, { roomCode: room.code, deckKey: 'mecha_scrap', playerName: 'P2' });

      // ผู้เล่นส่งคำสั่ง Mulligan Keep (pass)
      rm.handleAction(ws0, { type: 'pass', player: 0 });

      // ทั้งสองฝ่ายต้องได้รับ stateUpdate
      const lastP0 = p0Messages[p0Messages.length - 1];
      const lastP1 = p1Messages[p1Messages.length - 1];

      assert.strictEqual(lastP0.type, 'stateUpdate');
      assert.strictEqual(lastP1.type, 'stateUpdate');
      assert.ok(lastP0.state);
      assert.ok(lastP1.state);
      rm.cleanupRoom(room.code);
    }
  },
  {
    name: 'NET-06 การยอมแพ้ (Surrender) ในระบบออนไลน์',
    run(assert) {
      const rm = new RoomManager();
      const p0Messages = [];
      const p1Messages = [];
      const ws0 = { send: (msg) => p0Messages.push(JSON.parse(msg)), readyState: 1 };
      const ws1 = { send: (msg) => p1Messages.push(JSON.parse(msg)), readyState: 1 };

      const room = rm.createRoom(ws0, { deckKey: 'luna_guardians', playerName: 'P1' });
      rm.joinRoom(ws1, { roomCode: room.code, deckKey: 'mecha_scrap', playerName: 'P2' });

      // P0 กดยอมแพ้
      rm.handleSurrender(ws0);

      assert.strictEqual(room.state.ended, true);
      assert.strictEqual(room.state.winner, 1);
      assert.strictEqual(room.state.endReason, 'surrender');
      rm.cleanupRoom(room.code);
    }
  },
  {
    name: 'NET-07 การเลือกการ์ดจากเอฟเฟกต์ (Effect Selection / chooseCards) ในโหมดออนไลน์ต้องสำเร็จ',
    run(assert) {
      const rm = new RoomManager();
      const p0Messages = [];
      const p1Messages = [];
      const ws0 = { send: (msg) => p0Messages.push(JSON.parse(msg)), readyState: 1 };
      const ws1 = { send: (msg) => p1Messages.push(JSON.parse(msg)), readyState: 1 };

      const room = rm.createRoom(ws0, { deckKey: 'mecha_strike', playerName: 'P1', firstPlayer: 0 });
      rm.joinRoom(ws1, { roomCode: room.code, deckKey: 'mecha_strike', playerName: 'P2' });

      // ข้ามมัลลิแกนทั้งคู่
      rm.handleAction(ws0, { type: 'pass', player: 0 });
      rm.handleAction(ws1, { type: 'pass', player: 1 });

      // จำลองสถานะเลือกการ์ด (เช่น mecha_falcon ลงสนามค้นหาการ์ดเลเวล 1 จากเด็ค)
      room.state.players[0].hand[0] = { uid: 999, cardId: 'mecha_falcon', level: 1, baseAtk: 900, baseDef: 600, faceDown: false };
      room.state.players[0].mana = 5;

      // P0 อัญเชิญ mecha_falcon
      rm.handleAction(ws0, { type: 'normalSummon', player: 0, handIdx: 0, slot: 0 });

      // ต้องเกิด pending chooseCards
      assert.ok(room.state.pending, 'ต้องมี pending เลือกการ์ด');
      assert.strictEqual(room.state.pending.kind, 'chooseCards');

      // P0 เลือกการ์ดใบที่ 0 (choice: [0])
      rm.handleAction(ws0, { type: 'respond', player: 0, choice: [0] });

      // การกระทำต้องไม่ถูกปฏิเสธ (ไม่มี actionRejected)
      const lastP0 = p0Messages[p0Messages.length - 1];
      assert.strictEqual(lastP0.type, 'stateUpdate', 'ต้องได้รับ stateUpdate ไม่ใช่ actionRejected');
      assert.strictEqual(room.state.pending, null, 'pending ต้องถูกเคลียร์สำเร็จ');
      rm.cleanupRoom(room.code);
    }
  },
  {
    name: 'NET-08 ระบบสุ่มจับคู่ (Quick Match): ผู้เล่นคนแรกเข้าคิวรอ และผู้เล่นคนที่สองจับคู่ทันทีเริ่มเกม',
    run(assert) {
      const rm = new RoomManager();
      const p0Messages = [];
      const p1Messages = [];
      const ws0 = { send: (msg) => p0Messages.push(JSON.parse(msg)), readyState: 1 };
      const ws1 = { send: (msg) => p1Messages.push(JSON.parse(msg)), readyState: 1 };

      // P0 กดสุ่มจับคู่
      rm.queueQuickMatch(ws0, { deckKey: 'luna_guardians', playerName: 'DuelistA' });
      assert.strictEqual(rm.matchQueue.length, 1);
      assert.strictEqual(p0Messages[0].type, 'quickMatchWaiting');

      // P1 กดสุ่มจับคู่ -> ระบบต้องจับคู่กับ P0 ทันที
      rm.queueQuickMatch(ws1, { deckKey: 'mecha_scrap', playerName: 'DuelistB' });
      assert.strictEqual(rm.matchQueue.length, 0, 'คิวต้องว่างเพราะจับคู่สำเร็จแล้ว');

      // ทั้งสองฝ่ายต้องได้รับ gameStart
      const gameStartP0 = p0Messages.find(m => m.type === 'gameStart');
      const gameStartP1 = p1Messages.find(m => m.type === 'gameStart');

      assert.ok(gameStartP0, 'P0 ต้องได้รับ gameStart');
      assert.ok(gameStartP1, 'P1 ต้องได้รับ gameStart');
      assert.strictEqual(gameStartP0.playerIndex, 0);
      assert.strictEqual(gameStartP1.playerIndex, 1);
      assert.strictEqual(gameStartP0.opponentName, 'DuelistB');
      assert.strictEqual(gameStartP1.opponentName, 'DuelistA');

      rm.cleanupRoom(gameStartP0.roomCode);
    }
  },
  {
    name: 'NET-09 ระบบสุ่มจับคู่: การยกเลิกค้นหาและการตัดการเชื่อมต่อออกจากคิว',
    run(assert) {
      const rm = new RoomManager();
      const p0Messages = [];
      const ws0 = { send: (msg) => p0Messages.push(JSON.parse(msg)), readyState: 1 };

      // เข้าคิว
      rm.queueQuickMatch(ws0, { deckKey: 'luna_guardians', playerName: 'DuelistA' });
      assert.strictEqual(rm.matchQueue.length, 1);

      // กดยกเลิก
      rm.cancelQuickMatch(ws0);
      assert.strictEqual(rm.matchQueue.length, 0);
      assert.strictEqual(p0Messages[p0Messages.length - 1].type, 'quickMatchCancelled');

      // เข้าคิวอีกครั้งแล้วตัดการเชื่อมต่อ
      rm.queueQuickMatch(ws0, { deckKey: 'luna_guardians', playerName: 'DuelistA' });
      assert.strictEqual(rm.matchQueue.length, 1);
      rm.handleDisconnect(ws0);
      assert.strictEqual(rm.matchQueue.length, 0, 'เมื่อ disconnect ต้องหลุดออกจากคิว');
    }
  },
  {
    name: 'NET-10 สุ่มผู้เล่นเริ่มก่อน (Random First Player) ในการสร้างห้องออนไลน์',
    run(assert) {
      const rm = new RoomManager();
      const p0Messages = [];
      const p1Messages = [];
      const ws0 = { send: (msg) => p0Messages.push(JSON.parse(msg)), readyState: 1 };
      const ws1 = { send: (msg) => p1Messages.push(JSON.parse(msg)), readyState: 1 };

      const room = rm.createRoom(ws0, { deckKey: 'luna_guardians', playerName: 'P1' });
      rm.joinRoom(ws1, { roomCode: room.code, deckKey: 'mecha_scrap', playerName: 'P2' });

      const gs0 = p0Messages.find(m => m.type === 'gameStart');
      const gs1 = p1Messages.find(m => m.type === 'gameStart');

      assert.ok(gs0 && gs1);
      assert.ok([0, 1].includes(gs0.firstPlayer), 'firstPlayer ต้องเป็น 0 หรือ 1');
      assert.strictEqual(gs0.firstPlayer, gs1.firstPlayer, 'ผู้เล่นทั้งสองฝั่งต้องได้รับ firstPlayer ตรงกัน');
      assert.strictEqual(room.state.activeIdx, gs0.firstPlayer, 'activeIdx ของห้องต้องตรงกับ firstPlayer');
      rm.cleanupRoom(room.code);
    }
  }
];

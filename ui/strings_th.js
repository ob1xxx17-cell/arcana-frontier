// ui/strings_th.js - ข้อความไทยทั้งหมดของ UI (CONTRACT ข้อ 12) เปลี่ยนชื่อเรียกได้ที่นี่ที่เดียว
(function () {
  const CG = (globalThis.CG = globalThis.CG || {});
  CG.ui = CG.ui || {};
  CG.ui.strings = {
    // ชื่อเรียกที่ยังไม่ตัดสิน (ข้อ 16) แก้ที่นี่ที่เดียว
    term: { lp: 'LP', spell: 'สเปล', grade4: 'Grade 4', fusion: 'Fusion', mana: 'มานา', monster: 'มอนสเตอร์', extra: 'Extra' },
    app: {
      title: 'เกมการ์ด (ต้นแบบ)', subtitle: 'เลือกโหมดและเด็ค แล้วเริ่มดวล',
      modeBot: '🤖 ซ้อมกับบอท', modePvp: '👥 2 ผู้เล่น (ส่งเครื่องกัน)',
      p1: 'ผู้เล่น 1', p2: 'ผู้เล่น 2', bot: 'บอท', start: '⚔️ เริ่มดวล', back: '↩ กลับล็อบบี้',
      seed: 'seed', turn: 'เทิร์น', yourTurn: 'เทิร์นของคุณ', oppTurn: 'เทิร์นฝ่ายตรงข้าม', botThinking: 'บอทกำลังคิด…',
      nextPhase: 'เฟสถัดไป ▶', endTurn: 'จบเทิร์น ⏭', cancel: 'ยกเลิก', confirm: 'ยืนยัน', close: 'ปิด',
      hand: 'มือ', deck: 'เด็ค', grave: 'สุสาน', removed: 'นอกเกม', extraDeck: 'Extra Deck', empty: '(ว่าง)',
      leaderSlot: 'ช่องผู้นำ', fieldSpell: 'สนาม',
      handoff: 'ส่งเครื่องให้', handoffReady: 'พร้อมแล้ว แสดงมือ', cardBack: 'การ์ดคว่ำ',
      mulliganTitle: 'Mulligan', mulliganHint: 'แตะการ์ดที่ต้องการเปลี่ยน แล้วกด "เปลี่ยนที่เลือก" หรือกด "เปลี่ยนทั้งมือ" ทำได้ครั้งเดียว',
      mulliganSwapSel: 'เปลี่ยนที่เลือก', mulliganSwapAll: 'เปลี่ยนทั้งมือ', mulliganKeep: 'เก็บมือนี้',
      waitOther: 'รอฝ่ายตรงข้ามตัดสินใจ…',
      discardTitle: 'มือเกินกำหนด', discardHint: 'เลือกการ์ดที่จะทิ้ง (ไปอยู่นอกเกม) ให้ครบ',
      selectedN: 'เลือกแล้ว', ofN: 'จาก',
      summon: 'อัญเชิญ', setMon: 'Set คว่ำ', tribute: 'เสียสละ', flip: 'พลิกหงาย', changePos: 'เปลี่ยนท่า', attack: 'โจมตี', attackDirect: 'โจมตีตรง',
      pickSlot: 'เลือกช่องมอนสเตอร์ที่จะลง', pickMats: 'เลือกมอนสเตอร์ของคุณที่จะเสียสละ แล้วกด "ยืนยันวัสดุ"', confirmMats: 'ยืนยันวัสดุ',
      pickTarget: 'เลือกเป้าหมายที่จะโจมตี', notUsable: 'ยังใช้ไม่ได้ (เอฟเฟกต์/สเปล รอขั้น 4-6)',
      gameOver: 'จบเกม', winner: 'ผู้ชนะ', drawGame: 'เสมอ', playAgain: '🔁 เล่นอีกครั้ง',
      logTitle: 'บันทึกเกม', inspect: 'รายละเอียดการ์ด', inspectHint: 'แตะการ์ดเพื่อดูรายละเอียด',
      lvl: 'Lv', atk: 'ATK', def: 'DEF', manaCost: 'มานา', count: 'ใบ', you: 'คุณ', opp: 'ฝ่ายตรงข้าม'
    },
    phase: { mulligan: 'Mulligan', draw: 'จั่ว', standby: 'สแตนด์บาย', main1: 'เมน 1', battle: 'ต่อสู้', main2: 'เมน 2', end: 'จบเทิร์น' },
    type: { monster: 'มอนสเตอร์', spell: 'สเปล', fusion: 'Fusion', grade4: 'Grade 4' },
    spellGroup: { normal: 'ปกติ', set: 'หมอบรอ', counter: 'สวนกลับ' },
    position: { atk: 'ท่าโจมตี', def: 'ท่าป้องกัน' },
    how: { normal: 'อัญเชิญ', set: 'Set คว่ำ', tribute: 'อัญเชิญด้วยการเสียสละ', flip: 'พลิกหงาย', special: 'อัญเชิญพิเศษ', overlay: 'วางทับ' },
    reason: { battle: 'การต่อสู้', effect: 'เอฟเฟกต์', rule: 'กติกา', draw: 'จั่ว', cost: 'จ่ายค่า' },
    errors: {
      NOT_YOUR_TURN: 'ยังไม่ใช่เทิร์นของคุณ', WRONG_PHASE: 'ทำสิ่งนี้ในเฟสนี้ไม่ได้', GAME_ENDED: 'เกมจบแล้ว',
      MATERIAL_LEVEL_EQUAL: 'วัสดุมี Level เท่ากับตัวที่เรียก ใช้ไม่ได้', MATERIAL_LEVEL_SUM: 'Level วัสดุรวมกันไม่ตรงกติกา (Lv2 = 1+1, Lv3 = 1+2 หรือ 1+1+1)',
      MATERIAL_INVALID: 'วัสดุที่เลือกไม่ถูกต้อง', SLOT_FULL: 'ช่องนี้มีมอนสเตอร์อยู่แล้ว', INVALID_SLOT: 'ช่องไม่ถูกต้อง',
      NOT_ENOUGH_MANA: 'มานาไม่พอ', NORMAL_SUMMON_USED: 'เทิร์นนี้อัญเชิญปกติไปแล้ว', TRIBUTE_SUMMON_USED: 'เทิร์นนี้อัญเชิญแบบเสียสละไปแล้ว',
      LEVEL_NOT_1: 'อัญเชิญปกติ/Set ได้เฉพาะ Lv1 (Lv2-3 ต้องเสียสละ)', LEVEL_NOT_TRIBUTE: 'การ์ดใบนี้ไม่ใช่ Lv2-3 เสียสละไม่ได้',
      NOT_A_MONSTER: 'การ์ดใบนี้ไม่ใช่มอนสเตอร์', INVALID_HAND_INDEX: 'ไม่พบการ์ดในมือ', NO_MONSTER: 'ช่องนี้ไม่มีมอนสเตอร์',
      NOT_FACE_DOWN: 'มอนสเตอร์ตัวนี้ไม่ได้คว่ำอยู่', USE_FLIP_SUMMON: 'ตัวที่คว่ำอยู่ต้องใช้ "พลิกหงาย"', SET_THIS_TURN: 'เพิ่ง Set ในเทิร์นนี้ พลิกหรือเปลี่ยนท่าไม่ได้',
      SUMMONED_THIS_TURN: 'เพิ่งอัญเชิญในเทิร์นนี้', POSITION_ALREADY_CHANGED: 'เทิร์นนี้เปลี่ยนท่าตัวนี้ไปแล้ว',
      FIRST_TURN_NO_ATTACK: 'เทิร์นแรกของเกมโจมตีไม่ได้', ALREADY_ATTACKED: 'ตัวนี้โจมตีไปแล้วในเทิร์นนี้', CANNOT_ATTACK: 'ตัวนี้โจมตีไม่ได้',
      NOT_ATTACK_POSITION: 'ต้องอยู่ท่าโจมตี (หงาย) จึงจะโจมตีได้', INVALID_TARGET: 'เป้าหมายไม่ถูกต้อง', MUST_ATTACK_MONSTER: 'ฝ่ายตรงข้ามมีมอนสเตอร์ โจมตีตรงไม่ได้',
      ATTACK_IN_PROGRESS: 'กำลังอยู่ระหว่างการโจมตี', GRADE4_LIMIT: 'เทิร์นนี้เรียก Grade 4 ไปแล้ว',
      MULLIGAN_USED: 'Mulligan ได้ครั้งเดียว', INVALID_CHOICE: 'ตัวเลือกไม่ถูกต้อง', PENDING_UNRESOLVED: 'ต้องตอบคำถามที่ค้างอยู่ก่อน',
      NO_PENDING: 'ไม่มีคำถามให้ตอบ', NO_WINDOW: 'ตอนนี้ไม่มีหน้าต่างตอบโต้', NOT_IMPLEMENTED: 'ยังไม่เปิดใช้ (เอฟเฟกต์/สเปล รอขั้น 4-6)',
      NOT_IN_ZONE: 'การ์ดไม่ได้อยู่ในโซนที่ต้องการ', UNKNOWN_ACTION: 'คำสั่งไม่รู้จัก', INVALID_PLAYER: 'ผู้เล่นไม่ถูกต้อง', WRONG_STATE: 'สถานะไม่ถูกต้อง'
    },
    errorUnknown: 'คำสั่งถูกปฏิเสธ',
    prompts: { DISCARD_EXCESS: 'มือเกินกำหนด เลือกการ์ดที่จะทิ้ง', chainWindow: 'หน้าต่างตอบโต้', unknown: 'ต้องการให้คุณเลือก' },
    chain: { pass: 'ไม่ตอบโต้', yes: 'ใช่', no: 'ไม่ใช่' },
    ev: {
      draw: '{p} จั่วการ์ด', drawKnown: '{p} จั่ว {c}', manaChange: '{p} {mana} {d} ({r})',
      summon: '{p} {how} {c} ที่ช่อง {s}', summonHidden: '{p} {how} มอนสเตอร์ ที่ช่อง {s}',
      moveCard: '{c}: {from} → {to}', positionChange: '{c} เป็น{pos}', attackDeclared: '{p} ประกาศโจมตี: ช่อง {from} → {to}',
      attackDirect: 'โจมตีตรง', destroy: '{c} ถูกทำลาย ({r})', lpChange: '{p} {lp} {d} ({r})', statChange: '{c} {stat} {d}',
      phaseChange: 'เฟส: {ph}', turnStart: '── เทิร์น {t}: {p} ──', gameEnd: 'จบเกม: {w} ({r})',
      chainAdd: 'ลิงก์ใหม่ใน Chain', chainResolve: 'แก้ผล Chain', rejected: 'ถูกปฏิเสธ: {code}'
    },
    zone: { deck: 'เด็ค', hand: 'มือ', monster: 'สนาม', spell: 'สเปล', grave: 'สุสาน', removed: 'นอกเกม', extra: 'Extra Deck' },
    endReason: { lp: 'LP หมด', tiebreak: 'เกินเทิร์นที่กำหนดและเด็คหมด ตัดสินจากการ์ดบนสนาม', deckout: 'เด็คหมด' }
  };
})();

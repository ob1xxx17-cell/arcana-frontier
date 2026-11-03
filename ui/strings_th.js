// ui/strings_th.js - ข้อความไทยทั้งหมดของ UI (CONTRACT ข้อ 12) เปลี่ยนชื่อเรียกได้ที่นี่ที่เดียว
(function () {
  const CG = (globalThis.CG = globalThis.CG || {});
  CG.ui = CG.ui || {};
  CG.ui.strings = {
    // ชื่อเรียกตามข้อ 12-ก ของ CONTRACT
    term: {
      lp: 'FP (Frontier Point)',
      spell: 'Distortion (ดิสทอร์ชัน)',
      grade4: 'Apex (เอเปกซ์)',
      fusion: 'Resonance (เรโซแนนซ์)',
      mana: 'Arcana (อาร์คานา)',
      monster: 'Entity (เอนทิตี)',
      extra: 'Astral Gate (แอสทรัลเกต)'
    },
    app: {
      title: 'เกมการ์ด (ต้นแบบ)', subtitle: 'เลือกโหมดและเด็ค แล้วเริ่มดวล',
      modeBot: '🤖 ซ้อมกับบอท', modePvp: '👥 2 ผู้เล่น (ส่งเครื่องกัน)',
      p1: 'ผู้เล่น 1', p2: 'ผู้เล่น 2', bot: 'บอท', start: '⚔️ เริ่มดวล', back: '↩ กลับล็อบบี้',
      seed: 'seed', turn: 'เทิร์น', yourTurn: 'เทิร์นของคุณ', oppTurn: 'เทิร์นฝ่ายตรงข้าม', botThinking: 'บอทกำลังคิด…',
      nextPhase: 'เฟสถัดไป ▶', endTurn: 'จบเทิร์น ⏭', cancel: 'ยกเลิก', confirm: 'ยืนยัน', close: 'ปิด',
      hand: 'มือ', deck: 'Chronicle (โครนิเคิล)', grave: 'Abyss (อะบิส)', removed: 'Exile (เอ็กไซล์)', extraDeck: 'Astral Gate (แอสทรัลเกต)', empty: '(ว่าง)',
      leaderSlot: 'Pioneer (ไพโอเนียร์)', fieldSpell: 'สนาม',
      slotEntity: 'ENTITY', slotDistortion: 'DISTORTION', slotPioneer: 'PIONEER',
      goToBattle: 'ไปเฟสต่อสู้', nextPhasePrefix: 'ไปเฟสถัดไป',
      handoff: 'ส่งเครื่องให้', handoffReady: 'พร้อมแล้ว แสดงมือ', cardBack: 'การ์ดคว่ำ',
      mulliganTitle: 'Mulligan', mulliganHint: 'แตะการ์ดที่ต้องการเปลี่ยน แล้วกด "เปลี่ยนที่เลือก" หรือกด "เปลี่ยนทั้งมือ" ทำได้ครั้งเดียว',
      mulliganSwapSel: 'เปลี่ยนที่เลือก', mulliganSwapAll: 'เปลี่ยนทั้งมือ', mulliganKeep: 'เก็บมือนี้',
      waitOther: 'รอฝ่ายตรงข้ามตัดสินใจ…',
      discardTitle: 'มือเกินกำหนด', discardHint: 'เลือกการ์ดที่จะทิ้ง (ไปอยู่ Exile) ให้ครบ',
      selectedN: 'เลือกแล้ว', ofN: 'จาก',
      summon: 'ตั้งโจมตี', setMon: 'ตั้งป้องกัน', tribute: 'เสียสละ', flip: 'พลิกหงาย', changePos: 'เปลี่ยนท่า', attack: 'โจมตี', attackDirect: 'โจมตีตรง',
      overlay: 'Eclipse', extraSummon: 'อัญเชิญ Astral Gate', pickOverlayTarget: 'เลือก Entity ที่จะทำ Eclipse (วางทับ)', pickExtraSlot: 'เลือกช่องที่จะลง Astral Gate',
      pickSlot: 'เลือกช่อง Entity ที่จะลง', pickMats: 'เลือก Entity ของคุณที่จะเสียสละ แล้วกด "ยืนยันวัสดุ"', confirmMats: 'ยืนยันวัสดุ',
      pickTarget: 'เลือกเป้าหมายที่จะโจมตี',
      activateSpell: 'ใช้ Distortion', activateField: 'ร่ายเวทสนาม', setSpell: 'หมอบ Distortion', activateEffect: 'ใช้เอฟเฟกต์', activateSpellSlot: 'เปิดใช้ Distortion', pickSpellSlot: 'เลือกช่อง Distortion ที่จะวางคว่ำ',
      botPlaying: 'บอทกำลังเล่น…',
      speed: {
        title: 'ความเร็วแอนิเมชันและบอท',
        slow: '🐢 สโลว์โมชัน (ใจเย็น)',
        normal: '⏱ ปกติ (ชัดเจน สบายตา)',
        fast: '⚡ รวดเร็ว',
        label: 'ความเร็ว'
      },
      difficulty: {
        title: 'ความยากบอท',
        easy: '🌱 ง่าย',
        normal: '⚔️ ปกติ',
        hard: '🔥 ปรมาจารย์ (Hard)',
        label: 'ความยาก'
      },
      banner: {
        botActPrefix: 'บอท:',
        summon: 'บอท {how} {c} ที่ช่อง {s}',
        summonHidden: 'บอท {how} Entity ที่ช่อง {s}',
        attack: 'บอท โจมตี: ช่อง {from} → {to}',
        actSpell: 'บอท ใช้ Distortion {c}',
        setSpell: 'บอท หมอบ Distortion ที่ช่อง {s}',
        actEffect: 'บอท ใช้เอฟเฟกต์ {c}',
        phaseChange: 'บอท เปลี่ยนเฟสเป็น {ph}',
        endTurn: 'บอท จบเทิร์น',
        chainResp: 'บอท ตอบโต้ใน Chain: {c}'
      },
      gameOver: 'จบเกม', winner: 'ผู้ชนะ', drawGame: 'เสมอ', playAgain: '🔁 เล่นอีกครั้ง',
      logTitle: 'บันทึกเกม', inspect: 'รายละเอียดการ์ด', inspectHint: 'แตะการ์ดเพื่อดูรายละเอียด',
      lvl: 'Lv', atk: 'ATK', def: 'DEF', manaCost: 'Arcana (อาร์คานา)', count: 'ใบ', you: 'คุณ', opp: 'ฝ่ายตรงข้าม'
    },
    phase: { mulligan: 'Mulligan', draw: 'จั่ว', standby: 'สแตนด์บาย', main1: 'เมน 1', battle: 'ต่อสู้', main2: 'เมน 2', end: 'จบเทิร์น' },
    type: { monster: 'Entity (เอนทิตี)', spell: 'Distortion (ดิสทอร์ชัน)', fusion: 'Resonance (เรโซแนนซ์)', grade4: 'Apex (เอเปกซ์)' },
    spellGroup: { normal: 'ปกติ', set: 'หมอบรอ', counter: 'สวนกลับ', continuous: 'ต่อเนื่อง', field: 'สนาม' },
    effectType: {
      ignition: 'เปิดใช้เอง (Ignition)',
      continuous: 'ต่อเนื่อง (Continuous)',
      trigger: 'เมื่อเกิดเงื่อนไข (Trigger)',
      quick: 'ฉับพลัน (Quick)',
      overlay: 'วางทับ (Eclipse)',
      onSummon: 'เมื่ออัญเชิญ',
      onSentToGrave: 'เมื่อลงสุสาน',
      onBattleDestroyed: 'เมื่อถูกทำลายในต่อสู้',
      onAttacked: 'เมื่อถูกโจมตี',
      watcher: 'เฝ้ามอง (Watcher)'
    },
    position: { atk: 'ท่าโจมตี', def: 'ท่าป้องกัน' },
    how: { normal: 'อัญเชิญ', set: 'Set คว่ำ', tribute: 'อัญเชิญด้วยการเสียสละ', flip: 'พลิกหงาย', special: 'อัญเชิญพิเศษ', overlay: 'Eclipse (วางทับ)', extra: 'อัญเชิญ Astral Gate', fusion: 'อัญเชิญ Resonance (ฟิวชั่น)' },
    reason: { battle: 'การต่อสู้', effect: 'เอฟเฟกต์', rule: 'กติกา', draw: 'จั่ว', cost: 'จ่ายค่า' },
    errors: {
      NOT_YOUR_TURN: 'ยังไม่ใช่เทิร์นของคุณ', WRONG_PHASE: 'ทำสิ่งนี้ในเฟสนี้ไม่ได้', GAME_ENDED: 'เกมจบแล้ว',
      MATERIAL_LEVEL_EQUAL: 'วัสดุมี Level เท่ากับตัวที่เรียก ใช้ไม่ได้', MATERIAL_LEVEL_SUM: 'Level วัสดุรวมกันไม่ตรงกติกา (Lv2 = 1+1, Lv3 = 1+2 หรือ 1+1+1)',
      MATERIAL_INVALID: 'วัสดุที่เลือกไม่ถูกต้อง', SLOT_FULL: 'ช่องนี้มี Entity อยู่แล้ว', INVALID_SLOT: 'ช่องไม่ถูกต้อง',
      NOT_ENOUGH_MANA: 'Arcana ไม่พอ', NORMAL_SUMMON_USED: 'เทิร์นนี้อัญเชิญปกติไปแล้ว', TRIBUTE_SUMMON_USED: 'เทิร์นนี้อัญเชิญแบบเสียสละไปแล้ว',
      LEVEL_NOT_1: 'อัญเชิญปกติ/Set ได้เฉพาะ Lv1 (Lv2-3 ต้องเสียสละ)', LEVEL_NOT_TRIBUTE: 'การ์ดใบนี้ไม่ใช่ Lv2-3 เสียสละไม่ได้',
      NOT_A_MONSTER: 'การ์ดใบนี้ไม่ใช่ Entity', INVALID_HAND_INDEX: 'ไม่พบการ์ดในมือ', NO_MONSTER: 'ช่องนี้ไม่มี Entity',
      NOT_FACE_DOWN: 'Entity ตัวนี้ไม่ได้คว่ำอยู่', USE_FLIP_SUMMON: 'ตัวที่คว่ำอยู่ต้องใช้ "พลิกหงาย"', SET_THIS_TURN: 'เพิ่ง Set ในเทิร์นนี้ พลิกหรือเปลี่ยนท่าไม่ได้',
      SUMMONED_THIS_TURN: 'เพิ่งอัญเชิญในเทิร์นนี้', POSITION_ALREADY_CHANGED: 'เทิร์นนี้เปลี่ยนท่าตัวนี้ไปแล้ว',
      FIRST_TURN_NO_ATTACK: 'เทิร์นแรกของเกมโจมตีไม่ได้', ALREADY_ATTACKED: 'ตัวนี้โจมตีไปแล้วในเทิร์นนี้', CANNOT_ATTACK: 'ตัวนี้โจมตีไม่ได้',
      NOT_ATTACK_POSITION: 'ต้องอยู่ท่าโจมตี (หงาย) จึงจะโจมตีได้', INVALID_TARGET: 'เป้าหมายไม่ถูกต้อง', MUST_ATTACK_MONSTER: 'ฝ่ายตรงข้ามมี Entity โจมตีตรงไม่ได้',
      ATTACK_IN_PROGRESS: 'กำลังอยู่ระหว่างการโจมตี', GRADE4_LIMIT: 'เทิร์นนี้เรียก Apex ไปแล้ว',
      MULLIGAN_USED: 'Mulligan ได้ครั้งเดียว', INVALID_CHOICE: 'ตัวเลือกไม่ถูกต้อง', PENDING_UNRESOLVED: 'ต้องตอบคำถามที่ค้างอยู่ก่อน',
      NO_PENDING: 'ไม่มีคำถามให้ตอบ', NO_WINDOW: 'ตอนนี้ไม่มีหน้าต่างตอบโต้', NOT_IMPLEMENTED: 'ยังไม่เปิดใช้ (เอฟเฟกต์/Distortion รอขั้น 4-6)',
      NOT_IN_ZONE: 'การ์ดไม่ได้อยู่ในโซนที่ต้องการ', UNKNOWN_ACTION: 'คำสั่งไม่รู้จัก', INVALID_PLAYER: 'ผู้เล่นไม่ถูกต้อง', WRONG_STATE: 'สถานะไม่ถูกต้อง',
      CONDITION_FAILED: 'เงื่อนไขการใช้ไม่ครบถ้วน (ไม่มีเป้าหมายที่ถูกต้อง)', NO_TARGET_IN_GRAVE: 'ไม่มีการ์ดเป้าหมายในสุสาน',
      CANNOT_SET_FIELD: 'เวทสนามต้องร่ายลงช่องสนามโดยตรง หมอบในช่องสเปลไม่ได้',
      CANNOT_CHANGE_POSITION: 'มอนสเตอร์ตัวนี้ไม่สามารถเปลี่ยนท่าต่อสู้ได้ในตอนนี้ (ติดสถานะ)',
      EFFECT_NEGATED: 'เอฟเฟกต์ของการ์ดใบนี้ถูกลบล้าง (ถูกใบ้/Silence)'
    },
    errorUnknown: 'คำสั่งถูกปฏิเสธ',
    prompts: {
      DISCARD_EXCESS: 'มือเกินกำหนด เลือกการ์ดที่จะทิ้ง',
      chainWindow: 'หน้าต่างตอบโต้',
      CHAIN_WINDOW: 'หน้าต่างตอบโต้',
      PRIORITY_WINDOW: 'หน้าต่างตอบโต้',
      CHOOSE_TARGET: 'เลือกเป้าหมาย',
      CHOOSE_CARDS: 'เลือกการ์ด',
      CHOOSE_OPTION: 'เลือกตัวเลือก',
      CHOOSE_FUSION_MONSTER: '🌀 เลือกมอนสเตอร์ Fusion ที่จะอัญเชิญ',
      CHOOSE_FUSION_MATERIALS: '🌀 เลือกวัตถุดิบสำหรับฟิวชั่น',
      CHOOSE_FUSION_SLOT: '🌀 เลือกช่องสำหรับวางมอนสเตอร์ฟิวชั่น',
      CHOOSE_SUMMON_POSITION: '⚔️ เลือกรูปแบบการลงสนาม (ตั้งโจมตี หรือ ตั้งป้องกัน)',
      CHOOSE_SLOT: '🌀 เลือกช่องสำหรับวางมอนสเตอร์',
      unknown: 'ต้องการให้คุณเลือก'
    },
    chain: {
      pass: 'ผ่าน (ไม่ตอบโต้)',
      yes: 'ใช่',
      no: 'ไม่ใช่',
      title: 'โซ่เอฟเฟกต์',
      link: 'ลิงก์',
      priority: 'สิทธิ์ตอบโต้ของ',
      use: 'ใช้',
      activateSet: 'เปิดใช้'
    },
    pending: {
      selectCount: 'เลือก {min} ถึง {max} รายการ',
      selected: 'เลือกแล้ว {n} จาก {max}',
      slotPrompt: 'เลือกช่อง',
      atkLabel: 'ATK',
      defLabel: 'DEF',
      lvLabel: 'Lv',
      zoneLabel: { monster: 'สนาม', hand: 'มือ', grave: 'Abyss (สุสาน)', deck: 'Chronicle (เด็ค)', extra: 'Astral Gate (Extra)', removed: 'Exile (นอกเกม)' },
      sideLabel: { self: 'ฝ่ายเรา', opp: 'ฝ่ายตรงข้าม' }
    },
    ev: {
      draw: '{p} จั่วการ์ด', drawKnown: '{p} จั่ว {c}', manaChange: '{p} {mana} {d} ({r})',
      summon: '{p} {how} {c} ที่ช่อง {s}', summonHidden: '{p} {how} Entity ที่ช่อง {s}',
      moveCard: '{c}: {from} → {to}', positionChange: '{c} เป็น{pos}', attackDeclared: '{p} ประกาศโจมตี: ช่อง {from} → {to}',
      attackDirect: 'โจมตีตรง', destroy: '{c} ถูกทำลาย ({r})', lpChange: '{p} {lp} {d} ({r})', statChange: '{c} {stat} {d}',
      phaseChange: 'เฟส: {ph}', turnStart: '── เทิร์น {t}: {p} ──', gameEnd: 'จบเกม: {w} ({r})',
      chainAdd: 'ลิงก์ใหม่ใน Chain', chainResolve: 'แก้ผล Chain', rejected: 'ถูกปฏิเสธ: {code}'
    },
    zone: { deck: 'Chronicle (โครนิเคิล)', hand: 'มือ', monster: 'สนาม', spell: 'Distortion (ดิสทอร์ชัน)', field: 'ช่องสนาม', grave: 'Abyss (อะบิส)', removed: 'Exile (เอ็กไซล์)', extra: 'Astral Gate (แอสทรัลเกต)' },
    endReason: { lp: 'FP หมด', tiebreak: 'เกินเทิร์นที่กำหนดและ Chronicle หมด ตัดสินจากการ์ดบนสนาม', deckout: 'Chronicle หมด' }
  };
})();

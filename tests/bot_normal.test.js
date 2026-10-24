// tests/bot_normal.test.js - 7B: เทสต์บอทระดับ normal (deterministic heuristics)
const assert = require('assert');

const t = (name, fn) => tests.push({ name, run: fn });
const tests = module.exports = [];

const E = () => CG.engine;
const make = (opts) => CG.test.makeGame(Object.assign({
  deckA: 'aquila',
  deckB: 'dinosaur',
  seed: 1,
  config: { autoChoose: false, chainMode: true }
}, opts));

// 1. Pure function test: CG.bot.choose ไม่แก้ state
t('7B-0: CG.bot.choose (normal) เป็น Pure Function ไม่กลายพันธุ์ (mutate) state', assert => {
  const s = make({
    p0: { hand: ['aq_spear', 'aq_armory'], mana: 5 },
    p1: { monsters: { 2: 'dino_trex' }, lp: 4000 },
    phase: 'main1', turn: 3, activeIdx: 0
  });

  function deepFreeze(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    Object.freeze(obj);
    Object.keys(obj).forEach(key => deepFreeze(obj[key]));
    return obj;
  }

  const legal = E().getLegalActions(s, 0);
  const beforeJson = JSON.stringify(s);
  const frozen = deepFreeze(JSON.parse(beforeJson));

  let action;
  assert.doesNotThrow(() => {
    action = CG.bot.choose(frozen, 0, legal, { level: 'normal' });
  }, 'บอท normal ต้องไม่แก้ state ที่ freeze');

  assert.strictEqual(JSON.stringify(s), beforeJson, 'state ต้องไม่เปลี่ยนรูปหลังเรียก bot.choose');
  assert.ok(action, 'ต้องได้ action กลับมา');
});

// 2. กรณีที่ 1: Lethal
t('7B-1: lethal - โจมตีตรงรวดเดียวเพื่อปิดเกมเมื่อพลังรวม >= LP ศัตรูและไม่มีเป้าขวาง', assert => {
  const s = make({
    p0: {
      monsters: {
        1: { cardId: 'aq_spear', position: 'atk' },
        2: { cardId: 'aq_tiro', position: 'atk' }
      }
    },
    p1: { monsters: {}, lp: 1500 },
    phase: 'battle', turn: 3, activeIdx: 0
  });
  // aq_spear ATK 1000, aq_tiro ATK 800 รวม 1800 >= 1500 LP และศัตรูไม่มีมอนสเตอร์
  const legal = E().getLegalActions(s, 0);
  const a = CG.bot.choose(s, 0, legal, { level: 'normal' });
  assert.strictEqual(a.type, 'attack', 'ต้องเลือกโจมตี');
  assert.strictEqual(a.to, null, 'ต้องเป็นการโจมตีตรง');
});

// 3. กรณีที่ 2: ไม่โจมตีเข้าตัวที่แรงกว่า
t('7B-2: ไม่โจมตีเข้าตัวที่แรงกว่า - ห้ามโจมตีเมื่อจะตายโดยไม่ได้ทำลายอะไร', assert => {
  const s = make({
    p0: { monsters: { 2: { cardId: 'aq_spear', position: 'atk' } } }, // ATK 1000
    p1: { monsters: { 2: { cardId: 'dino_trex', position: 'atk' } } },  // ATK 2200
    phase: 'battle', turn: 3, activeIdx: 0
  });
  const legal = E().getLegalActions(s, 0);
  const a = CG.bot.choose(s, 0, legal, { level: 'normal' });
  assert.notStrictEqual(a.type, 'attack', 'ต้องไม่โจมตีเข้าตัวที่ ATK สูงกว่า');
  assert.ok(a.type === 'advancePhase' || a.type === 'endTurn', 'ต้องข้ามเฟสหรือจบเทิร์น');
});

// 4. กรณีที่ 3: ทำลายตัวที่ ATK สูงสุด
t('7B-3: ทำลายตัวที่ ATK สูงสุด - เมื่อมีเอฟเฟกต์ทำลาย เลือกล็อกเป้าตัวศัตรูที่ ATK สูงสุด', assert => {
  const s = make({
    p0: { hand: ['aq_war'], mana: 3 },
    p1: {
      monsters: {
        1: { cardId: 'dino_small_raptor' }, // ATK 1000
        2: { cardId: 'dino_trex' }          // ATK 2200
      }
    },
    phase: 'main1', turn: 3, activeIdx: 0
  });
  // จำลองว่า pending ให้เลือกเป้าทำลายเปิดอยู่
  s.pending = {
    kind: 'chooseTarget',
    player: 0,
    prompt: 'DESTROY_TARGET',
    options: [
      { cardId: 'dino_small_raptor', side: 'opp', slot: 1 },
      { cardId: 'dino_trex', side: 'opp', slot: 2 }
    ],
    min: 1, max: 1,
    resume: { effectId: 'war_destroy' }
  };
  const legal = E().getLegalActions(s, 0);
  const a = CG.bot.choose(s, 0, legal, { level: 'normal' });
  assert.strictEqual(a.type, 'respond');
  assert.deepStrictEqual(a.choice, [1], 'ต้องเลือก index 1 ซึ่งคือ dino_trex ที่มี ATK สูงสุด (2200)');
});

// 5. กรณีที่ 4: เสียสละตัวต่ำสุด และไม่เสียสละถ้าตัวใหม่ไม่แรงกว่าอย่างน้อย 400
t('7B-4a: เสียสละตัวต่ำสุด - เลือกเสียสละตัว ATK ต่ำสุดก่อน', assert => {
  const s = make({
    deckA: 'dinosaur',
    deckB: 'aquila',
    p0: {
      hand: ['dino_trex'], // Lv3 ATK 2200
      monsters: {
        0: { cardId: 'dino_egg' },           // Lv1 ATK 0
        1: { cardId: 'dino_stego' },         // Lv2 ATK 1500
        2: { cardId: 'dino_hunter_raptor' }  // Lv2 ATK 1600
      },
      extra: [],
      mana: 3
    },
    p1: { monsters: {} },
    phase: 'main1', turn: 3, activeIdx: 0
  });
  // ตัวเลือกเรียก Lv3: [0, 1] รวม ATK 1500 หรือ [0, 2] รวม ATK 1600
  const legal = E().getLegalActions(s, 0);
  const a = CG.bot.choose(s, 0, legal, { level: 'normal' });
  assert.strictEqual(a.type, 'tributeSummon', 'ต้องเลือก tributeSummon');
  assert.deepStrictEqual(a.materials, [0, 1], 'ต้องเลือกเสียสละ [0, 1] (ATK รวม 1500) ซึ่งต่ำกว่า [0, 2] (ATK รวม 1600)');
});

t('7B-4b: ไม่เสียสละถ้าตัวที่จะเรียกไม่แรงกว่าตัวที่เสียสละอย่างน้อย 400', assert => {
  const s = make({
    p0: {
      hand: ['aq_gladiator'], // Lv2 ATK 1800
      monsters: {
        2: { cardId: 'aq_explorator' } // ATK 1500 (1800 - 1500 = 300 < 400)
      },
      extra: [],
      mana: 2
    },
    p1: { monsters: {} },
    phase: 'main1', turn: 3, activeIdx: 0
  });
  const legal = E().getLegalActions(s, 0);
  const a = CG.bot.choose(s, 0, legal, { level: 'normal' });
  assert.notStrictEqual(a.type, 'tributeSummon', 'ต้องไม่เสียสละเพราะพลังเพิ่มขึ้นเพียง 300 (< 400)');
});

// 6. กรณีที่ 5: ตอบโต้ด้วยสวนกลับเมื่อโดนทำลาย
t('7B-5: ตอบโต้ด้วยสวนกลับเมื่อโดนทำลาย - ลิงก์ศัตรูมุ่งทำลายมอนสเตอร์เรา', assert => {
  const s = make({
    p0: {
      monsters: { 2: 'aq_spear' },
      hand: ['aq_retreat'], // สเปลสวนกลับ speed 3
      mana: 2
    },
    p1: { monsters: { 2: 'dino_trex' } },
    phase: 'main1', turn: 4, activeIdx: 1
  });
  const targetUid = s.players[0].monsters[2].uid;
  // จำลองว่าศัตรูใช้สเปลทำลายโดยมีเป้าหมายที่ aq_spear ของเรา
  s.chain = [{
    linkId: 1,
    controller: 1,
    cardId: 'dino_extinct',
    targets: [targetUid],
    speed: 1
  }];
  s.pending = {
    kind: 'chainWindow',
    player: 0,
    prompt: 'CHAIN_WINDOW',
    options: [{ handIdx: 0, effectId: 'retreat_return' }]
  };
  const legal = E().getLegalActions(s, 0);
  const a = CG.bot.choose(s, 0, legal, { level: 'normal' });
  assert.strictEqual(a.type, 'activateResponse', 'ต้องเลือกตอบโต้ด้วย activateResponse');
});

// 7. กรณีที่ 6: ไม่ตอบเมื่อไม่กระทบ
t('7B-6: ไม่ตอบเมื่อไม่กระทบ - ศัตรูใช้สเปลจั่วการ์ดหรือค้นหาโดยไม่กระทบเรา', assert => {
  const s = make({
    p0: {
      monsters: { 2: 'aq_spear' },
      hand: ['aq_retreat'],
      mana: 2
    },
    p1: { monsters: {} },
    phase: 'main1', turn: 4, activeIdx: 1
  });
  // ศัตรูใช้ dino_dig (ขุดซากฟอสซิล / ค้นหาการ์ด)
  s.chain = [{
    linkId: 1,
    controller: 1,
    cardId: 'dino_dig',
    targets: [],
    speed: 1
  }];
  s.pending = {
    kind: 'chainWindow',
    player: 0,
    prompt: 'CHAIN_WINDOW',
    options: [{ handIdx: 0, effectId: 'retreat_return' }]
  };
  const legal = E().getLegalActions(s, 0);
  const a = CG.bot.choose(s, 0, legal, { level: 'normal' });
  assert.strictEqual(a.type, 'passPriority', 'ต้องเลือกผ่าน (passPriority) ไม่เปลืองการ์ดสวนกลับ');
});

// 8. กรณีที่ 7: ลงท่าป้องกันเมื่อสู้ไม่ได้
t('7B-7: ลงท่าป้องกันเมื่อสู้ไม่ได้ - ลงตัวเล็กที่ ATK น้อยกว่าตัวแรงสุดของศัตรู เลือก setMonster แทน normalSummon', assert => {
  const s = make({
    p0: {
      hand: ['aq_tiro'], // Lv1 ATK 800
      extra: [],
      mana: 1
    },
    p1: {
      monsters: { 2: { cardId: 'dino_trex', position: 'atk' } } // ATK 2200 > 800
    },
    phase: 'main1', turn: 3, activeIdx: 0
  });
  const legal = E().getLegalActions(s, 0);
  const a = CG.bot.choose(s, 0, legal, { level: 'normal' });
  assert.strictEqual(a.type, 'setMonster', 'ต้องเลือก setMonster ลงท่าป้องกันคว่ำ');
});

// 9. กรณีที่ 8: ไม่ใช้เอฟเฟกต์ไร้เป้า
t('7B-8: ไม่ใช้เอฟเฟกต์ไร้เป้า - ไม่ใช้สเปลทำลายศัตรูเมื่อศัตรูไม่มีมอนสเตอร์บนสนาม', assert => {
  const s = make({
    p0: {
      hand: ['aq_war', 'aq_spear'], // aq_war คือสเปลทำลายมอนสเตอร์ศัตรู 1 ตัว
      mana: 3
    },
    p1: {
      monsters: {} // ไม่มีมอนสเตอร์บนสนาม
    },
    phase: 'main1', turn: 3, activeIdx: 0
  });
  const legal = E().getLegalActions(s, 0);
  const a = CG.bot.choose(s, 0, legal, { level: 'normal' });
  assert.notStrictEqual(a.type, 'activateSpell', 'ต้องไม่ใช้สเปลทำลายมอนสเตอร์ศัตรูเมื่อศัตรูไม่มีมอนสเตอร์');
  assert.ok(a.type === 'normalSummon' || a.type === 'setMonster' || a.type === 'advancePhase', 'ต้องเลือกลงมอนสเตอร์หรือเปลี่ยนเฟสแทน');
});

// 10. กรณีที่ 9: hasFollowupOverlay พร้อมจริงเท่านั้น
t('7B-9: hasFollowupOverlay - แม้ Extra Deck มี Grade 4 (aq_dictator) แต่บนสนามไม่มีวัสดุรองรับ ต้องเลือก setMonster เมื่อ ATK สู้ไม่ได้', assert => {
  const s = make({
    deckA: 'aquila',
    deckB: 'dinosaur',
    p0: {
      hand: ['aq_tiro'], // Lv1 ATK 800
      monsters: {}, // สนามว่างเปล่า ไม่มีวัสดุรองรับ Dictator
      extra: ['aq_dictator'],
      mana: 2
    },
    p1: {
      monsters: { 2: { cardId: 'dino_trex', position: 'atk' } } // ATK 2200 > 800
    },
    phase: 'main1', turn: 3, activeIdx: 0
  });
  const legal = E().getLegalActions(s, 0);
  const a = CG.bot.choose(s, 0, legal, { level: 'normal' });
  assert.strictEqual(a.type, 'setMonster', 'ต้องเลือก setMonster ลงป้องกันคว่ำ เพราะไม่มีวัสดุรองรับ extraSummon บนสนามจริง');
});

// 11. กรณีที่ 10: minCounterCost ไม่กักมานาเมื่อ LP ตามหลัง และสเปลจั่ว/ค้นหาร่ายได้
t('7B-10: minCounterCost - เมื่อ LP ตามหลัง (me.lp < op.lp) หรือเป็นสเปลจั่ว/ค้นหา ต้องร่ายได้ไม่ถูกบล็อกด้วย minCounterCost', assert => {
  const s = make({
    deckA: 'aquila',
    deckB: 'dinosaur',
    p0: {
      hand: ['aq_recruit', 'aq_retreat'], // aq_recruit ค้นหา (มานา 2), aq_retreat สวนกลับ (มานา 2)
      monsters: { 1: { cardId: 'aq_spear', position: 'atk' } },
      mana: 2, // มี 2 มานา ถ้าหัก minCounterCost (2) จะเหลือ 0 ทำให้ร่ายไม่ได้
      lp: 3000 // ตามหลังศัตรู (3000 < 5000)
    },
    p1: {
      monsters: { 2: { cardId: 'dino_trex', position: 'atk' } },
      lp: 5000
    },
    phase: 'main1', turn: 3, activeIdx: 0
  });
  const legal = E().getLegalActions(s, 0);
  const a = CG.bot.choose(s, 0, legal, { level: 'normal' });
  assert.strictEqual(a.type, 'activateSpell', 'ต้องเลือก activateSpell ร่าย aq_recruit ไม่ถูกบล็อกด้วย minCounterCost');
});

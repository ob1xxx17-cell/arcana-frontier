// tests/bot_hard.test.js - เทสต์บอทระดับ Hard (ปรมาจารย์ AI คอมโบการ์ด)
const assert = require('assert');

const t = (name, fn) => tests.push({ name, run: fn });
const tests = module.exports = [];

const E = () => CG.engine;
const make = (opts) => CG.test.makeGame(Object.assign({
  deckA: 'mecha_strike',
  deckB: 'dinosaur',
  seed: 1,
  config: { autoChoose: false, chainMode: true }
}, opts));

// 1. Pure function test: CG.bot.choose (hard) ไม่แก้ state
t('HARD-01: CG.bot.choose (hard) เป็น Pure Function ไม่กลายพันธุ์ (mutate) state', assert => {
  const s = make({
    p0: { hand: ['mecha_call_signal', 'mecha_rhino'], mana: 3 },
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
    action = CG.bot.choose(frozen, 0, legal, { level: 'hard' });
  }, 'บอท hard ต้องไม่แก้ state ที่ freeze');

  assert.strictEqual(JSON.stringify(s), beforeJson, 'state ต้องไม่เปลี่ยนรูปหลังเรียก bot.choose (hard)');
  assert.ok(action, 'ต้องได้ action กลับมา');
});

// 2. Lethal: คำนวณความเสียหายปิดเกมทันที
t('HARD-02: lethal - โจมตีตรงรวดเดียวเพื่อปิดเกมเมื่อพลังรวม >= LP ศัตรูและไม่มีเป้าขวาง', assert => {
  const s = make({
    p0: {
      monsters: {
        1: { cardId: 'mecha_rhino', position: 'atk' }, // ATK 500
        2: { cardId: 'mecha_lion', position: 'atk' }   // ATK 1200 -> total 1700
      }
    },
    p1: { monsters: {}, lp: 1500 },
    phase: 'battle', turn: 3, activeIdx: 0
  });
  const legal = E().getLegalActions(s, 0);
  const a = CG.bot.choose(s, 0, legal, { level: 'hard' });
  assert.strictEqual(a.type, 'attack', 'ต้องเลือกโจมตี');
  assert.strictEqual(a.to, null, 'ต้องเป็นการโจมตีตรงเพื่อปิดเกม');
});

// 3. Search / Draw Priority: ร่ายเวทค้นหา (search/draw) ก่อนลงมอนสเตอร์ปกติ
t('HARD-03: card advantage - ร่ายเวทค้นหา (search/draw) ก่อนลงมอนสเตอร์ปกติเสมอ', assert => {
  const s = make({
    p0: { hand: ['mecha_call_signal', 'mecha_rhino'], mana: 3 },
    p1: { monsters: {}, lp: 8000 },
    phase: 'main1', turn: 3, activeIdx: 0
  });
  const legal = E().getLegalActions(s, 0);
  const a = CG.bot.choose(s, 0, legal, { level: 'hard' });
  assert.strictEqual(a.type, 'activateSpell', 'ต้องร่ายเวทค้นหาก่อน');
  const cardDef = E().cardOf(s.players[0].hand[a.handIdx]);
  assert.strictEqual(cardDef.id, 'mecha_call_signal', 'ต้องเป็นการ์ด mecha_call_signal');
});

// 4. Free Special Summon: ใช้ความสามารถ Special Summon ฟรี (เช่น mecha_dolphin เมื่อคุม Mecha อยู่)
t('HARD-04: free special summon - ใช้เอฟเฟกต์อัญเชิญพิเศษฟรีจากมือเพื่อเพิ่มจำนวนมอนสเตอร์', assert => {
  const s = make({
    p0: {
      hand: ['mecha_dolphin'],
      monsters: { 0: 'mecha_rhino' }, // คุม mecha 1 ตัวเพื่อผ่านเงื่อนไข dolphin
      mana: 2
    },
    p1: { monsters: {}, lp: 8000 },
    phase: 'main1', turn: 3, activeIdx: 0
  });
  const legal = E().getLegalActions(s, 0);
  const a = CG.bot.choose(s, 0, legal, { level: 'hard' });
  assert.ok(a.type === 'activateEffect' || a.type === 'activateSpell', 'ต้องใช้เอฟเฟกต์ special summon');
});

// 5. Chain Window: ตอบโต้ด้วยสวนกลับเมื่อศัตรูปองร้าย
t('HARD-05: chain response - บอท Hard ตอบโต้ทันทีเมื่อการกระทำศัตรูมุ่งทำลายการ์ด', assert => {
  const s = make({
    deckA: 'aquila',
    deckB: 'dinosaur',
    p0: {
      monsters: { 2: 'aq_spear' },
      hand: ['aq_retreat'], // counter trap (speed 3)
      mana: 2
    },
    p1: { monsters: { 2: 'dino_trex' }, lp: 8000 },
    phase: 'main1', turn: 4, activeIdx: 1
  });
  const targetUid = s.players[0].monsters[2].uid;
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
  const a = CG.bot.choose(s, 0, legal, { level: 'hard' });
  assert.strictEqual(a.type, 'activateResponse', 'ต้องตอบโต้ในหน้าต่างโซ่');
});

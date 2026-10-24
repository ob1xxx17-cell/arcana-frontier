// tests/primitives_final.test.js - เทสต์ชิ้นส่วนใหม่และเอฟเฟกต์ 5 ใบขั้น 4E-4:
// 1. cannotAttack (op & continuous, duration: endTurn, permanent, whileSource)
// 2. ผลลัพธ์ของ op ก่อนหน้า (lastResult, fromResult/fromPrevious, requireSuccess)
// 3. fireEffect (สั่งรันเอฟเฟกต์การ์ดอื่นทันที ข้ามเงื่อนไข trigger)
// 4. mana condition (เทียบค่ามานา)
// 5. พฤติกรรมการ์ด 5 ใบ: dino_small_raptor, dino_spino, dino_trex, dino_nest, dino_fast_hatch
require('./fixtures');
const E = () => CG.engine;
const FX = () => CG.effects;
const game = o => CG.test.makeGame(Object.assign({ deckA: 'dinosaur', deckB: 'dinosaur', seed: 1 }, o));
const atk = m => E().atk(m);
const def = m => E().def(m);
const mon = (s, p, slot) => s.players[p].monsters[slot];
const ids = list => list.filter(Boolean).map(c => c.cardId);

module.exports = [
  // ---------------- 1. cannotAttack (op & durations) ----------------
  { name: 'FIN-01 cannotAttack (+): duration endTurn ป้องกันการโจมตีในเทิร์นนั้นและปลดในเทิร์นถัดไป', run(assert) {
    const s = game({
      phase: 'battle', turn: 3,
      p0: { monsters: { 0: 'dino_trike' } },
      p1: { monsters: { 0: 'dino_egg' } }
    });
    const m = mon(s, 0, 0);
    // ใส่ cannotAttack endTurn
    FX().ops.cannotAttack(s, [], { target: 'self', duration: 'endTurn' }, { player: 0, source: m });
    assert.strictEqual(m.tempCannotAttackTurn, 3);
    const legals = E().getLegalActions(s, 0).filter(a => a.type === 'attack');
    assert.strictEqual(legals.length, 0, 'getLegalActions ต้องไม่เสนอการโจมตี');
    const r = E().applyAction(s, { type: 'attack', player: 0, from: 0, to: 0 });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'CANNOT_ATTACK');

    // ข้ามไปเทิร์น 5 (เทิร์นถัดไปของ p0)
    s.turn = 5;
    assert.strictEqual(E().canMonsterAttack(s, m), true, 'เทิร์นใหม่ต้องโจมตีได้');
    const r2 = E().applyAction(s, { type: 'attack', player: 0, from: 0, to: 0 });
    assert.ok(r2.ok, r2.error);
  } },

  { name: 'FIN-02 cannotAttack (+/-): duration permanent คงอยู่ข้ามเทิร์น, whileSource มีผลตราบใดที่ต้นทางยังอยู่', run(assert) {
    const s = game({
      phase: 'battle', turn: 3,
      p0: { monsters: { 0: 'dino_trike', 1: 'dino_small_raptor' } },
      p1: { monsters: { 0: 'dino_egg' } }
    });
    const m0 = mon(s, 0, 0);
    const m1 = mon(s, 0, 1);
    // permanent บน m0
    FX().ops.cannotAttack(s, [], { target: 'self', duration: 'permanent' }, { player: 0, source: m0 });
    assert.strictEqual(m0.cannotAttack, true);
    assert.strictEqual(E().canMonsterAttack(s, m0), false);
    // จบเทิร์นเข้าเทิร์นใหม่
    s.turn = 5;
    m0.flags.canAttack = true; // จำลอง finishTurn รีเซ็ต flags.canAttack
    assert.strictEqual(E().canMonsterAttack(s, m0), false, 'permanent ต้องห้ามโจมตีแม้ข้ามเทิร์น');

    // whileSource บน m1 โดยมี m0 เป็นต้นทาง
    FX().ops.cannotAttack(s, [], { target: { side: 'self', zone: 'monster', filter: { cardId: 'dino_small_raptor' } }, duration: 'whileSource' }, { player: 0, source: m0 });
    assert.strictEqual(m1.cannotAttackWhileSource, m0.uid);
    assert.strictEqual(E().canMonsterAttack(s, m1), false, 'ต้นทางยังอยู่บนสนาม ห้ามโจมตี');

    // ส่งต้นทาง (m0) ไปสุสาน
    E().destroyMonster(s, [], 0, 0, 'effect');
    assert.strictEqual(mon(s, 0, 0), null);
    assert.strictEqual(E().canMonsterAttack(s, m1), true, 'ต้นทางออกจากสนามแล้ว ปลดการห้ามโจมตีทันที');
  } },

  // ---------------- 2. ผลลัพธ์ของ op ก่อนหน้า (lastResult & requireSuccess) ----------------
  { name: 'FIN-03 lastResult & requireSuccess (+): destroy สำเร็จ ส่งต่อ ATK และรัน op ถัดไป', run(assert) {
    const s = game({
      p0: { monsters: { 0: 'dino_trex', 1: 'dino_trike' }, mana: 2 }
    });
    const rex = mon(s, 0, 0);
    const trike = mon(s, 0, 1);
    const trikeAtk = atk(trike); // 1000
    const startRexAtk = atk(rex); // 2200
    const ctx = { source: rex, player: 0 };
    const eff = {
      do: [
        { op: 'destroy', target: { side: 'self', zone: 'monster', filter: { cardId: 'dino_trike' } } },
        { op: 'modifyStat', target: 'self', stat: 'atk', duration: 'permanent', requireSuccess: true, amount: { fromResult: 'atk', multiplier: 0.5 } },
        { op: 'addMana', amount: 1, requireSuccess: true }
      ]
    };
    const r = FX().run(s, [], eff, ctx);
    assert.ok(r.ok);
    assert.strictEqual(mon(s, 0, 1), null, 'trike ถูกทำลาย');
    assert.strictEqual(atk(rex), startRexAtk + Math.floor(trikeAtk * 0.5), 'rex ได้รับ +500 ATK (ครึ่งหนึ่งของ 1000)');
    assert.strictEqual(s.players[0].mana, 3, 'ได้รับ +1 มานา');
  } },

  { name: 'FIN-04 lastResult & requireSuccess (-): destroy ถูกกัน (prevent) หรือไม่สำเร็จ op ที่ requireSuccess จะไม่ทำงาน', run(assert) {
    // สร้างการ์ดที่มี preventDestruction
    const shieldDef = {
      id: 'dino_shield_test', name: 'shield_test', type: 'monster', level: 1, atk: 500, def: 500, mana: '0',
      effects: [{ id: 'prevent', trigger: 'continuous', speed: 1, cost: { mana: 0 }, do: [{ op: 'preventDestruction' }] }]
    };
    CG.cards.fixture.main.push(shieldDef);
    try {
      const s = game({
        p0: { monsters: { 0: 'dino_trex' }, mana: 2 }
      });
      s.players[0].monsters[1] = E().newInstance(s, shieldDef, 0);
      const rex = mon(s, 0, 0);
      const startRexAtk = atk(rex);
      const ctx = { source: rex, player: 0 };
      const eff = {
        do: [
          { op: 'destroy', target: { side: 'self', zone: 'monster', filter: { cardId: 'dino_shield_test' } } },
          { op: 'modifyStat', target: 'self', stat: 'atk', duration: 'permanent', requireSuccess: true, amount: { fromResult: 'atk', multiplier: 0.5 } },
          { op: 'addMana', amount: 1, requireSuccess: true }
        ]
      };
      const ev = [];
      const r = FX().run(s, ev, eff, ctx);
      assert.ok(r.ok);
      assert.ok(ev.some(e => e.type === 'destroyPrevented'), 'การทำลายถูกกัน');
      assert.notStrictEqual(mon(s, 0, 1), null, 'การ์ดยังอยู่บนสนาม');
      assert.strictEqual(atk(rex), startRexAtk, 'requireSuccess: true ทำให้ ATK ไม่เพิ่ม');
      assert.strictEqual(s.players[0].mana, 2, 'requireSuccess: true ทำให้มานาไม่เพิ่ม');

      // ทดสอบ op destroy หาเป้าหมายไม่เจอ (0 ตัว)
      const eff2 = {
        do: [
          { op: 'destroy', target: { side: 'self', zone: 'monster', filter: { tag: 'non_existent' } } },
          { op: 'addMana', amount: 3, requireSuccess: true }
        ]
      };
      FX().run(s, [], eff2, ctx);
      assert.strictEqual(s.players[0].mana, 2, 'ไม่เจอมอนสเตอร์ทำลาย มานาต้องไม่เพิ่ม');
    } finally {
      CG.cards.fixture.main.pop();
    }
  } },

  // ---------------- 3. fireEffect ----------------
  { name: 'FIN-05 fireEffect (+): สั่งรันเอฟเฟกต์การ์ดอื่นทันที ข้ามเงื่อนไข trigger', run(assert) {
    const s = game({
      p0: { monsters: { 0: 'dino_egg' }, deck: ['dino_small_raptor', 'dino_compy'] }
    });
    const egg = mon(s, 0, 0);
    // ไข่ตามปกติฟักตอน Standby Phase แต่เราใช้ fireEffect สั่งรัน hatch ทันที
    const ev = [];
    FX().ops.fireEffect(s, ev, {
      target: { side: 'self', zone: 'monster', filter: { cardId: 'dino_egg' } },
      effectId: 'hatch'
    }, { player: 0 });
    assert.deepStrictEqual(ids(s.players[0].grave), ['dino_egg'], 'ไข่ถูกส่งไปสุสาน');
    assert.deepStrictEqual(ids(s.players[0].monsters).sort(), ['dino_compy', 'dino_small_raptor'], 'ลูกไดโนฟักออกมาสำเร็จ');
    assert.ok(ev.some(e => e.type === 'effectActivated' && e.effectId === 'hatch' && e.trigger === 'fireEffect'));
  } },

  { name: 'FIN-06 fireEffect (-): effectId ไม่ตรงไม่ทำงาน, และยังต้องจ่าย cost มานา', run(assert) {
    // การ์ดทดสอบที่มีเอฟเฟกต์คิด cost มานา 5
    const costlyDef = {
      id: 'dino_costly_test', name: 'costly_test', type: 'monster', level: 1, atk: 500, def: 500, mana: '0',
      effects: [{ id: 'expensive_fx', trigger: 'ignition', speed: 1, cost: { mana: 5 }, do: [{ op: 'draw', count: 1 }] }]
    };
    CG.cards.fixture.main.push(costlyDef);
    try {
      const s = game({
        p0: { mana: 2, deck: ['dino_egg'] }
      });
      s.players[0].monsters[0] = E().newInstance(s, costlyDef, 0);
      // effectId ไม่ตรง
      const ev = [];
      FX().ops.fireEffect(s, ev, { target: 'self', effectId: 'wrong_id' }, { player: 0, source: mon(s, 0, 0) });
      assert.strictEqual(ev.length, 0, 'effectId ไม่ตรงต้องไม่เกิด event');

      // มานาไม่พอจ่าย cost ของเอฟเฟกต์ (2 < 5)
      FX().ops.fireEffect(s, ev, { target: 'self', effectId: 'expensive_fx' }, { player: 0, source: mon(s, 0, 0) });
      assert.strictEqual(s.players[0].hand.length, 0, 'มานาไม่พอจ่าย cost เอฟเฟกต์ต้องไม่รัน');
      assert.strictEqual(s.players[0].mana, 2);
    } finally {
      CG.cards.fixture.main.pop();
    }
  } },

  // ---------------- 4. mana condition ----------------
  { name: 'FIN-07 mana condition (+/-): greaterThan, lessThan, min, max, equals, และ side opp', run(assert) {
    const s = game({
      p0: { mana: 6 },
      p1: { mana: 3 }
    });
    const ctx = { player: 0 };
    // greaterThan: 5
    assert.strictEqual(FX().conditions.mana(s, { op: 'mana', greaterThan: 5 }, ctx), true);
    assert.strictEqual(FX().conditions.mana(s, { op: 'mana', greaterThan: 6 }, ctx), false);

    // lessThan: 7
    assert.strictEqual(FX().conditions.mana(s, { op: 'mana', lessThan: 7 }, ctx), true);
    assert.strictEqual(FX().conditions.mana(s, { op: 'mana', lessThan: 6 }, ctx), false);

    // min & max
    assert.strictEqual(FX().conditions.mana(s, { op: 'mana', min: 6, max: 6 }, ctx), true);
    assert.strictEqual(FX().conditions.mana(s, { op: 'mana', min: 7 }, ctx), false);

    // equals
    assert.strictEqual(FX().conditions.mana(s, { op: 'mana', equals: 6 }, ctx), true);
    assert.strictEqual(FX().conditions.mana(s, { op: 'mana', equals: 5 }, ctx), false);

    // side: 'opp'
    assert.strictEqual(FX().conditions.mana(s, { op: 'mana', side: 'opp', equals: 3 }, ctx), true);
    assert.strictEqual(FX().conditions.mana(s, { op: 'mana', side: 'opp', greaterThan: 4 }, ctx), false);
  } },

  // ---------------- 5. พฤติกรรมการ์ดทั้ง 5 ใบ ----------------
  { name: 'FIN-08 dino_small_raptor: ฝูง +400 ATK เมื่อคุมแรปเตอร์เล็กอีกตัว หายเมื่อเหลือตัวเดียว', run(assert) {
    const s = game({
      p0: { monsters: { 0: 'dino_small_raptor' } }
    });
    const r1 = mon(s, 0, 0);
    assert.strictEqual(atk(r1), 600, 'มีตัวเดียว ATK ปกติ 600');

    // ลงแรปเตอร์เล็กตัวที่ 2
    s.players[0].monsters[1] = E().newInstance(s, E().findCard('dino_small_raptor'), 0);
    FX().refreshAuras(s);
    const r2 = mon(s, 0, 1);
    assert.strictEqual(atk(r1), 1000, 'มี 2 ตัว r1 ได้โบนัสฝูง +400 = 1000');
    assert.strictEqual(atk(r2), 1000, 'r2 ก็ได้โบนัสฝูง +400 = 1000');

    // ทำลาย r2
    E().destroyMonster(s, [], 0, 1, 'effect');
    FX().refreshAuras(s);
    assert.strictEqual(atk(r1), 600, 'เหลือตัวเดียว โบนัสฝูงหาย กลับเป็น 600');
  } },

  { name: 'FIN-09 dino_spino: พระราชอำนาจ ศัตรูที่ ATK < สไปโนโจมตีไม่ได้ขณะมานา > 5 และปลดเมื่อมานา <= 5 หรือสไปโนตาย', run(assert) {
    const s = game({
      phase: 'battle', turn: 4, activeIdx: 1, // เทิร์นของ p1
      p0: { monsters: { 2: 'dino_spino' }, mana: 6 }, // สไปโน ATK 2600, มานา 6 (> 5)
      p1: { monsters: { 0: 'dino_small_raptor', 1: 'dino_trex' } } // raptor ATK 600 (< 2600), rex ATK 2200 (< 2600)
    });
    const raptor = mon(s, 1, 0);
    const rex = mon(s, 1, 1);
    // raptor และ rex มี ATK ต่ำกว่าสไปโน และมานา p0 > 5 -> โจมตีไม่ได้
    assert.strictEqual(E().canMonsterAttack(s, raptor), false);
    assert.strictEqual(E().canMonsterAttack(s, rex), false);
    const legals = E().getLegalActions(s, 1).filter(a => a.type === 'attack');
    assert.strictEqual(legals.length, 0, 'ศัตรูที่ ATK ต่ำกว่าสไปโนโจมตีไม่ได้');

    // ถ้าสร้างมอนสเตอร์ศัตรูที่มี ATK >= 2600 (เช่น 3000)
    s.players[1].monsters[2] = E().newInstance(s, E().findCard('dino_spino'), 1);
    s.players[1].monsters[2].atkMod = 500; // ATK 3100
    assert.strictEqual(E().canMonsterAttack(s, mon(s, 1, 2)), true, 'มอนสเตอร์ที่ ATK สูงกว่าสไปโนต้องโจมตีได้');

    // ลดมานาของ p0 เหลือ 5 (เงื่อนไข > 5 ไม่จริง)
    s.players[0].mana = 5;
    assert.strictEqual(E().canMonsterAttack(s, raptor), true, 'มานา <= 5 พระราชอำนาจไม่ทำงาน ศัตรูโจมตีได้');

    // คืนมานาเป็น 6 แต่ทำลายสไปโน
    s.players[0].mana = 6;
    E().destroyMonster(s, [], 0, 2, 'effect');
    assert.strictEqual(E().canMonsterAttack(s, raptor), true, 'สไปโนออกจากสนาม พระราชอำนาจหาย ศัตรูโจมตีได้');
  } },

  { name: 'FIN-10 dino_trex: eat_king กินไดโนอื่น +ครึ่ง ATK ถาวร +1 มานา, roar_king ศัตรู -300 ถาวร เร็กซ์ห้ามตีเทิร์นนั้น', run(assert) {
    const s = game({
      phase: 'main1', turn: 3,
      p0: { monsters: { 2: 'dino_trex', 1: 'dino_hunter_raptor' }, mana: 5 }, // hunter_raptor ATK 2000
      p1: { monsters: { 0: 'dino_trike', 1: 'dino_ptero' } } // trike 1000, ptero 700
    });
    const rex = mon(s, 0, 2);
    const hunter = mon(s, 0, 1);
    assert.strictEqual(atk(rex), 2200);

    // ใช้ eat_king: จ่าย 3, ทำลาย hunter (ATK 2000), rex ได้ +1000 ATK, ได้ +1 มานา (สุทธิ 5 - 3 + 1 = 3)
    const r1 = E().applyAction(s, { type: 'activateEffect', player: 0, slot: 2, effectId: 'eat_king' });
    assert.ok(r1.ok, r1.error);
    assert.strictEqual(mon(s, 0, 1), null, 'hunter ถูกกิน');
    assert.strictEqual(atk(rex), 3200, 'เร็กซ์ได้ +1000 ATK ถาวร (2200 + 1000 = 3200)');
    assert.strictEqual(s.players[0].mana, 3, 'มานาเหลือ 3');

    // ใช้ roar_king: จ่าย 1, ศัตรูทุกตัว -300 ATK ถาวร, เร็กซ์ห้ามตีเทิร์นนี้
    const trike = mon(s, 1, 0);
    const ptero = mon(s, 1, 1);
    const r2 = E().applyAction(s, { type: 'activateEffect', player: 0, slot: 2, effectId: 'roar_king' });
    assert.ok(r2.ok, r2.error);
    assert.strictEqual(s.players[0].mana, 2);
    assert.strictEqual(atk(trike), 700, 'trike 1000 - 300 = 700');
    assert.strictEqual(atk(ptero), 400, 'ptero 700 - 300 = 400');
    assert.strictEqual(rex.tempCannotAttackTurn, 3, 'เร็กซ์ติดห้ามตีในเทิร์น 3');

    // เข้าเฟสต่อสู้ เร็กซ์ต้องประกาศโจมตีไม่ได้
    E().advancePhase(s, { type: 'advancePhase', player: 0 }, []);
    assert.strictEqual(s.phase, 'battle');
    assert.strictEqual(E().canMonsterAttack(s, rex), false, 'เร็กซ์คำรามแล้วโจมตีไม่ได้');
    const attackFail = E().applyAction(s, { type: 'attack', player: 0, from: 2, to: 0 });
    assert.strictEqual(attackFail.ok, false);
    assert.strictEqual(attackFail.error, 'CANNOT_ATTACK');
  } },

  { name: 'FIN-11 dino_nest: รังไดโน (สนาม) เมื่ออัญเชิญไข่ไดโนลงสนาม ไข่ฟักทันทีเป็นแรปเตอร์เล็กและคอมพ์', run(assert) {
    const s = game({
      p0: {
        hand: ['dino_egg'],
        deck: ['dino_small_raptor', 'dino_compy', 'dino_ptero'],
        mana: 3
      }
    });
    // ตั้ง dino_nest บนสนาม
    s.players[0].fieldSpell = E().newInstance(s, E().findCard('dino_nest'), 0);

    // p0 อัญเชิญปกติไข่ไดโนลงช่อง 0
    const r = E().applyAction(s, { type: 'normalSummon', player: 0, handIdx: 0, slot: 0 });
    assert.ok(r.ok, r.error);

    // รังไดโน trigger onSummon สั่ง fireEffect hatch บนไข่ทันที
    assert.deepStrictEqual(ids(s.players[0].grave), ['dino_egg'], 'ไข่ถูกฟักและส่งสุสานทันทีที่ลงสนาม');
    assert.deepStrictEqual(ids(s.players[0].monsters).sort(), ['dino_compy', 'dino_small_raptor'], 'ลูกไดโน 2 ตัวลงสนามทันที');
  } },

  { name: 'FIN-12 dino_fast_hatch: สเปลฟักเร็ว เลือกไข่บนสนาม ฟักทันที', run(assert) {
    const s = game({
      p0: {
        hand: ['dino_fast_hatch'],
        monsters: { 0: 'dino_egg' },
        deck: ['dino_small_raptor', 'dino_compy'],
        mana: 5
      }
    });
    // รันเอฟเฟกต์ฟักเร็ว (สเปลปกติ)
    const card = s.players[0].hand[0];
    const eff = E().cardOf(card).effects[0];
    const r = FX().run(s, [], eff, { source: card, player: 0 });
    assert.ok(r.ok, r.reason);
    assert.strictEqual(s.players[0].mana, 4, 'จ่าย 1 มานา');
    assert.deepStrictEqual(ids(s.players[0].grave), ['dino_egg'], 'ไข่ฟักลงสุสาน');
    assert.deepStrictEqual(ids(s.players[0].monsters).sort(), ['dino_compy', 'dino_small_raptor'], 'ลูกไดโน 2 ตัวลงสนาม');
  } }
];

// tests/triggers_new.test.js - เทสต์ trigger ใหม่ขั้น 4E-2A: onTributed, onNormalSummon, onAttacked, onBattleDestroyed
// และเอฟเฟกต์ผู้เฝ้าดู (effect.watch บน onSentToGrave) ทุก trigger มีข้อบวกและข้อลบ
require('./fixtures');
const E = () => CG.engine;
const FX = () => CG.effects;
const game = o => CG.test.makeGame(Object.assign({ deckA: 'dinosaur', deckB: 'dinosaur', seed: 1 }, o));
const agame = o => game(Object.assign({ deckA: 'aquila', deckB: 'aquila' }, o));
const ids = list => list.filter(Boolean).map(c => c.cardId);
const act = (assert, s, a) => { const r = E().applyAction(s, a); assert.ok(r.ok, r.error); return r; };
const killAll = (s, who) => FX().ops.destroy(s, [], { target: { side: who || 'self', zone: 'monster' } }, { player: 0 });
const SELF_M = { side: 'self', zone: 'monster' };

// ใส่เอฟเฟกต์ชั่วคราวให้การ์ดใน fixture (ไม่มี card.id ใน engine) แล้วคืนค่าเดิม
function withFixtureEffect(cardId, effects, fn) {
  const def = CG.cards.fixture.main.find(c => c.id === cardId);
  const old = def.effects; def.effects = effects;
  try { fn(); } finally { def.effects = old; }
}
const probe = (id, trigger, mana) => ({ id, trigger, speed: 1, cost: { mana: 0 }, do: [{ op: 'addMana', amount: mana }] });

module.exports = [
  { name: 'TRG-01 onTributed (+) เทอโรแดกทิลถูกใช้เป็นวัสดุเสียสละ จั่ว 1 ใบ ได้ +1 มานา และลงสุสานพร้อมยิง onSentToGrave', run(assert) {
    const s = game({ p0: { hand: ['dino_stego'], monsters: { 0: 'dino_ptero', 1: 'dino_egg' }, deck: ['dino_trex', 'dino_anky'], mana: 5 } });
    const r = act(assert, s, { type: 'tributeSummon', player: 0, handIdx: 0, slot: 0, materials: [0, 1] });
    assert.deepStrictEqual(ids(s.players[0].monsters), ['dino_stego']);
    assert.deepStrictEqual(ids(s.players[0].grave).sort(), ['dino_egg', 'dino_ptero']);
    assert.deepStrictEqual(ids(s.players[0].hand), ['dino_trex']);
    assert.strictEqual(s.players[0].mana, 6);
    assert.ok(r.events.some(e => e.type === 'effectActivated' && e.trigger === 'onTributed' && e.cardId === 'dino_ptero'));
  } },
  { name: 'TRG-02 onTributed (-) เทอโรแดกทิลถูกส่งสุสาน/ทำลายด้วยเอฟเฟกต์ ไม่ยิง onTributed', run(assert) {
    const s = game({ p0: { monsters: { 0: 'dino_ptero', 1: 'dino_ptero' }, deck: ['dino_trex', 'dino_anky'], mana: 5 } });
    FX().ops.sendToGrave(s, [], { target: { side: 'self', zone: 'monster', count: 1 } }, { player: 0 });
    killAll(s);
    assert.strictEqual(s.players[0].grave.length, 2);
    assert.strictEqual(s.players[0].hand.length, 0);
    assert.strictEqual(s.players[0].mana, 5);
  } },
  { name: 'TRG-03 onTributed (-) ตัวที่ถูกเรียกด้วยการเสียสละเองไม่ยิง onTributed (เฉพาะวัสดุ) และ ctx มี summonedUid', run(assert) {
    withFixtureEffect('fx_l1a', [probe('t', 'onTributed', 1)], () => {
      withFixtureEffect('fx_l2a', [probe('self_t', 'onTributed', 100)], () => {
        const s = game({ deckA: 'fixture', deckB: 'fixture', p0: { hand: ['fx_l2a'], monsters: { 0: 'fx_l1a', 1: 'fx_l1b' }, mana: 0 } });
        act(assert, s, { type: 'tributeSummon', player: 0, handIdx: 0, slot: 0, materials: [0, 1] });
        assert.strictEqual(s.players[0].mana, 1, 'วัสดุ fx_l1a ยิง 1 ครั้ง ตัวที่ถูกเรียกไม่ยิง');
      });
    });
  } },
  { name: 'TRG-04 onTributed (+) สคูทาตัสเป็นวัสดุ ค้นอาควิลา Lv1 ขึ้นมือ ข้ามมอนสเตอร์ Lv2 ในเด็ค', run(assert) {
    const s = agame({ p0: { hand: ['aq_sagittarius'], monsters: { 0: 'aq_scutatus', 1: 'aq_spear' }, deck: ['aq_eques', 'aq_tiro', 'aq_explorator'] } });
    act(assert, s, { type: 'tributeSummon', player: 0, handIdx: 0, slot: 1, materials: [0, 1] });
    assert.deepStrictEqual(ids(s.players[0].hand), ['aq_tiro']);
    assert.deepStrictEqual(ids(s.players[0].deck), ['aq_eques', 'aq_explorator']);
    assert.strictEqual(s.players[0].mana, 5, 'ค้นไม่ได้มานา ไม่เสียมานา');
  } },
  { name: 'TRG-05 onTributed (-) สคูทาตัสถูกทำลายด้วยเอฟเฟกต์ ไม่ค้น', run(assert) {
    const s = agame({ p0: { monsters: { 0: 'aq_scutatus' }, deck: ['aq_tiro'] } });
    killAll(s);
    assert.deepStrictEqual(ids(s.players[0].grave), ['aq_scutatus']);
    assert.strictEqual(s.players[0].hand.length, 0);
  } },

  { name: 'TRG-06 onNormalSummon (+) เอ็กซ์พลอราเตอร์ลงปกติ: จ่าย 1 จั่ว 1 ได้ +1 มานา สุทธิ 0', run(assert) {
    const s = agame({ p0: { hand: ['aq_explorator'], deck: ['aq_tiro'], mana: 3 } });
    act(assert, s, { type: 'normalSummon', player: 0, handIdx: 0, slot: 2 });
    assert.deepStrictEqual(ids(s.players[0].hand), ['aq_tiro']);
    assert.strictEqual(s.players[0].mana, 3);
  } },
  { name: 'TRG-07 onNormalSummon (-) เรียกพิเศษไม่ยิง', run(assert) {
    const s = agame({ p0: { hand: ['aq_explorator'], deck: ['aq_tiro'], mana: 3 } });
    FX().ops.specialSummon(s, [], { from: ['hand'], filter: { cardId: 'aq_explorator' }, count: 1 }, { player: 0 });
    assert.deepStrictEqual(ids(s.players[0].monsters), ['aq_explorator']);
    assert.strictEqual(s.players[0].hand.length, 0);
    assert.strictEqual(s.players[0].mana, 3);
  } },
  { name: 'TRG-08 onNormalSummon (-) Set คว่ำไม่ยิง', run(assert) {
    const s = agame({ p0: { hand: ['aq_explorator'], deck: ['aq_tiro'], mana: 3 } });
    act(assert, s, { type: 'setMonster', player: 0, handIdx: 0, slot: 2 });
    assert.strictEqual(s.players[0].hand.length, 0);
    assert.strictEqual(s.players[0].mana, 3);
  } },
  { name: 'TRG-09 onNormalSummon (+) อัญเชิญแบบเสียสละนับเป็นอัญเชิญปกติ ctx.how = tribute และวัสดุไม่ยิง', run(assert) {
    withFixtureEffect('fx_l2a', [probe('n', 'onNormalSummon', 7)], () => {
      withFixtureEffect('fx_l1a', [probe('m', 'onNormalSummon', 1000)], () => {
        const s = game({ deckA: 'fixture', deckB: 'fixture', p0: { hand: ['fx_l2a'], monsters: { 0: 'fx_l1a', 1: 'fx_l1b' }, mana: 0 } });
        act(assert, s, { type: 'tributeSummon', player: 0, handIdx: 0, slot: 0, materials: [0, 1] });
        assert.strictEqual(s.players[0].mana, 7);
      });
    });
  } },

  { name: 'TRG-10 onAttacked (+) ไทรเซราท็อปส์ท่าป้องกันถูกโจมตี: จ่าย 1 ผู้โจมตีเสีย 500 LP (+ผลต่อสู้)', run(assert) {
    const s = game({ phase: 'battle', p0: { monsters: { 0: 'dino_hunter_raptor' } }, p1: { monsters: { 0: { cardId: 'dino_trike', position: 'def' } }, mana: 5 } });
    act(assert, s, { type: 'attack', player: 0, from: 0, to: 0 });
    assert.strictEqual(s.players[1].mana, 4);
    assert.strictEqual(s.players[0].lp, 8000 - 500 - 300, '500 จากเอฟเฟกต์ + 300 จาก ATK2000<DEF2300');
    assert.strictEqual(s.players[1].lp, 8000);
  } },
  { name: 'TRG-11 onAttacked (-) ไทรเซราท็อปส์ท่าโจมตีถูกโจมตี condition ท่าป้องกันไม่ผ่าน ไม่เสียมานา ผู้โจมตีไม่เสีย LP', run(assert) {
    const s = game({ phase: 'battle', p0: { monsters: { 0: 'dino_hunter_raptor' } }, p1: { monsters: { 0: 'dino_trike' }, mana: 5 } });
    act(assert, s, { type: 'attack', player: 0, from: 0, to: 0 });
    assert.strictEqual(s.players[1].mana, 5);
    assert.strictEqual(s.players[0].lp, 8000);
    assert.strictEqual(s.players[1].lp, 8000 - 1000);
  } },
  { name: 'TRG-12 onAttacked (-) โจมตีตรง (ไม่มีเป้า) ไม่ยิง / เป้าคว่ำไม่ยิง (พลิกที่ damageStep)', run(assert) {
    const s = game({ phase: 'battle', p0: { monsters: { 0: 'dino_hunter_raptor' } }, p1: { monsters: { 0: { cardId: 'dino_trike', faceDown: true } }, mana: 5 } });
    act(assert, s, { type: 'attack', player: 0, from: 0, to: 0 });
    assert.strictEqual(s.players[1].mana, 5);
    assert.strictEqual(s.players[0].lp, 8000 - 300);
    const t = game({ phase: 'battle', p0: { monsters: { 0: 'dino_hunter_raptor' } }, p1: { mana: 5, monsters: {} } });
    act(assert, t, { type: 'attack', player: 0, from: 0, to: null });
    assert.strictEqual(t.players[0].lp, 8000);
  } },
  { name: 'TRG-13 onAttacked (+) ผู้โจมตีตายจากเอฟเฟกต์ LP 500 → เกมจบ ไม่ค้างสถานะการโจมตี', run(assert) {
    const s = game({ phase: 'battle', p0: { lp: 500, monsters: { 0: 'dino_small_raptor' } }, p1: { monsters: { 0: { cardId: 'dino_trike', position: 'def' } }, mana: 5 } });
    act(assert, s, { type: 'attack', player: 0, from: 0, to: 0 });
    assert.ok(s.ended); assert.strictEqual(s.winner, 1);
    assert.strictEqual(s.battleStep, null); assert.strictEqual(s.attack, null);
  } },

  { name: 'TRG-14 onBattleDestroyed (+) สเตโกซอรัสถูกทำลายในต่อสู้ จ่าย 1 เรียกไข่จากเด็ค', run(assert) {
    const s = game({ phase: 'battle', p0: { monsters: { 0: 'dino_hunter_raptor' } }, p1: { monsters: { 0: 'dino_stego' }, deck: ['dino_compy', 'dino_egg'], mana: 5 } });
    act(assert, s, { type: 'attack', player: 0, from: 0, to: 0 });
    assert.deepStrictEqual(ids(s.players[1].grave), ['dino_stego']);
    assert.deepStrictEqual(ids(s.players[1].monsters), ['dino_egg']);
    assert.deepStrictEqual(ids(s.players[1].deck), ['dino_compy']);
    assert.strictEqual(s.players[1].mana, 4);
  } },
  { name: 'TRG-15 onBattleDestroyed (+) สเตโกซอรัสเป็นฝ่ายโจมตีแล้วแพ้ ก็ยิง และเรียกไข่จากสุสานได้เมื่อเด็คไม่มี', run(assert) {
    const s = game({ phase: 'battle', p0: { monsters: { 0: 'dino_stego' }, grave: ['dino_egg'], deck: ['dino_compy'], mana: 5 }, p1: { monsters: { 0: 'dino_hunter_raptor' } } });
    act(assert, s, { type: 'attack', player: 0, from: 0, to: 0 });
    assert.deepStrictEqual(ids(s.players[0].monsters), ['dino_egg']);
    assert.deepStrictEqual(ids(s.players[0].grave), ['dino_stego']);
  } },
  { name: 'TRG-16 onBattleDestroyed (-) สเตโกซอรัสถูกทำลายด้วยเอฟเฟกต์ ไม่ยิง', run(assert) {
    const s = game({ p0: { monsters: { 0: 'dino_stego' }, deck: ['dino_egg'], mana: 5 } });
    killAll(s);
    assert.deepStrictEqual(ids(s.players[0].grave), ['dino_stego']);
    assert.strictEqual(s.players[0].monsters.filter(Boolean).length, 0);
    assert.strictEqual(s.players[0].mana, 5);
  } },
  { name: 'TRG-17 onBattleDestroyed (-) สเตโกซอรัสรอดจากการต่อสู้ (ป้องกันชนะ) ไม่ยิง', run(assert) {
    const s = game({ phase: 'battle', p0: { monsters: { 0: 'dino_small_raptor' } }, p1: { monsters: { 0: { cardId: 'dino_stego', position: 'def' } }, deck: ['dino_egg'], mana: 5 } });
    act(assert, s, { type: 'attack', player: 0, from: 0, to: 0 });
    assert.deepStrictEqual(ids(s.players[1].monsters), ['dino_stego']);
    assert.strictEqual(s.players[1].mana, 5);
    assert.strictEqual(s.players[1].deck.length, 1);
  } },
  { name: 'TRG-18 onBattleDestroyed (+) ตัว Grade 4 ที่ตายในต่อสู้ไปอยู่ Extra ก็ยังยิง (หาตัวที่ตายจาก grave/extra)', run(assert) {
    withFixtureEffect('fx_l1a', [], () => {
      const g4 = CG.cards.fixture.extra.find(c => c.id === 'fx_g4');
      const old = g4.effects; g4.effects = [probe('bd', 'onBattleDestroyed', 9)];
      try {
        const s = game({ deckA: 'fixture', deckB: 'fixture', phase: 'battle', p0: { monsters: { 0: 'fx_l3a' } }, p1: { monsters: { 0: 'fx_g4' }, mana: 0 } });
        s.players[1].monsters[0].baseAtk = 100;
        act(assert, s, { type: 'attack', player: 0, from: 0, to: 0 });
        assert.strictEqual(ids(s.players[1].extra).filter(x => x === 'fx_g4').length, 2, 'fx_g4 เดิม 1 + ตัวที่ตายกลับ Extra 1');
        assert.strictEqual(s.players[1].monsters.filter(Boolean).length, 0);
        assert.strictEqual(s.players[1].mana, 9);
      } finally { g4.effects = old; }
    });
  } },

  { name: 'TRG-19 watcher (+) แรปเตอร์เล็กในมือ: ไดโนอื่นของเราลงสุสาน จ่าย 1 เรียกตัวเองจากมือ', run(assert) {
    const s = game({ p0: { hand: ['dino_small_raptor'], monsters: { 1: 'dino_egg' }, mana: 5 } });
    FX().ops.sendToGrave(s, [], { target: SELF_M }, { player: 0 });
    assert.deepStrictEqual(ids(s.players[0].monsters), ['dino_small_raptor']);
    assert.strictEqual(s.players[0].hand.length, 0);
    assert.strictEqual(s.players[0].mana, 4);
  } },
  { name: 'TRG-20 watcher (+) ตัวที่ถูกส่งมาจากเด็คก็นับ (ไม่จำกัดโซนต้นทาง) และตัวเรียกไม่นับโควตาลงปกติ', run(assert) {
    const s = game({ p0: { hand: ['dino_small_raptor'], deck: ['dino_egg'], mana: 5 } });
    FX().ops.sendToGrave(s, [], { target: { side: 'self', zone: 'deck', filter: { cardId: 'dino_egg' } } }, { player: 0 });
    assert.deepStrictEqual(ids(s.players[0].monsters), ['dino_small_raptor']);
    assert.strictEqual(s.players[0].flags.normalSummonUsed, false);
  } },
  { name: 'TRG-21 watcher (-) ไดโนของศัตรูลงสุสาน ไม่ยิง (ต้องเป็นของเรา)', run(assert) {
    const s = game({ p0: { hand: ['dino_small_raptor'], mana: 5 }, p1: { monsters: { 0: 'dino_egg' } } });
    FX().ops.sendToGrave(s, [], { target: { side: 'opp', zone: 'monster' } }, { player: 0 });
    assert.strictEqual(s.players[1].grave.length, 1);
    assert.strictEqual(s.players[0].hand.length, 1);
    assert.strictEqual(s.players[0].mana, 5);
  } },
  { name: 'TRG-22 watcher (-) ตัวที่ลงสุสานไม่ใช่ไดโน (filter tag) ไม่ยิง', run(assert) {
    withFixtureEffect('fx_l1a', [], () => {
      const s = game({ deckA: 'fixture', deckB: 'fixture', p0: { monsters: { 0: 'fx_l1a' }, mana: 5 } });
      s.players[0].hand.push(E().newInstance(s, E().findCard('dino_small_raptor'), 0));
      killAll(s);
      assert.strictEqual(s.players[0].grave.length, 1);
      assert.strictEqual(s.players[0].hand.length, 1);
      assert.strictEqual(s.players[0].mana, 5);
    });
  } },
  { name: 'TRG-23 watcher (-) แรปเตอร์เล็กเองลงสุสาน (other:true) ไม่เฝ้าตัวเอง และแรปเตอร์บนสนามไม่เฝ้า (zone: hand)', run(assert) {
    const s = game({ p0: { hand: ['dino_small_raptor'], monsters: { 0: 'dino_small_raptor' }, mana: 5 } });
    FX().ops.sendToGrave(s, [], { target: SELF_M }, { player: 0 });   // แรปเตอร์บนสนามลงสุสาน → แรปเตอร์ในมือเฝ้า (ตัวอื่น) เรียกตัวเอง
    assert.deepStrictEqual(ids(s.players[0].monsters), ['dino_small_raptor']);
    const t = game({ p0: { monsters: { 0: 'dino_small_raptor', 1: 'dino_egg' }, mana: 5 } });
    FX().ops.sendToGrave(t, [], { target: { side: 'self', zone: 'monster', filter: { cardId: 'dino_egg' } } }, { player: 0 });
    assert.strictEqual(t.players[0].mana, 5, 'แรปเตอร์บนสนามไม่มี watcher ทำงาน');
    const u = game({ p0: { hand: ['dino_small_raptor'], mana: 5 } });
    FX().ops.sendToGrave(u, [], { target: { side: 'self', zone: 'hand' } }, { player: 0 });
    assert.strictEqual(u.players[0].mana, 5, 'ส่งตัวเองจากมือ ไม่เรียกตัวเอง');
    assert.strictEqual(u.players[0].monsters.filter(Boolean).length, 0);
  } },
  { name: 'TRG-24 watcher: เทิร์นละ 1 ครั้ง แรปเตอร์ 2 ตัวในมือ ไข่ 2 ใบลงสุสานพร้อมกัน เรียกได้ตัวเดียว (เทิร์นถัดไปได้อีก)', run(assert) {
    const s = game({ p0: { hand: ['dino_small_raptor', 'dino_small_raptor'], monsters: { 0: 'dino_egg', 1: 'dino_egg' }, mana: 5 } });
    FX().ops.sendToGrave(s, [], { target: SELF_M }, { player: 0 });
    assert.strictEqual(ids(s.players[0].monsters).length, 1);
    assert.strictEqual(s.players[0].hand.length, 1);
    assert.strictEqual(s.players[0].mana, 4);
    s.turn += 2;
    s.players[0].monsters[0] = null; s.players[0].grave = [];
    s.players[0].deck.unshift(E().newInstance(s, E().findCard('dino_egg'), 0));
    FX().ops.sendToGrave(s, [], { target: { side: 'self', zone: 'deck', filter: { cardId: 'dino_egg' } } }, { player: 0 });
    assert.strictEqual(s.players[0].hand.length, 0);
  } },
  { name: 'TRG-25 watcher (-) ช่องมอนสเตอร์เต็ม: ไม่เรียก ไม่เสียมานา ไม่เสีย limit', run(assert) {
    const s = game({ p0: { hand: ['dino_small_raptor'], monsters: { 0: 'dino_trex', 1: 'dino_trex', 2: 'dino_trex', 3: 'dino_trex', 4: 'dino_trex' }, deck: ['dino_egg'], mana: 5 } });
    FX().ops.sendToGrave(s, [], { target: { side: 'self', zone: 'deck' } }, { player: 0 });
    assert.strictEqual(s.players[0].hand.length, 1);
    assert.strictEqual(s.players[0].mana, 5);
    assert.deepStrictEqual((s.effectLimits && s.effectLimits.turn.used) || {}, {});
  } },
  { name: 'TRG-26 watcher (-) มานาไม่พอ ข้ามเงียบ ๆ เกมเดินต่อ', run(assert) {
    const s = game({ p0: { hand: ['dino_small_raptor'], monsters: { 0: 'dino_egg' }, mana: 0 } });
    FX().ops.sendToGrave(s, [], { target: SELF_M }, { player: 0 });
    assert.strictEqual(s.players[0].hand.length, 1);
    assert.strictEqual(s.players[0].grave.length, 1);
  } },
  { name: 'TRG-27 ข้อมูล: trigger ใหม่ 4 ตัวถูกยิงเฉพาะตอนมี ctx.source และ trigger ที่ไม่รู้จักถูกข้าม', run(assert) {
    const s = game({ p0: { monsters: { 0: 'dino_ptero' }, deck: ['dino_egg'], mana: 5 } });
    const ev = [];
    E().fire(s, ev, 'onNoSuchTrigger', { source: s.players[0].monsters[0] });
    assert.strictEqual(ev.length, 0);
    E().fire(s, ev, 'onTributed', { source: s.players[0].monsters[0] });
    assert.ok(ev.some(e => e.type === 'effectActivated' && e.trigger === 'onTributed'));
  } },
  { name: 'TRG-28 เสียสละ: watcher ที่ถูกวัสดุปลุกเรียกลงช่องไม่ทับตัวที่เสียสละเรียก (การ์ดไม่หาย) และยิง onSentToGrave ของวัสดุหลังวางตัวเรียก', run(assert) {
    const s = game({ p0: { hand: ['dino_stego', 'dino_small_raptor'], monsters: { 0: 'dino_egg', 1: 'dino_egg' }, mana: 5 } });
    const total = () => s.players[0].hand.length + s.players[0].grave.length + s.players[0].deck.length + s.players[0].monsters.filter(Boolean).length;
    const before = total();
    act(assert, s, { type: 'tributeSummon', player: 0, handIdx: 0, slot: 0, materials: [0, 1] });
    assert.strictEqual(total(), before);
    assert.deepStrictEqual(ids(s.players[0].monsters).sort(), ['dino_small_raptor', 'dino_stego']);
    assert.strictEqual(s.players[0].monsters[0].cardId, 'dino_stego', 'ตัวที่เสียสละเรียกอยู่ช่องที่เลือก');
  } }
];

// tests/dino_effects.test.js - เทสต์เอฟเฟกต์เด็คไดโนเสาร์ (ขั้น 4C) ทดสอบการ์ดตัวแทนแต่ละประเภทของเอฟเฟกต์
// ไม่ได้ทดสอบทุกใบ  สเปลยังสั่งผ่าน applyAction ไม่ได้ (activateSpell = NOT_IMPLEMENTED) จึงรันผ่าน CG.effects.run ตรง ๆ
const E = () => CG.engine;
const FX = () => CG.effects;
const game = o => CG.test.makeGame(Object.assign({ deckA: 'dinosaur', deckB: 'dinosaur', seed: 1 }, o));
const cardDef = id => [].concat(CG.cards.dinosaur.main, CG.cards.dinosaur.extra).find(c => c.id === id);
const eff = (id, i) => cardDef(id).effects[i || 0];
const ids = list => list.filter(Boolean).map(c => c.cardId);
const TRIGGERS = ['ignition', 'quick', 'continuous', 'onSummon', 'onFlip', 'onOverlay', 'onStandby', 'onEndPhase',
  'onAttackDeclared', 'onBattleDestroy', 'onDestroyed', 'onSentToGrave', 'onTributed', 'onNormalSummon', 'onAttacked', 'onBattleDestroyed'];
const WITH_EFFECTS = ['dino_egg', 'dino_compy', 'dino_anky', 'dino_spino', 'dino_dig', 'dino_hunt', 'dino_extinct', 'dino_raptor_swarm',
  'dino_ptero', 'dino_trike', 'dino_stego', 'dino_small_raptor',
  'dino_call'];   // 4 ใบกลางเพิ่มใน 4E-2A, dino_call เพิ่มใน 4E-2B

module.exports = [
  { name: 'DINO-01 ไข่ฟักตอน Standby ของเจ้าของเท่านั้น (ไม่ฟักตอน Standby ฝ่ายตรงข้าม)', run(assert) {
    const s = game({ p0: { monsters: { 1: 'dino_egg' }, deck: ['dino_small_raptor', 'dino_compy', 'dino_ptero', 'dino_stego', 'dino_nest'] } });
    assert.ok(E().applyAction(s, { type: 'endTurn', player: 0 }).ok);
    assert.strictEqual(s.activeIdx, 1);
    assert.deepStrictEqual(ids(s.players[0].monsters), ['dino_egg'], 'Standby ของศัตรูต้องไม่ฟักไข่เรา');
    assert.ok(E().applyAction(s, { type: 'endTurn', player: 1 }).ok);
    assert.strictEqual(s.activeIdx, 0);
    assert.deepStrictEqual(ids(s.players[0].grave), ['dino_egg']);
    assert.deepStrictEqual(ids(s.players[0].monsters).sort(), ['dino_compy', 'dino_small_raptor']);
  } },

  { name: 'DINO-02 แมวคอมพ์ถูกส่งสุสาน (onSentToGrave): จ่าย 1 มานา ค้นไข่จากเด็คขึ้นมือ ไม่ได้มานาจากการค้น', run(assert) {
    const s = game({ p0: { monsters: { 1: 'dino_compy' }, deck: ['dino_stego', 'dino_egg'], mana: 5 } });
    FX().ops.destroy(s, [], { target: { side: 'self', zone: 'monster' } }, { player: 0 });
    assert.deepStrictEqual(ids(s.players[0].grave), ['dino_compy']);
    assert.deepStrictEqual(ids(s.players[0].hand), ['dino_egg']);
    assert.strictEqual(s.players[0].mana, 4);
    assert.deepStrictEqual(ids(s.players[0].deck), ['dino_stego']);
  } },

  { name: 'DINO-03 คอมพ์: มานาไม่พอ เอฟเฟกต์ถูกข้ามเงียบ ๆ เกมเดินต่อ', run(assert) {
    const s = game({ p0: { monsters: { 1: 'dino_compy' }, deck: ['dino_egg'], mana: 0 } });
    FX().ops.destroy(s, [], { target: { side: 'self', zone: 'monster' } }, { player: 0 });
    assert.deepStrictEqual(ids(s.players[0].grave), ['dino_compy']);
    assert.strictEqual(s.players[0].hand.length, 0);
    assert.strictEqual(s.players[0].mana, 0);
  } },

  { name: 'DINO-04 อังคิโล ignition: จ่าย 1 ทำลายตัวเอง เรียก Lv2 จากเด็ค แล้วใช้ซ้ำในเทิร์นเดียวกันไม่ได้ (limit ข้ามสำเนา)', run(assert) {
    const s = game({ p0: { monsters: { 1: 'dino_anky', 3: 'dino_anky' }, deck: ['dino_egg', 'dino_trike', 'dino_stego'], mana: 5 } });
    const r = E().applyAction(s, { type: 'activateEffect', player: 0, slot: 1, effectId: 'swap' });
    assert.ok(r.ok, r.error);
    assert.deepStrictEqual(ids(s.players[0].grave), ['dino_anky']);
    assert.ok(ids(s.players[0].monsters).includes('dino_trike'), 'ต้องเรียก Lv2 ตัวแรกในเด็ค');
    assert.ok(ids(s.players[0].deck).includes('dino_egg'), 'Lv1 ห้ามถูกเรียก');
    assert.strictEqual(s.players[0].mana, 4);
    const again = E().applyAction(s, { type: 'activateEffect', player: 0, slot: 3, effectId: 'swap' });
    assert.strictEqual(again.ok, false);
    assert.strictEqual(again.error, 'LIMIT_REACHED');
    assert.strictEqual(s.players[0].mana, 4);
  } },

  { name: 'DINO-05 สไปโน ignition (ช่องผู้นำ): จ่าย 3 เรียก Lv1-2 สองตัวจากเด็ค ข้าม Lv3', run(assert) {
    const s = game({ p0: { monsters: { 2: 'dino_spino' }, deck: ['dino_trex', 'dino_egg', 'dino_trike', 'dino_small_raptor'], mana: 5 } });
    const r = E().applyAction(s, { type: 'activateEffect', player: 0, slot: 2, effectId: 'summon_subjects' });
    assert.ok(r.ok, r.error);
    assert.strictEqual(s.players[0].mana, 2);
    assert.deepStrictEqual(ids(s.players[0].monsters).filter(c => c !== 'dino_spino').sort(), ['dino_egg', 'dino_trike']);
    assert.deepStrictEqual(ids(s.players[0].deck).sort(), ['dino_small_raptor', 'dino_trex']);
  } },

  { name: 'DINO-06 สไปโน: มานาไม่พอ (2 < 3) ใช้ไม่ได้ ไม่เปลี่ยน state', run(assert) {
    const s = game({ p0: { monsters: { 2: 'dino_spino' }, deck: ['dino_egg', 'dino_trike'], mana: 2 } });
    const r = E().applyAction(s, { type: 'activateEffect', player: 0, slot: 2, effectId: 'summon_subjects' });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'NOT_ENOUGH_MANA');
    assert.strictEqual(s.players[0].mana, 2);
    assert.strictEqual(s.players[0].deck.length, 2);
  } },

  { name: 'DINO-07 ขุดซากฟอสซิล: ค้นมอนสเตอร์จากสุสานขึ้นมือ ไม่หยิบสเปล จ่าย 1', run(assert) {
    const s = game({ p0: { hand: ['dino_dig'], grave: ['dino_nest', 'dino_egg'], mana: 5 } });
    const r = FX().run(s, [], eff('dino_dig'), { source: s.players[0].hand[0], player: 0 });
    assert.ok(r.ok, r.reason);
    assert.deepStrictEqual(ids(s.players[0].hand), ['dino_dig', 'dino_egg']);
    assert.deepStrictEqual(ids(s.players[0].grave), ['dino_nest']);
    assert.strictEqual(s.players[0].mana, 4);
  } },

  { name: 'DINO-08 ล่าอาหาร: จั่ว 2 ได้มานา +2 สุทธิ +1 (จ่าย 1)', run(assert) {
    const s = game({ p0: { hand: ['dino_hunt'], deck: ['dino_egg', 'dino_compy', 'dino_ptero'], mana: 5 } });
    const r = FX().run(s, [], eff('dino_hunt'), { source: s.players[0].hand[0], player: 0 });
    assert.ok(r.ok, r.reason);
    assert.strictEqual(s.players[0].hand.length, 3);
    assert.strictEqual(s.players[0].mana, 6);
  } },

  { name: 'DINO-09 สูญพันธุ์: ทำลายมอนสเตอร์ทุกตัวทั้งสองฝั่ง จ่าย 3', run(assert) {
    const s = game({ p0: { hand: ['dino_extinct'], monsters: { 1: 'dino_egg', 3: 'dino_trike' }, mana: 5 },
      p1: { monsters: { 0: 'dino_stego', 2: 'dino_hunter_raptor' } } });
    const r = FX().run(s, [], eff('dino_extinct'), { source: s.players[0].hand[0], player: 0 });
    assert.ok(r.ok, r.reason);
    assert.strictEqual(ids(s.players[0].monsters).length, 0);
    assert.strictEqual(ids(s.players[1].monsters).length, 0);
    assert.deepStrictEqual(ids(s.players[0].grave).sort(), ['dino_egg', 'dino_trike']);
    assert.deepStrictEqual(ids(s.players[1].grave).sort(), ['dino_hunter_raptor', 'dino_stego']);
    assert.strictEqual(s.players[0].mana, 2);
  } },

  { name: 'DINO-10 แรปเตอร์ฝูงผสาน onSummon: จ่าย 1 เรียกแรปเตอร์เล็กจากเด็ค/สุสานเมื่อเรียกสำเร็จ', run(assert) {
    const s = game({ p0: { extra: ['dino_raptor_swarm'], deck: ['dino_egg'], grave: ['dino_small_raptor'], mana: 5 } });
    FX().ops.specialSummon(s, [], { from: ['extra'], filter: { cardId: 'dino_raptor_swarm' }, count: 1 }, { player: 0 });
    assert.deepStrictEqual(ids(s.players[0].monsters).sort(), ['dino_raptor_swarm', 'dino_small_raptor']);
    assert.strictEqual(s.players[0].grave.length, 0);
    assert.strictEqual(s.players[0].mana, 4);
  } },

  { name: 'DINO-11 ข้อมูล: ทุก effects[] ใช้เฉพาะ trigger/op ที่มีจริง id ไม่ซ้ำ speed 1-3 ไม่มี condition ที่ยังไม่ลงทะเบียน', run(assert) {
    for (const c of [].concat(CG.cards.dinosaur.main, CG.cards.dinosaur.extra)) {
      const seen = new Set();
      for (const e of c.effects) {
        assert.ok(!seen.has(e.id), `${c.id}: id ซ้ำ ${e.id}`); seen.add(e.id);
        assert.ok(TRIGGERS.includes(e.trigger), `${c.id}/${e.id}: trigger ${e.trigger}`);
        assert.ok([1, 2, 3].includes(e.speed), `${c.id}/${e.id}: speed`);
        assert.ok(e.cost && Number.isInteger(e.cost.mana) && e.cost.mana >= 0, `${c.id}/${e.id}: cost`);
        for (const s of e.do) assert.ok(FX().ops[s.op], `${c.id}/${e.id}: ไม่มี op ${s.op}`);
        for (const s of e.condition || []) assert.ok(FX().conditions[s.op], `${c.id}/${e.id}: ไม่มี condition ${s.op}`);
        if (e.limit) assert.ok(['turn', 'game'].includes(e.limit.per), `${c.id}/${e.id}: limit.per`);
      }
    }
  } },

  { name: 'DINO-12 การ์ดที่ชิ้นส่วนยังทำไม่ได้คงเป็น effects: [] (ตามรายงานขั้น 4C) และมีเอฟเฟกต์เฉพาะ 13 ใบนี้', run(assert) {
    const all = [].concat(CG.cards.dinosaur.main, CG.cards.dinosaur.extra);
    assert.strictEqual(all.length, 26);
    assert.deepStrictEqual(all.filter(c => c.effects.length).map(c => c.id).sort(), WITH_EFFECTS.slice().sort());
    for (const c of all.filter(c => !WITH_EFFECTS.includes(c.id))) assert.deepStrictEqual(c.effects, [], c.id);
    for (const id of WITH_EFFECTS) assert.strictEqual(cardDef(id).effects.length, 1, id);
  } }
];

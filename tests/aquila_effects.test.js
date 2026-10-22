// tests/aquila_effects.test.js - เทสต์เอฟเฟกต์เด็คอาควิลา (ขั้น 4D) ทดสอบพฤติกรรมเทียบข้อความการ์ดทุกใบที่แปลงแล้ว
// สเปลยังสั่งผ่าน applyAction ไม่ได้ (activateSpell = NOT_IMPLEMENTED) และ quick ยังเปิดใช้ไม่ได้ (รอขั้น 5)
// จึงรันผ่าน CG.effects.run ตรง ๆ ส่วน ignition บนสนามและ onBattleDestroy ทดสอบผ่าน applyAction จริง
const E = () => CG.engine;
const FX = () => CG.effects;
const game = o => CG.test.makeGame(Object.assign({ deckA: 'aquila', deckB: 'aquila', seed: 1 }, o));
const ALL = () => [].concat(CG.cards.aquila.main, CG.cards.aquila.extra);
const cardDef = id => ALL().find(c => c.id === id);
const eff = (id, i) => cardDef(id).effects[i || 0];
const ids = list => list.filter(Boolean).map(c => c.cardId);
const TRIGGERS = ['ignition', 'quick', 'continuous', 'onSummon', 'onFlip', 'onOverlay', 'onStandby', 'onEndPhase',
  'onAttackDeclared', 'onBattleDestroy', 'onDestroyed', 'onSentToGrave', 'onTributed', 'onNormalSummon', 'onAttacked', 'onBattleDestroyed'];
const WITH_EFFECTS = ['aq_sagittarius', 'aq_gladiator', 'aq_consul', 'aq_armory', 'aq_war', 'aq_scutatus', 'aq_explorator',
  'aq_centurion', 'aq_castra', 'aq_imperator', 'aq_recruit', 'aq_muster', 'aq_tiro', 'aq_assault'];   // 2 ใบแรกเพิ่มใน 4E-2A, 7 ใบหลังเพิ่มใน 4E-2B
const NO_EFFECT_BY_DESIGN = ['aq_eques', 'aq_dictator'];   // ข้อความการ์ด: "ไม่มีเอฟเฟกต์" / "เอฟเฟกต์: ยังไม่กำหนด"

module.exports = [
  { name: 'AQ-01 ซาจิตตาริอุส (quick): จ่าย 1 ลด ATK ถาวร 300 ให้ศัตรูทุกตัวที่อยู่บนสนามตอนใช้ ตัวของเราและตัวที่ลงมาทีหลังไม่โดน', run(assert) {
    const s = game({ p0: { monsters: { 1: 'aq_sagittarius', 3: 'aq_spear' }, mana: 5 },
      p1: { monsters: { 0: 'aq_spear', 2: 'aq_eques' }, hand: ['aq_tiro'] } });
    const src = s.players[0].monsters[1];
    const r = FX().run(s, [], eff('aq_sagittarius'), { source: src, player: 0, trigger: 'quick' });
    assert.ok(r.ok, r.reason);
    assert.strictEqual(s.players[0].mana, 4);
    assert.deepStrictEqual([s.players[1].monsters[0].atkMod, s.players[1].monsters[2].atkMod], [-300, -300]);
    assert.strictEqual(s.players[0].monsters[1].atkMod, 0, 'ตัวเองต้องไม่โดน');
    assert.strictEqual(s.players[0].monsters[3].atkMod, 0, 'ฝั่งเราต้องไม่โดน');
    FX().ops.specialSummon(s, [], { from: ['hand'], filter: { cardId: 'aq_tiro' }, count: 1 }, { player: 1 });
    const late = s.players[1].monsters.find(m => m && m.cardId === 'aq_tiro');
    assert.ok(late, 'ศัตรูเรียกมอนสเตอร์ใหม่ลงสนามได้');
    assert.strictEqual(late.atkMod, 0, 'ตัวที่ลงมาทีหลังไม่ได้รับผล');
  } },

  { name: 'AQ-02 ซาจิตตาริอุส: มานาไม่พอ (0 < 1) ใช้ไม่ได้ ไม่ลด ATK ใคร', run(assert) {
    const s = game({ p0: { monsters: { 1: 'aq_sagittarius' }, mana: 0 }, p1: { monsters: { 0: 'aq_eques' } } });
    const r = FX().run(s, [], eff('aq_sagittarius'), { source: s.players[0].monsters[1], player: 0, trigger: 'quick' });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.reason, 'notEnoughMana');
    assert.strictEqual(s.players[1].monsters[0].atkMod, 0);
  } },

  { name: 'AQ-03 กลาดิเอเตอร์โจมตีแล้วทำลายมอนสเตอร์ศัตรูในต่อสู้ = ชนะ จั่ว 1 ใบ (ได้ +1 มานา)', run(assert) {
    const s = game({ phase: 'battle', p0: { monsters: { 0: 'aq_gladiator' }, deck: ['aq_scutatus', 'aq_tiro'], mana: 3 },
      p1: { monsters: { 0: 'aq_spear' } } });
    const r = E().applyAction(s, { type: 'attack', player: 0, from: 0, to: 0 });
    assert.ok(r.ok, r.error);
    assert.deepStrictEqual(ids(s.players[1].grave), ['aq_spear']);
    assert.deepStrictEqual(ids(s.players[0].hand), ['aq_scutatus']);
    assert.strictEqual(s.players[0].mana, 4);
  } },

  { name: 'AQ-04 กลาดิเอเตอร์ถูกโจมตีแล้วทำลายผู้โจมตีได้ = ชนะ จั่ว 1 ใบ', run(assert) {
    const s = game({ phase: 'battle', turn: 4, p0: { monsters: { 0: 'aq_gladiator' }, deck: ['aq_scutatus', 'aq_tiro'], mana: 3 },
      p1: { monsters: { 0: 'aq_spear' } } });
    const r = E().applyAction(s, { type: 'attack', player: 1, from: 0, to: 0 });
    assert.ok(r.ok, r.error);
    assert.deepStrictEqual(ids(s.players[1].grave), ['aq_spear']);
    assert.strictEqual(s.players[0].hand.length, 1);
  } },

  { name: 'AQ-05 กลาดิเอเตอร์ไม่จั่วเมื่อไม่ชนะ: แพ้ต่อสู้ หรือตีมอนสเตอร์ท่าป้องกันที่ DEF สูงกว่าแล้วไม่มีใครถูกทำลาย', run(assert) {
    let s = game({ phase: 'battle', p0: { monsters: { 0: 'aq_gladiator' }, deck: ['aq_scutatus', 'aq_tiro'], mana: 3 },
      p1: { monsters: { 0: 'aq_eques' } } });   // ATK 2300 > 2000 กลาดิเอเตอร์แพ้
    assert.ok(E().applyAction(s, { type: 'attack', player: 0, from: 0, to: 0 }).ok);
    assert.deepStrictEqual(ids(s.players[0].grave), ['aq_gladiator']);
    assert.strictEqual(s.players[0].hand.length, 0);
    s = game({ phase: 'battle', p0: { monsters: { 0: 'aq_gladiator' }, deck: ['aq_scutatus', 'aq_tiro'], mana: 3 },
      p1: { monsters: { 0: { cardId: 'aq_consul', position: 'def' } } } });   // DEF 2200 > ATK 2000
    assert.ok(E().applyAction(s, { type: 'attack', player: 0, from: 0, to: 0 }).ok);
    assert.strictEqual(s.players[1].grave.length, 0, 'ไม่มีใครถูกทำลาย');
    assert.strictEqual(s.players[0].hand.length, 0, 'ไม่ชนะ ไม่จั่ว');
  } },

  { name: 'AQ-06 คอนซุล ignition (ช่องผู้นำ): จ่าย 2 เรียก Lv1 สองตัวจากเด็ค ข้ามสเปลและ Lv2-3', run(assert) {
    const s = game({ p0: { monsters: { 2: 'aq_consul' }, mana: 5,
      deck: ['aq_armory', 'aq_gladiator', 'aq_spear', 'aq_centurion', 'aq_tiro', 'aq_explorator'] } });
    const r = E().applyAction(s, { type: 'activateEffect', player: 0, slot: 2, effectId: 'summon_legion' });
    assert.ok(r.ok, r.error);
    assert.strictEqual(s.players[0].mana, 3);
    assert.deepStrictEqual(ids(s.players[0].monsters).filter(c => c !== 'aq_consul').sort(), ['aq_spear', 'aq_tiro']);
    assert.deepStrictEqual(ids(s.players[0].deck), ['aq_armory', 'aq_gladiator', 'aq_centurion', 'aq_explorator']);
  } },

  { name: 'AQ-07 คอนซุล: เด็คไม่มี Lv1 เรียกจากสุสานแทน (เด็ค/สุสานรวมกันได้ 2 ตัว)', run(assert) {
    const s = game({ p0: { monsters: { 2: 'aq_consul' }, mana: 5, deck: ['aq_armory', 'aq_tiro'], grave: ['aq_scutatus', 'aq_eques'] } });
    const r = E().applyAction(s, { type: 'activateEffect', player: 0, slot: 2, effectId: 'summon_legion' });
    assert.ok(r.ok, r.error);
    assert.deepStrictEqual(ids(s.players[0].monsters).filter(c => c !== 'aq_consul').sort(), ['aq_scutatus', 'aq_tiro']);
    assert.deepStrictEqual(ids(s.players[0].grave), ['aq_eques'], 'Lv2 ในสุสานห้ามถูกเรียก');
  } },

  { name: 'AQ-08 คอนซุล: มานาไม่พอ (1 < 2) ใช้ไม่ได้ ไม่เปลี่ยน state', run(assert) {
    const s = game({ p0: { monsters: { 2: 'aq_consul' }, mana: 1, deck: ['aq_tiro', 'aq_spear'] } });
    const r = E().applyAction(s, { type: 'activateEffect', player: 0, slot: 2, effectId: 'summon_legion' });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'NOT_ENOUGH_MANA');
    assert.strictEqual(s.players[0].mana, 1);
    assert.strictEqual(s.players[0].deck.length, 2);
  } },

  { name: 'AQ-09 คลังอาวุธ: จั่ว 2 ใบ ได้มานา +2 สุทธิ 0 (จ่าย 2)', run(assert) {
    const s = game({ p0: { hand: ['aq_armory'], deck: ['aq_spear', 'aq_tiro', 'aq_scutatus'], mana: 5 } });
    const r = FX().run(s, [], eff('aq_armory'), { source: s.players[0].hand[0], player: 0 });
    assert.ok(r.ok, r.reason);
    assert.deepStrictEqual(ids(s.players[0].hand), ['aq_armory', 'aq_spear', 'aq_tiro']);
    assert.strictEqual(s.players[0].mana, 5);
  } },

  { name: 'AQ-10 สงครามชิงชัย: จ่าย 3 ทำลายมอนสเตอร์ศัตรูเพียง 1 ตัว ของเราไม่โดน', run(assert) {
    const s = game({ p0: { hand: ['aq_war'], monsters: { 1: 'aq_spear' }, mana: 5 },
      p1: { monsters: { 0: 'aq_eques', 2: 'aq_consul' } } });
    const r = FX().run(s, [], eff('aq_war'), { source: s.players[0].hand[0], player: 0 });
    assert.ok(r.ok, r.reason);
    assert.strictEqual(s.players[0].mana, 2);
    assert.strictEqual(ids(s.players[1].monsters).length, 1, 'เหลือศัตรู 1 ตัว');
    assert.strictEqual(s.players[1].grave.length, 1);
    assert.deepStrictEqual(ids(s.players[0].monsters), ['aq_spear']);
  } },

  { name: 'AQ-11 สงครามชิงชัย: มานาไม่พอ (2 < 3) ใช้ไม่ได้ ไม่ทำลายใคร', run(assert) {
    const s = game({ p0: { hand: ['aq_war'], mana: 2 }, p1: { monsters: { 0: 'aq_eques' } } });
    const r = FX().run(s, [], eff('aq_war'), { source: s.players[0].hand[0], player: 0 });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.reason, 'notEnoughMana');
    assert.strictEqual(ids(s.players[1].monsters).length, 1);
    assert.strictEqual(s.players[0].mana, 2);
  } },

  { name: 'AQ-12 ข้อมูล: ทุก effects[] ใช้เฉพาะ trigger/op ที่มีจริง id ไม่ซ้ำ speed 1-3 cost ตรงกับมานาในการ์ด', run(assert) {
    for (const c of ALL()) {
      const seen = new Set();
      for (const e of c.effects) {
        assert.ok(!seen.has(e.id), `${c.id}: id ซ้ำ ${e.id}`); seen.add(e.id);
        assert.ok(TRIGGERS.includes(e.trigger), `${c.id}/${e.id}: trigger ${e.trigger}`);
        assert.ok([1, 2, 3].includes(e.speed), `${c.id}/${e.id}: speed`);
        assert.ok(e.cost && Number.isInteger(e.cost.mana) && e.cost.mana >= 0, `${c.id}/${e.id}: cost`);
        assert.strictEqual(e.cost.mana, Number(c.mana), `${c.id}/${e.id}: cost ต้องตรงกับฟิลด์ mana "${c.mana}"`);
        for (const s of e.do) assert.ok(FX().ops[s.op], `${c.id}/${e.id}: ไม่มี op ${s.op}`);
        for (const s of e.condition || []) assert.ok(FX().conditions[s.op], `${c.id}/${e.id}: ไม่มี condition ${s.op}`);
        if (e.limit) assert.ok(['turn', 'game'].includes(e.limit.per), `${c.id}/${e.id}: limit.per`);
      }
    }
    assert.strictEqual(eff('aq_sagittarius').trigger, 'quick');
    assert.strictEqual(eff('aq_sagittarius').speed, 2);
  } },

  { name: 'AQ-13 การ์ดที่ชิ้นส่วนยังทำไม่ได้คงเป็น effects: [] (ตามรายงานขั้น 4D) และมีเอฟเฟกต์เฉพาะ 14 ใบนี้', run(assert) {
    const all = ALL();
    assert.strictEqual(all.length, 22);
    assert.deepStrictEqual(all.filter(c => c.effects.length).map(c => c.id).sort(), WITH_EFFECTS.slice().sort());
    for (const c of all.filter(c => !WITH_EFFECTS.includes(c.id))) assert.deepStrictEqual(c.effects, [], c.id);
    for (const id of WITH_EFFECTS) assert.strictEqual(cardDef(id).effects.length, id === 'aq_castra' ? 2 : 1, id);   // คาสตรามี 2 เอฟเฟกต์ (ลดมานา + aura)
    for (const id of NO_EFFECT_BY_DESIGN) assert.deepStrictEqual(cardDef(id).effects, [], id);
  } }
];

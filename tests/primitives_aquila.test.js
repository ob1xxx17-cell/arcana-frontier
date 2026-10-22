// tests/primitives_aquila.test.js - เทสต์ชิ้นส่วนใหม่ขั้น 4E-2B และการ์ดอาควิลา/ไดโนที่แปลงด้วยชิ้นส่วนเหล่านี้
// aura ต่อเนื่อง, condition (inLeaderSlot/controls/hasUnder), atkBelowSource, pick lowestAtk, search distinctName,
// op choice, op reduceCost, ใช้เอฟเฟกต์มอนสเตอร์จากมือ, selector zone:'under' + preventDestruction แบบมีเงื่อนไข
// ทุกของใหม่มีข้อบวกและข้อลบ สเปลยังสั่งผ่าน applyAction ไม่ได้จึงรันผ่าน CG.effects.run ตรง ๆ (เหมือน aquila_effects.test.js)
require('./fixtures');
const E = () => CG.engine;
const FX = () => CG.effects;
const game = o => CG.test.makeGame(Object.assign({ deckA: 'aquila', deckB: 'aquila', seed: 1 }, o));
const ALL = () => [].concat(CG.cards.aquila.main, CG.cards.aquila.extra);
const cardDef = id => ALL().concat(CG.cards.dinosaur.main).find(c => c.id === id);
const eff = (id, i) => cardDef(id).effects[i || 0];
const ids = list => list.filter(Boolean).map(c => c.cardId);
const atk = m => E().atk(m);
const refresh = s => FX().refreshAuras(s);
const mon = (s, p, slot) => s.players[p].monsters[slot];
const run = (s, id, src, extra) => FX().run(s, [], eff(id, extra && extra.i), { source: src, player: src.controller });
const handCard = (s, p, cardId) => s.players[p].hand.find(c => c.cardId === cardId);

module.exports = [
  // ---------------- continuous aura ----------------
  { name: 'P4B-01 aura (+) เซนทูเรียนในช่องผู้นำ: มอนสเตอร์อาควิลาอื่นของเรา +300 ATK ตัวเองไม่ได้', run(assert) {
    const s = game({ p0: { monsters: { 0: 'aq_spear', 1: 'aq_tiro', 2: 'aq_centurion' } } });
    refresh(s);
    assert.strictEqual(atk(mon(s, 0, 0)), 1100);
    assert.strictEqual(atk(mon(s, 0, 1)), 1100);
    assert.strictEqual(atk(mon(s, 0, 2)), 2200, 'ตัวเองไม่ได้ (other:true)');
    assert.strictEqual(mon(s, 0, 0).atkMod, 0, 'ไม่ใช่ค่าถาวร ไม่แตะ atkMod');
  } },

  { name: 'P4B-02 aura (-) ไม่ได้ผลเมื่อ: ไม่อยู่ช่องผู้นำ / ไม่ใช่อาควิลา / ฝั่งศัตรู / คว่ำอยู่', run(assert) {
    let s = game({ p0: { monsters: { 0: 'aq_spear', 1: 'aq_centurion' } } });
    refresh(s);
    assert.strictEqual(atk(mon(s, 0, 0)), 800, 'ช่อง 1 ไม่ใช่ช่องผู้นำ');
    s = game({ p0: { monsters: { 0: 'fx_l1a', 1: 'aq_spear', 2: 'aq_centurion', 3: { cardId: 'aq_tiro', faceDown: true } } },
      p1: { monsters: { 0: 'aq_spear' } } });
    refresh(s);
    assert.strictEqual(atk(mon(s, 0, 0)), 1000, 'ไม่ใช่มอนสเตอร์อาควิลา (ไม่มี tag)');
    assert.strictEqual(atk(mon(s, 0, 1)), 1100, 'ตัวอาควิลาหงายได้ผล');
    assert.strictEqual(atk(mon(s, 1, 0)), 800, 'ฝั่งศัตรูไม่ได้');
    assert.strictEqual(atk(mon(s, 0, 3)), 800, 'ตัวคว่ำไม่ได้');
  } },

  { name: 'P4B-03 aura หายเมื่อต้นทางออกจากสนาม (ถูกทำลาย/ส่งสุสาน) หรือหลุดจากช่องผู้นำ และไม่ใช่ค่าถาวร', run(assert) {
    let s = game({ p0: { monsters: { 0: 'aq_spear', 2: 'aq_centurion' } } });
    refresh(s);
    assert.strictEqual(atk(mon(s, 0, 0)), 1100);
    FX().ops.destroy(s, [], { target: { side: 'self', zone: 'monster', filter: { cardId: 'aq_centurion' } } }, { player: 0 });
    assert.strictEqual(atk(mon(s, 0, 0)), 800, 'ทำลายต้นทาง aura หายทันที (ไม่ต้องรีเฟรชเอง)');
    assert.strictEqual(mon(s, 0, 0).auraAtk, undefined);
    assert.strictEqual(mon(s, 0, 0).atkMod, 0);
    s = game({ p0: { monsters: { 0: 'aq_spear', 2: 'aq_centurion' } } });
    refresh(s);
    FX().ops.sendToGrave(s, [], { target: { side: 'self', zone: 'monster', filter: { cardId: 'aq_centurion' } } }, { player: 0 });
    assert.strictEqual(atk(mon(s, 0, 0)), 800, 'ส่งสุสานก็หาย');
    s = game({ p0: { monsters: { 0: 'aq_spear', 2: 'aq_centurion' } } });
    refresh(s);
    s.players[0].monsters[1] = s.players[0].monsters[2]; s.players[0].monsters[2] = null;   // ย้ายออกจากช่องผู้นำ
    refresh(s);
    assert.strictEqual(atk(mon(s, 0, 0)), 800, 'เงื่อนไขไม่จริง = ไม่มีผล');
  } },

  { name: 'P4B-04 aura ผ่าน applyAction จริง: ลงเซนทูเรียนแล้วตัวอื่นแรงขึ้น และ clone/แพ้ต่อสู้ใช้ค่ารวม aura', run(assert) {
    const s = game({ phase: 'battle', turn: 3, p0: { monsters: { 0: 'aq_spear', 2: 'aq_centurion' } }, p1: { monsters: { 0: { cardId: 'aq_tiro', position: 'atk' } } } });
    const c = E().cloneState(s);
    assert.strictEqual(atk(c.players[0].monsters[2]), 2200);
    // นักรบหอก 800+300=1100 ชนไทโร 800: ชนะและทำลาย (ถ้าไม่มี aura 800 vs 800 เสมอทั้งคู่ตาย)
    const r = E().applyAction(s, { type: 'attack', player: 0, from: 0, to: 0 });
    assert.ok(r.ok, r.error);
    assert.deepStrictEqual(ids(s.players[1].grave), ['aq_tiro']);
    assert.deepStrictEqual(ids(s.players[0].monsters), ['aq_spear', 'aq_centurion'], 'ตัวเราไม่ตาย เพราะ aura ทำให้ ATK สูงกว่า');
  } },

  // ---------------- condition ----------------
  { name: 'P4B-05 inLeaderSlot (+/-)', run(assert) {
    const s = game({ p0: { monsters: { 2: 'aq_consul', 3: 'aq_spear' } } });
    const c = FX().conditions.inLeaderSlot;
    assert.strictEqual(c(s, { op: 'inLeaderSlot' }, { source: mon(s, 0, 2), player: 0 }), true);
    assert.strictEqual(c(s, { op: 'inLeaderSlot' }, { source: mon(s, 0, 3), player: 0 }), false);
    mon(s, 0, 2).faceDown = true;
    assert.strictEqual(c(s, { op: 'inLeaderSlot' }, { source: mon(s, 0, 2), player: 0 }), false, 'คว่ำไม่นับ');
    s.config.leaderSlot = 3;   // ปรับได้ด้วย config
    assert.strictEqual(c(s, { op: 'inLeaderSlot' }, { source: mon(s, 0, 3), player: 0 }), true);
  } },

  { name: 'P4B-06 controls ตัวกรอง + จำนวนขั้นต่ำ (+/-) นับเฉพาะตัวหงายและฝั่งที่ระบุ', run(assert) {
    const s = game({ p0: { monsters: { 0: 'aq_spear', 1: { cardId: 'aq_tiro', faceDown: true }, 2: 'fx_l1a' } }, p1: { monsters: { 0: 'aq_eques', 1: 'aq_spear' } } });
    const c = (step) => FX().conditions.controls(s, Object.assign({ op: 'controls' }, step), { player: 0, source: null });
    assert.strictEqual(c({ filter: { tag: 'aquila' } }), true);
    assert.strictEqual(c({ filter: { tag: 'aquila' }, min: 2 }), false, 'ตัวคว่ำและ fx_l1a ไม่นับ');
    assert.strictEqual(c({ filter: { tag: 'aquila' }, side: 'opp', min: 2 }), true);
    assert.strictEqual(c({ filter: { tag: 'dino' } }), false);
    assert.strictEqual(c({ filter: { levelMin: 2 } }), false);
  } },

  { name: 'P4B-07 hasUnder (+/-) ตัวใต้การ์ดและตัวกรอง', run(assert) {
    const s = game({ p0: { monsters: { 0: 'aq_consul', 1: 'aq_spear' } } });
    const c = (src, step) => FX().conditions.hasUnder(s, Object.assign({ op: 'hasUnder' }, step), { source: src, player: 0 });
    const m = mon(s, 0, 0);
    assert.strictEqual(c(m), false, 'ไม่มีตัวใต้');
    m.under.push(E().newInstance(s, E().findCard('aq_spear'), 0));
    assert.strictEqual(c(m), true);
    assert.strictEqual(c(m, { min: 2 }), false);
    assert.strictEqual(c(m, { filter: { cardId: 'aq_tiro' } }), false);
    assert.strictEqual(c(mon(s, 0, 1)), false, 'ตัวอื่นไม่มีตัวใต้');
  } },

  // ---------------- atkBelowSource ----------------
  { name: 'P4B-08 อิมเพเรเตอร์ onSummon: ทำลายศัตรูที่ ATK น้อยกว่าเท่านั้น (เท่ากัน/สูงกว่า/ของเราไม่โดน)', run(assert) {
    const s = game({ p0: { monsters: { 2: 'aq_imperator', 0: 'aq_spear' } },
      p1: { monsters: { 0: 'aq_spear', 1: 'aq_eques', 2: 'fx_l3a', 3: 'fx_fusion' } } });   // 800, 2300, 2400, 2600
    const ev = [];
    E().fire(s, ev, 'onSummon', { source: mon(s, 0, 2) });
    assert.deepStrictEqual(ids(s.players[1].monsters), ['fx_l3a', 'fx_fusion'], 'เท่ากัน (2400) และสูงกว่า (2600) รอด');
    assert.deepStrictEqual(ids(s.players[1].grave).sort(), ['aq_eques', 'aq_spear']);
    assert.deepStrictEqual(ids(s.players[0].monsters), ['aq_spear', 'aq_imperator'], 'ของเราไม่โดน');
    assert.ok(ev.some(e => e.type === 'effectActivated' && e.effectId === 'summon_purge'));
  } },

  { name: 'P4B-09 atkBelowSource (-) ไม่มีศัตรูที่ต่ำกว่า = ไม่ทำลายใคร และไม่ยิงตอนไม่ใช่ onSummon / ไม่มีต้นทาง = ไม่ตรง', run(assert) {
    const s = game({ p0: { monsters: { 2: 'aq_imperator' } }, p1: { monsters: { 0: 'fx_l3a', 1: 'fx_fusion' } } });
    E().fire(s, [], 'onSummon', { source: mon(s, 0, 2) });
    assert.strictEqual(ids(s.players[1].monsters).length, 2);
    assert.strictEqual(s.players[1].grave.length, 0);
    assert.strictEqual(FX().matchFilter(mon(s, 1, 0), { atkBelowSource: true }, {}), false, 'ไม่มี ctx.source');
    // ATK ต้นทางรวม aura: เซนทูเรียนอยู่ช่องผู้นำอื่นไม่ช่วย อิมเพเรเตอร์ ATK 2400+0 แต่ศัตรู 2300 โดนทำลายตามค่าจริง
    const t = game({ p0: { monsters: { 2: 'aq_imperator' } }, p1: { monsters: { 0: 'aq_eques' } } });
    mon(t, 1, 0).atkMod = 200;   // 2300+200 = 2500 สูงกว่า 2400
    E().fire(t, [], 'onSummon', { source: mon(t, 0, 2) });
    assert.strictEqual(ids(t.players[1].monsters).length, 1, 'ใช้ ATK ปัจจุบัน ไม่ใช่ ATK พื้นฐาน');
  } },

  // ---------------- selector: ATK ต่ำสุดของเรา + คาสตรา aura ----------------
  { name: 'P4B-10 คาสตรา aura (+): อาควิลาของเราที่ ATK ต่ำสุด +500 (เสมอกันได้ทุกตัว) และคำนวณใหม่เมื่อตัวต่ำสุดตาย', run(assert) {
    const s = game({ p0: { fieldSpell: 'aq_castra', monsters: { 0: 'aq_spear', 1: 'aq_tiro', 2: 'aq_eques' } } });
    refresh(s);
    assert.deepStrictEqual([0, 1, 2].map(i => atk(mon(s, 0, i))), [1300, 1300, 2300]);
    FX().ops.destroy(s, [], { target: { side: 'self', zone: 'monster', filter: { cardId: 'aq_spear' } } }, { player: 0 });
    FX().ops.destroy(s, [], { target: { side: 'self', zone: 'monster', filter: { cardId: 'aq_tiro' } } }, { player: 0 });
    assert.strictEqual(atk(mon(s, 0, 2)), 2800, 'เหลือตัวเดียวก็เป็นตัวต่ำสุด');
  } },

  { name: 'P4B-11 คาสตรา aura (-): ไม่มีคาสตรา/ตัวต่ำสุดไม่ใช่อาควิลา/ฝั่งศัตรู = ไม่ได้ ; คาสตราหงายเท่านั้น ; ร่วมกับเซนทูเรียนไม่วน', run(assert) {
    let s = game({ p0: { monsters: { 0: 'aq_spear' } } });
    refresh(s);
    assert.strictEqual(atk(mon(s, 0, 0)), 800, 'ไม่มีคาสตรา');
    s = game({ p0: { fieldSpell: 'aq_castra', monsters: { 0: 'fx_l1c', 1: 'aq_spear', 2: 'aq_eques' } }, p1: { monsters: { 0: 'aq_tiro' } } });
    refresh(s);
    assert.strictEqual(atk(mon(s, 0, 0)), 600, 'fx_l1c ต่ำสุดแต่ไม่ใช่อาควิลา');
    assert.strictEqual(atk(mon(s, 0, 1)), 1300, 'ต่ำสุดในหมู่อาควิลา');
    assert.strictEqual(atk(mon(s, 1, 0)), 500 + 300, 'ศัตรูไม่ได้ (ATK 800 ของไทโร)');
    s.players[0].fieldSpell.faceDown = true; refresh(s);
    assert.strictEqual(atk(mon(s, 0, 1)), 800, 'คาสตรา คว่ำ = ไม่มีผล');
    s = game({ p0: { fieldSpell: 'aq_castra', monsters: { 0: 'aq_spear', 1: 'aq_eques', 2: 'aq_centurion' } } });
    refresh(s);
    assert.deepStrictEqual([0, 1, 2].map(i => atk(mon(s, 0, i))), [1600, 2600, 2200], 'หอก 800+300 (เซนทูเรียน) แล้ว +500 เพราะต่ำสุด');
    refresh(s);
    assert.strictEqual(atk(mon(s, 0, 0)), 1600, 'รีเฟรชซ้ำไม่สะสม');
  } },

  // ---------------- search distinctName ----------------
  { name: 'P4B-12 เกณฑ์ทหาร (+): ค้นอาควิลา Lv1 2 ใบต่างชื่อ จากเด็คที่มีซ้ำ ข้ามใบชื่อซ้ำ', run(assert) {
    const s = game({ p0: { hand: ['aq_recruit'], mana: 3, deck: ['aq_spear', 'aq_spear', 'aq_eques', 'aq_tiro', 'aq_scutatus'] } });
    const r = run(s, 'aq_recruit', handCard(s, 0, 'aq_recruit'));
    assert.ok(r.ok, r.reason);
    assert.strictEqual(s.players[0].mana, 2);
    assert.deepStrictEqual(ids(s.players[0].hand), ['aq_recruit', 'aq_spear', 'aq_tiro']);
    assert.deepStrictEqual(ids(s.players[0].deck), ['aq_spear', 'aq_eques', 'aq_scutatus'], 'Lv2 และหอกใบที่สองยังอยู่');
  } },

  { name: 'P4B-13 distinctName (-): มีแต่ชื่อเดียว ได้ใบเดียว ; ไม่ใส่ distinctName ได้ซ้ำชื่อ ; คอลล์ไดโนไม่ค้นอาควิลา', run(assert) {
    let s = game({ p0: { hand: ['aq_recruit'], mana: 3, deck: ['aq_spear', 'aq_spear', 'aq_spear'] } });
    assert.ok(run(s, 'aq_recruit', handCard(s, 0, 'aq_recruit')).ok);
    assert.deepStrictEqual(ids(s.players[0].hand), ['aq_recruit', 'aq_spear']);
    s = game({ p0: { mana: 3, deck: ['aq_spear', 'aq_spear'] } });
    FX().ops.search(s, [], { from: 'deck', filter: { tag: 'aquila' }, to: 'hand', count: 2 }, { player: 0 });
    assert.deepStrictEqual(ids(s.players[0].hand), ['aq_spear', 'aq_spear'], 'เดิมยังได้ซ้ำชื่อตามปกติ');
    s = game({ deckA: 'dinosaur', p0: { hand: ['dino_call'], mana: 3, deck: ['dino_egg', 'dino_egg', 'dino_trike', 'dino_compy', 'dino_ptero'] } });
    const rr = FX().run(s, [], cardDef('dino_call').effects[0], { source: handCard(s, 0, 'dino_call'), player: 0 });
    assert.ok(rr.ok, rr.reason);
    assert.deepStrictEqual(ids(s.players[0].hand), ['dino_call', 'dino_egg', 'dino_compy'], 'ไดโน Lv1 ต่างชื่อ ข้าม Lv2');
  } },

  // ---------------- choice ----------------
  { name: 'P4B-14 ระดมพล (+): มี Lv1 ในมือ = ข้อ 1 เรียกลงสนาม ; ไม่มี = ข้อ 2 ค้นจากเด็ค (เลือกข้อแรกที่ทำได้จริง)', run(assert) {
    let s = game({ p0: { hand: ['aq_muster', 'aq_tiro'], mana: 3, deck: ['aq_spear', 'aq_eques'] } });
    const ev = [];
    let r = FX().run(s, ev, eff('aq_muster'), { source: handCard(s, 0, 'aq_muster'), player: 0 });
    assert.ok(r.ok, r.reason);
    assert.strictEqual(s.players[0].mana, 2);
    assert.deepStrictEqual(ids(s.players[0].monsters), ['aq_tiro']);
    assert.deepStrictEqual(ids(s.players[0].deck), ['aq_spear', 'aq_eques'], 'ข้อ 2 ไม่ทำ');
    assert.ok(ev.some(e => e.type === 'choiceMade' && e.index === 0));
    s = game({ p0: { hand: ['aq_muster', 'aq_eques'], mana: 3, deck: ['aq_war', 'aq_spear'] } });
    r = FX().run(s, [], eff('aq_muster'), { source: handCard(s, 0, 'aq_muster'), player: 0 });
    assert.ok(r.ok);
    assert.deepStrictEqual(ids(s.players[0].hand).sort(), ['aq_eques', 'aq_muster', 'aq_spear'], 'ในมือไม่มี Lv1 ค้นหอกจากเด็ค');
    assert.strictEqual(ids(s.players[0].monsters).length, 0);
  } },

  { name: 'P4B-15 choice (-): ช่องเต็ม -> ข้อ 2 ; ทำไม่ได้ทั้งสองข้อ = ไม่เปลี่ยนอะไรนอกจากจ่ายมานา ; pick บังคับข้อ ; ทำได้ข้อเดียวต่อครั้ง', run(assert) {
    let s = game({ p0: { hand: ['aq_muster', 'aq_tiro'], mana: 3, deck: ['aq_spear'],
      monsters: { 0: 'aq_eques', 1: 'aq_eques', 2: 'aq_eques', 3: 'aq_eques', 4: 'aq_eques' } } });
    assert.ok(FX().run(s, [], eff('aq_muster'), { source: handCard(s, 0, 'aq_muster'), player: 0 }).ok);
    assert.deepStrictEqual(ids(s.players[0].hand).sort(), ['aq_muster', 'aq_spear', 'aq_tiro'], 'ช่องเต็มเรียกไม่ได้ -> ค้น');
    s = game({ p0: { hand: ['aq_muster'], mana: 3, deck: ['aq_eques', 'aq_war'] } });
    assert.ok(FX().run(s, [], eff('aq_muster'), { source: handCard(s, 0, 'aq_muster'), player: 0 }).ok);
    assert.strictEqual(s.players[0].hand.length, 1);
    assert.strictEqual(s.players[0].deck.length, 2);
    assert.strictEqual(s.players[0].mana, 2);
    s = game({ p0: { hand: ['aq_muster', 'aq_tiro'], mana: 3, deck: ['aq_spear'] } });
    FX().ops.choice(s, [], { choose: 'player', pick: 1, options: eff('aq_muster').do[0].options }, { player: 0, source: handCard(s, 0, 'aq_muster') });
    assert.deepStrictEqual(ids(s.players[0].monsters), [], 'pick 1 = ค้นเท่านั้น ไม่เรียกทิโร');
    assert.ok(ids(s.players[0].hand).includes('aq_spear'));
    s = game({ p0: { hand: ['aq_muster', 'aq_tiro', 'aq_scutatus'], mana: 3, deck: ['aq_spear'] } });
    FX().run(s, [], eff('aq_muster'), { source: handCard(s, 0, 'aq_muster'), player: 0 });
    assert.strictEqual(ids(s.players[0].monsters).length, 1, 'เรียก 1 ตัวเท่านั้น');
  } },

  // ---------------- reduceCost ----------------
  { name: 'P4B-16 reduceCost (+): คาสตราลดมานาเอฟเฟกต์มอนสเตอร์อาควิลา 1 ; จำกัดครั้งต่อเทิร์น เทิร์นถัดไปได้อีก', run(assert) {
    const s = game({ p0: { fieldSpell: 'aq_castra', monsters: { 2: 'aq_consul' }, mana: 5, deck: ['aq_spear', 'aq_tiro', 'aq_scutatus', 'aq_spear'] } });
    const ev = [];
    let r = FX().run(s, ev, eff('aq_consul'), { source: mon(s, 0, 2), player: 0 });
    assert.ok(r.ok, r.reason);
    assert.strictEqual(s.players[0].mana, 4, 'คอนซุลมานา 2 ลดเหลือ 1');
    assert.ok(ev.some(e => e.type === 'costReduced' && e.cardId === 'aq_castra' && e.amount === 1));
    r = FX().run(s, [], eff('aq_consul'), { source: mon(s, 0, 2), player: 0 });
    assert.ok(r.ok);
    assert.strictEqual(s.players[0].mana, 2, 'ครั้งที่ 2 ในเทิร์นเดียวกันจ่ายเต็ม 2');
    s.turn += 2;
    FX().run(s, [], eff('aq_consul'), { source: mon(s, 0, 2), player: 0 });
    assert.strictEqual(s.players[0].mana, 1, 'เทิร์นใหม่ลดได้อีก');
  } },

  { name: 'P4B-17 reduceCost (-): สเปล/ไม่มีคาสตรา/คาสตราศัตรู/เอฟเฟกต์ต้นทุน 0 = ไม่ลดและไม่เสียโควตา ; มานาไม่พอยังใช้ไม่ได้', run(assert) {
    let s = game({ p0: { fieldSpell: 'aq_castra', hand: ['aq_armory'], mana: 5, deck: ['aq_spear', 'aq_tiro', 'aq_scutatus'] } });
    assert.ok(FX().run(s, [], eff('aq_armory'), { source: handCard(s, 0, 'aq_armory'), player: 0 }).ok);
    assert.strictEqual(s.players[0].mana, 5, 'คลังอาวุธ cost 2 จั่ว 2 ได้คืน 2 = ไม่เปลี่ยน แปลว่าจ่ายเต็ม 2 (สเปลไม่ถูกลด)');
    s = game({ p0: { monsters: { 2: 'aq_consul' }, mana: 5, deck: ['aq_spear', 'aq_tiro'] } });
    FX().run(s, [], eff('aq_consul'), { source: mon(s, 0, 2), player: 0 });
    assert.strictEqual(s.players[0].mana, 3, 'ไม่มีคาสตรา จ่ายเต็ม');
    s = game({ p0: { monsters: { 2: 'aq_consul' }, mana: 5, deck: ['aq_spear', 'aq_tiro'] }, p1: { fieldSpell: 'aq_castra' } });
    FX().run(s, [], eff('aq_consul'), { source: mon(s, 0, 2), player: 0 });
    assert.strictEqual(s.players[0].mana, 3, 'คาสตราของศัตรูไม่ลดให้เรา');
    s = game({ p0: { fieldSpell: 'aq_castra', monsters: { 1: 'aq_scutatus', 2: 'aq_consul' }, mana: 5, deck: ['aq_spear', 'aq_tiro'] } });
    FX().run(s, [], eff('aq_scutatus'), { source: mon(s, 0, 1), player: 0 });   // cost 0 ไม่ใช้โควตา
    assert.strictEqual(FX().run(s, [], eff('aq_consul'), { source: mon(s, 0, 2), player: 0 }).ok, true);
    assert.strictEqual(s.players[0].mana, 4, 'ยังลดได้เพราะ cost 0 ก่อนหน้าไม่กินโควตา');
    s = game({ p0: { fieldSpell: 'aq_castra', monsters: { 2: 'aq_consul' }, mana: 0 } });
    const r = FX().run(s, [], eff('aq_consul'), { source: mon(s, 0, 2), player: 0 });
    assert.strictEqual(r.reason, 'notEnoughMana', 'ลด 1 แล้วยังเหลือ 1 > 0');
    assert.strictEqual(s.players[0].mana, 0);
    assert.strictEqual(s.effectLimits, undefined, 'เหตุที่ล้มเหลวไม่กินโควตา');
  } },

  // ---------------- ใช้จากมือ ----------------
  { name: 'P4B-18 ทิโรจากมือ (+): คุมอาควิลา -> activateEffect handIdx เรียกตัวเองลงสนาม จ่าย 1 ; อยู่ในรายการ legal ; ลดมานาได้ด้วยคาสตรา', run(assert) {
    const s = game({ p0: { hand: ['aq_tiro'], monsters: { 0: 'aq_spear' }, mana: 3 } });
    const act = { type: 'activateEffect', player: 0, handIdx: 0, effectId: 'self_summon' };
    assert.ok(E().getLegalActions(s, 0).some(a => a.type === 'activateEffect' && a.handIdx === 0), 'legal actions มีใช้จากมือ');
    const r = E().applyAction(s, act);
    assert.ok(r.ok, r.error);
    assert.deepStrictEqual(ids(s.players[0].monsters).sort(), ['aq_spear', 'aq_tiro']);
    assert.strictEqual(s.players[0].hand.length, 0);
    assert.strictEqual(s.players[0].mana, 2);
    assert.ok(r.events.some(e => e.type === 'effectActivated' && e.effectId === 'self_summon'));
    const t = game({ p0: { hand: ['aq_tiro'], fieldSpell: 'aq_castra', monsters: { 0: 'aq_spear' }, mana: 0 } });
    assert.ok(E().applyAction(t, act).ok, 'มานา 0 ใช้ได้เพราะคาสตราลด 1');
    assert.strictEqual(t.players[0].mana, 0);
  } },

  { name: 'P4B-19 ทิโรจากมือ (-): ไม่คุมอาควิลา / ช่องเต็ม / มานาไม่พอ / ใช้ซ้ำในเทิร์น / ผิดเฟส = ปฏิเสธ ไม่เปลี่ยน state', run(assert) {
    const act = { type: 'activateEffect', player: 0, handIdx: 0, effectId: 'self_summon' };
    const fail = (s, code) => {
      const snap = JSON.stringify(s.players);
      const r = E().applyAction(s, act);
      assert.strictEqual(r.ok, false); assert.strictEqual(r.error, code);
      assert.strictEqual(JSON.stringify(s.players), snap, 'state ต้องไม่เปลี่ยน');
    };
    fail(game({ p0: { hand: ['aq_tiro'], mana: 3 } }), 'CONDITION_FAILED');
    fail(game({ p0: { hand: ['aq_tiro'], monsters: { 0: 'fx_l1a' }, mana: 3 } }), 'CONDITION_FAILED');
    fail(game({ p0: { hand: ['aq_tiro'], monsters: { 0: 'aq_spear', 1: 'aq_spear', 2: 'aq_spear', 3: 'aq_spear', 4: 'aq_spear' }, mana: 3 } }), 'CONDITION_FAILED');
    fail(game({ p0: { hand: ['aq_tiro'], monsters: { 0: 'aq_spear' }, mana: 0 } }), 'NOT_ENOUGH_MANA');
    fail(game({ phase: 'battle', p0: { hand: ['aq_tiro'], monsters: { 0: 'aq_spear' }, mana: 3 } }), 'WRONG_PHASE');
    const s = game({ p0: { hand: ['aq_tiro', 'aq_tiro'], monsters: { 0: 'aq_spear' }, mana: 5 } });
    assert.ok(E().applyAction(s, act).ok);
    fail(s, 'LIMIT_REACHED');
  } },

  { name: 'P4B-20 การใช้จากมือไม่กระทบบนสนามเดิม: เอฟเฟกต์ไม่มี from ใช้จากมือไม่ได้ ตัว from:hand ใช้บนสนามไม่ได้ สเปล/ระบุ slot+handIdx พร้อมกันไม่ได้ ; คอนซุลบนสนามยังใช้ได้', run(assert) {
    let s = game({ p0: { hand: ['aq_consul'], mana: 5, deck: ['aq_spear', 'aq_tiro'] } });
    assert.strictEqual(E().applyAction(s, { type: 'activateEffect', player: 0, handIdx: 0, effectId: 'summon_legion' }).error, 'WRONG_ZONE');
    s = game({ p0: { monsters: { 0: 'aq_tiro', 1: 'aq_spear' }, mana: 5 } });
    assert.strictEqual(E().applyAction(s, { type: 'activateEffect', player: 0, slot: 0, effectId: 'self_summon' }).error, 'WRONG_ZONE');
    s = game({ p0: { hand: ['aq_armory'], mana: 5 } });
    assert.strictEqual(E().applyAction(s, { type: 'activateEffect', player: 0, handIdx: 0, effectId: 'armory_draw' }).error, 'NOT_MONSTER');
    s = game({ p0: { hand: ['aq_tiro'], monsters: { 0: 'aq_spear' }, mana: 5 } });
    assert.strictEqual(E().applyAction(s, { type: 'activateEffect', player: 0, handIdx: 0, slot: 0, effectId: 'self_summon' }).error, 'INVALID_SLOT');
    assert.strictEqual(E().applyAction(s, { type: 'activateEffect', player: 0, handIdx: 7, effectId: 'self_summon' }).error, 'INVALID_HAND_INDEX');
    s = game({ p0: { monsters: { 2: 'aq_consul' }, mana: 5, deck: ['aq_spear', 'aq_tiro'] } });
    assert.ok(E().applyAction(s, { type: 'activateEffect', player: 0, slot: 2, effectId: 'summon_legion' }).ok, 'ใช้บนสนามเดิมยังได้');
    assert.strictEqual(s.players[0].mana, 3);
  } },

  // ---------------- zone:'under' + preventDestruction แบบมีเงื่อนไข ----------------
  { name: 'P4B-21 under+preventDestruction (+/-): มีตัวใต้ = ไม่ถูกทำลาย ส่งตัวใต้ 1 ใบลงสุสาน ATK -500 สะสม ; หมดตัวใต้ = ถูกทำลายปกติ', run(assert) {
    const main = CG.cards.fixture.main;
    main.push({ id: 'fx_guardian', name: 'fx_guardian', type: 'monster', level: 3, atk: 2400, def: 2000, mana: '0', count: 1, leader: false, proposed_level: false, text: '',
      effects: [{ id: 'shield', trigger: 'continuous', speed: 1, cost: { mana: 0 }, condition: [{ op: 'hasUnder', filter: { tag: 'aquila' } }],
        do: [{ op: 'preventDestruction', instead: [{ op: 'sendToGrave', target: { zone: 'under', count: 1 } },
          { op: 'modifyStat', target: 'self', stat: 'atk', amount: -500, duration: 'permanent' }] }] }] });
    try {
      const s = game({ p0: { monsters: { 1: 'fx_guardian', 3: 'aq_spear' } }, p1: { monsters: { 0: 'aq_eques' } } });
      const g = mon(s, 0, 1);
      g.under.push(E().newInstance(s, E().findCard('aq_spear'), 0), E().newInstance(s, E().findCard('aq_tiro'), 0));
      const kill = () => FX().ops.destroy(s, [], { target: { side: 'opp', zone: 'monster', filter: { cardId: 'fx_guardian' } } }, { player: 1 });
      const ev = []; FX().ops.destroy(s, ev, { target: { side: 'opp', zone: 'monster', filter: { cardId: 'fx_guardian' } } }, { player: 1 });
      assert.strictEqual(mon(s, 0, 1), g, 'ยังอยู่บนสนาม');
      assert.deepStrictEqual(ids(g.under), ['aq_tiro'], 'ตัวใต้ใบแรกลงสุสาน');
      assert.deepStrictEqual(ids(s.players[0].grave), ['aq_spear']);
      assert.strictEqual(atk(g), 1900); assert.strictEqual(g.atkMod, -500);
      assert.ok(ev.some(e => e.type === 'destroyPrevented'));
      kill();
      assert.strictEqual(mon(s, 0, 1), g); assert.strictEqual(g.under.length, 0);
      assert.strictEqual(atk(g), 1400, 'สะสมถาวร');
      assert.deepStrictEqual(ids(s.players[0].grave).sort(), ['aq_spear', 'aq_tiro']);
      kill();
      assert.strictEqual(mon(s, 0, 1), null, 'ไม่มีตัวใต้แล้ว ถูกทำลายตามปกติ');
      assert.ok(ids(s.players[0].grave).includes('fx_guardian'));
      assert.strictEqual(ids(s.players[0].monsters).includes('aq_spear'), true, 'ตัวอื่นของเราไม่เกี่ยว');
    } finally { main.pop(); }
  } },

  { name: 'P4B-22 selector zone:under (-): เลือกเฉพาะตัวใต้ของต้นทาง ไม่แตะกองอื่น ; ไม่มีต้นทางบนสนามไม่ทำอะไร ; ตัวใต้ที่ไม่ตรงตัวกรองไม่โดน', run(assert) {
    const s = game({ p0: { monsters: { 0: 'aq_consul', 1: 'aq_eques' } } });
    const a = mon(s, 0, 0), b = mon(s, 0, 1);
    a.under.push(E().newInstance(s, E().findCard('aq_spear'), 0), E().newInstance(s, E().findCard('aq_tiro'), 0));
    b.under.push(E().newInstance(s, E().findCard('aq_scutatus'), 0));
    FX().ops.sendToGrave(s, [], { target: { zone: 'under', filter: { cardId: 'aq_tiro' }, count: 1 } }, { player: 0, source: a });
    assert.deepStrictEqual(ids(a.under), ['aq_spear']);
    assert.deepStrictEqual(ids(b.under), ['aq_scutatus'], 'กองของตัวอื่นไม่โดน');
    FX().ops.sendToGrave(s, [], { target: { zone: 'under', filter: { cardId: 'aq_war' } } }, { player: 0, source: a });
    assert.strictEqual(a.under.length, 1, 'ไม่ตรงตัวกรอง');
    FX().ops.sendToGrave(s, [], { target: { zone: 'under' } }, { player: 0, source: null });
    FX().ops.sendToGrave(s, [], { target: { zone: 'under' } }, { player: 0, source: handCard(s, 0, 'aq_war') || { uid: 99999 } });
    assert.strictEqual(a.under.length + b.under.length, 2, 'ต้นทางไม่อยู่บนสนาม = ไม่ทำอะไร');
  } },

  // ---------------- คำสั่งบุก ----------------
  { name: 'P4B-23 คำสั่งบุก (+): อาควิลาของเราทุกตัว +500 ATK ชั่วคราว (ไม่แตะค่าถาวร) ; (-) ไม่ใช่อาควิลา/ศัตรู/มานาไม่พอ ไม่ได้', run(assert) {
    const s = game({ p0: { hand: ['aq_assault'], mana: 3, monsters: { 0: 'aq_spear', 1: 'aq_eques', 2: 'fx_l1a' } }, p1: { monsters: { 0: 'aq_spear' } } });
    const r = FX().run(s, [], eff('aq_assault'), { source: handCard(s, 0, 'aq_assault'), player: 0 });
    assert.ok(r.ok, r.reason);
    assert.strictEqual(s.players[0].mana, 1);
    assert.deepStrictEqual([0, 1, 2].map(i => atk(mon(s, 0, i))), [1300, 2800, 1000]);
    assert.strictEqual(mon(s, 0, 0).tempAtkMod, 500); assert.strictEqual(mon(s, 0, 0).atkMod, 0);
    assert.strictEqual(atk(mon(s, 1, 0)), 800);
    const t = game({ p0: { hand: ['aq_assault'], mana: 1, monsters: { 0: 'aq_spear' } } });
    const f = FX().run(t, [], eff('aq_assault'), { source: handCard(t, 0, 'aq_assault'), player: 0 });
    assert.strictEqual(f.reason, 'notEnoughMana');
    assert.strictEqual(atk(mon(t, 0, 0)), 800);
  } },

  // ---------------- ข้อมูล / ความปลอดภัยของ op ----------------
  { name: 'P4B-24 ข้อมูลการ์ดที่แปลง: ใช้เฉพาะ op/condition ที่มีจริง cost ตรงมานาการ์ด ; ฮาสตาตัสและไม่ครบยังเป็น effects: [] (ไม่แปลงครึ่งๆ)', run(assert) {
    const converted = ['aq_centurion', 'aq_castra', 'aq_imperator', 'aq_recruit', 'aq_muster', 'aq_tiro', 'aq_assault', 'dino_call'];
    for (const id of converted) {
      const c = cardDef(id);
      assert.ok(c.effects.length >= 1, id);
      for (const e of c.effects) {
        assert.strictEqual(e.cost.mana, Number(c.mana), `${id}/${e.id}`);
        for (const s of e.do) assert.ok(FX().ops[s.op], `${id}: op ${s.op}`);
        for (const s of e.do) if (s.op === 'choice') for (const o of s.options) for (const x of o.do) assert.ok(FX().ops[x.op], `${id}: choice op ${x.op}`);
        for (const k of e.condition || []) assert.ok(FX().conditions[k.op], `${id}: condition ${k.op}`);
      }
    }
    assert.strictEqual(cardDef('aq_centurion').effects[0].trigger, 'continuous');
    assert.strictEqual(cardDef('aq_tiro').effects[0].from, 'hand');
    assert.deepStrictEqual(cardDef('aq_hastatus').effects, [], 'ฮาสตาตัสรอ 4E-2C (ดู CONTRACT_PROPOSALS)');
    assert.deepStrictEqual(cardDef('aq_dictator').effects, []);
  } },

  { name: 'P4B-25 modifyStat ที่เป็น aura ถ้าถูกรันตรงๆ ไม่เขียนค่าถาวร ; reduceCost เป็นตัวประกาศไม่ทำอะไรตอนรัน', run(assert) {
    const s = game({ p0: { monsters: { 0: 'aq_spear', 2: 'aq_centurion' } } });
    const before = JSON.stringify(s.players);
    FX().ops.modifyStat(s, [], eff('aq_centurion').do[0], { player: 0, source: mon(s, 0, 2) });
    FX().ops.reduceCost(s, [], { op: 'reduceCost' }, { player: 0, source: mon(s, 0, 2) });
    assert.strictEqual(JSON.stringify(s.players), before);
    assert.strictEqual(mon(s, 0, 0).atkMod, 0);
  } }
];

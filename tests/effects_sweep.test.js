// tests/effects_sweep.test.js - เทสต์พฤติกรรมการ์ดที่กวาดแปลงในขั้น 4E-3:
// dino_hunter_raptor, dino_tyrano_raptor, dino_brachio
require('./fixtures');
const E = () => CG.engine;
const FX = () => CG.effects;
const game = o => CG.test.makeGame(Object.assign({ deckA: 'dinosaur', deckB: 'dinosaur', seed: 1 }, o));
const atk = m => E().atk(m);
const mon = (s, p, slot) => s.players[p].monsters[slot];
const ids = list => list.filter(Boolean).map(c => c.cardId);

module.exports = [
  { name: 'SWEEP-01 แรปเตอร์นักล่า (dino_hunter_raptor) ignition: ทำลายแรปเตอร์เล็กของเรา 1 ตัว +800 ATK จนจบเทิร์น', run(assert) {
    const s = game({
      p0: {
        monsters: { 0: 'dino_hunter_raptor', 1: 'dino_small_raptor' },
        mana: 3
      }
    });
    const hunter = mon(s, 0, 0);
    assert.strictEqual(atk(hunter), 2000);

    // กดใช้เอฟเฟกต์กินเหยื่อ
    const r = E().applyAction(s, { type: 'activateEffect', player: 0, slot: 0, effectId: 'eat_prey' });
    assert.ok(r.ok, r.error);
    assert.strictEqual(s.players[0].mana, 2, 'จ่าย 1 มานา');
    assert.strictEqual(mon(s, 0, 1), null, 'แรปเตอร์เล็กถูกทำลาย');
    assert.deepStrictEqual(ids(s.players[0].grave), ['dino_small_raptor']);
    assert.strictEqual(atk(hunter), 2800, '2000 + 800 = 2800 ATK');
    assert.strictEqual(hunter.tempAtkMod, 800, 'เป็นตัวปรับชั่วคราว');

    // ถ้าไม่มีแรปเตอร์เล็กบนสนามแล้ว ใช้ซ้ำไม่ได้
    const fail = E().applyAction(s, { type: 'activateEffect', player: 0, slot: 0, effectId: 'eat_prey' });
    assert.strictEqual(fail.ok, false);
    assert.strictEqual(fail.error, 'CONDITION_FAILED', 'ไม่มีแรปเตอร์เล็กให้ทำลาย');
  } },

  { name: 'SWEEP-02 บราคิโอซอรัสผู้ทอดเงา (dino_brachio) continuous เงาทอดยาว: ศัตรูต้องโจมตีบราคิโอก่อน ห้ามตีตัวอื่นหรือตีตรง', run(assert) {
    const s = game({
      phase: 'battle', turn: 3,
      p0: { monsters: { 0: 'dino_trike' } },
      p1: { monsters: { 0: 'dino_small_raptor', 2: 'dino_brachio' } }
    });

    // p0 พยายามตีตรง -> MUST_ATTACK_RESTRICTED
    const direct = E().applyAction(s, { type: 'attack', player: 0, from: 0, to: null });
    assert.strictEqual(direct.ok, false);
    assert.strictEqual(direct.error, 'MUST_ATTACK_RESTRICTED');

    // p0 พยายามตีช่อง 0 (แรปเตอร์เล็ก) -> MUST_ATTACK_RESTRICTED
    const attackSmall = E().applyAction(s, { type: 'attack', player: 0, from: 0, to: 0 });
    assert.strictEqual(attackSmall.ok, false);
    assert.strictEqual(attackSmall.error, 'MUST_ATTACK_RESTRICTED');

    // ตีช่อง 2 (บราคิโอซอรัส) -> ถูกต้อง โจมตีสำเร็จ
    const attackBrachio = E().applyAction(s, { type: 'attack', player: 0, from: 0, to: 2 });
    assert.ok(attackBrachio.ok, attackBrachio.error);
  } },

  { name: 'SWEEP-03 ไทรานโนแรปเตอร์ (dino_tyrano_raptor): onSummon ทำลายศัตรู +500 ATK ถาวร และ onBattleDestroy +500 ATK และ extraAttack', run(assert) {
    const s = game({
      phase: 'battle', turn: 3,
      p0: { extra: ['dino_tyrano_raptor'], mana: 5 },
      p1: { monsters: { 0: 'dino_egg', 1: 'dino_small_raptor' } }
    });

    // 1. เรียกพิเศษไทรานโนแรปเตอร์ลงสนาม -> ยิง onSummon
    FX().ops.specialSummon(s, [], { from: ['extra'], filter: { cardId: 'dino_tyrano_raptor' }, count: 1, slot: 2 }, { player: 0 });
    const tyrano = mon(s, 0, 2);
    assert.ok(tyrano);
    assert.strictEqual(s.players[0].mana, 3, 'จ่าย 2 มานาจาก onSummon');
    assert.strictEqual(atk(tyrano), 2900, '2400 + 500 = 2900 ATK');
    assert.strictEqual(tyrano.atkMod, 500, 'ATK +500 ถาวร');
    assert.strictEqual(s.players[1].grave.length, 1, 'มอนสเตอร์ศัตรู 1 ตัวถูกทำลาย');

    // 2. ประกาศโจมตีและทำลายมอนสเตอร์ศัตรูตัวที่เหลือในการต่อสู้ -> ยิง onBattleDestroy
    const survivingSlot = s.players[1].monsters[0] ? 0 : 1;
    const rAtk1 = E().applyAction(s, { type: 'attack', player: 0, from: 2, to: survivingSlot });
    assert.ok(rAtk1.ok, rAtk1.error);
    assert.strictEqual(atk(tyrano), 3400, '2900 + 500 = 3400 ATK');
    assert.strictEqual(tyrano.atkMod, 1000, 'ATK +500 สะสมถาวร');
    assert.strictEqual(tyrano.flags.attackedThisTurn, false, 'ได้รับ extraAttack จึงยังโจมตีต่อได้');

    // โจมตีครั้งที่ 2 (โจมตีตรงเพราะศัตรูไม่เหลือมอนสเตอร์)
    const legals = E().getLegalActions(s, 0).filter(a => a.type === 'attack');
    assert.ok(legals.some(a => a.from === 2 && a.to === null), 'มี action โจมตีตรง');
    const rAtk2 = E().applyAction(s, { type: 'attack', player: 0, from: 2, to: null });
    assert.ok(rAtk2.ok, rAtk2.error);
    assert.strictEqual(s.players[1].lp, 8000 - 2300 - 3400, 'ศัตรูเสีย LP 2300 จากต่อสู้ และ 3400 จากโจมตีตรง เหลือ 2300');
    assert.strictEqual(tyrano.flags.attackedThisTurn, true, 'โจมตีครบโควตาแล้ว');
  } },

  { name: 'SWEEP-04 ปรับปรุงฟิลด์ text ของ aq_centurion และ aq_assault ให้ตรงกับ effects[]', run(assert) {
    const centurion = CG.cards.aquila.main.find(c => c.id === 'aq_centurion');
    assert.ok(centurion.text.includes('+300 ATK'), 'text ของ aq_centurion ระบุ +300 ATK');
    const assault = CG.cards.aquila.main.find(c => c.id === 'aq_assault');
    assert.ok(assault.text.includes('+500 ATK'), 'text ของ aq_assault ระบุ +500 ATK');
  } }
];

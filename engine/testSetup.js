// engine/testSetup.js - ตัวช่วยสร้างสถานการณ์ทดสอบ: CG.test.makeGame (CONTRACT ข้อ 13)
// ใช้ได้ทั้งใน Node และเบราว์เซอร์ (ไม่แตะ DOM) ห้าม UI/เกมจริงเรียก
//
// CG.test.makeGame({
//   p0: { hand:[cardId...], deck:[cardId...] (บนสุด = ตัวแรก), grave:[...], removed:[...], extra:[...],
//         monsters:{ 2:"id" | { cardId, position:"def", faceDown:true, summonedTurn, setTurn, under:[id...],
//                                atkMod, defMod, level, attackedThisTurn, positionChangedThisTurn } },
//         spells:{ 0:"id" }, fieldSpell:"id", mana, lp, flags:{...} },
//   p1: { ... }, seed, turn (ค่าเริ่มต้น 3), activeIdx (ค่าเริ่มต้นตามความคี่คู่ของ turn),
//   phase (ค่าเริ่มต้น "main1"), config:{...}, deckA, deckB (ค่าเริ่มต้น "fixture" ถ้ามี) })
// ถ้าไม่ระบุ hand = มือว่าง, ไม่ระบุ deck = เด็คเต็มที่สับแล้วของ deckKey, ไม่ระบุ monsters = สนามว่าง
(function () {
  const CG = (globalThis.CG = globalThis.CG || {});
  CG.engine = CG.engine || {};
  CG.test = CG.test || {};
  const E = CG.engine;

  function inst(state, id, owner) {
    const def = E.findCard(id);
    if (!def) throw new Error('makeGame: ไม่พบการ์ด ' + id);
    return E.newInstance(state, def, owner);
  }
  function defaultDeck() {
    if (CG.cards && CG.cards.fixture) return 'fixture';
    return Object.keys(CG.cards || {})[0];
  }

  CG.test.makeGame = function (opts) {
    opts = opts || {};
    const deckA = opts.deckA || defaultDeck();
    const deckB = opts.deckB || deckA;
    const state = E.buildState({ deckA, deckB, seed: opts.seed === undefined ? 1 : opts.seed, mode: opts.mode, config: opts.config });
    state.turn = opts.turn === undefined ? 3 : opts.turn;
    state.activeIdx = opts.activeIdx === undefined ? (state.turn - 1) % 2 : opts.activeIdx;
    state.phase = opts.phase || 'main1';
    [opts.p0 || {}, opts.p1 || {}].forEach((o, idx) => {
      const p = state.players[idx];
      p.flags.mulliganDone = true;
      p.mana = o.mana === undefined ? state.config.startMana : o.mana;
      if (o.lp !== undefined) p.lp = o.lp;
      p.hand = (o.hand || []).map(id => inst(state, id, idx));
      if (o.deck) p.deck = o.deck.map(id => inst(state, id, idx));
      if (o.extra) p.extra = o.extra.map(id => inst(state, id, idx));
      p.grave = (o.grave || []).map(id => inst(state, id, idx));
      p.removed = (o.removed || []).map(id => inst(state, id, idx));
      for (const s of Object.keys(o.monsters || {})) {
        let spec = o.monsters[s]; if (typeof spec === 'string') spec = { cardId: spec };
        const m = inst(state, spec.cardId, idx);
        m.faceDown = !!spec.faceDown;
        m.position = spec.position || (m.faceDown ? 'def' : 'atk');
        if (spec.level !== undefined) m.level = spec.level;
        if (spec.atkMod) m.atkMod = spec.atkMod;
        if (spec.defMod) m.defMod = spec.defMod;
        m.flags.summonedTurn = spec.summonedTurn === undefined ? 0 : spec.summonedTurn;  // 0 = ลงมานานแล้ว
        m.flags.setTurn = spec.setTurn === undefined ? null : spec.setTurn;
        if (spec.attackedThisTurn) m.flags.attackedThisTurn = true;
        if (spec.positionChangedThisTurn) m.flags.positionChangedThisTurn = true;
        m.under = (spec.under || []).map(id => inst(state, id, idx));
        p.monsters[Number(s)] = m;
      }
      for (const s of Object.keys(o.spells || {})) {
        const c = inst(state, o.spells[s], idx); c.faceDown = true; p.spells[Number(s)] = c;
      }
      if (o.fieldSpell) p.fieldSpell = inst(state, o.fieldSpell, idx);
      Object.assign(p.flags, o.flags || {});
    });
    return state;
  };
})();

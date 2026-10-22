// engine/actions.js - API สาธารณะ 4 ฟังก์ชันตามข้อ 7: createGame (setup.js), getLegalActions, applyAction, cloneState (core.js)
(function () {
  const CG = (globalThis.CG = globalThis.CG || {});
  CG.engine = CG.engine || {};
  const E = CG.engine;

  const NOT_IMPLEMENTED = ['overlay', 'setSpell', 'activateSpell']; // ขั้น 5-6 (activateEffect ทำแล้วในขั้น 4A-2)
  const TYPES = ['mulligan', 'advancePhase', 'endTurn', 'normalSummon', 'setMonster', 'tributeSummon',
    'flipSummon', 'changePosition', 'attack', 'activateEffect', 'respond', 'pass'].concat(NOT_IMPLEMENTED);

  function respond(state, a, events) {
    const pd = state.pending;
    if (!pd) return 'NO_PENDING';
    if (pd.player !== a.player) return 'NOT_YOUR_TURN';
    if (pd.prompt === 'DISCARD_EXCESS') return E.respondDiscard(state, a, events);
    const h = E.pendingHandlers[pd.kind];
    return h ? h(state, a, events) : 'NOT_IMPLEMENTED';
  }

  function run(state, a, events) {
    if (!a || typeof a !== 'object' || !TYPES.includes(a.type)) return 'UNKNOWN_ACTION';
    if (state.ended) return 'GAME_ENDED';
    if (a.player !== 0 && a.player !== 1) return 'INVALID_PLAYER';
    if (state.phase === 'mulligan') {            // ทั้งสองฝ่ายตัดสินใจได้พร้อมกัน
      if (a.type === 'mulligan') return E.doMulligan(state, a, events);
      if (a.type === 'pass') return E.keepHand(state, a, events);
      return 'WRONG_PHASE';
    }
    if (a.type === 'mulligan') return 'WRONG_PHASE';
    if (state.pending) {
      if (a.type !== 'respond') return 'PENDING_UNRESOLVED';
      return respond(state, a, events);
    }
    if (a.type === 'respond') return 'NO_PENDING';
    if (a.type === 'pass') return 'NO_WINDOW';
    if (NOT_IMPLEMENTED.includes(a.type)) return 'NOT_IMPLEMENTED';
    if (a.player !== state.activeIdx) return 'NOT_YOUR_TURN';
    switch (a.type) {
      case 'advancePhase': return E.advancePhase(state, a, events);
      case 'endTurn': return E.endTurn(state, a, events);
      case 'normalSummon': return E.normalSummon(state, a, events);
      case 'setMonster': return E.setMonster(state, a, events);
      case 'tributeSummon': return E.tributeSummon(state, a, events);
      case 'flipSummon': return E.flipSummon(state, a, events);
      case 'changePosition': return E.changePosition(state, a, events);
      case 'attack': return E.attack(state, a, events);
      case 'activateEffect': return E.activateEffect(state, a, events);
    }
    return 'UNKNOWN_ACTION';
  }

  // ทุก handler ตรวจให้ครบก่อนแก้ state ถ้าผิดกติกาจะไม่เปลี่ยน state เลย
  E.applyAction = function (state, action) {
    const events = [];
    E.refreshAuras(state);   // 4E-2B: ให้ ATK ที่รวม aura เป็นค่าล่าสุดก่อนตรวจ/รัน (ไม่มี aura = ไม่เปลี่ยนอะไร)
    const err = run(state, action, events);
    if (err) return { ok: false, error: err, events: [{ type: 'rejected', code: err }] };
    E.refreshAuras(state);
    state.log.push(...events);
    return { ok: true, error: null, events };
  };

  function combos(arr, k) {
    const out = [];
    (function rec(start, cur) {
      if (cur.length === k) { out.push(cur.slice()); return; }
      for (let i = start; i < arr.length; i++) { cur.push(arr[i]); rec(i + 1, cur); cur.pop(); }
    })(0, []);
    return out;
  }

  // รายการ action ที่ applyAction ยอมรับจริง (กรองด้วย validator ตัวเดียวกัน)
  E.getLegalActions = function (state, playerIdx) {
    const out = [];
    if (state.ended) return out;
    const P = playerIdx;
    if (state.phase === 'mulligan') {
      const f = state.players[P].flags;
      if (!f.mulliganDone) { out.push({ type: 'mulligan', player: P }); out.push({ type: 'pass', player: P }); }
      return out;
    }
    if (state.pending) {
      const pd = state.pending;
      if (pd.player !== P) return out;
      if (pd.prompt === 'DISCARD_EXCESS') {
        combos(pd.options, pd.min).forEach(c => out.push({ type: 'respond', player: P, choice: c }));
      } else if (pd.kind === 'yesNo') {
        out.push({ type: 'respond', player: P, choice: true }, { type: 'respond', player: P, choice: false });
      } else if (Array.isArray(pd.options)) {
        pd.options.forEach(o => out.push({ type: 'respond', player: P, choice: o }));  // ขั้น 5 ปรับเพิ่มเอง
      }
      return out;
    }
    if (P !== state.activeIdx) return out;
    const p = state.players[P], n = state.config.monsterSlots;
    const push = (a) => { const e = { normalSummon: E.validateNormalSummon, setMonster: E.validateSetMonster,
      tributeSummon: E.validateTributeSummon, flipSummon: E.validateFlipSummon,
      changePosition: E.validateChangePosition, attack: E.validateAttack, activateEffect: E.validateActivateEffect }[a.type](state, a);
      if (!e) out.push(a); };
    if (state.phase === 'main1' || state.phase === 'main2') {
      for (let h = 0; h < p.hand.length; h++) {
        for (let s = 0; s < n; s++) {
          push({ type: 'normalSummon', player: P, handIdx: h, slot: s });
          push({ type: 'setMonster', player: P, handIdx: h, slot: s });
        }
        const occ = []; for (let s = 0; s < n; s++) if (p.monsters[s]) occ.push(s);
        for (let k = 1; k <= Math.min(3, occ.length); k++) {
          for (const mats of combos(occ, k)) for (let s = 0; s < n; s++) {
            push({ type: 'tributeSummon', player: P, handIdx: h, materials: mats, slot: s });
          }
        }
      }
      for (let s = 0; s < n; s++) {
        push({ type: 'flipSummon', player: P, slot: s });
        push({ type: 'changePosition', player: P, slot: s });
        const mm = p.monsters[s], dd = mm && !mm.faceDown && E.cardOf(mm);
        if (dd) for (const ef of dd.effects || []) if (ef.trigger === 'ignition') push({ type: 'activateEffect', player: P, slot: s, effectId: ef.id });
      }
      // 4E-2B: เอฟเฟกต์ ignition ของมอนสเตอร์ที่ใช้จากมือ (effect.from ต้องมี 'hand')
      for (let h = 0; h < p.hand.length; h++) {
        const hd = E.cardOf(p.hand[h]);
        if (hd && hd.type !== 'spell') for (const ef of hd.effects || []) if (ef.trigger === 'ignition' && [].concat(ef.from || []).includes('hand')) push({ type: 'activateEffect', player: P, handIdx: h, effectId: ef.id });
      }
    }
    if (state.phase === 'battle') {
      for (let s = 0; s < n; s++) {
        if (!p.monsters[s]) continue;
        push({ type: 'attack', player: P, from: s, to: null });
        for (let t = 0; t < n; t++) push({ type: 'attack', player: P, from: s, to: t });
      }
    }
    if (!E.validateAdvance(state)) {
      out.push({ type: 'advancePhase', player: P });
      out.push({ type: 'endTurn', player: P });
    }
    return out;
  };
})();

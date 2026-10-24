// engine/actions.js - API สาธารณะ 4 ฟังก์ชันตามข้อ 7: createGame (setup.js), getLegalActions, applyAction, cloneState (core.js)
(function () {
  const CG = (globalThis.CG = globalThis.CG || {});
  CG.engine = CG.engine || {};
  const E = CG.engine;

  const NOT_IMPLEMENTED = []; // 6A: overlay พร้อมใช้งานแล้ว
  const TYPES = ['mulligan', 'advancePhase', 'endTurn', 'normalSummon', 'setMonster', 'tributeSummon',
    'flipSummon', 'changePosition', 'attack', 'activateEffect', 'activateSpell', 'activateResponse', 'setSpell', 'overlay', 'extraSummon', 'passPriority', 'respond', 'pass'].concat(NOT_IMPLEMENTED);

  function respond(state, a, events) {
    const pd = state.pending;
    if (!pd) return 'NO_PENDING';
    if (pd.prompt === 'DISCARD_EXCESS') {
      if (pd.player !== a.player) return 'NOT_YOUR_TURN';
      return E.respondDiscard(state, a, events);
    }
    if (pd.kind === 'chainWindow') {
      if (pd.player !== a.player) return 'NOT_YOUR_TURN';
      const h = E.pendingHandlers[pd.kind];
      if (h) return h(state, a, events);
      if (a.choice === 'pass' || a.choice === null) {
        return E.passPriority(state, { type: 'passPriority', player: a.player }, events);
      }
      if (typeof a.choice === 'object') {
        return E.activateResponse(state, Object.assign({ type: 'activateResponse', player: a.player }, a.choice), events);
      }
      return 'NOT_IMPLEMENTED';
    }
    if (pd.player !== a.player) return 'NOT_YOUR_PENDING';

    // 5A: respond {player, choice} สำหรับ pending ที่มี resume
    if (pd.resume) {
      if (!Array.isArray(a.choice)) return 'INVALID_CHOICE';
      if (a.choice.length < pd.min || a.choice.length > pd.max) return 'INVALID_CHOICE';
      if (new Set(a.choice).size !== a.choice.length) return 'INVALID_CHOICE';
      for (const idx of a.choice) {
        if (!Number.isInteger(idx) || idx < 0 || idx >= pd.options.length) return 'INVALID_CHOICE';
      }
      events.push({ type: 'pendingResolved', choice: a.choice });
      const resume = pd.resume;
      state.pending = null;
      if (CG.effects && CG.effects.resumeEffect) {
        CG.effects.resumeEffect(state, events, resume, a.choice);
      }
      // 5B: ถ้ากำลังแก้ผล Chain อยู่ ให้เคลียร์ลิงก์ที่จบแล้วและแก้ผลลิงก์ที่เหลือต่อ
      if (state.chainResolving && state.chain && state.chain.length > 0 && !state.pending) {
        const finishedLink = state.chain.pop();
        events.push({ type: 'chainLinkResolved', linkId: finishedLink.linkId, cardId: finishedLink.cardId, uid: finishedLink.uid });
        if (E.disposeSpell) {
          E.disposeSpell(state, events, finishedLink);
        }
        if (E.resolveChain) {
          E.resolveChain(state, events);
        }
      }
      return null;
    }

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
      if (a.type !== 'respond') {
        if (state.pending.kind === 'chainWindow') {
          if (a.type === 'passPriority' || a.type === 'pass') {
            return E.passPriority(state, a, events);
          }
          if (a.type === 'activateResponse') {
            return E.activateResponse(state, a, events);
          }
          return 'PENDING_UNRESOLVED';
        }
        if (state.pending.prompt === 'DISCARD_EXCESS') {
          return 'PENDING_UNRESOLVED';
        }
        return 'PENDING_OPEN';
      }
      return respond(state, a, events);
    }
    if (a.type === 'respond') return 'NO_PENDING';
    if (a.type === 'passPriority') return 'NO_WINDOW';
    if (a.type === 'activateResponse') return 'NO_PRIORITY';
    if (a.type === 'pass') return 'NO_WINDOW';
    if (a.type === 'activateSpell') {
      if (!state.config || !state.config.chainMode) return 'NOT_IMPLEMENTED';
      return E.activateSpell(state, a, events);
    }
    if (a.type === 'setSpell') {
      if (!state.config || !state.config.chainMode) return 'NOT_IMPLEMENTED';
      return E.setSpell(state, a, events);
    }
    if (a.type === 'overlay') {
      if (!state.config || !state.config.chainMode) return 'NOT_IMPLEMENTED';
      return E.overlay(state, a, events);
    }
    if (a.type === 'extraSummon') {
      if (!state.config || !state.config.chainMode) return 'NOT_IMPLEMENTED';
      return E.extraSummon(state, a, events);
    }
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
      case 'setSpell': return E.setSpell(state, a, events);
      case 'overlay': return E.overlay(state, a, events);
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
      } else if (pd.kind === 'chainWindow') {
        out.push({ type: 'passPriority', player: P });
        if (Array.isArray(pd.options)) {
          pd.options.forEach(o => {
            const act = { type: 'activateResponse', player: P };
            if (o.slot !== undefined) act.slot = o.slot;
            if (o.spellSlot !== undefined) act.spellSlot = o.spellSlot;
            if (o.handIdx !== undefined) act.handIdx = o.handIdx;
            if (o.effectId !== undefined) act.effectId = o.effectId;
            out.push(act);
          });
        }
      } else if (pd.resume) {
        const n = pd.options.length;
        const indices = [];
        for (let i = 0; i < n; i++) indices.push(i);
        let count = 0;
        const maxCombos = 50;
        for (let k = pd.min; k <= pd.max; k++) {
          const list = combos(indices, k);
          for (const c of list) {
            if (count >= maxCombos) break;
            out.push({ type: 'respond', player: P, choice: c });
            count++;
          }
          if (count >= maxCombos) break;
        }
      } else if (pd.kind === 'yesNo') {
        out.push({ type: 'respond', player: P, choice: true }, { type: 'respond', player: P, choice: false });
      } else if (Array.isArray(pd.options)) {
        pd.options.forEach(o => out.push({ type: 'respond', player: P, choice: o }));
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
      // 6A: action overlay จากมือ เมื่อ chainMode = true
      if (state.config && state.config.chainMode) {
        for (let h = 0; h < p.hand.length; h++) {
          for (let s = 0; s < n; s++) {
            const act = { type: 'overlay', player: P, handIdx: h, targetSlot: s };
            if (E.validateOverlay && !E.validateOverlay(state, act)) {
              out.push(act);
            }
          }
        }
        // 6C: action extraSummon จาก Extra Deck เมื่อ chainMode = true
        for (let ex = 0; ex < (p.extra || []).length; ex++) {
          for (let s = 0; s < n; s++) {
            const act = { type: 'extraSummon', player: P, extraIdx: ex, targetSlot: s };
            if (E.validateExtraSummon && !E.validateExtraSummon(state, act)) {
              out.push(act);
            }
          }
        }
      }
      // 5C: สเปลหมอบรอ (setSpell) เมื่อ chainMode = true
      if (state.config && state.config.chainMode) {
        const maxSpells = (state.config && state.config.spellSlots) || 5;
        const emptySpellSlots = [];
        for (let s = 0; s < maxSpells; s++) if (!p.spells[s]) emptySpellSlots.push(s);
        if (emptySpellSlots.length > 0) {
          for (let h = 0; h < p.hand.length; h++) {
            const hd = E.cardOf(p.hand[h]);
            if (hd && hd.type === 'spell') {
              for (const s of emptySpellSlots) {
                out.push({ type: 'setSpell', player: P, handIdx: h, slot: s });
              }
            }
          }
        }
        // 5B/5C: สเปลที่ใช้จากมือหรือจากบนสนามเมื่อ chainMode = true
        const FXc = CG.effects;
        for (let h = 0; h < p.hand.length; h++) {
          const hd = E.cardOf(p.hand[h]);
          if (hd && hd.type === 'spell') {
            const eff = hd.effects && hd.effects[0];
            const eWin = eff && (eff.timingWindow || eff['win' + 'dow']);
            const ctx = { source: p.hand[h], player: P, trigger: 'spell' };
            const canWin = !eWin || eWin.includes('anyActivation') || eWin.includes('main');
            if (!eff || (canWin && (!FXc || !FXc.checkCanActivate || FXc.checkCanActivate(state, eff, ctx)))) {
              out.push({ type: 'activateSpell', player: P, handIdx: h });
            }
          }
        }
        for (let s = 0; s < (p.spells || []).length; s++) {
          const sp = p.spells[s];
          if (sp && sp.faceDown) {
            const setTurn = sp.flags && sp.flags.setTurn !== undefined ? sp.flags.setTurn : sp.setTurn;
            if (setTurn !== undefined && setTurn < state.turn) {
              const spDef = E.cardOf(sp);
              const eff = spDef && spDef.effects && spDef.effects[0];
              const eWin = eff && (eff.timingWindow || eff['win' + 'dow']);
              const ctx = { source: sp, player: P, trigger: 'spell' };
              const canWin = !eWin || eWin.includes('anyActivation') || eWin.includes('main');
              if (!eff || (canWin && (!FXc || !FXc.checkCanActivate || FXc.checkCanActivate(state, eff, ctx)))) {
                out.push({ type: 'activateSpell', player: P, spellSlot: s });
              }
            }
          }
        }
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

// engine/turn.js - จังหวะเทิร์น: mulligan, draw/standby, เปลี่ยนเฟส, จบเทิร์น, ทิ้งมือเกิน, tiebreak
(function () {
  const CG = (globalThis.CG = globalThis.CG || {});
  CG.engine = CG.engine || {};
  const E = CG.engine;

  // ---- เริ่มเทิร์น: draw → standby → main1 (เฟสจริง แต่ข้ามอัตโนมัติถ้า priorityWindow ไม่เปิด) ----
  function runStart(state, events, stage) {
    if (stage === 'draw') {
      E.setPhase(state, events, 'draw');
      E.drawCard(state, events, state.activeIdx, true);
      if (E.openWindow(state, events, { kind: 'phase', phase: 'draw' })) return;
      stage = 'standby';
    }
    if (stage === 'standby') {
      E.setPhase(state, events, 'standby');
      E.fire(state, events, 'onStandby', { player: state.activeIdx });   // เฉพาะการ์ดของเจ้าของเทิร์น
      if (state.ended) return;
      if (E.openWindow(state, events, { kind: 'phase', phase: 'standby' })) return;
    }
    E.setPhase(state, events, 'main1');
  }
  E.startTurn = function (state, events) {
    state.battleStep = null; state.attack = null;
    runStart(state, events, 'draw');
  };
  // ขั้น 4-5 เรียกหลังปิดหน้าต่างของ draw/standby เพื่อเดินต่อ
  E.resumeTurnStart = function (state, events) {
    runStart(state, events, state.phase === 'draw' ? 'standby' : 'main1');
  };

  // ---- Mulligan ----
  E.validateMulligan = function (state, a) {
    if (state.phase !== 'mulligan') return 'WRONG_PHASE';
    const p = state.players[a.player];
    if (p.flags.mulliganDone || p.flags.mulliganUsed >= state.config.mulliganCount) return 'MULLIGAN_USED';
    if (a.indices !== undefined) {
      if (!Array.isArray(a.indices) || !a.indices.length) return 'INVALID_CHOICE';
      const seen = new Set();
      for (const i of a.indices) {
        if (!Number.isInteger(i) || i < 0 || i >= p.hand.length || seen.has(i)) return 'INVALID_CHOICE';
        seen.add(i);
      }
    }
    return null;
  };
  function maybeStartGame(state, events) {
    if (state.players.every(p => p.flags.mulliganDone)) E.startTurn(state, events);
  }
  E.doMulligan = function (state, a, events) {
    const err = E.validateMulligan(state, a); if (err) return err;
    const p = state.players[a.player];
    const idxs = (a.indices ? a.indices.slice() : p.hand.map((_, i) => i)).sort((x, y) => y - x);
    const back = idxs.map(i => p.hand.splice(i, 1)[0]);
    back.forEach(c => events.push({ type: 'moveCard', uid: c.uid, from: 'hand', to: 'deck', player: p.idx }));
    p.deck.push(...back);
    E.shuffle(p.deck, state.rng);
    for (let i = 0; i < back.length; i++) E.drawCard(state, events, p.idx, false); // มานาไม่เปลี่ยน
    p.flags.mulliganUsed += 1;
    if (p.flags.mulliganUsed >= state.config.mulliganCount) p.flags.mulliganDone = true;
    maybeStartGame(state, events);
    return null;
  };
  E.keepHand = function (state, a, events) {   // pass ในช่วง mulligan = เก็บมือ
    if (state.phase !== 'mulligan') return 'NO_WINDOW';
    const p = state.players[a.player];
    if (p.flags.mulliganDone) return 'MULLIGAN_USED';
    p.flags.mulliganDone = true;
    maybeStartGame(state, events);
    return null;
  };

  // ---- เปลี่ยนเฟส / จบเทิร์น ----
  E.validateAdvance = function (state) {
    if (!['main1', 'battle', 'main2'].includes(state.phase)) return 'WRONG_PHASE';
    if (state.battleStep !== null) return 'ATTACK_IN_PROGRESS';
    return null;
  };
  E.advancePhase = function (state, a, events) {
    const err = E.validateAdvance(state); if (err) return err;
    if (state.phase === 'main1') E.setPhase(state, events, 'battle');
    else if (state.phase === 'battle') E.setPhase(state, events, 'main2');
    else E.beginEndPhase(state, events);
    return null;
  };
  E.endTurn = function (state, a, events) {
    const err = E.validateAdvance(state); if (err) return err;
    E.beginEndPhase(state, events);
    return null;
  };
  E.beginEndPhase = function (state, events) {
    E.setPhase(state, events, 'end');
    E.fire(state, events, 'onEndPhase', {});
    if (state.ended) return;
    const p = state.players[state.activeIdx];
    const excess = p.hand.length - state.config.handLimit;
    if (excess > 0) {
      // ผู้เล่นเลือกเองว่าจะทิ้งใบไหน (respond choice = รายการ uid)
      state.pending = {
        kind: 'chooseCards', player: p.idx, prompt: 'DISCARD_EXCESS',
        options: p.hand.map(c => c.uid), min: excess, max: excess
      };
      return;
    }
    E.finishTurn(state, events);
  };
  E.respondDiscard = function (state, a, events) {
    const pd = state.pending;
    const ch = a.choice;
    if (!Array.isArray(ch) || ch.length !== pd.min || new Set(ch).size !== ch.length) return 'INVALID_CHOICE';
    if (!ch.every(u => pd.options.includes(u))) return 'INVALID_CHOICE';
    const p = state.players[pd.player];
    for (const uid of ch) {
      const i = p.hand.findIndex(c => c.uid === uid);
      const c = p.hand.splice(i, 1)[0];
      p.removed.push(c);
      events.push({ type: 'moveCard', uid: c.uid, from: 'hand', to: 'removed', player: p.idx });
    }
    state.pending = null;
    E.finishTurn(state, events);
    return null;
  };

  // จบเทิร์นจริง: ล้าง temp, Grade 4 กลับ extra, รีเซ็ต flags, เช็ก tiebreak, สลับเทิร์น
  E.finishTurn = function (state, events) {
    for (const p of state.players) {
      for (let s = 0; s < p.monsters.length; s++) {
        const m = p.monsters[s]; if (!m) continue;
        m.tempAtkMod = 0; m.tempDefMod = 0;
        const def = E.cardOf(m);
        if (def && def.type === 'grade4') E.leaveField(state, events, p.idx, s, 'extra');
      }
    }
    for (const p of state.players) {
      p.flags.normalSummonUsed = false; p.flags.tributeSummonUsed = false; p.flags.grade4SummonedThisTurn = false;
      for (const m of p.monsters) if (m) {
        m.flags.attackedThisTurn = false; m.flags.positionChangedThisTurn = false; m.flags.canAttack = true;
      }
    }
    state.battleStep = null; state.attack = null;
    const [a, b] = state.players;
    if (!a.deck.length && !b.deck.length && state.turn > state.config.tiebreakTurn) {
      const ca = E.boardCount(a), cb = E.boardCount(b);
      E.endGame(state, events, ca === cb ? 'draw' : (ca > cb ? 0 : 1), 'tiebreak');
      return;
    }
    state.activeIdx = 1 - state.activeIdx;
    state.turn += 1;
    E.startTurn(state, events);
  };
})();

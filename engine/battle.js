// engine/battle.js - ต่อสู้ตามตารางข้อ 1 + ลำดับ battleStep ตามข้อ 6
// ทุกขั้นที่มีหน้าต่างตอบโต้เรียก E.openWindow: ขั้น 2 ข้ามอัตโนมัติ (ไม่มีลิงก์ใน Chain)
// ขั้น 5 ตั้ง E.hooks.priorityWindow แล้วเรียก E.battleResume(state, events) หลังปิดหน้าต่างเพื่อเดินต่อ
(function () {
  const CG = (globalThis.CG = globalThis.CG || {});
  CG.engine = CG.engine || {};
  const E = CG.engine;

  const STEPS = ['declare', 'battleStep', 'damageStep', 'damageCalc', 'afterDamage'];
  const WINDOWED = { declare: true, battleStep: true, damageStep: true };

  E.validateAttack = function (state, a) {
    if (state.phase !== 'battle') return 'WRONG_PHASE';
    if (state.battleStep !== null) return 'ATTACK_IN_PROGRESS';
    if (state.config.firstTurnNoAttack && state.turn === 1) return 'FIRST_TURN_NO_ATTACK';
    const n = state.config.monsterSlots;
    const me = state.players[a.player], opp = state.players[1 - a.player];
    if (!Number.isInteger(a.from) || a.from < 0 || a.from >= n) return 'INVALID_SLOT';
    const m = me.monsters[a.from];
    if (!m) return 'NO_MONSTER';
    if (m.faceDown || m.position !== 'atk') return 'NOT_ATTACK_POSITION';
    if (m.flags.attackedThisTurn) return 'ALREADY_ATTACKED';
    if (!m.flags.canAttack) return 'CANNOT_ATTACK';
    if (a.to === null) return opp.monsters.some(Boolean) ? 'MUST_ATTACK_MONSTER' : null;
    if (!Number.isInteger(a.to) || a.to < 0 || a.to >= n || !opp.monsters[a.to]) return 'INVALID_TARGET';
    return null;
  };

  E.attack = function (state, a, events) {
    const err = E.validateAttack(state, a); if (err) return err;
    const me = state.players[a.player], opp = state.players[1 - a.player];
    const m = me.monsters[a.from];
    m.flags.attackedThisTurn = true;
    state.attack = {
      player: a.player, from: a.from, to: a.to, attackerUid: m.uid,
      targetUid: a.to === null ? null : opp.monsters[a.to].uid, destroyed: []
    };
    events.push({ type: 'attackDeclared', from: a.from, to: a.to, player: a.player });
    E.fire(state, events, 'onAttackDeclared', { source: m, targetUid: state.attack.targetUid });
    if (state.ended) { endAttack(state); return null; }
    // onAttacked: เป้าเป็นมอนสเตอร์ (ไม่ใช่โจมตีตรง) ยังอยู่ และหงายอยู่ (เป้าคว่ำยังไม่เปิดเอฟเฟกต์ จะพลิกที่ damageStep)
    if (a.to !== null) {
      const t = opp.monsters[a.to];
      if (t && t.uid === state.attack.targetUid && !t.faceDown && me.monsters[a.from] === m) {
        E.fire(state, events, 'onAttacked', { source: t, attackerUid: m.uid });
        if (state.ended) { endAttack(state); return null; }
      }
    }
    enterStep(state, events, 'declare');
    return null;
  };

  function endAttack(state) { state.battleStep = null; state.attack = null; }

  function enterStep(state, events, step) {
    state.battleStep = step;
    const at = state.attack;
    const me = state.players[at.player], opp = state.players[1 - at.player];
    const attacker = me.monsters[at.from];
    const target = at.to === null ? null : opp.monsters[at.to];

    if (step === 'battleStep') {
      // ตรวจว่าผู้โจมตี/เป้ายังอยู่ ถ้าหาย การโจมตีถูกยกเลิก (ใช้สิทธิ์โจมตีไปแล้ว)
      if (!attacker || attacker.uid !== at.attackerUid) return endAttack(state);
      if (at.to !== null && (!target || target.uid !== at.targetUid)) return endAttack(state);
    } else if (step === 'damageStep') {
      // ป้องกันคว่ำ: พลิกหงายก่อนคำนวณ
      if (target && target.faceDown) {
        target.faceDown = false; target.position = 'def';
        events.push({ type: 'positionChange', uid: target.uid, position: 'def', faceDown: false });
        E.fire(state, events, 'onFlip', { source: target });
        if (state.ended) return endAttack(state);
      }
    } else if (step === 'damageCalc') {
      if (!attacker || attacker.uid !== at.attackerUid) return endAttack(state);
      if (at.to !== null && (!target || target.uid !== at.targetUid)) return endAttack(state);
      calc(state, events, at, attacker, target, me, opp);
      if (state.ended) return endAttack(state);
    } else if (step === 'afterDamage') {
      // onBattleDestroy: ผู้ที่ทำลายอีกฝ่ายในต่อสู้และยังอยู่บนสนาม (ผู้โจมตีทำลายเป้า หรือเป้าทำลายผู้โจมตี)
      const killers = [];
      if (at.destroyed.includes(at.targetUid)) killers.push([at.attackerUid, at.targetUid]);
      if (at.destroyed.includes(at.attackerUid)) killers.push([at.targetUid, at.attackerUid]);
      for (const [kUid, vUid] of killers) {
        if (state.ended) break;
        let k = null;
        for (const p of state.players) for (const m of p.monsters) if (m && m.uid === kUid) k = m;
        if (k) E.fire(state, events, 'onBattleDestroy', { source: k, victimUid: vUid });
      }
      // onBattleDestroyed: ตัวที่ถูกทำลายจากต่อสู้ (ตอนนี้อยู่สุสาน/Extra) ไม่ยิงถ้าตายด้วยเอฟเฟกต์ (ไม่อยู่ใน at.destroyed)
      for (const [kUid, vUid] of killers) {
        if (state.ended) break;
        let v = null;
        for (const p of state.players) for (const z of ['grave', 'extra']) for (const c of p[z]) if (c.uid === vUid) v = c;
        if (v) E.fire(state, events, 'onBattleDestroyed', { source: v, killerUid: kUid });
      }
      return endAttack(state);
    }

    if (WINDOWED[step] && E.openWindow(state, events, { kind: 'battle', step })) return; // หยุดรอ pending
    enterStep(state, events, STEPS[STEPS.indexOf(step) + 1]);
  }

  E.battleResume = function (state, events) {
    if (!state.attack) return;
    enterStep(state, events, STEPS[STEPS.indexOf(state.battleStep) + 1]);
  };

  // ตารางข้อ 1
  function calc(state, events, at, attacker, target, me, opp) {
    const A = E.atk(attacker);
    if (!target) { E.changeLp(state, events, opp.idx, -A, 'battle'); return; }       // โจมตีตรง
    const kill = (pIdx, slot, uid) => { E.destroyMonster(state, events, pIdx, slot, 'battle'); at.destroyed.push(uid); };
    if (target.position === 'atk') {
      const D = E.atk(target);
      if (A > D) { kill(opp.idx, at.to, target.uid); E.changeLp(state, events, opp.idx, -(A - D), 'battle'); }
      else if (A === D) { kill(opp.idx, at.to, target.uid); }                         // เท่ากัน: ทำลายเป้า ไม่เสีย LP
      else { kill(me.idx, at.from, attacker.uid); E.changeLp(state, events, me.idx, -(D - A), 'battle'); }
    } else {
      const D = E.def(target);
      if (A > D) kill(opp.idx, at.to, target.uid);                                    // ATK>DEF: เป้าตาย ไม่เสีย LP
      else if (A < D) E.changeLp(state, events, me.idx, -(D - A), 'battle');          // ATK<DEF: ผู้โจมตีเสีย LP
    }
  }
})();

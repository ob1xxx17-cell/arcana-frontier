// effects/primitives_combat.js - primitive ชุดต่อสู้ (ขั้น 4A-3): destroy, sendToGrave, damage, heal
// ต้องโหลดหลัง engine/core.js และ effects/runner.js
(function () {
  const CG = (globalThis.CG = globalThis.CG || {});
  const FX = (CG.effects = CG.effects || {});
  FX.ops = FX.ops || {};
  const reg = (op, fn) => { FX.ops[op] = fn; };
  const eng = () => CG.engine;

  const sideIdx = (ctx, who) => (who === 'opp' ? 1 - ctx.player : ctx.player);

  // 4E-2B: ตัวกรองกลางอยู่ที่ FX.matchFilter (runner.js) เรียกตอนรันจึงไม่ขึ้นกับลำดับโหลดไฟล์
  function matches(inst, f, ctx) { return FX.matchFilter(inst, f, ctx); }

  // คืน {inst, zone, owner, slot} ของการ์ดที่อยู่บนสนาม/มือ/เด็ค ; zone: monster | spell | field | hand | deck | grave
  function locate(state, uid) {
    for (let pi = 0; pi < state.players.length; pi++) {
      const p = state.players[pi];
      for (let s = 0; s < p.monsters.length; s++) if (p.monsters[s] && p.monsters[s].uid === uid) return { inst: p.monsters[s], zone: 'monster', owner: pi, slot: s };
      for (let s = 0; s < p.spells.length; s++) if (p.spells[s] && p.spells[s].uid === uid) return { inst: p.spells[s], zone: 'spell', owner: pi, slot: s };
      if (p.fieldSpell && p.fieldSpell.uid === uid) return { inst: p.fieldSpell, zone: 'field', owner: pi, slot: 0 };
      for (const z of ['hand', 'deck', 'grave', 'removed']) {
        const i = (p[z] || []).findIndex(c => c.uid === uid);
        if (i >= 0) return { inst: p[z][i], zone: z, owner: pi, slot: i };
      }
    }
    // ตัวซ้อนใต้มอนสเตอร์ (4E-2B) zone:'under' slot = ลำดับใน parent.under
    for (let pi = 0; pi < state.players.length; pi++) {
      for (const par of state.players[pi].monsters) {
        if (!par) continue;
        const i = (par.under || []).findIndex(c => c.uid === uid);
        if (i >= 0) return { inst: par.under[i], zone: 'under', owner: pi, slot: i, parent: par };
      }
    }
    return null;
  }

  // "self" หรือ selector {side, zone, filter, count, other?, pick?} (choose:"player" ยังไม่มี pending จึงเลือกตัวแรกที่ตรง)
  // zone:'under' = ตัวซ้อนใต้การ์ดต้นทาง (ctx.source) เท่านั้น
  function resolveTargets(state, target, ctx, defaultZone, events, step) {
    if (FX.resolveSpecialTarget) {
      const special = FX.resolveSpecialTarget(state, target, ctx);
      if (special) return special;
    }
    if (target === 'self' || target === undefined) {
      const loc = ctx.source ? locate(state, ctx.source.uid) : null;
      return loc ? [loc] : [];
    }
    if (target === 'watched') {
      const loc = ctx.watched ? locate(state, ctx.watched.uid) : null;
      return loc ? [loc] : [];
    }
    const zone = target.zone || defaultZone;
    const pi = sideIdx(ctx, target.side);
    const p = state.players[pi];
    let list = [];
    if (zone === 'under') {
      const par = ctx.source ? locate(state, ctx.source.uid) : null;
      if (par && par.zone === 'monster') par.inst.under.forEach((u, i) => list.push({ inst: u, zone: 'under', owner: par.owner, slot: i, parent: par.inst }));
    } else if (zone === 'monster') p.monsters.forEach((m, s) => { if (m) list.push({ inst: m, zone, owner: pi, slot: s }); });
    else if (zone === 'spell' || zone === 'equip') {
      p.spells.forEach((m, s) => { if (m) list.push({ inst: m, zone: 'spell', owner: pi, slot: s }); });
      if (p.fieldSpell) list.push({ inst: p.fieldSpell, zone: 'field', owner: pi, slot: 0 });
      p.monsters.forEach((mon) => {
        if (mon && Array.isArray(mon.under)) {
          mon.under.forEach((u, ui) => {
            const uDef = CG.engine ? CG.engine.cardOf(u) : null;
            const isEq = Boolean(u && (u.isEquip || (uDef && (uDef.equip || uDef.group === 'equip' || ((uDef.tags || []).includes('equip'))))));
            if (isEq) {
              list.push({ inst: u, zone: 'under', owner: pi, slot: ui, parent: mon });
            }
          });
        }
      });
    } else if (zone === 'hand' || zone === 'deck' || zone === 'grave') p[zone].forEach((m, i) => list.push({ inst: m, zone, owner: pi, slot: i }));
    if (target.slot !== undefined) list = list.filter(l => l.slot === target.slot);
    list = FX.refine(list.filter(l => matches(l.inst, target.filter, ctx)), target, ctx, l => l.inst);

    const count = target.count === undefined ? list.length : target.count;

    // 5A: Resumed choice
    if (ctx && ctx._stepChoice !== undefined) {
      return ctx._stepChoice.map(idx => list[idx]).filter(Boolean);
    }

    // 5A: Check if we should ask player
    if (FX.shouldAskPlayer && FX.shouldAskPlayer(state, step, target, list.length, count, ctx)) {
      const kind = (zone === 'hand' || zone === 'deck' || zone === 'grave') ? 'chooseCards' : 'chooseTarget';
      const prompt = (target && target.prompt) || (kind === 'chooseCards' ? 'CHOOSE_CARDS' : 'CHOOSE_TARGET');
      const options = list.map((loc, idx) => ({
        uid: loc.inst.uid,
        zone: loc.zone,
        side: loc.owner === ctx.player ? 'self' : 'opp',
        slot: loc.slot,
        cardId: loc.inst.cardId,
        index: idx
      }));
      FX.openPending(state, events, {
        kind: kind,
        player: ctx.player,
        prompt: prompt,
        options: options,
        min: Math.min(count, list.length),
        max: Math.min(count, list.length),
        resume: FX.makeResume(state, step, ctx)
      });
      return null;
    }

    return list.slice(0, count);
  }

  // preventDestruction: การ์ดที่มีเอฟเฟกต์ continuous ซึ่ง do มี op preventDestruction ; instead = ขั้นตอนที่ทำแทน (ถ้ามี)
  // 6D: ใช้ E.getDestructionPreventer ร่วมกัน รองรับ cause: battle | effect
  reg('preventDestruction', function () {});
  reg('battleProtection', function () {}); // alias สำหรับความเข้ากันได้
  reg('buff', function (state, events, step, ctx) {
    if (FX.ops.modifyStat) return FX.ops.modifyStat(state, events, step, ctx);
  });
  reg('aura', function (state, events, step, ctx) {
    if (FX.ops.modifyStat) return FX.ops.modifyStat(state, events, step, ctx);
  });

  function preventer(state, inst, cause) {
    if (eng().getDestructionPreventer) return eng().getDestructionPreventer(state, inst, cause || 'effect');
    const def = eng().cardOf(inst) || {};
    for (const e of def.effects || []) {
      if (e.trigger !== 'continuous') continue;
      const s = (e.do || []).find(x => x.op === 'preventDestruction' || x.op === 'battleProtection');
      if (!s) continue;
      const c = { source: inst, player: inst.controller, cause: cause || 'effect' };
      const conds = (s.condition || []).concat(e.condition || []);
      if (conds.every(k => FX.conditions && FX.conditions[k.op] && FX.conditions[k.op](state, k, c))) return s;
    }
    return null;
  }

  reg('destroy', function (state, events, step, ctx) {
    const E = eng();
    // เก็บ uid ก่อน เพราะการทำลายอาจเปลี่ยนตำแหน่ง/ยิงเอฟเฟกต์ต่อเนื่อง
    const rawLocs = resolveTargets(state, step.target, ctx, 'monster', events, step);
    if (!rawLocs) return;
    const locs = rawLocs.filter(l => l.zone === 'monster');
    const destroyed = [];
    for (const loc0 of locs) {
      if (state.ended) break;
      const loc = locate(state, loc0.inst.uid);
      if (!loc || loc.zone !== 'monster') continue;   // หายไปแล้ว (เช่นถูกเอฟเฟกต์อื่นย้าย)
      const prev = preventer(state, loc.inst, 'effect');
      if (prev) {
        events.push({ type: 'destroyPrevented', uid: loc0.inst.uid });
        const sub = Array.isArray(prev.instead) ? prev.instead : [];
        for (const s of sub) if (FX.ops[s.op]) FX.ops[s.op](state, events, s, { player: loc.owner, source: loc.inst });
        continue;
      }
      const atkBefore = E.atk(loc.inst);
      const defBefore = E.def(loc.inst);
      destroyed.push({ uid: loc0.inst.uid, atk: atkBefore, def: defBefore, cardId: loc.inst.cardId });
      // E.destroyMonster เคารพ state.config.overlayDestroyTogether: เปิด = ตัวใต้ถูกทำลายด้วย (event destroy + onDestroyed),
      // ปิด = ตัวใต้ถูกย้ายสุสานเฉย ๆ ไม่นับว่าถูกทำลาย
      E.destroyMonster(state, events, loc.owner, loc.slot, 'effect');
    }
    // 4E-4: บันทึกผลลัพธ์ของ op ให้ op ถัดไปอ้างอิงได้
    ctx.lastResult = {
      op: 'destroy',
      ok: destroyed.length > 0,
      count: destroyed.length,
      atk: destroyed.length > 0 ? destroyed[0].atk : 0,
      destroyed
    };
  });

  reg('sendToGrave', function (state, events, step, ctx) {
    const E = eng();
    const locs = resolveTargets(state, step.target, ctx, 'monster', events, step);
    if (!locs) return;
    const uids = locs.map(l => l.inst.uid);
    let sentCount = 0;
    for (const uid of uids) {
      const loc = locate(state, uid);
      if (!loc || loc.zone === 'grave') continue;
      if (loc.zone === 'monster') { E.leaveField(state, events, loc.owner, loc.slot, 'grave'); sentCount++; continue; }
      if (loc.zone === 'under') {   // ตัวซ้อนใต้ -> สุสานของเจ้าของ (ไม่นับเป็นการทำลาย)
        loc.parent.under.splice(loc.slot, 1);
        E.resetInstance(loc.inst);
        state.players[loc.inst.owner].grave.push(loc.inst);
        events.push({ type: 'moveCard', uid, from: 'under', to: 'grave', player: loc.owner, slot: loc.slot });
        E.fire(state, events, 'onSentToGrave', { source: loc.inst });
        sentCount++;
        continue;
      }
      const p = state.players[loc.owner];
      if (loc.zone === 'field') p.fieldSpell = null;
      else if (loc.zone === 'spell') p.spells[loc.slot] = null;
      else p[loc.zone].splice(loc.slot, 1);
      E.resetInstance(loc.inst);
      state.players[loc.inst.owner].grave.push(loc.inst);
      events.push({ type: 'moveCard', uid, from: loc.zone, to: 'grave', player: loc.owner, slot: loc.slot });
      E.fire(state, events, 'onSentToGrave', { source: loc.inst });
      sentCount++;
    }
    ctx.lastResult = { op: 'sendToGrave', ok: sentCount > 0, count: sentCount };
  });

  const amountOf = step => Math.max(0, step.amount === undefined ? (step.value === undefined ? 0 : step.value) : step.amount);

  reg('damage', function (state, events, step, ctx) {
    const n = Math.max(0, FX.resolveValue ? FX.resolveValue(state, step, ctx, amountOf(step)) : amountOf(step));
    if (n > 0) eng().changeLp(state, events, sideIdx(ctx, step.player), -n, 'effect');
  });

  reg('heal', function (state, events, step, ctx) {
    const n = Math.max(0, FX.resolveValue ? FX.resolveValue(state, step, ctx, amountOf(step)) : amountOf(step));
    if (n > 0) eng().changeLp(state, events, sideIdx(ctx, step.player), n, 'effect');
  });

  // ---- 4E-2C-1 ----
  // extraAttack {target?: 'self'|selector, count?: number} : ให้โจมตีเพิ่ม N ครั้งในเทิร์นนั้น
  reg('extraAttack', function (state, events, step, ctx) {
    const count = step.count !== undefined ? step.count : 1;
    const uids = resolveTargets(state, step.target, ctx, 'monster').filter(l => l.zone === 'monster').map(l => l.inst.uid);
    for (const uid of uids) {
      const loc = locate(state, uid);
      if (!loc || loc.zone !== 'monster') continue;
      const m = loc.inst;
      if (m.extraAttacksTurn !== state.turn) {
        m.extraAttacks = 0;
        m.extraAttacksTurn = state.turn;
      }
      m.extraAttacks += count;
      m.flags = m.flags || {};
      m.flags.attackedThisTurn = false;
      events.push({ type: 'extraAttack', uid: m.uid, count });
    }
  });

  // restrictAttack {target?: 'self'|selector, duration?: 'permanent'|'endTurn'} : ฝ่ายตรงข้ามต้องเลือกเป้านี้ก่อน
  reg('restrictAttack', function (state, events, step, ctx) {
    const duration = step.duration || 'permanent';
    const uids = resolveTargets(state, step.target, ctx, 'monster').filter(l => l.zone === 'monster').map(l => l.inst.uid);
    for (const uid of uids) {
      const loc = locate(state, uid);
      if (!loc || loc.zone !== 'monster') continue;
      const m = loc.inst;
      if (duration === 'endTurn') {
        m.tempRestrictAttack = state.turn;
      } else {
        m.restrictAttack = true;
      }
      events.push({ type: 'restrictAttack', uid: m.uid, duration });
    }
  });

  // ---- 4E-4 ----
  // cannotAttack {target?: 'self'|selector, duration?: 'permanent'|'endTurn'|'whileSource'}
  reg('cannotAttack', function (state, events, step, ctx) {
    const duration = step.duration || 'permanent';
    const locs = resolveTargets(state, step.target, ctx, 'monster', events, step);
    if (!locs) return;
    const uids = locs.filter(l => l.zone === 'monster').map(l => l.inst.uid);
    for (const uid of uids) {
      const loc = locate(state, uid);
      if (!loc || loc.zone !== 'monster') continue;
      const m = loc.inst;
      if (duration === 'endTurn') {
        m.tempCannotAttackTurn = state.turn;
      } else if (duration === 'whileSource') {
        m.cannotAttackWhileSource = ctx.source ? ctx.source.uid : true;
      } else {
        m.cannotAttack = true;
        m.flags.canAttack = false;
      }
      events.push({ type: 'cannotAttack', uid: m.uid, duration });
    }
  });

  // fireEffect {target, effectId} : สั่งรันเอฟเฟกต์ของการ์ดอื่นทันที ข้ามเงื่อนไข trigger แต่จ่าย cost และเคารพ limit
  reg('fireEffect', function (state, events, step, ctx) {
    const E = eng();
    const targets = resolveTargets(state, step.target, ctx, 'monster', events, step);
    if (!targets) return;
    for (const t of targets) {
      if (state.ended) break;
      const inst = t.inst;
      const def = E.cardOf(inst);
      if (!def || !def.effects) continue;
      const eff = def.effects.find(e => e.id === step.effectId);
      if (!eff) continue;
      const effCopy = Object.assign({}, eff, { condition: [] });
      const subCtx = { source: inst, player: inst.controller, trigger: 'fireEffect', parentEffect: ctx.effect };
      const buf = [];
      const r = FX.run(state, buf, effCopy, subCtx);
      if (r.ok) {
        events.push({ type: 'effectActivated', uid: inst.uid, cardId: inst.cardId, effectId: eff.id, trigger: 'fireEffect' });
        events.push(...buf);
      }
    }
  });

  // 5B: negate { target?: 'previous' | number, link?: number } : ลบล้างลิงก์เป้าหมายใน Chain
  reg('negate', function (state, events, step, ctx) {
    if (!state.chain || !state.chain.length) return;
    let targetLink = null;
    if (step.link !== undefined) {
      targetLink = state.chain.find(l => l.linkId === step.link);
    } else if (step.target !== undefined && typeof step.target === 'number') {
      targetLink = state.chain.find(l => l.linkId === step.target);
    } else {
      const curId = (ctx && ctx.linkId !== undefined) ? ctx.linkId : Infinity;
      for (let i = state.chain.length - 1; i >= 0; i--) {
        const l = state.chain[i];
        if (ctx && ctx.linkId !== undefined && l.linkId === ctx.linkId) continue;
        if (l.linkId < curId && !l.negated) {
          targetLink = l;
          break;
        }
      }
    }
    if (targetLink) {
      targetLink.negated = true;
    }
  });

  // 5B: negateAttack : ยกเลิกการโจมตีปัจจุบัน จบการต่อสู้โดยไม่มีดาเมจ
  reg('negateAttack', function (state, events, step, ctx) {
    if (state.attack) {
      state.attack.negated = true;
      events.push({ type: 'attackNegated', attackerUid: state.attack.attackerUid, player: state.attack.player });
    }
  });

  // silence / negateEffect { target?: selector, duration?: 'endTurn'|'permanent' }
  function doSilence(state, events, step, ctx) {
    const locs = resolveTargets(state, step.target, ctx, 'monster', events, step);
    if (!locs) return;
    const duration = step.duration || 'endTurn';
    let count = 0;
    for (const loc of locs) {
      if (loc.zone !== 'monster') continue;
      const m = loc.inst;
      m.negated = true;
      m.silenced = true;
      if (duration === 'endTurn') {
        m.silencedTurn = state.turn;
      }
      events.push({ type: 'statusChange', uid: m.uid, status: 'silenced', duration });
      count++;
    }
    ctx.lastResult = { op: 'silence', count, ok: count > 0 };
  }
  reg('silence', doSilence);
  reg('negateEffect', doSilence);

  // freeze { target?: selector, duration?: 'nextTurn'|'endTurn' } : แช่แข็งห้ามโจมตีและห้ามเปลี่ยนท่า
  reg('freeze', function (state, events, step, ctx) {
    const locs = resolveTargets(state, step.target, ctx, 'monster', events, step);
    if (!locs) return;
    const duration = step.duration || 'nextTurn';
    let count = 0;
    for (const loc of locs) {
      if (loc.zone !== 'monster') continue;
      const m = loc.inst;
      m.frozen = true;
      m.cannotAttack = true;
      m.cannotChangePosition = true;
      m.frozenUntilTurn = state.turn + (duration === 'endTurn' ? 0 : 1);
      events.push({ type: 'statusChange', uid: m.uid, status: 'frozen', duration });
      count++;
    }
    ctx.lastResult = { op: 'freeze', count, ok: count > 0 };
  });

  // grantPiercing { target?: 'self'|selector, duration?: 'endTurn'|'permanent' }
  reg('grantPiercing', function (state, events, step, ctx) {
    const locs = resolveTargets(state, step.target || 'self', ctx, 'monster', events, step);
    if (!locs) return;
    const duration = step.duration || 'endTurn';
    let count = 0;
    for (const loc of locs) {
      if (loc.zone !== 'monster') continue;
      const m = loc.inst;
      m.piercing = true;
      if (duration === 'endTurn') {
        m.piercingTurn = state.turn;
      }
      events.push({ type: 'statusChange', uid: m.uid, status: 'piercing', duration });
      count++;
    }
    ctx.lastResult = { op: 'grantPiercing', count, ok: count > 0 };
  });
})();

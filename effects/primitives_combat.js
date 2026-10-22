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
      for (const z of ['hand', 'deck', 'grave']) {
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
  function resolveTargets(state, target, ctx, defaultZone) {
    if (target === 'self' || target === undefined) {
      const loc = ctx.source ? locate(state, ctx.source.uid) : null;
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
    else if (zone === 'spell') {
      p.spells.forEach((m, s) => { if (m) list.push({ inst: m, zone, owner: pi, slot: s }); });
      if (p.fieldSpell) list.push({ inst: p.fieldSpell, zone: 'field', owner: pi, slot: 0 });
    } else if (zone === 'hand' || zone === 'deck' || zone === 'grave') p[zone].forEach((m, i) => list.push({ inst: m, zone, owner: pi, slot: i }));
    list = FX.refine(list.filter(l => matches(l.inst, target.filter, ctx)), target, ctx, l => l.inst);
    return list.slice(0, target.count === undefined ? list.length : target.count);
  }

  // preventDestruction: การ์ดที่มีเอฟเฟกต์ continuous ซึ่ง do มี op preventDestruction ; instead = ขั้นตอนที่ทำแทน (ถ้ามี)
  // 4E-2B: ถ้า effect มี condition (เช่น hasUnder) ต้องจริงด้วยจึงกันได้ ไม่จริง/ไม่รู้จัก condition = ถูกทำลายตามปกติ
  function preventer(state, inst) {
    const def = eng().cardOf(inst) || {};
    for (const e of def.effects || []) {
      if (e.trigger !== 'continuous') continue;
      const s = (e.do || []).find(x => x.op === 'preventDestruction');
      if (!s) continue;
      const c = { source: inst, player: inst.controller };
      if ((e.condition || []).every(k => FX.conditions && FX.conditions[k.op] && FX.conditions[k.op](state, k, c))) return s;
    }
    return null;
  }

  reg('destroy', function (state, events, step, ctx) {
    const E = eng();
    // เก็บ uid ก่อน เพราะการทำลายอาจเปลี่ยนตำแหน่ง/ยิงเอฟเฟกต์ต่อเนื่อง
    const uids = resolveTargets(state, step.target, ctx, 'monster').filter(l => l.zone === 'monster').map(l => l.inst.uid);
    for (const uid of uids) {
      if (state.ended) break;
      const loc = locate(state, uid);
      if (!loc || loc.zone !== 'monster') continue;   // หายไปแล้ว (เช่นถูกเอฟเฟกต์อื่นย้าย)
      const prev = preventer(state, loc.inst);
      if (prev) {
        events.push({ type: 'destroyPrevented', uid });
        const sub = Array.isArray(prev.instead) ? prev.instead : [];
        for (const s of sub) if (FX.ops[s.op]) FX.ops[s.op](state, events, s, { player: loc.owner, source: loc.inst });
        continue;
      }
      // E.destroyMonster เคารพ state.config.overlayDestroyTogether: เปิด = ตัวใต้ถูกทำลายด้วย (event destroy + onDestroyed),
      // ปิด = ตัวใต้ถูกย้ายสุสานเฉย ๆ ไม่นับว่าถูกทำลาย
      E.destroyMonster(state, events, loc.owner, loc.slot, 'effect');
    }
  });

  reg('sendToGrave', function (state, events, step, ctx) {
    const E = eng();
    const uids = resolveTargets(state, step.target, ctx, 'monster').map(l => l.inst.uid);
    for (const uid of uids) {
      const loc = locate(state, uid);
      if (!loc || loc.zone === 'grave') continue;
      if (loc.zone === 'monster') { E.leaveField(state, events, loc.owner, loc.slot, 'grave'); continue; }
      if (loc.zone === 'under') {   // ตัวซ้อนใต้ -> สุสานของเจ้าของ (ไม่นับเป็นการทำลาย)
        loc.parent.under.splice(loc.slot, 1);
        E.resetInstance(loc.inst);
        state.players[loc.inst.owner].grave.push(loc.inst);
        events.push({ type: 'moveCard', uid, from: 'under', to: 'grave', player: loc.owner, slot: loc.slot });
        E.fire(state, events, 'onSentToGrave', { source: loc.inst });
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
    }
  });

  const amountOf = step => Math.max(0, step.amount === undefined ? 0 : step.amount);

  reg('damage', function (state, events, step, ctx) {
    const n = amountOf(step);
    if (n > 0) eng().changeLp(state, events, sideIdx(ctx, step.player), -n, 'effect');
  });

  reg('heal', function (state, events, step, ctx) {
    const n = amountOf(step);
    if (n > 0) eng().changeLp(state, events, sideIdx(ctx, step.player), n, 'effect');
  });
})();

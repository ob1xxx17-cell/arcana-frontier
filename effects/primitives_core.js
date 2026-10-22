// effects/primitives_core.js - primitive ชุดแกน (ขั้น 4A-1): draw, addMana, modifyStat
// ต้องโหลดหลัง engine/core.js และ effects/runner.js
(function () {
  const CG = (globalThis.CG = globalThis.CG || {});
  // ลงทะเบียนตรงเข้า FX.ops (เหมือน FX.register) เพื่อไม่ขึ้นกับลำดับโหลดไฟล์ระหว่าง runner.js กับไฟล์นี้
  const FX = (CG.effects = CG.effects || {});
  FX.ops = FX.ops || {};
  const reg = (op, fn) => { FX.ops[op] = fn; };
  const eng = () => CG.engine;

  const sideIdx = (ctx, who) => (who === 'opp' ? 1 - ctx.player : ctx.player);

  function findOnField(state, uid) {
    for (const p of state.players) for (const m of p.monsters) if (m && m.uid === uid) return m;
    return null;
  }
  // 4E-2B: ตัวกรองกลางอยู่ที่ FX.matchFilter (runner.js) เรียกตอนรันจึงไม่ขึ้นกับลำดับโหลดไฟล์
  function matches(inst, f, ctx) { return FX.matchFilter(inst, f, ctx); }
  // 4A-1 รองรับ "self" และ selector โซน monster (choose:"player" ยังไม่มี pending จึงเลือกอัตโนมัติ = ตัวแรกที่ตรง)
  function resolveTargets(state, target, ctx) {
    if (target === 'self' || target === undefined) {
      const m = ctx.source ? findOnField(state, ctx.source.uid) : null;
      return m ? [m] : [];
    }
    if (target.zone && target.zone !== 'monster') return [];
    const p = state.players[sideIdx(ctx, target.side)];
    const list = FX.refine(p.monsters.filter(m => m && matches(m, target.filter, ctx)), target, ctx, x => x);
    return list.slice(0, target.count === undefined ? list.length : target.count);
  }

  reg('draw', function (state, events, step, ctx) {
    const n = step.count === undefined ? 1 : step.count;
    for (let i = 0; i < n; i++) if (!eng().drawCard(state, events, sideIdx(ctx, step.player), true)) break;
  });

  reg('addMana', function (state, events, step, ctx) {
    const idx = sideIdx(ctx, step.player);
    const amount = step.amount === undefined ? 1 : step.amount;
    state.players[idx].mana += amount;
    events.push({ type: 'manaChange', player: idx, delta: amount, reason: 'effect' });
  });

  reg('modifyStat', function (state, events, step, ctx) {
    if (step.aura) return;   // aura (continuous) ไม่ใช่การแก้ค่า คำนวณใน FX.refreshAuras ห้ามเขียนลงค่าถาวร
    const stat = step.stat === 'def' ? 'def' : 'atk';
    const temp = step.duration === 'endTurn';
    const field = (temp ? 'temp' : '') + (temp ? stat[0].toUpperCase() + stat.slice(1) : stat) + 'Mod';
    for (const m of resolveTargets(state, step.target, ctx)) {
      m[field] += step.amount;
      events.push({ type: 'statChange', uid: m.uid, stat, delta: step.amount, duration: temp ? 'endTurn' : 'permanent' });
    }
  });

  // ---- 4E-2B ----
  // reduceCost : ตัวประกาศ (ใช้ใน effect continuous) ไม่ทำอะไรตอนรัน ตัวลดมานาจริงอยู่ที่ runner.js (FX.run)
  reg('reduceCost', function () {});

  // choice {choose:'player'|'auto', options:[{do:[steps]}, ...], pick?} : เลือก 1 จาก N เอฟเฟกต์ย่อย
  // ข้อจำกัดชั่วคราว (CONTRACT ข้อ 10): ยังไม่มีหน้าต่างให้ผู้เล่นเลือก engine เลือกอัตโนมัติ = ตัวแรกที่ \"ทำได้จริง\"
  //   (ลองรันกับสำเนา state ถ้าสถานะเปลี่ยนถือว่าทำได้) ถ้าไม่มีตัวไหนทำได้ใช้ตัวแรก ; step.pick (เลข 0..N-1) บังคับเลือกตัวนั้น (ขั้น 5 ใช้ผลจาก pending)
  function runnable(opt) { return opt && Array.isArray(opt.do) && opt.do.every(s => FX.ops[s.op]); }
  function feasible(state, opt, ctx) {
    if (!runnable(opt)) return false;
    try {
      const probe = eng().cloneState(state), before = JSON.stringify(probe.players);
      for (const s of opt.do) { FX.ops[s.op](probe, [], s, Object.assign({}, ctx)); if (probe.ended) break; }
      return JSON.stringify(probe.players) !== before || probe.ended !== state.ended;
    } catch (e) { return false; }
  }
  reg('choice', function (state, events, step, ctx) {
    const opts = step.options || [];
    if (!opts.length) return;
    let i = Number.isInteger(step.pick) && step.pick >= 0 && step.pick < opts.length ? step.pick : opts.findIndex(o => feasible(state, o, ctx));
    if (i < 0) i = 0;
    events.push({ type: 'choiceMade', uid: ctx.source ? ctx.source.uid : null, index: i });
    if (!runnable(opts[i])) return;
    for (const s of opts[i].do) { FX.ops[s.op](state, events, s, ctx); if (state.ended) break; }
  });
})();

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
  // 4A-1 รองรับ "self" และ selector โซน monster (choose:"player" รองรับ pending ในขั้น 5A)
  function resolveTargets(state, target, ctx, events, step) {
    if (FX.resolveSpecialTarget) {
      const special = FX.resolveSpecialTarget(state, target, ctx);
      if (special) return special.map(l => l.inst || l).filter(Boolean);
    }
    if (target === 'self' || target === undefined) {
      const m = ctx.source ? findOnField(state, ctx.source.uid) : null;
      return m ? [m] : [];
    }
    if (target.zone && target.zone !== 'monster') return [];
    const p = state.players[sideIdx(ctx, target.side)];
    const list = FX.refine(p.monsters.filter(m => m && matches(m, target.filter, ctx)), target, ctx, x => x);
    const count = target.count === undefined ? list.length : target.count;

    if (ctx && ctx._stepChoice !== undefined) {
      return ctx._stepChoice.map(idx => list[idx]).filter(Boolean);
    }

    if (FX.shouldAskPlayer && FX.shouldAskPlayer(state, step, target, list.length, count, ctx)) {
      const kind = 'chooseTarget';
      const prompt = (target && target.prompt) || 'CHOOSE_TARGET';
      const options = list.map((m, idx) => ({
        uid: m.uid,
        zone: 'monster',
        side: m.controller === ctx.player ? 'self' : 'opp',
        slot: p.monsters.indexOf(m),
        cardId: m.cardId,
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

  reg('draw', function (state, events, step, ctx) {
    const n = step.count === undefined ? 1 : step.count;
    for (let i = 0; i < n; i++) if (!eng().drawCard(state, events, sideIdx(ctx, step.player), true)) break;
  });

  reg('addMana', function (state, events, step, ctx) {
    const idx = sideIdx(ctx, step.player);
    const amount = step.amount === undefined ? 1 : step.amount;
    state.players[idx].mana = Math.max(0, state.players[idx].mana + amount);
    events.push({ type: 'manaChange', player: idx, delta: amount, reason: 'effect' });
  });

  // reduceMana { player?: 'opp'|'self', amount?: number } : ลดมานา (Arcana) ของผู้เล่น (ไม่ต่ำกว่า 0)
  reg('reduceMana', function (state, events, step, ctx) {
    const idx = sideIdx(ctx, step.player || 'opp');
    const rawAmount = step.amount === undefined ? 1 : step.amount;
    const amount = Math.max(0, FX.resolveValue ? FX.resolveValue(state, step, ctx, rawAmount) : rawAmount);
    const p = state.players[idx];
    const actualReduced = Math.min(p.mana, amount);
    if (actualReduced > 0) {
      p.mana -= actualReduced;
      events.push({ type: 'manaChange', player: idx, delta: -actualReduced, reason: 'effect' });
    }
    ctx.lastResult = { op: 'reduceMana', amount: actualReduced, ok: actualReduced > 0 };
  });

  // drainMana { amount?: number } : ดูดมานา (Arcana) จากฝ่ายตรงข้ามมาเพิ่มให้เรา
  reg('drainMana', function (state, events, step, ctx) {
    const oppIdx = sideIdx(ctx, 'opp');
    const myIdx = ctx.player;
    const rawAmount = step.amount === undefined ? 1 : step.amount;
    const amount = Math.max(0, FX.resolveValue ? FX.resolveValue(state, step, ctx, rawAmount) : rawAmount);
    const opp = state.players[oppIdx];
    const drained = Math.min(opp.mana, amount);
    if (drained > 0) {
      opp.mana -= drained;
      events.push({ type: 'manaChange', player: oppIdx, delta: -drained, reason: 'effect' });
      state.players[myIdx].mana += drained;
      events.push({ type: 'manaChange', player: myIdx, delta: drained, reason: 'effect' });
    }
    ctx.lastResult = { op: 'drainMana', amount: drained, ok: drained > 0 };
  });

  reg('modifyStat', function (state, events, step, ctx) {
    if (step.aura) return;   // aura (continuous) ไม่ใช่การแก้ค่า คำนวณใน FX.refreshAuras ห้ามเขียนลงค่าถาวร
    const stat = step.stat === 'def' ? 'def' : 'atk';
    const temp = step.duration === 'endTurn';
    const field = (temp ? 'temp' : '') + (temp ? stat[0].toUpperCase() + stat.slice(1) : stat) + 'Mod';
    const amount = FX.resolveValue ? FX.resolveValue(state, step, ctx, step.amount || 0) : (step.amount || 0);
    const targets = resolveTargets(state, step.target, ctx, events, step);
    if (!targets) return;
    for (const m of targets) {
      m[field] += amount;
      events.push({ type: 'statChange', uid: m.uid, stat, delta: amount, duration: temp ? 'endTurn' : 'permanent' });
    }
  });

  // ---- 4E-2C-1 ----
  // changePosition {target, position: 'atk'|'def'|'toggle', faceDown?: boolean}
  reg('changePosition', function (state, events, step, ctx) {
    const E = eng();
    const targets = resolveTargets(state, step.target, ctx, events, step);
    if (!targets) return;
    for (const m of targets) {
      const curPos = m.position;
      let nextPos = step.position;
      if (!nextPos || nextPos === 'toggle') {
        nextPos = curPos === 'atk' ? 'def' : 'atk';
      }
      if (step.faceDown !== undefined) {
        const nextFd = !!step.faceDown;
        if (m.position !== nextPos || m.faceDown !== nextFd) {
          const wasFd = m.faceDown;
          m.position = nextPos;
          m.faceDown = nextFd;
          events.push({ type: 'positionChange', uid: m.uid, position: m.position, faceDown: m.faceDown });
          if (wasFd && !nextFd) E.fire(state, events, 'onFlip', { source: m });
        }
      } else if (m.faceDown && nextPos === 'atk') {
        m.faceDown = false;
        m.position = 'atk';
        events.push({ type: 'positionChange', uid: m.uid, position: 'atk', faceDown: false });
        E.fire(state, events, 'onFlip', { source: m });
      } else if (m.position !== nextPos) {
        m.position = nextPos;
        events.push({ type: 'positionChange', uid: m.uid, position: m.position, faceDown: m.faceDown });
      }
    }
  });

  // ---- 4E-2B ----
  // reduceCost : ตัวประกาศ (ใช้ใน effect continuous) ไม่ทำอะไรตอนรัน ตัวลดมานาจริงอยู่ที่ runner.js (FX.run)
  reg('reduceCost', function () {});

  reg('reduceTurnCost', function (state, events, step, ctx) {
    const p = state.players[ctx.player];
    p.flags.turnCostReduction = {
      amount: step.amount || 1,
      tag: step.tag || 'luna',
      turn: state.turn
    };
    events.push({ type: 'turnCostReduced', player: ctx.player, amount: step.amount || 1, tag: step.tag || 'luna' });
  });

  reg('skipOpponentDraw', function (state, events, step, ctx) {
    const opp = 1 - ctx.player;
    state.players[opp].flags = state.players[opp].flags || {};
    state.players[opp].flags.skipDrawPhase = true;
    events.push({ type: 'skipDrawSet', player: opp });
  });

  reg('immuneEffects', function (state, events, step, ctx) {
    const p = state.players[ctx.player];
    for (const m of p.monsters) {
      if (m) {
        m.flags = m.flags || {};
        m.flags.immuneEffectsTurn = state.turn;
      }
    }
    events.push({ type: 'immuneEffectsSet', player: ctx.player });
  });

  reg('checkAndNukeFP', function (state, events, step, ctx) {
    const p = state.players[ctx.player];
    const wantCount = step.count || 4;
    let count = 0;
    for (const m of p.monsters) {
      if (m && !m.faceDown && FX.matchFilter(m, step.filter, ctx)) count++;
    }
    if (count >= wantCount) {
      const amt = step.amount || 4000;
      eng().changeLp(state, events, ctx.player, amt, 'effect');
      eng().changeLp(state, events, 1 - ctx.player, -amt, 'effect');
    }
  });

  reg('forceEndTurnAfterBattle', function (state, events, step, ctx) {
    state.flags = state.flags || {};
    state.flags.forceEndTurnAfterBattle = true;
    events.push({ type: 'forceEndTurnSet', player: ctx.player });
  });

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

    // 5A: chooseOption pending
    if (state.config && state.config.autoChoose === false && step.choose === 'player' && ctx._stepChoice === undefined) {
      if (opts.length > 1) {
        const kind = 'chooseOption';
        const prompt = step.prompt || 'CHOOSE_OPTION';
        const options = opts.map((o, idx) => ({ index: idx, name: o.name || ('option_' + idx), text: o.text || '' }));
        FX.openPending(state, events, {
          kind: kind,
          player: ctx.player,
          prompt: prompt,
          options: options,
          min: 1,
          max: 1,
          resume: FX.makeResume(state, step, ctx)
        });
        return;
      }
    }

    let i;
    if (ctx._stepChoice !== undefined && Array.isArray(ctx._stepChoice) && ctx._stepChoice.length > 0) {
      i = ctx._stepChoice[0];
    } else {
      i = Number.isInteger(step.pick) && step.pick >= 0 && step.pick < opts.length ? step.pick : opts.findIndex(o => feasible(state, o, ctx));
      if (i < 0) i = 0;
    }
    events.push({ type: 'choiceMade', uid: ctx.source ? ctx.source.uid : null, index: i });
    if (!runnable(opts[i])) return;
    for (const s of opts[i].do) {
      FX.ops[s.op](state, events, s, ctx);
      if (state.pending || state.ended) break;
    }
  });
})();

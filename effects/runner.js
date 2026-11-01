// effects/runner.js - ตัวรันเอฟเฟกต์ (ขั้น 4A-1): ลงทะเบียน primitive/condition, เช็ก condition,
// จ่าย cost มานา, เช็ก limit ต่อเทิร์น/เกม, รัน do ตามลำดับ
// ตรรกะล้วน ไม่มี DOM/setTimeout ไม่เรียกโมดูลอื่นตอนโหลดไฟล์
(function () {
  const CG = (globalThis.CG = globalThis.CG || {});
  CG.effects = CG.effects || {};
  const FX = CG.effects;
  FX.ops = FX.ops || {};          // op -> fn(state, events, step, ctx)
  FX.conditions = FX.conditions || {}; // op -> fn(state, step, ctx) -> boolean

  FX.register = function (op, fn) { FX.ops[op] = fn; };
  FX.registerCondition = function (op, fn) { FX.conditions[op] = fn; };

  // condition ชุดแรก (4E-2A) ตรวจจาก state/ctx เท่านั้น ไม่แก้ state
  // selfPosition {position:'atk'|'def'} : การ์ดต้นทางอยู่ท่านั้นและหงายอยู่บนสนาม
  FX.registerCondition('selfPosition', function (state, step, ctx) {
    const s = ctx.source;
    if (!s || s.faceDown) return false;
    for (const p of state.players) if (p.monsters.some(m => m && m.uid === s.uid)) return s.position === step.position;
    return false;
  });
  // 6D: cause {cause:'battle'|'effect', how?:string, notHow?:string} : ตรวจสอบสาเหตุ/รูปแบบการเคลื่อนไหว
  FX.registerCondition('cause', function (state, step, ctx) {
    if (!ctx) return false;
    if (step.how !== undefined) {
      return ctx.how === step.how;
    }
    if (step.notHow !== undefined) {
      return ctx.how !== step.notHow;
    }
    const exp = step.cause || step.is;
    if (exp === undefined) return true;
    return ctx.cause === exp || ctx.how === exp;
  });
  // freeMonsterSlot : ผู้ใช้เอฟเฟกต์ (ctx.player) มีช่องมอนสเตอร์ว่างอย่างน้อย 1 ช่อง (กันจ่ายมานาแล้วเรียกไม่ได้)
  FX.registerCondition('freeMonsterSlot', function (state, step, ctx) {
    const p = state.players[ctx.player];
    const n = (state.config && state.config.monsterSlots) || p.monsters.length;
    for (let i = 0; i < n; i++) if (!p.monsters[i]) return true;
    return false;
  });
  // isMyTurn: ตรวจว่าขณะนี้เป็นเทิร์นของผู้เล่นเจ้าของการ์ดหรือไม่
  FX.registerCondition('isMyTurn', function (state, step, ctx) {
    return state.activeIdx === ctx.player;
  });
  // position condition: ตรวจสอบท่า (atk หรือ def) ของการ์ดต้นทางบนสนาม
  FX.registerCondition('position', function (state, cond, ctx) {
    if (!ctx || !ctx.source) return false;
    const pos = cond.position || cond.is || 'def';
    return ctx.source.position === pos && !ctx.source.faceDown;
  });

  // ---- 4E-2B: ตัวช่วยกลาง (ใช้ร่วมกับ primitives_*.js ผ่าน FX.* ตอนรัน ไม่เรียกตอนโหลด) ----
  // ตัวกรอง: cardId, levelMin/Max, tag, atkBelowSource (ATK ปัจจุบันน้อยกว่าต้นทาง ctx.source)
  FX.matchFilter = function (inst, f, ctx) {
    if (!inst) return false;
    const E = CG.engine;
    if (ctx && E.isImmuneTo && E.isImmuneTo(inst, ctx)) return false;
    if (!f) return true;
    const def = E.cardOf(inst) || {};
    if (f.id) {
      if (Array.isArray(f.id)) {
        if (!f.id.includes(inst.cardId) && !f.id.includes(def.id) && !f.id.includes(def.baseCardId)) return false;
      } else if (inst.cardId !== f.id && def.id !== f.id && def.baseCardId !== f.id) {
        return false;
      }
    }
    if (f.cardId) {
      if (Array.isArray(f.cardId)) {
        if (!f.cardId.includes(inst.cardId) && !f.cardId.includes(def.baseCardId)) return false;
      } else if (inst.cardId !== f.cardId && def.baseCardId !== f.cardId) {
        return false;
      }
    }
    if (f.excludeId) {
      const ex = [].concat(f.excludeId);
      if (ex.includes(inst.cardId) || ex.includes(def.id) || ex.includes(def.baseCardId)) return false;
    }
    if (f.excludeCardId) {
      const ex = [].concat(f.excludeCardId);
      if (ex.includes(inst.cardId) || ex.includes(def.id) || ex.includes(def.baseCardId)) return false;
    }
    if (f.otherName && ctx && ctx.source) {
      const sdef = E.cardOf(ctx.source) || {};
      if (inst.cardId === ctx.source.cardId || (def.name && sdef.name && def.name === sdef.name)) return false;
    }
    if (f.type && def.type !== f.type) return false;
    const lvl = inst.level !== undefined ? inst.level : def.level;
    if (f.level !== undefined && lvl !== f.level) return false;
    if (f.levelMin !== undefined && !(lvl >= f.levelMin)) return false;
    if (f.levelMax !== undefined && !(lvl <= f.levelMax)) return false;
    if (f.tag && !([].concat(def.tags || def.tag || [])).includes(f.tag)) return false;
    if (f.atkBelowSource) {
      const s = ctx && ctx.source;
      if (!s || s.baseAtk === null || s.baseAtk === undefined || inst.baseAtk === null || inst.baseAtk === undefined) return false;
      if (!(E.atk(inst) < E.atk(s))) return false;
    }
    return true;
  };
  // ตัวเลือกเพิ่มของ selector: other:true (ไม่นับต้นทาง), pick:'lowestAtk' (เหลือเฉพาะ ATK ต่ำสุดในรายการ เสมอกันได้ทุกตัว) get = ดึง inst จากสมาชิก
  FX.refine = function (list, target, ctx, get) {
    if (!list || !list.length) return list;
    const E = CG.engine;
    if (ctx && E.isImmuneTo) {
      list = list.filter(x => !E.isImmuneTo(get(x), ctx));
    }
    if (!target || typeof target !== 'object') return list;
    if (target.other && ctx && ctx.source) list = list.filter(x => get(x).uid !== ctx.source.uid);
    if (target.pick === 'lowestAtk' && list.length) {
      const min = Math.min.apply(null, list.map(x => E.atk(get(x))));
      list = list.filter(x => E.atk(get(x)) === min);
    }
    return list;
  };
  // การ์ดที่หงายอยู่บนสนามทั้งสองฝ่าย (มอนสเตอร์ สเปล ช่องสนาม)
  FX.fieldInsts = function (state) {
    const out = [];
    for (const p of state.players) {
      for (const m of p.monsters) if (m && !m.faceDown) out.push(m);
      for (const x of (p.spells || [])) if (x && !x.faceDown) out.push(x);
      if (p.fieldSpell && !p.fieldSpell.faceDown) out.push(p.fieldSpell);
    }
    return out;
  };
  const leaderSlotOf = state => {
    const c = state.config || {};
    return c.leaderSlot !== undefined ? c.leaderSlot : Math.floor((c.monsterSlots || 5) / 2);   // ข้อสมมติ: ช่องกลาง (เสนอลง CONTRACT)
  };
  const countMatching = (list, f, ctx) => list.filter(i => FX.matchFilter(i, f, ctx)).length;

  // 4E-2C-1: นับจำนวนการ์ดตามตัวกรอง cfg: { side?:'self'|'opp'|'both'|'any', zone?:string|string[], filter?, includeFaceDown?:boolean }
  FX.countCards = function (state, cfg, ctx) {
    if (!cfg) return 0;
    ctx = ctx || {};
    const pIdx = ctx.player !== undefined ? ctx.player : (ctx.source ? ctx.source.controller : 0);
    const sides = cfg.side === 'opp' ? [1 - pIdx]
      : (cfg.side === 'both' || cfg.side === 'any') ? [0, 1]
      : [pIdx];
    const zones = [].concat(cfg.zone || 'monster');
    let total = 0;
    for (const pi of sides) {
      const p = state.players[pi];
      if (!p) continue;
      for (const z of zones) {
        if (z === 'monster') {
          for (const m of p.monsters) {
            if (!m) continue;
            if (m.faceDown && !cfg.includeFaceDown) continue;
            if (FX.matchFilter(m, cfg.filter, ctx)) total++;
          }
        } else if (z === 'spell') {
          for (const s of (p.spells || [])) {
            if (!s) continue;
            if (s.faceDown && !cfg.includeFaceDown) continue;
            if (FX.matchFilter(s, cfg.filter, ctx)) total++;
          }
          if (p.fieldSpell && (!p.fieldSpell.faceDown || cfg.includeFaceDown)) {
            if (FX.matchFilter(p.fieldSpell, cfg.filter, ctx)) total++;
          }
        } else if (Array.isArray(p[z])) {
          for (const c of p[z]) {
            if (FX.matchFilter(c, cfg.filter, ctx)) total++;
          }
        }
      }
    }
    return total;
  };

  // hasCard / hasInGrave : มีการ์ดในโซนที่กำหนดตรงตาม filter อย่างน้อย min ใบ (ค่าเริ่มต้น 1)
  FX.registerCondition('hasCard', function (state, step, ctx) {
    const min = step.min === undefined ? 1 : step.min;
    const zone = step.zone || step.from || 'grave';
    const cnt = FX.countCards(state, {
      zone,
      side: step.side || 'self',
      filter: step.filter,
      includeFaceDown: step.includeFaceDown
    }, ctx);
    return cnt >= min;
  });
  FX.registerCondition('hasInGrave', function (state, step, ctx) {
    const min = step.min === undefined ? 1 : step.min;
    const cnt = FX.countCards(state, {
      zone: 'grave',
      side: step.side || 'self',
      filter: step.filter
    }, ctx);
    return cnt >= min;
  });

  // 4E-2C-1: คำนวณค่าตัวเลข (รองรับทั้งตัวเลขตรง ๆ และค่าตามสัดส่วน เช่น +X ต่อการ์ดหนึ่งใบ)
  FX.resolveValue = function (state, step, ctx, defaultVal) {
    if (!step) return defaultVal || 0;
    const v = step.amount !== undefined ? step.amount : (step.value !== undefined ? step.value : undefined);
    if (typeof v === 'number') return v;
    const spec = (v && typeof v === 'object') ? v : step;
    // 4E-4: ค่าจากผลลัพธ์ของ op ก่อนหน้า (ctx.lastResult) เช่น atk ของตัวที่ถูกทำลาย
    if (spec.fromResult || spec.fromPrevious) {
      const field = spec.fromResult || spec.fromPrevious;
      const raw = ctx && ctx.lastResult ? (ctx.lastResult[field] !== undefined ? ctx.lastResult[field] : 0) : 0;
      const mult = spec.multiplier !== undefined ? spec.multiplier : 1;
      return Math.floor(raw * mult);
    }
    if (spec.fromVictim || step.fromVictim) {
      const mode = spec.fromVictim || step.fromVictim;
      let victim = null;
      if (ctx && ctx.victimUid) {
        for (const p of state.players) {
          for (const z of ['monsters', 'grave', 'extra', 'removed']) {
            for (const c of p[z]) {
              if (c && c.uid === ctx.victimUid) { victim = c; break; }
            }
            if (victim) break;
          }
          if (victim) break;
        }
      }
      if (victim) {
        const E = CG.engine;
        const vAtk = (E && E.atk) ? E.atk(victim) : (victim.atk || victim.baseAtk || 0);
        const mult = spec.multiplier !== undefined ? spec.multiplier : (mode === 'halfAtk' ? 0.5 : 1);
        return Math.floor(vAtk * mult);
      }
    }
    const countSpec = spec.perCard || spec.countCards || (spec.filter || spec.zone ? spec : null);
    if (countSpec) {
      const count = FX.countCards(state, countSpec, ctx);
      const mult = spec.multiplier !== undefined ? spec.multiplier : (spec.per !== undefined ? spec.per : (step.multiplier !== undefined ? step.multiplier : (step.per !== undefined ? step.per : 1)));
      const base = spec.base !== undefined ? spec.base : (step.base !== undefined ? step.base : 0);
      return base + (count * mult);
    }
    return defaultVal || 0;
  };

  // inLeaderSlot : ต้นทางหงายอยู่ในช่องผู้นำของผู้คุม
  FX.registerCondition('inLeaderSlot', function (state, step, ctx) {
    const s = ctx.source;
    if (!s || s.faceDown) return false;
    const m = state.players[s.controller].monsters[leaderSlotOf(state)];
    return !!m && m.uid === s.uid;
  });
  FX.registerCondition('emptyLeaderSlot', function (state, step, ctx) {
    const p = state.players[ctx.player];
    return !p.monsters[leaderSlotOf(state)];
  });
  // controls {side?:'self'|'opp', filter, min?:1, count?:1} : ฝั่งนั้นมีมอนสเตอร์หงายที่ตรงตัวกรองอย่างน้อย min/count ตัว
  FX.registerCondition('controls', function (state, step, ctx) {
    const idx = step.side === 'opp' ? 1 - ctx.player : ctx.player;
    const mons = state.players[idx].monsters.filter(m => m && !m.faceDown);
    const need = step.count !== undefined ? step.count : (step.min === undefined ? 1 : step.min);
    return countMatching(mons, step.filter, ctx) >= need;
  });
  // hasUnder {filter?, min?:1} : ต้นทางมีตัวซ้อนใต้การ์ด (inst.under) ที่ตรงตัวกรองอย่างน้อย min ใบ
  FX.registerCondition('hasUnder', function (state, step, ctx) {
    const s = ctx.source;
    return !!s && countMatching(s.under || [], step.filter, ctx) >= (step.min === undefined ? 1 : step.min);
  });

  // ---- continuous aura: effect { trigger:'continuous', condition, do:[{op:'modifyStat', aura:true, target, stat, amount}] }
  // ไม่ใช่ค่าถาวร: คำนวณใหม่ทุกครั้งเก็บใน inst.auraAtk/auraDef (E.atk/E.def รวมให้) ต้นทางต้องหงายอยู่บนสนามและ condition จริง
  // รอบ 1 = aura ปกติ รอบ 2 = aura แบบ target.pick (เลือกจาก ATK หลังรอบ 1 กันวนกับโบนัสของตัวเอง)
  FX.refreshAuras = function (state) {
    const E = CG.engine;
    if (!state || !state.players) return;
    for (const p of state.players) for (const m of p.monsters) if (m) { delete m.auraAtk; delete m.auraDef; }
    const apply = (m, stat, amt) => { const k = stat === 'def' ? 'auraDef' : 'auraAtk'; m[k] = (m[k] || 0) + amt; };
    const later = [];
    for (const pass of [1, 2]) {
      for (const src of FX.fieldInsts(state)) {
        const def = E.cardOf(src);
        if (!def || !def.effects) continue;
        for (const eff of def.effects) {
          if (eff.trigger !== 'continuous') continue;
          const steps = (eff.do || []).filter(s => s.op === 'modifyStat' && s.aura);
          if (!steps.length) continue;
          const ctx = { source: src, player: src.controller };
          if (!(eff.condition || []).every(c => FX.conditions[c.op] && FX.conditions[c.op](state, c, ctx))) continue;
          for (const s of steps) {
            const t = s.target && typeof s.target === 'object' ? s.target : {};
            const isSelf = s.target === 'self';
            if (!isSelf && !!t.pick !== (pass === 2)) continue;
            if (isSelf && pass === 2) continue;
            let list;
            if (isSelf) {
              list = [src];
            } else {
              const idx = t.side === 'opp' ? 1 - src.controller : src.controller;
              list = state.players[idx].monsters.filter(m => m && !m.faceDown && FX.matchFilter(m, t.filter, ctx));
              list = FX.refine(list, t, ctx, x => x);
              if (t.count !== undefined) list = list.slice(0, t.count);
            }
            const amt = FX.resolveValue ? FX.resolveValue(state, s, ctx, s.amount || 0) : s.amount;
            for (const m of list) { if (pass === 1) apply(m, s.stat, amt); else later.push([m, s.stat, amt]); }
          }
        }
      }
    }
    for (const a of later) apply(a[0], a[1], a[2]);
  };

  // limit เก็บใน state.effectLimits (JSON ล้วน clone ได้): { game:{key:n}, turn:{n:เลขเทิร์น, used:{key:n}} }
  function limitKey(effect, ctx) {
    const src = ctx.source || {};
    const owner = ctx.player !== undefined ? ctx.player : src.controller;
    return owner + ':' + (src.cardId || '') + ':' + (effect.limit.key || effect.id);
  }
  function limitBucket(state, per) {
    const L = (state.effectLimits = state.effectLimits || { game: {}, turn: { n: null, used: {} } });
    if (per === 'turn') {
      if (L.turn.n !== state.turn) L.turn = { n: state.turn, used: {} };
      return L.turn.used;
    }
    return L.game;
  }

  // reduceCost: การ์ดหงายบนสนามของผู้ใช้เอฟเฟกต์ที่มี effect continuous + do [{op:'reduceCost', filter, amount}] (+ limit ต่อเทิร์น)
  // ใช้ลดมานาของเอฟเฟกต์ \"มอนสเตอร์\" (ต้นทางไม่ใช่สเปล) ที่ตรง filter ; คืน { amount, consume() } หรือ null
  function costReduction(state, ctx, base) {
    const E = CG.engine;
    if (!(base > 0) || !ctx.source) return null;
    const sdef = E.cardOf(ctx.source);
    if (!sdef) return null;
    const p = state.players[ctx.player];
    if (p && p.flags && p.flags.turnCostReduction && p.flags.turnCostReduction.turn === state.turn) {
      const red = p.flags.turnCostReduction;
      const tags = [].concat((sdef && sdef.tags) || []);
      if (!red.tag || tags.includes(red.tag)) {
        const amount = Math.min(red.amount || 1, base);
        return { amount, holder: null, effect: null, consume() {} };
      }
    }
    if (sdef.type === 'spell') return null;
    for (const holder of FX.fieldInsts(state)) {
      if (holder.controller !== ctx.player) continue;
      const hdef = E.cardOf(holder);
      if (!hdef || !hdef.effects) continue;
      for (const eff of hdef.effects) {
        if (eff.trigger !== 'continuous') continue;
        const step = (eff.do || []).find(x => x.op === 'reduceCost');
        if (!step || !FX.matchFilter(ctx.source, step.filter, ctx)) continue;
        const hctx = { source: holder, player: holder.controller };
        if (!(eff.condition || []).every(c => FX.conditions[c.op] && FX.conditions[c.op](state, c, hctx))) continue;
        // ตรวจโควตาแบบอ่านอย่างเดียว (ไม่สร้าง state.effectLimits) เพราะเอฟเฟกต์อาจล้มเหลวทีหลัง ต้องไม่ทิ้งร่องรอยใน state
        const lim = eff.limit && eff.limit.per ? eff.limit : null, key = lim ? limitKey(eff, hctx) : null;
        if (lim) {
          const L = state.effectLimits;
          const used = !L ? 0 : lim.per === 'turn' ? (L.turn && L.turn.n === state.turn ? (L.turn.used[key] || 0) : 0) : (L.game[key] || 0);
          if (used >= (lim.count === undefined ? 1 : lim.count)) continue;
        }
        const amount = Math.min(step.amount === undefined ? 1 : step.amount, base);
        return { amount, holder, effect: eff, consume() { if (lim) { const b = limitBucket(state, lim.per); b[key] = (b[key] || 0) + 1; } } };
      }
    }
    return null;
  }

  // คืน { ok:true } หรือ { ok:false, reason } ; reason: unknownOp | conditionFailed | limitReached | notEnoughMana
  FX.run = function (state, events, effect, ctx) {
    ctx = Object.assign({}, ctx);
    if (!ctx.effect) ctx.effect = effect;
    if (ctx.player === undefined && ctx.source) ctx.player = ctx.source.controller;
    FX.refreshAuras(state);   // ให้ ATK ที่ condition/filter อ่านเป็นค่าล่าสุด
    const conds = effect.condition || [];
    const steps = effect.do || [];

    for (const s of conds) if (!FX.conditions[s.op]) return { ok: false, reason: 'unknownOp', op: s.op };
    for (const s of steps) if (!FX.ops[s.op]) return { ok: false, reason: 'unknownOp', op: s.op };

    // 5A: If resuming, do NOT re-check conditions, do NOT re-consume limits, do NOT re-pay mana
    if (!ctx._isResume && !ctx._paidCostAndLimit) {
      for (const s of conds) if (!FX.conditions[s.op](state, s, ctx)) return { ok: false, reason: 'conditionFailed', op: s.op };

      const lim = effect.limit && effect.limit.per ? effect.limit : null;
      let bucket = null, key = null;
      if (lim) {
        bucket = limitBucket(state, lim.per); key = limitKey(effect, ctx);
        if ((bucket[key] || 0) >= (lim.count === undefined ? 1 : lim.count)) return { ok: false, reason: 'limitReached' };
      }

      let cost = (effect.cost && effect.cost.mana) || 0;
      const red = cost > 0 ? costReduction(state, ctx, cost) : null;   // 4E-2B: ลดมานาจาก reduceCost (เช่น คาสตรา)
      if (red) cost -= red.amount;
      const p = state.players[ctx.player];
      if (cost > 0) {
        if (p.mana < cost) return { ok: false, reason: 'notEnoughMana' };
        p.mana -= cost;
        events.push({ type: 'manaChange', player: ctx.player, delta: -cost, reason: 'cost' });
      }
      if (red) {
        red.consume();   // ใช้โควตาลดมานาเมื่อประกาศผ่านแล้วเท่านั้น
        events.push({
          type: 'costReduced',
          uid: red.holder ? red.holder.uid : null,
          cardId: red.holder ? red.holder.cardId : 'turnCostReduction',
          effectId: red.effect ? red.effect.id : 'turnCostReduction',
          amount: red.amount
        });
      }
      if (lim) bucket[key] = (bucket[key] || 0) + 1;   // นับตอนประกาศ (เหมือน cost ไม่คืน)
    }

    const startIndex = ctx._resumeStepIndex !== undefined ? ctx._resumeStepIndex : 0;
    const prevResolving = state._isResolvingEffect;
    state._isResolvingEffect = true;
    for (let i = startIndex; i < steps.length; i++) {
      const s = steps[i];
      if ((s.requireSuccess || s.ifSuccess) && ctx.lastResult && !ctx.lastResult.ok) continue;
      ctx._stepIndex = i;
      if (s.op === 'destroy' && s.target && s.target.zone === 'under') {
        FX.destroyUnder(state, events, s, ctx);
      } else {
        FX.ops[s.op](state, events, s, ctx);
      }
      FX.refreshAuras(state);
      if (state.pending) break;
      delete ctx._stepChoice;
      if (state.ended) break;
    }
    state._isResolvingEffect = prevResolving;

    // ถ้าแก้ผลเอฟเฟกต์เสร็จสมบูรณ์และไม่มี pending ให้เปิดหน้าต่างที่เลื่อนไว้ (เช่น monsterDestroyed)
    const E = CG.engine;
    if (!state.pending && state._deferredWindows && state._deferredWindows.length > 0 && E && E.openWindow) {
      const nextWin = state._deferredWindows.shift();
      E.openWindow(state, events, nextWin);
    }

    return { ok: true };
  };

  // 5A: ตัวช่วยสำหรับ pending และ resume
  FX.findInstanceByUid = function (state, uid) {
    if (!uid) return null;
    for (const p of state.players) {
      for (const m of p.monsters) if (m && m.uid === uid) return m;
      for (const s of (p.spells || [])) if (s && s.uid === uid) return s;
      if (p.fieldSpell && p.fieldSpell.uid === uid) return p.fieldSpell;
      for (const z of ['hand', 'deck', 'grave', 'removed', 'extra']) {
        for (const c of (p[z] || [])) if (c && c.uid === uid) return c;
      }
    }
    return null;
  };

  // 5B: หาตำแหน่งโซนของการ์ด
  FX.findLocation = function (state, uid) {
    if (!uid) return null;
    for (let pi = 0; pi < state.players.length; pi++) {
      const p = state.players[pi];
      for (let s = 0; s < p.monsters.length; s++) if (p.monsters[s] && p.monsters[s].uid === uid) return { inst: p.monsters[s], zone: 'monster', owner: pi, slot: s };
      for (let s = 0; s < (p.spells || []).length; s++) if (p.spells[s] && p.spells[s].uid === uid) return { inst: p.spells[s], zone: 'spell', owner: pi, slot: s };
      if (p.fieldSpell && p.fieldSpell.uid === uid) return { inst: p.fieldSpell, zone: 'field', owner: pi, slot: 0 };
      for (const z of ['hand', 'deck', 'grave', 'removed', 'extra']) {
        const i = (p[z] || []).findIndex(c => c && c.uid === uid);
        if (i >= 0) return { inst: p[z][i], zone: z, owner: pi, slot: i };
      }
    }
    return null;
  };

  // 5B: ตรวจและจ่าย cost + limit แยกต่างหากสำหรับ Chain
  FX.checkCanActivate = function (state, effect, ctx) {
    const conds = effect.condition || [];
    for (const s of conds) {
      if (!FX.conditions[s.op] || !FX.conditions[s.op](state, s, ctx)) return false;
    }
    const lim = effect.limit && effect.limit.per ? effect.limit : null;
    if (lim) {
      const bucket = limitBucket(state, lim.per);
      const key = limitKey(effect, ctx);
      if ((bucket[key] || 0) >= (lim.count === undefined ? 1 : lim.count)) return false;
    }
    let cost = (effect.cost && effect.cost.mana) || 0;
    const red = cost > 0 ? costReduction(state, ctx, cost) : null;
    if (red) cost -= red.amount;
    const p = state.players[ctx.player];
    if (cost > 0 && p.mana < cost) return false;

    // ตรวจสอบความถูกต้องของเป้าหมายในสุสาน (กันใช้การ์ดฟรีโดยไม่มีเป้าหมายในสุสาน)
    if (p && effect.do) {
      for (const step of effect.do) {
        const fromGraveOnly = step.from === 'grave' || (Array.isArray(step.from) && step.from.length === 1 && step.from[0] === 'grave');
        if (fromGraveOnly) {
          const poolCount = FX.countCards(state, { zone: 'grave', side: step.side || 'self', filter: step.filter }, ctx);
          if (poolCount < (step.minCount || step.count || 1)) return false;
        }
        if (step.target && step.target.zone === 'grave') {
          const poolCount = FX.countCards(state, { zone: 'grave', side: step.target.side || 'self', filter: step.target.filter }, ctx);
          if (poolCount < (step.target.minCount || step.target.count || 1)) return false;
        }
      }
    }

    return true;
  };

  FX.payCostAndLimit = function (state, events, effect, ctx) {
    const lim = effect.limit && effect.limit.per ? effect.limit : null;
    let bucket = null, key = null;
    if (lim) {
      bucket = limitBucket(state, lim.per);
      key = limitKey(effect, ctx);
      if ((bucket[key] || 0) >= (lim.count === undefined ? 1 : lim.count)) return { ok: false, reason: 'limitReached' };
    }
    let cost = (effect.cost && effect.cost.mana) || 0;
    const red = cost > 0 ? costReduction(state, ctx, cost) : null;
    if (red) cost -= red.amount;
    const p = state.players[ctx.player];
    if (cost > 0) {
      if (p.mana < cost) return { ok: false, reason: 'notEnoughMana' };
      p.mana -= cost;
      events.push({ type: 'manaChange', player: ctx.player, delta: -cost, reason: 'cost' });
    }
    if (red) {
      red.consume();
      events.push({
        type: 'costReduced',
        uid: red.holder ? red.holder.uid : null,
        cardId: red.holder ? red.holder.cardId : 'turnCostReduction',
        effectId: red.effect ? red.effect.id : 'turnCostReduction',
        amount: red.amount
      });
    }
    if (lim) bucket[key] = (bucket[key] || 0) + 1;
    return { ok: true };
  };

  FX.shouldAskPlayer = function (state, step, target, candidatesCount, wantCount, ctx) {
    if (state.config && state.config.autoChoose) return false;
    if (target && (target.choose === 'auto' || target.choose === 'random')) return false;
    if (step && (step.choose === 'auto' || step.choose === 'random')) return false;
    if (target && target.zone === 'under') return false;
    if (target && target.all) return false;
    if (ctx && ctx._stepChoice !== undefined) return false;
    if (candidatesCount <= 0) return false;

    const isInteractive = !!(state.config && state.config.interactiveChoice);
    const isPlayerChoose = (target && target.choose === 'player') || (step && step.choose === 'player');
    const isTargetOp = step && (
      step.op === 'search' ||
      step.op === 'choice' ||
      (step.op === 'specialSummon' && !step.self && (step.from || []).length > 0) ||
      step.op === 'discard' ||
      step.op === 'destroy' ||
      step.op === 'returnToHand' ||
      step.op === 'returnToDeck' ||
      step.op === 'returnToGrave' ||
      step.op === 'banish' ||
      step.op === 'sendToGrave' ||
      step.op === 'takeControl' ||
      step.op === 'modifyStat'
    );

    // ในโหมด interactive (เกม UI ของผู้เล่น): ให้ผู้เล่นเลือกทุกครั้งที่มีตัวเลือก (>= 1)
    if (isInteractive) {
      if (isPlayerChoose || isTargetOp) {
        return candidatesCount >= 1;
      }
    }

    // ในโหมด headless unit tests:
    // สัญญา 5A-02: ถ้าตัวเลือกพอดีหรือน้อยกว่า ไม่เปิด pending เพื่อไม่ให้ขัดจังหวะการทดสอบ
    // ถ้าตัวเลือกมากกว่าจำนวนที่ต้องการ (candidatesCount > wantCount) จึงเปิด pending (5A-03)
    if (isPlayerChoose) return candidatesCount > wantCount;
    if (step && (step.op === 'search' || step.op === 'choice')) return candidatesCount > wantCount;
    if (step && step.op === 'specialSummon' && !step.self && (step.from || []).length > 0) return candidatesCount > wantCount;
    return false;
  };

  FX.openPending = function (state, events, cfg) {
    state.pending = Object.assign({
      kind: cfg.kind || 'chooseTarget',
      player: cfg.player,
      prompt: cfg.prompt || 'CHOOSE_TARGET',
      options: cfg.options,
      min: cfg.min !== undefined ? cfg.min : 1,
      max: cfg.max !== undefined ? cfg.max : 1,
      resume: cfg.resume
    }, cfg);
    events.push({
      type: 'pendingOpen',
      kind: state.pending.kind,
      player: state.pending.player,
      prompt: state.pending.prompt
    });
  };

  FX.makeResume = function (state, step, ctx) {
    const E = CG.engine;
    const eff = ctx.effect || (ctx.source ? ((E.cardOf(ctx.source) || {}).effects || []).find(e => e.id === (ctx.effectId || (ctx.effect && ctx.effect.id))) : null);
    return {
      sourceUid: ctx.source ? ctx.source.uid : null,
      effectId: eff ? eff.id : (ctx.effectId || (step && step.effectId) || null),
      effect: eff ? JSON.parse(JSON.stringify(eff)) : { id: 'anon', do: [step] },
      stepIndex: ctx._stepIndex !== undefined ? ctx._stepIndex : 0,
      ctx: {
        player: ctx.player,
        trigger: ctx.trigger,
        lastResult: ctx.lastResult ? JSON.parse(JSON.stringify(ctx.lastResult)) : null,
        watchedUid: ctx.watched ? ctx.watched.uid : null,
        _fusionData: ctx._fusionData ? JSON.parse(JSON.stringify(ctx._fusionData)) : undefined
      }
    };
  };

  FX.resumeEffect = function (state, events, resume, choice) {
    let source = null, watched = null;
    if (resume.sourceUid) source = FX.findInstanceByUid(state, resume.sourceUid);
    if (resume.ctx && resume.ctx.watchedUid) watched = FX.findInstanceByUid(state, resume.ctx.watchedUid);
    const resumedCtx = {
      source: source,
      player: resume.ctx.player,
      trigger: resume.ctx.trigger,
      lastResult: resume.ctx.lastResult,
      watched: watched,
      effect: resume.effect,
      _isResume: true,
      _resumeStepIndex: resume.stepIndex,
      _stepChoice: choice,
      _fusionData: resume.ctx && resume.ctx._fusionData
    };
    const buf = [];
    FX.run(state, buf, resume.effect, resumedCtx);
    events.push(...buf);
  };

  // 4E-4: mana condition — เทียบค่ามานาของผู้คุม (หรือฝ่ายตรงข้าม)
  FX.registerCondition('mana', function (state, step, ctx) {
    const pi = step.side === 'opp' ? 1 - ctx.player : ctx.player;
    const m = state.players[pi].mana;
    if (step.greaterThan !== undefined && !(m > step.greaterThan)) return false;
    if (step.lessThan !== undefined && !(m < step.lessThan)) return false;
    if (step.min !== undefined && !(m >= step.min)) return false;
    if (step.max !== undefined && !(m <= step.max)) return false;
    if (step.equals !== undefined && m !== step.equals) return false;
    return true;
  });

  // 4E-4: previousOpSuccess condition
  FX.registerCondition('previousOpSuccess', function (state, step, ctx) {
    return !!(ctx && ctx.lastResult && ctx.lastResult.ok);
  });

  // 5C: แปลง selector พิเศษ: 'self', 'watched', 'attacker', 'attacked', 'summoned'
  FX.resolveSpecialTarget = function (state, target, ctx) {
    const sel = (typeof target === 'string') ? target : (target && (target.selector || target.target));
    if (sel === 'self') {
      const loc = ctx && ctx.source ? FX.findLocation(state, ctx.source.uid) : null;
      return loc ? [loc] : [];
    }
    if (sel === 'watched') {
      const loc = ctx && ctx.watched ? FX.findLocation(state, ctx.watched.uid) : null;
      return loc ? [loc] : [];
    }
    if (sel === 'attacker') {
      const at = state.attack;
      if (at) {
        const m = state.players[at.player].monsters[at.from];
        if (m && m.uid === at.attackerUid) return [{ inst: m, zone: 'monster', owner: at.player, slot: at.from }];
      }
      if (ctx && ctx.attackerUid) {
        const loc = FX.findLocation(state, ctx.attackerUid);
        if (loc) return [loc];
      }
      return [];
    }
    if (sel === 'attacked') {
      const at = state.attack;
      if (at && at.to !== null) {
        const opp = 1 - at.player;
        const m = state.players[opp].monsters[at.to];
        if (m && m.uid === at.targetUid) return [{ inst: m, zone: 'monster', owner: opp, slot: at.to }];
      }
      if (ctx && ctx.targetUid) {
        const loc = FX.findLocation(state, ctx.targetUid);
        if (loc) return [loc];
      }
      return [];
    }
    if (sel === 'summoned') {
      const uid = ctx && (ctx.summonedUid || (ctx.summoned && ctx.summoned.uid) || ctx.uid);
      if (uid) {
        const loc = FX.findLocation(state, uid);
        if (loc) return [loc];
      }
      return [];
    }
    return null;
  };

  // 5C: targetLink condition — ตรวจลิงก์ใน Chain ที่กำลังตอบโต้
  FX.registerCondition('targetLink', function (state, cond, ctx) {
    const link = (ctx && ctx.currentLink) || (state.chain && state.chain.length > 0 ? state.chain[state.chain.length - 1] : null);
    if (!link) return false;
    if (cond.side === 'opp' && link.controller === ctx.player) return false;
    if (cond.side === 'self' && link.controller !== ctx.player) return false;
    if (cond.cardType && link.cardType !== cond.cardType) return false;
    if (cond.type && link.cardType !== cond.type) return false;
    return true;
  });

  // 5C: attackTarget condition — ตรวจเป้าหมายที่ถูกโจมตี
  FX.registerCondition('attackTarget', function (state, cond, ctx) {
    const at = state.attack;
    if (!at || at.to === null) return false;
    const defender = 1 - at.player;
    if (cond.side === 'self' && defender !== ctx.player) return false;
    if (cond.side === 'opp' && defender === ctx.player) return false;
    const m = state.players[defender].monsters[at.to];
    if (!m || m.faceDown) return false;
    if (cond.filter && !FX.matchFilter(m, cond.filter, ctx)) return false;
    return true;
  });

  // 5C: attackDeclaredByOpp condition
  FX.registerCondition('attackDeclaredByOpp', function (state, cond, ctx) {
    const at = state.attack;
    if (!at) return false;
    return at.player !== ctx.player;
  });

  // 5C: destroyedMonster condition — ตรวจมอนสเตอร์ที่เพิ่งถูกทำลาย
  FX.registerCondition('destroyedMonster', function (state, cond, ctx) {
    if (!ctx) return false;
    const card = ctx.destroyedCard || ctx.source;
    if (!card) return false;
    const owner = ctx.destroyedOwner !== undefined ? ctx.destroyedOwner : ctx.player;
    if (cond.side === 'self' && owner !== ctx.player) return false;
    if (cond.side === 'opp' && owner === ctx.player) return false;
    if (cond.filter && !FX.matchFilter(card, cond.filter, ctx)) return false;
    return true;
  });

  // 6B: canFusionSummon condition
  FX.registerCondition('canFusionSummon', function (state, cond, ctx) {
    if (!FX.getSummonableFusions) return false;
    const list = FX.getSummonableFusions(state, cond, ctx);
    return list.length > 0;
  });

  // 6C: wrap destroy op to support target.zone === 'under'
  FX.destroyUnder = function (state, events, step, ctx) {
    const src = ctx.source;
    if (src && Array.isArray(src.under) && src.under.length > 0) {
      const unders = src.under.slice();
      src.under = [];
      const E = CG.engine;
      for (const u of unders) {
        const owner = u.owner !== undefined ? u.owner : ctx.player;
        events.push({ type: 'destroy', uid: u.uid, by: 'effect' });
        E.resetInstance(u);
        state.players[owner].grave.push(u);
        events.push({ type: 'moveCard', uid: u.uid, from: 'under', to: 'grave', player: owner });
        E.fire(state, events, 'onDestroyed', { source: u, by: 'effect' });
        E.fire(state, events, 'onSentToGrave', { source: u });
      }
      ctx.lastResult = { op: 'destroy', ok: unders.length > 0, count: unders.length, destroyed: unders };
    }
  };

  let currentDestroyFn = FX.ops.destroy;
  Object.defineProperty(FX.ops, 'destroy', {
    configurable: true,
    enumerable: true,
    get() {
      return function (state, events, step, ctx) {
        if (step && step.target && step.target.zone === 'under') {
          return FX.destroyUnder(state, events, step, ctx);
        }
        if (currentDestroyFn) return currentDestroyFn(state, events, step, ctx);
      };
    },
    set(fn) {
      currentDestroyFn = fn;
    }
  });
})();

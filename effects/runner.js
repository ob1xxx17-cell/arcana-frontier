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
  // freeMonsterSlot : ผู้ใช้เอฟเฟกต์ (ctx.player) มีช่องมอนสเตอร์ว่างอย่างน้อย 1 ช่อง (กันจ่ายมานาแล้วเรียกไม่ได้)
  FX.registerCondition('freeMonsterSlot', function (state, step, ctx) {
    const p = state.players[ctx.player];
    const n = (state.config && state.config.monsterSlots) || p.monsters.length;
    for (let i = 0; i < n; i++) if (!p.monsters[i]) return true;
    return false;
  });

  // ---- 4E-2B: ตัวช่วยกลาง (ใช้ร่วมกับ primitives_*.js ผ่าน FX.* ตอนรัน ไม่เรียกตอนโหลด) ----
  // ตัวกรอง: cardId, levelMin/Max, tag, atkBelowSource (ATK ปัจจุบันน้อยกว่าต้นทาง ctx.source)
  FX.matchFilter = function (inst, f, ctx) {
    if (!f) return true;
    const E = CG.engine, def = E.cardOf(inst) || {};
    if (f.cardId && inst.cardId !== f.cardId) return false;
    if (f.levelMin !== undefined && !(inst.level >= f.levelMin)) return false;
    if (f.levelMax !== undefined && !(inst.level <= f.levelMax)) return false;
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
    if (!target || typeof target !== 'object') return list;
    const E = CG.engine;
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

  // inLeaderSlot : ต้นทางหงายอยู่ในช่องผู้นำของผู้คุม
  FX.registerCondition('inLeaderSlot', function (state, step, ctx) {
    const s = ctx.source;
    if (!s || s.faceDown) return false;
    const m = state.players[s.controller].monsters[leaderSlotOf(state)];
    return !!m && m.uid === s.uid;
  });
  // controls {side?:'self'|'opp', filter, min?:1} : ฝั่งนั้นมีมอนสเตอร์หงายที่ตรงตัวกรองอย่างน้อย min ตัว
  FX.registerCondition('controls', function (state, step, ctx) {
    const idx = step.side === 'opp' ? 1 - ctx.player : ctx.player;
    const mons = state.players[idx].monsters.filter(m => m && !m.faceDown);
    return countMatching(mons, step.filter, ctx) >= (step.min === undefined ? 1 : step.min);
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
            if (!!t.pick !== (pass === 2)) continue;
            const idx = t.side === 'opp' ? 1 - src.controller : src.controller;
            let list = state.players[idx].monsters.filter(m => m && !m.faceDown && FX.matchFilter(m, t.filter, ctx));
            list = FX.refine(list, t, ctx, x => x);
            if (t.count !== undefined) list = list.slice(0, t.count);
            for (const m of list) { if (pass === 1) apply(m, s.stat, s.amount); else later.push([m, s.stat, s.amount]); }
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
    if (!sdef || sdef.type === 'spell') return null;
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
    if (ctx.player === undefined && ctx.source) ctx.player = ctx.source.controller;
    FX.refreshAuras(state);   // ให้ ATK ที่ condition/filter อ่านเป็นค่าล่าสุด
    const conds = effect.condition || [];
    const steps = effect.do || [];

    for (const s of conds) if (!FX.conditions[s.op]) return { ok: false, reason: 'unknownOp', op: s.op };
    for (const s of steps) if (!FX.ops[s.op]) return { ok: false, reason: 'unknownOp', op: s.op };

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
      events.push({ type: 'costReduced', uid: red.holder.uid, cardId: red.holder.cardId, effectId: red.effect.id, amount: red.amount });
    }
    if (lim) bucket[key] = (bucket[key] || 0) + 1;   // นับตอนประกาศ (เหมือน cost ไม่คืน)

    for (const s of steps) {
      FX.ops[s.op](state, events, s, ctx);
      FX.refreshAuras(state);
      if (state.ended) break;
    }
    return { ok: true };
  };
})();

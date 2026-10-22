// engine/effectBridge.js - สะพานระหว่าง engine กับ effects/ (ขั้น 4A-2)
//   CG.effects.fire(state, events, trigger, ctx)  วนหาการ์ดที่มีเอฟเฟกต์ตรง trigger แล้วเรียก CG.effects.run
//   E.fire(...)                                   ตัวเรียกใน engine (ไม่ทำอะไรถ้ายังไม่ได้โหลด effects/)
//   E.validateActivateEffect / E.activateEffect   action activateEffect { slot, effectId } (ตัว ignition)
// ตรรกะล้วน ไม่มี DOM/setTimeout ไม่เรียกโมดูลอื่นตอนโหลดไฟล์
(function () {
  const CG = (globalThis.CG = globalThis.CG || {});
  CG.engine = CG.engine || {};
  CG.effects = CG.effects || {};
  const E = CG.engine, FX = CG.effects;

  // trigger ที่ fire() ยิงให้เอง (ignition/quick/continuous ไม่ใช่ของ fire)
  const AUTO = ['onSummon', 'onFlip', 'onOverlay', 'onStandby', 'onEndPhase', 'onAttackDeclared',
    'onBattleDestroy', 'onDestroyed', 'onSentToGrave',
    'onTributed', 'onNormalSummon', 'onAttacked', 'onBattleDestroyed'];   // 4 ตัวหลังเพิ่มใน 4E-2A
  // trigger ที่เอฟเฟกต์ "ผู้เฝ้าดู" (effect.watch) ฟังการ์ดใบอื่นได้ ctx.source = การ์ดที่เกิดเหตุการณ์
  const WATCHABLE = ['onSentToGrave'];
  const MAX_DEPTH = 8;   // กันเอฟเฟกต์ยิง trigger วนไม่รู้จบ
  let depth = 0;

  function fieldInsts(state) {
    const out = [];
    const order = [state.activeIdx, 1 - state.activeIdx];   // ผู้เล่นเจ้าของเทิร์นก่อน
    for (const pi of order) {
      const p = state.players[pi];
      for (const m of p.monsters) if (m && !m.faceDown) out.push(m);
      for (const s of p.spells) if (s && !s.faceDown) out.push(s);
      if (p.fieldSpell && !p.fieldSpell.faceDown) out.push(p.fieldSpell);
    }
    return out;
  }
  function stillOnField(state, inst) {
    return fieldInsts(state).some(x => x.uid === inst.uid);
  }

  // ctx: { source?: inst (ระบุ = เฉพาะการ์ดใบนี้, ไม่ระบุ = ทุกใบที่หงายอยู่บนสนาม), player?: กรองตามผู้คุม, ...ข้อมูลเพิ่มส่งต่อให้ op }
  // เอฟเฟกต์ที่เงื่อนไข/limit/มานาไม่ผ่านหรือ op ยังไม่มี จะถูกข้ามเงียบ ๆ (ไม่ใช่ความผิดของผู้เล่น)
  FX.fire = function (state, events, trigger, ctx) {
    if (!AUTO.includes(trigger) || !FX.run || state.ended || depth >= MAX_DEPTH) return;
    ctx = ctx || {};
    if (FX.refreshAuras) FX.refreshAuras(state);   // 4E-2B: ให้ ATK รวม aura เป็นค่าล่าสุดก่อนเอฟเฟกต์อ่าน
    const bySource = !!ctx.source;
    // ไม่ระบุ source: ctx.player (ถ้ามี) จำกัดเฉพาะการ์ดที่ผู้เล่นนั้นคุม
    const list = bySource ? [ctx.source]
      : fieldInsts(state).filter(i => ctx.player === undefined || i.controller === ctx.player);
    depth++;
    try {
      for (const inst of list) {
        const def = E.cardOf(inst);
        if (!def || !def.effects) continue;
        for (const eff of def.effects) {
          if (state.ended) return;
          if (eff.trigger !== trigger) continue;
          if (eff.watch) continue;   // เอฟเฟกต์ผู้เฝ้าดูทำงานเฉพาะตอนการ์ดอื่นเกิดเหตุการณ์ (ดู watchers ด้านล่าง)
          if (!bySource && !stillOnField(state, inst)) break;
          const c = Object.assign({}, ctx, { source: inst, player: inst.controller, trigger, effect: eff });
          const buf = [];
          const r = FX.run(state, buf, eff, c);
          if (r.ok) {
            events.push({ type: 'effectActivated', uid: inst.uid, cardId: inst.cardId, effectId: eff.id, trigger });
            events.push(...buf);
          }
        }
      }
      if (bySource && WATCHABLE.includes(trigger)) watchers(state, events, trigger, ctx);
    } finally { depth--; }
  };

  // ---- ผู้เฝ้าดู: eff.watch = { zone:'hand'|'field' (ค่าเริ่มต้น field), side:'self'|'opp'|'any' (ค่าเริ่มต้น self = เจ้าของการ์ดที่เกิดเหตุ\n  //   เป็นคนเดียวกับเจ้าของผู้เฝ้าดู), other:true (ไม่นับตัวเอง), filter:{cardId,tag,levelMin,levelMax} กรองการ์ดที่เกิดเหตุ } ----
  function matchFilter(inst, f) {
    if (!f) return true;
    const def = E.cardOf(inst) || {};
    if (f.cardId && inst.cardId !== f.cardId) return false;
    if (f.levelMin !== undefined && !(inst.level >= f.levelMin)) return false;
    if (f.levelMax !== undefined && !(inst.level <= f.levelMax)) return false;
    if (f.tag && !([].concat(def.tags || def.tag || [])).includes(f.tag)) return false;
    return true;
  }
  function watchers(state, events, trigger, ctx) {
    const subj = ctx.source;
    const found = [];   // [inst, zone]
    for (const p of state.players) {
      for (const c of p.hand) found.push([c, 'hand']);
      for (const m of p.monsters) if (m && !m.faceDown) found.push([m, 'field']);
      for (const x of p.spells) if (x && !x.faceDown) found.push([x, 'field']);
      if (p.fieldSpell && !p.fieldSpell.faceDown) found.push([p.fieldSpell, 'field']);
    }
    for (const [inst, zone] of found) {
      const def = E.cardOf(inst);
      if (!def || !def.effects) continue;
      for (const eff of def.effects) {
        if (state.ended) return;
        if (eff.trigger !== trigger || !eff.watch) continue;
        const w = eff.watch;
        if ((w.zone || 'field') !== zone) continue;
        if (w.other && inst.uid === subj.uid) continue;
        const side = w.side || 'self';
        if (side === 'self' && subj.owner !== inst.controller) continue;
        if (side === 'opp' && subj.owner === inst.controller) continue;
        if (!matchFilter(subj, w.filter)) continue;
        // ผู้เฝ้าดูต้องยังอยู่โซนเดิม (เอฟเฟกต์ก่อนหน้าอาจย้ายไปแล้ว)
        const p = state.players[inst.controller];
        const still = zone === 'hand' ? p.hand.some(c => c.uid === inst.uid) : stillOnField(state, inst);
        if (!still) continue;
        const c = Object.assign({}, ctx, { source: inst, player: inst.controller, trigger, effect: eff, watched: subj });
        const buf = [];
        const r = FX.run(state, buf, eff, c);
        if (r.ok) {
          events.push({ type: 'effectActivated', uid: inst.uid, cardId: inst.cardId, effectId: eff.id, trigger });
          events.push(...buf);
        }
      }
    }
  }

  E.fire = function (state, events, trigger, ctx) { if (FX.fire) FX.fire(state, events, trigger, ctx); };

  // ---- action activateEffect { player, slot | handIdx, effectId } : slot = ช่องมอนสเตอร์บนสนาม, handIdx = มอนสเตอร์ในมือ (ต้องมี effect.from:'hand'), เอฟเฟกต์ trigger "ignition" ----
  const REASON = { unknownOp: 'NOT_IMPLEMENTED', conditionFailed: 'CONDITION_FAILED',
    limitReached: 'LIMIT_REACHED', notEnoughMana: 'NOT_ENOUGH_MANA' };

  // effect.from = โซนที่ใช้เอฟเฟกต์ได้ ('field' | 'hand' หรือ array) ค่าเริ่มต้น 'field' (4E-2B) เอฟเฟกต์เดิมที่ไม่มี from ทำงานเหมือนเดิมทุกอย่าง
  const zonesOf = eff => [].concat(eff.from || 'field');

  function lookup(state, a) {
    const p = state.players[a.player];
    let m, zone;
    if (a.handIdx !== undefined) {   // ใช้จากมือ: ระบุ handIdx แทน slot (ห้ามระบุทั้งคู่) เฉพาะมอนสเตอร์
      if (a.slot !== undefined) return { err: 'INVALID_SLOT' };
      if (!Number.isInteger(a.handIdx) || a.handIdx < 0 || a.handIdx >= p.hand.length) return { err: 'INVALID_HAND_INDEX' };
      m = p.hand[a.handIdx]; zone = 'hand';
      const hd = E.cardOf(m);
      if (!hd || hd.type === 'spell') return { err: 'NOT_MONSTER' };
    } else {
      if (!Number.isInteger(a.slot) || a.slot < 0 || a.slot >= state.config.monsterSlots) return { err: 'INVALID_SLOT' };
      m = p.monsters[a.slot]; zone = 'field';
      if (!m) return { err: 'NO_MONSTER' };
      if (m.faceDown) return { err: 'FACE_DOWN' };
    }
    const def = E.cardOf(m);
    const eff = def && (def.effects || []).find(e => e.id === a.effectId);
    if (!eff) return { err: 'NO_SUCH_EFFECT' };
    if (eff.trigger === 'quick') return { err: 'NOT_IMPLEMENTED' };   // ความเร็ว 2 รอขั้น 5
    if (eff.trigger !== 'ignition') return { err: 'WRONG_TRIGGER' };
    if (!zonesOf(eff).includes(zone)) return { err: 'WRONG_ZONE' };
    return { m, eff, zone };
  }

  E.validateActivateEffect = function (state, a) {
    if (state.phase !== 'main1' && state.phase !== 'main2') return 'WRONG_PHASE';
    if (state.battleStep !== null) return 'WRONG_PHASE';
    const l = lookup(state, a); if (l.err) return l.err;
    if (!FX.run) return 'NOT_IMPLEMENTED';
    const probe = E.cloneState(state);   // ลองรันกับสำเนา เพื่อให้ตัวตรวจเป็นตัวเดียวกับตอนรันจริง
    const psrc = l.zone === 'hand' ? probe.players[a.player].hand[a.handIdx] : probe.players[a.player].monsters[a.slot];
    const r = FX.run(probe, [], l.eff, { source: psrc, player: a.player, trigger: 'ignition' });
    return r.ok ? null : (REASON[r.reason] || 'CONDITION_FAILED');
  };

  E.activateEffect = function (state, a, events) {
    const err = E.validateActivateEffect(state, a); if (err) return err;
    const l = lookup(state, a);
    const buf = [];
    FX.run(state, buf, l.eff, { source: l.m, player: a.player, trigger: 'ignition', effect: l.eff });
    events.push({ type: 'effectActivated', uid: l.m.uid, cardId: l.m.cardId, effectId: l.eff.id, trigger: 'ignition' });
    events.push(...buf);
    return null;
  };
})();

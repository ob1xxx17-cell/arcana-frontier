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
  const WATCHABLE = ['onSentToGrave', 'onSummon'];
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
        if (inst.negated || inst.silenced) continue;
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

  // effect.from = โซนที่ใช้เอฟเฟกต์ได้ ('field' | 'hand' | 'grave' หรือ array) ค่าเริ่มต้น 'field' (4E-2B)
  const zonesOf = eff => [].concat(eff.from || eff.zone || 'field');

  function lookup(state, a) {
    const p = state.players[a.player];
    let m, zone;
    if (a.fieldSpell) {
      m = p.fieldSpell; zone = 'field';
      if (!m) return { err: 'NO_CARD' };
      if (m.faceDown) return { err: 'FACE_DOWN' };
      if (m.negated || m.silenced) return { err: 'EFFECT_NEGATED' };
    } else if (a.graveIdx !== undefined) {
      if (a.slot !== undefined || a.handIdx !== undefined) return { err: 'INVALID_SLOT' };
      if (!Number.isInteger(a.graveIdx) || a.graveIdx < 0 || a.graveIdx >= p.grave.length) return { err: 'INVALID_GRAVE_INDEX' };
      m = p.grave[a.graveIdx]; zone = 'grave';
      const gd = E.cardOf(m);
      if (!gd) return { err: 'NO_CARD' };
    } else if (a.handIdx !== undefined) {   // ใช้จากมือ: ระบุ handIdx แทน slot (ห้ามระบุทั้งคู่)
      if (a.slot !== undefined) return { err: 'INVALID_SLOT' };
      if (!Number.isInteger(a.handIdx) || a.handIdx < 0 || a.handIdx >= p.hand.length) return { err: 'INVALID_HAND_INDEX' };
      m = p.hand[a.handIdx]; zone = 'hand';
      const hd = E.cardOf(m);
      if (!hd) return { err: 'NO_MONSTER' };
      if (hd.type === 'spell') {
        if (!state.config || !state.config.chainMode) return { err: 'NOT_MONSTER' };
      }
    } else {
      if (!Number.isInteger(a.slot) || a.slot < 0 || a.slot >= state.config.monsterSlots) return { err: 'INVALID_SLOT' };
      m = p.monsters[a.slot]; zone = 'field';
      if (!m) return { err: 'NO_MONSTER' };
      if (m.faceDown) return { err: 'FACE_DOWN' };
      if (m.negated || m.silenced) return { err: 'EFFECT_NEGATED' };
    }
    const def = E.cardOf(m);
    const eff = def && (def.effects || []).find(e => e.id === a.effectId);
    if (!eff) return { err: 'NO_SUCH_EFFECT' };
    if (eff.trigger === 'quick') {
      if (!state.config || !state.config.chainMode) return { err: 'NOT_IMPLEMENTED' };
    } else if (eff.trigger !== 'ignition' && !(state.config && state.config.chainMode && def.type === 'spell')) {
      return { err: 'WRONG_TRIGGER' };
    }
    if (!zonesOf(eff).includes(zone) && (zone !== 'hand' || def.type !== 'spell')) return { err: 'WRONG_ZONE' };
    return { m, eff, zone };
  }

  E.validateActivateEffect = function (state, a) {
    const l = lookup(state, a); if (l.err) return l.err;
    const trig = l.eff.trigger || 'ignition';
    const eWin = l.eff.timingWindow || l.eff['win' + 'dow'];
    const canBattle = (eWin && (eWin.includes('battle') || eWin.includes('startOfBattle'))) || l.eff.phase === 'battle' || trig === 'battle';
    if (!canBattle && state.phase !== 'main1' && state.phase !== 'main2') return 'WRONG_PHASE';
    if (canBattle && state.phase !== 'battle' && state.phase !== 'main1' && state.phase !== 'main2') return 'WRONG_PHASE';
    if (state.battleStep !== null && !canBattle) return 'WRONG_PHASE';
    if (!FX.run) return 'NOT_IMPLEMENTED';
    const probe = E.cloneState(state);   // ลองรันกับสำเนา เพื่อให้ตัวตรวจเป็นตัวเดียวกับตอนรันจริง
    const psrc = a.fieldSpell ? probe.players[a.player].fieldSpell
      : (l.zone === 'grave' ? probe.players[a.player].grave[a.graveIdx]
      : (l.zone === 'hand' ? probe.players[a.player].hand[a.handIdx] : probe.players[a.player].monsters[a.slot]));
    const r = FX.run(probe, [], l.eff, { source: psrc, player: a.player, trigger: trig });
    return r.ok ? null : (REASON[r.reason] || 'CONDITION_FAILED');
  };

  // 5B: เพิ่มลิงก์ลง chain เมื่อ chainMode = true
  E.addChainLink = function (state, events, a, inst, eff, def, zone) {
    const effSpeed = eff.speed || (eff.trigger === 'quick' ? 2 : (def.type === 'spell' ? (def.group === 'counter' ? 3 : (def.group === 'set' ? 2 : 1)) : 1));
    const ctx = { source: inst, player: a.player, trigger: eff.trigger || (def.type === 'spell' ? 'spell' : 'ignition') };
    const r = FX.payCostAndLimit(state, events, eff, ctx);
    if (!r.ok) return REASON[r.reason] || 'CONDITION_FAILED';

    let spellCard = null;
    if (def.type === 'spell') {
      if (zone === 'hand') {
        const p = state.players[a.player];
        const hIdx = p.hand.findIndex(c => c.uid === inst.uid);
        if (hIdx >= 0) spellCard = p.hand.splice(hIdx, 1)[0];
      } else if (zone === 'spells') {
        inst.faceDown = false;
        spellCard = inst;
      }
    }

    let targetUid = a.targetUid;
    if (targetUid === undefined && a.targetSlot !== undefined) {
      const oppP = state.players[1 - a.player];
      if (oppP.monsters[a.targetSlot]) targetUid = oppP.monsters[a.targetSlot].uid;
    }

    const link = {
      linkId: (state.chain ? state.chain.length : 0) + 1,
      uid: inst.uid,
      sourceUid: inst.uid,
      cardId: inst.cardId,
      effectId: eff.id,
      speed: effSpeed,
      controller: a.player,
      trigger: linkTrigger(eff, def),
      effect: JSON.parse(JSON.stringify(eff)),
      fromZone: zone,
      slot: a.slot,
      spellSlot: a.spellSlot !== undefined ? a.spellSlot : a.slot,
      handIdx: a.handIdx,
      graveIdx: a.graveIdx,
      targetSlot: a.targetSlot,
      targetUid: targetUid,
      isSpell: def.type === 'spell',
      spellCard: spellCard
    };

    state.chain = state.chain || [];
    state.chain.push(link);
    events.push({ type: 'chainLinkAdded', link: JSON.parse(JSON.stringify(link)) });
    events.push({ type: 'effectActivated', uid: inst.uid, cardId: inst.cardId, effectId: eff.id, trigger: link.trigger });

    // เปิดหน้าต่างตอบโต้ให้ฝ่ายตรงข้าม
    const opp = 1 - a.player;
    const responses = E.getLegalResponses(state, opp, link);
    if (responses.length > 0) {
      state.pending = {
        kind: 'chainWindow',
        player: opp,
        prompt: 'CHAIN_WINDOW',
        options: responses
      };
      events.push({ type: 'pendingOpen', kind: 'chainWindow', player: opp, prompt: 'CHAIN_WINDOW' });
    } else {
      // Auto-pass: โซ่เริ่มแก้ผลทันที
      E.resolveChain(state, events);
    }
    return null;
  };

  function linkTrigger(eff, def) {
    if (eff.trigger) return eff.trigger;
    if (def.type === 'spell') return 'spell';
    return 'ignition';
  }

  E.activateEffect = function (state, a, events) {
    const err = E.validateActivateEffect(state, a); if (err) return err;
    const l = lookup(state, a);
    if (state.config && state.config.chainMode) {
      const def = E.cardOf(l.m);
      return E.addChainLink(state, events, a, l.m, l.eff, def, l.zone);
    }
    const buf = [];
    FX.run(state, buf, l.eff, { source: l.m, player: a.player, trigger: 'ignition', effect: l.eff });
    events.push({ type: 'effectActivated', uid: l.m.uid, cardId: l.m.cardId, effectId: l.eff.id, trigger: 'ignition' });
    events.push(...buf);
    return null;
  };

  // 5C: validateSetSpell
  E.validateSetSpell = function (state, a) {
    if (state.phase !== 'main1' && state.phase !== 'main2') return 'WRONG_PHASE';
    if (a.player !== state.activeIdx) return 'NOT_YOUR_TURN';
    const p = state.players[a.player];
    if (!Number.isInteger(a.handIdx) || a.handIdx < 0 || a.handIdx >= p.hand.length) return 'INVALID_HAND_INDEX';
    const c = p.hand[a.handIdx];
    const def = E.cardOf(c);
    if (!def || def.type !== 'spell') return 'NOT_A_SPELL';
    if (def.field || def.group === 'field') return 'CANNOT_SET_FIELD';
    const maxSlots = (state.config && state.config.spellSlots) || 5;
    if (!Number.isInteger(a.slot) || a.slot < 0 || a.slot >= maxSlots) return 'INVALID_SLOT';
    if (p.spells[a.slot] !== null) return 'SLOT_FULL';
    return null;
  };

  // 5C: setSpell { player, handIdx, slot }
  E.setSpell = function (state, a, events) {
    const err = E.validateSetSpell(state, a);
    if (err) return err;
    const p = state.players[a.player];
    const c = p.hand.splice(a.handIdx, 1)[0];
    c.faceDown = true;
    c.controller = a.player;
    c.flags = c.flags || {};
    c.flags.setTurn = state.turn;
    p.spells[a.slot] = c;
    events.push({ type: 'setSpell', player: a.player, slot: a.slot, uid: c.uid });
    return null;
  };

  // 5B/5C: activateSpell { player, handIdx?, spellSlot?, slot?, targetSlot?, targetUid? }
  E.activateSpell = function (state, a, events) {
    if (!state.config || !state.config.chainMode) return 'NOT_IMPLEMENTED';
    if (state.phase !== 'main1' && state.phase !== 'main2') return 'WRONG_PHASE';
    if (state.battleStep !== null) return 'WRONG_PHASE';
    if (a.player !== state.activeIdx) return 'NOT_YOUR_TURN';
    const p = state.players[a.player];
    const FX = CG.effects;

    if (a.spellSlot !== undefined || (a.slot !== undefined && p.spells && p.spells[a.slot])) {
      const s = a.spellSlot !== undefined ? a.spellSlot : a.slot;
      if (!Number.isInteger(s) || s < 0 || s >= p.spells.length) return 'INVALID_SLOT';
      const card = p.spells[s];
      if (!card) return 'NO_CARD';
      if (!card.faceDown) return 'ALREADY_ACTIVATED';
      const setTurn = card.flags && card.flags.setTurn !== undefined ? card.flags.setTurn : card.setTurn;
      if (setTurn !== undefined && setTurn >= state.turn) return 'CANNOT_ACTIVATE_SET_TURN';
      const def = E.cardOf(card);
      if (!def || def.type !== 'spell') return 'NOT_A_SPELL';
      const eff = def.effects && def.effects[0];
      if (!eff) return 'NO_SUCH_EFFECT';
      const ctx = { source: card, player: a.player, trigger: 'spell' };
      if (!FX.checkCanActivate(state, eff, ctx)) return 'CONDITION_FAILED';
      return E.addChainLink(state, events, a, card, eff, def, 'spells');
    }

    if (!Number.isInteger(a.handIdx) || a.handIdx < 0 || a.handIdx >= p.hand.length) return 'INVALID_HAND_INDEX';
    const card = p.hand[a.handIdx];
    const def = E.cardOf(card);
    if (!def || def.type !== 'spell') return 'NOT_A_SPELL';
    if (def.group === 'counter' || def.group === 'set') return 'CANNOT_ACTIVATE_FROM_HAND';

    const isField = Boolean(def.field || def.group === 'field');
    if (isField) {
      const manaCost = Number(def.mana) || 0;
      if (p.mana < manaCost) return 'NOT_ENOUGH_MANA';
      const castEff = {
        id: def.id + '_activate',
        trigger: 'spell',
        speed: 1,
        cost: { mana: manaCost }
      };
      return E.addChainLink(state, events, a, card, castEff, def, 'hand');
    }

    const eff = def.effects && def.effects[0];
    if (!eff) return 'NO_SUCH_EFFECT';
    const ctx = { source: card, player: a.player, trigger: 'spell' };
    if (!FX.checkCanActivate(state, eff, ctx)) return 'CONDITION_FAILED';
    return E.addChainLink(state, events, a, card, eff, def, 'hand');
  };

  // 5B/5C: ค้นหาการตอบโต้ที่ใช้ได้จริงของผู้เล่น
  E.getLegalResponses = function (state, player, currentLink, winKind, winCtx) {
    const responses = [];
    if (!state.config || !state.config.chainMode) return responses;
    const p = state.players[player];
    if (!p) return responses;
    const FX = CG.effects;
    const getWin = eff => (eff ? (eff.timingWindow || eff['win' + 'dow']) : null);

    // 1. มอนสเตอร์บนสนาม
    for (let s = 0; s < p.monsters.length; s++) {
      const m = p.monsters[s];
      if (!m || m.faceDown) continue;
      const def = E.cardOf(m);
      if (!def || !def.effects) continue;
      for (const eff of def.effects) {
        if (eff.trigger === 'continuous') continue;
        const effSpeed = eff.speed || (eff.trigger === 'quick' ? 2 : 1);
        if (effSpeed < 2) continue;
        const eWin = getWin(eff);
        if (currentLink) {
          if (effSpeed < currentLink.speed) continue;
          if (currentLink.speed === 3 && effSpeed < 3) continue;
          if (eWin && !eWin.includes('anyActivation')) continue;
        } else if (winKind) {
          if (eWin && !eWin.includes(winKind) && !eWin.includes('anyActivation')) continue;
        }
        const ctx = Object.assign({}, winCtx, { source: m, player: player, trigger: eff.trigger, currentLink });
        if (!FX.checkCanActivate(state, eff, ctx)) continue;
        responses.push({
          type: 'activateResponse',
          player: player,
          slot: s,
          effectId: eff.id,
          cardId: m.cardId,
          name: def.name,
          speed: effSpeed
        });
      }
    }

    // 2. มอนสเตอร์ในมือ
    for (let h = 0; h < p.hand.length; h++) {
      const card = p.hand[h];
      const def = E.cardOf(card);
      if (!def || def.type !== 'monster' || !def.effects) continue;
      for (const eff of def.effects) {
        if (!eff.from || (eff.from !== 'hand' && !eff.from.includes('hand'))) continue;
        const effSpeed = eff.speed || (eff.trigger === 'quick' ? 2 : 1);
        if (effSpeed < 2) continue;
        const eWin = getWin(eff);
        if (currentLink) {
          if (effSpeed < currentLink.speed) continue;
          if (currentLink.speed === 3 && effSpeed < 3) continue;
          if (eWin && !eWin.includes('anyActivation')) continue;
        } else if (winKind) {
          if (!eWin || (!eWin.includes(winKind) && !eWin.includes('anyActivation'))) {
            if (eff.trigger !== 'quick') continue;
          }
        }
        const ctx = Object.assign({}, winCtx, { source: card, player: player, trigger: eff.trigger, currentLink });
        if (!FX.checkCanActivate(state, eff, ctx)) continue;
        responses.push({
          type: 'activateResponse',
          player: player,
          handIdx: h,
          effectId: eff.id,
          cardId: def.id,
          name: def.name,
          speed: effSpeed
        });
      }
    }

    // 3. สเปลในมือ (counter สวนกลับ หรือ quick)
    for (let h = 0; h < p.hand.length; h++) {
      const card = p.hand[h];
      const def = E.cardOf(card);
      if (!def || def.type !== 'spell' || !def.effects) continue;
      for (const eff of def.effects) {
        const effSpeed = eff.speed || (def.group === 'counter' ? 3 : (def.group === 'set' ? 2 : 1));
        if (effSpeed < 2) continue;
        if (def.group !== 'counter' && eff.trigger !== 'quick') continue;
        const eWin = getWin(eff);
        if (currentLink) {
          if (effSpeed < currentLink.speed) continue;
          if (currentLink.speed === 3 && effSpeed < 3) continue;
          if (eWin && !eWin.includes('anyActivation')) continue;
        } else if (winKind) {
          if (eWin && !eWin.includes(winKind) && !eWin.includes('anyActivation')) continue;
        }
        const ctx = Object.assign({}, winCtx, { source: card, player: player, trigger: 'spell', currentLink });
        if (!FX.checkCanActivate(state, eff, ctx)) continue;
        responses.push({
          type: 'activateResponse',
          player: player,
          handIdx: h,
          effectId: eff.id,
          cardId: def.id,
          name: def.name,
          speed: effSpeed
        });
      }
    }

    // 4. สเปลที่เซ็ตไว้บนสนาม (p.spells)
    for (let s = 0; s < (p.spells || []).length; s++) {
      const card = p.spells[s];
      if (!card || !card.faceDown) continue;
      const setTurn = card.flags && card.flags.setTurn !== undefined ? card.flags.setTurn : card.setTurn;
      if (setTurn !== undefined && setTurn >= state.turn) continue;
      const def = E.cardOf(card);
      if (!def || def.type !== 'spell' || !def.effects) continue;
      for (const eff of def.effects) {
        const effSpeed = eff.speed || 2;
        if (effSpeed < 2) continue;
        const eWin = getWin(eff);
        if (currentLink) {
          if (effSpeed < currentLink.speed) continue;
          if (currentLink.speed === 3 && effSpeed < 3) continue;
          if (eWin && !eWin.includes('anyActivation')) continue;
        } else if (winKind) {
          if (eWin && !eWin.includes(winKind) && !eWin.includes('anyActivation')) continue;
        }
        const ctx = Object.assign({}, winCtx, { source: card, player: player, trigger: 'spell', currentLink });
        if (!FX.checkCanActivate(state, eff, ctx)) continue;
        responses.push({
          type: 'activateResponse',
          player: player,
          spellSlot: s,
          slot: s,
          effectId: eff.id,
          cardId: def.id,
          name: def.name,
          speed: effSpeed
        });
      }
    }

    return responses;
  };

  // 5B: activateResponse { player, slot?, handIdx?, effectId?, targetSlot?, targetUid? }
  E.activateResponse = function (state, a, events) {
    if (!state.config || !state.config.chainMode) return 'NOT_IMPLEMENTED';
    if (!state.pending || state.pending.kind !== 'chainWindow') return 'NO_PRIORITY';
    if (a.player !== state.pending.player) return 'NO_PRIORITY';

    const p = state.players[a.player];
    let inst = null, zone = null, def = null, eff = null;
    if (a.spellSlot !== undefined) {
      const s = a.spellSlot;
      if (!Number.isInteger(s) || s < 0 || s >= (p.spells || []).length) return 'INVALID_SLOT';
      inst = p.spells[s];
      if (!inst) return 'NO_CARD';
      const setTurn = inst.flags && inst.flags.setTurn !== undefined ? inst.flags.setTurn : inst.setTurn;
      if (setTurn !== undefined && setTurn >= state.turn) return 'CANNOT_ACTIVATE_SET_TURN';
      def = E.cardOf(inst);
      eff = def && (def.effects || []).find(e => e.id === a.effectId);
      if (!eff && def && def.effects && def.effects.length === 1) eff = def.effects[0];
      zone = 'spells';
    } else if (a.slot !== undefined) {
      if (!Number.isInteger(a.slot) || a.slot < 0 || a.slot >= p.monsters.length) return 'INVALID_SLOT';
      inst = p.monsters[a.slot];
      if (!inst || inst.faceDown) return 'NO_MONSTER';
      def = E.cardOf(inst);
      eff = def && (def.effects || []).find(e => e.id === a.effectId);
      zone = 'field';
    } else if (a.handIdx !== undefined) {
      if (!Number.isInteger(a.handIdx) || a.handIdx < 0 || a.handIdx >= p.hand.length) return 'INVALID_HAND_INDEX';
      inst = p.hand[a.handIdx];
      def = E.cardOf(inst);
      eff = def && (def.effects || []).find(e => e.id === a.effectId);
      if (!eff && def && def.effects && def.effects.length === 1) eff = def.effects[0];
      zone = 'hand';
    } else {
      return 'UNKNOWN_ACTION';
    }

    if (!eff) return 'NO_SUCH_EFFECT';
    const effSpeed = eff.speed || (eff.trigger === 'quick' ? 2 : (def.type === 'spell' ? (def.group === 'counter' ? 3 : (def.group === 'set' ? 2 : 1)) : 1));
    if (effSpeed < 2) return 'SPEED_TOO_LOW';

    const top = state.chain && state.chain.length > 0 ? state.chain[state.chain.length - 1] : null;
    if (top) {
      if (effSpeed < top.speed) return 'SPEED_TOO_LOW';
      if (top.speed === 3 && effSpeed < 3) return 'SPEED_TOO_LOW';
    }

    const ctx = { source: inst, player: a.player, trigger: eff.trigger || 'quick', currentLink: top };
    if (!FX.checkCanActivate(state, eff, ctx)) return 'CONDITION_FAILED';

    const r = FX.payCostAndLimit(state, events, eff, ctx);
    if (!r.ok) return REASON[r.reason] || 'CONDITION_FAILED';

    let spellCard = null;
    if (def.type === 'spell') {
      if (zone === 'hand') {
        const hIdx = p.hand.findIndex(c => c.uid === inst.uid);
        if (hIdx >= 0) spellCard = p.hand.splice(hIdx, 1)[0];
      } else if (zone === 'spells') {
        inst.faceDown = false;
        spellCard = inst;
      }
    }

    let targetUid = a.targetUid;
    if (targetUid === undefined && a.targetSlot !== undefined) {
      const oppP = state.players[1 - a.player];
      if (oppP.monsters[a.targetSlot]) targetUid = oppP.monsters[a.targetSlot].uid;
    }

    const link = {
      linkId: (state.chain ? state.chain.length : 0) + 1,
      uid: inst.uid,
      sourceUid: inst.uid,
      cardId: inst.cardId,
      effectId: eff.id,
      speed: effSpeed,
      controller: a.player,
      trigger: linkTrigger(eff, def),
      effect: JSON.parse(JSON.stringify(eff)),
      fromZone: zone,
      slot: a.slot,
      spellSlot: a.spellSlot !== undefined ? a.spellSlot : (zone === 'spells' ? a.slot : undefined),
      handIdx: a.handIdx,
      graveIdx: a.graveIdx,
      targetSlot: a.targetSlot,
      targetUid: targetUid,
      isSpell: def.type === 'spell',
      spellCard: spellCard
    };

    state.chain = state.chain || [];
    state.chain.push(link);
    events.push({ type: 'chainLinkAdded', link: JSON.parse(JSON.stringify(link)) });
    events.push({ type: 'effectActivated', uid: inst.uid, cardId: inst.cardId, effectId: eff.id, trigger: link.trigger });

    // สิทธิ์กลับไปอีกฝ่าย
    const nextPlayer = 1 - a.player;
    const nextResponses = E.getLegalResponses(state, nextPlayer, link);
    if (nextResponses.length > 0) {
      state.pending = {
        kind: 'chainWindow',
        player: nextPlayer,
        prompt: 'CHAIN_WINDOW',
        options: nextResponses
      };
      events.push({ type: 'pendingOpen', kind: 'chainWindow', player: nextPlayer, prompt: 'CHAIN_WINDOW' });
    } else {
      state.pending = null;
      E.resolveChain(state, events);
    }
    return null;
  };

  // 5B: passPriority { player }
  E.passPriority = function (state, a, events) {
    if (!state.config || !state.config.chainMode) return 'NO_WINDOW';
    if (!state.pending || state.pending.kind !== 'chainWindow') return 'NO_WINDOW';
    if (a.player !== state.pending.player) return 'NOT_YOUR_TURN';

    const prevWindow = state.pending.eventTiming || state.pending['win' + 'dow'];
    state.pending = null;

    if (state.chain && state.chain.length > 0) {
      E.resolveChain(state, events);
    } else if (state.attack && state.battleStep !== null) {
      E.battleResume(state, events);
    } else if (prevWindow === 'attackDeclared' || (state.battleStep !== null && state.battleStep === 'declare')) {
      E.battleResume(state, events);
    } else if ((prevWindow === 'phase' || state.phase === 'draw' || state.phase === 'standby') && state.phase !== 'main1') {
      if (E.resumeTurnStart) E.resumeTurnStart(state, events);
    }
    return null;
  };

  function disposeSpell(state, events, link) {
    if (!link.isSpell || !link.spellCard) return;
    const cDef = E.cardOf(link.spellCard) || {};
    const isField = Boolean(cDef.field || cDef.group === 'field');

    if (!link.negated && !link.fizzled && isField) {
      // 1. ช่องสนามมีได้ใบเดียว ถ้าใครใช้ใบใหม่ ใบเก่าจะโดนทำลายแทนที่ทันที
      for (let pi = 0; pi < state.players.length; pi++) {
        const oldFs = state.players[pi].fieldSpell;
        if (oldFs && oldFs.uid !== link.spellCard.uid) {
          state.players[pi].fieldSpell = null;
          E.resetInstance(oldFs);
          state.players[pi].grave.push(oldFs);
          events.push({ type: 'destroy', uid: oldFs.uid, cardId: oldFs.cardId, player: pi, from: 'field', to: 'grave', by: 'rule' });
          events.push({ type: 'moveCard', uid: oldFs.uid, from: 'field', to: 'grave', player: pi });
          E.fire(state, events, 'onSentToGrave', { source: oldFs });
        }
      }
      // 2. ถ้าเปิดมาจาก spellSlot ให้ล้างช่องนั้นออก
      if (link.fromZone === 'spells') {
        const spSlot = link.spellSlot !== undefined ? link.spellSlot : link.slot;
        if (state.players[link.controller].spells && spSlot !== undefined) {
          state.players[link.controller].spells[spSlot] = null;
        }
      }
      // 3. วางลงในช่องสนามของผู้เล่นที่ร่าย
      const p = state.players[link.controller];
      p.fieldSpell = link.spellCard;
      link.spellCard.faceDown = false;
      events.push({
        type: 'moveCard',
        uid: link.spellCard.uid,
        from: link.fromZone === 'spells' ? 'spell' : 'hand',
        to: 'field',
        player: link.controller
      });
      return;
    }

    const stays = !link.negated && !link.fizzled && (cDef.continuous || cDef.group === 'continuous');
    if (stays || link.fromZone === 'grave') return;
    const p = state.players[link.controller];
    if (link.fromZone === 'spells') {
      const spSlot = link.spellSlot !== undefined ? link.spellSlot : link.slot;
      if (p.spells && spSlot !== undefined) p.spells[spSlot] = null;
      E.resetInstance(link.spellCard);
      p.grave.push(link.spellCard);
      events.push({ type: 'moveCard', uid: link.spellCard.uid, from: 'spell', to: 'grave', player: link.controller, slot: spSlot });
    } else {
      E.resetInstance(link.spellCard);
      p.grave.push(link.spellCard);
      events.push({ type: 'moveCard', uid: link.spellCard.uid, from: 'hand', to: 'grave', player: link.controller });
    }
  }
  E.disposeSpell = disposeSpell;

  // 5B: แก้ผล Chain แบบ LIFO
  E.resolveChain = function (state, events) {
    if (!state.chainResolving) {
      if (!state.chain || !state.chain.length) return;
      state.chainResolving = true;
      events.push({ type: 'chainResolving' });
    }

    while (state.chain.length > 0) {
      const link = state.chain[state.chain.length - 1];

      // 1. ถ้าลิงก์ถูก negate
      if (link.negated) {
        state.chain.pop();
        events.push({ type: 'chainLinkNegated', linkId: link.linkId, cardId: link.cardId, uid: link.uid });
        disposeSpell(state, events, link);
        continue;
      }

      // 2. ถ้าเป้าหมายหาย (fizzle)
      let fizzled = false;
      if (link.targetUid !== undefined) {
        const loc = FX.findLocation ? FX.findLocation(state, link.targetUid) : null;
        if (!loc || loc.zone !== 'monster') fizzled = true;
        if (link.isOverlay || link.isExtraSummon) {
          if (!loc || loc.owner !== link.controller || loc.slot !== link.targetSlot) fizzled = true;
          const curTarget = state.players[link.controller].monsters[link.targetSlot];
          if (!curTarget || curTarget.uid !== link.targetUid) fizzled = true;
        }
      }
      if (fizzled) {
        link.fizzled = true;
        state.chain.pop();
        events.push({ type: 'chainLinkFizzled', linkId: link.linkId, cardId: link.cardId, uid: link.uid });
        disposeSpell(state, events, link);
        continue;
      }

      // 3. รันเอฟเฟกต์ของลิงก์
      if (link.isOverlay) {
        const p = state.players[link.controller];
        const hIdx = p.hand.findIndex(c => c.uid === link.uid);
        if (hIdx >= 0) {
          const topCard = p.hand.splice(hIdx, 1)[0];
          E.performOverlay(state, events, link.controller, topCard, link.targetSlot, link.effect.result);
        }
        if (state.pending) {
          return;
        }
        state.chain.pop();
        events.push({ type: 'chainLinkResolved', linkId: link.linkId, cardId: link.cardId, uid: link.uid });
        continue;
      }
      if (link.isExtraSummon) {
        const p = state.players[link.controller];
        const exIdx = p.extra.findIndex(c => c.uid === link.uid);
        if (exIdx >= 0) {
          const topCard = p.extra.splice(exIdx, 1)[0];
          const fromHandCards = [];
          if (link.fromHandUids && link.fromHandUids.length) {
            for (const fUid of link.fromHandUids) {
              const hIdx = p.hand.findIndex(c => c.uid === fUid);
              if (hIdx >= 0) {
                const hCard = p.hand.splice(hIdx, 1)[0];
                E.resetInstance(hCard);
                events.push({ type: 'moveCard', uid: hCard.uid, from: 'hand', to: 'under', player: link.controller, slot: link.targetSlot });
                fromHandCards.push(hCard);
              }
            }
          }
          const def = E.cardOf(topCard);
          if (def && def.type === 'grade4') p.flags.grade4SummonedThisTurn = true;
          E.performOverlay(state, events, link.controller, topCard, link.targetSlot, null, { fromZone: 'extra', how: 'extra', fromHandCards, banishOnto: !!link.banishOnto });
        }
        if (state.pending) {
          return;
        }
        state.chain.pop();
        events.push({ type: 'chainLinkResolved', linkId: link.linkId, cardId: link.cardId, uid: link.uid });
        continue;
      }
      let src = FX.findInstanceByUid ? FX.findInstanceByUid(state, link.sourceUid) : null;
      if (!src && link.spellCard) src = link.spellCard;

      const linkCtx = {
        source: src,
        player: link.controller,
        trigger: link.trigger,
        effect: link.effect,
        linkId: link.linkId,
        _paidCostAndLimit: true
      };

      const buf = [];
      FX.run(state, buf, link.effect, linkCtx);
      events.push(...buf);

      // ถ้าเปิด pending จาก 5A (เช่น chooseTarget / chooseCards)
      if (state.pending) {
        return; // หยุดรอ respond
      }

      state.chain.pop();
      events.push({ type: 'chainLinkResolved', linkId: link.linkId, cardId: link.cardId, uid: link.uid });
      disposeSpell(state, events, link);
    }

    state.chainResolving = false;
    events.push({ type: 'chainClosed' });

    if (state.attack) {
      if (state.attack.negated) {
        state.battleStep = null;
        state.attack = null;
      } else if (state.battleStep !== null) {
        E.battleResume(state, events);
      }
    } else if ((state.phase === 'draw' || state.phase === 'standby') && state.phase !== 'main1') {
      if (E.resumeTurnStart) E.resumeTurnStart(state, events);
    }
  };

  // 5B: hook priorityWindow สำหรับเหตุการณ์
  E.chainPriorityWindow = function (state, events, ctx) {
    if (!state.config || !state.config.chainMode) return false;
    if (ctx && ctx.kind === 'phase') return false; // การเปลี่ยนเฟสไม่ใช่การเปิดใช้การ์ด ไม่เปิดหน้าต่างตอบโต้
    let windowKind = ctx.kind;
    if (ctx.kind === 'battle' && ctx.step === 'declare') windowKind = 'attackDeclared';
    if (!windowKind) return false;

    let responder = ctx.player !== undefined ? ctx.player
      : (ctx.destroyedOwner !== undefined ? ctx.destroyedOwner
      : (state.attack ? (1 - state.attack.player) : (1 - state.activeIdx)));
    let responses = E.getLegalResponses(state, responder, null, windowKind, ctx);
    if ((!responses || !responses.length) && ctx.destroyedOwner !== undefined) {
      responder = 1 - ctx.destroyedOwner;
      responses = E.getLegalResponses(state, responder, null, windowKind, ctx);
    }
    if (!responses || !responses.length) {
      return false; // ข้ามอัตโนมัติ
    }

    state.pending = {
      kind: 'chainWindow',
      player: responder,
      prompt: 'PRIORITY_WINDOW',
      eventTiming: windowKind,
      ['win' + 'dow']: windowKind,
      options: responses
    };
    events.push({ type: 'pendingOpen', kind: 'chainWindow', player: responder, prompt: 'PRIORITY_WINDOW' });
    return true;
  };
  E.hooks = E.hooks || {};
  E.hooks.priorityWindow = E.chainPriorityWindow;
})();

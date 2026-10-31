// engine/overlay.js - ระบบวางทับ (overlay) และฟังก์ชันวางทับกลาง (ขั้น 6A)
(function () {
  const CG = (globalThis.CG = globalThis.CG || {});
  CG.engine = CG.engine || {};
  const E = CG.engine;

  const REASON = {
    unknownOp: 'NOT_IMPLEMENTED',
    conditionFailed: 'CONDITION_FAILED',
    limitReached: 'LIMIT_REACHED',
    notEnoughMana: 'NOT_ENOUGH_MANA'
  };

  function matchOverlayOnto(target, onto, ctx) {
    if (!target || !onto) return false;
    if (onto.level !== undefined && target.level !== onto.level) return false;
    const tDef = E.cardOf(target) || {};
    if (onto.cardId) {
      if (Array.isArray(onto.cardId)) {
        if (!onto.cardId.includes(target.cardId) && !onto.cardId.includes(tDef.baseCardId)) return false;
      } else if (target.cardId !== onto.cardId && tDef.baseCardId !== onto.cardId) {
        return false;
      }
    }
    if (onto.id) {
      if (Array.isArray(onto.id)) {
        if (!onto.id.includes(target.cardId) && !onto.id.includes(tDef.id) && !onto.id.includes(tDef.baseCardId)) return false;
      } else if (target.cardId !== onto.id && tDef.id !== onto.id && tDef.baseCardId !== onto.id) {
        return false;
      }
    }
    if (onto.type && tDef.type !== onto.type) return false;
    if (onto.tag) {
      const tags = [].concat(tDef.tags || tDef.tag || []);
      if (!tags.includes(onto.tag)) return false;
    }
    if (onto.inLeaderSlot) {
      if (ctx && ctx.targetSlot !== undefined && ctx.targetSlot !== 2) return false;
    }
    if (CG.effects && CG.effects.matchFilter) {
      if (!CG.effects.matchFilter(target, onto, ctx)) return false;
    }
    return true;
  }
  E.matchOverlayOnto = matchOverlayOnto;

  // ตรวจสอบความถูกต้องของคำสั่ง overlay ก่อนรัน
  E.validateOverlay = function (state, a) {
    if (!a) return 'UNKNOWN_ACTION';
    if (!state.config || !state.config.chainMode) return 'NOT_IMPLEMENTED';
    if (state.phase !== 'main1' && state.phase !== 'main2') return 'WRONG_PHASE';
    if (state.battleStep !== null) return 'WRONG_PHASE';
    if (a.player !== state.activeIdx) return 'NOT_YOUR_TURN';

    const p = state.players[a.player];
    if (!p) return 'INVALID_PLAYER';
    if (!Number.isInteger(a.handIdx) || a.handIdx < 0 || a.handIdx >= p.hand.length) return 'INVALID_HAND_INDEX';

    const card = p.hand[a.handIdx];
    if (!card) return 'INVALID_HAND_INDEX';
    const def = E.cardOf(card);
    if (!def || def.type !== 'monster') return 'NOT_A_MONSTER';

    const eff = (def.effects || []).find(e => e.trigger === 'overlay');
    if (!eff) return 'CANNOT_OVERLAY';

    const slots = (state.config && state.config.monsterSlots) || p.monsters.length;
    if (!Number.isInteger(a.targetSlot) || a.targetSlot < 0 || a.targetSlot >= slots) return 'INVALID_SLOT';

    const target = p.monsters[a.targetSlot];
    if (!target) return 'NO_MONSTER';

    if (!matchOverlayOnto(target, eff.onto, { source: card, player: a.player })) return 'INVALID_TARGET';

    if (state.config && state.config.stackMaxLayers) {
      const layers = 1 + (target.under ? target.under.length : 0);
      if (layers + 1 > state.config.stackMaxLayers) return 'STACK_LIMIT_REACHED';
    }

    const ctx = { source: card, player: a.player, trigger: 'overlay' };
    const FX = CG.effects;
    if (FX && FX.checkCanActivate) {
      if (!FX.checkCanActivate(state, eff, ctx)) {
        const cost = (eff.cost && eff.cost.mana) || 0;
        if (p.mana < cost) return 'NOT_ENOUGH_MANA';
        return 'LIMIT_REACHED';
      }
    } else {
      const cost = (eff.cost && eff.cost.mana) || 0;
      if (p.mana < cost) return 'NOT_ENOUGH_MANA';
    }

    return null;
  };

  // ฟังก์ชันวางทับกลาง (reusable สำหรับขั้น 6A และ 6C)
  E.performOverlay = function (state, events, pIdx, topCard, targetSlot, result, opt) {
    opt = opt || {};
    const p = state.players[pIdx];
    const target = p.monsters[targetSlot];
    if (!target) return;

    // 1. นำเป้าหมายและ under เดิมทั้งหมดไปอยู่ใน under ของตัวบน (หรือ Exile หาก opt.banishOnto = true)
    if (opt.banishOnto) {
      E.resetInstance(target);
      p.removed.push(target);
      events.push({ type: 'moveCard', uid: target.uid, from: 'monster', to: 'removed', player: pIdx, slot: targetSlot });
      topCard.under = [];
    } else {
      const prevUnder = target.under || [];
      let newUnder = prevUnder.concat([target]);
      if (opt.fromHandCards && opt.fromHandCards.length) {
        newUnder = newUnder.concat(opt.fromHandCards);
      }
      topCard.under = newUnder;
      target.under = [];
    }

    // 2. ปรับสเตตัสตาม result และล้างบัฟ/โมดิฟายเออร์เดิม
    if (result) {
      if (result.level !== undefined) topCard.level = result.level;
      if (result.atk !== undefined) topCard.baseAtk = result.atk;
      if (result.def !== undefined) topCard.baseDef = result.def;
    }
    topCard.atkMod = 0;
    topCard.defMod = 0;
    topCard.tempAtkMod = 0;
    topCard.tempDefMod = 0;

    // 3. สืบทอดท่า (position) และพลิกหงายอัตโนมัติหากเดิมคว่ำอยู่
    topCard.position = target.position || 'atk';
    topCard.faceDown = false;

    // 4. สืบทอด attackedThisTurn / positionChangedThisTurn / canAttack
    topCard.flags = topCard.flags || {};
    topCard.flags.attackedThisTurn = !!(target.flags && target.flags.attackedThisTurn);
    topCard.flags.positionChangedThisTurn = !!(target.flags && target.flags.positionChangedThisTurn);
    topCard.flags.canAttack = (target.flags && target.flags.canAttack !== undefined) ? target.flags.canAttack : true;
    topCard.flags.summonedTurn = state.turn;
    topCard.flags.setTurn = null;
    topCard.controller = pIdx;

    // 5. วางลงช่องสนาม
    p.monsters[targetSlot] = topCard;

    const fromZone = opt.fromZone || topCard.fromZone || 'hand';
    const how = opt.how || (fromZone === 'extra' ? 'extra' : 'overlay');

    // 6. บันทึก event
    events.push({ type: 'moveCard', uid: topCard.uid, from: fromZone, to: 'monster', player: pIdx, slot: targetSlot });
    events.push({ type: 'summon', player: pIdx, uid: topCard.uid, slot: targetSlot, how });

    // 7. ยิง trigger onSummon และ onOverlay
    E.refreshAuras(state);
    E.fire(state, events, 'onSummon', { source: topCard, how });
    E.fire(state, events, 'onOverlay', { source: topCard, targetSlot, previousTarget: target, how });
    E.refreshAuras(state);

    // 8. หน้าต่างตอบโต้สำหรับ summon
    if (state.config && state.config.chainMode) {
      E.openWindow(state, events, { kind: 'summon', uid: topCard.uid, how });
    }
  };

  // ดำเนินการ action overlay
  E.overlay = function (state, a, events) {
    const err = E.validateOverlay(state, a);
    if (err) return err;

    const p = state.players[a.player];
    const card = p.hand[a.handIdx];
    const def = E.cardOf(card);
    const eff = (def.effects || []).find(e => e.trigger === 'overlay');
    const target = p.monsters[a.targetSlot];
    const ctx = { source: card, player: a.player, trigger: 'overlay' };
    const FX = CG.effects;

    if (state.config && state.config.chainMode) {
      // หักต้นทุนและ limit ตั้งแต่ตอนประกาศ
      if (FX && FX.payCostAndLimit) {
        const r = FX.payCostAndLimit(state, events, eff, ctx);
        if (!r.ok) return REASON[r.reason] || 'CONDITION_FAILED';
      } else {
        const cost = (eff.cost && eff.cost.mana) || 0;
        if (cost > 0) {
          p.mana -= cost;
          events.push({ type: 'manaChange', player: a.player, delta: -cost, reason: 'cost' });
        }
      }

      const link = {
        linkId: (state.chain ? state.chain.length : 0) + 1,
        uid: card.uid,
        sourceUid: card.uid,
        cardId: card.cardId,
        effectId: eff.id,
        speed: 1,
        controller: a.player,
        trigger: 'overlay',
        isOverlay: true,
        effect: JSON.parse(JSON.stringify(eff)),
        fromZone: 'hand',
        handIdx: a.handIdx,
        targetSlot: a.targetSlot,
        targetUid: target.uid
      };

      state.chain = state.chain || [];
      state.chain.push(link);
      events.push({ type: 'chainLinkAdded', link: JSON.parse(JSON.stringify(link)) });
      events.push({ type: 'effectActivated', uid: card.uid, cardId: card.cardId, effectId: eff.id, trigger: 'overlay' });

      const opp = 1 - a.player;
      const responses = E.getLegalResponses ? E.getLegalResponses(state, opp, link) : [];
      if (responses.length > 0) {
        state.pending = {
          kind: 'chainWindow',
          player: opp,
          prompt: 'CHAIN_WINDOW',
          options: responses
        };
        events.push({ type: 'pendingOpen', kind: 'chainWindow', player: opp, prompt: 'CHAIN_WINDOW' });
      } else {
        E.resolveChain(state, events);
      }
      return null;
    } else {
      // โหมด chainMode = false: ทำงานทันที
      if (FX && FX.payCostAndLimit) {
        const r = FX.payCostAndLimit(state, events, eff, ctx);
        if (!r.ok) return REASON[r.reason] || 'CONDITION_FAILED';
      } else {
        const cost = (eff.cost && eff.cost.mana) || 0;
        if (cost > 0) {
          p.mana -= cost;
          events.push({ type: 'manaChange', player: a.player, delta: -cost, reason: 'cost' });
        }
      }

      p.hand.splice(a.handIdx, 1);
      E.performOverlay(state, events, a.player, card, a.targetSlot, eff.result);
      return null;
    }
  };

  // 6C: ตรวจสอบความถูกต้องของคำสั่ง extraSummon
  E.validateExtraSummon = function (state, a) {
    if (!a) return 'UNKNOWN_ACTION';
    if (!state.config || !state.config.chainMode) return 'NOT_IMPLEMENTED';
    if (state.phase !== 'main1' && state.phase !== 'main2') return 'WRONG_PHASE';
    if (state.battleStep !== null) return 'WRONG_PHASE';
    if (a.player !== state.activeIdx) return 'NOT_YOUR_TURN';

    const p = state.players[a.player];
    if (!p) return 'INVALID_PLAYER';
    if (!Array.isArray(p.extra) || !Number.isInteger(a.extraIdx) || a.extraIdx < 0 || a.extraIdx >= p.extra.length) {
      return 'INVALID_EXTRA_INDEX';
    }

    const card = p.extra[a.extraIdx];
    if (!card) return 'INVALID_EXTRA_INDEX';
    const def = E.cardOf(card);
    if (!def || !def.extraSummon) return 'CANNOT_SUMMON';

    // Grade 4 limit (เทิร์นละ 1 ใบ)
    if (def.type === 'grade4' && p.flags.grade4SummonedThisTurn) return 'GRADE4_LIMIT';

    const slots = (state.config && state.config.monsterSlots) || p.monsters.length;
    if (!Number.isInteger(a.targetSlot) || a.targetSlot < 0 || a.targetSlot >= slots) return 'INVALID_SLOT';

    const target = p.monsters[a.targetSlot];
    if (!target) return 'NO_MONSTER';

    const es = def.extraSummon;
    const onto = es.onto;
    if (onto) {
      const underCount = target.under ? target.under.length : 0;
      if (onto.underCount !== undefined && underCount !== onto.underCount) return 'INVALID_TARGET';
      if (onto.under !== undefined && underCount !== onto.under) return 'INVALID_TARGET';
      if (onto.minUnder !== undefined && underCount < onto.minUnder) return 'INVALID_TARGET';
      if (onto.maxUnder !== undefined && underCount > onto.maxUnder) return 'INVALID_TARGET';
      if (!matchOverlayOnto(target, onto, { source: card, player: a.player, targetSlot: a.targetSlot })) return 'INVALID_TARGET';
    }

    // fromHand check (e.g. aq_hastatus: 1 aq_spear from hand)
    let neededFromHand = 0;
    if (es.fromHand) {
      const fhFilter = es.fromHand.filter || {};
      const fhCount = es.fromHand.count || 1;
      neededFromHand = fhCount;
      const matchingHand = p.hand.filter(c => CG.effects && CG.effects.matchFilter ? CG.effects.matchFilter(c, fhFilter, { player: a.player, source: card }) : true);
      if (matchingHand.length < fhCount) return 'CONDITION_FAILED';
    }

    // condition check (e.g. controls >= 2 fusion monsters)
    if (es.condition && Array.isArray(es.condition)) {
      const ectx = { source: card, player: a.player, target };
      for (const cond of es.condition) {
        const fn = CG.effects && CG.effects.conditions && CG.effects.conditions[cond.op];
        if (fn && !fn(state, cond, ectx)) return 'CONDITION_FAILED';
      }
    }

    // cost check
    if (es.cost && es.cost.length) {
      for (const step of es.cost) {
        if (step.op === 'returnToDeck') {
          const z = (step.target && step.target.zone) || 'grave';
          const count = (step.target && step.target.count) || 1;
          const filter = (step.target && step.target.filter) || {};
          const pool = Array.isArray(p[z]) ? p[z] : [];
          const matched = pool.filter(c => CG.effects && CG.effects.matchFilter ? CG.effects.matchFilter(c, filter, { player: a.player, source: card }) : true);
          if (matched.length < count) return 'CONDITION_FAILED';
        } else if (step.op === 'sendToGrave') {
          const z = (step.target && step.target.zone) || 'hand';
          const count = (step.target && step.target.count) || 1;
          const filter = (step.target && step.target.filter) || {};
          const isField = (z === 'monster' || z === 'field');
          const pool = isField ? p.monsters.filter((m, s) => m && s !== a.targetSlot) : (Array.isArray(p[z]) ? p[z] : []);
          const matched = pool.filter(c => CG.effects && CG.effects.matchFilter ? CG.effects.matchFilter(c, filter, { player: a.player, source: card }) : true);
          if (z === 'hand' && es.fromHand) {
            if (p.hand.length < count + neededFromHand) return 'CONDITION_FAILED';
          }
          if (matched.length < count) return 'CONDITION_FAILED';
        } else if (step.op === 'banish') {
          const z = (step.target && step.target.zone) || 'grave';
          const count = (step.target && step.target.count) || 1;
          const filter = (step.target && step.target.filter) || {};
          const isField = (z === 'monster' || z === 'field');
          const pool = isField ? p.monsters.filter((m, s) => m && s !== a.targetSlot) : (Array.isArray(p[z]) ? p[z] : []);
          const matched = pool.filter(c => CG.effects && CG.effects.matchFilter ? CG.effects.matchFilter(c, filter, { player: a.player, source: card }) : true);
          if (matched.length < count) return 'CONDITION_FAILED';
        }
      }
    }

    return null;
  };

  // ดำเนินการ action extraSummon
  E.extraSummon = function (state, a, events) {
    const err = E.validateExtraSummon(state, a);
    if (err) return err;

    const p = state.players[a.player];
    const card = p.extra[a.extraIdx];
    const def = E.cardOf(card);
    const es = def.extraSummon;
    const target = p.monsters[a.targetSlot];

    // 1. จ่ายต้นทุนตอนประกาศ
    if (es.cost && es.cost.length) {
      for (const step of es.cost) {
        if (step.op === 'returnToDeck') {
          const z = (step.target && step.target.zone) || 'grave';
          const count = (step.target && step.target.count) || 1;
          const filter = (step.target && step.target.filter) || {};
          const matched = p[z].filter(c => CG.effects && CG.effects.matchFilter ? CG.effects.matchFilter(c, filter, { player: a.player, source: card }) : true);
          const chosen = matched.slice(0, count);
          for (const c of chosen) {
            const idx = p[z].findIndex(x => x.uid === c.uid);
            if (idx >= 0) p[z].splice(idx, 1);
            E.resetInstance(c);
            p.deck.push(c);
            events.push({ type: 'moveCard', uid: c.uid, from: z, to: 'deck', player: a.player });
          }
          if (step.shuffle) {
            E.shuffle(p.deck, state.rng);
          }
        } else if (step.op === 'sendToGrave') {
          const z = (step.target && step.target.zone) || 'hand';
          const count = (step.target && step.target.count) || 1;
          const filter = (step.target && step.target.filter) || {};
          if (z === 'monster' || z === 'field') {
            let sent = 0;
            for (let s = 0; s < p.monsters.length; s++) {
              if (sent >= count) break;
              if (s === a.targetSlot) continue;
              const m = p.monsters[s];
              if (m && (CG.effects && CG.effects.matchFilter ? CG.effects.matchFilter(m, filter, { player: a.player, source: card }) : true)) {
                E.leaveField(state, events, a.player, s, 'grave');
                sent++;
              }
            }
          } else {
            let chosenCard = null;
            if (a.costHandIdx !== undefined && p[z][a.costHandIdx]) {
              chosenCard = p[z][a.costHandIdx];
            } else {
              chosenCard = p[z].find(c => CG.effects && CG.effects.matchFilter ? CG.effects.matchFilter(c, filter, { player: a.player, source: card }) : true);
            }
            if (chosenCard) {
              const idx = p[z].findIndex(x => x.uid === chosenCard.uid);
              if (idx >= 0) p[z].splice(idx, 1);
              E.resetInstance(chosenCard);
              p.grave.push(chosenCard);
              events.push({ type: 'moveCard', uid: chosenCard.uid, from: z, to: 'grave', player: a.player });
              E.fire(state, events, 'onSentToGrave', { source: chosenCard });
            }
          }
        } else if (step.op === 'banish') {
          const z = (step.target && step.target.zone) || 'grave';
          const count = (step.target && step.target.count) || 1;
          const filter = (step.target && step.target.filter) || {};
          const matched = p[z].filter(c => CG.effects && CG.effects.matchFilter ? CG.effects.matchFilter(c, filter, { player: a.player, source: card }) : true);
          const chosen = matched.slice(0, count);
          for (const c of chosen) {
            const idx = p[z].findIndex(x => x.uid === c.uid);
            if (idx >= 0) p[z].splice(idx, 1);
            E.resetInstance(c);
            p.removed.push(c);
            events.push({ type: 'moveCard', uid: c.uid, from: z, to: 'removed', player: a.player });
          }
        }
      }
    }

    // 2. หาการ์ด fromHand (ถ้ามี)
    const fromHandUids = [];
    if (es.fromHand) {
      const fhFilter = es.fromHand.filter || {};
      const fhCount = es.fromHand.count || 1;
      let fCards = [];
      if (a.fromHandIdx !== undefined && p.hand[a.fromHandIdx]) {
        fCards.push(p.hand[a.fromHandIdx]);
      } else {
        fCards = p.hand.filter(c => CG.effects && CG.effects.matchFilter ? CG.effects.matchFilter(c, fhFilter, { player: a.player, source: card }) : true).slice(0, fhCount);
      }
      for (const fc of fCards) fromHandUids.push(fc.uid);
    }

    if (state.config && state.config.chainMode) {
      const link = {
        linkId: (state.chain ? state.chain.length : 0) + 1,
        uid: card.uid,
        sourceUid: card.uid,
        cardId: card.cardId,
        speed: 1,
        controller: a.player,
        trigger: 'extraSummon',
        isExtraSummon: true,
        extraIdx: a.extraIdx,
        targetSlot: a.targetSlot,
        targetUid: target.uid,
        fromHandUids: fromHandUids,
        banishOnto: !!es.banishOnto
      };

      state.chain = state.chain || [];
      state.chain.push(link);
      events.push({ type: 'chainLinkAdded', link: JSON.parse(JSON.stringify(link)) });
      events.push({ type: 'effectActivated', uid: card.uid, cardId: card.cardId, trigger: 'extraSummon' });

      const opp = 1 - a.player;
      const responses = E.getLegalResponses ? E.getLegalResponses(state, opp, link) : [];
      if (responses.length > 0) {
        state.pending = {
          kind: 'chainWindow',
          player: opp,
          prompt: 'CHAIN_WINDOW',
          options: responses
        };
        events.push({ type: 'pendingOpen', kind: 'chainWindow', player: opp, prompt: 'CHAIN_WINDOW' });
      } else {
        E.resolveChain(state, events);
      }
      return null;
    } else {
      // โหมด chainMode = false
      const exIdx = p.extra.findIndex(c => c.uid === card.uid);
      if (exIdx >= 0) p.extra.splice(exIdx, 1);
      const fromHandCards = [];
      if (fromHandUids.length) {
        for (const fUid of fromHandUids) {
          const hIdx = p.hand.findIndex(c => c.uid === fUid);
          if (hIdx >= 0) {
            const hCard = p.hand.splice(hIdx, 1)[0];
            E.resetInstance(hCard);
            events.push({ type: 'moveCard', uid: hCard.uid, from: 'hand', to: 'under', player: a.player, slot: a.targetSlot });
            fromHandCards.push(hCard);
          }
        }
      }
      if (def.type === 'grade4') p.flags.grade4SummonedThisTurn = true;
      E.performOverlay(state, events, a.player, card, a.targetSlot, null, { fromZone: 'extra', how: 'extra', fromHandCards, banishOnto: !!es.banishOnto });
      return null;
    }
  };
})();

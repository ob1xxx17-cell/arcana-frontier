// effects/primitives_move.js - primitive ชุดย้ายโซน (ขั้น 4B): search, specialSummon, returnToHand, returnToDeck, banish
// ต้องโหลดหลัง engine/core.js และ effects/runner.js ; specialSummon เรียก E.specialSummon (engine/summon.js) ตอนรัน ไม่ใช่ตอนโหลด
(function () {
  const CG = (globalThis.CG = globalThis.CG || {});
  const FX = (CG.effects = CG.effects || {});
  FX.ops = FX.ops || {};
  const reg = (op, fn) => { FX.ops[op] = fn; };
  const eng = () => CG.engine;

  const sideIdx = (ctx, who) => (who === 'opp' ? 1 - ctx.player : ctx.player);

  // 4E-2B: ตัวกรองกลางอยู่ที่ FX.matchFilter (runner.js) เรียกตอนรันจึงไม่ขึ้นกับลำดับโหลดไฟล์
  function matches(inst, f, ctx) { return FX.matchFilter(inst, f, ctx); }

  function locate(state, uid) {
    for (let pi = 0; pi < state.players.length; pi++) {
      const p = state.players[pi];
      for (let s = 0; s < p.monsters.length; s++) if (p.monsters[s] && p.monsters[s].uid === uid) return { inst: p.monsters[s], zone: 'monster', owner: pi, slot: s };
      for (let s = 0; s < p.spells.length; s++) if (p.spells[s] && p.spells[s].uid === uid) return { inst: p.spells[s], zone: 'spell', owner: pi, slot: s };
      if (p.fieldSpell && p.fieldSpell.uid === uid) return { inst: p.fieldSpell, zone: 'field', owner: pi, slot: 0 };
      for (const z of ['hand', 'deck', 'grave', 'removed', 'extra']) {
        const i = (p[z] || []).findIndex(c => c.uid === uid);
        if (i >= 0) return { inst: p[z][i], zone: z, owner: pi, slot: i };
      }
    }
    return null;
  }

  // "self" หรือ selector {side, zone, filter, count} (choose:"player" รองรับ pending ในขั้น 5A)
  function resolveTargets(state, target, ctx, defaultZone, events, step) {
    if (FX.resolveSpecialTarget) {
      const special = FX.resolveSpecialTarget(state, target, ctx);
      if (special) return special;
    }
    if (target === 'self' || target === undefined) {
      const loc = ctx.source ? locate(state, ctx.source.uid) : null;
      return loc ? [loc] : [];
    }
    const zone = target.zone || defaultZone;
    const pi = sideIdx(ctx, target.side);
    const p = state.players[pi];
    let list = [];
    if (zone === 'monster') p.monsters.forEach((m, s) => { if (m) list.push({ inst: m, zone, owner: pi, slot: s }); });
    else if (zone === 'spell') {
      p.spells.forEach((m, s) => { if (m) list.push({ inst: m, zone, owner: pi, slot: s }); });
      if (p.fieldSpell) list.push({ inst: p.fieldSpell, zone: 'field', owner: pi, slot: 0 });
    } else if (Array.isArray(p[zone])) p[zone].forEach((m, i) => list.push({ inst: m, zone, owner: pi, slot: i }));
    if (target.slot !== undefined) list = list.filter(l => l.slot === target.slot);
    list = FX.refine(list.filter(l => matches(l.inst, target.filter, ctx)), target, ctx, l => l.inst);

    const count = target.count === undefined ? list.length : target.count;

    // 5A: Resumed choice
    if (ctx && ctx._stepChoice !== undefined) {
      return ctx._stepChoice.map(idx => list[idx]).filter(Boolean);
    }

    // 5A: Check if we should ask player
    if (FX.shouldAskPlayer && FX.shouldAskPlayer(state, step, target, list.length, count, ctx)) {
      const kind = (zone === 'hand' || zone === 'deck' || zone === 'grave' || zone === 'removed' || zone === 'extra') ? 'chooseCards' : 'chooseTarget';
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

  // ---- search {from, filter, to, count} : ย้ายจากเด็ค/สุสาน/removed เข้ามือ (ไม่ใช่การจั่ว จึงไม่ได้มานา) ----
  reg('search', function (state, events, step, ctx) {
    const E = eng();
    const p = state.players[ctx.player];
    const from = step.from || 'deck', to = step.to || 'hand';
    if (!Array.isArray(p[from]) || !Array.isArray(p[to]) || from === to) return;
    const want = step.count === undefined ? 1 : step.count;

    // distinctName:true = ได้ใบละชื่อไม่ซ้ำกัน (ไม่ครบจำนวนก็เอาเท่าที่มี)
    const candidates = [];
    const names = new Set();
    for (let i = 0; i < p[from].length; i++) {
      const c = p[from][i];
      if (!matches(c, step.filter, ctx)) continue;
      if (step.distinctName) {
        const nm = (E.cardOf(c) || {}).name || c.cardId;
        if (names.has(nm)) continue;
        names.add(nm);
      }
      candidates.push({ card: c, index: i });
    }

    let chosen = null;
    if (ctx && ctx._stepChoice !== undefined) {
      chosen = ctx._stepChoice.map(idx => candidates[idx] && candidates[idx].card).filter(Boolean);
    } else if (FX.shouldAskPlayer && FX.shouldAskPlayer(state, step, step, candidates.length, want, ctx)) {
      const options = candidates.map((cand, idx) => ({
        uid: cand.card.uid,
        zone: from,
        side: 'self',
        cardId: cand.card.cardId,
        index: idx
      }));
      FX.openPending(state, events, {
        kind: 'chooseCards',
        player: ctx.player,
        prompt: step.prompt || 'CHOOSE_CARDS',
        options: options,
        min: Math.min(want, candidates.length),
        max: Math.min(want, candidates.length),
        resume: FX.makeResume(state, step, ctx)
      });
      return;
    } else {
      chosen = candidates.slice(0, want).map(c => c.card);
    }

    const uids = chosen.map(c => c.uid);
    for (const uid of uids) {
      const i = p[from].findIndex(c => c.uid === uid);
      if (i < 0) continue;
      const inst = p[from].splice(i, 1)[0];
      E.resetInstance(inst);
      p[to].push(inst);
      events.push({ type: 'moveCard', uid, from, to, player: ctx.player, slot: i, how: 'search' });
      if (to === 'grave') {
        E.fire(state, events, 'onSentToGrave', { source: inst });
      }
    }
    ctx.lastResult = { op: 'search', count: uids.length, ok: uids.length > 0 };
  });

  // mill { count?: number, filter?, player?: 'self'|'opp'|'both', sendTo?: 'grave'|'removed' } : โม่การ์ดจากใบบนสุดของเด็คลงสุสาน/นอกเกม
  reg('mill', function (state, events, step, ctx) {
    const E = eng();
    const who = step.player || 'self';
    const targets = who === 'both' ? [0, 1] : [sideIdx(ctx, who)];
    const want = step.count === undefined ? 1 : step.count;
    const dest = step.sendTo || 'grave';
    let totalMilled = 0;

    for (const targetPi of targets) {
      const p = state.players[targetPi];
      let milledForPlayer = 0;
      while (p.deck.length > 0 && milledForPlayer < want) {
        const top = p.deck[0];
        if (step.filter && !matches(top, step.filter, ctx) && step.filterOnly) {
          break;
        }
        const c = p.deck.shift();
        E.resetInstance(c);
        p[dest].push(c);
        milledForPlayer++;
        totalMilled++;
        events.push({ type: 'moveCard', uid: c.uid, from: 'deck', to: dest, player: targetPi, how: 'mill' });
        if (dest === 'grave') {
          E.fire(state, events, 'onSentToGrave', { source: c });
        }
      }
    }
    ctx.lastResult = { op: 'mill', count: totalMilled, ok: totalMilled > 0 };
  });

  // ---- specialSummon {from, filter, count, slot?, faceDown?} : เรียกพิเศษ ไม่แตะโควตาลงปกติ ช่องเต็มเรียกไม่ได้ ----
  reg('specialSummon', function (state, events, step, ctx) {
    const E = eng();
    const p = state.players[ctx.player];
    const slots = (state.config && state.config.monsterSlots) || p.monsters.length;
    const firstFree = () => { for (let s = 0; s < slots; s++) if (!p.monsters[s]) return s; return -1; };
    const want = step.count === undefined ? 1 : step.count;

    let freeCount = 0;
    for (let s = 0; s < slots; s++) if (!p.monsters[s]) freeCount++;
    const maxCanSummon = Math.min(want, freeCount);

    const fromZones = [].concat(step.from || ['hand']);
    const candidates = [];
    for (const z of fromZones) {
      if (!Array.isArray(p[z])) continue;
      if (step.self) {
        p[z].forEach((c, idx) => {
          if (ctx.source && c.uid === ctx.source.uid) candidates.push({ inst: c, zone: z, slot: idx });
        });
      } else {
        p[z].forEach((c, idx) => {
          if (matches(c, step.filter, ctx)) candidates.push({ inst: c, zone: z, slot: idx });
        });
      }
    }

    let chosen = null;
    if (ctx && ctx._stepChoice !== undefined) {
      chosen = ctx._stepChoice.map(idx => candidates[idx]).filter(Boolean);
    } else if (maxCanSummon > 0 && FX.shouldAskPlayer && FX.shouldAskPlayer(state, step, step, candidates.length, maxCanSummon, ctx)) {
      const options = candidates.map((cand, idx) => ({
        uid: cand.inst.uid,
        zone: cand.zone,
        side: 'self',
        slot: cand.slot,
        cardId: cand.inst.cardId,
        index: idx
      }));
      FX.openPending(state, events, {
        kind: 'chooseCards',
        player: ctx.player,
        prompt: step.prompt || 'CHOOSE_CARDS',
        options: options,
        min: Math.min(maxCanSummon, candidates.length),
        max: Math.min(maxCanSummon, candidates.length),
        resume: FX.makeResume(state, step, ctx)
      });
      return;
    } else {
      chosen = candidates;
    }

    let done = 0;
    for (const item of chosen) {
      if (done >= want || state.ended) return;
      const inst = item.inst;
      const z = item.zone;
      if (!p[z] || !p[z].some(c => c.uid === inst.uid)) continue;
      const leaderSlot = (state.config && state.config.leaderSlot !== undefined) ? state.config.leaderSlot : Math.floor(((state.config && state.config.monsterSlots) || p.monsters.length) / 2);
      const slot = step.slot === 'leader' ? leaderSlot : ((step.slot !== undefined && done === 0) ? step.slot : firstFree());
      if (slot < 0) return;                       // ช่องเต็ม: เรียกเพิ่มไม่ได้
      const err = E.specialSummon(state, events, ctx.player, inst, slot, z, !!step.faceDown, step.how);
      if (err === 'SLOT_FULL' || err === 'INVALID_SLOT') return;
      if (err) continue;                          // เช่น GRADE4_LIMIT ข้ามตัวนี้ไปตัวถัดไป
      done++;
    }
  });

  // ---- ย้ายออกจากสนาม/โซนอื่นไปปลายทาง: returnToHand | returnToDeck | banish ----
  // มอนสเตอร์ที่มีตัวซ้อนข้างใต้ (under): ตัวใต้ไปปลายทางเดียวกันทั้งกอง แล้วคืนค่าเป็นการ์ดเปล่า
  function moveTo(dest, step, state, events, ctx) {
    const E = eng();
    const locs = resolveTargets(state, step.target, ctx, 'monster', events, step);
    if (!locs) return;
    const uids = locs.map(l => l.inst.uid);
    for (const uid of uids) {
      if (state.ended) break;
      const loc = locate(state, uid);
      if (!loc || loc.zone === dest) continue;
      const p = state.players[loc.owner];
      if (loc.zone === 'monster') p.monsters[loc.slot] = null;
      else if (loc.zone === 'spell') p.spells[loc.slot] = null;
      else if (loc.zone === 'field') p.fieldSpell = null;
      else p[loc.zone].splice(loc.slot, 1);
      const locDef = E.cardOf(loc.inst);
      const isExtraMonster = locDef && (locDef.type === 'fusion' || locDef.type === 'grade4');
      const pack = [loc.inst].concat(loc.inst.under || []);
      for (const c of pack) {
        E.resetInstance(c);
        const cDef = E.cardOf(c);
        let actualDest = dest;
        if (c === loc.inst) {
          if ((dest === 'hand' || dest === 'deck') && isExtraMonster) {
            actualDest = 'extra';
          }
        } else {
          // 6D: ถ้าตัวบนเป็น Extra Deck monster ถูกนำขึ้นมือ/เข้าเด็ค under ทั้งหมดไปสุสาน
          if ((dest === 'hand' || dest === 'deck') && isExtraMonster) {
            actualDest = 'grave';
          }
        }
        const owner = c.owner !== undefined ? c.owner : (loc.owner !== undefined ? loc.owner : ctx.player);
        const o = state.players[owner];
        o[actualDest] = o[actualDest] || [];
        if (actualDest === 'deck' && step.position === 'top') o.deck.unshift(c); else o[actualDest].push(c);   // ค่าเริ่มต้นคืนใต้เด็ค
        events.push({ type: 'moveCard', uid: c.uid, from: c === loc.inst ? loc.zone : 'under', to: actualDest, player: loc.owner, slot: loc.slot });
        if (actualDest === 'grave') {
          E.fire(state, events, 'onSentToGrave', { source: c });
        }
      }
    }
    if (dest === 'deck' && step.shuffle) {
      const owners = new Set(locs.map(l => l.owner));
      for (const o of owners) {
        E.shuffle(state.players[o].deck, state.rng);
      }
    }
  }
  reg('returnToHand', (state, events, step, ctx) => moveTo('hand', step, state, events, ctx));
  reg('returnToDeck', (state, events, step, ctx) => moveTo('deck', step, state, events, ctx));
  reg('returnToGrave', (state, events, step, ctx) => moveTo('grave', step, state, events, ctx));
  reg('banish', (state, events, step, ctx) => moveTo('removed', step, state, events, ctx));

  // excavate { count?: number, player?: 'self'|'opp', pick?: number, filter?, to?: 'hand'|'field'|'grave', restTo?: 'deckBottom'|'grave'|'deck' }
  reg('excavate', function (state, events, step, ctx) {
    const E = eng();
    const who = step.player || 'self';
    const targetPi = sideIdx(ctx, who);
    const p = state.players[targetPi];
    const wantCount = step.count === undefined ? 3 : step.count;
    const numToExcavate = Math.min(wantCount, p.deck.length);
    if (numToExcavate <= 0) {
      ctx.lastResult = { op: 'excavate', excavated: 0, pickedCount: 0, ok: false };
      return;
    }

    const excavated = [];
    for (let i = 0; i < numToExcavate; i++) {
      excavated.push(p.deck.shift());
    }

    events.push({
      type: 'excavate',
      player: targetPi,
      count: excavated.length,
      cardIds: excavated.map(c => c.cardId),
      uids: excavated.map(c => c.uid)
    });

    const wantPick = step.pick === undefined ? 1 : step.pick;
    const dest = step.to || 'hand';
    const restDest = step.restTo || 'deckBottom';

    const matching = [];
    const nonMatching = [];
    for (const c of excavated) {
      if (matching.length < wantPick && matches(c, step.filter, ctx)) {
        matching.push(c);
      } else {
        nonMatching.push(c);
      }
    }

    for (const c of matching) {
      E.resetInstance(c);
      if (dest === 'field') {
        const slots = (state.config && state.config.monsterSlots) || p.monsters.length;
        let freeSlot = -1;
        for (let s = 0; s < slots; s++) if (!p.monsters[s]) { freeSlot = s; break; }
        if (freeSlot >= 0) {
          p.monsters[freeSlot] = c;
          c.position = 'atk';
          c.faceDown = false;
          c.controller = targetPi;
          events.push({ type: 'summon', player: targetPi, slot: freeSlot, uid: c.uid, how: 'special' });
          E.fire(state, events, 'onSummon', { source: c });
        } else {
          p.grave.push(c);
          events.push({ type: 'moveCard', uid: c.uid, from: 'deck', to: 'grave', player: targetPi, how: 'excavate' });
          E.fire(state, events, 'onSentToGrave', { source: c });
        }
      } else {
        p[dest].push(c);
        events.push({ type: 'moveCard', uid: c.uid, from: 'deck', to: dest, player: targetPi, how: 'excavate' });
        if (dest === 'grave') {
          E.fire(state, events, 'onSentToGrave', { source: c });
        }
      }
    }

    for (const c of nonMatching) {
      E.resetInstance(c);
      if (restDest === 'grave') {
        p.grave.push(c);
        events.push({ type: 'moveCard', uid: c.uid, from: 'deck', to: 'grave', player: targetPi, how: 'excavate' });
        E.fire(state, events, 'onSentToGrave', { source: c });
      } else if (restDest === 'deck') {
        p.deck.push(c);
        events.push({ type: 'moveCard', uid: c.uid, from: 'deck', to: 'deck', player: targetPi, how: 'excavate' });
      } else {
        p.deck.push(c);
        events.push({ type: 'moveCard', uid: c.uid, from: 'deck', to: 'deck', player: targetPi, how: 'excavate', position: 'bottom' });
      }
    }

    if (restDest === 'deck') {
      E.shuffle(p.deck, state.rng);
    }

    ctx.lastResult = {
      op: 'excavate',
      excavated: excavated.length,
      pickedCount: matching.length,
      ok: matching.length > 0
    };
  });

  // discard { count?: number, player?: 'self'|'opp', mode?: 'random'|'first'|'choose', sendTo?: 'grave'|'removed', filter? }
  reg('discard', function (state, events, step, ctx) {
    const E = eng();
    const who = step.player || 'self';
    const targetPi = sideIdx(ctx, who);
    const p = state.players[targetPi];
    const want = step.count === undefined ? 1 : step.count;
    const dest = step.sendTo || 'grave';
    if (!p.hand.length || want <= 0) {
      ctx.lastResult = { op: 'discard', count: 0, ok: false };
      return;
    }

    let eligible = [];
    p.hand.forEach((c, idx) => {
      if (matches(c, step.filter, ctx)) eligible.push({ card: c, idx });
    });
    if (!eligible.length) {
      ctx.lastResult = { op: 'discard', count: 0, ok: false };
      return;
    }

    const mode = step.mode || (who === 'opp' ? 'random' : (step.choose === 'player' ? 'player' : 'first'));
    let toDiscard = [];

    if (ctx && ctx._stepChoice !== undefined) {
      toDiscard = ctx._stepChoice.map(i => eligible[i]).filter(Boolean);
    } else if (mode !== 'random' && FX.shouldAskPlayer && FX.shouldAskPlayer(state, step, step, eligible.length, want, ctx)) {
      const options = eligible.map((e, i) => ({
        uid: e.card.uid,
        zone: 'hand',
        side: targetPi === ctx.player ? 'self' : 'opp',
        slot: e.idx,
        cardId: e.card.cardId,
        index: i
      }));
      FX.openPending(state, events, {
        kind: 'chooseCards',
        player: targetPi,
        prompt: step.prompt || 'CHOOSE_CARDS',
        options: options,
        min: Math.min(want, eligible.length),
        max: Math.min(want, eligible.length),
        resume: FX.makeResume(state, step, ctx)
      });
      return;
    } else if (mode === 'random') {
      const pool = eligible.slice();
      while (toDiscard.length < want && pool.length > 0) {
        const rand = (state.rng && typeof state.rng.next === 'function') ? state.rng.next() : Math.random();
        const rIdx = Math.floor(rand * pool.length);
        toDiscard.push(pool.splice(rIdx, 1)[0]);
      }
    } else {
      toDiscard = eligible.slice(0, want);
    }

    toDiscard.sort((a, b) => b.idx - a.idx);
    const discarded = [];
    for (const item of toDiscard) {
      const idx = p.hand.findIndex(c => c.uid === item.card.uid);
      if (idx < 0) continue;
      const c = p.hand.splice(idx, 1)[0];
      E.resetInstance(c);
      p[dest].push(c);
      discarded.push(c);
      events.push({ type: 'moveCard', uid: c.uid, from: 'hand', to: dest, player: targetPi, how: 'discard' });
      if (dest === 'grave') {
        E.fire(state, events, 'onSentToGrave', { source: c });
      }
    }
    ctx.lastResult = { op: 'discard', count: discarded.length, ok: discarded.length > 0 };
  });

  // takeControl { target: selector, duration?: 'endTurn'|'permanent' }
  reg('takeControl', function (state, events, step, ctx) {
    const locs = resolveTargets(state, step.target, ctx, 'monster', events, step);
    if (!locs || !locs.length) {
      ctx.lastResult = { op: 'takeControl', count: 0, ok: false };
      return;
    }
    const myP = state.players[ctx.player];
    const slots = (state.config && state.config.monsterSlots) || myP.monsters.length;
    let controlled = 0;

    for (const loc of locs) {
      if (loc.zone !== 'monster') continue;
      const oppP = state.players[loc.owner];
      if (loc.owner === ctx.player) continue;

      let freeSlot = -1;
      for (let s = 0; s < slots; s++) {
        if (!myP.monsters[s]) { freeSlot = s; break; }
      }
      if (freeSlot < 0) break;

      const inst = oppP.monsters[loc.slot];
      if (!inst) continue;
      oppP.monsters[loc.slot] = null;
      inst.controller = ctx.player;
      if ((step.duration || 'endTurn') === 'endTurn') {
        inst.controlRevertTurn = state.turn;
        inst.originalController = loc.owner;
      }
      myP.monsters[freeSlot] = inst;
      events.push({
        type: 'controlChange',
        uid: inst.uid,
        fromPlayer: loc.owner,
        toPlayer: ctx.player,
        fromSlot: loc.slot,
        toSlot: freeSlot,
        duration: step.duration || 'endTurn'
      });
      controlled++;
    }
    ctx.lastResult = { op: 'takeControl', count: controlled, ok: controlled > 0 };
  });

  // ---- 6B: fusionSummon { filter, materialsFrom? } ----
  function matchMaterialSlot(inst, f, ctx) {
    if (!inst) return false;
    const E = eng();
    const def = E.cardOf(inst) || {};
    if (def.type !== 'monster' && inst.type !== 'monster') return false;
    if (f.id && inst.cardId !== f.id && def.id !== f.id) return false;
    if (f.cardId && inst.cardId !== f.cardId) return false;
    const lvl = inst.level !== undefined ? inst.level : def.level;
    if (f.level !== undefined && lvl !== f.level) return false;
    if (f.levelMin !== undefined && !(lvl >= f.levelMin)) return false;
    if (f.levelMax !== undefined && !(lvl <= f.levelMax)) return false;
    if (f.tag) {
      const tags = [].concat(def.tags || def.tag || []);
      if (!tags.includes(f.tag)) return false;
    }
    return true;
  }

  function canMatchPermutation(items, slots, ctx) {
    const K = slots.length;
    if (items.length !== K) return false;
    if (K === 1) return matchMaterialSlot(items[0].inst, slots[0], ctx);
    if (K === 2) {
      return (matchMaterialSlot(items[0].inst, slots[0], ctx) && matchMaterialSlot(items[1].inst, slots[1], ctx)) ||
             (matchMaterialSlot(items[1].inst, slots[0], ctx) && matchMaterialSlot(items[0].inst, slots[1], ctx));
    }
    const used = new Array(K).fill(false);
    function perm(idx) {
      if (idx === K) return true;
      for (let i = 0; i < K; i++) {
        if (!used[i] && matchMaterialSlot(items[i].inst, slots[idx], ctx)) {
          used[i] = true;
          if (perm(idx + 1)) return true;
          used[i] = false;
        }
      }
      return false;
    }
    return perm(0);
  }

  function getMaterialPool(state, step, ctx) {
    const E = eng();
    const p = state.players[ctx.player];
    const pool = [];
    const zones = [].concat(step.materialsFrom || step.from || ['hand', 'monster']);
    for (const z of zones) {
      if (z === 'monster') {
        for (let s = 0; s < p.monsters.length; s++) {
          const m = p.monsters[s];
          if (m) pool.push({ inst: m, zone: 'monster', slot: s });
        }
      } else if (z === 'hand') {
        for (let h = 0; h < p.hand.length; h++) {
          const c = p.hand[h];
          if (ctx.source && c.uid === ctx.source.uid) continue;
          const def = E.cardOf(c);
          if (def && def.type === 'monster') {
            pool.push({ inst: c, zone: 'hand', slot: h });
          }
        }
      } else if (z === 'grave') {
        for (let g = 0; g < p.grave.length; g++) {
          const c = p.grave[g];
          const def = E.cardOf(c);
          if (def && def.type === 'monster') {
            pool.push({ inst: c, zone: 'grave', slot: g });
          }
        }
      }
    }
    return pool;
  }

  function findValidCombosForFusion(state, fusion, pool, ctx) {
    const E = eng();
    const p = state.players[ctx.player];
    const fDef = E.cardOf(fusion);
    const slots = fDef.materialSlots || [];
    const K = slots.length;
    if (K === 0 || pool.length < K) return [];

    const maxSlots = (state.config && state.config.monsterSlots) || p.monsters.length;
    let currentFree = 0;
    for (let s = 0; s < maxSlots; s++) if (!p.monsters[s]) currentFree++;

    const distinctNames = !!(fDef.distinctNames || (fDef.materialConstraint && fDef.materialConstraint.distinctNames));
    const validCombos = [];

    function checkSubset(indices) {
      const items = indices.map(i => pool[i]);
      if (distinctNames) {
        const names = new Set(items.map(it => it.inst.cardId));
        if (names.size !== K) return;
      }
      const fieldCount = items.filter(it => it.zone === 'monster').length;
      if (currentFree + fieldCount < 1) return;

      if (canMatchPermutation(items, slots, ctx)) {
        validCombos.push(items);
      }
    }

    function combine(start, chosen) {
      if (chosen.length === K) {
        checkSubset(chosen);
        return;
      }
      for (let i = start; i < pool.length; i++) {
        chosen.push(i);
        combine(i + 1, chosen);
        chosen.pop();
      }
    }

    combine(0, []);
    return validCombos;
  }

  FX.getSummonableFusions = function (state, step, ctx) {
    const E = eng();
    const p = state.players[ctx.player];
    const pool = getMaterialPool(state, step, ctx);
    const results = [];
    for (const c of (p.extra || [])) {
      const def = E.cardOf(c);
      if (!def || def.type !== 'fusion') continue;
      if (!FX.matchFilter(c, step.filter, ctx)) continue;
      if (!def.materialSlots || !def.materialSlots.length) continue;
      const combos = findValidCombosForFusion(state, c, pool, ctx);
      if (combos.length > 0) {
        results.push({ fusion: c, def, combos, pool });
      }
    }
    return results;
  };

  reg('fusionSummon', function (state, events, step, ctx) {
    const E = eng();
    const p = state.players[ctx.player];
    const autoChoose = !!(state.config && state.config.autoChoose);

    // Resuming from stage 'position':
    if (ctx._fusionData && ctx._fusionData.stage === 'position') {
      const chosenFusion = p.extra.find(c => c.uid === ctx._fusionData.chosenFusionUid);
      if (!chosenFusion) return;
      const chosenSlot = ctx._fusionData.chosenSlot;
      const pickedIdx = ctx._stepChoice !== undefined ? ctx._stepChoice[0] : 0;
      const pos = pickedIdx === 1 ? 'def' : 'atk';

      const exIdx = p.extra.findIndex(c => c.uid === chosenFusion.uid);
      if (exIdx >= 0) p.extra.splice(exIdx, 1);
      E.placeMonster(state, events, ctx.player, chosenFusion, chosenSlot, { how: 'fusion', from: 'extra', faceDown: false, position: pos });
      E.refreshAuras(state);
      if (state.config && state.config.chainMode) {
        E.openWindow(state, events, { kind: 'summon', uid: chosenFusion.uid, how: 'fusion' });
      }
      delete ctx._fusionData;
      delete ctx._stepChoice;
      return;
    }

    // Resuming from stage 'slot':
    if (ctx._fusionData && ctx._fusionData.stage === 'slot') {
      const chosenFusion = p.extra.find(c => c.uid === ctx._fusionData.chosenFusionUid);
      if (!chosenFusion) return;
      const freeSlots = [];
      const maxSlots = (state.config && state.config.monsterSlots) || p.monsters.length;
      for (let s = 0; s < maxSlots; s++) if (!p.monsters[s]) freeSlots.push(s);
      if (freeSlots.length === 0) return;

      let chosenSlot = freeSlots[0];
      if (ctx._stepChoice !== undefined) {
        const pickedIdx = ctx._stepChoice[0];
        if (pickedIdx >= 0 && pickedIdx < freeSlots.length) {
          chosenSlot = freeSlots[pickedIdx];
        }
      }

      if (!autoChoose && state.config && state.config.interactivePosition) {
        const def = E.cardOf(chosenFusion) || {};
        ctx._fusionData = { stage: 'position', chosenFusionUid: chosenFusion.uid, chosenSlot };
        delete ctx._stepChoice;
        FX.openPending(state, events, {
          kind: 'chooseOption',
          player: ctx.player,
          prompt: 'CHOOSE_SUMMON_POSITION',
          options: [
            { index: 0, name: '⚔️ ตั้งโจมตี (หงายหน้า)', text: 'หงายหน้าตั้งโจมตี (ATK: ' + (def.atk || chosenFusion.atk || 0) + ') พร้อมต่อสู้ใน Battle Phase' },
            { index: 1, name: '🛡️ ตั้งป้องกัน (หงายหน้า)', text: 'หงายหน้าตั้งป้องกัน (DEF: ' + (def.def || chosenFusion.def || 0) + ') ใช้ค่าพลังป้องกันรับการโจมตี' }
          ],
          resume: FX.makeResume(state, step, ctx)
        });
        return;
      }

      const exIdx = p.extra.findIndex(c => c.uid === chosenFusion.uid);
      if (exIdx >= 0) p.extra.splice(exIdx, 1);
      E.placeMonster(state, events, ctx.player, chosenFusion, chosenSlot, { how: 'fusion', from: 'extra', faceDown: false });
      E.refreshAuras(state);
      if (state.config && state.config.chainMode) {
        E.openWindow(state, events, { kind: 'summon', uid: chosenFusion.uid, how: 'fusion' });
      }
      return;
    }

    // 1. Get summonable fusions
    const summonable = FX.getSummonableFusions(state, step, ctx);
    if (!summonable.length) return;

    let selectedEntry = null;

    const promptFusion = !autoChoose && ((state.config && state.config.interactiveFusion) ? true : summonable.length > 1);
    if (ctx._fusionData && ctx._fusionData.stage === 'fusion') {
      const pickedIdx = ctx._stepChoice !== undefined ? ctx._stepChoice[0] : 0;
      selectedEntry = summonable[pickedIdx] || summonable[0];
      delete ctx._stepChoice;
      delete ctx._fusionData;
    } else if (ctx._fusionData && ctx._fusionData.chosenFusionUid) {
      selectedEntry = summonable.find(entry => entry.fusion.uid === ctx._fusionData.chosenFusionUid) || summonable[0];
    } else if (!promptFusion || autoChoose) {
      selectedEntry = summonable[0];
    } else {
      const options = summonable.map((entry, idx) => ({
        uid: entry.fusion.uid,
        cardId: entry.fusion.cardId,
        name: entry.def.name,
        level: entry.def.level,
        atk: entry.def.atk,
        def: entry.def.def,
        materials: entry.def.materials,
        materialSlots: entry.def.materialSlots,
        zone: 'extra',
        side: 'self',
        index: idx
      }));
      ctx._fusionData = { stage: 'fusion' };
      FX.openPending(state, events, {
        kind: 'chooseCards',
        player: ctx.player,
        prompt: 'CHOOSE_FUSION_MONSTER',
        stage: 'fusion',
        options: options,
        min: 1,
        max: 1,
        resume: FX.makeResume(state, step, ctx)
      });
      return;
    }

    const chosenFusion = selectedEntry.fusion;
    const pool = selectedEntry.pool;
    const validCombos = selectedEntry.combos;

    const candidatePool = [];
    const usedUids = new Set();
    for (const combo of validCombos) {
      for (const item of combo) {
        if (!usedUids.has(item.inst.uid)) {
          usedUids.add(item.inst.uid);
          candidatePool.push(item);
        }
      }
    }

    const uidToIndex = new Map();
    candidatePool.forEach((item, idx) => uidToIndex.set(item.inst.uid, idx));
    const comboIndices = validCombos.map(combo => combo.map(item => uidToIndex.get(item.inst.uid)).sort((a, b) => a - b));

    let chosenCombo = null;

    const promptMaterials = !autoChoose && ((state.config && state.config.interactiveFusion) ? true : validCombos.length > 1);
    if (ctx._fusionData && ctx._fusionData.stage === 'materials') {
      const chosenIndices = ctx._stepChoice;
      delete ctx._stepChoice;
      delete ctx._fusionData;
      if (Array.isArray(chosenIndices)) {
        const pickedItems = chosenIndices.map(i => candidatePool[i]).filter(Boolean);
        const pickedUids = new Set(pickedItems.map(it => it.inst.uid));
        chosenCombo = validCombos.find(combo => {
          return combo.length === pickedItems.length && combo.every(it => pickedUids.has(it.inst.uid));
        });
      }
      if (!chosenCombo) chosenCombo = validCombos[0];
    } else if (!promptMaterials || autoChoose) {
      chosenCombo = validCombos[0];
    } else {
      const options = candidatePool.map((item, idx) => {
        const cDef = E.cardOf(item.inst) || {};
        return {
          uid: item.inst.uid,
          cardId: item.inst.cardId,
          name: cDef.name || item.inst.cardId,
          level: item.inst.level !== undefined ? item.inst.level : cDef.level,
          atk: cDef.atk,
          def: cDef.def,
          zone: item.zone,
          slot: item.slot,
          side: 'self',
          index: idx
        };
      });
      const K = (selectedEntry.def.materialSlots || []).length;
      ctx._fusionData = {
        stage: 'materials',
        chosenFusionUid: chosenFusion.uid
      };
      FX.openPending(state, events, {
        kind: 'chooseCards',
        player: ctx.player,
        prompt: 'CHOOSE_FUSION_MATERIALS',
        stage: 'materials',
        fusionCardId: chosenFusion.cardId,
        fusionName: selectedEntry.def.name,
        fusionMaterials: selectedEntry.def.materials,
        fusionDef: {
          id: selectedEntry.def.id,
          name: selectedEntry.def.name,
          level: selectedEntry.def.level,
          atk: selectedEntry.def.atk,
          def: selectedEntry.def.def,
          materials: selectedEntry.def.materials
        },
        sendTo: step.sendTo || 'grave',
        validCombos: comboIndices,
        options: options,
        min: K,
        max: K,
        resume: FX.makeResume(state, step, ctx)
      });
      return;
    }

    // 2. Send chosen materials to grave (or destZone)
    const destZone = step.sendTo || 'grave';
    for (const item of chosenCombo) {
      if (item.zone === 'monster') {
        E.leaveField(state, events, ctx.player, item.slot, destZone);
      } else if (item.zone === 'hand') {
        const hIdx = p.hand.findIndex(c => c.uid === item.inst.uid);
        if (hIdx >= 0) {
          const c = p.hand.splice(hIdx, 1)[0];
          E.resetInstance(c);
          p[destZone].push(c);
          events.push({ type: 'moveCard', uid: c.uid, from: 'hand', to: destZone, player: ctx.player, slot: hIdx });
          if (destZone === 'grave') E.fire(state, events, 'onSentToGrave', { source: c });
        }
      } else if (item.zone === 'grave') {
        const gIdx = p.grave.findIndex(c => c.uid === item.inst.uid);
        if (gIdx >= 0) {
          const c = p.grave.splice(gIdx, 1)[0];
          E.resetInstance(c);
          p[destZone].push(c);
          events.push({ type: 'moveCard', uid: c.uid, from: 'grave', to: destZone, player: ctx.player, slot: gIdx });
        }
      }
    }

    // 3. Determine free monster slots
    const freeSlots = [];
    const maxSlots = (state.config && state.config.monsterSlots) || p.monsters.length;
    for (let s = 0; s < maxSlots; s++) if (!p.monsters[s]) freeSlots.push(s);
    if (freeSlots.length === 0) return;

    if (freeSlots.length === 1 || autoChoose) {
      const chosenSlot = freeSlots[0];
      const exIdx = p.extra.findIndex(c => c.uid === chosenFusion.uid);
      if (exIdx >= 0) p.extra.splice(exIdx, 1);
      E.placeMonster(state, events, ctx.player, chosenFusion, chosenSlot, { how: 'fusion', from: 'extra', faceDown: false });
      E.refreshAuras(state);
      if (state.config && state.config.chainMode) {
        E.openWindow(state, events, { kind: 'summon', uid: chosenFusion.uid, how: 'fusion' });
      }
      return;
    }

    const slotOptions = freeSlots.map((slot, idx) => ({
      slot: slot,
      index: idx
    }));
    ctx._fusionData = {
      stage: 'slot',
      chosenFusionUid: chosenFusion.uid
    };
    FX.openPending(state, events, {
      kind: 'chooseSlot',
      player: ctx.player,
      prompt: 'CHOOSE_FUSION_SLOT',
      stage: 'slot',
      fusionCardId: chosenFusion.cardId,
      fusionName: selectedEntry.def.name,
      options: slotOptions,
      min: 1,
      max: 1,
      resume: FX.makeResume(state, step, ctx)
    });
  });
})();

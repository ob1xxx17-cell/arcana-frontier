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

  // "self" หรือ selector {side, zone, filter, count} (choose:"player" ยังไม่มี pending จึงเลือกตัวแรกที่ตรง)
  function resolveTargets(state, target, ctx, defaultZone) {
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
    list = FX.refine(list.filter(l => matches(l.inst, target.filter, ctx)), target, ctx, l => l.inst);
    return list.slice(0, target.count === undefined ? list.length : target.count);
  }

  // ---- search {from, filter, to, count} : ย้ายจากเด็ค/สุสาน/removed เข้ามือ (ไม่ใช่การจั่ว จึงไม่ได้มานา) ----
  reg('search', function (state, events, step, ctx) {
    const E = eng();
    const p = state.players[ctx.player];
    const from = step.from || 'deck', to = step.to || 'hand';
    if (!Array.isArray(p[from]) || !Array.isArray(p[to]) || from === to) return;
    const want = step.count === undefined ? 1 : step.count;
    // distinctName:true = ได้ใบละชื่อไม่ซ้ำกัน (ไม่ครบจำนวนก็เอาเท่าที่มี)
    const uids = [], names = new Set();
    for (const c of p[from]) {
      if (uids.length >= want) break;
      if (!matches(c, step.filter, ctx)) continue;
      if (step.distinctName) { const nm = (E.cardOf(c) || {}).name || c.cardId; if (names.has(nm)) continue; names.add(nm); }
      uids.push(c.uid);
    }
    for (const uid of uids) {
      const i = p[from].findIndex(c => c.uid === uid);
      if (i < 0) continue;
      const inst = p[from].splice(i, 1)[0];
      E.resetInstance(inst);
      p[to].push(inst);
      events.push({ type: 'moveCard', uid, from, to, player: ctx.player, slot: i, how: 'search' });
    }
  });

  // ---- specialSummon {from, filter, count, slot?, faceDown?} : เรียกพิเศษ ไม่แตะโควตาลงปกติ ช่องเต็มเรียกไม่ได้ ----
  reg('specialSummon', function (state, events, step, ctx) {
    const E = eng();
    const p = state.players[ctx.player];
    const slots = (state.config && state.config.monsterSlots) || p.monsters.length;
    const firstFree = () => { for (let s = 0; s < slots; s++) if (!p.monsters[s]) return s; return -1; };
    const want = step.count === undefined ? 1 : step.count;
    let done = 0;
    for (const z of [].concat(step.from || ['hand'])) {
      if (!Array.isArray(p[z])) continue;
      // self:true = เรียกตัวเองที่ (ctx.source) อยู่ในโซนนั้น (เช่น ทิโรจากมือ) แทนการหาตามตัวกรอง
      const uids = step.self ? p[z].filter(c => ctx.source && c.uid === ctx.source.uid).map(c => c.uid)
        : p[z].filter(c => matches(c, step.filter, ctx)).map(c => c.uid);
      for (const uid of uids) {
        if (done >= want || state.ended) return;
        const inst = p[z].find(c => c.uid === uid);
        if (!inst) continue;
        const slot = (step.slot !== undefined && done === 0) ? step.slot : firstFree();
        if (slot < 0) return;                       // ช่องเต็ม: เรียกเพิ่มไม่ได้
        const err = E.specialSummon(state, events, ctx.player, inst, slot, z, !!step.faceDown);
        if (err === 'SLOT_FULL' || err === 'INVALID_SLOT') return;
        if (err) continue;                          // เช่น GRADE4_LIMIT ข้ามตัวนี้ไปตัวถัดไป
        done++;
      }
    }
  });

  // ---- ย้ายออกจากสนาม/โซนอื่นไปปลายทาง: returnToHand | returnToDeck | banish ----
  // มอนสเตอร์ที่มีตัวซ้อนข้างใต้ (under): ตัวใต้ไปปลายทางเดียวกันทั้งกอง แล้วคืนค่าเป็นการ์ดเปล่า
  function moveTo(dest, step, state, events, ctx) {
    const E = eng();
    const uids = resolveTargets(state, step.target, ctx, 'monster').map(l => l.inst.uid);
    for (const uid of uids) {
      if (state.ended) break;
      const loc = locate(state, uid);
      if (!loc || loc.zone === dest) continue;
      const p = state.players[loc.owner];
      if (loc.zone === 'monster') p.monsters[loc.slot] = null;
      else if (loc.zone === 'spell') p.spells[loc.slot] = null;
      else if (loc.zone === 'field') p.fieldSpell = null;
      else p[loc.zone].splice(loc.slot, 1);
      const pack = [loc.inst].concat(loc.inst.under || []);
      for (const c of pack) {
        E.resetInstance(c);
        const o = state.players[c.owner];
        o[dest] = o[dest] || [];
        if (dest === 'deck' && step.position === 'top') o.deck.unshift(c); else o[dest].push(c);   // ค่าเริ่มต้นคืนใต้เด็ค
        events.push({ type: 'moveCard', uid: c.uid, from: c === loc.inst ? loc.zone : 'under', to: dest, player: loc.owner, slot: loc.slot });
      }
    }
  }
  reg('returnToHand', (state, events, step, ctx) => moveTo('hand', step, state, events, ctx));
  reg('returnToDeck', (state, events, step, ctx) => moveTo('deck', step, state, events, ctx));
  reg('banish', (state, events, step, ctx) => moveTo('removed', step, state, events, ctx));
})();

// engine/core.js - พื้นฐานร่วมของ engine (ขั้น 2): config, rng, ตัวช่วย state, cloneState
// ตรรกะล้วน ไม่มี DOM/setTimeout ไม่เรียกโมดูลอื่นตอนโหลดไฟล์
(function () {
  const CG = (globalThis.CG = globalThis.CG || {});
  CG.engine = CG.engine || {};
  const E = CG.engine;
  E.hooks = E.hooks || {};            // จุดต่อของขั้น 4-6 (เช่น E.hooks.priorityWindow)
  // ยิง trigger ของเอฟเฟกต์ (ตัวจริงอยู่ engine/effectBridge.js) ข้ามเงียบถ้ายังไม่ได้โหลด effects/
  E.fire = E.fire || function (state, events, trigger, ctx) { const F = CG.effects && CG.effects.fire; if (F) F(state, events, trigger, ctx); };
  E.pendingHandlers = E.pendingHandlers || {}; // ขั้น 5 ลงทะเบียนตัวจัดการ pending.kind ของตัวเอง

  // ---- config (ค่าเริ่มต้นอยู่ที่นี่ที่เดียว ตรงกับ CONTRACT ข้อ 1) ----
  const DEFAULT_CONFIG = {
    startLp: 8000, startMana: 5, startHand: 5, handLimit: 7, mulliganCount: 1,
    firstTurnNoAttack: true, monsterSlots: 5, spellSlots: 5, maxCopies: 3,
    extraSize: { fusion: 10, grade4: 10 }, tiebreakTurn: 50,
    damageStepAllowSpeed2: true, chainTimeoutSec: null, stackMaxLayers: null,
    overlayDestroyTogether: true, autoChoose: true, chainMode: false
  };
  E.mergeConfig = function (over) {
    const c = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    for (const k of Object.keys(over || {})) {
      if (c[k] && typeof c[k] === 'object' && over[k] && typeof over[k] === 'object') Object.assign(c[k], over[k]);
      else c[k] = over[k];
    }
    return c;
  };

  // ---- rng แบบกำหนด seed (mulberry32) state อยู่ใน rng.s เพื่อ clone ได้ ----
  function rngNext() {
    this.s = (this.s + 0x6D2B79F5) | 0;
    let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  E.makeRng = function (seed, s) {
    const sd = seed === undefined || seed === null ? 1 : seed;
    return { seed: sd, s: s === undefined ? (Number(sd) | 0) : s, next: rngNext };
  };
  E.shuffle = function (arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };

  // ---- ค้นข้อมูลการ์ดจาก CG.cards (id ไม่ซ้ำทั้งเกม) ----
  let cache = null, cacheN = -1;
  function buildIndex() {
    const idx = {}; const decks = CG.cards || {};
    for (const k of Object.keys(decks)) for (const c of (decks[k].main || []).concat(decks[k].extra || []).concat(decks[k].rarePool || [])) idx[c.id] = c;
    cache = idx; cacheN = Object.keys(decks).length;
  }
  E.findCard = function (id) {
    if (!cache || cacheN !== Object.keys(CG.cards || {}).length) buildIndex();
    if (!cache[id]) buildIndex();
    return cache[id] || null;
  };
  E.cardOf = function (inst) { return inst ? E.findCard(inst.cardId || inst.id) : null; };

  // ---- CardInstance ----
  E.newInstance = function (state, def, ownerIdx) {
    const mon = def.type !== 'spell';
    return {
      uid: state.nextUid++, cardId: def.id, owner: ownerIdx, controller: ownerIdx,
      faceDown: false, position: 'atk',
      level: mon ? def.level : null, baseAtk: mon ? def.atk : null, baseDef: mon ? def.def : null,
      atkMod: 0, defMod: 0, tempAtkMod: 0, tempDefMod: 0, under: [],
      flags: { summonedTurn: null, canAttack: true, attackedThisTurn: false, positionChangedThisTurn: false, setTurn: null }
    };
  };
  E.resetInstance = function (inst) {
    const def = E.cardOf(inst);
    inst.controller = inst.owner; inst.faceDown = false; inst.position = 'atk';
    if (def && def.type !== 'spell') { inst.level = def.level; inst.baseAtk = def.atk; inst.baseDef = def.def; }
    inst.atkMod = inst.defMod = inst.tempAtkMod = inst.tempDefMod = 0;
    delete inst.auraAtk; delete inst.auraDef;   // aura ผูกกับการอยู่บนสนาม ออกจากสนามแล้วหาย
    delete inst.extraAttacks; delete inst.extraAttacksTurn;
    delete inst.attacksThisTurn; delete inst.attacksTurn;
    delete inst.restrictAttack; delete inst.tempRestrictAttack;
    delete inst.cannotAttack; delete inst.tempCannotAttackTurn; delete inst.cannotAttackWhileSource;
    inst.under = [];
    inst.flags = { summonedTurn: null, canAttack: true, attackedThisTurn: false, positionChangedThisTurn: false, setTurn: null };
  };
  // auraAtk/auraDef = ค่าจาก continuous aura (4E-2B) คำนวณใหม่โดย CG.effects.refreshAuras ไม่ใช่ค่าถาวร (ไม่มีฟิลด์ = 0)
  E.atk = function (m) { return Math.max(0, m.baseAtk + m.atkMod + m.tempAtkMod + (m.auraAtk || 0)); };
  E.def = function (m) { return Math.max(0, m.baseDef + m.defMod + m.tempDefMod + (m.auraDef || 0)); };
  // คำนวณ aura ใหม่ (ข้ามเงียบถ้ายังไม่ได้โหลด effects/)
  E.refreshAuras = function (state) { const F = CG.effects && CG.effects.refreshAuras; if (F) F(state); };
  // ตรวจว่ามอนสเตอร์ติดสถานะ restrictAttack หรือไม่ (4E-2C-1)
  E.isRestrictedTarget = function (state, m) {
    if (!m || m.faceDown) return false;
    if (m.restrictAttack) return true;
    if (m.tempRestrictAttack && m.tempRestrictAttack === state.turn) return true;
    const def = E.cardOf(m);
    if (!def || !def.effects) return false;
    for (const eff of def.effects) {
      if (eff.trigger !== 'continuous') continue;
      const s = (eff.do || []).find(x => x.op === 'restrictAttack');
      if (!s) continue;
      const ctx = { source: m, player: m.controller };
      const FX = CG.effects;
      if (!eff.condition || (FX && FX.conditions && eff.condition.every(k => FX.conditions[k.op] && FX.conditions[k.op](state, k, ctx)))) {
        return true;
      }
    }
    return false;
  };

  // 4E-4: ตรวจสอบว่ามอนสเตอร์สามารถประกาศโจมตีได้หรือไม่ (รวมทั้ง duration: endTurn, permanent, whileSource และ continuous aura)
  E.canMonsterAttack = function (state, m) {
    if (!m || m.faceDown) return false;
    if (m.flags && !m.flags.canAttack) return false;
    if (m.cannotAttack) return false;
    if (m.tempCannotAttackTurn === state.turn) return false;
    if (m.cannotAttackWhileSource) {
      let srcOnField = false;
      for (const p of state.players) {
        for (const f of p.monsters) {
          if (f && f.uid === m.cannotAttackWhileSource && !f.faceDown) { srcOnField = true; break; }
        }
      }
      if (srcOnField) return false;
    }
    // ตรวจสอบ continuous effect ที่มี op: 'cannotAttack'
    const FX = CG.effects;
    if (FX && FX.fieldInsts) {
      for (const holder of FX.fieldInsts(state)) {
        const def = E.cardOf(holder);
        if (!def || !def.effects) continue;
        for (const eff of def.effects) {
          if (eff.trigger !== 'continuous') continue;
          const steps = (eff.do || []).filter(s => s.op === 'cannotAttack');
          if (!steps.length) continue;
          const hctx = { source: holder, player: holder.controller };
          if (eff.condition && !eff.condition.every(c => FX.conditions[c.op] && FX.conditions[c.op](state, c, hctx))) continue;
          for (const s of steps) {
            if (s.target === 'self') {
              if (m.uid === holder.uid) return false;
            } else if (s.target && typeof s.target === 'object') {
              const t = s.target;
              if (t.other && m.uid === holder.uid) continue;
              if (t.side === 'opp' && m.controller === holder.controller) continue;
              if (t.side === 'self' && m.controller !== holder.controller) continue;
              if (t.zone && t.zone !== 'monster') continue;
              if (t.filter) {
                if (t.filter.atkBelowSource) {
                  if (!(E.atk(m) < E.atk(holder))) continue;
                }
                if (!FX.matchFilter(m, t.filter, hctx)) continue;
              }
              return false;
            }
          }
        }
      }
    }
    return true;
  };

  // ---- ตัวช่วย state ----
  E.setPhase = function (state, events, phase) {
    state.phase = phase;
    events.push({ type: 'phaseChange', phase, turn: state.turn, activeIdx: state.activeIdx });
  };
  // หน้าต่างตอบโต้ (priority window): ขั้น 2 ไม่มีลิงก์ใน Chain จึงข้ามอัตโนมัติ
  // ขั้น 5 ตั้ง E.hooks.priorityWindow(state, events, ctx) คืน true ถ้าเปิด pending แล้วหยุดรอ
  E.openWindow = function (state, events, ctx) {
    const h = E.hooks.priorityWindow || (state.config && state.config.chainMode ? E.chainPriorityWindow : null);
    return h ? !!h(state, events, ctx) : false;
  };
  // จั่ว (ได้มานา +1 ต่อใบ) บนสุดของเด็ค = deck[0] เด็คหมดจั่วไม่ได้ ไม่ได้มานา
  E.drawCard = function (state, events, pIdx, withMana) {
    const p = state.players[pIdx];
    if (!p.deck.length) return null;
    const c = p.deck.shift(); p.hand.push(c);
    events.push({ type: 'draw', player: pIdx, uid: c.uid });
    if (withMana) { p.mana += 1; events.push({ type: 'manaChange', player: pIdx, delta: 1, reason: 'draw' }); }
    return c;
  };
  E.endGame = function (state, events, winner, reason) {
    if (state.ended) return;
    state.ended = true; state.winner = winner; state.pending = null; state.chain = [];
    events.push({ type: 'gameEnd', winner, reason });
  };
  E.changeLp = function (state, events, pIdx, delta, reason) {
    const p = state.players[pIdx];
    const applied = Math.max(delta, -p.lp);   // LP ไม่ต่ำกว่า 0
    p.lp += applied;
    events.push({ type: 'lpChange', player: pIdx, delta: applied, reason });
    E.checkLpEnd(state, events);
    return applied;
  };
  E.checkLpEnd = function (state, events) {
    if (state.ended) return;
    const a = state.players[0].lp <= 0, b = state.players[1].lp <= 0;
    if (a && b) E.endGame(state, events, 'draw', 'lp');
    else if (a) E.endGame(state, events, 1, 'lp');
    else if (b) E.endGame(state, events, 0, 'lp');
  };
  // นำมอนสเตอร์ออกจากสนาม dest: grave | extra | removed (การ์ดใต้ตัวมันไปสุสานเสมอ ยกเว้น opt.keepUnder)
  E.leaveField = function (state, events, pIdx, slot, dest, opt) {
    opt = opt || {};
    const p = state.players[pIdx]; const m = p.monsters[slot];
    if (!m) return null;
    p.monsters[slot] = null;
    const unders = (m.under || []).slice();
    const moved = [];
    const put = (inst, d) => {
      E.resetInstance(inst);
      const idef = E.cardOf(inst);
      if ((d === 'hand' || d === 'deck') && idef && (idef.type === 'fusion' || idef.type === 'grade4')) {
        d = 'extra';
      }
      state.players[inst.owner][d].push(inst);
      events.push({ type: 'moveCard', uid: inst.uid, from: 'monster', to: d, player: pIdx, slot });
      if (d === 'grave') moved.push(inst);
    };
    m.under = [];
    put(m, dest);

    if (opt.keepUnder && unders.length > 0) {
      // ตัวใต้ที่อยู่ติดใต้ตัวบนขึ้นมาเป็นตัวบนใหม่ในช่องเดิม (ตัวอื่นที่เหลือยังอยู่ใต้มันตามลำดับเดิม)
      const newTop = unders.pop();
      newTop.under = unders;
      newTop.position = m.position || 'atk';
      newTop.faceDown = false;
      const topDef = E.cardOf(newTop);
      newTop.level = (topDef && topDef.level) || newTop.level;
      newTop.baseAtk = (topDef && topDef.atk) !== undefined ? topDef.atk : newTop.baseAtk;
      newTop.baseDef = (topDef && topDef.def) !== undefined ? topDef.def : newTop.baseDef;
      newTop.atkMod = 0;
      newTop.defMod = 0;
      newTop.tempAtkMod = 0;
      newTop.tempDefMod = 0;
      newTop.controller = pIdx;
      p.monsters[slot] = newTop;
    } else {
      unders.forEach(u => put(u, 'grave'));
    }

    E.refreshAuras(state);   // ต้นทาง aura ออกจากสนามแล้ว ค่า aura ต้องหายก่อนยิง trigger ต่อ
    moved.forEach(inst => E.fire(state, events, 'onSentToGrave', { source: inst }));   // ยิงหลังย้ายครบทุกใบ
    return m;
  };

  // 6C: ตรวจสอบความต้านทาน (immunity) ของมอนสเตอร์
  E.isImmuneTo = function (inst, ctx) {
    if (!inst || !ctx) return false;
    if (inst.faceDown) return false;
    const def = E.cardOf(inst);
    if (!def) return false;
    let immuneSpec = def.immune || inst.immune;
    if (!immuneSpec && def.effects) {
      const eff = def.effects.find(e => e.trigger === 'continuous' && e.immune);
      if (eff) immuneSpec = eff.immune;
    }
    if (!immuneSpec) return false;
    if (immuneSpec.source === 'spell') {
      let src = ctx.source;
      let sDef = src ? E.cardOf(src) : null;
      if (sDef && sDef.type === 'spell') return true;
      if (ctx.effect && ctx.effect.type === 'spell') return true;
      if (ctx.isSpell) return true;
    }
    return false;
  };
  // 6D: ตรวจหา preventDestruction และเงื่อนไข cause (battle / effect)
  E.getDestructionPreventer = function (state, inst, cause) {
    if (!inst || inst.faceDown) return null;
    const def = E.cardOf(inst) || {};
    const FX = CG.effects;
    for (const e of def.effects || []) {
      if (e.trigger !== 'continuous') continue;
      const s = (e.do || []).find(x => x.op === 'preventDestruction' || x.op === 'battleProtection');
      if (!s) continue;
      const c = { source: inst, player: inst.controller, cause: cause || 'effect' };
      const conds = (s.condition || []).concat(e.condition || []);
      const ok = conds.every(k => {
        if (!FX || !FX.conditions || !FX.conditions[k.op]) return false;
        return FX.conditions[k.op](state, k, c);
      });
      if (ok) return s;
    }
    return null;
  };

  // ทำลายมอนสเตอร์ (ข้อ 1 overlayDestroyTogether: ตัวใต้ถูกทำลายด้วยนับเป็นหน่วยเดียว)
  // 6D: ตรวจ preventDestruction ทุกเส้นทาง คืน true หากถูกทำลาย หรือ false หากถูกกันไว้
  E.destroyMonster = function (state, events, pIdx, slot, by) {
    const m = state.players[pIdx].monsters[slot];
    if (!m) return false;
    const prev = E.getDestructionPreventer(state, m, by);
    if (prev) {
      events.push({ type: 'destroyPrevented', uid: m.uid });
      const sub = Array.isArray(prev.instead) ? prev.instead : [];
      const FX = CG.effects;
      for (const s of sub) {
        if (FX && FX.ops && FX.ops[s.op]) {
          FX.ops[s.op](state, events, s, { player: pIdx, source: m });
        }
      }
      return false;
    }
    const def = E.cardOf(m);
    const unders = (state.config.overlayDestroyTogether && Array.isArray(m.under)) ? m.under.slice() : [];
    events.push({ type: 'destroy', uid: m.uid, by });
    unders.forEach(u => events.push({ type: 'destroy', uid: u.uid, by }));
    E.leaveField(state, events, pIdx, slot, def && def.type === 'grade4' ? 'extra' : 'grave');
    E.fire(state, events, 'onDestroyed', { source: m, by });
    unders.forEach(u => E.fire(state, events, 'onDestroyed', { source: u, by }));
    if (state.config && state.config.chainMode) {
      if (state._isResolvingEffect) {
        state._deferredWindows = state._deferredWindows || [];
        state._deferredWindows.push({ kind: 'monsterDestroyed', uid: m.uid, card: m, destroyedCard: m, destroyedOwner: pIdx, owner: pIdx, by });
      } else {
        E.openWindow(state, events, { kind: 'monsterDestroyed', uid: m.uid, card: m, destroyedCard: m, destroyedOwner: pIdx, owner: pIdx, by });
      }
    }
    return true;
  };
  E.boardCount = function (p) {
    return p.monsters.filter(Boolean).length + p.spells.filter(Boolean).length + (p.fieldSpell ? 1 : 0);
  };

  // ---- cloneState: สำเนาลึก (log แชร์ event ที่ไม่เปลี่ยนแปลงเพื่อความเร็วของบอท) ----
  E.cloneState = function (state) {
    const { rng, log, ...rest } = state;
    const c = JSON.parse(JSON.stringify(rest));
    c.log = log.slice();
    c.rng = E.makeRng(rng.seed, rng.s);
    return c;
  };
})();

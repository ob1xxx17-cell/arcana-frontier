// bot/bot.js - โมดูลตัดสินใจของบอท (CONTRACT ข้อ 10/12)
// ฟังก์ชันตัดสินใจต้องบริสุทธิ์: ไม่แตะ DOM, ไม่ใช้ Math.random(), ไม่แก้ state
(function () {
  const CG = (globalThis.CG = globalThis.CG || {});
  CG.bot = CG.bot || {};
  const E = () => CG.engine;

  /**
   * ฟังก์ชันตัดสินใจหลักของบอท
   * @param {Object} st - สถานะเกมปัจจุบัน (ห้ามแก้ไข)
   * @param {number} idx - ผู้เล่นที่ต้องลงมือ (0 หรือ 1)
   * @param {Array} legal - รายการ action ที่ทำได้ตามกฎ (จาก E.getLegalActions)
   * @param {Object} [options] - ตัวเลือก เช่น { level: 'easy' | 'normal' }
   * @returns {Object} action ที่บอทเลือก
   */
  function choose(st, idx, legal, options) {
    if (!legal || !legal.length) return null;
    options = options || {};
    const level = options.level || 'easy';

    switch (level) {
      case 'normal':
        return chooseNormal(st, idx, legal);
      case 'easy':
      default:
        return chooseEasy(st, idx, legal);
    }
  }

  // ---------------- ระดับ easy: ตรรกะบอทเดิมของเกม (heuristic 7A) ----------------
  function chooseEasy(st, idx, legal) {
    const by = (t) => legal.filter(x => x.type === t);
    const cardLv = (a) => E().cardOf(st.players[idx].hand[a.handIdx]) || {};

    if (st.phase === 'mulligan') return by('pass')[0] || legal[0];

    // Chain window - bot logic
    if (st.pending && st.pending.kind === 'chainWindow') {
      const pass = by('passPriority');
      const resp = by('activateResponse');
      if (resp.length > 0) return resp[0];
      return pass[0] || legal[0];
    }

    // Pending with resume
    if (st.pending && st.pending.resume) {
      const pd = st.pending;
      const respond = (choice) => ({ type: 'respond', player: idx, choice });

      if (pd.kind === 'chooseOption' || pd.kind === 'yesNo') {
        return respond([0]);
      }

      if (pd.kind === 'chooseSlot') {
        return respond([0]);
      }

      const opts = pd.options || [];
      const count = pd.min;

      if (opts.length <= count) {
        const all = [];
        for (let i = 0; i < opts.length; i++) all.push(i);
        return respond(all);
      }

      const oppIndices = [], selfIndices = [];
      for (let i = 0; i < opts.length; i++) {
        if (opts[i].side === 'opp') oppIndices.push(i);
        else selfIndices.push(i);
      }

      const prompt = (pd.prompt || '').toUpperCase();
      const isDestroy = prompt.includes('DESTROY') || prompt.includes('TARGET');
      const isSelf = prompt.includes('TRIBUTE') || prompt.includes('COST') || prompt.includes('SEND') || prompt.includes('MATERIAL');
      const isSearch = prompt.includes('SEARCH') || prompt.includes('SUMMON') || prompt.includes('CARDS') || prompt.includes('FUSION') || prompt.includes('EXTRA');

      let selected = [];
      if (isDestroy && oppIndices.length >= count) {
        const sorted = oppIndices.slice().sort((a, b) => {
          const da = E().findCard(opts[a].cardId), db = E().findCard(opts[b].cardId);
          return ((db && db.atk) || 0) - ((da && da.atk) || 0);
        });
        selected = sorted.slice(0, count);
      } else if (isSelf && selfIndices.length >= count) {
        const sorted = selfIndices.slice().sort((a, b) => {
          const da = E().findCard(opts[a].cardId), db = E().findCard(opts[b].cardId);
          return ((da && da.atk) || 0) - ((db && db.atk) || 0);
        });
        selected = sorted.slice(0, count);
      } else if (isSearch) {
        const sorted = opts.map((_, i) => i).sort((a, b) => {
          const da = E().findCard(opts[a].cardId), db = E().findCard(opts[b].cardId);
          return ((db && db.atk) || 0) - ((da && da.atk) || 0);
        });
        selected = sorted.slice(0, count);
      }

      if (selected.length < count) {
        selected = [];
        for (let i = 0; i < count && i < opts.length; i++) selected.push(i);
      }

      return respond(selected.sort((a, b) => a - b));
    }

    if (st.pending) {
      const r = by('respond');
      return r[0] || legal[0];
    }

    const me = st.players[idx], op = st.players[1 - idx];

    const setSpells = by('setSpell').filter(a => {
      const def = E().cardOf(me.hand[a.handIdx]);
      return def && def.group === 'set';
    });
    if (setSpells.length > 0) return setSpells[0];

    const actSpells = by('activateSpell').filter(a => {
      const def = a.handIdx !== undefined ? E().cardOf(me.hand[a.handIdx]) : (a.spellSlot !== undefined ? E().cardOf(me.spells[a.spellSlot]) : null);
      return def && def.effects && def.effects.length > 0 && (def.group === 'normal' || a.spellSlot !== undefined);
    });
    if (actSpells.length > 0) return actSpells[0];

    const ov = by('overlay');
    if (ov.length > 0) return ov[0];

    const exs = by('extraSummon');
    if (exs.length > 0) return exs[0];

    const sum = by('tributeSummon').sort((x, y) => (cardLv(y).level || 0) - (cardLv(x).level || 0) || (cardLv(y).atk || 0) - (cardLv(x).atk || 0))
      .filter(x => x.materials.length <= 2);
    if (sum.length) return sum[0];
    const ns = by('normalSummon').sort((x, y) => (cardLv(y).atk || 0) - (cardLv(x).atk || 0));
    if (ns.length) return ns.sort((x, y) => Math.abs(x.slot - 2) - Math.abs(y.slot - 2))[0];
    const fl = by('flipSummon'); if (fl.length) return fl[0];
    if (st.phase === 'battle') {
      const at = by('attack').filter(x => {
        const m = me.monsters[x.from]; if (x.to === null) return true;
        const t = op.monsters[x.to]; if (t.faceDown) return true;
        return E().atk(m) > (t.position === 'atk' ? E().atk(t) : E().def(t));
      });
      if (at.length) return at[0];
    }

    const actEff = by('activateEffect');
    if (actEff.length > 0) return actEff[0];

    return by('advancePhase')[0] || by('endTurn')[0] || legal[0];
  }

  // ---------------- ระดับ normal: ประเมินแบบกำหนดแน่นอน (Heuristics 7B) ----------------
  function chooseNormal(st, idx, legal) {
    const by = (t) => legal.filter(x => x.type === t);
    const E_ = E();
    const me = st.players[idx], op = st.players[1 - idx];
    const cardLv = (a) => E_.cardOf(me.hand[a.handIdx]) || {};

    // 0. Mulligan: เก็บมือไว้เป็นพื้นฐาน
    if (st.phase === 'mulligan') {
      return by('pass')[0] || legal[0];
    }

    // 4. หมอบรอ/สวนกลับ: Chain Window
    if (st.pending && st.pending.kind === 'chainWindow') {
      const passAct = by('passPriority')[0] || by('pass')[0] || legal[0];
      const respActs = by('activateResponse');
      if (respActs.length === 0) return passAct;

      let shouldRespond = false;

      // (ก) ลิงก์ของศัตรูเลือกมอนสเตอร์เราเป็นเป้า ทำลาย หรือขึ้นมือ
      const topLink = st.chain && st.chain.length > 0 ? st.chain[st.chain.length - 1] : null;
      if (topLink && topLink.controller !== idx) {
        if (topLink.targets && topLink.targets.some(uid => me.monsters.some(m => m && m.uid === uid))) {
          shouldRespond = true;
        }
        const topDef = E_.findCard ? E_.findCard(topLink.cardId) : null;
        if (topDef && topDef.effects) {
          const eff = topDef.effects.find(e => e.id === topLink.effectId) || topDef.effects[0];
          if (eff && eff.do) {
            const hasHarm = eff.do.some(d => ['destroy', 'sendToGrave', 'banish', 'returnToHand', 'damage'].includes(d.op));
            if (hasHarm) shouldRespond = true;
          }
        }
      }

      // (ข) ศัตรูโจมตีด้วยตัวที่ ATK มากกว่าตัวป้องกันของเรา หรือเสี่ยงตายถ้าไม่ตอบ
      const lastAtk = st.log && st.log.slice().reverse().find(e => e.type === 'attackDeclared');
      if (lastAtk && lastAtk.player !== idx) {
        const attacker = op.monsters[lastAtk.from];
        const attackerAtk = attacker ? E_.atk(attacker) : 0;
        if (lastAtk.to === null) {
          shouldRespond = true;
        } else {
          const defender = me.monsters[lastAtk.to];
          const defStat = defender ? (defender.position === 'atk' ? E_.atk(defender) : E_.def(defender)) : 0;
          if (attackerAtk > defStat) {
            shouldRespond = true;
          }
        }
      }

      if (shouldRespond) {
        return respActs[0];
      }
      // ไม่ตอบโต้ถ้าลิงก์ของศัตรูไม่กระทบเรา
      return passAct;
    }

    // 5. Pending with Resume
    if (st.pending && st.pending.resume) {
      const pd = st.pending;
      const respond = (choice) => ({ type: 'respond', player: idx, choice });

      if (pd.kind === 'chooseOption' || pd.kind === 'yesNo') {
        return respond([0]);
      }
      if (pd.kind === 'chooseSlot') {
        return respond([0]);
      }

      const opts = pd.options || [];
      const count = pd.min;
      if (opts.length <= count) {
        const all = [];
        for (let i = 0; i < opts.length; i++) all.push(i);
        return respond(all);
      }

      const oppIndices = [], selfIndices = [];
      for (let i = 0; i < opts.length; i++) {
        if (opts[i].side === 'opp') oppIndices.push(i);
        else selfIndices.push(i);
      }

      const prompt = (pd.prompt || '').toUpperCase();
      const isDestroy = prompt.includes('DESTROY') || prompt.includes('TARGET');
      const isSelf = prompt.includes('TRIBUTE') || prompt.includes('COST') || prompt.includes('SEND') || prompt.includes('MATERIAL');
      const isSearch = prompt.includes('SEARCH') || prompt.includes('SUMMON') || prompt.includes('CARDS') || prompt.includes('EXTRA');
      const isFusion = prompt.includes('FUSION');

      let selected = [];

      // เป้าทำลาย: ให้ ATK สูงสุดเสมอ
      if (isDestroy && oppIndices.length >= count) {
        const sorted = oppIndices.slice().sort((a, b) => {
          const da = E_.findCard ? E_.findCard(opts[a].cardId) : null;
          const db = E_.findCard ? E_.findCard(opts[b].cardId) : null;
          return ((db && db.atk) || 0) - ((da && da.atk) || 0);
        });
        selected = sorted.slice(0, count);
      } else if (isFusion && selfIndices.length >= count) {
        // Fusion: เลือกวัสดุจากมือก่อนเพื่อรักษามอนสเตอร์บนสนาม
        const sorted = selfIndices.slice().sort((a, b) => {
          const zoneA = opts[a].zone === 'hand' ? 0 : 1;
          const zoneB = opts[b].zone === 'hand' ? 0 : 1;
          if (zoneA !== zoneB) return zoneA - zoneB;
          const da = E_.findCard ? E_.findCard(opts[a].cardId) : null;
          const db = E_.findCard ? E_.findCard(opts[b].cardId) : null;
          return ((da && da.atk) || 0) - ((db && db.atk) || 0);
        });
        selected = sorted.slice(0, count);
      } else if (isSelf && selfIndices.length >= count) {
        // ต้นทุน: เสียตัวที่มีมูลค่าต่ำสุด (ATK ต่ำสุด, ไม่มีเอฟเฟกต์ใช้ซ้ำ)
        const sorted = selfIndices.slice().sort((a, b) => {
          const da = E_.findCard ? E_.findCard(opts[a].cardId) : null;
          const db = E_.findCard ? E_.findCard(opts[b].cardId) : null;
          const hasReusableA = da && da.effects && da.effects.some(e => e.trigger === 'ignition' || e.trigger === 'continuous') ? 1 : 0;
          const hasReusableB = db && db.effects && db.effects.some(e => e.trigger === 'ignition' || e.trigger === 'continuous') ? 1 : 0;
          if (hasReusableA !== hasReusableB) return hasReusableA - hasReusableB;
          return ((da && da.atk) || 0) - ((db && db.atk) || 0);
        });
        selected = sorted.slice(0, count);
      } else if (isSearch) {
        const sorted = opts.map((_, i) => i).sort((a, b) => {
          const da = E_.findCard ? E_.findCard(opts[a].cardId) : null;
          const db = E_.findCard ? E_.findCard(opts[b].cardId) : null;
          return ((db && db.atk) || 0) - ((da && da.atk) || 0);
        });
        selected = sorted.slice(0, count);
      }

      if (selected.length < count) {
        selected = [];
        for (let i = 0; i < count && i < opts.length; i++) selected.push(i);
      }

      return respond(selected.sort((a, b) => a - b));
    }

    if (st.pending) {
      return by('respond')[0] || legal[0];
    }

    // 1. Battle Phase
    if (st.phase === 'battle') {
      const attacks = by('attack');
      if (attacks.length > 0) {
        let totalAttackerAtk = 0;
        for (let s = 0; s < me.monsters.length; s++) {
          const m = me.monsters[s];
          if (m && !m.faceDown && m.position === 'atk' && (!m.flags || (m.flags.canAttack !== false && !m.flags.attackedThisTurn))) {
            totalAttackerAtk += E_.atk(m);
          }
        }
        const opMonsters = op.monsters.filter(m => m !== null);
        const isLethal = (opMonsters.length === 0 && totalAttackerAtk >= op.lp);

        const favorableAttacks = [];
        for (const act of attacks) {
          const m = me.monsters[act.from];
          const myAtk = m ? E_.atk(m) : 0;
          if (act.to === null) {
            // โจมตีตรง
            favorableAttacks.push({ act, score: 100000 + myAtk });
          } else {
            const t = op.monsters[act.to];
            if (!t) continue;
            const tAtk = E_.atk(t);
            const tDef = E_.def(t);
            if (t.faceDown) {
              if (myAtk > tDef || myAtk >= 800) {
                favorableAttacks.push({ act, score: 5000 + tAtk });
              }
            } else if (t.position === 'atk') {
              if (myAtk > tAtk) {
                const damage = myAtk - tAtk;
                const winGameScore = damage >= op.lp ? 500000 : 0;
                favorableAttacks.push({ act, score: winGameScore + 10000 + tAtk * 10 + damage });
              }
            } else if (t.position === 'def') {
              if (myAtk > tDef) {
                favorableAttacks.push({ act, score: 5000 + tAtk * 10 });
              }
            }
          }
        }

        if (isLethal) {
          const dir = attacks.find(x => x.to === null);
          if (dir) return dir;
        }

        if (favorableAttacks.length > 0) {
          favorableAttacks.sort((a, b) => b.score - a.score);
          return favorableAttacks[0].act;
        }
      }

      return by('advancePhase')[0] || by('endTurn')[0] || legal[0];
    }

    // 6. Main 2: ใช้เฉพาะเมื่อมีเหตุผล (ลงตัวป้องกันหลังโจมตี หรือหมอบสเปล)
    if (st.phase === 'main2') {
      const maxOppAtk = Math.max(0, ...op.monsters.filter(o => o && !o.faceDown).map(o => E_.atk(o)));
      const hasEmptySlot = me.monsters.some(m => m === null);

      if (maxOppAtk > 0 && hasEmptySlot) {
        const sets = by('setMonster');
        if (sets.length > 0) {
          sets.sort((x, y) => (cardLv(y).def || 0) - (cardLv(x).def || 0));
          return sets[0];
        }
      }

      const changePositions = by('changePosition');
      if (changePositions.length > 0 && maxOppAtk > 0) {
        const toDef = changePositions.find(act => {
          const m = me.monsters[act.slot];
          return m && m.position === 'atk' && !m.faceDown && E_.atk(m) < maxOppAtk;
        });
        if (toDef) return toDef;
      }

      const setSpells = by('setSpell').filter(a => {
        const def = E_.cardOf(me.hand[a.handIdx]);
        return def && def.group === 'set';
      });
      if (setSpells.length > 0) return setSpells[0];

      return by('endTurn')[0] || by('advancePhase')[0] || legal[0];
    }

    // 3. Main 1
    const actSpells = by('activateSpell');

    // 3.1 สเปล/เอฟเฟกต์ Continuous / Aura: ใช้ทันที
    const auraSpells = actSpells.filter(a => {
      const def = a.handIdx !== undefined ? E_.cardOf(me.hand[a.handIdx]) : (a.spellSlot !== undefined ? E_.cardOf(me.spells[a.spellSlot]) : null);
      if (!def || !def.effects || !def.effects.length) return false;
      const eff = def.effects[0];
      return def.field || eff.trigger === 'continuous' || (eff.do && eff.do.some(d => d.aura));
    });
    if (auraSpells.length > 0) return auraSpells[0];

    // 3.2 สเปลทำลาย: ใช้ทำลายกับมอนสเตอร์ศัตรูที่ ATK สูงสุดเสมอ และไม่ใช้ถ้าไม่มีเป้าหมายจริง
    const destroySpells = actSpells.filter(a => {
      const def = a.handIdx !== undefined ? E_.cardOf(me.hand[a.handIdx]) : (a.spellSlot !== undefined ? E_.cardOf(me.spells[a.spellSlot]) : null);
      if (!def || !def.effects || !def.effects.length) return false;
      const eff = def.effects[0];
      const isDestroy = eff.do && eff.do.some(d => d.op === 'destroy' && d.target && (d.target.side === 'opp' || d.target === 'opp'));
      if (!isDestroy) return false;
      const opMonCount = op.monsters.filter(m => m !== null).length;
      return opMonCount > 0;
    });
    if (destroySpells.length > 0) return destroySpells[0];

    // 3.3 คำนวณมานาสำรองให้การ์ดสวนกลับที่อยู่ในมือ
    // สำรองเฉพาะเมื่อมีมอนสเตอร์บนสนามที่จะปกป้อง และไม่ใช่เทิร์นที่ 1 และไม่ได้ตามหลัง (LP ตัวเอง >= LP คู่แข่ง)
    const hasMonstersOnField = me.monsters.some(m => m !== null && !m.faceDown);
    let minCounterCost = 0;
    if (hasMonstersOnField && st.turn > 1 && me.lp >= op.lp) {
      const counterCards = me.hand.filter(c => {
        const def = E_.cardOf(c);
        return def && (def.group === 'counter' || (def.effects && def.effects.some(e => e.speed === 2 || e.speed === 3)));
      });
      if (counterCards.length > 0) {
        const costs = counterCards.map(c => {
          const def = E_.cardOf(c);
          return (def.effects && def.effects[0] && def.effects[0].cost && def.effects[0].cost.mana) || parseInt(def.mana || '0', 10) || 0;
        });
        minCounterCost = Math.min(...costs);
      }
    }

    // สเปลจั่ว/ค้นหา: ใช้เมื่อมานาพอและยังเหลือมานาสำรองให้การ์ดสวนกลับ
    // สเปลจั่ว/ค้นหาที่ทำให้ได้การ์ดเพิ่ม ให้ร่ายได้เสมอถ้าเหลือมานา >= 0 ตามเดิมของ addMana
    const drawSearchSpells = actSpells.filter(a => {
      const def = a.handIdx !== undefined ? E_.cardOf(me.hand[a.handIdx]) : (a.spellSlot !== undefined ? E_.cardOf(me.spells[a.spellSlot]) : null);
      if (!def || !def.effects || !def.effects.length) return false;
      const eff = def.effects[0];
      const isDrawSearch = eff.do && eff.do.some(d => d.op === 'draw' || d.op === 'search' || d.op === 'specialSummon');
      if (!isDrawSearch) return false;
      const cost = (eff.cost && eff.cost.mana) || parseInt(def.mana || '0', 10) || 0;
      // ถ้าสเปลจั่ว/ค้นหาที่ทำให้ได้การ์ดเพิ่ม หรือให้มานาคืน ร่ายได้เสมอถ้าเหลือมานา >= 0 (me.mana >= cost)
      const givesCardsOrMana = eff.do && eff.do.some(d => d.op === 'draw' || d.op === 'search' || d.op === 'addMana');
      if (givesCardsOrMana && me.mana >= cost) return true;
      return (me.mana - cost) >= minCounterCost;
    });
    if (drawSearchSpells.length > 0) return drawSearchSpells[0];

    // สเปลปกติอื่น ๆ (เช่น dino_fusion) ไม่ใช้ถ้าไม่มีเป้าหมายจริง
    const otherNormalSpells = actSpells.filter(a => {
      const def = a.handIdx !== undefined ? E_.cardOf(me.hand[a.handIdx]) : (a.spellSlot !== undefined ? E_.cardOf(me.spells[a.spellSlot]) : null);
      if (!def || !def.effects || !def.effects.length) return false;
      const eff = def.effects[0];
      const targetsOpp = eff.do && eff.do.some(d => d.target && (d.target.side === 'opp' || d.target === 'opp'));
      if (targetsOpp && op.monsters.filter(m => m !== null).length === 0) return false;
      return def.group === 'normal' || a.spellSlot !== undefined;
    });
    if (otherNormalSpells.length > 0) return otherNormalSpells[0];

    // 3.4 การวางทับ (Overlay) / Extra Summon (Grade 4 / Hastatus)
    // ใช้เมื่อผลลัพธ์ทำให้ ATK รวมบนสนามเพิ่มขึ้น
    const overlays = by('overlay').filter(act => {
      const target = me.monsters[act.targetSlot];
      if (!target) return false;
      const oldAtk = E_.atk(target);
      const handCard = me.hand[act.handIdx];
      const def = E_.cardOf(handCard);
      const eff = def && def.effects && def.effects.find(e => e.trigger === 'overlay');
      const newAtk = (eff && eff.result && eff.result.atk) || (def && def.atk) || 2000;
      return newAtk > oldAtk;
    });
    if (overlays.length > 0) return overlays[0];

    const extraSummons = by('extraSummon').filter(act => {
      const target = me.monsters[act.targetSlot];
      if (!target) return false;
      const oldAtk = E_.atk(target);
      const exCard = me.extra[act.extraIdx];
      const def = E_.cardOf(exCard);
      const newAtk = (def && def.atk) || 0;
      return newAtk > oldAtk;
    });
    if (extraSummons.length > 0) return extraSummons[0];

    // 2. อัญเชิญ (Tribute / Normal / Set)
    // กฎ: เลือกมอนสเตอร์ที่ ATK สูงสุดที่ลงได้ เสียสละด้วยตัว ATK ต่ำสุดก่อน และไม่เสียสละถ้าตัวที่จะเรียกไม่แรงกว่าตัวที่เสียสละอย่างน้อย 400
    // ลงท่าป้องกันเมื่อ ATK น้อยกว่ามอนสเตอร์ศัตรูที่แรงสุด ลงท่าโจมตีถ้าไม่
    const maxOppAtk = Math.max(0, ...op.monsters.filter(o => o && !o.faceDown).map(o => E_.atk(o)));

    // Tribute Summons: ตัวที่จะเรียกต้องแรงกว่าตัวที่เสียสละ (ตัวที่แรงสุดในบรรดาวัสดุ) อย่างน้อย 400
    const validTributes = by('tributeSummon').filter(act => {
      const def = cardLv(act);
      const newAtk = def.atk || 0;
      const maxMatAtk = Math.max(...act.materials.map(s => me.monsters[s] ? E_.atk(me.monsters[s]) : 0));
      return (newAtk - maxMatAtk) >= 400 && act.materials.length <= 2;
    }).sort((a, b) => {
      const atkDiff = (cardLv(b).atk || 0) - (cardLv(a).atk || 0);
      if (atkDiff !== 0) return atkDiff;
      // เสียสละด้วยตัว ATK ต่ำสุดก่อน
      const matA = a.materials.reduce((sum, s) => sum + (me.monsters[s] ? E_.atk(me.monsters[s]) : 0), 0);
      const matB = b.materials.reduce((sum, s) => sum + (me.monsters[s] ? E_.atk(me.monsters[s]) : 0), 0);
      return matA - matB;
    });

    // ตรวจสอบว่าในมือหรือ Extra Deck มีการ์ดวางทับ/Extra Summon ที่พร้อมจริงตอนนี้หรือไม่
    // 1. บนสนามมีวัสดุที่การ์ด extraSummon ในมือ/Extra ต้องการอยู่แล้ว
    // 2. หรือในมือมีตัวที่ trigger 'overlay' และ LP/มานาพอ
    // อ่านเงื่อนไขจากข้อมูลการ์ดเท่านั้น ห้ามเขียนเงื่อนไขตาม card.id
    const hasReadyExtraSummon = (me.extra || []).concat(me.hand || []).some(c => {
      const def = E_.cardOf(c);
      if (!def || !def.extraSummon) return false;
      if (def.type === 'grade4' && me.flags.grade4SummonedThisTurn) return false;
      const es = def.extraSummon;
      const onto = es.onto;
      if (!onto) return false;
      return me.monsters.some(m => {
        if (!m || m.faceDown) return false;
        const underCount = m.under ? m.under.length : 0;
        if (onto.underCount !== undefined && underCount !== onto.underCount) return false;
        if (onto.under !== undefined && underCount !== onto.under) return false;
        if (onto.minUnder !== undefined && underCount < onto.minUnder) return false;
        if (onto.maxUnder !== undefined && underCount > onto.maxUnder) return false;
        if (E_.matchOverlayOnto) {
          if (!E_.matchOverlayOnto(m, onto, { source: c, player: idx })) return false;
        } else {
          const mDef = E_.cardOf(m) || {};
          if (onto.level !== undefined && mDef.level !== onto.level) return false;
          if (onto.tag) {
            const tags = [].concat(mDef.tags || mDef.tag || []);
            if (!tags.includes(onto.tag)) return false;
          }
          if (onto.type && mDef.type !== onto.type) return false;
        }
        return true;
      });
    });

    const hasReadyOverlay = (me.hand || []).some(c => {
      const def = E_.cardOf(c);
      if (!def || !def.effects) return false;
      const eff = def.effects.find(e => e.trigger === 'overlay');
      if (!eff) return false;
      const manaCost = (eff.cost && eff.cost.mana) || 0;
      const lpCost = (eff.cost && eff.cost.lp) || 0;
      return me.mana >= manaCost && me.lp >= lpCost;
    });

    const hasFollowupOverlay = hasReadyExtraSummon || hasReadyOverlay;

    // Normal / Set Summons สำหรับ Lv1
    const normals = by('normalSummon');
    const sets = by('setMonster');

    let bestLv1 = null;
    if (normals.length > 0 || sets.length > 0) {
      const lv1Hands = [];
      const seenHands = new Set();
      [...normals, ...sets].forEach(act => {
        if (!seenHands.has(act.handIdx)) {
          seenHands.add(act.handIdx);
          lv1Hands.push(act.handIdx);
        }
      });

      lv1Hands.sort((hA, hB) => (E_.cardOf(me.hand[hB])?.atk || 0) - (E_.cardOf(me.hand[hA])?.atk || 0));

      if (lv1Hands.length > 0) {
        const bestHandIdx = lv1Hands[0];
        const cardDef = E_.cardOf(me.hand[bestHandIdx]) || {};
        const cardAtk = cardDef.atk || 0;

        // ถ้ามี followup overlay หรือ cardAtk >= maxOppAtk ให้ลงท่าโจมตี
        if (cardAtk < maxOppAtk && !hasFollowupOverlay) {
          // ลงท่าป้องกัน (setMonster)
          const setActs = sets.filter(x => x.handIdx === bestHandIdx).sort((x, y) => Math.abs(x.slot - 2) - Math.abs(y.slot - 2));
          bestLv1 = setActs[0] || normals.find(x => x.handIdx === bestHandIdx);
        } else {
          // ลงท่าโจมตี (normalSummon)
          const normActs = normals.filter(x => x.handIdx === bestHandIdx).sort((x, y) => Math.abs(x.slot - 2) - Math.abs(y.slot - 2));
          bestLv1 = normActs[0] || sets.find(x => x.handIdx === bestHandIdx);
        }
      }
    }

    // เทียบกันระหว่าง Tribute กับ Normal/Set: เลือกมอนสเตอร์ที่ ATK สูงสุดที่ลงได้
    if (validTributes.length > 0 && bestLv1) {
      const tribAtk = cardLv(validTributes[0]).atk || 0;
      const lv1Atk = E_.cardOf(me.hand[bestLv1.handIdx])?.atk || 0;
      if (tribAtk >= lv1Atk) return validTributes[0];
      return bestLv1;
    } else if (validTributes.length > 0) {
      return validTributes[0];
    } else if (bestLv1) {
      return bestLv1;
    }

    // เปลี่ยนท่ามอนสเตอร์ที่ป้องกันอยู่เป็นท่าโจมตีถ้าปลอดภัย
    const changePositions = by('changePosition');
    if (changePositions.length > 0) {
      const toAtk = changePositions.find(act => {
        const m = me.monsters[act.slot];
        return m && m.position === 'def' && !m.faceDown && (E_.atk(m) >= maxOppAtk || maxOppAtk === 0);
      });
      if (toAtk) return toAtk;
    }

    // 5.6 Flip Summon
    const fl = by('flipSummon');
    if (fl.length > 0) {
      const safeFlip = fl.find(act => {
        const m = me.monsters[act.slot];
        return m && (E_.atk(m) >= maxOppAtk || maxOppAtk === 0);
      });
      if (safeFlip) return safeFlip;
    }

    // 5.7 Monster Ignition Effects (ไม่ใช้ถ้าไม่มีเป้าหมายจริง)
    const actEff = by('activateEffect').filter(act => {
      const m = act.slot !== undefined ? me.monsters[act.slot] : me.hand[act.handIdx];
      const def = m ? E_.cardOf(m) : null;
      if (!def || !def.effects) return false;
      const eff = def.effects.find(e => e.id === act.effectId);
      if (!eff) return false;
      const targetsOpp = eff.do && eff.do.some(d => d.target && (d.target.side === 'opp' || d.target === 'opp'));
      if (targetsOpp && op.monsters.filter(x => x !== null).length === 0) return false;
      return true;
    });
    if (actEff.length > 0) return actEff[0];

    // 4. หมอบรอ: หมอบสเปลคว่ำเมื่อมีช่องว่าง
    const setSpells = by('setSpell').filter(a => {
      const def = E_.cardOf(me.hand[a.handIdx]);
      return def && def.group === 'set';
    });
    if (setSpells.length > 0) return setSpells[0];

    // 6. ไม่จบเทิร์นก่อนใช้การกระทำที่ได้ประโยชน์ในเมน 1 -> advancePhase ไปต่อสู้
    return by('advancePhase')[0] || by('endTurn')[0] || legal[0];
  }

  // Exports
  CG.bot.choose = choose;
  CG.bot.chooseAction = choose;
  CG.ui = CG.ui || {};
  CG.ui.botChoose = choose;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { choose, chooseAction: choose };
  }
})();

// ui/view.js - วาดหน้าจอจาก state (อ่านอย่างเดียว) + แปล events เป็นข้อความ ไม่แก้ state เด็ดขาด
(function () {
  const CG = (globalThis.CG = globalThis.CG || {});
  CG.ui = CG.ui || {};
  const V = (CG.ui.view = {});
  const S = () => CG.ui.strings;
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  V.esc = esc;
  const def = (inst) => {
    if (!inst) return { name: '?', type: 'monster', text: '' };
    if (inst.name && (inst.type || inst.atk != null)) return inst;
    return CG.engine.cardOf(inst) || (inst.id ? CG.engine.findCard(inst.id) : null) || { name: '?', type: 'monster', text: '' };
  };
  V.def = def;

  // แผนที่ uid -> CardInstance จากทุกโซน (ใช้ตั้งชื่อใน log)
  V.uidMap = function (state) {
    const m = {};
    const add = (c) => { if (!c) return; m[c.uid] = c; (c.under || []).forEach(add); };
    state.players.forEach(p => { ['deck', 'hand', 'extra', 'grave', 'removed', 'monsters', 'spells'].forEach(z => p[z].forEach(add)); add(p.fieldSpell); });
    return m;
  };
  V.pname = (state, i) => (i === 0 ? ((CG.account && CG.account.current && CG.account.current.nickname) ? CG.account.current.nickname : S().app.p1) : (state.players && state.players[1] && state.players[1].name && state.players[1].name !== 'P2' ? state.players[1].name : (state.mode === 'bot' ? S().app.bot : S().app.p2)));

  function fill(t, o) { return t.replace(/\{(\w+)\}/g, (_, k) => (o[k] == null ? '' : o[k])); }

  // แปล event เป็นบรรทัด log (ไม่เปิดเผยการ์ดคว่ำ/มือของอีกฝ่ายถ้า viewer ไม่ใช่เจ้าของ)
  V.eventText = function (state, ev, viewer, map) {
    const s = S(), e = s.ev;
    const nm = (uid) => { const c = map[uid]; return c ? def(c).name : '?'; };
    const P = (i) => V.pname(state, i);
    switch (ev.type) {
      case 'draw': { const c = map[ev.uid]; return c && c.owner === viewer ? fill(e.drawKnown, { p: P(ev.player), c: nm(ev.uid) }) : fill(e.draw, { p: P(ev.player) }); }
      case 'manaChange': return fill(e.manaChange, { p: P(ev.player), mana: s.term.mana, d: (ev.delta > 0 ? '+' : '') + ev.delta, r: s.reason[ev.reason] || ev.reason });
      case 'summon': {
        const c = map[ev.uid], hide = ev.how === 'set' && c && c.owner !== viewer;
        return fill(hide ? e.summonHidden : e.summon, { p: P(ev.player), how: s.how[ev.how] || ev.how, c: nm(ev.uid), s: ev.slot + 1 });
      }
      case 'positionChange': return fill(e.positionChange, { c: nm(ev.uid), pos: s.position[ev.position] || ev.position });
      case 'attackDeclared': return fill(e.attackDeclared, { p: P(ev.player), from: ev.from + 1, to: ev.to === null ? e.attackDirect : ev.to + 1 });
      case 'destroy': return fill(e.destroy, { c: nm(ev.uid), r: s.reason[ev.by] || ev.by });
      case 'lpChange': return fill(e.lpChange, { p: P(ev.player), lp: s.term.lp, d: (ev.delta > 0 ? '+' : '') + ev.delta, r: s.reason[ev.reason] || ev.reason });
      case 'statChange': return fill(e.statChange, { c: nm(ev.uid), stat: (ev.stat || '').toUpperCase(), d: (ev.delta > 0 ? '+' : '') + ev.delta });
      case 'moveCard': {
        const c = map[ev.uid]; if (!c) return null;
        if ((ev.to === 'deck' || ev.from === 'deck' || ev.to === 'hand' || ev.from === 'hand') && c.owner !== viewer) return null;
        if ((ev.from === 'monster' || ev.from === 'field') && ev.to === 'grave') return null; // มี destroy แสดงอยู่แล้ว
        return fill(e.moveCard, { c: nm(ev.uid), from: s.zone[ev.from] || ev.from, to: s.zone[ev.to] || ev.to });
      }
      case 'phaseChange': return ev.phase === 'draw' ? fill(e.turnStart, { t: ev.turn, p: P(ev.activeIdx) }) : null;
      case 'gameEnd': return fill(e.gameEnd, { w: ev.winner === 'draw' ? s.app.drawGame : P(ev.winner), r: s.endReason[ev.reason] || ev.reason });
      case 'chainAdd': return e.chainAdd;
      case 'chainResolve': return e.chainResolve;
      default: return null;
    }
  };
  V.errorText = (code) => S().errors[code] || (S().errorUnknown + ' (' + code + ')');

  // 6E: Pure function (no DOM) returning available buttons/menu items from getLegalActions
  function makeButtonForAction(state, viewer, act) {
    const p = state.players[viewer];
    const s = S(), a = s.app;
    const E = CG.engine;
    let label = '';
    let id = act.type;
    let cardName = '';
    let cost = 0;

    switch (act.type) {
      case 'activateSpell': {
        if (act.handIdx !== undefined) {
          const c = p.hand[act.handIdx];
          const d = E.cardOf(c);
          cardName = d ? d.name : '';
          const isField = d && (d.field || d.group === 'field');
          const prefix = isField ? (a.activateField || 'ร่ายเวทสนาม') : (a.activateSpell || 'ใช้สเปล');
          label = prefix + (cardName ? ': ' + cardName : '');
          id = 'activateSpell:hand:' + act.handIdx;
        } else if (act.spellSlot !== undefined) {
          const c = p.spells[act.spellSlot];
          const d = E.cardOf(c);
          cardName = d ? d.name : '';
          label = (a.activateSpellSlot || s.chain.activateSet || 'เปิดใช้ Distortion') + (cardName ? ': ' + cardName : '') + ' (ช่อง ' + (act.spellSlot + 1) + ')';
          id = 'activateSpell:slot:' + act.spellSlot;
        }
        break;
      }
      case 'setSpell': {
        const c = p.hand[act.handIdx];
        const d = E.cardOf(c);
        cardName = d ? d.name : '';
        label = (a.setSpell || 'หมอบสเปล') + ' (ช่อง ' + (act.slot + 1) + ')';
        id = 'setSpell:hand:' + act.handIdx + ':slot:' + act.slot;
        break;
      }
      case 'activateEffect': {
        let d = null;
        if (act.slot !== undefined) {
          const c = p.monsters[act.slot];
          d = E.cardOf(c);
          id = 'activateEffect:slot:' + act.slot + ':' + act.effectId;
        } else if (act.handIdx !== undefined) {
          const c = p.hand[act.handIdx];
          d = E.cardOf(c);
          id = 'activateEffect:hand:' + act.handIdx + ':' + act.effectId;
        }
        cardName = d ? d.name : '';
        const eff = d && d.effects && d.effects.find(e => e.id === act.effectId);
        const efName = (eff && (eff.name || eff.id)) || act.effectId;
        cost = (eff && eff.cost && eff.cost.mana !== undefined) ? eff.cost.mana : 0;
        label = (a.activateEffect || 'ใช้เอฟเฟกต์') + ': ' + efName + ' (' + s.term.mana + ' ' + cost + ')';
        break;
      }
      case 'normalSummon': {
        const c = p.hand[act.handIdx];
        const d = E.cardOf(c);
        cardName = d ? d.name : '';
        label = a.summon + ' (ช่อง ' + (act.slot + 1) + ')';
        id = 'normalSummon:' + act.handIdx + ':' + act.slot;
        break;
      }
      case 'setMonster': {
        const c = p.hand[act.handIdx];
        const d = E.cardOf(c);
        cardName = d ? d.name : '';
        label = a.setMon + ' (ช่อง ' + (act.slot + 1) + ')';
        id = 'setMonster:' + act.handIdx + ':' + act.slot;
        break;
      }
      case 'tributeSummon': {
        const c = p.hand[act.handIdx];
        const d = E.cardOf(c);
        cardName = d ? d.name : '';
        const matStr = (act.materials || []).map(m => m + 1).join(',');
        label = a.tribute + ' (ช่อง ' + (act.slot + 1) + ' ใช้ ' + matStr + ')';
        id = 'tributeSummon:' + act.handIdx + ':' + act.slot + ':' + matStr;
        break;
      }
      case 'overlay': {
        const c = p.hand[act.handIdx];
        const d = E.cardOf(c);
        cardName = d ? d.name : '';
        label = a.overlay + ' (ช่อง ' + (act.targetSlot + 1) + ')';
        id = 'overlay:' + act.handIdx + ':' + act.targetSlot;
        break;
      }
      case 'extraSummon': {
        const c = (p.extra || [])[act.extraIdx];
        const d = E.cardOf(c);
        cardName = d ? d.name : '';
        label = a.extraSummon + ' (ช่อง ' + (act.targetSlot + 1) + ')';
        id = 'extraSummon:' + act.extraIdx + ':' + act.targetSlot;
        break;
      }
      case 'flipSummon': {
        const c = p.monsters[act.slot];
        const d = E.cardOf(c);
        cardName = d ? d.name : '';
        label = a.flip;
        id = 'flipSummon:' + act.slot;
        break;
      }
      case 'changePosition': {
        const c = p.monsters[act.slot];
        const d = E.cardOf(c);
        cardName = d ? d.name : '';
        const curPos = (c && c.position) || 'atk';
        label = curPos === 'atk' ? '🛡️ ตั้งป้องกัน' : '⚔️ ตั้งโจมตี';
        id = 'changePosition:' + act.slot;
        break;
      }
      case 'attack': {
        label = a.attack + (act.to === null ? ' ' + a.attackDirect : ' (ช่อง ' + (act.to + 1) + ')');
        id = 'attack:' + act.from + ':' + act.to;
        break;
      }
      case 'advancePhase': {
        label = a.nextPhase;
        id = 'advancePhase';
        break;
      }
      case 'endTurn': {
        label = a.endTurn;
        id = 'endTurn';
        break;
      }
      case 'activateResponse': {
        label = s.chain.use + ' ' + (act.name || act.cardId || '?');
        id = 'activateResponse:' + (act.slot !== undefined ? 'slot:' + act.slot : act.spellSlot !== undefined ? 'spell:' + act.spellSlot : 'hand:' + act.handIdx);
        break;
      }
      case 'mulligan': {
        label = a.mulliganSwapAll || a.mulliganTitle;
        id = 'mulligan';
        break;
      }
      case 'pass': {
        label = a.mulliganKeep || 'ผ่าน';
        id = 'pass';
        break;
      }
      default: {
        label = act.type;
        id = act.type;
      }
    }

    return Object.assign({}, act, {
      id,
      type: act.type,
      label,
      action: act,
      enabled: true,
      reason: null,
      detail: { cardName, cost }
    });
  }

  function appendDisabledButtons(state, viewer, selection, legal, buttons) {
    const E = CG.engine, s = S(), a = s.app;
    const p = state.players[viewer];
    if (!p) return;

    if (selection.kind === 'hand' && selection.idx !== undefined) {
      const c = p.hand[selection.idx];
      if (!c) return;
      const d = E.cardOf(c);
      if (!d) return;

      if (d.type === 'spell') {
        const hasAct = buttons.some(b => b.type === 'activateSpell');
        if (!hasAct) {
          let reason = null;
          const reqMana = d.cost && d.cost.mana !== undefined ? d.cost.mana : (d.mana ? Number(d.mana) : 0);
          if (p.mana < reqMana) {
            reason = s.errors.NOT_ENOUGH_MANA;
          } else if (d.group === 'set') {
            reason = 'สเปลหมอบรอ ต้องหมอบก่อนใช้ในเทิร์นถัดไป';
          } else if (d.group === 'counter') {
            reason = 'สเปลสวนกลับ ใช้ในหน้าต่างตอบโต้';
          } else if (state.phase !== 'main1' && state.phase !== 'main2') {
            reason = s.errors.WRONG_PHASE;
          } else {
            const eff = d.effects && d.effects[0];
            const ctx = { source: c, player: viewer, trigger: 'spell' };
            const FXc = CG.effects;
            if (eff && FXc && FXc.checkCanActivate && !FXc.checkCanActivate(state, eff, ctx)) {
              const hasGraveOp = (eff.do || []).some(step => step.from === 'grave' || (step.target && step.target.zone === 'grave') || (Array.isArray(step.from) && step.from.length === 1 && step.from[0] === 'grave'));
              const hasFusionOp = (eff.do || []).some(step => step.op === 'fusionSummon') || (eff.condition || []).some(cond => cond.op === 'canFusionSummon');
              if (hasFusionOp) {
                const isFromGrave = (eff.do || []).some(step => [].concat(step.materialsFrom || []).includes('grave')) || (eff.condition || []).some(cond => [].concat(cond.materialsFrom || []).includes('grave'));
                reason = isFromGrave ? 'ไม่มีวัตถุดิบที่ตรงตามสูตรฟิวชั่นในสุสาน' : 'ไม่มีวัตถุดิบที่ตรงตามสูตรฟิวชั่นในมือ/สนาม';
              } else if (hasGraveOp) {
                reason = s.errors.NO_TARGET_IN_GRAVE || 'ไม่มีการ์ดเป้าหมายในสุสาน';
              } else {
                reason = s.errors.CONDITION_FAILED || 'เงื่อนไขการใช้ไม่ครบถ้วน';
              }
            }
          }
          const isField = Boolean(d.field || d.group === 'field');
          const actLabel = isField ? (a.activateField || 'ร่ายเวทสนาม') : (a.activateSpell || 'ใช้สเปล');
          buttons.push({
            id: 'activateSpell:disabled',
            type: 'activateSpell',
            label: actLabel,
            enabled: false,
            reason: reason || s.errors.NOT_IN_ZONE || 'ใช้ไม่ได้ในขณะนี้'
          });
        }
        const isField = Boolean(d.field || d.group === 'field');
        if (!isField) {
          const hasSet = buttons.some(b => b.type === 'setSpell');
          if (!hasSet) {
            const maxSpells = (state.config && state.config.spellSlots) || 5;
            const hasEmpty = (p.spells || []).slice(0, maxSpells).some(x => !x);
            const reason = !hasEmpty ? (s.errors.SLOT_FULL || 'ช่องสเปลเต็ม') : (state.phase !== 'main1' && state.phase !== 'main2' ? s.errors.WRONG_PHASE : 'หมอบไม่ได้');
            buttons.push({
              id: 'setSpell:disabled',
              type: 'setSpell',
              label: a.setSpell || 'หมอบสเปล',
              enabled: false,
              reason
            });
          }
        }
      } else {
        // Monster in hand
        const hasSummon = buttons.some(b => b.type === 'normalSummon');
        if (!hasSummon) {
          const err = E.validateNormalSummon ? E.validateNormalSummon(state, { type: 'normalSummon', player: viewer, handIdx: selection.idx, slot: 0 }) : null;
          if (err) {
            buttons.push({
              id: 'normalSummon:disabled',
              type: 'normalSummon',
              label: a.summon,
              enabled: false,
              reason: s.errors[err] || err
            });
          }
        }
        const hasSet = buttons.some(b => b.type === 'setMonster');
        if (!hasSet) {
          const err = E.validateSetMonster ? E.validateSetMonster(state, { type: 'setMonster', player: viewer, handIdx: selection.idx, slot: 0 }) : null;
          if (err) {
            buttons.push({
              id: 'setMonster:disabled',
              type: 'setMonster',
              label: a.setMon,
              enabled: false,
              reason: s.errors[err] || err
            });
          }
        }
        if (d.level > 1) {
          const hasTribute = buttons.some(b => b.type === 'tributeSummon');
          if (!hasTribute) {
            const err = E.validateTributeSummon ? E.validateTributeSummon(state, { type: 'tributeSummon', player: viewer, handIdx: selection.idx, materials: [], slot: 0 }) : null;
            if (err) {
              buttons.push({
                id: 'tributeSummon:disabled',
                type: 'tributeSummon',
                label: a.tribute,
                enabled: false,
                reason: s.errors[err] || err
              });
            }
          }
        }
        if (d.effects) {
          for (const ef of d.effects) {
            if (ef.trigger === 'ignition' && [].concat(ef.from || []).includes('hand')) {
              const hasEff = buttons.some(b => b.type === 'activateEffect' && b.action && b.action.effectId === ef.id);
              if (!hasEff) {
                const err = E.validateActivateEffect ? E.validateActivateEffect(state, { type: 'activateEffect', player: viewer, handIdx: selection.idx, effectId: ef.id }) : null;
                const efName = ef.name || ef.id;
                const cost = ef.cost && ef.cost.mana !== undefined ? ef.cost.mana : 0;
                buttons.push({
                  id: 'activateEffect:disabled:' + ef.id,
                  type: 'activateEffect',
                  label: (a.activateEffect || 'ใช้เอฟเฟกต์') + ': ' + efName + ' (' + s.term.mana + ' ' + cost + ')',
                  enabled: false,
                  reason: s.errors[err] || err || 'เงื่อนไขไม่ครบ'
                });
              }
            }
          }
        }
      }
    } else if (selection.kind === 'field' && selection.slot !== undefined) {
      const m = p.monsters[selection.slot];
      if (!m) return;
      const d = E.cardOf(m);
      if (m.faceDown) {
        const hasFlip = buttons.some(b => b.type === 'flipSummon');
        if (!hasFlip) {
          const err = E.validateFlipSummon ? E.validateFlipSummon(state, { type: 'flipSummon', player: viewer, slot: selection.slot }) : null;
          if (err) {
            buttons.push({
              id: 'flipSummon:disabled',
              type: 'flipSummon',
              label: a.flip,
              enabled: false,
              reason: s.errors[err] || err
            });
          }
        }
      } else {
        const hasPos = buttons.some(b => b.type === 'changePosition');
        if (!hasPos) {
          const err = E.validateChangePosition ? E.validateChangePosition(state, { type: 'changePosition', player: viewer, slot: selection.slot }) : null;
          if (err) {
            buttons.push({
              id: 'changePosition:disabled',
              type: 'changePosition',
              label: a.changePos,
              enabled: false,
              reason: s.errors[err] || err
            });
          }
        }
        if (state.phase === 'battle') {
          const hasAtk = buttons.some(b => b.type === 'attack');
          if (!hasAtk) {
            const err = E.validateAttack ? E.validateAttack(state, { type: 'attack', player: viewer, from: selection.slot, to: null }) : null;
            if (err) {
              buttons.push({
                id: 'attack:disabled',
                type: 'attack',
                label: a.attack,
                enabled: false,
                reason: s.errors[err] || err
              });
            }
          }
        }
        if (d && d.effects) {
          for (const ef of d.effects) {
            if (ef.trigger === 'ignition' && ![].concat(ef.from || []).includes('hand')) {
              const hasEff = buttons.some(b => b.type === 'activateEffect' && b.action && b.action.effectId === ef.id);
              if (!hasEff) {
                const err = E.validateActivateEffect ? E.validateActivateEffect(state, { type: 'activateEffect', player: viewer, slot: selection.slot, effectId: ef.id }) : null;
                const efName = ef.name || ef.id;
                const cost = ef.cost && ef.cost.mana !== undefined ? ef.cost.mana : 0;
                buttons.push({
                  id: 'activateEffect:disabled:' + ef.id,
                  type: 'activateEffect',
                  label: (a.activateEffect || 'ใช้เอฟเฟกต์') + ': ' + efName + ' (' + s.term.mana + ' ' + cost + ')',
                  enabled: false,
                  reason: s.errors[err] || err || 'เงื่อนไขไม่ครบ'
                });
              }
            }
          }
        }
      }
    } else if (selection.kind === 'spell' && selection.slot !== undefined) {
      const sp = p.spells[selection.slot];
      if (!sp) return;
      const hasAct = buttons.some(b => b.type === 'activateSpell');
      if (!hasAct) {
        let reason = null;
        const setTurn = sp.flags && sp.flags.setTurn !== undefined ? sp.flags.setTurn : sp.setTurn;
        if (setTurn !== undefined && setTurn >= state.turn) {
          reason = s.errors.SET_THIS_TURN || 'เพิ่งหมอบในเทิร์นนี้';
        } else if (state.phase !== 'main1' && state.phase !== 'main2') {
          reason = s.errors.WRONG_PHASE;
        } else {
          const spDef = E.cardOf(sp);
          const eff = spDef && spDef.effects && spDef.effects[0];
          const ctx = { source: sp, player: viewer, trigger: 'spell' };
          const FXc = CG.effects;
          if (eff && FXc && FXc.checkCanActivate && !FXc.checkCanActivate(state, eff, ctx)) {
            const hasGraveOp = (eff.do || []).some(step => step.from === 'grave' || (step.target && step.target.zone === 'grave') || (Array.isArray(step.from) && step.from.length === 1 && step.from[0] === 'grave'));
            if (hasGraveOp) {
              reason = s.errors.NO_TARGET_IN_GRAVE || 'ไม่มีการ์ดเป้าหมายในสุสาน';
            } else {
              reason = s.errors.CONDITION_FAILED || 'เงื่อนไขการใช้ไม่ครบถ้วน';
            }
          }
        }
        buttons.push({
          id: 'activateSpell:disabled',
          type: 'activateSpell',
          label: a.activateSpellSlot || s.chain.activateSet || 'เปิดใช้สเปล',
          enabled: false,
          reason: reason || 'ใช้ไม่ได้ในขณะนี้'
        });
      }
    }
  }

  V.getMenuActions = function (state, viewer, selection, legalActions) {
    if (!state || viewer === undefined) return [];
    const legal = legalActions || CG.engine.getLegalActions(state, viewer);
    const p = state.players[viewer];
    if (!p) return [];

    let filtered = legal;
    if (selection) {
      if (typeof selection === 'string') {
        selection = { kind: selection };
      }
      if (selection.kind === 'hand' && selection.idx !== undefined) {
        filtered = legal.filter(a => a.handIdx === selection.idx);
      } else if (selection.kind === 'field' && selection.slot !== undefined) {
        filtered = legal.filter(a => a.slot === selection.slot || (a.type === 'attack' && a.from === selection.slot));
      } else if (selection.kind === 'spell' && selection.slot !== undefined) {
        filtered = legal.filter(a => a.spellSlot === selection.slot);
      } else if (selection.kind === 'extra' && selection.idx !== undefined) {
        filtered = legal.filter(a => a.extraIdx === selection.idx);
      } else if (selection.kind === 'global') {
        filtered = legal.filter(a => a.type === 'advancePhase' || a.type === 'endTurn');
      } else if (selection.kind === 'chain') {
        filtered = legal.filter(a => a.type === 'activateResponse');
      } else if (selection.kind === 'mulligan') {
        filtered = legal.filter(a => a.type === 'mulligan' || a.type === 'pass');
      } else if (selection.kind === 'attack' && selection.slot !== undefined) {
        filtered = legal.filter(a => a.type === 'attack' && a.from === selection.slot);
      } else if (selection.all) {
        filtered = legal;
      }
    }

    const buttons = [];
    for (const act of filtered) {
      if (act.type === 'respond' || act.type === 'passPriority') continue;
      buttons.push(makeButtonForAction(state, viewer, act));
    }

    if (selection && selection.kind && !selection.all) {
      appendDisabledButtons(state, viewer, selection, legal, buttons);
    }

    return buttons;
  };
  V.getAvailableActions = V.getMenuActions;
  V.buildMenuActions = V.getMenuActions;

  // 7P: Pure pacing delay calculator
  const PACING_SPEEDS = {
    slow: { base: 1500, minor: 750 },
    normal: { base: 800, minor: 400 },
    fast: { base: 250, minor: 125 }
  };
  V.PACING_SPEEDS = PACING_SPEEDS;

  V.getActionDelay = function (actionType, speedLevel) {
    const s = PACING_SPEEDS[speedLevel] || PACING_SPEEDS.normal;
    const isMinor = actionType === 'advancePhase' || actionType === 'endTurn' || actionType === 'pass' || actionType === 'passPriority';
    return isMinor ? s.minor : s.base;
  };
  CG.ui.getActionDelay = V.getActionDelay;

  // ---- ลำดับการเลือกไอคอนแท็กตามข้อ 12-ก ----
  // apex(type grade4) > resonance(type fusion) > eclipse(การ์ดมี extraSummon/overlay ตามข้อ 4) > pioneer(leader:true) > entity
  function getCardIcon(d) {
    if (d.type === 'spell') return null;
    if (d.type === 'grade4') return 'apex';
    if (d.type === 'fusion') return 'resonance';
    const hasEclipse = !!(d.extraSummon || (d.effects && d.effects.some(e => e.trigger === 'overlay')));
    if (hasEclipse) return 'eclipse';
    if (d.leader === true) return 'pioneer';
    return 'entity';
  }

  // ---- การ์ดเดี่ยว ----
  function cardHtml(inst, o) {
    o = o || {};
    if (o.back) return '<div class="card back"></div>';
    const d = def(inst), s = S();
    const hidden = inst.faceDown && !o.reveal;
    const cls = ['card', 't-' + d.type];
    if (d.rare || (d.id && d.id.endsWith('_rare'))) cls.push('rare-secret');
    if (inst.faceDown) cls.push('fd' + (o.reveal ? ' mine-fd' : ''));
    if (inst.position === 'def') cls.push('def');
    if (o.field) cls.push('on-field');
    if (o.sel) cls.push('sel'); if (o.dis) cls.push('dis');
    if (o.hlClass) cls.push(o.hlClass);
    const data = ' data-uid="' + inst.uid + '"' + (o.attrs || '');
    if (hidden) return '<div class="' + cls.join(' ') + '"' + data + '>🂠</div>';
    const mon = d.type !== 'spell';
    const E = CG.engine;
    const atk = mon && inst.baseAtk != null ? E.atk(inst) : (d.atk != null ? d.atk : 0);
    const dfn = mon && inst.baseDef != null ? E.def(inst) : (d.def != null ? d.def : 0);
    const lvl = inst.level != null ? inst.level : (d.level != null ? d.level : 1);
    const onField = o.field;

    // 1. ไอคอนแท็ก กึ่งกลางบน (วงกลมพื้นหลังเข้ม ขอบดำ ตามม็อกอัป)
    let iconHtml = '';
    const iconName = getCardIcon(d);
    if (iconName) {
      iconHtml = '<div class="icon-circle"><img class="tag-icon" src="assets/icons/' + iconName + '.png" alt="' + iconName + '"></div>';
    } else if (d.type === 'spell') {
      const grpKey = (d.field || d.group === 'field') ? 'field' : d.group;
      const spText = s.spellGroup[grpKey] || d.group || '';
      iconHtml = '<div class="icon-circle sp-circle sp-badge">' + esc(spText) + '</div>';
    }
    const iconArea = '<div class="card-icon-area">' + iconHtml + '</div>';

    // 2. ภาพการ์ด (ดึงจาก assets/cards/[id].png หรือ d.image พร้อม cache buster ป้องกันเบราว์เซอร์จำภาพเก่า)
    const cardVer = '?v=5.5';
    const rawArt = d.image || ('assets/cards/' + d.id + '.png');
    const artImg = rawArt.includes('?') ? rawArt : (rawArt + cardVer);
    const fallbackArt = 'assets/cards/' + d.id + '.jpg' + cardVer;
    const artHtml = '<div class="card-art art-' + d.type + '"><img src="' + esc(artImg) + '" alt="" class="card-art-img" loading="lazy" onerror="if(!this.dataset.t){this.dataset.t=\'1\';this.src=\'' + fallbackArt + '\';}"></div>';

    // 3. แถวค่า: ATK วงรีแดงซ้าย, Level วงกลมเหลืองกลาง, DEF วงรีน้ำเงินขวา
    let statsHtml = '';
    if (mon) {
      statsHtml = '<div class="card-stats">' +
        '<span class="stat-pill stat-atk">' + atk + '</span>' +
        '<span class="stat-circle stat-lv">' + lvl + '</span>' +
        '<span class="stat-pill stat-def">' + dfn + '</span>' +
        '</div>';
    } else {
      const manaVal = d.mana != null ? d.mana : (d.cost && d.cost.mana != null ? d.cost.mana : 0);
      statsHtml = '<div class="card-stats sp-stat-row">' +
        '<span class="stat-pill stat-mana">💧 ' + manaVal + '</span>' +
        '</div>';
    }

    // 4. แถบชื่อ
    const nameHtml = '<div class="card-name nm">' + esc(d.name) + '</div>';

    // 5. กรอบข้อความเอฟเฟกต์ (d.text) ปรับขนาดฟอนต์อัตโนมัติตามความยาว
    let textHtml = '';
    if (d.text) {
      const textLen = d.text.length;
      let textLenClass = '';
      if (textLen > 65) textLenClass = ' text-xxs';
      else if (textLen > 45) textLenClass = ' text-xs';
      else if (textLen > 22) textLenClass = ' text-sm';
      textHtml = '<div class="card-text' + textLenClass + '">' + esc(d.text) + '</div>';
    }

    // Badge ท่าป้องกัน / ตัวใต้การ์ด / วัสดุสังเวย / เป้าหมายอัญเชิญพิเศษ
    let extraBadges = '';
    if (onField && mon) {
      extraBadges += '<div class="pos">' + (inst.faceDown ? '' : inst.position === 'atk' ? '⚔' : '🛡') + '</div>';
    }
    if (inst.under && inst.under.length) {
      extraBadges += '<div class="under">+' + inst.under.length + '</div>';
      if (onField) {
        const stackLayers = Math.min(inst.under.length, 3);
        extraBadges += '<div class="stack-layers-wrap stack-' + stackLayers + '"></div>';
      }
    }
    const hasEquipUnder = Boolean(onField && mon && inst.under && inst.under.some(u => {
      if (u.isEquip) return true;
      const ud = def(u);
      return ud && (ud.type === 'spell' || ud.group === 'equip' || (ud.tags || []).includes('equip'));
    }));
    if (hasEquipUnder) {
      cls.push('has-equip-blue-glow');
      extraBadges += '<div class="equip-blue-indicator" data-act="inspectUnderEquip:' + inst.uid + '" title="มีเวทสวมใส่ (แตะเพื่อดูการ์ด)">' +
        '<span class="equip-blue-gem"></span>' +
        '<span class="equip-blue-icon">⚔</span>' +
      '</div>';
    }
    if (o.isTributeMat) {
      extraBadges += '<div class="tribute-badge-overlay"><span class="t-skull">💀</span> <span class="t-badge-txt">สังเวย #' + (o.tributeOrder || 1) + '</span></div>';
    }
    if (o.isExtraTarget) {
      extraBadges += '<div class="extra-target-badge-overlay"><span class="et-icon">🎯</span> <span class="et-badge-txt">แตะใช้วางทับ</span></div>';
    }
    if (o.chainLink) {
      cls.push('is-chained-card');
      const isResolvingThis = (CG.ui && CG.ui.resolvingLinkId === o.chainLink);
      if (isResolvingThis) cls.push('resolving-chain-link');
      const isNegatedThis = (CG.ui && CG.ui.resolvingNegated && isResolvingThis);
      const badgeCls = 'card-chain-badge' + (isNegatedThis ? ' negated-badge' : (isResolvingThis ? ' resolving-badge' : ''));
      const badgeText = isNegatedThis ? '🚫 NEGATED' : (isResolvingThis ? ('⚡ RESOLVING ' + o.chainLink) : ('⚡ CHAIN ' + o.chainLink));
      extraBadges += '<div class="' + badgeCls + '"><span class="ccb-text">' + badgeText + '</span></div>';
    } else if (CG.ui && CG.ui.resolvingUid && inst && inst.uid === CG.ui.resolvingUid) {
      cls.push('is-chained-card', 'resolving-chain-link');
      const isNegatedThis = CG.ui.resolvingNegated;
      const badgeCls = 'card-chain-badge' + (isNegatedThis ? ' negated-badge' : ' resolving-badge');
      const badgeText = isNegatedThis ? '🚫 NEGATED' : ('⚡ RESOLVING ' + (CG.ui.resolvingLinkId || 1));
      extraBadges += '<div class="' + badgeCls + '"><span class="ccb-text">' + badgeText + '</span></div>';
    }

    if (o.isTributeMat) cls.push('tribute-mat-card');
    if (o.isExtraTarget) cls.push('extra-target-card');

    return '<div class="' + cls.join(' ') + '"' + data + '>' +
      artHtml +
      iconArea +
      '<div class="card-bottom-bar">' +
        statsHtml +
        nameHtml +
        textHtml +
      '</div>' +
      extraBadges +
      '</div>';
  }
  V.cardHtml = cardHtml;

  CG.ui.sideOpen = false;
  CG.ui.toggleSide = function () {
    CG.ui.sideOpen = !CG.ui.sideOpen;
    const sideEl = document.querySelector('.side');
    const btn = document.getElementById('btnSideToggle');
    if (sideEl) sideEl.classList.toggle('side-collapsed', !CG.ui.sideOpen);
    if (btn) btn.textContent = CG.ui.sideOpen ? '📜 ปิดบันทึก' : '📜 บันทึก';
  };

  V.formatMaterialsRequirement = function (def) {
    if (!def) return '';
    if (def.materials && def.materials.trim().length > 0) return def.materials;
    const es = def.extraSummon;
    if (!es) return (def.type === 'fusion' || def.type === 'grade4') ? 'เงื่อนไขพิเศษจาก Astral Gate' : '';
    const parts = [];
    if (es.onto) {
      if (es.onto.cardId) {
        const targetDef = CG.engine ? CG.engine.findCard(es.onto.cardId) : null;
        const targetName = targetDef ? targetDef.name : es.onto.cardId;
        parts.push('วางทับ ' + targetName + (es.onto.underCount ? ' (มี ' + es.onto.underCount + ' ใบทับอยู่)' : ''));
      } else if (es.onto.tag) {
        parts.push('วางทับมอนสเตอร์แท็ก ' + es.onto.tag + ' 1 ตัวบนสนาม');
      } else {
        parts.push('วางทับมอนสเตอร์ 1 ตัวบนสนาม');
      }
    }
    if (es.fromHand) {
      parts.push('ใช้วัสดุ ' + (es.fromHand.count || 1) + ' ใบจากมือ');
    }
    if (es.cost && es.cost.length) {
      for (const c of es.cost) {
        if (c.op === 'sendToGrave') {
          const tag = (c.target && c.target.filter && c.target.filter.tag) ? (' ' + c.target.filter.tag) : '';
          parts.push('ส่งการ์ด' + tag + ' ' + ((c.target && c.target.count) || 1) + ' ใบจากมือลงสุสาน');
        } else if (c.op === 'returnToDeck') {
          const cid = (c.target && c.target.filter && c.target.filter.cardId);
          const cDef = cid && CG.engine ? CG.engine.findCard(cid) : null;
          const cName = cDef ? cDef.name : (cid || 'การ์ด');
          parts.push('นำ ' + cName + ' ' + ((c.target && c.target.count) || 1) + ' ใบจากสุสานกลับเด็ค');
        } else if (c.op === 'banish') {
          const tag = (c.target && c.target.filter && c.target.filter.tag) ? (' ' + c.target.filter.tag) : '';
          parts.push('Exile การ์ด' + tag + ' ' + ((c.target && c.target.count) || 1) + ' ใบจากสุสาน');
        }
      }
    }
    return parts.join(' + ') || 'เงื่อนไขพิเศษจาก Astral Gate';
  };

  // 10: หน้าต่างรายละเอียดการ์ดกลางจอ พร้อมแถบคำสั่งสีม่วง
  V.cardDetailModal = function (state, viewer, cardInst, isOpponent, sel, legalActions) {
    if (!cardInst) return '';
    const d = def(cardInst);
    if (!d) return '';
    const s = S(), a = s.app;
    const mon = d.type !== 'spell';
    const E = CG.engine;
    const atk = mon && cardInst.baseAtk != null ? E.atk(cardInst) : (d.atk != null ? d.atk : 0);
    const dfn = mon && cardInst.baseDef != null ? E.def(cardInst) : (d.def != null ? d.def : 0);
    const lvl = cardInst.level != null ? cardInst.level : (d.level != null ? d.level : 1);

    // ซ้าย = หน้าการ์ดใบใหญ่
    const largeCardHtml = cardHtml(cardInst, { reveal: true, field: false });

    // กล่องแสดงวัตถุดิบและเงื่อนไขการอัญเชิญพิเศษ (Resonance / Apex)
    let summonReqHtml = '';
    const isExtraMonster = (d.type === 'fusion' || d.type === 'grade4' || d.extraSummon || (d.materials && d.materials.trim()));
    if (isExtraMonster) {
      const isFusion = d.type === 'fusion';
      const isApex = d.type === 'grade4';
      const reqText = V.formatMaterialsRequirement(d);
      const icon = isFusion ? '🌀' : isApex ? '👑' : '💫';
      const title = isFusion ? 'วัตถุดิบฟิวชั่น (Resonance)' : isApex ? 'เงื่อนไขอัญเชิญ Apex (Grade 4)' : 'เงื่อนไขอัญเชิญพิเศษ';
      const hint = isFusion
        ? '💡 อัญเชิญด้วยการใช้การ์ดสเปลผสานร่าง (เช่น "เมก้า เรโซแนนซ์" หรือ "มิราเคิล รีบูต") ร่ายจากบนมือหรือสนาม'
        : isApex
          ? '💡 แตะช่อง Astral Gate แล้วเลือกอัญเชิญพิเศษวางทับ (เรียกได้ 1 ครั้ง/เทิร์น, จบเทิร์นกลับ Astral Gate)'
          : '';

      summonReqHtml = '<div class="detail-materials-box ' + (isFusion ? 'fusion-req' : 'apex-req') + '">' +
        '<div class="mat-badge-title">' + icon + ' <b>' + esc(title) + '</b></div>' +
        '<div class="mat-desc-line">🎯 <b>' + esc(reqText) + '</b></div>' +
        (hint ? '<div class="mat-hint-line">' + esc(hint) + '</div>' : '') +
      '</div>';
    }

    // ขวาบน = แถวค่า: ATK วงรีแดง | Level วงกลมเหลือง | DEF วงรีน้ำเงิน (การ์ดสเปลแสดงชนิดแทน)
    let statsRowHtml = '';
    if (mon) {
      statsRowHtml = '<div class="detail-stats-row">' +
        '<div class="detail-stat-oval stat-oval-atk"><span class="stat-lbl">' + (a.atk || 'ATK') + '</span> <span class="stat-val">' + atk + '</span></div>' +
        '<div class="detail-stat-circle stat-circle-lvl"><span class="stat-lbl">★</span><span class="stat-val">' + lvl + '</span></div>' +
        '<div class="detail-stat-oval stat-oval-def"><span class="stat-lbl">' + (a.def || 'DEF') + '</span> <span class="stat-val">' + dfn + '</span></div>' +
      '</div>';
    } else {
      const grpKey = (d.field || d.group === 'field') ? 'field' : d.group;
      const spGroup = s.spellGroup[grpKey] || d.group || 'ปกติ';
      statsRowHtml = '<div class="detail-stats-row sp-row">' +
        '<div class="detail-spell-type-badge"><span class="sp-badge-icon">🌀</span> <span class="sp-badge-name">' + esc(s.type.spell) + ' — ' + esc(spGroup) + '</span></div>' +
        (d.mana ? '<div class="detail-stat-oval stat-oval-mana"><span class="stat-lbl">' + esc(a.manaCost) + '</span> <span class="stat-val">' + d.mana + '</span></div>' : '') +
      '</div>';
    }

    // ขวากลาง = ช่องเอฟเฟกต์ 3 ช่องต่อแถว เลื่อนได้ถ้ามากกว่า 6
    let effectsGridHtml = '';
    const effects = d.effects || [];
    if (effects.length > 0) {
      const effCells = effects.map((eff, i) => {
        const typeLabel = (s.effectType && s.effectType[eff.trigger]) || eff.trigger || 'เอฟเฟกต์';
        let isUsable = false;
        let actData = '';
        const myP = state && state.players ? state.players[viewer] : null;
        const cardSlot = (myP && cardInst && cardInst.uid) ? myP.monsters.findIndex(m => m && m.uid === cardInst.uid) : (sel && sel.kind === 'field' ? sel.slot : -1);
        const cardHandIdx = (myP && cardInst && cardInst.uid) ? myP.hand.findIndex(c => c && c.uid === cardInst.uid) : (sel && sel.kind === 'hand' ? sel.idx : -1);

        if (!isOpponent && legalActions) {
          if (cardHandIdx >= 0) {
            const canAct = legalActions.some(x => x.type === 'activateEffect' && x.handIdx === cardHandIdx && x.effectId === eff.id);
            if (canAct) {
              isUsable = true;
              actData = ' data-act="actEff:hand:' + cardHandIdx + ':' + esc(eff.id) + '"';
            }
          } else if (cardSlot >= 0) {
            const canAct = legalActions.some(x => x.type === 'activateEffect' && x.slot === cardSlot && x.effectId === eff.id);
            if (canAct) {
              isUsable = true;
              actData = ' data-act="actEff:field:' + cardSlot + ':' + esc(eff.id) + '"';
            }
          }
        }
        let reason = '';
        if (!isOpponent && !isUsable) {
          if (eff.trigger !== 'ignition') {
            reason = 'เอฟเฟกต์แบบ ' + typeLabel + ' ทำงานอัตโนมัติตามเงื่อนไข';
          } else {
            const cost = eff.cost && eff.cost.mana !== undefined ? eff.cost.mana : 0;
            const p = state.players[viewer];
            if (p && p.mana < cost) reason = s.errors.NOT_ENOUGH_MANA;
            else if (state.phase !== 'main1' && state.phase !== 'main2') reason = s.errors.WRONG_PHASE;
            const hasFusion = (eff.do || []).some(step => step.op === 'fusionSummon') || (eff.condition || []).some(cond => cond.op === 'canFusionSummon');
            if (hasFusion) {
              const isGrave = (eff.do || []).some(step => [].concat(step.materialsFrom || []).includes('grave')) || (eff.condition || []).some(cond => [].concat(cond.materialsFrom || []).includes('grave'));
              reason = isGrave ? 'ไม่มีวัตถุดิบที่ตรงตามสูตรฟิวชั่นในสุสาน' : 'ไม่มีวัตถุดิบที่ตรงตามสูตรฟิวชั่นในมือ/สนาม';
            } else {
              reason = 'เงื่อนไขยังไม่ครบ';
            }
          }
        }
        const cellClass = 'detail-effect-cell' + (isUsable ? ' usable' : '');
        return '<div class="' + cellClass + '"' + actData + (reason ? ' data-reason="' + esc(reason) + '"' : '') + ' title="' + esc(eff.text || eff.name || '') + '">' +
          '<div class="effect-cell-header">' +
            '<span class="effect-tag-badge">' + esc(typeLabel) + '</span>' +
            (isUsable ? '<span class="usable-glow-tag">พร้อมใช้</span>' : '') +
          '</div>' +
          '<div class="effect-cell-name">' + esc(eff.name || ('เอฟเฟกต์ ' + (i + 1))) + '</div>' +
        '</div>';
      }).join('');

      effectsGridHtml = '<div class="detail-effects-grid-wrap' + (effects.length > 6 ? ' scrollable' : '') + '">' +
        '<div class="detail-effects-grid">' + effCells + '</div>' +
      '</div>';
    }

    // ใต้ช่องเอฟเฟกต์ = การ์ดที่ซ้อนอยู่ใต้ร่าง หรือเวทสวมใส่ (ถ้ามี)
    let underCardsHtml = '';
    if (cardInst.under && cardInst.under.length > 0) {
      const isEquipCard = u => {
        if (u.isEquip) return true;
        const ud = def(u);
        return ud && (ud.type === 'spell' || ud.group === 'equip' || (ud.tags || []).includes('equip'));
      };
      const equipCards = cardInst.under.filter(isEquipCard);
      const stackCards = cardInst.under.filter(u => !isEquipCard(u));

      if (equipCards.length > 0) {
        underCardsHtml += '<div class="detail-under-section equip-section">' +
          '<div class="under-section-header equip-header">' +
            '<span class="under-icon">⚔️</span>' +
            '<span class="under-title" style="color:#38bdf8">เวทสวมใส่ (Equipped Spells): <strong>' + equipCards.length + ' ใบ</strong></span>' +
          '</div>' +
          '<div class="under-cards-row">' +
            equipCards.map(uCard => {
              const uDef = def(uCard);
              return '<div class="under-card-item equip-card-item">' +
                '<div class="under-card-thumb" data-act="inspectUnder:' + uCard.uid + '" title="แตะเพื่อดูรายละเอียด">' +
                  cardHtml(uCard, { reveal: true, field: false }) +
                '</div>' +
                '<div class="under-card-meta">' +
                  '<span class="under-card-name" style="color:#e0f2fe;font-weight:700">' + esc(uDef ? uDef.name : uCard.cardId) + '</span>' +
                  '<button class="pill inspect-under-btn equip-inspect-btn" data-act="inspectUnder:' + uCard.uid + '">🔍 ดูการ์ด</button>' +
                '</div>' +
              '</div>';
            }).join('') +
          '</div>' +
        '</div>';
      }

      if (stackCards.length > 0) {
        underCardsHtml += '<div class="detail-under-section">' +
          '<div class="under-section-header">' +
            '<span class="under-icon">📚</span>' +
            '<span class="under-title">การ์ดที่ซ้อนอยู่ใต้ร่าง (Stacked Materials): <strong>' + stackCards.length + ' ใบ</strong></span>' +
          '</div>' +
          '<div class="under-cards-row">' +
            stackCards.map(uCard => {
              const uDef = def(uCard);
              return '<div class="under-card-item">' +
                '<div class="under-card-thumb" data-act="inspectUnder:' + uCard.uid + '" title="แตะเพื่อดูรายละเอียด">' +
                  cardHtml(uCard, { reveal: true, field: false }) +
                '</div>' +
                '<div class="under-card-meta">' +
                  '<span class="under-card-name">' + esc(uDef ? uDef.name : uCard.cardId) + '</span>' +
                  '<button class="pill inspect-under-btn" data-act="inspectUnder:' + uCard.uid + '">🔍 ดูการ์ด</button>' +
                '</div>' +
              '</div>';
            }).join('') +
          '</div>' +
        '</div>';
      }
    }

    // กล่องข้อความเต็มของการ์ด (d.text)
    const fullTextHtml = '<div class="detail-full-text">' +
      '<div class="full-text-title">คำอธิบายการ์ด</div>' +
      '<div class="full-text-content">' + esc(d.text || '(ไม่มีข้อความเอฟเฟกต์)') + '</div>' +
    '</div>';

    // ล่างสุด = แถบคำสั่งสีม่วงแบ่งเป็นช่อง (cell)
    let commandCellsHtml = '';
    if (isOpponent) {
      commandCellsHtml = '<button class="cmd-cell btn-close enabled" data-act="closeModal">' + esc(a.close) + '</button>';
    } else if (state.phase === 'mulligan') {
      commandCellsHtml = '<button class="cmd-cell btn-deselect enabled" data-act="deselectMulligan">✕ ยกเลิกเลือกใบนี้</button>' +
        '<button class="cmd-cell btn-close enabled" data-act="closeModal">' + esc(a.close) + '</button>';
    } else {
      let isMatchingSel = false;
      if (sel) {
        const myP = state && state.players ? state.players[viewer] : null;
        if (myP) {
          if (sel.kind === 'hand' && myP.hand[sel.idx] && myP.hand[sel.idx].uid === cardInst.uid) isMatchingSel = true;
          else if (sel.kind === 'field' && myP.monsters[sel.slot] && myP.monsters[sel.slot].uid === cardInst.uid) isMatchingSel = true;
          else if (sel.kind === 'spell' && myP.spells[sel.slot] && myP.spells[sel.slot].uid === cardInst.uid) isMatchingSel = true;
          else if (sel.kind === 'extra' && myP.extra[sel.idx] && myP.extra[sel.idx].uid === cardInst.uid) isMatchingSel = true;
        }
      }
      if (!isMatchingSel && !isOpponent) {
        const myP = state && state.players ? state.players[viewer] : null;
        if (myP) {
          const hIdx = myP.hand ? myP.hand.findIndex(c => c && c.uid === cardInst.uid) : -1;
          if (hIdx >= 0) {
            sel = { kind: 'hand', idx: hIdx };
            isMatchingSel = true;
          } else {
            const mIdx = myP.monsters ? myP.monsters.findIndex(m => m && m.uid === cardInst.uid) : -1;
            if (mIdx >= 0) {
              sel = { kind: 'field', slot: mIdx };
              isMatchingSel = true;
            } else {
              const spIdx = myP.spells ? myP.spells.findIndex(sp => sp && sp.uid === cardInst.uid) : -1;
              if (spIdx >= 0) {
                sel = { kind: 'spell', slot: spIdx };
                isMatchingSel = true;
              } else {
                const exIdx = myP.extra ? myP.extra.findIndex(c => c && c.uid === cardInst.uid) : -1;
                if (exIdx >= 0) {
                  sel = { kind: 'extra', idx: exIdx };
                  isMatchingSel = true;
                }
              }
            }
          }
        }
      }
      const menuActions = isMatchingSel ? V.getMenuActions(state, viewer, sel, legalActions) : [];
      let btns = '';

      if (isMatchingSel && sel.kind === 'hand') {
        if (d.type === 'spell') {
          const actSpellBtn = menuActions.find(x => x.type === 'activateSpell' && x.enabled);
          const setSpellBtn = menuActions.find(x => x.type === 'setSpell' && x.enabled);
          if (actSpellBtn) {
            btns += '<button class="cmd-cell enabled" data-act="actSpell">' + esc(actSpellBtn.label) + '</button>';
          } else {
            const dis = menuActions.find(x => x.type === 'activateSpell' && !x.enabled);
            if (dis) btns += '<button class="cmd-cell disabled" data-reason="' + esc(dis.reason || '') + '">' + esc(dis.label) + '</button>';
          }
          if (setSpellBtn) {
            btns += '<button class="cmd-cell enabled" data-act="mode:setSpell">' + esc(a.setSpell || 'หมอบสเปล') + '</button>';
          } else {
            const dis = menuActions.find(x => x.type === 'setSpell' && !x.enabled);
            if (dis) btns += '<button class="cmd-cell disabled" data-reason="' + esc(dis.reason || '') + '">' + esc(dis.label || a.setSpell) + '</button>';
          }
        } else {
          // Monster in hand
          const canSummon = menuActions.some(x => x.type === 'normalSummon' && x.enabled);
          const canSet = menuActions.some(x => x.type === 'setMonster' && x.enabled);
          const canTribute = menuActions.some(x => x.type === 'tributeSummon' && x.enabled);
          const canOverlay = menuActions.some(x => x.type === 'overlay' && x.enabled);

          if (canSummon) btns += '<button class="cmd-cell enabled" data-act="mode:normal">' + esc(a.summon) + '</button>';
          else {
            const dis = menuActions.find(x => x.type === 'normalSummon' && !x.enabled);
            if (dis) btns += '<button class="cmd-cell disabled" data-reason="' + esc(dis.reason || '') + '">' + esc(a.summon) + '</button>';
          }

          if (canSet) btns += '<button class="cmd-cell enabled" data-act="mode:set">' + esc(a.setMon) + '</button>';
          else {
            const dis = menuActions.find(x => x.type === 'setMonster' && !x.enabled);
            if (dis) btns += '<button class="cmd-cell disabled" data-reason="' + esc(dis.reason || '') + '">' + esc(a.setMon) + '</button>';
          }

          if (canTribute) btns += '<button class="cmd-cell enabled" data-act="mode:tribute">' + esc(a.tribute) + '</button>';
          else if (d.level > 1) {
            const dis = menuActions.find(x => x.type === 'tributeSummon' && !x.enabled);
            if (dis) btns += '<button class="cmd-cell disabled" data-reason="' + esc(dis.reason || '') + '">' + esc(a.tribute) + '</button>';
          }

          if (canOverlay) btns += '<button class="cmd-cell enabled" data-act="mode:overlay">' + esc(a.overlay) + '</button>';

          // Hand ignition effects
          const effBtns = menuActions.filter(x => x.type === 'activateEffect');
          effBtns.forEach(eb => {
            if (eb.enabled) {
              btns += '<button class="cmd-cell enabled" data-act="actEff:hand:' + esc(eb.action.effectId) + '">' + esc(eb.label) + '</button>';
            } else {
              btns += '<button class="cmd-cell disabled" data-reason="' + esc(eb.reason || '') + '">' + esc(eb.label) + '</button>';
            }
          });
        }
      } else if (isMatchingSel && sel.kind === 'field') {
        const m = cardInst;
        if (m.faceDown) {
          const canFlip = menuActions.some(x => x.type === 'flipSummon' && x.enabled);
          if (canFlip) btns += '<button class="cmd-cell enabled" data-act="flip">' + esc(a.flip) + '</button>';
          else {
            const dis = menuActions.find(x => x.type === 'flipSummon' && !x.enabled);
            if (dis) btns += '<button class="cmd-cell disabled" data-reason="' + esc(dis.reason || '') + '">' + esc(a.flip) + '</button>';
          }
        } else {
          const canPos = menuActions.some(x => x.type === 'changePosition' && x.enabled);
          const curPos = (m && m.position) || 'atk';
          const posLabel = curPos === 'atk' ? '🛡️ ตั้งป้องกัน' : '⚔️ ตั้งโจมตี';
          if (canPos) btns += '<button class="cmd-cell enabled" data-act="pos">' + esc(posLabel) + '</button>';
          else {
            const dis = menuActions.find(x => x.type === 'changePosition' && !x.enabled);
            if (dis) btns += '<button class="cmd-cell disabled" data-reason="' + esc(dis.reason || '') + '">' + esc(posLabel) + '</button>';
          }

          if (state.phase === 'battle') {
            const canAtk = menuActions.some(x => x.type === 'attack' && x.enabled);
            if (canAtk) btns += '<button class="cmd-cell enabled" data-act="atk">' + esc(a.attack) + '</button>';
            else {
              const dis = menuActions.find(x => x.type === 'attack' && !x.enabled);
              if (dis) btns += '<button class="cmd-cell disabled" data-reason="' + esc(dis.reason || '') + '">' + esc(a.attack) + '</button>';
            }
          }

          // Field ignition effects
          const effBtns = menuActions.filter(x => x.type === 'activateEffect');
          effBtns.forEach(eb => {
            if (eb.enabled) {
              btns += '<button class="cmd-cell enabled" data-act="actEff:field:' + esc(eb.action.effectId) + '">' + esc(eb.label) + '</button>';
            } else {
              btns += '<button class="cmd-cell disabled" data-reason="' + esc(eb.reason || '') + '">' + esc(eb.label) + '</button>';
            }
          });
        }
      } else if (isMatchingSel && sel.kind === 'spell') {
        const canAct = menuActions.find(x => x.type === 'activateSpell' && x.enabled);
        if (canAct) {
          btns += '<button class="cmd-cell enabled" data-act="actSpellField">' + esc(canAct.label) + '</button>';
        } else {
          const dis = menuActions.find(x => x.type === 'activateSpell' && !x.enabled);
          if (dis) btns += '<button class="cmd-cell disabled" data-reason="' + esc(dis.reason || '') + '">' + esc(dis.label) + '</button>';
        }
      } else if (isMatchingSel && sel.kind === 'extra') {
        if (d.type === 'fusion') {
          const recipeText = d.materials || (d.materialSlots ? d.materialSlots.map(s => s.cardId || s.tag).join(' + ') : '');
          btns += '<button class="cmd-cell disabled" data-reason="อัญเชิญผ่านการ์ดสเปลฟิวชั่น (เช่น สแครป ฟิวชั่น) โดยใช้วัตถุดิบ: ' + esc(recipeText) + '">🌀 Resonance Fusion (อัญเชิญด้วยสเปล)</button>';
        } else {
          const canExtra = menuActions.find(x => x.type === 'extraSummon' && x.enabled);
          if (canExtra) {
            btns += '<button class="cmd-cell enabled" data-act="callExtra:' + sel.idx + '">' + esc(a.extraSummon) + '</button>';
          } else {
            const dis = menuActions.find(x => x.type === 'extraSummon' && !x.enabled);
            if (dis) btns += '<button class="cmd-cell disabled" data-reason="' + esc(dis.reason || '') + '">' + esc(a.extraSummon) + '</button>';
          }
        }
      }

      commandCellsHtml = btns + '<button class="cmd-cell btn-close enabled" data-act="closeModal">' + esc(a.close) + '</button>';
    }

    const commandBarHtml = '<div class="detail-command-bar-wrap">' +
      (!isOpponent ? '<div class="command-reason-box" id="cmdReasonBox"></div>' : '') +
      '<div class="detail-command-bar">' + commandCellsHtml + '</div>' +
    '</div>';

    return '<div class="card-detail-overlay" data-act="closeModal">' +
      '<div class="card-detail-modal">' +
        '<button class="detail-close-btn" data-act="closeModal" title="ปิด">✕</button>' +
        '<div class="detail-modal-body">' +
          '<div class="detail-left-col"><div class="detail-big-card-wrap">' + largeCardHtml + '</div></div>' +
          '<div class="detail-right-col">' +
            '<div class="detail-top-info">' +
              '<div class="detail-card-name">' + esc(d.name) + '</div>' +
              statsRowHtml +
            '</div>' +
            summonReqHtml +
            effectsGridHtml +
            underCardsHtml +
            fullTextHtml +
          '</div>' +
        '</div>' +
        commandBarHtml +
      '</div>' +
    '</div>';
  };

  // ---- ทั้งหน้าจอเกม ----
  // ctx = { state, viewer, sel, legal, handSel(Set uid), botBusy }
  V.render = function (root, ctx) {
    const st = ctx.state, me = st.players[ctx.viewer], op = st.players[1 - ctx.viewer], s = S(), a = s.app, E = CG.engine;
    const mine = st.activeIdx === ctx.viewer;
    const sel = ctx.sel || {};
    const botTurn = st.mode === 'bot' && st.phase !== 'mulligan' && st.activeIdx === 1;

    // ระบบตรวจจับการ์ดที่อยู่ใน Chain เพื่อติดป้าย Chain Link Badge บนสนาม
    const chainMap = {};
    const chainSlotMap = {};
    if (st.chain && st.chain.length > 0) {
      st.chain.forEach(lk => {
        if (lk.uid) chainMap[lk.uid] = lk.linkId;
        if (lk.sourceUid) chainMap[lk.sourceUid] = lk.linkId;
        if (lk.controller !== undefined) {
          if (lk.slot !== undefined) chainSlotMap[lk.controller + ':mon:' + lk.slot] = lk.linkId;
          if (lk.spellSlot !== undefined) chainSlotMap[lk.controller + ':spell:' + lk.spellSlot] = lk.linkId;
        }
      });
    }
    ctx.chainMap = chainMap;
    ctx.chainSlotMap = chainSlotMap;

    const phases = ['draw', 'standby', 'main1', 'battle', 'main2', 'end'].map(p => '<span class="' + (st.phase === p ? 'on' : '') + '">' + s.phase[p] + '</span>').join('');
    const botStatus = ctx.botBusy ? (a.botPlaying || 'บอทกำลังเล่น…') : (botTurn ? a.botThinking : a.oppTurn);
    const spKey = ctx.speed || 'normal';
    const speedLabel = (a.speed && a.speed[spKey]) || spKey;
    const top = '<div class="topbar"><div class="info"><b>' + esc(a.title) + '</b>' +
      '<span class="pill">' + a.turn + ' ' + st.turn + '</span>' +
      (st.phase === 'mulligan' ? '<span class="pill">' + s.phase.mulligan + '</span>' :
        '<span class="pill ' + (mine && !ctx.botBusy ? 'turnme' : 'turnopp') + '">' + (mine && !ctx.botBusy ? a.yourTurn : botStatus) + '</span>') +
      '<span class="phases">' + phases + '</span><span class="pill">' + a.seed + ' ' + esc(st.rng.seed) + '</span></div>' +
      '<div class="row">' +
        '<button id="btnSideToggle" class="pill side-btn" onclick="CG.ui.toggleSide()" title="เปิด/ปิด แผงบันทึก">' + (CG.ui.sideOpen ? '📜 ปิดบันทึก' : '📜 บันทึก') + '</button>' +
        '<button id="btnSound" class="pill speed-btn" title="เปิด/ปิดเสียง">' + (CG.ui.audio && CG.ui.audio.isEnabled() ? '🔊 เสียง' : '🔇 ปิดเสียง') + '</button>' +
        '<button id="btnSpeed" class="pill speed-btn" title="' + esc(a.speed ? a.speed.title : 'ความเร็ว') + '">' + esc(speedLabel) + '</button>' +
        '<button id="btnMenu">' + a.back + '</button>' +
      '</div></div>';

    // ตัวช่วยจัดรูปแบบเวลา mm:ss
    function fmtTime(sec) {
      const s = Math.floor(sec || 0);
      const mm = String(Math.floor(s / 60)).padStart(2, '0');
      const ss = String(s % 60).padStart(2, '0');
      return mm + ':' + ss;
    }

    // คอลัมน์ซ้าย 2x2 กอง: Chronicle | Abyss บน, Astral Gate | Exile ล่าง
    // ทั้ง 4 กองขนาดเท่ากันเป๊ะและเท่าช่องการ์ด (--cw x --ch)
    function pilesGrid(p, idx) {
      const resCount = p.extra.filter(c => def(c).type === 'fusion').length;
      const apexCount = p.extra.filter(c => def(c).type === 'grade4').length;
      const canExtraSummon = idx === ctx.viewer && ctx.legal && ctx.legal.some(x => x.type === 'extraSummon');
      return '<div class="piles-grid">' +
        '<div class="pile-box pile-deck" data-zone="' + idx + ':deck" title="' + esc(s.app.deck) + '">' +
          '<div class="pile-header"><span class="pile-title">Chronicle</span></div>' +
          '<div class="pile-num">' + p.deck.length + '</div>' +
        '</div>' +
        '<div class="pile-box pile-grave" data-zone="' + idx + ':grave" title="' + esc(s.app.grave) + '">' +
          '<div class="pile-header"><span class="pile-title">Abyss</span></div>' +
          '<div class="pile-num">' + p.grave.length + '</div>' +
        '</div>' +
        '<div class="pile-box pile-extra' + (canExtraSummon ? ' can-summon' : '') + '" data-zone="' + idx + ':extra" title="' + esc(s.app.extraDeck) + '">' +
          '<div class="pile-header"><span class="pile-title">Astral Gate</span></div>' +
          '<div class="pile-num">' + p.extra.length + '</div>' +
          '<div class="pile-sub-r-a">R:' + resCount + ' A:' + apexCount + '</div>' +
        '</div>' +
        '<div class="pile-box pile-removed" data-zone="' + idx + ':removed" title="' + esc(s.app.removed) + '">' +
          '<div class="pile-header"><span class="pile-title">Exile</span></div>' +
          '<div class="pile-num">' + p.removed.length + '</div>' +
        '</div>' +
      '</div>';
    }

    // แผงข้อมูลผู้เล่นตามแบบร่าง (ฝั่งซ้าย: Profile, Frontier Point, acana)
    function playerPanel(p, idx, isOpponent) {
      const act = st.activeIdx === idx && st.phase !== 'mulligan';
      const fpPct = Math.max(0, Math.min(100, (p.lp / 8000) * 100));
      const name = esc(V.pname(st, idx));
      const timers = (ctx.timers || (CG.ui && CG.ui.timers)) || {};
      const timeVal = fmtTime(timers['p' + idx]);
      const isLowFp = p.lp <= 2500;
      const isBot = st.mode === 'bot' && idx === 1;
      const userLevel = (CG.account && CG.account.current && CG.account.current.level) || 1;
      const levelText = isBot ? 'Lv.AI' : ('Lv.' + userLevel);
      const roleText = isBot ? 'บอท AI' : (name.startsWith('ผู้เล่น') ? ('ผู้ท้าชิง ' + ((CG.account && CG.account.current && CG.account.current.id) || '4196')) : name);

      let manaGemsHtml = '';
      for (let i = 0; i < 10; i++) {
        manaGemsHtml += '<span class="mana-gem ' + (i < p.mana ? 'filled' : 'empty') + '"></span>';
      }

      return '<div class="cosmic-player-card ' + (act ? 'active' : '') + (isOpponent ? ' is-opp' : ' is-self') + '">' +
        '<div class="cpc-header-row">' +
          '<div class="cpc-avatar-circle">' + levelText + '</div>' +
          '<div class="cpc-user-info">' +
            '<div class="cpc-name">' + roleText + '</div>' +
            '<div class="cpc-fp-label">Frontier Point <span class="cpc-timer">⏱ ' + timeVal + '</span></div>' +
            '<div class="cpc-fp-val"><span class="lp bar-num" data-lp="' + idx + '">' + p.lp.toLocaleString() + '</span></div>' +
            '<div class="cpc-hp-track">' +
              '<div class="cpc-hp-ghost" data-lp-ghost="' + idx + '" style="width:' + fpPct + '%"></div>' +
              '<div class="cpc-hp-fill ' + (isLowFp ? 'is-low' : '') + '" data-lp-fill="' + idx + '" style="width:' + fpPct + '%"></div>' +
            '</div>' +
            '<div class="cpc-mana-wrap">' +
              '<div class="cpc-mana-label">acana ' + p.mana + '/10</div>' +
              '<div class="cpc-mana-gems">' + manaGemsHtml + '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    // ฟังก์ชันสร้างเลย์เอาต์สนาม 7x2 ช่องพอร์ทัลเวทมนตร์ตามดีไซน์ใหม่
    function sketchSideHtml(p, idx, isOpponent) {
      const isMe = idx === ctx.viewer;
      const canExtraSummon = idx === ctx.viewer && ctx.legal && ctx.legal.some(x => x.type === 'extraSummon');

      // 4 Piles (กองการ์ด 4 กอง)
      const pileChronicle = '<div class="slot pile-box cosmic-slot cosmic-chronicle" data-zone="' + idx + ':deck" title="' + esc(s.app.deck) + '">' +
        '<div class="cosmic-pile-name">Chronicle</div>' +
        '<div class="cosmic-pile-num">' + p.deck.length + '</div>' +
      '</div>';

      const pileAbyss = '<div class="slot pile-box cosmic-slot cosmic-abyss" data-zone="' + idx + ':grave" title="' + esc(s.app.grave) + '">' +
        '<div class="cosmic-pile-name">Abyss</div>' +
        '<div class="cosmic-pile-num">' + p.grave.length + '</div>' +
      '</div>';

      const pileAstral = '<div class="slot pile-box cosmic-slot cosmic-astral' + (canExtraSummon ? ' can-summon' : '') + '" data-zone="' + idx + ':extra" title="' + esc(s.app.extraDeck) + '">' +
        '<div class="cosmic-pile-name">Astral Gate</div>' +
        '<div class="cosmic-pile-num">' + p.extra.length + '</div>' +
      '</div>';

      const pileExile = '<div class="slot pile-box cosmic-slot cosmic-exile" data-zone="' + idx + ':removed" title="' + esc(s.app.removed) + '">' +
        '<div class="cosmic-pile-name">Exile</div>' +
        '<div class="cosmic-pile-num">' + p.removed.length + '</div>' +
      '</div>';

      // 5 Monsters
      let monSlots = [];
      for (let i = 0; i < p.monsters.length; i++) {
        const m = p.monsters[i];
        const isLeader = (i === 2);
        const cls = ['slot', 'cosmic-slot', isLeader ? 'cosmic-pioneer leader' : 'cosmic-entity'];
        if (isMe && hlOwn.has(i)) cls.push('hl');
        if (!isMe && hlOpp.has(i)) cls.push('hlred');
        if (isMe && sel.kind === 'field' && sel.slot === i) cls.push('sel');
        const isTributeMat = isMe && sel && sel.kind === 'hand' && sel.mode === 'tribute' && sel.mats && sel.mats.includes(i);
        const tributeOrder = isTributeMat ? (sel.mats.indexOf(i) + 1) : 0;
        const isExtraTarget = isMe && ((sel && sel.kind === 'extra') || (sel && sel.kind === 'hand' && sel.mode === 'overlay')) && hlOwn.has(i);
        if (isTributeMat) cls.push('tribute-mat-slot');
        if (isExtraTarget) cls.push('extra-mat-slot');
        const at = ' data-p="' + idx + '" data-slot="' + i + '" data-zone2="mon"';
        const hl = ctx.cardHl && m ? ctx.cardHl[m.uid] : null;
        const ghost = !m && ctx.ghosts ? ctx.ghosts[idx + ':' + i] : null;
        const chainLink = (m && ctx.chainMap && ctx.chainMap[m.uid]) ||
                          (ctx.chainSlotMap && ctx.chainSlotMap[idx + ':mon:' + i]) || null;
        let cHtml = '';
        if (m) {
          cHtml = cardHtml(m, {
            field: true,
            reveal: isMe,
            hlClass: hl,
            chainLink: chainLink,
            sel: (sel.kind === 'attack' && isMe && sel.slot === i) || isTributeMat,
            isTributeMat: isTributeMat,
            tributeOrder: tributeOrder,
            isExtraTarget: isExtraTarget,
            attrs: at
          });
        } else if (ghost) {
          cHtml = cardHtml(ghost.card, { field: true, reveal: ghost.card.owner === ctx.viewer, hlClass: 'ev-destroyed', attrs: at });
        } else if (isLeader) {
          cHtml = '<span class="cosmic-slot-wm leader-wm">Pioneer</span>';
        } else {
          cHtml = '<span class="cosmic-slot-wm">Entity</span>';
        }
        monSlots.push('<div class="' + cls.join(' ') + '"' + at + '>' + cHtml + '</div>');
      }

      // 5 Spells
      let spellSlots = [];
      for (let i = 0; i < p.spells.length; i++) {
        const c = p.spells[i];
        const cls = ['slot', 'spellslot', 'cosmic-slot', 'cosmic-distortion'];
        if (isMe && sel.kind === 'hand' && sel.mode === 'setSpell' && hlSpellOwn.has(i)) cls.push('hl');
        if (isMe && sel.kind === 'spell' && sel.slot === i) cls.push('sel');
        const at = ' data-p="' + idx + '" data-spell-slot="' + i + '" data-zone2="spell"';
        const wm = c ? '' : '<span class="cosmic-slot-wm">Distortion</span>';
        const chainLink = (c && ctx.chainMap && ctx.chainMap[c.uid]) ||
                          (ctx.chainSlotMap && ctx.chainSlotMap[idx + ':spell:' + i]) || null;
        spellSlots.push('<div class="' + cls.join(' ') + '"' + at + '>' + (c ? cardHtml(c, { field: true, reveal: isMe, chainLink: chainLink, attrs: at }).replace('class="card', 'style="height:100%" class="card') : wm) + '</div>');
      }

      let row1 = '', row2 = '';
      if (isOpponent) {
        // แถวบนสุด (สเปลล์ของบอท ตาม Wireframe): Chronicle 35 | 5x Distortion | Astral Gate 3
        row1 = '<div class="cosmic-grid-row opp-spells">' + pileChronicle + spellSlots.join('') + pileAstral + '</div>';
        // แถวสอง (มอนสเตอร์ของบอท ตาม Wireframe): Abyss 0 | 5x Monsters (Pioneer กลาง) | Exile 0
        row2 = '<div class="cosmic-grid-row opp-monsters">' + pileAbyss + monSlots.join('') + pileExile + '</div>';
      } else {
        // แถวหน้า (มอนสเตอร์ของผู้เล่น ตาม Wireframe): Exile 0 | 5x Monsters (Pioneer กลาง) | Abyss 0
        row1 = '<div class="cosmic-grid-row self-monsters">' + pileExile + monSlots.join('') + pileAbyss + '</div>';
        // แถวล่าง (สเปลล์ของผู้เล่น ตาม Wireframe): Astral Gate 5 | 5x Distortion | Chronicle 34
        row2 = '<div class="cosmic-grid-row self-spells">' + pileAstral + spellSlots.join('') + pileChronicle + '</div>';
      }

      return '<div class="cosmic-side ' + (isOpponent ? 'opp-side' : 'self-side') + '">' +
        '<div class="cosmic-grid-7x2">' +
          row1 +
          row2 +
        '</div>' +
      '</div>';
    }

    // ไฮไลต์ช่อง
    const hlOwn = new Set(), hlOpp = new Set(), hlSpellOwn = new Set();
    if (sel.kind === 'hand' && (sel.mode === 'normal' || sel.mode === 'set' || sel.mode === 'overlay' || (sel.mode === 'tribute' && sel.matsOk)))
      ctx.legal.forEach(x => {
        if (x.handIdx !== sel.idx) return;
        if (sel.mode === 'normal' && x.type === 'normalSummon') hlOwn.add(x.slot);
        if (sel.mode === 'set' && x.type === 'setMonster') hlOwn.add(x.slot);
        if (sel.mode === 'overlay' && x.type === 'overlay') hlOwn.add(x.targetSlot);
        if (sel.mode === 'tribute' && x.type === 'tributeSummon' && x.materials.slice().sort().join() === sel.mats.slice().sort().join()) hlOwn.add(x.slot);
      });
    if (sel.kind === 'hand' && !sel.mode) {
      ctx.legal.forEach(x => {
        if (x.handIdx !== sel.idx) return;
        if (x.type === 'normalSummon') hlOwn.add(x.slot);
      });
    }
    if (sel.kind === 'hand' && (sel.mode === 'setSpell' || !sel.mode)) {
      ctx.legal.forEach(x => {
        if (x.type === 'setSpell' && x.handIdx === sel.idx) hlSpellOwn.add(x.slot);
      });
    }
    if (sel.kind === 'extra') {
      ctx.legal.forEach(x => {
        if (x.type === 'extraSummon' && x.extraIdx === sel.idx) hlOwn.add(x.targetSlot);
      });
    }
    if (sel.kind === 'attack') ctx.legal.forEach(x => { if (x.type === 'attack' && x.from === sel.slot && x.to !== null) hlOpp.add(x.to); });

    function formatMaterialsRequirement(def) {
      if (!def) return '';
      if (def.materials && def.materials.trim().length > 0) return def.materials;
      const es = def.extraSummon;
      if (!es) return 'เงื่อนไขพิเศษจาก Extra Deck';
      const parts = [];
      if (es.onto) {
        if (es.onto.cardId) {
          const targetDef = CG.engine ? CG.engine.findCard(es.onto.cardId) : null;
          const targetName = targetDef ? targetDef.name : es.onto.cardId;
          parts.push('วางทับ ' + targetName + (es.onto.underCount ? ' (มี ' + es.onto.underCount + ' ใบทับอยู่)' : ''));
        } else if (es.onto.tag) {
          parts.push('วางทับมอนสเตอร์แท็ก ' + es.onto.tag + ' 1 ตัวบนสนาม');
        } else {
          parts.push('วางทับมอนสเตอร์ 1 ตัวบนสนาม');
        }
      }
      if (es.fromHand) {
        parts.push('ใช้วัสดุ ' + (es.fromHand.count || 1) + ' ใบจากมือ');
      }
      if (es.cost && es.cost.length) {
        for (const c of es.cost) {
          if (c.op === 'sendToGrave') {
            const tag = (c.target && c.target.filter && c.target.filter.tag) ? (' ' + c.target.filter.tag) : '';
            parts.push('ส่งการ์ด' + tag + ' ' + ((c.target && c.target.count) || 1) + ' ใบจากมือลงสุสาน');
          } else if (c.op === 'returnToDeck') {
            const cid = (c.target && c.target.filter && c.target.filter.cardId);
            const cDef = cid && CG.engine ? CG.engine.findCard(cid) : null;
            const cName = cDef ? cDef.name : (cid || 'การ์ด');
            parts.push('นำ ' + cName + ' ' + ((c.target && c.target.count) || 1) + ' ใบจากสุสานกลับเด็ค');
          }
        }
      }
      return parts.join(' + ') || 'เงื่อนไขพิเศษจาก Extra Deck';
    }
    V.formatMaterialsRequirement = formatMaterialsRequirement;

    function tributeBarHtml(st, viewer, sel) {
      const me = st.players[viewer];
      const handCard = me.hand[sel.idx];
      const d = handCard ? def(handCard) : {};
      const reqLv = handCard ? (handCard.level || d.level || 2) : 2;

      const selectedCards = (sel.mats || []).map(slotIdx => {
        const inst = me.monsters[slotIdx];
        return inst ? { slot: slotIdx, inst, def: def(inst) } : null;
      }).filter(Boolean);

      const totalLv = selectedCards.reduce((sum, item) => sum + (item.inst.level || item.def.level || 1), 0);
      const okSum = (reqLv === 2 && totalLv === 2) || (reqLv === 3 && totalLv === 3);

      if (sel.matsOk) {
        const namesList = selectedCards.map(x => esc(x.def.name)).join(', ');
        return '<div class="quick-action-bar tribute-bar mats-confirmed">' +
          '<div class="tb-info">' +
            '<div class="tb-title gold">✅ ยืนยันตัวสังเวยแล้ว: ' + (namesList || '(เลือกแล้ว)') + '</div>' +
            '<div class="tb-sub">👉 แตะช่องมอนสเตอร์บนสนามที่ต้องการวาง <b>' + esc(d.name) + '</b></div>' +
          '</div>' +
          '<div class="actbar">' +
            '<button data-act="reselectMats" class="pill reselect-btn">↩ เปลี่ยนตัวสังเวย</button>' +
            '<button data-act="cancel" class="cancel-btn">' + esc(s.app.cancel) + '</button>' +
          '</div>' +
        '</div>';
      }

      let listHtml = '';
      if (selectedCards.length > 0) {
        listHtml = '<div class="tb-chips">' + selectedCards.map((x, idx) => {
          const lvl = x.inst.level || x.def.level || 1;
          const atk = x.inst.baseAtk != null ? CG.engine.atk(x.inst) : (x.def.atk || 0);
          return '<span class="t-chip">💀 #' + (idx + 1) + ' ช่อง ' + (x.slot + 1) + ': <b>' + esc(x.def.name) + '</b> (Lv' + lvl + ' ATK ' + atk + ')</span>';
        }).join('') + '</div>';
      } else {
        listHtml = '<div class="tb-empty">👉 แตะมอนสเตอร์บนสนามเพื่อเลือกตัวที่จะสังเวย</div>';
      }

      const statusText = 'เลเวลวัสดุรวม: ' + totalLv + ' / ต้องการ ' + reqLv + ' (Lv2 = 1+1, Lv3 = 1+2 หรือ 1+1+1)';

      return '<div class="quick-action-bar tribute-bar">' +
        '<div class="tb-info">' +
          '<div class="tb-title">💀 เสียสละมอนสเตอร์เพื่ออัญเชิญ <b>' + esc(d.name) + ' (Lv' + reqLv + ')</b></div>' +
          '<div class="tb-status' + (okSum ? ' ready' : '') + '">' + esc(statusText) + '</div>' +
          listHtml +
        '</div>' +
        '<div class="actbar">' +
          '<button data-act="mats" class="gold confirm-mats-btn" ' + (selectedCards.length ? '' : 'disabled') + '>💀 ' + esc(s.app.confirmMats) + ' (' + selectedCards.length + ' ตัว)</button>' +
          '<button data-act="cancel" class="cancel-btn">' + esc(s.app.cancel) + '</button>' +
        '</div>' +
      '</div>';
    }

    function extraBarHtml(st, viewer, sel) {
      const me = st.players[viewer];
      const c = me.extra[sel.idx];
      const d = c ? def(c) : {};
      const reqText = formatMaterialsRequirement(d);

      return '<div class="quick-action-bar extra-summon-bar">' +
        '<div class="esa-info">' +
          '<div class="esa-title">⚡ กำลังอัญเชิญพิเศษ: <b class="gold">' + esc(d.name) + '</b> <span class="esa-stats">(Lv' + (d.level || '?') + ' • ATK ' + (d.atk || 0) + ' / DEF ' + (d.def || 0) + ')</span> <span class="esa-badge ' + (d.type || '') + '">' + (d.type === 'fusion' ? '🌀 Fusion' : '👑 Grade 4') + '</span></div>' +
          '<div class="esa-req">🎯 <b>เงื่อนไข/วัสดุ:</b> ' + esc(reqText) + '</div>' +
          '<div class="esa-sub">👉 แตะมอนสเตอร์เป้าหมายบนสนาม (กรอบฟ้ากระพริบ) เพื่อใช้วางทับเป็นวัสดุ</div>' +
        '</div>' +
        '<div class="actbar">' +
          '<button data-act="cancel" class="cancel-btn">' + esc(s.app.cancel) + '</button>' +
        '</div>' +
      '</div>';
    }

    function renderBotBannerHtml(banner, fade) {
      if (!banner) return '';
      const fadeCls = fade ? ' fade' : '';
      if (typeof banner === 'string') {
        return '<div class="bot-banner' + fadeCls + '">' + esc(banner) + '</div>';
      }

      let cardVisual = '';
      if (banner.inst || banner.cardId) {
        const cardObj = banner.inst || { cardId: banner.cardId };
        cardVisual = '<div class="bba-card-preview">' + cardHtml(cardObj, { reveal: true, field: false }) + '</div>';
      } else if (banner.isSet) {
        cardVisual = '<div class="bba-card-preview"><div class="card back" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:1.8rem;">🂠</div></div>';
      }

      const isComplex = !!(banner.cardName || banner.inst || banner.cardId || banner.isSet);
      const backdrop = isComplex ? '<div class="bot-spotlight-backdrop' + fadeCls + '"></div>' : '';
      const chainBadge = banner.isChain
        ? '<span class="bba-chain-badge">⛓️ CHAIN LINK ' + (banner.linkId || 1) + '</span>'
        : '';
      const headerCls = banner.isChain ? 'bba-header is-chain' : 'bba-header';

      return backdrop + '<div class="bot-banner bot-card-announcement' + fadeCls + '">' +
        '<div class="' + headerCls + '">' +
          '<span class="bba-icon">' + (banner.icon || (banner.isChain ? '⚡' : '🤖')) + '</span>' +
          '<span class="bba-title">' + esc(banner.title || '') + '</span>' +
          chainBadge +
        '</div>' +
        '<div class="bba-content-grid">' +
          cardVisual +
          '<div class="bba-details">' +
            (banner.cardName ? '<div class="bba-card-name">' + esc(banner.cardName) + '</div>' : '') +
            (banner.stats ? '<div class="bba-card-stats">' + esc(banner.stats) + '</div>' : '') +
            (banner.desc ? '<div class="bba-card-desc">' + esc(banner.desc) + '</div>' : '') +
          '</div>' +
        '</div>' +
      '</div>';
    }

    function monRow(p, idx) {
      const isMe = idx === ctx.viewer; let h = '';
      for (let i = 0; i < p.monsters.length; i++) {
        const m = p.monsters[i];
        const cls = ['slot']; if (i === 2) cls.push('leader');
        if (isMe && (hlOwn.has(i))) cls.push('hl');
        if (!isMe && hlOpp.has(i)) cls.push('hlred');
        if (isMe && sel.kind === 'field' && sel.slot === i) cls.push('sel');
        const isTributeMat = isMe && sel && sel.kind === 'hand' && sel.mode === 'tribute' && sel.mats && sel.mats.includes(i);
        const tributeOrder = isTributeMat ? (sel.mats.indexOf(i) + 1) : 0;
        const isExtraTarget = isMe && ((sel && sel.kind === 'extra') || (sel && sel.kind === 'hand' && sel.mode === 'overlay')) && hlOwn.has(i);
        if (isTributeMat) cls.push('tribute-mat-slot');
        if (isExtraTarget) cls.push('extra-mat-slot');
        const at = ' data-p="' + idx + '" data-slot="' + i + '" data-zone2="mon"';
        const hl = ctx.cardHl && m ? ctx.cardHl[m.uid] : null;
        const ghost = !m && ctx.ghosts ? ctx.ghosts[idx + ':' + i] : null;
        const chainLink = (m && ctx.chainMap && ctx.chainMap[m.uid]) ||
                          (ctx.chainSlotMap && ctx.chainSlotMap[idx + ':mon:' + i]) || null;
        let cHtml = '';
        if (m) {
          cHtml = cardHtml(m, {
            field: true,
            reveal: isMe,
            hlClass: hl,
            chainLink: chainLink,
            sel: (sel.kind === 'attack' && isMe && sel.slot === i) || isTributeMat,
            isTributeMat: isTributeMat,
            tributeOrder: tributeOrder,
            isExtraTarget: isExtraTarget,
            attrs: at
          });
        } else if (ghost) {
          cHtml = cardHtml(ghost.card, { field: true, reveal: ghost.card.owner === ctx.viewer, hlClass: 'ev-destroyed', attrs: at });
        } else if (i === 2) {
          cHtml = '<span class="slot-watermark pioneer-wm">Pioneer</span>';
        } else {
          cHtml = '<span class="slot-watermark">Entity</span>';
        }
        h += '<div class="' + cls.join(' ') + '"' + at + '>' + cHtml + '</div>';
      }
      return '<div class="zone">' + h + '</div>';
    }
    function spellRow(p, idx) {
      const isMe = idx === ctx.viewer;
      let h = '';
      for (let i = 0; i < p.spells.length; i++) {
        const c = p.spells[i];
        const cls = ['slot', 'spellslot'];
        if (isMe && sel.kind === 'hand' && sel.mode === 'setSpell' && hlSpellOwn.has(i)) cls.push('hl');
        if (isMe && sel.kind === 'spell' && sel.slot === i) cls.push('sel');
        const at = ' data-p="' + idx + '" data-spell-slot="' + i + '" data-zone2="spell"';
        const wm = c ? '' : '<span class="slot-watermark spell-wm">Entity</span>';
        const chainLink = (c && ctx.chainMap && ctx.chainMap[c.uid]) ||
                          (ctx.chainSlotMap && ctx.chainSlotMap[idx + ':spell:' + i]) || null;
        h += '<div class="' + cls.join(' ') + '"' + at + '>' + (c ? cardHtml(c, { field: true, reveal: isMe, chainLink: chainLink, attrs: at }).replace('class="card', 'style="height:100%" class="card') : wm) + '</div>';
      }
      return '<div class="zone">' + h + '</div>';
    }

    // มือผู้เล่น (ถาด 6 ช่องตาม Wireframe พร้อมป้าย "มือ X ใบ")
    const handCount = me.hand.length;
    const maxHandSlots = Math.max(6, handCount);
    const handSel = ctx.handSel || new Set();
    let handSlotsHtml = '';
    for (let i = 0; i < maxHandSlots; i++) {
      if (i < handCount) {
        const c = me.hand[i];
        const chainLink = (c && ctx.chainMap && ctx.chainMap[c.uid]) || null;
        const isSel = (sel.kind === 'hand' && sel.idx === i) || handSel.has(c.uid);
        handSlotsHtml += '<div class="cosmic-hand-slot filled">' +
          cardHtml(c, { reveal: true, chainLink: chainLink, sel: isSel, attrs: ' data-hand="' + i + '"' }) +
        '</div>';
      } else {
        handSlotsHtml += '<div class="cosmic-hand-slot empty"><div class="empty-card-frame"></div></div>';
      }
    }

    const isPlacing = sel && !!sel.mode;
    const handCls = 'cosmic-hand-slots-tray' + (isPlacing ? ' mode-placing' : '');
    const handSectionHtml = '<div class="cosmic-hand-section">' +
      '<div class="cosmic-hand-badge">' +
        '<div class="chb-title">มือ</div>' +
        '<div class="chb-count">' + handCount + ' ใบ</div>' +
      '</div>' +
      '<div class="' + handCls + '" id="handRow">' +
        handSlotsHtml +
      '</div>' +
    '</div>';

    // มือของ AI ด้านบน (ขนาดกะทัดรัด พอรู้จำนวนตามคำขอ)
    const oppHandCount = op.hand.length;
    const maxOppSlots = Math.max(5, oppHandCount);
    let oppSlotsHtml = '';
    for (let i = 0; i < maxOppSlots; i++) {
      if (i < oppHandCount) {
        oppSlotsHtml += '<div class="ai-hand-slot filled" title="การ์ดบนมือ AI ใบที่ ' + (i + 1) + '"><div class="card back"></div></div>';
      } else {
        oppSlotsHtml += '<div class="ai-hand-slot empty"></div>';
      }
    }
    const oppHandSectionHtml = '<div class="ai-hand-section" title="มือ AI: ' + oppHandCount + ' ใบ">' +
      '<div class="ai-hand-badge"><span>AI</span><span class="ai-hand-badge-num">' + oppHandCount + ' ใบ</span></div>' +
      '<div class="ai-hand-cards-row">' + oppSlotsHtml + '</div>' +
    '</div>';

    // แถบกลาง: คำแนะนำ + ปุ่ม
    let mid = '';
    const inMain = st.phase === 'main1' || st.phase === 'main2';
    if (st.ended) mid = '';
    else if (ctx.botBusy) {
      mid = '<div class="hint pulse">' + (a.botPlaying || 'บอทกำลังเล่น…') + '</div>';
    }
    else if (sel.kind === 'hand') {
      const c = me.hand[sel.idx], d = def(c);
      const menuActions = V.getMenuActions(st, ctx.viewer, sel, ctx.legal);
      if (!sel.mode) {
        mid = '';
      } else if (sel.mode === 'effects') {
        const effBtns = menuActions.filter(x => x.type === 'activateEffect');
        let effRows = '';
        for (const eb of effBtns) {
          const efDef = (d.effects || []).find(e => e.id === eb.action.effectId) || {};
          const efText = efDef.text || efDef.name || eb.label;
          if (eb.enabled) {
            effRows += '<button data-act="actEff:hand:' + esc(eb.action.effectId) + '" class="gold eff-row-btn"><b>' + esc(eb.label) + '</b><span class="eff-desc">' + esc(efText) + '</span></button>';
          } else {
            effRows += '<button disabled class="dis-btn eff-row-btn" title="' + esc(eb.reason || '') + '"><b>' + esc(eb.label) + '</b><span class="eff-desc">' + esc(efText) + ' (' + esc(eb.reason || 'ใช้ไม่ได้') + ')</span></button>';
          }
        }
        mid = '<div class="hint">เลือกเอฟเฟกต์ที่จะใช้</div><div class="actbar eff-list-bar">' + effRows + '<button data-act="cancel">' + a.cancel + '</button></div>';
      } else if (sel.mode === 'setSpell') {
        mid = '';
      } else if (sel.mode === 'overlay') {
        mid = '';
      } else if (sel.mode === 'tribute') {
        mid = '';
      } else mid = '';
    } else if (sel.kind === 'extra') {
      mid = '';
    } else if (sel.kind === 'field') {
      const m = me.monsters[sel.slot];
      const menuActions = V.getMenuActions(st, ctx.viewer, sel, ctx.legal);
      let btns = '';
      if (!sel.mode) {
        mid = '';
      } else if (sel.mode === 'effects') {
        mid = '';
      }
    } else if (sel.kind === 'spell') {
      mid = '';
    } else if (sel.kind === 'attack') {
      mid = '';
    } else if (mine && !st.pending && st.phase !== 'mulligan') {
      // 3) ปุ่มเฟสและจบเทิร์นรวมเป็นปุ่มเดียวแล้ว (ลบปุ่มแยกเดิมออกจากกลางสนาม)
      mid = '';
    }

    const bannerHtml = ctx.botBanner ? renderBotBannerHtml(ctx.botBanner, ctx.botBannerFade) : '';

    // 2) ช่อง Field กลางสนาม (สี่เหลี่ยมพอร์ทัลคริสตัลสีฟ้า "ช่องสนาม Field")
    const fsCard = me.fieldSpell || op.fieldSpell;
    let sharedFieldHtml = '';
    if (fsCard) {
      sharedFieldHtml = '<div class="slot cosmic-slot cosmic-field-slot has-card" data-zone2="field">' +
        cardHtml(fsCard, { field: true, reveal: true, attrs: ' data-zone2="field"' }).replace('class="card', 'style="height:100%" class="card') +
      '</div>';
    } else {
      sharedFieldHtml = '<div class="slot cosmic-slot cosmic-field-slot empty" data-zone2="field">' +
        '<span class="cosmic-slot-wm field-slot-wm">ช่องสนาม<br><small style="font-size:0.75em;opacity:0.85">Field</small></span>' +
      '</div>';
    }

    // 3) แถบแสดงสถานะและปุ่มควบคุมเฟสแนวตั้งด้านขวา (Phase Tracker) ตามแบบพิมพ์เขียว
    const canPhaseAct = mine && !ctx.botBusy && !st.ended && !st.pending && st.phase !== 'mulligan' && ['main1', 'battle', 'main2'].includes(st.phase);
    const cosmicPhaseTracker = '<div class="cosmic-phase-pillar">' +
      '<div class="cpt-turn-circle"><span class="cpt-turn-lbl">เทิร์น</span><span class="cpt-turn-num">' + st.turn + '</span></div>' +
      '<button class="cpt-phase-btn ' + (st.phase === 'main1' ? 'active' : '') + '" title="เมนเฟส 1">เมน 1</button>' +
      '<button class="cpt-phase-btn ' + (st.phase === 'battle' ? 'active' : '') + '" ' + (canPhaseAct && st.phase === 'main1' ? 'data-act="next"' : '') + ' title="เฟสต่อสู้">ต่อสู้</button>' +
      '<button class="cpt-phase-btn ' + (st.phase === 'main2' ? 'active' : '') + '" ' + (canPhaseAct && st.phase === 'battle' ? 'data-act="next"' : '') + ' title="เมนเฟส 2">เมน 2</button>' +
      '<button class="cpt-phase-btn cpt-end-btn" data-act="end" ' + (canPhaseAct ? '' : 'disabled') + ' title="จบเทิร์น">จบเทิร์น</button>' +
      '<div class="cpt-turn-circle"><span class="cpt-turn-lbl">เทิร์น</span><span class="cpt-turn-num">' + st.turn + '</span></div>' +
    '</div>';

    const centerDivider = '<div class="cosmic-center-divider">' +
      '<div class="cosmic-brand-title brand-arcana">Arcana</div>' +
      '<div class="cosmic-field-slot-wrap">' +
        sharedFieldHtml +
      '</div>' +
      '<div class="cosmic-brand-title brand-frontier">Frontier</div>' +
    '</div>';

    const oppSideHtml = sketchSideHtml(op, 1 - ctx.viewer, true);
    const selfSideHtml = sketchSideHtml(me, ctx.viewer, false);

    let modalHtml = '';
    if (ctx.inspectCard) {
      modalHtml = V.cardDetailModal(st, ctx.viewer, ctx.inspectCard.inst, ctx.inspectCard.isOpponent, ctx.sel, ctx.legal);
    }

    // แถบคำสั่งลอยด่วนบนกระดานแบบยูกิ (Quick Action Bar ไม่ต้องเปิดหน้าต่างยักษ์มาบังกระดาน)
    let quickActionHtml = '';
    if (mine && !st.ended && !st.pending) {
      if (sel && sel.kind === 'attack') {
        const canDirect = ctx.legal.some(x => x.type === 'attack' && x.from === sel.slot && x.to === null);
        quickActionHtml = '<div class="quick-action-bar atk-bar">' +
          '<span class="quick-act-hint">⚔️ ' + esc(a.pickTarget) + '</span>' +
          (canDirect ? '<button class="quick-act-btn danger" data-act="direct">⚔️ ' + esc(a.attackDirect) + '</button>' : '') +
          '<button class="quick-act-btn cancel" data-act="cancel">✕ ' + esc(a.cancel) + '</button>' +
        '</div>';
      } else if (sel && sel.kind === 'hand' && sel.mode === 'tribute') {
        quickActionHtml = tributeBarHtml(st, ctx.viewer, sel);
      } else if (sel && sel.kind === 'extra' && sel.mode === 'extra') {
        quickActionHtml = extraBarHtml(st, ctx.viewer, sel);
      } else if (sel && sel.kind === 'hand' && sel.mode === 'normal') {
        quickActionHtml = '<div class="quick-action-bar pick-slot-bar"><span class="quick-act-hint">👉 ' + esc(a.pickSlot) + '</span><button class="quick-act-btn cancel" data-act="cancel">✕ ' + esc(a.cancel) + '</button></div>';
      } else if (sel && sel.kind === 'hand' && sel.mode === 'set') {
        quickActionHtml = '<div class="quick-action-bar"><span class="quick-act-hint">👉 ' + esc(a.pickSlot) + '</span><button class="quick-act-btn cancel" data-act="cancel">✕ ' + esc(a.cancel) + '</button></div>';
      } else if (sel && sel.kind === 'hand' && sel.mode === 'setSpell') {
        quickActionHtml = '<div class="quick-action-bar"><span class="quick-act-hint">👉 ' + esc(a.pickSpellSlot || 'เลือกช่องสเปลที่จะวางคว่ำ') + '</span><button class="quick-act-btn cancel" data-act="cancel">✕ ' + esc(a.cancel) + '</button></div>';
      } else if (sel && sel.kind === 'hand' && sel.mode === 'overlay') {
        quickActionHtml = '<div class="quick-action-bar pick-slot-bar"><span class="quick-act-hint">👉 ' + esc(a.pickOverlayTarget) + '</span><button class="quick-act-btn cancel" data-act="cancel">✕ ' + esc(a.cancel) + '</button></div>';
      } else if (sel && !sel.mode) {
        let cardInst = null;
        if (sel.kind === 'hand') cardInst = me.hand[sel.idx];
        else if (sel.kind === 'field') cardInst = me.monsters[sel.slot];
        else if (sel.kind === 'spell') cardInst = me.spells[sel.slot];
        else if (sel.kind === 'extra') cardInst = me.extra[sel.idx];

        if (cardInst) {
          const menuActions = V.getMenuActions(st, ctx.viewer, sel, ctx.legal);
          let btns = '';
          if (sel.kind === 'hand') {
            const canNorm = menuActions.find(x => x.type === 'normalSummon' && x.enabled);
            const canSet = menuActions.find(x => x.type === 'setMonster' && x.enabled);
            const canTrib = menuActions.find(x => x.type === 'tributeSummon' && x.enabled);
            const canOver = menuActions.find(x => x.type === 'overlay' && x.enabled);
            const canSpell = menuActions.find(x => x.type === 'activateSpell' && x.enabled);
            const canSetSpell = menuActions.find(x => x.type === 'setSpell' && x.enabled);

            if (canNorm) btns += '<button class="quick-act-btn gold" data-act="mode:normal">⚔️ ' + esc(a.summon) + '</button>';
            if (canSet) btns += '<button class="quick-act-btn" data-act="mode:set">🛡️ ' + esc(a.setMon) + '</button>';
            if (canTrib) btns += '<button class="quick-act-btn gold" data-act="mode:tribute">⚔️ ' + esc(a.tribute) + '</button>';
            if (canOver) btns += '<button class="quick-act-btn gold" data-act="mode:overlay">💫 วางทับ</button>';
            if (canSpell) {
              const cd = E.cardOf(cardInst);
              const isField = cd && (cd.field || cd.group === 'field');
              const isEquip = cd && (cd.equip || cd.group === 'equip' || ((cd.tags || []).includes('equip')));
              const actText = isField ? (a.activateField || 'ร่ายเวทสนาม') : isEquip ? 'สวมใส่' : (a.activateSpell || 'ใช้สเปล');
              btns += '<button class="quick-act-btn gold" data-act="actSpell">' + (isEquip ? '⚔️ ' : '⚡ ') + esc(actText) + '</button>';
            }
            if (canSetSpell) btns += '<button class="quick-act-btn" data-act="mode:setSpell">🛡️ ' + esc(a.setSpell || 'Set สเปล') + '</button>';

            const effActs = menuActions.filter(x => x.type === 'activateEffect' && x.enabled);
            effActs.forEach(eb => {
              btns += '<button class="quick-act-btn gold" data-act="actEff:hand:' + esc(eb.action.effectId) + '">✨ ' + esc(eb.label) + '</button>';
            });
          } else if (sel.kind === 'field') {
            if (cardInst.faceDown) {
              const canFlip = menuActions.some(x => x.type === 'flipSummon' && x.enabled);
              if (canFlip) btns += '<button class="quick-act-btn gold" data-act="flip">✨ ' + esc(a.flip) + '</button>';
            } else {
              if (st.phase === 'battle') {
                const canAtk = menuActions.some(x => x.type === 'attack' && x.enabled);
                if (canAtk) btns += '<button class="quick-act-btn danger" data-act="atk">⚔️ ' + esc(a.attack) + '</button>';
              }
              const canPos = menuActions.some(x => x.type === 'changePosition' && x.enabled);
              if (canPos) {
                const curPos = (m && m.position) || 'atk';
                const posBtnLabel = curPos === 'atk' ? '🛡️ ตั้งป้องกัน' : '⚔️ ตั้งโจมตี';
                btns += '<button class="quick-act-btn" data-act="pos">' + posBtnLabel + '</button>';
              }

              const effActs = menuActions.filter(x => x.type === 'activateEffect' && x.enabled);
              effActs.forEach(eb => {
                btns += '<button class="quick-act-btn gold" data-act="actEff:field:' + esc(eb.action.effectId) + '">✨ ' + esc(eb.label) + '</button>';
              });
            }
          } else if (sel.kind === 'spell') {
            const canAct = menuActions.find(x => x.type === 'activateSpell' && x.enabled);
            if (canAct) btns += '<button class="quick-act-btn gold" data-act="actSpellField">⚡ ' + esc(canAct.label) + '</button>';
          } else if (sel.kind === 'extra') {
            const canExtra = menuActions.find(x => x.type === 'extraSummon' && x.enabled);
            if (canExtra) btns += '<button class="quick-act-btn gold" data-act="mode:extra">💫 ' + esc(canExtra.label) + '</button>';
          }

          if (btns) {
            const barType = sel.kind === 'field' ? 'field-bar' : 'hand-bar';
            quickActionHtml = '<div class="quick-action-bar ' + barType + '">' +
              btns +
              '<button class="quick-act-btn cancel" data-act="cancel">✕</button>' +
            '</div>';
          } else if (sel.kind === 'hand') {
            const cd = E.cardOf(cardInst);
            const disabledAct = menuActions.find(x => !x.enabled && x.reason);
            let reasonText = disabledAct ? disabledAct.reason : '';
            if (!reasonText && cd) {
              if (cd.type !== 'spell' && cd.level > 1) {
                reasonText = (cd.name || 'การ์ดนี้') + ' (Lv.' + cd.level + ') ต้องสังเวยมอนสเตอร์บนสนาม';
              } else {
                reasonText = 'ยังไม่สามารถใช้การ์ดใบนี้ได้ในขณะนี้';
              }
            }
            quickActionHtml = '<div class="quick-action-bar hand-bar unusable-bar">' +
              '<span class="quick-act-hint-warn">⚠ ' + esc(reasonText) + '</span>' +
              '<button class="quick-act-btn cancel" data-act="cancel">✕</button>' +
            '</div>';
          }
        }
      }
    }

    const tutorialBar = st.tutorial
      ? '<div class="tutorial-guide-banner"><span>🎓 <b>' + esc(st.tutorial.title) + ':</b> ' + esc(st.tutorial.hint) + '</span><button class="pill" data-act="exitTutorial">↩ จบบทเรียน</button></div>'
      : '';

    root.innerHTML = top + tutorialBar + '<div class="main"><div class="board cosmic-mat-board">' +
      bannerHtml +
      quickActionHtml +
      oppHandSectionHtml +
      '<div class="cosmic-arena-layout">' +
        '<div class="cosmic-left-col">' +
          playerPanel(op, 1 - ctx.viewer, true) +
          playerPanel(me, ctx.viewer, false) +
        '</div>' +
        '<div class="cosmic-center-col">' +
          oppSideHtml +
          centerDivider +
          selfSideHtml +
        '</div>' +
        '<div class="cosmic-right-col">' +
          cosmicPhaseTracker +
        '</div>' +
      '</div>' +
      handSectionHtml +
      '<div class="side ' + (CG.ui.sideOpen ? '' : 'side-collapsed') + '"><div id="inspect"><div class="m">' + a.inspectHint + '</div></div><h3>' + a.logTitle + '</h3><div id="log"></div></div></div>' +
      modalHtml;
  };

  V.inspectHtml = function (inst, viewer) {
    const d = def(inst), s = S(), a = s.app;
    if (inst.faceDown && inst.controller !== viewer) return '<div class="m">' + s.app.cardBack + '</div>';
    const mon = d.type !== 'spell';
    const E = CG.engine;
    const atk = mon && inst.baseAtk != null ? E.atk(inst) : (d.atk != null ? d.atk : 0);
    const dfn = mon && inst.baseDef != null ? E.def(inst) : (d.def != null ? d.def : 0);
    const lvl = inst.level != null ? inst.level : (d.level != null ? d.level : 1);

    const miniCard = cardHtml(inst, { reveal: true, field: false });

    let stats = '';
    if (mon) {
      stats = '<div class="inspect-stats"><span class="stat-badge lvl">★ ' + lvl + '</span> <span class="stat-badge atk">' + (a.atk || 'ATK') + ' ' + atk + '</span> <span class="stat-badge def">' + (a.def || 'DEF') + ' ' + dfn + '</span></div>';
    } else {
      const grpKey = (d.field || d.group === 'field') ? 'field' : d.group;
      const spGroup = s.spellGroup[grpKey] || d.group || 'ปกติ';
      stats = '<div class="inspect-stats"><span class="stat-badge spell">' + esc(s.type.spell || 'สเปล') + ' · ' + esc(spGroup) + '</span>' + (d.mana ? ' <span class="stat-badge mana">' + (a.manaCost || 'มานา') + ' ' + d.mana + '</span>' : '') + '</div>';
    }

    return '<div class="inspect-card-box" data-act="zoomCardDetail" title="🔍 แตะเพื่อเปิดอ่านแบบจอใหญ่">' +
      '<div class="inspect-card-wrap">' + miniCard + '</div>' +
      '<div class="inspect-zoom-hint">🔍 แตะเพื่ออ่านเต็มจอ</div>' +
      '</div>' +
      '<div class="inspect-info">' +
        '<div class="t">' + esc(d.name) + '</div>' +
        stats +
        (V.formatMaterialsRequirement(d) ? '<div class="m materials" style="color:var(--gold);font-weight:700">🎯 ' + esc(V.formatMaterialsRequirement(d)) + '</div>' : '') +
        '<div class="inspect-text">' + esc(d.text || '') + '</div>' +
      '</div>';
  };

  // 5) หน้าต่างเลือกการ์ด (chooseTarget / chooseCards) ยกเครื่องใหม่: การ์ดจริง แถวเลื่อนได้ ดูเอฟเฟกต์
  function showCardInspectOverlay(cDef) {
    const s = S(), a = s.app;
    const mon = cDef.type !== 'spell';
    const oldOv = document.getElementById('inspectOverlay');
    if (oldOv) oldOv.remove();
    const ov = document.createElement('div');
    ov.id = 'inspectOverlay';
    ov.className = 'overlay inspect-overlay';
    ov.style.zIndex = '10001';
    let stats = '';
    if (mon) {
      stats = '<div class="m">' + a.lvl + ' ' + (cDef.level || 1) + ' · ' + a.atk + ' ' + (cDef.atk || 0) + ' / ' + a.def + ' ' + (cDef.def || 0) + '</div>';
    } else {
      const grpKey = (cDef.field || cDef.group === 'field') ? 'field' : cDef.group;
      stats = '<div class="m">' + (s.spellGroup[grpKey] || cDef.group || '') + '</div>';
    }
    ov.innerHTML = '<div class="modal inspect-modal">' +
      '<div class="t" style="color:var(--gold);font-weight:800;font-size:1.1rem;margin-bottom:6px">' + esc(cDef.name) + '</div>' +
      stats +
      (cDef.mana ? '<div class="m">' + a.manaCost + ': ' + esc(cDef.mana) + '</div>' : '') +
      (V.formatMaterialsRequirement(cDef) ? '<div class="m materials" style="color:var(--gold);font-weight:700;margin:4px 0">🎯 ' + esc(V.formatMaterialsRequirement(cDef)) + '</div>' : '') +
      '<div class="inspect-text" style="text-align:left;margin:12px 0;padding:8px;background:rgba(0,0,0,0.5);border-radius:6px;font-size:.85rem;line-height:1.4">' + esc(cDef.text || '(ไม่มีข้อความเอฟเฟกต์)') + '</div>' +
      '<button class="gold btn-close-inspect">ปิด</button>' +
      '</div>';
    ov.onclick = function (e) {
      if (e.target === ov || e.target.classList.contains('btn-close-inspect')) ov.remove();
    };
    document.body.appendChild(ov);
  }

})();

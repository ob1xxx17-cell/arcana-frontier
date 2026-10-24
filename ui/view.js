// ui/view.js - วาดหน้าจอจาก state (อ่านอย่างเดียว) + แปล events เป็นข้อความ ไม่แก้ state เด็ดขาด
(function () {
  const CG = (globalThis.CG = globalThis.CG || {});
  CG.ui = CG.ui || {};
  const V = (CG.ui.view = {});
  const S = () => CG.ui.strings;
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  V.esc = esc;
  const def = (inst) => CG.engine.cardOf(inst) || { name: '?', type: 'monster', text: '' };
  V.def = def;

  // แผนที่ uid -> CardInstance จากทุกโซน (ใช้ตั้งชื่อใน log)
  V.uidMap = function (state) {
    const m = {};
    const add = (c) => { if (!c) return; m[c.uid] = c; (c.under || []).forEach(add); };
    state.players.forEach(p => { ['deck', 'hand', 'extra', 'grave', 'removed', 'monsters', 'spells'].forEach(z => p[z].forEach(add)); add(p.fieldSpell); });
    return m;
  };
  V.pname = (state, i) => (i === 0 ? S().app.p1 : (state.mode === 'bot' ? S().app.bot : S().app.p2));

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
      case 'statChange': return fill(e.statChange, { c: nm(ev.uid), stat: ev.stat, d: ev.delta });
      case 'moveCard': {
        const c = map[ev.uid]; if (!c) return null;
        if ((ev.to === 'deck' || ev.from === 'deck' || ev.to === 'hand' || ev.from === 'hand') && c.owner !== viewer) return null;
        if (ev.from === 'monster' && ev.to === 'grave') return null; // มี destroy แสดงอยู่แล้ว
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
          label = (a.activateSpell || 'ใช้สเปล') + (cardName ? ': ' + cardName : '');
          id = 'activateSpell:hand:' + act.handIdx;
        } else if (act.spellSlot !== undefined) {
          const c = p.spells[act.spellSlot];
          const d = E.cardOf(c);
          cardName = d ? d.name : '';
          label = (a.activateSpellSlot || s.chain.activateSet || 'เปิดใช้') + ' ' + (cardName || s.term.spell) + ' (ช่อง ' + (act.spellSlot + 1) + ')';
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
        label = a.changePos;
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
          }
          buttons.push({
            id: 'activateSpell:disabled',
            type: 'activateSpell',
            label: a.activateSpell || 'ใช้สเปล',
            enabled: false,
            reason: reason || s.errors.NOT_IN_ZONE || 'ใช้ไม่ได้ในขณะนี้'
          });
        }
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
    if (inst.faceDown) cls.push('fd' + (o.reveal ? ' mine-fd' : ''));
    if (inst.position === 'def' && !inst.faceDown) cls.push('def');
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

    // 1. ไอคอนแท็ก 1 อัน กึ่งกลางบน (สเปลแสดงวงกลมน้ำเงินพร้อมชื่อกลุ่ม sp-badge)
    let iconHtml = '';
    const iconName = getCardIcon(d);
    if (iconName) {
      iconHtml = '<img class="tag-icon" src="assets/icons/' + iconName + '.png" alt="' + iconName + '">';
    } else if (d.type === 'spell') {
      const spText = s.spellGroup[d.group] || d.group || '';
      iconHtml = '<span class="sp-circle sp-badge">' + esc(spText) + '</span>';
    }
    const iconArea = '<div class="card-icon-area">' + iconHtml + '</div>';

    // 2. ภาพการ์ด (ช่องว่างไว้ก่อน ใช้พื้นสีตามชนิด)
    const artHtml = '<div class="card-art art-' + d.type + '"></div>';

    // 3. แถวค่า: ATK วงรีแดงซ้าย, Level วงกลมเหลืองกลาง, DEF วงรีน้ำเงินขวา
    let statsHtml = '';
    if (mon) {
      statsHtml = '<div class="card-stats">' +
        '<span class="stat-pill stat-atk">' + atk + '</span>' +
        '<span class="stat-circle stat-lv">' + lvl + '</span>' +
        '<span class="stat-pill stat-def">' + dfn + '</span>' +
        '</div>';
    } else {
      statsHtml = '<div class="card-stats sp-stat-row">' +
        '<span class="sp-type-label">' + esc(s.type.spell) + '</span>' +
        '</div>';
    }

    // 4. แถบชื่อ
    const nameHtml = '<div class="card-name nm">' + esc(d.name) + '</div>';

    // 5. กรอบข้อความเอฟเฟกต์ (d.text)
    let textHtml = '';
    if (d.text) {
      const textLen = d.text.length;
      let textLenClass = '';
      if (textLen > 100) textLenClass = ' text-xs';
      else if (textLen > 50) textLenClass = ' text-sm';
      textHtml = '<div class="card-text' + textLenClass + '">' + esc(d.text) + '</div>';
    }

    // Badge ท่าป้องกัน / ตัวใต้การ์ด
    let extraBadges = '';
    if (onField && mon) {
      extraBadges += '<div class="pos">' + (inst.faceDown ? '' : inst.position === 'atk' ? '⚔' : '🛡') + '</div>';
    }
    if (inst.under && inst.under.length) {
      extraBadges += '<div class="under">+' + inst.under.length + '</div>';
    }

    return '<div class="' + cls.join(' ') + '"' + data + '>' +
      iconArea +
      artHtml +
      statsHtml +
      nameHtml +
      textHtml +
      extraBadges +
      '</div>';
  }
  V.cardHtml = cardHtml;

  CG.ui.sideOpen = (CG.ui.sideOpen !== undefined) ? CG.ui.sideOpen : (typeof window !== 'undefined' ? window.innerWidth > 820 : true);
  CG.ui.toggleSide = function () {
    CG.ui.sideOpen = !CG.ui.sideOpen;
    const sideEl = document.querySelector('.side');
    const btn = document.getElementById('btnSideToggle');
    if (sideEl) sideEl.classList.toggle('side-collapsed', !CG.ui.sideOpen);
    if (btn) btn.textContent = CG.ui.sideOpen ? '📜 ปิดบันทึก' : '📜 บันทึก';
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

    // ขวาบน = แถวค่า: ATK วงรีแดง | Level วงกลมเหลือง | DEF วงรีน้ำเงิน (การ์ดสเปลแสดงชนิดแทน)
    let statsRowHtml = '';
    if (mon) {
      statsRowHtml = '<div class="detail-stats-row">' +
        '<div class="detail-stat-oval stat-oval-atk"><span class="stat-lbl">' + (a.atk || 'ATK') + '</span> <span class="stat-val">' + atk + '</span></div>' +
        '<div class="detail-stat-circle stat-circle-lvl"><span class="stat-lbl">★</span><span class="stat-val">' + lvl + '</span></div>' +
        '<div class="detail-stat-oval stat-oval-def"><span class="stat-lbl">' + (a.def || 'DEF') + '</span> <span class="stat-val">' + dfn + '</span></div>' +
      '</div>';
    } else {
      const spGroup = s.spellGroup[d.group] || d.group || 'ปกติ';
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
        if (!isOpponent && legalActions) {
          if (sel && sel.kind === 'hand') {
            const canAct = legalActions.some(x => x.type === 'activateEffect' && x.handIdx === sel.idx && x.effectId === eff.id);
            if (canAct) {
              isUsable = true;
              actData = ' data-act="actEff:hand:' + esc(eff.id) + '"';
            }
          } else if (sel && sel.kind === 'field') {
            const canAct = legalActions.some(x => x.type === 'activateEffect' && x.slot === sel.slot && x.effectId === eff.id);
            if (canAct) {
              isUsable = true;
              actData = ' data-act="actEff:field:' + esc(eff.id) + '"';
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
            else reason = 'เงื่อนไขยังไม่ครบ';
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

    // ใต้ช่องเอฟเฟกต์ = กล่องข้อความเต็มของการ์ด (d.text)
    const fullTextHtml = '<div class="detail-full-text">' +
      '<div class="full-text-title">คำอธิบายการ์ด</div>' +
      '<div class="full-text-content">' + esc(d.text || '(ไม่มีข้อความเอฟเฟกต์)') + '</div>' +
    '</div>';

    // ล่างสุด = แถบคำสั่งสีม่วงแบ่งเป็นช่อง (cell)
    let commandCellsHtml = '';
    if (isOpponent) {
      commandCellsHtml = '<button class="cmd-cell btn-close enabled" data-act="closeModal">' + esc(a.close) + '</button>';
    } else {
      const menuActions = sel ? V.getMenuActions(state, viewer, sel, legalActions) : [];
      let btns = '';

      if (sel && sel.kind === 'hand') {
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
      } else if (sel && sel.kind === 'field') {
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
          if (canPos) btns += '<button class="cmd-cell enabled" data-act="pos">' + esc(a.changePos) + '</button>';
          else {
            const dis = menuActions.find(x => x.type === 'changePosition' && !x.enabled);
            if (dis) btns += '<button class="cmd-cell disabled" data-reason="' + esc(dis.reason || '') + '">' + esc(a.changePos) + '</button>';
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
      } else if (sel && sel.kind === 'spell') {
        const canAct = menuActions.find(x => x.type === 'activateSpell' && x.enabled);
        if (canAct) {
          btns += '<button class="cmd-cell enabled" data-act="actSpellField">' + esc(canAct.label) + '</button>';
        } else {
          const dis = menuActions.find(x => x.type === 'activateSpell' && !x.enabled);
          if (dis) btns += '<button class="cmd-cell disabled" data-reason="' + esc(dis.reason || '') + '">' + esc(dis.label) + '</button>';
        }
      } else if (sel && sel.kind === 'extra') {
        const canExtra = menuActions.find(x => x.type === 'extraSummon' && x.enabled);
        if (canExtra) {
          btns += '<button class="cmd-cell enabled" data-act="callExtra:' + sel.idx + '">' + esc(a.extraSummon) + '</button>';
        } else {
          const dis = menuActions.find(x => x.type === 'extraSummon' && !x.enabled);
          if (dis) btns += '<button class="cmd-cell disabled" data-reason="' + esc(dis.reason || '') + '">' + esc(a.extraSummon) + '</button>';
        }
      }

      commandCellsHtml = btns + '<button class="cmd-cell btn-close enabled" data-act="closeModal">' + esc(a.close) + '</button>';
    }

    const commandBarHtml = '<div class="detail-command-bar-wrap">' +
      (!isOpponent ? '<div class="command-reason-box" id="cmdReasonBox"></div>' : '') +
      '<div class="detail-command-bar">' + commandCellsHtml + '</div>' +
    '</div>';

    return '<div class="card-detail-overlay" data-act="closeModal">' +
      '<div class="card-detail-modal" onclick="event.stopPropagation()">' +
        '<button class="detail-close-btn" data-act="closeModal" title="ปิด">✕</button>' +
        '<div class="detail-modal-body">' +
          '<div class="detail-left-col"><div class="detail-big-card-wrap">' + largeCardHtml + '</div></div>' +
          '<div class="detail-right-col">' +
            '<div class="detail-top-info">' +
              '<div class="detail-card-name">' + esc(d.name) + '</div>' +
              statsRowHtml +
            '</div>' +
            effectsGridHtml +
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
    const st = ctx.state, me = st.players[ctx.viewer], op = st.players[1 - ctx.viewer], s = S(), a = s.app;
    const mine = st.activeIdx === ctx.viewer;
    const sel = ctx.sel || {};
    const botTurn = st.mode === 'bot' && st.phase !== 'mulligan' && st.activeIdx === 1;

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
      return '<div class="piles-grid">' +
        '<div class="pile-box pile-deck" data-zone="' + idx + ':deck" title="' + esc(s.app.deck) + '">' +
          '<div class="pile-header"><span class="pile-icon">📚</span><span class="pile-title">Chronicle</span></div>' +
          '<div class="pile-num">' + p.deck.length + '</div>' +
        '</div>' +
        '<div class="pile-box pile-grave" data-zone="' + idx + ':grave" title="' + esc(s.app.grave) + '">' +
          '<div class="pile-header"><span class="pile-icon">🕳️</span><span class="pile-title">Abyss</span></div>' +
          '<div class="pile-num">' + p.grave.length + '</div>' +
        '</div>' +
        '<div class="pile-box pile-extra" data-zone="' + idx + ':extra" title="' + esc(s.app.extraDeck) + '">' +
          '<div class="pile-header"><span class="pile-icon">🌌</span><span class="pile-title">Astral</span></div>' +
          '<div class="pile-num">' + p.extra.length + '</div>' +
          '<div class="pile-sub-r-a">R:' + resCount + ' A:' + apexCount + '</div>' +
        '</div>' +
        '<div class="pile-box pile-removed" data-zone="' + idx + ':removed" title="' + esc(s.app.removed) + '">' +
          '<div class="pile-header"><span class="pile-icon">⚡</span><span class="pile-title">Exile</span></div>' +
          '<div class="pile-num">' + p.removed.length + '</div>' +
        '</div>' +
      '</div>';
    }

    // แผงขวา: วงกลมชื่อผู้เล่น, FP, Arcana, เทิร์น, เวลา
    function playerPanel(p, idx) {
      const act = st.activeIdx === idx && st.phase !== 'mulligan';
      const fpPct = Math.max(0, Math.min(100, (p.lp / 8000) * 100));
      const manaPct = Math.max(0, Math.min(100, (p.mana / 10) * 100));
      const name = esc(V.pname(st, idx));
      const timers = (ctx.timers || (CG.ui && CG.ui.timers)) || {};
      const timeVal = fmtTime(timers['p' + idx]);
      const isLowFp = p.lp <= 2500;
      return '<div class="player-panel ' + (act ? 'active' : '') + '">' +
        '<div class="panel-top-row">' +
          '<div class="player-avatar-circle" title="' + name + '">' + name.slice(0, 3) + '</div>' +
          '<div class="panel-meta-col">' +
            '<div class="meta-badge turn-box"><span class="meta-tag">' + esc(a.turn) + '</span> <span class="meta-val">' + st.turn + '</span></div>' +
            '<div class="meta-badge time-box"><span class="meta-tag">⏱</span> <span class="meta-val" data-time-p="' + idx + '">' + timeVal + '</span></div>' +
          '</div>' +
        '</div>' +
        '<div class="panel-stat-bars">' +
          '<div class="stat-bar-group fp-group">' +
            '<div class="bar-info"><span class="bar-lbl">FP</span><span class="lp bar-num" data-lp="' + idx + '">' + p.lp + '</span></div>' +
            '<div class="bar-track"><div class="bar-fill fp-fill ' + (isLowFp ? 'is-low' : '') + '" style="width:' + fpPct + '%"></div></div>' +
          '</div>' +
          '<div class="stat-bar-group mana-group">' +
            '<div class="bar-info"><span class="bar-lbl">Arcana</span><span class="mana bar-num">' + p.mana + '</span></div>' +
            '<div class="bar-track"><div class="bar-fill mana-fill" style="width:' + manaPct + '%"></div></div>' +
          '</div>' +
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
    if (sel.kind === 'hand' && sel.mode === 'setSpell') {
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

    function monRow(p, idx) {
      const isMe = idx === ctx.viewer; let h = '';
      for (let i = 0; i < p.monsters.length; i++) {
        const m = p.monsters[i];
        const cls = ['slot']; if (i === 2) cls.push('leader');
        if (isMe && (hlOwn.has(i))) cls.push('hl');
        if (!isMe && hlOpp.has(i)) cls.push('hlred');
        if (isMe && sel.kind === 'field' && sel.slot === i) cls.push('sel');
        const at = ' data-p="' + idx + '" data-slot="' + i + '" data-zone2="mon"';
        const hl = ctx.cardHl && m ? ctx.cardHl[m.uid] : null;
        const ghost = !m && ctx.ghosts ? ctx.ghosts[idx + ':' + i] : null;
        let cHtml = '';
        if (m) {
          cHtml = cardHtml(m, { field: true, reveal: isMe, hlClass: hl, sel: (sel.kind === 'attack' && isMe && sel.slot === i) || (sel.kind === 'hand' && sel.mode === 'tribute' && isMe && sel.mats.includes(i)), attrs: at });
        } else if (ghost) {
          cHtml = cardHtml(ghost.card, { field: true, reveal: ghost.card.owner === ctx.viewer, hlClass: 'ev-destroyed', attrs: at });
        } else if (i === 2) {
          cHtml = '<span class="slot-watermark pioneer-wm">' + esc(s.app.slotPioneer || 'PIONEER') + '</span>';
        } else {
          cHtml = '<span class="slot-watermark">' + esc(s.app.slotEntity || 'ENTITY') + '</span>';
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
        const wm = c ? '' : '<span class="slot-watermark spell-wm">' + esc(s.app.slotDistortion || 'DISTORTION') + '</span>';
        h += '<div class="' + cls.join(' ') + '"' + at + '>' + (c ? cardHtml(c, { field: true, reveal: isMe, attrs: at }).replace('class="card', 'style="height:100%" class="card') : wm) + '</div>';
      }
      return '<div class="zone">' + h + '</div>';
    }

    // มือ
    const handSel = ctx.handSel || new Set();
    const handHtml = me.hand.map((c, i) => cardHtml(c, { reveal: true, sel: (sel.kind === 'hand' && sel.idx === i) || handSel.has(c.uid), attrs: ' data-hand="' + i + '"' })).join('');
    const oppHand = op.hand.map(() => cardHtml(null, { back: true })).join('');

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
        mid = '<div class="hint">' + (a.pickSpellSlot || 'เลือกช่องสเปลที่จะวางคว่ำ') + '</div><div class="actbar"><button data-act="cancel">' + a.cancel + '</button></div>';
      } else if (sel.mode === 'overlay') {
        mid = '<div class="hint">' + a.pickOverlayTarget + '</div><div class="actbar"><button data-act="cancel">' + a.cancel + '</button></div>';
      } else if (sel.mode === 'tribute' && !sel.matsOk) {
        mid = '<div class="hint">' + a.pickMats + '</div><div class="actbar"><button data-act="mats" class="gold">' + a.confirmMats + ' (' + sel.mats.length + ')</button><button data-act="cancel">' + a.cancel + '</button></div>';
      } else mid = '<div class="hint">' + a.pickSlot + '</div><div class="actbar"><button data-act="cancel">' + a.cancel + '</button></div>';
    } else if (sel.kind === 'extra') {
      mid = '<div class="hint">' + a.pickExtraSlot + '</div><div class="actbar"><button data-act="cancel">' + a.cancel + '</button></div>';
    } else if (sel.kind === 'field') {
      const m = me.monsters[sel.slot];
      const menuActions = V.getMenuActions(st, ctx.viewer, sel, ctx.legal);
      let btns = '';
      if (!sel.mode) {
        mid = '';
      } else if (sel.mode === 'effects') {
        const effBtns = menuActions.filter(x => x.type === 'activateEffect');
        let effRows = '';
        for (const eb of effBtns) {
          const efDef = (d.effects || []).find(e => e.id === eb.action.effectId) || {};
          const efText = efDef.text || efDef.name || eb.label;
          if (eb.enabled) {
            effRows += '<button data-act="actEff:field:' + esc(eb.action.effectId) + '" class="gold eff-row-btn"><b>' + esc(eb.label) + '</b><span class="eff-desc">' + esc(efText) + '</span></button>';
          } else {
            effRows += '<button disabled class="dis-btn eff-row-btn" title="' + esc(eb.reason || '') + '"><b>' + esc(eb.label) + '</b><span class="eff-desc">' + esc(efText) + ' (' + esc(eb.reason || 'ใช้ไม่ได้') + ')</span></button>';
          }
        }
        mid = '<div class="hint">เลือกเอฟเฟกต์ที่จะใช้</div><div class="actbar eff-list-bar">' + effRows + '<button data-act="cancel">' + a.cancel + '</button></div>';
      }
    } else if (sel.kind === 'spell') {
      mid = '';
    } else if (sel.kind === 'attack') {
      const direct = ctx.legal.some(x => x.type === 'attack' && x.from === sel.slot && x.to === null);
      mid = '<div class="hint">' + a.pickTarget + '</div><div class="actbar">' + (direct ? '<button data-act="direct" class="danger">' + a.attackDirect + '</button>' : '') + '<button data-act="cancel">' + a.cancel + '</button></div>';
    } else if (mine && !st.pending && st.phase !== 'mulligan') {
      // 3) ปุ่มเฟสและจบเทิร์นรวมเป็นปุ่มเดียวแล้ว (ลบปุ่มแยกเดิมออกจากกลางสนาม)
      mid = '';
    }

    const bannerHtml = ctx.botBanner ? '<div class="bot-banner' + (ctx.botBannerFade ? ' fade' : '') + '">' + esc(ctx.botBanner) + '</div>' : '';

    // 2) ช่อง Field กลางสนาม (วงกลม 1 ช่อง ที่กึ่งกลางพอดี)
    const fsCard = me.fieldSpell || op.fieldSpell;
    let sharedFieldHtml = '';
    if (fsCard) {
      sharedFieldHtml = '<div class="shared-field-circle has-card">' +
        cardHtml(fsCard, { field: true, reveal: true, attrs: ' data-zone2="field"' }).replace('class="card', 'style="height:100%" class="card') +
      '</div>';
    } else {
      sharedFieldHtml = '<div class="shared-field-circle empty">' +
        '<span class="field-label">' + esc(a.fieldSpell || 'สนาม') + '</span>' +
      '</div>';
    }

    // 4) เหรียญเฟส: เหรียญกลมที่ด้านขวาของสนาม แสดง "เทิร์น N / ชื่อเฟส" กดแล้วเปิดเมนูเลือก (ไปเฟสถัดไป / ไปเฟสต่อสู้ / จบเทิร์น)
    const canPhaseAct = mine && !ctx.botBusy && !st.ended && !st.pending && st.phase !== 'mulligan' && ['main1', 'battle', 'main2'].includes(st.phase);
    let nextPh = '';
    if (st.phase === 'main1') nextPh = s.phase.battle || 'ต่อสู้';
    else if (st.phase === 'battle') nextPh = s.phase.main2 || 'เมน 2';
    else if (st.phase === 'main2') nextPh = s.phase.end || 'จบเทิร์น';
    const currentPhName = s.phase[st.phase] || st.phase;

    let phaseDropdownHtml = '';
    if (ctx.phaseMenuOpen && canPhaseAct) {
      phaseDropdownHtml = '<div class="phase-dropdown-menu" id="phaseDropdownMenu">' +
        '<button class="phase-dropdown-item" data-act="next">▶ ' + esc(a.nextPhasePrefix || 'ไปเฟสถัดไป') + ' (' + esc(nextPh) + ')</button>' +
        (st.phase === 'main1' ? '<button class="phase-dropdown-item battle-opt" data-act="next">⚔️ ' + esc(a.goToBattle || 'ไปเฟสต่อสู้') + '</button>' : '') +
        '<button class="phase-dropdown-item danger" data-act="end">⏭ ' + esc(a.endTurn) + '</button>' +
      '</div>';
    }

    const coinBtnClass = 'phase-coin-btn ' + (canPhaseAct ? 'active' : 'disabled');
    const phaseCoinHtml = '<div class="phase-coin-wrap phase-btn-wrap">' +
      '<button class="' + coinBtnClass + '" data-act="togglePhaseMenu" ' + (canPhaseAct ? '' : 'disabled') + ' title="เลือกเฟส">' +
        '<span class="coin-turn">' + esc(a.turn) + ' ' + st.turn + '</span>' +
        '<span class="coin-phase">' + esc(currentPhName) + '</span>' +
      '</button>' +
      phaseDropdownHtml +
    '</div>';

    const centerDivider = '<div class="center-field-divider">' +
      '<div class="center-spacer-left"></div>' +
      '<div class="center-mid-area">' +
        '<div class="shared-field-wrap">' + sharedFieldHtml + '</div>' +
        (mid ? '<div class="mid">' + mid + '</div>' : '') +
      '</div>' +
      '<div class="center-right-area">' +
        phaseCoinHtml +
      '</div>' +
    '</div>';

    const oppSideHtml = '<div class="duel-side opp-side">' +
      pilesGrid(op, 1 - ctx.viewer) +
      '<div class="field-center">' +
        spellRow(op, 1 - ctx.viewer) +
        monRow(op, 1 - ctx.viewer) +
      '</div>' +
      playerPanel(op, 1 - ctx.viewer) +
    '</div>';

    const selfSideHtml = '<div class="duel-side self-side">' +
      pilesGrid(me, ctx.viewer) +
      '<div class="field-center">' +
        monRow(me, ctx.viewer) +
        spellRow(me, ctx.viewer) +
      '</div>' +
      playerPanel(me, ctx.viewer) +
    '</div>';

    let modalHtml = '';
    if (ctx.inspectCard) {
      modalHtml = V.cardDetailModal(st, ctx.viewer, ctx.inspectCard.inst, ctx.inspectCard.isOpponent, null, ctx.legal);
    } else if (sel && !sel.mode) {
      let inst = null;
      if (sel.kind === 'hand') inst = me.hand[sel.idx];
      else if (sel.kind === 'field') inst = me.monsters[sel.slot];
      else if (sel.kind === 'spell') inst = me.spells[sel.slot];
      else if (sel.kind === 'extra') inst = me.extra[sel.idx];
      if (inst) {
        modalHtml = V.cardDetailModal(st, ctx.viewer, inst, false, sel, ctx.legal);
      }
    }

    root.innerHTML = top + '<div class="main"><div class="board">' +
      bannerHtml +
      '<div class="handrow opp ' + (op.hand.length > 5 ? 'overlapping' : '') + '">' + oppHand + '</div>' +
      oppSideHtml +
      centerDivider +
      selfSideHtml +
      '<div class="handrow ' + (me.hand.length > 5 ? 'overlapping' : '') + '" id="handRow">' + handHtml + '</div></div>' +
      '<div class="side ' + (CG.ui.sideOpen ? '' : 'side-collapsed') + '"><div id="inspect"><div class="m">' + a.inspectHint + '</div></div><h3>' + a.logTitle + '</h3><div id="log"></div></div></div>' +
      modalHtml;
  };

  V.inspectHtml = function (inst, viewer) {
    const d = def(inst), s = S();
    if (inst.faceDown && inst.controller !== viewer) return '<div class="m">' + s.app.cardBack + '</div>';
    const mon = d.type !== 'spell';
    let h = '<div class="t">' + esc(d.name) + '</div><div class="m">' + esc(s.type[d.type] || d.type) +
      (mon ? ' · ' + s.app.lvl + (inst.level != null ? inst.level : d.level) + ' · ' + s.app.atk + ' ' + (inst.baseAtk != null ? CG.engine.atk(inst) : d.atk) + ' / ' + s.app.def + ' ' + (inst.baseDef != null ? CG.engine.def(inst) : d.def) : ' · ' + esc(s.spellGroup[d.group] || '')) + '</div>';
    if (d.mana && d.mana !== '0') h += '<div class="m">' + s.app.manaCost + ': ' + esc(d.mana) + '</div>';
    if (d.materials) h += '<div class="m">' + esc(d.materials) + '</div>';
    return h + '<div>' + esc(d.text || '') + '</div>';
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
      stats = '<div class="m">' + (s.spellGroup[cDef.group] || cDef.group || '') + '</div>';
    }
    ov.innerHTML = '<div class="modal inspect-modal">' +
      '<div class="t" style="color:var(--gold);font-weight:800;font-size:1.1rem;margin-bottom:6px">' + esc(cDef.name) + '</div>' +
      stats +
      (cDef.mana ? '<div class="m">' + a.manaCost + ': ' + esc(cDef.mana) + '</div>' : '') +
      '<div class="inspect-text" style="text-align:left;margin:12px 0;padding:8px;background:rgba(0,0,0,0.5);border-radius:6px;font-size:.85rem;line-height:1.4">' + esc(cDef.text || '(ไม่มีข้อความเอฟเฟกต์)') + '</div>' +
      '<button class="gold btn-close-inspect">ปิด</button>' +
      '</div>';
    ov.onclick = function (e) {
      if (e.target === ov || e.target.classList.contains('btn-close-inspect')) ov.remove();
    };
    document.body.appendChild(ov);
  }

  function enhancePickerModal() {
    const grid = document.querySelector('.picker-grid');
    if (!grid) return;

    const debugState = CG.ui.app && CG.ui.app._debug && CG.ui.app._debug().state;
    if (!debugState || !debugState.pending) return;
    const pd = debugState.pending;
    if (pd.kind !== 'chooseTarget' && pd.kind !== 'chooseCards') return;

    const modal = grid.closest('.modal');
    if (modal) {
      modal.classList.add('card-picker-modal');
      const h2 = modal.querySelector('h2');
      if (h2 && !h2.dataset.titleSet) {
        h2.dataset.titleSet = 'true';
        const s = S();
        const minMax = pd.min === pd.max ? pd.min : (pd.min + ' - ' + pd.max);
        let zoneName = '';
        if (pd.sourceZone) {
          zoneName = s.zone[pd.sourceZone] || pd.sourceZone;
        } else if (pd.options && pd.options[0] && pd.options[0].zone) {
          zoneName = s.zone[pd.options[0].zone] || pd.options[0].zone;
        }
        h2.textContent = 'เลือก ' + minMax + ' ใบ' + (zoneName ? ' จาก ' + zoneName : '');
      }
    }

    const items = grid.querySelectorAll('.pick-item');
    items.forEach(function (el) {
      if (el.dataset.cardRendered) return;
      el.dataset.cardRendered = 'true';
      const dataOv = el.getAttribute('data-ov') || '';
      if (!dataOv.startsWith('pickIdx:')) return;
      const idx = Number(dataOv.slice(8));
      const opt = pd.options[idx];
      if (!opt) return;

      const cardDef = CG.engine.findCard(opt.cardId);
      if (!cardDef) return;
      const uidMap = V.uidMap(debugState);
      const inst = opt.uid ? (uidMap[opt.uid] || { uid: opt.uid, cardId: opt.cardId, baseAtk: cardDef.atk, baseDef: cardDef.def, level: cardDef.level }) : { uid: 9000 + idx, cardId: opt.cardId, baseAtk: cardDef.atk, baseDef: cardDef.def, level: cardDef.level };

      el.innerHTML = '<div class="picker-card-wrap">' +
        V.cardHtml(inst, { reveal: true, field: false }) +
        '<button class="btn-inspect-pick" data-inspect-cid="' + esc(opt.cardId) + '" title="ดูรายละเอียดเอฟเฟกต์">🔍 ดูเอฟเฟกต์</button>' +
        '</div>';
    });

    if (!grid.dataset.listenerAdded) {
      grid.dataset.listenerAdded = 'true';
      grid.addEventListener('click', function (e) {
        const btn = e.target.closest('.btn-inspect-pick');
        if (btn) {
          e.stopPropagation();
          const cid = btn.getAttribute('data-inspect-cid');
          const cDef = CG.engine.findCard(cid);
          if (cDef) {
            showCardInspectOverlay(cDef);
          }
        }
      });
    }
  }

  if (typeof window !== 'undefined' && typeof MutationObserver !== 'undefined') {
    const initPickerObserver = function () {
      const root = document.getElementById('overlayRoot');
      if (!root) { setTimeout(initPickerObserver, 100); return; }
      const obs = new MutationObserver(function () {
        enhancePickerModal();
      });
      obs.observe(root, { childList: true, subtree: true });
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initPickerObserver);
    } else {
      initPickerObserver();
    }
  }
})();

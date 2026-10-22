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

  // ---- การ์ดเดี่ยว ----
  function cardHtml(inst, o) {
    o = o || {};
    if (o.back) return '<div class="card back"></div>';
    const d = def(inst), s = S();
    const hidden = inst.faceDown && !o.reveal;
    const cls = ['card', 't-' + d.type];
    if (inst.faceDown) cls.push('fd' + (o.reveal ? ' mine-fd' : ''));
    if (inst.position === 'def' && !inst.faceDown) cls.push('def');
    if (o.sel) cls.push('sel'); if (o.dis) cls.push('dis');
    const data = ' data-uid="' + inst.uid + '"' + (o.attrs || '');
    if (hidden) return '<div class="' + cls.join(' ') + '"' + data + '>🂠</div>';
    const mon = d.type !== 'spell';
    const E = CG.engine;
    const atk = mon && inst.baseAtk != null ? E.atk(inst) : d.atk, dfn = mon && inst.baseDef != null ? E.def(inst) : d.def;
    const onField = o.field;
    let h = '<div class="' + cls.join(' ') + '"' + data + '>';
    if (mon) h += '<div class="lv">' + (inst.level != null ? inst.level : d.level) + '</div>';
    h += '<div class="nm">' + esc(d.name) + '</div>';
    if (onField && mon) h += '<div class="pos">' + (inst.faceDown ? '' : inst.position === 'atk' ? '⚔' : '🛡') + '</div>';
    if (mon) h += '<div class="st"><span>' + atk + '</span><span>' + dfn + '</span></div>';
    else h += '<div class="st"><span>' + esc(s.type.spell) + '</span><span>' + esc(s.spellGroup[d.group] || '') + '</span></div>';
    if (inst.under && inst.under.length) h += '<div class="under">+' + inst.under.length + '</div>';
    return h + '</div>';
  }
  V.cardHtml = cardHtml;

  // ---- ทั้งหน้าจอเกม ----
  // ctx = { state, viewer, sel, legal, handSel(Set uid), botBusy }
  V.render = function (root, ctx) {
    const st = ctx.state, me = st.players[ctx.viewer], op = st.players[1 - ctx.viewer], s = S(), a = s.app;
    const mine = st.activeIdx === ctx.viewer;
    const sel = ctx.sel || {};
    const botTurn = st.mode === 'bot' && st.phase !== 'mulligan' && st.activeIdx === 1;

    const phases = ['draw', 'standby', 'main1', 'battle', 'main2', 'end'].map(p => '<span class="' + (st.phase === p ? 'on' : '') + '">' + s.phase[p] + '</span>').join('');
    const top = '<div class="topbar"><div class="info"><b>' + esc(a.title) + '</b>' +
      '<span class="pill">' + a.turn + ' ' + st.turn + '</span>' +
      (st.phase === 'mulligan' ? '<span class="pill">' + s.phase.mulligan + '</span>' :
        '<span class="pill ' + (mine ? 'turnme' : 'turnopp') + '">' + (mine ? a.yourTurn : (botTurn ? a.botThinking : a.oppTurn)) + '</span>') +
      '<span class="phases">' + phases + '</span><span class="pill">' + a.seed + ' ' + esc(st.rng.seed) + '</span></div>' +
      '<div class="row"><button id="btnMenu">' + a.back + '</button></div></div>';

    function pbar(p, idx) {
      const act = st.activeIdx === idx && st.phase !== 'mulligan';
      return '<div class="pbar ' + (act ? 'active' : '') + '"><b>' + esc(V.pname(st, idx)) + (idx === ctx.viewer ? ' (' + a.you + ')' : '') + '</b>' +
        '<span>' + s.term.lp + ' <span class="lp" data-lp="' + idx + '">' + p.lp + '</span></span>' +
        '<span>' + s.term.mana + ' <span class="mana">' + p.mana + '</span></span>' +
        '<span class="chip" data-zone="' + idx + ':deck">' + a.deck + ' ' + p.deck.length + '</span>' +
        '<span class="chip" data-zone="' + idx + ':grave">' + a.grave + ' ' + p.grave.length + '</span>' +
        '<span class="chip" data-zone="' + idx + ':removed">' + a.removed + ' ' + p.removed.length + '</span>' +
        '<span class="chip" data-zone="' + idx + ':extra">' + a.extraDeck + ' ' + p.extra.length + '</span>' +
        (idx !== ctx.viewer ? '<span>' + a.hand + ' ' + p.hand.length + '</span>' : '') + '</div>';
    }

    // ไฮไลต์ช่อง
    const hlOwn = new Set(), hlOpp = new Set();
    if (sel.kind === 'hand' && (sel.mode === 'normal' || sel.mode === 'set' || (sel.mode === 'tribute' && sel.matsOk)))
      ctx.legal.forEach(x => {
        if (x.handIdx !== sel.idx) return;
        if (sel.mode === 'normal' && x.type === 'normalSummon') hlOwn.add(x.slot);
        if (sel.mode === 'set' && x.type === 'setMonster') hlOwn.add(x.slot);
        if (sel.mode === 'tribute' && x.type === 'tributeSummon' && x.materials.slice().sort().join() === sel.mats.slice().sort().join()) hlOwn.add(x.slot);
      });
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
        h += '<div class="' + cls.join(' ') + '"' + at + '>' +
          (m ? cardHtml(m, { field: true, reveal: isMe, sel: (sel.kind === 'attack' && isMe && sel.slot === i) || (sel.kind === 'hand' && sel.mode === 'tribute' && isMe && sel.mats.includes(i)), attrs: at }) : (i === 2 ? a.leaderSlot : '')) + '</div>';
      }
      return '<div class="zone">' + h + '</div>';
    }
    function spellRow(p, idx) {
      let h = '';
      for (let i = 0; i < p.spells.length; i++) {
        const c = p.spells[i];
        h += '<div class="slot spellslot">' + (c ? cardHtml(c, { field: true, reveal: idx === ctx.viewer, attrs: '' }).replace('class="card', 'style="height:100%" class="card') : '') + '</div>';
      }
      h += '<div class="slot spellslot" style="border-color:var(--purple)">' + (p.fieldSpell ? cardHtml(p.fieldSpell, { field: true, reveal: true }).replace('class="card', 'style="height:100%" class="card') : a.fieldSpell) + '</div>';
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
    else if (sel.kind === 'hand') {
      const c = me.hand[sel.idx], d = def(c);
      if (!sel.mode) {
        mid = '<div class="actbar">' +
          (d.type === 'monster' ? '<button data-act="mode:normal" class="primary">' + a.summon + '</button><button data-act="mode:set">' + a.setMon + '</button><button data-act="mode:tribute">' + a.tribute + '</button>' : '<button disabled>' + a.notUsable + '</button>') +
          '<button data-act="cancel">' + a.cancel + '</button></div>';
      } else if (sel.mode === 'tribute' && !sel.matsOk) {
        mid = '<div class="hint">' + a.pickMats + '</div><div class="actbar"><button data-act="mats" class="gold">' + a.confirmMats + ' (' + sel.mats.length + ')</button><button data-act="cancel">' + a.cancel + '</button></div>';
      } else mid = '<div class="hint">' + a.pickSlot + '</div><div class="actbar"><button data-act="cancel">' + a.cancel + '</button></div>';
    } else if (sel.kind === 'field') {
      const m = me.monsters[sel.slot];
      mid = '<div class="actbar">' + (m ? (m.faceDown ? '<button data-act="flip" class="primary">' + a.flip + '</button>' : '<button data-act="pos">' + a.changePos + '</button>') : '') +
        (st.phase === 'battle' ? '<button data-act="atk" class="primary">' + a.attack + '</button>' : '') + '<button data-act="cancel">' + a.cancel + '</button></div>';
    } else if (sel.kind === 'attack') {
      const direct = ctx.legal.some(x => x.type === 'attack' && x.from === sel.slot && x.to === null);
      mid = '<div class="hint">' + a.pickTarget + '</div><div class="actbar">' + (direct ? '<button data-act="direct" class="danger">' + a.attackDirect + '</button>' : '') + '<button data-act="cancel">' + a.cancel + '</button></div>';
    } else if (mine && !st.pending && st.phase !== 'mulligan') {
      mid = '<div class="actbar"><button data-act="next" class="primary" ' + (['main1', 'battle', 'main2'].includes(st.phase) ? '' : 'disabled') + '>' + a.nextPhase + '</button><button data-act="end" ' + (['main1', 'battle', 'main2'].includes(st.phase) ? '' : 'disabled') + '>' + a.endTurn + '</button></div>';
    }

    root.innerHTML = top + '<div class="main"><div class="board">' +
      pbar(op, 1 - ctx.viewer) + '<div class="handrow opp">' + oppHand + '</div>' +
      spellRow(op, 1 - ctx.viewer) + monRow(op, 1 - ctx.viewer) +
      '<div class="mid">' + mid + '</div>' +
      monRow(me, ctx.viewer) + spellRow(me, ctx.viewer) + pbar(me, ctx.viewer) +
      '<div class="handrow" id="handRow">' + handHtml + '</div></div>' +
      '<div class="side"><div id="inspect"><div class="m">' + a.inspectHint + '</div></div><h3>' + a.logTitle + '</h3><div id="log"></div></div></div>';
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
})();

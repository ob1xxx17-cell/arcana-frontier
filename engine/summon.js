// engine/summon.js - อัญเชิญ (ปกติ/Set/เสียสละ/Flip/Special) และเปลี่ยนท่า (ข้อ 1, 5-7)
(function () {
  const CG = (globalThis.CG = globalThis.CG || {});
  CG.engine = CG.engine || {};
  const E = CG.engine;

  const mainCheck = state =>
    (state.phase === 'main1' || state.phase === 'main2') && state.battleStep === null ? null : 'WRONG_PHASE';
  const slotOk = (state, s) => Number.isInteger(s) && s >= 0 && s < state.config.monsterSlots;
  const handCard = (p, i) => (Number.isInteger(i) && i >= 0 && i < p.hand.length ? p.hand[i] : null);

  // วางมอนสเตอร์ลงช่อง (ใช้ร่วมกันทุกวิธีอัญเชิญ) from = โซนต้นทาง (สำหรับ event)
  E.placeMonster = function (state, events, pIdx, inst, slot, opt) {
    const p = state.players[pIdx];
    inst.controller = pIdx;
    inst.faceDown = !!opt.faceDown;
    inst.position = opt.faceDown ? 'def' : 'atk';
    inst.flags = inst.flags || {};
    inst.flags.summonedTurn = state.turn;
    inst.flags.setTurn = opt.faceDown ? state.turn : null;
    inst.flags.canAttack = true; inst.flags.attackedThisTurn = false; inst.flags.positionChangedThisTurn = false;
    p.monsters[slot] = inst;
    events.push({ type: 'moveCard', uid: inst.uid, from: opt.from || 'hand', to: 'monster', player: pIdx, slot });
    events.push({ type: 'summon', player: pIdx, uid: inst.uid, slot, how: opt.how });
    if (!opt.faceDown) E.fire(state, events, 'onSummon', { source: inst, how: opt.how });   // Set คว่ำไม่ยิง
  };

  // ---- อัญเชิญปกติ / Set (ใช้โควตาปกติ) ----
  function validateNormalLike(state, a) {
    const err = mainCheck(state); if (err) return err;
    const p = state.players[a.player];
    const c = handCard(p, a.handIdx); if (!c) return 'INVALID_HAND_INDEX';
    const def = E.cardOf(c);
    if (!def || def.type !== 'monster') return 'NOT_A_MONSTER';
    if (c.level !== 1) return 'LEVEL_NOT_1';
    if (p.flags.normalSummonUsed) return 'NORMAL_SUMMON_USED';
    if (!slotOk(state, a.slot)) return 'INVALID_SLOT';
    if (p.monsters[a.slot]) return 'SLOT_FULL';
    return null;
  }
  E.validateNormalSummon = validateNormalLike;
  E.validateSetMonster = validateNormalLike;
  function doNormalLike(state, a, events, faceDown) {
    const err = validateNormalLike(state, a); if (err) return err;
    const p = state.players[a.player];
    const c = p.hand.splice(a.handIdx, 1)[0];
    p.flags.normalSummonUsed = true;
    E.placeMonster(state, events, a.player, c, a.slot, { how: faceDown ? 'set' : 'normal', faceDown });
    if (!faceDown && p.monsters[a.slot] === c) E.fire(state, events, 'onNormalSummon', { source: c, how: 'normal' });
    E.openWindow(state, events, { kind: 'summon', uid: c.uid });
    return null;
  }
  E.normalSummon = (state, a, events) => doNormalLike(state, a, events, false);
  E.setMonster = (state, a, events) => doNormalLike(state, a, events, true);

  // ---- อัญเชิญเสียสละ (ใช้โควตาเสียสละ แยกจากปกติ) ----
  // กติกาวัสดุ (ข้อ 1): ผลรวม Level ของวัสดุ = Level ตัวที่เรียก และไม่มีวัสดุที่ Level เท่ากับตัวที่เรียก
  //   Lv2 = Lv1+Lv1 | Lv3 = Lv1+Lv2 หรือ Lv1×3   (ฟังก์ชันนี้คือที่เดียวที่ตัดสินเรื่องวัสดุ)
  E.checkTributeMaterials = function (targetLevel, matLevels) {
    if (matLevels.some(l => l === targetLevel)) return 'MATERIAL_LEVEL_EQUAL';
    if (matLevels.reduce((s, l) => s + l, 0) !== targetLevel) return 'MATERIAL_LEVEL_SUM';
    return null;
  };
  E.validateTributeSummon = function (state, a) {
    const err = mainCheck(state); if (err) return err;
    const p = state.players[a.player];
    const c = handCard(p, a.handIdx); if (!c) return 'INVALID_HAND_INDEX';
    const def = E.cardOf(c);
    if (!def || def.type !== 'monster') return 'NOT_A_MONSTER';
    if (c.level !== 2 && c.level !== 3) return 'LEVEL_NOT_TRIBUTE';
    if (p.flags.tributeSummonUsed) return 'TRIBUTE_SUMMON_USED';
    const mats = a.materials;
    if (!Array.isArray(mats) || !mats.length || new Set(mats).size !== mats.length) return 'MATERIAL_INVALID';
    for (const s of mats) {
      if (!slotOk(state, s) || !p.monsters[s]) return 'MATERIAL_INVALID';
      const mDef = E.cardOf(p.monsters[s]);
      if (mDef && mDef.noTribute) return 'MATERIAL_INVALID';
    }
    const e2 = E.checkTributeMaterials(c.level, mats.map(s => p.monsters[s].level));
    if (e2) return e2;
    if (!slotOk(state, a.slot)) return 'INVALID_SLOT';
    if (p.monsters[a.slot] && !mats.includes(a.slot)) return 'SLOT_FULL';
    return null;
  };
  E.tributeSummon = function (state, a, events) {
    const err = E.validateTributeSummon(state, a); if (err) return err;
    const p = state.players[a.player];
    const c = p.hand.splice(a.handIdx, 1)[0];
    const mats = a.materials.map(s => p.monsters[s]);
    // วัสดุลงสุสานก่อน แต่เลื่อนการยิง onSentToGrave ไปหลังวางตัวที่เรียกแล้ว กันเอฟเฟกต์ (เช่น เรียกพิเศษ) แย่งช่องที่วัสดุเพิ่งว่าง
    const queued = [], realFire = E.fire;
    E.fire = (st, ev, trig, ctx) => { if (trig === 'onSentToGrave') queued.push(ctx); else realFire(st, ev, trig, ctx); };
    try { for (const s of a.materials) E.leaveField(state, events, a.player, s, 'grave'); } // เสียสละ ไม่ใช่การทำลาย
    finally { E.fire = realFire; }
    p.flags.tributeSummonUsed = true;
    E.placeMonster(state, events, a.player, c, a.slot, { how: 'tribute', faceDown: false });
    for (const ctx of queued) if (!state.ended) E.fire(state, events, 'onSentToGrave', ctx);
    if (p.monsters[a.slot] === c) E.fire(state, events, 'onNormalSummon', { source: c, how: 'tribute' });
    for (const m of mats) if (!state.ended) E.fire(state, events, 'onTributed', { source: m, summonedUid: c.uid });   // เฉพาะวัสดุเสียสละ
    E.openWindow(state, events, { kind: 'summon', uid: c.uid });
    return null;
  };

  // ---- Special Summon (ไม่จำกัดจำนวน ช่องเต็มเรียกเพิ่มไม่ได้) สำหรับให้เอฟเฟกต์ขั้น 4-6 เรียกใช้ ----
  // คืน null เมื่อสำเร็จ หรือรหัสผิดพลาด (ไม่แก้ state เมื่อผิด)
  E.specialSummon = function (state, events, pIdx, inst, slot, from, faceDown, how) {
    const p = state.players[pIdx];
    const def = E.cardOf(inst);
    if (!slotOk(state, slot)) return 'INVALID_SLOT';
    if (p.monsters[slot]) return 'SLOT_FULL';
    const zone = p[from]; const i = zone ? zone.findIndex(c => c.uid === inst.uid) : -1;
    if (i < 0) return 'NOT_IN_ZONE';
    if (def.type === 'grade4') {
      if (p.flags.grade4SummonedThisTurn) return 'GRADE4_LIMIT';
      p.flags.grade4SummonedThisTurn = true;
    }
    zone.splice(i, 1);
    E.placeMonster(state, events, pIdx, inst, slot, { how: how || 'special', faceDown: !!faceDown, from });
    E.openWindow(state, events, { kind: 'summon', uid: inst.uid });
    return null;
  };

  // ---- Flip Summon / เปลี่ยนท่า (1 ครั้ง/ตัว/เทิร์น รวม Flip) ----
  E.validateFlipSummon = function (state, a) {
    const err = mainCheck(state); if (err) return err;
    if (!slotOk(state, a.slot)) return 'INVALID_SLOT';
    const m = state.players[a.player].monsters[a.slot];
    if (!m) return 'NO_MONSTER';
    if (!m.faceDown) return 'NOT_FACE_DOWN';
    if (m.flags.setTurn === state.turn) return 'SET_THIS_TURN';
    if (m.flags.positionChangedThisTurn) return 'POSITION_ALREADY_CHANGED';
    return null;
  };
  E.flipSummon = function (state, a, events) {
    const err = E.validateFlipSummon(state, a); if (err) return err;
    const m = state.players[a.player].monsters[a.slot];
    m.faceDown = false; m.position = 'atk'; m.flags.positionChangedThisTurn = true;
    events.push({ type: 'positionChange', uid: m.uid, position: 'atk', faceDown: false });
    events.push({ type: 'summon', player: a.player, uid: m.uid, slot: a.slot, how: 'flip' });
    E.fire(state, events, 'onFlip', { source: m });
    E.openWindow(state, events, { kind: 'flip', uid: m.uid });
    return null;
  };
  E.validateChangePosition = function (state, a) {
    const err = mainCheck(state); if (err) return err;
    if (!slotOk(state, a.slot)) return 'INVALID_SLOT';
    const m = state.players[a.player].monsters[a.slot];
    if (!m) return 'NO_MONSTER';
    if (m.faceDown) return 'USE_FLIP_SUMMON';
    if (m.flags.summonedTurn === state.turn) return 'SUMMONED_THIS_TURN';
    if (m.flags.positionChangedThisTurn) return 'POSITION_ALREADY_CHANGED';
    if (m.cannotChangePosition || m.frozen) return 'CANNOT_CHANGE_POSITION';
    return null;
  };
  E.changePosition = function (state, a, events) {
    const err = E.validateChangePosition(state, a); if (err) return err;
    const m = state.players[a.player].monsters[a.slot];
    m.position = m.position === 'atk' ? 'def' : 'atk';
    m.flags.positionChangedThisTurn = true;
    events.push({ type: 'positionChange', uid: m.uid, position: m.position, faceDown: false });
    return null;
  };
})();

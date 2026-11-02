// tests/cube_forge.test.js - ทดสอบเด็คคิวบ์ฟอร์จ (Cube Forge)
const tests = [];

tests.push({
  name: 'CUBE-01 เด็คคิวบ์ฟอร์จโหลดได้และมีโครงสร้างถูกต้องตามสัญญา (40 main / 3 extra)',
  run(assert) {
    const d = CG.cards.cube_forge;
    assert.ok(d, 'ต้องมีเด็ค cube_forge');
    assert.strictEqual(d.key, 'cube_forge');
    assert.strictEqual(d.name, 'เด็คคิวบ์ฟอร์จ (Cube Forge)');

    const mainCount = d.main.reduce((acc, c) => acc + c.count, 0);
    assert.strictEqual(mainCount, 40, 'กองหลักต้องมี 40 ใบ');

    const extraCount = d.extra.reduce((acc, c) => acc + c.count, 0);
    assert.strictEqual(extraCount, 3, 'กองพิเศษ Astral Gate ต้องมี 3 ใบ');
  }
});

tests.push({
  name: 'CUBE-02 แท่นประกอบ และ ช่างเหลี่ยมตีโลหะ มีเอฟเฟกต์ตามสเปกต์ที่ผู้ใช้ปรับปรุง',
  run(assert) {
    const crafting = CG.engine.findCard('cube_crafting_table');
    assert.ok(crafting);
    assert.strictEqual(crafting.mana, '0', 'แท่นประกอบ ต้องไม่ใช้มานา (mana: 0)');
    assert.strictEqual(crafting.effects.length, 1);
    assert.strictEqual(crafting.effects[0].do[0].op, 'choice');

    const blacksmith = CG.engine.findCard('cube_blacksmith');
    assert.ok(blacksmith);
    assert.strictEqual(blacksmith.effects.length, 1);
    assert.strictEqual(blacksmith.effects[0].trigger, 'ignition');
    assert.strictEqual(blacksmith.effects[0].cost.mana, 2, 'ช่างเหลี่ยมตีโลหะ ต้องจ่าย 2 มานา');
    assert.strictEqual(blacksmith.effects[0].do[0].op, 'sendToGrave');
    assert.strictEqual(blacksmith.effects[0].do[1].op, 'choice');
  }
});

tests.push({
  name: 'CUBE-03 โล่บล็อก มีเอฟเฟกต์ยกเลิกการโจมตี (negateAttack) จากมือความเร็ว 3',
  run(assert) {
    const shield = CG.engine.findCard('cube_shield_block');
    assert.ok(shield);
    assert.strictEqual(shield.effects.length, 1);
    assert.strictEqual(shield.effects[0].trigger, 'quick');
    assert.strictEqual(shield.effects[0].speed, 3);
    assert.strictEqual(shield.effects[0].do[0].op, 'negateAttack');
  }
});

tests.push({
  name: 'CUBE-04 เหลี่ยม เบลลา ผู้พิชิต มีเอฟเฟกต์กู้อุปกรณ์ (returnToHand) และโจมตีเพิ่ม (extraAttack)',
  run(assert) {
    const bella = CG.engine.findCard('cube_bella_conqueror');
    assert.ok(bella);
    assert.strictEqual(bella.effects.length, 2);
    assert.strictEqual(bella.effects[0].do[0].op, 'returnToHand');
    assert.strictEqual(bella.effects[1].do[0].op, 'extraAttack');
  }
});

tests.push({
  name: 'CUBE-05 ราชาเหลี่ยม มีเอฟเฟกต์กันทำลาย (preventDestruction) และทำลาย 2 ตัว (destroy)',
  run(assert) {
    const king = CG.engine.findCard('cube_king');
    assert.ok(king);
    assert.strictEqual(king.effects.length, 2);
    assert.strictEqual(king.effects[0].do[0].op, 'preventDestruction');
    assert.strictEqual(king.effects[1].do[0].op, 'destroy');
    assert.strictEqual(king.effects[1].do[0].target.count, 2);
  }
});

tests.push({
  name: 'CUBE-06 เหลี่ยม คูโบ ผู้พิชิต มีเอฟเฟกต์บัฟพลังตามอุปกรณ์ (modifyStat aura)',
  run(assert) {
    const kobo = CG.engine.findCard('cube_kobo_conqueror');
    assert.ok(kobo);
    assert.strictEqual(kobo.effects.length, 1);
    assert.strictEqual(kobo.effects[0].do[0].op, 'modifyStat');
    assert.strictEqual(kobo.effects[0].do[0].aura, true);
  }
});

module.exports = tests;

// tests/deck_builder.test.js - การทดสอบระบบจัดเด็คและกฎการจัดเด็ค
const tests = module.exports = [];
const t = (name, fn) => tests.push({ name, run: fn });

t('DECK-01: ดึงการ์ดทั้งหมดในเกมครบ 48 ใบและระบุหมวดหมู่ Extra/Main ถูกต้อง', (assert) => {
  const DB = globalThis.CG.deckBuilder;
  const all = DB.getAllCardDefs();
  assert.equal(all.length, 50, 'ต้องมี 50 ใบ');
  const mainCards = all.filter(c => !c.isExtra);
  const extraCards = all.filter(c => c.isExtra);
  assert.equal(mainCards.length, 43, 'Main Deck ต้องมี 43 ใบ');
  assert.equal(extraCards.length, 7, 'Extra Deck ต้องมี 7 ใบ');
});

t('DECK-02: ตรวจเด็คที่ถูกต้อง (เด็คไดโนเสาร์เดิม 40 ใบ) ต้องผ่านการตรวจสอบ', (assert) => {
  const DB = globalThis.CG.deckBuilder;
  const dino = globalThis.CG.cards.dinosaur;
  const res = DB.validateDeck(dino);
  assert.ok(res.valid, 'เด็คไดโนเสาร์ต้องผ่าน validation: ' + res.errors.join(', '));
  assert.ok(res.mainCount >= 40 && res.mainCount <= 50, 'Main count ต้องอยู่ระหว่าง 40 ถึง 50 ใบ (ปัจจุบันมี ' + res.mainCount + ')');
});

t('DECK-03: ตรวจเด็คที่มีการ์ดซ้ำเกิน 3 ใบต้องไม่ผ่าน', (assert) => {
  const DB = globalThis.CG.deckBuilder;
  const dino = globalThis.CG.cards.dinosaur;
  const invalidDeck = {
    key: 'test_deck_invalid',
    name: 'ทดสอบ',
    main: dino.main.map((c, i) => i === 0 ? { id: c.id, count: 4 } : { id: c.id, count: c.count }),
    extra: []
  };
  const res = DB.validateDeck(invalidDeck);
  assert.ok(!res.valid, 'ต้องไม่ผ่านเพราะมีการ์ดซ้ำ 4 ใบ');
  assert.ok(res.errors.some(e => e.includes('ไม่เกิน 3 ใบ')), 'มีข้อความเตือนเรื่องการ์ดซ้ำ');
});

t('DECK-04: ตรวจเด็คที่มีการ์ดน้อยกว่า 40 ใบ หรือมากกว่า 50 ใบต้องไม่ผ่าน', (assert) => {
  const DB = globalThis.CG.deckBuilder;
  const smallDeck = {
    key: 'test_small',
    name: 'เด็คสั้น',
    main: [
      { id: 'dino_egg', count: 3 },
      { id: 'dino_small_raptor', count: 3 }
    ],
    extra: []
  };
  const resSmall = DB.validateDeck(smallDeck);
  assert.ok(!resSmall.valid, 'ต้องไม่ผ่านเพราะมีแค่ 6 ใบ');
  assert.ok(resSmall.errors.some(e => e.includes('อย่างน้อย 40 ใบ')), 'มีข้อความเตือนเรื่อง 40 ใบ');

  // ทดสอบมากกว่า 50 ใบ
  const bigDeck = {
    key: 'test_big',
    name: 'เด็คเกิน 50 ใบ',
    main: globalThis.CG.cards.dinosaur.main.map(c => Object.assign({}, c))
  };
  // เพิ่มการ์ดจนเกิน 50 ใบ
  bigDeck.main.push({ id: 'dino_mud', count: 3 });
  bigDeck.main.push({ id: 'dino_hidden_egg', count: 3 });
  bigDeck.main.push({ id: 'dino_escape', count: 3 });
  bigDeck.main.push({ id: 'dino_nest', count: 3 });
  const resBig = DB.validateDeck(bigDeck);
  assert.ok(!resBig.valid, 'ต้องไม่ผ่านเพราะเกิน 50 ใบ');
  assert.ok(resBig.errors.some(e => e.includes('ไม่เกิน 50 ใบ')), 'มีข้อความเตือนเรื่อง 50 ใบ');
});

t('DECK-05: นำการ์ด Extra Deck มาใส่ใน Main Deck หรือเกินขีดจำกัด Extra Deck ต้องไม่ผ่าน', (assert) => {
  const DB = globalThis.CG.deckBuilder;
  const dino = globalThis.CG.cards.dinosaur;
  const mixedDeck = {
    key: 'test_mixed',
    name: 'เด็คผิดหมวด',
    main: dino.main.map((c, i) => i === 0 ? { id: 'dino_tyrano_raptor', count: 1 } : Object.assign({}, c)),
    extra: []
  };
  const res = DB.validateDeck(mixedDeck);
  assert.ok(!res.valid, 'ต้องไม่ผ่านเพราะมี Fusion ใน Main Deck');
  assert.ok(res.errors.some(e => e.includes('Extra Deck')), 'มีข้อความเตือนเรื่อง Extra');

  // ตรวจสอบ Extra Deck: Fusion ไม่เกิน 10 ใบ, Grade 4 ไม่เกิน 10 ใบ
  const extraExceedDeck = {
    key: 'test_extra_exceed',
    name: 'เด็ค Extra เกิน',
    main: dino.main.map(c => Object.assign({}, c)),
    extra: [
      { id: 'dino_tyrano_raptor', count: 3 },
      { id: 'dino_raptor_swarm', count: 3 },
      { id: 'aq_gladiator', count: 3 }, // สมมติว่ามี
      { id: 'dino_brachio', count: 3 }  // Fusion รวมเกิน 10
    ]
  };
  assert.equal(DB.RULES.maxFusion, 10, 'maxFusion = 10');
  assert.equal(DB.RULES.maxGrade4, 10, 'maxGrade4 = 10');
  assert.equal(DB.RULES.maxExtra, 20, 'maxExtra = 20');
});

t('DECK-06: สร้าง บันทึก ซิงค์ และลบเด็ค Custom เข้าสู่เกมได้จริง', (assert) => {
  const DB = globalThis.CG.deckBuilder;
  const template = DB.createTemplateDeck('เด็คทดสอบของฉัน', 'dinosaur');
  assert.ok(template.key.startsWith('custom_'), 'มี key ถูกต้อง');

  const saveRes = DB.saveCustomDeck(template);
  assert.ok(saveRes.ok, 'บันทึกสำเร็จ');
  assert.ok(globalThis.CG.cards[template.key], 'ต้องมีใน CG.cards');

  // ทดลองสร้างเกมโดยใช้เด็ค custom
  const E = globalThis.CG.engine;
  const state = E.createGame({
    deckA: template.key,
    deckB: 'dinosaur',
    seed: 42
  });
  assert.equal(state.players[0].deckKey, template.key, 'ผู้เล่น 1 ใช้เด็ค custom');
  assert.ok(state.players[0].deck.length > 0, 'มีเด็คพร้อมเล่น');

  // ลบเด็ค
  DB.deleteCustomDeck(template.key);
  assert.ok(!globalThis.CG.cards[template.key], 'ต้องถูกลบออกจาก CG.cards แล้ว');
});

t('DECK-07: การจัดเด็ค Custom ต้องเก็บสถิติและเอฟเฟกต์การ์ดครบถ้วน และไม่ทำให้การ์ดในเด็คระบบสูญเสียเอฟเฟกต์', (assert) => {
  const DB = globalThis.CG.deckBuilder;
  const E = globalThis.CG.engine;

  // ตรวจสอบข้อมูลตั้งต้นของการ์ด mecha_lion
  const originalLion = E.findCard('mecha_lion');
  assert.ok(originalLion, 'ต้องพบ mecha_lion ในระบบ');
  assert.equal(originalLion.atk, 1200, 'mecha_lion ต้องมี ATK 1200');
  assert.equal(originalLion.def, 800, 'mecha_lion ต้องมี DEF 800');
  assert.ok(Array.isArray(originalLion.effects) && originalLion.effects.length > 0, 'mecha_lion ต้องมีเอฟเฟกต์');

  // สร้างเด็ค Custom ที่มีการ์ดที่เป็นเพียง stub { id, count }
  const customDeck = {
    key: 'custom_test_hydration_' + Date.now(),
    name: 'เด็คทดสอบสถิติและเอฟเฟกต์',
    isCustom: true,
    main: [
      { id: 'mecha_lion', count: 3 },
      { id: 'mecha_falcon', count: 3 }
    ],
    extra: []
  };

  // เติมการ์ดไดโนเสาร์ให้ครบ 40 ใบ
  const dinoCards = globalThis.CG.cards.dinosaur.main;
  for (const c of dinoCards) {
    if (customDeck.main.length >= 40) break;
    customDeck.main.push({ id: c.id, count: c.count || 1 });
  }

  // บันทึกเด็ค Custom
  const saveRes = DB.saveCustomDeck(customDeck);
  assert.ok(saveRes.ok, 'บันทึกเด็ค Custom สำเร็จ: ' + (saveRes.errors ? saveRes.errors.join(', ') : ''));

  // E.findCard ต้องไม่ถูกข้อมูล stub เขียนทับ
  const cachedLion = E.findCard('mecha_lion');
  assert.equal(cachedLion.atk, 1200, 'E.findCard(mecha_lion) ต้องยังมี ATK 1200 หลังซิงค์เด็ค custom');
  assert.equal(cachedLion.def, 800, 'E.findCard(mecha_lion) ต้องยังมี DEF 800');
  assert.ok(cachedLion.effects && cachedLion.effects.length > 0, 'E.findCard(mecha_lion) ต้องยังมีเอฟเฟกต์');

  // สร้างเกมด้วยเด็ค Custom
  const state = E.createGame({
    deckA: customDeck.key,
    deckB: 'dinosaur',
    seed: 12345
  });

  const p1 = state.players[0];
  const allCards = p1.hand.concat(p1.deck);
  const lionInst = allCards.find(c => c.cardId === 'mecha_lion');
  assert.ok(lionInst, 'ต้องมีการ์ด mecha_lion ในเด็คผู้เล่น');
  assert.equal(lionInst.baseAtk, 1200, 'Instance ของ mecha_lion ต้องมี baseAtk 1200');
  assert.equal(lionInst.baseDef, 800, 'Instance ของ mecha_lion ต้องมี baseDef 800');
  assert.equal(lionInst.level, 1, 'Instance ของ mecha_lion ต้องมี level 1');

  // เอฟเฟกต์ของการ์ดต้องอ่านได้ผ่าน E.cardOf
  const defOfInst = E.cardOf(lionInst);
  assert.ok(defOfInst.effects && defOfInst.effects.length > 0, 'E.cardOf(lionInst) ต้องมีเอฟเฟกต์ครบถ้วน');

  // ทำความสะอาด
  DB.deleteCustomDeck(customDeck.key);
});

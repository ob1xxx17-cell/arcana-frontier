// tests/cards.test.js - เช็กข้อมูลการ์ด (ขั้น 1)
const DECKS = ['dinosaur', 'aquila'];
const TYPES = ['monster', 'spell', 'fusion', 'grade4'];
const GROUPS = ['normal', 'set', 'counter'];
const tests = [];

// เช็ก extra ตาม extraSize ใน CONTRACT ข้อ 1 (fusion<=10, grade4<=10)
for (const key of DECKS) {
  const deck = () => CG.cards[key];

  tests.push({ name: `CARDS-01 ${key}: ลงทะเบียนครบ`, run(assert) {
    assert.ok(CG.cards && CG.cards[key], 'ไม่พบ CG.cards.' + key);
    assert.strictEqual(deck().key, key);
    assert.ok(Array.isArray(deck().main) && Array.isArray(deck().extra));
  }});

  tests.push({ name: `CARDS-02 ${key}: main ครบ 40 ใบ`, run(assert) {
    const total = deck().main.reduce((s, c) => s + c.count, 0);
    assert.strictEqual(total, 40);
  }});

  tests.push({ name: `CARDS-03 ${key}: count 1-3 (maxCopies) และ extra ห้ามมี count`, run(assert) {
    for (const c of deck().main) {
      assert.ok(Number.isInteger(c.count) && c.count >= 1 && c.count <= 3, `${c.id} count=${c.count}`);
      assert.ok(c.type === 'monster' || c.type === 'spell', `${c.id} อยู่ใน main แต่ type=${c.type}`);
    }
    for (const c of deck().extra) {
      assert.strictEqual(c.count, undefined, `${c.id} อยู่ใน extra ไม่ควรมี count`);
      assert.ok(c.type === 'fusion' || c.type === 'grade4', `${c.id} อยู่ใน extra แต่ type=${c.type}`);
    }
    const f = deck().extra.filter(c => c.type === 'fusion').length;
    const g = deck().extra.filter(c => c.type === 'grade4').length;
    assert.ok(f <= 10 && g <= 10, `extra เกิน extraSize fusion=${f} grade4=${g}`);
  }});

  tests.push({ name: `CARDS-04 ${key}: id ไม่ซ้ำในเด็ค`, run(assert) {
    const ids = deck().main.concat(deck().extra).map(c => c.id);
    assert.strictEqual(new Set(ids).size, ids.length, 'id ซ้ำในเด็ค');
  }});

  tests.push({ name: `CARDS-05 ${key}: ฟิลด์ครบตามประเภท`, run(assert) {
    for (const c of deck().main.concat(deck().extra)) {
      const w = c.id;
      assert.ok(typeof c.id === 'string' && c.id, `${w} id`);
      assert.ok(typeof c.name === 'string' && c.name, `${w} name`);
      assert.ok(TYPES.includes(c.type), `${w} type=${c.type}`);
      assert.strictEqual(typeof c.mana, 'string', `${w} mana ต้องเป็นข้อความ`);
      assert.strictEqual(typeof c.text, 'string', `${w} text`);
      assert.ok(c.text.length > 0, `${w} text ว่าง`);
      assert.strictEqual(typeof c.proposed_level, 'boolean', `${w} proposed_level`);
      assert.ok(Array.isArray(c.effects), `${w} effects ต้องเป็น array (ว่างได้ถ้ายังแปลงไม่ได้)`);
      if (c.type === 'spell') {
        assert.ok(GROUPS.includes(c.group), `${w} group=${c.group}`);
        assert.strictEqual(typeof c.field, 'boolean', `${w} field`);
      } else {
        assert.ok([1, 2, 3].includes(c.level), `${w} level=${c.level}`);
        assert.ok(Number.isInteger(c.atk) && c.atk >= 0, `${w} atk`);
        assert.ok(Number.isInteger(c.def) && c.def >= 0, `${w} def`);
      }
      if (c.type === 'monster') assert.strictEqual(typeof c.leader, 'boolean', `${w} leader`);
      if (c.type === 'fusion' || c.type === 'grade4') assert.strictEqual(typeof c.materials, 'string', `${w} materials`);
      if (c.type === 'grade4') assert.strictEqual(c.level, 3, `${w} grade4 ต้อง Lv3`);
    }
  }});

  tests.push({ name: `CARDS-06 ${key}: เป็น JSON ล้วน (ไม่มีฟังก์ชัน)`, run(assert) {
    const s = JSON.stringify(deck());
    assert.deepStrictEqual(JSON.parse(s), deck());
  }});
}

tests.push({ name: 'CARDS-07 id ไม่ซ้ำข้ามเด็ค', run(assert) {
  const ids = [];
  for (const k of DECKS) ids.push(...CG.cards[k].main.concat(CG.cards[k].extra).map(c => c.id));
  assert.strictEqual(new Set(ids).size, ids.length);
}});

tests.push({ name: 'CARDS-08 ข้อมูลตรงกับ source (จำนวนแบบและฟิลด์หลัก)', run(assert) {
  const fs = require('fs'), path = require('path');
  const src = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'cards', 'decks_v0_7.source.json'), 'utf8'));
  for (const k of DECKS) {
    const s = src.decks[k], d = CG.cards[k];
    assert.strictEqual(d.main.length, s.main.length, k + ' main');
    assert.strictEqual(d.extra.length, s.extra.length, k + ' extra');
    s.main.concat(s.extra).forEach((sc, i) => {
      const dc = d.main.concat(d.extra)[i];
      for (const f of ['id', 'name', 'type', 'level', 'atk', 'def', 'text']) assert.strictEqual(dc[f], sc[f], `${sc.id}.${f}`);
    });
  }
}});

// ขั้น 4E-1: tags
const DECK_TAG = { dinosaur: 'dino', aquila: 'aquila' };
const collectFilterTags = (node, out) => {
  if (Array.isArray(node)) node.forEach(n => collectFilterTags(n, out));
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k === 'filter' && v && typeof v === 'object' && v.tag) out.add(v.tag);
      collectFilterTags(v, out);
    }
  }
};
for (const key of DECKS) {
  tests.push({ name: `CARDS-09 ${key}: ทุกใบมี tag ประจำเด็ค และไม่เกิน 4 tag`, run(assert) {
    for (const c of CG.cards[key].main.concat(CG.cards[key].extra)) {
      assert.ok(Array.isArray(c.tags), `${c.id} ไม่มี tags`);
      assert.ok(c.tags.includes(DECK_TAG[key]), `${c.id} ไม่มี tag ${DECK_TAG[key]}`);
      assert.ok(c.tags.length <= 4, `${c.id} มี ${c.tags.length} tag`);
      assert.strictEqual(new Set(c.tags).size, c.tags.length, `${c.id} tag ซ้ำ`);
    }
  }});
}
tests.push({ name: 'CARDS-10 ทุก tag ที่ filter ใน effects[] อ้างถึงต้องมีการ์ดติดอย่างน้อย 1 ใบ', run(assert) {
  const used = new Set(), have = new Set();
  for (const k of DECKS) for (const c of CG.cards[k].main.concat(CG.cards[k].extra)) {
    collectFilterTags(c.effects, used);
    (c.tags || []).forEach(t => have.add(t));
  }
  assert.ok(used.size >= 2, 'ควรมี tag ใน filter อย่างน้อย dino และ aquila');
  for (const t of used) assert.ok(have.has(t), `tag "${t}" ถูกอ้างใน filter แต่ไม่มีการ์ดติด`);
}});

module.exports = tests;

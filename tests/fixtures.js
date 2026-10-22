// tests/fixtures.js - การ์ดจำลองเล็ก ๆ สำหรับเทสต์ engine (ไม่ใช่เทสต์ ไม่ถูก run.js รันเอง)
// ใช้ผ่าน require('./fixtures') ในไฟล์ *.test.js แล้วจะได้ CG.cards.fixture
const mon = (id, level, atk, def, extra) => Object.assign({
  id, name: id, type: 'monster', level, atk, def, mana: '0', count: 3, leader: false,
  proposed_level: false, text: '', effects: []
}, extra || {});

globalThis.CG = globalThis.CG || {};
CG.cards = CG.cards || {};
CG.cards.fixture = {
  key: 'fixture', name: 'เด็คจำลองสำหรับเทสต์',
  main: [
    mon('fx_l1a', 1, 1000, 500), mon('fx_l1b', 1, 800, 1200), mon('fx_l1c', 1, 600, 600),
    mon('fx_l2a', 2, 1600, 1000), mon('fx_l2b', 2, 1500, 1500),
    mon('fx_l3a', 3, 2400, 2000), mon('fx_l3b', 3, 2400, 1800),
    { id: 'fx_spell', name: 'fx_spell', type: 'spell', mana: '0', count: 3, group: 'normal', field: false,
      proposed_level: false, text: '', effects: [] }
  ],
  extra: [
    mon('fx_fusion', 3, 2600, 2000, { type: 'fusion', count: undefined }),
    mon('fx_g4', 3, 3000, 2500, { type: 'grade4', count: undefined })
  ]
};
for (const c of CG.cards.fixture.extra) delete c.count;
module.exports = CG.cards.fixture;

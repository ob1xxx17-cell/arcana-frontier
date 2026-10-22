// tests/run.js - รันด้วย: node tests/run.js
// โหลดโฟลเดอร์ cards/ effects/ engine/ bot/ (ไม่โหลด ui/) แล้วรันทุกไฟล์ tests/*.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.join(__dirname, '..');
globalThis.CG = globalThis.CG || {};

for (const dir of ['cards', 'effects', 'engine', 'bot']) {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) continue;
  for (const f of fs.readdirSync(full).filter(n => n.endsWith('.js')).sort()) {
    const file = path.join(full, f);
    vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file });
  }
}

let pass = 0, fail = 0;
const testFiles = fs.readdirSync(__dirname).filter(n => n.endsWith('.test.js')).sort();
for (const f of testFiles) {
  let list = [];
  try { list = require(path.join(__dirname, f)); }
  catch (e) { fail++; console.log(`FAIL  [${f}] โหลดไฟล์ไม่ได้: ${e.message}`); continue; }
  for (const t of list) {
    try { t.run(assert); pass++; console.log(`ok    ${t.name}`); }
    catch (e) { fail++; console.log(`FAIL  ${t.name}\n      ${e.message}`); }
  }
}
console.log(`\n${pass} ผ่าน, ${fail} ไม่ผ่าน (${testFiles.length} ไฟล์เทสต์)`);
process.exit(fail ? 1 : 0);

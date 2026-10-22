# CONTRACT.md — ข้อตกลงกลางโปรเจกต์เกมการ์ด (v0.3)

ไฟล์นี้คือ "ภาษากลาง" ของทุกแชท อ่านก่อนทำงานทุกครั้ง

**กฎเหล็ก**
1. แก้ไฟล์นี้ได้เฉพาะแชทที่ผู้ใช้สั่งให้แก้ CONTRACT โดยตรง
2. แชทอื่นห้ามแก้ ถ้าเห็นว่าไม่พอ ให้เขียน "ข้อเสนอแก้ CONTRACT" ไว้ท้ายคำตอบ
3. แต่ละแชทแก้ได้เฉพาะโฟลเดอร์ของขั้นตัวเอง (ดูข้อ 2 และข้อ 14)
4. จบทุกขั้นต้องเปิดเล่นหรือรันเทสต์ได้จริง

---

## 1. ค่ากติกา (config) — ตัวเลขทุกตัวอยู่ที่เดียว

ทุกค่าอ่านจาก `state.config` ห้ามเขียนตัวเลขกติกาฝังในโค้ด

| key | ค่า | หมายเหตุ |
|---|---|---|
| `startLp` | 8000 | ค่าทดสอบ |
| `startMana` | 5 | เท่ากับจั่ว 5 ใบแรก |
| `startHand` | 5 | |
| `handLimit` | 7 | ตอนจบเทิร์น ส่วนเกินไป `removed` (นอกเกม) |
| `mulliganCount` | 1 | |
| `firstTurnNoAttack` | true | เทิร์นแรกของเกมโจมตีไม่ได้ ผู้เริ่มก่อนจั่วเทิร์นแรก |
| `monsterSlots` | 5 | ช่องกลาง (index 2) คือช่องผู้นำ |
| `spellSlots` | 5 | บวกช่องการ์ดสนาม 1 ช่องร่วม |
| `maxCopies` | 3 | ซ้ำชื่อในเด็ค |
| `extraSize` | {fusion:10, grade4:10} | |
| `tiebreakTurn` | 50 | เด็คหมดทั้งคู่และเกินเทิร์นนี้: คนมีการ์ดบนสนามมากกว่าชนะ เท่ากันเสมอ |
| `damageStepAllowSpeed2` | **true** | ตัดสินแล้ว: สเปลความเร็ว 2 ใช้ใน Damage Step ได้ (สวิตช์ เปลี่ยนได้) |
| `chainTimeoutSec` | **null** | ตัดสินแล้ว: ไม่จำกัดเวลาตอบโต้ |
| `stackMaxLayers` | **null** | ไม่จำกัดชั้นวางทับ การ์ดแต่ละใบกำหนดเองผ่านเอฟเฟกต์ (ค่าเริ่มต้นที่เสนอ ผู้ใช้ยังไม่ปฏิเสธ) |
| `overlayDestroyTogether` | **true** | ตัดสินแล้ว: ตัวบนถูกทำลาย ตัวล่างถูกทำลายด้วย นับเป็นหน่วยเดียว ยกเว้นการ์ดที่เอฟเฟกต์กันทำลาย (เช่น ฮาสตาตัสส่งตัวใต้การ์ดไปสุสานแทน) |

กติกาย่อที่ engine ต้องทำตาม (ที่มา: Rulebook v0.7)
- **มานา:** +1 ต่อการจั่วทุกครั้ง (รวมเอฟเฟกต์จั่ว) ไม่ได้จากค้นหา/เรียกกลับ ใช้แล้วหมดถาวร ไม่มีเพดาน จ่ายตอนประกาศไม่คืน เด็คหมดจั่วไม่ได้จึงไม่ได้มานา
- **อัญเชิญ:** Lv1 ลงปกติ 1/เทิร์น และเสียสละ 1/เทิร์น (นับแยก) | Lv2 = Lv1+Lv1 | Lv3 = Lv1+Lv2 หรือ Lv1×3 | วัสดุต้องไม่มี Level เท่ากับตัวที่เรียก | Set คว่ำท่าป้องกัน, Flip Summon, เปลี่ยนท่า 1 ครั้ง/ตัว/เทิร์น | Special Summon ไม่จำกัด ช่องเต็ม 5 เรียกเพิ่มไม่ได้
- **ต่อสู้:** ATK>ATK ฝ่ายแพ้ตาย เสีย LP เท่าส่วนต่าง | เท่ากัน ฝ่ายโจมตีทำลายเป้า ไม่เสีย LP | ATK>DEF เป้าตาย ไม่เสีย LP | ATK<DEF ผู้โจมตีเสีย LP ส่วนต่าง | ป้องกันคว่ำพลิกก่อนคำนวณ | โจมตีตรงเมื่อฝ่ายตรงข้ามไม่มีมอนสเตอร์
- **สเปล 3 ประเภท (`group`):** `normal` (จากมือ เทิร์นตัวเอง เร็ว 1) | `set` หมอบรอ (วางคว่ำรอ 1 เทิร์นเต็ม เร็ว 2) | `counter` สวนกลับ (จากมือ เทิร์นคู่ต่อสู้ เร็ว 3) | Chain ใบหลังแก้ก่อน | ชื่อการ์ดเดียวกันใช้เอฟเฟกต์ 1 ครั้ง/เทิร์นรวมกัน
- **วางทับ (overlay):** คำสั่งกลาง ทำได้เฉพาะการ์ดที่เอฟเฟกต์ระบุ เป็น Special Summon ตัวบนอยู่ช่องเดียวกับตัวล่าง
- **Grade 4:** เรียกตามเอฟเฟกต์เท่านั้น 1 ครั้ง/เทิร์นรวมทุกใบ กลับ Extra Deck เมื่อจบเทิร์นหรือถูกทำลาย
- **จบเกม:** LP 0 | เด็คหมดไม่แพ้ | ดู `tiebreakTurn`

---

## 2. โครงโฟลเดอร์และเจ้าของ

```
game/
  CONTRACT.md       ← ไฟล์นี้
  cards/            ← ข้อมูลการ์ด (ขั้น 1, 4, 9)
  engine/           ← ตรรกะล้วน ห้ามมี DOM/setTimeout (ขั้น 2, 5, 6)
  effects/          ← ชิ้นส่วนเอฟเฟกต์ (ขั้น 4)
  bot/              ← บอท (ขั้น 7)
  ui/               ← หน้าจอ ล็อบบี้ (ขั้น 3)
  tests/            ← เทสต์ (ทุกขั้นเพิ่มของตัวเองได้)
  legacy/           ← โค้ดต้นแบบเดิม (อ่านอย่างเดียว ห้ามแก้ ใช้เป็นแหล่งอ้างอิง)
  index.html        ← สร้างในขั้น 3
```

---

## 3. วิธีโหลดโค้ด (ต้องเปิดได้ด้วยดับเบิลคลิก index.html)

เปิดจาก `file://` ไม่ได้ใช้ ES modules หรือ `fetch` ได้ จึงบังคับดังนี้
- ทุกไฟล์เป็น **classic script** ห่อด้วย IIFE และแปะของตัวเองไว้ใต้ `globalThis.CG`

```js
(function () {
  const CG = (globalThis.CG = globalThis.CG || {});
  CG.engine = CG.engine || {};
  CG.engine.battle = { /* ... */ };
})();
```
- **ห้ามเรียกโมดูลอื่นตอนโหลดไฟล์** เรียกได้เฉพาะตอนฟังก์ชันถูกใช้งาน (ทำให้ลำดับโหลดไม่สำคัญ)
- ข้อมูลการ์ดเก็บเป็นไฟล์ `.js` ที่มีเนื้อ JSON ล้วน (ไม่มีฟังก์ชัน) แล้วลงทะเบียน `CG.cards.<deckKey> = { key, name, main, extra }` (โครงเต็มอยู่ข้อ 4)
- Node ทดสอบโดย `tests/run.js` โหลดโฟลเดอร์ `cards/ effects/ engine/ bot/` ตามชื่อไฟล์ ไม่โหลด `ui/`

---

## 4. รูปแบบการ์ด (Card Definition)

ที่มา: `decks_v0.7.json` (ฟิลด์ที่มีอยู่แล้วคงชื่อเดิมทั้งหมด)

```js
{
  id: "aq_spearman",            // ไม่ซ้ำทั้งเกม ใช้ prefix เด็ค
  name: "อาควิลา นักรบหอก",
  type: "monster",              // monster | spell | fusion | grade4
  level: 1,                     // 1-3 (grade4 = 3 ตามข้อเสนอ)
  atk: 800, def: 500,
  mana: "0",                    // ข้อความแสดงผล เช่น "3/1" (ค่าจริงอยู่ที่ effects[].cost)
                                // การ์ดใน extra ที่ต้นฉบับไม่มีฟิลด์นี้ ให้ใส่ "0" ไว้เป็นค่าเริ่มต้น
  count: 3,                     // จำนวนสำเนาในเด็ค (เฉพาะ main)
  leader: false,                // เปิดสิทธิ์สั่งการเมื่ออยู่ช่องผู้นำ
  group: "normal",              // เฉพาะ spell: normal | set | counter
  field: false,                 // เฉพาะ spell: true = ลงช่องการ์ดสนาม
  materials: "...",             // เฉพาะ fusion/grade4 ข้อความอธิบายวัสดุ
  proposed_level: false,        // เครื่องหมาย "ข้อสมมติ ยังไม่ยืนยัน"
  tags: ["aquila", "soldier"],  // ใหม่ (ไม่บังคับ) ใช้กรองเป้าหมายของเอฟเฟกต์
  text: "ข้อความเอฟเฟกต์ภาษาคน",   // ใช้แสดงผลเท่านั้น engine ไม่อ่าน
  effects: [ /* ดูข้อ 10 */ ]   // ใหม่ ขั้น 1 ใส่ [] ไว้ก่อน ขั้น 4 เติม
}
```

**โครงของเด็ค** (หนึ่งเด็คต่อหนึ่งไฟล์ใน `cards/`)

```js
CG.cards.aquila = {
  key: "aquila",
  name: "เด็คอาควิลา (นักรบโรมัน)",
  main:  [ Card, ... ],   // มีฟิลด์ count (จำนวนสำเนา) รวมแล้วต้อง 40 ใบ
  extra: [ Card, ... ]    // ใบละ 1 สำเนา ไม่มี count (fusion/grade4)
};
```

กฎ: engine ห้ามอ่าน `text` และห้ามมี `switch (card.id)` ที่ใดในโฟลเดอร์ `engine/` พฤติกรรมการ์ดมาจาก `effects[]` เท่านั้น

---

## 5. สถานะเกม (State)

`state` เป็น object ธรรมดา (JSON-serializable ยกเว้น `rng`) engine แก้ค่าในที่เดิมแล้วคืน `events`

```js
state = {
  config: { /* ข้อ 1 */ },
  turn: 1,
  activeIdx: 0,                 // 0 หรือ 1
  phase: "main1",               // draw|standby|main1|battle|main2|end
  battleStep: null,             // null|declare|battleStep|damageStep|damageCalc|afterDamage
  chain: [],                    // กองลิงก์ Chain (ข้อ 8)
  pending: null,                // คำขอให้ผู้เล่นตัดสินใจ (ข้อ 8)
  winner: null,                 // null | 0 | 1 | "draw"
  ended: false,
  log: [],                      // events ทั้งหมดสะสม (ใช้ replay/debug)
  rng: { seed, next() },        // สุ่มแบบกำหนด seed ให้เทสต์ซ้ำได้
  players: [ P0, P1 ],
  nextUid: 1
}

Player = {
  idx, name, deckKey,
  lp, mana,
  deck: [], hand: [], extra: [], grave: [], removed: [],
  monsters: [null,null,null,null,null],     // CardInstance|null  (index 2 = ผู้นำ)
  spells:   [null,null,null,null,null],
  fieldSpell: null,
  flags: { normalSummonUsed, tributeSummonUsed, mulliganUsed, grade4SummonedThisTurn },
  usedEffects: {}               // { "<limitKey>": จำนวนครั้งที่ใช้ในเทิร์นนี้/เกมนี้ }
}

CardInstance = {
  uid,                          // เลขไม่ซ้ำต่อใบ (ไม่ใช่ id การ์ด)
  cardId,                       // อ้าง CG.cards
  owner, controller,
  faceDown: false,
  position: "atk",              // atk | def
  level, baseAtk, baseDef,
  atkMod: 0, defMod: 0,         // ตัวปรับถาวร  (ATK จริง = baseAtk + atkMod + tempAtkMod)
  tempAtkMod: 0, tempDefMod: 0, // ตัวปรับถึงจบเทิร์น
  under: [],                    // CardInstance ที่ถูกวางทับอยู่ใต้การ์ดนี้ (ตัวล่างสุดอยู่หน้า array)
  flags: { summonedTurn, canAttack, attackedThisTurn, positionChangedThisTurn, setTurn }
}
```

การเปลี่ยนจากต้นแบบเดิม (ดูข้อ 13): `monsterSlots`→`monsters`, `spellSlots`→`spells`, `graveyard`→`grave`, ท่า `'face-up-atk'`→`faceDown:false + position:'atk'`

---

## 6. จังหวะเทิร์น

```
draw → standby → main1 → battle → main2 → end
```
- `draw` และ `standby` เป็นเฟสจริง เปิดหน้าต่าง trigger ได้ (ไข่ไดโนฟักตอน standby) แต่ `advancePhase` ข้ามอัตโนมัติถ้าไม่มีอะไรให้ทำ
- `battle` มี `battleStep` ย่อย: `declare` (ประกาศโจมตี) → `battleStep` (ก่อนคำนวณ เปิดตอบโต้ได้) → `damageStep` → `damageCalc` → `afterDamage`
- **หน้าต่างตอบโต้ (priority window)** เปิดเสมอที่: หลังประกาศโจมตี, `battleStep`, `damageStep` (ถ้า `damageStepAllowSpeed2` = true ใช้ได้ความเร็ว ≥ 2, ถ้า false ใช้ได้เฉพาะความเร็ว 3 และเอฟเฟกต์ที่ระบุเอง), หลังทุกการอัญเชิญ/เอฟเฟกต์ที่เกิด trigger
- ตอนจบเทิร์น: ทิ้งมือเกิน `handLimit` ไป `removed`, ล้าง `tempAtkMod/tempDefMod`, Grade 4 กลับ `extra`, รีเซ็ต flags ของเทิร์น

---

## 7. คำสั่ง (Actions) และ API ของ engine

UI และบอท **เรียกได้เฉพาะ 4 ฟังก์ชันนี้** เพื่อเปลี่ยนหรือถามสถานะ

```js
CG.engine.createGame({ deckA, deckB, seed, mode, config }) → state
   // deckA/deckB = key เช่น "aquila"; mode = "bot" | "pvp"; config ทับค่าเริ่มต้นบางตัวได้
CG.engine.getLegalActions(state, playerIdx) → Action[]
CG.engine.applyAction(state, action) → { ok, error, events }
CG.engine.cloneState(state) → state ใหม่   // ให้บอทลองเดินล่วงหน้า
```

- `applyAction` ต้องเช็กความถูกต้องเอง ถ้าผิดกติกาให้ `{ ok:false, error:"<รหัส>" }` โดย **ไม่เปลี่ยน state**
- `error` เป็นรหัสสั้น เช่น `NOT_YOUR_TURN`, `MATERIAL_LEVEL_EQUAL`, `SLOT_FULL`, `NOT_ENOUGH_MANA` (UI แปลเป็นข้อความไทยเอง จากตารางใน `ui/strings_th.js`)
- ห้ามมี `setTimeout`, `alert`, `document` ใน `engine/` ความหน่วงของบอท/แอนิเมชันเป็นหน้าที่ของ UI

**รายการ Action** (ทุกอันมี `player` = ผู้ลงมือ)

| type | ฟิลด์ | หมายเหตุ |
|---|---|---|
| `mulligan` | `{ indices?: number[] }` | ก่อนเริ่มเทิร์นแรก, `mulliganCount` ครั้ง |
| `advancePhase` | – | main1→battle→main2→end |
| `endTurn` | – | ลัดไป end |
| `normalSummon` | `{ handIdx, slot }` | Lv1 |
| `setMonster` | `{ handIdx, slot }` | คว่ำท่าป้องกัน |
| `tributeSummon` | `{ handIdx, materials: slot[], slot }` | Lv2-3 |
| `flipSummon` | `{ slot }` | |
| `changePosition` | `{ slot }` | |
| `overlay` | `{ handIdx, targetSlot }` | วางทับ (เฉพาะการ์ดที่เอฟเฟกต์ระบุ) |
| `setSpell` | `{ handIdx, slot }` | วางคว่ำ (หมอบรอ) หรือการ์ดสนามลง `fieldSpell` |
| `activateSpell` | `{ handIdx }` หรือ `{ spellSlot }` | |
| `activateEffect` | `{ slot, effectId }` | เอฟเฟกต์เปิดใช้เอง/ผู้นำ |
| `attack` | `{ from, to }` | `to: null` = โจมตีตรง |
| `respond` | `{ choice }` | ตอบ `pending` (ข้อ 8) |
| `pass` | – | ไม่ตอบโต้ในหน้าต่าง priority |

ตัวอย่าง: `{ type:"attack", player:0, from:2, to:1 }`

---

## 8. คำขอตัดสินใจ (pending) และ Chain

เอฟเฟกต์ที่ต้องรอผู้เล่นเลือก (เลือกเป้า เลือกวัสดุ เลือกการ์ด ใช่/ไม่ใช่) ให้ engine ตั้ง `state.pending` แล้วหยุดรอ ระหว่างนั้นผู้เล่นที่ถูกถามเท่านั้นที่ส่ง `respond` ได้

```js
state.pending = {
  kind: "chooseTarget" | "chooseCards" | "chooseSlot" | "yesNo" | "chainWindow",
  player: 1,                    // ผู้ที่ต้องตอบ
  prompt: "ENGINE_PROMPT_CODE", // รหัส ให้ UI แปลเป็นไทย
  options: [ /* ตัวเลือกที่ถูกกติกา */ ],
  min: 1, max: 1
}
```

**Chain**
- `state.chain` = กอง (stack) ของลิงก์ `{ uid, source, effectId, speed, controller, targets }`
- เมื่อมีใครเพิ่มลิงก์ → เปิด `pending.kind = "chainWindow"` ให้ **ฝ่ายตรงข้ามตัดสินก่อน** เลือก `pass` หรือเพิ่มลิงก์ที่ความเร็ว **≥** ลิงก์บนสุด
- เมื่อทั้งสองฝ่าย `pass` ติดกัน → แก้ผล **จากใบหลังสุดย้อนไปใบแรก** เป้าที่หายไปแล้วไม่เกิดผล (`CHAIN_FIZZLE`)
- ไม่มีเวลาจำกัด (`chainTimeoutSec = null`)

---

## 9. เหตุการณ์ (Events)

`applyAction` คืน `events[]` ใช้สำหรับแอนิเมชัน เสียง และ log UI ห้ามอ่านค่าจาก event เพื่อตัดสินกติกา ต้องอ่านจาก state เท่านั้น

```js
{ type: "draw",        player, uid }
{ type: "manaChange",  player, delta, reason }        // reason: "draw"|"cost"|"effect"
{ type: "summon",      player, uid, slot, how }       // how: normal|set|tribute|flip|special|overlay
{ type: "moveCard",    uid, from, to }                // zone: deck|hand|monster|spell|grave|removed|extra
{ type: "positionChange", uid, position, faceDown }
{ type: "attackDeclared", from, to }
{ type: "destroy",     uid, by }                      // by: battle|effect|rule
{ type: "lpChange",    player, delta, reason }
{ type: "statChange",  uid, stat, delta, duration }
{ type: "chainAdd",    link } 
{ type: "chainResolve", link, fizzled }
{ type: "phaseChange", phase, turn, activeIdx }
{ type: "gameEnd",     winner, reason }
{ type: "rejected",    code }                         // เหตุผลที่คำสั่งถูกปฏิเสธ
```

---

## 10. เอฟเฟกต์การ์ด

เอฟเฟกต์เป็น **ข้อมูล** ประกอบจากชิ้นส่วน (primitives) ที่ลงทะเบียนในโฟลเดอร์ `effects/`

```js
effects: [{
  id: "hatch",                      // ไม่ซ้ำในการ์ดใบนั้น
  trigger: "onStandby",             // ดูตารางด้านล่าง
  speed: 1,                         // 1 | 2 | 3
  cost: { mana: 0 },                // จ่ายตอนประกาศ ไม่คืน
  limit: { per: "turn", key: "hatch", count: 1 },   // per: turn | game | null
  condition: [ { op: "onFieldSinceLastTurn" } ],    // เงื่อนไข (ข้อมูล ไม่ใช่โค้ด)
  do: [                                              // รันตามลำดับ
    { op: "sendToGrave", target: "self" },
    { op: "specialSummon", from: ["hand","deck"], filter: { cardId: "dino_small_raptor" }, count: 1 }
  ]
}]
```

**trigger ที่ engine รองรับ:** `ignition` (ผู้เล่นสั่งใช้เองในเมน) · `quick` (ความเร็ว 2 ในหน้าต่าง priority) · `continuous` (มีผลตลอดเวลา) · `onSummon` · `onFlip` · `onOverlay` · `onStandby` · `onEndPhase` · `onAttackDeclared` · `onBattleDestroy` (ตัวนี้ทำลายมอนสเตอร์ศัตรูในต่อสู้) · `onDestroyed` · `onSentToGrave`

**selector เป้าหมาย:** `target: "self" | { side:"self"|"opp", zone:"monster"|"spell"|"grave"|"hand"|"deck", filter:{ tag, levelMin, levelMax, cardId }, count, choose:"player"|"auto" }`

**ชิ้นส่วนชุดเริ่มต้น (primitives)** — เพิ่มได้เฉพาะในขั้น 4 และต้องบันทึกชื่อไว้ในตารางนี้โดยแชทขั้น CONTRACT

| op | ทำอะไร |
|---|---|
| `draw` {count} | จั่ว (ได้มานา +1 ต่อใบ) |
| `addMana` {amount} | เพิ่มมานาจากเอฟเฟกต์ |
| `search` {from, filter, to} | ค้นหา (ไม่ได้มานา) |
| `destroy` {target} | ทำลาย (เช็ก preventDestruction และ overlay) |
| `sendToGrave` / `banish` / `returnToHand` / `returnToDeck` {target} | ย้ายโซน |
| `specialSummon` {from, filter, count, slot?} | เรียกพิเศษ |
| `modifyStat` {target, stat, amount, duration} | duration: `permanent` \| `endTurn` |
| `damage` / `heal` {player, amount} | |
| `negate` {link} | ลบล้างลิงก์ใน Chain |
| `preventDestruction` {instead} | `continuous` กันถูกทำลายและทำสิ่งทดแทน |
| `extraAttack` {count} | โจมตีเพิ่ม |
| `restrictAttack` {target} | ห้ามโจมตี |

**สถานะชิ้นส่วน (อัปเดต v0.3):** ทำแล้ว 12 ตัว = `draw`, `addMana`, `modifyStat`, `destroy`, `sendToGrave`, `damage`, `heal`, `preventDestruction` (ผ่านเงื่อนไขใน `destroy`), `search`, `specialSummon`, `returnToHand`, `returnToDeck`, `banish` ที่ยังไม่ทำ: `negate` (ทำพร้อม Chain ขั้น 5), `extraAttack`, `restrictAttack`

**พารามิเตอร์ที่ชิ้นส่วนรองรับจริง**
- `search` {from, filter, to, count} ไม่ได้มานา ไม่สับเด็ค
- `specialSummon` {from, filter, count, slot?, faceDown?, position?} ไม่นับโควตาลงปกติ ช่องเต็มเรียกไม่ได้
- `returnToDeck` {target, position: "top" | "bottom"} ค่าเริ่มต้น `bottom` ไม่สับเด็ค
- ชิ้นส่วนย้ายโซนทั้งหมดที่มีตัวซ้อนอยู่ใต้ (overlay) พาตัวใต้ไปปลายทางเดียวกันทั้งกอง
- `banish` และการย้ายโซนอื่นนอกจากลงสุสาน **ไม่ยิง** `onSentToGrave`

**ข้อจำกัดชั่วคราว:** `choose:"player"` ยังไม่มีหน้าต่างให้ผู้เล่นเลือกเป้า ตอนนี้เลือกตัวแรกที่ตรงตัวกรอง ต้องทำผ่าน `state.pending` (ข้อ 8) ในขั้น 5

เอฟเฟกต์ที่ชิ้นส่วนด้านบนทำไม่ได้ → แชทขั้น 4 ต้องรายงานเป็น "ข้อเสนอเพิ่มชิ้นส่วน" ไม่ใช่เขียนโค้ดพิเศษรายใบ

---

## 11. บอท

```js
CG.bot.chooseAction(state, playerIdx, legalActions) → Action
```
ฟังก์ชันล้วน ห้ามมีเวลาหน่วง ตัวรันเกม (UI หรือ `tests/botMatch.js`) เป็นคนเรียกวนและใส่ความหน่วงเอง บอทใช้ `cloneState` + `applyAction` ลองล่วงหน้าได้

---

## 12. UI

- UI วาดจาก `state` + `events` เท่านั้น เปลี่ยนสถานะผ่าน `applyAction` เท่านั้น **ห้ามแก้ `state` ตรง ๆ**
- ข้อความภาษาไทยทุกตัวอยู่ใน `ui/strings_th.js` (`CG.ui.strings`) ห้ามเขียนข้อความฝังในโค้ด รวมทั้งชื่อเรียก LP / สเปล / Grade 4 ฉบับจริงที่ยังไม่ตัดสิน เพื่อเปลี่ยนที่เดียว
- ตัวช่วยไฮไลต์ช่องที่ทำได้ ให้ใช้ผลจาก `getLegalActions` ไม่คำนวณกติกาซ้ำใน UI

---

## 13. เทสต์

- รัน: `node tests/run.js` (โหลด `cards/ effects/ engine/ bot/` แล้วรันทุกไฟล์ `tests/*.test.js`)
- ทุกไฟล์เทสต์ `module.exports = [ { name: "ชื่อ", run(assert) { ... } } ]`
- เทสต์สร้างสถานการณ์ด้วย `CG.test.makeGame({ p0: { hand:[cardId...], monsters:{2:cardId}, mana }, p1: { ... }, seed })` (ตัวช่วยนี้เขียนในขั้น 2 ที่ `engine/testSetup.js`)
- เทสต์อ้างข้อในเช็กลิสต์ 14 ข้อของ HANDOFF ด้วยชื่อเช่น `"V1-03 เสียสละ Lv2 หลังลง Lv1"`
- บอทสู้บอท: `tests/botMatch.js` รัน N เกมจาก seed 1..N ต้องจบทุกเกมและไม่มี exception

---

## 14. ขั้นงาน และโฟลเดอร์ที่แต่ละขั้นแตะได้

| ขั้น | แตะได้ | อ่านอย่างเดียว |
|---|---|---|
| 0 | CONTRACT.md, โครงโฟลเดอร์ | – |
| 1 | `cards/`, `tests/cards.test.js` | CONTRACT |
| 2 | `engine/`, `tests/` | `cards/`, `legacy/game.js` |
| 3 | `ui/`, `index.html` | `engine` API ตามข้อ 7, `legacy/ui.js` `legacy/style.css` |
| 4 | `effects/`, `cards/` (เฉพาะ `effects[]`) | `engine/` |
| 5 | `engine/chain.js`, `tests/` | |
| 6 | `engine/overlay.js` และเอฟเฟกต์ Grade 4 | |
| 7 | `bot/`, `tests/botMatch.js` | |
| 8 | ผู้ใช้ + Claude: ปรับค่า config และ CONTRACT | |
| 9 | `cards/` | |
| 10 | ผู้ใช้ + agent: ส่งออกเว็บ | |

ขั้น 2 และ 3 ทำขนานกันได้ เพราะเชื่อมกันผ่านข้อ 7 เท่านั้น ระหว่างที่ขั้น 2 ยังไม่เสร็จ ขั้น 3 ใช้ตัวจำลอง `ui/mockEngine.js` ที่คืนค่าตามรูปแบบข้อ 7 และข้อ 9

---

## 15. แปลงจากโค้ดต้นแบบเดิม (`legacy/`)

| เดิม (`legacy/game.js`) | ใหม่ |
|---|---|
| `class CardGame` มี state ในตัว + `onStateChange` | `state` object + `applyAction` (ไม่มี callback) |
| `players[i].monsterSlots / spellSlots / graveyard / removed` | `monsters / spells / grave / removed` |
| `normalSummon(handIdx, slotIdx)` ฯลฯ เรียกตรง | `applyAction({type:"normalSummon", ...})` |
| `stackSpearman`, `hatchEgg`, `applySpellEffect` (switch ตาม id) | `overlay` action + `effects[]` (ข้อ 10) |
| `runBotTurn()` มี `setTimeout` ในตัว engine | `CG.bot.chooseAction` ล้วน ๆ ส่วนเวลาหน่วงอยู่ที่ UI |
| draw/standby ทำอัตโนมัติ ข้ามเฟส | เป็นเฟสจริง แต่ข้ามอัตโนมัติถ้าไม่มี trigger |
| `log(msg)` เก็บข้อความไทย | `events[]` เป็นรหัส UI แปลเอง |

ของเดิมที่ **เก็บไว้ใช้ซ้ำได้เลย**: ตารางต่อสู้ใน `attackMonster`, ลอจิกเสียสละใน `tributeSummon`, ธีมสีและ layout ใน `legacy/style.css`, โครงล็อบบี้ใน `legacy/lobby.js`

---

## 16. กติกาที่ยังไม่ตัดสิน (engine ต้องรองรับด้วย config/สวิตช์ ห้ามฝังค่า)

1. ชื่อเรียก LP / สเปล / Grade 4 ฉบับจริง และ Level ของ Grade 4 (ตอนนี้ใช้ Lv3 การ์ดที่ติด `proposed_level: true` ตอนนี้คือ `dino_mega_tyrant` และ `aq_dictator` ให้ engine อ่าน `level` ตามค่าที่ใส่ ไม่เขียนเงื่อนไขพิเศษ)
2. LP เริ่มต้นและช่วง ATK ต่อ Level ต้องปรับตามการทดลองเล่น
3. Lv3 เร็วสุดเทิร์น 1 ตามคอมโบอาควิลา เร็วเกินไปหรือไม่ (ตัดสินในขั้น 8)
4. ค่า `stackMaxLayers` และเรื่องตัวล่างของวางทับเมื่อโดนเอฟเฟกต์เฉพาะ (ใช้ค่าเริ่มต้นในข้อ 1 ไปก่อน)

---

## ข้อเสนอแก้ CONTRACT (ที่ว่างสำหรับแชทอื่นเขียน)

_(แชทอื่นเขียนเพิ่มที่นี่ แล้วนำมาให้แชท CONTRACT ตัดสิน)_

**บันทึกการตัดสิน**
- v0.3 (จากขั้น 4B) รับการตัดสินของแชท 4B ทั้ง 5 ข้อ: returnToDeck ใต้เด็คเป็นค่าเริ่มต้น / ตัวซ้อนไปพร้อมตัวบนทุกการย้ายโซน / banish ไม่ยิง onSentToGrave / ไม่สับเด็คหลัง search และ returnToDeck (เพิ่มตัวเลือกสับได้ภายหลัง) / เลือกเป้าอัตโนมัติชั่วคราว ย้ายการเลือกโดยผู้เล่นไปทำพร้อมขั้น 5
- v0.2 (จากข้อเสนอขั้น 1) รับทั้ง 4 ข้อ: (1) การ์ดใน `extra` ใส่ `mana: "0"` เป็นค่าเริ่มต้น (2) โครงเด็ค `{ key, name, main, extra }` ระบุในข้อ 4 (3) ขั้น 1 แตะ `tests/cards.test.js` ได้ ตามข้อ 14 (4) การ์ดที่ Level ยังเป็นข้อสมมติคงเครื่องหมาย `proposed_level` ไว้ตามข้อ 16

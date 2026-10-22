# CONTRACT_PROPOSALS.md — ข้อเสนอแก้ CONTRACT ที่สะสมระหว่างขั้น 4E (ผู้ตัดสินรวมเข้า CONTRACT v0.4 ตอนปิดขั้น 4)
แชทขั้นอื่นเติมได้เฉพาะหัวข้อของตัวเอง ห้ามแก้ CONTRACT.md

## 4E-2A (เขียนโดยแชทกติกา จากโค้ดในซิป 4E2A เพราะซิปไม่มีไฟล์นี้)
ข้อ 10: trigger ใหม่ 4 ตัว (ชื่อใน TRIGGERS ของ effectBridge.js)
| trigger | ยิงเมื่อ | ctx |
|---|---|---|
| onTributed | ตัวที่ถูกใช้เป็นวัสดุเสียสละตอนอัญเชิญแบบเสียสละ (ไม่นับ Fusion/วางทับ) ยิงหลังตัวเรียกลงสนาม แล้ว onSentToGrave ของวัสดุยิงตามปกติ | source=วัสดุ, summonedUid=ตัวที่ถูกเรียก |
| onNormalSummon | อัญเชิญปกติสำเร็จ (ไม่ยิงตอน Set คว่ำ หรืออัญเชิญพิเศษ) | source=ตัวที่ลงสนาม, how='normal' หรือ 'tribute' |
| onAttacked | ประกาศโจมตีมีเป้าเป็นมอนสเตอร์หงาย (ไม่ยิงโจมตีตรง หรือเป้าคว่ำ) ไม่ว่าท่าไหน | source=ตัวถูกโจมตี, attackerUid |
| onBattleDestroyed | ตัวที่ถูกทำลายจากการต่อสู้ (ทั้งฝ่ายรับและฝ่ายโจมตีที่แพ้) ไม่ยิงถ้าตายด้วยเอฟเฟกต์ | source=ตัวที่ตาย (หาจากสุสาน/Extra), killerUid |
ข้อ 10: watcher "การ์ดอื่นของเราถูกส่งไปสุสาน" ใช้ onSentToGrave เดิม ด้วย zone:"hand" + other:true + filter ของตัวที่ถูกส่ง (ไม่จำกัดโซนต้นทาง ของศัตรูไม่นับ)

## 4E-2B (เขียนโดยแชทชิ้นส่วนอาควิลา จากโค้ดในซิป 4E2B)
> **สถานะเทสต์: FAIL 2 ข้อที่ต้องให้ผู้ตัดสินแก้** — AQ-13 และ DINO-12 ล็อกรายชื่อการ์ดที่มี effects ไว้ตายตัว การแปลงการ์ดตามคำสั่งทำให้สองข้อนี้ล้มโดยออกแบบ (ไฟล์เทสต์เดิมอยู่นอกสิทธิ์แก้ของขั้นนี้) ดู "เทสต์เดิมที่ต้องปรับ" ด้านล่าง ที่เหลือผ่านทั้งหมด (209 ผ่าน / 2 ไม่ผ่าน)

### ข้อ 10 — ชิ้นส่วน/พารามิเตอร์ใหม่
| ของใหม่ | รูปแบบ | พฤติกรรม |
|---|---|---|
| continuous aura | effect `trigger:"continuous"` + `do:[{op:"modifyStat", aura:true, target, stat, amount}]` + `condition` | มีผลขณะต้นทางหงายอยู่บนสนามและ condition จริง คำนวณใหม่ทุกครั้งเก็บใน `inst.auraAtk/auraDef` (ไม่ใช่ `atkMod`) `E.atk/E.def` รวมให้ ออกจากสนามหรือ condition ไม่จริงแล้วหายทันที ถ้าสั่งรัน step นี้ผ่าน `FX.run` ตรง ๆ เป็น no-op |
| condition `inLeaderSlot` | `{op:"inLeaderSlot"}` | ต้นทางหงายอยู่ช่องผู้นำของผู้คุม |
| condition `controls` | `{op:"controls", side?:"self"\|"opp", filter, min?:1}` | นับเฉพาะมอนสเตอร์หงาย |
| condition `hasUnder` | `{op:"hasUnder", filter?, min?:1}` | ต้นทางมี `inst.under` ที่ตรงตัวกรองอย่างน้อย min ใบ |
| filter `atkBelowSource` | `filter:{atkBelowSource:true}` | ATK ปัจจุบัน (รวม aura/มอด) น้อยกว่า ATK ต้นทาง `ctx.source` |
| selector `pick:"lowestAtk"` | `target:{side:"self", zone:"monster", filter, pick:"lowestAtk"}` | เหลือเฉพาะตัว ATK ต่ำสุดในรายการที่กรองแล้ว เสมอกันได้ทุกตัว (ใช้ `count` ตัดได้) |
| selector `other:true` | `target:{..., other:true}` | ไม่นับต้นทาง |
| selector `zone:"under"` | `target:{zone:"under", filter?, count?}` | ตัวซ้อนใต้การ์ดต้นทางเท่านั้น (`sendToGrave` รองรับ: ลงสุสานเจ้าของ ไม่นับเป็นการทำลาย ยิง onSentToGrave) |
| `search` `distinctName:true` | `{op:"search", ..., count:2, distinctName:true}` | ได้ใบละชื่อไม่ซ้ำกัน ไม่ครบจำนวนก็เอาเท่าที่มี |
| `specialSummon` `self:true` | `{op:"specialSummon", from:["hand"], self:true}` | เรียกตัวต้นทางเองจากโซนที่ระบุ |
| op `choice` | `{op:"choice", choose:"player", options:[{do:[...]},...], pick?}` | เลือก 1 จาก N ข้อจำกัดชั่วคราว: engine เลือกข้อแรกที่ "ทำได้จริง" (ลองรันกับสำเนา state ถ้า state เปลี่ยนถือว่าทำได้) ไม่มีข้อไหนทำได้ใช้ข้อแรก `pick` บังคับข้อ ยิง event `choiceMade {uid,index}` ขั้น 5 เปลี่ยนเป็น pending |
| op `reduceCost` | ใน effect `continuous`: `{op:"reduceCost", filter, amount?:1}` + `limit` | ลดมานาของเอฟเฟกต์ "มอนสเตอร์" (ต้นทางไม่ใช่สเปล) ที่ตรง filter ของผู้คุมเดียวกัน ลดเฉพาะเอฟเฟกต์ที่ cost > 0 ใช้โควตา `limit` ของตัวลดเมื่อประกาศผ่านแล้วเท่านั้น (มานาไม่พอ/เงื่อนไขไม่ผ่าน ไม่กินโควตา) ยิง event `costReduced {uid,cardId,effectId,amount}` ตัว op เองรันแล้วไม่ทำอะไร |
| `preventDestruction` มีเงื่อนไข | effect `continuous` มี `condition` (เช่น `hasUnder`) | กันได้เมื่อ condition จริงเท่านั้น ไม่จริง/ไม่รู้จัก condition = ถูกทำลายตามปกติ `instead` ใช้ selector `zone:"under"` ได้ |

### ข้อ 7 — action `activateEffect` ใช้จากมือ
`{type:"activateEffect", player, handIdx, effectId}` (ระบุ `handIdx` แทน `slot` ห้ามระบุทั้งคู่) เฉพาะมอนสเตอร์ในมือ และเอฟเฟกต์ต้องประกาศ `from:"hand"` (`from` = `"field"` \| `"hand"` หรือ array ค่าเริ่มต้น `"field"` เอฟเฟกต์เดิมทุกตัวทำงานเหมือนเดิม) รหัสผิดพลาดใหม่: `WRONG_ZONE`, `NOT_MONSTER`, `INVALID_HAND_INDEX` `getLegalActions` ใส่ action จากมือให้ผ่านตัวตรวจเดียวกัน (สเปลจากมือยังรอ `activateSpell` ขั้น 5-6)

### ข้อ 1/5 — ช่องผู้นำ และ aura refresh
- ช่องผู้นำ: โค้ดอ่าน `config.leaderSlot` ถ้าไม่มีใช้ช่องกลาง `floor(monsterSlots/2)` = 2 (**ข้อสมมติ** ตามเทสต์ AQ-06 เสนอให้ใส่ `leaderSlot: 2` ใน CONTRACT ข้อ 1)
- `inst.auraAtk/auraDef` เป็นค่าที่คำนวณซ้ำได้ (ไม่มีฟิลด์ = 0 ไม่มีผลต่อรูป state เดิม) คำนวณใหม่ที่: ต้นและท้าย `applyAction`, ต้น `FX.run`/`FX.fire`, หลังทุก step ใน `FX.run`, และใน `E.leaveField` ข้อจำกัด: ถ้าต้นทาง aura หายกลางการต่อสู้ที่ engine ไม่ได้ผ่านจุดข้างต้น ค่าจะถูกแก้ตอนจบ action

### ข้อสมมติที่ขอให้ผู้ตัดสินยืนยัน
1. เซนทูเรียน +300 ATK ให้อาควิลาอื่น **ฝั่งเรา** (ค่า 300 ตามคำสั่ง แม้ `text` ในไฟล์การ์ดยังเขียนไม่ชัด ไม่ได้แก้ `text` เพราะขั้นนี้แก้ได้เฉพาะ `effects[]` ควรให้เจ้าของข้อมูลการ์ดแก้ข้อความ)
2. คาสตรา (2): ATK ต่ำสุดวัดหลังโบนัส aura อื่นแต่ก่อนโบนัสของคาสตราเอง (กันวน) ถ้าเสมอกัน **ทุกตัวที่เสมอได้ +500** (ถ้าต้องการตัวเดียวใส่ `count:1`)
3. คาสตรา (1): ลดได้ทุกเอฟเฟกต์ของมอนสเตอร์อาควิลาที่มี cost > 0 (รวมเอฟเฟกต์ trigger อัตโนมัติ เช่น เอ็กซ์พลอราเตอร์) เทิร์นละครั้ง ไม่ลดเอฟเฟกต์สเปล
4. คำสั่งบุก: +500 ให้อาควิลา **ฝั่งเรา** ทุกตัวที่อยู่ตอนใช้ (ตัวที่ลงทีหลังไม่ได้ เหมือนซาจิตตาริอุส)
5. อิมเพเรเตอร์ใช้ `onSummon` (ข้อความ "เมื่ออัญเชิญสำเร็จ" ไม่จำกัดปกติ) ทำลายศัตรูทั้งที่หงายและคว่ำที่ ATK น้อยกว่า
6. `controls` นับเฉพาะมอนสเตอร์หงาย
7. การ์ดที่เอฟเฟกต์เป็น `continuous` (เซนทูเรียน คาสตรา) ใส่ `cost.mana` เท่ากับมานาบนการ์ดตามข้อตกลงที่ AQ-12 ตรวจ แต่ไม่ถูกจ่ายเพราะไม่เคยถูกรัน

### การ์ดที่แปลง / ไม่แปลง
| การ์ด | สถานะ | ส่วนที่ขาด | รอขั้นไหน |
|---|---|---|---|
| เซนทูเรียน aq_centurion | แปลงแล้ว (aura +300 ช่องผู้นำ) | – | – |
| คาสตรา aq_castra | แปลงแล้ว (reduceCost + aura +500 ต่ำสุด) | – | – |
| อิมเพเรเตอร์ aq_imperator | แปลงแล้ว | – | – |
| เกณฑ์ทหาร aq_recruit | แปลงแล้ว | – | – |
| คอลล์ไดโน dino_call | แปลงแล้ว | – | – |
| ระดมพล aq_muster | แปลงแล้ว (ชั่วคราว: engine เลือกข้อให้) | หน้าต่างให้ผู้เล่นเลือกข้อ | ขั้น 5 (pending) |
| ทิโร aq_tiro | แปลงแล้ว (ใช้จากมือผ่าน activateEffect) | – | – |
| คำสั่งบุก aq_assault | แปลงแล้ว | – | – |
| ฮาสตาตัส aq_hastatus | **ไม่แปลง** (effects: []) | (1) การวางทับ/Fusion ยังเป็น NOT_IMPLEMENTED จึงไม่มีทางมีตัวซ้อนใต้ในเกมจริง (2) `preventDestruction` ตรวจเฉพาะ op `destroy`; `E.destroyMonster` (ทางที่ใช้ทำลายจากต่อสู้) ไม่ตรวจ และ battle.js อยู่นอกสิทธิ์แก้/อ่านของขั้นนี้ จึงยืนยันกันตายจากต่อสู้ + LP ยังเสียไม่ได้ (3) `returnToHand` ของ Fusion ต้องไป Extra และตัวใต้ไปสุสาน แต่ `moveTo` พาทั้งกองไปปลายทางเดียวกัน (4) "ไม่กลับ Extra เองตอนจบเทิร์น" และ "ใช้เป็นวัสดุเสียสละไม่ได้" ต้องมีชิ้นส่วนจำกัด (ที่ turn.js/summon.js) | 4E-2C ที่แตะ battle.js/turn.js/summon.js + overlay ขั้น 5-6 |

ส่วนของฮาสตาตัสที่ทำและทดสอบแล้ว (P4B-21/22): `preventDestruction` มีเงื่อนไข `hasUnder` + `instead` ส่งตัวใต้ 1 ใบลงสุสาน + ATK −500 ถาวรสะสม + ถูกทำลายปกติเมื่อไม่มีตัวใต้ ใช้กับการ์ดจำลองในเทสต์ (state มี `inst.under` อยู่แล้วจึงไม่ต้องเสนอโครงสร้างใหม่)

### เทสต์เดิมที่ต้องปรับ (ผู้ตัดสิน)
- `tests/aquila_effects.test.js` AQ-13: `WITH_EFFECTS` เพิ่ม `aq_centurion, aq_castra, aq_imperator, aq_recruit, aq_muster, aq_tiro, aq_assault` และยกเว้น `aq_castra` ที่มี 2 เอฟเฟกต์ (บรรทัด `effects.length === 1`) ; `aq_hastatus` คงใน `NO_EFFECT` ตามเดิม
- `tests/dino_effects.test.js` DINO-12: `WITH_EFFECTS` เพิ่ม `dino_call`

### ชุดเทสต์
`tests/primitives_aquila.test.js` P4B-01..25 ผ่านทั้งหมด (ทุกของใหม่มีข้อบวก+ลบ รวม aura หายเมื่อต้นทางออกจากสนาม) ชุดเดิมที่เหลือผ่านทั้งหมด จำลองโหลดตามลำดับแท็ก index.html ครบ 16/16 ไฟล์ (ลำดับต่างจาก run.js ที่โหลดตามตัวอักษร ทำงานได้ทั้งสองแบบ) และเล่นสุ่มจาก legal actions 12 เกมจบทุกเกมไม่มี exception

### คำตัดสินของแชทกติกา ต่อ 4E-2B (ใช้ผูกมัดแชทถัดไป)
- ยืนยันข้อสมมติ 1-7 ทั้งหมดตามที่เสนอ (เสมอกันที่ ATK ต่ำสุด ทุกตัวได้ +500)
- ฮาสตาตัส aq_hastatus: เลื่อนไปขั้น 6 พร้อมวางทับ/Fusion ไม่ทำในขั้น 4 ข้อค้างสำหรับขั้น 6: E.destroyMonster (ทำลายจากต่อสู้) ต้องตรวจ preventDestruction, moveTo ต้องแยกปลายทางตัวใต้, จำกัดไม่กลับ Extra เองและห้ามเป็นวัสดุเสียสละ
- แก้เทสต์เดิม AQ-13 (WITH_EFFECTS 14 ใบ, คาสตรา 2 เอฟเฟกต์) และ DINO-12 (13 ใบ) ในซิป 4E2B_fixed แล้ว ผ่าน 211/211
- เสนอใส่ CONTRACT v0.4 ข้อ 1: leaderSlot: 2

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

## 4E-2C-1 (เพิ่มชิ้นส่วนเอฟเฟกต์ใหม่ 4 อย่าง)
### 1. ชิ้นส่วนใหม่ (ข้อ 10)
| op / ฟีเจอร์ | รูปแบบ | พฤติกรรม |
|---|---|---|
| ค่าตามสัดส่วน (proportional value) | `amount: { side?: 'self'\|'opp'\|'both', zone?: 'monster'\|'grave'\|..., filter?, multiplier?: number, base?: number }` หรือ `perCard: { ... }, multiplier` หรือ `value: { ... }` | คำนวณค่าจากจำนวนการ์ดตามตัวกรองคูณด้วย `multiplier` (ค่าเริ่มต้น 1) บวก `base` (ค่าเริ่มต้น 0) ใช้ได้กับ `modifyStat` (ทั้งแบบปกติและ continuous aura), `damage`, และ `heal` |
| `changePosition` | `{ op: 'changePosition', target, position?: 'atk'\|'def'\|'toggle', faceDown?: boolean }` | เปลี่ยนท่าโจมตี/ป้องกันของมอนสเตอร์เป้าหมาย (ค่าเริ่มต้นสลับท่า) หากมอนสเตอร์คว่ำอยู่และเปลี่ยนเป็น `'atk'` จะพลิกหงาย (`faceDown: false`) และยิง trigger `onFlip` พร้อมสร้าง event `positionChange` |
| `extraAttack` | `{ op: 'extraAttack', target?: 'self'\|selector, count?: number }` | ให้มอนสเตอร์เป้าหมายสามารถประกาศโจมตีเพิ่มได้ N ครั้งในเทิร์นนั้น (ค่าเริ่มต้น 1) อัปเดตใน `engine/battle.js` ทำให้ `validateAttack` และ `getLegalActions` อนุญาตให้โจมตีตามจำนวนครั้งที่กำหนด |
| `restrictAttack` | `{ op: 'restrictAttack', target?: 'self'\|selector, duration?: 'permanent'\|'endTurn' }` | มอนสเตอร์ที่ติดสถานะนี้ (หรือมี continuous effect op `restrictAttack`) ฝ่ายตรงข้ามต้องเลือกเป้าหมายเป็นมอนสเตอร์ที่ติดสถานะนี้ก่อน จึงจะโจมตีตัวอื่นหรือโจมตีตรงได้ หากโจมตีเป้าหมายอื่นจะปฏิเสธด้วยรหัส `MUST_ATTACK_RESTRICTED` |

### 2. ข้อเสนอแก้ CONTRACT และความกำกวมที่ขอให้ผู้ตัดสินเคาะ
1. **ความขัดแย้งของ restrictAttack ใน CONTRACT v0.3 ข้อ 10:**
   - ในตาราง CONTRACT.md เดิมระบุ `restrictAttack {target}` = "ห้ามโจมตี" (cannot attack)
   - แต่ในโจทย์ 4E-2C-1 ระบุว่า `restrictAttack` คือ Taunt / Attack Redirection ("ฝ่ายตรงข้ามต้องเลือกเป้านั้นก่อน จึงโจมตีตัวอื่นได้")
   - *ข้อเสนอ:* ยืนยันให้ `restrictAttack` หมายถึง Taunt ตาม 4E-2C-1 และหากต้องการเอฟเฟกต์ห้ามฝ่ายตรงข้ามโจมตี (cannot attack / freeze) เสนอให้เพิ่มเป็น op ใหม่ชื่อ `cannotAttack` หรือ `freezeAttack` ใน CONTRACT v0.4
2. **กรณีมีมอนสเตอร์ติด restrictAttack มากกว่า 1 ตัวบนสนาม:**
   - *ข้อเสนอ:* ผู้เล่นฝ่ายโจมตีสามารถเลือกโจมตีตัวใดตัวหนึ่งในกลุ่มมอนสเตอร์ที่ติด `restrictAttack` ได้อย่างอิสระ (การโจมตีตัวใดตัวหนึ่งในกลุ่มนี้ถือว่าถูกกติกา)
3. **กรณีมอนสเตอร์ติด restrictAttack อยู่ในท่าป้องกัน (DEF) หรือคว่ำ:**
   - *ข้อเสนอ:* หากอยู่ในท่าป้องกัน (DEF) ที่หงายหน้า ยังคงมีผลบังคับให้ศัตรูต้องโจมตีตัวนี้ก่อนตามปกติ แต่หากคว่ำหน้าอยู่ (Face-down) จะไม่มีผล restrict จนกว่าจะถูกพลิกหงาย
4. **กรณีมอนสเตอร์ติด restrictAttack มีเอฟเฟกต์กันตกเป็นเป้าหมายโจมตี (Untargetable / Stealth):**
   - *ข้อเสนอ:* หากมอนสเตอร์ที่ติด `restrictAttack` ไม่สามารถถูกเลือกเป็นเป้าหมายการโจมตีได้ กติกาจะอนุญาตให้ฝ่ายตรงข้ามโจมตีมอนสเตอร์ตัวอื่นได้ตามปกติ เพื่อป้องกันสถานะ soft-lock
5. **การโจมตีตรง (Direct Attack):**
   - *ข้อเสนอ:* ตราบใดที่มีมอนสเตอร์ฝ่ายตรงข้ามติด `restrictAttack` ห้ามประกาศโจมตีตรง (`to: null`) เว้นแต่จะมีเอฟเฟกต์ที่ระบุยกเว้นอย่างชัดเจน

## 4E-3 (กวาดแปลงเอฟเฟกต์การ์ดที่ตกค้างและสรุปสถานะทั้ง 48 ใบ)
### 1. สรุปผลการแปลงการ์ดในขั้น 4E-3
- **แปลงเอฟเฟกต์เพิ่ม 3 ใบในเด็คไดโนเสาร์:**
  - `dino_hunter_raptor` (แรปเตอร์นักล่า): op `destroy` (แรปเตอร์เล็กของเรา 1 ตัว) + `modifyStat` (+800 ATK จนจบเทิร์น) ตรวจเงื่อนไข `controls`
  - `dino_tyrano_raptor` (ไทรานโนแรปเตอร์): onSummon ทำลายมอนสเตอร์ศัตรู 1 ตัว +500 ATK ถาวร, onBattleDestroy +500 ATK ถาวร และ `extraAttack` โจมตีเพิ่ม 1 ครั้งในเทิร์นนั้น
  - `dino_brachio` (บราคิโอซอรัสผู้ทอดเงา): continuous `restrictAttack` (เงาทอดยาว)
- **ปรับปรุงฟิลด์ text ในเด็คอาควิลา 2 ใบ:**
  - `aq_centurion`: ปรับข้อความเป็น "เอฟเฟกต์ช่องผู้นำ: มอนสเตอร์อาควิลาอื่นของเรา +300 ATK"
  - `aq_assault`: ปรับข้อความเป็น "มอนสเตอร์อาควิลาของเราทุกตัว +500 ATK ในเทิร์นนี้"
  - *(หมายเหตุต่อผู้ตัดสิน: การแก้ text ของสองใบนี้ตามคำสั่ง ทำให้เทสต์เดิม `tests/cards.test.js` ข้อ CARDS-08 ตรวจไม่ผ่าน 1 ข้อเนื่องจาก CARDS-08 ตรวจเทียบ text กับ decks_v0_7.source.json ซึ่งไฟล์เทสต์เดิมอยู่นอกสิทธิ์แก้ของขั้นนี้ จึงขอเสนอให้ผู้ตัดสินอัปเดต CARDS-08 หรือ source.json เช่นเดียวกับกรณี AQ-13/DINO-12 ในขั้น 4E-2B)*
- **สถานะการ์ดทั้ง 48 ใบ (ดูรายละเอียดใน STATUS_STEP4.md):**
  - ครบ: 30 ใบ (ไดโน 16 + อาควิลา 14)
  - ไม่มีเอฟเฟกต์: 2 ใบ (`aq_eques`, `aq_dictator`)
  - รอขั้น 5: 12 ใบ (สเปลสวนกลับ/หมอบรอ, Chain, negate, trigger จังหวะพิเศษ)
  - รอขั้น 6: 4 ใบ (`dino_fusion`, `dino_mega_tyrant`, `aq_spear`, `aq_hastatus`)

### 2. ข้อเสนอแก้ CONTRACT สำหรับส่วนที่ขาดของการ์ดที่ยังไม่แปลง
1. `dino_trex` (ไทแรนโนซอรัสเร็กซ์): ต้องการ op/ตัวคำนวณที่ดึงค่า ATK ของมอนสเตอร์ที่ถูกทำลายมาคิดครึ่งหนึ่ง และ op ระงับการโจมตีของตัวเองในเทิร์นนั้น (`freezeAttack` / `cannotAttack`)
2. `dino_nest` & `dino_fast_hatch`: ต้องการกลไกปรับเปลี่ยน trigger ของการ์ดใบอื่น หรือสั่งรัน trigger ของการ์ดใบอื่นทันที
3. `dino_spino` (พระราชอำนาจ): ต้องการ continuous effect ห้ามศัตรูโจมตีโดยมีเงื่อนไขเทียบค่ามานาของผู้คุม (> 5) และค่า ATK ของศัตรูกับสไปโน
4. `dino_brachio` (กินยอดไม้สูง): ต้องการให้ `E.destroyMonster` จากการต่อสู้เคารพ `preventDestruction` ขณะอยู่ในท่าป้องกัน (DEF) เช่นเดียวกับฮาสตาตัส เพื่อให้ระบบกันตายจากการต่อสู้ทำงานได้สมบูรณ์ในขั้น 6

## 4E-4 (เพิ่มชิ้นส่วนใหม่ 3 อย่าง + เงื่อนไขมานา และแปลง 5 ใบสุดท้ายของเด็คไดโนเสาร์)

### 1. ชิ้นส่วนใหม่ (ข้อ 10)
| op / ฟีเจอร์ | รูปแบบ | พฤติกรรม |
|---|---|---|
| `cannotAttack` | `{ op: 'cannotAttack', target, duration?: 'endTurn'\|'permanent'\|'whileSource' }` หรือ continuous effect | มอนสเตอร์เป้าหมายไม่สามารถประกาศโจมตีได้ (รวมถึงการโจมตีตรง) `validateAttack` ปฏิเสธด้วยรหัส `CANNOT_ATTACK` และ `getLegalActions` ไม่เสนอ action การโจมตีนั้น หากเป็น `duration: "endTurn"` มีผลจนจบเทิร์นนั้น, `duration: "permanent"` มีผลถาวร, `duration: "whileSource"` มีผลตราบใดที่ต้นทางยังหงายอยู่บนสนาม |
| ผลลัพธ์ของ op ก่อนหน้า | `spec.fromResult: "atk"` หรือ `spec.fromPrevious: "atk"`, `multiplier?: number` พร้อม `requireSuccess: true` หรือ `ifSuccess: true` | op ถัดไปสามารถอ้างอิงค่าจากผลลัพธ์ของ op ก่อนหน้าในเอฟเฟกต์เดียวกันได้ (เช่น ATK ของมอนสเตอร์ที่เพิ่งถูกทำลายสำเร็จ คูณ multiplier ปัดเศษลง `Math.floor`) และหากมี `requireSuccess: true` ถ้า op ก่อนหน้าไม่สำเร็จหรือถูกกัน (`ok === false`) op ถัดไปจะไม่ทำงาน |
| `fireEffect` | `{ op: 'fireEffect', target, effectId: string }` | สั่งรันเอฟเฟกต์ของการ์ดเป้าหมายตาม `effectId` ทันที โดยข้ามเงื่อนไขจังหวะ trigger (เช่น ไม่ต้องรอ Standby Phase) แต่ยังคงจ่าย cost มานาของเอฟเฟกต์นั้นและเคารพ limit ต่อเทิร์น/เกม |
| `mana` condition | `{ op: 'mana', greaterThan?: number, lessThan?: number, min?: number, max?: number, equals?: number, side?: 'self'\|'opp' }` | ตรวจสอบค่ามานาปัจจุบันของผู้คุม (หรือฝ่ายตรงข้ามหากระบุ `side: 'opp'`) ตามเงื่อนไขเปรียบเทียบที่ระบุ |

### 2. การ์ด 5 ใบที่แปลงในเด็คไดโนเสาร์ (ครบถ้วนตาม text)
1. `dino_small_raptor` (แรปเตอร์เล็ก): เพิ่มเอฟเฟกต์ (0) ฝูง continuous aura `pack_boost` ตัวเอง +400 ATK ขณะคุมแรปเตอร์เล็กอีกตัว (`controls: min 2`) คงเอฟเฟกต์ (1) `pack_summon`
2. `dino_spino` (สไปโนซอรัส ราชาแห่งสายน้ำ): เพิ่มเอฟเฟกต์ (0) พระราชอำนาจ continuous `royal_authority` เมื่อมีมานา > 5 ศัตรูที่ ATK ต่ำกว่าสไปโนโจมตีไม่ได้ (`cannotAttack`) คงเอฟเฟกต์ (3) `summon_subjects`
3. `dino_trex` (ไทแรนโนซอรัสเร็กซ์ ราชาแห่งนักล่า): แปลงครบ 2 เอฟเฟกต์:
   - (3) ราชาแห่งการกิน `eat_king`: 1/turn ทำลายไดโนอื่นของเรา 1 ตัว ได้รับ ATK ถาวร +ครึ่งหนึ่งของ ATK ตัวนั้น และ +1 มานา (ใช้ `fromResult: "atk", multiplier: 0.5` และ `requireSuccess: true`)
   - (1) คำรามราชา `roar_king`: 1/turn ลด ATK ศัตรูทุกตัว 300 ถาวร และเร็กซ์ติด `cannotAttack` จนจบเทิร์น (`duration: "endTurn"`)
4. `dino_nest` (รังไดโน): แปลงเป็น field spell ที่มี watcher `onSummon` ตรวจการ์ดที่มีแท็ก `egg` ลงสนาม สั่ง `fireEffect` ให้ฟัก (`hatch`) ทันที
5. `dino_fast_hatch` (ฟักเร็ว): แปลงเป็น normal spell เลือกไข่ไดโนบนสนาม 1 ใบ สั่ง `fireEffect` ให้ฟัก (`hatch`) ทันที

### 3. สถานะเทสต์
- สร้าง `tests/primitives_final.test.js` (FIN-01 ถึง FIN-12) ผ่านครบทุกข้อ ทดสอบทั้งข้อบวกและข้อลบของทุกชิ้นส่วนใหม่และพฤติกรรมการ์ดทั้ง 5 ใบ
- อัปเดต `tests/dino_effects.test.js` ข้อ DINO-12 ให้รองรับการ์ดที่มีเอฟเฟกต์ 19 ใบ และการ์ดที่มี 2 เอฟเฟกต์ 4 ใบ (`dino_tyrano_raptor`, `dino_trex`, `dino_small_raptor`, `dino_spino`)

## 5A (ระบบ pending ให้ผู้เล่นตัดสินใจเลือกเป้า/ใบ/ข้อแทนการเลือกอัตโนมัติ)

### 1. การควบคุมและพฤติกรรมหลัก (ข้อ 10, ข้อ 7)
- **สวิตช์ `config.autoChoose`:**
  - `true` (ค่าเริ่มต้นของ engine): ทำงานเหมือนเดิมทุกประการ เลือกเป้า/ใบแรกอัตโนมัติ ไม่เปิด pending เพื่อคงความเข้ากันได้กับระบบเดิมและ UI ที่ยังไม่พร้อม
  - `false`: เมื่อเอฟเฟกต์มี `choose: "player"`
    - หากตัวเลือกที่ตรงเงื่อนไขมีจำนวน **พอดีหรือน้อยกว่า** จำนวนที่ต้องเลือก (`candidates.length <= wantCount`): ทำการเลือกครบทั้งหมดอัตโนมัติโดยไม่ถามและไม่เปิด pending
    - หากมีตัวเลือกมากกว่าจำนวนที่ต้องเลือก (`candidates.length > wantCount`): ตั้งค่า `state.pending` และหยุดการทำงานของเอฟเฟกต์ที่ขั้นนั้นทันที
- **ผู้ตัดสินใจ:** ผู้คุมเอฟเฟกต์ (`ctx.player` / controller) เป็นผู้ตอบเสมอ

### 2. โครงสร้างข้อมูล `state.pending`
```javascript
{
  kind: 'chooseTarget' | 'chooseCards' | 'chooseSlot' | 'yesNo' | 'chooseOption',
  player: number,         // index ของผู้เล่นที่ต้องตัดสินใจ (0 หรือ 1)
  prompt: string,         // เช่น 'CHOOSE_TARGET', 'CHOOSE_CARDS', 'CHOOSE_OPTION'
  options: Array<{        // รายการตัวเลือก
    uid?: number,
    zone?: string,
    side?: 'self' | 'opp',
    slot?: number,
    cardId?: string,
    index: number,
    name?: string,
    text?: string
  }>,
  min: number,            // จำนวนตัวเลือกขั้นต่ำที่ต้องเลือก
  max: number,            // จำนวนตัวเลือกสูงสุดที่ต้องเลือก
  resume: {               // ข้อมูล JSON ล้วน (ไม่มี function หรือ circular ref เพื่อให้ cloneState ทำงานได้)
    sourceUid: number | null,
    effectId: string,
    effect: object,
    stepIndex: number,
    ctx: {
      player: number,
      trigger: string,
      lastResult: object | null,
      watchedUid: number | null
    }
  }
}
```

### 3. Action `respond` และรหัสผลลัพธ์ (ข้อ 7)
- ส่ง action: `{ type: 'respond', player: number, choice: Array<number> }`
- `choice` เป็น array ของตัวเลขดัชนี (indices) อ้างอิงใน `pending.options`
- **การตรวจสอบและรหัสปฏิเสธใหม่:**
  - ส่งขณะไม่มี pending: `NO_PENDING`
  - ส่งจากผู้เล่นที่ไม่ใช่ `pending.player`: `NOT_YOUR_PENDING`
  - รูปแบบ `choice` ไม่ถูกต้อง (ไม่ใช่ array, จำนวน < min หรือ > max, มีดัชนีซ้ำ, หรือดัชนีนอกขอบเขต options): `INVALID_CHOICE`
  - ส่ง action ชนิดอื่น (เช่น `attack`, `endTurn`, `normalSummon`) ขณะที่ `state.pending` ยังค้างอยู่: `PENDING_OPEN` (ยกเว้น `DISCARD_EXCESS` และ `chainWindow` เดิมที่คงรหัส `PENDING_UNRESOLVED`)
- **Event ใหม่:**
  - `pendingOpen`: `{ type: 'pendingOpen', kind, player, prompt }`
  - `pendingResolved`: `{ type: 'pendingResolved', choice }`

### 4. การทำงานต่อเนื่อง (Resume)
- เมื่อตอบ `respond` ถูกต้อง:
  1. ล้าง `state.pending = null`
  2. เรียก `CG.effects.resumeEffect` รันเอฟเฟกต์ต่อจาก `stepIndex`
  3. ไม่ตรวจเงื่อนไข trigger/condition ซ้ำ, ไม่หัก limit ซ้ำ, และไม่หัก cost มานาซ้ำ
  4. ทำงานขั้นตอนนั้นด้วย choice ที่เลือก และรันขั้นตอนถัดไปใน `do[]` จนจบ (หากขั้นตอนถัดไปมี pending จะหยุดรอที่ขั้นถัดไปตามลำดับ)

### 5. `getLegalActions` ระหว่างมี pending
- หาก `state.pending` มี `resume`:
  - สำหรับผู้เล่นที่เป็น `pending.player`: เสนอ action `respond` ที่สร้างจากการจัดหมู่ (combinations) ของดัชนีตัวเลือกตามช่วง `min..max` (จำกัดไม่เกิน 50 รูปแบบเพื่อประสิทธิภาพ)
  - สำหรับผู้เล่นอีกฝ่าย: เสนอ `[]` (ไม่มีสิทธิ์ทำ action ใดๆ ระหว่างรออีกฝ่ายตอบ)

## 5B (ระบบ Chain และ negate)

### 1. สวิตช์และการควบคุม (ข้อ 10, ข้อ 7)
- **สวิตช์ `config.chainMode`:**
  - `false` (ค่าเริ่มต้นของ createGame): พฤติกรรมเดิมทั้งหมด เอฟเฟกต์ทำงานทันที ไม่เปิดลิงก์ใน Chain และไม่เปิดหน้าต่างเหตุการณ์ เพื่อความเข้ากันได้กับ UI และระบบเดิม
  - `true`: เปิดระบบ Chain เต็มรูปแบบ การประกาศเอฟเฟกต์ (ignition, quick, สเปลจากมือ) จะสร้างลิงก์ลง `state.chain` จ่ายต้นทุนและนับ limit ทันทีที่ประกาศ แล้วเปิดสิทธิ์ให้ฝ่ายตรงข้ามตอบโต้
- **การผ่านสิทธิ์อัตโนมัติ (Auto-pass):**
  - หากฝ่ายที่มีสิทธิ์ตอบโต้ไม่มีการ์ดหรือเอฟเฟกต์ที่สามารถตอบโต้ได้อย่างถูกต้องตามกฎ (เช่น ความเร็วไม่พอ, มานาไม่พอ, หรือไม่ตรงเงื่อนไขหน้าต่าง) engine จะข้ามให้อัตโนมัติและดำเนินการแก้ผลต่อทันทีโดยไม่ค้างหน้าต่าง

### 2. โครงสร้างข้อมูล `state.chain` และความบริสุทธิ์ของ State
- `state.chain` เป็น Array ของออบเจกต์ลิงก์ที่เป็น Plain JSON ล้วน (ไม่มีฟังก์ชันหรือ circular reference) ทำให้ `cloneState` และระบบ serialization ทำงานได้อย่างถูกต้องในทุกจังหวะ
- โครงสร้างของ Chain Link:
```javascript
{
  linkId: number,           // ลำดับลิงก์ เช่น 1, 2, 3
  uid: number,              // uid ของต้นทาง
  sourceUid: number,
  cardId: string,           // รหัสการ์ด
  effectId: string,         // รหัสเอฟเฟกต์
  speed: number,            // ความเร็วของเอฟเฟกต์ (1 = ปกติ/ignition, 2 = quick, 3 = counter)
  controller: number,       // ผู้ประกาศลิงก์
  trigger: string,          // เช่น 'ignition', 'quick', 'onSummon'
  effect: object,           // สำเนาเอฟเฟกต์
  slot: number,             // ตำแหน่งบนสนาม (ถ้ามี)
  handIdx: number,          // ตำแหน่งในมือ (ถ้ามี)
  targetSlot: number,       // ช่องเป้าหมาย (ถ้ามี)
  targetUid: number,        // uid เป้าหมาย (ถ้ามี)
  isSpell: boolean,         // เป็นการ์ดสเปลหรือไม่
  spellCard: object | null, // ออบเจกต์การ์ดสเปลที่ถูกดึงออกจากมือมาชั่วคราวรอส่งสุสานเมื่อแก้ผล
  negated: boolean          // ติดสถานะถูกลบล้างหรือไม่ (default false)
}
```

### 3. Action ใหม่และรหัสผิดพลาด (ข้อ 7)
- **`activateSpell`:** `{ type: 'activateSpell', player, handIdx, targetSlot? }` ใช้ประกาศเปิดสเปลจากมือเมื่อ `chainMode === true` ใน Main Phase
- **`activateResponse`:** `{ type: 'activateResponse', player, slot?, handIdx?, effectId?, targetSlot? }` ใช้ตอบโต้ในหน้าต่าง Chain หรือ Event Window
- **`passPriority`:** `{ type: 'passPriority', player }` ส่งเพื่อสละสิทธิ์การตอบโต้ ทำให้ Chain ปิดและเริ่มกระบวนการแก้ผล หรือจบหน้าต่างเหตุการณ์
- **รหัสผิดพลาดใหม่:**
  - `SPEED_TOO_LOW`: พยายามตอบโต้ด้วยเอฟเฟกต์ที่มีความเร็วน้อยกว่าลิงก์บนสุดของ Chain หรือใช้ความเร็ว 1 ตอบโต้
  - `NO_PRIORITY`: ผู้เล่นที่ส่งคำสั่งตอบโต้ไม่ใช่ผู้ถือครองสิทธิ์ (Priority) ในขณะนั้น

### 4. กฎความเร็วและการทำงานแบบ LIFO (ข้อ 10)
- **ลำดับความเร็ว (Spell Speed):**
  - ความเร็ว 1: สเปลปกติ, ignition effect — ประกาศเป็นลิงก์ที่ 1 ได้เท่านั้น ไม่สามารถใช้ตอบโต้ลิงก์อื่นได้
  - ความเร็ว 2: quick effect, quick spell — ตอบโต้ความเร็ว 1 หรือ 2 ได้
  - ความเร็ว 3: counter spell / negate — ตอบโต้ความเร็ว 1, 2 หรือ 3 ได้ (มีเพียงความเร็ว 3 เท่านั้นที่ตอบโต้ความเร็ว 3 ได้)
- **การแก้ผลแบบ LIFO (Last-In, First-Out):**
  - ลิงก์ที่ประกาศหลังสุดจะได้รับการแก้ผลก่อนตามลำดับย้อนกลับ
  - เมื่อลิงก์ถูก `negate`: จะยิง event `chainLinkNegated` ข้ามขั้นตอนการทำงานของเอฟเฟกต์นั้น และส่งการ์ดสเปลลงสุสานตามปกติ
  - เมื่อเป้าหมายหายไป (Fizzle): จะยิง event `chainLinkFizzled` ทำงานเฉพาะขั้นตอนที่ไม่ขึ้นกับเป้าหมายที่หายไป และไม่คืนต้นทุนมานา/โควตา limit
  - เมื่อลิงก์แก้ผลสำเร็จ: จะยิง event `chainLinkResolved` และส่งการ์ดสเปลลงสุสาน
  - เมื่อแก้ผลทุกลิงก์ครบ: Chain ปิดตัวลงและยิง event `chainClosed`

### 5. ชิ้นส่วนเอฟเฟกต์ใหม่ (ข้อ 10)
- **op `negate`:** `{ op: 'negate', target?: 'chainLink' | selector }` ลบล้างลิงก์เป้าหมายใน Chain (`link.negated = true`) ส่งผลให้เอฟเฟกต์ของลิงก์นั้นไม่ทำงานเมื่อถึงคิวแก้ผล
- **op `negateAttack`:** `{ op: 'negateAttack' }` สั่งลบล้างการโจมตีปัจจุบัน (`state.attack.negated = true` และยิง event `attackNegated`) การต่อสู้สิ้นสุดลงทันทีโดยไม่มีการคำนวณความเสียหาย และมอนสเตอร์ฝ่ายโจมตียังคงนับว่าได้ประกาศโจมตีไปแล้ว

### 6. หน้าต่างเหตุการณ์ (Event Windows)
- เปิดหน้าต่างตอบโต้สำหรับเหตุการณ์สำคัญ: `attackDeclared`, `summon`, `flip`, `anyActivation`
- หน้าต่างจะเปิดเฉพาะเมื่อฝ่ายตรงข้ามมีตัวเลือกที่ตอบโต้ได้จริงตามเงื่อนไขของหน้าต่าง (เช่น เอฟเฟกต์ที่ระบุ `window: 'attackDeclared'`) หากไม่มีตัวตอบโต้ engine จะข้ามหน้าต่างและดำเนินการขั้นตอนการเล่นต่อไปทันที

### 7. การทำงานร่วมกันระหว่าง 5A (Pending) และ 5B (Chain)
- หากขั้นตอนของเอฟเฟกต์ในลิงก์ที่กำลังแก้ผลต้องการให้ผู้เล่นเลือกเป้า (`choose: "player"`) ระบบจะเปิด `state.pending` ตามแบบแผนของขั้น 5A และหยุดการแก้ผล Chain ชั่วคราว (`state.chainResolving = true`)
- เมื่อผู้เล่นส่งคำสั่ง `respond` ถูกต้อง เอฟเฟกต์จะรันต่อจนจบลิงก์นั้น นำลิงก์ออกจาก Chain และดำเนินการแก้ผลลิงก์ถัดไปใน Chain ต่อเนื่องจนเสร็จสมบูรณ์

## 5C (กลไกสเปลหมอบรอความเร็ว 2, สเปลสวนกลับความเร็ว 3 และการแปลงการ์ดที่รอขั้น 5 ทั้ง 9 ใบ)

### 1. คำสั่งการหมอบสเปล (`setSpell`)
- **รูปแบบ Action:** `{ type: 'setSpell', player, handIdx, slot }`
- **เงื่อนไข:** ผู้เล่นเจ้าของเทิร์นใน Main Phase 1 หรือ Main Phase 2, การ์ดในมือต้องเป็นสเปล (`type === 'spell'`), ช่องสเปลต้องว่าง (`p.spells[slot] === null`) และเปิดใช้เฉพาะเมื่อ `state.config.chainMode === true` (หากปิดจะคืน `NOT_IMPLEMENTED`)
- **ผลลัพธ์:** การ์ดย้ายจากมือลงช่อง `p.spells[slot]`, ตั้งสถานะ `faceDown: true`, และบันทึก `flags.setTurn = state.turn` เพื่อคุมกฎห้ามเปิดใช้ในเทิร์นที่หมอบ

### 2. กฎการเปิดใช้สเปลหมอบรอ (ความเร็ว 2)
- **เงื่อนไขเทิร์น:** ใช้ได้ตั้งแต่เทิร์นถัดไป (`flags.setTurn < state.turn`)
- **จังหวะที่ใช้ได้:** เปิดใช้ได้ทั้งในเทิร์นตนเอง (ใน Main Phase ผ่าน `activateSpell` หรือในหน้าต่างตอบโต้) และเทิร์นคู่ต่อสู้ในหน้าต่างเหตุการณ์ที่ตรงกับ `timingWindow`
- **วงจรชีวิตของการ์ด (Life Cycle):**
  - พลิกหงายทันทีตอนประกาศใช้งาน (`faceDown = false`)
  - จ่ายต้นทุนมานาตอนประกาศและนำเข้าเป็นลิงก์ใน Chain (`fromZone: 'spells'`)
  - หลังแก้ผลเสร็จสิ้น (หรือหากถูก `negate` / `fizzle`): เคลียร์ช่องสเปลเป็น `null` และส่งการ์ดลงสุสานเจ้าของ (ยกเว้นสเปลต่อเนื่อง/สนามที่จะค้างอยู่บนสนามตามประเภท)

### 3. สเปลสวนกลับ (ความเร็ว 3) ใช้จากมือ
- **เงื่อนไข:** การ์ดกลุ่ม `counter` ความเร็ว 3 สามารถเปิดใช้งานได้โดยตรงจากมือในหน้าต่างเหตุการณ์ที่ระบุใน `timingWindow` หรือ `anyActivation`
- **ความเร็ว:** มีเพียงเอฟเฟกต์ความเร็ว 3 เท่านั้นที่สามารถต่อโซ่ตอบโต้เอฟเฟกต์ความเร็ว 3 ได้
- **วงจรชีวิต:** ย้ายการ์ดจากมือเข้า Chain ตอนประกาศ และส่งลงสุสานหลังแก้ผล (หรือถูก negate)

### 4. ชิ้นส่วนระบบและเงื่อนไขใหม่ใน 5C
- **หน้าต่างเหตุการณ์ใหม่:**
  - `monsterDestroyed`: เปิดเมื่อมอนสเตอร์ถูกทำลาย (ยิงจาก `core.js` ตอน `destroyMonster` ขณะ `chainMode === true`)
  - `battleWon`: เปิดเมื่อมอนสเตอร์ชนะการต่อสู้และทำลายศัตรูได้ (ยิงจาก `battle.js` ในขั้น `afterDamage` ขณะ `chainMode === true`)
- **Condition ใหม่:**
  - `attackDeclaredByOpp`: ตรวจว่าการโจมตีปัจจุบันถูกประกาศโดยฝ่ายตรงข้าม
  - `attackTarget`: ตรวจเป้าหมายที่ถูกโจมตี (รองรับ `side: 'self'|'opp'` และ `filter`)
  - `destroyedMonster`: ตรวจมอนสเตอร์ที่เพิ่งถูกทำลาย (รองรับ `side: 'self'|'opp'` และ `filter`)
  - `targetLink`: ตรวจลิงก์ใน Chain ที่กำลังตอบโต้ (รองรับ `side: 'self'|'opp'`)
- **Special Target Selector:**
  - `attacker`: ผู้ประกาศโจมตีในการต่อสู้ปัจจุบัน
  - `attacked`: เป้าหมายที่ถูกโจมตีในการต่อสู้ปัจจุบัน

### 5. การแปลงการ์ดทั้ง 9 ใบที่รอขั้น 5
- **เด็คไดโนเสาร์ (5 ใบ):**
  - `dino_roar` (counter, speed 3, จากมือ): จ่าย 2 มานา ส่งไดโน 1 ตัวบนสนามไปสุสาน ยกเลิกการเปิดเอฟเฟกต์มอนสเตอร์ศัตรู (`negate`)
  - `dino_escape` (counter, speed 3, จากมือ): เมื่อไดโนเราถูกโจมตี เปลี่ยนเป็นท่าป้องกันและ DEF +800 จนจบเทิร์น
  - `dino_mud` (set, speed 2, หมอบบนสนาม): เมื่อศัตรูประกาศโจมตี บังคับผู้โจมตีเป็นท่าป้องกันและติด `cannotAttack` จนจบเทิร์น
  - `dino_hidden_egg` (set, speed 2, หมอบบนสนาม): เมื่อไดโนเราถูกทำลาย เรียก `dino_egg` จากเด็ค 1 ใบ
  - `dino_pack_hunt` (set, speed 2, หมอบบนสนาม): เมื่อศัตรูประกาศโจมตี เรียก `dino_small_raptor` 2 ตัวจากเด็ค/สุสาน
- **เด็คอาควิลา (4 ใบ):**
  - `aq_shield_wall` (counter, speed 3, จากมือ): เมื่อศัตรูประกาศโจมตี ยกเลิกการโจมตีทันที (`negateAttack`)
  - `aq_retreat` (counter, speed 3, จากมือ): ดึงมอนสเตอร์ของเรา 1 ตัวบนสนามกลับขึ้นมือ
  - `aq_pit` (set, speed 2, หมอบบนสนาม): เมื่อศัตรูประกาศโจมตี ทำลายมอนสเตอร์ที่โจมตี (`destroy: attacker`)
  - `aq_triumph` (set, speed 2, หมอบบนสนาม): เมื่อชนะการต่อสู้ เรียกมอนสเตอร์อาควิลา 1 ตัวจากสุสาน

## 5D (UI และบอทรองรับ Pending และ Chain พร้อมเปิดโหมดใหม่เป็นค่าเริ่มต้น)

### 1. การแสดงผล UI สำหรับ Pending (Overlay)
- รองรับทุก kind ของ `state.pending` อย่างสมบูรณ์ผ่าน Overlay กลางจอ:
  - `chooseTarget` / `chooseCards`: แสดงการ์ดตัวเลือกในรูปแบบ Grid Picker พร้อมชื่อการ์ด, ระดับ (Level), ATK/DEF, โซน และฝ่าย (ฝ่ายเรา/ฝ่ายตรงข้าม) ผู้เล่นสามารถคลิกเลือก/ยกเลิกตัวเลือก และปุ่ม "ยืนยัน" จะเปิดใช้งานเมื่อเลือกครบตามช่วง `min..max`
  - `chooseOption`: แสดงปุ่มข้อความตัวเลือกตามชื่อหรือข้อความของแต่ละตัวเลือก
  - `yesNo`: แสดงปุ่ม "ใช่" / "ไม่ใช่"
  - `chooseSlot`: แสดงปุ่มเลือกช่องเป้าหมาย
- ข้อความ Prompt, หัวเรื่อง, และปุ่มคำสั่งทั้งหมดรวมศูนย์อยู่ที่ `ui/strings_th.js` เป็นภาษาไทยทั้งหมด

### 2. การแสดงผล UI สำหรับ Chain และหน้าต่างตอบโต้
- **กอง Chain Stack:** แสดงกล่องสถานะ Chain ด้านข้างบอร์ดเมื่อมีลิงก์ใน Chain แสดงลำดับลิงก์ (Link 1, Link 2...), ชื่อการ์ด/เอฟเฟกต์ และขีดฆ่ากรณีถูก negate
- **หน้าต่างตอบโต้ (Chain Window):** เมื่อเปิดหน้าต่างเหตุการณ์หรือหน้าต่างตอบโต้ จะแสดงสิทธิ์ของผู้เล่นที่ต้องตัดสินใจอย่างชัดเจน พร้อมปุ่มการตอบโต้ที่ใช้ได้ ("ใช้ <ชื่อการ์ด>") และปุ่ม "ผ่าน (ไม่ตอบโต้)"
- **ความลับของมือในโหมด 2 ผู้เล่น (PvP บนเครื่องเดียว):** อาศัยกลไก Handoff เดิมของระบบ เมื่อสิทธิ์การตัดสินใจสลับไปยังผู้เล่นอีกฝ่าย หน้าจอจะปิดบังการ์ดในมือและแสดงหน้าต่าง "ส่งเครื่องให้ [ผู้เล่น] พร้อมแล้ว แสดงมือ" ก่อนเสมอ ป้องกันการเห็นการ์ดในมือของคู่แข่ง

### 3. ตรรกะบอท (Deterministic Bot)
- ตัดสินใจได้แน่นอน ไม่สุ่ม และไม่มีทางค้างในทุกสถานการณ์:
  - ในหน้าต่าง Chain: ใช้การตอบโต้แรกที่เข้าเกณฑ์ หากไม่มีหรือประเมินแล้วไม่จำเป็น จะกดผ่านสิทธิ์ทันที
  - ใน Pending เลือกเป้าหมาย:
    - กรณีทำลาย/ส่งสุสานศัตรู: เล็งเป้าตัวที่มี ATK สูงสุดของอีกฝ่าย
    - กรณีจ่ายต้นทุน/สังเวยฝ่ายเรา: เลือกตัวที่มี ATK ต่ำสุดของฝ่ายเรา
    - กรณีค้นหา/อัญเชิญพิเศษ: เลือกการ์ดที่มี ATK สูงสุด
    - กรณีตัวเลือกทั่วไป: เลือกตามลำดับแรก
  - ใน Main Phase: หมอบสเปล (Set Spell) และเปิดใช้ Normal Spell ตามเงื่อนไขและเมื่อการ์ดมีเอฟเฟกต์จริง

### 4. ค่าเริ่มต้นของเกมจริงและการคงความเข้ากันได้
- `E.createGame`: สำหรับเกมจริง (ส่ง `opts.mode` มาจาก UI หรือกำหนดเป็นเกมเล่นจริง) จะใช้ค่าเริ่มต้น `autoChoose: false` และ `chainMode: true`
- การทดสอบเดิมที่เรียก `createGame` โดยไม่ระบุ `mode` จะยังคงได้รับค่าคอนฟิกเดิมตาม Step 2 เพื่อความเข้ากันได้ 100%

### 5. การทดสอบ Bot vs Bot (200 แมตช์)
- สร้างชุดทดสอบ `tests/bot_vs_bot.test.js` จำลองการแข่งขันระหว่างบอท 200 เกม (ไดโนเสาร์ vs อาควิลา สลับฝั่งคนละ 100 เกม ด้วย `seed` 1 ถึง 200 ในโหมด `autoChoose: false, chainMode: true`)
- ผลการทดสอบ: ผ่าน 200 เกมครบถ้วน, เกิดข้อยกเว้น (Exception) = 0, เกิดอาการค้าง (Hang/Deadlock) = 0, ทุกเกมจบลงภายใน 100 เทิร์น (เฉลี่ยประมาณ 13 เทิร์น)

## 5E (ย้ายตรรกะ "เดินต่อหลัง Chain ปิด" เข้าสู่ Engine และลบ Wrapper)

### 1. การเดินต่อของ Battle และ Turn Start ภายใน Engine (`engine/effectBridge.js`)
- **การผ่านสิทธิ์ในหน้าต่างเหตุการณ์ (`E.passPriority`):**
  - เมื่อผู้เล่นผ่านสิทธิ์โดยไม่มีการต่อโซ่ (`state.chain.length === 0`):
    - หากอยู่ระหว่างการต่อสู้ (`state.attack && state.battleStep !== null`): เรียก `E.battleResume(state, events)` ดำเนินขั้นตอนการต่อสู้ต่อหรือจบการโจมตี
    - หากอยู่ระหว่างการเริ่มเทิร์น (`state.phase === 'draw' || state.phase === 'standby'`): เรียก `E.resumeTurnStart(state, events)` เดินหน้าเฟสต่อจนถึง `main1`
- **การแก้ผล Chain เสร็จสมบูรณ์ (`E.resolveChain`):**
  - เมื่อทุกลิงก์ใน Chain แก้ผลครบถ้วน (`state.chain.length === 0`):
    - ปิด Chain (`state.chainResolving = false`), ยิง event `chainClosed`
    - หากอยู่ระหว่างการต่อสู้: เรียก `E.battleResume(state, events)`
    - หากอยู่ระหว่างเฟส draw หรือ standby: เรียก `E.resumeTurnStart(state, events)`
- **หน้าต่างเหตุการณ์การเปลี่ยนเฟส (`E.chainPriorityWindow`):**
  - กรองเหตุการณ์ `ctx.kind === 'phase'` ออก ไม่เปิดหน้าต่างตอบโต้ เนื่องจากไม่ใช่การประกาศใช้การ์ด/เอฟเฟกต์ (คงความสอดคล้องกับ CONTRACT ข้อ 8 และ 10-ข)
- **การทิ้งการ์ดสเปล (`E.disposeSpell`):**
  - เผยแพร่ฟังก์ชัน `E.disposeSpell` ใน `engine/effectBridge.js` ให้ `engine/actions.js` เรียกใช้ร่วมกันได้โดยตรง ลดการเขียนโค้ดซ้ำ

### 2. การลบ Wrapper และแยก Pure Bot Function (`ui/app.js`, `tests/bot_vs_bot.test.js`)
- ลบการเขียนทับ `E.hooks.priorityWindow`, `E.passPriority`, และ `E.applyAction` ออกจาก `ui/app.js` และ `tests/bot_vs_bot.test.js` ทั้งหมด ทำให้ Engine ทำงานได้เองโดยสมบูรณ์
- แยกฟังก์ชันการตัดสินใจของบอท (`fallbackBot`) ใน `ui/app.js` เป็น Pure Function ปราศจากการผูกมัดกับ DOM และส่งออกผ่าน `CG.bot.chooseAction`, `CG.ui.botChoose` และ `module.exports` เพื่อให้ทั้ง UI และชุดทดสอบเรียกใช้ตรรกะเดียวกัน 100%

### 3. ผลการทดสอบ
- `tests/chain_resume.test.js`: เล่นเกมด้วยบอท 50 เกมบน Engine เปล่า (ไม่มี wrapper ใด ๆ) ผลการทดสอบผ่านครบ 50/50 เกม ไม่มีการค้าง (Hang = 0) และไม่มีข้อยกเว้น (Exception = 0) ทุกเกมจบลงภายใน 100 เทิร์น
- `tests/bot_vs_bot.test.js`: รัน 200 เกมบน Engine เปล่า ผ่านครบ 200/200 เกม

## 6A (ระบบวางทับ Overlay และแปลงนักรบหอก aq_spear)

### 1. คำสั่ง Action `overlay` และการตรวจสอบ (`engine/actions.js`, `engine/overlay.js`)
- **รูปแบบ Action:** `{ type: 'overlay', player: number, handIdx: number, targetSlot: number }`
- **เงื่อนไขการใช้งาน (`E.validateOverlay`):**
  - ใช้ได้เฉพาะใน Main Phase (`main1`, `main2`) และไม่อยู่ในระหว่างขั้นตอน Battle (`battleStep === null`)
  - ผู้เล่นต้องเป็นเจ้าของเทิร์น (`a.player === state.activeIdx`)
  - การ์ดในมือต้องเป็นมอนสเตอร์ที่มีเอฟเฟกต์ `trigger: 'overlay'` (ระบุ `onto: <filter>` และ `result: { level, atk, def }`)
  - ช่องเป้าหมาย (`targetSlot`) ต้องมีมอนสเตอร์ของฝ่ายเราที่ตรงกับเงื่อนไข `onto` (เช่น `cardId`, `level`, `tag`)
  - ต้องมีมานาเพียงพอตาม `cost.mana` และยังไม่ครบโควตา `limit` (นับ 1 ครั้งต่อเทิร์นต่อ id การ์ด)
  - ไม่จำกัดว่าสนามเต็มหรือไม่ (เพราะวางทับในช่องเดิม)
  - รหัสข้อผิดพลาดที่ส่งคืน: `WRONG_PHASE`, `NOT_YOUR_TURN`, `INVALID_HAND_INDEX`, `NOT_A_MONSTER`, `CANNOT_OVERLAY`, `INVALID_SLOT`, `NO_MONSTER`, `INVALID_TARGET`, `NOT_ENOUGH_MANA`, `LIMIT_REACHED`

### 2. ผลลัพธ์และการสืบทอดสถานะ (`E.performOverlay`)
- **การจัดเรียง Under:** การ์ดเป้าหมายเดิมและ under เดิมของมันทั้งหมดจะเข้าไปอยู่ใน `under` ของตัวบน โดยตัวล่างสุดอยู่หน้า array (`[...target.under, target]`)
- **ค่าสเตตัส (Stats):** ตัวบนได้รับค่า `level`, `baseAtk`, `baseDef` ใหม่ตาม `result` ที่ระบุในเอฟเฟกต์ โดยล้างโมดิฟายเออร์เดิมทั้งหมด (`atkMod = 0`, `defMod = 0`, `tempAtkMod = 0`, `tempDefMod = 0`) ไม่สืบทอดบัฟจากเป้าเดิม
- **ท่า (Position) และการหงายคว่ำ:** สืบทอด `position` (`atk` หรือ `def`) จากเป้าเดิม หากเป้าเดิมคว่ำอยู่ (`faceDown: true`) จะถูกพลิกหงายอัตโนมัติ (`faceDown: false`)
- **การสืบทอด Flags:** สืบทอด `flags.attackedThisTurn`, `flags.positionChangedThisTurn` และ `flags.canAttack` จากเป้าเดิม ส่วน `flags.summonedTurn` ถูกตั้งเป็นเทิร์นปัจจุบัน
- **การนับเป็นการอัญเชิญ (Special Summon):**
  - บันทึก event `moveCard` (จาก hand ไปยัง monster ช่องเดิม)
  - บันทึก event `summon` ด้วย `how: 'overlay'`
  - ยิงทริกเกอร์ `onSummon` (พร้อม `how: 'overlay'`) และ `onOverlay`
  - หากเปิด `chainMode: true` จะเปิด priority window สำหรับเหตุการณ์อัญเชิญ

### 3. การทำงานร่วมกับ Chain และต้นทุน
- จ่ายมานาและนับ limit ของเอฟเฟกต์ overlay ตั้งแต่ตอนประกาศ action
- ในโหมด `chainMode: true`:
  - สร้างลิงก์ใน Chain ความเร็ว Speed 1 (`trigger: 'overlay'`, `isOverlay: true`, `targetUid: target.uid`, `targetSlot: a.targetSlot`)
  - เปิดหน้าต่างตอบโต้ให้ฝ่ายตรงข้ามก่อน
  - เมื่อ Chain แก้ผลมาถึงลิงก์นี้: หากเป้าหมายไม่อยู่บนสนามในช่องเดิมแล้ว ลิงก์จะ fizzle (`chainLinkFizzled`) โดยการ์ดยังคงค้างอยู่ในมือ (ไม่ลงสนาม ไม่ลงสุสาน) และไม่คืนค่าต้นทุนมานา/โควตา
  - หากเป้าหมายยังอยู่สมบูรณ์ จะดึงการ์ดออกจากมือแล้วเรียก `E.performOverlay`

### 4. การแปลงข้อมูลการ์ด `aq_spear` (`cards/aquila.js`)
- เพิ่มเอฟเฟกต์ overlay ให้ `aq_spear`:
  - `trigger: 'overlay'`, `from: 'hand'`, `speed: 1`, `cost: { mana: 0 }`, `limit: { per: 'turn', count: 1 }`
  - `onto: { cardId: 'aq_spear', level: 1 }`
  - `result: { level: 2, atk: 1600, def: 1000 }`
- เพิ่ม `'overlay'` ใน `TRIGGERS` และเพิ่ม `'aq_spear'` ใน `WITH_EFFECTS` ของ `tests/aquila_effects.test.js`

### 5. การทดสอบ (`tests/overlay.test.js`)
- ครอบคลุมทั้งกรณีข้อบวก (วางทับสำเร็จ, ได้ Lv2 1600/1000, under ถูกต้อง), ข้อลบ (เป้าผิด, ไม่ใช่การ์ด overlay, limit ครบ, level ไม่ตรง), การสืบทอดท่า/flag โจมตี/พลิกหงาย, การส่ง under ลงสุสานพร้อมตัวบนเมื่อถูกทำลาย, การยิง trigger onSummon/onOverlay, และการ fizzle ใน Chain เมื่อเป้าหายไปกลางคัน

## 6B (Fusion Summon และแปลงการ์ด Fusion ของเด็คไดโนเสาร์)

### 1. Op `fusionSummon` และ Condition `canFusionSummon` (`effects/primitives_move.js`, `effects/runner.js`)
- **Condition `canFusionSummon`:**
  - ตรวจสอบว่าใน Extra Deck ของผู้เล่นมีมอนสเตอร์ประเภท Fusion ที่ตรงตาม `filter` และมีวัสดุในโซน `materialsFrom` (ค่าเริ่มต้น `['hand', 'monster']`) ครบตามเงื่อนไข `materialSlots` หรือไม่
  - ตรวจสอบช่องว่างบนสนาม: จำนวนช่องว่างหลังหักลบวัสดุที่ต้องดึงออกจากสนามต้อง $\ge 1$ (`freeSlots + fieldMaterialsUsed >= 1`) หากไม่มีช่องว่างเลย Condition จะเป็นเท็จ ไม่เริ่มรันเอฟเฟกต์และไม่จ่ายต้นทุน
- **Op `fusionSummon`:**
  - รองรับพารามิเตอร์ `filter` (เช่น `{ tag: 'dino' }`) และ `materialsFrom` (เช่น `['hand', 'monster']`)
  - **การเลือกการ์ด Fusion:** หากมีตัวเลือกหลายใบ จะเปิด Pending `chooseCards` (`min: 1, max: 1`) ให้เลือก หรือเลือกอัตโนมัติหากมีเพียง 1 ตัวเลือก
  - **การเลือกวัสดุ:** ตรวจสอบคอมโบวัสดุที่เข้าเงื่อนไข หากมีหลายชุดวัสดุ จะเปิด Pending `chooseCards` ให้เลือก หรือเลือกอัตโนมัติหากมีชุดเดียว
  - **การเลือกช่องสนาม:** หากมีช่องว่างหลังนำวัสดุออกมากกว่า 1 ช่อง จะเปิด Pending `chooseSlot` ให้เลือก หรือลงช่องแรกอัตโนมัติ
  - **การส่งวัสดุลงสุสาน:** วัสดุทั้งหมดถูกส่งไปยัง `grave` ของเจ้าของ หากวัสดุมี `under` จะถูกส่งลงสุสานพร้อมกัน ไม่นับเป็นการทำลาย แต่ยิงทริกเกอร์ `onSentToGrave` ตามปกติ
  - **การอัญเชิญ Special Summon:** นำการ์ด Fusion ลงสนามในช่องที่เลือก ในท่าโจมตีหงาย (`position: 'atk'`, `faceDown: false`) ค่าสเตตัส ATK/DEF/Level ตามหน้าการ์ด บันทึก event `summon` ด้วย `how: 'fusion'` และยิงทริกเกอร์ `onSummon` (พร้อมเปิด priority window ใน chainMode)

### 2. ข้อมูลวัสดุ Fusion แบบอ่านด้วยเครื่องได้ (`materialSlots`)
- เพิ่มฟิลด์ `materialSlots` ในการ์ด Fusion ของเด็คไดโนเสาร์:
  - `dino_tyrano_raptor`: วัสดุ 2 ช่อง: `[{ cardId: 'dino_trex' }, { cardId: 'dino_hunter_raptor' }]`
  - `dino_raptor_swarm`: วัสดุ 2 ช่อง: `[{ tag: 'raptor' }, { level: 1 }]` (รองรับการจับคู่วัสดุคนละใบแบบ Permutation)
  - `dino_brachio`: วัสดุ 2 ช่อง: `[{ tag: 'dino', level: 2 }, { tag: 'dino', level: 2 }]` พร้อมเงื่อนไข `distinctNames: true` (หรือ `materialConstraint: { distinctNames: true }`) ต้องเป็นคนละชื่อกัน
- คงฟิลด์ข้อความ `materials` เดิมไว้สำหรับแสดงผล UI

### 3. กฎการออกจากสนามของมอนสเตอร์ Fusion และ Extra Deck (`engine/core.js`, `effects/primitives_move.js`)
- หากมอนสเตอร์ประเภท `fusion` (หรือ `grade4`) ถูกส่งออกจากสนามกลับไปยัง `hand` หรือ `deck` ตัวเอนจินและคำสั่งย้ายการ์ด `moveTo` จะเบี่ยงปลายทางกลับไปยัง `extra` (Extra Deck) เสมอ
- หากถูกส่งไปยังสุสาน (`grave`) หรือนอกเกม (`removed`) ให้ไปตามปกติ

### 4. การแปลงสเปล `dino_fusion` (`cards/dinosaur.js`)
- สเปลปกติความเร็ว Speed 1:
  - `trigger: 'ignition'`, `speed: 1`, `cost: { mana: 2 }`
  - `condition: [{ op: 'canFusionSummon', filter: { tag: 'dino' }, materialsFrom: ['hand', 'monster'] }]`
  - `do: [{ op: 'fusionSummon', filter: { tag: 'dino' }, materialsFrom: ['hand', 'monster'] }]`
- เพิ่ม `'dino_fusion'` ใน `WITH_EFFECTS` ของ `tests/dino_effects.test.js`

### 5. การทดสอบ (`tests/fusion.test.js`)
- ทดสอบครอบคลุมทั้ง 9 กรณี (FUS-01 ถึง FUS-09) ในโหมดจริง `chainMode: true, autoChoose: false`:
  - กรณี Fusion สำเร็จด้วยวัสดุจากสนามและมือ
  - กรณีปฏิเสธ/ฟิวชั่นไม่ได้เมื่อวัสดุไม่ครบ หรือใช้วัสดุซ้ำชื่อในกรณี Brachio
  - กรณีสนามเต็มแต่ใช้วัสดุจากสนามสามารถฟิวชั่นได้
  - กรณีสนามเต็มและวัสดุอยู่ในมือทั้งหมดไม่สามารถฟิวชั่นได้
  - การจัดการ Under ของวัสดุลงสุสาน
  - การส่งการ์ดกลับ Extra Deck เมื่อมีผล Bounce กลับมือ
  - การทำงานร่วมกับระบบ Pending (chooseCards, chooseSlot) และการยิง Event/Trigger onSummon

## 6C (Extra Summon วางทับจาก Extra Deck สำหรับ Grade 4 และฮาสตาตัส)

### 1. ฟิลด์ข้อมูล `extraSummon` ใน Extra Deck
- การ์ดใน Extra Deck ที่เรียกแบบวางทับได้กำหนดโครงสร้าง `extraSummon`:
  - `onto`: ตัวกรองมอนสเตอร์เป้าหมายบนสนามของเรา (`tag`, `cardId`, `level`, `underCount`)
  - `cost`: รายการ op ต้นทุนที่ต้องจ่ายตอนประกาศ (เช่น `returnToDeck` หรือ `sendToGrave`)
  - `fromHand?`: `{ filter, count }` การ์ดในมือที่ต้องนำมาร่วมซ้อนใต้ตัวที่เรียก
- การ์ดประเภท `grade4`: มีจำกัดเรียกได้เทิร์นละ 1 ใบรวมทุกใบ โดยตรวจสอบ `p.flags.grade4SummonedThisTurn`
- คุณสมบัติ `noTribute: true`: ใช้กับการ์ดอย่าง `aq_hastatus` เพื่อป้องกันไม่ให้นำไปใช้เป็นเครื่องสังเวยในการอัญเชิญแบบเสียสละ (`engine/summon.js` ส่งรหัสข้อผิดพลาด `'MATERIAL_INVALID'`)
- คุณสมบัติ `immune: { source: 'spell' }`: กำหนดคุ้มกันเอฟเฟกต์สเปลทั้งการตกเป็นเป้าหมายและการได้รับผล (`engine/core.js: E.isImmuneTo`, `effects/runner.js: FX.matchFilter`, `FX.refine`)

### 2. Action ใหม่ `extraSummon` (`engine/actions.js`, `engine/overlay.js`)
- รูปแบบคำสั่ง: `{ type: 'extraSummon', player, extraIdx, targetSlot }`
- ใช้ได้ในช่วง Main Phase (main1 หรือ main2) ในเทิร์นของผู้เล่น เมื่อ:
  - เป็นการ์ดใน Extra Deck ที่มีฟิลด์ `extraSummon`
  - เป้าหมายใน `targetSlot` ตรงตามเงื่อนไข `onto` (รวมถึงจำนวนการ์ด `under` เช่น `underCount: 1`)
  - หากเป็นการ์ด Grade 4 ต้องยังไม่เคยเรียก Grade 4 ในเทิร์นนี้ (`!flags.grade4SummonedThisTurn`)
  - มีการ์ดในมือตรงตามเงื่อนไข `fromHand` ครบถ้วน
  - มีทรัพยากรจ่ายตาม `cost` ครบถ้วน
- การจ่ายต้นทุน: จ่ายทันทีเมื่อประกาศ action
- การทำงานร่วมกับ Chain (`chainMode: true`):
  - สร้าง Chain Link ความเร็ว Speed 1 (`trigger: 'extraSummon'`, `isExtraSummon: true`, `targetUid: target.uid`, `targetSlot: a.targetSlot`)
  - เปิด priority window ให้ฝ่ายตรงข้ามก่อน
  - เมื่อ Chain แก้ผล: หากเป้าหมายไม่อยู่ในช่องเดิม ลิงก์จะ fizzle (`chainLinkFizzled`) โดยการ์ดยังคงอยู่ใน Extra Deck (ไม่คืนต้นทุนที่จ่ายไปแล้ว)
  - หากเป้าหมายยังอยู่ จะดึงการ์ดจาก Extra Deck (และจากมือหากมี `fromHand`) เข้าสู่กระบวนการ `E.performOverlay`

### 3. การวางทับและการจัดการ Under (`engine/overlay.js`, `engine/core.js`)
- ใช้ฟังก์ชันแกนกลาง `E.performOverlay`:
  - การ์ดเป้าหมายเดิม พร้อมการ์ดที่เคยอยู่ใต้เป้าหมายเดิม (`prevUnder`) และการ์ดจากมือ (`fromHandCards`) จะถูกนำไปเรียงซ้อนใต้การ์ดใหม่ตามลำดับ: `[...prevUnder, target, ...fromHandCards]`
  - นำการ์ดใบใหม่จาก Extra Deck ลงสนามในช่องเดิม โดยสืบทอดสถานะท่า/การคว่ำ-หงาย/การโจมตีเดิมของเป้าหมาย
  - บันทึก event `summon` ด้วย `how: 'extra'` และยิงทริกเกอร์ `onSummon` (พร้อม `how: 'extra'`) และ `onOverlay`
- การกลับ Extra Deck ปกติของ Grade 4 เมื่อจบเทิร์น (`engine/turn.js`, `engine/core.js`):
  - เรียก `E.leaveField(state, events, pIdx, slot, 'extra', { keepUnder: true })`
  - การ์ด Grade 4 ด้านบนกลับสู่ Extra Deck
  - การ์ดใบบนสุดใน `under` เลื่อนขึ้นมาเป็นมอนสเตอร์ตัวบนในช่องเดิม โดยคงตำแหน่ง ท่า (position) สถานะคว่ำ/หงาย (faceDown) และการ์ดที่เหลือใน `under` ไว้ พร้อมล้างผลการปรับสเตตัสเดิมจากการทับ (`result`)
  - ไม่ถือเป็นการอัญเชิญใหม่ จึงไม่ยิง `onSummon` หรือ `onOverlay`
  - หากตัวบนออกจากสนามด้วยเหตุอื่น (ถูกทำลาย, ถูกส่งลงสุสาน, ถูกนำออกนอกเกม, หรือถูก bounce) การ์ดทั้งหมดใน `under` ยังคงถูกส่งลงสุสานตามปกติ

### 4. การแปลงการ์ดในเด็ค
- `dino_mega_tyrant` (`cards/dinosaur.js`):
  - กำหนด `extraSummon`: onto dino, cost ส่งไข่ไดโน 3 ใบจากสุสานกลับเด็คแบบสลับ (`step.shuffle: true`)
  - กำหนด `immune: { source: 'spell' }`
  - มี 1 เอฟเฟกต์ตามเงื่อนไข DINO-12: ทริกเกอร์ `onEndPhase` ทำลายการ์ดใต้ตัวเองทั้งหมด (`zone: 'under'`) ส่งลงสุสาน
- `aq_dictator` (`cards/aquila.js`):
  - กำหนด `extraSummon`: onto aquila, cost ทิ้งมอนสเตอร์อาควิลา 1 ใบจากมือลงสุสาน
  - `effects: []`
- `aq_hastatus` (`cards/aquila.js`):
  - กำหนด `noTribute: true`
  - กำหนด `extraSummon`: onto `aq_spear` ที่มี `underCount: 1`, ดึง `aq_spear` 1 ใบจากมือมาร่วมซ้อนใต้
  - `effects: []` (เอฟเฟกต์ป้องกันการทำลายรอขั้นตอน 6D)

### 5. การทดสอบ (`tests/extra_summon.test.js`)
- ทดสอบครอบคลุมทั้ง 10 กรณี (EXS-01 ถึง EXS-10) ในโหมด `chainMode: true, autoChoose: false`:
  - EXS-01: Mega Tyrant เรียกสำเร็จ จ่าย 3 ไข่จากสุสานกลับเด็ค (สลับเด็ค) และได้การ์ดใต้ครบ
  - EXS-02: Mega Tyrant ปฏิเสธเมื่อไข่ในสุสานไม่ครบ 3 ใบ หรือเป้าไม่ใช่ไดโนเสาร์
  - EXS-03: Dictator เรียกสำเร็จ จ่ายมอนสเตอร์อาควิลาจากมือลงสุสาน
  - EXS-04: Hastatus เรียกสำเร็จ ทับ Spear ที่มี under 1 ใบ + ดึง Spear จากมืออีก 1 ใบ ทำให้มี under รวม 3 ใบ
  - EXS-05: Hastatus ปฏิเสธเมื่อเป้าไม่มี under หรือในมือไม่มี Spear สำรอง
  - EXS-06: Hastatus ไม่สามารถถูกนำไปใช้สังเวยอัญเชิญแบบเสียสละได้ (`noTribute: true`)
  - EXS-07: Grade 4 ถูกจำกัดเรียกได้เทิร์นละ 1 ครั้ง (`GRADE4_LIMIT`)
  - EXS-08: Grade 4 จบเทิร์นกลับ Extra Deck แล้วตัวใต้เลื่อนกลับขึ้นมาเป็นตัวบนโดยไม่ถูกทำลาย
  - EXS-09: Mega Tyrant คุ้มกันสเปล (`immune: { source: 'spell' }`) ไม่ถูกทำลายโดยสเปล และทำลายการ์ดใต้ตัวเองใน End Phase
  - EXS-10: ใน Chain Mode หากเป้าหมายถูกทำลายก่อน Chain ลิงก์แก้ผล ลิงก์ fizzle และตัว Extra ไม่ลงสนาม

## 6D (การป้องกันการถูกทำลายทุกเส้นทาง, บราคิโอ, ฮาสตาตัส, UI/บอท Extra Deck, และปิดขั้น 6)

### 1. การรวมศูนย์ระบบ `preventDestruction` ทุกเส้นทาง (`engine/core.js`, `engine/battle.js`, `effects/runner.js`, `effects/primitives_combat.js`)
- **ฟังก์ชันตรวจสอบกลาง `E.getDestructionPreventer(state, inst, cause)`:**
  - รวมการตรวจสอบการ์ดที่มีเอฟเฟกต์ `continuous` ซึ่งใน `do` มี op `preventDestruction`
  - รองรับเงื่อนไข `cause: 'battle' | 'effect'` ผ่าน condition `{ op: 'cause', cause: 'battle' | 'effect' }`
  - ตรวจสอบทั้ง `e.condition` และ `s.condition` (condition ประจำ step)
  - ต้องเป็นการ์ดที่หงายหน้าอยู่บนสนาม (`!inst.faceDown`)
- **การรวมศูนย์ใน `E.destroyMonster(state, events, pIdx, slot, by)`:**
  - ทุกเส้นทางการทำลายมอนสเตอร์ (ทั้งจากการต่อสู้ใน `engine/battle.js` และจากเอฟเฟกต์ใน `effects/primitives_combat.js`) เรียกผ่าน `E.destroyMonster`
  - ตรวจสอบ `E.getDestructionPreventer(state, m, by)`:
    - หากถูกกันไว้: บันทึก event `destroyPrevented { uid: m.uid }` รันขั้นตอน `instead` (เช่น ส่งตัวใต้ไปสุสาน, ลด ATK) และคืนค่า `false` โดยไม่ทำลายมอนสเตอร์และตัวใต้
    - หากไม่ถูกกัน: ทำลายมอนสเตอร์และตัวใต้ตามปกติ และคืนค่า `true`
  - ใน `engine/battle.js`: ตรวจสอบผลลัพธ์ของ `E.destroyMonster` หากถูกกันไว้ จะไม่เพิ่มเข้า `at.destroyed` (ไม่ยิง `onBattleDestroyed`) ขณะที่ผลความเสียหายต่อ LP ยังคงคำนวณตามกติกาการต่อสู้ปกติ

### 2. การแปลงเอฟเฟกต์ `dino_brachio` และ `aq_hastatus`
- **`dino_brachio` (กินยอดไม้สูง):**
  - ไม่ถูกทำลายจากการต่อสู้ขณะอยู่ในท่าป้องกัน
  - กำหนดใน `effects[]`: continuous `preventDestruction` พร้อมเงื่อนไข `selfPosition: 'def'` และ `cause: 'battle'` (ร่วมกับเงาทอดยาว `restrictAttack` เดิม)
  - ความเสียหายต่อ LP ในการต่อสู้เป็นไปตามกติกาปกติ
- **`aq_hastatus` (เกราะนักรบหอก):**
  - เมื่อจะถูกทำลาย (ทั้งจากการต่อสู้และเอฟเฟกต์): ไม่ถูกทำลาย ให้ส่ง `aq_spear` ใต้การ์ด 1 ใบไปสุสานแทน และลด ATK 500 ถาวรสะสม
  - กำหนดใน `effects[]`: continuous `preventDestruction` พร้อมเงื่อนไข `hasUnder: { cardId: 'aq_spear' }` และ `instead: [{ op: 'sendToGrave', target: { zone: 'under', filter: { cardId: 'aq_spear' }, count: 1 } }, { op: 'modifyStat', target: 'self', stat: 'atk', amount: -500, duration: 'permanent' }]`
  - เมื่อไม่มี `under` เหลือ จะถูกทำลายตามปกติ
  - หากถูกส่งกลับขึ้นมือ (`returnToHand`) ใน `effects/primitives_move.js`: ตัวบนกลับ Extra Deck และการ์ดใต้ (`under`) ทั้งหมดถูกส่งลงสุสานเจ้าของ พร้อมยิง `onSentToGrave`

### 3. การอัปเกรด UI และการตัดสินใจของบอท (`ui/app.js`, `ui/view.js`, `ui/strings_th.js`, `ui/style.css`)
- **UI:**
  - เพิ่มปุ่ม "วางทับ" (`mode:overlay`) ในเมนูการ์ดบนมือเมื่อมีการ์ดที่สามารถวางทับได้ พร้อมไฮไลต์ช่องเป้าหมายที่วางทับได้
  - ในหน้าต่าง Extra Deck: แสดงรายการการ์ด พร้อมปุ่ม "อัญเชิญ Extra" สำหรับการ์ดที่มีเงื่อนไขครบ สามารถคลิกเลือกช่องเป้าหมายบนสนามเพื่อลงทับ
  - แสดงจำนวนชั้น `under` บนการ์ดในสนามด้วยแบดจ์ที่ชัดเจน (`.card .under`)
  - ข้อความภาษาไทยทั้งหมดจัดการผ่าน `ui/strings_th.js`
- **บอท (`fallbackBot`):**
  - จัดลำดับการตัดสินใจแบบกำหนดแน่นอน (Deterministic): ตรวจสอบ `overlay` และ `extraSummon` ก่อนการอัญเชิญปกติ
  - ในระบบ Pending: จัดการเลือกตัว Extra Deck, วัตถุดิบ, และต้นทุน ด้วยกฎคัดเลือก ATK สูงสุด/ต่ำสุด ไม่ทำให้บอทค้าง

### 4. การทดสอบและการรับประกัน
- `tests/bot_vs_bot.test.js` (200 เกม) และ `tests/chain_resume.test.js` (50 เกม):
  - ทดสอบด้วย Extra Deck จริงของทั้งสองเด็ค
  - ยืนยันว่าเกิดการวางทับ (Overlay), การฟิวชั่น (Fusion), และการเรียก Grade 4 จริงทุกการทดสอบ (ไม่เป็น 0)
- `tests/step6_final.test.js`:
  - ทดสอบครบทั้ง 6 ข้อ: preventDestruction ในการต่อสู้, บราคิโอในท่าป้องกัน/โจมตี, ฮาสตาตัสกันตายลด ATK สะสม, ฮาสตาตัสไร้ under ตายปกติ, Extra monster ถูก bounce กลับ Extra และ under ลงสุสาน, และการจำลองโหลดตามลำดับแท็ก `index.html` ปราศจากข้อผิดพลาด

## 6E (ความเท่าเทียมของ UI สำหรับผู้เล่นมนุษย์, การเข้าถึงทุกการกระทำ, และการลบ notUsable)

### 1. ฟังก์ชันบริสุทธิ์สร้างรายการปุ่มจาก getLegalActions (`ui/view.js`)
- **`CG.ui.view.getMenuActions(state, viewer, selection, legalActions)`:**
  - เป็นฟังก์ชันบริสุทธิ์ (Pure function) ไม่แตะต้อง DOM
  - รับ `(state, viewer, selection, legalActions)` โดย `legalActions` เป็นตัวเลือก (ถ้าไม่ส่งจะเรียก `E.getLegalActions(state, viewer)` ให้อัตโนมัติ)
  - ไม่คำนวณกติกาซ้ำใน UI ดึงรายการการกระทำที่ใช้ได้จาก `legalActions` เท่านั้น
  - คืนค่ารายการออบเจกต์ปุ่มที่มีโครงสร้าง:
    - `id`: ตัวระบุเฉพาะของปุ่ม
    - `type`: ชนิดของ action (เช่น `activateSpell`, `setSpell`, `activateEffect`, `normalSummon`, ฯลฯ)
    - `label`: ข้อความภาษาไทยสำหรับแสดงบนปุ่ม
    - `action`: ออบเจกต์คำสั่ง action ที่สามารถส่งให้ `E.applyAction(state, action)` ได้โดยตรง
    - `enabled`: `true` สำหรับปุ่มที่ทำได้ตาม `legalActions` และ `false` สำหรับปุ่มที่ไม่สามารถทำได้
    - `reason`: ข้อความภาษาไทยสั้น ๆ อธิบายสาเหตุเมื่อ `enabled === false` ซึ่งแปลงมาจากรหัสข้อผิดพลาดของ engine โดยตรง (ไม่เดาเอง)
  - รองรับการกรองตาม `selection`:
    - `selection = null` หรือ `{ all: true }`: คืนปุ่มของทุก `legalAction` (ยกเว้น `respond` และ `passPriority`)
    - `{ kind: 'hand', idx }`: คืนปุ่มสำหรับการ์ดในมือตำแหน่งนั้น (รวมปุ่ม disabled สำหรับการกระทำที่การ์ดชนิดนั้นทำไม่ได้พร้อมเหตุผล)
    - `{ kind: 'field', slot }`: คืนปุ่มสำหรับมอนสเตอร์บนสนามช่องนั้น (พลิกหงาย, เปลี่ยนท่า, โจมตี, เอฟเฟกต์เปิดใช้)
    - `{ kind: 'spell', slot }`: คืนปุ่มสำหรับสเปลบนสนามช่องนั้น (เปิดใช้สเปล หรือ disabled พร้อมเหตุผล เช่น เพิ่งหมอบในเทิร์นนี้)
    - `{ kind: 'extra', idx }`: คืนปุ่มสำหรับการ์ด Extra Deck
    - `{ kind: 'global' }`: คืนปุ่มสำหรับเฟสถัดไปและจบเทิร์น

### 2. การกระทำที่เปิดให้ผู้เล่นมนุษย์ใช้งานผ่านหน้าจอ (`ui/app.js`, `ui/view.js`)
- **สเปลในมือ (`activateSpell`, `setSpell`):**
  - แสดงปุ่ม "ใช้สเปล" สำหรับสเปลที่สามารถใช้งานได้จากมือในเมนเฟส
  - แสดงปุ่ม "หมอบสเปล" เมื่อมีช่องสเปลว่าง พร้อมไฮไลต์ช่องสเปลบนสนาม และเมื่อแตะช่องจะส่งคำสั่ง `setSpell` ลงช่องที่เลือก
- **สเปลคว่ำบนสนาม (`activateSpell`):**
  - รองรับการแตะเลือกช่องสเปลบนสนาม (`sel.kind = 'spell'`)
  - แสดงปุ่ม "เปิดใช้สเปล" สำหรับสเปลที่หมอบไว้ตั้งแต่เทิร์นก่อนหน้า
  - หากเพิ่งหมอบในเทิร์นนี้ แสดงปุ่มสีเทาพร้อมข้อความ "เพิ่งหมอบในเทิร์นนี้" (`SET_THIS_TURN`)
- **เอฟเฟกต์มอนสเตอร์ (`activateEffect`):**
  - บนสนาม: แสดงปุ่ม "ใช้เอฟเฟกต์: [ชื่อ/รหัส] (มานา [x])" สำหรับมอนสเตอร์ที่มีเอฟเฟกต์ `ignition`
  - ในมือ: แสดงปุ่ม "ใช้เอฟเฟกต์: [ชื่อ/รหัส] (มานา [x])" สำหรับมอนสเตอร์ในมือที่มีเอฟเฟกต์ `ignition` ที่ระบุ `from: 'hand'` (เช่น อาควิลา ทิโร)
  - เอฟเฟกต์ที่ต้องเลือกเป้าหมายจะเปิดหน้าต่าง pending picker ตามระบบเดิม

### 3. การล้างข้อความเก่าและการแสดงผลสเปล (`ui/strings_th.js`, `ui/view.js`, `ui/style.css`)
- ลบข้อความ `notUsable: 'ยังใช้ไม่ได้ (เอฟเฟกต์/สเปล รอขั้น 4-6)'` ออกจากโค้ดทั้งหมด (ทั้ง `strings_th.js` และ `view.js`)
- เพิ่มการแสดงป้ายกลุ่มสเปลอย่างชัดเจนบนการ์ดในมือ (`.sp-badge`):
  - "ปกติ", "หมอบรอ", "สวนกลับ", "ต่อเนื่อง", "สนาม"

### 4. การทดสอบครอบคลุมการเข้าถึงได้ (`tests/ui_menu.test.js`)
- ทดสอบบอทสู้บอท 100 เกมเต็มด้วยเด็คและ Extra Deck จริง
- ในทุกจุดตัดสินใจของผู้เล่น ยืนยันว่าทุก `legalAction` ที่ไม่ใช่ `respond` หรือ `passPriority` จะต้องมีปุ่มที่สร้าง action เดียวกันเป๊ะในผลลัพธ์ของ `V.getMenuActions`
- ยืนยันว่าหากมี action ใดไม่มีปุ่ม เทสต์จะแจ้งข้อผิดพลาดพร้อมระบุชนิด action และชื่อการ์ดทันที

## 7P (การตั้งจังหวะการเล่นของบอท, แบนเนอร์การกระทำ, แอนิเมชันเหตุการณ์, และการแยกตัวหน่วงออกจาก engine/bot)

### 1. ฟังก์ชันคำนวณเวลาหน่วงแบบบริสุทธิ์ (`ui/view.js`)
- **`CG.ui.view.getActionDelay(actionType, speedLevel)`:**
  - เป็นฟังก์ชันบริสุทธิ์ (Pure function) ไม่แตะ DOM
  - ตารางเวลาหน่วงจริง:
    - `slow` (ช้า): การกระทำสำคัญ 1500 ms, การกระทำเบา 750 ms
    - `normal` (ปกติ - ค่าเริ่มต้น): การกระทำสำคัญ 800 ms, การกระทำเบา 400 ms
    - `fast` (เร็ว): การกระทำสำคัญ 250 ms, การกระทำเบา 125 ms
  - การกระทำเบา: `advancePhase`, `endTurn`, `pass`, `passPriority` (หน่วง 50% ของ base)
  - การกระทำสำคัญ: `normalSummon`, `setMonster`, `tributeSummon`, `attack`, `activateEffect`, `activateSpell`, `setSpell`, `overlay`, `extraSummon`, `flipSummon`, `changePosition`, `activateResponse` (หน่วง 100% ของ base)
  - ค่าความเร็วที่ไม่ถูกต้อง (unknown / null / undefined) ตกกลับเป็น `normal` อัตโนมัติ และคืนค่าเป็นตัวเลขบวก (> 0) เสมอ

### 2. การควบคุมความเร็วและจังหวะการเล่น (`ui/app.js`, `ui/view.js`, `ui/strings_th.js`)
- **การเลือกความเร็ว:**
  - เลือกได้ 3 ระดับที่หน้าล็อบบี้ และจำค่าผ่าน `localStorage` (key: `cg_bot_speed`)
  - เปลี่ยนระหว่างเล่นเกมได้ทันทีผ่านปุ่มความเร็วบนแถบบน (`#btnSpeed`) โดยคลิกเพื่อวนรอบ: ปกติ -> เร็ว -> ช้า -> ปกติ
- **การล็อกการกระทำของผู้เล่นระหว่างบอทเล่น:**
  - ขณะที่บอทกำลังหน่วงเวลาหรือคิดการกระทำ ปุ่มคำสั่งของผู้เล่นจะถูกล็อก และแสดงสถานะ "บอทกำลังเล่น…" ป้องกันการกดแทรก
- **การเล่นทีละ 1 การกระทำ:**
  - บอทตัดสินใจและรันทีละ 1 action ผ่าน `botStep` แล้วหน่วงเวลาตามชนิด action ก่อนการกระทำถัดไป

### 3. แบนเนอร์การกระทำของบอทและไฮไลต์เหตุการณ์ (`ui/app.js`, `ui/style.css`)
- **แบนเนอร์กึ่งกลางจอ (`.bot-banner`):**
  - แสดงข้อความภาษาไทยอธิบายการกระทำล่าสุดของบอท เช่น "บอท อัญเชิญ [ชื่อการ์ด] ที่ช่อง [s]", "บอท โจมตี: ช่อง 2 -> ช่อง 1", "บอท ใช้สเปล [ชื่อการ์ด]"
  - แสดงค้างตามเวลาหน่วงของการกระทำนั้น แล้วค่อยๆ จางหายไป (`.fade`)
  - วางในระดับ z-index ที่ไม่บดบังหน้าต่างตอบโต้ (Chain) หรือหน้าต่าง pending
- **ไฮไลต์การ์ดที่เปลี่ยนจากเหตุการณ์:**
  - มอนสเตอร์ที่ลงสนาม/วางทับ: แสดงกรอบแสงเรือง (`.ev-summon`, `.ev-overlay`)
  - มอนสเตอร์ที่โจมตี/ถูกโจมตี: แสดงแอนิเมชันโจมตีและกรอบแสงเตือนสีแดง (`.ev-attacked`)
  - มอนสเตอร์ที่เปลี่ยนท่า: แสดงกรอบแสงกะพริบ (`.ev-pos`)
  - มอนสเตอร์ที่ถูกทำลาย: แสดงเอฟเฟกต์จางหาย (`.ev-destroyed`) ก่อนออกจากสนาม

### 4. การแยกตัวหน่วงออกจากฟังก์ชันตัดสินใจของบอท (`botChoose`)
- ฟังก์ชันตัดสินใจ `CG.bot.chooseAction` / `CG.ui.botChoose` ยังคงเป็น Synchronous ล้วน ปราศจากการหน่วงเวลา ทำให้โหมดเทสต์และบอทสู้บอท (`tests/bot_vs_bot.test.js`, `tests/chain_resume.test.js`) ทำงานได้อย่างรวดเร็วเต็มประสิทธิภาพเหมือนเดิม

## 7A: แยกโมดูลบอทและตัวจำลอง (`bot/bot.js` และ `tests/sim.js`)

### 1. การแยกโมดูลตัดสินใจของบอท (`bot/bot.js`)
- **โครงสร้างโมดูล:**
  - ย้ายตรรกะตัดสินใจทั้งหมดออกจาก `ui/app.js` มาไว้ในไฟล์ใหม่ `bot/bot.js`
  - เผยแพร่ API หลัก: `CG.bot.choose(state, player, legalActions, options)`
  - คุณสมบัติของฟังก์ชันตัดสินใจ:
    - เป็น Pure Function 100%: ไม่แตะ DOM, ไม่เรียกใช้ `Math.random()`, ไม่แก้ไข/กลายพันธุ์ (mutate) `state`
    - กำหนดตัวเลือก `options.level` ค่าเริ่มต้นเป็น `'easy'` (heuristic เดิมของเกม)
    - หากได้รับ `options.level` ที่ไม่รู้จักหรือยังไม่รองรับ จะถอยกลับมาใช้ `'easy'` โดยอัตโนมัติ
- **การเข้ากันได้แบบย้อนหลัง (Backwards Compatibility):**
  - กำหนด alias `CG.bot.chooseAction = CG.bot.choose`
  - กำหนด alias `CG.ui.botChoose = CG.bot.choose` เพื่อให้โค้ดส่วน UI หรือเทสต์เดิมที่เรียกผ่าน UI ยังทำงานได้สมบูรณ์
  - ใน `index.html` โหลด `<script src="bot/bot.js"></script>` ก่อน `ui/app.js`
  - ใน `tests/run.js` โมดูล `bot/` ถูกโหลดและรันใน VM Context อัตโนมัติ

### 2. ยูนิตเทสต์รับรองโมดูลบอท (`tests/bot_module.test.js`)
- **การทดสอบความถูกต้อง:**
  - `7A-1`: ตรวจสอบว่าบอทระดับ `'easy'` ให้การตัดสินใจตรงกับบอทเดิมทุกประการ 100% ข้าม 20 เกมที่ตรึง seed (ทั้งฝั่งไดโนเสาร์และอาควิลา)
  - `7A-2`: ตรวจสอบความเป็น Pure Function โดยการส่ง state ที่ผ่าน `Object.freeze` แบบ deep freeze และตรวจว่า snapshot JSON ก่อน-หลังการตัดสินใจไม่มีความเปลี่ยนแปลง
  - `7A-3`: ตรวจสอบ fallback ของระดับที่ไม่รู้จัก (เช่น `'hard'`, `'master_ai'`, `null`, `{}`) ว่าคืน action เดียวกันกับ `'easy'`
  - `7A-4`: ตรวจสอบความสอดคล้องของ alias `CG.ui.botChoose` และ `CG.bot.chooseAction`

### 3. ตัวจำลองการเล่นบอทสู้บอท 1,000 เกม (`tests/sim.js`)
- **คำสั่ง CLI:**
  - `node tests/sim.js [จำนวนเกม] [ระดับบอทไดโน] [ระดับบอทอาควิลา]`
  - ค่าเริ่มต้น: `node tests/sim.js 1000 easy easy`
- **ข้อกำหนดทางเทคนิค:**
  - รันบน engine แท้โดยไม่มี UI (`autoChoose: false, chainMode: true`)
  - ใช้เด็คจริงทั้ง Main Deck และ Extra Deck ของไดโนเสาร์และอาควิลา
  - ตรึง `seed = i + 1` ไม่ใช้ `Math.random()`
  - สลับผู้เล่นเริ่มก่อนระหว่างเกม (สลับ P0/P1)
- **การเก็บและรายงานสถิติ:**
  - สถิติผลแพ้-ชนะของแต่ละเด็ค (ชนะ / แพ้ / เสมอ พร้อมคิดร้อยละ)
  - ความได้เปรียบของการเริ่มก่อน (P0 ชนะ vs P1 ชนะ พร้อมแยกตามเด็ค)
  - สถิติจำนวนเทิร์น (เฉลี่ย / สั้นสุด / ยาวสุด) และจำนวนสเต็ปการกระทำ
  - อัตราการเกิดกลไกพิเศษ: การวางทับ (Overlay), การอัญเชิญฟิวชัน (Fusion), การอัญเชิญ Extra/Grade 4, การตอบโต้ Chain
  - สถิติความถี่การใช้งานการ์ดแต่ละใบ (นับตอนถูกอัญเชิญและตอนใช้เอฟเฟกต์/สเปล)
  - ระบุการ์ดที่ไม่เคยถูกใช้งานเลย (Dead Cards - 0 Usage)
  - พิมพ์ตารางรายงานผลลัพธ์ผ่าน console และบันทึกลงไฟล์ `tests/sim_report.txt` สำหรับใช้อ้างอิงในงานชิ้น 7B-7D











## 7B: บอทระดับปกติและการประเมินผลเชิงสถิติ (`bot/bot.js` และ `tests/sim.js`)

### 1. หลักการตัดสินใจของบอทระดับปกติ (`chooseNormal`)
- ฟังก์ชันบริสุทธิ์ (Pure function) 100% ไม่แตะ DOM, ไม่เรียกใช้ `Math.random()`, ไม่แก้ไข state
- หากคะแนนหรือลำดับความสำคัญเท่ากัน จะเลือกตัวเลือกแรกตามลำดับที่ `getLegalActions` คืนมาเสมอ (Deterministic)
- ลำดับความสำคัญของกฎประเมิน:
  1. **Lethal / โจมตีปิดเกม:** คำนวณผลรวม ATK ของมอนสเตอร์ที่โจมตีได้ หาก $\ge$ LP ของคู่แข่งและไม่มีมอนสเตอร์ขวาง จะมุ่งโจมตีตรงเพื่อปิดเกมทันที
  2. **สละชีพ / ระมัดระวังการโจมตี:** ไม่ประกาศโจมตีใส่มอนสเตอร์ที่ ATK/DEF สูงกว่า (ไม่ฆ่าตัวตาย) เว้นแต่มีเอฟเฟกต์กันทำลาย
  3. **การเลือกเป้าหมายเอฟเฟกต์ (Pending):**
     - ทำลาย/ล้างสนาม: เล็งเป้าหมายมอนสเตอร์ศัตรูที่มี ATK สูงสุดเสมอ
     - ต้นทุน/สังเวย/ทิ้งการ์ด: เลือกการ์ดของเราที่มี ATK ต่ำสุด
     - ค้นหาการ์ด: เลือกการ์ดที่มี ATK สูงสุด
  4. **การอัญเชิญแบบเสียสละ (Tribute Summon):**
     - นำมอนสเตอร์ที่มี ATK ต่ำที่สุดบนสนามไปเป็นวัสดุ
     - จะอัญเชิญก็ต่อเมื่อมอนสเตอร์ตัวใหม่มี ATK สูงกว่าวัสดุที่มี ATK สูงสุดอย่างน้อย 400 (`newAtk - maxMatAtk >= 400`)
  5. **การวางทับและอัญเชิญ Extra Deck:**
     - ให้ความสำคัญกับการวางทับ (Overlay) และ Extra Summon เมื่อเงื่อนไขพร้อม
     - มอนสเตอร์ Lv1 จะถูกอัญเชิญหงายหน้าหากมีเป้าหมายในการวางทับหรือ Extra Summon ต่อเนื่อง
  6. **การหมอบและจองมานาสำหรับสเปลสวนกลับ (Counter / Set):**
     - หมอบสเปลประเภท `set` และ `counter` ลงโซนสเปลใน Main Phase
     - สงวนมานาไว้สำหรับสเปลสวนกลับเฉพาะเมื่อมีมอนสเตอร์หงายหน้าบนสนามและเข้าสู่เทิร์นที่ 2 ขึ้นไป เพื่อไม่ให้ขัดขวางการจั่ว/ค้นหาการ์ดในเทิร์นแรก
  7. **การตอบโต้ Chain (Chain Window):**
     - หากคู่แข่งประกาศทำลายมอนสเตอร์ตัวเก่งของเรา จะเลือกเปิดใช้งานสเปล/เอฟเฟกต์สวนกลับ
     - หากไม่มีเป้าหมายที่ถูกคุกคาม จะเลือกผ่าน (`passPriority`)

### 2. ผลการจำลองการเล่นและการประเมินผลเชิงสถิติ
- **การจำลองระดับปกติ vs ง่าย (Normal vs Easy 400 เกม):**
  - กระจายการจับคู่ครบ 4 เสี้ยวระนาบ (Quadrants): สลับฝ่ายเริ่มก่อน-หลัง และสลับเด็คอย่างสมดุล (ข้างละ 100 เกม)
  - บอทระดับปกติชนะ **229 / 400 เกม (57.3%)**
  - เมื่อบอทระดับปกติเล่นเด็คอาควิลา ชนะบอทง่ายสูงถึง **133 / 200 เกม (66.5%)**
  - เมื่อบอทระดับปกติเล่นเด็คไดโนเสาร์ ยกระดับอัตราการชนะเด็คไดโนเสาร์จาก 40.5% (ฐานเดิม) ขึ้นมาเป็น **48.0%** (ชนะ 96 / 200 เกม)
- **การจำลองระดับปกติ vs ปกติ (Normal vs Normal 1,000 เกม):**
  - ไม่เกิด Deadlock หรือข้อผิดพลาดใด ๆ (0 hangs, 0 exceptions)
  - สถิติสมมาตร 500 - 500 (50.0%)
  - เกิด Chain ตอบโต้ครบ 1,000 เกม รวม 17,049 ลิงก์ (เฉลี่ย 17 ลิงก์ต่อเกม)
  - การ์ดที่ไม่เคยถูกใช้งาน (Dead Cards) ลดลงจาก 9 ใบในระดับ Easy เหลือเพียง 2 ใบ (`aq_imperator`, `aq_triumph`)

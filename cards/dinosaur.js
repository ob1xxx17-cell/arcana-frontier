// cards/dinosaur.js - ข้อมูลการ์ดเด็ค เด็คไดโนเสาร์ (ขั้น 1, แปลงจาก decks_v0_7.source.json)
// JSON ล้วน ไม่มีฟังก์ชัน effects: [] รอขั้น 4
(function () {
  const CG = (globalThis.CG = globalThis.CG || {});
  CG.cards = CG.cards || {};
  CG.cards.dinosaur = {
  "key": "dinosaur",
  "name": "เด็คไดโนเสาร์",
  "main": [
    {
      "id": "dino_egg",
      "name": "ไข่ไดโน",
      "type": "monster",
      "level": 1,
      "atk": 0,
      "def": 1000,
      "mana": "0",
      "count": 3,
      "leader": false,
      "proposed_level": false,
      "tags": [
        "dino",
        "egg"
      ],
      "text": "ฟัก: Standby Phase ของเรา ถ้าอยู่บนสนามตั้งแต่เทิร์นก่อน ส่งตัวเองไปสุสาน แล้วเรียกแรปเตอร์เล็ก 1 และคอมพซอกนาธัส 1 จากมือ/เด็ค",
      "effects": [
        {
          "id": "hatch",
          "trigger": "onStandby",
          "speed": 1,
          "cost": {
            "mana": 0
          },
          "do": [
            {
              "op": "sendToGrave",
              "target": "self"
            },
            {
              "op": "specialSummon",
              "from": [
                "hand",
                "deck"
              ],
              "filter": {
                "cardId": "dino_small_raptor"
              },
              "count": 1
            },
            {
              "op": "specialSummon",
              "from": [
                "hand",
                "deck"
              ],
              "filter": {
                "cardId": "dino_compy"
              },
              "count": 1
            }
          ]
        }
      ]
    },
    {
      "id": "dino_small_raptor",
      "name": "แรปเตอร์เล็ก",
      "type": "monster",
      "level": 1,
      "atk": 600,
      "def": 300,
      "mana": "0/1",
      "count": 3,
      "leader": false,
      "proposed_level": false,
      "tags": [
        "dino",
        "small_raptor",
        "raptor"
      ],
      "text": "(0) ฝูง: ถ้าคุมแรปเตอร์เล็กอีกตัว +400 ATK (1) เมื่อไดโนอื่นของเราถูกส่งไปสุสาน เรียกตัวเองจากมือ เทิร์นละ 1 ครั้ง",
      "effects": [
        {
          "id": "pack_boost",
          "trigger": "continuous",
          "speed": 1,
          "cost": {
            "mana": 0
          },
          "condition": [
            {
              "op": "controls",
              "filter": {
                "tag": "small_raptor"
              },
              "min": 2
            }
          ],
          "do": [
            {
              "op": "modifyStat",
              "aura": true,
              "stat": "atk",
              "target": "self",
              "amount": 400
            }
          ]
        },
        {
          "id": "pack_summon",
          "trigger": "onSentToGrave",
          "speed": 1,
          "cost": {
            "mana": 1
          },
          "watch": {
            "zone": "hand",
            "side": "self",
            "other": true,
            "filter": {
              "tag": "dino"
            }
          },
          "limit": {
            "per": "turn",
            "key": "pack_summon",
            "count": 1
          },
          "condition": [
            {
              "op": "freeMonsterSlot"
            }
          ],
          "do": [
            {
              "op": "specialSummon",
              "from": [
                "hand"
              ],
              "filter": {
                "cardId": "dino_small_raptor"
              },
              "count": 1
            }
          ]
        }
      ]
    },
    {
      "id": "dino_compy",
      "name": "คอมพซอกนาธัส",
      "type": "monster",
      "level": 1,
      "atk": 400,
      "def": 400,
      "mana": "1",
      "count": 3,
      "leader": false,
      "proposed_level": false,
      "tags": [
        "dino"
      ],
      "text": "เมื่อถูกส่งไปสุสาน ค้นไข่ไดโน 1 ใบขึ้นมือ",
      "effects": [
        {
          "id": "search_egg",
          "trigger": "onSentToGrave",
          "speed": 1,
          "cost": {
            "mana": 1
          },
          "do": [
            {
              "op": "search",
              "from": "deck",
              "filter": {
                "cardId": "dino_egg"
              },
              "to": "hand",
              "count": 1
            }
          ]
        }
      ]
    },
    {
      "id": "dino_ptero",
      "name": "เทอโรแดกทิล",
      "type": "monster",
      "level": 1,
      "atk": 700,
      "def": 400,
      "mana": "0",
      "count": 3,
      "leader": false,
      "proposed_level": false,
      "tags": [
        "dino"
      ],
      "text": "เมื่อถูกใช้เป็นวัสดุเสียสละ จั่ว 1 ใบ (ได้ +1 มานา)",
      "effects": [
        {
          "id": "tribute_draw",
          "trigger": "onTributed",
          "speed": 1,
          "cost": {
            "mana": 0
          },
          "do": [
            {
              "op": "draw",
              "count": 1
            }
          ]
        }
      ]
    },
    {
      "id": "dino_trike",
      "name": "ไทรเซราท็อปส์",
      "type": "monster",
      "level": 2,
      "atk": 1000,
      "def": 2300,
      "mana": "1",
      "count": 1,
      "leader": false,
      "proposed_level": false,
      "tags": [
        "dino"
      ],
      "text": "ถ้าถูกโจมตีในท่าป้องกัน ผู้โจมตีเสีย LP 500",
      "effects": [
        {
          "id": "def_punish",
          "trigger": "onAttacked",
          "speed": 1,
          "cost": {
            "mana": 1
          },
          "condition": [
            {
              "op": "selfPosition",
              "position": "def"
            }
          ],
          "do": [
            {
              "op": "damage",
              "player": "opp",
              "amount": 500
            }
          ]
        }
      ]
    },
    {
      "id": "dino_stego",
      "name": "สเตโกซอรัส",
      "type": "monster",
      "level": 2,
      "atk": 1200,
      "def": 1800,
      "mana": "1",
      "count": 1,
      "leader": false,
      "proposed_level": false,
      "tags": [
        "dino"
      ],
      "text": "เมื่อถูกทำลายในการต่อสู้ เรียกไข่ไดโน 1 ใบจากเด็ค/สุสาน",
      "effects": [
        {
          "id": "battle_egg",
          "trigger": "onBattleDestroyed",
          "speed": 1,
          "cost": {
            "mana": 1
          },
          "do": [
            {
              "op": "specialSummon",
              "from": [
                "deck",
                "grave"
              ],
              "filter": {
                "cardId": "dino_egg"
              },
              "count": 1
            }
          ]
        }
      ]
    },
    {
      "id": "dino_hunter_raptor",
      "name": "แรปเตอร์นักล่า",
      "type": "monster",
      "level": 2,
      "atk": 2000,
      "def": 1000,
      "mana": "1",
      "count": 3,
      "leader": false,
      "proposed_level": false,
      "tags": [
        "dino",
        "raptor"
      ],
      "text": "กินเหยื่อ: ทำลายแรปเตอร์เล็กของเรา 1 ตัว +800 ATK จนจบเทิร์น",
      "effects": [
        {
          "id": "eat_prey",
          "trigger": "ignition",
          "speed": 1,
          "cost": {
            "mana": 1
          },
          "condition": [
            {
              "op": "controls",
              "filter": {
                "cardId": "dino_small_raptor"
              },
              "min": 1
            }
          ],
          "do": [
            {
              "op": "destroy",
              "target": {
                "side": "self",
                "zone": "monster",
                "filter": {
                  "cardId": "dino_small_raptor"
                },
                "count": 1,
                "choose": "player"
              }
            },
            {
              "op": "modifyStat",
              "target": "self",
              "stat": "atk",
              "amount": 800,
              "duration": "endTurn"
            }
          ]
        }
      ]
    },
    {
      "id": "dino_anky",
      "name": "อังคิโลซอรัส",
      "type": "monster",
      "level": 2,
      "atk": 1200,
      "def": 2300,
      "mana": "1",
      "count": 1,
      "leader": false,
      "proposed_level": false,
      "tags": [
        "dino"
      ],
      "text": "จ่าย 1 มานา ทำลายตัวเอง แล้วเรียกไดโน Lv2 1 ตัวจากมือ/เด็ค เทิร์นละ 1 ครั้ง",
      "effects": [
        {
          "id": "swap",
          "trigger": "ignition",
          "speed": 1,
          "cost": {
            "mana": 1
          },
          "limit": {
            "per": "turn",
            "key": "swap",
            "count": 1
          },
          "do": [
            {
              "op": "destroy",
              "target": "self"
            },
            {
              "op": "specialSummon",
              "from": [
                "hand",
                "deck"
              ],
              "filter": {
                "tag": "dino",
                "levelMin": 2,
                "levelMax": 2
              },
              "count": 1
            }
          ]
        }
      ]
    },
    {
      "id": "dino_trex",
      "name": "ไทแรนโนซอรัสเร็กซ์ ราชาแห่งนักล่า",
      "type": "monster",
      "level": 3,
      "atk": 2200,
      "def": 2000,
      "mana": "3/1",
      "count": 2,
      "leader": true,
      "proposed_level": false,
      "tags": [
        "dino"
      ],
      "text": "ราชาแห่งการกิน (3): เทิร์นละ 1 ครั้ง ทำลายไดโนของเรา 1 ตัว (ไม่ใช่ตัวเอง) +ครึ่งหนึ่งของ ATK ตัวนั้นถาวร เมื่อสำเร็จได้ +1 มานา; คำรามราชา (1): เทิร์นละ 1 ครั้ง ลด ATK ศัตรูทุกตัว 300 ถาวร แต่เร็กซ์โจมตีไม่ได้ในเทิร์นนี้",
      "effects": [
        {
          "id": "eat_king",
          "name": "ราชาแห่งการกิน",
          "trigger": "ignition",
          "speed": 1,
          "cost": {
            "mana": 3
          },
          "limit": {
            "per": "turn",
            "key": "eat_king",
            "count": 1
          },
          "condition": [
            {
              "op": "controls",
              "filter": {
                "tag": "dino"
              },
              "min": 2
            }
          ],
          "do": [
            {
              "op": "destroy",
              "target": {
                "side": "self",
                "zone": "monster",
                "filter": {
                  "tag": "dino"
                },
                "other": true,
                "count": 1,
                "choose": "player"
              }
            },
            {
              "op": "modifyStat",
              "target": "self",
              "stat": "atk",
              "duration": "permanent",
              "requireSuccess": true,
              "amount": {
                "fromResult": "atk",
                "multiplier": 0.5
              }
            },
            {
              "op": "addMana",
              "amount": 1,
              "requireSuccess": true
            }
          ]
        },
        {
          "id": "roar_king",
          "name": "คำรามราชา",
          "trigger": "ignition",
          "speed": 1,
          "cost": {
            "mana": 1
          },
          "limit": {
            "per": "turn",
            "key": "roar_king",
            "count": 1
          },
          "do": [
            {
              "op": "modifyStat",
              "target": {
                "side": "opp",
                "zone": "monster"
              },
              "stat": "atk",
              "amount": -300,
              "duration": "permanent"
            },
            {
              "op": "cannotAttack",
              "target": "self",
              "duration": "endTurn"
            }
          ]
        }
      ]
    },
    {
      "id": "dino_spino",
      "name": "สไปโนซอรัส ราชาแห่งสายน้ำ",
      "type": "monster",
      "level": 3,
      "atk": 2600,
      "def": 2400,
      "mana": "3/0",
      "count": 2,
      "leader": true,
      "proposed_level": false,
      "tags": [
        "dino"
      ],
      "text": "เรียกพสกนิกร (3): เทิร์นละ 1 ครั้ง เรียกไดโน Lv1–2 2 ตัวจากเด็ค/สุสาน; พระราชอำนาจ (0): ขณะอยู่บนสนามและมีมานามากกว่า 5 มอนสเตอร์ศัตรูที่ ATK ต่ำกว่าสไปโนโจมตีไม่ได้",
      "effects": [
        {
          "id": "summon_subjects",
          "trigger": "ignition",
          "speed": 1,
          "cost": {
            "mana": 3
          },
          "limit": {
            "per": "turn",
            "key": "summon_subjects",
            "count": 1
          },
          "do": [
            {
              "op": "specialSummon",
              "from": [
                "deck",
                "grave"
              ],
              "filter": {
                "tag": "dino",
                "levelMin": 1,
                "levelMax": 2
              },
              "count": 2
            }
          ]
        },
        {
          "id": "royal_authority",
          "trigger": "continuous",
          "speed": 1,
          "cost": {
            "mana": 0
          },
          "condition": [
            {
              "op": "mana",
              "greaterThan": 5
            }
          ],
          "do": [
            {
              "op": "cannotAttack",
              "target": {
                "side": "opp",
                "zone": "monster",
                "filter": {
                  "atkBelowSource": true
                }
              }
            }
          ]
        }
      ]
    },
    {
      "id": "dino_nest",
      "name": "รังไดโน",
      "type": "spell",
      "mana": "1",
      "count": 1,
      "group": "normal",
      "field": true,
      "proposed_level": false,
      "tags": [
        "dino"
      ],
      "text": "ไข่ไดโนของเราฟักได้ทันทีที่ลงสนาม",
      "effects": [
        {
          "id": "nest_hatch",
          "trigger": "onSummon",
          "speed": 1,
          "cost": {
            "mana": 0
          },
          "watch": {
            "zone": "field",
            "side": "self",
            "filter": {
              "tag": "egg"
            }
          },
          "do": [
            {
              "op": "fireEffect",
              "target": "watched",
              "effectId": "hatch"
            }
          ]
        }
      ]
    },
    {
      "id": "dino_dig",
      "name": "ขุดซากฟอสซิล",
      "type": "spell",
      "mana": "1",
      "count": 1,
      "group": "normal",
      "field": false,
      "proposed_level": false,
      "tags": [
        "dino"
      ],
      "text": "เรียกไดโนจากสุสาน 1 ใบขึ้นมือ",
      "effects": [
        {
          "id": "dig",
          "trigger": "ignition",
          "speed": 1,
          "condition": [
            {
              "op": "hasCard",
              "zone": "grave",
              "filter": {
                "tag": "dino",
                "levelMin": 1
              },
              "min": 1
            }
          ],
          "cost": {
            "mana": 1
          },
          "do": [
            {
              "op": "search",
              "from": "grave",
              "filter": {
                "tag": "dino",
                "levelMin": 1
              },
              "to": "hand",
              "count": 1
            }
          ]
        }
      ]
    },
    {
      "id": "dino_fast_hatch",
      "name": "ฟักเร็ว",
      "type": "spell",
      "mana": "1",
      "count": 1,
      "group": "normal",
      "field": false,
      "proposed_level": false,
      "tags": [
        "dino"
      ],
      "text": "เลือกไข่ไดโนบนสนาม 1 ใบ ฟักทันที",
      "effects": [
        {
          "id": "fast_hatch",
          "trigger": "ignition",
          "speed": 1,
          "cost": {
            "mana": 1
          },
          "do": [
            {
              "op": "fireEffect",
              "target": {
                "side": "self",
                "zone": "monster",
                "filter": {
                  "tag": "egg"
                },
                "count": 1,
                "choose": "player"
              },
              "effectId": "hatch"
            }
          ]
        }
      ]
    },
    {
      "id": "dino_call",
      "name": "สัญญาณเรียกฝูง",
      "type": "spell",
      "mana": "1",
      "count": 2,
      "group": "normal",
      "field": false,
      "proposed_level": false,
      "tags": [
        "dino"
      ],
      "text": "ค้นมอนสเตอร์ไดโน Lv1 2 ใบ (ต่างชื่อ) ขึ้นมือ",
      "effects": [
        {
          "id": "call_search",
          "trigger": "ignition",
          "speed": 1,
          "cost": {
            "mana": 1
          },
          "do": [
            {
              "op": "search",
              "from": "deck",
              "filter": {
                "tag": "dino",
                "levelMin": 1,
                "levelMax": 1
              },
              "to": "hand",
              "count": 2,
              "distinctName": true
            }
          ]
        }
      ]
    },
    {
      "id": "dino_hunt",
      "name": "ล่าอาหาร",
      "type": "spell",
      "mana": "1",
      "count": 2,
      "group": "normal",
      "field": false,
      "proposed_level": false,
      "tags": [
        "dino"
      ],
      "text": "จั่ว 2 ใบ (ได้ +2 มานา สุทธิ +1)",
      "effects": [
        {
          "id": "hunt_draw",
          "trigger": "ignition",
          "speed": 1,
          "cost": {
            "mana": 1
          },
          "do": [
            {
              "op": "draw",
              "count": 2
            }
          ]
        }
      ]
    },
    {
      "id": "dino_fusion",
      "name": "ผสานสายพันธุ์",
      "type": "spell",
      "mana": "2",
      "count": 2,
      "group": "normal",
      "field": false,
      "proposed_level": false,
      "tags": [
        "dino"
      ],
      "text": "ใช้มอนสเตอร์ไดโนจากมือหรือสนามตามที่ Fusion ระบุเป็นวัสดุ แล้วเรียก Fusion ไดโน 1 ใบจาก Extra Deck",
      "effects": [
        {
          "id": "fusion_summon",
          "trigger": "ignition",
          "speed": 1,
          "cost": {
            "mana": 2
          },
          "condition": [
            {
              "op": "canFusionSummon",
              "filter": {
                "tag": "dino"
              },
              "materialsFrom": [
                "hand",
                "monster"
              ]
            }
          ],
          "do": [
            {
              "op": "fusionSummon",
              "filter": {
                "tag": "dino"
              },
              "materialsFrom": [
                "hand",
                "monster"
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "dino_extinct",
      "name": "สูญพันธุ์",
      "type": "spell",
      "mana": "3",
      "count": 1,
      "group": "normal",
      "field": false,
      "proposed_level": false,
      "tags": [
        "dino"
      ],
      "text": "ทำลายมอนสเตอร์ทั้งหมดบนสนามของทั้งสองฝั่ง",
      "effects": [
        {
          "id": "extinct_all",
          "trigger": "ignition",
          "speed": 1,
          "cost": {
            "mana": 3
          },
          "do": [
            {
              "op": "destroy",
              "target": {
                "side": "self",
                "zone": "monster"
              }
            },
            {
              "op": "destroy",
              "target": {
                "side": "opp",
                "zone": "monster"
              }
            }
          ]
        }
      ]
    },
    {
      "id": "dino_roar",
      "name": "เสียงคำราม",
      "type": "spell",
      "mana": "2",
      "count": 1,
      "group": "counter",
      "field": false,
      "proposed_level": false,
      "tags": [
        "dino"
      ],
      "text": "ใช้จากมือ ต้องส่งไดโนบนสนาม 1 ตัวไปสุสาน ยกเลิกการเปิดเอฟเฟกต์มอนสเตอร์ศัตรู 1 ครั้ง",
      "effects": [
        {
          "id": "roar_negate",
          "trigger": "quick",
          "speed": 3,
          "timingWindow": ["anyActivation"],
          "cost": { "mana": 2 },
          "condition": [
            { "op": "controls", "filter": { "tag": "dino" }, "min": 1 },
            { "op": "targetLink", "side": "opp" }
          ],
          "do": [
            { "op": "sendToGrave", "target": { "side": "self", "zone": "monster", "filter": { "tag": "dino" }, "count": 1, "choose": "player" } },
            { "op": "negate", "requireSuccess": true }
          ]
        }
      ]
    },
    {
      "id": "dino_escape",
      "name": "หนีรอด",
      "type": "spell",
      "mana": "1",
      "count": 2,
      "group": "counter",
      "field": false,
      "proposed_level": false,
      "tags": [
        "dino"
      ],
      "text": "ใช้จากมือ เมื่อไดโนของเราถูกโจมตี เปลี่ยนเป็นท่าป้องกันและ DEF +800 จนจบเทิร์น",
      "effects": [
        {
          "id": "escape_def",
          "trigger": "quick",
          "speed": 3,
          "timingWindow": ["attackDeclared"],
          "cost": { "mana": 1 },
          "condition": [
            { "op": "attackTarget", "side": "self", "filter": { "tag": "dino" } }
          ],
          "do": [
            { "op": "changePosition", "target": "attacked", "position": "def" },
            { "op": "modifyStat", "target": "attacked", "stat": "def", "amount": 800, "duration": "endTurn" }
          ]
        }
      ]
    },
    {
      "id": "dino_mud",
      "name": "โคลนติดหล่ม",
      "type": "spell",
      "mana": "1",
      "count": 1,
      "group": "set",
      "field": false,
      "proposed_level": false,
      "tags": [
        "dino"
      ],
      "text": "เมื่อศัตรูประกาศโจมตี มอนสเตอร์ตัวนั้นถูกบังคับเป็นท่าป้องกัน โจมตีไม่ได้ในเทิร์นนี้",
      "effects": [
        {
          "id": "mud_trap",
          "trigger": "quick",
          "speed": 2,
          "timingWindow": ["attackDeclared"],
          "cost": { "mana": 1 },
          "condition": [
            { "op": "attackDeclaredByOpp" }
          ],
          "do": [
            { "op": "changePosition", "target": "attacker", "position": "def" },
            { "op": "cannotAttack", "target": "attacker", "duration": "endTurn" }
          ]
        }
      ]
    },
    {
      "id": "dino_hidden_egg",
      "name": "ไข่ซ่อนเร้น",
      "type": "spell",
      "mana": "1",
      "count": 2,
      "group": "set",
      "field": false,
      "proposed_level": false,
      "tags": [
        "dino"
      ],
      "text": "เมื่อไดโนของเราถูกทำลาย เรียกไข่ไดโนจากเด็ค 1 ใบ",
      "effects": [
        {
          "id": "hidden_egg_summon",
          "trigger": "quick",
          "speed": 2,
          "timingWindow": ["monsterDestroyed"],
          "cost": { "mana": 1 },
          "condition": [
            { "op": "destroyedMonster", "side": "self", "filter": { "tag": "dino" } }
          ],
          "do": [
            { "op": "specialSummon", "from": ["deck"], "filter": { "cardId": "dino_egg" }, "count": 1 }
          ]
        }
      ]
    },
    {
      "id": "dino_pack_hunt",
      "name": "ฝูงล่าเหยื่อ",
      "type": "spell",
      "mana": "2",
      "count": 2,
      "group": "set",
      "field": false,
      "proposed_level": false,
      "tags": [
        "dino"
      ],
      "text": "เมื่อศัตรูประกาศโจมตี เรียกแรปเตอร์เล็ก 2 ตัวจากเด็ค/สุสาน",
      "effects": [
        {
          "id": "pack_hunt_summon",
          "trigger": "quick",
          "speed": 2,
          "timingWindow": ["attackDeclared"],
          "cost": { "mana": 2 },
          "condition": [
            { "op": "attackDeclaredByOpp" }
          ],
          "do": [
            { "op": "specialSummon", "from": ["deck", "grave"], "filter": { "cardId": "dino_small_raptor" }, "count": 2 }
          ]
        }
      ]
    }
  ],
  "extra": [
    {
      "id": "dino_tyrano_raptor",
      "name": "ไทรานโนแรปเตอร์",
      "type": "fusion",
      "level": 3,
      "atk": 2400,
      "def": 1800,
      "mana": "0",
      "materials": "ไทแรนโนซอรัสเร็กซ์ + แรปเตอร์นักล่า (จากมือหรือสนาม)",
      "materialSlots": [
        { "cardId": "dino_trex" },
        { "cardId": "dino_hunter_raptor" }
      ],
      "proposed_level": false,
      "tags": [
        "dino",
        "raptor"
      ],
      "text": "ล่าเหยื่อ (2): เมื่อเรียกสำเร็จ ทำลายมอนสเตอร์ศัตรู 1 ตัว และ ATK +500 ถาวร; ล่าอย่างไม่หยุด (0): เมื่อทำลายมอนสเตอร์ศัตรูในการต่อสู้ ATK +500 ถาวร และโจมตีได้อีก 1 ครั้ง เทิร์นละ 1 ครั้ง",
      "effects": [
        {
          "id": "hunt_prey",
          "trigger": "onSummon",
          "speed": 1,
          "cost": {
            "mana": 2
          },
          "do": [
            {
              "op": "destroy",
              "target": {
                "side": "opp",
                "zone": "monster",
                "count": 1,
                "choose": "player"
              }
            },
            {
              "op": "modifyStat",
              "target": "self",
              "stat": "atk",
              "amount": 500,
              "duration": "permanent"
            }
          ]
        },
        {
          "id": "hunt_endless",
          "trigger": "onBattleDestroy",
          "speed": 1,
          "cost": {
            "mana": 0
          },
          "limit": {
            "per": "turn",
            "key": "hunt_endless",
            "count": 1
          },
          "do": [
            {
              "op": "modifyStat",
              "target": "self",
              "stat": "atk",
              "amount": 500,
              "duration": "permanent"
            },
            {
              "op": "extraAttack",
              "target": "self",
              "count": 1
            }
          ]
        }
      ]
    },
    {
      "id": "dino_raptor_swarm",
      "name": "แรปเตอร์ฝูงผสาน",
      "type": "fusion",
      "level": 2,
      "atk": 1500,
      "def": 1000,
      "mana": "0",
      "materials": "มอนสเตอร์ชื่อมีคำว่า แรปเตอร์ 1 ตัว + มอนสเตอร์ Lv1 1 ตัว",
      "materialSlots": [
        { "tag": "raptor" },
        { "level": 1 }
      ],
      "proposed_level": false,
      "tags": [
        "dino",
        "raptor"
      ],
      "text": "ฝูงนักล่า (1): เมื่อเรียกสำเร็จ เรียกแรปเตอร์เล็ก 1 ตัวจากเด็คหรือสุสาน",
      "effects": [
        {
          "id": "pack_summon",
          "trigger": "onSummon",
          "speed": 1,
          "cost": {
            "mana": 1
          },
          "do": [
            {
              "op": "specialSummon",
              "from": [
                "deck",
                "grave"
              ],
              "filter": {
                "cardId": "dino_small_raptor"
              },
              "count": 1
            }
          ]
        }
      ]
    },
    {
      "id": "dino_brachio",
      "name": "บราคิโอซอรัสผู้ทอดเงา",
      "type": "fusion",
      "level": 3,
      "atk": 1800,
      "def": 3000,
      "mana": "0",
      "materials": "มอนสเตอร์ไดโน Lv2 2 ตัวที่ชื่อต่างกัน",
      "materialSlots": [
        { "tag": "dino", "level": 2 },
        { "tag": "dino", "level": 2 }
      ],
      "distinctNames": true,
      "materialConstraint": {
        "distinctNames": true
      },
      "proposed_level": false,
      "tags": [
        "dino"
      ],
      "text": "เงาทอดยาว (0): ฝ่ายตรงข้ามต้องโจมตีมอนสเตอร์นี้ก่อนตัวอื่น; กินยอดไม้สูง (0): ไม่ถูกทำลายจากการต่อสู้ขณะอยู่ในท่าป้องกัน",
      "effects": [
        {
          "id": "shadows",
          "trigger": "continuous",
          "speed": 1,
          "cost": {
            "mana": 0
          },
          "do": [
            {
              "op": "restrictAttack",
              "target": "self"
            },
            {
              "op": "preventDestruction",
              "condition": [
                {
                  "op": "selfPosition",
                  "position": "def"
                },
                {
                  "op": "cause",
                  "cause": "battle"
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "dino_mega_tyrant",
      "name": "เมกะไทแรนต์",
      "type": "grade4",
      "level": 3,
      "atk": 3000,
      "def": 2000,
      "mana": "0",
      "materials": "นำไข่ไดโน 3 ใบจากสุสานกลับเด็ค + วางทับมอนสเตอร์ไดโนบนสนาม",
      "proposed_level": true,
      "tags": [
        "dino"
      ],
      "extraSummon": {
        "onto": {
          "tag": "dino"
        },
        "cost": [
          {
            "op": "returnToDeck",
            "target": {
              "side": "self",
              "zone": "grave",
              "filter": {
                "cardId": "dino_egg"
              },
              "count": 3
            },
            "shuffle": true
          }
        ]
      },
      "immune": {
        "source": "spell"
      },
      "text": "เงื่อนไข: เอาไข่ไดโน 3 ใบจากสุสานกลับเข้าเด็ค (สับเด็ค) แล้วเรียกลงทับมอนสเตอร์ไดโนของเรา 1 ตัว เอฟเฟกต์ (0): ไม่รับผลของการ์ดสเปลทุกใบ จบเทิร์น: กลับ Extra Deck และทำลายมอนสเตอร์ที่ถูกทับอยู่ใต้มัน (ข้อสมมติ ยังไม่ยืนยัน)",
      "effects": [
        {
          "id": "destroy_under_on_end",
          "trigger": "onEndPhase",
          "speed": 1,
          "cost": {
            "mana": 0
          },
          "do": [
            {
              "op": "destroy",
              "target": {
                "zone": "under"
              }
            }
          ]
        }
      ]
    }
  ]
};
})();

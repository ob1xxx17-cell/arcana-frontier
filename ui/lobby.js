// ui/lobby.js - ล็อบบี้ธีมโต๊ะกระดาษ V2 (Lobby 1.0) รองรับการเชื่อมต่อข้อมูลเกมเต็มรูปแบบ
(function(global) {
  'use strict';

  let currentPackIdx = 0;
  let isSoundMuted = false;
  const _handlers = [];

  // API สะพานสำหรับรองรับ event lobby1.0.html
  global.Lobby = {
    on: function(fn) {
      if (typeof fn === 'function') _handlers.push(fn);
    },
    _dispatch: function(action) {
      _handlers.forEach(function(fn) {
        try { fn(action); } catch (e) { console.error(e); }
      });
    }
  };

  function showToast(msg) {
    const existing = document.querySelector('.lb-toast');
    if (existing) existing.remove();
    const t = document.createElement('div');
    t.className = 'lb-toast';
    t.textContent = msg || (global.STRINGS_LOBBY && global.STRINGS_LOBBY.toast && global.STRINGS_LOBBY.toast.comingSoon) || 'เร็วๆ นี้';
    t.onclick = function() { t.remove(); };
    document.body.appendChild(t);
    setTimeout(function() { if (t.parentNode) t.remove(); }, 2300);
  }

  function updateScale() {
    const stage = document.getElementById('lbStage');
    if (!stage) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    let k, oy;

    if (w / h < 1.6) {
      k = Math.min(w / 1376, h / 768);
      oy = (h - 768 * k) / 2;
    } else {
      k = Math.min(Math.max(w / 1376, h / 768), h / 690);
      const hv = h / k;
      oy = hv >= 768 ? (h - 768 * k) / 2 : -(768 - hv) * 0.55 * k;
    }

    stage.style.transform = 'translate(' + ((w - 1376 * k) / 2) + 'px,' + oy + 'px) scale(' + k + ')';

    const rotateOverlay = document.getElementById('lbRotateNotice');
    if (rotateOverlay) {
      rotateOverlay.style.display = (h > w) ? 'flex' : 'none';
    }
  }

  function render(container) {
    const S = global.STRINGS_LOBBY || {
      profile: { name: 'ADVENTURER_123', id: '45678', level: 1, hint: 'แตะเพื่อดูสถิติและโปรไฟล์' },
      onlineStatus: { count: 1, format: function(n) { return 'ออนไลน์: ' + n + ' คน'; } },
      currencies: { gold: 950, ticket: 50 },
      news: { caption: 'ฮีโร่ใหม่เข้าร่วมศึก!' },
      shop: {
        title: 'ร้านค้า',
        packs: [
          { id: 'mecha_strike', name: "Dragon's Hoard Cards" },
          { id: 'mecha_scrap', name: 'Mecha Scrap Workshop' },
          { id: 'luna_guardians', name: 'Luna Celestial Guardians' }
        ]
      },
      buttons: {
        playBot: 'เล่นกับบอท',
        startGame: 'เริ่มเกม',
        onlineSub: 'ออนไลน์',
        quiz: 'แบบทดสอบ',
        missions: 'ภารกิจ',
        collection: 'คลังการ์ด',
        deckBuilder: 'จัดเด็ค',
        addFriend: 'เพื่อน',
        announcement: 'ประกาศ',
        mailbox: 'จดหมาย',
        giftCode: 'รหัสของขวัญ'
      },
      rotateNotice: 'หมุนจอเป็นแนวนอน'
    };

    // เชื่อมต่อข้อมูลบัญชีผู้เล่นจริง
    const acc = (global.Account && (typeof global.Account.getProfile === 'function' ? global.Account.getProfile() : global.Account.current)) || {};
    const playerName = (global.Account && typeof global.Account.getNickname === 'function' ? global.Account.getNickname() : acc.nickname) || S.profile.name;
    const playerId = (global.Account && typeof global.Account.getId === 'function' ? global.Account.getId() : acc.id) || S.profile.id;
    const playerLv = (global.Account && typeof global.Account.getLevel === 'function' ? global.Account.getLevel() : acc.level) || S.profile.level;
    const onlineCount = (global.CG && global.CG.network && global.CG.network.onlineCount) ? global.CG.network.onlineCount : S.onlineStatus.count;
    const curr20Val = (global.Account && typeof global.Account.getCoins === 'function' ? global.Account.getCoins() : (global.CG && global.CG.ui && global.CG.ui.curr20 !== undefined ? global.CG.ui.curr20 : (acc.curr20 !== undefined ? acc.curr20 : S.currencies.gold)));
    const curr100Val = (global.Account && typeof global.Account.getTickets === 'function' ? global.Account.getTickets() : (global.CG && global.CG.ui && global.CG.ui.curr100 !== undefined ? global.CG.ui.curr100 : (acc.curr100 !== undefined ? acc.curr100 : S.currencies.ticket)));

    const packs = (S.shop && S.shop.packs) || [
      { id: 'mecha_strike', name: "Dragon's Hoard Cards" },
      { id: 'mecha_scrap', name: 'Mecha Scrap Workshop' },
      { id: 'luna_guardians', name: 'Luna Celestial Guardians' }
    ];
    if (currentPackIdx >= packs.length) currentPackIdx = 0;
    const currentPack = packs[currentPackIdx];

    const soundEnabled = global.AudioFX ? global.AudioFX.isEnabled() : !isSoundMuted;

    const html =
      '<div class="lb-viewport wrap">' +
        '<!-- หมุนจอเป็นแนวนอนสำหรับมือถือ -->' +
        '<div id="lbRotateNotice" class="lb-rotate-overlay">' +
          '<div class="lb-rotate-icon">📱 ↷ 🔄</div>' +
          '<div>' + S.rotateNotice + '</div>' +
        '</div>' +

        '<!-- แผ่นกระดาษตัดฉีก Polygon แท้ -->' +
        '<div class="lb-sheet sheet"></div>' +

        '<!-- เวทีมาตรฐาน 1376x768 -->' +
        '<div id="lbStage" class="lb-stage">' +
          '<!-- ปีกโต๊ะไม้ซ้าย-ขวาสำหรับจอกว้าง -->' +
          '<div class="lb-abs abs lb-flank-l" style="left:-170px;top:0;width:170px;height:768px;"></div>' +
          '<div class="lb-abs abs lb-flank-r" style="left:1376px;top:0;width:170px;height:768px;"></div>' +

          '<!-- กลุ่มซ้าย -->' +
          '<div class="lb-g g" id="gl">' +
            '<!-- การ์ดโปรไฟล์ -->' +
            '<img class="lb-abs abs" src="ui/assets/lobby/v2_profile_card.png" style="left:105px;top:56px;" alt="การ์ดโปรไฟล์">' +
            '<div class="lb-abs lb-t abs t lb-nm nm" id="lbProfileName" style="left:254px;top:80px;width:250px;font-size:27px;">' + playerName + '</div>' +
            '<div class="lb-abs lb-t abs t lb-nm nm" id="lbProfileId" style="left:254px;top:134px;width:250px;font-size:26px;">ID: ' + playerId + '</div>' +
            '<div class="lb-abs lb-t abs t lb-sm sm" style="left:254px;top:172px;width:260px;font-size:14px;">' + S.profile.hint + '</div>' +
            '<div class="lb-abs lb-t abs t lb-c c lb-on on" id="lobbyOnlineCount" style="left:258px;top:194px;width:175px;font-size:19px;">' + (typeof S.onlineStatus.format === 'function' ? S.onlineStatus.format(onlineCount) : ('ออนไลน์: ' + onlineCount + ' คน')) + '</div>' +
            '<button class="lb-hit hit" id="btnProfile" data-action="profile" style="left:105px;top:56px;width:447px;height:172px;" aria-label="โปรไฟล์"></button>' +

            '<!-- ข้อความภาพโพลารอยด์ -->' +
            '<div class="lb-abs lb-cap abs cap" id="lbNewsCaption">' + S.news.caption + '</div>' +
            '<button class="lb-hit hit" id="newsBillboard" data-action="news" style="left:180px;top:262px;width:370px;height:262px;transform:rotate(-7deg);" aria-label="ข่าวสาร"></button>' +

            '<!-- 4 ปุ่มเมนูล่าง -->' +
            '<img class="lb-abs abs" src="ui/assets/lobby/v2_feat_quiz.png" style="left:128px;top:554px;" alt="">' +
            '<div class="lb-abs lb-t abs t lb-c c lb-nm nm lb-tl tl" style="left:134px;top:648px;width:122px;font-size:19px;">' + S.buttons.quiz + '</div>' +
            '<button class="lb-hit hit" id="btnNavTrials" data-action="quiz" style="left:128px;top:554px;width:134px;height:140px;" aria-label="' + S.buttons.quiz + '"></button>' +

            '<img class="lb-abs abs" src="ui/assets/lobby/v2_feat_missions.png" style="left:266px;top:554px;" alt="">' +
            '<div class="lb-abs lb-t abs t lb-c c lb-nm nm lb-tl tl" style="left:272px;top:648px;width:122px;font-size:19px;">' + S.buttons.missions + '</div>' +
            '<button class="lb-hit hit" id="btnNavMissions" data-action="missions" style="left:266px;top:554px;width:134px;height:140px;" aria-label="' + S.buttons.missions + '"></button>' +

            '<img class="lb-abs abs" src="ui/assets/lobby/v2_feat_codex.png" style="left:405px;top:554px;" alt="">' +
            '<div class="lb-abs lb-t abs t lb-c c lb-nm nm lb-tl tl" style="left:411px;top:648px;width:122px;font-size:19px;">' + S.buttons.collection + '</div>' +
            '<button class="lb-hit hit" id="btnNavCodex" data-action="collection" style="left:405px;top:554px;width:134px;height:140px;" aria-label="' + S.buttons.collection + '"></button>' +

            '<img class="lb-abs abs" src="ui/assets/lobby/v2_feat_deck.png" style="left:544px;top:554px;" alt="">' +
            '<div class="lb-abs lb-t abs t lb-c c lb-nm nm lb-tl tl" style="left:550px;top:648px;width:122px;font-size:19px;">' + S.buttons.deckBuilder + '</div>' +
            '<button class="lb-hit hit" id="btnNavDeck" data-action="deck" style="left:544px;top:554px;width:134px;height:140px;" aria-label="' + S.buttons.deckBuilder + '"></button>' +
          '</div>' +

          '<!-- กลุ่มขวา -->' +
          '<div class="lb-g g" id="gr">' +
            '<!-- ปุ่มสี่เหลี่ยมด้านบน 4 ปุ่ม -->' +
            '<img class="lb-abs abs" src="ui/assets/lobby/v2_btn_friend.png" style="left:614px;top:60px;" alt="">' +
            '<button class="lb-hit hit" id="btnTopFriend" data-action="friends" style="left:614px;top:60px;width:68px;height:68px;" aria-label="' + S.buttons.addFriend + '"></button>' +

            '<img class="lb-abs abs" src="ui/assets/lobby/v2_btn_notice.png" style="left:699px;top:60px;" alt="">' +
            '<button class="lb-hit hit" id="btnTopNotice" data-action="announce" style="left:699px;top:60px;width:68px;height:68px;" aria-label="' + S.buttons.announcement + '"></button>' +

            '<img class="lb-abs abs" src="ui/assets/lobby/v2_btn_mail.png" style="left:784px;top:60px;" alt="">' +
            '<button class="lb-hit hit" id="btnTopMail" data-action="mail" style="left:784px;top:60px;width:68px;height:68px;" aria-label="' + S.buttons.mailbox + '"></button>' +

            '<img class="lb-abs abs" src="ui/assets/lobby/v2_btn_gift.png" style="left:868px;top:60px;" alt="">' +
            '<button class="lb-hit hit" id="btnTopRedeem" data-action="giftcode" style="left:868px;top:60px;width:68px;height:68px;" aria-label="' + S.buttons.giftCode + '"></button>' +

            '<!-- สกุลเงิน -->' +
            '<img class="lb-abs abs" src="ui/assets/lobby/v2_badge_coin.png" style="left:956px;top:64px;" alt="">' +
            '<div class="lb-abs lb-t abs t lb-nm nm lb-c c lb-pillt pillt" id="valCurr20" style="left:1008px;top:77px;width:56px;font-size:25px;">' + curr20Val + '</div>' +
            '<button class="lb-hit hit" id="btnCurrGreen" data-action="currency_coin" style="left:956px;top:64px;width:110px;height:50px;" aria-label="เหรียญ"></button>' +

            '<img class="lb-abs abs" src="ui/assets/lobby/v2_badge_ticket.png" style="left:1078px;top:64px;" alt="">' +
            '<div class="lb-abs lb-t abs t lb-nm nm lb-c c lb-pillt pillt" id="valCurr100" style="left:1144px;top:77px;width:40px;font-size:25px;">' + curr100Val + '</div>' +
            '<button class="lb-hit hit" id="btnCurrRed" data-action="currency_ticket" style="left:1078px;top:64px;width:110px;height:50px;" aria-label="ตั๋ว"></button>' +

            '<!-- ปุ่มเปิด/ปิดเสียง -->' +
            '<img class="lb-abs abs" src="ui/assets/lobby/v2_btn_sound.png" style="left:1214px;top:54px;" alt="">' +
            '<button class="lb-hit hit" id="btnLobbySound" data-action="sound" style="left:1214px;top:54px;width:78px;height:78px;" aria-label="เสียง">' +
              '<div class="lb-sound-mute-line" id="lbSoundMuteLine" style="display:' + (soundEnabled ? 'none' : 'block') + ';"></div>' +
            '</button>' +

            '<!-- แผงร้านค้า -->' +
            '<img class="lb-abs abs" src="ui/assets/lobby/v2_shop_panel.png" style="left:718px;top:168px;" alt="">' +
            '<div class="lb-abs lb-t abs t lb-c c lb-nm nm" style="left:741px;top:255px;width:500px;font-size:46px;">' + S.shop.title + '</div>' +
            '<div class="lb-abs lb-t abs t lb-c c lb-nm nm" id="lbShopPackName" style="left:741px;top:322px;width:500px;font-size:29px;">' + currentPack.name + '</div>' +
            '<button class="lb-hit hit" id="btnShopPrev" data-action="shop_prev" style="left:722px;top:250px;width:70px;height:80px;" aria-label="ก่อนหน้า"></button>' +
            '<button class="lb-hit hit" id="btnShopNext" data-action="shop_next" style="left:1192px;top:250px;width:70px;height:80px;" aria-label="ถัดไป"></button>' +
            '<button class="lb-hit hit" id="btnShop" data-action="shop" style="left:792px;top:168px;width:398px;height:236px;" aria-label="ดูแพ็ก"></button>' +

            '<!-- ปุ่มเล่นกับบอท -->' +
            '<img class="lb-abs abs" src="ui/assets/lobby/v2_btn_bot.png" style="left:744px;top:430px;" alt="">' +
            '<div class="lb-abs lb-t abs t lb-c c lb-wh wh" style="left:930px;top:449px;width:200px;font-size:38px;">' + S.buttons.playBot + '</div>' +
            '<button class="lb-hit hit" id="btnPlayBot" data-action="bot" style="left:744px;top:430px;width:486px;height:106px;" aria-label="' + S.buttons.playBot + '"></button>' +

            '<!-- ปุ่มเริ่มเกม (ออนไลน์) -->' +
            '<img class="lb-abs abs" src="ui/assets/lobby/v2_btn_start.png" style="left:742px;top:544px;" alt="">' +
            '<div class="lb-abs lb-t abs t lb-c c lb-nm nm" style="left:880px;top:572px;width:310px;font-size:56px;">' + S.buttons.startGame + '</div>' +
            '<div class="lb-abs lb-t abs t lb-c c lb-nm nm" style="left:880px;top:628px;width:310px;font-size:26px;">(' + S.buttons.onlineSub + ')</div>' +
            '<button class="lb-hit hit" id="btnPlayPvp" data-action="start" style="left:742px;top:544px;width:490px;height:156px;" aria-label="' + S.buttons.startGame + '"></button>' +
          '</div>' +
        '</div>' +
      '</div>';

    container.innerHTML = html;
    updateScale();
    bindEvents(container, packs);
  }

  function bindEvents(container, packs) {
    const playClick = function() {
      if (global.AudioFX && typeof global.AudioFX.play === 'function') {
        global.AudioFX.play('click');
      }
    };

    container.onclick = function(e) {
      const b = e.target.closest('[data-action], button, .hit');
      if (!b) return;

      const a = b.getAttribute('data-action') || b.id;

      // ส่งอีเวนต์เข้าสู่ระบบ lobby:action เพื่อรองรับสคริปต์ภายนอก
      if (a) {
        window.dispatchEvent(new CustomEvent('lobby:action', { detail: { action: a } }));
        if (global.Lobby && typeof global.Lobby._dispatch === 'function') {
          global.Lobby._dispatch(a);
        }
      }

      // เปลี่ยนแพ็กการ์ดในร้านค้า (ก่อนหน้า)
      if (a === 'shop_prev' || b.id === 'btnShopPrev') {
        currentPackIdx = (currentPackIdx - 1 + packs.length) % packs.length;
        const nameEl = document.getElementById('lbShopPackName');
        if (nameEl) nameEl.textContent = packs[currentPackIdx].name;
        playClick();
        return;
      }

      // เปลี่ยนแพ็กการ์ดในร้านค้า (ถัดไป)
      if (a === 'shop_next' || b.id === 'btnShopNext') {
        currentPackIdx = (currentPackIdx + 1) % packs.length;
        const nameEl = document.getElementById('lbShopPackName');
        if (nameEl) nameEl.textContent = packs[currentPackIdx].name;
        playClick();
        return;
      }

      // เปิด/ปิดเสียง
      if (a === 'sound' || b.id === 'btnLobbySound') {
        let en = false;
        if (global.AudioFX && typeof global.AudioFX.toggle === 'function') {
          en = global.AudioFX.toggle();
        } else {
          isSoundMuted = !isSoundMuted;
          en = !isSoundMuted;
        }
        const line = document.getElementById('lbSoundMuteLine');
        if (line) line.style.display = en ? 'none' : 'block';
        if (en && global.AudioFX && typeof global.AudioFX.play === 'function') {
          global.AudioFX.play('chime');
        }
        return;
      }

      // ปุ่มเล่นกับบอท
      if (a === 'bot' || b.id === 'btnPlayBot') {
        playClick();
        if (typeof global.openBotModal === 'function') {
          global.openBotModal();
        } else if (global.CG && global.CG.ui && typeof global.CG.ui.openBotModal === 'function') {
          global.CG.ui.openBotModal();
        } else {
          showToast('กำลังเตรียมโหมดบอท...');
        }
        return;
      }

      // ปุ่มเริ่มเกม (ออนไลน์)
      if (a === 'start' || b.id === 'btnPlayPvp') {
        playClick();
        if (typeof global.openPvpModal === 'function') {
          global.openPvpModal();
        } else if (global.CG && global.CG.ui && typeof global.CG.ui.openPvpModal === 'function') {
          global.CG.ui.openPvpModal();
        } else {
          showToast('เร็วๆ นี้');
        }
        return;
      }

      // แบบทดสอบ (Trials)
      if (a === 'quiz' || b.id === 'btnNavTrials') {
        playClick();
        if (typeof global.openTrialsModal === 'function') {
          global.openTrialsModal();
        } else if (global.CG && global.CG.ui && typeof global.CG.ui.openTrialsModal === 'function') {
          global.CG.ui.openTrialsModal();
        } else {
          showToast('เร็วๆ นี้');
        }
        return;
      }

      // ภารกิจ (Missions)
      if (a === 'missions' || b.id === 'btnNavMissions') {
        playClick();
        if (typeof global.openMissionsModal === 'function') {
          global.openMissionsModal();
        } else if (global.CG && global.CG.ui && typeof global.CG.ui.openMissionsModal === 'function') {
          global.CG.ui.openMissionsModal();
        } else {
          showToast('เร็วๆ นี้');
        }
        return;
      }

      // คลังการ์ด (Codex / Collection)
      if (a === 'collection' || b.id === 'btnNavCodex') {
        playClick();
        if (typeof global.openCodexModal === 'function') {
          global.openCodexModal();
        } else if (global.CG && global.CG.ui && typeof global.CG.ui.openCodexModal === 'function') {
          global.CG.ui.openCodexModal();
        } else {
          showToast('เร็วๆ นี้');
        }
        return;
      }

      // จัดเด็ค (Deck Builder)
      if (a === 'deck' || b.id === 'btnNavDeck') {
        playClick();
        if (global.CG && global.CG.ui && global.CG.ui.deckBuilder && typeof global.CG.ui.deckBuilder.open === 'function') {
          const curDeck = (global.CG && global.CG.currentDeckA) || 'dinosaur';
          global.CG.ui.deckBuilder.open(curDeck, function(chosenKey) {
            if (chosenKey && global.CG && global.CG.cards && global.CG.cards[chosenKey]) {
              global.CG.currentDeckA = chosenKey;
            }
            if (typeof global.lobby === 'function') global.lobby();
          });
        } else if (typeof global.openDeckBuilder === 'function') {
          global.openDeckBuilder();
        } else {
          showToast('เร็วๆ นี้');
        }
        return;
      }

      // เปิดร้านค้าการ์ด
      if (a === 'shop' || b.id === 'btnShop') {
        playClick();
        const packKey = (packs[currentPackIdx] && packs[currentPackIdx].id) || 'mecha_strike';
        if (typeof global.openShopModal === 'function') {
          global.openShopModal(packKey);
        } else if (global.CG && global.CG.ui && typeof global.CG.ui.openShopModal === 'function') {
          global.CG.ui.openShopModal(packKey);
        } else {
          showToast('เร็วๆ นี้');
        }
        return;
      }

      // คลิกป้ายเหรียญ / ตั๋ว
      if (a === 'currency_coin' || a === 'currency_ticket' || b.id === 'btnCurrGreen' || b.id === 'btnCurrRed') {
        playClick();
        const packKey = (packs[currentPackIdx] && packs[currentPackIdx].id) || 'mecha_strike';
        if (typeof global.openShopModal === 'function') {
          global.openShopModal(packKey);
        } else {
          showToast('เร็วๆ นี้');
        }
        return;
      }

      // ใส่โค้ดของขวัญ
      if (a === 'giftcode' || b.id === 'btnTopRedeem') {
        playClick();
        if (typeof global.openRedeemCodeModal === 'function') {
          global.openRedeemCodeModal();
        } else {
          showToast('เร็วๆ นี้');
        }
        return;
      }

      // เพิ่มเพื่อน
      if (a === 'friends' || b.id === 'btnTopFriend') {
        playClick();
        if (typeof global.openFriendModal === 'function') {
          global.openFriendModal();
        } else {
          showToast('เร็วๆ นี้');
        }
        return;
      }

      // ประกาศ
      if (a === 'announce' || b.id === 'btnTopNotice') {
        playClick();
        if (typeof global.openNoticeModal === 'function') {
          global.openNoticeModal();
        } else {
          showToast('เร็วๆ นี้');
        }
        return;
      }

      // กล่องจดหมาย
      if (a === 'mail' || b.id === 'btnTopMail') {
        playClick();
        if (typeof global.openMailModal === 'function') {
          global.openMailModal();
        } else {
          showToast('เร็วๆ นี้');
        }
        return;
      }

      // ข่าวสารโพลารอยด์
      if (a === 'news' || b.id === 'newsBillboard') {
        playClick();
        if (typeof global.openNoticeModal === 'function') {
          global.openNoticeModal();
        } else {
          showToast('ฮีโร่ใหม่เข้าร่วมศึก!');
        }
        return;
      }

      // โปรไฟล์ผู้เล่น
      if (a === 'profile' || b.id === 'btnProfile') {
        playClick();
        if (typeof global.openProfileModal === 'function') {
          global.openProfileModal();
        } else {
          showToast('แตะเพื่อดูสถิติและโปรไฟล์');
        }
        return;
      }
    };
  }

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('resize', updateScale);
    window.addEventListener('orientationchange', updateScale);
  }

  const LobbyModule = {
    render: render,
    updateScale: updateScale,
    showToast: showToast,
    getCurrentPack: function() {
      const S = global.STRINGS_LOBBY;
      return S && S.shop && S.shop.packs ? S.shop.packs[currentPackIdx] : null;
    }
  };

  global.CG = global.CG || {};
  global.CG.lobby = LobbyModule;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LobbyModule;
  }
})(typeof window !== 'undefined' ? window : globalThis);

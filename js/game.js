/* TNT Brothers: the game itself. Menus, the world map, input (keyboard and touch), the HUD, sound and the main
   loop. The rules live in engine.js and the drawing in world.js; this file connects them.
   Console hooks: window.game (see the bottom of this file and the README). */
(function () {
  'use strict';
  const TNT = window.TNT;
  const E = TNT.engine;
  const sfx = TNT.sfx;
  const TITLE = window.TNT_TITLE;
  const $ = (id) => document.getElementById(id);
  const show = (id, on) => $(id).classList.toggle('hidden', !on);
  const LEVELS = window.TNT_LEVELS;
  const N = LEVELS.length;
  const WORLDS = [
    { theme: 'park', name: 'BACKYARD & PARK', levels: [0, 1, 2] },
    { theme: 'subway', name: 'UNDER THE SUBWAY', levels: [3, 4] },
    { theme: 'sky', name: 'SKY & TREETOPS', levels: [5, 6, 7] },
    { theme: 'castle', name: 'ZOMBIE CASTLE', levels: [8, 9] },
  ];
  const TREATS = [['🍦', 'ICE CREAM'], ['💧', 'WATER'], ['🧃', 'JUICE BOX'], ['🍪', 'COOKIE'], ['🍉', 'WATERMELON'], ['🍌', 'BANANA']];

  // ---------------------------------------------------------------- saving
  const KEY = 'tntBrothers.v1';
  const save = Object.assign({ unlocked: 1, best: {}, easy: true, ch: 'teddy', cleared: {} }, (() => {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  })());
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* private mode */ } };

  // ---------------------------------------------------------------- app state
  const app = {
    mode: 'title', // title | pick | map | intro | play | pause | oops | clear | over | end
    S: null, li: 0, sel: 0, players: '1p', ch: save.ch, easy: save.easy,
    session: null, // lives, coins and power carried from level to level
    demo: null, demoFrame: 0, held: false, autoPause: true, acc: 0, timer: 0, inputMode: 'keys',
    virtual: [{}, {}], // inputs set from the console (game.input)
    streak: 0, streakT: 0, lowWarned: false, twinkleT: 0, bannerT: 0,
  };

  const canvas = $('game');
  const world = new TNT.World(canvas);
  world.onSwish = () => { sfx('swish'); world.text('SWISH!', world.camX, 9, '#ffd400'); };
  const faces = Kit.portraits(['teddy', 'tommy'].map((id) => Kit.roster.get(id)), { size: 160 });

  document.title = TITLE;
  $('logo').innerHTML = TITLE.replace(/^(\S+)\s+(.*)$/, '$1<span>$2</span>').toUpperCase();
  document.querySelectorAll('.card').forEach((c) => (c.querySelector('img').src = faces[c.dataset.ch]));

  function resize() {
    const w = window.innerWidth || document.documentElement.clientWidth || 1280;
    const h = window.innerHeight || document.documentElement.clientHeight || 720;
    world.resize(w, h);
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------------------------------------------------------------- input
  const keys = new Set();
  const P1 = {
    l: ['KeyA', 'ArrowLeft'], r: ['KeyD', 'ArrowRight'], d: ['KeyS', 'ArrowDown'], j: ['Space', 'KeyW', 'ArrowUp'],
    run: ['ShiftLeft', 'ShiftRight'], th: ['KeyF'],
  };
  const P2 = { l: ['KeyJ'], r: ['KeyL'], d: ['KeyK'], j: ['KeyU', 'KeyI'], run: ['KeyH', 'Semicolon'], th: ['KeyO'] };
  const touch = { l: false, r: false, d: false, j: false, th: false, holdT: 0 };

  function readKeys(map) {
    const o = {};
    for (const k in map) o[k] = map[k].some((c) => keys.has(c));
    return o;
  }

  function inputs() {
    const a = readKeys(P1), b = readKeys(P2);
    const t = { l: touch.l, r: touch.r, d: touch.d, j: touch.j, th: touch.th, run: touch.holdT > 0.6 };
    const v = app.virtual;
    const or = (...xs) => {
      const o = {};
      for (const x of xs) for (const k in x) o[k] = o[k] || !!x[k];
      return o;
    };
    if (app.players === '2p') {
      // in co-op, Shift is only player 1's run (player 2 runs with H or ;)
      a.run = keys.has('ShiftLeft') || keys.has('ShiftRight');
      return [or(a, t, v[0]), or(b, v[1])];
    }
    return [or(a, b, t, v[0])];
  }

  const GAME_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  window.addEventListener('keydown', (e) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    const fresh = !keys.has(e.code);
    keys.add(e.code);
    if (app.inputMode !== 'keys') {
      app.inputMode = 'keys';
      show('touch', false);
    }
    Kit.sound.init();
    if (fresh) onKey(e.code, e);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  function onKey(code) {
    if (code === 'KeyM') return toggleMute();
    switch (app.mode) {
      case 'title':
        if (code === 'Enter' || code === 'Digit1' || code === 'Space') return go1p();
        if (code === 'Digit2') return go2p();
        if (code === 'ArrowLeft' || code === 'ArrowRight' || code === 'KeyE' || code === 'KeyN') return setEasy(code === 'ArrowLeft' || code === 'KeyE');
        return;
      case 'pick':
        if (code === 'ArrowLeft' || code === 'KeyA') return pickSel('teddy');
        if (code === 'ArrowRight' || code === 'KeyD') return pickSel('tommy');
        if (code === 'Enter' || code === 'Space' || code === 'KeyF') return pickGo(app.ch);
        if (code === 'Escape') return toTitle();
        return;
      case 'map':
        if (code === 'ArrowLeft' || code === 'ArrowUp' || code === 'KeyA' || code === 'KeyW') return mapSel(app.sel - 1);
        if (code === 'ArrowRight' || code === 'ArrowDown' || code === 'KeyD' || code === 'KeyS') return mapSel(app.sel + 1);
        if (code === 'Enter' || code === 'Space') return mapGo();
        if (code === 'Escape') return mapBack();
        return;
      case 'play':
      case 'intro':
        if (code === 'KeyP' || code === 'Escape') return pause(true);
        if (code === 'KeyT' || code === 'KeyY' || code === 'Enter') return callBuddy();
        return;
      case 'pause':
        if (code === 'KeyP' || code === 'Escape' || code === 'Enter') return pause(false);
        if (code === 'KeyR') return restartLevel();
        return;
      case 'clear':
        if (code === 'Enter' || code === 'Space') return nextLevel();
        if (code === 'Escape' || code === 'KeyM') return toMap();
        return;
      case 'over':
        if (code === 'Enter' || code === 'Space') return retryAfterOver();
        if (code === 'Escape') return toMap();
        return;
      case 'end':
        if (code === 'Enter' || code === 'Escape' || code === 'Space') return toMap();
    }
  }

  // touch buttons: hold ◀ or ▶ for a moment and you start running
  function touchBtn(id, on, off) {
    const el = $(id);
    const down = (e) => {
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
      el.classList.add('down');
      Kit.sound.init();
      on();
    };
    const up = (e) => {
      e.preventDefault();
      el.classList.remove('down');
      off();
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
  }
  touchBtn('tLeft', () => { touch.l = true; touch.holdT = 0; }, () => { touch.l = false; });
  touchBtn('tRight', () => { touch.r = true; touch.holdT = 0; }, () => { touch.r = false; });
  touchBtn('tDown', () => { touch.d = true; }, () => { touch.d = false; });
  touchBtn('tJump', () => { touch.j = true; }, () => { touch.j = false; });
  touchBtn('tThrow', () => { touch.th = true; }, () => { touch.th = false; });
  window.addEventListener('pointerdown', (e) => {
    Kit.sound.init();
    if (e.pointerType === 'touch' && app.inputMode !== 'touch') {
      app.inputMode = 'touch';
      updateTouchVisibility();
    }
  }, true);

  function tapBtn(id, fn) {
    $(id).addEventListener('click', (e) => {
      e.stopPropagation();
      Kit.sound.init();
      sfx('click');
      fn(e);
      $(id).blur();
    });
  }

  // ---------------------------------------------------------------- menus
  function setScreen(mode) {
    app.mode = mode;
    for (const id of ['title', 'pick', 'map', 'pause', 'clear', 'over', 'end']) show(id, id === mode);
    const playing = mode === 'play' || mode === 'intro' || mode === 'pause' || mode === 'oops';
    show('hud', playing || mode === 'clear');
    if (!playing) {
      $('banner').classList.remove('show');
      $('tip').classList.add('off');
    }
    updateTouchVisibility();
    Kit.sound.music(mode === 'play' || mode === 'intro' ? 'play' : mode === 'pause' ? 'pause' : 'title');
  }

  function updateTouchVisibility() {
    const on = app.inputMode === 'touch' && (app.mode === 'play' || app.mode === 'intro' || app.mode === 'oops');
    show('touch', on);
    $('controlsHint').style.display = app.inputMode === 'touch' ? 'none' : '';
  }

  function setEasy(easy) {
    app.easy = save.easy = easy;
    persist();
    document.querySelectorAll('#diff button').forEach((b) => b.classList.toggle('on', (b.dataset.d === 'easy') === easy));
    $('diffNote').textContent = easy ? 'EASY: 9 lives, no timer, slower enemies' : 'NORMAL: 5 lives, a 300-second clock, full-speed enemies';
  }
  document.querySelectorAll('#diff button').forEach((b) => b.addEventListener('click', () => { Kit.sound.init(); sfx('click'); setEasy(b.dataset.d === 'easy'); }));
  setEasy(app.easy);

  function toTitle() {
    setScreen('title');
    startDemo();
  }
  function go1p() {
    app.players = '1p';
    setScreen('pick');
    pickSel(app.ch);
  }
  function go2p() {
    app.players = '2p';
    toMap();
  }
  tapBtn('b1p', go1p);
  tapBtn('b2p', go2p);

  function pickSel(ch) {
    app.ch = ch;
    document.querySelectorAll('.card').forEach((c) => c.classList.toggle('sel', c.dataset.ch === ch));
  }
  function pickGo(ch) {
    app.ch = save.ch = ch;
    persist();
    toMap();
  }
  document.querySelectorAll('.card').forEach((c) => c.addEventListener('click', () => { Kit.sound.init(); sfx('click'); pickSel(c.dataset.ch); pickGo(c.dataset.ch); }));
  tapBtn('pickBack', toTitle);

  // ---------------------------------------------------------------- the world map
  function buildMap() {
    const wrap = $('worlds');
    wrap.innerHTML = '';
    for (const w of WORLDS) {
      const d = document.createElement('div');
      d.className = 'world ' + w.theme;
      d.innerHTML = `<h3>${w.name}</h3><div class="nodes"></div>`;
      for (const li of w.levels) {
        const b = document.createElement('button');
        const locked = li + 1 > save.unlocked;
        const best = save.best[li + 1];
        b.className = 'node' + (locked ? ' locked' : '') + (save.cleared[li + 1] ? ' done' : '');
        b.dataset.li = li;
        b.innerHTML = `<span class="n">${locked ? '🔒' : li + 1}</span><span class="t">${LEVELS[li].name}<span class="b">${locked ? 'locked' : best ? '⭐ best ' + best.toLocaleString() : 'not cleared yet'}</span></span>`;
        b.addEventListener('click', () => {
          Kit.sound.init();
          if (locked) return sfx('nope');
          sfx('click');
          if (app.sel === li) return mapGo();
          mapSel(li);
        });
        d.querySelector('.nodes').appendChild(b);
      }
      wrap.appendChild(d);
    }
  }

  function toMap() {
    stopDemo();
    app.session = null;
    buildMap();
    const who = app.players === '2p' ? 'TEDDY + TOMMY (2 players)' : `${Kit.roster.get(app.ch).name}, with ${Kit.roster.get(Kit.roster.buddyFor(app.ch)).name} on call`;
    $('mapWho').textContent = `${who} · ${app.easy ? '🐣 EASY' : '🔥 NORMAL'} · pick a level`;
    setScreen('map');
    mapSel(Math.min(app.sel, save.unlocked - 1));
    startDemo(app.sel);
  }

  function mapSel(li) {
    li = Math.max(0, Math.min(save.unlocked - 1, li));
    if (li !== app.sel) sfx('click');
    app.sel = li;
    document.querySelectorAll('.node').forEach((n) => n.classList.toggle('sel', +n.dataset.li === li));
    const el = document.querySelector('.node.sel');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
    if (app.demoLi !== li && app.mode === 'map') startDemo(li);
  }
  function mapGo() {
    app.session = null;
    startLevel(app.sel);
  }
  function mapBack() {
    if (app.players === '2p') toTitle();
    else go1p();
  }
  tapBtn('mapBack', mapBack);
  tapBtn('mapGo', mapGo);

  // ---------------------------------------------------------------- the attract demo behind the menus
  function startDemo(li) {
    const demos = window.TNT_DEMOS || {};
    const have = Object.keys(demos).map((k) => +k - 1).filter((i) => i < N);
    if (!have.length) {
      // no demos yet (run node tools/check.js): just show level 1
      app.demo = '';
      app.demoLi = 0;
      app.demoFrame = 0;
      app.S = E.create(0, { chars: ['teddy'], mode: '1p' });
      world.build(app.S);
      return;
    }
    if (li === undefined || !demos[li + 1]) li = have[Math.floor(Math.random() * have.length)];
    app.demo = demos[li + 1];
    app.demoLi = li;
    app.demoFrame = 0;
    app.S = E.create(li, { chars: ['teddy'], mode: '1p', quiet: false });
    app.li = li;
    world.build(app.S);
  }
  function stopDemo() {
    app.demo = null;
    app.demoLi = -1;
  }

  // ---------------------------------------------------------------- playing a level
  function startLevel(li, retry) {
    stopDemo();
    app.replay = null;
    app.virtual = [{}, {}];
    app.li = li;
    if (!app.session) {
      app.session = { lives: app.easy ? 9 : 5, coins: 0, pow: [0, 0], checkpoint: null };
    }
    const chars = app.players === '2p' ? ['teddy', 'tommy'] : [app.ch];
    const ss = app.session;
    app.S = E.create(li, {
      mode: app.players, chars, easy: app.easy, lives: ss.lives, coins: ss.coins, score: 0,
      checkpoint: retry ? ss.checkpoint : null, pow: ss.pow,
    });
    if (!retry) ss.checkpoint = null;
    app.lowWarned = false;
    world.build(app.S);
    setupHud();
    setScreen('intro');
    app.bannerT = 1.6;
    banner(`LEVEL ${li + 1}<small>${LEVELS[li].name}</small>`);
    $('tip').classList.add('off');
  }

  function restartLevel() {
    app.session = null;
    startLevel(app.li);
  }

  function nextLevel() {
    if (app.li + 1 >= N) return toMap();
    startLevel(app.li + 1);
  }

  function retryAfterOver() {
    app.session = null;
    startLevel(app.li);
  }

  function pause(on) {
    if (on && app.mode !== 'play' && app.mode !== 'intro') return;
    if (!on && app.mode !== 'pause') return;
    setScreen(on ? 'pause' : 'play');
  }
  tapBtn('pauseBtn', () => pause(app.mode !== 'pause'));
  tapBtn('pResume', () => pause(false));
  tapBtn('pRestart', restartLevel);
  tapBtn('pMap', toMap);
  tapBtn('cNext', nextLevel);
  tapBtn('cMap', toMap);
  tapBtn('oRetry', retryAfterOver);
  tapBtn('oMap', toMap);
  tapBtn('eMap', toMap);

  function toggleMute() {
    const m = Kit.sound.toggleMute();
    $('muteBtn').textContent = m ? '🔇' : '🔊';
  }
  tapBtn('muteBtn', toggleMute);
  $('muteBtn').textContent = Kit.sound.isMuted() ? '🔇' : '🔊';

  // The level is over one way or another.
  function onResult(S) {
    const ss = app.session;
    if (S.result === 'clear') {
      ss.lives = S.lives;
      ss.coins = S.coins;
      ss.pow = S.players.map((P) => P.pow);
      ss.checkpoint = null;
      const n = app.li + 1;
      const prev = save.best[n] || 0;
      const best = S.score > prev;
      if (best) save.best[n] = S.score;
      save.cleared[n] = true;
      save.unlocked = Math.max(save.unlocked, Math.min(N, n + 1));
      app.sel = Math.min(N - 1, app.li + 1);
      persist();
      const timeBonus = S.time !== null ? Math.ceil(S.time) * 20 : 0;
      const html = `${LEVELS[app.li].name}<br>Score <b>${S.score.toLocaleString()}</b>${timeBonus ? ` (time bonus ${timeBonus.toLocaleString()})` : ''}<br>Coins <b>${S.coins}</b> · Lives <b>${S.lives}</b>${best ? '<br><span class="newbest">NEW BEST!</span>' : `<br>Best ${prev.toLocaleString()}`}`;
      if (n >= N) {
        $('endStats').innerHTML = html;
        setScreen('end');
      } else {
        $('clearStats').innerHTML = html;
        $('cNext').textContent = `LEVEL ${n + 1} ▶`;
        setScreen('clear');
      }
      return;
    }
    if (S.result === 'retry') {
      ss.lives = S.lives;
      ss.coins = S.coins;
      ss.pow = [0, 0];
      ss.checkpoint = S.checkpoint;
      startLevel(app.li, true);
      return;
    }
    if (S.result === 'over') setScreen('over');
  }

  // ---------------------------------------------------------------- the companion
  let buddyEntry = null;
  function setupHud() {
    const S = app.S;
    const two = S.mode === '2p';
    $('hudFace0').src = faces[S.players[0].ch];
    $('hudFace1').style.display = two ? '' : 'none';
    if (two) $('hudFace1').src = faces[S.players[1].ch];
    $('lvlName').textContent = `LEVEL ${S.li + 1} · ${LEVELS[S.li].name}`;
    $('timeBox').style.display = S.time === null ? 'none' : '';
    const wrap = $('budFaceWrap');
    if (two) {
      wrap.className = 'face two';
      wrap.innerHTML = `<img src="${faces.teddy}" alt=""><img src="${faces.tommy}" alt=""><span class="hi5">🙌</span>`;
      $('budName').textContent = 'HIGH FIVE!';
      $('budBtn').title = 'High five! (T)';
      buddyEntry = null;
    } else {
      buddyEntry = Kit.roster.get(Kit.roster.buddyFor(S.players[0].ch));
      wrap.className = 'face';
      wrap.innerHTML = `<img id="budFace" src="${faces[buddyEntry.id]}" alt="">`;
      $('budName').textContent = buddyEntry.name;
      $('budBtn').title = `Call ${buddyEntry.name[0] + buddyEntry.name.slice(1).toLowerCase()} (T)`;
    }
    $('controlsHint').innerHTML = two
      ? 'TEDDY: A D move · W jump · Shift run · F throw &nbsp;|&nbsp; TOMMY: J L move · I/U jump · H run · O throw &nbsp;|&nbsp; T high five'
      : '← → move · Space jump · Shift run · F throw · ↓ vents · T call your brother';
  }

  function callBuddy() {
    if (app.mode !== 'play' && app.mode !== 'intro') return;
    const S = app.S;
    const ok = E.callBuddy(S);
    if (!ok) {
      $('budBtn').classList.remove('no');
      void $('budBtn').offsetWidth;
      $('budBtn').classList.add('no');
    }
    drainEvents(S);
  }
  $('budBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    Kit.sound.init();
    callBuddy();
    $('budBtn').blur();
  });

  // ---------------------------------------------------------------- HUD bits
  let lastHud = '';
  function updateHud() {
    const S = app.S;
    if (!S) return;
    const t = S.time === null ? '' : Math.ceil(S.time);
    const key = [S.lives, S.coins, S.score, t].join('|');
    if (key !== lastHud) {
      lastHud = key;
      $('lives').textContent = S.lives;
      $('coins').textContent = S.coins;
      $('score').textContent = S.score.toLocaleString();
      $('time').textContent = t;
      $('timeBox').classList.toggle('low', S.time !== null && S.time < 50);
    }
    const b = $('budBtn');
    if (S.mode === '1p') {
      const on = E.buddyGuarding(S);
      b.classList.toggle('on', on);
      b.classList.toggle('cool', false);
      if (S.bud.on) $('budFill').style.transform = `scaleX(${Math.max(0, 1 - S.bud.t / E.BUD.visit)})`;
      b.querySelector('.bar').style.opacity = S.bud.on && S.bud.t < E.BUD.visit ? 1 : 0;
    } else {
      const cool = S.hi5.cool > 0;
      b.classList.toggle('cool', cool);
      b.classList.toggle('on', S.players.some((P) => P.hi5 > 0));
      $('budFill').style.transform = `scaleX(${cool ? 1 - S.hi5.cool / E.HI5.cool : 1})`;
      b.querySelector('.bar').style.opacity = cool ? 1 : 0;
    }
    $('tThrow').classList.toggle('off', !S.players.some((P) => P.pow === 2));
    // the Zombie King's hearts, once he's awake
    const boss = S.ents.find((e) => e.k === 'boss' && e.st !== 'wait');
    $('bossPill').style.display = boss ? '' : 'none';
    if (boss) $('bossHp').textContent = '❤️'.repeat(Math.max(0, 3 - S.bossHits)) + '🤍'.repeat(Math.min(3, S.bossHits));
  }

  function toast(text, cls) {
    if (app.demo !== null) return;
    const el = document.createElement('div');
    el.className = 'toast' + (cls ? ' ' + cls : '');
    el.textContent = text;
    $('toasts').appendChild(el);
    setTimeout(() => el.remove(), 1600);
    while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
  }

  let bannerTimer = 0;
  function banner(html, secs = 1.5) {
    const el = $('banner');
    el.innerHTML = html;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => el.classList.remove('show'), secs * 1000);
  }

  let tipTimer = 0;
  function tip(text) {
    if (app.demo !== null) return;
    const touchy = app.inputMode === 'touch';
    const two = app.players === '2p';
    const words = {
      move: touchy ? 'the ◀ ▶ buttons' : '← → (or A D)',
      jump: touchy ? 'JUMP' : 'SPACE',
      run: touchy ? '▶ (keep holding it)' : 'SHIFT',
      throw: touchy ? '🏀' : 'F',
      down: touchy ? '▼' : '↓',
      call: two ? (touchy ? 'tap 🙌 for a high five!' : 'press T for a high five!') : touchy ? 'tap his face (top right)' : 'press T',
    };
    const el = $('tip');
    el.textContent = text.replace(/\{(\w+)\}/g, (m, k) => words[k] || m);
    el.classList.remove('off');
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => el.classList.add('off'), 4200);
  }

  // ---------------------------------------------------------------- engine events -> sound, effects, words
  function drainEvents(S) {
    const evs = S.ev;
    if (!evs.length) return;
    S.ev = [];
    const quiet = app.demo !== null;
    const name = (i) => (S.players[i] ? Kit.roster.get(S.players[i].ch).name : '');
    for (const e of evs) {
      switch (e.k) {
        case 'jump': if (!quiet) sfx('jump'); break;
        case 'coin':
          app.streak = app.streakT > 0 ? app.streak + 1 : 0;
          app.streakT = 0.6;
          if (!quiet) sfx('coin', app.streak);
          world.parts.emit(e.x, e.y, 0.4, 6, { color: ['#ffd400', '#fff6b0'], speed: 2, up: 1.5, life: 0.4 });
          break;
        case 'points': world.points(e.n, e.x, e.y); break;
        case 'bump':
          world.bumpTile(e.x, e.y);
          if (e.coin) world.coinPop(e.x + 0.5, e.y + 1.4);
          break;
        case 'bonkHead': if (!quiet) sfx('block'); break;
        case 'break': if (!quiet) sfx('break'); world.breakBlock(e.x, e.y); break;
        case 'sprout': if (!quiet) sfx('sprout'); break;
        case 'stomp':
          if (!quiet) sfx('stomp', S.players[0] ? S.players[0].combo : 0);
          world.burst(e.by === 'buddy' ? 'BOP!' : 'POW!', e.x, e.y + 0.4);
          world.parts.emit(e.x, e.y, 0.4, 10, { color: ['#ffd400', '#ffffff'], speed: 3, up: 2, life: 0.5 });
          break;
        case 'bonk':
          if (!quiet) sfx('punch');
          world.burst('BONK!', e.x, e.y + 0.3, '#18d4ff');
          break;
        case 'kick': if (!quiet) sfx('kick'); world.burst('KICK!', e.x, e.y + 0.8, '#9dff6a'); break;
        case 'clank': if (!quiet) sfx('clank'); break;
        case 'throw': if (!quiet) sfx(e.kind === 'peace' ? 'throwStar' : 'throwBall'); break;
        case 'poof': if (!quiet) sfx('poof'); world.parts.emit(e.x, e.y, 0.3, 8, { color: '#ffffff', speed: 2, life: 0.3 }); break;
        case 'power': {
          if (!quiet) sfx(e.kind === 'life' ? 'oneUp' : 'powerup');
          const P = S.players[e.p];
          const words = {
            ice: `🍦 ${name(e.p)} GOT BIG!`, hoop: `🏀 ${P && P.ch === 'tommy' ? '✌️ STAR' : 'BASKETBALL'} POWER! PRESS ${app.inputMode === 'touch' ? '🏀' : 'F'}`,
            star: '⭐ SUPER STAR!', life: '💚 1-UP!',
          };
          toast(words[e.kind], 'good');
          break;
        }
        case 'life': if (!quiet) sfx('oneUp'); toast('💚 1-UP! EXTRA LIFE!', 'good'); break;
        case 'shrink': if (!quiet) sfx('shrink'); world.shake = 0.4; break;
        case 'die':
          if (!quiet) sfx(e.how === 'fell' ? 'fall' : 'dizzy');
          if (e.how === 'time') toast("⏱️ TIME'S UP!", 'warn');
          else if (S.mode === '2p') toast(`OOPS, ${name(e.p)}!`, 'warn');
          break;
        case 'respawn': if (!quiet) sfx('powerup'); toast(`${name(e.p)} IS BACK!`, 'good'); break;
        case 'out': toast(`${name(e.p)} IS OUT OF LIVES. KEEP GOING!`, 'warn'); break;
        case 'checkpoint': if (!quiet) sfx('checkpoint'); toast('🚩 CHECKPOINT!', 'good'); break;
        case 'vent': if (!quiet) sfx('vent'); break;
        case 'room':
          world.build(S);
          if (e.room === 1) toast('BONUS ROOM!', 'good');
          break;
        case 'flag': if (!quiet) sfx('flag'); break;
        case 'celebrate':
          if (!quiet) sfx('clear');
          banner('LEVEL CLEAR!', 2.4);
          if (e.timeBonus) world.points('+' + e.timeBonus, S.players[e.p].x, S.players[e.p].y + 3);
          break;
        case 'buddy':
          if (e.state === 'in') {
            if (!quiet) sfx('hello');
            toast(`${buddyEntry ? buddyEntry.name : ''}'S HERE!`, 'buddy');
          } else if (e.state === 'again' && !quiet) sfx('hello');
          break;
        case 'buddyHop': if (!quiet) sfx('jump'); break;
        case 'treat': {
          const [emoji, label] = TREATS[(e.n - 1 + Math.floor(Math.random() * TREATS.length)) % TREATS.length];
          world.giveTreat(S, emoji);
          if (!quiet) sfx('powerup');
          toast(`${emoji} ${label} FROM ${buddyEntry ? buddyEntry.name : ''}!`, 'buddy');
          break;
        }
        case 'saved':
          if (!quiet) sfx('saved');
          world.shake = 0.5;
          toast(`${buddyEntry ? buddyEntry.name : ''} SAVED YOU!`, 'buddy');
          break;
        case 'hi5': {
          if (!quiet) sfx('hi5');
          const [a, b] = S.players;
          const mx = (a.x + b.x) / 2, my = Math.max(a.y, b.y) + 2;
          world.burst('HIGH 5!', mx, my, '#9dff6a');
          world.parts.emit(mx, my, 0.5, 40, { color: ['#ffd400', '#ff7ab0', '#18d4ff', '#9dff6a'], speed: 5, up: 3, life: 0.9 });
          toast('🙌 HIGH FIVE! ⭐ STAR POWER!', 'good');
          break;
        }
        case 'hi5no': if (!quiet) sfx('nope'); break;
        case 'pulled': if (!quiet) sfx('swish'); break;
        case 'boss':
          if (e.state === 'wake') {
            toast('👑 THE ZOMBIE KING!', 'warn');
            if (!quiet) sfx('thud');
            world.shake = 0.6;
          }
          break;
        case 'thud': if (!quiet) sfx('thud'); world.shake = Math.max(world.shake, 0.45); break;
        case 'bossHit':
          if (!quiet) sfx('bossHit');
          world.burst('BONK!', e.x, e.y + 0.5, '#ff7ab0');
          toast(e.hits === 2 ? 'ONE MORE!' : `${3 - e.hits} MORE STOMPS!`, 'good');
          break;
        case 'bossBonk': if (!quiet) sfx('bump'); world.burst('BOING!', e.x, e.y, '#ffffff'); break;
        case 'bossBeaten':
          if (!quiet) sfx('bossBeaten');
          toast('👑 YOU BONKED THE ZOMBIE KING!', 'good');
          world.parts.emit(e.x, e.y + 2, 0.5, 80, { color: ['#ffd400', '#ff7ab0', '#18d4ff', '#9dff6a', '#ffffff'], speed: 7, up: 5, life: 1.4 });
          break;
        case 'gate': if (!quiet) sfx('gate'); toast('THE GATE IS OPEN!', 'good'); break;
        case 'tip': tip(e.text); break;
        case 'retry': if (!quiet) banner('OOPS!', 1.2); break;
      }
    }
  }

  // ---------------------------------------------------------------- the loop
  const DT = E.DT;

  function tick(dt) {
    const S = app.S;
    if (!S) return;
    app.streakT -= dt;
    // the menus play a demo of a level behind them
    if (app.demo !== null) {
      app.acc += dt;
      while (app.acc >= DT) {
        app.acc -= DT;
        const inp = app.demo ? TNT.bot.demoInput(app.demo, app.demoFrame++) : {};
        if (!inp || S.result || app.demoFrame > 60 * 120) {
          startDemo();
          return;
        }
        E.step(app.S, [inp]);
        drainEvents(app.S);
      }
      world.sync(app.S, dt);
      return;
    }
    if (app.mode === 'intro') {
      app.bannerT -= dt;
      if (app.bannerT <= 0) setScreen('play');
    }
    if (app.mode === 'play') {
      app.acc += dt;
      let n = 0;
      while (app.acc >= DT && n++ < 8) {
        app.acc -= DT;
        if (touch.l || touch.r) touch.holdT += DT;
        else touch.holdT = 0;
        if (app.replay) app.virtual[0] = TNT.bot.demoInput(app.replay.d, app.replay.f++) || {};
        E.step(S, inputs());
        drainEvents(S);
        if (S.result && S.resultT === 0) break;
      }
      if (app.acc > DT * 8) app.acc = 0;
      if (S.time !== null && S.time < 50 && !app.lowWarned && !S.cleared) {
        app.lowWarned = true;
        sfx('timeLow');
        toast('⏱️ HURRY UP!', 'warn');
      }
      if (S.players.some((P) => P.star > 0)) {
        app.twinkleT -= dt;
        if (app.twinkleT <= 0) {
          app.twinkleT = 0.28;
          sfx('twinkle');
        }
      }
      if (S.result) {
        const wait = S.result === 'clear' ? 0.2 : S.result === 'retry' ? 0.9 : 1.0;
        if (S.resultT === 0) S.resultT = 0.0001;
        S.resultT += dt;
        if (S.resultT > wait) onResult(S);
      }
    }
    world.sync(app.S, dt);
    updateHud();
  }

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (app.held) return;
    if (!world.size[0] || world.size[0] < 2) resize();
    tick(dt);
    world.render();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (app.autoPause) pause(true);
      Kit.sound.suspend();
    } else Kit.sound.resume();
  });

  // ---------------------------------------------------------------- start
  toTitle();
  requestAnimationFrame(frame);

  // ---------------------------------------------------------------- console hooks for testing
  window.game = {
    // advance the game by `seconds` right now and draw (works while the tab's animation is throttled)
    step(seconds = 1 / 60) {
      app.autoPause = false;
      const n = Math.max(1, Math.round(seconds / DT));
      for (let i = 0; i < n; i++) tick(DT);
      world.render();
      return this.state();
    },
    hold(on = true) { app.held = on; app.autoPause = false; return on; },
    // start a level straight away: game.start(3, { ch: 'tommy', easy: false, players: '2p', pow: 1 })
    start(level = 1, o = {}) {
      app.autoPause = false;
      app.players = o.players || '1p';
      if (o.ch) app.ch = o.ch;
      if (o.easy !== undefined) setEasy(!!o.easy);
      app.session = { lives: o.lives || (app.easy ? 9 : 5), coins: 0, pow: [o.pow || 0, o.pow || 0], checkpoint: null };
      startLevel(level - 1);
      setScreen('play');
      return this.state();
    },
    // hold buttons down from the console: game.input(0, { r: 1, run: 1 }) ... game.input(0, {})
    input(i, o) { app.virtual[i] = o || {}; },
    buddy() { callBuddy(); return this.state(); },
    // put player 1 somewhere: game.teleport(80, 6)
    teleport(x, y) {
      const P = app.S.players[0];
      Object.assign(P, { x, y, vx: 0, vy: 0 });
      app.S.cam.x = x;
      return this.state();
    },
    // replay the bot's winning run of a level, for real, with sound and the HUD: game.demo(4); game.step(30)
    demo(level = 1) {
      const d = (window.TNT_DEMOS || {})[level];
      if (!d) return 'no demo for that level';
      this.start(level, { ch: 'teddy', easy: false, players: '1p' });
      app.replay = { d, f: 0 };
      return d.length * TNT.bot.FRAMES / 60 + ' s long';
    },
    // the headless check, in the browser: game.check(4) (takes a few seconds per level)
    check(level) {
      const out = [];
      const list = level ? [level - 1] : [...Array(N).keys()];
      for (const li of list) {
        const r = TNT.bot.solve(li, { beam: 150 });
        out.push(`${r.ok ? 'PASS' : 'FAIL'} level ${li + 1}: ${r.ok ? r.seconds + ' s' : r.reason}`);
      }
      return out.join('\n');
    },
    screen(name) { if (name === 'map') toMap(); else if (name === 'title') toTitle(); else setScreen(name); return app.mode; },
    unlockAll() { save.unlocked = N; persist(); buildMap(); return N; },
    state() {
      const S = app.S;
      if (!S) return { mode: app.mode };
      return {
        mode: app.mode, level: S.li + 1, room: S.room, t: +S.t.toFixed(2), lives: S.lives, coins: S.coins, score: S.score,
        time: S.time === null ? null : Math.ceil(S.time), result: S.result, cleared: S.cleared, bossHits: S.bossHits,
        players: S.players.map((P) => ({ ch: P.ch, x: +P.x.toFixed(2), y: +P.y.toFixed(2), st: P.st, pow: P.pow, star: +P.star.toFixed(1), gnd: P.gnd })),
        buddy: S.mode === '1p' ? { on: S.bud.on, t: +S.bud.t.toFixed(2), saved: S.bud.saved, x: +S.bud.x.toFixed(2), y: +S.bud.y.toFixed(2) } : { hi5cool: +S.hi5.cool.toFixed(1) },
        cam: +S.cam.x.toFixed(1), ents: S.ents.filter((e) => !e.dead && e.on).length,
      };
    },
    get S() { return app.S; },
    world,
    app,
  };
})();

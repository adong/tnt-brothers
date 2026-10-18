/* TNT Brothers engine: the whole game as plain state, stepped at a fixed 60 frames a second. There's no Three.js in
   here, so the browser game, the console hooks and the headless level check (tools/check.js) all run the same code.
   Positions are in tiles: x to the right, y up, y = 0 at the bottom of the level. A body's x is its centre and its
   y is its feet. Exposes window.TNT.engine. */
(function () {
  'use strict';
  const TNT = (window.TNT = window.TNT || {});
  const DT = 1 / 60;
  const H = 14; // every level is 14 tiles tall
  const VIEW_W = 24; // the logical screen width in tiles: enemies wake up and the co-op camera pulls by this, on any screen

  // ---------------------------------------------------------------- tiles
  const T = {
    E: 0, GROUND: 1, BRICK: 2, QCOIN: 3, QPOW: 4, QSTAR: 5, MULTI: 6, HCOIN: 7, H1UP: 8, USED: 9, HARD: 10,
    VTL: 11, VTR: 12, VBL: 13, VBR: 14, VENTER: 15, VPLANT: 16, VRET: 17, SEMI: 18, GATE: 19, FLAG: 20, PIVOT: 21, COIN: 22,
  };
  const CHAR = {
    '#': T.GROUND, B: T.BRICK, '?': T.QCOIN, M: T.QPOW, S: T.QSTAR, C: T.MULTI, H: T.HCOIN, U: T.H1UP, X: T.HARD,
    '[': T.VTL, ']': T.VTR, '{': T.VBL, '}': T.VBR, V: T.VENTER, P: T.VPLANT, R: T.VRET, '-': T.SEMI, G: T.GATE,
    F: T.FLAG, '*': T.PIVOT, o: T.COIN,
  };
  const SOLID = new Uint8Array(32);
  for (const c of [T.GROUND, T.BRICK, T.QCOIN, T.QPOW, T.QSTAR, T.MULTI, T.USED, T.HARD, T.VTL, T.VTR, T.VBL, T.VBR, T.VENTER, T.VPLANT, T.VRET, T.GATE, T.FLAG, T.PIVOT]) SOLID[c] = 1;
  const BUMPABLE = new Uint8Array(32);
  for (const c of [T.BRICK, T.QCOIN, T.QPOW, T.QSTAR, T.MULTI, T.HCOIN, T.H1UP]) BUMPABLE[c] = 1;
  const VENT_TOP = (c) => c === T.VTL || c === T.VENTER || c === T.VPLANT || c === T.VRET;

  // ---------------------------------------------------------------- physics (tiles and seconds)
  const PH = {
    walk: 6, run: 9.5, acc: 22, runAcc: 26, airAcc: 18, fric: 24, skid: 44,
    jump: 16.8, jumpRun: 1.8, gUp: 34, g: 75, maxFall: 22,
    stomp: 11, stompHeld: 16, coyote: 0.1, buffer: 0.13,
    smallH: 0.9, bigH: 1.75, w: 0.7,
  };
  const STOMP_PTS = [100, 200, 400, 800, 1000, 2000, 4000, 5000, 8000];
  const BUD = { visit: 10, leave: 11.6, treatAt: 3.6 }; // the companion stays ~10 s and guards you all that time
  const HI5 = { star: 4, cool: 18 }; // co-op high five: star power for 4 s, then 18 s to recharge

  // ---------------------------------------------------------------- level parsing (cached per level)
  const cache = [];

  // Lay the screens side by side into one grid. Returns { W, rows (top line first), warn: [...] }.
  function joinScreens(screens, name) {
    const warn = [];
    const rows = Array.from({ length: H }, () => '');
    screens.forEach((scr, si) => {
      let lines = scr.split('\n').map((l) => l.trim()).filter((l, i, a) => l.length || (i > 0 && i < a.length - 1));
      while (lines.length && !lines[0].length) lines.shift();
      while (lines.length && !lines[lines.length - 1].length) lines.pop();
      const w = Math.max(...lines.map((l) => l.length));
      lines.forEach((l, i) => {
        if (l.length !== w) warn.push(`${name}: screen ${si + 1}, line ${i + 1} is ${l.length} wide, the others ${w}`);
      });
      if (lines.length > H) {
        warn.push(`${name}: screen ${si + 1} has ${lines.length} lines (max ${H}); the top ones are ignored`);
        lines = lines.slice(lines.length - H);
      }
      while (lines.length < H) lines.unshift('');
      for (let r = 0; r < H; r++) rows[r] += lines[r].padEnd(w, '.');
    });
    return { W: rows[0].length, rows, warn };
  }

  // Turn rows of characters into tiles plus a list of things to spawn.
  function parseRoom(rows, W) {
    const tiles = new Uint8Array(W * H);
    const spawns = [];
    let start = null, flag = null;
    for (let r = 0; r < H; r++) {
      const y = H - 1 - r;
      for (let x = 0; x < W; x++) {
        const ch = rows[r][x] || '.';
        const code = CHAR[ch];
        if (code !== undefined) tiles[y * W + x] = code;
        if (ch === '@') start = { x: x + 0.5, y };
        else if ('zrbdK'.includes(ch)) spawns.push({ k: { z: 'zombie', r: 'robot', b: 'ball', d: 'drone', K: 'boss' }[ch], x: x + 0.5, y });
        else if (ch === 'k') spawns.push({ k: 'chk', x: x + 0.5, y });
        else if (ch === '~') spawns.push({ k: 'plat', kind: 'h', x, y: y + 1 });
        else if (ch === '!') spawns.push({ k: 'plat', kind: 'v', x, y: y + 1 });
        else if (ch === 'P') spawns.push({ k: 'plant', x: x + 1, y: y + 1 });
        else if (ch === '*') spawns.push({ k: 'bar', x: x + 0.5, y: y + 0.5, dir: x % 2 ? 1 : -1 });
        else if (ch === 'F') flag = { x: x + 0.5, base: y + 1, top: Math.min(H - 0.6, y + 10) };
      }
    }
    return { W, tiles, spawns, start: start || { x: 2.5, y: 2 }, flag };
  }

  function prep(li) {
    if (cache[li]) return cache[li];
    const def = window.TNT_LEVELS[li];
    const name = `level ${li + 1} (${def.name})`;
    const main = joinScreens(def.map, name);
    // leave room past the flagpole for the clubhouse: repeat the last column until there are 14 tiles
    const fx = main.rows.reduce((m, r) => Math.max(m, r.indexOf('F')), -1);
    if (fx >= 0 && main.W - fx < 15) {
      const add = 15 - (main.W - fx);
      main.rows = main.rows.map((r) => r + (r[r.length - 1] === '#' ? '#' : '.').repeat(add));
      main.W += add;
    }
    const lv = {
      li, name: def.name, theme: def.theme, time: def.time || 300, tips: def.tips || [], warn: main.warn.slice(),
      main: Object.assign(parseRoom(main.rows, main.W), { rows: main.rows }), bonus: null,
    };
    if (def.bonus) {
      const b = joinScreens(def.bonus, name + ' bonus room');
      lv.warn.push(...b.warn);
      lv.bonus = Object.assign(parseRoom(b.rows, b.W), { rows: b.rows });
    }
    if (!lv.main.flag) lv.warn.push(`${name}: no flagpole (F)`);
    return (cache[li] = lv);
  }

  // ---------------------------------------------------------------- state
  // opts: { mode: '1p' | '2p', chars: ['teddy'] or ['teddy', 'tommy'], easy, lives, coins, score, checkpoint, quiet }
  function create(li, opts = {}) {
    const lv = prep(li);
    const S = {
      li, mode: opts.mode || '1p', easy: !!opts.easy, quiet: !!opts.quiet,
      frame: 0, t: 0, time: opts.easy ? null : lv.time,
      lives: opts.lives ?? (opts.easy ? 9 : 5), coins: opts.coins || 0, score: opts.score || 0, startScore: opts.score || 0,
      room: 0, W: 0, tiles: null, ents: [], multi: {}, saved: null, nextId: 1,
      cam: { x: 0, y: 7, vw: VIEW_W }, flag: lv.main.flag, checkpoint: opts.checkpoint ?? null,
      tipI: 0, combo: 0, seed: 12345 + li * 77, result: null, resultT: 0, cleared: false, clearT: 0,
      bossHits: 0, bossDone: false, es: opts.easy ? 0.65 : 1,
      bud: { on: false, t: 0, x: 0, y: 0, face: 1, saved: false, hopT: -1, hx0: 0, hy0: 0, hx1: 0, hy1: 0, hdur: 0, target: 0, cool: 0, treatAt: -1, cheer: 0, treats: 0, carry: -1 },
      hi5: { cool: 0, t: 0 },
      trail: [], ev: [],
    };
    loadRoom(S, lv.main);
    const chars = opts.chars || ['teddy'];
    S.players = chars.map((ch, i) => makePlayer(i, ch));
    // start at the checkpoint after an oops
    let sx = lv.main.start.x, sy = lv.main.start.y;
    if (S.checkpoint !== null) {
      const c = lv.main.spawns.find((s) => s.k === 'chk' && s.x === S.checkpoint);
      if (c) (sx = c.x), (sy = c.y);
    }
    S.players.forEach((P, i) => {
      P.x = sx - i * 1.1;
      P.y = sy;
      P.safeX = P.x;
      P.safeY = P.y;
      P.pow = opts.pow ? opts.pow[i] || 0 : 0;
      P.h = P.pow ? PH.bigH : PH.smallH;
    });
    // tips before the start point are skipped
    while (S.tipI < lv.tips.length && lv.tips[S.tipI][0] < sx - 1) S.tipI++;
    S.cam.x = clampCam(S, sx + 4);
    return S;
  }

  function makePlayer(i, ch) {
    return {
      i, ch, x: 0, y: 0, vx: 0, vy: 0, w: PH.w, h: PH.smallH, face: 1, gnd: false, pow: 0, star: 0, inv: 0,
      st: 'play', t: 0, jumping: false, coy: 0, buf: 0, pj: false, pt: false, pdn: false, plat: 0, prevY: 0,
      throwT: 0, grow: 0, safeX: 0, safeY: 0, hi5: 0, combo: 0, ax: 0, ay: 0, bx: 0, by: 0, run: false, skid: false,
    };
  }

  function loadRoom(S, room) {
    S.W = room.W;
    S.tiles = room.tiles.slice();
    S.multi = {};
    S.ents = [];
    for (const s of room.spawns) spawn(S, s);
    // neighbouring moving platforms swing in opposite directions, so one is always close to the next
    S.ents.filter((e) => e.k === 'plat').sort((a, b) => a.x0 - b.x0).forEach((e, i) => { e.ph = i % 2 ? Math.PI : 0; movePlat(S, e, 0); });
  }

  function spawn(S, s) {
    const e = { id: S.nextId++, k: s.k, x: s.x, y: s.y, w: 0.8, h: 0.9, vx: 0, vy: 0, dir: -1, st: 'go', t: 0, on: false, dead: false, gnd: false };
    switch (s.k) {
      case 'zombie': e.h = 0.95; break;
      case 'robot': e.h = 1.0; break;
      case 'ball': e.w = 0.8; e.h = 0.8; break;
      case 'drone': e.w = 0.9; e.h = 0.55; e.hx = s.x; e.hy = s.y; e.ph = 0; break;
      case 'boss': e.w = 1.5; e.h = 2.6; e.st = 'wait'; e.hops = 0; e.nextHop = 2.5; e.hx = s.x; break;
      case 'plant': e.w = 0.7; e.h = 0; e.top = s.y; e.up = 0; e.st = 'down'; e.t = 1.0; break;
      case 'bar': e.cx = s.x; e.cy = s.y; e.ang = s.dir > 0 ? 0 : Math.PI; e.spin = s.dir; e.n = 4; e.on = true; break;
      case 'plat': e.kind = s.kind; e.x0 = s.x; e.y0 = s.y; e.x = s.x; e.w = 3; e.h = 0.4; e.ph = 0; e.dx = 0; e.dy = 0; e.on = true; break;
      case 'chk': e.on = true; e.taken = false; break;
      default: Object.assign(e, s);
    }
    if (s.k === 'boss') {
      // the Zombie King stays in his hall: from 14 tiles left of where he starts to the gate
      let gx = s.x + 8;
      for (let x = Math.floor(s.x); x < S.W; x++) if (tile(S, x, Math.floor(s.y) + 1) === T.GATE) { gx = x; break; }
      e.x0 = s.x - 14;
      e.x1 = gx - 0.1;
    }
    S.ents.push(e);
    return e;
  }

  // ---------------------------------------------------------------- helpers
  const tile = (S, x, y) => (x < 0 || x >= S.W || y < 0 || y >= H ? T.E : S.tiles[y * S.W + x]);
  const setTile = (S, x, y, c) => { S.tiles[y * S.W + x] = c; };
  const solidAt = (S, x, y) => (x < 0 || x >= S.W ? y < H + 4 : SOLID[tile(S, x, y)] === 1);
  const groundAt = (S, x, y) => solidAt(S, x, y) || tile(S, x, y) === T.SEMI;
  const ev = (S, k, o) => { if (!S.quiet) S.ev.push(Object.assign({}, o, { k })); };
  const rnd = (S) => ((S.seed = (S.seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const overlap = (a, b) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 && a.y < b.y + b.h && b.y < a.y + a.h;
  const lv = (S) => prep(S.li);
  const room = (S) => (S.room ? lv(S).bonus : lv(S).main);
  const alivePlayers = (S) => S.players.filter((P) => P.st === 'play');

  function clampCam(S, x) {
    const half = S.cam.vw / 2;
    if (S.W <= S.cam.vw) return S.W / 2;
    return Math.max(half, Math.min(S.W - half, x));
  }

  function addScore(S, n, x, y) {
    S.score += n;
    if (x !== undefined) ev(S, 'points', { n, x, y });
  }

  function addCoin(S, x, y, by) {
    S.coins++;
    addScore(S, 200);
    ev(S, 'coin', { x, y, by });
    if (S.coins >= 100) {
      S.coins -= 100;
      S.lives++;
      ev(S, 'life', { x, y });
    }
  }

  // Move a body sideways; returns true if it hit a wall.
  function moveX(S, b, dx) {
    if (!dx) return false;
    b.x += dx;
    const y0 = Math.floor(b.y + 0.02), y1 = Math.floor(b.y + b.h - 0.02);
    if (dx > 0) {
      const cx = Math.floor(b.x + b.w / 2);
      for (let y = y0; y <= y1; y++) {
        if (solidAt(S, cx, y)) {
          b.x = cx - b.w / 2 - 0.001;
          return true;
        }
      }
    } else {
      const cx = Math.floor(b.x - b.w / 2);
      for (let y = y0; y <= y1; y++) {
        if (solidAt(S, cx, y)) {
          b.x = cx + 1 + b.w / 2 + 0.001;
          return true;
        }
      }
    }
    return false;
  }

  // Move a body up or down. Returns { land, head: [x columns hit by the head] }.
  // Players also bump hidden blocks with their heads and land on moving platforms.
  function moveY(S, b, dy, isPlayer) {
    const res = { land: false, head: null, plat: 0 };
    if (!dy) return res;
    const prevY = b.y;
    b.y += dy;
    const x0 = Math.floor(b.x - b.w / 2 + 0.02), x1 = Math.floor(b.x + b.w / 2 - 0.02);
    if (dy < 0) {
      const ry = Math.floor(b.y);
      for (let x = x0; x <= x1; x++) {
        const c = tile(S, x, ry);
        if (SOLID[c] || (c === T.SEMI && prevY >= ry + 1 - 0.02)) {
          b.y = ry + 1;
          b.vy = 0;
          res.land = true;
          break;
        }
      }
      if (!res.land && isPlayer !== false) {
        for (const p of S.ents) {
          if (p.k !== 'plat' || p.dead) continue;
          if (prevY >= p.y - 0.05 - Math.max(0, p.dy) && b.y <= p.y && b.x + b.w / 2 > p.x + 0.05 && b.x - b.w / 2 < p.x + p.w - 0.05) {
            b.y = p.y;
            b.vy = 0;
            res.land = true;
            res.plat = p.id;
            break;
          }
        }
      }
    } else {
      const ry = Math.floor(b.y + b.h);
      let hit = null;
      for (let x = x0; x <= x1; x++) {
        const c = tile(S, x, ry);
        if (SOLID[c] || (isPlayer && (c === T.HCOIN || c === T.H1UP) && prevY + b.h <= ry + 0.05)) (hit = hit || []).push(x);
      }
      if (hit) {
        b.y = ry - b.h;
        b.vy = Math.min(b.vy, -1);
        res.head = hit;
      }
    }
    return res;
  }

  // ---------------------------------------------------------------- the step
  const NONE = {};

  function step(S, inputs) {
    if (S.result) {
      S.resultT += DT;
      return;
    }
    S.frame++;
    S.t += DT;
    if (S.time !== null && !S.cleared && S.players.some((P) => P.st === 'play')) {
      S.time = Math.max(0, S.time - DT);
      if (S.time <= 0) for (const P of S.players) if (P.st === 'play') die(S, P, 'time');
    }
    S.hi5.cool = Math.max(0, S.hi5.cool - DT);
    for (const e of S.ents) if (e.k === 'plat') movePlat(S, e);
    for (const P of S.players) updatePlayer(S, P, (inputs && inputs[P.i]) || (S.mode === '1p' && inputs && inputs[0]) || NONE);
    updateEnts(S);
    for (const P of S.players) if (P.st === 'play') touchEnts(S, P);
    updateBuddy(S);
    updateCamera(S);
    tips(S);
    checkDone(S);
  }

  // ---------------------------------------------------------------- players
  function updatePlayer(S, P, inp) {
    P.t += DT;
    P.inv = Math.max(0, P.inv - DT);
    P.star = Math.max(0, P.star - DT);
    P.throwT = Math.max(0, P.throwT - DT);
    P.grow = Math.max(0, P.grow - DT);
    P.hi5 = Math.max(0, P.hi5 - DT);
    const jPress = !!inp.j && !P.pj, tPress = !!inp.th && !P.pt, dPress = !!inp.d && !P.pdn;
    P.pj = !!inp.j;
    P.pt = !!inp.th;
    P.pdn = !!inp.d;
    switch (P.st) {
      case 'play': return play(S, P, inp, jPress, tPress, dPress);
      case 'dizzy':
      case 'fell':
      case 'time':
        if (P.t > (P.st === 'fell' ? 1.3 : 2.4)) loseLife(S, P);
        return;
      case 'pipe': return pipeDown(S, P);
      case 'rise': return pipeUp(S, P);
      case 'flag': return flagSlide(S, P);
      case 'walk': return walkOff(S, P);
      case 'cele': return;
      case 'carried':
      case 'pulled': return carried(S, P);
      case 'drop':
        // co-op respawn: float down next to your brother
        P.y -= 3 * DT;
        P.vx = P.vy = 0;
        if (P.t > 0.8) {
          P.st = 'play';
          P.inv = 2;
        }
        return;
      default: return; // 'out', 'done'
    }
  }

  function play(S, P, inp, jPress, tPress, dPress) {
    // ride a moving platform
    if (P.plat) {
      const p = S.ents.find((e) => e.id === P.plat);
      if (p && !p.dead) {
        P.x += p.dx;
        P.y += p.dy;
        if (p.dx) moveX(S, P, 0.0001 * Math.sign(p.dx)); // push out of walls
      }
    }
    const dir = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
    P.run = !!inp.run;
    const max = inp.run ? PH.run : PH.walk;
    P.skid = false;
    if (dir) {
      P.face = dir;
      if (P.vx * dir < 0) {
        // turning around: skid
        P.vx += dir * (P.gnd ? PH.skid : PH.airAcc * 1.4) * DT;
        P.skid = P.gnd && Math.abs(P.vx) > 3;
      } else if (Math.abs(P.vx) < max) {
        P.vx += dir * (P.gnd ? (inp.run ? PH.runAcc : PH.acc) : PH.airAcc) * DT;
        if (Math.abs(P.vx) > max) P.vx = dir * max;
      } else P.vx = dir * Math.max(max, Math.abs(P.vx) - PH.fric * DT); // let go of run: ease down
    } else if (P.gnd) {
      const s = Math.sign(P.vx);
      P.vx -= s * PH.fric * DT;
      if (Math.sign(P.vx) !== s) P.vx = 0;
    }
    // jump: buffered a moment before landing, and allowed a moment after walking off a ledge
    if (jPress) P.buf = PH.buffer;
    else P.buf = Math.max(0, P.buf - DT);
    P.coy = P.gnd ? PH.coyote : Math.max(0, P.coy - DT);
    if (P.buf > 0 && P.coy > 0) {
      P.vy = PH.jump + PH.jumpRun * Math.min(1, Math.abs(P.vx) / PH.run);
      P.gnd = false;
      P.coy = 0;
      P.buf = 0;
      P.plat = 0;
      P.jumping = true;
      ev(S, 'jump', { p: P.i });
    }
    const g = P.vy > 0 && inp.j && P.jumping ? PH.gUp : PH.g;
    P.vy = Math.max(-PH.maxFall, P.vy - g * DT);

    // throw (basketball power)
    if (tPress && P.pow === 2 && S.ents.filter((e) => e.k === 'shot' && e.owner === P.i && !e.dead).length < 2) {
      const e = spawn(S, { k: 'shot', x: P.x + P.face * 0.5, y: P.y + (P.ch === 'tommy' ? 0.3 : Math.min(P.h * 0.55, 0.7)) });
      Object.assign(e, { owner: P.i, kind: P.ch === 'tommy' ? 'peace' : 'ball', w: 0.45, h: 0.45, dir: P.face, on: true, life: P.ch === 'tommy' ? 1.15 : 2.6 });
      e.vx = P.face * (P.ch === 'tommy' ? 11 : 10) + P.vx * 0.3;
      e.vy = P.ch === 'tommy' ? 0 : 4;
      P.throwT = 0.25;
      ev(S, 'throw', { p: P.i, kind: e.kind });
    }

    // move
    P.prevY = P.y;
    const wasGnd = P.gnd;
    moveX(S, P, P.vx * DT);
    if (P.x - P.w / 2 < 0) (P.x = P.w / 2), (P.vx = 0);
    if (P.vy > 0) cornerNudge(S, P);
    const r = moveY(S, P, P.vy * DT, true);
    P.gnd = r.land;
    P.plat = r.plat;
    if (r.land) {
      if (!wasGnd && P.prevY - P.y > 0.02) ev(S, 'land', { p: P.i });
      P.jumping = false;
      P.combo = 0;
      // remember solid ground, so the companion knows where to put you back
      if (!r.plat) {
        const fy = Math.round(P.y) - 1;
        if (groundAt(S, Math.floor(P.x - 0.45), fy) && groundAt(S, Math.floor(P.x + 0.45), fy)) {
          P.safeX = P.x;
          P.safeY = P.y;
        }
      }
    }
    if (r.head) bumpHead(S, P, r.head);

    // coins
    const cx0 = Math.floor(P.x - P.w / 2), cx1 = Math.floor(P.x + P.w / 2), cy0 = Math.floor(P.y), cy1 = Math.floor(P.y + P.h);
    for (let y = cy0; y <= cy1; y++) {
      for (let x = cx0; x <= cx1; x++) {
        if (tile(S, x, y) === T.COIN) {
          setTile(S, x, y, T.E);
          addCoin(S, x + 0.5, y + 0.5, P.i);
        }
      }
    }

    // vents: stand on one you can enter and press down
    if (inp.d && P.gnd && !r.plat) {
      const fy = Math.round(P.y) - 1;
      for (const vx of [Math.floor(P.x), Math.floor(P.x) - 1]) {
        if (tile(S, vx, fy) === T.VENTER && Math.abs(P.x - (vx + 1)) < 0.6) {
          enterVent(S, P, vx + 1, fy + 1);
          return;
        }
      }
    }

    // checkpoint flags
    for (const e of S.ents) {
      if (e.k === 'chk' && !e.taken && P.x > e.x - 0.3 && S.room === 0) {
        e.taken = true;
        S.checkpoint = e.x;
        ev(S, 'checkpoint', { x: e.x, y: e.y });
      }
    }

    // the flagpole
    if (S.room === 0 && S.flag && P.x + P.w / 2 >= S.flag.x - 0.56 && P.y < S.flag.top + 0.5) grabFlag(S, P);

    // falling out of the world
    if (P.y < -1.2) {
      if (!buddySave(S, P, 'fall')) die(S, P, 'fell');
    }
  }

  // Bumping a block's corner with the edge of your head slides you past it, instead of stopping the jump.
  function cornerNudge(S, P) {
    const ny = P.y + P.vy * DT;
    const ry = Math.floor(ny + P.h);
    if (ry === Math.floor(P.y + P.h)) return;
    const l = P.x - P.w / 2, r = P.x + P.w / 2;
    const xl = Math.floor(l + 0.02), xr = Math.floor(r - 0.02);
    if (xl === xr) return;
    const sl = solidAt(S, xl, ry), sr = solidAt(S, xr, ry);
    if (sl && !sr && xr - l > 0 && xl + 1 - l < 0.3) P.x += xl + 1 - l + 0.01;
    else if (sr && !sl && r - xr < 0.3) P.x -= r - xr + 0.01;
  }

  // Head-butt the block closest to the middle of your head.
  function bumpHead(S, P, cols) {
    const ry = Math.floor(P.y + P.h + 0.05);
    let best = cols[0];
    for (const c of cols) if (Math.abs(c + 0.5 - P.x) < Math.abs(best + 0.5 - P.x)) best = c;
    bump(S, best, ry, P);
    ev(S, 'bonkHead', { p: P.i });
  }

  function bump(S, x, y, P) {
    const c = tile(S, x, y);
    if (!BUMPABLE[c]) return;
    const big = P && P.pow > 0;
    // anything standing on the block gets bounced
    for (const e of S.ents) {
      if (e.dead || !e.on) continue;
      if (Math.abs(e.y - (y + 1)) < 0.15 && Math.abs(e.x - (x + 0.5)) < 0.5 + e.w / 2) {
        if (isEnemy(e) && e.k !== 'boss') bonk(S, e, e.x < x + 0.5 ? -1 : 1, P);
        else if (e.k === 'item') (e.vy = 9), (e.dir = e.x < x + 0.5 ? -1 : 1);
      }
    }
    if (tile(S, x, y + 1) === T.COIN) {
      setTile(S, x, y + 1, T.E);
      addCoin(S, x + 0.5, y + 1.5, P ? P.i : 0);
    }
    switch (c) {
      case T.BRICK:
        if (big) {
          setTile(S, x, y, T.E);
          addScore(S, 50);
          ev(S, 'break', { x, y });
        } else ev(S, 'bump', { x, y });
        return;
      case T.MULTI: {
        const key = y * S.W + x;
        const left = S.multi[key] ?? 8;
        S.multi[key] = left - 1;
        addCoin(S, x + 0.5, y + 1.5, P ? P.i : 0);
        if (left - 1 <= 0) setTile(S, x, y, T.USED);
        ev(S, 'bump', { x, y, coin: true });
        return;
      }
      case T.QCOIN:
      case T.HCOIN:
        setTile(S, x, y, T.USED);
        addCoin(S, x + 0.5, y + 1.5, P ? P.i : 0);
        ev(S, 'bump', { x, y, coin: true, was: c });
        return;
      case T.QPOW:
      case T.QSTAR:
      case T.H1UP: {
        setTile(S, x, y, T.USED);
        const kind = c === T.QSTAR ? 'star' : c === T.H1UP ? 'life' : big ? 'hoop' : 'ice';
        const it = spawn(S, { k: 'item', x: x + 0.5, y });
        Object.assign(it, { kind, st: 'rise', on: true, w: 0.8, h: 0.8, dir: 1, y0: y });
        ev(S, 'bump', { x, y, item: kind, was: c });
        ev(S, 'sprout', { x, y, kind });
        return;
      }
    }
  }

  function grow(S, P, pow) {
    const was = P.pow;
    P.pow = Math.max(P.pow, pow);
    if (P.pow > 0 && P.h < PH.bigH) {
      P.h = PH.bigH;
      // growing under a low ceiling: slide down out of it
      while (solidAt(S, Math.floor(P.x), Math.floor(P.y + P.h - 0.02)) && P.y > 0) P.y -= 0.05;
    }
    if (P.pow !== was) P.grow = 0.7;
  }

  function hurt(S, P, src) {
    if (P.st !== 'play' || P.inv > 0 || P.star > 0) return;
    if (buddySave(S, P, 'hit', src)) return;
    if (P.pow > 0) {
      P.pow--;
      if (P.pow === 0) P.h = PH.smallH;
      P.inv = 2;
      P.grow = 0.7;
      ev(S, 'shrink', { p: P.i, pow: P.pow });
      return;
    }
    die(S, P, 'dizzy');
  }

  function die(S, P, how) {
    if (P.st !== 'play') return;
    P.st = how;
    P.t = 0;
    P.vx = P.vy = 0;
    P.star = 0;
    ev(S, 'die', { p: P.i, how });
  }

  function loseLife(S, P) {
    S.lives = Math.max(0, S.lives - 1);
    const partner = S.players.find((Q) => Q !== P && (Q.st === 'play' || Q.st === 'flag' || Q.st === 'walk' || Q.st === 'cele'));
    if (partner && S.mode === '2p') {
      if (partner.st !== 'play') return void (P.st = 'out');
      if (S.lives > 0) {
        // float back in next to your brother
        Object.assign(P, { st: 'drop', t: 0, x: partner.x - partner.face * 1.0, y: partner.y + 2.4, vx: 0, vy: 0, pow: 0, h: PH.smallH, star: 0 });
        ev(S, 'respawn', { p: P.i });
      } else {
        P.st = 'out';
        ev(S, 'out', { p: P.i });
      }
      return;
    }
    S.result = S.lives > 0 ? 'retry' : 'over';
    S.resultT = 0;
    ev(S, S.result);
  }

  // ---------------------------------------------------------------- vents, flag, being carried
  function enterVent(S, P, cx, top) {
    for (const Q of S.players) {
      if (Q.st !== 'play' && Q !== P) continue;
      Object.assign(Q, { st: 'pipe', t: 0, vx: 0, vy: 0, x: Q === P ? cx : Q.x, ax: cx, ay: top });
    }
    S.pipeFrom = { x: cx, y: top };
    ev(S, 'vent', { x: cx, y: top, dir: 'down' });
  }

  function pipeDown(S, P) {
    P.y -= 2.4 * DT;
    if (P.t < 0.85 || P.i !== S.players.find((Q) => Q.st === 'pipe').i) return;
    // everyone in the vent goes through together
    const L = lv(S);
    let dest;
    if (S.room === 0) {
      S.saved = { tiles: S.tiles, ents: S.ents, W: S.W, multi: S.multi };
      S.room = 1;
      loadRoom(S, L.bonus);
      dest = { x: L.bonus.start.x, y: L.bonus.start.y + 1, drop: true };
    } else {
      Object.assign(S, { tiles: S.saved.tiles, ents: S.saved.ents, W: S.saved.W, multi: S.saved.multi, saved: null, room: 0 });
      const ret = L.main.rows ? findVent(S, T.VRET) : null;
      dest = ret || { x: S.pipeFrom0.x, y: S.pipeFrom0.y };
    }
    if (S.room === 1) S.pipeFrom0 = S.pipeFrom;
    S.players.forEach((Q, i) => {
      if (Q.st !== 'pipe') return;
      Q.x = dest.x - i * 0.3;
      Q.vx = Q.vy = 0;
      Q.t = 0;
      Q.plat = 0;
      if (dest.drop) {
        Q.y = dest.y;
        Q.st = 'play';
      } else {
        Q.y = dest.y - Q.h;
        Q.ay = dest.y;
        Q.st = 'rise';
      }
      Q.safeX = Q.x;
      Q.safeY = dest.drop ? 2 : dest.y;
    });
    S.cam.x = clampCam(S, dest.x + 3);
    S.trail.length = 0;
    if (S.bud.on) Object.assign(S.bud, { x: dest.x - 1.2, y: dest.drop ? 2 : dest.y, hopT: -1 }); // he comes through the vent too
    ev(S, 'room', { room: S.room });
  }

  function findVent(S, code) {
    for (let y = 0; y < H; y++) for (let x = 0; x < S.W; x++) if (tile(S, x, y) === code) return { x: x + 1, y: y + 1 };
    return null;
  }

  function pipeUp(S, P) {
    P.y = Math.min(P.ay, P.y + 2.4 * DT);
    if (P.y >= P.ay) {
      P.st = 'play';
      P.gnd = true;
    }
  }

  function grabFlag(S, P) {
    const f = S.flag;
    const k = Math.max(0, Math.min(1, (P.y - f.base) / (f.top - 1 - f.base)));
    const pts = k > 0.92 ? 5000 : k > 0.7 ? 2000 : k > 0.45 ? 800 : k > 0.2 ? 400 : 100;
    addScore(S, pts, f.x, P.y + 1);
    S.cleared = true;
    S.clearBy = P.i;
    for (const Q of S.players) {
      if (Q === P) Object.assign(Q, { st: 'flag', t: 0, vx: 0, vy: 0, x: f.x - Q.w / 2 - 0.08, y: Math.max(Q.y, f.base), face: 1, star: 0 });
      else if (Q.st === 'play') Object.assign(Q, { st: 'pulled', t: 0, ax: Q.x, ay: Q.y, bx: f.x + 1.6, by: f.base, then: 'cele' });
    }
    ev(S, 'flag', { p: P.i, pts, h: k });
  }

  function flagSlide(S, P) {
    const f = S.flag;
    if (P.y > f.base) P.y = Math.max(f.base, P.y - 8 * DT);
    else if (P.t > 0.4 && P.t < 10) {
      P.x = f.x + P.w / 2 + 0.3;
      P.st = 'walk';
      P.t = 0;
      ev(S, 'flagDown', { p: P.i });
    }
  }

  function walkOff(S, P) {
    P.vx = 3.2;
    P.face = 1;
    P.vy = Math.max(-PH.maxFall, P.vy - PH.g * DT);
    moveX(S, P, P.vx * DT);
    const r = moveY(S, P, P.vy * DT, true);
    P.gnd = r.land;
    if (P.t > 1.2) {
      P.st = 'cele';
      P.t = 0;
      P.vx = 0;
      if (S.time !== null) addScore(S, Math.ceil(S.time) * 20);
      ev(S, 'celebrate', { p: P.i, timeBonus: S.time !== null ? Math.ceil(S.time) * 20 : 0 });
      S.clearT = 0;
    }
  }

  // Being carried back to safe ground by the companion, or pulled along by your brother in co-op.
  function carried(S, P) {
    const dur = P.st === 'carried' ? 1.0 : 0.6;
    const k = Math.min(1, P.t / dur);
    const e = k * k * (3 - 2 * k);
    P.x = P.ax + (P.bx - P.ax) * e;
    P.y = P.ay + (P.by - P.ay) * e + Math.sin(k * Math.PI) * (P.st === 'carried' ? 2.5 : 1.2);
    P.vx = P.vy = 0;
    if (k >= 1) {
      P.st = P.then || 'play';
      P.then = null;
      P.t = 0;
      P.inv = Math.max(P.inv, 1.6);
      P.gnd = true;
      P.safeX = P.x;
      P.safeY = P.y;
    }
  }

  // ---------------------------------------------------------------- moving platforms
  function movePlat(S, e, dt = DT) {
    e.ph += dt * Math.PI * (2.2 / 4) * (S.easy ? 0.8 : 1);
    const k = 0.5 - 0.5 * Math.cos(e.ph);
    const nx = e.kind === 'h' ? e.x0 + 4 * k : e.x0;
    const ny = e.kind === 'v' ? e.y0 + 4 * k : e.y0;
    e.dx = dt ? nx - e.x : 0;
    e.dy = dt ? ny - e.y : 0;
    e.x = nx;
    e.y = ny;
  }

  // ---------------------------------------------------------------- enemies and items
  const isEnemy = (e) => e.k === 'zombie' || e.k === 'robot' || e.k === 'ball' || e.k === 'drone' || e.k === 'plant' || e.k === 'boss';

  function updateEnts(S) {
    const camR = S.cam.x + S.cam.vw / 2 + 2, camL = S.cam.x - S.cam.vw / 2 - 12;
    for (const e of S.ents) {
      if (e.dead) continue;
      if (!e.on) {
        if (e.x - e.w / 2 < camR) e.on = true;
        else continue;
      }
      if (isEnemy(e) && e.k !== 'boss' && e.k !== 'plant' && e.x < camL) {
        e.dead = true;
        continue;
      }
      e.t += DT;
      switch (e.k) {
        case 'zombie': walker(S, e, 1.1, false); break;
        case 'robot': robot(S, e); break;
        case 'ball': ball(S, e); break;
        case 'drone': drone(S, e); break;
        case 'plant': plant(S, e); break;
        case 'boss': boss(S, e); break;
        case 'item': item(S, e); break;
        case 'shot': shot(S, e); break;
        case 'bar': e.ang += DT * e.spin * 1.7 * (S.easy ? 0.75 : 1); break;
      }
    }
    // walkers bump into each other and turn around
    const ws = S.ents.filter((e) => e.on && !e.dead && e.st === 'go' && (e.k === 'zombie' || e.k === 'robot'));
    for (let i = 0; i < ws.length; i++) {
      for (let j = i + 1; j < ws.length; j++) {
        const a = ws[i], b = ws[j];
        if (overlap(a, b) && (b.x - a.x) * (a.dir - b.dir) > 0) {
          a.dir = a.x < b.x ? -1 : 1;
          b.dir = -a.dir;
        }
      }
    }
    if (S.frame % 60 === 0) S.ents = S.ents.filter((e) => !e.dead);
  }

  function fall(S, e, g) {
    e.vy = Math.max(-PH.maxFall, e.vy - g * DT);
    const r = moveY(S, e, e.vy * DT, false);
    e.gnd = r.land;
    if (e.y < -3) e.dead = true;
    return r;
  }

  function bonked(S, e) {
    // knocked out: fly up, spin and drop off the screen, through everything
    e.vy -= 30 * DT;
    e.x += e.vx * DT;
    e.y += e.vy * DT;
    if (e.y < -4) e.dead = true;
  }

  function walker(S, e, speed, ledges) {
    if (e.st === 'bonk') return bonked(S, e);
    if (e.st === 'squash') {
      if (e.t > 0.8) e.dead = true;
      return;
    }
    const v = speed * S.es;
    if (moveX(S, e, e.dir * v * DT)) e.dir *= -1;
    else if (ledges && e.gnd) {
      const fx = Math.floor(e.x + e.dir * (e.w / 2 + 0.05));
      if (!groundAt(S, fx, Math.round(e.y) - 1)) {
        e.x -= e.dir * v * DT;
        e.dir *= -1;
      }
    }
    if (e.x < e.w / 2) (e.x = e.w / 2), (e.dir = 1);
    fall(S, e, 40);
  }

  function robot(S, e) {
    if (e.st === 'go') return walker(S, e, 1.4, true);
    if (e.st === 'bonk') return bonked(S, e);
    if (e.st === 'shell') {
      // folded up: after a while it unfolds and walks again
      if (e.t > 7) {
        e.st = 'go';
        e.h = 1.0;
        ev(S, 'unfold', { id: e.id });
      }
      fall(S, e, 40);
      return;
    }
    if (e.st === 'slide') {
      e.kick = Math.max(0, (e.kick || 0) - DT);
      if (moveX(S, e, e.dir * 11 * DT)) {
        e.dir *= -1;
        ev(S, 'clank', { x: e.x, y: e.y });
      }
      fall(S, e, 40);
      // a sliding robot knocks out everything in its way
      for (const o of S.ents) {
        if (o === e || o.dead || !o.on || !isEnemy(o) || o.k === 'boss' || o.k === 'plant' || o.st === 'bonk') continue;
        if (overlap(e, o)) {
          bonk(S, o, e.dir, null);
          S.combo++;
          addScore(S, STOMP_PTS[Math.min(S.combo, STOMP_PTS.length - 1)], o.x, o.y + 1);
        }
      }
    }
  }

  function ball(S, e) {
    if (e.st === 'bonk') return bonked(S, e);
    if (e.st === 'pop') {
      if (e.t > 0.4) e.dead = true;
      return;
    }
    if (moveX(S, e, e.dir * 1.6 * S.es * DT)) e.dir *= -1;
    const r = fall(S, e, 30);
    if (r.land) e.vy = 9.5;
  }

  function drone(S, e) {
    if (e.st === 'bonk') return bonked(S, e);
    e.ph += DT * S.es;
    const nx = e.hx + Math.sin(e.ph * 0.8) * 3;
    e.dir = nx > e.x ? 1 : -1;
    e.x = nx;
    e.y = e.hy + Math.sin(e.ph * 2.3) * 0.5;
  }

  // Snappy plants: hide, peek out, snap, duck. They stay down while a brother stands right next to the vent.
  function plant(S, e) {
    if (e.st === 'bonk') {
      e.up = Math.max(0, e.up - DT * 3);
      if (e.up <= 0) e.dead = true;
      e.h = e.up * 1.3;
      return;
    }
    const near = S.players.some((P) => P.st === 'play' && Math.abs(P.x - e.x) < 1.6);
    const sp = S.es;
    if (e.st === 'down') {
      if (e.t > 1.8 / sp && !near) (e.st = 'rise'), (e.t = 0);
    } else if (e.st === 'rise') {
      e.up = Math.min(1, e.up + (DT / 0.7) * sp);
      if (e.up >= 1) (e.st = 'up'), (e.t = 0);
    } else if (e.st === 'up') {
      if (e.t > 1.4 / sp) (e.st = 'sink'), (e.t = 0);
    } else if (e.st === 'sink') {
      e.up = Math.max(0, e.up - (DT / 0.7) * sp);
      if (e.up <= 0) (e.st = 'down'), (e.t = 0);
    }
    e.y = e.top;
    e.h = e.up * 1.3;
  }

  function boss(S, e) {
    const L = S.players.filter((P) => P.st === 'play');
    const tgt = L.length ? L.reduce((a, b) => (Math.abs(b.x - e.x) < Math.abs(a.x - e.x) ? b : a)) : null;
    if (e.st === 'wait') {
      if (tgt && tgt.x > e.x0 - 1) {
        e.st = 'go';
        e.t = 0;
        ev(S, 'boss', { state: 'wake', x: e.x, y: e.y });
      }
      fall(S, e, 34);
      return;
    }
    if (e.st === 'beaten') {
      fall(S, e, 34);
      return;
    }
    if (e.st === 'dizzy') {
      if (e.t > 1.8) (e.st = 'go'), (e.t = 0);
      fall(S, e, 34);
      return;
    }
    const wasAir = !e.gnd;
    if (tgt && Math.abs(tgt.x - e.x) > 0.4) e.dir = tgt.x > e.x ? 1 : -1;
    const v = (1.3 + 0.35 * S.bossHits) * S.es;
    moveX(S, e, e.dir * v * DT);
    e.x = Math.max(e.x0, Math.min(e.x1 - e.w / 2, e.x));
    if (e.gnd && e.t > e.nextHop) {
      e.vy = 12;
      e.t = 0;
      e.nextHop = 2.0 + rnd(S) * 1.6;
      e.gnd = false;
      ev(S, 'bossHop', { x: e.x });
    }
    const r = fall(S, e, 34);
    if (r.land && wasAir) ev(S, 'thud', { x: e.x, y: e.y });
  }

  function item(S, e) {
    if (e.st === 'rise') {
      e.y = Math.min(e.y0 + 1, e.y + DT / 0.6);
      if (e.y >= e.y0 + 1) {
        e.st = 'go';
        const P = S.players[0];
        e.dir = P && P.x > e.x ? -1 : 1;
        if (e.kind === 'star') e.vy = 8;
      }
      return;
    }
    if (e.kind === 'hoop') return; // the basketball power waits on top of its block
    const v = e.kind === 'star' ? 3.2 : 2.6;
    if (moveX(S, e, e.dir * v * DT)) e.dir *= -1;
    const r = fall(S, e, e.kind === 'star' ? 30 : 40);
    if (r.land && e.kind === 'star') e.vy = 11;
    if (e.x < 0.4) e.dir = 1;
  }

  function shot(S, e) {
    e.life -= DT;
    if (e.life <= 0) {
      e.dead = true;
      ev(S, 'poof', { x: e.x, y: e.y });
      return;
    }
    if (e.kind === 'ball') {
      if (moveX(S, e, e.vx * DT)) {
        e.dead = true;
        ev(S, 'poof', { x: e.x, y: e.y });
        return;
      }
      e.vy = Math.max(-16, e.vy - 45 * DT);
      const r = moveY(S, e, e.vy * DT, false);
      if (r.land) e.vy = 9;
      if (r.head) e.vy = -2;
      if (e.y < -2) e.dead = true;
    } else {
      // Tommy's ✌️ star flies straight, with a little wobble
      if (moveX(S, e, e.vx * DT)) {
        e.dead = true;
        ev(S, 'poof', { x: e.x, y: e.y });
        return;
      }
    }
    for (const o of S.ents) {
      if (o.dead || !o.on || !isEnemy(o) || o.st === 'bonk' || o.st === 'squash' || o.st === 'pop') continue;
      if (o.k === 'plant' && o.up < 0.2) continue;
      if (overlap(e, o)) {
        e.dead = true;
        if (o.k === 'boss') {
          ev(S, 'bossBonk', { x: o.x, y: o.y + 2 });
          return;
        }
        bonk(S, o, Math.sign(e.vx) || 1, S.players[e.owner]);
        addScore(S, 200, o.x, o.y + 1);
        return;
      }
    }
  }

  function bonk(S, e, dir, P) {
    if (e.k === 'boss' || e.st === 'bonk') return;
    e.st = 'bonk';
    e.t = 0;
    e.vy = 9;
    e.vx = dir * 2.5;
    ev(S, 'bonk', { id: e.id, kind: e.k, x: e.x, y: e.y + e.h / 2, by: P ? P.i : -1 });
  }

  // ---------------------------------------------------------------- touching things
  function touchEnts(S, P) {
    for (const e of S.ents) {
      if (e.dead || !e.on || P.st !== 'play') continue;
      if (e.k === 'item') {
        if (e.st !== 'rise' && overlap(P, e)) pickUp(S, P, e);
        continue;
      }
      if (e.k === 'bar') {
        if (P.inv > 0 || P.star > 0) continue;
        for (let i = 1; i <= e.n; i++) {
          const sx = e.cx + Math.cos(e.ang) * i * 0.6, sy = e.cy + Math.sin(e.ang) * i * 0.6;
          const nx = Math.max(P.x - P.w / 2 + 0.08, Math.min(P.x + P.w / 2 - 0.08, sx));
          const ny = Math.max(P.y + 0.08, Math.min(P.y + P.h - 0.08, sy));
          if ((nx - sx) ** 2 + (ny - sy) ** 2 < 0.27 * 0.27) {
            hurt(S, P, null);
            break;
          }
        }
        continue;
      }
      if (!isEnemy(e) || e.st === 'bonk' || e.st === 'squash' || e.st === 'pop') continue;
      if (e.k === 'plant' && e.up < 0.25) continue;
      // a slightly smaller box for "ouch" than for stomping, to be kind
      if (!overlap(P, e)) continue;
      if (P.star > 0 && e.k !== 'boss') {
        bonk(S, e, P.face, P);
        addScore(S, 200, e.x, e.y + 1);
        continue;
      }
      const falling = P.vy < 0 || P.prevY > P.y;
      const above = P.prevY >= e.y + e.h * 0.45;
      if (e.k === 'boss') {
        if (e.st === 'dizzy' || e.st === 'beaten' || e.st === 'wait') {
          if (falling && above) bounce(S, P);
          continue;
        }
        if (falling && above) {
          S.bossHits++;
          bounce(S, P, true);
          P.vy = Math.max(P.vy, 15);
          addScore(S, 1000, e.x, e.y + e.h);
          if (S.bossHits >= 3) {
            e.st = 'beaten';
            S.bossDone = true;
            addScore(S, 5000, e.x, e.y + e.h + 1);
            const cells = [];
            for (let y = 0; y < H; y++) for (let x = 0; x < S.W; x++) if (tile(S, x, y) === T.GATE) (setTile(S, x, y, T.E), cells.push([x, y]));
            ev(S, 'bossBeaten', { x: e.x, y: e.y });
            ev(S, 'gate', { cells });
          } else {
            e.st = 'dizzy';
            e.t = 0;
            ev(S, 'bossHit', { x: e.x, y: e.y + e.h, hits: S.bossHits });
            // he sneezes out a bouncing ball, behind him
            const away = P.x < e.x ? 1 : -1;
            const b = spawn(S, { k: 'ball', x: Math.max(e.x0, Math.min(e.x1 - 0.5, e.x + away * 1.3)), y: e.y + 0.8 });
            b.on = true;
            b.vy = 6;
            b.dir = away;
            P.inv = Math.max(P.inv, 0.5);
          }
        } else hurt(S, P, e);
        continue;
      }
      if (e.k === 'robot' && e.st === 'shell') {
        // a folded robot: touch it to kick it, it never hurts
        e.st = 'slide';
        e.t = 0;
        e.kick = 0.3;
        e.dir = falling && above ? (P.x < e.x ? 1 : -1) : P.x < e.x ? 1 : -1;
        if (falling && above) bounce(S, P);
        else P.x = e.x - e.dir * ((e.w + P.w) / 2 + 0.02);
        addScore(S, 400, e.x, e.y + 1);
        ev(S, 'kick', { id: e.id, x: e.x, y: e.y });
        continue;
      }
      if (e.k === 'robot' && e.st === 'slide') {
        if (falling && above) {
          e.st = 'shell';
          e.t = 0;
          bounce(S, P);
          ev(S, 'stomp', { id: e.id, kind: e.k, x: e.x, y: e.y + e.h, by: P.i });
        }
        continue; // kid rules: a sliding robot never hurts you
      }
      if (falling && above && e.k !== 'plant') {
        stomp(S, e, P);
        bounce(S, P);
        continue;
      }
      hurt(S, P, e);
    }
  }

  function bounce(S, P, big) {
    P.vy = P.pj || big ? PH.stompHeld : PH.stomp;
    P.jumping = true;
    P.gnd = false;
  }

  function stomp(S, e, P) {
    const pts = STOMP_PTS[Math.min(P ? P.combo : 0, STOMP_PTS.length - 1)];
    if (P) P.combo++;
    addScore(S, pts, e.x, e.y + e.h + 0.5);
    if (e.k === 'zombie') {
      e.st = 'squash';
      e.t = 0;
    } else if (e.k === 'robot') {
      e.st = 'shell';
      e.t = 0;
      e.h = 0.6;
      e.vx = 0;
    } else if (e.k === 'ball') {
      e.st = 'pop';
      e.t = 0;
    } else if (e.k === 'drone') {
      e.st = 'bonk';
      e.t = 0;
      e.vy = 2;
      e.vx = 0;
    }
    ev(S, 'stomp', { id: e.id, kind: e.k, x: e.x, y: e.y + e.h, by: P ? P.i : 'buddy' });
  }

  function pickUp(S, P, e) {
    e.dead = true;
    if (e.kind === 'ice') {
      grow(S, P, 1);
      addScore(S, 1000, e.x, e.y + 1);
    } else if (e.kind === 'hoop') {
      grow(S, P, 2);
      addScore(S, 1000, e.x, e.y + 1);
    } else if (e.kind === 'star') {
      P.star = S.easy ? 12 : 10;
      addScore(S, 1000, e.x, e.y + 1);
    } else if (e.kind === 'life') {
      S.lives++;
      ev(S, 'life', { x: e.x, y: e.y });
    }
    ev(S, 'power', { p: P.i, kind: e.kind });
  }

  // ---------------------------------------------------------------- the companion (1P) and the high five (co-op)
  // Call him and the other brother runs in for ~10 s: he follows your path a beat behind, hops onto nearby
  // enemies, grabs coins near him for you, says hi with his signature move and hands you a treat. While he's
  // there he saves you once from a hit or a fall into a pit. Calling again while he's there brings another treat.
  function callBuddy(S) {
    if (S.result || S.cleared) return false;
    if (S.mode === '2p') return highFive(S);
    const b = S.bud;
    const P = S.players[0];
    if (!b.on) {
      Object.assign(b, { on: true, t: 0, saved: false, hopT: -1, cool: 0.8, treatAt: BUD.treatAt, cheer: 0, carry: -1 });
      b.x = Math.min(P.x - 3, S.cam.x - S.cam.vw / 2 + 0.5);
      b.y = P.y;
      b.face = 1;
      ev(S, 'buddy', { state: 'in' });
    } else if (b.t < BUD.visit) {
      if (b.treatAt < b.t) b.treatAt = b.t + 0.7;
      b.cheer = 1.3;
      ev(S, 'buddy', { state: 'again' });
    } else {
      // he was already leaving: turn around and stay for a new visit
      Object.assign(b, { t: 0.8, saved: false, treatAt: BUD.treatAt });
      ev(S, 'buddy', { state: 'in' });
    }
    return true;
  }

  function highFive(S) {
    const ok = S.players.filter((P) => P.st === 'play');
    if (S.hi5.cool > 0 || ok.length < 2) {
      ev(S, 'hi5no', {});
      return false;
    }
    for (const P of ok) {
      P.star = Math.max(P.star, HI5.star);
      P.hi5 = 1.1;
    }
    S.hi5.cool = HI5.cool;
    ev(S, 'hi5', {});
    return true;
  }

  const buddyGuarding = (S) => S.mode === '1p' && S.bud.on && !S.bud.saved && S.bud.t < BUD.visit;

  function buddySave(S, P, how, src) {
    if (!buddyGuarding(S) || P.st !== 'play') return false;
    const b = S.bud;
    b.saved = true;
    b.cheer = 1.4;
    if (how === 'fall') {
      Object.assign(P, { st: 'carried', t: 0, ax: P.x, ay: P.y, bx: P.safeX, by: P.safeY, vx: 0, vy: 0 });
      b.carry = 1.0;
    } else {
      P.inv = 2;
      if (src && isEnemy(src) && src.k !== 'boss') {
        bonk(S, src, src.x > P.x ? 1 : -1, P);
        addScore(S, 200, src.x, src.y + 1);
      }
    }
    ev(S, 'saved', { p: P.i, how });
    return true;
  }

  function updateBuddy(S) {
    // the trail of the leader, so the companion can follow your path a beat behind
    const P = leader(S);
    if (P) {
      S.trail.push(P.x, P.y, P.gnd ? 1 : 0);
      if (S.trail.length > 3 * 40) S.trail.splice(0, 3);
    }
    const b = S.bud;
    if (!b.on || S.mode !== '1p') return;
    b.t += DT;
    b.cool = Math.max(0, b.cool - DT);
    b.cheer = Math.max(0, b.cheer - DT);
    const pl = S.players[0];
    if (b.carry >= 0) {
      // carrying you out of the pit
      b.carry -= DT;
      b.x = pl.x - 0.3 * pl.face;
      b.y = pl.y + 0.2;
      if (b.carry < 0) b.carry = -1;
      return;
    }
    if (b.t > BUD.leave) {
      b.on = false;
      ev(S, 'buddy', { state: 'gone' });
      return;
    }
    // where he wants to be: where you were a third of a second ago, a step behind you
    let tx = pl.x, ty = pl.y;
    const n = S.trail.length / 3;
    if (n > 20) {
      const i = (n - 20) * 3;
      tx = S.trail[i];
      ty = S.trail[i + 1];
    }
    if (Math.abs(pl.vx) < 1 && pl.gnd) tx = pl.x - pl.face * 1.0;
    if (b.t > BUD.visit) tx = S.cam.x - S.cam.vw / 2 - 3; // time to go: he runs back off the screen
    // hop onto a nearby enemy
    if (b.hopT < 0 && b.cool <= 0 && b.t > 0.6 && b.t < BUD.visit && pl.st === 'play') {
      let best = null, bd = 1e9;
      for (const e of S.ents) {
        if (e.dead || !e.on || e.st === 'bonk' || e.st === 'squash' || e.st === 'pop') continue;
        if (!(e.k === 'zombie' || e.k === 'ball' || e.k === 'drone' || (e.k === 'robot' && e.st === 'go'))) continue;
        const d = Math.abs(e.x - b.x) + Math.abs(e.y - b.y) * 0.5;
        if (Math.abs(e.x - pl.x) < 6 && Math.abs(e.y - pl.y) < 4.5 && d < bd) (best = e), (bd = d);
      }
      if (best) {
        Object.assign(b, { hopT: 0, hx0: b.x, hy0: b.y, hdur: 0.45, target: best.id });
        ev(S, 'buddyHop', {});
      }
    }
    if (b.hopT >= 0) {
      b.hopT += DT;
      const e = S.ents.find((o) => o.id === b.target);
      if (e) (b.hx1 = e.x), (b.hy1 = e.y + e.h);
      const k = Math.min(1, b.hopT / b.hdur);
      b.x = b.hx0 + (b.hx1 - b.hx0) * k;
      b.y = b.hy0 + (b.hy1 - b.hy0) * k + Math.sin(k * Math.PI) * 2.2;
      b.face = b.hx1 >= b.hx0 ? 1 : -1;
      if (k >= 1) {
        b.hopT = -1;
        b.cool = 0.5;
        if (e && !e.dead && e.st !== 'bonk' && e.st !== 'squash' && e.st !== 'pop') {
          stomp(S, e, null);
          if (e.k === 'robot') bonk(S, e, b.face, null); // he kicks the folded robot away too
        }
      }
    } else {
      const dx = tx - b.x;
      const sp = Math.min(Math.abs(dx), (b.t < 1 || b.t > BUD.visit ? 16 : 13) * DT);
      b.x += Math.sign(dx) * sp;
      b.y += (ty - b.y) * Math.min(1, 14 * DT);
      if (Math.abs(dx) > 0.05) b.face = Math.sign(dx);
    }
    // grab coins near him
    const bx0 = Math.floor(b.x - 1.6), bx1 = Math.floor(b.x + 1.6), by0 = Math.floor(b.y - 0.5), by1 = Math.floor(b.y + 2.2);
    for (let y = Math.max(0, by0); y <= by1; y++) {
      for (let x = bx0; x <= bx1; x++) {
        if (tile(S, x, y) === T.COIN) {
          setTile(S, x, y, T.E);
          addCoin(S, x + 0.5, y + 0.5, 'buddy');
        }
      }
    }
    if (b.treatAt >= 0 && b.t >= b.treatAt) {
      b.treatAt = -1;
      b.treats++;
      ev(S, 'treat', { n: b.treats, x: b.x, y: b.y });
    }
  }

  // ---------------------------------------------------------------- camera, tips, the end
  function leader(S) {
    let best = null;
    for (const P of S.players) {
      if (P.st === 'out' || P.st === 'dizzy' || P.st === 'fell' || P.st === 'drop' || P.st === 'time') continue;
      if (!best || P.x > best.x) best = P;
    }
    return best;
  }

  function updateCamera(S) {
    const L = leader(S);
    if (!L) return;
    // look ahead the way the leader faces, so you can see what's coming
    const target = clampCam(S, L.x + (S.mode === '2p' ? 2.5 : L.face * 2.5));
    S.cam.x += (target - S.cam.x) * Math.min(1, 4 * DT);
    // keep the leader well inside the screen
    const half = S.cam.vw / 2;
    if (L.x > S.cam.x + half - 5) S.cam.x = clampCam(S, L.x - half + 5);
    if (L.x < S.cam.x - half + 3) S.cam.x = clampCam(S, L.x + half - 3);
    // co-op: the brother who falls behind gets pulled along
    if (S.mode === '2p') {
      for (const P of S.players) {
        if (P === L || P.st !== 'play' || L.st !== 'play') continue;
        if (P.x < S.cam.x - half + 0.6) {
          Object.assign(P, { st: 'pulled', t: 0, ax: P.x, ay: P.y, bx: L.safeX - L.face * 0.8, by: L.safeY, vx: 0, vy: 0 });
          ev(S, 'pulled', { p: P.i });
        }
      }
    }
  }

  function tips(S) {
    const T_ = lv(S).tips;
    const L = leader(S);
    if (!L || S.room) return;
    while (S.tipI < T_.length && L.x >= T_[S.tipI][0]) {
      ev(S, 'tip', { text: T_[S.tipI][1] });
      S.tipI++;
    }
  }

  function checkDone(S) {
    if (!S.cleared) return;
    S.clearT += DT;
    const cele = S.players.some((P) => P.st === 'cele');
    if (cele && S.players.every((P) => P.st === 'cele' || P.st === 'out' || P.st === 'pulled' || P.st === 'dizzy' || P.st === 'fell' || P.st === 'drop')) {
      if (S.players.some((P) => P.st === 'cele' && P.t > 2.8)) {
        S.result = 'clear';
        S.resultT = 0;
        ev(S, 'clear', {});
      }
    }
  }

  // ---------------------------------------------------------------- copying (for the bot) and summaries
  function clone(S) {
    const C = Object.assign({}, S);
    C.tiles = S.tiles.slice();
    C.ents = S.ents.map((e) => Object.assign({}, e));
    C.players = S.players.map((p) => Object.assign({}, p));
    C.bud = Object.assign({}, S.bud);
    C.hi5 = Object.assign({}, S.hi5);
    C.cam = Object.assign({}, S.cam);
    C.multi = Object.assign({}, S.multi);
    C.trail = S.trail.slice();
    C.ev = [];
    if (S.saved) C.saved = { tiles: S.saved.tiles.slice(), ents: S.saved.ents.map((e) => Object.assign({}, e)), W: S.saved.W, multi: Object.assign({}, S.saved.multi) };
    return C;
  }

  TNT.engine = {
    DT, H, VIEW_W, T, PH, BUD, HI5, SOLID, prep, create, step, clone, callBuddy, buddyGuarding, tile, leader, isEnemy, spawn,
    levelCount: () => window.TNT_LEVELS.length,
  };
})();

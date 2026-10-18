#!/usr/bin/env node
/* Mechanics check: small scripted scenes run on the real engine (js/engine.js), each with a yes/no answer.
     node tools/scenarios.js
   Every scene starts on level 1's flat start area unless it says otherwise. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = { console, Math, Date, JSON };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['js/levels.js', 'js/engine.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
const E = ctx.TNT.engine;
const T = E.T;

const run = (S, sec, inp = {}) => { for (let i = 0; i < Math.round(sec * 60); i++) E.step(S, Array.isArray(inp) ? inp : [inp]); };
const at = (S, k, x, y, extra) => { const e = E.spawn(S, { k, x, y }); e.on = true; return Object.assign(e, extra || {}); };
const fresh = (li = 0, o = {}) => E.create(li, Object.assign({ chars: ['teddy'] }, o));
const results = [];
function check(name, fn) {
  let ok = false, why = '';
  try { const r = fn(); ok = r === true; if (!ok) why = typeof r === 'string' ? r : JSON.stringify(r); } catch (e) { why = e.stack.split('\n').slice(0, 2).join(' '); }
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ': ' + why}`);
}
const kinds = (S) => S.ev.map((e) => e.k);

check('stomping a zombie squashes it and bounces you up', () => {
  const S = fresh();
  const z = at(S, 'zombie', 8.5, 2);
  Object.assign(S.players[0], { x: 8.5, y: 4.5, vy: -2 });
  run(S, 0.3);
  return z.st === 'squash' && S.score >= 100 || { st: z.st, score: S.score };
});

check('walking into a zombie when small makes you dizzy, then costs a life', () => {
  const S = fresh();
  at(S, 'zombie', 6, 2);
  Object.assign(S.players[0], { x: 4.5 });
  run(S, 0.6, { r: 1 });
  const dizzy = S.players[0].st === 'dizzy';
  run(S, 3);
  return (dizzy && S.result === 'retry' && S.lives === 4) || { st: S.players[0].st, result: S.result, lives: S.lives };
});

check('a hit when big only shrinks you', () => {
  const S = fresh(0, { pow: [1] });
  at(S, 'zombie', 6, 2);
  Object.assign(S.players[0], { x: 4.5 });
  run(S, 0.6, { r: 1 });
  const P = S.players[0];
  return (P.st === 'play' && P.pow === 0 && P.inv > 0) || { st: P.st, pow: P.pow };
});

check('a TT block gives a coin, then turns into a used block', () => {
  const S = fresh(); // level 1 has a coin TT block at (9, 5)
  Object.assign(S.players[0], { x: 9.5 });
  run(S, 0.5, { j: 1 });
  return (S.coins === 1 && E.tile(S, 9, 5) === T.USED) || { coins: S.coins, tile: E.tile(S, 9, 5) };
});

check('a small brother bumps bricks, a big one breaks them', () => {
  const S = fresh(0);
  Object.assign(S.players[0], { x: 24.5 }); // B?BMB at x = 24..28, y = 5
  run(S, 0.5, { j: 1 });
  const small = E.tile(S, 24, 5) === T.BRICK;
  const S2 = fresh(0, { pow: [1] });
  Object.assign(S2.players[0], { x: 24.5 });
  run(S2, 0.5, { j: 1 });
  return (small && E.tile(S2, 24, 5) === T.E) || { small, big: E.tile(S2, 24, 5) };
});

check('the power-up block gives 🍦 when small and 🏀 when big', () => {
  const S = fresh(0);
  Object.assign(S.players[0], { x: 27.5 });
  run(S, 0.4, { j: 1 });
  const a = S.ents.find((e) => e.k === 'item');
  const S2 = fresh(0, { pow: [1] });
  Object.assign(S2.players[0], { x: 27.5 });
  run(S2, 0.4, { j: 1 });
  const b = S2.ents.find((e) => e.k === 'item');
  return (a && a.kind === 'ice' && b && b.kind === 'hoop') || { a: a && a.kind, b: b && b.kind };
});

check('eating the 🍦 makes you big', () => {
  const S = fresh();
  const it = at(S, 'item', 6, 2, { kind: 'ice', st: 'go', w: 0.8, h: 0.8, dir: -1 });
  Object.assign(S.players[0], { x: 4.5 });
  run(S, 0.8, { r: 1 });
  return (S.players[0].pow === 1 && it.dead) || { pow: S.players[0].pow };
});

for (const ch of ['teddy', 'tommy']) {
  check(`${ch} throws (basketball power) and knocks out a zombie`, () => {
    const S = fresh(0, { chars: [ch], pow: [2] });
    const z = at(S, 'zombie', 12, 2);
    Object.assign(S.players[0], { x: 5.5, face: 1 });
    run(S, 0.1, { th: 1 });
    run(S, 1.2);
    return z.st === 'bonk' || { st: z.st, shots: S.ents.filter((e) => e.k === 'shot').length };
  });
}

check('⭐ star power knocks out enemies you touch', () => {
  const S = fresh();
  const z = at(S, 'zombie', 7, 2);
  Object.assign(S.players[0], { x: 4.5, star: 5 });
  run(S, 0.8, { r: 1 });
  return (z.st === 'bonk' && S.players[0].st === 'play') || { z: z.st };
});

check('a stomped robot folds up, a touch kicks it, and it knocks out a zombie', () => {
  const S = fresh();
  const r = at(S, 'robot', 8.5, 2);
  const z = at(S, 'zombie', 15, 2);
  z.dir = -1;
  Object.assign(S.players[0], { x: 8.5, y: 4.6, vy: -2 });
  run(S, 0.25);
  const shell = r.st === 'shell';
  Object.assign(S.players[0], { x: 6.8, y: 2, vy: 0, vx: 0 });
  run(S, 0.4, { r: 1 });
  run(S, 1.2);
  return (shell && z.st === 'bonk') || { shell, robot: r.st, zombie: z.st };
});

check('100 coins give an extra life', () => {
  const S = fresh(0, { coins: 99 });
  const lives = S.lives;
  Object.assign(S.players[0], { x: 9.5 });
  run(S, 0.5, { j: 1 });
  return (S.lives === lives + 1 && S.coins === 0) || { lives: S.lives, coins: S.coins };
});

check('the companion comes when called, stays about 10 s and gives a treat', () => {
  const S = fresh();
  S.quiet = false;
  E.callBuddy(S);
  run(S, 4);
  const treat = S.ev.some((e) => e.k === 'treat');
  const on = S.bud.on;
  run(S, 9);
  return (on && treat && !S.bud.on) || { on, treat, after: S.bud.on };
});

check('calling again while he is there brings another treat', () => {
  const S = fresh();
  S.quiet = false;
  E.callBuddy(S);
  run(S, 5);
  E.callBuddy(S);
  run(S, 1.5);
  return S.ev.filter((e) => e.k === 'treat').length === 2 || S.ev.filter((e) => e.k === 'treat').length;
});

check('the companion saves you from one hit ("TOMMY SAVED YOU!"), not two', () => {
  const S = fresh();
  S.quiet = false;
  E.callBuddy(S);
  run(S, 1);
  at(S, 'zombie', S.players[0].x + 1.2, 2);
  run(S, 0.5, { r: 1 });
  const saved = S.ev.some((e) => e.k === 'saved') && S.players[0].st === 'play';
  run(S, 2.5);
  at(S, 'zombie', S.players[0].x + 1.2, 2);
  run(S, 0.6, { r: 1 });
  return (saved && S.players[0].st === 'dizzy') || { saved, st: S.players[0].st };
});

check('the companion catches you in a pit and puts you back on solid ground', () => {
  const S = fresh();
  S.quiet = false;
  Object.assign(S.players[0], { x: 88 });
  run(S, 0.2);
  E.callBuddy(S);
  run(S, 0.5);
  Object.assign(S.players[0], { x: 91.5, y: 3, vx: 0 }); // the gap at x = 91..92
  run(S, 2.5);
  const P = S.players[0];
  return (S.ev.some((e) => e.k === 'saved') && P.st === 'play' && P.y >= 2 && S.result === null) || { st: P.st, x: P.x, y: P.y, result: S.result };
});

check('the companion stomps a zombie near you', () => {
  const S = fresh();
  E.callBuddy(S);
  run(S, 1.0);
  const z = at(S, 'zombie', S.players[0].x + 4, 2);
  run(S, 1.5);
  return z.st === 'squash' || z.st;
});

check('co-op: the high five gives both brothers star power, then needs a rest', () => {
  const S = fresh(0, { chars: ['teddy', 'tommy'], mode: '2p' });
  const a = E.callBuddy(S);
  const both = S.players.every((P) => P.star > 3);
  const b = E.callBuddy(S);
  return (a && both && !b) || { a, both, b };
});

check('co-op: the brother who falls behind is pulled along', () => {
  const S = fresh(0, { chars: ['teddy', 'tommy'], mode: '2p' });
  run(S, 6, [{ r: 1, run: 1 }, {}]);
  const [A, B] = S.players;
  return (B.x > S.cam.x - S.cam.vw / 2 && A.x - B.x < 14) || { A: A.x, B: B.x, cam: S.cam.x };
});

check('co-op: a brother who falls in a pit floats back in next to the other one', () => {
  const S = fresh(0, { chars: ['teddy', 'tommy'], mode: '2p' });
  Object.assign(S.players[0], { x: 95 });
  Object.assign(S.players[1], { x: 91.5, y: 3 });
  run(S, 3);
  const B = S.players[1];
  return (B.st === 'play' && S.lives === 4 && Math.abs(B.x - S.players[0].x) < 3) || { st: B.st, lives: S.lives, x: B.x };
});

check('vents: down into the bonus room and back up out of the vent', () => {
  const S = fresh();
  Object.assign(S.players[0], { x: 70, y: 5 });
  run(S, 0.2);
  run(S, 0.3, { d: 1 });
  run(S, 1);
  const inBonus = S.room === 1;
  Object.assign(S.players[0], { x: 14, y: 4 });
  run(S, 0.2);
  run(S, 0.3, { d: 1 });
  run(S, 2);
  return (inBonus && S.room === 0 && Math.abs(S.players[0].x - 70) < 0.5 && S.players[0].st === 'play') || { inBonus, room: S.room, x: S.players[0].x };
});

check('the Zombie King takes 3 stomps, then the gate opens', () => {
  const S = fresh(9, { pow: [1] });
  const K = S.ents.find((e) => e.k === 'boss');
  let gateBefore = 0;
  for (let i = 0; i < S.tiles.length; i++) if (S.tiles[i] === T.GATE) gateBefore++;
  for (let n = 0; n < 3; n++) {
    K.on = true;
    if (K.st === 'wait') K.st = 'go';
    K.st = 'go';
    for (const e of S.ents) if (e.k === 'ball') e.dead = true;
    Object.assign(S.players[0], { x: K.x, y: K.y + K.h + 0.6, vy: -3, st: 'play', inv: 0 });
    run(S, 0.15);
  }
  let gateAfter = 0;
  for (let i = 0; i < S.tiles.length; i++) if (S.tiles[i] === T.GATE) gateAfter++;
  return (S.bossHits === 3 && K.st === 'beaten' && gateBefore > 0 && gateAfter === 0) || { hits: S.bossHits, st: K.st, gateBefore, gateAfter };
});

check('the flagpole ends the level with a celebration', () => {
  const S = fresh();
  Object.assign(S.players[0], { x: S.flag.x - 2, y: 6 });
  run(S, 0.1);
  run(S, 6, { r: 1 });
  return S.result === 'clear' || { result: S.result, st: S.players[0].st };
});

check('EASY has no timer; NORMAL runs out of time', () => {
  const a = fresh(0, { easy: true });
  const b = fresh(0, { easy: false });
  b.time = 0.5;
  run(b, 1);
  return (a.time === null && b.players[0].st === 'time') || { easy: a.time, st: b.players[0].st };
});

const bad = results.filter((r) => !r).length;
console.log(bad ? `${bad} of ${results.length} FAILED` : `all ${results.length} scenes passed`);
process.exit(bad ? 1 : 0);

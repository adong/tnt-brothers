/* TNT Brothers level bot: proves a level can be finished, by playing it with the real engine.
   It's a beam search: every 0.1 s it tries 10 button combinations from each of the best ~150 positions it has found
   so far, keeps the ones that got furthest without losing a life, and repeats until somebody touches the flagpole.
   It plays NORMAL (full speed enemies), small or big as it happens, never calls the companion and never needs the
   star. The winning button presses come back as a short string, so the game can replay them as a demo.
   Exposes window.TNT.bot. */
(function () {
  'use strict';
  const TNT = (window.TNT = window.TNT || {});

  const MACROS = [
    { r: 1 }, { r: 1, run: 1 }, { r: 1, run: 1, j: 1 }, { r: 1, j: 1 }, {},
    { l: 1 }, { l: 1, j: 1 }, { j: 1 }, { l: 1, run: 1 }, { r: 1, run: 1, j: 1, th: 1 },
  ];
  const LETTERS = 'abcdefghij';
  const FRAMES = 6; // each choice is held for 6 frames (0.1 s)

  function keyOf(S) {
    const P = S.players[0];
    return [
      Math.round(P.x * 3), Math.round(P.y * 2), P.gnd ? 1 : 0, Math.round(P.vy / 4), Math.round(P.vx / 3),
      P.pow, S.room, S.bossHits, P.pj ? 1 : 0,
    ].join(',');
  }

  // How promising a position is: mostly the furthest this line of play has got (so riding a platform back to wait
  // for the next one isn't thrown away), plus a little for where it is now.
  function score(S, far) {
    const P = S.players[0];
    let s = far + P.x * 0.1 + S.bossHits * 40 + P.pow * 0.6;
    if (S.room) s -= 60; // the bonus room is a detour
    if (P.st === 'carried') s -= 30;
    return s;
  }

  const won = (S) => S.cleared;
  const lost = (S) => S.result === 'retry' || S.result === 'over' || ['dizzy', 'fell', 'time', 'carried'].includes(S.players[0].st);

  // solve(levelIndex, { beam, maxSeconds, ch }) -> { ok, seconds, demo, best, nodes, reason }
  function solve(li, opts = {}) {
    const E = TNT.engine;
    const K = opts.beam || 150;
    const maxDepth = Math.ceil((opts.maxSeconds || 240) / (FRAMES * E.DT));
    const root = { S: E.create(li, { quiet: true, chars: [opts.ch || 'teddy'], mode: '1p', easy: !!opts.easy }), parent: null, m: -1 };
    if (opts.mutate) opts.mutate(root.S);
    let beam = [root];
    let nodes = 0, bestX = 0;
    // walk: never hold the run button (how a little one on a touch screen might play)
    const allowed = MACROS.map((m, i) => i).filter((i) => !(opts.walk && MACROS[i].run));
    for (let d = 0; d < maxDepth; d++) {
      const kids = new Map();
      for (const node of beam) {
        for (const m of allowed) {
          const S = E.clone(node.S);
          const inp = [MACROS[m]];
          for (let f = 0; f < FRAMES; f++) E.step(S, inp);
          nodes++;
          if (lost(S)) continue;
          const far = S.room ? node.far || 0 : Math.max(node.far || 0, S.players[0].x);
          const kid = { S, parent: node, m, far, sc: score(S, far) };
          if (won(S)) return finish(kid, d + 1, nodes);
          const key = keyOf(S);
          const prev = kids.get(key);
          if (!prev || prev.sc < kid.sc) kids.set(key, kid);
        }
      }
      const prevBest = beam[0];
      // keep the best positions, but always keep some standing on solid ground too: a jump that looks far
      // can still end in a pit, and the brother who waits for the platform is the one who makes it
      const all = [...kids.values()].sort((a, b) => b.sc - a.sc);
      const safe = all.filter((k) => k.S.players[0].gnd).slice(0, Math.floor(K * 0.4));
      const keep = new Set(safe);
      for (const k of all) {
        if (keep.size >= K) break;
        keep.add(k);
      }
      beam = [...keep];
      if (!beam.length) return { ok: false, reason: 'every try lost a life', best: +bestX.toFixed(1), nodes, seconds: (d * FRAMES) / 60, demo: finish(prevBest, d, nodes).demo };
      bestX = Math.max(bestX, beam[0].S.players[0].x);
    }
    return { ok: false, reason: 'ran out of time', best: +bestX.toFixed(1), nodes, seconds: (maxDepth * FRAMES) / 60 };
  }

  function finish(node, depth, nodes) {
    const ms = [];
    for (let n = node; n && n.m >= 0; n = n.parent) ms.push(LETTERS[n.m]);
    return { ok: true, seconds: +((depth * FRAMES) / 60).toFixed(1), demo: ms.reverse().join(''), nodes, best: node.S.players[0].x };
  }

  // The input a demo string asks for at a given frame (null when it's finished).
  function demoInput(demo, frame) {
    const i = Math.floor(frame / FRAMES);
    if (i >= demo.length) return null;
    return MACROS[LETTERS.indexOf(demo[i])] || {};
  }

  TNT.bot = { solve, demoInput, MACROS, FRAMES };
})();

/* TNT Brothers sounds: the kit's synth effects plus a few of our own, built from Kit.sound.tone / hiss.
   Exposes window.TNT.sfx(name, arg). */
(function () {
  'use strict';
  const TNT = (window.TNT = window.TNT || {});
  const S = Kit.sound;
  const tone = (o) => S.tone(o);
  const hiss = (o) => S.hiss(o);

  const OWN = {
    // a soft squish for a stomp, a little higher for each enemy in a row
    stomp(n = 0) {
      const k = Math.pow(2, Math.min(n, 8) / 12);
      tone({ f: 420 * k, to: 160 * k, dur: 0.12, vol: 0.3, type: 'square', lp: 1800 });
      hiss({ filter: 'lowpass', f: 1200, to: 300, dur: 0.08, vol: 0.2 });
    },
    // bumping a block from below
    block() { tone({ f: 180, to: 120, dur: 0.09, vol: 0.3, type: 'triangle' }); },
    // breaking a brick into bits
    break() {
      hiss({ filter: 'lowpass', f: 2600, to: 400, dur: 0.25, vol: 0.35 });
      tone({ f: 220, to: 80, dur: 0.15, vol: 0.25, type: 'square', lp: 1200 });
    },
    // a power-up popping out of a TT block
    sprout() { [392, 523, 659, 784].forEach((f, i) => tone({ type: 'square', f, at: i * 0.06, dur: 0.09, vol: 0.06, lp: 2600 })); },
    // shrinking after a hit
    shrink() { [660, 523, 440, 330].forEach((f, i) => tone({ type: 'square', f, at: i * 0.07, dur: 0.1, vol: 0.07, lp: 2000 })); },
    // a vent: whoosh down the tube
    vent() {
      hiss({ filter: 'lowpass', f: 2200, to: 200, dur: 0.7, vol: 0.3, attack: 0.05 });
      tone({ f: 300, to: 90, dur: 0.6, vol: 0.12, type: 'sine' });
    },
    kick() { tone({ f: 160, to: 60, dur: 0.12, vol: 0.4 }); hiss({ filter: 'highpass', f: 2000, dur: 0.06, vol: 0.15 }); },
    clank() { tone({ f: 900, to: 600, dur: 0.06, vol: 0.12, type: 'square', lp: 3000 }); },
    throwBall() { hiss({ f: 1800, to: 700, dur: 0.15, vol: 0.12, q: 1.2 }); tone({ f: 500, to: 700, dur: 0.08, vol: 0.06, type: 'triangle' }); },
    throwStar() { [1047, 1319, 1568].forEach((f, i) => tone({ type: 'triangle', f, at: i * 0.03, dur: 0.12, vol: 0.08 })); },
    poof() { hiss({ filter: 'lowpass', f: 1500, to: 300, dur: 0.15, vol: 0.12 }); },
    pop() { tone({ f: 900, to: 200, dur: 0.1, vol: 0.25, type: 'square', lp: 2400 }); hiss({ filter: 'highpass', f: 3000, dur: 0.1, vol: 0.2 }); },
    oneUp() { [659, 784, 1319, 1047, 1175, 1568].forEach((f, i) => tone({ type: 'square', f, at: i * 0.09, dur: 0.11, vol: 0.06, lp: 3000 })); },
    checkpoint() { [523, 784, 1047].forEach((f, i) => tone({ type: 'triangle', f, at: i * 0.08, dur: 0.18, vol: 0.14 })); },
    dizzy() {
      [784, 698, 587, 523, 440, 392].forEach((f, i) => tone({ type: 'triangle', f, at: i * 0.12, dur: 0.14, vol: 0.12 }));
      tone({ type: 'sine', f: 1200, to: 1500, at: 0.8, dur: 0.6, vol: 0.05 });
    },
    fall() { tone({ type: 'square', f: 700, to: 120, dur: 0.9, vol: 0.06, lp: 1800 }); },
    // the flag sliding down the pole
    flag() { tone({ type: 'square', f: 1200, to: 300, dur: 0.9, vol: 0.05, lp: 2000 }); },
    // level clear: a happy little fanfare
    clear() {
      const notes = [523, 659, 784, 1047, 0, 784, 1047];
      notes.forEach((f, i) => f && tone({ type: 'square', f, at: i * 0.13, dur: i === notes.length - 1 ? 0.5 : 0.12, vol: 0.07, lp: 2800 }));
      notes.forEach((f, i) => f && tone({ type: 'triangle', f: f / 2, at: i * 0.13, dur: 0.14, vol: 0.12 }));
    },
    // the companion arriving / saving you
    hello() { [784, 988, 1175].forEach((f, i) => tone({ type: 'triangle', f, at: i * 0.07, dur: 0.15, vol: 0.12 })); },
    saved() {
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ type: 'triangle', f, at: i * 0.05, dur: 0.2, vol: 0.13 }));
      hiss({ filter: 'highpass', f: 3000, to: 6000, dur: 0.3, vol: 0.1 });
    },
    // co-op high five: a clap and a sparkle
    hi5() {
      hiss({ filter: 'bandpass', f: 1800, q: 0.8, dur: 0.12, vol: 0.5 });
      [1047, 1319, 1568, 2093].forEach((f, i) => tone({ type: 'triangle', f, at: 0.05 + i * 0.05, dur: 0.2, vol: 0.1 }));
    },
    nope() { tone({ type: 'square', f: 200, dur: 0.12, vol: 0.06, lp: 1200 }); },
    thud() { tone({ f: 90, to: 40, dur: 0.3, vol: 0.5 }); hiss({ filter: 'lowpass', f: 600, to: 100, dur: 0.3, vol: 0.3 }); },
    bossHit() {
      tone({ f: 300, to: 90, dur: 0.25, vol: 0.4, type: 'square', lp: 1500 });
      [880, 1100, 880, 1100].forEach((f, i) => tone({ type: 'triangle', f, at: 0.15 + i * 0.08, dur: 0.08, vol: 0.08 }));
    },
    bossBeaten() {
      S.crash();
      [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone({ type: 'square', f, at: 0.3 + i * 0.1, dur: 0.16, vol: 0.07, lp: 2600 }));
    },
    gate() { hiss({ filter: 'lowpass', f: 900, to: 200, dur: 1.0, vol: 0.25, attack: 0.1 }); tone({ f: 70, to: 50, dur: 1.0, vol: 0.2 }); },
    timeLow() { [988, 988].forEach((f, i) => tone({ type: 'square', f, at: i * 0.12, dur: 0.08, vol: 0.06 })); },
    // star power: a quick twinkle every beat while it lasts
    twinkle() { [1568, 2093].forEach((f, i) => tone({ type: 'triangle', f, at: i * 0.05, dur: 0.08, vol: 0.04 })); },
  };

  TNT.sfx = function (name, arg) {
    try {
      if (OWN[name]) OWN[name](arg);
      else if (S[name]) S[name](arg);
    } catch (e) { /* audio is never worth a crash */ }
  };
})();

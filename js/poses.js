/* TNT Brothers poses: the kit's poses (Kit.people.pose) plus a few a platformer needs: standing idle, skidding,
   sitting dizzy, hanging on the flagpole, tossing a ball, a high five and carrying. Exposes window.TNT.pose. */
(function () {
  'use strict';
  const TNT = (window.TNT = window.TNT || {});
  const KIT_MODES = new Set(Kit.people.MODES);

  const OWN = {
    idle: (s) => ({ ll: 0.04, rl: -0.04, la: 0.08 + s * 0.03, ra: 0.08 - s * 0.03, az: 0.1, lean: -0.04, head: 0.02, bob: s * 0.012 }),
    skid: () => ({ ll: 0.7, rl: -0.35, la: 0.9, ra: 1.3, az: 0.7, lean: 0.3, head: -0.15, bob: -0.04 }),
    dizzySit: (s, ph) => ({ ll: 1.45, rl: 1.35, la: -0.5, ra: -0.5, az: 0.35, lean: -0.05, head: 0.15 + Math.sin(ph * 3) * 0.12, rig: -0.36, tilt: Math.sin(ph * 2) * 0.12 }),
    hang: () => ({ ll: 0.35, rl: 0.15, la: 2.95, ra: 2.75, az: 0.1, lean: 0.05, head: -0.2 }),
    toss: () => ({ ll: 0.4, rl: -0.3, la: -0.4, ra: 1.85, az: 0.15, lean: -0.2, twist: -0.3 }),
    hi5: (s, ph) => ({ ll: 0.1, rl: -0.1, la: 0.3, ra: 3.0, raz: 0.25 + Math.sin(ph * 6) * 0.1, az: 0.2, lean: 0.05, head: -0.2 }),
    carry: () => ({ ll: 0.6, rl: -0.3, la: 2.7, ra: 2.7, az: 0.15, lean: -0.1, head: -0.3 }),
    cheer: (s, ph) => ({ ll: 0.1, rl: -0.1, la: 2.9 + Math.sin(ph * 5) * 0.15, ra: 2.9 - Math.sin(ph * 5) * 0.15, az: 0.4, lean: 0, head: -0.15, bob: Math.abs(Math.sin(ph * 5)) * 0.06 }),
  };
  const STILL = new Set(['peace', 'wave', 'boxing', 'guard', 'jab', 'straight', 'jumpshot', 'give']);

  // pose(p, phase, mode, k, still): like Kit.people.pose, plus the modes above. With `still`, poses that stride
  // (peace, wave, give, boxing) keep the legs planted, for standing celebrations.
  function pose(p, ph, mode, k, still) {
    const rigTo = (v) => { p.rig.position.y += (v - p.rig.position.y) * k; };
    const tiltTo = (v) => { p.rig.rotation.z += (v - p.rig.rotation.z) * k; };
    if (KIT_MODES.has(mode)) {
      Kit.people.pose(p, ph, mode, k);
      if (still && STILL.has(mode)) {
        p.legL.rotation.x *= 0.25;
        p.legR.rotation.x *= 0.25;
        p.hips.position.y = p.hipY + (p.hips.position.y - p.hipY) * 0.3;
      }
      rigTo(0.55);
      tiltTo(0);
      return;
    }
    const f = OWN[mode] || OWN.idle;
    const t = f(Math.sin(ph), ph);
    const to = (o, prop, v) => { o[prop] += (v - o[prop]) * k; };
    const az = t.az || 0;
    to(p.legL.rotation, 'x', t.ll || 0);
    to(p.legR.rotation, 'x', t.rl || 0);
    to(p.armL.rotation, 'x', t.la || 0);
    to(p.armR.rotation, 'x', t.ra || 0);
    to(p.armL.rotation, 'z', t.laz !== undefined ? t.laz : -az);
    to(p.armR.rotation, 'z', t.raz !== undefined ? t.raz : az);
    to(p.hips.rotation, 'x', t.lean || 0);
    to(p.hips.rotation, 'y', t.twist || 0);
    to(p.head.rotation, 'x', t.head || 0);
    p.hips.position.y = p.hipY + (t.bob || 0);
    rigTo(0.55 + (t.rig || 0));
    tiltTo(t.tilt || 0);
    if (p.fingers) for (const fi of p.fingers) fi.visible = false;
    p.rig.scale.setScalar(p.rig.scale.x + (1 - p.rig.scale.x) * k);
  }

  // A brother's victory dance at the flag, `t` seconds in. Teddy shadow-boxes like Mike Tyson, then sinks a jump
  // shot; Tommy does his Y with peace fingers. Returns { mode, hop, shoot } (shoot: the moment the 🏀 leaves).
  function celebration(ch, t) {
    if (ch === 'tommy') return { mode: 'peace', hop: t > 0.3 && t < 0.75 ? Math.sin(((t - 0.3) / 0.45) * Math.PI) * 0.5 : 0, still: true };
    if (t < 1.5) return { mode: 'boxing', hop: 0, still: true };
    const u = (t - 1.5) / 0.8;
    if (u < 1) return { mode: 'jumpshot', hop: Math.sin(u * Math.PI) * 0.9, shoot: u > 0.45, still: true };
    return { mode: 'cheer', hop: 0 };
  }

  TNT.pose = pose;
  TNT.celebration = celebration;
})();

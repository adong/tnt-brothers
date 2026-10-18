/* TNT Brothers art: every texture is painted on a canvas and every model is built from boxes, here.
   Themes (park, subway, sky, castle) set the colours, the tiles and the scenery. Exposes window.TNT.art. */
(function () {
  'use strict';
  const TNT = (window.TNT = window.TNT || {});
  const T = THREE;
  const G = Kit.gfx;
  const { makeCanvas, toTexture, shade, roundRect } = G;
  const BLOCK_FONT = '"Arial Black", "Arial Bold", Impact, sans-serif';

  // ---------------------------------------------------------------- themes
  const THEMES = {
    park: {
      sky: ['#3fa9ff', '#a8dcff', '#e6f6ff'], fog: '#cfeaff', fogNear: 40, fogFar: 140,
      hemi: ['#ffffff', '#5e7f45', 1.0], sun: ['#fff0d0', 1.3],
      top: '#53c23a', topDark: '#3a9a28', dirt: '#a8703f', dirtDark: '#7d4f2a',
      brick: '#d0652c', mortar: '#7d3417', hard: 'crate', semi: '#b77a43', plat: 'plank', vent: '#7bd3c4',
    },
    subway: {
      sky: ['#151a28', '#222b40', '#2c3854'], fog: '#1b2232', fogNear: 25, fogFar: 70,
      hemi: ['#b9c8ff', '#2a2a36', 0.85], sun: ['#ffffff', 0.9],
      top: '#8d97a8', topDark: '#ffd23f', dirt: '#5c6577', dirtDark: '#454d5c',
      brick: '#4f78b8', mortar: '#26385c', hard: 'steel', semi: '#9aa3b2', plat: 'metal', vent: '#9fb3c8',
    },
    sky: {
      sky: ['#2f8cff', '#7cc4ff', '#f2fbff'], fog: '#d8efff', fogNear: 45, fogFar: 160,
      hemi: ['#ffffff', '#88a6c8', 1.05], sun: ['#fff6e0', 1.25],
      top: '#46d06a', topDark: '#2ea150', dirt: '#93623a', dirtDark: '#6e4626',
      brick: '#c98b4e', mortar: '#7a4a22', hard: 'stone', semi: '#59c95a', plat: 'cloud', vent: '#8ee0d0',
    },
    castle: {
      sky: ['#1c1238', '#3d2766', '#7a4f9e'], fog: '#2c2048', fogNear: 30, fogFar: 90,
      hemi: ['#d8c8ff', '#3a2a3a', 0.85], sun: ['#ffe8c0', 1.0],
      top: '#8a849c', topDark: '#6b6680', dirt: '#5e5870', dirtDark: '#4a455a',
      brick: '#7d7890', mortar: '#3e3a4c', hard: 'castle', semi: '#8a849c', plat: 'stone', vent: '#a2b8c0',
    },
  };

  // ---------------------------------------------------------------- tile textures (128 px, one tile)
  const cache = {};
  const memo = (key, fn) => cache[key] || (cache[key] = fn());

  function speckle(g, col, n, size, seed) {
    let s = seed || 7;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    g.fillStyle = col;
    for (let i = 0; i < n; i++) g.fillRect(r() * 128, r() * 128, size * (0.6 + r()), size * (0.6 + r()));
  }

  function groundTex(th, part) {
    return memo('ground' + th.top + part, () => {
      const [c, g] = makeCanvas(128, 128);
      const theme = Object.keys(THEMES).find((k) => THEMES[k] === th);
      if (part === 'top') {
        // the top face: grass, subway floor, leaves or castle flagstones
        g.fillStyle = th.top;
        g.fillRect(0, 0, 128, 128);
        if (theme === 'subway') {
          g.strokeStyle = shade(th.top, -0.25);
          g.lineWidth = 3;
          g.strokeRect(2, 2, 124, 124);
          speckle(g, shade(th.top, -0.12), 60, 3, 3);
        } else if (theme === 'castle') {
          g.strokeStyle = shade(th.top, -0.35);
          g.lineWidth = 4;
          g.strokeRect(2, 2, 124, 60);
          g.strokeRect(2, 64, 62, 62);
          g.strokeRect(64, 64, 62, 62);
        } else {
          speckle(g, th.topDark, 90, 5, 11);
          speckle(g, shade(th.top, 0.25), 50, 4, 5);
        }
        return toTexture(c);
      }
      // sides: earth with the top colour hanging over the edge
      g.fillStyle = th.dirt;
      g.fillRect(0, 0, 128, 128);
      speckle(g, th.dirtDark, 40, 7, 13);
      speckle(g, shade(th.dirt, 0.18), 25, 5, 17);
      if (part === 'side') {
        if (theme === 'subway') {
          g.fillStyle = th.top;
          g.fillRect(0, 0, 128, 26);
          for (let x = 0; x < 128; x += 32) {
            g.fillStyle = '#ffd23f';
            g.fillRect(x, 26, 16, 10);
            g.fillStyle = '#26262e';
            g.fillRect(x + 16, 26, 16, 10);
          }
        } else if (theme === 'castle') {
          g.fillStyle = th.top;
          g.fillRect(0, 0, 128, 22);
          g.fillStyle = shade(th.top, -0.3);
          g.fillRect(0, 22, 128, 5);
        } else {
          g.fillStyle = th.top;
          g.beginPath();
          g.moveTo(0, 0);
          g.lineTo(128, 0);
          for (let x = 128; x >= 0; x -= 16) g.lineTo(x, 26 + ((x / 16) % 2 ? 10 : 0));
          g.closePath();
          g.fill();
          g.fillStyle = th.topDark;
          for (let x = 4; x < 128; x += 16) g.fillRect(x, 24 + ((x / 16) % 2 ? 8 : 0), 6, 6);
        }
      }
      if (theme === 'castle') {
        g.strokeStyle = shade(th.dirt, -0.35);
        g.lineWidth = 3;
        for (let y = part === 'side' ? 40 : 0; y < 128; y += 42) {
          g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke();
          const off = (y / 42) % 2 ? 0 : 64;
          for (let x = off; x < 128; x += 128) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 42); g.stroke(); }
        }
      }
      return toTexture(c);
    });
  }

  function brickTex(th) {
    return memo('brick' + th.brick, () => {
      const [c, g] = makeCanvas(128, 128);
      g.fillStyle = th.mortar;
      g.fillRect(0, 0, 128, 128);
      for (let r = 0; r < 4; r++) {
        const off = r % 2 ? 32 : 0;
        for (let x = -off; x < 128; x += 64) {
          g.fillStyle = shade(th.brick, ((r * 3 + x) % 5) * 0.03 - 0.05);
          g.fillRect(x + 4, r * 32 + 4, 56, 25);
          g.fillStyle = shade(th.brick, 0.22);
          g.fillRect(x + 4, r * 32 + 4, 56, 5);
        }
      }
      return toTexture(c);
    });
  }

  function ttTex(used) {
    return memo('tt' + used, () => {
      const [c, g] = makeCanvas(128, 128);
      const base = used ? '#a0703c' : '#ffc61a';
      g.fillStyle = shade(base, -0.45);
      g.fillRect(0, 0, 128, 128);
      g.fillStyle = base;
      roundRect(g, 6, 6, 116, 116, 14);
      g.fill();
      g.fillStyle = shade(base, 0.35);
      g.fillRect(14, 12, 100, 8);
      g.fillStyle = shade(base, -0.35);
      for (const [x, y] of [[18, 18], [110, 18], [18, 110], [110, 110]]) {
        g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill();
      }
      if (!used) {
        g.font = `bold 62px ${BLOCK_FONT}`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.lineWidth = 8;
        g.strokeStyle = '#8a3b00';
        g.strokeText('TT', 64, 70);
        g.fillStyle = '#ffffff';
        g.fillText('TT', 64, 70);
      }
      return toTexture(c);
    });
  }

  function hardTex(th) {
    return memo('hard' + th.hard, () => {
      const [c, g] = makeCanvas(128, 128);
      if (th.hard === 'crate') {
        g.fillStyle = '#c8894a';
        g.fillRect(0, 0, 128, 128);
        g.strokeStyle = '#7a4a22';
        g.lineWidth = 10;
        g.strokeRect(5, 5, 118, 118);
        g.lineWidth = 9;
        g.beginPath(); g.moveTo(10, 10); g.lineTo(118, 118); g.stroke();
        g.fillStyle = 'rgba(0,0,0,0.12)';
        for (let y = 10; y < 128; y += 27) g.fillRect(10, y, 108, 3);
      } else if (th.hard === 'steel') {
        g.fillStyle = '#9aa6b8';
        g.fillRect(0, 0, 128, 128);
        g.fillStyle = '#7c889a';
        g.fillRect(0, 0, 128, 8); g.fillRect(0, 120, 128, 8); g.fillRect(0, 0, 8, 128); g.fillRect(120, 0, 8, 128);
        g.strokeStyle = 'rgba(255,255,255,0.35)';
        g.lineWidth = 3;
        for (let i = -128; i < 128; i += 18) { g.beginPath(); g.moveTo(i, 128); g.lineTo(i + 128, 0); g.stroke(); }
        g.fillStyle = '#5f6878';
        for (const [x, y] of [[16, 16], [112, 16], [16, 112], [112, 112]]) { g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill(); }
      } else if (th.hard === 'stone') {
        g.fillStyle = '#d9d2c3';
        g.fillRect(0, 0, 128, 128);
        g.fillStyle = '#efe9dc';
        g.fillRect(8, 8, 112, 14);
        g.fillStyle = '#b3aa98';
        g.fillRect(8, 106, 112, 14);
        speckle(g, '#c4bba8', 40, 5, 23);
      } else {
        g.fillStyle = '#6d6880';
        g.fillRect(0, 0, 128, 128);
        g.fillStyle = '#857f99';
        g.beginPath(); g.moveTo(0, 0); g.lineTo(128, 0); g.lineTo(108, 20); g.lineTo(20, 20); g.lineTo(20, 108); g.lineTo(0, 128); g.fill();
        g.fillStyle = '#4e4a5e';
        g.beginPath(); g.moveTo(128, 128); g.lineTo(0, 128); g.lineTo(20, 108); g.lineTo(108, 108); g.lineTo(108, 20); g.lineTo(128, 0); g.fill();
      }
      return toTexture(c);
    });
  }

  function ventTex(kind, th) {
    return memo('vent' + kind + th.vent, () => {
      const [c, g] = makeCanvas(128, 128);
      if (kind === 'grate') {
        g.fillStyle = '#20242c';
        g.fillRect(0, 0, 128, 128);
        g.fillStyle = '#4a5260';
        for (let y = 10; y < 128; y += 20) g.fillRect(6, y, 116, 8);
        return toTexture(c);
      }
      const base = th.vent;
      g.fillStyle = base;
      g.fillRect(0, 0, 128, 128);
      for (let x = 0; x < 128; x += 16) {
        g.fillStyle = shade(base, 0.25);
        g.fillRect(x, 0, 5, 128);
        g.fillStyle = shade(base, -0.18);
        g.fillRect(x + 11, 0, 3, 128);
      }
      if (kind === 'lipIn') {
        // the vents you can go down have a yellow-and-black rim
        g.fillStyle = '#ffd23f';
        g.fillRect(0, 0, 128, 128);
        g.fillStyle = '#26262e';
        for (let x = -128; x < 128; x += 40) {
          g.beginPath(); g.moveTo(x, 128); g.lineTo(x + 20, 128); g.lineTo(x + 148, 0); g.lineTo(x + 128, 0); g.fill();
        }
      }
      return toTexture(c, true);
    });
  }

  function gateTex() {
    return memo('gate', () => {
      const [c, g] = makeCanvas(128, 128);
      g.fillStyle = '#4a2e1a';
      g.fillRect(0, 0, 128, 128);
      for (let x = 0; x < 128; x += 32) {
        g.fillStyle = '#8a5a32';
        g.fillRect(x + 3, 0, 26, 128);
        g.fillStyle = '#a8754a';
        g.fillRect(x + 3, 0, 6, 128);
      }
      g.fillStyle = '#c9c9d6';
      g.fillRect(0, 20, 128, 10);
      g.fillRect(0, 98, 128, 10);
      return toTexture(c);
    });
  }

  function coinTex() {
    return memo('coin', () => {
      const [c, g] = makeCanvas(128, 128);
      const gr = g.createRadialGradient(54, 50, 6, 64, 64, 64);
      gr.addColorStop(0, '#fff6b0');
      gr.addColorStop(0.6, '#ffcf2e');
      gr.addColorStop(1, '#d48a00');
      g.fillStyle = gr;
      g.fillRect(0, 0, 128, 128);
      g.strokeStyle = '#b36b00';
      g.lineWidth = 8;
      g.beginPath(); g.arc(64, 64, 50, 0, Math.PI * 2); g.stroke();
      g.font = `bold 56px ${BLOCK_FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = '#b36b00';
      g.fillText('T', 64, 68);
      return toTexture(c);
    });
  }

  // A comic burst with a word in it: POW!, BONK!, POP!
  function burstTex(word, color = '#ffd400') {
    return memo('burst' + word + color, () => {
      const [c, g] = makeCanvas(256, 256);
      g.beginPath();
      for (let i = 0; i < 24; i++) {
        const r = i % 2 ? 78 : 120, a = (i * Math.PI) / 12;
        g.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r * 0.85);
      }
      g.closePath();
      g.fillStyle = color;
      g.fill();
      g.lineWidth = 10;
      g.strokeStyle = '#14121f';
      g.stroke();
      g.font = `bold 66px ${BLOCK_FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = 12;
      g.strokeText(word, 128, 134);
      g.fillStyle = '#ff3d7f';
      g.fillText(word, 128, 134);
      return toTexture(c);
    });
  }

  function textTex(text, color = '#ffffff') {
    return memo('text' + text + color, () => {
      const [c, g] = makeCanvas(256, 96);
      g.font = `bold 60px ${BLOCK_FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = 12;
      g.strokeStyle = '#14121f';
      g.strokeText(text, 128, 50);
      g.fillStyle = color;
      g.fillText(text, 128, 50);
      return toTexture(c);
    });
  }

  function flagTex() {
    return memo('flag', () => {
      const [c, g] = makeCanvas(256, 160);
      g.fillStyle = '#ff3d4f';
      g.fillRect(0, 0, 256, 160);
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, 256, 18);
      g.fillRect(0, 142, 256, 18);
      g.font = `bold 84px ${BLOCK_FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = 12;
      g.strokeStyle = '#14121f';
      g.strokeText('TNT', 128, 84);
      g.fillStyle = '#ffd400';
      g.fillText('TNT', 128, 84);
      return toTexture(c);
    });
  }

  function faceScreenTex() {
    return memo('droneFace', () => {
      const [c, g] = makeCanvas(128, 64);
      g.fillStyle = '#1b2230';
      roundRect(g, 0, 0, 128, 64, 14);
      g.fill();
      g.strokeStyle = '#5ef2ff';
      g.lineWidth = 7;
      g.lineCap = 'round';
      for (const x of [40, 88]) { g.beginPath(); g.arc(x, 38, 11, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
      return toTexture(c);
    });
  }

  function beachBallTex() {
    return memo('ball', () => {
      const [c, g] = makeCanvas(256, 128);
      const cols = ['#ff4b5c', '#ffffff', '#3d8bff', '#ffffff', '#ffd400', '#ffffff'];
      cols.forEach((col, i) => { g.fillStyle = col; g.fillRect((i * 256) / 6, 0, 256 / 6 + 1, 128); });
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, 256, 10);
      g.fillRect(0, 118, 256, 10);
      return toTexture(c);
    });
  }

  function plantTex() {
    return memo('plant', () => {
      const [c, g] = makeCanvas(128, 128);
      g.fillStyle = '#e8457a';
      g.fillRect(0, 0, 128, 128);
      g.fillStyle = '#ffffff';
      for (const [x, y, r] of [[24, 30, 12], [80, 22, 9], [100, 70, 13], [40, 86, 10], [70, 110, 8]]) {
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      }
      return toTexture(c);
    });
  }

  // Sky: a vertical gradient for scene.background.
  function skyTex(th) {
    return memo('sky' + th.sky.join(), () => {
      const [c, g] = makeCanvas(4, 256);
      const gr = g.createLinearGradient(0, 0, 0, 256);
      gr.addColorStop(0, th.sky[0]);
      gr.addColorStop(0.55, th.sky[1]);
      gr.addColorStop(1, th.sky[2]);
      g.fillStyle = gr;
      g.fillRect(0, 0, 4, 256);
      return toTexture(c);
    });
  }

  function subwayWallTex() {
    return memo('subwayWall', () => {
      const [c, g] = makeCanvas(256, 256);
      g.fillStyle = '#d9dde4';
      g.fillRect(0, 0, 256, 256);
      g.strokeStyle = '#b5bcc8';
      g.lineWidth = 3;
      for (let y = 0; y < 256; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
      for (let y = 0; y < 256; y += 16) for (let x = (y / 16) % 2 ? 16 : 0; x < 256; x += 32) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 16); g.stroke(); }
      g.fillStyle = '#2f7de1';
      g.fillRect(0, 96, 256, 34);
      g.fillStyle = '#ffd23f';
      g.fillRect(0, 130, 256, 8);
      g.font = `bold 24px ${BLOCK_FONT}`;
      g.fillStyle = '#ffffff';
      g.textBaseline = 'middle';
      g.fillText('TNT LINE', 18, 114);
      g.fillStyle = '#ff3d4f';
      g.beginPath(); g.arc(200, 113, 13, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffffff';
      g.font = `bold 16px ${BLOCK_FONT}`;
      g.textAlign = 'center';
      g.fillText('T', 200, 114);
      return toTexture(c, true);
    });
  }

  function castleWallTex() {
    return memo('castleWall', () => {
      const [c, g] = makeCanvas(256, 256);
      g.fillStyle = '#4a4560';
      g.fillRect(0, 0, 256, 256);
      for (let r = 0; r < 8; r++) {
        for (let x = r % 2 ? -32 : 0; x < 256; x += 64) {
          g.fillStyle = shade('#5d5878', ((r + x / 64) % 3) * 0.04 - 0.04);
          g.fillRect(x + 3, r * 32 + 3, 58, 26);
        }
      }
      return toTexture(c, true);
    });
  }

  function posterTex(i) {
    return memo('poster' + i, () => {
      const [c, g] = makeCanvas(128, 160);
      const bg = ['#ffd23f', '#18d4ff', '#ff7ab0', '#9dff6a'][i % 4];
      g.fillStyle = bg;
      g.fillRect(0, 0, 128, 160);
      g.strokeStyle = '#14121f';
      g.lineWidth = 6;
      g.strokeRect(3, 3, 122, 154);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = `70px ${G.EMOJI_FONT}`;
      g.fillText(['🦖', '🛸', '🏀', '🍦'][i % 4], 64, 66);
      g.font = `bold 20px ${BLOCK_FONT}`;
      g.fillStyle = '#14121f';
      g.fillText(['DINO DAY', 'UFO NIGHT', 'HOOPS!', 'ICE CREAM'][i % 4], 64, 132);
      return toTexture(c);
    });
  }

  // ---------------------------------------------------------------- materials
  const matCache = {};
  const mat = (key, fn) => matCache[key] || (matCache[key] = fn());
  const lam = (o) => new T.MeshStandardMaterial(Object.assign({ roughness: 0.85, metalness: 0 }, o));

  // The six faces of a tile box, in Three's order: +x, -x, +y, -y, +z, -z.
  function tileMaterials(kind, th) {
    const key = kind + JSON.stringify(th.sky);
    return mat(key, () => {
      switch (kind) {
        case 'groundTop': {
          const side = lam({ map: groundTex(th, 'side') }), top = lam({ map: groundTex(th, 'top') }), fill = lam({ map: groundTex(th, 'fill') });
          return [side, side, top, fill, side, side];
        }
        case 'ground': return lam({ map: groundTex(th, 'fill') });
        case 'brick': return lam({ map: brickTex(th) });
        case 'q': return lam({ map: ttTex(false), emissive: '#ffb000', emissiveIntensity: 0.25, roughness: 0.5 });
        case 'used': return lam({ map: ttTex(true) });
        case 'hard': return lam({ map: hardTex(th) });
        case 'gate': return lam({ map: gateTex() });
        case 'semi': return lam({ color: th.semi, roughness: 0.7 });
        default: return lam({ color: '#ff00ff' });
      }
    });
  }

  // ---------------------------------------------------------------- models
  const box = (w, h, d, m, x, y, z, parent) => {
    const me = new T.Mesh(new T.BoxGeometry(w, h, d), m);
    me.position.set(x, y, z);
    me.castShadow = true;
    if (parent) parent.add(me);
    return me;
  };

  function person(id) {
    const entry = Kit.roster.get(id);
    const p = Kit.people.build(entry.look);
    p.mats = [];
    p.root.traverse((o) => { if (o.isMesh && o.material && !p.mats.includes(o.material)) p.mats.push(o.material); });
    p.mats.forEach((m) => { if (m.emissive) m.userData.baseEmissive = m.emissive.clone(); });
    return p;
  }

  function crown(parent, y) {
    const gold = lam({ color: '#ffcf2e', metalness: 0.6, roughness: 0.35, emissive: '#6b4a00', emissiveIntensity: 0.3 });
    const g = new T.Group();
    g.position.y = y;
    box(0.56, 0.14, 0.52, gold, 0, 0, 0, g);
    for (const [x, z] of [[-0.22, -0.2], [0, -0.22], [0.22, -0.2], [-0.22, 0.2], [0.22, 0.2]]) box(0.1, 0.2, 0.1, gold, x, 0.16, z, g);
    const gem = lam({ color: '#ff3d7f', emissive: '#ff3d7f', emissiveIntensity: 0.5 });
    box(0.1, 0.1, 0.04, gem, 0, 0.02, -0.27, g);
    parent.add(g);
    return g;
  }

  function buildBall() {
    const g = new T.Group();
    const inner = new T.Mesh(new T.SphereGeometry(0.4, 20, 14), lam({ map: beachBallTex(), roughness: 0.45 }));
    inner.castShadow = true;
    inner.position.y = 0.4;
    g.add(inner);
    const white = lam({ color: '#ffffff' }), black = lam({ color: '#14121f' });
    for (const x of [-0.13, 0.13]) {
      const eye = new T.Mesh(new T.SphereGeometry(0.1, 10, 8), white);
      eye.position.set(x, 0.5, 0.33);
      g.add(eye);
      const pupil = new T.Mesh(new T.SphereGeometry(0.05, 8, 6), black);
      pupil.position.set(x * 1.05, 0.5, 0.42);
      g.add(pupil);
    }
    g.userData.inner = inner;
    return g;
  }

  function buildDrone() {
    const g = new T.Group();
    const body = lam({ color: '#f4f4f4', roughness: 0.4 }), orange = lam({ color: '#ff8a1f' }), dark = lam({ color: '#2a2a30' });
    box(0.8, 0.28, 0.6, body, 0, 0.3, 0, g);
    box(0.82, 0.08, 0.62, orange, 0, 0.18, 0, g);
    const face = new T.Mesh(new T.PlaneGeometry(0.56, 0.24), new T.MeshBasicMaterial({ map: faceScreenTex() }));
    face.position.set(0, 0.31, 0.305);
    g.add(face);
    const props = [];
    for (const [x, z] of [[-0.5, -0.32], [0.5, -0.32], [-0.5, 0.32], [0.5, 0.32]]) {
      box(0.3, 0.05, 0.05, dark, x * 0.7, 0.42, z, g);
      box(0.05, 0.12, 0.05, dark, x, 0.46, z, g);
      const p = box(0.5, 0.02, 0.07, lam({ color: '#5ef2ff', transparent: true, opacity: 0.8 }), x, 0.53, z, g);
      props.push(p);
    }
    g.userData.props = props;
    return g;
  }

  function buildPlant() {
    const g = new T.Group();
    const green = lam({ color: '#3fbf4a' }), pink = lam({ map: plantTex() }), white = lam({ color: '#ffffff' });
    box(0.18, 1.6, 0.18, green, 0, -0.2, 0, g);
    const leaf = box(0.4, 0.08, 0.2, green, 0.22, 0.05, 0, g);
    leaf.rotation.z = 0.5;
    const leaf2 = box(0.4, 0.08, 0.2, green, -0.22, -0.25, 0, g);
    leaf2.rotation.z = -0.5;
    const head = new T.Group();
    head.position.y = 0.75;
    g.add(head);
    const jawLo = new T.Group(), jawHi = new T.Group();
    head.add(jawLo, jawHi);
    box(0.7, 0.26, 0.62, pink, 0, -0.13, 0, jawLo);
    box(0.7, 0.3, 0.62, pink, 0, 0.15, 0, jawHi);
    for (const x of [-0.22, 0, 0.22]) {
      box(0.1, 0.1, 0.08, white, x, 0.02, 0.27, jawLo);
      box(0.1, 0.1, 0.08, white, x + 0.11, -0.02, 0.27, jawHi);
    }
    // friendly eyes on top
    for (const x of [-0.14, 0.14]) {
      box(0.14, 0.14, 0.06, white, x, 0.36, 0.2, jawHi);
      box(0.06, 0.08, 0.04, lam({ color: '#14121f' }), x, 0.36, 0.24, jawHi);
    }
    g.userData.jawHi = jawHi;
    g.userData.jawLo = jawLo;
    return g;
  }

  function buildPlatform(th) {
    const g = new T.Group();
    if (th.plat === 'cloud') {
      const white = lam({ color: '#ffffff', roughness: 1, emissive: '#cfe8ff', emissiveIntensity: 0.2 });
      for (const [x, s] of [[0.45, 0.42], [1.1, 0.55], [1.8, 0.5], [2.5, 0.42]]) {
        const m = new T.Mesh(new T.SphereGeometry(s, 14, 10), white);
        m.position.set(x, -0.2, 0);
        m.scale.set(1, 0.6, 1.1);
        m.castShadow = true;
        g.add(m);
      }
      return g;
    }
    const col = { plank: '#b77a43', metal: '#ffd23f', stone: '#8a849c' }[th.plat] || '#b77a43';
    box(3, 0.4, 1.2, lam({ color: col }), 1.5, -0.2, 0, g);
    box(3.04, 0.08, 1.24, lam({ color: shade(col, -0.3) }), 1.5, -0.38, 0, g);
    if (th.plat === 'metal') for (let x = 0.3; x < 3; x += 0.6) box(0.3, 0.41, 1.21, lam({ color: '#26262e' }), x, -0.2, 0, g);
    return g;
  }

  function buildFlag(f) {
    const g = new T.Group();
    const h = f.top - f.base;
    const pole = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, h, 10), lam({ color: '#e6e9ef', metalness: 0.5, roughness: 0.3 }));
    pole.position.set(0, h / 2, 0);
    pole.castShadow = true;
    g.add(pole);
    const ball = new T.Mesh(new T.SphereGeometry(0.2, 14, 10), lam({ color: '#ffcf2e', metalness: 0.6, roughness: 0.3 }));
    ball.position.y = h + 0.15;
    g.add(ball);
    const cloth = new T.Mesh(new T.PlaneGeometry(1.4, 0.9, 8, 1), new T.MeshStandardMaterial({ map: flagTex(), side: T.DoubleSide, roughness: 0.8 }));
    cloth.position.set(-0.75, h - 0.6, 0);
    cloth.castShadow = true;
    g.add(cloth);
    g.userData.cloth = cloth;
    g.userData.h = h;
    g.position.set(f.x, f.base, 0);
    return g;
  }

  function buildCheckpoint() {
    const g = new T.Group();
    const pole = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, 1.8, 8), lam({ color: '#dddddd' }));
    pole.position.y = 0.9;
    g.add(pole);
    const cloth = new T.Mesh(new T.PlaneGeometry(0.7, 0.45), new T.MeshStandardMaterial({ color: '#b8b8c8', side: T.DoubleSide }));
    cloth.position.set(0.37, 1.5, 0);
    g.add(cloth);
    g.userData.cloth = cloth;
    return g;
  }

  // The little clubhouse past the flagpole, where the brothers celebrate.
  function buildClubhouse(theme) {
    const g = new T.Group();
    const wallCol = { park: '#ffcf8a', subway: '#9fb3c8', sky: '#c98b4e', castle: '#7d7890' }[theme];
    const roofCol = { park: '#ff4b5c', subway: '#2f7de1', sky: '#3fbf4a', castle: '#5b3f8a' }[theme];
    const wall = lam({ color: wallCol }), roof = lam({ color: roofCol });
    box(4, 3, 3, wall, 0, 1.5, -2.2, g);
    const r1 = box(2.6, 0.3, 3.4, roof, -1.0, 3.5, -2.2, g);
    r1.rotation.z = 0.65;
    const r2 = box(2.6, 0.3, 3.4, roof, 1.0, 3.5, -2.2, g);
    r2.rotation.z = -0.65;
    box(1.1, 1.8, 0.1, lam({ color: '#6b3f1f' }), 0, 0.9, -0.67, g);
    box(0.8, 0.8, 0.1, lam({ color: '#bfe6ff', emissive: '#bfe6ff', emissiveIntensity: 0.3 }), -1.3, 1.9, -0.67, g);
    box(0.8, 0.8, 0.1, lam({ color: '#bfe6ff', emissive: '#bfe6ff', emissiveIntensity: 0.3 }), 1.3, 1.9, -0.67, g);
    const sign = new T.Mesh(new T.PlaneGeometry(2.0, 0.75), new T.MeshBasicMaterial({ map: textTex('TNT', '#ffd400'), transparent: true }));
    sign.position.set(0, 3.0, -0.6);
    g.add(sign);
    // Teddy's hoop on the wall
    const hoop = new T.Group();
    hoop.position.set(1.4, 3.7, -0.5);
    box(0.9, 0.6, 0.06, lam({ color: '#ffffff' }), 0, 0, 0, hoop);
    const rim = new T.Mesh(new T.TorusGeometry(0.22, 0.03, 6, 16), lam({ color: '#ff6a1f' }));
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0, -0.25, 0.25);
    hoop.add(rim);
    g.add(hoop);
    g.userData.rim = rim;
    return g;
  }

  // ---------------------------------------------------------------- scenery (the parallax backdrop)
  // Everything is real 3D at different depths, so it scrolls at different speeds by itself.
  function rng(seed) {
    let s = seed;
    return () => ((s = (s * 16807) % 2147483647) / 2147483647);
  }

  function cloud(g, x, y, z, s, m) {
    const c = new T.Group();
    for (const [dx, dy, r] of [[0, 0, 1], [1.1, 0.2, 0.8], [-1.0, -0.1, 0.75], [0.4, 0.6, 0.7]]) {
      const b = new T.Mesh(new T.BoxGeometry(r * 1.8, r * 1.3, r * 1.2), m);
      b.position.set(dx, dy, 0);
      c.add(b);
    }
    c.position.set(x, y, z);
    c.scale.setScalar(s);
    g.add(c);
  }

  function tree(g, x, z, s, th, r) {
    const t = new T.Group();
    const trunk = box(0.5, 2.2, 0.5, lam({ color: '#8b5a2b' }), 0, 1.1, 0, t);
    trunk.castShadow = false;
    const leaf = lam({ color: r() < 0.5 ? '#3fae44' : '#52c45a' });
    box(2.2, 1.6, 2.0, leaf, 0, 2.8, 0, t).castShadow = false;
    box(1.4, 1.0, 1.4, leaf, 0.1, 3.9, 0, t).castShadow = false;
    t.position.set(x, 2, z);
    t.scale.setScalar(s);
    g.add(t);
  }

  function house(g, x, z, r) {
    const h = new T.Group();
    const cols = ['#ffcf8a', '#bfe6ff', '#ffb3c7', '#d8f0a8'];
    box(5, 4, 4, lam({ color: cols[Math.floor(r() * 4)] }), 0, 2, 0, h).castShadow = false;
    const roof = lam({ color: '#c8503a' });
    const a = box(3.4, 0.4, 4.4, roof, -1.3, 4.6, 0, h);
    a.rotation.z = 0.7;
    const b = box(3.4, 0.4, 4.4, roof, 1.3, 4.6, 0, h);
    b.rotation.z = -0.7;
    const win = lam({ color: '#bfe6ff', emissive: '#bfe6ff', emissiveIntensity: 0.2 });
    box(1, 1, 0.1, win, -1.3, 2.4, 2.02, h);
    box(1, 1, 0.1, win, 1.3, 2.4, 2.02, h);
    h.position.set(x, 2, z);
    g.add(h);
  }

  function fence(g, x0, x1, z) {
    const m = lam({ color: '#f4f0e6' });
    for (let x = x0; x < x1; x += 0.8) box(0.18, 1.1, 0.1, m, x, 2.55, z, g).castShadow = false;
    box(x1 - x0, 0.14, 0.08, m, (x0 + x1) / 2, 2.85, z + 0.06, g).castShadow = false;
    box(x1 - x0, 0.14, 0.08, m, (x0 + x1) / 2, 2.35, z + 0.06, g).castShadow = false;
  }

  // Build the backdrop for a level: returns a Group. W is the level width in tiles.
  function scenery(theme, W, seed) {
    const g = new T.Group();
    const r = rng(seed || 99);
    const span0 = -40, span1 = W + 40;
    // the ground behind the level, so trees and fences have something to stand on
    const floor = { park: ['#4fae35', 120], subway: ['#4a5262', 3.6], castle: ['#4e4960', 3.6] }[theme];
    if (floor) {
      const pl = new T.Mesh(new T.PlaneGeometry(W + 400, floor[1]), lam({ color: floor[0], roughness: 1 }));
      pl.rotation.x = -Math.PI / 2;
      pl.position.set(W / 2, 1.98, -2.5 - floor[1] / 2);
      pl.receiveShadow = true;
      g.add(pl);
    }
    if (theme === 'park') {
      const cm = lam({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.35, roughness: 1 });
      for (let x = span0 - 60; x < span1 + 60; x += 14 + r() * 16) cloud(g, x, 15 + r() * 8, -45 - r() * 25, 1.5 + r() * 1.5, cm);
      // rolling hills, far and near
      for (const [z, col, hgt] of [[-80, '#a8e0a0', 9], [-45, '#86d277', 5]]) {
        const hm = lam({ color: col, roughness: 1 });
        for (let x = span0 - 60; x < span1 + 60; x += 12 + r() * 16) {
          // stepped blocky hills
          const s = 6 + r() * 8, hh = hgt * (0.6 + r() * 0.6);
          box(s * 1.6, hh, 8, hm, x, 2 + hh / 2, z, g).castShadow = false;
          box(s, hh * 0.45, 8, hm, x + s * 0.1, 2 + hh + hh * 0.22, z, g).castShadow = false;
        }
      }
      for (let x = span0; x < span1; x += 26 + r() * 20) house(g, x, -16 - r() * 4, r);
      for (let x = span0; x < span1; x += 5 + r() * 8) tree(g, x, -6 - r() * 5, 0.8 + r() * 0.5, theme, r);
      for (let x = 0; x < W; x += 30 + r() * 20) fence(g, x, x + 6 + r() * 6, -2.9);
      // the sun
      const sun = new T.Mesh(new T.CircleGeometry(5, 32), new T.MeshBasicMaterial({ color: '#fff3b0', fog: false }));
      sun.position.set(W * 0.3, 26, -90);
      sun.userData.parallax = 0.85;
      g.add(sun);
    } else if (theme === 'subway') {
      const wall = new T.Mesh(new T.PlaneGeometry(W + 80, 8), lam({ map: subwayWallTex(), roughness: 0.9 }));
      wall.material.map.repeat.set((W + 80) / 8, 1);
      wall.position.set(W / 2, 6, -6);
      const upper = new T.Mesh(new T.PlaneGeometry(W + 80, 6), lam({ color: '#c9ced8', roughness: 0.9 }));
      upper.position.set(W / 2, 13, -6);
      g.add(upper);
      wall.receiveShadow = true;
      g.add(wall);
      const pillar = lam({ color: '#3a4458' });
      const lamp = lam({ color: '#fff7d6', emissive: '#fff2c0', emissiveIntensity: 1.2 });
      for (let x = span0; x < span1; x += 9) {
        box(0.9, 14, 0.9, pillar, x, 7, -3.4, g).castShadow = false;
        box(1.6, 0.2, 0.6, lamp, x + 4.5, 11.2, -4.5, g).castShadow = false;
      }
      for (let x = 6; x < W; x += 22 + r() * 18) {
        const p = new T.Mesh(new T.PlaneGeometry(1.6, 2), lam({ map: posterTex(Math.floor(r() * 4)) }));
        p.position.set(x, 5.2, -5.95);
        g.add(p);
      }
      // a train rolls past in the background now and then
      const train = new T.Group();
      const body = lam({ color: '#c7ced8', metalness: 0.4, roughness: 0.4 });
      const win = lam({ color: '#fff7c0', emissive: '#fff2a0', emissiveIntensity: 0.9 });
      for (let i = 0; i < 4; i++) {
        box(11, 3.2, 2.8, body, i * 11.6, 3.6, 0, train).castShadow = false;
        box(11.02, 0.5, 2.82, lam({ color: '#2f7de1' }), i * 11.6, 2.6, 0, train).castShadow = false;
        for (let w = -4; w <= 4; w += 2) box(1.2, 1.0, 0.1, win, i * 11.6 + w, 4.2, 1.42, train).castShadow = false;
      }
      train.position.set(-200, 0, -10);
      train.userData.train = true;
      g.add(train);
      g.userData.train = train;
    } else if (theme === 'sky') {
      const cm = lam({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.45, roughness: 1 });
      for (let x = span0 - 60; x < span1 + 60; x += 8 + r() * 12) cloud(g, x, -2 + r() * 22, -20 - r() * 60, 1.2 + r() * 2.2, cm);
      const far = lam({ color: '#9cc8ff', roughness: 1 });
      for (let x = span0 - 80; x < span1 + 80; x += 18 + r() * 22) box(12 + r() * 10, 18 + r() * 12, 6, far, x, -6, -110, g).castShadow = false;
      // floating islands
      const grass = lam({ color: '#52c45a' }), dirt = lam({ color: '#93623a' });
      for (let x = span0; x < span1; x += 30 + r() * 30) {
        const isl = new T.Group();
        box(6, 1, 4, grass, 0, 0, 0, isl).castShadow = false;
        box(5, 1.6, 3.4, dirt, 0, -1.3, 0, isl).castShadow = false;
        box(3, 1.4, 2.4, dirt, 0, -2.8, 0, isl).castShadow = false;
        tree(isl, -1.2, 0, 0.7, theme, r);
        isl.position.set(x, 4 + r() * 10, -35 - r() * 20);
        g.add(isl);
      }
      const sun = new T.Mesh(new T.CircleGeometry(5, 32), new T.MeshBasicMaterial({ color: '#fff6c8', fog: false }));
      sun.position.set(W * 0.6, 28, -100);
      g.add(sun);
    } else if (theme === 'castle') {
      const wall = new T.Mesh(new T.PlaneGeometry(W + 80, 16), lam({ map: castleWallTex(), roughness: 0.95 }));
      wall.material.map.repeat.set((W + 80) / 8, 2);
      wall.position.set(W / 2, 8, -6);
      wall.receiveShadow = true;
      g.add(wall);
      const banner = lam({ color: '#7a3fbf' }), crystal = lam({ color: '#7af0ff', emissive: '#4ad8ff', emissiveIntensity: 1.1 });
      for (let x = 4; x < W + 20; x += 12) {
        // arched windows with the purple sky, banners and glowing crystals (no fire here)
        box(1.6, 3, 0.1, lam({ color: '#b07ad8', emissive: '#7a4f9e', emissiveIntensity: 0.6 }), x, 7.5, -5.9, g).castShadow = false;
        box(1.0, 2.4, 0.1, banner, x + 4, 8.2, -5.85, g).castShadow = false;
        const cr = box(0.3, 0.5, 0.3, crystal, x + 7.5, 6, -5.6, g);
        cr.rotation.z = Math.PI / 4;
        cr.castShadow = false;
      }
      const moon = new T.Mesh(new T.CircleGeometry(4, 32), new T.MeshBasicMaterial({ color: '#fff4c8', fog: false }));
      moon.position.set(W * 0.4, 30, -100);
      g.add(moon);
    }
    return g;
  }

  TNT.art = {
    THEMES, tileMaterials, ventTex, coinTex, burstTex, textTex, skyTex, lam, box, person, crown,
    buildBall, buildDrone, buildPlant, buildPlatform, buildFlag, buildCheckpoint, buildClubhouse, scenery,
  };
})();

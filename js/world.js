/* TNT Brothers world: the Three.js scene that draws the engine's state. It never changes the game; it only reads
   the state (and the events the engine reports) and makes it look nice. Exposes window.TNT.World. */
(function () {
  'use strict';
  const TNT = (window.TNT = window.TNT || {});
  const T = THREE;
  const A = TNT.art;
  const E = TNT.engine;
  const TC = E.T;
  const G = Kit.gfx;

  const damp = (rate, dt) => 1 - Math.exp(-rate * dt);
  const FACE_R = -(Math.PI / 2 + 0.45), FACE_L = -(Math.PI * 1.5 - 0.45); // three-quarter view, turning via the camera side

  // ---------------------------------------------------------------- particles (sparkles, dust, confetti)
  function makeParticles(n) {
    const geo = new T.BufferGeometry();
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 4);
    const vel = new Float32Array(n * 3), life = new Float32Array(n), max = new Float32Array(n), grav = new Float32Array(n);
    for (let i = 0; i < n; i++) pos[i * 3 + 1] = -999;
    geo.setAttribute('position', new T.BufferAttribute(pos, 3).setUsage(T.DynamicDrawUsage));
    geo.setAttribute('color', new T.BufferAttribute(col, 4).setUsage(T.DynamicDrawUsage));
    const mat = new T.PointsMaterial({ size: 0.28, map: G.dotTexture(), vertexColors: true, transparent: true, depthWrite: false });
    const points = new T.Points(geo, mat);
    points.frustumCulled = false;
    let next = 0;
    const c = new T.Color();
    return {
      points,
      emit(x, y, z, count, o = {}) {
        for (let k = 0; k < count; k++) {
          const i = next;
          next = (next + 1) % n;
          const a = Math.random() * Math.PI * 2, sp = (o.speed || 3) * (0.4 + Math.random() * 0.8);
          pos[i * 3] = x + (Math.random() - 0.5) * (o.spread || 0.3);
          pos[i * 3 + 1] = y + (Math.random() - 0.5) * (o.spread || 0.3);
          pos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.3;
          vel[i * 3] = Math.cos(a) * sp + (o.vx || 0);
          vel[i * 3 + 1] = Math.sin(a) * sp * 0.6 + (o.up || 0);
          vel[i * 3 + 2] = (Math.random() - 0.5) * sp * 0.4;
          max[i] = life[i] = (o.life || 0.6) * (0.7 + Math.random() * 0.6);
          grav[i] = o.grav ?? 8;
          const cc = Array.isArray(o.color) ? o.color[Math.floor(Math.random() * o.color.length)] : o.color || '#ffffff';
          c.set(cc);
          col.set([c.r, c.g, c.b, 1], i * 4);
        }
      },
      update(dt) {
        for (let i = 0; i < n; i++) {
          if (life[i] <= 0) continue;
          life[i] -= dt;
          if (life[i] <= 0) {
            pos[i * 3 + 1] = -999;
            continue;
          }
          vel[i * 3 + 1] -= grav[i] * dt;
          pos[i * 3] += vel[i * 3] * dt;
          pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
          pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
          col[i * 4 + 3] = Math.min(1, (life[i] / max[i]) * 2);
        }
        geo.attributes.position.needsUpdate = true;
        geo.attributes.color.needsUpdate = true;
      },
    };
  }

  const sprite = (tex, s = 1) => {
    const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
    sp.scale.set(s, s, 1);
    return sp;
  };

  // ---------------------------------------------------------------- the world
  class World {
    constructor(canvas) {
      const r = (this.renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }));
      r.outputEncoding = T.sRGBEncoding;
      r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      r.shadowMap.enabled = true;
      r.shadowMap.type = T.PCFSoftShadowMap;
      this.scene = new T.Scene();
      this.camera = new T.PerspectiveCamera(40, 1, 0.5, 400);
      this.hemi = new T.HemisphereLight('#ffffff', '#666666', 1);
      this.sun = new T.DirectionalLight('#ffffff', 1.2);
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(2048, 1024);
      const sc = this.sun.shadow.camera;
      sc.left = -22; sc.right = 22; sc.top = 13; sc.bottom = -13; sc.near = 1; sc.far = 80;
      this.sun.shadow.bias = -0.0008;
      this.scene.add(this.hemi, this.sun, this.sun.target);
      this.level = new T.Group(); // everything that belongs to the current room
      this.scene.add(this.level);
      this.fx = new T.Group();
      this.scene.add(this.fx);
      this.parts = makeParticles(700);
      this.scene.add(this.parts.points);
      this.pops = []; // short-lived sprites: POW bursts, points, coin pops
      this.shards = [];
      this.views = new Map(); // entity id -> view
      this.pv = []; // player views
      this.camX = 0;
      this.camY = 7;
      this.shake = 0;
      this.t = 0;
      this.size = [1, 1];
      this.dummy = new T.Object3D();
      this.coinMat = A.lam({ map: A.coinTex(), metalness: 0.15, roughness: 0.4, emissive: '#ffb000', emissiveIntensity: 0.35 });
      this.coinEdge = A.lam({ color: '#f0b400', metalness: 0.15, roughness: 0.4, emissive: '#a06a00', emissiveIntensity: 0.4 });
      this.coinGeo = new T.CylinderGeometry(0.34, 0.34, 0.08, 20).rotateX(Math.PI / 2);
      const shardGeo = new T.BoxGeometry(0.28, 0.28, 0.28);
      for (let i = 0; i < 24; i++) {
        const m = new T.Mesh(shardGeo, A.lam({ color: '#c8642e' }));
        m.visible = false;
        this.scene.add(m);
        this.shards.push({ m, vx: 0, vy: 0, life: 0 });
      }
    }

    resize(w, h) {
      if (!w || !h) return;
      this.size = [w, h];
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }

    // ------------------------------------------------------------ building a room
    // S: engine state. chars: player characters. Rebuild after a room change.
    build(S) {
      const lv = E.prep(S.li);
      this.S = S;
      const theme = (this.themeName = lv.theme);
      const th = (this.th = A.THEMES[theme]);
      // clear the old room
      this.scene.remove(this.level);
      this.level.traverse((o) => { if ((o.isMesh || o.isInstancedMesh) && o.geometry !== this.coinGeo) o.geometry.dispose(); });
      this.level = new T.Group();
      this.scene.add(this.level);
      for (const v of this.views.values()) this.dropView(v);
      this.views.clear();
      const bonus = S.room === 1;
      this.scene.background = bonus ? new T.Color(theme === 'sky' ? '#3a6fae' : '#141826') : A.skyTex(th);
      this.scene.fog = new T.Fog(bonus ? '#141826' : th.fog, bonus ? 20 : th.fogNear, bonus ? 60 : th.fogFar);
      this.hemi.color.set(th.hemi[0]);
      this.hemi.groundColor.set(th.hemi[1]);
      this.hemi.intensity = th.hemi[2];
      this.sun.color.set(th.sun[0]);
      this.sun.intensity = th.sun[1];
      this.buildTiles(S);
      this.buildVents(S);
      if (!bonus) {
        this.backdrop = A.scenery(theme, S.W, 7 + S.li * 31);
        this.level.add(this.backdrop);
        if (S.flag) {
          this.flag = A.buildFlag(S.flag);
          this.level.add(this.flag);
          this.club = A.buildClubhouse(theme);
          this.club.position.set(S.flag.x + 6, S.flag.base - 1, 0);
          this.level.add(this.club);
        }
      } else {
        this.backdrop = null;
        this.flag = null;
        this.club = null;
        // a back wall for the bonus room
        const wall = new T.Mesh(new T.PlaneGeometry(S.W + 10, 16), A.lam({ color: theme === 'sky' ? '#5b8fd6' : '#2a3044' }));
        wall.position.set(S.W / 2, 7, -1.6);
        this.level.add(wall);
      }
      // players and the companion
      if (!this.pv.length || this.pv.map((v) => v.ch).join() !== S.players.map((P) => P.ch).join()) this.buildPlayers(S);
      for (const v of this.pv) this.scene.add(v.p.root);
      this.camX = S.cam.x;
      this.snapCam = true;
    }

    buildTiles(S) {
      const th = this.th;
      const W = S.W, H = E.H;
      const kinds = {};
      const want = (k, n = 1) => (kinds[k] = (kinds[k] || 0) + n);
      let bumpables = 0;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const c = S.tiles[y * W + x];
          const k = this.visKind(S, x, y, c);
          if (k) want(k);
          if (c === TC.BRICK || c === TC.MULTI || c === TC.QCOIN || c === TC.QPOW || c === TC.QSTAR || c === TC.HCOIN || c === TC.H1UP) bumpables++;
        }
      }
      want('used', bumpables);
      this.inst = {};
      for (const k of Object.keys(kinds)) {
        let geo;
        if (k === 'groundTop' || k === 'ground') {
          geo = new T.BoxGeometry(1, 1, 3);
          G.boxUV(geo, 1, 1, 3, 1);
          geo.translate(0, 0, -1);
        } else if (k === 'semi') geo = new T.BoxGeometry(1, 0.3, 1.3).translate(0, 0.35, 0);
        else if (k === 'coin') geo = this.coinGeo;
        else geo = new T.BoxGeometry(1, 1, 1);
        const m = k === 'coin' ? [this.coinEdge, this.coinMat, this.coinMat] : A.tileMaterials(k, th);
        if (k === 'groundTop' || k === 'ground') (Array.isArray(m) ? m : [m]).forEach((mm) => { if (mm.map) mm.map.wrapS = mm.map.wrapT = T.RepeatWrapping; });
        const im = new T.InstancedMesh(geo, m, kinds[k] + 2);
        im.count = 0;
        im.receiveShadow = true;
        im.castShadow = k !== 'ground' && k !== 'groundTop' && k !== 'coin';
        im.frustumCulled = false;
        im.userData = { kind: k, free: [], cap: kinds[k] + 2 };
        this.inst[k] = im;
        this.level.add(im);
      }
      this.slot = new Int32Array(W * H).fill(-1);
      this.slotKind = new Array(W * H).fill(null);
      this.shown = new Uint8Array(W * H);
      this.bumps = new Map();
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) this.setCell(S, x, y);
      for (const im of Object.values(this.inst)) im.instanceMatrix.needsUpdate = true;
    }

    visKind(S, x, y, c) {
      switch (c) {
        case TC.GROUND: return E.tile(S, x, y + 1) === TC.GROUND ? 'ground' : 'groundTop';
        case TC.BRICK: case TC.MULTI: return 'brick';
        case TC.QCOIN: case TC.QPOW: case TC.QSTAR: return 'q';
        case TC.USED: case TC.PIVOT: return 'used';
        case TC.HARD: case TC.FLAG: return 'hard';
        case TC.SEMI: return 'semi';
        case TC.GATE: return 'gate';
        case TC.COIN: return 'coin';
        default: return null;
      }
    }

    setCell(S, x, y) {
      const i = y * S.W + x;
      const c = S.tiles[i];
      this.shown[i] = c;
      const k = this.visKind(S, x, y, c);
      if (this.slotKind[i] === k) return;
      if (this.slotKind[i]) {
        const im = this.inst[this.slotKind[i]];
        this.dummy.position.set(0, -50, 0);
        this.dummy.scale.setScalar(0.0001);
        this.dummy.rotation.set(0, 0, 0);
        this.dummy.updateMatrix();
        im.setMatrixAt(this.slot[i], this.dummy.matrix);
        im.userData.free.push(this.slot[i]);
        im.instanceMatrix.needsUpdate = true;
        this.slot[i] = -1;
        this.slotKind[i] = null;
      }
      if (!k || !this.inst[k]) return;
      const im = this.inst[k];
      const idx = im.userData.free.length ? im.userData.free.pop() : im.count++;
      if (idx >= im.userData.cap) return;
      this.slot[i] = idx;
      this.slotKind[i] = k;
      this.placeCell(im, idx, x, y, 0);
      im.instanceMatrix.needsUpdate = true;
    }

    placeCell(im, idx, x, y, lift, spin) {
      const d = this.dummy;
      d.position.set(x + 0.5, y + 0.5 + lift, 0);
      d.rotation.set(0, spin || 0, 0);
      d.scale.setScalar(1);
      d.updateMatrix();
      im.setMatrixAt(idx, d.matrix);
    }

    buildVents(S) {
      const th = this.th;
      const body = A.lam({ map: A.ventTex('body', th), metalness: 0.35, roughness: 0.45 });
      const lip = A.lam({ map: A.ventTex('lip', th), metalness: 0.35, roughness: 0.45 });
      const lipIn = A.lam({ map: A.ventTex('lipIn', th), roughness: 0.6 });
      const grate = A.lam({ map: A.ventTex('grate', th) });
      for (let y = 0; y < E.H; y++) {
        for (let x = 0; x < S.W; x++) {
          const c = E.tile(S, x, y);
          if (!(c === TC.VTL || c === TC.VENTER || c === TC.VPLANT || c === TC.VRET)) continue;
          let n = 0;
          while (E.tile(S, x, y - 1 - n) === TC.VBL) n++;
          const bottom = y - n;
          const g = new T.Group();
          const bh = n + 0.45;
          const b = A.box(1.7, bh, 1.5, body, x + 1, bottom + bh / 2, 0, g);
          b.receiveShadow = true;
          const l = A.box(2.0, 0.6, 1.75, c === TC.VENTER ? lipIn : lip, x + 1, y + 0.7, 0, g);
          l.receiveShadow = true;
          const top = new T.Mesh(new T.PlaneGeometry(1.8, 1.55), grate);
          top.rotation.x = -Math.PI / 2;
          top.position.set(x + 1, y + 1.003, 0);
          g.add(top);
          this.level.add(g);
        }
      }
    }

    buildPlayers(S) {
      for (const v of this.pv) this.scene.remove(v.p.root);
      this.pv = S.players.map((P) => {
        const p = A.person(P.ch);
        const v = { ch: P.ch, p, ph: 0, rot: FACE_R, tag: null, stars: null, bubble: null, ball: null, shot: false, hold: null };
        if (S.mode === '2p') {
          v.tag = G.nameTag(Kit.roster.get(P.ch).name, Kit.roster.get(P.ch).tag);
          v.tag.position.y = 2.75;
          p.root.add(v.tag);
        }
        v.stars = this.dizzyStars();
        p.root.add(v.stars);
        v.bubble = new T.Mesh(new T.SphereGeometry(1.25, 20, 14), new T.MeshStandardMaterial({ color: '#bfe6ff', transparent: true, opacity: 0.3, roughness: 0.1 }));
        v.bubble.position.y = 1.1;
        v.bubble.visible = false;
        p.root.add(v.bubble);
        return v;
      });
      // the companion: the other brother
      if (this.bud) this.scene.remove(this.bud.p.root);
      this.bud = null;
      if (S.mode === '1p') {
        const id = Kit.roster.buddyFor(S.players[0].ch);
        const entry = Kit.roster.get(id);
        const p = A.person(id);
        const tag = G.nameTag(entry.name, entry.tag);
        tag.position.y = 2.75;
        p.root.add(tag);
        p.root.visible = false;
        this.scene.add(p.root);
        this.bud = { id, entry, p, ph: 0, rot: FACE_R, lastX: 0, lastY: 0, mode: '', modeT: 0, ball: null, shot: false };
        this.treat = sprite(null, 0.6);
        this.treat.visible = false;
        this.scene.add(this.treat);
        this.treatFly = -1;
        this.treatHold = 0;
      }
    }

    dizzyStars() {
      const g = new T.Group();
      for (let i = 0; i < 3; i++) {
        const s = sprite(G.emojiTexture('⭐'), 0.45);
        s.userData.i = i;
        g.add(s);
      }
      g.position.y = 2.4;
      g.visible = false;
      return g;
    }

    // ------------------------------------------------------------ entity views
    makeView(e) {
      const th = this.th;
      const v = { k: e.k, obj: null, p: null, ph: Math.random() * 6, stars: null, extra: {} };
      switch (e.k) {
        case 'zombie':
        case 'robot':
        case 'boss': {
          const p = A.person(e.k === 'robot' ? 'bolt' : 'zombie');
          v.p = p;
          v.obj = p.root;
          v.base = e.k === 'boss' ? 1.3 : e.k === 'robot' ? 0.5 : 0.47;
          if (e.k === 'boss') {
            A.crown(p.head, 0.4);
            const cape = A.box(0.7, 1.0, 0.08, A.lam({ color: '#7a3fbf' }), 0, 0.15, 0.25, p.hips);
            cape.rotation.x = 0.15;
          }
          p.root.scale.setScalar(v.base);
          v.stars = this.dizzyStars();
          v.stars.position.y = 2.35;
          v.stars.scale.setScalar(1 / v.base * (e.k === 'boss' ? 1.6 : 1));
          p.root.add(v.stars);
          break;
        }
        case 'ball': v.obj = A.buildBall(); break;
        case 'drone': v.obj = A.buildDrone(); break;
        case 'plant': v.obj = A.buildPlant(); break;
        case 'plat': v.obj = A.buildPlatform(th); break;
        case 'chk': v.obj = A.buildCheckpoint(); break;
        case 'item': {
          const em = { ice: '🍦', hoop: '🏀', star: '⭐', life: '💚' }[e.kind];
          v.obj = new T.Group();
          const glow = new T.Sprite(new T.SpriteMaterial({ map: G.glowTexture(), color: '#fff3a0', transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
          glow.scale.set(1.6, 1.6, 1);
          v.obj.add(glow);
          v.obj.add(sprite(G.emojiTexture(em), 0.95));
          break;
        }
        case 'shot': {
          v.obj = new T.Group();
          v.extra.s = sprite(G.emojiTexture(e.kind === 'peace' ? '✌️' : '🏀'), e.kind === 'peace' ? 0.65 : 0.6);
          v.obj.add(v.extra.s);
          if (e.kind === 'peace') {
            const glow = new T.Sprite(new T.SpriteMaterial({ map: G.glowTexture(), color: '#ffd400', transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
            glow.scale.set(1.1, 1.1, 1);
            v.obj.add(glow);
          }
          break;
        }
        case 'bar': {
          v.obj = new T.Group();
          v.extra.stars = [];
          for (let i = 1; i <= e.n; i++) {
            const s = sprite(G.emojiTexture('⭐'), 0.62);
            v.obj.add(s);
            v.extra.stars.push(s);
          }
          break;
        }
        default: v.obj = new T.Group();
      }
      v.obj.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      this.level.add(v.obj);
      return v;
    }

    dropView(v) {
      if (!v.obj) return;
      if (v.obj.parent) v.obj.parent.remove(v.obj);
      // free what this view made for itself (textures are shared and stay)
      v.obj.traverse((o) => {
        if (o.isMesh && o.geometry !== this.coinGeo) o.geometry.dispose();
        if ((o.isMesh || o.isSprite) && o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      });
    }

    // ------------------------------------------------------------ every frame
    sync(S, dt) {
      this.t += dt;
      this.S = S;
      // tiles that changed (bricks broken, blocks used, coins taken, the gate)
      const tiles = S.tiles, shown = this.shown;
      if (shown.length === tiles.length) {
        for (let i = 0; i < tiles.length; i++) if (tiles[i] !== shown[i]) this.setCell(S, i % S.W, Math.floor(i / S.W));
      }
      this.animTiles(S, dt);
      this.syncEnts(S, dt);
      this.syncPlayers(S, dt);
      this.syncBuddy(S, dt);
      this.syncFlag(S, dt);
      this.updateFx(dt);
      this.parts.update(dt);
      this.updateCamera(S, dt);
    }

    animTiles(S, dt) {
      // bumped blocks hop up and back down
      for (const [i, t] of this.bumps) {
        const nt = t + dt;
        const x = i % S.W, y = Math.floor(i / S.W);
        const k = this.slotKind[i];
        if (k) {
          const im = this.inst[k];
          this.placeCell(im, this.slot[i], x, y, nt < 0.2 ? Math.sin((nt / 0.2) * Math.PI) * 0.35 : 0);
          im.instanceMatrix.needsUpdate = true;
        }
        if (nt >= 0.2) this.bumps.delete(i);
        else this.bumps.set(i, nt);
      }
      // coins spin
      const coins = this.inst.coin;
      if (coins) {
        const spin = this.t * 3;
        for (let i = 0; i < S.tiles.length; i++) {
          if (this.slotKind[i] === 'coin') this.placeCell(coins, this.slot[i], i % S.W, Math.floor(i / S.W), 0, spin + (i % 7) * 0.3);
        }
        coins.instanceMatrix.needsUpdate = true;
      }
      // TT blocks shimmer
      const q = this.inst.q;
      if (q) q.material.emissiveIntensity = 0.18 + Math.max(0, Math.sin(this.t * 4)) * 0.3;
    }

    syncEnts(S, dt) {
      const seen = new Set();
      for (const e of S.ents) {
        if (e.dead) continue;
        seen.add(e.id);
        let v = this.views.get(e.id);
        if (!v) {
          v = this.makeView(e);
          this.views.set(e.id, v);
        }
        v.ph += dt;
        this.syncEnt(S, e, v, dt);
      }
      for (const [id, v] of this.views) {
        if (!seen.has(id)) {
          this.dropView(v);
          this.views.delete(id);
        }
      }
    }

    syncEnt(S, e, v, dt) {
      const o = v.obj;
      o.visible = e.on || e.k === 'plat' || e.k === 'chk' || e.k === 'bar' || e.k === 'plant';
      const k = damp(16, dt);
      switch (e.k) {
        case 'zombie':
        case 'robot':
        case 'boss': {
          const p = v.p;
          o.position.set(e.x, e.y, e.k === 'boss' ? -0.2 : 0);
          const rotT = e.dir > 0 ? FACE_R : FACE_L;
          o.rotation.y += (rotT - o.rotation.y) * damp(10, dt);
          let mode = 'walk', sc = v.base, sy = 1;
          o.rotation.z = 0;
          v.stars.visible = false;
          if (e.st === 'squash') {
            sy = 0.28;
            v.stars.visible = true;
            mode = 'idle';
          } else if (e.st === 'bonk') {
            o.rotation.z = Math.min(Math.PI, e.t * 9);
            mode = 'fall';
          } else if (e.k === 'robot' && (e.st === 'shell' || e.st === 'slide')) {
            mode = 'roll';
            if (e.st === 'slide') p.rig.rotation.z -= e.dir * dt * 14;
            else p.rig.rotation.z *= 0.8;
            if (e.st === 'shell' && e.t > 5.5) o.position.x += Math.sin(this.t * 40) * 0.05; // about to unfold
          } else if (e.k === 'boss') {
            if (e.st === 'dizzy' || e.st === 'beaten') {
              mode = e.st === 'beaten' ? 'dizzySit' : 'idle';
              v.stars.visible = true;
              o.visible = e.st === 'beaten' || Math.floor(e.t * 10) % 2 === 0 || e.t > 0.6;
            } else if (e.st === 'wait') mode = 'idle';
            else if (!e.gnd) mode = 'jump';
          }
          if (e.k !== 'robot' || e.st === 'go') p.rig.rotation.z = 0;
          TNT.pose(p, v.ph * (e.k === 'boss' ? 5 : 7), mode, k);
          o.scale.set(sc, sc * sy, sc);
          if (v.stars.visible) this.spinStars(v.stars, v.ph);
          break;
        }
        case 'ball': {
          o.position.set(e.x, e.y, 0);
          const inner = o.userData.inner;
          inner.rotation.z -= e.dir * dt * 4;
          const sq = e.gnd ? 0.8 : 1 + Math.min(0.15, Math.abs(e.vy) * 0.01);
          o.scale.set(1 / Math.sqrt(sq), sq, 1);
          if (e.st === 'pop') o.scale.setScalar(1 + e.t * 3), (o.visible = e.t < 0.12);
          if (e.st === 'bonk') o.rotation.z = e.t * 8;
          break;
        }
        case 'drone': {
          o.position.set(e.x, e.y, 0);
          for (const p of o.userData.props) p.rotation.y += dt * 30;
          o.rotation.z = e.st === 'bonk' ? e.t * 7 : -e.dir * 0.12;
          break;
        }
        case 'plant': {
          o.position.set(e.x, e.top - 1.25 + e.up * 1.3, 0);
          const snap = Math.abs(Math.sin(v.ph * 6)) * 0.5;
          o.userData.jawHi.rotation.x = -snap;
          o.userData.jawLo.rotation.x = snap * 0.4;
          break;
        }
        case 'plat': o.position.set(e.x, e.y, 0); break;
        case 'chk': {
          o.position.set(e.x, e.y, -0.6);
          const cl = o.userData.cloth;
          cl.material.color.set(e.taken ? '#ffd400' : '#b8b8c8');
          cl.rotation.y = Math.sin(this.t * 4) * 0.2;
          break;
        }
        case 'item': {
          const bob = e.st === 'rise' ? 0 : Math.sin(v.ph * 5) * 0.06;
          o.position.set(e.x, e.y + 0.45 + bob, 0.35);
          o.visible = true;
          break;
        }
        case 'shot': {
          o.position.set(e.x, e.y + 0.22 + (e.kind === 'peace' ? Math.sin(v.ph * 18) * 0.12 : 0), 0.3);
          v.extra.s.material.rotation -= dt * (e.kind === 'peace' ? 10 : 12) * Math.sign(e.vx || 1);
          if (Math.random() < 0.5) this.parts.emit(e.x, e.y + 0.22, 0.3, 1, { color: e.kind === 'peace' ? ['#ffd400', '#ffffff', '#ff7ab0'] : ['#ff9f1c', '#ffd8a0'], speed: 0.6, life: 0.35, grav: 0 });
          break;
        }
        case 'bar': {
          o.position.set(e.cx, e.cy, 0.55);
          v.extra.stars.forEach((s, i) => {
            s.position.set(Math.cos(e.ang) * (i + 1) * 0.6, Math.sin(e.ang) * (i + 1) * 0.6, 0);
            s.material.rotation = this.t * 6;
          });
          break;
        }
      }
    }

    spinStars(g, ph) {
      g.children.forEach((s) => {
        const a = ph * 5 + (s.userData.i * Math.PI * 2) / 3;
        s.position.set(Math.cos(a) * 0.55, Math.sin(a * 2) * 0.06, Math.sin(a) * 0.55);
      });
    }

    syncPlayers(S, dt) {
      S.players.forEach((P, i) => {
        const v = this.pv[i];
        if (!v) return;
        const p = v.p, root = p.root;
        const k = damp(18, dt);
        const tommy = P.ch === 'tommy';
        // size: small or big, flickering between the two while growing or shrinking
        const small = tommy ? 0.46 : 0.5, big = tommy ? 0.84 : 0.9;
        let sc = P.pow > 0 ? big : small;
        if (P.grow > 0) sc = Math.floor(P.grow * 14) % 2 ? big : small;
        root.scale.setScalar(sc);
        root.position.set(P.x, P.y, 0.05 - i * 0.12);
        root.visible = P.st !== 'out';
        // flash while you can't be hurt
        if (P.inv > 0 && P.st === 'play' && Math.floor(P.inv * 12) % 2 === 0) root.visible = false;
        // facing
        let rotT = P.face > 0 ? FACE_R : FACE_L;
        let mode = 'idle', ph = v.ph, still = false, hop = 0;
        v.stars.visible = false;
        v.bubble.visible = false;
        switch (P.st) {
          case 'play':
            if (P.hi5 > 0) (mode = Kit.roster.signature(Kit.roster.get(P.ch), 'hello')), (still = true);
            else if (!P.gnd) mode = P.throwT > 0 ? (tommy ? 'toss' : 'jumpshot') : 'jump';
            else if (P.throwT > 0) mode = tommy ? 'toss' : 'jumpshot';
            else if (P.skid) mode = 'skid';
            else if (Math.abs(P.vx) > 0.3) mode = Math.abs(P.vx) > 4 ? 'run' : 'walk';
            if (mode === 'run' || mode === 'walk') v.ph += dt * Math.abs(P.vx) * (mode === 'run' ? 1.9 : 2.6);
            else v.ph += dt * 4;
            ph = mode === 'boxing' ? this.t * 6 : v.ph;
            break;
          case 'dizzy':
          case 'time':
            mode = 'dizzySit';
            v.stars.visible = true;
            this.spinStars(v.stars, this.t);
            rotT = -Math.PI + 0.9;
            ph = this.t;
            break;
          case 'fell': mode = 'fall'; break;
          case 'pipe':
          case 'rise': mode = 'idle'; rotT = -Math.PI; break;
          case 'flag': mode = 'hang'; rotT = FACE_R; break;
          case 'walk': mode = 'walk'; v.ph += dt * 8; ph = v.ph; break;
          case 'cele': {
            const c = TNT.celebration(P.ch, P.t);
            mode = c.mode;
            still = c.still;
            hop = c.hop;
            rotT = -Math.PI + 0.35;
            ph = mode === 'boxing' ? P.t * 6 : this.t * 3;
            if (c.shoot && !v.shot) this.shootBall(v, P);
            if (P.t < 0.1) v.shot = false;
            if (mode === 'peace' && Math.random() < dt * 8) this.parts.emit(P.x, P.y + 2.2, 0.4, 2, { color: ['#ffd400', '#ffffff', '#9dff6a', '#18d4ff'], speed: 2, up: 3, life: 0.9 });
            break;
          }
          case 'carried': mode = 'fall'; break;
          case 'pulled': mode = 'jump'; break;
          case 'drop': mode = 'idle'; v.bubble.visible = true; rotT = -Math.PI; break;
        }
        root.position.y += hop;
        // turn the short way round, through the camera side
        v.rot += (rotT - v.rot) * damp(12, dt);
        root.rotation.y = v.rot;
        TNT.pose(p, ph, mode, mode === 'dizzySit' ? damp(8, dt) : k, still);
        // star power: rainbow sparkle
        const star = P.star > 0;
        const hue = (this.t * 2) % 1;
        for (const m of p.mats) {
          if (!m.emissive) continue;
          if (star) {
            m.emissive.setHSL(hue, 1, 0.5);
            m.emissiveIntensity = 0.28 + Math.sin(this.t * 20) * 0.1;
          } else if (m.userData.baseEmissive) {
            m.emissive.copy(m.userData.baseEmissive);
            m.emissiveIntensity = 1;
          }
        }
        if (star && Math.random() < dt * 20) this.parts.emit(P.x, P.y + P.h * 0.6, 0.3, 1, { color: ['#ffd400', '#ff7ab0', '#18d4ff', '#9dff6a'], speed: 1.5, life: 0.5, grav: 1 });
        if (P.st === 'play' && P.gnd && Math.abs(P.vx) > 7 && Math.random() < dt * 14) this.parts.emit(P.x - P.face * 0.3, P.y + 0.08, 0.2, 1, { color: '#e8dcc8', speed: 0.8, up: 0.8, life: 0.35, grav: 1 });
        if (v.ball) this.updateBall(v, dt);
      });
      // the treat you're holding
      this.updateTreat(S, dt);
    }

    // Teddy's jump shot at the clubhouse hoop
    shootBall(v, P) {
      v.shot = true;
      if (!v.ball) {
        v.ball = sprite(G.emojiTexture('🏀'), 0.5);
        this.scene.add(v.ball);
      }
      v.p.root.updateMatrixWorld(true);
      v.ballFrom = Kit.people.handWorld(v.p, 1, new T.Vector3());
      v.ballTo = new T.Vector3();
      if (this.club) this.club.userData.rim.getWorldPosition(v.ballTo);
      else v.ballTo.set(P.x + 3, P.y + 4, 0);
      v.ballT = 0;
      v.ball.visible = true;
    }

    updateBall(v, dt) {
      if (v.ballT < 0) return;
      v.ballT += dt / 0.8;
      const k = Math.min(1, v.ballT);
      v.ball.position.lerpVectors(v.ballFrom, v.ballTo, k);
      v.ball.position.y += Math.sin(k * Math.PI) * 2.0 + 0.3 * k;
      v.ball.material.rotation -= dt * 9;
      if (k >= 1) {
        v.ballT = -1;
        v.ball.visible = false;
        this.parts.emit(v.ballTo.x, v.ballTo.y, v.ballTo.z, 24, { color: ['#ff9f1c', '#ffffff', '#ffd400'], speed: 3, up: 2, life: 0.7 });
        this.onSwish && this.onSwish();
      }
    }

    syncBuddy(S, dt) {
      const B = this.bud;
      if (!B) return;
      const b = S.bud;
      const root = B.p.root;
      root.visible = b.on;
      if (!b.on) return;
      const P = S.players[0];
      // he's as big as you are (Tommy a little smaller than Teddy, as in real life)
      const big = P.pow > 0;
      const scale = B.id === 'tommy' ? (big ? 0.84 : 0.46) * 1.06 : (big ? 0.9 : 0.5) * 1.06;
      root.scale.setScalar(scale);
      const vy = (b.y - B.lastY) / Math.max(dt, 1e-4), vx = (b.x - B.lastX) / Math.max(dt, 1e-4);
      B.lastX = b.x;
      B.lastY = b.y;
      root.position.set(b.x, b.y, -0.75);
      const t = b.t;
      const air = b.hopT >= 0 || Math.abs(vy) > 1.5;
      const giving = this.treatFly >= 0 && this.treatFly < 0.4;
      let mode;
      if (b.carry >= 0) mode = 'carry';
      else if (air) mode = 'jump';
      else if (giving) mode = 'give';
      else if ((t > 0.9 && t < 2.3) || b.cheer > 0) mode = Kit.roster.signature(B.entry, 'hello');
      else if (t > E.BUD.visit - 1.6 && t < E.BUD.visit) mode = Kit.roster.signature(B.entry, 'goodbye');
      else if (Math.abs(vx) > 0.5) mode = 'run';
      else mode = 'idle';
      B.modeT = mode === B.mode ? B.modeT + dt : 0;
      B.mode = mode;
      B.ph += dt * Math.max(4, Math.abs(vx) * 1.9);
      let hop = 0;
      const posing = mode === 'boxing' || mode === 'peace' || mode === 'jumpshot';
      if (mode === 'jumpshot') {
        const u = B.modeT / 0.8;
        if (u < 1) hop = Math.sin(u * Math.PI) * 0.8;
        if (u > 0.45 && !B.shot) {
          B.shot = true;
          this.shootBall(B, P);
        }
      } else B.shot = false;
      root.position.y += hop;
      const rotT = posing ? -Math.PI + 0.4 : b.face > 0 ? FACE_R : FACE_L;
      B.rot += (rotT - B.rot) * damp(12, dt);
      root.rotation.y = B.rot;
      TNT.pose(B.p, mode === 'boxing' ? t * 6 : B.ph, mode, damp(18, dt), posing && !air);
      if (B.ball) this.updateBall(B, dt);
    }

    giveTreat(S, emoji) {
      if (!this.bud) return;
      this.treat.material.map = G.emojiTexture(emoji);
      this.treat.material.needsUpdate = true;
      this.bud.p.root.updateMatrixWorld(true);
      this.treatFrom = Kit.people.handWorld(this.bud.p, 1, new T.Vector3());
      if (this.treat.parent !== this.scene) this.scene.add(this.treat);
      this.treat.position.copy(this.treatFrom);
      this.treat.scale.set(0.6, 0.6, 1);
      this.treat.visible = true;
      this.treatFly = 0;
    }

    updateTreat(S, dt) {
      if (!this.treat || !this.pv[0]) return;
      const pv = this.pv[0];
      if (this.treatFly >= 0) {
        this.treatFly += dt / 0.55;
        pv.p.root.updateMatrixWorld(true);
        const hand = Kit.people.handWorld(pv.p, 1, new T.Vector3());
        const k = Math.min(1, this.treatFly);
        this.treat.position.lerpVectors(this.treatFrom, hand, k);
        this.treat.position.y += Math.sin(k * Math.PI) * 1.2;
        if (k >= 1) {
          this.treatFly = -1;
          this.treatHold = 7;
          pv.p.armR.add(this.treat);
          this.treat.position.set(0.14, -0.85, -0.25);
          this.treat.scale.set(1.0, 1.0, 1);
          this.parts.emit(hand.x, hand.y, hand.z, 14, { color: '#ffffff', speed: 2, up: 2, life: 0.5 });
        }
      } else if (this.treatHold > 0) {
        this.treatHold -= dt;
        if (this.treatHold <= 0 || S.players[0].st !== 'play') {
          this.treatHold = 0;
          this.treat.visible = false;
          this.scene.add(this.treat);
        }
      }
    }

    syncFlag(S, dt) {
      if (!this.flag) return;
      const cl = this.flag.userData.cloth;
      const h = this.flag.userData.h;
      // the flag comes down with whoever grabbed the pole
      let fy = h - 0.6;
      if (S.cleared) {
        const P = S.players[S.clearBy];
        if (P && P.st === 'flag') fy = Math.max(0.5, Math.min(h - 0.6, P.y - S.flag.base + 0.6));
        else fy = 0.5;
        this.flagY = Math.min(this.flagY ?? fy, fy);
        fy = this.flagY;
      } else this.flagY = undefined;
      cl.position.y = fy;
      const pos = cl.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        pos.setZ(i, Math.sin(this.t * 6 + x * 3) * 0.08 * (x + 0.7));
      }
      pos.needsUpdate = true;
    }

    // ------------------------------------------------------------ effects
    burst(word, x, y, color) {
      const s = sprite(A.burstTex(word, color), 1.3);
      s.position.set(x, y, 0.8);
      this.fx.add(s);
      this.pops.push({ s, life: 0.5, max: 0.5, vy: 0.6, grow: true });
    }

    points(n, x, y) {
      const s = sprite(A.textTex(String(n)), 1);
      s.scale.set(1.2, 0.45, 1);
      s.position.set(x, y, 0.9);
      this.fx.add(s);
      this.pops.push({ s, life: 0.9, max: 0.9, vy: 1.6 });
    }

    coinPop(x, y) {
      const s = sprite(A.coinTex(), 0.6);
      s.position.set(x, y, 0.6);
      this.fx.add(s);
      this.pops.push({ s, life: 0.45, max: 0.45, vy: 9, grav: 30, spin: true });
    }

    text(word, x, y, color) {
      const s = sprite(A.textTex(word, color), 1);
      s.scale.set(2.6, 0.95, 1);
      s.position.set(x, y, 1);
      this.fx.add(s);
      this.pops.push({ s, life: 1.2, max: 1.2, vy: 0.8 });
    }

    breakBlock(x, y) {
      let n = 0;
      for (const sh of this.shards) {
        if (sh.life > 0) continue;
        sh.m.material.color.set(this.th.brick);
        sh.m.visible = true;
        const dx = n % 2 ? 0.25 : -0.25, dy = n < 2 ? 0.25 : -0.25;
        sh.m.position.set(x + 0.5 + dx, y + 0.5 + dy, 0.2);
        sh.vx = dx * 10;
        sh.vy = 8 + (n < 2 ? 3 : 0);
        sh.life = 1.2;
        if (++n >= 4) break;
      }
      this.parts.emit(x + 0.5, y + 0.5, 0.3, 10, { color: ['#e8dcc8', this.th.brick], speed: 3, life: 0.4 });
    }

    bumpTile(x, y) {
      if (!this.S) return;
      this.bumps.set(y * this.S.W + x, 0);
    }

    updateFx(dt) {
      for (let i = this.pops.length - 1; i >= 0; i--) {
        const p = this.pops[i];
        p.life -= dt;
        if (p.grav) p.vy -= p.grav * dt;
        p.s.position.y += p.vy * dt;
        const k = p.life / p.max;
        p.s.material.opacity = Math.min(1, k * 2.5);
        if (p.grow) p.s.scale.setScalar(1.3 * (1 + (1 - k) * 0.6));
        if (p.spin) p.s.scale.x = 0.6 * Math.abs(Math.cos(p.life * 18));
        if (p.life <= 0) {
          this.fx.remove(p.s);
          p.s.material.dispose();
          this.pops.splice(i, 1);
        }
      }
      for (const sh of this.shards) {
        if (sh.life <= 0) continue;
        sh.life -= dt;
        sh.vy -= 30 * dt;
        sh.m.position.x += sh.vx * dt;
        sh.m.position.y += sh.vy * dt;
        sh.m.rotation.x += dt * 9;
        sh.m.rotation.z += dt * 7;
        if (sh.life <= 0) sh.m.visible = false;
      }
      // the subway train
      const train = this.backdrop && this.backdrop.userData.train;
      if (train) {
        train.position.x += dt * 28;
        if (train.position.x > this.camX + 70) train.position.x = this.camX - 120 - Math.random() * 60;
      }
    }

    updateCamera(S, dt) {
      const [w, h] = this.size;
      const aspect = w / h;
      // show about 12.5 tiles of height (at least 17 tiles across), and follow the leader up and down a little
      const Hv = Math.max(12.5, 17 / aspect);
      const fov = (this.camera.fov * Math.PI) / 180;
      const D = Hv / (2 * Math.tan(fov / 2));
      const hw = (Hv * aspect) / 2;
      let cx = S.cam.x;
      if (S.W + 1 < hw * 2) cx = S.W / 2;
      else cx = Math.max(hw - 0.5, Math.min(S.W + 0.5 - hw, cx));
      if (this.snapCam) this.snapCam2 = true;
      this.camX = this.snapCam ? cx : this.camX + (cx - this.camX) * damp(8, dt);
      this.snapCam = false;
      let ty = 0;
      for (const P of S.players) if (P.st !== 'out') ty = Math.max(ty, P.y);
      const lo = Hv / 2 - 0.25, hi = Math.max(lo, E.H + 0.6 - Hv / 2);
      const cyT = Math.max(lo, Math.min(hi, ty + 1.2));
      this.camY = this.snapCam2 ? cyT : this.camY + (cyT - this.camY) * damp(3, dt);
      this.snapCam2 = false;
      const cy = this.camY;
      this.shake = Math.max(0, this.shake - dt * 2.5);
      const sx = this.shake ? (Math.random() - 0.5) * this.shake * 0.5 : 0, sy = this.shake ? (Math.random() - 0.5) * this.shake * 0.5 : 0;
      this.camera.position.set(this.camX + sx, cy + 1.2 + sy, D);
      this.camera.lookAt(this.camX + sx, cy + sy, 0);
      this.camera.updateMatrixWorld();
      this.sun.position.set(this.camX - 10, 24, 16);
      this.sun.target.position.set(this.camX, 4, 0);
      this.sun.target.updateMatrixWorld();
      // the faraway sun and moon drift along slowly
      if (this.backdrop) {
        for (const o of this.backdrop.children) {
          if (o.geometry && o.geometry.type === 'CircleGeometry') o.position.x = this.camX * 0.85 + 12;
        }
      }
    }

    render() {
      this.renderer.render(this.scene, this.camera);
    }
  }

  TNT.World = World;
})();

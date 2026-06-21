'use strict';

PA.view3d = (() => {
  let _scene = null, _camera = null, _renderer = null, _controls = null;
  let _container = null, _animId = null, _active = false;

  function init() {
    document.getElementById('btn-view3d').addEventListener('click', open);
    document.getElementById('btn-3d-close').addEventListener('click', close);
  }

  function open() {
    if (!window.THREE) {
      alert('Three.js no disponible. Verifica tu conexión a internet.');
      return;
    }
    const floor = PA.activeFloor();
    if (!floor || floor.walls.length === 0) {
      alert('Dibuja paredes antes de abrir la Vista 3D.');
      return;
    }
    _active = true;
    document.getElementById('view3d-overlay').classList.remove('hidden');
    _container = document.getElementById('view3d-canvas');
    _build();
  }

  function close() {
    _active = false;
    document.getElementById('view3d-overlay').classList.add('hidden');
    if (_animId) { cancelAnimationFrame(_animId); _animId = null; }
    if (_renderer) { _renderer.dispose(); _renderer = null; }
    if (_container) _container.innerHTML = '';
    _scene = null; _camera = null; _controls = null;
    window.removeEventListener('resize', _onResize);
  }

  function _build() {
    const THREE = window.THREE;
    const w = _container.clientWidth  || 800;
    const h = _container.clientHeight || 600;

    /* Scene */
    _scene = new THREE.Scene();
    _scene.background = new THREE.Color(0xedf2f7);
    _scene.fog = new THREE.Fog(0xedf2f7, 40, 100);

    /* Camera */
    _camera = new THREE.PerspectiveCamera(42, w / h, 0.05, 300);
    _camera.position.set(10, 12, 16);

    /* Renderer */
    _renderer = new THREE.WebGLRenderer({ antialias: true });
    _renderer.setSize(w, h);
    _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    _renderer.shadowMap.enabled = true;
    _renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    _container.appendChild(_renderer.domElement);

    /* OrbitControls */
    if (THREE.OrbitControls) {
      _controls = new THREE.OrbitControls(_camera, _renderer.domElement);
      _controls.enableDamping  = true;
      _controls.dampingFactor  = 0.07;
      _controls.maxPolarAngle  = Math.PI * 0.47;
      _controls.minDistance    = 1;
      _controls.maxDistance    = 100;
    }

    /* Lights */
    _scene.add(new THREE.AmbientLight(0xffffff, 0.60));
    const sun = new THREE.DirectionalLight(0xfff5e0, 0.95);
    sun.position.set(12, 22, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.setScalar(2048);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far  = 100;
    sun.shadow.camera.top  = 30;
    sun.shadow.camera.bottom = -30;
    sun.shadow.camera.left   = -30;
    sun.shadow.camera.right  = 30;
    _scene.add(sun);
    const fill = new THREE.DirectionalLight(0xc8d8f0, 0.30);
    fill.position.set(-8, 6, -6);
    _scene.add(fill);

    /* Ground */
    const gGeo = new THREE.PlaneGeometry(120, 120);
    const gMat = new THREE.MeshLambertMaterial({ color: 0xdde4ed });
    const ground = new THREE.Mesh(gGeo, gMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    _scene.add(ground);

    const grid = new THREE.GridHelper(100, 100, 0xb8c4d0, 0xccd5de);
    grid.material.opacity = 0.45;
    grid.material.transparent = true;
    _scene.add(grid);

    /* Build floors */
    const center = _buildGeometry();

    /* Aim camera */
    if (_controls) {
      _controls.target.copy(center);
      _controls.update();
    }
    const span = Math.max(...PA.state.floors.map(f => {
      let mx = -Infinity, mn = Infinity;
      f.walls.forEach(w => { mx = Math.max(mx, w.x1, w.x2); mn = Math.min(mn, w.x1, w.x2); });
      return mx - mn;
    }));
    _camera.position.set(
      center.x + span * 0.9,
      center.y + span * 1.0,
      center.z + span * 1.3
    );
    _camera.lookAt(center);
    if (_controls) _controls.update();

    window.addEventListener('resize', _onResize);
    _animate();
  }

  function _buildGeometry() {
    const THREE   = window.THREE;
    const FLOOR_H = 3.0;   // metres between floor levels
    const WALL_H  = 2.65;  // wall height
    const SLAB_H  = 0.20;  // slab thickness

    const WALL_MATS = [
      new THREE.MeshLambertMaterial({ color: 0x94a9be }),
      new THREE.MeshLambertMaterial({ color: 0x7890aa }),
      new THREE.MeshLambertMaterial({ color: 0x607896 })
    ];
    const SLAB_MAT = new THREE.MeshLambertMaterial({ color: 0xb8c8d8 });
    const ROOM_COLS = [0x3b82f6, 0x10b981, 0xf59e0b, 0x8b5cf6, 0xef4444, 0x06b6d4, 0xf97316];

    let gMinX = Infinity, gMaxX = -Infinity;
    let gMinZ = Infinity, gMaxZ = -Infinity;

    PA.state.floors.forEach((floor, fi) => {
      const baseY = fi * FLOOR_H;
      const wallH = fi === 0 ? WALL_H : WALL_H;

      /* Walls with door/window openings */
      floor.walls.forEach(wall => {
        const dx = wall.x2 - wall.x1, dz = wall.y2 - wall.y1;
        const L  = Math.hypot(dx, dz);
        if (L < 0.01) return;

        const mat  = WALL_MATS[fi % WALL_MATS.length];
        const h    = wall.height || wallH;
        const openings = [
          ...floor.doors.filter(d => d.wallId === wall.id).map(d => ({ t: d.t, width: d.width, type: 'door' })),
          ...floor.windows.filter(w => w.wallId === wall.id).map(w => ({ t: w.t, width: w.width, type: 'window' }))
        ];

        _buildWallWithOpenings(wall, openings, baseY, h, mat);

        [wall.x1, wall.x2].forEach(x => { gMinX = Math.min(gMinX, x); gMaxX = Math.max(gMaxX, x); });
        [wall.y1, wall.y2].forEach(z => { gMinZ = Math.min(gMinZ, z); gMaxZ = Math.max(gMaxZ, z); });
      });

      /* Floor slab (above ground floor) */
      if (fi > 0 && floor.walls.length > 0) {
        let fx1 = Infinity, fz1 = Infinity, fx2 = -Infinity, fz2 = -Infinity;
        floor.walls.forEach(w => {
          fx1 = Math.min(fx1, w.x1, w.x2); fx2 = Math.max(fx2, w.x1, w.x2);
          fz1 = Math.min(fz1, w.y1, w.y2); fz2 = Math.max(fz2, w.y1, w.y2);
        });
        const sw = fx2 - fx1 + 0.4, sd = fz2 - fz1 + 0.4;
        const slabGeo = new THREE.BoxGeometry(sw, SLAB_H, sd);
        const slab = new THREE.Mesh(slabGeo, SLAB_MAT);
        slab.position.set((fx1 + fx2) / 2, baseY - SLAB_H / 2, (fz1 + fz2) / 2);
        slab.receiveShadow = true;
        _scene.add(slab);
      }

      /* Room floor tiles */
      floor.rooms.forEach((room, ri) => {
        const area = room.area || 0;
        if (area < 0.5) return;
        const side = Math.sqrt(area);
        const tGeo = new THREE.PlaneGeometry(side * 0.82, side * 0.82);
        const tMat = new THREE.MeshLambertMaterial({
          color: ROOM_COLS[ri % ROOM_COLS.length],
          opacity: 0.20, transparent: true, side: THREE.DoubleSide
        });
        const tile = new THREE.Mesh(tGeo, tMat);
        tile.rotation.x = -Math.PI / 2;
        tile.position.set(room.x, baseY + 0.02, room.y);
        _scene.add(tile);
      });

      /* Stairs as ramps */
      if (floor.stairs) {
        floor.stairs.forEach(st => {
          const sw = st.x2 - st.x1, sd = st.y2 - st.y1;
          const rGeo = new THREE.BoxGeometry(sw, 0.08, sd);
          const rMat = new THREE.MeshLambertMaterial({ color: 0xc0a070 });
          const ramp = new THREE.Mesh(rGeo, rMat);
          ramp.position.set((st.x1 + st.x2) / 2, baseY + 0.04, (st.y1 + st.y2) / 2);
          _scene.add(ramp);
        });
      }
    });

    const cx = isFinite(gMinX) ? (gMinX + gMaxX) / 2 : 3;
    const cz = isFinite(gMinZ) ? (gMinZ + gMaxZ) / 2 : 6;
    const cy = (PA.state.floors.length * FLOOR_H) / 2;
    return new THREE.Vector3(cx, cy, cz);
  }

  /* Builds a wall as multiple BoxGeometry panels to cut holes for doors/windows */
  function _buildWallWithOpenings(wall, openings, baseY, wallH, mat) {
    const THREE   = window.THREE;
    const dx = wall.x2 - wall.x1, dz = wall.y2 - wall.y1;
    const L  = Math.hypot(dx, dz);
    if (L < 0.01) return;
    const ux    = dx / L, uz = dz / L;
    const angle = -Math.atan2(dz, dx);
    const thick  = wall.thickness || 0.15;
    const DOOR_H = Math.min(2.1, wallH);
    const WIN_SILL = 0.9, WIN_TOP = Math.min(2.1, wallH);

    // Convert each opening to [tStart, tEnd] fractions, clamped to [0,1]
    const gaps = openings.map(op => ({
      tStart: Math.max(0, op.t - op.width / (2 * L)),
      tEnd:   Math.min(1, op.t + op.width / (2 * L)),
      type:   op.type
    })).sort((a, b) => a.tStart - b.tStart);

    // Build list of solid intervals (between gaps)
    const solids = [];
    let cur = 0;
    for (const g of gaps) {
      if (g.tStart > cur + 0.002) solids.push({ tStart: cur, tEnd: g.tStart });
      cur = Math.max(cur, g.tEnd);
    }
    if (cur < 1 - 0.002) solids.push({ tStart: cur, tEnd: 1 });

    const addPanel = (tS, tE, yBot, h) => {
      const segLen = (tE - tS) * L;
      if (segLen < 0.002 || h < 0.002) return;
      const ct = (tS + tE) / 2;
      const geo  = new THREE.BoxGeometry(segLen, h, thick);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.position.set(wall.x1 + ux * ct * L, baseY + yBot + h / 2, wall.y1 + uz * ct * L);
      mesh.rotation.y = angle;
      _scene.add(mesh);
    };

    solids.forEach(s => addPanel(s.tStart, s.tEnd, 0, wallH));
    gaps.forEach(g => {
      if (g.type === 'door') {
        if (wallH > DOOR_H) addPanel(g.tStart, g.tEnd, DOOR_H, wallH - DOOR_H); // lintel only
      } else {
        addPanel(g.tStart, g.tEnd, 0, WIN_SILL);                                  // sill
        if (wallH > WIN_TOP) addPanel(g.tStart, g.tEnd, WIN_TOP, wallH - WIN_TOP); // lintel
      }
    });
  }

  function _animate() {
    if (!_active || !_renderer) return;
    _animId = requestAnimationFrame(_animate);
    if (_controls) _controls.update();
    _renderer.render(_scene, _camera);
  }

  function _onResize() {
    if (!_renderer || !_container || !_camera) return;
    const w = _container.clientWidth, h = _container.clientHeight;
    if (!w || !h) return;
    _camera.aspect = w / h;
    _camera.updateProjectionMatrix();
    _renderer.setSize(w, h);
  }

  return { init, open, close };
})();

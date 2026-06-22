'use strict';

PA.view3d = (() => {
  let _scene = null, _camera = null, _renderer = null, _controls = null;
  let _container = null, _animId = null, _active = false;
  let _floorMode = 'active'; // 'active' | 'all'

  /* ── Colores de habitaciones ─────────────────────── */
  const ROOM_COLS = [0x3b82f6,0x10b981,0xf59e0b,0x8b5cf6,0xef4444,0x06b6d4,0xf97316,0xec4899];

  /* ── Materiales de muebles por tipo ─────────────── */
  const FURN_COLORS = {
    sofa:'#e2e8f0', sillon:'#e2e8f0', mesacent:'#fef3c7', mesa4p:'#fef3c7',
    silla:'#e2e8f0', camadob:'#dbeafe', camasen:'#dbeafe', closet:'#f1f5f9',
    nevera:'#f0f9ff', estufa:'#f1f5f9', meson:'#f1f5f9',
    inodoro:'#e0f2fe', lavamanos:'#e0f2fe', ducha:'#e0f2fe', banera:'#e0f2fe'
  };
  const FURN_H = { closet:2.0, nevera:1.8, estufa:0.85, meson:0.90,
                   mesa4p:0.75, silla:0.90, sofa:0.80, sillon:0.85,
                   mesacent:0.45, camadob:0.55, camasen:0.55,
                   inodoro:0.80, lavamanos:0.85, ducha:0.05, banera:0.55 };

  function init() {
    document.getElementById('btn-view3d').addEventListener('click', open);
    document.getElementById('btn-3d-close').addEventListener('click', close);
  }

  function open() {
    if (!window.THREE) { alert('Three.js no disponible. Verifica tu conexión.'); return; }
    const floor = PA.activeFloor();
    if (!floor || floor.walls.length === 0) { alert('Dibuja paredes antes de abrir Vista 3D.'); return; }
    _active = true;
    document.getElementById('view3d-overlay').classList.remove('hidden');
    _container = document.getElementById('view3d-canvas');

    // Actualizar selector de piso en toolbar
    _syncFloorSelector();
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

  /* ── Sincronizar selector con pisos reales ─────── */
  function _syncFloorSelector() {
    const sel = document.getElementById('view3d-floor-sel');
    if (!sel) return;
    sel.innerHTML = '<option value="active">Solo piso activo</option><option value="all">Todos los pisos</option>';
    PA.state.floors.forEach((f, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = f.name || ('Piso ' + (i + 1));
      if (i === PA.state.activeFloor) opt.selected = (_floorMode === 'active');
      sel.appendChild(opt);
    });
    sel.value = _floorMode;
    sel.onchange = () => {
      _floorMode = sel.value;
      _rebuild();
    };
  }

  function _rebuild() {
    if (!_active || !_renderer) return;
    // Limpiar objetos de escena (mantener luces y suelo)
    const toRemove = [];
    _scene.traverse(obj => { if (obj.isMesh && !obj.userData.ground) toRemove.push(obj); });
    toRemove.forEach(obj => { _scene.remove(obj); if (obj.geometry) obj.geometry.dispose(); });
    const center = _buildGeometry();
    if (_controls) { _controls.target.copy(center); _controls.update(); }
  }

  function _build() {
    const THREE = window.THREE;
    const w = _container.clientWidth  || 800;
    const h = _container.clientHeight || 600;

    /* Scene */
    _scene = new THREE.Scene();
    _scene.background = new THREE.Color(0xe8eef5);
    _scene.fog = new THREE.FogExp2(0xe8eef5, 0.018);

    /* Camera */
    _camera = new THREE.PerspectiveCamera(40, w / h, 0.05, 300);
    _camera.position.set(10, 12, 16);

    /* Renderer */
    _renderer = new THREE.WebGLRenderer({ antialias: true });
    _renderer.setSize(w, h);
    _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    _renderer.shadowMap.enabled  = true;
    _renderer.shadowMap.type     = THREE.PCFSoftShadowMap;
    _renderer.physicallyCorrectLights = true;
    _container.appendChild(_renderer.domElement);

    /* OrbitControls */
    if (THREE.OrbitControls) {
      _controls = new THREE.OrbitControls(_camera, _renderer.domElement);
      _controls.enableDamping = true;
      _controls.dampingFactor = 0.07;
      _controls.maxPolarAngle = Math.PI * 0.48;
      _controls.minDistance   = 1;
      _controls.maxDistance   = 120;
    }

    /* Lights */
    _scene.add(new THREE.AmbientLight(0xffffff, 0.55));

    const sun = new THREE.DirectionalLight(0xfff8e7, 1.1);
    sun.position.set(15, 25, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.setScalar(2048);
    sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 120;
    sun.shadow.camera.top = 35; sun.shadow.camera.bottom = -35;
    sun.shadow.camera.left = -35; sun.shadow.camera.right = 35;
    _scene.add(sun);

    const fill = new THREE.DirectionalLight(0xc8daef, 0.28);
    fill.position.set(-10, 8, -8);
    _scene.add(fill);

    const sky = new THREE.HemisphereLight(0xd0e8ff, 0xc8b88a, 0.35);
    _scene.add(sky);

    /* Ground */
    const gGeo = new THREE.PlaneGeometry(160, 160);
    const gMat = new THREE.MeshLambertMaterial({ color: 0xcdd8e3 });
    const ground = new THREE.Mesh(gGeo, gMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.userData.ground = true;
    _scene.add(ground);

    const grid = new THREE.GridHelper(120, 120, 0xaab8c4, 0xbecad4);
    grid.material.opacity = 0.40; grid.material.transparent = true;
    grid.userData.ground = true;
    _scene.add(grid);

    /* Build geometry and aim camera */
    const center = _buildGeometry();
    if (_controls) { _controls.target.copy(center); _controls.update(); }

    const floorsToRender = _getFloorsToRender();
    let span = 6;
    floorsToRender.forEach(({ floor: f }) => {
      let mx = -Infinity, mn = Infinity;
      f.walls.forEach(w => { mx = Math.max(mx, w.x1, w.x2); mn = Math.min(mn, w.x1, w.x2); });
      if (isFinite(mx)) span = Math.max(span, mx - mn);
    });
    _camera.position.set(center.x + span * 0.9, center.y + span * 1.0, center.z + span * 1.3);
    _camera.lookAt(center);
    if (_controls) _controls.update();

    window.addEventListener('resize', _onResize);
    _animate();
  }

  /* ── Qué pisos mostrar según _floorMode ─────────── */
  function _getFloorsToRender() {
    if (_floorMode === 'all') {
      return PA.state.floors.map((floor, fi) => ({ floor, fi }));
    }
    if (_floorMode === 'active') {
      const fi = PA.state.activeFloor;
      return [{ floor: PA.state.floors[fi], fi }];
    }
    // Número de piso específico
    const fi = parseInt(_floorMode, 10);
    if (!isNaN(fi) && PA.state.floors[fi]) return [{ floor: PA.state.floors[fi], fi }];
    const afi = PA.state.activeFloor;
    return [{ floor: PA.state.floors[afi], fi: afi }];
  }

  /* ── Construcción de geometría 3D ─────────────────── */
  function _buildGeometry() {
    const THREE   = window.THREE;
    const FLOOR_H = 3.0;
    const WALL_H  = 2.65;
    const SLAB_H  = 0.20;

    const WALL_MATS = [
      new THREE.MeshPhongMaterial({ color: 0x8fa8bc, shininess: 12 }),
      new THREE.MeshPhongMaterial({ color: 0x7090a8, shininess: 12 }),
      new THREE.MeshPhongMaterial({ color: 0x607890, shininess: 12 })
    ];
    const SLAB_MAT = new THREE.MeshPhongMaterial({ color: 0xaabccc, shininess: 8 });
    const GLASS_MAT = new THREE.MeshPhongMaterial({
      color: 0x9cc8e8, opacity: 0.32, transparent: true,
      shininess: 90, specular: 0xffffff, side: THREE.DoubleSide
    });

    let gMinX = Infinity, gMaxX = -Infinity;
    let gMinZ = Infinity, gMaxZ = -Infinity;

    const floorsToRender = _getFloorsToRender();

    floorsToRender.forEach(({ floor, fi }) => {
      const baseY = fi * FLOOR_H;
      const wallH = WALL_H;
      const mat   = WALL_MATS[fi % WALL_MATS.length];

      /* Paredes con huecos para puertas y ventanas */
      floor.walls.forEach(wall => {
        const L = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1);
        if (L < 0.01) return;
        const h = wall.height || wallH;
        const openings = [
          ...floor.doors.filter(d => d.wallId === wall.id)
            .map(d => ({ t: d.t, width: d.width || 0.9, type: 'door' })),
          ...floor.windows.filter(w => w.wallId === wall.id)
            .map(w => ({ t: w.t, width: w.width || 0.9, type: 'window' }))
        ];
        _buildWallWithOpenings(wall, openings, baseY, h, mat, GLASS_MAT);
        [wall.x1, wall.x2].forEach(x => { gMinX = Math.min(gMinX, x); gMaxX = Math.max(gMaxX, x); });
        [wall.y1, wall.y2].forEach(z => { gMinZ = Math.min(gMinZ, z); gMaxZ = Math.max(gMaxZ, z); });
      });

      /* Losa de entrepiso (si hay piso superior) */
      if (fi > 0 && floor.walls.length > 0) {
        let fx1=Infinity, fz1=Infinity, fx2=-Infinity, fz2=-Infinity;
        floor.walls.forEach(w => {
          fx1=Math.min(fx1,w.x1,w.x2); fx2=Math.max(fx2,w.x1,w.x2);
          fz1=Math.min(fz1,w.y1,w.y2); fz2=Math.max(fz2,w.y1,w.y2);
        });
        const sw = fx2 - fx1 + 0.4, sd = fz2 - fz1 + 0.4;
        const slab = new THREE.Mesh(new THREE.BoxGeometry(sw, SLAB_H, sd), SLAB_MAT);
        slab.position.set((fx1+fx2)/2, baseY - SLAB_H/2, (fz1+fz2)/2);
        slab.receiveShadow = true;
        _scene.add(slab);
      }

      /* Pisos de habitaciones coloreados */
      floor.rooms.forEach((room, ri) => {
        const area = room.area || 0;
        if (area < 0.5) return;
        const side = Math.sqrt(area);
        const col  = room.color ? parseInt(room.color.replace('#',''), 16) : ROOM_COLS[ri % ROOM_COLS.length];
        const tMat = new THREE.MeshPhongMaterial({ color: col, opacity: 0.22, transparent: true, side: THREE.DoubleSide });
        const tile = new THREE.Mesh(new THREE.PlaneGeometry(side * 0.80, side * 0.80), tMat);
        tile.rotation.x = -Math.PI / 2;
        tile.position.set(room.x, baseY + 0.015, room.y);
        _scene.add(tile);
      });

      /* Escaleras — shape-aware */
      (floor.stairs || []).forEach(st => {
        const sw = Math.abs(st.x2 - st.x1), sd = Math.abs(st.y2 - st.y1);
        if (sw < 0.1 || sd < 0.1) return;
        const shape  = st.shape || 'straight';
        const steps  = st.steps || 10;
        const uRunW  = st.uRunW || 0.30;
        const stepH  = wallH / steps;
        const rMat   = new THREE.MeshPhongMaterial({ color: 0xc09a6a, shininess: 20 });
        const landMat= new THREE.MeshPhongMaterial({ color: 0xd4b896, shininess: 25 });

        const addBox = (cx, cy, cz, bw, bh, bd, mat) => {
          const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mat);
          m.position.set(cx, baseY + cy, cz);
          m.castShadow = true;
          _scene.add(m);
        };

        if (shape === 'straight') {
          // Rampa base
          addBox((st.x1+st.x2)/2, 0.05, (st.y1+st.y2)/2, sw, 0.10, sd, rMat);
          // Peldaños individuales
          const isH = sw >= sd;
          for (let s = 0; s < steps; s++) {
            const sh = stepH * s + 0.04;
            if (isH) {
              const sW = sw / steps;
              addBox(st.x1 + sW*s + sW/2, sh, (st.y1+st.y2)/2, sW-0.02, 0.04, sd-0.02, new THREE.MeshPhongMaterial({ color: 0xb08058 }));
            } else {
              const sD = sd / steps;
              addBox((st.x1+st.x2)/2, sh, st.y1 + sD*s + sD/2, sw-0.02, 0.04, sD-0.02, new THREE.MeshPhongMaterial({ color: 0xb08058 }));
            }
          }

        } else if (shape === 'u') {
          const rw = sw * uRunW, lh = sd * 0.18;
          const runH = sd - lh;
          const steps1 = Math.ceil(steps/2), steps2 = Math.floor(steps/2);
          // Descanso superior
          addBox((st.x1+st.x2)/2, wallH - 0.06, st.y1 + lh/2, sw, 0.12, lh, landMat);
          // Corredor izquierdo
          for (let s = 0; s < steps1; s++) {
            const sD = runH / steps1;
            addBox(st.x1 + rw/2, stepH*s + 0.04, st.y1 + lh + sD*s + sD/2, rw-0.02, 0.04, sD-0.02, rMat);
          }
          // Corredor derecho
          for (let s = 0; s < steps2; s++) {
            const sD = runH / steps2;
            addBox(st.x2 - rw/2, stepH*s + 0.04, st.y1 + lh + sD*s + sD/2, rw-0.02, 0.04, sD-0.02, rMat);
          }

        } else if (shape === 'l-right') {
          const rh = sd * 0.42, rw = sw * 0.42;
          const r1w = sw - rw;
          const steps1 = Math.ceil(steps/2), steps2 = Math.floor(steps/2);
          // Run 1 (horizontal inferior)
          for (let s = 0; s < steps1; s++) {
            const sW = r1w / steps1;
            addBox(st.x1 + sW*s + sW/2, stepH*s + 0.04, st.y2 - rh/2, sW-0.02, 0.04, rh-0.02, rMat);
          }
          // Descanso
          addBox(st.x2 - rw/2, stepH*steps1 - 0.06, st.y2 - rh/2, rw, 0.12, rh, landMat);
          // Run 2 (vertical derecho)
          for (let s = 0; s < steps2; s++) {
            const sD = (sd - rh) / steps2;
            addBox(st.x2 - rw/2, stepH*(steps1+s) + 0.04, st.y1 + sD*s + sD/2, rw-0.02, 0.04, sD-0.02, rMat);
          }

        } else if (shape === 'l-left') {
          const rh = sd * 0.42, rw = sw * 0.42;
          const r1w = sw - rw;
          const steps1 = Math.ceil(steps/2), steps2 = Math.floor(steps/2);
          // Run 1 (horizontal inferior)
          for (let s = 0; s < steps1; s++) {
            const sW = r1w / steps1;
            addBox(st.x1 + rw + sW*s + sW/2, stepH*s + 0.04, st.y2 - rh/2, sW-0.02, 0.04, rh-0.02, rMat);
          }
          // Descanso
          addBox(st.x1 + rw/2, stepH*steps1 - 0.06, st.y2 - rh/2, rw, 0.12, rh, landMat);
          // Run 2 (vertical izquierdo)
          for (let s = 0; s < steps2; s++) {
            const sD = (sd - rh) / steps2;
            addBox(st.x1 + rw/2, stepH*(steps1+s) + 0.04, st.y1 + sD*s + sD/2, rw-0.02, 0.04, sD-0.02, rMat);
          }
        }
      });

      /* Mobiliario */
      _buildFurniture(floor, baseY, THREE);

      /* Patios de luz — hueco abierto (plano semitransparente en el suelo) */
      (floor.lightwells || []).forEach(lw => {
        const lwMat = new THREE.MeshPhongMaterial({
          color: 0x93c5fd, opacity: 0.22, transparent: true, side: THREE.DoubleSide
        });
        const lwMesh = new THREE.Mesh(new THREE.PlaneGeometry(lw.w, lw.h), lwMat);
        lwMesh.rotation.x = -Math.PI / 2;
        lwMesh.position.set(lw.x + lw.w / 2, baseY + 0.02, lw.y + lw.h / 2);
        _scene.add(lwMesh);
        // Marco perimetral visible
        const edgeMat = new THREE.LineBasicMaterial({ color: 0x3b82f6, linewidth: 2 });
        const edgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(lw.w, 0.02, lw.h));
        const edges   = new THREE.LineSegments(edgeGeo, edgeMat);
        edges.position.set(lw.x + lw.w / 2, baseY + 0.01, lw.y + lw.h / 2);
        _scene.add(edges);
      });

      /* Tragaluces — caja transparente sobre el techo */
      (floor.skylights || []).forEach(sl => {
        const slH  = 0.25;
        const slMat = new THREE.MeshPhongMaterial({
          color: 0x93c5fd, opacity: 0.38, transparent: true,
          shininess: 90, specular: 0xffffff, side: THREE.DoubleSide
        });
        const slMesh = new THREE.Mesh(new THREE.BoxGeometry(sl.w, slH, sl.h), slMat);
        slMesh.position.set(sl.x + sl.w / 2, baseY + WALL_H + slH / 2, sl.y + sl.h / 2);
        slMesh.castShadow = false;
        _scene.add(slMesh);
        const frameMat = new THREE.LineBasicMaterial({ color: 0xd97706, linewidth: 2 });
        const frameGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(sl.w, slH, sl.h));
        const frame    = new THREE.LineSegments(frameGeo, frameMat);
        frame.position.copy(slMesh.position);
        _scene.add(frame);
      });
    });

    const cx = isFinite(gMinX) ? (gMinX + gMaxX) / 2 : 3;
    const cz = isFinite(gMinZ) ? (gMinZ + gMaxZ) / 2 : 6;
    const cy = floorsToRender.length > 0
      ? ((Math.max(...floorsToRender.map(f => f.fi)) + 1) * FLOOR_H) / 2
      : 1.5;
    return new THREE.Vector3(cx, cy, cz);
  }

  /* ── Mobiliario 3D (cajas coloreadas) ────────────── */
  function _buildFurniture(floor, baseY, THREE) {
    (floor.furniture || []).forEach(item => {
      const fh = FURN_H[item.type] || 0.80;
      const col = parseInt((FURN_COLORS[item.type] || '#e2e8f0').replace('#',''), 16);
      const mat = new THREE.MeshPhongMaterial({ color: col, shininess: 30 });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(item.w, fh, item.h), mat);
      mesh.castShadow = true;
      const rot = item.rotation || 0;
      const cx  = item.x + Math.cos(rot) * 0 - Math.sin(rot) * 0;
      const cz  = item.y + Math.sin(rot) * 0 + Math.cos(rot) * 0;
      mesh.position.set(cx, baseY + fh / 2, cz);
      mesh.rotation.y = -rot;
      _scene.add(mesh);
    });
  }

  /* ── Pared con huecos para puertas/ventanas ─────── */
  function _buildWallWithOpenings(wall, openings, baseY, wallH, mat, glassMat) {
    const THREE  = window.THREE;
    const dx = wall.x2 - wall.x1, dz = wall.y2 - wall.y1;
    const L  = Math.hypot(dx, dz);
    if (L < 0.01) return;
    const ux     = dx / L, uz = dz / L;
    const angle  = -Math.atan2(dz, dx);
    const thick  = wall.thickness || 0.15;
    const DOOR_H = Math.min(2.1, wallH);
    const WIN_SILL = 0.9, WIN_TOP = Math.min(2.1, wallH);

    const gaps = openings.map(op => ({
      tStart: Math.max(0, op.t - op.width / (2 * L)),
      tEnd:   Math.min(1, op.t + op.width / (2 * L)),
      type:   op.type
    })).sort((a, b) => a.tStart - b.tStart);

    const solids = [];
    let cur = 0;
    for (const g of gaps) {
      if (g.tStart > cur + 0.002) solids.push({ tStart: cur, tEnd: g.tStart });
      cur = Math.max(cur, g.tEnd);
    }
    if (cur < 1 - 0.002) solids.push({ tStart: cur, tEnd: 1 });

    const addPanel = (tS, tE, yBot, h, m) => {
      const segLen = (tE - tS) * L;
      if (segLen < 0.002 || h < 0.002) return;
      const ct   = (tS + tE) / 2;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(segLen, h, thick), m || mat);
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.position.set(wall.x1 + ux * ct * L, baseY + yBot + h / 2, wall.y1 + uz * ct * L);
      mesh.rotation.y = angle;
      _scene.add(mesh);
    };

    solids.forEach(s => addPanel(s.tStart, s.tEnd, 0, wallH));
    gaps.forEach(g => {
      if (g.type === 'door') {
        if (wallH > DOOR_H) addPanel(g.tStart, g.tEnd, DOOR_H, wallH - DOOR_H);
      } else {
        addPanel(g.tStart, g.tEnd, 0, WIN_SILL);
        // Vidrio de ventana
        addPanel(g.tStart, g.tEnd, WIN_SILL, WIN_TOP - WIN_SILL, glassMat);
        if (wallH > WIN_TOP) addPanel(g.tStart, g.tEnd, WIN_TOP, wallH - WIN_TOP);
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
    _camera.aspect = w / h; _camera.updateProjectionMatrix();
    _renderer.setSize(w, h);
  }

  return { init, open, close };
})();

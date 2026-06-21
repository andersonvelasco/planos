'use strict';

PA.structural = (() => {

  let showColumns = true;
  let _data  = null;
  let _zone  = 'intermedia';
  let _soil  = 10; // t/m² capacidad portante

  /* ── NSR-10: zonas de amenaza sísmica ───────────── */
  const ZONES = {
    alta:       { label: 'Alta',       Aa: 0.25, zFactor: 1.30 },
    intermedia: { label: 'Intermedia', Aa: 0.15, zFactor: 1.15 },
    baja:       { label: 'Baja',       Aa: 0.05, zFactor: 1.00 }
  };

  /* ── Tabla de especificaciones por tamaño de columna */
  const COL_SPECS = {
    20: {
      cm: 20, label: '20 × 20 cm',
      rebar:   '4 varillas #3 (3/8")',
      stirrup: 'Estribos #2 @20cm / @10cm zona confinada',
      fc: 17.5, fcPSI: 2500
    },
    25: {
      cm: 25, label: '25 × 25 cm',
      rebar:   '4 varillas #4 (1/2")',
      stirrup: 'Estribos #3 @15cm / @7.5cm zona confinada',
      fc: 21, fcPSI: 3000
    },
    30: {
      cm: 30, label: '30 × 30 cm',
      rebar:   '4 varillas #5 (5/8")',
      stirrup: 'Estribos #3 @10cm / @5cm zona confinada',
      fc: 21, fcPSI: 3000
    },
    35: {
      cm: 35, label: '35 × 35 cm',
      rebar:   '6 varillas #5 (5/8")',
      stirrup: 'Estribos #4 @10cm / @5cm zona confinada',
      fc: 28, fcPSI: 4000
    }
  };

  /* ── Selección de sección de columna (NSR-10) ────── */
  function _pickColCm(zone, floors) {
    if (zone === 'alta')       return floors >= 3 ? 35 : floors >= 2 ? 30 : 25;
    if (zone === 'intermedia') return floors >= 3 ? 30 : floors >= 2 ? 25 : 20;
    return floors >= 2 ? 25 : 20; // baja
  }

  /* ── Detección de posiciones de columnas ─────────── */
  function detectColumns() {
    const floor  = PA.activeFloor();
    const MERGE  = 0.12;
    const MAX_SPAN = 4.0; // NSR-10: máx 4m entre confinamientos

    const raw = [];
    floor.walls.forEach(w => {
      raw.push({ x: w.x1, y: w.y1 });
      raw.push({ x: w.x2, y: w.y2 });
    });

    // Fusionar puntos cercanos
    const clusters = [];
    raw.forEach(pt => {
      const f = clusters.find(c => Math.hypot(c.x - pt.x, c.y - pt.y) < MERGE);
      if (f) { f.x = (f.x + pt.x) / 2; f.y = (f.y + pt.y) / 2; f.n++; }
      else clusters.push({ x: pt.x, y: pt.y, n: 1 });
    });

    // Columnas intermedias en tramos largos
    floor.walls.forEach(w => {
      const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
      const len = Math.hypot(dx, dy);
      if (len <= MAX_SPAN) return;
      const n = Math.ceil(len / MAX_SPAN);
      for (let i = 1; i < n; i++) {
        const t = i / n;
        const pt = { x: w.x1 + dx * t, y: w.y1 + dy * t, n: 1 };
        if (!clusters.some(c => Math.hypot(c.x - pt.x, c.y - pt.y) < MERGE))
          clusters.push(pt);
      }
    });

    clusters.sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x);
    return clusters.map((c, i) => ({ x: c.x, y: c.y, label: 'C' + (i + 1), n: c.n }));
  }

  /* ── Cálculo estructural principal ───────────────── */
  function calcStructure() {
    const floor     = PA.activeFloor();
    if (!floor || floor.walls.length === 0) return null;

    const columns   = detectColumns();
    const numCols   = Math.max(1, columns.length);
    const numFloors = PA.state.floors.length;
    const zone      = _zone;
    const soilCap   = _soil;
    const zf        = ZONES[zone].zFactor;

    // Área de piso
    let floorArea = floor.rooms.reduce((s, r) => s + (r.area || 0), 0);
    if (floorArea < 1) {
      let x1=Infinity, y1=Infinity, x2=-Infinity, y2=-Infinity;
      floor.walls.forEach(w => {
        x1=Math.min(x1,w.x1,w.x2); x2=Math.max(x2,w.x1,w.x2);
        y1=Math.min(y1,w.y1,w.y2); y2=Math.max(y2,w.y1,w.y2);
      });
      floorArea = (x2-x1) * (y2-y1);
    }

    // Sección de columna según zona + pisos
    const colCm   = _pickColCm(zone, numFloors);
    const spec    = COL_SPECS[colCm];
    const colM    = colCm / 100;

    // Carga por columna: (carga muerta 0.6 + viva 0.2) t/m² × pisos × factor sísmico
    const loadPerCol = (floorArea / numCols) * (0.6 + 0.2) * numFloors * zf;

    // Zapatas aisladas
    const footRaw  = Math.sqrt(loadPerCol / soilCap);
    const footSize = Math.max(0.80, Math.ceil(footRaw * 10) / 10);
    const footDepth = Math.max(0.35, Math.ceil(footSize * 0.35 * 10) / 10);
    const desplante = zone === 'baja' ? 0.60 : 0.80;

    // Longitud total de paredes y luz media de vano
    let totalWallLen = 0;
    floor.walls.forEach(w => { totalWallLen += Math.hypot(w.x2-w.x1, w.y2-w.y1); });
    const avgSpan = numCols > 1 ? totalWallLen / numCols : 3.0;

    // Vigas de amarre (NSR-10: mín 15×20cm)
    const beamD = Math.max(0.25, Math.ceil((avgSpan / 12) * 10) / 10);
    const beamW = Math.max(0.20, colM);

    // Volúmenes de concreto
    const wallH = (PA.state.wallHeight || 2.5);
    const volCols  = numCols * colM * colM * wallH * numFloors;
    const volFoot  = numCols * footSize * footSize * footDepth;
    const volBeams = totalWallLen * beamW * beamD * numFloors;
    const volTotal = volCols + volFoot + volBeams;

    // Insumos de concreto (mezcla 1:2:3 → ~7 sacos/m³)
    const cementSacks = Math.ceil(volTotal * 7);
    const sandM3      = Math.round(volTotal * 0.56 * 10) / 10;
    const gravelM3    = Math.round(volTotal * 0.84 * 10) / 10;

    // Acero (~95 kg/m³ promedio concreto estructural)
    const rebarKg = Math.round(volTotal * 95);

    // Longitud de muros de mampostería
    const wallArea = totalWallLen * wallH;
    const bloques  = Math.ceil(wallArea * 12.5); // 12.5 bloques/m²

    columns.forEach(c => {
      c.load = Math.round(loadPerCol * 10) / 10;
      c.footSize = footSize;
      c.colM = colM;
    });

    return {
      columns, numCols, numFloors,
      floorArea: Math.round(floorArea * 10) / 10,
      zone, zf,
      colCm, spec, colM,
      loadPerCol:  Math.round(loadPerCol * 10) / 10,
      totalLoad:   Math.round(loadPerCol * numCols * 10) / 10,
      footSize, footDepth, desplante,
      beamW, beamD,
      avgSpan: Math.round(avgSpan * 100) / 100,
      volTotal:  Math.round(volTotal * 100) / 100,
      volCols:   Math.round(volCols * 100) / 100,
      volFoot:   Math.round(volFoot * 100) / 100,
      volBeams:  Math.round(volBeams * 100) / 100,
      cementSacks, sandM3, gravelM3, rebarKg,
      wallArea: Math.round(wallArea * 10) / 10,
      bloques,
      totalWallLen: Math.round(totalWallLen * 10) / 10
    };
  }

  /* ── Panel de resultados ─────────────────────────── */
  function update() {
    const el   = document.getElementById('structural-summary');
    const data = calcStructure();
    _data = data;

    if (!data) {
      el.innerHTML = '<p class="empty-msg">Dibuje paredes para calcular estructura.</p>';
      PA.canvas.render();
      return;
    }

    const wallMat = data.zone === 'alta'
      ? 'Bloque concreto 15cm (resistencia ≥ 5 MPa)'
      : 'Bloque arcilla cocida 15cm o bloque concreto 15cm';

    el.innerHTML = `
      <div class="struct-row head">
        <span>Zona sísmica</span>
        <strong>${ZONES[data.zone].label} — NSR-10</strong>
      </div>

      <div class="struct-sep">Columnas de confinamiento</div>
      <div class="struct-row">
        <span>Cantidad total</span>
        <strong>${data.numCols} columnas</strong>
      </div>
      <div class="struct-row">
        <span>Sección</span>
        <strong>${data.spec.label}</strong>
      </div>
      <div class="struct-row">
        <span>Refuerzo longitudinal</span>
        <strong>${data.spec.rebar}</strong>
      </div>
      <div class="struct-row">
        <span>Estribos</span>
        <strong>${data.spec.stirrup}</strong>
      </div>
      <div class="struct-row">
        <span>Concreto f'c</span>
        <strong>${data.spec.fc} MPa (${data.spec.fcPSI} PSI)</strong>
      </div>
      <div class="struct-row">
        <span>Carga por columna</span>
        <strong>${data.loadPerCol} t</strong>
      </div>

      <div class="struct-sep">Zapatas aisladas</div>
      <div class="struct-row">
        <span>Dimensión planta</span>
        <strong>${data.footSize} × ${data.footSize} m</strong>
      </div>
      <div class="struct-row">
        <span>Espesor zapata</span>
        <strong>${Math.round(data.footDepth * 100)} cm</strong>
      </div>
      <div class="struct-row">
        <span>Prof. de desplante</span>
        <strong>${data.desplante} m desde NTT</strong>
      </div>
      <div class="struct-row">
        <span>Solado de limpieza</span>
        <strong>5 cm — concreto 1:3:6</strong>
      </div>
      <div class="struct-row">
        <span>Recubrimiento mín.</span>
        <strong>7.5 cm (en tierra)</strong>
      </div>

      <div class="struct-sep">Vigas de amarre</div>
      <div class="struct-row">
        <span>Sección</span>
        <strong>${Math.round(data.beamW*100)} × ${Math.round(data.beamD*100)} cm</strong>
      </div>
      <div class="struct-row">
        <span>Refuerzo</span>
        <strong>3 var. #4 superior + 2 var. #4 inferior</strong>
      </div>
      <div class="struct-row">
        <span>Estribos viga</span>
        <strong>Est. #3 @15cm / @7.5cm en nudo</strong>
      </div>
      <div class="struct-row">
        <span>Luz promedio de vano</span>
        <strong>${data.avgSpan} m</strong>
      </div>

      <div class="struct-sep">Mampostería</div>
      <div class="struct-row">
        <span>Material</span>
        <strong>${wallMat}</strong>
      </div>
      <div class="struct-row">
        <span>Mortero de pega</span>
        <strong>1:4 cemento-arena m³ arena lavada</strong>
      </div>
      <div class="struct-row">
        <span>Repello interior</span>
        <strong>1:5 cemento-arena, e=1.5cm</strong>
      </div>
      <div class="struct-row">
        <span>Repello exterior</span>
        <strong>1:4 cemento-arena, e=2cm</strong>
      </div>
      <div class="struct-row">
        <span>Área total de muros</span>
        <strong>${data.wallArea} m²</strong>
      </div>
      <div class="struct-row">
        <span>Bloques (12.5/m²)</span>
        <strong>${data.bloques.toLocaleString('es-CO')} unidades</strong>
      </div>

      <div class="struct-sep">Concreto estructural</div>
      <div class="struct-row">
        <span>Columnas</span>
        <strong>${data.volCols} m³</strong>
      </div>
      <div class="struct-row">
        <span>Zapatas</span>
        <strong>${data.volFoot} m³</strong>
      </div>
      <div class="struct-row">
        <span>Vigas de amarre</span>
        <strong>${data.volBeams} m³</strong>
      </div>
      <div class="struct-row head">
        <span>Volumen total</span>
        <strong>${data.volTotal} m³</strong>
      </div>
      <div class="struct-row">
        <span>Cemento (7 sacos/m³)</span>
        <strong>${data.cementSacks} sacos 50 kg</strong>
      </div>
      <div class="struct-row">
        <span>Arena</span>
        <strong>${data.sandM3} m³</strong>
      </div>
      <div class="struct-row">
        <span>Gravilla</span>
        <strong>${data.gravelM3} m³</strong>
      </div>
      <div class="struct-row">
        <span>Acero (~95 kg/m³)</span>
        <strong>${data.rebarKg.toLocaleString('es-CO')} kg</strong>
      </div>

      <div class="struct-sep">Secuencia constructiva</div>
      <ol class="struct-process">
        <li>Descapote y nivelación del terreno</li>
        <li>Trazado y localización de ejes</li>
        <li>Excavación: ${data.desplante}m prof. de desplante</li>
        <li>Solado de limpieza 5cm (1:3:6)</li>
        <li>Armado y fundición de zapatas</li>
        <li>Pedestales hasta nivel ±0.00</li>
        <li>Relleno y compactación bajo piso</li>
        <li>Placa de contrapiso e=10cm (m.e. 5-5/8-8)</li>
        <li>Mampostería 1er piso con bloques 15cm</li>
        <li>Armado de columnas (zunchos en nudo)</li>
        <li>Encofrado y fundición de columnas</li>
        <li>Vigas de amarre + losa entrepiso (si aplica)</li>
        ${data.numFloors > 1 ? '<li>Repetir proceso en pisos superiores</li>' : ''}
        <li>Cubierta: estructura metálica o madera + cubrimiento</li>
        <li>Pañetes y repellos</li>
        <li>Instalaciones eléctricas e hidráulicas</li>
        <li>Pisos, enchapes y acabados finales</li>
      </ol>

      <p class="struct-note">⚠️ Cálculo referencial NSR-10. Recomendamos validar con ingeniero civil o estructural antes de iniciar obra.</p>
    `;

    PA.canvas.render();
  }

  /* ── SVG overlay de columnas ─────────────────────── */
  function renderOverlay() {
    clearOverlay();
    if (!showColumns || !_data || !_data.columns.length) return;

    const NS = 'http://www.w3.org/2000/svg';
    const g  = document.createElementNS(NS, 'g');
    g.id = 'structural-overlay';
    g.setAttribute('pointer-events', 'none');

    const SZ = _data.colM || 0.25;

    _data.columns.forEach(col => {
      const rect = document.createElementNS(NS, 'rect');
      rect.setAttribute('x', col.x - SZ / 2);
      rect.setAttribute('y', col.y - SZ / 2);
      rect.setAttribute('width',  SZ);
      rect.setAttribute('height', SZ);
      rect.setAttribute('stroke-width', 0.022);
      rect.setAttribute('class', 'col-marker');
      g.appendChild(rect);

      const d1 = document.createElementNS(NS, 'line');
      d1.setAttribute('x1', col.x - SZ/2); d1.setAttribute('y1', col.y - SZ/2);
      d1.setAttribute('x2', col.x + SZ/2); d1.setAttribute('y2', col.y + SZ/2);
      d1.setAttribute('stroke-width', 0.018);
      d1.setAttribute('class', 'col-cross');
      g.appendChild(d1);

      const d2 = document.createElementNS(NS, 'line');
      d2.setAttribute('x1', col.x + SZ/2); d2.setAttribute('y1', col.y - SZ/2);
      d2.setAttribute('x2', col.x - SZ/2); d2.setAttribute('y2', col.y + SZ/2);
      d2.setAttribute('stroke-width', 0.018);
      d2.setAttribute('class', 'col-cross');
      g.appendChild(d2);

      const txt = document.createElementNS(NS, 'text');
      txt.setAttribute('x',           col.x);
      txt.setAttribute('y',           col.y - SZ / 2 - 0.06);
      txt.setAttribute('text-anchor', 'middle');
      txt.setAttribute('font-size',   '0.16');
      txt.setAttribute('font-family', 'system-ui,sans-serif');
      txt.setAttribute('font-weight', '700');
      txt.setAttribute('class', 'col-label');
      txt.textContent = col.label;
      g.appendChild(txt);

      // Carga como tooltip (texto pequeño debajo)
      const load = document.createElementNS(NS, 'text');
      load.setAttribute('x',           col.x);
      load.setAttribute('y',           col.y + SZ / 2 + 0.16);
      load.setAttribute('text-anchor', 'middle');
      load.setAttribute('font-size',   '0.13');
      load.setAttribute('font-family', 'system-ui,sans-serif');
      load.setAttribute('class', 'col-label');
      load.setAttribute('opacity', '0.7');
      load.textContent = col.load + 't';
      g.appendChild(load);
    });

    document.getElementById('floors-group').appendChild(g);
  }

  function clearOverlay() {
    const old = document.getElementById('structural-overlay');
    if (old) old.remove();
  }

  function getData() { return _data; }

  /* ── Init ────────────────────────────────────────── */
  function init() {
    PA.on('dirty',        update);
    PA.on('floorChanged', update);

    document.getElementById('structural-toggle').addEventListener('change', e => {
      showColumns = e.target.checked;
      PA.canvas.render();
    });
    document.getElementById('btn-structural-recalc').addEventListener('click', update);

    const zoneEl = document.getElementById('seismic-zone');
    if (zoneEl) zoneEl.addEventListener('change', e => { _zone = e.target.value; update(); });

    const soilEl = document.getElementById('soil-capacity');
    if (soilEl) soilEl.addEventListener('change', e => { _soil = parseFloat(e.target.value) || 10; update(); });
  }

  return { init, update, renderOverlay, clearOverlay, getData };
})();

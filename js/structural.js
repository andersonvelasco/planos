'use strict';

PA.structural = (() => {

  let showColumns = true;
  let _data = null;

  function init() {
    PA.on('dirty',        update);
    PA.on('floorChanged', update);

    document.getElementById('structural-toggle').addEventListener('change', e => {
      showColumns = e.target.checked;
      PA.canvas.render();
    });
    document.getElementById('btn-structural-recalc').addEventListener('click', update);
  }

  /* ── Detectar posiciones de columnas ──────────────── */
  function detectColumns() {
    const floor = PA.activeFloor();
    const MERGE = 0.12;    // metros: fusiona puntos cercanos
    const MAX_SPAN = 3.5;  // metros: columna intermedia si tramo > 3.5m

    // 1. Recolectar todos los extremos de paredes
    const raw = [];
    floor.walls.forEach(w => {
      raw.push({ x: w.x1, y: w.y1 });
      raw.push({ x: w.x2, y: w.y2 });
    });

    // 2. Fusionar puntos cercanos en centroides
    const clusters = [];
    raw.forEach(pt => {
      const found = clusters.find(c => Math.hypot(c.x - pt.x, c.y - pt.y) < MERGE);
      if (found) { found.x = (found.x + pt.x) / 2; found.y = (found.y + pt.y) / 2; found.n++; }
      else clusters.push({ x: pt.x, y: pt.y, n: 1 });
    });

    // 3. Agregar columnas intermedias en tramos largos
    floor.walls.forEach(w => {
      const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
      const len = Math.hypot(dx, dy);
      if (len <= MAX_SPAN) return;
      const n = Math.floor(len / MAX_SPAN);
      for (let i = 1; i < n; i++) {
        const t = i / n;
        const pt = { x: w.x1 + dx * t, y: w.y1 + dy * t, n: 1 };
        // Solo agregar si no hay otra columna cercana
        if (!clusters.some(c => Math.hypot(c.x - pt.x, c.y - pt.y) < MERGE)) {
          clusters.push(pt);
        }
      }
    });

    // 4. Ordenar por (y, x) para etiquetado consistente
    clusters.sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x);

    return clusters.map((c, i) => ({ x: c.x, y: c.y, label: 'C' + (i + 1) }));
  }

  /* ── Calcular diseño estructural ─────────────────── */
  function calcStructure() {
    const floor = PA.activeFloor();
    if (!floor || floor.walls.length === 0) return null;

    const columns  = detectColumns();
    const numCols  = columns.length || 1;
    const numFloors= PA.state.floors.length;

    // Área de piso: suma de habitaciones; si no hay, usar caja de paredes
    let floorArea = floor.rooms.reduce((s, r) => s + (r.area || 0), 0);
    if (floorArea < 1) {
      let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
      floor.walls.forEach(w => {
        minX=Math.min(minX,w.x1,w.x2); maxX=Math.max(maxX,w.x1,w.x2);
        minY=Math.min(minY,w.y1,w.y2); maxY=Math.max(maxY,w.y1,w.y2);
      });
      floorArea = (maxX - minX) * (maxY - minY);
    }

    // Carga por columna (toneladas métricas) — NSR-10 referencial
    const loadPerCol = (floorArea / numCols) * numFloors * 1.20;

    // Zapata: F = carga / capacidad portante (10 t/m²), mínimo 0.80m
    const footingRaw = Math.sqrt(loadPerCol / 10);
    const footingSize = Math.max(0.80, Math.ceil(footingRaw * 10) / 10);

    // Profundidad de desplante según NSR-10 Zona de Amenaza Sísmica Alta
    const gradeDepth = 0.80;

    // Anotación de columnas
    columns.forEach(c => {
      c.load       = Math.round(loadPerCol * 10) / 10;
      c.footingSize= footingSize;
    });

    return {
      columns,
      numCols,
      floorArea: Math.round(floorArea * 10) / 10,
      numFloors,
      colSection:  0.30,           // 30×30cm
      footingSize,
      footingDepth: 0.40,          // espesor de zapata
      gradeDepth,
      beamW: 0.30, beamH: 0.40,   // viga de amarre
      loadPerCol: Math.round(loadPerCol * 10) / 10,
      totalLoad:  Math.round(loadPerCol * numCols * 10) / 10
    };
  }

  /* ── Actualizar panel ────────────────────────────── */
  function update() {
    const el = document.getElementById('structural-summary');
    const data = calcStructure();
    _data = data;

    if (!data) {
      el.innerHTML = '<p class="empty-msg">Dibuje paredes para calcular estructura.</p>';
      return;
    }

    el.innerHTML = `
      <div class="struct-row head">
        <span>Columnas detectadas</span>
        <strong>${data.numCols}</strong>
      </div>
      <div class="struct-row">
        <span>Sección columna</span>
        <strong>30 × 30 cm</strong>
      </div>
      <div class="struct-row">
        <span>Carga por columna</span>
        <strong>${data.loadPerCol} t</strong>
      </div>
      <div class="struct-sep">Zapata aislada</div>
      <div class="struct-row">
        <span>Dimensión planta</span>
        <strong>${data.footingSize} × ${data.footingSize} m</strong>
      </div>
      <div class="struct-row">
        <span>Espesor</span>
        <strong>${data.footingDepth * 100} cm</strong>
      </div>
      <div class="struct-row">
        <span>Prof. de desplante</span>
        <strong>${data.gradeDepth} m</strong>
      </div>
      <div class="struct-sep">Viga de amarre</div>
      <div class="struct-row">
        <span>Sección</span>
        <strong>${data.beamW*100} × ${data.beamH*100} cm</strong>
      </div>
      <div class="struct-row">
        <span>Área construida</span>
        <strong>${data.floorArea} m² × ${data.numFloors} piso(s)</strong>
      </div>
      <p class="struct-note">Cálculo referencial NSR-10. Validar con ingeniero estructural.</p>
    `;

    // Re-renderizar overlay
    PA.canvas.render();
  }

  /* ── Overlay SVG de columnas ─────────────────────── */
  function renderOverlay() {
    clearOverlay();
    if (!showColumns || !_data || !_data.columns.length) return;

    const NS = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(NS, 'g');
    g.id = 'structural-overlay';
    g.setAttribute('pointer-events', 'none');

    const SZ = 0.22; // 22cm cuadrado (sección real 30cm, representado más pequeño)

    _data.columns.forEach(col => {
      // Cuadrado (símbolo arquitectónico de columna)
      const rect = document.createElementNS(NS, 'rect');
      rect.setAttribute('x', col.x - SZ / 2);
      rect.setAttribute('y', col.y - SZ / 2);
      rect.setAttribute('width',  SZ);
      rect.setAttribute('height', SZ);
      rect.setAttribute('stroke-width', 0.020);   // metros → 1.2px a zoom=1
      rect.setAttribute('class', 'col-marker');
      g.appendChild(rect);

      // Diagonales interiores — stroke-width en metros, OBLIGATORIO dentro de scale(60)
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

      // Etiqueta — font-size en metros, OBLIGATORIO dentro de scale(60)
      const txt = document.createElementNS(NS, 'text');
      txt.setAttribute('x', col.x);
      txt.setAttribute('y', col.y - SZ / 2 - 0.06);
      txt.setAttribute('text-anchor', 'middle');
      txt.setAttribute('font-size',   '0.16');
      txt.setAttribute('font-family', 'system-ui,sans-serif');
      txt.setAttribute('font-weight', '700');
      txt.setAttribute('class', 'col-label');
      txt.textContent = col.label;
      g.appendChild(txt);
    });

    document.getElementById('floors-group').appendChild(g);
  }

  function clearOverlay() {
    const old = document.getElementById('structural-overlay');
    if (old) old.remove();
  }

  function getData() { return _data; }

  return { init, update, renderOverlay, clearOverlay, getData };
})();

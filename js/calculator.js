'use strict';

PA.calculator = (() => {

  function init() {
    PA.on('dirty', update);
  }

  /* ── Calcular cantidades ────────────────────────── */
  function calc() {
    const floor = PA.activeFloor();
    if (!floor) return empty();

    /* Paredes */
    let totalWallLength = 0;
    let totalWallArea   = 0;

    floor.walls.forEach(w => {
      const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
      const h   = w.height || 2.5;
      totalWallLength += len;
      totalWallArea   += len * h;
    });

    // Descontar aperturas (puertas y ventanas)
    // Regla NSR-10: solo descontar vanos > 2m² de mampostería; siempre de mano de obra
    let openingAreaMamp = 0;   // descuento material
    let openingAreaMO   = 0;   // descuento mano de obra
    let dintelLength    = 0;   // longitud total de dinteles

    floor.doors.forEach(d => {
      const wall = floor.walls.find(w => w.id === d.wallId);
      const h = wall ? (wall.height || 2.5) : 2.5;
      const area = d.width * h;
      openingAreaMO += area;
      if (area >= 2.0) openingAreaMamp += area; // solo descuenta material si vano ≥ 2m²
      dintelLength += d.width + 0.40; // ancho + 20cm apoyo cada lado
    });
    floor.windows.forEach(v => {
      const area = v.width * 1.20; // altura estándar 1.20m
      openingAreaMO += area;
      if (area >= 2.0) openingAreaMamp += area;
      dintelLength += v.width + 0.40;
    });

    const netWallArea = Math.max(0, totalWallArea - openingAreaMamp);

    /* Área de piso */
    const floorArea = floor.rooms.reduce((s, r) => s + (r.area || 0), 0);

    /* Mampostería */
    const bloques      = netWallArea * 12.5;
    const cementoMamp  = netWallArea * 0.5;   // sacos
    const arenaMamp    = netWallArea * 0.04;  // m³

    /* Columnas y vigas (concreto) */
    const numColumnas  = Math.ceil(totalWallLength / 4);
    const volColumnas  = numColumnas * 0.2 * 0.2 * 2.5;
    const volVigas     = totalWallLength * 0.15 * 0.2;
    // Dinteles: sección 0.12×0.15m sobre cada vano de puerta/ventana
    const volDinteles  = dintelLength * 0.12 * 0.15;
    const volConcreto  = volColumnas + volVigas + volDinteles;

    const cementoConc  = volConcreto * 7;     // sacos/m³
    const arenaConc    = volConcreto * 0.56;  // m³
    const gravillaConc = volConcreto * 0.84;  // m³
    const varilla3     = numColumnas * 4 * 3; // 4 varillas #3 por columna, 3m aprox
    const varilla4     = Math.ceil(totalWallLength / 6) * 2; // vigas

    /* Losa */
    const volLosa      = floorArea * 0.12;
    const cementoLosa  = volLosa * 7;
    const arenaLosa    = volLosa * 0.56;
    const gravillaLosa = volLosa * 0.84;
    const malla        = floorArea * 1.1;
    const varilla4Losa = floorArea * 5 / 6; // varillas #4 por m²

    const numDinteles = floor.doors.length + floor.windows.length;

    return {
      totalWallLength: round(totalWallLength),
      netWallArea:     round(netWallArea),
      floorArea:       round(floorArea),
      numColumnas,
      numDinteles,
      dintelLength:    round(dintelLength),
      bloques:         Math.ceil(bloques),
      cemento:         Math.ceil(cementoMamp + cementoConc + cementoLosa),
      arena:           round(arenaMamp + arenaConc + arenaLosa),
      gravilla:        round(gravillaConc + gravillaLosa),
      varilla3:        Math.ceil(varilla3),
      varilla4:        Math.ceil(varilla4 + varilla4Losa),
      malla:           round(malla),
      _mamp: { bloques: Math.ceil(bloques), cemento: Math.ceil(cementoMamp), arena: round(arenaMamp) },
      _conc: { volumen: round(volConcreto), cemento: Math.ceil(cementoConc), arena: round(arenaConc), gravilla: round(gravillaConc), varilla3: Math.ceil(varilla3), varilla4: Math.ceil(varilla4) },
      _losa: { volumen: round(volLosa), cemento: Math.ceil(cementoLosa), arena: round(arenaLosa), gravilla: round(gravillaLosa), malla: round(malla), varilla4: Math.ceil(varilla4Losa) }
    };
  }

  function round(n) { return Math.round(n * 100) / 100; }
  function empty() {
    return { totalWallLength:0, netWallArea:0, floorArea:0, numColumnas:0, bloques:0, cemento:0, arena:0, gravilla:0, varilla3:0, varilla4:0, malla:0 };
  }

  /* ── Actualizar panel ───────────────────────────── */
  function update() {
    // Auto-recalculate room areas from flood fill before computing quantities
    if (PA.geometry) PA.geometry.updateRoomAreas(PA.activeFloor());
    const m = calc();
    const list = document.getElementById('materials-list');

    if (m.totalWallLength === 0) {
      list.innerHTML = '<p class="empty-msg">Dibuje paredes para calcular materiales.</p>';
      PA.costs.update(m);
      return;
    }

    const rows = [
      { name: 'Bloque 15×20×40', qty: m.bloques,  unit: 'un' },
      { name: 'Cemento (sacos 50kg)', qty: m.cemento, unit: 'sacos' },
      { name: 'Arena de pega', qty: m.arena,   unit: 'm³' },
      { name: 'Gravilla', qty: m.gravilla, unit: 'm³' },
      { name: 'Varilla #3 (3/8")', qty: m.varilla3, unit: 'barras' },
      { name: 'Varilla #4 (1/2")', qty: m.varilla4, unit: 'barras' },
      { name: 'Malla electrosoldada', qty: m.malla, unit: 'm²' },
      ...(m.numDinteles > 0 ? [{ name: `Dinteles (${m.numDinteles} vanos)`, qty: m.dintelLength, unit: 'ml' }] : []),
    ];

    list.innerHTML = `
      <div style="font-size:11px;color:#64748b;margin-bottom:6px;padding:4px 0;border-bottom:1px solid #e2e8f0">
        Paredes: ${m.totalWallLength}m · Área: ${m.netWallArea}m² · Losa: ${m.floorArea}m²
      </div>
      ${rows.map(r => `
        <div class="material-row">
          <span class="material-name">${r.name}</span>
          <span><strong class="material-qty">${r.qty.toLocaleString('es-CO')}</strong> <span class="material-unit">${r.unit}</span></span>
        </div>
      `).join('')}
    `;

    PA.costs.update(m);
  }

  return { init, calc, update };
})();

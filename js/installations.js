'use strict';

PA.installations = (() => {

  /* ── RETIE: requisitos mínimos por tipo de espacio ── */
  const RETIE = {
    sala:      { outlets: 4, lights: 1, label: 'Sala' },
    comedor:   { outlets: 2, lights: 1, label: 'Comedor' },
    cocina:    { outlets: 4, lights: 2, gfci: true, label: 'Cocina' },
    cuarto:    { outlets: 4, lights: 1, label: 'Cuarto' },
    alcoba:    { outlets: 4, lights: 1, label: 'Alcoba' },
    dormitorio:{ outlets: 4, lights: 1, label: 'Dormitorio' },
    habitacion:{ outlets: 4, lights: 1, label: 'Habitación' },
    bano:      { outlets: 1, lights: 1, gfci: true, label: 'Baño' },
    bathroom:  { outlets: 1, lights: 1, gfci: true, label: 'Baño' },
    lavand:    { outlets: 1, lights: 1, gfci: true, label: 'Lavandería' },
    garaje:    { outlets: 2, lights: 1, label: 'Garaje' },
    garage:    { outlets: 2, lights: 1, label: 'Garaje' },
    estudio:   { outlets: 4, lights: 2, label: 'Estudio' },
  };

  /* ── NTC 1500: puntos de instalación por aparato ── */
  const FIXTURES = {
    inodoro:   { cold: '1/2"', sewage: '4"',  vent: '2"',  label: 'Inodoro'   },
    lavamanos: { cold: '1/2"', hot: '1/2"', sewage: '2"',  label: 'Lavamanos' },
    ducha:     { cold: '1/2"', hot: '1/2"', sewage: '2"',  label: 'Ducha'     },
    banera:    { cold: '1/2"', hot: '1/2"', sewage: '2"',  label: 'Bañera'    },
    meson:     { cold: '1/2"', hot: '1/2"', sewage: '3"',  label: 'Fregadero' },
    nevera:    { cold: '1/2"',                              label: 'Nevera (disp.)' },
    estufa:    { gas: '1/2"',                               label: 'Estufa gas' },
  };

  /* ── Precios referencia COP ──────────────────────── */
  const PIPE_PRICES = { cold: 8500, hot: 9200, sewage: 22000, drain: 18000, vent: 7000, gas: 16000 };
  const ELEC_PRICES = {
    toma: 12000, tomaGFCI: 28000, toma20A: 22000,
    inter1: 15000, inter2: 22000,
    lampara: 35000, fluores: 48000, ventil: 90000, extractor: 70000,
    tablero: 290000, punto_tv: 18000, punto_red: 24000,
  };

  function init() {
    PA.on('dirty',        _update);
    PA.on('floorChanged', _update);
  }

  function _update() {
    _updateElec();
    _updateHydro();
  }

  /* ── Panel eléctrico ─────────────────────────────── */
  function _updateElec() {
    const el = document.getElementById('inst-elec-summary');
    if (!el) return;
    const floor = PA.activeFloor();
    if (!floor) return;

    const elec  = floor.electrical || [];
    const rooms = floor.rooms || [];
    const furn  = floor.furniture || [];

    // Conteo por tipo
    const counts = {};
    elec.forEach(e => { counts[e.type] = (counts[e.type] || 0) + 1; });

    // Costo estimado
    let cost = 0;
    for (const [t, n] of Object.entries(counts)) cost += n * (ELEC_PRICES[t] || 0);

    // Análisis RETIE
    const alerts = _retieAlerts(rooms, elec, furn);

    const LABELS = {
      toma: 'Tomacorriente 15A', tomaGFCI: 'GFCI 20A', toma20A: 'Toma Esp. 20A',
      inter1: 'Interruptor 1', inter2: 'Interruptor 2',
      lampara: 'Luminaria', fluores: 'Fluorescente', ventil: 'Ventilador',
      extractor: 'Extractor', tablero: 'Tablero dist.', punto_tv: 'Punto TV', punto_red: 'Punto Red'
    };

    let html = '';
    if (Object.keys(counts).length) {
      html += '<div class="struct-sep">Símbolos colocados</div>';
      for (const [t, n] of Object.entries(counts))
        html += `<div class="struct-row"><span>${LABELS[t] || t}</span><strong>${n} und</strong></div>`;
      html += `<div class="struct-row head"><span>Costo estimado mano de obra + mat.</span><strong>${PA.formatCOP(cost)}</strong></div>`;
    }
    if (alerts.length) {
      html += '<div class="struct-sep">Análisis RETIE</div>';
      alerts.forEach(a => { html += `<div class="inst-alert inst-alert--${a.sev}">${a.icon} ${a.msg}</div>`; });
    }
    if (!html) html = '<p class="empty-msg">Agrega símbolos eléctricos al plano (tecla L)</p>';
    el.innerHTML = html;
  }

  function _retieAlerts(rooms, elec, furn) {
    const alerts = [];
    if (!elec.length) return alerts;

    const outlets  = elec.filter(e => ['toma', 'tomaGFCI', 'toma20A'].includes(e.type)).length;
    const lights   = elec.filter(e => ['lampara', 'fluores'].includes(e.type)).length;
    const hasGFCI  = elec.some(e => e.type === 'tomaGFCI');
    const hasBoard = elec.some(e => e.type === 'tablero');
    const hasNev   = (furn || []).some(f => f.type === 'nevera');
    const hasEst   = (furn || []).some(f => f.type === 'estufa');

    if (!hasBoard)
      alerts.push({ sev: 'warn', icon: '⚠️', msg: 'Falta tablero de distribución en este piso' });

    // Analizar por habitación
    rooms.forEach(room => {
      // Normalizar nombre (quitar tildes) para matching
      const name = (room.name || '').toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '');
      let req = null;
      for (const [key, r] of Object.entries(RETIE)) {
        if (name.includes(key)) { req = r; break; }
      }
      if (!req) return;
      if (outlets < req.outlets)
        alerts.push({ sev: 'warn', icon: '⚠️', msg: `${room.name}: mín. ${req.outlets} tomacorrientes (RETIE)` });
      if (lights < req.lights)
        alerts.push({ sev: 'warn', icon: '⚠️', msg: `${room.name}: mín. ${req.lights} punto(s) de iluminación` });
      if (req.gfci && !hasGFCI)
        alerts.push({ sev: 'error', icon: '🔴', msg: `${room.name}: GFCI obligatorio en zonas húmedas (RETIE)` });
    });

    if (hasNev && !elec.some(e => e.type === 'toma20A'))
      alerts.push({ sev: 'info', icon: '💡', msg: 'Nevera: recomendado circuito dedicado 20A' });
    if (hasEst)
      alerts.push({ sev: 'warn', icon: '⚠️', msg: 'Estufa eléctrica: circuito dedicado 20A obligatorio (RETIE)' });

    if (!alerts.length)
      alerts.push({ sev: 'ok', icon: '✅', msg: 'Revisión básica RETIE: sin alertas detectadas' });

    return alerts;
  }

  /* ── Panel hidráulico / sanitario ────────────────── */
  function _updateHydro() {
    const el = document.getElementById('inst-hydro-summary');
    if (!el) return;
    const floor = PA.activeFloor();
    if (!floor) return;

    const pipes = floor.pipes || [];
    const furn  = floor.furniture || [];

    // Sumar metros por tipo + diámetro
    const totals = {};
    pipes.forEach(p => {
      const len = Math.hypot(p.x2 - p.x1, p.y2 - p.y1);
      const key = `${p.kind}|${p.diam}`;
      if (!totals[key]) totals[key] = { kind: p.kind, diam: p.diam, len: 0 };
      totals[key].len += len;
    });

    // Costo de tuberías dibujadas
    let costPipes = 0;
    pipes.forEach(p => { costPipes += Math.hypot(p.x2 - p.x1, p.y2 - p.y1) * (PIPE_PRICES[p.kind] || 0); });
    // Aprox. instalación de aparatos (~$200k/aparato sanitario)
    const wetFixtures = furn.filter(f => FIXTURES[f.type]).length;
    costPipes += wetFixtures * 200000;

    const KIND_LABELS = {
      cold: 'Agua fría', hot: 'Agua cal.', sewage: 'Ag. negras',
      drain: 'Desagüe', vent: 'Ventilación', gas: 'Gas'
    };

    // Necesidades por aparatos dibujados
    const needs = _plumbingNeeds(furn);

    let html = '';
    if (needs.length) {
      html += '<div class="struct-sep">Puntos requeridos (NTC 1500)</div>';
      needs.forEach(n => { html += `<div class="inst-alert inst-alert--info">💧 ${n}</div>`; });
    }
    if (Object.keys(totals).length) {
      html += '<div class="struct-sep">Tuberías dibujadas</div>';
      for (const item of Object.values(totals)) {
        const len = Math.round(item.len * 10) / 10;
        html += `<div class="struct-row"><span>${KIND_LABELS[item.kind] || item.kind} ${item.diam}</span><strong>${len} m</strong></div>`;
      }
      if (costPipes > 0)
        html += `<div class="struct-row head"><span>Costo estimado instalación</span><strong>${PA.formatCOP(Math.round(costPipes))}</strong></div>`;
    }
    if (!html) html = '<p class="empty-msg">Dibuja tuberías (tecla P) o agrega aparatos sanitarios al plano</p>';
    el.innerHTML = html;
  }

  function _plumbingNeeds(furn) {
    const needs = [];
    const has = t => furn.some(f => f.type === t);
    for (const [type, spec] of Object.entries(FIXTURES)) {
      if (!has(type)) continue;
      const parts = [];
      if (spec.cold)   parts.push(`AF ${spec.cold}`);
      if (spec.hot)    parts.push(`AC ${spec.hot}`);
      if (spec.sewage) parts.push(`AN ${spec.sewage}`);
      if (spec.vent)   parts.push(`VT ${spec.vent}`);
      if (spec.gas)    parts.push(`Gas ${spec.gas}`);
      if (parts.length) needs.push(`${spec.label}: ${parts.join(' · ')}`);
    }
    return needs;
  }

  return { init };
})();

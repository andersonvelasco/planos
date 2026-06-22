'use strict';

PA.canvas = (() => {

  let svg, worldGroup;

  /* ── Init ─────────────────────────────────────────── */
  function init() {
    svg = document.getElementById('main-svg');
    PA.setSVG(svg);

    worldGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    worldGroup.id = 'world';
    // Insert world group before preview layer
    const preview = document.getElementById('preview-layer');
    const floorsGroup = document.getElementById('floors-group');
    svg.insertBefore(worldGroup, floorsGroup);
    worldGroup.appendChild(floorsGroup);
    worldGroup.appendChild(preview); // preview también en coordenadas de mundo (metros)

    // Apply initial transform
    applyTransform();

    /* ── Mouse events ─── */
    svg.addEventListener('mousedown',  onMouseDown);
    svg.addEventListener('mousemove',  onMouseMove);
    svg.addEventListener('mouseup',    onMouseUp);
    svg.addEventListener('dblclick',   onDblClick);
    svg.addEventListener('wheel',      onWheel, { passive: false });
    svg.addEventListener('contextmenu', onContextMenu);

    // Pan with middle button
    let midPan = false, midStart = null;
    svg.addEventListener('mousedown', e => {
      if (e.button === 1) { midPan = true; midStart = { x: e.clientX, y: e.clientY, px: PA.state.pan.x, py: PA.state.pan.y }; e.preventDefault(); }
    });
    svg.addEventListener('mousemove', e => {
      if (!midPan) return;
      PA.state.pan.x = midStart.px + (e.clientX - midStart.x);
      PA.state.pan.y = midStart.py + (e.clientY - midStart.y);
      applyTransform();
      updateGrid();
    });
    svg.addEventListener('mouseup', e => { if (e.button === 1) midPan = false; });

    // Space+drag pan
    let spacePan = false, spaceStart = null;
    document.addEventListener('keydown', e => {
      if (e.code === 'Space' && !spacePan) {
        if (e.target.tagName !== 'INPUT') { spacePan = true; document.body.classList.add('tool-pan'); }
      }
    });
    document.addEventListener('keyup', e => {
      if (e.code === 'Space') {
        spacePan = false;
        spaceStart = null;
        document.body.className = 'tool-' + PA.state.activeTool;
      }
    });
    svg.addEventListener('mousedown', e => {
      if (spacePan) {
        spaceStart = { x: e.clientX, y: e.clientY, px: PA.state.pan.x, py: PA.state.pan.y };
      }
    });
    svg.addEventListener('mousemove', e => {
      if (spacePan && spaceStart) {
        PA.state.pan.x = spaceStart.px + (e.clientX - spaceStart.x);
        PA.state.pan.y = spaceStart.py + (e.clientY - spaceStart.y);
        applyTransform();
        updateGrid();
      }
    });
    svg.addEventListener('mouseup', () => { if (spacePan) spaceStart = null; });

    // Touch support (pan + pinch-zoom)
    let _tc = null;  // single-touch pan state
    let _tp = null;  // two-touch pinch state

    const _fakeMouse = (type, touch) =>
      svg.dispatchEvent(new MouseEvent(type, { clientX: touch.clientX, clientY: touch.clientY, button: 0, bubbles: true }));

    svg.addEventListener('touchstart', e => {
      e.preventDefault();
      if (e.touches.length === 1) {
        _tc = { x: e.touches[0].clientX, y: e.touches[0].clientY, px: PA.state.pan.x, py: PA.state.pan.y };
        _tp = null;
        _fakeMouse('mousedown', e.touches[0]);
      } else if (e.touches.length === 2) {
        _tp = {
          d: Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY),
          z: PA.state.zoom
        };
        _tc = null;
      }
    }, { passive: false });

    svg.addEventListener('touchmove', e => {
      e.preventDefault();
      if (e.touches.length === 1 && _tc) {
        if (PA.state.activeTool === 'select' || spacePan) {
          PA.state.pan.x = _tc.px + (e.touches[0].clientX - _tc.x);
          PA.state.pan.y = _tc.py + (e.touches[0].clientY - _tc.y);
          applyTransform(); updateGrid();
        } else {
          _fakeMouse('mousemove', e.touches[0]);
        }
      } else if (e.touches.length === 2 && _tp) {
        const d  = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        setZoom(_tp.z * (d / _tp.d), PA.clientToSVG(cx, cy).x, PA.clientToSVG(cx, cy).y);
      }
    }, { passive: false });

    svg.addEventListener('touchend', e => {
      e.preventDefault();
      if (e.changedTouches.length > 0) _fakeMouse('mouseup', e.changedTouches[0]);
      _tc = null; _tp = null;
    }, { passive: false });
  }

  /* ── Transform ───────────────────────────────────── */
  function applyTransform() {
    const { zoom, pan } = PA.state;
    worldGroup.setAttribute('transform',
      `translate(${pan.x},${pan.y}) scale(${zoom * PA.PPM})`
    );
  }

  function updateGrid() {
    const { zoom, pan } = PA.state;
    const g = PA.PPM * zoom;   // pixels per meter
    const g2 = g / 2;          // minor grid (0.5m)

    const minor = document.getElementById('grid-minor');
    const major = document.getElementById('grid-major');

    minor.setAttribute('width',  g2);
    minor.setAttribute('height', g2);
    minor.setAttribute('x', ((pan.x % g2) + g2) % g2);
    minor.setAttribute('y', ((pan.y % g2) + g2) % g2);
    minor.querySelector('path').setAttribute('d', `M ${g2} 0 L 0 0 0 ${g2}`);

    major.setAttribute('width',  g);
    major.setAttribute('height', g);
    major.setAttribute('x', ((pan.x % g) + g) % g);
    major.setAttribute('y', ((pan.y % g) + g) % g);
    major.querySelector('path').setAttribute('d', `M ${g} 0 L 0 0 0 ${g}`);

    updateScaleBar();
  }

  function updateScaleBar() {
    // Draw a scale bar showing 5m
    let bar = document.getElementById('scale-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'scale-bar';
      bar.innerHTML = '<div id="scale-bar-line"></div><div id="scale-bar-label"></div>';
      document.getElementById('canvas-area').appendChild(bar);
    }
    const metersToShow = 5;
    const px = metersToShow * PA.PPM * PA.state.zoom;
    document.getElementById('scale-bar-line').style.width = px + 'px';
    document.getElementById('scale-bar-label').textContent = metersToShow + ' m';
  }

  /* ── Zoom ────────────────────────────────────────── */
  function setZoom(newZoom, centerX, centerY) {
    const MIN = 0.15, MAX = 8;
    newZoom = Math.max(MIN, Math.min(MAX, newZoom));

    if (centerX !== undefined) {
      // Zoom toward a point
      const ratio = newZoom / PA.state.zoom;
      PA.state.pan.x = centerX - ratio * (centerX - PA.state.pan.x);
      PA.state.pan.y = centerY - ratio * (centerY - PA.state.pan.y);
    }

    PA.state.zoom = newZoom;
    applyTransform();
    updateGrid();
    PA.emit('zoomChanged', newZoom);
  }

  function fitView() {
    const floor = PA.activeFloor();
    if (!floor || floor.walls.length === 0) {
      PA.state.zoom = 1;
      PA.state.pan = { x: 120, y: 80 };
      applyTransform(); updateGrid();
      PA.emit('zoomChanged', PA.state.zoom);
      return;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    floor.walls.forEach(w => {
      minX = Math.min(minX, w.x1, w.x2);
      minY = Math.min(minY, w.y1, w.y2);
      maxX = Math.max(maxX, w.x1, w.x2);
      maxY = Math.max(maxY, w.y1, w.y2);
    });
    const rect = svg.getBoundingClientRect();
    const PAD = 80;
    const zx = (rect.width  - PAD * 2) / ((maxX - minX) * PA.PPM);
    const zy = (rect.height - PAD * 2) / ((maxY - minY) * PA.PPM);
    const z  = Math.min(zx, zy, 4);
    PA.state.zoom = z;
    PA.state.pan.x = PAD - minX * PA.PPM * z;
    PA.state.pan.y = PAD - minY * PA.PPM * z;
    applyTransform();
    updateGrid();
    PA.emit('zoomChanged', z);
  }

  /* ── Mouse event dispatcher ──────────────────────── */
  function getActiveTool() {
    return PA.tools[PA.state.activeTool];
  }

  function onMouseDown(e) {
    if (e.button !== 0) return;
    const tool = getActiveTool();
    if (tool && tool.onMouseDown) tool.onMouseDown(e);
  }
  function onMouseMove(e) {
    // Update cursor coords
    const w = PA.clientToWorld(e.clientX, e.clientY);
    document.getElementById('cursor-pos').textContent =
      w.x.toFixed(2) + 'm, ' + w.y.toFixed(2) + 'm';

    const tool = getActiveTool();
    if (tool && tool.onMouseMove) tool.onMouseMove(e);
  }
  function onMouseUp(e) {
    if (e.button !== 0) return;
    const tool = getActiveTool();
    if (tool && tool.onMouseUp) tool.onMouseUp(e);
  }
  function onDblClick(e) {
    const tool = getActiveTool();
    if (tool && tool.onDblClick) tool.onDblClick(e);
  }
  function onContextMenu(e) {
    e.preventDefault();
    const tool = getActiveTool();
    if (tool && tool.onContextMenu) {
      tool.onContextMenu(e);
    } else {
      // Default: show element context menu if something is selected
      if (PA.state.selection) {
        PA.contextMenu(e.clientX, e.clientY, [
          { label: 'Eliminar', danger: true, action: () => deleteSelected() }
        ]);
      }
    }
  }
  function onWheel(e) {
    e.preventDefault();
    const svgPos = PA.clientToSVG(e.clientX, e.clientY);
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    setZoom(PA.state.zoom * factor, svgPos.x, svgPos.y);
  }

  /* ── Render ──────────────────────────────────────── */
  function render() {
    applyTransform();
    updateGrid();
    PA.floors.render();
    PA.calculator.update();
    PA.costs.update();
  }

  /* ── Selection ───────────────────────────────────── */
  function selectElement(type, id, floorIdx) {
    clearSelection();
    const fi = floorIdx !== undefined ? floorIdx : PA.state.activeFloor;
    PA.state.selection = { type, id, floorIdx: fi };
    const el = document.getElementById(id);
    if (el) el.classList.add('selected');
    _showProps(type, id, fi);
  }

  function clearSelection() {
    if (PA.state.selection) {
      const el = document.getElementById(PA.state.selection.id);
      if (el) el.classList.remove('selected');
    }
    PA.state.selection = null;
    _hideProps();
  }

  /* ── RETILAP: relación ventana/área de habitación ── */
  function _retilapHTML(room, floor) {
    if (!room || !(room.area > 0)) return '';
    const WIN_H = 1.10;
    let winArea = 0;
    const roomSpan = Math.sqrt(room.area) * 1.4;
    (floor.windows || []).forEach(w => {
      const wall = (floor.walls || []).find(wl => wl.id === w.wallId);
      if (!wall) return;
      const midWx = (wall.x1 + wall.x2) / 2;
      const midWy = (wall.y1 + wall.y2) / 2;
      if (Math.hypot(midWx - room.x, midWy - room.y) < roomSpan) {
        winArea += (w.width || 0.9) * WIN_H;
      }
    });
    const ratio = winArea / room.area;
    const pct   = (ratio * 100).toFixed(1);
    const ok    = ratio >= 0.10;
    const barW  = Math.min(ratio * 1000, 100).toFixed(1);
    const barColor = ok ? '#22c55e' : ratio >= 0.06 ? '#f59e0b' : '#ef4444';
    const icon  = ok ? '✓' : '⚠';
    return `<div class="retilap-indicator">
      <div class="retilap-title">Iluminación RETILAP</div>
      <div class="retilap-bar-wrap"><div class="retilap-bar" style="width:${barW}%;background:${barColor}"></div></div>
      <div class="retilap-val ${ok ? 'ok' : 'warn'}">${icon} ${pct}% de ${room.area.toFixed(1)}m² · mín. 10%</div>
      <div style="font-size:10px;color:#64748b;margin-top:2px">${winArea.toFixed(2)}m² vidrio estimado</div>
    </div>`;
  }

  /* ── Properties panel ───────────────────────────── */
  function _showProps(type, id, floorIdx) {
    const sec   = document.getElementById('props-section');
    const body  = document.getElementById('props-body');
    const title = document.getElementById('props-title');
    if (!sec || !body) return;

    const floor = PA.state.floors[floorIdx];
    if (!floor) return;

    const row = (label, val) =>
      `<div class="prop-row"><span class="prop-label">${label}</span><strong class="prop-val">${val}</strong></div>`;

    let html = '', name = '';

    switch (type) {
      case 'wall': {
        const w = floor.walls.find(x => x.id === id);
        if (!w) return;
        const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
        name = 'Pared';
        html = row('Longitud', len.toFixed(2) + ' m')
             + row('Grosor',   (w.thickness * 100).toFixed(0) + ' cm')
             + row('Alto',     (w.height || 2.5) + ' m')
             + row('Material', w.material || 'Bloque');
        break;
      }
      case 'door': {
        const d = floor.doors.find(x => x.id === id);
        if (!d) return;
        name = 'Puerta';
        html = row('Ancho',   (d.width * 100).toFixed(0) + ' cm')
             + row('Bisagra', d.openLeft ? 'Izquierda' : 'Derecha')
             + row('Sentido', d.openIn   ? 'Hacia adentro' : 'Hacia afuera');
        break;
      }
      case 'window': {
        const w = floor.windows.find(x => x.id === id);
        if (!w) return;
        name = 'Ventana';
        html = row('Ancho', (w.width * 100).toFixed(0) + ' cm');
        break;
      }
      case 'room': {
        const r = floor.rooms.find(x => x.id === id);
        if (!r) return;
        const f = r.finishes || {};
        const sel = (id2, opts, val) =>
          `<select id="${id2}" style="font-size:11px;padding:2px 4px;border:1px solid #e2e8f0;border-radius:3px;max-width:90px">
            ${opts.map(o => `<option value="${o}" ${val===o?'selected':''}>${o}</option>`).join('')}
           </select>`;
        const roomColor = r.color || '#3b82f6';
        name = 'Habitación';
        html = row('Nombre', r.name)
             + row('Área',   r.area ? r.area.toFixed(2) + ' m²' : '—')
             + `<div class="prop-row"><span class="prop-label">Color</span><input type="color" id="room-color-picker" value="${roomColor}" style="width:36px;height:22px;border:none;padding:0;cursor:pointer;border-radius:3px;vertical-align:middle"></div>`
             + `<div class="prop-row"><span class="prop-label">Piso</span>${sel('finish-piso',['ceramica','porcelanato','madera','concreto','vinilo','ninguno'],f.piso||'ceramica')}</div>`
             + `<div class="prop-row"><span class="prop-label">Cielo raso</span>${sel('finish-cielorraso',['pintura','drywall','pvc','ninguno'],f.cieloRaso||'pintura')}</div>`
             + `<div class="prop-row"><span class="prop-label">Pintura</span>${sel('finish-pintura',['vinilo','esmalte','ninguno'],f.pintura||'vinilo')}</div>`
             + `<button class="btn-add" id="props-edit-room" style="margin-top:4px">✎ Editar nombre/área</button>`
             + _retilapHTML(r, floor);
        break;
      }
      case 'furniture': {
        const furn = (floor.furniture || []).find(x => x.id === id);
        if (!furn) return;
        name = furn.label || 'Mueble';
        html = row('Tipo', furn.label || furn.type)
             + row('Dimensiones', furn.w.toFixed(2) + ' × ' + furn.h.toFixed(2) + ' m')
             + row('Rotación', Math.round((furn.rotation || 0) * 180 / Math.PI) + '°')
             + `<button class="btn-add" id="props-rotate-furn" style="margin-top:4px">↻ Rotar 90°</button>`;
        break;
      }
      case 'electrical': {
        const sym = (floor.electrical || []).find(x => x.id === id);
        if (!sym) return;
        const cat = PA.tools.electrical ? PA.tools.electrical.getByType(sym.type) : null;
        name = cat ? cat.label : 'Símbolo eléctrico';
        const rotDeg = Math.round((sym.rotation || 0) * 180 / Math.PI);
        html = row('Tipo', name)
             + row('Rotación', rotDeg + '°')
             + row('Posición', sym.x.toFixed(2) + 'm, ' + sym.y.toFixed(2) + 'm')
             + `<button class="btn-add" id="props-rotate-elec" style="margin-top:4px">↻ Rotar 90°</button>`;
        break;
      }
      case 'pipe': {
        const pipe = (floor.pipes || []).find(x => x.id === id);
        if (!pipe) return;
        const plen  = Math.hypot(pipe.x2 - pipe.x1, pipe.y2 - pipe.y1);
        const kinds = PA.tools.pipes ? PA.tools.pipes.getKinds() : {};
        const kl    = kinds[pipe.kind] ? kinds[pipe.kind].label : pipe.kind;
        name = kl + ' ' + pipe.diam;
        html = row('Tipo', kl)
             + row('Diámetro', pipe.diam)
             + row('Longitud', plen.toFixed(2) + ' m');
        break;
      }
      case 'dimension': {
        const d = floor.dimensions.find(x => x.id === id);
        if (!d) return;
        const len = Math.hypot(d.x2 - d.x1, d.y2 - d.y1);
        name = 'Cota';
        html = row('Longitud', len.toFixed(2) + ' m');
        break;
      }
      case 'stair': {
        const s = floor.stairs ? floor.stairs.find(x => x.id === id) : null;
        if (!s) return;
        const w = Math.abs(s.x2 - s.x1), h = Math.abs(s.y2 - s.y1);
        const shapeLabels = { straight:'Recta', 'l-right':'En L (derecha)', 'l-left':'En L (izquierda)', u:'En U' };
        name = 'Escalera';
        html = row('Forma',    shapeLabels[s.shape] || 'Recta')
             + row('Peldaños', s.steps)
             + row('Ancho',    w.toFixed(2) + ' m')
             + row('Largo',    h.toFixed(2) + ' m');
        if (s.shape === 'u') html += row('Corredor', Math.round((s.uRunW || 0.30) * 100) + '% ancho');
        break;
      }
      case 'lightwell': {
        const lw = (floor.lightwells || []).find(x => x.id === id);
        if (!lw) return;
        name = 'Patio de Luz';
        html = row('Ancho', lw.w.toFixed(2) + ' m')
             + row('Largo', lw.h.toFixed(2) + ' m')
             + row('Área',  (lw.w * lw.h).toFixed(2) + ' m²')
             + row('Tipo',  lw.label || 'Patio de Luz');
        break;
      }
      case 'skylight': {
        const sl = (floor.skylights || []).find(x => x.id === id);
        if (!sl) return;
        name = 'Tragaluz';
        html = row('Ancho', sl.w.toFixed(2) + ' m')
             + row('Largo', sl.h.toFixed(2) + ' m')
             + row('Área',  (sl.w * sl.h).toFixed(2) + ' m²');
        break;
      }
    }

    title.textContent = name;
    body.innerHTML = html
      + `<button class="prop-delete-btn" id="props-delete-btn">✕ Eliminar ${name.toLowerCase()}</button>`;
    sec.style.display = '';

    // Wire up dynamic buttons
    const editBtn = document.getElementById('props-edit-room');
    if (editBtn) editBtn.onclick = () => {
      const r = floor.rooms.find(x => x.id === id);
      if (r) PA.floors.editRoom(r, floorIdx);
    };
    const delBtn = document.getElementById('props-delete-btn');
    if (delBtn) delBtn.onclick = () => deleteSelected();
    const delHeader = document.getElementById('props-delete');
    if (delHeader) delHeader.onclick = () => deleteSelected();

    // Wire up room color picker
    const colorPicker = document.getElementById('room-color-picker');
    if (colorPicker) colorPicker.oninput = () => {
      const r = floor.rooms.find(x => x.id === id);
      if (r) { r.color = colorPicker.value; PA.canvas.render(); PA.setDirty(); }
    };

    // Wire up finish selects
    const _wireFinish = (selId, key) => {
      const el = document.getElementById(selId);
      if (!el) return;
      el.onchange = () => {
        const r = floor.rooms.find(x => x.id === id);
        if (!r) return;
        if (!r.finishes) r.finishes = {};
        r.finishes[key] = el.value;
        PA.setDirty();
        PA.costs.update();
      };
    };
    _wireFinish('finish-piso',      'piso');
    _wireFinish('finish-cielorraso','cieloRaso');
    _wireFinish('finish-pintura',   'pintura');

    // Wire rotate buttons (furniture + electrical)
    const rotBtn = document.getElementById('props-rotate-furn');
    if (rotBtn) rotBtn.onclick = () => rotateSelected(1);
    const rotElecBtn = document.getElementById('props-rotate-elec');
    if (rotElecBtn) rotElecBtn.onclick = () => rotateSelected(1);
  }

  /* ── Rotate selected element 90° ────────────────── */
  function rotateSelected(dir = 1) {
    const sel = PA.state.selection;
    if (!sel) return;
    const floor = PA.state.floors[sel.floorIdx];
    if (!floor) return;

    if (sel.type === 'furniture') {
      const furn = (floor.furniture || []).find(x => x.id === sel.id);
      if (!furn) return;
      PA.saveUndo();
      furn.rotation = ((furn.rotation || 0) + dir * Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
      [furn.w, furn.h] = [furn.h, furn.w];
    } else if (sel.type === 'electrical') {
      const sym = (floor.electrical || []).find(x => x.id === sel.id);
      if (!sym) return;
      PA.saveUndo();
      sym.rotation = ((sym.rotation || 0) + dir * Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
    } else {
      return;
    }
    PA.canvas.render();
    PA.setDirty();
    _showProps(sel.type, sel.id, sel.floorIdx);
  }

  function _hideProps() {
    const sec = document.getElementById('props-section');
    if (sec) sec.style.display = 'none';
  }

  function deleteSelected() {
    const sel = PA.state.selection;
    if (!sel) return;
    const floor = PA.state.floors[sel.floorIdx];
    if (!floor) return;
    PA.saveUndo();

    const remove = (arr, id) => { const i = arr.findIndex(x => x.id === id); if (i >= 0) arr.splice(i, 1); };

    if (sel.type === 'wall') {
      remove(floor.walls, sel.id);
      // Remove doors and windows on this wall
      floor.doors   = floor.doors.filter(d => d.wallId !== sel.id);
      floor.windows = floor.windows.filter(w => w.wallId !== sel.id);
    } else if (sel.type === 'door')   remove(floor.doors, sel.id);
    else if (sel.type === 'window')   remove(floor.windows, sel.id);
    else if (sel.type === 'room')      remove(floor.rooms, sel.id);
    else if (sel.type === 'dimension') remove(floor.dimensions, sel.id);
    else if (sel.type === 'stair'     && floor.stairs)     remove(floor.stairs,     sel.id);
    else if (sel.type === 'furniture' && floor.furniture)  remove(floor.furniture,  sel.id);
    else if (sel.type === 'electrical'&& floor.electrical) remove(floor.electrical, sel.id);
    else if (sel.type === 'pipe'      && floor.pipes)      remove(floor.pipes,      sel.id);
    else if (sel.type === 'lightwell' && floor.lightwells) remove(floor.lightwells, sel.id);
    else if (sel.type === 'skylight'  && floor.skylights)  remove(floor.skylights,  sel.id);

    clearSelection();
    render();
    PA.setDirty();
  }

  return {
    init, render, applyTransform, updateGrid,
    setZoom, fitView,
    selectElement, clearSelection, deleteSelected, rotateSelected
  };
})();

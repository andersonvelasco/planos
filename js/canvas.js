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
        name = 'Habitación';
        html = row('Nombre', r.name)
             + row('Área',   r.area ? r.area.toFixed(2) + ' m²' : '—')
             + `<button class="btn-add" id="props-edit-room" style="margin-top:4px">✎ Editar</button>`;
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
        name = 'Escalera';
        html = row('Peldaños', s.steps)
             + row('Ancho',    w.toFixed(2) + ' m')
             + row('Largo',    h.toFixed(2) + ' m');
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
    else if (sel.type === 'stair' && floor.stairs) remove(floor.stairs, sel.id);

    clearSelection();
    render();
    PA.setDirty();
  }

  return {
    init, render, applyTransform, updateGrid,
    setZoom, fitView,
    selectElement, clearSelection, deleteSelected
  };
})();

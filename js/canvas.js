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
    PA.state.selection = { type, id, floorIdx: floorIdx !== undefined ? floorIdx : PA.state.activeFloor };
    const el = document.getElementById(id);
    if (el) el.classList.add('selected');
  }

  function clearSelection() {
    if (PA.state.selection) {
      const el = document.getElementById(PA.state.selection.id);
      if (el) el.classList.remove('selected');
    }
    PA.state.selection = null;
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

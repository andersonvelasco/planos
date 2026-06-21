'use strict';

/* ═══════════════════════════════════════════════════════════
   PA  —  PlanoApp global namespace
   Todos los módulos escriben en PA y leen de PA.state
═══════════════════════════════════════════════════════════ */
const PA = (() => {

  /* ── Constantes ─────────────────────────────────── */
  const PPM = 60;       // Pixels Per Meter (zoom 1)
  const SNAP = 0.25;    // Snap increment in meters

  /* ── Estado global ──────────────────────────────── */
  const state = {
    projectId: null,
    projectName: 'Mi Casa',
    activeFloor: 0,
    activeTool: 'select',
    snapEnabled: true,
    zoom: 1,
    pan: { x: 120, y: 80 },
    selection: null,   // { type:'wall'|'door'|'window'|'room'|'dim', id, floorIdx }
    drawing: null,     // tool-specific drawing state
    wallThickness: 0.15,
    wallHeight: 2.5,
    doorWidth: 0.9,
    windowWidth: 0.9,
    stairsSteps: 10,
    floors: [],
    prices: {
      bloque:    2200,
      cemento:  32000,
      arena:    85000,
      gravilla: 95000,
      varilla3: 28000,
      varilla4: 48000,
      malla:    35000,
      maestro:  180000,
      oficial:  120000,
      ayudante:  80000,
      imprevistos: 0.10
    }
  };

  /* ── Event bus ──────────────────────────────────── */
  const _handlers = {};
  function on(event, fn) {
    (_handlers[event] || (_handlers[event] = [])).push(fn);
  }
  function off(event, fn) {
    if (_handlers[event]) _handlers[event] = _handlers[event].filter(h => h !== fn);
  }
  function emit(event, data) {
    (_handlers[event] || []).forEach(fn => fn(data));
  }

  /* ── ID generator ───────────────────────────────── */
  let _seq = Date.now();
  function uid(prefix = 'e') { return `${prefix}${(++_seq).toString(36)}`; }

  /* ── Piso por defecto ───────────────────────────── */
  function newFloor(name = 'Planta Baja') {
    return {
      id: uid('f'),
      name,
      visible: true,
      walls: [],
      doors: [],
      windows: [],
      rooms: [],
      dimensions: [],
      stairs: []
    };
  }

  /* ── Coordenadas ─────────────────────────────────── */
  let _svg = null;
  function setSVG(el) { _svg = el; }

  function clientToSVG(cx, cy) {
    const r = _svg.getBoundingClientRect();
    return { x: cx - r.left, y: cy - r.top };
  }
  function svgToWorld(sx, sy) {
    return {
      x: (sx - state.pan.x) / (PPM * state.zoom),
      y: (sy - state.pan.y) / (PPM * state.zoom)
    };
  }
  function worldToSVG(wx, wy) {
    return {
      x: wx * PPM * state.zoom + state.pan.x,
      y: wy * PPM * state.zoom + state.pan.y
    };
  }
  function clientToWorld(cx, cy) {
    const s = clientToSVG(cx, cy);
    return svgToWorld(s.x, s.y);
  }

  /* ── Snap ────────────────────────────────────────── */
  function snap(x, y) {
    if (!state.snapEnabled) return { x, y };
    return {
      x: Math.round(x / SNAP) * SNAP,
      y: Math.round(y / SNAP) * SNAP
    };
  }

  function snapVertex(x, y, excludeId = null) {
    const RADIUS = 0.4;
    const floor = activeFloor();
    let best = null, bestD = RADIUS;
    for (const w of floor.walls) {
      if (w.id === excludeId) continue;
      for (const pt of [{ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }]) {
        const d = Math.hypot(pt.x - x, pt.y - y);
        if (d < bestD) { bestD = d; best = { ...pt }; }
      }
    }
    return best || snap(x, y);
  }

  function activeFloor() { return state.floors[state.activeFloor]; }

  /* ── Snap a segmento de pared (para T-junctions) ── */
  function snapToWall(x, y, excludeId = null) {
    const VERTEX_R = 0.35;
    const WALL_R   = 0.28;
    const floor = activeFloor();

    // 1. Primero intentar snap a vértice (más prioridad)
    let best = null, bestD = VERTEX_R;
    for (const w of floor.walls) {
      if (w.id === excludeId) continue;
      for (const pt of [{ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }]) {
        const d = Math.hypot(pt.x - x, pt.y - y);
        if (d < bestD) { bestD = d; best = { ...pt }; }
      }
    }
    if (best) return best;

    // 2. Luego snap al cuerpo de pared más cercano (genera T-junction)
    let wallBest = null, wallBestD = WALL_R;
    for (const w of floor.walls) {
      if (w.id === excludeId) continue;
      const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
      const lenSq = dx * dx + dy * dy;
      if (lenSq < 0.001) continue;
      const t = Math.max(0.05, Math.min(0.95, ((x - w.x1) * dx + (y - w.y1) * dy) / lenSq));
      const px = w.x1 + t * dx, py = w.y1 + t * dy;
      const d = Math.hypot(x - px, y - py);
      if (d < wallBestD) { wallBestD = d; wallBest = { x: px, y: py }; }
    }
    if (wallBest) return wallBest;

    // 3. Fallback a grid snap
    return snap(x, y);
  }

  /* ── Dirty flag ─────────────────────────────────── */
  let _dirty = false;
  function setDirty() {
    _dirty = true;
    document.title = '* ' + state.projectName + ' — PlanoApp';
    emit('dirty');
  }
  function clearDirty() {
    _dirty = false;
    document.title = state.projectName + ' — PlanoApp';
  }
  function isDirty() { return _dirty; }

  /* ── Undo / Redo ────────────────────────────────── */
  const _history = [];
  const _future  = [];
  const MAX_UNDO = 50;

  function saveUndo() {
    _history.push(JSON.parse(JSON.stringify(state.floors)));
    if (_history.length > MAX_UNDO) _history.shift();
    _future.length = 0;
    _updateUndoButtons();
  }
  function undo() {
    if (_history.length === 0) return;
    _future.push(JSON.parse(JSON.stringify(state.floors)));
    state.floors = _history.pop();
    state.activeFloor = Math.min(state.activeFloor, state.floors.length - 1);
    if (PA.canvas) { PA.canvas.render(); PA.canvas.clearSelection(); }
    emit('floorChanged');
    setDirty();
    _updateUndoButtons();
  }
  function redo() {
    if (_future.length === 0) return;
    _history.push(JSON.parse(JSON.stringify(state.floors)));
    state.floors = _future.pop();
    state.activeFloor = Math.min(state.activeFloor, state.floors.length - 1);
    if (PA.canvas) { PA.canvas.render(); PA.canvas.clearSelection(); }
    emit('floorChanged');
    setDirty();
    _updateUndoButtons();
  }
  function _updateUndoButtons() {
    const u = document.getElementById('btn-undo');
    const r = document.getElementById('btn-redo');
    if (u) u.disabled = _history.length === 0;
    if (r) r.disabled = _future.length === 0;
  }

  /* ── Modal ───────────────────────────────────────── */
  function modal(title, bodyHTML, { okLabel = 'Aceptar', cancelLabel = 'Cancelar', onOk, onCancel, hideCancel = false } = {}) {
    const overlay = document.getElementById('modal-overlay');
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHTML;
    document.getElementById('modal-ok').textContent = okLabel;
    const cancelBtn = document.getElementById('modal-cancel');
    cancelBtn.textContent = cancelLabel;
    cancelBtn.style.display = hideCancel ? 'none' : '';
    overlay.classList.remove('hidden');

    function close() { overlay.classList.add('hidden'); }

    const okBtn = document.getElementById('modal-ok');
    const newOk = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOk, okBtn);
    const newCancel = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
    document.getElementById('modal-close').onclick = close;

    newOk.onclick = () => { close(); if (onOk) onOk(); };
    newCancel.onclick = () => { close(); if (onCancel) onCancel(); };
  }

  /* ── Context menu ────────────────────────────────── */
  function contextMenu(x, y, items) {
    const menu = document.getElementById('context-menu');
    const list = document.getElementById('context-menu-list');
    list.innerHTML = '';
    items.forEach(item => {
      if (item === null) {
        const sep = document.createElement('li');
        sep.className = 'ctx-sep';
        list.appendChild(sep);
        return;
      }
      const li = document.createElement('li');
      li.textContent = item.label;
      if (item.danger) li.className = 'danger';
      li.onclick = () => { hideContextMenu(); item.action(); };
      list.appendChild(li);
    });
    menu.style.left = Math.min(x, window.innerWidth - 180) + 'px';
    menu.style.top  = Math.min(y, window.innerHeight - items.length * 30 - 20) + 'px';
    menu.classList.remove('hidden');
  }
  function hideContextMenu() {
    document.getElementById('context-menu').classList.add('hidden');
  }
  document.addEventListener('click', hideContextMenu);
  document.addEventListener('contextmenu', e => e.preventDefault());

  /* ── Formato COP ─────────────────────────────────── */
  function formatCOP(n) {
    return '$ ' + Math.round(n).toLocaleString('es-CO');
  }

  /* ── Init ────────────────────────────────────────── */
  function init() {
    // Crear piso inicial si no hay
    if (state.floors.length === 0) {
      state.floors.push(newFloor('Planta Baja'));
    }

    // Toolbar: tool buttons
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.dataset.tool;
        setTool(tool);
      });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', onKeyDown);

    // Project name
    const nameInput = document.getElementById('project-name');
    nameInput.addEventListener('change', () => {
      state.projectName = nameInput.value.trim() || 'Mi Casa';
      clearDirty();
      setDirty();
    });

    // Header buttons
    document.getElementById('btn-undo').onclick   = () => undo();
    document.getElementById('btn-redo').onclick   = () => redo();
    document.getElementById('btn-new').onclick    = () => PA.storage.newProject();
    document.getElementById('btn-open').onclick   = () => PA.storage.showOpenModal();
    document.getElementById('btn-save').onclick   = () => PA.storage.save();
    document.getElementById('btn-export').onclick     = () => PA.export.toPDF();
    document.getElementById('btn-export-csv').onclick = () => PA.export.toCSV();

    // Panel collapses
    document.querySelectorAll('.panel-section-header').forEach(h => {
      const id = 'section-' + h.dataset.collapse;
      const body = document.getElementById(id);
      h.addEventListener('click', () => {
        h.classList.toggle('open');
        body.classList.toggle('collapsed');
        h.querySelector('.collapse-btn').style.transform =
          body.classList.contains('collapsed') ? 'rotate(-90deg)' : '';
      });
      h.classList.add('open');
    });

    // Snap toggle
    document.getElementById('snap-toggle').addEventListener('change', e => {
      state.snapEnabled = e.target.checked;
    });

    // Wall props
    document.getElementById('wall-thickness').addEventListener('change', e => {
      state.wallThickness = parseFloat(e.target.value);
    });
    document.getElementById('wall-height').addEventListener('change', e => {
      state.wallHeight = parseFloat(e.target.value);
    });

    // Door props
    document.getElementById('door-width').addEventListener('change', e => {
      state.doorWidth = parseFloat(e.target.value);
    });

    // Window props
    document.getElementById('window-width').addEventListener('change', e => {
      state.windowWidth = parseFloat(e.target.value);
    });

    // Stairs props
    document.getElementById('stairs-steps').addEventListener('change', e => {
      state.stairsSteps = parseInt(e.target.value, 10);
    });

    // Material prices
    document.getElementById('btn-edit-prices').onclick = () => PA.costs.showPricesModal();

    // Add floor
    document.getElementById('btn-add-floor').onclick = () => PA.floors.addFloor();

    // Zoom controls
    document.getElementById('zoom-in').onclick  = () => PA.canvas.setZoom(state.zoom * 1.25);
    document.getElementById('zoom-out').onclick = () => PA.canvas.setZoom(state.zoom / 1.25);
    document.getElementById('zoom-level').onclick = () => PA.canvas.setZoom(1);
    document.getElementById('zoom-fit').onclick = () => PA.canvas.fitView();

    // Canvas info update
    on('floorChanged', updateCanvasInfo);
    on('zoomChanged', updateCanvasInfo);
    on('zoomChanged', () => {
      document.getElementById('zoom-level').textContent = Math.round(state.zoom * 100) + '%';
    });

    updateCanvasInfo();
    setTool('select');
  }

  function updateCanvasInfo() {
    const f = activeFloor();
    document.getElementById('canvas-info').textContent =
      `Escala 1m = ${Math.round(PPM * state.zoom)}px  ·  ${f ? f.name : ''}`;
  }

  function setTool(tool) {
    // Deactivate previous
    if (PA.tools && PA.tools[state.activeTool] && PA.tools[state.activeTool].deactivate) {
      PA.tools[state.activeTool].deactivate();
    }
    state.activeTool = tool;
    state.drawing = null;
    document.getElementById('preview-layer').innerHTML = '';

    // Update toolbar buttons
    document.querySelectorAll('.tool-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tool === tool);
    });

    // Show/hide props panels
    document.getElementById('wall-props-label').style.display = tool === 'wall' ? '' : 'none';
    document.getElementById('wall-props').classList.toggle('hidden', tool !== 'wall');
    document.getElementById('door-props').classList.toggle('hidden', tool !== 'door');
    document.getElementById('window-props').classList.toggle('hidden', tool !== 'window');
    document.getElementById('stairs-props').classList.toggle('hidden', tool !== 'stairs');

    // Update body class for cursor
    document.body.className = 'tool-' + tool;

    // Update hint
    const hints = {
      select:    'Clic para seleccionar · Arrastrar para mover · Doble clic en nombre de habitación para editar',
      wall:      'Clic para iniciar pared · Doble clic o ESC para terminar · Snap a vértices automático',
      door:      'Clic sobre una pared para colocar la puerta · F para voltear dirección',
      window:    'Clic sobre una pared para colocar la ventana',
      room:      'Clic para colocar etiqueta de habitación',
      dimension: 'Clic en punto A · Clic en punto B para crear cota',
      stairs:    'Clic punto inicial · Clic punto final para dibujar caja de escaleras',
      erase:     'Clic en cualquier elemento para eliminarlo'
    };
    document.getElementById('tool-hint').textContent = hints[tool] || '';

    // Activate new tool
    if (PA.tools && PA.tools[tool] && PA.tools[tool].activate) {
      PA.tools[tool].activate();
    }
  }

  function onKeyDown(e) {
    const key = e.key.toLowerCase();

    // ESC closes modal first
    if (key === 'escape') {
      const overlay = document.getElementById('modal-overlay');
      if (overlay && !overlay.classList.contains('hidden')) {
        overlay.classList.add('hidden');
        return;
      }
      if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') setTool('select');
      return;
    }

    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if ((e.ctrlKey || e.metaKey) && key === 'z') { e.preventDefault(); undo(); return; }
    if ((e.ctrlKey || e.metaKey) && key === 'y') { e.preventDefault(); redo(); return; }
    if ((e.ctrlKey || e.metaKey) && key === 's') { e.preventDefault(); PA.storage.save(); return; }

    if (key === 'v') setTool('select');
    else if (key === 'w') setTool('wall');
    else if (key === 'd') setTool('door');
    else if (key === 'n') setTool('window');
    else if (key === 'r') setTool('room');
    else if (key === 'm') setTool('dimension');
    else if (key === 's') setTool('stairs');
    else if (key === 'e') setTool('erase');
    else if (key === 'delete' || key === 'backspace') {
      if (state.selection) PA.canvas.deleteSelected();
    }
    else if (key === '+' || key === '=') PA.canvas.setZoom(state.zoom * 1.25);
    else if (key === '-') PA.canvas.setZoom(state.zoom / 1.25);
  }

  return {
    PPM, SNAP,
    state,
    on, off, emit,
    uid, newFloor,
    setSVG, clientToSVG, svgToWorld, worldToSVG, clientToWorld,
    snap, snapVertex, snapToWall,
    activeFloor,
    setDirty, clearDirty, isDirty,
    saveUndo, undo, redo,
    modal, contextMenu, hideContextMenu,
    formatCOP,
    setTool,
    init,
    tools: {}
  };
})();

// Boot when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  PA.canvas.init();
  PA.floors.init();
  PA.calculator.init();
  PA.costs.init();
  PA.storage.init();
  PA.structural.init();
  PA.view3d.init();
  PA.init();

  // Load last project or create demo
  if (!PA.storage.loadLast()) {
    PA.storage.createDemo();
  }

  // Autosave every 60 seconds if there are unsaved changes
  setInterval(() => {
    if (PA.isDirty()) PA.storage.save(true);
  }, 60000);
});

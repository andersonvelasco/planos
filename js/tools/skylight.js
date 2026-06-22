'use strict';

PA.tools.skylight = (() => {
  let _pt1 = null;

  function activate()   { _pt1 = null; _clearPreview(); }
  function deactivate() { _pt1 = null; _clearPreview(); }
  function _clearPreview() {
    const l = document.getElementById('preview-layer');
    if (l) l.innerHTML = '';
  }

  function onMouseDown(e) {
    if (e.button !== 0) return;
    const raw = PA.clientToWorld(e.clientX, e.clientY);
    const pt  = PA.snap(raw.x, raw.y);
    if (!_pt1) {
      _pt1 = pt;
    } else {
      const x = Math.min(_pt1.x, pt.x), y = Math.min(_pt1.y, pt.y);
      const w = Math.abs(pt.x - _pt1.x), h = Math.abs(pt.y - _pt1.y);
      if (w < 0.2 || h < 0.2) { _pt1 = null; _clearPreview(); return; }
      PA.saveUndo();
      const floor = PA.activeFloor();
      if (!floor.skylights) floor.skylights = [];
      floor.skylights.push({ id: PA.uid('sl'), x, y, w, h, label: 'Tragaluz' });
      _pt1 = null;
      _clearPreview();
      PA.canvas.render();
      PA.setDirty();
    }
  }

  function onMouseMove(e) {
    if (!_pt1) return;
    _clearPreview();
    const raw = PA.clientToWorld(e.clientX, e.clientY);
    const pt  = PA.snap(raw.x, raw.y);
    const layer = document.getElementById('preview-layer');
    const NS = 'http://www.w3.org/2000/svg';
    const x = Math.min(_pt1.x, pt.x), y = Math.min(_pt1.y, pt.y);
    const w = Math.abs(pt.x - _pt1.x), h = Math.abs(pt.y - _pt1.y);
    if (w < 0.01 || h < 0.01) return;
    const r = document.createElementNS(NS, 'rect');
    r.setAttribute('x', x); r.setAttribute('y', y);
    r.setAttribute('width', w); r.setAttribute('height', h);
    r.setAttribute('fill', 'rgba(254,240,138,0.35)');
    r.setAttribute('stroke', '#f59e0b');
    r.setAttribute('stroke-width', 0.025);
    r.setAttribute('stroke-dasharray', '0.10 0.05');
    layer.appendChild(r);
    const dot = document.createElementNS(NS, 'circle');
    dot.setAttribute('cx', _pt1.x); dot.setAttribute('cy', _pt1.y);
    dot.setAttribute('r', 0.07); dot.setAttribute('fill', '#f59e0b');
    layer.appendChild(dot);
  }

  return { activate, deactivate, onMouseDown, onMouseMove };
})();

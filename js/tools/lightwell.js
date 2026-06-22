'use strict';

PA.tools.lightwell = (() => {
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
      if (w < 0.3 || h < 0.3) { _pt1 = null; _clearPreview(); return; }
      PA.saveUndo();
      const floor = PA.activeFloor();
      if (!floor.lightwells) floor.lightwells = [];
      floor.lightwells.push({ id: PA.uid('lw'), x, y, w, h, label: 'Patio de Luz' });
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
    r.setAttribute('fill', 'rgba(147,197,253,0.25)');
    r.setAttribute('stroke', '#3b82f6');
    r.setAttribute('stroke-width', 0.025);
    r.setAttribute('stroke-dasharray', '0.10 0.05');
    layer.appendChild(r);
    const dot = document.createElementNS(NS, 'circle');
    dot.setAttribute('cx', _pt1.x); dot.setAttribute('cy', _pt1.y);
    dot.setAttribute('r', 0.07); dot.setAttribute('fill', '#3b82f6');
    layer.appendChild(dot);
  }

  return { activate, deactivate, onMouseDown, onMouseMove };
})();

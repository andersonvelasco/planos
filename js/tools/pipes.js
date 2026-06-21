'use strict';

PA.tools.pipes = (() => {
  let _kind    = 'cold';
  let _diam    = '1/2"';
  let _pt1     = null;
  let _preview = null;

  /* ── Tipos de tubería ─────────────────────────── */
  const KINDS = {
    cold:   { label: 'Agua fría',            color: '#2563eb', dash: false, lw: 0.045 },
    hot:    { label: 'Agua caliente',         color: '#dc2626', dash: false, lw: 0.045 },
    sewage: { label: 'Aguas negras',          color: '#92400e', dash: true,  lw: 0.055 },
    drain:  { label: 'Desagüe / drenaje',    color: '#4d7c0f', dash: true,  lw: 0.045 },
    vent:   { label: 'Ventilación sanitaria', color: '#6b7280', dash: true,  lw: 0.035 },
    gas:    { label: 'Gas',                   color: '#d97706', dash: true,  lw: 0.045 },
  };

  const DIAMS = {
    cold:   ['1/2"', '3/4"', '1"', '1 1/2"'],
    hot:    ['1/2"', '3/4"', '1"'],
    sewage: ['2"', '3"', '4"', '6"'],
    drain:  ['2"', '3"', '4"'],
    vent:   ['2"', '3"', '4"'],
    gas:    ['1/2"', '3/4"', '1"'],
  };

  function getKinds() { return KINDS; }
  function getDiams()  { return DIAMS;  }

  /* ── Tool lifecycle ──────────────────────────────── */
  function activate() {
    _pt1 = null;
    _clearPreview();
    _syncSelects();
  }

  function deactivate() {
    _pt1 = null;
    _clearPreview();
  }

  function _syncSelects() {
    const sk = document.getElementById('pipe-kind');
    const sd = document.getElementById('pipe-diam');
    if (!sk || !sd) return;
    sk.value = _kind;
    _refreshDiams(sd);
    sk.onchange = () => { _kind = sk.value; _refreshDiams(sd); };
    sd.onchange = () => { _diam = sd.value; };
  }

  function _refreshDiams(sd) {
    const opts = DIAMS[_kind] || ['1/2"'];
    sd.innerHTML = opts.map(d => `<option value="${d}">${d}</option>`).join('');
    _diam = opts[0];
    sd.value = _diam;
  }

  /* ── Mouse handlers ──────────────────────────────── */
  function onMouseDown(e) {
    if (e.button !== 0) return;
    const raw = PA.clientToWorld(e.clientX, e.clientY);
    const pt  = PA.snap(raw.x, raw.y);

    if (!_pt1) {
      _pt1 = pt;
      return;
    }

    const len = Math.hypot(pt.x - _pt1.x, pt.y - _pt1.y);
    if (len > 0.05) {
      PA.saveUndo();
      const floor = PA.activeFloor();
      if (!floor.pipes) floor.pipes = [];
      floor.pipes.push({
        id:   PA.uid('pipe'),
        kind: _kind,
        diam: _diam,
        x1:   _pt1.x, y1: _pt1.y,
        x2:   pt.x,   y2: pt.y
      });
      PA.canvas.render();
      PA.setDirty();
    }
    _pt1 = pt; // chain: siguiente segmento parte de aquí
    _clearPreview();
  }

  function onMouseMove(e) {
    if (!_pt1) { _clearPreview(); return; }
    const raw = PA.clientToWorld(e.clientX, e.clientY);
    _drawPreview(PA.snap(raw.x, raw.y));
  }

  function onDblClick() {
    _pt1 = null;
    _clearPreview();
  }

  function _drawPreview(pt) {
    _clearPreview();
    if (!_pt1) return;
    const k  = KINDS[_kind];
    const NS = 'http://www.w3.org/2000/svg';
    const ln = document.createElementNS(NS, 'line');
    ln.setAttribute('x1', _pt1.x); ln.setAttribute('y1', _pt1.y);
    ln.setAttribute('x2', pt.x);   ln.setAttribute('y2', pt.y);
    ln.setAttribute('stroke', k.color);
    ln.setAttribute('stroke-width', k.lw);
    ln.setAttribute('stroke-dasharray', k.dash ? '0.18,0.09' : 'none');
    ln.setAttribute('stroke-linecap', 'round');
    ln.style.opacity = '0.6';
    document.getElementById('preview-layer').appendChild(ln);
    _preview = ln;
  }

  function _clearPreview() {
    if (_preview && _preview.parentNode) _preview.remove();
    _preview = null;
  }

  return { activate, deactivate, onMouseDown, onMouseMove, onDblClick, getKinds, getDiams };
})();

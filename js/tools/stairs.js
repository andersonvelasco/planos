'use strict';

PA.tools.stairs = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  let pt1 = null;

  function activate()   { pt1 = null; clearPreview(); }
  function deactivate() { pt1 = null; clearPreview(); }
  function clearPreview() { document.getElementById('preview-layer').innerHTML = ''; }

  function svgEl(tag, attrs) {
    const el = document.createElementNS(NS, tag);
    Object.entries(attrs || {}).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  }

  function onMouseDown(e) {
    if (e.button !== 0) return;
    const raw = PA.clientToWorld(e.clientX, e.clientY);
    const pt  = PA.snap(raw.x, raw.y);

    if (!pt1) {
      pt1 = pt;
    } else {
      const w = Math.abs(pt.x - pt1.x);
      const h = Math.abs(pt.y - pt1.y);
      if (w < 0.3 || h < 0.3) { clearPreview(); return; }

      const steps   = PA.state.stairsSteps || 10;
      const horiz   = w >= h;  // step lines perpendicular to longest dimension
      const dir     = (pt.y >= pt1.y) ? 'down' : 'up';

      PA.saveUndo();
      PA.activeFloor().stairs.push({
        id:    PA.uid('st'),
        x1:    Math.min(pt1.x, pt.x),
        y1:    Math.min(pt1.y, pt.y),
        x2:    Math.max(pt1.x, pt.x),
        y2:    Math.max(pt1.y, pt.y),
        steps,
        horiz,
        direction: dir,
        label: ''
      });

      pt1 = null;
      clearPreview();
      PA.canvas.render();
      PA.setDirty();
    }
  }

  function onMouseMove(e) {
    if (!pt1) return;
    clearPreview();
    const raw = PA.clientToWorld(e.clientX, e.clientY);
    const pt  = PA.snap(raw.x, raw.y);
    drawPreview(pt1, pt);
  }

  function drawPreview(a, b) {
    const layer = document.getElementById('preview-layer');
    const x1 = Math.min(a.x, b.x), y1 = Math.min(a.y, b.y);
    const x2 = Math.max(a.x, b.x), y2 = Math.max(a.y, b.y);
    const w = x2 - x1, h = y2 - y1;
    if (w < 0.01 || h < 0.01) return;

    const steps  = PA.state.stairsSteps || 10;
    const horiz  = w >= h;

    layer.appendChild(svgEl('rect', {
      x: x1, y: y1, width: w, height: h,
      fill: 'rgba(99,102,241,0.08)',
      stroke: '#6366f1', 'stroke-width': 0.02,
      'stroke-dasharray': '0.1 0.05'
    }));

    // Step lines
    if (horiz) {
      const interval = w / steps;
      for (let i = 1; i < steps; i++) {
        const lx = x1 + i * interval;
        layer.appendChild(svgEl('line', {
          x1: lx, y1, x2: lx, y2,
          stroke: '#6366f1', 'stroke-width': 0.012, opacity: 0.6
        }));
      }
    } else {
      const interval = h / steps;
      for (let i = 1; i < steps; i++) {
        const ly = y1 + i * interval;
        layer.appendChild(svgEl('line', {
          x1, y1: ly, x2, y2: ly,
          stroke: '#6366f1', 'stroke-width': 0.012, opacity: 0.6
        }));
      }
    }

    // Measurement label
    const txt = document.createElementNS(NS, 'text');
    txt.setAttribute('x', (x1 + x2) / 2);
    txt.setAttribute('y', y1 - 0.1);
    txt.setAttribute('text-anchor', 'middle');
    txt.setAttribute('fill', '#6366f1');
    txt.setAttribute('font-size', '0.22');
    txt.setAttribute('font-family', 'system-ui,sans-serif');
    txt.textContent = `${steps} peld. · ${w.toFixed(2)}×${h.toFixed(2)}m`;
    layer.appendChild(txt);

    // First point indicator
    layer.appendChild(svgEl('circle', {
      cx: a.x, cy: a.y, r: 0.07,
      fill: '#6366f1', stroke: '#fff', 'stroke-width': 0.025
    }));
  }

  return { activate, deactivate, onMouseDown, onMouseMove };
})();

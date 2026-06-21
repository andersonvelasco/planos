'use strict';

PA.tools.dimension = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  let pt1 = null;

  function activate() { pt1 = null; clearPreview(); }
  function deactivate() { pt1 = null; clearPreview(); }
  function clearPreview() { document.getElementById('preview-layer').innerHTML = ''; }

  function svgEl(tag, attrs) {
    const el = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  }

  function onMouseDown(e) {
    if (e.button !== 0) return;
    const raw = PA.clientToWorld(e.clientX, e.clientY);
    const pt  = PA.snapVertex(raw.x, raw.y);

    if (!pt1) {
      pt1 = pt;
      drawPoint(pt);
    } else {
      // Create dimension
      const dx = pt.x - pt1.x, dy = pt.y - pt1.y;
      const len = Math.hypot(dx, dy);
      if (len < 0.1) { pt1 = null; clearPreview(); return; }

      PA.saveUndo();
      PA.activeFloor().dimensions.push({
        id: PA.uid('dim'),
        x1: pt1.x, y1: pt1.y,
        x2: pt.x,  y2: pt.y,
        offset: 0.5
      });
      pt1 = null;
      PA.canvas.render();
      PA.setDirty();
      clearPreview();
    }
  }

  function onMouseMove(e) {
    if (!pt1) return;
    clearPreview();
    const raw = PA.clientToWorld(e.clientX, e.clientY);
    const pt  = PA.snapVertex(raw.x, raw.y);
    drawDimPreview(pt1, pt);
  }

  function drawPoint(pt) {
    document.getElementById('preview-layer').appendChild(
      svgEl('circle', { cx: pt.x, cy: pt.y, r: 0.07, fill: '#dc2626', stroke: '#fff', 'stroke-width': 0.025 })
    );
  }

  function drawDimPreview(a, b) {
    const layer = document.getElementById('preview-layer');
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.01) return;

    const nx = -dy / len, ny = dx / len;
    const OFF = 0.5;
    const ax = a.x + nx * OFF, ay = a.y + ny * OFF;
    const bx = b.x + nx * OFF, by = b.y + ny * OFF;

    layer.appendChild(svgEl('line', { x1: ax, y1: ay, x2: bx, y2: by, stroke: '#dc2626', 'stroke-width': 0.025, 'stroke-dasharray': '0.12,0.06' }));
    layer.appendChild(svgEl('line', { x1: a.x, y1: a.y, x2: ax, y2: ay, stroke: '#dc2626', 'stroke-width': 0.02 }));
    layer.appendChild(svgEl('line', { x1: b.x, y1: b.y, x2: bx, y2: by, stroke: '#dc2626', 'stroke-width': 0.02 }));

    const mx = (ax + bx) / 2, my = (ay + by) / 2;
    const txt = document.createElementNS(NS, 'text');
    txt.setAttribute('x', mx); txt.setAttribute('y', my - 0.06);
    txt.setAttribute('text-anchor', 'middle');
    txt.setAttribute('fill', '#dc2626');
    txt.setAttribute('font-size', '0.22px');
    txt.setAttribute('font-family', 'system-ui,sans-serif');
    txt.setAttribute('font-weight', '700');
    txt.textContent = len.toFixed(2) + 'm';
    layer.appendChild(txt);

    layer.appendChild(svgEl('circle', { cx: a.x, cy: a.y, r: 0.06, fill: '#dc2626', stroke: '#fff', 'stroke-width': 0.02 }));
    layer.appendChild(svgEl('circle', { cx: b.x, cy: b.y, r: 0.05, fill: '#fca5a5', stroke: '#fff', 'stroke-width': 0.02 }));
  }

  return { activate, deactivate, onMouseDown, onMouseMove };
})();

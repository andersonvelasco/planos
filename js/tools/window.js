'use strict';

PA.tools.window = (() => {
  const NS = 'http://www.w3.org/2000/svg';

  function activate() { clearPreview(); }
  function deactivate() { clearPreview(); }
  function clearPreview() { document.getElementById('preview-layer').innerHTML = ''; }

  function findWallAtPoint(wx, wy) {
    const THRESHOLD = 0.3;
    const floor = PA.activeFloor();
    for (const wall of floor.walls) {
      const dx = wall.x2 - wall.x1, dy = wall.y2 - wall.y1;
      const len = Math.hypot(dx, dy);
      if (len < 0.01) continue;
      const t = ((wx - wall.x1) * dx + (wy - wall.y1) * dy) / (len * len);
      if (t < 0 || t > 1) continue;
      const px = wall.x1 + t * dx, py = wall.y1 + t * dy;
      if (Math.hypot(wx - px, wy - py) < THRESHOLD) return { wall, t };
    }
    return null;
  }

  function onMouseMove(e) {
    clearPreview();
    const raw = PA.clientToWorld(e.clientX, e.clientY);
    const hit = findWallAtPoint(raw.x, raw.y);
    if (!hit) return;
    drawWindowPreview(hit.wall, hit.t);
  }

  function onMouseDown(e) {
    if (e.button !== 0) return;
    const raw = PA.clientToWorld(e.clientX, e.clientY);
    const hit = findWallAtPoint(raw.x, raw.y);
    if (!hit) return;

    PA.saveUndo();
    PA.activeFloor().windows.push({
      id: PA.uid('v'),
      wallId: hit.wall.id,
      t: hit.t,
      width: PA.state.windowWidth
    });
    PA.canvas.render();
    PA.setDirty();
    clearPreview();
  }

  function drawWindowPreview(wall, t) {
    const layer = document.getElementById('preview-layer');
    const dx = wall.x2 - wall.x1, dy = wall.y2 - wall.y1;
    const len = Math.hypot(dx, dy);
    const ux = dx / len, uy = dy / len;
    const nx = -uy, ny = ux;
    const hw = PA.state.windowWidth / 2;
    const tHalf = wall.thickness / 2 * 0.5;

    const cx = wall.x1 + dx * t, cy = wall.y1 + dy * t;

    const svgEl = (tag, attrs) => {
      const el = document.createElementNS(NS, tag);
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      return el;
    };

    layer.appendChild(svgEl('line', {
      x1: cx - ux * hw + nx * tHalf, y1: cy - uy * hw + ny * tHalf,
      x2: cx + ux * hw + nx * tHalf, y2: cy + uy * hw + ny * tHalf,
      stroke: '#1e40af', 'stroke-width': 0.03, opacity: 0.7
    }));
    layer.appendChild(svgEl('line', {
      x1: cx - ux * hw - nx * tHalf, y1: cy - uy * hw - ny * tHalf,
      x2: cx + ux * hw - nx * tHalf, y2: cy + uy * hw - ny * tHalf,
      stroke: '#1e40af', 'stroke-width': 0.03, opacity: 0.7
    }));
    layer.appendChild(svgEl('circle', { cx, cy, r: 0.05, fill: '#3b82f6', stroke: '#fff', 'stroke-width': 0.02 }));
  }

  return { activate, deactivate, onMouseDown, onMouseMove };
})();

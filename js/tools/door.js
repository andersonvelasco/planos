'use strict';

PA.tools.door = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  let _openLeft = true;  // current flip state for preview
  let _lastHit  = null;  // last wall hit for F-key re-draw

  function activate()   { _openLeft = true; _lastHit = null; clearPreview(); }
  function deactivate() { _lastHit = null; clearPreview(); }
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
    _lastHit = hit;
    if (!hit) return;
    drawDoorPreview(hit.wall, hit.t, _openLeft);
  }

  function onMouseDown(e) {
    if (e.button !== 0) return;
    const raw = PA.clientToWorld(e.clientX, e.clientY);
    const hit = findWallAtPoint(raw.x, raw.y);
    if (!hit) return;
    PA.saveUndo();
    PA.activeFloor().doors.push({
      id: PA.uid('d'),
      wallId: hit.wall.id,
      t: hit.t,
      width: PA.state.doorWidth,
      openLeft: _openLeft,
      openIn: true
    });
    PA.canvas.render();
    PA.setDirty();
    clearPreview();
    _lastHit = null;
  }

  // F key: flip the hinge side preview
  document.addEventListener('keydown', e => {
    if (PA.state.activeTool !== 'door') return;
    if (e.key.toLowerCase() === 'f') {
      _openLeft = !_openLeft;
      clearPreview();
      if (_lastHit) drawDoorPreview(_lastHit.wall, _lastHit.t, _openLeft);
    }
  });

  function drawDoorPreview(wall, t, openLeft = true) {
    const layer = document.getElementById('preview-layer');
    const dx = wall.x2 - wall.x1, dy = wall.y2 - wall.y1;
    const len = Math.hypot(dx, dy);
    const ux = dx / len, uy = dy / len;
    const nx = -uy, ny = ux;
    const tw = PA.state.doorWidth;

    const cx = wall.x1 + dx * t, cy = wall.y1 + dy * t;
    const hw = tw / 2;
    const j1x = cx - ux*hw, j1y = cy - uy*hw;
    const j2x = cx + ux*hw, j2y = cy + uy*hw;
    const [hx, hy] = openLeft ? [j1x, j1y] : [j2x, j2y];
    const [sx, sy] = openLeft ? [j2x, j2y] : [j1x, j1y];
    const ex = hx + nx * tw, ey = hy + ny * tw;
    const sweep = openLeft ? 1 : 0;

    const svgEl = (tag, attrs) => {
      const el = document.createElementNS(NS, tag);
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      return el;
    };

    layer.appendChild(svgEl('line', { x1: hx, y1: hy, x2: ex, y2: ey, stroke: '#92400e', 'stroke-width': 0.03, opacity: 0.7 }));
    layer.appendChild(svgEl('path', {
      d: `M ${sx.toFixed(3)} ${sy.toFixed(3)} A ${tw.toFixed(3)} ${tw.toFixed(3)} 0 0 ${sweep} ${ex.toFixed(3)} ${ey.toFixed(3)}`,
      stroke: '#92400e', 'stroke-width': 0.02, fill: 'rgba(146,64,14,0.1)', 'stroke-dasharray': '0.06,0.04', opacity: 0.7
    }));
    layer.appendChild(svgEl('circle', { cx, cy, r: 0.05, fill: '#f59e0b', stroke: '#fff', 'stroke-width': 0.02 }));

    // Flip indicator
    const tipX = cx + nx * 0.35, tipY = cy + ny * 0.35;
    const txt = document.createElementNS(NS, 'text');
    txt.setAttribute('x', tipX); txt.setAttribute('y', tipY);
    txt.setAttribute('text-anchor', 'middle');
    txt.setAttribute('font-size', '0.18'); txt.setAttribute('font-family', 'system-ui,sans-serif');
    txt.setAttribute('fill', '#92400e'); txt.setAttribute('opacity', '0.8');
    txt.textContent = 'F: voltear';
    layer.appendChild(txt);
  }

  return { activate, deactivate, onMouseDown, onMouseMove };
})();

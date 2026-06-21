'use strict';

PA.tools.wall = (() => {
  let drawing = false;
  let points  = [];    // world coords [{ x, y }, ...]
  let preview = null;

  const NS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs) {
    const el = document.createElementNS(NS, tag);
    Object.entries(attrs || {}).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  }

  function activate() {
    drawing = false;
    points  = [];
    clearPreview();
  }

  function deactivate() {
    drawing = false;
    points  = [];
    clearPreview();
  }

  function clearPreview() {
    document.getElementById('preview-layer').innerHTML = '';
  }

  /* ── Mouse events ──────────────────────────────── */
  function snapAngle(from, to) {
    const dx = to.x - from.x, dy = to.y - from.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.01) return to;
    const angle   = Math.atan2(dy, dx);
    const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
    return { x: from.x + len * Math.cos(snapped), y: from.y + len * Math.sin(snapped) };
  }

  function onMouseDown(e) {
    if (e.button !== 0) return;
    const raw  = PA.clientToWorld(e.clientX, e.clientY);
    let pt = points.length > 0
      ? PA.snapToWall(raw.x, raw.y)
      : PA.snap(raw.x, raw.y);

    if (e.shiftKey && drawing && points.length > 0) {
      pt = snapAngle(points[points.length - 1], pt);
    }

    if (!drawing) {
      drawing = true;
      points  = [pt];
    } else {
      const last = points[points.length - 1];
      if (Math.hypot(pt.x - last.x, pt.y - last.y) < 0.05) return;
      addWallSegment(last, pt);
      points.push(pt);
    }
    drawPreview(pt);
  }

  function onMouseMove(e) {
    if (!drawing) return;
    const raw = PA.clientToWorld(e.clientX, e.clientY);
    let pt = PA.snapToWall(raw.x, raw.y);
    if (e.shiftKey && points.length > 0) {
      pt = snapAngle(points[points.length - 1], pt);
    }
    drawPreview(pt);
  }

  function onDblClick(e) {
    if (drawing) finish();
  }

  /* ── Drawing ──────────────────────────────────── */
  function drawPreview(cursor) {
    clearPreview();
    const layer = document.getElementById('preview-layer');
    const last  = points[points.length - 1];
    if (!last) return;

    const t = PA.state.wallThickness;
    const dx = cursor.x - last.x;
    const dy = cursor.y - last.y;
    const len = Math.hypot(dx, dy);

    if (len > 0.01) {
      const nx = -dy / len * t / 2;
      const ny =  dx / len * t / 2;
      const pts = [
        [last.x   + nx, last.y   + ny],
        [cursor.x + nx, cursor.y + ny],
        [cursor.x - nx, cursor.y - ny],
        [last.x   - nx, last.y   - ny]
      ].map(p => p[0].toFixed(4) + ',' + p[1].toFixed(4)).join(' ');

      layer.appendChild(svgEl('polygon', {
        points: pts,
        fill: 'rgba(59,130,246,0.2)',
        stroke: '#3b82f6',
        'stroke-width': 0.02
      }));

      // Length label
      const mx = (last.x + cursor.x) / 2;
      const my = (last.y + cursor.y) / 2;
      const txt = document.createElementNS(NS, 'text');
      txt.setAttribute('x', mx);
      txt.setAttribute('y', my - t / 2 - 0.08);
      txt.setAttribute('text-anchor', 'middle');
      txt.setAttribute('fill', '#1d4ed8');
      txt.setAttribute('font-size', '0.25px');
      txt.setAttribute('font-family', 'system-ui,sans-serif');
      txt.setAttribute('font-weight', '700');
      txt.textContent = len.toFixed(2) + 'm';
      layer.appendChild(txt);
    }

    // Snap point indicator
    layer.appendChild(svgEl('circle', {
      cx: last.x, cy: last.y, r: 0.08,
      fill: '#3b82f6', stroke: '#fff', 'stroke-width': 0.03
    }));
    layer.appendChild(svgEl('circle', {
      cx: cursor.x, cy: cursor.y, r: 0.06,
      fill: '#93c5fd', stroke: '#fff', 'stroke-width': 0.025
    }));

    // Previous wall chain preview
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      layer.appendChild(svgEl('line', {
        x1: a.x, y1: a.y, x2: b.x, y2: b.y,
        stroke: '#1e40af', 'stroke-width': 0.02, 'stroke-dasharray': '0.1,0.05'
      }));
    }
  }

  function addWallSegment(from, to) {
    if (Math.hypot(to.x - from.x, to.y - from.y) < 0.05) return;
    PA.saveUndo();
    const wall = {
      id: PA.uid('w'),
      x1: from.x, y1: from.y,
      x2: to.x,   y2: to.y,
      thickness: PA.state.wallThickness,
      height: PA.state.wallHeight,
      material: 'bloque'
    };
    PA.activeFloor().walls.push(wall);
    PA.canvas.render();
    PA.setDirty();
  }

  function finish() {
    drawing = false;
    points  = [];
    clearPreview();
  }

  return { activate, deactivate, onMouseDown, onMouseMove, onDblClick };
})();

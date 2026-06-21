'use strict';

/* ═══════════════════════════════════════════════════════════
   PA.geometry — Detección automática de polígonos de habitaciones
   y cálculo de área por flood-fill
═══════════════════════════════════════════════════════════ */
PA.geometry = (() => {

  const CELL  = 0.08;   // 8 cm — resolución del grid de flood-fill
  const MERGE = 0.14;   // 14 cm — radio para fusionar vértices

  /* ══════════════════════════════════════════════════
     FLOOD-FILL AREA
     Calcula el área de un espacio cerrado desde un punto.
     Retorna 0 si el espacio no está cerrado.
  ══════════════════════════════════════════════════ */
  function floodFillArea(floor, wx, wy) {
    if (!floor || floor.walls.length === 0) return 0;

    // Bounding box de las paredes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    floor.walls.forEach(w => {
      minX = Math.min(minX, w.x1, w.x2); maxX = Math.max(maxX, w.x1, w.x2);
      minY = Math.min(minY, w.y1, w.y2); maxY = Math.max(maxY, w.y1, w.y2);
    });

    const pad  = CELL * 4;
    minX -= pad; minY -= pad; maxX += pad; maxY += pad;

    const cols = Math.ceil((maxX - minX) / CELL) + 1;
    const rows = Math.ceil((maxY - minY) / CELL) + 1;
    if (cols * rows > 300000) return 0; // safety: plano muy grande

    // Rasterizar paredes al grid
    const grid = new Uint8Array(cols * rows);
    floor.walls.forEach(w => _rasterWall(grid, cols, rows, w, minX, minY));

    // Punto de inicio en coordenadas de grid
    const sx = Math.round((wx - minX) / CELL);
    const sy = Math.round((wy - minY) / CELL);
    if (sx < 1 || sx >= cols - 1 || sy < 1 || sy >= rows - 1) return 0;
    if (grid[sy * cols + sx]) return 0; // el punto está dentro de una pared

    // BFS / flood fill
    const visited = new Uint8Array(cols * rows);
    const stack   = [sy * cols + sx];
    visited[sy * cols + sx] = 1;
    let count = 0, reachedEdge = false;

    while (stack.length) {
      const idx = stack.pop();
      const gx  = idx % cols;
      const gy  = (idx / cols) | 0;

      if (gx <= 0 || gx >= cols - 1 || gy <= 0 || gy >= rows - 1) {
        reachedEdge = true;
        continue;
      }

      count++;
      // Detener si el área es demasiado grande (habitación no cerrada)
      if (count > 80000) { reachedEdge = true; break; }

      for (const n of [idx - 1, idx + 1, idx - cols, idx + cols]) {
        if (!visited[n] && !grid[n]) { visited[n] = 1; stack.push(n); }
      }
    }

    if (reachedEdge) return 0;
    return Math.round(count * CELL * CELL * 100) / 100;
  }

  function _rasterWall(grid, cols, rows, w, minX, minY) {
    const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
    const len = Math.hypot(dx, dy);
    if (len < 0.01) return;

    const ux = dx / len, uy = dy / len;
    const nx = -uy, ny = ux;
    const halfT = ((w.thickness || 0.15) / 2) + CELL * 1.5; // margen extra

    const steps  = Math.ceil(len   / (CELL * 0.5)) + 1;
    const tSteps = Math.ceil(halfT / (CELL * 0.5)) + 1;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const cx = w.x1 + dx * t, cy = w.y1 + dy * t;
      for (let j = -tSteps; j <= tSteps; j++) {
        const px = cx + nx * (j * CELL * 0.5);
        const py = cy + ny * (j * CELL * 0.5);
        const gx = Math.round((px - minX) / CELL);
        const gy = Math.round((py - minY) / CELL);
        if (gx >= 0 && gx < cols && gy >= 0 && gy < rows) {
          grid[gy * cols + gx] = 1;
        }
      }
    }
  }

  /* ══════════════════════════════════════════════════
     ACTUALIZAR ÁREAS DE HABITACIONES
     Recalcula el área de cada habitación existente.
  ══════════════════════════════════════════════════ */
  function updateRoomAreas(floor) {
    if (!floor) return;
    floor.rooms.forEach(room => {
      if (room.areaLocked) return; // usuario fijó el valor manualmente
      const a = floodFillArea(floor, room.x, room.y);
      if (a > 0) room.area = a;
    });
  }

  /* ══════════════════════════════════════════════════
     AUTO-DETECCIÓN DE HABITACIONES
     Encuentra todos los polígonos cerrados del plano
     mediante recorrido de caras de grafo planar.
  ══════════════════════════════════════════════════ */
  function detectRooms(floor) {
    if (!floor || floor.walls.length < 2) return [];

    /* 1. Recolectar vértices (endpoints + intersecciones) */
    const verts = [];

    const addV = (x, y) => {
      for (let i = 0; i < verts.length; i++) {
        if (Math.hypot(verts[i].x - x, verts[i].y - y) < MERGE) return i;
      }
      verts.push({ x, y });
      return verts.length - 1;
    };

    floor.walls.forEach(w => { addV(w.x1, w.y1); addV(w.x2, w.y2); });

    // Intersecciones propias (paredes que se cruzan en su interior)
    for (let i = 0; i < floor.walls.length; i++) {
      for (let j = i + 1; j < floor.walls.length; j++) {
        const pt = _intersect(floor.walls[i], floor.walls[j]);
        if (pt) addV(pt.x, pt.y);
      }
    }

    /* 2. Construir aristas: dividir cada pared en sub-segmentos */
    const edgeSet = new Set();
    const edges   = [];

    const addEdge = (a, b) => {
      if (a === b) return;
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      if (edgeSet.has(key)) return;
      edgeSet.add(key);
      edges.push([a, b]);
    };

    floor.walls.forEach(w => {
      const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
      const lenSq = dx * dx + dy * dy;
      if (lenSq < 0.0001) return;

      // Encontrar todos los vértices que yacen sobre este segmento
      const onSeg = [];
      verts.forEach((v, idx) => {
        const t = ((v.x - w.x1) * dx + (v.y - w.y1) * dy) / lenSq;
        if (t < -0.001 || t > 1.001) return;
        const px = w.x1 + t * dx, py = w.y1 + t * dy;
        if (Math.hypot(v.x - px, v.y - py) < MERGE) {
          onSeg.push({ idx, t: Math.max(0, Math.min(1, t)) });
        }
      });

      onSeg.sort((a, b) => a.t - b.t);
      for (let k = 0; k < onSeg.length - 1; k++) addEdge(onSeg[k].idx, onSeg[k + 1].idx);
    });

    if (edges.length < 3) return [];

    /* 3. Lista de adyacencia con ángulos */
    const adj = verts.map(() => []);
    edges.forEach(([a, b]) => {
      const angAB = Math.atan2(verts[b].y - verts[a].y, verts[b].x - verts[a].x);
      const angBA = Math.atan2(verts[a].y - verts[b].y, verts[a].x - verts[b].x);
      adj[a].push({ to: b, ang: angAB });
      adj[b].push({ to: a, ang: angBA });
    });
    adj.forEach(nb => nb.sort((a, b) => a.ang - b.ang));

    /* 4. Recorrido de caras (planar face traversal) */
    const visited = new Set();
    const faces   = [];
    const bboxA   = _bboxArea(floor);

    for (let from = 0; from < verts.length; from++) {
      for (const { to: startTo } of adj[from]) {
        const startKey = `${from}_${startTo}`;
        if (visited.has(startKey)) continue;

        const faceVerts = [from];
        let prev = from, cur = startTo;
        let safe = 0;
        let ok   = true;

        while (cur !== from) {
          const eKey = `${prev}_${cur}`;
          if (visited.has(eKey) || ++safe > verts.length + 4) { ok = false; break; }
          visited.add(eKey);
          faceVerts.push(cur);

          // Siguiente arista: primera en sentido horario desde la dirección de llegada invertida
          const arrAng = Math.atan2(verts[cur].y - verts[prev].y, verts[cur].x - verts[prev].x);
          const beta   = _norm(arrAng + Math.PI);
          let bestDiff = Infinity, nextTo = -1;

          for (const { to: nb, ang: gamma } of adj[cur]) {
            let diff = _norm(beta - gamma);
            if (diff < 1e-9) diff = Math.PI * 2;
            if (diff < bestDiff) { bestDiff = diff; nextTo = nb; }
          }

          if (nextTo === -1) { ok = false; break; }
          prev = cur;
          cur  = nextTo;
        }

        visited.add(`${prev}_${cur}`);

        if (!ok || faceVerts.length < 3) continue;

        const pts  = faceVerts.map(i => verts[i]);
        const area = _shoelace(pts); // positivo = cara interior en SVG (y hacia abajo)

        if (area > 0.4 && area < bboxA * 0.98) {
          const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
          const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
          faces.push({ points: pts, area: Math.round(area * 100) / 100, cx, cy });
        }
      }
    }

    // Eliminar duplicados (misma cara detectada desde distintas aristas)
    const unique = [];
    for (const f of faces) {
      const already = unique.some(u =>
        Math.abs(u.area - f.area) < 0.05 &&
        Math.hypot(u.cx - f.cx, u.cy - f.cy) < 0.3
      );
      if (!already) unique.push(f);
    }

    return unique.sort((a, b) => a.area - b.area);
  }

  /* ── helpers ─────────────────────────────────────── */
  function _norm(a) {
    const PI2 = Math.PI * 2;
    return ((a % PI2) + PI2) % PI2;
  }

  function _shoelace(pts) {
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      s += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
    }
    return s / 2;
  }

  function _bboxArea(floor) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    floor.walls.forEach(w => {
      minX = Math.min(minX, w.x1, w.x2); maxX = Math.max(maxX, w.x1, w.x2);
      minY = Math.min(minY, w.y1, w.y2); maxY = Math.max(maxY, w.y1, w.y2);
    });
    return (maxX - minX) * (maxY - minY);
  }

  function _intersect(w1, w2) {
    const d1x = w1.x2 - w1.x1, d1y = w1.y2 - w1.y1;
    const d2x = w2.x2 - w2.x1, d2y = w2.y2 - w2.y1;
    const cross = d1x * d2y - d1y * d2x;
    if (Math.abs(cross) < 1e-6) return null;
    const t = ((w2.x1 - w1.x1) * d2y - (w2.y1 - w1.y1) * d2x) / cross;
    const u = ((w2.x1 - w1.x1) * d1y - (w2.y1 - w1.y1) * d1x) / cross;
    if (t > 0.01 && t < 0.99 && u > 0.01 && u < 0.99) {
      return { x: w1.x1 + t * d1x, y: w1.y1 + t * d1y };
    }
    return null;
  }

  return { floodFillArea, detectRooms, updateRoomAreas };
})();

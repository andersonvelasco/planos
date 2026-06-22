'use strict';

PA.floors = (() => {

  function init() {
    PA.on('floorChanged', renderFloorList);
    document.getElementById('btn-auto-detect').addEventListener('click', showAutoDetectModal);
  }

  /* ── SVG helpers ─────────────────────────────────── */
  function svgEl(tag, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  }

  /* ── Start drag on element ───────────────────────── */
  function _startDrag(type, id, floorIdx, e) {
    if (PA.state.activeTool !== 'select' || e.button !== 0) return false;
    PA.canvas.selectElement(type, id, floorIdx);
    if (PA.tools.select) PA.tools.select.startDrag(type, id, floorIdx, e);
    return true;
  }

  /* ── Render all floors ───────────────────────────── */
  function render() {
    const group = document.getElementById('floors-group');
    group.innerHTML = '';

    PA.state.floors.forEach((floor, idx) => {
      const g = svgEl('g', { id: 'floor-layer-' + idx, class: 'floor-layer' });
      if (!floor.visible) { g.classList.add('hidden'); }
      else if (idx !== PA.state.activeFloor) { g.classList.add('inactive'); }

      renderWalls(floor, g, idx);
      renderDoors(floor, g, idx);
      renderWindows(floor, g, idx);
      renderRooms(floor, g, idx);
      renderDimensions(floor, g, idx);
      renderStairs(floor, g, idx);
      renderFurniture(floor, g, idx);
      renderPipes(floor, g, idx);
      renderElectrical(floor, g, idx);
      renderLightwells(floor, g, idx);
      renderSkylights(floor, g, idx);

      group.appendChild(g);
    });

    renderFloorList();
    if (PA.structural && PA.structural.renderOverlay) PA.structural.renderOverlay();
  }

  /* ── Walls ───────────────────────────────────────── */
  function renderWalls(floor, parentGroup, floorIdx) {
    floor.walls.forEach(wall => {
      const g = svgEl('g', { id: wall.id, class: 'wall-group draggable-el', 'data-selectable': '1' });

      const dx = wall.x2 - wall.x1, dy = wall.y2 - wall.y1;
      const len = Math.hypot(dx, dy);
      if (len < 0.01) return;
      const nx = -dy / len, ny = dx / len;
      const t  = wall.thickness / 2;

      const pts = [
        [wall.x1 + nx * t, wall.y1 + ny * t],
        [wall.x2 + nx * t, wall.y2 + ny * t],
        [wall.x2 - nx * t, wall.y2 - ny * t],
        [wall.x1 - nx * t, wall.y1 - ny * t]
      ].map(p => p[0].toFixed(4) + ',' + p[1].toFixed(4)).join(' ');

      // Wall stroke attrs for edge definition
      const wallStroke = { stroke: '#111827', 'stroke-width': 0.016, 'stroke-linejoin': 'miter' };

      const openings = [...floor.doors, ...floor.windows].filter(o => o.wallId === wall.id);
      if (openings.length === 0) {
        const poly = svgEl('polygon', { points: pts, class: 'wall-fill', 'data-wall-id': wall.id, ...wallStroke });
        g.appendChild(poly);
      } else {
        const clipId = 'clip-' + wall.id;
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const clipPath = svgEl('clipPath', { id: clipId });
        clipPath.appendChild(svgEl('polygon', { points: pts }));
        defs.appendChild(clipPath);
        g.appendChild(defs);

        const wallShape = svgEl('polygon', { points: pts, class: 'wall-fill', ...wallStroke });
        g.appendChild(wallShape);

        openings.forEach(op => {
          const opW = op.width, tPos = op.t;
          const cx = wall.x1 + dx * tPos, cy = wall.y1 + dy * tPos;
          const ux = dx / len, uy = dy / len;
          const oPts = [
            [cx + ux * opW/2 + nx*(t+0.02), cy + uy * opW/2 + ny*(t+0.02)],
            [cx - ux * opW/2 + nx*(t+0.02), cy - uy * opW/2 + ny*(t+0.02)],
            [cx - ux * opW/2 - nx*(t+0.02), cy - uy * opW/2 - ny*(t+0.02)],
            [cx + ux * opW/2 - nx*(t+0.02), cy + uy * opW/2 - ny*(t+0.02)]
          ].map(p => p[0].toFixed(4) + ',' + p[1].toFixed(4)).join(' ');
          g.appendChild(svgEl('polygon', { points: oPts, class: 'opening-mask' }));
        });
      }

      // Invisible hit area (wider for easier clicking)
      const hitLine = svgEl('line', {
        x1: wall.x1, y1: wall.y1, x2: wall.x2, y2: wall.y2,
        stroke: 'transparent', 'stroke-width': Math.max(wall.thickness, 0.25)
      });
      g.appendChild(hitLine);

      g.addEventListener('mousedown', e => {
        if (_startDrag('wall', wall.id, floorIdx, e)) e.stopPropagation();
      });
      g.addEventListener('click', e => {
        if (PA.state.activeTool === 'erase') {
          e.stopPropagation();
          PA.saveUndo();
          const fl = PA.state.floors[floorIdx];
          fl.walls   = fl.walls.filter(w => w.id !== wall.id);
          fl.doors   = fl.doors.filter(d => d.wallId !== wall.id);
          fl.windows = fl.windows.filter(w => w.wallId !== wall.id);
          PA.canvas.render(); PA.setDirty();
        }
      });
      g.addEventListener('contextmenu', e => {
        e.preventDefault(); e.stopPropagation();
        PA.contextMenu(e.clientX, e.clientY, [
          { label: 'Propiedades pared', action: () => editWall(wall, floorIdx) },
          null,
          { label: 'Eliminar pared', danger: true, action: () => {
            PA.saveUndo();
            const fl = PA.state.floors[floorIdx];
            fl.walls   = fl.walls.filter(w => w.id !== wall.id);
            fl.doors   = fl.doors.filter(d => d.wallId !== wall.id);
            fl.windows = fl.windows.filter(w => w.wallId !== wall.id);
            PA.canvas.render(); PA.setDirty();
          }}
        ]);
      });

      parentGroup.appendChild(g);
    });
  }

  function editWall(wall, floorIdx) {
    PA.modal('Propiedades de Pared', `
      <div style="display:flex;flex-direction:column;gap:12px">
        <label style="display:flex;flex-direction:column;gap:4px;font-size:13px">Grosor (metros)
          <input type="number" id="ep-thickness" value="${wall.thickness}" step="0.05" min="0.05" max="0.50"
            style="padding:6px;border:1px solid #e2e8f0;border-radius:4px;font-size:13px">
        </label>
        <label style="display:flex;flex-direction:column;gap:4px;font-size:13px">Alto (metros)
          <input type="number" id="ep-height" value="${wall.height || 2.5}" step="0.1" min="1.0" max="6.0"
            style="padding:6px;border:1px solid #e2e8f0;border-radius:4px;font-size:13px">
        </label>
      </div>`, {
      onOk: () => {
        wall.thickness = parseFloat(document.getElementById('ep-thickness').value) || wall.thickness;
        wall.height    = parseFloat(document.getElementById('ep-height').value) || wall.height;
        PA.canvas.render(); PA.setDirty();
      }
    });
  }

  /* ── Doors ───────────────────────────────────────── */
  function renderDoors(floor, parentGroup, floorIdx) {
    floor.doors.forEach(door => {
      const wall = floor.walls.find(w => w.id === door.wallId);
      if (!wall) return;
      const dx = wall.x2 - wall.x1, dy = wall.y2 - wall.y1;
      const len = Math.hypot(dx, dy);
      if (len < 0.01) return;
      const ux = dx/len, uy = dy/len;
      const nx = -uy,    ny = ux;

      const cx = wall.x1 + dx * door.t, cy = wall.y1 + dy * door.t;
      const hw = door.width / 2;
      const j1x = cx - ux*hw, j1y = cy - uy*hw;
      const j2x = cx + ux*hw, j2y = cy + uy*hw;
      const [hx,hy] = door.openLeft ? [j1x,j1y] : [j2x,j2y];
      const [sx,sy] = door.openLeft ? [j2x,j2y] : [j1x,j1y];
      const dir = door.openIn ? 1 : -1;
      const ex = hx + nx*door.width*dir, ey = hy + ny*door.width*dir;
      const sweep = (door.openLeft === door.openIn) ? 1 : 0;

      const g = svgEl('g', { id: door.id, class: 'door-group draggable-el', 'data-selectable': '1' });

      // Panel (solid line — 0.035m ≈ 2px at zoom=1)
      g.appendChild(svgEl('line', {
        x1: hx, y1: hy, x2: ex, y2: ey,
        'stroke-width': 0.035, class: 'door-panel'
      }));
      // Arc (dashed — 0.020m)
      g.appendChild(svgEl('path', {
        d: `M ${sx.toFixed(4)} ${sy.toFixed(4)} A ${door.width.toFixed(4)} ${door.width.toFixed(4)} 0 0 ${sweep} ${ex.toFixed(4)} ${ey.toFixed(4)}`,
        'stroke-width': 0.020, 'stroke-dasharray': '0.07 0.04', class: 'door-arc'
      }));
      // Hit area
      g.appendChild(svgEl('line', { x1: j1x, y1: j1y, x2: j2x, y2: j2y, stroke: 'transparent', 'stroke-width': 0.28 }));

      g.addEventListener('mousedown', e => {
        if (_startDrag('door', door.id, floorIdx, e)) e.stopPropagation();
      });
      g.addEventListener('click', e => {
        if (PA.state.activeTool === 'erase') {
          e.stopPropagation();
          PA.saveUndo();
          PA.state.floors[floorIdx].doors = PA.state.floors[floorIdx].doors.filter(d => d.id !== door.id);
          PA.canvas.render(); PA.setDirty();
        }
      });
      g.addEventListener('contextmenu', e => {
        e.preventDefault(); e.stopPropagation();
        PA.contextMenu(e.clientX, e.clientY, [
          { label: 'Voltear lado (bisagra)',    action: () => { PA.saveUndo(); door.openLeft = !door.openLeft; PA.canvas.render(); PA.setDirty(); } },
          { label: 'Voltear sentido (int/ext)', action: () => { PA.saveUndo(); door.openIn = !door.openIn;     PA.canvas.render(); PA.setDirty(); } },
          { label: 'Editar ancho…',             action: () => editDoor(door, floorIdx) },
          null,
          { label: 'Eliminar puerta', danger: true, action: () => {
            PA.saveUndo();
            PA.state.floors[floorIdx].doors = PA.state.floors[floorIdx].doors.filter(d => d.id !== door.id);
            PA.canvas.render(); PA.setDirty();
          }}
        ]);
      });

      parentGroup.appendChild(g);
    });
  }

  function editDoor(door, floorIdx) {
    PA.modal('Propiedades de Puerta', `
      <div style="display:flex;flex-direction:column;gap:12px">
        <label style="display:flex;flex-direction:column;gap:4px;font-size:13px">Ancho del vano
          <select id="ep-dw" style="padding:7px;border:1px solid #e2e8f0;border-radius:5px;font-size:13px">
            ${[0.70,0.80,0.90,1.00,1.20].map(v=>`<option value="${v}"${door.width===v?' selected':''}>${(v*100).toFixed(0)} cm</option>`).join('')}
          </select>
        </label>
      </div>`, {
      onOk: () => { door.width = parseFloat(document.getElementById('ep-dw').value); PA.canvas.render(); PA.setDirty(); }
    });
  }

  /* ── Windows ─────────────────────────────────────── */
  function renderWindows(floor, parentGroup, floorIdx) {
    floor.windows.forEach(win => {
      const wall = floor.walls.find(w => w.id === win.wallId);
      if (!wall) return;
      const dx = wall.x2 - wall.x1, dy = wall.y2 - wall.y1;
      const len = Math.hypot(dx, dy);
      if (len < 0.01) return;
      const ux = dx/len, uy = dy/len;
      const nx = -uy, ny = ux;
      const t = wall.thickness / 2;

      const cx = wall.x1 + dx * win.t, cy = wall.y1 + dy * win.t;
      const hw = win.width / 2;
      const offset = t * 0.55;

      const g = svgEl('g', { id: win.id, class: 'window-group draggable-el', 'data-selectable': '1' });

      // Glass fill
      const glassPts = [
        [cx - ux*hw + nx*offset, cy - uy*hw + ny*offset],
        [cx + ux*hw + nx*offset, cy + uy*hw + ny*offset],
        [cx + ux*hw - nx*offset, cy + uy*hw - ny*offset],
        [cx - ux*hw - nx*offset, cy - uy*hw - ny*offset]
      ].map(p => p[0].toFixed(4) + ',' + p[1].toFixed(4)).join(' ');
      g.appendChild(svgEl('polygon', { points: glassPts, class: 'window-glass', 'stroke-width': 0 }));

      // Two frame lines (0.028m ≈ 1.7px at zoom=1)
      [[nx*offset,ny*offset],[-nx*offset,-ny*offset]].forEach(([ox,oy]) => {
        g.appendChild(svgEl('line', {
          x1: cx - ux*hw + ox, y1: cy - uy*hw + oy,
          x2: cx + ux*hw + ox, y2: cy + uy*hw + oy,
          'stroke-width': 0.028, class: 'window-frame'
        }));
      });

      // Hit area
      g.appendChild(svgEl('line', {
        x1: cx-ux*hw, y1: cy-uy*hw, x2: cx+ux*hw, y2: cy+uy*hw,
        stroke: 'transparent', 'stroke-width': 0.22
      }));

      g.addEventListener('mousedown', e => {
        if (_startDrag('window', win.id, floorIdx, e)) e.stopPropagation();
      });
      g.addEventListener('click', e => {
        if (PA.state.activeTool === 'erase') {
          e.stopPropagation();
          PA.saveUndo();
          PA.state.floors[floorIdx].windows = PA.state.floors[floorIdx].windows.filter(w => w.id !== win.id);
          PA.canvas.render(); PA.setDirty();
        }
      });
      g.addEventListener('contextmenu', e => {
        e.preventDefault(); e.stopPropagation();
        PA.contextMenu(e.clientX, e.clientY, [
          { label: 'Editar ancho…', action: () => editWindow(win, floorIdx) },
          null,
          { label: 'Eliminar ventana', danger: true, action: () => {
            PA.saveUndo();
            PA.state.floors[floorIdx].windows = PA.state.floors[floorIdx].windows.filter(w => w.id !== win.id);
            PA.canvas.render(); PA.setDirty();
          }}
        ]);
      });

      parentGroup.appendChild(g);
    });
  }

  function editWindow(win, floorIdx) {
    PA.modal('Propiedades de Ventana', `
      <div style="display:flex;flex-direction:column;gap:12px">
        <label style="display:flex;flex-direction:column;gap:4px;font-size:13px">Ancho del vano
          <select id="ep-ww" style="padding:7px;border:1px solid #e2e8f0;border-radius:5px;font-size:13px">
            ${[0.60,0.90,1.20,1.50,1.80].map(v=>`<option value="${v}"${win.width===v?' selected':''}>${(v*100).toFixed(0)} cm</option>`).join('')}
          </select>
        </label>
      </div>`, {
      onOk: () => { win.width = parseFloat(document.getElementById('ep-ww').value); PA.canvas.render(); PA.setDirty(); }
    });
  }

  const ROOM_PALETTE = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#f97316','#ec4899'];

  /* ── Rooms ───────────────────────────────────────── */
  function renderRooms(floor, parentGroup, floorIdx) {
    floor.rooms.forEach((room, i) => {
      const g = svgEl('g', { id: room.id, class: 'room-label-group draggable-el', 'data-selectable': '1' });
      const color = room.color || ROOM_PALETTE[i % ROOM_PALETTE.length];

      // Colored fill area sized by room area
      if (room.area > 0.5) {
        const r = Math.min(Math.sqrt(room.area / Math.PI) * 0.88, 5);
        g.appendChild(svgEl('ellipse', {
          cx: room.x, cy: room.y, rx: r, ry: r * 0.82,
          fill: color + '20', stroke: color + '40', 'stroke-width': 0.022
        }));
      }

      const nameLen = room.name.length * 0.18 + 0.3;
      const boxW = Math.max(nameLen, 1.2), boxH = 0.65;

      g.appendChild(svgEl('rect', {
        x: room.x - boxW/2, y: room.y - boxH/2,
        width: boxW, height: boxH, rx: 0.08,
        fill: color + '28', stroke: color + '66', 'stroke-width': 0.03,
        class: 'room-bg-rect'
      }));

      const nameText = svgEl('text', {
        x: room.x, y: room.y - 0.04,
        'text-anchor': 'middle', 'dominant-baseline': 'auto',
        fill: color, 'font-weight': '700',
        'font-size': '0.28px', 'font-family': 'system-ui,sans-serif'
      });
      nameText.textContent = room.name;

      const areaText = svgEl('text', {
        x: room.x, y: room.y + 0.22,
        'text-anchor': 'middle', fill: '#64748b',
        'font-size': '0.2px', 'font-family': 'system-ui,sans-serif'
      });
      areaText.textContent = room.area ? room.area.toFixed(1) + ' m²' : '';

      g.appendChild(nameText);
      g.appendChild(areaText);

      g.addEventListener('mousedown', e => {
        if (_startDrag('room', room.id, floorIdx, e)) e.stopPropagation();
      });
      g.addEventListener('click', e => {
        if (PA.state.activeTool === 'erase') {
          e.stopPropagation();
          PA.state.floors[floorIdx].rooms = PA.state.floors[floorIdx].rooms.filter(r => r.id !== room.id);
          PA.canvas.render(); PA.setDirty();
        }
      });
      g.addEventListener('dblclick', e => { e.stopPropagation(); editRoom(room, floorIdx); });
      g.addEventListener('contextmenu', e => {
        e.preventDefault(); e.stopPropagation();
        PA.contextMenu(e.clientX, e.clientY, [
          { label: 'Editar habitación', action: () => editRoom(room, floorIdx) },
          null,
          { label: 'Eliminar habitación', danger: true, action: () => {
            PA.state.floors[floorIdx].rooms = PA.state.floors[floorIdx].rooms.filter(r => r.id !== room.id);
            PA.canvas.render(); PA.setDirty();
          }}
        ]);
      });

      parentGroup.appendChild(g);
    });

    renderRoomsList(floor);
  }

  function editRoom(room, floorIdx) {
    PA.modal('Editar Habitación', `
      <div style="display:flex;flex-direction:column;gap:12px">
        <label style="display:flex;flex-direction:column;gap:4px;font-size:13px">Nombre
          <input type="text" id="er-name" value="${room.name}"
            style="padding:6px;border:1px solid #e2e8f0;border-radius:4px;font-size:13px">
        </label>
        <label style="display:flex;flex-direction:column;gap:4px;font-size:13px">Área (m²)
          <input type="number" id="er-area" value="${room.area || 0}" step="0.5" min="0"
            style="padding:6px;border:1px solid #e2e8f0;border-radius:4px;font-size:13px">
        </label>
      </div>`, {
      onOk: () => {
        room.name = document.getElementById('er-name').value.trim() || room.name;
        room.area = parseFloat(document.getElementById('er-area').value) || 0;
        PA.canvas.render(); PA.setDirty();
      }
    });
    setTimeout(() => document.getElementById('er-name').select(), 50);
  }

  function renderRoomsList(floor) {
    const list  = document.getElementById('rooms-list');
    const total = document.getElementById('rooms-total');
    if (!floor || floor.rooms.length === 0) {
      list.innerHTML = '<p class="empty-msg">Sin habitaciones. Usa la herramienta Cuarto.</p>';
      total.classList.add('hidden');
      return;
    }
    list.innerHTML = floor.rooms.map((r, i) => `
      <div class="room-item" data-rid="${r.id}">
        <div class="room-color-dot" style="background:${r.color || ROOM_PALETTE[i % ROOM_PALETTE.length]}"></div>
        <div class="room-info">
          <div class="room-name">${r.name}</div>
          <div class="room-area">${r.area ? r.area.toFixed(1) + ' m²' : '—'}</div>
        </div>
      </div>`).join('');
    const totalArea = floor.rooms.reduce((s, r) => s + (r.area || 0), 0);
    if (totalArea > 0) { total.textContent = 'Total: ' + totalArea.toFixed(1) + ' m²'; total.classList.remove('hidden'); }
    else total.classList.add('hidden');
  }

  /* ── Dimensions ──────────────────────────────────── */
  function renderDimensions(floor, parentGroup, floorIdx) {
    floor.dimensions.forEach(dim => {
      const g = svgEl('g', { id: dim.id, class: 'dim-group draggable-el', 'data-selectable': '1' });

      const dx = dim.x2 - dim.x1, dy = dim.y2 - dim.y1;
      const len = Math.hypot(dx, dy);
      if (len < 0.01) return;
      const nx = -dy/len, ny = dx/len;
      const OFF = dim.offset || 0.5;

      const ax = dim.x1 + nx*OFF, ay = dim.y1 + ny*OFF;
      const bx = dim.x2 + nx*OFF, by = dim.y2 + ny*OFF;

      // Main dimension line (0.022m)
      g.appendChild(svgEl('line', { x1:ax,y1:ay,x2:bx,y2:by, 'stroke-width':0.022, class:'dim-line' }));

      // Extension lines (0.016m)
      const EXT = 0.10;
      g.appendChild(svgEl('line', { x1:dim.x1,y1:dim.y1, x2:ax+nx*EXT,y2:ay+ny*EXT, 'stroke-width':0.016, class:'dim-tick' }));
      g.appendChild(svgEl('line', { x1:dim.x2,y1:dim.y2, x2:bx+nx*EXT,y2:by+ny*EXT, 'stroke-width':0.016, class:'dim-tick' }));

      // Serif ticks at ends (0.022m)
      const tk = 0.07;
      const sx = (dx/len)*tk*0.5, sy = (dy/len)*tk*0.5;
      const tnx = nx*tk*0.5, tny = ny*tk*0.5;
      g.appendChild(svgEl('line', { x1:ax-sx-tnx,y1:ay-sy-tny, x2:ax+sx+tnx,y2:ay+sy+tny, 'stroke-width':0.022, class:'dim-tick' }));
      g.appendChild(svgEl('line', { x1:bx-sx-tnx,y1:by-sy-tny, x2:bx+sx+tnx,y2:by+sy+tny, 'stroke-width':0.022, class:'dim-tick' }));

      // Text with background
      const mx = (ax+bx)/2, my = (ay+by)/2;
      const label = len.toFixed(2) + 'm';
      g.appendChild(svgEl('rect', { x:mx-label.length*0.068, y:my-0.16, width:label.length*0.136, height:0.22, rx:0.02, class:'dim-bg' }));
      const txt = svgEl('text', { x:mx, y:my+0.04, 'text-anchor':'middle', 'font-size':'0.2', 'font-family':'system-ui,sans-serif', 'font-weight':'700', class:'dim-text' });
      txt.textContent = label;
      g.appendChild(txt);

      g.addEventListener('mousedown', e => {
        if (_startDrag('dimension', dim.id, floorIdx, e)) e.stopPropagation();
      });
      g.addEventListener('click', e => {
        if (PA.state.activeTool === 'erase') {
          e.stopPropagation();
          PA.state.floors[floorIdx].dimensions = PA.state.floors[floorIdx].dimensions.filter(d => d.id !== dim.id);
          PA.canvas.render(); PA.setDirty();
        }
      });

      parentGroup.appendChild(g);
    });
  }

  /* ── Stairs ──────────────────────────────────────── */
  function renderStairs(floor, parentGroup, floorIdx) {
    if (!floor.stairs || floor.stairs.length === 0) return;

    floor.stairs.forEach(st => {
      const g = svgEl('g', { id: st.id, class: 'stair-group draggable-el', 'data-selectable': '1' });
      const { x1, y1, x2, y2, steps = 10, horiz = true, direction = 'up', shape = 'straight' } = st;
      const w = x2-x1, h = y2-y1;
      const cx = x1+w/2;

      const color    = '#6366f1';
      const fill     = 'rgba(99,102,241,0.09)';
      const landFill = 'rgba(99,102,241,0.22)';

      if (shape === 'l-right' || shape === 'l-left' || shape === 'u') {
        // Transparent hit area for the full bounding box (enables hover/click)
        g.appendChild(svgEl('rect', { x:x1,y:y1,width:w,height:h, fill:'transparent', stroke:'none', 'pointer-events':'fill' }));
        if (PA.tools.stairs && PA.tools.stairs._drawShape) {
          PA.tools.stairs._drawShape({ appendChild: el => g.appendChild(el) },
            x1, y1, x2, y2, w, h, steps, shape, color, fill, landFill, st.uRunW || 0.30);
        }
      } else {
        // Straight stair
        g.appendChild(svgEl('rect', { x:x1,y:y1,width:w,height:h, class:'stair-fill','stroke-width':0.030 }));
        if (horiz) {
          const interval = w / steps;
          for (let i = 1; i < steps; i++) {
            const lx = x1 + i * interval;
            g.appendChild(svgEl('line', { x1:lx,y1,x2:lx,y2, class:'stair-step','stroke-width':0.018 }));
          }
        } else {
          const interval = h / steps;
          for (let i = 1; i < steps; i++) {
            const ly = y1 + i * interval;
            g.appendChild(svgEl('line', { x1,y1:ly,x2,y2:ly, class:'stair-step','stroke-width':0.018 }));
          }
        }
        // Direction arrow
        const cy = y1+h/2;
        const arrowLen = Math.min(w,h) * 0.30;
        const aDir = direction === 'down' ? 1 : -1;
        const ay1 = cy - arrowLen*aDir, ay2 = cy + arrowLen*aDir;
        const tip = 0.12;
        g.appendChild(svgEl('line', { x1:cx,y1:ay1,x2:cx,y2:ay2, class:'stair-step','stroke-width':0.025 }));
        g.appendChild(svgEl('line', { x1:cx-tip,y1:ay2-tip*aDir,x2:cx,y2:ay2, class:'stair-step','stroke-width':0.025 }));
        g.appendChild(svgEl('line', { x1:cx+tip,y1:ay2-tip*aDir,x2:cx,y2:ay2, class:'stair-step','stroke-width':0.025 }));
      }

      const shapeTag = shape === 'l-right' || shape === 'l-left' ? ' (L)' : shape === 'u' ? ' (U)' : '';
      const lbl = svgEl('text', { x:cx,y:y1-0.09,'text-anchor':'middle',class:'stair-label','font-size':'0.20','font-family':'system-ui,sans-serif' });
      lbl.textContent = `Escal.${shapeTag} ${steps}p.`;
      g.appendChild(lbl);

      g.addEventListener('mousedown', e => {
        if (_startDrag('stair', st.id, floorIdx, e)) e.stopPropagation();
      });
      g.addEventListener('click', e => {
        if (PA.state.activeTool === 'erase') {
          e.stopPropagation();
          PA.state.floors[floorIdx].stairs = PA.state.floors[floorIdx].stairs.filter(s => s.id !== st.id);
          PA.canvas.render(); PA.setDirty();
        }
      });
      g.addEventListener('contextmenu', e => {
        e.preventDefault(); e.stopPropagation();
        PA.contextMenu(e.clientX, e.clientY, [
          { label: 'Voltear dirección', action: () => {
            st.direction = st.direction === 'down' ? 'up' : 'down';
            PA.canvas.render(); PA.setDirty();
          }},
          null,
          { label: 'Eliminar escalera', danger: true, action: () => {
            PA.state.floors[floorIdx].stairs = PA.state.floors[floorIdx].stairs.filter(s => s.id !== st.id);
            PA.canvas.render(); PA.setDirty();
          }}
        ]);
      });

      parentGroup.appendChild(g);
    });
  }

  /* ── Furniture ──────────────────────────────────── */
  function renderFurniture(floor, parentGroup, floorIdx) {
    if (!floor.furniture || floor.furniture.length === 0) return;
    floor.furniture.forEach(item => {
      const rot = item.rotation || 0;
      const deg = rot * 180 / Math.PI;
      const g = svgEl('g', {
        id: item.id,
        class: 'furniture-group draggable-el',
        'data-selectable': '1',
        transform: `translate(${item.x},${item.y}) rotate(${deg.toFixed(2)}) translate(${(-item.w/2).toFixed(4)},${(-item.h/2).toFixed(4)})`
      });

      if (PA.tools.furniture) {
        g.innerHTML = PA.tools.furniture._svgSymbolHTML(item.type, 0, 0, item.w, item.h);
      } else {
        g.innerHTML = `<rect x="0" y="0" width="${item.w}" height="${item.h}" fill="#f1f5f9" stroke="#94a3b8" stroke-width="0.03"/>`;
      }

      const lbl = svgEl('text', {
        x: (item.w/2).toFixed(4), y: (item.h + 0.20).toFixed(4),
        'text-anchor': 'middle', fill: '#64748b',
        'font-size': '0.18px', 'font-family': 'system-ui,sans-serif'
      });
      lbl.textContent = item.label || item.type;
      g.appendChild(lbl);

      g.appendChild(svgEl('rect', {
        x: 0, y: 0, width: item.w, height: item.h,
        fill: 'transparent', stroke: 'none'
      }));

      const isSel = PA.state.selection && PA.state.selection.id === item.id && PA.state.activeTool === 'select';
      if (isSel) {
        const hDist = 0.42;
        const hx = item.w / 2;
        g.appendChild(svgEl('line', {
          x1: hx.toFixed(4), y1: 0, x2: hx.toFixed(4), y2: (-hDist).toFixed(4),
          stroke: '#6366f1', 'stroke-width': 0.018,
          'stroke-dasharray': '0.06 0.04', 'pointer-events': 'none'
        }));
        const rotHandle = svgEl('circle', {
          cx: hx.toFixed(4), cy: (-hDist).toFixed(4), r: 0.14,
          fill: '#6366f1', stroke: 'white', 'stroke-width': 0.030
        });
        rotHandle.style.cursor = 'grab';
        rotHandle.addEventListener('mousedown', e => {
          if (e.button !== 0) return;
          e.stopPropagation();
          if (PA.tools.select) PA.tools.select.startRotate(item.id, floorIdx, e, item.x, item.y);
        });
        g.appendChild(rotHandle);
      }

      g.addEventListener('mousedown', e => {
        if (_startDrag('furniture', item.id, floorIdx, e)) e.stopPropagation();
      });
      g.addEventListener('click', e => {
        if (PA.state.activeTool === 'erase') {
          e.stopPropagation();
          PA.saveUndo();
          PA.state.floors[floorIdx].furniture = PA.state.floors[floorIdx].furniture.filter(f => f.id !== item.id);
          PA.canvas.render(); PA.setDirty();
        }
      });
      g.addEventListener('contextmenu', e => {
        e.preventDefault(); e.stopPropagation();
        PA.contextMenu(e.clientX, e.clientY, [
          { label: 'Rotar 90°', action: () => {
            PA.saveUndo();
            item.rotation = ((item.rotation || 0) + Math.PI / 2) % (Math.PI * 2);
            [item.w, item.h] = [item.h, item.w];
            PA.canvas.render(); PA.setDirty();
          }},
          null,
          { label: 'Eliminar mueble', danger: true, action: () => {
            PA.saveUndo();
            PA.state.floors[floorIdx].furniture = PA.state.floors[floorIdx].furniture.filter(f => f.id !== item.id);
            PA.canvas.render(); PA.setDirty();
          }}
        ]);
      });

      parentGroup.appendChild(g);
    });
  }

  /* ── Electrical symbols ─────────────────────────── */
  function renderElectrical(floor, parentGroup, floorIdx) {
    const elec = floor.electrical || [];
    if (!elec.length) return;
    const g = svgEl('g', { class: 'elec-layer' });
    elec.forEach(item => {
      const rot = (item.rotation || 0) * 180 / Math.PI;
      const ig = svgEl('g', {
        id: item.id,
        class: 'elec-symbol draggable-el',
        'data-selectable': '1',
        transform: rot ? `rotate(${rot.toFixed(1)},${item.x},${item.y})` : undefined
      });
      if (!rot) ig.removeAttribute('transform'); // keep DOM clean when no rotation
      if (PA.tools.electrical) {
        ig.innerHTML = PA.tools.electrical.svgHTML(item.type, item.x, item.y, PA.tools.electrical.SZ);
      }
      ig.addEventListener('mousedown', e => {
        if (_startDrag('electrical', item.id, floorIdx, e)) e.stopPropagation();
      });
      ig.addEventListener('click', e => {
        if (PA.state.activeTool === 'erase') {
          e.stopPropagation();
          PA.saveUndo();
          PA.state.floors[floorIdx].electrical = PA.state.floors[floorIdx].electrical.filter(x => x.id !== item.id);
          PA.canvas.render(); PA.setDirty();
        }
      });
      ig.addEventListener('contextmenu', e => {
        e.preventDefault(); e.stopPropagation();
        PA.contextMenu(e.clientX, e.clientY, [
          { label: 'Rotar 90°', action: () => {
            PA.saveUndo();
            item.rotation = ((item.rotation || 0) + Math.PI / 2) % (Math.PI * 2);
            PA.canvas.render(); PA.setDirty();
          }},
          null,
          { label: 'Eliminar símbolo', danger: true, action: () => {
            PA.saveUndo();
            PA.state.floors[floorIdx].electrical = PA.state.floors[floorIdx].electrical.filter(x => x.id !== item.id);
            PA.canvas.render(); PA.setDirty();
          }}
        ]);
      });
      g.appendChild(ig);
    });
    parentGroup.appendChild(g);
  }

  /* ── Pipes ──────────────────────────────────────── */
  function renderPipes(floor, parentGroup, floorIdx) {
    const pipes = floor.pipes || [];
    if (!pipes.length) return;
    const KINDS = PA.tools.pipes ? PA.tools.pipes.getKinds() : {};
    const g = svgEl('g', { class: 'pipes-layer' });
    pipes.forEach(pipe => {
      const k   = KINDS[pipe.kind] || { color: '#64748b', dash: false, lw: 0.04 };
      const len = Math.hypot(pipe.x2 - pipe.x1, pipe.y2 - pipe.y1);
      if (len < 0.02) return;
      const pg = svgEl('g', { id: pipe.id, class: 'pipe-group draggable-el', 'data-selectable': '1' });

      const line = svgEl('line', {
        x1: pipe.x1, y1: pipe.y1, x2: pipe.x2, y2: pipe.y2,
        stroke: k.color,
        'stroke-width': k.lw,
        'stroke-dasharray': k.dash ? '0.18,0.09' : 'none',
        'stroke-linecap': 'round'
      });
      pg.appendChild(line);

      // Etiqueta de diámetro en el punto medio
      const mx = (pipe.x1 + pipe.x2) / 2, my = (pipe.y1 + pipe.y2) / 2;
      const angle = Math.atan2(pipe.y2 - pipe.y1, pipe.x2 - pipe.x1) * 180 / Math.PI;
      const normAngle = angle > 90 || angle < -90 ? angle + 180 : angle;
      const lbl = svgEl('text', {
        x: mx, y: my - 0.09,
        'font-size': '0.13', 'font-family': 'system-ui,sans-serif', 'font-weight': '600',
        'text-anchor': 'middle', fill: k.color,
        transform: `rotate(${normAngle.toFixed(1)},${mx},${my})`
      });
      lbl.textContent = pipe.diam;
      pg.appendChild(lbl);

      // Hit area invisible más ancha para facilitar selección
      const hit = svgEl('line', {
        x1: pipe.x1, y1: pipe.y1, x2: pipe.x2, y2: pipe.y2,
        stroke: 'transparent', 'stroke-width': 0.25, 'stroke-linecap': 'round'
      });
      pg.appendChild(hit);

      pg.addEventListener('mousedown', e => {
        if (_startDrag('pipe', pipe.id, floorIdx, e)) e.stopPropagation();
      });
      pg.addEventListener('click', e => {
        if (PA.state.activeTool === 'erase') {
          e.stopPropagation();
          PA.saveUndo();
          PA.state.floors[floorIdx].pipes = PA.state.floors[floorIdx].pipes.filter(p => p.id !== pipe.id);
          PA.canvas.render(); PA.setDirty();
        }
      });
      pg.addEventListener('contextmenu', e => {
        e.preventDefault(); e.stopPropagation();
        PA.contextMenu(e.clientX, e.clientY, [
          { label: 'Eliminar tubería', danger: true, action: () => {
            PA.saveUndo();
            PA.state.floors[floorIdx].pipes = PA.state.floors[floorIdx].pipes.filter(p => p.id !== pipe.id);
            PA.canvas.render(); PA.setDirty();
          }}
        ]);
      });
      g.appendChild(pg);
    });
    parentGroup.appendChild(g);
  }

  /* ── Lightwells ─────────────────────────────────── */
  function renderLightwells(floor, parentGroup, floorIdx) {
    if (!floor.lightwells || floor.lightwells.length === 0) return;
    const NS = 'http://www.w3.org/2000/svg';

    // Define hatch pattern once per render call (unique id per floor)
    const patId = 'lw-hatch-' + floorIdx;
    const defs = document.createElementNS(NS, 'defs');
    const pat  = svgEl('pattern', { id: patId, width: 0.3, height: 0.3, patternUnits: 'userSpaceOnUse' });
    const ln   = svgEl('line', { x1: 0, y1: 0.3, x2: 0.3, y2: 0, stroke: '#93c5fd', 'stroke-width': 0.025, opacity: 0.6 });
    pat.appendChild(ln);
    defs.appendChild(pat);
    parentGroup.appendChild(defs);

    floor.lightwells.forEach(lw => {
      const g = svgEl('g', { id: lw.id, class: 'lightwell-group draggable-el', 'data-selectable': '1' });

      // Hatch fill
      g.appendChild(svgEl('rect', {
        x: lw.x, y: lw.y, width: lw.w, height: lw.h,
        fill: `url(#${patId})`, opacity: 0.9
      }));
      // Solid border
      g.appendChild(svgEl('rect', {
        x: lw.x, y: lw.y, width: lw.w, height: lw.h,
        fill: 'rgba(147,197,253,0.18)', stroke: '#3b82f6',
        'stroke-width': 0.035, 'stroke-dasharray': '0.12 0.06'
      }));
      // Label
      const txt = svgEl('text', {
        x: (lw.x + lw.w / 2).toFixed(4), y: (lw.y + lw.h / 2 + 0.10).toFixed(4),
        'text-anchor': 'middle', fill: '#1d4ed8',
        'font-size': '0.22px', 'font-weight': '700', 'font-family': 'system-ui,sans-serif'
      });
      txt.textContent = lw.label || 'Patio de Luz';
      g.appendChild(txt);
      const dimTxt = svgEl('text', {
        x: (lw.x + lw.w / 2).toFixed(4), y: (lw.y + lw.h / 2 + 0.35).toFixed(4),
        'text-anchor': 'middle', fill: '#3b82f6',
        'font-size': '0.16px', 'font-family': 'system-ui,sans-serif'
      });
      dimTxt.textContent = lw.w.toFixed(2) + ' × ' + lw.h.toFixed(2) + ' m';
      g.appendChild(dimTxt);

      g.addEventListener('mousedown', e => {
        if (_startDrag('lightwell', lw.id, floorIdx, e)) e.stopPropagation();
      });
      g.addEventListener('click', e => {
        if (PA.state.activeTool === 'erase') {
          e.stopPropagation();
          PA.saveUndo();
          PA.state.floors[floorIdx].lightwells = PA.state.floors[floorIdx].lightwells.filter(x => x.id !== lw.id);
          PA.canvas.render(); PA.setDirty();
        }
      });
      g.addEventListener('contextmenu', e => {
        e.preventDefault(); e.stopPropagation();
        PA.contextMenu(e.clientX, e.clientY, [
          { label: 'Eliminar patio de luz', danger: true, action: () => {
            PA.saveUndo();
            PA.state.floors[floorIdx].lightwells = PA.state.floors[floorIdx].lightwells.filter(x => x.id !== lw.id);
            PA.canvas.render(); PA.setDirty();
          }}
        ]);
      });

      parentGroup.appendChild(g);
    });
  }

  /* ── Skylights ──────────────────────────────────── */
  function renderSkylights(floor, parentGroup, floorIdx) {
    if (!floor.skylights || floor.skylights.length === 0) return;

    floor.skylights.forEach(sl => {
      const g = svgEl('g', { id: sl.id, class: 'skylight-group draggable-el', 'data-selectable': '1' });
      const cx = sl.x + sl.w / 2, cy = sl.y + sl.h / 2;

      // Background rect
      g.appendChild(svgEl('rect', {
        x: sl.x, y: sl.y, width: sl.w, height: sl.h,
        fill: 'rgba(254,240,138,0.35)', stroke: '#f59e0b',
        'stroke-width': 0.030, 'stroke-dasharray': '0.10 0.05'
      }));
      // Diagonal X lines
      g.appendChild(svgEl('line', {
        x1: sl.x, y1: sl.y, x2: sl.x + sl.w, y2: sl.y + sl.h,
        stroke: '#f59e0b', 'stroke-width': 0.022, opacity: 0.7
      }));
      g.appendChild(svgEl('line', {
        x1: sl.x + sl.w, y1: sl.y, x2: sl.x, y2: sl.y + sl.h,
        stroke: '#f59e0b', 'stroke-width': 0.022, opacity: 0.7
      }));
      // Center circle
      g.appendChild(svgEl('circle', {
        cx: cx.toFixed(4), cy: cy.toFixed(4), r: Math.min(sl.w, sl.h) * 0.18,
        fill: '#fef08a', stroke: '#d97706', 'stroke-width': 0.025
      }));
      // Label
      const txt = svgEl('text', {
        x: cx.toFixed(4), y: (sl.y - 0.10).toFixed(4),
        'text-anchor': 'middle', fill: '#92400e',
        'font-size': '0.20px', 'font-weight': '700', 'font-family': 'system-ui,sans-serif'
      });
      txt.textContent = sl.label || 'Tragaluz';
      g.appendChild(txt);

      g.addEventListener('mousedown', e => {
        if (_startDrag('skylight', sl.id, floorIdx, e)) e.stopPropagation();
      });
      g.addEventListener('click', e => {
        if (PA.state.activeTool === 'erase') {
          e.stopPropagation();
          PA.saveUndo();
          PA.state.floors[floorIdx].skylights = PA.state.floors[floorIdx].skylights.filter(x => x.id !== sl.id);
          PA.canvas.render(); PA.setDirty();
        }
      });
      g.addEventListener('contextmenu', e => {
        e.preventDefault(); e.stopPropagation();
        PA.contextMenu(e.clientX, e.clientY, [
          { label: 'Eliminar tragaluz', danger: true, action: () => {
            PA.saveUndo();
            PA.state.floors[floorIdx].skylights = PA.state.floors[floorIdx].skylights.filter(x => x.id !== sl.id);
            PA.canvas.render(); PA.setDirty();
          }}
        ]);
      });

      parentGroup.appendChild(g);
    });
  }

  /* ── Floor list (panel) ──────────────────────────── */
  function renderFloorList() {
    const list = document.getElementById('floors-list');
    list.innerHTML = '';
    PA.state.floors.forEach((floor, idx) => {
      const item = document.createElement('div');
      item.className = 'floor-item' + (idx === PA.state.activeFloor ? ' active' : '');
      item.innerHTML = `
        <span class="floor-icon">${idx === 0 ? '🏠' : '⬆️'}</span>
        <input class="floor-name-input" type="text" value="${floor.name}" data-idx="${idx}" title="Doble clic para editar">
        <button class="floor-vis-btn" data-idx="${idx}" title="${floor.visible ? 'Ocultar' : 'Mostrar'}">${floor.visible ? '👁' : '🚫'}</button>
        <button class="floor-del-btn" data-idx="${idx}" title="Eliminar piso">✕</button>
      `;

      item.querySelector('.floor-name-input').addEventListener('click', () => setActiveFloor(idx));
      item.querySelector('.floor-name-input').addEventListener('change', e => {
        floor.name = e.target.value.trim() || floor.name;
        PA.emit('floorChanged'); PA.setDirty();
      });
      item.querySelector('.floor-vis-btn').addEventListener('click', e => {
        e.stopPropagation();
        floor.visible = !floor.visible;
        PA.canvas.render(); PA.setDirty();
      });
      item.querySelector('.floor-del-btn').addEventListener('click', e => {
        e.stopPropagation();
        if (PA.state.floors.length <= 1) { alert('No puedes eliminar el único piso.'); return; }
        if (!confirm(`¿Eliminar ${floor.name}? Se perderán todos sus elementos.`)) return;
        PA.state.floors.splice(idx, 1);
        if (PA.state.activeFloor >= PA.state.floors.length) PA.state.activeFloor = PA.state.floors.length - 1;
        PA.canvas.render(); PA.setDirty();
      });

      list.appendChild(item);
    });
  }

  function setActiveFloor(idx) {
    PA.state.activeFloor = idx;
    PA.canvas.render();
    PA.emit('floorChanged');
  }

  function addFloor() {
    const num = PA.state.floors.length;
    const names = ['Planta Baja','Planta 1','Planta 2','Planta 3','Planta 4'];
    PA.state.floors.push(PA.newFloor(names[num] || 'Piso ' + num));
    PA.state.activeFloor = PA.state.floors.length - 1;
    PA.canvas.render();
    PA.emit('floorChanged');
    PA.setDirty();
  }

  /* ── Auto-detect rooms modal ─────────────────────── */
  function showAutoDetectModal() {
    const floor = PA.activeFloor();
    if (!floor || floor.walls.length === 0) {
      PA.modal('Auto-detectar', '<p class="empty-msg">Dibuje paredes primero.</p>', { hideCancel: true, okLabel: 'Cerrar' });
      return;
    }

    const detected = PA.geometry.detectRooms(floor);

    if (detected.length === 0) {
      PA.modal('Auto-detectar', '<p class="empty-msg">No se encontraron espacios cerrados. Asegúrese de que las paredes formen recintos cerrados.</p>', { hideCancel: true, okLabel: 'Cerrar' });
      return;
    }

    const PRESETS = ['Sala', 'Comedor', 'Cocina', 'Habitación', 'Baño', 'Garaje', 'Estudio', 'Patio', 'Balcón', 'Depósito'];

    const rows = detected.map((f, i) => `
      <tr>
        <td><input type="checkbox" class="adr-chk" data-idx="${i}" checked></td>
        <td style="color:#64748b;font-size:11px">${f.area} m²</td>
        <td>
          <input type="text" class="adr-name" data-idx="${i}"
            value="${PRESETS[i] || 'Espacio ' + (i + 1)}"
            style="width:100%;padding:4px 6px;border:1px solid #e2e8f0;border-radius:4px;font-size:12px">
        </td>
      </tr>
    `).join('');

    PA.modal('Auto-detectar espacios', `
      <p style="font-size:12px;color:#64748b;margin-bottom:10px">
        Se encontraron <strong>${detected.length}</strong> espacio(s) cerrado(s).
        Seleccione los que desea agregar y asígneles un nombre.
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="color:#94a3b8;font-size:11px;text-align:left">
            <th style="padding:4px 2px;width:24px"></th>
            <th style="padding:4px 6px">Área</th>
            <th style="padding:4px 6px">Nombre</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `, {
      okLabel: 'Agregar seleccionados',
      onOk: () => {
        PA.saveUndo();
        let added = 0;
        document.querySelectorAll('.adr-chk').forEach(chk => {
          if (!chk.checked) return;
          const idx  = parseInt(chk.dataset.idx);
          const name = document.querySelector(`.adr-name[data-idx="${idx}"]`).value.trim() || 'Espacio';
          const face = detected[idx];
          // Avoid placing on top of existing room
          const duplicate = floor.rooms.some(r => Math.hypot(r.x - face.cx, r.y - face.cy) < 0.5);
          if (!duplicate) {
            floor.rooms.push({
              id: PA.uid('r'), name, area: face.area, x: face.cx, y: face.cy,
              color: ROOM_PALETTE[floor.rooms.length % ROOM_PALETTE.length],
              finishes: { piso: 'ceramica', cieloRaso: 'pintura', pintura: 'vinilo' }
            });
            added++;
          }
        });
        if (added > 0) { PA.canvas.render(); PA.setDirty(); }
      }
    });
  }

  return { init, render, renderFloorList, renderRoomsList, addFloor, setActiveFloor, editRoom };
})();

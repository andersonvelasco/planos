'use strict';

PA.tools.select = (() => {

  // _drag: { type, id, floorIdx, floor, originWorld, snapshot }
  let _drag = null;

  function activate()   { _drag = null; }
  function deactivate() { _drag = null; }

  /* ── Mousedown on empty canvas → clear selection ── */
  function onMouseDown(e) {
    if (e.button !== 0) return;
    // If target is SVG background (not an element) clear selection
    const sel = e.target.closest('[data-selectable]');
    if (!sel) PA.canvas.clearSelection();
  }

  /* ── Drag tracking ───────────────────────────────── */
  // Called from floors.js element mousedown handlers
  function startDrag(type, id, floorIdx, e) {
    const floor = PA.state.floors[floorIdx];
    if (!floor) return;
    const w = PA.clientToWorld(e.clientX, e.clientY);
    const snapshot = _snapshot(type, id, floor);
    if (!snapshot) return;
    e.stopPropagation(); // prevent SVG pan while dragging elements
    _drag = { type, id, floorIdx, floor, originWorld: w, snapshot, moved: false };
  }

  function _snapshot(type, id, floor) {
    switch (type) {
      case 'wall': {
        const el = floor.walls.find(x => x.id === id);
        return el ? { x1: el.x1, y1: el.y1, x2: el.x2, y2: el.y2 } : null;
      }
      case 'door': {
        const el = floor.doors.find(x => x.id === id);
        return el ? { t: el.t } : null;
      }
      case 'window': {
        const el = floor.windows.find(x => x.id === id);
        return el ? { t: el.t } : null;
      }
      case 'room': {
        const el = floor.rooms.find(x => x.id === id);
        return el ? { x: el.x, y: el.y } : null;
      }
      case 'dimension': {
        const el = floor.dimensions.find(x => x.id === id);
        return el ? { x1: el.x1, y1: el.y1, x2: el.x2, y2: el.y2 } : null;
      }
      case 'stair': {
        const el = floor.stairs ? floor.stairs.find(x => x.id === id) : null;
        return el ? { x1: el.x1, y1: el.y1, x2: el.x2, y2: el.y2 } : null;
      }
      case 'furniture': {
        const el = floor.furniture ? floor.furniture.find(x => x.id === id) : null;
        return el ? { x: el.x, y: el.y } : null;
      }
      case 'electrical': {
        const el = floor.electrical ? floor.electrical.find(x => x.id === id) : null;
        return el ? { x: el.x, y: el.y } : null;
      }
      case 'pipe': {
        const el = floor.pipes ? floor.pipes.find(x => x.id === id) : null;
        return el ? { x1: el.x1, y1: el.y1, x2: el.x2, y2: el.y2 } : null;
      }
    }
    return null;
  }

  function onMouseMove(e) {
    if (!_drag) return;
    if (!_drag.moved) PA.saveUndo(); // save before first mutation
    const w = PA.clientToWorld(e.clientX, e.clientY);
    _applyDrag(w);
    _drag.moved = true;
    PA.canvas.render();
  }

  function onMouseUp() {
    if (_drag) {
      const moved = _drag.moved;
      _drag = null;
      if (moved) PA.setDirty();
    }
  }

  function _applyDrag(worldPos) {
    const { type, id, floor, originWorld, snapshot } = _drag;
    const dx = worldPos.x - originWorld.x;
    const dy = worldPos.y - originWorld.y;
    const snapped = PA.snap(worldPos.x, worldPos.y);

    switch (type) {
      case 'wall': {
        const el = floor.walls.find(x => x.id === id);
        if (!el) break;
        el.x1 = snapshot.x1 + dx;
        el.y1 = snapshot.y1 + dy;
        el.x2 = snapshot.x2 + dx;
        el.y2 = snapshot.y2 + dy;
        break;
      }
      case 'door': {
        const door = floor.doors.find(x => x.id === id);
        if (!door) break;
        const wall = floor.walls.find(w => w.id === door.wallId);
        if (!wall) break;
        const wdx = wall.x2 - wall.x1, wdy = wall.y2 - wall.y1;
        const len2 = wdx * wdx + wdy * wdy;
        if (len2 < 0.0001) break;
        const mx = worldPos.x - wall.x1, my = worldPos.y - wall.y1;
        door.t = Math.max(0.05, Math.min(0.95, (mx * wdx + my * wdy) / len2));
        break;
      }
      case 'window': {
        const win = floor.windows.find(x => x.id === id);
        if (!win) break;
        const wall = floor.walls.find(w => w.id === win.wallId);
        if (!wall) break;
        const wdx = wall.x2 - wall.x1, wdy = wall.y2 - wall.y1;
        const len2 = wdx * wdx + wdy * wdy;
        if (len2 < 0.0001) break;
        const mx = worldPos.x - wall.x1, my = worldPos.y - wall.y1;
        win.t = Math.max(0.05, Math.min(0.95, (mx * wdx + my * wdy) / len2));
        break;
      }
      case 'room': {
        const el = floor.rooms.find(x => x.id === id);
        if (!el) break;
        el.x = snapshot.x + dx;
        el.y = snapshot.y + dy;
        break;
      }
      case 'dimension': {
        const el = floor.dimensions.find(x => x.id === id);
        if (!el) break;
        el.x1 = snapshot.x1 + dx; el.y1 = snapshot.y1 + dy;
        el.x2 = snapshot.x2 + dx; el.y2 = snapshot.y2 + dy;
        break;
      }
      case 'stair': {
        const el = floor.stairs ? floor.stairs.find(x => x.id === id) : null;
        if (!el) break;
        el.x1 = snapshot.x1 + dx; el.y1 = snapshot.y1 + dy;
        el.x2 = snapshot.x2 + dx; el.y2 = snapshot.y2 + dy;
        break;
      }
      case 'furniture': {
        const el = floor.furniture ? floor.furniture.find(x => x.id === id) : null;
        if (!el) break;
        el.x = snapshot.x + dx;
        el.y = snapshot.y + dy;
        break;
      }
      case 'electrical': {
        const el = floor.electrical ? floor.electrical.find(x => x.id === id) : null;
        if (!el) break;
        el.x = snapshot.x + dx;
        el.y = snapshot.y + dy;
        break;
      }
      case 'pipe': {
        const el = floor.pipes ? floor.pipes.find(x => x.id === id) : null;
        if (!el) break;
        el.x1 = snapshot.x1 + dx; el.y1 = snapshot.y1 + dy;
        el.x2 = snapshot.x2 + dx; el.y2 = snapshot.y2 + dy;
        break;
      }
    }
  }

  return { activate, deactivate, onMouseDown, onMouseMove, onMouseUp, startDrag };
})();

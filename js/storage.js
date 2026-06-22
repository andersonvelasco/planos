'use strict';

PA.storage = (() => {
  const KEY_LIST  = 'planoapp_projects';
  const KEY_LAST  = 'planoapp_last';
  const MAX_PROJ  = 15;

  function init() {}

  /* ── Guardar ─────────────────────────────────────── */
  function save(silent = false) {
    const id = PA.state.projectId || PA.uid('proj');
    PA.state.projectId = id;

    const snapshot = {
      id,
      name: PA.state.projectName,
      updatedAt: Date.now(),
      zoom:  PA.state.zoom,
      pan:   { ...PA.state.pan },
      prices: { ...PA.state.prices },
      activeFloor: PA.state.activeFloor,
      floors: JSON.parse(JSON.stringify(PA.state.floors))
    };

    // List of project IDs + names
    const list = getList();
    const existing = list.findIndex(p => p.id === id);
    const meta = { id, name: snapshot.name, updatedAt: snapshot.updatedAt };
    if (existing >= 0) list[existing] = meta;
    else { list.unshift(meta); if (list.length > MAX_PROJ) list.pop(); }

    try {
      localStorage.setItem(KEY_LIST, JSON.stringify(list));
      localStorage.setItem('proj_' + id, JSON.stringify(snapshot));
      localStorage.setItem(KEY_LAST, id);
      PA.clearDirty();
      if (!silent) showToast('Proyecto guardado');
      else showToast('Autoguardado');
    } catch (err) {
      alert('Error al guardar: ' + err.message);
    }
  }

  /* ── Cargar ──────────────────────────────────────── */
  function load(id) {
    try {
      const raw = localStorage.getItem('proj_' + id);
      if (!raw) { alert('Proyecto no encontrado.'); return false; }
      const snap = JSON.parse(raw);
      applySnapshot(snap);
      localStorage.setItem(KEY_LAST, id);
      PA.clearDirty();
      return true;
    } catch (err) {
      alert('Error al cargar proyecto: ' + err.message);
      return false;
    }
  }

  function loadLast() {
    const lastId = localStorage.getItem(KEY_LAST);
    if (!lastId) return false;
    return load(lastId);
  }

  function _normalizeFloors(floors) {
    floors.forEach(f => {
      if (!f.stairs)      f.stairs      = [];
      if (!f.furniture)   f.furniture   = [];
      if (!f.electrical)  f.electrical  = [];
      if (!f.pipes)       f.pipes       = [];
      if (!f.lightwells)  f.lightwells  = [];
      if (!f.skylights)   f.skylights   = [];
      f.rooms.forEach(r => {
        if (!r.finishes) r.finishes = { piso:'ceramica', cieloRaso:'pintura', pintura:'vinilo' };
      });
    });
  }

  function applySnapshot(snap) {
    PA.state.projectId   = snap.id;
    PA.state.projectName = snap.name;
    PA.state.floors      = snap.floors;
    PA.state.activeFloor = snap.activeFloor || 0;
    _normalizeFloors(PA.state.floors);
    PA.state.zoom        = snap.zoom  || 1;
    PA.state.pan         = snap.pan   || { x: 120, y: 80 };
    Object.assign(PA.state.prices, snap.prices || {});

    document.getElementById('project-name').value = snap.name;
    document.title = snap.name + ' — PlanoApp';
    PA.canvas.render();
    PA.emit('floorChanged');
  }

  /* ── Nuevo proyecto ──────────────────────────────── */
  function newProject() {
    if (PA.isDirty()) {
      PA.modal('Proyecto sin guardar', '¿Deseas guardar el proyecto actual antes de crear uno nuevo?', {
        okLabel: 'Guardar y Nuevo',
        cancelLabel: 'Descartar cambios',
        onOk: () => { save(); _createNew(); },
        onCancel: () => _createNew()
      });
    } else {
      _createNew();
    }
  }

  function _createNew() {
    PA.state.projectId   = null;
    PA.state.projectName = 'Mi Casa';
    PA.state.activeFloor = 0;
    PA.state.zoom        = 1;
    PA.state.pan         = { x: 120, y: 80 };
    PA.state.floors      = [PA.newFloor('Planta Baja')];
    document.getElementById('project-name').value = 'Mi Casa';
    document.title = 'Mi Casa — PlanoApp';
    PA.canvas.render();
    PA.emit('floorChanged');
    PA.clearDirty();
  }

  /* ── Demo: Casa 2 pisos 6×12m ───────────────────── */
  function createDemo() {
    const W = 6, H = 12;
    const thick = { ext: 0.20, int: 0.15 };
    const ht    = { ext: 2.8,  int: 2.8  };

    /* ── PISO 1 — Planta Baja ── */
    const p1 = PA.state.floors[0];
    p1.name = 'Planta Baja';

    const w1_front = PA.uid('w'), w1_right = PA.uid('w'),
          w1_back  = PA.uid('w'), w1_left  = PA.uid('w');
    const w1_gb  = PA.uid('w'); // garage back wall
    const w1_sl  = PA.uid('w'); // service/living split

    // Exterior
    p1.walls.push({ id: w1_front, x1:0, y1:0, x2:W, y2:0, thickness:thick.ext, height:ht.ext, material:'bloque' });
    p1.walls.push({ id: w1_right, x1:W, y1:0, x2:W, y2:H, thickness:thick.ext, height:ht.ext, material:'bloque' });
    p1.walls.push({ id: w1_back,  x1:W, y1:H, x2:0, y2:H, thickness:thick.ext, height:ht.ext, material:'bloque' });
    p1.walls.push({ id: w1_left,  x1:0, y1:H, x2:0, y2:0, thickness:thick.ext, height:ht.ext, material:'bloque' });
    // Garage center
    p1.walls.push({ id: PA.uid('w'), x1:3, y1:0, x2:3, y2:4.5, thickness:thick.int, height:ht.int, material:'bloque' });
    // Garage / service separation
    p1.walls.push({ id: w1_gb, x1:0, y1:4.5, x2:W, y2:4.5, thickness:thick.int, height:ht.int, material:'bloque' });
    // Bedroom / bathroom
    p1.walls.push({ id: PA.uid('w'), x1:4, y1:4.5, x2:4, y2:7.5, thickness:thick.int, height:ht.int, material:'bloque' });
    // Service / living
    p1.walls.push({ id: w1_sl, x1:0, y1:7.5, x2:W, y2:7.5, thickness:thick.int, height:ht.int, material:'bloque' });
    // Sala / comedor
    p1.walls.push({ id: PA.uid('w'), x1:3, y1:7.5, x2:3, y2:10, thickness:thick.int, height:ht.int, material:'bloque' });
    // Patio
    p1.walls.push({ id: PA.uid('w'), x1:0, y1:10, x2:W, y2:10, thickness:thick.int, height:ht.int, material:'bloque' });

    p1.rooms.push({ id:PA.uid('r'), name:'Garaje 1',   area:13.5, x:1.5, y:2.25 });
    p1.rooms.push({ id:PA.uid('r'), name:'Garaje 2',   area:13.5, x:4.5, y:2.25 });
    p1.rooms.push({ id:PA.uid('r'), name:'Habitación', area:16,   x:2,   y:6    });
    p1.rooms.push({ id:PA.uid('r'), name:'Baño',       area:6,    x:5,   y:6    });
    p1.rooms.push({ id:PA.uid('r'), name:'Sala',       area:7.5,  x:1.5, y:8.75 });
    p1.rooms.push({ id:PA.uid('r'), name:'Comedor',    area:7.5,  x:4.5, y:8.75 });
    p1.rooms.push({ id:PA.uid('r'), name:'Patio',      area:12,   x:3,   y:11   });

    // Pedestrian door (front right)
    p1.doors.push({ id:PA.uid('d'), wallId:w1_front, t:0.83, width:0.9,  openLeft:true,  openIn:true  });
    // Interior door from garage to bedroom area
    p1.doors.push({ id:PA.uid('d'), wallId:w1_gb,    t:0.16, width:0.85, openLeft:false, openIn:true  });
    // Door to sala
    p1.doors.push({ id:PA.uid('d'), wallId:w1_sl,    t:0.25, width:0.9,  openLeft:true,  openIn:false });

    // Dimensions
    p1.dimensions.push({ id:PA.uid('dim'), x1:0, y1:0, x2:W, y2:0, offset:-0.7 });
    p1.dimensions.push({ id:PA.uid('dim'), x1:W, y1:0, x2:W, y2:H, offset:-0.7 });

    /* ── PISO 2 — Planta Alta ── */
    const p2 = PA.newFloor('Planta Alta');
    PA.state.floors.push(p2);

    const w2_front = PA.uid('w'), w2_right = PA.uid('w'),
          w2_back  = PA.uid('w'), w2_left  = PA.uid('w');
    const w2_balBack = PA.uid('w'); // balcony back wall

    // Exterior
    p2.walls.push({ id: w2_front, x1:0, y1:0, x2:W, y2:0, thickness:thick.ext, height:ht.ext, material:'bloque' });
    p2.walls.push({ id: w2_right, x1:W, y1:0, x2:W, y2:H, thickness:thick.ext, height:ht.ext, material:'bloque' });
    p2.walls.push({ id: w2_back,  x1:W, y1:H, x2:0, y2:H, thickness:thick.ext, height:ht.ext, material:'bloque' });
    p2.walls.push({ id: w2_left,  x1:0, y1:H, x2:0, y2:0, thickness:thick.ext, height:ht.ext, material:'bloque' });
    // Balcony center divider (low parapet)
    p2.walls.push({ id: PA.uid('w'), x1:3, y1:0, x2:3, y2:1.8, thickness:thick.int, height:1.0, material:'bloque' });
    // Balcony back wall
    p2.walls.push({ id: w2_balBack, x1:0, y1:1.8, x2:W, y2:1.8, thickness:thick.int, height:ht.int, material:'bloque' });
    // Sala estar center divider
    p2.walls.push({ id: PA.uid('w'), x1:3, y1:1.8, x2:3, y2:5, thickness:thick.int, height:ht.int, material:'bloque' });
    // Sala estar / bedrooms
    p2.walls.push({ id: PA.uid('w'), x1:0, y1:5, x2:W, y2:5, thickness:thick.int, height:ht.int, material:'bloque' });
    // Bedroom center divider
    p2.walls.push({ id: PA.uid('w'), x1:3, y1:5, x2:3, y2:9, thickness:thick.int, height:ht.int, material:'bloque' });
    // Bathroom wall in right zone
    p2.walls.push({ id: PA.uid('w'), x1:3, y1:7, x2:W, y2:7, thickness:thick.int, height:ht.int, material:'bloque' });
    // Bedroom / luz separation
    p2.walls.push({ id: PA.uid('w'), x1:0, y1:9, x2:W, y2:9, thickness:thick.int, height:ht.int, material:'bloque' });
    // Luz shaft side walls
    p2.walls.push({ id: PA.uid('w'), x1:2, y1:9, x2:2, y2:H, thickness:thick.int, height:ht.int, material:'bloque' });
    p2.walls.push({ id: PA.uid('w'), x1:4, y1:9, x2:4, y2:H, thickness:thick.int, height:ht.int, material:'bloque' });

    p2.rooms.push({ id:PA.uid('r'), name:'Balcón Izq.',  area:5.4,  x:1.5, y:0.9  });
    p2.rooms.push({ id:PA.uid('r'), name:'Balcón Der.',  area:5.4,  x:4.5, y:0.9  });
    p2.rooms.push({ id:PA.uid('r'), name:'Sala Estar',   area:18.9, x:3,   y:3.4  });
    p2.rooms.push({ id:PA.uid('r'), name:'Habitación 1', area:15,   x:1.5, y:7    });
    p2.rooms.push({ id:PA.uid('r'), name:'Habitación 2', area:9,    x:4.5, y:6    });
    p2.rooms.push({ id:PA.uid('r'), name:'Baño 2',       area:6,    x:4.5, y:8    });
    p2.rooms.push({ id:PA.uid('r'), name:'Habitación 3', area:6,    x:1,   y:10.5 });
    p2.rooms.push({ id:PA.uid('r'), name:'Luz',          area:4,    x:3,   y:10.5 });
    p2.rooms.push({ id:PA.uid('r'), name:'Baño 1',       area:6,    x:5,   y:10.5 });

    // Balcony doors (sliding)
    p2.doors.push({ id:PA.uid('d'), wallId:w2_balBack, t:0.25, width:1.20, openLeft:false, openIn:false });
    p2.doors.push({ id:PA.uid('d'), wallId:w2_balBack, t:0.75, width:1.20, openLeft:true,  openIn:false });

    /* Project info */
    PA.state.projectName = 'Casa 2 Pisos · 6×12m (Demo)';
    document.getElementById('project-name').value = PA.state.projectName;
    document.title = PA.state.projectName + ' — PlanoApp';
    PA.state.activeFloor = 0;

    PA.canvas.render();
    PA.emit('floorChanged');
    PA.canvas.fitView();
    setTimeout(() => PA.canvas.fitView(), 100);
  }

  /* ── Abrir modal ─────────────────────────────────── */
  function showOpenModal() {
    const list = getList();
    if (list.length === 0) {
      PA.modal('Proyectos guardados', '<p style="color:#64748b">No hay proyectos guardados aún.</p>', { hideCancel: true, okLabel: 'Cerrar' });
      return;
    }

    const html = `
      <ul class="project-list">
        ${list.map(p => `
          <li class="project-item" data-id="${p.id}">
            <div>
              <div class="project-item-name">${p.name}</div>
              <div class="project-item-meta">${new Date(p.updatedAt).toLocaleString('es-CO')}</div>
            </div>
            <button class="project-item-del" data-del="${p.id}" title="Eliminar">✕</button>
          </li>
        `).join('')}
      </ul>
    `;

    PA.modal('Abrir Proyecto', html, {
      okLabel: 'Abrir seleccionado',
      onOk: () => {
        const sel = document.querySelector('.project-item.selected-proj');
        if (sel) load(sel.dataset.id);
      }
    });

    setTimeout(() => {
      document.querySelectorAll('.project-item').forEach(item => {
        item.addEventListener('click', () => {
          document.querySelectorAll('.project-item').forEach(i => i.classList.remove('selected-proj'));
          item.classList.add('selected-proj');
        });
        item.addEventListener('dblclick', () => {
          document.getElementById('modal-overlay').classList.add('hidden');
          load(item.dataset.id);
        });
      });
      document.querySelectorAll('.project-item-del').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          const id = btn.dataset.del;
          deleteProject(id);
          btn.closest('.project-item').remove();
        });
      });
    }, 50);
  }

  function deleteProject(id) {
    const list = getList().filter(p => p.id !== id);
    localStorage.setItem(KEY_LIST, JSON.stringify(list));
    localStorage.removeItem('proj_' + id);
    if (localStorage.getItem(KEY_LAST) === id) localStorage.removeItem(KEY_LAST);
  }

  function getList() {
    try { return JSON.parse(localStorage.getItem(KEY_LIST) || '[]'); }
    catch { return []; }
  }

  /* ── Toast notification ──────────────────────────── */
  function showToast(msg) {
    let toast = document.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.style.cssText = 'position:fixed;bottom:40px;left:50%;transform:translateX(-50%);background:#1e2a3a;color:#fff;padding:8px 20px;border-radius:20px;font-size:13px;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,.3);transition:opacity .3s';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 2000);
  }

  /* ── Importar desde archivo JSON ─────────────────── */
  function importJSON() {
    const input = document.createElement('input');
    input.type   = 'file';
    input.accept = '.json,application/json';
    input.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const data = JSON.parse(ev.target.result);
          if (!data.floors || !Array.isArray(data.floors)) throw new Error('Formato inválido');
          PA.state.projectId   = null;
          PA.state.projectName = data.name || 'Proyecto importado';
          PA.state.floors      = data.floors;
          _normalizeFloors(PA.state.floors);
          PA.state.activeFloor = 0;
          if (data.prices) Object.assign(PA.state.prices, data.prices);
          document.getElementById('project-name').value = PA.state.projectName;
          document.title = PA.state.projectName + ' — PlanoApp';
          PA.canvas.render();
          PA.emit('floorChanged');
          PA.clearDirty();
          showToast('Proyecto importado: ' + PA.state.projectName);
        } catch (err) {
          alert('Error al importar: ' + err.message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  return { init, save, load, loadLast, newProject, createDemo, showOpenModal, importJSON };
})();

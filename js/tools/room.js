'use strict';

PA.tools.room = (() => {
  function activate() {}
  function deactivate() {}

  function onMouseDown(e) {
    if (e.button !== 0) return;
    const raw = PA.clientToWorld(e.clientX, e.clientY);
    const pt  = PA.snap(raw.x, raw.y);

    PA.modal('Nueva Habitación', `
      <div style="display:flex;flex-direction:column;gap:12px">
        <label style="display:flex;flex-direction:column;gap:4px;font-size:13px">
          Nombre de la habitación
          <input type="text" id="nr-name" value="Habitación"
            style="padding:7px 10px;border:1px solid #e2e8f0;border-radius:5px;font-size:13px">
        </label>
        <label style="display:flex;flex-direction:column;gap:4px;font-size:13px">
          Área (m²) — opcional
          <input type="number" id="nr-area" value="" step="0.5" min="0" placeholder="Ej: 15.5"
            style="padding:7px 10px;border:1px solid #e2e8f0;border-radius:5px;font-size:13px">
        </label>
        <div style="font-size:11px;color:#64748b">
          Sugerencias: Sala, Comedor, Cocina, Cuarto 1, Cuarto 2, Baño, Estudio, Garaje
        </div>
      </div>
    `, {
      okLabel: 'Agregar',
      onOk: () => {
        const name = document.getElementById('nr-name').value.trim() || 'Habitación';
        const area = parseFloat(document.getElementById('nr-area').value) || 0;
        PA.saveUndo();
        PA.activeFloor().rooms.push({
          id: PA.uid('r'),
          name,
          area,
          x: pt.x,
          y: pt.y
        });
        PA.canvas.render();
        PA.setDirty();
      }
    });

    setTimeout(() => {
      const input = document.getElementById('nr-name');
      if (input) { input.select(); }
    }, 60);
  }

  return { activate, deactivate, onMouseDown };
})();

'use strict';

PA.costs = (() => {

  function init() {}

  const ACABADO_PRECIOS = {
    piso:      { ninguno:0, ceramica:45000, porcelanato:85000, madera:65000, concreto:25000, vinilo:35000 },
    cieloRaso: { ninguno:0, pintura:12000,  drywall:35000,     pvc:28000 },
    pintura:   { ninguno:0, vinilo:15000,   esmalte:22000 }
  };

  function update(materials) {
    const m = materials || PA.calculator.calc();
    const p = PA.state.prices;
    const breakdown = document.getElementById('costs-breakdown');

    // Materiales
    const costBloques   = m.bloques   * p.bloque;
    const costCemento   = m.cemento   * p.cemento;
    const costArena     = m.arena     * p.arena;
    const costGravilla  = m.gravilla  * p.gravilla;
    const costVarilla3  = m.varilla3  * p.varilla3;
    const costVarilla4  = m.varilla4  * p.varilla4;
    const costMalla     = m.malla     * p.malla;
    const totalMat      = costBloques + costCemento + costArena + costGravilla + costVarilla3 + costVarilla4 + costMalla;

    // Mano de obra
    const area = m.floorArea || m.netWallArea || 0;
    const costMaestro   = area * p.maestro;
    const costOficial   = area * p.oficial;
    const costAyudante  = area * p.ayudante;
    const totalMO       = costMaestro + costOficial + costAyudante;

    // Acabados por habitación
    let totalAcabados = 0;
    const activeFloor = PA.activeFloor();
    if (activeFloor) {
      activeFloor.rooms.forEach(r => {
        const a = r.area || 0;
        if (!a) return;
        const f = r.finishes || {};
        totalAcabados += a   * (ACABADO_PRECIOS.piso[f.piso           || 'ceramica'] || 0);
        totalAcabados += a   * (ACABADO_PRECIOS.cieloRaso[f.cieloRaso || 'pintura']  || 0);
        totalAcabados += a*3 * (ACABADO_PRECIOS.pintura[f.pintura      || 'vinilo']   || 0);
      });
    }

    const subtotal      = totalMat + totalMO + totalAcabados;
    const imprevistos   = subtotal * p.imprevistos;
    const total         = subtotal + imprevistos;

    const rows = [
      { label: 'Materiales',     value: totalMat,      bold: false },
      { label: '  · Bloques',    value: costBloques,   bold: false, small: true },
      { label: '  · Cemento',    value: costCemento,   bold: false, small: true },
      { label: '  · Arena',      value: costArena,     bold: false, small: true },
      { label: '  · Gravilla',   value: costGravilla,  bold: false, small: true },
      { label: '  · Varilla #3', value: costVarilla3,  bold: false, small: true },
      { label: '  · Varilla #4', value: costVarilla4,  bold: false, small: true },
      { label: '  · Malla',      value: costMalla,     bold: false, small: true },
      { label: 'Mano de Obra',   value: totalMO,       bold: false },
      { label: '  · Maestro',    value: costMaestro,   bold: false, small: true },
      { label: '  · Oficial',    value: costOficial,   bold: false, small: true },
      { label: '  · Ayudante',   value: costAyudante,  bold: false, small: true },
      ...(totalAcabados > 0 ? [
        { label: 'Acabados',     value: totalAcabados, bold: false }
      ] : []),
      { label: 'Imprevistos (10%)', value: imprevistos, bold: false },
    ];

    breakdown.innerHTML = rows.map(r => `
      <div class="cost-row" style="${r.small ? 'opacity:0.75' : ''}">
        <span class="cost-label" style="${r.small ? 'font-size:11px' : ''}">${r.label}</span>
        <span class="cost-value" style="${r.bold ? 'font-weight:700' : ''}">${PA.formatCOP(r.value)}</span>
      </div>
    `).join('');

    document.getElementById('cost-total').textContent = PA.formatCOP(total);
  }

  /* ── Modal editar precios ───────────────────────── */
  function showPricesModal() {
    const p = PA.state.prices;
    const matRows = [
      { key: 'bloque',    label: 'Bloque 15cm (c/u)',       unit: '$/un' },
      { key: 'cemento',   label: 'Cemento 50kg (saco)',      unit: '$/saco' },
      { key: 'arena',     label: 'Arena (m³)',               unit: '$/m³' },
      { key: 'gravilla',  label: 'Gravilla (m³)',            unit: '$/m³' },
      { key: 'varilla3',  label: 'Varilla #3 barra 6m',     unit: '$/barra' },
      { key: 'varilla4',  label: 'Varilla #4 barra 6m',     unit: '$/barra' },
      { key: 'malla',     label: 'Malla electrosoldada (m²)',unit: '$/m²' },
    ];
    const moRows = [
      { key: 'maestro',   label: 'Maestro de obra',         unit: '$/m²' },
      { key: 'oficial',   label: 'Oficial',                 unit: '$/m²' },
      { key: 'ayudante',  label: 'Ayudante',                unit: '$/m²' },
    ];

    const renderRows = rows => rows.map(r => `
      <tr>
        <td>${r.label}</td>
        <td>${r.unit}</td>
        <td><input class="price-input" data-key="${r.key}" type="number" value="${p[r.key]}" min="0" step="100"></td>
      </tr>
    `).join('');

    PA.modal('Editar Precios Unitarios (COP)', `
      <table class="prices-table">
        <thead><tr><th>Material</th><th>Unidad</th><th>Precio</th></tr></thead>
        <tbody>
          <tr><td colspan="3" class="prices-section-title">Materiales</td></tr>
          ${renderRows(matRows)}
          <tr><td colspan="3" class="prices-section-title">Mano de Obra (por m² construido)</td></tr>
          ${renderRows(moRows)}
        </tbody>
      </table>
      <p style="font-size:11px;color:#64748b;margin-top:10px">Precios de referencia Colombia 2025. Ajustar según región y proveedor.</p>
    `, {
      okLabel: 'Guardar precios',
      onOk: () => {
        document.querySelectorAll('.price-input').forEach(input => {
          const key = input.dataset.key;
          const val = parseFloat(input.value);
          if (!isNaN(val) && val >= 0) p[key] = val;
        });
        update();
        PA.setDirty();
      }
    });
  }

  return { init, update, showPricesModal };
})();

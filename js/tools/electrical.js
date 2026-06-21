'use strict';

PA.tools.electrical = (() => {
  let _type    = null;
  let _preview = null;
  const SZ = 0.32; // tamaño símbolo en metros

  /* ── Catálogo ─────────────────────────────────── */
  const CATALOG = [
    { type:'toma',      label:'Toma 15A',      cat:'Tomacorrientes' },
    { type:'tomaGFCI',  label:'GFCI 20A',       cat:'Tomacorrientes' },
    { type:'toma20A',   label:'Esp. 20A',       cat:'Tomacorrientes' },
    { type:'inter1',    label:'Interruptor 1',  cat:'Interruptores'  },
    { type:'inter2',    label:'Interruptor 2',  cat:'Interruptores'  },
    { type:'lampara',   label:'Luminaria',       cat:'Iluminación'   },
    { type:'fluores',   label:'Fluorescente',    cat:'Iluminación'   },
    { type:'ventil',    label:'Ventilador',      cat:'Iluminación'   },
    { type:'extractor', label:'Extractor',       cat:'Iluminación'   },
    { type:'tablero',   label:'Tablero',         cat:'Especial'      },
    { type:'punto_tv',  label:'TV',              cat:'Datos'         },
    { type:'punto_red', label:'Red / Datos',     cat:'Datos'         },
  ];

  function getCatalog() { return CATALOG; }
  function getByType(t) { return CATALOG.find(c => c.type === t); }

  /* ── Generador SVG — funciona en canvas (metros) y catálogo (px) ── */
  function svgHTML(type, cx, cy, sz) {
    const r  = sz / 2;
    const sw = Math.max(0.012, sz * 0.075);
    const S  = n => (+n).toFixed(4);
    const C  = (ccx, ccy, cr, fill, stroke) =>
      `<circle cx="${S(ccx)}" cy="${S(ccy)}" r="${S(cr)}" fill="${fill}" stroke="${stroke}" stroke-width="${S(sw)}"/>`;
    const R  = (rx, ry, rw, rh, fill, stroke, extra = '') =>
      `<rect x="${S(rx)}" y="${S(ry)}" width="${S(rw)}" height="${S(rh)}" fill="${fill}" stroke="${stroke}" stroke-width="${S(sw)}" ${extra}/>`;
    const L  = (x1, y1, x2, y2, stroke) =>
      `<line x1="${S(x1)}" y1="${S(y1)}" x2="${S(x2)}" y2="${S(y2)}" stroke="${stroke}" stroke-width="${S(sw)}" stroke-linecap="round"/>`;
    const T  = (tx, ty, fs, content, fill) =>
      `<text x="${S(tx)}" y="${S(ty)}" font-size="${S(fs)}" font-family="system-ui,sans-serif" font-weight="700" text-anchor="middle" dominant-baseline="middle" fill="${fill}">${content}</text>`;

    switch (type) {
      case 'toma':
        return C(cx, cy, r, '#fff', '#1e293b')
          + L(cx - r * 0.55, cy, cx + r * 0.55, cy, '#1e293b')
          + L(cx - r * 0.22, cy - r * 0.46, cx - r * 0.22, cy + r * 0.46, '#1e293b')
          + L(cx + r * 0.22, cy - r * 0.46, cx + r * 0.22, cy + r * 0.46, '#1e293b');

      case 'tomaGFCI':
        return C(cx, cy, r, '#fef3c7', '#d97706')
          + T(cx, cy, r * 0.55, 'GFI', '#92400e');

      case 'toma20A':
        return C(cx, cy, r, '#f0fdf4', '#15803d')
          + T(cx, cy, r * 0.50, '20A', '#166534');

      case 'inter1':
        return C(cx, cy, r * 0.45, '#fff', '#1e293b')
          + `<path d="M${S(cx)} ${S(cy - r * 0.45)} L${S(cx + r * 0.86)} ${S(cy - r)}" fill="none" stroke="#1e293b" stroke-width="${S(sw)}" stroke-linecap="round"/>`;

      case 'inter2':
        return C(cx, cy, r * 0.45, '#fff', '#1e293b')
          + `<path d="M${S(cx)} ${S(cy - r * 0.45)} L${S(cx + r * 0.86)} ${S(cy - r)}" fill="none" stroke="#1e293b" stroke-width="${S(sw)}" stroke-linecap="round"/>`
          + `<path d="M${S(cx)} ${S(cy - r * 0.20)} L${S(cx + r * 0.68)} ${S(cy - r * 0.73)}" fill="none" stroke="#1e293b" stroke-width="${S(sw)}" stroke-linecap="round"/>`;

      case 'lampara':
        return C(cx, cy, r, '#fffbeb', '#d97706')
          + L(cx - r * 0.65, cy - r * 0.65, cx + r * 0.65, cy + r * 0.65, '#92400e')
          + L(cx + r * 0.65, cy - r * 0.65, cx - r * 0.65, cy + r * 0.65, '#92400e');

      case 'fluores':
        return R(cx - r, cy - r * 0.30, sz, r * 0.60, '#fffbeb', '#d97706')
          + L(cx - r * 0.76, cy, cx + r * 0.76, cy, '#92400e');

      case 'ventil':
        return C(cx, cy, r, '#eff6ff', '#1d4ed8')
          + C(cx, cy, r * 0.30, '#dbeafe', '#1d4ed8')
          + L(cx, cy - r, cx, cy - r * 0.30, '#1d4ed8')
          + L(cx, cy + r, cx, cy + r * 0.30, '#1d4ed8')
          + L(cx - r, cy, cx - r * 0.30, cy, '#1d4ed8')
          + L(cx + r, cy, cx + r * 0.30, cy, '#1d4ed8');

      case 'extractor':
        return C(cx, cy, r, '#faf5ff', '#7c3aed')
          + T(cx, cy, r * 0.52, 'EX', '#6d28d9');

      case 'tablero':
        return R(cx - r, cy - r, sz, sz, '#f8fafc', '#334155')
          + L(cx - r * 0.60, cy - r * 0.52, cx + r * 0.60, cy - r * 0.52, '#475569')
          + L(cx - r * 0.60, cy - r * 0.18, cx + r * 0.60, cy - r * 0.18, '#475569')
          + L(cx - r * 0.60, cy + r * 0.18, cx + r * 0.60, cy + r * 0.18, '#475569')
          + L(cx - r * 0.60, cy + r * 0.52, cx + r * 0.60, cy + r * 0.52, '#475569');

      case 'punto_tv':
        return R(cx - r * 0.88, cy - r * 0.88, r * 1.76, r * 1.76, '#fff', '#334155', 'rx="0.02"')
          + T(cx, cy, r * 0.62, 'TV', '#1e293b');

      case 'punto_red':
        return R(cx - r * 0.88, cy - r * 0.88, r * 1.76, r * 1.76, '#fff', '#334155', 'rx="0.02"')
          + T(cx, cy, r * 0.50, 'RJ45', '#1e293b');

      default:
        return C(cx, cy, r, '#f1f5f9', '#94a3b8');
    }
  }

  /* ── Tool lifecycle ──────────────────────────────── */
  function activate() {
    _type = null;
    _clearPreview();
    _renderCatalog();
  }

  function deactivate() {
    _type = null;
    _clearPreview();
    const c = document.getElementById('elec-catalog');
    if (c) c.querySelectorAll('.fcat-btn').forEach(b => b.classList.remove('selected'));
    const hint = document.getElementById('elec-hint');
    if (hint) hint.textContent = 'Selecciona un símbolo';
  }

  function _renderCatalog() {
    const container = document.getElementById('elec-catalog');
    if (!container) return;
    const cats = [...new Set(CATALOG.map(c => c.cat))];
    container.innerHTML = cats.map(cat => {
      const items = CATALOG.filter(c => c.cat === cat);
      return `<div class="fcat-section">
        <div class="fcat-title">${cat}</div>
        <div class="fcat-grid">
          ${items.map(item => `
            <button class="fcat-btn" data-etype="${item.type}" title="${item.label}">
              <svg viewBox="0 0 40 40" width="34" height="34">
                ${svgHTML(item.type, 20, 20, 32)}
              </svg>
              <span>${item.label}</span>
            </button>`).join('')}
        </div>
      </div>`;
    }).join('');

    container.querySelectorAll('.fcat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        _type = btn.dataset.etype;
        container.querySelectorAll('.fcat-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        const hint = document.getElementById('elec-hint');
        if (hint) hint.textContent = 'Clic en el plano para colocar';
      });
    });
  }

  /* ── Mouse handlers ──────────────────────────────── */
  function onMouseDown(e) {
    if (e.button !== 0 || !_type) return;
    const raw = PA.clientToWorld(e.clientX, e.clientY);
    const pt  = PA.snap(raw.x, raw.y);
    PA.saveUndo();
    const floor = PA.activeFloor();
    if (!floor.electrical) floor.electrical = [];
    floor.electrical.push({ id: PA.uid('elec'), type: _type, x: pt.x, y: pt.y, rotation: 0 });
    PA.canvas.render();
    PA.setDirty();
  }

  function onMouseMove(e) {
    if (!_type) { _clearPreview(); return; }
    const raw = PA.clientToWorld(e.clientX, e.clientY);
    const pt  = PA.snap(raw.x, raw.y);
    _drawPreview(pt);
  }

  function _drawPreview(pt) {
    _clearPreview();
    const layer = document.getElementById('preview-layer');
    const NS = 'http://www.w3.org/2000/svg';
    const g  = document.createElementNS(NS, 'g');
    g.style.opacity = '0.55';
    g.innerHTML = svgHTML(_type, pt.x, pt.y, SZ);
    layer.appendChild(g);
    _preview = g;
  }

  function _clearPreview() {
    if (_preview && _preview.parentNode) _preview.remove();
    _preview = null;
  }

  return { activate, deactivate, onMouseDown, onMouseMove, getCatalog, getByType, svgHTML, SZ };
})();

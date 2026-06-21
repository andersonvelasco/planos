'use strict';

PA.tools.furniture = (() => {
  let _type    = null;
  let _preview = null;

  /* ── Catalog ──────────────────────────────────────── */
  const CATALOG = [
    { type:'sofa',      label:'Sofá 3P',       w:1.80, h:0.80, cat:'Sala' },
    { type:'sillon',    label:'Sillón',         w:0.85, h:0.80, cat:'Sala' },
    { type:'mesacent',  label:'Mesa centro',    w:1.20, h:0.55, cat:'Sala' },
    { type:'mesa4p',    label:'Mesa comedor',   w:1.60, h:0.90, cat:'Comedor' },
    { type:'silla',     label:'Silla',          w:0.48, h:0.50, cat:'Comedor' },
    { type:'camadob',   label:'Cama doble',     w:1.40, h:1.90, cat:'Cuarto' },
    { type:'camasen',   label:'Cama sencilla',  w:0.90, h:1.90, cat:'Cuarto' },
    { type:'closet',    label:'Closet',         w:1.80, h:0.55, cat:'Cuarto' },
    { type:'nevera',    label:'Nevera',         w:0.70, h:0.70, cat:'Cocina' },
    { type:'estufa',    label:'Estufa',         w:0.60, h:0.60, cat:'Cocina' },
    { type:'meson',     label:'Mesón',          w:1.80, h:0.55, cat:'Cocina' },
    { type:'inodoro',   label:'Inodoro',        w:0.38, h:0.72, cat:'Baño' },
    { type:'lavamanos', label:'Lavamanos',      w:0.50, h:0.45, cat:'Baño' },
    { type:'ducha',     label:'Ducha',          w:0.90, h:0.90, cat:'Baño' },
    { type:'banera',    label:'Bañera',         w:0.75, h:1.70, cat:'Baño' },
    { type:'bidet',     label:'Bidé',           w:0.38, h:0.56, cat:'Baño' },
    { type:'lavadero',  label:'Lavadero',       w:0.60, h:0.55, cat:'Baño' },
    { type:'lav2sink',  label:'Doble lavamanos',w:1.00, h:0.45, cat:'Baño' },
    // ── Plantillas de baño ────────────────────────────────────
    {
      type:'bano-social', label:'Baño Social', w:1.50, h:1.50, cat:'Plantillas Baño',
      template:[
        { type:'inodoro',   dx:0.06, dy:0.06 },
        { type:'lavamanos', dx:0.56, dy:0.60 }
      ]
    },
    {
      type:'bano-ducha', label:'Baño+Ducha', w:2.00, h:2.00, cat:'Plantillas Baño',
      template:[
        { type:'inodoro',   dx:0.06, dy:0.06 },
        { type:'lavamanos', dx:0.60, dy:0.06 },
        { type:'ducha',     dx:0.55, dy:1.05 }
      ]
    },
    {
      type:'bano-completo', label:'Baño Completo', w:2.20, h:2.80, cat:'Plantillas Baño',
      template:[
        { type:'inodoro',   dx:0.06, dy:0.06 },
        { type:'lav2sink',  dx:0.70, dy:0.06 },
        { type:'banera',    dx:0.45, dy:1.00 },
        { type:'ducha',     dx:1.25, dy:1.80 }
      ]
    },
    {
      type:'bano-tina', label:'Baño con Tina', w:2.00, h:3.00, cat:'Plantillas Baño',
      template:[
        { type:'inodoro',   dx:0.06, dy:0.06 },
        { type:'lavamanos', dx:0.60, dy:0.06 },
        { type:'bidet',     dx:0.06, dy:0.84 },
        { type:'banera',    dx:0.62, dy:1.20 }
      ]
    },
  ];

  function getCatalog()      { return CATALOG; }
  function getByType(type)   { return CATALOG.find(c => c.type === type); }

  /* ── SVG symbol generator (returns HTML string) ──── */
  function _svgSymbolHTML(type, x, y, w, h) {
    const x2 = x + w, y2 = y + h;
    const mx = x + w/2, my = y + h/2;
    const sw = n => Math.max(0.012, Math.min(w, h) * n);  // stroke-width helper

    const R  = (rx,ry,rw,rh,fill,stroke,extra='') =>
      `<rect x="${rx.toFixed(4)}" y="${ry.toFixed(4)}" width="${rw.toFixed(4)}" height="${rh.toFixed(4)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw(0.04)}" ${extra}/>`;
    const C  = (cx,cy,cr,fill,stroke) =>
      `<circle cx="${cx.toFixed(4)}" cy="${cy.toFixed(4)}" r="${cr.toFixed(4)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw(0.035)}"/>`;
    const L  = (x1,y1,x2,y2,stroke) =>
      `<line x1="${x1.toFixed(4)}" y1="${y1.toFixed(4)}" x2="${x2.toFixed(4)}" y2="${y2.toFixed(4)}" stroke="${stroke}" stroke-width="${sw(0.04)}"/>`;

    switch (type) {
      case 'sofa': {
        const bh = h*0.32;
        return R(x,y,w,h,'#e2e8f0','#94a3b8')
          + R(x+w*.03,y2-bh,w*.94,bh,'#cbd5e1','#94a3b8')
          + R(x+w*.03,y+h*.02,w*.29,h-bh-h*.04,'#cbd5e1','#94a3b8')
          + R(x+w*.36,y+h*.02,w*.28,h-bh-h*.04,'#cbd5e1','#94a3b8')
          + R(x+w*.68,y+h*.02,w*.29,h-bh-h*.04,'#cbd5e1','#94a3b8');
      }
      case 'sillon': {
        return R(x,y,w,h,'#e2e8f0','#94a3b8')
          + R(x+w*.07,y+h*.02,w*.86,h*.36,'#cbd5e1','#94a3b8')
          + R(x+w*.07,y+h*.42,w*.86,h*.52,'#cbd5e1','#94a3b8');
      }
      case 'mesacent': {
        const p = Math.min(w,h)*.1;
        return R(x+p,y+p,w-2*p,h-2*p,'#fef3c7','#d97706','rx="0.03"');
      }
      case 'mesa4p': {
        const leg = Math.min(w,h)*.09;
        return R(x+leg,y+leg,w-2*leg,h-2*leg,'#fef3c7','#d97706')
          + C(x+leg,y+leg,leg,'#92400e','none')
          + C(x2-leg,y+leg,leg,'#92400e','none')
          + C(x+leg,y2-leg,leg,'#92400e','none')
          + C(x2-leg,y2-leg,leg,'#92400e','none');
      }
      case 'silla': {
        return R(x,y+h*.25,w,h*.75,'#e2e8f0','#94a3b8')
          + R(x+w*.1,y,w*.8,h*.28,'#cbd5e1','#94a3b8');
      }
      case 'camadob': {
        const hh = h*.17;
        return R(x,y,w,h,'#dbeafe','#3b82f6')
          + R(x,y,w,hh,'#1e40af','#1e3a8a')
          + R(x+w*.06,y+hh+h*.05,w*.40,h*.62,'#eff6ff','#93c5fd')
          + R(x+w*.54,y+hh+h*.05,w*.40,h*.62,'#eff6ff','#93c5fd');
      }
      case 'camasen': {
        const hh = h*.17;
        return R(x,y,w,h,'#dbeafe','#3b82f6')
          + R(x,y,w,hh,'#1e40af','#1e3a8a')
          + R(x+w*.1,y+hh+h*.05,w*.80,h*.62,'#eff6ff','#93c5fd');
      }
      case 'closet': {
        return R(x,y,w,h,'#f1f5f9','#475569')
          + L(mx,y,mx,y2,'#475569')
          + C(mx-w*.15,my,Math.min(w,h)*.06,'none','#475569')
          + C(mx+w*.15,my,Math.min(w,h)*.06,'none','#475569');
      }
      case 'nevera': {
        const sh = h*.32;
        return R(x,y,w,h,'#f1f5f9','#475569')
          + L(x,y+sh,x2,y+sh,'#475569')
          + C(x+w*.82,y+sh*.5,Math.min(w,h)*.06,'none','#64748b')
          + C(x+w*.82,y+sh+(h-sh)*.5,Math.min(w,h)*.06,'none','#64748b');
      }
      case 'estufa': {
        const cr = Math.min(w,h)*.16;
        return R(x,y,w,h,'#f1f5f9','#475569')
          + C(x+w*.28,y+h*.28,cr,'none','#475569')
          + C(x+w*.72,y+h*.28,cr,'none','#475569')
          + C(x+w*.28,y+h*.72,cr,'none','#475569')
          + C(x+w*.72,y+h*.72,cr,'none','#475569');
      }
      case 'meson': {
        return R(x,y,w,h,'#f1f5f9','#475569')
          + R(x+w*.02,y+h*.08,w*.44,h*.84,'#e2e8f0','#94a3b8')
          + C(x+w*.72,my,Math.min(w,h)*.24,'#dbeafe','#3b82f6');
      }
      case 'inodoro': {
        const th = h*.30;
        return R(x,y,w,th,'#f1f5f9','#475569','rx="0.02"')
          + `<ellipse cx="${mx.toFixed(4)}" cy="${(y+h*.66).toFixed(4)}" rx="${(w*.43).toFixed(4)}" ry="${(h*.33).toFixed(4)}" fill="#e0f2fe" stroke="#0284c7" stroke-width="${sw(0.06)}"/>`
          + `<ellipse cx="${mx.toFixed(4)}" cy="${(y+h*.66).toFixed(4)}" rx="${(w*.27).toFixed(4)}" ry="${(h*.21).toFixed(4)}" fill="white" stroke="#0284c7" stroke-width="${sw(0.04)}"/>`;
      }
      case 'lavamanos': {
        return `<ellipse cx="${mx.toFixed(4)}" cy="${my.toFixed(4)}" rx="${(w*.42).toFixed(4)}" ry="${(h*.42).toFixed(4)}" fill="#e0f2fe" stroke="#0284c7" stroke-width="${sw(0.07)}"/>`
          + C(mx,my,Math.min(w,h)*.10,'white','#0284c7');
      }
      case 'ducha': {
        return R(x,y,w,h,'#e0f2fe','#0284c7')
          + L(x,y,x2,y2,'#bae6fd')
          + L(x2,y,x,y2,'#bae6fd')
          + C(mx,my,Math.min(w,h)*.16,'#bfdbfe','#0284c7');
      }
      case 'banera': {
        return `<rect x="${x.toFixed(4)}" y="${y.toFixed(4)}" width="${w.toFixed(4)}" height="${h.toFixed(4)}" rx="${(Math.min(w,h)*.14).toFixed(4)}" fill="#e0f2fe" stroke="#0284c7" stroke-width="${sw(0.06)}"/>`
          + `<ellipse cx="${mx.toFixed(4)}" cy="${(y+h*.62).toFixed(4)}" rx="${(w*.33).toFixed(4)}" ry="${(h*.26).toFixed(4)}" fill="white" stroke="#bae6fd" stroke-width="${sw(0.04)}"/>`;
      }
      case 'bidet': {
        return `<ellipse cx="${mx.toFixed(4)}" cy="${(y+h*.55).toFixed(4)}" rx="${(w*.40).toFixed(4)}" ry="${(h*.42).toFixed(4)}" fill="#e0f2fe" stroke="#0284c7" stroke-width="${sw(0.07)}"/>`
          + R(x+w*.2,y,w*.6,h*.28,'#f1f5f9','#0284c7');
      }
      case 'lavadero': {
        return R(x,y,w,h,'#f1f5f9','#475569')
          + R(x+w*.05,y+h*.08,w*.9,h*.76,'#dbeafe','#3b82f6','rx="0.02"')
          + C(mx,y+h*.42,Math.min(w,h)*.10,'white','#0284c7')
          + L(mx-w*.18,y+h*.20,mx-w*.18,y+h*.65,'#64748b')
          + L(mx+w*.18,y+h*.20,mx+w*.18,y+h*.65,'#64748b');
      }
      case 'lav2sink': {
        const half = w*.46;
        return R(x,y,w,h,'#f1f5f9','#475569')
          + `<ellipse cx="${(x+half*.5).toFixed(4)}" cy="${my.toFixed(4)}" rx="${(half*.42).toFixed(4)}" ry="${(h*.42).toFixed(4)}" fill="#e0f2fe" stroke="#0284c7" stroke-width="${sw(0.07)}"/>`
          + `<ellipse cx="${(x+w-half*.5).toFixed(4)}" cy="${my.toFixed(4)}" rx="${(half*.42).toFixed(4)}" ry="${(h*.42).toFixed(4)}" fill="#e0f2fe" stroke="#0284c7" stroke-width="${sw(0.07)}"/>`
          + C(x+half*.5,my,Math.min(half,h)*.10,'white','#0284c7')
          + C(x+w-half*.5,my,Math.min(half,h)*.10,'white','#0284c7');
      }
      default:
        return R(x,y,w,h,'#f1f5f9','#94a3b8');
    }
  }

  /* ── Tool lifecycle ───────────────────────────────── */
  function activate() {
    _type = null;
    _clearPreview();
    _renderCatalog();
  }

  function deactivate() {
    _type = null;
    _clearPreview();
    const panel = document.getElementById('furn-catalog');
    if (panel) panel.querySelectorAll('.fcat-btn').forEach(b => b.classList.remove('selected'));
    const hint = document.getElementById('furn-hint');
    if (hint) hint.textContent = 'Selecciona un mueble';
  }

  function _templatePreviewHTML(item) {
    if (!item.template) return _svgSymbolHTML(item.type, 1, 1, 38, 38);
    const scale = 36 / Math.max(item.w, item.h);
    return item.template.map(t => {
      const base = getByType(t.type);
      if (!base) return '';
      const ix = 1 + t.dx * scale;
      const iy = 1 + t.dy * scale;
      return _svgSymbolHTML(t.type, ix, iy, base.w * scale, base.h * scale);
    }).join('');
  }

  function _renderCatalog() {
    const container = document.getElementById('furn-catalog');
    if (!container) return;
    const cats = [...new Set(CATALOG.map(c => c.cat))];
    container.innerHTML = cats.map(cat => {
      const items = CATALOG.filter(c => c.cat === cat);
      return `<div class="fcat-section">
        <div class="fcat-title">${cat}</div>
        <div class="fcat-grid">
          ${items.map(item => `
            <button class="fcat-btn" data-ftype="${item.type}" title="${item.label} · ${item.w}×${item.h}m">
              <svg viewBox="0 0 40 40" width="34" height="34">
                ${_templatePreviewHTML(item)}
              </svg>
              <span>${item.label}</span>
            </button>`).join('')}
        </div>
      </div>`;
    }).join('');

    container.querySelectorAll('.fcat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        _type = btn.dataset.ftype;
        container.querySelectorAll('.fcat-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        const hint = document.getElementById('furn-hint');
        if (hint) hint.textContent = 'Haz clic en el plano para colocar';
      });
    });
  }

  /* ── Mouse handlers ───────────────────────────────── */
  function onMouseDown(e) {
    if (e.button !== 0 || !_type) return;
    const raw = PA.clientToWorld(e.clientX, e.clientY);
    const pt  = PA.snap(raw.x, raw.y);
    const cat = getByType(_type);
    if (!cat) return;

    PA.saveUndo();
    const floor = PA.activeFloor();
    if (!floor.furniture) floor.furniture = [];

    if (cat.template) {
      // Place all items in the template layout
      cat.template.forEach(t => {
        const base = getByType(t.type);
        if (!base) return;
        floor.furniture.push({
          id:       PA.uid('furn'),
          type:     t.type,
          x:        pt.x + (t.dx || 0),
          y:        pt.y + (t.dy || 0),
          w:        base.w,
          h:        base.h,
          rotation: t.rot || 0,
          label:    base.label
        });
      });
    } else {
      floor.furniture.push({
        id:       PA.uid('furn'),
        type:     _type,
        x:        pt.x,
        y:        pt.y,
        w:        cat.w,
        h:        cat.h,
        rotation: 0,
        label:    cat.label
      });
    }
    PA.canvas.render();
    PA.setDirty();
  }

  function onMouseMove(e) {
    if (!_type) { _clearPreview(); return; }
    const raw = PA.clientToWorld(e.clientX, e.clientY);
    const pt  = PA.snap(raw.x, raw.y);
    const cat = getByType(_type);
    if (!cat) return;
    _drawPreview(pt, cat);
  }

  function _drawPreview(pt, cat) {
    _clearPreview();
    const layer = document.getElementById('preview-layer');
    const NS = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('transform', `translate(${pt.x},${pt.y})`);
    g.style.opacity = '0.55';

    if (cat.template) {
      g.innerHTML = cat.template.map(t => {
        const base = getByType(t.type);
        if (!base) return '';
        return `<g transform="translate(${t.dx||0},${t.dy||0})">${_svgSymbolHTML(t.type, 0, 0, base.w, base.h)}</g>`;
      }).join('');
    } else {
      g.setAttribute('transform', `translate(${pt.x},${pt.y}) translate(${-cat.w/2},${-cat.h/2})`);
      g.innerHTML = _svgSymbolHTML(cat.type, 0, 0, cat.w, cat.h);
    }

    layer.appendChild(g);
    _preview = g;
  }

  function _clearPreview() {
    if (_preview && _preview.parentNode) _preview.remove();
    _preview = null;
  }

  return { activate, deactivate, onMouseDown, onMouseMove, getCatalog, getByType, _svgSymbolHTML };
})();

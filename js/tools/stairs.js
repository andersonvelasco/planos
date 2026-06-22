'use strict';

PA.tools.stairs = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  let _pt1  = null;
  let _shape = 'straight';

  function activate() {
    _pt1 = null;
    _clearPreview();
    const shEl = document.getElementById('stairs-shape');
    if (shEl) {
      _shape = shEl.value;
      const _toggleURunW = () => {
        const lbl = document.getElementById('stairs-u-runw-lbl');
        if (lbl) lbl.classList.toggle('hidden', _shape !== 'u');
      };
      _toggleURunW();
      shEl.onchange = () => { _shape = shEl.value; _toggleURunW(); };
    }
  }
  function deactivate() { _pt1 = null; _clearPreview(); }
  function _clearPreview() { document.getElementById('preview-layer').innerHTML = ''; }

  function svgEl(tag, attrs) {
    const el = document.createElementNS(NS, tag);
    Object.entries(attrs || {}).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  }

  function onMouseDown(e) {
    if (e.button !== 0) return;
    const raw = PA.clientToWorld(e.clientX, e.clientY);
    const pt  = PA.snap(raw.x, raw.y);

    if (!_pt1) {
      _pt1 = pt;
    } else {
      const w = Math.abs(pt.x - _pt1.x);
      const h = Math.abs(pt.y - _pt1.y);
      if (w < 0.3 || h < 0.3) { _clearPreview(); return; }

      const steps = PA.state.stairsSteps || 10;
      const horiz = w >= h;
      const shape = _shape || 'straight';
      const uRunW = PA.state.stairsURunW || 0.30;

      PA.saveUndo();
      PA.activeFloor().stairs.push({
        id:    PA.uid('st'),
        x1:    Math.min(_pt1.x, pt.x),
        y1:    Math.min(_pt1.y, pt.y),
        x2:    Math.max(_pt1.x, pt.x),
        y2:    Math.max(_pt1.y, pt.y),
        steps,
        horiz,
        direction: 'up',
        shape,
        uRunW
      });
      _pt1 = null;
      _clearPreview();
      PA.canvas.render();
      PA.setDirty();
    }
  }

  function onMouseMove(e) {
    if (!_pt1) return;
    _clearPreview();
    const raw = PA.clientToWorld(e.clientX, e.clientY);
    const pt  = PA.snap(raw.x, raw.y);
    _drawPreview(_pt1, pt);
  }

  /* ── Preview ──────────────────────────────────── */
  function _drawPreview(a, b) {
    const layer = document.getElementById('preview-layer');
    const x1 = Math.min(a.x, b.x), y1 = Math.min(a.y, b.y);
    const x2 = Math.max(a.x, b.x), y2 = Math.max(a.y, b.y);
    const w = x2-x1, h = y2-y1;
    if (w < 0.01 || h < 0.01) return;

    const steps = PA.state.stairsSteps || 10;
    const shape = _shape || 'straight';
    const uRunW = PA.state.stairsURunW || 0.30;

    _drawShape(layer, x1, y1, x2, y2, w, h, steps, shape, '#6366f1', 'rgba(99,102,241,0.08)', 'rgba(99,102,241,0.20)', uRunW);

    const lbl = document.createElementNS(NS, 'text');
    lbl.setAttribute('x', (x1+x2)/2); lbl.setAttribute('y', y1 - 0.1);
    lbl.setAttribute('text-anchor', 'middle'); lbl.setAttribute('fill', '#6366f1');
    lbl.setAttribute('font-size', '0.22'); lbl.setAttribute('font-family', 'system-ui,sans-serif');
    lbl.textContent = _shapeLabel(shape, steps, w, h);
    layer.appendChild(lbl);

    layer.appendChild(svgEl('circle', { cx:a.x, cy:a.y, r:0.07, fill:'#6366f1', stroke:'#fff', 'stroke-width':0.025 }));
  }

  function _shapeLabel(shape, steps, w, h) {
    if (shape === 'l-right' || shape === 'l-left') return `Escal. en L · ${steps} peld.`;
    if (shape === 'u') return `Escal. en U · ${steps} peld.`;
    return `${steps} peld. · ${w.toFixed(2)}×${h.toFixed(2)}m`;
  }

  /* ── Shape drawing (used by preview and floors.js) ── */
  function _drawShape(layer, x1, y1, x2, y2, w, h, steps, shape, color, fill, landFill, uRunW = 0.30) {
    const sw = 0.022;

    function R(rx,ry,rw,rh,f,stroke,extra) {
      const el = svgEl('rect', { x:rx,y:ry,width:rw,height:rh,fill:f,stroke:stroke||color,'stroke-width':sw });
      if (extra) Object.entries(extra).forEach(([k,v]) => el.setAttribute(k,v));
      layer.appendChild(el);
    }
    function L(x1,y1,x2,y2,lw) {
      layer.appendChild(svgEl('line', { x1,y1,x2,y2,stroke:color,'stroke-width':lw||0.014,opacity:0.7 }));
    }
    function arrowV(cx, from, to, tipSz) {
      const dir = to < from ? 1 : -1;  // 1 = up (y decreases)
      layer.appendChild(svgEl('line', { x1:cx,y1:from,x2:cx,y2:to, stroke:color,'stroke-width':0.020 }));
      layer.appendChild(svgEl('line', { x1:cx-tipSz,y1:to+tipSz*dir,x2:cx,y2:to, stroke:color,'stroke-width':0.020 }));
      layer.appendChild(svgEl('line', { x1:cx+tipSz,y1:to+tipSz*dir,x2:cx,y2:to, stroke:color,'stroke-width':0.020 }));
    }
    function arrowH(cy, from, to, tipSz) {
      const dir = to < from ? 1 : -1;  // direction toward 'to'
      layer.appendChild(svgEl('line', { x1:from,y1:cy,x2:to,y2:cy, stroke:color,'stroke-width':0.020 }));
      layer.appendChild(svgEl('line', { x1:to+tipSz*dir,y1:cy-tipSz,x2:to,y2:cy, stroke:color,'stroke-width':0.020 }));
      layer.appendChild(svgEl('line', { x1:to+tipSz*dir,y1:cy+tipSz,x2:to,y2:cy, stroke:color,'stroke-width':0.020 }));
    }
    function stepsH(rx1,ry1,rx2,ry2,n) {
      const iw = (rx2-rx1)/n;
      for (let i=1;i<n;i++) L(rx1+i*iw,ry1,rx1+i*iw,ry2);
    }
    function stepsV(rx1,ry1,rx2,ry2,n) {
      const ih = (ry2-ry1)/n;
      for (let i=1;i<n;i++) L(rx1,ry1+i*ih,rx2,ry1+i*ih);
    }

    if (shape === 'straight') {
      R(x1,y1,w,h,fill);
      if (w >= h) stepsH(x1,y1,x2,y2,steps);
      else        stepsV(x1,y1,x2,y2,steps);

    } else if (shape === 'l-right') {
      // Run 1 (bottom, horizontal): goes from left toward right
      const rh = h * 0.42, rw = w * 0.42;
      const r1w = w - rw, r1y = y2 - rh;
      const steps1 = Math.ceil(steps/2), steps2 = Math.floor(steps/2);
      R(x1, r1y, r1w, rh, fill);
      stepsH(x1, r1y, x1+r1w, y2, steps1);
      arrowH((r1y+y2)/2, x1+r1w*0.15, x1+r1w*0.72, rh*0.18);
      // Run 2 (right, vertical): goes from bottom toward top
      R(x1+r1w, y1, rw, h-rh, fill);
      stepsV(x1+r1w, y1, x2, r1y, steps2);
      arrowV(x1+r1w+rw/2, r1y-h*0.06, y1+h*0.10, rw*0.18);
      // Landing corner
      R(x1+r1w, r1y, rw, rh, landFill);
      const lt = document.createElementNS(NS, 'text');
      lt.setAttribute('x', x1+r1w+rw/2); lt.setAttribute('y', r1y+rh*0.60);
      lt.setAttribute('text-anchor','middle'); lt.setAttribute('fill',color);
      lt.setAttribute('font-size','0.15'); lt.setAttribute('font-family','system-ui,sans-serif');
      lt.textContent = 'DESCANSO'; layer.appendChild(lt);

    } else if (shape === 'l-left') {
      // Run 1 (bottom, horizontal): goes from right toward left
      const rh = h * 0.42, rw = w * 0.42;
      const r1x = x1 + rw, r1y = y2 - rh;
      const r1w = w - rw;
      const steps1 = Math.ceil(steps/2), steps2 = Math.floor(steps/2);
      R(r1x, r1y, r1w, rh, fill);
      stepsH(r1x, r1y, x2, y2, steps1);
      arrowH((r1y+y2)/2, x2-r1w*0.15, r1x+r1w*0.25, rh*0.18);
      // Run 2 (left, vertical): goes from bottom toward top
      R(x1, y1, rw, h-rh, fill);
      stepsV(x1, y1, r1x, r1y, steps2);
      arrowV(x1+rw/2, r1y-h*0.06, y1+h*0.10, rw*0.18);
      // Landing corner
      R(x1, r1y, rw, rh, landFill);
      const lt = document.createElementNS(NS, 'text');
      lt.setAttribute('x', x1+rw/2); lt.setAttribute('y', r1y+rh*0.60);
      lt.setAttribute('text-anchor','middle'); lt.setAttribute('fill',color);
      lt.setAttribute('font-size','0.15'); lt.setAttribute('font-family','system-ui,sans-serif');
      lt.textContent = 'DESCANSO'; layer.appendChild(lt);

    } else if (shape === 'u') {
      const rw = w * uRunW, lh = h * 0.18;
      const steps1 = Math.ceil(steps/2), steps2 = Math.floor(steps/2);
      // Landing at top
      R(x1, y1, w, lh, landFill);
      const lt = document.createElementNS(NS, 'text');
      lt.setAttribute('x', (x1+x2)/2); lt.setAttribute('y', y1+lh*0.70);
      lt.setAttribute('text-anchor','middle'); lt.setAttribute('fill',color);
      lt.setAttribute('font-size','0.15'); lt.setAttribute('font-family','system-ui,sans-serif');
      lt.textContent = 'DESCANSO'; layer.appendChild(lt);
      // Left run (steps going toward landing)
      R(x1, y1+lh, rw, h-lh, fill);
      stepsV(x1, y1+lh, x1+rw, y2, steps1);
      arrowV(x1+rw/2, y2-h*0.08, y1+lh+h*0.12, rw*0.20);
      // Right run
      R(x2-rw, y1+lh, rw, h-lh, fill);
      stepsV(x2-rw, y1+lh, x2, y2, steps2);
      arrowV(x2-rw/2, y2-h*0.08, y1+lh+h*0.12, rw*0.20);
      // Void center (dashed)
      const vEl = svgEl('rect', { x:x1+rw,y:y1+lh,width:w-2*rw,height:h-lh, fill:'rgba(248,250,252,0.4)', stroke:color,'stroke-width':0.014 });
      vEl.setAttribute('stroke-dasharray','0.08 0.04');
      layer.appendChild(vEl);
    }
  }

  return { activate, deactivate, onMouseDown, onMouseMove, _drawShape };
})();

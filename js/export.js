'use strict';

PA.export = (() => {

  function toPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const W = 210, H = 297;
    const MARGIN = 15;

    /* ── Page 1: Plano ────────────────────────────── */
    drawPlanPage(doc, W, H, MARGIN);

    /* ── Page 2: Materiales y Costos ─────────────── */
    doc.addPage();
    drawBudgetPage(doc, W, H, MARGIN);

    /* ── Save ─────────────────────────────────────── */
    const filename = (PA.state.projectName || 'plano').replace(/\s+/g, '_') + '.pdf';
    doc.save(filename);
  }

  /* ── Plano ─────────────────────────────────────── */
  function drawPlanPage(doc, W, H, M) {
    const floor = PA.activeFloor();
    const name  = PA.state.projectName;
    const now   = new Date().toLocaleDateString('es-CO', { year:'numeric', month:'long', day:'numeric' });

    // Header band
    doc.setFillColor(30, 42, 58);
    doc.rect(0, 0, W, 18, 'F');
    doc.setFontSize(14); doc.setTextColor(255,255,255); doc.setFont('helvetica','bold');
    doc.text(name, M, 11);
    doc.setFontSize(9); doc.setFont('helvetica','normal');
    doc.text('Plano Arquitectónico · ' + floor.name, M, 16);
    doc.setFontSize(8); doc.setTextColor(180,180,180);
    doc.text(now, W - M, 11, { align:'right' });

    // Drawing area
    const DA_X = M, DA_Y = 22, DA_W = W - M * 2, DA_H = H - 22 - M - 25;

    doc.setDrawColor(220, 224, 230);
    doc.setLineWidth(0.3);
    doc.rect(DA_X, DA_Y, DA_W, DA_H);

    // Calculate bounding box of walls
    if (floor.walls.length === 0) {
      doc.setFontSize(11); doc.setTextColor(150,150,150);
      doc.text('Sin elementos dibujados', DA_X + DA_W / 2, DA_Y + DA_H / 2, { align: 'center' });
    } else {
      drawFloorOnPDF(doc, floor, DA_X, DA_Y, DA_W, DA_H);
    }

    // Footer
    doc.setFillColor(248, 250, 252);
    doc.rect(0, H - 22, W, 22, 'F');
    doc.setDrawColor(220, 224, 230); doc.setLineWidth(0.2);
    doc.line(0, H - 22, W, H - 22);

    doc.setFontSize(8); doc.setTextColor(100, 116, 139); doc.setFont('helvetica','normal');
    doc.text('Generado con PlanoApp', M, H - 13);
    doc.text('Escala: 1:' + getScaleLabel(floor, DA_W, DA_H), W / 2, H - 13, { align: 'center' });
    doc.text('Página 1 de 2', W - M, H - 13, { align: 'right' });

    // North arrow
    const NX = DA_X + DA_W - 8, NY = DA_Y + 8;
    doc.setDrawColor(30,42,58); doc.setLineWidth(0.4);
    doc.line(NX, NY + 4, NX, NY - 4);
    doc.setFillColor(30,42,58);
    doc.triangle(NX - 2, NY, NX, NY - 5, NX + 2, NY, 'F');
    doc.setFontSize(7); doc.setTextColor(30,42,58); doc.setFont('helvetica','bold');
    doc.text('N', NX, NY + 7, { align: 'center' });
  }

  function drawFloorOnPDF(doc, floor, dx, dy, dw, dh) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    floor.walls.forEach(w => {
      minX = Math.min(minX, w.x1, w.x2); maxX = Math.max(maxX, w.x1, w.x2);
      minY = Math.min(minY, w.y1, w.y2); maxY = Math.max(maxY, w.y1, w.y2);
    });

    const PAD = 8;
    const rangeX = maxX - minX || 1, rangeY = maxY - minY || 1;
    const scaleX = (dw - PAD * 2) / rangeX;
    const scaleY = (dh - PAD * 2) / rangeY;
    const scale  = Math.min(scaleX, scaleY);

    const offX = dx + PAD + (dw - PAD * 2 - rangeX * scale) / 2 - minX * scale;
    const offY = dy + PAD + (dh - PAD * 2 - rangeY * scale) / 2 - minY * scale;

    const toX = x => offX + x * scale;
    const toY = y => offY + y * scale;
    const toD = d => d * scale;

    // Walls
    doc.setFillColor(45, 55, 72);
    doc.setDrawColor(45, 55, 72);
    floor.walls.forEach(w => {
      const dx2 = w.x2 - w.x1, dy2 = w.y2 - w.y1;
      const len = Math.hypot(dx2, dy2);
      if (len < 0.01) return;
      const nx = -dy2 / len * w.thickness / 2;
      const ny =  dx2 / len * w.thickness / 2;
      const pts = [
        [toX(w.x1 + nx), toY(w.y1 + ny)],
        [toX(w.x2 + nx), toY(w.y2 + ny)],
        [toX(w.x2 - nx), toY(w.y2 - ny)],
        [toX(w.x1 - nx), toY(w.y1 - ny)]
      ];
      doc.setLineWidth(0.1);
      doc.polygon(pts, 'F');
    });

    // Opening masks (doors/windows)
    doc.setFillColor(255, 255, 255);
    [...floor.doors, ...floor.windows].forEach(op => {
      const wall = floor.walls.find(w => w.id === op.wallId);
      if (!wall) return;
      const wdx = wall.x2 - wall.x1, wdy = wall.y2 - wall.y1;
      const wlen = Math.hypot(wdx, wdy);
      const ux = wdx / wlen, uy = wdy / wlen;
      const nx = -uy, ny = ux;
      const t = wall.thickness / 2 + 0.02;
      const cx = wall.x1 + wdx * op.t, cy = wall.y1 + wdy * op.t;
      const hw = op.width / 2;
      const oPts = [
        [toX(cx + ux * hw + nx * t), toY(cy + uy * hw + ny * t)],
        [toX(cx - ux * hw + nx * t), toY(cy - uy * hw + ny * t)],
        [toX(cx - ux * hw - nx * t), toY(cy - uy * hw - ny * t)],
        [toX(cx + ux * hw - nx * t), toY(cy + uy * hw - ny * t)]
      ];
      doc.polygon(oPts, 'F');
    });

    // Doors (arc)
    doc.setDrawColor(146, 64, 14); doc.setLineWidth(0.2);
    floor.doors.forEach(door => {
      const wall = floor.walls.find(w => w.id === door.wallId);
      if (!wall) return;
      const wdx = wall.x2 - wall.x1, wdy = wall.y2 - wall.y1;
      const wlen = Math.hypot(wdx, wdy);
      const ux = wdx / wlen, uy = wdy / wlen;
      const nx = -uy, ny = ux;
      const cx = wall.x1 + wdx * door.t, cy = wall.y1 + wdy * door.t;
      const hw = door.width / 2;
      const hx = toX(cx - ux * hw), hy = toY(cy - uy * hw);
      const ex = toX(cx - ux * hw + nx * door.width), ey = toY(cy - uy * hw + ny * door.width);
      const r  = toD(door.width);
      doc.setLineDashPattern([0.5, 0.3], 0);
      doc.ellipse((hx + ex) / 2, (hy + ey) / 2, r / 2, r / 2, 'S');
      doc.setLineDashPattern([], 0);
      doc.line(hx, hy, ex, ey);
    });

    // Windows
    doc.setDrawColor(30, 64, 175); doc.setLineWidth(0.3);
    floor.windows.forEach(win => {
      const wall = floor.walls.find(w => w.id === win.wallId);
      if (!wall) return;
      const wdx = wall.x2 - wall.x1, wdy = wall.y2 - wall.y1;
      const wlen = Math.hypot(wdx, wdy);
      const ux = wdx / wlen, uy = wdy / wlen;
      const nx = -uy, ny = ux;
      const t = wall.thickness / 2 * 0.5;
      const cx = wall.x1 + wdx * win.t, cy = wall.y1 + wdy * win.t;
      const hw = win.width / 2;
      doc.line(toX(cx-ux*hw+nx*t), toY(cy-uy*hw+ny*t), toX(cx+ux*hw+nx*t), toY(cy+uy*hw+ny*t));
      doc.line(toX(cx-ux*hw-nx*t), toY(cy-uy*hw-ny*t), toX(cx+ux*hw-nx*t), toY(cy+uy*hw-ny*t));
    });

    // Room labels
    doc.setTextColor(30, 64, 175); doc.setFontSize(6); doc.setFont('helvetica','bold');
    floor.rooms.forEach(r => {
      doc.text(r.name, toX(r.x), toY(r.y) - 1.5, { align:'center' });
      if (r.area) {
        doc.setFont('helvetica','normal'); doc.setFontSize(5); doc.setTextColor(100,116,139);
        doc.text(r.area.toFixed(1) + ' m²', toX(r.x), toY(r.y) + 2, { align:'center' });
        doc.setFont('helvetica','bold'); doc.setFontSize(6); doc.setTextColor(30,64,175);
      }
    });

    // Dimensions
    doc.setDrawColor(220, 38, 38); doc.setTextColor(220,38,38); doc.setLineWidth(0.15);
    doc.setFontSize(5); doc.setFont('helvetica','bold');
    floor.dimensions.forEach(dim => {
      const wdx = dim.x2 - dim.x1, wdy = dim.y2 - dim.y1;
      const wlen = Math.hypot(wdx, wdy);
      if (wlen < 0.01) return;
      const nx = -wdy / wlen, ny = wdx / wlen;
      const off = dim.offset || 0.5;
      const ax = toX(dim.x1 + nx * off), ay = toY(dim.y1 + ny * off);
      const bx = toX(dim.x2 + nx * off), by = toY(dim.y2 + ny * off);
      doc.line(ax, ay, bx, by);
      doc.line(toX(dim.x1), toY(dim.y1), ax, ay);
      doc.line(toX(dim.x2), toY(dim.y2), bx, by);
      doc.text(wlen.toFixed(2) + 'm', (ax+bx)/2, (ay+by)/2 - 1, { align:'center' });
    });
  }

  function getScaleLabel(floor, dw, dh) {
    if (!floor || floor.walls.length === 0) return '?';
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    floor.walls.forEach(w => {
      minX=Math.min(minX,w.x1,w.x2); maxX=Math.max(maxX,w.x1,w.x2);
      minY=Math.min(minY,w.y1,w.y2); maxY=Math.max(maxY,w.y1,w.y2);
    });
    const rangeX=maxX-minX||1, rangeY=maxY-minY||1;
    const scale=Math.min((dw-16)/rangeX, (dh-16)/rangeY);
    // scale is mm/m, we want 1:X
    const ratio = Math.round(1000 / scale / 10) * 10;
    return ratio.toString();
  }

  /* ── Budget page ─────────────────────────────────── */
  function drawBudgetPage(doc, W, H, M) {
    const m = PA.calculator.calc();
    const p = PA.state.prices;
    const now = new Date().toLocaleDateString('es-CO', { year:'numeric', month:'long', day:'numeric' });

    // Header
    doc.setFillColor(30, 42, 58);
    doc.rect(0, 0, W, 18, 'F');
    doc.setFontSize(14); doc.setTextColor(255,255,255); doc.setFont('helvetica','bold');
    doc.text(PA.state.projectName, M, 11);
    doc.setFontSize(9); doc.setFont('helvetica','normal');
    doc.text('Presupuesto Estimado de Materiales y Mano de Obra', M, 16);
    doc.setFontSize(8); doc.setTextColor(180,180,180);
    doc.text(now, W - M, 11, { align:'right' });

    let Y = 26;

    // Summary boxes
    const boxes = [
      { label: 'Long. Paredes', value: m.totalWallLength + ' m', color: [59,130,246] },
      { label: 'Área Paredes', value: m.netWallArea + ' m²', color: [16,185,129] },
      { label: 'Área de Pisos', value: m.floorArea + ' m²', color: [245,158,11] },
      { label: 'Columnas Est.', value: m.numColumnas + ' col.', color: [139,92,246] }
    ];
    const BW = (W - M * 2 - 9) / 4;
    boxes.forEach((b, i) => {
      const bx = M + i * (BW + 3);
      doc.setFillColor(...b.color);
      doc.roundedRect(bx, Y, BW, 14, 2, 2, 'F');
      doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(255,255,255);
      doc.text(b.label, bx + BW/2, Y + 5, { align:'center' });
      doc.setFontSize(10); doc.setFont('helvetica','bold');
      doc.text(b.value, bx + BW/2, Y + 11, { align:'center' });
    });
    Y += 20;

    // Materials table
    tableSection(doc, M, Y, W - M*2, 'MATERIALES DE CONSTRUCCIÓN', [
      ['Material', 'Cantidad', 'Unidad', 'Precio Unit.', 'Total'],
      ['Bloque 15×20×40', m.bloques, 'un', PA.formatCOP(p.bloque), PA.formatCOP(m.bloques*p.bloque)],
      ['Cemento (50 kg)', m.cemento, 'sacos', PA.formatCOP(p.cemento), PA.formatCOP(m.cemento*p.cemento)],
      ['Arena de pega', m.arena, 'm³', PA.formatCOP(p.arena), PA.formatCOP(m.arena*p.arena)],
      ['Gravilla', m.gravilla, 'm³', PA.formatCOP(p.gravilla), PA.formatCOP(m.gravilla*p.gravilla)],
      ['Varilla #3 (3/8")', m.varilla3, 'barras', PA.formatCOP(p.varilla3), PA.formatCOP(m.varilla3*p.varilla3)],
      ['Varilla #4 (1/2")', m.varilla4, 'barras', PA.formatCOP(p.varilla4), PA.formatCOP(m.varilla4*p.varilla4)],
      ['Malla electrosoldada', m.malla, 'm²', PA.formatCOP(p.malla), PA.formatCOP(m.malla*p.malla)],
    ], doc);

    const totalMat = m.bloques*p.bloque + m.cemento*p.cemento + m.arena*p.arena + m.gravilla*p.gravilla + m.varilla3*p.varilla3 + m.varilla4*p.varilla4 + m.malla*p.malla;
    Y = doc.lastAutoTable ? doc.lastAutoTable.finalY + 8 : Y + 60;

    // Labor table
    const area = m.floorArea || m.netWallArea || 0;
    tableSection(doc, M, Y, W - M*2, 'MANO DE OBRA (por m² construido)', [
      ['Categoría', 'Área', 'Precio/m²', 'Total'],
      ['Maestro de obra', area + ' m²', PA.formatCOP(p.maestro), PA.formatCOP(area*p.maestro)],
      ['Oficial de construcción', area + ' m²', PA.formatCOP(p.oficial), PA.formatCOP(area*p.oficial)],
      ['Ayudante', area + ' m²', PA.formatCOP(p.ayudante), PA.formatCOP(area*p.ayudante)],
    ], doc);

    const totalMO = area * (p.maestro + p.oficial + p.ayudante);
    const subtotal = totalMat + totalMO;
    const imprevistos = subtotal * p.imprevistos;
    const total = subtotal + imprevistos;

    Y = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : Y + 40;

    // Total box
    doc.setFillColor(30, 42, 58);
    doc.roundedRect(M, Y, W - M*2, 24, 3, 3, 'F');
    doc.setFontSize(9); doc.setTextColor(148,163,184); doc.setFont('helvetica','normal');
    doc.text('Materiales: ' + PA.formatCOP(totalMat), M + 8, Y + 8);
    doc.text('Mano de obra: ' + PA.formatCOP(totalMO), M + 8, Y + 15);
    doc.text('Imprevistos (10%): ' + PA.formatCOP(imprevistos), W - M - 8, Y + 8, { align:'right' });
    doc.setFontSize(14); doc.setTextColor(52, 211, 153); doc.setFont('helvetica','bold');
    doc.text('TOTAL: ' + PA.formatCOP(total), W - M - 8, Y + 18, { align:'right' });

    // Footer
    doc.setFontSize(7); doc.setTextColor(150,150,150); doc.setFont('helvetica','normal');
    doc.text('* Estimado referencial. Precios de referencia Colombia 2025. Ajustar según región y proveedor.', M, H - 10);
    doc.text('Generado con PlanoApp · Página 2 de 2', W - M, H - 10, { align:'right' });
  }

  function tableSection(doc, x, y, w, title, rows, docRef) {
    doc.setFillColor(59, 130, 246);
    doc.rect(x, y, w, 7, 'F');
    doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255);
    doc.text(title, x + 4, y + 5);

    const headerRow = rows[0];
    const dataRows  = rows.slice(1);
    const colW = w / headerRow.length;

    let ry = y + 7;
    // Header
    doc.setFillColor(241,245,249); doc.rect(x, ry, w, 6, 'F');
    doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(71,85,105);
    headerRow.forEach((h, i) => {
      doc.text(String(h), x + i * colW + 3, ry + 4.5);
    });
    ry += 6;

    // Data
    dataRows.forEach((row, ri) => {
      if (ri % 2 === 0) { doc.setFillColor(248,250,252); doc.rect(x, ry, w, 6, 'F'); }
      doc.setFont('helvetica','normal'); doc.setTextColor(30,41,59);
      row.forEach((cell, i) => {
        const align = i >= 2 ? 'right' : 'left';
        const cx = align === 'right' ? x + (i+1)*colW - 3 : x + i*colW + 3;
        doc.text(String(cell), cx, ry + 4.5, { align });
      });
      ry += 6;
    });

    doc.setDrawColor(226,232,240); doc.setLineWidth(0.1);
    doc.rect(x, y + 7, w, ry - y - 7);
    if (!docRef.lastAutoTable) docRef.lastAutoTable = {};
    docRef.lastAutoTable.finalY = ry;
  }

  return { toPDF };
})();

// ============================================================
//  TTGPlus — Sales Analytics  |  sales-analytics-export.js
// ============================================================

const fmtB   = n => '฿' + Number(n||0).toLocaleString('th-TH',{maximumFractionDigits:0});
const fmtN   = n => Number(n||0).toLocaleString('th-TH');
const fmtPct = n => Number(n||0).toFixed(2) + '%';

function safeFileName(str) {
  return String(str||'report').replace(/[^a-zA-Z0-9ก-๙\-_]/g,'_').slice(0,50);
}

// ─── Build nested report object (required by export functions) ─
// _saCurrentReport is stored flat — this wraps it for SAExport
function buildExportReport(r) {
  return {
    summary: {
      totalRevenue  : r.totalRevenue  || 0,
      totalGross    : r.totalGross    || 0,
      totalDiscount : r.totalDiscount || 0,
      discountRate  : r.discountRate  || 0,
      totalQty      : r.totalQty      || 0,
      productCount  : r.productCount  || 0,
      branchCount   : r.branchCount   || 0,
    },
    byBranch    : r.byBranch    || [],
    byCategory  : r.byCategory  || [],
    topProducts : r.topProducts || [],
    fileName    : r.fileName    || '',
    period      : r.period      || '',
  };
}

// ─── Export Excel ─────────────────────────────────────────────
function exportToExcel(report, showCodes=false) {
  // accept both flat and nested
  const s  = report.summary || report;
  const wb = XLSX.utils.book_new();

  // Sheet 1: Summary
  const summaryData = [
    ['TTGPlus — รายงานยอดขาย'],
    ['ไฟล์ต้นฉบับ', report.fileName||''],
    ['งวด', report.period||''],
    ['สร้างเมื่อ', new Date().toLocaleString('th-TH')],
    [],
    ['สรุปภาพรวม'],
    ['ยอดขายสุทธิ', s.totalRevenue],
    ['ยอดก่อนหักส่วนลด', s.totalGross||0],
    ['ส่วนลดรวม', s.totalDiscount],
    ['อัตราส่วนลด', fmtPct(s.discountRate)],
    ['จำนวนรายการ', s.totalQty],
    ['สินค้า (ไม่ซ้ำ)', s.productCount],
    ['จำนวนสาขา', s.branchCount],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
  ws1['!cols'] = [{wch:24},{wch:18}];
  XLSX.utils.book_append_sheet(wb, ws1, 'สรุป');

  // Sheet 2: By Branch
  const byBranch = report.byBranch || [];
  if (byBranch.length) {
    const ws2 = XLSX.utils.aoa_to_sheet([
      ['สาขา','ยอดขาย (฿)','จำนวน','สัดส่วน %'],
      ...byBranch.map(b=>[b.branch, b.revenue, b.qty, s.totalRevenue>0?fmtPct(b.revenue/s.totalRevenue*100):'0%'])
    ]);
    ws2['!cols'] = [{wch:28},{wch:16},{wch:12},{wch:12}];
    XLSX.utils.book_append_sheet(wb, ws2, 'ยอดขายตามสาขา');
  }

  // Sheet 3: By Category
  const byCategory = report.byCategory || [];
  if (byCategory.length) {
    const ws3 = XLSX.utils.aoa_to_sheet([
      ['หมวดสินค้า','ยอดขาย (฿)','จำนวน','สัดส่วน %'],
      ...byCategory.map(c=>[c.category, c.revenue, c.qty, s.totalRevenue>0?fmtPct(c.revenue/s.totalRevenue*100):'0%'])
    ]);
    ws3['!cols'] = [{wch:28},{wch:16},{wch:12},{wch:12}];
    XLSX.utils.book_append_sheet(wb, ws3, 'ยอดขายตามหมวด');
  }

  // Sheet 4: Top Products
  const topProducts = report.topProducts || [];
  if (topProducts.length) {
    const header = showCodes
      ? ['รหัส/ชื่อเต็ม','ชื่อสินค้า','หมวด','ยอดขาย (฿)','จำนวน','ราคาเฉลี่ย']
      : ['ชื่อสินค้า','หมวด','ยอดขาย (฿)','จำนวน','ราคาเฉลี่ย'];
    const rows = topProducts.map(p => showCodes
      ? [p.rawName||p.name, p.name, p.category, p.revenue, p.qty, p.avgPrice]
      : [p.name, p.category, p.revenue, p.qty, p.avgPrice]
    );
    const ws4 = XLSX.utils.aoa_to_sheet([header,...rows]);
    ws4['!cols'] = showCodes
      ? [{wch:36},{wch:28},{wch:22},{wch:16},{wch:10},{wch:12}]
      : [{wch:36},{wch:22},{wch:16},{wch:10},{wch:12}];
    XLSX.utils.book_append_sheet(wb, ws4, 'สินค้าขายดี');
  }

  // Sheet 5: Trend (byDate if present)
  const byDate = report.byDate || [];
  if (byDate.length) {
    const ws5 = XLSX.utils.aoa_to_sheet([
      ['วันที่','ยอดขาย (฿)','จำนวน'],
      ...byDate.map(d=>[d.date, d.revenue, d.qty||0])
    ]);
    ws5['!cols'] = [{wch:16},{wch:16},{wch:12}];
    XLSX.utils.book_append_sheet(wb, ws5, 'ยอดขายรายวัน');
  }

  // Sheet 6: Bill breakdown (if present)
  const byOrderType = report.byOrderType || [];
  if (byOrderType.length) {
    const ws6 = XLSX.utils.aoa_to_sheet([
      ['ประเภทการสั่ง','ยอดขาย (฿)','จำนวน'],
      ...byOrderType.map(x=>[x.type, x.revenue, x.qty])
    ]);
    XLSX.utils.book_append_sheet(wb, ws6, 'ช่องทางการสั่ง');
  }

  // Sheet 7: Promo (if present)
  const byPromo = report.byPromo || [];
  if (byPromo.length) {
    const ws7 = XLSX.utils.aoa_to_sheet([
      ['ชื่อโปรโมชั่น','ประเภท','จำนวนใช้','ส่วนลด (฿)','สาขา'],
      ...byPromo.map(p=>[p.promoName, p.promoType, p.usageCount, p.discountAmt, p.branches])
    ]);
    ws7['!cols'] = [{wch:40},{wch:16},{wch:12},{wch:14},{wch:10}];
    XLSX.utils.book_append_sheet(wb, ws7, 'โปรโมชั่น');
  }

  const name = safeFileName(report.period || report.fileName || 'sales_report');
  XLSX.writeFile(wb, `TTGPlus_Sales_${name}.xlsx`);
}

// ─── Export PDF ───────────────────────────────────────────────
function exportToPDF(report) {
  const s = report.summary || report;
  const now = new Date().toLocaleString('th-TH');

  const branchRows = (report.byBranch||[]).map((b,i)=>`
    <tr><td>${i+1}</td><td>${b.branch}</td><td class="num">${fmtB(b.revenue)}</td><td class="num">${fmtN(b.qty)}</td>
    <td class="num">${s.totalRevenue>0?fmtPct(b.revenue/s.totalRevenue*100):'—'}</td></tr>`).join('');

  const catRows = (report.byCategory||[]).slice(0,10).map((c,i)=>`
    <tr><td>${i+1}</td><td>${c.category}</td><td class="num">${fmtB(c.revenue)}</td><td class="num">${fmtN(c.qty)}</td>
    <td class="num">${s.totalRevenue>0?fmtPct(c.revenue/s.totalRevenue*100):'—'}</td></tr>`).join('');

  const topRows = (report.topProducts||[]).slice(0,20).map((p,i)=>`
    <tr><td>${i+1}</td><td>${p.name}</td><td>${p.category}</td>
    <td class="num">${fmtB(p.revenue)}</td><td class="num">${fmtN(p.qty)}</td><td class="num">${fmtB(p.avgPrice)}</td></tr>`).join('');

  const html = `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">
<title>TTGPlus Sales Report</title>
<style>
  @page{size:A4;margin:18mm 16mm}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Sarabun','TH Sarabun New',sans-serif;font-size:11pt;color:#1e1c1a}
  .header{border-bottom:2px solid #252423;padding-bottom:10px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-end}
  .header h1{font-size:18pt;font-weight:700}
  .header .meta{font-size:9pt;color:#605e5c;text-align:right}
  .kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}
  .kpi{border:1px solid #e1dfdd;padding:10px 12px}
  .kpi-label{font-size:8.5pt;color:#605e5c;border-left:3px solid #f0b429;padding-left:6px}
  .kpi-value{font-size:15pt;font-weight:300;margin:4px 0 2px}
  section{margin-bottom:20px}
  h2{font-size:12pt;font-weight:700;border-left:3px solid #f0b429;padding-left:8px;margin-bottom:10px}
  table{width:100%;border-collapse:collapse;font-size:9.5pt}
  th{background:#f3f2f1;padding:5px 8px;text-align:left;border-bottom:2px solid #f0b429;font-weight:600}
  td{padding:4px 8px;border-bottom:0.5px solid #e1dfdd}
  tr:nth-child(even) td{background:#faf9f8}
  .num{text-align:right}
  .footer{border-top:1px solid #e1dfdd;margin-top:20px;padding-top:8px;font-size:8pt;color:#8a8886;text-align:center}
</style></head><body>
<div class="header">
  <div><h1>TingTing — รายงานยอดขาย</h1>
  <div style="font-size:10pt;margin-top:4px">${report.period||report.fileName||''}</div></div>
  <div class="meta">สร้างโดย TTGPlus<br>${now}</div>
</div>
<div class="kpi-row">
  <div class="kpi"><div class="kpi-label">ยอดขายสุทธิ</div><div class="kpi-value">${fmtB(s.totalRevenue)}</div></div>
  <div class="kpi"><div class="kpi-label">รายการขาย</div><div class="kpi-value">${fmtN(s.totalQty)}</div></div>
  <div class="kpi"><div class="kpi-label">สินค้า</div><div class="kpi-value">${fmtN(s.productCount)}</div></div>
  <div class="kpi"><div class="kpi-label">ส่วนลดรวม</div><div class="kpi-value">${fmtB(s.totalDiscount)}</div></div>
</div>
${branchRows?`<section><h2>ยอดขายตามสาขา</h2><table><thead><tr><th>#</th><th>สาขา</th><th class="num">ยอดขาย</th><th class="num">จำนวน</th><th class="num">%</th></tr></thead><tbody>${branchRows}</tbody></table></section>`:''}
${catRows?`<section><h2>ยอดขายตามหมวดสินค้า (Top 10)</h2><table><thead><tr><th>#</th><th>หมวด</th><th class="num">ยอดขาย</th><th class="num">จำนวน</th><th class="num">%</th></tr></thead><tbody>${catRows}</tbody></table></section>`:''}
${topRows?`<section><h2>สินค้าขายดี Top 20</h2><table><thead><tr><th>#</th><th>สินค้า</th><th>หมวด</th><th class="num">ยอดขาย</th><th class="num">จำนวน</th><th class="num">ราคาเฉลี่ย</th></tr></thead><tbody>${topRows}</tbody></table></section>`:''}
<div class="footer">TTGPlus — TingTing Group | Generated ${now}</div>
</body></html>`;

  const win = window.open('','_blank');
  if (!win) { alert('กรุณาอนุญาต popup เพื่อ Export PDF'); return; }
  win.document.write(html);
  win.document.close();
  win.onload = () => { win.focus(); win.print(); };
}

window.SAExport = { exportToExcel, exportToPDF, buildExportReport };

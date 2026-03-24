// ============================================================
//  TTGPlus — Sales Analytics Module
//  sales-analytics-export.js  (PDF + Excel export)
// ============================================================

// ─── Helpers ──────────────────────────────────────────────────
const fmtB  = n => '฿' + Number(n).toLocaleString('th-TH', { maximumFractionDigits: 0 });
const fmtN  = n => Number(n).toLocaleString('th-TH');
const fmtPct = n => Number(n).toFixed(2) + '%';

function safeFileName(str) {
  return str.replace(/[^a-zA-Z0-9ก-๙\-_]/g, '_').slice(0, 50);
}

// ─── Export to Excel (.xlsx) ──────────────────────────────────
function exportToExcel(report, showCodes = false) {
  const wb = XLSX.utils.book_new();
  const { summary, byBranch, byCategory, topProducts, fileName, period } = report;

  // ── Sheet 1: Summary ──
  const summaryData = [
    ['TTGPlus — รายงานยอดขายตามสินค้า'],
    ['ไฟล์ต้นฉบับ', fileName || ''],
    ['งวด', period || ''],
    ['สร้างเมื่อ', new Date().toLocaleString('th-TH')],
    [],
    ['สรุปภาพรวม'],
    ['ยอดขายสุทธิ', summary.totalRevenue],
    ['ยอดก่อนหักส่วนลด', summary.totalGross || 0],
    ['ส่วนลดรวม', summary.totalDiscount],
    ['อัตราส่วนลด', fmtPct(summary.discountRate)],
    ['จำนวนรายการขาย', summary.totalQty],
    ['สินค้า (ไม่ซ้ำ)', summary.productCount],
    ['จำนวนสาขา', summary.branchCount],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
  ws1['!cols'] = [{ wch: 24 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'สรุป');

  // ── Sheet 2: By Branch ──
  const branchData = [
    ['สาขา', 'ยอดขาย (฿)', 'จำนวนรายการ', 'สัดส่วน %'],
    ...byBranch.map(b => [
      b.branch,
      b.revenue,
      b.qty,
      fmtPct(b.revenue / summary.totalRevenue * 100)
    ])
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(branchData);
  ws2['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'ยอดขายตามสาขา');

  // ── Sheet 3: By Category ──
  const catData = [
    ['หมวดสินค้า', 'ยอดขาย (฿)', 'จำนวนรายการ', 'สัดส่วน %'],
    ...byCategory.map(c => [
      c.category,
      c.revenue,
      c.qty,
      fmtPct(c.revenue / summary.totalRevenue * 100)
    ])
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(catData);
  ws3['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws3, 'ยอดขายตามหมวด');

  // ── Sheet 4: Top Products ──
  const prodHeader = showCodes
    ? ['รหัส/ชื่อเต็ม', 'ชื่อสินค้า', 'หมวด', 'ยอดขาย (฿)', 'จำนวน', 'ราคาเฉลี่ย']
    : ['ชื่อสินค้า', 'หมวด', 'ยอดขาย (฿)', 'จำนวน', 'ราคาเฉลี่ย'];
  const prodRows = topProducts.map(p => showCodes
    ? [p.rawName || p.name, p.name, p.category, p.revenue, p.qty, p.avgPrice]
    : [p.name, p.category, p.revenue, p.qty, p.avgPrice]
  );
  const ws4 = XLSX.utils.aoa_to_sheet([prodHeader, ...prodRows]);
  ws4['!cols'] = showCodes
    ? [{ wch: 36 }, { wch: 28 }, { wch: 22 }, { wch: 16 }, { wch: 12 }, { wch: 14 }]
    : [{ wch: 36 }, { wch: 22 }, { wch: 16 }, { wch: 12 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws4, 'สินค้าขายดี');

  const name = safeFileName((period || fileName || 'sales_report'));
  XLSX.writeFile(wb, `TTGPlus_Sales_${name}.xlsx`);
}

// ─── Export to PDF (via browser print) ───────────────────────
function exportToPDF(report) {
  const { summary, byBranch, byCategory, topProducts, fileName, period } = report;
  const now = new Date().toLocaleString('th-TH');

  const branchRows = byBranch.map((b, i) => `
    <tr>
      <td>${i+1}</td>
      <td>${b.branch}</td>
      <td class="num">${fmtB(b.revenue)}</td>
      <td class="num">${fmtN(b.qty)}</td>
      <td class="num">${fmtPct(b.revenue / summary.totalRevenue * 100)}</td>
    </tr>`).join('');

  const catRows = byCategory.slice(0,10).map((c, i) => `
    <tr>
      <td>${i+1}</td>
      <td>${c.category}</td>
      <td class="num">${fmtB(c.revenue)}</td>
      <td class="num">${fmtN(c.qty)}</td>
      <td class="num">${fmtPct(c.revenue / summary.totalRevenue * 100)}</td>
    </tr>`).join('');

  const topRows = topProducts.slice(0,20).map((p, i) => `
    <tr>
      <td>${i+1}</td>
      <td>${p.name}</td>
      <td>${p.category}</td>
      <td class="num">${fmtB(p.revenue)}</td>
      <td class="num">${fmtN(p.qty)}</td>
      <td class="num">${fmtB(p.avgPrice)}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>TTGPlus Sales Report</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Sarabun', 'TH Sarabun New', 'Angsana New', sans-serif; font-size: 11pt; color: #1e1c1a; }
  .header { border-bottom: 2px solid #1e1c1a; padding-bottom: 10px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
  .header h1 { font-size: 18pt; font-weight: 700; }
  .header .meta { font-size: 9pt; color: #5F5E5A; text-align: right; }
  .kpi-row { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-bottom: 20px; }
  .kpi { border: 1px solid #D3D1C7; border-radius: 6px; padding: 10px 12px; }
  .kpi-label { font-size: 8.5pt; color: #5F5E5A; }
  .kpi-value { font-size: 15pt; font-weight: 700; margin: 4px 0 2px; }
  .kpi-sub { font-size: 8pt; color: #888780; }
  section { margin-bottom: 20px; }
  h2 { font-size: 12pt; font-weight: 700; border-left: 3px solid #EF9F27; padding-left: 8px; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  th { background: #F1EFE8; padding: 5px 8px; text-align: left; border-bottom: 1px solid #D3D1C7; font-weight: 600; }
  td { padding: 4px 8px; border-bottom: 0.5px solid #D3D1C7; }
  tr:nth-child(even) td { background: #fafaf8; }
  .num { text-align: right; }
  .footer { border-top: 1px solid #D3D1C7; margin-top: 20px; padding-top: 8px; font-size: 8pt; color: #888780; text-align: center; }
</style>
</head>
<body>
<div class="header">
  <div>
    <h1>TingTing — รายงานยอดขาย</h1>
    <div style="font-size:10pt;margin-top:4px">${period || fileName || ''}</div>
  </div>
  <div class="meta">สร้างโดย TTGPlus<br>${now}</div>
</div>

<div class="kpi-row">
  <div class="kpi">
    <div class="kpi-label">ยอดขายสุทธิ</div>
    <div class="kpi-value">${fmtB(summary.totalRevenue)}</div>
    <div class="kpi-sub">ก่อนลด ${fmtB(summary.totalGross || 0)}</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">รายการขายรวม</div>
    <div class="kpi-value">${fmtN(summary.totalQty)}</div>
    <div class="kpi-sub">รายการ</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">สินค้า</div>
    <div class="kpi-value">${fmtN(summary.productCount)}</div>
    <div class="kpi-sub">${summary.branchCount} สาขา</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">ส่วนลดรวม</div>
    <div class="kpi-value">${fmtB(summary.totalDiscount)}</div>
    <div class="kpi-sub">${fmtPct(summary.discountRate)}</div>
  </div>
</div>

<section>
  <h2>ยอดขายตามสาขา</h2>
  <table>
    <thead><tr><th>#</th><th>สาขา</th><th class="num">ยอดขาย</th><th class="num">จำนวน</th><th class="num">%</th></tr></thead>
    <tbody>${branchRows}</tbody>
  </table>
</section>

<section>
  <h2>ยอดขายตามหมวดสินค้า (Top 10)</h2>
  <table>
    <thead><tr><th>#</th><th>หมวด</th><th class="num">ยอดขาย</th><th class="num">จำนวน</th><th class="num">%</th></tr></thead>
    <tbody>${catRows}</tbody>
  </table>
</section>

<section>
  <h2>สินค้าขายดี Top 20</h2>
  <table>
    <thead><tr><th>#</th><th>สินค้า</th><th>หมวด</th><th class="num">ยอดขาย</th><th class="num">จำนวน</th><th class="num">ราคาเฉลี่ย</th></tr></thead>
    <tbody>${topRows}</tbody>
  </table>
</section>

<div class="footer">TTGPlus — TingTing Group &nbsp;|&nbsp; Generated ${now}</div>
</body></html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.onload = () => { win.focus(); win.print(); };
}

// ─── Exports ──────────────────────────────────────────────────
window.SAExport = { exportToExcel, exportToPDF };

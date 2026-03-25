// ============================================================
//  TTGPlus — Sales Analytics Loader  (v3 — multi-file)
//  แก้เฉพาะไฟล์นี้ ไม่กระทบ home.html หรือ module อื่น
// ============================================================

window.openSalesAnalytics = async function() {
  if (typeof XLSX === 'undefined')           await _saLoadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
  if (typeof Chart === 'undefined')          await _saLoadScript('https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js');
  if (typeof window.SA === 'undefined')      await _saLoadScript('sales-analytics.js');
  if (typeof window.SACharts === 'undefined') await _saLoadScript('sales-analytics-charts.js');
  if (typeof window.SAExport === 'undefined') await _saLoadScript('sales-analytics-export.js');

  document.getElementById('dashboardView')?.classList.add('hidden');
  const container = document.getElementById('toolAppContainer');
  container.classList.remove('hidden');
  container.innerHTML = _buildSAHTML();
  _initSAEvents();

  if (location.hash !== '#sales-analytics')
    history.pushState({ nav: 'sales-analytics' }, '', '#sales-analytics');
};

function _saLoadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) { setTimeout(res, 80); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => setTimeout(res, 80);
    s.onerror = rej;
    document.head.appendChild(s);
  });
}

// ─── Global state ─────────────────────────────────────────────
window._saState = {
  showCodes    : false,
  productMode  : 'revenue',
  trendMode    : 'totalRevenue',
  savedReports : [],
  compareSet   : new Set(),
  filterBranch : new Set(),
  filterCat    : new Set(),
  filterSearch : '',
  // multi-file state
  uploadedFiles: [],   // [{ fileName, type, label, rows, summary }]
  activeFileIdx: null, // index ของไฟล์ที่กำลังแสดง
};

// ─── Report type detection ────────────────────────────────────
const SA_REPORT_TYPES = [
  { id:'product',  label:'ยอดขายตามสินค้า',  icon:'🛍',  keywords:['ชื่อสินค้า','สินค้า','product','item','หมวดสินค้า'] },
  { id:'branch',   label:'ยอดขายตามสาขา',    icon:'🏪',  keywords:['สาขา','branch','store','outlet'] },
  { id:'daily',    label:'ยอดขายรายวัน',      icon:'📅',  keywords:['วันที่','date','วัน','daily'] },
  { id:'monthly',  label:'ยอดขายรายเดือน',    icon:'📆',  keywords:['เดือน','month','monthly'] },
  { id:'category', label:'ยอดขายตามหมวด',     icon:'🏷',  keywords:['หมวด','category','group','กลุ่ม'] },
  { id:'bill',     label:'ยอดขายตามบิล',      icon:'🧾',  keywords:['บิล','bill','receipt','เลขบิล','invoice'] },
];

function _saDetectReportType(headers) {
  const h = headers.map(x => String(x).toLowerCase());
  let best = null, bestScore = 0;
  for (const type of SA_REPORT_TYPES) {
    const score = type.keywords.filter(k => h.some(hh => hh.includes(k))).length;
    if (score > bestScore) { bestScore = score; best = type; }
  }
  return best || { id:'unknown', label:'ไม่ทราบประเภท', icon:'📄', keywords:[] };
}

// ─── Build HTML ───────────────────────────────────────────────
function _buildSAHTML() {
  return `
<style>
.sa-kpi-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:20px;}
.sa-kpi{background:#f8fafc;border-radius:10px;padding:14px 16px;border:1px solid #eef1f6;cursor:pointer;transition:.15s;}
.sa-kpi:hover{background:#f1f5f9;}.sa-kpi.active{background:#fffbeb;border-color:#f0b429;}
.sa-kpi-label{font-size:10px;color:#94a3b8;margin-bottom:5px;text-transform:uppercase;letter-spacing:.6px;font-weight:700;}
.sa-kpi-value{font-size:22px;font-weight:700;color:#0f172a;line-height:1.2;}
.sa-kpi-sub{font-size:11px;color:#94a3b8;margin-top:3px;}
.sa-card{background:white;border-radius:14px;padding:18px 20px;border:1px solid #eef1f6;box-shadow:0 1px 4px rgba(0,0,0,.05);}
.sa-card-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:#94a3b8;margin-bottom:14px;}
.sa-grid-2{display:grid;grid-template-columns:2fr 1fr;gap:14px;margin-bottom:14px;}
.sa-grid-1{margin-bottom:14px;}
/* filter bar */
.sa-filter-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:12px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:16px;}
.sa-filter-label{font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-right:4px;}
.sa-chip{display:inline-flex;align-items:center;gap:4px;padding:4px 12px;border-radius:20px;border:1px solid #e2e8f0;background:white;font-size:12px;cursor:pointer;transition:.15s;font-family:inherit;color:#475569;font-weight:500;}
.sa-chip:hover{border-color:#f0b429;color:#0f172a;}.sa-chip.active{background:#f0b429;border-color:#f0b429;color:#0f172a;font-weight:700;}
.sa-filter-divider{width:1px;height:20px;background:#e2e8f0;}
.sa-filter-summary{font-size:12px;color:#64748b;margin-left:auto;}
.sa-filter-clear{font-size:12px;color:#ef4444;cursor:pointer;padding:4px 8px;border-radius:6px;border:1px solid #fca5a5;background:white;font-family:inherit;}
.sa-filter-clear:hover{background:#fef2f2;}
/* tabs & buttons */
.sa-tab-bar{display:flex;gap:4px;}
.sa-tab{font-size:12px;padding:5px 14px;border-radius:8px;border:1px solid #e2e8f0;cursor:pointer;background:transparent;color:#64748b;font-family:inherit;transition:.15s;}
.sa-tab:hover{background:#f8fafc;}.sa-tab.active{background:#f8fafc;color:#0f172a;font-weight:600;border-color:#cbd5e1;}
.sa-btn{display:inline-flex;align-items:center;gap:6px;font-size:12px;padding:7px 14px;border-radius:9px;border:1px solid #e2e8f0;cursor:pointer;background:white;color:#334155;font-family:inherit;font-weight:500;transition:.15s;}
.sa-btn:hover{background:#f8fafc;border-color:#cbd5e1;}
.sa-btn.primary{background:linear-gradient(135deg,#f0b429,#d97706);color:#0f172a;border:none;font-weight:700;}
.sa-btn.danger{color:#ef4444;border-color:#fca5a5;}
/* upload */
.sa-upload-zone{border:2px dashed #e2e8f0;border-radius:14px;padding:32px 24px;text-align:center;cursor:pointer;transition:.2s;}
.sa-upload-zone:hover,.sa-upload-zone.drag-over{border-color:#f0b429;background:#fffbeb;}
.sa-progress-bar{height:5px;background:#f1f5f9;border-radius:3px;overflow:hidden;margin-top:10px;}
.sa-progress-fill{height:100%;background:linear-gradient(90deg,#f0b429,#3b82f6);border-radius:3px;transition:width .3s;}
.sa-status{font-size:12px;color:#64748b;margin-top:6px;}
/* table */
.sa-table-wrap{overflow-x:auto;}
.sa-table{width:100%;border-collapse:collapse;font-size:12px;}
.sa-table th{font-weight:600;color:#64748b;padding:8px 10px;border-bottom:1.5px solid #e8ecf0;text-align:left;background:#f8fafc;white-space:nowrap;}
.sa-table td{padding:6px 10px;border-bottom:1px solid #f4f6fa;color:#1e293b;vertical-align:middle;}
.sa-table tr:hover td{background:#f8fafc;}
.sa-table .num{text-align:right;font-variant-numeric:tabular-nums;}
.sa-table .rank{color:#94a3b8;width:28px;}
.sa-badge{display:inline-block;font-size:10px;font-weight:600;padding:2px 8px;border-radius:10px;white-space:nowrap;}
.sa-bh{background:#fef3c7;color:#92400e;}.sa-bb{background:#dbeafe;color:#1d4ed8;}
.sa-bp{background:#ede9fe;color:#5b21b6;}.sa-bt{background:#d1fae5;color:#065f46;}
.sa-bf{background:#fee2e2;color:#991b1b;}.sa-bc{background:#fce7f3;color:#9d174d;}
.sa-bg{background:#f1f5f9;color:#475569;}
/* donut */
.sa-donut-wrap{display:flex;align-items:center;gap:14px;}
.sa-donut-center{position:relative;flex-shrink:0;}
.sa-donut-label{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;pointer-events:none;}
.sa-donut-label-top{font-size:9px;color:#94a3b8;}
.sa-donut-label-val{font-size:12px;font-weight:700;color:#0f172a;}
.sa-leg-item{display:flex;align-items:center;gap:6px;margin-bottom:6px;cursor:pointer;padding:3px 6px;border-radius:6px;transition:.12s;}
.sa-leg-item:hover{background:#f8fafc;}.sa-leg-item.active{background:#fffbeb;}
.sa-leg-dot{width:9px;height:9px;border-radius:2px;flex-shrink:0;}
.sa-leg-name{font-size:12px;color:#64748b;flex:1;}
.sa-leg-val{font-size:12px;color:#0f172a;font-weight:600;}
.sa-leg-pct{font-size:11px;color:#94a3b8;width:38px;text-align:right;}
/* history */
.sa-report-item{display:flex;align-items:center;gap:10px;padding:11px 14px;border:1px solid #e8ecf0;border-radius:10px;margin-bottom:7px;cursor:pointer;transition:.15s;background:white;}
.sa-report-item:hover{background:#f8fafc;border-color:#cbd5e1;}.sa-report-item.active{border-color:#f0b429;background:#fffbeb;}
/* view tabs */
.sa-view-tabs{display:flex;gap:3px;background:#f1f5f9;padding:3px;border-radius:9px;}
.sa-view-tab{padding:5px 16px;font-size:12px;border-radius:7px;cursor:pointer;border:none;background:transparent;color:#64748b;font-family:inherit;transition:.15s;font-weight:500;}
.sa-view-tab.active{background:white;color:#0f172a;font-weight:600;box-shadow:0 1px 3px rgba(0,0,0,.07);}
/* toggle */
.sa-toggle-wrap{display:flex;align-items:center;gap:7px;font-size:12px;color:#64748b;}
.sa-toggle{position:relative;width:34px;height:18px;flex-shrink:0;}
.sa-toggle input{opacity:0;width:0;height:0;position:absolute;}
.sa-toggle-track{position:absolute;inset:0;background:#e2e8f0;border-radius:9px;transition:.2s;cursor:pointer;}
.sa-toggle input:checked+.sa-toggle-track{background:#f0b429;}
.sa-toggle-thumb{position:absolute;top:2px;left:2px;width:14px;height:14px;background:white;border-radius:50%;transition:.2s;pointer-events:none;}
.sa-toggle input:checked~.sa-toggle-thumb{transform:translateX(16px);}
/* ── Multi-file file tabs ── */
.sa-file-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;align-items:center;}
.sa-file-tab{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:22px;border:1.5px solid #e2e8f0;background:white;font-size:12px;cursor:pointer;transition:.15s;font-family:inherit;color:#475569;font-weight:500;position:relative;}
.sa-file-tab:hover{border-color:#94a3b8;color:#0f172a;}
.sa-file-tab.active{border-color:#f0b429;background:#fffbeb;color:#92400e;font-weight:700;}
.sa-file-tab .sa-file-tab-remove{font-size:10px;color:#94a3b8;margin-left:4px;line-height:1;background:none;border:none;cursor:pointer;padding:0;font-family:inherit;}
.sa-file-tab .sa-file-tab-remove:hover{color:#ef4444;}
.sa-file-tab-add{padding:6px 12px;border-radius:22px;border:1.5px dashed #e2e8f0;background:transparent;font-size:12px;cursor:pointer;color:#94a3b8;font-family:inherit;transition:.15s;}
.sa-file-tab-add:hover{border-color:#f0b429;color:#f0b429;}
/* ── Type badge ── */
.sa-type-badge{display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;padding:3px 9px;border-radius:10px;background:#f1f5f9;color:#475569;}
/* ── Overview cross-file ── */
.sa-overview-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;margin-bottom:16px;}
.sa-overview-card{background:white;border:1px solid #eef1f6;border-radius:12px;padding:14px 16px;cursor:pointer;transition:.15s;position:relative;overflow:hidden;}
.sa-overview-card:hover{box-shadow:0 4px 16px rgba(0,0,0,.08);transform:translateY(-1px);}
.sa-overview-card.active{border-color:#f0b429;background:#fffbeb;}
.sa-overview-card-icon{font-size:24px;margin-bottom:8px;}
.sa-overview-card-type{font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;}
.sa-overview-card-name{font-size:13px;font-weight:600;color:#0f172a;margin-bottom:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.sa-overview-card-val{font-size:18px;font-weight:700;color:#0f172a;}
.sa-overview-card-sub{font-size:11px;color:#94a3b8;margin-top:2px;}
@media(max-width:900px){.sa-grid-2{grid-template-columns:1fr;}.sa-kpi-grid{grid-template-columns:1fr 1fr;}}
</style>

<div style="padding:24px 28px;" id="saWrap">
  <!-- Page Header -->
  <div class="tool-header" style="border-bottom:1px solid #e2e8f0;padding-bottom:16px;margin-bottom:20px;">
    <div>
      <h2 style="font-size:18px;font-weight:800;color:#0f172a;">📊 Sales Analytics</h2>
      <div style="font-size:12px;color:#94a3b8;margin-top:2px;">วิเคราะห์ยอดขาย • TingTing Group</div>
    </div>
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
      <div class="sa-toggle-wrap">
        <label class="sa-toggle">
          <input type="checkbox" id="sa-toggle-codes">
          <div class="sa-toggle-track"></div>
          <div class="sa-toggle-thumb"></div>
        </label>
        แสดงรหัสสินค้า
      </div>
      <div class="sa-view-tabs">
        <button class="sa-view-tab active" onclick="_saView('dashboard')" id="sa-tab-dashboard">Dashboard</button>
        <button class="sa-view-tab"        onclick="_saView('history')"   id="sa-tab-history">ประวัติ</button>
        <button class="sa-view-tab"        onclick="_saView('compare')"   id="sa-tab-compare">เปรียบเทียบ</button>
      </div>
      <button class="sa-btn" onclick="closeTool()" style="padding:6px 12px;color:#ef4444;border-color:#fca5a5;">✕ ปิด</button>
    </div>
  </div>

  <!-- ══ VIEW: Dashboard ══ -->
  <div id="sa-view-dashboard">

    <!-- Upload card -->
    <div class="sa-card" style="margin-bottom:16px;" id="sa-upload-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
        <div class="sa-card-title" style="margin-bottom:0;">อัปโหลดรายงาน Excel</div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <input type="text" id="sa-period-input" placeholder="งวด เช่น ม.ค. 2568"
            style="font-size:12px;padding:6px 11px;border:1px solid #e2e8f0;border-radius:8px;width:140px;font-family:inherit;outline:none;">
          <label class="sa-btn primary" for="sa-file-input">⬆ เลือกไฟล์ (หลายไฟล์ได้)</label>
          <input type="file" id="sa-file-input" accept=".xlsx,.xls,.csv" multiple style="display:none;">
        </div>
      </div>
      <!-- Drop zone -->
      <div id="sa-drop-zone" class="sa-upload-zone">
        <div style="font-size:32px;margin-bottom:8px;">📂</div>
        <div style="font-size:14px;font-weight:600;margin-bottom:4px;">ลากหลายไฟล์มาวางพร้อมกันได้เลย</div>
        <div style="font-size:12px;color:#94a3b8;">รองรับ .xlsx, .xls, .csv &nbsp;•&nbsp; ระบบจะ detect ประเภท report อัตโนมัติ</div>
      </div>
      <div id="sa-upload-progress" style="display:none;">
        <div class="sa-progress-bar"><div class="sa-progress-fill" id="sa-progress-fill" style="width:0%"></div></div>
        <div class="sa-status" id="sa-status-text">กำลังอ่านไฟล์...</div>
      </div>
    </div>

    <!-- Dashboard content (hidden until data loaded) -->
    <div id="sa-dashboard-content" style="display:none;">

      <!-- ── File tabs (multi-file) ── -->
      <div id="sa-file-tab-bar" class="sa-file-tabs" style="display:none;"></div>

      <!-- Overview grid (shown when multiple files) -->
      <div id="sa-overview-section" style="display:none;">
        <div class="sa-card" style="margin-bottom:14px;">
          <div class="sa-card-title">ภาพรวมทุก Report</div>
          <div class="sa-overview-grid" id="sa-overview-grid"></div>
        </div>
      </div>

      <!-- Current report bar -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;gap:10px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:20px;" id="sa-report-icon">📋</span>
          <div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <div style="font-weight:700;font-size:14px;" id="sa-report-name">—</div>
              <span class="sa-type-badge" id="sa-report-type-badge"></span>
            </div>
            <div style="font-size:11px;color:#94a3b8;margin-top:2px;" id="sa-report-meta">—</div>
          </div>
        </div>
        <div style="display:flex;gap:7px;flex-wrap:wrap;">
          <button class="sa-btn" onclick="_saExportExcel()">📥 Export Excel</button>
          <button class="sa-btn" onclick="_saExportPDF()">🖨 Export PDF</button>
          <button class="sa-btn primary" onclick="_saSaveReport()">💾 บันทึก</button>
          <button class="sa-btn danger"  onclick="_saClearDashboard()">✕ ล้างทั้งหมด</button>
        </div>
      </div>

      <!-- KPI -->
      <div id="sa-kpi-container"></div>

      <!-- Filter bar -->
      <div class="sa-filter-bar" id="sa-filter-bar" style="display:none;">
        <span class="sa-filter-label">🔍 Filter</span>
        <div id="sa-filter-branches" style="display:flex;gap:6px;flex-wrap:wrap;"></div>
        <div class="sa-filter-divider" id="sa-filter-div" style="display:none;"></div>
        <div id="sa-filter-cats" style="display:flex;gap:6px;flex-wrap:wrap;"></div>
        <button class="sa-filter-clear" onclick="_saFilterClear()">✕ ล้าง</button>
        <span class="sa-filter-summary" id="sa-filter-summary"></span>
      </div>

      <!-- Charts -->
      <div class="sa-grid-2">
        <div class="sa-card">
          <div class="sa-card-title" id="sa-chart-branch-title">ยอดขายตามสาขา</div>
          <div style="position:relative;height:250px;"><canvas id="sa-branch-chart"></canvas></div>
        </div>
        <div class="sa-card">
          <div class="sa-card-title">หมวดสินค้า</div>
          <div class="sa-donut-wrap">
            <div class="sa-donut-center">
              <canvas id="sa-cat-chart" width="120" height="120"></canvas>
              <div class="sa-donut-label">
                <div class="sa-donut-label-top">รวม</div>
                <div class="sa-donut-label-val" id="sa-donut-total">—</div>
              </div>
            </div>
            <div id="sa-cat-legend" style="flex:1;"></div>
          </div>
        </div>
      </div>

      <!-- Top Products -->
      <div class="sa-card sa-grid-1">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
          <div class="sa-card-title" style="margin-bottom:0;" id="sa-top-chart-title">สินค้าขายดี Top 15</div>
          <div class="sa-tab-bar">
            <button class="sa-tab active" onclick="_saProductTab('revenue',this)">ยอดรวม</button>
            <button class="sa-tab" onclick="_saProductTab('qty',this)">จำนวน</button>
          </div>
        </div>
        <div style="position:relative;height:400px;"><canvas id="sa-product-chart"></canvas></div>
      </div>

      <!-- Detail Table -->
      <div class="sa-card sa-grid-1">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
          <div class="sa-card-title" style="margin-bottom:0;">รายละเอียด</div>
          <div style="display:flex;gap:8px;align-items:center;">
            <input type="text" id="sa-search" placeholder="ค้นหา..."
              style="font-size:12px;padding:5px 10px;border:1px solid #e2e8f0;border-radius:8px;width:160px;font-family:inherit;outline:none;"
              oninput="_saApplyFilters()">
            <span style="font-size:12px;color:#94a3b8;" id="sa-table-count">0 รายการ</span>
          </div>
        </div>
        <div class="sa-table-wrap">
          <table class="sa-table">
            <thead><tr id="sa-table-head">
              <th class="rank">#</th>
              <th>ชื่อ / รายการ</th>
              <th>หมวด</th>
              <th class="num">ยอดขาย (฿)</th>
              <th class="num">จำนวน</th>
              <th class="num">ราคาเฉลี่ย</th>
              <th class="num">สัดส่วน</th>
            </tr></thead>
            <tbody id="sa-detail-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>
  </div><!-- /dashboard -->

  <!-- ══ VIEW: History ══ -->
  <div id="sa-view-history" style="display:none;">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
      <div class="sa-card">
        <div class="sa-card-title">รายงานที่บันทึกไว้</div>
        <div id="sa-history-list">
          <div style="text-align:center;padding:32px;color:#94a3b8;"><div style="font-size:32px;margin-bottom:8px;">📂</div><div>ยังไม่มีรายงาน</div></div>
        </div>
        <button class="sa-btn" style="width:100%;margin-top:10px;justify-content:center;" onclick="_saLoadHistory()">🔄 โหลดใหม่</button>
      </div>
      <div class="sa-card" id="sa-history-detail">
        <div class="sa-card-title">รายละเอียด</div>
        <div style="text-align:center;padding:32px;color:#94a3b8;"><div style="font-size:28px;margin-bottom:8px;">👆</div><div>เลือกรายงานทางซ้าย</div></div>
      </div>
    </div>
  </div>

  <!-- ══ VIEW: Compare ══ -->
  <div id="sa-view-compare" style="display:none;">
    <div class="sa-card" style="margin-bottom:14px;">
      <div class="sa-card-title">เปรียบเทียบหลายงวด</div>
      <div id="sa-compare-list" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;margin-bottom:12px;">
        <div style="font-size:12px;color:#94a3b8;">กำลังโหลด...</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <button class="sa-btn primary" onclick="_saRunCompare()">📊 เปรียบเทียบ</button>
        <div class="sa-tab-bar" id="sa-trend-tabs">
          <button class="sa-tab active" onclick="_saTrendMetric('totalRevenue',this)">ยอดขาย</button>
          <button class="sa-tab" onclick="_saTrendMetric('totalQty',this)">จำนวน</button>
          <button class="sa-tab" onclick="_saTrendMetric('totalDiscount',this)">ส่วนลด</button>
        </div>
      </div>
    </div>
    <div id="sa-compare-charts" style="display:none;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
        <div class="sa-card"><div class="sa-card-title">แนวโน้ม</div>
          <div style="position:relative;height:250px;"><canvas id="sa-trend-chart"></canvas></div></div>
        <div class="sa-card"><div class="sa-card-title">เปรียบเทียบสาขา</div>
          <div style="position:relative;height:250px;"><canvas id="sa-branch-compare-chart"></canvas></div></div>
      </div>
    </div>
  </div>
</div>`;
}

// ─── Init events ──────────────────────────────────────────────
function _initSAEvents() {
  document.getElementById('sa-toggle-codes').addEventListener('change', function() {
    window._saState.showCodes = this.checked;
    const idx = window._saState.activeFileIdx;
    if (idx !== null && window._saState.uploadedFiles[idx])
      _saShowFile(idx);
  });

  // Multi-file input
  document.getElementById('sa-file-input').addEventListener('change', e => {
    if (e.target.files.length) _saProcessFiles([...e.target.files]);
  });

  const dz = document.getElementById('sa-drop-zone');
  dz.addEventListener('dragover',  e => { e.preventDefault(); dz.classList.add('drag-over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
  dz.addEventListener('drop', e => {
    e.preventDefault(); dz.classList.remove('drag-over');
    const files = [...e.dataTransfer.files].filter(f => f.name.match(/\.(xlsx|xls|csv)$/i));
    if (files.length) _saProcessFiles(files);
  });
}

// ─── View switcher ────────────────────────────────────────────
window._saView = function(v) {
  ['dashboard','history','compare'].forEach(id => {
    document.getElementById('sa-view-'+id).style.display = id === v ? '' : 'none';
    document.getElementById('sa-tab-'+id).classList.toggle('active', id === v);
  });
  if (v === 'history' || v === 'compare') _saLoadHistory();
};

// ─── Progress ─────────────────────────────────────────────────
function _saSetProgress(pct, msg) {
  document.getElementById('sa-upload-progress').style.display = '';
  document.getElementById('sa-progress-fill').style.width = pct + '%';
  document.getElementById('sa-status-text').textContent = msg;
}

// ─── Process multiple files ───────────────────────────────────
window._saProcessFiles = async function(files) {
  const period  = document.getElementById('sa-period-input').value.trim();
  const total   = files.length;
  const results = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) continue;
    _saSetProgress(Math.round((i / total) * 80), `กำลังอ่าน ${file.name} (${i+1}/${total})...`);
    try {
      const { rows, headers } = await SA.parseExcelFile(file, false);
      const summary  = SA.aggregateData(rows);
      const type     = _saDetectReportType(headers);
      results.push({ fileName: file.name, period, type, rows, summary, headers });
    } catch (err) {
      window.toast('❌ อ่านไฟล์ ' + file.name + ' ไม่ได้: ' + err.message, '#c2410c');
    }
  }

  if (!results.length) { _saSetProgress(0, '❌ ไม่มีไฟล์ที่อ่านได้'); return; }

  _saSetProgress(90, 'กำลังสร้าง dashboard...');

  // Merge กับ uploadedFiles เดิม (ถ้ามี) — ป้องกัน duplicate ชื่อไฟล์เดิม
  const st = window._saState;
  results.forEach(r => {
    const existIdx = st.uploadedFiles.findIndex(f => f.fileName === r.fileName);
    if (existIdx >= 0) st.uploadedFiles[existIdx] = r;
    else st.uploadedFiles.push(r);
  });

  st.filterBranch = new Set();
  st.filterCat    = new Set();
  st.filterSearch = '';

  document.getElementById('sa-dashboard-content').style.display = '';
  _saRenderFileTabs();
  _saShowFile(0);

  _saSetProgress(100, `✓ โหลด ${st.uploadedFiles.length} ไฟล์สำเร็จ`);
  window.toast('✅ โหลด ' + st.uploadedFiles.length + ' ไฟล์สำเร็จ', '#059669');
  setTimeout(() => { document.getElementById('sa-upload-progress').style.display = 'none'; }, 3000);
  document.getElementById('sa-file-input').value = '';
};

// ─── File tabs ────────────────────────────────────────────────
function _saRenderFileTabs() {
  const st  = window._saState;
  const bar = document.getElementById('sa-file-tab-bar');
  if (!bar) return;

  if (st.uploadedFiles.length <= 1) { bar.style.display = 'none'; }
  else {
    bar.style.display = 'flex';
    bar.innerHTML = st.uploadedFiles.map((f, i) => `
      <button class="sa-file-tab ${i === st.activeFileIdx ? 'active' : ''}"
        onclick="_saShowFile(${i})">
        <span>${f.type.icon}</span>
        <span>${f.type.label}</span>
        <span style="font-size:10px;color:#94a3b8;">${f.period || _saShortName(f.fileName)}</span>
        <button class="sa-file-tab-remove" onclick="event.stopPropagation();_saRemoveFile(${i})" title="ลบ">✕</button>
      </button>`).join('') +
      `<button class="sa-file-tab-add" onclick="document.getElementById('sa-file-input').click()">+ เพิ่มไฟล์</button>`;

    // Overview section (2+ files)
    _saRenderOverview();
  }
}

function _saShortName(name) {
  return name.length > 16 ? name.slice(0, 14) + '…' : name;
}

window._saRemoveFile = function(idx) {
  const st = window._saState;
  st.uploadedFiles.splice(idx, 1);
  if (!st.uploadedFiles.length) { _saClearDashboard(); return; }
  const newIdx = Math.min(idx, st.uploadedFiles.length - 1);
  _saRenderFileTabs();
  _saShowFile(newIdx);
};

window._saShowFile = function(idx) {
  const st   = window._saState;
  const file = st.uploadedFiles[idx];
  if (!file) return;
  st.activeFileIdx = idx;

  // set current report
  window._saCurrentReport = { ...file.summary, fileName: file.fileName, period: file.period, rows: file.rows, reportType: file.type };

  // Update active tab
  document.querySelectorAll('.sa-file-tab').forEach((el, i) => el.classList.toggle('active', i === idx));

  // Render dashboard for this file
  st.filterBranch = new Set();
  st.filterCat    = new Set();
  st.filterSearch = '';
  _saRenderDashboard(window._saCurrentReport);
};

// ─── Overview (multi-file summary cards) ─────────────────────
function _saRenderOverview() {
  const st  = window._saState;
  const sec = document.getElementById('sa-overview-section');
  const grid = document.getElementById('sa-overview-grid');
  if (!sec || !grid) return;

  if (st.uploadedFiles.length < 2) { sec.style.display = 'none'; return; }
  sec.style.display = '';

  const fmtB = n => '฿' + Number(n||0).toLocaleString('th-TH',{maximumFractionDigits:0});
  grid.innerHTML = st.uploadedFiles.map((f, i) => `
    <div class="sa-overview-card ${i === st.activeFileIdx ? 'active' : ''}" onclick="_saShowFile(${i})">
      <div class="sa-overview-card-icon">${f.type.icon}</div>
      <div class="sa-overview-card-type">${f.type.label}</div>
      <div class="sa-overview-card-name" title="${f.fileName}">${f.period || _saShortName(f.fileName)}</div>
      <div class="sa-overview-card-val">${fmtB(f.summary.totalRevenue)}</div>
      <div class="sa-overview-card-sub">${f.summary.totalQty?.toLocaleString('th-TH')||0} รายการ • ${f.summary.productCount||0} สินค้า</div>
    </div>`).join('');
}

// ─── Render dashboard ─────────────────────────────────────────
window._saRenderDashboard = function(report) {
  const type  = report.reportType || { id:'product', label:'ยอดขายตามสินค้า', icon:'🛍' };
  const fmtB  = n => '฿' + Number(n||0).toLocaleString('th-TH',{maximumFractionDigits:0});

  document.getElementById('sa-report-icon').textContent   = type.icon;
  document.getElementById('sa-report-name').textContent   = report.period || report.fileName || 'รายงาน';
  document.getElementById('sa-report-type-badge').textContent = type.label;
  document.getElementById('sa-report-meta').textContent   =
    (report.totalQty||0).toLocaleString('th-TH') + ' รายการ • ' + (report.branchCount||0) + ' สาขา • ' + (report.productCount||0) + ' สินค้า';
  document.getElementById('sa-donut-total').textContent   = '฿' + Math.round((report.totalRevenue||0)/1000) + 'K';

  // KPIs
  document.getElementById('sa-kpi-container').innerHTML = `
    <div class="sa-kpi-grid">
      <div class="sa-kpi" onclick="_saKPIFilter()">
        <div class="sa-kpi-label">ยอดขายสุทธิ</div>
        <div class="sa-kpi-value">${fmtB(report.totalRevenue)}</div>
        <div class="sa-kpi-sub">ก่อนลด ${fmtB(report.totalGross||0)}</div>
      </div>
      <div class="sa-kpi" onclick="_saKPIFilter()">
        <div class="sa-kpi-label">รายการขาย</div>
        <div class="sa-kpi-value">${(report.totalQty||0).toLocaleString('th-TH')}</div>
        <div class="sa-kpi-sub">รายการ</div>
      </div>
      <div class="sa-kpi" onclick="_saKPIFilter()">
        <div class="sa-kpi-label">สินค้า</div>
        <div class="sa-kpi-value">${(report.productCount||0).toLocaleString('th-TH')}</div>
        <div class="sa-kpi-sub">${report.branchCount||0} สาขา</div>
      </div>
      <div class="sa-kpi" onclick="_saKPIFilter()">
        <div class="sa-kpi-label">ส่วนลดรวม</div>
        <div class="sa-kpi-value">${fmtB(report.totalDiscount)}</div>
        <div class="sa-kpi-sub">${(report.discountRate||0).toFixed(2)}%</div>
      </div>
    </div>`;

  _saBuildFilterBar(report);
  const filtered = _saGetFilteredData(report);
  _saRenderCharts(filtered, report.totalRevenue);
  _saRenderTable(filtered.topProducts, report.totalRevenue);
};

// ─── Filter bar ───────────────────────────────────────────────
function _saBuildFilterBar(report) {
  const bar = document.getElementById('sa-filter-bar');
  if (!bar) return;

  const hasBranches = (report.branches||[]).length > 0;
  const hasCats     = (report.categories||[]).length > 0;
  if (!hasBranches && !hasCats) { bar.style.display = 'none'; return; }

  bar.style.display = 'flex';
  const st  = window._saState;
  const brEl = document.getElementById('sa-filter-branches');
  const caEl = document.getElementById('sa-filter-cats');
  const divEl = document.getElementById('sa-filter-div');

  brEl.innerHTML = (report.branches||[]).map(b => {
    const label  = b.replace('สาขา','').trim();
    const active = st.filterBranch.has(b) ? 'active' : '';
    return `<button class="sa-chip ${active}" onclick="_saFilterBranch('${b.replace(/'/g,"\\'")}',this)">${label}</button>`;
  }).join('');

  caEl.innerHTML = (report.categories||[]).map(c => {
    const active = st.filterCat.has(c) ? 'active' : '';
    return `<button class="sa-chip ${active}" onclick="_saFilterCat('${c.replace(/'/g,"\\'")}',this)">${c}</button>`;
  }).join('');

  if (divEl) divEl.style.display = (hasBranches && hasCats) ? '' : 'none';
  _saUpdateFilterSummary();
}

function _saUpdateFilterSummary() {
  const st = window._saState;
  const el = document.getElementById('sa-filter-summary');
  if (!el) return;
  const parts = [];
  if (st.filterBranch.size) parts.push('สาขา: ' + [...st.filterBranch].map(b=>b.replace('สาขา','').trim()).join(', '));
  if (st.filterCat.size)    parts.push('หมวด: ' + [...st.filterCat].join(', '));
  if (st.filterSearch)      parts.push('ค้นหา: ' + st.filterSearch);
  el.textContent = parts.length ? '→ ' + parts.join(' & ') : '';
}

window._saFilterBranch = function(branch, btn) {
  const st = window._saState;
  if (st.filterBranch.has(branch)) st.filterBranch.delete(branch);
  else st.filterBranch.add(branch);
  if (btn) btn.classList.toggle('active', st.filterBranch.has(branch));
  _saApplyFilters();
};
window._saFilterCat = function(cat, btn) {
  const st = window._saState;
  if (st.filterCat.has(cat)) st.filterCat.delete(cat);
  else st.filterCat.add(cat);
  if (btn) btn.classList.toggle('active', st.filterCat.has(cat));
  _saApplyFilters();
};
window._saKPIFilter = function() {
  window._saState.filterBranch = new Set();
  window._saState.filterCat    = new Set();
  window._saState.filterSearch = '';
  document.querySelectorAll('.sa-chip').forEach(c => c.classList.remove('active'));
  const s = document.getElementById('sa-search'); if (s) s.value = '';
  _saApplyFilters();
};
window._saFilterClear = window._saKPIFilter;

window._saApplyFilters = function() {
  const r = window._saCurrentReport; if (!r) return;
  window._saState.filterSearch = (document.getElementById('sa-search')?.value||'').trim().toLowerCase();
  _saUpdateFilterSummary();
  const filtered = _saGetFilteredData(r);
  _saRenderCharts(filtered, r.totalRevenue);
  _saRenderTable(filtered.topProducts, r.totalRevenue);
};

function _saGetFilteredData(report) {
  const st = window._saState;
  if (!st.filterBranch.size && !st.filterCat.size && !st.filterSearch) return report;
  const rows = (report.rows||[]).filter(r => {
    if (st.filterBranch.size && !st.filterBranch.has(r.branch)) return false;
    if (st.filterCat.size && !st.filterCat.has(_saSimplifyCategory(r.category))) return false;
    if (st.filterSearch) {
      const n = (st.showCodes ? r.productNameRaw : r.productNameClean)||r.productName||'';
      if (!n.toLowerCase().includes(st.filterSearch) && !(r.category||'').toLowerCase().includes(st.filterSearch)) return false;
    }
    return true;
  });
  return SA.aggregateData(rows);
}

function _saSimplifyCategory(cat) {
  if (!cat) return 'อื่นๆ';
  let c = String(cat);
  for (const pfx of ['TW.','FD.','TW-','FD-']) { if (c.startsWith(pfx)) c = c.slice(pfx.length); }
  return c.split(' - ')[0].trim() || 'อื่นๆ';
}

// ─── Charts ───────────────────────────────────────────────────
function _saRenderCharts(data, originalTotal) {
  const dp = data.topProducts.map(p => ({
    ...p, name: window._saState.showCodes ? (p.rawName||p.name) : (p.cleanName||p.name)
  }));
  SACharts.renderBranchChart(data.byBranch, 'sa-branch-chart');
  SACharts.renderCategoryChart(data.byCategory, 'sa-cat-chart', 'sa-cat-legend');
  SACharts.renderTopProductsChart(dp, 'sa-product-chart', window._saState.productMode);
  const dEl = document.getElementById('sa-donut-total');
  if (dEl) dEl.textContent = '฿' + Math.round((data.totalRevenue||0)/1000) + 'K';
}

window._saProductTab = function(mode, btn) {
  window._saState.productMode = mode;
  document.querySelectorAll('#sa-view-dashboard .sa-tab-bar .sa-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (window._saCurrentReport) {
    const filtered = _saGetFilteredData(window._saCurrentReport);
    const dp = filtered.topProducts.map(p => ({ ...p, name: window._saState.showCodes ? (p.rawName||p.name) : (p.cleanName||p.name) }));
    SACharts.renderTopProductsChart(dp, 'sa-product-chart', mode);
  }
};

// ─── Table ────────────────────────────────────────────────────
const _SA_CAT_BADGE = {
  'เมนูร้อน':'sa-bh','บิงซู':'sa-bb','บิงซูตามใจ':'sa-bp',
  'เมนูเครื่องดื่ม':'sa-bt','เมนูอาหาร':'sa-bf','เมนูเย็น':'sa-bc'
};
function _saGetBadge(cat) {
  for (const [k,v] of Object.entries(_SA_CAT_BADGE)) { if (cat?.includes(k)) return v; }
  return 'sa-bg';
}
function _saRenderTable(products, total) {
  document.getElementById('sa-table-count').textContent = products.length.toLocaleString('th-TH') + ' รายการ';
  document.getElementById('sa-detail-tbody').innerHTML = products.map((p, i) => `
    <tr>
      <td class="rank">${i+1}</td>
      <td>${p.name}</td>
      <td><span class="sa-badge ${_saGetBadge(p.category)}">${p.category||'อื่นๆ'}</span></td>
      <td class="num">${p.revenue.toLocaleString('th-TH')}</td>
      <td class="num">${p.qty.toLocaleString('th-TH')}</td>
      <td class="num">฿${(p.avgPrice||0).toLocaleString('th-TH')}</td>
      <td class="num" style="color:#94a3b8;">${total > 0 ? (p.revenue/total*100).toFixed(1) : 0}%</td>
    </tr>`).join('');
}

window._saClearDashboard = function() {
  window._saState.uploadedFiles = [];
  window._saState.activeFileIdx = null;
  window._saCurrentReport = null;
  document.getElementById('sa-dashboard-content').style.display = 'none';
  document.getElementById('sa-file-tab-bar').style.display = 'none';
  document.getElementById('sa-overview-section').style.display = 'none';
  document.getElementById('sa-file-input').value = '';
  document.getElementById('sa-upload-progress').style.display = 'none';
};

// ─── Export helpers ───────────────────────────────────────────
function _saBuildExportReport(r) {
  return {
    summary     : { totalRevenue:r.totalRevenue||0, totalGross:r.totalGross||0, totalDiscount:r.totalDiscount||0, discountRate:r.discountRate||0, totalQty:r.totalQty||0, productCount:r.productCount||0, branchCount:r.branchCount||0 },
    byBranch    : r.byBranch    || [],
    byCategory  : r.byCategory  || [],
    topProducts : r.topProducts || [],
    fileName    : r.fileName    || '',
    period      : r.period      || '',
  };
}
window._saExportExcel = function() {
  const r = window._saCurrentReport;
  if (!r?.topProducts?.length) { window.toast('❌ ไม่มีข้อมูลสำหรับ Export','#c2410c'); return; }
  if (!window.SAExport?.exportToExcel) { window.toast('❌ โมดูล Export ยังไม่โหลด','#c2410c'); return; }
  try { SAExport.exportToExcel(_saBuildExportReport(r), window._saState.showCodes); window.toast('✅ Export Excel สำเร็จ','#059669'); }
  catch(e) { window.toast('❌ Export ล้มเหลว: '+e.message,'#c2410c'); console.error(e); }
};
window._saExportPDF = function() {
  const r = window._saCurrentReport;
  if (!r?.topProducts?.length) { window.toast('❌ ไม่มีข้อมูลสำหรับ Export','#c2410c'); return; }
  if (!window.SAExport?.exportToPDF) { window.toast('❌ โมดูล Export ยังไม่โหลด','#c2410c'); return; }
  try { SAExport.exportToPDF(_saBuildExportReport(r)); }
  catch(e) { window.toast('❌ Export ล้มเหลว: '+e.message,'#c2410c'); console.error(e); }
};

// ─── Save ─────────────────────────────────────────────────────
window._saSaveReport = async function() {
  const r = window._saCurrentReport;
  if (!r) { window.toast('ไม่มีข้อมูล','#c2410c'); return; }
  try {
    window.toast('⏳ กำลังบันทึก...');
    const id = await SA.saveReportToFirestore(window.db, { fileName:r.fileName, period:r.period, summary:r, rows:r.rows||[] });
    window._saCurrentReport._firestoreId = id;
    window.toast('✅ บันทึกสำเร็จ','#059669');
  } catch(e) { window.toast('❌ บันทึกไม่สำเร็จ: '+e.message,'#c2410c'); }
};

// ─── History ──────────────────────────────────────────────────
window._saLoadHistory = async function() {
  try {
    window._saState.savedReports = await SA.loadReportList(window.db, 30);
    _saRenderHistory();
    _saRenderCompareList();
  } catch(e) {
    document.getElementById('sa-history-list').innerHTML =
      '<div style="text-align:center;padding:20px;color:#ef4444;font-size:12px;">❌ โหลดไม่ได้: '+e.message+'</div>';
  }
};

function _saRenderHistory() {
  const el = document.getElementById('sa-history-list');
  const reports = window._saState.savedReports || [];
  if (!reports.length) {
    el.innerHTML = '<div style="text-align:center;padding:32px;color:#94a3b8;"><div style="font-size:32px;margin-bottom:8px;">📂</div><div>ยังไม่มีรายงาน</div></div>';
    return;
  }
  el.innerHTML = reports.map(r => {
    const date = r.uploadedAt?.toDate ? r.uploadedAt.toDate().toLocaleDateString('th-TH') : '—';
    return `<div class="sa-report-item" onclick="_saHistoryDetail('${r.id}')" id="sa-ri-${r.id}">
      <span style="font-size:18px;">📋</span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${r.period||r.fileName||r.id}</div>
        <div style="font-size:11px;color:#94a3b8;margin-top:1px;">${date} • ${r.summary?.branchCount||0} สาขา</div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div style="font-size:13px;font-weight:700;">฿${Math.round((r.summary?.totalRevenue||0)/1000)}K</div>
        <button class="sa-btn danger" style="font-size:11px;padding:3px 8px;margin-top:3px;"
          onclick="event.stopPropagation();_saDeleteReport('${r.id}')">ลบ</button>
      </div>
    </div>`;
  }).join('');
}

window._saHistoryDetail = function(id) {
  document.querySelectorAll('.sa-report-item').forEach(el => el.classList.remove('active'));
  document.getElementById('sa-ri-'+id)?.classList.add('active');
  const r = (window._saState.savedReports||[]).find(x => x.id === id);
  if (!r) return;
  const fmtB = n => '฿'+Number(n||0).toLocaleString('th-TH',{maximumFractionDigits:0});
  const fmtN = n => Number(n||0).toLocaleString('th-TH');
  const brRows = (r.byBranch||[]).map((b,i) =>
    `<tr><td class="rank">${i+1}</td><td>${b.branch}</td><td class="num">${fmtB(b.revenue)}</td><td class="num">${fmtN(b.qty)}</td></tr>`).join('');
  document.getElementById('sa-history-detail').innerHTML = `
    <div class="sa-card-title">${r.period||r.fileName||''}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
      <div class="sa-kpi"><div class="sa-kpi-label">ยอดขาย</div><div class="sa-kpi-value" style="font-size:16px;">${fmtB(r.summary?.totalRevenue)}</div></div>
      <div class="sa-kpi"><div class="sa-kpi-label">รายการ</div><div class="sa-kpi-value" style="font-size:16px;">${fmtN(r.summary?.totalQty)}</div></div>
    </div>
    <div class="sa-table-wrap" style="margin-bottom:12px;">
      <table class="sa-table"><thead><tr><th>#</th><th>สาขา</th><th class="num">ยอดขาย</th><th class="num">จำนวน</th></tr></thead>
      <tbody>${brRows}</tbody></table>
    </div>
    <div style="display:flex;gap:7px;flex-wrap:wrap;">
      <button class="sa-btn primary" onclick="_saOpenHistoryDashboard('${id}')">เปิด Dashboard ↗</button>
      <button class="sa-btn" onclick="SAExport&&SAExport.exportToExcel(_saBuildExportReport(window._saState.savedReports.find(x=>x.id==='${id}')||{}))">Excel</button>
      <button class="sa-btn" onclick="SAExport&&SAExport.exportToPDF(_saBuildExportReport(window._saState.savedReports.find(x=>x.id==='${id}')||{}))">PDF</button>
    </div>`;
};

window._saOpenHistoryDashboard = async function(id) {
  try {
    window.toast('⏳ กำลังโหลด...');
    const r = await SA.loadReport(window.db, id);
    if (!r) { window.toast('❌ ไม่พบรายงาน','#c2410c'); return; }
    window._saCurrentReport = { ...r, ...r.summary };
    _saView('dashboard');
    _saRenderDashboard(window._saCurrentReport);
    window.toast('✅ โหลดสำเร็จ','#059669');
  } catch(e) { window.toast('❌ '+e.message,'#c2410c'); }
};

window._saDeleteReport = async function(id) {
  if (!confirm('ต้องการลบรายงานนี้?')) return;
  try { await SA.deleteReport(window.db, id); window.toast('✅ ลบสำเร็จ','#059669'); _saLoadHistory(); }
  catch(e) { window.toast('❌ '+e.message,'#c2410c'); }
};

// ─── Compare ──────────────────────────────────────────────────
function _saRenderCompareList() {
  const el = document.getElementById('sa-compare-list');
  const reports = window._saState.savedReports || [];
  if (!reports.length) { el.innerHTML = '<div style="font-size:12px;color:#94a3b8;">ยังไม่มีรายงาน</div>'; return; }
  el.innerHTML = reports.map(r => {
    const date = r.uploadedAt?.toDate ? r.uploadedAt.toDate().toLocaleDateString('th-TH') : '—';
    return `<label style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid #e8ecf0;border-radius:9px;cursor:pointer;font-size:12px;background:white;">
      <input type="checkbox" value="${r.id}" onchange="_saToggleCompare('${r.id}',this.checked)">
      <span>${r.period||r.fileName||r.id} <span style="color:#94a3b8;">(${date})</span></span>
    </label>`;
  }).join('');
}
window._saToggleCompare = function(id, c) { if(c) window._saState.compareSet.add(id); else window._saState.compareSet.delete(id); };
window._saTrendMetric = function(m, btn) {
  window._saState.trendMode = m;
  document.querySelectorAll('#sa-trend-tabs .sa-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _saRunCompare();
};
window._saRunCompare = function() {
  const selected = (window._saState.savedReports||[]).filter(r => window._saState.compareSet.has(r.id));
  if (!selected.length) { window.toast('⚠️ เลือกอย่างน้อย 1 รายงาน','#c2410c'); return; }
  document.getElementById('sa-compare-charts').style.display = '';
  SACharts.renderTrendChart(selected, 'sa-trend-chart', window._saState.trendMode);
  SACharts.renderBranchCompareChart(selected, 'sa-branch-compare-chart');
};

// ─── Register hash nav (ไม่กระทบ home.html) ─────────────────
if (window.navFnMap) window.navFnMap['sales-analytics'] = () => window.openSalesAnalytics();

// ============================================================
//  TTGPlus — Sales Analytics  |  sales-analytics-loader.js
//  Power BI–style UI — multi-file upload, 3 report types
// ============================================================

window.openSalesAnalytics = async function() {
  if (typeof XLSX      === 'undefined') await _saLoad('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
  if (typeof Chart     === 'undefined') await _saLoad('https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js');
  if (!window.SA)       await _saLoad('sales-analytics.js');
  if (!window.SACharts) await _saLoad('sales-analytics-charts.js');
  if (!window.SAExport) await _saLoad('sales-analytics-export.js');

  document.getElementById('dashboardView')?.classList.add('hidden');
  const container = document.getElementById('toolAppContainer');
  container.classList.remove('hidden');
  container.innerHTML = _buildSAHTML();
  _initSAEvents();

  if (location.hash !== '#sales-analytics')
    history.pushState({ nav:'sales-analytics' },'','#sales-analytics');
};

function _saLoad(src) {
  return new Promise((res,rej) => {
    if (document.querySelector(`script[src="${src}"]`)) { setTimeout(res,80); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = () => setTimeout(res,80); s.onerror = rej;
    document.head.appendChild(s);
  });
}

// ─── State ────────────────────────────────────────────────────
window._saState = {
  activePage   : 'overview',
  trendGroup   : 'day',
  productMode  : 'revenue',
  showCodes    : false,
  savedReports : [],
  compareSet   : new Set(),
  filterBranch : new Set(),
  filterCat    : new Set(),
  filterSearch : '',
  // loaded file data keyed by type
  data: {},           // { product:{rows,summary,...}, daily_product:{...}, bill:{...}, promo:{...} }
  pendingFiles: [],   // files waiting for confirm
};

// ─── Build HTML ───────────────────────────────────────────────
function _buildSAHTML() {
  return `
<style>
/* ── Power BI shell ── */
#sa-shell{display:flex;flex-direction:column;height:100%;min-height:600px;background:#f3f2f1;font-family:'Segoe UI',system-ui,sans-serif;font-size:13px;}

/* Topbar */
#sa-topbar{background:#252423;display:flex;align-items:stretch;height:44px;flex-shrink:0;padding:0 14px;gap:0;}
.sa-logo{display:flex;align-items:center;gap:8px;padding:0 14px 0 0;margin-right:12px;border-right:1px solid rgba(255,255,255,.12);}
.sa-logo-mark{width:24px;height:24px;background:#f0b429;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#0f172a;flex-shrink:0;}
.sa-logo-text{font-size:13px;font-weight:600;color:rgba(255,255,255,.9);}
.sa-nav{display:flex;align-items:stretch;}
.sa-nav-item{display:flex;align-items:center;padding:0 14px;font-size:12px;color:rgba(255,255,255,.6);cursor:pointer;border-bottom:2px solid transparent;transition:.15s;gap:5px;white-space:nowrap;}
.sa-nav-item:hover{color:white;background:rgba(255,255,255,.06);}
.sa-nav-item.on{color:white;border-bottom-color:#f0b429;}
.sa-topbar-right{margin-left:auto;display:flex;align-items:center;gap:6px;}
.sa-tbtn{padding:5px 11px;border-radius:3px;border:none;cursor:pointer;font-size:11px;font-weight:600;font-family:inherit;}
.sa-tbtn.exp{background:rgba(255,255,255,.1);color:white;}
.sa-tbtn.exp:hover{background:rgba(255,255,255,.18);}
.sa-tbtn.save{background:#f0b429;color:#0f172a;}
.sa-tbtn.close{background:rgba(239,68,68,.15);color:#fca5a5;border:1px solid rgba(239,68,68,.3);}

/* Body layout */
#sa-body{display:flex;flex:1;overflow:hidden;}

/* Filter pane */
#sa-filter-pane{width:196px;flex-shrink:0;background:#faf9f8;border-right:1px solid #e1dfdd;padding:12px 10px;overflow-y:auto;}
.sa-fp-title{font-size:10px;font-weight:600;color:#605e5c;text-transform:uppercase;letter-spacing:.4px;margin-bottom:10px;}
.sa-slicer{margin-bottom:14px;}
.sa-slicer-label{font-size:11px;font-weight:600;color:#323130;margin-bottom:5px;}
.sa-slicer-item{display:flex;align-items:center;gap:6px;padding:3px 4px;font-size:11px;cursor:pointer;color:#323130;border-radius:2px;user-select:none;}
.sa-slicer-item:hover{background:#edebe9;}
.sa-slicer-item.on{background:#fff4ce;font-weight:600;}
.sa-cb{width:13px;height:13px;border:1.5px solid #8a8886;border-radius:2px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:9px;}
.sa-cb.on{background:#f0b429;border-color:#f0b429;color:#0f172a;}
.sa-fp-divider{height:0.5px;background:#e1dfdd;margin:8px 0;}
.sa-fp-clear{width:100%;font-size:10px;padding:5px;background:#edebe9;border:none;cursor:pointer;color:#323130;font-weight:600;border-radius:2px;margin-top:6px;font-family:inherit;}
.sa-fp-clear:hover{background:#e1dfdd;}
.sa-search-box{width:100%;font-size:11px;padding:5px 8px;border:0.5px solid #e1dfdd;background:white;border-radius:2px;font-family:inherit;outline:none;margin-bottom:6px;}
.sa-search-box:focus{border-color:#f0b429;}

/* Main canvas */
#sa-main{flex:1;padding:12px;overflow-y:auto;}

/* Upload zone */
#sa-upload-zone{border:1.5px dashed #e1dfdd;border-radius:3px;padding:28px 20px;text-align:center;cursor:pointer;transition:.2s;background:white;}
#sa-upload-zone:hover,#sa-upload-zone.drag-over{border-color:#f0b429;background:#fffbeb;}
#sa-upload-zone-title{font-size:15px;font-weight:600;color:#323130;margin-bottom:4px;}
#sa-upload-zone-sub{font-size:12px;color:#8a8886;}
.sa-prog-bar{height:4px;background:#e1dfdd;border-radius:0;overflow:hidden;margin-top:10px;}
.sa-prog-fill{height:100%;background:#f0b429;border-radius:0;transition:width .3s;}
.sa-status{font-size:11px;color:#605e5c;margin-top:5px;}

/* KPI row */
.pbi-kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px;}
.pbi-kpi{background:white;border:0.5px solid #e1dfdd;padding:10px 13px;position:relative;overflow:hidden;border-radius:2px;}
.pbi-kpi::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;}
.pbi-kpi-rev::before{background:#f0b429;}
.pbi-kpi-qty::before{background:#0078d4;}
.pbi-kpi-prod::before{background:#107c10;}
.pbi-kpi-disc::before{background:#d83b01;}
.pbi-kpi-label{font-size:10px;color:#605e5c;margin-bottom:2px;}
.pbi-kpi-value{font-size:22px;font-weight:300;color:#201f1e;line-height:1.2;}
.pbi-kpi-sub{font-size:10px;color:#8a8886;margin-top:2px;}

/* Cards */
.pbi-card{background:white;border:0.5px solid #e1dfdd;padding:12px 14px;border-radius:2px;margin-bottom:8px;}
.pbi-card-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;}
.pbi-card-title{font-size:10px;font-weight:600;color:#323130;text-transform:uppercase;letter-spacing:.4px;}
.pbi-grid-2{display:grid;grid-template-columns:1.6fr 1fr;gap:8px;margin-bottom:8px;}
.pbi-grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px;}
.pbi-grid-half{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;}

/* Legend */
.pbi-leg-row{display:flex;align-items:center;gap:6px;margin-bottom:5px;font-size:11px;color:#323130;}
.pbi-leg-dot{width:9px;height:9px;flex-shrink:0;border-radius:1px;}
.pbi-leg-name{flex:1;}
.pbi-leg-pct{font-weight:600;color:#201f1e;}

/* Table */
.pbi-table{width:100%;border-collapse:collapse;font-size:11px;}
.pbi-table th{font-size:10px;font-weight:600;color:#605e5c;padding:6px 8px;border-bottom:2px solid #f0b429;text-align:left;white-space:nowrap;background:white;}
.pbi-table td{padding:5px 8px;border-bottom:0.5px solid #f3f2f1;color:#201f1e;}
.pbi-table tr:hover td{background:#faf9f8;}
.pbi-table .num{text-align:right;font-variant-numeric:tabular-nums;}
.pbi-databar-wrap{position:relative;height:14px;background:#f3f2f1;}
.pbi-databar-fill{position:absolute;left:0;top:0;height:100%;opacity:.35;}
.pbi-databar-text{position:absolute;inset:0;display:flex;align-items:center;padding:0 5px;font-size:10px;font-weight:600;color:#201f1e;}

/* Tabs at bottom */
#sa-page-tabs{background:#252423;display:flex;align-items:stretch;padding:0 12px;height:30px;flex-shrink:0;}
.sa-page-tab{display:flex;align-items:center;padding:0 14px;font-size:11px;cursor:pointer;border-radius:4px 4px 0 0;white-space:nowrap;color:rgba(255,255,255,.5);transition:.15s;}
.sa-page-tab:hover{background:rgba(255,255,255,.08);color:rgba(255,255,255,.8);}
.sa-page-tab.on{background:#f3f2f1;color:#201f1e;font-weight:600;}

/* Trend group tabs */
.sa-group-tabs{display:flex;gap:3px;margin-bottom:8px;}
.sa-group-tab{padding:3px 12px;font-size:11px;border:0.5px solid #e1dfdd;background:white;cursor:pointer;border-radius:2px;color:#605e5c;font-family:inherit;transition:.12s;}
.sa-group-tab.on{background:#f0b429;border-color:#f0b429;color:#0f172a;font-weight:600;}

/* Confirm modal */
#sa-modal-overlay{position:absolute;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:999;}
#sa-modal{background:white;border-radius:4px;padding:24px 28px;width:440px;max-width:90%;}
#sa-modal h3{font-size:15px;font-weight:600;color:#201f1e;margin-bottom:4px;}
#sa-modal .sub{font-size:12px;color:#8a8886;margin-bottom:16px;}
.sa-detect-row{display:flex;align-items:center;gap:10px;padding:9px 12px;border:0.5px solid #e1dfdd;border-radius:3px;margin-bottom:6px;font-size:12px;}
.sa-detect-row .fname{flex:1;color:#323130;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.sa-detect-badge{font-size:10px;font-weight:600;padding:2px 8px;border-radius:2px;white-space:nowrap;}
.sa-detect-row select{font-size:11px;border:0.5px solid #e1dfdd;padding:3px 6px;border-radius:2px;font-family:inherit;cursor:pointer;}
.sa-modal-btns{display:flex;justify-content:flex-end;gap:8px;margin-top:18px;}
.sa-modal-btn{padding:7px 18px;font-size:12px;font-weight:600;border:none;border-radius:3px;cursor:pointer;font-family:inherit;}
.sa-modal-btn.cancel{background:#f3f2f1;color:#323130;}
.sa-modal-btn.confirm{background:#f0b429;color:#0f172a;}

/* Toggle */
.sa-toggle-wrap{display:flex;align-items:center;gap:6px;font-size:11px;color:rgba(255,255,255,.6);}
.sa-toggle{position:relative;width:30px;height:16px;flex-shrink:0;}
.sa-toggle input{opacity:0;width:0;height:0;position:absolute;}
.sa-toggle-track{position:absolute;inset:0;background:rgba(255,255,255,.2);border-radius:8px;transition:.2s;cursor:pointer;}
.sa-toggle input:checked+.sa-toggle-track{background:#f0b429;}
.sa-toggle-thumb{position:absolute;top:2px;left:2px;width:12px;height:12px;background:white;border-radius:50%;transition:.2s;pointer-events:none;}
.sa-toggle input:checked~.sa-toggle-thumb{transform:translateX(14px);}

/* File tabs */
.sa-file-tabs{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px;}
.sa-file-tab{padding:4px 12px;font-size:11px;border:0.5px solid #e1dfdd;border-radius:2px;background:white;cursor:pointer;color:#605e5c;font-family:inherit;}
.sa-file-tab:hover{border-color:#8a8886;}
.sa-file-tab.on{border-color:#f0b429;background:#fff4ce;color:#323130;font-weight:600;}
.sa-file-tab-add{padding:4px 10px;font-size:11px;border:0.5px dashed #e1dfdd;border-radius:2px;background:transparent;cursor:pointer;color:#8a8886;font-family:inherit;}
.sa-file-tab-add:hover{border-color:#f0b429;color:#f0b429;}

@media(max-width:900px){
  #sa-filter-pane{display:none;}
  .pbi-kpi-row{grid-template-columns:1fr 1fr;}
  .pbi-grid-2,.pbi-grid-3,.pbi-grid-half{grid-template-columns:1fr;}
}
</style>

<div id="sa-shell" style="position:relative;">

  <!-- Topbar -->
  <div id="sa-topbar">
    <div class="sa-logo">
      <div class="sa-logo-mark">TT</div>
      <span class="sa-logo-text">TTGPlus</span>
    </div>
    <div class="sa-nav" id="sa-nav">
      <div class="sa-nav-item on"  onclick="_saPage('overview',this)"  id="sa-nav-overview">Overview</div>
      <div class="sa-nav-item"     onclick="_saPage('trend',this)"     id="sa-nav-trend">Trend</div>
      <div class="sa-nav-item"     onclick="_saPage('products',this)"  id="sa-nav-products">สินค้า</div>
      <div class="sa-nav-item"     onclick="_saPage('channel',this)"   id="sa-nav-channel">Channel</div>
      <div class="sa-nav-item"     onclick="_saPage('promo',this)"     id="sa-nav-promo">โปรโมชั่น</div>
      <div class="sa-nav-item"     onclick="_saPage('history',this)"   id="sa-nav-history">ประวัติ</div>
    </div>
    <div class="sa-topbar-right">
      <div class="sa-toggle-wrap">
        <label class="sa-toggle">
          <input type="checkbox" id="sa-toggle-codes">
          <div class="sa-toggle-track"></div>
          <div class="sa-toggle-thumb"></div>
        </label>
        รหัส
      </div>
      <button class="sa-tbtn exp" onclick="_saExportExcel()">Excel</button>
      <button class="sa-tbtn exp" onclick="_saExportPDF()">PDF</button>
      <button class="sa-tbtn save" onclick="_saSaveReport()">บันทึก</button>
      <button class="sa-tbtn close" onclick="closeTool()">✕</button>
    </div>
  </div>

  <!-- Body -->
  <div id="sa-body">
    <!-- Filter pane -->
    <div id="sa-filter-pane">
      <div class="sa-fp-title">Filters</div>

      <input type="text" class="sa-search-box" id="sa-fp-search" placeholder="ค้นหาสินค้า..." oninput="_saApplyFilters()">

      <div class="sa-slicer">
        <div class="sa-slicer-label">สาขา</div>
        <div id="sa-fp-branches">
          <div style="font-size:11px;color:#8a8886;">โหลดไฟล์ก่อน</div>
        </div>
      </div>

      <div class="sa-fp-divider"></div>

      <div class="sa-slicer">
        <div class="sa-slicer-label">หมวดสินค้า</div>
        <div id="sa-fp-categories">
          <div style="font-size:11px;color:#8a8886;">โหลดไฟล์ก่อน</div>
        </div>
      </div>

      <button class="sa-fp-clear" onclick="_saFilterClear()">✕ ล้าง Filter ทั้งหมด</button>
    </div>

    <!-- Main -->
    <div id="sa-main">

      <!-- File tabs + upload -->
      <div class="sa-file-tabs" id="sa-file-tabs">
        <label class="sa-file-tab-add" for="sa-file-input">+ เพิ่มไฟล์</label>
        <input type="file" id="sa-file-input" accept=".xlsx,.xls,.csv" multiple style="display:none;">
      </div>

      <!-- Upload zone (shown when no files) -->
      <div id="sa-upload-card">
        <div id="sa-upload-zone">
          <div style="font-size:32px;margin-bottom:8px;">📂</div>
          <div id="sa-upload-zone-title">ลากไฟล์ Excel มาวางที่นี่</div>
          <div id="sa-upload-zone-sub">รองรับ .xlsx .xls .csv • สามารถลากหลายไฟล์พร้อมกัน</div>
          <div id="sa-upload-progress" style="display:none;">
            <div class="sa-prog-bar"><div class="sa-prog-fill" id="sa-prog-fill" style="width:0%"></div></div>
            <div class="sa-status" id="sa-status-text"></div>
          </div>
        </div>
      </div>

      <!-- Dashboard pages -->
      <div id="sa-pages" style="display:none;">

        <!-- Overview -->
        <div id="sa-page-overview">
          <div id="sa-kpi-container"></div>
          <div class="pbi-grid-2">
            <div class="pbi-card">
              <div class="pbi-card-header">
                <span class="pbi-card-title">ยอดขายตามสาขา</span>
              </div>
              <div style="position:relative;height:240px;"><canvas id="sa-branch-chart"></canvas></div>
            </div>
            <div class="pbi-card">
              <div class="pbi-card-header">
                <span class="pbi-card-title">สัดส่วนหมวดสินค้า</span>
              </div>
              <div style="display:flex;align-items:center;gap:12px;padding:8px 0;">
                <canvas id="sa-cat-chart" width="120" height="120" style="flex-shrink:0;"></canvas>
                <div id="sa-cat-legend" style="flex:1;overflow:hidden;"></div>
              </div>
            </div>
          </div>
          <div class="pbi-card">
            <div class="pbi-card-header">
              <span class="pbi-card-title">สินค้าขายดี Top 10</span>
              <div style="display:flex;gap:4px;">
                <button class="sa-group-tab on" onclick="_saProductTab('revenue',this)">ยอดรวม</button>
                <button class="sa-group-tab"    onclick="_saProductTab('qty',this)">จำนวน</button>
              </div>
            </div>
            <div style="position:relative;height:320px;"><canvas id="sa-product-chart"></canvas></div>
          </div>
        </div>

        <!-- Trend -->
        <div id="sa-page-trend" style="display:none;">
          <div class="pbi-card">
            <div class="pbi-card-header">
              <span class="pbi-card-title">แนวโน้มยอดขาย</span>
              <div class="sa-group-tabs">
                <button class="sa-group-tab on" onclick="_saTrendGroup('day',this)">รายวัน</button>
                <button class="sa-group-tab"    onclick="_saTrendGroup('week',this)">รายสัปดาห์</button>
                <button class="sa-group-tab"    onclick="_saTrendGroup('month',this)">รายเดือน</button>
              </div>
            </div>
            <div style="position:relative;height:300px;"><canvas id="sa-trend-chart"></canvas></div>
          </div>
          <div class="pbi-card">
            <div class="pbi-card-header">
              <span class="pbi-card-title">ยอดขายตามสาขา (Trend)</span>
            </div>
            <div style="position:relative;height:250px;"><canvas id="sa-trend-branch-chart"></canvas></div>
          </div>
        </div>

        <!-- Products -->
        <div id="sa-page-products" style="display:none;">
          <div class="pbi-card">
            <div class="pbi-card-header">
              <span class="pbi-card-title">รายละเอียดสินค้า</span>
              <span style="font-size:11px;color:#8a8886;" id="sa-table-count"></span>
            </div>
            <div style="overflow-x:auto;">
              <table class="pbi-table">
                <thead><tr>
                  <th style="width:28px">#</th>
                  <th>ชื่อสินค้า</th>
                  <th>หมวด</th>
                  <th class="num">ยอดขาย (฿)</th>
                  <th class="num">จำนวน</th>
                  <th class="num">ราคาเฉลี่ย</th>
                  <th class="num">สัดส่วน</th>
                  <th style="min-width:80px;">Data bar</th>
                </tr></thead>
                <tbody id="sa-detail-tbody"></tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Channel (Bill data) -->
        <div id="sa-page-channel" style="display:none;">
          <div id="sa-channel-no-data" style="text-align:center;padding:40px;color:#8a8886;">
            <div style="font-size:32px;margin-bottom:8px;">📋</div>
            <div>ต้องการไฟล์ <strong>บิลรายการ</strong> เพื่อแสดงข้อมูล Channel</div>
          </div>
          <div id="sa-channel-content" style="display:none;">
            <div class="pbi-grid-3">
              <div class="pbi-card">
                <div class="pbi-card-header"><span class="pbi-card-title">ประเภทการสั่ง</span></div>
                <div style="display:flex;align-items:center;gap:12px;padding:4px 0;">
                  <canvas id="sa-ordertype-chart" width="110" height="110" style="flex-shrink:0;"></canvas>
                  <div id="sa-ordertype-legend" style="flex:1;"></div>
                </div>
              </div>
              <div class="pbi-card">
                <div class="pbi-card-header"><span class="pbi-card-title">ช่องทาง</span></div>
                <div style="display:flex;align-items:center;gap:12px;padding:4px 0;">
                  <canvas id="sa-channel-chart" width="110" height="110" style="flex-shrink:0;"></canvas>
                  <div id="sa-channel-legend" style="flex:1;"></div>
                </div>
              </div>
              <div class="pbi-card">
                <div class="pbi-card-header"><span class="pbi-card-title">การชำระเงิน</span></div>
                <div style="display:flex;align-items:center;gap:12px;padding:4px 0;">
                  <canvas id="sa-payment-chart" width="110" height="110" style="flex-shrink:0;"></canvas>
                  <div id="sa-payment-legend" style="flex:1;"></div>
                </div>
              </div>
            </div>
            <div class="pbi-card">
              <div class="pbi-card-header"><span class="pbi-card-title">Staff Performance</span></div>
              <div style="overflow-x:auto;">
                <table class="pbi-table">
                  <thead><tr>
                    <th>#</th><th>ชื่อพนักงาน</th>
                    <th class="num">ยอดรวม</th><th class="num">จำนวนบิล</th><th class="num">avg/บิล</th>
                  </tr></thead>
                  <tbody id="sa-staff-tbody"></tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <!-- Promo -->
        <div id="sa-page-promo" style="display:none;">
          <div id="sa-promo-no-data" style="text-align:center;padding:40px;color:#8a8886;">
            <div style="font-size:32px;margin-bottom:8px;">🏷</div>
            <div>ต้องการไฟล์ <strong>โปรโมชั่น</strong> เพื่อแสดงข้อมูล</div>
          </div>
          <div id="sa-promo-content" style="display:none;">
            <div class="pbi-grid-half">
              <div class="pbi-card">
                <div class="pbi-card-header"><span class="pbi-card-title">โปรโมชั่นที่ใช้มากสุด (ยอดส่วนลด)</span></div>
                <div style="position:relative;height:280px;"><canvas id="sa-promo-chart"></canvas></div>
              </div>
              <div class="pbi-card">
                <div class="pbi-card-header"><span class="pbi-card-title">ส่วนลดตามสาขา</span></div>
                <div style="position:relative;height:280px;"><canvas id="sa-promo-branch-chart"></canvas></div>
              </div>
            </div>
            <div class="pbi-card">
              <div class="pbi-card-header">
                <span class="pbi-card-title">รายละเอียดโปรโมชั่น</span>
                <span id="sa-promo-kpi" style="font-size:11px;color:#8a8886;"></span>
              </div>
              <div style="overflow-x:auto;">
                <table class="pbi-table">
                  <thead><tr><th>#</th><th>ชื่อโปรโมชั่น</th><th>ประเภท</th>
                    <th class="num">ครั้งที่ใช้</th><th class="num">ยอดส่วนลด</th><th class="num">สาขา</th>
                  </tr></thead>
                  <tbody id="sa-promo-tbody"></tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <!-- History -->
        <div id="sa-page-history" style="display:none;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div class="pbi-card">
              <div class="pbi-card-header"><span class="pbi-card-title">รายงานที่บันทึกไว้</span></div>
              <div id="sa-history-list">
                <div style="text-align:center;padding:28px;color:#8a8886;font-size:12px;">ยังไม่มีรายงาน</div>
              </div>
              <button style="width:100%;margin-top:8px;padding:6px;font-size:11px;background:#f3f2f1;border:none;cursor:pointer;font-family:inherit;" onclick="_saLoadHistory()">↻ โหลดใหม่</button>
            </div>
            <div class="pbi-card" id="sa-history-detail">
              <div style="text-align:center;padding:28px;color:#8a8886;font-size:12px;">เลือกรายงานทางซ้าย</div>
            </div>
          </div>
        </div>

      </div><!-- /sa-pages -->
    </div><!-- /sa-main -->
  </div><!-- /sa-body -->

  <!-- Page tabs -->
  <div id="sa-page-tabs">
    <div class="sa-page-tab on"  onclick="_saPage('overview',this)"  id="sa-tab-overview">Overview</div>
    <div class="sa-page-tab"     onclick="_saPage('trend',this)"     id="sa-tab-trend">Trend</div>
    <div class="sa-page-tab"     onclick="_saPage('products',this)"  id="sa-tab-products">สินค้า</div>
    <div class="sa-page-tab"     onclick="_saPage('channel',this)"   id="sa-tab-channel">Channel</div>
    <div class="sa-page-tab"     onclick="_saPage('promo',this)"     id="sa-tab-promo">โปรโมชั่น</div>
  </div>

</div>`;
}

// ─── Init events ──────────────────────────────────────────────
function _initSAEvents() {
  // toggle codes
  document.getElementById('sa-toggle-codes').addEventListener('change', function() {
    window._saState.showCodes = this.checked;
    _saRenderAll();
  });

  // file input
  const fi = document.getElementById('sa-file-input');
  fi.addEventListener('change', e => { if (e.target.files.length) _saHandleFiles(e.target.files); });

  // drag/drop on upload zone
  const dz = document.getElementById('sa-upload-zone');
  dz.addEventListener('click', () => fi.click());
  dz.addEventListener('dragover',  e => { e.preventDefault(); dz.classList.add('drag-over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
  dz.addEventListener('drop', e => {
    e.preventDefault(); dz.classList.remove('drag-over');
    if (e.dataTransfer.files.length) _saHandleFiles(e.dataTransfer.files);
  });

  // drag/drop on entire shell (after files loaded)
  const shell = document.getElementById('sa-shell');
  shell.addEventListener('dragover',  e => { e.preventDefault(); });
  shell.addEventListener('drop', e => {
    e.preventDefault();
    if (e.dataTransfer.files.length) _saHandleFiles(e.dataTransfer.files);
  });
}

// ─── Handle dropped/selected files ───────────────────────────
window._saHandleFiles = async function(fileList) {
  const files = Array.from(fileList).filter(f => f.name.match(/\.(xlsx|xls|csv)$/i));
  if (!files.length) { window.toast('❌ รองรับเฉพาะ .xlsx, .xls, .csv', '#c2410c'); return; }

  _saSetProgress(10, 'กำลังตรวจสอบประเภทไฟล์...');

  // detect types
  const detections = await Promise.all(files.map(async f => {
    const type = await SA.detectFile(f);
    return { file:f, type };
  }));

  _saSetProgress(30, 'ตรวจสอบเสร็จ — กรุณายืนยัน');

  // show confirm modal
  _saShowConfirmModal(detections);
};

// ─── Confirm modal ────────────────────────────────────────────
function _saShowConfirmModal(detections) {
  const typeLabels = {
    daily_product: { label:'สินค้าตามวัน', color:'#faeeda', text:'#633806' },
    product      : { label:'ยอดขายตามสินค้า', color:'#faeeda', text:'#633806' },
    bill         : { label:'บิลรายการ', color:'#e6f1fb', text:'#0c447c' },
    promo        : { label:'โปรโมชั่น', color:'#ede9fe', text:'#3c3489' },
    unknown      : { label:'ไม่ทราบ', color:'#f3f2f1', text:'#605e5c' },
  };

  const rows = detections.map((d,i) => {
    const tl = typeLabels[d.type] || typeLabels.unknown;
    return `
    <div class="sa-detect-row">
      <span class="sa-detect-badge" style="background:${tl.color};color:${tl.text};">${tl.label}</span>
      <span class="fname">${d.file.name}</span>
      <select id="sa-type-sel-${i}" style="font-size:11px;border:0.5px solid #e1dfdd;padding:3px 6px;border-radius:2px;font-family:inherit;">
        <option value="daily_product" ${d.type==='daily_product'?'selected':''}>สินค้าตามวัน</option>
        <option value="product"       ${d.type==='product'?'selected':''}>ยอดขายตามสินค้า</option>
        <option value="bill"          ${d.type==='bill'?'selected':''}>บิลรายการ</option>
        <option value="promo"         ${d.type==='promo'?'selected':''}>โปรโมชั่น</option>
        <option value="unknown"       ${d.type==='unknown'?'selected':''}>—ไม่ใช้—</option>
      </select>
    </div>`;
  }).join('');

  const overlay = document.createElement('div');
  overlay.id = 'sa-modal-overlay';
  overlay.innerHTML = `
    <div id="sa-modal">
      <h3>ตรวจพบ ${detections.length} ไฟล์</h3>
      <div class="sub">ตรวจสอบประเภทไฟล์ก่อนเริ่มวิเคราะห์ แก้ไขได้หากตรวจไม่ถูก</div>
      ${rows}
      <div class="sa-modal-btns">
        <button class="sa-modal-btn cancel" onclick="document.getElementById('sa-modal-overlay').remove();_saSetProgress(0,'');">ยกเลิก</button>
        <button class="sa-modal-btn confirm" onclick="_saConfirmFiles(${JSON.stringify(detections.map((_,i)=>i))})">เริ่มวิเคราะห์ →</button>
      </div>
    </div>`;
  document.getElementById('sa-shell').appendChild(overlay);

  window._saPendingDetections = detections;
}

// ─── Confirmed: parse all files ───────────────────────────────
window._saConfirmFiles = async function(indices) {
  document.getElementById('sa-modal-overlay')?.remove();
  const detections = window._saPendingDetections || [];
  _saSetProgress(40, 'กำลังประมวลผลไฟล์...');

  let done = 0;
  for (const det of detections) {
    const sel = document.getElementById('sa-type-sel-' + detections.indexOf(det));
    const forcedType = sel ? sel.value : det.type;
    if (forcedType === 'unknown') { done++; continue; }

    try {
      const result = await SA.parseAnyFile(det.file, forcedType);
      // aggregate
      if (result.type === 'bill') {
        result.summary = SA.aggregateBillData(result.rows);
        window._saState.data.bill = result;
      } else if (result.type === 'promo') {
        result.summary = SA.aggregatePromoData(result.rows);
        window._saState.data.promo = result;
      } else {
        result.summary = SA.aggregateProductData(result.rows);
        window._saState.data[result.type] = result; // daily_product or product
      }
      // update file tabs
      _saAddFileTab(det.file.name, result.type);
    } catch(err) {
      console.error('Parse error:', det.file.name, err);
      window.toast('❌ ' + det.file.name + ': ' + err.message, '#c2410c');
    }

    done++;
    _saSetProgress(40 + Math.round(done / detections.length * 55), `ประมวลผล ${done}/${detections.length}...`);
  }

  _saSetProgress(100, '✓ เสร็จสิ้น');
  setTimeout(() => {
    document.getElementById('sa-upload-progress').style.display = 'none';
  }, 2000);

  _saShowDashboard();
};

// ─── Show dashboard ───────────────────────────────────────────
function _saShowDashboard() {
  document.getElementById('sa-upload-card').style.display = 'none';
  document.getElementById('sa-pages').style.display = '';
  _saBuildFilterPane();
  _saRenderAll();
}

// ─── Render all active page ───────────────────────────────────
function _saRenderAll() {
  const page = window._saState.activePage;
  if (page === 'overview')  _saRenderOverview();
  if (page === 'trend')     _saRenderTrend();
  if (page === 'products')  _saRenderProducts();
  if (page === 'channel')   _saRenderChannel();
  if (page === 'promo')     _saRenderPromo();
}

// ─── getActiveProductData (with filters applied) ──────────────
function _saGetProductData() {
  const st    = window._saState;
  const src   = st.data.daily_product || st.data.product;
  if (!src) return null;
  const filter = { branches: st.filterBranch, categories: st.filterCat, search: st.filterSearch };
  const hasFilter = st.filterBranch.size || st.filterCat.size || st.filterSearch;
  const rows  = hasFilter ? SA.filterProductRows(src.rows, filter) : src.rows;
  return hasFilter ? SA.aggregateProductData(rows) : src.summary;
}

// ─── Page: Overview ──────────────────────────────────────────
function _saRenderOverview() {
  const data = window._saState.data;
  const pd   = _saGetProductData();
  const bd   = data.bill?.summary;
  const prd  = data.promo?.summary;

  SACharts.renderKPICards({ product: pd, bill: bd, promo: prd }, 'sa-kpi-container');

  const byBranch   = pd?.byBranch   || bd?.byBranch   || [];
  const byCategory = pd?.byCategory || bd?.byCategory || [];
  const topProds   = pd?.topProducts || [];

  SACharts.renderBranchChart(byBranch, 'sa-branch-chart');
  SACharts.renderCategoryChart(byCategory, 'sa-cat-chart', 'sa-cat-legend');

  const displayProds = topProds.map(p => ({
    ...p,
    name: window._saState.showCodes ? (p.rawName || p.name) : p.name
  }));
  SACharts.renderTopProductsChart(displayProds, 'sa-product-chart', window._saState.productMode);
}

// ─── Page: Trend ─────────────────────────────────────────────
function _saRenderTrend() {
  const src = window._saState.data.daily_product || window._saState.data.bill;
  if (!src) { return; }
  const byDate   = src.summary.byDate || [];
  const byBranch = src.summary.byBranch || [];
  SACharts.renderTrendChart(byDate, 'sa-trend-chart', window._saState.trendGroup);
  SACharts.renderBranchChart(byBranch, 'sa-trend-branch-chart');
}

// ─── Page: Products ──────────────────────────────────────────
function _saRenderProducts() {
  const pd = _saGetProductData();
  if (!pd) return;
  const total = pd.totalRevenue || 1;
  const prods = pd.topProducts || [];
  document.getElementById('sa-table-count').textContent = prods.length.toLocaleString() + ' รายการ';
  document.getElementById('sa-detail-tbody').innerHTML = prods.map((p,i) => {
    const name = window._saState.showCodes ? (p.rawName || p.name) : p.name;
    const pct  = (p.revenue / total * 100);
    return `<tr>
      <td style="color:#8a8886;font-size:10px;">${i+1}</td>
      <td>${name}</td>
      <td><span style="font-size:9px;background:#f3f2f1;padding:2px 6px;border-radius:2px;color:#605e5c;">${p.category||'—'}</span></td>
      <td class="num">${p.revenue.toLocaleString('th-TH')}</td>
      <td class="num">${p.qty.toLocaleString('th-TH')}</td>
      <td class="num">฿${(p.avgPrice||0).toLocaleString('th-TH')}</td>
      <td class="num" style="color:#8a8886;">${pct.toFixed(1)}%</td>
      <td><div class="pbi-databar-wrap"><div class="pbi-databar-fill" style="width:${pct*5}%;max-width:100%;background:#f0b429;"></div><span class="pbi-databar-text">${pct.toFixed(1)}%</span></div></td>
    </tr>`;
  }).join('');
}

// ─── Page: Channel ────────────────────────────────────────────
function _saRenderChannel() {
  const bd = window._saState.data.bill?.summary;
  if (!bd) {
    document.getElementById('sa-channel-no-data').style.display = '';
    document.getElementById('sa-channel-content').style.display = 'none';
    return;
  }
  document.getElementById('sa-channel-no-data').style.display  = 'none';
  document.getElementById('sa-channel-content').style.display  = '';

  SACharts.renderPieChart(bd.byOrderType || [], 'type',        'sa-ordertype-chart', 'sa-ordertype-legend');
  SACharts.renderPieChart(bd.byChannel   || [], 'channel',     'sa-channel-chart',   'sa-channel-legend');
  SACharts.renderPieChart(bd.byPayment   || [], 'payment',     'sa-payment-chart',   'sa-payment-legend');

  const fmtB = n => '฿'+Number(n||0).toLocaleString('th-TH',{maximumFractionDigits:0});
  document.getElementById('sa-staff-tbody').innerHTML = (bd.byStaff||[]).slice(0,15).map((s,i) => `
    <tr>
      <td style="color:#8a8886;">${i+1}</td>
      <td>${s.staff}</td>
      <td class="num">${fmtB(s.revenue)}</td>
      <td class="num">${s.bills}</td>
      <td class="num">${fmtB(s.avgBill)}</td>
    </tr>`).join('');
}

// ─── Page: Promo ─────────────────────────────────────────────
function _saRenderPromo() {
  const pr = window._saState.data.promo;
  if (!pr?.summary) {
    document.getElementById('sa-promo-no-data').style.display    = '';
    document.getElementById('sa-promo-content').style.display    = 'none';
    return;
  }
  document.getElementById('sa-promo-no-data').style.display  = 'none';
  document.getElementById('sa-promo-content').style.display  = '';
  const pd = pr.summary;
  document.getElementById('sa-promo-kpi').textContent =
    'ส่วนลดรวม ฿' + (pd.totalDiscount||0).toLocaleString('th-TH') + ' • ' + (pd.totalUsage||0).toLocaleString() + ' ครั้ง';

  SACharts.renderPromoChart(pd.byPromo||[], 'sa-promo-chart');

  // branch bar for promo
  const branchData = (pd.byBranch||[]).map(b => ({ ...b, revenue: b.discountAmt }));
  SACharts.renderBranchChart(branchData, 'sa-promo-branch-chart');

  const fmtB = n => '฿'+Number(n||0).toLocaleString('th-TH',{maximumFractionDigits:0});
  document.getElementById('sa-promo-tbody').innerHTML = (pd.byPromo||[]).map((p,i) => `
    <tr>
      <td style="color:#8a8886;">${i+1}</td>
      <td>${p.promoName}</td>
      <td style="font-size:10px;color:#8a8886;">${p.promoType||'—'}</td>
      <td class="num">${(p.usageCount||0).toLocaleString()}</td>
      <td class="num">${fmtB(p.discountAmt)}</td>
      <td class="num">${p.branches||'—'}</td>
    </tr>`).join('');
}

// ─── Filter pane ─────────────────────────────────────────────
function _saBuildFilterPane() {
  const src = window._saState.data.daily_product || window._saState.data.product || window._saState.data.bill;
  if (!src) return;
  const branches   = src.summary.branches   || [];
  const categories = (src.summary.categories || src.summary.byCategory?.map(c=>c.category) || []).sort();
  const st = window._saState;

  document.getElementById('sa-fp-branches').innerHTML = branches.map(b => {
    const label = b.replace('สาขา','').trim();
    const on    = st.filterBranch.has(b) ? 'on' : '';
    return `<div class="sa-slicer-item ${on}" onclick="_saToggleBranch('${b.replace(/'/g,"\\'")}',this)">
      <div class="sa-cb ${on}">${on?'✓':''}</div>${label}
    </div>`;
  }).join('');

  document.getElementById('sa-fp-categories').innerHTML = categories.map(c => {
    const on = st.filterCat.has(c) ? 'on' : '';
    return `<div class="sa-slicer-item ${on}" onclick="_saToggleCat('${c.replace(/'/g,"\\'")}',this)">
      <div class="sa-cb ${on}">${on?'✓':''}</div>${c}
    </div>`;
  }).join('');
}

window._saToggleBranch = function(b, el) {
  const st = window._saState;
  if (st.filterBranch.has(b)) st.filterBranch.delete(b);
  else st.filterBranch.add(b);
  el.classList.toggle('on', st.filterBranch.has(b));
  el.querySelector('.sa-cb').classList.toggle('on', st.filterBranch.has(b));
  el.querySelector('.sa-cb').textContent = st.filterBranch.has(b) ? '✓' : '';
  _saApplyFilters();
};

window._saToggleCat = function(c, el) {
  const st = window._saState;
  if (st.filterCat.has(c)) st.filterCat.delete(c);
  else st.filterCat.add(c);
  el.classList.toggle('on', st.filterCat.has(c));
  el.querySelector('.sa-cb').classList.toggle('on', st.filterCat.has(c));
  el.querySelector('.sa-cb').textContent = st.filterCat.has(c) ? '✓' : '';
  _saApplyFilters();
};

window._saFilterClear = function() {
  window._saState.filterBranch = new Set();
  window._saState.filterCat    = new Set();
  window._saState.filterSearch = '';
  const si = document.getElementById('sa-fp-search');
  if (si) si.value = '';
  document.querySelectorAll('.sa-slicer-item').forEach(el => {
    el.classList.remove('on');
    const cb = el.querySelector('.sa-cb');
    if (cb) { cb.classList.remove('on'); cb.textContent = ''; }
  });
  _saApplyFilters();
};

window._saApplyFilters = function() {
  window._saState.filterSearch = (document.getElementById('sa-fp-search')?.value||'').trim().toLowerCase();
  _saRenderAll();
};

// ─── Page navigation ─────────────────────────────────────────
window._saPage = function(page, btn) {
  window._saState.activePage = page;
  document.querySelectorAll('.sa-nav-item').forEach(b => b.classList.remove('on'));
  document.querySelectorAll('.sa-page-tab').forEach(b => b.classList.remove('on'));
  ['overview','trend','products','channel','promo','history'].forEach(p => {
    const el = document.getElementById('sa-page-'+p);
    if (el) el.style.display = p === page ? '' : 'none';
  });
  document.getElementById('sa-nav-'+page)?.classList.add('on');
  document.getElementById('sa-tab-'+page)?.classList.add('on');

  if (page === 'history') _saLoadHistory();
  else _saRenderAll();
};

// ─── Trend group ─────────────────────────────────────────────
window._saTrendGroup = function(g, btn) {
  window._saState.trendGroup = g;
  document.querySelectorAll('#sa-page-trend .sa-group-tab').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  _saRenderTrend();
};

// ─── Product tab ─────────────────────────────────────────────
window._saProductTab = function(mode, btn) {
  window._saState.productMode = mode;
  document.querySelectorAll('#sa-page-overview .sa-group-tab').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  const pd = _saGetProductData();
  if (!pd) return;
  const prods = pd.topProducts.map(p => ({...p, name: window._saState.showCodes?(p.rawName||p.name):p.name}));
  SACharts.renderTopProductsChart(prods, 'sa-product-chart', mode);
};

// ─── File tab management ─────────────────────────────────────
function _saAddFileTab(fileName, type) {
  const typeLabel = { daily_product:'สินค้าตามวัน', product:'สินค้า', bill:'บิล', promo:'โปรโม' };
  const tabs = document.getElementById('sa-file-tabs');
  const shortName = fileName.length > 22 ? fileName.slice(0,22)+'…' : fileName;
  const existing  = tabs.querySelector(`[data-type="${type}"]`);
  if (existing) { existing.textContent = shortName; return; }
  const tab = document.createElement('button');
  tab.className = 'sa-file-tab on';
  tab.setAttribute('data-type', type);
  tab.textContent = shortName;
  tab.title = `${typeLabel[type]||type}: ${fileName}`;
  tabs.insertBefore(tab, tabs.querySelector('.sa-file-tab-add'));
}

// ─── Progress ────────────────────────────────────────────────
function _saSetProgress(pct, msg) {
  const prog = document.getElementById('sa-upload-progress');
  const fill = document.getElementById('sa-prog-fill');
  const txt  = document.getElementById('sa-status-text');
  if (!prog) return;
  prog.style.display = pct > 0 ? '' : 'none';
  if (fill) fill.style.width = pct + '%';
  if (txt)  txt.textContent  = msg;
}

// ─── Export ──────────────────────────────────────────────────
window._saExportExcel = function() {
  const src = window._saState.data.daily_product || window._saState.data.product;
  if (!src) { window.toast('❌ ไม่มีข้อมูลสำหรับ Export','#c2410c'); return; }
  if (!window.SAExport?.exportToExcel) { window.toast('❌ โมดูล Export ยังไม่โหลด','#c2410c'); return; }
  try {
    const pd  = src.summary;
    const bd  = window._saState.data.bill?.summary;
    const prd = window._saState.data.promo?.summary;
    const report = {
      ...pd,
      fileName : src.fileName,
      period   : src.fileName?.split('.')[0] || '',
      byOrderType : bd?.byOrderType || [],
      byPromo     : prd?.byPromo    || [],
    };
    SAExport.exportToExcel(report, window._saState.showCodes);
    window.toast('✅ Export Excel สำเร็จ','#059669');
  } catch(e) { window.toast('❌ '+e.message,'#c2410c'); console.error(e); }
};

window._saExportPDF = function() {
  const src = window._saState.data.daily_product || window._saState.data.product;
  if (!src) { window.toast('❌ ไม่มีข้อมูลสำหรับ Export','#c2410c'); return; }
  if (!window.SAExport?.exportToPDF) { window.toast('❌ โมดูล Export ยังไม่โหลด','#c2410c'); return; }
  try { SAExport.exportToPDF(SAExport.buildExportReport(src.summary)); }
  catch(e) { window.toast('❌ '+e.message,'#c2410c'); console.error(e); }
};

// ─── Save to Firestore ────────────────────────────────────────
window._saSaveReport = async function() {
  const src = window._saState.data.daily_product || window._saState.data.product;
  if (!src) { window.toast('ไม่มีข้อมูล','#c2410c'); return; }
  try {
    window.toast('⏳ กำลังบันทึก...');
    const id = await SA.saveReportToFirestore(window.db, {
      fileName : src.fileName,
      period   : src.fileName?.split('.')[0] || '',
      summary  : src.summary,
      rows     : src.rows || [],
    });
    window.toast('✅ บันทึกสำเร็จ','#059669');
  } catch(e) { window.toast('❌ '+e.message,'#c2410c'); }
};

// ─── History ─────────────────────────────────────────────────
window._saLoadHistory = async function() {
  try {
    window._saState.savedReports = await SA.loadReportList(window.db, 30);
    _saRenderHistory();
  } catch(e) {
    document.getElementById('sa-history-list').innerHTML =
      `<div style="font-size:11px;color:#d83b01;padding:12px;">❌ โหลดไม่ได้: ${e.message}</div>`;
  }
};

function _saRenderHistory() {
  const reports = window._saState.savedReports || [];
  const el = document.getElementById('sa-history-list');
  if (!reports.length) { el.innerHTML='<div style="font-size:11px;color:#8a8886;padding:12px;text-align:center;">ยังไม่มีรายงาน</div>'; return; }
  const fmtB = n => '฿'+Math.round((n||0)/1000)+'K';
  el.innerHTML = reports.map(r => {
    const date = r.uploadedAt?.toDate ? r.uploadedAt.toDate().toLocaleDateString('th-TH') : '—';
    return `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:0.5px solid #e1dfdd;border-radius:2px;margin-bottom:5px;cursor:pointer;font-size:11px;background:white;" onclick="_saHistoryDetail('${r.id}')">
      <div style="flex:1;overflow:hidden;"><div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${r.period||r.fileName||r.id}</div>
      <div style="color:#8a8886;">${date} • ${r.summary?.branchCount||0} สาขา</div></div>
      <div style="font-weight:600;">${fmtB(r.summary?.totalRevenue)}</div>
      <button style="font-size:10px;padding:2px 7px;border:0.5px solid #fca5a5;background:white;cursor:pointer;color:#d83b01;border-radius:2px;" onclick="event.stopPropagation();_saDeleteReport('${r.id}')">ลบ</button>
    </div>`;
  }).join('');
}

window._saHistoryDetail = function(id) {
  const r = (window._saState.savedReports||[]).find(x=>x.id===id);
  if (!r) return;
  const fmtB = n => '฿'+Number(n||0).toLocaleString('th-TH',{maximumFractionDigits:0});
  document.getElementById('sa-history-detail').innerHTML = `
    <div style="font-size:13px;font-weight:600;margin-bottom:10px;">${r.period||r.fileName||''}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:12px;">
      <div class="pbi-kpi pbi-kpi-rev"><div class="pbi-kpi-label">ยอดขาย</div><div style="font-size:16px;font-weight:300;">${fmtB(r.summary?.totalRevenue)}</div></div>
      <div class="pbi-kpi pbi-kpi-qty"><div class="pbi-kpi-label">รายการ</div><div style="font-size:16px;font-weight:300;">${(r.summary?.totalQty||0).toLocaleString()}</div></div>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;">
      <button class="sa-tbtn save" style="font-size:11px;" onclick="_saOpenHistoryDashboard('${id}')">เปิด Dashboard</button>
      <button class="sa-tbtn exp" style="font-size:11px;" onclick="SAExport.exportToExcel(SAExport.buildExportReport(window._saState.savedReports.find(x=>x.id==='${id}')||{}))">Excel</button>
      <button class="sa-tbtn exp" style="font-size:11px;" onclick="SAExport.exportToPDF(SAExport.buildExportReport(window._saState.savedReports.find(x=>x.id==='${id}')||{}))">PDF</button>
    </div>`;
};

window._saOpenHistoryDashboard = async function(id) {
  try {
    window.toast('⏳ กำลังโหลด...');
    const r = await SA.loadReport(window.db, id);
    if (!r) { window.toast('❌ ไม่พบรายงาน','#c2410c'); return; }
    window._saState.data.product = { rows:[], summary: { ...r, ...r.summary }, fileName: r.fileName };
    _saShowDashboard();
    _saPage('overview', document.getElementById('sa-nav-overview'));
    window.toast('✅ โหลดสำเร็จ','#059669');
  } catch(e) { window.toast('❌ '+e.message,'#c2410c'); }
};

window._saDeleteReport = async function(id) {
  if (!confirm('ต้องการลบรายงานนี้?')) return;
  try { await SA.deleteReport(window.db, id); window.toast('✅ ลบสำเร็จ','#059669'); _saLoadHistory(); }
  catch(e) { window.toast('❌ '+e.message,'#c2410c'); }
};

// ─── Register hash nav ────────────────────────────────────────
if (window.navFnMap) window.navFnMap['sales-analytics'] = () => window.openSalesAnalytics();

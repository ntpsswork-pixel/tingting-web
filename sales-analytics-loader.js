// ============================================================
//  TTGPlus — Sales Analytics Loader
//  sales-analytics-loader.js
//  เปิดโมดูล Sales Analytics ภายใน toolAppContainer ของ home.html
// ============================================================

window.openSalesAnalytics = async function() {
  // ── 1. โหลด SheetJS ถ้ายังไม่มี ──
  if (typeof XLSX === 'undefined') {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  // ── 2. โหลด Chart.js ถ้ายังไม่มี ──
  if (typeof Chart === 'undefined') {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  // ── 3. โหลด SA modules ถ้ายังไม่มี ──
  if (typeof window.SA === 'undefined') {
    await _loadScript('sales-analytics.js');
  }
  if (typeof window.SACharts === 'undefined') {
    await _loadScript('sales-analytics-charts.js');
  }
  if (typeof window.SAExport === 'undefined') {
    await _loadScript('sales-analytics-export.js');
  }

  // ── 4. Switch view ──
  document.getElementById('dashboardView')?.classList.add('hidden');
  const container = document.getElementById('toolAppContainer');
  container.classList.remove('hidden');

  // ── 5. Render UI ──
  container.innerHTML = _buildSAHTML();
  _initSAEvents();

  // push nav hash
  if (location.hash !== '#sales-analytics') {
    history.pushState({ nav: 'sales-analytics' }, '', '#sales-analytics');
  }
};

// ─── Script loader ────────────────────────────────────────────
function _loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.defer = true;
    s.onload = () => setTimeout(res, 50);
    s.onerror = rej;
    document.head.appendChild(s);
  });
}

// ─── Build HTML ───────────────────────────────────────────────
function _buildSAHTML() {
  return `
<style>
.sa-kpi-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:20px;}
.sa-kpi{background:#f8fafc;border-radius:10px;padding:14px 16px;border:1px solid #eef1f6;}
.sa-kpi-label{font-size:11px;color:#94a3b8;margin-bottom:5px;text-transform:uppercase;letter-spacing:.5px;font-weight:700;}
.sa-kpi-value{font-size:22px;font-weight:700;color:#0f172a;line-height:1.2;}
.sa-kpi-sub{font-size:11px;color:#94a3b8;margin-top:3px;}
.sa-card{background:white;border-radius:14px;padding:18px 20px;border:1px solid #eef1f6;box-shadow:0 1px 4px rgba(0,0,0,0.05);}
.sa-card-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:#94a3b8;margin-bottom:14px;}
.sa-grid-2{display:grid;grid-template-columns:2fr 1fr;gap:14px;margin-bottom:14px;}
.sa-grid-1{margin-bottom:14px;}
.sa-tab-bar{display:flex;gap:4px;}
.sa-tab{font-size:12px;padding:5px 14px;border-radius:8px;border:1px solid #e2e8f0;cursor:pointer;background:transparent;color:#64748b;font-family:inherit;transition:.15s;}
.sa-tab:hover{background:#f8fafc;}
.sa-tab.active{background:#f8fafc;color:#0f172a;font-weight:600;border-color:#cbd5e1;}
.sa-btn{display:inline-flex;align-items:center;gap:6px;font-size:12px;padding:7px 14px;border-radius:9px;border:1px solid #e2e8f0;cursor:pointer;background:white;color:#334155;font-family:inherit;font-weight:500;transition:.15s;}
.sa-btn:hover{background:#f8fafc;border-color:#cbd5e1;}
.sa-btn.primary{background:linear-gradient(135deg,#f0b429,#d97706);color:#0f172a;border:none;font-weight:700;}
.sa-btn.danger{color:#ef4444;border-color:#fca5a5;}
.sa-upload-zone{border:2px dashed #e2e8f0;border-radius:14px;padding:36px 24px;text-align:center;cursor:pointer;transition:.2s;}
.sa-upload-zone:hover,.sa-upload-zone.drag-over{border-color:#f0b429;background:#fffbeb;}
.sa-progress-bar{height:5px;background:#f1f5f9;border-radius:3px;overflow:hidden;margin-top:10px;}
.sa-progress-fill{height:100%;background:linear-gradient(90deg,#f0b429,#3b82f6);border-radius:3px;transition:width .3s;}
.sa-status{font-size:12px;color:#64748b;margin-top:6px;}
.sa-table-wrap{overflow-x:auto;}
.sa-table{width:100%;border-collapse:collapse;font-size:12px;}
.sa-table th{font-weight:600;color:#64748b;padding:8px 10px;border-bottom:1.5px solid #e8ecf0;text-align:left;background:#f8fafc;white-space:nowrap;}
.sa-table td{padding:6px 10px;border-bottom:1px solid #f4f6fa;color:#1e293b;}
.sa-table tr:hover td{background:#f8fafc;}
.sa-table .num{text-align:right;}
.sa-table .rank{color:#94a3b8;width:28px;}
.sa-badge{display:inline-block;font-size:10px;font-weight:600;padding:2px 8px;border-radius:10px;}
.sa-bh{background:#fef3c7;color:#92400e;}.sa-bb{background:#dbeafe;color:#1d4ed8;}
.sa-bp{background:#ede9fe;color:#5b21b6;}.sa-bt{background:#d1fae5;color:#065f46;}
.sa-bf{background:#fee2e2;color:#991b1b;}.sa-bc{background:#fce7f3;color:#9d174d;}
.sa-bg{background:#f1f5f9;color:#475569;}
.sa-leg-item{display:flex;align-items:center;gap:6px;margin-bottom:7px;}
.sa-leg-dot{width:9px;height:9px;border-radius:2px;flex-shrink:0;}
.sa-leg-name{font-size:12px;color:#64748b;flex:1;}
.sa-leg-val{font-size:12px;color:#0f172a;font-weight:600;}
.sa-leg-pct{font-size:11px;color:#94a3b8;width:38px;text-align:right;}
.sa-report-item{display:flex;align-items:center;gap:10px;padding:11px 14px;border:1px solid #e8ecf0;border-radius:10px;margin-bottom:7px;cursor:pointer;transition:.15s;background:white;}
.sa-report-item:hover{background:#f8fafc;border-color:#cbd5e1;}
.sa-report-item.active{border-color:#f0b429;background:#fffbeb;}
.sa-view-tabs{display:flex;gap:3px;background:#f1f5f9;padding:3px;border-radius:9px;}
.sa-view-tab{padding:5px 16px;font-size:12px;border-radius:7px;cursor:pointer;border:none;background:transparent;color:#64748b;font-family:inherit;transition:.15s;font-weight:500;}
.sa-view-tab.active{background:white;color:#0f172a;font-weight:600;box-shadow:0 1px 3px rgba(0,0,0,0.07);}
.sa-toggle-wrap{display:flex;align-items:center;gap:7px;font-size:12px;color:#64748b;}
.sa-toggle{position:relative;width:34px;height:18px;flex-shrink:0;}
.sa-toggle input{opacity:0;width:0;height:0;position:absolute;}
.sa-toggle-track{position:absolute;inset:0;background:#e2e8f0;border-radius:9px;transition:.2s;cursor:pointer;}
.sa-toggle input:checked+.sa-toggle-track{background:#f0b429;}
.sa-toggle-thumb{position:absolute;top:2px;left:2px;width:14px;height:14px;background:white;border-radius:50%;transition:.2s;pointer-events:none;}
.sa-toggle input:checked~.sa-toggle-thumb{transform:translateX(16px);}
.sa-donut-wrap{display:flex;align-items:center;gap:14px;}
.sa-donut-center{position:relative;flex-shrink:0;}
.sa-donut-label{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;pointer-events:none;}
.sa-donut-label-top{font-size:9px;color:#94a3b8;}
.sa-donut-label-val{font-size:12px;font-weight:700;color:#0f172a;}
@media(max-width:900px){.sa-grid-2{grid-template-columns:1fr;}.sa-kpi-grid{grid-template-columns:1fr 1fr;}}
</style>

<div style="padding:24px 28px;" id="saWrap">
  <!-- Header -->
  <div class="tool-header" style="border-bottom:1px solid #e2e8f0;padding-bottom:16px;margin-bottom:20px;">
    <div>
      <h2 style="font-size:18px;font-weight:800;color:#0f172a;">📊 Sales Analytics</h2>
      <div style="font-size:12px;color:#94a3b8;margin-top:2px;">วิเคราะห์ยอดขายตามสินค้า • TingTing Group</div>
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
        <button class="sa-view-tab" onclick="_saView('history')"   id="sa-tab-history">ประวัติ</button>
        <button class="sa-view-tab" onclick="_saView('compare')"   id="sa-tab-compare">เปรียบเทียบ</button>
      </div>
      <button class="sa-btn" onclick="closeTool()" style="padding:6px 12px;color:#ef4444;border-color:#fca5a5;">✕ ปิด</button>
    </div>
  </div>

  <!-- VIEW: Dashboard -->
  <div id="sa-view-dashboard">
    <!-- Upload Section -->
    <div class="sa-card" style="margin-bottom:16px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
        <div class="sa-card-title" style="margin-bottom:0;">อัปโหลดรายงาน Excel</div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <input type="text" id="sa-period-input" placeholder="งวด เช่น ม.ค. 2568"
            style="font-size:12px;padding:6px 11px;border:1px solid #e2e8f0;border-radius:8px;width:150px;font-family:inherit;outline:none;">
          <label class="sa-btn primary" for="sa-file-input">
            ⬆ เลือกไฟล์
          </label>
          <input type="file" id="sa-file-input" accept=".xlsx,.xls,.csv" style="display:none;">
        </div>
      </div>
      <div id="sa-drop-zone" class="sa-upload-zone">
        <div style="font-size:32px;margin-bottom:8px;">📊</div>
        <div style="font-size:14px;font-weight:600;margin-bottom:4px;">ลากไฟล์ Excel มาวางที่นี่</div>
        <div style="font-size:12px;color:#94a3b8;">รองรับ .xlsx, .xls, .csv &nbsp;•&nbsp; Map คอลัมน์อัตโนมัติ</div>
      </div>
      <div id="sa-upload-progress" style="display:none;">
        <div class="sa-progress-bar"><div class="sa-progress-fill" id="sa-progress-fill" style="width:0%"></div></div>
        <div class="sa-status" id="sa-status-text">กำลังอ่านไฟล์...</div>
      </div>
    </div>

    <!-- Dashboard content (hidden until data loaded) -->
    <div id="sa-dashboard-content" style="display:none;">
      <!-- Current report bar -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;gap:10px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:20px;">📋</span>
          <div>
            <div style="font-weight:700;font-size:14px;" id="sa-report-name">—</div>
            <div style="font-size:11px;color:#94a3b8;" id="sa-report-meta">—</div>
          </div>
        </div>
        <div style="display:flex;gap:7px;flex-wrap:wrap;">
          <button class="sa-btn" onclick="SAExport.exportToExcel(window._saCurrentReport, document.getElementById('sa-toggle-codes').checked)">📥 Excel</button>
          <button class="sa-btn" onclick="SAExport.exportToPDF(window._saCurrentReport)">🖨 PDF</button>
          <button class="sa-btn primary" onclick="_saSaveReport()">💾 บันทึก</button>
          <button class="sa-btn danger" onclick="_saClearDashboard()">✕ ล้าง</button>
        </div>
      </div>

      <!-- KPI -->
      <div id="sa-kpi-container"></div>

      <!-- Branch + Category -->
      <div class="sa-grid-2">
        <div class="sa-card">
          <div class="sa-card-title">ยอดขายตามสาขา</div>
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
          <div class="sa-card-title" style="margin-bottom:0;">สินค้าขายดี Top 15</div>
          <div class="sa-tab-bar">
            <button class="sa-tab active" onclick="_saProductTab('revenue',this)">ยอดรวม</button>
            <button class="sa-tab" onclick="_saProductTab('qty',this)">จำนวน</button>
          </div>
        </div>
        <div style="position:relative;height:420px;"><canvas id="sa-product-chart"></canvas></div>
      </div>

      <!-- Detail Table -->
      <div class="sa-card sa-grid-1">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
          <div class="sa-card-title" style="margin-bottom:0;">รายละเอียดสินค้า</div>
          <div style="display:flex;gap:8px;align-items:center;">
            <input type="text" id="sa-search" placeholder="ค้นหาสินค้า..."
              style="font-size:12px;padding:5px 10px;border:1px solid #e2e8f0;border-radius:8px;width:170px;font-family:inherit;outline:none;"
              oninput="_saFilterTable(this.value)">
            <span style="font-size:12px;color:#94a3b8;" id="sa-table-count">0 รายการ</span>
          </div>
        </div>
        <div class="sa-table-wrap">
          <table class="sa-table">
            <thead><tr>
              <th class="rank">#</th>
              <th>ชื่อสินค้า</th>
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
  </div>

  <!-- VIEW: History -->
  <div id="sa-view-history" style="display:none;">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
      <div class="sa-card">
        <div class="sa-card-title">รายงานที่บันทึกไว้</div>
        <div id="sa-history-list">
          <div style="text-align:center;padding:32px;color:#94a3b8;">
            <div style="font-size:32px;margin-bottom:8px;">📂</div>
            <div style="font-size:12px;">ยังไม่มีรายงาน</div>
          </div>
        </div>
        <button class="sa-btn" style="width:100%;margin-top:10px;justify-content:center;" onclick="_saLoadHistory()">🔄 โหลดใหม่</button>
      </div>
      <div class="sa-card" id="sa-history-detail">
        <div class="sa-card-title">รายละเอียด</div>
        <div style="text-align:center;padding:32px;color:#94a3b8;">
          <div style="font-size:28px;margin-bottom:8px;">👆</div>
          <div style="font-size:12px;">เลือกรายงานทางซ้าย</div>
        </div>
      </div>
    </div>
  </div>

  <!-- VIEW: Compare -->
  <div id="sa-view-compare" style="display:none;">
    <div class="sa-card" style="margin-bottom:14px;">
      <div class="sa-card-title">เปรียบเทียบหลายงวด</div>
      <div style="font-size:12px;color:#94a3b8;margin-bottom:12px;">เลือกรายงาน 2 รายการขึ้นไป</div>
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
    <div id="sa-compare-charts" style="display:none;display:grid;grid-template-columns:1fr 1fr;gap:14px;">
      <div class="sa-card">
        <div class="sa-card-title">แนวโน้ม</div>
        <div style="position:relative;height:250px;"><canvas id="sa-trend-chart"></canvas></div>
      </div>
      <div class="sa-card">
        <div class="sa-card-title">เปรียบเทียบสาขา</div>
        <div style="position:relative;height:250px;"><canvas id="sa-branch-compare-chart"></canvas></div>
      </div>
    </div>
  </div>

</div>`;
}

// ─── Init events ──────────────────────────────────────────────
function _initSAEvents() {
  window._saShowCodes   = false;
  window._saProductMode = 'revenue';
  window._saTrendMode   = 'totalRevenue';
  window._saAllProducts = [];
  window._saSavedReports = [];
  window._saCompareSelected = new Set();

  // Toggle codes
  document.getElementById('sa-toggle-codes').addEventListener('change', function() {
    window._saShowCodes = this.checked;
    if (window._saCurrentReport) _saRenderDashboard(window._saCurrentReport);
  });

  // File input
  document.getElementById('sa-file-input').addEventListener('change', e => {
    if (e.target.files[0]) _saProcessFile(e.target.files[0]);
  });

  // Drag & drop
  const dz = document.getElementById('sa-drop-zone');
  dz.addEventListener('dragover',  e => { e.preventDefault(); dz.classList.add('drag-over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
  dz.addEventListener('drop', e => {
    e.preventDefault(); dz.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) _saProcessFile(e.dataTransfer.files[0]);
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

// ─── Process file ─────────────────────────────────────────────
window._saProcessFile = async function(file) {
  if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
    window.toast('❌ รองรับเฉพาะ .xlsx, .xls, .csv', '#c2410c'); return;
  }
  try {
    _saSetProgress(10, 'กำลังอ่านไฟล์...');
    const period = document.getElementById('sa-period-input').value.trim();
    _saSetProgress(35, 'กำลัง map คอลัมน์...');
    const { rows } = await SA.parseExcelFile(file, window._saShowCodes);
    _saSetProgress(65, 'กำลังคำนวณสรุป...');
    const summary = SA.aggregateData(rows);
    _saSetProgress(90, 'กำลังวาด dashboard...');
    const report = { ...summary, fileName: file.name, period, rows };
    window._saCurrentReport = report;
    _saRenderDashboard(report);
    _saSetProgress(100, `✓ สำเร็จ — ${rows.length.toLocaleString()} แถว, ${summary.branchCount} สาขา`);
    window.toast(`✅ โหลดสำเร็จ — ${rows.length.toLocaleString()} รายการ`, '#059669');
    setTimeout(() => { document.getElementById('sa-upload-progress').style.display = 'none'; }, 3000);
  } catch (err) {
    _saSetProgress(0, '❌ ข้อผิดพลาด: ' + err.message);
    window.toast('❌ ' + err.message, '#c2410c');
  }
};

// ─── Render dashboard ─────────────────────────────────────────
window._saRenderDashboard = function(report) {
  document.getElementById('sa-dashboard-content').style.display = '';

  const displayReport = {
    ...report,
    topProducts: report.topProducts.map(p => ({
      ...p,
      name: window._saShowCodes ? (p.rawName || p.name) : SA.stripProductCode(p.rawName || p.name)
    }))
  };

  document.getElementById('sa-report-name').textContent = report.period || report.fileName || 'รายงาน';
  document.getElementById('sa-report-meta').textContent =
    `${(report.totalQty||0).toLocaleString()} รายการ • ${report.branchCount} สาขา • ${report.productCount} สินค้า`;

  SACharts.renderKPICards(report, 'sa-kpi-container');
  document.getElementById('sa-donut-total').textContent =
    '฿' + Math.round((report.totalRevenue||0)/1000) + 'K';
  SACharts.renderBranchChart(report.byBranch, 'sa-branch-chart');
  SACharts.renderCategoryChart(report.byCategory, 'sa-cat-chart', 'sa-cat-legend');
  SACharts.renderTopProductsChart(displayReport.topProducts, 'sa-product-chart', window._saProductMode);
  _saRenderTable(displayReport.topProducts, report.totalRevenue);
};

// ─── Product tab ──────────────────────────────────────────────
window._saProductTab = function(mode, btn) {
  window._saProductMode = mode;
  document.querySelectorAll('#sa-view-dashboard .sa-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (window._saCurrentReport) {
    const products = window._saCurrentReport.topProducts.map(p => ({
      ...p,
      name: window._saShowCodes ? (p.rawName||p.name) : SA.stripProductCode(p.rawName||p.name)
    }));
    SACharts.renderTopProductsChart(products, 'sa-product-chart', mode);
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
window._saAllProducts = [];
function _saRenderTable(products, total) {
  window._saAllProducts = products;
  document.getElementById('sa-table-count').textContent = products.length.toLocaleString() + ' รายการ';
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
window._saFilterTable = function(q) {
  const f = window._saAllProducts.filter(p =>
    p.name.toLowerCase().includes(q.toLowerCase()) ||
    (p.category||'').toLowerCase().includes(q.toLowerCase())
  );
  document.getElementById('sa-table-count').textContent = f.length + ' รายการ';
  const total = window._saCurrentReport?.totalRevenue || 0;
  document.getElementById('sa-detail-tbody').innerHTML = f.map((p, i) => `
    <tr>
      <td class="rank">${i+1}</td>
      <td>${p.name}</td>
      <td><span class="sa-badge ${_saGetBadge(p.category)}">${p.category||'อื่นๆ'}</span></td>
      <td class="num">${p.revenue.toLocaleString('th-TH')}</td>
      <td class="num">${p.qty.toLocaleString('th-TH')}</td>
      <td class="num">฿${(p.avgPrice||0).toLocaleString('th-TH')}</td>
      <td class="num" style="color:#94a3b8;">${total > 0 ? (p.revenue/total*100).toFixed(1) : 0}%</td>
    </tr>`).join('');
};
window._saClearDashboard = function() {
  window._saCurrentReport = null;
  document.getElementById('sa-dashboard-content').style.display = 'none';
  document.getElementById('sa-file-input').value = '';
  document.getElementById('sa-upload-progress').style.display = 'none';
};

// ─── Save to Firestore ────────────────────────────────────────
window._saSaveReport = async function() {
  const r = window._saCurrentReport;
  if (!r) { window.toast('ไม่มีข้อมูล', '#c2410c'); return; }
  try {
    window.toast('⏳ กำลังบันทึก...');
    const id = await SA.saveReportToFirestore(window.db, {
      fileName : r.fileName,
      period   : r.period,
      summary  : r,
      rows     : r.rows || [],
    });
    window._saCurrentReport._firestoreId = id;
    window.toast('✅ บันทึกสำเร็จ', '#059669');
  } catch (e) {
    window.toast('❌ บันทึกไม่สำเร็จ: ' + e.message, '#c2410c');
  }
};

// ─── History ──────────────────────────────────────────────────
window._saLoadHistory = async function() {
  try {
    window._saSavedReports = await SA.loadReportList(window.db, 30);
    _saRenderHistory();
    _saRenderCompareList();
  } catch (e) {
    document.getElementById('sa-history-list').innerHTML =
      `<div style="text-align:center;padding:20px;color:#ef4444;font-size:12px;">❌ โหลดไม่ได้: ${e.message}</div>`;
  }
};
function _saRenderHistory() {
  const el = document.getElementById('sa-history-list');
  const reports = window._saSavedReports || [];
  if (!reports.length) {
    el.innerHTML = `<div style="text-align:center;padding:32px;color:#94a3b8;"><div style="font-size:32px;margin-bottom:8px;">📂</div><div style="font-size:12px;">ยังไม่มีรายงาน</div></div>`;
    return;
  }
  el.innerHTML = reports.map(r => {
    const date = r.uploadedAt?.toDate
      ? r.uploadedAt.toDate().toLocaleDateString('th-TH') : '—';
    return `
      <div class="sa-report-item" onclick="_saHistoryDetail('${r.id}')" id="sa-ri-${r.id}">
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
  const r = (window._saSavedReports||[]).find(x => x.id === id);
  if (!r) return;
  const fmtB = n => '฿' + Number(n||0).toLocaleString('th-TH',{maximumFractionDigits:0});
  const fmtN = n => Number(n||0).toLocaleString('th-TH');
  const brRows = (r.byBranch||[]).map((b,i) => `
    <tr><td class="rank">${i+1}</td><td>${b.branch}</td>
    <td class="num">${fmtB(b.revenue)}</td><td class="num">${fmtN(b.qty)}</td></tr>`).join('');
  document.getElementById('sa-history-detail').innerHTML = `
    <div class="sa-card-title">รายละเอียด — ${r.period||r.fileName||''}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
      <div class="sa-kpi"><div class="sa-kpi-label">ยอดขาย</div><div class="sa-kpi-value">${fmtB(r.summary?.totalRevenue)}</div></div>
      <div class="sa-kpi"><div class="sa-kpi-label">รายการ</div><div class="sa-kpi-value">${fmtN(r.summary?.totalQty)}</div></div>
    </div>
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;margin-bottom:8px;">สาขา</div>
    <div class="sa-table-wrap" style="margin-bottom:12px;">
      <table class="sa-table">
        <thead><tr><th>#</th><th>สาขา</th><th class="num">ยอดขาย</th><th class="num">จำนวน</th></tr></thead>
        <tbody>${brRows}</tbody>
      </table>
    </div>
    <div style="display:flex;gap:7px;flex-wrap:wrap;">
      <button class="sa-btn primary" onclick="_saOpenHistoryDashboard('${id}')">เปิด Dashboard ↗</button>
      <button class="sa-btn" onclick="SAExport.exportToExcel(window._saSavedReports.find(x=>x.id==='${id}'))">Excel</button>
      <button class="sa-btn" onclick="SAExport.exportToPDF(window._saSavedReports.find(x=>x.id==='${id}'))">PDF</button>
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
  } catch (e) { window.toast('❌ '+e.message,'#c2410c'); }
};
window._saDeleteReport = async function(id) {
  if (!confirm('ต้องการลบรายงานนี้?')) return;
  try {
    await SA.deleteReport(window.db, id);
    window.toast('✅ ลบสำเร็จ','#059669');
    _saLoadHistory();
  } catch (e) { window.toast('❌ '+e.message,'#c2410c'); }
};

// ─── Compare ──────────────────────────────────────────────────
function _saRenderCompareList() {
  const el = document.getElementById('sa-compare-list');
  const reports = window._saSavedReports || [];
  if (!reports.length) {
    el.innerHTML = `<div style="font-size:12px;color:#94a3b8;">ยังไม่มีรายงาน</div>`;
    return;
  }
  el.innerHTML = reports.map(r => {
    const date = r.uploadedAt?.toDate ? r.uploadedAt.toDate().toLocaleDateString('th-TH') : '—';
    return `
      <label style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid #e8ecf0;border-radius:9px;cursor:pointer;font-size:12px;background:white;">
        <input type="checkbox" value="${r.id}" onchange="_saToggleCompare('${r.id}',this.checked)">
        <span>${r.period||r.fileName||r.id} <span style="color:#94a3b8;">(${date})</span></span>
      </label>`;
  }).join('');
}
window._saToggleCompare = function(id, checked) {
  if (checked) window._saCompareSelected.add(id);
  else window._saCompareSelected.delete(id);
};
window._saTrendMetric = function(m, btn) {
  window._saTrendMode = m;
  document.querySelectorAll('#sa-trend-tabs .sa-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _saRunCompare();
};
window._saRunCompare = function() {
  const selected = (window._saSavedReports||[]).filter(r => window._saCompareSelected.has(r.id));
  if (!selected.length) { window.toast('⚠️ เลือกอย่างน้อย 1 รายงาน','#c2410c'); return; }
  document.getElementById('sa-compare-charts').style.display = 'grid';
  SACharts.renderTrendChart(selected, 'sa-trend-chart', window._saTrendMode);
  SACharts.renderBranchCompareChart(selected, 'sa-branch-compare-chart');
};

// ─── Register nav hash ────────────────────────────────────────
// Extend existing navFnMap if available
if (window.navFnMap) {
  window.navFnMap['sales-analytics'] = () => window.openSalesAnalytics();
}

// ============================================================
//  TTGPlus — Sales Analytics Module
//  sales-analytics-charts.js  (Chart.js renders)
// ============================================================

const CAT_COLORS = [
  '#EF9F27','#3B8BD4','#7F77DD','#1D9E75',
  '#D85A30','#D4537E','#888780','#0F6E56','#185FA5',
];

function isDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

// Destroy existing chart on canvas before re-render
function destroyChart(id) {
  const existing = Chart.getChart(id);
  if (existing) existing.destroy();
}

// ─── KPI Summary Cards ────────────────────────────────────────
function renderKPICards(summary, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const fmtB = n => '฿' + Number(n).toLocaleString('th-TH', { maximumFractionDigits: 0 });
  const fmtN = n => Number(n).toLocaleString('th-TH');

  el.innerHTML = `
    <div class="sa-kpi-grid">
      <div class="sa-kpi">
        <div class="sa-kpi-label">ยอดขายสุทธิ</div>
        <div class="sa-kpi-value">${fmtB(summary.totalRevenue)}</div>
        <div class="sa-kpi-sub">ก่อนลด ${fmtB(summary.totalGross)}</div>
      </div>
      <div class="sa-kpi">
        <div class="sa-kpi-label">รายการขายรวม</div>
        <div class="sa-kpi-value">${fmtN(summary.totalQty)}</div>
        <div class="sa-kpi-sub">รายการ</div>
      </div>
      <div class="sa-kpi">
        <div class="sa-kpi-label">สินค้า</div>
        <div class="sa-kpi-value">${fmtN(summary.productCount)}</div>
        <div class="sa-kpi-sub">รายการ ใน ${summary.branchCount} สาขา</div>
      </div>
      <div class="sa-kpi">
        <div class="sa-kpi-label">ส่วนลดรวม</div>
        <div class="sa-kpi-value">${fmtB(summary.totalDiscount)}</div>
        <div class="sa-kpi-sub">${summary.discountRate.toFixed(2)}% ของยอดรวม</div>
      </div>
    </div>`;
}

// ─── Branch Bar Chart ─────────────────────────────────────────
function renderBranchChart(byBranch, canvasId) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const dark = isDark();
  const labels = byBranch.map(b => b.branch.replace('สาขา', '').trim());
  const data   = byBranch.map(b => b.revenue);
  const maxRev = Math.max(...data);

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'ยอดขาย (฿)',
        data,
        backgroundColor: byBranch.map((_, i) => CAT_COLORS[i % CAT_COLORS.length] + 'CC'),
        borderColor    : byBranch.map((_, i) => CAT_COLORS[i % CAT_COLORS.length]),
        borderWidth: 1,
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ' ฿' + ctx.raw.toLocaleString('th-TH')
          }
        }
      },
      scales: {
        x: {
          grid: { color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' },
          ticks: {
            color: dark ? '#9c9a92' : '#73726c',
            callback: v => '฿' + (v >= 1000 ? (v/1000).toFixed(0)+'K' : v)
          }
        },
        y: {
          grid: { display: false },
          ticks: { color: dark ? '#c2c0b6' : '#3d3d3a', font: { size: 12 } }
        }
      }
    }
  });
}

// ─── Category Donut Chart ─────────────────────────────────────
function renderCategoryChart(byCategory, canvasId, legendId) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const top7    = byCategory.slice(0, 7);
  const others  = byCategory.slice(7).reduce((s, c) => ({ category: 'อื่นๆ', revenue: s.revenue + c.revenue, qty: s.qty + c.qty }), { revenue: 0, qty: 0 });
  const items   = others.revenue > 0 ? [...top7, others] : top7;
  const total   = items.reduce((s, c) => s + c.revenue, 0);
  const dark    = isDark();

  new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: items.map(c => c.category),
      datasets: [{
        data: items.map(c => c.revenue),
        backgroundColor: items.map((_, i) => CAT_COLORS[i % CAT_COLORS.length]),
        borderWidth: 2,
        borderColor: dark ? '#1e1c1a' : '#ffffff',
        hoverBorderWidth: 0,
      }]
    },
    options: {
      responsive: false,
      cutout: '68%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ' ฿' + ctx.raw.toLocaleString('th-TH') +
                          ' (' + (ctx.raw / total * 100).toFixed(1) + '%)'
          }
        }
      }
    }
  });

  // Legend
  const legEl = document.getElementById(legendId);
  if (!legEl) return;
  legEl.innerHTML = items.map((c, i) => `
    <div class="sa-leg-item">
      <span class="sa-leg-dot" style="background:${CAT_COLORS[i % CAT_COLORS.length]}"></span>
      <span class="sa-leg-name">${c.category}</span>
      <span class="sa-leg-val">฿${Math.round(c.revenue/1000)}K</span>
      <span class="sa-leg-pct">${(c.revenue/total*100).toFixed(1)}%</span>
    </div>`).join('');
}

// ─── Top Products Bar Chart ───────────────────────────────────
function renderTopProductsChart(topProducts, canvasId, mode = 'revenue', topN = 15) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const dark  = isDark();
  const items = topProducts.slice(0, topN);
  const labels = items.map(p => p.name.length > 22 ? p.name.slice(0,22) + '…' : p.name);
  const data   = items.map(p => mode === 'revenue' ? p.revenue : p.qty);

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: mode === 'revenue' ? 'ยอดขาย (฿)' : 'จำนวน',
        data,
        backgroundColor: '#3B8BD4BB',
        borderColor    : '#3B8BD4',
        borderWidth: 1,
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => mode === 'revenue'
              ? ' ฿' + ctx.raw.toLocaleString('th-TH')
              : ' ' + ctx.raw.toLocaleString('th-TH') + ' รายการ'
          }
        }
      },
      scales: {
        x: {
          grid: { color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' },
          ticks: {
            color: dark ? '#9c9a92' : '#73726c',
            callback: v => mode === 'revenue'
              ? '฿' + (v >= 1000 ? (v/1000).toFixed(0)+'K' : v)
              : v.toLocaleString()
          }
        },
        y: {
          grid: { display: false },
          ticks: { color: dark ? '#c2c0b6' : '#3d3d3a', font: { size: 11 } }
        }
      }
    }
  });
}

// ─── Trend Chart (compare multiple reports) ───────────────────
function renderTrendChart(reports, canvasId, metric = 'totalRevenue') {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const dark   = isDark();
  const sorted = [...reports].sort((a,b) =>
    (a.uploadedAt?.seconds || 0) - (b.uploadedAt?.seconds || 0)
  );
  const labels = sorted.map(r => r.period || r.fileName?.split('.')[0] || r.id.slice(0,8));
  const data   = sorted.map(r => r.summary?.[metric] || 0);

  const metricLabel = {
    totalRevenue : 'ยอดขายสุทธิ (฿)',
    totalQty     : 'จำนวนรายการ',
    totalDiscount: 'ส่วนลดรวม (฿)',
  }[metric] || metric;

  new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: metricLabel,
        data,
        borderColor    : '#EF9F27',
        backgroundColor: '#EF9F2722',
        borderWidth    : 2.5,
        pointBackgroundColor: '#EF9F27',
        pointRadius    : 5,
        pointHoverRadius: 7,
        fill: true,
        tension: 0.35,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => metric === 'totalQty'
              ? ' ' + ctx.raw.toLocaleString('th-TH') + ' รายการ'
              : ' ฿' + ctx.raw.toLocaleString('th-TH')
          }
        }
      },
      scales: {
        x: {
          grid: { color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' },
          ticks: { color: dark ? '#9c9a92' : '#73726c' }
        },
        y: {
          grid: { color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' },
          ticks: {
            color: dark ? '#9c9a92' : '#73726c',
            callback: v => metric === 'totalQty'
              ? v.toLocaleString()
              : '฿' + (v >= 1000 ? (v/1000).toFixed(0)+'K' : v)
          }
        }
      }
    }
  });
}

// ─── Branch Comparison Chart (multi-report) ───────────────────
function renderBranchCompareChart(reports, canvasId) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const dark   = isDark();
  // Collect all branch names
  const allBranches = [...new Set(
    reports.flatMap(r => (r.byBranch || []).map(b => b.branch.replace('สาขา','').trim()))
  )];

  const datasets = reports.map((r, i) => ({
    label: r.period || r.fileName?.split('.')[0] || ('รายงาน '+(i+1)),
    data : allBranches.map(b => {
      const found = (r.byBranch || []).find(x => x.branch.replace('สาขา','').trim() === b);
      return found ? found.revenue : 0;
    }),
    backgroundColor: CAT_COLORS[i % CAT_COLORS.length] + 'BB',
    borderColor    : CAT_COLORS[i % CAT_COLORS.length],
    borderWidth: 1,
    borderRadius: 3,
  }));

  new Chart(canvas, {
    type: 'bar',
    data: { labels: allBranches, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { color: dark ? '#c2c0b6' : '#3d3d3a', boxWidth: 12, font: { size: 12 } }
        },
        tooltip: {
          callbacks: {
            label: ctx => ' ' + ctx.dataset.label + ': ฿' + ctx.raw.toLocaleString('th-TH')
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: dark ? '#c2c0b6' : '#3d3d3a', font: { size: 11 } }
        },
        y: {
          grid: { color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' },
          ticks: {
            color: dark ? '#9c9a92' : '#73726c',
            callback: v => '฿' + (v >= 1000 ? (v/1000).toFixed(0)+'K' : v)
          }
        }
      }
    }
  });
}

// ─── Exports ──────────────────────────────────────────────────
window.SACharts = {
  renderKPICards,
  renderBranchChart,
  renderCategoryChart,
  renderTopProductsChart,
  renderTrendChart,
  renderBranchCompareChart,
};

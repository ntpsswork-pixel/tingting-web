// ============================================================
//  TTGPlus — Sales Analytics  |  sales-analytics-charts.js
//  Chart.js renders — Power BI palette
// ============================================================

// Power BI–aligned palette
const PBI_COLORS = ['#f0b429','#0078d4','#107c10','#d83b01','#7f77dd','#1d9e75','#d4537e','#605e5c','#00b7c3'];

function isDark() { return window.matchMedia('(prefers-color-scheme: dark)').matches; }

function destroyChart(id) {
  const c = Chart.getChart(id);
  if (c) c.destroy();
}

function _dark() {
  return {
    gridColor  : isDark() ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
    tickColor  : isDark() ? '#9c9a92' : '#605e5c',
    labelColor : isDark() ? '#c2c0b6' : '#323130',
  };
}

function _fmtB(v) { return '฿'+(v>=1000000?(v/1000000).toFixed(1)+'M':v>=1000?(v/1000).toFixed(0)+'K':v); }

// ─── KPI Cards (Power BI style) ──────────────────────────────
function renderKPICards(data, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const fmtB = n => '฿'+Number(n||0).toLocaleString('th-TH',{maximumFractionDigits:0});
  const fmtN = n => Number(n||0).toLocaleString('th-TH');

  const hasProduct = !!data.product;
  const hasBill    = !!data.bill;
  const hasPromo   = !!data.promo;

  const revenue  = hasProduct ? data.product.totalRevenue  : (hasBill ? data.bill.totalRevenue  : 0);
  const qty      = hasProduct ? data.product.totalQty      : (hasBill ? data.bill.totalQty      : 0);
  const discount = (hasProduct ? data.product.totalDiscount : 0) + (hasPromo ? data.promo.totalDiscount : 0);
  const bills    = hasBill    ? data.bill.totalBills        : (hasProduct ? (data.product.byBranch?.length||0) : 0);
  const avgBill  = hasBill    ? data.bill.avgBillSize       : 0;
  const discRate = revenue > 0 ? (discount / (revenue + discount) * 100) : 0;

  el.innerHTML = `
  <div class="pbi-kpi-row">
    <div class="pbi-kpi pbi-kpi-rev">
      <div class="pbi-kpi-label">ยอดขายสุทธิ</div>
      <div class="pbi-kpi-value">${fmtB(revenue)}</div>
      <div class="pbi-kpi-sub">${hasProduct?'ก่อนลด '+fmtB(data.product.totalGross||0):hasBill?data.bill.branchCount+' สาขา':''}</div>
    </div>
    <div class="pbi-kpi pbi-kpi-qty">
      <div class="pbi-kpi-label">${hasBill?'จำนวนบิล':'รายการขาย'}</div>
      <div class="pbi-kpi-value">${fmtN(hasBill?bills:qty)}</div>
      <div class="pbi-kpi-sub">${hasBill&&avgBill>0?'avg '+fmtB(avgBill)+'/บิล':''}</div>
    </div>
    <div class="pbi-kpi pbi-kpi-prod">
      <div class="pbi-kpi-label">ส่วนลดรวม</div>
      <div class="pbi-kpi-value">${fmtB(discount)}</div>
      <div class="pbi-kpi-sub">${discRate.toFixed(1)}% ของยอด</div>
    </div>
    <div class="pbi-kpi pbi-kpi-disc">
      <div class="pbi-kpi-label">${hasProduct?'สินค้า (ไม่ซ้ำ)':hasBill?'รายการ/บิล':'สาขา'}</div>
      <div class="pbi-kpi-value">${fmtN(hasProduct?data.product.productCount:hasBill?data.bill.totalQty:hasPromo?data.promo.branches?.length||0:0)}</div>
      <div class="pbi-kpi-sub">${hasProduct?data.product.branchCount+' สาขา':hasBill?data.bill.branchCount+' สาขา':hasPromo?data.promo.totalUsage+' ครั้ง':''}</div>
    </div>
  </div>`;
}

// ─── Branch horizontal bar chart ─────────────────────────────
function renderBranchChart(byBranch, canvasId) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const d = _dark();
  const labels = byBranch.map(b => b.branch.replace('สาขา','').trim());
  const data   = byBranch.map(b => b.revenue);
  new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: '#f0b429cc', borderColor: '#f0b429', borderWidth:0, borderRadius:0 }] },
    options: {
      responsive:true, maintainAspectRatio:false, indexAxis:'y',
      plugins: { legend:{display:false}, tooltip:{callbacks:{label:ctx=>' ฿'+ctx.raw.toLocaleString('th-TH')}} },
      scales: {
        x: { grid:{color:d.gridColor}, ticks:{color:d.tickColor, callback:v=>_fmtB(v)} },
        y: { grid:{display:false}, ticks:{color:d.labelColor, font:{size:11}} }
      }
    }
  });
}

// ─── Category donut ───────────────────────────────────────────
function renderCategoryChart(byCategory, canvasId, legendId) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const top7   = byCategory.slice(0,7);
  const others = byCategory.slice(7).reduce((s,c)=>({category:'อื่นๆ',revenue:s.revenue+c.revenue,qty:s.qty+c.qty}),{revenue:0,qty:0});
  const items  = others.revenue > 0 ? [...top7,others] : top7;
  const total  = items.reduce((s,c)=>s+c.revenue,0);
  const dark   = isDark();
  new Chart(canvas, {
    type: 'doughnut',
    data: { labels: items.map(c=>c.category), datasets:[{ data:items.map(c=>c.revenue), backgroundColor:items.map((_,i)=>PBI_COLORS[i%PBI_COLORS.length]), borderWidth:2, borderColor:dark?'#1e1c1a':'#ffffff' }] },
    options: { responsive:false, cutout:'68%', plugins:{ legend:{display:false}, tooltip:{callbacks:{label:ctx=>' ฿'+ctx.raw.toLocaleString('th-TH')+' ('+(ctx.raw/total*100).toFixed(1)+'%)'}} } }
  });
  const legEl = document.getElementById(legendId);
  if (!legEl) return;
  legEl.innerHTML = items.map((c,i)=>`
    <div class="pbi-leg-row">
      <span class="pbi-leg-dot" style="background:${PBI_COLORS[i%PBI_COLORS.length]}"></span>
      <span class="pbi-leg-name">${c.category}</span>
      <span class="pbi-leg-pct">${(c.revenue/total*100).toFixed(1)}%</span>
    </div>`).join('');
}

// ─── Top products bar chart ───────────────────────────────────
function renderTopProductsChart(topProducts, canvasId, mode='revenue', topN=15) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const d = _dark();
  const items  = topProducts.slice(0,topN);
  const labels = items.map(p=>p.name.length>24?p.name.slice(0,24)+'…':p.name);
  const data   = items.map(p=>mode==='revenue'?p.revenue:p.qty);
  new Chart(canvas, {
    type:'bar',
    data:{ labels, datasets:[{ data, backgroundColor:'#0078d4bb', borderColor:'#0078d4', borderWidth:0, borderRadius:0 }] },
    options:{
      responsive:true, maintainAspectRatio:false, indexAxis:'y',
      plugins:{ legend:{display:false}, tooltip:{callbacks:{label:ctx=>mode==='revenue'?' ฿'+ctx.raw.toLocaleString('th-TH'):' '+ctx.raw.toLocaleString('th-TH')+' รายการ'}} },
      scales:{
        x:{ grid:{color:d.gridColor}, ticks:{color:d.tickColor, callback:v=>mode==='revenue'?_fmtB(v):v.toLocaleString()} },
        y:{ grid:{display:false}, ticks:{color:d.labelColor, font:{size:11}} }
      }
    }
  });
}

// ─── Trend line chart (daily/weekly) ─────────────────────────
function renderTrendChart(byDate, canvasId, groupBy='day') {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const d = _dark();

  let grouped = byDate;
  if (groupBy === 'week') {
    const wMap = {};
    byDate.forEach(item => {
      const parts = item.date.split('/');
      const dt = parts.length===3 ? new Date(+parts[2], +parts[1]-1, +parts[0]) : new Date(item.date);
      const wn  = _weekNumber(dt);
      const key = `สัปดาห์ ${wn}`;
      if (!wMap[key]) wMap[key] = { date:key, revenue:0, qty:0, bills:0 };
      wMap[key].revenue += item.revenue;
      wMap[key].qty     += item.qty||0;
      wMap[key].bills   += item.bills||0;
    });
    grouped = Object.values(wMap);
  } else if (groupBy === 'month') {
    const mMap = {};
    byDate.forEach(item => {
      const parts = item.date.split('/');
      const key = parts.length>=2 ? `${parts[1]}/${parts[2]||parts[1]}`.slice(-7) : item.date.slice(0,7);
      if (!mMap[key]) mMap[key] = { date:key, revenue:0, qty:0, bills:0 };
      mMap[key].revenue += item.revenue;
      mMap[key].qty     += item.qty||0;
      mMap[key].bills   += item.bills||0;
    });
    grouped = Object.values(mMap);
  }

  new Chart(canvas, {
    type:'line',
    data:{ labels:grouped.map(g=>g.date), datasets:[{
      label:'ยอดขาย', data:grouped.map(g=>g.revenue),
      borderColor:'#f0b429', backgroundColor:'#f0b42922', borderWidth:2,
      pointBackgroundColor:'#f0b429', pointRadius:3, pointHoverRadius:6, fill:true, tension:0.3,
    }]},
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false}, tooltip:{callbacks:{label:ctx=>' ฿'+ctx.raw.toLocaleString('th-TH')}} },
      scales:{
        x:{ grid:{color:d.gridColor}, ticks:{color:d.tickColor, maxRotation:45, maxTicksLimit:12} },
        y:{ grid:{color:d.gridColor}, ticks:{color:d.tickColor, callback:v=>_fmtB(v)} }
      }
    }
  });
}

function _weekNumber(dt) {
  const start = new Date(dt.getFullYear(), 0, 1);
  return Math.ceil(((dt - start) / 86400000 + start.getDay() + 1) / 7);
}

// ─── Order type / Channel pie ─────────────────────────────────
function renderPieChart(items, keyField, canvasId, legendId) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const dark  = isDark();
  const total = items.reduce((s,x)=>s+x.revenue,0);
  new Chart(canvas, {
    type:'doughnut',
    data:{ labels:items.map(x=>x[keyField]||'อื่นๆ'), datasets:[{ data:items.map(x=>x.revenue), backgroundColor:items.map((_,i)=>PBI_COLORS[i%PBI_COLORS.length]), borderWidth:2, borderColor:dark?'#1e1c1a':'#ffffff' }] },
    options:{ responsive:false, cutout:'62%', plugins:{ legend:{display:false}, tooltip:{callbacks:{label:ctx=>' ฿'+ctx.raw.toLocaleString('th-TH')+' ('+(ctx.raw/total*100).toFixed(1)+'%)'}} } }
  });
  const legEl = document.getElementById(legendId);
  if (!legEl) return;
  legEl.innerHTML = items.map((x,i)=>`
    <div class="pbi-leg-row">
      <span class="pbi-leg-dot" style="background:${PBI_COLORS[i%PBI_COLORS.length]}"></span>
      <span class="pbi-leg-name">${x[keyField]||'อื่นๆ'}</span>
      <span class="pbi-leg-pct">${total>0?(x.revenue/total*100).toFixed(1)+'%':'—'}</span>
    </div>`).join('');
}

// ─── Promo bar chart ─────────────────────────────────────────
function renderPromoChart(byPromo, canvasId, topN=12) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const d = _dark();
  const items  = byPromo.slice(0,topN);
  const labels = items.map(p=>p.promoName.length>28?p.promoName.slice(0,28)+'…':p.promoName);
  new Chart(canvas, {
    type:'bar',
    data:{ labels, datasets:[{ data:items.map(p=>p.discountAmt), backgroundColor:'#7f77ddbb', borderColor:'#7f77dd', borderWidth:0, borderRadius:0 }] },
    options:{
      responsive:true, maintainAspectRatio:false, indexAxis:'y',
      plugins:{ legend:{display:false}, tooltip:{callbacks:{label:ctx=>' ฿'+ctx.raw.toLocaleString('th-TH')}} },
      scales:{
        x:{ grid:{color:d.gridColor}, ticks:{color:d.tickColor, callback:v=>_fmtB(v)} },
        y:{ grid:{display:false}, ticks:{color:d.labelColor, font:{size:10}} }
      }
    }
  });
}

// ─── Multi-report trend compare ───────────────────────────────
function renderMultiTrendChart(reports, canvasId, metric='totalRevenue') {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const d = _dark();
  const sorted = [...reports].sort((a,b)=>(a.uploadedAt?.seconds||0)-(b.uploadedAt?.seconds||0));
  new Chart(canvas, {
    type:'line',
    data:{ labels:sorted.map(r=>r.period||r.fileName?.split('.')[0]||r.id?.slice(0,8)),
      datasets:[{ label:metric, data:sorted.map(r=>r.summary?.[metric]||0),
        borderColor:'#f0b429', backgroundColor:'#f0b42922', borderWidth:2.5,
        pointBackgroundColor:'#f0b429', pointRadius:5, fill:true, tension:0.3 }] },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false} },
      scales:{
        x:{ grid:{color:d.gridColor}, ticks:{color:d.tickColor} },
        y:{ grid:{color:d.gridColor}, ticks:{color:d.tickColor, callback:v=>_fmtB(v)} }
      }
    }
  });
}

function renderBranchCompareChart(reports, canvasId) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const d = _dark();
  const allBranches = [...new Set(reports.flatMap(r=>(r.byBranch||[]).map(b=>b.branch.replace('สาขา','').trim())))];
  const datasets = reports.map((r,i)=>({
    label: r.period||r.fileName?.split('.')[0]||('รายงาน '+(i+1)),
    data: allBranches.map(b=>{ const f=(r.byBranch||[]).find(x=>x.branch.replace('สาขา','').trim()===b); return f?f.revenue:0; }),
    backgroundColor: PBI_COLORS[i%PBI_COLORS.length]+'bb',
    borderColor: PBI_COLORS[i%PBI_COLORS.length],
    borderWidth:0, borderRadius:0,
  }));
  new Chart(canvas, {
    type:'bar', data:{ labels:allBranches, datasets },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ display:true, position:'top', labels:{color:d.labelColor, boxWidth:10, font:{size:11}} } },
      scales:{
        x:{ grid:{display:false}, ticks:{color:d.labelColor, font:{size:11}} },
        y:{ grid:{color:d.gridColor}, ticks:{color:d.tickColor, callback:v=>_fmtB(v)} }
      }
    }
  });
}

window.SACharts = {
  renderKPICards, renderBranchChart, renderCategoryChart,
  renderTopProductsChart, renderTrendChart, renderPieChart,
  renderPromoChart, renderMultiTrendChart, renderBranchCompareChart,
};

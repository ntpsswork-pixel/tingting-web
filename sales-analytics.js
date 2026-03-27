// ============================================================
//  TTGPlus — Sales Analytics  |  sales-analytics.js
//  Core engine: type detection, parsers (3 types), aggregators
// ============================================================

const SA_COLLECTION = 'salesReports';

// ─── Regex: ตัดรหัสนำหน้าชื่อสินค้า ─────────────────────────
// รองรับ: B+12-ชื่อ, FDB+05 - ชื่อ, F01-ชื่อ, (TW) ชื่อ, (D) ชื่อ
const CODE_PREFIX_RE = /^(?:(?:\([A-Za-z]+\)\s+)|(?:[\(\[]?(?:[A-Za-z]+[\+]?)*\d+[\s]*[-–\-][\s]*))/u;

function stripProductCode(name) {
  if (!name) return '';
  const s = String(name).replace(CODE_PREFIX_RE, '').trim();
  return s || String(name).trim();
}

// ─── กรอง Summary/Total rows ──────────────────────────────────
const SUMMARY_KEYWORDS = ['total','grand total','รวม','รวมทั้งหมด','ยอดรวม','subtotal','รวมยอด'];
function isSummaryRow(name) {
  if (!name) return false;
  const n = String(name).trim().toLowerCase();
  return SUMMARY_KEYWORDS.some(k => n === k || n === k + ':');
}

// ─── Detect report type จาก headers ─────────────────────────
function detectReportType(headers, titleRow) {
  const h = headers.map(x => String(x || '').toLowerCase().trim());
  // บิลรายการ: มีหมายเลขใบเสร็จ + วันที่ชำระเงิน
  if (h.some(x => x.includes('หมายเลขใบเสร็จ') || x.includes('inv'))
      && h.some(x => x.includes('วันที่ชำระ'))) return 'bill';
  // โปรโมชั่น: มีชื่อโปรโมชั่น + ยอดส่วนลด
  if (h.some(x => x.includes('ชื่อโปรโมชั่น'))
      && h.some(x => x.includes('ยอดส่วนลด'))) return 'promo';
  // ยอดขายสินค้าตามวัน: มีวันที่ + ชื่อสินค้า/ชื่อเมนู
  if (h.some(x => x === 'วันที่' || x.startsWith('วันที่'))
      && h.some(x => x.includes('ชื่อสินค้า') || x.includes('ชื่อเมนู'))) return 'daily_product';
  // ยอดขายตามสินค้า (ไม่มีวันที่)
  if (h.some(x => x.includes('ชื่อสินค้า') || x.includes('ชื่อเมนู'))) return 'product';
  return 'unknown';
}

// ─── Map columns: ป้องกัน column เดียวถูก map ซ้ำ 2 field ──
function mapColumns(headers, aliases) {
  const normalized = headers.map(h => String(h || '').trim().toLowerCase());
  const mapping = {};
  const usedCols = new Set();
  for (const [field, aliasList] of Object.entries(aliases)) {
    for (let i = 0; i < normalized.length; i++) {
      if (!usedCols.has(i) && aliasList.some(a => normalized[i].includes(a.toLowerCase()))) {
        mapping[field] = i;
        usedCols.add(i);
        break;
      }
    }
  }
  return mapping;
}

// ─── Column alias dictionaries ───────────────────────────────
const PRODUCT_ALIASES = {
  date        : ['วันที่'],
  productCode : ['รหัสสินค้า','product code','sku','รหัสเมนู','รหัส'],
  productName : ['ชื่อสินค้า','ชื่อเมนู','product name','item name','ชื่อ'],
  group       : ['กลุ่ม','group'],
  category    : ['หมวดสินค้า','หมวด','category'],
  avgPrice    : ['ราคาขายเฉลี่ย','ราคาเฉลี่ย','avg price','unit price'],
  qty         : ['จำนวนการขาย','จำนวน','quantity','qty'],
  grossAmount : ['ยอดก่อนลด','gross'],
  discount    : ['ส่วนลดสินค้า','ส่วนลด','discount'],
  netAmount   : ['ราคาสุทธิ','net'],
  branch      : ['สาขา','branch','store'],
};

const BILL_ALIASES = {
  date        : ['วันที่ชำระเงิน','วันที่'],
  time        : ['เวลาที่ชำระเงิน','เวลา'],
  receiptId   : ['หมายเลขใบเสร็จ','receipt','id'],
  menuCode    : ['รหัสเมนู','รหัสสินค้า','รหัส'],
  menuName    : ['ชื่อเมนู','ชื่อสินค้า'],
  orderType   : ['ประเภทการสั่ง'],
  qty         : ['จำนวน','quantity','qty'],
  unitPrice   : ['ราคาต่อหน่วย','unit price','ราคา'],
  grossAmount : ['ยอดก่อนลด','gross'],
  discount    : ['ส่วนลดสินค้า','ส่วนลด','discount'],
  netAmount   : ['ราคาสุทธิ','net'],
  channel     : ['ช่องทาง','channel'],
  paymentType : ['ประเภทการชำระเงิน','payment'],
  promoType   : ['ประเภทโปรโมชั่น'],
  category    : ['หมวดสินค้า','หมวด','category'],
  group       : ['กลุ่ม','group'],
  openBy      : ['เปิดบิลโดย'],
  closeBy     : ['ปิดบิลโดย'],
  branch      : ['สาขา','branch'],
};

const PROMO_ALIASES = {
  promoName   : ['ชื่อโปรโมชั่น'],
  promoType   : ['ประเภทโปรโมชั่น'],
  usageCount  : ['จำนวนการใช้'],
  discountAmt : ['ยอดส่วนลด'],
  branch      : ['สาขา','branch'],
};

// ─── AI column mapping fallback ──────────────────────────────
async function aiMapColumns(headers, sampleRows, type) {
  const returnShape = type === 'bill'
    ? '{"date":N,"menuCode":N,"menuName":N,"orderType":N,"qty":N,"grossAmount":N,"discount":N,"netAmount":N,"channel":N,"paymentType":N,"category":N,"branch":N}'
    : type === 'promo'
    ? '{"promoName":N,"promoType":N,"usageCount":N,"discountAmt":N,"branch":N}'
    : '{"date":N_or_null,"productCode":N_or_null,"productName":N,"group":N_or_null,"category":N_or_null,"avgPrice":N_or_null,"qty":N,"grossAmount":N_or_null,"discount":N_or_null,"netAmount":N,"branch":N}';

  const prompt = `Thai POS data. Headers: ${JSON.stringify(headers)}\nSample: ${JSON.stringify(sampleRows.slice(0,3))}\nReturn ONLY valid JSON (no markdown): ${returnShape}`;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 300, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await res.json();
    const clean = (data.content?.[0]?.text || '').replace(/```json|```/g,'').trim();
    return JSON.parse(clean);
  } catch (e) { console.warn('AI mapping failed', e); return null; }
}

// ─── Parse raw Excel rows helper ─────────────────────────────
function readRaw(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb  = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header:1, defval:'' });
        // หา header row — แถวแรกที่มี >= 4 non-empty cells
        let headerIdx = 0;
        let titleRow  = '';
        for (let i = 0; i < Math.min(6, raw.length); i++) {
          const filled = raw[i].filter(c => c !== '').length;
          if (filled >= 4) { headerIdx = i; break; }
          if (filled >= 1 && !titleRow) titleRow = String(raw[i][0]);
        }
        const headers  = raw[headerIdx].map(h => String(h).trim());
        const dataRows = raw.slice(headerIdx + 1).filter(r =>
          r.some(c => c !== '' && c !== null && c !== undefined)
        );
        resolve({ headers, dataRows, titleRow });
      } catch(err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// ─── simplifyCategory ────────────────────────────────────────
function simplifyCategory(cat) {
  if (!cat) return 'อื่นๆ';
  let c = String(cat);
  for (const pfx of ['TW.','FD.','TW-','FD-','TW ','FD ']) {
    if (c.startsWith(pfx)) { c = c.slice(pfx.length); break; }
  }
  // ตัด " - กลับบ้าน" suffix
  c = c.replace(/\s*-\s*กลับบ้าน$/,'').trim();
  return c.split(' - ')[0].trim() || 'อื่นๆ';
}

// ─── PARSER: ยอดขายสินค้าตามวัน / ยอดขายตามสินค้า ─────────
async function parseProductFile(file) {
  const { headers, dataRows, titleRow } = await readRaw(file);
  const type = detectReportType(headers, titleRow);

  let mapping = mapColumns(headers, PRODUCT_ALIASES);
  const hasCritical = mapping.productName !== undefined && mapping.qty !== undefined && mapping.netAmount !== undefined;
  if (!hasCritical) {
    const ai = await aiMapColumns(headers, dataRows, 'product');
    if (ai) for (const [k,v] of Object.entries(ai)) { if (v !== null && mapping[k] === undefined) mapping[k] = v; }
  }

  const rows = dataRows.map(r => {
    const rawName   = String(r[mapping.productName] ?? '').trim();
    const cleanName = stripProductCode(rawName);
    const dateRaw   = mapping.date !== undefined ? String(r[mapping.date] ?? '').trim() : '';
    return {
      date            : dateRaw,
      productCode     : String(r[mapping.productCode] ?? '').trim(),
      productName     : cleanName,
      productNameRaw  : rawName,
      productNameClean: cleanName,
      group           : String(r[mapping.group] ?? '').trim(),
      category        : String(r[mapping.category] ?? '').trim(),
      avgPrice        : parseFloat(r[mapping.avgPrice]) || 0,
      qty             : parseFloat(r[mapping.qty]) || 0,
      grossAmount     : parseFloat(r[mapping.grossAmount]) || 0,
      discount        : parseFloat(r[mapping.discount]) || 0,
      netAmount       : parseFloat(r[mapping.netAmount]) || 0,
      branch          : String(r[mapping.branch] ?? '').trim(),
    };
  }).filter(r => {
    if (!r.productName) return false;
    if (isSummaryRow(r.productNameRaw)) return false;
    if (isSummaryRow(r.date) || isSummaryRow(r.branch)) return false;
    if (r.qty <= 0 && r.netAmount <= 0) return false;
    return true;
  });

  return { type: type === 'daily_product' ? 'daily_product' : 'product', rows, headers, fileName: file.name };
}

// ─── PARSER: บิลรายการ ───────────────────────────────────────
async function parseBillFile(file) {
  const { headers, dataRows, titleRow } = await readRaw(file);
  let mapping = mapColumns(headers, BILL_ALIASES);
  const hasCritical = mapping.menuName !== undefined && mapping.netAmount !== undefined;
  if (!hasCritical) {
    const ai = await aiMapColumns(headers, dataRows, 'bill');
    if (ai) for (const [k,v] of Object.entries(ai)) { if (v !== null && mapping[k] === undefined) mapping[k] = v; }
  }

  const rows = dataRows.map(r => {
    const rawName   = String(r[mapping.menuName] ?? '').trim();
    const cleanName = stripProductCode(rawName);
    const dateRaw   = String(r[mapping.date] ?? '').trim();
    return {
      date        : dateRaw,
      time        : String(r[mapping.time] ?? '').trim(),
      receiptId   : String(r[mapping.receiptId] ?? '').trim(),
      menuCode    : String(r[mapping.menuCode] ?? '').trim(),
      menuName    : cleanName,
      menuNameRaw : rawName,
      orderType   : String(r[mapping.orderType] ?? '').trim(),
      qty         : parseFloat(r[mapping.qty]) || 0,
      unitPrice   : parseFloat(r[mapping.unitPrice]) || 0,
      grossAmount : parseFloat(r[mapping.grossAmount]) || 0,
      discount    : parseFloat(r[mapping.discount]) || 0,
      netAmount   : parseFloat(r[mapping.netAmount]) || 0,
      channel     : String(r[mapping.channel] ?? '').trim(),
      paymentType : String(r[mapping.paymentType] ?? '').trim(),
      promoType   : String(r[mapping.promoType] ?? '').trim(),
      category    : String(r[mapping.category] ?? '').trim(),
      group       : String(r[mapping.group] ?? '').trim(),
      openBy      : String(r[mapping.openBy] ?? '').trim(),
      closeBy     : String(r[mapping.closeBy] ?? '').trim(),
      branch      : String(r[mapping.branch] ?? '').trim(),
    };
  }).filter(r => {
    if (!r.menuName) return false;
    if (isSummaryRow(r.menuNameRaw) || isSummaryRow(r.date)) return false;
    if (r.qty <= 0 && r.netAmount <= 0) return false;
    return true;
  });

  return { type: 'bill', rows, headers, fileName: file.name };
}

// ─── PARSER: โปรโมชั่น ───────────────────────────────────────
async function parsePromoFile(file) {
  const { headers, dataRows } = await readRaw(file);
  let mapping = mapColumns(headers, PROMO_ALIASES);
  if (mapping.promoName === undefined) {
    const ai = await aiMapColumns(headers, dataRows, 'promo');
    if (ai) for (const [k,v] of Object.entries(ai)) { if (v !== null && mapping[k] === undefined) mapping[k] = v; }
  }
  const rows = dataRows.map(r => ({
    promoName   : String(r[mapping.promoName] ?? '').trim(),
    promoType   : String(r[mapping.promoType] ?? '').trim(),
    usageCount  : parseFloat(r[mapping.usageCount]) || 0,
    discountAmt : parseFloat(r[mapping.discountAmt]) || 0,
    branch      : String(r[mapping.branch] ?? '').trim(),
  })).filter(r => r.promoName && !isSummaryRow(r.promoName) && r.discountAmt >= 0);

  return { type: 'promo', rows, headers, fileName: file.name };
}

// ─── DETECT file type ─────────────────────────────────────────
async function detectFile(file) {
  const { headers, titleRow } = await readRaw(file);
  return detectReportType(headers, titleRow);
}

// ─── PARSE any file (auto-detect) ───────────────────────────
async function parseAnyFile(file, detectedType) {
  const type = detectedType || await detectFile(file);
  if (type === 'bill')  return parseBillFile(file);
  if (type === 'promo') return parsePromoFile(file);
  return parseProductFile(file);  // daily_product or product
}

// ─── AGGREGATE: product / daily_product ─────────────────────
function aggregateProductData(rows) {
  const totalRevenue  = rows.reduce((s,r) => s + r.netAmount, 0);
  const totalQty      = rows.reduce((s,r) => s + r.qty, 0);
  const totalDiscount = rows.reduce((s,r) => s + r.discount, 0);
  const totalGross    = rows.reduce((s,r) => s + r.grossAmount, 0);

  // byBranch
  const brMap = {};
  rows.forEach(r => {
    const k = r.branch || 'ไม่ระบุ';
    if (!brMap[k]) brMap[k] = { branch:k, revenue:0, qty:0 };
    brMap[k].revenue += r.netAmount;
    brMap[k].qty     += r.qty;
  });
  const byBranch = Object.values(brMap).sort((a,b) => b.revenue - a.revenue);

  // byCategory
  const catMap = {};
  rows.forEach(r => {
    const k = simplifyCategory(r.category);
    if (!catMap[k]) catMap[k] = { category:k, revenue:0, qty:0 };
    catMap[k].revenue += r.netAmount;
    catMap[k].qty     += r.qty;
  });
  const byCategory = Object.values(catMap).sort((a,b) => b.revenue - a.revenue);

  // topProducts
  const prodMap = {};
  rows.forEach(r => {
    const k = r.productNameClean || r.productName;
    if (!prodMap[k]) prodMap[k] = { name:k, rawName:r.productNameRaw, cleanName:k, revenue:0, qty:0, category: simplifyCategory(r.category) };
    prodMap[k].revenue += r.netAmount;
    prodMap[k].qty     += r.qty;
  });
  const topProducts = Object.values(prodMap)
    .sort((a,b) => b.revenue - a.revenue)
    .map(p => ({ ...p, avgPrice: p.qty > 0 ? Math.round(p.revenue/p.qty) : 0 }));

  // byDate (สำหรับ trend chart)
  const dateMap = {};
  rows.forEach(r => {
    if (!r.date) return;
    if (!dateMap[r.date]) dateMap[r.date] = { date:r.date, revenue:0, qty:0 };
    dateMap[r.date].revenue += r.netAmount;
    dateMap[r.date].qty     += r.qty;
  });
  const byDate = Object.values(dateMap).sort((a,b) => a.date.localeCompare(b.date));

  const branches   = [...new Set(rows.map(r => r.branch).filter(Boolean))].sort();
  const categories = [...new Set(rows.map(r => simplifyCategory(r.category)).filter(Boolean))].sort();
  const dates      = [...new Set(rows.map(r => r.date).filter(Boolean))].sort();

  return {
    totalRevenue, totalQty, totalDiscount, totalGross,
    discountRate : totalGross > 0 ? (totalDiscount/totalGross*100) : 0,
    branchCount  : byBranch.length,
    productCount : topProducts.length,
    byBranch, byCategory, topProducts, byDate,
    branches, categories, dates,
  };
}

// ─── AGGREGATE: bill ─────────────────────────────────────────
function aggregateBillData(rows) {
  const totalRevenue  = rows.reduce((s,r) => s + r.netAmount, 0);
  const totalQty      = rows.reduce((s,r) => s + r.qty, 0);
  const totalDiscount = rows.reduce((s,r) => s + r.discount, 0);
  const totalGross    = rows.reduce((s,r) => s + r.grossAmount, 0);

  // unique bills
  const billSet = new Set(rows.map(r => r.receiptId).filter(Boolean));
  const totalBills = billSet.size || rows.length;
  const avgBillSize = totalBills > 0 ? totalRevenue / totalBills : 0;

  const byBranch = _groupBy(rows, r => r.branch || 'ไม่ระบุ', r => r.netAmount, r => r.qty,
    (k,rev,qty) => ({ branch:k, revenue:rev, qty }));

  const byOrderType = _groupBy(rows, r => r.orderType || 'ไม่ระบุ', r => r.netAmount, r => r.qty,
    (k,rev,qty) => ({ type:k, revenue:rev, qty }));

  // normalize payment names
  const normalizePayment = p => {
    if (!p) return 'อื่นๆ';
    const l = p.toLowerCase();
    if (l.includes('cash') || l.includes('เงินสด')) return 'Cash';
    if (l.includes('promptpay') || l.includes('prompt') || l.includes('qr')) return 'PromptPay / QR';
    if (l.includes('k plus') || l.includes('kplus') || l.includes('k+')) return 'K Plus';
    if (l.includes('lineman') || l.includes('line man')) return 'LINE MAN';
    if (l.includes('grab')) return 'GrabFood';
    return p;
  };
  const byPayment = _groupBy(rows, r => normalizePayment(r.paymentType), r => r.netAmount, r => r.qty,
    (k,rev,qty) => ({ payment:k, revenue:rev, qty }));

  const byChannel = _groupBy(rows, r => r.channel || 'ไม่ระบุ', r => r.netAmount, r => r.qty,
    (k,rev,qty) => ({ channel:k, revenue:rev, qty }));

  const byCategory = _groupBy(rows, r => simplifyCategory(r.category), r => r.netAmount, r => r.qty,
    (k,rev,qty) => ({ category:k, revenue:rev, qty }));

  // byDate
  const dateMap = {};
  rows.forEach(r => {
    if (!r.date) return;
    if (!dateMap[r.date]) dateMap[r.date] = { date:r.date, revenue:0, qty:0, bills:new Set() };
    dateMap[r.date].revenue += r.netAmount;
    dateMap[r.date].qty     += r.qty;
    if (r.receiptId) dateMap[r.date].bills.add(r.receiptId);
  });
  const byDate = Object.values(dateMap)
    .map(d => ({ ...d, bills: d.bills.size }))
    .sort((a,b) => a.date.localeCompare(b.date));

  // staff performance
  const staffMap = {};
  rows.forEach(r => {
    const k = r.closeBy || r.openBy || 'ไม่ระบุ';
    if (!staffMap[k]) staffMap[k] = { staff:k, revenue:0, qty:0, bills:new Set() };
    staffMap[k].revenue += r.netAmount;
    staffMap[k].qty     += r.qty;
    if (r.receiptId) staffMap[k].bills.add(r.receiptId);
  });
  const byStaff = Object.values(staffMap)
    .map(s => ({ ...s, bills: s.bills.size, avgBill: s.bills.size > 0 ? Math.round(s.revenue/s.bills.size) : 0 }))
    .sort((a,b) => b.revenue - a.revenue);

  const branches = [...new Set(rows.map(r => r.branch).filter(Boolean))].sort();
  const dates    = [...new Set(rows.map(r => r.date).filter(Boolean))].sort();

  return {
    totalRevenue, totalQty, totalDiscount, totalGross, totalBills, avgBillSize,
    discountRate : totalGross > 0 ? (totalDiscount/totalGross*100) : 0,
    branchCount  : byBranch.length,
    byBranch, byOrderType, byChannel, byPayment, byCategory, byDate, byStaff,
    branches, dates,
  };
}

// ─── AGGREGATE: promo ────────────────────────────────────────
function aggregatePromoData(rows) {
  const totalDiscount  = rows.reduce((s,r) => s + r.discountAmt, 0);
  const totalUsage     = rows.reduce((s,r) => s + r.usageCount, 0);

  const byPromo = _groupByPromo(rows);
  const byBranch = _groupBy(rows, r => r.branch || 'ไม่ระบุ', r => r.discountAmt, r => r.usageCount,
    (k,disc,usage) => ({ branch:k, discountAmt:disc, usageCount:usage }));
  const byType = _groupBy(rows, r => r.promoType || 'ไม่ระบุ', r => r.discountAmt, r => r.usageCount,
    (k,disc,usage) => ({ promoType:k, discountAmt:disc, usageCount:usage }));

  const branches = [...new Set(rows.map(r => r.branch).filter(Boolean))].sort();

  return { totalDiscount, totalUsage, byPromo, byBranch, byType, branches };
}

function _groupBy(rows, keyFn, revFn, qtyFn, buildFn) {
  const map = {};
  rows.forEach(r => {
    const k = keyFn(r);
    if (!map[k]) map[k] = { _rev:0, _qty:0 };
    map[k]._rev += revFn(r);
    map[k]._qty += qtyFn(r);
  });
  return Object.entries(map)
    .map(([k,v]) => buildFn(k, v._rev, v._qty))
    .sort((a,b) => (b.revenue||b.discountAmt||0) - (a.revenue||a.discountAmt||0));
}

function _groupByPromo(rows) {
  const map = {};
  rows.forEach(r => {
    const k = r.promoName;
    if (!map[k]) map[k] = { promoName:k, promoType: r.promoType, discountAmt:0, usageCount:0, branches: new Set() };
    map[k].discountAmt  += r.discountAmt;
    map[k].usageCount   += r.usageCount;
    if (r.branch) map[k].branches.add(r.branch);
  });
  return Object.values(map)
    .map(p => ({ ...p, branches: p.branches.size }))
    .sort((a,b) => b.discountAmt - a.discountAmt);
}

// ─── Filter helper ───────────────────────────────────────────
function filterProductRows(rows, { branches, categories, search }) {
  return rows.filter(r => {
    if (branches && branches.size && !branches.has(r.branch)) return false;
    if (categories && categories.size && !categories.has(simplifyCategory(r.category))) return false;
    if (search) {
      const n = (r.productNameClean || r.productName || '').toLowerCase();
      if (!n.includes(search)) return false;
    }
    return true;
  });
}

function filterBillRows(rows, { branches, orderTypes, channels }) {
  return rows.filter(r => {
    if (branches   && branches.size   && !branches.has(r.branch)) return false;
    if (orderTypes && orderTypes.size  && !orderTypes.has(r.orderType)) return false;
    if (channels   && channels.size    && !channels.has(r.channel)) return false;
    return true;
  });
}

// ─── Firestore ────────────────────────────────────────────────
async function saveReportToFirestore(db, { fileName, period, summary, rows }) {
  const { doc, setDoc, collection, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  const reportRef = doc(collection(db, SA_COLLECTION));
  const reportId  = reportRef.id;
  await setDoc(reportRef, {
    id: reportId, fileName, period: period||'',
    uploadedAt: serverTimestamp(),
    uploadedBy: window.currentUser?.username || window.currentUser?.name || 'unknown',
    summary: {
      totalRevenue: summary.totalRevenue, totalQty: summary.totalQty,
      totalDiscount: summary.totalDiscount, totalGross: summary.totalGross||0,
      discountRate: summary.discountRate, branchCount: summary.branchCount, productCount: summary.productCount||0,
    },
    byBranch: summary.byBranch, byCategory: summary.byCategory||[], topProducts: (summary.topProducts||[]).slice(0,50),
  });
  const BATCH = 400;
  for (let i = 0; i < rows.length; i += BATCH) {
    await addDoc(collection(db, SA_COLLECTION, reportId, 'rawRows'), { rows: rows.slice(i,i+BATCH), chunkIndex: Math.floor(i/BATCH) });
  }
  return reportId;
}

async function loadReportList(db, limitN=20) {
  const { collection, getDocs, query, orderBy, limit } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  const q = query(collection(db, SA_COLLECTION), orderBy('uploadedAt','desc'), limit(limitN));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function loadReport(db, reportId) {
  const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  const snap = await getDoc(doc(db, SA_COLLECTION, reportId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

async function deleteReport(db, reportId) {
  const { doc, deleteDoc, collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  const rowsSnap = await getDocs(collection(db, SA_COLLECTION, reportId, 'rawRows'));
  for (const d of rowsSnap.docs) await deleteDoc(d.ref);
  await deleteDoc(doc(db, SA_COLLECTION, reportId));
}

window.SA = {
  stripProductCode, isSummaryRow, simplifyCategory,
  detectFile, parseAnyFile, parseProductFile, parseBillFile, parsePromoFile,
  aggregateProductData, aggregateBillData, aggregatePromoData,
  filterProductRows, filterBillRows,
  saveReportToFirestore, loadReportList, loadReport, deleteReport,
};

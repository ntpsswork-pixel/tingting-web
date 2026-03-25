// ============================================================
//  TTGPlus — Sales Analytics Module
//  sales-analytics.js  (core: parse, AI-map, Firestore CRUD)
// ============================================================

const SA_COLLECTION = 'salesReports';

// ─── Fix 1: Regex ตัดรหัสนำหน้า ──────────────────────────────
const CODE_PREFIX_RE = /^[\(\[]?(?:[A-Za-z]+[\+]?)*\d+[\s]*[-–][\s]*/u;

function stripProductCode(name) {
  if (!name) return '';
  const s = String(name).replace(CODE_PREFIX_RE, '').trim();
  return s || String(name).trim();
}

// ─── Fix 2: กรอง Summary/Total rows ──────────────────────────
const SUMMARY_KEYWORDS = ['total','grand total','รวม','รวมทั้งหมด','ยอดรวม','subtotal','รวมยอด'];

function isSummaryRow(name) {
  if (!name) return false;
  const n = String(name).trim().toLowerCase();
  return SUMMARY_KEYWORDS.some(k => n === k || n === k + ':');
}

// ─── Known column aliases ─────────────────────────────────────
const COLUMN_ALIASES = {
  productCode : ['รหัสสินค้า','product code','code','sku','รหัส'],
  productName : ['ชื่อสินค้า','สินค้า','product name','item name','product','item','ชื่อ'],
  group       : ['กลุ่ม','group','category group','service type','ประเภทการให้บริการ'],
  category    : ['หมวดสินค้า','หมวด','category','menu category','ประเภทสินค้า'],
  avgPrice    : ['ราคาขายเฉลี่ย','ราคาเฉลี่ย','avg price','average price','unit price','ราคา'],
  qty         : ['จำนวนการขาย','จำนวน','quantity','qty','sold','ยอดขาย (จำนวน)'],
  grossAmount : ['ยอดก่อนลด','gross','gross amount','before discount','ยอดรวม'],
  discount    : ['ส่วนลดสินค้า','ส่วนลด','discount','discount amount'],
  netAmount   : ['ราคาสุทธิ','net','net amount','net sales','ยอดสุทธิ','total'],
  branch      : ['สาขา','branch','store','outlet','shop'],
};

function mapColumns(headers) {
  const normalized = headers.map(h => (h || '').toString().trim().toLowerCase());
  const mapping = {};
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (let i = 0; i < normalized.length; i++) {
      if (aliases.some(a => normalized[i].includes(a.toLowerCase()))) {
        mapping[field] = i;
        break;
      }
    }
  }
  return mapping;
}

async function aiMapColumns(headers, sampleRows) {
  const prompt = `You are a Thai POS data analyst. Given these Excel column headers and sample rows, identify which column index (0-based) corresponds to each field. Return ONLY valid JSON, no markdown.\n\nHeaders: ${JSON.stringify(headers)}\nSample rows (first 3): ${JSON.stringify(sampleRows.slice(0,3))}\n\nReturn: {"productCode":N_or_null,"productName":N,"group":N_or_null,"category":N_or_null,"avgPrice":N_or_null,"qty":N,"grossAmount":N_or_null,"discount":N_or_null,"netAmount":N,"branch":N}`;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 300, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await res.json();
    const clean = (data.content?.[0]?.text || '').replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch (e) { console.warn('AI mapping failed', e); return null; }
}

// ─── Parse Excel ──────────────────────────────────────────────
async function parseExcelFile(file, showCodes) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        let headerIdx = 0;
        for (let i = 0; i < Math.min(5, raw.length); i++) {
          if (raw[i].filter(c => c !== '').length >= 5) { headerIdx = i; break; }
        }

        const headers = raw[headerIdx].map(h => String(h).trim());
        const dataRows = raw.slice(headerIdx + 1).filter(r => r.some(c => c !== '' && c !== null && c !== undefined));

        let mapping = mapColumns(headers);
        const hasCritical = mapping.productName !== undefined && mapping.qty !== undefined && mapping.netAmount !== undefined;
        if (!hasCritical) {
          const aiMap = await aiMapColumns(headers, dataRows);
          if (aiMap) { for (const [k, v] of Object.entries(aiMap)) { if (v !== null && mapping[k] === undefined) mapping[k] = v; } }
        }

        const rows = dataRows.map(r => {
          const rawName   = String(r[mapping.productName] ?? '').trim();
          const cleanName = stripProductCode(rawName);
          return {
            productCode    : String(r[mapping.productCode] ?? '').trim(),
            productName    : showCodes ? rawName : cleanName,
            productNameRaw : rawName,
            productNameClean: cleanName,
            group          : String(r[mapping.group] ?? '').trim(),
            category       : String(r[mapping.category] ?? '').trim(),
            avgPrice       : parseFloat(r[mapping.avgPrice]) || 0,
            qty            : parseFloat(r[mapping.qty]) || 0,
            grossAmount    : parseFloat(r[mapping.grossAmount]) || 0,
            discount       : parseFloat(r[mapping.discount]) || 0,
            netAmount      : parseFloat(r[mapping.netAmount]) || 0,
            branch         : String(r[mapping.branch] ?? '').trim(),
          };
        }).filter(r => {
          if (!r.productName) return false;
          // Fix 2: กรอง Total / summary rows
          if (isSummaryRow(r.productNameRaw)) return false;
          if (isSummaryRow(r.productNameClean)) return false;
          if (r.qty <= 0) return false;
          return true;
        });

        resolve({ headers, mapping, rows });
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// ─── Aggregate ────────────────────────────────────────────────
function aggregateData(rows) {
  const totalRevenue  = rows.reduce((s, r) => s + r.netAmount, 0);
  const totalQty      = rows.reduce((s, r) => s + r.qty, 0);
  const totalDiscount = rows.reduce((s, r) => s + r.discount, 0);
  const totalGross    = rows.reduce((s, r) => s + r.grossAmount, 0);

  const branchMap = {};
  rows.forEach(r => {
    const k = r.branch || 'ไม่ระบุ';
    if (!branchMap[k]) branchMap[k] = { branch: k, revenue: 0, qty: 0 };
    branchMap[k].revenue += r.netAmount;
    branchMap[k].qty     += r.qty;
  });
  const byBranch = Object.values(branchMap).sort((a,b) => b.revenue - a.revenue);

  function simplifyCategory(cat) {
    if (!cat) return 'อื่นๆ';
    let c = String(cat);
    for (const pfx of ['TW.','FD.','TW-','FD-']) { if (c.startsWith(pfx)) c = c.slice(pfx.length); }
    return c.split(' - ')[0].trim() || 'อื่นๆ';
  }

  const catMap = {};
  rows.forEach(r => {
    const k = simplifyCategory(r.category);
    if (!catMap[k]) catMap[k] = { category: k, revenue: 0, qty: 0 };
    catMap[k].revenue += r.netAmount;
    catMap[k].qty     += r.qty;
  });
  const byCategory = Object.values(catMap).sort((a,b) => b.revenue - a.revenue);

  const prodMap = {};
  rows.forEach(r => {
    const k = r.productNameClean || r.productName;
    if (!prodMap[k]) prodMap[k] = { name: k, rawName: r.productNameRaw, cleanName: k, revenue: 0, qty: 0, category: simplifyCategory(r.category) };
    prodMap[k].revenue += r.netAmount;
    prodMap[k].qty     += r.qty;
  });
  const topProducts = Object.values(prodMap)
    .sort((a,b) => b.revenue - a.revenue)
    .map(p => ({ ...p, avgPrice: p.qty > 0 ? Math.round(p.revenue / p.qty) : 0 }));

  const branches   = [...new Set(rows.map(r => r.branch).filter(Boolean))].sort();
  const categories = [...new Set(rows.map(r => simplifyCategory(r.category)).filter(Boolean))].sort();

  return {
    totalRevenue, totalQty, totalDiscount, totalGross,
    discountRate : totalGross > 0 ? (totalDiscount / totalGross * 100) : 0,
    branchCount  : byBranch.length,
    productCount : topProducts.length,
    byBranch, byCategory, topProducts,
    branches, categories,
  };
}

// ─── Firestore ────────────────────────────────────────────────
async function saveReportToFirestore(db, { fileName, period, summary, rows }) {
  const { doc, setDoc, collection, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  const reportRef = doc(collection(db, SA_COLLECTION));
  const reportId  = reportRef.id;
  await setDoc(reportRef, {
    id: reportId, fileName, period: period || '',
    uploadedAt: serverTimestamp(),
    uploadedBy: window.currentUser?.username || window.currentUser?.name || 'unknown',
    summary: {
      totalRevenue: summary.totalRevenue, totalQty: summary.totalQty,
      totalDiscount: summary.totalDiscount, totalGross: summary.totalGross || 0,
      discountRate: summary.discountRate, branchCount: summary.branchCount, productCount: summary.productCount,
    },
    byBranch: summary.byBranch, byCategory: summary.byCategory, topProducts: summary.topProducts.slice(0,50),
  });
  const BATCH = 400;
  for (let i = 0; i < rows.length; i += BATCH) {
    await addDoc(collection(db, SA_COLLECTION, reportId, 'rawRows'), { rows: rows.slice(i, i+BATCH), chunkIndex: Math.floor(i/BATCH) });
  }
  return reportId;
}

async function loadReportList(db, limitN = 20) {
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

window.SA = { stripProductCode, isSummaryRow, parseExcelFile, aggregateData, saveReportToFirestore, loadReportList, loadReport, deleteReport };

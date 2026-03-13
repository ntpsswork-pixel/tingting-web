// asset-mgmt.js — TTGPlus Asset Management System
// Collections: assets, assetAuditRounds, assetAuditResults, assetRepairs
// Storage:     assets/{assetId}/main/, assets/{assetId}/repair/, assets/{assetId}/audit/

// ─────────────────────────────────────────────────────────────────────
//  CONSTANTS & HELPERS
// ─────────────────────────────────────────────────────────────────────
const ASSET_CATEGORIES = ['อุปกรณ์ครัว','IT Equipment','เฟอร์นิเจอร์','ยานพาหนะ','อื่นๆ'];
const ASSET_STATUS_MAP = {
    'ปกติ':          { color:'#059669', bg:'#f0fdf4', border:'#a7f3d0', icon:'✅' },
    'ชำรุด':         { color:'#dc2626', bg:'#fef2f2', border:'#fecaca', icon:'⚠️' },
    'กำลังซ่อม':     { color:'#d97706', bg:'#fffbeb', border:'#fde68a', icon:'🔧' },
    'จำหน่ายแล้ว':   { color:'#94a3b8', bg:'#f8fafc', border:'#e2e8f0', icon:'🗑️' },
};

let _assetActiveTab = 'registry';

// ─────────────────────────────────────────────────────────────────────
//  FIREBASE IMPORTS (lazy)
// ─────────────────────────────────────────────────────────────────────
let _fsImported = false;
let _addDoc, _setDoc, _getDoc, _getDocs, _updateDoc, _deleteDoc,
    _collection, _query, _where, _orderBy, _doc, _serverTimestamp;
async function _importFS() {
    if (_fsImported) return;
    const fs = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    _addDoc = fs.addDoc; _setDoc = fs.setDoc; _getDoc = fs.getDoc; _getDocs = fs.getDocs;
    _updateDoc = fs.updateDoc; _deleteDoc = fs.deleteDoc; _collection = fs.collection;
    _query = fs.query; _where = fs.where; _orderBy = fs.orderBy; _doc = fs.doc;
    _serverTimestamp = fs.serverTimestamp;
    _fsImported = true;
}

// ── Image: compress to Base64 JPEG, store in Firestore (no Firebase Storage needed) ──
async function _uploadImage(file, _path) {
    return new Promise((resolve, reject) => {
        if (!file) return reject(new Error('ไม่พบไฟล์'));
        if (file.size > 10 * 1024 * 1024) return reject(new Error('ไฟล์ใหญ่เกิน 10MB'));
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('อ่านไฟล์ไม่ได้'));
        reader.onload = e => {
            const img = new Image();
            img.onerror = () => reject(new Error('ไฟล์ไม่ใช่รูปภาพ'));
            img.onload = () => {
                const MAX = 800;
                let w = img.width, h = img.height;
                if (w > MAX || h > MAX) {
                    if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
                    else       { w = Math.round(w * MAX / h); h = MAX; }
                }
                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
                const bytes = Math.round((dataUrl.length * 3) / 4);
                resolve(bytes > 900 * 1024 ? canvas.toDataURL('image/jpeg', 0.5) : dataUrl);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// ─────────────────────────────────────────────────────────────────────
//  AUTO ID GENERATOR
// ─────────────────────────────────────────────────────────────────────
async function _genAssetId() {
    await _importFS();
    const snap = await _getDocs(_collection(db, 'assets'));
    const ids = snap.docs.map(d => d.id).filter(id => id.startsWith('AST-'));
    const nums = ids.map(id => parseInt(id.replace('AST-', '')) || 0);
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return 'AST-' + String(next).padStart(4, '0');
}

// ─────────────────────────────────────────────────────────────────────
//  DEPRECIATION (Straight Line)
// ─────────────────────────────────────────────────────────────────────
function _calcDepreciation(price, lifeYears, purchaseDateStr) {
    if (!price || !lifeYears || !purchaseDateStr) return { yearly: 0, accumulated: 0, remaining: price || 0, pct: 0 };
    const [d, m, y] = purchaseDateStr.split('/').map(Number);
    const purchaseDate = new Date(y - 543, m - 1, d);
    const nowDate = new Date();
    const yearsElapsed = (nowDate - purchaseDate) / (1000 * 60 * 60 * 24 * 365.25);
    const yearly = price / lifeYears;
    const accumulated = Math.min(yearly * Math.max(0, yearsElapsed), price);
    const remaining = Math.max(0, price - accumulated);
    const pct = Math.min(100, (accumulated / price) * 100);
    return { yearly: Math.round(yearly), accumulated: Math.round(accumulated), remaining: Math.round(remaining), pct: Math.round(pct), yearsElapsed: Math.round(yearsElapsed * 10) / 10 };
}

// Thai date helpers
function _todayTH() {
    const d = new Date();
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()+543}`;
}
function _isoToTH(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()+543}`;
}
function _thToISO(th) {
    if (!th) return '';
    const [d, m, y] = th.split('/').map(Number);
    return `${y - 543}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
function _fmt(n) { return (n||0).toLocaleString('th-TH'); }

// QR Code via qrcode.js CDN
function _makeQR(el, text) {
    if (!el) return;
    el.innerHTML = '';
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    script.onload = () => {
        try { new QRCode(el, { text, width: 80, height: 80, correctLevel: QRCode.CorrectLevel.M }); }
        catch(e) { el.innerHTML = `<div style="font-size:9px;color:#94a3b8;word-break:break-all;">${text}</div>`; }
    };
    if (window.QRCode) {
        try { new QRCode(el, { text, width: 80, height: 80, correctLevel: QRCode.CorrectLevel.M }); }
        catch(e) {}
    } else {
        document.head.appendChild(script);
    }
}

// ─────────────────────────────────────────────────────────────────────
//  MAIN ENTRY
// ─────────────────────────────────────────────────────────────────────
window.openAssetManagement = function(defaultTab) {
    _assetActiveTab = defaultTab || 'registry';
    document.getElementById('dashboardView').classList.add('hidden');
    const c = document.getElementById('toolAppContainer'); c.classList.remove('hidden');
    _renderAssetShell(c);
};

function _renderAssetShell(c) {
    const role = currentUser?.role;
    const isAdmin = role === 'admin';
    const tabs = [
        { id: 'registry', icon: '📋', label: 'ทะเบียนทรัพย์สิน' },
        { id: 'audit',    icon: '🔍', label: 'ตรวจนับรายรอบ' },
        { id: 'repair',   icon: '🔧', label: 'แจ้งซ่อม' },
        { id: 'dashboard',icon: '📊', label: 'Dashboard' },
        ...(isAdmin ? [{ id: 'settings', icon: '⚙️', label: 'ตั้งค่า' }] : []),
    ];

    c.innerHTML = `
    <div class="tool-header" style="margin-bottom:0;border-bottom:none;padding-bottom:0;">
        <h2>🏷️ ระบบทรัพย์สิน</h2>
        <button onclick="closeTool()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:600;">✕ ปิด</button>
    </div>
    <div style="display:flex;gap:3px;flex-wrap:wrap;margin:14px 0 0;border-bottom:2px solid #e2e8f0;" id="assetTabBar">
        ${tabs.map(t=>`<button id="assetTab_${t.id}" onclick="assetSwitchTab('${t.id}')"
            style="padding:9px 18px;border:none;border-radius:10px 10px 0 0;cursor:pointer;font-size:12px;font-weight:700;font-family:inherit;transition:all .15s;
            ${_assetActiveTab===t.id?'background:white;color:#0f172a;border:2px solid #e2e8f0;border-bottom:2px solid white;margin-bottom:-2px;':'background:#f8fafc;color:#94a3b8;border:2px solid transparent;'}"
            >${t.icon} ${t.label}</button>`).join('')}
    </div>
    <div id="assetTabContent" style="background:white;border:2px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;padding:24px;min-height:500px;"></div>`;

    assetSwitchTab(_assetActiveTab);
}

window.assetSwitchTab = function(tabId) {
    _assetActiveTab = tabId;
    ['registry','audit','repair','dashboard','settings'].forEach(id => {
        const btn = document.getElementById(`assetTab_${id}`); if (!btn) return;
        if (id === tabId) {
            btn.style.background = 'white'; btn.style.color = '#0f172a';
            btn.style.border = '2px solid #e2e8f0'; btn.style.borderBottom = '2px solid white'; btn.style.marginBottom = '-2px';
        } else {
            btn.style.background = '#f8fafc'; btn.style.color = '#94a3b8';
            btn.style.border = '2px solid transparent'; btn.style.marginBottom = '0';
        }
    });
    const content = document.getElementById('assetTabContent'); if (!content) return;
    switch (tabId) {
        case 'registry':  _renderRegistry(content); break;
        case 'audit':     _renderAudit(content); break;
        case 'repair':    _renderRepair(content); break;
        case 'dashboard': _renderDashboard(content); break;
        case 'settings':  _renderAssetSettings(content); break;
    }
};

// ═════════════════════════════════════════════════════════════════════
//  TAB 1: REGISTRY — ทะเบียนทรัพย์สิน
// ═════════════════════════════════════════════════════════════════════
function _renderRegistry(c) {
    const isAdmin = currentUser?.role === 'admin';
    c.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
        <div style="font-size:15px;font-weight:800;color:#0f172a;">📋 ทะเบียนทรัพย์สินทั้งหมด</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${isAdmin ? `
            <button onclick="_openAddAssetForm()" style="background:#0f172a;color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;">+ เพิ่มทรัพย์สิน</button>
            <button onclick="_downloadAssetTemplate()" style="background:#0369a1;color:white;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;">📋 Template</button>
            <button onclick="_importAssetsExcel()" style="background:#059669;color:white;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;">📥 Import Excel</button>
            ` : ''}
            <button onclick="_exportAssetsExcel()" style="background:#7c3aed;color:white;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;">📊 Excel</button>
            <button onclick="_exportAssetsPDF()" style="background:#dc2626;color:white;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;">📄 PDF</button>
        </div>
    </div>
    <!-- Filters -->
    <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
        <input type="text" id="assetSearchInput" placeholder="🔍 ค้นหารหัส / ชื่อ / Serial..."
            oninput="_filterAssets()"
            style="flex:1;min-width:180px;padding:8px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:12px;outline:none;font-family:inherit;"
            onfocus="this.style.borderColor='#3b82f6'" onblur="this.style.borderColor='#e2e8f0'">
        <select id="assetCatFilter" onchange="_filterAssets()"
            style="padding:8px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:12px;outline:none;cursor:pointer;">
            <option value="">— ทุกหมวด —</option>
            ${ASSET_CATEGORIES.map(c=>`<option value="${c}">${c}</option>`).join('')}
        </select>
        <select id="assetStatusFilter" onchange="_filterAssets()"
            style="padding:8px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:12px;outline:none;cursor:pointer;">
            <option value="">— ทุกสถานะ —</option>
            ${Object.keys(ASSET_STATUS_MAP).map(s=>`<option value="${s}">${ASSET_STATUS_MAP[s].icon} ${s}</option>`).join('')}
        </select>
        <select id="assetZoneFilter" onchange="_filterAssets()"
            style="padding:8px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:12px;outline:none;cursor:pointer;">
            <option value="">— ทุกสาขา/Zone —</option>
            ${(warehouseList||[]).map(z=>`<option value="${z}">${z}</option>`).join('')}
        </select>
    </div>
    <div id="assetRegistryContainer" style="min-height:200px;">
        <div style="text-align:center;padding:40px;color:#94a3b8;">⏳ กำลังโหลด...</div>
    </div>
    <!-- Add/Edit Form Modal -->
    <div id="assetFormOverlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9000;overflow-y:auto;padding:20px;box-sizing:border-box;">
        <div id="assetFormBox" style="background:white;border-radius:16px;max-width:700px;margin:0 auto;padding:28px;position:relative;"></div>
    </div>`;
    _loadAssets();
}

let _assetsCache = [];

async function _loadAssets() {
    await _importFS();
    const snap = await _getDocs(_query(_collection(db, 'assets'), _orderBy('createdAt', 'desc')));
    _assetsCache = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
    _renderAssetList(_assetsCache);
}

function _filterAssets() {
    const q = (document.getElementById('assetSearchInput')?.value || '').toLowerCase();
    const cat = document.getElementById('assetCatFilter')?.value || '';
    const status = document.getElementById('assetStatusFilter')?.value || '';
    const zone = document.getElementById('assetZoneFilter')?.value || '';
    const filtered = _assetsCache.filter(a => {
        const matchQ = !q || `${a._id} ${a.name} ${a.serial||''} ${a.brand||''}`.toLowerCase().includes(q);
        const matchCat = !cat || a.category === cat;
        const matchStatus = !status || a.status === status;
        const matchZone = !zone || a.zone === zone;
        return matchQ && matchCat && matchStatus && matchZone;
    });
    _renderAssetList(filtered);
}

function _renderAssetList(assets) {
    const c = document.getElementById('assetRegistryContainer'); if (!c) return;
    const isAdmin = currentUser?.role === 'admin';
    if (!assets.length) {
        c.innerHTML = `<div style="text-align:center;padding:40px;color:#94a3b8;border:2px dashed #e2e8f0;border-radius:12px;">ไม่พบทรัพย์สิน</div>`;
        return;
    }
    c.innerHTML = `
    <div style="overflow-x:auto;">
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead style="position:sticky;top:0;z-index:1;">
            <tr style="background:#f8fafc;">
                <th style="padding:10px 12px;text-align:left;font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;border-bottom:2px solid #e2e8f0;">รหัส / ชื่อ</th>
                <th style="padding:10px 12px;text-align:left;font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;border-bottom:2px solid #e2e8f0;">หมวด</th>
                <th style="padding:10px 12px;text-align:left;font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;border-bottom:2px solid #e2e8f0;">Zone / สาขา</th>
                <th style="padding:10px 12px;text-align:center;font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;border-bottom:2px solid #e2e8f0;">สถานะ</th>
                <th style="padding:10px 12px;text-align:right;font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;border-bottom:2px solid #e2e8f0;">มูลค่าคงเหลือ</th>
                <th style="padding:10px 12px;text-align:center;font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;border-bottom:2px solid #e2e8f0;">จัดการ</th>
            </tr>
        </thead>
        <tbody>
        ${assets.map(a => {
            const st = ASSET_STATUS_MAP[a.status] || ASSET_STATUS_MAP['ปกติ'];
            const dep = _calcDepreciation(a.price, a.lifeYears, a.purchaseDate);
            const hasImg = a.imageUrl;
            return `<tr style="border-bottom:1px solid #f1f5f9;transition:background .1s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
                <td style="padding:10px 12px;">
                    <div style="display:flex;align-items:center;gap:10px;">
                        ${hasImg ? `<img src="${a.imageUrl}" style="width:38px;height:38px;border-radius:7px;object-fit:cover;flex-shrink:0;border:1px solid #e2e8f0;">` :
                            `<div style="width:38px;height:38px;border-radius:7px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">📦</div>`}
                        <div>
                            <div style="font-weight:800;color:#0f172a;">${a._id}</div>
                            <div style="color:#475569;font-weight:600;">${a.name}</div>
                            ${a.serial ? `<div style="color:#94a3b8;font-size:10px;">S/N: ${a.serial}</div>` : ''}
                        </div>
                    </div>
                </td>
                <td style="padding:10px 12px;color:#475569;">${a.category||'—'}</td>
                <td style="padding:10px 12px;color:#475569;">${a.zone||'—'}</td>
                <td style="padding:10px 12px;text-align:center;">
                    <span style="background:${st.bg};color:${st.color};border:1px solid ${st.border};padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;white-space:nowrap;">${st.icon} ${a.status||'ปกติ'}</span>
                </td>
                <td style="padding:10px 12px;text-align:right;">
                    ${a.price ? `
                    <div style="font-weight:700;color:#0f172a;">฿${_fmt(dep.remaining)}</div>
                    <div style="font-size:10px;color:#94a3b8;">เสื่อม ${dep.pct}%</div>
                    ` : '<span style="color:#cbd5e1;">—</span>'}
                </td>
                <td style="padding:10px 12px;text-align:center;">
                    <div style="display:flex;gap:4px;justify-content:center;flex-wrap:wrap;">
                        <button onclick="_viewAsset('${a._id}')" style="background:#f1f5f9;color:#475569;border:none;padding:5px 9px;border-radius:6px;cursor:pointer;font-size:11px;">👁️ ดู</button>
                        ${isAdmin ? `
                        <button onclick="_openEditAssetForm('${a._id}')" style="background:#dbeafe;color:#1d4ed8;border:none;padding:5px 9px;border-radius:6px;cursor:pointer;font-size:11px;">✏️</button>
                        <button onclick="_printAssetQR('${a._id}')" style="background:#f5f3ff;color:#7c3aed;border:none;padding:5px 9px;border-radius:6px;cursor:pointer;font-size:11px;">🖨️ QR</button>
                        <button onclick="_deleteAsset('${a._id}')" style="background:#fee2e2;color:#ef4444;border:none;padding:5px 9px;border-radius:6px;cursor:pointer;font-size:11px;">🗑️</button>
                        ` : ''}
                        <button onclick="_openRepairFromAsset('${a._id}')" style="background:#fffbeb;color:#d97706;border:none;padding:5px 9px;border-radius:6px;cursor:pointer;font-size:11px;">🔧</button>
                    </div>
                </td>
            </tr>`;
        }).join('')}
        </tbody>
    </table></div>
    <div style="margin-top:12px;font-size:11px;color:#94a3b8;text-align:right;">รวม ${assets.length} รายการ</div>`;
}

// ─── Add / Edit Asset Form ────────────────────────────────────────────
window._openAddAssetForm = function(prefillId) {
    _showAssetForm(null, prefillId);
};
window._openEditAssetForm = async function(assetId) {
    const asset = _assetsCache.find(a => a._id === assetId);
    _showAssetForm(asset);
};

async function _showAssetForm(asset, prefillId) {
    const overlay = document.getElementById('assetFormOverlay');
    const box = document.getElementById('assetFormBox');
    if (!overlay || !box) return;
    overlay.style.display = 'block';
    const isEdit = !!asset;
    const today = _todayTH();

    box.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <div style="font-size:16px;font-weight:800;color:#0f172a;">${isEdit ? '✏️ แก้ไขทรัพย์สิน' : '➕ เพิ่มทรัพย์สินใหม่'}</div>
        <button onclick="document.getElementById('assetFormOverlay').style.display='none'"
            style="background:#f1f5f9;color:#475569;border:none;padding:7px 14px;border-radius:8px;cursor:pointer;font-size:13px;">✕</button>
    </div>

    <!-- รูปภาพ -->
    <div style="margin-bottom:18px;">
        <label style="font-size:10px;font-weight:700;color:#64748b;display:block;margin-bottom:6px;text-transform:uppercase;">📸 รูปภาพทรัพย์สิน</label>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <div id="assetImgPreview" style="width:90px;height:90px;border-radius:10px;background:#f1f5f9;border:2px dashed #e2e8f0;display:flex;align-items:center;justify-content:center;font-size:28px;overflow:hidden;flex-shrink:0;">
                ${asset?.imageUrl ? `<img src="${asset.imageUrl}" style="width:100%;height:100%;object-fit:cover;">` : '📦'}
            </div>
            <div>
                <label style="background:#0f172a;color:white;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;display:inline-block;">
                    📂 เลือกรูป<input type="file" id="assetImgInput" accept="image/*" style="display:none" onchange="_previewAssetImg(this)">
                </label>
                <div style="font-size:10px;color:#94a3b8;margin-top:5px;">รองรับ JPG, PNG, WEBP — ไม่เกิน 5MB</div>
                ${asset?.imageUrl ? `<button onclick="_clearAssetImg()" style="margin-top:5px;background:#fee2e2;color:#ef4444;border:none;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:10px;">✕ ลบรูปเดิม</button>` : ''}
            </div>
        </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
        <div>
            <label style="font-size:10px;font-weight:700;color:#64748b;display:block;margin-bottom:4px;">รหัสทรัพย์สิน <span style="color:#94a3b8;">(เว้นว่าง = Auto AST-XXXX)</span></label>
            <input type="text" id="af_id" value="${prefillId || asset?._id || ''}" ${isEdit ? 'readonly style="background:#f8fafc;color:#94a3b8;"' : ''}
                placeholder="เช่น AST-0001 หรือรหัสเดิม"
                style="width:100%;padding:9px 11px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:12px;font-family:monospace;outline:none;box-sizing:border-box;">
        </div>
        <div>
            <label style="font-size:10px;font-weight:700;color:#64748b;display:block;margin-bottom:4px;">ชื่อทรัพย์สิน *</label>
            <input type="text" id="af_name" value="${asset?.name || ''}" placeholder="เช่น มีดเชฟ Victorinox 10 นิ้ว"
                style="width:100%;padding:9px 11px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:12px;font-family:inherit;outline:none;box-sizing:border-box;"
                onfocus="this.style.borderColor='#3b82f6'" onblur="this.style.borderColor='#e2e8f0'">
        </div>
        <div>
            <label style="font-size:10px;font-weight:700;color:#64748b;display:block;margin-bottom:4px;">หมวดหมู่</label>
            <select id="af_cat" style="width:100%;padding:9px 11px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:12px;outline:none;cursor:pointer;">
                ${ASSET_CATEGORIES.map(cat=>`<option value="${cat}" ${asset?.category===cat?'selected':''}>${cat}</option>`).join('')}
            </select>
        </div>
        <div>
            <label style="font-size:10px;font-weight:700;color:#64748b;display:block;margin-bottom:4px;">สถานะ</label>
            <select id="af_status" style="width:100%;padding:9px 11px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:12px;outline:none;cursor:pointer;">
                ${Object.keys(ASSET_STATUS_MAP).map(s=>`<option value="${s}" ${asset?.status===s?'selected':''}>${ASSET_STATUS_MAP[s].icon} ${s}</option>`).join('')}
            </select>
        </div>
        <div>
            <label style="font-size:10px;font-weight:700;color:#64748b;display:block;margin-bottom:4px;">ยี่ห้อ / รุ่น</label>
            <input type="text" id="af_brand" value="${asset?.brand || ''}" placeholder="เช่น Victorinox / Fibrox"
                style="width:100%;padding:9px 11px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:12px;font-family:inherit;outline:none;box-sizing:border-box;">
        </div>
        <div>
            <label style="font-size:10px;font-weight:700;color:#64748b;display:block;margin-bottom:4px;">Serial No. / ทะเบียน</label>
            <input type="text" id="af_serial" value="${asset?.serial || ''}" placeholder="Serial หรือทะเบียนรถ"
                style="width:100%;padding:9px 11px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:12px;font-family:monospace;outline:none;box-sizing:border-box;">
        </div>
        <div>
            <label style="font-size:10px;font-weight:700;color:#64748b;display:block;margin-bottom:4px;">Zone / สาขาที่อยู่</label>
            <select id="af_zone" style="width:100%;padding:9px 11px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:12px;outline:none;cursor:pointer;">
                <option value="">— ไม่ระบุ —</option>
                ${(warehouseList||[]).map(z=>`<option value="${z}" ${asset?.zone===z?'selected':''}>${z}</option>`).join('')}
            </select>
        </div>
        <div>
            <label style="font-size:10px;font-weight:700;color:#64748b;display:block;margin-bottom:4px;">วันที่ซื้อ / วันที่ได้รับ</label>
            <input type="date" id="af_purchaseDate" value="${_thToISO(asset?.purchaseDate) || ''}"
                style="width:100%;padding:9px 11px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:12px;outline:none;box-sizing:border-box;">
        </div>
        <div>
            <label style="font-size:10px;font-weight:700;color:#64748b;display:block;margin-bottom:4px;">ราคาซื้อ (฿)</label>
            <input type="number" id="af_price" value="${asset?.price || ''}" placeholder="0" min="0"
                style="width:100%;padding:9px 11px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:12px;outline:none;box-sizing:border-box;">
        </div>
        <div>
            <label style="font-size:10px;font-weight:700;color:#64748b;display:block;margin-bottom:4px;">อายุใช้งาน (ปี) — สำหรับคำนวณค่าเสื่อม</label>
            <input type="number" id="af_life" value="${asset?.lifeYears || ''}" placeholder="เช่น 5" min="1"
                style="width:100%;padding:9px 11px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:12px;outline:none;box-sizing:border-box;">
        </div>
    </div>

    <!-- ── ข้อมูลทางบัญชี ── -->
    <div style="background:#fafafa;border:1.5px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:14px;">
        <div style="font-size:11px;font-weight:700;color:#64748b;margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px;">📑 ข้อมูลทางบัญชี (ไม่บังคับ)</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
                <label style="font-size:10px;font-weight:700;color:#64748b;display:block;margin-bottom:4px;">แผนก / รหัสแผนก</label>
                <input type="text" id="af_dept" value="${asset?.department || ''}" placeholder="เช่น 401003"
                    style="width:100%;padding:9px 11px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:12px;font-family:inherit;outline:none;box-sizing:border-box;">
            </div>
            <div>
                <label style="font-size:10px;font-weight:700;color:#64748b;display:block;margin-bottom:4px;">วันที่ขาย / จำหน่าย</label>
                <input type="date" id="af_soldDate" value="${_thToISO(asset?.soldDate) || ''}"
                    style="width:100%;padding:9px 11px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:12px;outline:none;box-sizing:border-box;">
            </div>
            <div>
                <label style="font-size:10px;font-weight:700;color:#64748b;display:block;margin-bottom:4px;">วันที่เริ่มคำนวณค่าเสื่อม</label>
                <input type="date" id="af_depStart" value="${_thToISO(asset?.depreciationStart) || ''}"
                    style="width:100%;padding:9px 11px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:12px;outline:none;box-sizing:border-box;">
            </div>
            <div>
                <label style="font-size:10px;font-weight:700;color:#64748b;display:block;margin-bottom:4px;">วันที่สิ้นสุดคำนวณค่าเสื่อม</label>
                <input type="date" id="af_depEnd" value="${_thToISO(asset?.depreciationEnd) || ''}"
                    style="width:100%;padding:9px 11px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:12px;outline:none;box-sizing:border-box;">
            </div>
        </div>
    </div>

    <div style="margin-bottom:14px;">
        <label style="font-size:10px;font-weight:700;color:#64748b;display:block;margin-bottom:4px;">หมายเหตุ</label>
        <textarea id="af_note" rows="2" placeholder="รายละเอียดเพิ่มเติม..."
            style="width:100%;padding:9px 11px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:12px;font-family:inherit;outline:none;resize:vertical;box-sizing:border-box;">${asset?.note || ''}</textarea>
    </div>

    <div style="display:flex;gap:10px;justify-content:flex-end;">
        <button onclick="document.getElementById('assetFormOverlay').style.display='none'"
            style="background:#f1f5f9;color:#475569;border:none;padding:10px 22px;border-radius:9px;cursor:pointer;font-weight:600;">ยกเลิก</button>
        <button onclick="_saveAsset('${isEdit ? asset._id : ''}')"
            style="background:linear-gradient(135deg,#1e40af,#3b82f6);color:white;border:none;padding:10px 28px;border-radius:9px;cursor:pointer;font-weight:700;font-size:13px;">
            💾 บันทึก
        </button>
    </div>`;
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'flex-start';
}

window._previewAssetImg = function(input) {
    const file = input.files[0]; if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast('⚠️ ไฟล์ใหญ่เกิน 5MB', '#c2410c'); input.value = ''; return; }
    const reader = new FileReader();
    reader.onload = e => {
        const prev = document.getElementById('assetImgPreview');
        if (prev) prev.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;">`;
    };
    reader.readAsDataURL(file);
};

window._clearAssetImg = function() {
    const prev = document.getElementById('assetImgPreview');
    if (prev) prev.innerHTML = '📦';
    const inp = document.getElementById('assetImgInput');
    if (inp) inp.value = '';
    window._assetClearImg = true;
};

window._saveAsset = async function(editId) {
    await _importFS();
    const name = document.getElementById('af_name')?.value.trim();
    if (!name) { toast('⚠️ กรุณาระบุชื่อทรัพย์สิน', '#c2410c'); return; }

    let finalId = (document.getElementById('af_id')?.value.trim()) || editId;
    if (!finalId && !editId) finalId = await _genAssetId();

    const purchaseDateISO = document.getElementById('af_purchaseDate')?.value;
    const data = {
        name,
        category:    document.getElementById('af_cat')?.value || 'อื่นๆ',
        status:      document.getElementById('af_status')?.value || 'ปกติ',
        brand:       document.getElementById('af_brand')?.value.trim() || '',
        serial:      document.getElementById('af_serial')?.value.trim() || '',
        zone:        document.getElementById('af_zone')?.value || '',
        purchaseDate: purchaseDateISO ? _isoToTH(purchaseDateISO) : '',
        price:       parseFloat(document.getElementById('af_price')?.value) || 0,
        lifeYears:   parseFloat(document.getElementById('af_life')?.value) || 0,
        note:        document.getElementById('af_note')?.value.trim() || '',
        department:        document.getElementById('af_dept')?.value.trim() || '',
        soldDate:          (() => { const v = document.getElementById('af_soldDate')?.value; return v ? _isoToTH(v) : ''; })(),
        depreciationStart: (() => { const v = document.getElementById('af_depStart')?.value; return v ? _isoToTH(v) : ''; })(),
        depreciationEnd:   (() => { const v = document.getElementById('af_depEnd')?.value; return v ? _isoToTH(v) : ''; })(),
        updatedAt:   Date.now(),
        updatedBy:   currentUser.name,
    };

    if (!editId) { data.createdAt = Date.now(); data.createdBy = currentUser.name; }

    // Upload image
    const imgFile = document.getElementById('assetImgInput')?.files[0];
    if (imgFile) {
        try {
            toast('⏳ กำลังอัปโหลดรูป...', '#0891b2');
            const url = await _uploadImage(imgFile, `assets/${finalId}/main/${Date.now()}_${imgFile.name}`);
            data.imageUrl = url;
            toast('✅ อัปโหลดรูปสำเร็จ', '#059669');
        } catch(e) {
            toast('❌ อัปโหลดรูปไม่สำเร็จ: ' + e.message, '#c2410c');
            console.error('Upload error:', e);
            return;
        }
    } else if (window._assetClearImg) {
        data.imageUrl = '';
        window._assetClearImg = false;
    }

    try {
        await _setDoc(_doc(db, 'assets', finalId), data, { merge: true });
        toast(`✅ ${editId ? 'แก้ไข' : 'เพิ่ม'}ทรัพย์สิน [${finalId}] เรียบร้อย`, '#059669');
        document.getElementById('assetFormOverlay').style.display = 'none';
        _loadAssets();
    } catch(e) { toast('❌ ' + e.message, '#ef4444'); }
};

window._deleteAsset = async function(assetId) {
    if (!confirm(`ลบทรัพย์สิน "${assetId}"?\nข้อมูลจะหายถาวร`)) return;
    await _importFS();
    await _deleteDoc(_doc(db, 'assets', assetId));
    toast('🗑️ ลบทรัพย์สินแล้ว', '#64748b');
    _loadAssets();
};

// ─── View Asset Detail ────────────────────────────────────────────────
window._viewAsset = function(assetId) {
    const asset = _assetsCache.find(a => a._id === assetId); if (!asset) return;
    const st = ASSET_STATUS_MAP[asset.status] || ASSET_STATUS_MAP['ปกติ'];
    const dep = _calcDepreciation(asset.price, asset.lifeYears, asset.purchaseDate);
    const overlay = document.getElementById('assetFormOverlay');
    const box = document.getElementById('assetFormBox');
    if (!overlay || !box) return;

    box.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <div style="font-size:16px;font-weight:800;color:#0f172a;">📋 ข้อมูลทรัพย์สิน</div>
        <button onclick="document.getElementById('assetFormOverlay').style.display='none'"
            style="background:#f1f5f9;color:#475569;border:none;padding:7px 14px;border-radius:8px;cursor:pointer;">✕</button>
    </div>
    <div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:20px;">
        ${asset.imageUrl ? `<img src="${asset.imageUrl}" style="width:120px;height:120px;border-radius:12px;object-fit:cover;border:2px solid #e2e8f0;flex-shrink:0;">` :
            `<div style="width:120px;height:120px;border-radius:12px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:40px;flex-shrink:0;">📦</div>`}
        <div style="flex:1;">
            <div style="font-size:22px;font-weight:900;color:#0f172a;margin-bottom:2px;">${asset._id}</div>
            <div style="font-size:16px;font-weight:700;color:#1e293b;margin-bottom:8px;">${asset.name}</div>
            <span style="background:${st.bg};color:${st.color};border:1px solid ${st.border};padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;">${st.icon} ${asset.status}</span>
        </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">
        ${[
            ['หมวดหมู่', asset.category],
            ['ยี่ห้อ/รุ่น', asset.brand],
            ['Serial/ทะเบียน', asset.serial],
            ['Zone/สาขา', asset.zone],
            ['วันที่ซื้อ', asset.purchaseDate],
            ['แผนก / รหัสแผนก', asset.department || '—'],
            ['วันที่ขาย / จำหน่าย', asset.soldDate || '—'],
            ['วันที่เริ่มคำนวณค่าเสื่อม', asset.depreciationStart || '—'],
            ['วันที่สิ้นสุดคำนวณค่าเสื่อม', asset.depreciationEnd || '—'],
            ['ราคาซื้อ', asset.price ? `฿${_fmt(asset.price)}` : '—'],
            ['อายุใช้งาน', asset.lifeYears ? `${asset.lifeYears} ปี` : '—'],
            ['บันทึกโดย', asset.createdBy],
        ].map(([k,v])=>`<div style="background:#f8fafc;border-radius:8px;padding:10px 12px;">
            <div style="font-size:9px;color:#94a3b8;font-weight:700;text-transform:uppercase;margin-bottom:2px;">${k}</div>
            <div style="font-size:13px;font-weight:600;color:#1e293b;">${v || '—'}</div>
        </div>`).join('')}
    </div>
    ${asset.price && asset.lifeYears ? `
    <div style="background:linear-gradient(135deg,#f0f9ff,#eff6ff);border-radius:10px;padding:14px;margin-bottom:14px;border:1px solid #bae6fd;">
        <div style="font-size:11px;font-weight:700;color:#0369a1;margin-bottom:8px;text-transform:uppercase;">📊 ค่าเสื่อมราคา (Straight Line)</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center;">
            <div><div style="font-size:17px;font-weight:900;color:#0f172a;">฿${_fmt(dep.yearly)}</div><div style="font-size:9px;color:#94a3b8;">ค่าเสื่อม/ปี</div></div>
            <div><div style="font-size:17px;font-weight:900;color:#dc2626;">฿${_fmt(dep.accumulated)}</div><div style="font-size:9px;color:#94a3b8;">สะสม (${dep.pct}%)</div></div>
            <div><div style="font-size:17px;font-weight:900;color:#059669;">฿${_fmt(dep.remaining)}</div><div style="font-size:9px;color:#94a3b8;">มูลค่าคงเหลือ</div></div>
        </div>
        <div style="margin-top:10px;background:#e2e8f0;border-radius:10px;height:6px;overflow:hidden;">
            <div style="background:#ef4444;height:100%;width:${dep.pct}%;border-radius:10px;transition:width .5s;"></div>
        </div>
    </div>` : ''}
    ${asset.note ? `<div style="background:#fffbeb;border-radius:8px;padding:10px 12px;border-left:3px solid #fde68a;margin-bottom:14px;"><div style="font-size:10px;color:#a16207;font-weight:700;margin-bottom:2px;">หมายเหตุ</div><div style="font-size:12px;color:#475569;">${asset.note}</div></div>` : ''}
    <!-- QR -->
    <div style="display:flex;align-items:center;gap:14px;padding:12px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
        <div id="assetDetailQR" style="flex-shrink:0;"></div>
        <div>
            <div style="font-size:11px;font-weight:700;color:#0f172a;margin-bottom:2px;">QR Code</div>
            <div style="font-size:10px;color:#94a3b8;">สแกนเพื่อดูข้อมูลทรัพย์สิน</div>
            <button onclick="_printAssetQR('${asset._id}')" style="margin-top:6px;background:#7c3aed;color:white;border:none;padding:5px 12px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:700;">🖨️ พิมพ์ QR</button>
        </div>
    </div>`;

    overlay.style.display = 'flex';
    overlay.style.alignItems = 'flex-start';
    setTimeout(() => _makeQR(document.getElementById('assetDetailQR'), asset._id), 100);
};

// ─── Print QR ─────────────────────────────────────────────────────────
window._printAssetQR = function(assetId) {
    const asset = _assetsCache.find(a => a._id === assetId); if (!asset) return;
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>QR - ${assetId}</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>
    <style>
        body{font-family:'Prompt',sans-serif;margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#f8fafc;}
        .card{background:white;border:2px solid #e2e8f0;border-radius:16px;padding:24px;text-align:center;width:220px;box-shadow:0 4px 20px rgba(0,0,0,.08);}
        .logo{font-size:12px;font-weight:700;color:#64748b;margin-bottom:10px;}
        .id{font-size:18px;font-weight:900;color:#0f172a;margin:10px 0 4px;}
        .name{font-size:12px;color:#475569;margin-bottom:4px;}
        .zone{font-size:10px;color:#94a3b8;}
        @media print{body{background:white;}.card{box-shadow:none;}}
    </style></head><body>
    <div class="card">
        <div class="logo">TingTing Asset</div>
        <div id="qrbox" style="display:flex;justify-content:center;margin-bottom:10px;"></div>
        <div class="id">${assetId}</div>
        <div class="name">${asset.name}</div>
        <div class="zone">${asset.zone || ''}</div>
    </div>
    <script>
        window.onload=()=>{
            new QRCode(document.getElementById('qrbox'),{text:'${assetId}',width:140,height:140,correctLevel:QRCode.CorrectLevel.M});
            setTimeout(()=>window.print(),800);
        };
    <\/script></body></html>`);
    win.document.close();
};

// ─── Export / Import Excel ────────────────────────────────────────────
window._exportAssetsExcel = function() {
    if (!_assetsCache.length) { toast('⚠️ ไม่มีข้อมูลทรัพย์สิน', '#c2410c'); return; }
    const rows = [['รหัส','ชื่อ','หมวด','ยี่ห้อ/รุ่น','Serial/ทะเบียน','Zone','สถานะ','วันที่ซื้อ','ราคาซื้อ','อายุใช้งาน(ปี)','มูลค่าคงเหลือ','หมายเหตุ','มีรูปภาพ']];
    _assetsCache.forEach(a => {
        const dep = _calcDepreciation(a.price, a.lifeYears, a.purchaseDate);
        rows.push([a._id, a.name, a.category||'', a.brand||'', a.serial||'', a.zone||'', a.status||'', a.purchaseDate||'', a.price||'', a.lifeYears||'', dep.remaining||'', a.note||'', a.imageUrl ? '✅ มีรูป' : '—']);
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{wch:12},{wch:30},{wch:14},{wch:16},{wch:14},{wch:12},{wch:12},{wch:12},{wch:10},{wch:10},{wch:12},{wch:20},{wch:10}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Assets');
    XLSX.writeFile(wb, `TingTing_Assets_${new Date().toISOString().slice(0,10)}.xlsx`);
    toast('✅ Export เรียบร้อย', '#059669');
};

// ─── Export PDF (client-side print) ──────────────────────────────────
window._exportAssetsPDF = function(assetsToExport) {
    const assets = assetsToExport || _assetsCache;
    if (!assets.length) { toast('⚠️ ไม่มีข้อมูล', '#c2410c'); return; }
    const now = _todayTH();
    const rows = assets.map(a => {
        const st = ASSET_STATUS_MAP[a.status] || ASSET_STATUS_MAP['ปกติ'];
        const dep = _calcDepreciation(a.price, a.lifeYears, a.purchaseDate);
        const imgHtml = a.imageUrl
            ? `<img src="${a.imageUrl}" style="width:44px;height:44px;object-fit:cover;border-radius:5px;border:1px solid #e2e8f0;">`
            : `<div style="width:44px;height:44px;border-radius:5px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:20px;">📦</div>`;
        return `<tr>
            <td style="padding:8px;border-bottom:1px solid #f1f5f9;vertical-align:middle;">${imgHtml}</td>
            <td style="padding:8px;border-bottom:1px solid #f1f5f9;vertical-align:middle;">
                <div style="font-weight:800;font-size:11px;">${a._id}</div>
                <div style="font-size:10px;color:#475569;">${a.name}</div>
                ${a.serial ? `<div style="font-size:9px;color:#94a3b8;">S/N: ${a.serial}</div>` : ''}
            </td>
            <td style="padding:8px;border-bottom:1px solid #f1f5f9;font-size:10px;vertical-align:middle;">${a.category||'—'}</td>
            <td style="padding:8px;border-bottom:1px solid #f1f5f9;font-size:10px;vertical-align:middle;">${a.zone||'—'}</td>
            <td style="padding:8px;border-bottom:1px solid #f1f5f9;vertical-align:middle;text-align:center;">
                <span style="background:${st.bg};color:${st.color};border:1px solid ${st.border};padding:2px 8px;border-radius:12px;font-size:9px;font-weight:700;white-space:nowrap;">${st.icon} ${a.status||'ปกติ'}</span>
            </td>
            <td style="padding:8px;border-bottom:1px solid #f1f5f9;font-size:10px;vertical-align:middle;text-align:right;">${a.purchaseDate||'—'}</td>
            <td style="padding:8px;border-bottom:1px solid #f1f5f9;font-size:10px;font-weight:700;vertical-align:middle;text-align:right;">${a.price ? '฿'+_fmt(a.price) : '—'}</td>
            <td style="padding:8px;border-bottom:1px solid #f1f5f9;font-size:10px;font-weight:700;color:#059669;vertical-align:middle;text-align:right;">${a.price ? '฿'+_fmt(dep.remaining) : '—'}</td>
        </tr>`;
    }).join('');
    const totalValue = assets.reduce((s,a)=>s+(a.price||0),0);
    const totalRemaining = assets.reduce((s,a)=>{ const d=_calcDepreciation(a.price,a.lifeYears,a.purchaseDate); return s+d.remaining; },0);
    const win = window.open('','_blank');
    win.document.write(`<!DOCTYPE html><html><head>
    <meta charset="utf-8">
    <title>TingTing — รายงานทรัพย์สิน</title>
    <link href="https://fonts.googleapis.com/css2?family=Prompt:wght@400;600;700;800&display=swap" rel="stylesheet">
    <style>
        *{box-sizing:border-box;margin:0;padding:0;}
        body{font-family:'Prompt',sans-serif;background:white;color:#0f172a;font-size:11px;padding:24px;}
        .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid #0f172a;}
        .logo{font-size:22px;font-weight:900;}.logo span{color:#f59e0b;}
        .title{font-size:15px;font-weight:800;color:#0f172a;margin-top:4px;}
        .subtitle{font-size:10px;color:#64748b;margin-top:2px;}
        .meta{text-align:right;font-size:10px;color:#64748b;}
        .kpi{display:flex;gap:12px;margin-bottom:18px;flex-wrap:wrap;}
        .kpi-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 16px;flex:1;min-width:120px;}
        .kpi-val{font-size:16px;font-weight:900;}
        .kpi-lbl{font-size:9px;color:#94a3b8;text-transform:uppercase;margin-top:2px;}
        table{width:100%;border-collapse:collapse;}
        thead{background:#0f172a;color:white;}
        th{padding:9px 8px;text-align:left;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;}
        th:last-child,th:nth-last-child(2),th:nth-last-child(3){text-align:right;}
        tbody tr:hover{background:#f8fafc;}
        .footer{margin-top:16px;padding-top:10px;border-top:1px solid #e2e8f0;text-align:center;font-size:9px;color:#94a3b8;}
        @media print{
            body{padding:12px;}
            @page{margin:12mm;size:A4 landscape;}
            thead{-webkit-print-color-adjust:exact;print-color-adjust:exact;background:#0f172a!important;color:white!important;}
            .kpi-box{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
        }
    </style></head><body>
    <div class="header">
        <div><div class="logo">Ting<span>Ting</span></div>
        <div class="title">รายงานทะเบียนทรัพย์สิน</div>
        <div class="subtitle">พิมพ์โดย: ${currentUser?.name||''}</div></div>
        <div class="meta"><div>วันที่พิมพ์: ${now}</div><div>รวม ${assets.length} รายการ</div></div>
    </div>
    <div class="kpi">
        <div class="kpi-box"><div class="kpi-val">${assets.length}</div><div class="kpi-lbl">ทรัพย์สินทั้งหมด</div></div>
        <div class="kpi-box"><div class="kpi-val" style="color:#1d4ed8;">฿${_fmt(totalValue)}</div><div class="kpi-lbl">มูลค่ารวม</div></div>
        <div class="kpi-box"><div class="kpi-val" style="color:#059669;">฿${_fmt(Math.round(totalRemaining))}</div><div class="kpi-lbl">มูลค่าคงเหลือรวม</div></div>
        <div class="kpi-box"><div class="kpi-val" style="color:#dc2626;">฿${_fmt(Math.round(totalValue-totalRemaining))}</div><div class="kpi-lbl">ค่าเสื่อมสะสม</div></div>
    </div>
    <table>
        <thead><tr>
            <th style="width:52px;">รูป</th>
            <th>รหัส / ชื่อ</th>
            <th>หมวด</th>
            <th>Zone</th>
            <th style="text-align:center;">สถานะ</th>
            <th style="text-align:right;">วันที่ซื้อ</th>
            <th style="text-align:right;">ราคาซื้อ</th>
            <th style="text-align:right;">มูลค่าคงเหลือ</th>
        </tr></thead>
        <tbody>${rows}</tbody>
    </table>
    <div class="footer">TingTing Asset Management — สร้างเมื่อ ${now}</div>
    <script>window.onload=()=>setTimeout(()=>window.print(),600);<\/script>
    </body></html>`);
    win.document.close();
};

// ─── Download Template ───────────────────────────────────────────────
window._downloadAssetTemplate = function() {
    const cats   = (typeof ASSET_CATEGORIES !== 'undefined') ? ASSET_CATEGORIES : ['อุปกรณ์ครัว','IT Equipment','เฟอร์นิเจอร์','ยานพาหนะ','อื่นๆ'];
    const zones  = (typeof warehouseList !== 'undefined' && warehouseList.length) ? warehouseList : ['สาขา1','สาขา2'];
    const stats  = ['ปกติ','ชำรุด','ซ่อมอยู่','เลิกใช้งาน'];

    const hdrs = ['รหัส','ชื่อ','หมวด','ยี่ห้อ/รุ่น','Serial/ทะเบียน','Zone','สถานะ',
                  'วันที่ซื้อ','วันที่สิ้นอายุ','ราคาซื้อ','แผนก',
                  'วันที่ขาย','วันที่เริ่มคำนวณ','วันที่สิ้นสุดคำนวณ','หมายเหตุ'];
    const ex1  = ['CC0020','ตู้แช่แข็ง SNG 0405',cats[0]||'อุปกรณ์ครัว','SNG','CC0020',zones[0]||'','ปกติ',
                  '2021-02-17','2031-02-14',35000,'401003','','2021-02-17','2031-02-14','ชั้น 1 คลังหลัก'];
    const ex2  = ['EQ000061','เก้าอี้ยางพาราทรงสี่เหลี่ยม No.1',cats[1]||'IT Equipment','—','—',zones[0]||'','ปกติ',
                  '2022-07-06','2028-07-05',5500,'401003','','2022-07-06','2028-07-05','ห้องประชุม'];

    const wb = XLSX.utils.book_new();

    // Sheet 1: Template
    const ws = XLSX.utils.aoa_to_sheet([hdrs, ex1, ex2]);
    ws['!cols'] = [
        {wch:12},{wch:32},{wch:20},{wch:18},{wch:16},{wch:12},{wch:12},
        {wch:14},{wch:14},{wch:12},{wch:10},{wch:14},{wch:18},{wch:18},{wch:24}
    ];
    // Comments บน header
    ws['C1'].c = [{ a:'TTGPlus', t:'ค่าที่รองรับ:\n' + cats.join('\n') }];
    ws['F1'].c = [{ a:'TTGPlus', t:'Zone ที่รองรับ:\n' + zones.join('\n') }];
    ws['G1'].c = [{ a:'TTGPlus', t:'สถานะที่รองรับ:\n' + stats.join('\n') }];
    ws['H1'].c = [{ a:'TTGPlus', t:'รูปแบบ: YYYY-MM-DD\nเช่น 2024-01-15' }];
    ws['I1'].c = [{ a:'TTGPlus', t:'วันที่สิ้นอายุ = วันซื้อ + อายุใช้งาน\nรูปแบบ: YYYY-MM-DD' }];
    XLSX.utils.book_append_sheet(wb, ws, '📋 Template');

    // Sheet 2: ค่าอ้างอิง
    const maxLen = Math.max(cats.length, zones.length, stats.length);
    const refData = [
        ['หมวดหมู่ (หมวด)', 'Zone / สาขา', 'สถานะ', 'รูปแบบวันที่'],
        ...Array.from({length: maxLen}, (_,i) => [cats[i]||'', zones[i]||'', stats[i]||'', i===0?'YYYY-MM-DD':i===1?'เช่น 2024-01-15':''])
    ];
    const wsRef = XLSX.utils.aoa_to_sheet(refData);
    wsRef['!cols'] = [{wch:22},{wch:20},{wch:16},{wch:18}];
    XLSX.utils.book_append_sheet(wb, wsRef, '📌 ค่าอ้างอิง');

    XLSX.writeFile(wb, 'TTGPlus_Asset_Template.xlsx');
    toast('✅ ดาวน์โหลด Template แล้ว', '#0369a1');
};

// ─── Import Excel with Preview ────────────────────────────────────────
window._importAssetsExcel = function() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.xlsx,.xls,.csv';
    input.onchange = async e => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            const wb   = XLSX.read(ev.target.result, { type:'array' });
            const raw  = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval:'' });
            if (!raw.length) { toast('❌ ไม่พบข้อมูลในไฟล์', '#c2410c'); return; }
            _showImportPreview(raw);
        };
        reader.readAsArrayBuffer(file);
    };
    input.click();
};

// ─── helper: แปลงวันที่ YYYY-MM-DD เป็น DD/MM/YYYY (พ.ศ.) ──────────────
function _isoToTHSafe(v) {
    if (!v) return '';
    const s = String(v).trim();
    // รูปแบบ YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        const [y, m, d] = s.split('-');
        return `${d}/${m}/${parseInt(y)+543}`;
    }
    // รูปแบบ DD/MM/YYYY (พ.ศ.) อยู่แล้ว
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
    return s;
}

// ─── helper: คำนวณ lifeYears จากวันซื้อ กับ วันสิ้นอายุ ────────────────
function _calcLifeYears(buyISO, expISO) {
    if (!buyISO || !expISO) return 0;
    const b = new Date(buyISO), e = new Date(expISO);
    if (isNaN(b) || isNaN(e)) return 0;
    return Math.max(0, Math.round((e - b) / (1000*60*60*24*365.25) * 10) / 10);
}

// ─── Import Preview ───────────────────────────────────────────────────
window._showImportPreview = function(raw) {
    const VALID_STATUS = ['ปกติ','ชำรุด','ซ่อมอยู่','เลิกใช้งาน'];
    const cats  = (typeof ASSET_CATEGORIES !== 'undefined') ? ASSET_CATEGORIES : [];
    const zones = (typeof warehouseList !== 'undefined') ? warehouseList : [];

    const rows = raw.map((row, i) => {
        const g  = k => String(row[k]||'').trim();
        const id          = g('รหัส')||g('รหัสบัญชี')||g('ProductCode');
        const name        = g('ชื่อ')||g('รายการ')||g('ProductName');
        const cat         = g('หมวด')||g('หมวดหมู่สินทรัพย์') || 'อื่นๆ';
        const zone        = g('Zone');
        const status      = g('สถานะ') || 'ปกติ';
        const buyDate     = g('วันที่ซื้อ');
        const expDate     = g('วันที่สิ้นอายุ');
        const dept        = g('แผนก')||g('รหัสแผนก');
        const soldDate    = g('วันที่ขาย');
        const depStart    = g('วันที่เริ่มคำนวณ')||g('วันที่เริ่มการคำนวณ');
        const depEnd      = g('วันที่สิ้นสุดคำนวณ')||g('วันที่สิ้นสุดการคำนวณ');
        const price       = parseFloat(row['ราคาซื้อ'])||0;
        const lifeYears   = parseFloat(row['อายุใช้งาน(ปี)']) || _calcLifeYears(buyDate, expDate);
        const note        = g('หมายเหตุ');
        const brand       = g('ยี่ห้อ/รุ่น');
        const serial      = g('Serial/ทะเบียน');

        const errors = [];
        if (!id)   errors.push('ไม่มีรหัส');
        if (!name) errors.push('ไม่มีชื่อ');
        if (zones.length && zone && !zones.includes(zone)) errors.push(`Zone "${zone}" ไม่มีในระบบ`);
        if (status && !VALID_STATUS.includes(status)) errors.push(`สถานะ "${status}" ไม่ถูกต้อง`);
        if (buyDate && !/^\d{4}-\d{2}-\d{2}$/.test(buyDate)) errors.push('วันที่ซื้อควรเป็น YYYY-MM-DD');

        return { _row:i+2, id, name, cat, zone, status, buyDate, expDate,
                 price, lifeYears, dept, soldDate, depStart, depEnd,
                 brand, serial, note, errors, ok: errors.length === 0 };
    });

    const okRows  = rows.filter(r => r.ok);
    const errRows = rows.filter(r => !r.ok);

    const overlay = document.createElement('div');
    overlay.id = 'importPreviewOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:24px;overflow-y:auto;';

    const rowsHtml = rows.map(r => {
        const bg     = r.errors.length ? '#fef2f2' : '#f0fdf4';
        const border = r.errors.length ? '#fecaca' : '#a7f3d0';
        const badge  = r.errors.length
            ? `<span style="background:#fee2e2;color:#dc2626;border:1px solid #fecaca;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;">❌ ${r.errors.join(', ')}</span>`
            : `<span style="background:#dcfce7;color:#15803d;border:1px solid #a7f3d0;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;">✅ พร้อม</span>`;
        return `<tr style="background:${bg};border-bottom:1px solid ${border};">
            <td style="padding:6px 8px;font-size:10px;color:#94a3b8;">${r._row}</td>
            <td style="padding:6px 8px;font-size:11px;font-weight:700;font-family:monospace;">${r.id||'—'}</td>
            <td style="padding:6px 8px;font-size:11px;">${r.name||'—'}</td>
            <td style="padding:6px 8px;font-size:10px;">${r.cat}</td>
            <td style="padding:6px 8px;font-size:10px;">${r.dept||'—'}</td>
            <td style="padding:6px 8px;font-size:10px;">${r.zone||'—'}</td>
            <td style="padding:6px 8px;font-size:10px;">${r.buyDate||'—'}</td>
            <td style="padding:6px 8px;font-size:10px;">${r.expDate||'—'}</td>
            <td style="padding:6px 8px;font-size:10px;text-align:right;">${r.price?'฿'+r.price.toLocaleString():'—'}</td>
            <td style="padding:6px 8px;font-size:10px;">${r.lifeYears||'—'} ปี</td>
            <td style="padding:6px 8px;">${badge}</td>
        </tr>`;
    }).join('');

    overlay.innerHTML = `
    <div style="background:white;border-radius:16px;width:100%;max-width:1200px;box-shadow:0 20px 60px rgba(0,0,0,0.25);overflow:hidden;">
        <div style="background:#0f172a;padding:16px 22px;display:flex;justify-content:space-between;align-items:center;">
            <div>
                <div style="font-size:15px;font-weight:800;color:white;">🔍 ตรวจสอบข้อมูลก่อน Import</div>
                <div style="font-size:11px;color:#94a3b8;margin-top:2px;">พบ ${rows.length} แถว — พร้อม: ${okRows.length} | มีปัญหา: ${errRows.length}</div>
            </div>
            <button onclick="document.getElementById('importPreviewOverlay').remove()"
                style="background:#334155;color:white;border:none;width:30px;height:30px;border-radius:8px;cursor:pointer;font-size:14px;">✕</button>
        </div>

        <div style="display:flex;gap:10px;padding:14px 22px;background:#f8fafc;border-bottom:1px solid #e2e8f0;flex-wrap:wrap;">
            <div style="background:#f0fdf4;border:1px solid #a7f3d0;border-radius:8px;padding:10px 16px;flex:1;min-width:110px;">
                <div style="font-size:18px;font-weight:900;color:#059669;">${okRows.length}</div>
                <div style="font-size:10px;color:#64748b;margin-top:1px;">พร้อม Import</div>
            </div>
            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 16px;flex:1;min-width:110px;">
                <div style="font-size:18px;font-weight:900;color:#dc2626;">${errRows.length}</div>
                <div style="font-size:10px;color:#64748b;margin-top:1px;">มีข้อผิดพลาด (ข้าม)</div>
            </div>
        </div>

        ${errRows.length ? `<div style="padding:8px 22px;background:#fef2f2;border-bottom:1px solid #fecaca;font-size:11px;color:#dc2626;">
            ⚠️ แถวสีแดงจะถูกข้ามอัตโนมัติ — แก้ไขแล้ว Import ใหม่ได้เลย
        </div>` : ''}

        <div style="overflow-x:auto;max-height:400px;overflow-y:auto;">
            <table style="width:100%;border-collapse:collapse;min-width:900px;">
                <thead style="position:sticky;top:0;background:#0f172a;z-index:1;">
                    <tr>
                        ${['แถว','รหัส','ชื่อ','หมวด','แผนก','Zone','วันที่ซื้อ','วันสิ้นอายุ','ราคา','อายุ (ปี)','ตรวจสอบ'].map(h =>
                            `<th style="padding:8px 8px;text-align:left;font-size:10px;color:white;font-weight:600;white-space:nowrap;">${h}</th>`
                        ).join('')}
                    </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
            </table>
        </div>

        <div style="padding:14px 22px;border-top:1px solid #e2e8f0;display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;">
            <button onclick="document.getElementById('importPreviewOverlay').remove()"
                style="background:#f1f5f9;color:#475569;border:none;padding:9px 18px;border-radius:8px;cursor:pointer;font-weight:600;font-size:12px;">ยกเลิก</button>
            ${okRows.length
                ? `<button onclick="_confirmImportAssets()" id="confirmImportBtn"
                    style="background:#059669;color:white;border:none;padding:9px 22px;border-radius:8px;cursor:pointer;font-weight:700;font-size:12px;">
                    ✅ Import ${okRows.length} รายการ
                   </button>`
                : `<button disabled style="background:#e2e8f0;color:#94a3b8;border:none;padding:9px 22px;border-radius:8px;font-weight:700;font-size:12px;">ไม่มีรายการที่นำเข้าได้</button>`}
        </div>
    </div>`;

    document.body.appendChild(overlay);
    window._pendingImportRows = okRows;
};

window._confirmImportAssets = async function() {
    const rows = window._pendingImportRows || [];
    if (!rows.length) return;
    const btn = document.getElementById('confirmImportBtn');
    if (btn) { btn.disabled = true; btn.textContent = `⏳ กำลัง Import ${rows.length} รายการ...`; }
    await _importFS();
    let added = 0;
    for (const r of rows) {
        const d = {
            name:              r.name,
            category:          r.cat,
            brand:             r.brand || '',
            serial:            r.serial || '',
            zone:              r.zone || '',
            status:            r.status || 'ปกติ',
            purchaseDate:      _isoToTHSafe(r.buyDate),
            price:             r.price,
            lifeYears:         r.lifeYears,
            note:              r.note || '',
            department:        r.dept || '',
            soldDate:          _isoToTHSafe(r.soldDate),
            depreciationStart: _isoToTHSafe(r.depStart),
            depreciationEnd:   _isoToTHSafe(r.depEnd),
            createdAt: Date.now(), createdBy: currentUser.name,
            updatedAt: Date.now(), updatedBy: currentUser.name,
        };
        await _setDoc(_doc(db, 'assets', r.id), d, { merge: true });
        added++;
    }
    document.getElementById('importPreviewOverlay')?.remove();
    window._pendingImportRows = [];
    toast(`✅ Import สำเร็จ ${added} รายการ`, '#059669');
    _loadAssets();
};

// ─── Delete Repair Document ───────────────────────────────────────────
window._repairDelete = async function(repairId, repairNo) {
    if (!confirm(`ยืนยันลบใบแจ้งซ่อม ${repairNo}?\nการลบไม่สามารถกู้คืนได้`)) return;
    try {
        await _importFS();
        await _deleteDoc(_doc(db, 'assetRepairs', repairId));
        toast(`🗑️ ลบใบแจ้งซ่อม ${repairNo} แล้ว`, '#dc2626');
        _loadRepairs();
    } catch(e) {
        console.error(e);
        toast('❌ ลบไม่สำเร็จ: ' + e.message, '#c2410c');
    }
};

// ─── Asset Settings (Category Management) ────────────────────────────
function _renderAssetSettings(c) {
    c.innerHTML = `
    <div style="max-width:560px;">
        <div style="font-size:15px;font-weight:800;color:#0f172a;margin-bottom:4px;">⚙️ ตั้งค่าทรัพย์สิน</div>
        <div style="font-size:12px;color:#94a3b8;margin-bottom:20px;">จัดการหมวดหมู่ทรัพย์สินที่ใช้ในระบบ</div>
        <div style="background:white;border-radius:14px;border:1.5px solid #e2e8f0;padding:20px;margin-bottom:16px;">
            <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:14px;">📂 หมวดหมู่ทรัพย์สิน</div>
            <div id="assetCatList" style="margin-bottom:16px;"></div>
            <div style="display:flex;gap:8px;align-items:center;">
                <input type="text" id="newCatInput" placeholder="ชื่อหมวดหมู่ใหม่..."
                    style="flex:1;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:12px;font-family:inherit;outline:none;"
                    onkeydown="if(event.key==='Enter') _assetCatAdd()">
                <button onclick="_assetCatAdd()"
                    style="background:#0f172a;color:white;border:none;padding:9px 18px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;white-space:nowrap;">+ เพิ่ม</button>
            </div>
            <div style="font-size:10px;color:#94a3b8;margin-top:8px;">
                ⚠️ การลบหมวดหมู่จะไม่กระทบทรัพย์สินที่มีอยู่แล้ว — แค่ไม่สามารถเลือกหมวดนั้นได้ในการเพิ่มใหม่
            </div>
        </div>
    </div>`;
    _assetCatRender();
}

function _assetCatRender() {
    const el = document.getElementById('assetCatList');
    if (!el) return;
    if (!ASSET_CATEGORIES.length) {
        el.innerHTML = '<div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px;">ยังไม่มีหมวดหมู่</div>';
        return;
    }
    el.innerHTML = ASSET_CATEGORIES.map((cat, i) => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:9px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:6px;">
            <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-size:13px;">📂</span>
                <span id="catLabel_${i}" style="font-size:12px;font-weight:600;color:#0f172a;">${cat}</span>
                <input id="catInput_${i}" type="text" value="${cat}"
                    style="display:none;font-size:12px;padding:4px 8px;border:1.5px solid #93c5fd;border-radius:6px;font-family:inherit;outline:none;"
                    onkeydown="if(event.key==='Enter') _assetCatSaveEdit(${i}); if(event.key==='Escape') _assetCatCancelEdit(${i})">
            </div>
            <div style="display:flex;gap:5px;" id="catBtns_${i}">
                <button onclick="_assetCatStartEdit(${i})"
                    style="background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:10px;font-weight:600;">✏️ แก้ไข</button>
                <button onclick="_assetCatDelete(${i})"
                    style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:10px;font-weight:600;">🗑️ ลบ</button>
            </div>
            <div style="display:none;gap:5px;" id="catEditBtns_${i}">
                <button onclick="_assetCatSaveEdit(${i})"
                    style="background:#f0fdf4;color:#059669;border:1px solid #a7f3d0;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:10px;font-weight:600;">✅ บันทึก</button>
                <button onclick="_assetCatCancelEdit(${i})"
                    style="background:#f1f5f9;color:#475569;border:none;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:10px;">ยกเลิก</button>
            </div>
        </div>`).join('');
}

window._assetCatAdd = function() {
    const input = document.getElementById('newCatInput');
    const val = input?.value.trim();
    if (!val) { toast('⚠️ กรุณากรอกชื่อหมวดหมู่', '#c2410c'); return; }
    if (ASSET_CATEGORIES.includes(val)) { toast('⚠️ มีหมวดหมู่นี้แล้ว', '#c2410c'); return; }
    ASSET_CATEGORIES.push(val);
    input.value = '';
    _assetCatRender();
    toast(`✅ เพิ่มหมวดหมู่ "${val}" แล้ว`, '#059669');
};

window._assetCatDelete = function(i) {
    const cat = ASSET_CATEGORIES[i];
    if (!cat) return;
    if (!confirm(`ลบหมวดหมู่ "${cat}"?`)) return;
    ASSET_CATEGORIES.splice(i, 1);
    _assetCatRender();
    toast(`🗑️ ลบหมวดหมู่ "${cat}" แล้ว`, '#dc2626');
};

window._assetCatStartEdit = function(i) {
    document.getElementById(`catLabel_${i}`).style.display = 'none';
    document.getElementById(`catInput_${i}`).style.display = 'inline-block';
    document.getElementById(`catBtns_${i}`).style.display = 'none';
    document.getElementById(`catEditBtns_${i}`).style.display = 'flex';
    document.getElementById(`catInput_${i}`).focus();
};

window._assetCatCancelEdit = function(i) {
    document.getElementById(`catLabel_${i}`).style.display = 'inline';
    document.getElementById(`catInput_${i}`).style.display = 'none';
    document.getElementById(`catBtns_${i}`).style.display = 'flex';
    document.getElementById(`catEditBtns_${i}`).style.display = 'none';
};

window._assetCatSaveEdit = function(i) {
    const val = document.getElementById(`catInput_${i}`)?.value.trim();
    if (!val) { toast('⚠️ ชื่อหมวดหมู่ต้องไม่ว่าง', '#c2410c'); return; }
    if (ASSET_CATEGORIES.includes(val) && ASSET_CATEGORIES[i] !== val) {
        toast('⚠️ มีหมวดหมู่นี้แล้ว', '#c2410c'); return;
    }
    const old = ASSET_CATEGORIES[i];
    ASSET_CATEGORIES[i] = val;
    _assetCatRender();
    toast(`✅ เปลี่ยน "${old}" → "${val}" แล้ว`, '#059669');
};

// ─── Open Repair from Registry ────────────────────────────────────────
window._openRepairFromAsset = function(assetId) {
    assetSwitchTab('repair');
    setTimeout(() => _openNewRepairForm(assetId), 300);
};

// ═════════════════════════════════════════════════════════════════════
//  TAB 2: AUDIT — ตรวจนับรายรอบ
// ═════════════════════════════════════════════════════════════════════
function _renderAudit(c) {
    const isAdmin = currentUser?.role === 'admin';
    c.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:10px;">
        <div><div style="font-size:15px;font-weight:800;color:#0f172a;">🔍 ตรวจนับทรัพย์สินรายรอบ</div>
        <div style="font-size:12px;color:#94a3b8;margin-top:2px;">Admin เปิดรอบ → พนักงานตรวจนับ → สรุปผล</div></div>
        ${isAdmin ? `<button onclick="_openCreateAuditRound()" style="background:#0f172a;color:white;border:none;padding:8px 18px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;">+ เปิดรอบตรวจนับ</button>` : ''}
    </div>
    <div id="auditRoundList" style="min-height:200px;"><div style="text-align:center;padding:40px;color:#94a3b8;">⏳ กำลังโหลด...</div></div>
    <div id="auditFormArea" style="margin-top:16px;"></div>
    <div id="auditCountArea" style="margin-top:16px;"></div>`;
    _loadAuditRounds();
}

async function _loadAuditRounds() {
    await _importFS();
    const snap = await _getDocs(_query(_collection(db, 'assetAuditRounds'), _orderBy('createdAt', 'desc')));
    const rounds = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
    const c = document.getElementById('auditRoundList'); if (!c) return;
    if (!rounds.length) { c.innerHTML = `<div style="text-align:center;padding:30px;color:#94a3b8;border:2px dashed #e2e8f0;border-radius:10px;">ยังไม่มีรอบตรวจนับ — Admin กด "เปิดรอบตรวจนับ"</div>`; return; }
    const isAdmin = currentUser?.role === 'admin';
    c.innerHTML = rounds.map(r => {
        const isOpen = r.status === 'open';
        const isBT = currentUser?.username?.toUpperCase().startsWith('BT');
        const myZone = (currentUser?.assignedZones||[])[0] || '';
        const canCount = isOpen && (isAdmin || (isBT && (!r.zone || r.zone === myZone || r.zone === 'ทุกสาขา')));
        return `<div style="background:white;border-radius:12px;border:2px solid ${isOpen?'#a7f3d0':'#e2e8f0'};padding:18px;margin-bottom:12px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;">
                <div>
                    <div style="font-size:14px;font-weight:800;color:#0f172a;">${r.name || `รอบที่ ${r._id.slice(-4)}`}</div>
                    <div style="font-size:11px;color:#64748b;margin-top:2px;">Zone: ${r.zone||'ทุกสาขา'} | หมวด: ${r.category||'ทุกหมวด'} | เปิดโดย: ${r.createdBy}</div>
                    <div style="font-size:11px;color:#94a3b8;">วันที่: ${r.dateLabel||''}</div>
                </div>
                <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
                    <span style="background:${isOpen?'#f0fdf4':'#f8fafc'};color:${isOpen?'#059669':'#94a3b8'};border:1px solid ${isOpen?'#a7f3d0':'#e2e8f0'};padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;">${isOpen?'🟢 เปิดอยู่':'⚫ ปิดแล้ว'}</span>
                    ${canCount ? `<button onclick="_openAuditCount('${r._id}')" style="background:#059669;color:white;border:none;padding:7px 14px;border-radius:7px;cursor:pointer;font-size:11px;font-weight:700;">📋 เริ่มตรวจนับ</button>` : ''}
                    <button onclick="_viewAuditResults('${r._id}')" style="background:#f1f5f9;color:#475569;border:none;padding:7px 12px;border-radius:7px;cursor:pointer;font-size:11px;">📊 ดูผล</button>
                    ${isAdmin && isOpen ? `<button onclick="_closeAuditRound('${r._id}')" style="background:#fee2e2;color:#ef4444;border:none;padding:7px 12px;border-radius:7px;cursor:pointer;font-size:11px;">🔒 ปิดรอบ</button>` : ''}
                    ${isAdmin ? `<button onclick="_confirmDeleteAuditRound('${r._id}','${r.name||''}',${isOpen})" style="background:#fef2f2;color:#dc2626;border:1.5px solid #fecaca;padding:7px 12px;border-radius:7px;cursor:pointer;font-size:11px;font-weight:700;">🗑️ ลบ</button>` : ''}
                </div>
            </div>
        </div>`;
    }).join('');
}

window._openCreateAuditRound = function() {
    const area = document.getElementById('auditFormArea'); if (!area) return;
    area.innerHTML = `
    <div style="background:#f0fdf4;border:2px solid #a7f3d0;border-radius:12px;padding:20px;">
        <div style="font-size:14px;font-weight:800;color:#065f46;margin-bottom:14px;">📋 สร้างรอบตรวจนับใหม่</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
            <div><label style="font-size:10px;font-weight:700;color:#065f46;display:block;margin-bottom:4px;">ชื่อรอบตรวจนับ *</label>
                <input type="text" id="ar_name" placeholder="เช่น ตรวจนับประจำปี 2568"
                    style="width:100%;padding:9px 11px;border:1.5px solid #a7f3d0;border-radius:8px;font-size:12px;font-family:inherit;outline:none;box-sizing:border-box;"></div>
            <div><label style="font-size:10px;font-weight:700;color:#065f46;display:block;margin-bottom:4px;">Zone / สาขา (เว้นว่าง = ทุกสาขา)</label>
                <select id="ar_zone" style="width:100%;padding:9px 11px;border:1.5px solid #a7f3d0;border-radius:8px;font-size:12px;outline:none;cursor:pointer;">
                    <option value="">ทุกสาขา</option>
                    ${(warehouseList||[]).map(z=>`<option value="${z}">${z}</option>`).join('')}
                </select></div>
            <div><label style="font-size:10px;font-weight:700;color:#065f46;display:block;margin-bottom:4px;">หมวดหมู่ (เว้นว่าง = ทุกหมวด)</label>
                <select id="ar_cat" style="width:100%;padding:9px 11px;border:1.5px solid #a7f3d0;border-radius:8px;font-size:12px;outline:none;cursor:pointer;">
                    <option value="">ทุกหมวด</option>
                    ${ASSET_CATEGORIES.map(cat=>`<option value="${cat}">${cat}</option>`).join('')}
                </select></div>
            <div><label style="font-size:10px;font-weight:700;color:#065f46;display:block;margin-bottom:4px;">กำหนดเสร็จ</label>
                <input type="date" id="ar_deadline" style="width:100%;padding:9px 11px;border:1.5px solid #a7f3d0;border-radius:8px;font-size:12px;outline:none;box-sizing:border-box;"></div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
            <button onclick="document.getElementById('auditFormArea').innerHTML=''" style="background:#f1f5f9;color:#475569;border:none;padding:9px 18px;border-radius:8px;cursor:pointer;font-weight:600;">ยกเลิก</button>
            <button onclick="_saveAuditRound()" style="background:#059669;color:white;border:none;padding:9px 22px;border-radius:8px;cursor:pointer;font-weight:700;">✅ เปิดรอบ</button>
        </div>
    </div>`;
    area.scrollIntoView({ behavior:'smooth', block:'nearest' });
};

window._saveAuditRound = async function() {
    await _importFS();
    const name = document.getElementById('ar_name')?.value.trim();
    if (!name) { toast('⚠️ กรุณาระบุชื่อรอบ', '#c2410c'); return; }
    const data = {
        name, zone: document.getElementById('ar_zone')?.value || '',
        category: document.getElementById('ar_cat')?.value || '',
        deadline: document.getElementById('ar_deadline')?.value || '',
        status: 'open', createdAt: Date.now(), createdBy: currentUser.name,
        dateLabel: _todayTH(),
    };
    await _addDoc(_collection(db, 'assetAuditRounds'), data);
    toast('✅ เปิดรอบตรวจนับแล้ว', '#059669');
    document.getElementById('auditFormArea').innerHTML = '';
    _loadAuditRounds();
};

window._closeAuditRound = async function(roundId) {
    if (!confirm('ปิดรอบตรวจนับนี้?')) return;
    await _importFS();
    await _updateDoc(_doc(db, 'assetAuditRounds', roundId), { status:'closed', closedAt: Date.now(), closedBy: currentUser.name });
    toast('🔒 ปิดรอบแล้ว', '#64748b');
    _loadAuditRounds();
};

window._confirmDeleteAuditRound = function(roundId, roundName, isOpen) {
    // Step 1: show inline confirm panel
    const existing = document.getElementById('auditDeleteConfirm');
    if (existing) existing.remove();
    const panel = document.createElement('div');
    panel.id = 'auditDeleteConfirm';
    panel.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
    panel.innerHTML = `
        <div style="background:white;border-radius:16px;padding:28px;max-width:420px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.3);">
            <div style="text-align:center;margin-bottom:18px;">
                <div style="font-size:40px;margin-bottom:8px;">🗑️</div>
                <div style="font-size:16px;font-weight:900;color:#0f172a;">ลบรอบตรวจนับ?</div>
                <div style="font-size:12px;color:#64748b;margin-top:6px;">"${roundName || roundId}"</div>
                ${isOpen ? `<div style="margin-top:8px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:8px 12px;font-size:11px;color:#c2410c;font-weight:700;">⚠️ รอบนี้ยังเปิดอยู่ — ลบจะปิดรอบด้วย</div>` : ''}
            </div>
            <div style="background:#fef2f2;border:1.5px solid #fecaca;border-radius:10px;padding:14px;margin-bottom:18px;">
                <div style="font-size:11px;color:#dc2626;font-weight:700;margin-bottom:6px;">⚠️ การลบจะ:</div>
                <div style="font-size:11px;color:#475569;line-height:1.7;">
                    • ลบข้อมูลรอบตรวจนับนี้ถาวร<br>
                    • ลบผลการตรวจนับทั้งหมดในรอบนี้ถาวร<br>
                    • ไม่สามารถกู้คืนได้
                </div>
            </div>
            <div style="margin-bottom:16px;">
                <label style="font-size:11px;font-weight:700;color:#dc2626;display:block;margin-bottom:6px;">พิมพ์ "ลบ" เพื่อยืนยัน</label>
                <input type="text" id="auditDeleteInput" placeholder='พิมพ์ "ลบ" ที่นี่'
                    style="width:100%;padding:10px 12px;border:2px solid #fecaca;border-radius:8px;font-size:13px;font-family:inherit;outline:none;text-align:center;box-sizing:border-box;"
                    onfocus="this.style.borderColor='#ef4444'" onblur="this.style.borderColor='#fecaca'">
            </div>
            <div style="display:flex;gap:10px;">
                <button onclick="document.getElementById('auditDeleteConfirm').remove()"
                    style="flex:1;background:#f1f5f9;color:#475569;border:none;padding:11px;border-radius:9px;cursor:pointer;font-weight:700;font-size:13px;">ยกเลิก</button>
                <button onclick="_executeDeleteAuditRound('${roundId}')"
                    style="flex:1;background:#dc2626;color:white;border:none;padding:11px;border-radius:9px;cursor:pointer;font-weight:700;font-size:13px;">🗑️ ยืนยันลบ</button>
            </div>
        </div>`;
    document.body.appendChild(panel);
    document.getElementById('auditDeleteInput')?.focus();
};

window._executeDeleteAuditRound = async function(roundId) {
    const input = document.getElementById('auditDeleteInput')?.value.trim();
    if (input !== 'ลบ') {
        const inp = document.getElementById('auditDeleteInput');
        if (inp) { inp.style.borderColor='#ef4444'; inp.style.background='#fef2f2'; inp.placeholder='กรุณาพิมพ์ "ลบ" ให้ถูกต้อง'; }
        toast('⚠️ กรุณาพิมพ์ "ลบ" เพื่อยืนยัน', '#c2410c');
        return;
    }
    await _importFS();
    toast('⏳ กำลังลบ...', '#64748b');
    try {
        // ลบผลตรวจนับทั้งหมดในรอบนี้ก่อน
        const resultsSnap = await _getDocs(_query(_collection(db,'assetAuditResults'), _where('roundId','==',roundId)));
        const delPromises = resultsSnap.docs.map(d => _deleteDoc(_doc(db,'assetAuditResults',d.id)));
        await Promise.all(delPromises);
        // ลบ round document
        await _deleteDoc(_doc(db,'assetAuditRounds',roundId));
        document.getElementById('auditDeleteConfirm')?.remove();
        toast(`✅ ลบรอบตรวจนับแล้ว (${resultsSnap.docs.length} ผลลัพธ์ถูกลบด้วย)`, '#059669');
        _loadAuditRounds();
    } catch(e) {
        toast('❌ ลบไม่สำเร็จ: ' + e.message, '#ef4444');
    }
};

window._openAuditCount = async function(roundId) {
    await _importFS();
    const roundSnap = await _getDoc(_doc(db, 'assetAuditRounds', roundId));
    const round = roundSnap.data();
    let assets = [..._assetsCache];
    if (round.zone) assets = assets.filter(a => a.zone === round.zone);
    if (round.category) assets = assets.filter(a => a.category === round.category);
    if (!assets.length) { toast('⚠️ ไม่มีทรัพย์สินที่ตรงกับเงื่อนไขรอบนี้', '#c2410c'); return; }

    // โหลดผลที่นับแล้ว
    const existSnap = await _getDocs(_query(_collection(db,'assetAuditResults'), _where('roundId','==',roundId), _where('countedBy','==',currentUser.name)));
    const doneMap = {};
    existSnap.docs.forEach(d => { const dd = d.data(); doneMap[dd.assetId] = { _docId: d.id, ...dd }; });

    const area = document.getElementById('auditCountArea'); if (!area) return;
    area.innerHTML = `
    <div style="background:white;border-radius:12px;border:2px solid #bae6fd;padding:22px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
            <div><div style="font-size:14px;font-weight:800;color:#0369a1;">📋 ${round.name}</div>
            <div style="font-size:11px;color:#64748b;">ทรัพย์สิน ${assets.length} รายการ | ผู้ตรวจ: ${currentUser.name}</div></div>
            <button onclick="document.getElementById('auditCountArea').innerHTML=''" style="background:#f1f5f9;color:#475569;border:none;padding:6px 12px;border-radius:7px;cursor:pointer;font-size:11px;">✕ ปิด</button>
        </div>
        ${assets.map(a => {
            const done = doneMap[a._id];
            return `<div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:10px;${done?'background:#f0fdf4;border-color:#a7f3d0;':''}" id="auditRow_${a._id}">
                <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                    ${a.imageUrl ? `<img src="${a.imageUrl}" style="width:44px;height:44px;border-radius:7px;object-fit:cover;flex-shrink:0;">` : `<div style="width:44px;height:44px;border-radius:7px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">📦</div>`}
                    <div style="flex:1;min-width:120px;">
                        <div style="font-weight:800;font-size:12px;">${a._id} — ${a.name}</div>
                        <div style="font-size:10px;color:#94a3b8;">${a.category||''} | ${a.zone||''}</div>
                        ${done ? `<div style="font-size:10px;color:#059669;font-weight:700;margin-top:2px;">✅ นับแล้ว: ${done.result} ${done.auditNote?'| '+done.auditNote:''}</div>` : ''}
                    </div>
                    <div style="display:flex;flex-direction:column;gap:5px;min-width:160px;">
                        <select id="auditResult_${a._id}" style="padding:6px 10px;border:1.5px solid #e2e8f0;border-radius:7px;font-size:11px;outline:none;cursor:pointer;font-weight:700;">
                            <option value="พบ" ${done?.result==='พบ'?'selected':''}>✅ พบ / ปกติ</option>
                            <option value="ชำรุด" ${done?.result==='ชำรุด'?'selected':''}>⚠️ พบ แต่ชำรุด</option>
                            <option value="ไม่พบ" ${done?.result==='ไม่พบ'?'selected':''}>❌ ไม่พบ</option>
                        </select>
                        <input type="text" id="auditNote_${a._id}" placeholder="หมายเหตุ..." value="${done?.auditNote||''}"
                            style="padding:6px 10px;border:1.5px solid #e2e8f0;border-radius:7px;font-size:11px;font-family:inherit;outline:none;">
                    </div>
                    <div style="display:flex;flex-direction:column;gap:5px;">
                        <label style="background:#0369a1;color:white;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:10px;font-weight:700;text-align:center;">
                            📸 รูป<input type="file" accept="image/*" id="auditImg_${a._id}" style="display:none">
                        </label>
                        <button onclick="_submitAuditItem('${roundId}','${a._id}')" style="background:#059669;color:white;border:none;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:10px;font-weight:700;">💾 บันทึก</button>
                    </div>
                </div>
            </div>`;
        }).join('')}
        <div style="margin-top:14px;display:flex;justify-content:flex-end;gap:8px;">
            <button onclick="_exportAuditResults('${roundId}')" style="background:#7c3aed;color:white;border:none;padding:9px 18px;border-radius:8px;cursor:pointer;font-weight:700;font-size:12px;">📊 Excel</button>
            <button onclick="_exportAuditPDF('${roundId}')" style="background:#dc2626;color:white;border:none;padding:9px 18px;border-radius:8px;cursor:pointer;font-weight:700;font-size:12px;">📄 PDF + รูป</button>
        </div>
    </div>`;
    area.scrollIntoView({ behavior:'smooth', block:'nearest' });
};

window._submitAuditItem = async function(roundId, assetId) {
    await _importFS();
    const result = document.getElementById(`auditResult_${assetId}`)?.value;
    const note   = document.getElementById(`auditNote_${assetId}`)?.value.trim() || '';
    const imgFile= document.getElementById(`auditImg_${assetId}`)?.files[0];
    let imageUrl = '';
    if (imgFile) {
        try {
            toast('⏳ กำลังอัปโหลดรูป...', '#0891b2');
            imageUrl = await _uploadImage(imgFile, `assets/${assetId}/audit/${Date.now()}_${imgFile.name}`);
        } catch(e) { toast('❌ อัปโหลดรูปไม่สำเร็จ: ' + e.message, '#c2410c'); console.error(e); return; }
    }
    const data = { roundId, assetId, result, auditNote: note, imageUrl, countedBy: currentUser.name, countedAt: Date.now(), dateLabel: _todayTH() };
    // upsert
    const existSnap = await _getDocs(_query(_collection(db,'assetAuditResults'), _where('roundId','==',roundId), _where('assetId','==',assetId), _where('countedBy','==',currentUser.name)));
    if (existSnap.docs.length) { await _updateDoc(_doc(db,'assetAuditResults',existSnap.docs[0].id), data); }
    else { await _addDoc(_collection(db,'assetAuditResults'), data); }
    // ถ้าชำรุด → อัปเดต status สินทรัพย์ด้วย
    if (result === 'ชำรุด') await _updateDoc(_doc(db,'assets',assetId), { status:'ชำรุด', updatedAt: Date.now(), updatedBy: currentUser.name });
    const row = document.getElementById(`auditRow_${assetId}`);
    if (row) { row.style.background='#f0fdf4'; row.style.borderColor='#a7f3d0'; }
    toast(`✅ บันทึก ${assetId}: ${result}`, '#059669');
};

window._viewAuditResults = async function(roundId) {
    await _importFS();
    const snap = await _getDocs(_query(_collection(db,'assetAuditResults'), _where('roundId','==',roundId)));
    const results = snap.docs.map(d => d.data());
    const found = results.filter(r=>r.result==='พบ').length;
    const broken = results.filter(r=>r.result==='ชำรุด').length;
    const missing = results.filter(r=>r.result==='ไม่พบ').length;
    const area = document.getElementById('auditCountArea'); if (!area) return;
    area.innerHTML = `
    <div style="background:white;border-radius:12px;border:2px solid #e2e8f0;padding:22px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
            <div style="font-size:14px;font-weight:800;color:#0f172a;">📊 ผลตรวจนับ</div>
            <button onclick="document.getElementById('auditCountArea').innerHTML=''" style="background:#f1f5f9;color:#475569;border:none;padding:6px 12px;border-radius:7px;cursor:pointer;font-size:11px;">✕</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;">
            <div style="background:#f0fdf4;border-radius:9px;padding:14px;text-align:center;"><div style="font-size:24px;font-weight:900;color:#059669;">${found}</div><div style="font-size:10px;color:#64748b;">✅ พบ</div></div>
            <div style="background:#fff7ed;border-radius:9px;padding:14px;text-align:center;"><div style="font-size:24px;font-weight:900;color:#d97706;">${broken}</div><div style="font-size:10px;color:#64748b;">⚠️ ชำรุด</div></div>
            <div style="background:#fef2f2;border-radius:9px;padding:14px;text-align:center;"><div style="font-size:24px;font-weight:900;color:#dc2626;">${missing}</div><div style="font-size:10px;color:#64748b;">❌ ไม่พบ</div></div>
        </div>
        <div style="max-height:300px;overflow-y:auto;">
        ${results.map(r=>{
            const st = r.result==='พบ'?'✅':r.result==='ชำรุด'?'⚠️':'❌';
            return `<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-bottom:1px solid #f8fafc;">
                <span>${st}</span><span style="font-weight:700;font-size:11px;min-width:90px;">${r.assetId}</span>
                <span style="font-size:11px;color:#475569;">${r.result}</span>
                ${r.auditNote?`<span style="font-size:10px;color:#94a3b8;">— ${r.auditNote}</span>`:''}
                ${r.imageUrl?`<img src="${r.imageUrl}" style="width:28px;height:28px;border-radius:4px;object-fit:cover;margin-left:auto;">` : ''}
                <span style="font-size:10px;color:#94a3b8;margin-left:auto;">${r.countedBy}</span>
            </div>`;
        }).join('')}
        </div>
        <div style="margin-top:12px;display:flex;justify-content:flex-end;gap:8px;">
            <button onclick="_exportAuditResults('${roundId}')" style="background:#7c3aed;color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:700;font-size:12px;">📊 Excel</button>
            <button onclick="_exportAuditPDF('${roundId}')" style="background:#dc2626;color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:700;font-size:12px;">📄 PDF + รูป</button>
        </div>
    </div>`;
    area.scrollIntoView({ behavior:'smooth', block:'nearest' });
};

window._exportAuditResults = async function(roundId) {
    await _importFS();
    const snap = await _getDocs(_query(_collection(db,'assetAuditResults'), _where('roundId','==',roundId)));
    const results = snap.docs.map(d => d.data());
    const rows = [['รหัสทรัพย์สิน','ผล','หมายเหตุ','ผู้ตรวจ','วันที่','มีรูปภาพ']];
    results.forEach(r => rows.push([r.assetId, r.result, r.auditNote||'', r.countedBy, r.dateLabel||'', r.imageUrl ? '✅ มีรูป' : '—']));
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{wch:14},{wch:10},{wch:24},{wch:16},{wch:12},{wch:10}];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'AuditResults');
    XLSX.writeFile(wb, `TingTing_Audit_${roundId.slice(-6)}.xlsx`);
    toast('✅ Export Excel เรียบร้อย', '#059669');
};

window._exportAuditPDF = async function(roundId) {
    await _importFS();
    toast('⏳ กำลังสร้าง PDF...', '#0891b2');
    // โหลดข้อมูลรอบ
    const roundSnap = await _getDoc(_doc(db,'assetAuditRounds',roundId));
    const round = roundSnap.exists() ? roundSnap.data() : {};
    // โหลดผลตรวจนับ
    const snap = await _getDocs(_query(_collection(db,'assetAuditResults'), _where('roundId','==',roundId)));
    const results = snap.docs.map(d => d.data());
    if (!results.length) { toast('⚠️ ไม่มีผลตรวจนับ', '#c2410c'); return; }

    const found   = results.filter(r=>r.result==='พบ').length;
    const broken  = results.filter(r=>r.result==='ชำรุด').length;
    const missing = results.filter(r=>r.result==='ไม่พบ').length;
    const now = _todayTH();

    const resultColors = {
        'พบ':    { bg:'#f0fdf4', border:'#a7f3d0', color:'#065f46', icon:'✅' },
        'ชำรุด': { bg:'#fff7ed', border:'#fed7aa', color:'#92400e', icon:'⚠️' },
        'ไม่พบ': { bg:'#fef2f2', border:'#fecaca', color:'#991b1b', icon:'❌' },
    };

    const rows = results.map(r => {
        const asset = _assetsCache.find(a => a._id === r.assetId) || {};
        const rc = resultColors[r.result] || resultColors['พบ'];
        // รูปทรัพย์สิน (จาก registry)
        const assetImg = asset.imageUrl
            ? `<img src="${asset.imageUrl}" style="width:48px;height:48px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0;">`
            : `<div style="width:48px;height:48px;border-radius:6px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:22px;">📦</div>`;
        // รูปที่ถ่ายตอนตรวจนับ
        const auditImg = r.imageUrl
            ? `<img src="${r.imageUrl}" style="width:48px;height:48px;object-fit:cover;border-radius:6px;border:2px solid ${rc.border};">`
            : `<div style="width:48px;height:48px;border-radius:6px;background:#f8fafc;border:1.5px dashed #e2e8f0;display:flex;align-items:center;justify-content:center;font-size:10px;color:#94a3b8;text-align:center;line-height:1.3;">ไม่มี<br>รูป</div>`;

        return `<tr style="page-break-inside:avoid;">
            <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;vertical-align:middle;">${assetImg}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;vertical-align:middle;">
                <div style="font-weight:800;font-size:11px;color:#0f172a;">${r.assetId}</div>
                <div style="font-size:10px;color:#475569;">${asset.name||'—'}</div>
                <div style="font-size:9px;color:#94a3b8;">${asset.category||''} ${asset.zone?'| '+asset.zone:''}</div>
            </td>
            <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;vertical-align:middle;text-align:center;">
                <span style="background:${rc.bg};color:${rc.color};border:1.5px solid ${rc.border};padding:4px 10px;border-radius:14px;font-size:10px;font-weight:800;white-space:nowrap;">${rc.icon} ${r.result}</span>
            </td>
            <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;vertical-align:middle;font-size:10px;color:#475569;max-width:120px;">${r.auditNote||'—'}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;vertical-align:middle;text-align:center;">${auditImg}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;vertical-align:middle;font-size:10px;color:#64748b;text-align:center;">${r.countedBy}<br><span style="font-size:9px;color:#94a3b8;">${r.dateLabel||''}</span></td>
        </tr>`;
    }).join('');

    const win = window.open('','_blank');
    win.document.write(`<!DOCTYPE html><html><head>
    <meta charset="utf-8">
    <title>ผลตรวจนับ — ${round.name||roundId}</title>
    <link href="https://fonts.googleapis.com/css2?family=Prompt:wght@400;600;700;800&display=swap" rel="stylesheet">
    <style>
        *{box-sizing:border-box;margin:0;padding:0;}
        body{font-family:'Prompt',sans-serif;background:white;color:#0f172a;padding:24px;font-size:11px;}
        .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;padding-bottom:14px;border-bottom:2px solid #0f172a;}
        .logo{font-size:20px;font-weight:900;}.logo span{color:#f59e0b;}
        .title{font-size:14px;font-weight:800;margin-top:3px;}
        .subtitle{font-size:10px;color:#64748b;margin-top:3px;}
        .meta{text-align:right;font-size:10px;color:#64748b;line-height:1.7;}
        .kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px;}
        .kpi-box{border-radius:9px;padding:12px 14px;border:1px solid #e2e8f0;}
        .kpi-val{font-size:22px;font-weight:900;}
        .kpi-lbl{font-size:9px;color:#94a3b8;text-transform:uppercase;margin-top:1px;}
        .round-info{background:#f8fafc;border-radius:8px;padding:10px 14px;margin-bottom:16px;border:1px solid #e2e8f0;font-size:11px;color:#475569;line-height:1.8;}
        table{width:100%;border-collapse:collapse;}
        thead{background:#0f172a;color:white;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
        th{padding:9px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;}
        th:nth-child(3),th:nth-child(5),th:nth-child(6){text-align:center;}
        tbody tr:nth-child(even){background:#f8fafc;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
        .footer{margin-top:16px;padding-top:10px;border-top:1px solid #e2e8f0;text-align:center;font-size:9px;color:#94a3b8;}
        @media print{
            body{padding:10px;}
            @page{margin:10mm;size:A4 portrait;}
            tr{page-break-inside:avoid;}
        }
    </style></head><body>
    <div class="header">
        <div>
            <div class="logo">Ting<span>Ting</span></div>
            <div class="title">รายงานผลการตรวจนับทรัพย์สิน</div>
            <div class="subtitle">${round.name||roundId}</div>
        </div>
        <div class="meta">
            <div>พิมพ์โดย: ${currentUser?.name||''}</div>
            <div>วันที่พิมพ์: ${now}</div>
            <div>รวม ${results.length} รายการ</div>
        </div>
    </div>
    <div class="round-info">
        📍 Zone: <b>${round.zone||'ทุกสาขา'}</b> &nbsp;|&nbsp;
        📦 หมวด: <b>${round.category||'ทุกหมวด'}</b> &nbsp;|&nbsp;
        👤 เปิดโดย: <b>${round.createdBy||'—'}</b> &nbsp;|&nbsp;
        📅 วันที่: <b>${round.dateLabel||'—'}</b>
        ${round.deadline ? `&nbsp;|&nbsp; ⏰ กำหนดเสร็จ: <b>${_isoToTH(round.deadline)}</b>` : ''}
    </div>
    <div class="kpi">
        <div class="kpi-box"><div class="kpi-val">${results.length}</div><div class="kpi-lbl">รายการทั้งหมด</div></div>
        <div class="kpi-box" style="background:#f0fdf4;border-color:#a7f3d0;"><div class="kpi-val" style="color:#059669;">${found}</div><div class="kpi-lbl">✅ พบ</div></div>
        <div class="kpi-box" style="background:#fff7ed;border-color:#fed7aa;"><div class="kpi-val" style="color:#d97706;">${broken}</div><div class="kpi-lbl">⚠️ ชำรุด</div></div>
        <div class="kpi-box" style="background:#fef2f2;border-color:#fecaca;"><div class="kpi-val" style="color:#dc2626;">${missing}</div><div class="kpi-lbl">❌ ไม่พบ</div></div>
    </div>
    <table>
        <thead><tr>
            <th style="width:56px;">รูปสินทรัพย์</th>
            <th>รหัส / ชื่อ</th>
            <th style="width:90px;text-align:center;">ผล</th>
            <th style="width:110px;">หมายเหตุ</th>
            <th style="width:60px;text-align:center;">รูปตรวจนับ</th>
            <th style="width:80px;text-align:center;">ผู้ตรวจ</th>
        </tr></thead>
        <tbody>${rows}</tbody>
    </table>
    <div class="footer">TingTing Asset Management — รายงานผลตรวจนับ | สร้างเมื่อ ${now}</div>
    <script>window.onload=()=>setTimeout(()=>window.print(),800);<\/script>
    </body></html>`);
    win.document.close();
};

// ═════════════════════════════════════════════════════════════════════
// ═════════════════════════════════════════════════════════════════════
//  TAB 3: REPAIR — ใบแจ้งซ่อม v2 (Approval Workflow)
//
//  Flow: คนแจ้ง (any) → หัวหน้าฝ่าย (warehouse/manager/hr)
//                      → ผู้อนุมัติสุดท้าย (admin)
//
//  approval.steps = [
//    { role:'warehouse', label:'หัวหน้าฝ่าย', approvedBy:null, approvedAt:null, note:'' },
//    { role:'admin',     label:'ผู้อนุมัติ',   approvedBy:null, approvedAt:null, note:'' },
//  ]
//  สถานะ: draft → pending_l1 → pending_l2 → approved → in_progress → done → rejected
//
//  รองรับ role เพิ่มได้: แค่ push เข้า REPAIR_APPROVAL_FLOW
// ═════════════════════════════════════════════════════════════════════

const REPAIR_APPROVAL_FLOW = [
    { role: 'warehouse', label: 'หัวหน้าฝ่าย' },
    { role: 'admin',     label: 'ผู้อนุมัติ / ฝ่ายบุคคล' },
];

const REPAIR_STATUS_CFG = {
    draft:        { label:'แบบร่าง',         icon:'📝', bg:'#f8fafc', border:'#e2e8f0', color:'#475569' },
    pending_l1:   { label:'รอหัวหน้าฝ่าย',   icon:'🟡', bg:'#fffbeb', border:'#fde68a', color:'#a16207' },
    pending_l2:   { label:'รออนุมัติ',        icon:'🟠', bg:'#fff7ed', border:'#fed7aa', color:'#c2410c' },
    approved:     { label:'อนุมัติแล้ว',      icon:'✅', bg:'#f0fdf4', border:'#a7f3d0', color:'#065f46' },
    in_progress:  { label:'กำลังซ่อม',        icon:'🔵', bg:'#eff6ff', border:'#bfdbfe', color:'#1d4ed8' },
    done:         { label:'ซ่อมเสร็จ',        icon:'🟢', bg:'#f0fdf4', border:'#86efac', color:'#15803d' },
    rejected:     { label:'ไม่อนุมัติ',       icon:'🔴', bg:'#fef2f2', border:'#fecaca', color:'#dc2626' },
};

// ── LIGHTBOX ──
window._repairLightbox = function(src, caption) {
    const ov = document.createElement('div');
    ov.id = 'repairLightboxOv';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:zoom-out;animation:fadeInLB .18s ease;';
    ov.innerHTML = `
        <style>@keyframes fadeInLB{from{opacity:0}to{opacity:1}} @keyframes scaleInLB{from{transform:scale(.88)}to{transform:scale(1)}}</style>
        <img src="${src}" style="max-width:92vw;max-height:82vh;border-radius:12px;box-shadow:0 24px 64px rgba(0,0,0,.6);animation:scaleInLB .2s ease;object-fit:contain;">
        ${caption ? `<div style="margin-top:14px;color:rgba(255,255,255,.7);font-size:12px;font-weight:600;">${caption}</div>` : ''}
        <button style="position:absolute;top:18px;right:22px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);color:white;width:36px;height:36px;border-radius:50%;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;">✕</button>
    `;
    ov.onclick = () => ov.remove();
    document.body.appendChild(ov);
};


// urgency config
const REPAIR_URGENCY = {
    urgent_high: { label:'ด่วนมาก', sub:'ภายใน 24 ชม.', icon:'🔴', color:'#dc2626', bg:'#fef2f2', border:'#fca5a5' },
    urgent:      { label:'ด่วน',    sub:'ภายใน 3 วัน',  icon:'🟡', color:'#d97706', bg:'#fffbeb', border:'#fde68a' },
    normal:      { label:'ปกติ',    sub:'ภายใน 7 วัน',  icon:'🟢', color:'#059669', bg:'#f0fdf4', border:'#a7f3d0' },
    scheduled:   { label:'ตามนัด',  sub:'กำหนดวันเอง',  icon:'📅', color:'#6366f1', bg:'#eef2ff', border:'#c7d2fe' },
};

// helper: role can approve step index
function _repairCanApprove(stepIndex) {
    const step = REPAIR_APPROVAL_FLOW[stepIndex];
    if (!step) return false;
    const role = currentUser?.role || '';
    // admin can approve any step; each step also mapped to specific roles
    if (role === 'admin') return true;
    return role === step.role;
}

// helper: which step index is next pending
function _repairNextStep(r) {
    const steps = r.approvalSteps || [];
    for (let i = 0; i < REPAIR_APPROVAL_FLOW.length; i++) {
        if (!steps[i]?.approvedBy) return i;
    }
    return -1; // all approved
}

// helper: is repair fully approved
function _repairFullyApproved(r) {
    return _repairNextStep(r) === -1;
}

// ── _repairFmtDate ──
function _repairFmtDate(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    const thYear = d.getFullYear() + 543;
    return `${d.getDate()} ${['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'][d.getMonth()]} ${thYear} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

// ── RENDER TAB ──
function _renderRepair(c) {
    const role = currentUser?.role || '';
    const canCreate = true; // everyone can create
    c.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
        <div>
            <div style="font-size:15px;font-weight:800;color:#0f172a;">🔧 ใบแจ้งซ่อมทรัพย์สิน</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:2px;">คนแจ้ง → หัวหน้าฝ่าย → ผู้อนุมัติ → ซ่อม → เสร็จสิ้น</div>
        </div>
        <button onclick="_openNewRepairForm()" style="background:linear-gradient(135deg,#92400e,#d97706);color:white;border:none;padding:9px 18px;border-radius:10px;cursor:pointer;font-size:12px;font-weight:700;box-shadow:0 2px 8px rgba(217,119,6,0.3);">+ แจ้งซ่อมใหม่</button>
    </div>

    <!-- Filter tabs -->
    <div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap;">
        <button onclick="_repairFilterSet(this,'')"          class="rpf-btn rpf-active" data-v="" style="${_rpfBtnStyle(true)}">ทั้งหมด</button>
        <button onclick="_repairFilterSet(this,'pending_l1')"class="rpf-btn" data-v="pending_l1" style="${_rpfBtnStyle(false)}">🟡 รอหัวหน้า</button>
        <button onclick="_repairFilterSet(this,'pending_l2')"class="rpf-btn" data-v="pending_l2" style="${_rpfBtnStyle(false)}">🟠 รออนุมัติ</button>
        <button onclick="_repairFilterSet(this,'approved')"  class="rpf-btn" data-v="approved"   style="${_rpfBtnStyle(false)}">✅ อนุมัติแล้ว</button>
        <button onclick="_repairFilterSet(this,'in_progress')"class="rpf-btn" data-v="in_progress"style="${_rpfBtnStyle(false)}">🔵 กำลังซ่อม</button>
        <button onclick="_repairFilterSet(this,'done')"      class="rpf-btn" data-v="done"       style="${_rpfBtnStyle(false)}">🟢 เสร็จแล้ว</button>
        <button onclick="_repairFilterSet(this,'rejected')"  class="rpf-btn" data-v="rejected"   style="${_rpfBtnStyle(false)}">🔴 ไม่อนุมัติ</button>
    </div>

    <div id="repairList" style="min-height:150px;"><div style="text-align:center;padding:40px;color:#94a3b8;">⏳ กำลังโหลด...</div></div>
    <div id="repairFormArea" style="margin-top:16px;"></div>
    <div id="repairDetailArea" style="margin-top:16px;"></div>`;
    _loadRepairs();
}

function _rpfBtnStyle(active) {
    return active
        ? 'background:#0f172a;color:white;border:none;padding:7px 14px;border-radius:8px;cursor:pointer;font-size:11px;font-weight:700;'
        : 'background:white;color:#475569;border:1.5px solid #e2e8f0;padding:7px 14px;border-radius:8px;cursor:pointer;font-size:11px;font-weight:600;';
}

window._repairFilterSet = function(btn, val) {
    document.querySelectorAll('.rpf-btn').forEach(b => b.style.cssText = _rpfBtnStyle(false));
    btn.style.cssText = _rpfBtnStyle(true);
    _loadRepairs(val);
};

// ── LOAD LIST ──
async function _loadRepairs(statusFilter) {
    await _importFS();
    if (statusFilter === undefined) {
        const active = document.querySelector('.rpf-btn.rpf-active');
        statusFilter = active?.dataset?.v || '';
    }
    let q = _query(_collection(db,'assetRepairs'), _orderBy('createdAt','desc'));
    const snap = await _getDocs(q);
    let repairs = snap.docs.map(d => ({ _id: d.id, ...d.data() }));

    // BT users see only own zone or own reports
    const isBT = currentUser?.username?.toUpperCase().startsWith('BT') && currentUser?.role !== 'admin';
    const myZone = (currentUser?.assignedZones||[])[0] || '';
    if (isBT) repairs = repairs.filter(r => r.zone === myZone || r.reportedBy === currentUser.name);

    if (statusFilter) repairs = repairs.filter(r => r.status === statusFilter);

    const c = document.getElementById('repairList'); if (!c) return;
    if (!repairs.length) {
        c.innerHTML = `<div style="text-align:center;padding:30px;color:#94a3b8;border:2px dashed #e2e8f0;border-radius:12px;">ไม่มีใบแจ้งซ่อม</div>`;
        return;
    }

    const role = currentUser?.role || '';
    c.innerHTML = repairs.map(r => {
        const st = REPAIR_STATUS_CFG[r.status] || REPAIR_STATUS_CFG.pending_l1;
        const urg = REPAIR_URGENCY[r.urgency] || REPAIR_URGENCY.normal;
        const nextStep = _repairNextStep(r);
        const canApproveNow = nextStep >= 0 && _repairCanApprove(nextStep) && ['pending_l1','pending_l2'].includes(r.status);
        const canUpdate = ['admin','warehouse'].includes(role) && ['approved','in_progress'].includes(r.status);
        const canReject = ['admin','warehouse'].includes(role) && ['pending_l1','pending_l2'].includes(r.status);

        // approval steps mini-bar
        const stepsHtml = (REPAIR_APPROVAL_FLOW).map((step, i) => {
            const done = r.approvalSteps?.[i]?.approvedBy;
            const isNext = i === nextStep && ['pending_l1','pending_l2'].includes(r.status);
            const dotColor = done ? '#10b981' : isNext ? '#f59e0b' : '#e2e8f0';
            const textColor = done ? '#059669' : isNext ? '#d97706' : '#94a3b8';
            return `<div style="display:flex;align-items:center;gap:4px;">
                <div style="width:18px;height:18px;border-radius:50%;background:${dotColor};display:flex;align-items:center;justify-content:center;font-size:9px;color:white;font-weight:700;flex-shrink:0;">${done?'✓':(i+1)}</div>
                <div style="font-size:9px;color:${textColor};font-weight:${done||isNext?'700':'400'};white-space:nowrap;">${step.label}</div>
                ${i < REPAIR_APPROVAL_FLOW.length-1 ? `<div style="width:16px;height:1px;background:${done?'#10b981':'#e2e8f0'};margin:0 2px;"></div>` : ''}
            </div>`;
        }).join('');

        return `
        <div style="background:white;border-radius:14px;border:1.5px solid ${st.border};padding:0;margin-bottom:10px;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,0.04);">
            <!-- header strip -->
            <div style="background:${st.bg};padding:10px 16px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;border-bottom:1px solid ${st.border};">
                <div style="display:flex;align-items:center;gap:8px;">
                    <span style="font-size:10px;font-weight:800;color:#0f172a;font-family:monospace;">${r.repairNo||r._id.slice(-6).toUpperCase()}</span>
                    <span style="background:white;color:${st.color};border:1px solid ${st.border};padding:2px 9px;border-radius:12px;font-size:10px;font-weight:700;">${st.icon} ${st.label}</span>
                    <span style="background:${urg.bg};color:${urg.color};border:1px solid ${urg.border};padding:2px 8px;border-radius:12px;font-size:10px;font-weight:700;">${urg.icon} ${urg.label}</span>
                </div>
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                    ${stepsHtml}
                </div>
            </div>
            <!-- body -->
            <div style="padding:14px 16px;">
                <div style="display:flex;gap:12px;align-items:flex-start;">
                    ${r.imageUrl ? `<img src="${r.imageUrl}" style="width:56px;height:56px;border-radius:9px;object-fit:cover;flex-shrink:0;border:1.5px solid #e2e8f0;">` :
                        `<div style="width:56px;height:56px;border-radius:9px;background:#f8fafc;border:1.5px solid #e2e8f0;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;">🔧</div>`}
                    <div style="flex:1;min-width:0;">
                        <div style="font-weight:800;font-size:13px;color:#0f172a;margin-bottom:2px;">${r.assetId||'—'} — ${r.assetName||''}</div>
                        <div style="font-size:11px;color:#475569;margin-bottom:4px;line-height:1.4;">${r.description||''}</div>
                        <div style="font-size:10px;color:#94a3b8;">แจ้งโดย: <b style="color:#475569;">${r.reportedBy}</b> · ${_repairFmtDate(r.createdAt)} · Zone: ${r.zone||'—'}</div>
                        ${r.repairCost ? `<div style="font-size:11px;color:#7c3aed;font-weight:700;margin-top:3px;">ค่าซ่อม: ฿${_fmt(r.repairCost)}</div>` : ''}
                    </div>
                    <!-- action buttons -->
                    <div style="display:flex;flex-direction:column;gap:5px;flex-shrink:0;">
                        <button onclick="_repairOpenDetail('${r._id}')" style="background:#f1f5f9;color:#475569;border:none;padding:6px 12px;border-radius:7px;cursor:pointer;font-size:10px;font-weight:700;">📄 ดูรายละเอียด</button>
                        ${canApproveNow ? `<button onclick="_repairApprove('${r._id}',${nextStep})" style="background:linear-gradient(135deg,#059669,#10b981);color:white;border:none;padding:6px 12px;border-radius:7px;cursor:pointer;font-size:10px;font-weight:700;">✅ อนุมัติ</button>` : ''}
                        ${canReject ? `<button onclick="_repairReject('${r._id}')" style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;padding:6px 12px;border-radius:7px;cursor:pointer;font-size:10px;font-weight:700;">✕ ไม่อนุมัติ</button>` : ''}
                        ${canUpdate ? `<button onclick="_repairOpenUpdate('${r._id}')" style="background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;padding:6px 12px;border-radius:7px;cursor:pointer;font-size:10px;font-weight:700;">✏️ อัปเดต</button>` : ''}
                        ${role==='admin' ? `<button onclick="_repairDelete('${r._id}','${r.repairNo||r._id.slice(-6).toUpperCase()}')" style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;padding:6px 12px;border-radius:7px;cursor:pointer;font-size:10px;font-weight:700;">🗑️ ลบ</button>` : ''}
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');
}

// ── NEW REPAIR FORM ──
window._openNewRepairForm = async function(prefillAssetId) {
    const area = document.getElementById('repairFormArea'); if (!area) return;
    document.getElementById('repairDetailArea').innerHTML = '';
    // โหลด assets ถ้า cache ยังว่าง (เช่น เปิด repair tab โดยตรง)
    if (!_assetsCache.length) {
        await _importFS();
        const snap = await _getDocs(_query(_collection(db,'assets'), _orderBy('createdAt','desc')));
        _assetsCache = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
    }
    const assetOptions = _assetsCache.filter(a => a.status !== 'จำหน่ายแล้ว');

    area.innerHTML = `
    <div style="background:white;border-radius:14px;border:2px solid #fde68a;padding:22px;box-shadow:0 4px 16px rgba(0,0,0,0.06);">
        <!-- header -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
            <div>
                <div style="font-size:14px;font-weight:800;color:#a16207;">🔧 สร้างใบแจ้งซ่อมใหม่</div>
                <div style="font-size:10px;color:#94a3b8;margin-top:2px;">กรอกข้อมูลแล้วกด "ส่งเรื่อง" ระบบจะแจ้งหัวหน้าฝ่ายอัตโนมัติ</div>
            </div>
            <button onclick="document.getElementById('repairFormArea').innerHTML=''" style="background:#f1f5f9;color:#475569;border:none;padding:6px 12px;border-radius:7px;cursor:pointer;font-size:11px;">✕ ปิด</button>
        </div>

        <!-- รูปภาพ -->
        <div style="margin-bottom:16px;">
            <label style="font-size:10px;font-weight:700;color:#a16207;display:block;margin-bottom:8px;">📸 รูปความเสียหาย (ไม่บังคับ)</label>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
                <div id="repairImgPreview" style="width:80px;height:80px;border-radius:10px;background:#fffbeb;border:2px dashed #fde68a;display:flex;align-items:center;justify-content:center;font-size:28px;overflow:hidden;flex-shrink:0;cursor:pointer;" onclick="document.getElementById('repairImgInput').click()">📷</div>
                <div style="display:flex;flex-direction:column;gap:6px;justify-content:center;">
                    <label style="background:#d97706;color:white;padding:7px 14px;border-radius:8px;cursor:pointer;font-size:11px;font-weight:700;display:inline-block;">
                        📂 เลือกรูป<input type="file" id="repairImgInput" accept="image/*" style="display:none"
                            onchange="(() => { const f=this.files[0]; if(!f) return; const rd=new FileReader(); rd.onload=e=>{ document.getElementById('repairImgPreview').innerHTML=\`<img src='\${e.target.result}' style='width:100%;height:100%;object-fit:cover;border-radius:8px;'>\`; }; rd.readAsDataURL(f); })()">
                    </label>
                    <div style="font-size:9px;color:#94a3b8;">รองรับ JPG, PNG, HEIC ไม่เกิน 10MB</div>
                </div>
            </div>
        </div>

        <!-- ข้อมูลทรัพย์สิน -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
            <div>
                <label style="font-size:10px;font-weight:700;color:#a16207;display:block;margin-bottom:4px;">ทรัพย์สิน *</label>
                <select id="rep_assetId" style="width:100%;padding:9px 11px;border:1.5px solid #fde68a;border-radius:8px;font-size:12px;outline:none;cursor:pointer;background:white;">
                    <option value="">— เลือกทรัพย์สิน —</option>
                    ${assetOptions.map(a=>`<option value="${a._id}" ${prefillAssetId===a._id?'selected':''}>${a._id} — ${a.name}</option>`).join('')}
                </select>
            </div>
            <div>
                <label style="font-size:10px;font-weight:700;color:#a16207;display:block;margin-bottom:4px;">Zone / สาขา</label>
                <select id="rep_zone" style="width:100%;padding:9px 11px;border:1.5px solid #fde68a;border-radius:8px;font-size:12px;outline:none;cursor:pointer;background:white;">
                    <option value="">— ระบุ Zone —</option>
                    ${(warehouseList||[]).map(z=>`<option value="${z}" ${(currentUser?.assignedZones||[])[0]===z?'selected':''}>${z}</option>`).join('')}
                </select>
            </div>
        </div>

        <!-- ระดับความเร่งด่วน -->
        <div style="margin-bottom:14px;">
            <label style="font-size:10px;font-weight:700;color:#a16207;display:block;margin-bottom:8px;">⚡ ระดับความเร่งด่วน</label>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">
                ${Object.entries(REPAIR_URGENCY).map(([k,v])=>`
                <label style="cursor:pointer;">
                    <input type="radio" name="rep_urgency" value="${k}" ${k==='normal'?'checked':''} style="display:none;"
                        onchange="document.querySelectorAll('.urgency-opt').forEach(el=>el.style.borderColor='#e2e8f0');this.closest('label').querySelector('.urgency-opt').style.borderColor='${v.color}'">
                    <div class="urgency-opt" style="border:2px solid ${k==='normal'?v.color:'#e2e8f0'};border-radius:10px;padding:10px 6px;text-align:center;background:${k==='normal'?v.bg:'white'};transition:all .15s;">
                        <div style="font-size:18px;">${v.icon}</div>
                        <div style="font-size:11px;font-weight:700;color:${v.color};margin-top:3px;">${v.label}</div>
                        <div style="font-size:9px;color:#94a3b8;margin-top:1px;">${v.sub}</div>
                    </div>
                </label>`).join('')}
            </div>
        </div>

        <!-- รายละเอียด -->
        <div style="margin-bottom:14px;">
            <label style="font-size:10px;font-weight:700;color:#a16207;display:block;margin-bottom:4px;">รายละเอียดความเสียหาย / อาการ *</label>
            <textarea id="rep_desc" rows="3" placeholder="อธิบายอาการผิดปกติ วิธีที่สังเกตได้ หรือเหตุการณ์ที่เกี่ยวข้อง..."
                style="width:100%;padding:9px 11px;border:1.5px solid #fde68a;border-radius:8px;font-size:12px;font-family:inherit;outline:none;resize:vertical;box-sizing:border-box;"></textarea>
        </div>

        <!-- ค่าซ่อมโดยประมาณ (optional) -->
        <div style="margin-bottom:18px;">
            <label style="font-size:10px;font-weight:700;color:#a16207;display:block;margin-bottom:4px;">ค่าซ่อมโดยประมาณ (ถ้าทราบ)</label>
            <input type="number" id="rep_estCost" placeholder="0 บาท" min="0"
                style="width:200px;padding:9px 11px;border:1.5px solid #fde68a;border-radius:8px;font-size:12px;outline:none;box-sizing:border-box;">
        </div>

        <!-- buttons -->
        <div style="display:flex;gap:8px;justify-content:flex-end;border-top:1px solid #fef9c3;padding-top:16px;">
            <button onclick="document.getElementById('repairFormArea').innerHTML=''" style="background:#f1f5f9;color:#475569;border:none;padding:10px 20px;border-radius:9px;cursor:pointer;font-weight:600;font-size:12px;">ยกเลิก</button>
            <button onclick="_repairSubmit()" style="background:linear-gradient(135deg,#92400e,#d97706);color:white;border:none;padding:10px 24px;border-radius:9px;cursor:pointer;font-weight:700;font-size:12px;box-shadow:0 2px 8px rgba(217,119,6,0.3);">📤 ส่งเรื่องแจ้งซ่อม</button>
        </div>
    </div>`;
    area.scrollIntoView({ behavior:'smooth', block:'nearest' });
};

// ── SUBMIT NEW REPAIR ──
window._repairSubmit = async function() {
    await _importFS();
    const assetId = document.getElementById('rep_assetId')?.value;
    const desc    = document.getElementById('rep_desc')?.value.trim();
    const zone    = document.getElementById('rep_zone')?.value;
    const urgency = document.querySelector('input[name="rep_urgency"]:checked')?.value || 'normal';
    const estCost = parseFloat(document.getElementById('rep_estCost')?.value) || 0;

    if (!assetId) { toast('⚠️ กรุณาเลือกทรัพย์สิน', '#c2410c'); return; }
    if (!desc)    { toast('⚠️ กรุณาอธิบายความเสียหาย', '#c2410c'); return; }

    const asset = _assetsCache.find(a => a._id === assetId);

    // upload image if any
    let imageUrl = '';
    const imgFile = document.getElementById('repairImgInput')?.files[0];
    if (imgFile) {
        try {
            toast('⏳ กำลังอัปโหลดรูป...', '#0891b2');
            imageUrl = await _uploadImage(imgFile, `assets/${assetId}/repair/${Date.now()}_${imgFile.name}`);
        } catch(e) { toast('❌ อัปโหลดรูปไม่สำเร็จ: ' + e.message, '#c2410c'); return; }
    }

    // generate repair number
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
    const countSnap = await _getDocs(_query(_collection(db,'assetRepairs')));
    const seq = String(countSnap.size + 1).padStart(3,'0');
    const repairNo = `RPR-${dateStr}-${seq}`;

    // build approval steps from flow
    const approvalSteps = REPAIR_APPROVAL_FLOW.map(step => ({
        role: step.role, label: step.label,
        approvedBy: null, approvedAt: null, note: ''
    }));

    const data = {
        repairNo,
        assetId, assetName: asset?.name || '',
        zone: zone || asset?.zone || '',
        description: desc,
        urgency,
        estimatedCost: estCost,
        imageUrl,
        status: 'pending_l1',
        approvalSteps,
        reportedBy: currentUser.name,
        reportedByRole: currentUser.role,
        createdAt: Date.now(),
        dateLabel: _todayTH(),
        timeline: [{
            action: 'สร้างใบแจ้งซ่อม',
            by: currentUser.name,
            role: currentUser.role,
            at: Date.now(),
            note: `ส่งเรื่องไปยัง${REPAIR_APPROVAL_FLOW[0].label}`
        }]
    };

    await _addDoc(_collection(db,'assetRepairs'), data);
    await _updateDoc(_doc(db,'assets',assetId), { status:'ชำรุด', updatedAt: Date.now(), updatedBy: currentUser.name });

    toast(`✅ ส่งใบแจ้งซ่อม ${repairNo} เรียบร้อย`, '#059669');
    document.getElementById('repairFormArea').innerHTML = '';
    _loadRepairs(); _loadAssets();
};

// ── APPROVE ──
window._repairApprove = async function(repairId, stepIndex) {
    await _importFS();
    const snap = await _getDoc(_doc(db,'assetRepairs',repairId));
    if (!snap.exists()) return;
    const r = snap.data();

    // confirm
    const stepLabel = REPAIR_APPROVAL_FLOW[stepIndex]?.label || '';
    if (!confirm(`ยืนยันอนุมัติในฐานะ "${stepLabel}"?\n\nชื่อ: ${currentUser.name}\nเวลา: ${_repairFmtDate(Date.now())}`)) return;

    const steps = r.approvalSteps ? [...r.approvalSteps] : REPAIR_APPROVAL_FLOW.map(s=>({...s}));
    steps[stepIndex] = { ...steps[stepIndex], approvedBy: currentUser.name, approvedAt: Date.now(), note: '' };

    // determine next status
    const allApproved = steps.every(s => s.approvedBy);
    const nextStatus = allApproved ? 'approved' : `pending_l${stepIndex + 2}`;

    const timeline = [...(r.timeline||[]), {
        action: `อนุมัติขั้น ${stepIndex+1}: ${stepLabel}`,
        by: currentUser.name, role: currentUser.role,
        at: Date.now(),
        note: allApproved ? 'อนุมัติครบทุกขั้นแล้ว รอดำเนินการซ่อม' : `ส่งต่อ${REPAIR_APPROVAL_FLOW[stepIndex+1]?.label||''}`
    }];

    await _updateDoc(_doc(db,'assetRepairs',repairId), { approvalSteps: steps, status: nextStatus, timeline });
    toast(`✅ อนุมัติเรียบร้อย${allApproved?' — ใบแจ้งซ่อมผ่านการอนุมัติแล้ว':''}`, '#059669');
    _loadRepairs();
    document.getElementById('repairDetailArea').innerHTML = '';
};

// ── REJECT ──
window._repairReject = async function(repairId) {
    const note = prompt('ระบุเหตุผลที่ไม่อนุมัติ:');
    if (note === null) return; // cancelled
    await _importFS();
    const snap = await _getDoc(_doc(db,'assetRepairs',repairId));
    const r = snap.data();
    const timeline = [...(r.timeline||[]), {
        action: 'ไม่อนุมัติ',
        by: currentUser.name, role: currentUser.role,
        at: Date.now(), note: note || '—'
    }];
    await _updateDoc(_doc(db,'assetRepairs',repairId), { status:'rejected', rejectedBy: currentUser.name, rejectedAt: Date.now(), rejectionNote: note||'—', timeline });
    // restore asset status if needed
    if (r.assetId) await _updateDoc(_doc(db,'assets',r.assetId), { status:'ปกติ', updatedAt: Date.now(), updatedBy: currentUser.name });
    toast('🔴 บันทึกการไม่อนุมัติแล้ว', '#dc2626');
    _loadRepairs();
    document.getElementById('repairDetailArea').innerHTML = '';
};

// ── UPDATE STATUS (admin/warehouse after approved) ──
window._repairOpenUpdate = async function(repairId) {
    await _importFS();
    const snap = await _getDoc(_doc(db,'assetRepairs',repairId));
    const r = snap.data();
    const area = document.getElementById('repairDetailArea'); if (!area) return;
    document.getElementById('repairFormArea').innerHTML = '';

    area.innerHTML = `
    <div style="background:white;border-radius:14px;border:2px solid #bfdbfe;padding:22px;box-shadow:0 4px 16px rgba(0,0,0,0.06);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <div style="font-size:14px;font-weight:800;color:#1d4ed8;">✏️ อัปเดตสถานะการซ่อม — ${r.repairNo||''}</div>
            <button onclick="document.getElementById('repairDetailArea').innerHTML=''" style="background:#f1f5f9;color:#475569;border:none;padding:6px 12px;border-radius:7px;cursor:pointer;font-size:11px;">✕</button>
        </div>

        <!-- asset summary -->
        <div style="background:#f8fafc;border-radius:10px;padding:12px;margin-bottom:16px;display:flex;gap:10px;align-items:center;">
            ${r.imageUrl?`<img src="${r.imageUrl}" style="width:52px;height:52px;border-radius:8px;object-fit:cover;flex-shrink:0;">`:'<div style="font-size:28px;flex-shrink:0;">🔧</div>'}
            <div>
                <div style="font-weight:700;font-size:12px;">${r.assetId} — ${r.assetName}</div>
                <div style="font-size:11px;color:#64748b;margin-top:2px;">${r.description}</div>
            </div>
        </div>

        <!-- รูปหลังซ่อม -->
        <div style="margin-bottom:14px;">
            <label style="font-size:10px;font-weight:700;color:#1d4ed8;display:block;margin-bottom:6px;">📸 รูปหลังซ่อมเสร็จ</label>
            <div style="display:flex;align-items:center;gap:10px;">
                <div id="repairAfterPreview" style="width:64px;height:64px;border-radius:9px;background:#eff6ff;border:2px dashed #bfdbfe;display:flex;align-items:center;justify-content:center;font-size:22px;overflow:hidden;flex-shrink:0;cursor:pointer;" onclick="document.getElementById('repairAfterImg').click()">
                    ${r.afterImageUrl?`<img src="${r.afterImageUrl}" style="width:100%;height:100%;object-fit:cover;">`:'📷'}
                </div>
                <label style="background:#1d4ed8;color:white;padding:7px 13px;border-radius:7px;cursor:pointer;font-size:11px;font-weight:700;">
                    📂 แนบรูป<input type="file" id="repairAfterImg" accept="image/*" style="display:none"
                        onchange="(() => { const f=this.files[0]; if(!f) return; const rd=new FileReader(); rd.onload=e=>{ document.getElementById('repairAfterPreview').innerHTML=\`<img src='\${e.target.result}' style='width:100%;height:100%;object-fit:cover;'>\`; }; rd.readAsDataURL(f); })()">
                </label>
            </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
            <div>
                <label style="font-size:10px;font-weight:700;color:#1d4ed8;display:block;margin-bottom:4px;">สถานะการซ่อม</label>
                <select id="repUpdate_status" style="width:100%;padding:9px 11px;border:1.5px solid #bfdbfe;border-radius:8px;font-size:12px;outline:none;cursor:pointer;font-weight:700;background:white;">
                    <option value="approved"     ${r.status==='approved'?'selected':''}>✅ อนุมัติแล้ว (รอซ่อม)</option>
                    <option value="in_progress"  ${r.status==='in_progress'?'selected':''}>🔵 กำลังซ่อม</option>
                    <option value="done"         ${r.status==='done'?'selected':''}>🟢 ซ่อมเสร็จ</option>
                </select>
            </div>
            <div>
                <label style="font-size:10px;font-weight:700;color:#1d4ed8;display:block;margin-bottom:4px;">ค่าซ่อมจริง (฿)</label>
                <input type="number" id="repUpdate_cost" value="${r.repairCost||''}" placeholder="0" min="0"
                    style="width:100%;padding:9px 11px;border:1.5px solid #bfdbfe;border-radius:8px;font-size:12px;outline:none;box-sizing:border-box;">
            </div>
        </div>
        <div style="margin-bottom:16px;">
            <label style="font-size:10px;font-weight:700;color:#1d4ed8;display:block;margin-bottom:4px;">บันทึกเพิ่มเติม</label>
            <textarea id="repUpdate_note" rows="2" placeholder="บันทึกการซ่อม รายการอะไหล่ หรือข้อสังเกต..."
                style="width:100%;padding:9px 11px;border:1.5px solid #bfdbfe;border-radius:8px;font-size:12px;font-family:inherit;outline:none;resize:vertical;box-sizing:border-box;">${r.repairNote||''}</textarea>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
            <button onclick="document.getElementById('repairDetailArea').innerHTML=''" style="background:#f1f5f9;color:#475569;border:none;padding:10px 20px;border-radius:9px;cursor:pointer;font-weight:600;font-size:12px;">ยกเลิก</button>
            <button onclick="_repairSaveUpdate('${repairId}','${r.assetId}')" style="background:linear-gradient(135deg,#1e40af,#2563eb);color:white;border:none;padding:10px 24px;border-radius:9px;cursor:pointer;font-weight:700;font-size:12px;">💾 บันทึก</button>
        </div>
    </div>`;
    area.scrollIntoView({ behavior:'smooth', block:'nearest' });
};

window._repairSaveUpdate = async function(repairId, assetId) {
    await _importFS();
    const status = document.getElementById('repUpdate_status')?.value;
    const cost   = parseFloat(document.getElementById('repUpdate_cost')?.value) || 0;
    const note   = document.getElementById('repUpdate_note')?.value.trim() || '';
    let afterImageUrl = '';
    const afterFile = document.getElementById('repairAfterImg')?.files[0];
    if (afterFile) {
        try {
            toast('⏳ กำลังอัปโหลดรูป...', '#0891b2');
            afterImageUrl = await _uploadImage(afterFile, `assets/${assetId}/repair/after_${Date.now()}_${afterFile.name}`);
        } catch(e) { toast('❌ อัปโหลดรูปไม่สำเร็จ', '#c2410c'); return; }
    }

    const snap = await _getDoc(_doc(db,'assetRepairs',repairId));
    const r = snap.data();
    const timeline = [...(r.timeline||[]), {
        action: `อัปเดตสถานะ → ${REPAIR_STATUS_CFG[status]?.label||status}`,
        by: currentUser.name, role: currentUser.role,
        at: Date.now(), note: note || '—'
    }];

    const upd = { status, repairCost: cost, repairNote: note, updatedAt: Date.now(), updatedBy: currentUser.name, timeline };
    if (afterImageUrl) upd.afterImageUrl = afterImageUrl;
    await _updateDoc(_doc(db,'assetRepairs',repairId), upd);

    const newAssetStatus = status === 'done' ? 'ปกติ' : 'กำลังซ่อม';
    await _updateDoc(_doc(db,'assets',assetId), { status: newAssetStatus, updatedAt: Date.now(), updatedBy: currentUser.name });

    toast('✅ อัปเดตเรียบร้อย', '#059669');
    document.getElementById('repairDetailArea').innerHTML = '';
    _loadRepairs(); _loadAssets();
};

// ── DETAIL VIEW (with approval steps + timeline + print) ──
window._repairOpenDetail = async function(repairId) {
    await _importFS();
    const snap = await _getDoc(_doc(db,'assetRepairs',repairId));
    if (!snap.exists()) return;
    const r = snap.data();
    const area = document.getElementById('repairDetailArea'); if (!area) return;
    document.getElementById('repairFormArea').innerHTML = '';

    const st  = REPAIR_STATUS_CFG[r.status] || REPAIR_STATUS_CFG.pending_l1;
    const urg = REPAIR_URGENCY[r.urgency]   || REPAIR_URGENCY.normal;

    // approval steps detail
    const stepsDetailHtml = REPAIR_APPROVAL_FLOW.map((step, i) => {
        const s = r.approvalSteps?.[i];
        const done = s?.approvedBy;
        const isNext = i === _repairNextStep(r) && ['pending_l1','pending_l2'].includes(r.status);
        return `
        <div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid #f1f5f9;align-items:flex-start;">
            <div style="width:34px;height:34px;border-radius:50%;background:${done?'#10b981':isNext?'#f59e0b':'#f1f5f9'};border:2px solid ${done?'#10b981':isNext?'#f59e0b':'#e2e8f0'};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:${done||isNext?'white':'#94a3b8'};flex-shrink:0;">${done?'✓':(i+1)}</div>
            <div style="flex:1;">
                <div style="font-size:12px;font-weight:700;color:#0f172a;">${step.label}</div>
                ${done
                    ? `<div style="font-size:11px;color:#059669;margin-top:2px;">✅ อนุมัติโดย <b>${s.approvedBy}</b> · ${_repairFmtDate(s.approvedAt)}</div>${s.note?`<div style="font-size:10px;color:#64748b;">${s.note}</div>`:''}`
                    : isNext
                        ? `<div style="font-size:11px;color:#d97706;margin-top:2px;">⏳ รอการอนุมัติ</div>`
                        : `<div style="font-size:11px;color:#94a3b8;margin-top:2px;">— ยังไม่ถึงขั้นนี้</div>`
                }
            </div>
            <!-- inline approve button -->
            ${(!done && isNext && _repairCanApprove(i)) ? `
            <button onclick="_repairApprove('${repairId}',${i})" style="background:linear-gradient(135deg,#059669,#10b981);color:white;border:none;padding:7px 14px;border-radius:8px;cursor:pointer;font-size:11px;font-weight:700;flex-shrink:0;">✅ อนุมัติ</button>` : ''}
        </div>`;
    }).join('');

    // timeline
    const timelineHtml = (r.timeline||[]).slice().reverse().map(t => `
    <div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid #f8fafc;">
        <div style="width:8px;height:8px;border-radius:50%;background:#3b82f6;flex-shrink:0;margin-top:4px;"></div>
        <div>
            <div style="font-size:11px;font-weight:700;color:#0f172a;">${t.action}</div>
            <div style="font-size:10px;color:#94a3b8;">${t.by} (${t.role}) · ${_repairFmtDate(t.at)}</div>
            ${t.note && t.note!=='—'?`<div style="font-size:10px;color:#64748b;margin-top:1px;">${t.note}</div>`:''}
        </div>
    </div>`).join('');

    // signature block (for print)
    const sigHtml = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:4px;">
        ${[
            {role:'ผู้แจ้ง', name: r.reportedBy, at: r.createdAt},
            ...REPAIR_APPROVAL_FLOW.map((step,i)=>({
                role: step.label,
                name: r.approvalSteps?.[i]?.approvedBy || '................................',
                at: r.approvalSteps?.[i]?.approvedAt || null
            })),
            {role:'ผู้ดำเนินการซ่อม', name:'................................', at: null}
        ].map(sig=>`
        <div style="border:1.5px dashed #e2e8f0;border-radius:10px;padding:14px 10px 10px;text-align:center;background:#fafbfd;">
            <div style="height:48px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:6px;">
                <div style="width:80%;height:1px;background:#e2e8f0;"></div>
            </div>
            <div style="font-size:10px;font-weight:700;color:#0f172a;margin-top:6px;">${sig.role}</div>
            <div style="font-size:10px;color:#64748b;margin-top:2px;">${sig.name}</div>
            <div style="font-size:9px;color:#94a3b8;margin-top:2px;">${sig.at?_repairFmtDate(sig.at):'........./........./.........'}</div>
        </div>`).join('')}
    </div>`;

    area.innerHTML = `
    <div style="background:white;border-radius:14px;border:1.5px solid ${st.border};overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.06);" id="repairDetailCard"
        data-repno="${r.repairNo||repairId.slice(-8).toUpperCase()}"
        data-repdate="${_repairFmtDate(r.createdAt)}"
        data-repasset="${r.assetId} — ${r.assetName||''}">
        <!-- header -->
        <div style="background:linear-gradient(135deg,#0f172a,#1e3a5f);padding:18px 22px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
            <div>
                <div style="font-size:11px;color:rgba(255,255,255,.5);letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">ใบแจ้งซ่อมทรัพย์สิน</div>
                <div style="font-size:18px;font-weight:900;color:white;font-family:monospace;">${r.repairNo||repairId.slice(-8).toUpperCase()}</div>
                <div style="font-size:10px;color:rgba(255,255,255,.4);margin-top:3px;">${_repairFmtDate(r.createdAt)}</div>
            </div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                <span style="background:${urg.bg};color:${urg.color};border:1px solid ${urg.border};padding:4px 12px;border-radius:12px;font-size:11px;font-weight:700;">${urg.icon} ${urg.label}</span>
                <span style="background:${st.bg};color:${st.color};border:1px solid ${st.border};padding:4px 12px;border-radius:12px;font-size:11px;font-weight:700;">${st.icon} ${st.label}</span>
                <button onclick="document.getElementById('repairDetailArea').innerHTML=''" style="background:rgba(255,255,255,.1);color:white;border:1px solid rgba(255,255,255,.2);padding:6px 12px;border-radius:8px;cursor:pointer;font-size:11px;">✕ ปิด</button>
                <button onclick="window._repairPrint('${repairId}')" style="background:rgba(255,255,255,.15);color:white;border:1px solid rgba(255,255,255,.25);padding:6px 12px;border-radius:8px;cursor:pointer;font-size:11px;font-weight:700;">🖨️ พิมพ์</button>
            </div>
        </div>

        <div style="padding:20px 22px;">
            <!-- asset info -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:18px;">
                <div>
                    <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px;">ข้อมูลทรัพย์สิน</div>
                    <div style="font-size:13px;font-weight:800;color:#0f172a;">${r.assetId} — ${r.assetName||''}</div>
                    <div style="font-size:11px;color:#475569;margin-top:2px;">Zone: ${r.zone||'—'}</div>
                </div>
                <div>
                    <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px;">ผู้แจ้ง</div>
                    <div style="font-size:13px;font-weight:800;color:#0f172a;">${r.reportedBy}</div>
                    <div style="font-size:11px;color:#475569;margin-top:2px;">${_repairFmtDate(r.createdAt)}</div>
                </div>
            </div>

            <!-- รูป + description -->
            <div style="display:flex;gap:14px;margin-bottom:18px;align-items:flex-start;">
                ${r.imageUrl?`
                <div style="flex-shrink:0;">
                    <div style="font-size:9px;color:#94a3b8;font-weight:700;margin-bottom:4px;text-align:center;">ก่อนซ่อม</div>
                    <img src="${r.imageUrl}" onclick="_repairLightbox('${r.imageUrl}','รูปความเสียหาย — '+r.assetId)"
                        style="width:90px;height:90px;border-radius:10px;object-fit:cover;border:1.5px solid #e2e8f0;cursor:zoom-in;transition:transform .15s,box-shadow .15s;"
                        onmouseover="this.style.transform='scale(1.05)';this.style.boxShadow='0 4px 16px rgba(0,0,0,.15)'"
                        onmouseout="this.style.transform='';this.style.boxShadow=''">
                    <div style="font-size:9px;color:#3b82f6;text-align:center;margin-top:4px;">🔍 คลิกขยาย</div>
                </div>`:''}
                <div style="flex:1;">
                    <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;margin-bottom:5px;">ลักษณะความเสียหาย</div>
                    <div style="font-size:12px;color:#1e293b;line-height:1.6;background:#f8fafc;border-radius:8px;padding:10px 12px;">${r.description}</div>
                    ${r.estimatedCost?`<div style="font-size:11px;color:#6366f1;font-weight:700;margin-top:6px;">ค่าซ่อมโดยประมาณ: ฿${_fmt(r.estimatedCost)}</div>`:''}
                    ${r.repairCost?`<div style="font-size:11px;color:#7c3aed;font-weight:700;margin-top:4px;">ค่าซ่อมจริง: ฿${_fmt(r.repairCost)}</div>`:''}
                </div>
                ${r.afterImageUrl?`
                <div style="flex-shrink:0;">
                    <div style="font-size:9px;color:#059669;font-weight:700;margin-bottom:4px;text-align:center;">หลังซ่อม</div>
                    <img src="${r.afterImageUrl}" onclick="_repairLightbox('${r.afterImageUrl}','รูปหลังซ่อม — '+r.assetId)"
                        style="width:90px;height:90px;border-radius:10px;object-fit:cover;border:2px solid #a7f3d0;cursor:zoom-in;transition:transform .15s,box-shadow .15s;"
                        onmouseover="this.style.transform='scale(1.05)';this.style.boxShadow='0 4px 16px rgba(0,0,0,.15)'"
                        onmouseout="this.style.transform='';this.style.boxShadow=''">
                    <div style="font-size:9px;color:#059669;text-align:center;margin-top:4px;">🔍 คลิกขยาย</div>
                </div>`:''}
            </div>

            <!-- approval steps -->
            <div style="margin-bottom:18px;">
                <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.6px;margin-bottom:2px;">การอนุมัติในระบบ</div>
                ${stepsDetailHtml}
                ${r.status==='rejected'?`<div style="background:#fef2f2;border-radius:8px;padding:10px 12px;margin-top:8px;"><div style="font-size:11px;font-weight:700;color:#dc2626;">🔴 ไม่อนุมัติ — ${r.rejectedBy} · ${_repairFmtDate(r.rejectedAt)}</div><div style="font-size:11px;color:#64748b;margin-top:2px;">${r.rejectionNote||''}</div></div>`:''}
            </div>

            <!-- signature (print area) -->
            <div style="margin-bottom:18px;">
                <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px;">ลายเซ็นผู้เกี่ยวข้อง (สำหรับพิมพ์)</div>
                ${sigHtml}
            </div>

            <!-- timeline -->
            <div>
                <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px;">ประวัติการดำเนินงาน</div>
                <div style="background:#f8fafc;border-radius:10px;padding:12px 14px;">
                    ${timelineHtml || '<div style="font-size:11px;color:#94a3b8;">ยังไม่มีประวัติ</div>'}
                </div>
            </div>
        </div>
    </div>`;
    area.scrollIntoView({ behavior:'smooth', block:'start' });
};

// ── PRINT ──
window._repairPrint = function(repairId) {
    const card = document.getElementById('repairDetailCard');
    if (!card) return;
    const repNo   = card.dataset.repno   || repairId;
    const repDate = card.dataset.repdate || '';
    const repAsset= card.dataset.repasset|| '';
    const assetLine = repAsset
        ? '<div style="font-size:11px;color:rgba(255,255,255,.6);margin-top:2px;">' + repAsset + '</div>'
        : '';
    const html = '<!DOCTYPE html><html><head><meta charset="UTF-8">'
        + '<title>ใบแจ้งซ่อมทรัพย์สิน ' + repNo + '</title>'
        + '<link href="https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">'
        + '<style>'
        + '* { box-sizing:border-box; margin:0; padding:0; }'
        + 'body { font-family:Prompt,sans-serif; padding:0; color:#1e293b; font-size:12px; background:white; }'
        + '.ph { background:#0f172a; color:white; padding:14px 24px; display:flex; justify-content:space-between; align-items:center; }'
        + '.ph-l { display:flex; flex-direction:column; gap:3px; }'
        + '.ph-org { font-size:10px; color:rgba(255,255,255,.5); letter-spacing:1.5px; text-transform:uppercase; }'
        + '.ph-title { font-size:16px; font-weight:800; }'
        + '.ph-r { text-align:right; }'
        + '.ph-no { font-size:15px; font-weight:900; font-family:monospace; color:#f0b429; }'
        + '.ph-date { font-size:10px; color:rgba(255,255,255,.5); margin-top:3px; }'
        + '@media print { button{display:none!important;} .ph{-webkit-print-color-adjust:exact;print-color-adjust:exact;} }'
        + '</style></head><body>'
        + '<div class="ph">'
        +   '<div class="ph-l">'
        +     '<div class="ph-org">TTGPlus Management System</div>'
        +     '<div class="ph-title">ใบแจ้งซ่อมทรัพย์สิน / Asset Repair Request</div>'
        +     assetLine
        +   '</div>'
        +   '<div class="ph-r">'
        +     '<div class="ph-no">' + repNo + '</div>'
        +     '<div class="ph-date">' + repDate + '</div>'
        +   '</div>'
        + '</div>'
        + card.outerHTML
        + '<scr' + 'ipt>window.onload=()=>window.print();</scr' + 'ipt>'
        + '</body></html>';
    const w = window.open('','_blank','width=900,height=700');
    w.document.write(html);
    w.document.close();
};


// ═════════════════════════════════════════════════════════════════════
//  TAB 4: DASHBOARD
// ═════════════════════════════════════════════════════════════════════
function _renderDashboard(c) {
    c.innerHTML = `
    <div style="font-size:15px;font-weight:800;color:#0f172a;margin-bottom:18px;">📊 Asset Dashboard</div>
    <div id="assetDashContent"><div style="text-align:center;padding:40px;color:#94a3b8;">⏳ กำลังโหลด...</div></div>`;
    _loadDashboard();
}

async function _loadDashboard() {
    await _importFS();
    if (!_assetsCache.length) {
        const snap = await _getDocs(_query(_collection(db,'assets'), _orderBy('createdAt','desc')));
        _assetsCache = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
    }
    const repSnap = await _getDocs(_query(_collection(db,'assetRepairs'), _where('status','!=','ซ่อมเสร็จ')));
    const pendingRepairs = repSnap.docs.length;

    const assets = _assetsCache;
    const total = assets.length;
    const totalValue = assets.reduce((s,a) => s + (a.price||0), 0);
    const totalRemaining = assets.reduce((s,a) => { const d=_calcDepreciation(a.price,a.lifeYears,a.purchaseDate); return s+d.remaining; }, 0);
    const totalDepr = totalValue - totalRemaining;

    // By status
    const byStatus = {};
    Object.keys(ASSET_STATUS_MAP).forEach(k => byStatus[k] = 0);
    assets.forEach(a => { if(byStatus[a.status]!==undefined) byStatus[a.status]++; });

    // By category
    const byCat = {};
    ASSET_CATEGORIES.forEach(c => byCat[c] = 0);
    assets.forEach(a => { if(byCat[a.category]!==undefined) byCat[a.category]++; });

    // Near end of life (< 1 year remaining)
    const nearEnd = assets.filter(a => {
        if (!a.price || !a.lifeYears || !a.purchaseDate) return false;
        const d = _calcDepreciation(a.price, a.lifeYears, a.purchaseDate);
        return d.pct >= 80 && a.status !== 'จำหน่ายแล้ว';
    });

    const c = document.getElementById('assetDashContent'); if (!c) return;
    c.innerHTML = `
    <!-- KPI Cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:22px;">
        ${[
            { label:'ทรัพย์สินทั้งหมด', value: total+' รายการ', icon:'📦', color:'#0f172a', bg:'#f8fafc' },
            { label:'มูลค่ารวม', value:'฿'+_fmt(totalValue), icon:'💰', color:'#1d4ed8', bg:'#eff6ff' },
            { label:'ค่าเสื่อมสะสม', value:'฿'+_fmt(Math.round(totalDepr)), icon:'📉', color:'#dc2626', bg:'#fef2f2' },
            { label:'มูลค่าคงเหลือ', value:'฿'+_fmt(Math.round(totalRemaining)), icon:'💎', color:'#059669', bg:'#f0fdf4' },
            { label:'รอซ่อม', value: pendingRepairs+' รายการ', icon:'🔧', color:'#d97706', bg:'#fffbeb' },
            { label:'ใกล้หมดอายุ', value: nearEnd.length+' รายการ', icon:'⏰', color:'#7c3aed', bg:'#faf5ff' },
        ].map(k=>`<div style="background:${k.bg};border-radius:12px;padding:16px;border:1px solid rgba(0,0,0,.06);">
            <div style="font-size:20px;margin-bottom:5px;">${k.icon}</div>
            <div style="font-size:18px;font-weight:900;color:${k.color};">${k.value}</div>
            <div style="font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase;margin-top:2px;">${k.label}</div>
        </div>`).join('')}
    </div>

    <!-- Charts Row -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:22px;">
        <!-- By Status -->
        <div style="background:white;border-radius:12px;border:1px solid #e2e8f0;padding:18px;">
            <div style="font-size:12px;font-weight:700;color:#0f172a;margin-bottom:12px;">สถานะทรัพย์สิน</div>
            ${Object.entries(byStatus).map(([s,n])=>{
                const st = ASSET_STATUS_MAP[s];
                const pct = total ? Math.round(n/total*100) : 0;
                return `<div style="margin-bottom:8px;">
                    <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px;">
                        <span style="color:${st.color};font-weight:600;">${st.icon} ${s}</span>
                        <span style="color:#0f172a;font-weight:700;">${n}</span>
                    </div>
                    <div style="background:#f1f5f9;border-radius:6px;height:6px;overflow:hidden;">
                        <div style="background:${st.color};height:100%;width:${pct}%;border-radius:6px;transition:width .5s;"></div>
                    </div>
                </div>`;
            }).join('')}
        </div>
        <!-- By Category -->
        <div style="background:white;border-radius:12px;border:1px solid #e2e8f0;padding:18px;">
            <div style="font-size:12px;font-weight:700;color:#0f172a;margin-bottom:12px;">จำนวนตามหมวดหมู่</div>
            ${Object.entries(byCat).map(([cat,n])=>{
                const colors = { 'อุปกรณ์ครัว':'#f59e0b', 'IT Equipment':'#3b82f6', 'เฟอร์นิเจอร์':'#10b981', 'ยานพาหนะ':'#ef4444', 'อื่นๆ':'#94a3b8' };
                const col = colors[cat]||'#94a3b8';
                const pct = total ? Math.round(n/total*100) : 0;
                return `<div style="margin-bottom:8px;">
                    <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px;">
                        <span style="color:${col};font-weight:600;">${cat}</span>
                        <span style="font-weight:700;">${n}</span>
                    </div>
                    <div style="background:#f1f5f9;border-radius:6px;height:6px;overflow:hidden;">
                        <div style="background:${col};height:100%;width:${pct}%;border-radius:6px;transition:width .5s;"></div>
                    </div>
                </div>`;
            }).join('')}
        </div>
    </div>

    <!-- Near End of Life -->
    ${nearEnd.length ? `
    <div style="background:white;border-radius:12px;border:1.5px solid #ddd6fe;padding:18px;margin-bottom:16px;">
        <div style="font-size:12px;font-weight:700;color:#7c3aed;margin-bottom:12px;">⏰ ทรัพย์สินที่ใกล้หมดอายุการใช้งาน (ค่าเสื่อม ≥ 80%)</div>
        <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
            <thead><tr style="background:#faf5ff;">
                ${['รหัส','ชื่อ','Zone','ราคาซื้อ','ค่าเสื่อม%','มูลค่าคงเหลือ'].map(h=>`<th style="padding:7px 10px;text-align:left;font-weight:700;color:#7c3aed;">${h}</th>`).join('')}
            </tr></thead>
            <tbody>${nearEnd.map(a=>{
                const dep=_calcDepreciation(a.price,a.lifeYears,a.purchaseDate);
                return `<tr style="border-top:1px solid #f5f3ff;">
                    <td style="padding:7px 10px;font-weight:700;">${a._id}</td>
                    <td style="padding:7px 10px;">${a.name}</td>
                    <td style="padding:7px 10px;color:#64748b;">${a.zone||'—'}</td>
                    <td style="padding:7px 10px;">฿${_fmt(a.price)}</td>
                    <td style="padding:7px 10px;"><span style="background:#fef2f2;color:#dc2626;padding:2px 8px;border-radius:8px;font-weight:700;">${dep.pct}%</span></td>
                    <td style="padding:7px 10px;font-weight:700;color:#7c3aed;">฿${_fmt(dep.remaining)}</td>
                </tr>`;
            }).join('')}</tbody>
        </table></div>
    </div>` : ''}

    <!-- Depreciation Summary by Zone -->
    <div style="background:white;border-radius:12px;border:1px solid #e2e8f0;padding:18px;">
        <div style="font-size:12px;font-weight:700;color:#0f172a;margin-bottom:12px;">📍 มูลค่าทรัพย์สินแยกตาม Zone</div>
        ${(() => {
            const zoneMap = {};
            assets.forEach(a => {
                const z = a.zone || 'ไม่ระบุ';
                if (!zoneMap[z]) zoneMap[z] = { count:0, total:0, remaining:0 };
                zoneMap[z].count++;
                zoneMap[z].total += a.price||0;
                const d = _calcDepreciation(a.price, a.lifeYears, a.purchaseDate);
                zoneMap[z].remaining += d.remaining;
            });
            return Object.entries(zoneMap).sort((a,b)=>b[1].total-a[1].total).map(([z,v])=>`
            <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid #f8fafc;font-size:11px;">
                <div style="font-weight:700;min-width:100px;color:#0f172a;">${z}</div>
                <div style="color:#64748b;">${v.count} รายการ</div>
                <div style="margin-left:auto;text-align:right;">
                    <div style="font-weight:700;color:#0f172a;">฿${_fmt(v.total)}</div>
                    <div style="color:#059669;font-size:10px;">คงเหลือ ฿${_fmt(Math.round(v.remaining))}</div>
                </div>
            </div>`).join('');
        })()}
    </div>`;
}

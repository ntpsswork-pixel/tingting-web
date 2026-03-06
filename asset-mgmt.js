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
let _storageImported = false;
let _getStorage, _ref, _uploadBytes, _getDownloadURL, _deleteObject;

async function _importFS() {
    if (_fsImported) return;
    const fs = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    _addDoc = fs.addDoc; _setDoc = fs.setDoc; _getDoc = fs.getDoc; _getDocs = fs.getDocs;
    _updateDoc = fs.updateDoc; _deleteDoc = fs.deleteDoc; _collection = fs.collection;
    _query = fs.query; _where = fs.where; _orderBy = fs.orderBy; _doc = fs.doc;
    _serverTimestamp = fs.serverTimestamp;
    _fsImported = true;
}

async function _importStorage() {
    if (_storageImported) return;
    const st = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js');
    _getStorage = st.getStorage; _ref = st.ref;
    _uploadBytes = st.uploadBytes; _getDownloadURL = st.getDownloadURL;
    _deleteObject = st.deleteObject;
    _storageImported = true;
}

async function _uploadImage(file, path) {
    await _importStorage();
    const app = window.firebaseApp;
    if (!app) throw new Error('Firebase app ไม่พร้อม — รีเฟรชหน้าแล้วลองใหม่');
    const storage = _getStorage(app);
    const storageRef = _ref(storage, path);
    await _uploadBytes(storageRef, file);
    return await _getDownloadURL(storageRef);
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
    ['registry','audit','repair','dashboard'].forEach(id => {
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
            <button onclick="_importAssetsExcel()" style="background:#059669;color:white;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;">📥 Import Excel</button>
            ` : ''}
            <button onclick="_exportAssetsExcel()" style="background:#7c3aed;color:white;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;">📤 Export</button>
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
    const rows = [['รหัส','ชื่อ','หมวด','ยี่ห้อ/รุ่น','Serial/ทะเบียน','Zone','สถานะ','วันที่ซื้อ','ราคาซื้อ','อายุใช้งาน(ปี)','มูลค่าคงเหลือ','หมายเหตุ']];
    _assetsCache.forEach(a => {
        const dep = _calcDepreciation(a.price, a.lifeYears, a.purchaseDate);
        rows.push([a._id, a.name, a.category||'', a.brand||'', a.serial||'', a.zone||'', a.status||'', a.purchaseDate||'', a.price||'', a.lifeYears||'', dep.remaining||'', a.note||'']);
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{wch:12},{wch:30},{wch:14},{wch:16},{wch:14},{wch:12},{wch:12},{wch:12},{wch:10},{wch:10},{wch:12},{wch:20}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Assets');
    XLSX.writeFile(wb, `TingTing_Assets_${new Date().toISOString().slice(0,10)}.xlsx`);
    toast('✅ Export เรียบร้อย', '#059669');
};

window._importAssetsExcel = function() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.xlsx,.xls,.csv';
    input.onchange = async e => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = async ev => {
            const wb = XLSX.read(ev.target.result, { type:'array' });
            const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval:'' });
            if (!data.length) { toast('❌ ไม่พบข้อมูล', '#c2410c'); return; }
            await _importFS();
            let added = 0;
            for (const row of data) {
                const id = String(row['รหัส']||row['ProductCode']||'').trim(); if (!id) continue;
                const d = {
                    name: String(row['ชื่อ']||row['ProductName']||'').trim(),
                    category: String(row['หมวด']||'').trim()||'อื่นๆ',
                    brand: String(row['ยี่ห้อ/รุ่น']||'').trim(),
                    serial: String(row['Serial/ทะเบียน']||'').trim(),
                    zone: String(row['Zone']||'').trim(),
                    status: String(row['สถานะ']||'ปกติ').trim(),
                    purchaseDate: String(row['วันที่ซื้อ']||'').trim(),
                    price: parseFloat(row['ราคาซื้อ'])||0,
                    lifeYears: parseFloat(row['อายุใช้งาน(ปี)'])||0,
                    note: String(row['หมายเหตุ']||'').trim(),
                    createdAt: Date.now(), createdBy: currentUser.name,
                    updatedAt: Date.now(), updatedBy: currentUser.name,
                };
                if (!d.name) continue;
                await _setDoc(_doc(db, 'assets', id), d, { merge: true });
                added++;
            }
            toast(`✅ Import ${added} รายการ`, '#059669');
            _loadAssets();
        };
        reader.readAsArrayBuffer(file);
    };
    input.click();
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
        <div style="margin-top:14px;text-align:right;">
            <button onclick="_exportAuditResults('${roundId}')" style="background:#7c3aed;color:white;border:none;padding:9px 20px;border-radius:8px;cursor:pointer;font-weight:700;font-size:12px;">📤 Export ผลตรวจนับ</button>
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
        <div style="margin-top:12px;text-align:right;">
            <button onclick="_exportAuditResults('${roundId}')" style="background:#7c3aed;color:white;border:none;padding:8px 18px;border-radius:8px;cursor:pointer;font-weight:700;font-size:12px;">📤 Export Excel</button>
        </div>
    </div>`;
    area.scrollIntoView({ behavior:'smooth', block:'nearest' });
};

window._exportAuditResults = async function(roundId) {
    await _importFS();
    const snap = await _getDocs(_query(_collection(db,'assetAuditResults'), _where('roundId','==',roundId)));
    const results = snap.docs.map(d => d.data());
    const rows = [['รหัสทรัพย์สิน','ผล','หมายเหตุ','ผู้ตรวจ','วันที่']];
    results.forEach(r => rows.push([r.assetId, r.result, r.auditNote||'', r.countedBy, r.dateLabel||'']));
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'AuditResults');
    XLSX.writeFile(wb, `TingTing_Audit_${roundId.slice(-6)}.xlsx`);
};

// ═════════════════════════════════════════════════════════════════════
//  TAB 3: REPAIR — แจ้งซ่อม
// ═════════════════════════════════════════════════════════════════════
function _renderRepair(c) {
    const isAdmin = currentUser?.role === 'admin';
    c.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
        <div><div style="font-size:15px;font-weight:800;color:#0f172a;">🔧 แจ้งซ่อมทรัพย์สิน</div>
        <div style="font-size:12px;color:#94a3b8;margin-top:2px;">แจ้งชำรุด → ติดตาม → บันทึกค่าซ่อม</div></div>
        <button onclick="_openNewRepairForm()" style="background:#d97706;color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;">+ แจ้งซ่อมใหม่</button>
    </div>
    <!-- Filter -->
    <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
        <select id="repairStatusFilter" onchange="_loadRepairs()" style="padding:8px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:12px;outline:none;cursor:pointer;">
            <option value="">— ทุกสถานะ —</option>
            <option value="รอดำเนินการ">🟡 รอดำเนินการ</option>
            <option value="กำลังซ่อม">🔵 กำลังซ่อม</option>
            <option value="ซ่อมเสร็จ">🟢 ซ่อมเสร็จ</option>
        </select>
    </div>
    <div id="repairList" style="min-height:150px;"><div style="text-align:center;padding:40px;color:#94a3b8;">⏳ กำลังโหลด...</div></div>
    <div id="repairFormArea" style="margin-top:16px;"></div>`;
    _loadRepairs();
}

async function _loadRepairs() {
    await _importFS();
    const statusFilter = document.getElementById('repairStatusFilter')?.value || '';
    let q = _query(_collection(db,'assetRepairs'), _orderBy('createdAt','desc'));
    const snap = await _getDocs(q);
    let repairs = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
    if (statusFilter) repairs = repairs.filter(r => r.status === statusFilter);
    // BT users only see their zone
    const isBT = currentUser?.username?.toUpperCase().startsWith('BT') && currentUser?.role !== 'admin';
    const myZone = (currentUser?.assignedZones||[])[0] || '';
    if (isBT) repairs = repairs.filter(r => r.zone === myZone || r.reportedBy === currentUser.name);

    const c = document.getElementById('repairList'); if (!c) return;
    const isAdmin = currentUser?.role === 'admin';
    if (!repairs.length) { c.innerHTML = `<div style="text-align:center;padding:30px;color:#94a3b8;border:2px dashed #e2e8f0;border-radius:10px;">ไม่มีใบแจ้งซ่อม</div>`; return; }

    const repairColors = { 'รอดำเนินการ': {bg:'#fffbeb',border:'#fde68a',color:'#a16207',icon:'🟡'}, 'กำลังซ่อม': {bg:'#eff6ff',border:'#bfdbfe',color:'#1d4ed8',icon:'🔵'}, 'ซ่อมเสร็จ': {bg:'#f0fdf4',border:'#a7f3d0',color:'#065f46',icon:'🟢'} };

    c.innerHTML = repairs.map(r => {
        const st = repairColors[r.status] || repairColors['รอดำเนินการ'];
        return `<div style="background:white;border-radius:11px;border:1.5px solid ${st.border};padding:16px;margin-bottom:10px;background:${st.bg};">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;">
                <div style="display:flex;gap:10px;align-items:flex-start;flex:1;min-width:0;">
                    ${r.imageUrl ? `<img src="${r.imageUrl}" style="width:52px;height:52px;border-radius:8px;object-fit:cover;flex-shrink:0;border:2px solid ${st.border};">` :
                        `<div style="width:52px;height:52px;border-radius:8px;background:white;border:2px solid ${st.border};display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">🔧</div>`}
                    <div style="min-width:0;">
                        <div style="font-weight:800;font-size:13px;color:#0f172a;">${r.assetId} — ${r.assetName||''}</div>
                        <div style="font-size:11px;color:#475569;margin-top:2px;">${r.description||''}</div>
                        <div style="font-size:10px;color:#94a3b8;margin-top:2px;">แจ้งโดย: ${r.reportedBy} | ${r.dateLabel||''} | Zone: ${r.zone||'—'}</div>
                        ${r.repairCost ? `<div style="font-size:11px;color:#7c3aed;font-weight:700;margin-top:2px;">ค่าซ่อม: ฿${_fmt(r.repairCost)}</div>` : ''}
                        ${r.afterImageUrl ? `<div style="margin-top:5px;"><span style="font-size:9px;color:#059669;font-weight:700;">รูปหลังซ่อม:</span> <img src="${r.afterImageUrl}" style="width:36px;height:36px;border-radius:5px;object-fit:cover;vertical-align:middle;"></div>` : ''}
                    </div>
                </div>
                <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end;flex-shrink:0;">
                    <span style="background:white;color:${st.color};border:1px solid ${st.border};padding:3px 10px;border-radius:16px;font-size:10px;font-weight:700;">${st.icon} ${r.status}</span>
                    ${isAdmin ? `<button onclick="_openUpdateRepair('${r._id}')" style="background:#f1f5f9;color:#475569;border:none;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:10px;font-weight:700;">✏️ อัปเดต</button>` : ''}
                </div>
            </div>
        </div>`;
    }).join('');
}

window._openNewRepairForm = function(prefillAssetId) {
    const area = document.getElementById('repairFormArea'); if (!area) return;
    const assetOptions = _assetsCache.filter(a => a.status !== 'จำหน่ายแล้ว');
    area.innerHTML = `
    <div style="background:white;border-radius:12px;border:2px solid #fde68a;padding:22px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <div style="font-size:14px;font-weight:800;color:#a16207;">🔧 แจ้งซ่อมใหม่</div>
            <button onclick="document.getElementById('repairFormArea').innerHTML=''" style="background:#f1f5f9;color:#475569;border:none;padding:6px 12px;border-radius:7px;cursor:pointer;font-size:11px;">✕</button>
        </div>
        <!-- รูปภาพความเสียหาย -->
        <div style="margin-bottom:14px;">
            <label style="font-size:10px;font-weight:700;color:#a16207;display:block;margin-bottom:6px;">📸 รูปความเสียหาย</label>
            <div style="display:flex;align-items:center;gap:10px;">
                <div id="repairImgPreview" style="width:70px;height:70px;border-radius:9px;background:#fffbeb;border:2px dashed #fde68a;display:flex;align-items:center;justify-content:center;font-size:24px;overflow:hidden;flex-shrink:0;">🔧</div>
                <label style="background:#d97706;color:white;padding:7px 14px;border-radius:7px;cursor:pointer;font-size:11px;font-weight:700;">
                    📂 แนบรูป<input type="file" id="repairImgInput" accept="image/*" style="display:none"
                        onchange="(() => { const f=this.files[0]; if(!f) return; const r=new FileReader(); r.onload=e=>{ document.getElementById('repairImgPreview').innerHTML=\`<img src='\${e.target.result}' style='width:100%;height:100%;object-fit:cover;'>\`; }; r.readAsDataURL(f); })()">
                </label>
            </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
            <div><label style="font-size:10px;font-weight:700;color:#a16207;display:block;margin-bottom:4px;">ทรัพย์สิน *</label>
                <select id="rep_assetId" style="width:100%;padding:9px 11px;border:1.5px solid #fde68a;border-radius:8px;font-size:12px;outline:none;cursor:pointer;">
                    <option value="">— เลือกทรัพย์สิน —</option>
                    ${assetOptions.map(a=>`<option value="${a._id}" ${prefillAssetId===a._id?'selected':''}>${a._id} — ${a.name}</option>`).join('')}
                </select></div>
            <div><label style="font-size:10px;font-weight:700;color:#a16207;display:block;margin-bottom:4px;">Zone / สาขา</label>
                <select id="rep_zone" style="width:100%;padding:9px 11px;border:1.5px solid #fde68a;border-radius:8px;font-size:12px;outline:none;cursor:pointer;">
                    <option value="">— ระบุสาขา —</option>
                    ${(warehouseList||[]).map(z=>`<option value="${z}" ${(currentUser?.assignedZones||[])[0]===z?'selected':''}>${z}</option>`).join('')}
                </select></div>
        </div>
        <div style="margin-bottom:12px;"><label style="font-size:10px;font-weight:700;color:#a16207;display:block;margin-bottom:4px;">รายละเอียดความเสียหาย *</label>
            <textarea id="rep_desc" rows="3" placeholder="อธิบายความเสียหายหรืออาการผิดปกติ..."
                style="width:100%;padding:9px 11px;border:1.5px solid #fde68a;border-radius:8px;font-size:12px;font-family:inherit;outline:none;resize:vertical;box-sizing:border-box;"></textarea></div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
            <button onclick="document.getElementById('repairFormArea').innerHTML=''" style="background:#f1f5f9;color:#475569;border:none;padding:9px 18px;border-radius:8px;cursor:pointer;font-weight:600;">ยกเลิก</button>
            <button onclick="_submitRepair()" style="background:#d97706;color:white;border:none;padding:9px 22px;border-radius:8px;cursor:pointer;font-weight:700;">📤 ส่งเรื่อง</button>
        </div>
    </div>`;
    area.scrollIntoView({ behavior:'smooth', block:'nearest' });
};

window._submitRepair = async function() {
    await _importFS();
    const assetId = document.getElementById('rep_assetId')?.value;
    const desc    = document.getElementById('rep_desc')?.value.trim();
    if (!assetId) { toast('⚠️ กรุณาเลือกทรัพย์สิน', '#c2410c'); return; }
    if (!desc)    { toast('⚠️ กรุณาอธิบายความเสียหาย', '#c2410c'); return; }
    const asset = _assetsCache.find(a => a._id === assetId);
    let imageUrl = '';
    const imgFile = document.getElementById('repairImgInput')?.files[0];
    if (imgFile) {
        try {
            toast('⏳ กำลังอัปโหลดรูป...', '#0891b2');
            imageUrl = await _uploadImage(imgFile, `assets/${assetId}/repair/${Date.now()}_${imgFile.name}`);
        } catch(e) { toast('❌ อัปโหลดรูปไม่สำเร็จ: ' + e.message, '#c2410c'); console.error(e); return; }
    }
    const data = {
        assetId, assetName: asset?.name || '', zone: document.getElementById('rep_zone')?.value || asset?.zone || '',
        description: desc, imageUrl, status: 'รอดำเนินการ',
        reportedBy: currentUser.name, createdAt: Date.now(), dateLabel: _todayTH(),
    };
    await _addDoc(_collection(db,'assetRepairs'), data);
    // อัปเดตสถานะทรัพย์สินเป็นชำรุด
    await _updateDoc(_doc(db,'assets',assetId), { status:'ชำรุด', updatedAt: Date.now(), updatedBy: currentUser.name });
    toast('✅ แจ้งซ่อมเรียบร้อย', '#059669');
    document.getElementById('repairFormArea').innerHTML = '';
    _loadRepairs();
    _loadAssets();
};

window._openUpdateRepair = async function(repairId) {
    await _importFS();
    const snap = await _getDoc(_doc(db,'assetRepairs',repairId));
    const r = snap.data();
    const area = document.getElementById('repairFormArea'); if (!area) return;
    area.innerHTML = `
    <div style="background:white;border-radius:12px;border:2px solid #bfdbfe;padding:22px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <div style="font-size:14px;font-weight:800;color:#1d4ed8;">✏️ อัปเดตสถานะการซ่อม</div>
            <button onclick="document.getElementById('repairFormArea').innerHTML=''" style="background:#f1f5f9;color:#475569;border:none;padding:6px 12px;border-radius:7px;cursor:pointer;font-size:11px;">✕</button>
        </div>
        <div style="background:#f8fafc;border-radius:8px;padding:10px 12px;margin-bottom:14px;">
            <div style="font-weight:700;font-size:12px;">${r.assetId} — ${r.assetName}</div>
            <div style="font-size:11px;color:#64748b;margin-top:2px;">${r.description}</div>
            ${r.imageUrl ? `<img src="${r.imageUrl}" style="margin-top:8px;width:80px;height:80px;border-radius:7px;object-fit:cover;">` : ''}
        </div>
        <!-- รูปหลังซ่อม -->
        <div style="margin-bottom:14px;">
            <label style="font-size:10px;font-weight:700;color:#1d4ed8;display:block;margin-bottom:6px;">📸 รูปหลังซ่อมเสร็จ</label>
            <div style="display:flex;align-items:center;gap:10px;">
                <div id="repairAfterPreview" style="width:60px;height:60px;border-radius:8px;background:#f1f5f9;border:2px dashed #bfdbfe;display:flex;align-items:center;justify-content:center;font-size:20px;overflow:hidden;flex-shrink:0;">
                    ${r.afterImageUrl ? `<img src="${r.afterImageUrl}" style="width:100%;height:100%;object-fit:cover;">` : '📷'}
                </div>
                <label style="background:#1d4ed8;color:white;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:700;">
                    📂 แนบรูป<input type="file" id="repairAfterImg" accept="image/*" style="display:none"
                        onchange="(() => { const f=this.files[0]; if(!f) return; const r=new FileReader(); r.onload=e=>{ document.getElementById('repairAfterPreview').innerHTML=\`<img src='\${e.target.result}' style='width:100%;height:100%;object-fit:cover;'>\`; }; r.readAsDataURL(f); })()">
                </label>
            </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
            <div><label style="font-size:10px;font-weight:700;color:#1d4ed8;display:block;margin-bottom:4px;">สถานะการซ่อม</label>
                <select id="repUpdate_status" style="width:100%;padding:9px 11px;border:1.5px solid #bfdbfe;border-radius:8px;font-size:12px;outline:none;cursor:pointer;font-weight:700;">
                    <option value="รอดำเนินการ" ${r.status==='รอดำเนินการ'?'selected':''}>🟡 รอดำเนินการ</option>
                    <option value="กำลังซ่อม" ${r.status==='กำลังซ่อม'?'selected':''}>🔵 กำลังซ่อม</option>
                    <option value="ซ่อมเสร็จ" ${r.status==='ซ่อมเสร็จ'?'selected':''}>🟢 ซ่อมเสร็จ</option>
                </select></div>
            <div><label style="font-size:10px;font-weight:700;color:#1d4ed8;display:block;margin-bottom:4px;">ค่าซ่อม (฿)</label>
                <input type="number" id="repUpdate_cost" value="${r.repairCost||''}" placeholder="0" min="0"
                    style="width:100%;padding:9px 11px;border:1.5px solid #bfdbfe;border-radius:8px;font-size:12px;outline:none;box-sizing:border-box;"></div>
        </div>
        <div style="margin-bottom:12px;"><label style="font-size:10px;font-weight:700;color:#1d4ed8;display:block;margin-bottom:4px;">บันทึกเพิ่มเติม</label>
            <textarea id="repUpdate_note" rows="2" style="width:100%;padding:9px 11px;border:1.5px solid #bfdbfe;border-radius:8px;font-size:12px;font-family:inherit;outline:none;resize:vertical;box-sizing:border-box;">${r.repairNote||''}</textarea></div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
            <button onclick="document.getElementById('repairFormArea').innerHTML=''" style="background:#f1f5f9;color:#475569;border:none;padding:9px 18px;border-radius:8px;cursor:pointer;font-weight:600;">ยกเลิก</button>
            <button onclick="_saveRepairUpdate('${repairId}','${r.assetId}')" style="background:#1d4ed8;color:white;border:none;padding:9px 22px;border-radius:8px;cursor:pointer;font-weight:700;">💾 บันทึก</button>
        </div>
    </div>`;
    area.scrollIntoView({ behavior:'smooth', block:'nearest' });
};

window._saveRepairUpdate = async function(repairId, assetId) {
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
        } catch(e) { toast('❌ อัปโหลดรูปไม่สำเร็จ: ' + e.message, '#c2410c'); console.error(e); return; }
    }
    const upd = { status, repairCost: cost, repairNote: note, updatedAt: Date.now(), updatedBy: currentUser.name };
    if (afterImageUrl) upd.afterImageUrl = afterImageUrl;
    await _updateDoc(_doc(db,'assetRepairs',repairId), upd);
    // sync asset status
    const newAssetStatus = status === 'ซ่อมเสร็จ' ? 'ปกติ' : 'กำลังซ่อม';
    await _updateDoc(_doc(db,'assets',assetId), { status: newAssetStatus, updatedAt: Date.now(), updatedBy: currentUser.name });
    toast('✅ อัปเดตการซ่อมเรียบร้อย', '#059669');
    document.getElementById('repairFormArea').innerHTML = '';
    _loadRepairs(); _loadAssets();
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

// warehouse-settings.js — TTGPlus (refactored: tab layout + Product Init System)

let _wmActiveTab = 'products';

window.openWarehouseManager = function(defaultTab) {
    _wmActiveTab = defaultTab || 'products';
    document.getElementById('dashboardView').classList.add('hidden');
    const c = document.getElementById('toolAppContainer'); c.classList.remove('hidden');
    _renderWMShell(c);
};

function _renderWMShell(c) {
    const tabs = [
        { id:'products', icon:'🍎', label:'สินค้า' },
        { id:'zones',    icon:'📦', label:'Zone / คลัง' },
        { id:'parents',  icon:'🏭', label:'คลังหลัก' },
        { id:'mapping',  icon:'🔗', label:'จับคู่สินค้า' },
        { id:'minmax',   icon:'📊', label:'Min / Max' },
        { id:'init',     icon:'🚀', label:'ตั้งต้นสินค้า' },
    ];
    c.innerHTML = `
    <div class="tool-header" style="margin-bottom:0;border-bottom:none;padding-bottom:0;">
        <h2>⚙️ ตั้งค่าคลังและสินค้า</h2>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button onclick="backupConfig()" style="background:#0f172a;color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;">💾 Backup</button>
            <label style="background:#0891b2;color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;display:flex;align-items:center;gap:5px;">
                📂 Restore<input type="file" accept=".json" onchange="restoreConfig(this)" style="display:none;">
            </label>
            <button onclick="closeTool()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;">✕ ปิด</button>
        </div>
    </div>
    <div style="display:flex;gap:3px;flex-wrap:wrap;margin:16px 0 0;border-bottom:2px solid #e2e8f0;" id="wmTabBar">
        ${tabs.map(t=>`<button id="wmTab_${t.id}" onclick="wmSwitchTab('${t.id}')"
            style="padding:9px 16px;border:none;border-radius:10px 10px 0 0;cursor:pointer;font-size:12px;font-weight:600;font-family:inherit;transition:all .15s;
            ${_wmActiveTab===t.id?'background:white;color:#0f172a;border:2px solid #e2e8f0;border-bottom:2px solid white;margin-bottom:-2px;box-shadow:0 -2px 8px rgba(0,0,0,.05);':'background:#f8fafc;color:#94a3b8;border:2px solid transparent;'}"
            >${t.icon} ${t.label}</button>`).join('')}
    </div>
    <div id="wmTabContent" style="background:white;border:2px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;padding:24px;min-height:400px;"></div>`;
    wmSwitchTab(_wmActiveTab);
}

window.wmSwitchTab = function(tabId) {
    _wmActiveTab = tabId;
    ['products','zones','parents','mapping','minmax','init'].forEach(id=>{
        const btn=document.getElementById(`wmTab_${id}`); if(!btn) return;
        if(id===tabId){ btn.style.cssText+=';background:white;color:#0f172a;border:2px solid #e2e8f0;border-bottom:2px solid white;margin-bottom:-2px;box-shadow:0 -2px 8px rgba(0,0,0,.05);'; }
        else{ btn.style.background='#f8fafc'; btn.style.color='#94a3b8'; btn.style.border='2px solid transparent'; btn.style.marginBottom='0'; btn.style.boxShadow='none'; }
    });
    const content=document.getElementById('wmTabContent'); if(!content) return;
    switch(tabId){
        case 'products': _renderTabProducts(content); break;
        case 'zones':    _renderTabZones(content); break;
        case 'parents':  _renderTabParents(content); break;
        case 'mapping':  _renderTabMapping(content); break;
        case 'minmax':   _renderTabMinMax(content); break;
        case 'init':     _renderTabInit(content); break;
    }
};

// ─── TAB: สินค้า ─────────────────────────────────────────────────────
function _renderTabProducts(c) {
    c.innerHTML = `
    <div style="display:grid;grid-template-columns:360px 1fr;gap:22px;align-items:start;">
        <div>
            <div style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:12px;padding:14px;margin-bottom:14px;">
                <div style="font-size:10px;font-weight:800;color:#a16207;text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px;">🏷️ หมวดหมู่สินค้า</div>
                <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px;min-height:24px;" id="categoryChipList"></div>
                <div style="display:flex;gap:6px;">
                    <input type="text" id="newCategoryInput" placeholder="เพิ่มหมวดหมู่ใหม่..." maxlength="30"
                        style="flex:1;padding:7px 10px;border:1.5px solid #fde68a;border-radius:7px;font-size:12px;outline:none;font-family:inherit;background:white;"
                        onkeydown="if(event.key==='Enter')addCategory()">
                    <button onclick="addCategory()" style="background:#d97706;color:white;border:none;padding:7px 12px;border-radius:7px;cursor:pointer;font-size:12px;font-weight:700;">+ เพิ่ม</button>
                </div>
            </div>
            <div style="background:#f0f9ff;border:1.5px solid #bae6fd;border-radius:12px;padding:16px;">
                <div style="font-size:10px;font-weight:800;color:#0369a1;text-transform:uppercase;letter-spacing:.6px;margin-bottom:12px;">➕ เพิ่มสินค้าใหม่</div>
                <div style="display:flex;flex-direction:column;gap:7px;">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;">
                        <input type="text" id="newPdId" placeholder="รหัส (เว้นว่าง=Auto)" style="padding:8px 10px;border:1.5px solid #e2e8f0;border-radius:7px;font-size:12px;font-family:inherit;outline:none;" onfocus="this.style.borderColor='#3b82f6'" onblur="this.style.borderColor='#e2e8f0'">
                        <input type="text" id="newPdName" placeholder="ชื่อสินค้า *" style="padding:8px 10px;border:1.5px solid #e2e8f0;border-radius:7px;font-size:12px;font-family:inherit;outline:none;" onfocus="this.style.borderColor='#3b82f6'" onblur="this.style.borderColor='#e2e8f0'">
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;">
                        <input type="text" id="newPdSupplier" placeholder="🏢 Supplier" style="padding:8px 10px;border:1.5px solid #e2e8f0;border-radius:7px;font-size:12px;font-family:inherit;outline:none;" onfocus="this.style.borderColor='#3b82f6'" onblur="this.style.borderColor='#e2e8f0'">
                        <input type="text" id="newPdCategory" placeholder="🏷️ หมวดหมู่" list="categoryDatalist" style="padding:8px 10px;border:1.5px solid #fde68a;border-radius:7px;font-size:12px;font-family:inherit;outline:none;" onfocus="this.style.borderColor='#d97706'" onblur="this.style.borderColor='#fde68a'">
                        <datalist id="categoryDatalist"></datalist>
                    </div>
                    <input type="text" id="newPdBarcode" placeholder="📦 Barcode" style="padding:8px 10px;border:1.5px solid #e2e8f0;border-radius:7px;font-size:12px;font-family:monospace;outline:none;width:100%;box-sizing:border-box;" onfocus="this.style.borderColor='#3b82f6'" onblur="this.style.borderColor='#e2e8f0'">
                    <div style="background:white;border-radius:8px;padding:10px;border:1px solid #e2e8f0;">
                        <div style="font-size:10px;font-weight:700;color:#7c3aed;text-transform:uppercase;letter-spacing:.5px;margin-bottom:7px;">📦 หน่วยและอัตราแปลง</div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:5px;">
                            <input type="text" id="newPdUnit1" placeholder="หน่วย 1 เช่น ลัง" style="padding:6px 9px;border:1.5px solid #e2e8f0;border-radius:6px;font-size:11px;font-family:inherit;outline:none;" onblur="refreshNewPdExportUnitOpts()">
                            <input type="number" id="newPdRate1" placeholder="1 ลัง = ? ถุง" min="1" style="padding:6px 9px;border:1.5px solid #e2e8f0;border-radius:6px;font-size:11px;outline:none;">
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:5px;">
                            <input type="text" id="newPdUnit2" placeholder="หน่วย 2 เช่น ถุง" style="padding:6px 9px;border:1.5px solid #e2e8f0;border-radius:6px;font-size:11px;font-family:inherit;outline:none;" onblur="refreshNewPdExportUnitOpts()">
                            <input type="number" id="newPdRate2" placeholder="1 ถุง = ? กรัม" min="1" style="padding:6px 9px;border:1.5px solid #e2e8f0;border-radius:6px;font-size:11px;outline:none;">
                        </div>
                        <input type="text" id="newPdUnit3" placeholder="หน่วย 3 เช่น กรัม" style="width:100%;padding:6px 9px;border:1.5px solid #e2e8f0;border-radius:6px;font-size:11px;font-family:inherit;outline:none;box-sizing:border-box;margin-bottom:7px;" onblur="refreshNewPdExportUnitOpts()">
                        <div style="display:flex;align-items:center;gap:7px;padding-top:7px;border-top:1px dashed #e2e8f0;">
                            <span style="font-size:10px;color:#0369a1;font-weight:700;white-space:nowrap;">📤 Export:</span>
                            <select id="newPdExportUnit" style="flex:1;padding:5px 8px;border:1.5px solid #bae6fd;border-radius:6px;font-size:11px;color:#0369a1;font-weight:600;outline:none;background:#f0f9ff;">
                                <option value="">— กรอกหน่วยก่อน —</option>
                            </select>
                        </div>
                    </div>
                    <button onclick="addPd()" style="width:100%;background:linear-gradient(135deg,#1e40af,#3b82f6);color:white;padding:10px;border-radius:8px;border:none;cursor:pointer;font-weight:700;font-size:13px;font-family:inherit;">+ บันทึกสินค้า</button>
                </div>
            </div>
        </div>
        <div>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
                <div style="font-size:13px;font-weight:700;color:#0f172a;">สินค้าทั้งหมด <span id="pdTotalBadge" style="background:#f1f5f9;color:#64748b;font-size:11px;padding:2px 8px;border-radius:10px;margin-left:4px;">${(allProducts||[]).length} รายการ</span></div>
                <div style="display:flex;gap:6px;">
                    <button onclick="wmSwitchTab('init')" style="background:#0f172a;color:white;border:none;padding:7px 12px;border-radius:7px;cursor:pointer;font-size:11px;font-weight:700;">📥 Import Excel</button>
                    <button onclick="openBulkCategoryEditor()" style="background:#7c3aed;color:white;border:none;padding:7px 12px;border-radius:7px;cursor:pointer;font-size:11px;font-weight:700;">🗂️ Bulk หมวด</button>
                </div>
            </div>
            <div style="display:flex;gap:7px;margin-bottom:10px;">
                <div style="position:relative;flex:1;">
                    <input type="text" id="pdSearchInput" placeholder="🔍 ค้นหารหัส / ชื่อ / Supplier..." oninput="filterPdList(this.value)"
                        style="width:100%;padding:8px 36px 8px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:12px;box-sizing:border-box;outline:none;font-family:inherit;" onfocus="this.style.borderColor='#3b82f6'" onblur="this.style.borderColor='#e2e8f0'">
                    <span id="pdSearchCount" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:10px;color:#94a3b8;pointer-events:none;"></span>
                </div>
                <select id="pdCatFilter" onchange="_filterPdByCategory(this.value)"
                    style="padding:8px 10px;border:1.5px solid #fde68a;border-radius:8px;font-size:11px;outline:none;background:#fffbeb;color:#a16207;font-weight:600;cursor:pointer;">
                    <option value="">— ทุกหมวด —</option>
                    ${(productCategories||[]).map(cat=>`<option value="${cat}">${cat}</option>`).join('')}
                    <option value="__none__">⚠️ ยังไม่มีหมวด</option>
                </select>
            </div>
            <div id="pdMasterContainer" style="max-height:580px;overflow-y:auto;border:1px solid #f1f5f9;border-radius:10px;"></div>
        </div>
    </div>`;
    renderCategoryChips(); renderPdList();
}

window._filterPdByCategory = function(cat) {
    const items=document.querySelectorAll('[data-pd-search]'); let v=0;
    items.forEach(el=>{ const c=(el.dataset.pdCat||'').toLowerCase(); const show=!cat?true:cat==='__none__'?!c:c===cat.toLowerCase(); el.style.display=show?'':'none'; if(show)v++; });
    const cnt=document.getElementById('pdSearchCount'); if(cnt) cnt.textContent=cat?`พบ ${v} รายการ`:'';
};

// ─── TAB: Zone ───────────────────────────────────────────────────────
function _renderTabZones(c) {
    c.innerHTML=`
    <div style="max-width:460px;">
        <div style="font-size:13px;color:#64748b;margin-bottom:14px;">จัดการ Zone / คลังย่อยทั้งหมดในระบบ</div>
        <div style="display:flex;gap:8px;margin-bottom:16px;">
            <input type="text" id="newWhName" placeholder="ชื่อ Zone / คลังใหม่"
                style="flex:1;padding:10px 14px;border:1.5px solid #e2e8f0;border-radius:9px;font-size:13px;font-family:inherit;outline:none;"
                onfocus="this.style.borderColor='#10b981'" onblur="this.style.borderColor='#e2e8f0'" onkeydown="if(event.key==='Enter')addWh()">
            <button onclick="addWh()" style="background:#10b981;color:white;border:none;padding:10px 20px;border-radius:9px;cursor:pointer;font-weight:700;">+ เพิ่ม</button>
        </div>
        <div id="whListContainer" style="border:1px solid #f1f5f9;border-radius:12px;overflow:hidden;"></div>
    </div>`;
    renderWhList();
}

// ─── TAB: คลังหลัก ───────────────────────────────────────────────────
function _renderTabParents(c) {
    c.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:10px;">
        <div><div style="font-size:15px;font-weight:700;color:#5b21b6;">🏭 คลังหลัก</div><div style="font-size:12px;color:#94a3b8;margin-top:2px;">ผูก Zone ย่อยเข้าด้วยกัน → Export รวมยอดให้อัตโนมัติ</div></div>
        <button onclick="openAddParentWhForm()" style="background:#7c3aed;color:white;border:none;padding:9px 18px;border-radius:9px;cursor:pointer;font-weight:700;">+ เพิ่มคลังหลัก</button>
    </div>
    <div id="parentWhContainer"></div><div id="parentWhFormArea"></div>`;
    renderParentWhList();
}

// ─── TAB: Mapping ────────────────────────────────────────────────────
function _renderTabMapping(c) {
    c.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px;">
        <div><div style="font-size:15px;font-weight:700;">🔗 จับคู่สินค้าเข้าสู่ Zone</div><div style="font-size:12px;color:#94a3b8;margin-top:2px;">เลือก Zone → เลือกสินค้า → บันทึกอัตโนมัติ</div></div>
        <div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap;">
            <select id="selectZoneMap" onchange="renderMapping();renderMinMaxTable()" style="padding:8px 12px;border-radius:8px;min-width:160px;border:2px solid #0f172a;font-weight:700;font-size:12px;outline:none;cursor:pointer;"></select>
            <button onclick="selectAllMapping(true)" style="background:#10b981;color:white;border:none;padding:8px 12px;border-radius:7px;cursor:pointer;font-weight:700;font-size:11px;">✅ ทั้งหมด</button>
            <button onclick="toggleSortMode()" id="btnSortMode" style="background:#7c3aed;color:white;border:none;padding:8px 12px;border-radius:7px;cursor:pointer;font-weight:700;font-size:11px;">↕️ จัดลำดับ</button>
            <button onclick="selectAllMapping(false)" style="background:#ef4444;color:white;border:none;padding:8px 12px;border-radius:7px;cursor:pointer;font-weight:700;font-size:11px;">❌ ล้าง</button>
        </div>
    </div>
    <input type="text" id="mappingSearch" placeholder="🔍 ค้นหาสินค้า..." oninput="filterMapping(this.value)"
        style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:12px;box-sizing:border-box;outline:none;margin-bottom:12px;font-family:inherit;" onfocus="this.style.borderColor='#0f172a'" onblur="this.style.borderColor='#e2e8f0'">
    <div id="mappingContainer" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;max-height:420px;overflow-y:auto;"></div>
    <div id="sortContainer" style="display:none;margin-top:12px;">
        <div style="font-size:12px;color:#7c3aed;font-weight:700;margin-bottom:8px;">↕️ ลากเพื่อเรียงลำดับ</div>
        <div id="sortList" style="display:flex;flex-direction:column;gap:5px;"></div>
        <button onclick="saveSortOrder()" style="margin-top:10px;background:#7c3aed;color:white;border:none;padding:9px 20px;border-radius:8px;cursor:pointer;font-weight:700;">💾 บันทึกลำดับ</button>
    </div>`;
    document.getElementById('selectZoneMap').innerHTML=warehouseList.map(w=>`<option value="${w}">${w}</option>`).join('');
    renderMapping();
}

// ─── TAB: Min/Max ────────────────────────────────────────────────────
function _renderTabMinMax(c) {
    c.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px;">
        <div><div style="font-size:15px;font-weight:700;">📊 Min / Max สต๊อกต่อคลัง</div><div style="font-size:12px;color:#94a3b8;margin-top:2px;">Min = ยอดต่ำสุด | Max = เป้าหมาย — กำหนดต่างกันได้แต่ละคลัง</div></div>
        <button onclick="saveAllMinMax()" style="background:#10b981;color:white;border:none;padding:9px 18px;border-radius:9px;cursor:pointer;font-weight:700;">💾 บันทึก Min/Max</button>
    </div>
    <div id="minMaxZoneTabs" style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #f1f5f9;"></div>
    <div id="minMaxZoneLabel" style="font-size:13px;color:#64748b;margin-bottom:8px;"></div>
    <div id="minMaxContainer"></div>`;
    renderMinMaxTable();
}

// ─── TAB: 🚀 ตั้งต้นสินค้า ───────────────────────────────────────────
function _renderTabInit(c) {
    c.innerHTML=`
    <div style="margin-bottom:18px;">
        <div style="font-size:15px;font-weight:800;color:#0f172a;margin-bottom:3px;">🚀 ระบบตั้งต้นสินค้า</div>
        <div style="font-size:12px;color:#64748b;">นำเข้า / ตั้งยอดเปิด / Export / Cleanup — สำหรับตั้งค่าครั้งแรกก่อนเริ่มใช้งาน</div>
    </div>
    <div style="background:linear-gradient(135deg,#0f172a,#1e40af);border-radius:12px;padding:16px 20px;margin-bottom:20px;color:white;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#93c5fd;margin-bottom:8px;">แนะนำ Flow การตั้งต้น</div>
        <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;font-size:11px;font-weight:600;">
            ${['① Export Template','② กรอกใน Excel','③ Import สินค้า','④ ตั้งยอดเปิด','⑤ เริ่มใช้งาน ✅'].map((s,i)=>`
            ${i>0?'<span style="color:#93c5fd;">→</span>':''}<span style="background:rgba(255,255,255,.15);padding:4px 10px;border-radius:16px;">${s}</span>`).join('')}
        </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
        <div style="background:white;border-radius:12px;border:2px solid #bae6fd;padding:20px;">
            <div style="display:flex;align-items:center;gap:9px;margin-bottom:6px;">
                <div style="width:34px;height:34px;background:#0891b2;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">📥</div>
                <div><div style="font-size:13px;font-weight:800;color:#0369a1;">Import สินค้าจาก Excel</div><div style="font-size:10px;color:#94a3b8;">ลาก-วาง • preview ก่อน import • ตรวจซ้ำ</div></div>
            </div>
            <div style="display:flex;gap:7px;margin-top:12px;">
                <button onclick="downloadImportTemplate()" style="flex:1;background:#f0f9ff;color:#0369a1;border:1.5px solid #bae6fd;padding:8px;border-radius:7px;cursor:pointer;font-size:11px;font-weight:700;">⬇️ Template</button>
                <button onclick="openImportProducts()" style="flex:1;background:#0891b2;color:white;border:none;padding:8px;border-radius:7px;cursor:pointer;font-size:11px;font-weight:700;">📥 Import</button>
            </div>
        </div>
        <div style="background:white;border-radius:12px;border:2px solid #a7f3d0;padding:20px;">
            <div style="display:flex;align-items:center;gap:9px;margin-bottom:6px;">
                <div style="width:34px;height:34px;background:#059669;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">📊</div>
                <div><div style="font-size:13px;font-weight:800;color:#065f46;">ตั้งยอด Stock เริ่มต้น</div><div style="font-size:10px;color:#94a3b8;">Opening Balance ณ วันเปิดระบบ</div></div>
            </div>
            <div style="display:flex;gap:7px;margin-top:12px;">
                <button onclick="downloadOpeningBalanceTemplate()" style="flex:1;background:#f0fdf4;color:#065f46;border:1.5px solid #a7f3d0;padding:8px;border-radius:7px;cursor:pointer;font-size:11px;font-weight:700;">⬇️ Template</button>
                <button onclick="openOpeningBalance()" style="flex:1;background:#059669;color:white;border:none;padding:8px;border-radius:7px;cursor:pointer;font-size:11px;font-weight:700;">📊 ตั้งยอด</button>
            </div>
        </div>
        <div style="background:white;border-radius:12px;border:2px solid #ddd6fe;padding:20px;">
            <div style="display:flex;align-items:center;gap:9px;margin-bottom:6px;">
                <div style="width:34px;height:34px;background:#7c3aed;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">📤</div>
                <div><div style="font-size:13px;font-weight:800;color:#5b21b6;">Export รายการสินค้า</div><div style="font-size:10px;color:#94a3b8;">Export ข้อมูลสินค้าปัจจุบันทั้งหมด</div></div>
            </div>
            <button onclick="exportAllProducts()" style="width:100%;background:#7c3aed;color:white;border:none;padding:8px;border-radius:7px;cursor:pointer;font-size:11px;font-weight:700;margin-top:12px;">📤 Export สินค้าทั้งหมด (.xlsx)</button>
        </div>
        <div style="background:white;border-radius:12px;border:2px solid #fecaca;padding:20px;">
            <div style="display:flex;align-items:center;gap:9px;margin-bottom:6px;">
                <div style="width:34px;height:34px;background:#ef4444;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">🗑️</div>
                <div><div style="font-size:13px;font-weight:800;color:#991b1b;">Cleanup / Reset</div><div style="font-size:10px;color:#94a3b8;font-weight:700;">⚠️ Admin เท่านั้น</div></div>
            </div>
            <button onclick="openCleanupManager()" style="width:100%;background:#ef4444;color:white;border:none;padding:8px;border-radius:7px;cursor:pointer;font-size:11px;font-weight:700;margin-top:12px;">🗑️ Cleanup Manager</button>
        </div>
    </div>
    <div id="initImportArea" style="margin-top:18px;"></div>
    <div id="initOpeningArea" style="margin-top:18px;"></div>
    <div id="initCleanupArea" style="margin-top:18px;"></div>`;
}

// ─── Export All Products ──────────────────────────────────────────────
window.exportAllProducts = function() {
    if(!allProducts.length) { toast('⚠️ ยังไม่มีสินค้า','#c2410c'); return; }
    const rows=[['ProductCode','ProductName','Category','Supplier','Barcode','Unit1','Rate1','Unit2','Rate2','Unit3','ExportUnit']];
    allProducts.forEach(p=>{
        const u=p.units||[{name:p.unit||'',rate:0}];
        rows.push([p.id,p.name,p.category||'',p.supplier||'',p.barcode||'',u[0]?.name||'',u[0]?.rate||'',u[1]?.name||'',u[1]?.rate||'',u[2]?.name||'',p.exportUnit||u[0]?.name||'']);
    });
    const ws=XLSX.utils.aoa_to_sheet(rows); ws['!cols']=[{wch:14},{wch:35},{wch:14},{wch:20},{wch:15},{wch:10},{wch:7},{wch:10},{wch:7},{wch:10},{wch:12}];
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Products');
    XLSX.writeFile(wb,`TingTing_Products_${new Date().toISOString().slice(0,10)}.xlsx`);
    toast('✅ Export สินค้าเรียบร้อย','#059669');
};

// ─── Opening Balance ──────────────────────────────────────────────────
window.downloadOpeningBalanceTemplate = function() {
    const rows=[['Zone','ProductCode','ProductName','Balance','Unit']];
    if(warehouseList.length&&allProducts.length){ const z=warehouseList[0]; allProducts.slice(0,3).forEach(p=>{ rows.push([z,p.id,p.name,'',((p.units||[{name:p.unit||''}])[0]?.name||'')]); }); }
    else rows.push(['Zone1','ITEM-001','ตัวอย่างสินค้า','100','ถุง']);
    const ws=XLSX.utils.aoa_to_sheet(rows); ws['!cols']=[{wch:15},{wch:14},{wch:35},{wch:10},{wch:10}];
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'OpeningBalance');
    XLSX.writeFile(wb,'TingTing_OpeningBalance_Template.xlsx');
};

window.openOpeningBalance = function() {
    document.getElementById('initImportArea').innerHTML='';
    document.getElementById('initCleanupArea').innerHTML='';
    const area=document.getElementById('initOpeningArea'); if(!area) return;
    const today=new Date().toISOString().slice(0,10);
    area.innerHTML=`
    <div style="background:white;border-radius:12px;border:2px solid #a7f3d0;padding:22px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px;">
            <div style="font-size:14px;font-weight:800;color:#065f46;">📊 ตั้งยอด Stock เริ่มต้น (Opening Balance)</div>
            <button onclick="document.getElementById('initOpeningArea').innerHTML=''" style="background:#f1f5f9;color:#475569;border:none;padding:6px 12px;border-radius:7px;cursor:pointer;font-size:11px;">✕ ปิด</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px;margin-bottom:14px;">
            <div><label style="font-size:10px;font-weight:700;color:#065f46;display:block;margin-bottom:4px;">📅 วันที่ตั้งต้น</label>
                <input type="date" id="ob_date" value="${today}" style="width:100%;padding:8px 10px;border:1.5px solid #a7f3d0;border-radius:7px;font-size:12px;font-weight:700;outline:none;box-sizing:border-box;"></div>
            <div><label style="font-size:10px;font-weight:700;color:#065f46;display:block;margin-bottom:4px;">📦 Zone / คลัง</label>
                <select id="ob_zone" onchange="_renderOBItems()" style="width:100%;padding:8px 10px;border:1.5px solid #a7f3d0;border-radius:7px;font-size:12px;font-weight:700;outline:none;cursor:pointer;">
                    ${warehouseList.map(z=>`<option value="${z}">${z}</option>`).join('')}
                </select></div>
            <div style="display:flex;align-items:flex-end;">
                <label style="display:flex;align-items:center;gap:6px;background:#059669;color:white;padding:8px 12px;border-radius:7px;cursor:pointer;font-size:11px;font-weight:700;width:100%;justify-content:center;box-sizing:border-box;">
                    📂 Import Excel<input type="file" accept=".xlsx,.xls,.csv" onchange="_handleOBImport(this)" style="display:none;">
                </label>
            </div>
        </div>
        <div style="margin-bottom:8px;"><input type="text" placeholder="🔍 ค้นหาสินค้า..." oninput="_filterOBRows(this.value)"
            style="width:100%;padding:7px 12px;border:1.5px solid #e2e8f0;border-radius:7px;font-size:12px;box-sizing:border-box;outline:none;font-family:inherit;"></div>
        <div id="ob_itemsArea" style="max-height:360px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:9px;"></div>
        <div style="margin-top:14px;text-align:right;">
            <button onclick="_saveOpeningBalance()" style="background:#059669;color:white;border:none;padding:10px 28px;border-radius:9px;cursor:pointer;font-weight:700;font-size:13px;">💾 บันทึกยอดตั้งต้น</button>
        </div>
    </div>`;
    _renderOBItems();
    area.scrollIntoView({behavior:'smooth',block:'nearest'});
};

window._renderOBItems = function() {
    const zone=document.getElementById('ob_zone')?.value||'';
    const prods=zone?(zoneProductMap[zone]||[]).map(id=>allProducts.find(p=>p.id===id)).filter(Boolean):allProducts;
    const c=document.getElementById('ob_itemsArea'); if(!c) return;
    if(!prods.length){ c.innerHTML='<div style="padding:20px;text-align:center;color:#94a3b8;font-size:13px;">ไม่มีสินค้าใน Zone นี้ — กรุณาจับคู่สินค้าใน Tab "จับคู่สินค้า" ก่อน</div>'; return; }
    c.innerHTML=`<table style="width:100%;border-collapse:collapse;">
        <thead style="position:sticky;top:0;background:#f0fdf4;z-index:1;"><tr>
            <th style="padding:9px 11px;text-align:left;font-size:10px;color:#065f46;font-weight:700;text-transform:uppercase;border-bottom:2px solid #a7f3d0;">สินค้า</th>
            <th style="padding:9px 11px;text-align:center;font-size:10px;color:#065f46;font-weight:700;text-transform:uppercase;border-bottom:2px solid #a7f3d0;width:120px;">ยอดตั้งต้น</th>
            <th style="padding:9px 11px;text-align:center;font-size:10px;color:#065f46;font-weight:700;text-transform:uppercase;border-bottom:2px solid #a7f3d0;width:70px;">หน่วย</th>
        </tr></thead>
        <tbody>${prods.map(p=>{ const u=((p.units||[{name:p.unit||''}])[0]?.name||'');
            return `<tr class="ob-row" data-search="${p.id.toLowerCase()} ${p.name.toLowerCase()}" style="border-bottom:1px solid #f0fdf4;">
                <td style="padding:9px 11px;"><div style="font-weight:700;font-size:11px;">${p.id}</div><div style="font-size:11px;color:#475569;">${p.name}</div></td>
                <td style="padding:9px 11px;text-align:center;"><input type="number" id="ob_${p.id}" min="0" placeholder="0"
                    style="width:95px;padding:6px;border:2px solid #a7f3d0;border-radius:7px;text-align:center;font-weight:700;font-size:13px;outline:none;" onfocus="this.style.borderColor='#059669'" onblur="this.style.borderColor='#a7f3d0'"></td>
                <td style="padding:9px 11px;text-align:center;color:#64748b;font-size:11px;">${u}</td>
            </tr>`; }).join('')}
        </tbody></table>`;
};

window._filterOBRows=function(q){ document.querySelectorAll('.ob-row').forEach(r=>{ r.style.display=(!q||r.dataset.search.includes(q.toLowerCase()))?'':'none'; }); };

window._handleOBImport=function(input){ const file=input.files[0]; if(!file) return;
    const reader=new FileReader(); reader.onload=e=>{
        try{ const wb=XLSX.read(e.target.result,{type:'array'}); const ws=wb.Sheets[wb.SheetNames[0]]; const data=XLSX.utils.sheet_to_json(ws,{defval:''});
            let filled=0; data.forEach(row=>{ const id=String(row.ProductCode||'').trim(); const bal=parseFloat(row.Balance)||0; const el=document.getElementById(`ob_${id}`); if(el&&bal>0){el.value=bal;filled++;} });
            toast(`✅ Import ยอดเปิด ${filled} รายการ`,'#059669');
        } catch(e){ toast('❌ '+e.message,'#c2410c'); }
    }; reader.readAsArrayBuffer(file);
};

window._saveOpeningBalance=async function(){
    const zone=document.getElementById('ob_zone')?.value||''; const dateVal=document.getElementById('ob_date')?.value;
    if(!dateVal){toast('⚠️ กรุณาเลือกวันที่','#c2410c');return;}
    const [cy,cm,cd]=dateVal.split('-'); const dateTH=`${cd}/${cm}/${parseInt(cy)+543}`;
    const prods=zone?(zoneProductMap[zone]||[]).map(id=>allProducts.find(p=>p.id===id)).filter(Boolean):allProducts;
    const items=prods.map(p=>({id:p.id,name:p.name,unit:((p.units||[{name:p.unit||''}])[0]?.name||''),balance:parseFloat(document.getElementById(`ob_${p.id}`)?.value)||0})).filter(it=>it.balance>0);
    if(!items.length){toast('⚠️ กรุณากรอกยอดอย่างน้อย 1 รายการ','#c2410c');return;}
    if(!confirm(`ยืนยันบันทึกยอดตั้งต้น ${items.length} รายการ\nZone: ${zone||'ทั้งหมด'} วันที่: ${dateTH}`)) return;
    try{
        const {addDoc,collection}=await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
        await addDoc(collection(db,'inventoryHistory'),{zone:zone||'ทั้งหมด',date:dateTH,timestamp:Date.now(),type:'opening',countedBy:currentUser.name,recordedBy:currentUser.name,items});
        toast(`✅ บันทึกยอดตั้งต้น ${items.length} รายการ`,'#059669');
        document.getElementById('initOpeningArea').innerHTML='';
    } catch(er){toast('❌ '+er.message,'#ef4444');}
};

// ─── Cleanup Manager ──────────────────────────────────────────────────
window.openCleanupManager=function(){
    if(currentUser?.role!=='admin'){toast('⛔ เฉพาะ Admin เท่านั้น','#c2410c');return;}
    document.getElementById('initImportArea').innerHTML=''; document.getElementById('initOpeningArea').innerHTML='';
    const area=document.getElementById('initCleanupArea'); if(!area) return;
    const allMapped=new Set(Object.values(zoneProductMap).flat());
    const orphans=allProducts.filter(p=>!allMapped.has(p.id));
    area.innerHTML=`
    <div style="background:white;border-radius:12px;border:2px solid #fecaca;padding:22px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:10px;">
            <div style="font-size:14px;font-weight:800;color:#991b1b;">🗑️ Cleanup Manager</div>
            <button onclick="document.getElementById('initCleanupArea').innerHTML=''" style="background:#f1f5f9;color:#475569;border:none;padding:6px 12px;border-radius:7px;cursor:pointer;font-size:11px;">✕ ปิด</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
            <div style="background:#fff5f5;border:1.5px solid #fecaca;border-radius:9px;padding:14px;">
                <div style="font-size:11px;font-weight:700;color:#991b1b;margin-bottom:7px;">⚠️ สินค้าที่ไม่ผูก Zone (${orphans.length} รายการ)</div>
                ${orphans.length?`
                <div style="max-height:110px;overflow-y:auto;margin-bottom:9px;">${orphans.map(p=>`<div style="font-size:10px;color:#1e293b;padding:2px 0;border-bottom:1px solid #fecaca;"><b>${p.id}</b> — ${p.name}</div>`).join('')}</div>
                <button onclick="_deleteOrphans()" style="width:100%;background:#ef4444;color:white;border:none;padding:7px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:700;">🗑️ ลบทั้งหมด (${orphans.length})</button>`
                :'<div style="font-size:11px;color:#10b981;">✅ ไม่มีสินค้า orphan</div>'}
            </div>
            <div style="background:#fff5f5;border:1.5px solid #fecaca;border-radius:9px;padding:14px;">
                <div style="font-size:11px;font-weight:700;color:#991b1b;margin-bottom:7px;">🗂️ Bulk ลบสินค้าที่เลือก</div>
                <div style="max-height:130px;overflow-y:auto;border:1px solid #fecaca;border-radius:5px;padding:6px;margin-bottom:8px;" id="_cleanupBulkList">
                    ${allProducts.map((p,i)=>`<label style="display:flex;align-items:center;gap:7px;padding:3px 0;cursor:pointer;font-size:10px;">
                        <input type="checkbox" value="${i}" style="width:13px;height:13px;accent-color:#ef4444;cursor:pointer;"><span><b>${p.id}</b> — ${p.name}</span></label>`).join('')}
                </div>
                <button onclick="_bulkDeleteSelected()" style="width:100%;background:#ef4444;color:white;border:none;padding:7px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:700;">🗑️ ลบที่เลือก</button>
            </div>
        </div>
        <div style="background:#fff5f5;border:2px dashed #fca5a5;border-radius:9px;padding:14px;">
            <div style="font-size:11px;font-weight:700;color:#7f1d1d;margin-bottom:5px;">☢️ Hard Reset Stock Data</div>
            <div style="font-size:10px;color:#991b1b;margin-bottom:10px;line-height:1.6;">⚠️ <b>อันตราย!</b> ล้างยอดสต๊อกทั้งหมดให้เป็น 0 ทุก Zone (ข้อมูลสินค้าและ mapping ยังคงอยู่)</div>
            <div style="display:flex;gap:8px;">
                <input type="text" id="_hardResetConfirm" placeholder='พิมพ์ "RESET" เพื่อยืนยัน'
                    style="flex:1;padding:8px 10px;border:2px solid #fca5a5;border-radius:7px;font-size:12px;font-weight:700;outline:none;font-family:monospace;color:#7f1d1d;">
                <button onclick="_hardResetStock()" style="background:#7f1d1d;color:white;border:none;padding:8px 14px;border-radius:7px;cursor:pointer;font-size:11px;font-weight:700;white-space:nowrap;">☢️ Reset</button>
            </div>
        </div>
    </div>`;
    area.scrollIntoView({behavior:'smooth',block:'nearest'});
};

window._deleteOrphans=async function(){
    const allMapped=new Set(Object.values(zoneProductMap).flat()); const toDelete=allProducts.filter(p=>!allMapped.has(p.id));
    if(!toDelete.length){toast('✅ ไม่มีสินค้า orphan','#059669');return;}
    if(!confirm(`ลบสินค้าที่ไม่ผูก Zone ทั้งหมด ${toDelete.length} รายการ?`)) return;
    const ids=new Set(toDelete.map(p=>p.id)); window.allProducts=allProducts.filter(p=>!ids.has(p.id)); window._allProducts=window.allProducts;
    await saveConfig(); toast(`✅ ลบ ${toDelete.length} รายการ`,'#059669'); openCleanupManager();
};

window._bulkDeleteSelected=async function(){
    const checked=[...document.querySelectorAll('#_cleanupBulkList input:checked')]; if(!checked.length){toast('⚠️ ยังไม่ได้เลือก','#c2410c');return;}
    const idx=checked.map(cb=>parseInt(cb.value)).sort((a,b)=>b-a);
    if(!confirm(`ลบ ${idx.length} รายการ?`)) return;
    idx.forEach(i=>allProducts.splice(i,1));
    const rem=allProducts.map(p=>p.id); Object.keys(zoneProductMap).forEach(z=>{ zoneProductMap[z]=(zoneProductMap[z]||[]).filter(id=>rem.includes(id)); });
    await saveConfig(); toast(`✅ ลบ ${idx.length} รายการ`,'#059669'); openCleanupManager();
};

window._hardResetStock=async function(){
    if(document.getElementById('_hardResetConfirm')?.value.trim()!=='RESET'){toast('⚠️ พิมพ์ "RESET" ให้ถูกต้อง','#c2410c');return;}
    if(!confirm('⚠️ ยืนยันล้าง Stock Data ทั้งหมด?')) return;
    if(!confirm('🔴 ยืนยันอีกครั้ง — ไม่สามารถยกเลิกได้')) return;
    try{
        const {setDoc,doc}=await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
        await setDoc(doc(db,'stock','countData'),{});
        if(window.countData) window.countData={};
        toast('✅ ล้าง Stock Data เรียบร้อย','#059669');
        document.getElementById('initCleanupArea').innerHTML='';
    } catch(e){toast('❌ '+e.message,'#ef4444');}
};

// ─── Existing functions (preserved) ──────────────────────────────────
window.renderParentWhList=function(){
    const c=document.getElementById('parentWhContainer'); if(!c) return;
    const wg=window.warehouseGroups||{}; const groups=Object.entries(wg).filter(([k])=>k!=='_whnames');
    if(!groups.length){c.innerHTML=`<div style="text-align:center;padding:28px;color:#94a3b8;font-size:13px;border:2px dashed #e2e8f0;border-radius:10px;">ยังไม่มีคลังหลัก — กด "เพิ่มคลังหลัก"</div>`;return;}
    c.innerHTML=`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;">${groups.map(([parentId,zones])=>{
        const zl=zones||[]; const colors={'WHRM':'#7c3aed','WHPD':'#0891b2','WH':'#059669'}; const color=Object.entries(colors).find(([k])=>parentId.toUpperCase().startsWith(k))?.[1]||'#64748b';
        return `<div style="background:white;border-radius:11px;border:2px solid ${color}30;padding:16px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
                <div><div style="font-size:14px;font-weight:800;color:${color};">🏭 ${parentId}</div><div style="font-size:11px;color:#475569;">${(wg._whnames||{})[parentId]||''}</div><div style="font-size:10px;color:#94a3b8;">${zl.length} Zone ย่อย</div></div>
                <div style="display:flex;gap:4px;"><button onclick="openEditParentWhForm('${parentId}')" style="background:#f1f5f9;border:none;padding:5px 9px;border-radius:5px;cursor:pointer;font-size:11px;">✏️</button>
                <button onclick="deleteParentWh('${parentId}')" style="background:#fef2f2;border:none;padding:5px 9px;border-radius:5px;cursor:pointer;font-size:11px;color:#ef4444;">🗑️</button></div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:4px;">${zl.map(z=>`<span style="background:${color}15;color:${color};font-size:10px;padding:2px 9px;border-radius:16px;border:1px solid ${color}30;font-weight:600;">📦 ${z}</span>`).join('')}${!zl.length?'<span style="color:#cbd5e1;font-size:10px;">ยังไม่มี Zone</span>':''}</div>
        </div>`;}).join('')}</div>`;
};

window.openAddParentWhForm=function(editId){
    const wg=window.warehouseGroups||{}; const existing=editId?wg[editId]:null; const area=document.getElementById('parentWhFormArea'); if(!area) return;
    area.innerHTML=`<div style="margin-top:14px;background:#f5f3ff;border:1.5px solid #ddd6fe;border-radius:11px;padding:18px;">
        <h4 style="margin:0 0 12px;color:#5b21b6;">${editId?'✏️ แก้ไข':'➕ สร้าง'}คลังหลัก</h4>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
            <div><label style="font-size:10px;font-weight:700;color:#5b21b6;display:block;margin-bottom:4px;">รหัสคลังหลัก *</label>
                <input id="pwh_id" value="${editId||''}" placeholder="เช่น WHRM01" ${editId?'readonly':''}
                    style="width:100%;padding:8px 10px;border:1.5px solid #ddd6fe;border-radius:7px;font-size:12px;font-weight:700;box-sizing:border-box;outline:none;font-family:inherit;${editId?'background:#f1f5f9;color:#64748b;':''}"></div>
            <div><label style="font-size:10px;font-weight:700;color:#5b21b6;display:block;margin-bottom:4px;">ชื่อแสดง</label>
                <input id="pwh_name" value="${(wg._whnames||{})[editId]||''}" placeholder="เช่น คลังวัตถุดิบ"
                    style="width:100%;padding:8px 10px;border:1.5px solid #ddd6fe;border-radius:7px;font-size:12px;box-sizing:border-box;outline:none;font-family:inherit;"></div>
        </div>
        <label style="font-size:10px;font-weight:700;color:#5b21b6;display:block;margin-bottom:6px;">เลือก Zone</label>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:5px;max-height:180px;overflow-y:auto;padding:8px;background:white;border:1px solid #e2e8f0;border-radius:7px;margin-bottom:12px;" id="pwhZoneCheckboxes">
            ${warehouseList.map(z=>{const chk=existing?existing.includes(z):false;
                return `<label style="display:flex;align-items:center;gap:7px;padding:7px 9px;border:1.5px solid ${chk?'#7c3aed':'#e2e8f0'};border-radius:7px;cursor:pointer;background:${chk?'#f5f3ff':'white'};">
                    <input type="checkbox" value="${z}" ${chk?'checked':''} style="width:14px;height:14px;accent-color:#7c3aed;" onchange="this.closest('label').style.borderColor=this.checked?'#7c3aed':'#e2e8f0';this.closest('label').style.background=this.checked?'#f5f3ff':'white'">
                    <span style="font-size:11px;font-weight:600;">${z}</span></label>`;}).join('')}
        </div>
        <div style="display:flex;gap:7px;justify-content:flex-end;">
            <button onclick="document.getElementById('parentWhFormArea').innerHTML=''" style="background:#f1f5f9;color:#475569;border:none;padding:9px 18px;border-radius:7px;cursor:pointer;font-weight:600;">ยกเลิก</button>
            <button onclick="saveParentWh('${editId||''}')" style="background:#7c3aed;color:white;border:none;padding:9px 20px;border-radius:7px;cursor:pointer;font-weight:700;">💾 บันทึก</button>
        </div>
    </div>`;
    area.scrollIntoView({behavior:'smooth',block:'nearest'});
};
window.openEditParentWhForm=function(id){openAddParentWhForm(id);};
window.saveParentWh=function(editId){
    const id=(document.getElementById('pwh_id')?.value||'').trim().toUpperCase(); const dn=document.getElementById('pwh_name')?.value.trim()||'';
    if(!id){toast('⚠️ กรุณาใส่รหัสคลังหลัก','#c2410c');return;}
    const checked=[...document.querySelectorAll('#pwhZoneCheckboxes input[type=checkbox]:checked')].map(cb=>cb.value);
    if(!window.warehouseGroups) window.warehouseGroups={}; window.warehouseGroups[id]=checked;
    if(!window.warehouseGroups._whnames) window.warehouseGroups._whnames={}; window.warehouseGroups._whnames[id]=dn;
    saveConfig(); toast(`✅ บันทึกคลังหลัก "${id}" (${checked.length} Zones)`,'#7c3aed');
    document.getElementById('parentWhFormArea').innerHTML=''; renderParentWhList();
};
window.deleteParentWh=function(id){
    if(!confirm(`ลบคลังหลัก "${id}"?\nZone ย่อยจะไม่ถูกลบ`)) return;
    if(!window.warehouseGroups) return; delete window.warehouseGroups[id];
    if(window.warehouseGroups._whnames) delete window.warehouseGroups._whnames[id];
    saveConfig(); renderParentWhList(); toast(`🗑️ ลบคลังหลัก "${id}"`,'#64748b');
};

window.renderWhList=function(){
    const c=document.getElementById('whListContainer'); if(!c) return;
    if(!warehouseList.length){c.innerHTML='<div style="padding:18px;text-align:center;color:#94a3b8;font-size:12px;">ยังไม่มี Zone</div>';return;}
    c.innerHTML=warehouseList.map((wh,i)=>`
    <div style="display:flex;align-items:center;gap:7px;padding:10px 13px;border-bottom:1px solid #f8fafc;" id="whRow_${i}">
        <span style="flex:1;font-weight:600;font-size:12px;" id="whLabel_${i}">${wh}</span>
        <input id="whInput_${i}" value="${wh}" style="flex:1;display:none;padding:6px 9px;border:1.5px solid #3b82f6;border-radius:6px;font-size:12px;font-family:inherit;outline:none;">
        <button style="background:#3b82f6;color:white;border:none;padding:5px 9px;border-radius:5px;cursor:pointer;font-size:11px;" onclick="toggleEditWh(${i})">✏️</button>
        <button id="whSaveBtn_${i}" style="background:#10b981;color:white;border:none;padding:5px 9px;border-radius:5px;cursor:pointer;font-size:11px;display:none;" onclick="saveEditWh(${i})">💾</button>
        <button style="background:#ef4444;color:white;border:none;padding:5px 9px;border-radius:5px;cursor:pointer;font-size:11px;" onclick="deleteWh(${i})">🗑️</button>
    </div>`).join('');
};
window.toggleEditWh=function(i){ document.getElementById(`whLabel_${i}`).style.display='none'; document.getElementById(`whInput_${i}`).style.display='block'; document.getElementById(`whSaveBtn_${i}`).style.display='inline'; };
window.saveEditWh=function(i){
    const newName=document.getElementById(`whInput_${i}`).value.trim(); if(!newName) return;
    const oldName=warehouseList[i]; warehouseList[i]=newName;
    if(oldName!==newName&&zoneProductMap[oldName]){zoneProductMap[newName]=zoneProductMap[oldName];delete zoneProductMap[oldName];}
    saveConfig(); renderWhList();
    const sel=document.getElementById('selectZoneMap'); if(sel) sel.innerHTML=warehouseList.map(w=>`<option value="${w}">${w}</option>`).join('');
    toast('✅ แก้ไขชื่อ Zone เรียบร้อย','#059669');
};

window.filterPdList=function(q){
    q=(q||'').toLowerCase().trim(); const c=document.getElementById('pdMasterContainer'); const cnt=document.getElementById('pdSearchCount'); if(!c) return;
    const items=c.querySelectorAll('[data-pd-search]'); let v=0;
    items.forEach(el=>{ const m=!q||el.dataset.pdSearch.includes(q); el.style.display=m?'':'none'; if(m)v++; });
    if(cnt) cnt.textContent=q?`พบ ${v}/${allProducts.length}`:'';
};

window.renderPdList=function(){
    const c=document.getElementById('pdMasterContainer'); if(!c) return;
    const badge=document.getElementById('pdTotalBadge'); if(badge) badge.textContent=`${allProducts.length} รายการ`;
    if(!allProducts.length){ c.innerHTML=`<div style="text-align:center;padding:28px;color:#94a3b8;font-size:12px;border:2px dashed #e2e8f0;border-radius:9px;">ยังไม่มีสินค้า — เพิ่มจากฟอร์มด้านซ้าย หรือ Import Excel</div>`; return; }
    c.innerHTML=allProducts.map((p,i)=>{
        const units=p.units||[{name:p.unit||'',rate:0},{name:p.subUnit||'',rate:0}].filter(u=>u.name);
        const unitsStr=units.map((u,idx)=>u.name+(idx<units.length-1&&u.rate?` (×${u.rate})`:'') ).join(' → ');
        return `<div data-pd-search="${p.id.toLowerCase()} ${p.name.toLowerCase()} ${(p.supplier||'').toLowerCase()}"
                     data-pd-cat="${(p.category||'').toLowerCase()}"
                     style="padding:9px 11px;border-bottom:1px solid #f8fafc;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
            <div style="display:flex;align-items:center;gap:7px;">
                <div style="flex:1;min-width:0;">
                    <div style="font-size:11px;display:flex;align-items:center;gap:5px;flex-wrap:wrap;">
                        <span style="font-weight:800;color:#0f172a;">${p.id}</span>
                        <span style="color:#1e293b;font-weight:600;">${p.name}</span>
                        ${p.category?`<span style="background:#fef9c3;color:#a16207;font-size:9px;padding:1px 6px;border-radius:7px;">🏷️ ${p.category}</span>`:''}
                        ${p.supplier?`<span style="background:#f0f9ff;color:#0891b2;font-size:9px;padding:1px 6px;border-radius:7px;border:1px solid #bae6fd;">🏢 ${p.supplier}</span>`:''}
                    </div>
                    <div style="font-size:10px;color:#94a3b8;margin-top:1px;">${unitsStr||'—'}${p.exportUnit?` <span style="color:#0369a1;">📤 ${p.exportUnit}</span>`:''}</div>
                </div>
                <div style="display:flex;gap:3px;flex-shrink:0;">
                    <button onclick="movePd(${i},-1)" style="background:#f1f5f9;color:#475569;border:none;width:24px;height:24px;border-radius:4px;cursor:pointer;font-size:10px;">↑</button>
                    <button onclick="movePd(${i},1)"  style="background:#f1f5f9;color:#475569;border:none;width:24px;height:24px;border-radius:4px;cursor:pointer;font-size:10px;">↓</button>
                    <button onclick="toggleEditPd(${i})" style="background:#dbeafe;color:#1d4ed8;border:none;width:24px;height:24px;border-radius:4px;cursor:pointer;font-size:10px;">✏️</button>
                    <button onclick="deletePd(${i})" style="background:#fee2e2;color:#ef4444;border:none;width:24px;height:24px;border-radius:4px;cursor:pointer;font-size:10px;">🗑️</button>
                </div>
            </div>
            <div id="pdEditArea_${i}" style="display:none;margin-top:8px;padding:12px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:8px;">
                    <div><div style="font-size:9px;color:#64748b;font-weight:700;margin-bottom:3px;">ชื่อสินค้า *</div><input id="pdEditName_${i}" value="${p.name}" style="width:100%;padding:7px 9px;border:1.5px solid #e2e8f0;border-radius:6px;font-size:11px;box-sizing:border-box;outline:none;font-family:inherit;"></div>
                    <div><div style="font-size:9px;color:#a16207;font-weight:700;margin-bottom:3px;">🏷️ หมวดหมู่</div><input id="pdEditCategory_${i}" value="${p.category||''}" list="categoryDatalist" style="width:100%;padding:7px 9px;border:1.5px solid #fde68a;border-radius:6px;font-size:11px;box-sizing:border-box;outline:none;font-family:inherit;"></div>
                    <div><div style="font-size:9px;color:#64748b;font-weight:700;margin-bottom:3px;">🏢 Supplier</div><input id="pdEditSupplier_${i}" value="${p.supplier||''}" style="width:100%;padding:7px 9px;border:1.5px solid #e2e8f0;border-radius:6px;font-size:11px;box-sizing:border-box;outline:none;font-family:inherit;"></div>
                    <div><div style="font-size:9px;color:#64748b;font-weight:700;margin-bottom:3px;">📦 Barcode</div><input id="pdEditBarcode_${i}" value="${p.barcode||''}" style="width:100%;padding:7px 9px;border:1.5px solid #e2e8f0;border-radius:6px;font-size:11px;box-sizing:border-box;outline:none;font-family:monospace;"></div>
                </div>
                <div style="background:white;border-radius:6px;padding:9px;border:1px solid #e2e8f0;margin-bottom:7px;">
                    <div style="font-size:9px;color:#7c3aed;font-weight:700;margin-bottom:6px;">📦 หน่วย</div>
                    ${[0,1,2].map(ui=>`<div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:5px;">
                        <input id="pdEditUnit${ui}_${i}" value="${units[ui]?.name||''}" placeholder="หน่วย ${ui+1}" style="padding:6px 8px;border:1.5px solid #e2e8f0;border-radius:5px;font-size:11px;font-family:inherit;outline:none;" onblur="refreshEditPdExportUnit(${i})">
                        ${ui<2?`<input id="pdEditRate${ui}_${i}" value="${units[ui]?.rate||''}" placeholder="อัตราแปลง" type="number" min="1" style="padding:6px 8px;border:1.5px solid #e2e8f0;border-radius:5px;font-size:11px;outline:none;">`:'<div></div>'}
                    </div>`).join('')}
                    <div style="display:flex;align-items:center;gap:6px;padding-top:6px;border-top:1px dashed #e2e8f0;">
                        <span style="font-size:9px;color:#0369a1;font-weight:700;white-space:nowrap;">📤 Export:</span>
                        <select id="pdEditExportUnit_${i}" style="flex:1;padding:5px 8px;border:1.5px solid #bae6fd;border-radius:5px;font-size:11px;color:#0369a1;font-weight:600;outline:none;background:#f0f9ff;">
                            ${units.map(u=>`<option value="${u.name}" ${p.exportUnit===u.name?'selected':''}>${u.name}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div style="display:flex;gap:6px;justify-content:flex-end;">
                    <button onclick="toggleEditPd(${i})" style="background:#f1f5f9;color:#475569;border:none;padding:7px 14px;border-radius:6px;cursor:pointer;font-size:11px;">ยกเลิก</button>
                    <button onclick="saveEditPd(${i})" style="background:#10b981;color:white;border:none;padding:7px 16px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:700;">💾 บันทึก</button>
                </div>
            </div>
        </div>`;}).join('');
};

window.movePd=function(i,dir){ const j=i+dir; if(j<0||j>=allProducts.length) return; [allProducts[i],allProducts[j]]=[allProducts[j],allProducts[i]]; saveConfig(); renderPdList(); renderMapping(); };
window.toggleEditPd=function(i){ const a=document.getElementById(`pdEditArea_${i}`); a.style.display=a.style.display==='none'?'block':'none'; };
window.saveEditPd=function(i){
    const name=document.getElementById(`pdEditName_${i}`)?.value.trim(); if(!name){toast('⚠️ กรุณาระบุชื่อสินค้า','#f59e0b');return;}
    const newUnits=[]; for(let ui=0;ui<3;ui++){ const un=document.getElementById(`pdEditUnit${ui}_${i}`)?.value.trim()||''; const ur=parseFloat(document.getElementById(`pdEditRate${ui}_${i}`)?.value)||0; if(un) newUnits.push({name:un,rate:ur}); }
    if(!newUnits.length){toast('⚠️ กรุณาระบุหน่วยอย่างน้อย 1 หน่วย','#f59e0b');return;}
    allProducts[i].name=name; allProducts[i].units=newUnits; allProducts[i].unit=newUnits[0]?.name||''; allProducts[i].subUnit=newUnits[1]?.name||'';
    allProducts[i].supplier=document.getElementById(`pdEditSupplier_${i}`)?.value.trim()||'';
    allProducts[i].barcode=document.getElementById(`pdEditBarcode_${i}`)?.value.trim()||'';
    allProducts[i].category=document.getElementById(`pdEditCategory_${i}`)?.value.trim()||'';
    allProducts[i].exportUnit=document.getElementById(`pdEditExportUnit_${i}`)?.value||newUnits[0]?.name||'';
    saveConfig(); renderPdList(); toast('✅ แก้ไขสินค้าเรียบร้อย','#059669');
};
window.refreshEditPdExportUnit=function(i){ const sel=document.getElementById(`pdEditExportUnit_${i}`); if(!sel) return; const cur=sel.value; const opts=[0,1,2].map(ui=>document.getElementById(`pdEditUnit${ui}_${i}`)?.value.trim()||'').filter(Boolean); sel.innerHTML=opts.map(u=>`<option value="${u}" ${u===cur?'selected':''}>${u}</option>`).join(''); };

window.toggleSortMode=function(){ const sc=document.getElementById('sortContainer'); const mc=document.getElementById('mappingContainer'); if(!sc||!mc) return; const on=sc.style.display==='none'; sc.style.display=on?'block':'none'; mc.style.display=on?'none':'grid'; const btn=document.getElementById('btnSortMode'); if(btn){btn.style.background=on?'#059669':'#7c3aed';btn.innerText=on?'✅ กำลังจัดลำดับ':'↕️ จัดลำดับ';} if(on) renderSortList(); };
window.renderSortList=function(){ const zone=document.getElementById('selectZoneMap')?.value||''; const ids=zoneProductMap[zone]||[]; const prods=ids.map(id=>allProducts.find(p=>p.id===id)).filter(Boolean); const c=document.getElementById('sortList'); if(!c) return;
    c.innerHTML=prods.map((p,i)=>`<div draggable="true" data-sort-id="${p.id}" ondragstart="onSortDragStart(event)" ondragover="onSortDragOver(event)" ondrop="onSortDrop(event)" ondragend="onSortDragEnd(event)"
        style="display:flex;align-items:center;gap:9px;padding:9px 12px;background:white;border-radius:8px;border:1px solid #e2e8f0;cursor:grab;user-select:none;">
        <span style="color:#cbd5e1;font-size:14px;">⠿</span><span style="font-size:10px;color:#94a3b8;min-width:20px;">${i+1}.</span>
        <span style="font-weight:700;font-size:11px;">${p.id}</span><span style="font-size:11px;color:#475569;">${p.name}</span></div>`).join('');
};
let _dragSrcEl=null;
window.onSortDragStart=function(e){_dragSrcEl=e.currentTarget;e.currentTarget.style.opacity='0.4';};
window.onSortDragOver=function(e){e.preventDefault();e.currentTarget.style.background='#eff6ff';};
window.onSortDrop=function(e){ e.preventDefault();e.currentTarget.style.background='white'; if(!_dragSrcEl||_dragSrcEl===e.currentTarget) return; const list=document.getElementById('sortList'); const ch=[...list.children]; const from=ch.indexOf(_dragSrcEl); const to=ch.indexOf(e.currentTarget); if(from<to)list.insertBefore(_dragSrcEl,e.currentTarget.nextSibling); else list.insertBefore(_dragSrcEl,e.currentTarget); };
window.onSortDragEnd=function(e){e.currentTarget.style.opacity='1';_dragSrcEl=null;document.querySelectorAll('#sortList > div').forEach(d=>d.style.background='white');};
window.saveSortOrder=function(){ const zone=document.getElementById('selectZoneMap')?.value||''; const newOrder=[...document.querySelectorAll('#sortList [data-sort-id]')].map(el=>el.dataset.sortId); zoneProductMap[zone]=newOrder; saveConfig(); toast('✅ บันทึกลำดับเรียบร้อย','#059669'); toggleSortMode(); };

window.renderMapping=function(){
    const zone=document.getElementById('selectZoneMap')?.value||''; const mapped=new Set(zoneProductMap[zone]||[]); const c=document.getElementById('mappingContainer'); if(!c) return;
    c.innerHTML=allProducts.map(p=>{ const chk=mapped.has(p.id); return `<label style="display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:9px;border:1.5px solid ${chk?'#059669':'#e2e8f0'};background:${chk?'#f0fdf4':'white'};cursor:pointer;transition:all .15s;"
        onclick="togglePdMapping('${zone}','${p.id}');this.style.borderColor=document.getElementById('map_${p.id}').checked?'#059669':'#e2e8f0';this.style.background=document.getElementById('map_${p.id}').checked?'#f0fdf4':'white'">
        <input type="checkbox" id="map_${p.id}" ${chk?'checked':''} style="width:15px;height:15px;accent-color:#059669;cursor:pointer;flex-shrink:0;" onclick="event.stopPropagation();togglePdMapping('${zone}','${p.id}')">
        <div style="min-width:0;"><div style="font-weight:700;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.id}</div>
            <div style="font-size:10px;color:#475569;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.name}</div>
            ${p.category?`<span style="font-size:8px;color:#a16207;background:#fef9c3;padding:1px 4px;border-radius:4px;">🏷️ ${p.category}</span>`:''}
        </div></label>`; }).join('');
};
window.togglePdMapping=function(z,id){ if(!zoneProductMap[z])zoneProductMap[z]=[]; const i=zoneProductMap[z].indexOf(id); if(i>-1)zoneProductMap[z].splice(i,1); else zoneProductMap[z].push(id); saveConfig(); };
window.selectAllMapping=function(checked){ const zone=document.getElementById('selectZoneMap')?.value||''; zoneProductMap[zone]=checked?allProducts.map(p=>p.id):[]; saveConfig(); renderMapping(); };
window.filterMapping=function(q){ q=(q||'').toLowerCase(); document.querySelectorAll('#mappingContainer label').forEach(el=>{ el.style.display=(!q||el.innerText.toLowerCase().includes(q))?'':'none'; }); };

window.addWh=function(){ const n=document.getElementById('newWhName')?.value.trim(); if(!n) return; if(warehouseList.includes(n)){toast('⚠️ ชื่อ Zone นี้มีอยู่แล้ว','#c2410c');return;} warehouseList.push(n); document.getElementById('newWhName').value=''; saveConfig(); renderWhList(); toast(`✅ เพิ่ม Zone "${n}"`,'#059669'); };
window.deleteWh=function(i){ if(!confirm(`ยืนยันลบ Zone "${warehouseList[i]}"?`)) return; warehouseList.splice(i,1); saveConfig(); renderWhList(); };

window.addPd=function(){
    const id=document.getElementById('newPdId')?.value.trim(); const name=document.getElementById('newPdName')?.value.trim();
    const u1=document.getElementById('newPdUnit1')?.value.trim(); const u2=document.getElementById('newPdUnit2')?.value.trim(); const u3=document.getElementById('newPdUnit3')?.value.trim();
    const r1=parseFloat(document.getElementById('newPdRate1')?.value)||0; const r2=parseFloat(document.getElementById('newPdRate2')?.value)||0;
    let finalId=id;
    if(!finalId){ const ex=allProducts.map(p=>p.id).filter(x=>x.startsWith('ITEM-')); const nums=ex.map(x=>parseInt(x.replace('ITEM-',''))||0); finalId='ITEM-'+String((nums.length?Math.max(...nums):0)+1).padStart(3,'0'); }
    if(!name||!u1){toast('⚠️ กรุณากรอกชื่อสินค้า และหน่วยที่ 1','#c2410c');return;}
    if(allProducts.some(p=>p.id===finalId)){toast(`❌ รหัส "${finalId}" ซ้ำ`,'#c2410c');return;}
    if(allProducts.some(p=>p.name.trim().toLowerCase()===name.toLowerCase())){toast(`❌ ชื่อ "${name}" ซ้ำ`,'#c2410c');return;}
    const units=[]; if(u1)units.push({name:u1,rate:r1||0}); if(u2)units.push({name:u2,rate:r2||0}); if(u3)units.push({name:u3,rate:0});
    const supplier=document.getElementById('newPdSupplier')?.value.trim()||''; const barcode=document.getElementById('newPdBarcode')?.value.trim()||''; const category=document.getElementById('newPdCategory')?.value.trim()||''; const exportUnit=document.getElementById('newPdExportUnit')?.value||u1;
    allProducts.push({id:finalId,name,units,supplier,barcode,category,exportUnit,unit:u1,subUnit:u2||''});
    saveConfig(); renderPdList(); renderMapping();
    ['newPdId','newPdName','newPdSupplier','newPdBarcode','newPdCategory','newPdUnit1','newPdRate1','newPdUnit2','newPdRate2','newPdUnit3'].forEach(x=>{const el=document.getElementById(x);if(el)el.value='';});
    const euEl=document.getElementById('newPdExportUnit'); if(euEl) euEl.innerHTML='<option value="">— กรอกหน่วยก่อน —</option>';
    toast(`✅ เพิ่มสินค้า [${finalId}]`,'#059669');
    const badge=document.getElementById('pdTotalBadge'); if(badge) badge.textContent=`${allProducts.length} รายการ`;
};
window.deletePd=function(i){if(confirm('ยืนยันลบสินค้า?')){allProducts.splice(i,1);saveConfig();renderPdList();renderMapping();}};
window.syncNewPdExportUnit=function(){};
window.refreshNewPdExportUnitOpts=function(){ const sel=document.getElementById('newPdExportUnit'); if(!sel) return; const cur=sel.value; const opts=['newPdUnit1','newPdUnit2','newPdUnit3'].map(id=>document.getElementById(id)?.value.trim()||'').filter(Boolean); sel.innerHTML=opts.length?opts.map(u=>`<option value="${u}" ${u===cur?'selected':''}>${u}</option>`).join(''):'<option value="">— กรอกหน่วยก่อน —</option>'; };

window.renderCategoryChips=function(){
    const c=document.getElementById('categoryChipList'); if(!c) return;
    c.innerHTML=(productCategories||[]).length?(productCategories||[]).map((cat,i)=>`<span style="display:inline-flex;align-items:center;gap:4px;background:#fef9c3;color:#a16207;border:1px solid #fde68a;padding:3px 9px;border-radius:16px;font-size:11px;font-weight:600;">🏷️ ${cat}<button onclick="deleteCategory(${i})" style="background:none;border:none;cursor:pointer;color:#d97706;font-size:11px;padding:0 0 0 2px;line-height:1;" title="ลบ">✕</button></span>`).join(''):`<span style="color:#94a3b8;font-size:11px;">ยังไม่มีหมวดหมู่</span>`;
    document.querySelectorAll('#categoryDatalist').forEach(dl=>{ dl.innerHTML=(productCategories||[]).map(c=>`<option value="${c}">`).join(''); });
    const cf=document.getElementById('pdCatFilter'); if(cf){ const cur=cf.value; cf.innerHTML=`<option value="">— ทุกหมวด —</option>${(productCategories||[]).map(c=>`<option value="${c}" ${c===cur?'selected':''}>${c}</option>`).join('')}<option value="__none__">⚠️ ยังไม่มีหมวด</option>`; }
};
window.addCategory=function(){ const inp=document.getElementById('newCategoryInput'); const val=inp?.value.trim(); if(!val) return; if((productCategories||[]).includes(val)){toast('⚠️ หมวดหมู่นี้มีอยู่แล้ว','#c2410c');return;} productCategories.push(val); window.productCategories=productCategories; if(inp) inp.value=''; saveConfig(); renderCategoryChips(); toast(`✅ เพิ่มหมวดหมู่ "${val}"`,'#059669'); };
window.deleteCategory=function(i){ const name=productCategories[i]; if(!confirm(`ลบหมวดหมู่ "${name}"?`)) return; productCategories.splice(i,1); window.productCategories=productCategories; saveConfig(); renderCategoryChips(); toast('🗑️ ลบหมวดหมู่','#64748b'); };

// ─── Import Products ──────────────────────────────────────────────────
window.openImportProducts=function(){
    document.getElementById('dashboardView').classList.add('hidden');
    const c=document.getElementById('toolAppContainer'); c.classList.remove('hidden');
    c.innerHTML=`
    <div class="tool-header no-print"><h2>📥 Import สินค้าจาก Excel</h2>
        <div style="display:flex;gap:8px;">
            <button onclick="openWarehouseManager('init')" style="background:#7c3aed;color:white;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;">← กลับ</button>
            <button onclick="closeTool()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;">✕ ปิด</button>
        </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:22px;">
        <div style="background:white;border-radius:12px;padding:22px;border:2px solid #e2e8f0;">
            <div style="font-size:14px;font-weight:800;color:#0f172a;margin-bottom:7px;">① ดาวน์โหลด Template</div>
            <div style="background:#f8fafc;border-radius:7px;padding:10px;margin-bottom:12px;font-size:11px;color:#475569;line-height:1.8;"><b>คอลัมน์:</b><br>
                <span style="color:#ef4444;">*</span> ProductCode, <span style="color:#ef4444;">*</span> ProductName<br>
                Category, Supplier, Barcode<br>Unit1/Rate1/Unit2/Rate2/Unit3, ExportUnit</div>
            <button onclick="downloadImportTemplate()" style="width:100%;background:#0f172a;color:white;border:none;padding:10px;border-radius:8px;cursor:pointer;font-weight:700;font-size:12px;">⬇️ ดาวน์โหลด Template.xlsx</button>
        </div>
        <div style="background:white;border-radius:12px;padding:22px;border:2px solid #e2e8f0;">
            <div style="font-size:14px;font-weight:800;color:#0f172a;margin-bottom:7px;">② อัปโหลด Excel</div>
            <div style="border:2px dashed #e2e8f0;border-radius:10px;padding:28px;text-align:center;cursor:pointer;transition:all .2s;margin-bottom:10px;"
                onclick="document.getElementById('importFile').click()"
                ondragover="event.preventDefault();this.style.borderColor='#3b82f6';this.style.background='#eff6ff'"
                ondragleave="this.style.borderColor='#e2e8f0';this.style.background='white'"
                ondrop="event.preventDefault();this.style.borderColor='#e2e8f0';this.style.background='white';handleImportDrop(event)"
                onmouseover="this.style.borderColor='#94a3b8'" onmouseout="this.style.borderColor='#e2e8f0'">
                <div style="font-size:36px;margin-bottom:7px;">📂</div>
                <div style="color:#64748b;font-size:12px;font-weight:600;">คลิกหรือลากไฟล์มาวาง</div>
                <div style="color:#94a3b8;font-size:10px;margin-top:3px;">.xlsx .xls .csv</div>
                <input type="file" id="importFile" accept=".xlsx,.xls,.csv" style="display:none" onchange="handleImportFile(this)">
            </div>
            <div id="importFileLabel" style="font-size:11px;color:#94a3b8;text-align:center;"></div>
        </div>
    </div>
    <div id="importPreview" style="display:none;background:white;border-radius:12px;padding:22px;border:1px solid #e2e8f0;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
            <h4 style="margin:0;">🔍 Preview ก่อน Import</h4>
            <div style="display:flex;gap:8px;align-items:center;">
                <label style="display:flex;align-items:center;gap:5px;font-size:11px;color:#64748b;cursor:pointer;"><input type="checkbox" id="importOverwriteChk" style="width:14px;height:14px;accent-color:#3b82f6;">Overwrite ซ้ำ</label>
                <button onclick="confirmImportProducts()" style="background:#10b981;color:white;border:none;padding:8px 18px;border-radius:7px;cursor:pointer;font-weight:700;font-size:12px;">✅ ยืนยัน Import</button>
                <button onclick="document.getElementById('importPreview').style.display='none'" style="background:#f1f5f9;color:#475569;border:none;padding:8px 12px;border-radius:7px;cursor:pointer;font-size:12px;">ยกเลิก</button>
            </div>
        </div>
        <div id="importPreviewTable"></div>
    </div>`;
};

window.downloadImportTemplate=function(){
    const rows=[['ProductCode','ProductName','Category','Supplier','Barcode','Unit1','Rate1','Unit2','Rate2','Unit3','ExportUnit'],['SM000001','ตัวอย่างสินค้า A','เครื่องดื่ม','Supplier A','','ลัง',12,'ถุง',500,'กรัม','ถุง'],['SM000002','ตัวอย่างสินค้า B','อาหารแห้ง','','','กล่อง',24,'ชิ้น','','','ชิ้น'],['SM000003','ตัวอย่างสินค้า C','','','','กระป๋อง','','','','','กระป๋อง']];
    const ws=XLSX.utils.aoa_to_sheet(rows); ws['!cols']=[{wch:14},{wch:35},{wch:12},{wch:18},{wch:14},{wch:10},{wch:7},{wch:10},{wch:7},{wch:10},{wch:12}];
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Products'); XLSX.writeFile(wb,'TingTing_Import_Template.xlsx');
};
window.handleImportDrop=function(e){const f=e.dataTransfer.files[0];if(f)processImportFile(f);};
window.handleImportFile=function(inp){if(inp.files[0])processImportFile(inp.files[0]);};
window._importData=[];
window.processImportFile=function(file){
    document.getElementById('importFileLabel').innerText=`📄 ${file.name}`;
    const reader=new FileReader(); reader.onload=e=>{
        const wb=XLSX.read(e.target.result,{type:'array'}); const ws=wb.Sheets[wb.SheetNames[0]]; const data=XLSX.utils.sheet_to_json(ws,{defval:''});
        if(!data.length){toast('❌ ไม่พบข้อมูล','#c2410c');return;}
        window._importData=data.map(row=>({id:String(row.ProductCode||'').trim(),name:String(row.ProductName||'').trim(),category:String(row.Category||'').trim(),supplier:String(row.Supplier||'').trim(),barcode:String(row.Barcode||'').trim(),exportUnit:String(row.ExportUnit||row.Unit1||'').trim(),
            units:[row.Unit1?{name:String(row.Unit1).trim(),rate:parseFloat(row.Rate1)||0}:null,row.Unit2?{name:String(row.Unit2).trim(),rate:parseFloat(row.Rate2)||0}:null,row.Unit3?{name:String(row.Unit3).trim(),rate:0}:null].filter(u=>u&&u.name)})).filter(p=>p.id&&p.name);
        renderImportPreview();
    }; reader.readAsArrayBuffer(file);
};
window.renderImportPreview=function(){
    const data=window._importData; const existing=new Set(allProducts.map(p=>p.id)); const preview=document.getElementById('importPreview'); const table=document.getElementById('importPreviewTable'); if(!preview||!table) return;
    preview.style.display='block';
    const nc=data.filter(p=>!existing.has(p.id)).length; const dc=data.filter(p=>existing.has(p.id)).length;
    table.innerHTML=`<div style="display:flex;gap:8px;margin-bottom:12px;"><div style="background:#f0fdf4;border:1px solid #a7f3d0;border-radius:7px;padding:7px 14px;font-size:12px;color:#059669;font-weight:700;">✅ ใหม่ ${nc}</div>${dc?`<div style="background:#fff7ed;border:1px solid #fdba74;border-radius:7px;padding:7px 14px;font-size:12px;color:#c2410c;font-weight:700;">⚠️ ซ้ำ ${dc}</div>`:''}</div>
    <div style="max-height:300px;overflow-y:auto;border:1px solid #f1f5f9;border-radius:9px;"><table style="width:100%;border-collapse:collapse;">
        <thead style="position:sticky;top:0;background:#f8fafc;z-index:1;"><tr>${['สถานะ','รหัส','ชื่อสินค้า','หมวด','หน่วย'].map(h=>`<th style="padding:8px 9px;font-size:10px;color:#64748b;text-align:left;border-bottom:1px solid #e2e8f0;">${h}</th>`).join('')}</tr></thead>
        <tbody>${data.map(p=>{ const isDup=existing.has(p.id); const us=p.units.map((u,i)=>u.name+(i<p.units.length-1&&u.rate?`(×${u.rate})`:'') ).join(' → ');
            return `<tr style="border-top:1px solid #f8fafc;${isDup?'opacity:0.55':''}"><td style="padding:7px 9px;">${isDup?'⚠️ ซ้ำ':'🆕 ใหม่'}</td><td style="padding:7px 9px;font-weight:700;font-size:11px;">${p.id}</td><td style="padding:7px 9px;font-size:11px;">${p.name}</td><td style="padding:7px 9px;font-size:10px;color:#a16207;">${p.category||'—'}</td><td style="padding:7px 9px;font-size:10px;color:#64748b;">${us||'—'}</td></tr>`;}).join('')}
        </tbody></table></div>`;
};
window.confirmImportProducts=async function(){
    const data=window._importData; if(!data?.length){toast('❌ ไม่มีข้อมูล','#c2410c');return;}
    const overwrite=document.getElementById('importOverwriteChk')?.checked; const existing=new Map(allProducts.map((p,i)=>[p.id,i]));
    let added=0,updated=0;
    data.forEach(p=>{ if(existing.has(p.id)){if(overwrite){allProducts[existing.get(p.id)]={...allProducts[existing.get(p.id)],...p};updated++;}} else{allProducts.push({...p,unit:p.units[0]?.name||'',subUnit:p.units[1]?.name||''});added++;} });
    if(!added&&!updated){toast('⚠️ ไม่มีสินค้าที่จะ import','#c2410c');return;}
    if(!confirm(`ยืนยัน Import?\nใหม่: ${added}${overwrite?` อัปเดต: ${updated}`:''} รายการ`)) return;
    await saveConfig(); toast(`✅ Import สำเร็จ — ใหม่ ${added}${overwrite?` อัปเดต ${updated}`:''} รายการ`,'#059669');
    document.getElementById('importPreview').style.display='none'; document.getElementById('importFileLabel').innerText=''; window._importData=[];
};

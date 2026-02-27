// warehouse-settings.js — TTGPlus (extracted)

        // ---- WAREHOUSE MANAGER (เพิ่ม edit + subUnit) ----
        window.openWarehouseManager=function(){
            document.getElementById('dashboardView').classList.add('hidden');
            const c=document.getElementById('toolAppContainer');c.classList.remove('hidden');
            c.innerHTML=`<div class="tool-header"><h2>⚙️ ตั้งค่าคลังและสินค้าหลัก</h2><button onclick="closeTool()">✕ ปิด</button></div>
            <div style="display:flex;gap:10px;margin-bottom:20px;">
                <button onclick="backupConfig()" style="background:#0f172a;color:white;border:none;padding:10px 20px;border-radius:10px;cursor:pointer;font-weight:bold;display:flex;align-items:center;gap:8px;">💾 Backup Config</button>
                <label style="background:#0891b2;color:white;border:none;padding:10px 20px;border-radius:10px;cursor:pointer;font-weight:bold;display:flex;align-items:center;gap:8px;">
                    📂 Restore Config<input type="file" accept=".json" onchange="restoreConfig(this)" style="display:none;">
                </label>
                <small style="color:#94a3b8;align-self:center;font-size:11px;">สำรอง/กู้คืน คลัง, สินค้า, mapping ทั้งหมด</small>
            </div>

            <!-- Parent Warehouse Groups -->
            <div style="background:white;padding:24px;border-radius:15px;border:2px solid #ddd6fe;margin-bottom:25px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
                    <div>
                        <h4 style="margin:0 0 4px;color:#5b21b6;">🏭 คลังหลัก (Parent Warehouse Groups)</h4>
                        <small style="color:#94a3b8;">ผูก Zone ย่อยหลายห้องเข้ากับคลังหลัก → เมื่อ Export จะรวมยอดสินค้าชื่อเดียวกันให้อัตโนมัติ</small>
                    </div>
                    <button onclick="openAddParentWhForm()" style="background:#7c3aed;color:white;border:none;padding:10px 20px;border-radius:10px;cursor:pointer;font-weight:bold;font-size:13px;">+ เพิ่มคลังหลัก</button>
                </div>
                <div id="parentWhContainer"></div>
                <div id="parentWhFormArea"></div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1.2fr;gap:25px;">
                <div style="background:white;padding:20px;border-radius:15px;border:1px solid #e2e8f0;">
                    <h4>📦 คลังสินค้า (Zones)</h4>
                    <div style="display:flex;gap:8px;margin-bottom:15px;">
                        <input type="text" id="newWhName" placeholder="เพิ่มชื่อคลัง/โซนใหม่" style="flex:1;padding:10px;border-radius:8px;border:1px solid #ddd;">
                        <button onclick="addWh()" style="background:var(--success);color:white;padding:10px 20px;border:none;border-radius:8px;cursor:pointer;">เพิ่ม</button>
                    </div>
                    <div id="whListContainer"></div>
                </div>
                <div style="background:white;padding:20px;border-radius:15px;border:1px solid #e2e8f0;">
                    <h4>🍎 สินค้าหลัก</h4>
                    <div style="background:#f8fafc;border-radius:10px;padding:12px 14px;margin-bottom:14px;border:1px solid #e2e8f0;">
                        <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">🏷️ จัดการหมวดหมู่สินค้า</div>
                        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;" id="categoryChipList"></div>
                        <div style="display:flex;gap:6px;">
                            <input type="text" id="newCategoryInput" placeholder="ชื่อหมวดหมู่ใหม่..." maxlength="30"
                                style="flex:1;padding:7px 10px;border:1px solid #e2e8f0;border-radius:7px;font-size:13px;outline:none;"
                                onkeydown="if(event.key==='Enter')addCategory()">
                            <button onclick="addCategory()" style="background:#06b6d4;color:white;border:none;padding:7px 14px;border-radius:7px;cursor:pointer;font-size:13px;font-weight:bold;">+ เพิ่ม</button>
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
                        <input type="text" id="newPdId" placeholder="รหัส SKU (เว้นว่าง = Auto ITEM-001)" style="padding:10px;border:1px solid #ddd;border-radius:8px;">
                        <input type="text" id="newPdName" placeholder="ชื่อสินค้า" style="padding:10px;border:1px solid #ddd;border-radius:8px;">
                        <input type="text" id="newPdSupplier" placeholder="🏢 Supplier / ผู้ส่ง (ถ้ามี)" style="padding:10px;border:1px solid #ddd;border-radius:8px;">
                        <input type="text" id="newPdCategory" placeholder="🏷️ หมวดหมู่" list="categoryDatalist" style="padding:10px;border:1px solid #ddd;border-radius:8px;">
                        <datalist id="categoryDatalist"></datalist>
                        <input type="text" id="newPdBarcode" placeholder="📦 Barcode (ไว้สำหรับอนาคต)" style="padding:10px;border:1px solid #ddd;border-radius:8px;grid-column:span 2;font-family:monospace;">
                    </div>
                    <div style="background:#f8fafc;border-radius:8px;padding:10px;margin-bottom:10px;border:1px solid #e2e8f0;">
                        <div style="font-size:11px;color:#64748b;font-weight:bold;margin-bottom:8px;">หน่วยและอัตราแปลง (สูงสุด 3 หน่วย)</div>
                        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;align-items:center;margin-bottom:6px;">
                            <input type="text" id="newPdUnit1" placeholder="หน่วยที่ 1 (ใหญ่สุด) เช่น ลัง" style="padding:8px;border:1px solid #ddd;border-radius:6px;font-size:12px;" onblur="refreshNewPdExportUnitOpts()">
                            <input type="number" id="newPdRate1" placeholder="1 ลัง = ? ถุง" min="1" style="padding:8px;border:1px solid #ddd;border-radius:6px;font-size:12px;">
                            <small style="color:#94a3b8;">× หน่วยที่ 2</small>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;align-items:center;margin-bottom:6px;">
                            <input type="text" id="newPdUnit2" placeholder="หน่วยที่ 2 (กลาง) เช่น ถุง" style="padding:8px;border:1px solid #ddd;border-radius:6px;font-size:12px;" onblur="refreshNewPdExportUnitOpts()">
                            <input type="number" id="newPdRate2" placeholder="1 ถุง = ? กรัม" min="1" style="padding:8px;border:1px solid #ddd;border-radius:6px;font-size:12px;">
                            <small style="color:#94a3b8;">× หน่วยที่ 3</small>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;align-items:center;">
                            <input type="text" id="newPdUnit3" placeholder="หน่วยที่ 3 (เล็กสุด) เช่น กรัม" style="padding:8px;border:1px solid #ddd;border-radius:6px;font-size:12px;" onblur="refreshNewPdExportUnitOpts()">
                            <div></div><small style="color:#94a3b8;">หน่วยสุดท้าย</small>
                        </div>
                        <div style="margin-top:10px;padding-top:10px;border-top:1px dashed #e2e8f0;">
                            <div style="font-size:10px;color:#0369a1;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:6px;">📤 หน่วยสำหรับ Export สิ้นเดือน</div>
                            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;" id="newPdExportUnitWrap">
                                <label style="font-size:11px;color:#64748b;">เลือกหน่วยที่จะ export:</label>
                                <select id="newPdExportUnit" onchange="syncNewPdExportUnit(this)"
                                    style="padding:7px 10px;border:1.5px solid #bae6fd;border-radius:7px;font-size:12px;color:#0369a1;font-weight:600;outline:none;background:#f0f9ff;min-width:120px;">
                                    <option value="">— ยังไม่ได้ตั้งค่าหน่วย —</option>
                                </select>
                                <small style="color:#94a3b8;font-size:10px;">จำนวนจะถูก convert อัตโนมัติเวลา export</small>
                            </div>
                        </div>
                    </div>
                    <button onclick="addPd()" style="width:100%;background:var(--info);color:white;padding:12px;border-radius:8px;border:none;cursor:pointer;font-weight:bold;">+ บันทึกสินค้า</button>
                    <div style="margin-top:12px;border-top:1px solid #eee;padding-top:12px;">
                        <div style="position:relative;margin-bottom:10px;">
                            <input type="text" id="pdSearchInput" placeholder="🔍 ค้นหาสินค้า (รหัส / ชื่อ / Supplier)..." oninput="filterPdList(this.value)"
                                style="width:100%;padding:10px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:13px;box-sizing:border-box;outline:none;transition:border .2s;font-family:inherit;"
                                onfocus="this.style.borderColor='var(--primary-dark)'" onblur="this.style.borderColor='#e2e8f0'">
                            <span id="pdSearchCount" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);font-size:11px;color:#94a3b8;"></span>
                        </div>
                        <div id="pdMasterContainer" style="max-height:500px;overflow-y:auto;"></div>
                    </div>
                </div>
            </div>
            <div style="margin-top:25px;background:white;padding:25px;border-radius:15px;border:1px solid #e2e8f0;">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
                    <div>
                        <h4 style="margin:0 0 4px;">🔗 จับคู่สินค้าเข้าสู่โซน</h4>
                        <small style="color:#94a3b8;">เลือกโซน → ค้นหาสินค้า → เลือก checkbox → บันทึก</small>
                    </div>
                    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                        <select id="selectZoneMap" onchange="renderMapping();renderMinMaxTable()" style="padding:10px;border-radius:8px;min-width:200px;border:2px solid var(--primary-dark);font-weight:bold;"></select>
                        <button onclick="selectAllMapping(true)" style="background:#10b981;color:white;border:none;padding:9px 16px;border-radius:8px;cursor:pointer;font-weight:bold;font-size:12px;">✅ เลือกทั้งหมด</button>
                        <button onclick="toggleSortMode()" id="btnSortMode" style="background:#7c3aed;color:white;border:none;padding:9px 16px;border-radius:8px;cursor:pointer;font-weight:bold;font-size:12px;">↕️ จัดลำดับ</button>
                        <button onclick="selectAllMapping(false)" style="background:#ef4444;color:white;border:none;padding:9px 16px;border-radius:8px;cursor:pointer;font-weight:bold;font-size:12px;">❌ ยกเลิกทั้งหมด</button>
                    </div>
                </div>
                <input type="text" id="mappingSearch" placeholder="🔍 ค้นหาสินค้า (รหัส / ชื่อ)..." oninput="filterMapping(this.value)"
                    style="width:100%;padding:10px 16px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box;outline:none;margin-bottom:14px;transition:border .2s;"
                    onfocus="this.style.borderColor='var(--primary-dark)'" onblur="this.style.borderColor='#e2e8f0'">
                <div id="mappingContainer" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;max-height:360px;overflow-y:auto;"></div>
                <div id="sortContainer" style="display:none;margin-top:14px;">
                    <div style="font-size:12px;color:#7c3aed;font-weight:bold;margin-bottom:8px;">↕️ ลากแถบซ้ายเพื่อเรียงลำดับ — ลำดับนี้จะใช้ในใบนับสต๊อกและรายงานทั้งหมด</div>
                    <div id="sortList" style="display:flex;flex-direction:column;gap:6px;"></div>
                    <button onclick="saveSortOrder()" style="margin-top:12px;background:#7c3aed;color:white;border:none;padding:10px 24px;border-radius:8px;cursor:pointer;font-weight:bold;">💾 บันทึกลำดับ</button>
                </div>
            </div>
            <div style="margin-top:25px;background:white;padding:25px;border-radius:15px;border:1px solid #e2e8f0;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <div>
                        <h4 style="margin:0;">📊 กำหนด Min / Max สต๊อกต่อคลัง</h4>
                        <small style="color:#94a3b8;">Min = ยอดต่ำสุดที่ต้องมี | Max = ยอดเป้าหมาย | <b style="color:var(--info);">ค่าแตกต่างกันได้ทุกคลัง — เลือกคลังแล้วกรอก จากนั้นบันทึกก่อนเปลี่ยนคลัง</b></small>
                    </div>
                    <button onclick="saveAllMinMax()" style="background:var(--success);color:white;border:none;padding:10px 24px;border-radius:10px;cursor:pointer;font-weight:bold;">💾 บันทึก Min/Max คลังนี้</button>
                </div>
                <!-- zone tabs -->
                <div id="minMaxZoneTabs" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #f1f5f9;"></div>
                <div id="minMaxZoneLabel" style="font-size:13px;color:#64748b;margin-bottom:10px;"></div>
                <div id="minMaxContainer"></div>
            </div>`;
            renderWhList(); renderPdList(); renderCategoryChips();
            document.getElementById('selectZoneMap').innerHTML=warehouseList.map(w=>`<option value="${w}">${w}</option>`).join('');
            renderMapping();
            renderMinMaxTable();
            renderParentWhList();
        };

        // ======== PARENT WAREHOUSE MANAGEMENT ========
        window.renderParentWhList = function() {
            const c = document.getElementById('parentWhContainer'); if(!c) return;
            // อ่านจาก window.warehouseGroups เสมอ — external scripts อัปเดตตรงนี้
            const wg = window.warehouseGroups || {};
            const groups = Object.entries(wg).filter(([k])=>k!=='_whnames');
            if(!groups.length) {
                c.innerHTML = `<div style="text-align:center;padding:30px;color:#94a3b8;font-size:13px;border:2px dashed #e2e8f0;border-radius:12px;">
                    <div style="font-size:28px;margin-bottom:8px;">🏭</div>
                    ยังไม่มีคลังหลัก — กด <b style="color:#7c3aed;">+ เพิ่มคลังหลัก</b> เพื่อเริ่มผูก Zone ย่อย
                </div>`;
                return;
            }
            const colorMap = {'WHRM':'#7c3aed','WHPD':'#0891b2','BT':'#f59e0b','WH':'#059669'};
            c.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;">
            ${groups.map(([parentId, zones]) => {
                const zoneList = Array.isArray(zones) ? zones : [];
                const color = Object.entries(colorMap).find(([k])=>parentId.toUpperCase().startsWith(k))?.[1]||'#64748b';
                const displayName = (wg._whnames||{})[parentId]||'';
                // นับสินค้ารวมทุก zone
                const skuSet = new Set();
                zoneList.forEach(z=>(window.zoneProductMap?.[z]||[]).forEach(id=>skuSet.add(id)));
                return \`<div style="background:white;border-radius:12px;border:2px solid \${color}20;padding:18px;box-shadow:0 2px 8px \${color}10;">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;">
                        <div>
                            <div style="font-size:15px;font-weight:800;color:\${color};">🏭 \${parentId}</div>
                            \${displayName?`<div style="font-size:12px;color:#475569;font-weight:600;margin-top:2px;">\${displayName}</div>`:''}
                            <div style="display:flex;gap:8px;margin-top:6px;">
                                <span style="font-size:11px;background:\${color}12;color:\${color};padding:2px 9px;border-radius:10px;font-weight:700;">📦 \${zoneList.length} Zone</span>
                                \${skuSet.size?`<span style="font-size:11px;background:#f0fdf4;color:#059669;padding:2px 9px;border-radius:10px;font-weight:700;">🍎 \${skuSet.size} SKU</span>`:''}
                            </div>
                        </div>
                        <div style="display:flex;gap:5px;flex-shrink:0;">
                            <button onclick="openEditParentWhForm('\${parentId}')"
                                style="background:#f1f5f9;border:1px solid #e2e8f0;padding:5px 10px;border-radius:7px;cursor:pointer;font-size:12px;font-weight:600;">✏️ แก้</button>
                            <button onclick="deleteParentWh('\${parentId}')"
                                style="background:#fef2f2;border:1px solid #fee2e2;padding:5px 10px;border-radius:7px;cursor:pointer;font-size:12px;color:#ef4444;">🗑️</button>
                        </div>
                    </div>
                    <div style="border-top:1px solid #f1f5f9;padding-top:10px;">
                        <div style="font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:7px;">Zone ที่ผูกอยู่</div>
                        <div style="display:flex;flex-wrap:wrap;gap:5px;">
                            \${zoneList.length?zoneList.map(z=>{
                                const cnt=(window.zoneProductMap?.[z]||[]).length;
                                return \`<span style="background:\${color}10;color:\${color};font-size:11px;padding:4px 10px;border-radius:20px;border:1px solid \${color}25;font-weight:600;">\${z}\${cnt?` <span style="opacity:.65">(\${cnt})</span>`:''}</span>\`;
                            }).join(''):'<span style="color:#cbd5e1;font-size:12px;font-style:italic;">ยังไม่มี Zone</span>'}
                        </div>
                    </div>
                </div>\`;
            }).join('')}
            </div>`;
        };

        window.openAddParentWhForm = function(editId) {
            const wg = window.warehouseGroups || {};
            const existing = editId ? wg[editId] : null;
            const area = document.getElementById('parentWhFormArea'); if(!area) return;
            const allZones = warehouseList;
            area.innerHTML = `
            <div style="margin-top:16px;background:#f5f3ff;border:1.5px solid #ddd6fe;border-radius:12px;padding:20px;">
                <h4 style="margin:0 0 14px;color:#5b21b6;">${editId?'✏️ แก้ไข':'➕ สร้าง'}คลังหลัก</h4>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
                    <div>
                        <label style="font-size:11px;font-weight:700;color:#5b21b6;display:block;margin-bottom:4px;">รหัสคลังหลัก <span style="color:red;">*</span></label>
                        <input id="pwh_id" value="${editId||''}" placeholder="เช่น WHRM01, WHPD01" ${editId?'readonly':''}
                            style="width:100%;padding:9px 12px;border:1.5px solid #ddd6fe;border-radius:8px;font-size:13px;font-weight:700;box-sizing:border-box;outline:none;font-family:inherit;${editId?'background:#f1f5f9;color:#64748b;':''}">
                    </div>
                    <div>
                        <label style="font-size:11px;font-weight:700;color:#5b21b6;display:block;margin-bottom:4px;">ชื่อแสดง (ถ้ามี)</label>
                        <input id="pwh_name" value="${(wg._whnames||{})[editId]||''}" placeholder="เช่น คลังวัตถุดิบ 1"
                            style="width:100%;padding:9px 12px;border:1.5px solid #ddd6fe;border-radius:8px;font-size:13px;box-sizing:border-box;outline:none;font-family:inherit;">
                    </div>
                </div>
                <label style="font-size:11px;font-weight:700;color:#5b21b6;display:block;margin-bottom:8px;">เลือก Zone ที่อยู่ใน${editId?editId:'คลังหลักนี้'}</label>
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;max-height:220px;overflow-y:auto;padding:8px;background:white;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:14px;" id="pwhZoneCheckboxes">
                    ${allZones.map(z => {
                        const chk = existing ? existing.includes(z) : false;
                        return `<label style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:1.5px solid ${chk?'#7c3aed':'#e2e8f0'};border-radius:8px;cursor:pointer;background:${chk?'#f5f3ff':'white'};transition:.15s;">
                            <input type="checkbox" value="${z}" ${chk?'checked':''} style="width:16px;height:16px;accent-color:#7c3aed;"
                                onchange="this.closest('label').style.borderColor=this.checked?'#7c3aed':'#e2e8f0';this.closest('label').style.background=this.checked?'#f5f3ff':'white'">
                            <span style="font-size:12px;font-weight:600;color:#1e293b;">${z}</span>
                        </label>`;
                    }).join('')}
                </div>
                <div style="display:flex;gap:8px;justify-content:flex-end;">
                    <button onclick="document.getElementById('parentWhFormArea').innerHTML=''"
                        style="background:#f1f5f9;color:#475569;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-weight:600;">ยกเลิก</button>
                    <button onclick="saveParentWh('${editId||''}')"
                        style="background:#7c3aed;color:white;border:none;padding:10px 24px;border-radius:8px;cursor:pointer;font-weight:700;">💾 บันทึก</button>
                </div>
            </div>`;
            area.scrollIntoView({behavior:'smooth',block:'nearest'});
        };

        window.openEditParentWhForm = function(id) { openAddParentWhForm(id); };

        window.saveParentWh = function(editId) {
            const id = (document.getElementById('pwh_id')?.value||'').trim().toUpperCase();
            const displayName = document.getElementById('pwh_name')?.value.trim()||'';
            if(!id) { toast('⚠️ กรุณาใส่รหัสคลังหลัก','#c2410c'); return; }
            const checked = [...document.querySelectorAll('#pwhZoneCheckboxes input[type=checkbox]:checked')].map(cb=>cb.value);
            // ต้องแก้ผ่าน window.warehouseGroups โดยตรงเพื่อให้ _syncGlobals ใน home.html รับรู้
            if(!window.warehouseGroups) window.warehouseGroups = {};
            window.warehouseGroups[id] = checked;
            if(!window.warehouseGroups._whnames) window.warehouseGroups._whnames = {};
            window.warehouseGroups._whnames[id] = displayName;
            saveConfig();
            toast(`✅ บันทึกคลังหลัก "${id}" (${checked.length} Zones)`,'#7c3aed');
            document.getElementById('parentWhFormArea').innerHTML='';
            renderParentWhList();
        };

        window.deleteParentWh = function(id) {
            if(!confirm(`ลบคลังหลัก "${id}"?\nZone ย่อยจะไม่ถูกลบ เพียงแต่เลิกผูกกัน`)) return;
            if(!window.warehouseGroups) return;
            delete window.warehouseGroups[id];
            if(window.warehouseGroups._whnames) delete window.warehouseGroups._whnames[id];
            saveConfig();
            renderParentWhList();
            toast(`🗑️ ลบคลังหลัก "${id}" แล้ว`,'#64748b');
        };

        window.renderWhList=function(){
            const c=document.getElementById('whListContainer');if(!c)return;
            c.innerHTML=warehouseList.map((wh,i)=>`
            <div style="display:flex;align-items:center;gap:8px;padding:10px;border-bottom:1px solid #f1f5f9;" id="whRow_${i}">
                <span style="flex:1;font-weight:bold;" id="whLabel_${i}">${wh}</span>
                <input id="whInput_${i}" value="${wh}" style="flex:1;display:none;padding:6px 10px;border:1px solid var(--info);border-radius:6px;">
                <button class="btn-sm" style="background:var(--info);color:white;" onclick="toggleEditWh(${i})">✏️</button>
                <button class="btn-sm" style="background:var(--success);color:white;display:none;" id="whSaveBtn_${i}" onclick="saveEditWh(${i})">💾</button>
                <button class="btn-sm" style="background:var(--danger);color:white;" onclick="deleteWh(${i})">🗑️</button>
            </div>`).join('');
        };

        window.toggleEditWh=function(i){
            document.getElementById(`whLabel_${i}`).style.display='none';
            document.getElementById(`whInput_${i}`).style.display='block';
            document.getElementById(`whSaveBtn_${i}`).style.display='inline';
        };

        window.saveEditWh=function(i){
            const newName=document.getElementById(`whInput_${i}`).value.trim();
            if(!newName)return;
            const oldName=warehouseList[i];
            warehouseList[i]=newName;
            // อัปเดต zoneProductMap ด้วย
            if(oldName!==newName&&zoneProductMap[oldName]){
                zoneProductMap[newName]=zoneProductMap[oldName];
                delete zoneProductMap[oldName];
            }
            saveConfig(); renderWhList();
            document.getElementById('selectZoneMap').innerHTML=warehouseList.map(w=>`<option value="${w}">${w}</option>`).join('');
            renderMapping();
            toast('✅ แก้ไขชื่อคลังเรียบร้อย','#059669');
        };

        window.filterPdList=function(q){
            q=(q||'').toLowerCase().trim();
            const c=document.getElementById('pdMasterContainer');
            const cnt=document.getElementById('pdSearchCount');
            if(!c)return;
            const items=c.querySelectorAll('[data-pd-search]');
            let visible=0;
            items.forEach(el=>{
                const match=!q||el.dataset.pdSearch.includes(q);
                el.style.display=match?'':'none';
                if(match)visible++;
            });
            if(cnt) cnt.textContent=q?`พบ ${visible}/${allProducts.length} รายการ`:'';
        };
        window.renderPdList=function(){
            const c=document.getElementById('pdMasterContainer');if(!c)return;
            c.innerHTML=allProducts.map((p,i)=>{
                const units=p.units||[{name:p.unit,rate:0},{name:p.subUnit||'',rate:0}].filter(u=>u.name);
                const unitsStr=units.map((u,ui)=>u.name+(ui<units.length-1&&u.rate>0?' (×'+u.rate+')':'')).join(' → ');
                const isFirst=i===0, isLast=i===allProducts.length-1;
                return `<div data-pd-search="${(p.id+' '+p.name+' '+(p.supplier||'')).toLowerCase()}" style="padding:14px 16px;background:#f8fafc;margin-bottom:8px;border-radius:12px;border:1px solid #e2e8f0;transition:box-shadow 0.15s;" onmouseenter="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.08)'" onmouseleave="this.style.boxShadow=''">
                <div style="display:flex;align-items:center;gap:10px;">
                    <div style="display:flex;flex-direction:column;gap:3px;flex-shrink:0;">
                        <button onclick="movePd(${i},-1)" ${isFirst?'disabled':''} style="background:${isFirst?'#e2e8f0':'#64748b'};color:white;border:none;border-radius:5px;width:26px;height:22px;cursor:${isFirst?'default':'pointer'};font-size:11px;line-height:1;">▲</button>
                        <button onclick="movePd(${i},1)" ${isLast?'disabled':''} style="background:${isLast?'#e2e8f0':'#64748b'};color:white;border:none;border-radius:5px;width:26px;height:22px;cursor:${isLast?'default':'pointer'};font-size:11px;line-height:1;">▼</button>
                    </div>
                    <span style="font-size:12px;color:#cbd5e1;min-width:24px;text-align:center;font-weight:600;">${i+1}</span>
                    <div style="flex:1;min-width:0;">
                        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:3px;">
                            <b style="font-size:13px;color:#0f172a;">${p.id}</b>
                            <span style="font-size:13px;color:#334155;">${p.name}</span>
                            ${p.supplier?`<span style="background:#f0f9ff;color:#0891b2;font-size:11px;padding:2px 8px;border-radius:10px;border:1px solid #bae6fd;flex-shrink:0;">🏢 ${p.supplier}</span>`:''}
                        </div>
                        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                            <span style="color:#7c3aed;font-size:12px;font-weight:600;">📦 ${unitsStr}</span>
                            ${p.exportUnit?`<span style="background:#f0f9ff;color:#0369a1;font-size:11px;padding:2px 8px;border-radius:10px;border:1px solid #bae6fd;flex-shrink:0;">📤 Export: <b>${p.exportUnit}</b></span>`:''}
                            ${p.barcode?`<span style="color:#94a3b8;font-size:11px;font-family:monospace;">🔖 ${p.barcode}</span>`:''}
                        </div>
                    </div>
                    <div style="display:flex;gap:6px;flex-shrink:0;">
                        <button class="btn-sm" style="background:var(--info);color:white;padding:6px 12px;border-radius:8px;font-size:12px;" onclick="toggleEditPd(${i})">✏️ แก้ไข</button>
                        <button class="btn-sm" style="background:var(--danger);color:white;padding:6px 12px;border-radius:8px;font-size:12px;" onclick="deletePd(${i})">✕ ลบ</button>
                    </div>
                </div>
                <div id="pdEditArea_${i}" style="display:none;margin-top:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                        <div style="grid-column:span 2;">
                            <div style="font-size:10px;color:#94a3b8;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:4px;">ชื่อสินค้า</div>
                            <input id="pdEditName_${i}" value="${p.name}" placeholder="ชื่อสินค้า" style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;outline:none;font-family:inherit;" onfocus="this.style.borderColor='#3b82f6'" onblur="this.style.borderColor='#e2e8f0'">
                        </div>
                        <div style="grid-column:span 2;">
                            <div style="font-size:10px;color:#94a3b8;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:4px;">🏢 Supplier / ผู้ส่ง (ถ้ามี)</div>
                            <input id="pdEditSupplier_${i}" value="${p.supplier||''}" placeholder="ชื่อ Supplier" style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;outline:none;font-family:inherit;" onfocus="this.style.borderColor='#3b82f6'" onblur="this.style.borderColor='#e2e8f0'">
                        </div>
                        <div style="grid-column:span 2;">
                            <div style="font-size:10px;color:#a16207;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:4px;">🏷️ หมวดหมู่</div>
                            <input id="pdEditCategory_${i}" value="${p.category||''}" placeholder="เลือกหรือพิมพ์หมวดหมู่" list="categoryDatalist" style="width:100%;padding:9px 12px;border:1.5px solid #fde68a;border-radius:8px;font-size:13px;box-sizing:border-box;outline:none;font-family:inherit;" onfocus="this.style.borderColor='#d97706'" onblur="this.style.borderColor='#fde68a'">
                        </div>
                        <div style="grid-column:span 2;">
                            <div style="font-size:10px;color:#94a3b8;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:4px;">🔖 Barcode (ไว้สำหรับอนาคต)</div>
                            <input id="pdEditBarcode_${i}" value="${p.barcode||''}" placeholder="Barcode" style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;outline:none;font-family:inherit;" onfocus="this.style.borderColor='#3b82f6'" onblur="this.style.borderColor='#e2e8f0'">
                        </div>
                        <div style="grid-column:span 2;border-top:1px solid #e2e8f0;padding-top:10px;margin-top:2px;">
                            <div style="font-size:10px;color:#7c3aed;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:8px;">📦 หน่วยและอัตราแปลง (สูงสุด 3 หน่วย)</div>
                            <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:6px;align-items:center;margin-bottom:6px;">
                                <input id="pdEditUnit0_${i}" value="${units[0]?.name||''}" placeholder="หน่วยที่ 1 (ใหญ่สุด) เช่น ลัง" style="padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;outline:none;font-family:inherit;" onfocus="this.style.borderColor='#7c3aed'" onblur="this.style.borderColor='#e2e8f0';refreshEditPdExportUnit(${i})">
                                <input id="pdEditRate0_${i}" value="${units[0]?.rate||''}" placeholder="1 ลัง = ? หน่วยที่ 2" type="number" min="1" style="padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;outline:none;font-family:inherit;" onfocus="this.style.borderColor='#7c3aed'" onblur="this.style.borderColor='#e2e8f0'">
                                <span style="font-size:11px;color:#94a3b8;white-space:nowrap;">× หน่วยที่ 2</span>
                            </div>
                            <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:6px;align-items:center;margin-bottom:6px;">
                                <input id="pdEditUnit1_${i}" value="${units[1]?.name||''}" placeholder="หน่วยที่ 2 (กลาง) เช่น ถุง" style="padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;outline:none;font-family:inherit;" onfocus="this.style.borderColor='#7c3aed'" onblur="this.style.borderColor='#e2e8f0';refreshEditPdExportUnit(${i})">
                                <input id="pdEditRate1_${i}" value="${units[1]?.rate||''}" placeholder="1 ถุง = ? หน่วยที่ 3" type="number" min="1" style="padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;outline:none;font-family:inherit;" onfocus="this.style.borderColor='#7c3aed'" onblur="this.style.borderColor='#e2e8f0'">
                                <span style="font-size:11px;color:#94a3b8;white-space:nowrap;">× หน่วยที่ 3</span>
                            </div>
                            <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:6px;align-items:center;">
                                <input id="pdEditUnit2_${i}" value="${units[2]?.name||''}" placeholder="หน่วยที่ 3 (เล็กสุด) เช่น กรัม" style="padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;outline:none;font-family:inherit;" onfocus="this.style.borderColor='#7c3aed'" onblur="this.style.borderColor='#e2e8f0';refreshEditPdExportUnit(${i})">
                                <div></div>
                                <span style="font-size:11px;color:#94a3b8;white-space:nowrap;">หน่วยสุดท้าย</span>
                            </div>
                            <!-- Export Unit -->
                            <div style="margin-top:10px;padding:10px 12px;background:#f0f9ff;border:1.5px solid #bae6fd;border-radius:8px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                                <span style="font-size:11px;color:#0369a1;font-weight:700;">📤 หน่วย Export สิ้นเดือน:</span>
                                <select id="pdEditExportUnit_${i}"
                                    style="padding:6px 10px;border:1.5px solid #93c5fd;border-radius:7px;font-size:12px;color:#1d4ed8;font-weight:700;outline:none;background:white;">
                                    ${units.map(u=>`<option value="${u.name}" ${u.name===(p.exportUnit||units[0]?.name||'')?'selected':''}>${u.name}</option>`).join('')}
                                </select>
                                <span style="font-size:10px;color:#64748b;">จำนวนจะถูก convert อัตโนมัติเมื่อ export</span>
                            </div>
                        </div>
                        <button onclick="saveEditPd(${i})" style="grid-column:span 2;background:var(--success);color:white;border:none;padding:11px;border-radius:9px;cursor:pointer;font-size:13px;font-weight:bold;margin-top:4px;">💾 บันทึก</button>
                    </div>
                </div>
            </div>`;}).join('');
        };

        window.movePd=function(i, dir){
            const j=i+dir;
            if(j<0||j>=allProducts.length) return;
            // สลับตำแหน่ง
            [allProducts[i], allProducts[j]] = [allProducts[j], allProducts[i]];
            saveConfig();
            renderPdList();
            renderMapping();
        };

        window.toggleEditPd=function(i){
            const area=document.getElementById(`pdEditArea_${i}`);
            area.style.display=area.style.display==='none'?'block':'none';
        };

        window.saveEditPd=function(i){
            const name=document.getElementById(`pdEditName_${i}`)?.value.trim();
            if(!name){toast('⚠️ กรุณาระบุชื่อสินค้า','#f59e0b');return;}
            const newUnits=[];
            for(let ui=0;ui<3;ui++){
                const uName=document.getElementById(`pdEditUnit${ui}_${i}`)?.value.trim()||'';
                const uRate=parseFloat(document.getElementById(`pdEditRate${ui}_${i}`)?.value)||0;
                if(uName) newUnits.push({name:uName,rate:uRate});
            }
            if(!newUnits.length){toast('⚠️ กรุณาระบุหน่วยอย่างน้อย 1 หน่วย','#f59e0b');return;}
            const editedSupplier=document.getElementById(`pdEditSupplier_${i}`)?.value.trim()||'';
            const editedBarcode=document.getElementById(`pdEditBarcode_${i}`)?.value.trim()||'';
            const editedCategory=document.getElementById(`pdEditCategory_${i}`)?.value.trim()||'';
            const editedExportUnit=document.getElementById(`pdEditExportUnit_${i}`)?.value||newUnits[0]?.name||'';
            allProducts[i].name=name;
            allProducts[i].units=newUnits;
            allProducts[i].unit=newUnits[0]?.name||'';
            allProducts[i].subUnit=newUnits[1]?.name||'';
            allProducts[i].supplier=editedSupplier;
            allProducts[i].barcode=editedBarcode;
            allProducts[i].category=editedCategory;
            allProducts[i].exportUnit=editedExportUnit;
            saveConfig(); renderPdList();
            toast('✅ แก้ไขสินค้าเรียบร้อย','#059669');
        };

        // refresh export unit dropdown ใน edit form เมื่อพิมพ์ชื่อหน่วยใหม่
        window.refreshEditPdExportUnit = function(i) {
            const sel = document.getElementById(`pdEditExportUnit_${i}`); if(!sel) return;
            const cur = sel.value;
            const u0 = document.getElementById(`pdEditUnit0_${i}`)?.value.trim()||'';
            const u1 = document.getElementById(`pdEditUnit1_${i}`)?.value.trim()||'';
            const u2 = document.getElementById(`pdEditUnit2_${i}`)?.value.trim()||'';
            const opts = [u0,u1,u2].filter(Boolean);
            sel.innerHTML = opts.map(u=>`<option value="${u}" ${u===cur?'selected':''}>${u}</option>`).join('');
        };

        // ---- PRODUCT SORT ORDER ----
        window.toggleSortMode = function() {
            const mc = document.getElementById('mappingContainer');
            const sc = document.getElementById('sortContainer');
            const btn = document.getElementById('btnSortMode');
            const ms = document.getElementById('mappingSearch');
            const isSortMode = sc.style.display !== 'none';
            if (isSortMode) {
                // กลับโหมดปกติ
                sc.style.display = 'none';
                mc.style.display = 'grid';
                if (ms) ms.style.display = '';
                btn.style.background = '#7c3aed';
                btn.textContent = '↕️ จัดลำดับ';
            } else {
                // เข้าโหมดจัดลำดับ
                sc.style.display = 'block';
                mc.style.display = 'none';
                if (ms) ms.style.display = 'none';
                btn.style.background = '#1e293b';
                btn.textContent = '✕ ปิดจัดลำดับ';
                renderSortList();
            }
        };

        window.renderSortList = function() {
            const zone = document.getElementById('selectZoneMap')?.value;
            const list = document.getElementById('sortList');
            if (!zone || !list) return;
            const ids = zoneProductMap[zone] || [];
            const prods = ids.map(id => allProducts.find(p => p.id === id)).filter(Boolean);
            if (!prods.length) {
                list.innerHTML = '<p style="color:#94a3b8;font-size:13px;text-align:center;padding:20px;">ยังไม่มีสินค้าในโซนนี้</p>';
                return;
            }
            list.innerHTML = prods.map((p, idx) => {
                const units = p.units || [{name: p.unit || ''}];
                const u = units[0]?.name || '';
                return `<div class="sort-item" draggable="true" data-id="${p.id}"
                    style="display:flex;align-items:center;gap:12px;background:white;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px 14px;cursor:grab;transition:0.15s;"
                    ondragstart="onSortDragStart(event)" ondragover="onSortDragOver(event)" ondrop="onSortDrop(event)" ondragend="onSortDragEnd(event)"
                    onmouseenter="this.style.borderColor='#7c3aed';this.style.background='#faf5ff'"
                    onmouseleave="this.style.borderColor='#e2e8f0';this.style.background='white'">
                    <span style="color:#94a3b8;font-size:18px;user-select:none;flex-shrink:0;">⠿</span>
                    <span style="background:#f1f5f9;color:#64748b;font-size:11px;font-weight:bold;padding:3px 7px;border-radius:5px;flex-shrink:0;min-width:22px;text-align:center;">${idx+1}</span>
                    <div style="flex:1;min-width:0;">
                        <div style="font-weight:700;font-size:13px;color:#1e293b;">${p.id}</div>
                        <div style="color:#475569;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.name}</div>
                    </div>
                    <span style="color:#94a3b8;font-size:11px;flex-shrink:0;">${u}</span>
                </div>`;
            }).join('');
        };

        // Drag-and-drop state
        let _sortDragSrc = null;
        window.onSortDragStart = function(e) {
            _sortDragSrc = e.currentTarget;
            e.dataTransfer.effectAllowed = 'move';
            setTimeout(() => { if(_sortDragSrc) _sortDragSrc.style.opacity = '0.4'; }, 0);
        };
        window.onSortDragOver = function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const target = e.currentTarget;
            if (target !== _sortDragSrc) {
                target.style.borderColor = '#7c3aed';
                target.style.borderStyle = 'dashed';
            }
        };
        window.onSortDrop = function(e) {
            e.preventDefault();
            const target = e.currentTarget;
            if (!_sortDragSrc || target === _sortDragSrc) return;
            const list = document.getElementById('sortList');
            const items = [...list.querySelectorAll('.sort-item')];
            const srcIdx = items.indexOf(_sortDragSrc);
            const tgtIdx = items.indexOf(target);
            if (srcIdx < tgtIdx) list.insertBefore(_sortDragSrc, target.nextSibling);
            else list.insertBefore(_sortDragSrc, target);
            // อัปเดตหมายเลขลำดับ
            [...list.querySelectorAll('.sort-item')].forEach((el, i) => {
                const numEl = el.querySelectorAll('span')[1];
                if (numEl) numEl.textContent = i + 1;
            });
        };
        window.onSortDragEnd = function(e) {
            const list = document.getElementById('sortList');
            if (list) list.querySelectorAll('.sort-item').forEach(el => {
                el.style.opacity = '1';
                el.style.borderColor = '#e2e8f0';
                el.style.borderStyle = 'solid';
                el.style.background = 'white';
            });
            _sortDragSrc = null;
        };

        window.saveSortOrder = function() {
            const zone = document.getElementById('selectZoneMap')?.value;
            const list = document.getElementById('sortList');
            if (!zone || !list) return;
            const newOrder = [...list.querySelectorAll('.sort-item')].map(el => el.dataset.id);
            zoneProductMap[zone] = newOrder;
            saveConfig();
            toast('✅ บันทึกลำดับสินค้าเรียบร้อย', '#7c3aed');
            // อัปเดตหมายเลขทันที
            renderSortList();
        };

        window.renderMapping=function(){
            const zone=document.getElementById('selectZoneMap').value,c=document.getElementById('mappingContainer');
            if(!zone||!c)return;
            const mapped=zoneProductMap[zone]||[];
            const q=(document.getElementById('mappingSearch')?.value||'').toLowerCase();
            c.innerHTML=allProducts.map(p=>{
                const search=`${p.id} ${p.name}`.toLowerCase();
                const isMapped=mapped.includes(p.id);
                return `<label data-search="${search}" style="display:${!q||search.includes(q)?'flex':'none'};align-items:center;gap:12px;padding:12px 14px;border:2px solid ${isMapped?'#10b981':'#e2e8f0'};border-radius:12px;cursor:pointer;background:${isMapped?'#f0fdf4':'white'};transition:all .15s;">
                    <input type="checkbox" value="${p.id}" style="width:18px;height:18px;accent-color:#10b981;" ${isMapped?'checked':''} onchange="togglePdMapping('${zone}','${p.id}');this.closest('label').style.borderColor=this.checked?'#10b981':'#e2e8f0';this.closest('label').style.background=this.checked?'#f0fdf4':'white';">
                    <div style="font-size:13px;min-width:0;">
                        <b style="color:#0f172a;">${p.id}</b>${isMapped?' <span style="background:#dcfce7;color:#166534;font-size:10px;padding:1px 6px;border-radius:10px;">✓ ในโซน</span>':''}<br>
                        <span style="color:#475569;">${p.name}</span><br>
                        <span style="color:#94a3b8;font-size:11px;">${(p.units||[]).map(u=>u.name).join(' / ')}</span>
                    </div>
                </label>`;
            }).join('');
        };

        window.togglePdMapping=function(z,id){if(!zoneProductMap[z])zoneProductMap[z]=[];const i=zoneProductMap[z].indexOf(id);if(i>-1)zoneProductMap[z].splice(i,1);else zoneProductMap[z].push(id);saveConfig();};
        window.selectAllMapping=function(checked){
            const zone=document.getElementById('selectZoneMap')?.value;if(!zone)return;
            if(!zoneProductMap[zone])zoneProductMap[zone]=[];
            const visible=document.querySelectorAll('#mappingContainer input[type=checkbox]');
            visible.forEach(cb=>{
                const id=cb.value;
                cb.checked=checked;
                const idx=zoneProductMap[zone].indexOf(id);
                if(checked&&idx===-1) zoneProductMap[zone].push(id);
                else if(!checked&&idx>-1) zoneProductMap[zone].splice(idx,1);
            });
            saveConfig();
            toast(checked?'✅ เลือกสินค้าทั้งหมดในโซน':'❌ ยกเลิกทั้งหมด','#059669');
        };
        window.filterMapping=function(q){
            const rows=document.querySelectorAll('#mappingContainer label[data-search]');
            rows.forEach(r=>{ r.style.display=(r.dataset.search||'').includes(q.toLowerCase())?'':'none'; });
        };
        window.addWh=function(){const n=document.getElementById('newWhName').value.trim();if(n){warehouseList.push(n);saveConfig();openWarehouseManager();}};
        window.deleteWh=function(i){if(confirm('ยืนยันลบโซน?')){warehouseList.splice(i,1);saveConfig();openWarehouseManager();}};

        window.addPd=function(){
            const id=document.getElementById('newPdId').value.trim();
            const name=document.getElementById('newPdName').value.trim();
            const u1=document.getElementById('newPdUnit1').value.trim();
            const u2=document.getElementById('newPdUnit2').value.trim();
            const u3=document.getElementById('newPdUnit3').value.trim();
            const r1=parseFloat(document.getElementById('newPdRate1').value)||0;
            const r2=parseFloat(document.getElementById('newPdRate2').value)||0;
            // Auto-generate ID ถ้าไม่กรอก
            let finalId = id;
            if(!finalId) {
                const existing = allProducts.map(p=>p.id).filter(x=>x.startsWith('ITEM-'));
                const nums = existing.map(x=>parseInt(x.replace('ITEM-',''))||0);
                const nextNum = (nums.length ? Math.max(...nums) : 0) + 1;
                finalId = 'ITEM-' + String(nextNum).padStart(3,'0');
            }
            if(!name||!u1){toast('⚠️ กรุณากรอก ชื่อสินค้า และหน่วยที่ 1 อย่างน้อย','#c2410c');return;}
            if(allProducts.some(p=>p.id===finalId)){toast('❌ รหัสสินค้า "'+finalId+'" ซ้ำกับที่มีอยู่แล้ว','#c2410c');return;}
            if(allProducts.some(p=>p.name.trim().toLowerCase()===name.toLowerCase())){toast('❌ ชื่อสินค้า "'+name+'" ซ้ำกับที่มีอยู่แล้ว','#c2410c');return;}
            // สร้าง units array
            const units=[];
            if(u1) units.push({name:u1,rate:r1||0}); // rate = อัตราแปลงไปหน่วยถัดไป
            if(u2) units.push({name:u2,rate:r2||0});
            if(u3) units.push({name:u3,rate:0}); // หน่วยสุดท้ายไม่มี rate
            const supplier = document.getElementById('newPdSupplier')?.value.trim()||'';
            const barcode = document.getElementById('newPdBarcode')?.value.trim()||'';
            const category = document.getElementById('newPdCategory')?.value.trim()||'';
            const exportUnit = document.getElementById('newPdExportUnit')?.value.trim() || u1;
            allProducts.push({id:finalId,name,units,supplier,barcode,category,exportUnit,
                // backward compat
                unit:u1, subUnit:u2||''
            });
            saveConfig(); renderPdList(); renderMapping();
            ['newPdId','newPdName','newPdSupplier','newPdBarcode','newPdCategory','newPdUnit1','newPdRate1','newPdUnit2','newPdRate2','newPdUnit3'].forEach(x=>{
                const el=document.getElementById(x); if(el) el.value='';
            });
            const euEl = document.getElementById('newPdExportUnit');
            if(euEl) euEl.innerHTML = '<option value="">— กรอกหน่วยก่อน —</option>';
            toast(`✅ เพิ่มสินค้า [${finalId}] เรียบร้อย`,'#059669');
        };

        window.deletePd=function(i){if(confirm('ยืนยันลบสินค้า?')){allProducts.splice(i,1);saveConfig();renderPdList();renderMapping();}};

        // sync export unit dropdown เมื่อพิมพ์หน่วยใน add form
        window.syncNewPdExportUnit = function(sel) {
            // ไม่ต้องทำอะไร — user เลือกเองแล้ว
        };
        // เรียกทุกครั้งที่ blur จาก unit input เพื่ออัพเดท dropdown
        window.refreshNewPdExportUnitOpts = function() {
            const u1 = document.getElementById('newPdUnit1')?.value.trim();
            const u2 = document.getElementById('newPdUnit2')?.value.trim();
            const u3 = document.getElementById('newPdUnit3')?.value.trim();
            const sel = document.getElementById('newPdExportUnit');
            if(!sel) return;
            const cur = sel.value;
            const opts = [u1,u2,u3].filter(Boolean);
            sel.innerHTML = opts.length
                ? opts.map(u=>`<option value="${u}" ${u===cur?'selected':''}>${u}</option>`).join('')
                : '<option value="">— กรอกหน่วยก่อน —</option>';
        };
        // ══ Category Management ══
        // ══ Category Management ══
        window.renderCategoryChips = function() {
            const c = document.getElementById('categoryChipList'); if(!c) return;
            c.innerHTML = productCategories.map((cat,i)=>`
                <span style="display:inline-flex;align-items:center;gap:4px;background:#fef9c3;color:#a16207;border:1px solid #fde68a;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600;">
                    🏷️ ${cat}
                    <button onclick="deleteCategory(${i})" style="background:none;border:none;cursor:pointer;color:#d97706;font-size:12px;padding:0;line-height:1;" title="ลบหมวดนี้">✕</button>
                </span>`).join('');
            // update all datalists
            const lists = document.querySelectorAll('#categoryDatalist');
            lists.forEach(dl => {
                dl.innerHTML = productCategories.map(c=>`<option value="${c}">`).join('');
            });
        };
        window.addCategory = function() {
            const inp = document.getElementById('newCategoryInput');
            const val = inp?.value.trim();
            if(!val) return;
            if(productCategories.includes(val)){toast('⚠️ หมวดหมู่นี้มีอยู่แล้ว','#c2410c');return;}
            productCategories.push(val);
            if(inp) inp.value='';
            saveConfig();
            renderCategoryChips();
            toast('✅ เพิ่มหมวดหมู่ "'+val+'" แล้ว','#059669');
        };
        window.deleteCategory = function(i) {
            const name = productCategories[i];
            if(!confirm(`ลบหมวดหมู่ "${name}"?\n(สินค้าที่อยู่ในหมวดนี้จะไม่ถูกลบ)`)) return;
            productCategories.splice(i,1);
            saveConfig();
            renderCategoryChips();
            toast('🗑️ ลบหมวดหมู่แล้ว','#64748b');
        };

        // ---- MISC ----

        // ======== IMPORT PRODUCTS FROM EXCEL ========
        window.openImportProducts=function(){
            document.getElementById('dashboardView').classList.add('hidden');
            const c=document.getElementById('toolAppContainer');c.classList.remove('hidden');
            c.innerHTML=`
            <div class="tool-header no-print">
                <h2>📥 Import สินค้าจาก Excel</h2>
                <button onclick="goToDashboard()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;">🏠 Dashboard</button><button onclick="closeTool()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;">✕ ปิด</button>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px;">
                <!-- Step 1: Download Template -->
                <div style="background:white;border-radius:14px;padding:24px;border:2px solid #e2e8f0;">
                    <div style="font-size:18px;font-weight:bold;color:var(--primary-dark);margin-bottom:8px;">① ดาวน์โหลด Template</div>
                    <p style="color:#64748b;font-size:13px;margin:0 0 16px;">ดาวน์โหลด Excel template แล้วกรอกข้อมูลสินค้าตามรูปแบบที่กำหนด</p>
                    <div style="background:#f8fafc;border-radius:8px;padding:12px;margin-bottom:16px;font-size:12px;color:#475569;">
                        <b>คอลัมน์ที่ต้องกรอก:</b><br>
                        <span style="color:#ef4444;">*</span> ProductCode — รหัสสินค้า (เช่น SM000138)<br>
                        <span style="color:#ef4444;">*</span> ProductName — ชื่อสินค้า<br>
                        Unit1 — หน่วยที่ 1 (เช่น ลัง)<br>
                        Rate1 — 1 ลัง = กี่ หน่วย2<br>
                        Unit2 — หน่วยที่ 2 (เช่น ถุง)<br>
                        Rate2 — 1 ถุง = กี่ หน่วย3<br>
                        Unit3 — หน่วยที่ 3 (เช่น กรัม)
                    </div>
                    <button onclick="downloadImportTemplate()" style="width:100%;background:var(--primary-dark);color:white;border:none;padding:12px;border-radius:10px;cursor:pointer;font-weight:bold;">⬇️ ดาวน์โหลด Template.xlsx</button>
                </div>

                <!-- Step 2: Upload -->
                <div style="background:white;border-radius:14px;padding:24px;border:2px solid #e2e8f0;">
                    <div style="font-size:18px;font-weight:bold;color:var(--primary-dark);margin-bottom:8px;">② อัปโหลด Excel</div>
                    <p style="color:#64748b;font-size:13px;margin:0 0 16px;">เลือกไฟล์ Excel ที่กรอกข้อมูลแล้ว ระบบจะแสดง Preview ก่อน import จริง</p>
                    <div style="border:2px dashed #e2e8f0;border-radius:10px;padding:30px;text-align:center;margin-bottom:16px;cursor:pointer;transition:border 0.2s;"
                        onclick="document.getElementById('importFile').click()"
                        ondragover="event.preventDefault();this.style.borderColor='var(--info)'"
                        ondragleave="this.style.borderColor='#e2e8f0'"
                        ondrop="event.preventDefault();handleImportDrop(event)">
                        <div style="font-size:32px;margin-bottom:8px;">📂</div>
                        <div style="color:#64748b;font-size:13px;">คลิกหรือลากไฟล์มาวางที่นี่</div>
                        <input type="file" id="importFile" accept=".xlsx,.xls,.csv" style="display:none" onchange="handleImportFile(this)">
                    </div>
                    <div id="importFileLabel" style="font-size:12px;color:#94a3b8;text-align:center;">ยังไม่ได้เลือกไฟล์</div>
                </div>
            </div>

            <!-- Preview table -->
            <div id="importPreview" style="display:none;background:white;border-radius:14px;padding:24px;border:1px solid #e2e8f0;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                    <h4 style="margin:0;">🔍 Preview ก่อน Import</h4>
                    <div style="display:flex;gap:8px;">
                        <button onclick="confirmImportProducts()" id="confirmImportBtn" style="background:var(--success);color:white;border:none;padding:10px 24px;border-radius:10px;cursor:pointer;font-weight:bold;">✅ ยืนยัน Import</button>
                        <button onclick="document.getElementById('importPreview').style.display='none'" style="background:#f1f5f9;color:#475569;border:none;padding:10px 16px;border-radius:10px;cursor:pointer;">ยกเลิก</button>
                    </div>
                </div>
                <div id="importPreviewTable"></div>
            </div>`;
        };

        window.downloadImportTemplate=function(){
            const rows=[
                ['ProductCode','ProductName','Unit1','Rate1','Unit2','Rate2','Unit3'],
                ['SM000001','ตัวอย่างสินค้า A','ลัง',12,'ถุง',500,'กรัม'],
                ['SM000002','ตัวอย่างสินค้า B','กล่อง',24,'ชิ้น','',''],
                ['SM000003','ตัวอย่างสินค้า C (หน่วยเดียว)','กระป๋อง','','','',''],
            ];
            const ws=XLSX.utils.aoa_to_sheet(rows);
            ws['!cols']=[{wch:15},{wch:35},{wch:10},{wch:8},{wch:10},{wch:8},{wch:10}];
            const wb=XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb,ws,'Products');
            XLSX.writeFile(wb,'TingTing_Import_Template.xlsx');
        };

        window.handleImportDrop=function(e){
            const file=e.dataTransfer.files[0];
            if(file) processImportFile(file);
        };
        window.handleImportFile=function(input){
            if(input.files[0]) processImportFile(input.files[0]);
        };

        window._importData=[];
        window.processImportFile=function(file){
            document.getElementById('importFileLabel').innerText=`📄 ${file.name}`;
            const reader=new FileReader();
            reader.onload=function(e){
                const wb=XLSX.read(e.target.result,{type:'array'});
                const ws=wb.Sheets[wb.SheetNames[0]];
                const data=XLSX.utils.sheet_to_json(ws,{defval:''});
                if(!data.length){toast('❌ ไม่พบข้อมูล','#c2410c');return;}

                window._importData=data.map(row=>({
                    id:String(row.ProductCode||'').trim(),
                    name:String(row.ProductName||'').trim(),
                    units:[
                        row.Unit1?{name:String(row.Unit1).trim(),rate:parseFloat(row.Rate1)||0}:null,
                        row.Unit2?{name:String(row.Unit2).trim(),rate:parseFloat(row.Rate2)||0}:null,
                        row.Unit3?{name:String(row.Unit3).trim(),rate:0}:null,
                    ].filter(u=>u&&u.name)
                })).filter(p=>p.id&&p.name);

                renderImportPreview();
            };
            reader.readAsArrayBuffer(file);
        };

        window.renderImportPreview=function(){
            const data=window._importData;
            const existing=new Set(allProducts.map(p=>p.id));
            const preview=document.getElementById('importPreview');
            const table=document.getElementById('importPreviewTable');
            if(!preview||!table)return;

            preview.style.display='block';
            const newCount=data.filter(p=>!existing.has(p.id)).length;
            const dupCount=data.filter(p=>existing.has(p.id)).length;

            table.innerHTML=`
            <div style="display:flex;gap:12px;margin-bottom:16px;">
                <div style="background:#f0fdf4;border:1px solid #6ee7b7;border-radius:8px;padding:10px 16px;font-size:13px;color:#059669;font-weight:bold;">✅ ใหม่ ${newCount} รายการ</div>
                ${dupCount?`<div style="background:#fff7ed;border:1px solid #fdba74;border-radius:8px;padding:10px 16px;font-size:13px;color:#c2410c;font-weight:bold;">⚠️ ซ้ำ ${dupCount} รายการ (จะข้ามไป)</div>`:''}
            </div>
            <div style="max-height:300px;overflow-y:auto;">
            <table style="width:100%;border-collapse:collapse;">
                <thead><tr style="background:#f8fafc;">
                    <th style="padding:8px;font-size:11px;color:#64748b;text-align:left;">สถานะ</th>
                    <th style="padding:8px;font-size:11px;color:#64748b;text-align:left;">รหัส</th>
                    <th style="padding:8px;font-size:11px;color:#64748b;text-align:left;">ชื่อสินค้า</th>
                    <th style="padding:8px;font-size:11px;color:#64748b;text-align:left;">หน่วย</th>
                </tr></thead>
                <tbody>${data.map(p=>{
                    const isDup=existing.has(p.id);
                    const unitStr=p.units.map(u=>u.name+(u.rate?`(×${u.rate})`:'') ).join(' → ');
                    return `<tr style="border-top:1px solid #f1f5f9;${isDup?'opacity:0.5':''}">
                        <td style="padding:8px;">${isDup?'⚠️ ซ้ำ':'🆕 ใหม่'}</td>
                        <td style="padding:8px;font-weight:bold;font-size:12px;">${p.id}</td>
                        <td style="padding:8px;font-size:12px;">${p.name}</td>
                        <td style="padding:8px;font-size:11px;color:#64748b;">${unitStr||'-'}</td>
                    </tr>`;
                }).join('')}</tbody>
            </table></div>`;
        };

        window.confirmImportProducts=async function(){
            const data=window._importData;
            if(!data?.length){toast('❌ ไม่มีข้อมูล','#c2410c');return;}
            const existing=new Set(allProducts.map(p=>p.id));
            const toAdd=data.filter(p=>!existing.has(p.id));
            if(!toAdd.length){toast('⚠️ ไม่มีสินค้าใหม่ที่จะ import','#c2410c');return;}
            if(!confirm(`ยืนยัน Import สินค้าใหม่ ${toAdd.length} รายการ?`))return;

            allProducts.push(...toAdd);
            await saveConfig();
            toast(`✅ Import สำเร็จ ${toAdd.length} รายการ`,'#059669');
            document.getElementById('importPreview').style.display='none';
            document.getElementById('importFileLabel').innerText='ยังไม่ได้เลือกไฟล์';
            window._importData=[];
        };

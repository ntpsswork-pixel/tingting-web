// stock-settings.js — TTGPlus | openRequisitionSettings, template management (SST)
        window.openRequisitionSettings = function() {
            document.getElementById('dashboardView').classList.add('hidden');
            const c = document.getElementById('toolAppContainer'); c.classList.remove('hidden');
            renderTemplateSettingsPage(c);
        };

        function renderTemplateSettingsPage(c) {
            c.innerHTML = `
            <div class="tool-header">
                <h2>⚙️ ตั้งค่า Template</h2>
                <button onclick="goToDashboard()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;">🏠 Dashboard</button><button onclick="closeTool()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;">✕ ปิด</button>
            </div>
            <!-- Tabs -->
            <div style="display:flex;gap:0;margin-bottom:24px;border-bottom:2px solid #e2e8f0;">
                <button onclick="switchTmplTab('req')" id="tab_req"
                    style="padding:12px 28px;border:none;background:none;cursor:pointer;font-size:14px;font-weight:bold;color:#7c3aed;border-bottom:3px solid #7c3aed;margin-bottom:-2px;">
                    📋 ใบเบิกสินค้า</button>
                <button onclick="switchTmplTab('sheet')" id="tab_sheet"
                    style="padding:12px 28px;border:none;background:none;cursor:pointer;font-size:14px;font-weight:bold;color:#94a3b8;border-bottom:3px solid transparent;margin-bottom:-2px;">
                    📄 ใบนับสต๊อกคงเหลือ</button>
            </div>
            <div id="tmplTabContent"></div>`;
            switchTmplTab('req');
        }

        window.switchTmplTab = function(tab) {
            ['req','sheet'].forEach(t => {
                const btn = document.getElementById(`tab_${t}`);
                if(btn) {
                    btn.style.color = t===tab ? (t==='req'?'#7c3aed':'#06b6d4') : '#94a3b8';
                    btn.style.borderBottom = t===tab ? `3px solid ${t==='req'?'#7c3aed':'#06b6d4'}` : '3px solid transparent';
                }
            });
            const c = document.getElementById('tmplTabContent'); if(!c) return;
            if(tab==='req') renderReqTemplateTab(c);
            else renderSheetTemplateTab(c);
        };

        // ---- Tab: ใบเบิก (existing logic wrapped) ----
        function renderReqTemplateTab(c) {
            const tmplList = Object.entries(reqTemplates);
            c.innerHTML = `
            <p style="color:#64748b;font-size:13px;margin-bottom:20px;">สร้าง Template ใบเบิกสำเร็จรูปสำหรับแต่ละแผนก กดใช้ได้เลยไม่ต้องกรอกใหม่ทุกครั้ง</p>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;margin-bottom:24px;">
                ${tmplList.map(([id,t])=>`
                <div style="background:white;border-radius:14px;border:3px solid ${t.color};padding:20px;position:relative;">
                    <div style="position:absolute;top:12px;right:12px;display:flex;gap:6px;">
                        <button onclick="editTemplate('${id}')" style="background:#f1f5f9;border:none;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:12px;">✏️</button>
                        <button onclick="deleteTemplate('${id}')" style="background:#fef2f2;border:none;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:12px;color:#ef4444;">🗑️</button>
                    </div>
                    <div style="font-size:16px;font-weight:bold;color:${t.color};">${t.name}</div>
                    <div style="font-size:12px;color:#64748b;margin:4px 0 8px;">📦 ${t.zone} • 🏭 ${t.dept||'-'}</div>
                    <div style="font-size:12px;color:#94a3b8;">${(t.items||[]).length} รายการสินค้า</div>
                </div>`).join('')}
                <div onclick="openNewTemplateForm()" style="background:white;border-radius:14px;border:3px dashed #e2e8f0;padding:20px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:120px;"
                    onmouseover="this.style.borderColor='#7c3aed'" onmouseout="this.style.borderColor='#e2e8f0'">
                    <div style="font-size:32px;color:#cbd5e1;">+</div>
                    <div style="color:#94a3b8;font-size:13px;">สร้าง Template ใหม่</div>
                </div>
            </div>
            <div id="templateFormArea"></div>`;
        }

        // ---- Tab: ใบนับสต๊อกคงเหลือ ----
        function renderSheetTemplateTab(c) {
            const tmplList = Object.entries(stockSheetTemplates);
            c.innerHTML = `
            <div style="background:#eff6ff;border:1px solid #bae6fd;border-radius:10px;padding:12px 16px;margin-bottom:20px;font-size:13px;color:#0369a1;">
                💡 <b>วิธีใช้:</b> สร้าง Template ที่นี่ → กำหนด branchType (เช่น BT) → สาขาทุกแห่งที่ขึ้นต้นด้วย BT จะใช้ Template นี้ในการนับสต๊อกสิ้นเดือนได้เลย
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;margin-bottom:24px;">
                ${tmplList.map(([id,t])=>`
                <div style="background:white;border-radius:14px;border:3px solid ${t.color||'#06b6d4'};padding:20px;position:relative;">
                    <div style="position:absolute;top:12px;right:12px;display:flex;gap:6px;">
                        <button onclick="printStockSheetTemplate('${id}')" style="background:#f0fdf4;border:none;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:12px;color:#059669;">🖨️ พิมพ์</button>
                        <button onclick="editSheetTemplate('${id}')" style="background:#f1f5f9;border:none;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:12px;">✏️</button>
                        <button onclick="deleteSheetTemplate('${id}')" style="background:#fef2f2;border:none;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:12px;color:#ef4444;">🗑️</button>
                    </div>
                    <div style="font-size:16px;font-weight:bold;color:${t.color||'#06b6d4'};">${t.name}</div>
                    <div style="font-size:12px;color:#64748b;margin:4px 0 4px;">🏢 branchType: <b style="color:#1e293b;">${t.branchType||t.zone||'—'}</b></div>
                    <div style="font-size:12px;color:#94a3b8;">${(t.items||[]).length} รายการ • ${[...new Set((t.items||[]).map(i=>i.group||i.category).filter(Boolean))].length} หมวด</div>
                    <div style="font-size:11px;color:#06b6d4;margin-top:6px;">ใช้กับสาขาที่ชื่อขึ้นต้นด้วย "${t.branchType||t.zone||''}"</div>
                </div>`).join('')}
                <div onclick="openNewSheetTemplateForm()" style="background:white;border-radius:14px;border:3px dashed #e2e8f0;padding:20px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:120px;"
                    onmouseover="this.style.borderColor='#06b6d4'" onmouseout="this.style.borderColor='#e2e8f0'">
                    <div style="font-size:32px;color:#cbd5e1;">+</div>
                    <div style="color:#94a3b8;font-size:13px;">สร้าง Template สาขาใหม่</div>
                </div>
            </div>
            <div id="sheetTemplateFormArea"></div>`;
        }

        // ---- Form: สร้าง/แก้ไข Stock Sheet Template ----
        window.openNewSheetTemplateForm = function(editId) {
            const existing = editId ? stockSheetTemplates[editId] : null;
            const tid = editId || `sst_${Date.now()}`;
            const catOpts = productCategories.map(c=>`<option value="${c}">`).join('');

            document.getElementById('sheetTemplateFormArea').innerHTML = `
            <div style="background:white;border-radius:14px;border:1px solid #e2e8f0;padding:24px;margin-top:8px;">
                <h4 style="margin-top:0;">${existing?'✏️ แก้ไข':'➕ สร้าง'} Template ใบนับสต๊อกคงเหลือ</h4>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px;">
                    <div><label style="font-size:11px;font-weight:bold;color:#475569;display:block;margin-bottom:4px;">ชื่อ Template <span style="color:red;">*</span></label>
                        <input id="sst_name" value="${existing?.name||''}" placeholder="เช่น Template สาขา BT"
                            style="width:100%;padding:9px;border:1px solid #e2e8f0;border-radius:8px;box-sizing:border-box;font-size:13px;font-weight:bold;"></div>
                    <div><label style="font-size:11px;font-weight:bold;color:#475569;display:block;margin-bottom:4px;">branchType <span style="color:red;">*</span></label>
                        <input id="sst_branchType" value="${existing?.branchType||existing?.zone||'BT'}" placeholder="เช่น BT"
                            style="width:100%;padding:9px;border:1px solid #06b6d4;border-radius:8px;font-size:13px;font-weight:bold;box-sizing:border-box;outline:none;"
                            title="สาขาที่ชื่อขึ้นต้นด้วยค่านี้จะใช้ Template นี้ เช่น BT → BT001 BT002 ทุกสาขา">
                        <small style="color:#64748b;font-size:10px;">สาขาที่ขึ้นต้นด้วยค่านี้จะใช้ Template นี้</small></div>
                    <div><label style="font-size:11px;font-weight:bold;color:#475569;display:block;margin-bottom:4px;">สีประจำ Template</label>
                        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;">
                            ${TEMPLATE_COLORS.map(col=>`<div onclick="selectSSTColor('${col}')" id="sstcolor_${col.replace('#','')}"
                                style="width:24px;height:24px;border-radius:50%;background:${col};cursor:pointer;border:3px solid ${existing?.color===col||(!existing?.color&&col===TEMPLATE_COLORS[2])?'#1e293b':'transparent'};"></div>`).join('')}
                        </div>
                        <input type="hidden" id="sst_color" value="${existing?.color||TEMPLATE_COLORS[2]}">
                    </div>
                </div>
                <div style="margin-bottom:16px;">
                    <label style="font-size:11px;font-weight:bold;color:#475569;display:block;margin-bottom:6px;">
                        เลือกสินค้าและกำหนดหมวดหมู่ <small style="color:#94a3b8;">(เลือกจาก dropdown หรือพิมพ์เอง)</small>
                    </label>
                    <datalist id="sstCatDatalist">${catOpts}</datalist>
                    <div style="display:flex;gap:8px;margin-bottom:10px;">
                        <input type="text" id="sstSearch" placeholder="🔍 ค้นหาสินค้า..." oninput="filterSSTItems(this.value)"
                            style="flex:1;padding:8px 14px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;outline:none;">
                        <select onchange="filterSSTByCategory(this.value)" style="padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;outline:none;">
                            <option value="">— ทุกหมวด —</option>
                            ${productCategories.map(c=>`<option value="${c}">${c}</option>`).join('')}
                        </select>
                        <button onclick="selectAllSSTItems(true)" style="background:#10b981;color:white;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:bold;">✅ ทั้งหมด</button>
                        <button onclick="selectAllSSTItems(false)" style="background:#f1f5f9;color:#475569;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-size:12px;">❌ ล้าง</button>
                    </div>
                    <div id="sstItemsList" style="max-height:360px;overflow-y:auto;border:1px solid #f1f5f9;border-radius:10px;"></div>
                </div>
                <div style="display:flex;gap:10px;justify-content:flex-end;">
                    <button onclick="saveSheetTemplate('${tid}')" style="background:#06b6d4;color:white;border:none;padding:10px 28px;border-radius:10px;cursor:pointer;font-weight:bold;">💾 บันทึก Template</button>
                    <button onclick="document.getElementById('sheetTemplateFormArea').innerHTML=''" style="background:#f1f5f9;color:#475569;border:none;padding:10px 18px;border-radius:10px;cursor:pointer;">ยกเลิก</button>
                </div>
            </div>`;
            window._editingSSTId = tid;
            window._editingSSTExisting = existing;
            renderSSTItems();
            document.getElementById('sheetTemplateFormArea').scrollIntoView({behavior:'smooth'});
        };

        window.selectSSTColor = function(col) {
            document.getElementById('sst_color').value = col;
            TEMPLATE_COLORS.forEach(c=>{
                const el = document.getElementById(`sstcolor_${c.replace('#','')}`);
                if(el) el.style.border = `3px solid ${c===col?'#1e293b':'transparent'}`;
            });
        };

        window.renderSSTItems = function() {
            const existing = window._editingSSTExisting;
            const existingMap = {};
            (existing?.items||[]).forEach(it=>{ existingMap[it.id]={checked:true,group:it.group||it.category||'',exportUnit:it.exportUnit||''}; });
            // ใช้ allProducts ทั้งหมด (ไม่ผูก zone)
            const prods = allProducts;
            const c = document.getElementById('sstItemsList'); if(!c) return;
            c.innerHTML = prods.length ? prods.map(p=>{
                const units = p.units||[{name:p.unit||''}];
                const u0 = units[0]?.name||'';
                const ex = existingMap[p.id]||{};
                const pCat = p.category||'';
                const defaultGroup = ex.group || pCat || '';
                const defaultExportUnit = ex.exportUnit || u0;
                // dropdown options สำหรับหน่วย export
                const unitOpts = units.map(u=>`<option value="${u.name}" ${u.name===defaultExportUnit?'selected':''}>${u.name}</option>`).join('');
                return `<div class="sst-item-row" data-search="${p.id.toLowerCase()} ${p.name.toLowerCase()}" data-category="${pCat.toLowerCase()}"
                    style="display:flex;align-items:center;gap:8px;padding:8px 14px;border-bottom:1px solid #f8fafc;background:${ex.checked?'#f0fdf4':'white'};">
                    <input type="checkbox" id="sstitem_${p.id}" ${ex.checked?'checked':''}
                        style="width:16px;height:16px;accent-color:#06b6d4;cursor:pointer;flex-shrink:0;"
                        onchange="this.closest('.sst-item-row').style.background=this.checked?'#f0fdf4':'white'">
                    <span style="font-weight:bold;font-size:12px;min-width:80px;color:#1e293b;">${p.id}</span>
                    <span style="color:#475569;font-size:12px;flex:1;">${p.name}</span>
                    ${pCat?`<span style="background:#fef9c3;color:#a16207;font-size:10px;padding:1px 7px;border-radius:10px;white-space:nowrap;">🏷️ ${pCat}</span>`:''}
                    <div style="display:flex;flex-direction:column;gap:2px;min-width:100px;">
                        <small style="font-size:9px;color:#94a3b8;font-weight:600;">หน่วย Export</small>
                        <select id="sstexportunit_${p.id}"
                            style="padding:3px 6px;border:1px solid #bae6fd;border-radius:5px;font-size:11px;color:#0369a1;font-weight:600;outline:none;background:#f0f9ff;"
                            title="หน่วยที่จะ export สิ้นเดือน (จำนวนจะถูก convert อัตโนมัติ)"
                            onfocus="document.getElementById('sstitem_${p.id}').checked=true;this.closest('.sst-item-row').style.background='#f0fdf4'">
                            ${unitOpts}
                        </select>
                    </div>
                    <input type="text" id="sstgroup_${p.id}" value="${defaultGroup}" placeholder="หมวดในใบนับ" list="sstCatDatalist"
                        style="width:110px;padding:4px 8px;border:1px solid #e2e8f0;border-radius:6px;font-size:11px;outline:none;"
                        onfocus="document.getElementById('sstitem_${p.id}').checked=true;this.closest('.sst-item-row').style.background='#f0fdf4'">
                </div>`;
            }).join('') : '<p style="color:#94a3b8;padding:16px;text-align:center;">ยังไม่มีสินค้าในระบบ</p>';
        };

        window.selectAllSSTItems = function(checked) {
            document.querySelectorAll('#sstItemsList .sst-item-row').forEach(row=>{
                if(row.style.display==='none') return;
                const cb = row.querySelector('input[type=checkbox]');
                if(cb){ cb.checked=checked; row.style.background=checked?'#f0fdf4':'white'; }
            });
        };
        window.filterSSTByCategory = function(cat) {
            document.querySelectorAll('#sstItemsList .sst-item-row').forEach(row=>{
                const rowCat = row.dataset.category||'';
                row.style.display = (!cat || rowCat===cat.toLowerCase()) ? '' : 'none';
            });
        };

        window.filterSSTItems = function(q) {
            q = q.toLowerCase().trim();
            document.querySelectorAll('.sst-item-row').forEach(r=>{
                r.style.display = (!q||r.dataset.search.includes(q)) ? '' : 'none';
            });
        };

        window.saveSheetTemplate = function(tid) {
            const name       = document.getElementById('sst_name')?.value.trim();
            const branchType = document.getElementById('sst_branchType')?.value.trim().toUpperCase()||'BT';
            const color      = document.getElementById('sst_color')?.value||TEMPLATE_COLORS[2];
            if(!name){toast('⚠️ กรุณาใส่ชื่อ Template','#c2410c');return;}
            if(!branchType){toast('⚠️ กรุณาใส่ branchType','#c2410c');return;}
            const items = allProducts.filter(p=>document.getElementById(`sstitem_${p.id}`)?.checked)
                .map(p=>({
                    id:p.id, name:p.name,
                    unit:(p.units||[{name:p.unit||''}])[0]?.name||'',
                    category:p.category||'',
                    group:document.getElementById(`sstgroup_${p.id}`)?.value.trim()||p.category||'',
                    exportUnit:document.getElementById(`sstexportunit_${p.id}`)?.value || (p.units||[{name:p.unit||''}])[0]?.name||''
                }));
            if(!items.length){toast('⚠️ เลือกสินค้าอย่างน้อย 1 รายการ','#c2410c');return;}
            stockSheetTemplates[tid] = {name,branchType,zone:branchType,color,items};
            saveConfig();
            toast(`✅ บันทึก Template "${name}" (${branchType}) แล้ว`,'#059669');
            const c = document.getElementById('toolAppContainer');
            renderTemplateSettingsPage(c);
            setTimeout(()=>switchTmplTab('sheet'),100);
        };

        window.editSheetTemplate = function(id) {
            window._editingSSTExisting = stockSheetTemplates[id];
            openNewSheetTemplateForm(id);
        };

        window.deleteSheetTemplate = async function(id) {
            const tmplName = stockSheetTemplates[id]?.name || id;
            if(!confirm(`ลบ Template "${tmplName}"?\nสาขาที่ใช้ Template นี้จะไม่สามารถนับสต๊อกได้จนกว่าจะตั้งค่าใหม่`)) return;
            delete stockSheetTemplates[id];
            try {
                // ใช้ updateDoc + dot-notation เพื่อลบ key เฉพาะ ไม่กระทบ field อื่น
                const { deleteField } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
                await updateDoc(doc(db,'config','main'), {
                    [`stockSheetTemplates.${id}`]: deleteField()
                });
            } catch(e) { toast('❌ ลบไม่สำเร็จ: '+e.message,'#c2410c'); return; }
            toast('🗑️ ลบ Template แล้ว','#64748b');
            const tc = document.getElementById('tmplTabContent');
            if(tc) renderSheetTemplateTab(tc);
            switchTmplTab('sheet');
        };

        // ---- Print Stock Sheet Template ----
        window.printStockSheetTemplate = function(id) {
            const t = stockSheetTemplates[id]; if(!t) return;
            const now = new Date();
            const dateStr = now.toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'});
            const groups = [...new Set(t.items.map(i=>i.group||'ทั่วไป'))];

            const tableRows = groups.map(grp=>{
                const grpItems = t.items.filter(i=>(i.group||'ทั่วไป')===grp);
                return `
                <tr><td colspan="5" style="background:#f1f5f9;padding:8px 12px;font-weight:bold;font-size:13px;color:#334155;border-top:2px solid #cbd5e1;">
                    ${grp}
                </td></tr>
                ${grpItems.map((it,i)=>`
                <tr style="${i%2===0?'':'background:#fafafa'}">
                    <td style="padding:9px 12px;font-weight:bold;font-size:12px;border-bottom:1px solid #e2e8f0;">${it.id}</td>
                    <td style="padding:9px 12px;font-size:12px;border-bottom:1px solid #e2e8f0;">${it.name}</td>
                    <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;"></td>
                    <td style="padding:9px 12px;text-align:center;font-size:12px;border-bottom:1px solid #e2e8f0;color:#64748b;">${it.unit}</td>
                    <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;"></td>
                </tr>`).join('')}`;
            }).join('');

            const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
            <style>
                @page{size:A4;margin:15mm}
                body{font-family:'Sarabun',sans-serif;margin:0;color:#1e293b;font-size:13px;}
                .header-box{border:2px solid #1e293b;border-radius:8px;padding:16px 20px;margin-bottom:16px;}
                .header-title{font-size:20px;font-weight:bold;text-align:center;margin-bottom:12px;}
                .header-meta{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;}
                .meta-field{border:1px solid #94a3b8;border-radius:4px;padding:6px 10px;}
                .meta-label{font-size:10px;color:#64748b;font-weight:bold;}
                .meta-val{font-size:13px;min-height:20px;margin-top:2px;}
                table{width:100%;border-collapse:collapse;margin-top:12px;}
                thead tr{background:#1e293b;color:white;}
                th{padding:9px 12px;text-align:left;font-size:12px;}
                .footer{margin-top:32px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;}
                .sign{border-top:1px solid #334155;padding-top:6px;text-align:center;font-size:11px;color:#64748b;padding:40px 0 6px;}
            </style>
            <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap" rel="stylesheet">
            </head><body>
            <div class="header-box">
                <div class="header-title">ใบนับสต๊อกสาขา</div>
                <div class="header-meta">
                    <div class="meta-field"><div class="meta-label">วันที่</div><div class="meta-val">&nbsp;</div></div>
                    <div class="meta-field"><div class="meta-label">สาขา</div><div class="meta-val">${t.zone}</div></div>
                    <div class="meta-field"><div class="meta-label">ผู้ตรวจนับ</div><div class="meta-val">&nbsp;</div></div>
                </div>
            </div>
            <table>
                <thead><tr>
                    <th style="width:110px;">รหัสสินค้า</th>
                    <th>ชื่อสินค้า</th>
                    <th style="width:120px;">จำนวนนับ</th>
                    <th style="width:70px;text-align:center;">หน่วย</th>
                    <th style="width:130px;">หมายเหตุ</th>
                </tr></thead>
                <tbody>${tableRows}</tbody>
            </table>
            <div style="margin-top:12px;font-size:11px;color:#94a3b8;text-align:right;">${t.name} • พิมพ์จาก TTGPlus • ${dateStr}</div>
            <div class="footer">
                <div class="sign">ผู้ตรวจนับ</div>
                <div class="sign">หัวหน้าสาขา</div>
                <div class="sign">ผู้ตรวจสอบ</div>
            </div>
            </body></html>`;

            const w = window.open('','_blank','width=900,height=700');
            w.document.write(html); w.document.close();
            setTimeout(()=>w.print(),800);
        };

        // ======== APPLY STOCK SHEET TEMPLATE TO INV CHECK ========
        window.applyInvTemplate = function(id) {
            const t = stockSheetTemplates[id]; if(!t) return;
            // เปลี่ยน zone dropdown
            const zoneEl = document.getElementById('invZone');
            if(zoneEl) {
                zoneEl.value = t.zone;
                renderInventoryRows();
            }
            toast(`✅ ใช้ Template "${t.name}" แล้ว`,'#059669');
        };

        // ======== BRANCH MONTHLY MENU (เครื่องมือใช้งาน) ========
        // เข้าได้เฉพาะ BT user (ไม่ใช่ BT000) + admin

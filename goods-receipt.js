/**
 * goods-receipt.js — TTGPlus
 * Auto-extracted from home.html
 * Depends on globals: db, currentUser, allProducts, warehouseList,
 *   zoneProductMap, countData, tempCountData, stockSheetTemplates,
 *   warehouseGroups, monthlyCountOpen, productCategories,
 *   saveConfig, toast, goToDashboard, closeTool,
 *   getVisibleWarehouses, getZoneProducts, loadCountData, saveCountData, XLSX
 */
        function genGRNumber() {
            const now = new Date();
            const d = now.toISOString().slice(0,10).replace(/-/g,'');
            return `GR-${d}-${String(Math.floor(Math.random()*900)+100)}`;
        }

        function genLotNumber(productId, date) {
            const d = date.replace(/-/g,'');
            const suffix = String(Math.floor(Math.random()*90)+10);
            return `LOT-${productId}-${d}-${suffix}`;
        }

        // ══════════════════════════════════════════
        // GR STEP 1: สร้างแบบร่าง (Draft)
        // ══════════════════════════════════════════
        // ══════════════════════════════════════════════
        // หน้า 1: สร้างแบบร่าง GR (WAREHOUSE / ADMIN)
        // ══════════════════════════════════════════════
        window.openCreateGR = async function() {
            const role = currentUser?.role||'guest';
            const allowed = role==='admin'||role==='warehouse'||roleSettings[role]?.menus?.includes('admin');
            if(!allowed){ toast('⚠️ เฉพาะ WAREHOUSE / ADMIN เท่านั้น','#c2410c'); return; }

            document.getElementById('dashboardView').classList.add('hidden');
            const c = document.getElementById('toolAppContainer'); c.classList.remove('hidden');
            const today = new Date().toISOString().slice(0,10);
            const todayTxt = today.split('-').reverse().join('/');

            c.innerHTML = `
            <div class="tool-header no-print">
                <div>
                    <h2>📝 สร้างแบบร่าง GR</h2>
                    <p style="margin:4px 0 0;font-size:12px;color:#64748b;">ระบุสินค้าที่คาดว่าจะเข้าและจำนวน — Supplier ดึงจากระบบอัตโนมัติ</p>
                </div>
                <div style="display:flex;gap:8px;">
                    <button onclick="openGRHistory()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;">📄 ประวัติ GR</button>
                    <button onclick="closeTool()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;">✕ ปิด</button>
                </div>
            </div>
            <div style="background:white;border-radius:14px;border:1px solid #e2e8f0;padding:16px;margin-bottom:16px;">
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;">
                    <div class="input-group" style="border:2px solid #06b6d4;margin:0;">
                        <label style="font-size:10px;">📋 GR NUMBER</label>
                        <b id="grNumber" style="font-size:13px;color:#06b6d4;">${genGRNumber()}</b>
                    </div>
                    <div class="input-group" style="border:2px solid var(--danger);margin:0;">
                        <label style="font-size:10px;">📅 วันที่คาดรับสินค้า</label>
                        <input type="date" id="gr_date"
                            value="${today}"
                            style="width:100%;border:none;font-weight:bold;outline:none;font-size:13px;box-sizing:border-box;cursor:pointer;">
                    </div>
                    <div class="input-group" style="margin:0;">
                        <label style="font-size:10px;">📝 หมายเหตุ</label>
                        <input type="text" id="gr_note" placeholder="เช่น รอบส่งพิเศษ, โปรโมชั่น..." style="width:100%;border:none;outline:none;font-size:13px;">
                    </div>
                </div>
            </div>
            <div style="background:white;border-radius:14px;border:1px solid #e2e8f0;padding:20px;margin-bottom:16px;">
                <div style="font-size:12px;font-weight:700;color:#475569;margin-bottom:8px;">🔍 ค้นหาสินค้าเพื่อเพิ่มในร่าง</div>
                <input type="text" id="gr_search" placeholder="พิมพ์รหัสหรือชื่อสินค้า..." oninput="renderGRProductSearch()"
                    style="width:100%;padding:10px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:13px;box-sizing:border-box;outline:none;"
                    onfocus="this.style.borderColor='#06b6d4'" onblur="this.style.borderColor='#e2e8f0'">
                <div id="grSearchResults" style="max-height:200px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:10px;margin-top:6px;display:none;background:white;box-shadow:0 4px 16px rgba(0,0,0,0.1);position:relative;z-index:10;"></div>
            </div>
            <div style="background:white;border-radius:14px;border:1px solid #e2e8f0;overflow:hidden;margin-bottom:24px;">
                <div style="padding:12px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-weight:700;font-size:14px;">📋 รายการสินค้าที่คาดว่าจะเข้า</span>
                    <span id="grItemCount" style="font-size:12px;color:#64748b;">0 รายการ</span>
                </div>
                <div id="grItemsContainer">
                    <div style="padding:40px;text-align:center;color:#94a3b8;">
                        <div style="font-size:36px;margin-bottom:8px;">📦</div>
                        <div>ค้นหาสินค้าด้านบนแล้วกดเพื่อเพิ่ม</div>
                    </div>
                </div>
            </div>
            <div style="text-align:center;" class="no-print">
                <button onclick="saveDraftGR()" style="background:linear-gradient(135deg,#06b6d4,#0891b2);color:white;padding:14px 56px;border:none;border-radius:14px;font-size:16px;font-weight:700;cursor:pointer;box-shadow:0 4px 20px rgba(6,182,212,0.35);">
                    📝 บันทึกแบบร่าง GR
                </button>
            </div>`;

            window._grItems = [];
            renderGRProductSearch();
        };

        window.renderGRProductSearch = function() {
            const q = (document.getElementById('gr_search')?.value||'').toLowerCase().trim();
            const resultsEl = document.getElementById('grSearchResults');
            if(!resultsEl) return;
            if(!q){ resultsEl.style.display='none'; return; }
            const filtered = allProducts.filter(p=>p.id.toLowerCase().includes(q)||p.name.toLowerCase().includes(q)).slice(0,8);
            if(!filtered.length){ resultsEl.style.display='none'; return; }
            resultsEl.style.display='block';
            resultsEl.innerHTML = filtered.map(p=>{
                const already = window._grItems?.find(i=>i.id===p.id);
                const u=(p.units||[{name:p.unit||''}])[0]?.name||'';
                return `<div onclick="addGRItem('${p.id}')"
                    style="padding:10px 14px;cursor:pointer;border-bottom:1px solid #f8fafc;${already?'background:#f0fdf4;':''}"
                    onmouseover="this.style.background='#f0f9ff'" onmouseout="this.style.background='${already?`#f0fdf4`:`white`}'">
                    <div style="font-weight:700;font-size:12px;">${p.id} ${already?'✅':''}</div>
                    <div style="font-size:12px;color:#64748b;">${p.name} <span style="color:#94a3b8;">${u}</span></div>
                    ${p.supplier?`<div style="font-size:10px;color:#06b6d4;">🏢 ${p.supplier}</div>`:''}
                </div>`;
            }).join('');
        };

        window.addGRItem = function(productId) {
            if(!window._grItems) window._grItems=[];
            if(window._grItems.find(i=>i.id===productId)){ toast('⚠️ สินค้านี้อยู่ในรายการแล้ว','#c2410c'); return; }
            const p = allProducts.find(x=>x.id===productId); if(!p) return;
            const u = (p.units||[{name:p.unit||''}])[0]?.name||'';
            window._grItems.push({id:p.id, name:p.name, unit:u, supplier:p.supplier||''});
            document.getElementById('gr_search').value='';
            document.getElementById('grSearchResults').style.display='none';
            renderGRItemsTable();
        };

        window.removeGRItem = function(id) {
            window._grItems = window._grItems.filter(i=>i.id!==id);
            renderGRItemsTable();
        };

        function renderGRItemsTable() {
            const c = document.getElementById('grItemsContainer'); if(!c) return;
            const items = window._grItems||[];
            const countEl = document.getElementById('grItemCount');
            if(countEl) countEl.innerText=`${items.length} รายการ`;
            if(!items.length){
                c.innerHTML=`<div style="padding:40px;text-align:center;color:#94a3b8;"><div style="font-size:36px;margin-bottom:8px;">📦</div><div>ค้นหาสินค้าด้านบนแล้วกดเพื่อเพิ่ม</div></div>`;
                return;
            }
            c.innerHTML=`<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;min-width:480px;">
                <thead><tr style="background:#f8fafc;">
                    <th style="padding:10px 14px;text-align:left;font-size:11px;color:#64748b;font-weight:700;">สินค้า</th>
                    <th style="padding:10px 14px;text-align:left;font-size:11px;color:#06b6d4;font-weight:700;">Supplier</th>
                    <th style="padding:10px 14px;text-align:center;font-size:11px;color:#059669;font-weight:700;">จำนวนคาดรับ</th>
                    <th style="padding:10px 14px;text-align:left;font-size:11px;color:#64748b;font-weight:700;">หมายเหตุ</th>
                    <th style="padding:10px;"></th>
                </tr></thead>
                <tbody>${items.map((it,i)=>`
                <tr style="border-top:1px solid #f1f5f9;${i%2===0?'':'background:#fafafa'}">
                    <td style="padding:12px 14px;">
                        <div style="font-weight:700;font-size:13px;">${it.id}</div>
                        <div style="font-size:12px;color:#64748b;">${it.name}</div>
                        <div style="font-size:10px;color:#94a3b8;">${it.unit}</div>
                    </td>
                    <td style="padding:12px 14px;font-size:12px;color:#06b6d4;font-weight:600;">${it.supplier||'—'}</td>
                    <td style="padding:12px 14px;text-align:center;">
                        <input type="number" id="gr_qty_${it.id}" min="0" placeholder="0"
                            style="width:80px;padding:8px;border:2px solid #10b981;border-radius:8px;text-align:center;font-weight:700;font-size:15px;outline:none;"
                            onfocus="this.style.borderColor='#059669'" onblur="this.style.borderColor='#10b981'">
                        <div style="font-size:10px;color:#64748b;margin-top:2px;">${it.unit}</div>
                    </td>
                    <td style="padding:12px 14px;">
                        <input type="text" id="gr_itemnote_${it.id}" placeholder="หมายเหตุ"
                            style="width:100%;padding:6px 8px;border:1px solid #e2e8f0;border-radius:7px;font-size:11px;box-sizing:border-box;outline:none;">
                    </td>
                    <td style="padding:12px;text-align:center;">
                        <button onclick="removeGRItem('${it.id}')" style="background:#fef2f2;color:#ef4444;border:none;width:28px;height:28px;border-radius:6px;cursor:pointer;font-size:14px;">✕</button>
                    </td>
                </tr>`).join('')}</tbody>
            </table></div>`;
        }

        window.saveDraftGR = async function() {
            const grNumber = document.getElementById('grNumber')?.innerText||genGRNumber();
            const grDate   = document.getElementById('gr_date')?.value;
            const note     = document.getElementById('gr_note')?.value.trim()||'';
            const items    = window._grItems||[];
            if(!grDate){ toast('⚠️ กรุณาระบุวันที่','#c2410c'); return; }
            if(!items.length){ toast('⚠️ กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการ','#c2410c'); return; }
            const [y,m,d] = grDate.split('-');
            const dateTH = `${d}/${m}/${parseInt(y)+543}`;
            const grItems = items.map(it=>({
                id:it.id, name:it.name, unit:it.unit, supplier:it.supplier||'',
                qtyExpected: parseFloat(document.getElementById(`gr_qty_${it.id}`)?.value)||0,
                note: document.getElementById(`gr_itemnote_${it.id}`)?.value||''
            }));
            if(!confirm(`บันทึกแบบร่าง GR ${grNumber}\n${items.length} รายการ | ${dateTH}`)) return;
            await addDoc(collection(db,'goodsReceipts'),{
                grNumber, date:dateTH, grDate, note,
                timestamp:Date.now(), createdBy:currentUser.name,
                items:grItems, status:'draft'
            });
            toast(`📝 บันทึกแบบร่าง ${grNumber} สำเร็จ`,'#059669');
            setTimeout(()=>openGRHistory(), 600);
        };

        function isoToDMY(val) {
            if(!val) return '';
            // รับได้ทั้ง YYYY-MM-DD และ DD/MM/YYYY
            if(val.includes('-') && val.indexOf('-') === 4) {
                const [y,m,d] = val.split('-');
                return d && m ? `${d}/${m}/${parseInt(y)+543}` : val;
            }
            return val; // ถ้าเป็น DD/MM/YYYY อยู่แล้ว return เลย
        }
        function dmyToISO(val) {
            if(!val||val.length!==10) return '';
            const [d,m,y] = val.split('/');
            if(!d||!m||!y||y.length!==4) return '';
            return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
        }
        window.formatDateInput = function(el, hiddenId, checkExp) {
            let v = el.value.replace(/[^0-9]/g,'');
            if(v.length>2) v=v.slice(0,2)+'/'+v.slice(2);
            if(v.length>5) v=v.slice(0,5)+'/'+v.slice(5);
            if(v.length>10) v=v.slice(0,10);
            if(v.length>=5){const mm=parseInt(v.slice(3,5));if(mm>12) v=v.slice(0,3)+'12'+v.slice(5);}
            if(v.length>=2){const dd=parseInt(v.slice(0,2));if(dd>31) v='31'+v.slice(2);if(dd<1&&v.length>=3) v='01'+v.slice(2);}
            el.value=v;
            if(hiddenId){const hidden=document.getElementById(hiddenId);if(hidden){const iso=dmyToISO(v);hidden.value=iso;if(checkExp&&iso)checkExpWarning(hiddenId.replace('gr_exp_','').replace('recv_exp_',''));}}
            if(v.length===10){const iso=dmyToISO(v);el.style.borderColor=iso?(checkExp?'#f59e0b':'#10b981'):'#ef4444';}
        };
        window.checkExpWarning = function(id) {
            const el = document.getElementById(`gr_exp_${id}`)||document.getElementById(`recv_exp_${id}`);
            const val = el?.value;
            const warnEl = document.getElementById(`exp_warn_${id}`);
            if(!val||!warnEl) return;
            const diff=Math.floor((new Date(val)-new Date())/(1000*60*60*24));
            if(diff<0) warnEl.innerHTML='<span style="color:#ef4444;font-weight:bold;">⚠️ หมดอายุแล้ว!</span>';
            else if(diff<=30) warnEl.innerHTML=`<span style="color:#f59e0b;font-weight:bold;">⚠️ เหลือ ${diff} วัน</span>`;
            else warnEl.innerHTML=`<span style="color:#10b981;">✓ เหลือ ${diff} วัน</span>`;
        };

        // ══════════════════════════════════════════════
        // หน้า 2: รับสินค้าจริง (เปิดจาก draft ใน History)
        // ══════════════════════════════════════════════
        window.openReceiveGR = async function(grId) {
            const snap = await getDoc(doc(db,'goodsReceipts',grId));
            if(!snap.exists()){ toast('❌ ไม่พบ GR','#c2410c'); return; }
            const gr = {id:grId, ...snap.data()};
            const usersSnap = await getDocs(collection(db,'users'));
            let staffOpts='';
            usersSnap.forEach(d=>{ const u=d.data(); if(u.status!=='suspended') staffOpts+=`<option value="${u.name}" ${u.name===currentUser.name?'selected':''}>${u.name}</option>`; });
            const warehouseOpts = getVisibleWarehouses().map(z=>`<option value="${z}">${z}</option>`).join('');
            const grDate = gr.grDate||new Date().toISOString().slice(0,10);
            const todayISO = new Date().toISOString().slice(0,10);
            const todayTxt = todayISO.split('-').reverse().join('/');

            const itemRows = (gr.items||[]).map(it=>`
            <div style="background:white;border-radius:12px;border:1px solid #e2e8f0;padding:16px;margin-bottom:12px;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
                    <div>
                        <span style="font-weight:800;font-size:14px;color:#0f172a;">${it.id}</span>
                        <span style="font-size:13px;color:#475569;margin-left:8px;">${it.name}</span>
                        <span style="font-size:11px;color:#94a3b8;margin-left:6px;">(${it.unit})</span>
                        ${it.supplier?`<div style="font-size:11px;color:#06b6d4;margin-top:2px;">🏢 ${it.supplier}</div>`:''}
                    </div>
                    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:6px 12px;text-align:center;min-width:70px;">
                        <div style="font-size:9px;color:#15803d;font-weight:700;">คาดรับ</div>
                        <div style="font-size:20px;font-weight:800;color:#059669;">${it.qtyExpected||'—'}</div>
                        <div style="font-size:10px;color:#64748b;">${it.unit}</div>
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:12px;">
                    <div>
                        <label style="font-size:10px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">📦 คลังที่รับเข้า</label>
                        <select id="recv_zone_${it.id}" style="width:100%;padding:8px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:12px;font-weight:600;outline:none;box-sizing:border-box;">
                            ${warehouseOpts}
                        </select>
                    </div>
                    <div>
                        <label style="font-size:10px;color:#059669;font-weight:700;display:block;margin-bottom:4px;">✅ จำนวนรับจริง</label>
                        <input type="number" id="recv_qty_${it.id}" min="0" placeholder="0"
                            value="${it.qtyReceived||''}"
                            style="width:100%;padding:8px;border:2px solid #10b981;border-radius:8px;text-align:center;font-weight:700;font-size:16px;outline:none;box-sizing:border-box;">
                    </div>
                    <div>
                        <label style="font-size:10px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">🏷️ Lot Number</label>
                        <input type="text" id="recv_lot_${it.id}" placeholder="LOT-..."
                            value="${it.lotNumber||genLotNumber(it.id,grDate)}"
                            style="width:100%;padding:8px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:11px;font-family:monospace;outline:none;box-sizing:border-box;">
                    </div>
                    <div>
                        <label style="font-size:10px;color:#dc2626;font-weight:700;display:block;margin-bottom:4px;">🗓 วันผลิต (MFD)</label>
                        <input type="date" id="recv_mfd_${it.id}"
                            value="${it.mfd||''}"
                            style="width:100%;padding:8px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:12px;outline:none;box-sizing:border-box;cursor:pointer;">
                    </div>
                    <div>
                        <label style="font-size:10px;color:#b45309;font-weight:700;display:block;margin-bottom:4px;">⏰ วันหมดอายุ (EXP)</label>
                        <input type="date" id="recv_exp_${it.id}"
                            value="${it.exp||''}"
                            onchange="checkExpWarning('${it.id}')"
                            style="width:100%;padding:8px;border:2px solid #f59e0b;border-radius:8px;font-size:12px;font-weight:bold;outline:none;box-sizing:border-box;cursor:pointer;">
                        <div id="exp_warn_${it.id}" style="font-size:9px;margin-top:3px;"></div>
                    </div>
                    <div>
                        <label style="font-size:10px;color:#64748b;font-weight:700;display:block;margin-bottom:4px;">📊 สถานะ</label>
                        <select id="recv_status_${it.id}" style="width:100%;padding:8px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:12px;outline:none;box-sizing:border-box;">
                            <option value="complete" ${(it.status||'complete')==='complete'?'selected':''}>✅ ครบ</option>
                            <option value="partial" ${it.status==='partial'?'selected':''}>⚠️ ไม่ครบ</option>
                            <option value="extra" ${it.status==='extra'?'selected':''}>➕ ของแทรก</option>
                            <option value="damaged" ${it.status==='damaged'?'selected':''}>❌ เสียหาย</option>
                        </select>
                    </div>
                </div>
                <div style="background:#f0fdf4;border-radius:8px;padding:10px 14px;border:1px solid #bbf7d0;margin-bottom:8px;">
                    <div style="font-size:10px;color:#15803d;font-weight:800;margin-bottom:8px;">📎 เอกสารที่ได้รับ (รายการนี้)</div>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                        <label style="display:flex;align-items:center;gap:5px;background:white;border:1px solid #d1fae5;padding:5px 10px;border-radius:16px;cursor:pointer;font-size:11px;">
                            <input type="checkbox" id="doc_inv_${it.id}" ${it.docs?.invoice?'checked':''} style="accent-color:#059669;"> ใบกำกับภาษี</label>
                        <label style="display:flex;align-items:center;gap:5px;background:white;border:1px solid #d1fae5;padding:5px 10px;border-radius:16px;cursor:pointer;font-size:11px;">
                            <input type="checkbox" id="doc_rec_${it.id}" ${it.docs?.receipt?'checked':''} style="accent-color:#059669;"> ใบเสร็จ</label>
                        <label style="display:flex;align-items:center;gap:5px;background:white;border:1px solid #d1fae5;padding:5px 10px;border-radius:16px;cursor:pointer;font-size:11px;">
                            <input type="checkbox" id="doc_bil_${it.id}" ${it.docs?.billing?'checked':''} style="accent-color:#059669;"> ใบวางบิล</label>
                        <label style="display:flex;align-items:center;gap:5px;background:white;border:1px solid #d1fae5;padding:5px 10px;border-radius:16px;cursor:pointer;font-size:11px;">
                            <input type="checkbox" id="doc_deb_${it.id}" ${it.docs?.debit?'checked':''} style="accent-color:#059669;"> ใบแจ้งหนี้</label>
                        <div style="display:flex;align-items:center;gap:5px;background:white;border:1px solid #d1fae5;padding:4px 10px;border-radius:16px;">
                            <span style="font-size:11px;white-space:nowrap;">อื่นๆ:</span>
                            <input type="text" id="doc_oth_${it.id}" placeholder="CN, COA..." value="${it.docs?.other||''}"
                                style="border:none;outline:none;font-size:11px;width:100px;background:transparent;">
                        </div>
                    </div>
                </div>
                <input type="text" id="recv_note_${it.id}" placeholder="📝 หมายเหตุรายการนี้ (ถ้ามี)"
                    value="${it.note||''}"
                    style="width:100%;padding:7px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;box-sizing:border-box;outline:none;">
            </div>`).join('');

            const c = document.getElementById('toolAppContainer'); c.classList.remove('hidden');
            document.getElementById('dashboardView').classList.add('hidden');
            c.innerHTML = `
            <div class="tool-header no-print">
                <div>
                    <h2>🚚 รับสินค้าจริง — ${gr.grNumber}</h2>
                    <p style="margin:4px 0 0;font-size:12px;color:#64748b;">กรอกข้อมูลตามจริง • วันที่คาด: ${gr.date}</p>
                </div>
                <div style="display:flex;gap:8px;">
                    <button onclick="openGRHistory()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;">📄 ประวัติ GR</button>
                    <button onclick="closeTool()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;">✕ ปิด</button>
                </div>
            </div>
            <div style="background:white;border-radius:14px;border:1px solid #e2e8f0;padding:16px;margin-bottom:16px;">
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;">
                    <div class="input-group" style="border:2px solid var(--danger);margin:0;">
                        <label style="font-size:10px;">📅 วันที่รับจริง</label>
                        <input type="date" id="recv_date"
                            value="${todayISO}"
                            style="width:100%;border:none;font-weight:bold;outline:none;font-size:13px;box-sizing:border-box;cursor:pointer;">
                    </div>
                    <div class="input-group" style="margin:0;">
                        <label style="font-size:10px;">👤 ผู้รับสินค้า</label>
                        <select id="recv_receiver" style="width:100%;border:none;font-weight:bold;outline:none;font-size:13px;">
                            ${staffOpts}
                        </select>
                    </div>
                    <div class="input-group" style="margin:0;">
                        <label style="font-size:10px;">📝 หมายเหตุรวม</label>
                        <input type="text" id="recv_note_general" placeholder="รถช้า, ของไม่ครบ..." value="${gr.note||''}"
                            style="width:100%;border:none;outline:none;font-size:13px;">
                    </div>
                </div>
            </div>
            <div style="margin-bottom:24px;">
                <div style="font-weight:700;font-size:14px;color:#0f172a;margin-bottom:12px;">
                    📦 รายการสินค้า (${gr.items?.length||0} รายการ)
                </div>
                ${itemRows}
            </div>
            <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;" class="no-print">
                <button onclick="saveReceiveGR('${grId}','draft')"
                    style="background:white;color:#475569;padding:13px 32px;border:2px solid #e2e8f0;border-radius:14px;font-size:14px;font-weight:700;cursor:pointer;">
                    💾 บันทึก (ยังไม่ส่งอนุมัติ)
                </button>
                <button onclick="saveReceiveGR('${grId}','pending')"
                    style="background:linear-gradient(135deg,#06b6d4,#0891b2);color:white;padding:13px 40px;border:none;border-radius:14px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 4px 20px rgba(6,182,212,0.35);">
                    📨 บันทึกและส่งขออนุมัติ
                </button>
            </div>`;
        };

        window.saveReceiveGR = async function(grId, newStatus) {
            const snap = await getDoc(doc(db,'goodsReceipts',grId));
            if(!snap.exists()){ toast('❌ ไม่พบ GR','#c2410c'); return; }
            const gr = snap.data();
            const receiver = document.getElementById('recv_receiver')?.value||currentUser.name;
            const noteGeneral = document.getElementById('recv_note_general')?.value||'';
            const recvDateISO = document.getElementById('recv_date')?.value||new Date().toISOString().slice(0,10);
            const [ry,rm,rd] = recvDateISO.split('-');
            const recvDateTH = `${rd}/${rm}/${parseInt(ry)+543}`;
            const updatedItems = (gr.items||[]).map(it=>({
                ...it,
                zone:        document.getElementById(`recv_zone_${it.id}`)?.value||'',
                qtyReceived: parseFloat(document.getElementById(`recv_qty_${it.id}`)?.value)||0,
                lotNumber:   document.getElementById(`recv_lot_${it.id}`)?.value||'',
                mfd:         document.getElementById(`recv_mfd_${it.id}`)?.value||'',
                exp:         document.getElementById(`recv_exp_${it.id}`)?.value||'',
                status:      document.getElementById(`recv_status_${it.id}`)?.value||'complete',
                note:        document.getElementById(`recv_note_${it.id}`)?.value||'',
                docs:{
                    invoice: document.getElementById(`doc_inv_${it.id}`)?.checked||false,
                    receipt: document.getElementById(`doc_rec_${it.id}`)?.checked||false,
                    billing: document.getElementById(`doc_bil_${it.id}`)?.checked||false,
                    debit:   document.getElementById(`doc_deb_${it.id}`)?.checked||false,
                    other:   document.getElementById(`doc_oth_${it.id}`)?.value||''
                }
            }));
            if(newStatus==='pending'){
                const missing = updatedItems.filter(i=>i.qtyReceived<=0&&i.status!=='damaged');
                if(missing.length&&!confirm(`⚠️ มี ${missing.length} รายการยังไม่กรอกจำนวน ยืนยันส่งอนุมัติต่อไหม?`)) return;
            }
            await updateDoc(doc(db,'goodsReceipts',grId),{
                items:updatedItems, receiver, note:noteGeneral,
                recvDate:recvDateTH, recvDateISO,
                status:newStatus, updatedAt:Date.now(), updatedBy:currentUser.name
            });
            const msg = newStatus==='pending'?'📨 ส่งขออนุมัติสำเร็จ':'💾 บันทึกแล้ว';
            toast(msg,'#059669');
            setTimeout(()=>openGRHistory(), 600);
        };

        window._applyGRToLot = async function(grItems, grNumber, grDate, defaultZone) {
            const lotRef = doc(db,'config','lotRegister');
            const lotSnap = await getDoc(lotRef);
            const lotData = lotSnap.exists()?(lotSnap.data().lots||{}):{};
            grItems.forEach(it=>{
                if(!it.qtyReceived||it.qtyReceived<=0) return;
                if(!lotData[it.id]) lotData[it.id]=[];
                lotData[it.id].push({
                    lotNumber:it.lotNumber||'', qtyReceived:it.qtyReceived,
                    qtyRemaining:it.qtyReceived, mfd:it.mfd||'', exp:it.exp||'',
                    grNumber, grDate, zone:it.zone||defaultZone, status:'active'
                });
                lotData[it.id].sort((a,b)=>{if(!a.exp)return 1;if(!b.exp)return -1;return new Date(a.exp)-new Date(b.exp);});
            });
            await setDoc(lotRef,{lots:lotData},{merge:true});
        };

        window.approveGR = async function(grId) {
            const isAdmin = currentUser?.role==='admin'||roleSettings[currentUser?.role]?.menus?.includes('admin');
            if(!isAdmin){ toast('⚠️ ไม่มีสิทธิ์อนุมัติ','#c2410c'); return; }
            if(!confirm('ยืนยันอนุมัติ GR นี้? Stock จะถูกอัปเดตทันที')) return;
            const snap = await getDoc(doc(db,'goodsReceipts',grId));
            if(!snap.exists()) return;
            const gr = snap.data();
            await updateDoc(doc(db,'goodsReceipts',grId),{status:'approved',approvedBy:currentUser.name,approvedAt:Date.now()});
            await _applyGRToLot(gr.items||[], gr.grNumber, gr.recvDateISO||gr.grDate||'', gr.zone||'');
            toast(`✅ อนุมัติ ${gr.grNumber} — Stock อัปเดตแล้ว`,'#059669');
            openGRHistory();
        };

        window.rejectGR = async function(grId) {
            const isAdmin = currentUser?.role==='admin'||roleSettings[currentUser?.role]?.menus?.includes('admin');
            if(!isAdmin){ toast('⚠️ ไม่มีสิทธิ์','#c2410c'); return; }
            const reason = prompt('เหตุผลที่ปฏิเสธ:')??'';
            if(reason===null) return;
            await updateDoc(doc(db,'goodsReceipts',grId),{status:'rejected',rejectedBy:currentUser.name,rejectedAt:Date.now(),rejectReason:reason});
            toast('❌ ปฏิเสธ GR แล้ว','#ef4444');
            openGRHistory();
        };

        window.saveGR = async function(){ toast('⚠️ กรุณาใช้ระบบสร้างแบบร่างใหม่','#c2410c'); };

        // ════ GR HISTORY ════
        window.openGRHistory = async function() {
            document.getElementById('dashboardView').classList.add('hidden');
            const c = document.getElementById('toolAppContainer'); c.classList.remove('hidden');
            c.innerHTML=`<div class="tool-header"><h2>📄 ประวัติ GR</h2></div><p style="text-align:center;color:#94a3b8;padding:30px;">⏳ กำลังโหลด...</p>`;

            const snap = await getDocs(collection(db,'goodsReceipts'));
            let allGRDocs = [];
            snap.forEach(d=>allGRDocs.push({id:d.id,...d.data()}));
            allGRDocs.sort((a,b)=>b.timestamp-a.timestamp);
            window._allGRDocs = allGRDocs;

            const isAdmin = currentUser?.role==='admin'||currentUser?.role==='warehouse'||roleSettings[currentUser?.role]?.menus?.includes('admin');
            const pendingCount = allGRDocs.filter(g=>g.status==='pending').length;

            const draftCount    = allGRDocs.filter(g=>g.status==='draft'||g.status==='pending'||g.status==='rejected').length;
            const approvedCount = allGRDocs.filter(g=>g.status==='approved'||g.status==='completed').length;

            c.innerHTML=`
            <div class="tool-header">
                <h2>📄 ประวัติการรับสินค้า</h2>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    ${pendingCount>0&&isAdmin?`<span style="background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;" onclick="switchGRTab('draft')">⏳ รออนุมัติ ${pendingCount} รายการ</span>`:''}
                    <button onclick="openCreateGR()" style="background:#06b6d4;color:white;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-weight:bold;">+ สร้าง GR</button>
                    <button onclick="exportGRExcel()" style="background:#059669;color:white;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-weight:bold;">📥 Excel</button>
                    <button onclick="goToDashboard()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;">🏠</button>
                    <button onclick="closeTool()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;">✕</button>
                </div>
            </div>
            <div style="display:flex;gap:0;margin-bottom:16px;border-bottom:2px solid #e2e8f0;flex-wrap:wrap;">
                <button id="grTab_draft" onclick="switchGRTab('draft')"
                    style="padding:10px 20px;border:none;background:none;cursor:pointer;font-size:13px;font-weight:600;color:#94a3b8;border-bottom:3px solid transparent;margin-bottom:-2px;font-family:inherit;">
                    📝 แบบร่าง <span style="background:#f1f5f9;color:#64748b;border-radius:10px;padding:1px 8px;font-size:11px;margin-left:4px;">${allGRDocs.filter(g=>g.status==='draft').length}</span>
                </button>
                <button id="grTab_pending" onclick="switchGRTab('pending')"
                    style="padding:10px 20px;border:none;background:none;cursor:pointer;font-size:13px;font-weight:600;color:#94a3b8;border-bottom:3px solid transparent;margin-bottom:-2px;font-family:inherit;">
                    ⏳ รับสินค้า / รออนุมัติ <span style="background:#fff7ed;color:#c2410c;border-radius:10px;padding:1px 8px;font-size:11px;margin-left:4px;">${pendingCount}</span>
                </button>
                <button id="grTab_approved" onclick="switchGRTab('approved')"
                    style="padding:10px 20px;border:none;background:none;cursor:pointer;font-size:13px;font-weight:700;color:#06b6d4;border-bottom:3px solid #06b6d4;margin-bottom:-2px;font-family:inherit;">
                    📋 บันทึกรับสินค้า <span style="background:#e0f2fe;color:#0369a1;border-radius:10px;padding:1px 8px;font-size:11px;margin-left:4px;">${approvedCount}</span>
                </button>
            </div>
            <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
                <input type="text" id="grFilterDate" placeholder="กรองวันที่ dd/mm/yyyy" maxlength="10" inputmode="numeric"
                    oninput="formatDateInput(this,null);renderGRHistoryList()"
                    style="padding:8px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;outline:none;width:160px;">
            </div>
            <div id="grHistoryList"></div>`;

            window._grCurrentTab = 'approved';
            window.switchGRTab = function(tab) {
                window._grCurrentTab = tab;
                ['approved','draft','pending'].forEach(t=>{
                    const el = document.getElementById('grTab_'+t);
                    if(!el) return;
                    if(t===tab){ el.style.color='#06b6d4'; el.style.borderBottomColor='#06b6d4'; el.style.fontWeight='700'; }
                    else { el.style.color='#94a3b8'; el.style.borderBottomColor='transparent'; el.style.fontWeight='600'; }
                });
                renderGRHistoryList();
            };
            renderGRHistoryList();
        };

        window.renderGRHistoryList = function() {
            const dateFilter = document.getElementById('grFilterDate')?.value||'';
            const allDocs = window._allGRDocs||[];
            const isAdmin = currentUser?.role==='admin'||currentUser?.role==='warehouse'||roleSettings[currentUser?.role]?.menus?.includes('admin');
            const currentTab = window._grCurrentTab||'approved';

            const filtered = allDocs.filter(gr=>{
                if(currentTab==='approved' && gr.status!=='approved' && gr.status!=='completed') return false;
                if(currentTab==='draft'    && gr.status!=='draft') return false;
                if(currentTab==='pending'  && gr.status!=='pending' && gr.status!=='rejected') return false;
                if(dateFilter && dateFilter.length===10 && gr.date!==dateFilter) return false;
                return true;
            });

            const SC = {
                draft:    {label:'📝 แบบร่าง',   bg:'#f1f5f9',color:'#475569',border:'#e2e8f0',lb:'#cbd5e1'},
                pending:  {label:'⏳ รออนุมัติ', bg:'#fff7ed',color:'#c2410c',border:'#fed7aa',lb:'#f59e0b'},
                approved: {label:'✅ อนุมัติ',   bg:'#f0fdf4',color:'#059669',border:'#bbf7d0',lb:'#10b981'},
                rejected: {label:'❌ ปฏิเสธ',   bg:'#fef2f2',color:'#dc2626',border:'#fecaca',lb:'#ef4444'},
                completed:{label:'✅ เสร็จสิ้น', bg:'#f0fdf4',color:'#059669',border:'#bbf7d0',lb:'#10b981'},
            };

            const container = document.getElementById('grHistoryList');
            if(!container) return;
            if(!filtered.length){ container.innerHTML='<p style="text-align:center;color:#94a3b8;padding:40px;">ไม่พบรายการ</p>'; return; }

            container.innerHTML = filtered.map(gr=>{
                const sc = SC[gr.status]||SC.draft;
                const isDraft = gr.status==='draft';
                const isPending = gr.status==='pending';
                const isApproved = gr.status==='approved'||gr.status==='completed';
                const itemSummary = (gr.items||[]).slice(0,3).map(it=>it.id).join(', ')+(gr.items?.length>3?` +${gr.items.length-3} อื่นๆ`:'');
                return `<div class="history-card" style="border-left:4px solid ${sc.lb};">
                    <div class="history-card-header" style="cursor:pointer;" onclick="toggleDetail('ghd_${gr.id}')">
                        <div style="flex:1;">
                            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                                <span style="font-weight:700;font-size:14px;color:#06b6d4;">${gr.grNumber}</span>
                                <span style="background:${sc.bg};color:${sc.color};border:1px solid ${sc.border};font-size:10px;padding:2px 10px;border-radius:10px;font-weight:700;">${sc.label}</span>
                                ${isApproved&&gr.approvedBy?`<span style="font-size:10px;color:#059669;">✓ ${gr.approvedBy}</span>`:''}
                                ${gr.status==='rejected'&&gr.rejectReason?`<span style="font-size:10px;color:#dc2626;">${gr.rejectReason}</span>`:''}
                            </div>
                            <div style="font-size:12px;color:#64748b;margin-top:3px;">
                                📅 ${gr.date||'-'} • 👤 ${gr.createdBy||'-'}
                                ${gr.items?.length?` • ${gr.items.length} SKU: ${itemSummary}`:''}
                            </div>
                        </div>
                        <span style="font-size:18px;color:#94a3b8;">▾</span>
                    </div>
                    <div id="ghd_${gr.id}" style="display:none;padding:14px 16px;border-top:1px solid #f1f5f9;">
                        <!-- ตารางรายการ draft -->
                        <div style="overflow-x:auto;margin-bottom:12px;">
                        <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:400px;">
                            <thead><tr style="background:#f8fafc;">
                                <th style="padding:7px 10px;text-align:left;">สินค้า</th>
                                <th style="padding:7px 10px;text-align:center;">Supplier</th>
                                <th style="padding:7px 10px;text-align:center;">คาดรับ</th>
                                ${!isDraft?`<th style="padding:7px 10px;text-align:center;">รับจริง</th>
                                <th style="padding:7px 10px;text-align:center;">คลัง</th>
                                <th style="padding:7px 10px;text-align:center;">Lot</th>
                                <th style="padding:7px 10px;text-align:center;">EXP</th>
                                <th style="padding:7px 10px;text-align:center;">เอกสาร</th>`:''}
                                <th style="padding:7px 10px;text-align:center;">สถานะ</th>
                            </tr></thead>
                            <tbody>${(gr.items||[]).map(it=>{
                                // ข้อมูลรับอยู่ใน it โดยตรง (saveReceiveGR เก็บลง items[])
                                const iSC = {complete:'#10b981',partial:'#f59e0b',damaged:'#ef4444',extra:'#3b82f6'};
                                const iSL = {complete:'ครบ',partial:'ไม่ครบ',damaged:'เสียหาย',extra:'ของแทรก'};
                                const docList = [];
                                if(it.docs?.invoice) docList.push('ใบกำกับ');
                                if(it.docs?.receipt) docList.push('ใบเสร็จ');
                                if(it.docs?.billing) docList.push('ใบวางบิล');
                                if(it.docs?.debit)   docList.push('ใบแจ้งหนี้');
                                if(it.docs?.other)   docList.push(it.docs.other);
                                const expDisp = it.exp ? isoToDMY(it.exp) : '-';
                                const mfdDisp = it.mfd ? isoToDMY(it.mfd) : '-';
                                return `<tr style="border-top:1px solid #f1f5f9;">
                                    <td style="padding:7px 10px;"><b>${it.id}</b><br><span style="color:#64748b;font-size:11px;">${it.name}</span></td>
                                    <td style="padding:7px 10px;text-align:center;font-size:11px;color:#06b6d4;">${it.supplier||'-'}</td>
                                    <td style="padding:7px 10px;text-align:center;">${it.qtyExpected||'-'} ${it.unit}</td>
                                    ${!isDraft?`<td style="padding:7px 10px;text-align:center;font-weight:700;color:#059669;">${it.qtyReceived>0?it.qtyReceived+' '+it.unit:'-'}</td>
                                    <td style="padding:7px 10px;text-align:center;font-size:11px;">${it.zone||'-'}</td>
                                    <td style="padding:7px 10px;text-align:center;font-family:monospace;font-size:10px;color:#06b6d4;">${it.lotNumber||'-'}</td>
                                    <td style="padding:7px 10px;text-align:center;font-size:11px;">${expDisp}</td>
                                    <td style="padding:7px 10px;font-size:10px;">${docList.join(', ')||'-'}</td>`:''}
                                    <td style="padding:7px 10px;text-align:center;">
                                        ${!isDraft&&it.status?`<span style="background:${(iSC[it.status]||'#64748b')}18;color:${iSC[it.status]||'#64748b'};padding:2px 7px;border-radius:7px;font-size:10px;font-weight:700;">${iSL[it.status]||it.status}</span>`:'-'}
                                    </td>
                                </tr>`;
                            }).join('')}</tbody>
                        </table>
                        </div>
                        ${gr.note?`<div style="font-size:12px;color:#64748b;padding:6px 10px;background:#f8fafc;border-radius:7px;margin-bottom:10px;">📝 ${gr.note}</div>`:''}
                        <!-- ปุ่มดำเนินการ -->
                        <div style="display:flex;gap:8px;flex-wrap:wrap;">
                            ${isDraft?`<button onclick="openReceiveGR('${gr.id}')" style="background:#06b6d4;color:white;border:none;padding:7px 16px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;">🚚 เปิดรับสินค้าจริง</button>`:''}
                            ${(isDraft||isPending)?`<button onclick="openReceiveGR('${gr.id}')" style="background:#eff6ff;color:#3b82f6;border:1px solid #bfdbfe;padding:7px 14px;border-radius:8px;cursor:pointer;font-size:12px;">✏️ แก้ไขข้อมูลรับ</button>`:''}
                            ${isAdmin&&isPending?`
                            <button onclick="approveGR('${gr.id}')" style="background:#f0fdf4;color:#059669;border:1px solid #bbf7d0;padding:7px 14px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;">✅ อนุมัติ</button>
                            <button onclick="rejectGR('${gr.id}')" style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;padding:7px 14px;border-radius:8px;cursor:pointer;font-size:12px;">❌ ปฏิเสธ</button>`:''}
                            <button onclick="exportGRPDF('${gr.id}')" style="background:#7c3aed;color:white;border:none;padding:7px 14px;border-radius:8px;cursor:pointer;font-size:12px;">📄 PDF</button>
                            ${isAdmin?`<button onclick="deleteGR('${gr.id}','${gr.grNumber}')" style="background:#fef2f2;color:#ef4444;border:1px solid #fecaca;padding:7px 14px;border-radius:8px;cursor:pointer;font-size:12px;">🗑️ ลบ</button>`:''}
                        </div>
                    </div>
                </div>`;
            }).join('');
        };

        window.toggleDetail = function(id) {
            const el=document.getElementById(id); if(!el) return;
            el.style.display=el.style.display==='none'?'block':'none';
        };

// ── GR EDIT & DELETE (Admin) ──────────────────────
        window.deleteGR = async function(grId, grNumber) {
            const confirmText = prompt(`พิมพ์เลข GR "${grNumber}" เพื่อยืนยันการลบ:`);
            if(confirmText?.trim() !== grNumber) { toast('❌ ยกเลิก — GR Number ไม่ตรง','#c2410c'); return; }
            try {
                await deleteDoc(doc(db,'goodsReceipts',grId));
                toast(`🗑️ ลบ ${grNumber} เรียบร้อย`,'#059669');
                openGRHistory();
            } catch(e) { toast('❌ ลบไม่สำเร็จ: '+e.message,'#c2410c'); }
        };

        window.editGR = async function(grId) {
            const snap = await getDoc(doc(db,'goodsReceipts',grId));
            if(!snap.exists()) { toast('❌ ไม่พบ GR','#c2410c'); return; }
            const gr = { id:grId, ...snap.data() };
            const modal = document.createElement('div');
            modal.id = 'grEditModal';
            modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;';
            const itemRows = (gr.items||[]).map(it=>`
                <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:8px;font-size:12px;"><b>${it.id}</b><br>${it.name}</td>
                    <td style="padding:8px;text-align:center;">
                        <input type="number" id="gredit_qty_${it.id}" value="${it.qtyReceived||0}" min="0"
                            style="width:70px;padding:5px;border:1.5px solid #10b981;border-radius:6px;text-align:center;font-weight:700;font-size:13px;outline:none;">
                    </td>
                    <td style="padding:8px;text-align:center;">
                        <input type="text" id="gredit_mfd_${it.id}" value="${it.mfd?isoToDMY(it.mfd):''}" placeholder="dd/mm/yyyy" maxlength="10"
                            oninput="formatDateInput(this,'gredit_mfd_iso_${it.id}')"
                            style="width:100px;padding:5px;border:1px solid #e2e8f0;border-radius:6px;text-align:center;font-size:12px;outline:none;">
                        <input type="hidden" id="gredit_mfd_iso_${it.id}" value="${it.mfd||''}">
                    </td>
                    <td style="padding:8px;text-align:center;">
                        <input type="text" id="gredit_exp_${it.id}" value="${it.exp?isoToDMY(it.exp):''}" placeholder="dd/mm/yyyy" maxlength="10"
                            oninput="formatDateInput(this,'gredit_exp_iso_${it.id}')"
                            style="width:100px;padding:5px;border:2px solid #f59e0b;border-radius:6px;text-align:center;font-size:12px;outline:none;font-weight:bold;">
                        <input type="hidden" id="gredit_exp_iso_${it.id}" value="${it.exp||''}">
                    </td>
                    <td style="padding:8px;text-align:center;">
                        <select id="gredit_status_${it.id}" style="padding:5px;border:1px solid #e2e8f0;border-radius:6px;font-size:11px;outline:none;">
                            <option value="complete" ${it.status==='complete'?'selected':''}>✅ ครบ</option>
                            <option value="partial" ${it.status==='partial'?'selected':''}>⚠️ ไม่ครบ</option>
                            <option value="extra" ${it.status==='extra'?'selected':''}>➕ ของแทรก</option>
                            <option value="damaged" ${it.status==='damaged'?'selected':''}>❌ เสียหาย</option>
                        </select>
                    </td>
                </tr>`).join('');
            modal.innerHTML = `
                <div style="background:white;border-radius:16px;width:100%;max-width:780px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
                    <div style="background:#06b6d4;padding:16px 20px;border-radius:16px 16px 0 0;display:flex;justify-content:space-between;align-items:center;">
                        <div style="color:white;font-weight:800;font-size:15px;">✏️ แก้ไข GR: ${gr.grNumber}</div>
                        <button onclick="document.getElementById('grEditModal').remove()" style="background:rgba(255,255,255,0.2);color:white;border:none;padding:6px 12px;border-radius:8px;cursor:pointer;font-size:14px;">✕</button>
                    </div>
                    <div style="padding:20px;">
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">
                            <div>
                                <label style="font-size:11px;color:#64748b;font-weight:700;">🏢 SUPPLIER</label>
                                <input type="text" id="gredit_supplier" value="${gr.supplier||''}"
                                    style="width:100%;padding:8px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;font-weight:600;box-sizing:border-box;outline:none;">
                            </div>
                            <div>
                                <label style="font-size:11px;color:#64748b;font-weight:700;">📝 หมายเหตุ</label>
                                <input type="text" id="gredit_note" value="${gr.note||''}" placeholder="หมายเหตุ"
                                    style="width:100%;padding:8px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;outline:none;">
                            </div>
                        </div>
                        <div style="background:#fef9f0;border:1px solid #fde68a;border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#92400e;">
                            ⚠️ <b>เฉพาะ Admin</b> — การแก้ไขจะถูกบันทึกใน Audit Log อัตโนมัติ
                        </div>
                        <div style="overflow-x:auto;">
                            <table style="width:100%;border-collapse:collapse;font-size:12px;">
                                <thead><tr style="background:#f8fafc;">
                                    <th style="padding:8px;text-align:left;">สินค้า</th>
                                    <th style="padding:8px;text-align:center;">จำนวนรับ</th>
                                    <th style="padding:8px;text-align:center;">MFD</th>
                                    <th style="padding:8px;text-align:center;">EXP</th>
                                    <th style="padding:8px;text-align:center;">สถานะ</th>
                                </tr></thead>
                                <tbody>${itemRows}</tbody>
                            </table>
                        </div>
                        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
                            <button onclick="document.getElementById('grEditModal').remove()" style="background:#f1f5f9;color:#64748b;border:none;padding:10px 20px;border-radius:10px;cursor:pointer;font-weight:600;">ยกเลิก</button>
                            <button onclick="saveEditGR('${gr.id}')" style="background:linear-gradient(135deg,#06b6d4,#0891b2);color:white;border:none;padding:10px 24px;border-radius:10px;cursor:pointer;font-weight:700;">💾 บันทึกการแก้ไข</button>
                        </div>
                    </div>
                </div>`;
            document.body.appendChild(modal);
        };

        window.saveEditGR = async function(grId) {
            const snap = await getDoc(doc(db,'goodsReceipts',grId));
            if(!snap.exists()) return;
            const original = snap.data();
            const updatedItems = (original.items||[]).map(it=>({
                ...it,
                qtyReceived: parseFloat(document.getElementById(`gredit_qty_${it.id}`)?.value)||it.qtyReceived,
                mfd: document.getElementById(`gredit_mfd_iso_${it.id}`)?.value||it.mfd||'',
                exp: document.getElementById(`gredit_exp_iso_${it.id}`)?.value||it.exp||'',
                status: document.getElementById(`gredit_status_${it.id}`)?.value||it.status,
            }));
            const supplier = document.getElementById('gredit_supplier')?.value.trim()||original.supplier||'';
            const note = document.getElementById('gredit_note')?.value.trim()||original.note||'';
            const auditEntry = {
                editedBy: currentUser?.name||'admin',
                editedAt: Date.now(),
                original: { supplier:original.supplier, note:original.note, items:original.items }
            };
            try {
                await updateDoc(doc(db,'goodsReceipts',grId), {
                    supplier, note, items: updatedItems,
                    lastEditedBy: currentUser?.name,
                    lastEditedAt: Date.now(),
                    auditLog: [...(original.auditLog||[]), auditEntry]
                });
                document.getElementById('grEditModal')?.remove();
                toast('✅ แก้ไข GR เรียบร้อย','#059669');
                openGRHistory();
            } catch(e) { toast('❌ แก้ไขไม่สำเร็จ: '+e.message,'#c2410c'); }
        };

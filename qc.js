/**
 * qc.js — TTGPlus
 * Auto-extracted from home.html
 * Depends on globals: db, currentUser, allProducts, warehouseList,
 *   zoneProductMap, countData, tempCountData, stockSheetTemplates,
 *   warehouseGroups, monthlyCountOpen, productCategories,
 *   saveConfig, toast, goToDashboard, closeTool,
 *   getVisibleWarehouses, getZoneProducts, loadCountData, saveCountData, XLSX
 */
        window.openQCCheck = async function() {
            document.getElementById('dashboardView').classList.add('hidden');
            const c = document.getElementById('toolAppContainer'); c.classList.remove('hidden');

            const lotSnap = await getDoc(doc(db,'config','lotRegister'));
            const lots = lotSnap.exists() ? (lotSnap.data().lots||{}) : {};
            const today = new Date().toISOString().slice(0,10);
            const checkNo = `QC-${today.replace(/-/g,'')}-${String(Math.floor(Math.random()*900)+100)}`;

            const productsWithLots = Object.keys(lots).filter(id=>lots[id].some(l=>l.qtyRemaining>0));

            c.innerHTML=`
            <div class="tool-header no-print">
                <div>
                    <h2>🔍 FIFO Spot Check</h2>
                    <p style="margin:4px 0 0;font-size:12px;color:#64748b;">ตรวจสอบว่าหยิบของตาม FIFO หรือไม่</p>
                </div>
                <div style="display:flex;gap:8px;">
                    <button onclick="openQCHistory()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;">📊 ประวัติ QC</button>
                    <button onclick="closeTool()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;">✕ ปิด</button>
                </div>
            </div>

            <div style="background:linear-gradient(135deg,#faf5ff,#f3e8ff);border:1.5px solid #c4b5fd;border-radius:14px;padding:16px 20px;margin-bottom:20px;">
                <div style="display:flex;gap:16px;flex-wrap:wrap;">
                    <div><span style="font-size:10px;color:#7c3aed;font-weight:700;display:block;">QC Check No.</span><b style="color:#7c3aed;">${checkNo}</b></div>
                    <div><span style="font-size:10px;color:#7c3aed;font-weight:700;display:block;">ผู้ตรวจ</span><b>${currentUser.name}</b></div>
                    <div><span style="font-size:10px;color:#7c3aed;font-weight:700;display:block;">วันที่</span><b>${today}</b></div>
                </div>
            </div>

            <div style="background:white;border-radius:14px;border:1px solid #e2e8f0;padding:20px;margin-bottom:20px;">
                <div style="font-weight:700;margin-bottom:12px;">เลือกสินค้าที่จะสุ่มตรวจ</div>
                <input type="text" placeholder="🔍 ค้นหาสินค้า..." oninput="filterQCProducts(this.value)"
                    style="width:100%;padding:10px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:13px;box-sizing:border-box;outline:none;margin-bottom:12px;">
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;" id="qcProductGrid">
                    ${productsWithLots.map(pid=>{
                        const p=allProducts.find(x=>x.id===pid);
                        const activeLots=lots[pid].filter(l=>l.qtyRemaining>0);
                        const oldest=activeLots[0];
                        return `<div class="qc-prod-card" data-search="${pid.toLowerCase()} ${(p?.name||'').toLowerCase()}"
                            onclick="selectQCProduct('${pid}')" id="qccard_${pid}"
                            style="padding:12px;border:2px solid #e2e8f0;border-radius:12px;cursor:pointer;transition:all 0.15s;"
                            onmouseover="this.style.borderColor='#a855f7'" onmouseout="if(!this.classList.contains('selected'))this.style.borderColor='#e2e8f0'">
                            <div style="font-weight:700;font-size:12px;">${pid}</div>
                            <div style="font-size:11px;color:#64748b;margin:2px 0;">${p?.name||''}</div>
                            <div style="font-size:10px;font-family:monospace;color:#06b6d4;background:#f0f9ff;padding:2px 6px;border-radius:4px;display:inline-block;margin-top:4px;">${oldest?.lotNumber||'-'}</div>
                        </div>`;
                    }).join('')}
                    ${!productsWithLots.length?'<p style="color:#94a3b8;font-size:13px;grid-column:1/-1;">ยังไม่มี Lot ในระบบ — กรุณารับสินค้าเข้าคลังก่อน</p>':''}
                </div>
            </div>

            <div id="qcCheckItems"></div>

            <div id="qcSaveBtn" style="display:none;text-align:center;margin-top:24px;" class="no-print">
                <button onclick="saveQCCheck('${checkNo}')" style="background:linear-gradient(135deg,#7c3aed,#6d28d9);color:white;padding:16px 60px;border:none;border-radius:14px;font-size:17px;font-weight:700;cursor:pointer;box-shadow:0 4px 20px rgba(124,58,237,0.35);">
                    💾 บันทึก QC Spot Check
                </button>
            </div>`;
            window._qcItems = {};
            window._qcLots = lots;
        };

        window.filterQCProducts = function(q) {
            q = q.toLowerCase().trim();
            document.querySelectorAll('.qc-prod-card').forEach(el=>{
                el.style.display = (!q||el.dataset.search.includes(q)) ? '' : 'none';
            });
        };

        window.selectQCProduct = function(pid) {
            const card = document.getElementById(`qccard_${pid}`);
            if(card.classList.contains('selected')) {
                card.classList.remove('selected');
                card.style.borderColor='#e2e8f0';
                card.style.background='white';
                delete window._qcItems[pid];
            } else {
                card.classList.add('selected');
                card.style.borderColor='#a855f7';
                card.style.background='#faf5ff';
                window._qcItems[pid]={result:'',foundLot:'',location:'',note:''};
            }
            renderQCCheckForm();
        };

        function renderQCCheckForm() {
            const c = document.getElementById('qcCheckItems'); if(!c) return;
            const selected = Object.keys(window._qcItems);
            if(!selected.length) { c.innerHTML=''; document.getElementById('qcSaveBtn').style.display='none'; return; }
            document.getElementById('qcSaveBtn').style.display='block';
            const lots = window._qcLots||{};

            c.innerHTML=`
            <div style="background:white;border-radius:14px;border:1px solid #e2e8f0;overflow:hidden;">
                <div style="padding:14px 20px;background:#faf5ff;border-bottom:1px solid #e8d5ff;">
                    <span style="font-weight:700;color:#7c3aed;">📋 กรอกผลการตรวจ (${selected.length} รายการ)</span>
                </div>
                ${selected.map(pid=>{
                    const p=allProducts.find(x=>x.id===pid);
                    const activeLots=(lots[pid]||[]).filter(l=>l.qtyRemaining>0);
                    const expectedLot=activeLots[0];
                    return `
                    <div style="padding:20px;border-bottom:1px solid #f1f5f9;">
                        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
                            <div>
                                <span style="font-weight:700;font-size:14px;">${pid}</span>
                                <span style="color:#64748b;font-size:13px;margin-left:8px;">${p?.name||''}</span>
                            </div>
                            <button onclick="selectQCProduct('${pid}')" style="background:#fef2f2;color:#ef4444;border:none;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:11px;">✕ ยกเลิก</button>
                        </div>

                        <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:12px 16px;margin-bottom:14px;">
                            <div style="font-size:11px;font-weight:700;color:#0369a1;margin-bottom:4px;">📌 FIFO — ควรหยิบ Lot นี้ก่อน:</div>
                            <div style="font-family:monospace;font-size:13px;color:#06b6d4;font-weight:bold;">${expectedLot?.lotNumber||'ไม่มีข้อมูล Lot'}</div>
                            <div style="font-size:11px;color:#64748b;margin-top:2px;">EXP: ${expectedLot?.exp||'-'} • เหลือ: ${expectedLot?.qtyRemaining||0} ${expectedLot?.unit||''}</div>
                        </div>

                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
                            <div>
                                <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">📍 ตำแหน่งจัดเก็บที่ตรวจ</label>
                                <input type="text" id="qc_loc_${pid}" placeholder="เช่น ตู้เย็น A ชั้น 2"
                                    style="width:100%;padding:8px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;outline:none;">
                            </div>
                            <div>
                                <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">🏷️ Lot ที่เห็นจริงหน้างาน</label>
                                <input type="text" id="qc_found_${pid}" placeholder="กรอก Lot ที่เห็น / EXP ที่เห็น"
                                    style="width:100%;padding:8px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;outline:none;">
                            </div>
                        </div>

                        <div style="margin-bottom:12px;">
                            <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:6px;">ผลการตรวจ FIFO</label>
                            <div style="display:flex;gap:8px;">
                                <label style="flex:1;cursor:pointer;">
                                    <input type="radio" name="qcres_${pid}" value="pass" style="accent-color:#10b981;">
                                    <span style="display:inline-block;padding:8px 0;font-size:13px;color:#059669;font-weight:600;"> ✅ ผ่าน — หยิบถูก FIFO</span>
                                </label>
                                <label style="flex:1;cursor:pointer;">
                                    <input type="radio" name="qcres_${pid}" value="warning" style="accent-color:#f59e0b;">
                                    <span style="display:inline-block;padding:8px 0;font-size:13px;color:#b45309;font-weight:600;"> ⚠️ น่าสงสัย</span>
                                </label>
                                <label style="flex:1;cursor:pointer;">
                                    <input type="radio" name="qcres_${pid}" value="fail" style="accent-color:#ef4444;">
                                    <span style="display:inline-block;padding:8px 0;font-size:13px;color:#dc2626;font-weight:600;"> ❌ ไม่ผ่าน</span>
                                </label>
                            </div>
                        </div>

                        <div>
                            <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">📝 หมายเหตุ / สิ่งที่พบ</label>
                            <textarea id="qc_note_${pid}" placeholder="อธิบายสิ่งที่พบ เช่น พบ Lot เก่ากว่าถูกซ่อนอยู่ด้านหลัง..."
                                style="width:100%;padding:8px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;outline:none;resize:vertical;min-height:60px;font-family:inherit;"></textarea>
                        </div>
                    </div>`;
                }).join('')}
            </div>`;
        }

        window.saveQCCheck = async function(checkNo) {
            const selected = Object.keys(window._qcItems);
            const lots = window._qcLots||{};
            const items = selected.map(pid=>{
                const p=allProducts.find(x=>x.id===pid);
                const activeLots=(lots[pid]||[]).filter(l=>l.qtyRemaining>0);
                const expectedLot=activeLots[0];
                const result=document.querySelector(`input[name="qcres_${pid}"]:checked`)?.value||'';
                return {
                    productId:pid, productName:p?.name||'',
                    expectedLot:expectedLot?.lotNumber||'',
                    expectedExp:expectedLot?.exp||'',
                    foundLot:document.getElementById(`qc_found_${pid}`)?.value||'',
                    location:document.getElementById(`qc_loc_${pid}`)?.value||'',
                    result, note:document.getElementById(`qc_note_${pid}`)?.value||''
                };
            });
            const noResult=items.filter(i=>!i.result);
            if(noResult.length){toast(`⚠️ กรุณาเลือกผลการตรวจให้ครบ (${noResult.length} รายการ)`,'#c2410c');return;}

            const passCount=items.filter(i=>i.result==='pass').length;
            const failCount=items.filter(i=>i.result==='fail').length;
            const warnCount=items.filter(i=>i.result==='warning').length;
            const overall=failCount>0?'fail':warnCount>0?'warning':'pass';

            const today=new Date().toISOString().slice(0,10);
            const [y,m,d]=today.split('-');
            const dateTH=`${d}/${m}/${parseInt(y)+543}`;

            await addDoc(collection(db,'qcChecks'),{
                checkNo, date:dateTH, checkDate:today,
                inspector:currentUser.name, timestamp:Date.now(),
                items, passCount, failCount, warnCount:warnCount||0, overall,
                totalChecked:items.length,
                signOff: null  // จะถูก set เมื่อผู้บริหารรับทราบ
            });

            toast(`✅ บันทึก QC Check สำเร็จ — ผ่าน ${passCount}/${items.length} รายการ`, overall==='pass'?'#059669':'#c2410c');
            setTimeout(()=>openQCHistory(),800);
        };

        // ════ QC HISTORY REPORT ════
        // ── GR EXPORT PDF ─────────────────────────────────
        window.exportGRPDF = async function(grId) {
            const snap = await getDoc(doc(db,'goodsReceipts',grId));
            if(!snap.exists()){ toast('❌ ไม่พบ GR','#c2410c'); return; }
            const gr = snap.data();
            const statusTH = {draft:'แบบร่าง',pending:'รออนุมัติ',approved:'อนุมัติแล้ว',rejected:'ปฏิเสธ',completed:'เสร็จสิ้น'};
            const rows = (gr.items||[]).map((it,i)=>{
                // ข้อมูลรับจริงอยู่ใน it โดยตรง
                const docList=[];
                if(it.docs?.invoice) docList.push('ใบกำกับ');
                if(it.docs?.receipt) docList.push('ใบเสร็จ');
                if(it.docs?.billing) docList.push('ใบวางบิล');
                if(it.docs?.debit)   docList.push('ใบแจ้งหนี้');
                if(it.docs?.other)   docList.push(it.docs.other);
                const iSL={complete:'ครบ',partial:'ไม่ครบ',damaged:'เสียหาย',extra:'ของแทรก'};
                const expDisp = it.exp ? isoToDMY(it.exp) : '-';
                const mfdDisp = it.mfd ? isoToDMY(it.mfd) : '-';
                const qtyRecv = it.qtyReceived > 0 ? it.qtyReceived : '-';
                return `<tr style="${i%2===0?'':'background:#f8fafc'}">
                    <td style="text-align:center;padding:6px 8px;">${i+1}</td>
                    <td style="padding:6px 8px;"><b>${it.id}</b><br><span style="font-size:10px;color:#555;">${it.name}</span></td>
                    <td style="padding:6px 8px;font-size:11px;">${it.supplier||'-'}</td>
                    <td style="text-align:center;padding:6px 8px;">${it.qtyExpected||'-'}</td>
                    <td style="text-align:center;padding:6px 8px;font-weight:bold;color:#059669;">${qtyRecv}</td>
                    <td style="text-align:center;padding:6px 8px;">${it.unit||'-'}</td>
                    <td style="text-align:center;padding:6px 8px;font-size:10px;font-family:monospace;color:#0891b2;">${it.lotNumber||'-'}</td>
                    <td style="text-align:center;padding:6px 8px;font-size:10px;">${mfdDisp}</td>
                    <td style="text-align:center;padding:6px 8px;font-size:10px;">${expDisp}</td>
                    <td style="padding:6px 8px;font-size:10px;">${docList.join(', ')||'-'}</td>
                    <td style="text-align:center;padding:6px 8px;font-size:10px;">${it.zone||'-'}</td>
                    <td style="text-align:center;padding:6px 8px;font-size:10px;">${iSL[it.status]||'-'}</td>
                    <td style="padding:6px 8px;font-size:10px;color:#555;">${it.note||''}</td>
                </tr>`;
            }).join('');
            const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700&display=swap');
                *{box-sizing:border-box;margin:0;padding:0;}
                body{font-family:'Sarabun',sans-serif;font-size:11px;color:#1e293b;padding:18px 24px;}
                .hdr{display:flex;justify-content:space-between;margin-bottom:14px;}
                .co{font-size:11px;color:#64748b;line-height:1.6;} .co b{font-size:14px;color:#0f172a;display:block;}
                .gr-no{text-align:right;} .gr-no h1{font-size:15px;font-weight:700;}
                .gr-no .num{font-size:18px;font-weight:800;color:#06b6d4;}
                .info{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;}
                .ib{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:7px 10px;}
                .ib label{font-size:9px;color:#94a3b8;font-weight:700;text-transform:uppercase;display:block;margin-bottom:2px;}
                table{width:100%;border-collapse:collapse;margin-bottom:14px;}
                thead tr{background:#0f172a;color:white;}
                thead th{padding:6px 7px;font-size:9px;font-weight:600;text-align:center;}
                tbody td{border-bottom:1px solid #f1f5f9;vertical-align:middle;}
                .footer{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:14px;margin-top:24px;}
                .sign{border-top:1px solid #cbd5e1;padding-top:5px;text-align:center;}
                .sign .nm{font-size:11px;color:#64748b;margin-top:2px;} .sign .rl{font-size:9px;color:#94a3b8;}
                @media print{body{padding:10px;}}
            </style></head><body>
            <div class="hdr">
                <div class="co"><b>บริษัท ทีทีจี ฟู้ด จำกัด</b>279 ซอยบางนา-ตราด 16 แขวงบางนาใต้ เขตบางนา กทม. 10260</div>
                <div class="gr-no"><h1>ใบรับสินค้า (GR)</h1><div class="num">${gr.grNumber}</div>
                <span style="background:#f1f5f9;color:#475569;font-size:10px;padding:2px 8px;border-radius:6px;font-weight:700;">${statusTH[gr.status]||gr.status}</span></div>
            </div>
            <div class="info">
                <div class="ib"><label>📅 วันที่สร้าง GR</label><b>${gr.date||'-'}</b></div>
                <div class="ib"><label>📅 วันที่รับจริง</label><b>${gr.recvDate||'-'}</b></div>
                <div class="ib"><label>✍️ สร้างโดย</label><b>${gr.createdBy||'-'}</b></div>
                <div class="ib"><label>👤 ผู้รับสินค้า</label><b>${gr.receiver||'-'}</b></div>
                <div class="ib"><label>✅ อนุมัติโดย</label><b>${gr.approvedBy||'-'}</b></div>
                <div class="ib"><label>🏢 Supplier</label><b>${gr.supplier||'-'}</b></div>
            </div>
            ${gr.note?`<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:7px 10px;margin-bottom:12px;font-size:11px;">📝 ${gr.note}</div>`:''}
            <table>
                <thead><tr>
                    <th>#</th><th style="text-align:left;min-width:120px;">รหัส/ชื่อสินค้า</th>
                    <th style="text-align:left;">Supplier</th>
                    <th>คาดรับ</th><th>รับจริง</th><th>หน่วย</th>
                    <th>Lot Number</th><th>MFD</th><th>EXP</th>
                    <th>เอกสาร</th><th>คลัง</th><th>สถานะ</th><th>หมายเหตุ</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>
            <div class="footer">
                <div class="sign"><div style="height:40px;"></div><div class="nm">${gr.receiver||'.......................'}</div><div class="rl">ผู้รับสินค้า / คลังสินค้า</div></div>
                <div class="sign"><div style="height:40px;"></div><div class="nm">.......................</div><div class="rl">จัดซื้อ</div></div>
                <div class="sign"><div style="height:40px;"></div><div class="nm">.......................</div><div class="rl">บัญชี</div></div>
            </div>
            <div style="text-align:right;font-size:9px;color:#94a3b8;margin-top:14px;">พิมพ์วันที่: ${new Date().toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'})}</div>
            </body></html>`;
            const w = window.open('','_blank');
            w.document.write(html); w.document.close();
            setTimeout(()=>w.print(),500);
        };

        // ── GR EDIT & DELETE (Admin) ──────────────────────
        window.deleteGR = async function(grId, grNumber) {
            if(currentUser?.role!=='admin'){toast('⚠️ เฉพาะแอดมินเท่านั้นที่ลบ GR ได้','#c2410c');return;}
            const confirmText = prompt(`⚠️ แอดมิน — พิมพ์เลข GR "${grNumber}" เพื่อยืนยันการลบ:`);
            if(confirmText?.trim() !== grNumber) { toast('❌ ยกเลิก — GR Number ไม่ตรง','#c2410c'); return; }
            try {
                await deleteDoc(doc(db,'goodsReceipts',grId));
                toast(`🗑️ ลบ ${grNumber} เรียบร้อย`,'#059669');
                openGRHistory();
            } catch(e) { toast('❌ ลบไม่สำเร็จ: '+e.message,'#c2410c'); }
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

        // ── QC HISTORY + REPORT ─────────────────────────────────
        window._qcAllChecks = [];

        window.openQCHistory = async function() {
            document.getElementById('dashboardView').classList.add('hidden');
            const c = document.getElementById('toolAppContainer'); c.classList.remove('hidden');
            c.innerHTML=`<div class="tool-header"><h2>📊 QC FIFO Report</h2>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button onclick="openQCCheck()" style="background:#7c3aed;color:white;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-weight:bold;">+ Spot Check ใหม่</button>
                    <button onclick="exportQCExcel()" style="background:#059669;color:white;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-weight:bold;">📥 Export Excel</button>
                    <button onclick="goToDashboard()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;">🏠 Dashboard</button>
                    <button onclick="closeTool()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;">✕ ปิด</button>
                </div></div>
                <p style="text-align:center;color:#94a3b8;padding:30px;">⏳ กำลังโหลด...</p>`;

            const snap = await getDocs(collection(db,'qcChecks'));
            let checks=[]; snap.forEach(d=>checks.push({id:d.id,...d.data()}));
            checks.sort((a,b)=>b.timestamp-a.timestamp);
            window._qcAllChecks = checks;
            renderQCReport(checks);
        };

        function renderQCReport(checks) {
            const c = document.getElementById('toolAppContainer');
            const isAdmin = currentUser?.role==='admin'||roleSettings[currentUser?.role]?.menus?.includes('admin');

            // ── stats ──
            const totalChecks = checks.length;
            const totalItems  = checks.reduce((s,x)=>s+x.totalChecked,0);
            const totalPass   = checks.reduce((s,x)=>s+x.passCount,0);
            const totalFail   = checks.reduce((s,x)=>s+x.failCount,0);
            const totalWarn   = checks.reduce((s,x)=>s+(x.warningCount||0),0);
            const passRate    = totalItems>0?Math.round(totalPass/totalItems*100):0;

            // ── product fail breakdown ──
            const productStats={};
            checks.forEach(chk=>{ (chk.items||[]).forEach(it=>{
                if(!productStats[it.productId]) productStats[it.productId]={name:it.productName||'',pass:0,warn:0,fail:0,total:0};
                productStats[it.productId].total++;
                if(it.result==='pass') productStats[it.productId].pass++;
                else if(it.result==='warning') productStats[it.productId].warn++;
                else if(it.result==='fail') productStats[it.productId].fail++;
            }); });
            const failBreakdown = Object.entries(productStats)
                .filter(([,v])=>v.fail>0||v.warn>0)
                .sort((a,b)=>b[1].fail-a[1].fail);

            // ── trend data (last 10 sessions) ──
            const trendData = [...checks].reverse().slice(-10);
            const trendLabels = trendData.map(x=>x.date?isoToDMY(x.date).slice(0,5):'?');
            const trendRates  = trendData.map(x=>x.totalChecked>0?Math.round(x.passCount/x.totalChecked*100):0);

            const overallColors={pass:'#10b981',warning:'#f59e0b',fail:'#ef4444'};
            const overallLabels={pass:'✅ ผ่าน',warning:'⚠️ น่าสงสัย',fail:'❌ ไม่ผ่าน'};

            c.innerHTML=`
            <div class="tool-header">
                <h2>📊 QC FIFO Report</h2>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button onclick="openQCCheck()" style="background:#7c3aed;color:white;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-weight:bold;">+ Spot Check ใหม่</button>
                    <button onclick="exportQCExcel()" style="background:#059669;color:white;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-weight:bold;">📥 Export Excel</button>
                    <button onclick="goToDashboard()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;">🏠 Dashboard</button>
                    <button onclick="closeTool()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;">✕ ปิด</button>
                </div>
            </div>

            <!-- SUMMARY CARDS -->
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:20px;">
                <div style="background:linear-gradient(135deg,#1e1b4b,#312e81);border-radius:14px;padding:18px;color:white;">
                    <div style="font-size:10px;color:#a5b4fc;text-transform:uppercase;letter-spacing:.5px;">QC Sessions</div>
                    <div style="font-size:30px;font-weight:800;margin:4px 0;">${totalChecks}</div>
                    <div style="font-size:11px;color:#c7d2fe;">${totalItems} รายการรวม</div>
                </div>
                <div style="background:white;border-radius:14px;padding:18px;border:1px solid #e2e8f0;border-top:4px solid #10b981;">
                    <div style="font-size:10px;color:#64748b;text-transform:uppercase;">Pass Rate</div>
                    <div style="font-size:30px;font-weight:800;color:#10b981;margin:4px 0;">${passRate}%</div>
                    <div style="font-size:11px;color:#94a3b8;">${totalPass}/${totalItems} ผ่าน</div>
                </div>
                <div style="background:white;border-radius:14px;padding:18px;border:1px solid #e2e8f0;border-top:4px solid #f59e0b;">
                    <div style="font-size:10px;color:#64748b;text-transform:uppercase;">น่าสงสัย</div>
                    <div style="font-size:30px;font-weight:800;color:#f59e0b;margin:4px 0;">${totalWarn}</div>
                    <div style="font-size:11px;color:#94a3b8;">รายการ ⚠️</div>
                </div>
                <div style="background:white;border-radius:14px;padding:18px;border:1px solid #e2e8f0;border-top:4px solid #ef4444;">
                    <div style="font-size:10px;color:#64748b;text-transform:uppercase;">ไม่ผ่าน FIFO</div>
                    <div style="font-size:30px;font-weight:800;color:#ef4444;margin:4px 0;">${totalFail}</div>
                    <div style="font-size:11px;color:#94a3b8;">รายการผิด FIFO</div>
                </div>
            </div>

            <!-- GRAPH + BREAKDOWN ROW -->
            <div class="qc-chart-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">

                <!-- กราฟ Pass Rate trend -->
                <div style="background:white;border-radius:14px;border:1px solid #e2e8f0;padding:20px;">
                    <div style="font-weight:700;font-size:14px;margin-bottom:14px;color:#1e293b;">📈 Pass Rate ย้อนหลัง (10 sessions ล่าสุด)</div>
                    ${trendData.length>=2
                        ? `<div class="chart-wrap" style="height:220px;"><canvas id="qcTrendChart" height="220"></canvas></div>`
                        : `<div style="text-align:center;padding:40px;color:#94a3b8;">ต้องมีอย่างน้อย 2 sessions<br>ถึงจะแสดงกราฟได้</div>`}
                </div>

                <!-- Product Breakdown -->
                <div style="background:white;border-radius:14px;border:1px solid #e2e8f0;padding:20px;overflow-y:auto;max-height:320px;">
                    <div style="font-weight:700;font-size:14px;margin-bottom:14px;color:#1e293b;">🏷️ Breakdown สินค้า</div>
                    ${failBreakdown.length ? failBreakdown.map(([pid,v])=>{
                        const failPct = v.total>0?Math.round(v.fail/v.total*100):0;
                        const warnPct = v.total>0?Math.round(v.warn/v.total*100):0;
                        const passPct = 100-failPct-warnPct;
                        return `<div style="margin-bottom:12px;">
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                                <div>
                                    <span style="font-weight:700;font-size:12px;">${pid}</span>
                                    <span style="font-size:11px;color:#64748b;margin-left:6px;">${v.name}</span>
                                </div>
                                <div style="font-size:11px;">
                                    <span style="color:#ef4444;font-weight:700;">❌${v.fail}</span>
                                    ${v.warn?`<span style="color:#f59e0b;font-weight:700;margin-left:4px;">⚠️${v.warn}</span>`:''}
                                    <span style="color:#94a3b8;margin-left:4px;">${v.total}ครั้ง</span>
                                </div>
                            </div>
                            <div style="height:8px;background:#f1f5f9;border-radius:4px;overflow:hidden;display:flex;">
                                <div style="width:${passPct}%;background:#10b981;transition:width .3s;"></div>
                                <div style="width:${warnPct}%;background:#f59e0b;transition:width .3s;"></div>
                                <div style="width:${failPct}%;background:#ef4444;transition:width .3s;"></div>
                            </div>
                        </div>`;
                    }).join('') : '<div style="text-align:center;padding:30px;color:#94a3b8;font-size:13px;">ยังไม่มี Fail หรือ Warning 🎉</div>'}
                </div>
            </div>

            <!-- FILTER BAR -->
            <div style="background:white;border-radius:14px;border:1px solid #e2e8f0;padding:14px 16px;margin-bottom:16px;display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
                <span style="font-size:12px;font-weight:700;color:#475569;">🔍 กรอง:</span>
                <input type="text" id="qcFilterDate" placeholder="dd/mm/yyyy" maxlength="10"
                    oninput="applyQCFilter()"
                    style="padding:7px 10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:12px;width:110px;outline:none;">
                <input type="text" id="qcFilterProduct" placeholder="รหัส/ชื่อสินค้า"
                    oninput="applyQCFilter()"
                    style="padding:7px 10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:12px;width:140px;outline:none;">
                <select id="qcFilterResult" onchange="applyQCFilter()"
                    style="padding:7px 10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:12px;outline:none;">
                    <option value="">ทุกผล</option>
                    <option value="pass">✅ ผ่านทั้งหมด</option>
                    <option value="warning">⚠️ มีน่าสงสัย</option>
                    <option value="fail">❌ มี Fail</option>
                </select>
                <button onclick="document.getElementById('qcFilterDate').value='';document.getElementById('qcFilterProduct').value='';document.getElementById('qcFilterResult').value='';applyQCFilter();"
                    style="background:#f1f5f9;color:#475569;border:none;padding:7px 12px;border-radius:8px;cursor:pointer;font-size:12px;">✕ ล้าง</button>
                <span id="qcFilterCount" style="font-size:11px;color:#94a3b8;margin-left:auto;">แสดง ${checks.length} sessions</span>
            </div>

            <!-- SESSION LIST -->
            <div id="qcSessionList">
                ${renderQCSessionList(checks, isAdmin)}
            </div>`;

            // วาด Chart หลัง DOM render
            if(trendData.length>=2) {
                setTimeout(()=>{
                    const canvas = document.getElementById('qcTrendChart');
                    if(!canvas) return;
                    canvas.style.height = '220px';
                    canvas.style.maxHeight = '220px';
                    const ctx = canvas.getContext('2d');
                    if(window._qcChart) window._qcChart.destroy();
                    window._qcChart = new Chart(ctx, {
                        type:'line',
                        data:{
                            labels: trendLabels,
                            datasets:[{
                                label:'Pass Rate %',
                                data: trendRates,
                                borderColor:'#7c3aed',
                                backgroundColor:'rgba(124,58,237,0.08)',
                                borderWidth:2.5,
                                pointBackgroundColor:'#7c3aed',
                                pointRadius:4,
                                tension:0.4,
                                fill:true
                            }]
                        },
                        options:{
                            responsive:true,
                            maintainAspectRatio:false,
                            plugins:{
                                legend:{display:false},
                                tooltip:{callbacks:{label:c=>`${c.raw}%`}}
                            },
                            scales:{
                                y:{
                                    min:0, max:100,
                                    ticks:{stepSize:25,callback:v=>v+'%'},
                                    grid:{color:'#f1f5f9'}
                                },
                                x:{grid:{display:false},ticks:{maxRotation:0}}
                            }
                        }
                    });
                }, 100);
            }
        }

        function renderQCSessionList(checks, isAdmin) {
            const overallColors={pass:'#10b981',warning:'#f59e0b',fail:'#ef4444'};
            const overallLabels={pass:'✅ ผ่านทั้งหมด',warning:'⚠️ น่าสงสัย',fail:'❌ มี Fail'};
            if(!checks.length) return '<p style="text-align:center;color:#94a3b8;padding:40px;">ยังไม่มีประวัติ QC</p>';
            return checks.map(chk=>`
            <div class="history-card" style="border-left:4px solid ${overallColors[chk.overall]||'#94a3b8'};">
                <div class="history-card-header" style="cursor:pointer;" onclick="toggleDetail('qcdet_${chk.id}')">
                    <div style="flex:1;">
                        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                            <span style="font-weight:800;color:#7c3aed;font-size:14px;">${chk.checkNo}</span>
                            <span style="background:${(overallColors[chk.overall]||'#64748b')}18;color:${overallColors[chk.overall]||'#64748b'};font-size:11px;padding:3px 10px;border-radius:10px;font-weight:700;">${overallLabels[chk.overall]||'-'}</span>
                        </div>
                        <div style="font-size:12px;color:#64748b;margin-top:4px;display:flex;gap:14px;flex-wrap:wrap;">
                            <span>📅 ${chk.date?isoToDMY(chk.date):'-'}</span>
                            <span>👤 ${chk.inspector}</span>
                            <span style="color:#10b981;font-weight:600;">✅ ${chk.passCount} ผ่าน</span>
                            ${chk.warningCount?`<span style="color:#f59e0b;font-weight:600;">⚠️ ${chk.warningCount} น่าสงสัย</span>`:''}
                            ${chk.failCount?`<span style="color:#ef4444;font-weight:600;">❌ ${chk.failCount} ไม่ผ่าน</span>`:''}
                            <span style="color:#94a3b8;">${chk.totalChecked} รายการ</span>
                        </div>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;">
                        ${isAdmin?`<button onclick="event.stopPropagation();deleteQCSession('${chk.id}','${chk.checkNo}')"
                            style="background:#fef2f2;color:#ef4444;border:1px solid #fecaca;padding:4px 10px;border-radius:7px;cursor:pointer;font-size:11px;font-weight:600;">🗑️ ลบ</button>`:''}
                        <span style="color:#94a3b8;font-size:12px;">▼</span>
                    </div>
                </div>
                <div id="qcdet_${chk.id}" style="display:none;padding:14px 20px;">
                    <div style="overflow-x:auto;">
                        <table style="width:100%;border-collapse:collapse;font-size:12px;">
                            <thead><tr style="background:#faf5ff;">
                                <th style="padding:8px;text-align:left;">สินค้า</th>
                                <th style="padding:8px;text-align:center;">คาด (FIFO)</th>
                                <th style="padding:8px;text-align:center;">พบจริง</th>
                                <th style="padding:8px;text-align:center;">ตำแหน่ง</th>
                                <th style="padding:8px;text-align:center;">ผล</th>
                                <th style="padding:8px;text-align:left;">หมายเหตุ</th>
                            </tr></thead>
                            <tbody>${(chk.items||[]).map(it=>{
                                const rc={pass:'#10b981',warning:'#f59e0b',fail:'#ef4444'}[it.result]||'#94a3b8';
                                const rl={pass:'✅ ผ่าน',warning:'⚠️ น่าสงสัย',fail:'❌ ไม่ผ่าน'}[it.result]||'-';
                                return `<tr style="border-top:1px solid #f1f5f9;">
                                    <td style="padding:8px;"><b style="font-size:12px;">${it.productId}</b><br><span style="font-size:11px;color:#64748b;">${it.productName||''}</span></td>
                                    <td style="padding:8px;text-align:center;font-family:monospace;font-size:11px;color:#06b6d4;">${it.expectedLot||'-'}</td>
                                    <td style="padding:8px;text-align:center;font-family:monospace;font-size:11px;color:${it.result==='pass'?'#10b981':'#ef4444'};font-weight:700;">${it.foundLot||'-'}</td>
                                    <td style="padding:8px;text-align:center;font-size:11px;color:#64748b;">${it.location||'-'}</td>
                                    <td style="padding:8px;text-align:center;"><span style="background:${rc}18;color:${rc};padding:3px 8px;border-radius:8px;font-size:11px;font-weight:700;">${rl}</span></td>
                                    <td style="padding:8px;font-size:11px;color:#475569;">${it.note||''}</td>
                                </tr>`;
                            }).join('')}</tbody>
                        </table>
                    </div>
                    <!-- Sign Off + PDF -->
                    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-top:14px;padding-top:12px;border-top:1px solid #f1f5f9;">
                        ${chk.signOff
                            ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:10px 16px;font-size:12px;">
                                ✅ <b style="color:#059669;">รับทราบโดย ${chk.signOff.by}</b>
                                &nbsp;·&nbsp; ${chk.signOff.atDisplay||''}
                                ${chk.signOff.comment?`<br><span style="color:#475569;">💬 ${chk.signOff.comment}</span>`:''}
                               </div>`
                            : `<button onclick="qcSignOff('${chk.id}')"
                                style="background:#059669;color:white;border:none;padding:8px 18px;border-radius:9px;cursor:pointer;font-weight:700;font-size:12px;">
                                ✅ รับทราบ / Sign Off
                               </button>`}
                        <button onclick="exportQCPDF('${chk.id}')"
                            style="background:#7c3aed;color:white;border:none;padding:8px 18px;border-radius:9px;cursor:pointer;font-weight:700;font-size:12px;">
                            🖨️ Export PDF
                        </button>
                    </div>
                </div>
            </div>`).join('');
        }

        window.applyQCFilter = function() {
            const dateQ = document.getElementById('qcFilterDate')?.value.trim()||'';
            const prodQ = (document.getElementById('qcFilterProduct')?.value||'').toLowerCase().trim();
            const resultQ = document.getElementById('qcFilterResult')?.value||'';
            const isAdmin = currentUser?.role==='admin'||roleSettings[currentUser?.role]?.menus?.includes('admin');

            let filtered = window._qcAllChecks.filter(chk=>{
                if(dateQ && !(chk.date?isoToDMY(chk.date).includes(dateQ):false)) return false;
                if(prodQ && !((chk.items||[]).some(it=>(it.productId||'').toLowerCase().includes(prodQ)||(it.productName||'').toLowerCase().includes(prodQ)))) return false;
                if(resultQ && chk.overall!==resultQ) return false;
                return true;
            });

            document.getElementById('qcSessionList').innerHTML = renderQCSessionList(filtered, isAdmin);
            const el = document.getElementById('qcFilterCount');
            if(el) el.innerText = `แสดง ${filtered.length}/${window._qcAllChecks.length} sessions`;
        };

        window.deleteQCSession = async function(id, checkNo) {
            if(!confirm(`ยืนยันลบ ${checkNo}?`)) return;
            try {
                await deleteDoc(doc(db,'qcChecks',id));
                window._qcAllChecks = window._qcAllChecks.filter(x=>x.id!==id);
                toast(`🗑️ ลบ ${checkNo} เรียบร้อย`,'#059669');
                renderQCReport(window._qcAllChecks);
            } catch(e) { toast('❌ ลบไม่สำเร็จ','#c2410c'); }
        };

        window.exportQCExcel = function() {
            const checks = window._qcAllChecks;
            if(!checks.length){ toast('❌ ไม่มีข้อมูล','#c2410c'); return; }
            const rows = [['QC No.','วันที่','ผู้ตรวจ','สินค้า','ชื่อสินค้า','Lot คาด','Lot พบจริง','ตำแหน่ง','ผล','หมายเหตุ']];
            checks.forEach(chk=>{
                (chk.items||[]).forEach(it=>{
                    rows.push([
                        chk.checkNo,
                        chk.date?isoToDMY(chk.date):'',
                        chk.inspector,
                        it.productId, it.productName||'',
                        it.expectedLot||'', it.foundLot||'',
                        it.location||'',
                        {pass:'ผ่าน',warning:'น่าสงสัย',fail:'ไม่ผ่าน'}[it.result]||it.result,
                        it.note||''
                    ]);
                });
            });
            const ws = rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
            const bom = '\uFEFF';
            const blob = new Blob([bom+ws],{type:'text/csv;charset=utf-8'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href=url;
            a.download=`QC_Report_${new Date().toISOString().slice(0,10)}.csv`;
            a.click(); URL.revokeObjectURL(url);
            toast('📥 Export เรียบร้อย','#059669');
        };
        // ── QC SIGN OFF (Boss/Admin) ──────────────────────
        window.qcSignOff = async function(qcId) {
            const comment = prompt('ความเห็น / บันทึก (ไม่บังคับ):') ?? null;
            if(comment === null) return; // กด cancel
            try {
                await updateDoc(doc(db,'qcChecks',qcId), {
                    signOff: {
                        by: currentUser.name,
                        role: currentUser.role||'',
                        at: Date.now(),
                        atDisplay: isoToDMY(new Date().toISOString().slice(0,10)),
                        comment: comment||''
                    }
                });
                // update local
                const idx = window._qcAllChecks?.findIndex(x=>x.id===qcId);
                if(idx>=0) window._qcAllChecks[idx].signOff = {
                    by:currentUser.name, atDisplay:isoToDMY(new Date().toISOString().slice(0,10)), comment:comment||''
                };
                toast('✅ รับทราบเรียบร้อย','#059669');
                renderQCReport(window._qcAllChecks||[]);
            } catch(e) { toast('❌ ไม่สำเร็จ: '+e.message,'#c2410c'); }
        };

        // ── QC EXPORT PDF (ทางการ) ──────────────────────
        window.exportQCPDF = function(qcId) {
            const chk = window._qcAllChecks?.find(x=>x.id===qcId);
            if(!chk) { toast('❌ ไม่พบข้อมูล','#c2410c'); return; }

            const overallTH = {pass:'ผ่าน ✅',warning:'น่าสงสัย ⚠️',fail:'ไม่ผ่าน ❌'}[chk.overall]||'-';
            const passRate = chk.totalChecked>0?Math.round(chk.passCount/chk.totalChecked*100):0;
            const signOffHtml = chk.signOff
                ? `<div style="margin-top:24px;padding:14px 20px;border:2px solid #10b981;border-radius:10px;background:#f0fdf4;">
                    <b style="color:#059669;">✅ รับทราบโดย</b>: ${chk.signOff.by}
                    &nbsp;|&nbsp; <b>วันที่</b>: ${chk.signOff.atDisplay||'-'}
                    ${chk.signOff.comment?`<br><b>ความเห็น</b>: ${chk.signOff.comment}`:''}
                   </div>`
                : `<div style="margin-top:24px;padding:14px 20px;border:2px dashed #e2e8f0;border-radius:10px;color:#94a3b8;text-align:center;">
                    ⏳ ยังไม่มีการรับทราบจากผู้บริหาร
                   </div>`;

            const itemRows = (chk.items||[]).map((it,i)=>{
                const rc={pass:'#10b981',warning:'#f59e0b',fail:'#ef4444'}[it.result]||'#94a3b8';
                const rl={pass:'ผ่าน',warning:'น่าสงสัย',fail:'ไม่ผ่าน'}[it.result]||'-';
                return `<tr style="${i%2?'background:#f8fafc':''}">
                    <td style="padding:8px 10px;border:1px solid #e2e8f0;">${i+1}</td>
                    <td style="padding:8px 10px;border:1px solid #e2e8f0;font-weight:700;">${it.productId}</td>
                    <td style="padding:8px 10px;border:1px solid #e2e8f0;">${it.productName||''}</td>
                    <td style="padding:8px 10px;border:1px solid #e2e8f0;font-family:monospace;font-size:11px;color:#06b6d4;">${it.expectedLot||'-'}</td>
                    <td style="padding:8px 10px;border:1px solid #e2e8f0;font-family:monospace;font-size:11px;">${it.foundLot||'-'}</td>
                    <td style="padding:8px 10px;border:1px solid #e2e8f0;text-align:center;">${it.location||'-'}</td>
                    <td style="padding:8px 10px;border:1px solid #e2e8f0;text-align:center;font-weight:700;color:${rc};">${rl}</td>
                    <td style="padding:8px 10px;border:1px solid #e2e8f0;font-size:11px;">${it.note||''}</td>
                </tr>`;
            }).join('');

            const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
            <style>
                @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;700&display=swap');
                * { font-family: 'IBM Plex Sans Thai', sans-serif; box-sizing:border-box; }
                body { margin:0; padding:28px 36px; color:#1e293b; font-size:13px; }
                .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #7c3aed; padding-bottom:14px; margin-bottom:20px; }
                .logo { font-size:20px; font-weight:800; color:#7c3aed; }
                .logo span { font-size:11px; color:#64748b; font-weight:400; display:block; }
                .doc-title { font-size:17px; font-weight:800; color:#1e293b; text-align:right; }
                .doc-title span { font-size:12px; color:#64748b; font-weight:400; display:block; }
                .info-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-bottom:20px; }
                .info-box { background:#f8fafc; border-radius:8px; padding:10px 14px; border:1px solid #e2e8f0; }
                .info-box label { font-size:10px; color:#64748b; font-weight:700; text-transform:uppercase; display:block; }
                .info-box value { font-size:15px; font-weight:800; color:#1e293b; }
                table { width:100%; border-collapse:collapse; }
                thead tr { background:#7c3aed; color:white; }
                thead th { padding:9px 10px; text-align:left; font-size:11px; font-weight:700; }
                .footer { margin-top:30px; display:grid; grid-template-columns:1fr 1fr 1fr; gap:20px; }
                .sig-box { border-top:2px solid #1e293b; padding-top:8px; text-align:center; }
                .sig-box .name { font-size:11px; color:#64748b; }
                @media print { body { padding:14px 20px; } }
            </style></head>
            <body>
                <div class="header">
                    <div class="logo">T+ TTGPlus<span>Management System</span></div>
                    <div class="doc-title">รายงาน QC Spot Check<span>ตรวจสอบ FIFO — ออกโดยระบบอัตโนมัติ</span></div>
                </div>

                <div class="info-grid">
                    <div class="info-box"><label>QC Check No.</label><value>${chk.checkNo}</value></div>
                    <div class="info-box"><label>วันที่ตรวจ</label><value>${chk.date?isoToDMY(chk.date):'-'}</value></div>
                    <div class="info-box"><label>ผู้ตรวจ</label><value>${chk.inspector}</value></div>
                    <div class="info-box"><label>Pass Rate</label><value style="color:${passRate>=80?'#059669':passRate>=50?'#d97706':'#dc2626'}">${passRate}%</value></div>
                    <div class="info-box"><label>ผล</label><value>${overallTH}</value></div>
                    <div class="info-box"><label>รายการทั้งหมด</label><value>${chk.totalChecked} รายการ</value></div>
                </div>

                <table>
                    <thead><tr>
                        <th>#</th><th>รหัส</th><th>ชื่อสินค้า</th>
                        <th>Lot คาด (FIFO)</th><th>Lot พบจริง</th>
                        <th>ตำแหน่ง</th><th>ผล</th><th>หมายเหตุ</th>
                    </tr></thead>
                    <tbody>${itemRows}</tbody>
                </table>

                ${signOffHtml}

                <div class="footer">
                    <div class="sig-box">
                        <div style="height:50px;"></div>
                        <div>____________________________</div>
                        <div class="name">ผู้ตรวจ / ${chk.inspector}</div>
                    </div>
                    <div class="sig-box">
                        <div style="height:50px;"></div>
                        <div>____________________________</div>
                        <div class="name">หัวหน้าคลัง</div>
                    </div>
                    <div class="sig-box">
                        <div style="height:50px;"></div>
                        <div>____________________________</div>
                        <div class="name">ผู้บริหาร / รับทราบ</div>
                    </div>
                </div>

                <div style="margin-top:20px;border-top:1px solid #e2e8f0;padding-top:10px;font-size:10px;color:#94a3b8;text-align:right;">
                    พิมพ์เมื่อ: ${new Date().toLocaleString('th-TH')} | TTGPlus Management System
                </div>
            </body></html>`;

            const w = window.open('','_blank','width=900,height=700');
            w.document.write(html);
            w.document.close();
            w.focus();
            setTimeout(()=>w.print(), 600);
        };

                // ── LOT REGISTER EXPORT ──────────────────────────
        window.exportLotExcel = async function() {
            const lotSnap = await getDoc(doc(db,'config','lotRegister'));
            const lots = lotSnap.exists() ? (lotSnap.data().lots||{}) : {};
            const today = new Date(); today.setHours(0,0,0,0);
            const rows = [['รหัสสินค้า','ชื่อสินค้า','Lot Number','GR Number','วันที่รับ','MFD','EXP','คงเหลือ','หน่วย','คลัง','สถานะ','วันหมดอายุ (วัน)']];
            Object.entries(lots).forEach(([pid, lotList])=>{
                const p = allProducts.find(x=>x.id===pid);
                lotList.filter(l=>l.qtyRemaining>0).forEach(l=>{
                    const daysLeft = l.exp ? Math.floor((new Date(l.exp)-today)/(1000*60*60*24)) : '';
                    rows.push([pid, p?.name||'', l.lotNumber||'', l.grNumber||'',
                        l.grDate?isoToDMY(l.grDate):'', l.mfd?isoToDMY(l.mfd):'', l.exp?isoToDMY(l.exp):'',
                        l.qtyRemaining, l.unit||'', l.zone||'', l.status||'', daysLeft]);
                });
            });
            if(rows.length===1){toast('❌ ไม่มีข้อมูล Lot','#c2410c');return;}
            const ws=XLSX.utils.aoa_to_sheet(rows), wb=XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb,ws,'LotRegister');
            XLSX.writeFile(wb,`LotRegister_${new Date().toISOString().slice(0,10)}.xlsx`);
            toast('📥 Export Excel เรียบร้อย','#059669');
        };

        window.exportLotPDF = async function() {
            const lotSnap = await getDoc(doc(db,'config','lotRegister'));
            const lots = lotSnap.exists() ? (lotSnap.data().lots||{}) : {};
            const today = new Date(); today.setHours(0,0,0,0);
            let rows = '';
            let rowCount = 0;
            Object.entries(lots).forEach(([pid, lotList])=>{
                const p = allProducts.find(x=>x.id===pid);
                const active = lotList.filter(l=>l.qtyRemaining>0);
                active.forEach((l,i)=>{
                    const daysLeft = l.exp ? Math.floor((new Date(l.exp)-today)/(1000*60*60*24)) : null;
                    const expColor = daysLeft===null?'#1e293b':daysLeft<0?'#ef4444':daysLeft<=30?'#f59e0b':'#059669';
                    rows += `<tr style="${rowCount%2?'background:#f8fafc':''}">
                        <td style="padding:7px 10px;${i===0?'font-weight:700':'color:#64748b'}">${pid}</td>
                        <td style="padding:7px 10px;font-size:11px;">${p?.name||''}</td>
                        <td style="padding:7px 10px;font-family:monospace;font-size:11px;color:#0891b2;${i===0?'font-weight:700':''}">${i===0?'⭐ ':''} ${l.lotNumber||'-'}</td>
                        <td style="padding:7px 10px;text-align:center;">${l.exp?isoToDMY(l.exp):'-'}</td>
                        <td style="padding:7px 10px;text-align:center;font-weight:700;color:${expColor};">${daysLeft===null?'-':daysLeft<0?'หมดแล้ว!':daysLeft+'วัน'}</td>
                        <td style="padding:7px 10px;text-align:center;font-weight:700;">${l.qtyRemaining}</td>
                        <td style="padding:7px 10px;text-align:center;font-size:11px;">${l.unit||''}</td>
                        <td style="padding:7px 10px;text-align:center;font-size:11px;color:#64748b;">${l.zone||'-'}</td>
                    </tr>`;
                    rowCount++;
                });
            });
            const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700&display=swap');
                *{box-sizing:border-box;margin:0;padding:0;}
                body{font-family:'Sarabun',sans-serif;font-size:12px;color:#1e293b;padding:20px 28px;}
                h1{font-size:16px;font-weight:800;margin-bottom:4px;}
                .sub{font-size:11px;color:#64748b;margin-bottom:16px;}
                table{width:100%;border-collapse:collapse;}
                thead tr{background:#0f172a;color:white;}
                th{padding:8px 10px;font-size:10px;font-weight:700;text-align:center;}
                th:nth-child(1),th:nth-child(2){text-align:left;}
                td{border-bottom:1px solid #f1f5f9;vertical-align:middle;}
                @media print{body{padding:10px;}}
            </style></head><body>
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;">
                <div>
                    <h1>🏷️ ทะเบียน Lot สินค้า</h1>
                    <div class="sub">บริษัท ทีทีจี ฟู้ด จำกัด &nbsp;|&nbsp; พิมพ์วันที่: ${new Date().toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'})}</div>
                </div>
                <div style="text-align:right;font-size:11px;color:#64748b;">สินค้า ${Object.keys(lots).length} รายการ</div>
            </div>
            <table>
                <thead><tr>
                    <th style="text-align:left;">รหัส</th><th style="text-align:left;">ชื่อสินค้า</th>
                    <th>Lot Number</th><th>EXP</th><th>วันหมดอายุ</th>
                    <th>คงเหลือ</th><th>หน่วย</th><th>คลัง</th>
                </tr></thead>
                <tbody>${rows||'<tr><td colspan="8" style="padding:40px;text-align:center;color:#94a3b8;">ไม่มีข้อมูล</td></tr>'}</tbody>
            </table>
            </body></html>`;
            const w = window.open('','_blank');
            w.document.write(html); w.document.close();
            setTimeout(()=>w.print(),500);
        };

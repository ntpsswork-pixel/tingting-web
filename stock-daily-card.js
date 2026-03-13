// stock-daily-card.js — TTGPlus | openDailyStockCard, renderDSCItems, saveDailyStockCard, viewDailyHistory
        window.openDailyStockCard = async function() {
            document.getElementById('dashboardView').classList.add('hidden');
            const c = document.getElementById('toolAppContainer'); c.classList.remove('hidden');
            const visibleZones = getVisibleWarehouses();
            const today = new Date().toISOString().slice(0,10);

            // โหลด issued จากใบเบิกวันนี้
            const reqSnap = await getDocs(query(collection(db,'requisitions'), orderBy('createdAt','desc'), limit(300)));
            const todayIssued = {}; // { productId: totalIssued }
            const [ty,tm,td] = today.split('-');
            const todayTH = `${td}/${tm}/${parseInt(ty)+543}`;
            reqSnap.forEach(d=>{
                const r = d.data();
                if(r.status==='issued' && r.date===todayTH) {
                    (r.items||[]).forEach(it=>{
                        todayIssued[it.id] = (todayIssued[it.id]||0) + (it.qtyIssued||0);
                    });
                }
            });

            c.innerHTML = `
            <div class="tool-header no-print">
                <h2>📋 Daily Stock Card</h2>
                <div style="display:flex;gap:8px;">
                    <button onclick="viewDailyHistory()" style="background:#7c3aed;color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:bold;">📊 ประวัติย้อนหลัง</button>
                    <button onclick="goToDashboard()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;">🏠 Dashboard</button><button onclick="closeTool()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;">✕ ปิด</button>
                </div>
            </div>

            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:15px;margin-bottom:20px;">
                <div class="input-group" style="border:2px solid var(--danger);"><label>📅 วันที่บันทึก</label>
                    <input type="date" id="dsc_date" value="${today}"
                        onchange="window._dscOpeningConfirmed=false;window._dscSkipOpening=false;renderDSCItems()"
                        style="width:100%;border:none;font-weight:bold;outline:none;font-size:14px;color:#1e293b;">
                </div>
                <div class="input-group"><label>📦 คลัง/โซน</label>
                    <select id="dsc_zone" onchange="renderDSCItems()" style="width:100%;border:none;font-weight:bold;outline:none;">
                        ${visibleZones.map(z=>`<option value="${z}">${z}</option>`).join('')}
                    </select>
                </div>
                <div class="input-group" style="background:#f1f5f9;"><label>📝 บันทึกโดย</label><b>${currentUser.name}</b></div>
            </div>

            <div style="background:#eff6ff;border:1px solid #bae6fd;border-radius:10px;padding:12px 16px;margin-bottom:16px;font-size:13px;color:#0369a1;">
                💡 <b>วิธีใช้:</b> ยอดยกมา = ดึงจากเมื่อวานอัตโนมัติ | จ่ายออก = ดึงจากใบเบิกอัตโนมัติ | กรอกแค่ "รับเข้า" และ "คงเหลือเย็น" แล้วบันทึก
            </div>

            <div style="margin-bottom:12px;">
                <input type="text" placeholder="🔍 ค้นหาสินค้า..." oninput="filterDSCRows(this.value)"
                    style="width:100%;padding:10px 16px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box;outline:none;">
            </div>

            <div id="dscTableContainer"></div>

            <div style="margin-top:24px;text-align:center;" class="no-print">
                <button onclick="saveDailyStockCard()" style="background:var(--success);color:white;padding:16px 60px;border:none;border-radius:14px;font-size:18px;font-weight:bold;cursor:pointer;box-shadow:0 4px 15px rgba(16,185,129,0.3);">
                    💾 บันทึก Stock Card ประจำวัน
                </button>
            </div>`;

            window._dscTodayIssued = todayIssued;
            await renderDSCItems();
        };

        window.renderDSCItems = async function() {
            const zone = document.getElementById('dsc_zone')?.value||'';
            const date = document.getElementById('dsc_date')?.value||'';
            const zoneProds = getZoneProducts(zone);
            const c = document.getElementById('dscTableContainer'); if(!c) return;

            // โหลดยอดปิดเมื่อวานมาเป็น opening
            const prevDate = new Date(date);
            prevDate.setDate(prevDate.getDate()-1);
            const prevDateISO = prevDate.toISOString().slice(0,10);
            const [py,pm,pd2] = prevDateISO.split('-');
            const prevDateTH = `${pd2}/${pm}/${parseInt(py)+543}`;

            const histSnap = await getDocs(query(collection(db,'dailyStockCards'), orderBy('savedAt','desc'), limit(300)));
            let prevCard = null;
            histSnap.forEach(d=>{
                const data = d.data();
                if(data.zone===zone && data.date===prevDateTH) prevCard = data;
            });

            // โหลด card ของวันนี้ถ้ามีอยู่แล้ว (กรณี edit)
            const [cy,cm,cd] = date.split('-');
            const dateTH = `${cd}/${cm}/${parseInt(cy)+543}`;
            let todayCard = null;
            histSnap.forEach(d=>{
                const data = d.data();
                if(data.zone===zone && data.date===dateTH) { todayCard = data; window._dscEditId = d.id; }
            });
            if(!todayCard) window._dscEditId = null;

            // แจ้งยอดยกมาจากเมื่อวาน (เฉพาะสร้างใหม่ ไม่ใช่ edit วันเดิม)
            if(prevCard && !todayCard && !window._dscOpeningConfirmed) {
                const itemsWithBalance = (prevCard.items||[]).filter(it=>it.closingBalance>0);
                if(itemsWithBalance.length > 0) {
                    const preview = itemsWithBalance.slice(0,3).map(it=>`• ${it.name||it.id}: ${it.closingBalance} ${it.unit||''}`).join('\n');
                    const more = itemsWithBalance.length>3 ? `  ...และอีก ${itemsWithBalance.length-3} รายการ` : '';
                    const msg = `📋 พบข้อมูลยอดปิดเมื่อวาน (${prevDateTH})\nระบบจะดึงมาเป็นยอดยกมาวันนี้:\n\n${preview}${more}\n\nรับยอดยกมาจากเมื่อวานใช่ไหม?`;
                    if(!confirm(msg)) {
                        window._dscSkipOpening = true;
                    } else {
                        window._dscSkipOpening = false;
                    }
                    window._dscOpeningConfirmed = true;
                }
            }
            if(todayCard || !window._dscOpeningConfirmed) window._dscSkipOpening = false;

            const issued = window._dscTodayIssued||{};
            c.innerHTML = `
            <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;min-width:800px;" id="dscTable">
                <thead>
                    <tr style="background:#1e293b;color:white;">
                        <th style="padding:12px;text-align:left;font-size:12px;" rowspan="2">สินค้า</th>
                        <th style="padding:12px;text-align:center;font-size:12px;border-left:1px solid rgba(255,255,255,0.1);" colspan="1">ยกมา</th>
                        <th style="padding:12px;text-align:center;font-size:12px;border-left:1px solid rgba(255,255,255,0.1);background:#166534;" colspan="1">รับเข้า</th>
                        <th style="padding:12px;text-align:center;font-size:12px;border-left:1px solid rgba(255,255,255,0.1);background:#7f1d1d;" colspan="1">จ่ายออก</th>
                        <th style="padding:12px;text-align:center;font-size:12px;border-left:1px solid rgba(255,255,255,0.1);background:#1e3a5f;" colspan="1">คงเหลือเย็น</th>
                        <th style="padding:12px;text-align:center;font-size:12px;border-left:1px solid rgba(255,255,255,0.1);" colspan="1">ผลต่าง</th>
                        <th style="padding:12px;text-align:left;font-size:12px;border-left:1px solid rgba(255,255,255,0.1);">หมายเหตุ</th>
                    </tr>
                    <tr style="background:#334155;color:#94a3b8;font-size:10px;">
                        <th style="padding:6px 12px;border-left:1px solid rgba(255,255,255,0.1);">จากเมื่อวาน</th>
                        <th style="padding:6px 12px;border-left:1px solid rgba(255,255,255,0.1);background:#14532d;">กรอกเอง</th>
                        <th style="padding:6px 12px;border-left:1px solid rgba(255,255,255,0.1);background:#450a0a;">จากใบเบิก+manual</th>
                        <th style="padding:6px 12px;border-left:1px solid rgba(255,255,255,0.1);background:#172554;">กรอกเอง</th>
                        <th style="padding:6px 12px;border-left:1px solid rgba(255,255,255,0.1);">คำนวณอัตโนมัติ</th>
                        <th style="padding:6px 12px;border-left:1px solid rgba(255,255,255,0.1);"></th>
                    </tr>
                </thead>
                <tbody>${zoneProds.map(p=>{
                    const u = (p.units||[{name:p.unit||''}])[0]?.name||'';
                    const prevItem = prevCard?.items?.find(it=>it.id===p.id);
                    const todayItem = todayCard?.items?.find(it=>it.id===p.id);
                    const opening = todayItem?.openingBalance ?? (window._dscSkipOpening ? '' : (prevItem?.closingBalance ?? ''));
                    const recv = todayItem?.received ?? '';
                    const iss = issued[p.id]||0;
                    const issManual = todayItem?.issuedManual ?? 0;
                    const closing = todayItem?.closingBalance ?? '';
                    const note = todayItem?.note||'';
                    return `<tr class="stock-row dsc-row" data-id="${p.id}" data-name="${p.name.toLowerCase()} ${p.id.toLowerCase()}"
                        style="border-bottom:1px solid #f1f5f9;">
                        <td style="padding:10px 12px;">
                            <b style="font-size:13px;">${p.id}</b><br>
                            <span style="color:#475569;font-size:12px;">${p.name}</span><br>
                            <small style="color:#94a3b8;font-size:10px;">${u}</small>
                        </td>
                        <td style="padding:10px;text-align:center;border-left:2px solid #f1f5f9;">
                            <span id="dsc_open_${p.id}" style="font-size:16px;font-weight:bold;color:#64748b;">${opening!==''?opening:'—'}</span>
                            <input type="hidden" id="dsc_opening_${p.id}" value="${opening}">
                        </td>
                        <td style="padding:10px;text-align:center;border-left:2px solid #dcfce7;background:#f0fdf4;">
                            <input type="number" id="dsc_recv_${p.id}" value="${recv}" min="0" placeholder="0"
                                oninput="calcDSCVariance('${p.id}')"
                                style="width:75px;padding:7px;border:2px solid #6ee7b7;border-radius:8px;text-align:center;font-weight:bold;font-size:14px;outline:none;">
                        </td>
                        <td style="padding:10px;text-align:center;border-left:2px solid #fee2e2;background:#fff5f5;">
                            <div style="font-size:14px;font-weight:bold;color:#ef4444;" id="dsc_iss_auto_${p.id}">${iss}</div>
                            <small style="color:#94a3b8;font-size:10px;">(ใบเบิก)</small><br>
                            <input type="number" id="dsc_iss_manual_${p.id}" value="${issManual||''}" min="0" placeholder="+เพิ่ม"
                                oninput="calcDSCVariance('${p.id}')"
                                style="width:65px;padding:5px;border:1px dashed #fca5a5;border-radius:6px;text-align:center;font-size:12px;outline:none;margin-top:4px;">
                        </td>
                        <td style="padding:10px;text-align:center;border-left:2px solid #dbeafe;background:#eff6ff;">
                            <input type="number" id="dsc_close_${p.id}" value="${closing}" min="0" placeholder="0"
                                oninput="calcDSCVariance('${p.id}')"
                                style="width:75px;padding:7px;border:2px solid #93c5fd;border-radius:8px;text-align:center;font-weight:bold;font-size:14px;outline:none;">
                        </td>
                        <td style="padding:10px;text-align:center;border-left:2px solid #f1f5f9;" id="dsc_var_${p.id}">
                            <span style="color:#94a3b8;">—</span>
                        </td>
                        <td style="padding:10px;border-left:2px solid #f1f5f9;">
                            <input type="text" id="dsc_note_${p.id}" value="${note}" placeholder="หมายเหตุ"
                                style="width:100%;padding:5px 8px;border:1px solid #e2e8f0;border-radius:6px;font-size:11px;box-sizing:border-box;">
                        </td>
                    </tr>`;
                }).join('')}</tbody>
            </table></div>`;

            // คำนวณ variance ของทุกแถวที่มีข้อมูล
            zoneProds.forEach(p=>calcDSCVariance(p.id));
        };

        window.calcDSCVariance = function(id) {
            const opening = parseFloat(document.getElementById(`dsc_opening_${id}`)?.value)||0;
            const recv    = parseFloat(document.getElementById(`dsc_recv_${id}`)?.value)||0;
            const issAuto = parseFloat(document.getElementById(`dsc_iss_auto_${id}`)?.innerText)||0;
            const issMan  = parseFloat(document.getElementById(`dsc_iss_manual_${id}`)?.value)||0;
            const closing = document.getElementById(`dsc_close_${id}`)?.value;
            const varEl   = document.getElementById(`dsc_var_${id}`);
            if(!varEl) return;

            if(closing==='') { varEl.innerHTML='<span style="color:#94a3b8;">—</span>'; return; }
            const closingNum = parseFloat(closing)||0;
            // expected = opening + recv - issued
            const totalIssued = issAuto + issMan;
            const expected = opening + recv - totalIssued;
            const variance = closingNum - expected;
            const abs = Math.abs(variance).toFixed(1);
            if(variance===0) {
                varEl.innerHTML='<span style="color:#10b981;font-weight:bold;">✅ ตรง</span>';
            } else if(variance>0) {
                varEl.innerHTML=`<span style="font-weight:bold;color:#3b82f6;">+${abs}</span><br><small style="font-size:10px;color:#3b82f6;">เกินกว่าคาด</small>`;
            } else {
                varEl.innerHTML=`<span style="font-weight:bold;color:#ef4444;">-${abs}</span><br><small style="font-size:10px;color:#ef4444;">ขาดกว่าคาด</small>`;
            }
        };

        window.filterDSCRows = function(q) {
            q = q.toLowerCase().trim();
            document.querySelectorAll('.dsc-row').forEach(r=>{
                r.style.display = (!q||r.dataset.name.includes(q)) ? '' : 'none';
            });
        };

        window.saveDailyStockCard = async function() {
            const date = document.getElementById('dsc_date')?.value;
            const zone = document.getElementById('dsc_zone')?.value;
            if(!date||!zone){toast('⚠️ กรุณาเลือกวันที่และคลัง','#c2410c');return;}

            const [y,m,d] = date.split('-');
            const dateTH = `${d}/${m}/${parseInt(y)+543}`;
            const zoneProds = getZoneProducts(zone);

            const items = zoneProds.map(p=>{
                const opening  = parseFloat(document.getElementById(`dsc_opening_${p.id}`)?.value)||0;
                const recv     = parseFloat(document.getElementById(`dsc_recv_${p.id}`)?.value)||0;
                const issAuto  = parseFloat(document.getElementById(`dsc_iss_auto_${p.id}`)?.innerText)||0;
                const issMan   = parseFloat(document.getElementById(`dsc_iss_manual_${p.id}`)?.value)||0;
                const closing  = document.getElementById(`dsc_close_${p.id}`)?.value;
                const note     = document.getElementById(`dsc_note_${p.id}`)?.value||'';
                const u        = (p.units||[{name:p.unit||''}])[0]?.name||'';
                if(closing==='' && recv===0 && issMan===0) return null;
                const closingNum = parseFloat(closing)||0;
                const totalIssued = issAuto + issMan;
                const expected = opening + recv - totalIssued;
                const variance = closingNum - expected;
                return {id:p.id, name:p.name, unit:u,
                    openingBalance:opening, received:recv,
                    issuedAuto:issAuto, issuedManual:issMan,
                    closingBalance:closingNum, variance:parseFloat(variance.toFixed(2)), note};
            }).filter(Boolean);

            if(!items.length){toast('⚠️ กรุณากรอกข้อมูลอย่างน้อย 1 รายการ','#c2410c');return;}
            if(!confirm(`ยืนยันบันทึก Stock Card ${zone} วันที่ ${dateTH}?`))return;

            const payload = {date:dateTH, zone, timestamp:Date.now(), recordedBy:currentUser.name, items};
            if(window._dscEditId) {
                const {updateDoc} = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
                await updateDoc(doc(db,'dailyStockCards',window._dscEditId), payload);
            } else {
                await addDoc(collection(db,'dailyStockCards'), payload);
            }
            toast('✅ บันทึก Stock Card สำเร็จ','#059669');
            renderDSCItems();
        };

        // ---- ประวัติย้อนหลัง ----
        window.viewDailyHistory = async function() {
            document.getElementById('dashboardView').classList.add('hidden');
            const c = document.getElementById('toolAppContainer'); c.classList.remove('hidden');
            c.innerHTML = `
            <div class="tool-header">
                <h2>📊 ประวัติ Daily Stock Card</h2>
                <div style="display:flex;gap:8px;">
                    <button onclick="exportDSCExcel()" style="background:var(--success);color:white;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-weight:bold;">📥 Excel</button>
                    <button onclick="exportDSCPDF()" style="background:#7c3aed;color:white;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-weight:bold;">🖨️ PDF</button>
                    <button onclick="openDailyStockCard()" style="background:#06b6d4;color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:bold;">📋 บันทึกวันนี้</button>
                    <button onclick="goToDashboard()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;">🏠 Dashboard</button><button onclick="closeTool()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;">✕ ปิด</button>
                </div>
            </div>
            <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;">
                <div class="input-group" style="min-width:200px;"><label>📦 คลัง</label>
                    <select id="dsch_zone" onchange="loadDSCHistory()" style="width:100%;border:none;font-weight:bold;outline:none;">
                        <option value="">— ทุกคลัง —</option>
                        ${getVisibleWarehouses().map(z=>`<option value="${z}">${z}</option>`).join('')}
                    </select></div>
                <div class="input-group" style="min-width:200px;"><label>🍎 สินค้า</label>
                    <select id="dsch_prod" onchange="loadDSCHistory()" style="width:100%;border:none;font-weight:bold;outline:none;">
                        <option value="">— ทุกสินค้า —</option>
                        ${allProducts.map(p=>`<option value="${p.id}">${p.id} - ${p.name}</option>`).join('')}
                    </select></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
                <div style="background:white;border-radius:14px;padding:20px;border:1px solid #e2e8f0;">
                    <h4 style="margin:0 0 12px;">📈 ยอดคงเหลือเย็น (Trend)</h4>
                    <div class="chart-wrap" style="height:180px;"><canvas id="dscClosingChart" height="180"></canvas></div>
                </div>
                <div style="background:white;border-radius:14px;padding:20px;border:1px solid #e2e8f0;">
                    <h4 style="margin:0 0 12px;">📉 จ่ายออกแต่ละวัน</h4>
                    <div class="chart-wrap" style="height:180px;"><canvas id="dscIssuedChart" height="180"></canvas></div>
                </div>
            </div>
            <div style="background:white;border-radius:14px;border:1px solid #e2e8f0;overflow:hidden;" id="dscHistoryTable">
                <p style="text-align:center;color:#94a3b8;padding:30px;">กำลังโหลด...</p>
            </div>`;
            await loadDSCHistory();
        };

        let _dscChart1=null,_dscChart2=null;
        window.loadDSCHistory = async function() {
            const zone = document.getElementById('dsch_zone')?.value||'';
            const prodId = document.getElementById('dsch_prod')?.value||'';
            const snap = await getDocs(query(collection(db,'dailyStockCards'), orderBy('savedAt','desc'), limit(300)));
            let cards = [];
            snap.forEach(d=>cards.push({id:d.id,...d.data()}));
            if(zone) cards = cards.filter(c=>c.zone===zone);
            cards.sort((a,b)=>a.timestamp-b.timestamp);

            // flatten items
            const rows = [];
            cards.forEach(card=>{
                (card.items||[]).forEach(it=>{
                    if(!prodId||it.id===prodId) rows.push({date:card.date,zone:card.zone,recordedBy:card.recordedBy,cardId:card.id,...it});
                });
            });

            // charts
            const labels = rows.map(r=>`${r.date}
${r.zone}`);
            const closing = rows.map(r=>r.closingBalance||0);
            const issued  = rows.map(r=>(r.issuedAuto||0)+(r.issuedManual||0));

            if(_dscChart1)_dscChart1.destroy();
            if(_dscChart2)_dscChart2.destroy();
            const c1=document.getElementById('dscClosingChart');
            const c2=document.getElementById('dscIssuedChart');
            if(c1&&rows.length){c1.style.height='180px';c1.style.maxHeight='180px';_dscChart1=new Chart(c1,{type:'line',data:{labels,datasets:[{label:'คงเหลือเย็น',data:closing,borderColor:'#06b6d4',backgroundColor:'rgba(6,182,212,0.08)',borderWidth:2,tension:0.3,fill:true,pointRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true},x:{ticks:{maxRotation:45}}}}});}
            if(c2&&rows.length){c2.style.height='180px';c2.style.maxHeight='180px';_dscChart2=new Chart(c2,{type:'bar',data:{labels,datasets:[{label:'จ่ายออก',data:issued,backgroundColor:'rgba(239,68,68,0.15)',borderColor:'#ef4444',borderWidth:2,borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true},x:{ticks:{maxRotation:45}}}}});}

            const tbl=document.getElementById('dscHistoryTable');
            if(!tbl)return;
            if(!rows.length){tbl.innerHTML='<p style="text-align:center;color:#94a3b8;padding:30px;">ยังไม่มีข้อมูล — บันทึก Stock Card วันแรกได้เลยครับ</p>';return;}
            tbl.innerHTML=`<table style="width:100%;border-collapse:collapse;">
                <thead><tr style="background:#f8fafc;">
                    <th style="padding:10px;font-size:11px;color:#64748b;text-align:left;">วันที่</th>
                    <th style="padding:10px;font-size:11px;color:#64748b;text-align:left;">คลัง</th>
                    <th style="padding:10px;font-size:11px;color:#64748b;text-align:left;">รหัส</th>
                    <th style="padding:10px;font-size:11px;color:#64748b;text-align:left;">ชื่อสินค้า</th>
                    <th style="padding:10px;font-size:11px;color:#64748b;text-align:center;">ยกมา</th>
                    <th style="padding:10px;font-size:11px;color:#10b981;text-align:center;">รับเข้า</th>
                    <th style="padding:10px;font-size:11px;color:#ef4444;text-align:center;">จ่ายออก</th>
                    <th style="padding:10px;font-size:11px;color:#3b82f6;text-align:center;">คงเหลือเย็น</th>
                    <th style="padding:10px;font-size:11px;color:#64748b;text-align:center;">ผลต่าง</th>
                    <th style="padding:10px;font-size:11px;color:#64748b;text-align:center;">หน่วย</th>
                    <th style="padding:10px;font-size:11px;color:#64748b;text-align:left;">หมายเหตุ</th>
                    <th style="padding:10px;font-size:11px;color:#64748b;text-align:center;"></th>
                </tr></thead>
                <tbody>${rows.map(r=>{
                    const varColor=r.variance>0?'#3b82f6':r.variance<0?'#ef4444':'#10b981';
                    const varText=r.variance===0?'✅':r.variance>0?`+${r.variance}`:`${r.variance}`;
                    return `<tr style="border-top:1px solid #f1f5f9;">
                        <td style="padding:9px;font-size:12px;">${r.date}</td>
                        <td style="padding:9px;font-size:12px;color:#64748b;">${r.zone}</td>
                        <td style="padding:9px;font-weight:bold;font-size:12px;">${r.id}</td>
                        <td style="padding:9px;font-size:12px;color:#475569;">${r.name}</td>
                        <td style="padding:9px;text-align:center;color:#64748b;">${r.openingBalance??'-'}</td>
                        <td style="padding:9px;text-align:center;font-weight:bold;color:#10b981;">${r.received||0}</td>
                        <td style="padding:9px;text-align:center;font-weight:bold;color:#ef4444;">${(r.issuedAuto||0)+(r.issuedManual||0)}</td>
                        <td style="padding:9px;text-align:center;font-weight:bold;color:#3b82f6;font-size:14px;">${r.closingBalance??'-'}</td>
                        <td style="padding:9px;text-align:center;font-weight:bold;color:${varColor};">${varText}</td>
                        <td style="padding:9px;text-align:center;color:#64748b;font-size:11px;">${r.unit}</td>
                        <td style="padding:9px;font-size:11px;color:#64748b;">${r.note||'-'}</td>
                        <td style="padding:9px;text-align:center;">${(currentUser?.role==='admin'&&r.cardId)?`<button onclick="deleteDSCRow('${r.cardId||''}','${r.id||''}')" style="background:#fef2f2;color:#ef4444;border:1px solid #fecaca;padding:3px 8px;border-radius:6px;cursor:pointer;font-size:11px;">🗑️</button>`:''}
                        </td>
                    </tr>`;
                }).join('')}</tbody>
            </table>`;
            window._dscExportRows = rows;
        };

        window.deleteDSCRow = async function(cardId, productId) {
            if(!confirm('ยืนยันลบรายการนี้?')) return;
            try {
                const snap = await getDoc(doc(db,'dailyStockCards',cardId));
                if(!snap.exists()) { toast('❌ ไม่พบข้อมูล','#c2410c'); return; }
                const card = snap.data();
                const newItems = (card.items||[]).filter(it=>it.id!==productId);
                if(newItems.length===0) {
                    await deleteDoc(doc(db,'dailyStockCards',cardId));
                } else {
                    await updateDoc(doc(db,'dailyStockCards',cardId),{items:newItems});
                }
                toast('🗑️ ลบเรียบร้อย','#059669');
                // refresh
                const zoneEl = document.getElementById('dscFilterZone');
                const prodEl = document.getElementById('dscFilterProduct');
                window.loadDSCHistory(zoneEl?.value||'', prodEl?.value||'');
            } catch(e) { toast('❌ ลบไม่สำเร็จ','#c2410c'); }
        };

        window.exportDSCExcel = function() {
            const rows = window._dscExportRows||[];
            if(!rows.length){toast('❌ ไม่มีข้อมูล','#c2410c');return;}
            const header=[['วันที่','คลัง','รหัส','ชื่อสินค้า','ยกมา','รับเข้า','จ่ายออก(ใบเบิก)','จ่ายออก(manual)','คงเหลือเย็น','ผลต่าง','หน่วย','หมายเหตุ','บันทึกโดย']];
            const data=rows.map(r=>[r.date,r.zone,r.id,r.name,r.openingBalance??'',r.received||0,r.issuedAuto||0,r.issuedManual||0,r.closingBalance??'',r.variance??'',r.unit,r.note||'',r.recordedBy||'']);
            const ws=XLSX.utils.aoa_to_sheet([...header,...data]),wb=XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb,ws,'DailyStockCard');
            XLSX.writeFile(wb,`DailyStockCard_${new Date().toLocaleDateString('th-TH').replace(/\//g,'-')}.xlsx`);
        };

        // ======== MONTHLY COUNT LOCK ========

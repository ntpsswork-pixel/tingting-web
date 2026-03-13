// stock-summary.js — TTGPlus | openStockSummary, loadCurrentReport, loadSnapshot, loadHistory, exporters
        window.openStockSummary=async function(){
            document.getElementById('dashboardView').classList.add('hidden');
            const c=document.getElementById('toolAppContainer');c.classList.remove('hidden');
            const visibleZones=getVisibleWarehouses();
            c.innerHTML=`<div class="tool-header"><h2>📊 ประวัติ & Export รายงาน</h2><button onclick="closeTool()">✕ ปิด</button></div>
            <div class="filter-bar no-print" style="flex-wrap:wrap;gap:12px;">
                <div>
                    <label>📋 ประเภทรายงาน</label>
                    <select id="reportMode" onchange="switchReportMode()" style="padding:10px 14px;border:2px solid var(--primary-dark);border-radius:10px;font-size:14px;font-weight:bold;min-width:220px;">
                        <option value="history">📜 ประวัติการนับ (ทุก session)</option>
                        <option value="snapshot">📦 ยอดสต๊อกล่าสุด (พร้อม export)</option>
                    </select>
                </div>
                <div><label>📦 เลือกคลัง</label>
                    <select id="filterZone" onchange="loadCurrentReport()">
                        <option value="">— ทุกคลัง —</option>
                        ${visibleZones.map(w=>`<option value="${w}">${w}</option>`).join('')}
                    </select></div>
                <div id="dateFromWrap"><label>📅 วันที่เริ่มต้น</label>
    <input type="text" id="filterDateFrom_txt" placeholder="dd/mm/yyyy" maxlength="10"
        oninput="formatDateInput(this,'filterDateFrom');loadCurrentReport()"
        style="padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-size:13px;width:130px;outline:none;">
    <input type="hidden" id="filterDateFrom">
</div>
                <div id="dateToWrap"><label>📅 วันที่สิ้นสุด</label>
    <input type="text" id="filterDateTo_txt" placeholder="dd/mm/yyyy" maxlength="10"
        oninput="formatDateInput(this,'filterDateTo');loadCurrentReport()"
        style="padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-size:13px;width:130px;outline:none;">
    <input type="hidden" id="filterDateTo">
</div>
                <div style="display:flex;gap:8px;align-items:flex-end;">
                    <button onclick="exportCurrentReport()" style="background:var(--success);color:white;border:none;padding:12px 20px;border-radius:10px;cursor:pointer;font-weight:bold;">📥 Export Excel</button>
                    <button onclick="window.print()" style="background:var(--danger);color:white;border:none;padding:12px 20px;border-radius:10px;cursor:pointer;font-weight:bold;">🖨️ Print PDF</button>
                </div>
            </div>
            <div style="margin:0 0 16px;padding:14px 18px;background:linear-gradient(90deg,#f5f3ff,#eff6ff);border:1.5px solid #c4b5fd;border-radius:12px;display:flex;align-items:center;gap:14px;" class="no-print">
                <div style="font-size:28px;">📅</div>
                <div style="flex:1;">
                    <div style="font-weight:700;font-size:14px;color:#5b21b6;">ประวัติการนับสต๊อกสิ้นเดือน</div>
                    <div style="font-size:12px;color:#64748b;">ดูรายงานการนับสต๊อกสิ้นเดือนทุกสาขาแยกตามเดือน — มีประวัติย้อนหลัง, Export Excel และ PDF</div>
                </div>
                <button onclick="openMonthlyHistoryView()"
                    style="background:#7c3aed;color:white;border:none;padding:10px 20px;border-radius:10px;cursor:pointer;font-weight:bold;font-size:13px;white-space:nowrap;">
                    📅 ดูประวัติสิ้นเดือน →
                </button>
            </div>
            <div style="margin:0 0 16px;padding:14px 18px;background:linear-gradient(90deg,#fff7ed,#fef3c7);border:1.5px solid #fed7aa;border-radius:12px;display:flex;align-items:center;gap:14px;" class="no-print">
                <div style="font-size:28px;">🏭</div>
                <div style="flex:1;">
                    <div style="font-weight:700;font-size:14px;color:#c2410c;">Export รวมยอดคลังหลัก</div>
                    <div style="font-size:12px;color:#64748b;">รวมยอดจากหลาย Zone ย่อยของคลังหลักเดียวกัน — สินค้าชื่อเดียวกันจะถูกรวมยอด และ convert เป็นหน่วย Export</div>
                </div>
                <button onclick="openParentWhExportModal()"
                    style="background:#ea580c;color:white;border:none;padding:10px 20px;border-radius:10px;cursor:pointer;font-weight:bold;font-size:13px;white-space:nowrap;">
                    🏭 Export คลังหลัก →
                </button>
            </div>
            <div id="historyContainer"><p style="color:#94a3b8;text-align:center;padding:40px;">กำลังโหลด...</p></div>`;
            await loadCurrentReport();
        };

        window.switchReportMode=function(){
            const mode=document.getElementById('reportMode').value;
            document.getElementById('dateFromWrap').style.display=mode==='history'?'':'none';
            document.getElementById('dateToWrap').style.display=mode==='history'?'':'none';
            loadCurrentReport();
        };

        window.loadCurrentReport=async function(){
            const mode=document.getElementById('reportMode')?.value||'history';
            if(mode==='snapshot') await loadSnapshot();
            else await loadHistory();
        };

        window.exportCurrentReport=function(){
            const mode=document.getElementById('reportMode')?.value||'history';
            if(mode==='snapshot') exportExcelSnapshot();
            else exportExcelHistory();
        };

        // ---- SNAPSHOT: ยอดสต๊อกล่าสุดแต่ละสินค้า ----
        window.loadSnapshot=async function(){
            const zone=document.getElementById('filterZone')?.value||'';
            const container=document.getElementById('historyContainer');
            if(!container)return;
            container.innerHTML='<p style="color:#94a3b8;text-align:center;padding:40px;">กำลังโหลด...</p>';
            try{
                await loadCountData();
                const zones=zone?[zone]:getVisibleWarehouses();
                let html='';
                zones.forEach(z=>{
                    const prods=getZoneProducts(z);
                    if(!prods.length)return;
                    html+=`<div class="history-card" style="margin-bottom:20px;">
                        <div class="history-card-header"><b>📦 ${z}</b></div>
                        <table style="width:100%;border-collapse:collapse;">
                            <thead><tr style="background:#f8fafc;">
                                <th style="padding:10px;text-align:left;font-size:12px;color:#64748b;">รหัส</th>
                                <th style="padding:10px;text-align:left;font-size:12px;color:#64748b;">ชื่อสินค้า</th>
                                <th style="padding:10px;text-align:center;font-size:12px;color:#64748b;">ยอดสต๊อก</th>
                                <th style="padding:10px;text-align:center;font-size:12px;color:#64748b;">หน่วย</th>
                                <th style="padding:10px;text-align:center;font-size:12px;color:#64748b;">นับล่าสุด</th>
                                <th style="padding:10px;text-align:center;font-size:12px;color:#64748b;">โดย</th>
                            </tr></thead>
                            <tbody>${prods.map(p=>{
                                const cd=countData[p.id]||{total:0};
                                const units=p.units||[{name:p.unit||''}];
                                return `<tr style="border-top:1px solid #f1f5f9;">
                                    <td style="padding:10px;font-weight:bold;">${p.id}</td>
                                    <td style="padding:10px;color:#475569;">${p.name}</td>
                                    <td style="padding:10px;text-align:center;font-weight:bold;color:var(--success);font-size:16px;">${cd.total||0}</td>
                                    <td style="padding:10px;text-align:center;color:#64748b;">${units[0]?.name||''}</td>
                                    <td style="padding:10px;text-align:center;font-size:12px;color:#94a3b8;">${cd.lastUpdate||'-'}</td>
                                    <td style="padding:10px;text-align:center;font-size:12px;color:#94a3b8;">${cd.countedBy||'-'}</td>
                                    <td style="padding:8px;text-align:center;">${currentUser.role==='admin'?`<button onclick="openEditStockModal('${p.id}')" style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px;color:#475569;">✏️ แก้</button>`:''}</td>
                                </tr>`;}).join('')}
                            </tbody>
                        </table>
                    </div>`;
                });
                container.innerHTML=html||'<p style="color:#94a3b8;text-align:center;padding:40px;">ไม่พบข้อมูล</p>';
            }catch(e){console.error(e);container.innerHTML='<p style="color:var(--danger);text-align:center;padding:40px;">❌ โหลดข้อมูลไม่สำเร็จ</p>';}
        };

        window.exportExcelSnapshot=function(){
            const zone=document.getElementById('filterZone')?.value||'';
            const zones=zone?[zone]:getVisibleWarehouses();
            const rows=[['คลัง','รหัสสินค้า','ชื่อสินค้า','ยอดสต๊อก','หน่วย','นับล่าสุด','โดย']];
            zones.forEach(z=>{
                const prods=getZoneProducts(z);
                prods.forEach(p=>{
                    const cd=countData[p.id]||{total:0};
                    const units=p.units||[{name:p.unit||''}];
                    rows.push([z,p.id,p.name,cd.total||0,units[0]?.name||'',cd.lastUpdate||'',cd.countedBy||'']);
                });
            });
            const ws=XLSX.utils.aoa_to_sheet(rows),wb=XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb,ws,'ยอดสต๊อก');
            XLSX.writeFile(wb,`Stock_Snapshot_${new Date().toLocaleDateString('th-TH')}.xlsx`);
        };

        let currentHistoryData=[];

        window.loadHistory=async function(){
            const zone=document.getElementById('filterZone')?.value||'';
            const dateFrom=document.getElementById('filterDateFrom')?.value||'';
            const dateTo=document.getElementById('filterDateTo')?.value||'';
            // ถ้าอยู่ใน snapshot mode ให้ข้ามไป
            if(document.getElementById('reportMode')?.value==='snapshot'){loadSnapshot();return;}
            const container=document.getElementById('historyContainer');
            if(!container)return;
            container.innerHTML='<p style="color:#94a3b8;text-align:center;padding:40px;">กำลังโหลด...</p>';
            try {
                const snap=await getDocs(query(collection(db,'stockHistory'), orderBy('timestamp','desc'), limit(500)));
                let sessions=[];
                snap.forEach(d=>sessions.push({id:d.id,...d.data()}));
                if(zone)sessions=sessions.filter(s=>s.zone===zone);
                if(dateFrom){const from=new Date(dateFrom).getTime();sessions=sessions.filter(s=>s.timestamp>=from);}
                if(dateTo){const to=new Date(dateTo).getTime()+86399999;sessions=sessions.filter(s=>s.timestamp<=to);}
                sessions.sort((a,b)=>b.timestamp-a.timestamp);
                currentHistoryData=sessions;
                if(sessions.length===0){container.innerHTML='<p style="color:#94a3b8;text-align:center;padding:40px;">ไม่พบข้อมูลตามเงื่อนไขที่เลือก</p>';return;}
                // Add select-all bar before cards
                const selectBar=`<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
                    <input type="checkbox" id="checkAllSessions" onchange="toggleAllSessions(this.checked)" style="width:17px;height:17px;accent-color:var(--info);cursor:pointer;">
                    <label for="checkAllSessions" style="font-size:13px;font-weight:600;cursor:pointer;">เลือกทั้งหมด</label>
                    <span id="selectedSessionCount" style="font-size:12px;color:#94a3b8;margin-left:4px;"></span>
                    <button onclick="exportSelectedSessions()" style="margin-left:auto;background:var(--success);color:white;border:none;padding:8px 18px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:bold;">📥 Export ที่เลือก</button>
                </div>`;
                container.innerHTML=selectBar+sessions.map(s=>`
                <div class="history-card" style="transition:outline 0.15s;" id="card_${s.id}">
                    <div class="history-card-header">
                        <div style="display:flex;align-items:center;gap:10px;">
                            <input type="checkbox" class="session-check" value="${s.id}" onchange="updateSessionCount()" style="width:17px;height:17px;accent-color:var(--info);cursor:pointer;">
                            <div>
                                <b style="font-size:15px;">📦 ${s.zone}</b>
                                <span style="margin-left:12px;color:#64748b;font-size:13px;">📅 ${s.date} ${s.countedBy?'• 👤 '+s.countedBy:''}</span>
                            </div>
                        </div>
                        <div style="display:flex;align-items:center;gap:10px;">
                            <span style="font-size:11px;color:#94a3b8;">บันทึกโดย: ${s.recordedBy||'-'}</span>
                            ${currentUser.role==='admin'?`<button onclick="deleteHistorySession('${s.id}')" style="background:#fee2e2;color:#ef4444;border:none;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:bold;">🗑️ ลบ</button>`:''}
                        </div>
                    </div>
                    <table style="width:100%;border-collapse:collapse;">
                        <thead><tr style="background:#f8fafc;">
                            <th style="padding:10px;text-align:left;font-size:12px;color:#64748b;">รหัส</th>
                            <th style="padding:10px;text-align:left;font-size:12px;color:#64748b;">ชื่อสินค้า</th>
                            <th style="padding:10px;text-align:center;font-size:12px;color:#64748b;">จำนวน</th>
                            <th style="padding:10px;text-align:center;font-size:12px;color:#64748b;">หน่วย</th>
                            <th style="padding:10px;text-align:center;font-size:12px;color:#64748b;">จำนวน</th>
                            <th style="padding:10px;text-align:center;font-size:12px;color:#64748b;">หน่วย</th>
                            <th style="padding:10px;text-align:center;font-size:12px;color:#64748b;">จำนวน</th>
                            <th style="padding:10px;text-align:center;font-size:12px;color:#64748b;">หน่วย</th>
                        </tr></thead>
                        <tbody>${(s.items||[]).map(it=>{
                            // support both old and new format
                            const amounts=it.amounts||[{amount:it.amountMain||it.amount||0,unit:it.unit||''},{amount:it.amountSub||0,unit:it.subUnit||''}].filter(a=>a.unit);
                            return `<tr style="border-top:1px solid #f1f5f9;">
                            <td style="padding:10px;font-weight:bold;">${it.id}</td>
                            <td style="padding:10px;color:#475569;">${it.name}</td>
                            ${amounts.map(a=>`<td style="padding:10px;text-align:center;font-weight:bold;color:var(--success);">${a.amount>0?a.amount:'-'}</td><td style="padding:10px;text-align:center;color:#64748b;">${a.unit}</td>`).join('')}
                        </tr>`;}).join('')}</tbody>
                    </table>
                </div>`).join('');
            } catch(e){console.error(e);container.innerHTML='<p style="color:var(--danger);text-align:center;padding:40px;">❌ โหลดข้อมูลไม่สำเร็จ</p>';}
        };

        window.toggleAllSessions=function(checked){
            document.querySelectorAll('.session-check').forEach(cb=>cb.checked=checked);
            updateSessionCount();
        };
        window.updateSessionCount=function(){
            const total=document.querySelectorAll('.session-check').length;
            const selected=document.querySelectorAll('.session-check:checked').length;
            const cnt=document.getElementById('selectedSessionCount');
            if(cnt) cnt.textContent=selected>0?`เลือก ${selected}/${total} ใบ`:'';
            const allCb=document.getElementById('checkAllSessions');
            if(allCb) allCb.checked=selected===total&&total>0;
        };
        window.exportSelectedSessions=function(){
            const checked=[...document.querySelectorAll('.session-check:checked')].map(cb=>cb.value);
            if(!checked.length){toast('⚠️ กรุณาเลือกอย่างน้อย 1 ใบ','#f59e0b');return;}
            const selected=currentHistoryData.filter(s=>checked.includes(s.id));
            if(!selected.length){toast('❌ ไม่พบข้อมูล','#c2410c');return;}
            doExportHistory(selected);
        };
        window.exportExcelHistory=function(){
            if(!currentHistoryData||currentHistoryData.length===0){toast('❌ ไม่มีข้อมูลให้ export','#c2410c');return;}
            doExportHistory(currentHistoryData);
        };
        window.doExportHistory=function(sessions){
            if(!sessions||sessions.length===0){toast('❌ ไม่มีข้อมูลให้ export','#c2410c');return;}
            const hasMultiUnit=sessions.some(s=>(s.items||[]).some(it=>{
                const amounts=it.amounts||[];
                return amounts.filter(a=>a.amount>0).length>1;
            }));
            if(!hasMultiUnit){_doWriteHistory(sessions,'__original__');return;}
            // Modal เลือก "ระดับหน่วย" แทนชื่อหน่วย
            const existing=document.getElementById('exportUnitModalH');if(existing)existing.remove();
            const modal=document.createElement('div');
            modal.id='exportUnitModalH';
            modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;';
            // ตัวอย่างแต่ละระดับ
            const ex0=[],ex1=[],ex2=[];
            sessions.forEach(s=>(s.items||[]).forEach(it=>{
                const p=allProducts.find(x=>x.id===it.id);
                const u=p?.units||[];
                if(u[0]?.name&&!ex0.includes(u[0].name))ex0.push(u[0].name);
                if(u[1]?.name&&!ex1.includes(u[1].name))ex1.push(u[1].name);
                if(u[2]?.name&&!ex2.includes(u[2].name))ex2.push(u[2].name);
            }));
            const levelLabel=(arr,lvl)=>arr.length?`<span style="color:#94a3b8;font-size:11px;">(เช่น ${arr.slice(0,3).join(', ')})</span>`:'';
            modal.innerHTML=`<div style="background:white;border-radius:20px;padding:28px;width:100%;max-width:420px;box-shadow:0 20px 60px rgba(0,0,0,0.2);">
                <h3 style="margin:0 0 6px;font-family:inherit;">📥 Export — เลือกระดับหน่วย</h3>
                <p style="font-size:13px;color:#64748b;margin:0 0 16px;">แต่ละสินค้าจะรวมยอดให้เป็น <b>หน่วยของตัวเอง</b> ในระดับที่เลือก</p>
                <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px;">
                    <label style="display:flex;align-items:center;gap:10px;padding:12px;border:1.5px solid #e2e8f0;border-radius:10px;cursor:pointer;">
                        <input type="radio" name="exportUnitH" value="__original__" checked style="width:16px;height:16px;accent-color:#3b82f6;">
                        <div><div style="font-weight:600;">📋 แยกคอลัมน์ตามที่นับ (ไม่รวม)</div><div style="font-size:11px;color:#94a3b8;">แสดงทุกหน่วยแยกกัน</div></div>
                    </label>
                    ${ex0.length?`<label style="display:flex;align-items:center;gap:10px;padding:12px;border:1.5px solid #e2e8f0;border-radius:10px;cursor:pointer;">
                        <input type="radio" name="exportUnitH" value="__level0__" style="width:16px;height:16px;accent-color:#7c3aed;">
                        <div><div style="font-weight:600;">📦 หน่วยใหญ่ (ระดับ 1)</div><div style="font-size:11px;color:#94a3b8;">${ex0.slice(0,4).join(', ')}</div></div>
                    </label>`:''}
                    ${ex1.length?`<label style="display:flex;align-items:center;gap:10px;padding:12px;border:1.5px solid #e2e8f0;border-radius:10px;cursor:pointer;">
                        <input type="radio" name="exportUnitH" value="__level1__" style="width:16px;height:16px;accent-color:#0891b2;">
                        <div><div style="font-weight:600;">🔹 หน่วยกลาง (ระดับ 2)</div><div style="font-size:11px;color:#94a3b8;">${ex1.slice(0,4).join(', ')}</div></div>
                    </label>`:''}
                    ${ex2.length?`<label style="display:flex;align-items:center;gap:10px;padding:12px;border:1.5px solid #e2e8f0;border-radius:10px;cursor:pointer;">
                        <input type="radio" name="exportUnitH" value="__level2__" style="width:16px;height:16px;accent-color:#059669;">
                        <div><div style="font-weight:600;">🔸 หน่วยเล็ก (ระดับ 3)</div><div style="font-size:11px;color:#94a3b8;">${ex2.slice(0,4).join(', ')}</div></div>
                    </label>`:''}
                </div>
                <div style="display:flex;gap:10px;">
                    <button onclick="document.getElementById('exportUnitModalH').remove()" style="flex:1;background:#f1f5f9;color:#475569;border:none;padding:12px;border-radius:10px;cursor:pointer;font-weight:600;font-family:inherit;">ยกเลิก</button>
                    <button onclick="_confirmExportHistory()" style="flex:1;background:#10b981;color:white;border:none;padding:12px;border-radius:10px;cursor:pointer;font-weight:700;font-family:inherit;">📥 Export</button>
                </div>
            </div>`;
            modal.dataset.sessions=JSON.stringify(sessions.map(s=>s.id));
            document.body.appendChild(modal);
        };
        window._confirmExportHistory=function(){
            const sel=document.querySelector('input[name="exportUnitH"]:checked')?.value||'__original__';
            const ids=JSON.parse(document.getElementById('exportUnitModalH')?.dataset.sessions||'[]');
            document.getElementById('exportUnitModalH')?.remove();
            const sessions=currentHistoryData.filter(s=>ids.includes(s.id));
            _doWriteHistory(sessions,sel);
        };
        window._doWriteHistory=function(sessions,targetLevel){
            // targetLevel: '__original__' | '__level0__' | '__level1__' | '__level2__'
            const levelIdx={'__level0__':0,'__level1__':1,'__level2__':2};
            const rows=targetLevel==='__original__'
                ?[["วันที่","คลัง","รหัสสินค้า","ชื่อสินค้า","จำนวนนับ","หน่วย","จำนวนนับ","หน่วย","จำนวนนับ","หน่วย","คนนับ","บันทึกโดย"]]
                :[["วันที่","คลัง","รหัสสินค้า","ชื่อสินค้า","จำนวนนับ","หน่วย","คนนับ","บันทึกโดย"]];
            sessions.forEach(s=>{
                (s.items||[]).forEach(it=>{
                    const p=allProducts.find(x=>x.id===it.id);
                    const units=p?.units||[{name:it.unit||it.amounts?.[0]?.unit||'',rate:0}];
                    const amounts=(it.amounts||[{amount:it.amountMain||it.amount||0,unit:units[0]?.name||''}]);
                    if(targetLevel==='__original__'){
                        const padded=Array.from({length:3},(_,i)=>({
                            amount:amounts[i]?.amount>0?amounts[i].amount:'',
                            unit:amounts[i]?.amount>0?(amounts[i].unit||''):''
                        }));
                        rows.push([s.date,s.zone,it.id,it.name,
                            padded[0].amount,padded[0].unit,
                            padded[1].amount,padded[1].unit,
                            padded[2].amount,padded[2].unit,
                            s.countedBy||'',s.recordedBy||'']);
                    } else {
                        // แปลงทุกหน่วยให้เป็น units[targetIdx] ของสินค้านั้น
                        const tIdx=levelIdx[targetLevel]??0;
                        // ถ้าสินค้าไม่มีหน่วยในระดับนั้น ใช้หน่วยที่มีมากที่สุด (หน่วยสุดท้าย)
                        const realTIdx=Math.min(tIdx, units.length-1);
                        const targetUnitName=units[realTIdx]?.name||units[0]?.name||'';
                        let total=0;
                        amounts.forEach(a=>{
                            if(!a.amount||a.amount<=0)return;
                            const srcIdx=units.findIndex(u=>u.name===a.unit);
                            if(srcIdx<0){total+=a.amount;return;}
                            let v=a.amount;
                            // convert srcIdx → realTIdx
                            if(realTIdx>srcIdx){
                                for(let i=srcIdx;i<realTIdx;i++) v*=(units[i]?.rate||1);
                            } else if(realTIdx<srcIdx){
                                for(let i=realTIdx;i<srcIdx;i++) v/=(units[i]?.rate||1);
                            }
                            total+=v;
                        });
                        rows.push([s.date,s.zone,it.id,it.name,
                            Math.round(total*1000)/1000, targetUnitName,
                            s.countedBy||'',s.recordedBy||'']);
                    }
                });
            });
            const ws=XLSX.utils.aoa_to_sheet(rows),wb=XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb,ws,"StockHistory");
            const zone=document.getElementById('filterZone')?.value||'all';
            const dateStr=new Date().toLocaleDateString('th-TH').replace(/\//g,'-');
            const suffix=targetLevel==='__original__'?'':('_'+{'__level0__':'หน่วยใหญ่','__level1__':'หน่วยกลาง','__level2__':'หน่วยเล็ก'}[targetLevel]);
            XLSX.writeFile(wb,`StockHistory_${zone}${suffix}_${dateStr}.xlsx`);
            toast('📥 Export เรียบร้อย','#10b981');
        };

        // ======== INVENTORY CHECK SYSTEM ========
        // Firestore collection: inventoryHistory
        // แต่ละ doc = { zone, date, timestamp, countedBy, recordedBy, items:[{id,name,balance,unit,note}] }


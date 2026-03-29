// stock-count.js — TTGPlus (extracted)

        // ---- STOCK TOOL (แก้ bug selectedStaff) ----
        window.openCentralStock=function(){
            document.getElementById('dashboardView').classList.add('hidden');
            document.getElementById('toolAppContainer').classList.remove('hidden');
            const visibleZones=getVisibleWarehouses();
            const defaultZone = visibleZones[0]||warehouseList[0];
            if(!tempCountData||!Object.keys(tempCountData).length) tempCountData={};
            renderStockTool(defaultZone);
            // ลงทะเบียน draft protection
            if(window._DM_startStockNormal) setTimeout(()=>_DM_startStockNormal(defaultZone), 400);
        };

        window.renderStockTool=async function(zone){
            const c=document.getElementById('toolAppContainer');
            const visibleZones=getVisibleWarehouses();
            const zoneProds=getZoneProducts(zone);
            const usSnap=await getDocs(collection(db,'users')); let staffOpts='';
            usSnap.forEach(d=>{const u=d.data();if(u.status!=='suspended')staffOpts+=`<option value="${u.name}" ${selectedStaff===u.name?'selected':''}>${u.name}</option>`;});

            c.innerHTML=`<div class="tool-header no-print"><h2>📦 นับสต๊อก: ${zone}</h2><button onclick="closeTool()">✕ ปิด</button></div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-bottom:20px;" class="no-print">
                <div class="input-group"><label>📦 เลือกโซน</label>
                    <select onchange="renderStockTool(this.value)" style="width:100%;border:none;font-weight:bold;outline:none;">
                        ${visibleZones.map(w=>`<option ${w===zone?'selected':''}>${w}</option>`).join('')}
                    </select></div>
                <div class="input-group" style="border:2px solid var(--danger);"><label>📅 วันที่นับ (บังคับเลือก)</label>
                    <input type="date" id="countDate" value="${selectedDate}"
                        onchange="selectedDate=this.value"
                        style="width:100%;border:none;font-weight:bold;outline:none;font-size:14px;color:#1e293b;">
                </div>
                <div class="input-group" style="border:2px solid var(--info);"><label>👤 เลือกชื่อคนนับ</label>
                    <select id="staffSelect" onchange="selectedStaff=this.value" style="width:100%;border:none;font-weight:bold;outline:none;">
                        <option value="">-- กรุณาเลือก --</option>${staffOpts}
                    </select></div>
                <div class="input-group" style="background:#f1f5f9;"><label>📝 ผู้ทำรายการหลัก</label><b>${currentUser.name}</b></div>
            </div>
            <table class="stock-table">${zoneProds.map(p=>{
                const units=p.units||[{name:p.unit||'',rate:0},{name:p.subUnit||'',rate:0}].filter(u=>u.name);
                const pending=tempCountData[p.id];
                const hasPending=pending&&units.some((_,ui)=>(pending['u'+ui]||0)>0);
                const lu=countData[p.id]?.lastUpdate||'-';
                const borderColors=['var(--info)','#a78bfa','#f59e0b'];
                return `<tr class="stock-row">
                <td><b style="font-size:16px;">${p.id}</b><br><span style="color:#475569;">${p.name}</span><br><small style="color:#94a3b8;font-size:10px;">นับล่าสุด: ${lu}</small></td>
                <td style="text-align:right;">
                    <div style="display:flex;align-items:center;justify-content:flex-end;gap:12px;">
                        <div style="text-align:right;min-width:140px;">
                            ${hasPending
                                ? `<div style="font-size:13px;color:var(--info);font-weight:bold;">${units.map((_,ui)=>(pending['u'+ui]||0)>0?`<span>${pending['u'+ui]} ${units[ui].name}</span>`:'').filter(Boolean).join(' + ')}</div>
                                   <div style="font-size:11px;color:#94a3b8;">รอยืนยัน...</div>`
                                : `<div style="font-size:12px;color:#cbd5e1;">—</div>`
                            }
                        </div>
                        <div style="display:flex;flex-direction:column;gap:5px;">
                            ${units.map((u,ui)=>`
                            <div style="display:flex;align-items:center;gap:5px;">
                                <small style="color:${borderColors[ui]||'#64748b'};width:45px;text-align:right;font-weight:bold;">${u.name}:</small>
                                <input type="number" id="input_${p.id}_${ui}" min="0" class="no-print viewonly-input"
                                    style="width:75px;padding:7px;border-radius:8px;border:2px solid ${borderColors[ui]||'#cbd5e1'};text-align:center;font-weight:bold;font-size:14px;"
                                    onkeydown="if(event.key==='Enter') addStock('${p.id}','${p.name}','${zone}',${ui})">
                            </div>`).join('')}
                        </div>
                        <button onclick="addStockAll('${p.id}','${p.name}','${zone}')" class="btn-action no-print" style="background:var(--info);font-size:20px;">＋</button>
                    </div>
                </td></tr>`;}).join('')}</table>
            <p style="color:#94a3b8;font-size:12px;text-align:center;margin-top:5px;" class="no-print">💡 กรอกจำนวนแล้วกด Enter ในช่องนั้น หรือกด ＋ เพื่อเพิ่มทุกช่องพร้อมกัน</p>
            <div class="no-print" style="margin-bottom:12px;">
                <input type="text" id="stockSearch" placeholder="🔍 ค้นหาสินค้า (รหัส / ชื่อ)..." oninput="filterStockRows(this.value)"
                    style="width:100%;padding:10px 16px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box;outline:none;transition:border 0.2s;"
                    onfocus="this.style.borderColor='var(--info)'" onblur="this.style.borderColor='#e2e8f0'">
            </div>
            <div style="margin-top:25px;text-align:center;" class="no-print">
                <button onclick="finalSaveStock('${zone}')" style="background:var(--success);color:white;padding:18px 60px;border:none;border-radius:15px;font-size:20px;font-weight:bold;cursor:pointer;box-shadow:0 4px 15px rgba(16,185,129,0.4);">💾 ยืนยันและบันทึกข้อมูลทั้งหมด</button>
            </div>`;
        };

        // addStock: กรอกแล้วกด Enter ในช่องหน่วยนั้น
        window.addStock=function(id,name,zone,unitIndex){
            const staffEl=document.getElementById('staffSelect');
            if(staffEl&&staffEl.value) selectedStaff=staffEl.value;
            const el=document.getElementById(`input_${id}_${unitIndex}`);
            const val=parseFloat(el?.value)||0;
            if(val<=0){if(el){el.style.borderColor='var(--danger)';setTimeout(()=>el.style.borderColor='',800);}return;}
            if(!tempCountData[id])tempCountData[id]={name};
            tempCountData[id]['u'+unitIndex]=(tempCountData[id]['u'+unitIndex]||0)+val;
            if(el){el.value='';el.style.borderColor='var(--success)';setTimeout(()=>el.style.borderColor='',600);}
            setTimeout(()=>renderStockTool(zone),400);
        };

        // addStockAll: กด ＋ เพิ่มทุกช่องพร้อมกัน
        window.addStockAll=function(id,name,zone){
            const staffEl=document.getElementById('staffSelect');
            if(staffEl&&staffEl.value) selectedStaff=staffEl.value;
            const p=allProducts.find(pd=>pd.id===id);
            const units=p?.units||[{name:p?.unit||'',rate:0}];
            let anyVal=false;
            units.forEach((_,ui)=>{
                const el=document.getElementById(`input_${id}_${ui}`);
                const val=parseFloat(el?.value)||0;
                if(val>0){
                    if(!tempCountData[id])tempCountData[id]={name};
                    tempCountData[id]['u'+ui]=(tempCountData[id]['u'+ui]||0)+val;
                    if(el){el.value='';el.style.borderColor='var(--success)';setTimeout(()=>el.style.borderColor='',600);}
                    anyVal=true;
                }
            });
            if(!anyVal){toast('⚠️ กรุณากรอกจำนวนก่อน','#c2410c');return;}
            setTimeout(()=>renderStockTool(zone),400);
        };

        window.finalSaveStock=async function(zone){
            const staffEl=document.getElementById('staffSelect');
            if(staffEl&&staffEl.value) selectedStaff=staffEl.value;
            const dateEl=document.getElementById('countDate');
            if(dateEl&&dateEl.value) selectedDate=dateEl.value;

            if(!selectedDate){toast('⚠️ กรุณาเลือกวันที่นับก่อน','#c2410c');return;}
            if(!selectedStaff){toast('⚠️ กรุณาเลือกคนนับก่อน','#c2410c');return;}
            const hasChanges=Object.keys(tempCountData).some(id=>{
                const td=tempCountData[id];
                return Object.keys(td).filter(k=>k.startsWith('u')).some(k=>(td[k]||0)>0);
            });
            if(!hasChanges){toast('❌ ไม่พบข้อมูลการเปลี่ยนแปลง กรุณากรอกจำนวนและกด ＋ ก่อน','#c2410c');return;}
            if(!confirm(`ยืนยันการบันทึกวันที่ ${selectedDate} โดยคุณ ${selectedStaff}?`))return;

            // แปลงวันที่จาก yyyy-mm-dd เป็น dd/mm/yyyy (ไทย)
            const [yr,mo,dy]=selectedDate.split('-');
            const dateStr=`${dy}/${mo}/${parseInt(yr)+543}`;
            const now=new Date();
            const timeStr=now.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});
            const ts=dateStr+' '+timeStr;

            // คำนวณยอดรวมใน countData (หน่วยหลักเท่านั้น)
            Object.keys(tempCountData).forEach(id=>{
                const td=tempCountData[id];
                const p=allProducts.find(pd=>pd.id===id);
                const units=p?.units||[{name:p?.unit||'',rate:0}];
                // แปลงทุกหน่วยให้เป็นหน่วยหลัก
                let totalInUnit1=td['u0']||0;
                // u1 แปลงโดย rate[0] ของ unit[0]
                if((td['u1']||0)>0&&units[0]?.rate>0) totalInUnit1+=((td['u1']||0)/units[0].rate);
                if((td['u2']||0)>0&&units[0]?.rate>0&&units[1]?.rate>0) totalInUnit1+=((td['u2']||0)/(units[0].rate*units[1].rate));
                if(!countData[id])countData[id]={total:0,name:td.name};
                // รีเซ็ตเป็น 0 แล้วใส่ยอดที่นับใหม่เท่านั้น (ไม่สะสม)
                countData[id].total=Math.round(totalInUnit1*1000)/1000;
                countData[id].lastUpdate=ts;
                countData[id].countedBy=selectedStaff;
            });
            await saveCountData();

            // บันทึก history พร้อมข้อมูลทุกหน่วย
            const sessionItems=Object.keys(tempCountData).map(id=>{
                const td=tempCountData[id];
                const p=allProducts.find(pd=>pd.id===id);
                const units=p?.units||[{name:p?.unit||'',rate:0}];
                const amounts=units.map((_,ui)=>({amount:td['u'+ui]||0,unit:units[ui]?.name||''}));
                return {id,name:td.name,amounts,units};
            });

            await addDoc(collection(db,'stockHistory'),{
                zone,date:dateStr,timestamp:now.getTime(),
                countedBy:selectedStaff,recordedBy:currentUser.name,items:sessionItems
            });

            tempCountData={};
            toast('✅ บันทึกสำเร็จ! ตัวเลขรีเซ็ตแล้ว','#059669');
            // clear draft หลัง save สำเร็จ
            if(window._DM) _DM.clear('stock_normal');
            renderStockTool(zone);
        };

        // ---- STOCK SUMMARY ----
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
                const snap=await getDocs(collection(db,'stockHistory'));
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

        window.openInventoryCheck=async function(){
            document.getElementById('dashboardView').classList.add('hidden');
            const c=document.getElementById('toolAppContainer');c.classList.remove('hidden');
            const visibleZones=getVisibleWarehouses();
            const today=new Date().toISOString().slice(0,10);
            const usSnap=await getDocs(collection(db,'users'));
            let staffOpts='';
            usSnap.forEach(d=>{const u=d.data();if(u.status!=='suspended')staffOpts+=`<option value="${u.name}">${u.name}</option>`;});

            // build stock sheet template buttons
            const sstEntries = Object.entries(stockSheetTemplates);
            // ฟังก์ชันหา template ที่ตรงกับ zone (รองรับ branchType)
            function getMatchingTemplates(z) {
                return sstEntries.filter(([id,t])=>{
                    const bt=(t.branchType||t.zone||'').toUpperCase();
                    return bt && z.toUpperCase().startsWith(bt);
                });
            }
            const firstZone = visibleZones[0]||'';
            const matchedTmpls = getMatchingTemplates(firstZone);
            const sstBar = sstEntries.length ? `
            <div style="margin-bottom:16px;" class="no-print" id="sstBarContainer">
                <div style="font-size:12px;font-weight:bold;color:#64748b;margin-bottom:8px;">⚡ Template สำเร็จรูป:</div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;" id="sstBarBtns">
                    ${matchedTmpls.map(([id,t])=>`
                    <button onclick="applyInvTemplate('${id}')"
                        style="background:white;border:2px solid ${t.color||'#06b6d4'};color:${t.color||'#06b6d4'};padding:7px 16px;border-radius:20px;cursor:pointer;font-size:12px;font-weight:bold;"
                        onmouseover="this.style.background='${t.color||'#06b6d4'}';this.style.color='white'"
                        onmouseout="this.style.background='white';this.style.color='${t.color||'#06b6d4'}'">
                        📄 ${t.name}
                    </button>`).join('')}
                    ${sstEntries.filter(([id,t])=>!matchedTmpls.find(([mid])=>mid===id)).map(([id,t])=>`
                    <button onclick="applyInvTemplate('${id}')"
                        style="background:white;border:2px dashed ${t.color||'#e2e8f0'};color:#94a3b8;padding:7px 16px;border-radius:20px;cursor:pointer;font-size:12px;"
                        onmouseover="this.style.background='${t.color||'#f8fafc'}';this.style.color='white'"
                        onmouseout="this.style.background='white';this.style.color='#94a3b8'">
                        📄 ${t.name}
                    </button>`).join('')}
                    <button onclick="printStockSheetTemplate(null,'pick')"
                        style="background:white;border:2px dashed #e2e8f0;color:#94a3b8;padding:7px 14px;border-radius:20px;cursor:pointer;font-size:12px;">
                        🖨️ พิมพ์ใบเปล่า
                    </button>
                </div>
            </div>` : '';

            c.innerHTML=`
            <div class="tool-header no-print">
                <h2>📋 ใบนับสต๊อกคงเหลือ</h2>
                <div style="display:flex;gap:8px;">
                    <button onclick="openInventoryAnalysis()" style="background:#7c3aed;color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:bold;">📈 วิเคราะห์ & กราฟ</button>
                    <button onclick="goToDashboard()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;">🏠 Dashboard</button><button onclick="closeTool()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;">✕ ปิด</button>
                </div>
            </div>

            ${sstBar}

            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-bottom:20px;" class="no-print">
                <div class="input-group"><label>📦 เลือกคลัง</label>
                    <select id="invZone" onchange="renderInventoryRows()" style="width:100%;border:none;font-weight:bold;outline:none;">
                        ${visibleZones.map(z=>`<option value="${z}">${z}</option>`).join('')}
                    </select>
                </div>
                <div class="input-group" style="border:2px solid var(--danger);"><label>📅 วันที่นับ (บังคับ)</label>
                    <input type="date" id="invDate" value="${today}"
                        style="width:100%;border:none;font-weight:bold;outline:none;font-size:14px;color:#1e293b;">
                </div>
                <div class="input-group" style="border:2px solid var(--info);"><label>👤 ผู้นับ</label>
                    <select id="invStaff" style="width:100%;border:none;font-weight:bold;outline:none;">
                        <option value="">-- กรุณาเลือก --</option>${staffOpts}
                    </select>
                </div>
                <div class="input-group" style="background:#f1f5f9;"><label>📝 ผู้บันทึก</label><b>${currentUser.name}</b></div>
            </div>

            <div style="margin-bottom:12px;" class="no-print">
                <input type="text" id="invSearch" placeholder="🔍 ค้นหาสินค้า..." oninput="filterInvRows(this.value)"
                    style="width:100%;padding:10px 16px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box;outline:none;">
            </div>

            <div id="invTableContainer"></div>

            <div style="margin-top:25px;text-align:center;" class="no-print">
                <button onclick="saveInventorySheet()" style="background:var(--success);color:white;padding:18px 60px;border:none;border-radius:15px;font-size:18px;font-weight:bold;cursor:pointer;box-shadow:0 4px 15px rgba(16,185,129,0.4);">
                    💾 บันทึกใบนับสต๊อกคงเหลือ
                </button>
            </div>`;

            renderInventoryRows();
        };

        window.renderInventoryRows=async function(){
            const zone=document.getElementById('invZone')?.value||'';
            const zoneProds=getZoneProducts(zone);
            const c=document.getElementById('invTableContainer');
            if(!c)return;

            // โหลด inventory ล่าสุด
            const invSnap=await getDocs(collection(db,'inventoryHistory'));
            let prevSheet=null; let prevTs=0;
            invSnap.forEach(d=>{
                const data=d.data();
                if(data.zone===zone && data.timestamp>prevTs){prevTs=data.timestamp;prevSheet=data;}
            });

            // หา template ที่ตรงกับ zone นี้ — รองรับทั้ง branchType (ใหม่) และ zone (เก่า)
            const matchTmpl = Object.values(stockSheetTemplates).find(t=>{
                const bt = (t.branchType||t.zone||'').toUpperCase();
                return bt && zone.toUpperCase().startsWith(bt);
            });

            // สร้าง render function สำหรับแต่ละ product row
            const renderRow = (p) => {
                const units=p.units||[{name:p.unit||'',rate:0}].filter(u=>u.name);
                const u0=units[0]?.name||'';
                const prevItem=prevSheet?.items?.find(it=>it.id===p.id);
                const prevBal=prevItem?.balance??'-';
                return `<tr class="stock-row inv-row" data-search="${p.id.toLowerCase()} ${p.name.toLowerCase()}">
                    <td style="padding:14px 16px;">
                        <div style="font-weight:700;font-size:13px;color:#1e293b;">${p.id}</div>
                        <div style="color:#475569;font-size:13px;margin-top:2px;">${p.name}</div>
                        ${prevSheet?`<div style="color:#94a3b8;font-size:10px;margin-top:2px;">นับล่าสุด: ${prevSheet.date}</div>`:''}
                    </td>
                    <td style="padding:14px 16px;text-align:center;">
                        <span style="font-size:20px;font-weight:700;color:${prevBal!=='-'?'#64748b':'#cbd5e1'};">${prevBal}</span>
                        ${prevBal!=='-'?`<div style="color:#94a3b8;font-size:10px;">${u0}</div>`:''}
                    </td>
                    <td style="padding:14px 16px;text-align:center;">
                        <input type="number" id="inv_${p.id}" min="0" placeholder="0"
                            oninput="calcDiff('${p.id}',${typeof prevBal==='number'?prevBal:'null'})"
                            style="width:90px;padding:9px;border-radius:10px;border:2px solid #3b82f6;text-align:center;font-weight:700;font-size:16px;outline:none;transition:border 0.2s;"
                            onfocus="this.style.borderColor='#1d4ed8'" onblur="this.style.borderColor='#3b82f6'">
                        <div style="color:#64748b;font-size:10px;margin-top:3px;">${u0}</div>
                    </td>
                    <td style="padding:14px 16px;text-align:center;" id="diff_${p.id}">
                        <span style="color:#cbd5e1;font-size:18px;">—</span>
                    </td>
                    <td style="padding:14px 16px;">
                        <input type="text" id="note_${p.id}" placeholder="หมายเหตุ (ถ้ามี)"
                            style="width:100%;padding:7px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;box-sizing:border-box;outline:none;"
                            onfocus="this.style.borderColor='#3b82f6'" onblur="this.style.borderColor='#e2e8f0'">
                    </td>
                </tr>`;
            };

            // build table rows — ถ้ามี template จัดกลุ่มตาม group
            let tbodyRows = '';
            if(matchTmpl && matchTmpl.items?.length) {
                const groups = [...new Set(matchTmpl.items.map(i=>i.group||'ทั่วไป'))];
                const tmplIds = new Set(matchTmpl.items.map(i=>i.id));
                // render ตาม group จาก template
                groups.forEach(grp => {
                    const grpItemIds = matchTmpl.items.filter(i=>(i.group||'ทั่วไป')===grp).map(i=>i.id);
                    const grpProds = grpItemIds.map(id=>zoneProds.find(p=>p.id===id)).filter(Boolean);
                    if(!grpProds.length) return;
                    tbodyRows += `<tr><td colspan="5" style="padding:10px 16px;background:linear-gradient(90deg,#f0f9ff,#f8fafc);font-weight:700;font-size:12px;color:#0369a1;border-top:2px solid #bae6fd;border-bottom:1px solid #e0f2fe;letter-spacing:0.5px;">
                        ▌ ${grp.toUpperCase()}
                    </td></tr>`;
                    grpProds.forEach(p => { tbodyRows += renderRow(p); });
                });
                // สินค้าที่ไม่อยู่ใน template
                const notInTmpl = zoneProds.filter(p=>!tmplIds.has(p.id));
                if(notInTmpl.length) {
                    tbodyRows += `<tr><td colspan="5" style="padding:10px 16px;background:#fafafa;font-weight:700;font-size:12px;color:#94a3b8;border-top:2px solid #e2e8f0;">▌ รายการอื่นๆ</td></tr>`;
                    notInTmpl.forEach(p => { tbodyRows += renderRow(p); });
                }
            } else {
                zoneProds.forEach(p => { tbodyRows += renderRow(p); });
            }

            c.innerHTML=`
            <div style="background:white;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">
            <table style="width:100%;border-collapse:collapse;" id="invTable">
                <thead><tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;">
                    <th style="padding:12px 16px;text-align:left;font-size:11px;color:#64748b;font-weight:700;letter-spacing:0.5px;width:35%;">สินค้า</th>
                    <th style="padding:12px 16px;text-align:center;font-size:11px;color:#64748b;font-weight:700;letter-spacing:0.5px;">คงเหลือครั้งก่อน</th>
                    <th style="padding:12px 16px;text-align:center;font-size:11px;color:#3b82f6;font-weight:700;letter-spacing:0.5px;">คงเหลือจริงวันนี้</th>
                    <th style="padding:12px 16px;text-align:center;font-size:11px;color:#64748b;font-weight:700;letter-spacing:0.5px;">ผลต่าง (ใช้ไป)</th>
                    <th style="padding:12px 16px;text-align:left;font-size:11px;color:#64748b;font-weight:700;letter-spacing:0.5px;">หมายเหตุ</th>
                </tr></thead>
                <tbody>${tbodyRows}</tbody>
            </table></div>`;
        };

        window.calcDiff=function(id, prevBal){
            const val=parseFloat(document.getElementById(`inv_${id}`)?.value)||0;
            const diffEl=document.getElementById(`diff_${id}`);
            if(!diffEl)return;
            if(prevBal===null||prevBal===undefined||isNaN(prevBal)){
                diffEl.innerHTML='<span style="color:#94a3b8;font-size:12px;">ไม่มีข้อมูลก่อนหน้า</span>';return;
            }
            const diff=prevBal-val;
            const color=diff>0?'var(--danger)':diff<0?'var(--success)':'#64748b';
            const label=diff>0?`ใช้ไป ${diff}`:diff<0?`เพิ่มขึ้น ${Math.abs(diff)}`:'คงเดิม';
            diffEl.innerHTML=`<span style="font-size:15px;font-weight:bold;color:${color};">${diff>0?'-':''}${Math.abs(diff)}</span><br><small style="color:${color};font-size:10px;">${label}</small>`;
        };

        window.filterInvRows=function(q){
            q=q.toLowerCase().trim();
            document.querySelectorAll('.inv-row').forEach(row=>{
                row.style.display=(!q||row.dataset.search.includes(q))?'':'none';
            });
        };

        window.saveInventorySheet=async function(){
            const zone=document.getElementById('invZone')?.value;
            const date=document.getElementById('invDate')?.value;
            const staff=document.getElementById('invStaff')?.value;
            if(!zone||!date){toast('⚠️ กรุณาเลือกคลังและวันที่','#c2410c');return;}
            if(!staff){toast('⚠️ กรุณาเลือกผู้นับ','#c2410c');return;}

            const zoneProds=getZoneProducts(zone);
            const hasAny=zoneProds.some(p=>document.getElementById(`inv_${p.id}`)?.value!=='');
            if(!hasAny){toast('⚠️ กรุณากรอกยอดคงเหลืออย่างน้อย 1 รายการ','#c2410c');return;}

            if(!confirm(`ยืนยันบันทึกใบนับสต๊อก ${zone} วันที่ ${date}?`))return;

            const [yr,mo,dy]=date.split('-');
            const dateStr=`${dy}/${mo}/${parseInt(yr)+543}`;
            const items=zoneProds.map(p=>{
                const units=p.units||[{name:p.unit||''}];
                const val=document.getElementById(`inv_${p.id}`)?.value;
                const balance=val!==''?parseFloat(val):null;
                const note=document.getElementById(`note_${p.id}`)?.value||'';
                return {id:p.id,name:p.name,balance,unit:units[0]?.name||'',note};
            }).filter(it=>it.balance!==null);

            await addDoc(collection(db,'inventoryHistory'),{
                zone,date:dateStr,timestamp:Date.now(),
                countedBy:staff,recordedBy:currentUser.name,items
            });

            toast('✅ บันทึกใบนับสต๊อกคงเหลือสำเร็จ','#059669');
            // รีเซ็ต input
            zoneProds.forEach(p=>{
                const el=document.getElementById(`inv_${p.id}`);
                const nl=document.getElementById(`note_${p.id}`);
                if(el)el.value='';
                if(nl)nl.value='';
                const diff=document.getElementById(`diff_${p.id}`);
                if(diff)diff.innerHTML='<span style="color:#cbd5e1;font-size:13px;">—</span>';
            });
            renderInventoryRows(); // reload เพื่อแสดง prev ใหม่
        };

        // ======== DAILY STOCK CARD ========
        // Firestore: dailyStockCards/{id} = {
        //   date, zone, recordedBy, timestamp,
        //   items:[{ id, name, unit,
        //     openingBalance,   // ยอดยกมา (จากเมื่อวาน)
        //     received,         // รับเข้าวันนี้
        //     issued,           // จ่ายออก (จากใบเบิก + manual)
        //     closingBalance,   // คงเหลือเย็น (กรอกเอง)
        //     variance,         // ผลต่าง (คำนวณอัตโนมัติ)
        //     note
        //   }]
        // }

        window.openDailyStockCard = async function() {
            document.getElementById('dashboardView').classList.add('hidden');
            const c = document.getElementById('toolAppContainer'); c.classList.remove('hidden');
            const visibleZones = getVisibleWarehouses();
            const today = new Date().toISOString().slice(0,10);

            // โหลด issued จากใบเบิกวันนี้
            const reqSnap = await getDocs(collection(db,'requisitions'));
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

            const histSnap = await getDocs(collection(db,'dailyStockCards'));
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
            const snap = await getDocs(collection(db,'dailyStockCards'));
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
        window.tryOpenMonthlyCount = async function() {
            if(!monthlyCountOpen) {
                const existing = document.getElementById('lockedModal'); if(existing) existing.remove();
                const m = document.createElement('div'); m.className='modal-overlay'; m.id='lockedModal';
                m.innerHTML=`<div class="modal-box" style="max-width:400px;text-align:center;">
                    <div style="font-size:48px;margin-bottom:12px;">🔒</div>
                    <h3 style="margin:0 0 8px;">ระบบนับสต๊อกสิ้นเดือนปิดอยู่</h3>
                    <p style="color:#64748b;font-size:13px;margin-bottom:20px;">Admin ยังไม่ได้เปิดระบบนับสต๊อกสิ้นเดือน<br>กรุณาติดต่อผู้ดูแลระบบ</p>
                    <button onclick="document.getElementById('lockedModal').remove()" style="background:#1e293b;color:white;border:none;padding:10px 30px;border-radius:10px;cursor:pointer;font-weight:bold;">ตกลง</button>
                </div>`;
                document.body.appendChild(m);
                return;
            }

            const isBT = currentUser?.username?.toUpperCase().startsWith('BT');

            if(isBT) {
                // === BT Flow: ระบบรู้จักสาขาอัตโนมัติ ===
                const zone = (currentUser.assignedZones||[])[0] || '';
                if(!zone) { toast('⚠️ ไม่พบข้อมูลสาขาของคุณ กรุณาติดต่อ Admin','#c2410c'); return; }

                const sstEntries = Object.entries(stockSheetTemplates);
                if(!sstEntries.length) { toast('⚠️ ยังไม่มี Template ใบนับสต๊อก กรุณาติดต่อ Admin','#c2410c'); return; }

                // หา Template: 1) ดูจาก stockTemplateId ที่ผูกไว้กับ user  2) match branchType  3) fallback ตัวแรก
                let matchedTmpl;
                const userTmplId = currentUser?.stockTemplateId;
                if(userTmplId && stockSheetTemplates[userTmplId]) {
                    matchedTmpl = [userTmplId, stockSheetTemplates[userTmplId]];
                } else if(sstEntries.length === 1) {
                    matchedTmpl = sstEntries[0];
                } else {
                    matchedTmpl = sstEntries.find(([id,t]) => {
                        const bt = (t.branchType||t.zone||'').toUpperCase();
                        return bt && zone.toUpperCase().includes(bt);
                    }) || sstEntries[0];
                }

                const [tmplId, tmpl] = matchedTmpl;

                // ถ้ายังไม่เปิดเดือนนี้ — เช็คก่อนว่านับไปแล้วหรือยัง
                const now = new Date();
                const monthKey = now.toISOString().slice(0,7);
                let existingDoc = null;
                try {
                    const snap = await getDocs(collection(db,'inventoryHistory'));
                    snap.forEach(d => {
                        const x = d.data();
                        if(x.zone === zone && x.month === monthKey && x.type === 'branch') {
                            existingDoc = {id: d.id, ...x};
                        }
                    });
                } catch(e) { console.error(e); }

                if(existingDoc) {
                    openBranchMonthlyDoneSummary(tmplId, tmpl, zone, existingDoc);
                } else {
                    // แสดง modal เลือก: นับเต็ม หรือ สุ่มทดลอง
                    openBTCountModePicker(tmplId, tmpl, zone);
                }
            } else {
                // === Admin/Warehouse Flow: เลือกสาขา ===
                openMonthlyCountAdminPicker();
            }
        };

        // สรุปยอดที่นับแล้ว + ปุ่มแก้ไข
        window.openBranchMonthlyDoneSummary = function(tmplId, tmpl, zone, existingDoc) {
            // เก็บ doc ไว้ใน window เพื่อให้ปุ่มแก้ไข/พิมพ์ใช้ได้
            window._bmcCurrentDoc = existingDoc;
            window._bmcCurrentTmplId = tmplId;
            window._bmcCurrentZone = zone;

            document.getElementById('dashboardView').classList.add('hidden');
            const c = document.getElementById('toolAppContainer'); c.classList.remove('hidden');
            const groups = [...new Set((existingDoc.items||[]).map(i=>i.group||'ทั่วไป'))];
            const isAdmin = currentUser?.role === 'admin';

            c.innerHTML = `
            <div class="tool-header no-print">
                <h2>✅ ผลการนับสต๊อกสิ้นเดือน</h2>
                <div style="display:flex;gap:8px;">
                    <button onclick="editBMCSummary()"
                        style="background:#f59e0b;color:white;border:none;padding:8px 18px;border-radius:8px;cursor:pointer;font-weight:bold;">✏️ แก้ไข / นับใหม่</button>
                    <button onclick="openMonthlyHistoryView()"
                        style="background:#7c3aed;color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:bold;">📅 ประวัติทุกเดือน</button>
                    <button onclick="printBranchMonthlyCountSummary()"
                        style="background:#059669;color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:bold;">🖨️ PDF</button>
                    <button onclick="exportBranchMonthlyCountExcel()"
                        style="background:#0891b2;color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:bold;">📥 Excel</button>
                    ${isAdmin ? `<button onclick="deleteBMCSummary()" style="background:#ef4444;color:white;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-weight:bold;">🗑️ ลบ</button>` : ''}
                    <button onclick="goToDashboard()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;">🏠</button>
                    <button onclick="closeTool()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;">✕</button>
                </div>
            </div>
            <div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:14px;padding:16px 20px;margin-bottom:20px;display:flex;align-items:center;gap:14px;">
                <div style="font-size:36px;">🏪</div>
                <div>
                    <div style="font-size:16px;font-weight:700;color:#065f46;">${zone}</div>
                    <div style="font-size:13px;color:#059669;">นับสต๊อกเดือนนี้เรียบร้อยแล้ว ✓</div>
                    <div style="font-size:12px;color:#94a3b8;margin-top:2px;">วันที่บันทึก: ${existingDoc.date||''} • โดย: ${existingDoc.countedBy||'-'} • Template: ${existingDoc.templateName||'-'}</div>
                </div>
            </div>
            <div style="background:white;border-radius:14px;border:1px solid #e2e8f0;overflow:hidden;">
            <table style="width:100%;border-collapse:collapse;">
                <thead><tr style="background:#1e293b;color:white;">
                    <th style="padding:12px 16px;text-align:left;font-size:12px;">สินค้า</th>
                    <th style="padding:12px;text-align:center;font-size:12px;background:#1d4ed8;">ยอดนับ</th>
                    <th style="padding:12px;text-align:center;font-size:12px;">หน่วย Export</th>
                    <th style="padding:12px;text-align:left;font-size:12px;">หมายเหตุ</th>
                </tr></thead>
                <tbody>
                ${groups.map(grp => {
                    const grpItems = (existingDoc.items||[]).filter(i=>(i.group||'ทั่วไป')===grp);
                    const header = `<tr><td colspan="4" style="padding:9px 16px;background:linear-gradient(90deg,#f0f9ff,#f8fafc);font-weight:700;font-size:11px;color:#0369a1;border-top:2px solid #bae6fd;letter-spacing:.5px;">▌ ${grp.toUpperCase()}</td></tr>`;
                    const rows = grpItems.map((it,idx) => {
                        const p = allProducts.find(x=>x.id===it.id);
                        const tmpl = stockSheetTemplates[window._bmcCurrentTmplId] || {};
                        const tmplItem = (tmpl.items||[]).find(x=>x.id===it.id);
                        const exportUnit = _getExportUnit(it.id, tmplItem);
                        const converted = _convertToExportUnit(it.balance||0, it.unit||'', exportUnit, p);
                        const showConvert = exportUnit && exportUnit !== it.unit && it.unit;
                        return `
                        <tr style="border-bottom:1px solid #f1f5f9;${idx%2===1?'background:#fafafa':''}">
                            <td style="padding:11px 16px;">
                                <div style="font-weight:700;font-size:13px;">${it.id}</div>
                                <div style="color:#475569;font-size:12px;">${it.name}</div>
                            </td>
                            <td style="padding:11px;text-align:center;">
                                <span style="font-size:20px;font-weight:800;color:${(converted||0)>0?'#1d4ed8':'#94a3b8'};">${converted??'-'}</span>
                                ${showConvert?`<div style="font-size:10px;color:#94a3b8;">(นับ: ${it.balance??'-'} ${it.unit})</div>`:''}
                            </td>
                            <td style="padding:11px;text-align:center;color:#0369a1;font-size:13px;font-weight:600;">${exportUnit}</td>
                            <td style="padding:11px;color:#64748b;font-size:12px;">${it.note||'—'}</td>
                        </tr>`;
                    }).join('');
                    return header+rows;
                }).join('')}
                </tbody>
            </table>
            </div>
            <div style="margin-top:16px;text-align:center;padding-bottom:20px;" class="no-print">
                <button onclick="editBMCSummary()"
                    style="background:#f59e0b;color:white;padding:14px 40px;border:none;border-radius:12px;font-size:16px;font-weight:bold;cursor:pointer;margin-right:10px;">
                    ✏️ แก้ไขยอดนับ
                </button>
                <button onclick="openPDFFormatModal()"
                    style="background:#7c3aed;color:white;padding:14px 30px;border:none;border-radius:12px;font-size:16px;font-weight:bold;cursor:pointer;margin-right:10px;">
                    🖨️ Export PDF
                </button>
                <button onclick="exportBranchMonthlyCountExcel()"
                    style="background:#0891b2;color:white;padding:14px 30px;border:none;border-radius:12px;font-size:16px;font-weight:bold;cursor:pointer;">
                    📥 Export Excel
                </button>
            </div>`;
        };

        // แก้ไข: เปิดใบนับพร้อม prefill ข้อมูลเดิม
        window.editBMCSummary = function() {
            const doc_ = window._bmcCurrentDoc;
            const tmplId = window._bmcCurrentTmplId;
            const zone = window._bmcCurrentZone;
            const tmpl = stockSheetTemplates[tmplId];
            if(!doc_ || !tmpl) { toast('⚠️ ไม่พบข้อมูล','#c2410c'); return; }
            openBranchMonthlyCount(tmplId, tmpl, zone, doc_);
        };

        // ลบเอกสาร (admin only)
        window.deleteBMCSummary = async function() {
            const doc_ = window._bmcCurrentDoc;
            if(!doc_) { toast('⚠️ ไม่พบข้อมูล','#c2410c'); return; }
            if(!confirm(`ยืนยันลบผลการนับสต๊อก ${window._bmcCurrentZone} วันที่ ${doc_.date||''}?\nการลบไม่สามารถกู้คืนได้`)) return;
            try {
                await deleteDoc(doc(db,'inventoryHistory', doc_.id));
                toast('🗑️ ลบเอกสารเรียบร้อย','#64748b');
                goToDashboard();
            } catch(e) { toast('❌ ลบไม่สำเร็จ: '+e.message,'#ef4444'); }
        };

        // ======== MONTHLY COUNT HISTORY VIEW (แยกจาก stockHistory) ========
        window.openMonthlyHistoryView = async function() {
            document.getElementById('dashboardView').classList.add('hidden');
            const c = document.getElementById('toolAppContainer'); c.classList.remove('hidden');
            const visibleZones = getVisibleWarehouses();

            c.innerHTML = `
            <div class="tool-header no-print">
                <h2>📅 ประวัติการนับสต๊อกสิ้นเดือน</h2>
                <div style="display:flex;gap:8px;">
                    <button onclick="exportMonthlyHistoryExcel()" style="background:var(--success);color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:bold;">📥 Export Excel</button>
                    <button onclick="exportMonthlyHistoryPDF()" style="background:#7c3aed;color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:bold;">🖨️ Export PDF</button>
                    <button onclick="goToDashboard()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;">🏠</button>
                    <button onclick="closeTool()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;">✕</button>
                </div>
            </div>
            <div class="filter-bar no-print" style="flex-wrap:wrap;gap:12px;margin-bottom:20px;">
                <div><label style="font-size:11px;font-weight:600;color:#475569;display:block;margin-bottom:4px;">📦 คลัง/สาขา</label>
                    <select id="mhZone" onchange="loadMonthlyHistory()"
                        style="padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:9px;font-size:13px;outline:none;min-width:160px;">
                        <option value="">— ทุกสาขา —</option>
                        ${visibleZones.map(z=>`<option value="${z}">${z}</option>`).join('')}
                    </select></div>
                <div><label style="font-size:11px;font-weight:600;color:#475569;display:block;margin-bottom:4px;">📅 เดือน</label>
                    <input type="month" id="mhMonth" onchange="loadMonthlyHistory()"
                        style="padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-size:13px;outline:none;">
                </div>
                <div style="display:flex;align-items:flex-end;">
                    <button onclick="document.getElementById('mhMonth').value='';document.getElementById('mhZone').value='';loadMonthlyHistory()"
                        style="padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:9px;font-size:13px;background:white;cursor:pointer;">🔄 ล้างตัวกรอง</button>
                </div>
            </div>
            <div id="monthlyHistoryContainer">
                <p style="color:#94a3b8;text-align:center;padding:40px;">กำลังโหลด...</p>
            </div>`;
            await loadMonthlyHistory();
        };

        window._monthlyHistoryData = [];

        window.loadMonthlyHistory = async function() {
            const zone = document.getElementById('mhZone')?.value || '';
            const month = document.getElementById('mhMonth')?.value || '';
            const con = document.getElementById('monthlyHistoryContainer'); if(!con) return;
            con.innerHTML = '<p style="color:#94a3b8;text-align:center;padding:40px;">กำลังโหลด...</p>';
            try {
                const snap = await getDocs(collection(db,'inventoryHistory'));
                let docs = [];
                snap.forEach(d => {
                    const x = d.data();
                    // เฉพาะ monthly branch count — ไม่รวม session count ทั่วไป
                    if(x.type === 'branch' || x.isBranchTemplate) {
                        docs.push({id: d.id, ...x});
                    }
                });
                if(zone) docs = docs.filter(d => d.zone === zone);
                if(month) docs = docs.filter(d => (d.month||'') === month);
                docs.sort((a,b) => (b.month||'').localeCompare(a.month||'') || (a.zone||'').localeCompare(b.zone||''));
                window._monthlyHistoryData = docs;

                if(!docs.length) {
                    con.innerHTML = '<p style="color:#94a3b8;text-align:center;padding:40px;">ไม่พบข้อมูลการนับสต๊อกสิ้นเดือน</p>';
                    return;
                }

                // จัดกลุ่มตามเดือน
                const byMonth = {};
                docs.forEach(d => {
                    const mk = d.month || d.date?.slice(6) || 'unknown';
                    if(!byMonth[mk]) byMonth[mk] = [];
                    byMonth[mk].push(d);
                });

                con.innerHTML = Object.keys(byMonth).sort().reverse().map(mk => {
                    const mDocs = byMonth[mk];
                    // แสดงชื่อเดือนเป็นภาษาไทย
                    let mLabel = mk;
                    if(/^\d{4}-\d{2}$/.test(mk)) {
                        const [y,m] = mk.split('-');
                        const thMonth = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'][parseInt(m)-1] || m;
                        mLabel = `${thMonth} ${parseInt(y)+543}`;
                    }
                    return `
                    <div style="margin-bottom:28px;">
                        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
                            <h3 style="margin:0;color:#1e293b;font-size:16px;">📅 ${mLabel}</h3>
                            <span style="background:#e0f2fe;color:#0369a1;font-size:11px;padding:3px 10px;border-radius:20px;font-weight:600;">${mDocs.length} สาขา</span>
                        </div>
                        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:14px;">
                        ${mDocs.map(d => {
                            const itemCount = (d.items||[]).length;
                            const filledCount = (d.items||[]).filter(it=>(it.balance||0)>0).length;
                            return `
                            <div style="background:white;border-radius:12px;border:1px solid #e2e8f0;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
                                    <div>
                                        <div style="font-weight:700;font-size:14px;color:#1e293b;">🏪 ${d.zone||'—'}</div>
                                        <div style="font-size:11px;color:#64748b;margin-top:2px;">วันที่นับ: ${d.date||'—'} • โดย: ${d.countedBy||'—'}</div>
                                        <div style="font-size:10px;color:#94a3b8;">Template: ${d.templateName||'—'}</div>
                                    </div>
                                    <div style="text-align:right;">
                                        <div style="font-size:18px;font-weight:800;color:#1d4ed8;">${filledCount}</div>
                                        <div style="font-size:10px;color:#64748b;">/ ${itemCount} รายการ</div>
                                    </div>
                                </div>
                                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                                    <button onclick="viewMonthlyDoc('${d.id}')"
                                        style="flex:1;background:#eff6ff;color:#1d4ed8;border:none;padding:6px 10px;border-radius:7px;cursor:pointer;font-size:12px;font-weight:600;">📋 ดูรายละเอียด</button>
                                    <button onclick="exportSingleMonthlyPDF('${d.id}')"
                                        style="background:#f5f3ff;color:#7c3aed;border:none;padding:6px 10px;border-radius:7px;cursor:pointer;font-size:12px;font-weight:600;">🖨️ PDF</button>
                                    <button onclick="exportSingleMonthlyExcel('${d.id}')"
                                        style="background:#f0fdf4;color:#059669;border:none;padding:6px 10px;border-radius:7px;cursor:pointer;font-size:12px;font-weight:600;">📥 Excel</button>
                                </div>
                            </div>`;
                        }).join('')}
                        </div>
                    </div>`;
                }).join('');
            } catch(e) {
                con.innerHTML = `<p style="color:var(--danger);text-align:center;padding:40px;">❌ โหลดข้อมูลไม่สำเร็จ: ${e.message}</p>`;
            }
        };

        window.viewMonthlyDoc = function(docId) {
            const d = window._monthlyHistoryData?.find(x=>x.id===docId);
            if(!d) { toast('⚠️ ไม่พบข้อมูล','#c2410c'); return; }
            const tmpl = Object.values(stockSheetTemplates).find(t=>t.name===d.templateName) ||
                         stockSheetTemplates[d.templateId] || null;
            const tmplId = d.templateId || Object.keys(stockSheetTemplates).find(k=>stockSheetTemplates[k].name===d.templateName) || '';
            window._bmcCurrentDoc = d;
            window._bmcCurrentTmplId = tmplId;
            window._bmcCurrentZone = d.zone;
            openBranchMonthlyDoneSummary(tmplId, tmpl||{name:d.templateName||'',items:d.items||[]}, d.zone, d);
        };

        window.exportSingleMonthlyPDF = function(docId) {
            const d = window._monthlyHistoryData?.find(x=>x.id===docId);
            if(!d) { toast('⚠️ ไม่พบข้อมูล','#c2410c'); return; }
            const tmplId = d.templateId || Object.keys(stockSheetTemplates).find(k=>stockSheetTemplates[k].name===d.templateName) || '';
            window._bmcCurrentDoc = d;
            window._bmcCurrentTmplId = tmplId;
            window._bmcCurrentZone = d.zone;
            openPDFFormatModal();
        };

        window.exportSingleMonthlyExcel = function(docId) {
            const d = window._monthlyHistoryData?.find(x=>x.id===docId);
            if(!d) { toast('⚠️ ไม่พบข้อมูล','#c2410c'); return; }
            window._bmcCurrentDoc = d;
            window._bmcCurrentZone = d.zone;
            exportBranchMonthlyCountExcel();
        };

        window.exportMonthlyHistoryExcel = function() {
            const docs = window._monthlyHistoryData||[];
            if(!docs.length) { toast('⚠️ ไม่มีข้อมูล','#f59e0b'); return; }
            const rows = [['สาขา','เดือน','วันที่นับ','รหัสสินค้า','ชื่อสินค้า','หมวด','ยอดนับ','หน่วย','หมายเหตุ','ผู้นับ','Template']];
            docs.forEach(d => {
                (d.items||[]).forEach(it => {
                    const p = allProducts.find(x=>x.id===it.id);
                    const tmplItem = stockSheetTemplates[d.templateId]?.items?.find(x=>x.id===it.id);
                    const exportUnit = _getExportUnit(it.id, tmplItem);
                    const converted = _convertToExportUnit(it.balance||0, it.unit||'', exportUnit, p);
                    rows.push([d.zone||'',d.month||'',d.date||'',it.id,it.name,it.group||'',
                        converted,exportUnit,it.note||'',d.countedBy||'',d.templateName||'']);
                });
            });
            const ws = XLSX.utils.aoa_to_sheet(rows);
            ws['!cols'] = [{wch:20},{wch:10},{wch:14},{wch:12},{wch:35},{wch:14},{wch:10},{wch:8},{wch:20},{wch:14},{wch:20}];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'นับสต๊อกสิ้นเดือน');
            const zone = document.getElementById('mhZone')?.value||'ทุกสาขา';
            const month = document.getElementById('mhMonth')?.value||'ทุกเดือน';
            XLSX.writeFile(wb, `MonthlyCount_${zone}_${month}.xlsx`);
            toast('📥 Export Excel เรียบร้อย','#059669');
        };

        window.exportMonthlyHistoryPDF = function() {
            const docs = window._monthlyHistoryData||[];
            if(!docs.length) { toast('⚠️ ไม่มีข้อมูล','#f59e0b'); return; }
            const now = new Date();
            const printDate = now.toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'});
            // จัดกลุ่มตามเดือน
            const byMonth = {};
            docs.forEach(d => { const mk = d.month||''; if(!byMonth[mk]) byMonth[mk]=[]; byMonth[mk].push(d); });

            const monthSections = Object.keys(byMonth).sort().reverse().map(mk => {
                let mLabel = mk;
                if(/^\d{4}-\d{2}$/.test(mk)) {
                    const [y,m] = mk.split('-');
                    const thMonth=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'][parseInt(m)-1]||m;
                    mLabel = `${thMonth} ${parseInt(y)+543}`;
                }
                const mDocs = byMonth[mk];
                const tables = mDocs.map(d => {
                    const groups = [...new Set((d.items||[]).map(i=>i.group||'ทั่วไป'))];
                    const tbody = groups.map(grp => {
                        const grpItems = (d.items||[]).filter(i=>(i.group||'ทั่วไป')===grp);
                        const hdr = `<tr><td colspan="5" style="padding:6px 10px;background:#f0f9ff;font-weight:700;font-size:10px;color:#0369a1;border-top:2px solid #bae6fd;">▌ ${grp.toUpperCase()}</td></tr>`;
                        const rows = grpItems.map((it,idx) => {
                            const p = allProducts.find(x=>x.id===it.id);
                            const tmplItem = stockSheetTemplates[d.templateId]?.items?.find(x=>x.id===it.id);
                            const exportUnit = _getExportUnit(it.id, tmplItem);
                            const converted = _convertToExportUnit(it.balance||0, it.unit||'', exportUnit, p);
                            return `<tr style="${idx%2===1?'background:#f8fafc':''}">
                                <td style="padding:7px 10px;font-weight:600;font-size:11px;">${it.id}</td>
                                <td style="padding:7px 10px;font-size:11px;">${it.name}</td>
                                <td style="padding:7px;text-align:center;font-weight:700;font-size:13px;color:#1d4ed8;">${converted||'—'}</td>
                                <td style="padding:7px;text-align:center;font-size:11px;">${exportUnit}</td>
                                <td style="padding:7px;font-size:10px;color:#64748b;">${it.note||''}</td>
                            </tr>`;
                        }).join('');
                        return hdr+rows;
                    }).join('');
                    return `
                    <div style="page-break-inside:avoid;margin-bottom:18px;">
                        <div style="background:#1e293b;color:white;padding:8px 14px;border-radius:8px 8px 0 0;font-size:12px;font-weight:700;">
                            🏪 ${d.zone} &nbsp;|&nbsp; วันที่นับ: ${d.date||'—'} &nbsp;|&nbsp; โดย: ${d.countedBy||'—'}
                        </div>
                        <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;">
                            <thead><tr style="background:#f8fafc;">
                                <th style="padding:7px 10px;text-align:left;font-size:10px;color:#64748b;width:100px;">รหัส</th>
                                <th style="padding:7px 10px;text-align:left;font-size:10px;color:#64748b;">ชื่อสินค้า</th>
                                <th style="padding:7px;text-align:center;font-size:10px;color:#1d4ed8;width:80px;">ยอดนับ</th>
                                <th style="padding:7px;text-align:center;font-size:10px;color:#64748b;width:60px;">หน่วย</th>
                                <th style="padding:7px;text-align:left;font-size:10px;color:#64748b;width:120px;">หมายเหตุ</th>
                            </tr></thead>
                            <tbody>${tbody}</tbody>
                        </table>
                    </div>`;
                }).join('');
                return `<div style="page-break-before:auto;margin-bottom:30px;">
                    <h2 style="margin:0 0 12px;color:#1e293b;font-size:16px;border-bottom:2px solid #1d4ed8;padding-bottom:8px;">📅 ${mLabel}</h2>
                    ${tables}
                </div>`;
            }).join('');

            const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
            <style>
                @page{size:A4;margin:12mm}
                body{font-family:'Sarabun',sans-serif;margin:0;color:#1e293b;}
                table{width:100%;border-collapse:collapse;}
                @media print{.no-print{display:none}}
            </style>
            <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap" rel="stylesheet">
            </head><body>
            <div style="margin-bottom:20px;">
                <h1 style="margin:0 0 4px;font-size:18px;">รายงานนับสต๊อกสิ้นเดือน</h1>
                <div style="font-size:11px;color:#64748b;">พิมพ์โดย: ${currentUser?.name||''} | วันที่พิมพ์: ${printDate}</div>
            </div>
            ${monthSections}
            </body></html>`;
            const w = window.open('','_blank','width=900,height=700');
            w.document.write(html); w.document.close();
            setTimeout(()=>w.print(),800);
        };

        // ======== EXPORT UNIT CONVERSION HELPER ========
        // แปลง amount จาก fromUnit → toUnit โดยใช้ข้อมูล units ของสินค้า
        // ลำดับความสำคัญ exportUnit: template item > product.exportUnit > units[0]
        window._getExportUnit = function(productId, tmplItem) {
            const p = allProducts.find(x=>x.id===productId);
            return tmplItem?.exportUnit || p?.exportUnit || (p?.units||[{name:p?.unit||''}])[0]?.name || '';
        };

        window._convertToExportUnit = function(amount, fromUnit, toUnit, product) {
            if(!amount || amount === 0) return 0;
            if(!fromUnit || !toUnit || fromUnit === toUnit) return Math.round(amount*1000)/1000;
            const units = product?.units || [];
            if(!units.length) return Math.round(amount*1000)/1000;
            const fromIdx = units.findIndex(u=>u.name===fromUnit);
            const toIdx = units.findIndex(u=>u.name===toUnit);
            if(fromIdx < 0 || toIdx < 0) return Math.round(amount*1000)/1000;
            let v = amount;
            if(toIdx > fromIdx) {
                // จาก unit ใหญ่ → unit เล็ก: คูณ rate
                for(let i=fromIdx; i<toIdx; i++) v *= (units[i]?.rate||1);
            } else {
                // จาก unit เล็ก → unit ใหญ่: หาร rate
                for(let i=toIdx; i<fromIdx; i++) v /= (units[i]?.rate||1);
            }
            return Math.round(v*1000)/1000;
        };

        // ======== PARENT WAREHOUSE AGGREGATED EXPORT ========
        window.openParentWhExportModal = function() {
            const wg = window.warehouseGroups || {};
            const groups = Object.entries(wg)
                .filter(([k])=>k!=='_whnames')
                .map(([pid, val]) => [pid, Array.isArray(val) ? val : []]);  // normalize
            if(!groups.length) {
                toast('⚠️ ยังไม่มีคลังหลัก — ตั้งค่าที่ ⚙️ ตั้งค่าคลังและสินค้าหลัก','#f59e0b');
                return;
            }
            const existing = document.getElementById('parentWhExportModal'); if(existing) existing.remove();
            const now = new Date();
            const m = document.createElement('div');
            m.className='modal-overlay'; m.id='parentWhExportModal';
            m.innerHTML=`<div class="modal-box" style="max-width:520px;width:95vw;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                    <h3 style="margin:0;">🏭 Export รวมยอดคลังหลัก</h3>
                    <button onclick="document.getElementById('parentWhExportModal').remove()" style="background:#f1f5f9;border:none;padding:6px 12px;border-radius:8px;cursor:pointer;font-size:16px;">✕</button>
                </div>
                <p style="font-size:13px;color:#64748b;margin:0 0 16px;">สินค้าชื่อเดียวกันจาก Zone ย่อยในคลังเดียวกันจะถูก<b>รวมยอด</b> และ convert เป็นหน่วย Export ที่ตั้งไว้</p>

                <div style="margin-bottom:14px;">
                    <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:8px;">🏭 เลือกคลังหลัก</label>
                    <div style="display:flex;flex-direction:column;gap:6px;max-height:200px;overflow-y:auto;padding:4px;">
                        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;padding:6px 0;">
                            <input type="checkbox" id="pwex_all" checked onchange="document.querySelectorAll('.pwex_cb').forEach(cb=>cb.checked=this.checked)" style="width:16px;height:16px;accent-color:#ea580c;">
                            <b style="color:#ea580c;">ทุกคลังหลัก</b>
                        </label>
                        ${groups.map(([pid,zones])=>`
                        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;padding:6px 10px;border:1px solid #e2e8f0;border-radius:8px;background:#fafafa;">
                            <input type="checkbox" class="pwex_cb" value="${pid}" checked style="width:15px;height:15px;accent-color:#ea580c;">
                            <div>
                                <b style="color:#1e293b;">${pid}</b>
                                <span style="color:#94a3b8;font-size:11px;margin-left:6px;">${(zones||[]).join(', ')||'ยังไม่มี Zone'}</span>
                            </div>
                        </label>`).join('')}
                    </div>
                </div>

                <div style="margin-bottom:14px;">
                    <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:6px;">📊 รูปแบบ Export</label>
                    <div style="display:flex;gap:8px;">
                        <label style="flex:1;display:flex;align-items:center;gap:6px;padding:10px;border:1.5px solid #e2e8f0;border-radius:8px;cursor:pointer;font-size:13px;">
                            <input type="radio" name="pwex_fmt" value="combined" checked style="accent-color:#ea580c;"> ทุกคลังใน Sheet เดียว
                        </label>
                        <label style="flex:1;display:flex;align-items:center;gap:6px;padding:10px;border:1.5px solid #e2e8f0;border-radius:8px;cursor:pointer;font-size:13px;">
                            <input type="radio" name="pwex_fmt" value="sheets" style="accent-color:#ea580c;"> แยก Sheet ต่อคลังหลัก
                        </label>
                    </div>
                </div>

                <div style="margin-bottom:14px;">
                    <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:6px;">📋 ข้อมูลที่ต้องการ</label>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;">
                        <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;">
                            <input type="checkbox" id="pwex_showZone" checked style="accent-color:#ea580c;"> แสดง Zone ย่อยแยก
                        </label>
                        <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;">
                            <input type="checkbox" id="pwex_sumOnly" style="accent-color:#ea580c;"> เฉพาะยอดรวม (ไม่แสดง Zone ย่อย)
                        </label>
                    </div>
                </div>

                <div style="margin-top:18px;display:flex;gap:8px;">
                    <button onclick="document.getElementById('parentWhExportModal').remove()"
                        style="flex:1;background:#f1f5f9;color:#475569;border:none;padding:11px;border-radius:10px;cursor:pointer;font-weight:600;">ยกเลิก</button>
                    <button onclick="doParentWhExcel()"
                        style="flex:1;background:#ea580c;color:white;border:none;padding:11px;border-radius:10px;cursor:pointer;font-weight:700;">📥 Export Excel</button>
                    <button onclick="doParentWhPDF()"
                        style="flex:1;background:#7c3aed;color:white;border:none;padding:11px;border-radius:10px;cursor:pointer;font-weight:700;">🖨️ Export PDF</button>
                </div>
            </div>`;
            document.body.appendChild(m);
        };

        // รวมยอดสินค้าจาก zones ย่อย → object { productId: { name, unit, totalInExportUnit, byZone:{zone: amount} } }
        window._aggregateZones = function(zones) {
            const safeZones = Array.isArray(zones) ? zones : [];
            const result = {};
            safeZones.forEach(zone => {
                const prods = getZoneProducts(zone);
                prods.forEach(p => {
                    const cd = countData[p.id] || {total:0};
                    const rawAmount = cd.total || 0;
                    const rawUnit = (p.units||[{name:p.unit||''}])[0]?.name||'';
                    const exportUnit = _getExportUnit(p.id, null);
                    const converted = _convertToExportUnit(rawAmount, rawUnit, exportUnit, p);
                    if(!result[p.id]) result[p.id] = {name:p.name, exportUnit, total:0, byZone:{}, category:p.category||''};
                    result[p.id].total += converted;
                    result[p.id].total = Math.round(result[p.id].total*1000)/1000;
                    result[p.id].byZone[zone] = (result[p.id].byZone[zone]||0) + converted;
                    result[p.id].byZone[zone] = Math.round(result[p.id].byZone[zone]*1000)/1000;
                });
            });
            return result;
        };

        window.doParentWhExcel = async function() {
            await loadCountData();
            const selectedPids = [...document.querySelectorAll('.pwex_cb:checked')].map(cb=>cb.value);
            if(!selectedPids.length) { toast('⚠️ เลือกคลังหลักก่อน','#f59e0b'); return; }
            const fmt = document.querySelector('input[name="pwex_fmt"]:checked')?.value||'combined';
            const showZone = document.getElementById('pwex_showZone')?.checked;
            const sumOnly = document.getElementById('pwex_sumOnly')?.checked;
            document.getElementById('parentWhExportModal')?.remove();

            const wb = XLSX.utils.book_new();
            const dateStr = new Date().toLocaleDateString('th-TH').replace(/\//g,'-');

            if(fmt === 'sheets') {
                // แยก Sheet ต่อคลังหลัก
                selectedPids.forEach(pid => {
                    const _rawZ = (window.warehouseGroups||{})[pid]; const zones = Array.isArray(_rawZ) ? _rawZ : [];
                    const agg = _aggregateZones(zones);
                    const sheetData = _buildParentWhSheet(pid, zones, agg, showZone && !sumOnly);
                    const ws = XLSX.utils.aoa_to_sheet(sheetData);
                    _styleParentWhSheet(ws, sheetData);
                    XLSX.utils.book_append_sheet(wb, ws, pid.slice(0,31));
                });
            } else {
                // ทุกคลังใน Sheet เดียว
                let allRows = [['คลังหลัก','Zone','รหัส','ชื่อสินค้า','หมวด','ยอดรวม','หน่วย']];
                selectedPids.forEach(pid => {
                    const _rawZ = (window.warehouseGroups||{})[pid]; const zones = Array.isArray(_rawZ) ? _rawZ : [];
                    const agg = _aggregateZones(zones);
                    // ยอดรวม
                    Object.entries(agg).forEach(([prodId, d]) => {
                        if(!sumOnly && showZone) {
                            zones.forEach(z => {
                                if(d.byZone[z]) allRows.push([pid, z, prodId, d.name, d.category, d.byZone[z], d.exportUnit]);
                            });
                            allRows.push([pid, '📊 รวม', prodId, d.name, d.category, d.total, d.exportUnit]);
                        } else {
                            allRows.push([pid, '—', prodId, d.name, d.category, d.total, d.exportUnit]);
                        }
                    });
                    allRows.push([]); // spacer
                });
                const ws = XLSX.utils.aoa_to_sheet(allRows);
                ws['!cols'] = [{wch:14},{wch:18},{wch:12},{wch:30},{wch:14},{wch:10},{wch:8}];
                XLSX.utils.book_append_sheet(wb, ws, 'รวมทุกคลัง');
            }

            XLSX.writeFile(wb, `ParentWH_Export_${dateStr}.xlsx`);
            toast('📥 Export คลังหลักเรียบร้อย','#ea580c');
        };

        window._buildParentWhSheet = function(pid, zones, agg, showZoneBreakdown) {
            const displayName = (window.warehouseGroups?._whnames||{})[pid] || pid;
            const dateStr = new Date().toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'});
            const rows = [
                [`รายงานยอดสต๊อกคลังหลัก: ${pid} ${displayName?'('+displayName+')':''}`],
                [`Zones: ${zones.join(', ')} | พิมพ์: ${dateStr}`],
                []
            ];
            if(showZoneBreakdown) {
                rows.push(['รหัส','ชื่อสินค้า','หมวด',...zones,'📊 รวม','หน่วย']);
                Object.entries(agg).forEach(([prodId, d]) => {
                    rows.push([prodId, d.name, d.category, ...zones.map(z=>d.byZone[z]||0), d.total, d.exportUnit]);
                });
                // summary row
                rows.push([]);
                const totRow = ['','','ยอดรวมทั้งหมด'];
                // per-zone totals
                zones.forEach(z => {
                    const t = Object.values(agg).reduce((s,d)=>s+(d.byZone[z]||0),0);
                    totRow.push(Math.round(t*1000)/1000);
                });
                totRow.push(Object.values(agg).reduce((s,d)=>s+d.total,0));
                totRow.push('');
                rows.push(totRow);
            } else {
                rows.push(['รหัส','ชื่อสินค้า','หมวด','ยอดรวม','หน่วย']);
                Object.entries(agg).forEach(([prodId, d]) => {
                    rows.push([prodId, d.name, d.category, d.total, d.exportUnit]);
                });
            }
            return rows;
        };

        window._styleParentWhSheet = function(ws, rows) {
            // column widths ต่างกันตามจำนวน columns
            const cols = rows[3]?.length || 5;
            ws['!cols'] = Array.from({length:cols}, (_,i) => ({wch: i===1?30:i===2?14:12}));
        };

        window.doParentWhPDF = async function() {
            await loadCountData();
            const selectedPids = [...document.querySelectorAll('.pwex_cb:checked')].map(cb=>cb.value);
            if(!selectedPids.length) { toast('⚠️ เลือกคลังหลักก่อน','#f59e0b'); return; }
            const showZone = document.getElementById('pwex_showZone')?.checked;
            const sumOnly = document.getElementById('pwex_sumOnly')?.checked;
            document.getElementById('parentWhExportModal')?.remove();

            const now = new Date();
            const printDate = now.toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'});

            const sections = selectedPids.map(pid => {
                const _rawZ = (window.warehouseGroups||{})[pid]; const zones = Array.isArray(_rawZ) ? _rawZ : [];
                const displayName = (window.warehouseGroups?._whnames||{})[pid]||'';
                const agg = _aggregateZones(zones);
                const entries = Object.entries(agg);
                // จัดกลุ่มตาม category
                const cats = [...new Set(entries.map(([,d])=>d.category||'ทั่วไป'))];

                const tableBody = cats.map(cat => {
                    const catItems = entries.filter(([,d])=>(d.category||'ทั่วไป')===cat);
                    const hdr = `<tr><td colspan="${showZone&&!sumOnly?zones.length+4:4}" style="padding:7px 12px;background:#fff7ed;font-weight:700;font-size:10px;color:#c2410c;border-top:2px solid #fed7aa;">▌ ${cat.toUpperCase()}</td></tr>`;
                    const itemRows = catItems.map(([prodId, d], idx) => {
                        const zoneCols = (showZone&&!sumOnly) ? zones.map(z=>`<td style="padding:7px;text-align:center;font-size:11px;color:#475569;border-bottom:1px solid #f1f5f9;">${d.byZone[z]||'—'}</td>`).join('') : '';
                        return `<tr style="${idx%2===1?'background:#fafafa':''}">
                            <td style="padding:8px 12px;font-weight:600;font-size:11px;border-bottom:1px solid #f1f5f9;">${prodId}</td>
                            <td style="padding:8px 12px;font-size:11px;border-bottom:1px solid #f1f5f9;">${d.name}</td>
                            ${zoneCols}
                            <td style="padding:8px;text-align:center;font-weight:800;font-size:15px;color:#ea580c;border-bottom:1px solid #f1f5f9;">${d.total}</td>
                            <td style="padding:8px;text-align:center;font-size:11px;color:#64748b;border-bottom:1px solid #f1f5f9;">${d.exportUnit}</td>
                        </tr>`;
                    }).join('');
                    return hdr+itemRows;
                }).join('');

                const zoneHeaders = (showZone&&!sumOnly) ? zones.map(z=>`<th style="padding:8px;text-align:center;font-size:10px;background:#c2410c;">${z}</th>`).join('') : '';

                return `
                <div style="page-break-inside:avoid;margin-bottom:28px;">
                    <div style="background:#ea580c;color:white;padding:10px 16px;border-radius:8px 8px 0 0;display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <span style="font-size:16px;font-weight:800;">🏭 ${pid}</span>
                            ${displayName?`<span style="font-size:12px;opacity:.85;margin-left:8px;">${displayName}</span>`:''}
                        </div>
                        <span style="font-size:11px;opacity:.8;">Zones: ${zones.join(' · ')}</span>
                    </div>
                    <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;">
                        <thead><tr style="background:#1e293b;color:white;">
                            <th style="padding:9px 12px;text-align:left;font-size:10px;width:90px;">รหัส</th>
                            <th style="padding:9px 12px;text-align:left;font-size:10px;">ชื่อสินค้า</th>
                            ${zoneHeaders}
                            <th style="padding:9px;text-align:center;font-size:10px;background:#ea580c;width:70px;">ยอดรวม</th>
                            <th style="padding:9px;text-align:center;font-size:10px;width:55px;">หน่วย</th>
                        </tr></thead>
                        <tbody>${tableBody}</tbody>
                    </table>
                </div>`;
            }).join('');

            const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
            <style>
                @page{size:A4 landscape;margin:12mm}
                body{font-family:'Sarabun',sans-serif;margin:0;color:#1e293b;}
                table{width:100%;border-collapse:collapse;}
                @media print{body{padding:0}}
            </style>
            <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap" rel="stylesheet">
            </head><body>
            <div style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-end;">
                <div>
                    <h1 style="margin:0 0 3px;font-size:18px;">รายงานยอดสต๊อกรวมตามคลังหลัก</h1>
                    <div style="font-size:11px;color:#64748b;">พิมพ์โดย: ${currentUser?.name||''} | ${printDate}</div>
                </div>
            </div>
            ${sections}
            </body></html>`;

            const w = window.open('','_blank','width=1000,height=700');
            w.document.write(html); w.document.close();
            setTimeout(()=>w.print(),700);
        };
        window.exportBranchMonthlyCountExcel = function() {
            const d = window._bmcCurrentDoc;
            if(!d){ toast('⚠️ ไม่พบข้อมูล','#c2410c'); return; }
            try {
                const tmpl = stockSheetTemplates[d.templateId] || {};
                const wb = XLSX.utils.book_new();
                const header = ['รหัสสินค้า','ชื่อสินค้า','หมวด','ยอดนับ','หน่วย (export)','หน่วยเดิม','หมายเหตุ'];
                const rows = [header, ...(d.items||[]).map(it=>{
                    const p = allProducts.find(x=>x.id===it.id);
                    const tmplItem = (tmpl.items||[]).find(x=>x.id===it.id);
                    const exportUnit = _getExportUnit(it.id, tmplItem);
                    const converted = _convertToExportUnit(it.balance||0, it.unit||'', exportUnit, p);
                    return [it.id, it.name, it.group||'', converted, exportUnit, it.unit||'', it.note||''];
                })];
                const ws = XLSX.utils.aoa_to_sheet(rows);
                ws['!cols'] = [{wch:12},{wch:30},{wch:14},{wch:10},{wch:12},{wch:10},{wch:20}];
                ['A1','B1','C1','D1','E1','F1','G1'].forEach(ref=>{
                    if(ws[ref]) ws[ref].s = {font:{bold:true},alignment:{horizontal:'center'}};
                });
                // เพิ่ม meta rows ด้านบน
                XLSX.utils.sheet_add_aoa(ws, [
                    [`รายงานนับสต๊อกสิ้นเดือน — ${d.zone||''}`],
                    [`เดือน: ${d.month||''}   วันที่นับ: ${d.date||''}   ผู้นับ: ${d.countedBy||''}   Template: ${d.templateName||''}`],
                    []
                ], {origin:'A1'});
                // เลื่อน header ลงมา
                const headerRows = [header, ...(d.items||[]).map(it=>{
                    const p=allProducts.find(x=>x.id===it.id);
                    const tmplItem=(tmpl.items||[]).find(x=>x.id===it.id);
                    const exportUnit=tmplItem?.exportUnit||it.unit||'';
                    const converted=_convertToExportUnit(it.balance||0,it.unit||'',exportUnit,p);
                    return [it.id,it.name,it.group||'',converted,exportUnit,it.unit||'',it.note||''];
                })];
                const ws2 = XLSX.utils.aoa_to_sheet([
                    [`รายงานนับสต๊อกสิ้นเดือน — ${d.zone||''}`],
                    [`เดือน: ${d.month||''}   |   วันที่นับ: ${d.date||''}   |   ผู้นับ: ${d.countedBy||''}   |   Template: ${d.templateName||''}`],
                    [],
                    ...headerRows
                ]);
                ws2['!cols'] = [{wch:12},{wch:30},{wch:14},{wch:10},{wch:12},{wch:10},{wch:20}];
                XLSX.utils.book_append_sheet(wb, ws2, (d.zone||'สาขา').slice(0,31));
                const zone = (d.zone||'สาขา').replace(/[:\/?*[\]]/g,'_');
                XLSX.writeFile(wb, 'stock_' + zone + '_' + (d.month||'') + '.xlsx');
                toast('📥 Export Excel เรียบร้อย','#0891b2');
            } catch(e){ toast('❌ Export ไม่สำเร็จ: '+e.message,'#ef4444'); }
        };

        // Export PDF — ยอดนับสิ้นเดือนสาขา (จาก _bmcCurrentDoc)
        // Modal เลือกรูปแบบ PDF
        window.openPDFFormatModal = function() {
            const ex = document.getElementById('pdfFmtModal'); if(ex) ex.remove();
            const m = document.createElement('div');
            m.className = 'modal-overlay'; m.id = 'pdfFmtModal';
            m.innerHTML = `<div class="modal-box" style="max-width:440px;width:95vw;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                    <h3 style="margin:0;">🖨️ เลือกรูปแบบ PDF</h3>
                    <button onclick="document.getElementById('pdfFmtModal').remove()"
                        style="background:#f1f5f9;border:none;padding:6px 12px;border-radius:8px;cursor:pointer;font-size:16px;">✕</button>
                </div>
                <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px;">
                    <label id="pdfFmt1" onclick="selectPdfFmt('standard')"
                        style="display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border:2px solid #7c3aed;border-radius:12px;cursor:pointer;background:#f5f3ff;">
                        <input type="radio" name="pdfFmt" value="standard" checked style="margin-top:3px;width:16px;height:16px;accent-color:#7c3aed;">
                        <div>
                            <div style="font-weight:700;font-size:14px;color:#5b21b6;">📋 รูปแบบปกติ</div>
                            <div style="font-size:12px;color:#64748b;margin-top:3px;">Header ใหญ่ แบ่งกลุ่มสินค้า มีส่วนเซ็นชื่อ เหมาะสำหรับเก็บเอกสาร</div>
                        </div>
                    </label>
                    <label id="pdfFmt2" onclick="selectPdfFmt('compact')"
                        style="display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border:2px solid #e2e8f0;border-radius:12px;cursor:pointer;background:white;">
                        <input type="radio" name="pdfFmt" value="compact" style="margin-top:3px;width:16px;height:16px;accent-color:#7c3aed;">
                        <div>
                            <div style="font-weight:700;font-size:14px;color:#1e293b;">⚡ รวมแผ่นเดียว (หน้าร้าน)</div>
                            <div style="font-size:12px;color:#64748b;margin-top:3px;">ตารางแน่น font เล็กลง ไม่มีส่วนเซ็นชื่อ พอดี A4 ใบเดียว</div>
                        </div>
                    </label>
                </div>
                <div style="display:flex;gap:8px;">
                    <button onclick="document.getElementById('pdfFmtModal').remove()"
                        style="flex:1;background:#f1f5f9;color:#475569;border:none;padding:11px;border-radius:10px;cursor:pointer;font-weight:600;">ยกเลิก</button>
                    <button onclick="confirmPdfExport()"
                        style="flex:2;background:#7c3aed;color:white;border:none;padding:11px;border-radius:10px;cursor:pointer;font-weight:700;font-size:14px;">🖨️ Export PDF</button>
                </div>
            </div>`;
            document.body.appendChild(m);
        };

        window.selectPdfFmt = function(val) {
            document.querySelectorAll('input[name="pdfFmt"]').forEach(r => r.checked = r.value === val);
            document.getElementById('pdfFmt1').style.borderColor = val==='standard' ? '#7c3aed' : '#e2e8f0';
            document.getElementById('pdfFmt1').style.background  = val==='standard' ? '#f5f3ff' : 'white';
            document.getElementById('pdfFmt2').style.borderColor = val==='compact'  ? '#7c3aed' : '#e2e8f0';
            document.getElementById('pdfFmt2').style.background  = val==='compact'  ? '#f5f3ff' : 'white';
        };

        window.confirmPdfExport = function() {
            const fmt = document.querySelector('input[name="pdfFmt"]:checked')?.value || 'standard';
            document.getElementById('pdfFmtModal').remove();
            if(fmt === 'compact') exportBranchMonthlyCountPDFCompact();
            else exportBranchMonthlyCountPDF();
        };

        // PDF แบบกระชับ — พอดีหน้าเดียว A4 (2 คอลัมน์)
        window.exportBranchMonthlyCountPDFCompact = function() {
            const d = window._bmcCurrentDoc;
            const zone = window._bmcCurrentZone;
            const tmplId = window._bmcCurrentTmplId;
            const tmpl = stockSheetTemplates[tmplId] || {};
            if(!d){ toast('⚠️ ไม่พบข้อมูล','#c2410c'); return; }

            const printDate = new Date().toLocaleDateString('th-TH',{year:'numeric',month:'short',day:'numeric'});
            const items = d.items || [];
            const totalItems = items.length;

            // ปรับ font ตามจำนวน — 2 คอลัมน์บน A4 landscape รับได้ ~120 rows/col
            const fs = totalItems <= 60 ? 10 : totalItems <= 100 ? 9 : totalItems <= 150 ? 8 : 7;
            const pd = fs >= 9 ? '4px 6px' : '3px 5px';

            // สร้าง row HTML สำหรับแต่ละสินค้า
            const allRows = [];
            const groups = [...new Set(items.map(i=>i.group||'ทั่วไป'))];
            groups.forEach(grp => {
                const grpItems = items.filter(i=>(i.group||'ทั่วไป')===grp);
                allRows.push({ isHeader: true, grp });
                grpItems.forEach(it => {
                    const p = allProducts.find(x=>x.id===it.id);
                    const tmplItem = (tmpl.items||[]).find(x=>x.id===it.id);
                    const exportUnit = _getExportUnit(it.id, tmplItem);
                    const converted = _convertToExportUnit(it.balance||0, it.unit||'', exportUnit, p);
                    const showConvert = exportUnit !== it.unit && it.unit;
                    allRows.push({ isHeader: false, it, converted, exportUnit, showConvert });
                });
            });

            // แบ่งเป็น 2 คอลัมน์
            const half = Math.ceil(allRows.length / 2);
            const col1 = allRows.slice(0, half);
            const col2 = allRows.slice(half);

            const renderRows = (rows) => rows.map((r, idx) => {
                if(r.isHeader) return `
                    <tr><td colspan="3" style="padding:3px 6px;background:#1e293b;color:white;font-weight:700;font-size:${fs-1}px;">
                        ▌ ${r.grp.toUpperCase()}
                    </td></tr>`;
                const bg = idx%2===1 ? 'background:#f8fafc;' : '';
                return `<tr style="${bg}">
                    <td style="padding:${pd};font-size:${fs}px;border-bottom:1px solid #f1f5f9;color:#334155;white-space:nowrap;">${r.it.id}</td>
                    <td style="padding:${pd};font-size:${fs}px;border-bottom:1px solid #f1f5f9;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.it.name}</td>
                    <td style="padding:${pd};text-align:center;font-weight:800;font-size:${fs+1}px;color:#1d4ed8;border-bottom:1px solid #f1f5f9;white-space:nowrap;">
                        ${r.converted||'—'} <span style="font-size:${fs-1}px;font-weight:400;color:#64748b;">${r.exportUnit}</span>
                        ${r.showConvert ? `<br><span style="font-size:${fs-2}px;color:#cbd5e1;">${r.it.balance} ${r.it.unit}</span>` : ''}
                    </td>
                </tr>`;
            }).join('');

            const tableStyle = `width:100%;border-collapse:collapse;table-layout:fixed;`;
            const thStyle = (w) => `padding:5px 6px;text-align:left;font-size:${fs}px;background:#1e293b;color:white;${w?`width:${w};`:''}`;

            const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
            <style>
                @page { size:A4 landscape; margin:6mm; }
                body { font-family:'Sarabun',sans-serif; margin:0; color:#1e293b; }
                * { box-sizing:border-box; }
            </style>
            <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap" rel="stylesheet">
            </head><body>
            <!-- Header บาง -->
            <div style="background:#1e293b;color:white;padding:6px 10px;border-radius:5px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <b style="font-size:13px;">รายงานนับสต๊อกสิ้นเดือน</b>
                    <span style="font-size:11px;opacity:.8;margin-left:8px;">📦 ${zone}</span>
                </div>
                <div style="font-size:9px;opacity:.8;text-align:right;line-height:1.5;">
                    วันที่นับ: ${d.date||d.month||'—'} &nbsp;|&nbsp; ผู้นับ: ${d.countedBy||'—'} &nbsp;|&nbsp; Template: ${d.templateName||'—'} &nbsp;|&nbsp; พิมพ์: ${printDate} &nbsp;|&nbsp; ${totalItems} รายการ
                </div>
            </div>
            <!-- 2-column layout -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
                <div>
                    <table style="${tableStyle}">
                        <thead><tr>
                            <th style="${thStyle('85px')}">รหัส</th>
                            <th style="${thStyle('')}">ชื่อสินค้า</th>
                            <th style="${thStyle('80px')};text-align:center;background:#1d4ed8;">ยอดนับ</th>
                        </tr></thead>
                        <tbody>${renderRows(col1)}</tbody>
                    </table>
                </div>
                <div>
                    <table style="${tableStyle}">
                        <thead><tr>
                            <th style="${thStyle('85px')}">รหัส</th>
                            <th style="${thStyle('')}">ชื่อสินค้า</th>
                            <th style="${thStyle('80px')};text-align:center;background:#1d4ed8;">ยอดนับ</th>
                        </tr></thead>
                        <tbody>${renderRows(col2)}</tbody>
                    </table>
                </div>
            </div>
            </body></html>`;

            const w = window.open('','_blank','width=1100,height=750');
            w.document.write(html); w.document.close();
            setTimeout(()=>w.print(), 700);
        };

        window.exportBranchMonthlyCountPDF = function() {
            const d = window._bmcCurrentDoc;
            const zone = window._bmcCurrentZone;
            const tmplId = window._bmcCurrentTmplId;
            const tmpl = stockSheetTemplates[tmplId] || {};
            if(!d){ toast('⚠️ ไม่พบข้อมูล','#c2410c'); return; }

            const now = new Date();
            const printDate = now.toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'});
            const groups = [...new Set((d.items||[]).map(i=>i.group||'ทั่วไป'))];

            const tableBody = groups.map(grp => {
                const grpItems = (d.items||[]).filter(i=>(i.group||'ทั่วไป')===grp);
                const hdr = `<tr><td colspan="5" style="padding:7px 12px;background:#f0f9ff;font-weight:700;font-size:10px;color:#0369a1;border-top:2px solid #bae6fd;">▌ ${grp.toUpperCase()}</td></tr>`;
                const rows = grpItems.map((it,idx) => {
                    const p = allProducts.find(x=>x.id===it.id);
                    const tmplItem = (tmpl.items||[]).find(x=>x.id===it.id);
                    const exportUnit = _getExportUnit(it.id, tmplItem);
                    const converted = _convertToExportUnit(it.balance||0, it.unit||'', exportUnit, p);
                    const showConvert = exportUnit !== it.unit && it.unit;
                    return `<tr style="${idx%2===1?'background:#f8fafc':''}">
                        <td style="padding:8px 12px;font-weight:600;font-size:11px;border-bottom:1px solid #e2e8f0;">${it.id}</td>
                        <td style="padding:8px 12px;font-size:11px;border-bottom:1px solid #e2e8f0;">${it.name}</td>
                        <td style="padding:8px;text-align:center;font-weight:800;font-size:15px;color:#1d4ed8;border-bottom:1px solid #e2e8f0;">${converted||'—'}</td>
                        <td style="padding:8px;text-align:center;font-size:11px;border-bottom:1px solid #e2e8f0;">${exportUnit}${showConvert?`<br><span style="color:#94a3b8;font-size:9px;">(จาก ${it.unit})</span>`:''}</td>
                        <td style="padding:8px;font-size:10px;color:#64748b;border-bottom:1px solid #e2e8f0;">${it.note||''}</td>
                    </tr>`;
                }).join('');
                return hdr+rows;
            }).join('');

            const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
            <style>
                @page{size:A4;margin:14mm}
                body{font-family:'Sarabun',sans-serif;margin:0;color:#1e293b;font-size:12px;}
                .header-box{border:2px solid #1e293b;border-radius:8px;padding:14px 18px;margin-bottom:14px;}
                table{width:100%;border-collapse:collapse;margin-top:8px;}
                thead tr{background:#1e293b;color:white;}
                th{padding:9px 12px;text-align:left;font-size:11px;}
                .footer{margin-top:28px;display:grid;grid-template-columns:1fr 1fr;gap:40px;}
                .sign{border-top:1px solid #334155;text-align:center;font-size:11px;color:#64748b;padding:40px 0 6px;}
            </style>
            <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap" rel="stylesheet">
            </head><body>
            <div class="header-box">
                <div style="font-size:18px;font-weight:bold;text-align:center;margin-bottom:10px;">รายงานนับสต๊อกสิ้นเดือน</div>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
                    <div style="border:1px solid #94a3b8;border-radius:4px;padding:6px 10px;">
                        <div style="font-size:9px;color:#64748b;font-weight:bold;">สาขา</div>
                        <div style="font-size:13px;font-weight:bold;">${zone}</div>
                    </div>
                    <div style="border:1px solid #94a3b8;border-radius:4px;padding:6px 10px;">
                        <div style="font-size:9px;color:#64748b;font-weight:bold;">เดือน / วันที่นับ</div>
                        <div style="font-size:12px;font-weight:bold;">${d.date||d.month||'—'}</div>
                    </div>
                    <div style="border:1px solid #94a3b8;border-radius:4px;padding:6px 10px;">
                        <div style="font-size:9px;color:#64748b;font-weight:bold;">ผู้นับ / Template</div>
                        <div style="font-size:12px;font-weight:bold;">${d.countedBy||'—'} / ${d.templateName||'—'}</div>
                    </div>
                </div>
            </div>
            <table>
                <thead><tr>
                    <th style="width:100px;">รหัสสินค้า</th>
                    <th>ชื่อสินค้า</th>
                    <th style="width:80px;text-align:center;background:#1d4ed8;">ยอดนับ</th>
                    <th style="width:80px;text-align:center;">หน่วย</th>
                    <th style="width:130px;">หมายเหตุ</th>
                </tr></thead>
                <tbody>${tableBody}</tbody>
            </table>
            <div style="margin-top:10px;font-size:10px;color:#94a3b8;text-align:right;">พิมพ์โดย: ${currentUser?.name||''} | ${printDate}</div>
            <div class="footer">
                <div class="sign">ผู้นับ</div>
                <div class="sign">ผู้ตรวจสอบ</div>
            </div>
            </body></html>`;

            const w = window.open('','_blank','width=900,height=700');
            w.document.write(html); w.document.close();
            setTimeout(()=>w.print(),600);
        };

        // Export Excel รวมทุกสาขา — สำหรับ Admin (เลือกเดือน)
        window.openBranchExportModal = async function() {
            const existing = document.getElementById('branchExportModal'); if(existing) existing.remove();
            const now = new Date();
            const defaultMonth = now.toISOString().slice(0,7);
            const m = document.createElement('div');
            m.className='modal-overlay'; m.id='branchExportModal';
            m.innerHTML=`<div class="modal-box" style="max-width:440px;width:95vw;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                    <h3 style="margin:0;">📥 Export ยอดนับสต๊อกสาขา</h3>
                    <button onclick="document.getElementById('branchExportModal').remove()" style="background:#f1f5f9;border:none;padding:6px 12px;border-radius:8px;cursor:pointer;font-size:16px;">✕</button>
                </div>
                <div style="display:flex;flex-direction:column;gap:12px;">
                    <div>
                        <label style="font-size:12px;color:#64748b;font-weight:600;">📅 เลือกเดือน</label>
                        <input type="month" id="bexMonth" value="${defaultMonth}"
                            style="width:100%;margin-top:4px;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px;outline:none;box-sizing:border-box;"
                            onfocus="this.style.borderColor='#0891b2'" onblur="this.style.borderColor='#e2e8f0'">
                    </div>
                    <div>
                        <label style="font-size:12px;color:#64748b;font-weight:600;">🏪 เลือกสาขา</label>
                        <div style="display:flex;flex-direction:column;gap:6px;margin-top:6px;max-height:180px;overflow-y:auto;padding:4px;">
                            <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">
                                <input type="checkbox" id="bexAll" checked onchange="document.querySelectorAll('.bexZoneCb').forEach(cb=>cb.checked=this.checked)" style="accent-color:#0891b2;">
                                <b>ทุกสาขา</b>
                            </label>
                            ${warehouseList.filter(z=>z.toUpperCase().startsWith('BT')).map(z=>`
                            <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;padding-left:12px;">
                                <input type="checkbox" class="bexZoneCb" value="${z}" checked style="accent-color:#0891b2;">
                                ${z}
                            </label>`).join('')}
                        </div>
                    </div>
                    <div>
                        <label style="font-size:12px;color:#64748b;font-weight:600;">📊 รูปแบบ</label>
                        <div style="display:flex;gap:8px;margin-top:6px;">
                            <label style="flex:1;display:flex;align-items:center;gap:6px;padding:10px;border:1.5px solid #e2e8f0;border-radius:8px;cursor:pointer;font-size:13px;">
                                <input type="radio" name="bexFmt" value="combined" checked style="accent-color:#0891b2;"> ทุกสาขาใน Sheet เดียว
                            </label>
                            <label style="flex:1;display:flex;align-items:center;gap:6px;padding:10px;border:1.5px solid #e2e8f0;border-radius:8px;cursor:pointer;font-size:13px;">
                                <input type="radio" name="bexFmt" value="sheets" style="accent-color:#0891b2;"> แยก Sheet ต่อสาขา
                            </label>
                        </div>
                    </div>
                </div>
                <div style="margin-top:18px;display:flex;gap:8px;">
                    <button onclick="document.getElementById('branchExportModal').remove()"
                        style="flex:1;background:#f1f5f9;color:#475569;border:none;padding:11px;border-radius:10px;cursor:pointer;font-weight:600;">ยกเลิก</button>
                    <button onclick="doExportBranchExcel()"
                        style="flex:1.5;background:#0891b2;color:white;border:none;padding:11px;border-radius:10px;cursor:pointer;font-weight:700;">📥 Export Excel</button>
                </div>
            </div>`;
            document.body.appendChild(m);
        };

        window.doExportBranchExcel = async function() {
            const monthVal = document.getElementById('bexMonth')?.value;
            if(!monthVal) { toast('⚠️ เลือกเดือนก่อน','#c2410c'); return; }
            const fmt = document.querySelector('input[name="bexFmt"]:checked')?.value || 'combined';
            const selectedZones = [...document.querySelectorAll('.bexZoneCb:checked')].map(cb=>cb.value);
            if(!selectedZones.length) { toast('⚠️ เลือกสาขาก่อน','#c2410c'); return; }

            toast('⏳ กำลังโหลดข้อมูล...','#0891b2');
            document.getElementById('branchExportModal')?.remove();

            // โหลดจาก Firestore
            let docs = [];
            try {
                const snap = await getDocs(collection(db,'inventoryHistory'));
                snap.forEach(d => {
                    const x = d.data();
                    if((x.type==='branch'||x.isBranchTemplate) && x.month===monthVal && selectedZones.includes(x.zone)) {
                        docs.push({id:d.id,...x});
                    }
                });
            } catch(e) { toast('❌ โหลดข้อมูลไม่สำเร็จ','#ef4444'); return; }

            if(!docs.length) { toast('⚠️ ไม่พบข้อมูลสาขาในเดือนที่เลือก','#f59e0b'); return; }

            const wb = XLSX.utils.book_new();
            const hdr = ['สาขา','เดือน','วันที่นับ','รหัสสินค้า','ชื่อสินค้า','ยอดนับ','หน่วย','หมายเหตุ','ผู้นับ'];

            if(fmt === 'combined') {
                const rows = [hdr];
                // เรียงตามสาขา
                docs.sort((a,b)=>(a.zone||'').localeCompare(b.zone||''));
                docs.forEach(d => {
                    (d.items||[]).forEach(it => {
                        rows.push([d.zone||'',d.month||'',d.date||'',it.id||'',it.name||'',it.balance??'',it.unit||'',it.note||'',d.countedBy||'']);
                    });
                });
                const ws = XLSX.utils.aoa_to_sheet(rows);
                ws['!cols'] = [14,10,12,12,30,10,8,20,12].map(w=>({wch:w}));
                XLSX.utils.book_append_sheet(wb, ws, `ยอดนับ ${monthVal}`);
            } else {
                // แยก sheet ต่อสาขา
                docs.sort((a,b)=>(a.zone||'').localeCompare(b.zone||''));
                docs.forEach(d => {
                    const rows = [hdr];
                    (d.items||[]).forEach(it => {
                        rows.push([d.zone||'',d.month||'',d.date||'',it.id||'',it.name||'',it.balance??'',it.unit||'',it.note||'',d.countedBy||'']);
                    });
                    const ws = XLSX.utils.aoa_to_sheet(rows);
                    ws['!cols'] = [14,10,12,12,30,10,8,20,12].map(w=>({wch:w}));
                    const sheetName = (d.zone||'branch').replace(/[:\\\/\?\*\[\]]/g,'').slice(0,31);
                    XLSX.utils.book_append_sheet(wb, ws, sheetName);
                });
            }

            XLSX.writeFile(wb, `stock_branch_${monthVal}.xlsx`);
            toast(`✅ Export ${docs.length} สาขา เรียบร้อย`,'#059669');
        };

        // Admin picker: เลือกสาขา
        window.openMonthlyCountAdminPicker = async function() {
            const existing = document.getElementById('mcAdminModal'); if(existing) existing.remove();

            // โหลดข้อมูลพร้อมกัน: inventoryHistory + users
            const now = new Date();
            const monthKey = now.toISOString().slice(0,7);
            const doneZones = new Set();
            const zoneTemplateMap = {}; // zone → templateId (จาก user ที่ผูกไว้)

            try {
                const [histSnap, usersSnap] = await Promise.all([
                    getDocs(collection(db,'inventoryHistory')),
                    getDocs(collection(db,'users'))
                ]);
                histSnap.forEach(d => {
                    const x = d.data();
                    if(x.month === monthKey && x.type === 'branch') doneZones.add(x.zone);
                });
                usersSnap.forEach(d => {
                    const u = d.data();
                    if(d.id.toUpperCase().startsWith('BT') && u.stockTemplateId) {
                        (u.assignedZones||[]).forEach(z => { zoneTemplateMap[z] = u.stockTemplateId; });
                    }
                });
            } catch(e) { console.error(e); }

            // หาสาขา BT ทั้งหมดจาก warehouseList
            const btZones = warehouseList.filter(z => z.toUpperCase().startsWith('BT'));
            const sstEntries = Object.entries(stockSheetTemplates);
            const fallbackTmplId = sstEntries[0]?.[0] || '';

            const monthTH = now.toLocaleDateString('th-TH',{year:'numeric',month:'long'});

            // เก็บ zone→tmplId map ไว้ใน window เพื่อให้ onclick เรียกใช้ได้ปลอดภัย
            window._mcZoneTmplMap = Object.fromEntries(btZones.map(z=>[z, zoneTemplateMap[z]||fallbackTmplId]));

            const zoneCards = btZones.length
                ? btZones.map(zone => {
                    const isDone = doneZones.has(zone);
                    const tmplId = zoneTemplateMap[zone] || fallbackTmplId;
                    const tmplName = stockSheetTemplates[tmplId]?.name || '';
                    const safeZone = zone.replace(/'/g,"\\'");
                    return `
                    <div onclick="closeMCAdminPicker();pickAdminZone('${safeZone}')"
                        style="padding:14px 16px;border:2px solid ${isDone?'#10b981':'#e2e8f0'};border-radius:12px;cursor:pointer;background:${isDone?'#f0fdf4':'white'};display:flex;align-items:center;justify-content:space-between;transition:all .2s;"
                        onmouseover="this.style.borderColor='${isDone?`#059669`:`#3b82f6`}';this.style.transform='translateY(-1px)'"
                        onmouseout="this.style.borderColor='${isDone?`#10b981`:`#e2e8f0`}';this.style.transform=''">
                        <div style="display:flex;align-items:center;gap:10px;">
                            <div style="font-size:24px;">${isDone?'✅':'🏪'}</div>
                            <div>
                                <div style="font-weight:700;font-size:14px;color:${isDone?'#065f46':'#1e293b'};">${zone}</div>
                                <div style="font-size:11px;color:${isDone?'#059669':'#64748b'};">
                                    ${isDone ? 'นับแล้วเดือนนี้ — กดเพื่อดู/แก้ไข' : 'ยังไม่ได้นับ'}
                                    ${tmplName ? ` • 📋 ${tmplName}` : ''}
                                </div>
                            </div>
                        </div>
                        <div style="font-size:18px;color:#cbd5e1;">›</div>
                    </div>`;
                }).join('')
                : `<div style="text-align:center;padding:24px;color:#94a3b8;font-size:13px;">ยังไม่มีสาขา BT ใน warehouseList<br>ไปเพิ่มได้ที่ Admin → ตั้งค่าคลัง</div>`;

            const m = document.createElement('div');
            m.className='modal-overlay'; m.id='mcAdminModal';
            m.innerHTML=`<div class="modal-box" style="max-width:480px;width:95vw;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                    <h3 style="margin:0;">🏪 เลือกสาขาที่จะนับสต๊อก</h3>
                    <button onclick="closeMCAdminPicker()" style="background:#f1f5f9;border:none;padding:6px 12px;border-radius:8px;cursor:pointer;font-size:16px;">✕</button>
                </div>
                <div style="font-size:12px;color:#64748b;margin-bottom:16px;">📅 ${monthTH} • 👤 ${currentUser?.name||''}</div>
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
                    <span style="background:#f0fdf4;color:#059669;border:1px solid #bbf7d0;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;">✅ นับแล้ว ${doneZones.size}</span>
                    <span style="background:#fef3c7;color:#b45309;border:1px solid #fde68a;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;">⏳ รอ ${btZones.length - doneZones.size}</span>
                </div>
                <div style="display:flex;flex-direction:column;gap:8px;max-height:55vh;overflow-y:auto;padding-right:4px;">
                    ${zoneCards}
                </div>
                ${sstEntries.length === 0 ? `<div style="margin-top:14px;padding:12px;background:#fef2f2;border-radius:8px;font-size:12px;color:#c2410c;">⚠️ ยังไม่มี Template ใบนับสต๊อกสาขา — ไปสร้างที่ Admin → ตั้งค่า Template</div>` : ''}
                <div style="margin-top:14px;padding-top:12px;border-top:1px solid #f1f5f9;display:flex;flex-direction:column;gap:8px;">
                    <button onclick="closeMCAdminPicker();openBranchExportModal()"
                        style="width:100%;padding:11px;background:#0891b2;color:white;border:none;border-radius:10px;cursor:pointer;font-size:13px;font-weight:700;">
                        📥 Export ยอดนับสาขา (Excel)
                    </button>
                    <button onclick="closeMCAdminPicker();openRandomSKUCount()"
                        style="width:100%;padding:11px;background:linear-gradient(135deg,#7c3aed,#5b21b6);color:white;border:none;border-radius:10px;cursor:pointer;font-size:13px;font-weight:700;">
                        🎲 สุ่ม 10 SKU ทดลองนับ (ช่วง Pilot)
                    </button>
                    <button onclick="closeMCAdminPicker();openCentralStock()"
                        style="width:100%;padding:11px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:10px;cursor:pointer;font-size:13px;color:#475569;font-weight:600;">
                        📦 นับสต๊อกคลังหลัก (ไม่ใช้ Template)
                    </button>
                </div>
            </div>`;
            document.body.appendChild(m);
        };

        // BT modal เลือกโหมด: นับเต็ม หรือ สุ่มทดลอง
        window.openBTCountModePicker = function(tmplId, tmpl, zone) {
            const existing = document.getElementById('btModeModal'); if(existing) existing.remove();
            // เก็บไว้ใน window เพื่อให้ onclick ใช้ได้ปลอดภัย
            window._btModeTmplId = tmplId;
            window._btModeZone = zone;
            const now = new Date();
            const monthTH = now.toLocaleDateString('th-TH',{year:'numeric',month:'long'});
            const m = document.createElement('div');
            m.className='modal-overlay'; m.id='btModeModal';
            m.innerHTML=`<div class="modal-box" style="max-width:420px;width:95vw;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                    <h3 style="margin:0;">📋 นับสต๊อก — ${zone}</h3>
                    <button onclick="document.getElementById('btModeModal').remove()" style="background:#f1f5f9;border:none;padding:6px 12px;border-radius:8px;cursor:pointer;font-size:16px;">✕</button>
                </div>
                <div style="font-size:12px;color:#64748b;margin-bottom:20px;">📅 ${monthTH} • 👤 ${currentUser?.name||''}</div>
                <div style="display:flex;flex-direction:column;gap:10px;">
                    <div onclick="document.getElementById('btModeModal').remove();btPickFullCount()"
                        style="padding:18px 20px;border:2px solid #10b981;border-radius:14px;cursor:pointer;background:white;transition:all .2s;"
                        onmouseover="this.style.background='#f0fdf4';this.style.transform='translateY(-1px)'"
                        onmouseout="this.style.background='white';this.style.transform=''">
                        <div style="font-size:18px;margin-bottom:4px;">📋 นับสต๊อกสิ้นเดือน (ครบทุกรายการ)</div>
                        <div style="font-size:12px;color:#64748b;">นับตาม Template — ${(tmpl.items||[]).length} รายการ • บันทึกผลรายเดือน</div>
                    </div>
                    <div onclick="document.getElementById('btModeModal').remove();openRandomSKUCount()"
                        style="padding:18px 20px;border:2px solid #7c3aed;border-radius:14px;cursor:pointer;background:white;transition:all .2s;"
                        onmouseover="this.style.background='#f5f3ff';this.style.transform='translateY(-1px)'"
                        onmouseout="this.style.background='white';this.style.transform=''">
                        <div style="font-size:18px;margin-bottom:4px;">🎲 สุ่ม 10 SKU ทดลองนับ</div>
                        <div style="font-size:12px;color:#64748b;">เฉพาะช่วง Pilot — สุ่มวันละ 10 รายการ • ไม่กระทบยอด stock จริง</div>
                    </div>
                </div>
            </div>`;
            document.body.appendChild(m);
        };

        window.btPickFullCount = function() {
            const tmplId = window._btModeTmplId;
            const zone   = window._btModeZone;
            const tmpl   = stockSheetTemplates[tmplId];
            if(!tmpl){ toast('⚠️ ไม่พบ Template','#c2410c'); return; }
            openBranchMonthlyCount(tmplId, tmpl, zone);
        };

        window.closeMCAdminPicker = function() {
            const el = document.getElementById('mcAdminModal'); if(el) el.remove();
        };

        // เรียกหลังจาก admin picker ปิดแล้ว — ดึง tmplId จาก window map ที่เก็บไว้
        window.pickAdminZone = async function(zone) {
            const tmplId = (window._mcZoneTmplMap||{})[zone] || Object.keys(stockSheetTemplates)[0] || '';
            const tmpl = stockSheetTemplates[tmplId];
            if(!tmpl){ toast('⚠️ ไม่พบ Template สำหรับสาขานี้ กรุณาตั้งค่า Template ก่อน','#c2410c'); return; }
            // เช็คว่านับแล้วหรือยัง
            const monthKey = new Date().toISOString().slice(0,7);
            let existingDoc = null;
            try {
                const snap = await getDocs(collection(db,'inventoryHistory'));
                snap.forEach(d=>{ const x=d.data(); if(x.zone===zone&&x.month===monthKey&&x.type==='branch') existingDoc={id:d.id,...x}; });
            } catch(e){}
            if(existingDoc) openBranchMonthlyDoneSummary(tmplId, tmpl, zone, existingDoc);
            else openBranchMonthlyCount(tmplId, tmpl, zone);
        };

        // ===== สุ่ม 10 SKU ทดลองนับ (Pilot mode) =====
        window.openRandomSKUCount = function() {
            const isBT = currentUser?.username?.toUpperCase().startsWith('BT');
            const zone = isBT
                ? (currentUser.assignedZones||[])[0] || ''
                : ''; // admin กรอกเอง

            // สุ่ม 10 SKU จาก allProducts
            // BT: สุ่มเฉพาะ products ของ zone ตัวเอง  Admin: ทั้งหมด
            const btZoneProducts = isBT && zone
                ? (zoneProductMap[zone]||[])
                : null;
            const pool = [...allProducts].filter(p => p.id && p.name && (!btZoneProducts || btZoneProducts.includes(p.id)));
            const shuffled = pool.sort(()=>Math.random()-0.5).slice(0,Math.min(10,pool.length));

            document.getElementById('dashboardView').classList.add('hidden');
            const c = document.getElementById('toolAppContainer'); c.classList.remove('hidden');
            const now = new Date();
            const today = now.toISOString().slice(0,10);
            const timeStr = now.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});

            c.innerHTML = `
            <div class="tool-header no-print">
                <h2>🎲 ทดลองนับสต๊อก — ${shuffled.length} SKU สุ่ม</h2>
                <div style="display:flex;gap:8px;">
                    <button onclick="openRandomSKUCount()" style="background:#7c3aed;color:white;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-weight:bold;">🎲 สุ่มใหม่</button>
                    <button onclick="goToDashboard()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;">🏠</button>
                    <button onclick="closeTool()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;">✕</button>
                </div>
            </div>
            <div style="background:#f5f3ff;border:1.5px solid #ddd6fe;border-radius:12px;padding:12px 16px;margin-bottom:16px;font-size:13px;color:#5b21b6;" class="no-print">
                🎯 <b>โหมดทดลอง Pilot</b> — สุ่ม ${shuffled.length} รายการจากสินค้าทั้งหมด ${allProducts.length} รายการ • ข้อมูลจะบันทึกแยกใน collection <code>pilotCounts</code> ไม่กระทบ stock จริง
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-bottom:20px;" class="no-print">
                <div class="input-group" style="border:2px solid var(--danger);"><label>📅 วันที่นับ</label>
                    <input type="date" id="rnd_date" value="${today}" style="width:100%;border:none;font-weight:bold;outline:none;font-size:14px;color:#1e293b;">
                </div>
                <div class="input-group" style="border:2px solid var(--info);${isBT?'background:#f0fdf4;':''}"><label>📦 คลัง/สาขา</label>
                    ${isBT
                        ? `<b style="font-size:14px;color:#065f46;">${zone}</b><input type="hidden" id="rnd_zone" value="${zone}">`
                        : `<input type="text" id="rnd_zone" value="${zone}" placeholder="ระบุคลัง/สาขา..." style="width:100%;border:none;font-weight:bold;outline:none;font-size:14px;color:#1e293b;font-family:inherit;">`
                    }
                </div>
                <div class="input-group" style="background:#f0fdf4;border:1.5px solid #bbf7d0;"><label>🙋 ผู้นับ</label>
                    <b style="font-size:13px;color:#065f46;">${currentUser?.name||''}</b>
                </div>
            </div>
            <div style="background:white;border-radius:14px;border:1px solid #e2e8f0;overflow:hidden;margin-bottom:20px;">
            <table style="width:100%;border-collapse:collapse;">
                <thead><tr style="background:#5b21b6;color:white;">
                    <th style="padding:12px 16px;text-align:left;font-size:12px;">สินค้า</th>
                    <th style="padding:12px;text-align:center;font-size:12px;background:#4c1d95;">ยอดนับได้</th>
                    <th style="padding:12px;text-align:center;font-size:12px;">หน่วย</th>
                    <th style="padding:12px;text-align:center;font-size:12px;">หมายเหตุ</th>
                </tr></thead>
                <tbody>
                ${shuffled.map((p,idx)=>{
                    const unit = (p.units||[{name:p.unit||''}])[0]?.name||p.unit||'';
                    return `
                    <tr style="border-bottom:1px solid #f1f5f9;${idx%2===1?'background:#fafafa':''}">
                        <td style="padding:12px 16px;">
                            <div style="font-weight:700;font-size:13px;">${p.id}</div>
                            <div style="color:#475569;font-size:12px;">${p.name}</div>
                        </td>
                        <td style="padding:12px;text-align:center;">
                            <input type="number" id="rnd_${p.id}" min="0" placeholder="0"
                                style="width:90px;padding:9px;border-radius:10px;border:2px solid #7c3aed;text-align:center;font-weight:700;font-size:16px;outline:none;"
                                onfocus="this.style.borderColor='#4c1d95'" onblur="this.style.borderColor='#7c3aed'">
                        </td>
                        <td style="padding:12px;text-align:center;color:#64748b;font-size:13px;">${unit}</td>
                        <td style="padding:12px;">
                            <input type="text" id="rndNote_${p.id}" placeholder="หมายเหตุ"
                                style="width:100%;padding:7px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;box-sizing:border-box;outline:none;">
                        </td>
                    </tr>`;
                }).join('')}
                </tbody>
            </table>
            </div>
            <div style="text-align:center;padding-bottom:20px;" class="no-print">
                <button onclick="saveRandomSKUCount()"
                    style="background:#7c3aed;color:white;padding:14px 50px;border:none;border-radius:12px;font-size:16px;font-weight:bold;cursor:pointer;box-shadow:0 4px 15px rgba(124,58,237,.3);">
                    💾 บันทึกผลทดลองนับ
                </button>
            </div>`;
            // เก็บ skuList ไว้ใน window แทนการฝังใน onclick
            window._rndSkuList = shuffled.map(p=>({
                id:p.id, name:p.name,
                unit:(p.units||[{name:p.unit||''}])[0]?.name||p.unit||''
            }));
        };

        window.saveRandomSKUCount = async function() {
            const skuList = window._rndSkuList;
            if(!skuList?.length){ toast('⚠️ ไม่พบรายการสุ่ม','#c2410c'); return; }
            const dateVal = document.getElementById('rnd_date')?.value;
            const zone = document.getElementById('rnd_zone')?.value.trim();
            if(!dateVal||!zone){toast('⚠️ กรุณากรอกวันที่และคลัง','#c2410c');return;}
            const [cy,cm,cd]=dateVal.split('-');
            const dateTH=`${cd}/${cm}/${parseInt(cy)+543}`;

            const items = skuList.map(p=>({
                id:p.id, name:p.name, unit:p.unit,
                balance:parseFloat(document.getElementById(`rnd_${p.id}`)?.value)||0,
                note:document.getElementById(`rndNote_${p.id}`)?.value.trim()||''
            }));

            try {
                await addDoc(collection(db,'pilotCounts'),{
                    zone, date:dateTH, month:`${cy}-${cm}`,
                    timestamp:Date.now(),
                    countedBy:currentUser.name,
                    skuCount:skuList.length,
                    items
                });
                toast('✅ บันทึกผลทดลองนับเรียบร้อย','#7c3aed');
                goToDashboard();
            } catch(e){toast('❌ บันทึกไม่สำเร็จ: '+e.message,'#ef4444');}
        };

        // Admin เปิดดูสาขาที่นับแล้ว (แสดง summary แล้วแก้ได้)
        window.openBranchMonthlyCountForAdmin = async function(tmplId, zone) {
            const tmpl = stockSheetTemplates[tmplId]; if(!tmpl) return;
            const now = new Date();
            const monthKey = now.toISOString().slice(0,7);
            let existingDoc = null;
            try {
                const snap = await getDocs(collection(db,'inventoryHistory'));
                snap.forEach(d => {
                    const x = d.data();
                    if(x.zone === zone && x.month === monthKey && x.type === 'branch') existingDoc = {id: d.id, ...x};
                });
            } catch(e) { console.error(e); }
            if(existingDoc) openBranchMonthlyDoneSummary(tmplId, tmpl, zone, existingDoc);
            else openBranchMonthlyCount(tmplId, tmpl, zone);
        };

        // เก็บ backward compat สำหรับ closeMCTemplatePicker ที่อาจถูกเรียกจากที่อื่น
        window.closeMCTemplatePicker = function() {
            closeMCAdminPicker();
        };

        window.openBranchMonthlyCount = function(tmplId, tmpl, zone, prefillDoc) {
            document.getElementById('dashboardView').classList.add('hidden');
            const c = document.getElementById('toolAppContainer'); c.classList.remove('hidden');
            const now = new Date();
            const today = now.toISOString().slice(0,10);
            const timeStr = now.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});
            const defaultZone = zone || (currentUser?.assignedZones||[])[0] || '';
            // บันทึก params + push hash เพื่อให้ refresh แล้วกลับมาหน้าเดิมได้
            try { sessionStorage.setItem('_mcNav', JSON.stringify({ tmplId, zone: defaultZone })); } catch(_) {}
            if (location.hash !== '#monthly-count') history.pushState({ nav: 'monthly-count' }, '', '#monthly-count');
            const groups = [...new Set(tmpl.items.map(i=>i.group||i.category||'ทั่วไป'))];

            // prefill จากข้อมูลเดิม ถ้ามี
            const prefillMap = {};
            if(prefillDoc) {
                (prefillDoc.items||[]).forEach(it => { prefillMap[it.id] = it; });
            }

            // ถ้าเป็น BT และมีข้อมูลเดิม ให้แสดง badge แจ้ง
            const isBT = currentUser?.username?.toUpperCase().startsWith('BT');
            const editBadge = prefillDoc
                ? `<div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:10px 14px;margin-bottom:16px;font-size:12px;color:#b45309;" class="no-print">
                    ✏️ <b>โหมดแก้ไข</b> — กำลังแก้ไขยอดนับที่บันทึกไว้วันที่ ${prefillDoc.date||''} เมื่อบันทึกใหม่จะทับข้อมูลเดิม
                   </div>` : '';

            c.innerHTML = `
            <div class="tool-header no-print">
                <h2>📋 นับสต๊อกสิ้นเดือน</h2>
                <div style="display:flex;gap:8px;">
                    <span style="background:${tmpl.color||'#06b6d4'};color:white;padding:6px 14px;border-radius:8px;font-size:12px;font-weight:bold;">📄 ${tmpl.name}</span>
                    <button onclick="printBranchMonthlyCount('${tmplId}', document.getElementById('bmc_zone')?.value||'')" style="background:#059669;color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:bold;">🖨️ พิมพ์ / PDF</button>
                    <button onclick="goToDashboard()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;">🏠</button>
                    <button onclick="closeTool()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;">✕</button>
                </div>
            </div>
            ${editBadge}
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-bottom:20px;" class="no-print">
                <div class="input-group" style="border:2px solid var(--danger);"><label>📅 วันที่นับ</label>
                    <input type="date" id="bmc_date" value="${today}" style="width:100%;border:none;font-weight:bold;outline:none;font-size:14px;color:#1e293b;">
                </div>
                <div class="input-group" style="border:2px solid var(--accent-gold);"><label>🕐 เวลา</label>
                    <input type="time" id="bmc_time" value="${timeStr.slice(0,5)}" style="width:100%;border:none;font-weight:bold;outline:none;font-size:14px;color:#1e293b;">
                </div>
                <div class="input-group" style="border:2px solid var(--info);${isBT?'background:#f0fdf4;':''}"><label>📦 คลัง/สาขา</label>
                    ${isBT
                        ? `<b style="font-size:14px;color:#065f46;">${defaultZone}</b><input type="hidden" id="bmc_zone" value="${defaultZone}">`
                        : `<input type="text" id="bmc_zone" value="${defaultZone}" placeholder="ระบุคลัง/สาขา..."
                            style="width:100%;border:none;font-weight:bold;outline:none;font-size:14px;color:#1e293b;font-family:inherit;">`
                    }
                </div>
                <div class="input-group" style="background:#f0fdf4;border:1.5px solid #bbf7d0;"><label>🙋 ผู้นับ</label>
                    <b style="font-size:13px;color:#065f46;">${currentUser?.name||''}</b>
                </div>
            </div>
            <div id="bmcSearchAnchor" class="no-print" style="margin-bottom:4px;">
                <input type="text" id="bmcSearchInput" placeholder="🔍 ค้นหาสินค้า (รหัส / ชื่อ)..." oninput="filterBMCRows(this.value)"
                    style="width:100%;padding:11px 16px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box;outline:none;transition:border .2s;"
                    onfocus="this.style.borderColor='#3b82f6'" onblur="this.style.borderColor='#e2e8f0'">
                <div id="bmcProgress" style="margin-top:8px;display:flex;align-items:center;gap:10px;">
                    <div style="flex:1;height:6px;background:#f1f5f9;border-radius:99px;overflow:hidden;">
                        <div id="bmcProgressBar" style="height:100%;width:0%;background:linear-gradient(90deg,#3b82f6,#10b981);border-radius:99px;transition:width .3s;"></div>
                    </div>
                    <span id="bmcProgressText" style="font-size:11px;color:#94a3b8;white-space:nowrap;">กรอกแล้ว 0 / 0 รายการ</span>
                </div>
            </div>
            <div id="bmcTableWrap" style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;min-width:600px;" id="bmcTable">
                <thead>
                    <tr style="background:#1e293b;color:white;">
                        <th style="padding:12px 16px;text-align:left;font-size:12px;">สินค้า</th>
                        <th style="padding:12px;text-align:center;font-size:12px;background:#1d4ed8;">ยอดนับได้</th>
                        <th style="padding:12px;text-align:center;font-size:12px;">หน่วย</th>
                        <th style="padding:12px;text-align:center;font-size:12px;">หมายเหตุ</th>
                    </tr>
                </thead>
                <tbody id="bmcTbody">
                ${groups.map(grp=>{
                    const grpItems = tmpl.items.filter(i=>(i.group||i.category||'ทั่วไป')===grp);
                    const grpKey = grp.replace(/"/g,'&quot;');
                    const header = `<tr class="bmc-group-header" data-group="${grpKey}"><td colspan="4" style="padding:10px 16px;background:linear-gradient(90deg,#f0f9ff,#f8fafc);font-weight:700;font-size:12px;color:#0369a1;border-top:2px solid #bae6fd;letter-spacing:.5px;">▌ ${grp.toUpperCase()}</td></tr>`;
                    const rows = grpItems.map(it=>{
                        const prev = prefillMap[it.id];
                        const prevVal = prev?.balance != null ? prev.balance : '';
                        const prevNote = prev?.note || '';
                        const hasPrev = prevVal !== '';
                        return `
                        <tr class="bmc-row" data-group="${grpKey}" data-search="${it.id.toLowerCase()} ${it.name.toLowerCase()}" style="border-bottom:1px solid #f1f5f9;${hasPrev?'background:#fffbeb;':''}">
                            <td style="padding:12px 16px;">
                                <div style="font-weight:700;font-size:13px;">${it.id}</div>
                                <div style="color:#475569;font-size:12px;">${it.name}</div>
                            </td>
                            <td style="padding:12px;text-align:center;">
                                <input type="number" id="bmc_${it.id}" min="0" placeholder="0" value="${prevVal}"
                                    inputmode="numeric"
                                    style="width:80px;padding:10px 6px;border-radius:10px;border:2px solid ${hasPrev?'#f59e0b':'#3b82f6'};text-align:center;font-weight:700;font-size:18px;outline:none;"
                                    onfocus="this.style.borderColor='#1d4ed8'" onblur="this.style.borderColor='${hasPrev?`#f59e0b`:`#3b82f6`}'"
                                    oninput="updateBMCProgress()">
                            </td>
                            <td style="padding:12px;text-align:center;color:#64748b;font-size:13px;">${it.unit||''}</td>
                            <td style="padding:12px;">
                                <input type="text" id="bmcNote_${it.id}" placeholder="หมายเหตุ" value="${prevNote}"
                                    style="width:100%;padding:7px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;box-sizing:border-box;outline:none;">
                            </td>
                        </tr>`;
                    }).join('');
                    return header+rows;
                }).join('')}
                </tbody>
            </table>
            </div>
            <div style="margin-top:24px;text-align:center;" class="no-print">
                <button onclick="saveBranchMonthlyCount('${tmplId}','${defaultZone}')"
                    style="background:var(--success);color:white;padding:16px 60px;border:none;border-radius:14px;font-size:18px;font-weight:bold;cursor:pointer;box-shadow:0 4px 15px rgba(16,185,129,.3);">
                    💾 บันทึกผลการนับสต๊อกสิ้นเดือน
                </button>
            </div>`;
            // ลงทะเบียน draft protection หลัง DOM render
            if(window._DM_startMonthlyCount) setTimeout(()=>_DM_startMonthlyCount(tmplId, tmpl, defaultZone), 400);
            setTimeout(()=>{
                updateBMCProgress();
                _setupBMCFloatingSearch();
            }, 100);
        };

        window.filterBMCRows = function(q) {
            const term = q.toLowerCase();
            // ซ่อน/แสดง rows
            document.querySelectorAll('.bmc-row').forEach(r=>{
                r.style.display = (!term || r.dataset.search.includes(term)) ? '' : 'none';
            });
            // ซ่อน group header ถ้าไม่มี row ที่ visible ในกลุ่มนั้น
            document.querySelectorAll('.bmc-group-header').forEach(hdr=>{
                const grp = hdr.dataset.group;
                const hasVisible = [...document.querySelectorAll(`.bmc-row[data-group="${grp}"]`)]
                    .some(r => r.style.display !== 'none');
                hdr.style.display = hasVisible ? '' : 'none';
            });
        };

        window.updateBMCProgress = function() {
            const allInputs = [...document.querySelectorAll('#bmcTbody input[type="number"]')];
            const total = allInputs.length;
            const filled = allInputs.filter(i => i.value !== '' && i.value !== null).length;
            const pct = total ? Math.round(filled / total * 100) : 0;
            const bar = document.getElementById('bmcProgressBar');
            const txt = document.getElementById('bmcProgressText');
            if (!bar || !txt) return;
            bar.style.width = pct + '%';
            bar.style.background = pct === 100 ? '#10b981' : 'linear-gradient(90deg,#3b82f6,#10b981)';
            txt.textContent = `กรอกแล้ว ${filled} / ${total} รายการ`;
            txt.style.color = pct === 100 ? '#059669' : '#94a3b8';
            // sync ค่าใน floating bar ด้วย
            const fBar = document.getElementById('bmcFloatingProgressBar');
            const fTxt = document.getElementById('bmcFloatingProgressText');
            if (fBar) { fBar.style.width = pct + '%'; fBar.style.background = pct === 100 ? '#10b981' : 'linear-gradient(90deg,#3b82f6,#10b981)'; }
            if (fTxt) { fTxt.textContent = `กรอกแล้ว ${filled} / ${total} รายการ`; fTxt.style.color = pct === 100 ? '#059669' : '#94a3b8'; }
        };

        window._setupBMCFloatingSearch = function() {
            // ลบ floating bar เก่าออกก่อนถ้ามี (กันซ้ำ)
            const old = document.getElementById('bmcFloatingBar');
            if (old) old.remove();
            if (window._bmcScrollHandler) window.removeEventListener('scroll', window._bmcScrollHandler);

            const anchor = document.getElementById('bmcSearchAnchor');
            if (!anchor) return;

            // สร้าง floating bar
            const bar = document.createElement('div');
            bar.id = 'bmcFloatingBar';
            bar.className = 'no-print';
            bar.style.cssText = 'display:none;position:fixed;top:0;left:0;right:0;z-index:999;background:#fff;box-shadow:0 2px 12px rgba(0,0,0,0.12);padding:10px 24px 8px;';
            bar.innerHTML = `
                <input type="text" id="bmcFloatingInput" placeholder="🔍 ค้นหาสินค้า (รหัส / ชื่อ)..."
                    style="width:100%;padding:10px 16px;border:1.5px solid #3b82f6;border-radius:10px;font-size:14px;box-sizing:border-box;outline:none;"
                    oninput="filterBMCRows(this.value);document.getElementById('bmcSearchInput').value=this.value;">
                <div style="margin-top:6px;display:flex;align-items:center;gap:10px;">
                    <div style="flex:1;height:5px;background:#f1f5f9;border-radius:99px;overflow:hidden;">
                        <div id="bmcFloatingProgressBar" style="height:100%;width:0%;border-radius:99px;transition:width .3s;"></div>
                    </div>
                    <span id="bmcFloatingProgressText" style="font-size:11px;color:#94a3b8;white-space:nowrap;">กรอกแล้ว 0 / 0 รายการ</span>
                </div>`;
            document.body.appendChild(bar);

            // scroll handler — show floating bar เมื่อ anchor เลื่อนพ้น viewport
            window._bmcScrollHandler = function() {
                if (!document.getElementById('bmcSearchAnchor')) {
                    window.removeEventListener('scroll', window._bmcScrollHandler);
                    const b = document.getElementById('bmcFloatingBar');
                    if (b) b.remove();
                    return;
                }
                const rect = anchor.getBoundingClientRect();
                const show = rect.bottom < 0;
                bar.style.display = show ? 'block' : 'none';
                // sync ค่า input
                if (show) {
                    const fi = document.getElementById('bmcFloatingInput');
                    const si = document.getElementById('bmcSearchInput');
                    if (fi && si && fi.value !== si.value) fi.value = si.value;
                }
            };
            window.addEventListener('scroll', window._bmcScrollHandler);

            // cleanup เมื่อ toolAppContainer ถูก clear (ออกจากหน้า)
            const observer = new MutationObserver(()=>{
                if (!document.getElementById('bmcSearchAnchor')) {
                    window.removeEventListener('scroll', window._bmcScrollHandler);
                    const b = document.getElementById('bmcFloatingBar');
                    if (b) b.remove();
                    observer.disconnect();
                }
            });
            const container = document.getElementById('toolAppContainer');
            if (container) observer.observe(container, { childList: true, subtree: false });
        };

        window.saveBranchMonthlyCount = async function(tmplId, _zoneFromBtn) {
            const tmpl = stockSheetTemplates[tmplId];
            if(!tmpl) {
                toast(`⚠️ ไม่พบ Template (${tmplId}) กรุณาติดต่อ Admin เพื่อผูก Template ใหม่`,'#c2410c');
                return;
            }
            const dateVal = document.getElementById('bmc_date')?.value;
            if(!dateVal){toast('⚠️ กรุณาเลือกวันที่','#c2410c');return;}
            const zone = document.getElementById('bmc_zone')?.value.trim() || _zoneFromBtn || '';
            if(!zone){toast('⚠️ กรุณาระบุคลัง/สาขา','#c2410c');return;}
            const timeVal = document.getElementById('bmc_time')?.value || '';
            const [cy,cm,cd]=dateVal.split('-');
            const dateTH=`${cd}/${cm}/${parseInt(cy)+543}`;
            const datetimeTH = dateTH + (timeVal ? ' ' + timeVal : '');
            const monthKey = `${cy}-${cm}`;

            const items = tmpl.items.map(it=>({
                id:it.id, name:it.name, unit:it.unit||'',
                group:it.group||it.category||'',
                balance:parseFloat(document.getElementById(`bmc_${it.id}`)?.value)||0,
                note:document.getElementById(`bmcNote_${it.id}`)?.value.trim()||''
            }));
            if(!items.some(it=>it.balance>0)){
                if(!confirm('ยังไม่ได้กรอกยอดใดเลย ยืนยันบันทึกไหม?')) return;
            }

            // เช็คและลบของเดิมถ้ามี (auto-overwrite)
            try {
                const existSnap = await getDocs(collection(db,'inventoryHistory'));
                for(const d of existSnap.docs) {
                    const x = d.data();
                    if(x.zone === zone && x.month === monthKey && (x.type === 'branch' || x.isBranchTemplate)) {
                        await deleteDoc(doc(db,'inventoryHistory',d.id));
                        break;
                    }
                }
            } catch(e){ console.error('ลบของเดิม error:', e); }

            try {
                await addDoc(collection(db,'inventoryHistory'),{
                    type:'branch',
                    zone, month:monthKey,
                    date:dateTH, datetime:datetimeTH, timestamp:Date.now(),
                    countedBy:currentUser.name, recordedBy:currentUser.name,
                    templateId:tmplId, templateName:tmpl.name,
                    isBranchTemplate:true,
                    items
                });
                toast('✅ บันทึกผลการนับเรียบร้อย','#059669');
                // clear draft หลัง save สำเร็จ
                if(window._DM){
                    const key=`monthly_${tmplId}_${(zone||'').replace(/\s/g,'_')}`;
                    _DM.clear(key);
                }
                goToDashboard();
            } catch(e){toast('❌ บันทึกไม่สำเร็จ: '+e.message,'#ef4444');}
        };

        window.printBranchMonthlyCount = function(tmplId, zone) {
            const tmpl = stockSheetTemplates[tmplId]; if(!tmpl) return;
            const dateVal = document.getElementById('bmc_date')?.value||new Date().toISOString().slice(0,10);
            const [cy,cm,cd]=dateVal.split('-');
            const dateTH=`${cd}/${cm}/${parseInt(cy)+543}`;
            const groups = [...new Set(tmpl.items.map(i=>i.group||i.category||'ทั่วไป'))];
            const tableBody = groups.map(grp=>{
                const grpItems=tmpl.items.filter(i=>(i.group||i.category||'ทั่วไป')===grp);
                const header=`<tr><td colspan="4" style="padding:8px 12px;background:#f0f9ff;font-weight:700;font-size:11px;color:#0369a1;border-top:2px solid #bae6fd;">▌ ${grp.toUpperCase()}</td></tr>`;
                const rows=grpItems.map((it,idx)=>`
                    <tr style="${idx%2===0?'background:#f8fafc':''}">
                        <td style="padding:9px 12px;">${it.id}</td>
                        <td style="padding:9px 12px;">${it.name}</td>
                        <td style="padding:9px;text-align:center;">${it.unit||''}</td>
                        <td style="padding:9px;width:100px;border-bottom:1px solid #cbd5e1;">${parseFloat(document.getElementById(`bmc_${it.id}`)?.value)||''}</td>
                        <td style="padding:9px;width:120px;"></td>
                    </tr>`).join('');
                return header+rows;
            }).join('');
            const w=window.open('','_blank');
            w.document.write(`<html><head><title>ใบนับสต๊อก ${zone} ${dateTH}</title>
            <style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th{background:#1e293b;color:white;padding:10px}td{border:1px solid #e2e8f0;font-size:12px}@media print{body{padding:0}}</style></head><body>
            <h2 style="margin:0 0 4px;">ใบนับสต๊อกคงเหลือ</h2>
            <div style="font-size:13px;color:#64748b;margin-bottom:16px;">สาขา: <b>${zone}</b> • Template: <b>${tmpl.name}</b> • วันที่: <b>${dateTH}</b> • บันทึกโดย: <b>${currentUser.name}</b></div>
            <table><thead><tr><th>รหัส</th><th>ชื่อสินค้า</th><th>หน่วย</th><th>ยอดนับ</th><th>หมายเหตุ</th></tr></thead>
            <tbody>${tableBody}</tbody></table>
            <div style="margin-top:40px;display:flex;gap:60px;">
                <div style="text-align:center;border-top:1px solid #333;padding-top:8px;min-width:150px;">ผู้นับ</div>
                <div style="text-align:center;border-top:1px solid #333;padding-top:8px;min-width:150px;">ผู้ตรวจสอบ</div>
            </div>
            </body></html>`);
            w.document.close(); setTimeout(()=>w.print(),400);
        };

        // พิมพ์จากหน้า summary (ข้อมูลที่บันทึกแล้ว)
        // พิมพ์จากหน้า summary — ดึงข้อมูลจาก window._bmcCurrentDoc โดยตรง
        window.printBranchMonthlyCountSummary = function() {
            const existingDoc = window._bmcCurrentDoc;
            const tmplId = window._bmcCurrentTmplId;
            const zone = window._bmcCurrentZone;
            const tmpl = stockSheetTemplates[tmplId];
            if(!existingDoc || !tmpl) { toast('⚠️ ไม่พบข้อมูล','#c2410c'); return; }

            const groups = [...new Set((existingDoc.items||[]).map(i=>i.group||i.category||'ทั่วไป'))];
            const tableBody = groups.map(grp => {
                const grpItems = (existingDoc.items||[]).filter(i=>(i.group||i.category||'ทั่วไป')===grp);
                const header = `<tr><td colspan="5" style="padding:8px 12px;background:#f0f9ff;font-weight:700;font-size:11px;color:#0369a1;border-top:2px solid #bae6fd;">▌ ${grp.toUpperCase()}</td></tr>`;
                const itemRows = grpItems.map((it,idx) => `
                    <tr style="${idx%2===0?'background:#f8fafc':''}">
                        <td style="padding:9px 12px;">${it.id}</td>
                        <td style="padding:9px 12px;">${it.name}</td>
                        <td style="padding:9px;text-align:center;font-weight:bold;font-size:14px;">${it.balance??''}</td>
                        <td style="padding:9px;text-align:center;">${it.unit||''}</td>
                        <td style="padding:9px;">${it.note||''}</td>
                    </tr>`).join('');
                return header + itemRows;
            }).join('');

            const now = new Date();
            const printDate = now.toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'});
            const w = window.open('','_blank');
            w.document.write(`<html><head><title>ใบนับสต๊อก ${zone}</title>
            <style>
                @page{size:A4;margin:15mm}
                body{font-family:'Sarabun',sans-serif;margin:0;color:#1e293b;font-size:13px;}
                table{width:100%;border-collapse:collapse;margin-top:8px;}
                thead tr{background:#1e293b;color:white;}
                th{padding:9px 12px;text-align:left;font-size:12px;}
                td{border-bottom:1px solid #e2e8f0;font-size:12px;padding:0;}
                @media print{body{padding:0}}
            </style>
            <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap" rel="stylesheet">
            </head><body>
            <h2 style="margin:0 0 2px;">ใบนับสต๊อกคงเหลือ</h2>
            <div style="font-size:12px;color:#64748b;margin-bottom:12px;display:flex;gap:20px;flex-wrap:wrap;">
                <span>🏪 สาขา: <b>${zone}</b></span>
                <span>📅 วันที่นับ: <b>${existingDoc.date||''}</b></span>
                <span>📄 Template: <b>${tmpl.name}</b></span>
                <span>👤 โดย: <b>${existingDoc.countedBy||currentUser.name}</b></span>
                <span style="color:#94a3b8;">พิมพ์: ${printDate}</span>
            </div>
            <table>
                <thead><tr>
                    <th style="width:110px;">รหัส</th>
                    <th>ชื่อสินค้า</th>
                    <th style="width:90px;text-align:center;">ยอดนับ</th>
                    <th style="width:70px;text-align:center;">หน่วย</th>
                    <th style="width:140px;">หมายเหตุ</th>
                </tr></thead>
                <tbody>${tableBody}</tbody>
            </table>
            <div style="margin-top:36px;display:flex;gap:60px;">
                <div style="text-align:center;border-top:1px solid #333;padding-top:6px;min-width:150px;">ผู้นับ</div>
                <div style="text-align:center;border-top:1px solid #333;padding-top:6px;min-width:150px;">ผู้ตรวจสอบ</div>
            </div>
            </body></html>`);
            w.document.close(); setTimeout(()=>w.print(),500);
        };

        // Export Excel จากหน้า Summary (ข้อมูลเอกสารเดียว)
        window.exportBranchMonthlyCountExcel = function() {
            const existingDoc = window._bmcCurrentDoc;
            const zone = window._bmcCurrentZone;
            if(!existingDoc) { toast('⚠️ ไม่พบข้อมูล','#c2410c'); return; }
            const rows = [['สาขา','เดือน','วันที่นับ','รหัสสินค้า','ชื่อสินค้า','ยอดนับ','หน่วย','หมายเหตุ','ผู้นับ']];
            (existingDoc.items||[]).forEach(it => {
                rows.push([
                    zone,
                    existingDoc.month||'',
                    existingDoc.date||'',
                    it.id, it.name,
                    it.balance??0,
                    it.unit||'',
                    it.note||'',
                    existingDoc.countedBy||''
                ]);
            });
            const ws = XLSX.utils.aoa_to_sheet(rows);
            ws['!cols'] = [{wch:20},{wch:10},{wch:14},{wch:12},{wch:35},{wch:10},{wch:8},{wch:20},{wch:14}];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'นับสต๊อกสาขา');
            XLSX.writeFile(wb, `BranchCount_${zone}_${existingDoc.month||'unknown'}.xlsx`);
        };

        // Export Excel รวมทุกสาขา (Admin) — ดึงจาก Firestore ตามเดือน
        window.exportAllBranchMonthlyExcel = async function(monthKey) {
            if(!monthKey) {
                const now = new Date();
                monthKey = now.toISOString().slice(0,7);
            }
            toast('⏳ กำลังโหลดข้อมูล...','#0891b2');
            try {
                const snap = await getDocs(collection(db,'inventoryHistory'));
                const docs = [];
                snap.forEach(d => {
                    const x = d.data();
                    if(x.month === monthKey && (x.type === 'branch' || x.isBranchTemplate)) {
                        docs.push({id: d.id, ...x});
                    }
                });
                if(!docs.length) { toast(`⚠️ ไม่มีข้อมูลสาขาเดือน ${monthKey}`,'#f59e0b'); return; }

                const rows = [['สาขา','เดือน','วันที่นับ','รหัสสินค้า','ชื่อสินค้า','ยอดนับ','หน่วย','หมายเหตุ','ผู้นับ','Template']];
                docs.sort((a,b)=>(a.zone||'').localeCompare(b.zone||'')).forEach(doc => {
                    (doc.items||[]).forEach(it => {
                        rows.push([
                            doc.zone||'',
                            doc.month||monthKey,
                            doc.date||'',
                            it.id, it.name,
                            it.balance??0,
                            it.unit||'',
                            it.note||'',
                            doc.countedBy||'',
                            doc.templateName||''
                        ]);
                    });
                });
                const ws = XLSX.utils.aoa_to_sheet(rows);
                ws['!cols'] = [{wch:20},{wch:10},{wch:14},{wch:12},{wch:35},{wch:10},{wch:8},{wch:20},{wch:14},{wch:20}];
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, `สาขา ${monthKey}`);
                XLSX.writeFile(wb, `AllBranch_${monthKey}.xlsx`);
                toast(`✅ Export ${docs.length} สาขา เดือน ${monthKey}`,'#059669');
            } catch(e) { toast('❌ '+e.message,'#ef4444'); }
        };

        window.toggleMonthlyCount = function() {
            const action = monthlyCountOpen ? 'ปิด' : 'เปิด';
            if(!confirm(`ยืนยัน${action}ระบบนับสต๊อกสิ้นเดือน?\n${monthlyCountOpen?'พนักงานจะไม่สามารถนับสต๊อกได้จนกว่า Admin จะเปิดอีกครั้ง':'พนักงานทุกคนจะสามารถเข้าระบบนับสต๊อกได้'}`)) return;
            monthlyCountOpen = !monthlyCountOpen;
            window.monthlyCountOpen = monthlyCountOpen; // sync กลับ window scope ก่อน saveConfig
            saveConfig();
            applyPermissions();
            toast(`${monthlyCountOpen?'🟢 เปิด':'🔴 ปิด'}ระบบนับสต๊อกสิ้นเดือนแล้ว`, monthlyCountOpen?'#059669':'#c2410c');
        };

        // ======== STOCK SHEET TEMPLATES (ใบนับสต๊อกคงเหลือ) ========
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
        window.openBranchMonthlyMenu = async function() {
            const role   = currentUser?.role || 'guest';
            const uname  = (currentUser?.username||'').toUpperCase();
            const isAdm  = role === 'admin';
            const isBTBranch = uname.startsWith('BT') && !uname.startsWith('BT000');

            if(!isAdm && !isBTBranch) {
                toast('⛔ เฉพาะสาขาและ Admin เท่านั้น','#c2410c'); return;
            }

            document.getElementById('dashboardView').classList.add('hidden');
            const c = document.getElementById('toolAppContainer'); c.classList.remove('hidden');

            // หา templates ทั้งหมดที่เป็น branchType
            const tmplEntries = Object.entries(stockSheetTemplates).filter(([id,t])=>t.branchType||t.zone);

            if(tmplEntries.length === 0) {
                c.innerHTML = `
                <div class="tool-header">
                    <h2>🏪 นับสต๊อกสิ้นเดือนสาขา</h2>
                    <button onclick="goToDashboard()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;">🏠 Dashboard</button>
                    <button onclick="closeTool()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;">✕ ปิด</button>
                </div>
                <div style="text-align:center;padding:60px 20px;">
                    <div style="font-size:48px;margin-bottom:16px;">📋</div>
                    <h3 style="color:#475569;">ยังไม่มี Template สาขา</h3>
                    <p style="color:#94a3b8;">Admin กรุณาสร้าง Template ใบนับสต๊อกสาขาใน ⚙️ ตั้งค่า Template ก่อนนะครับ</p>
                </div>`;
                return;
            }

            // ถ้า BT user → หา template ที่ตรงกับตัวเอง
            let userZone = '';
            if(isBTBranch) {
                userZone = (currentUser?.assignedZones||[])[0] || '';
            }

            // โหลด inventoryHistory เดือนปัจจุบัน เช็คว่านับแล้วหรือยัง
            const now      = new Date();
            const monthKey = now.toISOString().slice(0,7);
            let doneMap    = {}; // { zone: doc }
            try {
                const snap = await getDocs(collection(db,'inventoryHistory'));
                snap.forEach(d => {
                    const x = d.data();
                    if(x.month === monthKey && x.type === 'branch') {
                        doneMap[x.zone] = {id: d.id, ...x};
                    }
                });
            } catch(e) { console.error(e); }

            // สร้างการ์ดสาขาจาก templates
            const cards = tmplEntries.map(([tmplId, t]) => {
                const bt = (t.branchType||t.zone||'').toUpperCase();
                // ถ้า BT user เฉพาะ template ที่ตรงกับ zone ตัวเอง
                if(isBTBranch && userZone && !userZone.toUpperCase().startsWith(bt)) return '';

                // หาสาขาที่ใช้ template นี้
                const matchedZones = isAdm
                    ? warehouseList.filter(z => z.toUpperCase().startsWith(bt))
                    : userZone ? [userZone] : [];

                if(!matchedZones.length && !isAdm) return '';

                // ถ้า BT user แสดงแค่ zone ตัวเอง
                const zonesHtml = matchedZones.length ? matchedZones.map(zone => {
                    const done = doneMap[zone];
                    const statusBadge = done
                        ? `<span style="background:#dcfce7;color:#059669;font-size:10px;padding:2px 8px;border-radius:10px;font-weight:700;">✅ นับแล้ว ${done.date||''}</span>`
                        : `<span style="background:#fef9c3;color:#a16207;font-size:10px;padding:2px 8px;border-radius:10px;font-weight:700;">⏳ ยังไม่ได้นับ</span>`;
                    const btnFn = done
                        ? `openBranchMonthlyCountForAdmin('${tmplId}','${zone}')`
                        : `openBranchMonthlyCount('${tmplId}',stockSheetTemplates['${tmplId}'],'${zone}')`;
                    const btnLabel = done ? '📋 ดูผล / แก้ไข' : '▶ เริ่มนับ';
                    const btnColor = done ? '#0891b2' : '#059669';
                    return `
                    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:${done?'#f0fdf4':'#fffbeb'};border-radius:10px;border:1px solid ${done?'#bbf7d0':'#fde68a'};margin-bottom:8px;">
                        <div>
                            <span style="font-weight:700;font-size:13px;color:#1e293b;">📍 ${zone}</span>
                            <span style="margin-left:8px;">${statusBadge}</span>
                        </div>
                        <button onclick="${btnFn}"
                            style="background:${btnColor};color:white;border:none;padding:7px 16px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;white-space:nowrap;">
                            ${btnLabel}
                        </button>
                    </div>`;
                }).join('') : `<div style="color:#94a3b8;font-size:12px;padding:8px 0;">ไม่พบสาขาที่ขึ้นต้นด้วย "${bt}"</div>`;

                return `
                <div style="background:white;border-radius:14px;border:3px solid ${t.color||'#8b5cf6'};padding:20px;margin-bottom:16px;">
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
                        <div style="width:12px;height:12px;border-radius:50%;background:${t.color||'#8b5cf6'};flex-shrink:0;"></div>
                        <div>
                            <div style="font-size:16px;font-weight:800;color:${t.color||'#8b5cf6'};">${t.name}</div>
                            <div style="font-size:11px;color:#64748b;">branchType: <b>${bt}</b> • ${(t.items||[]).length} รายการสินค้า • ${[...new Set((t.items||[]).map(i=>i.group||i.category).filter(Boolean))].length} หมวด</div>
                        </div>
                    </div>
                    ${zonesHtml}
                </div>`;
            }).filter(Boolean).join('');

            const thMonth = now.toLocaleDateString('th-TH',{month:'long',year:'numeric'});

            c.innerHTML = `
            <div class="tool-header no-print">
                <h2>🏪 นับสต๊อกสิ้นเดือนสาขา</h2>
                <div style="display:flex;gap:8px;">
                    <button onclick="goToDashboard()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;">🏠 Dashboard</button>
                    <button onclick="closeTool()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;">✕ ปิด</button>
                </div>
            </div>

            <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:12px;padding:14px 18px;margin-bottom:20px;">
                <div style="font-size:13px;font-weight:700;color:#7c3aed;">📅 เดือน: ${thMonth}</div>
                <div style="font-size:12px;color:#6d28d9;margin-top:4px;">เลือกสาขาที่ต้องการนับสต๊อก หรือดูผลที่นับแล้ว</div>
            </div>

            ${cards || '<div style="text-align:center;padding:40px;color:#94a3b8;">ไม่พบสาขาที่ตรงกับ Template ที่ตั้งค่าไว้</div>'}
            `;
        };

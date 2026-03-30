// analytics.js — TTGPlus (extracted)

        // ======== INVENTORY ANALYSIS ========
        window.openInventoryAnalysis=async function(){
            document.getElementById('dashboardView').classList.add('hidden');
            const c=document.getElementById('toolAppContainer');c.classList.remove('hidden');
            const visibleZones=getVisibleWarehouses();

            c.innerHTML=`
            <div class="tool-header no-print">
                <h2>📈 วิเคราะห์สต๊อกคงเหลือ</h2>
                <div style="display:flex;gap:8px;">
                    <button onclick="exportInventoryExcel()" style="background:var(--success);color:white;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-weight:bold;">📥 Excel</button>
                    <button onclick="exportInventoryPDF()" style="background:#7c3aed;color:white;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-weight:bold;">🖨️ PDF</button>
                    <button onclick="openInventoryCheck()" style="background:#7c3aed;color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:bold;">📋 ใบนับสต๊อก</button>
                    <button onclick="goToDashboard()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;">🏠 Dashboard</button><button onclick="closeTool()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;">✕ ปิด</button>
                </div>
            </div>

            <div style="display:flex;gap:15px;margin-bottom:20px;flex-wrap:wrap;" class="no-print">
                <div class="input-group" style="min-width:220px;"><label>📦 เลือกคลัง</label>
                    <select id="anaZone" onchange="loadInventoryAnalysis()" style="width:100%;border:none;font-weight:bold;outline:none;">
                        <option value="">— ทุกคลัง —</option>
                        ${visibleZones.map(z=>`<option value="${z}">${z}</option>`).join('')}
                    </select>
                </div>
                <div class="input-group" style="min-width:220px;"><label>🍎 เลือกสินค้า</label>
                    <select id="anaProd" onchange="loadInventoryAnalysis()" style="width:100%;border:none;font-weight:bold;outline:none;">
                        <option value="">— ทุกสินค้า —</option>
                        ${allProducts.map(p=>`<option value="${p.id}">${p.id} - ${p.name}</option>`).join('')}
                    </select>
                </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px;">
                <div style="background:white;border-radius:14px;padding:24px;border:1px solid #e2e8f0;">
                    <h4 style="margin:0 0 16px;color:var(--primary-dark);">📊 ยอดคงเหลือ (Trend)</h4>
                    <div class="chart-wrap" style="height:200px;"><canvas id="balanceChart" height="200"></canvas></div>
                </div>
                <div style="background:white;border-radius:14px;padding:24px;border:1px solid #e2e8f0;">
                    <h4 style="margin:0 0 16px;color:var(--primary-dark);">📉 ยอดที่ใช้ไปแต่ละรอบ</h4>
                    <div class="chart-wrap" style="height:200px;"><canvas id="usageChart" height="200"></canvas></div>
                </div>
            </div>

            <div style="background:white;border-radius:14px;padding:24px;border:1px solid #e2e8f0;">
                <h4 style="margin:0 0 16px;color:var(--primary-dark);">📋 ตารางประวัติการนับคงเหลือ</h4>
                <div id="invHistoryTable"><p style="color:#94a3b8;text-align:center;padding:20px;">กำลังโหลด...</p></div>
            </div>`;

            await loadInventoryAnalysis();
        };

        let _invBalChart=null, _invUseChart=null;

        window.loadInventoryAnalysis=async function(){
            const zone=document.getElementById('anaZone')?.value||'';
            const prodId=document.getElementById('anaProd')?.value||'';

            const snap=await getDocs(collection(db,'inventoryHistory'));
            let sheets=[];
            snap.forEach(d=>sheets.push({id:d.id,...d.data()}));
            if(zone) sheets=sheets.filter(s=>s.zone===zone);
            sheets.sort((a,b)=>a.timestamp-b.timestamp);

            // กรองตามสินค้า
            const filteredItems=[];
            sheets.forEach(s=>{
                (s.items||[]).forEach(it=>{
                    if(!prodId||it.id===prodId){
                        filteredItems.push({date:s.date,zone:s.zone,countedBy:s.countedBy,recordedBy:s.recordedBy||'',...it,sheetId:s.id});
                    }
                });
            });

            // สร้าง label-balance-usage arrays
            const labels=filteredItems.map(it=>`${it.date}
${it.zone}`);
            const balances=filteredItems.map(it=>it.balance||0);
            const usages=filteredItems.map((it,i)=>{
                if(i===0)return 0;
                const prev=filteredItems[i-1];
                if(prev.id!==it.id||prev.zone!==it.zone)return 0;
                return Math.max(0,(prev.balance||0)-(it.balance||0));
            });

            // render charts
            if(_invBalChart)_invBalChart.destroy();
            if(_invUseChart)_invUseChart.destroy();
            const bc=document.getElementById('balanceChart');
            const uc=document.getElementById('usageChart');
            if(bc&&labels.length){
                bc.style.height='200px'; bc.style.maxHeight='200px';
                _invBalChart=new Chart(bc,{type:'line',options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}},data:{labels,datasets:[{
                    label:'ยอดคงเหลือ',data:balances,
                    borderColor:'#3b82f6',backgroundColor:'rgba(59,130,246,0.08)',
                    borderWidth:2,tension:0.3,fill:true,pointRadius:4,
                }]},options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,grid:{color:'#f1f5f9'}},x:{grid:{display:false},ticks:{maxRotation:45}}}}});
            } else if(bc){bc.parentElement.innerHTML='<p style="color:#94a3b8;text-align:center;padding:40px;">ยังไม่มีข้อมูล</p>';}

            if(uc&&labels.length){
                uc.style.height='200px'; uc.style.maxHeight='200px';
                _invUseChart=new Chart(uc,{type:'bar',options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}},data:{labels,datasets:[{
                    label:'ใช้ไป',data:usages,
                    backgroundColor:'rgba(239,68,68,0.15)',borderColor:'#ef4444',
                    borderWidth:2,borderRadius:6,
                }]},options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,grid:{color:'#f1f5f9'}},x:{grid:{display:false},ticks:{maxRotation:45}}}}});
            } else if(uc){uc.parentElement.innerHTML='<p style="color:#94a3b8;text-align:center;padding:40px;">ยังไม่มีข้อมูล</p>';}

            // render table
            const tbl=document.getElementById('invHistoryTable');
            if(!tbl)return;
            if(!filteredItems.length){tbl.innerHTML='<p style="color:#94a3b8;text-align:center;padding:40px;">ยังไม่มีข้อมูล — บันทึกใบนับสต๊อกคงเหลือก่อนเลยครับ</p>';return;}
            tbl.innerHTML=`<table style="width:100%;border-collapse:collapse;">
                <thead><tr style="background:#f8fafc;">
                    <th style="padding:10px;text-align:left;font-size:12px;color:#64748b;">วันที่</th>
                    <th style="padding:10px;text-align:left;font-size:12px;color:#64748b;">คลัง</th>
                    <th style="padding:10px;text-align:left;font-size:12px;color:#64748b;">รหัส</th>
                    <th style="padding:10px;text-align:left;font-size:12px;color:#64748b;">ชื่อสินค้า</th>
                    <th style="padding:10px;text-align:center;font-size:12px;color:#64748b;">คงเหลือ</th>
                    <th style="padding:10px;text-align:center;font-size:12px;color:#64748b;">หน่วย</th>
                    <th style="padding:10px;text-align:center;font-size:12px;color:#64748b;">ใช้ไปจากรอบก่อน</th>
                    <th style="padding:10px;text-align:left;font-size:12px;color:#64748b;">หมายเหตุ</th>
                    <th style="padding:10px;text-align:left;font-size:12px;color:#64748b;">ผู้นับ</th>
                    <th style="padding:10px;text-align:center;font-size:12px;color:#64748b;"></th>
                </tr></thead>
                <tbody>${filteredItems.map((it,i)=>{
                    const usage=usages[i];
                    const usageColor=usage>0?'var(--danger)':usage<0?'var(--success)':'#94a3b8';
                    const usageText=usage>0?`-${usage}`:usage<0?`+${Math.abs(usage)}`:'—';
                    return `<tr style="border-top:1px solid #f1f5f9;">
                        <td style="padding:10px;font-size:13px;">${it.date}</td>
                        <td style="padding:10px;font-size:13px;color:#64748b;">${it.zone}</td>
                        <td style="padding:10px;font-weight:bold;">${it.id}</td>
                        <td style="padding:10px;color:#475569;font-size:13px;">${it.name}</td>
                        <td style="padding:10px;text-align:center;font-weight:bold;color:var(--success);font-size:15px;">${it.balance??'-'}</td>
                        <td style="padding:10px;text-align:center;color:#64748b;font-size:12px;">${it.unit||''}</td>
                        <td style="padding:10px;text-align:center;font-weight:bold;color:${usageColor};">${i===0?'—':usageText}</td>
                        <td style="padding:10px;color:#64748b;font-size:12px;">${it.note||'-'}</td>
                        <td style="padding:10px;color:#64748b;font-size:12px;">${it.countedBy||'-'}</td>
                        <td style="padding:10px;text-align:center;">${currentUser?.role==='admin'?`<button onclick="deleteInventoryItem('${it.sheetId||''}','${it.id||''}')" style="background:#fef2f2;color:#ef4444;border:1px solid #fecaca;padding:3px 8px;border-radius:6px;cursor:pointer;font-size:11px;">🗑️</button>`:''}</td>
                    </tr>`;}).join('')}
                </tbody>
            </table>`;

            window._invExportData=filteredItems.map((it,i)=>({
                วันที่:it.date,คลัง:it.zone,รหัส:it.id,ชื่อสินค้า:it.name,
                คงเหลือ:it.balance??'',หน่วย:it.unit||'',
                ใช้ไปจากรอบก่อน:i===0?'':usages[i],
                หมายเหตุ:it.note||'',ผู้นับ:it.countedBy||'',
                ผู้บันทึก:it.recordedBy||it.countedBy||'',
            }));
        };

        window.deleteInventoryItem = async function(sheetId, productId) {
            if(currentUser?.role==='admin' && !confirm('⚠️ แอดมิน — ยืนยันลบรายการนี้? การลบจะไม่สามารถกู้คืนได้')) return;
            else if(currentUser?.role!=='admin' && !confirm('ยืนยันลบรายการนี้?')) return;
            try {
                const snap = await getDoc(doc(db,'inventoryHistory',sheetId));
                if(!snap.exists()) { toast('❌ ไม่พบข้อมูล','#c2410c'); return; }
                const sheet = snap.data();
                const newItems = (sheet.items||[]).filter(it=>it.id!==productId);
                if(newItems.length===0) {
                    await deleteDoc(doc(db,'inventoryHistory',sheetId));
                } else {
                    await updateDoc(doc(db,'inventoryHistory',sheetId),{items:newItems});
                }
                toast('🗑️ ลบเรียบร้อย','#059669');
                const zEl=document.getElementById('invZoneFilter');
                const pEl=document.getElementById('invProdFilter');
                window.loadInvHistory?.(zEl?.value||'', pEl?.value||'');
            } catch(e) { toast('❌ ลบไม่สำเร็จ','#c2410c'); }
        };

        window.exportInventoryExcel=function(){
            if(!window._invExportData?.length){toast('❌ ไม่มีข้อมูล','#c2410c');return;}
            // ใช้ exportUnit ของแต่ละสินค้าโดยตรง ไม่ต้องถาม
            let data=window._invExportData.map(r=>{
                const pid=r['รหัส']||r['รหัสสินค้า']||r['id']||'';
                const p=allProducts.find(x=>x.id===pid);
                const targetUnit=p?.exportUnit||(p?.units||[])[0]?.name||'';
                if(!targetUnit) return {...r};
                const units=p?.units||[];
                const targetIdx=units.findIndex(u=>u.name===targetUnit);
                const srcIdx=0;
                let converted=r['ยอดคงเหลือ']||r['balance']||0;
                if(targetIdx>0 && srcIdx!==targetIdx){
                    for(let i=srcIdx;i<targetIdx;i++) converted*=(units[i]?.rate||1);
                    converted=Math.round(converted*100)/100;
                } else if(targetIdx<0){
                    // หน่วยไม่ตรง ใช้ค่าเดิม
                }
                const newR={...r};
                const balKey=Object.keys(r).find(k=>k.includes('ยอด')||k.includes('balance'));
                if(balKey) newR[balKey]=converted;
                if('หน่วย' in newR) newR['หน่วย']=targetUnit||newR['หน่วย'];
                return newR;
            });
            const rows=[Object.keys(data[0]),...data.map(r=>Object.values(r))];
            const ws=XLSX.utils.aoa_to_sheet(rows),wb=XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb,ws,'InventoryHistory');
            XLSX.writeFile(wb,`Inventory_${new Date().toLocaleDateString('th-TH').replace(/\//g,'-')}.xlsx`);
            toast('📥 Export เรียบร้อย','#10b981');
        };
        // doExportInventoryWithUnit ยังคงไว้ backward compat
        window.doExportInventoryWithUnit=function(){
            document.getElementById('exportUnitModal')?.remove();
            exportInventoryExcel();
        };

        // ======== MIN/MAX & PURCHASE ORDER ========

        window.renderMinMaxTable=function(forceZone){
            const zone=forceZone||document.getElementById('selectZoneMap')?.value||warehouseList[0]||'';
            const c=document.getElementById('minMaxContainer');
            const label=document.getElementById('minMaxZoneLabel');
            if(!c||!zone)return;

            // render zone tabs
            const tabs=document.getElementById('minMaxZoneTabs');
            if(tabs){
                tabs.innerHTML=warehouseList.map(z=>{
                    const hasData=allProducts.some(p=>{
                        const key=`${z}__${p.id}`;
                        const mm=productMinMax[key];
                        return mm&&(mm.min>0||mm.max>0);
                    });
                    const isActive=z===zone;
                    return `<button onclick="renderMinMaxTable('${z}')"
                        style="padding:7px 16px;border-radius:8px;border:2px solid ${isActive?'var(--primary-dark)':'#e2e8f0'};
                        background:${isActive?'var(--primary-dark)':'white'};color:${isActive?'white':'#475569'};
                        cursor:pointer;font-size:12px;font-weight:bold;position:relative;">
                        ${z}${hasData?'<span style="position:absolute;top:-4px;right:-4px;width:8px;height:8px;border-radius:50%;background:var(--success);"></span>':''}
                    </button>`;
                }).join('');
            }

            if(label) label.innerHTML=`<b style="color:var(--primary-dark);">📦 ${zone}</b> — กรอกค่าแล้วกด "บันทึก Min/Max คลังนี้" ก่อนเปลี่ยนคลัง`;

            const zoneProds=getZoneProducts(zone);
            if(!zoneProds.length){c.innerHTML='<p style="color:#94a3b8;font-size:13px;">ยังไม่มีสินค้าในคลังนี้ — จับคู่สินค้าเข้าสู่โซนก่อนนะครับ</p>';return;}
            c.innerHTML=`<table style="width:100%;border-collapse:collapse;">
                <thead><tr style="background:#f8fafc;">
                    <th style="padding:10px;text-align:left;font-size:12px;color:#64748b;">รหัส</th>
                    <th style="padding:10px;text-align:left;font-size:12px;color:#64748b;">ชื่อสินค้า</th>
                    <th style="padding:10px;text-align:left;font-size:12px;color:#64748b;">หน่วย</th>
                    <th style="padding:10px;text-align:center;font-size:12px;color:#ef4444;">🔴 Min (ต่ำสุด)</th>
                    <th style="padding:10px;text-align:center;font-size:12px;color:#10b981;">🟢 Max (เป้าหมาย)</th>
                </tr></thead>
                <tbody>${zoneProds.map(p=>{
                    const key=`${zone}__${p.id}`;
                    const mm=productMinMax[key]||{min:'',max:''};
                    const u=(p.units||[{name:p.unit||''}])[0]?.name||'';
                    return `<tr style="border-top:1px solid #f1f5f9;">
                        <td style="padding:10px;font-weight:bold;font-size:13px;">${p.id}</td>
                        <td style="padding:10px;color:#475569;font-size:13px;">${p.name}</td>
                        <td style="padding:10px;color:#94a3b8;font-size:12px;">${u}</td>
                        <td style="padding:10px;text-align:center;">
                            <input type="number" id="mm_min_${p.id}" value="${mm.min||''}" min="0" placeholder="0"
                                style="width:80px;padding:8px;border:2px solid #fca5a5;border-radius:8px;text-align:center;font-weight:bold;font-size:14px;outline:none;">
                        </td>
                        <td style="padding:10px;text-align:center;">
                            <input type="number" id="mm_max_${p.id}" value="${mm.max||''}" min="0" placeholder="0"
                                style="width:80px;padding:8px;border:2px solid #6ee7b7;border-radius:8px;text-align:center;font-weight:bold;font-size:14px;outline:none;">
                        </td>
                    </tr>`;
                }).join('')}</tbody>
            </table>`;
            // store current zone for saveAllMinMax to use
            window._currentMinMaxZone=zone;
        };

        window.saveAllMinMax=function(){
            const zone=window._currentMinMaxZone||document.getElementById('selectZoneMap')?.value||'';
            if(!zone){toast('⚠️ กรุณาเลือกคลังก่อน','#c2410c');return;}
            const zoneProds=getZoneProducts(zone);
            let count=0;
            zoneProds.forEach(p=>{
                const minEl=document.getElementById(`mm_min_${p.id}`);
                const maxEl=document.getElementById(`mm_max_${p.id}`);
                const minV=parseFloat(minEl?.value)||0;
                const maxV=parseFloat(maxEl?.value)||0;
                if(minV>0||maxV>0){
                    const key=`${zone}__${p.id}`;
                    productMinMax[key]={min:minV,max:maxV,zone,productId:p.id};
                    count++;
                }
            });
            saveConfig();
            toast(`✅ บันทึก Min/Max ${count} รายการ (${zone}) สำเร็จ`,'#059669');
            renderMinMaxTable(zone); // refresh tabs + green dots
        };

        // ---- Purchase Order Page ----
        window.openPurchaseOrder=async function(){
            document.getElementById('dashboardView').classList.add('hidden');
            const c=document.getElementById('toolAppContainer');c.classList.remove('hidden');
            await loadCountData();
            // โหลด inventory ล่าสุดของแต่ละคลัง
            const invSnap=await getDocs(collection(db,'inventoryHistory'));
            const latestInv={};
            invSnap.forEach(d=>{
                const data=d.data();
                if(!latestInv[data.zone]||data.timestamp>latestInv[data.zone].timestamp) latestInv[data.zone]=data;
            });

            const visibleZones=getVisibleWarehouses();

            // สร้างรายการสินค้าที่ต้องสั่ง
            const orderItems=[];
            visibleZones.forEach(zone=>{
                const zoneProds=getZoneProducts(zone);
                zoneProds.forEach(p=>{
                    const key=`${zone}__${p.id}`;
                    const mm=productMinMax[key];
                    if(!mm||(!mm.min&&!mm.max))return;
                    // หายอดคงเหลือล่าสุด (จาก inventoryHistory ก่อน แล้ว fallback countData)
                    const invItem=latestInv[zone]?.items?.find(it=>it.id===p.id);
                    const balance=invItem?.balance??countData[p.id]?.total??0;
                    const u=(p.units||[{name:p.unit||''}])[0]?.name||'';
                    const needOrder=mm.min>0&&balance<=mm.min;
                    const suggestQty=mm.max>0?Math.max(0,mm.max-balance):0;
                    const status=balance<=mm.min?'🔴 ต่ำกว่า Min':balance<=(mm.min*1.2)?'🟡 ใกล้ถึง Min':'🟢 ปกติ';
                    orderItems.push({zone,id:p.id,name:p.name,unit:u,balance,min:mm.min,max:mm.max,suggestQty,needOrder,status});
                });
            });

            const urgent=orderItems.filter(it=>it.needOrder);
            const warning=orderItems.filter(it=>!it.needOrder&&it.status.includes('🟡'));
            const normal=orderItems.filter(it=>it.status.includes('🟢'));

            c.innerHTML=`
            <div class="tool-header no-print">
                <h2>🛒 สรุปยอดสั่งซื้อ</h2>
                <div style="display:flex;gap:8px;">
                    <button onclick="exportPurchasePDF()" style="background:#ef4444;color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:bold;">🖨️ PDF ใบสั่งซื้อ</button>
                    <button onclick="exportPurchaseExcel()" style="background:var(--success);color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:bold;">📥 Excel</button>
                    <button onclick="exportTRCloudFormat()" style="background:#7c3aed;color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:bold;">🔗 TRCloud Format</button>
                    <button onclick="goToDashboard()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;">🏠 Dashboard</button><button onclick="closeTool()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;">✕ ปิด</button>
                </div>
            </div>

            <!-- summary badges -->
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px;">
                <div style="background:#fef2f2;border:2px solid #fca5a5;border-radius:14px;padding:20px;text-align:center;">
                    <div style="font-size:32px;font-weight:bold;color:#ef4444;">${urgent.length}</div>
                    <div style="color:#ef4444;font-weight:bold;font-size:13px;">🔴 ต้องสั่งด่วน (ต่ำกว่า Min)</div>
                </div>
                <div style="background:#fffbeb;border:2px solid #fcd34d;border-radius:14px;padding:20px;text-align:center;">
                    <div style="font-size:32px;font-weight:bold;color:#f59e0b;">${warning.length}</div>
                    <div style="color:#f59e0b;font-weight:bold;font-size:13px;">🟡 ใกล้ถึง Min (เฝ้าระวัง)</div>
                </div>
                <div style="background:#f0fdf4;border:2px solid #6ee7b7;border-radius:14px;padding:20px;text-align:center;">
                    <div style="font-size:32px;font-weight:bold;color:#10b981;">${normal.length}</div>
                    <div style="color:#10b981;font-weight:bold;font-size:13px;">🟢 สต๊อกปกติ</div>
                </div>
            </div>

            <!-- order table -->
            <div style="background:white;border-radius:14px;border:1px solid #e2e8f0;overflow:hidden;">
                <div style="padding:16px 20px;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;">
                    <h4 style="margin:0;">รายการสินค้า</h4>
                    <div style="display:flex;gap:8px;">
                        <button onclick="filterOrder('all')" id="obtn_all" style="padding:6px 14px;border-radius:8px;border:2px solid var(--primary-dark);background:var(--primary-dark);color:white;cursor:pointer;font-size:12px;font-weight:bold;">ทั้งหมด</button>
                        <button onclick="filterOrder('urgent')" id="obtn_urgent" style="padding:6px 14px;border-radius:8px;border:2px solid #ef4444;background:white;color:#ef4444;cursor:pointer;font-size:12px;font-weight:bold;">ต้องสั่งด่วน</button>
                    </div>
                </div>
                <div style="overflow-x:auto;">
                    <table style="width:100%;border-collapse:collapse;" id="orderTable">
                        <thead><tr style="background:#f8fafc;">
                            <th style="padding:12px;text-align:left;font-size:12px;color:#64748b;">สถานะ</th>
                            <th style="padding:12px;text-align:left;font-size:12px;color:#64748b;">คลัง</th>
                            <th style="padding:12px;text-align:left;font-size:12px;color:#64748b;">รหัส</th>
                            <th style="padding:12px;text-align:left;font-size:12px;color:#64748b;">ชื่อสินค้า</th>
                            <th style="padding:12px;text-align:center;font-size:12px;color:#64748b;">คงเหลือ</th>
                            <th style="padding:12px;text-align:center;font-size:12px;color:#ef4444;">Min</th>
                            <th style="padding:12px;text-align:center;font-size:12px;color:#10b981;">Max</th>
                            <th style="padding:12px;text-align:center;font-size:12px;color:#7c3aed;">แนะนำสั่ง</th>
                            <th style="padding:12px;text-align:center;font-size:12px;color:#64748b;">หน่วย</th>
                            <th style="padding:12px;text-align:center;font-size:12px;color:#64748b;">ยอดสั่งจริง</th>
                        </tr></thead>
                        <tbody>${[...urgent,...warning,...normal].map(it=>`
                        <tr class="order-row" data-urgent="${it.needOrder}" style="border-top:1px solid #f1f5f9;${it.needOrder?'background:#fff5f5;':''}">
                            <td style="padding:12px;">${it.status}</td>
                            <td style="padding:12px;font-size:12px;color:#64748b;">${it.zone}</td>
                            <td style="padding:12px;font-weight:bold;font-size:13px;">${it.id}</td>
                            <td style="padding:12px;color:#475569;font-size:13px;">${it.name}</td>
                            <td style="padding:12px;text-align:center;font-weight:bold;font-size:15px;color:${it.needOrder?'#ef4444':'var(--success)'};">${it.balance}</td>
                            <td style="padding:12px;text-align:center;color:#ef4444;font-weight:bold;">${it.min||'-'}</td>
                            <td style="padding:12px;text-align:center;color:#10b981;font-weight:bold;">${it.max||'-'}</td>
                            <td style="padding:12px;text-align:center;font-weight:bold;color:#7c3aed;font-size:15px;">${it.suggestQty||'-'}</td>
                            <td style="padding:12px;text-align:center;color:#64748b;font-size:12px;">${it.unit}</td>
                            <td style="padding:12px;text-align:center;">
                                <input type="number" id="order_${it.zone}_${it.id}" value="${it.suggestQty||''}" min="0" placeholder="0"
                                    style="width:80px;padding:7px;border:2px solid #e2e8f0;border-radius:8px;text-align:center;font-weight:bold;font-size:14px;outline:none;">
                            </td>
                        </tr>`).join('')}</tbody>
                    </table>
                </div>
            </div>`;

            window._orderItems=[...urgent,...warning,...normal];
        };

        window.filterOrder=function(mode){
            document.querySelectorAll('.order-row').forEach(r=>{
                r.style.display=(mode==='all'||r.dataset.urgent==='true')?'':'none';
            });
            document.getElementById('obtn_all').style.background=mode==='all'?'var(--primary-dark)':'white';
            document.getElementById('obtn_all').style.color=mode==='all'?'white':'var(--primary-dark)';
            document.getElementById('obtn_urgent').style.background=mode==='urgent'?'#ef4444':'white';
            document.getElementById('obtn_urgent').style.color=mode==='urgent'?'white':'#ef4444';
        };

        window.exportPurchaseExcel=function(){
            if(!window._orderItems?.length){toast('❌ ไม่มีข้อมูล','#c2410c');return;}
            const rows=[['สถานะ','คลัง','รหัส','ชื่อสินค้า','คงเหลือ','Min','Max','แนะนำสั่ง','ยอดสั่งจริง','หน่วย']];
            window._orderItems.forEach(it=>{
                const actual=document.getElementById(`order_${it.zone}_${it.id}`)?.value||it.suggestQty||0;
                rows.push([it.status,it.zone,it.id,it.name,it.balance,it.min||'',it.max||'',it.suggestQty||'',actual,it.unit]);
            });
            const ws=XLSX.utils.aoa_to_sheet(rows),wb=XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb,ws,'PurchaseOrder');
            XLSX.writeFile(wb,`PurchaseOrder_${new Date().toLocaleDateString('th-TH').replace(/\//g,'-')}.xlsx`);
        };

        // ---- Dashboard alert badges ----
        window.renderStockAlerts=async function(){
            await loadCountData();
            const invSnap=await getDocs(collection(db,'inventoryHistory'));
            const latestInv={};
            invSnap.forEach(d=>{const data=d.data();if(!latestInv[data.zone]||data.timestamp>latestInv[data.zone].timestamp)latestInv[data.zone]=data;});
            let urgentCount=0;
            getVisibleWarehouses().forEach(zone=>{
                getZoneProducts(zone).forEach(p=>{
                    const key=`${zone}__${p.id}`;
                    const mm=productMinMax[key];
                    if(!mm||!mm.min)return;
                    const invItem=latestInv[zone]?.items?.find(it=>it.id===p.id);
                    const balance=invItem?.balance??countData[p.id]?.total??0;
                    if(balance<=mm.min)urgentCount++;
                });
            });
            const alertEl=document.getElementById('dashAlertBanner');
            if(!alertEl)return;
            if(urgentCount>0){
                alertEl.innerHTML=`<div style="background:#fef2f2;border:2px solid #fca5a5;border-radius:14px;padding:16px 24px;display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
                    <div style="display:flex;align-items:center;gap:12px;">
                        <span style="font-size:24px;">🔴</span>
                        <div><b style="color:#ef4444;font-size:15px;">สินค้า ${urgentCount} รายการ ต่ำกว่า Min!</b><br>
                        <span style="color:#64748b;font-size:13px;">ควรสั่งซื้อเพิ่มโดยด่วน</span></div>
                    </div>
                    <button onclick="openPurchaseOrder()" style="background:#ef4444;color:white;border:none;padding:10px 20px;border-radius:10px;cursor:pointer;font-weight:bold;">🛒 ดูใบสั่งซื้อ</button>
                </div>`;
            } else {
                alertEl.innerHTML='';
            }
        };

        // ======== PDF PURCHASE ORDER ========
        window.exportPurchasePDF=function(){
            if(!window._orderItems?.length){toast('❌ ไม่มีข้อมูล','#c2410c');return;}
            const urgentOnly=window._orderItems.filter(it=>it.needOrder||it.status.includes('🟡'));
            if(!urgentOnly.length){toast('✅ ไม่มีสินค้าที่ต้องสั่ง','#059669');return;}

            const now=new Date();
            const dateStr=now.toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'});
            const poNumber=`PO-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;

            const rows=urgentOnly.map((it,i)=>{
                const actual=document.getElementById(`order_${it.zone}_${it.id}`)?.value||it.suggestQty||0;
                return `<tr style="${i%2===0?'background:#f8fafc':''}">
                    <td style="padding:10px;text-align:center;color:#64748b;">${i+1}</td>
                    <td style="padding:10px;font-weight:bold;">${it.id}</td>
                    <td style="padding:10px;">${it.name}</td>
                    <td style="padding:10px;text-align:center;color:#64748b;">${it.zone}</td>
                    <td style="padding:10px;text-align:center;color:#ef4444;font-weight:bold;">${it.balance}</td>
                    <td style="padding:10px;text-align:center;color:#10b981;font-weight:bold;">${it.min||'-'}</td>
                    <td style="padding:10px;text-align:center;font-weight:bold;color:#7c3aed;font-size:16px;">${actual}</td>
                    <td style="padding:10px;text-align:center;color:#64748b;">${it.unit}</td>
                    <td style="padding:10px;"></td>
                </tr>`;
            }).join('');

            const html=`<!DOCTYPE html><html><head><meta charset="UTF-8">
            <style>
                body{font-family:'Sarabun',sans-serif;margin:0;padding:30px;color:#1e293b;font-size:13px;}
                .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:30px;padding-bottom:20px;border-bottom:3px solid #1e293b;}
                .company{font-size:22px;font-weight:bold;color:#1e293b;}
                .po-badge{background:#1e293b;color:white;padding:10px 20px;border-radius:10px;text-align:right;}
                .po-badge .po-num{font-size:16px;font-weight:bold;}
                .po-badge .po-date{font-size:12px;color:#94a3b8;margin-top:4px;}
                table{width:100%;border-collapse:collapse;margin-top:20px;}
                thead tr{background:#1e293b;color:white;}
                th{padding:10px;text-align:left;font-size:12px;}
                td{border-bottom:1px solid #e2e8f0;vertical-align:middle;}
                .footer{margin-top:40px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:30px;}
                .sign-box{text-align:center;padding-top:50px;border-top:1px solid #334155;}
                .sign-label{font-size:11px;color:#64748b;}
                @media print{body{padding:15px;}}
            </style>
            <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap" rel="stylesheet">
            </head><body>
            <div class="header">
                <div>
                    <div class="company">🏢 TTGPlus</div>
                    <div style="color:#64748b;margin-top:4px;font-size:12px;">ใบสั่งซื้อสินค้า (Purchase Order)</div>
                </div>
                <div class="po-badge">
                    <div class="po-num">${poNumber}</div>
                    <div class="po-date">วันที่: ${dateStr}</div>
                    <div class="po-date">จัดทำโดย: ${window.currentUser?.name||''}</div>
                </div>
            </div>
            <table>
                <thead><tr>
                    <th style="width:40px;text-align:center;">#</th>
                    <th style="width:100px;">รหัสสินค้า</th>
                    <th>ชื่อสินค้า</th>
                    <th style="width:100px;text-align:center;">คลัง</th>
                    <th style="width:70px;text-align:center;">คงเหลือ</th>
                    <th style="width:60px;text-align:center;">Min</th>
                    <th style="width:80px;text-align:center;">จำนวนสั่ง</th>
                    <th style="width:60px;text-align:center;">หน่วย</th>
                    <th style="width:100px;">หมายเหตุ</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>
            <div style="margin-top:20px;padding:15px;background:#f8fafc;border-radius:8px;font-size:12px;color:#64748b;">
                รายการทั้งหมด: <b>${urgentOnly.length} รายการ</b> &nbsp;|&nbsp; จัดทำจากระบบ TTGPlus
            </div>
            <div class="footer">
                <div class="sign-box"><div class="sign-label">ผู้จัดทำ / Prepared by</div></div>
                <div class="sign-box"><div class="sign-label">ผู้อนุมัติ / Approved by</div></div>
                <div class="sign-box"><div class="sign-label">ผู้รับสินค้า / Received by</div></div>
            </div>
            </body></html>`;

            const w=window.open('','_blank','width=900,height=700');
            w.document.write(html);
            w.document.close();
            setTimeout(()=>w.print(),800);
        };

        // ======== TRCLOUD PR FORMAT - OPEN MODAL FIRST ========
        window.exportTRCloudFormat=function(){
            if(!window._orderItems?.length){toast('❌ ไม่มีข้อมูล','#c2410c');return;}
            const items=window._orderItems.filter(it=>it.needOrder||it.status.includes('🟡'));
            if(!items.length){toast('✅ ไม่มีสินค้าที่ต้องสั่ง','#059669');return;}

            const existing=document.getElementById('trcloudModal');if(existing)existing.remove();
            const now=new Date();
            const todayISO=now.toISOString().slice(0,10);
            const modal=document.createElement('div');modal.className='modal-overlay';modal.id='trcloudModal';
            modal.innerHTML=`<div class="modal-box" style="max-width:560px;">
                <h3 style="margin-top:0;">🔗 ตั้งค่า PR สำหรับ TRCloud</h3>
                <p style="color:#64748b;font-size:13px;margin-bottom:16px;">กรอกข้อมูลหัวเอกสาร PR ก่อน Export — ระบบจะสร้าง Excel ตรง format TRCloud</p>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
                    <div><label style="font-size:11px;font-weight:bold;color:#475569;display:block;margin-bottom:4px;">หมวดหมู่</label>
                        <input id="tr_cat" placeholder="เช่น วัตถุดิบ" style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:8px;box-sizing:border-box;font-size:13px;"></div>
                    <div><label style="font-size:11px;font-weight:bold;color:#475569;display:block;margin-bottom:4px;">แผนก</label>
                        <input id="tr_dept" placeholder="เช่น ครัวกลาง" style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:8px;box-sizing:border-box;font-size:13px;"></div>
                    <div><label style="font-size:11px;font-weight:bold;color:#475569;display:block;margin-bottom:4px;">โครงการ</label>
                        <input id="tr_proj" placeholder="เช่น TingTing 2026" style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:8px;box-sizing:border-box;font-size:13px;"></div>
                    <div><label style="font-size:11px;font-weight:bold;color:#475569;display:block;margin-bottom:4px;">คลังสินค้า (TRCloud)</label>
                        <input id="tr_wh" placeholder="เช่น Main Warehouse" style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:8px;box-sizing:border-box;font-size:13px;"></div>
                    <div><label style="font-size:11px;font-weight:bold;color:#475569;display:block;margin-bottom:4px;">รหัสคู่ค้า (Supplier)</label>
                        <input id="tr_sup_code" placeholder="รหัสใน TRCloud" style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:8px;box-sizing:border-box;font-size:13px;"></div>
                    <div><label style="font-size:11px;font-weight:bold;color:#475569;display:block;margin-bottom:4px;">ชื่อคู่ค้า / บริษัท</label>
                        <input id="tr_sup_name" placeholder="ชื่อ Supplier" style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:8px;box-sizing:border-box;font-size:13px;"></div>
                    <div><label style="font-size:11px;font-weight:bold;color:#475569;display:block;margin-bottom:4px;">วันที่เอกสาร</label>
                        <input id="tr_doc_date_txt" type="text" placeholder="dd/mm/yyyy" maxlength="10"
    value="${todayISO.split('-').reverse().join('/')}"
    oninput="formatDateInput(this,'tr_doc_date')"
    style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:8px;box-sizing:border-box;font-size:13px;">
<input type="hidden" id="tr_doc_date" value="${todayISO}"></div>
                    <div><label style="font-size:11px;font-weight:bold;color:#475569;display:block;margin-bottom:4px;">กำหนดส่งของ</label>
                        <input id="tr_due_date_txt" type="text" placeholder="dd/mm/yyyy" maxlength="10"
    value="${todayISO.split('-').reverse().join('/')}"
    oninput="formatDateInput(this,'tr_due_date')"
    style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:8px;box-sizing:border-box;font-size:13px;">
<input type="hidden" id="tr_due_date" value="${todayISO}"></div>
                </div>
                <div style="margin-bottom:16px;"><label style="font-size:11px;font-weight:bold;color:#475569;display:block;margin-bottom:4px;">หมายเหตุ</label>
                    <textarea id="tr_note" placeholder="หมายเหตุ (ถ้ามี)" rows="2" style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:8px;box-sizing:border-box;font-size:13px;resize:none;"></textarea>
                </div>
                <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:12px;color:#0369a1;">
                    💡 จะ Export เฉพาะสินค้าที่ <b>ต้องสั่ง ${items.length} รายการ</b> — เลขที่เอกสาร PR จะออก AUTO ใน TRCloud
                </div>
                <div style="display:flex;gap:10px;">
                    <button onclick="doExportTRCloud()" style="flex:1;background:#7c3aed;color:white;border:none;padding:12px;border-radius:10px;cursor:pointer;font-weight:bold;">📥 Export TRCloud PR.xlsx</button>
                    <button onclick="document.getElementById('trcloudModal').remove()" style="flex:1;background:#f1f5f9;color:#475569;border:none;padding:12px;border-radius:10px;cursor:pointer;">ยกเลิก</button>
                </div>
            </div>`;
            document.body.appendChild(modal);
        };

        window.doExportTRCloud=function(){
            const items=window._orderItems.filter(it=>it.needOrder||it.status.includes('🟡'));
            const g=id=>document.getElementById(id)?.value||'';
            const docDateRaw=g('tr_doc_date');
            const dueDateRaw=g('tr_due_date');
            const fmtDate=s=>{if(!s)return '';const[y,m,d]=s.split('-');return `${d}/${m}/${parseInt(y)+543}`;};

            // Sheet 1: Header (หัวเอกสาร PR)
            const headerSheet=[
                ['=== TRCloud PR Import — Header ==='],
                ['Field','Value','','Field','Value'],
                ['หมวดหมู่',g('tr_cat'),'','คู่ค้า (รหัส)',g('tr_sup_code')],
                ['แผนก',g('tr_dept'),'','คู่ค้า (ชื่อ)',g('tr_sup_name')],
                ['โครงการ',g('tr_proj'),'','วันที่เอกสาร',fmtDate(docDateRaw)],
                ['คลังสินค้า',g('tr_wh'),'','กำหนดส่งของ',fmtDate(dueDateRaw)],
                ['จัดทำโดย',window.currentUser?.name||'','','เลขที่เอกสาร','AUTO'],
                ['หมายเหตุ',g('tr_note')],
            ];

            // Sheet 2: รายการสินค้า PR format
            const itemHeader=[['#','รหัสสินค้า','ชื่อสินค้า','จำนวน','หน่วย','ราคาต่อหน่วย','ส่วนลด(%)','VAT/GST','มูลค่าก่อนภาษี','คลัง/โซน','หมายเหตุ']];
            const itemRows=items.map((it,i)=>{
                const actual=parseFloat(document.getElementById(`order_${it.zone}_${it.id}`)?.value)||it.suggestQty||0;
                return [i+1, it.id, it.name, actual, it.unit, '', '0', '7%', '', it.zone, `คงเหลือ:${it.balance} Min:${it.min}`];
            });

            const wb=XLSX.utils.book_new();
            const ws1=XLSX.utils.aoa_to_sheet(headerSheet);
            const ws2=XLSX.utils.aoa_to_sheet([...itemHeader,...itemRows]);
            ws1['!cols']=[{wch:18},{wch:30},{wch:4},{wch:18},{wch:30}];
            ws2['!cols']=[{wch:4},{wch:15},{wch:35},{wch:10},{wch:10},{wch:15},{wch:12},{wch:8},{wch:18},{wch:20},{wch:30}];
            XLSX.utils.book_append_sheet(wb,ws1,'PR_Header');
            XLSX.utils.book_append_sheet(wb,ws2,'PR_Items');
            XLSX.writeFile(wb,`TRCloud_PR_${fmtDate(docDateRaw).replace(/\//g,'-')}.xlsx`);
            document.getElementById('trcloudModal').remove();
            toast('✅ Export TRCloud PR สำเร็จ','#059669');
        };

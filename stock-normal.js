// stock-normal.js — TTGPlus | openCentralStock, renderStockTool, addStock, finalSaveStock
// Features: Pre Count, Extra SKU, Adjustment log
        if(typeof window.tempExtraSKU==='undefined') window.tempExtraSKU=[];
        if(typeof window.tempAdjustments==='undefined') window.tempAdjustments={};

        window.openCentralStock=function(){
            document.getElementById('dashboardView').classList.add('hidden');
            document.getElementById('toolAppContainer').classList.remove('hidden');
            const visibleZones=getVisibleWarehouses();
            const defaultZone=visibleZones[0]||warehouseList[0];
            if(!tempCountData||!Object.keys(tempCountData).length) tempCountData={};
            window.tempExtraSKU=[];
            window.tempAdjustments={};
            renderStockTool(defaultZone);
            if(window._DM_startStockNormal) setTimeout(()=>_DM_startStockNormal(defaultZone),400);
        };

        window.renderStockTool=async function(zone){
            const c=document.getElementById('toolAppContainer');
            const visibleZones=getVisibleWarehouses();
            const zoneProds=getZoneProducts(zone);
            const usSnap=await getDocs(query(collection(db,'users'),limit(200)));
            let staffOpts='';
            usSnap.forEach(d=>{const u=d.data();if(u.status!=='suspended')staffOpts+=`<option value="${u.name}" ${selectedStaff===u.name?'selected':''}>${u.name}</option>`;});

            // ดึง pre count draft
            let preCountMap={};
            try{
                const pcSnap=await getDocs(query(collection(db,'preCountDrafts'),
                    where('zone','==',zone),limit(20)));
                if(!pcSnap.empty){
                    // sort ใน JS แทน orderBy เพื่อไม่ต้องสร้าง Firestore composite index
                    const sorted=pcSnap.docs.map(d=>({id:d.id,...d.data()}))
                        .sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
                    const pcData=sorted[0];
                    (pcData.items||[]).forEach(it=>{preCountMap[it.id]=it;});
                    window._currentPreCountId=pcData.id;
                    window._currentPreCountDate=pcData.countDate||'';
                }else{ window._currentPreCountId=null; window._currentPreCountDate=''; }
            }catch(e){ window._currentPreCountId=null; window._currentPreCountDate=''; }

            const hasPreCount=Object.keys(preCountMap).length>0;
            const borderColors=['var(--info)','#a78bfa','#f59e0b'];

            const mainRows=zoneProds.map(p=>{
                const units=p.units||[{name:p.unit||'',rate:0},{name:p.subUnit||'',rate:0}].filter(u=>u.name);
                const pending=tempCountData[p.id];
                const hasPending=pending&&units.some((_,ui)=>(pending['u'+ui]||0)>0);
                const lu=countData[p.id]?.lastUpdate||'-';
                const pc=preCountMap[p.id];
                const adj=window.tempAdjustments[p.id];
                const preCountCell=hasPreCount
                    ?`<td style="padding:8px;text-align:center;min-width:80px;">${pc
                        ?`<span style="font-size:13px;font-weight:bold;color:#7c3aed;">${pc.qty}</span><div style="font-size:10px;color:#a78bfa;">${pc.unit||''}</div>`
                        :`<span style="font-size:12px;color:#cbd5e1;">—</span>`}</td>`:'';
                const adjBadge=adj?`<div style="font-size:10px;color:${adj.qty>=0?'#059669':'#dc2626'};margin-top:2px;font-weight:bold;">${adj.qty>=0?'+':''}${adj.qty} (ปรับ)</div>`:'';
                return `<tr class="stock-row" data-search="${p.id.toLowerCase()} ${p.name.toLowerCase()}">
                <td style="padding:10px 12px;"><b style="font-size:15px;">${p.id}</b><br><span style="color:#475569;font-size:13px;">${p.name}</span><br><small style="color:#94a3b8;font-size:10px;">นับล่าสุด: ${lu}</small></td>
                ${preCountCell}
                <td style="padding:8px;text-align:right;">
                    <div style="display:flex;align-items:center;justify-content:flex-end;gap:10px;">
                        <div style="text-align:right;min-width:120px;">${hasPending
                            ?`<div style="font-size:13px;color:var(--info);font-weight:bold;">${units.map((_,ui)=>(pending['u'+ui]||0)>0?`<span>${pending['u'+ui]} ${units[ui].name}</span>`:'').filter(Boolean).join(' + ')}</div><div style="font-size:11px;color:#94a3b8;">รอยืนยัน...</div>${adjBadge}`
                            :`<div style="font-size:12px;color:#cbd5e1;">—</div>`}</div>
                        <div style="display:flex;flex-direction:column;gap:4px;">${units.map((u,ui)=>`
                            <div style="display:flex;align-items:center;gap:4px;">
                                <small style="color:${borderColors[ui]||'#64748b'};width:40px;text-align:right;font-weight:bold;">${u.name}:</small>
                                <input type="number" id="input_${p.id}_${ui}" min="0" inputmode="numeric" class="no-print viewonly-input"
                                    style="width:72px;padding:7px;border-radius:8px;border:2px solid ${borderColors[ui]||'#cbd5e1'};text-align:center;font-weight:bold;font-size:14px;"
                                    onkeydown="if(event.key==='Enter') addStock('${p.id}','${p.name}','${zone}',${ui})">
                            </div>`).join('')}</div>
                        <div style="display:flex;flex-direction:column;gap:4px;">
                            <button onclick="addStockAll('${p.id}','${p.name}','${zone}')" class="btn-action no-print" style="background:var(--info);font-size:20px;">＋</button>
                            ${hasPending?`<button onclick="openAdjustModal('${p.id}','${p.name}')" class="no-print" style="background:#f59e0b;color:white;border:none;border-radius:8px;padding:4px 8px;font-size:11px;cursor:pointer;font-weight:bold;">✏️</button>`:''}
                        </div>
                    </div>
                </td></tr>`;
            }).join('');

            const extraRows=(window.tempExtraSKU||[]).map((ex,idx)=>`
                <tr class="stock-row extra-sku-row" style="background:#fefce8;">
                <td style="padding:10px 12px;">
                    <span style="background:#fde68a;color:#92400e;font-size:10px;padding:2px 6px;border-radius:4px;font-weight:bold;">SKU ชั่วคราว</span><br>
                    <input type="text" value="${ex.name}" placeholder="ชื่อ/รหัสชั่วคราว (admin แก้ทีหลัง)"
                        oninput="tempExtraSKU[${idx}].name=this.value"
                        style="width:100%;border:none;border-bottom:1px solid #fcd34d;font-weight:bold;font-size:13px;background:transparent;outline:none;margin-top:3px;">
                </td>
                ${hasPreCount?`<td style="padding:8px;text-align:center;"><span style="color:#cbd5e1;">—</span></td>`:''}
                <td style="padding:8px;text-align:right;">
                    <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;">
                        <input type="number" min="0" inputmode="numeric" value="${ex.qty||''}" placeholder="0"
                            oninput="tempExtraSKU[${idx}].qty=parseFloat(this.value)||0"
                            style="width:72px;padding:7px;border-radius:8px;border:2px solid #fcd34d;text-align:center;font-weight:bold;font-size:14px;outline:none;">
                        <input type="text" value="${ex.unit||''}" placeholder="หน่วย"
                            oninput="tempExtraSKU[${idx}].unit=this.value"
                            style="width:48px;padding:7px;border-radius:8px;border:1px solid #e2e8f0;font-size:12px;outline:none;">
                        <button onclick="removeExtraSKU(${idx},'${zone}')" class="no-print"
                            style="background:#fca5a5;color:#7f1d1d;border:none;border-radius:8px;padding:6px 10px;font-size:13px;cursor:pointer;">✕</button>
                    </div>
                </td></tr>`).join('');

            c.innerHTML=`
            <div class="tool-header no-print">
                <h2>📦 นับสต๊อก: ${zone}</h2>
                <div style="display:flex;gap:8px;">
                    <button onclick="openPreCountModal('${zone}')"
                        style="background:${hasPreCount?'#7c3aed':'#ede9fe'};color:${hasPreCount?'white':'#6d28d9'};border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-weight:bold;font-size:13px;">
                        ${hasPreCount?`📋 Pre Count (${window._currentPreCountDate})`:'📋 บันทึก Pre Count'}
                    </button>
                    <button onclick="closeTool()">✕ ปิด</button>
                </div>
            </div>
            ${hasPreCount?`<div style="background:#ede9fe;border:1px solid #c4b5fd;border-radius:10px;padding:10px 16px;margin-bottom:14px;font-size:13px;color:#5b21b6;" class="no-print">
                📋 <b>มี Pre Count</b> วันที่ ${window._currentPreCountDate} — คอลัมน์สีม่วงคือยอดคร่าวที่นับไว้ก่อน
                <button onclick="clearPreCount('${zone}')" style="float:right;background:none;border:none;color:#7c3aed;cursor:pointer;font-size:12px;text-decoration:underline;">ล้างออก</button>
            </div>`:''}
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-bottom:16px;" class="no-print">
                <div class="input-group"><label>📦 เลือกโซน</label>
                    <select onchange="window.tempExtraSKU=[];window.tempAdjustments={};renderStockTool(this.value)" style="width:100%;border:none;font-weight:bold;outline:none;">
                        ${visibleZones.map(w=>`<option ${w===zone?'selected':''}>${w}</option>`).join('')}
                    </select></div>
                <div class="input-group" style="border:2px solid var(--danger);"><label>📅 วันที่นับ (บังคับ)</label>
                    <input type="date" id="countDate" value="${selectedDate}" onchange="selectedDate=this.value"
                        style="width:100%;border:none;font-weight:bold;outline:none;font-size:14px;color:#1e293b;"></div>
                <div class="input-group" style="border:2px solid var(--info);"><label>👤 เลือกชื่อคนนับ</label>
                    <select id="staffSelect" onchange="selectedStaff=this.value" style="width:100%;border:none;font-weight:bold;outline:none;">
                        <option value="">-- กรุณาเลือก --</option>${staffOpts}
                    </select></div>
                <div class="input-group" style="background:#f1f5f9;"><label>📝 ผู้ทำรายการหลัก</label><b>${currentUser.name}</b></div>
            </div>
            <div class="no-print" style="margin-bottom:12px;">
                <input type="text" id="stockSearch" placeholder="🔍 ค้นหาสินค้า (รหัส / ชื่อ)..." oninput="filterStockRows(this.value)"
                    style="width:100%;padding:11px 16px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box;outline:none;transition:border 0.2s;"
                    onfocus="this.style.borderColor='var(--info)'" onblur="this.style.borderColor='#e2e8f0'">
            </div>
            <div style="overflow-x:auto;">
            <table class="stock-table" style="width:100%;border-collapse:collapse;">
                <thead class="no-print"><tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;">
                    <th style="padding:10px 12px;text-align:left;font-size:12px;color:#64748b;font-weight:600;">สินค้า</th>
                    ${hasPreCount?`<th style="padding:10px 8px;text-align:center;font-size:12px;color:#7c3aed;font-weight:600;">📋 Pre Count</th>`:''}
                    <th style="padding:10px 12px;text-align:right;font-size:12px;color:#64748b;font-weight:600;">กรอกจำนวน</th>
                </tr></thead>
                <tbody>${mainRows}${extraRows}</tbody>
            </table>
            </div>
            <div class="no-print" style="margin-top:14px;text-align:center;">
                <button onclick="addExtraSKU('${zone}')"
                    style="background:#fef9c3;color:#854d0e;border:1.5px dashed #fcd34d;padding:10px 24px;border-radius:10px;font-size:14px;font-weight:bold;cursor:pointer;">
                    ＋ เพิ่มสินค้านอก Template (SKU ชั่วคราว)
                </button>
            </div>
            <p style="color:#94a3b8;font-size:12px;text-align:center;margin-top:10px;" class="no-print">💡 กรอกจำนวนแล้วกด Enter หรือกด ＋ | กด ✏️ เพื่อปรับยอดที่เพิ่มไปแล้ว</p>
            <div style="margin-top:20px;text-align:center;" class="no-print">
                <button onclick="finalSaveStock('${zone}')"
                    style="background:var(--success);color:white;padding:18px 60px;border:none;border-radius:15px;font-size:20px;font-weight:bold;cursor:pointer;box-shadow:0 4px 15px rgba(16,185,129,0.4);">
                    💾 ยืนยันและบันทึกข้อมูลทั้งหมด
                </button>
            </div>
            <!-- Adjust Modal -->
            <div id="adjustModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:1000;align-items:center;justify-content:center;">
                <div style="background:white;border-radius:16px;padding:28px;width:340px;max-width:90vw;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
                    <h3 style="margin:0 0 4px;font-size:16px;">✏️ ปรับยอด</h3>
                    <p id="adjustProductName" style="color:#64748b;font-size:13px;margin:0 0 16px;"></p>
                    <label style="font-size:12px;font-weight:bold;color:#475569;display:block;margin-bottom:6px;">จำนวนที่ปรับ (ใส่ - ถ้าลด)</label>
                    <input type="number" id="adjustQtyInput" placeholder="เช่น 5 หรือ -3" inputmode="numeric"
                        style="width:100%;padding:10px;border:2px solid #e2e8f0;border-radius:8px;font-size:16px;font-weight:bold;box-sizing:border-box;outline:none;text-align:center;"
                        onfocus="this.style.borderColor='#f59e0b'" onblur="this.style.borderColor='#e2e8f0'">
                    <label style="font-size:12px;font-weight:bold;color:#475569;display:block;margin:12px 0 6px;">เหตุผล</label>
                    <input type="text" id="adjustReasonInput" placeholder="เช่น ของเข้าระหว่างนับ, นับผิด..."
                        style="width:100%;padding:10px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;box-sizing:border-box;outline:none;">
                    <div style="display:flex;gap:10px;margin-top:20px;">
                        <button onclick="confirmAdjust()" style="flex:1;background:#f59e0b;color:white;border:none;padding:12px;border-radius:10px;font-size:15px;font-weight:bold;cursor:pointer;">บันทึกการปรับ</button>
                        <button onclick="document.getElementById('adjustModal').style.display='none'" style="flex:1;background:#f1f5f9;color:#475569;border:none;padding:12px;border-radius:10px;font-size:15px;cursor:pointer;">ยกเลิก</button>
                    </div>
                </div>
            </div>
            <!-- Pre Count Modal -->
            <div id="preCountModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:1000;align-items:center;justify-content:center;">
                <div style="background:white;border-radius:16px;padding:24px;width:460px;max-width:95vw;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
                        <h3 style="margin:0;font-size:16px;color:#6d28d9;">📋 บันทึก Pre Count</h3>
                        <button onclick="deleteCurrentPreCount('${zone}')"
                            style="background:#fee2e2;color:#ef4444;border:none;padding:5px 12px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:bold;">
                            🗑️ ลบทั้งหมด
                        </button>
                    </div>
                    <p style="color:#64748b;font-size:13px;margin:0 0 12px;">โซน: <b>${zone}</b> — กรอกยอดคร่าวก่อนนับจริง</p>
                    <div style="margin-bottom:10px;">
                        <label style="font-size:12px;font-weight:bold;color:#475569;display:block;margin-bottom:4px;">📅 วันที่นับคร่าว</label>
                        <input type="date" id="pcDate" value="${selectedDate}"
                            style="width:100%;padding:8px;border:1.5px solid #c4b5fd;border-radius:8px;font-size:14px;box-sizing:border-box;outline:none;">
                    </div>
                    <div style="margin-bottom:10px;">
                        <input type="text" id="pcSearch" placeholder="🔍 ค้นหาสินค้า..." oninput="filterPCItems(this.value)"
                            style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;outline:none;"
                            onfocus="this.style.borderColor='#c4b5fd'" onblur="this.style.borderColor='#e2e8f0'">
                    </div>
                    <div id="pcItemsList" style="flex:1;overflow-y:auto;border:1px solid #f1f5f9;border-radius:10px;margin-bottom:14px;max-height:42vh;">
                    ${zoneProds.map(p=>{
                        const units=p.units||[{name:p.unit||''}].filter(u=>u.name);
                        const uName=units[0]?.name||'';
                        const prefill=preCountMap[p.id]?.qty||0;
                        return `<div class="pc-item-row" data-search="${p.id.toLowerCase()} ${p.name.toLowerCase()}"
                            style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid #f8fafc;">
                            <div style="flex:1;font-size:13px;"><b>${p.id}</b><br><span style="color:#64748b;font-size:12px;">${p.name}</span></div>
                            <input type="number" min="0" inputmode="numeric" id="pc_${p.id}" placeholder="0"
                                value="${prefill>0?prefill:''}"
                                style="width:70px;padding:7px;border:1.5px solid ${prefill>0?'#7c3aed':'#c4b5fd'};border-radius:8px;text-align:center;font-weight:bold;font-size:14px;outline:none;"
                                onfocus="this.style.borderColor='#7c3aed'" onblur="this.style.borderColor=this.value?'#7c3aed':'#c4b5fd'">
                            <span style="font-size:12px;color:#64748b;min-width:32px;">${uName}</span>
                        </div>`;
                    }).join('')}
                    </div>
                    <div style="display:flex;gap:10px;">
                        <button onclick="savePreCount('${zone}')" style="flex:1;background:#7c3aed;color:white;border:none;padding:12px;border-radius:10px;font-size:15px;font-weight:bold;cursor:pointer;">💾 บันทึก Pre Count</button>
                        <button onclick="document.getElementById('preCountModal').style.display='none'" style="background:#f1f5f9;color:#475569;border:none;padding:12px 16px;border-radius:10px;font-size:15px;cursor:pointer;">ยกเลิก</button>
                    </div>
                </div>
            </div>`
        };

        window.openPreCountModal=function(zone){
            document.getElementById('preCountModal').style.display='flex';
        };

        window.savePreCount=async function(zone){
            const countDate=document.getElementById('pcDate')?.value||selectedDate;
            if(!countDate){toast('⚠️ กรุณาเลือกวันที่','#c2410c');return;}
            const zoneProds=getZoneProducts(zone);
            const items=zoneProds.map(p=>{
                const units=p.units||[{name:p.unit||''}].filter(u=>u.name);
                const qty=parseFloat(document.getElementById('pc_'+p.id)?.value)||0;
                return {id:p.id,name:p.name,qty,unit:units[0]?.name||''};
            }).filter(it=>it.qty>0);
            if(!items.length){toast('⚠️ กรอกยอดอย่างน้อย 1 รายการ','#c2410c');return;}
            try{
                await addDoc(collection(db,'preCountDrafts'),{zone,countDate,items,staffName:currentUser.name,createdAt:Date.now()});
                document.getElementById('preCountModal').style.display='none';
                toast('✅ บันทึก Pre Count แล้ว','#7c3aed');
                renderStockTool(zone);
            }catch(e){toast('❌ บันทึกไม่สำเร็จ: '+e.message,'#c2410c');}
        };

        window.clearPreCount=async function(zone){
            if(!window._currentPreCountId)return;
            if(!confirm('ล้าง Pre Count ออก?'))return;
            try{
                const {deleteDoc,doc:fsDoc}=await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
                await deleteDoc(fsDoc(db,'preCountDrafts',window._currentPreCountId));
                window._currentPreCountId=null;
                toast('🗑️ ล้าง Pre Count แล้ว','#64748b');
                renderStockTool(zone);
            }catch(e){toast('❌ ลบไม่สำเร็จ','#c2410c');}
        };

        window.deleteCurrentPreCount=async function(zone){
            if(!window._currentPreCountId){
                toast('ไม่มี Pre Count ที่จะลบ','#64748b');return;
            }
            if(!confirm('ลบ Pre Count ทั้งหมดของโซนนี้?'))return;
            try{
                const {deleteDoc,doc:fsDoc}=await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
                await deleteDoc(fsDoc(db,'preCountDrafts',window._currentPreCountId));
                window._currentPreCountId=null;
                document.getElementById('preCountModal').style.display='none';
                toast('🗑️ ลบ Pre Count แล้ว','#64748b');
                renderStockTool(zone);
            }catch(e){toast('❌ ลบไม่สำเร็จ','#c2410c');}
        };

        window.filterPCItems=function(q){
            const term=q.toLowerCase().trim();
            document.querySelectorAll('.pc-item-row').forEach(row=>{
                row.style.display=(!term||row.dataset.search.includes(term))?'':'none';
            });
        };

        window.openAdjustModal=function(id,name){
            window._adjustTargetId=id;
            document.getElementById('adjustProductName').textContent=name+' ('+id+')';
            document.getElementById('adjustQtyInput').value='';
            document.getElementById('adjustReasonInput').value='';
            document.getElementById('adjustModal').style.display='flex';
            setTimeout(()=>document.getElementById('adjustQtyInput').focus(),100);
        };

        window.confirmAdjust=function(){
            const id=window._adjustTargetId;
            const qty=parseFloat(document.getElementById('adjustQtyInput').value);
            const reason=document.getElementById('adjustReasonInput').value.trim();
            if(isNaN(qty)||qty===0){toast('⚠️ กรอกจำนวนที่ปรับ','#c2410c');return;}
            if(!reason){toast('⚠️ กรอกเหตุผลด้วย','#c2410c');return;}
            if(!window.tempAdjustments[id]) window.tempAdjustments[id]={qty:0,log:[]};
            window.tempAdjustments[id].qty+=qty;
            window.tempAdjustments[id].log.push({qty,reason,by:currentUser.name,time:new Date().toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})});
            document.getElementById('adjustModal').style.display='none';
            toast(`✅ บันทึกปรับ ${qty>=0?'+':''}${qty} แล้ว`,'#f59e0b');
            const zone=document.querySelector('#toolAppContainer select')?.value||'';
            if(zone) renderStockTool(zone);
        };

        window.addExtraSKU=function(zone){
            if(!window.tempExtraSKU) window.tempExtraSKU=[];
            window.tempExtraSKU.push({name:'',qty:0,unit:''});
            renderStockTool(zone);
        };

        window.removeExtraSKU=function(idx,zone){
            window.tempExtraSKU.splice(idx,1);
            renderStockTool(zone);
        };

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
            const hasMain=Object.keys(tempCountData).some(id=>{
                const td=tempCountData[id];
                return Object.keys(td).filter(k=>k.startsWith('u')).some(k=>(td[k]||0)>0);
            });
            const hasExtra=(window.tempExtraSKU||[]).some(ex=>ex.qty>0&&ex.name.trim());
            if(!hasMain&&!hasExtra){toast('❌ ไม่พบข้อมูลการเปลี่ยนแปลง กรุณากรอกจำนวนและกด ＋ ก่อน','#c2410c');return;}
            if(!confirm(`ยืนยันการบันทึกวันที่ ${selectedDate} โดยคุณ ${selectedStaff}?`))return;
            const [yr,mo,dy]=selectedDate.split('-');
            const dateStr=`${dy}/${mo}/${parseInt(yr)+543}`;
            const now=new Date();
            const timeStr=now.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});
            const ts=dateStr+' '+timeStr;
            Object.keys(tempCountData).forEach(id=>{
                const td=tempCountData[id];
                const p=allProducts.find(pd=>pd.id===id);
                const units=p?.units||[{name:p?.unit||'',rate:0}];
                let totalInUnit1=td['u0']||0;
                if((td['u1']||0)>0&&units[0]?.rate>0) totalInUnit1+=((td['u1']||0)/units[0].rate);
                if((td['u2']||0)>0&&units[0]?.rate>0&&units[1]?.rate>0) totalInUnit1+=((td['u2']||0)/(units[0].rate*units[1].rate));
                const adjQty=window.tempAdjustments[id]?.qty||0;
                totalInUnit1+=adjQty;
                if(!countData[id])countData[id]={total:0,name:td.name};
                countData[id].total=Math.round(Math.max(0,totalInUnit1)*1000)/1000;
                countData[id].lastUpdate=ts;
                countData[id].countedBy=selectedStaff;
            });
            await saveCountData();
            const sessionItems=Object.keys(tempCountData).map(id=>{
                const td=tempCountData[id];
                const p=allProducts.find(pd=>pd.id===id);
                const units=p?.units||[{name:p?.unit||'',rate:0}];
                const amounts=units.map((_,ui)=>({amount:td['u'+ui]||0,unit:units[ui]?.name||''}));
                const adj=window.tempAdjustments[id];
                return {id,name:td.name,amounts,units,...(adj?{adjustments:adj.log,adjustTotal:adj.qty}:{})};
            });
            const extraItems=(window.tempExtraSKU||[]).filter(ex=>ex.qty>0&&ex.name.trim()).map(ex=>({id:'EXTRA',name:ex.name.trim(),qty:ex.qty,unit:ex.unit,isExtra:true}));
            await addDoc(collection(db,'stockHistory'),{
                zone,date:dateStr,timestamp:now.getTime(),
                countedBy:selectedStaff,recordedBy:currentUser.name,
                items:sessionItems,
                ...(extraItems.length?{extraItems}:{}),
                ...(window._currentPreCountId?{preCountRef:window._currentPreCountId}:{})
            });
            tempCountData={};
            window.tempExtraSKU=[];
            window.tempAdjustments={};
            toast('✅ บันทึกสำเร็จ! ตัวเลขรีเซ็ตแล้ว','#059669');
            if(window._DM) _DM.clear('stock_normal');
            renderStockTool(zone);
        };

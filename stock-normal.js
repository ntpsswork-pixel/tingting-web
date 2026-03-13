// stock-normal.js — TTGPlus | openCentralStock, renderStockTool, addStock, finalSaveStock
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
            const usSnap=await getDocs(query(collection(db,'users'), limit(200))); let staffOpts='';
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

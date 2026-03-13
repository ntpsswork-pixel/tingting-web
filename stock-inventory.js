// stock-inventory.js — TTGPlus | openInventoryCheck, renderInventoryRows, calcDiff, saveInventorySheet
        window.openInventoryCheck=async function(){
            document.getElementById('dashboardView').classList.add('hidden');
            const c=document.getElementById('toolAppContainer');c.classList.remove('hidden');
            const visibleZones=getVisibleWarehouses();
            const today=new Date().toISOString().slice(0,10);
            const usSnap=await getDocs(query(collection(db,'users'), limit(200)));
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
            const invSnap=await getDocs(query(collection(db,'inventoryHistory'), orderBy('timestamp','desc'), limit(200)));
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


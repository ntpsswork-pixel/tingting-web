/**
 * lot-register.js — TTGPlus
 * Auto-extracted from home.html
 * Depends on globals: db, currentUser, allProducts, warehouseList,
 *   zoneProductMap, countData, tempCountData, stockSheetTemplates,
 *   warehouseGroups, monthlyCountOpen, productCategories,
 *   saveConfig, toast, goToDashboard, closeTool,
 *   getVisibleWarehouses, getZoneProducts, loadCountData, saveCountData, XLSX
 */
        window.openLotRegister = async function() {
            document.getElementById('dashboardView').classList.add('hidden');
            const c = document.getElementById('toolAppContainer'); c.classList.remove('hidden');
            c.innerHTML=`<div class="tool-header"><h2>🏷️ ทะเบียน Lot สินค้า</h2><button onclick="goToDashboard()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;">🏠 Dashboard</button><button onclick="closeTool()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;">✕ ปิด</button></div>
            <p style="text-align:center;color:#94a3b8;padding:30px;">⏳ กำลังโหลด...</p>`;

            const lotSnap = await getDoc(doc(db,'config','lotRegister'));
            const lots = lotSnap.exists() ? (lotSnap.data().lots||{}) : {};
            const today = new Date();

            const rows = Object.entries(lots).map(([productId, lotList])=>{
                const p = allProducts.find(x=>x.id===productId);
                const activeLots = lotList.filter(l=>l.qtyRemaining>0);
                if(!activeLots.length) return '';
                const oldest = activeLots[0]; // FIFO = index 0
                const expDate = oldest.exp ? new Date(oldest.exp) : null;
                const daysLeft = expDate ? Math.floor((expDate-today)/(1000*60*60*24)) : null;
                const expColor = daysLeft===null?'#64748b':daysLeft<0?'#ef4444':daysLeft<=30?'#f59e0b':'#10b981';
                return `<tr style="border-top:1px solid #f1f5f9;">
                    <td style="padding:12px 16px;"><b style="font-size:13px;">${productId}</b><br><span style="font-size:12px;color:#64748b;">${p?.name||'-'}</span></td>
                    <td style="padding:12px 16px;text-align:center;">
                        <span style="font-family:monospace;font-size:12px;color:#06b6d4;background:#f0f9ff;padding:3px 8px;border-radius:6px;">${oldest.lotNumber}</span>
                        <div style="font-size:10px;color:#94a3b8;margin-top:2px;">FIFO ต้องหยิบก่อน</div>
                    </td>
                    <td style="padding:12px 16px;text-align:center;font-weight:700;font-size:16px;">${oldest.qtyRemaining}<span style="font-size:10px;color:#64748b;font-weight:400;"> ${oldest.unit||''}</span></td>
                    <td style="padding:12px 16px;text-align:center;">
                        <span style="font-weight:bold;color:${expColor};">${oldest.exp?isoToDMY(oldest.exp):'-'}</span>
                        ${daysLeft!==null?`<div style="font-size:10px;color:${expColor};">${daysLeft<0?'หมดอายุแล้ว!':daysLeft===0?'วันนี้!':daysLeft+'วัน'}</div>`:''}
                    </td>
                    <td style="padding:12px 16px;text-align:center;">
                        <span style="background:#f1f5f9;border-radius:10px;padding:3px 10px;font-size:12px;font-weight:bold;">${activeLots.length} Lot</span>
                    </td>
                    <td style="padding:12px 16px;text-align:center;">
                        <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;">
                            <button onclick="showAllLots('${productId}')" style="background:#eff6ff;color:#3b82f6;border:none;padding:5px 12px;border-radius:7px;cursor:pointer;font-size:11px;font-weight:bold;">ดูทั้งหมด</button>
                            <button onclick="editLot('${productId}','${oldest.lotNumber}')" style="background:#f0fdf4;color:#059669;border:1px solid #bbf7d0;padding:5px 10px;border-radius:7px;cursor:pointer;font-size:11px;">✏️ แก้ไข</button>
                            <button onclick="deleteLot('${productId}','${oldest.lotNumber}')" style="background:#fef2f2;color:#ef4444;border:1px solid #fecaca;padding:5px 10px;border-radius:7px;cursor:pointer;font-size:11px;">🗑️ ลบ</button>
                        </div>
                    </td>
                </tr>
                <tr id="allLots_${productId}" style="display:none;background:#f8fafc;">
                    <td colspan="6" style="padding:12px 20px;">
                        <div style="font-size:11px;font-weight:bold;color:#64748b;margin-bottom:6px;">Lot ทั้งหมดของ ${productId}:</div>
                        ${activeLots.map((l,i)=>`<div style="display:inline-flex;align-items:center;gap:6px;margin:3px;background:${i===0?'#dbeafe':'white'};border:1px solid ${i===0?'#93c5fd':'#e2e8f0'};border-radius:8px;padding:4px 10px;font-size:11px;font-family:monospace;">
                            <span>${i===0?'⭐ ':''}<b>${l.lotNumber}</b> • เหลือ ${l.qtyRemaining} • EXP: ${l.exp?isoToDMY(l.exp):'-'}</span>
                            <button onclick="editLot('${productId}','${l.lotNumber}')" style="background:#eff6ff;color:#3b82f6;border:none;border-radius:5px;padding:2px 7px;cursor:pointer;font-size:10px;font-family:sans-serif;">✏️</button>
                            <button onclick="deleteLot('${productId}','${l.lotNumber}')" style="background:#fef2f2;color:#ef4444;border:none;border-radius:5px;padding:2px 7px;cursor:pointer;font-size:10px;font-family:sans-serif;">🗑️</button>
                        </div>`).join('')}
                    </td>
                </tr>`;
            }).join('');

            // หาสินค้าใกล้หมดอายุ
            const expWarnings = [];
            Object.entries(lots).forEach(([pid,lotList])=>{
                lotList.filter(l=>l.qtyRemaining>0&&l.exp).forEach(l=>{
                    const d=Math.floor((new Date(l.exp)-today)/(1000*60*60*24));
                    if(d<=30) expWarnings.push({pid,lotNumber:l.lotNumber,exp:l.exp,daysLeft:d,qty:l.qtyRemaining,unit:l.unit});
                });
            });
            expWarnings.sort((a,b)=>a.daysLeft-b.daysLeft);

            c.innerHTML=`
            <div class="tool-header">
                <h2>🏷️ ทะเบียน Lot สินค้า</h2>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button onclick="openCreateGR()" style="background:#06b6d4;color:white;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-weight:bold;">+ รับสินค้าใหม่</button>
                    <button onclick="exportLotExcel()" style="background:#059669;color:white;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-weight:bold;">📥 Excel</button>
                    <button onclick="exportLotPDF()" style="background:#7c3aed;color:white;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-weight:bold;">🖨️ PDF</button>
                    <button onclick="goToDashboard()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;">🏠 Dashboard</button>
                    <button onclick="closeTool()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;">✕ ปิด</button>
                </div>
            </div>
            ${expWarnings.length?`
            <div style="background:linear-gradient(135deg,#fff7ed,#fef3c7);border:1.5px solid #fbbf24;border-radius:14px;padding:16px 20px;margin-bottom:20px;">
                <div style="font-weight:700;font-size:14px;color:#b45309;margin-bottom:8px;">⚠️ สินค้าใกล้หมดอายุ (ภายใน 30 วัน) — ${expWarnings.length} รายการ</div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    ${expWarnings.map(w=>`<span style="background:white;border:1px solid #fbbf24;border-radius:8px;padding:5px 12px;font-size:11px;color:${w.daysLeft<0?'#ef4444':w.daysLeft<=7?'#dc2626':'#b45309'};font-weight:bold;">
                        ${w.pid} • ${w.lotNumber} • EXP: ${w.exp?isoToDMY(w.exp):'-'} (${w.daysLeft<0?'หมดแล้ว!':w.daysLeft+'วัน'})
                    </span>`).join('')}
                </div>
            </div>`:''}
            <div style="background:white;border-radius:14px;border:1px solid #e2e8f0;overflow:hidden;">
                <table style="width:100%;border-collapse:collapse;">
                    <thead><tr style="background:#0f172a;color:white;">
                        <th style="padding:12px 16px;text-align:left;font-size:11px;font-weight:700;">สินค้า</th>
                        <th style="padding:12px 16px;text-align:center;font-size:11px;font-weight:700;">Lot ที่ต้องหยิบก่อน (FIFO)</th>
                        <th style="padding:12px 16px;text-align:center;font-size:11px;font-weight:700;">คงเหลือ Lot นี้</th>
                        <th style="padding:12px 16px;text-align:center;font-size:11px;font-weight:700;">วันหมดอายุ</th>
                        <th style="padding:12px 16px;text-align:center;font-size:11px;font-weight:700;">Lot ทั้งหมด</th>
                        <th style="padding:12px 16px;text-align:center;font-size:11px;font-weight:700;"></th>
                    </tr></thead>
                    <tbody>${rows||'<tr><td colspan="6" style="padding:40px;text-align:center;color:#94a3b8;">ยังไม่มีข้อมูล Lot — เริ่มรับสินค้าเพื่อสร้าง Lot Register</td></tr>'}</tbody>
                </table>
            </div>`;
        };

        window.deleteLot = async function(productId, lotNumber) {
            if(currentUser?.role!=='admin') { toast('⚠️ เฉพาะแอดมินเท่านั้น','#c2410c'); return; }
            if(!confirm(`⚠️ แอดมิน — ยืนยันลบ Lot "${lotNumber}" ของ ${productId}?\nหากลบแล้วจะไม่สามารถกู้คืนได้`)) return;
            try {
                const lotRef = doc(db,'config','lotRegister');
                const snap = await getDoc(lotRef);
                if(!snap.exists()) return;
                const lots = JSON.parse(JSON.stringify(snap.data().lots||{}));
                if(!lots[productId]) return;
                lots[productId] = lots[productId].filter(l=>l.lotNumber!==lotNumber);
                if(!lots[productId].length) delete lots[productId];
                await setDoc(lotRef,{lots});
                toast(`🗑️ ลบ Lot ${lotNumber} แล้ว`,'#059669');
                openLotRegister();
            } catch(e) { toast('❌ ลบไม่สำเร็จ: '+e.message,'#ef4444'); }
        };

        window.editLot = async function(productId, lotNumber) {
            const lotRef = doc(db,'config','lotRegister');
            const snap = await getDoc(lotRef);
            if(!snap.exists()) return;
            const lots = snap.data().lots||{};
            const lot = (lots[productId]||[]).find(l=>l.lotNumber===lotNumber);
            if(!lot) return;
            const modal = document.createElement('div');
            modal.id = 'editLotModal';
            modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;';
            modal.innerHTML = `
                <div style="background:white;border-radius:20px;padding:28px;width:100%;max-width:400px;box-shadow:0 20px 60px rgba(0,0,0,0.2);">
                    <h3 style="margin:0 0 6px;color:#0f172a;font-family:inherit;">✏️ แก้ไข Lot</h3>
                    <p style="margin:0 0 20px;font-size:13px;color:#64748b;">สินค้า: <b>${productId}</b> • Lot: <b style="color:#06b6d4;">${lotNumber}</b></p>
                    <div style="display:flex;flex-direction:column;gap:12px;">
                        <div>
                            <label style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px;">จำนวนคงเหลือ</label>
                            <input id="el_qty" type="number" value="${lot.qtyRemaining}" min="0"
                                style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-size:14px;outline:none;box-sizing:border-box;font-family:inherit;">
                        </div>
                        <div>
                            <label style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px;">วันหมดอายุ (dd/mm/yyyy)</label>
                            <input id="el_exp" type="text" value="${lot.exp?isoToDMY(lot.exp):''}" placeholder="dd/mm/yyyy" maxlength="10"
                                oninput="this.value=this.value.replace(/[^0-9/]/g,'');let v=this.value.replace(/\//g,'');if(v.length>2)v=v.slice(0,2)+'/'+v.slice(2);if(v.length>5)v=v.slice(0,5)+'/'+v.slice(5);this.value=v;"
                                style="width:100%;padding:10px 12px;border:1.5px solid #f59e0b;border-radius:9px;font-size:14px;outline:none;box-sizing:border-box;font-weight:700;font-family:inherit;">
                        </div>
                        <div>
                            <label style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px;">MFD (dd/mm/yyyy)</label>
                            <input id="el_mfd" type="text" value="${lot.mfd?isoToDMY(lot.mfd):''}" placeholder="dd/mm/yyyy" maxlength="10"
                                oninput="this.value=this.value.replace(/[^0-9/]/g,'');let v=this.value.replace(/\//g,'');if(v.length>2)v=v.slice(0,2)+'/'+v.slice(2);if(v.length>5)v=v.slice(0,5)+'/'+v.slice(5);this.value=v;"
                                style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-size:14px;outline:none;box-sizing:border-box;font-family:inherit;">
                        </div>
                    </div>
                    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px;">
                        <button onclick="document.getElementById('editLotModal').remove()" style="background:#f1f5f9;color:#64748b;border:none;padding:10px 20px;border-radius:10px;cursor:pointer;font-weight:600;font-family:inherit;">ยกเลิก</button>
                        <button onclick="saveEditLot('${productId}','${lotNumber}')" style="background:linear-gradient(135deg,#06b6d4,#0891b2);color:white;border:none;padding:10px 24px;border-radius:10px;cursor:pointer;font-weight:700;font-family:inherit;">💾 บันทึก</button>
                    </div>
                </div>`;
            document.body.appendChild(modal);
        };

        window.saveEditLot = async function(productId, lotNumber) {
            if(currentUser?.role==='admin' && !confirm(`⚠️ แอดมิน — ยืนยันแก้ไข Lot "${lotNumber}"?`)) return;
            const qtyVal = parseFloat(document.getElementById('el_qty')?.value)||0;
            const expVal = document.getElementById('el_exp')?.value.trim()||'';
            const mfdVal = document.getElementById('el_mfd')?.value.trim()||'';
            function dmyToIso(s){ if(!s||s.length<10) return ''; const p=s.split('/'); return`${p[2]}-${p[1]}-${p[0]}`; }
            try {
                const lotRef = doc(db,'config','lotRegister');
                const snap = await getDoc(lotRef);
                const lots = JSON.parse(JSON.stringify(snap.data().lots||{}));
                lots[productId] = (lots[productId]||[]).map(l=>{
                    if(l.lotNumber!==lotNumber) return l;
                    const updated = {...l, qtyRemaining:qtyVal};
                    if(dmyToIso(expVal)) updated.exp = dmyToIso(expVal);
                    if(dmyToIso(mfdVal)) updated.mfd = dmyToIso(mfdVal);
                    return updated;
                });
                await setDoc(lotRef,{lots});
                document.getElementById('editLotModal')?.remove();
                toast('✅ แก้ไข Lot เรียบร้อย','#059669');
                openLotRegister();
            } catch(e) { toast('❌ '+e.message,'#ef4444'); }
        };

        window.showAllLots = function(pid) {
            const el = document.getElementById(`allLots_${pid}`); if(!el) return;
            el.style.display = el.style.display==='none' ? 'table-row' : 'none';
        };

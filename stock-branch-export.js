// stock-branch-export.js — TTGPlus | openBranchExportModal, doExportBranchExcel
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

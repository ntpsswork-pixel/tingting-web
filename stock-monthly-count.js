// stock-monthly-count.js — TTGPlus | tryOpenMonthlyCount, BT/Admin monthly flow, exporters
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
                    const snap = await getDocs(query(collection(db,'inventoryHistory'), orderBy('savedAt','desc'), limit(500)));
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
                const snap = await getDocs(query(collection(db,'inventoryHistory'), orderBy('savedAt','desc'), limit(500)));
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
                const snap = await getDocs(query(collection(db,'inventoryHistory'), orderBy('savedAt','desc'), limit(500)));
                snap.forEach(d=>{ const x=d.data(); if(x.zone===zone&&x.month===monthKey&&x.type==='branch') existingDoc={id:d.id,...x}; });
            } catch(e){}
            if(existingDoc) openBranchMonthlyDoneSummary(tmplId, tmpl, zone, existingDoc);
            else openBranchMonthlyCount(tmplId, tmpl, zone);
        };

        // ===== สุ่ม 10 SKU ทดลองนับ (Pilot mode) =====

        window.openBranchMonthlyCountForAdmin = async function(tmplId, zone) {
            const tmpl = stockSheetTemplates[tmplId]; if(!tmpl) return;
            const now = new Date();
            const monthKey = now.toISOString().slice(0,7);
            let existingDoc = null;
            try {
                const snap = await getDocs(query(collection(db,'inventoryHistory'), orderBy('savedAt','desc'), limit(500)));
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
            <div style="margin-bottom:12px;" class="no-print">
                <input type="text" placeholder="🔍 ค้นหาสินค้า..." oninput="filterBMCRows(this.value)"
                    style="width:100%;padding:10px 16px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box;outline:none;">
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
                    const header = `<tr><td colspan="4" style="padding:10px 16px;background:linear-gradient(90deg,#f0f9ff,#f8fafc);font-weight:700;font-size:12px;color:#0369a1;border-top:2px solid #bae6fd;letter-spacing:.5px;">▌ ${grp.toUpperCase()}</td></tr>`;
                    const rows = grpItems.map(it=>{
                        const prev = prefillMap[it.id];
                        const prevVal = prev?.balance != null ? prev.balance : '';
                        const prevNote = prev?.note || '';
                        const hasPrev = prevVal !== '';
                        return `
                        <tr class="bmc-row" data-search="${it.id.toLowerCase()} ${it.name.toLowerCase()}" style="border-bottom:1px solid #f1f5f9;${hasPrev?'background:#fffbeb;':''}">
                            <td style="padding:12px 16px;">
                                <div style="font-weight:700;font-size:13px;">${it.id}</div>
                                <div style="color:#475569;font-size:12px;">${it.name}</div>
                            </td>
                            <td style="padding:12px;text-align:center;">
                                <input type="number" id="bmc_${it.id}" min="0" placeholder="0" value="${prevVal}"
                                    style="width:90px;padding:9px;border-radius:10px;border:2px solid ${hasPrev?'#f59e0b':'#3b82f6'};text-align:center;font-weight:700;font-size:16px;outline:none;"
                                    onfocus="this.style.borderColor='#1d4ed8'" onblur="this.style.borderColor='${hasPrev?`#f59e0b`:`#3b82f6`}'">
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
        };

        window.filterBMCRows = function(q) {
            document.querySelectorAll('.bmc-row').forEach(r=>{
                r.style.display = (!q||r.dataset.search.includes(q.toLowerCase())) ? '' : 'none';
            });
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
                const existSnap = await getDocs(query(collection(db,'inventoryHistory'), orderBy('savedAt','desc'), limit(500)));
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
                const snap = await getDocs(query(collection(db,'inventoryHistory'), orderBy('savedAt','desc'), limit(500)));
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
                const snap = await getDocs(query(collection(db,'inventoryHistory'), orderBy('savedAt','desc'), limit(500)));
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

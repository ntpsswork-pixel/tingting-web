// requisition.js — TTGPlus (extracted)

        // ======== REQUISITION SYSTEM ========
        // Firestore: requisitions/{id} = {
        //   mrNumber, date, requestedBy, department, zone, purpose,
        //   items:[{id,name,unit,qtyRequested,qtyIssued}],
        //   status: 'pending'|'approved'|'issued'|'rejected',
        //   approvedBy, approvedAt, issuedBy, issuedAt, note,
        //   timestamp
        // }

        const MR_STATUS = {
            pending:  { label:'รออนุมัติ',  color:'#f59e0b', bg:'#fffbeb' },
            approved: { label:'อนุมัติแล้ว', color:'#3b82f6', bg:'#eff6ff' },
            issued:   { label:'จ่ายแล้ว',   color:'#10b981', bg:'#f0fdf4' },
            rejected: { label:'ไม่อนุมัติ', color:'#ef4444', bg:'#fef2f2' },
        };

        async function genMRNumber() {
            const now = new Date();
            const prefix = `MR-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
            const snap = await getDocs(query(collection(db,'requisitions'), orderBy('createdAt','desc'), limit(300)));
            const todayDocs = [];
            snap.forEach(d=>{ if(d.id.startsWith(prefix)) todayDocs.push(d.id); });
            const seq = String(todayDocs.length+1).padStart(3,'0');
            return `${prefix}-${seq}`;
        }

        // ---- สร้างใบเบิกใหม่ ----
        window.openCreateRequisition = async function() {
            document.getElementById('dashboardView').classList.add('hidden');
            const c = document.getElementById('toolAppContainer'); c.classList.remove('hidden');
            const visibleZones = getVisibleWarehouses();
            const usSnap = await getDocs(query(collection(db,'users'), limit(200)));
            let staffOpts = '';
            usSnap.forEach(d=>{ const u=d.data(); if(u.status!=='suspended') staffOpts+=`<option value="${u.name}">${u.name}</option>`; });
            const today = new Date().toISOString().slice(0,10);

            // build template buttons
            const tmplEntries = Object.entries(reqTemplates);
            const tmplBar = tmplEntries.length ? `
            <div style="margin-bottom:16px;">
                <div style="font-size:12px;font-weight:bold;color:#64748b;margin-bottom:8px;">⚡ ใช้ Template สำเร็จรูป:</div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    ${tmplEntries.map(([id,t])=>`
                    <button onclick="applyReqTemplate('${id}')" style="background:white;border:2px solid ${t.color};color:${t.color};padding:7px 16px;border-radius:20px;cursor:pointer;font-size:12px;font-weight:bold;transition:all 0.15s;"
                        onmouseover="this.style.background='${t.color}';this.style.color='white'"
                        onmouseout="this.style.background='white';this.style.color='${t.color}'">
                        ${t.name}
                    </button>`).join('')}
                    <button onclick="openRequisitionSettings()" style="background:white;border:2px dashed #e2e8f0;color:#94a3b8;padding:7px 14px;border-radius:20px;cursor:pointer;font-size:12px;">
                        + จัดการ Template
                    </button>
                </div>
            </div>` : '';

            c.innerHTML = `
            <div class="tool-header no-print">
                <h2>✏️ สร้างใบเบิกสินค้า (MR)</h2>
                <button onclick="goToDashboard()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;">🏠 Dashboard</button><button onclick="closeTool()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;">✕ ปิด</button>
            </div>

            ${tmplBar}

            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:15px;margin-bottom:20px;">
                <div class="input-group" style="border:2px solid var(--danger);"><label>📅 วันที่ขอเบิก (บังคับ)</label>
                    <input type="text" id="mr_date_txt" placeholder="dd/mm/yyyy" maxlength="10"
    value="${today.split('-').reverse().join('/')}"
    oninput="formatDateInput(this,'mr_date')"
    style="width:100%;border:none;font-weight:bold;outline:none;font-size:14px;">
<input type="hidden" id="mr_date" value="${today}">
                </div>
                <div class="input-group" style="border:2px solid var(--info);"><label>👤 ผู้ขอเบิก</label>
                    <select id="mr_requester" style="width:100%;border:none;font-weight:bold;outline:none;">
                        <option value="${currentUser.name}">${currentUser.name} (คุณ)</option>${staffOpts}
                    </select>
                </div>
                <div class="input-group"><label>🏭 แผนก / ฝ่าย</label>
                    <input type="text" id="mr_dept" placeholder="เช่น ฝ่ายผลิต" style="width:100%;border:none;font-weight:bold;outline:none;font-size:14px;">
                </div>
                <div class="input-group"><label>📦 เบิกจากคลัง</label>
                    <select id="mr_zone" onchange="renderMRItems()" style="width:100%;border:none;font-weight:bold;outline:none;">
                        ${visibleZones.map(z=>`<option value="${z}">${z}</option>`).join('')}
                    </select>
                </div>
                <div class="input-group" style="grid-column:span 2;"><label>📝 วัตถุประสงค์การเบิก</label>
                    <input type="text" id="mr_purpose" placeholder="เช่น ผลิตเมนู Mochi วันที่ 21/02/2569" style="width:100%;border:none;font-weight:bold;outline:none;font-size:14px;">
                </div>
            </div>

            <div style="margin-bottom:12px;">
                <input type="text" id="mr_search" placeholder="🔍 ค้นหาสินค้า..." oninput="filterMRRows(this.value)"
                    style="width:100%;padding:10px 16px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box;outline:none;">
            </div>

            <div id="mrItemsContainer"></div>

            <div style="margin-top:24px;display:flex;gap:12px;justify-content:center;" class="no-print">
                <button onclick="submitRequisition()" style="background:var(--success);color:white;padding:16px 48px;border:none;border-radius:12px;font-size:17px;font-weight:bold;cursor:pointer;box-shadow:0 4px 15px rgba(16,185,129,0.3);">
                    📤 ส่งคำขอเบิก
                </button>
            </div>`;

            renderMRItems();
            // ลงทะเบียน draft protection
            if(window._DM_startCreateReq) setTimeout(()=>_DM_startCreateReq(), 400);
        };

        window.renderMRItems = function() {
            const zone = document.getElementById('mr_zone')?.value || '';
            const zoneProds = getZoneProducts(zone);
            const c = document.getElementById('mrItemsContainer'); if(!c) return;
            c.innerHTML = `
            <table class="stock-table" id="mrTable">
                <thead><tr style="background:#f8fafc;">
                    <th style="padding:12px;text-align:left;font-size:12px;color:#64748b;">รหัส / ชื่อสินค้า</th>
                    <th style="padding:12px;text-align:center;font-size:12px;color:#64748b;">คงเหลือ (ระบบ)</th>
                    <th style="padding:12px;text-align:center;font-size:12px;color:#64748b;">จำนวนที่ขอเบิก</th>
                    <th style="padding:12px;text-align:center;font-size:12px;color:#64748b;">หน่วย</th>
                    <th style="padding:12px;text-align:left;font-size:12px;color:#64748b;">หมายเหตุ</th>
                </tr></thead>
                <tbody>${zoneProds.map(p=>{
                    const u = (p.units||[{name:p.unit||''}])[0]?.name||'';
                    const bal = countData[p.id]?.total??'-';
                    const balColor = typeof bal==='number'&&bal<=0?'#ef4444':typeof bal==='number'&&bal<10?'#f59e0b':'var(--success)';
                    return `<tr class="stock-row mr-row" data-id="${p.id}" data-name="${p.name.toLowerCase()} ${p.id.toLowerCase()}">
                        <td style="padding:12px;">
                            <b style="font-size:14px;">${p.id}</b><br>
                            <span style="color:#475569;font-size:13px;">${p.name}</span>
                        </td>
                        <td style="padding:12px;text-align:center;font-weight:bold;font-size:16px;color:${balColor};">${bal}</td>
                        <td style="padding:12px;text-align:center;">
                            <input type="number" id="mr_qty_${p.id}" min="0" placeholder="0"
                                style="width:80px;padding:8px;border:2px solid #e2e8f0;border-radius:8px;text-align:center;font-weight:bold;font-size:15px;outline:none;"
                                onfocus="this.style.borderColor='var(--info)'" onblur="this.style.borderColor='#e2e8f0'">
                        </td>
                        <td style="padding:12px;text-align:center;color:#64748b;">${u}</td>
                        <td style="padding:12px;">
                            <input type="text" id="mr_note_${p.id}" placeholder="หมายเหตุ"
                                style="width:100%;padding:6px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;box-sizing:border-box;">
                        </td>
                    </tr>`;
                }).join('')}</tbody>
            </table>`;
        };

        window.filterMRRows = function(q) {
            q = q.toLowerCase().trim();
            document.querySelectorAll('.mr-row').forEach(row=>{
                row.style.display = (!q||row.dataset.name.includes(q)) ? '' : 'none';
            });
        };

        window.applyReqTemplate = function(tid) {
            const t = reqTemplates[tid]; if(!t) return;
            // set zone
            const zoneEl = document.getElementById('mr_zone');
            if(zoneEl) { zoneEl.value = t.zone; renderMRItems(); }
            // set dept
            const deptEl = document.getElementById('mr_dept');
            if(deptEl) deptEl.value = t.dept||'';
            // wait for renderMRItems then check boxes
            setTimeout(()=>{
                (t.items||[]).forEach(it=>{
                    const input = document.getElementById(`mr_qty_${it.id}`);
                    if(input && !input.value) input.focus();
                });
                toast(`✅ ใช้ Template "${t.name}" แล้ว — กรอกจำนวนได้เลย`,'#059669');
            }, 200);
        };

        window.submitRequisition = async function() {
            const date  = document.getElementById('mr_date')?.value;
            const by    = document.getElementById('mr_requester')?.value;
            const dept  = document.getElementById('mr_dept')?.value||'';
            const zone  = document.getElementById('mr_zone')?.value;
            const purp  = document.getElementById('mr_purpose')?.value||'';
            if(!date||!zone){toast('⚠️ กรุณากรอกข้อมูลให้ครบ','#c2410c');return;}

            const zoneProds = getZoneProducts(zone);
            const items = zoneProds.map(p=>{
                const qty = parseFloat(document.getElementById(`mr_qty_${p.id}`)?.value)||0;
                const note = document.getElementById(`mr_note_${p.id}`)?.value||'';
                const u = (p.units||[{name:p.unit||''}])[0]?.name||'';
                return qty>0 ? {id:p.id,name:p.name,unit:u,qtyRequested:qty,qtyIssued:0,note} : null;
            }).filter(Boolean);

            if(!items.length){toast('⚠️ กรุณากรอกจำนวนอย่างน้อย 1 รายการ','#c2410c');return;}
            if(!confirm(`ยืนยันส่งใบเบิก ${items.length} รายการ จากคลัง ${zone}?`))return;

            const [y,m,d] = date.split('-');
            const dateStr = `${d}/${m}/${parseInt(y)+543}`;
            const mrNumber = await genMRNumber();

            await addDoc(collection(db,'requisitions'),{
                mrNumber, date:dateStr, timestamp:Date.now(),
                requestedBy:by, department:dept, zone, purpose:purp,
                items, status:'pending',
                approvedBy:'', approvedAt:'', issuedBy:'', issuedAt:'', rejectReason:''
            });

            toast(`✅ ส่งใบเบิก ${mrNumber} เรียบร้อยแล้ว`,'#059669');
            // clear draft หลัง save สำเร็จ
            if(window._DM) _DM.clear('create_req');
            loadReqBadge();
            openMyRequisitions();
        };

        // ---- ใบเบิกของฉัน ----
        window.openMyRequisitions = async function() {
            document.getElementById('dashboardView').classList.add('hidden');
            const c = document.getElementById('toolAppContainer'); c.classList.remove('hidden');
            c.innerHTML = `<div class="tool-header"><h2>📄 ใบเบิกของฉัน</h2><div style="display:flex;gap:8px;">
                <button onclick="openCreateRequisition()" style="background:#f59e0b;color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:bold;">✏️ สร้างใบเบิกใหม่</button>
                <button onclick="goToDashboard()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;">🏠 Dashboard</button><button onclick="closeTool()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;">✕ ปิด</button>
            </div></div>
            <div id="myReqList"><p style="text-align:center;color:#94a3b8;padding:40px;">กำลังโหลด...</p></div>`;

            const snap = await getDocs(query(collection(db,'requisitions'), orderBy('createdAt','desc'), limit(300)));
            let docs = [];
            snap.forEach(d=>docs.push({id:d.id,...d.data()}));
            docs = docs.filter(d=>d.requestedBy===currentUser.name || currentUser.role==='admin');
            docs.sort((a,b)=>b.timestamp-a.timestamp);
            renderReqList('myReqList', docs, false);
        };

        // ---- รออนุมัติ (warehouse/admin) ----
        window.openPendingRequisitions = async function() {
            document.getElementById('dashboardView').classList.add('hidden');
            const c = document.getElementById('toolAppContainer'); c.classList.remove('hidden');
            c.innerHTML = `<div class="tool-header"><h2>🔔 ใบเบิกรออนุมัติ / จ่ายของ</h2>
                <button onclick="goToDashboard()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;">🏠 Dashboard</button><button onclick="closeTool()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;">✕ ปิด</button>
            </div>
            <div style="display:flex;gap:8px;margin-bottom:16px;">
                <button onclick="filterReqStatus('pending')" id="rsbtn_pending" style="padding:7px 16px;border-radius:8px;border:2px solid #f59e0b;background:#f59e0b;color:white;cursor:pointer;font-size:12px;font-weight:bold;">รออนุมัติ</button>
                <button onclick="filterReqStatus('approved')" id="rsbtn_approved" style="padding:7px 16px;border-radius:8px;border:2px solid #3b82f6;background:white;color:#3b82f6;cursor:pointer;font-size:12px;font-weight:bold;">อนุมัติแล้ว รอจ่าย</button>
                <button onclick="filterReqStatus('all')" id="rsbtn_all" style="padding:7px 16px;border-radius:8px;border:2px solid #64748b;background:white;color:#64748b;cursor:pointer;font-size:12px;font-weight:bold;">ทั้งหมด</button>
            </div>
            <div id="pendingReqList"><p style="text-align:center;color:#94a3b8;padding:40px;">กำลังโหลด...</p></div>`;

            const snap = await getDocs(query(collection(db,'requisitions'), orderBy('createdAt','desc'), limit(300)));
            let docs = [];
            snap.forEach(d=>docs.push({id:d.id,...d.data()}));
            docs.sort((a,b)=>b.timestamp-a.timestamp);
            window._allReqDocs = docs;
            filterReqStatus('pending');
        };

        window.filterReqStatus = function(status) {
            const docs = window._allReqDocs||[];
            const filtered = status==='all' ? docs : docs.filter(d=>d.status===status);
            renderReqList('pendingReqList', filtered, true);
            ['pending','approved','all'].forEach(s=>{
                const btn = document.getElementById(`rsbtn_${s}`);
                if(!btn) return;
                const colors = {pending:'#f59e0b',approved:'#3b82f6',all:'#64748b'};
                btn.style.background = s===status ? colors[s] : 'white';
                btn.style.color = s===status ? 'white' : colors[s];
            });
        };

        window.openAllRequisitions = async function() {
            document.getElementById('dashboardView').classList.add('hidden');
            const c = document.getElementById('toolAppContainer'); c.classList.remove('hidden');
            c.innerHTML = `<div class="tool-header"><h2>📊 ใบเบิกทั้งหมด</h2><div style="display:flex;gap:8px;">
                <button onclick="exportReqExcel()" style="background:var(--success);color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:bold;">📥 Export Excel</button>
                <button onclick="goToDashboard()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;">🏠 Dashboard</button><button onclick="closeTool()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;">✕ ปิด</button>
            </div></div>
            <div id="allReqList"><p style="text-align:center;color:#94a3b8;padding:40px;">กำลังโหลด...</p></div>`;

            const snap = await getDocs(query(collection(db,'requisitions'), orderBy('createdAt','desc'), limit(300)));
            let docs = [];
            snap.forEach(d=>docs.push({id:d.id,...d.data()}));
            docs.sort((a,b)=>b.timestamp-a.timestamp);
            window._allReqDocs = docs;
            renderReqList('allReqList', docs, true);
        };

        // ---- Render รายการใบเบิก ----
        function renderReqList(containerId, docs, showActions) {
            const c = document.getElementById(containerId); if(!c) return;
            if(!docs.length){c.innerHTML='<p style="text-align:center;color:#94a3b8;padding:40px;">ไม่มีรายการ</p>';return;}
            c.innerHTML = docs.map(d=>{
                const st = MR_STATUS[d.status]||MR_STATUS.pending;
                const canApprove = showActions && d.status==='pending' && ['admin','warehouse'].includes(currentUser.role);
                const canIssue   = showActions && d.status==='approved' && ['admin','warehouse'].includes(currentUser.role);
                const canReject  = showActions && d.status==='pending' && ['admin','warehouse'].includes(currentUser.role);
                return `<div class="history-card" style="margin-bottom:16px;border-left:4px solid ${st.color};background:${st.bg};">
                    <div class="history-card-header">
                        <div style="display:flex;align-items:center;gap:12px;">
                            <span style="font-weight:bold;font-size:15px;color:var(--primary-dark);">${d.mrNumber}</span>
                            <span style="background:${st.color};color:white;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:bold;">${st.label}</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:8px;">
                            <span style="font-size:12px;color:#64748b;">📅 ${d.date} • 👤 ${d.requestedBy} • 📦 ${d.zone}</span>
                            ${canApprove?`<button onclick="approveReq('${d.id}')" style="background:#3b82f6;color:white;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:bold;">✅ อนุมัติ</button>`:''}
                            ${canReject?`<button onclick="rejectReq('${d.id}')" style="background:#ef4444;color:white;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:bold;">❌ ไม่อนุมัติ</button>`:''}
                            ${canIssue?`<button onclick="issueReq('${d.id}')" style="background:#10b981;color:white;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:bold;">📦 จ่ายของแล้ว</button>`:''}
                            <button onclick="printReq('${d.id}')" style="background:#f1f5f9;color:#475569;border:1px solid #e2e8f0;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px;">🖨️ พิมพ์</button>
                            ${(currentUser?.role==='admin')?`
                            <button onclick="deleteMR('${d.id}','${d.mrNumber}')" style="background:#fef2f2;color:#ef4444;border:1px solid #fecaca;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:12px;">🗑️</button>
                            `:''}
                        </div>
                    </div>
                    ${d.purpose?`<div style="padding:8px 0;font-size:13px;color:#475569;">📝 ${d.purpose}</div>`:''}
                    <table style="width:100%;border-collapse:collapse;margin-top:8px;">
                        <thead><tr style="background:rgba(0,0,0,0.04);">
                            <th style="padding:8px;text-align:left;font-size:11px;color:#64748b;">รหัส</th>
                            <th style="padding:8px;text-align:left;font-size:11px;color:#64748b;">ชื่อสินค้า</th>
                            <th style="padding:8px;text-align:center;font-size:11px;color:#64748b;">ขอเบิก</th>
                            <th style="padding:8px;text-align:center;font-size:11px;color:#64748b;">จ่ายจริง</th>
                            <th style="padding:8px;text-align:center;font-size:11px;color:#64748b;">หน่วย</th>
                            <th style="padding:8px;text-align:left;font-size:11px;color:#64748b;">หมายเหตุ</th>
                        </tr></thead>
                        <tbody>${(d.items||[]).map(it=>`
                        <tr style="border-top:1px solid rgba(0,0,0,0.06);">
                            <td style="padding:8px;font-weight:bold;font-size:12px;">${it.id}</td>
                            <td style="padding:8px;font-size:12px;">${it.name}</td>
                            <td style="padding:8px;text-align:center;font-weight:bold;color:var(--info);">${it.qtyRequested}</td>
                            <td style="padding:8px;text-align:center;font-weight:bold;color:${it.qtyIssued>0?'var(--success)':'#94a3b8'};">${it.qtyIssued||'-'}</td>
                            <td style="padding:8px;text-align:center;color:#64748b;font-size:12px;">${it.unit}</td>
                            <td style="padding:8px;color:#64748b;font-size:11px;">${it.note||'-'}</td>
                        </tr>`).join('')}</tbody>
                    </table>
                    ${d.approvedBy?`<div style="margin-top:8px;font-size:11px;color:#64748b;">✅ อนุมัติโดย: ${d.approvedBy} เมื่อ ${d.approvedAt}</div>`:''}
                    ${d.issuedBy?`<div style="font-size:11px;color:#64748b;">📦 จ่ายโดย: ${d.issuedBy} เมื่อ ${d.issuedAt}</div>`:''}
                    ${d.rejectReason?`<div style="font-size:11px;color:#ef4444;">❌ เหตุผล: ${d.rejectReason}</div>`:''}
                </div>`;
            }).join('');
        }

        // ---- Actions ----
        window.approveReq = async function(docId) {
            if(!confirm('ยืนยันอนุมัติใบเบิกนี้?'))return;
            const {updateDoc} = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
            const now = new Date();
            await updateDoc(doc(db,'requisitions',docId),{
                status:'approved', approvedBy:currentUser.name,
                approvedAt:`${now.toLocaleDateString('th-TH')} ${now.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})}`
            });
            toast('✅ อนุมัติแล้ว','#059669');
            loadReqBadge();
            openPendingRequisitions();
        };

        window.rejectReq = async function(docId) {
            const reason = prompt('ระบุเหตุผลที่ไม่อนุมัติ:');
            if(reason===null)return;
            const {updateDoc} = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
            await updateDoc(doc(db,'requisitions',docId),{
                status:'rejected', approvedBy:currentUser.name, rejectReason:reason||'ไม่ระบุ'
            });
            toast('❌ ไม่อนุมัติแล้ว','#c2410c');
            loadReqBadge();
            openPendingRequisitions();
        };

        window.issueReq = async function(docId) {
            if(!confirm('ยืนยันจ่ายของครบแล้ว?'))return;
            const {updateDoc} = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
            const snap = await getDoc(doc(db,'requisitions',docId));
            const data = snap.data();
            const now = new Date();
            // อัปเดตสถานะ
            await updateDoc(doc(db,'requisitions',docId),{
                status:'issued', issuedBy:currentUser.name,
                issuedAt:`${now.toLocaleDateString('th-TH')} ${now.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})}`,
                'items': data.items.map(it=>({...it, qtyIssued:it.qtyRequested}))
            });
            toast('📦 บันทึกจ่ายของแล้ว','#059669');
            loadReqBadge();
            openPendingRequisitions();
        };

        // ---- Print PDF ----
        window.deleteMR = async function(docId, mrNumber) {
            if(currentUser?.role!=='admin'){toast('⚠️ เฉพาะแอดมินเท่านั้นที่ลบใบเบิกได้','#c2410c');return;}
            const confirmText = prompt(`⚠️ แอดมิน — พิมพ์เลขใบเบิก "${mrNumber}" เพื่อยืนยันการลบ:`);
            if(confirmText?.trim() !== mrNumber) { toast('❌ ยกเลิก','#c2410c'); return; }
            try {
                await deleteDoc(doc(db,'requisitions',docId));
                toast(`🗑️ ลบ ${mrNumber} เรียบร้อย`,'#059669');
                loadReqBadge();
                openMyRequisitions();
            } catch(e) { toast('❌ ลบไม่สำเร็จ','#c2410c'); }
        };

        window.printReq = async function(docId) {
            const snap = await getDoc(doc(db,'requisitions',docId));
            if(!snap.exists())return;
            const d = snap.data();
            const st = MR_STATUS[d.status]||MR_STATUS.pending;
            const rows = (d.items||[]).map((it,i)=>`<tr style="${i%2===0?'background:#f8fafc':''}">
                <td style="padding:9px;text-align:center;color:#64748b;">${i+1}</td>
                <td style="padding:9px;font-weight:bold;">${it.id}</td>
                <td style="padding:9px;">${it.name}</td>
                <td style="padding:9px;text-align:center;font-weight:bold;color:#3b82f6;">${it.qtyRequested}</td>
                <td style="padding:9px;text-align:center;font-weight:bold;color:#10b981;">${it.qtyIssued||'-'}</td>
                <td style="padding:9px;text-align:center;color:#64748b;">${it.unit}</td>
                <td style="padding:9px;color:#64748b;">${it.note||''}</td>
            </tr>`).join('');

            const html=`<!DOCTYPE html><html><head><meta charset="UTF-8">
            <style>
                body{font-family:'Sarabun',sans-serif;margin:0;padding:30px;color:#1e293b;font-size:13px;}
                .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:16px;border-bottom:3px solid #1e293b;}
                .badge{padding:6px 16px;border-radius:20px;font-weight:bold;font-size:13px;background:${st.color};color:white;}
                table{width:100%;border-collapse:collapse;margin-top:16px;}
                thead tr{background:#1e293b;color:white;}
                th{padding:10px;text-align:left;font-size:12px;}
                td{border-bottom:1px solid #e2e8f0;vertical-align:middle;}
                .meta{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px;}
                .meta-box{background:#f8fafc;border-radius:8px;padding:12px;}
                .meta-label{font-size:10px;color:#94a3b8;font-weight:bold;}
                .meta-val{font-weight:bold;margin-top:2px;}
                .footer{margin-top:40px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:30px;}
                .sign-box{text-align:center;padding-top:50px;border-top:1px solid #334155;}
                @media print{body{padding:15px;}}
            </style>
            <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap" rel="stylesheet">
            </head><body>
            <div class="header">
                <div>
                    <div style="font-size:20px;font-weight:bold;">🏢 TTGPlus</div>
                    <div style="color:#64748b;font-size:13px;margin-top:4px;">ใบขอเบิกสินค้า (Material Requisition)</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:18px;font-weight:bold;">${d.mrNumber}</div>
                    <div class="badge">${st.label}</div>
                </div>
            </div>
            <div class="meta">
                <div class="meta-box"><div class="meta-label">วันที่</div><div class="meta-val">${d.date}</div></div>
                <div class="meta-box"><div class="meta-label">ผู้ขอเบิก</div><div class="meta-val">${d.requestedBy}</div></div>
                <div class="meta-box"><div class="meta-label">แผนก</div><div class="meta-val">${d.department||'-'}</div></div>
                <div class="meta-box"><div class="meta-label">เบิกจากคลัง</div><div class="meta-val">${d.zone}</div></div>
                <div class="meta-box" style="grid-column:span 2;"><div class="meta-label">วัตถุประสงค์</div><div class="meta-val">${d.purpose||'-'}</div></div>
            </div>
            <table>
                <thead><tr>
                    <th style="width:35px;text-align:center;">#</th>
                    <th style="width:110px;">รหัสสินค้า</th>
                    <th>ชื่อสินค้า</th>
                    <th style="width:80px;text-align:center;">ขอเบิก</th>
                    <th style="width:80px;text-align:center;">จ่ายจริง</th>
                    <th style="width:60px;text-align:center;">หน่วย</th>
                    <th>หมายเหตุ</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>
            ${d.approvedBy?`<div style="margin-top:12px;padding:10px;background:#eff6ff;border-radius:8px;font-size:12px;">✅ อนุมัติโดย: <b>${d.approvedBy}</b> เมื่อ ${d.approvedAt}</div>`:''}
            ${d.issuedBy?`<div style="margin-top:6px;padding:10px;background:#f0fdf4;border-radius:8px;font-size:12px;">📦 จ่ายของโดย: <b>${d.issuedBy}</b> เมื่อ ${d.issuedAt}</div>`:''}
            <div class="footer">
                <div class="sign-box"><div style="font-size:11px;color:#64748b;">ผู้ขอเบิก</div></div>
                <div class="sign-box"><div style="font-size:11px;color:#64748b;">ผู้อนุมัติ</div></div>
                <div class="sign-box"><div style="font-size:11px;color:#64748b;">ผู้จ่ายสินค้า</div></div>
            </div>
            </body></html>`;

            const w=window.open('','_blank','width=900,height=700');
            w.document.write(html); w.document.close();
            setTimeout(()=>w.print(),800);
        };

        // ---- Export Excel ----
        window.exportReqExcel = function() {
            const docs = window._allReqDocs||[];
            if(!docs.length){toast('❌ ไม่มีข้อมูล','#c2410c');return;}
            const rows=[['เลขที่ MR','วันที่','ผู้ขอเบิก','แผนก','คลัง','วัตถุประสงค์','รหัสสินค้า','ชื่อสินค้า','ขอเบิก','จ่ายจริง','หน่วย','สถานะ']];
            docs.forEach(d=>{
                const st=MR_STATUS[d.status]?.label||d.status;
                (d.items||[]).forEach(it=>{
                    rows.push([d.mrNumber,d.date,d.requestedBy,d.department||'',d.zone,d.purpose||'',it.id,it.name,it.qtyRequested,it.qtyIssued||0,it.unit,st]);
                });
            });
            const ws=XLSX.utils.aoa_to_sheet(rows),wb=XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb,ws,'Requisitions');
            XLSX.writeFile(wb,`MR_${new Date().toLocaleDateString('th-TH').replace(/\//g,'-')}.xlsx`);
        };

        // ---- Badge counter ----
        async function loadReqBadge() {
            try {
                const snap = await getDocs(query(collection(db,'requisitions'), orderBy('createdAt','desc'), limit(300)));
                let pending = 0;
                snap.forEach(d=>{ if(d.data().status==='pending') pending++; });
                const badge = document.getElementById('reqBadge');
                if(badge) { badge.innerText = pending>0?pending:''; badge.style.display=pending>0?'':'none'; }
            } catch(e){}
        }

        // ======== REQUISITION SETTINGS ========
        const TEMPLATE_COLORS = ['#f59e0b','#3b82f6','#10b981','#7c3aed','#ef4444','#ec4899','#06b6d4','#84cc16'];

        // openRequisitionSettings + renderReqSettingsPage: superseded by version at line ~5459
        window.openNewTemplateForm = function(editId) {
            const c = document.getElementById('toolAppContainer');
            const existing = editId ? reqTemplates[editId] : null;
            const tid = editId || `tmpl_${Date.now()}`;
            const visibleZones = getVisibleWarehouses();

            document.getElementById('templateFormArea').innerHTML = `
            <div style="background:white;border-radius:14px;border:1px solid #e2e8f0;padding:24px;margin-top:8px;">
                <h4 style="margin-top:0;">${existing?'✏️ แก้ไข Template':'➕ สร้าง Template ใหม่'}</h4>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px;">
                    <div><label style="font-size:11px;font-weight:bold;color:#475569;display:block;margin-bottom:4px;">ชื่อ Template <span style="color:#ef4444;">*</span></label>
                        <input id="tf_name" value="${existing?.name||''}" placeholder="เช่น ใบเบิกแผนกบิงซู"
                            style="width:100%;padding:9px;border:1px solid #e2e8f0;border-radius:8px;box-sizing:border-box;font-size:13px;font-weight:bold;"></div>
                    <div><label style="font-size:11px;font-weight:bold;color:#475569;display:block;margin-bottom:4px;">แผนก</label>
                        <input id="tf_dept" value="${existing?.dept||''}" placeholder="เช่น ฝ่ายผลิตบิงซู"
                            style="width:100%;padding:9px;border:1px solid #e2e8f0;border-radius:8px;box-sizing:border-box;font-size:13px;"></div>
                    <div><label style="font-size:11px;font-weight:bold;color:#475569;display:block;margin-bottom:4px;">เบิกจากคลัง <span style="color:#ef4444;">*</span></label>
                        <select id="tf_zone" onchange="renderTemplateItems()" style="width:100%;padding:9px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-weight:bold;">
                            ${visibleZones.map(z=>`<option value="${z}" ${existing?.zone===z?'selected':''}>${z}</option>`).join('')}
                        </select></div>
                </div>
                <div style="margin-bottom:12px;"><label style="font-size:11px;font-weight:bold;color:#475569;display:block;margin-bottom:6px;">สีประจำ Template</label>
                    <div style="display:flex;gap:8px;">
                        ${TEMPLATE_COLORS.map(col=>`<div onclick="selectTmplColor('${col}')" id="tcolor_${col.replace('#','')}"
                            style="width:28px;height:28px;border-radius:50%;background:${col};cursor:pointer;border:3px solid ${existing?.color===col?'#1e293b':'transparent'};transition:border 0.15s;"></div>`).join('')}
                    </div>
                    <input type="hidden" id="tf_color" value="${existing?.color||TEMPLATE_COLORS[0]}">
                </div>
                <div style="margin-bottom:12px;">
                    <label style="font-size:11px;font-weight:bold;color:#475569;display:block;margin-bottom:6px;">เลือกสินค้าที่ใช้บ่อย (ติ๊กเพื่อใส่ใน Template)</label>
                    <input type="text" placeholder="🔍 ค้นหาสินค้า..." oninput="filterTmplItems(this.value)"
                        style="width:100%;padding:8px 14px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;margin-bottom:10px;outline:none;">
                    <div id="templateItemsList" style="max-height:280px;overflow-y:auto;border:1px solid #f1f5f9;border-radius:10px;"></div>
                </div>
                <div style="display:flex;gap:10px;justify-content:flex-end;">
                    <button onclick="saveTemplate('${tid}')" style="background:#7c3aed;color:white;border:none;padding:10px 28px;border-radius:10px;cursor:pointer;font-weight:bold;">💾 บันทึก Template</button>
                    <button onclick="document.getElementById('templateFormArea').innerHTML=''" style="background:#f1f5f9;color:#475569;border:none;padding:10px 18px;border-radius:10px;cursor:pointer;">ยกเลิก</button>
                </div>
            </div>`;

            window._editingTemplateId = tid;
            window._editingTemplateExisting = existing;
            renderTemplateItems();
            document.getElementById('templateFormArea').scrollIntoView({behavior:'smooth'});
        };

        window.selectTmplColor = function(col) {
            document.getElementById('tf_color').value = col;
            TEMPLATE_COLORS.forEach(c=>{
                const el = document.getElementById(`tcolor_${c.replace('#','')}`);
                if(el) el.style.border = `3px solid ${c===col?'#1e293b':'transparent'}`;
            });
        };

        window.renderTemplateItems = function() {
            const zone = document.getElementById('tf_zone')?.value||'';
            const existing = window._editingTemplateExisting;
            const checkedIds = new Set((existing?.items||[]).map(i=>i.id));
            const zoneProds = getZoneProducts(zone);
            const c = document.getElementById('templateItemsList'); if(!c) return;
            c.innerHTML = zoneProds.map(p=>{
                const u = (p.units||[{name:p.unit||''}])[0]?.name||'';
                return `<label class="tmpl-item-row" data-search="${p.id.toLowerCase()} ${p.name.toLowerCase()}"
                    style="display:flex;align-items:center;gap:10px;padding:9px 14px;border-bottom:1px solid #f8fafc;cursor:pointer;">
                    <input type="checkbox" id="titem_${p.id}" value="${p.id}" ${checkedIds.has(p.id)?'checked':''}
                        style="width:16px;height:16px;accent-color:#7c3aed;cursor:pointer;">
                    <span style="font-weight:bold;font-size:13px;min-width:90px;">${p.id}</span>
                    <span style="color:#475569;font-size:13px;flex:1;">${p.name}</span>
                    <span style="color:#94a3b8;font-size:11px;">${u}</span>
                </label>`;
            }).join('') || '<p style="color:#94a3b8;padding:16px;text-align:center;">ไม่มีสินค้าในคลังนี้</p>';
        };

        window.filterTmplItems = function(q) {
            q = q.toLowerCase().trim();
            document.querySelectorAll('.tmpl-item-row').forEach(row=>{
                row.style.display = (!q||row.dataset.search.includes(q)) ? '' : 'none';
            });
        };

        window.saveTemplate = function(tid) {
            const name = document.getElementById('tf_name')?.value.trim();
            const dept = document.getElementById('tf_dept')?.value.trim()||'';
            const zone = document.getElementById('tf_zone')?.value;
            const color = document.getElementById('tf_color')?.value||TEMPLATE_COLORS[0];
            if(!name){toast('⚠️ กรุณาใส่ชื่อ Template','#c2410c');return;}

            const items = allProducts.filter(p=>{
                const cb = document.getElementById(`titem_${p.id}`);
                return cb?.checked && (zoneProductMap[zone]||[]).includes(p.id);
            }).map(p=>({id:p.id, name:p.name, unit:(p.units||[{name:p.unit||''}])[0]?.name||''}));

            reqTemplates[tid] = {name, dept, zone, color, items};
            saveConfig();
            toast(`✅ บันทึก Template "${name}" แล้ว`,'#059669');
            const c = document.getElementById('toolAppContainer');
            renderReqSettingsPage(c);
        };

        window.editTemplate = function(id) {
            window._editingTemplateExisting = reqTemplates[id];
            openNewTemplateForm(id);
        };

        window.deleteTemplate = function(id) {
            if(!confirm(`ลบ Template "${reqTemplates[id]?.name}"?`))return;
            delete reqTemplates[id];
            saveConfig();
            const c = document.getElementById('toolAppContainer');
            renderReqSettingsPage(c);
            toast('🗑️ ลบ Template แล้ว','#64748b');
        };

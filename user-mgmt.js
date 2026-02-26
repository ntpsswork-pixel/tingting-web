/**
 * user-mgmt.js — TTGPlus
 * Auto-extracted from home.html
 * Depends on globals: db, currentUser, allProducts, warehouseList,
 *   zoneProductMap, countData, tempCountData, stockSheetTemplates,
 *   warehouseGroups, monthlyCountOpen, productCategories,
 *   saveConfig, toast, goToDashboard, closeTool,
 *   getVisibleWarehouses, getZoneProducts, loadCountData, saveCountData, XLSX
 */
        window.applyPermissions = function() {
            const role       = currentUser.role || 'guest';
            const perms      = roleSettings[role]?.menus || [];
            const isViewOnly = roleSettings[role]?.viewOnly || false;
            const effectivePerms = isViewOnly ? ["warehouse","tools","admin","requisition"] : perms;

            document.getElementById('warehouseMenu').classList.toggle('hidden', !effectivePerms.includes('warehouse'));
            document.getElementById('toolsMenu').classList.toggle('hidden', !effectivePerms.includes('tools'));
            document.getElementById('adminMenu').classList.toggle('hidden', !effectivePerms.includes('admin'));
            // requisition menu
            const reqMenu = document.getElementById('requisitionMenu');
            if(reqMenu) reqMenu.classList.toggle('hidden', !effectivePerms.includes('requisition'));
            const grMenu = document.getElementById('grMenu');
            if(grMenu) grMenu.classList.toggle('hidden', !effectivePerms.includes('gr'));
            const qcMenu = document.getElementById('qcMenu');
            if(qcMenu) qcMenu.classList.toggle('hidden', !effectivePerms.includes('qc'));
            // monthly count badge
            const badge = document.getElementById('monthlyCountBadge');
            if(badge){
                badge.innerText = monthlyCountOpen ? '🟢 เปิด' : '🔴 ปิด';
                badge.style.background = monthlyCountOpen ? '#dcfce7' : '#fee2e2';
                badge.style.color = monthlyCountOpen ? '#059669' : '#ef4444';
            }
            // approve/all sub-items only for warehouse/admin
            const canApprove = ['admin','warehouse'].includes(role);
            const reqApprove = document.getElementById('reqApproveMenu');
            const reqAll = document.getElementById('reqAllMenu');
            if(reqApprove) reqApprove.classList.toggle('hidden', !canApprove);
            if(reqAll) reqAll.classList.toggle('hidden', !canApprove);

            document.getElementById('viewOnlyAlert').classList.toggle('hidden', !isViewOnly);

            let existingStyle = document.getElementById("viewOnlyStyle");
            if (isViewOnly) {
                if (!existingStyle) {
                    const st = document.createElement('style');
                    st.id = "viewOnlyStyle";
                    st.innerHTML = `
                        button[onclick*="finalSaveStock"], button[onclick*="addNewUser"],
                        button[onclick*="addWh"], button[onclick*="addPd"],
                        button[onclick*="grantAccess"], button[onclick*="revokeAccess"],
                        button[onclick*="unbanUser"], button[onclick*="requestDelete"],
                        button[onclick*="cancelDelete"], button[onclick*="adminResetPassword"],
                        button[onclick*="updateStockTemp"], button[onclick*="saveEdit"],
                        button[onclick*="saveAssignedZones"], .btn-action { display: none !important; }
                        .viewonly-input { pointer-events: none !important; opacity: 0.7 !important; }
                    `;
                    document.head.appendChild(st);
                }
            } else if (existingStyle) { existingStyle.remove(); }

            document.getElementById('roleStatusText').innerText = "ฐานะ: " + role.toUpperCase() + (isViewOnly ? " (ดูอย่างเดียว)" : "");
        };

        window.checkToolExpiry = async function() {
            const now=new Date().getTime(), role=currentUser.role||'guest';
            const perms=roleSettings[role]?.menus||[], isVO=roleSettings[role]?.viewOnly||false;
            const effP = isVO ? ["warehouse","tools","admin"] : perms;
            const menu = document.getElementById('toolsMenu');
            if (!effP.includes('tools')) { menu.classList.add('hidden'); return; }
            if (role==='admin') { menu.classList.remove('hidden'); document.getElementById('timerDisplay').innerText="⏳ สิทธิ์: ถาวร"; return; }
            try {
                const snap=await getDoc(doc(db,'users',currentUser.username));
                if (!snap.exists()) { menu.classList.add('hidden'); return; }
                const expiry=snap.data().toolExpiry||0;
                if (now<expiry) {
                    menu.classList.remove('hidden');
                    if (expiry>4000000000000) { document.getElementById('timerDisplay').innerText="⏳ สิทธิ์: ถาวร"; }
                    else { const d=Math.floor((expiry-now)/60000); document.getElementById('timerDisplay').innerText=`⏳ เหลือ: ${Math.floor(d/60)}ชม. ${d%60}น.`; }
                } else { menu.classList.add('hidden'); }
            } catch(e) {}
        };

        window.checkHardBanStatus = async function() {
            if (!currentUser||currentUser.username==='admin') return;
            try {
                const snap=await getDoc(doc(db,'users',currentUser.username));
                if (snap.exists()&&snap.data().status==='suspended') { alert('🚫 บัญชีถูกระงับ!'); logout(); }
            } catch(e) {}
        };

        window.openUserManagement = function() {
            document.getElementById('dashboardView').classList.add('hidden');
            const c=document.getElementById('toolAppContainer'); c.classList.remove('hidden');
            c.innerHTML=`<div class="tool-header no-print"><h2>👤 จัดการพนักงาน & กำหนดสิทธิ์ Role</h2><button onclick="closeTool()">✕ ปิด</button></div>
            <div style="display:grid;grid-template-columns:1fr 1.5fr;gap:25px;">
                <div style="background:white;padding:20px;border-radius:15px;border:1px solid #e2e8f0;">
                    <h4 style="margin-top:0;">🎭 ตั้งค่า Role & สิทธิ์</h4>
                    <div style="display:flex;gap:8px;margin-bottom:15px;">
                        <input type="text" id="newRoleName" placeholder="ชื่อ Role ใหม่" style="flex:1;padding:10px;border-radius:8px;border:1px solid #ddd;">
                        <button onclick="addNewRole()" style="background:var(--success);color:white;border:none;padding:10px;border-radius:8px;cursor:pointer;">เพิ่ม Role</button>
                    </div>
                    <div id="rolePermissionsList"></div>
                </div>
                <div>
                    <div style="background:white;padding:20px;border-radius:15px;margin-bottom:20px;display:flex;gap:10px;flex-wrap:wrap;" class="no-print">
                        <input type="text" id="newUserName" placeholder="ชื่อพนักงาน" style="padding:10px;border-radius:8px;border:1px solid #ddd;flex:1;min-width:120px;">
                        <input type="text" id="newUserKey" placeholder="Username" style="padding:10px;border-radius:8px;border:1px solid #ddd;flex:1;min-width:120px;">
                        <input type="text" id="newUserPass" placeholder="Password (ไม่กรอก = 1234)" style="padding:10px;border-radius:8px;border:1px solid #ddd;flex:1;min-width:140px;">
                        <select id="newUserRole" style="padding:10px;border-radius:8px;flex:1;min-width:100px;"></select>
                        <button onclick="addNewUser()" style="background:var(--info);color:white;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;">+ เพิ่มพนักงาน</button>
                    </div>
                    <div id="userGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:15px;"></div>
                </div>
            </div>`;
            renderRoleSettings(); renderUserCards();
        };

        window.renderUserCards = async function() {
            const grid=document.getElementById('userGrid'); if(!grid) return;
            grid.innerHTML='<p style="color:#94a3b8;padding:20px;">กำลังโหลด...</p>';
            const snap=await getDocs(collection(db,'users')), now=new Date().getTime(); let html="";
            snap.forEach(d=>{
                const k=d.id, u=d.data(), active=u.toolExpiry>now, isSusp=u.status==='suspended';
                const isPendDel=u.deleteAt!=null&&u.deleteAt!==undefined;
                const isBranch=k.toUpperCase().startsWith('BT');
                let delInfo="";
                if(isPendDel){const dl=Math.ceil(((u.deleteAt+259200000)-now)/86400000);delInfo=`<div style="color:var(--danger);font-size:10px;margin-top:5px;font-weight:bold;">⏳ ลบถาวรใน ${dl>0?dl:0} วัน</div>`;}
                const assignedZones=u.assignedZones||[];
                const zoneInfo=isBranch?`<div style="font-size:11px;color:var(--info);margin-top:4px;">📍 คลัง: ${assignedZones.length>0?assignedZones.join(', '):'ยังไม่ได้ผูกคลัง'}</div>`:'';
                html+=`<div class="user-card" style="${isSusp?'border:2px solid var(--danger);background:#fff5f5;':''} ${isPendDel?'opacity:0.6;':''}">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                        <div>
                            <b id="uname_${k}">${u.name}</b>
                            <small style="color:#64748b;display:block;">ID: ${k}</small>
                        </div>
                        <div style="display:flex;gap:5px;align-items:center;">
                            ${isBranch?'<span style="font-size:10px;background:#dbeafe;color:#1d4ed8;padding:2px 6px;border-radius:4px;">สาขา</span>':''}
                            <span id="urole_${k}" style="font-size:10px;background:#eee;padding:2px 6px;border-radius:4px;">${u.role}</span>
                            <button onclick="openEditUserModal('${k}','${u.name}','${u.role}')" style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:5px;padding:3px 7px;cursor:pointer;font-size:11px;">✏️</button>
                        </div>
                    </div>
                    ${delInfo}${zoneInfo}
                    <div style="margin:12px 0;font-size:12px;display:flex;align-items:center;gap:6px;">
                        <span id="onlineDot_${k}"></span>
                        สถานะ: ${isSusp?'<b style="color:var(--danger);">⛔ ถูกระงับ</b>':(active?'🟢 มีสิทธิ์':'⚪ หมดสิทธิ์')}
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;" class="no-print">
                        <button onclick="grantAccess('${k}',5)" style="background:var(--info);color:white;border:none;padding:8px;border-radius:5px;cursor:pointer;font-size:11px;">+5 ชม.</button>
                        <button onclick="grantAccess('${k}',0)" style="background:var(--accent-gold);border:none;padding:8px;border-radius:5px;cursor:pointer;font-size:11px;">ถาวร</button>
                        ${isSusp?`<button onclick="unbanUser('${k}')" style="background:#0ea5e9;color:white;border:none;padding:8px;border-radius:5px;cursor:pointer;font-size:11px;">🔓 ปลดระงับ</button>`:`<button onclick="revokeAccess('${k}')" style="background:var(--danger);color:white;border:none;padding:8px;border-radius:5px;cursor:pointer;font-size:11px;">🚫 ระงับ</button>`}
                        ${isPendDel
                            ? `<button onclick="cancelDelete('${k}')" style="background:#64748b;color:white;border:none;padding:8px;border-radius:5px;cursor:pointer;font-size:11px;">↩️ กู้คืน</button>`
                            : `<button onclick="requestDelete('${k}')" style="background:#374151;color:white;border:none;padding:8px;border-radius:5px;cursor:pointer;font-size:11px;" title="รอ 3 วันก่อนลบถาวร">⏳ ลบ (3วัน)</button>`}
                        <button onclick="forceDeleteUser('${k}')" style="background:#ef4444;color:white;border:none;padding:8px;border-radius:5px;cursor:pointer;font-size:11px;font-weight:bold;" title="ลบทันที ไม่สามารถกู้คืนได้">🗑️ ลบทันที</button>
                        <button onclick="adminResetPassword('${k}')" style="grid-column:span 2;background:#7c3aed;color:white;border:none;padding:8px;border-radius:5px;cursor:pointer;font-size:11px;margin-top:2px;">🔑 Reset Password → 1234</button>
                        ${isBranch?`<button onclick="openAssignZoneModal('${k}')" style="grid-column:span 2;background:#0891b2;color:white;border:none;padding:8px;border-radius:5px;cursor:pointer;font-size:11px;margin-top:2px;">📍 ผูกคลังสาขา</button>`:''}
                    </div>
                </div>`;
            });
            grid.innerHTML=html||'<p style="color:#94a3b8;padding:20px;">ยังไม่มีพนักงาน</p>';
            // อัปเดต online dot ใน user cards
            const onlineRef2=ref(rtdb,'presence');
            onValue(onlineRef2,(snapshot)=>{
                const data=snapshot.val()||{};
                document.querySelectorAll('[id^="onlineDot_"]').forEach(el=>{
                    const uid=el.id.replace('onlineDot_','');
                    el.innerHTML=data[uid]?.online?'<span class="online-dot" title="ออนไลน์อยู่"></span>':'<span class="offline-dot" title="ออฟไลน์"></span>';
                });
            },{onlyOnce:true});
        };

        window.openAssignZoneModal = async function(username) {
            const snap=await getDoc(doc(db,'users',username));
            const userData=snap.exists()?snap.data():{};
            const assigned=userData.assignedZones||[];
            const savedTmplId = userData.stockTemplateId||'';
            const isBT = username.toUpperCase().startsWith('BT');

            // Template picker สำหรับ BT
            const sstEntries = Object.entries(stockSheetTemplates);
            const tmplPicker = isBT && sstEntries.length > 0 ? `
                <div style="margin-bottom:18px;padding:14px;background:#eff6ff;border:1.5px solid #bae6fd;border-radius:12px;">
                    <div style="font-size:12px;font-weight:700;color:#0369a1;margin-bottom:8px;">📋 Template ใบนับสต๊อกสิ้นเดือน</div>
                    <select id="zoneTemplateSelect" style="width:100%;padding:9px 12px;border:1.5px solid #bae6fd;border-radius:8px;font-size:13px;outline:none;background:white;">
                        <option value="">-- ไม่ระบุ (ใช้ Template แรก) --</option>
                        ${sstEntries.map(([id,t])=>`<option value="${id}" ${savedTmplId===id?'selected':''}>${t.name} (${(t.items||[]).length} รายการ)</option>`).join('')}
                    </select>
                </div>` : '<input type="hidden" id="zoneTemplateSelect" value="">';

            const modal=document.createElement('div'); modal.className='modal-overlay'; modal.id='assignZoneModal';
            modal.innerHTML=`<div class="modal-box"><h3>📍 ผูกคลังให้ ${username}</h3>
                <p style="color:#64748b;font-size:13px;margin-bottom:15px;">เลือกคลังที่ต้องการให้ user นี้มีสิทธิ์เข้าถึง</p>
                ${tmplPicker}
                <div id="zoneCheckList" style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px;">
                    ${warehouseList.map(wh=>`<label style="display:flex;align-items:center;gap:10px;padding:12px;border:1px solid #e2e8f0;border-radius:10px;cursor:pointer;">
                        <input type="checkbox" value="${wh}" ${assigned.includes(wh)?'checked':''} style="width:18px;height:18px;">
                        <span>${wh}</span></label>`).join('')}
                </div>
                <div style="display:flex;gap:10px;">
                    <button onclick="saveAssignedZones('${username}')" style="flex:1;background:var(--success);color:white;border:none;padding:12px;border-radius:10px;cursor:pointer;font-weight:bold;">✅ บันทึก</button>
                    <button onclick="document.getElementById('assignZoneModal').remove()" style="flex:1;background:#f1f5f9;color:#475569;border:none;padding:12px;border-radius:10px;cursor:pointer;">ยกเลิก</button>
                </div></div>`;
            document.body.appendChild(modal);
        };

        window.saveAssignedZones = async function(username) {
            const checks=document.querySelectorAll('#zoneCheckList input:checked');
            const zones=Array.from(checks).map(c=>c.value);
            const tmplId=document.getElementById('zoneTemplateSelect')?.value||'';
            const updateData={assignedZones:zones};
            if(tmplId) updateData.stockTemplateId=tmplId;
            await setDoc(doc(db,'users',username),updateData,{merge:true});
            if (currentUser.username===username){
                currentUser.assignedZones=zones;
                if(tmplId) currentUser.stockTemplateId=tmplId;
                localStorage.setItem('currentUser',JSON.stringify(currentUser));
            }
            document.getElementById('assignZoneModal').remove();
            toast('✅ ผูกคลัง' + (tmplId?' + Template ':' ') + 'เรียบร้อย','#059669'); renderUserCards();
        };

        window.adminResetPassword=async function(u){if(!confirm(`Reset Password ของ ${u} → "1234"?`))return;await setDoc(doc(db,'users',u),{password:await hashPassword('1234')},{merge:true});toast('✅ Reset เรียบร้อย Password ใหม่: 1234','#059669');};

        window.openEditUserModal=function(uid,uname,urole){
            const existing=document.getElementById('editUserModal');if(existing)existing.remove();
            const roleOpts=Object.keys(roleSettings).map(r=>`<option value="${r}" ${r===urole?'selected':''}>${r}</option>`).join('');
            const modal=document.createElement('div');modal.className='modal-overlay';modal.id='editUserModal';
            modal.innerHTML=`<div class="modal-box"><h3>✏️ แก้ไขข้อมูลพนักงาน</h3>
                <div style="font-size:12px;color:#64748b;margin-bottom:12px;">ID: ${uid}</div>
                <label style="font-size:12px;font-weight:bold;color:#475569;display:block;margin-bottom:4px;">ชื่อ-นามสกุล</label>
                <input type="text" id="editUserName" value="${uname}" style="width:100%;padding:10px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;box-sizing:border-box;margin-bottom:12px;">
                <label style="font-size:12px;font-weight:bold;color:#475569;display:block;margin-bottom:4px;">Role</label>
                <select id="editUserRole" style="width:100%;padding:10px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;margin-bottom:20px;">${roleOpts}</select>
                <div style="display:flex;gap:10px;">
                    <button onclick="saveEditUser('${uid}')" style="flex:1;background:var(--success);color:white;border:none;padding:12px;border-radius:10px;cursor:pointer;font-weight:bold;">✅ บันทึก</button>
                    <button onclick="document.getElementById('editUserModal').remove()" style="flex:1;background:#f1f5f9;color:#475569;border:none;padding:12px;border-radius:10px;cursor:pointer;">ยกเลิก</button>
                </div></div>`;
            document.body.appendChild(modal);
        };

        window.saveEditUser=async function(uid){
            const newName=document.getElementById('editUserName').value.trim();
            const newRole=document.getElementById('editUserRole').value;
            if(!newName){toast('⚠️ กรุณากรอกชื่อ','#c2410c');return;}
            await setDoc(doc(db,'users',uid),{name:newName,role:newRole},{merge:true});
            document.getElementById('editUserModal').remove();
            toast('✅ แก้ไขข้อมูลเรียบร้อย','#059669');
            renderUserCards();
        };
        window.unbanUser=async function(u){await setDoc(doc(db,'users',u),{status:'active'},{merge:true});toast('🔓 ปลดระงับเรียบร้อย','#059669');renderUserCards();};
        window.requestDelete=async function(u){if(!confirm(`⏳ ลบบัญชี ${u}?\nระบบจะรอ 3 วันก่อนลบถาวร (กู้คืนได้ภายใน 3 วัน)`))return;await setDoc(doc(db,'users',u),{deleteAt:new Date().getTime()},{merge:true});toast('⏳ กำหนดลบบัญชี '+u+' ภายใน 3 วัน','#c2410c');renderUserCards();};
        window.cancelDelete=async function(u){await setDoc(doc(db,'users',u),{deleteAt:null},{merge:true});toast('✅ กู้คืนบัญชีเรียบร้อย','#059669');renderUserCards();};
        window.grantAccess=async function(k,h){await setDoc(doc(db,'users',k),{toolExpiry:h===0?4070908800000:new Date().getTime()+(h*3600000),status:'active'},{merge:true});toast('✅ อัปเดตสิทธิ์เรียบร้อย','#059669');renderUserCards();};
        window.revokeAccess=async function(k){if(!confirm(`🚫 ระงับ ${k}?`))return;await setDoc(doc(db,'users',k),{toolExpiry:0,status:'suspended'},{merge:true});toast('🔒 ระงับเรียบร้อย','#c2410c');renderUserCards();};
        window.forceDeleteUser=function(u){
            const existing=document.getElementById('forceDeleteModal');if(existing)existing.remove();
            const modal=document.createElement('div');modal.className='modal-overlay';modal.id='forceDeleteModal';
            modal.innerHTML=`<div class="modal-box" style="border-top:4px solid #ef4444;">
                <h3 style="color:#ef4444;">⚠️ ลบบัญชีทันที</h3>
                <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:14px;margin-bottom:16px;">
                    <div style="font-weight:700;color:#991b1b;margin-bottom:6px;">คำเตือน: การลบนี้ไม่สามารถกู้คืนได้!</div>
                    <div style="font-size:13px;color:#7f1d1d;">บัญชี <b>${u}</b> จะถูกลบออกจากระบบทันที ประวัติการใช้งานทั้งหมดจะหายไป</div>
                </div>
                <div style="font-size:13px;color:#475569;margin-bottom:8px;font-weight:600;">พิมพ์ชื่อผู้ใช้ "<b>${u}</b>" เพื่อยืนยัน:</div>
                <input type="text" id="confirmDeleteInput" placeholder="พิมพ์ ${u} เพื่อยืนยัน"
                    style="width:100%;padding:11px 14px;border:2px solid #fca5a5;border-radius:10px;font-size:14px;box-sizing:border-box;outline:none;margin-bottom:16px;"
                    onfocus="this.style.borderColor='#ef4444'" onblur="this.style.borderColor='#fca5a5'">
                <div id="confirmDeleteError" style="color:#ef4444;font-size:12px;margin-bottom:10px;display:none;">❌ ชื่อไม่ตรง กรุณาพิมพ์ให้ถูกต้อง</div>
                <div style="display:flex;gap:10px;">
                    <button onclick="confirmForceDelete('${u}')"
                        style="flex:1;background:#ef4444;color:white;border:none;padding:13px;border-radius:10px;cursor:pointer;font-weight:700;font-size:14px;">
                        🗑️ ลบทันที
                    </button>
                    <button onclick="document.getElementById('forceDeleteModal').remove()"
                        style="flex:1;background:#f1f5f9;color:#475569;border:none;padding:13px;border-radius:10px;cursor:pointer;font-weight:600;">
                        ยกเลิก
                    </button>
                </div>
            </div>`;
            document.body.appendChild(modal);
            document.getElementById('confirmDeleteInput').focus();
        };

        window.confirmForceDelete=async function(u){
            const input=document.getElementById('confirmDeleteInput').value.trim();
            const errEl=document.getElementById('confirmDeleteError');
            if(input!==u){
                errEl.style.display='block';
                document.getElementById('confirmDeleteInput').style.borderColor='#ef4444';
                return;
            }
            errEl.style.display='none';
            try {
                await deleteDoc(doc(db,'users',u));
                document.getElementById('forceDeleteModal').remove();
                toast(`🗑️ ลบบัญชี ${u} เรียบร้อยแล้ว`,'#ef4444');
                renderUserCards();
            } catch(e) {
                toast('❌ เกิดข้อผิดพลาด: '+e.message,'#c2410c');
            }
        };

        window.addNewUser=async function(){
            const n=document.getElementById('newUserName').value.trim(),u=document.getElementById('newUserKey').value.trim(),r=document.getElementById('newUserRole').value,rp=document.getElementById('newUserPass').value.trim()||'1234';
            if(!n||!u)return;
            const ud={name:n,role:r,username:u,password:await hashPassword(rp),toolExpiry:0,status:'active'};
            if(u.toUpperCase().startsWith('BT'))ud.assignedZones=[];
            await setDoc(doc(db,'users',u),ud);
            toast('✅ เพิ่มพนักงานเรียบร้อย','#059669');
            document.getElementById('newUserName').value=document.getElementById('newUserKey').value=document.getElementById('newUserPass').value='';
            renderUserCards();
        };

        window.renderRoleSettings=function(){
            const list=document.getElementById('rolePermissionsList'),sel=document.getElementById('newUserRole');if(!list)return;
            let html='',opts='';
            Object.keys(roleSettings).forEach(role=>{
                const perms=roleSettings[role].menus,vo=roleSettings[role].viewOnly||false;
                html+=`<div style="padding:12px;border:1px solid #f1f5f9;border-radius:10px;margin-bottom:10px;background:#f8fafc;">
                    <div style="display:flex;justify-content:space-between;"><b style="text-transform:uppercase;">${role}</b>${role!=='admin'?`<small onclick="deleteRole('${role}')" style="color:red;cursor:pointer;">ลบ Role</small>`:''}</div>
                    <div style="display:flex;gap:10px;font-size:11px;margin-top:10px;flex-wrap:wrap;align-items:center;">
                        <label style="display:flex;align-items:center;gap:4px;background:#f8fafc;border:1px solid #e2e8f0;padding:4px 10px;border-radius:20px;cursor:pointer;">
                            <input type="checkbox" ${perms.includes('warehouse')?'checked':''} onchange="togglePerm('${role}','warehouse')"> 📦 คลัง</label>
                        <label style="display:flex;align-items:center;gap:4px;background:#f8fafc;border:1px solid #e2e8f0;padding:4px 10px;border-radius:20px;cursor:pointer;">
                            <input type="checkbox" ${perms.includes('requisition')?'checked':''} onchange="togglePerm('${role}','requisition')"> 📋 ใบเบิก</label>
                        <label style="display:flex;align-items:center;gap:4px;background:#f8fafc;border:1px solid #e2e8f0;padding:4px 10px;border-radius:20px;cursor:pointer;">
                            <input type="checkbox" ${perms.includes('tools')?'checked':''} onchange="togglePerm('${role}','tools')"> 🛠️ เครื่องมือ</label>
                        <label style="display:flex;align-items:center;gap:4px;background:#f0f9ff;border:1px solid #bae6fd;padding:4px 10px;border-radius:20px;cursor:pointer;">
                            <input type="checkbox" ${perms.includes('gr')?'checked':''} onchange="togglePerm('${role}','gr')" style="accent-color:#06b6d4;"> 🚚 GR</label>
                        <label style="display:flex;align-items:center;gap:4px;background:#faf5ff;border:1px solid #e9d5ff;padding:4px 10px;border-radius:20px;cursor:pointer;">
                            <input type="checkbox" ${perms.includes('qc')?'checked':''} onchange="togglePerm('${role}','qc')" style="accent-color:#7c3aed;"> 🔍 QC</label>
                        <label style="display:flex;align-items:center;gap:4px;background:#fef9f0;border:1px solid #fde68a;padding:4px 10px;border-radius:20px;cursor:pointer;">
                            <input type="checkbox" ${perms.includes('admin')?'checked':''} onchange="togglePerm('${role}','admin')" style="accent-color:#d97706;"> ⚙️ แอดมิน</label>
                        <label style="display:flex;align-items:center;gap:4px;background:#eff6ff;border:1px solid #bfdbfe;padding:4px 10px;border-radius:20px;cursor:pointer;color:#1d4ed8;font-weight:bold;">
                            <input type="checkbox" ${vo?'checked':''} onchange="toggleViewOnly('${role}')" style="accent-color:#3b82f6;"> 👁️ ดูอย่างเดียว</label>
                    </div></div>`;
                opts+=`<option value="${role}">${role}</option>`;
            });
            list.innerHTML=html;if(sel)sel.innerHTML=opts;
        };

        window.toggleViewOnly=function(r){roleSettings[r].viewOnly=!roleSettings[r].viewOnly;saveConfig();renderRoleSettings();applyPermissions();};
        window.togglePerm=function(r,m){const i=roleSettings[r].menus.indexOf(m);if(i>-1)roleSettings[r].menus.splice(i,1);else roleSettings[r].menus.push(m);saveConfig();applyPermissions();renderRoleSettings();};
        window.addNewRole=function(){const n=document.getElementById('newRoleName').value.trim().toLowerCase();if(n&&!roleSettings[n]){roleSettings[n]={menus:[],viewOnly:false};saveConfig();renderRoleSettings();}};
        window.deleteRole=function(r){if(confirm(`ลบ Role: ${r}?`)){delete roleSettings[r];saveConfig();renderRoleSettings();}};

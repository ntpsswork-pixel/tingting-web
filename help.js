/**
 * help.js — TTGPlus
 * Auto-extracted from home.html
 * Depends on globals: db, currentUser, allProducts, warehouseList,
 *   zoneProductMap, countData, tempCountData, stockSheetTemplates,
 *   warehouseGroups, monthlyCountOpen, productCategories,
 *   saveConfig, toast, goToDashboard, closeTool,
 *   getVisibleWarehouses, getZoneProducts, loadCountData, saveCountData, XLSX
 */
        window.openHelpGuide = function() {
            document.getElementById('dashboardView').classList.add('hidden');
            const c = document.getElementById('toolAppContainer'); c.classList.remove('hidden');

            const roleGuides = [
                {
                    role:'admin', icon:'⚙️', label:'ADMIN', color:'#f0b429', bg:'#fffbeb', border:'#fde68a',
                    title:'จัดการระบบทั้งหมด',
                    steps:[
                        '🏠 Dashboard — ดูภาพรวมสต๊อก แจ้งเตือนสินค้าต่ำกว่า Min',
                        '👥 จัดการพนักงาน & สิทธิ์ — เพิ่ม/ลบ User กำหนด Role และ checkbox สิทธิ์แต่ละเมนู',
                        '⏳ ลบ (3วัน) = รอ 3 วัน กู้คืนได้ | 🗑️ ลบทันที = พิมพ์ username ยืนยัน',
                        '📦 ตั้งค่าคลังและสินค้า — เพิ่มคลัง สินค้า กำหนด Min/Max Backup/Restore',
                        '🔒 เปิด/ปิดนับสต๊อกสิ้นเดือน — Admin เป็นคนควบคุมว่าทีมนับได้เมื่อไหร่',
                    ]
                },
                {
                    role:'boss', icon:'👔', label:'BOSS', color:'#f59e0b', bg:'#fffbeb', border:'#fde68a',
                    title:'ผู้บริหาร — ดูและติดตามทุกอย่าง',
                    steps:[
                        '🏠 Dashboard — ภาพรวมสต๊อกทุกคลัง แจ้งเตือนวิกฤต',
                        '📊 QC Report — ดู Pass Rate FIFO รายสัปดาห์ สินค้าที่ Fail บ่อยที่สุด',
                        '🏷️ Lot Register — ตรวจสอบสินค้าใกล้หมดอายุ (EXP Alert 30 วัน)',
                        '📋 ใบเบิกทั้งหมด — ติดตาม workflow การเบิกของทุกแผนก',
                        '🚚 ประวัติ GR — ดูการรับสินค้าเข้า ติดตาม Supplier',
                    ]
                },
                {
                    role:'warehouse', icon:'🏭', label:'WAREHOUSE', color:'#06b6d4', bg:'#ecfeff', border:'#a5f3fc',
                    title:'ฝ่ายคลัง — ทำงานคลังครบวงจร',
                    steps:[
                        '🚚 รับสินค้าเข้าคลัง (GR) — สร้าง GR → เพิ่มสินค้า → กรอก Lot + EXP → บันทึก',
                        '📋 อนุมัติใบเบิก — รออนุมัติ → กดอนุมัติ → จ่ายของ → กด "จ่ายแล้ว"',
                        '📦 นับสต๊อก — เลือกโซน → เลือกวันที่ → กรอกยอด → บันทึก',
                        '📊 Daily Stock Card — บันทึกรับ-จ่าย-คงเหลือ variance คำนวณอัตโนมัติ',
                        '📈 Export รายงาน — ประวัติ & Export → เลือก format Excel / TRCloud',
                    ]
                },
                {
                    role:'staff', icon:'👨‍🍳', label:'STAFF', color:'#10b981', bg:'#f0fdf4', border:'#bbf7d0',
                    title:'พนักงาน — เบิกสินค้าและนับสต๊อก',
                    steps:[
                        '📋 สร้างใบเบิกใหม่ — ระบบเบิกสินค้า → สร้างใบเบิกใหม่',
                        '📄 เลือก Template — เลือก Template สำเร็จรูป หรือเลือกสินค้าเอง',
                        '✅ ส่งใบเบิก — กรอกจำนวน → กด "ส่งใบเบิก" → รอฝ่ายคลังอนุมัติ',
                        '👁️ ดูสถานะ — ระบบเบิก → "ใบเบิกของฉัน" ดูสถานะ รออนุมัติ / อนุมัติแล้ว / จ่ายแล้ว',
                        '🛠️ นับสต๊อกสิ้นเดือน — เครื่องมือ → นับสต๊อกสิ้นเดือน (เมื่อ Admin เปิด)',
                    ]
                },
                {
                    role:'branch', icon:'🏪', label:'BRANCH', color:'#3b82f6', bg:'#eff6ff', border:'#bfdbfe',
                    title:'สาขา — เบิกสินค้าอย่างเดียว',
                    steps:[
                        '📋 สร้างใบเบิก — ระบบเบิกสินค้า → สร้างใบเบิกใหม่',
                        '📦 ระบบแสดงเฉพาะสินค้าในคลังที่ถูกผูกไว้กับสาขานั้น',
                        '✅ ส่งใบเบิก — เลือกสินค้า กรอกจำนวน → กด "ส่งใบเบิก"',
                        '👁️ ดูสถานะ — 🟡 รออนุมัติ → 🟢 อนุมัติแล้ว → 📦 จ่ายแล้ว',
                        '⛔ ไม่มีสิทธิ์ดูคลัง/เครื่องมือ/GR/QC — เห็นแค่เมนูใบเบิก',
                    ]
                },
                {
                    role:'qc', icon:'🔍', label:'QC', color:'#7c3aed', bg:'#faf5ff', border:'#e9d5ff',
                    title:'QC — ตรวจสอบ FIFO',
                    steps:[
                        '🚚 ดู GR — รับสินค้าเข้าคลัง → ประวัติ GR → ดู Lot ที่รับเข้าวันนี้',
                        '🔍 เริ่ม Spot Check — QC FIFO → เริ่ม Spot Check → เลือกสินค้าที่จะตรวจ',
                        '📌 ระบบแสดง "ควรหยิบ Lot ไหน" ตาม FIFO อัตโนมัติ',
                        '🏭 ไปดูหน้างาน → กลับมากรอก Lot ที่เห็นจริง + ตำแหน่งจัดเก็บ',
                        '✅ เลือกผล: ✅ ผ่าน / ⚠️ น่าสงสัย / ❌ ไม่ผ่าน → บันทึก → ดู Report',
                    ]
                },
            ];

            const sections = [
                {
                    icon:'🏠', title:'Dashboard & ทั่วไป',
                    color:'#3b82f6',
                    items:[
                        {q:'Dashboard แสดงอะไรบ้าง?', a:'แสดงภาพรวมสต๊อกทุกคลัง แนวโน้มการนับ 7 วันล่าสุด session ล่าสุด และถ้ามีสินค้าต่ำกว่า Min จะขึ้นแจ้งเตือนสีแดงทันที'},
                        {q:'เปลี่ยน Password ได้ที่ไหน?', a:'ด้านซ้ายบน ใต้ชื่อผู้ใช้ มีปุ่ม 🔑 เปลี่ยน Password กรอก Password เก่าและใหม่แล้วกดยืนยัน'},
                        {q:'ระบบ logout อัตโนมัติเมื่อไหร่?', a:'ไม่มีการใช้งาน 30 นาที ระบบจะแจ้งเตือนก่อน 2 นาที กด "ฉันยังอยู่" เพื่อต่ออายุ Session'},
                        {q:'Role คืออะไร แต่ละ Role เห็นอะไร?', a:'Role กำหนดว่าใครเข้าถึงเมนูไหนได้บ้าง: admin=ทุกอย่าง, boss=ทุกอย่างยกเว้นจัดการระบบ, warehouse=คลัง+ใบเบิก+GR, staff=ใบเบิก+เครื่องมือ, branch=ใบเบิกอย่างเดียว, qc=GR+QC FIFO'},
                    ]
                },
                {
                    icon:'🚚', title:'รับสินค้าเข้าคลัง (GR)',
                    color:'#06b6d4',
                    items:[
                        {q:'วิธีสร้างใบรับสินค้า GR?', a:'รับสินค้าเข้าคลัง → สร้างใบรับสินค้า (GR) → เลือกคลัง → ค้นหาสินค้า → กรอกจำนวนรับ Lot Number MFD EXP → กดบันทึก'},
                        {q:'Lot Number คืออะไร ต้องกรอกเองไหม?', a:'Lot Number คือรหัสระบุ batch สินค้า ระบบสร้างให้อัตโนมัติ (แก้ไขได้) ควรตรงกับที่พิมพ์บนสินค้าจริง เพื่อให้ QC ตรวจสอบได้'},
                        {q:'สถานะสินค้าในแต่ละบรรทัดมีอะไรบ้าง?', a:'✅ ครบ = รับครบตามแผน | ⚠️ ไม่ครบ = รับได้บางส่วน | ➕ ของแทรก = ของที่ไม่ได้สั่งมาด้วย | ❌ เสียหาย = ของเสียหายรับไม่ได้'},
                        {q:'หลังบันทึก GR แล้วเกิดอะไรขึ้น?', a:'ระบบอัปเดต Lot Register อัตโนมัติ เรียง Lot ตามวันหมดอายุ (EXP เก่าสุดก่อน) QC สามารถเห็น GR ใหม่ได้ทันที'},
                    ]
                },
                {
                    icon:'🏷️', title:'Lot Register & FIFO',
                    color:'#1e3a5f',
                    items:[
                        {q:'Lot Register คืออะไร?', a:'ทะเบียนบันทึกทุก Lot ที่รับเข้ามา แสดงว่าแต่ละสินค้ามี Lot อะไรเหลืออยู่บ้าง ระบบเรียงตาม EXP เก่าสุดก่อน เพื่อให้หยิบถูก FIFO'},
                        {q:'FIFO คืออะไร ทำไมสำคัญ?', a:'First In First Out = ของที่รับเข้ามาก่อนต้องใช้ก่อน ป้องกันของหมดอายุในคลัง ลดของเสีย และมาตรฐาน Food Safety'},
                        {q:'แจ้งเตือนสินค้าใกล้หมดอายุทำงานอย่างไร?', a:'Lot Register จะแสดง banner เหลืองเมื่อมีสินค้าที่ EXP เหลือน้อยกว่า 30 วัน เรียงจากวิกฤตสุดก่อน'},
                    ]
                },
                {
                    icon:'🔍', title:'QC FIFO Spot Check',
                    color:'#7c3aed',
                    items:[
                        {q:'ขั้นตอน QC Spot Check เป็นอย่างไร?', a:'QC FIFO → เริ่ม Spot Check → เลือกสินค้าที่จะตรวจ → ระบบแสดง Lot ที่ควรหยิบ → ไปดูหน้างาน → กรอก Lot ที่เห็นจริง → เลือกผล (ผ่าน/น่าสงสัย/ไม่ผ่าน) → บันทึก'},
                        {q:'ผล QC มี 3 แบบ ต่างกันอย่างไร?', a:'✅ ผ่าน = หยิบถูก FIFO ตรงกับที่ระบบแนะนำ | ⚠️ น่าสงสัย = ไม่แน่ใจ อาจมีความผิดพลาด | ❌ ไม่ผ่าน = หยิบ Lot ผิด ไม่ได้ทำตาม FIFO'},
                        {q:'QC Report ดูได้ที่ไหน?', a:'QC FIFO → ประวัติ QC Report → เห็น Pass Rate รวม สินค้าที่ Fail บ่อยที่สุด และประวัติทุก session'},
                    ]
                },
                {
                    icon:'📦', title:'คลังสินค้า',
                    color:'#f59e0b',
                    items:[
                        {q:'ประวัติ & Export รายงาน คืออะไร?', a:'ดูประวัติการนับสต๊อกทุกครั้ง Export เป็น Excel ได้ 2 แบบ: (1) ประวัติย้อนหลัง (2) ยอดล่าสุด Snapshot'},
                        {q:'สรุปยอดสั่งซื้อทำงานอย่างไร?', a:'ระบบเปรียบยอดคงเหลือกับ Min/Max ที่ตั้งไว้ ถ้าต่ำกว่า Min จะขึ้น 🔴 ต้องสั่งด่วน พร้อมแนะนำจำนวนสั่ง = Max - คงเหลือ'},
                        {q:'Export TRCloud Format ใช้ทำอะไร?', a:'Export Excel format ตรงกับใบ PR ของ TRCloud กรอกข้อมูลหัวเอกสารแล้วนำไปอ้างอิงตอนคีย์ใน TRCloud ได้เลย'},
                    ]
                },
                {
                    icon:'📋', title:'ระบบเบิกสินค้า',
                    color:'#f59e0b',
                    items:[
                        {q:'ขั้นตอนการเบิกสินค้าเป็นอย่างไร?', a:'(1) Staff/Branch สร้างใบเบิก → (2) Warehouse กด "อนุมัติ" → (3) จ่ายของแล้วกด "จ่ายแล้ว" → (4) พิมพ์ PDF ได้เลย'},
                        {q:'Template ใบเบิกคืออะไร?', a:'สร้างรายการสินค้าที่เบิกบ่อย เช่น "ใบเบิกแผนกบิงซู" ครั้งถัดไปกดใช้ Template ได้เลย ไม่ต้องเลือกสินค้าใหม่ทุกครั้ง'},
                        {q:'ใครสามารถอนุมัติใบเบิกได้?', a:'Role warehouse, boss และ admin เท่านั้น Staff/Branch สร้างและดูใบเบิกของตัวเองได้ แต่อนุมัติไม่ได้'},
                        {q:'ถ้าสั่งผิดแก้ไขได้ไหม?', a:'ใบเบิกที่ยังเป็น "รออนุมัติ" ฝ่ายคลังสามารถ "ไม่อนุมัติ" พร้อมระบุเหตุผล แล้วให้สร้างใบเบิกใหม่'},
                    ]
                },
                {
                    icon:'🛠️', title:'เครื่องมือ',
                    color:'#10b981',
                    items:[
                        {q:'วิธีนับสต๊อก?', a:'เลือกโซน → เลือกวันที่ (บังคับ) → เลือกชื่อคนนับ → กรอกจำนวนแล้วกด Enter หรือปุ่ม + → กด "ยืนยันและบันทึก"'},
                        {q:'Daily Stock Card คืออะไร?', a:'บันทึกประจำวัน: ยอดยกมา + รับเข้า - จ่ายออก = คงเหลือ ระบบคำนวณ Variance (ผลต่าง) อัตโนมัติ แทนกระดาษ Stock Card เดิม'},
                        {q:'ถ้ากรอกผิดแก้ได้ไหม?', a:'Admin สามารถแก้ยอดสต๊อกได้จากหน้า Export → ยอดสต๊อกล่าสุด กดปุ่ม ✏️ แล้วระบุเหตุผล ทุกการแก้ไขบันทึกใน Audit Log'},
                    ]
                },
                {
                    icon:'⚙️', title:'จัดการระบบ (Admin)',
                    color:'#7c3aed',
                    items:[
                        {q:'เพิ่มพนักงานใหม่ทำอย่างไร?', a:'จัดการระบบ → จัดการพนักงาน & สิทธิ์ → กด + เพิ่มพนักงาน ใส่ชื่อ Username Password Role'},
                        {q:'ลบพนักงานมี 2 แบบต่างกันอย่างไร?', a:'⏳ ลบ (3วัน) = รอ 3 วันก่อนลบถาวร กู้คืนได้ระหว่างนั้น | 🗑️ ลบทันที = ต้องพิมพ์ username ยืนยัน ลบแล้วกู้คืนไม่ได้'},
                        {q:'กำหนดสิทธิ์ Role ทำอย่างไร?', a:'ตั้งค่า Role & สิทธิ์ → เลือก Role → tick checkbox ที่ต้องการ: 📦คลัง 📋ใบเบิก 🛠️เครื่องมือ 🚚GR 🔍QC ⚙️แอดมิน 👁️ดูอย่างเดียว'},
                        {q:'ตั้งค่า Min/Max ทำอย่างไร?', a:'ตั้งค่าคลังและสินค้า → กำหนด Min/Max สต๊อกต่อคลัง เลือกคลังแล้วกรอก กด "บันทึก Min/Max คลังนี้"'},
                        {q:'Backup/Restore ข้อมูลทำอย่างไร?', a:'ตั้งค่าคลังและสินค้า → ปุ่ม 💾 Backup Config / 📂 Restore Config บันทึกเป็น JSON ไว้ใช้กรณีฉุกเฉิน'},
                    ]
                },
            ];

            c.innerHTML = `
            <div class="tool-header no-print">
                <h2>📖 คู่มือการใช้งาน TTGPlus</h2>
                <button onclick="goToDashboard()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;">🏠 Dashboard</button><button onclick="closeTool()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;">✕ ปิด</button>
            </div>

            <!-- HERO BANNER -->
            <div style="background:linear-gradient(135deg,#0b1629,#1e3a5f);border-radius:16px;padding:24px;margin-bottom:20px;color:white;">
                <div style="font-size:18px;font-weight:bold;margin-bottom:6px;">📖 คู่มือการใช้งาน TTGPlus v2.0</div>
                <div style="color:#94a3b8;font-size:13px;line-height:1.6;margin-bottom:16px;">คู่มือแบ่งเป็น 2 ส่วน: <b style="color:#f0b429;">คู่มือตามตำแหน่ง</b> (เห็นทันทีว่าคุณต้องทำอะไร) และ <b style="color:#06b6d4;">FAQ</b> (ตอบคำถามพบบ่อย)</div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button onclick="document.getElementById('roleGuideSection').scrollIntoView({behavior:'smooth'})"
                        style="background:#f0b429;color:#0b1629;border:none;padding:7px 16px;border-radius:20px;cursor:pointer;font-size:12px;font-weight:bold;">
                        👤 คู่มือตามตำแหน่ง
                    </button>
                    ${sections.map(s=>`<button onclick="scrollToSection('help_${s.title}')"
                        style="background:rgba(255,255,255,0.1);color:white;border:1px solid rgba(255,255,255,0.2);padding:7px 14px;border-radius:20px;cursor:pointer;font-size:12px;">
                        ${s.icon} ${s.title}</button>`).join('')}
                </div>
            </div>

            <!-- ROLE GUIDE SECTION -->
            <div id="roleGuideSection">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
                    <div style="width:4px;height:24px;background:#f0b429;border-radius:2px;"></div>
                    <h3 style="margin:0;font-size:16px;color:#1e293b;">👤 คู่มือตามตำแหน่ง — ฉันต้องทำอะไร?</h3>
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;margin-bottom:28px;">
                    ${roleGuides.map(rg=>`
                    <div style="background:${rg.bg};border:1.5px solid ${rg.border};border-radius:14px;overflow:hidden;">
                        <div style="background:${rg.color};padding:12px 16px;display:flex;align-items:center;gap:10px;">
                            <span style="font-size:20px;">${rg.icon}</span>
                            <div>
                                <div style="font-weight:800;color:${rg.role==='boss'||rg.role==='warehouse'?'#0b1629':'white'};font-size:14px;letter-spacing:0.5px;">${rg.label}</div>
                                <div style="font-size:11px;color:${rg.role==='boss'||rg.role==='warehouse'?'rgba(0,0,0,0.5)':'rgba(255,255,255,0.8)'};">${rg.title}</div>
                            </div>
                        </div>
                        <div style="padding:14px 16px;">
                            ${rg.steps.map((step,si)=>`
                            <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:${si<rg.steps.length-1?'10px':'0'};">
                                <div style="min-width:22px;height:22px;background:${rg.color};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;color:${rg.role==='boss'||rg.role==='warehouse'?'#0b1629':'white'};flex-shrink:0;margin-top:1px;">${si+1}</div>
                                <div style="font-size:12.5px;color:#334155;line-height:1.55;">${step}</div>
                            </div>`).join('')}
                        </div>
                    </div>`).join('')}
                </div>
            </div>

            <!-- FAQ SECTION -->
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
                <div style="width:4px;height:24px;background:#06b6d4;border-radius:2px;"></div>
                <h3 style="margin:0;font-size:16px;color:#1e293b;">❓ FAQ — คำถามที่พบบ่อย</h3>
            </div>
            ${sections.map(s=>`
            <div id="help_${s.title}" style="background:white;border-radius:14px;border:1px solid #e2e8f0;margin-bottom:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
                <div style="background:${s.color};padding:12px 18px;display:flex;align-items:center;gap:10px;">
                    <span style="font-size:18px;">${s.icon}</span>
                    <span style="font-weight:bold;color:white;font-size:14px;">${s.title}</span>
                </div>
                <div style="padding:2px 0;">
                    ${s.items.map((item,i)=>`
                    <div style="border-bottom:1px solid #f1f5f9;">
                        <button onclick="toggleHelp('h${s.title}${i}')"
                            style="width:100%;text-align:left;padding:13px 18px;background:none;border:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;font-size:13px;font-weight:600;color:#1e293b;gap:10px;">
                            <span>${item.q}</span>
                            <span id="harrow_h${s.title}${i}" style="color:#94a3b8;font-size:14px;transition:transform 0.25s;flex-shrink:0;">▼</span>
                        </button>
                        <div id="h${s.title}${i}" style="display:none;padding:4px 18px 14px 18px;font-size:13px;color:#475569;line-height:1.75;background:#f8fafc;border-top:1px solid #e2e8f0;">
                            <div style="display:flex;gap:8px;align-items:flex-start;">
                                <span style="font-size:15px;margin-top:1px;">💡</span>
                                <span>${item.a}</span>
                            </div>
                        </div>
                    </div>`).join('')}
                </div>
            </div>`).join('')}

            <div style="text-align:center;padding:24px;color:#94a3b8;font-size:12px;border-top:1px solid #f1f5f9;margin-top:8px;">
                TTGPlus v2.0 • พัฒนาสำหรับ TTG Food
            </div>`;
        };

        window.toggleHelp = function(id) {
            const el = document.getElementById(id);
            const arrow = document.getElementById('harrow_'+id);
            if(!el) return;
            const open = el.style.display === 'none';
            el.style.display = open ? 'block' : 'none';
            if(arrow) arrow.style.transform = open ? 'rotate(180deg)' : '';
        };

        window.scrollToSection = function(id) {
            document.getElementById(id)?.scrollIntoView({behavior:'smooth'});
        };

        // ---- Use template in Create Requisition ----
        window.openCreateRequisitionWithTemplate = function(tid) {
            window._useTemplate = reqTemplates[tid];
            openCreateRequisition();
        };

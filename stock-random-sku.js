// stock-random-sku.js — TTGPlus | openRandomSKUCount, saveRandomSKUCount
        window.openRandomSKUCount = function() {
            const isBT = currentUser?.username?.toUpperCase().startsWith('BT');
            const zone = isBT
                ? (currentUser.assignedZones||[])[0] || ''
                : ''; // admin กรอกเอง

            // สุ่ม 10 SKU จาก allProducts
            // BT: สุ่มเฉพาะ products ของ zone ตัวเอง  Admin: ทั้งหมด
            const btZoneProducts = isBT && zone
                ? (zoneProductMap[zone]||[])
                : null;
            const pool = [...allProducts].filter(p => p.id && p.name && (!btZoneProducts || btZoneProducts.includes(p.id)));
            const shuffled = pool.sort(()=>Math.random()-0.5).slice(0,Math.min(10,pool.length));

            document.getElementById('dashboardView').classList.add('hidden');
            const c = document.getElementById('toolAppContainer'); c.classList.remove('hidden');
            const now = new Date();
            const today = now.toISOString().slice(0,10);
            const timeStr = now.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});

            c.innerHTML = `
            <div class="tool-header no-print">
                <h2>🎲 ทดลองนับสต๊อก — ${shuffled.length} SKU สุ่ม</h2>
                <div style="display:flex;gap:8px;">
                    <button onclick="openRandomSKUCount()" style="background:#7c3aed;color:white;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-weight:bold;">🎲 สุ่มใหม่</button>
                    <button onclick="goToDashboard()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;">🏠</button>
                    <button onclick="closeTool()" style="background:#f1f5f9;color:#475569;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;">✕</button>
                </div>
            </div>
            <div style="background:#f5f3ff;border:1.5px solid #ddd6fe;border-radius:12px;padding:12px 16px;margin-bottom:16px;font-size:13px;color:#5b21b6;" class="no-print">
                🎯 <b>โหมดทดลอง Pilot</b> — สุ่ม ${shuffled.length} รายการจากสินค้าทั้งหมด ${allProducts.length} รายการ • ข้อมูลจะบันทึกแยกใน collection <code>pilotCounts</code> ไม่กระทบ stock จริง
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-bottom:20px;" class="no-print">
                <div class="input-group" style="border:2px solid var(--danger);"><label>📅 วันที่นับ</label>
                    <input type="date" id="rnd_date" value="${today}" style="width:100%;border:none;font-weight:bold;outline:none;font-size:14px;color:#1e293b;">
                </div>
                <div class="input-group" style="border:2px solid var(--info);${isBT?'background:#f0fdf4;':''}"><label>📦 คลัง/สาขา</label>
                    ${isBT
                        ? `<b style="font-size:14px;color:#065f46;">${zone}</b><input type="hidden" id="rnd_zone" value="${zone}">`
                        : `<input type="text" id="rnd_zone" value="${zone}" placeholder="ระบุคลัง/สาขา..." style="width:100%;border:none;font-weight:bold;outline:none;font-size:14px;color:#1e293b;font-family:inherit;">`
                    }
                </div>
                <div class="input-group" style="background:#f0fdf4;border:1.5px solid #bbf7d0;"><label>🙋 ผู้นับ</label>
                    <b style="font-size:13px;color:#065f46;">${currentUser?.name||''}</b>
                </div>
            </div>
            <div style="background:white;border-radius:14px;border:1px solid #e2e8f0;overflow:hidden;margin-bottom:20px;">
            <table style="width:100%;border-collapse:collapse;">
                <thead><tr style="background:#5b21b6;color:white;">
                    <th style="padding:12px 16px;text-align:left;font-size:12px;">สินค้า</th>
                    <th style="padding:12px;text-align:center;font-size:12px;background:#4c1d95;">ยอดนับได้</th>
                    <th style="padding:12px;text-align:center;font-size:12px;">หน่วย</th>
                    <th style="padding:12px;text-align:center;font-size:12px;">หมายเหตุ</th>
                </tr></thead>
                <tbody>
                ${shuffled.map((p,idx)=>{
                    const unit = (p.units||[{name:p.unit||''}])[0]?.name||p.unit||'';
                    return `
                    <tr style="border-bottom:1px solid #f1f5f9;${idx%2===1?'background:#fafafa':''}">
                        <td style="padding:12px 16px;">
                            <div style="font-weight:700;font-size:13px;">${p.id}</div>
                            <div style="color:#475569;font-size:12px;">${p.name}</div>
                        </td>
                        <td style="padding:12px;text-align:center;">
                            <input type="number" id="rnd_${p.id}" min="0" placeholder="0"
                                style="width:90px;padding:9px;border-radius:10px;border:2px solid #7c3aed;text-align:center;font-weight:700;font-size:16px;outline:none;"
                                onfocus="this.style.borderColor='#4c1d95'" onblur="this.style.borderColor='#7c3aed'">
                        </td>
                        <td style="padding:12px;text-align:center;color:#64748b;font-size:13px;">${unit}</td>
                        <td style="padding:12px;">
                            <input type="text" id="rndNote_${p.id}" placeholder="หมายเหตุ"
                                style="width:100%;padding:7px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;box-sizing:border-box;outline:none;">
                        </td>
                    </tr>`;
                }).join('')}
                </tbody>
            </table>
            </div>
            <div style="text-align:center;padding-bottom:20px;" class="no-print">
                <button onclick="saveRandomSKUCount()"
                    style="background:#7c3aed;color:white;padding:14px 50px;border:none;border-radius:12px;font-size:16px;font-weight:bold;cursor:pointer;box-shadow:0 4px 15px rgba(124,58,237,.3);">
                    💾 บันทึกผลทดลองนับ
                </button>
            </div>`;
            // เก็บ skuList ไว้ใน window แทนการฝังใน onclick
            window._rndSkuList = shuffled.map(p=>({
                id:p.id, name:p.name,
                unit:(p.units||[{name:p.unit||''}])[0]?.name||p.unit||''
            }));
        };

        window.saveRandomSKUCount = async function() {
            const skuList = window._rndSkuList;
            if(!skuList?.length){ toast('⚠️ ไม่พบรายการสุ่ม','#c2410c'); return; }
            const dateVal = document.getElementById('rnd_date')?.value;
            const zone = document.getElementById('rnd_zone')?.value.trim();
            if(!dateVal||!zone){toast('⚠️ กรุณากรอกวันที่และคลัง','#c2410c');return;}
            const [cy,cm,cd]=dateVal.split('-');
            const dateTH=`${cd}/${cm}/${parseInt(cy)+543}`;

            const items = skuList.map(p=>({
                id:p.id, name:p.name, unit:p.unit,
                balance:parseFloat(document.getElementById(`rnd_${p.id}`)?.value)||0,
                note:document.getElementById(`rndNote_${p.id}`)?.value.trim()||''
            }));

            try {
                await addDoc(collection(db,'pilotCounts'),{
                    zone, date:dateTH, month:`${cy}-${cm}`,
                    timestamp:Date.now(),
                    countedBy:currentUser.name,
                    skuCount:skuList.length,
                    items
                });
                toast('✅ บันทึกผลทดลองนับเรียบร้อย','#7c3aed');
                goToDashboard();
            } catch(e){toast('❌ บันทึกไม่สำเร็จ: '+e.message,'#ef4444');}
        };

        // Admin เปิดดูสาขาที่นับแล้ว (แสดง summary แล้วแก้ได้)

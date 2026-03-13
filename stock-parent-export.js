// stock-parent-export.js — TTGPlus | openParentWhExportModal, doParentWhExcel, doParentWhPDF
        window.openParentWhExportModal = function() {
            const wg = window.warehouseGroups || {};
            const groups = Object.entries(wg)
                .filter(([k])=>k!=='_whnames')
                .map(([pid, val]) => [pid, Array.isArray(val) ? val : []]);  // normalize
            if(!groups.length) {
                toast('⚠️ ยังไม่มีคลังหลัก — ตั้งค่าที่ ⚙️ ตั้งค่าคลังและสินค้าหลัก','#f59e0b');
                return;
            }
            const existing = document.getElementById('parentWhExportModal'); if(existing) existing.remove();
            const now = new Date();
            const m = document.createElement('div');
            m.className='modal-overlay'; m.id='parentWhExportModal';
            m.innerHTML=`<div class="modal-box" style="max-width:520px;width:95vw;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                    <h3 style="margin:0;">🏭 Export รวมยอดคลังหลัก</h3>
                    <button onclick="document.getElementById('parentWhExportModal').remove()" style="background:#f1f5f9;border:none;padding:6px 12px;border-radius:8px;cursor:pointer;font-size:16px;">✕</button>
                </div>
                <p style="font-size:13px;color:#64748b;margin:0 0 16px;">สินค้าชื่อเดียวกันจาก Zone ย่อยในคลังเดียวกันจะถูก<b>รวมยอด</b> และ convert เป็นหน่วย Export ที่ตั้งไว้</p>

                <div style="margin-bottom:14px;">
                    <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:8px;">🏭 เลือกคลังหลัก</label>
                    <div style="display:flex;flex-direction:column;gap:6px;max-height:200px;overflow-y:auto;padding:4px;">
                        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;padding:6px 0;">
                            <input type="checkbox" id="pwex_all" checked onchange="document.querySelectorAll('.pwex_cb').forEach(cb=>cb.checked=this.checked)" style="width:16px;height:16px;accent-color:#ea580c;">
                            <b style="color:#ea580c;">ทุกคลังหลัก</b>
                        </label>
                        ${groups.map(([pid,zones])=>`
                        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;padding:6px 10px;border:1px solid #e2e8f0;border-radius:8px;background:#fafafa;">
                            <input type="checkbox" class="pwex_cb" value="${pid}" checked style="width:15px;height:15px;accent-color:#ea580c;">
                            <div>
                                <b style="color:#1e293b;">${pid}</b>
                                <span style="color:#94a3b8;font-size:11px;margin-left:6px;">${(zones||[]).join(', ')||'ยังไม่มี Zone'}</span>
                            </div>
                        </label>`).join('')}
                    </div>
                </div>

                <div style="margin-bottom:14px;">
                    <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:6px;">📊 รูปแบบ Export</label>
                    <div style="display:flex;gap:8px;">
                        <label style="flex:1;display:flex;align-items:center;gap:6px;padding:10px;border:1.5px solid #e2e8f0;border-radius:8px;cursor:pointer;font-size:13px;">
                            <input type="radio" name="pwex_fmt" value="combined" checked style="accent-color:#ea580c;"> ทุกคลังใน Sheet เดียว
                        </label>
                        <label style="flex:1;display:flex;align-items:center;gap:6px;padding:10px;border:1.5px solid #e2e8f0;border-radius:8px;cursor:pointer;font-size:13px;">
                            <input type="radio" name="pwex_fmt" value="sheets" style="accent-color:#ea580c;"> แยก Sheet ต่อคลังหลัก
                        </label>
                    </div>
                </div>

                <div style="margin-bottom:14px;">
                    <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:6px;">📋 ข้อมูลที่ต้องการ</label>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;">
                        <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;">
                            <input type="checkbox" id="pwex_showZone" checked style="accent-color:#ea580c;"> แสดง Zone ย่อยแยก
                        </label>
                        <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;">
                            <input type="checkbox" id="pwex_sumOnly" style="accent-color:#ea580c;"> เฉพาะยอดรวม (ไม่แสดง Zone ย่อย)
                        </label>
                    </div>
                </div>

                <div style="margin-top:18px;display:flex;gap:8px;">
                    <button onclick="document.getElementById('parentWhExportModal').remove()"
                        style="flex:1;background:#f1f5f9;color:#475569;border:none;padding:11px;border-radius:10px;cursor:pointer;font-weight:600;">ยกเลิก</button>
                    <button onclick="doParentWhExcel()"
                        style="flex:1;background:#ea580c;color:white;border:none;padding:11px;border-radius:10px;cursor:pointer;font-weight:700;">📥 Export Excel</button>
                    <button onclick="doParentWhPDF()"
                        style="flex:1;background:#7c3aed;color:white;border:none;padding:11px;border-radius:10px;cursor:pointer;font-weight:700;">🖨️ Export PDF</button>
                </div>
            </div>`;
            document.body.appendChild(m);
        };

        // รวมยอดสินค้าจาก zones ย่อย → object { productId: { name, unit, totalInExportUnit, byZone:{zone: amount} } }
        window._aggregateZones = function(zones) {
            const safeZones = Array.isArray(zones) ? zones : [];
            const result = {};
            safeZones.forEach(zone => {
                const prods = getZoneProducts(zone);
                prods.forEach(p => {
                    const cd = countData[p.id] || {total:0};
                    const rawAmount = cd.total || 0;
                    const rawUnit = (p.units||[{name:p.unit||''}])[0]?.name||'';
                    const exportUnit = _getExportUnit(p.id, null);
                    const converted = _convertToExportUnit(rawAmount, rawUnit, exportUnit, p);
                    if(!result[p.id]) result[p.id] = {name:p.name, exportUnit, total:0, byZone:{}, category:p.category||''};
                    result[p.id].total += converted;
                    result[p.id].total = Math.round(result[p.id].total*1000)/1000;
                    result[p.id].byZone[zone] = (result[p.id].byZone[zone]||0) + converted;
                    result[p.id].byZone[zone] = Math.round(result[p.id].byZone[zone]*1000)/1000;
                });
            });
            return result;
        };

        window.doParentWhExcel = async function() {
            await loadCountData();
            const selectedPids = [...document.querySelectorAll('.pwex_cb:checked')].map(cb=>cb.value);
            if(!selectedPids.length) { toast('⚠️ เลือกคลังหลักก่อน','#f59e0b'); return; }
            const fmt = document.querySelector('input[name="pwex_fmt"]:checked')?.value||'combined';
            const showZone = document.getElementById('pwex_showZone')?.checked;
            const sumOnly = document.getElementById('pwex_sumOnly')?.checked;
            document.getElementById('parentWhExportModal')?.remove();

            const wb = XLSX.utils.book_new();
            const dateStr = new Date().toLocaleDateString('th-TH').replace(/\//g,'-');

            if(fmt === 'sheets') {
                // แยก Sheet ต่อคลังหลัก
                selectedPids.forEach(pid => {
                    const _rawZ = (window.warehouseGroups||{})[pid]; const zones = Array.isArray(_rawZ) ? _rawZ : [];
                    const agg = _aggregateZones(zones);
                    const sheetData = _buildParentWhSheet(pid, zones, agg, showZone && !sumOnly);
                    const ws = XLSX.utils.aoa_to_sheet(sheetData);
                    _styleParentWhSheet(ws, sheetData);
                    XLSX.utils.book_append_sheet(wb, ws, pid.slice(0,31));
                });
            } else {
                // ทุกคลังใน Sheet เดียว
                let allRows = [['คลังหลัก','Zone','รหัส','ชื่อสินค้า','หมวด','ยอดรวม','หน่วย']];
                selectedPids.forEach(pid => {
                    const _rawZ = (window.warehouseGroups||{})[pid]; const zones = Array.isArray(_rawZ) ? _rawZ : [];
                    const agg = _aggregateZones(zones);
                    // ยอดรวม
                    Object.entries(agg).forEach(([prodId, d]) => {
                        if(!sumOnly && showZone) {
                            zones.forEach(z => {
                                if(d.byZone[z]) allRows.push([pid, z, prodId, d.name, d.category, d.byZone[z], d.exportUnit]);
                            });
                            allRows.push([pid, '📊 รวม', prodId, d.name, d.category, d.total, d.exportUnit]);
                        } else {
                            allRows.push([pid, '—', prodId, d.name, d.category, d.total, d.exportUnit]);
                        }
                    });
                    allRows.push([]); // spacer
                });
                const ws = XLSX.utils.aoa_to_sheet(allRows);
                ws['!cols'] = [{wch:14},{wch:18},{wch:12},{wch:30},{wch:14},{wch:10},{wch:8}];
                XLSX.utils.book_append_sheet(wb, ws, 'รวมทุกคลัง');
            }

            XLSX.writeFile(wb, `ParentWH_Export_${dateStr}.xlsx`);
            toast('📥 Export คลังหลักเรียบร้อย','#ea580c');
        };

        window._buildParentWhSheet = function(pid, zones, agg, showZoneBreakdown) {
            const displayName = (window.warehouseGroups?._whnames||{})[pid] || pid;
            const dateStr = new Date().toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'});
            const rows = [
                [`รายงานยอดสต๊อกคลังหลัก: ${pid} ${displayName?'('+displayName+')':''}`],
                [`Zones: ${zones.join(', ')} | พิมพ์: ${dateStr}`],
                []
            ];
            if(showZoneBreakdown) {
                rows.push(['รหัส','ชื่อสินค้า','หมวด',...zones,'📊 รวม','หน่วย']);
                Object.entries(agg).forEach(([prodId, d]) => {
                    rows.push([prodId, d.name, d.category, ...zones.map(z=>d.byZone[z]||0), d.total, d.exportUnit]);
                });
                // summary row
                rows.push([]);
                const totRow = ['','','ยอดรวมทั้งหมด'];
                // per-zone totals
                zones.forEach(z => {
                    const t = Object.values(agg).reduce((s,d)=>s+(d.byZone[z]||0),0);
                    totRow.push(Math.round(t*1000)/1000);
                });
                totRow.push(Object.values(agg).reduce((s,d)=>s+d.total,0));
                totRow.push('');
                rows.push(totRow);
            } else {
                rows.push(['รหัส','ชื่อสินค้า','หมวด','ยอดรวม','หน่วย']);
                Object.entries(agg).forEach(([prodId, d]) => {
                    rows.push([prodId, d.name, d.category, d.total, d.exportUnit]);
                });
            }
            return rows;
        };

        window._styleParentWhSheet = function(ws, rows) {
            // column widths ต่างกันตามจำนวน columns
            const cols = rows[3]?.length || 5;
            ws['!cols'] = Array.from({length:cols}, (_,i) => ({wch: i===1?30:i===2?14:12}));
        };

        window.doParentWhPDF = async function() {
            await loadCountData();
            const selectedPids = [...document.querySelectorAll('.pwex_cb:checked')].map(cb=>cb.value);
            if(!selectedPids.length) { toast('⚠️ เลือกคลังหลักก่อน','#f59e0b'); return; }
            const showZone = document.getElementById('pwex_showZone')?.checked;
            const sumOnly = document.getElementById('pwex_sumOnly')?.checked;
            document.getElementById('parentWhExportModal')?.remove();

            const now = new Date();
            const printDate = now.toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'});

            const sections = selectedPids.map(pid => {
                const _rawZ = (window.warehouseGroups||{})[pid]; const zones = Array.isArray(_rawZ) ? _rawZ : [];
                const displayName = (window.warehouseGroups?._whnames||{})[pid]||'';
                const agg = _aggregateZones(zones);
                const entries = Object.entries(agg);
                // จัดกลุ่มตาม category
                const cats = [...new Set(entries.map(([,d])=>d.category||'ทั่วไป'))];

                const tableBody = cats.map(cat => {
                    const catItems = entries.filter(([,d])=>(d.category||'ทั่วไป')===cat);
                    const hdr = `<tr><td colspan="${showZone&&!sumOnly?zones.length+4:4}" style="padding:7px 12px;background:#fff7ed;font-weight:700;font-size:10px;color:#c2410c;border-top:2px solid #fed7aa;">▌ ${cat.toUpperCase()}</td></tr>`;
                    const itemRows = catItems.map(([prodId, d], idx) => {
                        const zoneCols = (showZone&&!sumOnly) ? zones.map(z=>`<td style="padding:7px;text-align:center;font-size:11px;color:#475569;border-bottom:1px solid #f1f5f9;">${d.byZone[z]||'—'}</td>`).join('') : '';
                        return `<tr style="${idx%2===1?'background:#fafafa':''}">
                            <td style="padding:8px 12px;font-weight:600;font-size:11px;border-bottom:1px solid #f1f5f9;">${prodId}</td>
                            <td style="padding:8px 12px;font-size:11px;border-bottom:1px solid #f1f5f9;">${d.name}</td>
                            ${zoneCols}
                            <td style="padding:8px;text-align:center;font-weight:800;font-size:15px;color:#ea580c;border-bottom:1px solid #f1f5f9;">${d.total}</td>
                            <td style="padding:8px;text-align:center;font-size:11px;color:#64748b;border-bottom:1px solid #f1f5f9;">${d.exportUnit}</td>
                        </tr>`;
                    }).join('');
                    return hdr+itemRows;
                }).join('');

                const zoneHeaders = (showZone&&!sumOnly) ? zones.map(z=>`<th style="padding:8px;text-align:center;font-size:10px;background:#c2410c;">${z}</th>`).join('') : '';

                return `
                <div style="page-break-inside:avoid;margin-bottom:28px;">
                    <div style="background:#ea580c;color:white;padding:10px 16px;border-radius:8px 8px 0 0;display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <span style="font-size:16px;font-weight:800;">🏭 ${pid}</span>
                            ${displayName?`<span style="font-size:12px;opacity:.85;margin-left:8px;">${displayName}</span>`:''}
                        </div>
                        <span style="font-size:11px;opacity:.8;">Zones: ${zones.join(' · ')}</span>
                    </div>
                    <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;">
                        <thead><tr style="background:#1e293b;color:white;">
                            <th style="padding:9px 12px;text-align:left;font-size:10px;width:90px;">รหัส</th>
                            <th style="padding:9px 12px;text-align:left;font-size:10px;">ชื่อสินค้า</th>
                            ${zoneHeaders}
                            <th style="padding:9px;text-align:center;font-size:10px;background:#ea580c;width:70px;">ยอดรวม</th>
                            <th style="padding:9px;text-align:center;font-size:10px;width:55px;">หน่วย</th>
                        </tr></thead>
                        <tbody>${tableBody}</tbody>
                    </table>
                </div>`;
            }).join('');

            const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
            <style>
                @page{size:A4 landscape;margin:12mm}
                body{font-family:'Sarabun',sans-serif;margin:0;color:#1e293b;}
                table{width:100%;border-collapse:collapse;}
                @media print{body{padding:0}}
            </style>
            <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap" rel="stylesheet">
            </head><body>
            <div style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-end;">
                <div>
                    <h1 style="margin:0 0 3px;font-size:18px;">รายงานยอดสต๊อกรวมตามคลังหลัก</h1>
                    <div style="font-size:11px;color:#64748b;">พิมพ์โดย: ${currentUser?.name||''} | ${printDate}</div>
                </div>
            </div>
            ${sections}
            </body></html>`;

            const w = window.open('','_blank','width=1000,height=700');
            w.document.write(html); w.document.close();
            setTimeout(()=>w.print(),700);
        };
        window.exportBranchMonthlyCountExcel = function() {
            const d = window._bmcCurrentDoc;
            if(!d){ toast('⚠️ ไม่พบข้อมูล','#c2410c'); return; }
            try {
                const tmpl = stockSheetTemplates[d.templateId] || {};
                const wb = XLSX.utils.book_new();
                const header = ['รหัสสินค้า','ชื่อสินค้า','หมวด','ยอดนับ','หน่วย (export)','หน่วยเดิม','หมายเหตุ'];
                const rows = [header, ...(d.items||[]).map(it=>{
                    const p = allProducts.find(x=>x.id===it.id);
                    const tmplItem = (tmpl.items||[]).find(x=>x.id===it.id);
                    const exportUnit = _getExportUnit(it.id, tmplItem);
                    const converted = _convertToExportUnit(it.balance||0, it.unit||'', exportUnit, p);
                    return [it.id, it.name, it.group||'', converted, exportUnit, it.unit||'', it.note||''];
                })];
                const ws = XLSX.utils.aoa_to_sheet(rows);
                ws['!cols'] = [{wch:12},{wch:30},{wch:14},{wch:10},{wch:12},{wch:10},{wch:20}];
                ['A1','B1','C1','D1','E1','F1','G1'].forEach(ref=>{
                    if(ws[ref]) ws[ref].s = {font:{bold:true},alignment:{horizontal:'center'}};
                });
                // เพิ่ม meta rows ด้านบน
                XLSX.utils.sheet_add_aoa(ws, [
                    [`รายงานนับสต๊อกสิ้นเดือน — ${d.zone||''}`],
                    [`เดือน: ${d.month||''}   วันที่นับ: ${d.date||''}   ผู้นับ: ${d.countedBy||''}   Template: ${d.templateName||''}`],
                    []
                ], {origin:'A1'});
                // เลื่อน header ลงมา
                const headerRows = [header, ...(d.items||[]).map(it=>{
                    const p=allProducts.find(x=>x.id===it.id);
                    const tmplItem=(tmpl.items||[]).find(x=>x.id===it.id);
                    const exportUnit=tmplItem?.exportUnit||it.unit||'';
                    const converted=_convertToExportUnit(it.balance||0,it.unit||'',exportUnit,p);
                    return [it.id,it.name,it.group||'',converted,exportUnit,it.unit||'',it.note||''];
                })];
                const ws2 = XLSX.utils.aoa_to_sheet([
                    [`รายงานนับสต๊อกสิ้นเดือน — ${d.zone||''}`],
                    [`เดือน: ${d.month||''}   |   วันที่นับ: ${d.date||''}   |   ผู้นับ: ${d.countedBy||''}   |   Template: ${d.templateName||''}`],
                    [],
                    ...headerRows
                ]);
                ws2['!cols'] = [{wch:12},{wch:30},{wch:14},{wch:10},{wch:12},{wch:10},{wch:20}];
                XLSX.utils.book_append_sheet(wb, ws2, (d.zone||'สาขา').slice(0,31));
                const zone = (d.zone||'สาขา').replace(/[:\/?*[\]]/g,'_');
                XLSX.writeFile(wb, 'stock_' + zone + '_' + (d.month||'') + '.xlsx');
                toast('📥 Export Excel เรียบร้อย','#0891b2');
            } catch(e){ toast('❌ Export ไม่สำเร็จ: '+e.message,'#ef4444'); }
        };

        // Export PDF — ยอดนับสิ้นเดือนสาขา (จาก _bmcCurrentDoc)
        // Modal เลือกรูปแบบ PDF

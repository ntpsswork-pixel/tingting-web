// stock-pdf-export.js — TTGPlus | openPDFFormatModal, exportBranchMonthlyCountPDF, exportBranchMonthlyCountPDFCompact
        window.openPDFFormatModal = function() {
            const ex = document.getElementById('pdfFmtModal'); if(ex) ex.remove();
            const m = document.createElement('div');
            m.className = 'modal-overlay'; m.id = 'pdfFmtModal';
            m.innerHTML = `<div class="modal-box" style="max-width:440px;width:95vw;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                    <h3 style="margin:0;">🖨️ เลือกรูปแบบ PDF</h3>
                    <button onclick="document.getElementById('pdfFmtModal').remove()"
                        style="background:#f1f5f9;border:none;padding:6px 12px;border-radius:8px;cursor:pointer;font-size:16px;">✕</button>
                </div>
                <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px;">
                    <label id="pdfFmt1" onclick="selectPdfFmt('standard')"
                        style="display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border:2px solid #7c3aed;border-radius:12px;cursor:pointer;background:#f5f3ff;">
                        <input type="radio" name="pdfFmt" value="standard" checked style="margin-top:3px;width:16px;height:16px;accent-color:#7c3aed;">
                        <div>
                            <div style="font-weight:700;font-size:14px;color:#5b21b6;">📋 รูปแบบปกติ</div>
                            <div style="font-size:12px;color:#64748b;margin-top:3px;">Header ใหญ่ แบ่งกลุ่มสินค้า มีส่วนเซ็นชื่อ เหมาะสำหรับเก็บเอกสาร</div>
                        </div>
                    </label>
                    <label id="pdfFmt2" onclick="selectPdfFmt('compact')"
                        style="display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border:2px solid #e2e8f0;border-radius:12px;cursor:pointer;background:white;">
                        <input type="radio" name="pdfFmt" value="compact" style="margin-top:3px;width:16px;height:16px;accent-color:#7c3aed;">
                        <div>
                            <div style="font-weight:700;font-size:14px;color:#1e293b;">⚡ รวมแผ่นเดียว (หน้าร้าน)</div>
                            <div style="font-size:12px;color:#64748b;margin-top:3px;">ตารางแน่น font เล็กลง ไม่มีส่วนเซ็นชื่อ พอดี A4 ใบเดียว</div>
                        </div>
                    </label>
                </div>
                <div style="display:flex;gap:8px;">
                    <button onclick="document.getElementById('pdfFmtModal').remove()"
                        style="flex:1;background:#f1f5f9;color:#475569;border:none;padding:11px;border-radius:10px;cursor:pointer;font-weight:600;">ยกเลิก</button>
                    <button onclick="confirmPdfExport()"
                        style="flex:2;background:#7c3aed;color:white;border:none;padding:11px;border-radius:10px;cursor:pointer;font-weight:700;font-size:14px;">🖨️ Export PDF</button>
                </div>
            </div>`;
            document.body.appendChild(m);
        };

        window.selectPdfFmt = function(val) {
            document.querySelectorAll('input[name="pdfFmt"]').forEach(r => r.checked = r.value === val);
            document.getElementById('pdfFmt1').style.borderColor = val==='standard' ? '#7c3aed' : '#e2e8f0';
            document.getElementById('pdfFmt1').style.background  = val==='standard' ? '#f5f3ff' : 'white';
            document.getElementById('pdfFmt2').style.borderColor = val==='compact'  ? '#7c3aed' : '#e2e8f0';
            document.getElementById('pdfFmt2').style.background  = val==='compact'  ? '#f5f3ff' : 'white';
        };

        window.confirmPdfExport = function() {
            const fmt = document.querySelector('input[name="pdfFmt"]:checked')?.value || 'standard';
            document.getElementById('pdfFmtModal').remove();
            if(fmt === 'compact') exportBranchMonthlyCountPDFCompact();
            else exportBranchMonthlyCountPDF();
        };

        // PDF แบบกระชับ — พอดีหน้าเดียว A4 (2 คอลัมน์)
        window.exportBranchMonthlyCountPDFCompact = function() {
            const d = window._bmcCurrentDoc;
            const zone = window._bmcCurrentZone;
            const tmplId = window._bmcCurrentTmplId;
            const tmpl = stockSheetTemplates[tmplId] || {};
            if(!d){ toast('⚠️ ไม่พบข้อมูล','#c2410c'); return; }

            const printDate = new Date().toLocaleDateString('th-TH',{year:'numeric',month:'short',day:'numeric'});
            const items = d.items || [];
            const totalItems = items.length;

            // ปรับ font ตามจำนวน — 2 คอลัมน์บน A4 landscape รับได้ ~120 rows/col
            const fs = totalItems <= 60 ? 10 : totalItems <= 100 ? 9 : totalItems <= 150 ? 8 : 7;
            const pd = fs >= 9 ? '4px 6px' : '3px 5px';

            // สร้าง row HTML สำหรับแต่ละสินค้า
            const allRows = [];
            const groups = [...new Set(items.map(i=>i.group||'ทั่วไป'))];
            groups.forEach(grp => {
                const grpItems = items.filter(i=>(i.group||'ทั่วไป')===grp);
                allRows.push({ isHeader: true, grp });
                grpItems.forEach(it => {
                    const p = allProducts.find(x=>x.id===it.id);
                    const tmplItem = (tmpl.items||[]).find(x=>x.id===it.id);
                    const exportUnit = _getExportUnit(it.id, tmplItem);
                    const converted = _convertToExportUnit(it.balance||0, it.unit||'', exportUnit, p);
                    const showConvert = exportUnit !== it.unit && it.unit;
                    allRows.push({ isHeader: false, it, converted, exportUnit, showConvert });
                });
            });

            // แบ่งเป็น 2 คอลัมน์
            const half = Math.ceil(allRows.length / 2);
            const col1 = allRows.slice(0, half);
            const col2 = allRows.slice(half);

            const renderRows = (rows) => rows.map((r, idx) => {
                if(r.isHeader) return `
                    <tr><td colspan="3" style="padding:3px 6px;background:#1e293b;color:white;font-weight:700;font-size:${fs-1}px;">
                        ▌ ${r.grp.toUpperCase()}
                    </td></tr>`;
                const bg = idx%2===1 ? 'background:#f8fafc;' : '';
                return `<tr style="${bg}">
                    <td style="padding:${pd};font-size:${fs}px;border-bottom:1px solid #f1f5f9;color:#334155;white-space:nowrap;">${r.it.id}</td>
                    <td style="padding:${pd};font-size:${fs}px;border-bottom:1px solid #f1f5f9;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.it.name}</td>
                    <td style="padding:${pd};text-align:center;font-weight:800;font-size:${fs+1}px;color:#1d4ed8;border-bottom:1px solid #f1f5f9;white-space:nowrap;">
                        ${r.converted||'—'} <span style="font-size:${fs-1}px;font-weight:400;color:#64748b;">${r.exportUnit}</span>
                        ${r.showConvert ? `<br><span style="font-size:${fs-2}px;color:#cbd5e1;">${r.it.balance} ${r.it.unit}</span>` : ''}
                    </td>
                </tr>`;
            }).join('');

            const tableStyle = `width:100%;border-collapse:collapse;table-layout:fixed;`;
            const thStyle = (w) => `padding:5px 6px;text-align:left;font-size:${fs}px;background:#1e293b;color:white;${w?`width:${w};`:''}`;

            const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
            <style>
                @page { size:A4 landscape; margin:6mm; }
                body { font-family:'Sarabun',sans-serif; margin:0; color:#1e293b; }
                * { box-sizing:border-box; }
            </style>
            <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap" rel="stylesheet">
            </head><body>
            <!-- Header บาง -->
            <div style="background:#1e293b;color:white;padding:6px 10px;border-radius:5px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <b style="font-size:13px;">รายงานนับสต๊อกสิ้นเดือน</b>
                    <span style="font-size:11px;opacity:.8;margin-left:8px;">📦 ${zone}</span>
                </div>
                <div style="font-size:9px;opacity:.8;text-align:right;line-height:1.5;">
                    วันที่นับ: ${d.date||d.month||'—'} &nbsp;|&nbsp; ผู้นับ: ${d.countedBy||'—'} &nbsp;|&nbsp; Template: ${d.templateName||'—'} &nbsp;|&nbsp; พิมพ์: ${printDate} &nbsp;|&nbsp; ${totalItems} รายการ
                </div>
            </div>
            <!-- 2-column layout -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
                <div>
                    <table style="${tableStyle}">
                        <thead><tr>
                            <th style="${thStyle('85px')}">รหัส</th>
                            <th style="${thStyle('')}">ชื่อสินค้า</th>
                            <th style="${thStyle('80px')};text-align:center;background:#1d4ed8;">ยอดนับ</th>
                        </tr></thead>
                        <tbody>${renderRows(col1)}</tbody>
                    </table>
                </div>
                <div>
                    <table style="${tableStyle}">
                        <thead><tr>
                            <th style="${thStyle('85px')}">รหัส</th>
                            <th style="${thStyle('')}">ชื่อสินค้า</th>
                            <th style="${thStyle('80px')};text-align:center;background:#1d4ed8;">ยอดนับ</th>
                        </tr></thead>
                        <tbody>${renderRows(col2)}</tbody>
                    </table>
                </div>
            </div>
            </body></html>`;

            const w = window.open('','_blank','width=1100,height=750');
            w.document.write(html); w.document.close();
            setTimeout(()=>w.print(), 700);
        };

        window.exportBranchMonthlyCountPDF = function() {
            const d = window._bmcCurrentDoc;
            const zone = window._bmcCurrentZone;
            const tmplId = window._bmcCurrentTmplId;
            const tmpl = stockSheetTemplates[tmplId] || {};
            if(!d){ toast('⚠️ ไม่พบข้อมูล','#c2410c'); return; }

            const now = new Date();
            const printDate = now.toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'});
            const groups = [...new Set((d.items||[]).map(i=>i.group||'ทั่วไป'))];

            const tableBody = groups.map(grp => {
                const grpItems = (d.items||[]).filter(i=>(i.group||'ทั่วไป')===grp);
                const hdr = `<tr><td colspan="5" style="padding:7px 12px;background:#f0f9ff;font-weight:700;font-size:10px;color:#0369a1;border-top:2px solid #bae6fd;">▌ ${grp.toUpperCase()}</td></tr>`;
                const rows = grpItems.map((it,idx) => {
                    const p = allProducts.find(x=>x.id===it.id);
                    const tmplItem = (tmpl.items||[]).find(x=>x.id===it.id);
                    const exportUnit = _getExportUnit(it.id, tmplItem);
                    const converted = _convertToExportUnit(it.balance||0, it.unit||'', exportUnit, p);
                    const showConvert = exportUnit !== it.unit && it.unit;
                    return `<tr style="${idx%2===1?'background:#f8fafc':''}">
                        <td style="padding:8px 12px;font-weight:600;font-size:11px;border-bottom:1px solid #e2e8f0;">${it.id}</td>
                        <td style="padding:8px 12px;font-size:11px;border-bottom:1px solid #e2e8f0;">${it.name}</td>
                        <td style="padding:8px;text-align:center;font-weight:800;font-size:15px;color:#1d4ed8;border-bottom:1px solid #e2e8f0;">${converted||'—'}</td>
                        <td style="padding:8px;text-align:center;font-size:11px;border-bottom:1px solid #e2e8f0;">${exportUnit}${showConvert?`<br><span style="color:#94a3b8;font-size:9px;">(จาก ${it.unit})</span>`:''}</td>
                        <td style="padding:8px;font-size:10px;color:#64748b;border-bottom:1px solid #e2e8f0;">${it.note||''}</td>
                    </tr>`;
                }).join('');
                return hdr+rows;
            }).join('');

            const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
            <style>
                @page{size:A4;margin:14mm}
                body{font-family:'Sarabun',sans-serif;margin:0;color:#1e293b;font-size:12px;}
                .header-box{border:2px solid #1e293b;border-radius:8px;padding:14px 18px;margin-bottom:14px;}
                table{width:100%;border-collapse:collapse;margin-top:8px;}
                thead tr{background:#1e293b;color:white;}
                th{padding:9px 12px;text-align:left;font-size:11px;}
                .footer{margin-top:28px;display:grid;grid-template-columns:1fr 1fr;gap:40px;}
                .sign{border-top:1px solid #334155;text-align:center;font-size:11px;color:#64748b;padding:40px 0 6px;}
            </style>
            <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap" rel="stylesheet">
            </head><body>
            <div class="header-box">
                <div style="font-size:18px;font-weight:bold;text-align:center;margin-bottom:10px;">รายงานนับสต๊อกสิ้นเดือน</div>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
                    <div style="border:1px solid #94a3b8;border-radius:4px;padding:6px 10px;">
                        <div style="font-size:9px;color:#64748b;font-weight:bold;">สาขา</div>
                        <div style="font-size:13px;font-weight:bold;">${zone}</div>
                    </div>
                    <div style="border:1px solid #94a3b8;border-radius:4px;padding:6px 10px;">
                        <div style="font-size:9px;color:#64748b;font-weight:bold;">เดือน / วันที่นับ</div>
                        <div style="font-size:12px;font-weight:bold;">${d.date||d.month||'—'}</div>
                    </div>
                    <div style="border:1px solid #94a3b8;border-radius:4px;padding:6px 10px;">
                        <div style="font-size:9px;color:#64748b;font-weight:bold;">ผู้นับ / Template</div>
                        <div style="font-size:12px;font-weight:bold;">${d.countedBy||'—'} / ${d.templateName||'—'}</div>
                    </div>
                </div>
            </div>
            <table>
                <thead><tr>
                    <th style="width:100px;">รหัสสินค้า</th>
                    <th>ชื่อสินค้า</th>
                    <th style="width:80px;text-align:center;background:#1d4ed8;">ยอดนับ</th>
                    <th style="width:80px;text-align:center;">หน่วย</th>
                    <th style="width:130px;">หมายเหตุ</th>
                </tr></thead>
                <tbody>${tableBody}</tbody>
            </table>
            <div style="margin-top:10px;font-size:10px;color:#94a3b8;text-align:right;">พิมพ์โดย: ${currentUser?.name||''} | ${printDate}</div>
            <div class="footer">
                <div class="sign">ผู้นับ</div>
                <div class="sign">ผู้ตรวจสอบ</div>
            </div>
            </body></html>`;

            const w = window.open('','_blank','width=900,height=700');
            w.document.write(html); w.document.close();
            setTimeout(()=>w.print(),600);
        };

        // Export Excel รวมทุกสาขา — สำหรับ Admin (เลือกเดือน)

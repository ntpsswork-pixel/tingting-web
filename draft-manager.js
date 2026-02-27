// draft-manager.js — TTGPlus
// ป้องกันข้อมูลสูญหายเมื่อ Refresh / ปิด Tab โดยไม่ได้ตั้งใจ
// ฟีเจอร์:
//   1. beforeunload  → browser popup เตือน "ออกจากหน้าหรือไม่?"
//   2. Auto-save     → บันทึกใน localStorage ทุก 20 วิ ขณะกรอกข้อมูล
//   3. Restore       → แบนเนอร์สีเหลือง "📋 พบข้อมูลค้างไว้ — กู้คืน?" เมื่อเปิดหน้าใหม่

(function() {
    const STORAGE_PREFIX  = 'ttgplus_draft_';
    const AUTO_SAVE_MS    = 20000; // 20 วิ
    const BANNER_DELAY_MS = 350;   // รอให้ DOM render ก่อนแทรก banner

    // ─── DraftManager ─────────────────────────────────────────────────────────
    class DraftManager {
        constructor() {
            this._entries   = {}; // key → { isDirtyFn, readFn, writeFn, storageKey, timer }
            this._blAttached = false;
        }

        /**
         * ลงทะเบียนหน้าจอที่ต้องการป้องกัน
         * @param {string} key       - unique key ต่อหน้าจอ เช่น 'stock_normal', 'create_gr'
         * @param {object} config    - { isDirtyFn, readFn, writeFn }
         *   isDirtyFn() → boolean   : มีข้อมูลที่ยังไม่บันทึกหรือเปล่า
         *   readFn()    → object    : อ่านสถานะปัจจุบันทั้งหมด (return null = ไม่บันทึก)
         *   writeFn(data)           : กู้คืนสถานะ
         */
        start(key, config) {
            this.stop(key); // clear ของเดิมถ้ามี
            const user        = window.currentUser?.username || 'anon';
            const storageKey  = `${STORAGE_PREFIX}${key}_${user}`;
            const entry = { ...config, storageKey, timer: null };
            this._entries[key] = entry;

            // เริ่ม auto-save
            entry.timer = setInterval(() => this._autoSave(key), AUTO_SAVE_MS);

            // attach beforeunload ครั้งเดียว
            if (!this._blAttached) {
                window.addEventListener('beforeunload', (e) => this._onBeforeUnload(e));
                this._blAttached = true;
            }

            // ตรวจ draft เก่าค้างไว้ แล้วแสดง banner
            this._showRestoreBanner(key, storageKey, config.writeFn);
        }

        /** เรียกหลัง save สำเร็จ → ลบ draft + หยุด auto-save */
        clear(key) {
            const e = this._entries[key];
            if (e) {
                clearInterval(e.timer);
                try { localStorage.removeItem(e.storageKey); } catch (_) {}
                delete this._entries[key];
            }
            document.getElementById(`_dm_banner_${_safeId(key)}`)?.remove();
        }

        /** หยุด auto-save แต่ไม่ลบ draft (เช่น ปิดหน้าชั่วคราว) */
        stop(key) {
            const e = this._entries[key];
            if (e) {
                clearInterval(e.timer);
                delete this._entries[key];
            }
        }

        /** หยุดทั้งหมด */
        stopAll() {
            Object.keys(this._entries).forEach(k => this.stop(k));
        }

        // ─── private ──────────────────────────────────────────────────────────

        _autoSave(key) {
            const e = this._entries[key]; if (!e) return;
            if (e.isDirtyFn && !e.isDirtyFn()) return; // ไม่มีข้อมูล ข้ามได้
            try {
                const data = e.readFn();
                if (data == null) return;
                localStorage.setItem(e.storageKey, JSON.stringify({
                    data,
                    savedAt: new Date().toISOString()
                }));
            } catch (err) {
                console.warn('[DraftManager] auto-save error', key, err);
            }
        }

        _onBeforeUnload(e) {
            // บันทึกลง localStorage ทันทีก่อนหน้า unload — ไม่รอ interval
            Object.keys(this._entries).forEach(k => this._autoSaveForce(k));

            const hasDirty = Object.keys(this._entries).some(k => {
                const entry = this._entries[k];
                return entry.isDirtyFn ? entry.isDirtyFn() : true;
            });
            if (hasDirty) {
                e.preventDefault();
                e.returnValue = ''; // required for Chrome
                return '';
            }
        }

        // บันทึกทันทีโดยไม่เช็ค isDirtyFn (ใช้ตอน beforeunload)
        _autoSaveForce(key) {
            const e = this._entries[key]; if (!e) return;
            try {
                const data = e.readFn();
                if (data == null) return;
                localStorage.setItem(e.storageKey, JSON.stringify({
                    data,
                    savedAt: new Date().toISOString()
                }));
            } catch (err) {
                console.warn('[DraftManager] force-save error', key, err);
            }
        }

        _showRestoreBanner(key, storageKey, writeFn) {
            let stored;
            try {
                const raw = localStorage.getItem(storageKey);
                if (!raw) return;
                stored = JSON.parse(raw);
                if (!stored?.data) return;
            } catch (_) { return; }

            setTimeout(() => {
                const container = document.getElementById('toolAppContainer');
                if (!container) return;

                // ลบ banner เก่าถ้ามี
                document.getElementById(`_dm_banner_${_safeId(key)}`)?.remove();

                // format เวลา
                let timeStr = '—';
                try {
                    const d = new Date(stored.savedAt);
                    timeStr = d.toLocaleString('th-TH', {
                        day: '2-digit', month: '2-digit',
                        hour: '2-digit', minute: '2-digit'
                    });
                } catch (_) {}

                const banner = document.createElement('div');
                banner.id = `_dm_banner_${_safeId(key)}`;
                banner.innerHTML = `
                <div style="background:linear-gradient(90deg,#fef9c3,#fef3c7);border:2px solid #f59e0b;border-radius:12px;
                            padding:13px 18px;margin-bottom:18px;display:flex;align-items:center;gap:12px;
                            box-shadow:0 2px 10px rgba(245,158,11,0.15);animation:fadeIn .3s ease;">
                    <div style="font-size:26px;flex-shrink:0;">📋</div>
                    <div style="flex:1;min-width:0;">
                        <div style="font-weight:700;font-size:13px;color:#92400e;">
                            พบข้อมูลที่กรอกค้างไว้ (บันทึกอัตโนมัติ ${timeStr} น.)
                        </div>
                        <div style="font-size:11px;color:#a16207;margin-top:2px;">
                            ต้องการกู้คืนข้อมูลที่กรอกค้างไว้ หรือเริ่มกรอกใหม่?
                        </div>
                    </div>
                    <button id="_dm_restore_${_safeId(key)}"
                        style="background:#f59e0b;color:white;border:none;padding:9px 18px;border-radius:9px;cursor:pointer;
                               font-weight:700;font-size:13px;flex-shrink:0;white-space:nowrap;">
                        ♻️ กู้คืน
                    </button>
                    <button id="_dm_discard_${_safeId(key)}"
                        style="background:#f1f5f9;color:#64748b;border:none;padding:9px 18px;border-radius:9px;cursor:pointer;
                               font-weight:600;font-size:13px;flex-shrink:0;white-space:nowrap;">
                        ✕ เริ่มใหม่
                    </button>
                </div>`;

                // แทรกหลัง .tool-header
                const header = container.querySelector('.tool-header');
                if (header) header.after(banner);
                else container.prepend(banner);

                // restore
                document.getElementById(`_dm_restore_${_safeId(key)}`)?.addEventListener('click', () => {
                    try {
                        writeFn(stored.data);
                        if (window.toast) toast('♻️ กู้คืนข้อมูลเรียบร้อย', '#f59e0b');
                    } catch (err) {
                        console.error('[DraftManager] writeFn error', err);
                        if (window.toast) toast('⚠️ กู้คืนไม่สำเร็จ กรุณากรอกใหม่', '#ef4444');
                    }
                    banner.remove();
                });

                // discard
                document.getElementById(`_dm_discard_${_safeId(key)}`)?.addEventListener('click', () => {
                    try { localStorage.removeItem(storageKey); } catch (_) {}
                    banner.remove();
                });

            }, BANNER_DELAY_MS);
        }
    }

    function _safeId(key) {
        return key.replace(/[^a-zA-Z0-9_]/g, '_');
    }

    window._DM = new DraftManager();

    // ─── SCREEN CONFIGS ───────────────────────────────────────────────────────
    // เรียก _DM.start() สำหรับแต่ละหน้าจอหลังเปิดฟอร์ม

    // ── 1. นับสต๊อกปกติ (openCentralStock / renderStockTool) ─────────────────
    // เรียกที่ท้าย openCentralStock() → ใน stock-count.js
    window._DM_startStockNormal = function(zone) {
        window._DM.start('stock_normal', {
            isDirtyFn() {
                // dirty ถ้ามีใน tempCountData หรือมีการพิมพ์ใน input ที่ยังไม่กด +
                const td = window.tempCountData || {};
                const hasTempData = Object.keys(td).some(id =>
                    Object.keys(td[id]).filter(k => k.startsWith('u')).some(k => (td[id][k] || 0) > 0)
                );
                if (hasTempData) return true;
                // ตรวจ input fields ที่กรอกแต่ยังไม่กด +
                return [...document.querySelectorAll('[id^="input_"]')]
                    .some(el => parseFloat(el.value) > 0);
            },
            readFn() {
                const td = window.tempCountData || {};
                // เก็บ input values ที่ยังไม่กด + ด้วย
                const pendingInputs = {};
                document.querySelectorAll('[id^="input_"]').forEach(el => {
                    if (parseFloat(el.value) > 0) pendingInputs[el.id] = el.value;
                });
                const hasTempData = Object.keys(td).some(id =>
                    Object.keys(td[id]).filter(k => k.startsWith('u')).some(k => (td[id][k] || 0) > 0)
                );
                if (!hasTempData && !Object.keys(pendingInputs).length) return null;
                const currentZone = document.querySelector('#toolAppContainer h2')?.textContent?.replace('📦 นับสต๊อก: ', '') || zone || '';
                return {
                    tempCountData: JSON.parse(JSON.stringify(td)),
                    pendingInputs,
                    zone: currentZone,
                    date: document.getElementById('countDate')?.value || window.selectedDate || '',
                    staff: document.getElementById('staffSelect')?.value || window.selectedStaff || ''
                };
            },
            writeFn(data) {
                window.tempCountData = data.tempCountData || {};
                if (data.date) window.selectedDate = data.date;
                if (data.staff) window.selectedStaff = data.staff;
                // re-render แล้วค่อยใส่ pending inputs
                if (window.renderStockTool) {
                    renderStockTool(data.zone || '');
                    setTimeout(() => {
                        // กู้คืน input ที่ยังไม่กด +
                        Object.entries(data.pendingInputs || {}).forEach(([id, val]) => {
                            const el = document.getElementById(id);
                            if (el) {
                                el.value = val;
                                el.style.borderColor = '#f59e0b';
                            }
                        });
                        // กู้คืน date และ staff
                        if (data.date) {
                            const dateEl = document.getElementById('countDate');
                            if (dateEl) dateEl.value = data.date;
                        }
                        if (data.staff) {
                            const staffEl = document.getElementById('staffSelect');
                            if (staffEl) staffEl.value = data.staff;
                        }
                    }, 300);
                }
            }
        });
    };

    // ── 2. นับสต๊อกสิ้นเดือน (openBranchMonthlyCount) ────────────────────────
    // เรียกที่ท้าย openBranchMonthlyCount() → ใน stock-count.js
    window._DM_startMonthlyCount = function(tmplId, tmpl, zone) {
        const key = `monthly_${tmplId}_${(zone || '').replace(/\s/g, '_')}`;
        window._DM.start(key, {
            isDirtyFn() {
                return (tmpl?.items || []).some(it => {
                    const el = document.getElementById(`bmc_${it.id}`);
                    return el && el.value !== '' && el.value !== '0';
                });
            },
            readFn() {
                const items = {};
                const notes = {};
                let anyValue = false;
                (tmpl?.items || []).forEach(it => {
                    const v = document.getElementById(`bmc_${it.id}`)?.value || '';
                    const n = document.getElementById(`bmcNote_${it.id}`)?.value || '';
                    items[it.id] = v;
                    notes[it.id] = n;
                    if (v !== '' && v !== '0') anyValue = true;
                });
                if (!anyValue) return null;
                return {
                    items, notes,
                    date: document.getElementById('bmc_date')?.value || '',
                    time: document.getElementById('bmc_time')?.value || '',
                    zone: document.getElementById('bmc_zone')?.value || zone || ''
                };
            },
            writeFn(data) {
                // ตั้งค่า header fields
                const dateEl = document.getElementById('bmc_date');
                const timeEl = document.getElementById('bmc_time');
                const zoneEl = document.getElementById('bmc_zone');
                if (dateEl && data.date) dateEl.value = data.date;
                if (timeEl && data.time) timeEl.value = data.time;
                if (zoneEl && data.zone) zoneEl.value = data.zone;
                // กู้คืนตัวเลขแต่ละสินค้า
                Object.entries(data.items || {}).forEach(([id, val]) => {
                    const el = document.getElementById(`bmc_${id}`);
                    if (el) {
                        el.value = val;
                        if (val && val !== '0') {
                            el.style.borderColor = '#f59e0b';
                            el.style.background = '#fffbeb';
                        }
                    }
                });
                Object.entries(data.notes || {}).forEach(([id, val]) => {
                    const el = document.getElementById(`bmcNote_${id}`);
                    if (el) el.value = val;
                });
            }
        });
    };

    // ── 3. สร้าง GR (openCreateGR) ────────────────────────────────────────────
    // เรียกที่ท้าย openCreateGR() → ใน goods-receipt.js
    window._DM_startCreateGR = function() {
        window._DM.start('create_gr', {
            isDirtyFn() {
                return (window._grItems || []).length > 0;
            },
            readFn() {
                const items = window._grItems || [];
                if (!items.length) return null;
                const qtys = {}, notes = {};
                items.forEach(it => {
                    qtys[it.id]  = document.getElementById(`gr_qty_${it.id}`)?.value || '';
                    notes[it.id] = document.getElementById(`gr_itemnote_${it.id}`)?.value || '';
                });
                return {
                    items: JSON.parse(JSON.stringify(items)),
                    date:  document.getElementById('gr_date')?.value  || '',
                    note:  document.getElementById('gr_note')?.value  || '',
                    qtys, notes
                };
            },
            writeFn(data) {
                window._grItems = data.items || [];
                const dateEl = document.getElementById('gr_date');
                const noteEl = document.getElementById('gr_note');
                if (dateEl && data.date) dateEl.value = data.date;
                if (noteEl && data.note) noteEl.value = data.note;
                // re-render รายการ แล้วค่อยใส่ qty/note
                if (window.renderGRItems) {
                    renderGRItems();
                    setTimeout(() => {
                        (data.items || []).forEach(it => {
                            const qEl = document.getElementById(`gr_qty_${it.id}`);
                            const nEl = document.getElementById(`gr_itemnote_${it.id}`);
                            if (qEl && data.qtys?.[it.id]) qEl.value = data.qtys[it.id];
                            if (nEl && data.notes?.[it.id]) nEl.value = data.notes[it.id];
                        });
                    }, 150);
                }
            }
        });
    };

    // ── 4. สร้างใบเบิก (openCreateRequisition) ────────────────────────────────
    // เรียกที่ท้าย openCreateRequisition() → ใน requisition.js
    window._DM_startCreateReq = function() {
        window._DM.start('create_req', {
            isDirtyFn() {
                // dirty ถ้ากรอก qty หรือ purpose/dept
                const purpose = document.getElementById('mr_purpose')?.value || '';
                const dept    = document.getElementById('mr_dept')?.value    || '';
                if (purpose || dept) return true;
                return [...document.querySelectorAll('[id^="mr_qty_"]')]
                    .some(el => parseFloat(el.value) > 0);
            },
            readFn() {
                const zone = document.getElementById('mr_zone')?.value || '';
                const purpose = document.getElementById('mr_purpose')?.value || '';
                const dept    = document.getElementById('mr_dept')?.value    || '';
                const qtys = {}, notes = {};
                document.querySelectorAll('[id^="mr_qty_"]').forEach(el => {
                    const id = el.id.replace('mr_qty_', '');
                    qtys[id] = el.value;
                });
                document.querySelectorAll('[id^="mr_note_"]').forEach(el => {
                    const id = el.id.replace('mr_note_', '');
                    notes[id] = el.value;
                });
                const isDirty = purpose || dept || Object.values(qtys).some(v => parseFloat(v) > 0);
                if (!isDirty) return null;
                return {
                    date:      document.getElementById('mr_date')?.value      || '',
                    dateTxt:   document.getElementById('mr_date_txt')?.value  || '',
                    requester: document.getElementById('mr_requester')?.value || '',
                    dept, zone, purpose, qtys, notes
                };
            },
            writeFn(data) {
                const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
                set('mr_date',      data.date);
                set('mr_date_txt',  data.dateTxt);
                set('mr_requester', data.requester);
                set('mr_dept',      data.dept);
                set('mr_purpose',   data.purpose);
                // เปลี่ยน zone แล้ว re-render ก่อน ค่อยใส่ qty
                const zoneEl = document.getElementById('mr_zone');
                if (zoneEl && data.zone) {
                    zoneEl.value = data.zone;
                    if (window.renderMRItems) {
                        renderMRItems();
                        setTimeout(() => {
                            Object.entries(data.qtys  || {}).forEach(([id, v]) => { const el = document.getElementById(`mr_qty_${id}`);  if (el && v) el.value = v; });
                            Object.entries(data.notes || {}).forEach(([id, v]) => { const el = document.getElementById(`mr_note_${id}`); if (el && v) el.value = v; });
                        }, 150);
                    }
                }
            }
        });
    };

    // ── แสดง Badge บน Dashboard ถ้ามี Draft ค้างอยู่ ──────────────────────────
    window._DM_checkDashboardDrafts = function() {
        const user = window.currentUser?.username || 'anon';
        const SCREENS = [
            { key: 'stock_normal', label: 'นับสต๊อก',       opener: 'openCentralStock',      icon: '📦' },
            { key: 'create_gr',    label: 'สร้าง GR',        opener: 'openCreateGR',          icon: '📝' },
            { key: 'create_req',   label: 'สร้างใบเบิก',     opener: 'openCreateRequisition', icon: '✏️' },
        ];
        const monthlyDrafts = [];
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith("ttgplus_draft_monthly_") && k.endsWith("_" + user)) {
                    const raw = localStorage.getItem(k);
                    if (raw) { const p = JSON.parse(raw); if (p?.data) monthlyDrafts.push({ storageKey: k, data: p }); }
                }
            }
        } catch(_) {}

        const found = [];
        SCREENS.forEach(s => {
            try {
                const raw = localStorage.getItem("ttgplus_draft_" + s.key + "_" + user);
                if (!raw) return;
                const p = JSON.parse(raw);
                if (p?.data) found.push({ ...s, storageKey: "ttgplus_draft_" + s.key + "_" + user });
            } catch(_) {}
        });
        monthlyDrafts.forEach(m => {
            found.push({ key: m.storageKey, label: "นับสต๊อกสิ้นเดือน (" + (m.data.data?.zone||'') + ")", icon: '📋', opener: null, storageKey: m.storageKey, isMonthly: true });
        });
        if (!found.length) return;

        setTimeout(() => {
            const dash = document.getElementById('dashboardView');
            if (!dash || !dash.offsetParent) return;
            document.getElementById('_dm_dash_banner')?.remove();
            const banner = document.createElement('div');
            banner.id = '_dm_dash_banner';
            banner.style.cssText = 'margin:0 0 16px 0;';
            banner.innerHTML = `
            <div style="background:linear-gradient(90deg,#fef9c3,#fef3c7);border:2px solid #f59e0b;border-radius:12px;padding:14px 18px;box-shadow:0 2px 10px rgba(245,158,11,.15);">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
                    <span style="font-size:22px;">⚠️</span>
                    <span style="font-weight:700;font-size:14px;color:#92400e;">พบข้อมูลที่กรอกค้างไว้ก่อนหน้า (${found.length} รายการ) — ยังไม่ได้บันทึก</span>
                    <button onclick="document.getElementById('_dm_dash_banner').remove()" style="margin-left:auto;background:none;border:none;color:#a16207;cursor:pointer;font-size:18px;">✕</button>
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:8px;">
                    ${found.map(f => `<button onclick="window._DM_resumeDraft('" + f.storageKey + "','" + (f.opener||'') + "')" style="background:white;border:1.5px solid #f59e0b;border-radius:8px;padding:7px 14px;cursor:pointer;font-size:13px;font-weight:600;color:#92400e;">${f.icon} กลับไปกรอก: ${f.label}</button>`).join('')}
                    <button onclick="window._DM_clearAllDrafts();document.getElementById('_dm_dash_banner').remove();" style="background:#fef3c7;border:1.5px solid #fcd34d;border-radius:8px;padding:7px 14px;cursor:pointer;font-size:12px;color:#a16207;">🗑️ ลบ draft ทั้งหมด</button>
                </div>
            </div>`;
            const firstEl = dash.querySelector('h2, .stats-row, [class*="card"], div');
            if (firstEl) firstEl.before(banner); else dash.prepend(banner);
        }, 600);
    };

    window._DM_resumeDraft = function(storageKey, opener) {
        document.getElementById('_dm_dash_banner')?.remove();
        if (opener && window[opener]) window[opener]();
    };

    window._DM_clearAllDrafts = function() {
        const user = window.currentUser?.username || 'anon';
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('ttgplus_draft_') && k.endsWith('_' + user)) keys.push(k);
        }
        keys.forEach(k => { try { localStorage.removeItem(k); } catch(_) {} });
    };

})();

// ── Hook goToDashboard หลัง page load ────────────────────────────────────────
// รอให้ home.html โหลด goToDashboard ก่อน แล้วค่อย wrap
window.addEventListener('load', () => {
    // 1. ตรวจ draft ทันทีที่ page โหลด (กรณีรีเฟรช)
    setTimeout(() => {
        if (window._DM_checkDashboardDrafts) _DM_checkDashboardDrafts();
    }, 1200);

    // 2. wrap goToDashboard เพื่อตรวจ draft ทุกครั้งที่กลับ Dashboard
    const _origGTD = window.goToDashboard;
    if (_origGTD) {
        window.goToDashboard = function() {
            _origGTD();
            setTimeout(() => {
                if (window._DM_checkDashboardDrafts) _DM_checkDashboardDrafts();
            }, 400);
        };
    }
});

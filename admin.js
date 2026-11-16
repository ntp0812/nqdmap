/**
 * HỆ THỐNG BẢN ĐỒ SỐ THPT CHUYÊN NGUYỄN QUANG DIÊU
 * Chặng 3 + Cloud Sync (admin.js):
 * - Tự động đồng bộ thời gian thực từ máy tính Admin sang toàn bộ Điện thoại khách qua Firebase Cloud
 */

window.NQDAdminEngine = (function () {
  // 👉 DÁN LINK FIREBASE REALTIME DATABASE CỦA BẠN VÀO GIỮA 2 DẤU NHÁY ĐƠN Ở DÒNG DƯỚI ĐÂY:
  const DEFAULT_FIREBASE_URL = 'https://nqd-map-default-rtdb.firebaseio.com';

  const CLOUD_URL_STORAGE_KEY = 'NQD_FIREBASE_DB_URL';
  let currentRole = null; // null | 'FA' | 'AL'
  let activeTab = 'tab_room';
  let dragMapEnabled = false;
  let draggingRoom = null;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let interiorEditingRoomId = null;

  let cloudSyncTimer = null;
  let lastCloudUpdatedAt = 0;
  let cloudStatusText = 'Chưa nối Cloud';

  const FONT_PRESETS = [
    { name: 'Mặc định (Times New Roman)', url: '', family: "'Times New Roman', Times, serif" },
    { name: '🎃 Halloween Kinh Dị (Creepster)', url: 'https://fonts.googleapis.com/css2?family=Creepster&family=Nosifer&display=swap', family: "'Creepster', cursive, serif" },
    { name: '👻 Ma Quái Cổ Điển (Nosifer)', url: 'https://fonts.googleapis.com/css2?family=Nosifer&display=swap', family: "'Nosifer', cursive, serif" },
    { name: '🚀 Khoa Học Hiện Đại (Montserrat)', url: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@500;700&display=swap', family: "'Montserrat', sans-serif" },
    { name: '🎓 Trang Trọng Nhà Trường (Merriweather)', url: 'https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&display=swap', family: "'Merriweather', serif" }
  ];

  // ================= 1. HỆ THỐNG ĐỒNG BỘ ĐÁM MÂY (FIREBASE REST SYNC) =================
  function getCleanFirebaseUrl() {
    let raw = (DEFAULT_FIREBASE_URL || localStorage.getItem(CLOUD_URL_STORAGE_KEY) || '').trim();
    if (!raw) return '';
    raw = raw.replace(/\/+$/, '');
    if (raw.endsWith('.json')) {
      raw = raw.substring(0, raw.lastIndexOf('/'));
    }
    return raw;
  }

  function updateCloudBadgeUI(text, color) {
    cloudStatusText = text;
    const badge = document.getElementById('adm-cloud-status-pill');
    if (badge) {
      badge.textContent = text;
      badge.style.background = color || '#334155';
    }
  }

  // Đẩy toàn bộ dữ liệu từ máy Admin lên Đám mây
  async function pushStateToCloud(showAlertOnSuccess) {
    const baseUrl = getCleanFirebaseUrl();
    if (!baseUrl) {
      if (showAlertOnSuccess) {
        alert('Bạn chưa nhập Link Firebase Realtime Database! Hãy vào tab "🔐 Mật khẩu & Quyền AL" để dán link Firebase.');
      }
      return;
    }

    try {
      updateCloudBadgeUI('⏳ Đang đồng bộ Cloud...', '#d97706');
      const state = window.NQDMapApp.getState();
      state.updatedAt = Date.now();
      lastCloudUpdatedAt = state.updatedAt;
      window.NQDMapApp.saveState();

      const res = await fetch(`${baseUrl}/nqd_map_master.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state)
      });

      if (!res.ok) throw new Error('HTTP ' + res.status);
      updateCloudBadgeUI('☁️ Đã đồng bộ Cloud', '#059669');
      if (showAlertOnSuccess) {
        alert('✅ Đã đẩy toàn bộ bản đồ lên Đám mây thành công! Mọi điện thoại mở link web đều đã được cập nhật.');
      }
    } catch (err) {
      console.error('Lỗi đẩy Cloud:', err);
      updateCloudBadgeUI('❌ Lỗi Cloud (Kiểm tra Test Mode)', '#dc2626');
      if (showAlertOnSuccess) {
        alert('❌ Không thể ghi lên Firebase! Bạn hãy kiểm tra lại:\n1. Link Firebase đã đúng chưa.\n2. Trong Firebase Realtime Database -> mục Rules đã bật ".read": true, ".write": true (Test mode) chưa.');
      }
    }
  }

  // Tự động đẩy lên Cloud sau 700ms mỗi khi Admin chỉnh sửa
  function scheduleAutoCloudPush() {
    if (!currentRole || !getCleanFirebaseUrl()) return;
    updateCloudBadgeUI('⏳ Đang lưu...', '#d97706');
    if (cloudSyncTimer) clearTimeout(cloudSyncTimer);
    cloudSyncTimer = setTimeout(() => {
      pushStateToCloud(false);
    }, 700);
  }

  // Tải dữ liệu mới nhất từ Đám mây về Điện thoại của khách (hoặc máy tính)
  async function pullStateFromCloud(isSilentPolling) {
    const baseUrl = getCleanFirebaseUrl();
    if (!baseUrl) return;
    // Khi Admin đang gõ/kéo thả thì không tự ghi đè ngược
    if (isSilentPolling && currentRole) return;

    try {
      const res = await fetch(`${baseUrl}/nqd_map_master.json?t=${Date.now()}`, {
        cache: 'no-store'
      });
      if (!res.ok) return;
      const cloudData = await res.json();
      if (!cloudData || !Array.isArray(cloudData.sheets) || cloudData.sheets.length === 0) return;

      if (isSilentPolling && cloudData.updatedAt && cloudData.updatedAt === lastCloudUpdatedAt) {
        return; // Chưa có thay đổi mới
      }

      lastCloudUpdatedAt = cloudData.updatedAt || Date.now();
      const appState = window.NQDMapApp.getState();

      // Cập nhật trực tiếp vào bộ nhớ của ứng dụng
      Object.keys(cloudData).forEach(k => {
        appState[k] = cloudData[k];
      });

      // Nếu là Khách xem trên điện thoại, luôn mở đúng Sheet được đặt là Public
      if (!currentRole && appState.activePublicSheetId) {
        appState.currentViewingSheetId = appState.activePublicSheetId;
      }

      window.NQDMapApp.saveState();
      window.NQDMapApp.refreshAll();
      updateCloudBadgeUI('☁️ Đã đồng bộ Cloud', '#059669');
      if (currentRole) {
        renderExcelSheetBar();
      }
    } catch (err) {
      if (!isSilentPolling) {
        console.warn('Chưa tải được dữ liệu Cloud:', err);
      }
    }
  }

  function saveFirebaseUrlFromInput() {
    const inp = document.getElementById('adm-firebase-url-input');
    if (!inp) return;
    const val = inp.value.trim();
    localStorage.setItem(CLOUD_URL_STORAGE_KEY, val);
    if (val) {
      pushStateToCloud(true);
    } else {
      updateCloudBadgeUI('Chưa nối Cloud', '#475569');
      alert('Đã xóa liên kết Cloud trên trình duyệt này.');
    }
  }

  // ================= 2. CSS GIAO DIỆN ADMIN 6/4 & THANH SHEET EXCEL =================
  function injectAdminStyles() {
    if (document.getElementById('nqd-admin-styles')) return;
    const style = document.createElement('style');
    style.id = 'nqd-admin-styles';
    style.textContent = `
      #admin-panel-container {
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: #f8fafc;
        color: #0f172a;
        display: none;
        flex-direction: column;
        height: 100%;
      }
      body.admin-split-mode #admin-panel-container {
        display: flex !important;
      }
      .adm-top-bar {
        background: #0f172a;
        color: #ffffff;
        padding: 10px 14px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        border-bottom: 2px solid #38bdf8;
        flex-shrink: 0;
      }
      .adm-role-badge {
        font-size: 12.5px;
        font-weight: bold;
        padding: 4px 9px;
        border-radius: 6px;
        background: #f59e0b;
        color: #0f172a;
      }
      .adm-role-badge.lite {
        background: #10b981;
        color: #ffffff;
      }
      #adm-cloud-status-pill {
        font-size: 11px;
        font-weight: bold;
        padding: 3px 8px;
        border-radius: 999px;
        background: #334155;
        color: #ffffff;
        display: inline-block;
        margin-left: 6px;
      }
      .adm-nav-tabs {
        display: flex;
        background: #1e293b;
        padding: 6px 8px 0;
        gap: 4px;
        overflow-x: auto;
        flex-shrink: 0;
      }
      .adm-tab-btn {
        font-size: 12.5px;
        font-weight: bold;
        padding: 8px 12px;
        border: none;
        border-radius: 8px 8px 0 0;
        background: #334155;
        color: #cbd5e1;
        cursor: pointer;
        white-space: nowrap;
      }
      .adm-tab-btn.active {
        background: #f8fafc;
        color: #0f172a;
      }
      .adm-content-scroll {
        flex: 1;
        overflow-y: auto;
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .adm-card {
        background: #ffffff;
        border: 1.5px solid #cbd5e1;
        border-radius: 10px;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.04);
      }
      .adm-card-title {
        font-size: 14px;
        font-weight: bold;
        color: #0f172a;
        border-bottom: 1.5px solid #e2e8f0;
        padding-bottom: 6px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .adm-field {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .adm-field label {
        font-size: 12px;
        font-weight: bold;
        color: #334155;
      }
      .adm-input, .adm-select, .adm-textarea {
        width: 100%;
        padding: 7px 10px;
        border: 1px solid #94a3b8;
        border-radius: 6px;
        font-size: 13px;
        color: #0f172a;
        background: #fff;
      }
      .adm-textarea {
        min-height: 68px;
        resize: vertical;
      }
      .adm-row-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }
      .adm-row-4 {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 6px;
      }
      .adm-btn {
        font-size: 12.5px;
        font-weight: bold;
        padding: 7px 12px;
        border-radius: 7px;
        border: 1px solid transparent;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        transition: all 0.15s ease;
      }
      .adm-btn-primary { background: #0284c7; color: #fff; }
      .adm-btn-primary:hover { background: #0369a1; }
      .adm-btn-success { background: #10b981; color: #fff; }
      .adm-btn-success:hover { background: #059669; }
      .adm-btn-warn { background: #f59e0b; color: #0f172a; }
      .adm-btn-danger { background: #dc2626; color: #fff; }
      .adm-btn-outline { background: #f1f5f9; color: #0f172a; border-color: #94a3b8; }
      .adm-switch-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 6px 8px;
        background: #f1f5f9;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
      }
      #excel-sheet-bar {
        background: #0f172a;
        border-top: 2px solid #38bdf8;
        padding: 5px 10px;
        display: none;
        align-items: center;
        gap: 6px;
        overflow-x: auto;
        z-index: 42;
        flex-shrink: 0;
      }
      body.admin-split-mode #excel-sheet-bar {
        display: flex;
      }
      .excel-sheet-tab {
        font-size: 12.5px;
        font-weight: bold;
        padding: 6px 12px;
        border-radius: 6px 6px 0 0;
        border: 1px solid #475569;
        background: #1e293b;
        color: #cbd5e1;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        white-space: nowrap;
      }
      .excel-sheet-tab.active {
        background: #ffffff;
        color: #0f172a;
        border-color: #38bdf8;
      }
      .sheet-public-pill {
        font-size: 10px;
        background: #10b981;
        color: #ffffff;
        padding: 1px 5px;
        border-radius: 4px;
      }
      .adm-modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.72);
        z-index: 130;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 16px;
      }
      .adm-modal-card {
        width: 100%;
        max-width: 420px;
        background: #ffffff;
        border-radius: 14px;
        border: 2px solid #0f172a;
        overflow: hidden;
        box-shadow: 0 20px 50px rgba(0,0,0,0.5);
        font-family: system-ui, sans-serif;
      }
      #interior-editor-canvas {
        width: 100%;
        height: 290px;
        background: #e2e8f0;
        border: 2px dashed #0284c7;
        border-radius: 8px;
        position: relative;
        overflow: hidden;
      }
      .interior-preview-box {
        position: absolute;
        border: 1.5px solid #0f172a;
        border-radius: 4px;
        font-size: 11px;
        font-weight: bold;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        cursor: pointer;
        padding: 2px;
      }
    `;
    document.head.appendChild(style);
  }

  // ================= 3. ĐĂNG NHẬP 2 CẤP MẬT KHẨU (FA & AL) =================
  function ensureLoginModal() {
    if (document.getElementById('admin-login-backdrop')) return;
    const div = document.createElement('div');
    div.id = 'admin-login-backdrop';
    div.className = 'adm-modal-backdrop';
    div.onclick = () => { div.style.display = 'none'; };
    div.innerHTML = `
      <div class="adm-modal-card" onclick="event.stopPropagation()">
        <div class="modal-header">
          <span>🔐 Đăng nhập Quản trị Sự kiện</span>
          <button class="modal-close-btn" onclick="document.getElementById('admin-login-backdrop').style.display='none'">✖</button>
        </div>
        <div style="padding:16px;display:flex;flex-direction:column;gap:12px;">
          <div style="font-size:13px;color:#334155;line-height:1.45;background:#f1f5f9;padding:10px;border-radius:8px;border:1px solid #cbd5e1;">
            Hệ thống phân làm <strong>2 cấp mật khẩu riêng biệt</strong>:<br/>
            • <strong>Full Admin (NQD Events / BGH):</strong> Toàn quyền chỉnh sửa<br/>
            • <strong>Admin Lite (CLB / Gian hàng):</strong> Thiết kế gian hàng
          </div>
          <div class="adm-field">
            <label>Nhập mật khẩu Admin:</label>
            <input type="password" id="adm-pwd-input" class="adm-input" placeholder="Nhập mật khẩu FA hoặc AL..." />
          </div>
          <div id="adm-login-err" style="color:#dc2626;font-size:12.5px;font-weight:bold;display:none;">
            ❌ Mật khẩu không đúng! Vui lòng kiểm tra lại.
          </div>
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:4px;">
            <button class="adm-btn adm-btn-outline" onclick="document.getElementById('admin-login-backdrop').style.display='none'">Hủy</button>
            <button class="adm-btn adm-btn-primary" onclick="NQDAdminEngine.submitPassword()">Đăng nhập</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(div);

    const input = div.querySelector('#adm-pwd-input');
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitPassword();
    });
  }

  function openLoginPrompt() {
    if (currentRole) {
      logoutAdmin();
      return;
    }
    ensureLoginModal();
    document.getElementById('adm-pwd-input').value = '';
    document.getElementById('adm-login-err').style.display = 'none';
    document.getElementById('admin-login-backdrop').style.display = 'flex';
    setTimeout(() => document.getElementById('adm-pwd-input').focus(), 80);
  }

  function submitPassword() {
    const val = document.getElementById('adm-pwd-input').value.trim();
    const state = window.NQDMapApp.getState();
    const faPwd = (state.passwords && state.passwords.fullAdmin) || 'nqdadmin';
    const alPwd = (state.passwords && state.passwords.adminLite) || 'nqdlite';

    if (val === faPwd) {
      currentRole = 'FA';
      activeTab = 'tab_room';
      enterAdminMode();
    } else if (val === alPwd) {
      currentRole = 'AL';
      activeTab = 'tab_room';
      enterAdminMode();
    } else {
      document.getElementById('adm-login-err').style.display = 'block';
    }
  }

  function enterAdminMode() {
    document.getElementById('admin-login-backdrop').style.display = 'none';
    document.body.classList.add('admin-split-mode');

    const loginBtn = document.getElementById('btn-admin-login');
    if (loginBtn) {
      loginBtn.textContent = currentRole === 'FA' ? '👑 Thoát Full Admin' : '🛠️ Thoát Admin Lite';
      loginBtn.style.background = '#dc2626';
      loginBtn.style.color = '#ffffff';
    }

    renderExcelSheetBar();
    renderAdminPanel();
    setTimeout(() => window.NQDMapApp.centerOnFlagpole(), 260);
  }

  function logoutAdmin() {
    currentRole = null;
    dragMapEnabled = false;
    document.body.classList.remove('admin-split-mode');

    const state = window.NQDMapApp.getState();
    state.currentViewingSheetId = state.activePublicSheetId || 'sheet_origin';
    window.NQDMapApp.saveState();
    window.NQDMapApp.refreshAll();

    const loginBtn = document.getElementById('btn-admin-login');
    if (loginBtn) {
      loginBtn.textContent = '🔐 Admin';
      loginBtn.style.background = '#f8fafc';
      loginBtn.style.color = '#0f172a';
    }
    setTimeout(() => window.NQDMapApp.centerOnFlagpole(), 260);
  }

  // ================= 4. THANH SHEET EXCEL (C1, C2) =================
  function ensureExcelSheetBar() {
    if (document.getElementById('excel-sheet-bar')) return;
    const bar = document.createElement('div');
    bar.id = 'excel-sheet-bar';
    document.body.appendChild(bar);
  }

  function renderExcelSheetBar() {
    ensureExcelSheetBar();
    const bar = document.getElementById('excel-sheet-bar');
    if (!currentRole) {
      bar.style.display = 'none';
      return;
    }

    const state = window.NQDMapApp.getState();
    const activeSheet = window.NQDMapApp.getActiveSheet();
    bar.innerHTML = '';

    state.sheets.forEach(sh => {
      const btn = document.createElement('button');
      btn.className = 'excel-sheet-tab' + (sh.id === activeSheet.id ? ' active' : '');
      const isPub = state.activePublicSheetId === sh.id;
      btn.innerHTML = `
        <span>${sh.name}</span>
        ${isPub ? '<span class="sheet-public-pill">PUBLIC</span>' : ''}
      `;
      btn.onclick = () => {
        if (currentRole === 'AL' && sh.id !== state.activePublicSheetId) {
          alert('Admin Lite chỉ được thao tác trên Sheet Sự Kiện đang được mở!');
          return;
        }
        state.currentViewingSheetId = sh.id;
        window.NQDMapApp.saveState();
        window.NQDMapApp.refreshAll();
        renderExcelSheetBar();
        renderAdminPanel();
      };
      bar.appendChild(btn);
    });

    if (currentRole === 'FA') {
      const addBtn = document.createElement('button');
      addBtn.className = 'adm-btn adm-btn-success';
      addBtn.style.padding = '5px 10px';
      addBtn.textContent = '＋ Tạo Sheet Sự Kiện Mới (Nhân bản Map Gốc)';
      addBtn.onclick = createNewEventSheet;
      bar.appendChild(addBtn);

      if (state.activePublicSheetId !== activeSheet.id) {
        const pubBtn = document.createElement('button');
        pubBtn.className = 'adm-btn adm-btn-warn';
        pubBtn.style.padding = '5px 10px';
        pubBtn.textContent = '🌐 Đặt Sheet này làm PUBLIC cho Khách';
        pubBtn.onclick = () => {
          state.activePublicSheetId = activeSheet.id;
          window.NQDMapApp.saveState();
          scheduleAutoCloudPush();
          renderExcelSheetBar();
          alert(`Đã đặt "${activeSheet.name}" làm bản đồ hiển thị chính thức (Public) cho mọi điện thoại khách tham quan!`);
        };
        bar.appendChild(pubBtn);
      }

      if (!activeSheet.lockedOrigin && state.sheets.length > 1) {
        const delBtn = document.createElement('button');
        delBtn.className = 'adm-btn adm-btn-danger';
        delBtn.style.padding = '5px 10px';
        delBtn.textContent = '🗑️ Xóa Sheet này';
        delBtn.onclick = () => deleteCurrentSheet(activeSheet.id);
        bar.appendChild(delBtn);
      }
    }
  }

  function createNewEventSheet() {
    const sheetName = prompt('Nhập tên Sheet Sự Kiện mới (VD: Sự kiện Halloween / Hội trại 26-3):', '🎃 Sự kiện Halloween');
    if (!sheetName || !sheetName.trim()) return;

    const state = window.NQDMapApp.getState();
    const originSheet = state.sheets.find(s => s.id === 'sheet_origin') || state.sheets[0];

    const newSheet = JSON.parse(JSON.stringify(originSheet));
    newSheet.id = 'sheet_ev_' + Date.now();
    newSheet.name = sheetName.trim();
    newSheet.lockedOrigin = false;
    newSheet.isEvent = true;
    newSheet.headerTitle = sheetName.trim() + ' — THPT Chuyên NQD';
    newSheet.eventDate = new Date().toLocaleDateString('vi-VN');

    state.sheets.push(newSheet);
    state.currentViewingSheetId = newSheet.id;
    state.activePublicSheetId = newSheet.id;
    window.NQDMapApp.saveState();
    scheduleAutoCloudPush();
    window.NQDMapApp.refreshAll();
    renderExcelSheetBar();
    renderAdminPanel();
  }

  function deleteCurrentSheet(sheetId) {
    if (!confirm('Bạn có chắc chắn muốn xóa Sheet sự kiện này không?')) return;
    const state = window.NQDMapApp.getState();
    state.sheets = state.sheets.filter(s => s.id !== sheetId);
    state.currentViewingSheetId = 'sheet_origin';
    if (state.activePublicSheetId === sheetId) {
      state.activePublicSheetId = 'sheet_origin';
    }
    window.NQDMapApp.saveState();
    scheduleAutoCloudPush();
    window.NQDMapApp.refreshAll();
    renderExcelSheetBar();
    renderAdminPanel();
  }

  // ================= 5. RENDER BẢNG ĐIỀU KHIỂN ADMIN BÊN PHẢI =================
  function renderAdminPanel(selectedRoomObj) {
    const container = document.getElementById('admin-panel-container');
    if (!container || !currentRole) return;

    const state = window.NQDMapApp.getState();
    const sheet = window.NQDMapApp.getActiveSheet();
    const isFA = currentRole === 'FA';
    const perms = state.litePermissions || {};

    container.innerHTML = `
      <div class="adm-top-bar">
        <div>
          <span class="adm-role-badge ${isFA ? '' : 'lite'}">
            ${isFA ? '👑 FULL ADMIN' : '🛠️ ADMIN LITE'}
          </span>
          <span id="adm-cloud-status-pill">${getCleanFirebaseUrl() ? cloudStatusText : 'Chưa nối Cloud'}</span>
          <div style="font-size:11.5px;color:#94a3b8;margin-top:3px;">
            Sheet đang mở: <strong style="color:#38bdf8;">${sheet.name}</strong>
          </div>
        </div>
        <div style="display:flex;gap:6px;">
          <button class="adm-btn adm-btn-success" onclick="NQDAdminEngine.pushStateToCloud(true)" title="Đồng bộ ngay lập tức mọi thay đổi lên Đám mây cho toàn bộ Điện thoại">
            ☁️ Đẩy lên Cloud
          </button>
          <button class="adm-btn adm-btn-danger" onclick="NQDAdminEngine.logoutAdmin()">Thoát</button>
        </div>
      </div>

      <div class="adm-nav-tabs">
        <button class="adm-tab-btn ${activeTab === 'tab_room' ? 'active' : ''}" onclick="NQDAdminEngine.switchTab('tab_room')">
          🏠 Phòng & Gian hàng
        </button>
        ${isFA ? `
          <button class="adm-tab-btn ${activeTab === 'tab_event' ? 'active' : ''}" onclick="NQDAdminEngine.switchTab('tab_event')">
            🎨 Header, Font & Bộ lọc SK
          </button>
          <button class="adm-tab-btn ${activeTab === 'tab_sponsors' ? 'active' : ''}" onclick="NQDAdminEngine.switchTab('tab_sponsors')">
            🤝 Nhà Tài Trợ & Line Cố Định
          </button>
          <button class="adm-tab-btn ${activeTab === 'tab_security' ? 'active' : ''}" onclick="NQDAdminEngine.switchTab('tab_security')">
            🔐 Mật khẩu & Đồng bộ Cloud
          </button>
        ` : ''}
      </div>

      <div class="adm-content-scroll" id="adm-tab-body"></div>
    `;

    const body = document.getElementById('adm-tab-body');
    if (activeTab === 'tab_room') {
      renderRoomTab(body, selectedRoomObj, isFA, perms, sheet);
    } else if (activeTab === 'tab_event' && isFA) {
      renderEventHeaderTab(body, sheet);
    } else if (activeTab === 'tab_sponsors' && isFA) {
      renderSponsorsAndLinesTab(body, sheet);
    } else if (activeTab === 'tab_security' && isFA) {
      renderSecurityTab(body, state);
    }
  }

  function switchTab(tabName) {
    activeTab = tabName;
    renderAdminPanel();
  }

  function renderRoomTab(body, room, isFA, perms, sheet) {
    const canAdd = isFA || perms.canAddBooth;
    const canMove = isFA || perms.canMoveBooth;

    const topTools = document.createElement('div');
    topTools.className = 'adm-card';
    topTools.innerHTML = `
      <div class="adm-card-title">
        <span>⚡ Công cụ Bố cục & Gian hàng</span>
        ${sheet.lockedOrigin && isFA ? `
          <label style="font-size:11.5px;color:#d97706;cursor:pointer;">
            <input type="checkbox" ${sheet.allowEditOriginTemp ? 'checked' : ''} onchange="NQDAdminEngine.toggleOriginLock(this.checked)" />
            Mở khóa sửa Map Gốc
          </label>
        ` : ''}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;">
        ${canAdd ? `
          <button class="adm-btn adm-btn-success" onclick="NQDAdminEngine.addNewBooth()">
            ＋ Thêm Gian hàng / Khu vực mới
          </button>
        ` : ''}
        ${canMove ? `
          <button class="adm-btn ${dragMapEnabled ? 'adm-btn-danger' : 'adm-btn-outline'}" onclick="NQDAdminEngine.toggleMapDrag()">
            ${dragMapEnabled ? '✋ Đang BẬT Kéo thả trên Map (Bấm để tắt)' : '✥ Bật Kéo thả vị trí trên Map'}
          </button>
        ` : ''}
      </div>
      <div style="font-size:12px;color:#475569;">
        💡 <em>Chạm vào bất kỳ phòng hoặc gian hàng nào trên bản đồ bên trái để chỉnh sửa. Mọi thay đổi sẽ tự động đẩy lên Cloud.</em>
      </div>
    `;
    body.appendChild(topTools);

    if (!room) {
      const emptyCard = document.createElement('div');
      emptyCard.className = 'adm-card';
      emptyCard.innerHTML = `<div style="text-align:center;color:#64748b;padding:18px;">👈 Hãy click chọn 1 Phòng hoặc Gian hàng trên Bản đồ bên trái để bắt đầu chỉnh sửa.</div>`;
      body.appendChild(emptyCard);
      return;
    }

    if (room.locked) {
      const lockCard = document.createElement('div');
      lockCard.className = 'adm-card';
      lockCard.style.borderColor = '#dc2626';
      lockCard.innerHTML = `
        <div class="adm-card-title" style="color:#dc2626;">🔒 Trục Trung Tâm Bất Biến (${room.name})</div>
        <p style="font-size:13px;color:#334155;line-height:1.45;">
          Theo quy tắc Sườn Khóa Cứng: <strong>Cổng Chính, Tượng Cụ và Cột Cờ</strong> là trung tâm cố định của trường, không thể di chuyển, đổi tên hay xóa ở bất kỳ Sheet nào.
        </p>
      `;
      body.appendChild(lockCard);
      return;
    }

    if (sheet.lockedOrigin && !sheet.allowEditOriginTemp) {
      const originWarn = document.createElement('div');
      originWarn.className = 'adm-card';
      originWarn.style.background = '#fffbeb';
      originWarn.style.borderColor = '#f59e0b';
      originWarn.innerHTML = `
        <div class="adm-card-title" style="color:#b45309;">🔒 Đang ở Sheet Map Gốc (Chế độ Bảo vệ)</div>
        <p style="font-size:13px;color:#78350f;line-height:1.45;">
          Sheet <strong>Map Gốc</strong> được khóa mặc định để tránh lệch sơ đồ trường. Hãy bấm <strong>"＋ Tạo Sheet Sự Kiện Mới"</strong> ở thanh dưới đáy để chỉnh sửa cho sự kiện, hoặc tích vào ô <em>"Mở khóa sửa Map Gốc"</em> ở trên nếu bạn muốn đổi tên các Phòng BM gốc.
        </p>
      `;
      body.appendChild(originWarn);
      return;
    }

    if (!isFA && !room.isCustomBooth) {
      const alWarn = document.createElement('div');
      alWarn.className = 'adm-card';
      alWarn.innerHTML = `
        <div class="adm-card-title" style="color:#dc2626;">⛔ Giới hạn quyền Admin Lite</div>
        <p style="font-size:13px;color:#334155;">
          Tài khoản <strong>Admin Lite</strong> chỉ được phép chỉnh sửa các <strong>Gian hàng CLB</strong> mới tạo, không được phép thay đổi các phòng cố định của nhà trường.
        </p>
      `;
      body.appendChild(alWarn);
      return;
    }

    const canEditInfo = isFA || perms.canEditInfo;
    const canAssignTags = isFA || perms.canAssignTags;
    const editCard = document.createElement('div');
    editCard.className = 'adm-card';

    const allEventTags = sheet.eventTags || [];
    const roomTags = Array.isArray(room.tags) ? room.tags : [];

    const tagsCheckboxesHtml = allEventTags.map(t => `
      <label style="display:inline-flex;align-items:center;gap:5px;font-size:12.5px;background:#fffbeb;border:1px solid #f59e0b;padding:4px 8px;border-radius:6px;cursor:pointer;">
        <input type="checkbox" value="${t.id}" ${roomTags.includes(t.id) ? 'checked' : ''} onchange="NQDAdminEngine.toggleRoomTag('${room.id}', '${t.id}', this.checked)" ${!canAssignTags ? 'disabled' : ''} />
        ${t.label}
      </label>
    `).join('');

    editCard.innerHTML = `
      <div class="adm-card-title">
        <span>✏️ Đang chỉnh sửa: <strong style="color:#0284c7;">${room.name}</strong></span>
        ${(isFA || room.isCustomBooth) ? `
          <button class="adm-btn adm-btn-danger" style="padding:3px 8px;font-size:11px;" onclick="NQDAdminEngine.deleteRoom('${room.id}')">🗑️ Xóa ô này</button>
        ` : ''}
      </div>

      <div class="adm-switch-row" style="background:#fef2f2;border:1px solid #fecaca;">
        <span style="color:#991b1b;">🔧 Gắn nhãn "Đang sửa" (Khách xem chỉ hiện "Đang cập nhật")</span>
        <input type="checkbox" ${room.underMaintenance ? 'checked' : ''} onchange="NQDAdminEngine.updateRoomProp('${room.id}', 'underMaintenance', this.checked)" />
      </div>

      <div class="adm-row-2">
        <div class="adm-field">
          <label>Tên phòng / Gian hàng:</label>
          <input type="text" class="adm-input" value="${room.name || ''}" ${!canEditInfo ? 'disabled' : ''} oninput="NQDAdminEngine.updateRoomProp('${room.id}', 'name', this.value)" />
        </div>
        <div class="adm-field">
          <label>Thuộc Tầng:</label>
          <select class="adm-select" onchange="NQDAdminEngine.updateRoomProp('${room.id}', 'floor', this.value)">
            <option value="tret" ${room.floor === 'tret' ? 'selected' : ''}>Tầng Trệt</option>
            <option value="lau1" ${room.floor === 'lau1' ? 'selected' : ''}>Lầu 1</option>
            <option value="lau2" ${room.floor === 'lau2' ? 'selected' : ''}>Lầu 2</option>
            <option value="all" ${room.floor === 'all' ? 'selected' : ''}>Tất cả các tầng</option>
          </select>
        </div>
      </div>

      <div class="adm-row-2">
        <div class="adm-field">
          <label>Phân mục gốc:</label>
          <select class="adm-select" onchange="NQDAdminEngine.updateRoomProp('${room.id}', 'category', this.value)">
            <option value="classroom" ${room.category === 'classroom' ? 'selected' : ''}>🏫 Lớp học</option>
            <option value="lab" ${room.category === 'lab' ? 'selected' : ''}>🔬 Phòng TN/BM</option>
            <option value="admin" ${room.category === 'admin' ? 'selected' : ''}>🏛️ Hành chính</option>
            <option value="facility" ${room.category === 'facility' ? 'selected' : ''}>🌳 Ngoại vi / Sự kiện</option>
            <option value="dorm" ${room.category === 'dorm' ? 'selected' : ''}>🛏️ Ký túc xá</option>
            <option value="wc" ${room.category === 'wc' ? 'selected' : ''}>🚻 Nhà vệ sinh (WC)</option>
            <option value="stair" ${room.category === 'stair' ? 'selected' : ''}>🪜 Cầu thang</option>
          </select>
        </div>
        <div class="adm-field">
          <label>Màu sắc ô & Hướng chữ:</label>
          <div style="display:flex;gap:6px;align-items:center;">
            <input type="color" value="${room.color || '#26c6da'}" style="width:42px;height:32px;border:1px solid #94a3b8;border-radius:4px;cursor:pointer;" onchange="NQDAdminEngine.updateRoomProp('${room.id}', 'color', this.value)" />
            <label style="font-size:12px;display:flex;align-items:center;gap:4px;cursor:pointer;">
              <input type="checkbox" ${room.vertical ? 'checked' : ''} onchange="NQDAdminEngine.updateRoomProp('${room.id}', 'vertical', this.checked)" />
              Xoay chữ dọc
            </label>
          </div>
        </div>
      </div>

      ${canMove ? `
        <div class="adm-field">
          <label>Vị trí (X, Y) & Kích thước (Rộng, Cao):</label>
          <div class="adm-row-4">
            <input type="number" class="adm-input" title="Tọa độ X" value="${Math.round(room.x)}" onchange="NQDAdminEngine.updateRoomProp('${room.id}', 'x', Number(this.value))" />
            <input type="number" class="adm-input" title="Tọa độ Y" value="${Math.round(room.y)}" onchange="NQDAdminEngine.updateRoomProp('${room.id}', 'y', Number(this.value))" />
            <input type="number" class="adm-input" title="Chiều rộng W" value="${Math.round(room.w)}" onchange="NQDAdminEngine.updateRoomProp('${room.id}', 'w', Math.max(24, Number(this.value)))" />
            <input type="number" class="adm-input" title="Chiều cao H" value="${Math.round(room.h)}" onchange="NQDAdminEngine.updateRoomProp('${room.id}', 'h', Math.max(24, Number(this.value)))" />
          </div>
        </div>
      ` : ''}

      <div class="adm-field">
        <label>⭐ Nhãn chú ý đặc biệt của Sự kiện (Bộ lọc trang trí quầy CLB):</label>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:2px;">
          ${tagsCheckboxesHtml || '<span style="font-size:12px;color:#64748b;">Chưa có nhãn sự kiện</span>'}
        </div>
      </div>

      <div class="adm-field">
        <label>🖼️ Hình ảnh khu vực (Dán Link URL hoặc Tải ảnh từ máy):</label>
        <input type="text" class="adm-input" placeholder="Dán link ảnh (https://...) hoặc tải file bên dưới" value="${room.imageUrl || ''}" oninput="NQDAdminEngine.updateRoomProp('${room.id}', 'imageUrl', this.value)" />
        <div style="display:flex;align-items:center;gap:8px;margin-top:4px;">
          <input type="file" accept="image/*" style="font-size:12px;flex:1;" onchange="NQDAdminEngine.handleImageFileUpload(event, '${room.id}')" />
          ${room.imageUrl ? `<button class="adm-btn adm-btn-outline" style="padding:4px 8px;font-size:11px;" onclick="NQDAdminEngine.updateRoomProp('${room.id}', 'imageUrl', ''); NQDAdminEngine.onRoomSelected(NQDMapApp.findRoomById('${room.id}'));">Xóa ảnh</button>` : ''}
        </div>
      </div>

      <div class="adm-field">
        <label>📝 Nội dung mô tả (Hiện khi khách bấm Xem thông tin):</label>
        <textarea class="adm-textarea" ${!canEditInfo ? 'disabled' : ''} oninput="NQDAdminEngine.updateRoomProp('${room.id}', 'desc', this.value)">${room.desc || ''}</textarea>
      </div>

      ${isFA ? `
        <div style="border-top:1.5px dashed #cbd5e1;padding-top:10px;display:flex;flex-direction:column;gap:8px;">
          <div class="adm-switch-row" style="background:#e0f2fe;border:1px solid #7dd3fc;">
            <span style="color:#0369a1;">🌐 Public Nội Thất đè trực tiếp lên Map chính (Cho phép vẽ Line vào trong)</span>
            <input type="checkbox" ${room.interiorPublic ? 'checked' : ''} onchange="NQDAdminEngine.toggleInteriorPublic('${room.id}', this.checked)" />
          </div>
          <button class="adm-btn adm-btn-primary" onclick="NQDAdminEngine.openInteriorDesigner('${room.id}')">
            🏛️ Thiết kế bố cục nội thất bên trong (${(room.interiorItems || []).length} mục)
          </button>
        </div>
      ` : ''}
    `;

    body.appendChild(editCard);
  }

  function renderEventHeaderTab(body, sheet) {
    const card = document.createElement('div');
    card.className = 'adm-card';
    const presetOptions = FONT_PRESETS.map((p, idx) => `<option value="${idx}">${p.name}</option>`).join('');
    const coOrgs = sheet.coOrganizers || [];

    card.innerHTML = `
      <div class="adm-card-title">🎨 Cài đặt Header, Tiêu đề & Font chữ Sự kiện</div>
      <div class="adm-switch-row">
        <span>Chế độ Bản đồ Sự kiện (Hiện ngày diễn ra, Bộ lọc SK & Nút Nhà tài trợ)</span>
        <input type="checkbox" ${sheet.isEvent ? 'checked' : ''} onchange="NQDAdminEngine.updateSheetMeta('isEvent', this.checked)" />
      </div>
      <div class="adm-field">
        <label>Tiêu đề hiển thị trên Header:</label>
        <input type="text" class="adm-input" value="${sheet.headerTitle || ''}" oninput="NQDAdminEngine.updateSheetMeta('headerTitle', this.value)" />
      </div>
      <div class="adm-field">
        <label>Ngày diễn ra sự kiện (VD: 31/10/2026 - Đêm hội Halloween):</label>
        <input type="text" class="adm-input" value="${sheet.eventDate || ''}" placeholder="Để trống nếu ở trạng thái mặc định" oninput="NQDAdminEngine.updateSheetMeta('eventDate', this.value)" />
      </div>
      <div class="adm-field">
        <label>Chọn nhanh Font chữ chủ đề (VD: Font Halloween ghê rợn):</label>
        <select class="adm-select" onchange="NQDAdminEngine.applyFontPreset(this.value)">
          <option value="">-- Chọn mẫu Font có sẵn --</option>
          ${presetOptions}
        </select>
      </div>
      <div class="adm-row-2">
        <div class="adm-field">
          <label>Link Google Font tùy chỉnh:</label>
          <input type="text" id="adm-font-url" class="adm-input" value="${sheet.customFontUrl || ''}" placeholder="https://fonts.googleapis.com/css2?family=..." oninput="NQDAdminEngine.updateSheetMeta('customFontUrl', this.value)" />
        </div>
        <div class="adm-field">
          <label>Tên CSS Font-family:</label>
          <input type="text" id="adm-font-fam" class="adm-input" value="${sheet.customFontFamily || ''}" placeholder="'Creepster', cursive" oninput="NQDAdminEngine.updateSheetMeta('customFontFamily', this.value)" />
        </div>
      </div>
    `;
    body.appendChild(card);

    const orgCard = document.createElement('div');
    orgCard.className = 'adm-card';
    orgCard.innerHTML = `
      <div class="adm-card-title">
        <span>🚩 Logo Trường & CLB Đồng Tổ Chức (2-3 Logo trên Header)</span>
        <button class="adm-btn adm-btn-success" style="padding:4px 8px;font-size:11.5px;" onclick="NQDAdminEngine.addCoOrganizer()">＋ Thêm Logo</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${coOrgs.map((org, idx) => `
          <div style="border:1px solid #cbd5e1;border-radius:8px;padding:8px;background:#f8fafc;display:flex;flex-direction:column;gap:6px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <strong style="font-size:12.5px;">Logo #${idx + 1}: ${org.name || ''}</strong>
              ${coOrgs.length > 1 ? `<button class="adm-btn adm-btn-danger" style="padding:2px 6px;font-size:11px;" onclick="NQDAdminEngine.removeCoOrganizer(${idx})">Xóa</button>` : ''}
            </div>
            <div class="adm-row-2">
              <input type="text" class="adm-input" placeholder="Tên đơn vị (VD: NQD Events)" value="${org.name || ''}" oninput="NQDAdminEngine.updateCoOrganizer(${idx}, 'name', this.value)" />
              <input type="text" class="adm-input" placeholder="Chữ viết tắt (VD: ESC)" value="${org.logoText || ''}" oninput="NQDAdminEngine.updateCoOrganizer(${idx}, 'logoText', this.value)" />
            </div>
            <input type="text" class="adm-input" placeholder="Link ảnh Logo (hoặc chọn file bên dưới)" value="${org.logoUrl || ''}" oninput="NQDAdminEngine.updateCoOrganizer(${idx}, 'logoUrl', this.value)" />
            <input type="file" accept="image/*" style="font-size:11.5px;" onchange="NQDAdminEngine.uploadCoOrgLogo(event, ${idx})" />
          </div>
        `).join('')}
      </div>
    `;
    body.appendChild(orgCard);

    const tagCard = document.createElement('div');
    tagCard.className = 'adm-card';
    const tags = sheet.eventTags || [];
    tagCard.innerHTML = `
      <div class="adm-card-title">
        <span>⭐ Bộ lọc Nhãn Chú Ý Đặc Biệt (Cho AL trang trí gian hàng)</span>
        <button class="adm-btn adm-btn-primary" style="padding:4px 8px;font-size:11.5px;" onclick="NQDAdminEngine.addEventTag()">＋ Thêm Nhãn</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;">
        ${tags.map((t, i) => `
          <div style="display:flex;gap:6px;align-items:center;">
            <input type="text" class="adm-input" value="${t.label}" oninput="NQDAdminEngine.updateEventTag(${i}, this.value)" />
            <button class="adm-btn adm-btn-danger" style="padding:5px 8px;" onclick="NQDAdminEngine.removeEventTag(${i})">✖</button>
          </div>
        `).join('')}
      </div>
    `;
    body.appendChild(tagCard);
  }

  function renderSponsorsAndLinesTab(body, sheet) {
    const spCard = document.createElement('div');
    spCard.className = 'adm-card';
    const tiers = sheet.sponsorTiers || [];

    spCard.innerHTML = `
      <div class="adm-card-title">
        <span>🤝 Thiết kế Trang kéo "Các Nhà Tài Trợ"</span>
        <button class="adm-btn adm-btn-success" style="padding:4px 8px;font-size:11.5px;" onclick="NQDAdminEngine.addSponsorTier()">＋ Thêm Hạng Mục</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${tiers.map((tier, tIdx) => `
          <div style="border:1.5px solid #f59e0b;border-radius:8px;padding:10px;background:#fffbeb;display:flex;flex-direction:column;gap:8px;">
            <div style="display:flex;gap:6px;align-items:center;">
              <input type="text" class="adm-input" style="font-weight:bold;" value="${tier.tierName || ''}" placeholder="Tên hạng mục (VD: Nhà Tài Trợ Vàng)" oninput="NQDAdminEngine.updateTierName(${tIdx}, this.value)" />
              <button class="adm-btn adm-btn-primary" style="white-space:nowrap;" onclick="NQDAdminEngine.addSponsorItem(${tIdx})">＋ Nhà tài trợ</button>
              <button class="adm-btn adm-btn-danger" onclick="NQDAdminEngine.removeSponsorTier(${tIdx})">🗑️</button>
            </div>
            ${(tier.items || []).map((sp, sIdx) => `
              <div style="background:#fff;border:1px solid #cbd5e1;border-radius:6px;padding:8px;display:flex;flex-direction:column;gap:5px;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <strong style="font-size:12px;">Đơn vị #${sIdx + 1}</strong>
                  <button class="adm-btn adm-btn-danger" style="padding:2px 6px;font-size:10px;" onclick="NQDAdminEngine.removeSponsorItem(${tIdx}, ${sIdx})">Xóa</button>
                </div>
                <div class="adm-row-2">
                  <input type="text" class="adm-input" placeholder="Tên Nhà tài trợ" value="${sp.name || ''}" oninput="NQDAdminEngine.updateSponsorItem(${tIdx}, ${sIdx}, 'name', this.value)" />
                  <input type="text" class="adm-input" placeholder="Link Web/Fanpage (https://...)" value="${sp.linkUrl || ''}" oninput="NQDAdminEngine.updateSponsorItem(${tIdx}, ${sIdx}, 'linkUrl', this.value)" />
                </div>
                <input type="text" class="adm-input" placeholder="Link ảnh Logo hoặc tải file bên dưới" value="${sp.logoUrl || ''}" oninput="NQDAdminEngine.updateSponsorItem(${tIdx}, ${sIdx}, 'logoUrl', this.value)" />
                <input type="file" accept="image/*" style="font-size:11px;" onchange="NQDAdminEngine.uploadSponsorLogo(event, ${tIdx}, ${sIdx})" />
              </div>
            `).join('')}
          </div>
        `).join('')}
      </div>
    `;
    body.appendChild(spCard);

    const lineCard = document.createElement('div');
    lineCard.className = 'adm-card';
    const allRooms = [...window.NQDMapApp.getFixedLandmarks(), ...(sheet.rooms || [])];
    const roomOpts = allRooms.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
    const fixedLines = sheet.fixedLines || [];

    lineCard.innerHTML = `
      <div class="adm-card-title">🧭 Tạo Line Dẫn Đường Cố Định Đặc Biệt</div>
      <div class="adm-row-2">
        <div class="adm-field">
          <label>Từ điểm:</label>
          <select id="fl-from" class="adm-select">${roomOpts}</select>
        </div>
        <div class="adm-field">
          <label>Đến điểm:</label>
          <select id="fl-to" class="adm-select">${roomOpts}</select>
        </div>
      </div>
      <div class="adm-row-2">
        <input type="text" id="fl-label" class="adm-input" placeholder="Nhãn (VD: Lộ trình Khai mạc)" />
        <button class="adm-btn adm-btn-primary" onclick="NQDAdminEngine.addFixedEventLine()">＋ Thêm Line Cố Định</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:4px;">
        ${fixedLines.map((fl, idx) => `
          <div style="display:flex;justify-content:space-between;align-items:center;background:#f1f5f9;padding:6px 10px;border-radius:6px;font-size:12.5px;">
            <span><strong>${fl.label || 'Line cố định'}</strong></span>
            <button class="adm-btn adm-btn-danger" style="padding:3px 7px;font-size:11px;" onclick="NQDAdminEngine.removeFixedEventLine(${idx})">Xóa</button>
          </div>
        `).join('')}
      </div>
    `;
    body.appendChild(lineCard);
  }

  function renderSecurityTab(body, state) {
    const perms = state.litePermissions || {};
    const currentCloudUrl = getCleanFirebaseUrl();

    // Card Đồng bộ Đám mây Firebase
    const cloudCard = document.createElement('div');
    cloudCard.className = 'adm-card';
    cloudCard.style.borderColor = '#0284c7';
    cloudCard.style.background = '#f0f9ff';
    cloudCard.innerHTML = `
      <div class="adm-card-title" style="color:#0369a1;">☁️ Cấu hình Đồng Bộ Đám Mây (Firebase Realtime Database)</div>
      <div style="font-size:12px;color:#334155;line-height:1.45;">
        Dán link Firebase Realtime Database (VD: <code>https://bando-nqd-default-rtdb.firebaseio.com</code>) vào ô dưới đây hoặc vào <strong>dòng số 9 của file admin.js</strong> để mọi điện thoại khách tự động cập nhật theo thời gian thực:
      </div>
      <div class="adm-field">
        <input type="text" id="adm-firebase-url-input" class="adm-input" placeholder="https://ten-du-an-default-rtdb.firebaseio.com" value="${currentCloudUrl}" />
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="adm-btn adm-btn-primary" onclick="NQDAdminEngine.saveFirebaseUrlFromInput()">
          ☁️ Lưu Link & Đẩy dữ liệu lên Cloud ngay
        </button>
        <button class="adm-btn adm-btn-outline" onclick="NQDAdminEngine.pullStateFromCloud(false)">
          🔄 Tải dữ liệu từ Cloud về máy
        </button>
      </div>
    `;
    body.appendChild(cloudCard);

    const secCard = document.createElement('div');
    secCard.className = 'adm-card';
    secCard.innerHTML = `
      <div class="adm-card-title">🔐 Đổi Mật Khẩu 2 Cấp Admin (Full Admin & Admin Lite)</div>
      <div class="adm-row-2">
        <div class="adm-field">
          <label>Mật khẩu Full Admin (FA - BGH/NQD Events):</label>
          <input type="text" id="pwd-fa-input" class="adm-input" value="${state.passwords.fullAdmin}" />
        </div>
        <div class="adm-field">
          <label>Mật khẩu Admin Lite (AL - Gian hàng CLB):</label>
          <input type="text" id="pwd-al-input" class="adm-input" value="${state.passwords.adminLite}" />
        </div>
      </div>
      <button class="adm-btn adm-btn-primary" onclick="NQDAdminEngine.savePasswords()">💾 Lưu thay đổi Mật khẩu</button>
    `;
    body.appendChild(secCard);

    const permCard = document.createElement('div');
    permCard.className = 'adm-card';
    permCard.innerHTML = `
      <div class="adm-card-title">🛡️ Bảng Mở Quyền Hạn Cho Admin Lite</div>
      <div class="adm-switch-row">
        <span>1. Cho phép AL tự tạo thêm ô Gian hàng mới</span>
        <input type="checkbox" ${perms.canAddBooth ? 'checked' : ''} onchange="NQDAdminEngine.updateLitePerm('canAddBooth', this.checked)" />
      </div>
      <div class="adm-switch-row">
        <span>2. Cho phép AL thay đổi vị trí / kích thước Gian hàng</span>
        <input type="checkbox" ${perms.canMoveBooth ? 'checked' : ''} onchange="NQDAdminEngine.updateLitePerm('canMoveBooth', this.checked)" />
      </div>
      <div class="adm-switch-row">
        <span>3. Cho phép AL đổi tên, ảnh & viết mô tả Gian hàng</span>
        <input type="checkbox" ${perms.canEditInfo ? 'checked' : ''} onchange="NQDAdminEngine.updateLitePerm('canEditInfo', this.checked)" />
      </div>
      <div class="adm-switch-row">
        <span>4. Cho phép AL gắn nhãn Bộ lọc sự kiện (Check-in, Đồ ăn, Trò chơi...)</span>
        <input type="checkbox" ${perms.canAssignTags ? 'checked' : ''} onchange="NQDAdminEngine.updateLitePerm('canAssignTags', this.checked)" />
      </div>
    `;
    body.appendChild(permCard);

    const backupCard = document.createElement('div');
    backupCard.className = 'adm-card';
    backupCard.innerHTML = `
      <div class="adm-card-title">📦 Sao lưu File Dữ liệu & Khôi phục</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;">
        <button class="adm-btn adm-btn-outline" onclick="NQDAdminEngine.exportJSONBackup()">⬇️ Tải file JSON Sao lưu</button>
        <label class="adm-btn adm-btn-outline" style="cursor:pointer;">
          ⬆️ Nhập file JSON
          <input type="file" accept=".json" style="display:none;" onchange="NQDAdminEngine.importJSONBackup(event)" />
        </label>
        <button class="adm-btn adm-btn-danger" onclick="if(confirm('Khôi phục toàn bộ dữ liệu về Map Gốc ban đầu?')) { NQDMapApp.resetMasterDefault(); NQDAdminEngine.scheduleAutoCloudPush(); NQDAdminEngine.renderExcelSheetBar(); NQDAdminEngine.renderAdminPanel(); }">
          🔄 Reset về Mặc định
        </button>
      </div>
    `;
    body.appendChild(backupCard);
  }

  // ================= 6. CÁC HÀM CẬP NHẬT DỮ LIỆU & KÉO THẢ =================
  function onRoomSelected(room) {
    if (!currentRole) return;
    if (activeTab !== 'tab_room') activeTab = 'tab_room';
    renderAdminPanel(room);
  }

  function toggleOriginLock(val) {
    const sheet = window.NQDMapApp.getActiveSheet();
    sheet.allowEditOriginTemp = val;
    window.NQDMapApp.saveState();
    renderAdminPanel();
  }

  function updateRoomProp(roomId, prop, value) {
    const sheet = window.NQDMapApp.getActiveSheet();
    const r = sheet.rooms.find(x => x.id === roomId);
    if (!r || r.locked) return;
    r[prop] = value;
    window.NQDMapApp.saveState();
    window.NQDMapApp.refreshAll();
    scheduleAutoCloudPush();
  }

  function toggleRoomTag(roomId, tagId, checked) {
    const sheet = window.NQDMapApp.getActiveSheet();
    const r = sheet.rooms.find(x => x.id === roomId);
    if (!r) return;
    if (!Array.isArray(r.tags)) r.tags = [];
    if (checked && !r.tags.includes(tagId)) {
      r.tags.push(tagId);
    } else if (!checked) {
      r.tags = r.tags.filter(id => id !== tagId);
    }
    window.NQDMapApp.saveState();
    window.NQDMapApp.refreshAll();
    scheduleAutoCloudPush();
  }

  function addNewBooth() {
    const sheet = window.NQDMapApp.getActiveSheet();
    if (sheet.lockedOrigin && !sheet.allowEditOriginTemp) {
      alert('Hãy tạo Sheet Sự Kiện mới ở thanh dưới cùng trước khi thêm gian hàng!');
      return;
    }
    const name = prompt('Nhập tên Gian hàng / Khu vực sự kiện mới:', '🎪 Gian hàng CLB');
    if (!name) return;

    const newRoom = {
      id: 'booth_' + Date.now(),
      name: name.trim(),
      floor: 'tret',
      category: 'facility',
      x: 560,
      y: 760,
      w: 110,
      h: 70,
      color: '#fde047',
      fontSize: 13,
      isCustomBooth: true,
      tags: [],
      desc: 'Gian hàng sự kiện tại sân trường.'
    };
    sheet.rooms.push(newRoom);
    window.NQDMapApp.saveState();
    window.NQDMapApp.refreshAll();
    window.NQDMapApp.selectRoomOnMap(newRoom.id);
    scheduleAutoCloudPush();
  }

  function deleteRoom(roomId) {
    if (!confirm('Xóa khu vực / gian hàng này khỏi Sheet hiện tại?')) return;
    const sheet = window.NQDMapApp.getActiveSheet();
    sheet.rooms = sheet.rooms.filter(r => r.id !== roomId);
    window.NQDMapApp.saveState();
    window.NQDMapApp.refreshAll();
    renderAdminPanel(null);
    scheduleAutoCloudPush();
  }

  function readFileAsCompressedDataUrl(file, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 720;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
          else { w = Math.round((w * maxDim) / h); h = maxDim; }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        callback(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function handleImageFileUpload(event, roomId) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    readFileAsCompressedDataUrl(file, (dataUrl) => {
      updateRoomProp(roomId, 'imageUrl', dataUrl);
      onRoomSelected(window.NQDMapApp.findRoomById(roomId));
    });
  }

  function toggleMapDrag() {
    dragMapEnabled = !dragMapEnabled;
    renderAdminPanel(window.NQDMapApp.findRoomById(
      document.querySelector('.map-room.selected-room')?.id?.replace('room-el-', '')
    ));
  }

  function setupMapRoomDragging() {
    const vp = document.getElementById('map-viewport');
    if (!vp) return;

    vp.addEventListener('mousedown', (e) => {
      if (!currentRole || !dragMapEnabled) return;
      const roomEl = e.target.closest('.map-room');
      if (!roomEl) return;

      const roomId = roomEl.id.replace('room-el-', '');
      const sheet = window.NQDMapApp.getActiveSheet();
      const room = sheet.rooms.find(r => r.id === roomId);
      if (!room || room.locked) return;
      if (currentRole === 'AL' && !room.isCustomBooth) return;

      e.stopPropagation();
      draggingRoom = room;
      dragOffsetX = e.clientX;
      dragOffsetY = e.clientY;
      window.NQDMapApp.selectRoomOnMap(room.id);
    }, true);

    window.addEventListener('mousemove', (e) => {
      if (!draggingRoom) return;
      const dx = (e.clientX - dragOffsetX) / 0.65;
      const dy = (e.clientY - dragOffsetY) / 0.65;
      dragOffsetX = e.clientX;
      dragOffsetY = e.clientY;

      draggingRoom.x = Math.round(draggingRoom.x + dx);
      draggingRoom.y = Math.round(draggingRoom.y + dy);
      const el = document.getElementById('room-el-' + draggingRoom.id);
      if (el) {
        el.style.left = draggingRoom.x + 'px';
        el.style.top = draggingRoom.y + 'px';
      }
    });

    window.addEventListener('mouseup', () => {
      if (draggingRoom) {
        const finished = draggingRoom;
        draggingRoom = null;
        window.NQDMapApp.saveState();
        window.NQDMapApp.refreshAll();
        onRoomSelected(finished);
        scheduleAutoCloudPush();
      }
    });
  }

  // ================= 7. THIẾT KẾ NỘI THẤT PHÒNG LỚN =================
  function toggleInteriorPublic(roomId, checked) {
    const sheet = window.NQDMapApp.getActiveSheet();
    const r = sheet.rooms.find(x => x.id === roomId);
    if (!r) return;
    r.hasInterior = true;
    r.interiorPublic = checked;
    window.NQDMapApp.saveState();
    window.NQDMapApp.refreshAll();
    scheduleAutoCloudPush();
  }

  function ensureInteriorModal() {
    if (document.getElementById('interior-designer-backdrop')) return;
    const div = document.createElement('div');
    div.id = 'interior-designer-backdrop';
    div.className = 'adm-modal-backdrop';
    div.innerHTML = `
      <div class="adm-modal-card" style="max-width:650px;" onclick="event.stopPropagation()">
        <div class="modal-header">
          <span id="int-modal-title">🏛️ Thiết kế Bố cục Nội thất</span>
          <button class="modal-close-btn" onclick="document.getElementById('interior-designer-backdrop').style.display='none'">✖</button>
        </div>
        <div style="padding:14px;display:flex;flex-direction:column;gap:12px;max-height:82vh;overflow-y:auto;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
            <span style="font-size:13px;color:#334155;">Thêm các khu vực nhỏ bên trong (Sân khấu, Bàn Check-in, Gian hàng...)</span>
            <button class="adm-btn adm-btn-success" onclick="NQDAdminEngine.addInteriorSubItem()">＋ Thêm Ô Nội Thất</button>
          </div>
          <div id="interior-editor-canvas"></div>
          <div id="interior-subitems-list" style="display:flex;flex-direction:column;gap:8px;"></div>
        </div>
      </div>
    `;
    document.body.appendChild(div);
  }

  function openInteriorDesigner(roomId) {
    ensureInteriorModal();
    interiorEditingRoomId = roomId;
    renderInteriorDesignerContent();
    document.getElementById('interior-designer-backdrop').style.display = 'flex';
  }

  function renderInteriorDesignerContent() {
    const sheet = window.NQDMapApp.getActiveSheet();
    const room = sheet.rooms.find(r => r.id === interiorEditingRoomId);
    if (!room) return;
    room.hasInterior = true;
    if (!Array.isArray(room.interiorItems)) room.interiorItems = [];

    document.getElementById('int-modal-title').textContent = `🏛️ Thiết kế Nội thất: ${room.name}`;
    const canvas = document.getElementById('interior-editor-canvas');
    const list = document.getElementById('interior-subitems-list');
    canvas.innerHTML = '';
    list.innerHTML = '';

    room.interiorItems.forEach((item, idx) => {
      const box = document.createElement('div');
      box.className = 'interior-preview-box';
      box.style.left = item.rx + '%';
      box.style.top = item.ry + '%';
      box.style.width = item.rw + '%';
      box.style.height = item.rh + '%';
      box.style.backgroundColor = item.color || '#fde047';
      box.textContent = item.name;
      canvas.appendChild(box);

      const row = document.createElement('div');
      row.style.cssText = 'border:1px solid #cbd5e1;border-radius:8px;padding:8px;background:#f8fafc;display:flex;flex-direction:column;gap:6px;';
      row.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
          <input type="text" class="adm-input" style="font-weight:bold;" value="${item.name}" oninput="NQDAdminEngine.updateInteriorItem(${idx}, 'name', this.value)" />
          <input type="color" value="${item.color || '#fde047'}" onchange="NQDAdminEngine.updateInteriorItem(${idx}, 'color', this.value)" />
          <button class="adm-btn adm-btn-danger" onclick="NQDAdminEngine.removeInteriorItem(${idx})">🗑️</button>
        </div>
        <div class="adm-row-4">
          <input type="number" class="adm-input" title="Vị trí ngang %" placeholder="X%" value="${item.rx}" onchange="NQDAdminEngine.updateInteriorItem(${idx}, 'rx', Number(this.value))" />
          <input type="number" class="adm-input" title="Vị trí dọc %" placeholder="Y%" value="${item.ry}" onchange="NQDAdminEngine.updateInteriorItem(${idx}, 'ry', Number(this.value))" />
          <input type="number" class="adm-input" title="Rộng %" placeholder="Rộng%" value="${item.rw}" onchange="NQDAdminEngine.updateInteriorItem(${idx}, 'rw', Number(this.value))" />
          <input type="number" class="adm-input" title="Cao %" placeholder="Cao%" value="${item.rh}" onchange="NQDAdminEngine.updateInteriorItem(${idx}, 'rh', Number(this.value))" />
        </div>
        <input type="text" class="adm-input" placeholder="Mô tả chi tiết cho ô nội thất này..." value="${item.desc || ''}" oninput="NQDAdminEngine.updateInteriorItem(${idx}, 'desc', this.value)" />
      `;
      list.appendChild(row);
    });
  }

  function addInteriorSubItem() {
    const sheet = window.NQDMapApp.getActiveSheet();
    const room = sheet.rooms.find(r => r.id === interiorEditingRoomId);
    if (!room) return;
    if (!Array.isArray(room.interiorItems)) room.interiorItems = [];

    room.interiorItems.push({
      id: 'sub_' + Date.now(),
      name: 'Khu vực ' + (room.interiorItems.length + 1),
      rx: 10,
      ry: 10 + (room.interiorItems.length * 18) % 70,
      rw: 80,
      rh: 16,
      color: '#fde047',
      desc: 'Khu vực bên trong ' + room.name
    });
    room.hasInterior = true;
    window.NQDMapApp.saveState();
    window.NQDMapApp.refreshAll();
    renderInteriorDesignerContent();
    scheduleAutoCloudPush();
  }

  function updateInteriorItem(idx, prop, val) {
    const sheet = window.NQDMapApp.getActiveSheet();
    const room = sheet.rooms.find(r => r.id === interiorEditingRoomId);
    if (!room || !room.interiorItems[idx]) return;
    room.interiorItems[idx][prop] = val;
    window.NQDMapApp.saveState();
    window.NQDMapApp.refreshAll();
    scheduleAutoCloudPush();
    if (prop !== 'name' && prop !== 'desc') {
      renderInteriorDesignerContent();
    } else {
      const boxes = document.querySelectorAll('#interior-editor-canvas .interior-preview-box');
      if (boxes[idx]) boxes[idx].textContent = room.interiorItems[idx].name;
    }
  }

  function removeInteriorItem(idx) {
    const sheet = window.NQDMapApp.getActiveSheet();
    const room = sheet.rooms.find(r => r.id === interiorEditingRoomId);
    if (!room) return;
    room.interiorItems.splice(idx, 1);
    window.NQDMapApp.saveState();
    window.NQDMapApp.refreshAll();
    renderInteriorDesignerContent();
    scheduleAutoCloudPush();
  }

  // ================= 8. HEADER, FONT, NHÀ TÀI TRỢ & MẬT KHẨU =================
  function updateSheetMeta(prop, val) {
    const sheet = window.NQDMapApp.getActiveSheet();
    sheet[prop] = val;
    window.NQDMapApp.saveState();
    window.NQDMapApp.refreshAll();
    scheduleAutoCloudPush();
  }

  function applyFontPreset(idxStr) {
    if (idxStr === '') return;
    const preset = FONT_PRESETS[Number(idxStr)];
    if (!preset) return;
    const sheet = window.NQDMapApp.getActiveSheet();
    sheet.customFontUrl = preset.url;
    sheet.customFontFamily = preset.family;
    window.NQDMapApp.saveState();
    window.NQDMapApp.refreshAll();
    renderAdminPanel();
    scheduleAutoCloudPush();
  }

  function addCoOrganizer() {
    const sheet = window.NQDMapApp.getActiveSheet();
    if (!Array.isArray(sheet.coOrganizers)) sheet.coOrganizers = [];
    sheet.coOrganizers.push({ name: 'NQD Events', logoText: 'EV', logoUrl: '' });
    window.NQDMapApp.saveState();
    window.NQDMapApp.refreshAll();
    renderAdminPanel();
    scheduleAutoCloudPush();
  }

  function updateCoOrganizer(idx, prop, val) {
    const sheet = window.NQDMapApp.getActiveSheet();
    if (sheet.coOrganizers && sheet.coOrganizers[idx]) {
      sheet.coOrganizers[idx][prop] = val;
      window.NQDMapApp.saveState();
      window.NQDMapApp.refreshAll();
      scheduleAutoCloudPush();
    }
  }

  function uploadCoOrgLogo(event, idx) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    readFileAsCompressedDataUrl(file, (dataUrl) => {
      updateCoOrganizer(idx, 'logoUrl', dataUrl);
      renderAdminPanel();
    });
  }

  function removeCoOrganizer(idx) {
    const sheet = window.NQDMapApp.getActiveSheet();
    sheet.coOrganizers.splice(idx, 1);
    window.NQDMapApp.saveState();
    window.NQDMapApp.refreshAll();
    renderAdminPanel();
    scheduleAutoCloudPush();
  }

  function addEventTag() {
    const label = prompt('Nhập tên Nhãn Bộ lọc sự kiện (kèm icon đầu dòng):', '🎁 Điểm Đổi Quà');
    if (!label) return;
    const sheet = window.NQDMapApp.getActiveSheet();
    if (!Array.isArray(sheet.eventTags)) sheet.eventTags = [];
    sheet.eventTags.push({ id: 'tag_' + Date.now(), label: label.trim() });
    sheet.isEvent = true;
    window.NQDMapApp.saveState();
    window.NQDMapApp.refreshAll();
    renderAdminPanel();
    scheduleAutoCloudPush();
  }

  function updateEventTag(idx, val) {
    const sheet = window.NQDMapApp.getActiveSheet();
    if (sheet.eventTags && sheet.eventTags[idx]) {
      sheet.eventTags[idx].label = val;
      window.NQDMapApp.saveState();
      window.NQDMapApp.refreshAll();
      scheduleAutoCloudPush();
    }
  }

  function removeEventTag(idx) {
    const sheet = window.NQDMapApp.getActiveSheet();
    sheet.eventTags.splice(idx, 1);
    window.NQDMapApp.saveState();
    window.NQDMapApp.refreshAll();
    renderAdminPanel();
    scheduleAutoCloudPush();
  }

  function addSponsorTier() {
    const sheet = window.NQDMapApp.getActiveSheet();
    if (!Array.isArray(sheet.sponsorTiers)) sheet.sponsorTiers = [];
    sheet.sponsorTiers.push({
      tierName: '💎 Nhà Tài Trợ Kim Cương',
      items: [{ name: 'Tên Nhà Tài Trợ', logoUrl: '', linkUrl: '' }]
    });
    sheet.isEvent = true;
    window.NQDMapApp.saveState();
    window.NQDMapApp.refreshAll();
    renderAdminPanel();
    scheduleAutoCloudPush();
  }

  function updateTierName(tIdx, val) {
    const sheet = window.NQDMapApp.getActiveSheet();
    sheet.sponsorTiers[tIdx].tierName = val;
    window.NQDMapApp.saveState();
    scheduleAutoCloudPush();
  }

  function removeSponsorTier(tIdx) {
    const sheet = window.NQDMapApp.getActiveSheet();
    sheet.sponsorTiers.splice(tIdx, 1);
    window.NQDMapApp.saveState();
    window.NQDMapApp.refreshAll();
    renderAdminPanel();
    scheduleAutoCloudPush();
  }

  function addSponsorItem(tIdx) {
    const sheet = window.NQDMapApp.getActiveSheet();
    sheet.sponsorTiers[tIdx].items.push({ name: 'Nhà tài trợ mới', logoUrl: '', linkUrl: '' });
    window.NQDMapApp.saveState();
    renderAdminPanel();
    scheduleAutoCloudPush();
  }

  function updateSponsorItem(tIdx, sIdx, prop, val) {
    const sheet = window.NQDMapApp.getActiveSheet();
    sheet.sponsorTiers[tIdx].items[sIdx][prop] = val;
    window.NQDMapApp.saveState();
    scheduleAutoCloudPush();
  }

  function uploadSponsorLogo(event, tIdx, sIdx) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    readFileAsCompressedDataUrl(file, (dataUrl) => {
      updateSponsorItem(tIdx, sIdx, 'logoUrl', dataUrl);
      renderAdminPanel();
    });
  }

  function removeSponsorItem(tIdx, sIdx) {
    const sheet = window.NQDMapApp.getActiveSheet();
    sheet.sponsorTiers[tIdx].items.splice(sIdx, 1);
    window.NQDMapApp.saveState();
    renderAdminPanel();
    scheduleAutoCloudPush();
  }

  function addFixedEventLine() {
    const fromId = document.getElementById('fl-from').value;
    const toId = document.getElementById('fl-to').value;
    const label = document.getElementById('fl-label').value.trim() || 'Lộ trình chính';
    if (!fromId || !toId || fromId === toId) {
      alert('Vui lòng chọn 2 điểm khác nhau!');
      return;
    }
    const sheet = window.NQDMapApp.getActiveSheet();
    if (!Array.isArray(sheet.fixedLines)) sheet.fixedLines = [];
    sheet.fixedLines.push({ fromId, toId, label, color: '#0284c7' });
    window.NQDMapApp.saveState();
    window.NQDMapApp.refreshAll();
    renderAdminPanel();
    scheduleAutoCloudPush();
  }

  function removeFixedEventLine(idx) {
    const sheet = window.NQDMapApp.getActiveSheet();
    sheet.fixedLines.splice(idx, 1);
    window.NQDMapApp.saveState();
    window.NQDMapApp.refreshAll();
    renderAdminPanel();
    scheduleAutoCloudPush();
  }

  function savePasswords() {
    const fa = document.getElementById('pwd-fa-input').value.trim();
    const al = document.getElementById('pwd-al-input').value.trim();
    if (!fa || !al) {
      alert('Mật khẩu không được để trống!');
      return;
    }
    const state = window.NQDMapApp.getState();
    state.passwords.fullAdmin = fa;
    state.passwords.adminLite = al;
    window.NQDMapApp.saveState();
    scheduleAutoCloudPush();
    alert('✅ Đã cập nhật mật khẩu và đồng bộ lên Cloud thành công!');
  }

  function updateLitePerm(prop, val) {
    const state = window.NQDMapApp.getState();
    state.litePermissions[prop] = val;
    window.NQDMapApp.saveState();
    scheduleAutoCloudPush();
  }

  function exportJSONBackup() {
    const state = window.NQDMapApp.getState();
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'BanDo_NQD_Backup.json';
    a.click();
  }

  function importJSONBackup(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (parsed && Array.isArray(parsed.sheets)) {
          localStorage.setItem('NQD_MAP_MASTER_DATA_V2', JSON.stringify(parsed));
          location.reload();
        }
      } catch (err) {
        alert('File JSON không hợp lệ!');
      }
    };
    reader.readAsText(file);
  }

  function init() {
    injectAdminStyles();
    ensureExcelSheetBar();
    setupMapRoomDragging();

    const state = window.NQDMapApp.getState();
    if (!currentRole && state.activePublicSheetId) {
      state.currentViewingSheetId = state.activePublicSheetId;
      window.NQDMapApp.refreshAll();
    }

    // Tự động tải dữ liệu mới nhất từ Cloud ngay khi mở web & kiểm tra cập nhật mỗi 8 giây cho điện thoại khách
    if (getCleanFirebaseUrl()) {
      pullStateFromCloud(false);
      setInterval(() => {
        pullStateFromCloud(true);
      }, 8000);
    }
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    openLoginPrompt,
    submitPassword,
    logoutAdmin,
    switchTab,
    onRoomSelected,
    toggleOriginLock,
    updateRoomProp,
    toggleRoomTag,
    addNewBooth,
    deleteRoom,
    handleImageFileUpload,
    toggleMapDrag,
    toggleInteriorPublic,
    openInteriorDesigner,
    addInteriorSubItem,
    updateInteriorItem,
    removeInteriorItem,
    updateSheetMeta,
    applyFontPreset,
    addCoOrganizer,
    updateCoOrganizer,
    uploadCoOrgLogo,
    removeCoOrganizer,
    addEventTag,
    updateEventTag,
    removeEventTag,
    addSponsorTier,
    updateTierName,
    removeSponsorTier,
    addSponsorItem,
    updateSponsorItem,
    uploadSponsorLogo,
    removeSponsorItem,
    addFixedEventLine,
    removeFixedEventLine,
    savePasswords,
    updateLitePerm,
    exportJSONBackup,
    importJSONBackup,
    pushStateToCloud,
    pullStateFromCloud,
    saveFirebaseUrlFromInput,
    scheduleAutoCloudPush,
    renderExcelSheetBar,
    renderAdminPanel
  };
})();

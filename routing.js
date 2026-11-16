/**
 * HỆ THỐNG BẢN ĐỒ SỐ THPT CHUYÊN NGUYỄN QUANG DIÊU
 * Chặng 2 (routing.js) - Đã mở lối đi thẳng phía dưới sang Hội trường lớn & Nhà xe HS
 */

window.NQDRoutingEngine = (function () {
  const QR_CHECKPOINTS = [
    { qrId: 'qr_tram_01', roomId: 'landmark_cong_chinh', label: 'Trạm QR 01 — Cổng Chính Trường', zone: 'Trục Trung Tâm' },
    { qrId: 'qr_tram_02', roomId: 'landmark_tuong_cu', label: 'Trạm QR 02 — Tượng Cụ / Sảnh Thông Báo', zone: 'Khu Hành Chính' },
    { qrId: 'qr_tram_03', roomId: 'landmark_cot_co', label: 'Trạm QR 03 — Cột Cờ Giữa Sân', zone: 'Sân Trường' },
    { qrId: 'qr_tram_04', roomId: 'stair_day_trai', label: 'Trạm QR 04 — Ngã 3 Thư Viện & Cầu Thang Trái', zone: 'Dãy Học Trái' },
    { qrId: 'qr_tram_05', roomId: 'sanh_av', label: 'Trạm QR 05 — Sảnh Anh Văn (Giữa Hành Lang Trái)', zone: 'Dãy Học Trái' },
    { qrId: 'qr_tram_06', roomId: 'wc_1_1', label: 'Trạm QR 06 — Đầu Hành Lang Trái (Cạnh WC 1.1)', zone: 'Dãy Giữa' },
    { qrId: 'qr_tram_07', roomId: 'sanh_chao_co', label: 'Trạm QR 07 — Sảnh Chào Cờ & Cầu Thang Giữa', zone: 'Dãy Giữa' },
    { qrId: 'qr_tram_08', roomId: 'phong_y_te', label: 'Trạm QR 08 — Ngã 4 Phòng Y Tế & WC 1.2', zone: 'Dãy Giữa' },
    { qrId: 'qr_tram_09', roomId: 'can_tin', label: 'Trạm QR 09 — Lối Xuống Căn Tin & KTX Lớn', zone: 'Ngoại Vi Phải' },
    { qrId: 'qr_tram_10', roomId: 'stair_day_phai', label: 'Trạm QR 10 — Cầu Thang Dãy Phải & Hội Trường Lớn', zone: 'Dãy Thực Hành Phải' },
    { qrId: 'qr_tram_11', roomId: 'p_10t1', label: 'Trạm QR 11 — Hành Lang Khu KTX Bắc (10T1)', zone: 'Khu Bắc' },
    { qrId: 'qr_tram_12', roomId: 'vuon_rau', label: 'Trạm QR 12 — Khu Vườn Rau & Sân Bóng Đá', zone: 'Ngoại Vi Bắc' }
  ];

  let routeState = {
    startId: null,
    endId: null,
    pendingEndId: null
  };

  function injectRoutingStyles() {
    if (document.getElementById('nqd-routing-styles')) return;
    const style = document.createElement('style');
    style.id = 'nqd-routing-styles';
    style.textContent = `
      .routing-top-bar-btns {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
      }
      .rt-top-btn {
        font-family: var(--app-font);
        font-size: 13px;
        font-weight: bold;
        padding: 7px 11px;
        border-radius: 8px;
        border: 1.5px solid #38bdf8;
        background: #0284c7;
        color: #ffffff;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        white-space: nowrap;
        transition: all 0.18s ease;
      }
      .rt-top-btn:hover { background: #0369a1; }
      .rt-top-btn.qr-btn {
        background: #f59e0b;
        border-color: #fde68a;
        color: #0f172a;
      }
      .rt-top-btn.qr-btn:hover {
        background: #d97706;
        color: #ffffff;
      }
      #active-route-banner {
        position: absolute;
        top: 10px;
        left: 12px;
        right: 12px;
        max-width: 620px;
        margin: 0 auto;
        background: rgba(15, 23, 42, 0.95);
        color: #ffffff;
        border: 2px solid #38bdf8;
        border-radius: 12px;
        padding: 8px 12px;
        z-index: 37;
        display: none;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
      }
      .route-banner-info {
        display: flex;
        flex-direction: column;
        gap: 3px;
        min-width: 0;
        flex: 1;
      }
      .route-endpoints-text {
        font-size: 14px;
        font-weight: bold;
        color: #f8fafc;
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }
      .route-steps-sub {
        font-size: 12px;
        color: #bae6fd;
      }
      .route-clear-btn {
        font-family: var(--app-font);
        font-size: 12px;
        font-weight: bold;
        padding: 6px 10px;
        border-radius: 8px;
        border: none;
        background: #dc2626;
        color: #ffffff;
        cursor: pointer;
        flex-shrink: 0;
      }
      @keyframes nqdDashFlow {
        to { stroke-dashoffset: -44; }
      }
      .route-line-casing {
        fill: none;
        stroke: #0f172a;
        stroke-width: 11;
        stroke-linecap: round;
        stroke-linejoin: round;
        opacity: 0.85;
      }
      .route-line-main {
        fill: none;
        stroke: #ff1744;
        stroke-width: 6.5;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-dasharray: 14 8;
        animation: nqdDashFlow 0.9s linear infinite;
      }
      .fixed-event-line-casing {
        fill: none;
        stroke: #ffffff;
        stroke-width: 8;
        stroke-linecap: round;
        stroke-linejoin: round;
        opacity: 0.9;
      }
      .fixed-event-line-main {
        fill: none;
        stroke-width: 4.5;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-dasharray: 10 6;
        animation: nqdDashFlow 1.3s linear infinite;
      }
      .rt-modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.68);
        z-index: 110;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 14px;
      }
      .rt-modal-box {
        width: 100%;
        max-width: 520px;
        max-height: 86vh;
        background: #ffffff;
        border-radius: 14px;
        border: 2px solid #0f172a;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .rt-modal-body {
        padding: 14px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .quick-start-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(145px, 1fr));
        gap: 8px;
      }
      .quick-start-btn {
        font-family: var(--app-font);
        font-size: 13px;
        font-weight: bold;
        padding: 9px 10px;
        border-radius: 8px;
        border: 1.5px solid #cbd5e1;
        background: #f8fafc;
        color: #0f172a;
        cursor: pointer;
        text-align: left;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.15s ease;
      }
      .quick-start-btn:hover {
        border-color: #0284c7;
        background: #e0f2fe;
      }
      .qr-station-card {
        border: 1px solid #cbd5e1;
        border-radius: 10px;
        padding: 10px 12px;
        background: #f8fafc;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .qr-station-meta {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .qr-station-title {
        font-size: 14px;
        font-weight: bold;
        color: #0f172a;
      }
      .qr-station-sub {
        font-size: 12px;
        color: #475569;
      }
      .qr-station-actions {
        display: flex;
        gap: 6px;
        flex-shrink: 0;
      }
      .qr-mini-btn {
        font-family: var(--app-font);
        font-size: 12px;
        font-weight: bold;
        padding: 5px 9px;
        border-radius: 6px;
        border: 1px solid #0f172a;
        cursor: pointer;
      }
      @media (max-width: 640px) {
        .rt-top-btn span.hide-sm { display: none; }
        #active-route-banner { top: 6px; padding: 6px 10px; }
        .route-endpoints-text { font-size: 12.5px; }
      }
    `;
    document.head.appendChild(style);
  }

  // MẠNG LƯỚI ĐƯỜNG ĐI (Đã mở lối đi thẳng phía dưới Cầu thang phải sang Hội trường lớn & lối trái sang Nhà xe HS)
  const WALKWAY_NODES = {
    n_gate:          { x: 785, y: 1465 },
    n_statue:        { x: 785, y: 1405 },
    n_south_W:       { x: 320, y: 1405 },
    n_sw_outer:      { x: 165, y: 1405 },
    n_nhaxe_hs_bot:  { x: 165, y: 780 },
    n_south_E:       { x: 1112, y: 1405 },
    n_nhaxe_gv:      { x: 1320, y: 1405 },
    // Lối đi thẳng phía dưới Cầu thang dãy phải sang thẳng Hội trường lớn (theo vạch đen của bạn)
    n_se_outer:      { x: 1360, y: 1405 },
    n_ht_lon_south:  { x: 1360, y: 1250 },
    n_ht_lon_door:   { x: 1360, y: 1010 },

    n_cor_SW:        { x: 410, y: 1210 },
    n_cor_S_mid1:    { x: 600, y: 1210 },
    n_cor_S_center:  { x: 785, y: 1210 },
    n_cor_S_mid2:    { x: 960, y: 1210 },
    n_cor_SE:        { x: 1112, y: 1210 },

    n_cor_W_stair:   { x: 410, y: 1170 },
    n_cor_W_bot:     { x: 410, y: 1050 },
    n_cor_W_mid:     { x: 410, y: 890 },
    n_cor_W_top:     { x: 410, y: 720 },
    n_cor_NW:        { x: 410, y: 582 },
    n_wc_left:       { x: 410, y: 485 },
    n_outer_NW:      { x: 410, y: 355 },
    n_nhaxe_hs:      { x: 165, y: 355 },
    n_san_bong:      { x: 410, y: 100 },

    n_cor_N_stairL:  { x: 570, y: 582 },
    n_cor_N_center:  { x: 758, y: 582 },
    n_cor_N_stairR:  { x: 866, y: 582 },
    n_cor_N_med:     { x: 1040, y: 582 },
    n_cor_NE:        { x: 1112, y: 582 },

    n_flagpole:      { x: 758, y: 890 },

    n_cor_E_stair:   { x: 1112, y: 1250 },
    n_cor_E_bot:     { x: 1112, y: 1115 },
    n_cor_E_mid:     { x: 1112, y: 950 },
    n_cor_E_top:     { x: 1112, y: 810 },
    n_cor_E_cantin:  { x: 1112, y: 690 },
    n_wc_right:      { x: 1112, y: 485 },
    n_cor_E_north:   { x: 1112, y: 295 },
    n_cor_E_topend:  { x: 1112, y: 175 },

    n_cantin_hub:    { x: 1360, y: 690 },
    n_cantin_door:   { x: 1360, y: 520 },
    n_ktx_lon:       { x: 1500, y: 690 },
    n_ntd_door:      { x: 1230, y: 175 },

    n_north_hub:     { x: 795, y: 295 },
    n_north_stair:   { x: 1023, y: 295 }
  };

  const WALKWAY_EDGES = [
    ['n_gate', 'n_statue'],
    ['n_statue', 'n_south_W'],
    ['n_south_W', 'n_sw_outer'],
    ['n_sw_outer', 'n_nhaxe_hs_bot'],
    ['n_nhaxe_hs_bot', 'n_nhaxe_hs'],

    ['n_statue', 'n_south_E'],
    ['n_south_E', 'n_nhaxe_gv'],
    // Nhánh đi thẳng từ Tượng Cụ / Cổng sang Hội trường lớn theo đường bên dưới
    ['n_south_E', 'n_se_outer'],
    ['n_nhaxe_gv', 'n_se_outer'],
    ['n_se_outer', 'n_ht_lon_south'],
    ['n_cor_E_stair', 'n_ht_lon_south'],
    ['n_ht_lon_south', 'n_ht_lon_door'],

    ['n_statue', 'n_cor_S_center'],
    ['n_south_E', 'n_cor_SE'],
    ['n_cor_SE', 'n_cor_E_stair'],

    ['n_cor_SW', 'n_cor_S_mid1'],
    ['n_cor_S_mid1', 'n_cor_S_center'],
    ['n_cor_S_center', 'n_cor_S_mid2'],
    ['n_cor_S_mid2', 'n_cor_SE'],

    ['n_cor_SW', 'n_cor_W_stair'],
    ['n_cor_W_stair', 'n_cor_W_bot'],
    ['n_cor_W_bot', 'n_cor_W_mid'],
    ['n_cor_W_mid', 'n_cor_W_top'],
    ['n_cor_W_top', 'n_cor_NW'],
    ['n_cor_NW', 'n_wc_left'],
    ['n_wc_left', 'n_outer_NW'],
    ['n_outer_NW', 'n_nhaxe_hs'],
    ['n_outer_NW', 'n_san_bong'],

    ['n_cor_NW', 'n_cor_N_stairL'],
    ['n_cor_N_stairL', 'n_cor_N_center'],
    ['n_cor_N_center', 'n_cor_N_stairR'],
    ['n_cor_N_stairR', 'n_cor_N_med'],
    ['n_cor_N_med', 'n_cor_NE'],

    ['n_cor_S_center', 'n_flagpole'],
    ['n_flagpole', 'n_cor_N_center'],
    ['n_cor_W_mid', 'n_flagpole'],
    ['n_flagpole', 'n_cor_E_mid'],

    ['n_cor_SE', 'n_cor_E_bot'],
    ['n_cor_E_bot', 'n_cor_E_mid'],
    ['n_cor_E_mid', 'n_cor_E_top'],
    ['n_cor_E_top', 'n_cor_E_cantin'],
    ['n_cor_E_cantin', 'n_cor_NE'],
    ['n_cor_NE', 'n_wc_right'],
    ['n_wc_right', 'n_cor_E_north'],
    ['n_cor_E_north', 'n_cor_E_topend'],

    ['n_cor_E_cantin', 'n_cantin_hub'],
    ['n_cantin_hub', 'n_cantin_door'],
    ['n_cantin_hub', 'n_ktx_lon'],
    ['n_cantin_hub', 'n_ht_lon_door'],
    ['n_cor_E_topend', 'n_ntd_door'],

    ['n_cor_N_center', 'n_north_hub'],
    ['n_north_hub', 'n_north_stair'],
    ['n_north_stair', 'n_cor_E_north']
  ];

  function buildAdjacency() {
    const adj = {};
    Object.keys(WALKWAY_NODES).forEach(k => { adj[k] = []; });
    WALKWAY_EDGES.forEach(([a, b]) => {
      const na = WALKWAY_NODES[a];
      const nb = WALKWAY_NODES[b];
      if (!na || !nb) return;
      const d = Math.hypot(na.x - nb.x, na.y - nb.y);
      adj[a].push({ to: b, cost: d });
      adj[b].push({ to: a, cost: d });
    });
    return adj;
  }

  const ADJ_GRAPH = buildAdjacency();

  function getBestWalkwayNodeForRoom(room) {
    const cx = room.x + room.w / 2;
    const cy = room.y + room.h / 2;

    if (room.id === 'landmark_cong_chinh') return 'n_gate';
    if (room.id === 'landmark_tuong_cu' || room.id === 'sanh_thong_bao') return 'n_statue';
    if (room.id === 'landmark_cot_co') return 'n_flagpole';
    if (room.id === 'nha_xe_gv') return 'n_nhaxe_gv';
    if (room.id === 'nha_xe_hs') return 'n_nhaxe_hs_bot';
    if (room.id === 'san_bong_da' || room.id === 'vuon_rau') return 'n_outer_NW';
    if (room.id === 'can_tin') return 'n_cantin_door';
    if (room.id === 'ktx_lon_moi') return 'n_ktx_lon';
    if (room.id === 'hoi_truong_lon') return 'n_ht_lon_door';
    if (room.id === 'nha_thi_dau') return 'n_ntd_door';
    if (room.id === 'stair_day_trai') return 'n_cor_W_stair';
    if (room.id === 'stair_day_phai') return 'n_cor_E_stair';
    if (room.id === 'stair_giua_trai') return 'n_cor_N_stairL';
    if (room.id === 'stair_giua_phai') return 'n_cor_N_stairR';
    if (room.id === 'stair_bac') return 'n_north_stair';

    // Các phòng học dãy phải (Phòng máy, BM, STEAM, PTN) luôn bắt vào hành lang trong (x = 1112)
    if (cx >= 1130 && cx <= 1345 && cy >= 740 && cy <= 1280) {
      if (cy < 860) return 'n_cor_E_top';
      if (cy < 1030) return 'n_cor_E_mid';
      return 'n_cor_E_bot';
    }

    // Các phòng học dãy trái luôn bắt vào hành lang trái (x = 410)
    if (cx >= 200 && cx <= 395 && cy >= 650 && cy <= 1160) {
      if (cy < 800) return 'n_cor_W_top';
      if (cy < 980) return 'n_cor_W_mid';
      return 'n_cor_W_bot';
    }

    let bestKey = 'n_flagpole';
    let bestDist = Infinity;
    for (const [k, pt] of Object.entries(WALKWAY_NODES)) {
      const dist = Math.hypot(cx - pt.x, cy - pt.y);
      if (dist < bestDist) {
        bestDist = dist;
        bestKey = k;
      }
    }
    return bestKey;
  }

  function getStairIdForRoom(room) {
    const cx = room.x + room.w / 2;
    const cy = room.y + room.h / 2;
    if (cy < 300) return 'stair_bac';
    if (cx < 400 && cy >= 650) return 'stair_day_trai';
    if (cx > 1120 && cy >= 740) return 'stair_day_phai';
    if (cx <= 760) return 'stair_giua_trai';
    return 'stair_giua_phai';
  }

  function shortestWalkwayPath(startNodeKey, endNodeKey) {
    if (startNodeKey === endNodeKey) {
      return [WALKWAY_NODES[startNodeKey]];
    }
    const dist = {};
    const prev = {};
    const visited = new Set();
    Object.keys(WALKWAY_NODES).forEach(k => { dist[k] = Infinity; });
    dist[startNodeKey] = 0;

    while (true) {
      let u = null;
      let best = Infinity;
      for (const k of Object.keys(WALKWAY_NODES)) {
        if (!visited.has(k) && dist[k] < best) {
          best = dist[k];
          u = k;
        }
      }
      if (!u || u === endNodeKey) break;
      visited.add(u);

      for (const edge of ADJ_GRAPH[u]) {
        if (visited.has(edge.to)) continue;
        const alt = dist[u] + edge.cost;
        if (alt < dist[edge.to]) {
          dist[edge.to] = alt;
          prev[edge.to] = u;
        }
      }
    }

    const pathKeys = [];
    let cur = endNodeKey;
    while (cur) {
      pathKeys.unshift(cur);
      if (cur === startNodeKey) break;
      cur = prev[cur];
    }

    return pathKeys.map(k => WALKWAY_NODES[k]);
  }

  function getEntityCoordinates(entityId) {
    const raw = window.NQDMapApp.findRoomById(entityId);
    if (!raw) return null;

    if (raw.parentRoomId) {
      const parent = window.NQDMapApp.findRoomById(raw.parentRoomId);
      if (!parent) return null;

      if (!parent.interiorPublic) {
        return {
          blockedHiddenInterior: true,
          parentRoom: parent,
          item: raw
        };
      }

      const itemX = parent.x + ((raw.rx + raw.rw / 2) / 100) * parent.w;
      const itemY = parent.y + ((raw.ry + raw.rh / 2) / 100) * parent.h;
      return {
        id: raw.id,
        name: `${raw.name} (${parent.name})`,
        x: itemX,
        y: itemY,
        floor: parent.floor || 'tret',
        roomRef: parent,
        isInteriorItem: true
      };
    }

    return {
      id: raw.id,
      name: raw.name,
      x: raw.x + raw.w / 2,
      y: raw.y + raw.h / 2,
      floor: raw.floor || 'tret',
      roomRef: raw,
      isInteriorItem: false
    };
  }

  function connectPointToCorridorNode(pt, nodePt) {
    const mid = { x: nodePt.x, y: pt.y };
    if (Math.abs(pt.x - nodePt.x) < 8 || Math.abs(pt.y - nodePt.y) < 8) {
      return [pt, nodePt];
    }
    return [pt, mid, nodePt];
  }

  function computeFullRoute(startId, endId) {
    const startInfo = getEntityCoordinates(startId);
    const endInfo = getEntityCoordinates(endId);
    if (!startInfo || !endInfo) return null;

    if (startInfo.blockedHiddenInterior || endInfo.blockedHiddenInterior) {
      return {
        errorHiddenInterior: true,
        message: 'Bố cục nội thất của khu vực này đang ở trạng thái ẨN. Chỉ khi Ban Tổ Chức bật Public nội thất thì Line chỉ đường mới dẫn vào bên trong!'
      };
    }

    const startFloor = startInfo.floor === 'all' ? 'tret' : startInfo.floor;
    const endFloor = endInfo.floor === 'all' ? 'tret' : endInfo.floor;

    const stairCallouts = [];
    const highlightedRoomIds = [startInfo.roomRef.id, endInfo.roomRef.id];
    const polylinePoints = [];

    const floorLabels = { tret: 'Tầng Trệt', lau1: 'Lầu 1', lau2: 'Lầu 2' };
    const startStairId = getStairIdForRoom(startInfo.roomRef);
    const endStairId = getStairIdForRoom(endInfo.roomRef);

    if (startFloor === endFloor && (startFloor === 'tret' || startStairId === endStairId)) {
      const nA = getBestWalkwayNodeForRoom(startInfo.roomRef);
      const nB = getBestWalkwayNodeForRoom(endInfo.roomRef);
      const corridorPts = shortestWalkwayPath(nA, nB);

      polylinePoints.push(...connectPointToCorridorNode({ x: startInfo.x, y: startInfo.y }, corridorPts[0]));
      polylinePoints.push(...corridorPts.slice(1));
      const lastCor = corridorPts[corridorPts.length - 1];
      polylinePoints.push({ x: lastCor.x, y: endInfo.y }, { x: endInfo.x, y: endInfo.y });
    } else if (startFloor === 'tret' && endFloor !== 'tret') {
      const stairRoom = window.NQDMapApp.findRoomById(endStairId);
      highlightedRoomIds.push(endStairId);

      const nA = getBestWalkwayNodeForRoom(startInfo.roomRef);
      const nStair = getBestWalkwayNodeForRoom(stairRoom);
      const corridorPts = shortestWalkwayPath(nA, nStair);
      const stairCenter = { x: stairRoom.x + stairRoom.w / 2, y: stairRoom.y + stairRoom.h / 2 };

      polylinePoints.push(...connectPointToCorridorNode({ x: startInfo.x, y: startInfo.y }, corridorPts[0]));
      polylinePoints.push(...corridorPts.slice(1));
      polylinePoints.push(stairCenter);
      polylinePoints.push({ x: stairCenter.x, y: endInfo.y }, { x: endInfo.x, y: endInfo.y });

      stairCallouts.push({
        x: stairCenter.x,
        y: stairCenter.y - 18,
        text: `⬆️ Lên ${floorLabels[endFloor]}`,
        stairName: stairRoom.name
      });
    } else if (startFloor !== 'tret' && endFloor === 'tret') {
      const stairRoom = window.NQDMapApp.findRoomById(startStairId);
      highlightedRoomIds.push(startStairId);

      const stairCenter = { x: stairRoom.x + stairRoom.w / 2, y: stairRoom.y + stairRoom.h / 2 };
      const nStair = getBestWalkwayNodeForRoom(stairRoom);
      const nB = getBestWalkwayNodeForRoom(endInfo.roomRef);
      const corridorPts = shortestWalkwayPath(nStair, nB);

      polylinePoints.push({ x: startInfo.x, y: startInfo.y }, { x: stairCenter.x, y: startInfo.y }, stairCenter);
      polylinePoints.push(...corridorPts);
      const lastCor = corridorPts[corridorPts.length - 1];
      polylinePoints.push({ x: lastCor.x, y: endInfo.y }, { x: endInfo.x, y: endInfo.y });

      stairCallouts.push({
        x: stairCenter.x,
        y: stairCenter.y - 18,
        text: '⬇️ Xuống Tầng Trệt',
        stairName: stairRoom.name
      });
    } else {
      const stairA = window.NQDMapApp.findRoomById(startStairId);
      const stairB = window.NQDMapApp.findRoomById(endStairId);
      highlightedRoomIds.push(startStairId, endStairId);

      const centerA = { x: stairA.x + stairA.w / 2, y: stairA.y + stairA.h / 2 };
      const centerB = { x: stairB.x + stairB.w / 2, y: stairB.y + stairB.h / 2 };

      if (startStairId === endStairId) {
        polylinePoints.push(
          { x: startInfo.x, y: startInfo.y },
          { x: centerA.x, y: startInfo.y },
          centerA,
          { x: centerA.x, y: endInfo.y },
          { x: endInfo.x, y: endInfo.y }
        );
        const dirIcon = endFloor === 'lau2' ? '⬆️ Lên' : '⬇️ Xuống';
        stairCallouts.push({
          x: centerA.x,
          y: centerA.y - 18,
          text: `${dirIcon} ${floorLabels[endFloor]}`,
          stairName: stairA.name
        });
      } else {
        const nStairA = getBestWalkwayNodeForRoom(stairA);
        const nStairB = getBestWalkwayNodeForRoom(stairB);
        const corridorPts = shortestWalkwayPath(nStairA, nStairB);

        polylinePoints.push({ x: startInfo.x, y: startInfo.y }, { x: centerA.x, y: startInfo.y }, centerA);
        polylinePoints.push(...corridorPts);
        polylinePoints.push(centerB, { x: centerB.x, y: endInfo.y }, { x: endInfo.x, y: endInfo.y });

        stairCallouts.push({
          x: centerA.x,
          y: centerA.y - 18,
          text: '⬇️ Xuống Trệt',
          stairName: stairA.name
        });
        stairCallouts.push({
          x: centerB.x,
          y: centerB.y - 18,
          text: `⬆️ Lên ${floorLabels[endFloor]}`,
          stairName: stairB.name
        });
      }
    }

    return {
      startInfo,
      endInfo,
      points: simplifyPolyline(polylinePoints),
      stairCallouts,
      highlightedRoomIds
    };
  }

  function simplifyPolyline(pts) {
    if (!pts || pts.length === 0) return [];
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const prev = out[out.length - 1];
      if (Math.hypot(pts[i].x - prev.x, pts[i].y - prev.y) > 3) {
        out.push(pts[i]);
      }
    }
    return out;
  }

  function redraw() {
    const svg = document.getElementById('routing-layer');
    if (!svg) return;
    svg.innerHTML = '';

    document.querySelectorAll('.map-room, .interior-item').forEach(el => {
      el.classList.remove('route-highlight');
    });

    const sheet = window.NQDMapApp.getActiveSheet();
    if (sheet && Array.isArray(sheet.fixedLines)) {
      sheet.fixedLines.forEach(fl => {
        const res = computeFullRoute(fl.fromId, fl.toId);
        if (res && res.points && res.points.length > 1) {
          drawSvgRoutePath(svg, res.points, {
            isFixedEventLine: true,
            color: fl.color || '#0284c7',
            label: fl.label || 'Lộ trình sự kiện'
          });
        }
      });
    }

    if (!routeState.startId || !routeState.endId) {
      updateRouteBanner(null);
      return;
    }

    const routeResult = computeFullRoute(routeState.startId, routeState.endId);
    if (!routeResult) {
      updateRouteBanner(null);
      return;
    }

    if (routeResult.errorHiddenInterior) {
      alert(routeResult.message);
      routeState.endId = null;
      updateRouteBanner(null);
      return;
    }

    routeResult.highlightedRoomIds.forEach(rid => {
      const el = document.getElementById('room-el-' + rid);
      if (el) el.classList.add('route-highlight');
    });

    drawSvgRoutePath(svg, routeResult.points, {
      isFixedEventLine: false,
      startInfo: routeResult.startInfo,
      endInfo: routeResult.endInfo,
      stairCallouts: routeResult.stairCallouts
    });

    updateRouteBanner(routeResult);
  }

  function drawSvgRoutePath(svg, points, opts) {
    const ptString = points.map(p => `${Math.round(p.x)},${Math.round(p.y)}`).join(' ');

    if (opts.isFixedEventLine) {
      const casing = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      casing.setAttribute('points', ptString);
      casing.setAttribute('class', 'fixed-event-line-casing');
      svg.appendChild(casing);

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      line.setAttribute('points', ptString);
      line.setAttribute('class', 'fixed-event-line-main');
      line.setAttribute('stroke', opts.color || '#0284c7');
      svg.appendChild(line);

      if (opts.label) {
        const midIdx = Math.floor(points.length / 2);
        drawSvgCalloutBadge(svg, points[midIdx].x, points[midIdx].y - 14, `⭐ ${opts.label}`, '#0284c7', '#ffffff');
      }
      return;
    }

    const casing = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    casing.setAttribute('points', ptString);
    casing.setAttribute('class', 'route-line-casing');
    svg.appendChild(casing);

    const mainLine = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    mainLine.setAttribute('points', ptString);
    mainLine.setAttribute('class', 'route-line-main');
    svg.appendChild(mainLine);

    (opts.stairCallouts || []).forEach(sc => {
      drawSvgCalloutBadge(svg, sc.x, sc.y, sc.text, '#f59e0b', '#0f172a');
    });

    const firstPt = points[0];
    const lastPt = points[points.length - 1];
    drawSvgPinMarker(svg, firstPt.x, firstPt.y, 'A', '#10b981', opts.startInfo.name);
    drawSvgPinMarker(svg, lastPt.x, lastPt.y, 'B', '#ef4444', opts.endInfo.name);
  }

  function drawSvgPinMarker(svg, x, y, letter, bgColor, nameText) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.innerHTML = `
      <circle cx="${x}" cy="${y}" r="16" fill="${bgColor}" stroke="#ffffff" stroke-width="3" />
      <text x="${x}" y="${y + 5}" text-anchor="middle" fill="#ffffff" font-size="15" font-weight="bold" font-family="sans-serif">${letter}</text>
    `;
    svg.appendChild(g);
    drawSvgCalloutBadge(svg, x, y - 28, `${letter}: ${nameText}`, '#0f172a', '#ffffff');
  }

  function drawSvgCalloutBadge(svg, x, y, text, bgColor, textColor) {
    const width = Math.max(92, text.length * 8 + 20);
    const height = 26;
    const rx = x - width / 2;
    const ry = y - height / 2;

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.innerHTML = `
      <rect x="${rx}" y="${ry}" width="${width}" height="${height}" rx="7" fill="${bgColor}" stroke="#ffffff" stroke-width="2" />
      <text x="${x}" y="${y + 5}" text-anchor="middle" fill="${textColor}" font-size="13" font-weight="bold" font-family="sans-serif">${text}</text>
    `;
    svg.appendChild(g);
  }

  function updateRouteBanner(routeResult) {
    const banner = document.getElementById('active-route-banner');
    if (!banner) return;

    if (!routeResult) {
      banner.style.display = 'none';
      return;
    }

    const stairNote = routeResult.stairCallouts && routeResult.stairCallouts.length > 0
      ? routeResult.stairCallouts.map(s => `${s.stairName} (${s.text})`).join(' ➔ ')
      : 'Đi dọc theo hành lang / sân trường cùng tầng';

    document.getElementById('route-banner-endpoints').innerHTML = `
      <span style="color:#34d399;">[A] ${routeResult.startInfo.name}</span>
      <span>➔</span>
      <span style="color:#f87171;">[B] ${routeResult.endInfo.name}</span>
    `;
    document.getElementById('route-banner-sub').textContent = `🧭 Lộ trình: ${stairNote}`;
    banner.style.display = 'flex';
  }

  function setPointFromApp(role, roomId) {
    if (!roomId) return;

    if (role === 'start') {
      routeState.startId = roomId;
      if (!routeState.endId) {
        const r = window.NQDMapApp.findRoomById(roomId);
        showToastBanner(`📍 Đã đặt Điểm đi (A): ${r ? r.name : ''}. Giờ hãy chạm vào phòng muốn tới và bấm [🚩 Điểm đến (B)]!`);
      } else {
        redraw();
      }
      return;
    }

    if (role === 'end') {
      if (!routeState.startId) {
        routeState.pendingEndId = roomId;
        openWhereAmIModal(roomId);
        return;
      }
      routeState.endId = roomId;
      redraw();
    }
  }

  function showToastBanner(msg) {
    const banner = document.getElementById('active-route-banner');
    if (!banner) return;
    document.getElementById('route-banner-endpoints').innerHTML = `<span>${msg}</span>`;
    document.getElementById('route-banner-sub').textContent = 'Bạn có thể đổi Điểm đi (A) bất kỳ lúc nào bằng cách chạm vào phòng hoặc quét QR 20m.';
    banner.style.display = 'flex';
  }

  function clearRoute() {
    routeState.startId = null;
    routeState.endId = null;
    routeState.pendingEndId = null;
    redraw();
  }

  function openWhereAmIModal(targetRoomId) {
    const targetRoom = targetRoomId ? window.NQDMapApp.findRoomById(targetRoomId) : null;
    const modal = document.getElementById('where-am-i-backdrop');
    const titleEl = document.getElementById('where-am-i-target-label');

    if (targetRoom) {
      titleEl.innerHTML = `Bạn muốn đi tới <strong style="color:#ef4444;">${targetRoom.name}</strong>.<br/>Hãy chọn vị trí hiện tại của bạn (Điểm A):`;
    } else {
      titleEl.innerHTML = 'Hãy xác định vị trí hiện tại của bạn (Điểm đi A) bằng 1 chạm hoặc Trạm QR 20m gần nhất:';
    }

    populateRoomSelectDropdown();
    modal.style.display = 'flex';
  }

  function closeWhereAmIModal() {
    document.getElementById('where-am-i-backdrop').style.display = 'none';
  }

  function confirmStartPointFromModal(startRoomId) {
    routeState.startId = startRoomId;
    if (routeState.pendingEndId) {
      routeState.endId = routeState.pendingEndId;
      routeState.pendingEndId = null;
    }
    closeWhereAmIModal();
    window.NQDMapApp.focusOnRoom(startRoomId);
    window.NQDMapApp.selectRoomOnMap(startRoomId);

    if (routeState.endId) {
      redraw();
    } else {
      const r = window.NQDMapApp.findRoomById(startRoomId);
      showToastBanner(`📍 Đã định vị bạn tại: ${r ? r.name : ''}. Giờ hãy chọn phòng cần tới và bấm [🚩 Điểm đến (B)]!`);
    }
  }

  function checkUrlForQRLocation() {
    const params = new URLSearchParams(window.location.search);
    let fromParam = params.get('from');

    if (!fromParam && window.location.hash.includes('from=')) {
      const hashParams = new URLSearchParams(window.location.hash.replace('#', '?'));
      fromParam = hashParams.get('from');
    }

    if (!fromParam) return;

    const station = QR_CHECKPOINTS.find(s => s.qrId === fromParam || s.roomId === fromParam);
    const resolvedRoomId = station ? station.roomId : fromParam;
    const room = window.NQDMapApp.findRoomById(resolvedRoomId);

    if (room) {
      routeState.startId = resolvedRoomId;
      setTimeout(() => {
        window.NQDMapApp.focusOnRoom(resolvedRoomId);
        window.NQDMapApp.selectRoomOnMap(resolvedRoomId);
        const label = station ? station.label : room.name;
        showToastBanner(`📷 Quét QR thành công! Bạn đang ở [A]: ${label}. Hãy chọn nơi muốn đến (Điểm B)!`);
      }, 220);
    }
  }

  function getQRLinkForStation(qrOrRoomId) {
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?from=${encodeURIComponent(qrOrRoomId)}`;
  }

  function openQRManagerModal() {
    const listContainer = document.getElementById('qr-stations-list');
    listContainer.innerHTML = '';

    QR_CHECKPOINTS.forEach(st => {
      const fullUrl = getQRLinkForStation(st.qrId);
      const qrImgApi = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(fullUrl)}`;

      const card = document.createElement('div');
      card.className = 'qr-station-card';
      card.innerHTML = `
        <div class="qr-station-meta">
          <div class="qr-station-title">📍 ${st.label}</div>
          <div class="qr-station-sub">Khu vực: ${st.zone} | Mã định vị: <code>?from=${st.qrId}</code></div>
        </div>
        <div class="qr-station-actions">
          <button class="qr-mini-btn" style="background:#10b981;color:#fff;border-color:#059669;" onclick="NQDRoutingEngine.simulateQRScan('${st.qrId}')">
            📲 Giả lập quét
          </button>
          <a class="qr-mini-btn" style="background:#f59e0b;color:#0f172a;text-decoration:none;" href="${qrImgApi}" target="_blank" rel="noopener">
            🖨️ Xem ảnh QR
          </a>
        </div>
      `;
      listContainer.appendChild(card);
    });

    document.getElementById('qr-manager-backdrop').style.display = 'flex';
  }

  function closeQRManagerModal() {
    document.getElementById('qr-manager-backdrop').style.display = 'none';
  }

  function simulateQRScan(qrId) {
    const station = QR_CHECKPOINTS.find(s => s.qrId === qrId);
    if (!station) return;
    closeQRManagerModal();
    confirmStartPointFromModal(station.roomId);
  }

  function injectRoutingUI() {
    const slot = document.getElementById('routing-header-slot');
    if (slot) {
      slot.className = 'routing-top-bar-btns';
      slot.innerHTML = `
        <button class="rt-top-btn" onclick="NQDRoutingEngine.openWhereAmIModal(null)" title="Chọn vị trí đang đứng để tìm đường">
          📍 <span class="hide-sm">Tôi đang ở đâu?</span>
        </button>
        <button class="rt-top-btn qr-btn" onclick="NQDRoutingEngine.openQRManagerModal()" title="Hệ thống Trạm QR Định vị 20m">
          📷 <span class="hide-sm">Trạm QR 20m</span>
        </button>
      `;
    }

    const vp = document.getElementById('map-viewport');
    if (vp && !document.getElementById('active-route-banner')) {
      const banner = document.createElement('div');
      banner.id = 'active-route-banner';
      banner.innerHTML = `
        <div class="route-banner-info">
          <div class="route-endpoints-text" id="route-banner-endpoints"></div>
          <div class="route-steps-sub" id="route-banner-sub"></div>
        </div>
        <button class="route-clear-btn" onclick="NQDRoutingEngine.clearRoute()">✖ Tắt chỉ đường</button>
      `;
      vp.appendChild(banner);
    }

    if (!document.getElementById('where-am-i-backdrop')) {
      const modal = document.createElement('div');
      modal.id = 'where-am-i-backdrop';
      modal.className = 'rt-modal-backdrop';
      modal.onclick = closeWhereAmIModal;

      const quickButtonsHtml = QR_CHECKPOINTS.map(st => `
        <button class="quick-start-btn" onclick="NQDRoutingEngine.confirmStartPointFromModal('${st.roomId}')">
          📍 ${st.label.replace('Trạm QR ', '')}
        </button>
      `).join('');

      modal.innerHTML = `
        <div class="rt-modal-box" onclick="event.stopPropagation()">
          <div class="modal-header">
            <span>🧭 Xác định Điểm xuất phát (Điểm A)</span>
            <button class="modal-close-btn" onclick="NQDRoutingEngine.closeWhereAmIModal()">✖</button>
          </div>
          <div class="rt-modal-body">
            <div id="where-am-i-target-label" style="font-size:14px;line-height:1.4;"></div>
            <div style="font-size:13px;font-weight:bold;color:#0284c7;">
              Cách 1: Chọn nhanh cột mốc / Trạm QR 20m gần bạn nhất:
            </div>
            <div class="quick-start-grid">
              ${quickButtonsHtml}
            </div>
            <div style="border-top:1px solid #e2e8f0;padding-top:10px;font-size:13px;font-weight:bold;color:#0f172a;">
              Cách 2: Nhìn biển tên phòng ngay sát cạnh bạn và chọn:
            </div>
            <div style="display:flex;gap:6px;">
              <select id="where-am-i-room-select" style="flex:1;padding:8px;border-radius:6px;border:1px solid #94a3b8;font-family:var(--app-font);font-size:14px;"></select>
              <button class="rt-top-btn" onclick="NQDRoutingEngine.confirmDropdownRoom()">Chọn</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    if (!document.getElementById('qr-manager-backdrop')) {
      const qrModal = document.createElement('div');
      qrModal.id = 'qr-manager-backdrop';
      qrModal.className = 'rt-modal-backdrop';
      qrModal.onclick = closeQRManagerModal;
      qrModal.innerHTML = `
        <div class="rt-modal-box" style="max-width:640px;" onclick="event.stopPropagation()">
          <div class="modal-header" style="background:#b45309;">
            <span>📷 Hệ thống 12 Trạm Mã QR Định Vị (Cách nhau 20m)</span>
            <button class="modal-close-btn" onclick="NQDRoutingEngine.closeQRManagerModal()">✖</button>
          </div>
          <div class="rt-modal-body">
            <p style="font-size:13.5px;color:#334155;line-height:1.4;">
              Khi dán các mã QR này cách nhau mỗi 20m dọc hành lang/cầu thang, khách dùng điện thoại quét mã sẽ được <strong>tự động đưa vào web và ghim sẵn Điểm đầu (A)</strong> ngay tại trạm đó.
            </p>
            <div id="qr-stations-list" style="display:flex;flex-direction:column;gap:8px;"></div>
          </div>
        </div>
      `;
      document.body.appendChild(qrModal);
    }
  }

  function populateRoomSelectDropdown() {
    const sel = document.getElementById('where-am-i-room-select');
    if (!sel || !window.NQDMapApp) return;
    const sheet = window.NQDMapApp.getActiveSheet();
    const all = [...window.NQDMapApp.getFixedLandmarks(), ...(sheet ? sheet.rooms : [])];
    sel.innerHTML = all.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
  }

  function confirmDropdownRoom() {
    const sel = document.getElementById('where-am-i-room-select');
    if (sel && sel.value) {
      confirmStartPointFromModal(sel.value);
    }
  }

  function init() {
    injectRoutingStyles();
    injectRoutingUI();
    checkUrlForQRLocation();
    redraw();
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    setPointFromApp,
    redraw,
    clearRoute,
    openWhereAmIModal,
    closeWhereAmIModal,
    confirmStartPointFromModal,
    confirmDropdownRoom,
    openQRManagerModal,
    closeQRManagerModal,
    simulateQRScan,
    getQRCheckpoints: () => QR_CHECKPOINTS
  };
})();
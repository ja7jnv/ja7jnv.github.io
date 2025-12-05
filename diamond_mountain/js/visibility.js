// 可視領域計算関連

/**
 * 山から東にkmEastずらした座標を返す
 * @param {Object} mt - 山のデータ
 * @param {number} kmEast - 東方向の距離(km)
 * @returns {Object} lat, lon, zoom
 */
function getViewCenterFromMountain(mt, kmEast = CONSTANTS.MAP.MOUNTAIN_VIEW_OFFSET_KM) {
    const lonOffset = kmEast / (CONSTANTS.KM_PER_DEGREE_LAT * Math.cos(deg2rad(mt.lat)));
    const centerLon = mt.lon + lonOffset;
    return {
        lat: mt.lat,
        lon: centerLon,
        zoom: CONSTANTS.MAP.INITIAL_ZOOM
    };
}

/**
 * 指定期間内で太陽が山の方向に一致する時刻を検索
 * @param {number} lat - 観測地点の緯度
 * @param {number} lon - 観測地点の経度
 * @param {Date} startDate - 開始日
 * @param {number} years - 探索年数
 * @param {number} azTol - 方位許容誤差
 * @param {number} elTol - 仰角許容誤差
 * @param {Object} ba - 山の方位角・仰角情報
 * @returns {Object|null} 一致情報、または null
 */
function findSunMountainAlignment(lat, lon, startDate, years, azTol, elTol, ba) {
    const endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + years);
    
    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    
    for (let day = 0; day < totalDays; day++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(currentDate.getDate() + day);
        
        const Y = currentDate.getFullYear();
        const M = currentDate.getMonth();
        const D = currentDate.getDate();
        
        for (let hh = CONSTANTS.SEARCH.TIME_START_HOUR; hh <= CONSTANTS.SEARCH.TIME_END_HOUR; hh++) {
            for (let mm = 0; mm < 60; mm += CONSTANTS.SEARCH.TIME_STEP_MINUTES) {
                const dt = new Date(Y, M, D, hh, mm, 0);
                const pos = sunAltAzLocal(lat, lon, dt, CONSTANTS.JST_OFFSET);
                
                if (pos.alt < CONSTANTS.SEARCH.MIN_SUN_ALTITUDE) continue;
                
                const azDiff = angleDiff(pos.az, ba.bearing);
                const elDiff = Math.abs(pos.alt - ba.elev);
                
                if (azDiff <= azTol && elDiff <= elTol) {
                    return {
                        date: dt,
                        az: pos.az,
                        alt: pos.alt
                    };
                }
            }
        }
    }
    
    return null;
}

/**
 * 可視領域を計算
 * @param {Object} opts - オプション
 * @returns {Promise<Array>} 可視地点の配列
 */
async function computeVisibility(opts) {
    // レイヤーをクリア
    if (window.visLayer) window.visLayer.clearLayers();
    if (window.sampleLayer) window.sampleLayer.clearLayers();

    const startDate = opts.startDate;
    const years = parseInt(opts.years, 10);
    const azTol = parseFloat(opts.azTol);
    const elTol = parseFloat(opts.elTol);
    const obsElev = parseFloat(opts.obsElev);
    const mt = mountains[opts.mountKey];

    const Rkm = CONSTANTS.SEARCH.RADIUS_KM;
    const step_km = opts.step_km || CONSTANTS.SEARCH.GRID_STEP_KM;

    // 緯度・経度の変換係数
    const lat_km = CONSTANTS.KM_PER_DEGREE_LAT;
    const lon_km_at_lat = CONSTANTS.KM_PER_DEGREE_LAT * Math.cos(deg2rad(mt.lat));
    const dlat = Rkm / lat_km;
    const dlon = Rkm / lon_km_at_lat;

    const lat_min = mt.lat - dlat;
    const lat_max = mt.lat + dlat;
    const lon_min = mt.lon - dlon;
    const lon_max = mt.lon + dlon;

    const lat_step = step_km / lat_km;
    const lon_step = step_km / lon_km_at_lat;

    const results = [];

    // グリッド走査
    for (let lat = lat_min; lat <= lat_max + 1e-12; lat += lat_step) {
        for (let lon = lon_min; lon <= lon_max + 1e-12; lon += lon_step) {
            const ba = bearingAndApparentElevation(lat, lon, obsElev, mt.lat, mt.lon, mt.h);
            
            // 方位制限
            if (ba.bearing < CONSTANTS.SEARCH.BEARING_MIN || ba.bearing > CONSTANTS.SEARCH.BEARING_MAX) {
                continue;
            }

            const firstMatch = findSunMountainAlignment(lat, lon, startDate, years, azTol, elTol, ba);
            
            if (firstMatch) {
                results.push({
                    lat,
                    lon,
                    found: true,
                    match: firstMatch,
                    bearing: ba.bearing,
                    elev: ba.elev
                });
            }
        }
    }

    // 結果を地図に描画
    for (const r of results) {
        const c = L.circle([r.lat, r.lon], {
            radius: CONSTANTS.MAP.VISIBILITY_CIRCLE_RADIUS_M,
            color: '#ff8800',
            fill: true,
            fillOpacity: 0.5
        }).addTo(window.visLayer);

        const dateStr = Utils.formatDateSimple(r.match.date);

        c.bindPopup(
            `初回ダイヤモンド発生\n${dateStr}\n\n` +
            `太陽方位: ${Utils.formatNumber(r.match.az)}°  高度: ${Utils.formatNumber(r.match.alt)}°\n` +
            `山の方位: ${Utils.formatNumber(r.bearing)}°  仰角: ${Utils.formatNumber(r.elev)}°`,
            { maxWidth: 500 }
        );
    }

    return results;
}
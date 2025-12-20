// 日の出・日の入り方向線を描画する機能

/**
 * 指定方位角の方向に線を描画するための終点座標を計算
 * @param {number} lat - 開始点の緯度
 * @param {number} lon - 開始点の経度
 * @param {number} bearing - 方位角(度)
 * @param {number} distanceKm - 線の長さ(km)
 * @returns {Object} 終点の座標 {lat, lon}
 */
function calculateEndPoint(lat, lon, bearing, distanceKm) {
    const R = CONSTANTS.EARTH_RADIUS_M / 1000; // 地球半径(km)
    const d = distanceKm / R; // 角距離(ラジアン)
    
    const lat1 = deg2rad(lat);
    const lon1 = deg2rad(lon);
    const brng = deg2rad(bearing);
    
    const lat2 = Math.asin(
        Math.sin(lat1) * Math.cos(d) +
        Math.cos(lat1) * Math.sin(d) * Math.cos(brng)
    );
    
    const lon2 = lon1 + Math.atan2(
        Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
        Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );
    
    return {
        lat: rad2deg(lat2),
        lon: rad2deg(lon2)
    };
}

/**
 * 日の出・日の入り方向の線を地図上に描画
 * @param {Object} map - Leafletマップオブジェクト
 * @param {number} lat - 観測地点の緯度
 * @param {number} lon - 観測地点の経度
 * @param {number} azRise - 日の出方位(度)
 * @param {number} azSet - 日の入り方位(度)
 * @param {number} lineLength - 線の長さ(km) デフォルト30km
 */
function drawSunDirectionLines(map, lat, lon, azRise, azSet, lineLength = 30) {
    // 既存の線を削除
    if (window.sunDirectionLines) {
        window.sunDirectionLines.clearLayers();
    } else {
        window.sunDirectionLines = L.layerGroup().addTo(map);
    }
    
    const startPoint = [lat, lon];
    
    // 日の出方向の線(青色)
    const sunriseEnd = calculateEndPoint(lat, lon, azRise, lineLength);
    const sunriseLine = L.polyline(
        [startPoint, [sunriseEnd.lat, sunriseEnd.lon]],
        {
            color: '#007bff',        // 青色
            weight: 3,               // 線の太さ
            opacity: 0.6,            // 半透明
            dashArray: '10, 5',      // 破線パターン
        }
    ).addTo(window.sunDirectionLines);
    
    // 日の出ラベル
    const sunriseLabel = L.marker([sunriseEnd.lat, sunriseEnd.lon], {
        icon: L.divIcon({
            className: 'sun-direction-label',
            html: `<div style="
                background: rgba(0, 123, 255, 0.8);
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: bold;
                white-space: nowrap;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            ">🌅 日の出 ${azRise.toFixed(1)}°</div>`,
            iconSize: [100, 30],
            iconAnchor: [50, 15]
        })
    }).addTo(window.sunDirectionLines);
    
    // 日の入り方向の線(オレンジ色)
    const sunsetEnd = calculateEndPoint(lat, lon, azSet, lineLength);
    const sunsetLine = L.polyline(
        [startPoint, [sunsetEnd.lat, sunsetEnd.lon]],
        {
            color: '#ff8800',        // オレンジ色
            weight: 3,               // 線の太さ
            opacity: 0.6,            // 半透明
            dashArray: '10, 5',      // 破線パターン
        }
    ).addTo(window.sunDirectionLines);
    
    // 日の入りラベル
    const sunsetLabel = L.marker([sunsetEnd.lat, sunsetEnd.lon], {
        icon: L.divIcon({
            className: 'sun-direction-label',
            html: `<div style="
                background: rgba(255, 136, 0, 0.8);
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: bold;
                white-space: nowrap;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            ">🌇 日の入り ${azSet.toFixed(1)}°</div>`,
            iconSize: [100, 30],
            iconAnchor: [50, 15]
        })
    }).addTo(window.sunDirectionLines);
    
    // ポップアップを追加
    sunriseLine.bindPopup(`<strong>🌅 日の出方向</strong><br>方位: ${azRise.toFixed(1)}°`);
    sunsetLine.bindPopup(`<strong>🌇 日の入り方向</strong><br>方位: ${azSet.toFixed(1)}°`);
}

/**
 * 日の出・日の入り方向の線をクリア
 */
function clearSunDirectionLines() {
    if (window.sunDirectionLines) {
        window.sunDirectionLines.clearLayers();
    }
}
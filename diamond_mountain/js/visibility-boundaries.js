// 可視領域の境界線を描画する機能(正しい実装)

/**
 * 指定期間内の太陽方位の範囲を計算
 * @param {number} lat - 計算地点の緯度
 * @param {number} lon - 計算地点の経度
 * @param {Date} startDate - 開始日
 * @param {number} years - 探索年数
 * @returns {Object} 朝日と夕日の方位角範囲
 */
function calculateSunAzimuthRange(lat, lon, startDate, years) {
    const endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + years);
    
    let sunriseAzMin = 360;
    let sunriseAzMax = 0;
    let sunsetAzMin = 360;
    let sunsetAzMax = 0;
    
    // 期間内の各日について太陽位置を計算
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
        const sunInfo = sunRiseSet(lat, lon, date, CONSTANTS.JST_OFFSET);
        
        // 日の出方位
        if (sunInfo.azRise > 0) {
            sunriseAzMin = Math.min(sunriseAzMin, sunInfo.azRise);
            sunriseAzMax = Math.max(sunriseAzMax, sunInfo.azRise);
        }
        
        // 日の入り方位
        if (sunInfo.azSet > 0) {
            sunsetAzMin = Math.min(sunsetAzMin, sunInfo.azSet);
            sunsetAzMax = Math.max(sunsetAzMax, sunInfo.azSet);
        }
    }
    
    return {
        sunrise: { min: sunriseAzMin, max: sunriseAzMax },
        sunset: { min: sunsetAzMin, max: sunsetAzMax }
    };
}

/**
 * 指定方位角で山が見える地点を探す
 * @param {Object} mt - 山のデータ
 * @param {number} targetAzimuth - 目標方位角(度)
 * @param {number} searchDistance - 探索距離(km)
 * @param {number} obsElev - 観測地点標高(m)
 * @returns {Object|null} 見つかった地点 {lat, lon, distance}
 */
function findObservationPoint(mt, targetAzimuth, searchDistance = 100, obsElev = 0) {
    // 正規化: 0-360度の範囲に
    targetAzimuth = ((targetAzimuth % 360) + 360) % 360;
    
    // 二分探索で距離を探す
    let minDist = 5;  // 最小5km
    let maxDist = searchDistance;
    const tolerance = 0.5; // 0.5度の精度
    
    for (let iteration = 0; iteration < 50; iteration++) {
        const testDist = (minDist + maxDist) / 2;
        
        // 山から指定距離・方位の地点を計算
        const testPoint = calculatePointFromMountain(mt.lat, mt.lon, targetAzimuth, testDist);
        
        // その地点から山への方位角を計算
        const ba = bearingAndApparentElevation(
            testPoint[0], testPoint[1], obsElev,
            mt.lat, mt.lon, mt.h
        );
        
        // 逆方向の方位角を計算
        const reverseAzimuth = (ba.bearing + 180) % 360;
        const azDiff = angleDiff(reverseAzimuth, targetAzimuth);
        
        if (azDiff < tolerance) {
            console.log(`観測地点発見: 目標方位=${targetAzimuth.toFixed(1)}°, 距離=${testDist.toFixed(1)}km`);
            return {
                lat: testPoint[0],
                lon: testPoint[1],
                distance: testDist,
                bearing: ba.bearing,
                elevation: ba.elev
            };
        }
        
        // 距離を調整
        if (Math.abs(maxDist - minDist) < 0.1) {
            console.warn(`収束せず: 目標方位=${targetAzimuth.toFixed(1)}°, 誤差=${azDiff.toFixed(2)}°`);
            break;
        }
        
        // 方位のずれに応じて調整
        if (reverseAzimuth < targetAzimuth) {
            minDist = testDist;
        } else {
            maxDist = testDist;
        }
    }
    
    console.warn(`観測地点が見つかりませんでした: 目標方位=${targetAzimuth.toFixed(1)}°`);
    return null;
}

/**
 * 山頂から指定方位角・距離の地点を計算
 * @param {number} lat - 山の緯度
 * @param {number} lon - 山の経度
 * @param {number} bearing - 方位角(度)
 * @param {number} distanceKm - 距離(km)
 * @returns {Array} [lat, lon]
 */
function calculatePointFromMountain(lat, lon, bearing, distanceKm) {
    const R = CONSTANTS.EARTH_RADIUS_M / 1000;
    const d = distanceKm / R;
    
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
    
    return [rad2deg(lat2), rad2deg(lon2)];
}

/**
 * ダイヤモンド現象の可視範囲を線で描画
 * @param {Object} map - Leafletマップ
 * @param {Object} mt - 山のデータ
 * @param {Date} startDate - 開始日
 * @param {number} years - 探索年数
 * @param {number} obsElev - 観測地点標高(m)
 */
function drawVisibilityBoundaries(map, mt, startDate, years, obsElev = 0) {
    // 既存の線を削除
    if (window.visibilityBoundaries) {
        window.visibilityBoundaries.clearLayers();
    } else {
        window.visibilityBoundaries = L.layerGroup().addTo(map);
    }
    
    const mountainPoint = [mt.lat, mt.lon];
    
    // 山頂の位置での太陽方位範囲を計算(参考用)
    const sunRange = calculateSunAzimuthRange(mt.lat, mt.lon, startDate, years);
    
    console.log('太陽方位範囲:', sunRange);
    
    // === 夕日の範囲(東側から山を見る) ===
    if (sunRange.sunset.min < 360 && sunRange.sunset.max > 0) {
        console.log('夕日の北限を計算中...', sunRange.sunset.min);
        
        // 夕日の北限: 太陽が最も北に沈む日
        // 観測地点は山の東側なので、太陽方位 - 180度
        const sunsetNorthPoint = findObservationPoint(mt, sunRange.sunset.min - 180, 100, obsElev);
        
        if (sunsetNorthPoint) {
            console.log('夕日の北限地点:', sunsetNorthPoint);
            
            // 線を延長: 観測地点からさらに同じ方向に伸ばす
            const extendedPoint = calculatePointFromMountain(
                mt.lat, mt.lon, 
                sunRange.sunset.min - 180, 
                100  // 100kmまで延長
            );
            
            const sunsetNorthLine = L.polyline(
                [mountainPoint, extendedPoint],
                {
                    color: '#ff8800',
                    weight: 2,
                    opacity: 0.7
                }
            ).addTo(window.visibilityBoundaries);
            
            sunsetNorthLine.bindPopup(
                `<strong>🌇 夕日の北限</strong><br>` +
                `太陽方位: ${sunRange.sunset.min.toFixed(1)}°<br>` +
                `最適観測地点: 山から ${sunsetNorthPoint.distance.toFixed(1)} km<br>` +
                `山の仰角: ${sunsetNorthPoint.elevation.toFixed(2)}°`
            );
        } else {
            console.error('夕日の北限地点が見つかりませんでした');
        }
        
        console.log('夕日の南限を計算中...', sunRange.sunset.max);
        
        // 夕日の南限: 太陽が最も南に沈む日
        const sunsetSouthPoint = findObservationPoint(mt, sunRange.sunset.max - 180, 100, obsElev);
        
        if (sunsetSouthPoint) {
            console.log('夕日の南限地点:', sunsetSouthPoint);
            
            // 線を延長: 100kmまで
            const extendedPoint = calculatePointFromMountain(
                mt.lat, mt.lon, 
                sunRange.sunset.max - 180, 
                100
            );
            
            const sunsetSouthLine = L.polyline(
                [mountainPoint, extendedPoint],
                {
                    color: '#ff8800',
                    weight: 2,
                    opacity: 0.7
                }
            ).addTo(window.visibilityBoundaries);
            
            sunsetSouthLine.bindPopup(
                `<strong>🌇 夕日の南限</strong><br>` +
                `太陽方位: ${sunRange.sunset.max.toFixed(1)}°<br>` +
                `最適観測地点: 山から ${sunsetSouthPoint.distance.toFixed(1)} km<br>` +
                `山の仰角: ${sunsetSouthPoint.elevation.toFixed(2)}°`
            );
        } else {
            console.error('夕日の南限地点が見つかりませんでした');
        }
        
        // ラベル
        if (sunsetNorthPoint && sunsetSouthPoint) {
            const midLat = (sunsetNorthPoint.lat + sunsetSouthPoint.lat) / 2;
            const midLon = (sunsetNorthPoint.lon + sunsetSouthPoint.lon) / 2;
            
            L.marker([midLat, midLon], {
                icon: L.divIcon({
                    className: 'visibility-label',
                    html: `<div style="
                        background: rgba(255, 136, 0, 0.9);
                        color: white;
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-size: 11px;
                        font-weight: bold;
                        white-space: nowrap;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    ">🌇 夕日の範囲</div>`,
                    iconSize: [80, 20],
                    iconAnchor: [40, 10]
                })
            }).addTo(window.visibilityBoundaries);
        }
    }
    
    // === 朝日の範囲(西側から山を見る) ===
    if (sunRange.sunrise.min < 360 && sunRange.sunrise.max > 0) {
        console.log('朝日の北限を計算中...', sunRange.sunrise.min);
        
        // 朝日の北限
        const sunriseNorthPoint = findObservationPoint(mt, sunRange.sunrise.min + 180, 100, obsElev);
        
        if (sunriseNorthPoint) {
            console.log('朝日の北限地点:', sunriseNorthPoint);
            
            // 線を延長: 100kmまで
            const extendedPoint = calculatePointFromMountain(
                mt.lat, mt.lon, 
                sunRange.sunrise.min + 180, 
                100
            );
            
            const sunriseNorthLine = L.polyline(
                [mountainPoint, extendedPoint],
                {
                    color: '#007bff',
                    weight: 2,
                    opacity: 0.7
                }
            ).addTo(window.visibilityBoundaries);
            
            sunriseNorthLine.bindPopup(
                `<strong>🌅 朝日の北限</strong><br>` +
                `太陽方位: ${sunRange.sunrise.min.toFixed(1)}°<br>` +
                `最適観測地点: 山から ${sunriseNorthPoint.distance.toFixed(1)} km<br>` +
                `山の仰角: ${sunriseNorthPoint.elevation.toFixed(2)}°`
            );
        } else {
            console.error('朝日の北限地点が見つかりませんでした');
        }
        
        console.log('朝日の南限を計算中...', sunRange.sunrise.max);
        
        // 朝日の南限
        const sunriseSouthPoint = findObservationPoint(mt, sunRange.sunrise.max + 180, 100, obsElev);
        
        if (sunriseSouthPoint) {
            console.log('朝日の南限地点:', sunriseSouthPoint);
            
            // 線を延長: 100kmまで
            const extendedPoint = calculatePointFromMountain(
                mt.lat, mt.lon, 
                sunRange.sunrise.max + 180, 
                100
            );
            
            const sunriseSouthLine = L.polyline(
                [mountainPoint, extendedPoint],
                {
                    color: '#007bff',
                    weight: 2,
                    opacity: 0.7
                }
            ).addTo(window.visibilityBoundaries);
            
            sunriseSouthLine.bindPopup(
                `<strong>🌅 朝日の南限</strong><br>` +
                `太陽方位: ${sunRange.sunrise.max.toFixed(1)}°<br>` +
                `最適観測地点: 山から ${sunriseSouthPoint.distance.toFixed(1)} km<br>` +
                `山の仰角: ${sunriseSouthPoint.elevation.toFixed(2)}°`
            );
        } else {
            console.error('朝日の南限地点が見つかりませんでした');
        }
        
        // ラベル
        if (sunriseNorthPoint && sunriseSouthPoint) {
            const midLat = (sunriseNorthPoint.lat + sunriseSouthPoint.lat) / 2;
            const midLon = (sunriseNorthPoint.lon + sunriseSouthPoint.lon) / 2;
            
            L.marker([midLat, midLon], {
                icon: L.divIcon({
                    className: 'visibility-label',
                    html: `<div style="
                        background: rgba(0, 123, 255, 0.9);
                        color: white;
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-size: 11px;
                        font-weight: bold;
                        white-space: nowrap;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    ">🌅 朝日の範囲</div>`,
                    iconSize: [80, 20],
                    iconAnchor: [40, 10]
                })
            }).addTo(window.visibilityBoundaries);
        }
    }
}

/**
 * 可視範囲の境界線をクリア
 */
function clearVisibilityBoundaries() {
    if (window.visibilityBoundaries) {
        window.visibilityBoundaries.clearLayers();
    }
}
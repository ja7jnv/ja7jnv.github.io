// 可視領域の境界線を描画する

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
        // 日の出・日の入り時刻の太陽方位を取得
        const sunInfo = sunRiseSet(lat, lon, date, CONSTANTS.JST_OFFSET);
        
        // 日の出方位
        if (sunInfo.azRise > 0 && sunInfo.azRise < 180) {
            sunriseAzMin = Math.min(sunriseAzMin, sunInfo.azRise);
            sunriseAzMax = Math.max(sunriseAzMax, sunInfo.azRise);
        }
        
        // 日の入り方位
        if (sunInfo.azSet > 180 && sunInfo.azSet < 360) {
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
        
        if (Math.abs(azDiff) < tolerance) {
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
            break;
        }
        
        // 方位のずれに応じて調整
        if (azDiff > 0) {
            minDist = testDist;
        } else {
            maxDist = testDist;
        }
    }
    
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

	// ▼▼▼ 修正: 補正値を定義（反時計回りに2度ずらす） ▼▼▼
    // const AZIMUTH_CORRECTION = 4.93; //一丁平に合わせると南限がずれる(--; 
    const AZIMUTH_CORRECTION = 3.0;
    // ▲▲▲
    
    const mountainPoint = [mt.lat, mt.lon];
    
    // 山頂の位置での太陽方位範囲を計算(参考用)
    const sunRange = calculateSunAzimuthRange(mt.lat, mt.lon, startDate, years);
    
    // === 夕日の範囲(東側から山を見る) ===
    if (sunRange.sunset.min < 360 && sunRange.sunset.max > 0) {
        
        // 夕日の北限: 太陽が最も北に沈む日
        // 観測地点は山の東側なので、太陽方位 - 180度
	const sunsetNorthAz = sunRange.sunset.min - 180 - AZIMUTH_CORRECTION;

        const sunsetNorthPoint = findObservationPoint(mt, sunsetNorthAz, 100, obsElev);
        
        if (sunsetNorthPoint) {
            // 線を延長: 観測地点からさらに同じ方向に伸ばす
            const extendedPoint = calculatePointFromMountain(
                mt.lat, mt.lon, 
                sunsetNorthAz, 
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
        }
        
        // 夕日の南限: 太陽が最も南に沈む日
	const sunsetSouthAz = sunRange.sunset.max - 180 - AZIMUTH_CORRECTION;

        const sunsetSouthPoint = findObservationPoint(mt, sunsetSouthAz, 100, obsElev);
        
        if (sunsetSouthPoint) {
            // 線を延長: 100kmまで
            const extendedPoint = calculatePointFromMountain(
                mt.lat, mt.lon, 
                sunsetSouthAz, 
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
        }
        
        // ラベル
        if (sunsetNorthPoint && sunsetSouthPoint) {
            L.marker([mt.lat, mt.lon + CONSTANTS.LABEL.DISPLAY_OFFSET], {
                icon: L.divIcon({
                    className: 'visibility-label',
                    html: `<div style="
                        background: rgba(255, 136, 0, 0.9);
                        color: white;
                        padding: 4px 6px;
                        border-radius: 4px;
                        font-size: 11px;
                        font-weight: bold;
                        white-space: nowrap;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    ">🌇 夕日の範囲</div>`,
                    iconSize: [85, 20],		// 文字列の収まりが悪かったので 80, 20 -> 85, 20 に変更
                    iconAnchor: [40, 10]
                })
            }).addTo(window.visibilityBoundaries);
        }
    }
    
    // === 朝日の範囲(西側から山を見る) ===
    if (sunRange.sunrise.min < 360 && sunRange.sunrise.max > 0) {

	const sunriseSouthAz = sunRange.sunrise.min + 180 - AZIMUTH_CORRECTION;

        const sunriseSouthPoint = findObservationPoint(mt, sunriseSouthAz, 100, obsElev);
        
        if (sunriseSouthPoint) {
            const bearingFromPoint = sunriseSouthPoint.bearing;
            const oppositeDirection = (bearingFromPoint + 180) % 360;
            
            const extendedPoint = calculatePointFromMountain(
                sunriseSouthPoint.lat, 
                sunriseSouthPoint.lon, 
                oppositeDirection, 
                50
            );
            
            const sunriseSouthLine = L.polyline(
                [mountainPoint, [sunriseSouthPoint.lat, sunriseSouthPoint.lon], extendedPoint],
                {
                    color: '#007bff',
                    weight: 2,
                    opacity: 0.7
                }
            ).addTo(window.visibilityBoundaries);
            
            sunriseSouthLine.bindPopup(
                `<strong>🌅 朝日の南限 (冬至)</strong><br>` +
                `太陽方位: ${sunRange.sunrise.min.toFixed(1)}°<br>` +
                `観測地点: 山から ${sunriseSouthPoint.distance.toFixed(1)} km 西南西<br>` +
                `山の仰角: ${sunriseSouthPoint.elevation.toFixed(2)}°`
            );
        }
        
	const sunriseNorthAz = sunRange.sunrise.max + 180 - AZIMUTH_CORRECTION;

        const sunriseNorthPoint = findObservationPoint(mt, sunriseNorthAz, 100, obsElev);
        
        if (sunriseNorthPoint) {
            const bearingFromPoint = sunriseNorthPoint.bearing;
            const oppositeDirection = (bearingFromPoint + 180) % 360;
            
            const extendedPoint = calculatePointFromMountain(
                sunriseNorthPoint.lat, 
                sunriseNorthPoint.lon, 
                oppositeDirection, 
                50
            );
            
            const sunriseNorthLine = L.polyline(
                [mountainPoint, [sunriseNorthPoint.lat, sunriseNorthPoint.lon], extendedPoint],
                {
                    color: '#007bff',
                    weight: 2,
                    opacity: 0.7
                    // dashArray: '5, 5'
                }
            ).addTo(window.visibilityBoundaries);
            
            sunriseNorthLine.bindPopup(
                `<strong>🌅 朝日の北限 (夏至)</strong><br>` +
                `太陽方位: ${sunRange.sunrise.max.toFixed(1)}°<br>` +
                `観測地点: 山から ${sunriseNorthPoint.distance.toFixed(1)} km 西北西<br>` +
                `山の仰角: ${sunriseNorthPoint.elevation.toFixed(2)}°`
            );
        } else {
        }
        
        // ラベル
        if (sunriseNorthPoint && sunriseSouthPoint) {
            L.marker([mt.lat, mt.lon - CONSTANTS.LABEL.DISPLAY_OFFSET], {
                icon: L.divIcon({
                    className: 'visibility-label',
                    html: `<div style="
                        background: rgba(0, 123, 255, 0.9);
                        color: white;
                        padding: 4px 6px;
                        border-radius: 4px;
                        font-size: 11px;
                        font-weight: bold;
                        white-space: nowrap;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    ">🌅 朝日の範囲</div>`,
                    iconSize: [85, 20],		// 文字列の収まりが悪かったので 80, 20 -> 85, 20 に変更
                    iconAnchor: [40, 10]
                })
            }).addTo(window.visibilityBoundaries);
        }
    }
}

/**
 * 修正版: 太陽の軌道（日付）を指定して、山頂と重なる地点を探す
 * 方位角固定ではなく、指定日の太陽軌道と山頂が重なる地点を探します。
 */
function findObservationPointByDate(mt, targetDate, isSunset, searchDistance = 100, obsElev = 0) {
    let minDist = 5;
    let maxDist = searchDistance;
    const tolerance = 0.1; // 許容誤差（度）
    
    // 結果を格納する変数
    let bestPoint = null;
    let minError = 999;

    // 太陽方位自体が仰角（距離）によって変わるため距離を少しずつ変えながらベストな点を探す
    // ※本来はニュートン法などが高速だが、簡易的にステップ探索
    
    // 100km〜5kmまで走査
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
        const testDist = minDist + (maxDist - minDist) * (i / steps);
        
        // 1. まず、その距離にある山頂の「見かけの仰角」を計算
        // （方位は仮で決める必要があるが、仰角は距離依存が支配的なので一旦概算でOK）
        // 便宜上、前回の方位か、山から見た概算方位を使う
        const tempElev = calculateApparentElevation(testDist, mt.h, obsElev);
        
        // 2. その日付・その仰角における太陽の方位を計算
        // 「指定日付・指定仰角での太陽方位」を返す関数を用意する
        const sunAzimuthAtElev = getSunAzimuthAtElevation(mt.lat, mt.lon, targetDate, tempElev, isSunset);
        
        if (sunAzimuthAtElev === null) continue; // その仰角まで太陽が来ない場合

        // 3. その太陽方位の反対側（観測者から見て山があるべき方向）を計算
        const targetBearingFromObs = sunAzimuthAtElev; // 観測者 -> 太陽（山）
        
        // 4. 山から見て、その方位の反対側にある地点を計算（ここが実際の観測候補地）
        // 山 -> 観測者 の方位 = 太陽方位 + 180 (球面上での厳密な逆方位計算が必要だが、簡易的にはこれで)
        const bearingFromMt = (sunAzimuthAtElev + 180) % 360;
        
        const testPoint = calculatePointFromMountain(mt.lat, mt.lon, bearingFromMt, testDist);
        
        // 5. 検証: その地点から山を見た時の正確な方位と仰角を再計算
        const ba = bearingAndApparentElevation(
            testPoint[0], testPoint[1], obsElev,
            mt.lat, mt.lon, mt.h
        );
        
        // 太陽の方位 と 山の方位 のズレを確認
        // 厳密には、ここで再度「その正確な仰角ba.elevでの太陽方位」と比較すべき
        const preciseSunAz = getSunAzimuthAtElevation(mt.lat, mt.lon, targetDate, ba.elev, isSunset);
        const diff = Math.abs(angleDiff(ba.bearing, preciseSunAz));
        
        if (diff < minError) {
            minError = diff;
            bestPoint = {
                lat: testPoint[0],
                lon: testPoint[1],
                distance: testDist,
                bearing: ba.bearing,
                elevation: ba.elev,
                sunAzimuth: preciseSunAz
            };
        }
    }
    
    return minError < 1.0 ? bestPoint : null; // 誤差が大きすぎる場合は見つからなかったとする
}

/**
 * 距離から見かけの仰角（概算）を計算するヘルパー
 */
function calculateApparentElevation(distKm, mtHeightM, obsElevM) {
    const distM = distKm * 1000;
    const heightDiff = mtHeightM - obsElevM;
    // 地球の曲率を考慮（簡易式）
    const R = 6371000;
    const drop = (distM * distM) / (2 * R); // 曲率による沈み込み
    const apparentHeight = heightDiff - drop;
    return rad2deg(Math.atan2(apparentHeight, distM));
}

/*
 * 指定した日付で、指定した仰角(h)に太陽が来る瞬間の太陽方位角を返す関数
 */
function getSunAzimuthAtElevation(lat, lon, date, targetElev, isSunset) {
    // この関数は、指定した日付で太陽が指定仰角に達する瞬間の方位角を計算する。
    // 実装には天文計算ライブラリが必要。ここでは擬似コード。

    // 1. 指定日の太陽の軌道を計算
    // 2. 太陽の高度がtargetElevに達する時刻を探す
    // 3. その時刻の太陽方位角を返す

    // 例: pseudoSunPositionFunctionは天文計算ライブラリの関数
    const sunPositions = pseudoSunPositionFunction(lat, lon, date);
    
    for (let pos of sunPositions) {
        if (Math.abs(pos.elevation - targetElev) < 0.1) { // 許容誤差
            if (isSunset && pos.elevation < targetElev) {
                return pos.azimuth; // 夕方の場合
            } else if (!isSunset && pos.elevation > targetElev) {
                return pos.azimuth; // 朝の場合
            }
        }
    }
    
    return null; // 指定仰角に達しない場合
}


/**
 * 可視範囲の境界線をクリア
 */
function clearVisibilityBoundaries() {
    if (window.visibilityBoundaries) {
        window.visibilityBoundaries.clearLayers();
    }
}


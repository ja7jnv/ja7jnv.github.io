// 天文計算関連の関数

// 角度変換
const deg2rad = d => d * Math.PI / 180;
const rad2deg = r => r * 180 / Math.PI;

/**
 * UTC日時からユリウス日を計算
 * @param {Date} dateUtc - UTC日時
 * @returns {number} ユリウス日
 */
function toJulianDayUTC(dateUtc) {
    const Y = dateUtc.getUTCFullYear();
    let M = dateUtc.getUTCMonth() + 1;
    let D = dateUtc.getUTCDate() + 
        (dateUtc.getUTCHours() + 
         dateUtc.getUTCMinutes() / 60 + 
         dateUtc.getUTCSeconds() / 3600 + 
         dateUtc.getUTCMilliseconds() / 3.6e6) / 24;
    
    let Y2 = Y;
    let M2 = M;
    if (M2 <= 2) {
        Y2 -= 1;
        M2 += 12;
    }
    
    const A = Math.floor(Y2 / 100);
    const B = 2 - A + Math.floor(A / 4);
    const JD = Math.floor(365.25 * (Y2 + 4716)) + 
               Math.floor(30.6001 * (M2 + 1)) + D + B - 1524.5;
    
    return JD;
}

/**
 * ユリウス日から太陽の位置を計算
 * @param {number} jd - ユリウス日
 * @returns {Object} lambda: 黄経, decl: 赤緯
 */
function sunPositionJD(jd) {
    const n = jd - CONSTANTS.JULIAN_DAY_J2000;
    let L = (280.460 + 0.9856474 * n) % 360;
    if (L < 0) L += 360;
    
    const g = (357.528 + 0.9856003 * n) % 360;
    const gRad = deg2rad(g);
    
    let lam = L + 1.915 * Math.sin(gRad) + 0.02 * Math.sin(2 * gRad);
    lam = (lam % 360 + 360) % 360;
    
    const eps = deg2rad(CONSTANTS.AXIAL_TILT_DEG);
    const lamRad = deg2rad(lam);
    const delta = Math.asin(Math.sin(eps) * Math.sin(lamRad));
    
    return {
        lambda: lam,
        decl: rad2deg(delta)
    };
}

/**
 * 地方時から時角を計算
 * @param {Date} localDate - 地方時
 * @param {number} longitude - 経度
 * @param {number} tzOffsetHours - タイムゾーンオフセット(時間)
 * @returns {number} 時角(度)
 */
function hourAngleFromLocalClock(localDate, longitude, tzOffsetHours) {
    const Hh = localDate.getHours() + 
               localDate.getMinutes() / 60 + 
               localDate.getSeconds() / 3600;
    const localSolarTime = Hh + (longitude / 15.0) - tzOffsetHours;
    return 15 * (localSolarTime - 12);
}

/**
 * 指定地点・時刻の太陽の高度・方位を計算
 * @param {number} lat - 緯度
 * @param {number} lon - 経度
 * @param {Date} localDate - 地方時
 * @param {number} tzOffsetHours - タイムゾーンオフセット
 * @returns {Object} alt: 高度, az: 方位
 */
function sunAltAzLocal(lat, lon, localDate, tzOffsetHours) {
    const utcMillis = Date.UTC(
        localDate.getFullYear(), 
        localDate.getMonth(), 
        localDate.getDate(), 
        localDate.getHours() - tzOffsetHours, 
        localDate.getMinutes(), 
        localDate.getSeconds(), 
        localDate.getMilliseconds()
    );
    const dtUtc = new Date(utcMillis);
    const jd = toJulianDayUTC(dtUtc);
    const sp = sunPositionJD(jd);
    
    const delta = deg2rad(sp.decl);
    const phi = deg2rad(lat);
    const Hdeg = hourAngleFromLocalClock(localDate, lon, tzOffsetHours);
    const H = deg2rad(Hdeg);
    
    let sin_h = Math.sin(phi) * Math.sin(delta) + 
                Math.cos(phi) * Math.cos(delta) * Math.cos(H);
    sin_h = Math.max(-1, Math.min(1, sin_h));
    const alt = rad2deg(Math.asin(sin_h));
    
    const y = -Math.sin(H);
    const x = Math.cos(phi) * Math.tan(delta) - Math.sin(phi) * Math.cos(H);
    let az = rad2deg(Math.atan2(y, x));
    az = (az + 360) % 360;
    
    return { alt, az };
}

/**
 * 2地点間の方位角と仰角を計算
 * @param {number} latObs - 観測地点の緯度
 * @param {number} lonObs - 観測地点の経度
 * @param {number} hObs - 観測地点の標高
 * @param {number} latTgt - 目標地点の緯度
 * @param {number} lonTgt - 目標地点の経度
 * @param {number} hTgt - 目標地点の標高
 * @returns {Object} bearing: 方位角, elev: 仰角, dist: 距離
 */
function bearingAndApparentElevation(latObs, lonObs, hObs, latTgt, lonTgt, hTgt) {
    const R = CONSTANTS.EARTH_RADIUS_M;
    const lat1 = deg2rad(latObs);
    const lat2 = deg2rad(latTgt);
    const dlon = deg2rad(lonTgt - lonObs);
    
    const y = Math.sin(dlon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - 
              Math.sin(lat1) * Math.cos(lat2) * Math.cos(dlon);
    const bearing = (rad2deg(Math.atan2(y, x)) + 360) % 360;
    
    const central = Math.acos(
        Math.max(-1, Math.min(1, 
            Math.sin(lat1) * Math.sin(lat2) + 
            Math.cos(lat1) * Math.cos(lat2) * Math.cos(dlon)
        ))
    );
    const dist = R * central;
    
    const dh = hTgt - hObs;
    const elev = rad2deg(Math.atan2(dh, dist));
    
    return { bearing, elev, dist };
}

/**
 * 2つの角度の差(最小値)を計算
 * @param {number} a - 角度1
 * @param {number} b - 角度2
 * @returns {number} 角度差
 */
function angleDiff(a, b) {
    const d = Math.abs(a - b) % 360;
    return Math.min(d, 360 - d);
}

/**
 * 年間通算日(DOY)を取得するメソッドを追加
 */
Date.prototype.getDOY = function() {
    const start = new Date(this.getFullYear(), 0, 0);
    const diff = this - start + 
                 ((start.getTimezoneOffset() - this.getTimezoneOffset()) * 60 * 1000);
    return Math.floor(diff / (1000 * 60 * 60 * 24));
};
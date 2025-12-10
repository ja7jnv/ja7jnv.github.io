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


/**
 * 指定地点・日付の日の出時刻・日の入り時刻と方位を計算
 * @param {number} lat - 緯度
 * @param {number} lon - 経度
 * @param {Date} localDate - 地方時
 * @param {number} tzOffsetHours - タイムゾーンオフセット
 * @returns {Object} sunRise: 日の出時刻, sunSet: 日の入り時刻, azRize: 日の出方向, azSet: 日の入り方向 (時刻はDateオブジェクト)
 */
function sunRiseSet(lat, lon, localDate, tzOffsetHours) {
    // ----------------------------------------------------
    // 定数と単位変換のヘルパー関数
    // ----------------------------------------------------

    const SUN_ZENITH_ANGLE = 90.8333; // 日の出/日の入りを定義する天頂角（大気差を考慮）
    const RAD = Math.PI / 180; // 度からラジアンへの変換係数

    const degToRad = (deg) => deg * RAD;
    const radToDeg = (rad) => rad / RAD;

    // ----------------------------------------------------
    // 1. ユリウス日と世紀の計算
    // ----------------------------------------------------
    // UTCでの日の出/日の入りが起こると思われる日の正午（12時00分00秒）のユリウス日を基準とする
    const dateUTC = new Date(localDate.getTime() - tzOffsetHours * 3600000); // 地方時からUTCに変換
    dateUTC.setUTCHours(12, 0, 0, 0); // その日の正午UTCに設定

    const msInDay = 86400000;
    const J2000_MS = new Date('2000-01-01T12:00:00.000Z').getTime();

    // 2000年1月1日正午(J2000.0)からの日数を計算
    const daysFrom2000 = (dateUTC.getTime() - J2000_MS) / msInDay;

    // 世紀単位での日数
    const T = daysFrom2000 / 36525.0;

    // ----------------------------------------------------
    // 2. 太陽の基本パラメータの計算 (Meeusのアルゴリズムを簡略化)
    // ----------------------------------------------------

    // 太陽の平均近点角 (Mean anomaly of the Sun)
    let M = (357.5291 + 0.98560028 * daysFrom2000) % 360;
    if (M < 0) M += 360; // 0〜360度の範囲に調整

    // 太陽の平均経度 (Mean longitude of the Sun)
    let L = (280.459 + 0.98564736 * daysFrom2000) % 360;
    if (L < 0) L += 360;

    // ----------------------------------------------------
    // 3. 太陽の真経度と赤緯の計算
    // ----------------------------------------------------

    // 軌道離心率の補正 (Equation of the center)
    const C = (1.9148 * Math.sin(degToRad(M)) + 0.0200 * Math.sin(degToRad(2 * M)) + 0.0003 * Math.sin(degToRad(3 * M)));

    // 太陽の真経度 (True longitude of the Sun)
    const Lambda = L + C;

    // 地球の傾き（黄道の傾き、Obliquity of the Ecliptic）
    const epsilon = 23.439 - 0.00000036 * daysFrom2000;

    // 太陽の赤緯 (Declination of the Sun)
    const decRad = Math.asin(Math.sin(degToRad(epsilon)) * Math.sin(degToRad(Lambda)));
    const Dec = radToDeg(decRad);

    // ----------------------------------------------------
    // 4. 時角と均時差の計算
    // ----------------------------------------------------
    const latRad = degToRad(lat);
    const decRadAbs = Math.abs(decRad);

    // 日の出/日の入りが存在するためのチェック (極夜や白夜の判定)
    if (latRad >= 0 && latRad + decRadAbs > degToRad(90 - SUN_ZENITH_ANGLE) || // 北半球の白夜
        latRad < 0 && -latRad + decRadAbs > degToRad(90 - SUN_ZENITH_ANGLE)) { // 南半球の白夜
        // 日の入りも日の出もない（白夜）
        return { sunRise: null, sunSet: null, azRize: null, azSet: null };
    }
    if (latRad >= 0 && latRad - decRadAbs < degToRad(-90 + SUN_ZENITH_ANGLE) || // 北半球の極夜
        latRad < 0 && -latRad - decRadAbs < degToRad(-90 + SUN_ZENITH_ANGLE)) { // 南半球の極夜
        // 日の出も日の入りもない（極夜）
        return { sunRise: null, sunSet: null, azRize: null, azSet: null };
    }

    // 日の出/日の入り時の時角 (Hour Angle, H)
    // cos(H) = (cos(z) - sin(lat) * sin(Dec)) / (cos(lat) * cos(Dec))
    const cosH = (Math.cos(degToRad(SUN_ZENITH_ANGLE)) - Math.sin(latRad) * Math.sin(decRad)) / (Math.cos(latRad) * Math.cos(decRad));

    // 時角 H (日の出はマイナス、日の入りはプラス)
    const Hrad = Math.acos(cosH);
    const Hdeg = radToDeg(Hrad);

    // 太陽の赤経 (Right Ascension, RA)
    // 複雑な計算を省略し、日の出/日の入り計算に必要な均時差の近似値を計算

    // 均時差 (Equation of Time, EOT) in minutes
    // EOT = 4 * (Lon - RA) / 15.
    const Y = Math.tan(degToRad(epsilon / 2)) * Math.tan(degToRad(epsilon / 2));
    const eotMinutes = 4 * radToDeg(Y * Math.sin(2 * degToRad(L)) - 2 * 0.01671 * Math.sin(degToRad(M)) + 4 * 0.00014 * Math.sin(degToRad(2 * M)));

    // ----------------------------------------------------
    // 5. 日の出/日の入り時刻の計算 (UTC)
    // ----------------------------------------------------

    // 地方時での太陽の南中時刻 (Local Transit Time, TT) in minutes (0.0 to 1440.0)
    const TTMinutes = 720 + 4 * lon - eotMinutes;

    // UTCでの日の出時刻 (T_rise)
    // T_rise (min) = TT - H/15 * 60 - 4 * Lon
    const T_rise_UTC_Minutes = TTMinutes - Hdeg / 15 * 60 - 4 * lon;
    const riseUTC_dayFraction = T_rise_UTC_Minutes / 1440; // 1日の中の割合 (0.0〜1.0)

    // UTCでの日の入り時刻 (T_set)
    // T_set (min) = TT + H/15 * 60 - 4 * Lon
    const T_set_UTC_Minutes = TTMinutes + Hdeg / 15 * 60 - 4 * lon;
    const setUTC_dayFraction = T_set_UTC_Minutes / 1440; // 1日の中の割合 (0.0〜1.0)

    // ----------------------------------------------------
    // 6. 最終結果の導出 (Dateオブジェクトへの変換と方位計算)
    // ----------------------------------------------------

    // 日の出/日の入り時刻 (地方時) のDateオブジェクトを作成
    const sunRise = new Date(dateUTC.getTime() + riseUTC_dayFraction * msInDay + tzOffsetHours * 3600000);
    const sunSet = new Date(dateUTC.getTime() + setUTC_dayFraction * msInDay + tzOffsetHours * 3600000);

    // 方位角 (Azimuth, Az) の計算
    // cos(Az) = (sin(Dec) - sin(lat) * cos(z)) / (cos(lat) * sin(z))

    // 日の出方位 (Azimuth Rise)
    // 日の出の天頂角 z = SUN_ZENITH_ANGLE
    const cosAzRise = (Math.sin(decRad) - Math.sin(latRad) * Math.cos(degToRad(SUN_ZENITH_ANGLE))) /
                      (Math.cos(latRad) * Math.sin(degToRad(SUN_ZENITH_ANGLE)));

    let azRize = radToDeg(Math.acos(cosAzRise)); // 0〜180度
    azRize = (lat >= 0) ? (360 - azRize) % 360 : azRize; // 北半球(lat>=0)では360-Az、南半球ではAz

    // 日の入り方位 (Azimuth Set)
    const cosAzSet = (Math.sin(decRad) - Math.sin(latRad) * Math.cos(degToRad(SUN_ZENITH_ANGLE))) /
                     (Math.cos(latRad) * Math.sin(degToRad(SUN_ZENITH_ANGLE)));

    let azSet = radToDeg(Math.acos(cosAzSet)); // 0〜180度
    azSet = (lat >= 0) ? azSet : (360 - azSet) % 360; // 北半球(lat>=0)ではAz、南半球では360-Az

    // 結果を返す
    return {sunRise, sunSet, azRize, azSet};
}


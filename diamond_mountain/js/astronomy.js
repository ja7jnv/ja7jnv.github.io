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
 * @returns {Object} sunRise: 日の出時刻, sunSet: 日の入り時刻, azRise: 日の出方向, azSet: 日の入り方向 (時刻はDateオブジェクト)
 */
function sunRiseSet(lat, lon, localDate, tzOffsetHours) {
    // ----------------------------------------------------
    // 定数と単位変換
    // ----------------------------------------------------
    const SUN_ZENITH_ANGLE = 90.8333; // 日の出/日の入りを定義する天頂角
    const RAD = Math.PI / 180;
    const msInDay = 86400000;
    const J2000_MS = new Date('2000-01-01T12:00:00.000Z').getTime();

    const degToRad = (deg) => deg * RAD;
    const radToDeg = (rad) => rad / RAD;

    // ----------------------------------------------------
    // 1. 日付の処理とユリウス世紀 (T) の計算
    // ----------------------------------------------------
    // UTCでの日の出/日の入りが起こると思われる日の正午（12時00分00秒）を基準とする
    const dateUTC = new Date(localDate.getTime() - tzOffsetHours * 3600000); // 地方時からUTCに変換
    dateUTC.setUTCHours(12, 0, 0, 0); // その日の正午UTCに設定

    const daysFrom2000 = (dateUTC.getTime() - J2000_MS) / msInDay;
    const T = daysFrom2000 / 36525.0; // 世紀単位

    // ----------------------------------------------------
    // 2. 太陽の基本パラメータの計算
    // ----------------------------------------------------
    let M = (357.5291 + 0.98560028 * daysFrom2000) % 360;
    if (M < 0) M += 360;

    let L = (280.459 + 0.98564736 * daysFrom2000) % 360;
    if (L < 0) L += 360;

    const C = (1.9148 * Math.sin(degToRad(M)) + 0.0200 * Math.sin(degToRad(2 * M)) + 0.0003 * Math.sin(degToRad(3 * M)));
    const Lambda = L + C;
    const epsilon = 23.439 - 0.00000036 * daysFrom2000;

    // 太陽の赤緯 (Declination of the Sun)
    const decRad = Math.asin(Math.sin(degToRad(epsilon)) * Math.sin(degToRad(Lambda)));
    // const Dec = radToDeg(decRad); // デバッグ用

    // ----------------------------------------------------
    // 3. 均時差 (EOT) の計算
    // ----------------------------------------------------
    const Y = Math.tan(degToRad(epsilon / 2)) * Math.tan(degToRad(epsilon / 2));
    const eotMinutes = 4 * radToDeg(Y * Math.sin(2 * degToRad(L)) - 2 * 0.01671 * Math.sin(degToRad(M)) + 4 * 0.00014 * Math.sin(degToRad(2 * M)));

    // ----------------------------------------------------
    // 4. 時角 (H) の計算と極夜/白夜の判定
    // ----------------------------------------------------
    const latRad = degToRad(lat);

    const cosH_numerator = Math.cos(degToRad(SUN_ZENITH_ANGLE)) - Math.sin(latRad) * Math.sin(decRad);
    const cosH_denominator = Math.cos(latRad) * Math.cos(decRad);
    const cosH = cosH_numerator / cosH_denominator;

    if (cosH > 1 || cosH < -1) {
        // 白夜 (cosH > 1) または 極夜 (cosH < -1)
        return { sunRise: null, sunSet: null, azRise: null, azSet: null };
    }

    const Hrad = Math.acos(cosH);
    const Hdeg = radToDeg(Hrad);

    // ----------------------------------------------------
    // 5. 日の出/日の入り時刻の計算 (地方標準時 LST 基準)
    // ----------------------------------------------------

    // 1. 地方平均時 (LMT) での太陽の南中時刻
    const TT_LMT_Minutes = 720 - eotMinutes;

    // 2. LMTでの日の出/日の入り時刻
    const HMinutes = Hdeg * 4;
    const T_rise_LMT_Minutes = TT_LMT_Minutes - HMinutes;
    const T_set_LMT_Minutes = TT_LMT_Minutes + HMinutes;

    // 3. 地方標準時 (LST) への変換
    const standardMeridian = tzOffsetHours * 15; // 標準時子午線 (度)
    const diff_LMT_LST = (lon - standardMeridian) * 4; // LMTとLSTの差（分）

    const T_rise_LST_Minutes = T_rise_LMT_Minutes - diff_LMT_LST;
    const T_set_LST_Minutes = T_set_LMT_Minutes - diff_LMT_LST;

    // 地方標準時00:00:00のDateオブジェクトを作成
    const localDateStart = new Date(localDate);
    localDateStart.setHours(0, 0, 0, 0);

    const sunRise = new Date(localDateStart.getTime() + T_rise_LST_Minutes * 60000);
    const sunSet = new Date(localDateStart.getTime() + T_set_LST_Minutes * 60000);

	// ----------------------------------------------------
    // 6. 方位角 (Azimuth, Az) の計算と代入の修正
    // ----------------------------------------------------

    // cosAz をconst で定義
    const cosAz = (Math.sin(decRad) - Math.sin(latRad) * Math.cos(degToRad(SUN_ZENITH_ANGLE))) / 
                  (Math.cos(latRad) * Math.sin(degToRad(SUN_ZENITH_ANGLE)));
    
    // 基本方位角 (Base Azimuth): arccos(cosAz) は 0度から180度の範囲を返す
    const baseAzDeg = radToDeg(Math.acos(cosAz)); 

    let azRise, azSet;

    // 北半球 (緯度 > 0) の場合
    if (lat >= 0) {
        azRise = baseAzDeg;
        azSet = (360 - baseAzDeg) % 360;
    }

	// 南半球 (緯度 < 0) の場合
	else {
        azRise = (360 - baseAzDeg) % 360;
        azSet = baseAzDeg;
    }
    
    return {sunRise, sunSet, azRise: azRise, azSet};
}

/**
 * Dateオブジェクトから指定のフォーマットの文字列を生成する関数
 * @param {Date} date - Dateオブジェクト
 * @returns {string} 'YYYY/MM/DD, HH:mm' 形式の文字列
 */
function formatDateTime(date) {
    // オプションを設定
    const optionsDate = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    };
    const optionsTime = {
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23' // 24時間表示を強制
    };

    // 地方時形式（'ja-JP'）で日付を取得
    const datePart = date.toLocaleDateString('ja-JP', optionsDate);

    // 地方時形式で時刻を取得
    const timePart = date.toLocaleTimeString('ja-JP', optionsTime);

    // 日付の区切りを '年/月/日' に修正 (例: '2025/12/11' にするため)
    // toLocaleDateString('ja-JP') は '2025/12/11' の形式を返す

    return `${datePart}, ${timePart}`;
}

/**
 * Dateオブジェクトから 'YYYY/MM/DD, HH:mm' 形式の文字列を生成する関数
 * @param {Date} dateObj - sunRise または sunSet の Date オブジェクト
 * @returns {string} フォーマットされた文字列
 */
function formatSunTime(dateObj) {
    if (!dateObj) {
        return "N/A"; // 白夜/極夜などで null の場合の対応
    }

    // toLocaleDateString() は、ロケール 'ja-JP' を指定すると、
    // YYYY/MM/DD 形式を返すため、手動でのゼロ埋めは不要
    const datePart = dateObj.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });

    // 時刻のオプション。24時間表示 (h23) を強制
    const timePart = dateObj.toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
    });

    return `${datePart}, ${timePart}`;
}

/**
 * Dateオブジェクトから日付部分のみを 'YYYY/MM/DD' 形式で取得する関数
 * @param {Date} dateObj - Date オブジェクト
 */
function formatDatePart(dateObj) {
    if (!dateObj) return "N/A";

    // YYYY/MM/DD 形式で日付文字列を生成するオプション
    const optionsDate = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    };

    // 'ja-JP'ロケールで生成（例: 2025/12/11）
    return dateObj.toLocaleDateString('ja-JP', optionsDate);
}

/**
 * Dateオブジェクトから時刻部分のみを 'HH:mm' 形式で取得する関数
 * @param {Date} dateObj - sunRise または sunSet の Date オブジェクト
 * @returns {string} 'HH:mm' 形式の文字列
 */
function formatTimePart(dateObj) {
    if (!dateObj) {
        return "N/A"; // 白夜/極夜などで null の場合の対応
    }

    // 時刻のオプションを設定
    const optionsTime = {
        hour: '2-digit',      // 2桁の時 (例: 06, 13)
        minute: '2-digit',    // 2桁の分 (例: 08, 30)
        hourCycle: 'h23'      // 24時間表示（00〜23時）を強制
    };

    // 'ja-JP'ロケールで時刻文字列を生成（例: 06:48, 13:00）
    return dateObj.toLocaleTimeString('ja-JP', optionsTime);
}


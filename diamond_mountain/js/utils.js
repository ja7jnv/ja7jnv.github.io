// ユーティリティ関数

const Utils = {
    /**
     * 日付を文字列にフォーマット
     * @param {Date} date - 日付オブジェクト
     * @param {boolean} includeTime - 時刻を含めるか
     * @returns {string} フォーマットされた日付文字列
     */
    formatDate(date, includeTime = true) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        
        if (!includeTime) {
            return `${y}年${m}月${d}日`;
        }
        
        const hh = String(date.getHours()).padStart(2, '0');
        const mm = String(date.getMinutes()).padStart(2, '0');
        return `${y}年${m}月${d}日 ${hh}:${mm}`;
    },
    
    /**
     * 日付を簡易フォーマット (YYYY/MM/DD HH:MM)
     * @param {Date} date - 日付オブジェクト
     * @returns {string} フォーマットされた日付文字列
     */
    formatDateSimple(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const mm = String(date.getMinutes()).padStart(2, '0');
        return `${y}/${m}/${d} ${hh}:${mm}`;
    },
    
    /**
     * 今日の日付を YYYY-MM-DD 形式で取得
     * @returns {string} YYYY-MM-DD形式の日付
     */
    getTodayString() {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    },
    
    /**
     * 情報エリアにメッセージを表示
     * @param {string} message - 表示するメッセージ
     */
    showInfo(message) {
        const infoEl = document.getElementById('info');
        if (infoEl) {
            infoEl.textContent = message;
        }
    },
    
    /**
     * エラーメッセージを表示
     * @param {string} message - エラーメッセージ
     */
    showError(message) {
        console.error(message);
        this.showInfo(`エラー: ${message}`);
    },
    
    /**
     * 2つの日付間の日数を計算
     * @param {Date} date1 - 開始日
     * @param {Date} date2 - 終了日
     * @returns {number} 日数
     */
    daysBetween(date1, date2) {
        return Math.round((date2 - date1) / (1000 * 60 * 60 * 24)) + 1;
    },
    
    /**
     * 数値を指定桁数でフォーマット
     * @param {number} value - 数値
     * @param {number} decimals - 小数点以下の桁数
     * @returns {string} フォーマットされた文字列
     */
    formatNumber(value, decimals = 2) {
        return value.toFixed(decimals);
    },
    
    /**
     * 山から東にkmEastずらした座標を返す
     * @param {Object} mt - 山のデータ
     * @param {number} kmEast - 東方向の距離(km) デフォルト40km
     * @returns {Object} lat, lon, zoom
     */
    getViewCenterFromMountain(mt, kmEast = CONSTANTS.MAP.MOUNTAIN_VIEW_OFFSET_KM) {
        const lonOffset = kmEast / (CONSTANTS.KM_PER_DEGREE_LAT * Math.cos(deg2rad(mt.lat)));
        const centerLon = mt.lon + lonOffset;
        return {
            lat: mt.lat,
            lon: centerLon,
            zoom: CONSTANTS.MAP.INITIAL_ZOOM
        };
    }
};

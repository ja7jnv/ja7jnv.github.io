// 標高取得関連

// 最後に取得した地形標高(グローバル変数)
let lastTerrainElevation = CONSTANTS.ELEVATION.DEFAULT_ASSUMED;

/**
 * 国土地理院APIで標高を取得
 * @param {number} lat - 緯度
 * @param {number} lon - 経度
 * @returns {Promise<Object>} elevation: 標高, source: データソース
 */
async function getElevation(lat, lon) {
    try {
        const url = `https://cyberjapandata2.gsi.go.jp/general/dem/scripts/getelevation.php?lon=${lon}&lat=${lat}&outtype=JSON`;
        
        // タイムアウト付きfetch
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONSTANTS.ELEVATION.API_TIMEOUT_MS);
        
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!res.ok) {
            throw new Error(`HTTPエラー: ${res.status}`);
        }
        
        const data = await res.json();
        
        if (data.elevation === "-----") {
            throw new Error("標高データなし");
        }
        
        return {
            elevation: parseFloat(data.elevation),
            source: data.hsrc || "不明"
        };
    } catch (err) {
        console.warn("標高取得失敗 → デフォルト値で代替", err.message);
        return {
            elevation: CONSTANTS.ELEVATION.DEFAULT_ASSUMED,
            source: "仮定値(取得失敗)",
            error: err.message
        };
    }
}
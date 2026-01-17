// 定数定義ファイル

// ===== 天文関連定数 =====
const CONSTANTS = {
    // タイムゾーン
    JST_OFFSET: 9, // 日本標準時のUTCオフセット(時間)
    
    // 天文定数
    EARTH_RADIUS_M: 6371000, // 地球半径(m)
    AXIAL_TILT_DEG: 23.439,  // 地軸傾斜角(度)
    JULIAN_DAY_J2000: 2451545.0, // J2000.0のユリウス日
    
    // 緯度経度変換
    KM_PER_DEGREE_LAT: 111.32, // 緯度1度あたりのkm
    
    // ===== 探索設定 =====
    SEARCH: {
        RADIUS_KM: 60,           // 探索半径(km)
        GRID_STEP_KM: 2,         // グリッド間隔(km)
        TIME_START_HOUR: 15,     // 探索開始時刻(時)
        TIME_END_HOUR: 18,       // 探索終了時刻(時)
        TIME_STEP_MINUTES: 5,    // 時刻刻み(分) - グリッド計算用
        TIME_STEP_MINUTES_CLICK: 1, // 時刻刻み(分) - クリック時の詳細計算用
        MIN_SUN_ALTITUDE: -2,    // 最低太陽高度(度)
        BEARING_MIN: 150,        // 方位角最小値(度)
        BEARING_MAX: 360,        // 方位角最大値(度)
	AZIMUTH_CORRECTION_N: 4.93,	// 可視範囲を求めるときの仰角補正 - 北東・南西
	AZIMUTH_CORRECTION_S: 3.0,	// 可視範囲を求めるときの仰角補正 - 南東・北西
    },
    
    // ===== 地図表示設定 =====
    MAP: {
        INITIAL_CENTER: {
            lat: 35.62,		// 高尾山
            lon: 139.24
        },
        INITIAL_ZOOM: 10,
        // MOUNTAIN_VIEW_OFFSET_KM: 40, // 山から東方向のオフセット(km)
        MOUNTAIN_VIEW_OFFSET_KM: 0,		// 山から東方向のオフセット(km)
        VISIBILITY_CIRCLE_RADIUS_M: 500, // 可視地点の円の半径(m)
    },

	LABEL: {
		DISPLAY_OFFSET: 0.2	// 表示位置の山頂からの経度オフセット
	},
    
    // ===== 標高設定 =====
    ELEVATION: {
        DEFAULT_ASSUMED: 2,		// 標高取得失敗時は海上と思われる。デフォルト仮定標高(m)
        API_TIMEOUT_MS: 5000,		// APIタイムアウト(ミリ秒)
    },
    
    // ===== UI設定 =====
    UI: {
        DATE_LOAD_MESSAGE: '標高取得中…(1〜3秒)',
        CALCULATION_MESSAGE: '計算中...',
        ERROR_NO_DATE: 'エラー:観測開始日を選択してください!',
        ERROR_NO_MOUNTAIN: 'エラー:「対象の山」を選択してください!',
        ERROR_SELECT_MOUNTAIN_FIRST: '先に「対象の山」を選択してください!',
        CLEAR_MESSAGE: 'クリアしました',
    }
};

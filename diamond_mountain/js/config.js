// 山のデータ設定

const mountains = {
    chokai: {
        name: '鳥海山 (七高山)',
        lat: 39.09945869580092,
        lon: 140.0513154997461,
        h: 2230,
        order: 1  // 表示順序（オプション）
    },
    hakusan_yuzawa: {
        name: '白山 (湯沢市)',
        lat: 39.15435801088171,
        lon: 140.42919256941227,
        h: 273,
        order: 2  // 表示順序（オプション）
    },
    taihezan_ugo: {
        name: '太平山 (羽後町)',
        lat: 39.20723174602027,
        lon: 140.35290693207097,
        h: 473,
        order: 3  // 表示順序（オプション）
    },
    hinotodake: {
        name: '丁岳（秋田・山形）',
        lat: 39.032003,
        lon: 140.218908,
        h: 1145.6,
        order: 4  // 表示順序（オプション）
    },
    fuji: {
        name: '富士山 (剣ヶ峰)',
        lat: 35.3607237631673,
        lon: 138.72738839451753,
        h: 3776,
        order: 5  // 表示順序（オプション）
    }
    // 新しい山を追加する場合はここに追加するだけでOK!
    // 例:
    // yatsugatake: {
    //     name: '八ヶ岳 (赤岳)',
    //     lat: 35.9713,
    //     lon: 138.3717,
    //     h: 2899,
    //     order: 3
    // }
};

/**
 * 山の選択メニューを動的に生成
 */
function initializeMountainSelector() {
    const selectElement = document.getElementById('mountain');
    if (!selectElement) {
        console.error('mountain selectエレメントが見つかりません');
        return;
    }
    
    // 既存のオプションをクリア（プレースホルダーは残す）
    while (selectElement.options.length > 1) {
        selectElement.remove(1);
    }
    
    // mountainsオブジェクトを配列に変換してソート
    const mountainArray = Object.entries(mountains).map(([key, data]) => ({
        key,
        ...data
    }));
    
    // order プロパティでソート（存在しない場合は名前順）
    mountainArray.sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) {
            return a.order - b.order;
        }
        return a.name.localeCompare(b.name, 'ja');
    });
    
    // オプションを動的に追加
    mountainArray.forEach(mountain => {
        const option = document.createElement('option');
        option.value = mountain.key;
        option.textContent = mountain.name;
        selectElement.appendChild(option);
    });
}

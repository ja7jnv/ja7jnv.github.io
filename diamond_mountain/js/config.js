// 山のデータ設定

const mountains = {
    fuji: {
        name: '富士山 (剣ヶ峰)',
        lat: 35.3607237631673,
        lon: 138.72738839451753,
        h: 3776,
        order: 1  // 表示順序（オプション）
    },
    chokai: {
        name: '鳥海山 (七高山)',
        lat: 39.09945869580092,
        lon: 140.0513154997461,
        h: 2230,
        order: 2
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
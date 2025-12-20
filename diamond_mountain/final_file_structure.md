# 最終的なファイル構成

## 📁 必要なファイル一覧

```
diamond_mountain/
├── index.html
├── css/
│   └── style.css
└── js/
    ├── constants.js              ✅ 定数定義
    ├── utils.js                  ✅ ユーティリティ関数(getViewCenterFromMountain含む)
    ├── config.js                 ✅ 山のデータ
    ├── astronomy.js              ✅ 天文計算
    ├── elevation.js              ✅ 標高取得
    ├── visibility-boundaries.js  ✅ 可視範囲境界線(NEW)
    ├── sun-direction.js          ✅ 日の出・日の入り線
    ├── periods.js                ✅ 期間検索
    └── main.js                   ✅ メインロジック
```

## ❌ 削除してOKなファイル

以下のファイルは不要になったので削除できます：

```
js/
├── visibility.js          ← 削除OK(旧版)
└── visibility-arrows.js   ← 削除OK(重い矢印版)
```

## ✅ index.htmlのスクリプト読み込み順

```html
<script src="js/constants.js"></script>
<script src="js/utils.js"></script>
<script src="js/config.js"></script>
<script src="js/astronomy.js"></script>
<script src="js/elevation.js"></script>
<script src="js/visibility-boundaries.js"></script>
<script src="js/sun-direction.js"></script>
<script src="js/periods.js"></script>
<script src="js/main.js"></script>
```

## 🔧 修正内容まとめ

1. **`getViewCenterFromMountain`関数を`utils.js`に移動**
2. **`main.js`で呼び出しを`Utils.getViewCenterFromMountain()`に変更**
3. **`visibility.js`と`visibility-arrows.js`を削除**
4. **`visibility-boundaries.js`を新規作成(軽量版)**

## 📝 各ファイルの役割

| ファイル | 役割 |
|---------|------|
| constants.js | 定数・設定値の一元管理 |
| utils.js | 汎用ユーティリティ関数 |
| config.js | 山のデータと選択メニュー初期化 |
| astronomy.js | 太陽位置計算、方位角・仰角計算 |
| elevation.js | 国土地理院APIで標高取得 |
| visibility-boundaries.js | 可視範囲の境界線描画(軽量) |
| sun-direction.js | 日の出・日の入り方向線描画 |
| periods.js | 期間内の発生日一覧表示 |
| main.js | UI制御とイベント処理 |

## ⚠️ 確認事項

以下の関数が他のファイルで必要とされている可能性があります：

- `bearingAndApparentElevation()` → astronomy.js にあるはず
- `sunAltAzLocal()` → astronomy.js にあるはず
- `angleDiff()` → astronomy.js にあるはず
- `deg2rad()` → astronomy.js にあるはず
- `sunRiseSet()` → astronomy.js に実装されているか確認

もし`sunRiseSet()`が未実装の場合は、実装が必要です。
# Astronomy Engine 採用分析

調査日: 2026-10-01

## 方針

現在の自己流天文計算を維持・拡張するのではなく、天体位置と出没時刻の計算にAstronomy Engineを採用する。調査時点のnpm最新版は`astronomy-engine 2.1.19`である。

- [npm: astronomy-engine](https://www.npmjs.com/package/astronomy-engine)
- [公式リポジトリ](https://github.com/cosinekitty/astronomy)

Astronomy Engineへ置き換える対象は天体の位置・出没・月相などの天文計算とする。山の測地計算、観測地点探索、Leaflet描画、検索結果表示はDiamond Mountain側の責務として分離して維持する。

## 1. 置き換えられる部分

現在の`js/astronomy.js`のうち、以下はAstronomy Engineで置換できる。

| 現在の処理 | Astronomy Engine |
|---|---|
| `sunPositionJD()` | `Equator(Body.Sun, ...)` |
| `sunAltAzLocal()` | `Equator()` + `Horizon()` |
| `sunRiseSet()` | `SearchRiseSet()` + `Horizon()` |
| 太陽の赤緯・黄経 | `SunPosition()`、または`Equator()` |
| 月・惑星の位置 | `Equator()` + `Horizon()` |
| 月の出・月の入り | `SearchRiseSet(Body.Moon, ...)` |
| 月相 | `MoonPhase()`、`Illumination()` |
| 惑星の出没 | `SearchRiseSet()` |

以下はAstronomy Engineの責務ではないため、別の地理計算として残す。

- 山と観測地点の距離
- 山への方位角
- 山の仰角
- 地図上の地点生成
- 方位差の比較
- Leaflet用の測地線・線描画

## 2. Sunの既存機能との対応

現在の太陽機能は、次のように対応できる。

### 時刻ごとの太陽方位・高度

現在の処理は次の形式である。

```text
sunAltAzLocal(lat, lon, localDate, JST_OFFSET)
```

移行後は、観測地点を`Observer`へ変換し、`Equator()`と`Horizon()`を使う。

```text
observer = new Astronomy.Observer(lat, lon, elevation)
equator = Astronomy.Equator(
    Astronomy.Body.Sun,
    date,
    observer,
    true,
    true
)
horizontal = Astronomy.Horizon(
    date,
    observer,
    equator.ra,
    equator.dec
)
```

`Horizon()`の方位定義は以下で、現在のDiamond Mountainと一致する。

- 北: 0度
- 東: 90度
- 南: 180度
- 西: 270度

### 日の出・日の入り

現在の`sunRiseSet()`は、天頂角`90.8333°`、均時差、赤緯から近似計算している。

移行後は以下を使う。

```text
SearchRiseSet(Body.Sun, observer, +1, start, 1)
SearchRiseSet(Body.Sun, observer, -1, start, 1)
```

戻った時刻に対して`Equator()`と`Horizon()`を実行し、日の出・日の入り方位を取得する。

`SearchRiseSet()`は、太陽の見かけの半径、標準的な大気差、観測者の高さを考慮する。そのため、現在の計算結果との差は移植バグではなく、出没イベントの定義差によって発生する可能性がある。

### 既存UIへの対応

以下の既存機能は、天体アダプターをSunに設定すれば維持できる。

- 日の出方向線
- 日の入り方向線
- 太陽の可視範囲
- 山とのアライメント検索
- 期間検索
- CSV出力

関連箇所は`js/main.js`、`js/periods.js`、`js/visibility-boundaries.js`である。

## 3. Moonへの適用方法

### 月の方位・高度

月は次の流れで計算する。

```text
Observer
  -> Equator(Body.Moon, ...)
  -> Horizon(...)
  -> azimuth / altitude
```

Astronomy Engineの`Equator()`は観測地点に対するトップセントリック座標を返す。月では地心視差が大きいため、現在の太陽用近似式よりも観測地点を指定した計算が重要になる。

### 月の出・月の入り

```text
SearchRiseSet(Body.Moon, observer, +1, start, limitDays)
SearchRiseSet(Body.Moon, observer, -1, start, limitDays)
```

注意点は以下である。

- 月は毎日約50分ずつ出没時刻が変化する
- 月が24時間以内に出没しない場合がある
- `null`を正常な「該当なし」として扱う必要がある
- 月の出没は月の中心ではなく、見かけの上端を基準にする
- 大気差は標準値であり、実際の気象条件で変動する

### 月相

月相表示には次を利用できる。

- `MoonPhase(date)`: 月相角
- `Illumination(Body.Moon, date)`: 輝面率、位相角、視等級など

月の出没と山のアライメントを同じ結果に表示する場合、月相は位置計算とは別のメタデータとして扱う。

## 4. 山とのアライメント検索に必要なAPI

### 必須API

- `Observer`
- `Equator`
- `Horizon`
- `SearchRiseSet`
- `SearchAltitude`

山とのアライメント判定は、次の2つを比較する。

```text
天体の方位・高度
山の方位・仰角
```

山側の値は既存の`bearingAndApparentElevation()`を基本的に維持する。これは天文計算ではなく、観測地点と山頂の地理計算である。

### SearchRiseSetの役割

`SearchRiseSet()`は、日の出・日の入り、月の出・月の入り、惑星の出没に適している。ただし、山とのアライメントそのものを検索するAPIではない。

### SearchAltitudeの役割

`SearchAltitude()`は、天体が指定高度を通過する時刻を検索できる。次のような候補生成に利用できる。

1. 山の仰角を目標高度として候補時刻を検索する
2. 候補時刻の方位を`Horizon()`で取得する
3. 山の方位との差を確認する
4. 必要なら前後を精密検索する

ただし、方位と高度の両方を同時に解くものではない。最初の実装では、現在の粗い時刻走査を残し、各時刻の天体位置計算だけをAstronomy Engineへ置き換えるのが安全である。

`SearchHourAngle()`は南中時刻などには利用できるが、任意の山方向を探すAPIではない。

## 5. 現在のコードとのインターフェース設計

天体ごとの処理をUIに書かず、以下の契約を設ける。

```js
const celestialBody = {
    id,
    getPosition(date, observer),
    getRiseSet(date, observer),
    getVisibilityMetadata()
};
```

戻り値はAstronomy Engine固有の型を検索処理へ直接流さず、アプリ側の標準モデルへ変換する。

```js
{
    body: 'sun',
    time: Date,
    azimuth: number,
    altitude: number,
    riseSet: 'rise' | 'set' | null,
    refraction: 'none' | 'normal',
    topocentric: true
}
```

### 推奨構造

```text
src/
  domain/
    astronomy/
      celestial-body.js
      astronomy-engine-adapter.js
      sun.js
      moon.js
      planets.js
    search/
      alignment.js
      rise-set.js
      visibility-boundaries.js
```

### Observerの扱い

現在のコードでは、観測地点の標高と地上高を合算して扱っている。Astronomy Engineでは、海抜標高と地表からの高さを分けて考える。

```text
Observer.height
  = 海抜標高

SearchRiseSet(..., metersAboveGround)
  = 地表から観測者までの高さ
```

例えば次のように管理する。

```text
observer = Observer(lat, lon, terrainElevation)
observerHeight = groundInput
```

時刻別のトップセントリック位置でも、観測者の実際の標高を`Observer.height`へ反映する方針を決める必要がある。

## 6. npm/Viteでの導入方法

実装段階ではnpmパッケージを利用する。

```bash
npm install astronomy-engine
```

Vite側ではESMとして読み込める。

```js
import * as Astronomy from 'astronomy-engine';
```

パッケージには以下が定義されている。

- `import`用ESMエントリーポイント
- CommonJSエントリーポイント
- TypeScript型定義
- ブラウザ向けビルド
- `sideEffects: false`

現在は`package.json`がないため、実装段階ではVue/Vite基盤の導入と同時に依存関係を追加する。

CDN版も存在するが、今回の移行ではnpm/Viteによる依存管理を推奨する。天体アダプターをテストしやすく、APIの読み込み順依存をなくせるためである。

## 7. 精度・座標系・時刻系の注意点

### 座標系

Astronomy Engineでは複数の座標系を扱う。

- EQJ: J2000平均赤道座標
- EQD: 日付の真赤道座標
- ECL/ECT: 黄道座標
- HOR: 地平座標

`Horizon()`へ渡す場合は、`Equator()`の`ofdate = true`で日付の赤道座標を取得する。

```text
Equator(body, date, observer, true, ...)
```

J2000座標をそのまま`Horizon()`へ渡さないことが重要である。

### 方位角

Astronomy Engineの方位角は北を0度として東回りに増加する。現在のDiamond Mountainの方位定義と一致する。

### 時刻系

Astronomy Engineの入力は、基本的にUTCを表すJavaScript`Date`である。内部ではUT、TT、ΔTを扱う。

公式仕様上、UT1とUTCは対象精度では同一と近似される。

現行コードはJST固定で、`new Date()`と`getHours()`を多用している。移行時には次の境界を一箇所に集約する。

1. ユーザー入力の日付を日本時間として解釈する
2. 明示的にUTCの`Date`へ変換する
3. Astronomy Engineへ渡す
4. 結果を日本時間表示へ変換する

### 大気差

`Horizon()`は大気差を指定できる。

- 指定なし: 大気差なし
- `"normal"`: 標準的な大気差
- `"jplhor"`: JPL Horizons互換

`SearchRiseSet()`は標準的な大気差を内部で考慮する。現在の`MIN_SUN_ALTITUDE = -2`や天頂角`90.8333°`とはイベント定義が異なる。

太陽と月では、以下を明示的に決める必要がある。

- 中心の高度を比較するか
- 上端の出没を使うか
- 大気差を含めるか
- 表示用とアライメント検索用で定義を分けるか

### 月の視差

月では地心座標と観測地点から見た座標が大きく異なる。月のアライメントでは、観測地点を指定した`Equator()`を使い、地心の`GeoMoon()`だけで方位・高度を計算しない。

### 精度の扱い

Astronomy Engineは高精度な天文計算ライブラリだが、実際の観測結果は次の要因でも変わる。

- 大気差
- 気温、気圧、湿度
- 地形標高の誤差
- 山頂位置の誤差
- 山体の稜線形状
- 地球の自転・ΔTモデル
- 採用する出没定義

Astronomy Engineへ変更すれば結果が完全に一致するとは扱わず、旧実装との差分を仕様差と計算誤差に分けて評価する。

## 8. 現在の自己流計算との比較検証方法

### 比較対象

同じ入力で以下を比較する。

- 太陽の方位・高度
- 日の出時刻
- 日の入り時刻
- 日の出方位
- 日の入り方位
- 山の方位・仰角
- アライメント候補日時
- 期間検索の結果件数と発生日

### 固定テストケース

最低限、次のケースを固定する。

- 富士山周辺の代表地点
- 鳥海山周辺の代表地点
- 春分、夏至、秋分、冬至
- 日の出直前
- 日の入り直後
- 月の出没が日付をまたぐケース
- 月が24時間以内に出没しないケース
- 観測地点の標高が異なるケース
- 白夜・極夜相当のケース

### 測定値

時刻は秒差、角度は循環差で比較する。

```text
azimuthError = min(abs(a - b), 360 - abs(a - b))
altitudeError = abs(a - b)
timeError = abs(timeA - timeB)
```

平均値だけでなく、最大値と95パーセンタイルも記録する。

### 検証の順序

1. 現行自己流計算の出力を固定JSONなどに保存する
2. Astronomy Engineで同じ入力を計算する
3. 太陽の時刻別位置を比較する
4. 出没イベントを比較する
5. 旧実装とAstronomy Engineの差の理由を分類する
6. JPL Horizonsなど外部の検証可能な資料とも代表日時を比較する
7. 許容差を仕様として決定する
8. その後にアダプターを検索処理へ接続する

出没時刻については、現在の`sunRiseSet()`と`SearchRiseSet()`で定義が異なるため、数分程度の差を即座に不具合と判断しない。

## 推奨する移行順序

1. Astronomy Engineを使ったSunアダプターを作る
2. 旧Sun実装との比較データを作る
3. 出没定義と大気差の仕様を決める
4. 検索処理を天体非依存にする
5. Moonアダプターを追加する
6. 月の視差、出没、月相を検証する
7. Mercury、Venus、Mars、Jupiter、Saturnを同じ登録方式で追加する

この調査では、既存の`js/`、`css/`、`index.html`などのソースコードは変更していない。

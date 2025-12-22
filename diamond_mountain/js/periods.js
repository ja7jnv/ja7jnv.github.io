// ===== 期間検索のヘルパー関数 =====

/**
 * 日付部分のフォーマット (YYYY年MM月DD日)
 */
function formatDatePart(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}年${m}月${d}日`;
}

/**
 * 時刻部分のフォーマット (HH:MM)
 */
function formatTimePart(date) {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
}

/**
 * 期間内のダイヤモンド発生日を検索
 */
async function searchDiamondPeriods(lat, lon, obsH, mt, startDate, years, azTol, elTol) {
    const endYear = startDate.getFullYear() + years - 1;
    const rows = [];
    
    // 粗い検索と精密検索のパラメータ
    const coarseStep = 5; // 分
    const refineWindowMin = 20; // ±分
    const refineStep = 1; // 分
    
    // 検索対象の時間帯
    const SUNSET_HOURS = { start: 15, end: 18 };
    const SUNRISE_HOURS = { start: 4, end: 8 };
    
    for (let Y = startDate.getFullYear(); Y <= endYear; Y++) {
        const startDay = (Y === startDate.getFullYear()) 
            ? new Date(startDate) 
            : new Date(Y, 0, 1, 0, 0, 0);
        const endDay = new Date(Y, 11, 31, 23, 59, 59);
        
        // 山の方位と仰角を計算
        const ba = bearingAndApparentElevation(lat, lon, obsH, mt.lat, mt.lon, mt.h);
        const targetAz = ba.bearing;
        const targetElev = ba.elev;
        
        // 粗い検索で候補を抽出
        let candidates = [];
        for (let dt = new Date(startDay); dt <= endDay; dt = new Date(dt.getTime() + coarseStep * 60000)) {
            const s = sunAltAzLocal(lat, lon, dt, CONSTANTS.JST_OFFSET);
            const azDiff = angleDiff(s.az, targetAz);
            const altDiff = Math.abs(s.alt - targetElev);
            
            if (azDiff <= Math.max(1.0, azTol * 2) && altDiff <= Math.max(1.0, elTol * 2)) {
                candidates.push(new Date(dt));
            }
        }
        
        // 候補を精密検索
        const foundThisYear = [];
        const seen = new Set();
        
        for (const base of candidates) {
            for (let m = -refineWindowMin; m <= refineWindowMin; m += refineStep) {
                const t = new Date(base.getTime() + m * 60000);
                const s = sunAltAzLocal(lat, lon, t, CONSTANTS.JST_OFFSET);
                const azDiff = angleDiff(s.az, targetAz);
                const altDiff = Math.abs(s.alt - targetElev);
                
                if (azDiff <= azTol && altDiff <= elTol) {
                    const key = `${t.toISOString().slice(0, 10)} ${t.getHours().toString().padStart(2, '0')}:${t.getMinutes().toString().padStart(2, '0')}`;
                    
                    if (!seen.has(key)) {
                        seen.add(key);
                        
                        // 朝日/夕日の判定
                        const hour = t.getHours();
                        let mode = '';
                        if (hour >= SUNRISE_HOURS.start && hour <= SUNRISE_HOURS.end) {
                            mode = '🌅朝日';
                        } else if (hour >= SUNSET_HOURS.start && hour <= SUNSET_HOURS.end) {
                            mode = '🌇夕日';
                        }
                        
                        // 日の出・日の入り情報を取得
                        const sunInfo = sunRiseSet(lat, lon, t, CONSTANTS.JST_OFFSET);
                        
                        foundThisYear.push({
                            year: Y,
                            date: t.toISOString().slice(0, 10),
                            time: t.getHours().toString().padStart(2, '0') + ':' + t.getMinutes().toString().padStart(2, '0'),
                            sun_az: s.az.toFixed(3),
                            sun_alt: s.alt.toFixed(3),
                            az_diff: azDiff.toFixed(3),
                            alt_diff: (s.alt - targetElev).toFixed(3),
                            mode: mode,
                            sunrise: formatTimePart(sunInfo.sunRise),
                            sunset: formatTimePart(sunInfo.sunSet),
                            azRise: sunInfo.azRise.toFixed(1),
                            azSet: sunInfo.azSet.toFixed(1)
                        });
                    }
                }
            }
        }
        
        if (foundThisYear.length > 0) {
            // 同じ日付のデータを方位誤差が最小のもの1つに絞り込む
            const dailyBest = new Map();
            
            for (const item of foundThisYear) {
                const dateKey = item.date;
                const azError = parseFloat(item.az_diff);
                
                if (!dailyBest.has(dateKey)) {
                    dailyBest.set(dateKey, item);
                } else {
                    const existing = dailyBest.get(dateKey);
                    const existingAzError = parseFloat(existing.az_diff);
                    
                    // 方位誤差がより小さい場合は置き換え
                    if (azError < existingAzError) {
                        dailyBest.set(dateKey, item);
                    }
                }
            }
            
            // Map から配列に変換してソート
            const filteredData = Array.from(dailyBest.values());
            filteredData.sort((a, b) => (a.date + ' ' + a.time) < (b.date + ' ' + b.time) ? -1 : 1);
            rows.push(...filteredData);
        } else {
            // 該当なしの場合、最も近い時刻を探す
            let best = null;
            let bestScore = 1e9;
            
            for (let dt = new Date(startDay); dt <= endDay; dt = new Date(dt.getTime() + 10 * 60000)) {
                const s = sunAltAzLocal(lat, lon, dt, CONSTANTS.JST_OFFSET);
                const azDiff = angleDiff(s.az, targetAz);
                const altDiff = Math.abs(s.alt - targetElev);
                const score = azDiff + altDiff;
                
                if (score < bestScore) {
                    bestScore = score;
                    best = new Date(dt);
                }
            }
            
            // ±60分で精密化
            let bestRef = null;
            bestScore = 1e9;
            for (let m = -60; m <= 60; m++) {
                const t = new Date(best.getTime() + m * 60000);
                const s = sunAltAzLocal(lat, lon, t, CONSTANTS.JST_OFFSET);
                const azDiff = angleDiff(s.az, targetAz);
                const altDiff = Math.abs(s.alt - targetElev);
                const score = azDiff + altDiff;
                
                if (score < bestScore) {
                    bestScore = score;
                    bestRef = { t, s };
                }
            }
            
            const t = bestRef.t;
            const sunInfo = sunRiseSet(lat, lon, t, CONSTANTS.JST_OFFSET);
            
            rows.push({
                year: Y,
                date: t.toISOString().slice(0, 10),
                time: t.getHours().toString().padStart(2, '0') + ':' + t.getMinutes().toString().padStart(2, '0'),
                sun_az: bestRef.s.az.toFixed(3),
                sun_alt: bestRef.s.alt.toFixed(3),
                az_diff: angleDiff(bestRef.s.az, targetAz).toFixed(3),
                alt_diff: (bestRef.s.alt - targetElev).toFixed(3),
                mode: '',
                sunrise: formatTimePart(sunInfo.sunRise),
                sunset: formatTimePart(sunInfo.sunSet),
                azRise: sunInfo.azRise.toFixed(1),
                azSet: sunInfo.azSet.toFixed(1),
                note: 'この年にダイヤモンド現象はないが最も近いパターン'
            });
        }
    }
    
    return rows;
}

/**
 * CSVダウンロード
 */
function downloadCSV(rows, filename) {
    const headers = ['年', '日付', '時刻', '太陽方位', '太陽高度', 'Δ方位', 'Δ仰角', '種別', '日の出', '日の入り', '日出方位', '日入方位', '備考'];
    let csv = headers.join(',') + '\n';
    
    for (const r of rows) {
        const row = [
            r.year,
            r.date,
            r.time,
            r.sun_az,
            r.sun_alt,
            r.az_diff,
            r.alt_diff,
            r.mode || '',
            r.sunrise,
            r.sunset,
            r.azRise,
            r.azSet,
            r.note || ''
        ];
        csv += row.join(',') + '\n';
    }
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

/**
 * 期間検索ダイアログを表示
 * @param {Object} params - パラメータオブジェクト
 */
async function showPeriodsDialog(params) {
    const { lat, lon, obsH, mt, startDate, years, azTol, elTol } = params;
    
    // 新しいウィンドウを開く
    const newWindow = window.open('', '_blank', 'width=1200,height=800,scrollbars=yes');
    
    if (!newWindow) {
        alert('ポップアップがブロックされました。ブラウザの設定を確認してください。');
        return;
    }
    
    newWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ja">
        <head>
            <meta charset="UTF-8">
            <title>ダイヤモンド発生期間一覧 - ${mt.name}</title>
            <style>
                body {
                    font-family: system-ui, -apple-system, "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif;
                    padding: 20px;
                    background: #f5f5f5;
                }
                .header {
                    background: white;
                    padding: 20px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .header h1 {
                    margin: 0 0 10px 0;
                    color: #333;
                }
                .info {
                    color: #666;
                    line-height: 1.6;
                }
                .controls {
                    margin-bottom: 20px;
                }
                .controls button {
                    padding: 10px 20px;
                    margin-right: 10px;
                    font-size: 14px;
                    cursor: pointer;
                    border: none;
                    border-radius: 4px;
                    background: #007bff;
                    color: white;
                }
                .controls button:hover {
                    background: #0056b3;
                }
                .status {
                    padding: 10px;
                    margin-bottom: 20px;
                    border-radius: 4px;
                    background: #fff3cd;
                    border: 1px solid #ffc107;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    background: white;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                th, td {
					white-space: nowrap;
                    padding: 12px;
                    text-align: left;
                    border-bottom: 1px solid #ddd;
                }
                th {
                    background: #f8f9fa;
                    font-weight: 600;
                    color: #333;
                }
                tr:hover {
                    background: #f8f9fa;
                }
                .note {
                    color: #dc3545;
                    font-style: italic;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>ダイヤモンド発生期間一覧</h1>
                <div class="info">
                    <strong>山:</strong> ${mt.name} (標高 ${mt.h}m)<br>
                    <strong>観測地:</strong> 北緯 ${lat.toFixed(6)}°, 東経 ${lon.toFixed(6)}° (標高 ${obsH.toFixed(1)}m)<br>
                    <!-- <strong>検索期間:</strong> ${startDate.getFullYear()}年 から ${years}年間<br> -->
                    <strong>検索期間:</strong> ${startDate.getFullYear()}年${String(startDate.getMonth()+1).padStart(2,'0')}月${String(startDate.getDate()).padStart(2, '0')}日 から ${years}年間<br>
                    <!-- <strong>検索期間:</strong> ${startDate} から ${years}年間<br> -->
                    <strong>許容範囲:</strong> 方位 ±${azTol}°, 仰角 ±${elTol}°
                </div>
            </div>
            <div class="controls">
                <button onclick="window.close()">閉じる</button>
                <button id="downloadBtn" disabled>CSV出力</button>
            </div>
            <div class="status" id="status">処理中...</div>
            <div id="results"></div>
        </body>
        </html>
    `);
    
    // 非同期で検索実行
    try {
        Utils.showInfo('期間検索を実行中...');
        const rows = await searchDiamondPeriods(lat, lon, obsH, mt, startDate, years, azTol, elTol);
        
        const statusEl = newWindow.document.getElementById('status');
        const resultsEl = newWindow.document.getElementById('results');
        const downloadBtn = newWindow.document.getElementById('downloadBtn');
        
        if (rows.length === 0) {
            statusEl.textContent = '該当する日がありませんでした。';
            statusEl.style.background = '#f8d7da';
            statusEl.style.borderColor = '#dc3545';
            return;
        }
        
        // 結果を表示
        let html = `
            <table>
                <thead>
                    <tr>
                        <th>年</th>
                        <th>日付</th>
                        <th>時刻</th>
                        <th>太陽方位</th>
                        <th>太陽高度</th>
                        <th>Δ方位</th>
                        <th>Δ仰角</th>
                        <th>種別</th>
                        <th>日出</th>
                        <th>日没</th>
                        <th>日出方位</th>
                        <th>日入方位</th>
                        <th>備考</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        for (const r of rows) {
            html += `
                <tr>
                    <td>${r.year}</td>
                    <td>${r.date.substring(5).replace("-", "/")}</td>
                    <td>${r.time}</td>
                    <td>${r.sun_az}°</td>
                    <td>${r.sun_alt}°</td>
                    <td>${r.az_diff}°</td>
                    <td>${r.alt_diff}°</td>
                    <td>${r.mode.substring(2)|| '-'}</td>
                    <td>${r.sunrise}</td>
                    <td>${r.sunset}</td>
                    <td>${r.azRise}°</td>
                    <td>${r.azSet}°</td>
                    <td class="${r.note ? 'note' : ''}">${r.note || '-'}</td>
                </tr>
            `;
        }
        
        html += '</tbody></table>';
        resultsEl.innerHTML = html;
        
        statusEl.textContent = `完了: ${rows.length} 件のデータが見つかりました`;
        statusEl.style.background = '#d4edda';
        statusEl.style.borderColor = '#28a745';
        
        // CSVダウンロード機能を有効化
        downloadBtn.disabled = false;
        downloadBtn.onclick = () => {
            //downloadCSV(rows, `diamond_${mt.name.replace(/[^a-zA-Z0-9]/g, '_')}_${startDate.getFullYear()}_${startDate.getFullYear() + years - 1}.csv`);
            downloadCSV(rows, `diamond_${mt.name}_${startDate.getFullYear()}_${startDate.getFullYear() + years - 1}.csv`);
        };
        
        Utils.showInfo(`期間検索完了: ${rows.length} 件`);
        
    } catch (error) {
        console.error('期間検索エラー:', error);
        if (newWindow && newWindow.document) {
            const statusEl = newWindow.document.getElementById('status');
            if (statusEl) {
                statusEl.textContent = 'エラーが発生しました: ' + error.message;
                statusEl.style.background = '#f8d7da';
            }
        }
        Utils.showError('期間検索中にエラーが発生しました');
    }
}

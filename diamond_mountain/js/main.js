// メインロジックとUIイベント処理

window.addEventListener('load', function() {
    // 日付の初期化(今日)
    document.getElementById('startDate').value = Utils.getTodayString();
    
    // 山の選択メニューを初期化
    initializeMountainSelector();

    // Leafletの読み込みチェック
    if (typeof L === 'undefined') {
        Utils.showError('Leaflet が読み込まれていません。ネットワーク接続を確認してください。');
        return;
    }

    // ===== Leaflet地図の初期化 =====
    const map = L.map('map').setView(
        [CONSTANTS.MAP.INITIAL_CENTER.lat, CONSTANTS.MAP.INITIAL_CENTER.lon], 
        CONSTANTS.MAP.INITIAL_ZOOM
    );
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // レイヤーグループ(グローバルに保存)
    window.visLayer = L.layerGroup().addTo(map);
    window.sampleLayer = L.layerGroup().addTo(map);

    // ===== ヘルパー関数: 入力値を取得 =====
    function getInputValues() {
        return {
            startDateStr: document.getElementById('startDate').value,
            years: Number(document.getElementById('years').value),
            azTol: Number(document.getElementById('azTol').value),
            elTol: Number(document.getElementById('elTol').value),
            groundInput: Number(document.getElementById('obsElev').value) || 0,
            selectedKey: document.getElementById('mountain').value
        };
    }

    // ===== ヘルパー関数: 山の検証と取得 =====
    function getSelectedMountain(selectedKey) {
        if (!selectedKey || !mountains[selectedKey]) {
            Utils.showInfo(CONSTANTS.UI.ERROR_NO_MOUNTAIN);
            return null;
        }
        return mountains[selectedKey];
    }

    // ===== ヘルパー関数: 山マーカーを更新 =====
    function updateMountainMarker(map, mt) {
        if (window.mtMarker) window.mtMarker.remove();
        window.mtMarker = L.marker([mt.lat, mt.lon])
            .addTo(map)
            .bindPopup(
                `<div style="text-align:center"><strong>${mt.name}</strong><br/>標高 ${mt.h}m</div>`, 
                { className: 'mountain-popup' }
            )
            .openPopup();
    }

	// ===== ヘルパー関数: 詳細な太陽-山アライメント検索(クリック時用) =====
	function findDetailedAlignment(lat, lon, startDate, years, azTol, elTol, ba) {
		const endDate = new Date(startDate);
		endDate.setFullYear(endDate.getFullYear() + years);
		const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
		const stepMin = CONSTANTS.SEARCH.TIME_STEP_MINUTES_CLICK || CONSTANTS.SEARCH.TIME_STEP_MINUTES;

		// 朝日・夕日の時間帯
		const SUNSET_HOURS = { start: 15, end: 18 }; // 下降中
		const SUNRISE_HOURS = { start: 4, end: 8 };  // 上昇中

		// 内部検索
		function runPass(mode, hours) {
			let firstMatch = null;
			let lastMatch = null;
			let bestMatch = null;
			let bestError = Infinity;

			for (let day = 0; day < totalDays; day++) {
				const currentDate = new Date(startDate);
				currentDate.setDate(currentDate.getDate() + day);

				const Y = currentDate.getFullYear();
				const M = currentDate.getMonth();
				const D = currentDate.getDate();

				let dayHasMatch = false;
				let prevAlt = null;

				for (let hh = hours.start; hh <= hours.end; hh++) {
					for (let mm = 0; mm < 60; mm += stepMin) {
						const dt = new Date(Y, M, D, hh, mm, 0);
						const pos = sunAltAzLocal(lat, lon, dt, CONSTANTS.JST_OFFSET);

						if (pos.alt < CONSTANTS.SEARCH.MIN_SUN_ALTITUDE) {
							prevAlt = pos.alt;
							continue;
						}

						const azDiff = angleDiff(pos.az, ba.bearing);
						const elDiff = Math.abs(pos.alt - ba.elev);

						if (azDiff <= azTol && elDiff <= elTol) {
							let trendOk = true;

							if (mode === 'sunset') trendOk = (prevAlt === null) ? true : (pos.alt < prevAlt);
							if (mode === 'sunrise') trendOk = (prevAlt === null) ? true : (pos.alt > prevAlt);

							if (trendOk) {
								dayHasMatch = true;

								const totalError = azDiff + elDiff;

								if (!firstMatch) firstMatch = { dt, pos, mode };
								lastMatch = { dt, pos, mode };

								if (totalError < bestError) {
									bestError = totalError;
									bestMatch = { dt, pos, mode };
								}
							}
						}

						prevAlt = pos.alt;
					}
				}

				if (firstMatch && !dayHasMatch) break;
			}

			return { firstMatch, lastMatch, bestMatch };
		}

		// 1. 夕日（下降）を先に探索
		let res = runPass('sunset', SUNSET_HOURS);
		if (res.firstMatch) {
			res.firstMatch.mode = 'sunset';
			res.lastMatch.mode = 'sunset';
			res.bestMatch.mode = 'sunset';
			return res;
		}

		// 2. 朝日（上昇）を探索
		res = runPass('sunrise', SUNRISE_HOURS);
		if (res.firstMatch) {
			res.firstMatch.mode = 'sunrise';
			res.lastMatch.mode = 'sunrise';
			res.bestMatch.mode = 'sunrise';
		}

		return res;
	}



    // ===== イベントリスナー: 可視領域計算ボタン =====
    document.getElementById('run').addEventListener('click', async () => {
        window.visLayer.clearLayers();
        window.sampleLayer.clearLayers();

        const inputs = getInputValues();
        
        if (!inputs.startDateStr) {
            Utils.showInfo(CONSTANTS.UI.ERROR_NO_DATE);
            return;
        }

        const mt = getSelectedMountain(inputs.selectedKey);
        if (!mt) return;

        const startDate = new Date(inputs.startDateStr);

        // 山マーカーと地図移動
        updateMountainMarker(map, mt);
        const view = getViewCenterFromMountain(mt);
        map.setView([view.lat, view.lon], view.zoom);

        // 総観測高度
        const totalObsElev = inputs.groundInput + lastTerrainElevation;

        const opt = {
            startDate: startDate,
            years: inputs.years,
            azTol: inputs.azTol,
            elTol: inputs.elTol,
            obsElev: totalObsElev,
            mountKey: inputs.selectedKey,
            step_km: CONSTANTS.SEARCH.GRID_STEP_KM
        };

        Utils.showInfo(
            `${CONSTANTS.UI.CALCULATION_MESSAGE} ${mt.name} の可視領域(${inputs.years}年間、総観測高度 ${Utils.formatNumber(totalObsElev, 1)}m)`
        );

        try {
            const res = await computeVisibility(opt);
            Utils.showInfo(`計算完了: ${res.length} 個の候補地点を検出(${mt.name})`);
        } catch (e) {
            console.error(e);
            Utils.showError('計算中にエラーが発生しました。');
        }
    });

    // ===== イベントリスナー: 山選択時の地図移動 =====
    document.getElementById('mountain').addEventListener('change', function() {
        const mt = getSelectedMountain(this.value);
        if (!mt) return;

        const view = getViewCenterFromMountain(mt);
        map.flyTo([view.lat, view.lon], view.zoom, { duration: 1.2 });

        // マーカーも即座に更新
        updateMountainMarker(map, mt);
    });

    // ===== イベントリスナー: 地図クリック =====
    map.on('click', async e => {
        const inputs = getInputValues();
        const mt = getSelectedMountain(inputs.selectedKey);
        
        if (!mt) {
            alert(CONSTANTS.UI.ERROR_SELECT_MOUNTAIN_FIRST);
            return;
        }

        const startDate = new Date(inputs.startDateStr);
        const lat = e.latlng.lat.toFixed(6);
        const lon = e.latlng.lng.toFixed(6);

        // 標高取得中表示
        Utils.showInfo(CONSTANTS.UI.DATE_LOAD_MESSAGE);

        // 国土地理院APIで標高取得
        const elevData = await getElevation(e.latlng.lat, e.latlng.lng);
        const terrainElev = elevData.elevation;
        lastTerrainElevation = terrainElev;
        const totalObsElev = inputs.groundInput + terrainElev;

        // 山に対する方位・仰角を計算
        const ba = bearingAndApparentElevation(
            e.latlng.lat, e.latlng.lng, totalObsElev,
            mt.lat, mt.lon, mt.h
        );

        // 詳細な太陽-山アライメント検索
		const alignRes = findDetailedAlignment(
			e.latlng.lat, e.latlng.lng, startDate, inputs.years,
			inputs.azTol, inputs.elTol, ba
		);
		const { firstMatch, lastMatch, bestMatch, matchedMode } = alignRes;


        // ポップアップ内容作成
        let s = `観測地: 北緯 ${lat}°, 東経 ${lon}°\n`;
        s += `地形標高: ${Utils.formatNumber(terrainElev, 1)}m\n`;
		/*
        s += `+地表からの高さ: ${inputs.groundInput}m\n`;
        s += `=総観測高度: ${Utils.formatNumber(totalObsElev, 1)}m\n`;
		*/
        s += `山の方位: ${Utils.formatNumber(ba.bearing, 3)}°  仰角: ${Utils.formatNumber(ba.elev, 3)}°\n`;

        if (firstMatch) {
			const mode = bestMatch?.mode || matchedMode;
			const modeLabel = (mode === 'sunrise') ? '（朝日）' :
							  (mode === 'sunset')  ? '（夕日）' : '';

			const days = Utils.daysBetween(firstMatch.dt, lastMatch.dt);

			s += `\n直近のダイヤモンド発生可能期間 ${modeLabel}\n`;

			/*
			const modeLabel = (matchedMode === 'sunrise') ? '（朝日）' : (matchedMode === 'sunset' ? '（夕日）' : '');
			const days = Utils.daysBetween(firstMatch.dt, lastMatch.dt);

			s += `\n直近のダイヤモンド発生可能期間 ${modeLabel}\n`;
			*/
			s += `BEGIN: ${Utils.formatDate(firstMatch.dt)}\n`;
			s += `END:   ${Utils.formatDate(lastMatch.dt)}\n`;
			s += `期間: ${days}日間(連続)\n\n`;

            s += `ベストマッチ(この期間内)\n`;
            s += `MATCH: ${Utils.formatDate(bestMatch.dt)}\n`;
            s += `  太陽方位 ${Utils.formatNumber(bestMatch.pos.az)}°  高度 ${Utils.formatNumber(bestMatch.pos.alt)}°`;
        } else {
            s += '\n指定期間内で条件を満たす日はありません';
        }

        Utils.showInfo(`総観測高度 ${Utils.formatNumber(totalObsElev, 1)}m で計算`);

        L.popup()
            .setLatLng(e.latlng)
            .setContent(`<pre style="font-size:13px;line-height:1.4">${s}</pre>`)
            .openOn(map);
    });

    // ===== イベントリスナー: クリアボタン =====
    document.getElementById('clear').addEventListener('click', () => {
        window.visLayer.clearLayers();
        window.sampleLayer.clearLayers();
        Utils.showInfo(CONSTANTS.UI.CLEAR_MESSAGE);
    });
});

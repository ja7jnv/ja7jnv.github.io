// 可視領域計算関連

function getViewCenterFromMountain(mt, kmEast = CONSTANTS.MAP.MOUNTAIN_VIEW_OFFSET_KM) {
    const lonOffset = kmEast / (CONSTANTS.KM_PER_DEGREE_LAT * Math.cos(deg2rad(mt.lat)));
    return {
        lat: mt.lat,
        lon: mt.lon + lonOffset,
        zoom: CONSTANTS.MAP.INITIAL_ZOOM
    };
}

/**
 * 時間帯を外から与える版（sunrise/sunset 共通）
 */
function findSunMountainAlignment(lat, lon, startDate, years, azTol, elTol, ba, timeWindow, mode) {

    const endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + years);

    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

    for (let day = 0; day < totalDays; day++) {

        const currentDate = new Date(startDate);
        currentDate.setDate(currentDate.getDate() + day);

        const Y = currentDate.getFullYear();
        const M = currentDate.getMonth();
        const D = currentDate.getDate();

        for (let hh = timeWindow.start; hh <= timeWindow.end; hh++) {
            for (let mm = 0; mm < 60; mm += CONSTANTS.SEARCH.TIME_STEP_MINUTES) {

                const dt = new Date(Y, M, D, hh, mm, 0);
                const pos = sunAltAzLocal(lat, lon, dt, CONSTANTS.JST_OFFSET);

                if (pos.alt < CONSTANTS.SEARCH.MIN_SUN_ALTITUDE) continue;

                const azDiff = angleDiff(pos.az, ba.bearing);
                const elDiff = Math.abs(pos.alt - ba.elev);

                if (azDiff <= azTol && elDiff <= elTol) {
                    return {
                        date: dt,
                        az: pos.az,
                        alt: pos.alt,
                        mode: mode   // sunrise / sunset を記録
                    };
                }
            }
        }
    }
    return null;
}

/**
 * 可視領域計算
 */
async function computeVisibility(opts) {

    if (window.visLayer) window.visLayer.clearLayers();
    if (window.sampleLayer) window.sampleLayer.clearLayers();

    const startDate = opts.startDate;
    const years = parseInt(opts.years, 10);
    const azTol = parseFloat(opts.azTol);
    const elTol = parseFloat(opts.elTol);
    const obsElev = parseFloat(opts.obsElev);
    const mt = mountains[opts.mountKey];

    const Rkm = CONSTANTS.SEARCH.RADIUS_KM;
    const step_km = opts.step_km || CONSTANTS.SEARCH.GRID_STEP_KM;

    const lat_km = CONSTANTS.KM_PER_DEGREE_LAT;
    const lon_km_at_lat = CONSTANTS.KM_PER_DEGREE_LAT * Math.cos(deg2rad(mt.lat));

    const dlat = Rkm / lat_km;
    const dlon = Rkm / lon_km_at_lat;

    const lat_min = mt.lat - dlat;
    const lat_max = mt.lat + dlat;
    const lon_min = mt.lon - dlon;
    const lon_max = mt.lon + dlon;

    const lat_step = step_km / lat_km;
    const lon_step = step_km / lon_km_at_lat;

    const results = [];

    for (let lat = lat_min; lat <= lat_max; lat += lat_step) {
        for (let lon = lon_min; lon <= lon_max; lon += lon_step) {

            const ba = bearingAndApparentElevation(lat, lon, obsElev, mt.lat, mt.lon, mt.h);

            // まず夕日（西側）
            let bearingOK_sunset = (ba.bearing >= 150 && ba.bearing <= 360);

            // 朝日（東側）
            let bearingOK_sunrise = (ba.bearing >= 45 && ba.bearing <= 135);

            let match = null;

            // 夕日
            if (bearingOK_sunset) {
                match = findSunMountainAlignment(
                    lat, lon, startDate, years, azTol, elTol, ba,
                    { start: 15, end: 18 }, "sunset"
                );
            }

            // 朝日（夕日が見つからなかった場合）
            if (!match && bearingOK_sunrise) {
                match = findSunMountainAlignment(
                    lat, lon, startDate, years, azTol, elTol, ba,
                    { start: 4, end: 8 }, "sunrise"
                );
            }

            if (match) {
                results.push({
                    lat, lon,
                    bearing: ba.bearing,
                    elev: ba.elev,
                    match: match
                });
            }
        }
    }

    // 描画
    for (const r of results) {
        const c = L.circle([r.lat, r.lon], {
            radius: CONSTANTS.MAP.VISIBILITY_CIRCLE_RADIUS_M,
            color: (r.match.mode === "sunrise" ? "#0088ff" : "#ff8800"),
            fill: true,
            fillOpacity: 0.5
        }).addTo(window.visLayer);

        const dateStr = Utils.formatDateSimple(r.match.date);
        const label = r.match.mode === "sunrise" ? "朝日" : "夕日";

        c.bindPopup(
            `${label} ダイヤモンド発生\n${dateStr}\n\n` +
            `太陽方位: ${Utils.formatNumber(r.match.az)}°  高度: ${Utils.formatNumber(r.match.alt)}°\n` +
            `山の方位: ${Utils.formatNumber(r.bearing)}°  仰角: ${Utils.formatNumber(r.elev)}°`,
            { maxWidth: 500 }
        );
    }

    return results;
}


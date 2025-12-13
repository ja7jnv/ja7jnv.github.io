document.getElementById('period').addEventListener('click', async () => {
  const mt = getSelectedMountain(inputs.selectedKey);
  const obsEleElem = document.getElementById('obs_elevation').value.trim();
  const obsH = obsEleElem === '' ? (80) : Number(obsEleElem);
  const startdate = document.getElementById('startdate').value;
  const tz = CONSTANTS.JST_OFFSET;
  const az_tol = parseFloat(document.getElementById('az_tol').value);
  const alt_tol = parseFloat(document.getElementById('alt_tol').value);
  const years = parseInt(document.getElementById('years').value, 10) || 5;
  const status = document.getElementById('status'); status.textContent = '処理中...'; status.style.color='black';
  document.getElementById('results').innerHTML = ''; document.getElementById('summary').innerHTML='';

  if (!startdate) { alert('開始日を選んでください'); status.textContent=''; return; }
  const start = new Date(startdate + 'T00:00:00');

  // target mountain (Chokai Shichikosan)
  const mtLat = 39.09945869580092;
  const mtLon = 140.0513154997461;
  const mtH = 2230.0;
  // const obsH = 80.0;

  // compute target bearing/elev
  const be = bearingAndElevation(lat, lon, obsH, mtLat, mtLon, mtH);
  const targetAz = be.bearing;
  const targetElev = be.elevation;
  const distKm = be.distance_m / 1000;

  const summary = document.getElementById('summary');
  summary.innerHTML = `<strong>鳥海山方向</strong>　方位=${targetAz.toFixed(6)}°　山頂見かけ仰角=${targetElev.toFixed(6)}°　距離=${distKm.toFixed(2)} km　観測地点標高=${obsH.toFixed(2)} m`;

  // scan for years
  const rows = [];
  const endYear = start.getFullYear() + years - 1;

  // coarse step (minutes) and refinement window
  const coarseStep = 5; // min
  const refineWindowMin = 20; // ± minutes
  const refineStep = 1; // 1 minute

  // Loop years
  for (let Y = start.getFullYear(); Y <= endYear; Y++) {
    // choose starting day: if Y == start.year, start at start date; otherwise Jan 1
    const startDay = (Y === start.getFullYear()) ? new Date(start) : new Date(Y,0,1,0,0,0);
    const endDay = new Date(Y,11,31,23,59,59);

    let candidates = [];
    // coarse scan full year in local clock time
    for (let dt = new Date(startDay); dt <= endDay; dt = new Date(dt.getTime() + coarseStep*60000)) {
      const s = sunAltAz(lat, lon, dt, tz);
      const azDiff = angleDiff(s.az, targetAz);
      const altDiff = Math.abs(s.alt - targetElev);
      if (azDiff <= Math.max(1.0, az_tol*2) && altDiff <= Math.max(1.0, alt_tol*2)) {
        candidates.push(new Date(dt));
      }
    }

    // refine each candidate
    const foundThisYear = [];
    const seen = new Set();
    for (const base of candidates) {
      for (let m = -refineWindowMin; m <= refineWindowMin; m += refineStep) {
        const t = new Date(base.getTime() + m*60000);
        const s = sunAltAz(lat, lon, t, tz);
        const azDiff = angleDiff(s.az, targetAz);
        const altDiff = Math.abs(s.alt - targetElev);
        if (azDiff <= az_tol && altDiff <= alt_tol) {
          const key = `${t.toISOString().slice(0,10)} ${t.getHours().toString().padStart(2,'0')}:${t.getMinutes().toString().padStart(2,'0')}`;
          if (!seen.has(key)) {
            seen.add(key);
            foundThisYear.push({
              year: Y,
              date: t.toISOString().slice(0,10),
              time: t.getHours().toString().padStart(2,'0') + ':' + t.getMinutes().toString().padStart(2,'0'),
              sun_az: s.az.toFixed(3),
              sun_alt: s.alt.toFixed(3),
              az_diff: azDiff.toFixed(3),
              alt_diff: (s.alt - targetElev).toFixed(3)
            });
          }
        }
      }
    }

    if (foundThisYear.length > 0) {
      // append sorted by date/time
      foundThisYear.sort((a,b) => (a.date + ' ' + a.time) < (b.date + ' ' + b.time) ? -1 : 1);
      for (const r of foundThisYear) rows.push(r);
    } else {
      // find closest moment of year (coarse then refine)
      // coarse best by metric = azDiff + |altDiff|
      let best = null, bestScore = 1e9;
      for (let dt = new Date(startDay); dt <= endDay; dt = new Date(dt.getTime() + 10*60000)) {
        const s = sunAltAz(lat, lon, dt, tz);
        const azDiff = angleDiff(s.az, targetAz);
        const altDiff = Math.abs(s.alt - targetElev);
        const score = azDiff + altDiff;
        if (score < bestScore) { bestScore = score; best = new Date(dt); }
      }
      // refine ±60 min
      let bestRef = null; bestScore = 1e9;
      for (let m = -60; m <= 60; m++) {
        const t = new Date(best.getTime() + m*60000);
        const s = sunAltAz(lat, lon, t, tz);
        const azDiff = angleDiff(s.az, targetAz);
        const altDiff = Math.abs(s.alt - targetElev);
        const score = azDiff + altDiff;
        if (score < bestScore) { bestScore = score; bestRef = {t, s, score}; }
      }
      const t = bestRef.t;
      rows.push({
        year: Y,
        date: t.toISOString().slice(0,10),
        time: t.getHours().toString().padStart(2,'0') + ':' + t.getMinutes().toString().padStart(2,'0'),
        sun_az: bestRef.s.az.toFixed(3),
        sun_alt: bestRef.s.alt.toFixed(3),
        az_diff: angleDiff(bestRef.s.az, targetAz).toFixed(3),
        alt_diff: (bestRef.s.alt - targetElev).toFixed(3),
        note: 'この年にダイヤモンド現象はないが最も近いパターン'
      });
    }
  }

  // show results in table
  const resDiv = document.getElementById('results');
  if (rows.length === 0) {
    resDiv.innerHTML = '<p>該当なし。</p>';
    status.textContent = ''; document.getElementById('download').disabled = true;
    return;
  }
  let html = '<table><thead><tr><th>年</th><th>日付</th><th>時刻(現地)</th><th>太陽方位</th><th>太陽高度</th><th>Δ方位</th><th>Δ仰角</th><th>備考</th></tr></thead><tbody>';
  for (const r of rows) {
    html += `<tr><td>${r.year}</td><td>${r.date}</td><td>${r.time}</td><td>${r.sun_az}</td><td>${r.sun_alt}</td><td>${r.az_diff}</td><td>${r.alt_diff}</td><td>${r.note||''}</td></tr>`;
  }
  html += '</tbody></table>';
  resDiv.innerHTML = html;
  status.textContent = `完了（${rows.length} 件）`; status.style.color='green';

  // enable download
  document.getElementById('download').disabled = false;
  document.getElementById('download').onclick = () => downloadCSV(rows, `diamond_chokai_${start.getFullYear()}_${endYear}.csv`);
});



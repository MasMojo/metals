(function () {
  const chartEl = document.getElementById("chart");
  if (!chartEl || !window.LightweightCharts) return;

  const seriesSel = document.getElementById("series");
  const rangeBtns = document.querySelectorAll("[data-range]");
  const modeBtns = document.querySelectorAll("[data-mode]");
  const attrib = document.getElementById("chart-attrib");
  const titleEl = document.getElementById("chart-title");
  const realToggle = document.getElementById("real-toggle");
  const realWrap = document.getElementById("real-toggle-wrap");
  const cpiLag = document.getElementById("cpi-lag");

  const cache = {};
  let chart, series, mode = "price", range = "1Y", currentId = "xau";
  let realMode = false;

  const RANGE_MS = {
    "1W": 7, "1M": 31, "3M": 93, "1Y": 366, "5Y": 366 * 5, "ALL": 365000,
  };

  function themeColors() {
    const light = Mojo.currentTheme() === "light";
    return {
      layout: { background: { color: "transparent" }, textColor: light ? "#1c1912" : "#f3ebd4" },
      grid: { vertLines: { color: light ? "#e0d6bf" : "#2a2f24" }, horzLines: { color: light ? "#e0d6bf" : "#2a2f24" } },
      rightPriceScale: { borderColor: light ? "#c9b894" : "#3a4032" },
      timeScale: { borderColor: light ? "#c9b894" : "#3a4032" },
      line: light ? "#8d6a16" : "#e2b857",
      cpi: light ? "#6b6253" : "#a39a86",
    };
  }

  function ensureChart() {
    if (chart) return chart;
    const c = themeColors();
    chart = LightweightCharts.createChart(chartEl, {
      ...c,
      autoSize: true,
      handleScroll: true,
      handleScale: true,
    });
    series = chart.addLineSeries({ color: c.line, lineWidth: 2 });
    document.addEventListener("themechange", () => {
      const t = themeColors();
      chart.applyOptions({ layout: t.layout, grid: t.grid, rightPriceScale: t.rightPriceScale, timeScale: t.timeScale });
      series.applyOptions({ color: t.line });
      render();
    });
    return chart;
  }

  async function loadSeries(id) {
    if (cache[id]) return cache[id];
    const doc = await Mojo.fetchJson("data/history/" + id + ".json", { timeout: 20000 });
    cache[id] = doc;
    return doc;
  }

  function toLine(points, intraday) {
    const rows = (points || []).map((p) => {
      const iso = String(p.t);
      const value = Number(p.price);
      const ms = Date.parse(iso.endsWith("Z") || iso.includes("+") || iso.includes("T") ? iso : iso + "T00:00:00Z");
      return { iso, ms, value, grain: p.grain, source: p.source };
    }).filter((p) => !Number.isNaN(p.value) && !Number.isNaN(p.ms));
    rows.sort((a, b) => a.ms - b.ms);
    if (intraday) {
      const out = [];
      let last = -1;
      for (const r of rows) {
        const time = Math.floor(r.ms / 1000);
        if (time === last) out[out.length - 1].value = r.value;
        else out.push({ time, value: r.value, grain: r.grain });
        last = time;
      }
      return out;
    }
    const by = new Map();
    for (const r of rows) {
      const day = r.iso.slice(0, 10);
      // A daily observation on the same calendar date wins over a monthly average.
      const prev = by.get(day);
      if (prev && prev.grain === "daily" && r.grain === "monthly") continue;
      by.set(day, { time: day, value: r.value, grain: r.grain });
    }
    return [...by.values()];
  }

  function filterRange(data, key) {
    if (key === "ALL" || !data.length) return data;
    const last = data[data.length - 1].time;
    const lastMs = typeof last === "number" ? last * 1000 : Date.parse(String(last) + (String(last).length === 10 ? "T00:00:00Z" : ""));
    const startMs = lastMs - RANGE_MS[key] * 86400000;
    const sliced = data.filter((p) => {
      const ms = typeof p.time === "number" ? p.time * 1000 : Date.parse(String(p.time) + "T00:00:00Z");
      return ms >= startMs;
    });
    return sliced.length ? sliced : data.slice(-2);
  }

  function rebaseMany(mapOfSeries, startDate) {
    const out = {};
    for (const [id, data] of Object.entries(mapOfSeries)) {
      const first = data.find((p) => p.time >= startDate && p.value);
      if (!first) continue;
      out[id] = data.filter((p) => p.time >= startDate).map((p) => ({ time: p.time, value: (p.value / first.value) * 100 }));
    }
    return out;
  }

  function alignRatio(a, b) {
    const mapB = new Map(b.map((p) => [p.time, p.value]));
    const out = [];
    for (const p of a) {
      const o = mapB.get(p.time);
      if (o) out.push({ time: p.time, value: p.value / o });
    }
    return out;
  }

  function cpiAtFn(cpiLine) {
    const pts = (cpiLine || []).slice().sort((a, b) => (a.time < b.time ? -1 : 1));
    return function at(time) {
      const d = String(time).slice(0, 10);
      if (d.length < 10) return null;
      let lo = 0, hi = pts.length - 1, ans = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (String(pts[mid].time).slice(0, 10) <= d) { ans = mid; lo = mid + 1; }
        else hi = mid - 1;
      }
      return ans >= 0 ? pts[ans].value : null;
    };
  }

  function toRealDollars(data, cpiAt, endCpi) {
    if (!endCpi) return data;
    const out = [];
    for (const p of data) {
      const c = cpiAt(p.time);
      if (!c) continue;
      out.push({ time: p.time, value: p.value * (endCpi / c), grain: p.grain });
    }
    return out;
  }

  const COLORS = {
    xau: "#e2b857", xag: "#c0c7d1", xpt: "#7db7d4", xpd: "#c989b2",
    hg: "#d07a4a", btc: "#f4a83a", eth: "#7f9cf5",
    gs: "#e2b857", bg: "#f4a83a", cpi: "#8a8374",
  };

  let extraSeries = [];

  function clearExtras() {
    for (const s of extraSeries) chart.removeSeries(s);
    extraSeries = [];
  }

  function setIndexChrome(show) {
    if (realWrap) realWrap.hidden = !show;
    if (cpiLag) cpiLag.hidden = !show;
  }

  function cpiLagText(cpiDoc) {
    const latest = cpiDoc && cpiDoc.latest;
    const label = latest && latest.label ? latest.label : "the latest published month";
    return "CPI-U (FRED CPIAUCSL, seasonally adjusted, 1982–84=100) is a monthly series and lags: the latest observation in this file is "
      + label
      + ". BLS typically publishes around the middle of the following month. Daily prices after that month reuse the last available CPI until a new month is posted.";
  }

  async function render() {
    ensureChart();
    const ph = document.getElementById("chart-placeholder");
    if (ph) ph.remove();
    clearExtras();
    const c = themeColors();
    setIndexChrome(mode === "index");

    if (mode === "price") {
      const doc = await loadSeries(currentId);
      const data = filterRange(toLine(doc.points, range === "1W" || range === "1M"), range);
      series.applyOptions({ color: COLORS[currentId] || c.line, title: doc.symbol || currentId });
      series.setData(data);
      chart.timeScale().fitContent();
      let title = (doc.name || currentId) + " price";
      if (currentId === "hg") title = "Copper price (monthly global average + daily last)";
      if (titleEl) titleEl.textContent = title;
      if (attrib) attrib.textContent = [doc.attribution || doc.source, doc.frequency_note, doc.source_url].filter(Boolean).join(" — ");
      return;
    }

    if (mode === "gs" || mode === "bg") {
      const a = await loadSeries(mode === "gs" ? "xau" : "btc");
      const b = await loadSeries(mode === "gs" ? "xag" : "xau");
      const intra = range === "1W" || range === "1M";
      const data = filterRange(alignRatio(toLine(a.points, intra), toLine(b.points, intra)), range);
      series.applyOptions({ color: COLORS[mode] || c.line, title: mode === "gs" ? "XAU/XAG" : "BTC/XAU" });
      series.setData(data);
      chart.timeScale().fitContent();
      if (titleEl) titleEl.textContent = mode === "gs" ? "Gold / silver ratio" : "BTC / gold (oz gold per BTC)";
      if (attrib) attrib.textContent = "Gold & silver history: Data by Standard Bullion — https://standardbullion.com. Bitcoin: CoinGecko.";
      return;
    }

    // Performance index: rebase selected assets (and optional CPI overlay) to 100
    const ids = ["xau", "xag", "xpt", "xpd", "hg", "btc", "eth"];
    const loaded = {};
    for (const id of ids) {
      try { loaded[id] = toLine((await loadSeries(id)).points); } catch (e) { /* skip */ }
    }
    let cpiDoc = null;
    try { cpiDoc = await loadSeries("cpi"); } catch (e) { /* optional */ }
    const cpiLine = cpiDoc ? toLine(cpiDoc.points) : [];
    const cpiAt = cpiAtFn(cpiLine);
    const endCpi = cpiLine.length ? cpiLine[cpiLine.length - 1].value : null;

    const ranged = {};
    for (const [id, data] of Object.entries(loaded)) ranged[id] = filterRange(data, range);
    const firsts = Object.entries(ranged)
      .filter(([id]) => id !== "hg") // copper monthly starts 1992; don't let it pin the window
      .map(([, d]) => d[0] && d[0].time)
      .filter(Boolean);
    let start = firsts.length ? firsts.sort()[firsts.length - 1] : "1900-01-01";

    const adjusted = {};
    for (const [id, data] of Object.entries(ranged)) {
      adjusted[id] = realMode ? toRealDollars(data, cpiAt, endCpi) : data;
    }
    const rebased = rebaseMany(adjusted, start);
    series.setData([]);
    series.applyOptions({ color: "transparent", title: "" });
    for (const [id, data] of Object.entries(rebased)) {
      if (!data.length) continue;
      const s = chart.addLineSeries({ color: COLORS[id], lineWidth: 2, title: id.toUpperCase() });
      s.setData(data);
      extraSeries.push(s);
    }

    if (!realMode && cpiLine.length && endCpi) {
      const times = new Set();
      for (const data of Object.values(rebased)) data.forEach((p) => times.add(p.time));
      const grid = [...times].sort();
      const firstCpi = cpiAt(start);
      if (firstCpi && grid.length) {
        const cpiReb = grid.map((t) => {
          const v = cpiAt(t);
          return v ? { time: t, value: (v / firstCpi) * 100 } : null;
        }).filter(Boolean);
        const dash = (window.LightweightCharts && LightweightCharts.LineStyle)
          ? LightweightCharts.LineStyle.Dashed
          : 2;
        const s = chart.addLineSeries({
          color: c.cpi || COLORS.cpi,
          lineWidth: 2,
          lineStyle: dash,
          title: "CPI",
        });
        s.setData(cpiReb);
        extraSeries.push(s);
      }
    }

    chart.timeScale().fitContent();
    if (titleEl) {
      titleEl.textContent = realMode
        ? "Performance index, real (inflation-adjusted), rebased to 100"
        : "Performance index (rebased to 100)";
    }
    if (attrib) {
      attrib.textContent = realMode
        ? "Real series = nominal × (latest CPI / CPI at that date), then rebased to 100. Metals: Data by Standard Bullion — https://standardbullion.com. BTC & ETH: CoinGecko. Copper: FRED PCOPPUSDM monthly (global $/mt → $/lb) plus Gold API daily snapshots. CPI: FRED CPIAUCSL (BLS)."
        : "Nominal series rebased to 100 at the start of the window. Dashed line is CPI-U, also rebased to 100. Metals: Data by Standard Bullion — https://standardbullion.com. BTC & ETH: CoinGecko. Copper: FRED PCOPPUSDM monthly (global $/mt → $/lb) plus Gold API daily snapshots. CPI: FRED CPIAUCSL (BLS).";
    }
    if (cpiLag) cpiLag.textContent = cpiLagText(cpiDoc);
  }

  seriesSel?.addEventListener("change", () => { currentId = seriesSel.value; render(); });
  rangeBtns.forEach((btn) => btn.addEventListener("click", () => {
    range = btn.dataset.range;
    rangeBtns.forEach((b) => b.setAttribute("aria-pressed", b === btn ? "true" : "false"));
    render();
  }));
  modeBtns.forEach((btn) => btn.addEventListener("click", () => {
    mode = btn.dataset.mode;
    modeBtns.forEach((b) => b.setAttribute("aria-pressed", b === btn ? "true" : "false"));
    if (seriesSel) seriesSel.disabled = mode !== "price";
    render();
  }));
  realToggle?.addEventListener("change", () => {
    realMode = !!realToggle.checked;
    render();
  });

  if (seriesSel) currentId = seriesSel.value;
  render().catch((e) => {
    const p = document.getElementById("chart-placeholder");
    if (p) p.textContent = "Could not load history: " + e.message;
  });
})();

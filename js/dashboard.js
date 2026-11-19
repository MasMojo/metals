(function () {
  const root = document.getElementById("quotes");
  const ratioRoot = document.getElementById("ratios");
  const statusEl = document.getElementById("market-status");
  const updatedEl = document.getElementById("last-updated");
  const errEl = document.getElementById("feed-error");
  if (!root) return;

  function changeLine(q) {
    if (q.changeToday && q.changeToday.percent != null) {
      const cls = Mojo.chgClass(q.changeToday.percent);
      const amt = q.changeToday.amount != null ? " (" + Mojo.formatMoney(q.changeToday.amount, q._chgDigits) + ")" : "";
      const label = q.changeToday.label || "Today";
      return `<div class="chg ${cls}">${label} ${Mojo.formatPct(q.changeToday.percent)}${amt}</div>`;
    }
    if (q.change24h && q.change24h.percent != null) {
      const cls = Mojo.chgClass(q.change24h.percent);
      return `<div class="chg ${cls}">24h ${Mojo.formatPct(q.change24h.percent)}</div>`;
    }
    if (q.changeTodayMissing) return `<div class="chg flat">${q.changeTodayMissing}</div>`;
    return `<div class="chg flat">Day change n/a</div>`;
  }

  function ranges(q) {
    if (!q.changes) return "";
    const c = q.changes;
    const bits = [];
    if (c["1w"] != null) bits.push(`1W ${Mojo.formatPct(c["1w"])}`);
    if (c["1m"] != null) bits.push(`1M ${Mojo.formatPct(c["1m"])}`);
    if (c["1y"] != null) bits.push(`1Y ${Mojo.formatPct(c["1y"])}`);
    if (q.monthlyNote) bits.push(q.monthlyNote);
    return bits.length ? `<div class="sub">${bits.join(" · ")}</div>` : "";
  }

  function chicagoDate(date = new Date()) {
    const p = new Intl.DateTimeFormat("en-CA", { timeZone: Mojo.TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
    const get = (ty) => p.find((x) => x.type === ty)?.value;
    return get("year") + "-" + get("month") + "-" + get("day");
  }

  function pointDay(p) {
    return String(p.t || p.time || "").slice(0, 10);
  }

  let copperHist = null;

  function enrichCopper(q) {
    if (!q || !copperHist) return q;
    const pts = copperHist.points || [];
    const today = chicagoDate();
    const dailyPts = pts.filter((p) => p.grain === "daily" || ((p.source || "").includes("Gold API") && p.grain !== "monthly"));
    const use = dailyPts.length ? dailyPts : pts.filter((p) => p.grain !== "monthly");
    const prior = use.filter((p) => pointDay(p) && pointDay(p) < today);
    const prev = prior.length ? prior[prior.length - 1] : null;
    if (prev && q.price != null && !q.changeToday) {
      const prevPx = Number(prev.price);
      if (prevPx) {
        const amt = q.price - prevPx;
        q.changeToday = {
          amount: amt,
          percent: (amt / prevPx) * 100,
          label: "Today vs " + pointDay(prev) + " close",
        };
        q._chgDigits = 4;
      }
    } else if (!q.changeToday) {
      const start = use[0];
      const startDay = start ? pointDay(start) : null;
      q.changeTodayMissing = startDay
        ? "Day change n/a until a prior daily close (snapshots from " + startDay + ")"
        : "Day change n/a (need a prior daily close)";
    }
    const monthly = pts.filter((p) => p.grain === "monthly");
    if (monthly.length >= 2) {
      const a = monthly[monthly.length - 2];
      const b = monthly[monthly.length - 1];
      if (a.price && b.price) {
        const pct = ((b.price - a.price) / a.price) * 100;
        const label = (copperHist.latest_monthly && copperHist.latest_monthly.label) || pointDay(b).slice(0, 7);
        q.monthlyNote = "FRED MoM " + Mojo.formatPct(pct) + " (" + label + ", monthly global)";
      }
    }
    return q;
  }

  function render(snap) {
    const m = snap.market;
    if (statusEl) {
      statusEl.innerHTML = `<span class="dot ${m.open ? "open" : "closed"}"></span> ${m.label}`;
    }
    if (updatedEl) {
      updatedEl.textContent = snap.updated ? "Updated " + Mojo.formatChicago(snap.updated) : "Updating…";
    }
    if (errEl) {
      errEl.hidden = !snap.error;
      if (snap.error) errEl.textContent = "Feed issue: " + snap.error + " — retrying with backoff.";
    }

    root.innerHTML = MojoPrices.ASSETS.map((a) => {
      let q = snap.quotes[a.id] || { name: a.name, symbol: a.symbol };
      if (a.id === "hg") q = enrichCopper(Object.assign({}, q));
      const unit = a.id === "hg" ? "USD / lb" : a.kind === "crypto" ? "USD" : "USD / ozt";
      const bidask = q.bid != null && q.ask != null
        ? `<div class="bidask">Bid ${Mojo.formatMoney(q.bid)} · Ask ${Mojo.formatMoney(q.ask)}</div>`
        : `<div class="bidask">${q.error ? "Unavailable" : "Live last"}</div>`;
      return `<article class="card" data-asset="${a.id}">
        <div class="card-label">${q.name} <span class="muted">${q.symbol}</span></div>
        <div class="price">${Mojo.formatMoney(q.price, a.id === "hg" || a.id === "xag" ? 4 : 2)}</div>
        ${changeLine(q)}
        ${bidask}
        ${ranges(q)}
        <footer class="mini"><span>${unit}</span><span>${q.source || ""}</span></footer>
      </article>`;
    }).join("");

    if (ratioRoot) {
      const gs = snap.ratios.goldSilver;
      const bg = snap.ratios.btcGold;
      ratioRoot.innerHTML = `
        <article class="card ratio">
          <div class="card-label">Gold / Silver ratio</div>
          <div class="price">${gs ? Mojo.formatNum(gs, 2) : "—"}</div>
          <div class="sub">Ounces of silver per ounce of gold</div>
        </article>
        <article class="card ratio">
          <div class="card-label">BTC / Gold ratio</div>
          <div class="price">${bg ? Mojo.formatNum(bg, 3) : "—"}</div>
          <div class="sub">Ounces of gold per bitcoin</div>
        </article>`;
    }
  }

  MojoPrices.subscribe(render);
  Mojo.fetchJson("data/history/hg.json", { timeout: 20000 }).then((doc) => {
    copperHist = doc;
    // Re-render with whatever the latest snapshot already is.
    const snap = MojoPrices.getSnapshot && MojoPrices.getSnapshot();
    if (snap && snap.updated) render(snap);
  }).catch(() => { /* day change stays n/a */ });
  MojoPrices.start();
})();

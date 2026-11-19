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
      const amt = q.changeToday.amount != null ? " (" + Mojo.formatMoney(q.changeToday.amount) + ")" : "";
      return `<div class="chg ${cls}">Today ${Mojo.formatPct(q.changeToday.percent)}${amt}</div>`;
    }
    if (q.change24h && q.change24h.percent != null) {
      const cls = Mojo.chgClass(q.change24h.percent);
      return `<div class="chg ${cls}">24h ${Mojo.formatPct(q.change24h.percent)}</div>`;
    }
    return `<div class="chg flat">Day change n/a</div>`;
  }

  function ranges(q) {
    if (!q.changes) return "";
    const c = q.changes;
    const bits = [];
    if (c["1w"] != null) bits.push(`1W ${Mojo.formatPct(c["1w"])}`);
    if (c["1m"] != null) bits.push(`1M ${Mojo.formatPct(c["1m"])}`);
    if (c["1y"] != null) bits.push(`1Y ${Mojo.formatPct(c["1y"])}`);
    return bits.length ? `<div class="sub">${bits.join(" · ")}</div>` : "";
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
      const q = snap.quotes[a.id] || { name: a.name, symbol: a.symbol };
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
  MojoPrices.start();
})();

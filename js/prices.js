/* Live quotes: Gold API for last price, Standard Bullion for bid/ask + day change,
   CoinGecko for BTC/ETH 24h change. 60s refresh with backoff. */
(function (global) {
  const GOLD = "https://api.gold-api.com/price/";
  const SB = "https://standardbullion.com/spot-prices.json";
  const CG = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true";

  const ASSETS = [
    { id: "xau", symbol: "XAU", gold: "XAU", name: "Gold", unit: "oz", kind: "metal" },
    { id: "xag", symbol: "XAG", gold: "XAG", name: "Silver", unit: "oz", kind: "metal" },
    { id: "xpt", symbol: "XPT", gold: "XPT", name: "Platinum", unit: "oz", kind: "metal" },
    { id: "xpd", symbol: "XPD", gold: "XPD", name: "Palladium", unit: "oz", kind: "metal" },
    { id: "hg", symbol: "HG", gold: "HG", name: "Copper", unit: "lb", kind: "metal" },
    { id: "btc", symbol: "BTC", gold: "BTC", name: "Bitcoin", unit: "BTC", kind: "crypto", cg: "bitcoin" },
    { id: "eth", symbol: "ETH", gold: "ETH", name: "Ethereum", unit: "ETH", kind: "crypto", cg: "ethereum" },
  ];

  const state = {
    quotes: {},
    sb: null,
    cg: null,
    updated: null,
    error: null,
    timer: null,
    delay: 60000,
    listeners: new Set(),
  };

  function notify() {
    for (const fn of state.listeners) {
      try { fn(getSnapshot()); } catch (e) { console.warn(e); }
    }
    document.dispatchEvent(new CustomEvent("quotes", { detail: getSnapshot() }));
  }

  function getSnapshot() {
    const q = state.quotes;
    const gold = q.xau && q.xau.price;
    const silver = q.xag && q.xag.price;
    const btc = q.btc && q.btc.price;
    return {
      quotes: q,
      sb: state.sb,
      cg: state.cg,
      updated: state.updated,
      error: state.error,
      delay: state.delay,
      ratios: {
        goldSilver: gold && silver ? gold / silver : null,
        btcGold: btc && gold ? btc / gold : null,
      },
      market: Mojo.metalsMarketStatus(),
    };
  }

  async function pullOneGold(asset) {
    const data = await Mojo.fetchJson(GOLD + asset.gold);
    return {
      id: asset.id,
      symbol: asset.symbol,
      name: asset.name,
      unit: asset.unit,
      kind: asset.kind,
      price: data.price,
      updatedAt: data.updatedAt,
      source: "Gold API",
    };
  }

  function attachChanges(quotes, sb, cg) {
    if (sb && Array.isArray(sb.metals)) {
      for (const m of sb.metals) {
        const id = (m.symbol || "").toLowerCase();
        if (!quotes[id]) continue;
        quotes[id].bid = m.bid;
        quotes[id].ask = m.ask;
        quotes[id].open = m.open;
        quotes[id].changeToday = m.changeToday || null;
        quotes[id].changes = m.changes || null;
        quotes[id].sbUpdated = sb.updated;
      }
    }
    if (cg) {
      for (const asset of ASSETS) {
        if (!asset.cg || !cg[asset.cg] || !quotes[asset.id]) continue;
        const row = cg[asset.cg];
        quotes[asset.id].change24h = row.usd_24h_change != null ? { percent: row.usd_24h_change } : null;
        if (row.usd != null && quotes[asset.id].price == null) quotes[asset.id].price = row.usd;
      }
    }
    return quotes;
  }

  async function refresh() {
    try {
      const golds = await Promise.all(ASSETS.map((a) => pullOneGold(a).catch((e) => ({ id: a.id, symbol: a.symbol, name: a.name, error: String(e) }))));
      const quotes = {};
      for (const row of golds) quotes[row.id] = row;

      const extra = await Promise.allSettled([
        Mojo.fetchJson(SB),
        Mojo.fetchJson(CG),
      ]);
      state.sb = extra[0].status === "fulfilled" ? extra[0].value : state.sb;
      state.cg = extra[1].status === "fulfilled" ? extra[1].value : state.cg;
      state.quotes = attachChanges(quotes, state.sb, state.cg);
      state.updated = new Date();
      state.error = null;
      state.delay = 60000;
      notify();
    } catch (e) {
      state.error = String(e && e.message ? e.message : e);
      state.delay = Math.min(state.delay * 2, 10 * 60 * 1000);
      notify();
    } finally {
      clearTimeout(state.timer);
      state.timer = setTimeout(refresh, state.delay);
    }
  }

  function subscribe(fn) {
    state.listeners.add(fn);
    if (state.updated) fn(getSnapshot());
    return () => state.listeners.delete(fn);
  }

  function start() {
    if (state.timer) return;
    refresh();
  }

  function spot(id) {
    const q = state.quotes[id];
    return q && q.price != null ? Number(q.price) : null;
  }

  global.MojoPrices = { ASSETS, start, subscribe, getSnapshot, refresh, spot, state };
})(window);

/* Stack Mojo shared helpers. No personal data, no dealer feeds. */
(function (global) {
  const TZ = "America/Chicago";
  const THEME_KEY = "stackmojo.theme";

  const moneyFmt = (digits) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits });

  function formatMoney(n, digits) {
    if (n == null || Number.isNaN(Number(n))) return "—";
    const x = Number(n);
    const d = digits != null ? digits : (Math.abs(x) >= 100 ? 2 : Math.abs(x) >= 1 ? 2 : 4);
    return moneyFmt(d).format(x);
  }

  function formatNum(n, digits = 2) {
    if (n == null || Number.isNaN(Number(n))) return "—";
    return Number(n).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  function formatPct(n, digits = 2) {
    if (n == null || Number.isNaN(Number(n))) return "—";
    const x = Number(n);
    const sign = x > 0 ? "+" : "";
    return sign + x.toFixed(digits) + "%";
  }

  function chgClass(n) {
    if (n == null || Number.isNaN(Number(n))) return "flat";
    if (Number(n) > 0.0000001) return "up";
    if (Number(n) < -0.0000001) return "down";
    return "flat";
  }

  function formatChicago(date = new Date()) {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      year: "numeric", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit", second: "2-digit",
      hour12: true,
    }).format(date) + " CT";
  }

  function chicagoParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      weekday: "short", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(date);
    const get = (t) => parts.find((p) => p.type === t)?.value;
    return {
      weekday: get("weekday"),
      year: get("year"),
      month: get("month"),
      day: get("day"),
      hour: Number(get("hour")),
      minute: Number(get("minute")),
    };
  }

  /* CME Globex precious metals: Sun 6:00 PM ET through Fri 5:00 PM ET,
     with a daily halt 5:00–6:00 PM ET. Displayed times are Chicago. */
  function metalsMarketStatus(date = new Date()) {
    const ny = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(date);
    const get = (t) => ny.find((p) => p.type === t)?.value;
    const wd = get("weekday");
    const hour = Number(get("hour"));
    const minute = Number(get("minute"));
    const mins = hour * 60 + minute;
    const halt = mins >= 17 * 60 && mins < 18 * 60;
    let open = false;
    if (wd === "Sat") open = false;
    else if (wd === "Sun") open = mins >= 18 * 60;
    else if (wd === "Fri") open = mins < 17 * 60;
    else open = !halt;
    return {
      open,
      label: open ? "Metals market open" : (halt && wd !== "Sat" && wd !== "Sun" ? "Daily halt (5–6 PM ET)" : "Metals market closed"),
    };
  }

  async function fetchJson(url, { timeout = 12000 } = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } finally {
      clearTimeout(t);
    }
  }

  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    const preferLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
    const theme = saved || (preferLight ? "light" : "dark");
    document.documentElement.setAttribute("data-theme", theme);
    return theme;
  }

  function toggleTheme() {
    const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(THEME_KEY, next);
    document.dispatchEvent(new CustomEvent("themechange", { detail: next }));
    return next;
  }

  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") || "dark";
  }

  initTheme();

  global.Mojo = {
    TZ, formatMoney, formatNum, formatPct, chgClass, formatChicago,
    chicagoParts, metalsMarketStatus, fetchJson, toggleTheme, currentTheme, initTheme,
  };
})(window);

(function (global) {
  const STORAGE_KEY = "stackmojo.fairdeal";
  const ASW_90 = 0.7234;

  const PRESETS = [
    { id: "ase", name: "American Silver Eagle (1 oz)", metal: "xag", oz: 1, unit: "coin", eagleNote: true },
    { id: "smaple", name: "Silver Maple (1 oz)", metal: "xag", oz: 1, unit: "coin" },
    { id: "brit", name: "Silver Britannia (1 oz)", metal: "xag", oz: 1, unit: "coin" },
    { id: "kruger", name: "Krugerrand (1 oz gold)", metal: "xau", oz: 1, unit: "coin", note: "A 1 oz Krugerrand contains 1.000 ozt fine gold (22k, slightly heavier coin). Price it against gold spot per fine ounce." },
    { id: "round", name: "Generic round (1 oz)", metal: null, oz: 1, unit: "round" },
    { id: "bar10", name: "10 oz bar", metal: null, oz: 10, unit: "bar" },
    { id: "junk90", name: "90% junk silver (per $1 face)", metal: "xag", oz: ASW_90, unit: "$1 face", note: "Uses this site’s 0.7234 ozt ASW per $1 face. Enter the dealer ask and bid per $1 face." },
    { id: "age", name: "American Gold Eagle (1 oz)", metal: "xau", oz: 1, unit: "coin", eagleNote: true, note: "A 1 oz Gold Eagle contains 1.000 ozt fine gold (22k). Common Eagles typically trade a few dollars over spot between peers." },
    { id: "gmaple", name: "Gold Maple (1 oz)", metal: "xau", oz: 1, unit: "coin" },
    { id: "gbar1", name: "Gold bar (1 oz)", metal: "xau", oz: 1, unit: "bar" },
    { id: "custom", name: "Custom", metal: null, oz: null, unit: "unit" },
  ];

  const FEE_PRESETS = [
    { id: "none", name: "None / Reddit", pct: 0, hint: "Typical r/Pmsforsale or local cash: no platform fee." },
    { id: "pure", name: "Pure (~1%)", pct: 1, hint: "Illustrative seller fee; confirm on collectpure.com." },
    { id: "peermetals", name: "PeerMetals (2.75%)", pct: 2.75, hint: "Illustrative seller fee; confirm on peermetals.com." },
    { id: "whatnot", name: "Whatnot (~7%)", pct: 7, hint: "Illustrative blended rate; Whatnot fees vary by category and promotions." },
    { id: "ebay", name: "eBay (~13.6%)", pct: 13.6, hint: "Illustrative final-value fee. eBay often also fees shipping; check the current fee schedule." },
    { id: "custom", name: "Custom %", pct: null, hint: "Type a fee percentage." },
  ];

  function num(v) {
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function clamp(n, lo, hi) {
    if (n == null) return null;
    return Math.min(hi, Math.max(lo, n));
  }

  /**
   * Fair peer price and fee worksheet.
   * fair = bid + split * (ask - bid), with split in [0, 1].
   * Platform fee is treated as a seller-side deduction.
   */
  function compute(input) {
    const spot = num(input.spot);
    const oz = num(input.oz);
    const qty = num(input.qty);
    const bid = num(input.bid);
    const ask = num(input.ask);
    const split = clamp(num(input.split), 0, 1);
    const shipping = num(input.shipping) || 0;
    const feePct = (num(input.feePct) || 0) / 100;
    const whoPays = input.whoPays || "buyer";
    const feeOnShipping = !!input.feeOnShipping;

    const spotUnit = spot != null && oz != null ? spot * oz : null;
    const q = qty != null ? qty : 0;
    const spotTotal = spotUnit != null ? spotUnit * q : null;

    const haveBook = bid != null && ask != null;
    const spreadUnit = haveBook ? ask - bid : null;
    const fairUnit = haveBook && split != null ? bid + split * (ask - bid) : null;
    const rangeLow = haveBook ? bid + 0.25 * (ask - bid) : null;
    const rangeHigh = haveBook ? bid + 0.75 * (ask - bid) : null;

    const overSpotUnit = fairUnit != null && spotUnit != null ? fairUnit - spotUnit : null;
    const premPct = overSpotUnit != null && spotUnit ? (overSpotUnit / spotUnit) * 100 : null;
    const spreadPctSpot = spreadUnit != null && spotUnit ? (spreadUnit / spotUnit) * 100 : null;
    const spreadPctAsk = spreadUnit != null && ask ? (spreadUnit / ask) * 100 : null;

    const sellerWinUnit = fairUnit != null && bid != null ? fairUnit - bid : null;
    const buyerSaveUnit = fairUnit != null && ask != null ? ask - fairUnit : null;

    const fairTotal = fairUnit != null ? fairUnit * q : null;
    const bidTotal = bid != null ? bid * q : null;
    const askTotal = ask != null ? ask * q : null;
    const spreadTotal = spreadUnit != null ? spreadUnit * q : null;
    const sellerWinTotal = sellerWinUnit != null ? sellerWinUnit * q : null;
    const buyerSaveTotal = buyerSaveUnit != null ? buyerSaveUnit * q : null;
    const spotOverTotal = overSpotUnit != null ? overSpotUnit * q : null;

    let shipSeller = 0;
    let shipBuyer = 0;
    if (whoPays === "seller") shipSeller = shipping;
    else if (whoPays === "split") {
      shipSeller = shipping / 2;
      shipBuyer = shipping / 2;
    } else {
      shipBuyer = shipping;
    }

    const feeBase = fairTotal != null ? fairTotal + (feeOnShipping ? shipping : 0) : null;
    const fee = feeBase != null ? feeBase * feePct : null;
    const netSeller = fairTotal != null ? fairTotal - (fee || 0) - shipSeller : null;
    const allInBuyer = fairTotal != null ? fairTotal + shipBuyer : null;

    return {
      spot, oz, qty: q, bid, ask, split, shipping, feePct: feePct * 100, whoPays, feeOnShipping,
      spotUnit, spotTotal,
      spreadUnit, spreadTotal, spreadPctSpot, spreadPctAsk,
      fairUnit, fairTotal, rangeLow, rangeHigh,
      overSpotUnit, spotOverTotal, premPct,
      sellerWinUnit, sellerWinTotal, buyerSaveUnit, buyerSaveTotal,
      bidTotal, askTotal,
      shipSeller, shipBuyer, fee, netSeller, allInBuyer,
    };
  }

  function $(id) {
    return document.getElementById(id);
  }

  function val(id) {
    const el = $(id);
    return el ? el.value : "";
  }

  function setVal(id, v) {
    const el = $(id);
    if (el && document.activeElement !== el) el.value = v;
    else if (el && v !== el.value && el.type === "range") el.value = v;
  }

  function setText(id, t) {
    const el = $(id);
    if (el) el.textContent = t;
  }

  function money(n, digits) {
    if (n == null || Number.isNaN(n)) return "—";
    return Mojo.formatMoney(n, digits != null ? digits : (Math.abs(n) >= 1 ? 2 : 2));
  }

  function moneyDelta(n) {
    if (n == null || Number.isNaN(n)) return "—";
    const sign = n > 0 ? "+" : "";
    return sign + Mojo.formatMoney(n);
  }

  function pct(n) {
    return n == null || Number.isNaN(n) ? "—" : Mojo.formatPct(n);
  }

  function currentPreset() {
    return PRESETS.find((p) => p.id === val("fd-preset")) || PRESETS[0];
  }

  function liveSpot(metal) {
    if (!global.MojoPrices || !MojoPrices.spot) return null;
    return MojoPrices.spot(metal || val("fd-metal") || "xag");
  }

  let spotManual = false;
  let saveTimer = null;

  function applyPreset(resetOz) {
    const p = currentPreset();
    if (p.metal) {
      const metalSel = $("fd-metal");
      if (metalSel && metalSel.value !== p.metal) {
        metalSel.value = p.metal;
        spotManual = false;
      }
    }
    if (resetOz && p.oz != null) {
      const ozEl = $("fd-oz");
      if (ozEl) ozEl.value = String(p.oz);
    }
    const ozEl = $("fd-oz");
    if (ozEl) ozEl.disabled = p.id !== "custom" && p.oz != null;
    setText("fd-unit-hint", p.unit ? "per " + p.unit : "");
    const notes = [];
    if (p.note) notes.push(p.note);
    if (p.eagleNote) notes.push("Common Eagles typically trade a few dollars over spot between peers, not at melt.");
    setText("fd-preset-note", notes.join(" "));
    if (!spotManual) syncLiveSpot();
  }

  function syncLiveSpot() {
    if (spotManual) return;
    const px = liveSpot();
    const el = $("fd-spot");
    if (px != null && el && document.activeElement !== el) {
      el.value = String(Math.round(px * 10000) / 10000);
    }
    const live = liveSpot();
    setText("fd-spot-live", live != null ? "Live " + Mojo.formatMoney(live) + " / ozt (Gold API). You can edit the field." : "Waiting for live spot…");
  }

  function applyFeePreset() {
    const id = val("fd-fee-preset");
    const p = FEE_PRESETS.find((x) => x.id === id) || FEE_PRESETS[0];
    const feeEl = $("fd-fee");
    if (feeEl) {
      if (p.pct != null) {
        feeEl.value = String(p.pct);
        feeEl.readOnly = id !== "custom";
      } else {
        feeEl.readOnly = false;
      }
    }
    if (id === "ebay") {
      const box = $("fd-fee-ship");
      // Don't force the box, just hint.
    }
    setText("fd-fee-hint", p.hint || "");
  }

  function inputsFromForm() {
    return {
      spot: val("fd-spot"),
      oz: val("fd-oz"),
      qty: val("fd-qty"),
      bid: val("fd-bid"),
      ask: val("fd-ask"),
      split: (num(val("fd-split")) || 0) / 100,
      shipping: val("fd-ship"),
      whoPays: val("fd-who-pays") || "buyer",
      feePct: val("fd-fee"),
      feeOnShipping: !!$("fd-fee-ship")?.checked,
      metal: val("fd-metal"),
      preset: val("fd-preset"),
      feePreset: val("fd-fee-preset"),
      spotManual,
    };
  }

  function renderRange(out) {
    const track = $("fd-range-track");
    const fill = $("fd-range-fill");
    const mark = $("fd-range-mark");
    if (!track || out.ask == null || out.bid == null || out.ask === out.bid) {
      if (fill) fill.style.width = "0%";
      if (mark) mark.style.left = "50%";
      return;
    }
    // Band is 25–75% of the spread, marker is the chosen split.
    if (fill) {
      fill.style.left = "25%";
      fill.style.width = "50%";
    }
    if (mark) {
      const pctPos = clamp((out.split || 0) * 100, 0, 100);
      mark.style.left = pctPos + "%";
    }
  }

  function render() {
    const src = inputsFromForm();
    const out = compute(src);
    const unit = currentPreset().unit || "unit";

    setText("fd-spot-unit", out.spotUnit != null ? money(out.spotUnit) : "—");
    setText("fd-spot-total", out.spotTotal != null ? money(out.spotTotal) : "—");

    setText("fd-spread-unit", out.spreadUnit != null ? money(out.spreadUnit) : "—");
    setText("fd-spread-pct", out.spreadPctSpot != null
      ? pct(out.spreadPctSpot) + " of spot" + (out.spreadPctAsk != null ? " · " + pct(out.spreadPctAsk) + " of ask" : "")
      : "—");
    setText("fd-spread-total", out.spreadTotal != null ? money(out.spreadTotal) + " total" : "");

    setText("fd-fair-unit", out.fairUnit != null ? money(out.fairUnit) : "—");
    setText("fd-fair-vs-spot", out.overSpotUnit != null
      ? moneyDelta(out.overSpotUnit) + " over spot · " + pct(out.premPct) + " premium"
      : "—");
    setText("fd-fair-total", out.fairTotal != null ? money(out.fairTotal) + " for " + out.qty + " " + unit + (out.qty === 1 ? "" : "s") : "");

    setText("fd-win-seller", out.sellerWinUnit != null
      ? "Seller gets " + money(out.sellerWinUnit) + " more per " + unit + " than the dealer bid"
        + (out.sellerWinTotal != null && out.qty !== 1 ? " (" + money(out.sellerWinTotal) + " total)" : "") + "."
      : "Enter a dealer bid and ask to see each side’s win.");
    setText("fd-win-buyer", out.buyerSaveUnit != null
      ? "Buyer saves " + money(out.buyerSaveUnit) + " per " + unit + " vs the dealer ask"
        + (out.buyerSaveTotal != null && out.qty !== 1 ? " (" + money(out.buyerSaveTotal) + " total)" : "") + "."
      : "");

    const splitPct = Math.round((out.split || 0) * 100);
    setText("fd-split-label", splitPct + "% of the spread (0% = dealer bid, 100% = dealer ask)");

    setText("fd-band", out.rangeLow != null
      ? "Fair range (25–75% of the spread): " + money(out.rangeLow) + " – " + money(out.rangeHigh) + " per " + unit + "."
      : "Fair range appears once both a bid and an ask are entered.");

    setText("fd-fee-amt", out.fee != null ? money(out.fee) : "—");
    setText("fd-net-seller", out.netSeller != null ? money(out.netSeller) : "—");
    setText("fd-allin-buyer", out.allInBuyer != null ? money(out.allInBuyer) : "—");
    const shipBits = [];
    if (out.shipping) {
      if (out.whoPays === "seller") shipBits.push("Seller covers " + money(out.shipping) + " shipping.");
      else if (out.whoPays === "split") shipBits.push("Shipping split: " + money(out.shipSeller) + " each.");
      else shipBits.push("Buyer covers " + money(out.shipping) + " shipping.");
    }
    shipBits.push("Platform fee is treated as a seller-side cost (typical). Fees change — verify on the platform.");
    setText("fd-net-note", shipBits.join(" "));

    renderRange(out);
    return out;
  }

  function persist() {
    try {
      const data = inputsFromForm();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) { /* quota / private mode */ }
  }

  function restore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (!d || typeof d !== "object") return;
      const assign = (id, v) => { const el = $(id); if (el && v != null && v !== "") el.value = v; };
      assign("fd-metal", d.metal);
      assign("fd-preset", d.preset);
      assign("fd-oz", d.oz);
      assign("fd-qty", d.qty);
      assign("fd-bid", d.bid);
      assign("fd-ask", d.ask);
      if (d.split != null) assign("fd-split", String(Math.round(Number(d.split) * 100)));
      assign("fd-ship", d.shipping);
      assign("fd-who-pays", d.whoPays);
      assign("fd-fee-preset", d.feePreset);
      assign("fd-fee", d.feePct);
      if ($("fd-fee-ship")) $("fd-fee-ship").checked = !!d.feeOnShipping;
      spotManual = !!d.spotManual;
      if (spotManual && d.spot != null) assign("fd-spot", d.spot);
    } catch (e) { /* ignore bad JSON */ }
  }

  function fillExample() {
    const ozEl = $("fd-oz");
    const qtyEl = $("fd-qty");
    const bidEl = $("fd-bid");
    const askEl = $("fd-ask");
    const splitEl = $("fd-split");
    const presetEl = $("fd-preset");
    const metalEl = $("fd-metal");
    if (presetEl) presetEl.value = "round";
    if (metalEl) metalEl.value = "xag";
    spotManual = false;
    applyPreset(true);
    if (ozEl) { ozEl.disabled = true; ozEl.value = "1"; }
    if (qtyEl) qtyEl.value = "1";
    if (bidEl) bidEl.value = "40";
    if (askEl) askEl.value = "50";
    if (splitEl) splitEl.value = "50";
    setText("fd-example-note", "Example only — $40 bid / $50 ask is not a quote and is not from a dealer.");
    render();
    persist();
  }

  function bind() {
    const presetSel = $("fd-preset");
    if (presetSel) {
      presetSel.innerHTML = PRESETS.map((p) => `<option value="${p.id}">${p.name}</option>`).join("");
    }
    const feeSel = $("fd-fee-preset");
    if (feeSel) {
      feeSel.innerHTML = FEE_PRESETS.map((p) => `<option value="${p.id}">${p.name}</option>`).join("");
    }

    restore();
    applyPreset(false);
    applyFeePreset();
    if (!spotManual) syncLiveSpot();
    render();

    const onField = (ev) => {
      if (ev && ev.target && ev.target.id === "fd-spot") spotManual = true;
      if (ev && ev.target && ev.target.id === "fd-preset") applyPreset(true);
      if (ev && ev.target && ev.target.id === "fd-metal") {
        const p = currentPreset();
        if (p.metal && p.metal !== val("fd-metal") && p.id !== "custom" && p.id !== "round" && p.id !== "bar10") {
          // Metal-locked preset: switch to custom if the user changes metal.
          if (presetSel) presetSel.value = "custom";
          applyPreset(false);
        }
        spotManual = false;
        syncLiveSpot();
      }
      if (ev && ev.target && ev.target.id === "fd-fee-preset") applyFeePreset();
      render();
      clearTimeout(saveTimer);
      saveTimer = setTimeout(persist, 250);
    };

    ["fd-metal", "fd-preset", "fd-spot", "fd-oz", "fd-qty", "fd-bid", "fd-ask", "fd-split",
      "fd-ship", "fd-who-pays", "fd-fee-preset", "fd-fee", "fd-fee-ship"].forEach((id) => {
      $(id)?.addEventListener("input", onField);
      $(id)?.addEventListener("change", onField);
    });

    $("fd-use-live")?.addEventListener("click", (e) => {
      e.preventDefault();
      spotManual = false;
      syncLiveSpot();
      render();
      persist();
    });
    $("fd-example")?.addEventListener("click", (e) => {
      e.preventDefault();
      fillExample();
    });
    $("fd-clear")?.addEventListener("click", (e) => {
      e.preventDefault();
      try { localStorage.removeItem(STORAGE_KEY); } catch (err) { /* ignore */ }
      spotManual = false;
      if (presetSel) presetSel.value = "ase";
      if ($("fd-qty")) $("fd-qty").value = "1";
      if ($("fd-bid")) $("fd-bid").value = "";
      if ($("fd-ask")) $("fd-ask").value = "";
      if ($("fd-split")) $("fd-split").value = "50";
      if ($("fd-ship")) $("fd-ship").value = "0";
      if ($("fd-who-pays")) $("fd-who-pays").value = "buyer";
      if ($("fd-fee-preset")) $("fd-fee-preset").value = "none";
      if ($("fd-fee-ship")) $("fd-fee-ship").checked = false;
      setText("fd-example-note", "");
      applyFeePreset();
      applyPreset(true);
      render();
      persist();
    });

    if (global.MojoPrices) {
      MojoPrices.subscribe(() => {
        if (!spotManual) syncLiveSpot();
        render();
      });
      MojoPrices.start();
    }
  }

  global.MojoFair = { compute, PRESETS, FEE_PRESETS, ASW_90 };

  if (typeof document !== "undefined" && document.getElementById("fair-deal-page")) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
    else bind();
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { compute, PRESETS, FEE_PRESETS, ASW_90 };
  }
})(typeof window !== "undefined" ? window : globalThis);

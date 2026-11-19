(function () {
  const TROY = 31.1034768;
  const ASW_90 = 0.7234;

  function $(id) { return document.getElementById(id); }
  function val(id) { const el = $(id); return el ? Number(el.value) : 0; }
  function setText(id, t) { const el = $(id); if (el) el.textContent = t; }

  function metalSpot(metal) {
    const map = { XAU: "xau", XAG: "xag", XPT: "xpt", XPD: "xpd", HG: "hg" };
    return MojoPrices.spot(map[metal] || metal.toLowerCase());
  }

  let items = [];

  async function loadMelt() {
    const doc = await Mojo.fetchJson("data/melt.json");
    items = doc.items || [];
    const sel = $("melt-item");
    const dash = $("melt-dashboard");
    if (sel) {
      const groups = {};
      for (const it of items) {
        (groups[it.category] = groups[it.category] || []).push(it);
      }
      sel.innerHTML = Object.entries(groups).map(([cat, list]) =>
        `<optgroup label="${cat}">${list.map((it) => `<option value="${it.id}">${it.name}</option>`).join("")}</optgroup>`
      ).join("");
    }
    renderMelt();
    renderDash();
  }

  function itemById(id) { return items.find((i) => i.id === id); }

  function meltValue(it, qty, spot) {
    const oz = (it.ozPerUnit || 0) * qty;
    return { oz, value: spot != null ? oz * spot : null };
  }

  function renderMelt() {
    const it = itemById($("melt-item")?.value);
    const qty = val("melt-qty") || 0;
    if (!it) return;
    const spot = metalSpot(it.metal);
    const { oz, value } = meltValue(it, qty, spot);
    setText("melt-oz", Mojo.formatNum(oz, 4) + " ozt fine");
    setText("melt-spot", spot != null ? Mojo.formatMoney(spot) + " / ozt" : "Waiting for spot…");
    setText("melt-value", value != null ? Mojo.formatMoney(value) : "—");
    setText("melt-note", it.note || "");
    setText("melt-unit-hint", "(" + (it.unitLabel || it.unit) + ")");
  }

  function renderDash() {
    const dash = $("melt-dashboard");
    if (!dash) return;
    const rows = items.filter((it) => it.category !== "sets" || it.ozPerUnit);
    dash.innerHTML = `<table><thead><tr><th>Item</th><th>Unit</th><th class="num">Fine oz / unit</th><th class="num">Spot</th><th class="num">Melt / unit</th></tr></thead><tbody>${
      rows.map((it) => {
        const spot = metalSpot(it.metal);
        const melt = spot != null ? spot * (it.ozPerUnit || 0) : null;
        return `<tr><td>${it.name}</td><td>${it.unitLabel}</td><td class="num">${Mojo.formatNum(it.ozPerUnit, 4)}</td><td class="num">${spot != null ? Mojo.formatMoney(spot) : "—"}</td><td class="num">${melt != null ? Mojo.formatMoney(melt) : "—"}</td></tr>`;
      }).join("")
    }</tbody></table>`;
  }

  function renderQuick() {
    const spotAg = metalSpot("XAG");
    const spotAu = metalSpot("XAU");
    const face90 = val("q-90-face");
    const oz90 = face90 * ASW_90;
    setText("q-90-oz", Mojo.formatNum(oz90, 4) + " ozt");
    setText("q-90-val", spotAg != null ? Mojo.formatMoney(oz90 * spotAg) : "—");

    const wt90 = val("q-90-wt"); /* troy oz of coins (gross) */
    const ozFromWt = wt90 * 0.9;
    setText("q-90-wt-oz", Mojo.formatNum(ozFromWt, 4) + " ozt fine");
    setText("q-90-wt-val", spotAg != null ? Mojo.formatMoney(ozFromWt * spotAg) : "—");

    const grams = val("q-karat-g");
    const karat = val("q-karat") || 24;
    const fineOz = grams * (karat / 24) / TROY;
    setText("q-karat-oz", Mojo.formatNum(fineOz, 4) + " ozt fine");
    setText("q-karat-val", spotAu != null ? Mojo.formatMoney(fineOz * spotAu) : "—");

    const fine = val("q-999-oz");
    const metal = $("q-999-metal")?.value || "XAG";
    const spot = metalSpot(metal);
    setText("q-999-val", spot != null ? Mojo.formatMoney(fine * spot) : "—");
  }

  function renderPremium() {
    const tab = document.querySelector("[data-prem-tab][aria-selected='true']")?.dataset.premTab || "buy";
    const oz = val("p-oz") || 0;
    const spot = metalSpot($("p-metal")?.value || "XAG");
    const unit = val("p-price");
    const qty = val("p-qty") || 1;
    const ship = val("p-ship") || 0;
    const tax = val("p-tax") || 0;
    const fee = val("p-fee") || 0;
    const gross = unit * qty;
    const melt = spot != null ? spot * oz * qty : null;
    let net, label;
    if (tab === "buy") {
      net = gross + ship + gross * (tax / 100) + gross * (fee / 100);
      label = "Total paid";
    } else {
      net = gross - ship - gross * (fee / 100);
      label = "Net received";
    }
    const prem = melt ? net - melt : null;
    const premPct = melt ? (prem / melt) * 100 : null;
    setText("p-melt", melt != null ? Mojo.formatMoney(melt) : "—");
    setText("p-net-label", label);
    setText("p-net", Mojo.formatMoney(net));
    setText("p-prem", prem != null ? Mojo.formatMoney(prem) + " (" + Mojo.formatPct(premPct) + ")" : "—");
    const el = $("p-prem");
    if (el) el.className = "big chg " + Mojo.chgClass(prem);
  }

  function renderSpread() {
    const ask = val("s-ask");
    const bid = val("s-bid");
    const oz = val("s-oz") || 1;
    const spot = metalSpot($("s-metal")?.value || "XAG") ?? val("s-spot");
    const melt = spot != null ? spot * oz : null;
    const prem = melt ? ask - melt : null;
    const premPct = melt ? (prem / melt) * 100 : null;
    const bidVs = melt ? bid - melt : null;
    const bidPct = melt ? (bidVs / melt) * 100 : null;
    const spread = (ask && bid) ? ask - bid : null;
    const spreadPct = ask ? (spread / ask) * 100 : null;
    const beMove = spread != null && oz ? spread / oz : null;
    const bePct = beMove != null && spot ? (beMove / spot) * 100 : null;
    setText("s-spot-used", spot != null ? Mojo.formatMoney(spot) : "—");
    setText("s-melt", melt != null ? Mojo.formatMoney(melt) : "—");
    setText("s-prem", prem != null ? Mojo.formatMoney(prem) + " (" + Mojo.formatPct(premPct) + ")" : "—");
    setText("s-bidvs", bidVs != null ? Mojo.formatMoney(bidVs) + " (" + Mojo.formatPct(bidPct) + ")" : "—");
    setText("s-spread", spread != null ? Mojo.formatMoney(spread) + " (" + Mojo.formatPct(spreadPct) + ")" : "—");
    setText("s-be", beMove != null ? Mojo.formatMoney(beMove) + " / oz (" + Mojo.formatPct(bePct) + ")" : "—");
  }

  const KIND_LABEL = {
    proof: "Proof set",
    silver_proof: "Silver Proof set",
    sms: "Special Mint Set",
    mint: "Mint set",
    special: "Special / separate",
  };

  let setDoc = null;

  async function loadSets() {
    try {
      setDoc = await Mojo.fetchJson("data/us-sets.json", { timeout: 20000 });
    } catch (e) {
      setDoc = { sets: [], sources: [], caveats: [String(e && e.message ? e.message : e)] };
    }
    renderSetFootnotes();
    renderSets();
  }

  function renderSetFootnotes() {
    const el = $("sets-footnotes");
    if (!el || !setDoc) return;
    const conv = setDoc.conventions || {};
    const sources = (setDoc.sources || []).map((s) => {
      const link = s.url ? `<a href="${s.url}">${s.name}</a>` : s.name;
      return `<li>${link} — ${s.what || ""}</li>`;
    }).join("");
    const caveats = (setDoc.caveats || []).map((c) => `<li>${c}</li>`).join("");
    el.innerHTML = `
      <h3>How ASW is calculated</h3>
      <p>90% dime + quarter + half = ${conv.asw_90_dime_quarter_half} ozt, consistent with this site’s ${conv.asw_90_per_dollar_face} ozt per $1 face convention. A 40% Kennedy half is ${conv.asw_40_kennedy_half} ozt (11.50 g × 0.40 ÷ 31.1034768). A 40% Ike dollar is ${conv.asw_40_ike} ozt (24.59 g × 0.40). From 2019, Silver Proof dime / quarter / half use U.S. Mint nominal weights 2.537 g, 6.343 g, and 12.685 g at 0.999 fine (dime + five quarters + half = ${conv.asw_999_dime_5q_half} ozt; the 2021 two-quarter set is ${conv.asw_999_dime_2q_half} ozt).</p>
      <h3>Sources</h3>
      <ol>${sources}</ol>
      <h3>Caveats</h3>
      <ul>${caveats}</ul>`;
  }

  function renderSets() {
    const body = $("sets-body");
    if (!body || !setDoc) return;
    const yearRaw = $("sets-year")?.value;
    const year = yearRaw ? Number(yearRaw) : null;
    const kind = $("sets-kind")?.value || "all";
    const silverOnly = $("sets-silver-only")?.checked;
    const spot = metalSpot("XAG");
    const rows = (setDoc.sets || []).filter((r) => {
      const hasYear = Number.isFinite(r.year) && r.year > 0;
      if (year && hasYear && r.year !== year) return false;
      if (year && !hasYear) return false;
      if (kind !== "all" && r.kind !== kind) return false;
      if (silverOnly) {
        if (r.status === "none") return false;
        if (r.status === "ok" && !(r.asw > 0)) return false;
      }
      return true;
    });
    const empty = $("sets-empty");
    if (empty) empty.hidden = rows.length > 0;
    body.innerHTML = rows.map((r) => {
      const yearLabel = r.year ? String(r.year) : "Various";
      const hl = (year && r.year === year) ? " highlight" : "";
      let aswCell, meltCell;
      if (r.status === "varies") {
        aswCell = "varies";
        meltCell = "varies";
      } else if (r.status === "none") {
        aswCell = "—";
        meltCell = "—";
      } else if (r.asw == null) {
        aswCell = "varies";
        meltCell = "varies";
      } else {
        aswCell = Mojo.formatNum(r.asw, 4);
        meltCell = spot != null ? Mojo.formatMoney(r.asw * spot) : "—";
      }
      const type = KIND_LABEL[r.kind] || r.kind;
      const note = r.note ? `<div class="row-note">${r.note}</div>` : "";
      const coins = r.silverCoins ? `<div class="row-coins">${r.silverCoins}</div>` : "";
      return `<tr class="${r.status}${hl}" data-year="${r.year || ""}">
        <td class="num">${yearLabel}</td>
        <td><div class="set-name">${r.name}</div><div class="muted">${type}</div>${note}</td>
        <td>${coins || "—"}</td>
        <td class="num">${aswCell}</td>
        <td class="num">${meltCell}</td>
      </tr>`;
    }).join("");
  }

  function bind() {
    ["melt-item", "melt-qty"].forEach((id) => $(id)?.addEventListener("input", renderMelt));
    ["q-90-face", "q-90-wt", "q-karat-g", "q-karat", "q-999-oz", "q-999-metal"].forEach((id) => $(id)?.addEventListener("input", renderQuick));
    ["p-oz", "p-price", "p-qty", "p-ship", "p-tax", "p-fee", "p-metal"].forEach((id) => $(id)?.addEventListener("input", renderPremium));
    document.querySelectorAll("[data-prem-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("[data-prem-tab]").forEach((b) => b.setAttribute("aria-selected", b === btn ? "true" : "false"));
        renderPremium();
      });
    });
    ["s-ask", "s-bid", "s-oz", "s-spot", "s-metal"].forEach((id) => $(id)?.addEventListener("input", renderSpread));
    ["sets-year", "sets-kind", "sets-silver-only"].forEach((id) => {
      $(id)?.addEventListener("input", renderSets);
      $(id)?.addEventListener("change", renderSets);
    });
  }

  function refreshAll() {
    renderMelt(); renderDash(); renderQuick(); renderPremium(); renderSpread(); renderSets();
  }

  window.MojoCalc = { ASW_90, TROY, renderMelt, refreshAll, itemById, meltValue };

  if (document.getElementById("calc-page")) {
    bind();
    loadMelt().catch((e) => { const n = $("calc-error"); if (n) { n.hidden = false; n.textContent = e.message; } });
    loadSets();
    MojoPrices.subscribe(refreshAll);
    MojoPrices.start();
  }
})();

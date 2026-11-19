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
  }

  function refreshAll() {
    renderMelt(); renderDash(); renderQuick(); renderPremium(); renderSpread();
  }

  window.MojoCalc = { ASW_90, TROY, renderMelt, refreshAll, itemById, meltValue };

  if (document.getElementById("calc-page")) {
    bind();
    loadMelt().catch((e) => { const n = $("calc-error"); if (n) { n.hidden = false; n.textContent = e.message; } });
    MojoPrices.subscribe(refreshAll);
    MojoPrices.start();
  }
})();

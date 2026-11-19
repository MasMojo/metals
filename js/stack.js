/* My Stack: localStorage only. Never sent to a server. */
(function () {
  const KEY = "stackmojo.holdings.v1";
  const page = document.getElementById("stack-page");
  if (!page) return;

  function uid() { return "h_" + Math.random().toString(36).slice(2, 10); }

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
    catch { return []; }
  }
  function save(rows) { localStorage.setItem(KEY, JSON.stringify(rows)); render(); }

  function metalSpot(metal) {
    const map = { XAU: "xau", XAG: "xag", XPT: "xpt", XPD: "xpd", HG: "hg", BTC: "btc", ETH: "eth" };
    return MojoPrices.spot(map[metal] || metal);
  }

  function rowsWithValue(rows) {
    return rows.map((r) => {
      const oz = Number(r.oz) || 0;
      const cost = Number(r.cost) || 0;
      const spot = metalSpot(r.metal);
      const value = spot != null ? oz * spot : null;
      const pl = value != null ? value - cost : null;
      return { ...r, oz, cost, spot, value, pl };
    });
  }

  function totals(enriched) {
    const by = {};
    let cost = 0, value = 0, oz = 0;
    let valueKnown = true;
    for (const r of enriched) {
      cost += r.cost;
      oz += r.oz;
      const bucket = by[r.metal] || (by[r.metal] = { metal: r.metal, oz: 0, cost: 0, value: 0 });
      bucket.oz += r.oz;
      bucket.cost += r.cost;
      if (r.value != null) { value += r.value; bucket.value += r.value; }
      else valueKnown = false;
    }
    return { by: Object.values(by), cost, value: valueKnown ? value : null, oz, pl: valueKnown ? value - cost : null };
  }

  function render() {
    const enriched = rowsWithValue(load());
    const t = totals(enriched);
    const body = document.getElementById("stack-body");
    const sum = document.getElementById("stack-summary");
    if (sum) {
      sum.innerHTML = `
        <div class="card"><div class="card-label">Melt / spot value</div><div class="price">${Mojo.formatMoney(t.value)}</div></div>
        <div class="card"><div class="card-label">Cost basis</div><div class="price">${Mojo.formatMoney(t.cost)}</div></div>
        <div class="card"><div class="card-label">P / L</div><div class="price chg ${Mojo.chgClass(t.pl)}">${t.pl != null ? Mojo.formatMoney(t.pl) : "—"}</div></div>
        <div class="card"><div class="card-label">Fine ounces</div><div class="price">${Mojo.formatNum(t.oz, 3)}</div></div>`;
    }
    if (body) {
      body.innerHTML = enriched.length ? enriched.map((r) => `<tr>
        <td>${escapeHtml(r.name || r.item || "Lot")}</td>
        <td>${r.metal}</td>
        <td class="num">${Mojo.formatNum(r.qty, 2)}</td>
        <td class="num">${Mojo.formatNum(r.oz, 4)}</td>
        <td class="num">${Mojo.formatMoney(r.cost)}</td>
        <td class="num">${Mojo.formatMoney(r.value)}</td>
        <td class="num chg ${Mojo.chgClass(r.pl)}">${r.pl != null ? Mojo.formatMoney(r.pl) : "—"}</td>
        <td>${escapeHtml(r.notes || "")}</td>
        <td><button class="btn" data-del="${r.id}">Delete</button></td>
      </tr>`).join("") : `<tr><td colspan="9" class="muted">No holdings on this device yet.</td></tr>`;
    }
    const by = document.getElementById("stack-by-metal");
    if (by) {
      by.innerHTML = t.by.map((b) => `<article class="card"><div class="card-label">${b.metal}</div>
        <div class="price">${Mojo.formatMoney(b.value)}</div>
        <div class="sub">${Mojo.formatNum(b.oz, 3)} oz · cost ${Mojo.formatMoney(b.cost)}</div></article>`).join("") || "";
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  document.getElementById("stack-add")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    const qty = Number(f.qty.value) || 0;
    const ozEach = Number(f.ozEach.value) || 0;
    const rows = load();
    rows.push({
      id: uid(),
      name: f.name.value.trim(),
      metal: f.metal.value,
      qty,
      oz: qty * ozEach,
      cost: Number(f.cost.value) || 0,
      notes: f.notes.value.trim(),
      added: new Date().toISOString(),
    });
    f.reset();
    save(rows);
  });

  document.getElementById("stack-body")?.addEventListener("click", (e) => {
    const id = e.target?.dataset?.del;
    if (!id) return;
    save(load().filter((r) => r.id !== id));
  });

  document.getElementById("stack-export")?.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), holdings: load() }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "stack-mojo-holdings.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  document.getElementById("stack-import")?.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const doc = JSON.parse(reader.result);
        const incoming = Array.isArray(doc) ? doc : doc.holdings;
        if (!Array.isArray(incoming)) throw new Error("No holdings array");
        const existing = load();
        const ids = new Set(existing.map((r) => r.id));
        for (const row of incoming) {
          if (!row.id || ids.has(row.id)) row.id = uid();
          existing.push(row);
        }
        save(existing);
      } catch (err) {
        alert("Could not import: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  document.getElementById("stack-clear")?.addEventListener("click", () => {
    if (confirm("Delete all holdings stored in this browser? This cannot be undone unless you have an export.")) {
      save([]);
    }
  });

  MojoPrices.subscribe(render);
  MojoPrices.start();
  render();
})();

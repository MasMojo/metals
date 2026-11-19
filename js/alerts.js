/* Local price alerts via Notification API while the page is open. */
(function () {
  const KEY = "stackmojo.alerts.v1";
  const box = document.getElementById("alert-box");
  if (!box) return;

  function load() { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } }
  function save(rows) { localStorage.setItem(KEY, JSON.stringify(rows)); renderList(); }

  function renderList() {
    const list = document.getElementById("alert-list");
    if (!list) return;
    const rows = load();
    list.innerHTML = rows.length ? rows.map((a) => `<li>${a.asset.toUpperCase()} ${a.op} ${Mojo.formatMoney(a.price)}
      <button class="btn" data-del="${a.id}">Remove</button></li>`).join("") : "<li class='muted'>No alerts yet.</li>";
  }

  document.getElementById("alert-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (Notification.permission === "default") await Notification.requestPermission();
    if (Notification.permission !== "granted") {
      alert("Notifications were not granted. Alerts can still be listed here, but the browser will not notify you.");
    }
    const f = e.target;
    const rows = load();
    rows.push({
      id: "a_" + Math.random().toString(36).slice(2, 9),
      asset: f.asset.value,
      op: f.op.value,
      price: Number(f.price.value),
      triggered: false,
    });
    save(rows);
    f.reset();
  });

  document.getElementById("alert-list")?.addEventListener("click", (e) => {
    const id = e.target?.dataset?.del;
    if (!id) return;
    save(load().filter((a) => a.id !== id));
  });

  function check(snap) {
    if (Notification.permission !== "granted") return;
    const rows = load();
    let changed = false;
    for (const a of rows) {
      const q = snap.quotes[a.asset];
      if (!q || q.price == null || a.triggered) continue;
      const hit = a.op === "above" ? q.price >= a.price : q.price <= a.price;
      if (hit) {
        a.triggered = true;
        changed = true;
        try {
          new Notification("Stack Mojo alert", {
            body: `${q.name} is ${Mojo.formatMoney(q.price)} (${a.op} ${Mojo.formatMoney(a.price)})`,
            icon: "assets/icons/icon-192.png",
          });
        } catch (e) { console.warn(e); }
      }
    }
    if (changed) localStorage.setItem(KEY, JSON.stringify(rows));
  }

  renderList();
  MojoPrices.subscribe(check);
})();

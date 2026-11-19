const CACHE = "stackmojo-v2";
const SHELL = [
  "./",
  "./index.html",
  "./charts.html",
  "./calculators.html",
  "./stack.html",
  "./css/app.css",
  "./js/core.js",
  "./js/prices.js",
  "./js/dashboard.js",
  "./js/charts.js",
  "./js/calc.js",
  "./js/stack.js",
  "./js/alerts.js",
  "./js/sw-register.js",
  "./data/melt.json",
  "./manifest.webmanifest",
  "./assets/favicon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;
  const isApi = /gold-api\.com|standardbullion\.com|coingecko\.com/.test(url.hostname);
  if (isApi) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }
  event.respondWith(
    fetch(event.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(event.request, copy));
      return res;
    }).catch(() => caches.match(event.request).then((r) => r || caches.match("./index.html")))
  );
});

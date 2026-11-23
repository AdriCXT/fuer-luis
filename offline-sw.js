/* Offline-Speicher: Seite öffnet sofort aus dem Handy-Speicher, Updates kommen im Hintergrund nach. */
const CACHE = "notenblatt-v1";
const STATIC = /\/(sounds|icons)\/|manifest\.webmanifest$/;
const FONTS = /^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com)\//;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("notenblatt-") && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
));

self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (u.pathname.includes("/push/")) return;               // OneSignal nicht anfassen

  /* Seite selbst: sofort aus dem Speicher, im Hintergrund frisch holen */
  const root = new URL("./", self.registration.scope).pathname;
  if (r.mode === "navigate" && u.origin === location.origin && (u.pathname === root || u.pathname === root + "index.html")) {
    e.respondWith(caches.open(CACHE).then(async c => {
      const key = new URL("./", self.registration.scope).href;
      const hit = await c.match(key);
      const net = fetch(r).then(res => { if (res.ok) c.put(key, res.clone()); return res; }).catch(() => hit);
      if (hit) { e.waitUntil(net); return hit; }
      return net;
    }));
    return;
  }

  /* Töne, Icons, Schriften: einmal laden, dann immer aus dem Speicher */
  if ((u.origin === location.origin && STATIC.test(u.pathname)) || FONTS.test(r.url)) {
    e.respondWith(caches.open(CACHE).then(async c => {
      const hit = await c.match(r);
      if (hit) return hit;
      const res = await fetch(r);
      if (res.ok || res.type === "opaque") c.put(r, res.clone());
      return res;
    }));
  }
});

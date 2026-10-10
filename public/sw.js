// Effendy Family service worker.
// - App shell: every page's HTML plus its /_next/static files are cached on install,
//   so the app opens offline from the Home Screen.
// - Pages and RSC data: network first, cached copy when offline.
// - /_next/static (hashed, never changes): cache first.
// - Supabase and other origins are never touched here.

const VERSION = "ef-v7";
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;

const PAGES = [
  "/", "/login", "/settings", "/more",
  "/budget", "/debts", "/import", "/recur", "/subs", "/remit", "/biz", "/tax",
  "/week", "/shifts", "/ygoals", "/learn",
  "/invest", "/sim", "/career",
  "/gym", "/together", "/journal",
  "/alerts", "/report", "/ask", "/whatif", "/setup",
];
const EXTRA = ["/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png"];

const STATIC_RE = /\/_next\/static\/[^"'\s)\\]+/g;

async function precache() {
  const cache = await caches.open(SHELL);
  const assets = new Set(EXTRA);
  await Promise.all(
    PAGES.map(async (path) => {
      try {
        const res = await fetch(path, { cache: "no-store", credentials: "same-origin" });
        if (!res.ok) return;
        const html = await res.clone().text();
        for (const m of html.match(STATIC_RE) || []) assets.add(m);
        await cache.put(path, res);
      } catch {}
    }),
  );
  await Promise.all(
    [...assets].map((url) => cache.add(url).catch(() => {})),
  );
}

self.addEventListener("install", (e) => {
  e.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request, fallbackPath) {
  const cache = await caches.open(RUNTIME);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch (err) {
    const hit =
      (await caches.match(request)) ||
      (fallbackPath && (await caches.match(fallbackPath, { ignoreSearch: true }))) ||
      (fallbackPath && (await caches.match("/")));
    if (hit) return hit;
    throw err;
  }
}

async function cacheFirst(request) {
  const hit = await caches.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) (await caches.open(RUNTIME)).put(request, res.clone());
  return res;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === "/sw.js" || url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    e.respondWith(cacheFirst(req));
  } else if (req.mode === "navigate") {
    e.respondWith(networkFirst(req, url.pathname));
  } else {
    e.respondWith(networkFirst(req));
  }
});

// Web Push (phase 3) -----------------------------------------------------------
self.addEventListener("push", (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch {
    d = { body: e.data ? e.data.text() : "" };
  }
  e.waitUntil(
    self.registration.showNotification(d.title || "Effendy Family", {
      body: d.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: d.tag,
      data: { url: d.url || "/" },
    }),
  );
});

// Tapping a reminder opens its screen, reusing an open app window if there is one.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const win = list.find((c) => new URL(c.url).origin === self.location.origin);
      if (win) return win.focus().then((w) => (w || win).navigate(url));
      return self.clients.openWindow(url);
    }),
  );
});

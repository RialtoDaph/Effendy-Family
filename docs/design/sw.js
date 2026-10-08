// Effendy Family — offline support. Network first, cached copy when offline.
const CACHE = 'ef-v7';
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(k => k.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
});
self.addEventListener('push', e => { const d = e.data ? e.data.json() : {}; e.waitUntil(self.registration.showNotification(d.title || 'Effendy Family', { body: d.body || '' })); });
self.addEventListener('notificationclick', e => { e.notification.close(); e.waitUntil(self.clients.openWindow('./')); });

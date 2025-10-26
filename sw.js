// Cache-first for same-origin images
const CACHE_NAME = 'gallery-cache-v4';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isImage = req.destination === 'image' ||
                  /\.(png|jpg|jpeg|webp|gif|avif|svg)(\?.*)?$/i.test(url.pathname);

  if (isImage && url.origin === self.location.origin) {
    event.respondWith(cacheFirst(req));
  }
});

self.addEventListener('message', (event) => {
  const { type, urls } = event.data || {};
  if (type === 'warmCache' && Array.isArray(urls)) {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.all(urls.map(async (u) => {
        try {
          const r = await fetch(u, { cache: 'no-cache' });
          if (r.ok) await cache.put(u, r.clone());
        } catch {}
      }));
    })());
  }
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreVary: true, ignoreSearch: false });
  if (cached) return cached;

  const fresh = await fetch(request);
  if (fresh && fresh.ok) cache.put(request, fresh.clone());
  return fresh;
}

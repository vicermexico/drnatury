const CACHE_NAME = 'drbioescaner-v1';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (!req.url.startsWith('http')) return;

  const url = new URL(req.url);
  // No interceptar paginas dinamicas ni APIs, solo deja pasar
  if (
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/master') ||
    url.pathname.startsWith('/terapeuta') ||
    url.pathname.startsWith('/asistente') ||
    url.pathname.startsWith('/almacen') ||
    url.pathname.startsWith('/paciente') ||
    url.pathname.startsWith('/login') ||
    url.pathname.startsWith('/seleccionar-rol')
  ) {
    return;
  }

  event.respondWith(
    fetch(req)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(req);
        return cached || Response.error();
      })
  );
});

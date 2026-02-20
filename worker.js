const CACHE = 'webcard-v1';

const ASSETS = [
  '/index.html',
  '/404.html',
  '/manifest.json',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/data/index.json',
];

const getCardUrls = async (cache) => {
  try {
    const req = new Request('/data/index.json');
    const res = await fetch(req);
    if (res.ok) await cache.put(req, res.clone());
    const list = await res.json();
    return (list || []).map((p) => `/data/${p.id}.json`);
  } catch {
    return [];
  }
};

const updateCache = async () => {
  const cache = await caches.open(CACHE);
  const cardUrls = await getCardUrls(cache);
  const assets = [...ASSETS, ...cardUrls];
  await cache.addAll(assets);
};

const install = async () => {
  try {
    await updateCache();
    await self.skipWaiting();
  } catch (error) {
    console.error('Service Worker: Failed to cache assets:', error);
  }
};

self.addEventListener('install', (event) => {
  event.waitUntil(install());
});

const serveFromCache = async (request) => {
  const cache = await caches.open(CACHE);
  return cache.match(request);
};

const fetchFromNetwork = async (request) => {
  const networkResponse = await fetch(request);
  if (networkResponse.status === 200) {
    const cache = await caches.open(CACHE);
    await cache.put(request, networkResponse.clone());
  }
  return networkResponse;
};

const offlineFallback = async (request) => {
  const cachedResponse = await serveFromCache(request);
  if (cachedResponse) return cachedResponse;
  if (request.mode === 'navigate') {
    const cache = await caches.open(CACHE);
    const fallbackResponse = await cache.match('/index.html');
    if (fallbackResponse) return fallbackResponse;
  }
  return new Response('Offline - Content not available', {
    status: 503,
    statusText: 'Service Unavailable',
    headers: { 'Content-Type': 'text/plain' },
  });
};

const cleanupCache = async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
};

self.addEventListener('fetch', async (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (!request.url.startsWith('http')) return;
  const respond = async () => {
    try {
      const cachedResponse = await serveFromCache(request);
      if (cachedResponse) return cachedResponse;
      return await fetchFromNetwork(request);
    } catch {
      return await offlineFallback(request);
    }
  };
  event.respondWith(respond());
});

const activate = async () => {
  try {
    await cleanupCache();
    await self.clients.claim();
  } catch (error) {
    console.error('Service Worker: Activation failed:', error);
  }
};

self.addEventListener('activate', (event) => {
  event.waitUntil(activate());
});

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

const updateCache = async () => {
  const cache = await caches.open(CACHE);
  await cache.addAll(ASSETS);
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
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  return null;
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
  const cacheNames = await caches.keys();
  const deletePromises = cacheNames
    .filter((cacheName) => cacheName !== CACHE)
    .map((cacheName) => caches.delete(cacheName));
  await Promise.all(deletePromises);
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

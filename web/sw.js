// Poket Star EPOS — Progressive Web App Service Worker
// Enables Fast Startup & 100% Offline Access for Retail Sales & Multi-Organization Inventory

const CACHE_NAME = 'poketstar-pos-v7.0';
const ASSETS_TO_CACHE = [
  '/index.html',
  '/manifest.json',
  '/favicon.png'
];

// Install Event - Lightweight Parallel Precache for Instant Startup
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        ASSETS_TO_CACHE.map((asset) => cache.add(asset).catch(() => {}))
      );
    })
  );
});

// Activate Event - Clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Clearing old cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Cache First with Network Fallback for static assets, Offline Catalog for API
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Handle Products API endpoint offline fallback
  if (requestUrl.pathname === '/api/products' || requestUrl.pathname.startsWith('/api/products?')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedJson = await caches.match('/products.json');
          if (cachedJson) {
            const raw = await cachedJson.json();
            return new Response(
              JSON.stringify({ success: true, products: raw, total: raw.length, offline: true }),
              { headers: { 'Content-Type': 'application/json' } }
            );
          }
          const cachedApi = await caches.match(event.request);
          if (cachedApi) return cachedApi;
          return new Response(
            JSON.stringify({ success: true, products: [], offline: true, message: 'Offline local state active' }),
            { headers: { 'Content-Type': 'application/json' } }
          );
        })
    );
    return;
  }

  // Generic API calls: Network first, fallback to offline JSON response
  if (requestUrl.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return new Response(
            JSON.stringify({ offline: true, message: 'Poket Star POS operating in Offline Mode. Actions queued for sync.' }),
            { headers: { 'Content-Type': 'application/json' } }
          );
        })
    );
    return;
  }

  // For HTML / Navigation requests: Network first, fallback to offline cached index.html
  if (event.request.mode === 'navigate' || (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Static Assets: Cache first, background refresh
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {/* Offline fallback */});
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        return networkResponse;
      }).catch(() => {
        // Fallback to offline page shell
        if (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html')) {
          return caches.match('/index.html');
        }
      });
    })
  );
});

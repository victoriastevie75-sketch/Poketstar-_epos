// Poket Star EPOS — Progressive Web App Service Worker
// Enables 100% Offline Access for Retail Sales, Inventory & User Session Persistence

const CACHE_NAME = 'poketstar-pos-v1.0';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/src/assets/images/pocket_star_gold_silver_official_1785328099213.jpg',
  '/manifest.json'
];

// Install Event - Cache Core Assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching Poket Star EPOS app shell for offline access...');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
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

// Fetch Event - Cache First with Network Fallback for static assets, Network First for API
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Skip non-GET requests (or handle offline sync queue client-side)
  if (event.request.method !== 'GET') {
    return;
  }

  // API calls: Network first, fallback to cached or offline JSON response
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

  // Static Assets: Cache first, update in background
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch fresh copy in background to update cache
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
        if (event.request.headers.get('accept').includes('text/html')) {
          return caches.match('/index.html');
        }
      });
    })
  );
});

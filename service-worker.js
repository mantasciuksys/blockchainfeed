const CACHE_NAME = 'site-static-v1';
const DYNAMIC_CACHE_NAME = 'site-dynamic-v1';
const STATIC_FILES = [
  '/offline.html', // Consider adding an offline fallback page
  // Add paths to your CSS/JS/Images here, relative to your domain root
];

// Utility function to limit cache size
const limitCacheSize = (name, size) => {
  caches.open(name).then(cache => {
    cache.keys().then(keys => {
      if (keys.length > size) {
        cache.delete(keys[0]).then(limitCacheSize(name, size));
      }
    });
  });
};

// Install event
self.addEventListener('install', event => {
  // Cache static assets
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        cache.addAll(STATIC_FILES);
      })
  );
});

// Activate event
self.addEventListener('activate', event => {
  // Clean up old caches
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(keys
        .filter(key => key !== CACHE_NAME && key !== DYNAMIC_CACHE_NAME)
        .map(key => caches.delete(key))
      );
    })
  );
});

// Fetch event
self.addEventListener('fetch', event => {
  if (event.request.url.indexOf('https://tatum.io/curated-news/feed') > -1) {
    // Network-first strategy for feed
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clonedRes = res.clone();
          caches.open(DYNAMIC_CACHE_NAME).then(cache => {
            cache.put(event.request.url, clonedRes);
            limitCacheSize(DYNAMIC_CACHE_NAME, 15); // Keep only 15 items
          });
          return res;
        })
        .catch(() => caches.match(event.request))
    );
  } else if (STATIC_FILES.some(file => event.request.url.indexOf(file) > -1)) {
    // Cache-only strategy for static files
    event.respondWith(caches.match(event.request));
  } else {
    // Network-first strategy for other pages
    event.respondWith(
      caches.match(event.request).then(cacheRes => {
        return cacheRes || fetch(event.request).then(fetchRes => {
          return caches.open(DYNAMIC_CACHE_NAME).then(cache => {
            cache.put(event.request.url, fetchRes.clone());
            limitCacheSize(DYNAMIC_CACHE_NAME, 15); // Limit dynamic cache items
            return fetchRes;
          });
        });
      }).catch(() => {
        if (event.request.url.indexOf('.html') > -1) {
          return caches.match('/offline.html');
        }
      })
    );
  }
});

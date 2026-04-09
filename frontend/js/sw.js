const CACHE_NAME = 'smartbank-cache-v2';
const urlsToCache = [
    '/',
    '/mobile-auth.html',
    '/mobile-dash.html',
    '/manifest.json'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('fetch', event => {
    // Force network only during debug to prevent connection failures
    event.respondWith(fetch(event.request));
});

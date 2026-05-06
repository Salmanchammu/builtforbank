const CACHE_NAME = 'smartbank-cache-v3';
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
    // CRITICAL iOS SAFARI FIX:
    // WebKit throws 'DOMException: The string did not match the expected pattern.' 
    // when a Service Worker intercepts and replays a POST Request with a body.
    // Bypass all non-GET requests and API calls to prevent this.
    if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
        return; // Let the browser handle it natively
    }

    event.respondWith(fetch(event.request));
});

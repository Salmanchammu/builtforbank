const CACHE_NAME = 'smartbank-cache-v1';
const urlsToCache = [
    '/',
    '/mobile-login.html',
    '/mobile-dash.html',
    '/index.css',
    '/mobile-login.css',
    '/mobile-dash.css',
    '/script.js',
    '/userdash.js',
    '/api-config.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
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

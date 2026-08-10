// sw.js — тимчасова деактивація та очищення кешу
self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    console.log('[SW] Видалення кешу:', cache);
                    return caches.delete(cache);
                })
            );
        }).then(() => {
            return self.clients.claim();
        }).then(() => {
            // Скасовуємо реєстрацію цього Service Worker
            return self.registration.unregister();
        })
    );
});

// Усі мережеві запити пропускаємо напряму
self.addEventListener('fetch', (event) => {
    event.respondWith(fetch(event.request));
});

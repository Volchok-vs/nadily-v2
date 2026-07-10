const CACHE_NAME = 'territory-map-v1';

// Список ресурсів для обов'язкового попереднього кешування (App Shell)
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './profile.html',
    './parcel-details.html',
    './admin-statistics.html',
    './territories-manager.html',
    './dev-settings.html',
    './login.html',
    './favicon.ico',
    // CSS
    './css/style_mod.css',
    './css/responsive.css',
    './css/profile-style.css',
    // JS Модулі та скрипти
    './js/config.js',
    './js/main.js',
    './js/parcel-logic.js',
    './js/ui-controller.js',
    './js/campaign-modal.js',
    './js/map-styles.js',
    './js/geolocation.js',
    './js/search-filter.js',
    './js/status-helper.js',
    './js/dev-tools.js',
    // Зовнішні бібліотеки (CDN Leaflet)
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://fonts.googleapis.com/css2?family=Caveat:wght@400..700&display=swap'
];

// 1. Встановлення Service Worker та кешування статики
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Кешування App Shell');
            return cache.addAll(ASSETS_TO_CACHE);
        }).then(() => self.skipWaiting())
    );
});

// 2. Активація та очищення застарілого кешу
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('[SW] Видалення старого кешу:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 3. Перехоплення мережевих запитів (Fetch)
self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);

    // Ігноруємо запити до бази даних Supabase та системних Chrome-Extension (вони повинні йти через мережу)
    if (requestUrl.hostname.includes('supabase.co') || requestUrl.protocol === 'chrome-extension:') {
        return;
    }

    // Стратегія Cache First, then Network для статики
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                // Віддаємо з кешу і паралельно оновлюємо у фоні
                fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
                    }
                }).catch(() => {/* Ігноруємо помилки мережі у фоні */});

                return cachedResponse;
            }

            // Якщо в кеші немає — завантажуємо з мережі
            return fetch(event.request).then((networkResponse) => {
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse;
                }
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });
                return networkResponse;
            });
        })
    );
});
const CACHE_NAME = 'territory-map-v1';
const TILE_CACHE_NAME = 'map-tiles-v1'; // Окремий кеш для важких тайлів карти

// Створюємо канал для зв'язку з UI на будь-якій сторінці
const progressChannel = new BroadcastChannel('offline_download_channel');

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
    './js/offline-menu.js',
    './js/polygon-cacher.js',
    // Зовнішні бібліотеки
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm',
    'https://fonts.googleapis.com/css2?family=Caveat:wght@400..700&display=swap'
];

// 1. Встановлення Service Worker та кешування статики
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Кешування App Shell');
            return cache.addAll(ASSETS_TO_CACHE).catch(err => {
                console.error('[SW] Помилка при попередньому кешуванні файлів:', err);
            });
        }).then(() => self.skipWaiting())
    );
});

// 2. Активація та очищення застарілого кешу
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME && cache !== TILE_CACHE_NAME) {
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
    const url = new URL(event.request.url);

    // Перевіряємо, чи це запит тайлу OpenStreetMap
    if (url.hostname.endsWith('tile.openstreetmap.org')) {
        // Замінюємо будь-який субдомен (a.tile, b.tile, c.tile) на єдиний 'a.tile' або 'tile'
        const normalizedUrl = event.request.url.replace(/\/\/[abc]\.tile\./, '//a.tile.');

        event.respondWith(
            caches.match(normalizedUrl).then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                // Якщо немає в кеші та немає мережі, повертаємо помилку
                return fetch(event.request);
            })
        );
        return;
    }

    // Стратегія Cache First (з фоновим оновленням) для всього App Shell та CDN
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                // Оновлюємо ресурс у кеші у фоновому режимі (Stale-While-Revalidate)
                fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        // Використовуємо правильну змінну 'url' замість неіснуючої 'requestUrl'
                        const cacheToUse = url.pathname.includes('/tile/') || url.hostname.includes('tile.') ? TILE_CACHE_NAME : CACHE_NAME;
                        caches.open(cacheToUse).then((cache) => cache.put(event.request, networkResponse));
                    }
                }).catch(() => {/* Офлайн */});

                return cachedResponse;
            }

            // Якщо в кеші немає — дістаємо з мережі та динамічно кешуємо
            return fetch(event.request).then((networkResponse) => {
                if (!networkResponse || networkResponse.status !== 200) {
                    return networkResponse;
                }
                
                if (networkResponse.type === 'basic' || networkResponse.type === 'cors') {
                    const responseToCache = networkResponse.clone();
                    // Використовуємо правильну змінну 'url' замість неіснуючої 'requestUrl'
                    const cacheToUse = url.pathname.includes('/tile/') || url.hostname.includes('tile.') ? TILE_CACHE_NAME : CACHE_NAME;
                    caches.open(cacheToUse).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                
                return networkResponse;
            });
        })
    );
});

// 4. ФОНОВЕ ЗАВАНТАЖЕННЯ ТА ТРАНСЛЯЦІЯ ПРОГРЕСУ
self.addEventListener('message', (event) => {
    // Підтримуємо як "START_DOWNLOAD", так і "DOWNLOAD_TILES"
    if (event.data && (event.data.action === 'DOWNLOAD_TILES' || event.data.type === 'START_DOWNLOAD')) {
        const urls = event.data.urls || [];
        const provider = event.data.provider || 'default';
        
        console.log(`[SW] Почато фонове завантаження ${urls.length} тайлів для провайдера "${provider}".`);

        event.waitUntil(
            downloadTilesInBackground(provider, urls)
        );
    }
});

// Допоміжна функція фонового завантаження тайлів
async function downloadTilesInBackground(provider, urls) {
    const cache = await caches.open(TILE_CACHE_NAME);
    const total = urls.length;
    let downloaded = 0;

    // Сповіщаємо про початок завантаження
    progressChannel.postMessage({
        type: 'PROGRESS',
        provider,
        downloaded: 0,
        total,
        percent: 0
    });

    for (let i = 0; i < total; i++) {
        const url = urls[i];
        try {
            const match = await cache.match(url);
            if (!match) {
                const response = await fetch(url, { mode: 'cors' });
                if (response.ok) {
                    await cache.put(url, response);
                }
            }
        } catch (err) {
            console.warn('[SW] Помилка фонового завантаження тайла:', url, err);
        }

        downloaded++;

        // Відправляємо прогрес кожні 5 тайлів або наприкінці (щоб не перевантажувати канал)
        if (downloaded % 5 === 0 || downloaded === total) {
            const percent = Math.round((downloaded / total) * 100);
            progressChannel.postMessage({
                type: 'PROGRESS',
                provider,
                downloaded,
                total,
                percent
            });
        }
    }

    // Сповіщаємо сайт записати провайдера у localStorage
    progressChannel.postMessage({
        type: 'REGISTER_PROVIDER',
        provider
    });

    // Сповіщаємо про повне завершення
    progressChannel.postMessage({
        type: 'COMPLETE',
        provider,
        message: `Завантаження тайлів для "${provider}" завершено!`
    });

    console.log(`[SW] Завантаження для "${provider}" повністю виконано.`);
}
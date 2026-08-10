// Змінюємо версію, щоб браузер заново перекешував тільки необхідне
const CACHE_NAME = 'territory-map-v3';
const TILE_CACHE_NAME = 'map-tiles-v1';

const progressChannel = new BroadcastChannel('offline_download_channel');

// Список ресурсів суто для сторінки карти (Map App Shell)
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './favicon.ico',
    // CSS
    './css/style_mod.css',
    './css/responsive.css',
    // JS Скрипти карти
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
    './js/recommended-parcels.js',
    './js/force-reload.js',
    // Зовнішні бібліотеки (CDN)
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm',
    'https://cdn.jsdelivr.net/npm/@turf/turf@6/turf.min.js',
    'https://fonts.googleapis.com/css2?family=Caveat:wght@400..700&display=swap'
];

// Допоміжна функція нормалізації субдоменів (a, b, c -> a) для всіх провайдерів карт
function normalizeTileUrl(urlString) {
    try {
        const url = new URL(urlString);
        // Замінюємо субдомени a.tile, b.tile, c.tile чи a.tile.opentopomap.org на єдиний дзеркальний хост 'a.'
        url.hostname = url.hostname.replace(/^[a-c]\./, 'a.');
        return url.toString();
    } catch (e) {
        return urlString;
    }
}

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
    if (!event.request.url.startsWith('http://') && !event.request.url.startsWith('https://')) return;
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);
    const isTileRequest = url.pathname.includes('/tile/') ||
        url.hostname.includes('tile.') ||
        url.hostname.includes('opentopomap');

    // 1. ДЛЯ ТАЙЛІВ КАРТИ — Cache First (спочатку кеш, бо їх багато і вони не змінюються)
    if (isTileRequest) {
        const normalizedUrl = normalizeTileUrl(event.request.url);
        event.respondWith(
            caches.open(TILE_CACHE_NAME).then((cache) => {
                return cache.match(normalizedUrl).then((cachedResponse) => {
                    if (cachedResponse) return cachedResponse;

                    return fetch(event.request).then((networkResponse) => {
                        if (networkResponse && networkResponse.status === 200) {
                            cache.put(normalizedUrl, networkResponse.clone());
                        }
                        return networkResponse;
                    }).catch(() => new Response('', { status: 404, statusText: 'Tile Not In Cache' }));
                });
            })
        );
        return;
    }

    // 2. ДЛЯ КОДУ САЙТУ (HTML, JS, CSS) — Network First (спочатку мережа)
    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                // Якщо сервер відповів успішно — оновлюємо кеш у фоні та віддаємо свіжий файл
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
                }
                return networkResponse;
            })
            .catch(() => {
                // Якщо інтернету немає (офлайн) — беремо з кешу
                return caches.match(event.request);
            })
    );
});

// 4. ФОНОВЕ ЗАВАНТАЖЕННЯ ТА ТРАНСЛЯЦІЯ ПРОГРЕСУ
self.addEventListener('message', (event) => {
    if (event.data && (event.data.action === 'DOWNLOAD_TILES' || event.data.type === 'START_DOWNLOAD')) {
        const urls = event.data.urls || [];
        const provider = event.data.provider || 'default';

        console.log(`[SW] Почато фонове завантаження ${urls.length} тайлів для провайдера "${provider}".`);

        event.waitUntil(
            downloadTilesInBackground(provider, urls)
        );
    }
});

// Допоміжна функція завантаження тайла з повторними спробами (Retry)
async function fetchAndCacheTileWithRetry(cache, rawUrl, retriesLeft = 3) {
    const normalizedUrl = normalizeTileUrl(rawUrl);

    // Спочатку перевіряємо, чи вже збережено
    const match = await cache.match(normalizedUrl);
    if (match) {
        return true;
    }

    for (let attempt = 1; attempt <= retriesLeft; attempt++) {
        try {
            const response = await fetch(rawUrl, { mode: 'cors', cache: 'no-cache' });
            if (response.ok) {
                await cache.put(normalizedUrl, response);
                return true;
            }
        } catch (err) {
            // Мережевий збій або таймаут
        }

        // Затримка перед повторною спробою (300мс, 600мс...)
        if (attempt < retriesLeft) {
            await new Promise(res => setTimeout(res, attempt * 300));
        }
    }
    return false;
}

// Пакетне фонове завантаження з обмеженням навантаження на сервер
async function downloadTilesInBackground(provider, urls) {
    const cache = await caches.open(TILE_CACHE_NAME);
    const total = urls.length;
    const BATCH_SIZE = 5;  // Не більше 5 паралельних запитів
    const DELAY_MS = 80;    // Пауза між пакетами для запобігання бана/помилки 429

    let downloaded = 0;
    let failed = 0;

    progressChannel.postMessage({
        type: 'PROGRESS',
        provider,
        downloaded: 0,
        failed: 0,
        total,
        percent: 0
    });

    for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = urls.slice(i, i + BATCH_SIZE);

        await Promise.all(batch.map(async (url) => {
            const success = await fetchAndCacheTileWithRetry(cache, url, 3);
            if (success) {
                downloaded++;
            } else {
                failed++;
            }
        }));

        const processed = downloaded + failed;
        const percent = Math.round((processed / total) * 100);

        if (processed % 5 === 0 || processed === total) {
            progressChannel.postMessage({
                type: 'PROGRESS',
                provider,
                downloaded,
                failed,
                total,
                percent
            });
        }

        if (DELAY_MS > 0) {
            await new Promise(res => setTimeout(res, DELAY_MS));
        }
    }

    progressChannel.postMessage({
        type: 'REGISTER_PROVIDER',
        provider
    });

    progressChannel.postMessage({
        type: 'COMPLETE',
        provider,
        downloaded,
        failed,
        message: failed > 0
            ? `Завантаження "${provider}" завершено: ${downloaded} шт. успішно, ${failed} шт. з помилкою.`
            : `Успішно завантажено всі ${downloaded} тайлів для "${provider}"!`
    });

    console.log(`[SW] Завантаження для "${provider}" виконано. Успішно: ${downloaded}, збіїв: ${failed}.`);
}
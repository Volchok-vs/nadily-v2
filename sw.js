// Змінюємо версію, щоб браузер заново перекешував тільки необхідне
const CACHE_NAME = 'territory-map-v4';
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
        url.hostname = url.hostname.replace(/^[a-c]\./, 'a.');
        return url.toString();
    } catch (e) {
        return urlString;
    }
}

// 1. Встановлення Service Worker та миттєва активація
self.addEventListener('install', (event) => {
    self.skipWaiting(); // Пропускаємо стан очікування
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Кешування App Shell');
            return cache.addAll(ASSETS_TO_CACHE).catch(err => {
                console.error('[SW] Помилка при попередньому кешуванні файлів:', err);
            });
        })
    );
});

// 2. Активація та ВЗЯТТЯ КОНТРОЛЮ НАД СТОРІНКУ НЕГАЙНО
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
        }).then(() => self.clients.claim()) // ⚠️ ВАЖЛИВО: Захоплюємо керування всіма відкритими вкладками!
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

    // 1. ДЛЯ ТАЙЛІВ КАРТИ — Cache First
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

    // 2. ДЛЯ КОДУ САЙТУ (HTML, JS, CSS) — Network First
    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
                }
                return networkResponse;
            })
            .catch(() => {
                return caches.match(event.request);
            })
    );
});

// 4. ФОНОВЕ ЗАВАНТАЖЕННЯ ТА ТРАНСЛЯЦІЯ ПРОГРЕСУ
self.addEventListener('message', (event) => {
    if (!event.data) return;

    // Підтримка окремих запитів та пакетної черги
    if (event.data.action === 'DOWNLOAD_TILES' || event.data.type === 'START_DOWNLOAD') {
        const urls = event.data.urls || [];
        const provider = event.data.provider || 'default';

        console.log(`[SW] Почато фонове завантаження ${urls.length} тайлів для провайдера "${provider}".`);
        event.waitUntil(downloadTilesInBackground(provider, urls));
    } else if (event.data.action === 'START_BATCH_DOWNLOAD') {
        const queue = event.data.queue || [];
        event.waitUntil((async () => {
            for (const item of queue) {
                await downloadTilesInBackground(item.provider, item.urls);
            }
        })());
    }
});

// Допоміжна функція завантаження тайла з повторними спробами (Retry)
async function fetchAndCacheTileWithRetry(cache, rawUrl, retriesLeft = 3) {
    const normalizedUrl = normalizeTileUrl(rawUrl);

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
            // Мережевий збій
        }

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
    const BATCH_SIZE = 5;
    const DELAY_MS = 80;

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

        // Відправляємо прогрес на кожен пакет
        progressChannel.postMessage({
            type: 'PROGRESS',
            provider,
            downloaded,
            failed,
            total,
            percent
        });

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
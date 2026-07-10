/**
 * Модуль для розрахунку та кешування тайлів карти (Схема та Супутник) за полігонами дільниць
 */

// Конфігурація URL-шаблонів для ваших підкладок
export const TILE_PROVIDERS = {
    osm: {
        name: '🗺️ Схема (OSM)',
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', // або з {s}, скрипт автоматично замінить на a/b/c якщо треба, але openstreetmap підтримує і прямий url
        avgSizeKb: 25
    },
    topo: {
        name: '⛰️ Рельєф (Topo)',
        url: 'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
        avgSizeKb: 30
    },
    satellite: {
        name: '🛰️ Супутник (знімки)',
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        avgSizeKb: 35
    },
    labels: {
        name: '🏷️ Назви вулиць (Гібрид)',
        url: 'https://a.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png', // {r} зазвичай не обов'язковий для рендерингу тайлів назв
        avgSizeKb: 6 // Дуже легкі прозорі тайли
    }
};

function long2tile(lon, zoom) {
    return Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
}

function lat2tile(lat, zoom) {
    return Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
}

/**
 * Генерує унікальний список URLs тайлів для масиву полігонів та обраних провайдерів
 */
function getTileUrlsForLayers(layers, zooms, providersKeys) {
    const tileSet = new Set();

    layers.forEach(layer => {
        if (!layer.getBounds) return;
        const bounds = layer.getBounds();

        zooms.forEach(zoom => {
            const minX = long2tile(bounds.getWest(), zoom);
            const maxX = long2tile(bounds.getEast(), zoom);
            const minY = lat2tile(bounds.getNorth(), zoom);
            const maxY = lat2tile(bounds.getSouth(), zoom);

            for (let x = minX; x <= maxX; x++) {
                for (let y = minY; y <= maxY; y++) {
                    providersKeys.forEach(key => {
                        const template = TILE_PROVIDERS[key].url;
                        const url = template
                            .replace('{z}', zoom)
                            .replace('{x}', x)
                            .replace('{y}', y);
                        tileSet.add(url);
                    });
                }
            }
        });
    });

    return Array.from(tileSet);
}

/**
 * Оцінює кількість тайлів та вагу в МБ залежно від обраних шарів
 * @param {Array} polygons - Масив полігонів
 * @param {Array} zooms - Рівні зуму
 * @param {Array<string>} providersKeys - Наприклад, ['osm'], ['satellite'] або ['osm', 'satellite']
 */
export function estimateCacheSize(polygons, zooms = [13, 14, 15, 16, 17], providersKeys = ['osm']) {
    let totalTiles = 0;
    let totalSizeKB = 0;

    providersKeys.forEach(key => {
        const provider = TILE_PROVIDERS[key];
        // Рахуємо унікальні тайли суто для цього провайдера
        const urls = getTileUrlsForLayers(polygons, zooms, [key]);
        
        totalTiles += urls.length;
        totalSizeKB += urls.length * provider.avgSizeKb;
    });

    return {
        totalTiles,
        sizeMB: (totalSizeKB / 1024).toFixed(1)
    };
}

/**
 * Завантажує тайли у кеш браузера
 */
export async function cachePolygonsTiles(polygons, zooms = [13, 14, 15, 16, 17], providersKeys = ['osm'], onProgress = null) {
    const urls = getTileUrlsForLayers(polygons, zooms, providersKeys);
    const total = urls.length;
    let completed = 0;

    if (total === 0) return;

    const cache = await caches.open('map-tiles-v1');

    for (const url of urls) {
        try {
            const match = await cache.match(url);
            if (!match) {
                const response = await fetch(url, { mode: 'cors' });
                if (response.ok) {
                    await cache.put(url, response);
                }
            }
        } catch (err) {
            console.warn(`[Offline] Не вдалося скачати тайл: ${url}`, err);
        }

        completed++;
        if (onProgress) {
            onProgress(completed, total);
        }
    }
}
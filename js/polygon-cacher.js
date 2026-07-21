/**
 * Модуль для розрахунку та кешування тайлів карти (Схема та Супутник) за полігонами дільниць
 */

// Конфігурація URL-шаблонів для ваших підкладок
const TILE_PROVIDERS = {
    osm: {
        name: '🗺️ Схема (OSM)',
        url: 'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        avgSizeKb: 25
    },
    topo: {
        name: '⛰️ Рельєф (Topo)',
        url: 'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
        avgSizeKb: 30
    },
    satellite: {
        name: '🛰️ Супутник (знімки)',
        // УВАГА: Для Esri ArcGIS в URL іде спочатку Y, а потім X ({z}/{y}/{x})
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        avgSizeKb: 35
    },
    labels: {
        name: '🏷️ Назви вулиць (Гібрид)',
        url: 'https://a.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png',
        avgSizeKb: 6
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
 * Підтримує як передачу одного ключа ('osm'), так і масиву ключів (['osm', 'topo'])
 */
function getTileUrlsForPolygons(layers, zooms, providersKeys) {
    const tileSet = new Set();
    
    // Якщо передано один рядок замість масиву, загортаємо його в масив
    const keys = Array.isArray(providersKeys) ? providersKeys : [providersKeys];

    if (!layers || !Array.isArray(layers) || layers.length === 0) {
        console.warn('[PolygonCacher] Масив шарів/полігонів порожній!');
        return [];
    }

    layers.forEach(layer => {
        // Підтримка як Leaflet Layer (.getBounds()), так і сирих полігонів
        if (!layer || typeof layer.getBounds !== 'function') return;
        
        const bounds = layer.getBounds();
        if (!bounds || !bounds.isValid()) return;

        zooms.forEach(zoom => {
            const minX = long2tile(bounds.getWest(), zoom);
            const maxX = long2tile(bounds.getEast(), zoom);
            const minY = lat2tile(bounds.getNorth(), zoom);
            const maxY = lat2tile(bounds.getSouth(), zoom);

            for (let x = minX; x <= maxX; x++) {
                for (let y = minY; y <= maxY; y++) {
                    keys.forEach(key => {
                        if (!TILE_PROVIDERS[key]) return;

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

// Псевдонім для зворотної сумісності (якщо десь у коді залишився виклик getTileUrlsForLayers)
const getTileUrlsForLayers = getTileUrlsForPolygons;

/**
 * Оцінює кількість тайлів та вагу в МБ залежно від обраних шарів
 */
function estimateCacheSize(polygons, zooms = [13, 14, 15, 16, 17], providersKeys = ['osm']) {
    let totalTiles = 0;
    let totalSizeKB = 0;

    const keys = Array.isArray(providersKeys) ? providersKeys : [providersKeys];

    keys.forEach(key => {
        const provider = TILE_PROVIDERS[key];
        if (!provider) return;

        const urls = getTileUrlsForPolygons(polygons, zooms, [key]);
        
        totalTiles += urls.length;
        totalSizeKB += urls.length * provider.avgSizeKb;
    });

    return {
        totalTiles,
        sizeMB: (totalSizeKB / 1024).toFixed(1)
    };
}
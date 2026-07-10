import { cachePolygonsTiles, estimateCacheSize } from './polygon-cacher.js';

export function initOfflineDownloadControl(map, allTerritoriesLayer) {
    const downloadControl = L.control({ position: 'topright' });

    downloadControl.onAdd = function () {
        const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control offline-panel');
        
        Object.assign(div.style, {
            backgroundColor: '#fff',
            padding: '12px',
            borderRadius: '10px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            fontFamily: 'sans-serif',
            fontSize: '13px',
            color: '#333',
            minWidth: '220px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
        });

        div.innerHTML = `
            <div style="font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 3px;">📥 Офлайн Карта</div>
            
            <label style="font-size: 11px; color: #666;">1. Що завантажити:</label>
            <select id="offline-zone-select" style="padding: 5px; border-radius: 4px; border: 1px solid #ccc; outline: none; cursor: pointer;">
                <option value="all">🗺️ Усі дільниці</option>
                <option value="city">🏙️ Тільки місто</option>
                <option value="village">🏡 Тільки села</option>
            </select>

            <label style="font-size: 11px; color: #666; margin-top: 4px;">2. Шари карти:</label>
            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                <input type="checkbox" id="layer-osm" checked> 🗺️ Схема (OSM)
            </label>
            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                <input type="checkbox" id="layer-topo"> ⛰️ Рельєф (Topo)
            </label>
            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                <input type="checkbox" id="layer-hybrid"> 🛰️ Гібрид (Супутник + Назви)
            </label>

            <div id="offline-counter" style="background: #f5f5f5; padding: 6px; border-radius: 4px; font-size: 11px; margin-top: 4px; border-left: 3px solid #2196F3; line-height: 1.4;">
                Завантаження...
            </div>

            <button id="btn-start-download" style="background: #2196F3; color: #fff; border: none; padding: 7px; border-radius: 4px; font-weight: bold; cursor: pointer; margin-top: 3px; transition: background 0.2s;">
                Завантажити карту
            </button>
        `;

        L.DomEvent.disableClickPropagation(div);
        return div;
    };

    downloadControl.addTo(map);

    function getSelectedLayers(zone) {
        const layers = [];
        allTerritoriesLayer.eachLayer(layer => {
            if (layer instanceof L.Polygon) layers.push(layer);
        });

        if (zone === 'city') {
            return layers.filter(l => l.feature?.properties?.is_city === true || l.feature?.properties?.type === 'city' || l.feature?.properties?.tag === 'місто');
        } else if (zone === 'village') {
            return layers.filter(l => l.feature?.properties?.is_city === false || l.feature?.properties?.type === 'village' || l.feature?.properties?.tag === 'село');
        }
        return layers;
    }

    // Оновлена функція збору активних провайдерів з урахуванням Гібриду
    function getActiveProviders() {
        const providers = [];
        if (document.getElementById('layer-osm').checked) providers.push('osm');
        if (document.getElementById('layer-topo').checked) providers.push('topo');
        
        // Якщо обрано Гібрид — додаємо і сам супутник, і шар назв вулиць
        if (document.getElementById('layer-hybrid').checked) {
            providers.push('satellite');
            providers.push('labels');
        }
        return providers;
    }

    function updateLiveEstimation() {
        const zone = document.getElementById('offline-zone-select').value;
        const activeProviders = getActiveProviders();
        const filtered = getSelectedLayers(zone);
        const counterDiv = document.getElementById('offline-counter');
        const btn = document.getElementById('btn-start-download');

        if (activeProviders.length === 0 || filtered.length === 0) {
            counterDiv.innerHTML = `⚠️ Оберіть хоча б один шар та зону`;
            btn.disabled = true;
            btn.style.background = '#ccc';
            return;
        }

        btn.disabled = false;
        btn.style.background = '#2196F3';

        const targetZooms = [13, 14, 15, 16, 17];
        const estimation = estimateCacheSize(filtered, targetZooms, activeProviders);

        counterDiv.innerHTML = `
            📍 Дільниць: <b>${filtered.length}</b><br>
            🖼️ Всього тайлів: <b>~${estimation.totalTiles}</b> шт.<br>
            💾 Спільний об'єм: <b style="color:#e91e63;">~${estimation.sizeMB} МБ</b>
        `;
    }

    // Навішуємо прослуховувачі подій зміни
    setTimeout(() => {
        document.getElementById('offline-zone-select').addEventListener('change', updateLiveEstimation);
        document.getElementById('layer-osm').addEventListener('change', updateLiveEstimation);
        document.getElementById('layer-topo').addEventListener('change', updateLiveEstimation);
        document.getElementById('layer-hybrid').addEventListener('change', updateLiveEstimation);
        
        updateLiveEstimation();
    }, 100);

    // Логіка старту скачування
    document.body.addEventListener('click', async (e) => {
        if (e.target && e.target.id === 'btn-start-download') {
            const zone = document.getElementById('offline-zone-select').value;
            const activeProviders = getActiveProviders();
            const filtered = getSelectedLayers(zone);
            
            if (filtered.length === 0 || activeProviders.length === 0) return;

            const targetZooms = [13, 14, 15, 16, 17];
            const est = estimateCacheSize(filtered, targetZooms, activeProviders);

            const isConfirmed = confirm(`Почати збереження?\nБуде скачано близько ${est.totalTiles} зображень шарів карти (~${est.sizeMB} МБ) для офлайн роботи.`);
            if (!isConfirmed) return;

            const btn = e.target;
            btn.disabled = true;
            btn.style.background = '#ffa000';

            const progressBox = document.querySelector('.accuracy-info-box') || createProgressBox();
            progressBox.style.display = 'block';
            progressBox.style.opacity = '1';

            await cachePolygonsTiles(filtered, targetZooms, activeProviders, (done, total) => {
                const percent = Math.round((done / total) * 100);
                btn.innerText = `Скачування... ${percent}%`;
                progressBox.innerHTML = `📥 Збереження карти: <b>${percent}%</b> (${done}/${total})`;
            });

            progressBox.innerHTML = `✅ Карта успішно збережена для офлайн-режиму!`;
            btn.disabled = false;
            btn.style.background = '#2196F3';
            btn.innerText = `Завантажити карту`;
            
            setTimeout(() => { progressBox.style.display = 'none'; }, 4000);
            updateLiveEstimation();
        }
    });
}

function createProgressBox() {
    const box = L.DomUtil.create('div', 'accuracy-info-box', document.body);
    Object.assign(box.style, {
        position: 'fixed', bottom: '25px', left: '50%', transform: 'translateX(-50%)',
        backgroundColor: 'rgba(0,0,0,0.85)', color: '#fff', padding: '8px 18px',
        borderRadius: '25px', fontSize: '13px', zIndex: '10002', textAlign: 'center'
    });
    return box;
}
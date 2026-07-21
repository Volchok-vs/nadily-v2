// =========================================================================
// 1. РАДІОКАНАЛ ДЛЯ ОТРИМАННЯ ПРОГРЕСУ ВІД SERVICE WORKER (ПРАЦЮЄ НА ВСІХ СТОРІНКАХ)
// =========================================================================
const progressChannel = new BroadcastChannel('offline_download_channel');

progressChannel.onmessage = (event) => {
    const data = event.data;
    const progressBox = createProgressBox();

    if (data.type === 'PROGRESS') {
        progressBox.style.display = 'block';
        progressBox.innerHTML = `📦 Завантаження (${data.provider}): ${data.downloaded}/${data.total} (${data.percent}%)`;
    }

    if (data.type === 'COMPLETE') {
        progressBox.innerHTML = `🎉 ${data.message}`;
        setTimeout(() => progressBox.remove(), 4000);

        // Оновлюємо список завантаженого в модальному вікні, якщо воно відкрите
        renderDownloadedZonesList();
    }

    if (data.type === 'REGISTER_PROVIDER') {
        const saved = JSON.parse(localStorage.getItem('offline_available_providers') || '[]');
        if (!saved.includes(data.provider)) {
            saved.push(data.provider);
            localStorage.setItem('offline_available_providers', JSON.stringify(saved));
        }
    }
};

// 2. Функція відображення списку вже завантажених зон із кнопкою видалення
function renderDownloadedZonesList() {
    const container = document.getElementById('downloaded-zones-history');
    if (!container) return;

    const downloadedZones = JSON.parse(localStorage.getItem('offline_downloaded_zones') || '[]');

    if (downloadedZones.length === 0) {
        container.innerHTML = '<small style="color:#888;">Немає збережених офлайн-зон</small>';
        return;
    }

    let html = '<div style="font-size: 12px; color: #28a745; font-weight: bold; margin-bottom: 6px;">🟢 Завантажені офлайн-зони:</div>';

    downloadedZones.forEach((item, index) => {
        html += `
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: #444; background: #eef9f2; padding: 6px 10px; border-radius: 6px; margin-bottom: 4px; border: 1px solid #d4edda;">
                <div>
                    📍 <strong>${item.zoneName}</strong><br>
                    <span style="color: #666; font-size: 10px;">Шари: ${item.providers.join(', ')} (${item.date || ''})</span>
                </div>
                <button onclick="window.deleteOfflineZone(${index})" style="background: #ff4d4d; color: white; border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 10px; font-weight: bold;">
                    Видалити
                </button>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Функція видалення конкретної збереженої зони та очищення кешу тайлів
window.deleteOfflineZone = async function(index) {
    if (!confirm('Ви дійсно хочете видалити цю офлайн-карту та очистити кеш?')) return;

    let downloadedZones = JSON.parse(localStorage.getItem('offline_downloaded_zones') || '[]');
    
    // Видаляємо елемент із масиву за індексом
    downloadedZones.splice(index, 1);
    localStorage.setItem('offline_downloaded_zones', JSON.stringify(downloadedZones));

    // Очищаємо кеш тайлів у браузері (map-tiles-v1)
    if ('caches' in window) {
        try {
            await caches.delete('map-tiles-v1');
            console.log('[App] Кеш тайлів успішно очищено.');
        } catch (e) {
            console.error('[App] Помилка видалення кешу:', e);
        }
    }

    // Також очищаємо загальні провайдери
    localStorage.removeItem('offline_available_providers');

    // Оновлюємо інтерфейс списку у вікні
    renderDownloadedZonesList();
    alert('Офлайн-карта та її кеш успішно видалені!');
};

// =========================================================================
// 2. ОСНОВНИЙ КОНТРОЛЕР МЕНЮ ОФЛАЙН ЗАВАНТАЖЕННЯ
// =========================================================================
function initOfflineDownloadControl(map, allParcelsGroup) {
    const OfflineControl = L.Control.extend({
        options: {
            position: 'topleft'
        },

        onAdd: function (map) {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');

            const button = L.DomUtil.create('a', 'leaflet-control-offline', container);
            button.innerHTML = '💾';
            button.href = '#';
            button.title = 'Завантаження офлайн карти';
            Object.assign(button.style, {
                backgroundColor: '#fff', fontSize: '18px', display: 'flex',
                alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                width: '34px', height: '34px'
            });

            // 1. Створюємо модальне вікно один раз
            let modal = document.getElementById('offline-modal');
            let historyBox, selectZone, checkboxes = {}, downloadBtn, sizeInfoBox;

            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'offline-modal';
                Object.assign(modal.style, {
                    position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
                    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: '9999', display: 'none',
                    alignItems: 'center', justifyContent: 'center'
                });

                const modalContent = document.createElement('div');
                Object.assign(modalContent.style, {
                    backgroundColor: '#fff', padding: '20px', borderRadius: '12px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.2)', width: '320px', position: 'relative'
                });

                // Хрестик для закриття
                const closeBtn = document.createElement('span');
                closeBtn.innerHTML = '&times;';
                Object.assign(closeBtn.style, {
                    position: 'absolute', top: '10px', right: '15px', fontSize: '24px',
                    cursor: 'pointer', color: '#aaa'
                });
                closeBtn.onclick = () => { modal.style.display = 'none'; };
                modalContent.appendChild(closeBtn);

                // Заголовок
                const title = document.createElement('h3');
                title.innerHTML = '📥 Офлайн Карта';
                title.style.margin = '0 0 15px 0';
                modalContent.appendChild(title);

                // --- 1. СЕЛЕКТ ЗОН ---
                const labelZone = document.createElement('div');
                labelZone.innerHTML = '<small style="color:#666;">1. Що завантажити:</small>';
                labelZone.style.marginBottom = '5px';
                modalContent.appendChild(labelZone);

                selectZone = document.createElement('select');
                selectZone.id = 'offline-zone-select';
                Object.assign(selectZone.style, {
                    width: '100%', padding: '8px', marginBottom: '15px', borderRadius: '6px', border: '1px solid #ccc'
                });
                selectZone.innerHTML = `
                    <option value="city" selected>🏙️ Тільки Місто (Липовець)</option>
                    <option value="village">🏡 Тільки Села</option>
                    <option value="all">🗺️ Усі дільниці (Місто + Села)</option>
                    <option value="screen">📱 Поточний вигляд екрана</option>
                `;
                modalContent.appendChild(selectZone);

                // --- 2. ЧЕКБОКСИ ШАРІВ ---
                const labelLayers = document.createElement('div');
                labelLayers.innerHTML = '<small style="color:#666;">2. Шари карти:</small>';
                labelLayers.style.marginBottom = '5px';
                modalContent.appendChild(labelLayers);

                const layersContainer = document.createElement('div');
                layersContainer.style.marginBottom = '15px';

                const providers = [
                    { id: 'osm', label: '🗺️ Схема (OSM)' },
                    { id: 'topo', label: '⛰️ Рельєф (Topo)' },
                    { id: 'satellite', label: '🛰️ Гібрид (Супутник + Назви)' }
                ];

                providers.forEach(p => {
                    const row = document.createElement('label');
                    Object.assign(row.style, {
                        display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', cursor: 'pointer'
                    });

                    const chk = document.createElement('input');
                    chk.type = 'checkbox';
                    chk.checked = (p.id === 'osm');

                    row.appendChild(chk);
                    row.appendChild(document.createTextNode(p.label));
                    layersContainer.appendChild(row);

                    checkboxes[p.id] = chk;
                });
                modalContent.appendChild(layersContainer);

                // --- 3. БЛОК РОЗРАХУНКУ ВАГИ КЕШУ ---
                sizeInfoBox = document.createElement('div');
                sizeInfoBox.id = 'offline-size-info';
                Object.assign(sizeInfoBox.style, {
                    backgroundColor: '#f8f9fa', padding: '10px', borderRadius: '6px',
                    border: '1px solid #e9ecef', marginBottom: '15px', fontSize: '13px', color: '#333'
                });
                modalContent.appendChild(sizeInfoBox);

                // --- 🌟 4. БЛОК ІСТОРІЇ ЗБЕРЕЖЕНИХ ЗОН (ГАРАНТОВАНО ДОДАЄТЬСЯ) ---
                historyBox = document.createElement('div');
                historyBox.id = 'downloaded-zones-history';
                Object.assign(historyBox.style, {
                    marginBottom: '15px',
                    padding: '8px',
                    backgroundColor: '#f1f8f5',
                    borderRadius: '6px',
                    border: '1px solid #d4edda'
                });
                modalContent.appendChild(historyBox);

                // --- 5. КНОПКА ЗАПУСКУ ЗАВАНТАЖЕННЯ ---
                downloadBtn = document.createElement('button');
                downloadBtn.innerHTML = 'Завантажити карту';
                Object.assign(downloadBtn.style, {
                    width: '100%', padding: '10px', backgroundColor: '#007bff', color: '#fff',
                    border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer'
                });

                downloadBtn.onclick = async () => {
                    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
                        alert('⚠️ Service Worker не активний!');
                        return;
                    }

                    const targetZone = selectZone.value;
                    const targetZoneLabel = selectZone.options[selectZone.selectedIndex].text;
                    const selectedProviders = Object.keys(checkboxes).filter(id => checkboxes[id].checked);
                    if (selectedProviders.includes('satellite')) {
                        selectedProviders.push('labels');
                    }

                    modal.style.display = 'none';
                    const progressBox = createProgressBox();
                    progressBox.innerHTML = '⏳ Формування списку тайлів...';

                    try {
                        const filteredPolygons = getFilteredPolygons(targetZone);
                        if (filteredPolygons.length === 0) {
                            progressBox.innerHTML = '❌ Немає полігонів для завантаження.';
                            setTimeout(() => progressBox.remove(), 3000);
                            return;
                        }

                        const zooms = [13, 14, 15, 16, 17];
                        for (const provider of selectedProviders) {
                            let urls = [];
                            if (typeof getTileUrlsForPolygons === 'function') {
                                urls = getTileUrlsForPolygons(filteredPolygons, zooms, provider);
                            }
                            if (urls.length > 0) {
                                navigator.serviceWorker.controller.postMessage({
                                    action: 'DOWNLOAD_TILES',
                                    provider: provider,
                                    urls: urls
                                });
                            }
                        }

                        // Записуємо в localStorage
                        const downloadedZones = JSON.parse(localStorage.getItem('offline_downloaded_zones') || '[]');
                        downloadedZones.push({
                            zoneName: targetZoneLabel,
                            providers: selectedProviders,
                            date: new Date().toLocaleDateString()
                        });
                        localStorage.setItem('offline_downloaded_zones', JSON.stringify(downloadedZones));

                        progressBox.innerHTML = '🚀 Завдання передано у фоновий режим!';
                    } catch (err) {
                        console.error('Помилка формування списку тайлів:', err);
                        progressBox.innerHTML = '❌ Помилка підготовки завантаження.';
                        setTimeout(() => progressBox.remove(), 3000);
                    }
                };

                modalContent.appendChild(downloadBtn);
                modal.appendChild(modalContent);
                document.body.appendChild(modal);
            }

            // Допоміжна функція фільтрації полігонів
            const getFilteredPolygons = (zoneValue) => {
                const allLayers = [];
                if (!allParcelsGroup) return allLayers;
                allParcelsGroup.eachLayer(layer => allLayers.push(layer));

                if (zoneValue === 'all') return allLayers;
                if (zoneValue === 'screen') {
                    const mapBounds = map.getBounds();
                    return allLayers.filter(layer => typeof layer.getBounds === 'function' && mapBounds.intersects(layer.getBounds()));
                }

                return allLayers.filter(layer => {
                    const layerId = layer.options?.id || layer.feature?.id || layer.feature?.properties?.id;
                    const layerName = layer.options?.name || layer.feature?.properties?.name;
                    const globalData = window.allParcelLayers?.find(i => (layerId && i.id === layerId) || (layerName && i.name === layerName) || i.layer === layer);
                    const category = globalData?.category || layer.options?.category || layer.feature?.properties?.category;
                    const isVillage = category === 'Село';
                    const isCity = !isVillage;

                    return zoneValue === 'city' ? isCity : isVillage;
                });
            };

            // Логіка оновлення розміру
            const currentSelect = document.getElementById('offline-zone-select');
            if (currentSelect) {
                currentSelect.onchange = () => {
                    // тут виконується логіка розрахунку ваги, якщо потрібна
                };
            }

            // 2. Відкриття модального вікна та ОНОВЛЕННЯ СПИСКУ ІСТОРІЇ
            L.DomEvent.on(button, 'click', function (e) {
                L.DomEvent.stopPropagation(e);
                L.DomEvent.preventDefault(e);
                modal.style.display = (modal.style.display === 'flex') ? 'none' : 'flex';

                // ✨ Оновлюємо історію щоразу при відкритті вікна
                renderDownloadedZonesList();
            });

            L.DomEvent.disableClickPropagation(container);
            L.DomEvent.on(modal, 'click', function (e) {
                if (e.target === modal) modal.style.display = 'none';
            });

            return container;
        }
    });

    map.addControl(new OfflineControl());
}

function createProgressBox() {
    let box = document.getElementById('offline-progress-box');
    if (!box) {
        box = L.DomUtil.create('div', 'accuracy-info-box', document.body);
        box.id = 'offline-progress-box';
        Object.assign(box.style, {
            position: 'fixed', bottom: '25px', left: '50%', transform: 'translateX(-50%)',
            backgroundColor: 'rgba(0,0,0,0.85)', color: '#fff', padding: '10px 20px',
            borderRadius: '25px', fontSize: '13px', zIndex: '10002', textAlign: 'center',
            boxShadow: '0 2px 10px rgba(0,0,0,0.3)'
        });
    }
    return box;
}
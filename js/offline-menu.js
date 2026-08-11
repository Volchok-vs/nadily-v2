// =========================================================================
// 1. РАДІОКАНАЛ ДЛЯ ОТРИМАННЯ ПРОГРЕСУ ВІД SERVICE WORKER
// =========================================================================
const progressChannel = new BroadcastChannel('offline_download_channel');

// ✅ ПОВНОЦІННИЙ ОБРОБНИК ПРОГРЕСУ (Малює та оновлює смуги)
progressChannel.onmessage = (event) => {
    const data = event.data;
    if (!data) return;

    const progressBox = document.getElementById('offline-progress-box');
    if (!progressBox) return;

    if (data.type === 'PROGRESS') {
        let barContainer = document.getElementById(`progress-bar-${data.provider}`);

        // Якщо смуги для цього провайдера ще немає — створюємо її
        if (!barContainer) {
            barContainer = document.createElement('div');
            barContainer.id = `progress-bar-${data.provider}`;
            barContainer.style.cssText = 'margin-top: 8px; text-align: left; min-width: 220px;';
            barContainer.innerHTML = `
                <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px;">
                    <span><b>${data.provider.toUpperCase()}</b></span>
                    <span id="percent-${data.provider}">0%</span>
                </div>
                <div style="background: rgba(255, 255, 255, 0.2); height: 8px; border-radius: 4px; overflow: hidden;">
                    <div id="fill-${data.provider}" style="background: #4caf50; height: 100%; width: 0%; transition: width 0.2s;"></div>
                </div>
            `;
            progressBox.appendChild(barContainer);
        }

        // Оновлюємо значення
        const fill = document.getElementById(`fill-${data.provider}`);
        const percentText = document.getElementById(`percent-${data.provider}`);

        if (fill) fill.style.width = `${data.percent}%`;
        if (percentText) percentText.innerText = `${data.percent}% (${data.downloaded}/${data.total})`;
    }

    if (data.type === 'COMPLETE') {
        const fill = document.getElementById(`fill-${data.provider}`);
        if (fill) fill.style.background = '#2196F3'; // Синє підсвічування після завершення

        // Автоматично ховаємо плашку через 4 секунди після повного завершення
        setTimeout(() => {
            if (progressBox && !progressBox.querySelector('[id^="fill-"]:not([style*="background: rgb(33, 150, 243)"])')) {
                progressBox.remove();
            }
        }, 4000);
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
window.deleteOfflineZone = async function (index) {
    if (!confirm('Ви дійсно хочете видалити цю офлайн-карту та очистити кеш?')) return;

    let downloadedZones = JSON.parse(localStorage.getItem('offline_downloaded_zones') || '[]');
    const targetItem = downloadedZones[index];

    // Видаляємо елемент із масиву за індексом
    downloadedZones.splice(index, 1);
    localStorage.setItem('offline_downloaded_zones', JSON.stringify(downloadedZones));

    // 🟢 ДОДАНО: Видаляємо кешований GeoJSON для цієї зони (якщо він є)
    if (targetItem) {
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('offline_geojson_')) {
                localStorage.removeItem(key);
            }
        });
    }

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
// 2. ОСНОВНИЙ КОНТРОЛЕР МЕНЮ ОФЛАЙН ЗАВАНТАЖЕННЯ (З ДІАГНОСТИКОЮ)
// =========================================================================
function initOfflineDownloadControl(map, allParcelsGroup) {
    // 🛑 ПЕРЕВІРКА: Якщо кнопка вже створена в DOM — перериваємо повторну ініціалізацію
    if (document.querySelector('.leaflet-control-offline')) {
        console.log('ℹ️ [OfflineControl] Кнопка офлайн завантаження вже існує.');
        return;
    }

    console.group('🔍 [OfflineControl] Діагностика пошуку контейнерів');

    // 1. Перевіряємо всі існуючі бари у верхньому лівому кутку
    const allBars = document.querySelectorAll('.leaflet-top.leaflet-left .leaflet-bar');
    console.log('Знайдено існуючих .leaflet-bar у .leaflet-top.leaflet-left:', allBars.length, allBars);

    let parentBar = document.querySelector('.leaflet-top.leaflet-left .leaflet-bar');

    if (parentBar) {
        console.log('✅ Успіх: Кнопка 💾 буде додана в існуючий .leaflet-bar:', parentBar);
    } else {
        console.warn('⚠️ .leaflet-bar не знайдено! Перевіряємо наявність кутового контейнера .leaflet-top.leaflet-left...');
        const topLeft = document.querySelector('.leaflet-top.leaflet-left');

        if (topLeft) {
            console.log('📍 Контейнер .leaflet-top.leaflet-left знайдено. Створюємо НОВИЙ .leaflet-bar:', topLeft);
            parentBar = L.DomUtil.create('div', 'leaflet-bar leaflet-control', topLeft);
        } else {
            console.error('❌ Помилка: Контейнер .leaflet-top.leaflet-left взагалі відсутній у DOM!');
            console.groupEnd();
            return;
        }
    }
    console.groupEnd();

    // 2. Створюємо елемент кнопки 💾 та додаємо в parentBar
    const button = L.DomUtil.create('button', 'leaflet-control-offline leaflet-custom-btn', parentBar);
    button.type = 'button';
    button.innerHTML = '💾';
    button.title = 'Завантаження офлайн карти';

    // --- 1. Створюємо або отримуємо модальне вікно ---
    let modal = document.getElementById('offline-modal');

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

        const selectZone = document.createElement('select');
        selectZone.id = 'offline-zone-select';
        Object.assign(selectZone.style, {
            width: '100%', padding: '8px', marginBottom: '15px', borderRadius: '6px', border: '1px solid #ccc'
        });
        selectZone.innerHTML = `
            <option value="all">🗺️ Усі дільниці (Місто + Села)</option>
            <option value="city" selected>🏙️ Тільки Місто (Липовець)</option>
            <option value="village">🏡 Тільки Села</option>
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
            chk.checked = false;
            chk.dataset.providerId = p.id;
            chk.className = 'offline-layer-chk';

            row.appendChild(chk);
            row.appendChild(document.createTextNode(p.label));
            layersContainer.appendChild(row);
        });
        modalContent.appendChild(layersContainer);

        // --- 3. БЛОК ВИБОРУ ЗУМІВ (НЕПЕРЕРВНИЙ ДІАПАЗОН) ---
        const labelZooms = document.createElement('div');
        labelZooms.innerHTML = '<small style="color:#666;">3. Рівні деталізації (зум від - до):</small>';
        labelZooms.style.marginBottom = '5px';
        modalContent.appendChild(labelZooms);

        const zoomsContainer = document.createElement('div');
        Object.assign(zoomsContainer.style, {
            display: 'flex', justifyContent: 'space-between', marginBottom: '15px',
            backgroundColor: '#f8f9fa', padding: '8px 12px', borderRadius: '6px',
            border: '1px solid #e9ecef'
        });

        const availableZooms = [13, 14, 15, 16, 17];
        let currentMinZoom = 13;
        let currentMaxZoom = 17;

        availableZooms.forEach(z => {
            const wrapper = document.createElement('label');
            Object.assign(wrapper.style, {
                display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer'
            });

            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.checked = true;
            chk.className = 'offline-zoom-chk';
            chk.dataset.zoom = z;

            chk.onchange = (e) => {
                e.preventDefault();
                const clickedZ = parseInt(z, 10);

                if (currentMinZoom === currentMaxZoom && clickedZ === currentMinZoom) {
                    // Не дозволяємо зняти єдиний залишився зум
                } else if (clickedZ < currentMinZoom) {
                    currentMinZoom = clickedZ;
                } else if (clickedZ > currentMaxZoom) {
                    currentMaxZoom = clickedZ;
                } else if (clickedZ === currentMinZoom) {
                    currentMinZoom++;
                } else if (clickedZ === currentMaxZoom) {
                    currentMaxZoom--;
                } else {
                    currentMaxZoom = clickedZ - 1;
                }

                document.querySelectorAll('.offline-zoom-chk').forEach(c => {
                    const val = parseInt(c.dataset.zoom, 10);
                    c.checked = (val >= currentMinZoom && val <= currentMaxZoom);
                });

                updateEstimatedSize();
            };

            const span = document.createElement('span');
            span.style.fontSize = '11px';
            span.style.marginTop = '3px';
            span.style.fontWeight = 'bold';
            span.innerText = `x${z}`;

            wrapper.appendChild(chk);
            wrapper.appendChild(span);
            zoomsContainer.appendChild(wrapper);
        });
        modalContent.appendChild(zoomsContainer);

        // --- 4. БЛОК РОЗРАХУНКУ ВАГИ КЕШУ ---
        const sizeInfoBox = document.createElement('div');
        sizeInfoBox.id = 'offline-size-info';
        Object.assign(sizeInfoBox.style, {
            backgroundColor: '#f8f9fa', padding: '10px', borderRadius: '6px',
            border: '1px solid #e9ecef', marginBottom: '15px', fontSize: '13px', color: '#333'
        });
        modalContent.appendChild(sizeInfoBox);

        // --- 5. БЛОК ІСТОРІЇ ЗБЕРЕЖЕНИХ ЗОН ---
        const historyBox = document.createElement('div');
        historyBox.id = 'downloaded-zones-history';
        Object.assign(historyBox.style, {
            marginBottom: '15px',
            padding: '8px',
            backgroundColor: '#f1f8f5',
            borderRadius: '6px',
            border: '1px solid #d4edda'
        });
        modalContent.appendChild(historyBox);

        // --- 6. КНОПКА ЗАПУСКУ ЗАВАНТАЖЕННЯ ---
        const downloadBtn = document.createElement('button');
        downloadBtn.id = 'offline-download-btn';
        downloadBtn.innerHTML = 'Завантажити карту';
        Object.assign(downloadBtn.style, {
            width: '100%', padding: '10px', backgroundColor: '#007bff', color: '#fff',
            border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer'
        });

        downloadBtn.onclick = async () => {
            if (!('serviceWorker' in navigator)) {
                alert('⚠️ Ваш браузер не підтримує Service Worker!');
                return;
            }

            // Чекаємо готовності Service Worker
            const reg = await navigator.serviceWorker.ready;
            const worker = navigator.serviceWorker.controller || reg.active;

            if (!worker) {
                alert('⚠️ Service Worker не активний!');
                return;
            }

            const currentSelect = document.getElementById('offline-zone-select');
            const targetZone = currentSelect ? currentSelect.value : 'city';
            const targetZoneLabel = currentSelect ? currentSelect.options[currentSelect.selectedIndex].text : '';

            const selectedCheckboxes = document.querySelectorAll('.offline-layer-chk:checked');
            const selectedProviders = Array.from(selectedCheckboxes).map(c => c.dataset.providerId);

            if (selectedProviders.length === 0) {
                alert('⚠️ Будь ласка, оберіть хоча б один шар комплектації!');
                return;
            }

            if (selectedProviders.includes('satellite')) {
                selectedProviders.push('labels');
            }

            modal.style.display = 'none';

            // Очищаємо вміст плашки перед новим завантаженням
            const progressBox = createProgressBox();
            progressBox.innerHTML = '<div style="font-weight:bold; margin-bottom:5px;">🚀 Завантаження карти...</div>';

            try {
                const filteredPolygons = getFilteredPolygons(targetZone);
                if (filteredPolygons.length === 0) {
                    progressBox.innerHTML = '❌ Немає полігонів для завантаження.';
                    setTimeout(() => progressBox.remove(), 3000);
                    return;
                }

                // 💾 -----------------------------------------------------------------
                // КРОК 1: Зберігаємо полігони обраної зони в localStorage для офлайну
                // ---------------------------------------------------------------------
                const rawGeoData = filteredPolygons.map(layer => {
                    if (typeof layer.toGeoJSON === 'function') {
                        return layer.toGeoJSON();
                    }
                    return null;
                }).filter(Boolean);

                if (rawGeoData.length > 0) {
                    const featureCollection = {
                        type: 'FeatureCollection',
                        features: rawGeoData
                    };
                    localStorage.setItem(`offline_geojson_${targetZone}`, JSON.stringify(featureCollection));
                    console.log(`✅ Полігони зони "${targetZone}" успішно збережені в localStorage (${rawGeoData.length} шт.)`);
                }
                // ---------------------------------------------------------------------

                const zooms = getSelectedZooms();
                for (const provider of selectedProviders) {
                    let urls = [];
                    if (typeof getTileUrlsForPolygons === 'function') {
                        urls = getTileUrlsForPolygons(filteredPolygons, zooms, provider);
                    }
                    if (urls.length > 0) {
                        worker.postMessage({
                            action: 'DOWNLOAD_TILES',
                            provider: provider,
                            urls: urls
                        });
                    }
                }

                const downloadedZones = JSON.parse(localStorage.getItem('offline_downloaded_zones') || '[]');
                downloadedZones.push({
                    zoneName: targetZoneLabel,
                    providers: selectedProviders,
                    date: new Date().toLocaleDateString()
                });
                localStorage.setItem('offline_downloaded_zones', JSON.stringify(downloadedZones));

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

    // Допоміжна функція отримання активних зумів
    const getSelectedZooms = () => {
        const checkedBoxes = Array.from(document.querySelectorAll('.offline-zoom-chk:checked'));
        return checkedBoxes.map(c => parseInt(c.dataset.zoom, 10)).sort((a, b) => a - b);
    };

    // Допоміжна функція фільтрації полігонів
    const getFilteredPolygons = (zoneValue) => {
        const allLayers = [];
        if (!allParcelsGroup) return allLayers;

        allParcelsGroup.eachLayer(layer => {
            if (typeof layer.getBounds === 'function' || typeof layer.getLatLng === 'function') {
                allLayers.push(layer);
            }
        });

        if (zoneValue === 'all') return allLayers;

        if (zoneValue === 'screen') {
            const mapBounds = map.getBounds();
            return allLayers.filter(layer => {
                if (typeof layer.getBounds === 'function') {
                    return mapBounds.intersects(layer.getBounds());
                }
                if (typeof layer.getLatLng === 'function') {
                    return mapBounds.contains(layer.getLatLng());
                }
                return false;
            });
        }

        const cityCategories = ['приватний сектор', 'поверхівки', 'змішані'];

        return allLayers.filter(layer => {
            const layerId = layer.options?.id || layer.feature?.id || layer.feature?.properties?.id;
            const layerName = layer.options?.name || layer.feature?.properties?.name;

            const globalData = window.allParcelLayers?.find(i =>
                (layerId && i.id === layerId) ||
                (layerName && i.name === layerName) ||
                i.layer === layer
            );

            const rawCategory = globalData?.category ||
                globalData?.data?.category ||
                layer.options?.category ||
                layer.feature?.properties?.category ||
                '';

            const categoryStr = String(rawCategory).trim().toLowerCase();

            const isVillage = categoryStr === 'село';
            const isCity = cityCategories.includes(categoryStr) || (!isVillage && categoryStr !== '');

            if (zoneValue === 'village') {
                return isVillage;
            } else if (zoneValue === 'city') {
                return isCity;
            }

            return true;
        });
    };

    // Оновлення калькулятора розміру
    const updateEstimatedSize = () => {
        const selectEl = document.getElementById('offline-zone-select');
        const sizeBoxEl = document.getElementById('offline-size-info');
        const btnEl = document.getElementById('offline-download-btn');
        const chkEls = document.querySelectorAll('.offline-layer-chk');

        if (!selectEl || !sizeBoxEl || !btnEl) return;

        const targetZone = selectEl.value;
        const selectedProviders = Array.from(chkEls).filter(c => c.checked).map(c => c.dataset.providerId);
        const selectedZooms = getSelectedZooms();

        if (selectedProviders.length === 0) {
            sizeBoxEl.innerHTML = '❌ Оберіть хоча б один шар карти для комплектації';
            btnEl.disabled = true;
            btnEl.style.opacity = '0.5';
            btnEl.style.cursor = 'not-allowed';
            return;
        }

        if (selectedZooms.length === 0) {
            sizeBoxEl.innerHTML = '❌ Оберіть хоча б один зум';
            btnEl.disabled = true;
            btnEl.style.opacity = '0.5';
            btnEl.style.cursor = 'not-allowed';
            return;
        }

        btnEl.disabled = false;
        btnEl.style.opacity = '1';
        btnEl.style.cursor = 'pointer';

        if (typeof estimateCacheSize === 'function' && allParcelsGroup) {
            const filteredPolygons = getFilteredPolygons(targetZone);

            if (filteredPolygons.length === 0) {
                sizeBoxEl.innerHTML = '📊 Немає полігонів для прорахунку цієї зони';
                return;
            }

            const estimation = estimateCacheSize(
                filteredPolygons,
                selectedZooms, // Динамічні зуми
                selectedProviders
            );

            sizeBoxEl.innerHTML = `📊 Оцінка: ~<strong>${estimation.sizeMB} МБ</strong><br><small style="color:#666;">Тайлів до скачування: ${estimation.totalTiles} шт. (зуми: ${selectedZooms.join('-')})</small>`;
        } else {
            sizeBoxEl.innerHTML = '📊 Розрахунок розміру готується...';
        }
    };

    const selectZoneEl = document.getElementById('offline-zone-select');
    const layerCheckboxes = document.querySelectorAll('.offline-layer-chk');

    if (selectZoneEl) {
        selectZoneEl.onchange = updateEstimatedSize;
    }
    layerCheckboxes.forEach(chk => {
        chk.onchange = updateEstimatedSize;
    });

    // 3. Відкриття модального вікна при кліку на кнопку
    L.DomEvent.off(button, 'click');
    L.DomEvent.on(button, 'click', function (e) {
        L.DomEvent.stopPropagation(e);
        L.DomEvent.preventDefault(e);
        modal.style.display = (modal.style.display === 'flex') ? 'none' : 'flex';

        updateEstimatedSize();
        if (typeof renderDownloadedZonesList === 'function') {
            renderDownloadedZonesList();
        }
    });

    L.DomEvent.disableClickPropagation(button);
    L.DomEvent.on(modal, 'click', function (e) {
        if (e.target === modal) modal.style.display = 'none';
    });
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
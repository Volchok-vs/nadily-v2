/**
 * Модуль для роботи з геолокацією користувача на карті Leaflet.
 * Адаптовано під розмір дисплея користувача.
 */
export function initGeolocation(map) {
    let userLocationMarker = null;
    let userAccuracyCircle = null;
    let accuracyBox = null;
    let hideTimer = null;
    let countdownInterval = null;

    const createAccuracyBox = () => {
        accuracyBox = L.DomUtil.create('div', 'accuracy-info-box');

        Object.assign(accuracyBox.style, {
            position: 'fixed',
            bottom: '25px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            color: '#fff',
            padding: '8px 18px',
            borderRadius: '25px',
            fontSize: '13px',
            zIndex: '10002',
            display: 'none',
            pointerEvents: 'none',
            backdropFilter: 'blur(5px)',
            boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
            textAlign: 'center',
            transition: 'opacity 0.5s'
        });

        document.body.appendChild(accuracyBox);
    };

    createAccuracyBox();

    // 📐 Функція для розрахунку адаптивного padding відносно розміру екрана
    const getAdaptivePadding = () => {
        const width = window.innerWidth;
        const height = window.innerHeight;

        // Для малих екранів (смартфонів) даємо менші відступи, щоб не віддаляти карту занадто сильно
        if (width < 600) {
            return [Math.round(height * 0.05), Math.round(width * 0.05)]; // 5% від краю
        } else if (width < 1024) {
            return [Math.round(height * 0.08), Math.round(width * 0.08)]; // 8% для планшетів
        } else {
            return [50, 50]; // Стандартний відступ для ПК
        }
    };

    window.locateMe = function () {
        if (accuracyBox) {
            accuracyBox.style.display = 'block';
            accuracyBox.style.opacity = '1';
            accuracyBox.innerHTML = `🛰️ Пошук GPS-супутників...`;
        }

        map.locate({
            setView: false,
            maxZoom: 18,
            enableHighAccuracy: true,
            timeout: 20000,
            maximumAge: 0
        });
    };

    map.on('locationfound', function (e) {
        const radius = e.accuracy;

        if (hideTimer) clearTimeout(hideTimer);
        if (countdownInterval) clearInterval(countdownInterval);

        if (userLocationMarker) {
            map.removeLayer(userLocationMarker);
            map.removeLayer(userAccuracyCircle);
        }

        // --- 1. ОДЕРЖУЄМО ID РЕКОМЕНДОВАНИХ ДІЛЯНОК З URL ---
        const urlParams = new URLSearchParams(window.location.search);
        const recommendParam = urlParams.get('recommend_ids');
        const recommendedIds = recommendParam ? recommendParam.split(',').map(id => id.trim()) : [];

        // --- 2. ЗБИРАЄМО ШАРИ ---
        let targetLayers = [];

        if (recommendedIds.length > 0) {
            // А. Перевірка через масив allParcelLayers
            if (window.allParcelLayers && Array.isArray(window.allParcelLayers)) {
                window.allParcelLayers.forEach(item => {
                    const rawId = item.id ?? item.parcelId ?? item.layer?.options?.id ?? item.layer?.feature?.id;
                    const itemId = String(rawId || '').trim();

                    if (itemId && recommendedIds.includes(itemId)) {
                        if (item.layer) targetLayers.push(item.layer);
                    }
                });
            }

            // Б. Якщо в allParcelLayers нічого не знайшли — шукаємо у Leaflet-групі allParcelsGroup
            if (targetLayers.length === 0 && window.allParcelsGroup) {
                window.allParcelsGroup.eachLayer(parentLayer => {
                    const layersToCheck = typeof parentLayer.eachLayer === 'function' ? [] : [parentLayer];
                    if (typeof parentLayer.eachLayer === 'function') {
                        parentLayer.eachLayer(sub => layersToCheck.push(sub));
                    }
                    layersToCheck.forEach(layer => {
                        const rawId = layer.options?.id ?? layer.feature?.id ?? layer.feature?.properties?.id ?? parentLayer.options?.id;
                        const layerId = String(rawId || '').trim();

                        if (layerId && recommendedIds.includes(layerId)) {
                            targetLayers.push(layer);
                        }
                    });
                });
            }

            console.log(`🎯 [Geolocation] Знайдено рекомендованих об’єктів: ${targetLayers.length} з ${recommendedIds.length}`);
        } else {
            // Якщо параметр recommend_ids відсутній — беремо всі шари
            if (window.allParcelLayers && Array.isArray(window.allParcelLayers)) {
                window.allParcelLayers.forEach(item => {
                    if (item.layer) targetLayers.push(item.layer);
                });
            }

            if (targetLayers.length === 0 && window.allParcelsGroup) {
                window.allParcelsGroup.eachLayer(layer => {
                    targetLayers.push(layer);
                });
            }

            console.log('🌐 [Geolocation] Загальний режим (без фільтрації). Знайдено об’єктів:', targetLayers.length);
        }

        // --- 3. АДАПТИВНЕ ПОЗИЦІОНУВАННЯ ПІД ДИСПЛЕЙ ---
        const bounds = L.latLngBounds([]);

        // 💡 ОБОВ'ЯЗКОВО додаємо геолокацію користувача у межі
        bounds.extend(e.latlng);

        if (targetLayers.length > 0) {
            targetLayers.forEach(layer => {
                if (typeof layer.getBounds === 'function') {
                    bounds.extend(layer.getBounds());
                } else if (typeof layer.eachLayer === 'function') {
                    layer.eachLayer(sub => {
                        if (typeof sub.getBounds === 'function') bounds.extend(sub.getBounds());
                    });
                } else if (typeof layer.getLatLng === 'function') {
                    bounds.extend(layer.getLatLng());
                }
            });
        }

        if (bounds.isValid()) {
            const padding = typeof getAdaptivePadding === 'function' ? getAdaptivePadding() : [50, 50];

            console.log('📐 [GeoDebug] Поточний Zoom перед fitBounds:', map.getZoom());

            // Застосовуємо межі із захистом від занадто близького наближення (maxZoom: 14 або 15)
            map.fitBounds(bounds, {
                padding: padding,
                maxZoom: 15, // 🛑 Забороняємо Leaflet наближати далі 15 зуму!
                animate: false
            });

            console.log('✅ [GeoDebug] Zoom ПІСЛЯ fitBounds:', map.getZoom());
        } else {
            // Fallback тільки якщо зовсім немає точок
            console.warn('⚠️ [GeoDebug] Bounds виявилися невалідними, ставимо дефолтний зум 14');
            map.setView(e.latlng, 14);
        }

        // --- 4. МАРКЕРИ ГЕОЛОКАЦІЇ ---
        let secondsLeft = 7;
        if (typeof accuracyBox !== 'undefined' && accuracyBox) {
            accuracyBox.style.display = 'block';
            accuracyBox.style.opacity = '1';

            const updateText = (sec) => {
                accuracyBox.innerHTML = `📡 Точність: ±${radius.toFixed(1)} м <span style="margin-left:8px; opacity:0.6; font-size:11px;">(${sec}с)</span>`;
            };

            updateText(secondsLeft);

            countdownInterval = setInterval(() => {
                secondsLeft--;
                if (secondsLeft > 0) {
                    updateText(secondsLeft);
                } else {
                    clearInterval(countdownInterval);
                }
            }, 1000);

            hideTimer = setTimeout(() => {
                accuracyBox.style.opacity = '0';
                setTimeout(() => {
                    accuracyBox.style.display = 'none';
                }, 500);
            }, secondsLeft * 1000);
        }

        userAccuracyCircle = L.circle(e.latlng, radius, {
            color: '#136aec',
            fillColor: '#136aec',
            fillOpacity: 0.15,
            weight: 2,
            interactive: false
        }).addTo(map);

        userLocationMarker = L.circleMarker(e.latlng, {
            radius: 8,
            color: '#ffffff',
            weight: 3,
            fillColor: '#136aec',
            fillOpacity: 1,
            interactive: false
        }).addTo(map);
    });

    map.on('locationerror', function (e) {
        if (accuracyBox) accuracyBox.style.display = 'none';

        let errorMsg = "Помилка визначення місцезнаходження.";

        switch (e.code) {
            case 1:
                errorMsg = "Доступ до геолокації заборонено в налаштуваннях браузера.";
                break;
            case 2:
                errorMsg = "Не вдалося отримати сигнал GPS. Перевірте, чи увімкнено геопозицію в системі та чи ви не в приміщенні.";
                break;
            case 3:
                errorMsg = "Час очікування GPS вичерпано. Переконайся, що ви перебуваєте на відкритій місцевості.";
                break;
            default:
                errorMsg = "Помилка GPS: " + e.message;
        }

        alert(errorMsg);
    });
}
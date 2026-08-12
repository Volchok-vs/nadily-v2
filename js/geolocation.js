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

        if (width < 600) {
            return [Math.round(height * 0.05), Math.round(width * 0.05)];
        } else if (width < 1024) {
            return [Math.round(height * 0.08), Math.round(width * 0.08)];
        } else {
            return [50, 50];
        }
    };

    // 🔴 ВИПРАВЛЕНО ДЛЯ iOS PWA: Запит робиться миттєво
    window.locateMe = function () {
        // 1. Перевірка HTTPS (обов'язково для iOS Standalone)
        if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
            alert("Геолокація на iOS працює тільки через HTTPS з'єднання.");
            return;
        }

        // 2. Спочатку ініціюємо запит Leaflet
        map.locate({
            setView: false,
            maxZoom: 18,
            enableHighAccuracy: true,
            timeout: 10000, // Зменшено таймаут для швидшого відгуку
            maximumAge: 0
        });

        // 3. Відображаємо плашку пошуку ПІСЛЯ запуску запиту
        if (accuracyBox) {
            accuracyBox.style.display = 'block';
            accuracyBox.style.opacity = '1';
            accuracyBox.innerHTML = `🛰️ Пошук GPS-супутників...`;
        }
    };

    map.on('locationfound', function (e) {
        const radius = e.accuracy;

        if (hideTimer) clearTimeout(hideTimer);
        if (countdownInterval) clearInterval(countdownInterval);

        // 🔴 1. Спочатку обов'язково видаляємо старе коло точності з карти!
        if (userLocationMarker) {
            map.removeLayer(userLocationMarker);
            map.removeLayer(userAccuracyCircle);
            userLocationMarker = null;
            userAccuracyCircle = null;
        }

        // --- 1. ОДЕРЖУЄМО ID РЕКОМЕНДОВАНИХ ДІЛЯНОК З URL ---
        const urlParams = new URLSearchParams(window.location.search);
        const recommendParam = urlParams.get('recommend_ids');
        const recommendedIds = recommendParam ? recommendParam.split(',').map(id => id.trim()) : [];

        // --- 2. ЗБИРАЄМО ШАРИ ---
        let targetLayers = [];

        if (recommendedIds.length > 0) {
            if (window.allParcelLayers && Array.isArray(window.allParcelLayers)) {
                window.allParcelLayers.forEach(item => {
                    const rawId = item.id ?? item.parcelId ?? item.layer?.options?.id ?? item.layer?.feature?.id;
                    const itemId = String(rawId || '').trim();

                    if (itemId && recommendedIds.includes(itemId)) {
                        if (item.layer) targetLayers.push(item.layer);
                    }
                });
            }

            if (targetLayers.length === 0 && window.allParcelsGroup) {
                window.allParcelsGroup.eachLayer(parentLayer => {
                    const layersToCheck = typeof parentLayer.eachLayer === 'function' ? [] : [parentLayer];
                    if (typeof parentLayer.eachLayer === 'function') {
                        parentLayer.eachLayer(sub => layersToCheck.push(sub));
                    }
                    layersToCheck.forEach(layer => {
                        if (layer instanceof L.Circle || layer instanceof L.CircleMarker) {
                            return;
                        }

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
            console.log('🌐 [Geolocation] Загальний режим (без фільтрації).');
        }

        // --- 3. АДАПТИВНЕ ПОЗИЦІОНУВАННЯ ПІД ДИСПЛЕЙ ---
        const bounds = L.latLngBounds([]);
        bounds.extend(e.latlng);

        const hasRecommendations = recommendedIds.length > 0;

        if (hasRecommendations && targetLayers.length > 0) {
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

        if (hasRecommendations && bounds.isValid()) {
            const padding = typeof getAdaptivePadding === 'function' ? getAdaptivePadding() : [50, 50];

            map.fitBounds(bounds, {
                padding: padding,
                maxZoom: 16,
                animate: false
            });
        } else {
            map.setView(e.latlng, 16, { animate: false });
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
                errorMsg = "Доступ до геолокації заборонено. Відкрийте Налаштування iPhone -> Приватність -> Служби геопозиції та увімкніть дозвіл для Safari.";
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
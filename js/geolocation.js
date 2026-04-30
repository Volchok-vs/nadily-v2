/**
 * Модуль для роботи з геолокацією користувача на карті Leaflet.
 * Додає синю точку, коло точності та інформаційне віконце.
 */
/**
 * Модуль для роботи з геолокацією користувача на карті Leaflet.
 */
export function initGeolocation(map) {
    let userLocationMarker = null;
    let userAccuracyCircle = null;
    let accuracyBox = null;
    let hideTimer = null; // Таймер для автоматичного приховування
    let countdownInterval = null; // Інтервал для відліку секунд

    const createAccuracyBox = () => {
        accuracyBox = L.DomUtil.create('div', 'accuracy-info-box');
        
        Object.assign(accuracyBox.style, {
            position: 'fixed',
            bottom: '25px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
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

    window.locateMe = function() {
        map.locate({
            setView: true,
            maxZoom: 17,
            enableHighAccuracy: true 
        });
    };

    map.on('locationfound', function(e) {
        const radius = e.accuracy;

        // Очищення попередніх таймерів, якщо натиснули кнопку повторно
        if (hideTimer) clearTimeout(hideTimer);
        if (countdownInterval) clearInterval(countdownInterval);

        if (userLocationMarker) {
            map.removeLayer(userLocationMarker);
            map.removeLayer(userAccuracyCircle);
        }

        // Логіка відліку (наприклад, 7 секунд)
        let secondsLeft = 7;
        accuracyBox.style.display = 'block';
        accuracyBox.style.opacity = '1';

        const updateText = (sec) => {
            accuracyBox.innerHTML = `📡 Точність: ±${radius.toFixed(1)} м <span style="margin-left:8px; opacity:0.6; font-size:11px;">(${sec}с)</span>`;
        };

        updateText(secondsLeft);

        // Запуск зворотного відліку
        countdownInterval = setInterval(() => {
            secondsLeft--;
            if (secondsLeft > 0) {
                updateText(secondsLeft);
            } else {
                clearInterval(countdownInterval);
            }
        }, 1000);

        // Автоматичне зникнення через встановлений час
        hideTimer = setTimeout(() => {
            accuracyBox.style.opacity = '0';
            setTimeout(() => {
                accuracyBox.style.display = 'none';
            }, 500); // Час на завершення CSS-анімації
        }, secondsLeft * 1000);

        // Візуалізація на карті
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

    map.on('locationerror', function(e) {
        if (accuracyBox) accuracyBox.style.display = 'none';
        const errorMsg = (e.code === 1) 
            ? "Доступ до геолокації заборонено."
            : "Помилка GPS: " + e.message;
        alert(errorMsg);
    });
}
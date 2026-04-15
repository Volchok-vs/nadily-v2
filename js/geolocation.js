/**
 * Модуль для роботи з геолокацією користувача на карті Leaflet.
 * @param {L.Map} map - Об'єкт карти, на яку потрібно додати функціонал.
 */
export function initGeolocation(map) {
    // Змінні для зберігання об'єктів на карті, щоб їх можна було видалити перед оновленням
    let userLocationMarker = null; // Синя точка (центр)
    let userAccuracyCircle = null; // Прозоре коло (точність GPS)

    /**
     * Глобальна функція для запуску пошуку локації.
     * Її можна викликати з будь-якої кнопки через window.locateMe()
     */
    window.locateMe = function() {
        // setView: true — карта автоматично переміститься до користувача
        // enableHighAccuracy: true — змушує телефон (наприклад, Pixel 7) включити GPS для точності
        map.locate({
            setView: true, 
            maxZoom: 16, 
            enableHighAccuracy: true
        });
    };

    /**
     * ОБРОБНИК: Подія, яка спрацьовує, коли GPS успішно знайшов координати
     */
    map.on('locationfound', function(e) {
        const radius = e.accuracy; // Точність у метрах

        // КРОК 1: Очищення. Якщо на карті вже є старі маркери нашої позиції — видаляємо їх
        if (userLocationMarker) {
            map.removeLayer(userLocationMarker);
            map.removeLayer(userAccuracyCircle);
        }

        // КРОК 2: Малюємо коло точності. Чим більший радіус, тим гірший сигнал GPS
        userAccuracyCircle = L.circle(e.latlng, radius, {
            color: '#136aec',      // Колір лінії
            fillColor: '#136aec',  // Колір заливки
            fillOpacity: 0.15,     // Прозорість заливки (0.15 = 15%)
            weight: 2              // Товщина лінії
        }).addTo(map);

        // КРОК 3: Малюємо саму точку користувача (CircleMarker не змінює розмір при зумі)
        userLocationMarker = L.circleMarker(e.latlng, {
            radius: 8,             // Розмір точки в пікселях
            color: '#fff',         // Біла обводка, щоб точка не зливалася з картою
            weight: 3,             // Товщина обводки
            fillColor: '#136aec',  // Фірмовий синій колір Google Maps
            fillOpacity: 1,        // Повна непрозорість
        }).addTo(map);

        // Для відладки виводимо точність у консоль браузера
        console.log(`Геолокація знайдена! Точність: ${radius.toFixed(1)} метрів`);
    });

    /**
     * ОБРОБНИК: Подія, якщо доступ до GPS заборонено або сигнал відсутній
     */
    map.on('locationerror', function(e) {
        // Виводимо зрозуміле повідомлення користувачу
        alert("Помилка геолокації: " + e.message + 
              "\nПеревірте, чи увімкнено GPS та чи надано дозвіл браузеру.");
    });
}
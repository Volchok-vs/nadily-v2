/**
 * Модуль для роботи з геолокацією користувача на карті Leaflet.
 * Додає синю точку, коло точності та інформаційне віконце.
 */
export function initGeolocation(map) {
    // Змінні-контейнери для об'єктів на карті
    let userLocationMarker = null; // Маркер (крапка) користувача
    let userAccuracyCircle = null; // Коло навколо крапки (похибка GPS)
    let accuracyBox = null;        // HTML-елемент для тексту з точністю

    /**
     * Створення візуального віконця для виводу точності в метрах.
     * Створюється один раз при ініціалізації.
     */
    const createAccuracyBox = () => {
        // Створюємо div-елемент через вбудовані інструменти Leaflet
        accuracyBox = L.DomUtil.create('div', 'accuracy-info-box');
        
        // Налаштування зовнішнього вигляду через inline-стилі
        Object.assign(accuracyBox.style, {
            position: 'fixed',
            bottom: '25px',           // Відступ знизу
            left: '50%',              // Центрування по горизонталі
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.7)', // Темний напівпрозорий фон
            color: '#fff',            // Білий текст
            padding: '6px 16px',      // Внутрішні відступи
            borderRadius: '20px',     // Закруглені краї
            fontSize: '13px',         // Розмір шрифту
            zIndex: '10002',          // Поверх карти, але під модалками
            display: 'none',          // Приховано, поки не знайдемо координати
            pointerEvents: 'none',    // Кліки проходять крізь віконце на карту
            backdropFilter: 'blur(5px)', // Ефект розмиття фону за віконцем
            boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
            textAlign: 'center',
            transition: 'opacity 0.3s' // Плавна поява
        });

        document.body.appendChild(accuracyBox);
    };

    // Запускаємо створення віконця відразу при ініціалізації модуля
    createAccuracyBox();

    /**
     * Глобальна функція для виклику геолокації.
     * Прив'язана до window, щоб працювати з кнопок в index.html.
     */
    window.locateMe = function() {
        // Запит до браузера на пошук місцезнаходження
        map.locate({
            setView: true,           // Автоматично центрувати карту на користувачеві
            maxZoom: 17,             // Не наближати занадто сильно
            enableHighAccuracy: true // ПРИМУСОВО вмикає GPS на пристрої (важливо для Pixel 7)
        });
    };

    /**
     * ОБРОБНИК: Викликається автоматично, коли координати успішно отримано.
     * @param {Object} e - об'єкт події з координатами та точністю.
     */
    map.on('locationfound', function(e) {
        const radius = e.accuracy; // Точність у метрах, яку повернув GPS-датчик

        // ОЧИЩЕННЯ: Видаляємо старі маркери, якщо вони вже були на карті
        if (userLocationMarker) {
            map.removeLayer(userLocationMarker);
            map.removeLayer(userAccuracyCircle);
        }

        // ОНОВЛЕННЯ ВІКОНЦЯ: Показуємо текст користувачу
        accuracyBox.style.display = 'block';
        accuracyBox.innerHTML = `📡 Точність GPS: ±${radius.toFixed(1)} м`;

        // КОЛО ТОЧНОСТІ: Малюємо зону навколо користувача
        userAccuracyCircle = L.circle(e.latlng, radius, {
            color: '#136aec',      // Колір контуру (синій)
            fillColor: '#136aec',  // Колір заливки
            fillOpacity: 0.15,     // Напівпрозорість (15%)
            weight: 2,             // Товщина лінії
            interactive: false     // Коло не реагує на кліки
        }).addTo(map);

        // МАРКЕР: Малюємо саму "синю точку"
        userLocationMarker = L.circleMarker(e.latlng, {
            radius: 8,             // Статичний розмір точки в пікселях
            color: '#ffffff',      // Біла обводка для контрасту на супутнику
            weight: 3,             // Товщина білої лінії
            fillColor: '#136aec',  // Насичений синій колір
            fillOpacity: 1,        // Непрозора точка
            interactive: false
        }).addTo(map);

        console.log(`Позиція знайдена. Похибка: ${radius.toFixed(1)} м.`);
    });

    /**
     * ОБРОБНИК: Викликається, якщо доступ до GPS заблоковано або сигнал відсутній.
     */
    map.on('locationerror', function(e) {
        // Ховаємо віконце точності при помилці
        if (accuracyBox) accuracyBox.style.display = 'none';
        
        // Виводимо попередження залежно від причини
        const errorMsg = (e.code === 1) 
            ? "Доступ до геолокації заборонено. Будь ласка, дозвольте доступ у налаштуваннях браузера."
            : "Не вдалося визначити місцезнаходження: " + e.message;
            
        alert(errorMsg);
        console.warn("GPS Error:", e.message);
    });
}
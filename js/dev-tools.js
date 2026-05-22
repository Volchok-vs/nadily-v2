// js/dev-tools.js

(function() {
    window.addEventListener('load', () => {
        setTimeout(() => {
            // 1. ЧИТАННЯ НАЛАШТУВАНЬ
            const configs = JSON.parse(localStorage.getItem('app_dev_configs')) || {};

            // 2. ЛОГІКА ТАЙМЕРА (Для всіх сторінок)
            if (configs.masterMode === true && configs.showTimer === true) {
                const [nav] = performance.getEntriesByType('navigation');
                if (nav) {
                    const timeMs = Math.round(nav.duration);
                    const timeSec = (timeMs / 1000).toFixed(2);
                    
                    console.log(`%c ⏱ Швидкість завантаження: ${timeMs}ms `, 'background: #222; color: #00ff00; font-weight: bold;');
                    renderLoadTimer(timeMs, timeSec);
                }
            }

            // 3. ЛОГІКА ДЛЯ СТОРІНКИ НАЛАШТУВАНЬ (Збереження)
            // ПЕРЕВІРТЕ: ID в HTML мають співпадати з цими:
            const masterToggle = document.getElementById('devModeToggle');
            const timerToggle = document.getElementById('showLoadTimer');
            const logoutToggle = document.getElementById('quickLogoutToggle'); // ДОДАНО
            const testCampaignToggle = document.getElementById('testCampaignToggle'); // 🧪 Тестова кампанія
            const zoomWidgetToggle = document.getElementById('zoomWidgetToggle'); // 🔍 Віджет зуму

            if (masterToggle && timerToggle) {
                // Встановлюємо стан при завантаженні сторінки
                masterToggle.checked = !!configs.masterMode;
                timerToggle.checked = !!configs.showTimer;
                if (logoutToggle) {
                    // Читаємо окремий ключ для виходу або з об'єкта
                    logoutToggle.checked = localStorage.getItem('showQuickLogout') === 'true';
                }
                // 🧪 Ініціалізація тестової кампанії
                if (testCampaignToggle && masterToggle.checked) {
                    testCampaignToggle.checked = localStorage.getItem('showTestCampaign') === 'true';
                }
                // 🔍 Ініціалізація віджета зуму
                if (zoomWidgetToggle && masterToggle.checked) {
                    zoomWidgetToggle.checked = localStorage.getItem('showZoomWidget') === 'true';
                }

                const saveSettings = () => {
                    const newConfig = {
                        masterMode: masterToggle.checked,
                        showTimer: timerToggle.checked
                    };
                    
                    // Зберігаємо основний конфіг
                    localStorage.setItem('app_dev_configs', JSON.stringify(newConfig));
                    
                    // Зберігаємо налаштування виходу (щоб index.html його бачив)
                    if (logoutToggle) {
                        localStorage.setItem('showQuickLogout', logoutToggle.checked);
                    }

                    // 🧪 Зберігаємо налаштування тестової кампанії
                    if (testCampaignToggle && masterToggle.checked) {
                        localStorage.setItem('showTestCampaign', testCampaignToggle.checked);
                    }

                    // 🔍 Зберігаємо налаштування віджета зуму
                    if (zoomWidgetToggle && masterToggle.checked) {
                        localStorage.setItem('showZoomWidget', zoomWidgetToggle.checked);
                    }

                    console.log("Налаштування оновлено:", newConfig);
                };

                masterToggle.addEventListener('change', saveSettings);
                timerToggle.addEventListener('change', saveSettings);
                if (logoutToggle) logoutToggle.addEventListener('change', saveSettings);
                if (testCampaignToggle) testCampaignToggle.addEventListener('change', saveSettings);
                if (zoomWidgetToggle) zoomWidgetToggle.addEventListener('change', saveSettings);
            }
        }, 150); // Трохи збільшив затримку для надійності
    });

    // Додай цю функцію оновлення розширення
    function getScreenRes() {
        return `${window.innerWidth}x${window.innerHeight}`;
    }

    // Оновлена функція рендеру (заміни свою стару)
    function renderLoadTimer(ms, sec) {
        let badge = document.getElementById('dev-timer-badge');
        if (!badge) {
            badge = document.createElement('div');
            badge.id = 'dev-timer-badge';
            document.body.appendChild(badge);
        }

        Object.assign(badge.style, {
            position: 'fixed', bottom: '15px', left: '15px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)', color: '#00ff00',
            padding: '5px 12px', borderRadius: '8px', fontSize: '11px',
            zIndex: '10000', pointerEvents: 'none', backdropFilter: 'blur(4px)',
            fontFamily: 'monospace', border: '1px solid rgba(0, 255, 0, 0.3)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            display: 'flex', gap: '10px', alignItems: 'center'
        });

        // Виводимо і таймер, і роздільну здатність
        const res = getScreenRes();
        badge.innerHTML = `
            <span>⏱ ${ms}ms <small>(${sec}s)</small></span>
            <span style="border-left: 1px solid rgba(0,255,0,0.3); padding-left: 10px;">🖥 ${res}</span>
        `;

        // Додаємо слухач на зміну розміру вікна, щоб цифри оновлювалися в реальному часі
        window.onresize = () => {
            const resSpan = badge.querySelector('span:last-child');
            if (resSpan) resSpan.innerText = `🖥 ${getScreenRes()}`;
        };
    }

    // 🔍 Функція для відображення віджета зуму
    function initZoomWidget() {
        const showZoomWidget = localStorage.getItem('showZoomWidget') === 'true';
        if (!showZoomWidget) return;

        // Створюємо елемент віджета
        const zoomWidget = document.createElement('div');
        zoomWidget.id = 'dynamic-zoom-widget';

        // Додаємо стилі
        Object.assign(zoomWidget.style, {
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(21, 101, 192, 0.95)',
            color: '#ffffff',
            padding: '8px 16px',
            borderRadius: '20px',
            fontSize: '14px',
            fontFamily: "'Segoe UI', sans-serif",
            fontWeight: 'bold',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            zIndex: '10005',
            pointerEvents: 'none',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
        });

        // Функція оновлення тексту
        function updateZoomDisplay() {
            if (window.map) {
                const currentZoom = window.map.getZoom();
                zoomWidget.innerHTML = `🔍 Zoom: <span>${currentZoom}</span>`;
            } else {
                zoomWidget.innerHTML = `⚠️ Карта не знайдена`;
            }
        }

        // Додаємо віджет на сторінку
        document.body.appendChild(zoomWidget);

        // Вішаємо слухач подій на карту Leaflet
        if (window.map) {
            window.map.on('zoomend', updateZoomDisplay);
            updateZoomDisplay();
            console.log('%c🚀 Віджет Zoom успішно активовано!', 'color: #2ecc71; font-weight: bold;');
        } else {
            console.error('Помилка: об\'єкт window.map ще не ініціалізовано.');
        }
    }

    // Експортуємо функцію для використання в інших файлах
    window.initZoomWidget = initZoomWidget;
})();
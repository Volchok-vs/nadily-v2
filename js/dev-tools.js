// js/dev-tools.js

(function() {
    window.addEventListener('load', () => {
        // Додаємо мінімальну затримку 100мс, щоб браузер встиг записати фінальні цифри
        setTimeout(() => {
            
            // 1. ЧИТАННЯ НАЛАШТУВАНЬ
            const configs = JSON.parse(localStorage.getItem('app_dev_configs')) || {};

            // 2. ЛОГІКА ДЛЯ ВСІХ СТОРІНОК
            if (configs.masterMode === true) {
                // Отримуємо дані
                const [nav] = performance.getEntriesByType('navigation');
                
                if (nav) {
                    // ... всередині вашої умови if (nav) ...

const timeMs = Math.round(nav.duration);
const timeSec = (timeMs / 1000).toFixed(2);

// Вивід у консоль для розробника
console.log(`%c ⏱ Швидкість завантаження: ${timeMs}ms (${timeSec}s) `, 'background: #222; color: #00ff00; font-weight: bold;');

if (configs.showTimer === true) {
    renderLoadTimer(timeMs, timeSec);
}

// ...

function renderLoadTimer(ms, sec) {
    const id = 'dev-timer-badge';
    let badge = document.getElementById(id);
    
    // Якщо плашки ще немає — створюємо її
    if (!badge) {
        badge = document.createElement('div');
        badge.id = id;
        document.body.appendChild(badge);
    }

    // Оновлюємо стилі та контент
    Object.assign(badge.style, {
        position: 'fixed',
        bottom: '15px',
        left: '15px',
        backgroundColor: 'rgba(0, 0, 0, 0.5)', // Напівпрозорий фон
        color: '#00ff00', // Салатовий колір тексту
        padding: '5px 10px',
        borderRadius: '8px',
        fontSize: '11px',
        fontFamily: 'monospace',
        zIndex: '10000',
        pointerEvents: 'none',
        border: '1px solid rgba(0, 255, 0, 0.3)',
        backdropFilter: 'blur(4px)', // Розмиття за плашкою
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
    });

    // Формат виводу: мілісекунди та секунди в дужках
    badge.innerHTML = `⏱ ${ms}ms <span style="opacity: 0.7; font-size: 0.9em;">(${sec}s)</span>`;
}
                } else {
                    console.warn("Performance Navigation Timing не підтримується або дані ще не готові.");
                }
            }

            // 3. ЛОГІКА ДЛЯ СТОРІНКИ НАЛАШТУВАНЬ (Збереження)
            const masterToggle = document.getElementById('devModeToggle');
            const timerToggle = document.getElementById('showLoadTimer');

            if (masterToggle && timerToggle) {
                masterToggle.checked = configs.masterMode || false;
                timerToggle.checked = configs.showTimer || false;

                const saveSettings = () => {
                    const newConfig = {
                        masterMode: masterToggle.checked,
                        showTimer: timerToggle.checked
                    };
                    localStorage.setItem('app_dev_configs', JSON.stringify(newConfig));
                    console.log("Конфігурацію збережено:", newConfig);
                };

                masterToggle.addEventListener('change', saveSettings);
                timerToggle.addEventListener('change', saveSettings);
            }
        }, 100); // 100 мілісекунд затримки
    });

    function renderLoadTimer(time) {
        // Видаляємо старий бадж, якщо він чомусь вже є
        const oldBadge = document.getElementById('dev-timer-badge');
        if (oldBadge) oldBadge.remove();

        const badge = document.createElement('div');
        badge.id = 'dev-timer-badge';
        Object.assign(badge.style, {
            position: 'fixed', bottom: '15px', left: '15px',
            backgroundColor: 'rgba(0, 0, 0, 0.6)', color: '#0f0', // Зелений колір для тексту (як у матриці)
            padding: '4px 10px', borderRadius: '6px', fontSize: '11px',
            zIndex: '10000', pointerEvents: 'none', backdropFilter: 'blur(3px)',
            fontFamily: 'monospace', border: '1px solid rgba(0, 255, 0, 0.2)'
        });
        badge.innerText = `⏱ ${time}ms`;
        document.body.appendChild(badge);
    }
})();
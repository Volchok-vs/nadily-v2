// main.js

// 2. Спільні змінні
export const userRole = localStorage.getItem('userRole');
export const currentUserId = localStorage.getItem('userId');
export const userFullName = localStorage.getItem('userFullName');
export const isAdmin = (userRole === 'admin' || userRole === 'super_admin');


// Функція застосування фільтрів
window.applyFilters = () => {
    const searchInput = document.getElementById('searchNumber');
    const selectedRadio = document.querySelector('input[name="statusFilter"]:checked');

    // Перевіряємо window.map, бо вона може бути ініціалізована в іншому модулі
    if (!window.allParcelLayers || !window.map || !searchInput || !selectedRadio) return;

    const searchValue = searchInput.value.trim().toLowerCase();
    const filterType = selectedRadio.value;

    window.allParcelLayers.forEach(item => {
        if (!item.data) return;
        let shouldShow = false;

        if (searchValue !== "") {
            shouldShow = (item.name === searchValue);
        } else {
            if (filterType === 'all') {
                shouldShow = true;
            } else if (filterType === 'free') {
                shouldShow = (item.data.status !== 'taken');
            } else if (filterType === 'taken') {
                shouldShow = (item.data.status === 'taken');
            } else if (filterType === 'mine') {
                shouldShow = (String(item.data.taken_by_id) === String(currentUserId));
            }
        }

        if (shouldShow) {
            item.layer.addTo(window.map);
            if (item.label) item.label.addTo(window.map);
        } else {
            window.map.removeLayer(item.layer);
            if (item.label) window.map.removeLayer(item.label);
        }
    });
};

// Обробники подій
document.addEventListener('input', (e) => {
    if (e.target.id === 'searchNumber') {
        if (e.target.value.trim() !== "") {
            const allRadio = document.querySelector('input[name="statusFilter"][value="all"]');
            if (allRadio) allRadio.checked = true;
        }
        window.applyFilters();
    }
});

document.addEventListener('change', (e) => {
    if (e.target.name === 'statusFilter') {
        const searchInput = document.getElementById('searchNumber');
        if (searchInput) searchInput.value = "";
        window.applyFilters();
    }
});

// ФУНКЦІЯ ІНІЦІАЛІЗАЦІЇ КНОПОК
// Викликаємо її тільки тоді, коли впевнені, що map створена
// main.js

// ... ваші експорти та логіка фільтрів ...

export function initToolControl(mapInstance) {
    if (!mapInstance) return;

    const ToolControl = L.Control.extend({
        options: { position: 'topleft' },
        onAdd: function () {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');

            // Зупиняємо передачу кліків з меню на карту
            L.DomEvent.disableClickPropagation(container);

            const createBtn = (html, title, onClickAction) => {
                const btn = L.DomUtil.create('button', '', container);
                btn.innerHTML = html;
                btn.title = title;
                btn.style.cssText = 'cursor:pointer; border:none; display:block; border-bottom:1px solid #ccc;';

                L.DomEvent.on(btn, 'click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    L.DomEvent.preventDefault(e);
                    onClickAction(e);
                });
                return btn;
            };

            // 🎯 Кнопка локації
            createBtn('🎯', "Де я?", () => {
                mapInstance.locate({ setView: true, maxZoom: 16 });
            });

            // 🔍 Кнопка фільтрів (ВИПРАВЛЕНО)
            createBtn('🔍', "Фільтри", () => {
                const menu = document.getElementById('filterMenu');
                if (menu) {
                    const isHidden = window.getComputedStyle(menu).display === 'none';
                    menu.style.display = isHidden ? 'block' : 'none';
                }
            });

            return container;
        }
    });

    mapInstance.addControl(new ToolControl());
}

// Автозапуск контролів
const checkMap = setInterval(() => {
    if (window.map) {
        initToolControl(window.map);
        clearInterval(checkMap);
    }
}, 100);



// Функція для оновлення цифр у меню фільтрів
window.updateFilterCounters = () => {
    if (!window.allParcelLayers) return;

    let counts = {
        all: window.allParcelLayers.length,
        free: 0,
        taken: 0,
        mine: 0
    };

    const currentUserId = localStorage.getItem('userId');

    window.allParcelLayers.forEach(item => {
        const data = item.data;
        if (!data) return;

        // Рахуємо "Вільні" (якщо статус не "taken")
        if (data.status !== 'taken') {
            counts.free++;
        } 
        // Рахуємо "На руках"
        else {
            counts.taken++;
            // Рахуємо "Мої", тільки якщо ID збігається і МИ АВТОРИЗОВАНІ
            if (currentUserId && String(data.taken_by_id) === String(currentUserId)) {
                counts.mine++;
            }
        }
    });

    // Оновлюємо цифри всередині меню
    const menu = document.getElementById('filterMenu');
    if (menu) {
        // Допоміжна функція для пошуку бейджа всередині конкретної секції
        const setBadge = (secId, val) => {
            const badge = menu.querySelector(`#${secId} .count-badge`);
            if (badge) badge.innerText = val;
        };

        setBadge('sec-all', counts.all);
        setBadge('sec-free', counts.free);
        setBadge('sec-taken', counts.taken);
        setBadge('sec-mine', counts.mine);
    }
};
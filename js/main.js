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
    const ToolControl = L.Control.extend({
        options: { position: 'topleft' },
        onAdd: function () {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');

            // Функція-помощник для кнопок
            const createBtn = (html, title, onClickAction) => {
                const btn = L.DomUtil.create('button', 'leaflet-custom-btn', container);
                btn.innerHTML = html;
                btn.title = title;

                L.DomEvent.on(btn, 'click', function (e) {
                    L.DomEvent.stopPropagation(e);
                    L.DomEvent.preventDefault(e);
                    onClickAction(e);
                });

                return btn;
            };

            // 1. Кнопка Де я?
            createBtn('🎯', "Моя локація", () => {
                if (typeof window.locateMe === 'function') {
                    window.locateMe();
                } else {
                    mapInstance.locate({ setView: true, maxZoom: 16 });
                }
            });

            // 2. Кнопка Фільтр
            // Усередині ToolControl для кнопки Фільтр
            createBtn('🔍', "Фільтр дільниць", () => {
                const menu = document.getElementById('filterMenu');
                const isVisible = menu && menu.style.display === 'block';

                // Використовуємо універсальну функцію замість ручного керування style.display
                UI.toggleModal('filterMenu', !isVisible);

                if (!isVisible) {
                    // Оновлюємо цифри при відкритті
                    window.updateFilterCounters();

                    // Перевіряємо видимість "Мої дільниці"
                    const myLabel = document.getElementById('myParcelsLabel');
                    if (myLabel) {
                        myLabel.style.display = localStorage.getItem('userId') ? 'block' : 'none';
                    }
                }
            });

            return container;
        }
    });

    // Додаємо контроль на мапу
    mapInstance.addControl(new ToolControl());
}

// Запуск ініціалізації при появі мапи
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

        if (data.status === 'taken') {
            counts.taken++;
            if (String(data.taken_by_id) === String(currentUserId)) {
                counts.mine++;
            }
        } else {
            counts.free++;
        }
    });

    // Оновлюємо текст у HTML
    const updateText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.innerText = `(${val})`;
    };

    updateText('cnt-all', counts.all);
    updateText('cnt-free', counts.free);
    updateText('cnt-taken', counts.taken);
    updateText('cnt-mine', counts.mine);
};
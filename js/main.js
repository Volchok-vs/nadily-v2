// main.js


// Безпечна ініціалізація глобальних змінних з fallback значеннями
// Це дозволяє синхронним перевіркам працювати до завершення асинхронного виклику до бази
window.userRole = localStorage.getItem('userRole') || 'user';
window.currentUserId = localStorage.getItem('userId');
window.userFullName = localStorage.getItem('userName');
window.isAdmin = (window.userRole === 'admin' || window.userRole === 'super-admin' || window.userRole === 'super_admin');
window.isSuperAdmin = (window.userRole === 'super-admin' || window.userRole === 'super_admin');

// Експортуємо для сумісності з існуючим кодом
export const userRole = window.userRole;
export const currentUserId = window.currentUserId;
export const userFullName = window.userFullName;
export const isAdmin = window.isAdmin;
export const isSuperAdmin = window.isSuperAdmin;

console.log(`[Main] Права завантажено глобально. Роль: ${window.userRole}, Admin: ${window.isAdmin}, SuperAdmin: ${window.isSuperAdmin}`);

// Централізована функція ініціалізації сесії користувача з перевіркою ролі з бази даних
window.initUserSession = async () => {
    console.log("🔐 [Session] Починаємо ініціалізацію сесії користувача...");

    const userId = localStorage.getItem('userId');
    if (!userId) {
        console.error("❌ [Session] userId відсутній в localStorage!");
        return { role: 'user', isAdmin: false, isSuperAdmin: false };
    }

    try {
        // Отримуємо роль з бази даних
        const { data, error } = await supabase
            .from('publishers')
            .select('role, name, last_name')
            .eq('id', userId)
            .single();

        if (error) {
            console.error("❌ [Session] Помилка отримання ролі з бази:", error);
            // Використовуємо кешовані значення як fallback
            const cachedRole = localStorage.getItem('userRole') || 'user';
            const cachedIsAdmin = (cachedRole === 'admin' || cachedRole === 'super-admin' || cachedRole === 'super_admin');
            const cachedIsSuperAdmin = (cachedRole === 'super-admin' || cachedRole === 'super_admin');

            window.userRole = cachedRole;
            window.isAdmin = cachedIsAdmin;
            window.isSuperAdmin = cachedIsSuperAdmin;

            return { role: cachedRole, isAdmin: cachedIsAdmin, isSuperAdmin: cachedIsSuperAdmin };
        }

        if (!data) {
            console.error("❌ [Session] Користувача не знайдено в базі за userId:", userId);
            return { role: 'user', isAdmin: false, isSuperAdmin: false };
        }

        // Оновлюємо глобальні змінні на основі даних з бази
        const role = data.role || 'user';
        const isAdmin = (role === 'admin' || role === 'super-admin' || role === 'super_admin');
        const isSuperAdmin = (role === 'super-admin' || role === 'super_admin');

        window.userRole = role;
        window.isAdmin = isAdmin;
        window.isSuperAdmin = isSuperAdmin;
        window.userFullName = `${data.last_name || ''} ${data.name || ''}`.trim();

        // Кешуємо значення в localStorage для швидкого доступу при наступних завантаженнях
        localStorage.setItem('userRole', role);
        localStorage.setItem('userName', window.userFullName);

        console.log("✅ [Session] Сесія успішно ініціалізована:", { role, isAdmin, isSuperAdmin });

        return { role, isAdmin, isSuperAdmin };

    } catch (err) {
        console.error("❌ [Session] Критична помилка при ініціалізації сесії:", err);
        // Використовуємо кешовані значення як fallback
        const cachedRole = localStorage.getItem('userRole') || 'user';
        const cachedIsAdmin = (cachedRole === 'admin' || cachedRole === 'super-admin' || cachedRole === 'super_admin');
        const cachedIsSuperAdmin = (cachedRole === 'super-admin' || cachedRole === 'super_admin');

        window.userRole = cachedRole;
        window.isAdmin = cachedIsAdmin;
        window.isSuperAdmin = cachedIsSuperAdmin;

        return { role: cachedRole, isAdmin: cachedIsAdmin, isSuperAdmin: cachedIsSuperAdmin };
    }
};

// Допоміжні функції для отримання ролі з fallback
window.getUserRole = () => window.userRole || localStorage.getItem('userRole') || 'user';
window.checkIsAdmin = () => {
    const role = window.getUserRole();
    return role === 'admin' || role === 'super-admin' || role === 'super_admin';
};
window.checkIsSuperAdmin = () => {
    const role = window.getUserRole();
    return role === 'super-admin' || role === 'super_admin';
};

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
    if (!mapInstance || typeof mapInstance.addControl !== 'function') return;

    const ToolControl = L.Control.extend({
        options: { position: 'topleft' },
        onAdd: function () {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');

            // Зупиняємо передачу кліків з меню на карту
            L.DomEvent.disableClickPropagation(container);

            const createBtn = (html, title, onClickAction) => {
                const btn = L.DomUtil.create('button', 'leaflet-custom-btn', container);
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
                if (window.UI && window.UI.toggleModal) {
                    const menu = document.getElementById('filterMenu');
                    const isHidden = window.getComputedStyle(menu).display === 'none';
                    window.UI.toggleModal('filterMenu', isHidden);
                }
            });

            return container;
        }
    });

    mapInstance.addControl(new ToolControl());
}

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
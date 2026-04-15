/**
 * UI Controller - Управління інтерфейсом користувача
 */

// Об'єкт для керування модальними вікнами
window.UI = {
    // Відкрити або закрити конкретну модалку
    toggleModal(modalId, show = true) {
        const modal = document.getElementById(modalId);
        const overlay = document.getElementById('modalOverlay');
        if (modal) modal.style.display = show ? 'block' : 'none';
        if (overlay) overlay.style.display = show ? 'block' : 'none';
    },

    // Закрити абсолютно все активне (модалки, фільтри)
    closeAllModals() {
        const elements = ['.modal', '.logic-modal', '.modal-container', '#modalOverlay'];
        elements.forEach(selector => {
            const el = document.querySelector(selector);
            if (el) el.style.display = 'none';
        });
    }
};

// Функція перевірки прав доступу та оновлення кнопок
export function checkAuthUI() {
    const role = localStorage.getItem('userRole');
    const isAuth = !!localStorage.getItem('userId');
    
    // Показуємо фільтр "Мої дільниці" тільки якщо юзер залогінений
    const myLabel = document.getElementById('myParcelsLabel');
    if (myLabel) myLabel.style.display = isAuth ? 'block' : 'none';
}

// Швидкий вихід (Logout)
window.quickLogout = () => {
    if (confirm("Вийти з акаунта?")) {
        const devMode = localStorage.getItem('devMode');
        const showQuickLogout = localStorage.getItem('showQuickLogout');

        localStorage.clear();

        // Зберігаємо технічні налаштування розробника
        if (devMode) localStorage.setItem('devMode', devMode);
        if (showQuickLogout) localStorage.setItem('showQuickLogout', showQuickLogout);

        location.reload();
    }
};

// Закриття фільтра по кліку на хрестик
document.getElementById('closeFilter')?.addEventListener('click', () => {
    document.getElementById('filterMenu').style.display = 'none';
});

// Закриття меню при кліку повз нього
document.addEventListener('click', (e) => {
    const filterMenu = document.getElementById('filterMenu');
    if (filterMenu && filterMenu.style.display === 'block') {
        // Якщо клік не по меню і не по кнопці виклику (🔍)
        if (!filterMenu.contains(e.target) && !e.target.closest('.leaflet-custom-btn')) {
            filterMenu.style.display = 'none';
        }
    }
});
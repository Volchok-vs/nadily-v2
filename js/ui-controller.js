/**
 * UI Controller - Управління інтерфейсом користувача
 */

// Об'єкт для керування модальними вікнами
// Переконайтеся, що на початку і в кінці файлу немає слова "export"
window.UI = {
    toggleModal(modalId, show = true) {
        const modal = document.getElementById(modalId);
        const overlay = document.getElementById('modalOverlay');
        if (modal) modal.style.display = show ? 'block' : 'none';
        if (overlay) overlay.style.display = show ? 'block' : 'none';
    },

    closeAllModals() {
        const selectors = ['.modal', '.modal-container', '#logicModal', '#modalOverlay'];
        selectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
                el.style.display = 'none';
            });
        });
    }
};
// Рядок 29 тепер має бути порожнім або закривати дужку, але НЕ містити "export default UI"



// Функція перевірки прав доступу та оновлення кнопок
function checkAuthUI() {
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
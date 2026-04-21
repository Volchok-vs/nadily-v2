/**
 * UI Controller - Управління інтерфейсом користувача
 */

window.UI = {
    // Список всіх потенційних модальних елементів
    selectors: [
        '.modal', 
        '#takeModal', 
        '#filterMenu', 
        '#modalOverlay', 
        '#superadmin-palette',
        '#logicModal'
    ],

    /**
     * Універсальний метод для перемикання вікна
     */
    toggleModal(modalId, show = true) {
        const modal = document.getElementById(modalId);
        const overlay = document.getElementById('modalOverlay');
        
        if (modal) {
            modal.style.display = show ? 'block' : 'none';
            
            // --- ЛОГІКА РЕЖИМУ КОРЕКЦІЇ ---
            if (show && modalId === 'takeModal') {
                const configs = JSON.parse(localStorage.getItem('app_dev_configs')) || {};
                const isCorrectionMode = configs.correctionMode === true;
                
                const correctionSection = document.getElementById('manual-date-section');
                const dateInput = document.getElementById('correction-date-input');

                if (isCorrectionMode) {
                    if (correctionSection) correctionSection.style.display = 'block';
                    // Встановлюємо сьогоднішню дату як початкову
                    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
                } else {
                    if (correctionSection) correctionSection.style.display = 'none';
                }
            }
            // ------------------------------

            // Додатково: скидаємо чекбокси всередині модалки при відкритті/закритті
            if (show) {
                const bypass = modal.querySelector('#admin-bypass-checkbox');
                if (bypass) bypass.checked = false;
            }
        }

        if (overlay) overlay.style.display = show ? 'block' : 'none';

        this._updateBodyScroll();
    },

    /**
     * Метод, який ховає ВСЕ активне
     */
    closeAllModals() {
        this.selectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
                el.style.display = 'none';
            });
        });
        document.body.classList.remove('modal-open');
    },

    /**
     * Приватний метод для керування прокруткою body
     */
    _updateBodyScroll() {
        const anyVisible = this.selectors.some(selector => {
            if (selector === '#modalOverlay') return false;
            const el = document.querySelector(selector);
            return el && el.style.display === 'block';
        });

        if (anyVisible) {
            document.body.classList.add('modal-open');
        } else {
            document.body.classList.remove('modal-open');
        }
    }
};

// Ініціалізація глобальних подій
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('closeFilter')?.addEventListener('click', () => {
        UI.toggleModal('filterMenu', false);
    });

    document.getElementById('modalOverlay')?.addEventListener('click', () => {
        UI.closeAllModals();
    });

    document.addEventListener('click', (e) => {
        const filterMenu = document.getElementById('filterMenu');
        if (filterMenu && filterMenu.style.display === 'block') {
            if (!filterMenu.contains(e.target) && !e.target.closest('.leaflet-custom-btn')) {
                UI.toggleModal('filterMenu', false);
            }
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            UI.closeAllModals();
        }
    });
});
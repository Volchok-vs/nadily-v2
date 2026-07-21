/**
 * date-utils.js - Утиліти для роботи з датами
 * Глобальні функції для зв'язування date pickers
 */

/**
 * Зв'язує два поля дат: коли обрана початкова дата,
 * встановлює її як мінімум та значення для кінцевої дати
 * @param {string} startInputId - ID поля початкової дати
 * @param {string} endInputId - ID поля кінцевої дати
 */
function linkDateInputs(startInputId, endInputId) {
    const startInput = document.getElementById(startInputId);
    const endInput = document.getElementById(endInputId);

    if (!startInput || !endInput) {
        console.warn(`[linkDateInputs] Поля не знайдено: ${startInputId}, ${endInputId}`);
        return;
    }

    // Видаляємо попередній обробник, щоб уникнути дублювання
    const newStartInput = startInput.cloneNode(true);
    startInput.parentNode.replaceChild(newStartInput, startInput);

    newStartInput.addEventListener('change', function() {
        if (this.value) {
            endInput.min = this.value;
            if (!endInput.value || endInput.value < this.value) {
                endInput.value = this.value;
            }
            console.log(`[linkDateInputs] Оновлено ${endInputId}: min=${this.value}, value=${endInput.value}`);
        }
    });

    console.log(`[linkDateInputs] Зв'язано: ${startInputId} → ${endInputId}`);
}

window.linkDateInputs = linkDateInputs;

// Експорт для ES6 модулів (якщо потрібно)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { linkDateInputs };
}

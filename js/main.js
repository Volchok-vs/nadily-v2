// main.js


// 2. Спільні змінні (експортуються один раз на самому початку)
export const userRole = localStorage.getItem('userRole');
export const currentUserId = localStorage.getItem('userId');
export const userFullName = localStorage.getItem('userFullName');
export const isAdmin = (userRole === 'admin' || userRole === 'super_admin');

// 3. Логіка фільтрації (для головної сторінки з картою)
window.applyFilters = () => {
    const searchInput = document.getElementById('searchNumber');
    const selectedRadio = document.querySelector('input[name="statusFilter"]:checked');
    
    if (!window.allParcelLayers || !window.map || !searchInput || !selectedRadio) return;

    const searchValue = searchInput.value.trim().toLowerCase();
    const filterType = selectedRadio.value;

    // ВИДАЛЕНО: const currentUserId = ... (використовуємо експортовану константу зверху)

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
                // Порівнюємо за допомогою глобальної currentUserId
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

// Обробники подій для інтерфейсу
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
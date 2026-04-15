// js/search-filter.js

let searchTimeout;

// Додаємо експорт окремої функції підрахунку
export function updateFilterCounts(allParcelLayers) {
    const currentUserId = localStorage.getItem('userId');

    const counts = {
        all: allParcelLayers.length,
        free: allParcelLayers.filter(item => item.data && item.data.status !== 'taken').length,
        taken: allParcelLayers.filter(item => item.data && item.data.status === 'taken').length,
        mine: allParcelLayers.filter(item => item.data && String(item.data.taken_by_id) === String(currentUserId)).length
    };

    // Оновлюємо текст у DOM
    const elements = {
        all: document.getElementById('cnt-all'),
        free: document.getElementById('cnt-free'),
        taken: document.getElementById('cnt-taken'),
        mine: document.getElementById('cnt-mine')
    };

    if (elements.all) elements.all.innerText = `(${counts.all})`;
    if (elements.free) elements.free.innerText = `(${counts.free})`;
    if (elements.taken) elements.taken.innerText = `(${counts.taken})`;
    if (elements.mine) elements.mine.innerText = `(${counts.mine})`;
}

export function initSearchAndFilters(map, allParcelLayers) {
    const searchInput = document.getElementById('searchNumber');
    const radioFilters = document.querySelectorAll('input[name="statusFilter"]');

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const val = e.target.value.trim().toLowerCase();

            // Скидаємо радіо-кнопки на "Всі" при пошуку
            if (val !== "") {
                const allRadio = document.querySelector('input[name="statusFilter"][value="all"]');
                if (allRadio) allRadio.checked = true;
            }

            // 1. МИТТЄВА ФІЛЬТРАЦІЯ (Тільки за початком номера)
            allParcelLayers.forEach(item => {
                // Виправлено:startsWith замість includes, щоб не плутати 1 та 10
                const isMatch = val === "" || item.name.startsWith(val); 
                if (isMatch) {
                    map.addLayer(item.layer);
                    if (item.label) map.addLayer(item.label);
                } else {
                    map.removeLayer(item.layer);
                    if (item.label) map.removeLayer(item.label);
                }
            });

            // 2. ПЛАВНИЙ ПОЛІТ (Тільки при повному збігу)
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                if (val !== "") {
                    const target = allParcelLayers.find(p => p.name === val);
                    if (target) {
                        map.flyToBounds(target.layer.getBounds(), {
                            padding: [120, 120],
                            duration: 1.5,
                            maxZoom: 18
                        });
                        setTimeout(() => target.layer.fire('click'), 1600);
                    }
                }
            }, 600); // Зменшено затримку для кращого відгуку
        });
    }

    radioFilters.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const status = e.target.value;
            const currentUserId = localStorage.getItem('userId');

            if (searchInput) searchInput.value = "";

            allParcelLayers.forEach(item => {
                const p = item.data;
                if (!p) return;

                let show = false;
                switch (status) {
                    case 'all': show = true; break;
                    case 'free': show = (p.status !== 'taken'); break;
                    case 'taken': show = (p.status === 'taken'); break;
                    case 'mine': show = (String(p.taken_by_id) === String(currentUserId)); break;
                }

                if (show) {
                    map.addLayer(item.layer);
                    if (item.label) map.addLayer(item.label);
                } else {
                    map.removeLayer(item.layer);
                    if (item.label) map.removeLayer(item.label);
                }
            });
        });
    });

    // СКИНУТИ ПОШУК КЛІКОМ ПО КАРТІ
    map.on('click', (e) => {
        const isMapClick = e.originalEvent.target.id === 'map' || 
                           e.originalEvent.target.classList.contains('leaflet-container');

        if (isMapClick && searchInput && searchInput.value !== "") {
            searchInput.value = "";
            const activeFilter = document.querySelector('input[name="statusFilter"]:checked').value;
            
            // Викликаємо зміну фільтра програмно, щоб оновити видимість
            document.querySelector(`input[name="statusFilter"][value="${activeFilter}"]`).dispatchEvent(new Event('change'));
        }
    });

    // Початковий підрахунок при ініціалізації
    updateFilterCounts(allParcelLayers);
}
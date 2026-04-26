// js/search-filter.js
import { currentUserId } from './main.js';

let config = { showVillage: false, showBusiness: false };

const fitVisibleLayers = (map, layers) => {
    const visibleLayers = layers.filter(l => map.hasLayer(l.layer)).map(l => l.layer);
    if (visibleLayers.length > 0) {
        const group = L.featureGroup(visibleLayers);
        map.flyToBounds(group.getBounds(), { padding: [40, 40], duration: 1.2 });
    }
};

export function updateFilterCounts(layers) {
    if (!layers) return;
    const allData = layers.map(i => i.data || {});
    const isFree = (d) => !d.status || d.status === 'free';

    document.getElementById('cnt-all').textContent = allData.length;
    document.getElementById('cnt-mine').textContent = allData.filter(d => String(d.taken_by_id) === String(currentUserId)).length;
    document.getElementById('cnt-free').textContent = allData.filter(isFree).length;

    document.querySelectorAll('.sub-chk').forEach(chk => {
        const type = chk.dataset.type;
        const count = allData.filter(d => d.type === type && isFree(d)).length;
        chk.parentElement.querySelector('.count-val').textContent = count;
    });
}

export function initSearchAndFilters(map, layers) {
    const menu = document.getElementById('filterMenu');
    const searchInput = document.getElementById('searchNumber');

    const apply = (source) => {
        const search = searchInput.value.trim().toLowerCase();
        const mode = menu.querySelector('input[name="filterMode"]:checked').value;
        const activeTypes = Array.from(menu.querySelectorAll('.sub-chk:checked')).map(c => c.dataset.type);

        // Керування відображенням GPS блоку
        menu.querySelector('.geo-control').style.display = (mode === 'mine') ? 'block' : 'none';

        layers.forEach(item => {
            const d = item.data || {};
            let show = false;

            // Фільтр по селах/бізнесу
            if (d.type === 'села' && !config.showVillage) { show = false; }
            else if (d.type === 'ділова' && !config.showBusiness) { show = false; }
            else {
                if (search) {
                    show = (d.name || "").toString().toLowerCase().includes(search);
                } else if (mode === 'mine') {
                    show = String(d.taken_by_id) === String(currentUserId);
                } else if (mode === 'free') {
                    show = (!d.status || d.status === 'free') && activeTypes.includes(d.type);
                } else {
                    show = true;
                }
            }

            if (show) item.layer.addTo(map);
            else map.removeLayer(item.layer);
        });

        // Авто-зум при зміні фільтра (не пошуку)
        if (source === 'filter') fitVisibleLayers(map, layers);
    };

    // Слухачі для конфігу
    document.getElementById('cfg-bus').onchange = (e) => { config.showBusiness = e.target.checked; apply('filter'); };
    document.getElementById('cfg-vil').onchange = (e) => { config.showVillage = e.target.checked; apply('filter'); };
    
    // Інші слухачі
    searchInput.addEventListener('input', () => apply('search'));
    menu.querySelectorAll('input[name="filterMode"], .sub-chk').forEach(el => {
        el.addEventListener('change', () => apply('filter'));
    });

    updateFilterCounts(layers);
}
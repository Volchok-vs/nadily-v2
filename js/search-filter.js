// search-filter.js

import { currentUserId } from './main.js';

let config = JSON.parse(localStorage.getItem('filterConfig')) || {
    adminMenuOpen: false
};

let currentFilterMode = 'city'; // 'city' або 'village'
let allParcelLayers = [];

const catsDef = [
    { id: 'приватн', label: '🏠 Приватні', adminOnly: false },
    { id: 'змішан', label: '🏢+🏠 Змішані', adminOnly: false },
    { id: 'поверхів', label: '🏢 Поверхівки', adminOnly: false },
    { id: 'ділова', label: '💼 Ділова тер.', adminOnly: true, configKey: 'showBusiness' },
    { id: 'сел', label: '🚜 Села', adminOnly: true, configKey: 'showVillage' }
];

const isFree = (p) => !p.status || p.status === 'free' || p.status === 'null' || p.status === '';
const isTaken = (p) => p.status === 'taken' || p.status === 'reserved';
const isMine = (p) => String(p.taken_by_id) === String(currentUserId);
const isVillage = (p) => (p.category || p.type || "").toLowerCase().includes('сел');

// Допоміжна функція для динамічного рендеру підкатегорій
const renderSubItems = (prefix, dataList, excludeVillages = false) => {
    return catsDef
        .filter(c => {
            // Виключаємо села, якщо excludeVillages = true
            if (excludeVillages && c.id === 'сел') return false;

            // ОНОВЛЕНО: НЕ ФІЛЬТРУЄМО тут на основі adminOnly / configKey,
            // оскільки це чекбокси для ВНУТРІШНЬОЇ фільтрації користувача.
            // Глобальні адмін-налаштування (config.showVillage/showBusiness)
            // будуть застосовані в apply() для ВИДИМОСТІ на карті.

            // 2. ДИНАМІКА: Показуємо лише ті категорії, які реально є в цьому списку дільниць
            const currentCats = [...new Set(dataList.map(p => (p.category || p.type || "").toLowerCase()))];
            return currentCats.some(cc => cc.includes(c.id));
        })
        .map(c => {
            const count = dataList.filter(p => (p.category || p.type || "").toLowerCase().includes(c.id)).length;
            // sub-chk мають бути активні за замовчуванням, тому checked
            return `
                <label class="row sub-item">
                    <input type="checkbox" class="sub-chk sub-${prefix}" data-prefix="${prefix}" data-type="${c.id}" checked>
                    <span style="margin-left:8px;">${c.label}</span>
                    <span class="sub-count">(${count})</span>
                </label>
            `;
        }).join('');
};

// Функція для отримання унікальних сел з даних
const getUniqueVillages = (data) => {
    const villages = new Set();
    data.forEach(p => {
        const name = p.name || '';
        // Визначаємо, чи це село за назвою або категорією
        if (isVillage(p) || name.match(/^[А-Яа-яіїєІЇЄґҐ]+$/)) {
            villages.add(name);
        }
    });
    return Array.from(villages).sort();
};

export function updateFilterCounts(allParcelLayers) {
    if (!allParcelLayers) return;
    const allData = allParcelLayers.map(i => i.data || {});

    const updateBadge = (id, count) => {
        const badge = document.querySelector(`${id} .count-badge`);
        if (badge) badge.textContent = count;

        // Приховуємо "Мої" або "На руках", якщо там 0 (інакше показуємо)
        const section = document.querySelector(id);
        if (section && (id === '#sec-mine' || id === '#sec-taken')) {
            section.style.display = count > 0 ? 'block' : 'none';
        }
    };

    // Оновлюємо лічильники для міського режиму
    updateBadge('#sec-all', allData.filter(p => !isVillage(p)).length);
    updateBadge('#sec-free', allData.filter(p => isFree(p) && !isVillage(p)).length);
    updateBadge('#sec-taken', allData.filter(p => isTaken(p) && !isVillage(p)).length);
    updateBadge('#sec-mine', allData.filter(p => isMine(p) && !isVillage(p)).length);

    // Оновлюємо лічильники для режиму Села
    const villageData = allData.filter(isVillage);
    updateBadge('#sec-village-all', villageData.length);
    updateBadge('#sec-village-free', villageData.filter(isFree).length);
    updateBadge('#sec-village-taken', villageData.filter(isTaken).length);
    updateBadge('#sec-village-mine', villageData.filter(isMine).length);

    // Приховуємо секції сіл з 0
    const secVillageTaken = document.querySelector('#sec-village-taken');
    const secVillageMine = document.querySelector('#sec-village-mine');
    if (secVillageTaken) secVillageTaken.style.display = villageData.filter(isTaken).length > 0 ? 'block' : 'none';
    if (secVillageMine) secVillageMine.style.display = villageData.filter(isMine).length > 0 ? 'block' : 'none';
}

function attachEvents(menu, map, layers) {
    const searchInput = menu.querySelector('#searchBox');
    let searchTimeout;

    const apply = () => {
        const searchVal = searchInput.value.trim().toLowerCase();

        // Логування пошуку
        if (searchVal !== "") {
            import('./analytics.js').then(({ logSearch }) => {
                const found = layers.some(item => {
                    const p = item.data || {};
                    const pName = (p.name || "").toString().toLowerCase();
                    return pName === searchVal;
                });
                logSearch(searchVal, found);
            });
        }

        // Перевіряємо, який режим активний
        const isVillageMode = currentFilterMode === 'village';

        const isAll = menu.querySelector('#chk-all')?.checked || false;
        const isFreeMode = menu.querySelector('#chk-free')?.checked || false;
        const isTakenMode = menu.querySelector('#chk-taken')?.checked || false;
        const isMineMode = menu.querySelector('#chk-mine')?.checked || false;

        // Фільтри для режиму Села
        const isVillageAll = menu.querySelector('#chk-village-all')?.checked || false;
        const isVillageFree = menu.querySelector('#chk-village-free')?.checked || false;
        const isVillageTaken = menu.querySelector('#chk-village-taken')?.checked || false;
        const isVillageMine = menu.querySelector('#chk-village-mine')?.checked || false;

        layers.forEach(item => {
            const p = item.data || {};
            const pName = (p.name || "").toString().toLowerCase();
            const pCat = (p.category || p.type || "").toLowerCase();

            let visible = false;

            // Режим Села
            if (isVillageMode) {
                if (!isVillage(p)) {
                    visible = false;
                } else if (isVillageAll) {
                    visible = true;
                } else if (isVillageFree && isFree(p)) {
                    visible = true;
                } else if (isVillageTaken && isTaken(p)) {
                    visible = true;
                } else if (isVillageMine && isMine(p)) {
                    visible = true;
                }
            } else {
                // Режим Місто
                if (searchVal !== "") {
                    visible = (pName === searchVal);
                } else if (isAll) {
                    visible = true;
                } else {
                    if (isMineMode && isMine(p)) {
                        const activeCats = Array.from(menu.querySelectorAll('.sub-mine:checked')).map(el => el.dataset.type);
                        visible = activeCats.length === 0 || activeCats.some(c => pCat.includes(c));
                    } else if (isFreeMode && isFree(p)) {
                        const activeCats = Array.from(menu.querySelectorAll('.sub-free:checked')).map(el => el.dataset.type);
                        visible = activeCats.length === 0 || activeCats.some(c => pCat.includes(c));
                    } else if (isTakenMode && isTaken(p)) {
                        const activeCats = Array.from(menu.querySelectorAll('.sub-taken:checked')).map(el => el.dataset.type);
                        visible = activeCats.length === 0 || activeCats.some(c => pCat.includes(c));
                    }
                }
            }

            // Застосовуємо видимість
            if (visible) {
                if (!map.hasLayer(item.layer)) item.layer.addTo(map);
                if (item.label && !map.hasLayer(item.label)) item.label.addTo(map);
            } else {
                if (map.hasLayer(item.layer)) map.removeLayer(item.layer);
                if (item.label && map.hasLayer(item.label)) map.removeLayer(item.label);
            }
        });

        clearTimeout(searchTimeout);
        if (searchVal !== "") {
            searchTimeout = setTimeout(() => {
                const target = layers.find(item =>
                    (item.data?.name || "").toString().toLowerCase() === searchVal
                );

                if (target) {
                    console.log(`[Search] Знайдено дільницю: ${target.name}`);
                    searchInput.blur();

                    if (!map.hasLayer(target.layer)) {
                        target.layer.addTo(map);
                        if (target.label) target.label.addTo(map);
                    }

                    map.flyToBounds(target.layer.getBounds(), {
                        padding: [100, 100], duration: 1.5, maxZoom: 18
                    });

                    setTimeout(() => {
                        target.layer.eachLayer((internalLayer) => {
                            if (internalLayer.getPopup()) {
                                console.log(`[Search] Відкриваємо попап внутрішнього шару`);
                                internalLayer.openPopup();
                            }
                        });
                        target.layer.fire('click');
                    }, 1600);
                } else {
                    console.warn(`[Search] Дільницю №${searchVal} не знайдено`);
                }
            }, 800);
        }

        // Оновлення активного класу секцій для міського режиму
        ['all', 'free', 'mine', 'taken'].forEach(m => {
            const sec = menu.querySelector(`#sec-${m}`);
            const chk = menu.querySelector(`#chk-${m}`);
            if (sec && chk) {
                sec.className = `filter-section ${chk.checked ? 'active' : 'inactive'}`;
            }
        });

        // Оновлення активного класу секцій для режиму Села
        ['village-all', 'village-free', 'village-taken', 'village-mine'].forEach(m => {
            const sec = menu.querySelector(`#sec-${m}`);
            const chk = menu.querySelector(`#chk-${m}`);
            if (sec && chk) {
                sec.className = `filter-section ${chk.checked ? 'active' : 'inactive'}`;
            }
        });
    };

    const switchMode = (id) => {
        if (id !== 'chk-all') searchInput.value = '';

        // Перевіряємо, чи це фільтр сіл
        const isVillageFilter = id.startsWith('chk-village-');

        if (isVillageFilter) {
            // Перемикання фільтрів сіл
            ['chk-village-all', 'chk-village-free', 'chk-village-taken', 'chk-village-mine'].forEach(cid => {
                const el = menu.querySelector(`#${cid}`);
                if (el) el.checked = (cid === id);
            });
        } else {
            // Перемикання міських фільтрів
            ['chk-all', 'chk-free', 'chk-taken', 'chk-mine'].forEach(cid => {
                const el = menu.querySelector(`#${cid}`);
                if (el) {
                    el.checked = (cid === id);
                    if (cid === id && cid !== 'chk-all') {
                        const prefix = cid.split('-')[1];
                        // ОНОВЛЕНО: При перемиканні головного фільтра, всі підкатегорії стають checked
                        menu.querySelectorAll(`.sub-${prefix}`).forEach(sub => sub.checked = true);
                    }
                }
            });
        }
        apply();
        updateFilterCounts(layers); // Оновлюємо лічильники після зміни фільтра
    };

    searchInput.onfocus = () => {
        if (!menu.querySelector('#chk-all')?.checked) switchMode('chk-all');
    };
    searchInput.oninput = apply;

    const chkAll = menu.querySelector('#chk-all');
    if (chkAll) chkAll.onclick = () => switchMode('chk-all');

    const chkFree = menu.querySelector('#chk-free');
    if (chkFree) chkFree.onclick = () => switchMode('chk-free');

    const chkTaken = menu.querySelector('#chk-taken');
    if (chkTaken) chkTaken.onclick = () => switchMode('chk-taken');

    const chkMine = menu.querySelector('#chk-mine');
    if (chkMine) chkMine.onclick = () => switchMode('chk-mine');

    // Обробники для фільтрів сіл
    const chkVillageAll = menu.querySelector('#chk-village-all');
    if (chkVillageAll) chkVillageAll.onclick = () => switchMode('chk-village-all');

    const chkVillageFree = menu.querySelector('#chk-village-free');
    if (chkVillageFree) chkVillageFree.onclick = () => switchMode('chk-village-free');

    const chkVillageTaken = menu.querySelector('#chk-village-taken');
    if (chkVillageTaken) chkVillageTaken.onclick = () => switchMode('chk-village-taken');

    const chkVillageMine = menu.querySelector('#chk-village-mine');
    if (chkVillageMine) chkVillageMine.onclick = () => switchMode('chk-village-mine');

    menu.querySelectorAll('.sub-chk').forEach(el => el.onchange = apply);

    if (!map._searchEventAttached) {
        map.on('click', () => {
            if (searchInput.value.trim() !== "") {
                searchInput.value = "";
                apply();
                console.log("[Map] Пошук скинуто кліком");
            }
        });
        map._searchEventAttached = true;
    }
}

export function initSearchAndFilters(map, parcelLayers) {
    const menu = document.getElementById('filterMenu');
    if (!menu) return;

    allParcelLayers = parcelLayers;

    if (!map._searchEventAttached) {
        map.on('click', (e) => {
            const searchBox = document.getElementById('searchBox');
            if (searchBox && searchBox.value !== "") {
                searchBox.value = "";
                searchBox.dispatchEvent(new Event('input'));
                console.log("Пошук скинуто кліком по карті");
            }
        });
        map._searchEventAttached = true;
    }

    const isGuest = !localStorage.getItem('userId');

    const allData = allParcelLayers.map(i => i.data || {});
    const freeData = allData.filter(isFree);
    const takenData = allData.filter(isTaken);

    const myData = isGuest ? [] : allData.filter(item => {
        return String(item.taken_by_id) === String(localStorage.getItem('userId'));
    });

    // Заповнюємо випадаючий список сел
    const villageSelect = document.getElementById('villageSelect');
    if (villageSelect) {
        const villages = getUniqueVillages(allData);
        villageSelect.innerHTML = '<option value="">Оберіть село...</option>';
        villages.forEach(v => {
            const option = document.createElement('option');
            option.value = v;
            option.textContent = v;
            villageSelect.appendChild(option);
        });

        // Додаємо обробник вибору села
        villageSelect.onchange = () => {
            const selectedVillage = villageSelect.value;
            if (selectedVillage) {
                // Знаходимо дільницю з цією назвою і летимо до неї
                const target = allParcelLayers.find(item =>
                    (item.data?.name || "") === selectedVillage
                );

                if (target) {
                    console.log(`[Village] Обрано село: ${selectedVillage}`);
                    if (!map.hasLayer(target.layer)) {
                        target.layer.addTo(map);
                        if (target.label) target.label.addTo(map);
                    }

                    map.flyToBounds(target.layer.getBounds(), {
                        padding: [100, 100], duration: 1.5, maxZoom: 18
                    });

                    setTimeout(() => {
                        target.layer.eachLayer((internalLayer) => {
                            if (internalLayer.getPopup()) {
                                internalLayer.openPopup();
                            }
                        });
                        target.layer.fire('click');
                    }, 1600);
                }
            }
        };
    }

    const oldSearch = menu.querySelector('#searchBox') ? menu.querySelector('#searchBox').value : "";
    const activeId = menu.querySelector('.filter-section.active input') ? menu.querySelector('.filter-section.active input').id : 'chk-all';

    // Оновлюємо HTML для міського режиму
    const cityMode = document.getElementById('cityMode');
    if (cityMode) {
        cityMode.innerHTML = `
            <input type="text" id="searchBox" placeholder="Введіть номер..." autocomplete="off" inputmode="numeric" value="${oldSearch}">
            
            <div class="filter-section active" id="sec-all">
                <label class="row">
                    <input type="checkbox" id="chk-all" checked>
                    <span class="label-text">Всі дільниці</span>
                    <span class="dots-filler"></span>
                    <span class="count-badge" id="cnt-all">0</span>
                </label>
            </div>

            <div class="filter-section inactive" id="sec-mine" style="display: none;">
                <label class="row">
                    <input type="checkbox" id="chk-mine">
                    <span class="label-text">👤 Мої дільниці</span>
                    <span class="dots-filler"></span>
                    <span class="count-badge" id="cnt-mine">0</span>
                </label>
                <div class="sub-list" id="sub-mine-list">${renderSubItems('mine', myData, false)}</div>
            </div>

            <div class="filter-section inactive" id="sec-free">
                <label class="row">
                    <input type="checkbox" id="chk-free">
                    <span class="label-text">✅ Вільні</span>
                    <span class="dots-filler"></span>
                    <span class="count-badge" id="cnt-free">0</span>
                </label>
                <div class="sub-list" id="sub-free-list">${renderSubItems('free', freeData, true)}</div>
            </div>

            <div class="filter-section inactive" id="sec-taken" style="display: none;">
                <label class="row">
                    <input type="checkbox" id="chk-taken">
                    <span class="label-text">🚩 На руках</span>
                    <span class="dots-filler"></span>
                    <span class="count-badge" id="cnt-taken">0</span>
                </label>
                <div class="sub-list" id="sub-taken-list">${renderSubItems('taken', takenData, true)}</div>
            </div>
        `;
    }

    const isSuperAdmin = localStorage.getItem('userRole') === 'super_admin';
    if (isSuperAdmin) {
        const adminArea = menu.querySelector('#adminArea');
        if (adminArea) {
            adminArea.innerHTML = `
                <div id="adminHeader" style="cursor:pointer; padding:10px 0; border-top:1px dashed #ccc; margin-top:10px; display:flex; justify-content:space-between; font-size:12px; color:#666;">
                    <span>⚙️ Налаштування територій</span>
                    <span id="admArr">${config.adminMenuOpen ? '▲' : '▼'}</span>
                </div>
                <div id="adminBody" style="display:${config.adminMenuOpen ? 'block' : 'none'}; padding-top:5px;">
                    <p style="color: #999; font-size: 11px; margin: 5px 0;">Налаштування тимчасово вимкнено</p>
                </div>
            `;
            const adminBodyElement = adminArea.querySelector('#adminBody');
            if (adminBodyElement) {
                adminBodyElement.style.display = config.adminMenuOpen ? 'block' : 'none';
            }

            adminArea.querySelector('#adminHeader').onclick = () => {
                const b = adminArea.querySelector('#adminBody');
                const arr = adminArea.querySelector('#admArr');
                if (b.style.display === 'none') {
                    b.style.display = 'block';
                    arr.textContent = '▲';
                    config.adminMenuOpen = true;
                } else {
                    b.style.display = 'none';
                    arr.textContent = '▼';
                    config.adminMenuOpen = false;
                }
                localStorage.setItem('filterConfig', JSON.stringify(config));
            };
        }
    }

    // Повертаємо активний чекбокс
    const activeChk = menu.querySelector(`#${activeId}`);
    if (activeChk) activeChk.checked = true;

    attachEvents(menu, map, allParcelLayers);
    updateFilterCounts(allParcelLayers);
}

// Глобальна функція для перемикання режимів (toggle switch)
window.toggleFilterMode = () => {
    const toggle = document.getElementById('modeToggle');
    const mode = toggle.checked ? 'village' : 'city';
    currentFilterMode = mode;
    
    const cityMode = document.getElementById('cityMode');
    const villageMode = document.getElementById('villageMode');
    
    if (mode === 'city') {
        cityMode.style.display = 'block';
        villageMode.style.display = 'none';
        
        // Показуємо міські дільниці, приховуємо села
        if (window.map && allParcelLayers) {
            allParcelLayers.forEach(item => {
                const p = item.data || {};
                const isVillageParcel = isVillage(p);
                
                if (isVillageParcel) {
                    // Приховуємо села
                    if (window.map.hasLayer(item.layer)) window.map.removeLayer(item.layer);
                    if (item.label && window.map.hasLayer(item.label)) window.map.removeLayer(item.label);
                } else {
                    // Показуємо міські дільниці
                    if (!window.map.hasLayer(item.layer)) item.layer.addTo(window.map);
                    if (item.label && !window.map.hasLayer(item.label)) item.label.addTo(window.map);
                }
            });
            
            // Автоматично масштабуємо на всі дільниці
            setTimeout(() => {
                const bounds = L.latLngBounds([]);
                allParcelLayers.forEach(item => {
                    const p = item.data || {};
                    if (!isVillage(p) && item.layer && item.layer.getBounds) {
                        bounds.extend(item.layer.getBounds());
                    }
                });
                if (bounds.isValid()) {
                    window.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
                }
            }, 100);
        }
    } else {
        cityMode.style.display = 'none';
        villageMode.style.display = 'block';
        
        // Показуємо села, приховуємо міські дільниці
        if (window.map && allParcelLayers) {
            allParcelLayers.forEach(item => {
                const p = item.data || {};
                const isVillageParcel = isVillage(p);
                
                if (isVillageParcel) {
                    // Показуємо села
                    if (!window.map.hasLayer(item.layer)) item.layer.addTo(window.map);
                    if (item.label && !window.map.hasLayer(item.label)) item.label.addTo(window.map);
                } else {
                    // Приховуємо міські дільниці
                    if (window.map.hasLayer(item.layer)) window.map.removeLayer(item.layer);
                    if (item.label && window.map.hasLayer(item.label)) window.map.removeLayer(item.label);
                }
            });
            
            // Автоматично масштабуємо на села
            setTimeout(() => {
                const bounds = L.latLngBounds([]);
                allParcelLayers.forEach(item => {
                    const p = item.data || {};
                    if (isVillage(p) && item.layer && item.layer.getBounds) {
                        bounds.extend(item.layer.getBounds());
                    }
                });
                if (bounds.isValid()) {
                    window.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
                }
            }, 100);
        }
    }
};

// Рядок видалено: export { updateFilterCounts };
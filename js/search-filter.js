import { currentUserId } from './main.js';

let config = { showVillage: false, showBusiness: false };

const catsDef = [
    { id: 'приватн', label: '🏠 Приватні', adminOnly: false },
    { id: 'змішан', label: '🏢+🏠 Змішані', adminOnly: false },
    { id: 'поверхів', label: '🏢 Поверхівки', adminOnly: false },
    { id: 'ділова', label: '💼 Ділова тер.', adminOnly: true, configKey: 'showBusiness' },
    { id: 'села', label: '🚜 Села', adminOnly: true, configKey: 'showVillage' }
];

const isFree = (p) => !p.status || p.status === 'free' || p.status === 'null' || p.status === '';
const isTaken = (p) => p.status === 'taken' || p.status === 'reserved';
const isMine = (p) => String(p.taken_by_id) === String(currentUserId);

// Допоміжна функція для динамічного рендеру підкатегорій (як у вашому скрипті)
const renderSubItems = (prefix, dataList) => {
    return catsDef
        .filter(c => {
            // 1. Перевірка на адмін-налаштування
            if (c.configKey && !config[c.configKey]) return false;

            // 2. ДИНАМІКА: Показуємо лише ті категорії, які реально є в цьому списку дільниць
            const currentCats = [...new Set(dataList.map(p => (p.category || p.type || "").toLowerCase()))];
            return currentCats.some(cc => cc.includes(c.id));
        })
        .map(c => {
            const count = dataList.filter(p => (p.category || p.type || "").toLowerCase().includes(c.id)).length;
            return `
                <label class="row sub-item">
                    <input type="checkbox" class="sub-chk sub-${prefix}" data-prefix="${prefix}" data-type="${c.id}" checked> 
                    <span style="margin-left:8px;">${c.label}</span>
                    <span class="sub-count">(${count})</span>
                </label>
            `;
        }).join('');
};

export function updateFilterCounts(allParcelLayers) {
    if (!allParcelLayers) return;
    const allData = allParcelLayers.map(i => i.data || {});

    const updateBadge = (id, count) => {
        const badge = document.querySelector(`${id} .count-badge`);
        if (badge) badge.textContent = count;

        // Приховуємо "Мої" або "На руках", якщо там 0
        const section = document.querySelector(id);
        if (section && (id === '#sec-mine' || id === '#sec-taken')) {
            section.style.display = count > 0 ? 'block' : 'none';
        }
    };

    updateBadge('#sec-all', allData.length);
    updateBadge('#sec-free', allData.filter(isFree).length);
    updateBadge('#sec-taken', allData.filter(isTaken).length);
    updateBadge('#sec-mine', allData.filter(isMine).length);
}

function attachEvents(menu, map, layers) {
    const searchInput = menu.querySelector('#searchBox');
    let searchTimeout;

    const apply = () => {
        const searchVal = searchInput.value.trim().toLowerCase();

        // БЕЗПЕЧНЕ отримання значень: додаємо ?. перед .checked
        // Якщо елемента немає, повернеться false
        const isAll = menu.querySelector('#chk-all')?.checked || false;
        const isFreeMode = menu.querySelector('#chk-free')?.checked || false;
        const isTakenMode = menu.querySelector('#chk-taken')?.checked || false;
        const isMineMode = menu.querySelector('#chk-mine')?.checked || false;

        layers.forEach(item => {
            const p = item.data || {};
            const pName = (p.name || "").toString().toLowerCase();
            const pCat = (p.category || p.type || "").toLowerCase();

            let visible = false;

            // 1. ЛОГІКА ФІЛЬТРАЦІЇ
            if (searchVal !== "") {
                // ВИПРАВЛЕННЯ: Тільки точний збіг для відображення на карті
                // Це прибере підсвітку 30-39, коли введено "3"
                visible = (pName === searchVal);
            } else if (isAll) {
                visible = true;
            } else {
                // Логіка для вкладок Вільні/Мої/На руках
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

            // Перевірка адмін-категорій (залишаємо як було)
            const isHiddenByAdmin = (pCat.includes('села') && !config.showVillage) ||
                (pCat.includes('ділова') && !config.showBusiness);
            if (isHiddenByAdmin) visible = false;

            // Застосовуємо видимість
            if (visible) {
                if (!map.hasLayer(item.layer)) item.layer.addTo(map);
                if (item.label && !map.hasLayer(item.label)) item.label.addTo(map);
            } else {
                if (map.hasLayer(item.layer)) map.removeLayer(item.layer);
                if (item.label && map.hasLayer(item.label)) map.removeLayer(item.label);
            }
        });

        // 2. ПЛАВНИЙ ПОЛІТ (у файлі search-filter.js)
        clearTimeout(searchTimeout);
        if (searchVal !== "") {
            searchTimeout = setTimeout(() => {
                const target = layers.find(item =>
                    (item.data?.name || "").toString().toLowerCase() === searchVal
                );

                if (target) {
                    console.log(`[Search] Знайдено дільницю: ${target.name}`);

                    // --- ДОДАНО: Приховуємо клавіатуру ---
                    searchInput.blur();

                    if (!map.hasLayer(target.layer)) {
                        target.layer.addTo(map);
                        if (target.label) target.label.addTo(map);
                    }

                    map.flyToBounds(target.layer.getBounds(), {
                        padding: [100, 100],
                        duration: 1.5,
                        maxZoom: 18
                    });

                    // Чекаємо завершення польоту
                    setTimeout(() => {
                        // Оскільки target.layer — це L.featureGroup, нам треба знайти всередині нього 
                        // реальний полігон, до якого ви прив'язали bindPopup в index.html
                        target.layer.eachLayer((internalLayer) => {
                            if (internalLayer.getPopup()) {
                                console.log(`[Search] Відкриваємо попап внутрішнього шару`);
                                internalLayer.openPopup();
                            }
                        });

                        // Якщо раптом попап не відкрився стандартно, імітуємо клік
                        target.layer.fire('click');
                    }, 1600);

                } else {
                    console.warn(`[Search] Дільницю №${searchVal} не знайдено`);
                }
            }, 800);
        }

        // Оновлення активного класу секцій
        ['all', 'free', 'mine', 'taken'].forEach(m => {
            const sec = menu.querySelector(`#sec-${m}`);
            const chk = menu.querySelector(`#chk-${m}`);
            // Додаємо перевірку: якщо секція і чекбокс існують
            if (sec && chk) {
                sec.className = `filter-section ${chk.checked ? 'active' : 'inactive'}`;
            }
        });
    };

    // Решта обробників подій
    const switchMode = (id) => {
        if (id !== 'chk-all') searchInput.value = '';

        ['chk-all', 'chk-free', 'chk-taken', 'chk-mine'].forEach(cid => {
            const el = menu.querySelector(`#${cid}`);
            if (el) { // ПЕРЕВІРКА: працюємо з елементом тільки якщо він існує
                el.checked = (cid === id);
                if (cid === id && cid !== 'chk-all') {
                    const prefix = cid.split('-')[1];
                    menu.querySelectorAll(`.sub-${prefix}`).forEach(sub => sub.checked = true);
                }
            }
        });
        apply();
    };

    // 1. Пошук (додаємо ? перед .checked)
    searchInput.onfocus = () => {
        if (!menu.querySelector('#chk-all')?.checked) switchMode('chk-all');
    };
    searchInput.oninput = apply;

    // 2. Стандартні фільтри (використовуємо змінні, щоб перевірити їх існування)
    const chkAll = menu.querySelector('#chk-all');
    if (chkAll) chkAll.onclick = () => switchMode('chk-all');

    const chkFree = menu.querySelector('#chk-free');
    if (chkFree) chkFree.onclick = () => switchMode('chk-free');

    // 3. Фільтри, які можуть бути відсутні у гостей
    const chkTaken = menu.querySelector('#chk-taken');
    if (chkTaken) chkTaken.onclick = () => switchMode('chk-taken');

    const chkMine = menu.querySelector('#chk-mine');
    if (chkMine) chkMine.onclick = () => switchMode('chk-mine');

    // 4. Під-чекбокси (працює масово, тому помилок не буде, якщо масив порожній)
    menu.querySelectorAll('.sub-chk').forEach(el => el.onchange = apply);

    // 5. Адмін-налаштування
    const cb = menu.querySelector('#cfg-bus');
    const cv = menu.querySelector('#cfg-vil');
    if (cb) cb.onchange = (e) => {
        config.showBusiness = e.target.checked;
        initSearchAndFilters(map, layers);
    };
    if (cv) cv.onchange = (e) => {
        config.showVillage = e.target.checked;
        initSearchAndFilters(map, layers);
    };

    // 6. Скидання кліком по карті
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

export function initSearchAndFilters(map, allParcelLayers) {
    const menu = document.getElementById('filterMenu');
    if (!menu) return;

    // Додаємо слухач на карту (скидання пошуку при кліку на порожнє місце)
    // Робимо це один раз, перевіряючи, чи не додали ми його раніше
    if (!map._searchEventAttached) {
        map.on('click', (e) => {
            const searchBox = document.getElementById('searchBox');
            if (searchBox && searchBox.value !== "") {
                searchBox.value = "";
                // Викликаємо функцію фільтрації (вона зазвичай всередині attachEvents або глобальна)
                // Якщо у вас фільтрація запускається через input event:
                searchBox.dispatchEvent(new Event('input'));
                console.log("Пошук скинуто кліком по карті");
            }
        });
        map._searchEventAttached = true;
    }

    // 1. Отримуємо ID користувача
    const currentUserId = localStorage.getItem('userId');
    const isGuest = !currentUserId;

    // 2. Отримуємо всі дані
    const allData = allParcelLayers.map(i => i.data || {});

    // 3. Фільтруємо масиви з урахуванням авторизації
    const freeData = allData.filter(isFree);
    const takenData = allData.filter(isTaken);

    // ПРАВКА ТУТ: Якщо це гість, масив "Мої дільниці" завжди порожній
    const myData = isGuest ? [] : allData.filter(item => {
        return String(item.taken_by_id) === String(currentUserId);
    });

    // Зберігаємо старі значення
    const oldSearch = menu.querySelector('#searchBox') ? menu.querySelector('#searchBox').value : "";
    const activeId = menu.querySelector('.filter-section.active input') ? menu.querySelector('.filter-section.active input').id : 'chk-all';

    menu.innerHTML = `
    <h4 style="margin:0 0 12px 0;">🔍 Розумний фільтр</h4>
    <input type="text" id="searchBox" placeholder="Введіть номер..." autocomplete="off" value="${oldSearch}">
    
    <div class="filter-section" id="sec-all">
        <label class="row"><input type="checkbox" id="chk-all"> <span style="margin-left:10px; font-weight:bold;">Всі дільниці</span> <span class="count-badge">0</span></label>
    </div>

    <div class="filter-section" id="sec-free">
        <label class="row"><input type="checkbox" id="chk-free"> <span style="margin-left:10px;">✅ Вільні</span> <span class="count-badge">0</span></label>
        <div class="sub-list">${renderSubItems('free', freeData)}</div>
    </div>

    <div class="filter-section" id="sec-taken" style="display:none;">
        <label class="row"><input type="checkbox" id="chk-taken"> <span style="margin-left:10px;">🚩 На руках</span> <span class="count-badge">0</span></label>
        <div class="sub-list">${renderSubItems('taken', takenData)}</div>
    </div>
    
    ${!isGuest ? `
    <div class="filter-section" id="sec-mine">
        <label class="row">
            <input type="checkbox" id="chk-mine"> 
            <span style="margin-left:10px;">👤 Мої дільниці</span> 
            <span class="count-badge">0</span>
        </label>
        <div class="sub-list">${renderSubItems('mine', myData)}</div>
    </div>
    ` : ''}

    <div id="adminArea"></div>
`;

    // Повертаємо активний чекбокс
    const activeChk = menu.querySelector(`#${activeId}`);
    if (activeChk) activeChk.checked = true;

    // Адмін-панель
    const isSuperAdmin = localStorage.getItem('userRole') === 'super_admin';
    if (isSuperAdmin) {
        const adminArea = menu.querySelector('#adminArea');
        adminArea.innerHTML = `
            <div id="adminHeader" style="cursor:pointer; padding:10px 0; border-top:1px dashed #ccc; margin-top:10px; display:flex; justify-content:space-between; font-size:12px; color:#666;">
                <span>⚙️ Налаштування територій</span>
                <span id="admArr">▼</span>
            </div>
            <div id="adminBody" style="display:none; padding-top:5px;">
                <label class="row" style="margin-bottom:5px;"><input type="checkbox" id="cfg-bus" ${config.showBusiness ? 'checked' : ''}> <span style="margin-left:8px;">Показувати Ділову</span></label>
                <label class="row"><input type="checkbox" id="cfg-vil" ${config.showVillage ? 'checked' : ''}> <span style="margin-left:8px;">Показувати Села</span></label>
            </div>
        `;
        adminArea.querySelector('#adminHeader').onclick = () => {
            const b = adminArea.querySelector('#adminBody');
            b.style.display = b.style.display === 'none' ? 'block' : 'none';
        };
    }

    attachEvents(menu, map, allParcelLayers);
    updateFilterCounts(allParcelLayers);
}
(async function() {
    const { data: allParcels } = await supabase.from('parcels').select('*');
    const currentUserId = localStorage.getItem('userId');
    const userRole = localStorage.getItem('userRole');
    const isAdmin = (userRole === 'admin' || userRole === 'super_admin');

    const isFree = (p) => !p.status || p.status === 'free' || p.status === 'null' || p.status === '';
    const isTaken = (p) => p.status === 'taken' || p.status === 'reserved';

    const myParcels = allParcels.filter(p => String(p.taken_by_id) === String(currentUserId));
    const takenParcels = allParcels.filter(isTaken);

    let config = {
        showVillage: false,
        showBusiness: false
    };

    const catsDef = [
        {id: 'приватн', label: '🏠 Приватні', adminOnly: false},
        {id: 'змішан', label: '🏢+🏠 Змішані', adminOnly: false},
        {id: 'поверхів', label: '🏢 Поверхівки', adminOnly: false},
        {id: 'ділова', label: '💼 Ділова тер.', adminOnly: true, configKey: 'showBusiness'},
        {id: 'села', label: '🚜 Села', adminOnly: true, configKey: 'showVillage'}
    ];

    window.renderParcels = function(filteredData) {
        const filteredIds = filteredData.map(p => p.id);
        if (!window.allParcelLayers) return;
        window.allParcelLayers.forEach(item => {
            const shouldShow = filteredIds.includes(item.id);
            if (shouldShow) {
                if (!window.map.hasLayer(item.layer)) item.layer.addTo(window.map);
                if (item.label && !window.map.hasLayer(item.label)) item.label.addTo(window.map);
            } else {
                window.map.removeLayer(item.layer);
                if (item.label) window.map.removeLayer(item.label);
            }
        });
    };

    if (document.getElementById('dynamic-filter-styles')) document.getElementById('dynamic-filter-styles').remove();
    const styleSheet = document.createElement("style");
    styleSheet.id = 'dynamic-filter-styles';
    styleSheet.innerText = `
        #filterMenu { position: fixed; top: 10px; left: 10px; background: white; padding: 18px; border-radius: 15px; z-index: 10001; box-shadow: 0 10px 40px rgba(0,0,0,0.2); width: 300px; font-family: sans-serif; max-height: 85vh; overflow-y: auto; }
        .filter-section { margin-bottom: 8px; padding: 10px; border-radius: 10px; border: 1px solid #eee; transition: 0.2s; cursor: pointer; }
        .filter-section.active { border-color: #1565C0; background: #f8fbff; opacity: 1; }
        .filter-section.inactive { opacity: 0.6; background: #fafafa; }
        .sub-list { padding-left: 28px; margin-top: 10px; display: none; flex-direction: column; gap: 8px; }
        .filter-section.active .sub-list { display: flex; }
        .row { display: flex; align-items: center; width: 100%; cursor: pointer; font-size: 14px; }
        .count-badge { font-size: 11px; background: #eee; padding: 2px 8px; border-radius: 10px; margin-left: auto; font-weight: bold; color: #666; }
        .filter-section.active .count-badge { background: #1565C0; color: white; }
        .sub-count { font-size: 10px; color: #888; margin-left: 4px; font-weight: normal; }
        #searchBox { width: 100%; padding: 10px; margin-bottom: 15px; border: 2px solid #eef2f7; border-radius: 10px; box-sizing: border-box; outline: none; }
        #searchBox:focus { border-color: #1565C0; }
        .settings-header { margin-top: 15px; padding: 8px; border-top: 1px dashed #ccc; color: #555; font-size: 12px; text-align: center; cursor: pointer; font-weight: bold; }
        #settingsContent { display: none; padding: 10px; background: #fcfcfc; border-radius: 8px; border: 1px solid #ddd; margin-top: 5px; }
    `;
    document.head.appendChild(styleSheet);

    const renderUI = () => {
        if (document.getElementById('filterMenu')) document.getElementById('filterMenu').remove();
        const menu = document.createElement('div');
        menu.id = 'filterMenu';

        const renderSubItems = (prefix, dataList) => {
            return catsDef
                .filter(c => {
                    if (c.configKey && !config[c.configKey]) return false;
                    // Для підкатегорій показуємо лише ті, що реально є в поточному списку (Вільні/На руках тощо)
                    const currentCats = [...new Set(dataList.map(p => (p.category || "").toLowerCase()))];
                    return currentCats.some(cc => cc.includes(c.id));
                })
                .map(c => {
                    const count = dataList.filter(p => (p.category || "").toLowerCase().includes(c.id)).length;
                    return `
                        <label class="row sub-item">
                            <input type="checkbox" class="sub-${prefix}" data-type="${c.id}" checked> 
                            <span style="margin-left:8px;">${c.label}</span>
                            <span class="sub-count">(${count})</span>
                        </label>
                    `;
                }).join('');
        };

        menu.innerHTML = `
            <h4 style="margin:0 0 12px 0;">🔍 Розумний фільтр</h4>
            <input type="text" id="searchBox" placeholder="Пошук за номером..." value="${window.currentSearch || ''}">

            <div class="filter-section active" id="sec-all">
                <label class="row"><input type="checkbox" id="chk-all" checked> <span style="margin-left:10px;">Всі дільниці</span> <span class="count-badge">${allParcels.length}</span></label>
            </div>

            <div class="filter-section inactive" id="sec-mine" style="display: ${myParcels.length > 0 ? 'block' : 'none'};">
                <label class="row"><input type="checkbox" id="chk-mine"> <span style="margin-left:10px;">👤 Мої дільниці</span> <span class="count-badge">${myParcels.length}</span></label>
                <div class="sub-list">${renderSubItems('mine', myParcels)}</div>
            </div>

            <div class="filter-section inactive" id="sec-free">
                <label class="row"><input type="checkbox" id="chk-free"> <span style="margin-left:10px;">✅ Вільні</span> <span class="count-badge">${allParcels.filter(isFree).length}</span></label>
                <div class="sub-list">${renderSubItems('free', allParcels.filter(isFree))}</div>
            </div>

            <div class="filter-section inactive" id="sec-taken" style="display: ${takenParcels.length > 0 ? 'block' : 'none'};">
                <label class="row"><input type="checkbox" id="chk-taken"> <span style="margin-left:10px;">🚩 На руках</span> <span class="count-badge">${takenParcels.length}</span></label>
                <div class="sub-list">${renderSubItems('taken', takenParcels)}</div>
            </div>

            ${isAdmin ? `
                <div class="settings-header" id="toggleSettings">⚙️ Налаштування категорій</div>
                <div id="settingsContent">
                    <label class="row" style="margin-bottom:8px;"><input type="checkbox" id="set-village" ${config.showVillage ? 'checked' : ''}> <span style="margin-left:8px;">🚜 Показувати Села</span></label>
                    <label class="row"><input type="checkbox" id="set-business" ${config.showBusiness ? 'checked' : ''}> <span style="margin-left:8px;">💼 Показувати Ділову</span></label>
                </div>
            ` : ''}
        `;
        document.body.appendChild(menu);
        setupEventListeners();
    };

    const setupEventListeners = () => {
        const apply = () => {
            const searchVal = document.getElementById('searchBox').value.trim().toLowerCase();
            window.currentSearch = searchVal;
            const isAll = document.getElementById('chk-all').checked;
            const isFreeMode = document.getElementById('chk-free').checked;
            const isTakenMode = document.getElementById('chk-taken').checked;
            const isMineMode = document.getElementById('chk-mine').checked;

            const filtered = allParcels.filter(p => {
                const pName = (p.name || "").toString().toLowerCase();
                const pCat = (p.category || "").toLowerCase();
                if (searchVal !== "" && pName !== searchVal) return false;
                if (isAll) return true;

                if (isMineMode && String(p.taken_by_id) === String(currentUserId)) {
                    const activeCats = Array.from(document.querySelectorAll('.sub-mine:checked')).map(el => el.dataset.type);
                    return activeCats.length === 0 || activeCats.some(c => pCat.includes(c));
                }
                if (isFreeMode && isFree(p)) {
                    const activeCats = Array.from(document.querySelectorAll('.sub-free:checked')).map(el => el.dataset.type);
                    return activeCats.length === 0 || activeCats.some(c => pCat.includes(c));
                }
                if (isTakenMode && isTaken(p)) {
                    const activeCats = Array.from(document.querySelectorAll('.sub-taken:checked')).map(el => el.dataset.type);
                    return activeCats.length === 0 || activeCats.some(c => pCat.includes(c));
                }
                return false;
            });

            window.renderParcels(filtered);
            
            ['all', 'free', 'mine', 'taken'].forEach(m => {
                const sec = document.getElementById(`sec-${m}`);
                const chk = document.getElementById(`chk-${m}`);
                if (sec && chk) sec.className = `filter-section ${chk.checked ? 'active' : 'inactive'}`;
            });
        };

        const switchMode = (id) => {
            if (id !== 'chk-all') {
                document.getElementById('searchBox').value = '';
                window.currentSearch = '';
            }

            ['chk-all', 'chk-free', 'chk-taken', 'chk-mine'].forEach(cid => {
                const el = document.getElementById(cid); if(!el) return;
                el.checked = (cid === id);
                if (cid === id && cid !== 'chk-all') {
                    const prefix = cid.split('-')[1];
                    document.querySelectorAll(`.sub-${prefix}`).forEach(sub => sub.checked = true);
                }
            });
            apply();
        };

        const sBox = document.getElementById('searchBox');
        sBox.onfocus = () => switchMode('chk-all');
        sBox.oninput = apply;

        document.getElementById('chk-all').onclick = () => switchMode('chk-all');
        document.getElementById('chk-free').onclick = () => switchMode('chk-free');
        if (document.getElementById('chk-taken')) document.getElementById('chk-taken').onclick = () => switchMode('chk-taken');
        if (document.getElementById('chk-mine')) document.getElementById('chk-mine').onclick = () => switchMode('chk-mine');
        
        document.querySelectorAll('.sub-free, .sub-taken, .sub-mine').forEach(el => el.onchange = apply);

        if (isAdmin) {
            document.getElementById('toggleSettings').onclick = () => {
                const content = document.getElementById('settingsContent');
                content.style.display = content.style.display === 'block' ? 'none' : 'block';
            };

            document.getElementById('set-village').onchange = (e) => {
                config.showVillage = e.target.checked;
                renderUI(); apply();
            };
            document.getElementById('set-business').onchange = (e) => {
                config.showBusiness = e.target.checked;
                renderUI(); apply();
            };
        }
    };

    renderUI();
    apply();
})();
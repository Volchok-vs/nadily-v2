(async function initBulkDistrictAssignerTab() {
    console.log("🚀 Ініціалізація інструменту у новій вкладці...");

    // 1. Отримуємо Supabase клієнт з поточного вікна
    let supabaseClient = window.supabase;
    if (!supabaseClient) {
        try {
            const configModule = await import('./js/config.js');
            supabaseClient = configModule.supabase;
            window.supabase = supabaseClient;
        } catch (e) {
            console.error("❌ Не вдалося знайти екземпляр supabase.");
            alert("Помилка: Не знайдено Supabase на сторінці.");
            return;
        }
    }

    // 2. Отримуємо список районів
    const { data: settingsData, error: distErr } = await supabaseClient
        .from('settings')
        .select('data')
        .eq('id', 'districts')
        .single();

    if (distErr) {
        console.error("❌ Помилка завантаження районів:", distErr);
        alert("Помилка завантаження районів з бази.");
        return;
    }

    const districts = settingsData?.data || [];

    // 3. Відкриваємо нову вкладку
    const newTab = window.open('about:blank', '_blank');
    if (!newTab) {
        alert("Браузер заблокував відкриття нової вкладки. Дозвольте випливаючі вікна для цього сайту.");
        return;
    }

    // Формуємо список районів без ID
    const districtsOptionsHtml = districts.map(d => `<option value="${d.id}">${d.name}</option>`).join('');

    const htmlContent = `
        <!DOCTYPE html>
        <html lang="uk">
        <head>
            <meta charset="UTF-8">
            <title>Прив'язка районів (Місто)</title>
            <style>
                * { box-sizing: border-box; }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    background: #f4f6f9;
                    margin: 0;
                    padding: 24px;
                    color: #333;
                }
                .container {
                    max-width: 1200px;
                    margin: 0 auto;
                    background: white;
                    padding: 24px;
                    border-radius: 12px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
                }
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 2px solid #edf2f7;
                    padding-bottom: 16px;
                    margin-bottom: 20px;
                }
                .header h1 { margin: 0; font-size: 22px; color: #1a202c; }
                .controls-panel {
                    display: flex;
                    gap: 16px;
                    background: #f8fafc;
                    padding: 16px;
                    border-radius: 8px;
                    border: 1px solid #e2e8f0;
                    align-items: flex-end;
                    margin-bottom: 20px;
                    flex-wrap: wrap;
                }
                .control-group { flex: 1; min-width: 250px; }
                .control-group label { display: block; font-weight: 600; margin-bottom: 6px; font-size: 14px; }
                select {
                    width: 100%; padding: 10px; border-radius: 6px;
                    border: 1px solid #cbd5e1; font-size: 15px; outline: none;
                    background: white;
                }
                .btn-group { display: flex; gap: 10px; }
                button {
                    padding: 10px 18px; font-weight: 600; border-radius: 6px;
                    border: none; cursor: pointer; transition: 0.2s; font-size: 14px;
                }
                .btn-secondary { background: #e2e8f0; color: #334155; }
                .btn-secondary:hover { background: #cbd5e1; }
                .btn-primary { background: #10b981; color: white; }
                .btn-primary:hover { background: #059669; }
                .btn-primary:disabled { background: #a7f3d0; cursor: not-allowed; }
                .info-bar { font-size: 14px; color: #64748b; margin-bottom: 12px; }
                .grid {
                    display: grid;
                    grid-template-columns: repeat(10, 1fr);
                    gap: 8px;
                    max-height: 60vh;
                    overflow-y: auto;
                    padding: 12px;
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                }
                .parcel-card {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    background: white;
                    border: 1px solid #cbd5e1;
                    border-radius: 6px;
                    padding: 10px 4px;
                    cursor: pointer;
                    user-select: none;
                    transition: all 0.15s ease;
                }
                .parcel-card:hover { border-color: #94a3b8; }
                .parcel-card.selected {
                    border-color: #10b981;
                    background-color: #ecfdf5;
                }
                .parcel-checkbox { margin-bottom: 4px; cursor: pointer; }
                .parcel-number { font-weight: bold; font-size: 13px; color: #0f172a; }
                .parcel-cat { font-size: 10px; color: #94a3b8; text-transform: uppercase; }
                .empty-msg { grid-column: span 10; text-align: center; padding: 40px; color: #94a3b8; font-size: 16px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🏙️ Прив&#39;язка міських дільниць до району</h1>
                </div>

                <div class="controls-panel">
                    <div class="control-group">
                        <label for="district-select">Оберіть район міста:</label>
                        <select id="district-select">
                            <option value="">-- Оберіть район --</option>
                            ${districtsOptionsHtml}
                        </select>
                    </div>
                    <div class="btn-group">
                        <button class="btn-secondary" id="select-all">Обрати всі</button>
                        <button class="btn-secondary" id="deselect-all">Скинути</button>
                        <button class="btn-primary" id="save-btn">Зберегти прив&#39;язку</button>
                    </div>
                </div>

                <div class="info-bar">
                    Вільних міських дільниць: <b id="total-count">0</b> | Обрано: <b id="selected-count">0</b>
                </div>

                <div class="grid" id="parcels-grid">
                    <div class="empty-msg">Завантаження...</div>
                </div>
            </div>

            <script>
                const grid = document.getElementById('parcels-grid');
                const selectedCountEl = document.getElementById('selected-count');
                const totalCountEl = document.getElementById('total-count');
                const saveBtn = document.getElementById('save-btn');

                function updateCount() {
                    const checked = document.querySelectorAll('.parcel-checkbox:checked');
                    selectedCountEl.textContent = checked.length;
                }

                async function loadParcels() {
                    grid.innerHTML = '<div class="empty-msg">Завантаження дільниць...</div>';
                    selectedCountEl.textContent = '0';

                    try {
                        const supabase = window.opener.supabase;
                        const { data: unassigned, error } = await supabase
                            .from('parcels')
                            .select('id, name, category, district_id')
                            .is('district_id', null);

                        if (error) throw error;

                        const cityParcels = (unassigned || []).filter(p => {
                            const cat = String(p.category || '').toLowerCase().trim();
                            const name = String(p.name || '').toLowerCase().trim();

                            if (cat === 'село' || cat === 'village' || cat.includes('сел')) return false;
                            if (name.startsWith('с.') || name.includes('село')) return false;

                            return true;
                        });

                        cityParcels.sort((a, b) => {
                            const numA = parseInt(String(a.name).replace(/\\D/g, '')) || 0;
                            const numB = parseInt(String(b.name).replace(/\\D/g, '')) || 0;
                            return numA - numB;
                        });

                        totalCountEl.textContent = cityParcels.length;

                        if (cityParcels.length === 0) {
                            grid.innerHTML = '<div class="empty-msg">🎉 Усі міські дільниці вже мають прив&#39;язаний район!</div>';
                            return;
                        }

                        grid.innerHTML = cityParcels.map(p => \`
                            <label class="parcel-card">
                                <input type="checkbox" class="parcel-checkbox" value="\${p.id}">
                                <span class="parcel-number">№\${p.name}</span>
                                <span class="parcel-cat">\${p.category || 'місто'}</span>
                            </label>
                        \`).join('');

                        document.querySelectorAll('.parcel-checkbox').forEach(cb => {
                            cb.addEventListener('change', (e) => {
                                const card = e.target.closest('.parcel-card');
                                if (e.target.checked) {
                                    card.classList.add('selected');
                                } else {
                                    card.classList.remove('selected');
                                }
                                updateCount();
                            });
                        });

                    } catch (e) {
                        grid.innerHTML = '<div class="empty-msg" style="color:red;">Помилка завантаження даних: ' + e.message + '</div>';
                    }
                }

                document.getElementById('select-all').onclick = () => {
                    document.querySelectorAll('.parcel-checkbox').forEach(cb => {
                        cb.checked = true;
                        cb.closest('.parcel-card').classList.add('selected');
                    });
                    updateCount();
                };

                document.getElementById('deselect-all').onclick = () => {
                    document.querySelectorAll('.parcel-checkbox').forEach(cb => {
                        cb.checked = false;
                        cb.closest('.parcel-card').classList.remove('selected');
                    });
                    updateCount();
                };

                saveBtn.onclick = async () => {
                    const districtSelect = document.getElementById('district-select');
                    const districtId = districtSelect.value;

                    if (!districtId) {
                        alert("Будь ласка, оберіть район зі списку!");
                        return;
                    }

                    const selectedCbs = document.querySelectorAll('.parcel-checkbox:checked');
                    const parcelIds = Array.from(selectedCbs).map(cb => Number(cb.value));

                    if (parcelIds.length === 0) {
                        alert("Не обрано жодної дільниці!");
                        return;
                    }

                    const districtName = districtSelect.options[districtSelect.selectedIndex].text;
                    if (!confirm("Прив'язати обрані дільниці (" + parcelIds.length + " шт.) до району \\"" + districtName + "\\"?")) {
                        return;
                    }

                    saveBtn.disabled = true;
                    saveBtn.textContent = "Збереження...";

                    try {
                        const supabase = window.opener.supabase;
                        const { error } = await supabase
                            .from('parcels')
                            .update({ district_id: Number(districtId) })
                            .in('id', parcelIds);

                        if (error) {
                            alert("Помилка збереження: " + error.message);
                        } else {
                            if (window.opener && typeof window.opener.loadParcelInfo === 'function') {
                                window.opener.loadParcelInfo();
                            }
                            await loadParcels();
                        }
                    } catch (e) {
                        alert("Помилка виконання запиту: " + e.message);
                    } finally {
                        saveBtn.disabled = false;
                        saveBtn.textContent = "Зберегти прив'язку";
                    }
                };

                loadParcels();
            </script>
        </body>
        </html>
    `;

    newTab.document.open();
    newTab.document.write(htmlContent);
    newTab.document.close();
})();
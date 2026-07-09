(async () => {
    console.log("🛠️ Запуск інтерфейсу генерації звітів (без знаку № для сіл)...");

    const MODAL_ID = 'report-period-modal';
    const existingModal = document.getElementById(MODAL_ID);
    if (existingModal) existingModal.remove();

    // 1. СТВОРЕННЯ СТИЛІВ ДЛЯ МОДАЛКИ
    const styles = document.createElement('style');
    styles.innerHTML = `
        #${MODAL_ID} {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px);
            display: flex; align-items: center; justify-content: center; z-index: 999999;
            font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        }
        .${MODAL_ID}-content {
            background: white; padding: 25px; border-radius: 12px; width: 420px;
            box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
            animation: reportModalFade 0.2s ease-out;
        }
        .${MODAL_ID}-header {
            margin-top: 0; margin-bottom: 15px; color: #1e293b; font-size: 20px; font-weight: 600;
            display: flex; justify-content: space-between; align-items: center;
        }
        .${MODAL_ID}-close {
            background: none; border: none; font-size: 24px; color: #94a3b8; cursor: pointer;
        }
        .${MODAL_ID}-close:hover { color: #64748b; }
        .report-opt-group {
            display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px;
        }
        .report-opt-btn {
            display: flex; align-items: center; gap: 12px; padding: 12px;
            border: 2px solid #e2e8f0; border-radius: 8px; background: #f8fafc;
            cursor: pointer; text-align: left; transition: all 0.2s;
        }
        .report-opt-btn:hover { border-color: #cbd5e1; background: #f1f5f9; }
        .report-opt-btn.active { border-color: #3b82f6; background: #eff6ff; }
        .report-opt-btn input { pointer-events: none; margin: 0; transform: scale(1.2); }
        .report-opt-details { display: flex; flex-direction: column; }
        .report-opt-title { font-weight: 600; color: #334155; font-size: 14px; }
        .report-opt-desc { font-size: 12px; color: #64748b; margin-top: 2px; }
        .report-custom-dates {
            display: none; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px;
            padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;
        }
        .report-date-field { display: flex; flex-direction: column; gap: 4px; }
        .report-date-field label { font-size: 12px; font-weight: 600; color: #64748b; }
        .report-date-field input { padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 13px; color: #334155; }
        .report-submit-btn {
            width: 100%; padding: 12px; background: #3b82f6; color: white; border: none;
            border-radius: 8px; font-weight: 600; font-size: 15px; cursor: pointer; transition: background 0.2s;
        }
        .report-submit-btn:hover { background: #2563eb; }
        @keyframes reportModalFade { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
    `;
    document.head.appendChild(styles);

    // 2. СТВОРЕННЯ HTML МОДАЛКИ
    const modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.innerHTML = `
        <div class="${MODAL_ID}-content">
            <div class="${MODAL_ID}-header">
                <span>📋 Формування звіту дільниць</span>
                <button class="${MODAL_ID}-close" id="${MODAL_ID}-close-btn">&times;</button>
            </div>
            
            <div class="report-opt-group">
                <button class="report-opt-btn active" data-period="week">
                    <input type="radio" name="report_period" value="week" checked>
                    <div class="report-opt-details">
                        <span class="report-opt-title">За останній тиждень</span>
                        <span class="report-opt-desc">Аналіз активності за останні 7 днів</span>
                    </div>
                </button>
                
                <button class="report-opt-btn" data-period="month">
                    <input type="radio" name="report_period" value="month">
                    <div class="report-opt-details">
                        <span class="report-opt-title">За останній місяць</span>
                        <span class="report-opt-desc">Аналіз активності за останні 30 днів</span>
                    </div>
                </button>
                
                <button class="report-opt-btn" data-period="custom">
                    <input type="radio" name="report_period" value="custom">
                    <div class="report-opt-details">
                        <span class="report-opt-title">Власний період</span>
                        <span class="report-opt-desc">Вибір точних меж дат вручну</span>
                    </div>
                </button>
            </div>
            
            <div class="report-custom-dates" id="${MODAL_ID}-custom-fields">
                <div class="report-date-field">
                    <label>Дата з:</label>
                    <input type="date" id="${MODAL_ID}-date-start">
                </div>
                <div class="report-date-field">
                    <label>Дата по:</label>
                    <input type="date" id="${MODAL_ID}-date-end">
                </div>
            </div>
            
            <button class="report-submit-btn" id="${MODAL_ID}-submit">Згенерувати звіт</button>
        </div>
    `;
    document.body.appendChild(modal);

    const optButtons = modal.querySelectorAll('.report-opt-btn');
    const customFields = document.getElementById(`${MODAL_ID}-custom-fields`);
    const dateStartInput = document.getElementById(`${MODAL_ID}-date-start`);
    const dateEndInput = document.getElementById(`${MODAL_ID}-date-end`);

    const todayStr = new Date().toISOString().split('T')[0];
    dateStartInput.value = todayStr;
    dateEndInput.value = todayStr;

    optButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            optButtons.forEach(b => b.classList.remove('active'));
            optButtons.forEach(b => b.querySelector('input').checked = false);
            
            btn.classList.add('active');
            btn.querySelector('input').checked = true;
            
            if(btn.dataset.period === 'custom') {
                customFields.style.display = 'grid';
            } else {
                customFields.style.display = 'none';
            }
        });
    });

    const closeModal = () => modal.remove();
    document.getElementById(`${MODAL_ID}-close-btn`).onclick = closeModal;
    modal.onclick = (e) => { if(e.target === modal) closeModal(); };

    document.getElementById(`${MODAL_ID}-submit`).onclick = async () => {
        const selectedPeriod = modal.querySelector('input[name="report_period"]:checked').value;
        let startDate, endDate;
        const now = new Date();

        if (selectedPeriod === 'week') {
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            endDate = now;
        } else if (selectedPeriod === 'month') {
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            endDate = now;
        } else {
            if (!dateStartInput.value || !dateEndInput.value) {
                alert("Будь ласка, оберіть обидві дати!");
                return;
            }
            startDate = new Date(dateStartInput.value);
            endDate = new Date(dateEndInput.value);
            endDate.setHours(23, 59, 59, 999);
        }

        closeModal();
        await generateReportForPeriod(startDate, endDate);
    };

    // 5. ОСНОВНА ФУНКЦІЯ ГЕНЕРАЦІЇ ЗВІТУ
    async function generateReportForPeriod(startDate, endDate) {
        console.log(`📊 Отримання даних з ${startDate.toLocaleDateString()} по ${endDate.toLocaleDateString()}...`);
        
        const startIsoStr = startDate.toISOString().split('T')[0];

        const formatDateShort = (d) => {
            if (!d) return '<span class="text-muted">—</span>';
            const dateObj = new Date(d);
            if (isNaN(dateObj.getTime())) return d;
            return dateObj.getDate().toString().padStart(2, '0') + '.' + 
                   (dateObj.getMonth() + 1).toString().padStart(2, '0') + '.' + 
                   dateObj.getFullYear();
        };

        const dateTitle = `з ${formatDateShort(startDate)} по ${formatDateShort(endDate)}`;

        try {
            // КРОК 1: Завантажуємо всі дільниці (додали поле 'category' про всяк випадок)
            const { data: allParcels, error: allParcelsError } = await supabase
                .from('parcels')
                .select('id, name, status, taken_by, taken_at, category');

            if (allParcelsError) throw allParcelsError;

            // Будуємо карти відповідності (ID -> Назва) та (ID -> Категорія)
            const parcelMap = {};
            const categoryMap = {};
            
            allParcels.forEach(p => {
                parcelMap[p.id] = p.name;
                categoryMap[p.id] = p.category || '';
            });

            // КРОК 2: Витягуємо логи з архіву (territory_logs)
            const { data: logs, error: logsError } = await supabase
                .from('territory_logs')
                .select('*')
                .or(`taken_at.gte.${startIsoStr},returned_at.gte.${startIsoStr}`);

            if (logsError) throw logsError;

            const reportData = [];

            if (logs && logs.length > 0) {
                logs.forEach(log => {
                    const tDate = log.taken_at ? new Date(log.taken_at) : null;
                    const rDate = log.returned_at ? new Date(log.returned_at) : null;

                    const isTakenInPeriod = tDate && tDate >= startDate && tDate <= endDate;
                    const isReturnedInPeriod = rDate && rDate >= startDate && rDate <= endDate;

                    if (isTakenInPeriod || isReturnedInPeriod) {
                        const clearParcelName = parcelMap[log.parcel_id] || log.parcel_name || `ID: ${log.parcel_id}`;

                        reportData.push({
                            parcelId: log.parcel_id,
                            parcelName: clearParcelName,
                            publisherName: log.publisher_name && log.publisher_name !== '--' ? log.publisher_name : '--',
                            takenAt: log.taken_at,
                            returnedAt: log.returned_at,
                            campaignName: log.campaign_name || null,
                            isCurrent: false
                        });
                    }
                });
            }

            // КРОК 3: Фільтруємо активні дільниці на руках
            const activeParcels = allParcels.filter(p => p.status === 'taken');

            if (activeParcels && activeParcels.length > 0) {
                activeParcels.forEach(parcel => {
                    const pTakenDate = parcel.taken_at ? new Date(parcel.taken_at) : null;

                    if (pTakenDate && pTakenDate >= startDate && pTakenDate <= endDate) {
                        const isDuplicate = reportData.some(r => r.parcelId === parcel.id && r.takenAt?.split('T')[0] === parcel.taken_at?.split('T')[0] && r.returnedAt === null);
                        
                        if (!isDuplicate) {
                            reportData.push({
                                parcelId: parcel.id,
                                parcelName: parcel.name,
                                publisherName: parcel.taken_by || '--',
                                takenAt: parcel.taken_at ? parcel.taken_at.split('T')[0] : null,
                                returnedAt: null,
                                campaignName: null,
                                isCurrent: true
                            });
                        }
                    }
                });
            }

            if (reportData.length === 0) {
                alert(`За період ${dateTitle} активності руху дільниць не виявлено.`);
                return;
            }

            // Сортування за датою
            reportData.sort((a, b) => new Date(b.takenAt || 0) - new Date(a.takenAt || 0));

            // ФОРМУВАННЯ СТРОК ТАБЛИЦІ
            let tableRowsHtml = "";
            reportData.forEach(row => {
                const statusBadge = row.isCurrent 
                    ? '<span class="badge badge-busy">На руках 🏃‍♂️</span>' 
                    : '<span class="badge badge-free">Опрацьовано ✅</span>';
                
                const dateOutStr = row.returnedAt ? formatDateShort(row.returnedAt) : '<span class="text-muted">на руках</span>';
                
                let campaignColumn = '<span class="text-muted">—</span>';
                if (row.campaignName) {
                    campaignColumn = `<div class="campaign-box"><span class="checkbox-icon">☑️</span><span>${row.campaignName}</span></div>`;
                }

                // --- РОЗУМНЕ КОРЕГУВАННЯ ЗНАКУ № ДЛЯ СІЛ ---
                const pName = row.parcelName.toString().trim();
                const pCategory = (categoryMap[row.parcelId] || '').toString().toLowerCase();
                
                let displayName = "";
                
                // Перевіряємо за двома ознаками: текстом або категорією в БД
                if (pName.toLowerCase().startsWith('с.') || pName.toLowerCase().includes('село') || pCategory.includes('село') || pCategory.includes('village')) {
                    displayName = pName; // Виводимо чисту назву, наприклад "с. Очеретня"
                } else {
                    displayName = `№ ${pName}`; // Для звичайних міських номерів додаємо №
                }

                tableRowsHtml += `
                    <tr>
                        <td><strong>${displayName}</strong></td>
                        <td>${row.publisherName}</td>
                        <td>${statusBadge}</td>
                        <td>${formatDateShort(row.takenAt)}</td>
                        <td>${dateOutStr}</td>
                        <td>${campaignColumn}</td>
                    </tr>
                `;
            });

            // 6. ФІНАЛЬНИЙ HTML СТОРІНКИ ЗВІТУ
            let reportHtml = `
<!DOCTYPE html>
<html lang="uk">
<head>
    <meta charset="UTF-8">
    <title>Звіт про опрацювання дільниць (${dateTitle})</title>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #f4f7f6; color: #333; padding: 30px; margin: 0; }
        .report-container { max-width: 1100px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
        h1 { color: #2c3e50; margin-top: 0; font-size: 24px; border-bottom: 2px solid #ecf0f1; padding-bottom: 15px; }
        .subtitle { color: #7f8c8d; font-size: 14px; margin-bottom: 25px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background-color: #2c3e50; color: white; text-align: left; padding: 12px; font-size: 14px; text-transform: uppercase; }
        td { padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; vertical-align: middle; }
        tr:hover { background-color: #f8fafc; }
        .badge { display: inline-block; padding: 5px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; text-transform: uppercase; }
        .badge-busy { background-color: #fef3c7; color: #d97706; border: 1px solid #fcd34d; }
        .badge-free { background-color: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
        .campaign-box { display: flex; align-items: center; gap: 6px; font-weight: 500; color: #1e3a8a; background: #eff6ff; padding: 4px 8px; border-radius: 4px; border: 1px solid #bfdbfe; font-size: 13px; max-width: fit-content; }
        .checkbox-icon { color: #2563eb; font-size: 16px; font-weight: bold; }
        .text-muted { color: #94a3b8; font-style: italic; }
        .btn-print { background: #10b981; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; float: right; transition: background 0.2s; }
        .btn-print:hover { background: #059669; }
        @media print { .btn-print { display: none; } body { padding: 0; background: white; } .report-container { box-shadow: none; padding: 0; } }
    </style>
</head>
<body>
    <div class="report-container">
        <button class="btn-print" onclick="window.print()">🖨️ Друк / Зберегти в PDF</button>
        <h1>📋 Звіт про опрацювання дільниць</h1>
        <div class="subtitle">Період звітності: <strong>${dateTitle}</strong> | Сгенеровано: ${new Date().toLocaleString('uk-UA')}</div>
        
        <table>
            <thead>
                <tr>
                    <th>Дільниця</th>
                    <th>Вісник</th>
                    <th>Поточний стан</th>
                    <th>Дата взяття</th>
                    <th>Дата здачі (опрацювання)</th>
                    <th>Кампанія</th>
                </tr>
            </thead>
            <tbody>
                ${tableRowsHtml}
            </tbody>
        </table>
    </div>
</body>
</html>
            `;

            const reportWindow = window.open();
            if (reportWindow) {
                reportWindow.document.write(reportHtml);
                reportWindow.document.close();
            } else {
                alert("Браузер заблокував спливаюче вікно. Будь ласка, дозвольте спливаючі вікна для цього сайту.");
            }

        } catch (err) {
            console.error("❌ Помилка зведення даних:", err);
            alert("Сталася помилка. Перевірте консоль розробника.");
        }
    }
})();
(async () => {
    console.log("🛠️ Запуск інтерфейсу генерації аналітичних звітів (Мобільне завантаження + А4)...");

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
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        }
        .${MODAL_ID}-content {
            background: white; padding: 25px; border-radius: 12px; width: 440px; max-width: 90%;
            box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
            animation: reportModalFade 0.2s ease-out;
        }
        .${MODAL_ID}-header {
            margin-top: 0; margin-bottom: 15px; color: #1e293b; font-size: 19px; font-weight: 600;
            display: flex; justify-content: space-between; align-items: center;
        }
        .${MODAL_ID}-close {
            background: none; border: none; font-size: 24px; color: #94a3b8; cursor: pointer;
        }
        .${MODAL_ID}-close:hover { color: #64748b; }
        .report-opt-group {
            display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px;
        }
        .report-opt-btn {
            display: flex; align-items: center; gap: 12px; padding: 10px 12px;
            border: 2px solid #e2e8f0; border-radius: 8px; background: #f8fafc;
            cursor: pointer; text-align: left; transition: all 0.2s;
        }
        .report-opt-btn:hover { border-color: #cbd5e1; background: #f1f5f9; }
        .report-opt-btn.active { border-color: #3b82f6; background: #eff6ff; }
        .report-opt-btn input { pointer-events: none; margin: 0; transform: scale(1.1); }
        .report-opt-details { display: flex; flex-direction: column; }
        .report-opt-title { font-weight: 600; color: #334155; font-size: 13.5px; }
        .report-opt-desc { font-size: 11.5px; color: #64748b; margin-top: 1px; }
        
        .report-custom-dates, .report-year-select-container {
            display: none; margin-bottom: 20px; padding: 12px; 
            background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;
        }
        .report-custom-dates { grid-template-columns: 1fr 1fr; gap: 10px; }
        .report-date-field { display: flex; flex-direction: column; gap: 4px; }
        .report-date-field label { font-size: 12px; font-weight: 600; color: #64748b; }
        .report-date-field input, .report-date-field select { 
            padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px; 
            font-size: 13px; color: #334155; background: white; width: 100%; box-sizing: border-box;
        }
        
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
                <span>📊 Аналітичний звіт про опрацювання</span>
                <button class="${MODAL_ID}-close" id="${MODAL_ID}-close-btn">&times;</button>
            </div>
            
            <div class="report-opt-group">
                <button class="report-opt-btn" data-period="week">
                    <input type="radio" name="report_period" value="week">
                    <div class="report-opt-details">
                        <span class="report-opt-title">За останній тиждень</span>
                        <span class="report-opt-desc">Аналіз за останні 7 днів</span>
                    </div>
                </button>
                
                <button class="report-opt-btn active" data-period="month">
                    <input type="radio" name="report_period" value="month" checked>
                    <div class="report-opt-details">
                        <span class="report-opt-title">За останній місяць</span>
                        <span class="report-opt-desc">Аналіз за останні 30 днів</span>
                    </div>
                </button>

                <button class="report-opt-btn" data-period="theocratic-year">
                    <input type="radio" name="report_period" value="theocratic-year">
                    <div class="report-opt-details">
                        <span class="report-opt-title">Теократичний рік</span>
                        <span class="report-opt-desc">Звіт за обраний службовий рік (з 1 вересня)</span>
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

            <div class="report-year-select-container" id="${MODAL_ID}-year-fields">
                <div class="report-date-field">
                    <label>Оберіть службовий рік:</label>
                    <select id="${MODAL_ID}-theocratic-year-select">
                        <option value="current" selected>Поточний теократичний рік</option>
                        <option value="last">Минулий теократичний рік</option>
                    </select>
                </div>
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
    const yearFields = document.getElementById(`${MODAL_ID}-year-fields`);
    const yearSelect = document.getElementById(`${MODAL_ID}-theocratic-year-select`);
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
            
            if (btn.dataset.period === 'custom') {
                customFields.style.display = 'grid';
                yearFields.style.display = 'none';
            } else if (btn.dataset.period === 'theocratic-year') {
                customFields.style.display = 'none';
                yearFields.style.display = 'block';
            } else {
                customFields.style.display = 'none';
                yearFields.style.display = 'none';
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
        } else if (selectedPeriod === 'theocratic-year') {
            const chosenYearType = yearSelect.value;
            const currentYear = now.getFullYear();
            const currentStartYear = now.getMonth() >= 8 ? currentYear : currentYear - 1;

            if (chosenYearType === 'current') {
                startDate = new Date(currentStartYear, 8, 1, 0, 0, 0);
                endDate = new Date(currentStartYear + 1, 7, 31, 23, 59, 59);
            } else {
                startDate = new Date(currentStartYear - 1, 8, 1, 0, 0, 0);
                endDate = new Date(currentStartYear, 7, 31, 23, 59, 59);
            }
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
        await generateAggregatedReport(startDate, endDate);
    };

    // 3. ФУНКЦІЯ АГРЕГАЦІЇ ДАНИХ ТА СТВОРЕННЯ ЗВІТУ
    async function generateAggregatedReport(startDate, endDate) {
        console.log(`📊 Завантаження даних з бази для періоду з ${startDate.toLocaleDateString()} по ${endDate.toLocaleDateString()}...`);
        const startIsoStr = startDate.toISOString().split('T')[0];
        const now = new Date();

        try {
            const { data: allParcels, error: allParcelsError } = await supabase
                .from('parcels')
                .select('id, name, status, category, last_processed'); 

            if (allParcelsError) throw allParcelsError;

            const { data: logs, error: logsError } = await supabase
                .from('territory_logs')
                .select('parcel_id, returned_at, campaign_name')
                .or(`returned_at.gte.${startIsoStr}`);

            if (logsError) throw logsError;

            const report = {
                "Місто Липовець": {
                    totalTerritories: 0, processedInPeriod: 0, currentlyInProgress: 0,
                    idle_6_8_months: 0, idle_8_10_months: 0, idle_10_12_months: 0, idle_over_12_months: 0,
                    repeatedProcessing: 0, campaigns: {}
                },
                "Села (разом)": {
                    totalTerritories: 0, processedInPeriod: 0, currentlyInProgress: 0,
                    idle_6_8_months: 0, idle_8_10_months: 0, idle_10_12_months: 0, idle_over_12_months: 0,
                    repeatedProcessing: 0, campaigns: {}
                }
            };
            
            const uniqueVillages = new Set();

            allParcels.forEach(parcel => {
                const pName = (parcel.name || '').toString().trim();
                const pCategory = (parcel.category || '').toString().toLowerCase();

                let groupKey = "Місто Липовець"; 

                if (pName.toLowerCase().startsWith('с.') || pName.toLowerCase().includes('село') || pCategory.includes('село') || pCategory.includes('village')) {
                    groupKey = "Села (разом)";
                    let cleanVillageName = pName.replace(/^[сС]\.\s*/, '').trim();
                    if(cleanVillageName) uniqueVillages.add(cleanVillageName);
                }

                const g = report[groupKey];
                g.totalTerritories += 1;

                if (parcel.status === 'taken' || parcel.status === 'в опрацюванні' || parcel.status === 'в роботі') {
                    g.currentlyInProgress += 1;
                }

                const parcelLogsInPeriod = (logs || []).filter(log => 
                    log.parcel_id === parcel.id && log.returned_at && 
                    new Date(log.returned_at) >= startDate && new Date(log.returned_at) <= endDate
                );

                if (parcelLogsInPeriod.length > 0) {
                    g.processedInPeriod += 1;
                    if (parcelLogsInPeriod.length > 1) g.repeatedProcessing += 1;
                    
                    parcelLogsInPeriod.forEach(log => {
                        const campaignName = log.campaign_name || 'Без кампанії';
                        g.campaigns[campaignName] = (g.campaigns[campaignName] || 0) + 1;
                    });
                }

                if ((parcel.status === 'free' || parcel.status === 'вільна' || parcel.status === 'доступна') && parcel.last_processed) {
                    const lastProcessed = new Date(parcel.last_processed);
                    const diffMonths = Math.floor(Math.abs(now - lastProcessed) / (1000 * 60 * 60 * 24 * 30.4375));

                    if (diffMonths >= 6) {
                        if (diffMonths >= 6 && diffMonths < 8) g.idle_6_8_months += 1;
                        else if (diffMonths >= 8 && diffMonths < 10) g.idle_8_10_months += 1;
                        else if (diffMonths >= 10 && diffMonths < 12) g.idle_10_12_months += 1;
                        else if (diffMonths >= 12) g.idle_over_12_months += 1;
                    }
                }
            });

            const formatDateShort = (d) => {
                const dateObj = new Date(d);
                return dateObj.getDate().toString().padStart(2, '0') + '.' + 
                       (dateObj.getMonth() + 1).toString().padStart(2, '0') + '.' + 
                       dateObj.getFullYear();
            };

            const dateTitle = `з ${formatDateShort(startDate)} по ${formatDateShort(endDate)}`;
            const fileNameDate = startIsoStr + '_to_' + endDate.toISOString().split('T')[0];

            let sectionsHtml = "";
            for (const [key, info] of Object.entries(report)) {
                
                let metaRows = "";
                if (key === "Села (разом)") {
                    metaRows = `<div class="data-row italic">Всього унікальних сіл в базі: <span><b>${uniqueVillages.size}</b></span></div>`;
                }

                sectionsHtml += `
                    <div class="report-card">
                        <div class="card-title">${key}</div>
                        
                        ${metaRows}
                        <div class="data-row">Загалом територій/ділянок: <span><b>${info.totalTerritories}</b></span></div>
                        <div class="data-row highlight">Опрацьовано за період: <span><b>${info.processedInPeriod}</b></span></div>
                        <div class="data-row sub-row text-muted">з них повторно: <span>${info.repeatedProcessing}</span></div>
                        <div class="data-row">Зараз в опрацюванні: <span><b>${info.currentlyInProgress}</b></span></div>
                        
                        <div class="group-heading">Вільні території без обробки понад 6 міс.</div>
                        <div class="data-row sub-row">від 6 до 8 місяців: <span><b>${info.idle_6_8_months}</b></span></div>
                        <div class="data-row sub-row">від 8 до 10 місяців: <span><b>${info.idle_8_10_months}</b></span></div>
                        <div class="data-row sub-row">від 10 до 12 місяців: <span><b>${info.idle_10_12_months}</b></span></div>
                        <div class="data-row sub-row alert-text">більше 12 місяців (понад рік): <span><b>${info.idle_over_12_months}</b></span></div>

                        <div class="group-heading">Задіяні кампанії</div>
                `;

                const campaignKeys = Object.keys(info.campaigns);
                if (campaignKeys.length === 0) {
                    sectionsHtml += `<div class="data-row sub-row text-muted italic">Кампаній не зафіксовано</div>`;
                } else {
                    campaignKeys.forEach(camp => {
                        sectionsHtml += `<div class="data-row sub-row">"${camp}": <span>опрацьовано <b>${info.campaigns[camp]}</b></span></div>`;
                    });
                }
                sectionsHtml += `</div>`;
            }

            let reportHtml = `
<!DOCTYPE html>
<html lang="uk">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Сумарний звіт про опрацювання територій</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.4; padding: 75px 15px 30px 15px; color: #1e293b; background: #f8fafc; font-size: 13.5px; 
        }
        .container { max-width: 640px; margin: 0 auto; width: 100%; box-sizing: border-box; }
        .header { text-align: center; font-weight: 700; font-size: 20px; color: #0f172a; margin-bottom: 4px; letter-spacing: -0.5px; }
        .subheader { text-align: center; font-size: 12px; color: #64748b; margin-bottom: 20px; line-height: 1.5; }
        
        .report-card { 
            background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; 
            padding: 16px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);
            box-sizing: border-box;
        }
        .card-title { font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 12px; border-bottom: 2px solid #f1f5f9; padding-bottom: 6px; }
        
        .data-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #f1f5f9; color: #334155; }
        .data-row:last-child { border-bottom: none; }
        .data-row span { color: #0f172a; text-align: right; margin-left: 10px; }
        .data-row.highlight { background: #f8fafc; font-weight: 600; padding-left: 6px; padding-right: 6px; border-radius: 4px; }
        
        .sub-row { padding-left: 16px; font-size: 13px; color: #475569; }
        .group-heading { font-weight: 600; color: #1e293b; font-size: 13px; margin-top: 14px; margin-bottom: 4px; padding-bottom: 2px; }
        
        .text-muted { color: #94a3b8 !important; }
        .italic { font-style: italic; }
        .alert-text span { color: #b91c1c !important; font-weight: bold; }
        
        /* Блок управління кнопками */
        .action-bar {
            position: fixed; top: 0; left: 0; right: 0; background: rgba(248, 250, 252, 0.9);
            backdrop-filter: blur(8px); border-bottom: 1px solid #e2e8f0;
            padding: 12px 20px; display: flex; justify-content: flex-end; gap: 10px; z-index: 99999;
        }
        .btn { 
            padding: 9px 15px; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; 
            font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.05); transition: all 0.15s;
        }
        .btn-print { background: #2563eb; color: #fff; }
        .btn-print:hover { background: #1d4ed8; }
        .btn-download { background: #10b981; color: #fff; }
        .btn-download:hover { background: #059669; }
        
        /* Мобільна адаптація */
        @media screen and (max-width: 600px) {
            body { padding: 20px 10px 85px 10px; }
            .header { font-size: 18px; }
            .action-bar { 
                top: auto; bottom: 0; border-top: 1px solid #e2e8f0; border-bottom: none;
                padding: 12px; background: white; justify-content: space-between;
            }
            .btn { flex: 1; text-align: center; padding: 12px 5px; font-size: 13.5px; }
        }

        /* Оптимізація під друк А4 на 1 сторінку */
        @media print { 
            @page { size: A4 portrait; margin: 12mm 15mm 12mm 15mm; }
            .action-bar { display: none !important; } 
            body { padding: 0; background: #fff; color: #000; font-size: 12px; line-height: 1.35; } 
            .container { max-width: 100%; width: 100%; }
            .header { font-size: 18px; margin-bottom: 2px; }
            .subheader { font-size: 11px; margin-bottom: 15px; }
            .report-card { border: none; box-shadow: none; padding: 0; margin-bottom: 20px; page-break-inside: avoid; }
            .card-title { border-bottom: 1.5px solid #000; font-size: 14px; margin-bottom: 8px; padding-bottom: 4px; }
            .data-row { border-bottom: 1px solid #e2e8f0; padding: 4px 0; }
            .data-row.highlight { background: none; padding-left: 0; padding-right: 0; }
            .group-heading { margin-top: 10px; margin-bottom: 2px; font-size: 12px; }
            .sub-row { padding-left: 14px; font-size: 11.5px; }
        }
    </style>
    <script>
        function downloadReportFile() {
            // Клонуємо поточний документ без самої панелі кнопок, щоб збережений файл залишався чистим бланком
            const docClone = document.documentElement.cloneNode(true);
            const bar = docClone.querySelector('.action-bar');
            if (bar) bar.remove();
            
            const htmlContent = '<!DOCTYPE html>\\n' + docClone.outerHTML;
            const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'report_${fileNameDate}.html';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    </script>
</head>
<body>
    <div class="action-bar">
        <button class="btn btn-print" onclick="window.print()">🖨️ Друк / PDF</button>
        <button class="btn btn-download" onclick="downloadReportFile()">💾 Завантажити файл</button>
    </div>
    
    <div class="container">
        <div class="header">Звіт про опрацювання територій</div>
        <div class="subheader">Період звіту: ${dateTitle}<br>Згенеровано: ${new Date().toLocaleString('uk-UA')}</div>
        ${sectionsHtml}
    </div>
</body>
</html>
            `;

            const reportWindow = window.open();
            if (reportWindow) {
                reportWindow.document.write(reportHtml);
                reportWindow.document.close();
            } else {
                alert("Браузер заблокував спливаюче вікно. Дозвольте відображення вікон у рядку адреси.");
            }

        } catch (err) {
            console.error("❌ Помилка обробки аналітики:", err);
            alert("Сталася помилка при зверненні до Supabase або обробці масивів.");
        }
    }
})();
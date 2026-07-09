/**
 * Модуль генерації аналітичних звітів 
 * (Фікс обрізання лівого краю при збереженні в PDF)
 */

function initAnalyticsModule() {
    const btnGenerate = document.getElementById('btn-trigger-embedded-report');

    if (!btnGenerate) {
        console.warn('Кнопку звіту #btn-trigger-embedded-report не знайдено на сторінці.');
        return;
    }

    btnGenerate.removeAttribute('onclick');

    btnGenerate.addEventListener('click', (e) => {
        e.preventDefault();
        runAnalyticsModalFlow();
    });
}

/**
 * Основна функція інтерфейсу звіту
 */
async function runAnalyticsModalFlow() {
    console.log("🛠️ Запуск інтерфейсу генерації...");

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
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
                <span>📊 Параметри звіту</span>
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
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };

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
        console.log(`📊 Завантаження даних для періоду z ${startDate.toLocaleDateString()} по ${endDate.toLocaleDateString()}...`);
        const startIsoStr = startDate.toISOString().split('T')[0];
        const now = new Date();

        try {
            if (typeof supabase === 'undefined') {
                throw new Error("Об'єкт 'supabase' не знайдено у глобальній видимості сторінки.");
            }

            const { data: allParcels, error: allParcelsError } = await supabase
                .from('parcels')
                .select('id, name, status, category, last_returned');

            if (allParcelsError) throw allParcelsError;

            const { data: logs, error: logsError } = await supabase
                .from('territory_logs')
                .select('parcel_id, returned_at, campaign_name')
                .or(`returned_at.gte.${startIsoStr}`);

            if (logsError) throw logsError;

            const report = {
                "Місто Липовець": {
                    totalTerritories: 0, processedInPeriod: 0, currentlyInProgress: 0,
                    noRecords: 0, idle_less_6_months: 0,
                    idle_6_8_months: 0, idle_8_10_months: 0, idle_10_12_months: 0, idle_over_12_months: 0,
                    firstTimeProcessing: 0, repeatedProcessing: 0,
                    repeatedParcelsList: [],
                    campaigns: {}
                },
                "Села": {
                    totalTerritories: 0, processedInPeriod: 0, currentlyInProgress: 0,
                    noRecords: 0, idle_less_6_months: 0,
                    idle_6_8_months: 0, idle_8_10_months: 0, idle_10_12_months: 0, idle_over_12_months: 0,
                    firstTimeProcessing: 0, repeatedProcessing: 0,
                    repeatedParcelsList: [],
                    campaigns: {}
                }
            };

            // ... усередині generateAggregatedReport(startDate, endDate) після завантаження allParcels та logs ...

            allParcels.forEach(parcel => {
                const pName = (parcel.name || '').toString().trim();
                const pCategory = (parcel.category || '').toString().toLowerCase();
                const pStatus = (parcel.status || '').toString().trim().toLowerCase();

                let groupKey = "Місто Липовець";

                if (pName.toLowerCase().startsWith('с.') || pName.toLowerCase().includes('село') || pCategory.includes('село') || pCategory.includes('village')) {
                    groupKey = "Села";
                }

                const g = report[groupKey];
                g.totalTerritories += 1;

                const isInProgress = pStatus === 'taken' || pStatus === 'в опрацюванні' || pStatus === 'в роботі';
                if (isInProgress) {
                    g.currentlyInProgress += 1;
                }

                const parcelLogsInPeriod = (logs || []).filter(log =>
                    log.parcel_id === parcel.id && log.returned_at &&
                    new Date(log.returned_at) >= startDate && new Date(log.returned_at) <= endDate
                );

                const hasBeenProcessedInPeriod = parcelLogsInPeriod.length > 0;

                if (hasBeenProcessedInPeriod) {
                    // ФІКС 1: Додаємо сумарну кількість усіх опрацювань (логів), а не +1 за унікальну ділянку
                    g.processedInPeriod += parcelLogsInPeriod.length;

                    parcelLogsInPeriod.sort((a, b) => new Date(a.returned_at) - new Date(b.returned_at));

                    parcelLogsInPeriod.forEach((log, index) => {
                        const campaignName = (log.campaign_name || '').trim();

                        if (campaignName && campaignName.toLowerCase() !== 'без кампанії') {
                            if (!g.campaigns[campaignName]) {
                                g.campaigns[campaignName] = { total: 0, first: 0, repeated: 0, repeatedParcelsList: [] };
                            }

                            g.campaigns[campaignName].total += 1;

                            if (index === 0) {
                                g.campaigns[campaignName].first += 1;
                            } else {
                                g.campaigns[campaignName].repeated += 1;
                                if (!g.campaigns[campaignName].repeatedParcelsList.includes(pName)) {
                                    g.campaigns[campaignName].repeatedParcelsList.push(pName);
                                }
                            }
                        }
                    });

                    // Перше опрацювання цієї ділянки у вибраному періоді
                    g.firstTimeProcessing += 1;

                    // Повторні опрацювання цієї ж ділянки
                    if (parcelLogsInPeriod.length > 1) {
                        g.repeatedProcessing += (parcelLogsInPeriod.length - 1);
                        if (!g.repeatedParcelsList.includes(pName)) {
                            g.repeatedParcelsList.push(pName);
                        }
                    }
                }

                const isFreeStatus = pStatus === 'free' || pStatus === 'вільна' || pStatus === 'доступна' || pStatus === '';
                const isActuallyFree = isFreeStatus && !isInProgress && !hasBeenProcessedInPeriod;

                if (isActuallyFree) {
                    if (!parcel.last_returned) {
                        g.noRecords += 1;
                    } else {
                        const lastReturnedDate = new Date(parcel.last_returned);
                        const diffMonths = Math.floor(Math.abs(now - lastReturnedDate) / (1000 * 60 * 60 * 24 * 30.4375));

                        if (diffMonths < 6) {
                            g.idle_less_6_months += 1;
                        } else if (diffMonths >= 6 && diffMonths < 8) {
                            g.idle_6_8_months += 1;
                        } else if (diffMonths >= 8 && diffMonths < 10) {
                            g.idle_8_10_months += 1;
                        } else if (diffMonths >= 10 && diffMonths < 12) {
                            g.idle_10_12_months += 1;
                        } else if (diffMonths >= 12) {
                            g.idle_over_12_months += 1;
                        }
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

            const supChars = ["", "¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹", "¹⁰", "¹¹", "¹²", "¹³", "¹⁴", "¹⁵"];

            // 4. ГЕНЕРАЦІЯ СЕМАНТИЧНИХ КАРТОК ЗВІТУ
            let sectionsHtml = "";

            for (const [key, info] of Object.entries(report)) {
                let footnoteIndex = 0;
                let cardFootnotes = [];

                let idleRowsHtml = "";
                if (info.noRecords > 0) idleRowsHtml += `<div class="data-row sub-row text-alert"><span>Ніколи не опрацьовувались (нові/імпортовані):</span> <span><b>${info.noRecords}</b></span></div>`;
                if (info.idle_less_6_months > 0) idleRowsHtml += `<div class="data-row sub-row text-muted"><span>«свіжі» вільні (простій менше 6 міс.):</span> <span><b>${info.idle_less_6_months}</b></span></div>`;
                if (info.idle_6_8_months > 0) idleRowsHtml += `<div class="data-row sub-row"><span>від 6 до 8 місяців:</span> <span><b>${info.idle_6_8_months}</b></span></div>`;
                if (info.idle_8_10_months > 0) idleRowsHtml += `<div class="data-row sub-row"><span>від 8 до 10 місяців:</span> <span><b>${info.idle_8_10_months}</b></span></div>`;
                if (info.idle_10_12_months > 0) idleRowsHtml += `<div class="data-row sub-row"><span>від 10 до 12 місяців:</span> <span><b>${info.idle_10_12_months}</b></span></div>`;
                if (info.idle_over_12_months > 0) idleRowsHtml += `<div class="data-row sub-row text-danger"><span>більше 12 місяців (понад рік):</span> <span><b>${info.idle_over_12_months}</b></span></div>`;

                // ФІКС 2: Показуємо розбивку тільки якщо Є повторні опрацювання (repeatedProcessing > 0)
                let generalBreakdownHtml = "";
                if (info.repeatedProcessing > 0) {
                    footnoteIndex++;
                    const supChar = supChars[footnoteIndex] || `<sup>${footnoteIndex}</sup>`;
                    const tooltipText = info.repeatedParcelsList.join(', ');

                    cardFootnotes.push({
                        num: footnoteIndex,
                        text: tooltipText
                    });

                    generalBreakdownHtml = `
                        <div class="data-row sub-row"><span>з них вперше:</span> <span><b>${info.firstTimeProcessing}</b></span></div>
                        <div class="data-row sub-row">
                            <span>з них повторно:</span> 
                            <span class="tooltip-container">
                                <span class="has-tooltip" data-tooltip="${tooltipText}">
                                    <b>${info.repeatedProcessing}</b><span class="info-icon">ℹ️</span>
                                </span>
                                <span class="print-footnote-ref">${supChar}</span>
                            </span>
                        </div>
                    `;
                }

                // Рендер кампаній
                let campaignsRowsHtml = "";
                const campaignKeys = Object.keys(info.campaigns);
                if (campaignKeys.length === 0) {
                    campaignsRowsHtml = `<p class="empty-state">Кампаній за цей період не зафіксовано</p>`;
                } else {
                    campaignKeys.forEach(camp => {
                        const cData = info.campaigns[camp];

                        // ФІКС 3: У кампаніях також показуємо розбивку тільки якщо cData.repeated > 0
                        let campaignBreakdownHtml = "";
                        if (cData.repeated > 0) {
                            footnoteIndex++;
                            const supChar = supChars[footnoteIndex] || `<sup>${footnoteIndex}</sup>`;
                            const campaignTooltipText = cData.repeatedParcelsList.join(', ');

                            cardFootnotes.push({
                                num: footnoteIndex,
                                text: campaignTooltipText
                            });

                            campaignBreakdownHtml = `
                                <div class="data-row sub-row text-muted"><span>з них вперше:</span> <span>${cData.first}</span></div>
                                <div class="data-row sub-row text-muted">
                                    <span>з них повторно:</span> 
                                    <span class="tooltip-container">
                                        <span class="has-tooltip" data-tooltip="${campaignTooltipText}">
                                            <b>${cData.repeated}</b><span class="info-icon">ℹ️</span>
                                        </span>
                                        <span class="print-footnote-ref">${supChar}</span>
                                    </span>
                                </div>
                            `;
                        }

                        campaignsRowsHtml += `
                            <div class="campaign-item">
                                <div class="data-row campaign-main"><span>«${camp}»:</span> <span> <b>${cData.total}</b></span></div>
                                ${campaignBreakdownHtml}
                            </div>
                        `;
                    });
                }

                let footnotesBlockHtml = "";
                if (cardFootnotes.length > 0) {
                    footnotesBlockHtml += `<div class="print-footnotes-section">`;
                    cardFootnotes.forEach(fn => {
                        footnotesBlockHtml += `
                            <div class="print-footnote-item">
                                <sup>${fn.num}</sup> Ділянки: ${fn.text}.
                            </div>
                        `;
                    });
                    footnotesBlockHtml += `</div>`;
                }

                sectionsHtml += `
                    <section class="report-card">
                        <h2 class="card-title">${key}</h2>
                        
                        <div class="stats-group">
                            <div class="data-row"><span>Загалом територій / ділянок:</span> <span><b>${info.totalTerritories}</b></span></div>
                            <div class="data-row highlight"><span>Опрацьовано за період:</span> <span><b>${info.processedInPeriod}</b></span></div>
                            ${generalBreakdownHtml}
                            <div class="data-row"><span>Зараз в опрацюванні:</span> <span><b>${info.currentlyInProgress}</b></span></div>
                        </div>
                        
                        <div class="stats-group">
                            <h3 class="group-heading">Стан вільних територій (за датою повернення)</h3>
                            ${idleRowsHtml || '<p class="empty-state">Вільних територій немає</p>'}
                        </div>

                        <div class="stats-group">
                            <h3 class="group-heading">Задіяні кампанії</h3>
                            ${campaignsRowsHtml}
                        </div>
                        
                        ${footnotesBlockHtml}
                    </section>
                `;
            }
            // Формуємо документ з фіксом позиціонування
            const reportHtml = `<!DOCTYPE html>
<html lang="uk">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Сумарний звіт про опрацювання територій</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
    <style>
        :root {
            --slate-900: #0f172a;
            --slate-800: #1e293b;
            --slate-700: #334155;
            --slate-600: #475569;
            --slate-400: #94a3b8;
            --slate-200: #e2e8f0;
            --slate-100: #f1f5f9;
            --blue-600: #2563eb;
            --blue-700: #1d4ed8;
            --emerald-600: #10b981;
            --emerald-700: #059669;
            --red-600: #dc2626;
        }

        * { box-sizing: border-box; }

        body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            line-height: 1.5; padding: 80px 24px 40px 24px; color: var(--slate-800); background: #f8fafc; font-size: 14px; 
            margin: 0;
        }
        
        .container { max-width: 680px; margin: 0 auto; width: 100%; box-sizing: border-box; }
        
        header { text-align: center; margin-bottom: 24px; }
        .header-title { font-size: 22px; font-weight: 700; color: var(--slate-900); margin: 0 0 6px 0; letter-spacing: -0.5px; }
        .header-meta { font-size: 12px; color: var(--slate-600); line-height: 1.6; }
        
        .report-card { 
            background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; 
            padding: 24px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);
            box-sizing: border-box;
            break-inside: avoid;
        }
        .card-title { font-size: 18px; font-weight: 700; color: var(--slate-900); margin: 0 0 16px 0; border-bottom: 2px solid var(--slate-100); padding-bottom: 8px; }
        
        .stats-group { margin-bottom: 20px; }
        .stats-group:last-child { margin-bottom: 0; }
        
        .group-heading { font-weight: 600; font-size: 13.5px; margin: 16px 0 8px 0; padding-bottom: 2px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--slate-600); }
        
        .data-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed var(--slate-100); color: var(--slate-700); }
        .data-row:last-child { border-bottom: none; }
        .data-row span:last-child { color: var(--slate-900); text-align: right; }
        
        .data-row.highlight { background: #f8fafc; font-weight: 600; padding: 6px 8px; border-radius: 6px; border-bottom: none; margin: 2px 0; }
        
        .sub-row { padding-left: 16px; font-size: 13px; color: var(--slate-600); }
        .campaign-item { border-left: 2px solid var(--slate-100); padding-left: 10px; margin-bottom: 8px; }
        .campaign-main { font-weight: 500; }
        
        .empty-state { font-style: italic; color: var(--slate-400); font-size: 13px; margin: 4px 0 0 0; }
        .text-muted { color: var(--slate-400) !important; }
        .text-alert { color: #d97706 !important; }
        .text-danger span { color: var(--red-600) !important; font-weight: bold; }
        
        .has-tooltip {
            position: relative;
            cursor: help;
            color: var(--blue-600);
            border-bottom: 1px dotted var(--blue-600);
            padding-bottom: 1px;
            display: inline-block;
        }
        .info-icon { display: inline; margin-left: 2px; font-size: 11px; }
        .tooltip-container { display: inline-flex; align-items: center; }
        
        .custom-tooltip-box {
            position: absolute;
            background: var(--slate-900);
            color: #fff;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: normal;
            line-height: 1.4;
            max-width: 250px;
            width: max-content;
            z-index: 100000;
            box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);
            pointer-events: none;
        }

        .print-footnote-ref, .print-footnotes-section { display: none; }
        
        .action-bar {
            position: fixed; top: 0; left: 0; right: 0; background: rgba(248, 250, 252, 0.85);
            backdrop-filter: blur(12px); border-bottom: 1px solid #e2e8f0;
            padding: 14px 24px; display: flex; justify-content: flex-end; gap: 12px; z-index: 99999;
        }
        .btn { 
            padding: 10px 18px; border: none; border-radius: 8px; cursor: pointer; font-size: 13.5px; 
            font-weight: 600; box-shadow: 0 1px 2px rgba(0,0,0,0.05); transition: all 0.2s;
        }
        .btn-print { background: var(--blue-600); color: #fff; }
        .btn-print:hover { background: var(--blue-700); }
        .btn-download { background: var(--emerald-600); color: #fff; }
        .btn-download:hover { background: var(--emerald-700); }

        /* 📄 СПЕЦІАЛЬНИЙ РЕЖИМ РЕНДЕРУ ДЛЯ PDF */
        body.pdf-rendering {
            padding: 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
            width: 700px !important;
        }

        body.pdf-rendering .container {
            max-width: 700px !important;
            width: 700px !important;
            margin: 0 !important;
            padding: 0 !important;
        }

        body.pdf-rendering .action-bar { display: none !important; }

        body.pdf-rendering .report-card { 
            border: 1px solid #e2e8f0 !important; 
            box-shadow: none !important; 
            padding: 16px !important; 
            margin-bottom: 15px !important; 
            break-inside: avoid !important;
            margin-top: 20px;
        }

        body.pdf-rendering .has-tooltip { color: inherit !important; border-bottom: none !important; }
        body.pdf-rendering .info-icon { display: none !important; }
        body.pdf-rendering .print-footnote-ref { display: inline-block !important; color: var(--blue-600) !important; font-weight: bold !important; font-size: 12px !important; }
        body.pdf-rendering .print-footnotes-section { display: block !important; margin-top: 10px !important; padding-top: 6px !important; border-top: 1px dashed #cbd5e1 !important; font-size: 11px !important; color: #475569 !important; }
        
        @media print {
            body { padding: 0 !important; margin: 0 !important; background: #fff !important; } 
            .container { max-width: 100% !important; width: 100% !important; margin: 0 !important; padding: 0 !important; }
            .action-bar { display: none !important; }
            .report-card { border: none !important; box-shadow: none !important; padding: 0 !important; margin-bottom: 20px !important; break-inside: avoid !important; }
            .has-tooltip { color: inherit !important; border-bottom: none !important; }
            .info-icon { display: none !important; }
            .print-footnote-ref { display: inline-block !important; }
            .print-footnotes-section { display: block !important; }
            @page { size: A4 portrait; margin: 12mm 15mm; }
        }
    </style>
    <script>
        function downloadReportPDF() {
            const btn = document.querySelector('.btn-download');
            const container = document.querySelector('.container');
            
            const originalText = btn.innerHTML;
            btn.innerHTML = '⏳ Генерація PDF...';
            btn.disabled = true;

            // Додаємо клас рендеру на ВЕСЬ body, щоб повністю прибрати margin/padding зліва
            document.body.classList.add('pdf-rendering');
            window.scrollTo(0, 0);

            const opt = {
                margin:       [10, 10, 10, 10], // Всі відступи сторінки контролює сам PDF!
                filename:     'analytics_report_${fileNameDate}.pdf',
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { 
                    scale: 2, 
                    useCORS: true, 
                    logging: false,
                    scrollX: 0,
                    scrollY: 0,
                    x: 0,
                    y: 0,
                    windowWidth: 750
                },
                jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
                pagebreak:    { mode: ['css', 'legacy'] }
            };

            setTimeout(() => {
                html2pdf().set(opt).from(container).save().then(() => {
                    document.body.classList.remove('pdf-rendering');
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                }).catch(err => {
                    console.error('Помилка генерації PDF:', err);
                    document.body.classList.remove('pdf-rendering');
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                    alert('Не вдалося згенерувати PDF.');
                });
            }, 300);
        }

        document.addEventListener('DOMContentLoaded', () => {
            let activeTooltip = null;

            function createTooltip(target, text) {
                if (document.body.classList.contains('pdf-rendering')) return;
                if (activeTooltip) activeTooltip.remove();

                activeTooltip = document.createElement('div');
                activeTooltip.className = 'custom-tooltip-box';
                activeTooltip.innerText = "Ділянки: " + text;
                document.body.appendChild(activeTooltip);

                const rect = target.getBoundingClientRect();
                const scrollY = window.scrollY;
                const scrollX = window.scrollX;

                activeTooltip.style.top = (rect.top + scrollY - activeTooltip.offsetHeight - 8) + 'px';
                activeTooltip.style.left = (rect.left + scrollX + (rect.width / 2) - (activeTooltip.offsetWidth / 2)) + 'px';
            }

            function removeTooltip() {
                if (activeTooltip) {
                    activeTooltip.remove();
                    activeTooltip = null;
                }
            }

            document.querySelectorAll('.has-tooltip').forEach(el => {
                const listData = el.getAttribute('data-tooltip');
                if (!listData) return;

                el.addEventListener('mouseenter', (e) => createTooltip(e.currentTarget, listData));
                el.addEventListener('mouseleave', removeTooltip);
                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    createTooltip(e.currentTarget, listData);
                });
            });

            document.addEventListener('click', removeTooltip);
        });
    </script>
</head>
<body>
    <div class="action-bar" role="toolbar">
        <button class="btn btn-print" onclick="window.print()">🖨️ Друк / PDF</button>
        <button class="btn btn-download" onclick="downloadReportPDF()">📄 Завантажити PDF</button>
    </div>
    
    <main class="container">
        <header>
            <h1 class="header-title">Звіт про опрацювання територій</h1>
            <div class="header-meta">
                <span>Період звіту: ${dateTitle}</span><br>
                <span>Згенеровано: <time datetime="${now.toISOString()}">${now.toLocaleString('uk-UA')}</time></span>
            </div>
        </header>
        ${sectionsHtml}
    </main>
</body>
</html>`;

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
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAnalyticsModule);
} else {
    initAnalyticsModule();
}
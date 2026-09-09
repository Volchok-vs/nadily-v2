// ============================================
// ДОПОМІЖНЕ МОДАЛЬНЕ ВІКНО ВИБОРУ РОКУ
// ============================================
function showYearSelectionModal() {
    return new Promise((resolve) => {
        const existingModal = document.getElementById('s13-year-modal');
        if (existingModal) existingModal.remove();

        const now = new Date();
        const currentYear = now.getFullYear();
        const defaultStartYear = (now.getMonth() >= 8) ? currentYear : currentYear - 1;

        const yearsOptions = [];
        for (let i = 0; i < 4; i++) {
            const startY = defaultStartYear - i;
            const label = `${startY}/${(startY + 1).toString().slice(-2)}`;
            yearsOptions.push({ startYear: startY, label });
        }

        const overlay = document.createElement('div');
        overlay.id = 's13-year-modal';
        overlay.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:10001; display:flex; align-items:center; justify-content:center; font-family:sans-serif;";

        overlay.innerHTML = `
            <div style="background:white; padding:24px; border-radius:12px; min-width:320px; box-shadow:0 10px 25px rgba(0,0,0,0.3); text-align:center;">
                <h3 style="margin-top:0; color:#333; font-size:18px;">Оберіть службовий рік</h3>
                <p style="color:#666; font-size:13px; margin-bottom:15px;">Період: 1 вересня — 31 серпня</p>
                
                <div style="margin-bottom:20px;">
                    <select id="s13-year-select" style="width:100%; padding:10px; font-size:15px; border-radius:6px; border:1px solid #ccc; background:#f8f9fa; cursor:pointer;">
                        ${yearsOptions.map((opt, idx) => `<option value="${opt.startYear}" ${idx === 0 ? 'selected' : ''}>Службовий рік ${opt.label}</option>`).join('')}
                    </select>
                </div>

                <div style="display:flex; gap:10px; justify-content:center;">
                    <button id="s13-cancel-btn" style="flex:1; padding:9px 15px; background:#6c757d; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">Скасувати</button>
                    <button id="s13-confirm-btn" style="flex:1; padding:9px 15px; background:#28a745; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">Згенерувати</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const selectEl = overlay.querySelector('#s13-year-select');
        const confirmBtn = overlay.querySelector('#s13-confirm-btn');
        const cancelBtn = overlay.querySelector('#s13-cancel-btn');

        confirmBtn.onclick = () => {
            const selectedStartYear = parseInt(selectEl.value);
            const rangeStart = new Date(selectedStartYear, 8, 1, 0, 0, 0, 0); 
            const rangeEnd = new Date(selectedStartYear + 1, 7, 31, 23, 59, 59, 999); 
            
            const prevTheocraticStart = new Date(rangeStart);
            prevTheocraticStart.setFullYear(prevTheocraticStart.getFullYear() - 1);

            const serviceYear = `${selectedStartYear}/${selectedStartYear + 1}`;
            const serviceYearText = `${selectedStartYear}/${(selectedStartYear + 1).toString().slice(-2)}`;
            
            overlay.remove();
            resolve({ rangeStart, rangeEnd, prevTheocraticStart, serviceYear, serviceYearText });
        };

        cancelBtn.onclick = () => {
            overlay.remove();
            resolve(null);
        };
    });
}

// s13-export.js — Єдиний модуль для генерації, відображення та експорту картки S-13

function getTheocraticStart(date = new Date()) {
  const year = date.getMonth() >= 8 ? date.getFullYear() : date.getFullYear() - 1;
  return new Date(year, 8, 1, 0, 0, 0, 0);
}

/**
 * Перевірка: чи була дільниця взята в минулому службовому році, але активна/повернена в поточному
 */
function isTakenInPreviousYear(takenDateStr, returnedDateStr, rangeStart) {
  if (!takenDateStr) return false;
  const takenDate = new Date(takenDateStr);
  const returnedDate = returnedDateStr ? new Date(returnedDateStr) : null;
  
  // Взято до початку поточного службового року
  const takenBefore = takenDate < rangeStart;
  // І досі на руках АБО повернено вже в поточному службовому році
  const activeOrReturnedInCurrent = !returnedDate || returnedDate >= rangeStart;

  return takenBefore && activeOrReturnedInCurrent;
}

/**
 * Отримання кольору та стилю кампанії
 */
function getCampaignStyle(campaignName) {
  if (!campaignName) return { bgHex: '', colorHex: '', styleStr: '' };
  const cName = campaignName.toLowerCase();
  
  if (cName.includes("конгрес")) {
    return { bgHex: 'FFE9C46A', colorHex: 'FF5C4B1B', styleStr: 'background-color: rgba(233, 196, 106, 0.5); color: #5C4B1B;' };
  } else if (cName.includes("спец") || cName.includes("спеціальна")) {
    return { bgHex: 'FFFFCDB2', colorHex: 'FF6D4C41', styleStr: 'background-color: rgba(255, 205, 178, 0.5); color: #6D4C41;' };
  } else if (cName.includes("спомин")) {
    return { bgHex: 'FFB2B9AD', colorHex: 'FF2F3E30', styleStr: 'background-color: rgba(178, 185, 173, 0.5); color: #2F3E30;' };
  }
  return { bgHex: '', colorHex: '', styleStr: '' };
}

/**
 * 1. ЄДИНЕ ДЖЕРЕЛО ДАНИХ (Data Provider)
 */
async function fetchS13Data(category = 'city', periodConfig = null) {
  let rangeStart, rangeEnd, prevTheocraticStart;

  if (periodConfig) {
    rangeStart = periodConfig.rangeStart;
    rangeEnd = periodConfig.rangeEnd;
    prevTheocraticStart = periodConfig.prevTheocraticStart;
  } else {
    rangeStart = getTheocraticStart();
    rangeEnd = new Date(rangeStart.getFullYear() + 1, 7, 31, 23, 59, 59, 999);
    prevTheocraticStart = new Date(rangeStart);
    prevTheocraticStart.setFullYear(prevTheocraticStart.getFullYear() - 1);
  }

  const prevStartISO = prevTheocraticStart.toISOString();

  const [parcelsRes, logsRes] = await Promise.all([
    supabase.from('parcels').select('*'),
    supabase.from('territory_logs')
      .select('parcel_id, publisher_name, taken_at, returned_at, campaign_id, campaign_name')
      .or(`taken_at.gte.${prevStartISO},returned_at.gte.${prevStartISO}`)
      .order('taken_at', { ascending: true })
  ]);

  if (parcelsRes.error || logsRes.error) {
    throw new Error(parcelsRes.error?.message || logsRes.error?.message);
  }

  let parcels = parcelsRes.data.filter(p => 
    category === 'city' ? p.category !== 'Село' : p.category === 'Село'
  );

  parcels.sort((a, b) => {
    if (category === 'city') {
      return (parseInt(a.name.replace(/\D/g, '')) || 0) - (parseInt(b.name.replace(/\D/g, '')) || 0);
    }
    return a.name.localeCompare(b.name, 'uk', { numeric: true });
  });

  const allLogs = logsRes.data;

  const items = parcels.map(p => {
    const pLogs = allLogs.filter(log => {
      if (log.parcel_id !== p.id) return false;
      const takenDate = log.taken_at ? new Date(log.taken_at) : null;
      const returnedDate = log.returned_at ? new Date(log.returned_at) : null;
      
      if (returnedDate) return returnedDate >= rangeStart && returnedDate <= rangeEnd;
      return takenDate && takenDate >= rangeStart && takenDate <= rangeEnd;
    }).map(log => ({
      name: log.publisher_name,
      in: log.taken_at,
      out: log.returned_at,
      campaign_id: log.campaign_id,
      campaign_name: log.campaign_name
    }));

    if (p.status === 'taken' && p.taken_by) {
      const takenDate = p.taken_at ? new Date(p.taken_at) : null;
      if (takenDate && takenDate <= rangeEnd) {
        if (!pLogs.some(l => !l.out && l.name === p.taken_by)) {
          pLogs.push({ name: p.taken_by, in: p.taken_at, out: null });
        }
      }
    }

    let rawLastDate = p.last_processed ? new Date(p.last_processed) : null;
    const prevYearLogs = allLogs.filter(log => {
      if (log.parcel_id !== p.id || !log.returned_at) return false;
      const retDate = new Date(log.returned_at);
      return retDate >= prevTheocraticStart && retDate < rangeStart;
    });

    if (prevYearLogs.length > 0) {
      const maxPrevLogDate = new Date(Math.max(...prevYearLogs.map(l => new Date(l.returned_at))));
      if (!rawLastDate || maxPrevLogDate > rawLastDate) {
        rawLastDate = maxPrevLogDate;
      }
    }

    return {
      parcel: p,
      lastProcessedDate: (rawLastDate && rawLastDate < rangeStart) ? rawLastDate : null,
      sessions: pLogs
    };
  });

  return { items, rangeStart, rangeEnd };
}

/**
 * 2. ВІДОБРАЖЕННЯ ТАБЛИЦІ В ІНТЕРФЕЙСІ (HTML Grid)
 */
async function renderS13TableGrid(category = 'city') {
  const tHead = document.getElementById('tHead');
  const tBody = document.getElementById('tBody');
  if (!tHead || !tBody) return;

  try {
    const { items, rangeStart } = await fetchS13Data(category);

    let maxCols = 1;
    items.forEach(item => {
      if (item.sessions.length > maxCols) maxCols = item.sessions.length;
    });

    tHead.innerHTML = `
      <tr>
        <th rowspan="2" style="width: 40px; min-width: 40px; border:1px solid #444;">№</th>
        <th rowspan="2" class="help-tooltip" style="width: 110px; min-width: 110px; border:1px solid #444; cursor: help; position: relative;">
            Остання дата опрацювання<span style="color:red;">*</span>
        </th>
        ${`<th colspan="2" style="width: 210px; min-width: 210px; border:1px solid #444;">Вісник</th>`.repeat(maxCols)}
      </tr>
      <tr>
        ${`<th style="background:#e2efda; width: 100px; min-width: 100px; border:1px solid #444;">Дата отримання</th>
               <th style="background:#fce4d6; width: 100px; min-width: 100px; border:1px solid #444;">Дата опрацювання</th>`.repeat(maxCols)}
      </tr>
    `;

    tBody.innerHTML = '';
    let hasCampaignInTable = false;

    items.forEach(({ parcel, lastProcessedDate, sessions }) => {
      const lastDoneText = lastProcessedDate 
        ? lastProcessedDate.toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit", year: "2-digit" }) 
        : "-";

      const tr1 = document.createElement("tr");
      const tr2 = document.createElement("tr");

      let tr1Html = `
        <td rowspan="2" class="num-col" style="text-align: center; border:1px solid #444;">
          <a href="parcel-details.html?id=${parcel.id}&from=all" style="text-decoration:none; color:#007bff; font-weight:bold;">
            ${parcel.name}
          </a>
        </td>
        <td rowspan="2" class="last-done-col" style="text-align: center; border:1px solid #444; ${lastDoneText !== '-' ? 'color: #d32f2f; font-weight: bold;' : ''}">
          ${lastDoneText}
        </td>
      `;

      let tr2Html = "";
      for (let i = 0; i < maxCols; i++) {
        const s = sessions[i];
        const pName = s ? s.name : "";
        const dIn = s ? new Date(s.in).toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "";
        const dOut = s && s.out ? new Date(s.out).toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "";

        const isPrevTaken = s ? isTakenInPreviousYear(s.in, s.out, rangeStart) : false;
        const inDateStyle = isPrevTaken ? 'color: #1976d2; font-weight: bold;' : '';

        let campaignStyle = "";
        if (s?.campaign_id) {
          hasCampaignInTable = true;
          campaignStyle = getCampaignStyle(s.campaign_name).styleStr;
        }

        tr1Html += `<td colspan="2" class="name-row" style="border:1px solid #444; padding:4px; ${campaignStyle}">${pName}</td>`;
        tr2Html += `
          <td class="date-cell" style="background:#e8f5e9; border:1px solid #444; text-align: center; ${inDateStyle}">${dIn}</td>
          <td class="date-cell" style="background:#fff3e0; border:1px solid #444; text-align: center;">${dOut}</td>
        `;
      }

      tr1.innerHTML = tr1Html;
      tr2.innerHTML = tr2Html;
      tBody.appendChild(tr1);
      tBody.appendChild(tr2);
    });

    if (typeof createColorLegend === "function") {
      createColorLegend(hasCampaignInTable);
    }
  } catch (err) {
    console.error("Помилка при побудові S-13 таблиці:", err);
  }
}

// ============================================
// ФУНКЦІЯ ЕКСПОРТУ В PDF
// ============================================
async function exportS13FullPDF() {
    const periodConfig = await showYearSelectionModal();
    if (!periodConfig) return;

    const { serviceYear } = periodConfig;
    const dateOptions = { day: '2-digit', month: '2-digit', year: '2-digit' };

    const scripts = [
        'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
    ];
    
    const progressDiv = document.createElement('div');
    progressDiv.style = "position:fixed;top:10px;left:50%;transform:translateX(-50%);background:#17a2b8;color:white;padding:12px 20px;border-radius:8px;z-index:10000;font-family:sans-serif;box-shadow:0 4px 10px rgba(0,0,0,0.2);transition: background 0.3s;";
    progressDiv.innerHTML = "<b>⏳ Завантаження бібліотек...</b>";
    document.body.appendChild(progressDiv);

    try {
        for (let src of scripts) {
            if (!document.querySelector(`script[src="${src}"]`)) {
                const s = document.createElement('script');
                s.src = src;
                document.head.appendChild(s);
                await new Promise(r => s.onload = r);
            }
        }

        const { jsPDF } = window.jspdf;

        async function generateS13PdfForCategory(categoryKey, categoryName, updateProgress) {
            updateProgress(`🔍 Збір даних для "${categoryName}"...`);
            const { items, rangeStart } = await fetchS13Data(categoryKey, periodConfig);

            if (items.length === 0) {
                updateProgress(`Немає дільниць для категорії "${categoryName}". Пропускаємо.`);
                return;
            }

            function generateRowsHTML(itemsSlice) {
                let html = '';
                itemsSlice.forEach(({ parcel, lastProcessedDate, sessions }) => {
                    const lastProcessedText = lastProcessedDate 
                        ? lastProcessedDate.toLocaleDateString('uk-UA', dateOptions) 
                        : '—';

                    let logCells = '';
                    const logColumnsCount = (categoryName === 'Села') ? 3 : 4; 

                    for (let j = 0; j < logColumnsCount; j++) {
                        const s = sessions[j];
                        const takenDate = s && s.in ? new Date(s.in) : null;
                        const returnedDate = s && s.out ? new Date(s.out) : null;

                        const dIn = takenDate ? takenDate.toLocaleDateString('uk-UA', dateOptions) : '';
                        const dOut = returnedDate ? returnedDate.toLocaleDateString('uk-UA', dateOptions) : '';
                        
                        const isPrevTaken = s ? isTakenInPreviousYear(s.in, s.out, rangeStart) : false;
                        const takenDateStyle = isPrevTaken ? 'color: #1976d2; font-weight: bold;' : '';
                        const campaignStyle = s ? getCampaignStyle(s.campaign_name).styleStr : '';
                        
                        logCells += `
                            <td style="border:1.5px solid black; height:36px; width:135px; text-align:center; padding:0; box-sizing:border-box;">
                                <div style="height:18px; border-bottom:1px solid black; font-size:10pt; line-height:18px; overflow:hidden; white-space:nowrap; padding: 0 2px; ${campaignStyle}">
                                    ${s ? s.name : ''}
                                </div>
                                <div style="display:flex; height:18px; line-height:18px; font-size:9pt;">
                                    <div style="flex:1; ${takenDateStyle}">${dIn}</div>
                                    <div style="flex:1; border-left:1px solid black;">${dOut}</div>
                                </div>
                            </td>`;
                    }
                    html += `<tr style="height:36px;">
                        <td style="border:1.5px solid black; text-align:center; font-size:9pt; width:${categoryName === 'Села' ? '75px' : '35px'};">${parcel.name}</td>
                        <td style="border:1.5px solid black; text-align:center; font-size:8.5pt; width:75px; background:#fffde7; ${lastProcessedText !== '—' ? 'color:red; font-weight:bold;' : ''}">
                            ${lastProcessedText}
                        </td>
                        ${logCells}
                    </tr>`;
                });
                return html;
            }

            const firstPageLimit = 23; 
            const nextPageLimit = 25; 
            let pages = [];
            let currentParcelIndex = 0;

            while (currentParcelIndex < items.length) {
                const isFirst = pages.length === 0;
                const count = isFirst ? firstPageLimit : nextPageLimit;
                
                pages.push({ 
                    startIndex: currentParcelIndex, 
                    endIndex: Math.min(currentParcelIndex + count, items.length) 
                });
                currentParcelIndex += count;
            }

            const pdf = new jsPDF('p', 'mm', 'a4');
            const tempContainer = document.createElement('div');
            tempContainer.style = "position:absolute; left:-9999px; width:210mm;";
            document.body.appendChild(tempContainer);

            for (let i = 0; i < pages.length; i++) {
                updateProgress(`📄 Генерація "${categoryName}" PDF: сторінка ${i + 1} з ${pages.length}...`);
                const pageConfig = pages[i];
                const itemsForPage = items.slice(pageConfig.startIndex, pageConfig.endIndex);
                const pagePaddingTop = i === 0 ? "8mm" : "13mm";

                tempContainer.innerHTML = `
                    <div id="page-render" style="padding:${pagePaddingTop} 10mm 10mm 10mm; background:white; width:210mm; min-height:297mm; display:block; box-sizing:border-box; font-family:Arial, sans-serif;">
                        ${i === 0 ? `
                            <div style="text-align:center; font-size:17pt; font-weight:bold; margin-bottom:15px;">ЗАПИСИ ПРО ОПРАЦЮВАННЯ ТЕРИТОРІЙ ${categoryName.toUpperCase()}</div>
                            <div style="font-size:13pt; font-weight:bold; margin-bottom:15px; margin-left:5mm;">Службовий рік: <span style="border-bottom:1px solid black; padding:0 20px;">${serviceYear}</span></div>
                        ` : ''}
                        <table style="width:100%; border-collapse:collapse; border:2.5px solid black; table-layout:fixed;">
                            <thead>
                                <tr style="background:#eeeeee; height:46px;">
                                    <th style="border:1.5px solid black; width:${categoryName === 'Села' ? '75px' : '35px'}; font-size:8pt; padding:2px; text-align:center;">${categoryName === 'Села' ? 'Назва тер.' : '№ тер.'}</th>
                                    <th style="border:1.5px solid black; width:75px; font-size:8pt; padding:2px; text-align:center;">Остання дата<br>опрацювання*</th>
                                    
                                    ${Array.from({ length: categoryName === 'Села' ? 3 : 4 }).map((_, k) => `
                                        <th style="border:1.5px solid black; width:135px; padding:0; text-align:center;">
                                            <div style="font-size:10pt; height:18px; border-bottom:1.5px solid black; line-height:18px;">Вісник</div>
                                            <div style="display:flex; font-size:7pt; height:26px; line-height:9pt;">
                                                <div style="flex:1;">Дата<br>отримання</div>
                                                <div style="flex:1; border-left:1.5px solid black;">Дата<br>опрацювання</div>
                                            </div>
                                        </th>`).join('')}
                                </tr>
                            </thead>
                            <tbody>${generateRowsHTML(itemsForPage)}</tbody>
                        </table>
                        <div style="margin-top:3mm; padding-left:2mm; display:flex; align-items:center; flex-wrap:wrap;">
                            <p style="font-size:8pt; margin:0; line-height:1.2;">*Заповнюючи новий бланк, познач у цій колонці останню дату опрацювання кожної території.</p>
                            <div style="display:flex; align-items:center; gap:10px; font-size:8pt; margin-left:10px;">
                                <div style="display:flex; align-items:center; gap:4px;">
                                    <div style="width:12px; height:12px; background:#E9C46A;"></div>
                                    <span>Конгрес</span>
                                </div>
                                <div style="display:flex; align-items:center; gap:4px;">
                                    <div style="width:12px; height:12px; background:#FFCDB2;"></div>
                                    <span>Спец. кампанія</span>
                                </div>
                                <div style="display:flex; align-items:center; gap:4px;">
                                    <div style="width:12px; height:12px; background:#B2B9AD;"></div>
                                    <span>Спомин</span>
                                </div>
                            </div>
                            <p style="font-size:9.5pt; margin:3px 0 0 0; font-weight:bold; width:100%;">S-13-K 1/22</p>
                        </div>
                    </div>`;

                const canvas = await html2canvas(tempContainer.querySelector('#page-render'), { 
                    scale: 2, useCORS: true, windowWidth: 794 
                });
                const imgData = canvas.toDataURL('image/jpeg', 0.95);
                if (i > 0) pdf.addPage();
                pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
            }

            pdf.save(`S-13_${categoryName}_${serviceYear.replace('/', '-')}.pdf`);
            tempContainer.remove();
        }

        const updateProgress = (message) => {
            progressDiv.innerHTML = `<b>${message}</b>`;
        };

        await generateS13PdfForCategory('city', 'Місто', updateProgress);
        await generateS13PdfForCategory('village', 'Села', updateProgress);
        
        progressDiv.style.background = "#28a745";
        progressDiv.innerHTML = "✅ Всі PDF успішно створено!";
        setTimeout(() => progressDiv.remove(), 2500);

    } catch (err) {
        console.error(err);
        progressDiv.style.background = "#dc3545";
        progressDiv.innerHTML = "❌ Помилка: " + err.message;
        setTimeout(() => progressDiv.remove(), 5000);
    }
}

// ============================================
// ФУНКЦІЯ ЕКСПОРТУ В EXCEL
// ============================================
async function exportS13Excel() {
    const periodConfig = await showYearSelectionModal();
    if (!periodConfig) return;

    const { serviceYearText } = periodConfig;

    let statusDiv = document.getElementById('excel-export-status');
    if (!statusDiv) {
        statusDiv = document.createElement('div');
        statusDiv.id = 'excel-export-status';
        statusDiv.style = "position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#007bff;color:white;padding:12px 25px;border-radius:8px;z-index:10000;font-family:sans-serif;box-shadow:0 4px 12px rgba(0,0,0,0.3);transition:all 0.3s;pointer-events:none;text-align:center;";
        document.body.appendChild(statusDiv);
    }

    const setStatus = (msg, isError = false) => {
        console.log(`[Excel Export]: ${msg}`);
        statusDiv.innerHTML = `<b>${isError ? '❌' : '⏳'} ${msg}</b>`;
        statusDiv.style.background = isError ? "#dc3545" : "#007bff";
    };

    setStatus("Запуск експорту...");

    try {
        if (typeof ExcelJS === 'undefined') {
            setStatus("Завантаження ExcelJS...");
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.3.0/exceljs.min.js';
                script.onload = resolve;
                script.onerror = () => reject(new Error("CDN Error"));
                document.head.appendChild(script);
            });
        }

        setStatus("Отримання даних...");
        const workbook = new ExcelJS.Workbook();

        async function buildExcelSheet(categoryKey, sheetName, maxCols) {
            const { items, rangeStart } = await fetchS13Data(categoryKey, periodConfig);
            if (items.length === 0) return;

            const sheet = workbook.addWorksheet(sheetName);
            sheet.pageSetup = {
                paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
                margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
                horizontalCentered: true, printTitlesRow: '5:6'
            };

            const cols = [{ width: categoryKey === 'village' ? 12 : 6 }, { width: 12 }];
            for (let i = 0; i < maxCols; i++) {
                cols.push({ width: 10 }, { width: 12 });
            }
            sheet.columns = cols;

            const totalCols = 2 + (maxCols * 2);
            const lastColLetter = String.fromCharCode(64 + totalCols);

            sheet.mergeCells(`A1:${lastColLetter}1`);
            const titleCell = sheet.getCell('A1');
            titleCell.value = `ЗАПИСИ ПРО ОПРАЦЮВАННЯ ТЕРИТОРІЙ (${sheetName})`;
            titleCell.font = { bold: true, size: 16 };
            titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

            sheet.mergeCells('A2:C2');
            sheet.getCell('A2').value = `Службовий рік: ${serviceYearText}`;
            sheet.getCell('A2').font = { bold: true };

            const legendData = ['Легенда:', ''];
            ['Конгрес', '', 'Спец. кампанія', '', 'Спомин', ''].forEach(val => legendData.push(val));
            const legendRow = sheet.addRow(legendData);
            legendRow.getCell(1).font = { bold: true, size: 9 };
            legendRow.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE9C46A' } };
            legendRow.getCell(3).font = { size: 8 };
            legendRow.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCDB2' } };
            legendRow.getCell(5).font = { size: 8 };
            legendRow.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB2B9AD' } };
            legendRow.getCell(7).font = { size: 8 };

            sheet.addRow([]);
            
            const h1 = [categoryKey === 'village' ? 'Назва тер.' : '№ Тер.', 'Остання дата опрацювання*'];
            const h2 = ['', ''];
            for (let i = 0; i < maxCols; i++) {
                h1.push('Вісник', '');
                h2.push('Дата отримання', 'Дата опрацювання');
            }
            sheet.addRow(h1);
            sheet.addRow(h2);

            [5, 6].forEach(rNum => {
                sheet.getRow(rNum).eachCell(cell => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
                    cell.border = { top: {style:'medium'}, left: {style:'medium'}, bottom: {style:'medium'}, right: {style:'medium'} };
                    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                    cell.font = { size: 9, bold: true };
                });
            });

            sheet.mergeCells('A5:A6'); 
            sheet.mergeCells('B5:B6');
            for (let i = 0; i < maxCols; i++) {
                const startC = 3 + (i * 2);
                sheet.mergeCells(5, startC, 5, startC + 1);
            }

            items.forEach(({ parcel, lastProcessedDate, sessions }) => {
                const isOld = !!lastProcessedDate;

                const r1Data = [
                    categoryKey === 'city' ? (parseInt(parcel.name) || parcel.name) : parcel.name, 
                    isOld ? lastProcessedDate.toLocaleDateString('uk-UA') : '—'
                ];
                for (let i = 0; i < maxCols; i++) {
                    r1Data.push(sessions[i]?.name || '', '');
                }
                const r1 = sheet.addRow(r1Data);
                
                const r2Data = ['', ''];
                for (let i = 0; i < maxCols; i++) {
                    const s = sessions[i];
                    r2Data.push(s && s.in ? new Date(s.in).toLocaleDateString('uk-UA', {day:'2-digit', month:'2-digit'}) : '');
                    r2Data.push(s && s.out ? new Date(s.out).toLocaleDateString('uk-UA', {day:'2-digit', month:'2-digit'}) : '');
                }
                const r2 = sheet.addRow(r2Data);

                sheet.mergeCells(r1.number, 1, r2.number, 1);
                sheet.mergeCells(r1.number, 2, r2.number, 2);
                for (let i = 0; i < maxCols; i++) {
                    const startC = 3 + (i * 2);
                    sheet.mergeCells(r1.number, startC, r1.number, startC + 1);
                }

                [r1, r2].forEach((row, rowIndex) => {
                    for (let c = 1; c <= totalCols; c++) {
                        const cell = row.getCell(c);
                        cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
                        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                        if (rowIndex === 0) cell.border.top = { style: 'medium' };
                        if (rowIndex === 1) cell.border.bottom = { style: 'medium' };
                        if (c === 1) cell.border.left = { style: 'medium' };
                        if (c === totalCols) cell.border.right = { style: 'medium' };
                        if (c % 2 === 0) cell.border.right = { style: 'medium' };
                        if (c % 2 === 1 && c > 1) cell.border.left = { style: 'medium' };
                        
                        if (rowIndex === 0 && c >= 3 && c % 2 === 1) {
                            const logIndex = (c - 3) / 2;
                            const s = sessions[logIndex];
                            if (s && s.campaign_id && s.campaign_name) {
                                const { bgHex, colorHex } = getCampaignStyle(s.campaign_name);
                                if (bgHex) {
                                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgHex } };
                                    cell.font = { color: { argb: colorHex } };
                                }
                            }
                        }

                        if (rowIndex === 1 && c >= 3 && c % 2 === 1) {
                            const logIndex = (c - 3) / 2;
                            const s = sessions[logIndex];
                            if (s && isTakenInPreviousYear(s.in, s.out, rangeStart)) {
                                cell.font = { color: { argb: 'FF1976D2' }, bold: true };
                            }
                        }
                    }
                });

                if (isOld) {
                    const c = r1.getCell(2);
                    c.font = { color: { argb: 'FFFF0000' }, bold: true };
                    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFDE7' } };
                }
            });

            const f1 = sheet.addRow(['*Заповнюючи новий бланк, познач у цій колонці останню дату опрацювання кожної території.']);
            sheet.mergeCells(f1.number, 1, f1.number, totalCols);
            f1.getCell(1).font = { italic: true, size: 9 };
            
            const f2 = sheet.addRow(['S-13-K 1/22']);
            sheet.mergeCells(f2.number, 1, f2.number, totalCols);
            f2.getCell(1).font = { bold: true, size: 10 };

            if (items.length > 0) {
                const startRow = 7;
                const rowsPerParcel = 2;
                const parcelsPerPage = 25;
                
                let currentRow = startRow;
                let remainingParcels = items.length;
                
                while (remainingParcels > 0) {
                    let parcelsOnPage = Math.min(remainingParcels, parcelsPerPage);
                    if (parcelsOnPage < remainingParcels) {
                        const breakRow = currentRow + (parcelsOnPage * rowsPerParcel);
                        if (!sheet.pageBreaks) sheet.pageBreaks = [];
                        sheet.pageBreaks.push(breakRow);
                    }
                    currentRow += parcelsOnPage * rowsPerParcel;
                    remainingParcels -= parcelsOnPage;
                }
            }
        }

        await buildExcelSheet('city', 'Місто', 4);
        await buildExcelSheet('village', 'Села', 3);

        setStatus("Збереження...");
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `S-13_Export_${serviceYearText.replace('/','-')}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        setStatus("✅ Успішно!");
        setTimeout(() => statusDiv.remove(), 3000);

    } catch (err) {
        setStatus(`Помилка: ${err.message}`, true);
        console.error(err);
    }
}

// Глобальний доступ
window.renderS13TableGrid = renderS13TableGrid;
window.exportS13FullPDF = exportS13FullPDF;
window.exportS13Excel = exportS13Excel;
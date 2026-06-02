// Об'єднаний модуль експорту звіту S-13 (PDF та Excel)
// Містить функції для експорту територіальних звітів у різні формати

// ============================================
// ФУНКЦІЯ ЕКСПОРТУ В PDF
// ============================================
async function exportS13FullPDF() {
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
        const now = new Date();
        const currentYear = now.getFullYear();
        const rangeStart = (now.getMonth() >= 8) ? new Date(currentYear, 8, 1) : new Date(currentYear - 1, 8, 1);
        const rangeStartISO = rangeStart.toISOString();
        const serviceYear = (now.getMonth() >= 8) ? `${currentYear}/${currentYear + 1}` : `${currentYear - 1}/${currentYear}`;

        progressDiv.innerHTML = "<b>Завантаження даних...</b>";

        const [{ data: allParcels }, { data: allLogs }] = await Promise.all([
            supabase.from('parcels').select('*'),
            supabase.from('territory_logs')
                .select('parcel_id, publisher_name, taken_at, returned_at, campaign_id, campaign_name')
                .or(`taken_at.gte.${rangeStartISO},returned_at.gte.${rangeStartISO}`)
                .order('taken_at', { ascending: true })
        ]);

        const dateOptions = { day: '2-digit', month: '2-digit', year: '2-digit' };

        // --- Допоміжна функція для генерації PDF конкретної категорії ---
        async function generateS13PdfForCategory(categoryParcels, categoryName, updateProgress) {
            if (categoryParcels.length === 0) {
                updateProgress(`Немає дільниць для категорії "${categoryName}". Пропускаємо.`);
                return;
            }

            updateProgress(`🔍 Збір даних для "${categoryName}"...`);

            const combinedData = {};
            categoryParcels.forEach(p => {
                const pLogs = allLogs.filter(log => log.parcel_id === p.id).map(log => ({
                    publisher_name: log.publisher_name,
                    taken_at: log.taken_at,
                    returned_at: log.returned_at,
                    campaign_id: log.campaign_id,
                    campaign_name: log.campaign_name
                }));

                if (p.status === 'taken' && p.taken_by) {
                    const alreadyInLogs = pLogs.some(l => !l.returned_at && l.publisher_name === p.taken_by);
                    if (!alreadyInLogs) {
                        pLogs.push({
                            publisher_name: p.taken_by,
                            taken_at: p.taken_at,
                            returned_at: null,
                            campaign_id: null,
                            campaign_name: null
                        });
                    }
                }
                combinedData[p.id] = pLogs;
            });

            if (categoryName === 'Місто') {
                categoryParcels.sort((a, b) => {
                    const numA = parseInt(a.name.replace(/\D/g, '')) || 0;
                    const numB = parseInt(b.name.replace(/\D/g, '')) || 0;
                    return numA - numB;
                });
            } else {
                categoryParcels.sort((a, b) => a.name.localeCompare(b.name, 'uk', { numeric: true }));
            }
            
            function generateRowsHTML(parcelsSlice) {
                let html = '';
                parcelsSlice.forEach(parcel => {
                    const parcelName = parcel.name;
                    const pLogs = combinedData[parcel.id] || [];
                    
                    const lastProcDate = parcel.last_processed ? new Date(parcel.last_processed) : null;
                    const lastProcessedText = (lastProcDate && lastProcDate < rangeStart) 
                        ? lastProcDate.toLocaleDateString('uk-UA', dateOptions) 
                        : '—';

                    let logCells = '';
                    const logColumnsCount = (categoryName === 'Села') ? 3 : 4; 
                    for (let j = 0; j < logColumnsCount; j++) {
                        const log = pLogs[j];
                        const dIn = log ? new Date(log.taken_at).toLocaleDateString('uk-UA', dateOptions) : '';
                        const dOut = (log && log.returned_at) 
                            ? new Date(log.returned_at).toLocaleDateString('uk-UA', dateOptions) 
                            : '';
                        
                        let campaignStyle = '';
                        if (log && log.campaign_id && log.campaign_name) {
                            if (log.campaign_name.toLowerCase().includes('конгрес')) {
                                campaignStyle = 'background-color: rgba(233, 196, 106, 0.5); color: #5C4B1B;';
                            } else if (log.campaign_name.toLowerCase().includes('спец. кампанія') || log.campaign_name.toLowerCase().includes('спеціальна')) {
                                campaignStyle = 'background-color: rgba(255, 205, 178, 0.5); color: #6D4C41;';
                            } else if (log.campaign_name.toLowerCase().includes('спомин')) {
                                campaignStyle = 'background-color: rgba(178, 185, 173, 0.5); color: #2F3E30;';
                            }
                        }
                        
                        logCells += `
                            <td style="border:1.5px solid black; height:36px; width:135px; text-align:center; padding:0; box-sizing:border-box;">
                                <div style="height:18px; border-bottom:1px solid black; font-size:10pt; line-height:18px; overflow:hidden; white-space:nowrap; padding: 0 2px; ${campaignStyle}">
                                    ${log ? log.publisher_name : ''}
                                </div>
                                <div style="display:flex; height:18px; line-height:18px; font-size:9pt;">
                                    <div style="flex:1;">${dIn}</div>
                                    <div style="flex:1; border-left:1px solid black;">${dOut}</div>
                                </div>
                            </td>`;
                    }
                    html += `<tr style="height:36px;">
                        <td style="border:1.5px solid black; text-align:center; font-size:9pt; width:${categoryName === 'Села' ? '75px' : '35px'};">${parcelName}</td>
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

            while (currentParcelIndex < categoryParcels.length) {
                const isFirst = pages.length === 0;
                const count = isFirst ? firstPageLimit : nextPageLimit;
                
                pages.push({ 
                    startIndex: currentParcelIndex, 
                    endIndex: Math.min(currentParcelIndex + count, categoryParcels.length) 
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
                const parcelsForPage = categoryParcels.slice(pageConfig.startIndex, pageConfig.endIndex);
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
                            <tbody>${generateRowsHTML(parcelsForPage)}</tbody>
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

            pdf.save(`S-13_${categoryName}_${serviceYear}.pdf`);
            tempContainer.remove();
        }

        const cityParcels = allParcels.filter(p => p.category !== 'Село');
        const villageParcels = allParcels.filter(p => p.category === 'Село');

        const updateProgress = (message) => {
            progressDiv.innerHTML = `<b>${message}</b>`;
        };

        await generateS13PdfForCategory(cityParcels, 'Місто', updateProgress);
        await generateS13PdfForCategory(villageParcels, 'Села', updateProgress);
        
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

    if (typeof supabase === 'undefined') {
        setStatus("Supabase не знайдено!", true);
        return;
    }

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

        const now = new Date();
        const startYear = (now.getMonth() >= 8) ? now.getFullYear() : now.getFullYear() - 1;
        const rangeStart = new Date(startYear, 8, 1);
        const rangeStartISO = rangeStart.toISOString();
        const serviceYearText = `${startYear}/${(startYear + 1).toString().slice(-2)}`;

        setStatus("Отримання даних...");
        const [{ data: rawParcels }, { data: logs }] = await Promise.all([
            supabase.from('parcels').select('*'),
            supabase.from('territory_logs')
                .select('parcel_id, publisher_name, taken_at, returned_at, campaign_id, campaign_name')
                .or(`taken_at.gte.${rangeStartISO},returned_at.gte.${rangeStartISO}`)
                .order('taken_at', { ascending: true })
        ]);

        const workbook = new ExcelJS.Workbook();

        // --- ЛИСТ МІСТО ---
        const cityParcels = rawParcels.filter(p => p.category !== 'Село');
        const parcelsForCity = cityParcels.sort((a, b) => (parseInt(a.name) || 0) - (parseInt(b.name) || 0));
        const citySheet = workbook.addWorksheet('Місто');
        citySheet.pageSetup = {
            paperSize: 9,
            orientation: 'portrait',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            margins: { left: 0.5, right: 0.5, top: 0.55, bottom: 0.5, header: 0.3, footer: 0.3 },
            horizontalCentered: true,
            printTitlesRow: '5:6'
        };

        citySheet.columns = [
            { width: 6 }, { width: 12 }, 
            { width: 10 }, { width: 12 }, { width: 10 }, { width: 12 },
            { width: 10 }, { width: 12 }, { width: 10 }, { width: 12 }
        ];

        citySheet.mergeCells('A1:J1');
        const cityTitle = citySheet.getCell('A1');
        cityTitle.value = 'ЗАПИСИ ПРО ОПРАЦЮВАННЯ ТЕРИТОРІЙ (Міто)';
        cityTitle.font = { bold: true, size: 16 };
        cityTitle.alignment = { horizontal: 'center', vertical: 'middle' };

        citySheet.mergeCells('A2:C2');
        citySheet.getCell('A2').value = `Службовий рік: ${serviceYearText}`;
        citySheet.getCell('A2').font = { bold: true };

        const legendRow = citySheet.addRow(['Легенда:', '', 'Конгрес', '', 'Спец. кампанія', '', 'Спомин', '', '']);
        legendRow.getCell(1).font = { bold: true, size: 9 };
        legendRow.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE9C46A' } };
        legendRow.getCell(3).font = { size: 8 };
        legendRow.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCDB2' } };
        legendRow.getCell(5).font = { size: 8 };
        legendRow.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB2B9AD' } };
        legendRow.getCell(7).font = { size: 8 };

        citySheet.addRow([]);
        citySheet.addRow(['№ Тер.', 'Остання дата опрацювання*', 'Вісник', '', 'Вісник', '', 'Вісник', '', 'Вісник', '']);
        citySheet.addRow(['', '', 'Дата отримання', 'Дата опрацювання', 'Дата отримання', 'Дата опрацювання', 'Дата отримання', 'Дата опрацювання', 'Дата отримання', 'Дата опрацювання']);

        [5, 6].forEach(rNum => {
            citySheet.getRow(rNum).eachCell(cell => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
                cell.border = { top: {style:'medium'}, left: {style:'medium'}, bottom: {style:'medium'}, right: {style:'medium'} };
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                cell.font = { size: 9, bold: true };
            });
        });

        citySheet.mergeCells('A5:A6'); citySheet.mergeCells('B5:B6');
        citySheet.mergeCells('C5:D5'); citySheet.mergeCells('E5:F5');
        citySheet.mergeCells('G5:H5'); citySheet.mergeCells('I5:J5');

        parcelsForCity.forEach(p => {
            let pLogs = logs.filter(l => l.parcel_id === p.id);
            if (p.status === 'taken' && p.taken_by) {
                if (!pLogs.some(l => !l.returned_at && l.publisher_name === p.taken_by)) {
                    pLogs.push({ publisher_name: p.taken_by, taken_at: p.taken_at, returned_at: null, campaign_id: null, campaign_name: null });
                }
            }

            const lastProc = p.last_processed ? new Date(p.last_processed) : null;
            const isOld = lastProc && lastProc < rangeStart;

            const r1 = citySheet.addRow([
                parseInt(p.name) || p.name, 
                isOld ? lastProc.toLocaleDateString('uk-UA') : '—',
                pLogs[0]?.publisher_name || '', '',
                pLogs[1]?.publisher_name || '', '',
                pLogs[2]?.publisher_name || '', '',
                pLogs[3]?.publisher_name || '', ''
            ]);
            
            const dRowData = ['', ''];
            for(let i=0; i<4; i++) {
                const l = pLogs[i];
                dRowData.push(l ? new Date(l.taken_at).toLocaleDateString('uk-UA', {day:'2-digit', month:'2-digit'}) : '');
                dRowData.push((l && l.returned_at) ? new Date(l.returned_at).toLocaleDateString('uk-UA', {day:'2-digit', month:'2-digit'}) : '');
            }
            const r2 = citySheet.addRow(dRowData);

            citySheet.mergeCells(r1.number, 1, r2.number, 1);
            citySheet.mergeCells(r1.number, 2, r2.number, 2);
            citySheet.mergeCells(r1.number, 3, r1.number, 4);
            citySheet.mergeCells(r1.number, 5, r1.number, 6);
            citySheet.mergeCells(r1.number, 7, r1.number, 8);
            citySheet.mergeCells(r1.number, 9, r1.number, 10);

            [r1, r2].forEach((row, rowIndex) => {
                for (let c = 1; c <= 10; c++) {
                    const cell = row.getCell(c);
                    cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    if (rowIndex === 0) cell.border.top = { style: 'medium' };
                    if (rowIndex === 1) cell.border.bottom = { style: 'medium' };
                    if (c === 1) cell.border.left = { style: 'medium' };
                    if (c === 10) cell.border.right = { style: 'medium' };
                    if (c === 2 || c === 4 || c === 6 || c === 8) cell.border.right = { style: 'medium' };
                    if (c === 3 || c === 5 || c === 7 || c === 9) cell.border.left = { style: 'medium' };
                    
                    if (rowIndex === 0 && (c === 3 || c === 5 || c === 7 || c === 9)) {
                        const logIndex = Math.floor((c - 3) / 2);
                        const log = pLogs[logIndex];
                        if (log && log.campaign_id && log.campaign_name) {
                            if (log.campaign_name.toLowerCase().includes('конгрес')) {
                                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE9C46A' } };
                                cell.font = { color: { argb: 'FF5C4B1B' } };
                            } else if (log.campaign_name.toLowerCase().includes('спец. кампанія') || log.campaign_name.toLowerCase().includes('спеціальна')) {
                                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCDB2' } };
                                cell.font = { color: { argb: 'FF6D4C41' } };
                            } else if (log.campaign_name.toLowerCase().includes('спомин')) {
                                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB2B9AD' } };
                                cell.font = { color: { argb: 'FF2F3E30' } };
                            }
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

        const cityF1 = citySheet.addRow(['*Заповнюючи новий бланк, познач у цій колонці останню дату опрацювання кожної території.']);
        citySheet.mergeCells(cityF1.number, 1, cityF1.number, 10);
        cityF1.getCell(1).font = { italic: true, size: 9 };
        const cityF2 = citySheet.addRow(['S-13-K 1/22']);
        citySheet.mergeCells(cityF2.number, 1, cityF2.number, 10);
        cityF2.getCell(1).font = { bold: true, size: 10 };

        const cityParcelCount = parcelsForCity.length;
        if (cityParcelCount > 0) {
            const startRow = 7;
            const rowsPerParcel = 2;
            const parcelsPerPage = 25;
            
            let currentRow = startRow;
            let remainingParcels = cityParcelCount;
            let pageCount = 1;
            
            while (remainingParcels > 0) {
                let parcelsOnPage;
                if (pageCount === 1) {
                    parcelsOnPage = Math.min(remainingParcels, parcelsPerPage);
                } else {
                    parcelsOnPage = Math.min(remainingParcels, parcelsPerPage);
                }
                
                if (parcelsOnPage < remainingParcels) {
                    const breakRow = currentRow + (parcelsOnPage * rowsPerParcel);
                    if (!citySheet.pageBreaks) citySheet.pageBreaks = [];
                    citySheet.pageBreaks.push(breakRow);
                }
                
                currentRow += parcelsOnPage * rowsPerParcel;
                remainingParcels -= parcelsOnPage;
                pageCount++;
            }
        }

        // --- ЛИСТ СЕЛО ---
        const villageParcels = rawParcels.filter(p => p.category === 'Село');
        const parcelsForVillage = villageParcels.sort((a, b) => a.name.localeCompare(b.name));

        if (parcelsForVillage.length > 0) {
            const villageSheet = workbook.addWorksheet('Села');
            villageSheet.pageSetup = {
                paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
                margins: { left: 0.5, right: 0.5, top: 0.55, bottom: 0.39, header: 0.3, footer: 0.3 },
                horizontalCentered: true,
                printTitlesRow: '5:6'
            };

            villageSheet.columns = [
                { width: 12 },
                { width: 12 },
                { width: 10 }, { width: 12 },
                { width: 10 }, { width: 12 },
                { width: 10 }, { width: 12 }
            ];
            const totalVillageColumns = 8;

            villageSheet.mergeCells('A1:H1');
            const villageTitle = villageSheet.getCell('A1');
            villageTitle.value = 'ЗАПИСИ ПРО ОПРАЦЮВАННЯ ТЕРИТОРІЙ (Села)';
            villageTitle.font = { bold: true, size: 16 };
            villageTitle.alignment = { horizontal: 'center', vertical: 'middle' };

            villageSheet.mergeCells('A2:C2');
            villageSheet.getCell('A2').value = `Службовий рік: ${serviceYearText}`;
            villageSheet.getCell('A2').font = { bold: true };

            const villageLegendRow = villageSheet.addRow(['Легенда кампаній:', 'Конгрес', '', 'Спец. кампанія', '', 'Спомин', '', '']);
            villageLegendRow.getCell(1).font = { bold: true, size: 9 };
            villageLegendRow.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE9C46A' } };
            villageLegendRow.getCell(2).font = { size: 8 };
            villageLegendRow.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCDB2' } };
            villageLegendRow.getCell(4).font = { size: 8 };
            villageLegendRow.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB2B9AD' } };
            villageLegendRow.getCell(6).font = { size: 8 };

            villageSheet.addRow([]);
            villageSheet.addRow(['Назва тер.', 'Остання дата опрацювання*', 'Вісник', '', 'Вісник', '', 'Вісник', '']);
            villageSheet.addRow(['', '', 'Дата отримання', 'Дата опрацювання', 'Дата отримання', 'Дата опрацювання', 'Дата отримання', 'Дата опрацювання']);

            [5, 6].forEach(rNum => {
                villageSheet.getRow(rNum).eachCell(cell => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
                    cell.border = { top: {style:'medium'}, left: {style:'medium'}, bottom: {style:'medium'}, right: {style:'medium'} };
                    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                    cell.font = { size: 9, bold: true };
                });
            });

            villageSheet.mergeCells('A5:A6'); villageSheet.mergeCells('B5:B6');
            villageSheet.mergeCells('C5:D5'); villageSheet.mergeCells('E5:F5'); villageSheet.mergeCells('G5:H5');

            parcelsForVillage.forEach(p => {
                let pLogs = logs.filter(l => l.parcel_id === p.id);
                if (p.status === 'taken' && p.taken_by) {
                    if (!pLogs.some(l => !l.returned_at && l.publisher_name === p.taken_by)) {
                        pLogs.push({ publisher_name: p.taken_by, taken_at: p.taken_at, returned_at: null, campaign_id: null, campaign_name: null });
                    }
                }

                const lastProc = p.last_processed ? new Date(p.last_processed) : null;
                const isOld = lastProc && lastProc < rangeStart;

                const r1 = villageSheet.addRow([
                    p.name,
                    isOld ? lastProc.toLocaleDateString('uk-UA') : '—',
                    pLogs[0]?.publisher_name || '', '',
                    pLogs[1]?.publisher_name || '', '',
                    pLogs[2]?.publisher_name || '', ''
                ]);

                const dRowData = ['', ''];
                for(let i=0; i<3; i++) {
                    const l = pLogs[i];
                    dRowData.push(l ? new Date(l.taken_at).toLocaleDateString('uk-UA', {day:'2-digit', month:'2-digit'}) : '');
                    dRowData.push((l && l.returned_at) ? new Date(l.returned_at).toLocaleDateString('uk-UA', {day:'2-digit', month:'2-digit'}) : '');
                }
                const r2 = villageSheet.addRow(dRowData);

                villageSheet.mergeCells(r1.number, 1, r2.number, 1);
                villageSheet.mergeCells(r1.number, 2, r2.number, 2);
                villageSheet.mergeCells(r1.number, 3, r1.number, 4);
                villageSheet.mergeCells(r1.number, 5, r1.number, 6);
                villageSheet.mergeCells(r1.number, 7, r1.number, 8);

                [r1, r2].forEach((row, rowIndex) => {
                    for (let c = 1; c <= 8; c++) {
                        const cell = row.getCell(c);
                        cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
                        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                        if (rowIndex === 0) cell.border.top = { style: 'medium' };
                        if (rowIndex === 1) cell.border.bottom = { style: 'medium' };
                        if (c === 1) cell.border.left = { style: 'medium' };
                        if (c === 8) cell.border.right = { style: 'medium' };
                        if (c === 2 || c === 4 || c === 6) cell.border.right = { style: 'medium' };
                        if (c === 3 || c === 5 || c === 7) cell.border.left = { style: 'medium' };
                        
                        if (rowIndex === 0 && (c === 3 || c === 5 || c === 7)) {
                            const logIndex = Math.floor((c - 3) / 2);
                            const log = pLogs[logIndex];
                            if (log && log.campaign_id && log.campaign_name) {
                                if (log.campaign_name.toLowerCase().includes('конгрес')) {
                                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE9C46A' } };
                                    cell.font = { color: { argb: 'FF5C4B1B' } };
                                } else if (log.campaign_name.toLowerCase().includes('спец. кампанія') || log.campaign_name.toLowerCase().includes('спеціальна')) {
                                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCDB2' } };
                                    cell.font = { color: { argb: 'FF6D4C41' } };
                                } else if (log.campaign_name.toLowerCase().includes('спомин')) {
                                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB2B9AD' } };
                                    cell.font = { color: { argb: 'FF2F3E30' } };
                                }
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

            const villageF1 = villageSheet.addRow(['*Заповнюючи новий бланк, познач у цій колонці останню дату опрацювання кожної території.']);
            villageSheet.mergeCells(villageF1.number, 1, villageF1.number, 8);
            villageF1.getCell(1).font = { italic: true, size: 9 };
            const villageF2 = villageSheet.addRow(['S-13-K 1/22']);
            villageSheet.mergeCells(villageF2.number, 1, villageF2.number, 8);
            villageF2.getCell(1).font = { bold: true, size: 10 };

            const villageParcelCount = parcelsForVillage.length;
            if (villageParcelCount > 0) {
                const startRow = 7;
                const rowsPerParcel = 2;
                const parcelsPerPage = 25;
                
                let currentRow = startRow;
                let remainingParcels = villageParcelCount;
                let pageCount = 1;
                
                while (remainingParcels > 0) {
                    let parcelsOnPage;
                    if (pageCount === 1) {
                        parcelsOnPage = Math.min(remainingParcels, parcelsPerPage);
                    } else {
                        parcelsOnPage = Math.min(remainingParcels, parcelsPerPage);
                    }
                    
                    if (parcelsOnPage < remainingParcels) {
                        const breakRow = currentRow + (parcelsOnPage * rowsPerParcel);
                        if (!villageSheet.pageBreaks) villageSheet.pageBreaks = [];
                        villageSheet.pageBreaks.push(breakRow);
                    }
                    
                    currentRow += parcelsOnPage * rowsPerParcel;
                    remainingParcels -= parcelsOnPage;
                    pageCount++;
                }
            }
        }

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

// Робимо функції доступними глобально
window.exportS13FullPDF = exportS13FullPDF;
window.exportS13Excel = exportS13Excel;

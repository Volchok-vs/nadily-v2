(async function() {
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
                .select('parcel_id, publisher_name, taken_at, returned_at')
                .or(`taken_at.gte.${rangeStartISO},returned_at.gte.${rangeStartISO}`)
                .order('taken_at', { ascending: true })
        ]);

        const workbook = new ExcelJS.Workbook();

        // --- ЛИСТ МІСТО ---
        const cityParcels = rawParcels.filter(p => p.category !== 'Село');
        const parcelsForCity = cityParcels.sort((a, b) => (parseInt(a.name) || 0) - (parseInt(b.name) || 0));
        const citySheet = workbook.addWorksheet('Місто');
        citySheet.pageSetup = {
            paperSize: 9,          // A4
            orientation: 'portrait',
            fitToPage: true,       // Увімкнути масштабування
            fitToWidth: 1,         // Вмістити всі стовпці в 1 сторінку по ширині
            fitToHeight: 0,        // Висота довільна
            margins: { left: 0.5, right: 0.5, top: 0.55, bottom: 0.39, header: 0.3, footer: 0.3 },
            horizontalCentered: true // ДОДАНО: Центрування по горизонталі
        };

        citySheet.columns = [
            { width: 6 }, { width: 11 }, 
            { width: 9 }, { width: 11 }, { width: 9 }, { width: 11 },
            { width: 9 }, { width: 11 }, { width: 9 }, { width: 11 }
        ];

        citySheet.mergeCells('A1:J1');
        const cityTitle = citySheet.getCell('A1');
        cityTitle.value = 'ЗАПИСИ ПРО ОПРАЦЮВАННЯ ТЕРИТОРІЙ (Місто)';
        cityTitle.font = { bold: true, size: 16 };
        cityTitle.alignment = { horizontal: 'center', vertical: 'middle' };

        citySheet.mergeCells('A2:C2');
        citySheet.getCell('A2').value = `Службовий рік: ${serviceYearText}`;
        citySheet.getCell('A2').font = { bold: true };

        citySheet.addRow(['№ Тер.', 'Остання дата опрацювання*', 'Вісник', '', 'Вісник', '', 'Вісник', '', 'Вісник', '']);
        citySheet.addRow(['', '', 'Дата отримання', 'Дата опрацювання', 'Дата отримання', 'Дата опрацювання', 'Дата отримання', 'Дата опрацювання', 'Дата отримання', 'Дата опрацювання']);

        [3, 4].forEach(rNum => {
            citySheet.getRow(rNum).eachCell(cell => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
                cell.border = { top: {style:'medium'}, left: {style:'medium'}, bottom: {style:'medium'}, right: {style:'medium'} };
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                cell.font = { size: 9, bold: true };
            });
        });

        citySheet.mergeCells('A3:A4'); citySheet.mergeCells('B3:B4');
        citySheet.mergeCells('C3:D3'); citySheet.mergeCells('E3:F3');
        citySheet.mergeCells('G3:H3'); citySheet.mergeCells('I3:J3');

        parcelsForCity.forEach(p => {
            let pLogs = logs.filter(l => l.parcel_id === p.id);
            if (p.status === 'taken' && p.taken_by) {
                if (!pLogs.some(l => !l.returned_at && l.publisher_name === p.taken_by)) {
                    pLogs.push({ publisher_name: p.taken_by, taken_at: p.taken_at, returned_at: null });
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


        // --- ЛИСТ СЕЛО ---
        const villageParcels = rawParcels.filter(p => p.category === 'Село');
        const parcelsForVillage = villageParcels.sort((a, b) => a.name.localeCompare(b.name));

        if (parcelsForVillage.length > 0) {
            const villageSheet = workbook.addWorksheet('Села');
            villageSheet.pageSetup = {
                paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
                margins: { left: 0.5, right: 0.5, top: 0.55, bottom: 0.39, header: 0.3, footer: 0.3 },
                horizontalCentered: true // ДОДАНО: Центрування по горизонталі
            };

            // НАЛАШТУВАННЯ ШИРИНИ КОЛОНОК ДЛЯ СЕЛА (3 вісника, 8 колонок)
            villageSheet.columns = [
                { width: 12 }, // A: Назва тер. (Змінено з 15 на 12)
                { width: 11 }, // B: Остання дата опрацювання*
                { width: 9 }, { width: 11 }, // C, D: Вісник 1
                { width: 9 }, { width: 11 }, // E, F: Вісник 2
                { width: 9 }, { width: 11 }  // G, H: Вісник 3
            ];
            // Для футера, загальна кількість колонок буде 8 (A-H)
            const totalVillageColumns = 8;

            villageSheet.mergeCells('A1:H1');
            const villageTitle = villageSheet.getCell('A1');
            villageTitle.value = 'ЗАПИСИ ПРО ОПРАЦЮВАННЯ ТЕРИТОРІЙ (Села)';
            villageTitle.font = { bold: true, size: 16 };
            villageTitle.alignment = { horizontal: 'center', vertical: 'middle' };

            villageSheet.mergeCells('A2:C2');
            villageSheet.getCell('A2').value = `Службовий рік: ${serviceYearText}`;
            villageSheet.getCell('A2').font = { bold: true };

            villageSheet.addRow(['Назва тер.', 'Остання дата опрацювання*', 'Вісник', '', 'Вісник', '', 'Вісник', '']);
            villageSheet.addRow(['', '', 'Дата отримання', 'Дата опрацювання', 'Дата отримання', 'Дата опрацювання', 'Дата отримання', 'Дата опрацювання']);

            [3, 4].forEach(rNum => {
                villageSheet.getRow(rNum).eachCell(cell => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
                    cell.border = { top: {style:'medium'}, left: {style:'medium'}, bottom: {style:'medium'}, right: {style:'medium'} };
                    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                    cell.font = { size: 9, bold: true };
                });
            });

            villageSheet.mergeCells('A3:A4'); villageSheet.mergeCells('B3:B4');
            villageSheet.mergeCells('C3:D3'); villageSheet.mergeCells('E3:F3'); villageSheet.mergeCells('G3:H3');

            parcelsForVillage.forEach(p => {
                let pLogs = logs.filter(l => l.parcel_id === p.id);
                if (p.status === 'taken' && p.taken_by) {
                    if (!pLogs.some(l => !l.returned_at && l.publisher_name === p.taken_by)) {
                        pLogs.push({ publisher_name: p.taken_by, taken_at: p.taken_at, returned_at: null });
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
})();
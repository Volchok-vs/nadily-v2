(async function() {
    /**
     * ПОВНИЙ ЕКСПОРТ S-13 В EXCEL (Запуск через Консоль)
     */
    
    // 1. Створення плаваючого індикатора (плашка статусу)
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

    // 2. Перевірка оточення
    if (typeof supabase === 'undefined') {
        setStatus("Supabase не знайдено! Переконайтеся, що ви на сторінці адмінки.", true);
        return;
    }

    try {
        // 3. Завантаження бібліотеки ExcelJS (якщо немає)
        if (typeof ExcelJS === 'undefined') {
            setStatus("Завантаження ExcelJS бібліотеки...");
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.3.0/exceljs.min.js';
                script.onload = resolve;
                script.onerror = () => reject(new Error("Не вдалося завантажити бібліотеку з CDN"));
                document.head.appendChild(script);
            });
        }

        // 4. Розрахунок службового року
        const now = new Date();
        const startYear = (now.getMonth() >= 8) ? now.getFullYear() : now.getFullYear() - 1;
        const rangeStart = new Date(startYear, 8, 1);
        const rangeStartISO = rangeStart.toISOString();
        const serviceYearText = `${startYear}/${(startYear + 1).toString().slice(-2)}`;

        // 5. Отримання даних
        setStatus("Отримання даних із бази...");
        const [{ data: rawParcels }, { data: logs }] = await Promise.all([
            supabase.from('parcels').select('*'),
            supabase.from('territory_logs')
                .select('parcel_id, publisher_name, taken_at, returned_at')
                .or(`taken_at.gte.${rangeStartISO},returned_at.gte.${rangeStartISO}`)
                .order('taken_at', { ascending: true })
        ]);

        // 6. Числове сортування: 1, 2, 3... 10...
        setStatus("Сортування територій...");
        const parcels = rawParcels.sort((a, b) => (parseInt(a.name) || 0) - (parseInt(b.name) || 0));

        // 7. Формування Excel
        setStatus("Створення структури таблиці...");
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('S-13');

        sheet.columns = [
            { width: 8 }, { width: 16 }, 
            { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 },
            { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }
        ];

        // Заголовки (стиль як на скриншоті)
        sheet.mergeCells('A1:J1');
        const title = sheet.getCell('A1');
        title.value = 'ЗАПИСИ ПРО ОПРАЦЮВАННЯ ТЕРИТОРІЙ';
        title.font = { bold: true, size: 16 };
        title.alignment = { horizontal: 'center', vertical: 'middle' };

        sheet.mergeCells('A2:B2');
        sheet.getCell('A2').value = `Службовий рік: ${serviceYearText}`;
        sheet.getCell('A2').font = { bold: true };

        // Шапка (2 рядки)
        sheet.addRow(['№ Тер.', 'Остання дата опрацювання*', 'Вісник', '', 'Вісник', '', 'Вісник', '', 'Вісник', '']);
        sheet.addRow(['', '', 'Дата отримання', 'Дата опрацювання', 'Дата отримання', 'Дата опрацювання', 'Дата отримання', 'Дата опрацювання', 'Дата отримання', 'Дата опрацювання']);

        // Стилізація шапки
        [3, 4].forEach(rNum => {
            sheet.getRow(rNum).eachCell(cell => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
                cell.border = { top: {style:'medium'}, left: {style:'medium'}, bottom: {style:'medium'}, right: {style:'medium'} };
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                cell.font = { size: 9, bold: true };
            });
        });

        sheet.mergeCells('A3:A4'); sheet.mergeCells('B3:B4');
        sheet.mergeCells('C3:D3'); sheet.mergeCells('E3:F3');
        sheet.mergeCells('G3:H3'); sheet.mergeCells('I3:J3');

        // 8. Дані
        parcels.forEach(p => {
            let pLogs = logs.filter(l => l.parcel_id === p.id);
            if (p.status === 'taken' && p.taken_by) {
                if (!pLogs.some(l => !l.returned_at && l.publisher_name === p.taken_by)) {
                    pLogs.push({ publisher_name: p.taken_by, taken_at: p.taken_at, returned_at: null });
                }
            }

            const lastProc = p.last_processed ? new Date(p.last_processed) : null;
            const isOld = lastProc && lastProc < rangeStart;

            // Перший рядок (Прізвище)
            const r1 = sheet.addRow([
                parseInt(p.name) || p.name, 
                isOld ? lastProc.toLocaleDateString('uk-UA') : '—',
                pLogs[0]?.publisher_name || '', '',
                pLogs[1]?.publisher_name || '', '',
                pLogs[2]?.publisher_name || '', '',
                pLogs[3]?.publisher_name || '', ''
            ]);
            sheet.mergeCells(`C${r1.number}:D${r1.number}`);
            sheet.mergeCells(`E${r1.number}:F${r1.number}`);
            sheet.mergeCells(`G${r1.number}:H${r1.number}`);
            sheet.mergeCells(`I${r1.number}:J${r1.number}`);

            // Другий рядок (Дати)
            const dRowData = ['', ''];
            for(let i=0; i<4; i++) {
                const l = pLogs[i];
                dRowData.push(l ? new Date(l.taken_at).toLocaleDateString('uk-UA', {day:'2-digit', month:'2-digit'}) : '');
                dRowData.push((l && l.returned_at) ? new Date(l.returned_at).toLocaleDateString('uk-UA', {day:'2-digit', month:'2-digit'}) : '');
            }
            const r2 = sheet.addRow(dRowData);
            sheet.mergeCells(`A${r1.number}:A${r2.number}`);
            sheet.mergeCells(`B${r1.number}:B${r2.number}`);

            // Стиль клітинок
            [r1, r2].forEach(row => {
                row.eachCell(cell => {
                    cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                });
                if (isOld) {
                    const c = row.getCell(2);
                    c.font = { color: { argb: 'FFFF0000' }, bold: true };
                    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFDE7' } };
                }
            });
        });

        // 9. Футер
        sheet.addRow([]);
        const f1 = sheet.addRow(['*Заповнюючи новий бланк, познач у цій колонці останню дату опрацювання кожної території.']);
        sheet.mergeCells(`A${f1.number}:J${f1.number}`);
        f1.getCell(1).font = { italic: true, size: 9 };
        const f2 = sheet.addRow(['S-13-K 1/22']);
        sheet.mergeCells(`A${f2.number}:J${f2.number}`);
        f2.getCell(1).font = { bold: true, size: 10 };

        // 10. Експорт файлу
        setStatus("Завантаження файлу...");
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `S-13_Export_${serviceYearText.replace('/','-')}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        setStatus("✅ Успішно! Файл створено.");
        setTimeout(() => statusDiv.remove(), 3000);

    } catch (err) {
        setStatus(`Помилка: ${err.message}`, true);
        console.error(err);
    }
})();
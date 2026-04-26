async function exportS13StableVariant() {
    const progressDiv = document.createElement('div');
    progressDiv.style = "position:fixed;top:10px;left:50%;transform:translateX(-50%);background:#17a2b8;color:white;padding:12px 20px;border-radius:8px;z-index:10000;font-family:sans-serif;box-shadow:0 4px 10px rgba(0,0,0,0.2);";
    progressDiv.innerHTML = "<b>📊 Формування стабільного варіанта (23+25)...</b>";
    document.body.appendChild(progressDiv);

    try {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        let serviceYear = currentMonth >= 8 ? `${currentYear}/${currentYear + 1}` : `${currentYear - 1}/${currentYear}`;

        const [{ data: parcels }, { data: logs }] = await Promise.all([
            supabase.from('parcels').select('id, name, last_processed').order('name', { ascending: true }),
            supabase.from('territory_logs')
                .select('parcel_id, publisher_name, taken_at, returned_at')
                .gte('taken_at', '2025-09-01')
                .order('taken_at', { ascending: true })
        ]);

        const logsByParcel = {};
        logs.forEach(log => {
            if (!logsByParcel[log.parcel_id]) logsByParcel[log.parcel_id] = [];
            logsByParcel[log.parcel_id].push(log);
        });

        const dateOptions = { day: '2-digit', month: '2-digit', year: '2-digit' };

        function generateRows(start, count) {
            let rows = '';
            for (let i = start; i < start + count; i++) {
                if (i > 120) break;
                const parcel = parcels.find(p => p.name == i.toString());
                const pLogs = parcel ? (logsByParcel[parcel.id] || []) : [];
                const lastProcessedDate = parcel && parcel.last_processed 
                    ? new Date(parcel.last_processed).toLocaleDateString('uk-UA', dateOptions) 
                    : '';

                let logCells = '';
                for (let j = 0; j < 4; j++) {
                    const log = pLogs[j];
                    logCells += `
                        <td class="v-block">
                            <div class="name-row">${log ? log.publisher_name : ''}</div>
                            <div class="dates-row">
                                <div class="d-cell">${log ? new Date(log.taken_at).toLocaleDateString('uk-UA', dateOptions) : ''}</div>
                                <div class="d-cell inner-thin">${log?.returned_at ? new Date(log.returned_at).toLocaleDateString('uk-UA', dateOptions) : (log ? 'пр' : '')}</div>
                            </div>
                        </td>`;
                }
                rows += `<tr class="main-row"><td class="c-num">${i}</td><td class="c-last">${lastProcessedDate}</td>${logCells}</tr>`;
            }
            return rows;
        }

        // Стабільний розподіл: 1-ша стор (1-23), 2-га (24-48), 3-тя (49-73), 4-та (74-98), 5-та (99-120)
        const p1 = generateRows(1, 23);
        const p2 = generateRows(24, 25);
        const p3 = generateRows(49, 25);
        const p4 = generateRows(74, 25);
        const p5 = generateRows(99, 22);

        const printWin = window.open('', '_blank');
        printWin.document.write(`
            <html>
            <head>
                <title>S-13 ${serviceYear}</title>
                <style>
                    @media print { 
                        @page { size: A4 portrait; margin: 0.8cm 0.4cm 1.5cm 0.4cm; } 
                        thead { display: table-header-group; }
                        body { -webkit-print-color-adjust: exact; }
                        .page-break { page-break-after: always; }
                    }
                    
                    body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
                    .title { text-align: center; font-size: 16pt; font-weight: bold; margin: 10px 0 5px 0; text-transform: uppercase; }
                    .sub-title { font-size: 12pt; font-weight: bold; margin-bottom: 15px; margin-left: 5px; }
                    
                    table { width: 100%; border-collapse: collapse; table-layout: fixed; border: 2.5px solid black; }
                    th, td { border: 1px solid black; padding: 0; text-align: center; }
                    
                    .h-bg { background: #d9d9d9 !important; font-weight: normal; font-size: 11pt; height: 20px; }
                    .c-num { width: 28px; vertical-align: middle; font-size: 8pt; border-right: 1.5px solid black; }
                    .c-last { width: 68px; font-size: 7.5pt; vertical-align: middle; border-right: 2.5px solid black; }
                    .v-block { width: auto; height: 36px; border-right: 2.5px solid black; }
                    .v-block:last-child { border-right: none; }
                    
                    .name-row { height: 18px; border-bottom: 1px solid black; font-size: 10pt; line-height: 18px; overflow: hidden; white-space: nowrap; }
                    .dates-row { display: flex; height: 18px; line-height: 18px; font-size: 9pt; }
                    .d-cell { flex: 1; }
                    .inner-thin { border-left: 0.2px solid black; }

                    .footer { 
                        position: fixed; 
                        bottom: 0; 
                        width: 100%; 
                        left: 0;
                        background: white;
                        padding-left: 5px;
                    }
                    .footer-note { font-size: 8pt; text-align: left; margin: 0; }
                    .footer-id { font-size: 9pt; text-align: left; margin: 2px 0 5px 0; }
                </style>
            </head>
            <body>
                <div class="title">ЗАПИСИ ПРО ОПРАЦЮВАННЯ ТЕРИТОРІЙ</div>
                <div class="sub-title">Службовий рік: ${serviceYear}</div>
                
                <table>
                    <thead>
                        <tr class="h-bg">
                            <th rowspan="2" class="c-num" style="font-size:7pt">№<br>Тер.</th>
                            <th rowspan="2" class="c-last" style="font-size:7pt">Остання дата<br>опрацювання*</th>
                            <th>Вісник</th><th>Вісник</th><th>Вісник</th><th>Вісник</th>
                        </tr>
                        <tr class="h-bg">
                            <th style="font-size:9pt">Дата <br>отримання | опрацювання</th>
                            <th style="font-size:9pt">Дата <br>отримання | опрацювання</th>
                            <th style="font-size:9pt">Дата <br>отримання | опрацювання</th>
                            <th style="font-size:9pt">Дата <br>отримання | опрацювання</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${p1} <tr class="page-break"><td colspan="6" style="border:none"></td></tr>
                        ${p2} <tr class="page-break"><td colspan="6" style="border:none"></td></tr>
                        ${p3} <tr class="page-break"><td colspan="6" style="border:none"></td></tr>
                        ${p4} <tr class="page-break"><td colspan="6" style="border:none"></td></tr>
                        ${p5}
                    </tbody>
                </table>

                <div class="footer">
                    <p class="footer-note">*Заповнюючи новий бланк, познач у цій колонці останню дату опрацювання кожної території.</p>
                    <p class="footer-id">S-13-K 1/22</p>
                </div>
            </body>
            </html>
        `);
        printWin.document.close();
        progressDiv.innerHTML = "✅ Готово!";
        setTimeout(() => { printWin.print(); progressDiv.remove(); }, 500);

    } catch (err) {
        progressDiv.style.background = "#dc3545";
        progressDiv.innerHTML = "Помилка: " + err.message;
    }
}

exportS13StableVariant();
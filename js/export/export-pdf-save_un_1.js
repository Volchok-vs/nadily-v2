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

        progressDiv.innerHTML = "<b>🔍 Збір даних (без 'пр')...</b>";

        const { jsPDF } = window.jspdf;
        const now = new Date();
        const currentYear = now.getFullYear();
        const rangeStart = (now.getMonth() >= 8) ? new Date(currentYear, 8, 1) : new Date(currentYear - 1, 8, 1);
        const rangeStartISO = rangeStart.toISOString();
        const serviceYear = (now.getMonth() >= 8) ? `${currentYear}/${currentYear + 1}` : `${currentYear - 1}/${currentYear}`;

        const [{ data: parcels }, { data: logs }] = await Promise.all([
            supabase.from('parcels').select('*').order('name', { ascending: true }),
            supabase.from('territory_logs')
                .select('parcel_id, publisher_name, taken_at, returned_at')
                .or(`taken_at.gte.${rangeStartISO},returned_at.gte.${rangeStartISO}`)
                .order('taken_at', { ascending: true })
        ]);

        const combinedData = {};
        parcels.forEach(p => {
            const pLogs = logs.filter(log => log.parcel_id === p.id).map(log => ({
                publisher_name: log.publisher_name,
                taken_at: log.taken_at,
                returned_at: log.returned_at
            }));

            // Додаємо активну видачу
            if (p.status === 'taken' && p.taken_by) {
                const alreadyInLogs = pLogs.some(l => !l.returned_at && l.publisher_name === p.taken_by);
                if (!alreadyInLogs) {
                    pLogs.push({
                        publisher_name: p.taken_by,
                        taken_at: p.taken_at,
                        returned_at: null
                    });
                }
            }
            combinedData[p.id] = pLogs;
        });

        const dateOptions = { day: '2-digit', month: '2-digit', year: '2-digit' };

        function generateRowsHTML(start, count) {
            let html = '';
            for (let i = start; i < start + count; i++) {
                const parcelName = i.toString();
                const parcel = parcels.find(p => p.name == parcelName);
                if (!parcel && i > parcels.length) break;

                const pLogs = parcel ? (combinedData[parcel.id] || []) : [];
                
                // Червоний стовпчик: тільки якщо last_processed старіший за 1 вересня
                const lastProcDate = parcel?.last_processed ? new Date(parcel.last_processed) : null;
                const lastProcessedText = (lastProcDate && lastProcDate < rangeStart) 
                    ? lastProcDate.toLocaleDateString('uk-UA', dateOptions) 
                    : '—';

                let logCells = '';
                for (let j = 0; j < 4; j++) {
                    const log = pLogs[j];
                    const dIn = log ? new Date(log.taken_at).toLocaleDateString('uk-UA', dateOptions) : '';
                    
                    // ВИПРАВЛЕНО: Якщо returned_at немає, просто залишаємо порожньо (без "пр")
                    const dOut = (log && log.returned_at) 
                        ? new Date(log.returned_at).toLocaleDateString('uk-UA', dateOptions) 
                        : '';
                    
                    logCells += `
                        <td style="border:1.5px solid black; height:36px; width:135px; text-align:center; padding:0; box-sizing:border-box;">
                            <div style="height:18px; border-bottom:1px solid black; font-size:10pt; line-height:18px; overflow:hidden; white-space:nowrap; padding: 0 2px;">
                                ${log ? log.publisher_name : ''}
                            </div>
                            <div style="display:flex; height:18px; line-height:18px; font-size:9pt;">
                                <div style="flex:1;">${dIn}</div>
                                <div style="flex:1; border-left:1px solid black;">${dOut}</div>
                            </div>
                        </td>`;
                }
                html += `<tr style="height:36px;">
                    <td style="border:1.5px solid black; text-align:center; font-size:9pt; width:35px;">${parcelName}</td>
                    <td style="border:1.5px solid black; text-align:center; font-size:8.5pt; width:75px; background:#fffde7; ${lastProcessedText !== '—' ? 'color:red; font-weight:bold;' : ''}">
                        ${lastProcessedText}
                    </td>
                    ${logCells}
                </tr>`;
            }
            return html;
        }

        // --- Решта коду генерації PDF (цикл по сторінках, html2canvas) залишається без змін ---
        // (Для економії місця не дублюю технічну частину з попереднього повідомлення)
        
        const totalParcels = parcels.length > 0 ? Math.max(...parcels.map(p => parseInt(p.name) || 0)) : 120;
        const firstPageLimit = 23; 
        const nextPageLimit = 25; 
        let pages = [];
        let currentStart = 1;
        while (currentStart <= totalParcels) {
            const isFirst = pages.length === 0;
            const count = isFirst ? firstPageLimit : nextPageLimit;
            pages.push({ start: currentStart, count: count });
            currentStart += count;
        }

        const pdf = new jsPDF('p', 'mm', 'a4');
        const tempContainer = document.createElement('div');
        tempContainer.style = "position:absolute; left:-9999px; width:210mm;";
        document.body.appendChild(tempContainer);

        for (let i = 0; i < pages.length; i++) {
            progressDiv.innerHTML = `<b>📄 Сторінка ${i + 1} з ${pages.length}...</b>`;
            const config = pages[i];
            const pagePaddingTop = i === 0 ? "8mm" : "13mm";

            tempContainer.innerHTML = `
                <div id="page-render" style="padding:${pagePaddingTop} 10mm 10mm 10mm; background:white; width:210mm; min-height:297mm; display:block; box-sizing:border-box; font-family:Arial, sans-serif;">
                    ${i === 0 ? `
                        <div style="text-align:center; font-size:17pt; font-weight:bold; margin-bottom:15px;">ЗАПИСИ ПРО ОПРАЦЮВАННЯ ТЕРИТОРІЙ</div>
                        <div style="font-size:13pt; font-weight:bold; margin-bottom:15px; margin-left:5mm;">Службовий рік: <span style="border-bottom:1px solid black; padding:0 20px;">${serviceYear}</span></div>
                    ` : ''}
                    <table style="width:100%; border-collapse:collapse; border:2.5px solid black; table-layout:fixed;">
                        <thead>
                            <tr style="background:#eeeeee; height:46px;">
                                <th style="border:1.5px solid black; width:35px; font-size:8pt; padding:2px;">№<br>Тер.</th>
                                <th style="border:1.5px solid black; width:75px; font-size:8pt; padding:2px;">Остання дата<br>опрацювання*</th>
                                ${[1,2,3,4].map(() => `
                                    <th style="border:1.5px solid black; width:135px; padding:0;">
                                        <div style="font-size:10pt; height:18px; border-bottom:1.5px solid black; line-height:18px;">Вісник</div>
                                        <div style="display:flex; font-size:7pt; height:26px; line-height:9pt;">
                                            <div style="flex:1;">Дата<br>отримання</div>
                                            <div style="flex:1; border-left:1.5px solid black;">Дата<br>опрацювання</div>
                                        </div>
                                    </th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>${generateRowsHTML(config.start, config.count)}</tbody>
                    </table>
                    <div style="margin-top:3mm; padding-left:2mm;">
                        <p style="font-size:8pt; margin:0; line-height:1.2;">*Заповнюючи новий бланк, познач у цій колонці останню дату опрацювання кожної території.</p>
                        <p style="font-size:9.5pt; margin:3px 0 0 0; font-weight:bold;">S-13-K 1/22</p>
                    </div>
                </div>`;

            const canvas = await html2canvas(tempContainer.querySelector('#page-render'), { 
                scale: 2, useCORS: true, windowWidth: 794 
            });
            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            if (i > 0) pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
        }

        pdf.save(`S-13_Report_${serviceYear}.pdf`);
        tempContainer.remove();
        progressDiv.style.background = "#28a745";
        progressDiv.innerHTML = "✅ PDF успішно створено!";
        setTimeout(() => progressDiv.remove(), 2500);

    } catch (err) {
        console.error(err);
        progressDiv.style.background = "#dc3545";
        progressDiv.innerHTML = "❌ Помилка: " + err.message;
        setTimeout(() => progressDiv.remove(), 5000);
    }
}

exportS13FullPDF();
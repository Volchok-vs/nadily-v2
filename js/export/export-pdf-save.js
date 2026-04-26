async function exportS13FullPDF() {
    const scripts = [
        'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
    ];
    
    for (let src of scripts) {
        if (!document.querySelector(`script[src="${src}"]`)) {
            const s = document.createElement('script');
            s.src = src;
            document.head.appendChild(s);
            await new Promise(r => s.onload = r);
        }
    }

    const progressDiv = document.createElement('div');
    progressDiv.style = "position:fixed;top:10px;left:50%;transform:translateX(-50%);background:#17a2b8;color:white;padding:12px 20px;border-radius:8px;z-index:10000;font-family:sans-serif;box-shadow:0 4px 10px rgba(0,0,0,0.2);";
    progressDiv.innerHTML = "<b>🚀 Створення фінальної версії PDF...</b>";
    document.body.appendChild(progressDiv);

    try {
        const { jsPDF } = window.jspdf;
        const now = new Date();
        const serviceYear = now.getMonth() >= 8 ? `${now.getFullYear()}/${now.getFullYear() + 1}` : `${now.getFullYear() - 1}/${now.getFullYear()}`;

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

        function generateRowsHTML(start, count) {
            let html = '';
            for (let i = start; i < start + count; i++) {
                if (i > 120) break;
                const parcel = parcels.find(p => p.name == i.toString());
                const pLogs = parcel ? (logsByParcel[parcel.id] || []) : [];
                const lastProcessed = parcel?.last_processed ? new Date(parcel.last_processed).toLocaleDateString('uk-UA', dateOptions) : '';

                let logCells = '';
                for (let j = 0; j < 4; j++) {
                    const log = pLogs[j];
                    logCells += `
                        <td style="border:1.5px solid black; height:36px; width:135px; text-align:center; padding:0;">
                            <div style="height:18px; border-bottom:1px solid black; font-size:10pt; line-height:18px; overflow:hidden;">${log ? log.publisher_name : ''}</div>
                            <div style="display:flex; height:18px; line-height:18px; font-size:9pt;">
                                <div style="flex:1;">${log ? new Date(log.taken_at).toLocaleDateString('uk-UA', dateOptions) : ''}</div>
                                <div style="flex:1; border-left:1px solid black;">${log?.returned_at ? new Date(log.returned_at).toLocaleDateString('uk-UA', dateOptions) : (log ? 'пр' : '')}</div>
                            </div>
                        </td>`;
                }
                html += `<tr>
                    <td style="border:1.5px solid black; text-align:center; font-size:9pt;">${i}</td>
                    <td style="border:1.5px solid black; text-align:center; font-size:8.5pt; background:#fffde7;">${lastProcessed}</td>
                    ${logCells}
                </tr>`;
            }
            return html;
        }

        const pagesConfig = [
            { start: 1, count: 23 },
            { start: 24, count: 24 },
            { start: 48, count: 24 },
            { start: 72, count: 24 },
            { start: 96, count: 25 }
        ];

        const pdf = new jsPDF('p', 'mm', 'a4');
        const tempContainer = document.createElement('div');
        tempContainer.style = "position:absolute; left:-9999px; width:210mm;";
        document.body.appendChild(tempContainer);

        for (let i = 0; i < pagesConfig.length; i++) {
            const config = pagesConfig[i];
            const pagePaddingTop = i === 0 ? "8mm" : "13mm"; // Збільшили відступ для 2+ сторінок

            tempContainer.innerHTML = `
                <div id="page-render" style="padding:${pagePaddingTop} 5mm 10mm 5mm; background:white; min-height:297mm; display:flex; flex-direction:column; box-sizing:border-box; font-family:Arial, sans-serif;">
                    
                    ${i === 0 ? `
                        <div style="text-align:center; font-size:17pt; font-weight:bold; margin-bottom:5px;">ЗАПИСИ ПРО ОПРАЦЮВАННЯ ТЕРИТОРІЙ</div>
                        <div style="font-size:13pt; font-weight:bold; margin-bottom:15px; margin-left:5mm;">Службовий рік: <span style="border-bottom:1px solid black; padding:0 20px;">${serviceYear}</span></div>
                    ` : ''}
                    
                    <table style="width:100%; border-collapse:collapse; border:2.5px solid black; table-layout:fixed; flex-grow:1;">
                        <thead>
                            <tr style="background:#eeeeee; height:40px;">
                                <th style="border:1.5px solid black; width:35px; font-size:8pt; padding:2px;">№<br>Тер.</th>
                                <th style="border:1.5px solid black; width:75px; font-size:8pt; padding:2px;">Остання дата<br>опрацювання*</th>
                                ${[1,2,3,4].map(() => `
                                    <th style="border:1.5px solid black; width:135px; padding:0;">
                                        <div style="font-size:10pt; height:18px; border-bottom:1.5px solid black; line-height:18px;">Вісник</div>
                                        <div style="display:flex; font-size:7pt; height:22px; line-height:10px; align-items:center;">
                                            <div style="flex:1;">Дата<br>отримання</div>
                                            <div style="flex:1; border-left:1.5px solid black; height:100%; display:flex; align-items:center; justify-content:center;">Дата<br>опрацювання</div>
                                        </div>
                                    </th>
                                `).join('')}
                            </tr>
                        </thead>
                        <tbody>${generateRowsHTML(config.start, config.count)}</tbody>
                    </table>

                    <div style="margin-top:3mm; padding-left:2mm;">
                        <p style="font-size:8pt; margin:0; line-height:1.2;">*Заповнюючи новий бланк, познач у цій колонці останню дату опрацювання кожної території.</p>
                        <p style="font-size:9.5pt; margin:3px 0 0 0; font-weight:bold;">S-13-K 1/22</p>
                    </div>
                </div>
            `;

            const canvas = await html2canvas(tempContainer.querySelector('#page-render'), { scale: 2 });
            const imgData = canvas.toDataURL('image/jpeg', 1.0);
            if (i > 0) pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
        }

        pdf.save(`S-13_Report_Final_${serviceYear}.pdf`);
        tempContainer.remove();
        progressDiv.style.background = "#28a745";
        progressDiv.innerHTML = "✅ PDF готовий!";
        setTimeout(() => progressDiv.remove(), 2000);
    } catch (err) {
        progressDiv.style.background = "#dc3545";
        progressDiv.innerHTML = "Помилка: " + err.message;
    }
}

exportS13FullPDF();
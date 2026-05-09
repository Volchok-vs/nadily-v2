// import { supabase } from "./js/config.js"; // Закоментуйте, якщо запускаєте як окремий консольний скрипт
// import { supabase } from "../config.js"; // Розкоментуйте для окремого скрипта в папці js/
// Для роботи в консолі браузера, `supabase` має бути доступним глобально або імпортованим
// Якщо це окремий файл, переконайтесь, що `supabase` імпортований, наприклад, `import { supabase } from './config.js';`

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
            supabase.from('parcels').select('*'), // Завантажуємо всі дільниці
            supabase.from('territory_logs')
                .select('parcel_id, publisher_name, taken_at, returned_at')
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

            // Комбінуємо логи з дільницями для поточної категорії
            const combinedData = {};
            categoryParcels.forEach(p => {
                const pLogs = allLogs.filter(log => log.parcel_id === p.id).map(log => ({
                    publisher_name: log.publisher_name,
                    taken_at: log.taken_at,
                    returned_at: log.returned_at
                }));

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

            // Сортування дільниць: за номером для Міста, за назвою для Сіл
            if (categoryName === 'Місто') {
                categoryParcels.sort((a, b) => {
                    const numA = parseInt(a.name.replace(/\D/g, '')) || 0;
                    const numB = parseInt(b.name.replace(/\D/g, '')) || 0;
                    return numA - numB;
                });
            } else { // Для сіл сортуємо як текст
                categoryParcels.sort((a, b) => a.name.localeCompare(b.name, 'uk', { numeric: true }));
            }
            
            // Функція для генерації рядків таблиці
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
                    // Визначаємо кількість колонок логів залежно від категорії
                    const logColumnsCount = (categoryName === 'Села') ? 3 : 4; 
                    for (let j = 0; j < logColumnsCount; j++) {
                        const log = pLogs[j];
                        const dIn = log ? new Date(log.taken_at).toLocaleDateString('uk-UA', dateOptions) : '';
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
                        <td style="border:1.5px solid black; text-align:center; font-size:9pt; width:${categoryName === 'Села' ? '75px' : '35px'};">${parcelName}</td> <!-- Ширина залежить від категорії -->
                        <td style="border:1.5px solid black; text-align:center; font-size:8.5pt; width:75px; background:#fffde7; ${lastProcessedText !== '—' ? 'color:red; font-weight:bold;' : ''}">
                            ${lastProcessedText}
                        </td>
                        ${logCells}
                    </tr>`;
                });
                return html;
            }

            // Розрахунок кількості сторінок та елементів на сторінці
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
            tempContainer.style = "position:absolute; left:-9999px; width:210mm;"; // Ширина А4
            document.body.appendChild(tempContainer);

            for (let i = 0; i < pages.length; i++) {
                updateProgress(`📄 Генерація "${categoryName}" PDF: сторінка ${i + 1} з ${pages.length}...`);
                const pageConfig = pages[i];
                const parcelsForPage = categoryParcels.slice(pageConfig.startIndex, pageConfig.endIndex);
                const pagePaddingTop = i === 0 ? "8mm" : "13mm"; // Відступ зверху для першої сторінки

                // HTML для повної сторінки
                tempContainer.innerHTML = `
                    <div id="page-render" style="padding:${pagePaddingTop} 10mm 10mm 10mm; background:white; width:210mm; min-height:297mm; display:block; box-sizing:border-box; font-family:Arial, sans-serif;">
                        ${i === 0 ? `
                            <div style="text-align:center; font-size:17pt; font-weight:bold; margin-bottom:15px;">ЗАПИСИ ПРО ${categoryName.toUpperCase()} ТЕРИТОРІЙ</div>
                            <div style="font-size:13pt; font-weight:bold; margin-bottom:15px; margin-left:5mm;">Службовий рік: <span style="border-bottom:1px solid black; padding:0 20px;">${serviceYear}</span></div>
                        ` : ''}
                        <table style="width:100%; border-collapse:collapse; border:2.5px solid black; table-layout:fixed;">
                            <thead>
                                <tr style="background:#eeeeee; height:46px;">
                                    <!-- Заголовки -->
                                    <th style="border:1.5px solid black; width:${categoryName === 'Села' ? '75px' : '35px'}; font-size:8pt; padding:2px;">${categoryName === 'Села' ? 'Назва тер.' : '№ тер.'}</th> <!-- Заголовок залежить від категорії -->
                                    <th style="border:1.5px solid black; width:75px; font-size:8pt; padding:2px;">Остання дата<br>опрацювання*</th>
                                    
                                    <!-- Заголовки для вісників (динамічно залежно від кількості колонок) -->
                                    ${Array.from({ length: categoryName === 'Села' ? 3 : 4 }).map((_, k) => `
                                        <th style="border:1.5px solid black; width:135px; padding:0;">
                                            <div style="font-size:10pt; height:18px; border-bottom:1.5px solid black; line-height:18px;">Вісник</div> <!-- Завжди "Вісник" -->
                                            <div style="display:flex; font-size:7pt; height:26px; line-height:9pt;">
                                                <div style="flex:1;">Дата<br>отримання</div>
                                                <div style="flex:1; border-left:1.5px solid black;">Дата<br>опрацювання</div>
                                            </div>
                                        </th>`).join('')}
                                </tr>
                            </thead>
                            <tbody>${generateRowsHTML(parcelsForPage)}</tbody>
                        </table>
                        <div style="margin-top:3mm; padding-left:2mm;">
                            <p style="font-size:8pt; margin:0; line-height:1.2;">*Заповнюючи новий бланк, познач у цій колонці останню дату опрацювання кожної території.</p>
                            <p style="font-size:9.5pt; margin:3px 0 0 0; font-weight:bold;">S-13-K 1/22</p>
                        </div>
                    </div>`;

                // Рендеринг канвасу та додавання до PDF
                const canvas = await html2canvas(tempContainer.querySelector('#page-render'), { 
                    scale: 2, useCORS: true, windowWidth: 794 
                });
                const imgData = canvas.toDataURL('image/jpeg', 0.95);
                if (i > 0) pdf.addPage();
                pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297); // Розміри А4
            }

            pdf.save(`S-13_${categoryName}_${serviceYear}.pdf`); // Назва файлу без слова "Звіт"
            tempContainer.remove(); // Видаляємо тимчасовий контейнер
        }

        // --- Основна логіка експорту ---

        // Фільтруємо всі дільниці на Місто та Села
        const cityParcels = allParcels.filter(p => p.category !== 'Село');
        const villageParcels = allParcels.filter(p => p.category === 'Село');

        // Функція для оновлення повідомлень про прогрес
        const updateProgress = (message) => {
            progressDiv.innerHTML = `<b>${message}</b>`;
        };

        // Генерація PDF для Міста
        await generateS13PdfForCategory(cityParcels, 'Місто', updateProgress);
        // Генерація PDF для Сіл
        await generateS13PdfForCategory(villageParcels, 'Села', updateProgress);
        
        // Повідомлення про успішне завершення
        progressDiv.style.background = "#28a745";
        progressDiv.innerHTML = "✅ Всі PDF успішно створено!";
        setTimeout(() => progressDiv.remove(), 2500);

    } catch (err) {
        // Обробка помилок
        console.error(err);
        progressDiv.style.background = "#dc3545";
        progressDiv.innerHTML = "❌ Помилка: " + err.message;
        setTimeout(() => progressDiv.remove(), 5000);
    }
}

exportS13FullPDF();
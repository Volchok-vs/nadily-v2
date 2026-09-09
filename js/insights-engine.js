import { supabase } from './config.js';

window.generateTakenParcelsReportDirect = async function() {
    console.log("⏳ Отримання задіяних ділянок напряму з таблиці 'parcels'...");

    if (!supabase) {
        alert("Помилка: об'єкт 'supabase' не знайдено.");
        return;
    }

    try {
        const { data: parcels, error } = await supabase
            .from('parcels')
            .select('*')
            .eq('status', 'taken');

        if (error) throw error;

        if (!parcels || parcels.length === 0) {
            alert("Наразі немає ділянок зі статусом 'taken'.");
            return;
        }

        const rawTableData = parcels.map(p => {
            const rawDate = p.taken_at;
            const dateObj = rawDate ? new Date(rawDate) : null;
            const isValidDate = dateObj && !isNaN(dateObj.getTime());

            return {
                id: p.id,
                name: p.name || `Ділянка №${p.id}`,
                assignee: p.taken_by || "Не вказано",
                takenAtFormatted: isValidDate 
                    ? dateObj.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' }) 
                    : "—",
                takenTimestamp: isValidDate ? dateObj.getTime() : 0
            };
        });

        let reportOverlay = document.getElementById('reportModalOverlay');
        if (!reportOverlay) {
            reportOverlay = document.createElement('div');
            reportOverlay.id = 'reportModalOverlay';
            document.body.appendChild(reportOverlay);
        }

        reportOverlay.innerHTML = `
            <style>
                #reportModalOverlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: #f8fafc;
                    z-index: 99999;
                    overflow-y: auto;
                    padding: 16px;
                    box-sizing: border-box;
                    color: #1e293b;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                }
                .report-container { max-width: 900px; margin: 0 auto; }
                .report-header { 
                    display: flex; 
                    flex-wrap: wrap; 
                    gap: 12px; 
                    justify-content: space-between; 
                    align-items: center; 
                    background: #fff; 
                    padding: 16px 20px; 
                    border-radius: 12px; 
                    border: 1px solid #e2e8f0; 
                    margin-bottom: 20px; 
                    box-shadow: 0 1px 3px rgba(0,0,0,0.02); 
                }
                .back-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    background: #f1f5f9;
                    border: 1px solid #cbd5e1;
                    padding: 8px 14px;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 600;
                    color: #334155;
                    cursor: pointer;
                    transition: background 0.15s;
                }
                .back-btn:active { background: #e2e8f0; }
                .report-title { font-size: 18px; font-weight: 700; margin: 0; }
                .report-controls { display: flex; align-items: center; gap: 8px; font-size: 13px; }
                .report-controls select { padding: 6px 12px; border-radius: 6px; border: 1px solid #cbd5e1; background: #fff; font-size: 13px; cursor: pointer; }
                .report-table-wrapper { overflow-x: auto; }
                .report-table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
                .report-table th, .report-table td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
                .report-table th { background: #f1f5f9; font-weight: 600; color: #475569; }
                .empty { padding: 32px; text-align: center; color: #94a3b8; font-style: italic; }
            </style>
            <div class="report-container">
                <div class="report-header">
                    <button id="closeReportBtn" class="back-btn">← Назад</button>
                    <div>
                        <h1 class="report-title">📋 Ділянки на руках</h1>
                        <div id="count-info" style="font-size: 12px; color: #64748b; margin-top: 4px;">Завантаження...</div>
                    </div>
                    <div class="report-controls">
                        <label for="period">Період:</label>
                        <select id="period">
                            <option value="week" selected>За останній тиждень</option>
                            <option value="month">За останній місяць</option>
                            <option value="all">Усі на руках</option>
                        </select>
                    </div>
                </div>
                <div class="report-table-wrapper">
                    <table class="report-table">
                        <thead>
                            <tr>
                                <th style="width: 40%;">Назва ділянки</th>
                                <th style="width: 30%;">Дата отримання</th>
                                <th style="width: 30%;">Вісник</th>
                            </tr>
                        </thead>
                        <tbody id="table-body"></tbody>
                    </table>
                </div>
                <div id="empty-msg" class="empty" style="display: none;">За обраний період ділянок не знайдено.</div>
            </div>
        `;

        reportOverlay.style.display = 'block';

        const renderReport = function() {
            const period = document.getElementById('period').value;
            const tbody = document.getElementById('table-body');
            const emptyMsg = document.getElementById('empty-msg');
            const countInfo = document.getElementById('count-info');

            const now = Date.now();
            const ONE_DAY = 86400000;

            const filtered = rawTableData.filter(item => {
                if (period === 'all') return true;
                if (!item.takenTimestamp) return false;
                const diffDays = (now - item.takenTimestamp) / ONE_DAY;
                return period === 'week' ? diffDays <= 7 : diffDays <= 30;
            });

            tbody.innerHTML = '';
            if (filtered.length === 0) {
                emptyMsg.style.display = 'block';
            } else {
                emptyMsg.style.display = 'none';
                filtered.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><b>${item.name}</b></td>
                        <td>${item.takenAtFormatted}</td>
                        <td>${item.assignee}</td>
                    `;
                    tbody.appendChild(tr);
                });
            }
            countInfo.textContent = `Відображено: ${filtered.length} із ${rawTableData.length} ділянок`;
        };

        document.getElementById('period').addEventListener('change', renderReport);

        document.getElementById('closeReportBtn').addEventListener('click', () => {
            reportOverlay.style.display = 'none';
        });

        renderReport();

    } catch (err) {
        console.error("❌ Помилка виконання:", err);
        alert("Помилка виконання: " + err.message);
    }
};
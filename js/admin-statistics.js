import { supabase } from './config.js';

// Глобальні змінні для екземплярів графіків
let cityChartInstance = null;
let villageChartInstance = null;

// Перевірка автентифікації
async function checkAuth() {
    const userId = localStorage.getItem('userId');

    if (!userId) {
        console.warn('Користувач не авторизований');
        window.location.href = 'index.html';
        return;
    }

    document.getElementById('main-loader').style.display = 'none';
}

// Ініціалізація акордеонів
function initCollapsibles() {
    document.querySelectorAll('.collapsible-header').forEach(header => {
        header.addEventListener('click', () => {
            const section = header.closest('.collapsible');
            section.classList.toggle('open');
        });
    });
}

// Розрахунок діапазону конкретного теократичного року (1 вересня - 31 серпня)
function getTeocraticYearRange(startYear) {
    const startDate = `${startYear}-09-01T00:00:00`;
    const endDate = `${startYear + 1}-08-31T23:59:59`;
    return { startDate, endDate };
}

// Визначення теократичного року за датою
function getTeocraticYearFromDate(dateObj) {
    const year = dateObj.getFullYear();
    return (dateObj.getMonth() >= 8) ? year : year - 1;
}

// Динамічне розпізнавання доступних теократичних років із бази логів
async function initYearSelector() {
    const select = document.getElementById('yearSelect');
    if (!select) return;

    const now = new Date();
    const currentTeoYear = getTeocraticYearFromDate(now);
    const availableYears = new Set([currentTeoYear]);

    try {
        // Запитуємо дати логів для формування переліку років
        const { data: logs, error } = await supabase
            .from('territory_logs')
            .select('taken_at, returned_at');

        if (!error && logs) {
            logs.forEach(log => {
                if (log.taken_at) {
                    availableYears.add(getTeocraticYearFromDate(new Date(log.taken_at)));
                }
                if (log.returned_at) {
                    availableYears.add(getTeocraticYearFromDate(new Date(log.returned_at)));
                }
            });
        }
    } catch (err) {
        console.error('Помилка визначення доступних років:', err);
    }

    // Сортуємо роки від найновішого до найстарішого
    const sortedYears = Array.from(availableYears).sort((a, b) => b - a);

    select.innerHTML = sortedYears
        .map(y => `<option value="${y}">${y}–${y + 1}</option>`)
        .join('');

    select.value = currentTeoYear;

    select.addEventListener('change', (e) => {
        const selectedYear = parseInt(e.target.value);
        loadCampaignsStats(selectedYear);
        loadYearlyStats(selectedYear);
    });

    return currentTeoYear;
}

// Функція для перемикання табів
function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    const activeTab = document.querySelector(`.tab[data-tab="${tabName}"]`);
    if (activeTab) activeTab.classList.add('active');
    
    const activeContent = document.getElementById(`${tabName}Tab`);
    if (activeContent) activeContent.classList.add('active');
}

// Завантаження статистики по кампаніях
// Завантаження статистики по кампаніях за обраний теократичний рік
async function loadCampaignsStats(startYear) {
    const container = document.getElementById('campaignsStats');
    const { startDate, endDate } = getTeocraticYearRange(startYear);
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    try {
        const campaignsResult = await supabase
            .from('campaigns')
            .select('*')
            .order('campaign_start', { ascending: false });

        const campaigns = campaignsResult.data;
        if (campaignsResult.error || !campaigns || campaigns.length === 0) {
            container.innerHTML = '<p>Кампаній не знайдено</p>';
            return;
        }

        const cityParcelsResult = await supabase
            .from('parcels')
            .select('id, name, category')
            .in('category', ['Поверхівки', 'Змішані', 'Приватний сектор']);

        const villageParcelsResult = await supabase
            .from('parcels')
            .select('id, name, category')
            .in('category', ['Село']);

        const cityParcels = cityParcelsResult.data || [];
        const villageParcels = villageParcelsResult.data || [];

        const totalCityParcels = cityParcels.length;
        const totalVillageParcels = villageParcels.length;

        let html = '';

        for (const camp of campaigns) {
            const campStart = new Date(camp.campaign_start);
            const campEnd = new Date(camp.campaign_end);

            // Фільтруємо кампанії: залишаємо тільки ті, що перетиналися з обраним теократичним роком
            if (campEnd < start || campStart > end) {
                continue;
            }

            const logsResult = await supabase
                .from('territory_logs')
                .select('*')
                .eq('campaign_id', camp.id);
            
            const rawLogs = logsResult.data || [];

            // Фільтруємо логи за обраним теократичним роком
            const logs = rawLogs.filter(log => {
                const takenDate = log.taken_at ? new Date(log.taken_at) : null;
                const returnedDate = log.returned_at ? new Date(log.returned_at) : null;
                return (takenDate && takenDate >= start && takenDate <= end) ||
                       (returnedDate && returnedDate >= start && returnedDate <= end);
            });

            const cityLogs = logs.filter(log => cityParcels.some(p => p.id === log.parcel_id));
            const villageLogs = logs.filter(log => villageParcels.some(p => p.id === log.parcel_id));

            const cityProcessedCount = new Set(cityLogs.map(log => log.parcel_id)).size;
            const cityPercent = totalCityParcels > 0 ? Math.round((cityProcessedCount / totalCityParcels) * 100) : 0;

            const cityDurations = cityLogs
                .filter(log => log.taken_at && log.returned_at)
                .map(log => (new Date(log.returned_at) - new Date(log.taken_at)) / (1000 * 60 * 60 * 24));

            const cityAvgDuration = cityDurations.length > 0
                ? (cityDurations.reduce((a, b) => a + b, 0) / cityDurations.length).toFixed(1)
                : 0;

            const villageProcessedCount = new Set(villageLogs.map(log => log.parcel_id)).size;
            const villagePercent = totalVillageParcels > 0 ? Math.round((villageProcessedCount / totalVillageParcels) * 100) : 0;

            const villageDurations = villageLogs
                .filter(log => log.taken_at && log.returned_at)
                .map(log => (new Date(log.returned_at) - new Date(log.taken_at)) / (1000 * 60 * 60 * 24));

            const villageAvgDuration = villageDurations.length > 0
                ? (villageDurations.reduce((a, b) => a + b, 0) / villageDurations.length).toFixed(1)
                : 0;

            const campaignColors = {
                'congress': '#4CAF50',
                'special': '#FFB300',
                'memorial': '#E53935'
            };
            const color = campaignColors[camp.type] || '#667eea';
            const showTabs = villageLogs.length > 0;

            html += `
                <div class="campaign-card" style="border-left-color: ${color}">
                    <h3>${camp.name}</h3>
                    <p style="color: #666; margin: 5px 0;">
                        ${new Date(camp.campaign_start).toLocaleDateString('uk-UA')} -
                        ${new Date(camp.campaign_end).toLocaleDateString('uk-UA')}
                    </p>
                    ${showTabs ? `
                        <div class="campaign-tab-buttons" style="display: flex; gap: 8px; margin-bottom: 15px; margin-top: 10px;">
                            <button class="campaign-tab-btn active" onclick="toggleCampaignTab('${camp.id}', 'city')" style="padding: 6px 12px; border: 1px solid ${color}; background: ${color}; color: white; border-radius: 4px; cursor: pointer; font-weight: 500;">🏙️ Місто</button>
                            <button class="campaign-tab-btn" onclick="toggleCampaignTab('${camp.id}', 'village')" style="padding: 6px 12px; border: 1px solid ${color}; background: white; color: ${color}; border-radius: 4px; cursor: pointer; font-weight: 500;">🏡 Село</button>
                        </div>
                    ` : ''}
                    
                    <div id="city-stats-${camp.id}" class="campaign-stats-container" style="display: block;">
                        <h4 style="margin: 10px 0 5px 0; color: #555; display: ${showTabs ? 'none' : 'block'};">🏙️ Статистика по місту:</h4>
                        <div class="campaign-stats">
                            <div class="campaign-stat">
                                <div class="campaign-stat-value">${cityProcessedCount} (${cityPercent}%)</div>
                                <div class="campaign-stat-label">Опрацьовано</div>
                            </div>
                            <div class="campaign-stat">
                                <div class="campaign-stat-value">${cityAvgDuration}</div>
                                <div class="campaign-stat-label">Середній час (дні)</div>
                            </div>
                            <div class="campaign-stat">
                                <div class="campaign-stat-value">${cityLogs.length}</div>
                                <div class="campaign-stat-label">Всього записів</div>
                            </div>
                        </div>
                    </div>
                    
                    ${showTabs ? `
                        <div id="village-stats-${camp.id}" class="campaign-stats-container" style="display: none;">
                            <div class="campaign-stats">
                                <div class="campaign-stat">
                                    <div class="campaign-stat-value">${villageProcessedCount} (${villagePercent}%)</div>
                                    <div class="campaign-stat-label">Опрацьовано</div>
                                </div>
                                <div class="campaign-stat">
                                    <div class="campaign-stat-value">${villageAvgDuration}</div>
                                    <div class="campaign-stat-label">Середній час (дні)</div>
                                </div>
                                <div class="campaign-stat">
                                    <div class="campaign-stat-value">${villageLogs.length}</div>
                                    <div class="campaign-stat-label">Всього записів</div>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        }

        container.innerHTML = html || '<p>За вибраний теократичний рік кампаній не знайдено</p>';

    } catch (error) {
        console.error('Помилка завантаження статистики кампаній:', error);
        container.innerHTML = '<div class="error">Помилка завантаження статистики</div>';
    }
}

window.toggleCampaignTab = function(campaignId, type) {
    const cityStats = document.getElementById(`city-stats-${campaignId}`);
    const villageStats = document.getElementById(`village-stats-${campaignId}`);
    if (!cityStats || !villageStats) return;

    const campaignCard = cityStats.closest('.campaign-card');
    const tabButtons = campaignCard.querySelectorAll('.campaign-tab-btn');
    if (tabButtons.length < 2) return;

    if (type === 'city') {
        cityStats.style.display = 'block';
        villageStats.style.display = 'none';
        tabButtons[0].style.background = tabButtons[0].style.borderColor;
        tabButtons[0].style.color = 'white';
        tabButtons[1].style.background = 'white';
        tabButtons[1].style.color = tabButtons[1].style.borderColor;
    } else {
        cityStats.style.display = 'none';
        villageStats.style.display = 'block';
        tabButtons[1].style.background = tabButtons[1].style.borderColor;
        tabButtons[1].style.color = 'white';
        tabButtons[0].style.background = 'white';
        tabButtons[0].style.color = tabButtons[0].style.borderColor;
    }
};

// Завантаження загальної статистики за вибраний теократичний рік
async function loadYearlyStats(startYear) {
    const { startDate, endDate } = getTeocraticYearRange(startYear);

    try {
        // Отримуємо дільниці міста
        const cityParcelsResult = await supabase
            .from('parcels')
            .select('id, name, category')
            .in('category', ['Поверхівки', 'Змішані', 'Приватний сектор']);

        const cityParcels = cityParcelsResult.data || [];
        const totalCity = cityParcels.length;

        // Дільниці міста на руках зараз
        const cityOnHandsResult = await supabase
            .from('parcels')
            .select('id')
            .in('category', ['Поверхівки', 'Змішані', 'Приватний сектор'])
            .eq('status', 'taken');

        const cityOnHands = cityOnHandsResult.data?.length || 0;

        // Дільниці сіл
        const villageParcelsResult = await supabase
            .from('parcels')
            .select('id, name, category')
            .eq('category', 'Село');

        const villageParcels = villageParcelsResult.data || [];
        const totalVillage = villageParcels.length;

        // Дільниці сіл на руках зараз
        const villageOnHandsResult = await supabase
            .from('parcels')
            .select('id')
            .eq('category', 'Село')
            .eq('status', 'taken');

        const villageOnHands = villageOnHandsResult.data?.length || 0;

        // Отримуємо логи
        const logsResult = await supabase
            .from('territory_logs')
            .select('*');

        const allLogs = logsResult.data || [];

        const start = new Date(startDate);
        const end = new Date(endDate);

        const logs = allLogs.filter(log => {
            const takenDate = log.taken_at ? new Date(log.taken_at) : null;
            const returnedDate = log.returned_at ? new Date(log.returned_at) : null;

            const takenInPeriod = takenDate && takenDate >= start && takenDate <= end;
            const returnedInPeriod = returnedDate && returnedDate >= start && returnedDate <= end;

            return takenInPeriod || returnedInPeriod;
        });

        // Статистика для міста
        const cityLogs = logs.filter(log => cityParcels.some(p => p.id === log.parcel_id));
        const cityProcessedCount = new Set(cityLogs.map(log => log.parcel_id)).size;
        const cityPercent = totalCity > 0 ? Math.round((cityProcessedCount / totalCity) * 100) : 0;

        const cityParcelCounts = {};
        cityLogs.forEach(log => {
            cityParcelCounts[log.parcel_id] = (cityParcelCounts[log.parcel_id] || 0) + 1;
        });
        const cityRepeated = Object.values(cityParcelCounts).filter(count => count > 1).length;

        document.getElementById('cityTotal').textContent = totalCity;
        document.getElementById('cityOnHands').textContent = cityOnHands;
        document.getElementById('cityProcessed').textContent = `${cityProcessedCount} (${cityPercent}%)`;
        document.getElementById('cityRepeated').textContent = cityRepeated;
        document.getElementById('cityTotalLogs').textContent = cityLogs.length;

        const cityCampaignLogs = cityLogs.filter(log => log.campaign_id || log.campaign_name);
        const cityCampaignProcessedCount = new Set(cityCampaignLogs.map(log => log.parcel_id)).size;

        const cityCampaignParcelCounts = {};
        cityCampaignLogs.forEach(log => {
            cityCampaignParcelCounts[log.parcel_id] = (cityCampaignParcelCounts[log.parcel_id] || 0) + 1;
        });
        const cityCampaignRepeated = Object.values(cityCampaignParcelCounts).filter(count => count > 1).length;

        document.getElementById('cityCampaignProcessed').textContent = `${cityCampaignProcessedCount} (${cityCampaignRepeated})`;

        createCityChart(cityProcessedCount, totalCity - cityProcessedCount, cityRepeated);

        // Статистика для сіл
        const villageLogs = logs.filter(log => villageParcels.some(p => p.id === log.parcel_id));
        const villageProcessedCount = new Set(villageLogs.map(log => log.parcel_id)).size;
        const villagePercent = totalVillage > 0 ? Math.round((villageProcessedCount / totalVillage) * 100) : 0;

        const villageParcelCounts = {};
        villageLogs.forEach(log => {
            villageParcelCounts[log.parcel_id] = (villageParcelCounts[log.parcel_id] || 0) + 1;
        });
        const villageRepeated = Object.values(villageParcelCounts).filter(count => count > 1).length;

        document.getElementById('villageTotal').textContent = totalVillage;
        document.getElementById('villageOnHands').textContent = villageOnHands;
        document.getElementById('villageProcessed').textContent = `${villageProcessedCount} (${villagePercent}%)`;
        document.getElementById('villageRepeated').textContent = villageRepeated;
        document.getElementById('villageTotalLogs').textContent = villageLogs.length;

        const villageCampaignLogs = villageLogs.filter(log => log.campaign_id || log.campaign_name);
        const villageCampaignProcessedCount = new Set(villageCampaignLogs.map(log => log.parcel_id)).size;

        const villageCampaignParcelCounts = {};
        villageCampaignLogs.forEach(log => {
            villageCampaignParcelCounts[log.parcel_id] = (villageCampaignParcelCounts[log.parcel_id] || 0) + 1;
        });
        const villageCampaignRepeated = Object.values(villageCampaignParcelCounts).filter(count => count > 1).length;

        document.getElementById('villageCampaignProcessed').textContent = `${villageCampaignProcessedCount} (${villageCampaignRepeated})`;

        createVillageChart(villageProcessedCount, totalVillage - villageProcessedCount, villageRepeated);

        const villageTab = document.querySelector('.tab[data-tab="village"]');
        if (villageTab) {
            villageTab.style.display = (totalVillage === 0 && villageProcessedCount === 0) ? 'none' : 'block';
        }

    } catch (error) {
        console.error('Помилка завантаження річної статистики:', error);
    }
}

// Створення графіка для міста з перезаписом старого
function createCityChart(processed, notProcessed, repeated) {
    const ctx = document.getElementById('cityChart');
    if (!ctx) return;

    if (cityChartInstance) {
        cityChartInstance.destroy();
    }

    cityChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Опрацьовано', 'Не опрацьовано', 'Повторно'],
            datasets: [{
                data: [Math.max(0, processed - repeated), Math.max(0, notProcessed), repeated],
                backgroundColor: ['#4CAF50', '#E0E0E0', '#FFB300'],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// Створення графіка для сіл з перезаписом старого
function createVillageChart(processed, notProcessed, repeated) {
    const ctx = document.getElementById('villageChart');
    if (!ctx) return;

    if (villageChartInstance) {
        villageChartInstance.destroy();
    }

    villageChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Опрацьовано', 'Не опрацьовано', 'Повторно'],
            datasets: [{
                data: [Math.max(0, processed - repeated), Math.max(0, notProcessed), repeated],
                backgroundColor: ['#4CAF50', '#E0E0E0', '#FFB300'],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// Функції для навігації
window.toggleSidebar = () => {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
};

window.logout = async () => {
    localStorage.removeItem('userId');
    localStorage.removeItem('userRole');
    window.location.href = 'login.html';
};

// Ініціалізація
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    initCollapsibles();

    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            switchTab(tabName);
        });
    });
    
    const activeTeoYear = await initYearSelector();
    await loadCampaignsStats(activeTeoYear);
    await loadYearlyStats(activeTeoYear);
});
// admin-statistics.js - Статистика для адмінів

import { supabase } from './config.js';

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

// Отримання початку і кінця теократичного року
function getTeocraticYearRange() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const teoStartYear = (now.getMonth() >= 8) ? currentYear : currentYear - 1;
    const startDate = `${teoStartYear}-09-01`;
    const endDate = `${teoStartYear + 1}-08-31`;
    return { startDate, endDate };
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
async function loadCampaignsStats() {
    const container = document.getElementById('campaignsStats');
    
    try {
        // Отримуємо кампанії
        const campaignsResult = await supabase
            .from('campaigns')
            .select('*')
            .order('campaign_start', { ascending: false });

        const campaigns = campaignsResult.data;
        const campaignsError = campaignsResult.error;

        if (campaignsError) {
            console.error('Помилка завантаження кампаній:', campaignsError);
            container.innerHTML = '<div class="error">Помилка завантаження кампаній</div>';
            return;
        }

        if (!campaigns || campaigns.length === 0) {
            container.innerHTML = '<p>Кампаній не знайдено</p>';
            return;
        }

        // Отримуємо всі дільниці міста
        const cityParcelsResult = await supabase
            .from('parcels')
            .select('id, name, category')
            .in('category', ['Поверхівки', 'Змішані', 'Приватний сектор']);

        // Отримуємо всі сільські дільниці (ВИПРАВЛЕНО: 'Село' замість 'Села')
        const villageParcelsResult = await supabase
            .from('parcels')
            .select('id, name, category')
            .in('category', ['Село']);

        const cityParcels = cityParcelsResult.data;
        const villageParcels = villageParcelsResult.data;
        const parcelsError = cityParcelsResult.error || villageParcelsResult.error;

        if (parcelsError) {
            console.error('Помилка завантаження дільниць:', parcelsError);
            return;
        }

        const totalCityParcels = cityParcels?.length || 0;
        const totalVillageParcels = villageParcels?.length || 0;
        const now = new Date();

        let html = '';

        for (const camp of campaigns) {
            const startDate = new Date(camp.campaign_start);
            
            // Якщо кампанія ще не почалася - приховуємо блок
            if (startDate > now) {
                continue;
            }

            // Отримуємо логи за міткою кампанії
            const logsResult = await supabase
                .from('territory_logs')
                .select('*')
                .eq('campaign_id', camp.id);
            
            const logs = logsResult.data;
            const logsError = logsResult.error;

            if (logsError) {
                console.error('Помилка завантаження логів кампанії:', logsError);
                return;
            }

            // Фільтруємо логи для дільниць міста та села
            const cityLogs = logs?.filter(log => {
                return cityParcels?.some(p => p.id === log.parcel_id);
            }) || [];

            const villageLogs = logs?.filter(log => {
                return villageParcels?.some(p => p.id === log.parcel_id);
            }) || [];

            // Обчислюємо статистику для міста
            const cityUniqueProcessedParcels = new Set(cityLogs.map(log => log.parcel_id));
            const cityProcessedCount = cityUniqueProcessedParcels.size;
            const cityPercent = totalCityParcels > 0 ? Math.round((cityProcessedCount / totalCityParcels) * 100) : 0;

            const cityDurations = cityLogs
                .filter(log => log.taken_at && log.returned_at)
                .map(log => {
                    const taken = new Date(log.taken_at);
                    const returned = new Date(log.returned_at);
                    return (returned - taken) / (1000 * 60 * 60 * 24);
                });

            const cityAvgDuration = cityDurations.length > 0
                ? (cityDurations.reduce((a, b) => a + b, 0) / cityDurations.length).toFixed(1)
                : 0;

            // Обчислюємо統計ку для села
            const villageUniqueProcessedParcels = new Set(villageLogs.map(log => log.parcel_id));
            const villageProcessedCount = villageUniqueProcessedParcels.size;
            const villagePercent = totalVillageParcels > 0 ? Math.round((villageProcessedCount / totalVillageParcels) * 100) : 0;

            const villageDurations = villageLogs
                .filter(log => log.taken_at && log.returned_at)
                .map(log => {
                    const taken = new Date(log.taken_at);
                    const returned = new Date(log.returned_at);
                    return (returned - taken) / (1000 * 60 * 60 * 24);
                });

            const villageAvgDuration = villageDurations.length > 0
                ? (villageDurations.reduce((a, b) => a + b, 0) / villageDurations.length).toFixed(1)
                : 0;

            // Кольори для кампаній
            const campaignColors = {
                'congress': '#4CAF50',
                'special': '#FFB300',
                'memorial': '#E53935'
            };
            const color = campaignColors[camp.type] || '#667eea';

            // Визначаємо, чи показувати таби (показуємо, якщо є хоч один лог по селах для цієї кампанії)
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

        if (html === '') {
            container.innerHTML = '<p>Активних кампаній не знайдено</p>';
        } else {
            container.innerHTML = html;
        }

    } catch (error) {
        console.error('Помилка завантаження статистики кампаній:', error);
        container.innerHTML = '<div class="error">Помилка завантаження статистики</div>';
    }
}

// Функція для перемикання табів між містом та селом в кампаніях
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

// Завантаження загальної статистики за теократичний рік
async function loadYearlyStats() {
    const { startDate, endDate } = getTeocraticYearRange();
    console.log('📊 Початок завантаження річної статистики');
    console.log('📅 Період теократичного року:', startDate, '-', endDate);

    try {
        // Отримуємо дільниці міста
        const cityParcelsResult = await supabase
            .from('parcels')
            .select('id, name, category')
            .in('category', ['Поверхівки', 'Змішані', 'Приватний сектор']);

        const cityParcels = cityParcelsResult.data;
        const cityError = cityParcelsResult.error;

        if (cityError) {
            console.error('Помилка завантаження дільниць міста:', cityError);
            return;
        }

        const totalCity = cityParcels?.length || 0;
        console.log(`🏙️ Дільниці міста (${totalCity}):`, cityParcels.map(p => `${p.name} (${p.category})`));

        // Отримуємо дільниці на руках для міста
        const cityOnHandsResult = await supabase
            .from('parcels')
            .select('id')
            .in('category', ['Поверхівки', 'Змішані', 'Приватний сектор'])
            .eq('status', 'taken');

        const cityOnHands = cityOnHandsResult.data?.length || 0;
        console.log(`👋 Дільниці міста на руках: ${cityOnHands}`);

        // Отримуємо дільниці сіл
        const villageParcelsResult = await supabase
            .from('parcels')
            .select('id, name, category')
            .eq('category', 'Seco' || 'Село'); // Для безпеки залишаємо 'Село'

        // Оскільки в базі точно 'Село'
        const villageParcelsResultFixed = await supabase
            .from('parcels')
            .select('id, name, category')
            .eq('category', 'Село');

        const villageParcels = villageParcelsResultFixed.data;
        const villageError = villageParcelsResultFixed.error;

        if (villageError) {
            console.error('Помилка завантаження дільниць сіл:', villageError);
            return;
        }

        const totalVillage = villageParcels?.length || 0;
        console.log(`🏘️ Дільниці сіл (${totalVillage}):`, villageParcels.map(p => `${p.name} (${p.category})`));

        // Отримуємо дільниці на руках для сіл
        const villageOnHandsResult = await supabase
            .from('parcels')
            .select('id')
            .eq('category', 'Село')
            .eq('status', 'taken');

        const villageOnHands = villageOnHandsResult.data?.length || 0;
        console.log(`👋 Дільниці сіл на руках: ${villageOnHands}`);

        // Отримуємо логи за теократичний рік
        const logsResult = await supabase
            .from('territory_logs')
            .select('*');

        const allLogs = logsResult.data;
        const logsError = logsResult.error;

        if (logsError) {
            console.error('Помилка завантаження логів:', logsError);
            return;
        }

        const logs = allLogs?.filter(log => {
            const takenDate = log.taken_at ? new Date(log.taken_at) : null;
            const returnedDate = log.returned_at ? new Date(log.returned_at) : null;
            const start = new Date(startDate);
            const end = new Date(endDate);

            const takenInPeriod = takenDate && takenDate >= start && takenDate <= end;
            const returnedInPeriod = returnedDate && returnedDate >= start && returnedDate <= end;

            return takenInPeriod || returnedInPeriod;
        }) || [];

        console.log(`📋 Всього логів за період: ${logs?.length || 0}`);

        // Статистика для міста
        const cityLogs = logs?.filter(log => {
            return cityParcels?.some(p => p.id === log.parcel_id);
        }) || [];

        const cityProcessedParcels = new Set(cityLogs.map(log => log.parcel_id));
        const cityProcessedCount = cityProcessedParcels.size;
        const cityPercent = totalCity > 0 ? Math.round((cityProcessedCount / totalCity) * 100) : 0;

        // Підрахунок повторно опрацьованих для міста
        const cityParcelCounts = {};
        cityLogs.forEach(log => {
            cityParcelCounts[log.parcel_id] = (cityParcelCounts[log.parcel_id] || 0) + 1;
        });
        const cityRepeated = Object.values(cityParcelCounts).filter(count => count > 1).length;

        // Оновлюємо UI для міста
        document.getElementById('cityTotal').textContent = totalCity;
        document.getElementById('cityOnHands').textContent = cityOnHands;
        document.getElementById('cityProcessed').textContent = `${cityProcessedCount} (${cityPercent}%)`;
        document.getElementById('cityRepeated').textContent = cityRepeated;
        document.getElementById('cityTotalLogs').textContent = cityLogs.length;

        // Логи кампаній міста
        const cityCampaignLogs = cityLogs.filter(log => log.campaign_id || log.campaign_name);
        const cityCampaignProcessedParcels = new Set(cityCampaignLogs.map(log => log.parcel_id));
        const cityCampaignProcessedCount = cityCampaignProcessedParcels.size;

        const cityCampaignParcelCounts = {};
        cityCampaignLogs.forEach(log => {
            cityCampaignParcelCounts[log.parcel_id] = (cityCampaignParcelCounts[log.parcel_id] || 0) + 1;
        });
        const cityCampaignRepeated = Object.values(cityCampaignParcelCounts).filter(count => count > 1).length;

        document.getElementById('cityCampaignProcessed').textContent = `${cityCampaignProcessedCount} (${cityCampaignRepeated})`;

        createCityChart(cityProcessedCount, totalCity - cityProcessedCount, cityRepeated);

        // Статистика для сіл
        const villageLogs = logs?.filter(log => {
            return villageParcels?.some(p => p.id === log.parcel_id);
        }) || [];

        const villageProcessedParcels = new Set(villageLogs.map(log => log.parcel_id));
        const villageProcessedCount = villageProcessedParcels.size;
        const villagePercent = totalVillage > 0 ? Math.round((villageProcessedCount / totalVillage) * 100) : 0;

        // Підрахунок повторно опрацьованих для сіл
        const villageParcelCounts = {};
        villageLogs.forEach(log => {
            villageParcelCounts[log.parcel_id] = (villageParcelCounts[log.parcel_id] || 0) + 1;
        });
        const villageRepeated = Object.values(villageParcelCounts).filter(count => count > 1).length;

        // Оновлюємо UI для сіл
        document.getElementById('villageTotal').textContent = totalVillage;
        document.getElementById('villageOnHands').textContent = villageOnHands;
        document.getElementById('villageProcessed').textContent = `${villageProcessedCount} (${villagePercent}%)`;
        document.getElementById('villageRepeated').textContent = villageRepeated;
        document.getElementById('villageTotalLogs').textContent = villageLogs.length;

        // Логи кампаній сіл
        const villageCampaignLogs = villageLogs.filter(log => log.campaign_id || log.campaign_name);
        const villageCampaignProcessedParcels = new Set(villageCampaignLogs.map(log => log.parcel_id));
        const villageCampaignProcessedCount = villageCampaignProcessedParcels.size;

        const villageCampaignParcelCounts = {};
        villageCampaignLogs.forEach(log => {
            villageCampaignParcelCounts[log.parcel_id] = (villageCampaignParcelCounts[log.parcel_id] || 0) + 1;
        });
        const villageCampaignRepeated = Object.values(villageCampaignParcelCounts).filter(count => count > 1).length;

        document.getElementById('villageCampaignProcessed').textContent = `${villageCampaignProcessedCount} (${villageCampaignRepeated})`;

        createVillageChart(villageProcessedCount, totalVillage - villageProcessedCount, villageRepeated);

        if (villageProcessedCount === 0 && totalVillage === 0) {
            const villageTab = document.querySelector('.tab[data-tab="village"]');
            if (villageTab) villageTab.style.display = 'none';
        }

    } catch (error) {
        console.error('Помилка завантаження річної статистики:', error);
    }
}

// Створення графіка для міста
function createCityChart(processed, notProcessed, repeated) {
    const ctx = document.getElementById('cityChart');
    if (!ctx) return;

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Опрацьовано', 'Не опрацьовано', 'Повторно'],
            datasets: [{
                data: [processed - repeated, notProcessed, repeated],
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

// Створення графіка для сіл
function createVillageChart(processed, notProcessed, repeated) {
    const ctx = document.getElementById('villageChart');
    if (!ctx) return;

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Опрацьовано', 'Не опрацьовано', 'Повторно'],
            datasets: [{
                data: [processed - repeated, notProcessed, repeated],
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
    
    await loadCampaignsStats();
    await loadYearlyStats();
});
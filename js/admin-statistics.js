// admin-statistics.js - Статистика для адмінів

import { supabase } from './config.js';

// Перевірка автентифікації
async function checkAuth() {
    const userId = localStorage.getItem('userId');
    const userRole = localStorage.getItem('userRole');

    if (!userId || userRole !== 'super_admin') {
        console.warn('Доступ заборонено: сторінка статистики лише для адмінів');
        window.location.href = 'profile.html';
        return;
    }

    const publisherResult = await supabase
        .from('publishers')
        .select('name, role')
        .eq('id', userId)
        .single();

    const publisher = publisherResult.data;
    const error = publisherResult.error;

    if (error || !publisher || publisher.role !== 'super_admin') {
        console.error('Перевірка безпеки не пройдена');
        window.location.href = 'profile.html';
        return;
    }

    document.getElementById('main-loader').style.display = 'none';
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

        const cityParcels = cityParcelsResult.data;
        const parcelsError = cityParcelsResult.error;

        if (parcelsError) {
            console.error('Помилка завантаження дільниць:', parcelsError);
            return;
        }

        const totalCityParcels = cityParcels?.length || 0;
        const now = new Date();

        let html = '';

        for (const camp of campaigns) {
            const startDate = new Date(camp.campaign_start);
            const endDate = new Date(camp.campaign_end);
            
            // Якщо кампанія ще не почалася - приховуємо блок
            if (startDate > now) {
                continue;
            }

            // Отримуємо логи за період кампанії для міста
            const logsResult = await supabase
                .from('territory_logs')
                .select('*')
                .gte('taken_at', camp.campaign_start)
                .lte('taken_at', camp.campaign_end);
            
            const logs = logsResult.data;
            const logsError = logsResult.error;

            if (logsError) {
                console.error('Помилка завантаження логів:', logsError);
                return;
            }

            // Фільтруємо тільки логи для дільниць міста
            const cityLogs = logs?.filter(log => {
                const parcel = cityParcels?.find(p => p.id === log.parcel_id);
                return parcel !== undefined;
            }) || [];

            // Унікальні дільниці, опрацьовані під час кампанії
            const uniqueProcessedParcels = new Set(cityLogs.map(log => log.parcel_id));
            const processedCount = uniqueProcessedParcels.size;
            const percent = totalCityParcels > 0 ? Math.round((processedCount / totalCityParcels) * 100) : 0;

            // Середній час опрацювання
            const durations = cityLogs
                .filter(log => log.taken_at && log.returned_at)
                .map(log => {
                    const taken = new Date(log.taken_at);
                    const returned = new Date(log.returned_at);
                    return (returned - taken) / (1000 * 60 * 60 * 24); // в днях
                });
            
            const avgDuration = durations.length > 0 
                ? (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(1) 
                : 0;

            // Кольори для кампаній
            const campaignColors = {
                'congress': '#4CAF50',
                'special': '#FFB300',
                'memorial': '#E53935'
            };
            const color = campaignColors[camp.type] || '#667eea';

            html += `
                <div class="campaign-card" style="border-left-color: ${color}">
                    <h3>${camp.name}</h3>
                    <p style="color: #666; margin: 5px 0;">
                        ${new Date(camp.campaign_start).toLocaleDateString('uk-UA')} - 
                        ${new Date(camp.campaign_end).toLocaleDateString('uk-UA')}
                    </p>
                    <div class="campaign-stats">
                        <div class="campaign-stat">
                            <div class="campaign-stat-value">${processedCount}/${totalCityParcels}</div>
                            <div class="campaign-stat-label">Опрацьовано</div>
                        </div>
                        <div class="campaign-stat">
                            <div class="campaign-stat-value">${percent}%</div>
                            <div class="campaign-stat-label">Відсоток</div>
                        </div>
                        <div class="campaign-stat">
                            <div class="campaign-stat-value">${avgDuration}</div>
                            <div class="campaign-stat-label">Середній час (дні)</div>
                        </div>
                        <div class="campaign-stat">
                            <div class="campaign-stat-value">${cityLogs.length}</div>
                            <div class="campaign-stat-label">Всього записів</div>
                        </div>
                    </div>
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

// Завантаження загальної статистики за теократичний рік
async function loadYearlyStats() {
    const { startDate, endDate } = getTeocraticYearRange();

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

        // Отримуємо дільниці на руках для міста
        const cityOnHandsResult = await supabase
            .from('parcels')
            .select('id')
            .in('category', ['Поверхівки', 'Змішані', 'Приватний сектор'])
            .eq('status', 'taken');

        const cityOnHands = cityOnHandsResult.data?.length || 0;

        // Отримуємо дільниці сіл
        const villageParcelsResult = await supabase
            .from('parcels')
            .select('id, name, category')
            .eq('category', 'Село');

        const villageParcels = villageParcelsResult.data;
        const villageError = villageParcelsResult.error;

        if (villageError) {
            console.error('Помилка завантаження дільниць сіл:', villageError);
            return;
        }

        const totalVillage = villageParcels?.length || 0;

        // Отримуємо дільниці на руках для сіл
        const villageOnHandsResult = await supabase
            .from('parcels')
            .select('id')
            .eq('category', 'Село')
            .eq('status', 'taken');

        const villageOnHands = villageOnHandsResult.data?.length || 0;

        // Отримуємо логи за теократичний рік
        const logsResult = await supabase
            .from('territory_logs')
            .select('*')
            .gte('taken_at', startDate)
            .lte('taken_at', endDate);

        const logs = logsResult.data;
        const logsError = logsResult.error;

        if (logsError) {
            console.error('Помилка завантаження логів:', logsError);
            return;
        }

        // Статистика для міста
        const cityLogs = logs?.filter(log => {
            const parcel = cityParcels?.find(p => p.id === log.parcel_id);
            return parcel !== undefined;
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
        document.getElementById('cityProcessed').textContent = cityProcessedCount;
        document.getElementById('cityPercent').textContent = cityPercent + '%';
        document.getElementById('cityRepeated').textContent = cityRepeated;

        // Отримуємо кампанії для розрахунку опрацьованих під час кампаній
        const campaignsResult = await supabase
            .from('campaigns')
            .select('campaign_start, campaign_end');

        const campaigns = campaignsResult.data;

        // Фільтруємо логи для міста, які мають campaign_id або campaign_name
        const cityCampaignLogs = cityLogs.filter(log => log.campaign_id || log.campaign_name);
        const cityCampaignProcessedParcels = new Set(cityCampaignLogs.map(log => log.parcel_id));
        const cityCampaignProcessedCount = cityCampaignProcessedParcels.size;

        document.getElementById('cityCampaignProcessed').textContent = cityCampaignProcessedCount;

        // Створюємо графік для міста
        createCityChart(cityProcessedCount, totalCity - cityProcessedCount, cityRepeated);

        // Статистика для сіл
        const villageLogs = logs?.filter(log => {
            const parcel = villageParcels?.find(p => p.id === log.parcel_id);
            return parcel !== undefined;
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
        document.getElementById('villageProcessed').textContent = villageProcessedCount;
        document.getElementById('villagePercent').textContent = villagePercent + '%';
        document.getElementById('villageRepeated').textContent = villageRepeated;

        // Фільтруємо логи для сіл, які мають campaign_id або campaign_name
        const villageCampaignLogs = villageLogs.filter(log => log.campaign_id || log.campaign_name);
        const villageCampaignProcessedParcels = new Set(villageCampaignLogs.map(log => log.parcel_id));
        const villageCampaignProcessedCount = villageCampaignProcessedParcels.size;

        document.getElementById('villageCampaignProcessed').textContent = villageCampaignProcessedCount;

        // Створюємо графік для сіл
        createVillageChart(villageProcessedCount, totalVillage - villageProcessedCount, villageRepeated);

        // Якщо села не опрацьовувалися - приховуємо таб сіл
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
    
    // Додаємо event listeners для табів
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            switchTab(tabName);
        });
    });
    
    await loadCampaignsStats();
    await loadYearlyStats();
});

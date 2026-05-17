// statistics-dew.js - Статистика карти територій

import { supabase } from './config.js';

// Перевірка автентифікації та налаштування навігації
async function checkAuth() {
    const userId = localStorage.getItem('userId');
    const userRole = localStorage.getItem('userRole');

    // Тимчасове обмеження: доступ тільки для super_admin на час розробки
    if (!userId || userRole !== 'super_admin') {
        console.warn('Доступ заборонено: сторінка статистики лише для розробників');
        window.location.href = 'profile.html';
        return;
    }

    const { data: publisher, error } = await supabase
        .from('publishers')
        .select('name, role')
        .eq('id', userId)
        .single();

    if (error || !publisher || publisher.role !== 'super_admin') {
        console.error('Перевірка безпеки не пройдена');
        window.location.href = 'profile.html';
        return;
    }

    // Відображаємо роль як у profile.html
    document.getElementById('displayRole').textContent = userRole === 'super_admin' ? 'Супер Адмін' : (userRole === 'admin' ? 'Адміністратор' : 'Вісник');

    // Оскільки меню тепер статичне, динамічна заміна не потрібна.
    // Просто переконуємося, що adminMenu відображається, якщо воно існує.
    document.getElementById('adminMenu')?.classList.remove('hidden');
    const devLink = document.getElementById('devLink');
    if (devLink) devLink.style.display = 'flex';

    document.getElementById('main-loader').style.display = 'none';
}

// Допоміжні функції для роботи з датами
const getDateRange = (period) => {
    const now = new Date();
    let startDate, endDate = now;

    switch (period) {
        case 'week':
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 7);
            break;
        case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        case 'year':
            startDate = new Date(now.getFullYear(), 8, 1);
            break;
        case 'custom':
            const dateFrom = document.getElementById('dateFrom').value;
            const dateTo = document.getElementById('dateTo').value;
            if (dateFrom) startDate = new Date(dateFrom);
            if (dateTo) endDate = new Date(dateTo);
            break;
    }

    return { startDate, endDate };
};

// Завантаження загальної активності
async function loadGeneralActivity() {
    const period = document.getElementById('periodFilter').value;
    const { startDate, endDate } = getDateRange(period);

    const { data: analytics, error } = await supabase
        .from('map_analytics')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

    if (error) {
        console.error('Помилка завантаження загальної активності:', error);
        return;
    }

    const pageLoads = analytics.filter(a => a.action_type === 'load').length;
    const uniqueUsers = new Set(analytics.map(a => a.user_id)).size;

    document.getElementById('pageLoads').textContent = pageLoads;
    document.getElementById('uniqueVisitors').textContent = uniqueUsers;

    // Статистика по ролях
    await loadRoleStatistics();
}

// Завантаження статистики по ролях
async function loadRoleStatistics() {
    const { data: publishers, error } = await supabase
        .from('publishers')
        .select('role'); // Прибрали last_login, якого немає в базі

    if (error) {
        console.error('Помилка завантаження статистики по ролях:', error);
        return;
    }

    const roles = { user: 0, admin: 0, super_admin: 0 };
    publishers.forEach(p => {
        if (roles[p.role] !== undefined) {
            roles[p.role]++;
        }
    });

    const tbody = document.getElementById('roleStats');
    tbody.innerHTML = `
        <tr><td>Вісник (User)</td><td>${roles.user}</td><td>Активні</td><td>-</td></tr>
        <tr><td>Адміністратор (Admin)</td><td>${roles.admin}</td><td>Активні</td><td>-</td></tr>
        <tr><td>Розробник (Super-admin)</td><td>${roles.super_admin}</td><td>Активні</td><td>-</td></tr>
    `;

    document.getElementById('activeUsers').textContent = `${roles.user} / ${roles.admin} / ${roles.super_admin}`;
}

// Завантаження пошукової активності
async function loadSearchActivity() {
    const period = document.getElementById('periodFilter').value;
    const { startDate, endDate } = getDateRange(period);

    const { data: analytics, error } = await supabase
        .from('map_analytics')
        .select('*')
        .eq('action_type', 'search')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

    if (error) {
        console.error('Помилка завантаження пошукової активності:', error);
        return;
    }

    const searchCount = analytics.length;
    const successfulSearches = analytics.filter(a => a.filter_status === 'success').length;
    const successRate = searchCount > 0 ? Math.round((successfulSearches / searchCount) * 100) : 0;

    document.getElementById('searchCount').textContent = searchCount;
    document.getElementById('searchSuccess').textContent = `${successRate}%`;

    // Топ пошукових запитів
    const searchCounts = {};
    analytics.forEach(a => {
        if (a.search_query) {
            searchCounts[a.search_query] = (searchCounts[a.search_query] || 0) + 1;
        }
    });

    const sortedSearches = Object.entries(searchCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    
    if (sortedSearches.length > 0) {
        document.getElementById('popularSearch').textContent = sortedSearches[0][0];
        
        const tbody = document.getElementById('searchStats');
        tbody.innerHTML = sortedSearches.map(([query, count]) => {
            const successCount = analytics.filter(a => a.search_query === query && a.filter_status === 'success').length;
            const querySuccessRate = Math.round((successCount / count) * 100);
            return `<tr><td>${query}</td><td>${count}</td><td>${querySuccessRate}%</td></tr>`;
        }).join('');
    }
}

// Завантаження статистики шарів
async function loadLayerStatistics() {
    const period = document.getElementById('periodFilter').value;
    const { startDate, endDate } = getDateRange(period);

    const { data: analytics, error } = await supabase
        .from('map_analytics')
        .select('*')
        .eq('action_type', 'layer_switch')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

    if (error) {
        console.error('Помилка завантаження статистики шарів:', error);
        return;
    }

    const layerCounts = { osm: 0, topo: 0, satellite: 0 };
    analytics.forEach(a => {
        if (a.map_layer && layerCounts[a.map_layer] !== undefined) {
            layerCounts[a.map_layer]++;
        }
    });

    const total = Object.values(layerCounts).reduce((a, b) => a + b, 0);
    
    if (total > 0) {
        document.getElementById('osmUsage').textContent = `${Math.round((layerCounts.osm / total) * 100)}%`;
        document.getElementById('topoUsage').textContent = `${Math.round((layerCounts.topo / total) * 100)}%`;
        document.getElementById('satelliteUsage').textContent = `${Math.round((layerCounts.satellite / total) * 100)}%`;
        
        const popularLayer = Object.entries(layerCounts).sort((a, b) => b[1] - a[1])[0][0];
        document.getElementById('popularLayer').textContent = popularLayer;
    }
}

// Завантаження часової активності
async function loadTimeActivity() {
    const period = document.getElementById('periodFilter').value;
    const { startDate, endDate } = getDateRange(period);

    const { data: analytics, error } = await supabase
        .from('map_analytics')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

    if (error) {
        console.error('Помилка завантаження часової активності:', error);
        return;
    }

    // Пікові години
    const hourCounts = {};
    analytics.forEach(a => {
        const hour = new Date(a.created_at).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    const peakHours = Object.entries(hourCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (peakHours.length > 0) {
        document.getElementById('peakHours').textContent = peakHours.map(h => `${h[0]}:00`).join(', ');
    }

    // Найактивніший день
    const dayCounts = {};
    const days = ['Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П\'ятниця', 'Субота'];
    analytics.forEach(a => {
        const day = new Date(a.created_at).getDay();
        dayCounts[day] = (dayCounts[day] || 0) + 1;
    });

    const peakDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0];
    if (peakDay) {
        document.getElementById('peakDay').textContent = days[peakDay[0]];
    }

    // Сезонність
    const month = new Date().getMonth();
    let season = '';
    if (month >= 8 || month <= 1) season = 'Осінь/Зима';
    else if (month >= 2 && month <= 5) season = 'Весна';
    else season = 'Літо';
    
    document.getElementById('seasonality').textContent = season;
}

// Головна функція завантаження статистики
window.loadStatistics = async () => {
    await loadGeneralActivity();
    await loadSearchActivity();
    await loadLayerStatistics();
    await loadTimeActivity();
};

// Обробка зміни періоду
document.getElementById('periodFilter').addEventListener('change', (e) => {
    const customGroups = document.getElementById('dateFromGroup');
    const dateToGroup = document.getElementById('dateToGroup');
    
    if (e.target.value === 'custom') {
        customGroups.style.display = 'flex';
        dateToGroup.style.display = 'flex';
    } else {
        customGroups.style.display = 'none';
        dateToGroup.style.display = 'none';
    }
});

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

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    loadStatistics();
});

// analytics.js - Модуль для логування статистики використання карти

import { supabase } from './config.js';

// Логування події аналітики
async function logAnalytics(actionType, data = {}) {
    try {
        const userId = localStorage.getItem('userId');
        
        if (!userId) return; // Не логуємо для неавтентифікованих користувачів

        const analyticsData = {
            user_id: userId,
            action_type: actionType,
            filter_mode: data.filterMode || null,
            filter_category: data.filterCategory || null,
            filter_status: data.filterStatus || null,
            search_query: data.searchQuery || null,
            parcel_id: data.parcelId || null,
            map_layer: data.mapLayer || null,
            zoom_level: data.zoomLevel || null,
            center_lat: data.centerLat || null,
            center_lng: data.centerLng || null,
            user_agent: navigator.userAgent
        };

        const { error } = await supabase
            .from('map_analytics')
            .insert(analyticsData);

        if (error) {
            console.error('Помилка логування аналітики:', error);
        }
    } catch (error) {
        console.error('Помилка в logAnalytics:', error);
    }
}

// Логування завантаження сторінки
export async function logPageLoad() {
    await logAnalytics('load');
}

// Логування зміни фільтрів
export async function logFilterChange(filterMode, filterCategory, filterStatus) {
    await logAnalytics('filter_change', {
        filterMode,
        filterCategory,
        filterStatus
    });
}

// Логування пошуку дільниці
export async function logSearch(searchQuery, success = true) {
    await logAnalytics('search', {
        searchQuery,
        filterStatus: success ? 'success' : 'failed'
    });
}

// Логування кліку на дільницю
export async function logParcelClick(parcelId) {
    await logAnalytics('parcel_click', {
        parcelId
    });
}

// Логування взяття дільниці
export async function logTakeParcel(parcelId) {
    await logAnalytics('take_parcel', {
        parcelId
    });
}

// Логування перемикання шару карти
export async function logLayerChange(mapLayer) {
    await logAnalytics('layer_switch', {
        mapLayer
    });
}

// Логування переміщення карти
export async function logMapMove(centerLat, centerLng, zoomLevel) {
    // Логуємо тільки при значних змінах (debounce)
    if (window.mapMoveTimeout) {
        clearTimeout(window.mapMoveTimeout);
    }

    window.mapMoveTimeout = setTimeout(async () => {
        await logAnalytics('map_move', {
            centerLat,
            centerLng,
            zoomLevel
        });
    }, 2000); // Логуємо через 2 секунди після останнього переміщення
}

// Ініціалізація аналітики для карти
export function initMapAnalytics(map) {
    if (!map) return;

    // Логування перемикання шарів
    map.on('baselayerchange', (e) => {
        const layerName = e.name;
        let mapLayer = 'satellite';
        
        if (layerName.includes('OSM')) {
            mapLayer = 'osm';
        } else if (layerName.includes('Topo')) {
            mapLayer = 'topo';
        }
        
        logLayerChange(mapLayer);
    });

    // Логування переміщення карти
    map.on('moveend', () => {
        const center = map.getCenter();
        const zoom = map.getZoom();
        logMapMove(center.lat, center.lng, zoom);
    });
}

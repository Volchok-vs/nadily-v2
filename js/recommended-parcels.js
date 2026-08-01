/**
 * recommended-parcels.js
 * Універсальний модуль для розрахунку та відображення рекомендованих гео-блоків.
 */

let currentRadiusMeters = 500;
let currentMinIdleMonths = 'auto'; // 'auto' або число (12, 10, 8, 6)

// 🎨 Палітра приємних, виразних кольорів без чистого червоного
const BLOCK_COLORS = [
    '#2563eb', // Насичений синій
    '#059669', // Смарагдово-зелений
    '#d97706', // Янтарно-помаранчевий
    '#7c3aed', // Фіолетовий
    '#0f766e', // Морська хвиля / Slate Teal
    '#0284c7', // Блакитний
    '#ea580c', // Глибокий помаранчевий
    '#4d7c0f'  // Оливково-зелений
];

// Масив для збереження активних шарів контурів
window.currentBlockBoundaries = window.currentBlockBoundaries || [];

/**
 * Універсальна функція плюралізації (відмінювання іменників за кількістю)
 */
function getPluralWord(count, one = 'дільниця', few = 'дільниці', many = 'дільниць') {
    const mod10 = count % 10;
    const mod100 = count % 100;

    if (mod100 >= 11 && mod100 <= 14) {
        return many;
    }
    if (mod10 === 1) {
        return one;
    }
    if (mod10 >= 2 && mod10 <= 4) {
        return few;
    }
    return many;
}

async function getSupabaseInstance() {
    if (window.supabase) return window.supabase;
    try {
        const configModule = await import('./config.js');
        if (configModule && configModule.supabase) {
            return configModule.supabase;
        }
    } catch (e) {
        console.warn("⚠️ Не вдалося імпортувати supabase з config.js:", e);
    }
    return null;
}

/**
 * 💡 ОСНОВНА ЧИСТА ЛОГІКА РОЗРАХУНКУ
 * Завантажує дані та повертає структуровані гео-блоки і відфільтровані дільниці.
 */
async function computeRecommendedParcels(radiusMeters = 500, minIdleMonths = 'auto') {
    const supabaseClient = await getSupabaseInstance();
    if (!supabaseClient) {
        throw new Error("Об'єкт Supabase не знайдено.");
    }

    const { data: allParcels, error } = await supabaseClient
        .from('parcels')
        .select('*');

    if (error) throw error;

    const now = new Date();
    const MS_PER_DAY = 24 * 60 * 60 * 1000;

    function getParcelCentroid(p) {
        if (p.geom && p.geom.coordinates) {
            let coords = p.geom.coordinates;
            while (Array.isArray(coords[0]) && typeof coords[0][0] !== 'number') {
                coords = coords[0];
            }
            if (Array.isArray(coords) && coords.length > 0) {
                let sumLat = 0, sumLng = 0, count = 0;
                coords.forEach(pt => {
                    if (Array.isArray(pt) && pt.length >= 2) {
                        sumLng += parseFloat(pt[0]);
                        sumLat += parseFloat(pt[1]);
                        count++;
                    }
                });
                if (count > 0) return { lat: sumLat / count, lng: sumLng / count };
            }
        }

        if (Array.isArray(p.label_pos) && p.label_pos.length >= 2) {
            const lat = parseFloat(p.label_pos[0]);
            const lng = parseFloat(p.label_pos[1]);
            if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
        }

        return null;
    }

    // Базова фільтрація: вільні міські дільниці
    let baseFreeParcels = allParcels.filter(parcel => {
        const status = (parcel.status || '').toLowerCase().trim();
        const isFree = status === 'free' || status === 'вільна' || status === 'доступна' || status === '';
        if (!isFree) return false;

        const name = (parcel.name || '').toLowerCase();
        const category = (parcel.category || '').toLowerCase();
        const isVillage = category.includes('село') || name.includes('с.') || category.includes('с.');
        return !isVillage;
    });

    function getIdleMonths(lastReturnedDateStr) {
        if (!lastReturnedDateStr) return Infinity;
        const diffMs = now - new Date(lastReturnedDateStr);
        return diffMs / (30.44 * MS_PER_DAY);
    }

    let targetMonths = 12;
    let isAutoExpanded = false;

    if (minIdleMonths === 'auto') {
        const count12 = baseFreeParcels.filter(p => getIdleMonths(p.last_returned) >= 12).length;
        if (count12 < 4) {
            targetMonths = 10;
            isAutoExpanded = true;
        } else {
            targetMonths = 12;
        }
    } else {
        targetMonths = parseInt(minIdleMonths, 10) || 12;
    }

    let filtered = baseFreeParcels.filter(p => getIdleMonths(p.last_returned) >= targetMonths);

    filtered.forEach(p => {
        p._centroid = getParcelCentroid(p);
    });

    filtered.sort((a, b) => {
        if (!a.last_returned) return -1;
        if (!b.last_returned) return 1;
        return new Date(a.last_returned) - new Date(b.last_returned);
    });

    function getDistanceMeters(lat1, lon1, lat2, lon2) {
        const R = 6371000;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function extractNumberForSort(str) {
        const match = (str || '').toString().match(/\d+/);
        return match ? parseInt(match[0], 10) : Infinity;
    }

    // Групування в гео-блоки
    const groups = [];
    const visited = new Set();

    filtered.forEach((item) => {
        if (visited.has(item.id)) return;

        const currentGroup = [item];
        visited.add(item.id);
        const itemCenter = item._centroid;

        if (itemCenter) {
            filtered.forEach((candidate) => {
                if (visited.has(candidate.id) || !candidate._centroid) return;

                const dist = getDistanceMeters(
                    itemCenter.lat, itemCenter.lng,
                    candidate._centroid.lat, candidate._centroid.lng
                );

                if (dist <= radiusMeters) {
                    currentGroup.push(candidate);
                    visited.add(candidate.id);
                }
            });
        }

        currentGroup.sort((a, b) => {
            const numA = extractNumberForSort(a.name);
            const numB = extractNumberForSort(b.name);
            if (numA !== numB) return numA - numB;
            return (a.name || '').localeCompare(b.name || '', 'uk', { numeric: true });
        });

        groups.push(currentGroup);
    });

    const allRecommendedIds = groups.flatMap(group => group.map(p => p.id)).filter(Boolean);

    return {
        groups,
        filtered,
        allRecommendedIds,
        isAutoExpanded
    };
}

/**
 * 🧹 Очищає всі попередні контури гео-блоки з карти
 */
function clearBlockBoundaries() {
    if (window.currentBlockBoundaries.length > 0) {
        window.currentBlockBoundaries.forEach(layer => {
            if (window.map && window.map.hasLayer(layer)) {
                window.map.removeLayer(layer);
            }
        });
        window.currentBlockBoundaries = [];
    }
}

/**
 * 📐 Побудова та малювання кольорового контуру гео-блоку через Turf.js
 */
function drawBlockBoundary(groupParcels, color) {
    if (!window.map || !groupParcels || groupParcels.length === 0) return null;
    if (typeof turf === 'undefined') {
        console.warn("⚠️ Бібліотека Turf.js не підключена в index.html. Контури блоків не побудовано.");
        return null;
    }

    try {
        // 1. Формуємо GeoJSON масив полігонів для ділянок блоку
        const geojsonFeatures = groupParcels.map(p => {
            if (p.geom) {
                return {
                    type: "Feature",
                    geometry: p.geom,
                    properties: p
                };
            }
            return null;
        }).filter(Boolean);

        if (geojsonFeatures.length === 0) return null;

        // 2. Об'єднуємо полігони за допомогою turf.union
        let combined = geojsonFeatures[0];

        if (geojsonFeatures.length > 1) {
            combined = geojsonFeatures.reduce((acc, feat) => {
                if (!acc) return feat;
                try {
                    return turf.union(acc, feat);
                } catch (e) {
                    return acc;
                }
            });
        }

        // 3. Створюємо шар Leaflet з підібраним кольором
        const boundaryLayer = L.geoJSON(combined, {
            style: {
                color: color,             // Колір лінії контуру
                weight: 3,                 // Товщина межі
                opacity: 0.9,              // Прозорість лінії
                fillColor: color,          // Колір напівпрозорої заливки
                fillOpacity: 0.15,         // Прозорість заливки
                dashArray: '6, 6',         // Пунктирна лінія
                interactive: false         // Щоб контур не заважав клікати по ділянках
            }
        });

        boundaryLayer.addTo(window.map);
        return boundaryLayer;

    } catch (err) {
        console.error("Помилка створення контуру гео-блоку:", err);
        return null;
    }
}

/**
 * 🎛️ 1. ФУНКЦІЯ ДЛЯ СТОРІНКИ ПРОФІЛЮ / РЕКОМЕНДАЦІЙ
 */
async function loadRecommendedParcels(radiusMeters, minIdleMonths) {
    if (radiusMeters) currentRadiusMeters = parseInt(radiusMeters, 10) || 500;
    if (minIdleMonths !== undefined) currentMinIdleMonths = minIdleMonths;

    const radiusSelect = document.getElementById('radius-select');
    if (radiusSelect) radiusSelect.value = currentRadiusMeters;

    const idleSelect = document.getElementById('idle-select');
    if (idleSelect) idleSelect.value = currentMinIdleMonths;

    const contentDiv = document.getElementById('recommended-parcels-content');
    if (!contentDiv) return;

    contentDiv.innerHTML = `
        <div style="text-align: center; padding: 40px; font-family: inherit;">
            <div class="spinner" style="margin: 0 auto 15px auto;"></div>
            <h3 style="margin: 0 0 8px 0; color: #1e293b;">⏳ Розрахунок гео-блоків...</h3>
            <p style="color: #64748b; font-size: 0.9rem; margin: 0;">Аналізуємо міські ділянки у радіусі ${currentRadiusMeters}м</p>
        </div>
    `;

    try {
        const { groups, filtered, allRecommendedIds, isAutoExpanded } = 
            await computeRecommendedParcels(currentRadiusMeters, currentMinIdleMonths);

        const now = new Date();

        function calculateIdleTime(lastDateStr) {
            if (!lastDateStr) return "Ніколи не опрацьовувалась";
            const lastDate = new Date(lastDateStr);
            if (isNaN(lastDate.getTime())) return "—";

            let years = now.getFullYear() - lastDate.getFullYear();
            let months = now.getMonth() - lastDate.getMonth();
            let days = now.getDate() - lastDate.getDate();

            if (days < 0) {
                months -= 1;
                const prevMonthLastDay = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
                days += prevMonthLastDay;
            }
            if (months < 0) {
                years -= 1;
                months += 12;
            }

            const parts = [];
            if (years > 0) parts.push(`${years} р.`);
            if (months > 0) parts.push(`${months} міс.`);
            parts.push(`${days} дн.`);

            return parts.join(' ');
        }

        function formatDate(dateStr) {
            if (!dateStr) return "—";
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return "—";
            return d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }

        let noticeHtml = '';
        if (isAutoExpanded) {
            const word4 = getPluralWord(4);
            noticeHtml = `
                <div style="background: #fffbebf5; border: 1px solid #fcd34d; color: #92400e; padding: 10px 14px; border-radius: 8px; margin-bottom: 16px; font-size: 0.88rem; display: flex; align-items: center; gap: 8px;">
                    <span>💡</span> 
                    <span>Знайдено менше 4 ${word4} з простоєм понад 12 місяців. Критерій автоматично розширено до <b>понад 10 місяців</b>.</span>
                </div>
            `;
        }

        let generalMapButtonHtml = '';
        if (allRecommendedIds.length > 0) {
            const allMapUrl = `index.html?recommend_ids=${allRecommendedIds.join(',')}&from=recommended`;
            const totalCount = filtered.length;
            const totalWord = getPluralWord(totalCount);

            generalMapButtonHtml = `
                <div style="margin-bottom: 16px; display: flex; justify-content: flex-end;">
                    <a href="${allMapUrl}" 
                       style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px; background: #1565C0; color: #fff; text-decoration: none; border-radius: 8px; font-size: 0.92rem; font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.08); transition: background 0.2s;"
                       onmouseover="this.style.background='#0d47a1'" 
                       onmouseout="this.style.background='#1565C0'">
                        🗺️ Показати ВСІ гео-блоки на карті (${totalCount} ${totalWord})
                    </a>
                </div>
            `;
        }

        let globalCounter = 1;
        let blocksHtml = noticeHtml + generalMapButtonHtml;

        groups.forEach((group, groupIndex) => {
            let rowsHtml = "";
            const groupParcelIds = group.map(p => p.id).filter(Boolean).join(',');
            const blockMapUrl = `index.html?recommend_ids=${groupParcelIds}&from=recommended`;

            group.forEach((parcel) => {
                const idleText = calculateIdleTime(parcel.last_returned);
                const formattedDate = formatDate(parcel.last_returned);

                rowsHtml += `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 10px; text-align: center; font-weight: bold; color: #94a3b8;">${globalCounter++}</td>
                        <td style="padding: 10px;"><b>Дільниця №${parcel.name || 'без назви'}</b></td>
                        <td style="padding: 10px; text-align: center; white-space: nowrap;">${formattedDate}</td>
                        <td style="padding: 10px; text-align: center; font-weight: 600; color: #d97706; white-space: nowrap;">${idleText}</td>
                        <td style="padding: 10px; text-align: center;">
                            <a href="parcel-details.html?id=${parcel.id}&from=all" 
                               style="display: inline-block; padding: 6px 12px; background: #1565C0; color: #fff; text-decoration: none; border-radius: 6px; font-size: 0.85rem; font-weight: 600;">
                               Переглянути ↗
                            </a>
                        </td>
                    </tr>
                `;
            });

            const groupCount = group.length;
            const groupWord = getPluralWord(groupCount);

            blocksHtml += `
                <div class="card" style="margin-bottom: 16px; padding: 16px; overflow-x: auto;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                        <h3 style="margin: 0; font-size: 1.05rem; color: #1565C0; display: flex; align-items: center; gap: 8px;">
                            <span>📍</span> Гео-блок #${groupIndex + 1} 
                            <span style="font-size: 0.85rem; font-weight: normal; color: #64748b;">(${groupCount} ${groupWord})</span>
                        </h3>
                        
                        <a href="${blockMapUrl}" 
                           style="display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; background: #2e7d32; color: #fff; text-decoration: none; border-radius: 6px; font-size: 0.85rem; font-weight: 600; transition: background 0.2s;"
                           onmouseover="this.style.background='#1b5e20'" 
                           onmouseout="this.style.background='#2e7d32'">
                            🗺️ Показати цей блок
                        </a>
                    </div>

                    <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem; min-width: 500px;">
                        <thead>
                            <tr style="background: #f8fafc; color: #475569; border-bottom: 2px solid #e2e8f0; text-align: left;">
                                <th style="padding: 8px 10px; text-align: center;">№</th>
                                <th style="padding: 8px 10px;">Дільниця</th>
                                <th style="padding: 8px 10px; text-align: center;">Останнє опрацювання</th>
                                <th style="padding: 8px 10px; text-align: center;">Час простою</th>
                                <th style="padding: 8px 10px; text-align: center;">Дія</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                </div>
            `;
        });

        contentDiv.innerHTML = blocksHtml || '<div class="card"><p style="color: gray; margin: 0;">Рекомендованих ділянок за цими критеріями не знайдено.</p></div>';

    } catch (err) {
        console.error("❌ Помилка завантаження рекомендованих ділянок:", err);
        contentDiv.innerHTML = `
            <div class="card" style="color: #dc2626;">
                <b>Помилка завантаження даних:</b> ${err.message}
            </div>
        `;
    }
}

/**
 * 🗺️ 2. ФУНКЦІЯ ДЛЯ СТОРІНКИ КАРТИ
 */
async function showRecommendedOnMap(radiusMeters = 500, minIdleMonths = 'auto') {
    try {
        const { groups, allRecommendedIds } = await computeRecommendedParcels(radiusMeters, minIdleMonths);

        if (!allRecommendedIds || allRecommendedIds.length === 0) {
            alert('Рекомендованих ділянок за заданими критеріями не знайдено.');
            return [];
        }

        // 1. Оновлюємо URL
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('recommend_ids', allRecommendedIds.join(','));
        newUrl.searchParams.set('from', 'recommended');
        window.history.pushState({}, '', newUrl);

        // 2. Спочатку малюємо самі ділянки на карті
        if (typeof window.handleUrlParams === 'function') {
            await window.handleUrlParams();
        } else if (typeof window.applyUrlFilters === 'function') {
            await window.applyUrlFilters();
        } else if (typeof window.displayParcelsByIds === 'function') {
            window.displayParcelsByIds(allRecommendedIds);
        }

        // 3. ТІЛЬКИ ПІСЛЯ ЦЬОГО малюємо кольорові контури блоків!
        clearBlockBoundaries();

        groups.forEach((group, index) => {
            const color = BLOCK_COLORS[index % BLOCK_COLORS.length];
            const boundary = drawBlockBoundary(group, color);
            if (boundary) {
                window.currentBlockBoundaries.push(boundary);
            }
        });

        // 4. Наводимо зум
        if (typeof window.fitMapToParcelIds === 'function') {
            window.fitMapToParcelIds(allRecommendedIds);
        }

        return allRecommendedIds;
    } catch (err) {
        console.error("❌ Помилка відображення рекомендованих ділянок на карті:", err);
        alert("Помилка під час розрахунку гео-блоків: " + err.message);
        return [];
    }
}

// Експортуємо функції у глобальну область видимості
window.getPluralWord = getPluralWord;
window.computeRecommendedParcels = computeRecommendedParcels;
window.loadRecommendedParcels = loadRecommendedParcels;
window.showRecommendedOnMap = showRecommendedOnMap;
window.clearBlockBoundaries = clearBlockBoundaries;
window.drawBlockBoundary = drawBlockBoundary;
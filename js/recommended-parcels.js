/**
 * recommended-parcels.js
 * Універсальний модуль для розрахунку та відображення рекомендованих гео-блоків та загального списку з табами.
 */

let currentRadiusMeters = 500;
let currentMinIdleMonths = 'auto'; // 'auto' або число (12, 10, 8, 6)

// Збереження згенерованих груп у пам'яті для швидкого інтерактивного сортування
window.renderedGeoGroups = [];
// Збереження поточного стану сортування для кожного блоку: { sortField: 'idle'|'num', sortOrder: 'asc'|'desc' }
window.blockSortStates = {};
// Збереження геолокації користувача
window.userCoordinates = null;

// Збереження даних плоского списку
window.flatParcelsList = [];
window.flatListSortState = { sortField: 'idle', sortOrder: 'asc' };
window.flatStarThresholdDays = Infinity;

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

function extractNumberForSort(str) {
    const match = (str || '').toString().match(/\d+/);
    return match ? parseInt(match[0], 10) : Infinity;
}

function getDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(meters) {
    if (meters < 1000) {
        return `${Math.round(meters)} м`;
    }
    return `${(meters / 1000).toFixed(1)} км`;
}

/**
 * Обчислює центральну точку (центроїд) всього гео-блоку
 */
function calculateGroupCentroid(group) {
    let sumLat = 0, sumLng = 0, count = 0;
    group.forEach(p => {
        if (p._centroid) {
            sumLat += p._centroid.lat;
            sumLng += p._centroid.lng;
            count++;
        }
    });
    return count > 0 ? { lat: sumLat / count, lng: sumLng / count } : null;
}

/**
 * 💡 ОСНОВНА ЧИСТА ЛОГІКА РОЗРАХУНКУ
 */
async function computeRecommendedParcels(radiusMeters = 500, minIdleMonths = 'auto') {
    const supabaseClient = await getSupabaseInstance();
    if (!supabaseClient) {
        throw new Error("Об'єкт Supabase не знайдено.");
    }

    const isAuth = !!localStorage.getItem('userId');
    const targetSource = isAuth ? 'parcels' : 'public_parcels_map_mirror';

    const { data: allParcels, error } = await supabaseClient
        .from(targetSource)
        .select('*');

    if (error) throw error;

    const now = new Date();
    const MS_PER_DAY = 24 * 60 * 60 * 1000;

    function getParcelCentroid(p) {
        if (p.geom) {
            let geoData = typeof p.geom === 'string' ? JSON.parse(p.geom) : p.geom;
            let coords = geoData.coordinates;
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
            if (!a.last_returned && !b.last_returned) return 0;
            if (!a.last_returned) return -1;
            if (!b.last_returned) return 1;
            return new Date(a.last_returned) - new Date(b.last_returned);
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

function calculateIdleTime(lastDateStr) {
    if (!lastDateStr) return "Ніколи не опрацьовувалась";
    const lastDate = new Date(lastDateStr);
    if (isNaN(lastDate.getTime())) return "—";

    const now = new Date();
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

function formatThresholdTime(days) {
    if (days === Infinity || isNaN(days)) return "—";

    const totalMonths = Math.round(days / 30.44);
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;

    const parts = [];
    if (years > 0) parts.push(`${years} р.`);
    if (months > 0) parts.push(`${months} міс.`);

    return parts.length > 0 ? parts.join(' ') : '0 міс.';
}

function formatDate(dateStr) {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function toggleBlockSort(groupIndex, field) {
    const currentState = window.blockSortStates[groupIndex] || { sortField: 'idle', sortOrder: 'asc' };

    let newOrder = 'asc';
    if (currentState.sortField === field) {
        newOrder = currentState.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
        newOrder = 'asc';
    }

    window.blockSortStates[groupIndex] = { sortField: field, sortOrder: newOrder };
    renderSingleBlockTable(groupIndex);
}

function renderSingleBlockTable(groupIndex) {
    const tableContainer = document.getElementById(`block-table-container-${groupIndex}`);
    if (!tableContainer || !window.renderedGeoGroups[groupIndex]) return;

    const group = [...window.renderedGeoGroups[groupIndex]];
    const sortState = window.blockSortStates[groupIndex] || { sortField: 'idle', sortOrder: 'asc' };

    group.sort((a, b) => {
        if (sortState.sortField === 'num') {
            const numA = extractNumberForSort(a.name);
            const numB = extractNumberForSort(b.name);
            if (numA !== numB) return sortState.sortOrder === 'asc' ? numA - numB : numB - numA;
            return sortState.sortOrder === 'asc'
                ? (a.name || '').localeCompare(b.name || '', 'uk', { numeric: true })
                : (b.name || '').localeCompare(a.name || '', 'uk', { numeric: true });
        } else {
            if (!a.last_returned && !b.last_returned) return 0;
            if (!a.last_returned) return 1;
            if (!b.last_returned) return -1;
            const timeA = new Date(a.last_returned).getTime();
            const timeB = new Date(b.last_returned).getTime();
            return sortState.sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
        }
    });

    let rowsHtml = "";
    group.forEach((parcel, idx) => {
        const idleText = calculateIdleTime(parcel.last_returned);
        const formattedDate = formatDate(parcel.last_returned);
        // ⭐ Додано відображення зірочки та підсвічування рядка для найстаріших дільниць
        const starBadge = parcel.isOldestThird ? '⭐ ' : '';
        const rowBgStyle = parcel.isOldestThird ? 'background-color: #fffbeb;' : '';

        rowsHtml += `
            <tr style="border-bottom: 1px solid #f1f5f9; ${rowBgStyle}">
                <td style="padding: 10px; text-align: center; font-weight: bold; color: #94a3b8;">${idx + 1}</td>
                <td style="padding: 10px;"><b>${starBadge}№${parcel.name || 'без назви'}</b></td>
                <td style="padding: 10px; text-align: center; white-space: nowrap;">${formattedDate}</td>
                <td style="padding: 10px; text-align: center; font-weight: 600; color: #d97706; white-space: nowrap;">${idleText}</td>
            </tr>
        `;
    });

    const numIcon = sortState.sortField === 'num'
        ? (sortState.sortOrder === 'asc' ? ' ↑' : ' ↓')
        : ' <span style="color: #cbd5e1; font-weight: normal;">↕</span>';

    const idleIcon = sortState.sortField === 'idle'
        ? (sortState.sortOrder === 'asc' ? ' ↑' : ' ↓')
        : ' <span style="color: #cbd5e1; font-weight: normal;">↕</span>';

    tableContainer.innerHTML = `
        <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
            <thead>
                <tr style="background: #f8fafc; color: #475569; border-bottom: 2px solid #e2e8f0; text-align: left;">
                    <th style="padding: 8px 10px; text-align: center;">№</th>
                    <th onclick="window.toggleBlockSort(${groupIndex}, 'num')" 
                        style="padding: 8px 10px; cursor: pointer; user-select: none;" 
                        title="Клікніть для сортування за номером дільниці">
                        Дільниця${numIcon}
                    </th>
                    <th style="padding: 8px 10px; text-align: center;">
                        Останнє опрацювання
                    </th>
                    <th onclick="window.toggleBlockSort(${groupIndex}, 'idle')" 
                        style="padding: 8px 10px; text-align: center; cursor: pointer; user-select: none;" 
                        title="Клікніть для сортування за часом простою">
                        Час простою${idleIcon}
                    </th>
                </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
        </table>
    `;
}

/**
 * 📍 ФУНКЦІЯ ВИЗНАЧЕННЯ ГЕОЛОКАЦІЇ ТА ОНОВЛЕННЯ ВІДСТАНЕЙ
 */
function requestUserLocation() {
    const btn = document.getElementById('geo-locate-btn');
    if (!btn) return;

    if (!navigator.geolocation) {
        alert('Ваш браузер або пристрій не підтримує геолокацію.');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = `⏳ Визначення вашої геопозиції...`;

    navigator.geolocation.getCurrentPosition(
        (position) => {
            window.userCoordinates = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };

            btn.style.background = '#059669';
            btn.innerHTML = `✅ Готово!`;
            btn.disabled = false;

            // Перемальовуємо списки блоків із врахуванням відстані
            renderBlocksList();
        },
        (error) => {
            console.error("⚠️ Помилка отримання геолокації:", error);
            btn.disabled = false;
            btn.style.background = '#dc2626';

            let msg = 'Не вдалося отримати ваше місцезнаходження.';
            if (error.code === error.PERMISSION_DENIED) {
                msg = 'Доступ до геолокації відхилено. Будь ласка, дозвольте доступ у налаштуваннях браузера.';
            } else if (error.code === error.POSITION_UNAVAILABLE) {
                msg = 'Інформація про місцезнаходження недоступна.';
            } else if (error.code === error.TIMEOUT) {
                msg = 'Час очікування визначення геопозиції вичерпано.';
            }
            alert(msg);
            btn.innerHTML = `📍 Спробувати знову (визначити геолокацію)`;
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

/**
 * 🎨 ВІДОБРАЖЕННЯ ВСІХ ГЕО-БЛОКІВ ТА ТАБЛИЦЬ
 */
function renderBlocksList() {
    const container = document.getElementById('geo-blocks-list-container');
    if (!container || !window.renderedGeoGroups) return;

    let groupsWithMeta = window.renderedGeoGroups.map((group, originalIndex) => {
        const centroid = calculateGroupCentroid(group);
        let distanceMeters = null;

        if (window.userCoordinates && centroid) {
            distanceMeters = getDistanceMeters(
                window.userCoordinates.lat,
                window.userCoordinates.lng,
                centroid.lat,
                centroid.lng
            );
        }

        return {
            group,
            originalIndex,
            centroid,
            distanceMeters
        };
    });

    // Якщо геолокацію визначено — сортуємо блоки від найближчого до найвіддаленішого
    if (window.userCoordinates) {
        groupsWithMeta.sort((a, b) => {
            if (a.distanceMeters === null) return 1;
            if (b.distanceMeters === null) return -1;
            return a.distanceMeters - b.distanceMeters;
        });
    }

    let blocksHtml = '';

    groupsWithMeta.forEach((item, displayIndex) => {
        const { group, originalIndex, distanceMeters } = item;
        const groupParcelIds = group.map(p => p.id).filter(Boolean).join(',');
        const blockMapUrl = `index.html?recommend_ids=${groupParcelIds}&from=recommended`;
        const groupCount = group.length;
        const groupWord = getPluralWord(groupCount);

        let distanceBadgeHtml = '';
        if (distanceMeters !== null) {
            const distText = formatDistance(distanceMeters);
            distanceBadgeHtml = `
                <span style="background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; padding: 3px 8px; border-radius: 12px; font-size: 0.82rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                    📏 До вас: ${distText}
                </span>
            `;
        }

        blocksHtml += `
            <div class="card" style="margin-bottom: 16px; padding: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                    <h3 style="margin: 0; font-size: 1.05rem; color: #1565C0; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <span>📍</span> Гео-блок #${originalIndex + 1} 
                        <span style="font-size: 0.85rem; font-weight: normal; color: #64748b;">(${groupCount} ${groupWord})</span>
                        ${distanceBadgeHtml}
                    </h3>
                    
                    <a href="${blockMapUrl}" 
                       style="display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; background: #2e7d32; color: #fff; text-decoration: none; border-radius: 6px; font-size: 0.85rem; font-weight: 600; transition: background 0.2s;"
                       onmouseover="this.style.background='#1b5e20'" 
                       onmouseout="this.style.background='#2e7d32'">
                        🗺️ Показати цей блок на карті
                    </a>
                </div>
                <div id="block-table-container-${originalIndex}" style="overflow-x: auto;">
                </div>
            </div>
        `;
    });

    container.innerHTML = blocksHtml;

    // Малюємо вміст таблиць
    groupsWithMeta.forEach(item => {
        renderSingleBlockTable(item.originalIndex);
    });
}

/**
 * 📋 ФОНОВІ ФУНКЦІЇ ДЛЯ РЕНДЕРУ ПЛОСКОГО СПИСКУ З ЗІРОЧКАМИ
 */
function toggleFlatListSort(field) {
    if (window.flatListSortState.sortField === field) {
        window.flatListSortState.sortOrder = window.flatListSortState.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
        window.flatListSortState.sortField = field;
        window.flatListSortState.sortOrder = 'asc';
    }
    renderFlatParcelsTable();
}

function renderFlatParcelsTable() {
    const tableContainer = document.getElementById('flat-parcels-table-container');
    if (!tableContainer || !window.flatParcelsList) return;

    const list = [...window.flatParcelsList];
    const { sortField, sortOrder } = window.flatListSortState;

    list.sort((a, b) => {
        if (sortField === 'num') {
            const numA = extractNumberForSort(a.name);
            const numB = extractNumberForSort(b.name);
            if (numA !== numB) return sortOrder === 'asc' ? numA - numB : numB - numA;
            return sortOrder === 'asc'
                ? (a.name || '').localeCompare(b.name || '', 'uk', { numeric: true })
                : (b.name || '').localeCompare(a.name || '', 'uk', { numeric: true });
        } else {
            if (!a.last_returned && !b.last_returned) return 0;
            if (!a.last_returned) return 1;
            if (!b.last_returned) return -1;
            const timeA = new Date(a.last_returned).getTime();
            const timeB = new Date(b.last_returned).getTime();
            return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
        }
    });

    let rowsHtml = '';
    list.forEach((parcel, idx) => {
        const idleText = calculateIdleTime(parcel.last_returned);
        const formattedDate = formatDate(parcel.last_returned);
        const starBadge = parcel.isOldestThird ? '⭐ ' : '';
        const mapUrl = `index.html?recommend_ids=${parcel.id}&from=recommended${parcel.isOldestThird ? '&draw_stars=1' : ''}`;

        rowsHtml += `
            <tr style="border-bottom: 1px solid #f1f5f9; ${parcel.isOldestThird ? 'background-color: #fffbeb;' : ''}">
                <td style="padding: 10px; text-align: center; font-weight: bold; color: #94a3b8;">${idx + 1}</td>
                <td style="padding: 10px;"><b>${starBadge}№${parcel.name || 'без назви'}</b></td>
                <td style="padding: 10px; text-align: center; white-space: nowrap;">${formattedDate}</td>
                <td style="padding: 10px; text-align: center; font-weight: 600; color: #d97706; white-space: nowrap;">${idleText}</td>
                <td style="padding: 10px; text-align: center;">
                    <a href="${mapUrl}" target="_blank" 
                       style="display: inline-flex; align-items: center; gap: 4px; padding: 6px 10px; background: #2e7d32; color: #fff; text-decoration: none; border-radius: 6px; font-size: 0.82rem; font-weight: 600; white-space: nowrap;">
                        🗺️ На карту
                    </a>
                </td>
            </tr>
        `;
    });

    const numIcon = sortField === 'num' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ' <span style="color: #cbd5e1;">↕</span>';
    const idleIcon = sortField === 'idle' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ' <span style="color: #cbd5e1;">↕</span>';

    tableContainer.innerHTML = `
        <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
            <thead>
                <tr style="background: #f8fafc; color: #475569; border-bottom: 2px solid #e2e8f0; text-align: left;">
                    <th style="padding: 10px; text-align: center;">№</th>
                    <th onclick="window.toggleFlatListSort('num')" style="padding: 10px; cursor: pointer; user-select: none;" title="Сортувати за номером">
                        Дільниця${numIcon}
                    </th>
                    <th style="padding: 10px; text-align: center;">Останнє опрацювання</th>
                    <th onclick="window.toggleFlatListSort('idle')" style="padding: 10px; text-align: center; cursor: pointer; user-select: none;" title="Сортувати за часом простою">
                        Час простою${idleIcon}
                    </th>
                    <th style="padding: 10px; text-align: center;">Дія</th>
                </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
        </table>
    `;
}

/**
 * 🔄 ПЕРЕМКАННЯ ТАБІВ ("Гео-блоки" та "Список")
 */
function switchRecTab(tabName) {
    const btnBlocks = document.getElementById('tab-btn-geoblocks');
    const btnList = document.getElementById('tab-btn-flatlist');
    const contentBlocks = document.getElementById('tab-content-geoblocks');
    const contentList = document.getElementById('tab-content-flatlist');

    if (!btnBlocks || !btnList || !contentBlocks || !contentList) return;

    // Спільні стилі для обох табів (вигляд вкладок папки: радіус тільки зверху)
    const baseTabStyle = "padding: 10px 20px; font-weight: 600; cursor: pointer; border-radius: 8px 8px 0 0; position: relative; font-size: 0.92rem; transition: all 0.2s ease;";

    if (tabName === 'geoblocks') {
        // Активний таб "Гео-блоки" (зливається з контентом, перекриває лінію)
        btnBlocks.style.cssText = baseTabStyle + " background: #ffffff; color: #1565C0; border: 2px solid #e2e8f0; border-bottom: 2px solid #ffffff; margin-bottom: -2px; z-index: 2;";
        
        // Неактивний таб "Список" (сірий, смуга знизу залишається)
        btnList.style.cssText = baseTabStyle + " background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; border-bottom: none; margin-bottom: 0; z-index: 1;";

        contentBlocks.style.display = 'block';
        contentList.style.display = 'none';
    } else {
        // Активний таб "Список"
        btnList.style.cssText = baseTabStyle + " background: #ffffff; color: #1565C0; border: 2px solid #e2e8f0; border-bottom: 2px solid #ffffff; margin-bottom: -2px; z-index: 2;";
        
        // Неактивний таб "Гео-блоки"
        btnBlocks.style.cssText = baseTabStyle + " background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; border-bottom: none; margin-bottom: 0; z-index: 1;";

        contentList.style.display = 'block';
        contentBlocks.style.display = 'none';

        if (typeof renderFlatParcelsTable === 'function') {
            renderFlatParcelsTable();
        }
    }
}

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

function drawBlockBoundary(groupParcels, color) {
    if (!window.map || !groupParcels || groupParcels.length === 0) return null;
    if (typeof turf === 'undefined') {
        console.warn("⚠️ Бібліотека Turf.js не підключена в index.html. Контури блоків не побудовано.");
        return null;
    }

    try {
        const geojsonFeatures = groupParcels.map(p => {
            if (p.geom) {
                const geomObj = typeof p.geom === 'string' ? JSON.parse(p.geom) : p.geom;
                return {
                    type: "Feature",
                    geometry: geomObj,
                    properties: p
                };
            }
            return null;
        }).filter(Boolean);

        if (geojsonFeatures.length === 0) return null;

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

        const boundaryLayer = L.geoJSON(combined, {
            style: {
                color: color,
                weight: 3,
                opacity: 0.9,
                fillColor: color,
                fillOpacity: 0.15,
                dashArray: '6, 6',
                interactive: false
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

        window.renderedGeoGroups = groups;
        window.blockSortStates = {}; // Скидаємо попередні стани сортування

        // 🧮 ОБЧИСЛЕННЯ ЗІРОЧОК ДЛЯ ВЕСЬ СПИСОК (І ДЛЯ ГЕО-БЛОКІВ)
        const now = new Date();
        const MS_PER_DAY = 24 * 60 * 60 * 1000;
        const validIdleDays = filtered
            .map(p => {
                if (!p.last_returned) return Infinity;
                return (now - new Date(p.last_returned)) / MS_PER_DAY;
            })
            .filter(days => days !== Infinity && !isNaN(days));

        let starThresholdDays = Infinity;
        if (validIdleDays.length > 0) {
            const minIdleDays = Math.min(...validIdleDays);
            const maxIdleDays = Math.max(...validIdleDays);
            const idleRange = maxIdleDays - minIdleDays;
            starThresholdDays = maxIdleDays - (idleRange / 3);
        }

        filtered.forEach(p => {
            const idleDays = !p.last_returned ? Infinity : (now - new Date(p.last_returned)) / MS_PER_DAY;
            p.isOldestThird = idleDays === Infinity || idleDays >= starThresholdDays;
        });

        window.flatParcelsList = filtered;
        window.flatStarThresholdDays = starThresholdDays;

        // Збереження центроїдів найстаріших дільниць для карти
        const starParcels = filtered.filter(p => p.isOldestThird);
        const starParcelsObjects = starParcels.map(item => ({
            id: item.id,
            name: item.name || item.parcel_number || item.id,
            centroid: item._centroid || { lat: null, lng: null }
        }));
        localStorage.setItem('star_parcels_data', JSON.stringify(starParcelsObjects));

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

        let controlsHtml = '';
        if (allRecommendedIds.length > 0) {
            const allMapUrl = `index.html?recommend_ids=all&from=recommended`;
            const totalCount = filtered.length;
            const totalWord = getPluralWord(totalCount);

            controlsHtml = `
                <div style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
                    <button id="geo-locate-btn" onclick="window.requestUserLocation()" 
                        style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px; background: #2563eb; color: #fff; border: none; border-radius: 8px; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: background 0.2s;"
                        onmouseover="this.style.background='#1d4ed8'" 
                        onmouseout="this.style.background='#2563eb'">
                        📍 Знайти найближчий
                    </button>

                    <a href="${allMapUrl}" 
                       style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px; background: #1565C0; color: #fff; text-decoration: none; border-radius: 8px; font-size: 0.92rem; font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.08); transition: background 0.2s;"
                       onmouseover="this.style.background='#0d47a1'" 
                       onmouseout="this.style.background='#1565C0'">
                       🗺️ Показати ВСІ гео-блоки на карті (${totalCount} ${totalWord})
                    </a>
                </div>
            `;
        }

        groups.forEach((_, groupIndex) => {
            window.blockSortStates[groupIndex] = { sortField: 'idle', sortOrder: 'asc' };
        });

        const thresholdText = formatThresholdTime(starThresholdDays);
        const allMapStarsUrl = `index.html?recommend_ids=${filtered.map(p => p.id).join(',')}&from=recommended&draw_stars=1`;

        // 🏛️ ПЕРЕМИКАЧ ТАБІВ І СТРУКТУРА ЗВІТУ
        const tabsHeaderHtml = `
            <div style="display: flex; gap: 6px; margin-bottom: 20px; border-bottom: 2px solid #e2e8f0; position: relative; z-index: 1;">
                <button id="tab-btn-geoblocks" onclick="window.switchRecTab('geoblocks')" 
                    style="padding: 10px 20px; font-weight: 600; cursor: pointer; border-radius: 8px 8px 0 0; position: relative; font-size: 0.92rem; transition: all 0.2s ease; background: #ffffff; color: #1565C0; border: 2px solid #e2e8f0; border-bottom: 2px solid #ffffff; margin-bottom: -2px; z-index: 2;">
                    📍 Гео-блоки (${groups.length})
                </button>
                <button id="tab-btn-flatlist" onclick="window.switchRecTab('flatlist')" 
                    style="padding: 10px 20px; font-weight: 600; cursor: pointer; border-radius: 8px 8px 0 0; position: relative; font-size: 0.92rem; transition: all 0.2s ease; background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; border-bottom: none; margin-bottom: 0; z-index: 1;">
                    📋 Рекомендовані дільниці (${filtered.length})
                </button>
            </div>
        `;

        const starNoticeHtml = `
            <div style="font-size: 0.82rem; color: #854d0e; background: #fef3c7; border: 1px solid #fde68a; padding: 6px 10px; border-radius: 6px; margin-bottom: 12px;">
                ⭐ Зірочкою позначено найстаріші за часом простою дільниці (понад ${thresholdText} простою)
            </div>
        `;

        const flatListTabContent = `
            <div id="tab-content-flatlist" style="display: none;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                    <h3 style="margin: 0; color: #1e293b;">📋 Рекомендовані дільниці (${filtered.length})</h3>
                    <a href="${allMapStarsUrl}" style="padding: 8px 14px; background: #1565C0; color: #fff; text-decoration: none; border-radius: 6px; font-size: 0.85rem; font-weight: 600;">
                        🗺️ Показати всі на карті (⭐ ${starParcels.length})
                    </a>
                </div>
                ${starNoticeHtml}
                <div id="flat-parcels-table-container" style="overflow-x: auto;"></div>
            </div>
        `;

        const geoBlocksTabContent = `
            <div id="tab-content-geoblocks">
                ${controlsHtml}
                ${starNoticeHtml}
                <div id="geo-blocks-list-container"></div>
            </div>
        `;

        contentDiv.innerHTML = noticeHtml + tabsHeaderHtml + geoBlocksTabContent + flatListTabContent;

        renderBlocksList();

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
async function showRecommendedOnMap(radiusMeters = 500, minIdleMonths = 'auto', targetIds = null) {
    try {
        localStorage.setItem('geoblocks_active_mode', 'recommended');

        const { groups, allRecommendedIds } = await computeRecommendedParcels(radiusMeters, minIdleMonths);

        if (!allRecommendedIds || allRecommendedIds.length === 0) {
            alert('Рекомендованих ділянок за заданими критеріями не знайдено.');
            return [];
        }

        const activeIds = (Array.isArray(targetIds) && targetIds.length > 0)
            ? targetIds
            : allRecommendedIds;

        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('recommend_ids', activeIds.join(','));
        newUrl.searchParams.set('from', 'recommended');
        window.history.pushState({}, '', newUrl);

        if (typeof window.displayParcelsByIds === 'function') {
            window.displayParcelsByIds(activeIds);
        } else if (typeof window.handleUrlParams === 'function') {
            await window.handleUrlParams();
        }

        clearBlockBoundaries();

        groups.forEach((group, index) => {
            const groupParcelIds = group.map(p => p.id);
            const isTargetGroup = !targetIds || groupParcelIds.some(id => targetIds.includes(id));

            if (isTargetGroup) {
                const color = BLOCK_COLORS[index % BLOCK_COLORS.length];
                const boundary = drawBlockBoundary(group, color);
                if (boundary) {
                    window.currentBlockBoundaries.push(boundary);
                }
            }
        });

        if (typeof window.fitMapToParcelIds === 'function') {
            window.fitMapToParcelIds(activeIds);
        }

        if (typeof window.drawStarsOnMapPolygons === 'function') {
            window.drawStarsOnMapPolygons();
        }

        return activeIds;
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
window.toggleBlockSort = toggleBlockSort;
window.requestUserLocation = requestUserLocation;
window.switchRecTab = switchRecTab;
window.toggleFlatListSort = toggleFlatListSort;
window.renderFlatParcelsTable = renderFlatParcelsTable;
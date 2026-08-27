(async function generateFlatRecommendedParcelsTable() {
    console.log("⏳ Обчислення рекомендованих дільниць за часовим інтервалом...");

    async function getSupabase() {
        if (window.supabase) return window.supabase;
        try {
            const configModule = await import('./config.js');
            if (configModule && configModule.supabase) return configModule.supabase;
        } catch (e) { }
        return null;
    }

    const supabaseClient = await getSupabase();
    if (!supabaseClient) {
        console.error("❌ Не вдалося знайти екземпляр Supabase.");
        return;
    }

    const isAuth = !!localStorage.getItem('userId');
    const targetSource = isAuth ? 'parcels' : 'public_parcels_map_mirror';

    const { data: allParcels, error } = await supabaseClient.from(targetSource).select('*');
    if (error) {
        console.error("❌ Помилка завантаження дільниць:", error);
        return;
    }

    const now = new Date();
    const MS_PER_DAY = 24 * 60 * 60 * 1000;

    let baseFreeParcels = allParcels.filter(parcel => {
        const status = (parcel.status || '').toLowerCase().trim();
        const isFree = status === 'free' || status === 'вільна' || status === 'доступна' || status === '';
        if (!isFree) return false;

        const name = (parcel.name || '').toLowerCase();
        const category = (parcel.category || '').toLowerCase();
        const isVillage = category.includes('село') || name.includes('с.') || category.includes('с.');
        return !isVillage;
    });

    function getIdleDays(lastReturnedDateStr) {
        if (!lastReturnedDateStr) return Infinity;
        const diffMs = now - new Date(lastReturnedDateStr);
        return diffMs / MS_PER_DAY;
    }

    function getIdleMonths(lastReturnedDateStr) {
        return getIdleDays(lastReturnedDateStr) / 30.44;
    }

    const count12 = baseFreeParcels.filter(p => getIdleMonths(p.last_returned) >= 12).length;
    const targetMonths = count12 < 4 ? 10 : 12;

    let recommendedParcels = baseFreeParcels.filter(p => getIdleMonths(p.last_returned) >= targetMonths);

    if (recommendedParcels.length === 0) {
        alert("Рекомендованих дільниць за вказаними критеріями не знайдено.");
        return;
    }

    // 🧮 ЧАСОВИЙ РОЗРАХУНОК ВЕРХНЬОЇ 1/3 ШКАЛИ ПРОСТОЮ
    const validIdleDays = recommendedParcels
        .map(p => getIdleDays(p.last_returned))
        .filter(days => days !== Infinity && !isNaN(days));

    let starThresholdDays = Infinity;
    if (validIdleDays.length > 0) {
        const minIdleDays = Math.min(...validIdleDays);
        const maxIdleDays = Math.max(...validIdleDays);
        const idleRange = maxIdleDays - minIdleDays;

        starThresholdDays = maxIdleDays - (idleRange / 3);
    }

    recommendedParcels.forEach(p => {
        const idleDays = getIdleDays(p.last_returned);
        p.isOldestThird = idleDays === Infinity || idleDays >= starThresholdDays;
    });

    // Отримуємо дільниці зі зірочками
    const starParcels = recommendedParcels.filter(p => p.isOldestThird);

    // 📍 ФОРМУВАННЯ ДАНИХ З ЦЕНТРОЇДАМИ (з фолбеком на Leaflet)
    const starParcelsObjects = starParcels.map(item => {
        let lat = null;
        let lng = null;

        if (item.lat && item.lng) {
            lat = parseFloat(item.lat);
            lng = parseFloat(item.lng);
        } else if (item.center) {
            lat = item.center.lat || item.center[0];
            lng = item.center.lng || item.center[1];
        } else if (window.allParcelLayers) {
            // Фолбек: шукаємо геометрію в Leaflet
            const mapLayer = window.allParcelLayers.find(l => String(l.id) === String(item.id));
            if (mapLayer && mapLayer.layer && mapLayer.layer.getBounds) {
                const center = mapLayer.layer.getBounds().getCenter();
                lat = center.lat;
                lng = center.lng;
            }
        }

        return {
            id: item.id,
            name: item.name || item.parcel_number || item.id,
            centroid: { lat, lng }
        };
    });

    localStorage.setItem('star_parcels_data', JSON.stringify(starParcelsObjects));

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

    function extractNumberForSort(str) {
        const match = (str || '').toString().match(/\d+/);
        return match ? parseInt(match[0], 10) : Infinity;
    }

    window.flatParcelsList = recommendedParcels;
    window.flatListSortState = { sortField: 'idle', sortOrder: 'asc' };

    window.toggleFlatListSort = function(field) {
        if (window.flatListSortState.sortField === field) {
            window.flatListSortState.sortOrder = window.flatListSortState.sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
            window.flatListSortState.sortField = field;
            window.flatListSortState.sortOrder = 'asc';
        }
        window.renderFlatParcelsTable();
    };

    window.renderFlatParcelsTable = function() {
        const tableContainer = document.getElementById('flat-parcels-table-container');
        if (!tableContainer) return;

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
    };

    let targetContainer = document.getElementById('recommended-parcels-content') || document.getElementById('geo-blocks-list-container');

    if (!targetContainer) {
        let modal = document.getElementById('custom-parcels-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'custom-parcels-modal';
            modal.style.cssText = 'position:fixed; top:20px; right:20px; width:650px; max-height:85vh; background:#fff; z-index:99999; box-shadow:0 10px 25px rgba(0,0,0,0.2); border-radius:12px; padding:20px; overflow-y:auto; font-family:sans-serif;';
            document.body.appendChild(modal);
        }
        targetContainer = modal;
    }

    const allMapUrl = `index.html?recommend_ids=${recommendedParcels.map(p => p.id).join(',')}&from=recommended&draw_stars=1`;
    const thresholdText = formatThresholdTime(starThresholdDays);

    targetContainer.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
            <h3 style="margin: 0; color: #1e293b;">📋 Рекомендовані дільниці (${recommendedParcels.length})</h3>
            <a href="${allMapUrl}" style="padding: 8px 14px; background: #1565C0; color: #fff; text-decoration: none; border-radius: 6px; font-size: 0.85rem; font-weight: 600;">
                🗺️ Показати всі на карті (⭐ ${starParcels.length})
            </a>
        </div>
        <div style="font-size: 0.82rem; color: #854d0e; background: #fef3c7; border: 1px solid #fde68a; padding: 6px 10px; border-radius: 6px; margin-bottom: 12px;">
            ⭐ Зірочкою позначено найстаріші за часом простою дільниці (понад ${thresholdText} простою)
        </div>
        <div id="flat-parcels-table-container" style="overflow-x: auto;"></div>
    `;

    window.renderFlatParcelsTable();

    if (typeof window.drawStarsOnMapPolygons === 'function') {
        window.drawStarsOnMapPolygons();
    }

    console.log(`✅ Згенеровано за часовим методом. Зірочку ⭐ отримали ${starParcels.length} найстаріших дільниць.`);
})();
/**
 * recommended-parcels.js
 * Формування та відображення гео-блоків рекомендованих ділянок
 */

let currentRadiusMeters = 400;
let currentMinIdleMonths = 'auto'; // 'auto' або число (12, 10, 8, 6)

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

async function loadRecommendedParcels(radiusMeters, minIdleMonths) {
    if (radiusMeters) {
        currentRadiusMeters = parseInt(radiusMeters, 10) || 400;
    }
    if (minIdleMonths !== undefined) {
        currentMinIdleMonths = minIdleMonths;
    }

    // Синхронізуємо елементи керування, якщо вони є на сторінці
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

        // Допоміжна функція перевірки простою в місяцях (приблизно 30.44 днів на місяць)
        function getIdleMonths(lastReturnedDateStr) {
            if (!lastReturnedDateStr) return Infinity; // Якщо ніколи не опрацьовувалася — нескінченний простій
            const diffMs = now - new Date(lastReturnedDateStr);
            return diffMs / (30.44 * MS_PER_DAY);
        }

        let targetMonths = 12;
        let isAutoExpanded = false;

        if (currentMinIdleMonths === 'auto') {
            // Перевіряємо скільки дільниць > 12 місяців
            const count12 = baseFreeParcels.filter(p => getIdleMonths(p.last_returned) >= 12).length;
            if (count12 < 4) {
                targetMonths = 10;
                isAutoExpanded = true;
            } else {
                targetMonths = 12;
            }
        } else {
            targetMonths = parseInt(currentMinIdleMonths, 10) || 12;
        }

        // Остаточна фільтрація за потрібним терміном простою
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

                    if (dist <= currentRadiusMeters) {
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

        // Інформаційне повідомлення про авто-розширення
        let noticeHtml = '';
        if (isAutoExpanded) {
            noticeHtml = `
                <div style="background: #fffbebf5; border: 1px solid #fcd34d; color: #92400e; padding: 10px 14px; border-radius: 8px; margin-bottom: 16px; font-size: 0.88rem; display: flex; align-items: center; gap: 8px;">
                    <span>💡</span> 
                    <span>Знайдено менше 4 дільниць з простоєм понад 12 місяців. Критерій автоматично розширено до <b>понад 10 місяців</b>.</span>
                </div>
            `;
        }

        // Генерація HTML
        let globalCounter = 1;
        let blocksHtml = noticeHtml;

        groups.forEach((group, groupIndex) => {
            let rowsHtml = "";

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

            blocksHtml += `
                <div class="card" style="margin-bottom: 16px; padding: 16px; overflow-x: auto;">
                    <h3 style="margin: 0 0 12px 0; font-size: 1.05rem; color: #1565C0; display: flex; align-items: center; gap: 8px;">
                        <span>📍</span> Гео-блок #${groupIndex + 1} 
                        <span style="font-size: 0.85rem; font-weight: normal; color: #64748b;">(${group.length} дільн. у радіусі ${currentRadiusMeters}м)</span>
                    </h3>
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

window.loadRecommendedParcels = loadRecommendedParcels;
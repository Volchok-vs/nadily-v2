/**
 * Map Initialization & Parcel Logic
 */
import { supabase } from './config.js';
import { getParcelStyle } from './map-styles.js';

// Глобальні змінні
window.allParcelLayers = [];

document.addEventListener('DOMContentLoaded', async () => {
    initMainMap();
    await loadParcels();
});

function initMainMap() {
    // Налаштування шарів (Супутник + Підписи)
    const satelliteOnly = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}');
    const labels = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', { pane: 'shadowPane' });
    const satelliteHybrid = L.layerGroup([satelliteOnly, labels]);

    // Перевіряємо, чи це мобільний пристрій (ширина менше 768px)
    const isMobile = window.innerWidth <= 768;

    window.map = L.map('map', {
        center: [49.2321, 29.0577],
        zoom: 15,
        layers: [satelliteHybrid],
        zoomControl: !isMobile // Вимикаємо кнопки масштабу, якщо це мобільний
    });

    // Якщо це НЕ мобільний, можна явно вказати позицію кнопок (опціонально)
    if (!isMobile) {
        L.control.zoom({
            position: 'topright'
        }).addTo(map);
    }
}

async function loadParcels() {
    // Завантажуємо всі дані (включаючи категорію та дату повернення для стилів)
    const { data: parcels, error } = await supabase.from('parcels').select('*');
    
    if (error) {
        console.error("Помилка Supabase:", error);
        return;
    }

    const currentUserId = localStorage.getItem('userId');
    const role = localStorage.getItem('userRole');
    const isAdmin = (role === 'admin' || role === 'super_admin');
    const isAuth = !!currentUserId;

    parcels.forEach(p => {
        if (!p.geom) return;

        // Викликаємо імпортовану функцію стилю
        const layer = L.geoJSON(p.geom, {
            style: () => getParcelStyle(p)
        }).addTo(map);

        // --- ЛОГІКА MULTIPOLYGON (ПУНКТИРИ) ---
        if (p.geom.type === 'MultiPolygon' || p.geom.type === 'Multipolygon') {
            const currentStyle = getParcelStyle(p);
            const anchor = (p.label_pos?.length === 2) 
                ? L.latLng(p.label_pos[0], p.label_pos[1]) 
                : layer.getBounds().getCenter();

            p.geom.coordinates.forEach(polyCoords => {
                const coords = polyCoords[0].map(c => [c[1], c[0]]);
                const part = L.polygon(coords);
                if (!part.getBounds().contains(anchor)) {
                    const line = L.polyline([part.getBounds().getCenter(), anchor], {
                        color: currentStyle.color || '#a1a1a1', 
                        weight: 2, 
                        dashArray: '5, 10', 
                        opacity: 0.6, 
                        interactive: false
                    }).addTo(map);

                    // Видаляємо лінію, якщо видаляється шар
                    layer.on('remove', () => map.removeLayer(line));
                }
            });
        }

        // Підпис номера дільниці
        const labelPos = (p.label_pos?.length === 2) 
            ? L.latLng(p.label_pos[0], p.label_pos[1]) 
            : layer.getBounds().getCenter();

        layer.bindTooltip(p.name || "", {
            permanent: true, 
            direction: 'center', 
            className: 'parcel-label'
        }).openTooltip(labelPos);

        window.allParcelLayers.push({ layer, name: p.name.toString().toLowerCase(), data: p });

        // Клік на дільницю
        layer.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            renderParcelPopup(layer, p, isAdmin, isAuth, currentUserId);
        });
    });
}

/**
 * Функція генерації попапа
 */
function renderParcelPopup(layer, p, isAdmin, isAuth, currentUserId) {
    const isTaken = p.status === 'taken';
    const now = new Date();
    const returnDate = p.last_returned ? new Date(p.last_returned) : new Date(0);
    const quarantineEndDate = new Date(returnDate);
    quarantineEndDate.setMonth(quarantineEndDate.getMonth() + 3);
    const isQuarantine = now < quarantineEndDate;
    const qDateStr = quarantineEndDate.toLocaleDateString('uk-UA');
    
    const center = layer.getBounds().getCenter();
    const shareLink = `${window.location.origin}${window.location.pathname}?parcel=${p.name}`;
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${center.lat},${center.lng}`;

    let popupHtml = `
        <div class="popup-container">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 5px;">
                <span class="popup-title">Дільниця ${p.name}</span>
                <button onclick="window.shareParcel('${p.name}', '${shareLink}')" style="border:none; background:none; cursor:pointer; font-size:18px;">📤</button>
            </div>

            ${(!isTaken && isQuarantine) ? `
                <div class="quarantine-warning" style="font-size:12px; text-align:center; padding:8px; margin-bottom:10px;">
                    ⚠️ Карантин до <b>${qDateStr}</b>
                </div>` : ''}

            <div class="popup-status" style="margin-bottom:10px; text-align:center;">
                Статус: <span style="color:${isTaken ? '#e74c3c' : (isQuarantine ? '#808080' : '#28a745')}">
                    ● ${isTaken ? 'Зайнята' : (isQuarantine ? 'Карантин' : 'Вільна')}
                </span>
            </div>

            <div class="popup-btn-row">
                <button class="popup-btn" onclick="window.open('${googleMapsUrl}', '_blank')">📍 Маршрут</button>
                ${isAdmin ? `<a href="parcel-details.html?id=${p.id}" class="popup-btn">⚙️ Картка</a>` : ''}
            </div>

            ${!isTaken ? 
                (isQuarantine ? 
                    (isAdmin ? 
                        `<button class="popup-btn primary" onclick="window.showTakeModal(${p.id}, '${p.name}')">✋ Взяти (Адмін)</button>` : 
                        `<p style="font-size:11px; color:#888; text-align:center;">На обробці до ${qDateStr}</p>`) 
                    : (isAuth ? 
                        `<button class="popup-btn primary" onclick="window.showTakeModal(${p.id}, '${p.name}')">✋ Взяти дільницю</button>` : 
                        `<p style="font-size:11px; color:orange; text-align:center;">Увійдіть, щоб взяти</p>`)
                ) : 
                ((isAdmin || (isAuth && String(p.taken_by_id) === String(currentUserId))) ? 
                    `<button class="popup-btn" style="border:1px solid #dc3545; color:#dc3545;" onclick="window.returnParcel(${p.id})">🔙 Здати дільницю</button>` : 
                    `<div style="text-align:center; font-size:11px; color:#666;">Взяв: ${p.taken_by || 'Невідомо'}</div>`)
            }
        </div>`;

    layer.bindPopup(popupHtml, { minWidth: 200 }).openPopup();
}
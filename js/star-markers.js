// js/star-markers.js

(function () {
    console.log("⭐ [StarMarkers] Скрипт маркерів-зірочок успішно завантажено в пам'ять.");

    window.starMarkersGroup = window.starMarkersGroup || L.layerGroup();

    // 📏 Розрахунок font-size та зсуву (10px для зуму >= 15)
    function getStarParams(zoom) {
        if (zoom < 13) {
            return { fontSize: 0, offsetX: 0, visible: false };
        }

        let fontSize = 19;
        if (zoom === 17) fontSize = 16;
        if (zoom === 16) fontSize = 13;
        if (zoom === 15) fontSize = 10;
        if (zoom === 14) fontSize = 8;
        if (zoom === 13) fontSize = 6;

        // 🎯 Фіксований зсув 10px для зуму 15 і вище, для решти — мінімальний бічний
        let offsetX = Math.round(fontSize * 0.15);
        if (zoom >= 15) {
            offsetX = 10;
        }

        return { fontSize, offsetX, visible: true };
    }

    // 🔄 Динамічне оновлення розміру, зсуву та видимості при зумі
    function updateStarSizes() {
        if (!window.map) return;
        const zoom = window.map.getZoom();
        const { fontSize, offsetX, visible } = getStarParams(zoom);

        const elements = document.querySelectorAll('.custom-star-polygon-marker .star-icon-body');
        elements.forEach(el => {
            if (!visible) {
                el.style.display = 'none';
            } else {
                el.style.display = 'block';
                el.style.fontSize = `${fontSize}px`;
                el.style.transform = `translate(${offsetX}px, -50%)`;
            }
        });
    }

    window.drawStarsOnMapPolygons = function () {
        if (!window.map || !window.allParcelLayers || window.allParcelLayers.length === 0) return;

        if (!window.map.hasLayer(window.starMarkersGroup)) {
            window.starMarkersGroup.addTo(window.map);
        }
        window.starMarkersGroup.clearLayers();

        const urlParams = new URLSearchParams(window.location.search);
        const recommendParam = urlParams.get('recommend_ids');
        if (!recommendParam) return;

        const targetIds = recommendParam.split(',').map(id => id.trim());

        const freeMatchedParcels = window.allParcelLayers.filter(item => {
            if (!item.id || !targetIds.includes(String(item.id))) return false;
            const status = item.data && item.data.status ? item.data.status.toLowerCase().trim() : '';
            return status === 'free' || status === 'вільна' || status === 'доступна' || status === '';
        });

        if (freeMatchedParcels.length === 0) return;

        const now = new Date();
        const MS_PER_DAY = 24 * 60 * 60 * 1000;

        function getIdleDays(lastReturnedDateStr) {
            if (!lastReturnedDateStr) return Infinity;
            const diffMs = now - new Date(lastReturnedDateStr);
            return diffMs / MS_PER_DAY;
        }

        const validIdleDays = freeMatchedParcels
            .map(item => getIdleDays(item.data ? item.data.last_returned : null))
            .filter(days => days !== Infinity && !isNaN(days));

        let starThresholdDays = Infinity;
        if (validIdleDays.length > 0) {
            const minIdleDays = Math.min(...validIdleDays);
            const maxIdleDays = Math.max(...validIdleDays);
            const idleRange = maxIdleDays - minIdleDays;

            starThresholdDays = maxIdleDays - (idleRange / 3);
        }

        const currentZoom = window.map.getZoom();
        const { fontSize, offsetX, visible } = getStarParams(currentZoom);
        let addedCount = 0;

        freeMatchedParcels.forEach(item => {
            const idleDays = getIdleDays(item.data ? item.data.last_returned : null);
            const isOldestThird = idleDays === Infinity || idleDays >= starThresholdDays;

            if (!isOldestThird) return;

            let centerLatLng = null;
            if (item.data && item.data.center_lat && item.data.center_lng) {
                centerLatLng = L.latLng(item.data.center_lat, item.data.center_lng);
            } else if (item.layer && item.layer.getBounds) {
                centerLatLng = item.layer.getBounds().getCenter();
            }

            if (!centerLatLng) return;

            const displayStyle = visible ? 'block' : 'none';

            const starIcon = L.divIcon({
                className: 'custom-star-polygon-marker',
                html: `
                    <div class="star-icon-body" style="
                        position: absolute;
                        top: 0;
                        left: 0;
                        display: ${displayStyle};
                        transform: translate(${offsetX}px, -50%);
                        font-size: ${fontSize}px; 
                        line-height: 1; 
                        text-align: center; 
                        filter: drop-shadow(0px 1px 2px rgba(0,0,0,0.8));
                        user-select: none;
                        pointer-events: none;
                        transition: font-size 0.1s ease-out, transform 0.1s ease-out;
                    " title="Найстаріша за часом простою: №${item.data.name}">
                        ⭐
                    </div>
                `,
                iconSize: [0, 0],
                iconAnchor: [0, 0]
            });

            const marker = L.marker(centerLatLng, {
                icon: starIcon,
                interactive: false,
                zIndexOffset: 1000
            });

            window.starMarkersGroup.addLayer(marker);
            addedCount++;
        });

       console.log(`[StarMarkers] ⭐ Відображено ${addedCount} зірочок (зум: ${currentZoom})`);
        attachZoomEvents();
    };

    function attachZoomEvents() {
        if (!window.map || window._starZoomListenerAdded) return;

        window.map.on('zoom zoomend', updateStarSizes);
        window._starZoomListenerAdded = true;
    }

    // ➕ ВСТАВЛЯТИ ТУТ (ПЕРЕД ЗАКРИТТЯМ МОВНОЇ ОБЛАСТІ):

    // Допоміжна функція: розрахунок порогу днів для найстарішої третини
    window.calculateStarThresholdDays = function (parcels) {
        if (!parcels || parcels.length === 0) return Infinity;

        const now = new Date();
        const MS_PER_DAY = 24 * 60 * 60 * 1000;

        const validIdleDays = parcels
            .map(p => {
                const dateStr = p.last_returned || (p.data && p.data.last_returned);
                if (!dateStr) return Infinity;
                return (now - new Date(dateStr)) / MS_PER_DAY;
            })
            .filter(days => days !== Infinity && !isNaN(days));

        if (validIdleDays.length === 0) return Infinity;

        const minIdleDays = Math.min(...validIdleDays);
        const maxIdleDays = Math.max(...validIdleDays);
        return maxIdleDays - ((maxIdleDays - minIdleDays) / 3);
    };

    // Перевірка, чи є ділянка найстарішою (повинна мати ⭐)
    window.isParcelStarEligible = function (parcel, thresholdDays) {
        const dateStr = parcel.last_returned || (parcel.data && parcel.data.last_returned);
        if (!dateStr) return true; // Ніколи не опрацьовувалась = найстаріша

        const now = new Date();
        const idleDays = (now - new Date(dateStr)) / (24 * 60 * 60 * 1000);
        return idleDays >= thresholdDays;
    };

    if (window.map) {
        attachZoomEvents();
    }
})();
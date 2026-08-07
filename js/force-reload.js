document.addEventListener('DOMContentLoaded', () => {
    // Чекаємо, поки карта ініціалізується
    const checkMap = setInterval(() => {
        if (window.map && typeof L !== 'undefined') {
            clearInterval(checkMap);

            const ForceReloadControl = L.Control.extend({
                options: { position: 'topleft' }, // Позиція на карті

                onAdd: function (map) {
                    const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
                    
                    // Створюємо елемент <button>
                    const reloadBtn = L.DomUtil.create('button', 'leaflet-custom-btn', container);
                    reloadBtn.type = 'button';
                    reloadBtn.innerHTML = '🔄';
                    reloadBtn.title = 'Примусово оновити кеш';
                    
                    // Залишаємо лише прозорий фон
                    reloadBtn.style.backgroundColor = 'transparent';

                    // Забороняємо проходження подій кліку на карту під кнопкою
                    L.DomEvent.disableClickPropagation(container);
                    L.DomEvent.disableScrollPropagation(container);

                    L.DomEvent.on(reloadBtn, 'click', async (e) => {
                        L.DomEvent.stop(e);
                        if (!confirm('Видалити кеш та оновити застосунок до найновішої версії?')) {
                            return;
                        }

                        try {
                            if ('caches' in window) {
                                const cacheNames = await caches.keys();
                                await Promise.all(cacheNames.map(name => caches.delete(name)));
                            }

                            if ('serviceWorker' in navigator) {
                                const registrations = await navigator.serviceWorker.getRegistrations();
                                for (let registration of registrations) {
                                    await registration.unregister();
                                }
                            }

                            window.location.reload(true);
                        } catch (error) {
                            console.error('❌ Помилка очищення кешу:', error);
                            alert('Помилка при очищенні. Спробуйте очистити кеш вручну.');
                        }
                    });

                    return container;
                }
            });

            new ForceReloadControl().addTo(window.map);
        }
    }, 100);
});
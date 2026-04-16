// Функція фокусування на дільниці за параметром в URL
export function handleUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const targetParcel = urlParams.get('parcel');

    if (targetParcel && window.allParcelLayers) {
        const targetName = targetParcel.toLowerCase().trim();
        
        setTimeout(() => {
            let foundItem = window.allParcelLayers.find(item => 
                item.name.toString().toLowerCase().trim() === targetName
            );

            if (foundItem) {
                // Ховаємо всі інші, показуємо цільову (як у твоєму коді)
                window.allParcelLayers.forEach(item => {
                    if (item.name.toString().toLowerCase().trim() === targetName) {
                        item.layer.setStyle({ color: '#ffeb3b', weight: 8, fillOpacity: 0.7 });
                        item.layer.addTo(window.map);
                        if (item.label) item.label.addTo(window.map);
                    } else {
                        window.map.removeLayer(item.layer);
                        if (item.label) window.map.removeLayer(item.label);
                    }
                });

                window.map.fitBounds(foundItem.layer.getBounds(), { padding: [50, 50], maxZoom: 17 });
                
                window.map.once('moveend', () => {
                    foundItem.layer.fire('click');
                });
            }
        }, 800);
    }
}

// Функція "Поділитися"
export async function shareParcel(name, link) {
    const shareData = { title: `Дільниця ${name}`, url: link };
    try {
        if (navigator.share) {
            await navigator.share(shareData);
        } else {
            await navigator.clipboard.writeText(link);
            alert("Посилання копійовано!");
        }
    } catch (err) { console.log("Скасовано", err); }
}

// Функція здачі дільниці
/**
 * Универсальная функция сдачи участка
 * @param {number} id - ID участка
 * @param {string} name - Номер/Название участка
 * @param {object} supabase - Клиент Supabase
 * @param {function} callback - Функция для обновления интерфейса (без перезагрузки)
 */
export async function returnParcel(id, name, supabase, callback) {
    if (!confirm(`Здати дільницю №${name}?`)) return;

    // Получаем текущую дату в чистом формате ISO (ГГГГ-ММ-ДД)
    const nowISO = new Date().toISOString().split('T')[0];

    // Обновляем статус и дату возврата. last_processed НЕ ТРОГАЕМ.
    const { error } = await supabase.from('parcels').update({ 
        status: 'free', 
        taken_by_id: null, 
        taken_by: null, 
        taken_at: null, 
        last_returned: nowISO 
    }).eq('id', id);

    if (!error) {
        // Вызываем уведомление (Toast), если оно определено глобально
        if (window.showToast) {
            window.showToast(`Дільницю №${name} успішно здано!`);
        }

        // Вызываем функцию обновления интерфейса конкретной страницы
        if (callback) await callback();
    } else {
        console.error("Помилка Supabase:", error.message);
        if (window.showToast) window.showToast("Помилка при здачі", true);
    }
}
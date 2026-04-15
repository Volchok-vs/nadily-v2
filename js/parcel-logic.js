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
export async function returnParcel(id, supabase) {
    if (!confirm("Ви впевнені, що хочете здати цю дільницю?")) return;
    // Приклад того, як має виглядати фіксація здачі
const { error } = await supabase.from('parcels').update({
    status: 'free',
    taken_by: null,
    taken_by_id: null,
    taken_at: null,
    last_returned: new Date().toISOString() // ОБОВ'ЯЗКОВО ДЛЯ КАРАНТИНУ
}).eq('id', id);

    if (error) alert("Помилка: " + error.message);
    else location.reload();
}
window.renderColorSettings = () => {
    const container = document.getElementById('colorSettingsList');
    if (!container) return;

    if (!window.mapConfig) {
        window.mapConfig = { colors: {}, borders: {} };
    }
    if (!window.mapConfig.colors) window.mapConfig.colors = {};
    if (!window.mapConfig.borders) window.mapConfig.borders = {};

    // ДОДАЄМО 'taken' У ЦЕЙ СПИСОК:
    const types = [
        { id: 'taken', label: 'На руках (зайняті)' }, // <-- НОВИЙ ПУНКТ
        { id: 'free', label: 'Приватні' },
        { id: 'highrise', label: 'Поверхівки' },
        { id: 'mixed', label: 'Змішана' },
        { id: 'business', label: 'Ділова' },
        { id: 'village', label: 'Села' },
    ];

    container.innerHTML = types.map(t => {
        // Якщо кольору немає в базі, ставимо стандарт: червоний для 'taken', сірий для інших
        const defaultBg = t.id === 'taken' ? '#e74c3c' : '#cccccc';
        const defaultBrd = t.id === 'taken' ? '#ffffff' : '#ffffff';

        const bgColor = window.mapConfig.colors[t.id] || defaultBg; 
        const brdColor = window.mapConfig.borders[t.id] || defaultBrd;
        
        return `
            <div style="margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
                <strong style="display:block; margin-bottom:5px;">${t.label}</strong>
                <div style="display:flex; gap:10px; align-items:center;">
                    <label>Фон: <input type="color" value="${bgColor}" 
                        onchange="window.updateLiveColor('colors', '${t.id}', this.value)"></label>
                    <label>Рамка: <input type="color" value="${brdColor}" 
                        onchange="window.updateLiveColor('borders', '${t.id}', this.value)"></label>
                </div>
            </div>
        `;
    }).join('');
};
/**
 * Оновлює колір миттєво
 */
window.updateLiveColor = (group, id, value) => {
    // 1. Оновлюємо значення в глобальному об'єкті
    if (!window.mapConfig) window.mapConfig = { colors: {}, borders: {} };
    window.mapConfig[group][id] = value;

    // 2. Оновлюємо стилі на карті МИТТЄВО
    if (window.allParcelLayers && window.allParcelLayers.length > 0) {
        window.allParcelLayers.forEach(item => {
            // Викликаємо нашу функцію стилів для кожного шару
            const newStyle = window.getParcelStyle(item.data);
            item.layer.setStyle(newStyle);
        });
    }
};

/**
 * Збереження в Supabase
 */
window.saveMapColors = async () => {
    // Шукаємо supabase у вікні (window), якщо він не імпортований прямо у файл
    const supabaseClient = window.supabase; 
    
    if (!supabaseClient) {
        console.error("Supabase не знайдено у глобальному просторі!");
        alert("Помилка: Не вдалося підключитися до бази даних.");
        return;
    }

    const { error } = await supabaseClient
        .from('settings')
        .upsert({ id: 'map_palette', data: window.mapConfig });

    if (error) {
        alert("Помилка збереження: " + error.message);
    } else {
        alert("Палітру збережено успішно!");
    }
};
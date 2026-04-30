async function backupProjectWithSchema() {
    const db = window.supabase || (typeof supabase !== 'undefined' ? supabase : null);
    if (!db) return console.error("❌ Supabase не знайдено!");

    const tables = ['publishers', 'parcels', 'territory_logs', 'settings', 'parcel_comments', 'territory_history'];
    
    console.log("%c🚀 ПОЧИНАЮ ПОВНИЙ БЕКАП...", "color: #00e5ff; font-weight: bold; font-size: 14px;");

    // --- ЧАСТИНА 1: ЗАВАНТАЖЕННЯ ДАНИХ (JSON) ---
    for (const tableName of tables) {
        try {
            const { data, error } = await db.from(tableName).select('*');
            if (error || !data || data.length === 0) continue;

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Backup_${tableName}_${new Date().toISOString().slice(0,10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            console.log(`%c✅ Дані [${tableName}] збережено`, "color: #4caf50;");
        } catch (e) { console.error(`Помилка таблиці ${tableName}:`, e); }
    }

    // --- ЧАСТИНА 2: ОПИС СХЕМИ (Для твого 2-го варіанту) ---
    console.log("%c\n📋 СТРУКТУРА ТАБЛИЦЬ (СХЕМА):", "color: #ffeb3b; font-weight: bold; font-size: 12px;");
    console.log("%cСкопіюйте таблицю нижче та збережіть у файл 'schema_info.txt'", "color: #aaa; font-style: italic;");
    
    try {
        // Ми робимо запит до кожної таблиці, щоб витягнути назви колонок через перший рядок
        let schemaSummary = [];
        for (const table of tables) {
            const { data } = await db.from(table).select('*').limit(1);
            if (data && data[0]) {
                Object.keys(data[0]).forEach(column => {
                    schemaSummary.push({ "Таблиця": table, "Колонка": column, "Тип (приклад)": typeof data[0][column] });
                });
            }
        }
        console.table(schemaSummary);
    } catch (err) {
        console.log("Не вдалося автоматично згенерувати опис колонок.");
    }

    // --- ЧАСТИНА 3: ІНСТРУКЦІЯ ДЛЯ SQL EDITOR ---
    console.log("%c\n🛠️ ЯК ЗРОБИТИ ПОВНИЙ SQL-БЕКАП (Варіант №2):", "background: #d32f2f; color: white; padding: 5px; font-weight: bold;");
    console.log("%cЯкщо ти додав нові таблиці, виконай цей код у SQL Editor Supabase:", "color: #ff9800;");
    console.log(`%c
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    ORDER BY table_name;`, "color: #00e5ff; font-family: monospace; background: #222; padding: 10px; display: block;");
}

console.clear();
console.log("%cКоманда для запуску: %cbackupProjectWithSchema();", "color: white;", "color: #00e5ff; font-weight: bold; font-size: 14px;");
/**
 * Функція розрахунку стилю дільниці
 */
export function getParcelStyle(pData) {
    // 1. КОНФІГУРАЦІЯ
    const config = (window.mapConfig && window.mapConfig.colors) ? window.mapConfig.colors : {
        free: '#008000',      // Основний зелений
        highrise: '#FFA500',
        mixed: '#969600',
        business: '#0000FF',
        village: '#8B4513',
        taken: '#163e25',
        quarantine: '#808080'
    };
    
    const borders = (window.mapConfig && window.mapConfig.borders) ? window.mapConfig.borders : {
        free: '#FFFFFF',
        highrise: '#FFFFFF',
        mixed: '#000000',
        business: '#FFFFFF',
        village: '#FFFFFF',
        taken: '#163e25'
    };


    let baseColor = config.free;
    let strokeColor = borders.free;

    // 2. ВИЗНАЧЕННЯ БАЗОВОГО КОЛЬОРУ ЗА КАТЕГОРІЄЮ
    // Використовуємо category або сектор за замовчуванням (якщо category порожня)
    const currentCategory = pData.category || 'Приватний сектор';

    switch (currentCategory) {
        case 'Поверхівки': 
            baseColor = config.highrise; 
            strokeColor = borders.highrise;
            break;
        case 'Змішана': 
            baseColor = config.mixed; 
            strokeColor = borders.mixed;
            break;
        case 'Ділова': 
            baseColor = config.business; 
            strokeColor = borders.business;
            break;
        case 'Село': 
            baseColor = config.village; 
            strokeColor = borders.village;
            break;
        case 'Приватний сектор':
        default: 
            // Вибираємо колір з палітри на основі ID
            const colorIndex = (pData.id || 0) % privateSectorPalette.length;
            baseColor = privateSectorPalette[colorIndex];
            // Обводка в колір основного (як ти просив)
            strokeColor = baseColor; 
            break;
    }

    // 3. ПЕРЕВІРКА СТАТУСУ "ЗАЙНЯТА"
    if (pData.status === 'taken') {
        baseColor = config.taken;
        strokeColor = borders.taken;
    }

    // 4. РОЗРАХУНОК ЧАСУ
    const now = new Date();
    const returnDate = pData.last_returned ? new Date(pData.last_returned) : new Date(0);
    const diffTime = Math.abs(now - returnDate);
    const diffMonths = diffTime / (1000 * 60 * 60 * 24 * 30.44);

    // ЛОГІКА КАРАНТИНУ
    if (pData.status !== 'taken' && diffMonths < 3) {
        baseColor = config.quarantine || '#808080';
        strokeColor = '#ffffff'; // Трохи темніша обводка для карантину
    }

    // 5. ЛОГІКА СТАРІННЯ ТА ПРОЗОРОСТІ
    let finalOpacity = 0.5; 
    let weight = 2;

    if (pData.status !== 'taken' && diffMonths >= 3) {
        // Етап 1: Плавний перехід у червоний (5 - 6 місяць)
        if (diffMonths >= 5 && diffMonths < 6) {
            const progress = diffMonths - 5; 
            baseColor = interpolateColor(baseColor, '#FF0000', progress);
            strokeColor = '#FF0000';
            weight = 2 + (progress * 3);
        } 
        // Етап 2: Почервоніння (6+ місяців)
        else if (diffMonths >= 6) {
            baseColor = '#FF0000';
            strokeColor = '#FF0000';
            weight = 5;

            if (diffMonths <= 12) {
                const opacityProgress = (diffMonths - 6) / 6;
                finalOpacity = 0.5 + (opacityProgress * 0.5); 
            } else {
                finalOpacity = 1.0; 
            }
        }
    }

    return {
        fillColor: baseColor,
        fillOpacity: finalOpacity,
        color: strokeColor,
        weight: weight,
        opacity: 1
    };
}

function interpolateColor(color1, color2, factor) {
    const hex = (x) => x.toString(16).padStart(2, '0');
    const r1 = parseInt(color1.substring(1, 3), 16);
    const g1 = parseInt(color1.substring(3, 5), 16);
    const b1 = parseInt(color1.substring(5, 7), 16);
    const r2 = parseInt(color2.substring(1, 3), 16);
    const g2 = parseInt(color2.substring(3, 5), 16);
    const b2 = parseInt(color2.substring(5, 7), 16);
    const r = Math.round(r1 + factor * (r2 - r1));
    const g = Math.round(g1 + factor * (g2 - g1));
    const b = Math.round(b1 + factor * (b2 - b1));
    return `#${hex(r)}${hex(g)}${hex(b)}`;
}

window.getParcelStyle = getParcelStyle;
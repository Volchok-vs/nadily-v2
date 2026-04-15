/**
 * Функція розрахунку стилю дільниці
 * Використовує категорії, статус "Зайнята", Карантин та логіку старіння (8+ місяців)
 */
export function getParcelStyle(pData) {
    // 1. КОНФІГУРАЦІЯ БАЗОВИХ КОЛЬОРІВ
    // Беремо кольори з бази (якщо завантажені), інакше — стандартні
    const config = (window.mapConfig && window.mapConfig.colors) ? window.mapConfig.colors : {
        free: '#008000',      // Основний зелений
        highrise: '#FFA500',  // Помаранчевий (Поверхівки)
        mixed: '#969600',     // Темно-золотистий
        business: '#0000FF',  // Синій
        village: '#8B4513',   // Коричневий
        taken: '#163e25',     // Темно-зелений (Зайнята)
        quarantine: '#808080' // Сірий
    };
    
    // МІКС кольорів для приватного сектора
    const privateSectorMix = [
        '#008000', '#50C878', '#A020F0', '#0BDA51', '#FC0FC0', 
        '#93C572', '#710193', '#85BB65', '#FFF200', '#98FF98', '#DA70D6'
    ];

    let baseColor = config.free;
    let strokeColor = '#FFFFFF'; // Біла межа для чіткості

    // Функція для стабільного кольору сусідам (через хеш координат)
    const getCoordHash = (data) => {
        const lat = data.label_pos ? data.label_pos[0] : 0;
        const lng = data.label_pos ? data.label_pos[1] : 0;
        const id = data.id || 0;
        return Math.abs(Math.floor(lat * 10000) + Math.floor(lng * 10000) + id);
    };

    const currentCategory = pData.category || 'Приватний сектор';

    // 2. ВИБІР КОЛЬОРУ ЗА КАТЕГОРІЄЮ
    switch (currentCategory) {
        case 'Поверхівки': 
            baseColor = config.highrise; 
            break;
        case 'Змішані': 
            baseColor = config.mixed; 
            strokeColor = '#000000'; 
            break;
        case 'Ділова': 
            baseColor = config.business; 
            break;
        case 'Село': 
            baseColor = config.village; 
            break;
        case 'Приватний сектор':
        default: 
            const hash = getCoordHash(pData);
            const colorIndex = hash % privateSectorMix.length;
            baseColor = privateSectorMix[colorIndex];
            break;
    }

    // 3. ПЕРЕВІРКА СТАТУСУ "ЗАЙНЯТА"
    if (pData.status === 'taken') {
        baseColor = config.taken;
        strokeColor = '#dbf706'; // Світло-жовта межа
    }

    // 4. РОЗРАХУНОК КАРАНТИНУ (менше 3 місяців)
    const now = new Date();
    const returnDate = pData.last_returned ? new Date(pData.last_returned) : new Date(0);
    const diffMonths = Math.abs(now - returnDate) / (1000 * 60 * 60 * 24 * 30.44);

    if (pData.status !== 'taken' && diffMonths < 3) {
        baseColor = config.quarantine;
        strokeColor = '#cbc7c7';
    }

    // 5. ЛОГІКА СТАРІННЯ (6, 7, 8+ МІСЯЦІВ)
    let finalOpacity = 0.2; 
    let weight = 1.5;

    if (pData.status !== 'taken' && diffMonths >= 6) {
        if (diffMonths < 7) {
            const progress = diffMonths - 6; 
            baseColor = interpolateColor(baseColor, '#FF0000', progress);
        } 
        else if (diffMonths < 8) {
            const progress = diffMonths - 7;
            baseColor = '#FF0000';
            strokeColor = interpolateColor('#FFFFFF', '#FF0000', progress);
        } 
        else {
            baseColor = '#FF0000';
            strokeColor = '#FF0000';
            // Прозорість плавно зростає від 0.2 до 0.9 (до 12-го місяця)
            finalOpacity = diffMonths <= 12 
                ? 0.2 + ((diffMonths - 8) / 4 * 0.7) 
                : 0.9;
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

/**
 * Допоміжна функція змішування HEX-кольорів для плавних переходів
 */
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
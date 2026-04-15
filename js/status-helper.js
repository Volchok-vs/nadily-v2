// status-helper.js

/**
 * Розраховує тривалість від вказаної дати до сьогодні
 * @param {string} startDate - Дата у форматі ISO або string
 * @returns {string} - Текст у форматі (X міс. Y дн.) або (X дн.)
 */
export function getDurationText(startDate, endDate = null) {
    if (!startDate) return "";

    let start = new Date(startDate);
    let end = endDate ? new Date(endDate) : new Date();

    // Хак для розпізнавання року "25" як "2025"
    if (start.getFullYear() < 100) start.setFullYear(start.getFullYear() + 2000);
    if (end.getFullYear() < 100) end.setFullYear(end.getFullYear() + 2000);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return "";

    // Якщо раптом дата здачі раніша за дату отримання (помилка вводу) — міняємо їх місцями
    if (start > end) {
        let temp = start;
        start = end;
        end = temp;
    }

    let years = end.getFullYear() - start.getFullYear();
    let months = end.getMonth() - start.getMonth();
    let days = end.getDate() - start.getDate();

    if (days < 0) {
        months--;
        const prevMonthLastDay = new Date(end.getFullYear(), end.getMonth(), 0).getDate();
        days += prevMonthLastDay;
    }

    if (months < 0) {
        years--;
        months += 12;
    }

    const totalMonths = (years * 12) + months;

    if (totalMonths === 0 && days === 0) return "(0 дн.)";
    if (totalMonths === 0) return `(${days} дн.)`;
    if (days === 0) return `(${totalMonths} міс.)`;
    
    return `(${totalMonths} міс. ${days} дн.)`;
}

/**
 * Повертає оформлений HTML рядок статусу
 */
export function formatStatusHTML(parcel) {
    if (parcel.status === 'taken') {
        const duration = getDurationText(parcel.taken_at);
        return `<span>🔴 На руках <b>${duration}</b> у: <b>${parcel.taken_by}</b></span>`;
    } else {
        const duration = getDurationText(parcel.last_returned);
        return `<span style="color: #2e7d32;">🟢 Вільна <b>${duration}</b></span>`;
    }
}
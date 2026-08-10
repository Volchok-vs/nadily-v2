// Універсальна функція для показу кастомного модального вікна підтвердження
// Підтримує два формати виклику:
// 1. showCustomConfirm(title, message, onConfirm, icon, yesBtnBg, yesBtnText)
// 2. showCustomConfirm({ title, text, confirmText, cancelText }) - повертає Promise
export function showCustomConfirm(...args) {
    const modal = document.getElementById('customConfirmModal');
    if (!modal) {
        console.error('❌ Модальне вікно customConfirmModal не знайдено');
        return;
    }

    // Визначаємо формат виклику
    const isObjectFormat = args.length === 1 && typeof args[0] === 'object';

    let title, message, onConfirm, icon, yesBtnBg, yesBtnText, cancelText;

    if (isObjectFormat) {
        // Формат об'єкта (для profile.html)
        const options = args[0];
        title = options.title;
        message = options.text;
        yesBtnText = options.confirmText || "Так";
        cancelText = options.cancelText || "Скасувати";
        icon = "⚠️";
        yesBtnBg = "#dc3545";

        // Повертаємо Promise для підтримки async/await в profile.html
        return new Promise((resolve) => {
            const titleEl = document.getElementById('confirmModalTitle');
            const messageEl = document.getElementById('confirmModalMessage') || document.getElementById('confirmModalText');
            const iconEl = document.getElementById('confirmModalIcon');
            const btnYes = document.getElementById('confirmBtnYes');
            const btnNo = document.getElementById('confirmBtnNo');

            if (titleEl && title) titleEl.textContent = title;
            if (messageEl && message) messageEl.innerHTML = message; // Додано innerHTML
            if (iconEl && icon) iconEl.textContent = icon;

            if (btnYes) {
                btnYes.textContent = yesBtnText;
                btnYes.style.backgroundColor = yesBtnBg;
            }
            if (btnNo) btnNo.textContent = cancelText;

            modal.style.display = 'flex';

            const cleanup = (result) => {
                modal.style.display = 'none';
                if (btnYes) btnYes.onclick = null;
                if (btnNo) btnNo.onclick = null;
                resolve(result);
            };

            if (btnYes) btnYes.onclick = () => cleanup(true);
            if (btnNo) btnNo.onclick = () => cleanup(false);
        });
    } else {
        // Формат окремих параметрів (для index.html та parcel-details.html)
        [title, message, onConfirm, icon, yesBtnBg, yesBtnText] = args;
        icon = icon || "⚠️";
        yesBtnBg = yesBtnBg || "#dc3545";
        yesBtnText = yesBtnText || "Так, виконати";

        const titleEl = document.getElementById('confirmModalTitle');
        const messageEl = document.getElementById('confirmModalMessage') || document.getElementById('confirmModalText');
        const iconEl = document.getElementById('confirmModalIcon');
        const btnYes = document.getElementById('confirmBtnYes');
        const btnNo = document.getElementById('confirmBtnNo');

        if (titleEl) titleEl.textContent = title;
        if (messageEl) messageEl.innerHTML = message; // Замінено textContent на innerHTML
        if (iconEl) iconEl.textContent = icon;

        if (btnYes) {
            btnYes.textContent = yesBtnText;
            btnYes.style.backgroundColor = yesBtnBg;
        }

        // Показуємо модальне вікно через display: flex
        modal.style.display = 'flex';

        // Клонування кнопок для очищення старих подій
        const newBtnYes = btnYes ? btnYes.cloneNode(true) : null;
        const newBtnNo = btnNo ? btnNo.cloneNode(true) : null;

        if (btnYes && newBtnYes) btnYes.parentNode.replaceChild(newBtnYes, btnYes);
        if (btnNo && newBtnNo) btnNo.parentNode.replaceChild(newBtnNo, btnNo);

        if (newBtnYes) {
            newBtnYes.addEventListener('click', async () => {
                modal.style.display = 'none';
                if (onConfirm) await onConfirm();
            });
        }

        if (newBtnNo) {
            newBtnNo.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }
    }
}

// Універсальна функція для здачі дільниці з кастомним модальним вікном
export function triggerReturnParcelWithCustomModal(id, name, supabase, callback) {
    showCustomConfirm(
        "Здати дільницю",
        `Ви впевнені, що хочете здати дільницю <b>№${name}</b>? Вона перейде в статус вільної, а до журналу запишеться дата здачі.`,
        async () => {
            // Тимчасово підміняємо стандартні alert та confirm, щоб придушити нативні вікна всередині модуля
            const originalConfirm = window.confirm;
            const originalAlert = window.alert;
            window.confirm = () => true;
            window.alert = () => { }; // глушимо нативний alert

            returnParcel(id, name, supabase, async () => {
                window.confirm = originalConfirm;
                window.alert = originalAlert;
                if (callback) await callback();
            });
        },
        "📩",
        "#28a745",
        "Так, здати"
    );
}

// Функція фокусування на дільниці за параметром в URL
export function handleUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const recommendIdsStr = urlParams.get('recommend_ids');
    const singleParcelName = urlParams.get('parcel');

    const resetBtn = document.getElementById('reset-focus-btn');

    // 1. Обробка параметра рекомендованих ділянок (?recommend_ids=1,2,3)
    if (recommendIdsStr && window.allParcelLayers) {
        // Отримуємо масив ID у вигляді рядків для точного порівняння
        const allowedIds = recommendIdsStr.split(',').map(id => id.trim());
        const visibleBounds = L.latLngBounds([]);

        window.allParcelLayers.forEach(item => {
            // Перевіряємо, чи є ID дільниці серед дозволених
            const isTarget = allowedIds.includes(String(item.id));

            if (isTarget) {
                // Показуємо полігон та ярлик
                if (!window.map.hasLayer(item.layer)) {
                    item.layer.addTo(window.map);
                }
                if (item.label && !window.map.hasLayer(item.label)) {
                    item.label.addTo(window.map);
                }

                // 🔹 ЗМЕНШУЄМО ПОТОЧНУ ЗАЛИВКУ РІВНО НА 50%
                if (item.layer && typeof item.layer.setStyle === 'function') {
                    // Зчитуємо поточне значення fillOpacity або беремо 0.3 за замовчуванням
                    const currentFillOpacity = item.layer.options?.fillOpacity ?? 0.3;

                    item.layer.setStyle({
                        fillOpacity: currentFillOpacity * 0.5, // 50% від поточної заливки
                        opacity: 1.0                           // Контур залишаємо 100% чітким
                    });
                }

                // Збираємо межі видимих полігонів для масштабування
                item.layer.eachLayer(layer => {
                    if (layer.getBounds) {
                        visibleBounds.extend(layer.getBounds());
                    }
                });
            } else {
                // Приховуємо всі інші дільниці
                if (window.map.hasLayer(item.layer)) {
                    window.map.removeLayer(item.layer);
                }
                if (item.label && window.map.hasLayer(item.label)) {
                    window.map.removeLayer(item.label);
                }
            }
        });

        // Центруємо та масштабуємо карту під рекомендовані полігони
        if (visibleBounds.isValid()) {
            window.map.fitBounds(visibleBounds, { padding: [50, 50] });
        }

        // Показуємо кнопку скидання фокусу
        if (resetBtn) resetBtn.style.display = 'block';

        return; // Виходимо, щоб не накладалася логіка одного 'parcel'
    }

    // 2. Логіка для поодинокої дільниці (?parcel=123)
    if (singleParcelName && window.allParcelLayers) {
        const targetParcel = window.allParcelLayers.find(
            p => p.name.toLowerCase() === singleParcelName.toLowerCase()
        );

        if (targetParcel) {
            window.allParcelLayers.forEach(item => {
                if (item.id !== targetParcel.id) {
                    if (window.map.hasLayer(item.layer)) window.map.removeLayer(item.layer);
                    if (item.label && window.map.hasLayer(item.label)) window.map.removeLayer(item.label);
                }
            });

            // Фокус на обраній дільниці та відкриття попапу
            targetParcel.layer.eachLayer(layer => {
                if (layer.getBounds) {
                    window.map.fitBounds(layer.getBounds(), { maxZoom: 18, padding: [50, 50] });
                }
                if (layer.openPopup) layer.openPopup();
            });

            if (resetBtn) resetBtn.style.display = 'block';
        }
    }
}

// Автоматичний зум картографічної області під вибрані ділянки
/**
 * Універсальний чистий розрахунок зуму:
 * Обчислює межі (bounds) так, щоб на карті ОДНОЧАСНО помістилися
 * і всі рекомендовані дільниці, і точка геолокації користувача.
 */
export function fitMapToParcelsAndUser(parcelIds = [], userLocation = null) {
    if (!window.map) return;

    const combinedBounds = L.latLngBounds([]);

    if (parcelIds.length > 0 && window.allParcelLayers) {
        window.allParcelLayers.forEach(item => {
            if (parcelIds.includes(String(item.id))) {
                if (item.layer.getBounds) {
                    combinedBounds.extend(item.layer.getBounds());
                } else if (item.layer.eachLayer) {
                    item.layer.eachLayer(l => {
                        if (l.getBounds) combinedBounds.extend(l.getBounds());
                    });
                }
            }
        });
    }

    if (userLocation) {
        combinedBounds.extend(userLocation);
    }

    if (combinedBounds.isValid()) {
        window.map.fitBounds(combinedBounds, {
            padding: [50, 50],
            animate: false
        });
    }
}

// Робимо функцію доступною глобально для інших скриптів (geolocation.js, index.html тощо)
window.fitMapToParcelsAndUser = fitMapToParcelsAndUser;

// Робимо функцію доступною глобально для інших файлів
//window.fitMapToParcelIds = fitMapToParcelIds;

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

// Функція пошуку кампаній за періодом роботи території
async function findRelevantCampaigns(supabase, takenAt, returnedAt) {
    const takenISO = new Date(takenAt).toISOString();
    const returnedISO = new Date(returnedAt).toISOString();

    // Шукаємо кампанії, що перетинаються з періодом роботи
    // campaign_start <= returnedAt AND campaign_end >= takenAt
    const { data: campaigns, error } = await supabase
        .from('campaigns')
        .select('*')
        .lte('campaign_start', returnedISO)
        .gte('campaign_end', takenISO)
        .order('campaign_start', { ascending: false });

    if (error) {
        console.error('❌ Помилка пошуку кампаній:', error);
        return [];
    }

    return campaigns || [];
}

// Функція перевірки періодів кампанії
function checkCampaignPeriods(takenAt, returnedAt, campaign) {
    if (!takenAt || !campaign) {
        return {
            takenDuringCampaign: false,
            returnedDuringCampaign: false,
            needToAsk: false
        };
    }

    const taken = new Date(takenAt);
    const returned = new Date(returnedAt);
    const campaignStart = new Date(campaign.campaign_start);
    const campaignEnd = new Date(campaign.campaign_end);

    const takenDuringCampaign = taken >= campaignStart && taken <= campaignEnd;
    const returnedDuringCampaign = returned >= campaignStart && returned <= campaignEnd;

    // Перевіряємо чи кампанія перекриває період роботи
    const campaignOverlapsWorkPeriod = campaignStart >= taken && campaignEnd <= returned;

    const needToAsk = (!takenDuringCampaign && returnedDuringCampaign) ||
        (takenDuringCampaign && !returnedDuringCampaign) ||
        campaignOverlapsWorkPeriod;

    return {
        takenDuringCampaign,
        returnedDuringCampaign,
        needToAsk
    };
}

// Функція розрахунку тривалості
function calculateDuration(takenAt, returnedAt) {
    if (!takenAt || !returnedAt) return null;

    let start = new Date(takenAt);
    let end = new Date(returnedAt);

    // Хак для року "25" → "2025"
    if (start.getFullYear() < 100) start.setFullYear(start.getFullYear() + 2000);
    if (end.getFullYear() < 100) end.setFullYear(end.getFullYear() + 2000);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;

    // Міняємо місцями якщо дата здачі раніша
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

    // Формуємо результат без дужок
    const parts = [];

    if (years > 0) {
        parts.push(years === 1 ? '1 р.' : `${years} р.`);
    }

    if (months > 0) {
        parts.push(months === 1 ? '1 міс.' : `${months} міс.`);
    }

    if (days > 0 || parts.length === 0) {
        parts.push(days === 1 ? '1 дн.' : `${days} дн.`);
    }

    return parts.join(' ');
}

// Функція створення запису в логах
async function createTerritoryLog(supabase, parcelId, publisherId, publisherName, takenAt, returnedAt, campaignId, campaignName) {
    const durationText = calculateDuration(takenAt, returnedAt);

    // Перевіряємо чи вже є такий запис (дублікат)
    const { data: existingLogs, error: checkError } = await supabase
        .from('territory_logs')
        .select('id')
        .eq('parcel_id', parcelId)
        .eq('returned_at', returnedAt)
        .limit(1);

    if (checkError) {
        console.error('❌ Помилка перевірки дублікатів:', checkError);
        return false;
    } else if (existingLogs && existingLogs.length > 0) {
        return true; // Повертаємо true щоб не переривати процес здачі
    }

    const logData = {
        parcel_id: parcelId,
        publisher_id: publisherId,
        publisher_name: publisherName || 'Невідомо',
        taken_at: takenAt,
        returned_at: returnedAt,
        duration_text: durationText,
        campaign_id: campaignId,
        campaign_name: campaignName
    };

    const { error } = await supabase
        .from('territory_logs')
        .insert(logData);

    if (error) {
        console.error('❌ Помилка створення запису в логах:', error);
        return false;
    }

    return true;
}

// Функція здачі дільниці
/**
 * Универсальная функция сдачи участка
 * @param {number} id - ID участка
 * @param {string} name - Номер/Название участка
 * @param {object} supabase - Клиент Supabase
 * @param {function} callback - Функция для обновления интерфейса (без перезагрузки)
 */
// Функція для збереження логів здачі
function saveReturnParcelLogs(logs) {
    const existingLogs = JSON.parse(localStorage.getItem('returnParcelLogs') || '[]');
    const newLog = {
        timestamp: new Date().toISOString(),
        logs: logs,
        url: window.location.href
    };
    existingLogs.push(newLog);
    localStorage.setItem('returnParcelLogs', JSON.stringify(existingLogs.slice(-10))); // Зберігаємо останні 10
}

// Функція для відновлення логів
function showReturnParcelLogs() {
    const logs = JSON.parse(localStorage.getItem('returnParcelLogs') || '[]');
    if (logs.length === 0) {
        console.log('📭 Немає збережених логів здачі територій');
        return;
    }

    console.log('📋 Збережені логи здачі територій:');

    logs.forEach((log, index) => {
        console.log(`📝 Запис ${index + 1} (${new Date(log.timestamp).toLocaleString('uk-UA')}):`);
        console.log(`   📍 URL: ${log.url}`);
        if (log.logs && Array.isArray(log.logs)) {
            log.logs.forEach(line => console.log(`   ${line}`));
        }
    });
}

export async function returnParcel(id, name, supabase, callback) {
    // Використовуємо стандартний confirm для зворотної сумісності
    // (triggerReturnParcelWithCustomModal викликається ззовні для кастомного модального вікна)
    if (!confirm(`Здати дільницю №${name}?`)) return;

    // Масив для збереження логів
    const logMessages = [];
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;

    // Перехоплюємо console.log
    console.log = function (...args) {
        const message = args.join(' ');
        logMessages.push(message);
        originalConsoleLog.apply(console, args);
    };

    console.error = function (...args) {
        const message = args.join(' ');
        logMessages.push(`[ERROR] ${message}`);
        originalConsoleError.apply(console, args);
    };

    try {
        console.log('🎯 Початок здачі території №' + name);

        // Отримуємо дані території перед здачею
        const { data: parcel, error: parcelError } = await supabase
            .from('parcels')
            .select('taken_by, taken_by_id, taken_at')
            .eq('id', id)
            .single();

        if (parcelError) {
            console.error('❌ Помилка отримання даних території:', parcelError);
            return;
        }

        // Поточна дата для здачі
        const now = window.getCurrentDate ? window.getCurrentDate() : new Date();
        const returnedAt = now.toISOString();

        // Шукаємо релевантні кампанії за періодом роботи
        const relevantCampaigns = await findRelevantCampaigns(supabase, parcel.taken_at, returnedAt);

        // Беремо першу релевантну кампанію
        const activeCampaign = relevantCampaigns.length > 0 ? relevantCampaigns[0] : null;

        let shouldRecordCampaign = false;
        let wasProcessedDuringCampaign = false;

        if (activeCampaign && window.showCampaignModal) {
            const returnedAt = new Date().toISOString();

            const periods = checkCampaignPeriods(parcel?.taken_at, returnedAt, activeCampaign);

            if (periods.needToAsk) {
                // Показуємо модальне вікно для уточнення
                wasProcessedDuringCampaign = await window.showCampaignModal(activeCampaign.name, name);
                shouldRecordCampaign = wasProcessedDuringCampaign;
            } else if (periods.takenDuringCampaign && periods.returnedDuringCampaign) {
                // Взяли і здали під час кампанії - автоматично записуємо
                shouldRecordCampaign = true;
                wasProcessedDuringCampaign = true;
            }
        }

        // Створюємо запис в логах територій
        const campaignId = shouldRecordCampaign ? activeCampaign?.id : null;
        const campaignName = shouldRecordCampaign ? activeCampaign?.name : null;

        const logSuccess = await createTerritoryLog(
            supabase,
            id,
            parcel?.taken_by_id,
            parcel?.taken_by,
            parcel?.taken_at,
            returnedAt,
            campaignId,
            campaignName
        );

        if (!logSuccess) {
            console.error('❌ Не вдалося створити запис в логах, але продовжуємо здачу території');
        }

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
            console.log('✅ Здача території №' + name + ' успішна');
            // Вызываем уведомление (Toast), если оно определено глобально
            let message = `Дільницю №${name} успішно здано!`;
            if (shouldRecordCampaign) {
                message += ` Опрацювання під час кампанії: ${activeCampaign.name}`;
            }

            if (window.showToast) {
                window.showToast(message);
            } else if (window.showNotification) {
                window.showNotification(message, 'success');
            } else {
                alert(message);
            }

            // Вызываем callback для обновления интерфейса
            if (callback && typeof callback === 'function') {
                callback();
            }
        } else {
            console.error('❌ Помилка здачі дільниці:', error);
            alert('Сталася помилка при здачі дільниці. Спробуйте ще раз.');
        }
    } catch (err) {
        console.error('❌ Помилка в returnParcel:', err);
        alert('Сталася помилка при здачі дільниці. Спробуйте ще раз.');
    } finally {
        // Відновлюємо оригінальні функції console
        console.log = originalConsoleLog;
        console.error = originalConsoleError;

        // Зберігаємо логи
        saveReturnParcelLogs(logMessages);
    }
}

// Експортуємо функцію для перегляду логів
window.showReturnParcelLogs = showReturnParcelLogs;
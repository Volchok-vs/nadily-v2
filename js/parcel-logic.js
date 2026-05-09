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

// Функція отримання активної кампанії
async function getActiveCampaign(supabase) {
    const now = window.getCurrentDate ? window.getCurrentDate() : new Date();
    const nowISO = now.toISOString(); // Форматуємо дату в ISO для Supabase
    
    console.log(`   🕐 Дата для запиту: ${nowISO}`);
    
    const { data: campaigns, error } = await supabase
        .from('campaigns')
        .select('*')
        .lte('campaign_start', nowISO)
        .gte('campaign_end', nowISO)
        .order('id', { ascending: false });
    
    if (error) {
        console.error('❌ Помилка отримання кампанії:', error);
        return null;
    }
    
    console.log(`   📊 Знайдено кампаній: ${campaigns?.length || 0}`);
    
    return campaigns?.length > 0 ? campaigns[0] : null;
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
    
    return {
        takenDuringCampaign,
        returnedDuringCampaign,
        needToAsk: (!takenDuringCampaign && returnedDuringCampaign) || 
                   (takenDuringCampaign && !returnedDuringCampaign)
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
    console.log('🔍 Перевіряємо на дублікати...');
    const { data: existingLogs, error: checkError } = await supabase
        .from('territory_logs')
        .select('id')
        .eq('parcel_id', parcelId)
        .eq('returned_at', returnedAt)
        .limit(1);
    
    if (checkError) {
        console.error('❌ Помилка перевірки дублікатів:', checkError);
    } else if (existingLogs && existingLogs.length > 0) {
        console.log('⚠️ Дублікат виявлено! Запис з такою датою здачі вже існує.');
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
        console.error('Помилка створення запису в логах:', error);
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
    console.log('');
    
    logs.forEach((log, index) => {
        console.log(`📝 Запис ${index + 1} (${new Date(log.timestamp).toLocaleString('uk-UA')}):`);
        console.log(`   📍 URL: ${log.url}`);
        if (log.logs && Array.isArray(log.logs)) {
            log.logs.forEach(line => console.log(`   ${line}`));
        }
        console.log('');
    });
}

export async function returnParcel(id, name, supabase, callback) {
    if (!confirm(`Здати дільницю №${name}?`)) return;

    // Масив для збереження логів
    const logMessages = [];
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    
    // Перехоплюємо console.log
    console.log = function(...args) {
        const message = args.join(' ');
        logMessages.push(message);
        originalConsoleLog.apply(console, args);
    };
    
    console.error = function(...args) {
        const message = args.join(' ');
        logMessages.push(`[ERROR] ${message}`);
        originalConsoleError.apply(console, args);
    };

    try {
        console.log('🎯 === ПОЧАТОК ЗДАЧІ ТЕРИТОРІЇ ===');
        console.log(`📍 Територія: №${name} (ID: ${id})`);
        
        // Отримуємо дані території перед здачею
        console.log('📋 Отримуємо дані території...1');
        const { data: parcel, error: parcelError } = await supabase
            .from('parcels')
            .select('taken_by, taken_by_id, taken_at')
            .eq('id', id)
            .single();
            
        if (parcelError) {
            console.error('❌ Помилка отримання даних території:', parcelError);
        } else {
            console.log('✅ Дані території отримано:');
            console.log(`   👤 Вісник: ${parcel?.taken_by || 'Невідомо'}`);
            console.log(`   📅 Взято: ${parcel?.taken_at || 'Немає дати'}`);
        }

        // Отримуємо активну кампанію
        console.log('🔍 Перевіряємо активну кампанію...');
        console.log(`   📱 Supabase доступний: ${!!supabase}`);
        console.log(`   🕐 Поточна дата: ${window.getCurrentDate ? window.getCurrentDate().toISOString() : new Date().toISOString()}`);
        
        const activeCampaign = await getActiveCampaign(supabase);
        
        console.log(`   🎯 Активна кампанія: ${activeCampaign ? activeCampaign.name : 'НЕМАЄ'}`);
        if (activeCampaign) {
            console.log(`   📅 Період кампанії: ${activeCampaign.campaign_start} - ${activeCampaign.campaign_end}`);
            console.log(`   🆔 ID кампанії: ${activeCampaign.id}`);
        }
        
        let shouldRecordCampaign = false;
        let wasProcessedDuringCampaign = false;
        
        // Перевіряємо чи потрібно запитувати про кампанію
        console.log('🎭 Перевіряємо умови для модального вікна...');
        console.log(`   ✅ Активна кампанія: ${!!activeCampaign}`);
        console.log(`   ✅ Модальне вікно доступне: ${!!window.showCampaignModal}`);
        
        if (activeCampaign && window.showCampaignModal) {
            const returnedAt = new Date().toISOString();
            console.log(`   📅 Дата здачі: ${returnedAt}`);
            
            const periods = checkCampaignPeriods(parcel?.taken_at, returnedAt, activeCampaign);
            
            console.log('📊 Результати перевірки періодів:');
            console.log(`   📥 Взято під час кампанії: ${periods.takenDuringCampaign}`);
            console.log(`   📤 Здається під час кампанії: ${periods.returnedDuringCampaign}`);
            console.log(`   ❓ Потрібно запитати: ${periods.needToAsk}`);
            
            if (periods.needToAsk) {
                console.log('🎬 Показуємо модальне вікно...');
                // Показуємо модальне вікно для уточнення
                wasProcessedDuringCampaign = await window.showCampaignModal(activeCampaign.name, name);
                shouldRecordCampaign = wasProcessedDuringCampaign;
                console.log(`   👤 Відповідь користувача: ${wasProcessedDuringCampaign ? 'ТАК' : 'НІ'}`);
            } else if (periods.takenDuringCampaign && periods.returnedDuringCampaign) {
                console.log('✅ Автоматичне записування (взято і здано під час кампанії)');
                // Взяли і здали під час кампанії - автоматично записуємо
                shouldRecordCampaign = true;
                wasProcessedDuringCampaign = true;
            } else {
                console.log('⏭️ Модальне вікно не потрібне (поза кампанією)');
            }
        } else {
            console.log('❌ Умови не виконані:');
            if (!activeCampaign) console.log('   - Немає активної кампанії');
            if (!window.showCampaignModal) console.log('   - Модальне вікно не завантажено (campaign-modal.js)');
        }

        // Створюємо запис в логах територій
        console.log('📝 Створюємо запис в логах територій...');
        const returnedAt = new Date().toISOString();
        const campaignId = shouldRecordCampaign ? activeCampaign?.id : null;
        const campaignName = shouldRecordCampaign ? activeCampaign?.name : null;
        
        console.log(`   📊 Дані для запису:`);
        console.log(`   - publisher_id: ${parcel?.taken_by_id || 'null'}`);
        console.log(`   - publisher_name: ${parcel?.taken_by || 'Невідомо'}`);
        console.log(`   - duration_text: ${calculateDuration(parcel?.taken_at, returnedAt) || 'null'}`);
        console.log(`   - campaign_id: ${campaignId || 'null'}`);
        console.log(`   - campaign_name: ${campaignName || 'null'}`);
        
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
        } else {
            console.log('✅ Запис в логах створено успішно');
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
            console.log('✅ === ЗДАЧА ТЕРИТОРІЇ УСПІШНА ===');
            // Вызываем уведомление (Toast), если оно определено глобально
            let message = `Дільницю №${name} успішно здано!`;
            if (shouldRecordCampaign) {
                message += ` Опрацювання під час кампанії: ${activeCampaign.name}`;
                console.log(`📊 Опрацювання записано для кампанії: ${activeCampaign.name}`);
            } else {
                console.log('📊 Опрацювання НЕ записано (поза кампанією або відмова)');
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
        console.log('💾 Логи збережено в localStorage');
        console.log('📋 Для перегляду виконайте: showReturnParcelLogs()');
    }
}

// Експортуємо функцію для перегляду логів
window.showReturnParcelLogs = showReturnParcelLogs;
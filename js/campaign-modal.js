// Модальне вікно для уточнення опрацювання під час кампанії
// Створюється динамічно і працює на всіх сторінках

class CampaignModal {
    constructor() {
        this.modal = null;
        this.resolveCallback = null;
        this.init();
    }

    init() {
        // Створюємо модальне вікно один раз
        this.createModal();
        // Додаємо стилі
        this.addStyles();
    }

    createModal() {
        const modalHTML = `
            <div id="campaignModal" class="campaign-modal" style="display: none;">
                <div class="campaign-modal-content">
                    <div class="campaign-modal-header">
                        <h3>📋 Уточнення опрацювання території</h3>
                        <button class="campaign-modal-close" onclick="window.campaignModal.close()">&times;</button>
                    </div>
                    <div class="campaign-modal-body">
                        <div class="campaign-info">
                            <p><strong>Активна кампанія:</strong> <span id="campaignName"></span></p>
                            <p><strong>Дільниця №</strong> <span id="parcelNumber"></span></p>
                        </div>
                        <div class="campaign-question">
                            <p><strong>Чи була дільниця опрацьована саме під час цієї кампанії?</strong></p>
                            <div class="campaign-explanation">
                                <p><em>Важливо для точності статистики:</em></p>
                                <ul>
                                    <li><strong>Так</strong> - якщо опрацювання відбулося під час кампанії</li>
                                    <li><strong>Ні</strong> - якщо дільниця була опрацьована до кампанії, але здається під час кампанії</li>
                                </ul>
                            </div>
                        </div>
                        <div class="campaign-buttons">
                            <button class="campaign-btn campaign-btn-yes" onclick="window.campaignModal.answer(true)">
                                ✅ Так, опрацьовано під час кампанії
                            </button>
                            <button class="campaign-btn campaign-btn-no" onclick="window.campaignModal.answer(false)">
                                ❌ Ні, опрацьовано до кампанії
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = document.getElementById('campaignModal');
    }

    addStyles() {
        const styles = `
            <style id="campaign-modal-styles">
                .campaign-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.6);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 10000;
                    animation: fadeIn 0.3s ease;
                }

                .campaign-modal-content {
                    background: white;
                    border-radius: 12px;
                    max-width: 500px;
                    width: 90%;
                    max-height: 80vh;
                    overflow-y: auto;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                    animation: slideIn 0.3s ease;
                }

                .campaign-modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px 24px;
                    border-bottom: 1px solid #e5e7eb;
                    background: #f9fafb;
                    border-radius: 12px 12px 0 0;
                }

                .campaign-modal-header h3 {
                    margin: 0;
                    color: #1f2937;
                    font-size: 18px;
                    font-weight: 600;
                }

                .campaign-modal-close {
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #6b7280;
                    padding: 0;
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 6px;
                    transition: all 0.2s;
                }

                .campaign-modal-close:hover {
                    background: #e5e7eb;
                    color: #374151;
                }

                .campaign-modal-body {
                    padding: 24px;
                }

                .campaign-info {
                    background: #f0f9ff;
                    border: 1px solid #0ea5e9;
                    border-radius: 8px;
                    padding: 16px;
                    margin-bottom: 20px;
                }

                .campaign-info p {
                    margin: 8px 0;
                    color: #0c4a6e;
                    font-size: 14px;
                }

                .campaign-info strong {
                    color: #075985;
                }

                .campaign-question {
                    margin-bottom: 24px;
                }

                .campaign-question p {
                    margin: 0 0 16px 0;
                    color: #1f2937;
                    font-size: 16px;
                    font-weight: 500;
                }

                .campaign-explanation {
                    background: #fef3c7;
                    border: 1px solid #f59e0b;
                    border-radius: 8px;
                    padding: 16px;
                }

                .campaign-explanation p {
                    margin: 0 0 12px 0;
                    color: #92400e;
                    font-size: 14px;
                    font-weight: 500;
                }

                .campaign-explanation ul {
                    margin: 0;
                    padding-left: 20px;
                    color: #78350f;
                    font-size: 13px;
                }

                .campaign-explanation li {
                    margin: 8px 0;
                }

                .campaign-buttons {
                    display: flex;
                    gap: 12px;
                    flex-direction: column;
                }

                .campaign-btn {
                    padding: 12px 20px;
                    border: none;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                    text-align: left;
                }

                .campaign-btn-yes {
                    background: #10b981;
                    color: white;
                }

                .campaign-btn-yes:hover {
                    background: #059669;
                    transform: translateY(-1px);
                }

                .campaign-btn-no {
                    background: #ef4444;
                    color: white;
                }

                .campaign-btn-no:hover {
                    background: #dc2626;
                    transform: translateY(-1px);
                }

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                @keyframes slideIn {
                    from { 
                        opacity: 0;
                        transform: translateY(-20px);
                    }
                    to { 
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                @media (max-width: 640px) {
                    .campaign-modal-content {
                        width: 95%;
                        margin: 20px;
                    }
                    
                    .campaign-modal-header {
                        padding: 16px 20px;
                    }
                    
                    .campaign-modal-body {
                        padding: 20px;
                    }
                    
                    .campaign-modal-header h3 {
                        font-size: 16px;
                    }
                }
            </style>
        `;
        
        document.head.insertAdjacentHTML('beforeend', styles);
    }

    show(campaignName, parcelNumber) {
        return new Promise((resolve) => {
            this.resolveCallback = resolve;
            
            // Встановлюємо дані
            document.getElementById('campaignName').textContent = campaignName;
            document.getElementById('parcelNumber').textContent = parcelNumber;
            
            // Показуємо модальне вікно
            this.modal.style.display = 'flex';
            
            // Додаємо обробник закриття по Escape
            this.escapeHandler = (e) => {
                if (e.key === 'Escape') {
                    this.close();
                }
            };
            document.addEventListener('keydown', this.escapeHandler);
            
            // Додаємо обробник кліку по фону
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) {
                    this.close();
                }
            });
        });
    }

    answer(wasProcessedDuringCampaign) {
        this.resolveCallback(wasProcessedDuringCampaign);
        this.close();
    }

    close() {
        this.modal.style.display = 'none';
        
        // Прибираємо обробники
        if (this.escapeHandler) {
            document.removeEventListener('keydown', this.escapeHandler);
        }
        
        // Якщо користувач закрив вікно без відповіді
        if (this.resolveCallback) {
            this.resolveCallback(false); // За замовчуванням - Ні
            this.resolveCallback = null;
        }
    }
}

// Створюємо глобальний екземпляр
window.campaignModal = new CampaignModal();

// Експортуємо функцію для використання
window.showCampaignModal = function(campaignName, parcelNumber) {
    return window.campaignModal.show(campaignName, parcelNumber);
};

console.log('🎯 Модальне вікно для уточнення кампанії завантажено!');

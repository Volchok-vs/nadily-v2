(function initAppNavigation() {
  // 1. Перевіряємо PWA
  const isPWA = window.matchMedia('(display-mode: standalone)').matches 
             || window.navigator.standalone === true
             || document.body.classList.contains('pwa-mode');

  if (!isPWA) return;

  // 2. Створюємо стилі
  const style = document.createElement('style');
  style.textContent = `
    .pwa-bottom-nav {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 60px;
      width: 100vw;
      background-color: #e5e7eb;
      border-top: 1px solid #e0e0e0;
      display: flex;
      flex-direction: row;
      justify-content: space-around;
      align-items: center;
      z-index: 10000;
      box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
      padding-bottom: env(safe-area-inset-bottom);
      transition: all 0.25 ease;
    }

    .pwa-nav-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #666666;
      text-decoration: none;
      font-size: 11px;
      flex: 1;
      height: 100%;
      width: 100%;
      text-align: center;
      padding: 2px 4px; /* Трохи розширюємо внутрішній простір */
      box-sizing: border-box;
    }

    /* 💡 Додаємо правила переносу для текстів кнопок */
    .pwa-nav-item span:not(.pwa-nav-icon) {
      line-height: 1.1;
      word-break: break-word; /* Дозволяє розривати довгі слова при потребі */
      hyphens: auto;          /* Додає дефіс при переносі (якщо підтримується) */
      max-width: 100%;
      display: block;
    }

    .pwa-nav-item.active {
      color: #2196F3;
      font-weight: bold;
    }

    .pwa-nav-icon {
      font-size: 18px;
      margin-bottom: 2px;
    }

    body.is-pwa-active {
      overflow: hidden !important;
      margin: 0;
      padding: 0 !important;
    }

    body.is-pwa-active .user-control-panel {
      display: none !important;
    }

    body.is-pwa-active #map {
      height: calc(100vh - 60px - env(safe-area-inset-bottom)) !important;
      width: 100vw !important;
    }
    
    .sidebar, .main-content, #reset-focus-btn, .legend {
      margin-bottom: 60px;
      margin-right: 0;
    }

    /* 📱 🔄 Стилі ТІЛЬКИ коли телефон/планшет повернуто горизонтально */
    body.is-device-landscape .pwa-bottom-nav {
      top: 0;
      bottom: 0;
      right: 0;
      left: auto;
      width: 70px;
      height: 100vh;
      border-top: none;
      border-left: 1px solid #e0e0e0;
      flex-direction: column;
      justify-content: center;
      padding-bottom: 0;
      padding-right: env(safe-area-inset-right);
      box-shadow: -2px 0 10px rgba(0,0,0,0.05);
    }

    body.is-device-landscape #map {
      height: 100vh !important;
      width: calc(100vw - 70px - env(safe-area-inset-right)) !important;
    }

    body.is-device-landscape .sidebar, 
    body.is-device-landscape .main-content, 
    body.is-device-landscape #reset-focus-btn, 
    body.is-device-landscape .legend {
      margin-bottom: 0;
      margin-right: 70px;
    }

    body.is-device-landscape .sidebar {
      margin-bottom: 0;
    }
  `;
  document.head.appendChild(style);

  document.body.classList.add('is-pwa-active');

  // 3. Перевірка орієнтації ТІЛЬКИ для мобільних пристроїв/планшетів (Touch + Screen Orientation)
  function checkDeviceOrientation() {
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    
    // Перевіряємо тип орієнтації через Screen Orientation API
    const orientationType = (screen.orientation && screen.orientation.type) || '';
    const isLandscape = orientationType.includes('landscape') || (Math.abs(window.orientation) === 90);

    // Додаємо клас бічного меню тільки якщо це touch-пристрій і він повернутий горизонтально
    if (isTouchDevice && isLandscape) {
      document.body.classList.add('is-device-landscape');
    } else {
      document.body.classList.remove('is-device-landscape');
    }
  }

  // Слухаємо реальний поворот пристрою
  if (screen.orientation) {
    screen.orientation.addEventListener('change', checkDeviceOrientation);
  } else {
    window.addEventListener('orientationchange', checkDeviceOrientation);
  }
  
  // Ініціалізація при завантаженні
  checkDeviceOrientation();

  // 4. Формування кнопок (авторизація)
  const currentPath = window.location.pathname;
  const urlParams = new URLSearchParams(window.location.search);
  const currentTab = urlParams.get('tab');

  const isAuthenticated = Boolean(localStorage.getItem('userId') || localStorage.getItem('userName'));
  const profileHref = isAuthenticated ? "profile.html" : "login.html";

  const isMapActive = currentPath.endsWith('index.html') || currentPath === '/' || currentPath === '';
  const isRecommendedActive = currentPath.endsWith('profile.html') && currentTab === 'recommended-parcels';
  const isProfileActive = currentPath.endsWith('profile.html') && currentTab !== 'recommended-parcels';
  const isMoreActive = currentPath.endsWith('more.html');

  const recommendedBtnHTML = isAuthenticated ? `
    <a href="profile.html?tab=recommended-parcels" class="pwa-nav-item ${isRecommendedActive ? 'active' : ''}">
      <span class="pwa-nav-icon">📍</span>
      <span>Рекомендовані</span>
    </a>
  ` : '';

  // 5. HTML-розмітка
  const navHTML = `
    <nav class="pwa-bottom-nav">
      <a href="index.html" class="pwa-nav-item ${isMapActive ? 'active' : ''}">
        <span class="pwa-nav-icon">🗺️</span>
        <span>Карта</span>
      </a>
      ${recommendedBtnHTML}
      <a href="${profileHref}" class="pwa-nav-item ${isProfileActive ? 'active' : ''}">
        <span class="pwa-nav-icon">👤</span>
        <span>${isAuthenticated ? 'Профіль' : 'Увійти'}</span>
      </a>
      <a href="more.html" class="pwa-nav-item ${isMoreActive ? 'active' : ''}">
        <span class="pwa-nav-icon">⚙️</span>
        <span>Ще</span>
      </a>
    </nav>
  `;

  if (document.body) {
    document.body.insertAdjacentHTML('beforeend', navHTML);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      document.body.insertAdjacentHTML('beforeend', navHTML);
    });
  }
})();
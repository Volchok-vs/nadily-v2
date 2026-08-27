(function initAppNavigation() {
  // 1. Перевіряємо, чи додаток відкрито у режимі PWA або з прапором тестування
  const isPWA = window.matchMedia('(display-mode: standalone)').matches 
             || window.navigator.standalone === true
             || document.body.classList.contains('pwa-mode');

  // Якщо це звичайний браузер — нічого не робимо
  if (!isPWA) return;

// 2. Створюємо стилі для нижньої/бічної панелі та адаптації під PWA
  const style = document.createElement('style');
  style.textContent = `
    .pwa-bottom-nav {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 60px;
      width: 100%;
      background-color: #e5e7eb;
      border-top: 1px solid #e0e0e0;
      display: flex;
      flex-direction: row;
      justify-content: space-around;
      align-items: center;
      z-index: 10000;
      box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
      padding-bottom: env(safe-area-inset-bottom);
      transition: all 0.3s ease;
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
      padding: 0 2px;
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

    /* Приховуємо верхню панель користувача у PWA */
    body.is-pwa-active .user-control-panel {
      display: none !important;
    }

    /* Портретний режим: карта враховує нижню панель */
    body.is-pwa-active #map {
      height: calc(100vh - 60px - env(safe-area-inset-bottom)) !important;
      width: 100vw !important;
    }
    
    .sidebar, .main-content, #reset-focus-btn, .legend {
      margin-bottom: 60px;
      margin-right: 0;
    }

    /* 📱 🔄 Альбомний режим (Landscape): панель переходить ПРАВОРУЧ, кнопки в стовпчик */
    @media screen and (orientation: landscape) {
      .pwa-bottom-nav {
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

      /* Перераховуємо розміри карти: відступаємо 70px справа замість знизу */
      body.is-pwa-active #map {
        height: 100vh !important;
        width: calc(100vw - 70px - env(safe-area-inset-right)) !important;
      }

      .sidebar, .main-content, #reset-focus-btn, .legend {
        margin-bottom: 0;
        margin-right: 70px;
      }
    }
  `;
  document.head.appendChild(style);

  // 3. Додаємо клас до <body>
  document.body.classList.add('is-pwa-active');

  // 4. Визначаємо поточний шлях та параметри URL
  const currentPath = window.location.pathname;
  const urlParams = new URLSearchParams(window.location.search);
  const currentTab = urlParams.get('tab');

  // Перевірка авторизації
  const isAuthenticated = Boolean(localStorage.getItem('userId') || localStorage.getItem('userName'));
  const profileHref = isAuthenticated ? "profile.html" : "login.html";

  // Визначення активної вкладки
  const isMapActive = currentPath.endsWith('index.html') || currentPath === '/' || currentPath === '';
  const isRecommendedActive = currentPath.endsWith('profile.html') && currentTab === 'recommended-parcels';
  const isProfileActive = currentPath.endsWith('profile.html') && currentTab !== 'recommended-parcels';
  const isMoreActive = currentPath.endsWith('more.html');

  // 💡 Динамічно формуємо кнопку "Рекомендовані" лише для авторизованих користувачів
  const recommendedBtnHTML = isAuthenticated ? `
    <a href="profile.html?tab=recommended-parcels" class="pwa-nav-item ${isRecommendedActive ? 'active' : ''}">
      <span class="pwa-nav-icon">📍</span>
      <span>Рекомендовані</span>
    </a>
    <a href="more.html" class="pwa-nav-item ${isMoreActive ? 'active' : ''}">
        <span class="pwa-nav-icon">⚙️</span>
        <span>Ще</span>
      </a>
  ` : '';

  // 5. Створюємо HTML-структуру панелі
  const navHTML = `
    <nav class="pwa-bottom-nav">
      <a href="index.html" class="pwa-nav-item ${isMapActive ? 'active' : ''}">
        <span class="pwa-nav-icon">🗺️</span>
        <span>Карта</span>
      </a>
      
      <a href="${profileHref}" class="pwa-nav-item ${isProfileActive ? 'active' : ''}">
        <span class="pwa-nav-icon">👤</span>
        <span>${isAuthenticated ? 'Профіль' : 'Увійти'}</span>
      </a>
      ${recommendedBtnHTML}
    </nav>
  `;

  // 6. Вставляємо панель у DOM
  if (document.body) {
    document.body.insertAdjacentHTML('beforeend', navHTML);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      document.body.insertAdjacentHTML('beforeend', navHTML);
    });
  }
})();
(function initAppNavigation() {
  // 1. Перевіряємо, чи додаток відкрито у режимі PWA або з прапором тестування
  const isPWA = window.matchMedia('(display-mode: standalone)').matches 
             || window.navigator.standalone === true
             || document.body.classList.contains('pwa-mode');

  // Якщо це звичайний браузер — нічого не робимо
  if (!isPWA) return;

  // 2. Створюємо стилі для нижньої панелі та адаптації під PWA
  const style = document.createElement('style');
  style.textContent = `
    .pwa-bottom-nav {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 60px;
      background-color: #e5e7eb;
      border-top: 1px solid #e0e0e0;
      display: flex;
      justify-content: space-around;
      align-items: center;
      z-index: 10000;
      box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
      padding-bottom: env(safe-area-inset-bottom);
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

    /* Перераховуємо висоту карти під PWA */
    body.is-pwa-active #map {
      height: calc(100vh - 60px - env(safe-area-inset-bottom)) !important;
    }
    
    .sidebar, .main-content, #reset-focus-btn, .legend {
      margin-bottom: 60px;
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

  // 5. Створюємо HTML-структуру панелі з 4 кнопками
  const navHTML = `
    <nav class="pwa-bottom-nav">
      <a href="index.html" class="pwa-nav-item ${isMapActive ? 'active' : ''}">
        <span class="pwa-nav-icon">🗺️</span>
        <span>Карта</span>
      </a>
      <a href="profile.html?tab=recommended-parcels" class="pwa-nav-item ${isRecommendedActive ? 'active' : ''}">
        <span class="pwa-nav-icon">📍</span>
        <span>Рекомендовані</span>
      </a>
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

  // 6. Вставляємо панель у DOM
  if (document.body) {
    document.body.insertAdjacentHTML('beforeend', navHTML);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      document.body.insertAdjacentHTML('beforeend', navHTML);
    });
  }
})();
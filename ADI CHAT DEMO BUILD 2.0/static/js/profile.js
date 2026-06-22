/* ============================
   ФАЙЛ profile.js
   Клиентский JavaScript для страницы профиля
   Отвечает за управление настройками пользователя
   ============================ */

// ============================
// 1. САМОВЫЗЫВАЮЩАЯСЯ ФУНКЦИЯ (IIFE)
// Создает изолированную область видимости
// ============================

(function () {
    'use strict';  // Включаем строгий режим

    // ============================
    // 2. ПОЛУЧЕНИЕ ЭЛЕМЕНТОВ DOM
    // ============================

    // Кнопка "Приватность" на странице профиля
    var privacyBtn = document.getElementById('privacyBtn');
    
    // Кнопка "Уведомления" на странице профиля
    var pushBtn = document.getElementById('pushBtn');
    
    // Модальное окно настроек приватности
    var privacyModal = document.getElementById('privacyModal');
    
    // Переключатель (checkbox) в модальном окне
    var privacyToggle = document.getElementById('privacyToggle');
    
    // Кнопка сохранения настроек приватности
    var savePrivacyBtn = document.getElementById('savePrivacyBtn');

    // ============================
    // 3. ФУНКЦИЯ ОБНОВЛЕНИЯ НАСТРОЕК
    // ============================

    /**
     * Отправляет запрос на сервер для обновления настройки профиля
     * @param {string} field - Название поля (privacy_hide_status или push_notifications)
     * @param {boolean} value - Новое значение (true/false)
     * @returns {Promise<boolean>} - Успешно ли обновлено
     */
    async function updateSetting(field, value) {
        try {
            // Отправляем POST-запрос к API
            var response = await fetch('/api/profile/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    field: field,      // Название настройки
                    value: value       // Новое значение
                }),
            });
            
            // Возвращаем true, если запрос успешен (статус 200-299)
            return response.ok;
        } catch (_) {
            // В случае ошибки возвращаем false
            return false;
        }
    }

    // ============================
    // 4. НАСТРОЙКА ПРИВАТНОСТИ
    // ============================

    /**
     * Открывает модальное окно настроек приватности
     * При клике на кнопку "Приватность"
     */
    if (privacyBtn) {
        privacyBtn.addEventListener('click', function () {
            // Используем глобальную функцию для открытия модального окна
            window.AdiChat.openModal('privacyModal');
        });
    }

    /**
     * Сохраняет настройки приватности
     * При клике на кнопку "Сохранить" в модальном окне
     */
    if (savePrivacyBtn && privacyToggle) {
        savePrivacyBtn.addEventListener('click', async function () {
            // Блокируем кнопку, чтобы предотвратить повторные клики
            savePrivacyBtn.disabled = true;
            
            // Отправляем запрос на сервер с текущим состоянием переключателя
            var ok = await updateSetting('privacy_hide_status', privacyToggle.checked);
            
            // Разблокируем кнопку
            savePrivacyBtn.disabled = false;
            
            if (ok) {
                // Если успешно - закрываем модальное окно
                window.AdiChat.closeModal('privacyModal');
                
                // Обновляем логи в консоли
                window.AdiChat.refreshLogs();
            } else {
                // Если ошибка - показываем сообщение
                alert('Не удалось сохранить настройки');
            }
        });
    }

    // ============================
    // 5. НАСТРОЙКА PUSH-УВЕДОМЛЕНИЙ
    // ============================

    /**
     * Управляет push-уведомлениями
     * При клике на кнопку "Уведомления"
     */
    if (pushBtn) {
        pushBtn.addEventListener('click', async function () {
            // --- 5.1. Проверка поддержки браузером ---
            // Проверяем, поддерживает ли браузер Notification API
            if (!('Notification' in window)) {
                alert('Ваш браузер не поддерживает push-уведомления.');
                return;
            }

            // --- 5.2. Запрос разрешения ---
            // Получаем текущее разрешение на уведомления
            var permission = Notification.permission;
            
            // Если разрешение еще не запрашивалось - запрашиваем
            if (permission === 'default') {
                permission = await Notification.requestPermission();
            }

            // Если разрешение не получено - показываем сообщение
            if (permission !== 'granted') {
                alert('Разрешите уведомления в настройках браузера.');
                return;
            }

            // --- 5.3. Переключение состояния ---
            // Получаем текущее состояние из data-атрибута
            // enabled === 'true' означает, что уведомления включены
            var enabled = pushBtn.dataset.enabled !== 'true';
            
            // Отправляем запрос на сервер для обновления настройки
            var ok = await updateSetting('push_notifications', enabled);
            
            if (ok) {
                // --- 5.4. Обновление UI ---
                // Сохраняем новое состояние в data-атрибуте
                pushBtn.dataset.enabled = enabled ? 'true' : 'false';
                
                // Обновляем текст статуса на кнопке
                pushBtn.querySelector('.btn-status').textContent = enabled ? 'Включены' : 'Выключены';
                
                // --- 5.5. Отправка тестового уведомления ---
                // Показываем уведомление об изменении настроек
                new Notification('ADI CHAT', {
                    body: enabled ? 'Push-уведомления включены' : 'Push-уведомления выключены',
                    icon: '/static/favicon.ico'  // Иконка для уведомления
                });
                
                // Обновляем логи в консоли
                window.AdiChat.refreshLogs();
            } else {
                // Если ошибка - показываем сообщение
                alert('Не удалось сохранить настройки уведомлений');
            }
        });
    }

    // ============================
    // 6. ПРИВЯЗКА ЗАКРЫТИЯ МОДАЛЬНОГО ОКНА
    // ============================

    // Привязываем закрытие модального окна приватности к кнопке "Отмена"
    // Используем data-action="cancel" для поиска кнопки
    window.AdiChat.bindModalClose('privacyModal', '[data-action="cancel"]');

    // ============================
    // 7. ЗАПУСК ОБНОВЛЕНИЯ ЛОГОВ
    // ============================

    // Запускаем автоматическое обновление логов (каждые 8 секунд)
    window.AdiChat.startLogPolling(8000);

})();  // Конец самовызывающейся функции


// ============================
// 8. ДОПОЛНИТЕЛЬНЫЕ ВОЗМОЖНОСТИ
// ============================

/* 
   РАСШИРЕННЫЕ ФУНКЦИИ, КОТОРЫЕ МОЖНО ДОБАВИТЬ:

   // 1. Изменение статуса пользователя
   var statusInput = document.getElementById('statusInput');
   var saveStatusBtn = document.getElementById('saveStatusBtn');
   
   async function updateStatus(status) {
       var response = await fetch('/api/profile/status', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ status: status }),
       });
       return response.ok;
   }
   
   if (saveStatusBtn && statusInput) {
       saveStatusBtn.addEventListener('click', async function() {
           var ok = await updateStatus(statusInput.value);
           if (ok) {
               alert('Статус обновлен!');
               window.AdiChat.refreshLogs();
           }
       });
   }

   // 2. Изменение аватара
   var avatarUpload = document.getElementById('avatarUpload');
   
   async function updateAvatar(file) {
       var formData = new FormData();
       formData.append('avatar', file);
       
       var response = await fetch('/api/profile/avatar', {
           method: 'POST',
           body: formData
       });
       return response.ok;
   }
   
   if (avatarUpload) {
       avatarUpload.addEventListener('change', async function(e) {
           var file = e.target.files[0];
           if (file) {
               var ok = await updateAvatar(file);
               if (ok) {
                   location.reload();  // Перезагружаем для обновления аватара
               }
           }
       });
   }

   // 3. Изменение пароля
   var passwordForm = document.getElementById('passwordForm');
   
   if (passwordForm) {
       passwordForm.addEventListener('submit', async function(e) {
           e.preventDefault();
           
           var oldPassword = document.getElementById('oldPassword').value;
           var newPassword = document.getElementById('newPassword').value;
           var confirmPassword = document.getElementById('confirmPassword').value;
           
           if (newPassword !== confirmPassword) {
               alert('Пароли не совпадают');
               return;
           }
           
           if (newPassword.length < 6) {
               alert('Пароль должен быть не менее 6 символов');
               return;
           }
           
           var response = await fetch('/api/profile/password', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({
                   old_password: oldPassword,
                   new_password: newPassword
               }),
           });
           
           if (response.ok) {
               alert('Пароль изменен!');
               passwordForm.reset();
           } else {
               alert('Не удалось изменить пароль. Проверьте старый пароль.');
           }
       });
   }

   // 4. Двухфакторная аутентификация (2FA)
   var twoFactorBtn = document.getElementById('twoFactorBtn');
   
   if (twoFactorBtn) {
       twoFactorBtn.addEventListener('click', async function() {
           var enabled = twoFactorBtn.dataset.enabled !== 'true';
           
           var response = await fetch('/api/profile/2fa', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ enabled: enabled }),
           });
           
           if (response.ok) {
               twoFactorBtn.dataset.enabled = enabled ? 'true' : 'false';
               twoFactorBtn.querySelector('.btn-status').textContent = 
                   enabled ? 'Включена' : 'Выключена';
               alert('Настройки 2FA обновлены!');
           }
       });
   }

   // 5. Экспорт данных пользователя
   var exportBtn = document.getElementById('exportDataBtn');
   
   if (exportBtn) {
       exportBtn.addEventListener('click', async function() {
           window.location.href = '/api/profile/export';
       });
   }

   // 6. Удаление аккаунта
   var deleteAccountBtn = document.getElementById('deleteAccountBtn');
   
   if (deleteAccountBtn) {
       deleteAccountBtn.addEventListener('click', function() {
           if (confirm('Вы уверены, что хотите удалить аккаунт? Это действие необратимо!')) {
               fetch('/api/profile/account', { method: 'DELETE' })
                   .then(response => {
                       if (response.ok) {
                           window.location.href = '/';
                       }
                   });
           }
       });
   }
*/

// ============================
// 9. СТРУКТУРА ДАННЫХ
// ============================

/*
   Формат запроса для обновления настроек:

   {
       "field": "privacy_hide_status",  // или "push_notifications"
       "value": true                     // или false
   }

   Формат ответа от сервера:

   {
       "ok": true,
       "field": "privacy_hide_status",
       "value": true
   }

   Или в случае ошибки:

   {
       "error": "invalid_field"
   }
*/

// ============================
// 10. ЖИЗНЕННЫЙ ЦИКЛ СТРАНИЦЫ ПРОФИЛЯ
// ============================

/*
   1. СТРАНИЦА ЗАГРУЖАЕТСЯ
      ↓
   2. IIFE ВЫПОЛНЯЕТСЯ
      ↓
   3. ПОЛУЧАЕМ ЭЛЕМЕНТЫ DOM
      ↓
   4. НАСТРАИВАЕМ ОБРАБОТЧИКИ
      - Клик по кнопке "Приватность"
      - Клик по кнопке "Сохранить" в модальном окне
      - Клик по кнопке "Уведомления"
      ↓
   5. ПРИВЯЗЫВАЕМ ЗАКРЫТИЕ МОДАЛЬНОГО ОКНА
      ↓
   6. ЗАПУСКАЕМ ОБНОВЛЕНИЕ ЛОГОВ
      ↓
   7. ПОЛЬЗОВАТЕЛЬ ВЗАИМОДЕЙСТВУЕТ
      - Нажимает "Приватность" → открывается модальное окно
      - Переключает чекбокс
      - Нажимает "Сохранить" → настройка сохраняется
      - Или нажимает "Отмена" → модальное окно закрывается
      ↓
   8. ПОЛЬЗОВАТЕЛЬ НАСТРАИВАЕТ УВЕДОМЛЕНИЯ
      - Нажимает "Уведомления"
      - Запрашивается разрешение браузера
      - Настройка сохраняется
      - Приходит тестовое уведомление
*/

// ============================
// 11. ОБРАБОТКА ОШИБОК
// ============================

/*
   ТИПЫ ОШИБОК И ИХ ОБРАБОТКА:

   1. Браузер не поддерживает уведомления
      - alert: "Ваш браузер не поддерживает push-уведомления"

   2. Пользователь не дал разрешение
      - alert: "Разрешите уведомления в настройках браузера"

   3. Ошибка сети
      - alert: "Не удалось сохранить настройки"

   4. Ошибка сервера (500)
      - alert: "Не удалось сохранить настройки"

   5. Невалидное поле
      - Сервер вернет ошибку 400
      - alert: "Не удалось сохранить настройки"

   Все ошибки обрабатываются с понятными сообщениями для пользователя
*/

// ============================
// 12. БЕЗОПАСНОСТЬ
// ============================

/*
   МЕРЫ БЕЗОПАСНОСТИ:

   1. Защита от CSRF
      - Куки с SameSite=Lax
      - Токены в HttpOnly куках

   2. Валидация на сервере
      - Проверка существования поля
      - Проверка допустимых значений

   3. Защита от XSS
      - Использование textContent
      - Экранирование данных

   4. HTTPS (в продакшене)
      - Все запросы защищены

   5. Проверка авторизации на сервере
      - Только авторизованные пользователи могут менять настройки
*/

// ============================
// 13. ИНТЕГРАЦИЯ С API
// ============================

/*
   API ЭНДПОИНТЫ, ИСПОЛЬЗУЕМЫЕ В ФАЙЛЕ:

   1. POST /api/profile/settings
      - Обновление настроек профиля
      - Тело: { field, value }
      - Ответ: { ok, field, value }

   2. GET /api/logs
      - Получение логов консоли
      - Используется для обновления панели логов

   ДОПОЛНИТЕЛЬНЫЕ API (для расширения):

   3. POST /api/profile/status
      - Обновление статуса пользователя
      - Тело: { status }

   4. POST /api/profile/avatar
      - Обновление аватара
      - Тело: FormData с файлом

   5. POST /api/profile/password
      - Изменение пароля
      - Тело: { old_password, new_password }

   6. POST /api/profile/2fa
      - Управление двухфакторной аутентификацией
      - Тело: { enabled }

   7. DELETE /api/profile/account
      - Удаление аккаунта
*/

// ============================
// 14. ПРИМЕР ИСПОЛЬЗОВАНИЯ В HTML
// ============================

/*
   <!-- Кнопка настройки приватности -->
   <button id="privacyBtn" class="profile-btn">
       <span class="profile-btn-icon">🔒</span>
       Приватность
       <span class="btn-status">Настроить</span>
   </button>

   <!-- Кнопка настройки уведомлений -->
   <button id="pushBtn" class="profile-btn" data-enabled="true">
       <span class="profile-btn-icon">🔔</span>
       Push-уведомления
       <span class="btn-status">Включены</span>
   </button>

   <!-- Модальное окно приватности -->
   <div id="privacyModal" class="modal-overlay">
       <div class="modal-card">
           <h3 class="modal-title">Настройки приватности</h3>
           
           <label class="toggle-row">
               <input type="checkbox" id="privacyToggle" checked>
               Скрывать статус от других пользователей
           </label>
           
           <div class="modal-actions">
               <button class="btn-modal btn-cancel" data-action="cancel">
                   Отмена
               </button>
               <button id="savePrivacyBtn" class="btn-modal btn-primary-modal">
                   Сохранить
               </button>
           </div>
       </div>
   </div>
*/

// ============================
// 15. ТЕСТИРОВАНИЕ
// ============================

/*
   // Тест 1: Обновление приватности
   console.log('Тест приватности:');
   var testValue = true;
   updateSetting('privacy_hide_status', testValue)
       .then(ok => console.log('Обновление приватности:', ok ? '✅' : '❌'));

   // Тест 2: Обновление уведомлений
   console.log('Тест уведомлений:');
   updateSetting('push_notifications', false)
       .then(ok => console.log('Обновление уведомлений:', ok ? '✅' : '❌'));

   // Тест 3: Открытие модального окна
   console.log('Тест открытия:');
   privacyBtn.click();
   console.log('Модальное окно открыто:', privacyModal.classList.contains('visible'));

   // Тест 4: Сохранение настроек
   console.log('Тест сохранения:');
   privacyToggle.checked = false;
   savePrivacyBtn.click();
   // Ожидаем: модальное окно закрылось, настройка сохранилась

   // Тест 5: Push-уведомления
   console.log('Тест уведомлений:');
   pushBtn.click();
   // Ожидаем: запрос разрешения, тестовое уведомление
*/

// ============================
// 16. ПРОИЗВОДИТЕЛЬНОСТЬ
// ============================

/*
   ОПТИМИЗАЦИИ:

   1. Асинхронные запросы
      - Не блокируют UI
      - Используется async/await

   2. Блокировка кнопок
      - Предотвращает множественные запросы
      - Улучшает UX

   3. Минимальное обновление DOM
      - Обновляется только текст статуса
      - Не перерисовывается вся страница

   4. Кэширование элементов
      - Элементы сохраняются в переменные
      - Не ищутся каждый раз в DOM

   5. Проверка наличия элементов
      - if (element) перед использованием
      - Предотвращает ошибки
*/

// ============================
// 17. ДОПОЛНИТЕЛЬНЫЕ СОВЕТЫ
// ============================

/*
   1. ИСПОЛЬЗОВАНИЕ DATA-АТРИБУТОВ:
      - data-enabled - хранит состояние
      - data-action - для определения действий

   2. ОБРАБОТКА ПЕРЕКЛЮЧАТЕЛЕЙ:
      - Всегда синхронизируем с сервером
      - Обновляем UI после успешного ответа

   3. УВЕДОМЛЕНИЯ:
      - Запрашиваем разрешение только при необходимости
      - Показываем тестовое уведомление

   4. ОБРАБОТКА ОШИБОК:
      - Всегда показываем понятные сообщения
      - Не оставляем кнопки заблокированными

   5. ИНТЕГРАЦИЯ:
      - Используем глобальный объект AdiChat
      - Обновляем логи после каждого действия
*/

// ============================
// 18. РАСШИРЕННЫЙ ПРИМЕР С WEBHOOKS
// ============================

/*
   // Интеграция с внешними сервисами
   async function setupWebhook(url, events) {
       var response = await fetch('/api/profile/webhook', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ 
               url: url,
               events: events  // ['message', 'login', 'status']
           }),
       });
       return response.ok;
   }

   // Синхронизация с календарем
   async function syncCalendar(enabled) {
       var response = await fetch('/api/profile/calendar', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ enabled: enabled }),
       });
       return response.ok;
   }

   // Настройка темной темы
   function toggleTheme(dark) {
       document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
       localStorage.setItem('theme', dark ? 'dark' : 'light');
   }
   
   // Загрузка сохраненной темы
   var savedTheme = localStorage.getItem('theme');
   if (savedTheme) {
       document.documentElement.setAttribute('data-theme', savedTheme);
   }
*/

// Конец файла profile.js
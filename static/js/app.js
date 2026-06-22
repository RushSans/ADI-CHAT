/* ============================
   ФАЙЛ main.js
   Клиентский JavaScript для приложения ADI CHAT
   Отвечает за интерактивность на страницах
   ============================ */

// ============================
// 1. САМОВЫЗЫВАЮЩАЯСЯ ФУНКЦИЯ (IIFE)
// Создает изолированную область видимости, чтобы не засорять глобальный объект window
// ============================

(function () {
    'use strict';  // Включаем строгий режим для лучшей обработки ошибок

    // ============================
    // 2. ПЕРЕМЕННЫЕ
    // ============================

    // Получаем контейнер для логов (панель консоли)
    var logsContainer = document.getElementById('logsContainer');
    
    // Храним ID интервала для обновления логов (чтобы потом остановить)
    var logsInterval = null;

    // ============================
    // 3. ФУНКЦИЯ ОТОБРАЖЕНИЯ ЛОГОВ
    // ============================

    /**
     * Рендерит логи в панели консоли
     * @param {Array} logs - массив объектов логов [{log_type, message}, ...]
     */
    function renderLogs(logs) {
        // Проверяем, существует ли контейнер
        if (!logsContainer) return;
        
        // Преобразуем массив логов в HTML-строку и вставляем в контейнер
        logsContainer.innerHTML = logs.map(function (log) {
            // Определяем CSS-класс в зависимости от типа лога
            // LOG и ERR - красные (ошибки и события), SYS - синие (системные)
            var cls = log.log_type === 'LOG' || log.log_type === 'ERR' ? 'red' : 'blue';
            
            // Определяем префикс для отображения
            var prefix = log.log_type === 'SYS' ? 'SYS' : log.log_type;
            
            // Создаем HTML-элемент для одного лога
            return '<div class="log-entry ' + cls + '">[' + prefix + ']: ' + log.message + '</div>';
        }).join('');  // Объединяем все элементы в одну строку
    }

    // ============================
    // 4. ФУНКЦИЯ ОБНОВЛЕНИЯ ЛОГОВ
    // ============================

    /**
     * Асинхронно загружает свежие логи с сервера и обновляет панель
     */
    async function refreshLogs() {
        // Проверяем: есть ли контейнер и видна ли страница
        // document.hidden - true, если вкладка не активна (оптимизация)
        if (!logsContainer || document.hidden) return;
        
        try {
            // Отправляем GET-запрос к API для получения логов
            var response = await fetch('/api/logs');
            
            // Если ответ не успешный (не 200) - выходим
            if (!response.ok) return;
            
            // Парсим JSON-ответ и отображаем логи
            renderLogs(await response.json());
        } catch (_) {
            // Игнорируем ошибки (например, проблемы с сетью)
            // Пустой catch - подавляем ошибки, чтобы не ломать интерфейс
        }
    }

    // ============================
    // 5. ЗАПУСК ПОЛЛИНГА (ПЕРИОДИЧЕСКОГО ОБНОВЛЕНИЯ)
    // ============================

    /**
     * Запускает периодическое обновление логов
     * @param {number} intervalMs - интервал в миллисекундах (по умолчанию 8000)
     */
    function startLogPolling(intervalMs) {
        // Если контейнера нет - ничего не делаем
        if (!logsContainer) return;
        
        // Если уже есть интервал - очищаем его (чтобы не было дублей)
        if (logsInterval) clearInterval(logsInterval);
        
        // Запускаем новый интервал для обновления логов
        // По умолчанию обновляем каждые 8 секунд
        logsInterval = setInterval(refreshLogs, intervalMs || 8000);
        
        // Добавляем обработчик события видимости страницы
        // Если пользователь вернулся на вкладку - сразу обновляем логи
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden) refreshLogs();  // Обновляем только если вкладка активна
        });
    }

    // ============================
    // 6. УПРАВЛЕНИЕ МОДАЛЬНЫМИ ОКНАМИ
    // ============================

    /**
     * Открывает модальное окно по ID
     * @param {string} id - ID модального окна
     */
    function openModal(id) {
        var modal = document.getElementById(id);
        if (modal) modal.classList.add('visible');  // Добавляем класс для отображения
    }

    /**
     * Закрывает модальное окно по ID
     * @param {string} id - ID модального окна
     */
    function closeModal(id) {
        var modal = document.getElementById(id);
        if (modal) modal.classList.remove('visible');  // Убираем класс для скрытия
    }

    /**
     * Привязывает обработчики для закрытия модального окна
     * @param {string} modalId - ID модального окна
     * @param {string} cancelSelector - CSS-селектор кнопки "Отмена"
     */
    function bindModalClose(modalId, cancelSelector) {
        var modal = document.getElementById(modalId);
        if (!modal) return;  // Если модального окна нет - выходим

        // Находим кнопку "Отмена" внутри модального окна
        var cancelBtn = modal.querySelector(cancelSelector);
        if (cancelBtn) {
            // При клике на "Отмена" закрываем модальное окно
            cancelBtn.addEventListener('click', function () {
                closeModal(modalId);
            });
        }

        // При клике на затемненный фон (overlay) закрываем модальное окно
        modal.addEventListener('click', function (e) {
            if (e.target === modal) closeModal(modalId);
        });
    }

    // ============================
    // 7. ЭКСПОРТ ФУНКЦИЙ В ГЛОБАЛЬНЫЙ ОБЪЕКТ
    // ============================

    /**
     * Создаем глобальный объект window.AdiChat
     * Через него другие скрипты и HTML могут вызывать наши функции
     */
    window.AdiChat = {
        refreshLogs: refreshLogs,              // Обновить логи вручную
        startLogPolling: startLogPolling,      // Запустить автоматическое обновление
        openModal: openModal,                  // Открыть модальное окно
        closeModal: closeModal,                // Закрыть модальное окно
        bindModalClose: bindModalClose,        // Привязать закрытие модального окна
    };

})();  // Конец самовызывающейся функции


// ============================
// 8. ДОПОЛНИТЕЛЬНЫЙ КОД (НЕ ВХОДИТ В ФАЙЛ, НО МОЖЕТ БЫТЬ)
// ============================

/* 
   ПРИМЕР ИСПОЛЬЗОВАНИЯ В HTML:

   <!-- Запуск автоматического обновления логов -->
   <script>
       // Запускаем поллинг с интервалом 5 секунд
       AdiChat.startLogPolling(5000);
   </script>

   <!-- Ручное обновление логов по кнопке -->
   <button onclick="AdiChat.refreshLogs()">Обновить логи</button>

   <!-- Открытие модального окна -->
   <button onclick="AdiChat.openModal('deleteModal')">Удалить чат</button>

   <!-- Закрытие модального окна -->
   <button onclick="AdiChat.closeModal('deleteModal')">Отмена</button>

   <!-- Привязка закрытия модального окна -->
   <script>
       AdiChat.bindModalClose('deleteModal', '.btn-cancel');
   </script>
*/

// ============================
// 9. СТРУКТУРА ДАННЫХ (ЛОГИ)
// ============================

/*
   Формат данных логов, получаемых от сервера:

   [
       {
           "log_type": "LOG",    // Тип: LOG, SYS, ERR
           "message": "IP 192.168.1.1"  // Текст сообщения
       },
       {
           "log_type": "SYS",
           "message": "SSL_ACTIVE"
       },
       {
           "log_type": "ERR",
           "message": "Connection timeout"
       }
   ]

   Каждый лог отображается как:
   [LOG]: IP 192.168.1.1    (красный)
   [SYS]: SSL_ACTIVE         (синий)
   [ERR]: Connection timeout (красный)
*/

// ============================
// 10. ЖИЗНЕННЫЙ ЦИКЛ СТРАНИЦЫ С ЛОГАМИ
// ============================

/*
   1. СТРАНИЦА ЗАГРУЖАЕТСЯ
      ↓
   2. ВЫЗЫВАЕТСЯ startLogPolling()
      ↓
   3. setInterval() ЗАПУСКАЕТ ОБНОВЛЕНИЕ КАЖДЫЕ 8 СЕКУНД
      ↓
   4. КАЖДЫЙ ИНТЕРВАЛ:
      a. Проверяет, видна ли вкладка (document.hidden)
      b. Отправляет запрос GET /api/logs
      c. Получает свежие логи в формате JSON
      d. Отрисовывает их через renderLogs()
      ↓
   5. ЕСЛИ ПОЛЬЗОВАТЕЛЬ ПЕРЕКЛЮЧАЕТ ВКЛАДКУ:
      a. Событие visibilitychange
      b. При возвращении на вкладку - немедленное обновление
      ↓
   6. ПРИ ЗАКРЫТИИ СТРАНИЦЫ:
      Интервал очищается автоматически (setInterval не сохраняется)
*/

// ============================
// 11. ПРИМЕР РАСШИРЕННОГО ИСПОЛЬЗОВАНИЯ
// ============================

/*
   // 1. Можно добавить кнопку для ручного обновления
   <button id="refreshLogsBtn" onclick="AdiChat.refreshLogs()">
       🔄 Обновить логи
   </button>

   // 2. Можно добавить индикатор загрузки
   async function refreshLogsWithIndicator() {
       var indicator = document.getElementById('loadingIndicator');
       if (indicator) indicator.style.display = 'block';
       
       await AdiChat.refreshLogs();
       
       if (indicator) indicator.style.display = 'none';
   }

   // 3. Можно добавить звуковое уведомление при новых логах
   var lastLogCount = 0;
   
   async function refreshLogsWithNotification() {
       var response = await fetch('/api/logs');
       var logs = await response.json();
       
       if (logs.length > lastLogCount) {
           // Есть новые логи - воспроизводим звук
           new Audio('/static/notification.mp3').play();
       }
       
       lastLogCount = logs.length;
       renderLogs(logs);
   }

   // 4. Фильтрация логов по типу
   function renderFilteredLogs(logs, type) {
       var filtered = type ? logs.filter(log => log.log_type === type) : logs;
       renderLogs(filtered);
   }

   // 5. Автоскролл к новым логам
   function renderLogsWithScroll(logs) {
       var wasAtBottom = logsContainer.scrollTop + logsContainer.clientHeight >= logsContainer.scrollHeight - 50;
       
       renderLogs(logs);
       
       if (wasAtBottom) {
           logsContainer.scrollTop = logsContainer.scrollHeight;
       }
   }
*/

// ============================
// 12. ОПТИМИЗАЦИЯ ПРОИЗВОДИТЕЛЬНОСТИ
// ============================

/*
   МЕТОДЫ ОПТИМИЗАЦИИ:

   1. document.hidden - не обновляем логи, если вкладка не активна
      Экономит трафик и ресурсы процессора

   2. Остановка интервала при уходе со страницы
      Если пользователь перешел на другую страницу, интервал останавливается

   3. Использование async/await для асинхронных запросов
      Не блокирует основной поток

   4. Пустой catch - подавление ошибок
      Если запрос не удался, интерфейс не ломается

   5. Обновление только HTML-содержимого
      Не пересоздаем DOM-элементы, просто меняем innerHTML

   6. join('') для сборки HTML
      Быстрее, чем конкатенация строк в цикле
*/

// ============================
// 13. ПРИМЕР С МОДАЛЬНЫМ ОКНОМ (HTML)
// ============================

/*
   <!-- Модальное окно для подтверждения удаления -->
   <div id="deleteModal" class="modal-overlay">
       <div class="modal-card">
           <h3 class="modal-title">Удалить чат?</h3>
           <p class="modal-desc">
               Все сообщения с этим пользователем будут удалены безвозвратно.
           </p>
           <div class="modal-actions">
               <button class="btn-modal btn-cancel" id="cancelDelete">Отмена</button>
               <button class="btn-modal btn-danger" id="confirmDelete">
                   Удалить
               </button>
           </div>
       </div>
   </div>

   <script>
       // Привязываем закрытие по кнопке "Отмена"
       AdiChat.bindModalClose('deleteModal', '#cancelDelete');

       // Открываем модальное окно при клике на кнопку удаления
       document.getElementById('deleteChatBtn').addEventListener('click', function() {
           AdiChat.openModal('deleteModal');
       });

       // Обработчик подтверждения удаления
       document.getElementById('confirmDelete').addEventListener('click', function() {
           // Отправляем запрос на удаление
           fetch('/api/conversations/123', { method: 'DELETE' })
               .then(response => response.json())
               .then(data => {
                   AdiChat.closeModal('deleteModal');
                   location.reload();  // Перезагружаем страницу
               });
       });
   </script>
*/

// ============================
// 14. ТЕСТИРОВАНИЕ
// ============================

/*
   // Тест 1: Проверка рендеринга логов
   console.log('Тест рендеринга:');
   var testLogs = [
       { log_type: 'LOG', message: 'Test log message' },
       { log_type: 'SYS', message: 'System test' },
       { log_type: 'ERR', message: 'Error test' }
   ];
   renderLogs(testLogs);
   // Ожидаем: 3 записи в контейнере

   // Тест 2: Проверка открытия/закрытия модального окна
   console.log('Тест модального окна:');
   // Создаем тестовое модальное окно
   var modal = document.createElement('div');
   modal.id = 'testModal';
   modal.className = 'modal-overlay';
   modal.innerHTML = '<div class="modal-card">Test</div>';
   document.body.appendChild(modal);
   
   openModal('testModal');
   console.log('Модальное окно открыто:', modal.classList.contains('visible'));
   
   closeModal('testModal');
   console.log('Модальное окно закрыто:', !modal.classList.contains('visible'));

   // Тест 3: Проверка поллинга
   console.log('Тест поллинга:');
   var counter = 0;
   var originalRefresh = refreshLogs;
   refreshLogs = function() {
       counter++;
       console.log('Обновление #' + counter);
       return originalRefresh.apply(this, arguments);
   };
   startLogPolling(1000);
   // Через 5 секунд должно быть ~5 обновлений
   setTimeout(function() {
       clearInterval(logsInterval);
       console.log('Всего обновлений:', counter);
   }, 5000);
*/

// ============================
// 15. РАСШИРЕННЫЙ ПРИМЕР С ВЕБ-СОКЕТАМИ
// ============================

/*
   // Альтернатива поллингу - использование WebSocket для реального времени
   function connectWebSocket() {
       var ws = new WebSocket('ws://localhost:8000/ws/logs');
       
       ws.onmessage = function(event) {
           var log = JSON.parse(event.data);
           var logs = [log];  // Массив с одним логом
           renderLogs(logs);   // Добавляем новый лог
       };
       
       ws.onerror = function(error) {
           console.error('WebSocket error:', error);
       };
       
       ws.onclose = function() {
           // Пытаемся переподключиться через 5 секунд
           setTimeout(connectWebSocket, 5000);
       };
   }
   
   // Использование:
   // connectWebSocket();
   // Теперь логи обновляются в реальном времени!
*/

// ============================
// 16. ВАЖНЫЕ ЗАМЕЧАНИЯ
// ============================

/*
   1. СОВМЕСТИМОСТЬ С БРАУЗЕРАМИ:
      - Используется ES5 синтаксис (var, function) для лучшей совместимости
      - async/await работает в современных браузерах
      - Если нужна поддержка IE11, нужно добавить полифилы

   2. БЕЗОПАСНОСТЬ:
      - Все запросы отправляются с куками автоматически
      - HttpOnly куки защищают токен от XSS
      - API проверяет авторизацию на сервере

   3. ПРОИЗВОДИТЕЛЬНОСТЬ:
      - Поллинг каждые 8 секунд - не нагружает сервер
      - document.hidden предотвращает запросы в фоне

   4. РАСШИРЯЕМОСТЬ:
      - Функции вынесены в глобальный объект AdiChat
      - Легко добавлять новые функции
      - Модульная структура
*/

// Конец файла main.js
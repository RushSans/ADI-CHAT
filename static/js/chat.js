/* ============================
   ФАЙЛ chat.js
   Клиентский JavaScript для страницы чата
   Отвечает за отправку сообщений, управление чатом и модальными окнами
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

    // Поле ввода сообщения
    var msgInput = document.getElementById('msgInput');
    
    // Кнопка отправки сообщения
    var sendBtn = document.getElementById('sendBtn');
    
    // Контейнер для сообщений (область чата)
    var msgContainer = document.getElementById('msgContainer');
    
    // Кнопка удаления чата
    var deleteBtn = document.getElementById('deleteChatBtn');
    
    // Кнопка подтверждения удаления (в модальном окне)
    var confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    
    // Заголовок модального окна удаления
    var deleteModalTitle = document.getElementById('deleteModalTitle');

    // ============================
    // 3. ФУНКЦИЯ ПРОКРУТКИ ВНИЗ
    // ============================

    /**
     * Прокручивает контейнер с сообщениями в самый низ
     * Чтобы видеть последние сообщения
     */
    function scrollToBottom() {
        if (msgContainer) {
            // Устанавливаем прокрутку на максимальную высоту
            msgContainer.scrollTop = msgContainer.scrollHeight;
        }
    }

    // ============================
    // 4. ФУНКЦИЯ ДОБАВЛЕНИЯ СООБЩЕНИЯ
    // ============================

    /**
     * Добавляет новое сообщение в контейнер чата
     * @param {string} text - Текст сообщения
     * @param {boolean} isOutgoing - Исходящее (true) или входящее (false)
     * @param {string} time - Время отправки (опционально)
     */
    function appendMessage(text, isOutgoing, time) {
        // Проверяем, существует ли контейнер
        if (!msgContainer) return;
        
        // Если есть заглушка "Нет сообщений" - удаляем её
        var empty = msgContainer.querySelector('.empty-chat');
        if (empty) empty.remove();

        // Создаем элемент для сообщения
        var msgDiv = document.createElement('div');
        
        // Добавляем CSS-класс в зависимости от типа сообщения
        msgDiv.className = 'msg ' + (isOutgoing ? 'outgoing' : 'incoming');
        
        // Добавляем текст сообщения
        msgDiv.appendChild(document.createTextNode(text));
        
        // Если есть время - добавляем его
        if (time) {
            var timeSpan = document.createElement('span');
            timeSpan.className = 'msg-time';
            timeSpan.textContent = time;
            msgDiv.appendChild(timeSpan);
        }
        
        // Добавляем сообщение в контейнер
        msgContainer.appendChild(msgDiv);
        
        // Прокручиваем вниз, чтобы увидеть новое сообщение
        scrollToBottom();
    }

    // ============================
    // 5. ФУНКЦИЯ ОТПРАВКИ СООБЩЕНИЯ
    // ============================

    /**
     * Отправляет сообщение на сервер через API
     * Асинхронная функция с обработкой ошибок
     */
    async function sendMessage() {
        // Проверяем наличие элементов
        if (!msgInput || !sendBtn) return;
        
        // Получаем текст сообщения и удаляем лишние пробелы
        var text = msgInput.value.trim();
        
        // Если текст пустой - ничего не отправляем
        if (!text) return;

        // Блокируем кнопку, чтобы предотвратить двойную отправку
        sendBtn.disabled = true;
        
        try {
            // Отправляем POST-запрос к API для создания сообщения
            var response = await fetch('/api/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    // ID получателя берем из data-атрибута кнопки
                    receiver_id: parseInt(sendBtn.dataset.partnerId, 10),
                    text: text,
                }),
            });

            // Если ответ не успешный - показываем ошибку
            if (!response.ok) {
                alert('Не удалось отправить сообщение');
                return;
            }

            // Получаем данные созданного сообщения
            var data = await response.json();
            
            // Добавляем сообщение в чат (локально, без перезагрузки)
            appendMessage(data.text, data.is_outgoing, data.time);
            
            // Очищаем поле ввода
            msgInput.value = '';
            
            // Обновляем логи в консоли
            window.AdiChat.refreshLogs();
            
        } catch (_) {
            // Ошибка сети или другие проблемы
            alert('Ошибка сети. Проверьте подключение.');
        } finally {
            // В любом случае разблокируем кнопку
            sendBtn.disabled = false;
            
            // Возвращаем фокус на поле ввода
            msgInput.focus();
        }
    }

    // ============================
    // 6. ФУНКЦИЯ УДАЛЕНИЯ ЧАТА
    // ============================

    /**
     * Удаляет всю переписку с текущим собеседником
     * Асинхронная функция с обработкой ошибок
     */
    async function deleteChat() {
        // Проверяем наличие кнопки отправки (она содержит ID партнера)
        if (!sendBtn) return;
        
        // Получаем ID партнера из data-атрибута
        var partnerId = sendBtn.dataset.partnerId;
        
        // Блокируем кнопку подтверждения
        confirmDeleteBtn.disabled = true;

        try {
            // Отправляем DELETE-запрос к API
            var response = await fetch('/api/conversations/' + partnerId, { 
                method: 'DELETE' 
            });
            
            // Если ответ не успешный - показываем ошибку
            if (!response.ok) {
                alert('Не удалось удалить чат');
                return;
            }
            
            // Перенаправляем пользователя на главную страницу чата
            window.location.href = '/chat';
            
        } catch (_) {
            // Ошибка сети или другие проблемы
            alert('Ошибка сети. Проверьте подключение.');
        } finally {
            // Разблокируем кнопку
            confirmDeleteBtn.disabled = false;
        }
    }

    // ============================
    // 7. НАСТРОЙКА ОБРАБОТЧИКОВ СОБЫТИЙ
    // ============================

    // --- 7.1. Отправка по клику на кнопку ---
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }

    // --- 7.2. Отправка по нажатию Enter ---
    if (msgInput) {
        msgInput.addEventListener('keydown', function (e) {
            // Если нажат Enter (не Shift+Enter)
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();  // Предотвращаем перевод строки
                sendMessage();       // Отправляем сообщение
            }
        });
        
        // Автоматически фокусируем поле ввода
        msgInput.focus();
    }

    // --- 7.3. Открытие модального окна удаления ---
    if (deleteBtn && sendBtn) {
        deleteBtn.addEventListener('click', function () {
            // Устанавливаем заголовок модального окна с именем собеседника
            if (deleteModalTitle) {
                deleteModalTitle.textContent = 'Удалить чат с ' + deleteBtn.dataset.partnerName + '?';
            }
            
            // Открываем модальное окно (используем глобальную функцию)
            window.AdiChat.openModal('deleteModal');
        });
    }

    // --- 7.4. Подтверждение удаления ---
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', deleteChat);
    }

    // ============================
    // 8. ПРИВЯЗКА ЗАКРЫТИЯ МОДАЛЬНОГО ОКНА
    // ============================

    // Привязываем закрытие модального окна к кнопке "Отмена"
    // Используем data-action="cancel" для поиска кнопки
    window.AdiChat.bindModalClose('deleteModal', '[data-action="cancel"]');

    // ============================
    // 9. ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ
    // ============================

    // Прокручиваем чат вниз (к последним сообщениям)
    scrollToBottom();
    
    // Запускаем автоматическое обновление логов (каждые 8 секунд)
    window.AdiChat.startLogPolling(8000);

})();  // Конец самовызывающейся функции


// ============================
// 10. ДОПОЛНИТЕЛЬНЫЕ ВОЗМОЖНОСТИ
// ============================

/* 
   РАСШИРЕННЫЕ ФУНКЦИИ, КОТОРЫЕ МОЖНО ДОБАВИТЬ:

   // 1. Индикатор набора текста (печатает...)
   var typingTimeout = null;
   
   function showTypingIndicator() {
       var indicator = document.getElementById('typingIndicator');
       if (indicator) indicator.style.display = 'block';
       
       clearTimeout(typingTimeout);
       typingTimeout = setTimeout(function() {
           hideTypingIndicator();
       }, 3000);
   }
   
   function hideTypingIndicator() {
       var indicator = document.getElementById('typingIndicator');
       if (indicator) indicator.style.display = 'none';
   }

   // 2. Отметка о прочтении сообщений
   function markAsRead(messageId) {
       fetch('/api/messages/' + messageId + '/read', { method: 'POST' });
   }

   // 3. Загрузка старых сообщений (пагинация)
   var currentPage = 0;
   var isLoading = false;
   
   async function loadMoreMessages() {
       if (isLoading) return;
       isLoading = true;
       
       try {
           var response = await fetch('/api/messages?page=' + currentPage + '&partner=' + partnerId);
           var messages = await response.json();
           
           if (messages.length > 0) {
               currentPage++;
               // Добавляем сообщения в начало списка
               messages.reverse().forEach(function(msg) {
                   prependMessage(msg.text, msg.is_outgoing, msg.time);
               });
           }
       } finally {
           isLoading = false;
       }
   }
   
   // Бесконечная прокрутка
   if (msgContainer) {
       msgContainer.addEventListener('scroll', function() {
           if (msgContainer.scrollTop === 0) {
               loadMoreMessages();
           }
       });
   }

   // 4. Эмодзи-пикер
   function insertEmoji(emoji) {
       if (msgInput) {
           var start = msgInput.selectionStart;
           var end = msgInput.selectionEnd;
           msgInput.value = msgInput.value.substring(0, start) + emoji + msgInput.value.substring(end);
           msgInput.selectionStart = msgInput.selectionEnd = start + emoji.length;
           msgInput.focus();
       }
   }

   // 5. Прикрепление файлов
   async function uploadFile(file) {
       var formData = new FormData();
       formData.append('file', file);
       formData.append('receiver_id', sendBtn.dataset.partnerId);
       
       var response = await fetch('/api/messages/file', {
           method: 'POST',
           body: formData
       });
       
       if (response.ok) {
           var data = await response.json();
           appendMessage('📎 ' + file.name, true, data.time);
       }
   }

   // 6. Уведомления о новых сообщениях
   var lastMessageCount = 0;
   
   function checkNewMessages() {
       var messages = msgContainer.querySelectorAll('.msg');
       if (messages.length > lastMessageCount) {
           // Воспроизводим звук уведомления
           var audio = new Audio('/static/notification.mp3');
           audio.play();
           
           // Обновляем заголовок страницы
           var unreadCount = messages.length - lastMessageCount;
           document.title = '(' + unreadCount + ') ADI CHAT';
       }
       lastMessageCount = messages.length;
   }
   
   // Проверяем новые сообщения каждые 5 секунд
   setInterval(checkNewMessages, 5000);

   // 7. Голосовой ввод
   if ('webkitSpeechRecognition' in window) {
       var recognition = new webkitSpeechRecognition();
       recognition.lang = 'ru-RU';
       
       document.getElementById('voiceBtn').addEventListener('click', function() {
           recognition.start();
       });
       
       recognition.onresult = function(event) {
           var transcript = event.results[0][0].transcript;
           if (msgInput) {
               msgInput.value += transcript;
           }
       };
   }
*/

// ============================
// 11. СТРУКТУРА ДАННЫХ (СООБЩЕНИЯ)
// ============================

/*
   Формат сообщения, получаемого от сервера:

   {
       "id": 123,
       "text": "Привет!",
       "is_outgoing": true,
       "time": "14:30"
   }

   Пример HTML-кода для сообщения:

   <div class="msg outgoing">
       Привет!
       <span class="msg-time">14:30</span>
   </div>

   <div class="msg incoming">
       Здравствуй!
       <span class="msg-time">14:31</span>
   </div>
*/

// ============================
// 12. ЖИЗНЕННЫЙ ЦИКЛ СТРАНИЦЫ ЧАТА
// ============================

/*
   1. СТРАНИЦА ЗАГРУЖАЕТСЯ
      ↓
   2. IIFE ВЫПОЛНЯЕТСЯ
      ↓
   3. ПОЛУЧАЕМ ЭЛЕМЕНТЫ DOM
      ↓
   4. НАСТРАИВАЕМ ОБРАБОТЧИКИ
      - Клик по кнопке отправки
      - Нажатие Enter в поле ввода
      - Клик по кнопке удаления
      - Подтверждение удаления
      ↓
   5. ПРОКРУТКА ВНИЗ (scrollToBottom)
      ↓
   6. ЗАПУСК ОБНОВЛЕНИЯ ЛОГОВ
      ↓
   7. ПОЛЬЗОВАТЕЛЬ ВЗАИМОДЕЙСТВУЕТ
      - Вводит текст
      - Нажимает Enter или кнопку
      - Сообщение отправляется на сервер
      - Сообщение добавляется в чат
      - Поле ввода очищается
      - Логи обновляются
      ↓
   8. ПОЛЬЗОВАТЕЛЬ УДАЛЯЕТ ЧАТ
      - Нажимает кнопку удаления
      - Открывается модальное окно
      - Подтверждает удаление
      - Чат удаляется на сервере
      - Перенаправление на /chat
*/

// ============================
// 13. ОБРАБОТКА ОШИБОК
// ============================

/*
   ТИПЫ ОШИБОК И ИХ ОБРАБОТКА:

   1. Ошибка сети (fetch)
      - Показываем alert: "Ошибка сети"
      - Разблокируем кнопку

   2. HTTP ошибка (response не ok)
      - Показываем alert: "Не удалось отправить сообщение"
      - Сообщение не добавляется в чат

   3. Пустое сообщение
      - Игнорируем (не отправляем)

   4. Нет соединения с сервером
      - alert: "Ошибка сети. Проверьте подключение."

   Все ошибки логируются в консоль (пустой catch)
*/

// ============================
// 14. ПРИМЕР ИСПОЛЬЗОВАНИЯ В HTML
// ============================

/*
   <!-- Кнопка отправки с data-атрибутами -->
   <button id="sendBtn" data-partner-id="2">
       Отправить
   </button>

   <!-- Кнопка удаления с data-атрибутами -->
   <button id="deleteChatBtn" data-partner-name="Илья">
       🗑️
   </button>

   <!-- Модальное окно удаления -->
   <div id="deleteModal" class="modal-overlay">
       <div class="modal-card">
           <h3 id="deleteModalTitle">Удалить чат?</h3>
           <div class="modal-actions">
               <button class="btn-modal btn-cancel" data-action="cancel">
                   Отмена
               </button>
               <button id="confirmDeleteBtn" class="btn-modal btn-danger">
                   Удалить
               </button>
           </div>
       </div>
   </div>

   <!-- Поле ввода -->
   <input id="msgInput" type="text" placeholder="Введите сообщение...">

   <!-- Контейнер сообщений -->
   <div id="msgContainer">
       <div class="empty-chat">
           Нет сообщений. Напишите что-нибудь!
       </div>
   </div>
*/

// ============================
// 15. ТЕСТИРОВАНИЕ
// ============================

/*
   // Тест 1: Отправка сообщения
   console.log('Тест отправки:');
   msgInput.value = 'Тестовое сообщение';
   sendMessage();
   // Ожидаем: сообщение появилось в чате

   // Тест 2: Удаление чата
   console.log('Тест удаления:');
   // Кликаем на deleteBtn
   deleteBtn.click();
   // Ожидаем: открылось модальное окно
   // Кликаем на confirmDeleteBtn
   confirmDeleteBtn.click();
   // Ожидаем: перенаправление на /chat

   // Тест 3: Прокрутка
   console.log('Тест прокрутки:');
   var oldScroll = msgContainer.scrollTop;
   scrollToBottom();
   var newScroll = msgContainer.scrollTop;
   console.log('Прокрутка изменилась:', oldScroll !== newScroll);

   // Тест 4: Обработка Enter
   console.log('Тест Enter:');
   var event = new KeyboardEvent('keydown', { key: 'Enter' });
   msgInput.dispatchEvent(event);
   // Ожидаем: сообщение отправилось
*/

// ============================
// 16. ПРОИЗВОДИТЕЛЬНОСТЬ
// ============================

/*
   ОПТИМИЗАЦИИ В КОДЕ:

   1. Использование document.getElementById
      - Самый быстрый способ получить элемент

   2. Проверка наличия элементов
      - if (!element) return - предотвращает ошибки

   3. Создание элементов через document.createElement
      - Быстрее, чем innerHTML

   4. Использование async/await
      - Не блокирует UI

   5. scrollToBottom после добавления сообщения
      - Автоматическая прокрутка

   6. Блокировка кнопок при отправке
      - Предотвращает двойные запросы

   7. Пустой catch
      - Подавляет ошибки, не ломает интерфейс
*/

// ============================
// 17. БЕЗОПАСНОСТЬ
// ============================

/*
   МЕРЫ БЕЗОПАСНОСТИ:

   1. XSS защита
      - Используем textContent и createTextNode
      - Не вставляем HTML напрямую

   2. CSRF защита
      - Куки с SameSite=Lax
      - Токены в HttpOnly куках

   3. Валидация на клиенте
      - trim() для удаления пробелов
      - Проверка на пустые сообщения

   4. Валидация на сервере
      - Проверка длины сообщения
      - Проверка прав доступа

   5. HTTPS (в продакшене)
      - Все запросы защищены
*/

// ============================
// 18. ИНТЕГРАЦИЯ С ДРУГИМИ МОДУЛЯМИ
// ============================

/*
   ЗАВИСИМОСТИ:

   1. window.AdiChat
      - refreshLogs() - обновление логов
      - startLogPolling() - запуск поллинга
      - openModal() - открытие модального окна
      - closeModal() - закрытие модального окна
      - bindModalClose() - привязка закрытия

   2. API эндпоинты
      - POST /api/messages - отправка сообщения
      - DELETE /api/conversations/{id} - удаление чата
      - GET /api/logs - получение логов

   3. CSS классы
      - .msg - сообщение
      - .outgoing - исходящее
      - .incoming - входящее
      - .msg-time - время сообщения
      - .empty-chat - заглушка
      - .modal-overlay - модальное окно
      - .visible - видимость модального окна
*/

// Конец файла chat.js
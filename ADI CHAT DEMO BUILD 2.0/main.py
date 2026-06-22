from contextlib import asynccontextmanager  # Для управления жизненным циклом приложения
from typing import Optional  # Для аннотаций типов (указываем, что значение может быть None)

from fastapi import FastAPI, Request, Form, Depends, status  # Основные компоненты FastAPI
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse  # Типы HTTP-ответов
from fastapi.staticfiles import StaticFiles  # Для раздачи статических файлов (CSS, JS)
from fastapi.templating import Jinja2Templates  # Для рендеринга HTML-шаблонов
from pydantic import BaseModel, Field  # Для валидации данных в API-запросах
from sqlalchemy.orm import Session  # Для работы с базой данных через ORM
import os  # Для работы с файловой системой

import auth_utils  # Наш модуль с функциями: хэширование паролей, создание/проверка JWT-токенов
import database  # Наш модуль с моделями БД и функциями для работы с ней


# ============================
# 1. ДЕМО-ДАННЫЕ И НАСТРОЙКИ
# ============================

# Список тестовых пользователей для демонстрации работы приложения
DEMO_USERS = [
    {
        "username": "Денис Зыков",
        "email": "denis@adi.chat",
        "password": "demo1234",
        "status": "Разработка модулей интерфейса",  # Статус пользователя (онлайн-статус)
        "avatar_color": "#2ecc71",  # Цвет аватарки (зеленый)
    },
    {
        "username": "Илья",
        "email": "ilya@adi.chat",
        "password": "demo1234",
        "status": "Всё готово!",
        "avatar_color": "#00a8ff",  # Синий
    },
]

# Настройки сессионной куки
SESSION_COOKIE = "adi_session"  # Имя cookie-файла, в котором хранится сессионный токен
SESSION_MAX_AGE = 60 * 60 * 24 * 7  # Время жизни сессии: 7 дней (в секундах)


# ============================
# 2. ФУНКЦИЯ ЗАПОЛНЕНИЯ БАЗЫ ДАННЫХ
# ============================

def seed_database(db: Session):
    """
    Заполняет базу данных начальными (демо) данными.
    Вызывается при первом запуске приложения.
    """
    
    # --- 2.1. Добавляем демо-логи в консоль ---
    # Проверяем, есть ли вообще логи в таблице ConsoleLog
    if db.query(database.ConsoleLog).count() == 0:
        # Если логов нет - добавляем несколько тестовых записей
        db.add(database.ConsoleLog(log_type="LOG", message="IP 192.168.1.1"))
        db.add(database.ConsoleLog(log_type="SYS", message="SSL_ACTIVE"))
        db.commit()  # Сохраняем изменения в БД

    # --- 2.2. Добавляем или обновляем демо-пользователей ---
    # Преобразуем список демо-пользователей в словарь {email: данные}
    demo_by_email = {u["email"]: u for u in DEMO_USERS}
    demo_emails = list(demo_by_email.keys())

    # Проходим по каждому демо-пользователю
    for email, data in demo_by_email.items():
        # Ищем пользователя в БД по email
        user = db.query(database.User).filter(database.User.email == email).first()
        
        if not user:
            # Если пользователь не найден - создаем нового
            db.add(database.User(
                username=data["username"],
                email=data["email"],
                password_hash=auth_utils.hash_password(data["password"]),  # Хэшируем пароль
                status=data["status"],
                avatar_color=data["avatar_color"],
            ))
        else:
            # Если пользователь уже существует - обновляем его данные
            user.username = data["username"]
            user.status = data["status"]
            user.avatar_color = data["avatar_color"]
    
    db.commit()  # Сохраняем все изменения

    # --- 2.3. Добавляем тестовые сообщения между Денисом и Ильей ---
    # Получаем из БД пользователей по email
    users = {u.email: u for u in db.query(database.User).filter(database.User.email.in_(demo_emails)).all()}
    denis = users.get("denis@adi.chat")
    ilya = users.get("ilya@adi.chat")

    # Если оба пользователя существуют и в БД еще нет сообщений
    if denis and ilya and db.query(database.Message).count() == 0:
        # Создаем два тестовых сообщения
        db.add(database.Message(sender_id=denis.id, receiver_id=ilya.id, text="Привет!"))
        db.add(database.Message(sender_id=ilya.id, receiver_id=denis.id, text="Привет! Да, закидывай."))
        db.commit()


# ============================
# 3. УПРАВЛЕНИЕ ЖИЗНЕННЫМ ЦИКЛОМ ПРИЛОЖЕНИЯ
# ============================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Менеджер контекста для управления жизненным циклом приложения FastAPI.
    Выполняется один раз при запуске сервера и один раз при его остановке.
    
    async with lifespan(app):
        # Здесь приложение работает и обрабатывает запросы
    """
    try:
        # --- При старте сервера ---
        # Инициализируем базу данных (создаем таблицы, если их нет)
        database.init_db()
        
        # Создаем сессию для работы с БД
        db = database.SessionLocal()
        try:
            # Заполняем БД демо-данными
            seed_database(db)
        finally:
            # Закрываем соединение с БД
            db.close()
            
    except Exception as e:
        # Логируем ошибку, если что-то пошло не так
        print(f"[БД ОШИБКА]: {e}")
    
    # Важно! yield - точка, где приложение начинает работать
    yield
    
    # --- При остановке сервера ---
    # Здесь можно добавить код для очистки ресурсов (закрытие соединений и т.д.)


# Создаем экземпляр FastAPI
app = FastAPI(
    title="ADI CHAT API",
    debug=True,  # Включаем режим отладки
    lifespan=lifespan  # Подключаем наш менеджер жизненного цикла
)


# ============================
# 4. НАСТРОЙКА СТАТИЧЕСКИХ ФАЙЛОВ И ШАБЛОНОВ
# ============================

# Создаем необходимые папки, если они не существуют
if not os.path.exists("static"):
    os.makedirs("static/css", exist_ok=True)
    os.makedirs("static/js", exist_ok=True)
if not os.path.exists("templates"):
    os.makedirs("templates", exist_ok=True)

# Подключаем папку static для раздачи статических файлов (CSS, JS, изображения)
# Теперь файлы из static будут доступны по URL: /static/имя_файла
app.mount("/static", StaticFiles(directory="static"), name="static")

# Настраиваем шаблонизатор Jinja2 для рендеринга HTML-страниц
# Все шаблоны должны лежать в папке templates
templates = Jinja2Templates(directory="templates")


# ============================
# 5. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
# ============================

def get_db():
    """
    Генератор для получения сессии базы данных.
    Используется как зависимость (Depends) в маршрутах.
    Автоматически закрывает сессию после использования.
    """
    db = database.SessionLocal()
    try:
        yield db  # Возвращаем сессию
    finally:
        db.close()  # Закрываем сессию в любом случае


def get_client_ip(request: Request) -> str:
    """
    Определяет реальный IP-адрес клиента.
    Учитывает заголовок X-Forwarded-For (если приложение работает за прокси).
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        # Если есть заголовок - берем первый IP из списка
        return forwarded.split(",")[0].strip()
    # Иначе берем IP из соединения
    return request.client.host if request.client else "unknown"


def get_current_user(request: Request, db: Session) -> Optional[database.User]:
    """
    Извлекает текущего авторизованного пользователя из cookie.
    Возвращает объект User или None, если пользователь не авторизован.
    """
    # Получаем токен из cookie
    token = request.cookies.get(SESSION_COOKIE)
    
    # Проверяем токен и получаем ID пользователя
    user_id = auth_utils.verify_session_token(token)
    
    if not user_id:
        return None
    
    # Ищем пользователя в БД по ID
    return db.query(database.User).filter(database.User.id == user_id).first()


def require_user(request: Request, db: Session) -> Optional[database.User]:
    """
    Алиас для get_current_user.
    Используется в маршрутах для проверки авторизации.
    """
    return get_current_user(request, db)


def set_session_cookie(response: RedirectResponse, user_id: int):
    """
    Устанавливает сессионную cookie после успешной аутентификации.
    Создает JWT-токен с ID пользователя и сохраняет его в cookie.
    """
    response.set_cookie(
        key=SESSION_COOKIE,
        value=auth_utils.create_session_token(user_id),  # Создаем токен
        max_age=SESSION_MAX_AGE,  # Время жизни
        httponly=True,  # Защита от XSS (недоступно из JavaScript)
        samesite="lax",  # Защита от CSRF
    )


def build_chats(contacts, active_partner_id: Optional[int] = None):
    """
    Строит список контактов для отображения в боковой панели чата.
    
    contacts: список объектов User (контакты текущего пользователя)
    active_partner_id: ID активного собеседника (если есть)
    
    Возвращает список словарей с данными для отображения в шаблоне.
    """
    return [
        {
            "id": u.id,
            "username": u.username,
            "status": "Статус скрыт" if u.privacy_hide_status else u.status,
            "color": u.avatar_color,
            "active": active_partner_id == u.id,  # Активный ли этот контакт
        }
        for u in contacts
    ]


def build_app_context(current_user, db: Session, with_user: Optional[int] = None, active_nav: str = "chat"):
    """
    Строит контекст для шаблонов - все данные, необходимые для отображения страницы.
    
    current_user: текущий авторизованный пользователь
    db: сессия БД
    with_user: ID пользователя, с которым открыт чат (опционально)
    active_nav: активный пункт навигации ("chat", "profile", "events")
    
    Возвращает словарь с данными для шаблона.
    """
    # Получаем список контактов текущего пользователя
    contacts = database.get_contacts(db, current_user.id)

    # --- Определяем активного собеседника ---
    active_partner = None
    
    # Если указан конкретный пользователь - ищем его
    if with_user:
        active_partner = db.query(database.User).filter(database.User.id == with_user).first()
    
    # Если активный собеседник не найден и мы в чате - берем первый контакт из списка
    if not active_partner and contacts and active_nav == "chat":
        active_partner = contacts[0]

    # --- Получаем сообщения с активным собеседником ---
    messages = []
    partner_display = None
    
    if active_partner:
        # Данные для отображения собеседника
        partner_display = {
            "id": active_partner.id,
            "username": active_partner.username,
            "status": "Статус скрыт" if active_partner.privacy_hide_status else active_partner.status,
        }
        
        # Получаем историю переписки
        messages = [
            {
                "text": m.text,
                "is_outgoing": m.sender_id == current_user.id,  # Исходящее или входящее
                "time": m.timestamp.strftime("%H:%M") if m.timestamp else "",
            }
            for m in database.get_conversation(db, current_user.id, active_partner.id)
        ]

    # Возвращаем полный контекст для шаблона
    return {
        "current_user": current_user,
        "chats": build_chats(contacts, active_partner.id if active_partner else None),
        "active_partner": partner_display,
        "messages": messages,
        "logs": database.get_recent_logs(db),
        "active_nav": active_nav,
        "show_back": active_nav != "chat",  # Показывать кнопку "Назад" на других страницах
        "back_url": "/chat",
    }


# Словарь с сообщениями об ошибках для отображения на странице авторизации
ERROR_MESSAGES = {
    "user_exists": "Пользователь с таким email уже зарегистрирован.",
    "username_exists": "Это имя пользователя уже занято.",
    "wrong_credentials": "Неверный email или пароль.",
    "password_short": "Пароль должен содержать минимум 6 символов.",
}


# ============================
# 6. МАРШРУТЫ АУТЕНТИФИКАЦИИ
# ============================

@app.get("/", response_class=HTMLResponse)
async def auth_page(request: Request, error: Optional[str] = None, mode: Optional[str] = None):
    """
    Главная страница - страница входа/регистрации.
    Если передан параметр error - показывает сообщение об ошибке.
    Если передан mode=register - показывает форму регистрации.
    """
    return templates.TemplateResponse(
        request=request,
        name="auth.html",  # Шаблон для страницы авторизации
        context={
            "error": ERROR_MESSAGES.get(error),  # Текст ошибки
            "error_code": error,  # Код ошибки
            "show_register": mode == "register" or error in ("user_exists", "username_exists", "password_short"),
            # Показывать форму регистрации, если:
            # - передан mode=register
            # - или ошибка связана с регистрацией
        },
    )


@app.post("/register")
async def register(
    request: Request,
    username: str = Form(...),  # Извлекаем данные из HTML-формы
    email: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),  # Автоматически получаем сессию БД
):
    """
    Обработчик регистрации нового пользователя.
    """
    # Очищаем данные от лишних пробелов и приводим email к нижнему регистру
    username = username.strip()
    email = email.strip().lower()

    # --- 1. Проверяем пароль ---
    if len(password) < 6:
        return RedirectResponse(
            url="/?error=password_short&mode=register",
            status_code=status.HTTP_303_SEE_OTHER  # 303 - перенаправление с POST на GET
        )

    # --- 2. Проверяем, не занят ли email ---
    if db.query(database.User).filter(database.User.email == email).first():
        return RedirectResponse(
            url="/?error=user_exists&mode=register",
            status_code=status.HTTP_303_SEE_OTHER
        )

    # --- 3. Проверяем, не занято ли имя пользователя ---
    if db.query(database.User).filter(database.User.username == username).first():
        return RedirectResponse(
            url="/?error=username_exists&mode=register",
            status_code=status.HTTP_303_SEE_OTHER
        )

    # --- 4. Создаем нового пользователя ---
    new_user = database.User(
        username=username,
        email=email,
        password_hash=auth_utils.hash_password(password),  # Хэшируем пароль
    )
    db.add(new_user)
    db.commit()  # Сохраняем в БД
    db.refresh(new_user)  # Обновляем объект (получаем ID и другие данные из БД)

    # --- 5. Логируем событие в консоль ---
    db.add(database.ConsoleLog(log_type="SYS", message=f"New user registered: {username}"))
    db.commit()

    # --- 6. Создаем сессию и перенаправляем в чат ---
    response = RedirectResponse(url="/chat", status_code=status.HTTP_303_SEE_OTHER)
    set_session_cookie(response, new_user.id)  # Устанавливаем cookie с токеном
    return response


@app.post("/login")
async def login(
    request: Request,
    email: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
):
    """
    Обработчик входа пользователя.
    """
    email = email.strip().lower()
    
    # --- 1. Ищем пользователя по email ---
    user = db.query(database.User).filter(database.User.email == email).first()

    # --- 2. Проверяем пароль ---
    if not user or not auth_utils.verify_password(password, user.password_hash):
        return RedirectResponse(
            url="/?error=wrong_credentials",
            status_code=status.HTTP_303_SEE_OTHER
        )

    # --- 3. Если пароль устарел (использует старый алгоритм хэширования) - обновляем ---
    if auth_utils.needs_rehash(user.password_hash):
        user.password_hash = auth_utils.hash_password(password)
        db.commit()

    # --- 4. Логируем вход ---
    ip = get_client_ip(request)
    db.add(database.ConsoleLog(log_type="LOG", message=f"User {user.username} login from IP {ip}"))
    db.commit()

    # --- 5. Создаем сессию и перенаправляем в чат ---
    response = RedirectResponse(url="/chat", status_code=status.HTTP_303_SEE_OTHER)
    set_session_cookie(response, user.id)
    return response


@app.post("/logout")
async def logout():
    """
    Обработчик выхода из системы.
    Удаляет сессионную cookie.
    """
    response = RedirectResponse(url="/", status_code=status.HTTP_303_SEE_OTHER)
    response.delete_cookie(SESSION_COOKIE)  # Удаляем cookie
    return response


# ============================
# 7. МАРШРУТЫ СТРАНИЦ
# ============================

@app.get("/chat", response_class=HTMLResponse)
async def chat_page(
    request: Request,
    with_user: Optional[int] = None,  # ID пользователя, с которым открыть чат
    db: Session = Depends(get_db),
):
    """
    Страница чата. Доступна только авторизованным пользователям.
    """
    # Проверяем авторизацию
    current_user = require_user(request, db)
    if not current_user:
        return RedirectResponse(url="/", status_code=status.HTTP_303_SEE_OTHER)

    # Строим контекст для шаблона
    return templates.TemplateResponse(
        request=request,
        name="chat.html",
        context=build_app_context(current_user, db, with_user=with_user, active_nav="chat"),
    )


@app.get("/profile", response_class=HTMLResponse)
async def profile_page(request: Request, db: Session = Depends(get_db)):
    """
    Страница профиля пользователя. Доступна только авторизованным.
    """
    current_user = require_user(request, db)
    if not current_user:
        return RedirectResponse(url="/", status_code=status.HTTP_303_SEE_OTHER)

    ctx = build_app_context(current_user, db, active_nav="profile")
    ctx["show_back"] = True  # Показываем кнопку "Назад"
    return templates.TemplateResponse(request=request, name="profile.html", context=ctx)


@app.get("/events", response_class=HTMLResponse)
async def events_page(request: Request, db: Session = Depends(get_db)):
    """
    Страница событий (логов). Доступна только авторизованным.
    """
    current_user = require_user(request, db)
    if not current_user:
        return RedirectResponse(url="/", status_code=status.HTTP_303_SEE_OTHER)

    # Получаем последние 50 логов
    logs = database.get_recent_logs(db, limit=50)
    
    ctx = build_app_context(current_user, db, active_nav="events")
    ctx["events"] = [
        {
            "log_type": log.log_type,
            "message": log.message,
            "time": log.timestamp.strftime("%d.%m.%Y %H:%M") if log.timestamp else "",
        }
        for log in logs
    ]
    return templates.TemplateResponse(request=request, name="events.html", context=ctx)


# ============================
# 8. МОДЕЛИ ДЛЯ API-ЗАПРОСОВ
# ============================

class SendMessageRequest(BaseModel):
    """Модель для отправки сообщения через API"""
    receiver_id: int
    text: str = Field(..., min_length=1, max_length=2000)  # Текст от 1 до 2000 символов


class ProfileSettingRequest(BaseModel):
    """Модель для обновления настроек профиля"""
    field: str  # Название поля (privacy_hide_status или push_notifications)
    value: bool  # Новое значение


# ============================
# 9. API-МАРШРУТЫ
# ============================

@app.post("/api/messages")
async def send_message(
    request: Request,
    payload: SendMessageRequest,  # Данные из тела запроса в формате JSON
    db: Session = Depends(get_db),
):
    """
    API-эндпоинт для отправки сообщения.
    Принимает JSON: {"receiver_id": 123, "text": "Привет!"}
    Возвращает созданное сообщение.
    """
    # Проверяем авторизацию
    current_user = require_user(request, db)
    if not current_user:
        return JSONResponse({"error": "unauthorized"}, status_code=401)

    # Очищаем текст
    text = payload.text.strip()
    if not text:
        return JSONResponse({"error": "empty_message"}, status_code=400)

    # Проверяем, существует ли получатель
    receiver = db.query(database.User).filter(database.User.id == payload.receiver_id).first()
    if not receiver or receiver.id == current_user.id:
        return JSONResponse({"error": "invalid_receiver"}, status_code=400)

    # --- Создаем сообщение ---
    message = database.Message(
        sender_id=current_user.id,
        receiver_id=receiver.id,
        text=text
    )
    db.add(message)
    
    # Логируем отправку
    db.add(database.ConsoleLog(
        log_type="LOG",
        message=f"{current_user.username} → {receiver.username}: {text[:40]}",  # Обрезаем длинные сообщения
    ))
    db.commit()
    db.refresh(message)

    # Возвращаем созданное сообщение
    return {
        "id": message.id,
        "text": message.text,
        "is_outgoing": True,
        "time": message.timestamp.strftime("%H:%M") if message.timestamp else "",
    }


@app.delete("/api/conversations/{partner_id}")
async def delete_conversation(
    request: Request,
    partner_id: int,
    db: Session = Depends(get_db),
):
    """
    API-эндпоинт для удаления всей переписки с пользователем.
    """
    # Проверяем авторизацию
    current_user = require_user(request, db)
    if not current_user:
        return JSONResponse({"error": "unauthorized"}, status_code=401)

    # Проверяем существование собеседника
    partner = db.query(database.User).filter(database.User.id == partner_id).first()
    if not partner or partner.id == current_user.id:
        return JSONResponse({"error": "invalid_partner"}, status_code=400)

    # Удаляем переписку
    count = database.delete_conversation(db, current_user.id, partner.id)
    
    # Логируем удаление
    db.add(database.ConsoleLog(
        log_type="SYS",
        message=f"{current_user.username} deleted chat with {partner.username} ({count} messages)",
    ))
    db.commit()

    return {"deleted": count}  # Возвращаем количество удаленных сообщений


@app.post("/api/profile/settings")
async def update_profile_settings(
    request: Request,
    payload: ProfileSettingRequest,
    db: Session = Depends(get_db),
):
    """
    API-эндпоинт для обновления настроек профиля.
    """
    current_user = require_user(request, db)
    if not current_user:
        return JSONResponse({"error": "unauthorized"}, status_code=401)

    # Разрешенные поля для обновления
    allowed = {"privacy_hide_status", "push_notifications"}
    
    if payload.field not in allowed:
        return JSONResponse({"error": "invalid_field"}, status_code=400)

    # Обновляем поле
    setattr(current_user, payload.field, payload.value)

    # Логируем изменение
    label = "privacy" if payload.field == "privacy_hide_status" else "push notifications"
    db.add(database.ConsoleLog(
        log_type="SYS",
        message=f"{current_user.username} updated {label}: {'on' if payload.value else 'off'}",
    ))
    db.commit()

    return {"ok": True, "field": payload.field, "value": payload.value}


@app.get("/api/logs")
async def get_logs(request: Request, db: Session = Depends(get_db)):
    """
    API-эндпоинт для получения логов консоли.
    """
    if not require_user(request, db):
        return JSONResponse({"error": "unauthorized"}, status_code=401)

    return [
        {"log_type": log.log_type, "message": log.message}
        for log in database.get_recent_logs(db)
    ]


# ============================
# 10. ЗАПУСК ПРИЛОЖЕНИЯ
# ============================

if __name__ == "__main__":
    """
    Запуск приложения через Uvicorn (ASGI-сервер).
    При запуске: python main.py
    """
    import uvicorn
    uvicorn.run(
        "main:app",  # Имя файла:переменная_приложения
        host="127.0.0.1",  # Локальный хост
        port=8000,  # Порт 8000
        reload=True  # Автоматически перезагружать при изменениях кода
    )
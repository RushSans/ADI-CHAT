# ============================
# МОДУЛЬ DATABASE.PY
# Отвечает за работу с базой данных SQLite
# ============================

from datetime import datetime  # Для работы с датой и временем

# Импортируем компоненты SQLAlchemy для создания моделей и работы с БД
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, create_engine, or_
from sqlalchemy.orm import declarative_base, sessionmaker

# ============================
# 1. НАСТРОЙКА ПОДКЛЮЧЕНИЯ К БД
# ============================

# URL для подключения к SQLite базе данных
# Файл БД будет называться "adi_chat.db" и храниться в корневой папке проекта
DATABASE_URL = "sqlite:///./adi_chat.db"

# Создаем движок SQLAlchemy для работы с БД
# connect_args={"check_same_thread": False} - необходимо для SQLite, 
# чтобы позволить использовать одно соединение из разных потоков (нужно для FastAPI)
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

# Создаем фабрику сессий для работы с БД
# autocommit=False - отключаем автоматический коммит (управляем вручную)
# autoflush=False - отключаем автоматическую синхронизацию
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Базовый класс для всех моделей (таблиц) в БД
Base = declarative_base()


# ============================
# 2. МОДЕЛИ БАЗЫ ДАННЫХ (ТАБЛИЦЫ)
# ============================

class User(Base):
    """
    Модель пользователя.
    Таблица: users
    
    Хранит информацию о зарегистрированных пользователях.
    """
    __tablename__ = "users"  # Имя таблицы в БД

    # ID пользователя (первичный ключ, автоинкремент)
    id = Column(Integer, primary_key=True, index=True)
    
    # Имя пользователя (уникальное, индексированное для быстрого поиска)
    username = Column(String, unique=True, index=True)
    
    # Email (уникальный, индексированный)
    email = Column(String, unique=True, index=True)
    
    # Хэш пароля (не сам пароль в целях безопасности!)
    password_hash = Column(String)
    
    # Статус пользователя (например: "В сети", "Отошел", "Не беспокоить")
    status = Column(String, default="В сети")
    
    # Цвет аватарки (в формате HEX, например: "#2ecc71")
    avatar_color = Column(String, default="#2ecc71")
    
    # Настройки приватности:
    # Скрывать ли статус от других пользователей
    privacy_hide_status = Column(Boolean, default=False)
    
    # Включены ли push-уведомления
    push_notifications = Column(Boolean, default=True)


class Message(Base):
    """
    Модель сообщения.
    Таблица: messages
    
    Хранит все сообщения между пользователями.
    """
    __tablename__ = "messages"

    # ID сообщения (первичный ключ)
    id = Column(Integer, primary_key=True, index=True)
    
    # ID отправителя (внешний ключ к таблице users)
    sender_id = Column(Integer, ForeignKey("users.id"), index=True)
    
    # ID получателя (внешний ключ к таблице users)
    receiver_id = Column(Integer, ForeignKey("users.id"), index=True)
    
    # Текст сообщения
    text = Column(String)
    
    # Время отправки сообщения (автоматически устанавливается текущее время UTC)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)


class ConsoleLog(Base):
    """
    Модель логов консоли.
    Таблица: console_logs
    
    Хранит системные события и логи для отображения на странице "События".
    """
    __tablename__ = "console_logs"

    # ID записи (первичный ключ)
    id = Column(Integer, primary_key=True, index=True)
    
    # Тип лога: "LOG" - обычное событие, "SYS" - системное событие
    log_type = Column(String)
    
    # Текст сообщения
    message = Column(String)
    
    # Время создания записи (автоматически)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)


# ============================
# 3. ФУНКЦИИ ДЛЯ РАБОТЫ С БД
# ============================

def init_db():
    """
    Инициализация базы данных.
    Создает все таблицы, если они не существуют.
    Затем выполняет миграцию (добавление новых колонок в существующую таблицу).
    """
    # Создаем все таблицы, описанные в моделях
    Base.metadata.create_all(bind=engine)
    
    # Выполняем миграцию (добавляем новые колонки, если их нет)
    _migrate_user_columns()


def _migrate_user_columns():
    """
    Внутренняя функция для миграции БД.
    Добавляет новые колонки в таблицу users без удаления существующих данных.
    
    Это важно, чтобы при обновлении приложения не потерять данные пользователей!
    """
    # Открываем соединение с БД
    with engine.connect() as conn:
        # Получаем список всех колонок в таблице users
        # PRAGMA table_info(users) - команда SQLite для получения структуры таблицы
        columns = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(users)").fetchall()}
        
        # Если колонки privacy_hide_status нет - добавляем её
        # BOOLEAN в SQLite хранится как INTEGER (0 = False, 1 = True)
        if "privacy_hide_status" not in columns:
            conn.exec_driver_sql("ALTER TABLE users ADD COLUMN privacy_hide_status BOOLEAN DEFAULT 0")
        
        # Если колонки push_notifications нет - добавляем её
        if "push_notifications" not in columns:
            conn.exec_driver_sql("ALTER TABLE users ADD COLUMN push_notifications BOOLEAN DEFAULT 1")
        
        # Подтверждаем изменения
        conn.commit()


def get_conversation(db, user_a_id: int, user_b_id: int):
    """
    Получает всю переписку между двумя пользователями.
    
    Аргументы:
        db: сессия БД
        user_a_id: ID первого пользователя
        user_b_id: ID второго пользователя
    
    Возвращает:
        Список сообщений, отсортированных по времени (от старых к новым)
    """
    return (
        db.query(Message)
        .filter(
            or_(
                # Сообщения, где user_a - отправитель, user_b - получатель
                (Message.sender_id == user_a_id) & (Message.receiver_id == user_b_id),
                # Сообщения, где user_b - отправитель, user_a - получатель
                (Message.sender_id == user_b_id) & (Message.receiver_id == user_a_id),
            )
        )
        .order_by(Message.timestamp.asc())  # Сортируем по возрастанию времени (старые → новые)
        .all()  # Выполняем запрос и получаем все результаты
    )


def delete_conversation(db, user_a_id: int, user_b_id: int) -> int:
    """
    Удаляет всю переписку между двумя пользователями.
    
    Аргументы:
        db: сессия БД
        user_a_id: ID первого пользователя
        user_b_id: ID второго пользователя
    
    Возвращает:
        Количество удаленных сообщений
    """
    deleted = (
        db.query(Message)
        .filter(
            or_(
                (Message.sender_id == user_a_id) & (Message.receiver_id == user_b_id),
                (Message.sender_id == user_b_id) & (Message.receiver_id == user_a_id),
            )
        )
        .delete(synchronize_session=False)  # Удаляем без синхронизации сессии
    )
    return deleted


def get_contacts(db, current_user_id: int):
    """
    Получает список всех пользователей, кроме текущего.
    Используется для отображения контактов в боковой панели чата.
    
    Аргументы:
        db: сессия БД
        current_user_id: ID текущего авторизованного пользователя
    
    Возвращает:
        Список всех пользователей (исключая текущего), отсортированных по имени
    """
    return (
        db.query(User)
        .filter(User.id != current_user_id)  # Исключаем текущего пользователя
        .order_by(User.username)  # Сортируем по имени
        .all()
    )


def get_recent_logs(db, limit: int = 20):
    """
    Получает последние записи из логов консоли.
    
    Аргументы:
        db: сессия БД
        limit: максимальное количество записей (по умолчанию 20)
    
    Возвращает:
        Список последних логов, отсортированных от новых к старым
    """
    return (
        db.query(ConsoleLog)
        .order_by(ConsoleLog.timestamp.desc())  # Сортируем по убыванию времени (новые → старые)
        .limit(limit)  # Ограничиваем количество
        .all()
    )


# ============================
# 4. СХЕМА БАЗЫ ДАННЫХ (Структура)
# ============================

"""
ПРИМЕР СТРУКТУРЫ БАЗЫ ДАННЫХ:

1. Таблица users:
   - id (INTEGER, PRIMARY KEY)
   - username (TEXT, UNIQUE)
   - email (TEXT, UNIQUE)
   - password_hash (TEXT)
   - status (TEXT, DEFAULT 'В сети')
   - avatar_color (TEXT, DEFAULT '#2ecc71')
   - privacy_hide_status (INTEGER, DEFAULT 0)
   - push_notifications (INTEGER, DEFAULT 1)

2. Таблица messages:
   - id (INTEGER, PRIMARY KEY)
   - sender_id (INTEGER, FOREIGN KEY → users.id)
   - receiver_id (INTEGER, FOREIGN KEY → users.id)
   - text (TEXT)
   - timestamp (DATETIME, DEFAULT CURRENT_TIMESTAMP)

3. Таблица console_logs:
   - id (INTEGER, PRIMARY KEY)
   - log_type (TEXT)  - 'LOG' или 'SYS'
   - message (TEXT)
   - timestamp (DATETIME, DEFAULT CURRENT_TIMESTAMP)


ПРИМЕРЫ ЗАПРОСОВ:

1. Получить все сообщения пользователя с ID=1 и ID=2:
   SELECT * FROM messages 
   WHERE (sender_id=1 AND receiver_id=2) OR (sender_id=2 AND receiver_id=1)
   ORDER BY timestamp ASC;

2. Получить всех пользователей, кроме текущего:
   SELECT * FROM users WHERE id != 1 ORDER BY username;

3. Получить последние 10 логов:
   SELECT * FROM console_logs ORDER BY timestamp DESC LIMIT 10;

4. Добавить нового пользователя:
   INSERT INTO users (username, email, password_hash) 
   VALUES ('John', 'john@mail.com', 'hash123');

5. Удалить переписку между пользователями 1 и 2:
   DELETE FROM messages 
   WHERE (sender_id=1 AND receiver_id=2) OR (sender_id=2 AND receiver_id=1);
"""

# ============================
# 5. ПРИМЕР ИСПОЛЬЗОВАНИЯ МОДУЛЯ
# ============================

"""
# Создание сессии для работы с БД
db = SessionLocal()

# Получить пользователя по email
user = db.query(User).filter(User.email == "denis@adi.chat").first()

# Создать новое сообщение
message = Message(sender_id=1, receiver_id=2, text="Привет!")
db.add(message)
db.commit()

# Получить все сообщения между пользователями 1 и 2
messages = get_conversation(db, 1, 2)

# Получить список контактов для пользователя 1
contacts = get_contacts(db, 1)

# Получить последние 10 логов
logs = get_recent_logs(db, 10)

# Закрыть сессию
db.close()
"""
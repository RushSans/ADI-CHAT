import sqlite3
from datetime import datetime
from fastapi import FastAPI, Form, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"])

conn = sqlite3.connect("chat.db", check_same_thread=False)
conn.execute("CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY, name TEXT, msg TEXT, time TEXT)")
conn.commit()

active_users = {}

class Manager:
    def __init__(self):
        self.connections = []

    async def connect(self, ws):
        await ws.accept()
        self.connections.append(ws)

    def disconnect(self, ws):
        if ws in self.connections:
            self.connections.remove(ws)

    async def broadcast(self, msg):
        for c in self.connections:
            try:
                await c.send_text(msg)
            except:
                pass

manager = Manager()

HTML = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>ЧАТ</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial; background: #1a1a2e; height: 100vh; display: flex; justify-content: center; align-items: center; }
        .chat { width: 800px; max-width: 95%; height: 90vh; background: white; border-radius: 20px; display: flex; flex-direction: column; overflow: hidden; }
        .header { background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 20px; text-align: center; font-size: 24px; }
        .online { padding: 10px 20px; background: #f0f0f0; border-bottom: 1px solid #ddd; font-size: 14px; }
        .messages { flex: 1; overflow-y: auto; padding: 20px; background: #fafafa; display: flex; flex-direction: column; }
        .msg { margin: 5px 0; padding: 10px 15px; border-radius: 15px; max-width: 70%; word-wrap: break-word; }
        .my { background: linear-gradient(135deg, #667eea, #764ba2); color: white; align-self: flex-end; }
        .other { background: white; border: 1px solid #ddd; align-self: flex-start; }
        .name { font-size: 12px; font-weight: bold; margin-bottom: 5px; }
        .time { font-size: 10px; color: #999; margin-top: 5px; text-align: right; }
        .system { text-align: center; margin: 10px 0; }
        .system span { background: #e0e0e0; padding: 5px 15px; border-radius: 20px; font-size: 12px; display: inline-block; }
        .input-area { padding: 20px; background: white; border-top: 1px solid #ddd; display: flex; gap: 10px; }
        .input-area input { flex: 1; padding: 12px; border: 1px solid #ddd; border-radius: 25px; outline: none; }
        .input-area button { padding: 12px 25px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; border-radius: 25px; cursor: pointer; }
        .login { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(135deg, #667eea, #764ba2); display: flex; justify-content: center; align-items: center; z-index: 1000; }
        .login-box { background: white; padding: 40px; border-radius: 20px; text-align: center; min-width: 300px; }
        .login-box input { width: 100%; padding: 12px; margin: 20px 0; border: 2px solid #ddd; border-radius: 25px; font-size: 16px; }
        .login-box button { width: 100%; padding: 12px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; border-radius: 25px; cursor: pointer; font-size: 16px; }
        .emoji-panel { position: fixed; bottom: 100px; right: 20px; background: white; border-radius: 15px; padding: 10px; display: none; grid-template-columns: repeat(6, 1fr); gap: 5px; box-shadow: 0 0 10px rgba(0,0,0,0.2); z-index: 100; }
        .emoji-panel span { font-size: 24px; cursor: pointer; padding: 5px; text-align: center; }
        .emoji-panel span:hover { background: #f0f0f0; border-radius: 5px; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .msg { animation: fadeIn 0.2s ease; }
    </style>
</head>
<body>
<div id="loginDiv" class="login">
    <div class="login-box">
        <h1>💬 ADI CHAT</h1>
        <input type="text" id="username" placeholder="Твой ник" autocomplete="off">
        <button onclick="login()">Войти</button>
    </div>
</div>

<div id="chatDiv" style="display:none;" class="chat">
    <div class="header">💬 ADI CHAT</div>
    <div class="online">🟢 Онлайн: <span id="onlineCount">0</span></div>
    <div class="messages" id="messages"></div>
    <div class="input-area">
        <button onclick="toggleEmoji()" style="padding:12px 15px;">😊</button>
        <input type="text" id="message" placeholder="Сообщение..." autocomplete="off" onkeypress="if(event.key=='Enter') send()">
        <button onclick="send()">Отправить</button>
    </div>
</div>
<div id="emojiPanel" class="emoji-panel"></div>

<script>
    let user = '';
    let ws = null;
    let lastMsgId = 0;
    let isLoading = false;
    
    function login() {
        let name = document.getElementById('username').value.trim();
        if (!name) { alert('Введи имя'); return; }
        user = name;
        document.getElementById('loginDiv').style.display = 'none';
        document.getElementById('chatDiv').style.display = 'flex';
        connect();
        loadMsgs();
        setInterval(loadMsgs, 2000);
        document.getElementById('message').focus();
    }
    
    function connect() {
        ws = new WebSocket(`ws://${window.location.host}/ws?name=${encodeURIComponent(user)}`);
        ws.onmessage = (e) => {
            let data = e.data;
            if (data.startsWith('USERS:')) {
                let users = data.substring(6).split(',');
                let onlineCount = users.filter(u => u && u.length > 0).length;
                document.getElementById('onlineCount').innerText = onlineCount;
            } else if (data === 'RELOAD') {
                loadMsgs();
            }
        };
        ws.onclose = () => setTimeout(connect, 2000);
    }
    
    async function send() {
        let msg = document.getElementById('message').value.trim();
        if (!msg) return;
        
        let btn = document.querySelector('.input-area button:last-child');
        btn.disabled = true;
        btn.style.opacity = '0.5';
        
        await fetch('/send', {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: `name=${encodeURIComponent(user)}&msg=${encodeURIComponent(msg)}`
        });
        
        document.getElementById('message').value = '';
        btn.disabled = false;
        btn.style.opacity = '1';
        loadMsgs();
        document.getElementById('message').focus();
    }
    
    async function loadMsgs() {
        if (isLoading) return;
        isLoading = true;
        
        try {
            let res = await fetch('/msgs');
            let msgs = await res.json();
            
            let container = document.getElementById('messages');
            let wasBottom = container.scrollHeight - container.scrollTop < 150;
            
            // Получаем текущие ID сообщений (по тексту + времени)
            let currentMsgKeys = new Set();
            for (let i = 0; i < container.children.length; i++) {
                let child = container.children[i];
                let key = child.getAttribute('data-key');
                if (key) currentMsgKeys.add(key);
            }
            
            // Добавляем только новые сообщения
            for (let m of msgs) {
                let key = `${m.name}_${m.msg}_${m.time}`;
                if (!currentMsgKeys.has(key)) {
                    let div = document.createElement('div');
                    if (m.name === 'Система') {
                        div.className = 'system';
                        div.setAttribute('data-key', key);
                        div.innerHTML = `<span>📢 ${escapeHtml(m.msg)}</span>`;
                    } else {
                        let isMy = m.name === user;
                        div.className = `msg ${isMy ? 'my' : 'other'}`;
                        div.setAttribute('data-key', key);
                        div.innerHTML = `<div class="name">${escapeHtml(m.name)}</div>
                                        <div>${escapeHtml(m.msg)}</div>
                                        <div class="time">${m.time}</div>`;
                    }
                    container.appendChild(div);
                }
            }
            
            // Удаляем лишние если их больше 100
            while (container.children.length > 100) {
                container.removeChild(container.firstChild);
            }
            
            if (wasBottom) {
                container.scrollTop = container.scrollHeight;
            }
        } catch(e) {
            console.error(e);
        }
        
        isLoading = false;
    }
    
    function toggleEmoji() {
        let panel = document.getElementById('emojiPanel');
        panel.style.display = panel.style.display === 'grid' ? 'none' : 'grid';
    }
    
    function addEmoji(e) {
        document.getElementById('message').value += e;
        document.getElementById('message').focus();
        document.getElementById('emojiPanel').style.display = 'none';
    }
    
    function escapeHtml(s) {
        if (!s) return '';
        return s.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
    }
    
    const emojis = ['😀','😂','🥰','😎','🔥','❤️','👍','🎉','👋','😍','🥺','✨','⭐','🌈','🍕','🚀','👑','🐱','🐶','💀','🎵','💎'];
    document.getElementById('emojiPanel').innerHTML = emojis.map(e => `<span onclick="addEmoji('${e}')">${e}</span>`).join('');
    
    document.addEventListener('click', (e) => {
        if (!e.target.closest('button') && !e.target.closest('#emojiPanel')) {
            document.getElementById('emojiPanel').style.display = 'none';
        }
    });
</script>
</body>
</html>
"""

@app.get("/", response_class=HTMLResponse)
def index():
    return HTML

@app.post("/send")
def send(name: str = Form(), msg: str = Form()):
    time = datetime.now().strftime("%H:%M:%S")
    conn.execute("INSERT INTO messages (name, msg, time) VALUES (?, ?, ?)", (name[:20], msg[:500], time))
    conn.commit()
    return {"ok": True}

@app.get("/msgs")
def get_msgs():
    cur = conn.execute("SELECT name, msg, time FROM messages ORDER BY id DESC LIMIT 100")
    rows = cur.fetchall()
    msgs = []
    for row in reversed(rows):
        msgs.append({"name": row[0], "msg": row[1], "time": row[2]})
    return msgs

@app.websocket("/ws")
async def ws(websocket: WebSocket):
    from urllib.parse import parse_qs
    qs = websocket.scope.get("query_string", b"").decode()
    params = parse_qs(qs)
    name = params.get("name", ["Аноним"])[0]
    
    await manager.connect(websocket)
    active_users[name] = websocket
    
    conn.execute("INSERT INTO messages (name, msg, time) VALUES (?, ?, ?)", ("Система", f"{name} вошел в чат", datetime.now().strftime("%H:%M:%S")))
    conn.commit()
    
    await manager.broadcast(f"USERS:{','.join(active_users.keys())}")
    await manager.broadcast("RELOAD")
    
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        if name in active_users:
            del active_users[name]
        conn.execute("INSERT INTO messages (name, msg, time) VALUES (?, ?, ?)", ("Система", f"{name} вышел из чата", datetime.now().strftime("%H:%M:%S")))
        conn.commit()
        await manager.broadcast(f"USERS:{','.join(active_users.keys())}")
        await manager.broadcast("RELOAD")

if __name__ == "__main__":
    print("\n" + "="*50)
    print("ADI CHAT")
    print("http://localhost:8000")
    print("="*50 + "\n")
    uvicorn.run(app, host="127.0.0.1", port=8000)
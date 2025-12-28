const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const fs = require('fs');

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const DB_FILE = path.join(__dirname, 'users.json');
const GAMES_FILE = path.join(__dirname, 'games.json');

// --- ROBLOX-STYLE ULTIMATE FILTER (ВСЕ МАТЫ) ---
// --- ROBLOX-STYLE ULTIMATE FILTER (ПОЛНОСТЬЮ ИСПРАВЛЕННЫЙ) ---

const filterRules = {
    links: /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]+\.(com|ru|net|org|io|gov|edu|me|biz|info|ua|kz|by|xyz|online|top|shop|fun|site|store|dev|app))|(\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b)/gi,
    
    // Ультимативный список корней (включая со скриншотов)
    bad_roots: /(хуй|хуе|хуи|хуя|пизд|ебан|ебат|ебну|ебл|уеб|сучк|сук[аиоя]|бля|гвн|говн|падл|тварь|залуп|манд|дроч|шлюх|даун|ублюд|мудак|гондон|гандон|курв|лох|пидор|пидар|педик|педич|мраз|скoт|чмo|fuck|shit|bitch|cunt|dick|pussy|faggot|bastard|slut|whore|nigger|niga|nigga|сос[иау]|хер|голу|пед|трах|шкур|мда|своло)/gi,
    
    bypass: /[\s._\-/\\*!@#%^&()+=<>?]/g
};

function filterContent(text) {
    if (!text) return '';
    
    const originalText = text.trim();
    // Использовать только ОДНО название переменной для нижнего регистра
    const checkText = originalText.toLowerCase();

    // 1. Блокировка ссылок
    if (filterRules.links.test(checkText)) {
        return "#".repeat(originalText.length);
    }

    // 2. Проверка на "склеенный" мат (убираем символы)
    let cleanText = checkText.replace(filterRules.bypass, '')
                             .replace(/a/g, 'а').replace(/e/g, 'е').replace(/p/g, 'р')
                             .replace(/x/g, 'х').replace(/o/g, 'о').replace(/c/g, 'с')
                             .replace(/0/g, 'о').replace(/u/g, 'у').replace(/y/g, 'у');

    if (filterRules.bad_roots.test(cleanText)) {
        return "#".repeat(originalText.length > 2 ? originalText.length : 5);
    }

    // 3. Пословная проверка (теперь без ошибки ReferenceError)
    const words = checkText.split(/\s+/);
    for (let word of words) {
        let cleanWord = word.replace(/[.,!?]/g, '');
        if (filterRules.bad_roots.test(cleanWord)) {
            return "#".repeat(originalText.length);
        }
    }

    return originalText;
}

// --- DATABASE LOAD ---
let users = {};
if (fs.existsSync(DB_FILE)) {
    try { users = JSON.parse(fs.readFileSync(DB_FILE)); } 
    catch (e) { console.error("DB Load Error", e); }
}

let games = {};
if (fs.existsSync(GAMES_FILE)) {
    try { 
        games = JSON.parse(fs.readFileSync(GAMES_FILE)); 
        Object.keys(games).forEach(id => {
            games[id].players = {};
        });
    }
    catch (e) { console.error("Games Load Error", e); }
}

function saveDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2));
}

// --- ЛОГИКА ЗАРАБОТКА (ROYALTY) ---
setInterval(() => {
    let earned = false;
    Object.values(games).forEach(game => {
        const playerCount = Object.keys(game.players || {}).length;
        if (playerCount > 0 && users[game.author]) {
            const reward = playerCount * 10;
            users[game.author].balance += reward;
            earned = true;
        }
    });
    if (earned) saveDB();
}, 300000); 

function saveGames() {
    try {
        const dataToSave = {};
        Object.keys(games).forEach(id => {
            const { players, ...gameData } = games[id];
            dataToSave[id] = gameData;
        });
        fs.writeFileSync(GAMES_FILE, JSON.stringify(dataToSave, null, 2));
    } catch (err) {
        console.error("Server: Error saving games:", err);
    }
}

const hash = (str) => str.split('').reduce((a, b) => (((a << 5) - a) + b.charCodeAt(0)) | 0, 0);

// --- API ---
app.post('/api/register', (req, res) => {
    let { username, password, color } = req.body;
    
    // ПРОВЕРКА ИМЕНИ НА МАТ/ССЫЛКИ
    const cleanName = filterContent(username);
    if (cleanName.includes('###')) {
        return res.json({ success: false, error: "Username contains forbidden words or links" });
    }

    if (users[username]) return res.json({ success: false, error: "Username taken" });

    const nextId = Object.keys(users).length + 1;
    users[username] = {
        id: nextId,
        username,
        password: hash(password),
        color: color || '#6c5ce7',
        balance: 100, 
        inventory: ['default'], 
        equipped: { hat: 'none', face: 'face_smile', item: 'none' },
        createdAt: Date.now()
    };
    saveDB();
    res.json({ success: true, user: users[username] });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = users[username];
    if (!user || user.password !== hash(password)) {
        return res.json({ success: false, error: "Invalid username or password" });
    }
    res.json({ success: true, user });
});

app.post('/api/save_game_data', (req, res) => {
    const { gameId, map, username, name, status } = req.body;
    
    if (games[gameId]) {
        if (games[gameId].author !== username) return res.status(403).json({ success: false });
        if (map) games[gameId].map = map;
        if (name) games[gameId].name = filterContent(name); // Фильтруем название игры
        if (status) games[gameId].status = status;
    } else {
        games[gameId] = {
            id: gameId,
            author: username,
            name: filterContent(name) || "New Game",
            status: 'private',
            visits: 0,
            map: [
                { id: 'bp1', type: 'baseplate', x: 0, y: 500, w: 1000, h: 50, color: '#34495e', name: 'Baseplate' },
                { id: 'sp1', type: 'spawn', x: 100, y: 440, w: 60, h: 60, color: '#f1c40f', name: 'SpawnLocation' }
            ]
        };
    }
    
    saveGames();
    res.json({ success: true, game: games[gameId] });
});

app.get('/api/load_studio/:gameId', (req, res) => {
    const game = games[req.params.gameId];
    if (game) { res.json(game); } else { res.status(404).json({ error: "Game not found" }); }
});

app.post('/api/profile', async (req, res) => {
    const { username } = req.body;
    const user = users[username]; 
    if (user) {
        const { password, ...userWithoutPassword } = user;
        res.json({ success: true, user: userWithoutPassword });
    } else {
        res.status(404).json({ success: false, error: "User not found" });
    }
});

app.post('/api/get_user_by_id', (req, res) => {
    const { id } = req.body;
    const user = Object.values(users).find(u => u.id == id);
    if (user) {
        const { password, ...userWithoutPassword } = user;
        res.json({ success: true, user: userWithoutPassword });
    } else {
        res.status(404).json({ success: false, error: "Profile ID not found" });
    }
});

app.post('/api/buy', (req, res) => {
    const { username, itemId, price } = req.body;
    const user = users[username];
    if (!user) return res.json({ success: false, error: "User not found" });
    if (user.balance < price) return res.json({ success: false, error: "Not enough Vubs!" });
    if (user.inventory.includes(itemId)) return res.json({ success: false, error: "Already owned" });
    user.balance -= price;
    user.inventory.push(itemId);
    saveDB(); 
    res.json({ success: true, user });
});

app.post('/api/equip', (req, res) => {
    const { username, type, itemId } = req.body; 
    const user = users[username];
    if (!user) return res.json({ success: false, error: "User not found" });
    if (itemId !== 'none' && !user.inventory.includes(itemId)) return res.json({ success: false, error: "Item not owned" });
    if (type === 'hat') user.equipped.hat = itemId;
    if (type === 'face') user.equipped.face = itemId;
    saveDB();
    res.json({ success: true, user });
});

// --- SOCKET LOGIC ---
io.on('connection', (socket) => {
    
    socket.on('request_games', () => {
        const list = Object.values(games).map(g => ({
            id: g.id, 
            name: g.name, 
            author: g.author,
            visits: g.visits || 0, 
            online: g.players ? Object.keys(g.players).length : 0
        }));
        socket.emit('update_dashboard', list);
    });

    socket.on('join_game', ({ gameId, username }) => {
        const user = users[username];
        if (!user || !games[gameId]) return;

        const game = games[gameId];
        if (!game.players) game.players = {};

        game.visits++;
        socket.join(gameId);
        socket.gameId = gameId;
        socket.username = username;

        game.players[socket.id] = {
            id: socket.id,
            username: user.username,
            color: user.color,
            x: 100, y: 600,
            hat: user.equipped.hat,
            face: user.equipped.face,
            item: user.equipped.item,
            dead: false
        };

        socket.emit('init_game', { map: game.map, players: game.players });
        socket.to(gameId).emit('player_spawn', game.players[socket.id]);
    });

    socket.on('player_input', (data) => {
        const game = games[socket.gameId];
        if (game && game.players[socket.id]) {
            Object.assign(game.players[socket.id], data);
            socket.to(socket.gameId).emit('player_update', { id: socket.id, ...data });
        }
    });

    socket.on('disconnect', () => {
        if (socket.gameId && games[socket.gameId] && games[socket.gameId].players) {
            delete games[socket.gameId].players[socket.id];
            io.to(socket.gameId).emit('player_leave', socket.id);
        }
    });
    
    // --- ОБРАБОТКА ЧАТА С ФИЛЬТРОМ ---
socket.on('send_msg', (text) => {
    if (!socket.gameId || !socket.username) return;

    // Ограничиваем длину и прогоняем через фильтр
    const filteredText = filterContent(text.substring(0, 150));

    io.to(socket.gameId).emit('new_msg', {
        user: socket.username,
        text: filteredText
    });
});


    socket.on('player_die', () => {
        if (socket.gameId) io.to(socket.gameId).emit('player_died_anim', socket.id);
    });

    socket.on('player_respawn', () => {
        const game = games[socket.gameId];
        if (game && game.players[socket.id]) {
            const spawn = (game.map || []).find(p => p.type === 'spawn') || { x: 100, y: 400 };
            const p = game.players[socket.id];
            p.dead = false;
            p.x = spawn.x;
            p.y = spawn.y - 60;
            io.to(socket.gameId).emit('player_respawned', { id: socket.id, x: p.x, y: p.y });
        }
    });
});

http.listen(3000, () => console.log('>> Server Running on Port 3000 (English)'));
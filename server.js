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

// --- ROBLOX-STYLE ULTIMATE FILTER ---
const filterRules = {
    links: /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]+\.(com|ru|net|org|io|gov|edu|me|biz|info|ua|kz|by|xyz|online|top|shop|fun|site|store|dev|app))|(\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b)/gi,
    bad_roots: /(хуй|хуе|хуи|хуя|пизд|ебан|ебат|ебну|ебл|уеб|сучк|сук[аиоя]|бля|гвн|говн|падл|тварь|залуп|манд|дроч|шлюх|даун|ублюд|мудак|гондон|гандон|курв|лох|пидор|пидар|педик|педич|мраз|скoт|чмo|fuck|shit|bitch|cunt|dick|pussy|faggot|bastard|slut|whore|nigger|niga|nigga|сос[иау]|хер|голу|пед|трах|шкур|мда|своло)/gi,
    bypass: /[\s._\-/\\*!@#%^&()+=<>?]/g
};

function filterContent(text) {
    if (!text) return '';
    const originalText = text.trim();
    const checkText = originalText.toLowerCase();
    if (filterRules.links.test(checkText)) return "#".repeat(originalText.length);
    let cleanText = checkText.replace(filterRules.bypass, '')
                             .replace(/a/g, 'а').replace(/e/g, 'е').replace(/p/g, 'р')
                             .replace(/x/g, 'х').replace(/o/g, 'о').replace(/c/g, 'с')
                             .replace(/0/g, 'о').replace(/u/g, 'у').replace(/y/g, 'у');
    if (filterRules.bad_roots.test(cleanText)) return "#".repeat(originalText.length > 2 ? originalText.length : 5);
    const words = checkText.split(/\s+/);
    for (let word of words) {
        let cleanWord = word.replace(/[.,!?]/g, '');
        if (filterRules.bad_roots.test(cleanWord)) return "#".repeat(originalText.length);
    }
    return originalText;
}

// --- DATABASE & MIGRATION ---
let users = {};
let games = {};

function saveDB() { fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2)); }
function saveGames() {
    const toSave = {};
    Object.keys(games).forEach(id => {
        const { players, ...rest } = games[id];
        toSave[id] = rest;
    });
    fs.writeFileSync(GAMES_FILE, JSON.stringify(toSave, null, 2));
}

// Загрузка и миграция данных
if (fs.existsSync(DB_FILE)) {
    try { 
        users = JSON.parse(fs.readFileSync(DB_FILE)); 
        // Исправление старых аккаунтов
        Object.keys(users).forEach(username => {
            const u = users[username];
            if (!u.equipped) u.equipped = { hat: 'none', face: 'face_smile', shirt: 'none_shirt', pants: 'none_pants' };
            if (u.equipped.shirt === undefined) u.equipped.shirt = 'none_shirt';
            if (u.equipped.pants === undefined) u.equipped.pants = 'none_pants';
            if (u.equipped.item) delete u.equipped.item; // Чистим старое поле если есть
            if (!u.inventory.includes('face_smile')) u.inventory.push('face_smile');
        });
        saveDB();
    } catch (e) { console.error(e); }
}

if (fs.existsSync(GAMES_FILE)) {
    try { 
        games = JSON.parse(fs.readFileSync(GAMES_FILE)); 
        Object.keys(games).forEach(id => games[id].players = {}); 
    } catch (e) { console.error(e); }
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
}, 300000); // Раз в 5 минут

const hash = (str) => str.split('').reduce((a, b) => (((a << 5) - a) + b.charCodeAt(0)) | 0, 0);

// ТОТ САМЫЙ ФИКС 404
app.post('/api/save_game_data', (req, res) => {
    const { gameId, map, username, name } = req.body;
    if (!gameId) return res.status(400).json({ success: false });

    if (games[gameId]) {
        if (games[gameId].author !== username) return res.status(403).json({ success: false });
        if (map) games[gameId].map = map;
        if (name) games[gameId].name = filterContent(name);
    } else {
        games[gameId] = {
            id: gameId, author: username,
            name: filterContent(name) || "New Game",
            visits: 0, map: map || []
        };
    }
    saveGames();
    res.json({ success: true });
});



app.get('/api/load_studio/:gameId', (req, res) => {
    const game = games[req.params.gameId];
    if (game) res.json(game);
    else res.status(404).json({ error: "Game not found" });
});

app.post('/api/register', (req, res) => {
    let { username, password, color } = req.body;
    if (filterContent(username).includes('#')) return res.json({ success: false, error: "Bad Name" });
    if (users[username]) return res.json({ success: false, error: "Taken" });

    users[username] = {
        id: Object.keys(users).length + 1,
        username, password: hash(password),
        color: color || '#6c5ce7',
        balance: 100,
        inventory: ['face_smile'],
        equipped: { hat: 'none', face: 'face_smile', shirt: 'none_shirt', pants: 'none_pants' },
        createdAt: Date.now()
    };
    saveDB();
    res.json({ success: true, user: users[username] });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'Today_Idk') return res.json({ success: false, error: "redirect_old" });
    const user = users[username];
    if (!user || user.password !== hash(password)) return res.json({ success: false, error: "Wrong login" });
    res.json({ success: true, user });
});

app.post('/api/buy', (req, res) => {
    const { username, itemId, price } = req.body;
    const u = users[username];
    if (u && u.balance >= price && !u.inventory.includes(itemId)) {
        u.balance -= price;
        u.inventory.push(itemId);
        saveDB();
        return res.json({ success: true, user: u });
    }
    res.json({ success: false, error: "Cannot buy" });
});

app.post('/api/equip', (req, res) => {
    const { username, type, itemId } = req.body;
    const u = users[username];
    if (u && (itemId === 'none' || u.inventory.includes(itemId) || itemId.startsWith('none_'))) {
        u.equipped[type] = itemId;
        saveDB();
        res.json({ success: true, user: u });
    }
});

app.post('/api/profile', (req, res) => {
    const u = users[req.body.username];
    if (u) {
        const { password, ...safeUser } = u;
        res.json({ success: true, user: safeUser });
    }
});

// --- SOCKETS ---
io.on('connection', (socket) => {
    // Обновление списка игр для Dashboard
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
        socket.join(gameId);
        socket.gameId = gameId;
        socket.username = username;

        if (!game.players) game.players = {};
        game.visits = (game.visits || 0) + 1;

        game.players[socket.id] = {
            id: socket.id,
            username: user.username,
            color: user.color,
            x: 100, y: 400,
            hat: user.equipped.hat || 'none',
            face: user.equipped.face || 'face_smile',
            shirt: user.equipped.shirt || 'none_shirt',
            pants: user.equipped.pants || 'none_pants'
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

    socket.on('send_msg', (text) => {
        if (!socket.gameId) return;
        const filtered = filterContent(text.substring(0, 150));
        io.to(socket.gameId).emit('new_msg', { user: socket.username, text: filtered });
    });

    socket.on('disconnect', () => {
        if (socket.gameId && games[socket.gameId].players) {
            delete games[socket.gameId].players[socket.id];
            io.to(socket.gameId).emit('player_leave', socket.id);
        }
    });
});

http.listen(3000, () => console.log('Server running on http://localhost:3000'));


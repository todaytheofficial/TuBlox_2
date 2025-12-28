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
        // Initialize players object for each loaded game
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
// Каждые 5 минут начисляем создателю по 10 Vubs за каждого игрока онлайн
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
}, 300000); // 300,000 ms = 5 минут

function saveGames() {
    try {
        // We don't save the active 'players' object to the JSON file
        const dataToSave = {};
        Object.keys(games).forEach(id => {
            const { players, ...gameData } = games[id];
            dataToSave[id] = gameData;
        });
        fs.writeFileSync(GAMES_FILE, JSON.stringify(dataToSave, null, 2));
        console.log("Server: Games data saved to games.json");
    } catch (err) {
        console.error("Server: Error saving games:", err);
    }
}

const hash = (str) => str.split('').reduce((a, b) => (((a << 5) - a) + b.charCodeAt(0)) | 0, 0);

// --- API ---
app.post('/api/register', (req, res) => {
    const { username, password, color } = req.body;
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

// На сервере в блоке API
app.post('/api/save_game_data', (req, res) => {
    const { gameId, map, username, name, status } = req.body;
    
    // Если игра уже существует
    if (games[gameId]) {
        if (games[gameId].author !== username) return res.status(403).json({ success: false });
        
        // Если прилетел новый массив карты - сохраняем его
        if (map) games[gameId].map = map;
        if (name) games[gameId].name = name;
        if (status) games[gameId].status = status;
    } else {
        // Если это создание новой игры
        games[gameId] = {
            id: gameId,
            author: username,
            name: name || "New Game",
            status: 'private',
            visits: 0,
            // СТАНДАРТНЫЙ НАБОР ОБЪЕКТОВ, ЧТОБЫ НЕ БЫЛО ПУСТО
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
    if (game) {
        res.json(game);
    } else {
        res.status(404).json({ error: "Game not found" });
    }
});

app.post('/api/profile', async (req, res) => {
    const { username } = req.body;
    
    // ПРАВИЛЬНЫЙ ПОИСК: обращаемся напрямую по ключу к объекту users
    const user = users[username]; 
    
    if (user) {
        // На всякий случай не отправляем пароль на фронтенд
        const { password, ...userWithoutPassword } = user;
        res.json({ success: true, user: userWithoutPassword });
    } else {
        res.status(404).json({ success: false, error: "User not found" });
    }
});

app.post('/api/get_user_by_id', (req, res) => {
    const { id } = req.body;
    
    // Ищем пользователя по его ID внутри объекта
    const user = Object.values(users).find(u => u.id == id);
    
    if (user) {
        const { password, ...userWithoutPassword } = user;
        res.json({ success: true, user: userWithoutPassword });
    } else {
        res.status(404).json({ success: false, error: "Profile ID not found" });
    }
});

// --- КУПИТЬ ПРЕДМЕТ ---
app.post('/api/buy', (req, res) => {
    const { username, itemId, price } = req.body;
    const user = users[username];

    if (!user) return res.json({ success: false, error: "User not found" });
    if (user.balance < price) return res.json({ success: false, error: "Not enough Vubs!" });
    if (user.inventory.includes(itemId)) return res.json({ success: false, error: "Already owned" });

    // Снимаем деньги и добавляем в инвентарь
    user.balance -= price;
    user.inventory.push(itemId);
    
    saveDB(); // Сохраняем изменения в users.json
    res.json({ success: true, user });
});

// --- НАДЕТЬ ПРЕДМЕТ ---
app.post('/api/equip', (req, res) => {
    const { username, type, itemId } = req.body; // type: 'hat' или 'face'
    const user = users[username];

    if (!user) return res.json({ success: false, error: "User not found" });
    
    // Проверка, есть ли предмет в инвентаре (кроме 'none')
    if (itemId !== 'none' && !user.inventory.includes(itemId)) {
        return res.json({ success: false, error: "Item not owned" });
    }

    // Обновляем экипировку
    if (type === 'hat') user.equipped.hat = itemId;
    if (type === 'face') user.equipped.face = itemId;

    saveDB();
    res.json({ success: true, user });
});

app.post('/api/buy_pass', (req, res) => {
    const { username, gameId } = req.body;
    const buyer = users[username];
    const game = games[gameId];

    if (!buyer || !game) return res.json({ success: false, error: "Data error" });
    if (buyer.balance < game.vubsPassPrice) return res.json({ success: false, error: "Not enough Vubs" });
    if (buyer.inventory.includes('pass_' + gameId)) return res.json({ success: false, error: "Already owned" });

    buyer.balance -= game.vubsPassPrice;
    buyer.inventory.push('pass_' + gameId);

    const creatorProfit = Math.floor(game.vubsPassPrice * 0.7);
    if (users[game.author]) {
        users[game.author].balance += creatorProfit;
    }

    saveDB();
    res.json({ success: true, newBalance: buyer.balance });
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

    socket.on('get_game_details', (gameId) => {
        const game = games[gameId];
        if (game) {
            socket.emit('game_details', {
                id: game.id,
                name: game.name,
                author: game.author,
                desc: game.desc || "No description",
                visits: game.visits || 0,
                online: game.players ? Object.keys(game.players).length : 0,
                vubsPassPrice: game.vubsPassPrice || 0
            });
        }
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
    
    // Обработка чата
    socket.on('send_msg', (text) => {
        if (!socket.gameId || !socket.username) return;
        // Ограничим длину сообщения
        const msg = text.substring(0, 100);
        io.to(socket.gameId).emit('new_msg', {
            user: socket.username,
            text: msg
        });
    });

    // Обработка смерти (для анимации у других)
    socket.on('player_die', () => {
        if (socket.gameId) {
            io.to(socket.gameId).emit('player_died_anim', socket.id);
        }
    });

    // Обработка респауна
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
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const fs = require('fs');

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const DB_FILE = path.join(__dirname, 'users.json');

// --- DATABASE ---
let users = {};
if (fs.existsSync(DB_FILE)) {
    try { users = JSON.parse(fs.readFileSync(DB_FILE)); } 
    catch (e) { console.error("DB Load Error", e); }
}

function saveDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2));
}

const hash = (str) => str.split('').reduce((a, b) => (((a << 5) - a) + b.charCodeAt(0)) | 0, 0);

let games = {
    "game1": {
        id: "game1",
        name: "Purple Parkour",
        author: "TuBlox_Dev",
        desc: "Jump over blocks, don't fall into the void. Classic Map.",
        visits: 1540,
        players: {}
    }
};

// --- API ---
app.post('/api/register', (req, res) => {
    const { username, password, color } = req.body;
    if (users[username]) return res.json({ success: false, error: "Username taken" });

    const nextId = Object.keys(users).length + 1;
    
    users[username] = {
        id: nextId,
        username,
        password: hash(password),
        color: color || '#5d00ff',
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

app.post('/api/profile', (req, res) => {
    const { username } = req.body;
    if(users[username]) res.json({ success: true, user: users[username] });
    else res.json({ success: false });
});

app.post('/api/buy', (req, res) => {
    const { username, itemId, price } = req.body;
    const user = users[username];
    if (!user) return res.json({ success: false });
    if (user.inventory.includes(itemId)) return res.json({ success: false, error: "Already owned" });
    if (user.balance < price) return res.json({ success: false, error: "Not enough TuCoins" });

    user.balance -= price;
    user.inventory.push(itemId);
    saveDB();
    res.json({ success: true, user });
});

app.post('/api/equip', (req, res) => {
    const { username, type, itemId } = req.body;
    const user = users[username];
    if (!user) return res.json({ success: false });
    
    // Check ownership
    if (itemId !== 'none' && !user.inventory.includes(itemId) && itemId !== 'face_smile') {
        return res.json({ success: false, error: "Item not found in inventory" });
    }

    user.equipped[type] = itemId;
    saveDB();
    res.json({ success: true, user });
});

app.post('/api/get_user_by_id', (req, res) => {
    const { id } = req.body; // Получаем ID (например "1")
    
    // Ищем юзера в базе (превращаем объект users в массив values и ищем)
    const user = Object.values(users).find(u => u.id == id);
    
    if (user) {
        // Возвращаем ТОЛЬКО безопасные данные (без пароля)
        res.json({
            success: true,
            user: {
                username: user.username,
                id: user.id, // localId
                color: user.color,
                balance: user.balance,
                inventory: user.inventory,
                equipped: user.equipped,
                createdAt: user.createdAt
            }
        });
    } else {
        res.json({ success: false, error: "User not found" });
    }
});

// --- GAME SOCKET ---
io.on('connection', (socket) => {
    
    // Game Details for Dashboard
    socket.on('get_game_details', (gameId) => {
        const game = games[gameId];
        if (game) {
            socket.emit('game_details', {
                id: game.id,
                name: game.name,
                author: game.author,
                desc: game.desc,
                visits: game.visits,
                online: Object.keys(game.players).length
            });
        }
    });

    socket.on('join_game', ({ gameId, username }) => {
        const user = users[username];
        if (!user) return;

        if (!games[gameId]) games[gameId] = { id: gameId, name: "New", players: {}, visits: 0 };
        const game = games[gameId];

        // Anti-Duplicate
        for (let sid in game.players) {
            if (game.players[sid].username === username) {
                io.to(sid).emit('force_disconnect', 'Logged in from another device');
                io.sockets.sockets.get(sid)?.disconnect();
                delete game.players[sid];
            }
        }

        game.visits++;
        socket.join(gameId);
        socket.gameId = gameId;
        socket.username = username;

        game.players[socket.id] = {
            id: socket.id,
            username: user.username,
            localId: user.id,
            color: user.color,
            x: 100, y: 600,
            direction: 1,
            isMoving: false,
            dead: false, // NEW: Death state
            // Skin
            hat: user.equipped.hat,
            face: user.equipped.face,
            item: user.equipped.item
        };

        socket.emit('init_game', game.players);
        socket.to(gameId).emit('player_spawn', game.players[socket.id]);
    });

    socket.on('player_input', (data) => {
        const game = games[socket.gameId];
        if (game && game.players[socket.id]) {
            Object.assign(game.players[socket.id], data);
            socket.to(socket.gameId).emit('player_update', { id: socket.id, ...data });
        }
    });

    // NEW: Handle Death Event
    socket.on('player_die', () => {
        const game = games[socket.gameId];
        if (game && game.players[socket.id]) {
            game.players[socket.id].dead = true;
            // Broadcast death to everyone so they see animation
            io.to(socket.gameId).emit('player_died_anim', socket.id);
        }
    });

    // NEW: Handle Respawn
    socket.on('player_respawn', () => {
        const game = games[socket.gameId];
        if (game && game.players[socket.id]) {
            const p = game.players[socket.id];
            p.dead = false;
            p.x = 100; // Respawn X
            p.y = 600; // Respawn Y
            p.dy = 0;
            io.to(socket.gameId).emit('player_respawned', { id: socket.id, x: p.x, y: p.y });
        }
    });

    socket.on('send_message', (text) => {
        const game = games[socket.gameId];
        if(game && game.players[socket.id]) {
            const p = game.players[socket.id];
            io.to(socket.gameId).emit('chat_message', {
                username: p.username,
                text,
                color: p.color
            });
        }
    });

    socket.on('disconnect', () => {
        if (socket.gameId && games[socket.gameId]) {
            delete games[socket.gameId].players[socket.id];
            io.to(socket.gameId).emit('player_leave', socket.id);
        }
    });

    socket.on('request_games', () => {
        const list = Object.values(games).map(g => ({
            id: g.id, name: g.name, author: g.author,
            visits: g.visits, online: Object.keys(g.players).length
        }));
        socket.emit('update_dashboard', list);
    });

    
});

http.listen(3000, () => console.log('>> Server Running (English)'));
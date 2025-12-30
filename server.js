require('dotenv').config(); // ЗАГРУЗКА .ENV
const express = require('express');
const mysql = require('mysql2/promise');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// --- НАСТРОЙКА ПОДКЛЮЧЕНИЯ (УНИВЕРСАЛЬНАЯ) ---
const dbConfig = process.env.DATABASE_URL || {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'TuBloxDB',
    port: process.env.DB_PORT || 3306,
    ssl: (process.env.DB_HOST && process.env.DB_HOST !== 'localhost') ? { rejectUnauthorized: false } : false
};

// Используем Пул соединений вместо одного подключения
const pool = mysql.createPool(dbConfig);
const db = pool; // mysql2/promise пул работает напрямую через .execute()

async function initDB() {
    try {
        console.log("--- 🔄 Initializing Database... ---");
        
        // Создание таблиц (с использованием LONGTEXT для карт)
        await db.execute(`CREATE TABLE IF NOT EXISTS users (
            username VARCHAR(255) PRIMARY KEY, id INT UNIQUE, password VARCHAR(255), 
            color VARCHAR(7), balance INT DEFAULT 100, inventory TEXT, 
            equipped TEXT, createdAt BIGINT
        )`);
        
        await db.execute(`CREATE TABLE IF NOT EXISTS games (
            id VARCHAR(255) PRIMARY KEY, author VARCHAR(255), 
            name VARCHAR(255), visits INT DEFAULT 0, map LONGTEXT
        )`);

        console.log("--- 📦 Tables Ready ---");

        // Создание/Обновление админа
        const adminInventory = ["face_smile","hat_beanie","hat_cap_back","hat_headband","hat_headphones","hat_cone","hat_flower","hat_toilet","hat_egg","hat_tophat","hat_cowboy","hat_astronaut","hat_halo","hat_devil","hat_crystal","hat_crown","face_meh","face_angry","face_shades","face_money","face_mask_med","face_clown","face_cyborg","face_cyclops","face_glitch","face_void","face_vampire","shirt_black","shirt_tux","shirt_hoodie","shirt_gold","shirt_armor","shirt_supreme","pants_jeans","pants_camo","pants_robot","pants_adidas","hat_seraphim","face_godmode","shirt_nebula","pants_stellar"];
        const adminEquipped = { shirt: "shirt_nebula", pants: "pants_stellar", face: "face_godmode", hat: "hat_seraphim" };

        await db.execute(`
            INSERT INTO users (username, id, password, color, balance, inventory, equipped, createdAt) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE inventory = VALUES(inventory), equipped = VALUES(equipped), balance = VALUES(balance)
        `, ['Today_AIDK', 1, -2114507156, '#6c5ce7', 99573049, JSON.stringify(adminInventory), JSON.stringify(adminEquipped), 1767008582578]);

        await db.execute("UPDATE games SET name = 'Unnamed Game' WHERE name IS NULL OR name = '' OR name = ' '");
        await db.execute("UPDATE games SET map = '[]' WHERE map IS NULL");

        console.log("--- ✅ Database Ready! ---");
    } catch (err) {
        console.error("❌ CRITICAL ERROR: DB Initialization failed!", err);
        process.exit(1);
    }
}

initDB();

// --- ФИЛЬТР ЧАТА ---
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
    let cleanText = checkText.replace(filterRules.bypass, '').replace(/a/g, 'а').replace(/e/g, 'е').replace(/p/g, 'р').replace(/x/g, 'х').replace(/o/g, 'о').replace(/c/g, 'с').replace(/0/g, 'о').replace(/u/g, 'у').replace(/y/g, 'у');
    if (filterRules.bad_roots.test(cleanText)) return "#".repeat(originalText.length > 2 ? originalText.length : 5);
    return originalText;
}

let gamesOnline = {}; 

// Начисление денег авторам
setInterval(async () => {
    for (const gameId in gamesOnline) {
        const game = gamesOnline[gameId];
        const playerCount = Object.keys(game.players || {}).length;
        if (playerCount > 0) {
            const reward = playerCount * 10;
            try {
                await db.execute(`UPDATE users SET balance = balance + ? WHERE username = ?`, [reward, game.author]);
            } catch (e) { console.error("Reward error:", e); }
        }
    }
}, 300000);

const hash = (str) => str.split('').reduce((a, b) => (((a << 5) - a) + b.charCodeAt(0)) | 0, 0);

// --- API ---

app.post('/api/save_game_data', async (req, res) => {
    try {
        const { gameId, map, username, name } = req.body;
        if (!gameId) return res.status(400).json({ success: false });

        let rawName = name ? name.trim() : "";
        let filteredName = filterContent(rawName);
        if (!filteredName || filteredName.replace(/#/g, '') === "") filteredName = "New Game";

        const [existing] = await db.execute('SELECT author, name FROM games WHERE id = ?', [gameId]);
        
        const mapJson = JSON.stringify(map || []);

        if (existing.length > 0) {
            if (existing[0].author !== username) return res.status(403).json({ success: false });
            const nameToSave = (rawName === "") ? existing[0].name : filteredName;
            await db.execute('UPDATE games SET map = ?, name = ? WHERE id = ?', [mapJson, nameToSave, gameId]);
        } else {
            await db.execute('INSERT INTO games (id, author, name, visits, map) VALUES (?, ?, ?, ?, ?)', 
                [gameId, username, filteredName, 0, mapJson]);
        }
        res.json({ success: true });
    } catch (err) {
        console.error("Save Error:", err);
        res.status(500).json({ success: false });
    }
});

app.post('/api/profile', async (req, res) => {
    try {
        const { username } = req.body;
        if (!username) return res.status(400).json({ success: false, error: "No username" });

        const [rows] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
        const user = rows[0];

        if (user) {
            const { password, ...safeUser } = user;
            safeUser.inventory = typeof safeUser.inventory === 'string' ? JSON.parse(safeUser.inventory) : safeUser.inventory;
            safeUser.equipped = typeof safeUser.equipped === 'string' ? JSON.parse(safeUser.equipped) : safeUser.equipped;
            res.json({ success: true, user: safeUser });
        } else {
            res.status(404).json({ success: false, error: "User not found" });
        }
    } catch (error) {
        console.error("Profile API Error:", error);
        res.status(500).json({ success: false, error: "Server error" });
    }
});

app.get('/api/load_studio/:gameId', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM games WHERE id = ?', [req.params.gameId]);
        if (rows.length > 0) {
            rows[0].map = JSON.parse(rows[0].map);
            res.json(rows[0]);
        } else res.status(404).json({ error: "Game not found" });
    } catch (e) { res.status(500).send(e.message); }
});

app.post('/api/register', async (req, res) => {
    try {
        let { username, password, color } = req.body;
        if (filterContent(username).includes('#')) return res.json({ success: false, error: "Bad Name" });

        const [exists] = await db.execute('SELECT username FROM users WHERE username = ?', [username]);
        if (exists.length > 0) return res.json({ success: false, error: "Taken" });

        const newUser = {
            username,
            password: hash(password),
            color: color || '#6c5ce7',
            balance: 100,
            inventory: JSON.stringify(['face_smile']),
            equipped: JSON.stringify({ hat: 'none', face: 'face_smile', shirt: 'none_shirt', pants: 'none_pants' }),
            createdAt: Date.now()
        };

        await db.execute(`INSERT INTO users (username, password, color, balance, inventory, equipped, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [newUser.username, newUser.password, newUser.color, newUser.balance, newUser.inventory, newUser.equipped, newUser.createdAt]);
        
        res.json({ success: true, user: newUser });
    } catch (e) { res.status(500).json({success: false}); }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const [rows] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
        const user = rows[0];

        if (!user || user.password !== hash(password)) return res.json({ success: false, error: "Wrong login" });
        
        user.inventory = JSON.parse(user.inventory);
        user.equipped = JSON.parse(user.equipped);
        res.json({ success: true, user });
    } catch (e) { res.status(500).json({success: false}); }
});

app.post('/api/buy', async (req, res) => {
    try {
        const { username, itemId, price } = req.body;
        const [rows] = await db.execute('SELECT balance, inventory FROM users WHERE username = ?', [username]);
        if (rows.length === 0) return res.json({ success: false });

        let { balance, inventory } = rows[0];
        inventory = JSON.parse(inventory);

        if (balance >= price && !inventory.includes(itemId)) {
            inventory.push(itemId);
            await db.execute('UPDATE users SET balance = balance - ?, inventory = ? WHERE username = ?', [price, JSON.stringify(inventory), username]);
            const [updated] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
            updated[0].inventory = JSON.parse(updated[0].inventory);
            updated[0].equipped = JSON.parse(updated[0].equipped);
            return res.json({ success: true, user: updated[0] });
        }
        res.json({ success: false, error: "Cannot buy" });
    } catch (e) { res.status(500).json({success: false}); }
});

app.post('/api/equip', async (req, res) => {
    try {
        const { username, type, itemId } = req.body;
        const [rows] = await db.execute('SELECT inventory, equipped FROM users WHERE username = ?', [username]);
        if (rows.length === 0) return res.json({ success: false });

        let inventory = JSON.parse(rows[0].inventory);
        let equipped = JSON.parse(rows[0].equipped);

        if (itemId === 'none' || inventory.includes(itemId) || itemId.startsWith('none_')) {
            equipped[type] = itemId;
            await db.execute('UPDATE users SET equipped = ? WHERE username = ?', [JSON.stringify(equipped), username]);
            res.json({ success: true });
        }
    } catch (e) { res.status(500).json({success: false}); }
});

// --- SOCKETS ---
io.on('connection', (socket) => {
    socket.on('request_games', async () => {
        try {
            const [rows] = await db.execute('SELECT id, name, author, visits FROM games');
            const list = rows.map(g => ({
                ...g,
                online: gamesOnline[g.id] ? Object.keys(gamesOnline[g.id].players).length : 0
            }));
            socket.emit('update_dashboard', list);
        } catch(e) { console.error(e); }
    });

    socket.on('join_game', async ({ gameId, username }) => {
        try {
            const [uRows] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
            const [gRows] = await db.execute('SELECT * FROM games WHERE id = ?', [gameId]);
            
            if (uRows.length === 0 || gRows.length === 0) return;
            const user = uRows[0];
            const gameDB = gRows[0];
            user.equipped = JSON.parse(user.equipped);

            if (!gamesOnline[gameId]) {
                gamesOnline[gameId] = { ...gameDB, map: JSON.parse(gameDB.map), players: {} };
            }

            const game = gamesOnline[gameId];
            socket.join(gameId);
            socket.gameId = gameId;
            socket.username = username;

            await db.execute('UPDATE games SET visits = visits + 1 WHERE id = ?', [gameId]);

            game.players[socket.id] = {
                id: socket.id,
                username: user.username,
                color: user.color,
                x: 100, y: 400,
                hat: user.equipped.hat || 'none',
                face: user.equipped.face || 'face_smile',
                shirt: user.equipped.shirt || 'none_shirt',
                pants: user.equipped.pants || 'none_pants',
                dead: false,
                heldItemId: null,
                hp: 100,
                maxHp: 100
            };

            socket.emit('init_game', { map: game.map, players: game.players });
            socket.to(gameId).emit('player_spawn', game.players[socket.id]);
        } catch (e) { console.error(e); }
    });

    socket.on('player_input', (data) => {
        const game = gamesOnline[socket.gameId];
        if (game && game.players[socket.id] && !game.players[socket.id].dead) {
            Object.assign(game.players[socket.id], data);
            socket.to(socket.gameId).emit('player_update', { id: socket.id, ...data });
        }
    });

    socket.on('damage_player', (targetId) => {
        const game = gamesOnline[socket.gameId];
        if (!game || !game.players[socket.id] || !game.players[targetId]) return;
        if (game.players[socket.id].dead) return;

        game.players[targetId].hp -= 10;
        io.to(socket.gameId).emit('player_hp_update', { id: targetId, hp: game.players[targetId].hp });

        if (game.players[targetId].hp <= 0) {
            game.players[targetId].dead = true;
            io.to(socket.gameId).emit('player_died_anim', targetId);
        }
    });

    socket.on('player_respawn', () => {
        const game = gamesOnline[socket.gameId];
        if (game && game.players[socket.id]) {
            const spawn = game.map.find(p => p.type === 'spawn') || { x: 100, y: 500, w: 30 };
            const p = game.players[socket.id];
            p.x = spawn.x + (spawn.w / 2) - 15;
            p.y = spawn.y - 70;
            p.hp = 100;
            p.dead = false;
            io.to(socket.gameId).emit('player_hp_update', { id: socket.id, hp: 100 });
            io.to(socket.gameId).emit('player_respawned', { id: socket.id, x: p.x, y: p.y });
        }
    });

    socket.on('send_msg', (text) => {
        if (!socket.gameId) return;
        io.to(socket.gameId).emit('new_msg', { user: socket.username, text: filterContent(text.substring(0, 150)) });
    });

    socket.on('disconnect', () => {
        if (socket.gameId && gamesOnline[socket.gameId]) {
            delete gamesOnline[socket.gameId].players[socket.id];
            io.to(socket.gameId).emit('player_leave', socket.id);
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// --- 1. НАСТРОЙКА ПОДКЛЮЧЕНИЯ ---
const dbConfig = process.env.DATABASE_URL || {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'TuBloxDB',
    port: process.env.DB_PORT || 3306,
    ssl: (process.env.DB_HOST && process.env.DB_HOST !== 'localhost') ? { rejectUnauthorized: false } : false
};

const pool = mysql.createPool(dbConfig);
const db = pool; 

// --- 2. ИНИЦИАЛИЗАЦИЯ БАЗЫ ДАННЫХ ---
async function initDB() {
    try {
        console.log("--- 🔄 Initializing Database... ---");
        
        // 1. Создаем таблицы (Гарантируем AUTO_INCREMENT)
        await db.execute(`CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            color VARCHAR(7),
            balance INT DEFAULT 100,
            inventory LONGTEXT,
            equipped LONGTEXT,
            createdAt BIGINT
        )`);
        
        await db.execute(`CREATE TABLE IF NOT EXISTS games (
            id VARCHAR(255) PRIMARY KEY,
            author VARCHAR(255),
            name VARCHAR(255),
            visits INT DEFAULT 0,
            map LONGTEXT
        )`);

        await db.execute(`CREATE TABLE IF NOT EXISTS banned_ips (
            ip VARCHAR(255) PRIMARY KEY,
            reason VARCHAR(255)
        )`);

        // 2. ОБНОВЛЕНИЕ СТРУКТУРЫ (Добавляем колонки, если их нет)
        const addCol = async (table, def) => {
            try { await db.execute(`ALTER TABLE ${table} ADD COLUMN ${def}`); } 
            catch (e) { if(e.errno !== 1060) console.log(`Migration info: ${e.message}`); }
        };

        await addCol('users', 'is_admin BOOLEAN DEFAULT 0');
        await addCol('users', 'is_banned BOOLEAN DEFAULT 0');
        await addCol('games', 'is_blocked BOOLEAN DEFAULT 0');

        // 3. --- FIX IDS: ПЕРЕСЧИТЫВАЕМ ID ПОЛЬЗОВАТЕЛЕЙ ---
        // Это сделает Today_AIDK номером 1, а остальных по порядку
        console.log("--- 🔧 Fixing User IDs... ---");
        try {
            // Включаем переменную счетчика
            await db.execute("SET @count = 0");
            // Обновляем ID: Сначала Today_AIDK, потом остальные по дате создания
            await db.execute(`
                UPDATE users 
                SET id = (@count:= @count + 1) 
                ORDER BY (username = 'Today_AIDK') DESC, createdAt ASC
            `);
            // Сбрасываем авто-инкремент на следующее число
            const [rows] = await db.execute("SELECT MAX(id) as maxId FROM users");
            const nextId = (rows[0].maxId || 0) + 1;
            await db.execute(`ALTER TABLE users AUTO_INCREMENT = ${nextId}`);
            console.log("--- ✅ IDs Fixed! Today_AIDK is #1 ---");
        } catch (e) {
            console.error("Warning fixing IDs (might be duplicate keys during swap):", e.message);
        }

        // 4. Создание/Обновление админа
        const adminInventory = ["face_smile","hat_beanie","hat_cap_back","hat_headband","hat_headphones","hat_cone","hat_flower","hat_toilet","hat_egg","hat_tophat","hat_cowboy","hat_astronaut","hat_halo","hat_devil","hat_crystal","hat_crown","face_meh","face_angry","face_shades","face_money","face_mask_med","face_clown","face_cyborg","face_cyclops","face_glitch","face_void","face_vampire","shirt_black","shirt_tux","shirt_hoodie","shirt_gold","shirt_armor","shirt_supreme","pants_jeans","pants_camo","pants_robot","pants_adidas","hat_seraphim","face_godmode","shirt_nebula","pants_stellar"];
        const adminEquipped = { shirt: "shirt_nebula", pants: "pants_stellar", face: "face_godmode", hat: "hat_seraphim" };

        await db.execute(`
            INSERT INTO users (username, password, color, balance, inventory, equipped, is_admin, createdAt) 
            VALUES (?, ?, ?, ?, ?, ?, 1, ?)
            ON DUPLICATE KEY UPDATE 
            inventory = VALUES(inventory), 
            equipped = VALUES(equipped), 
            balance = VALUES(balance),
            is_admin = 1
        `, ['Today_AIDK', -2114507156, '#6c5ce7', 99999999, JSON.stringify(adminInventory), JSON.stringify(adminEquipped), 1767008582578]);

        await db.execute("UPDATE games SET name = 'Unnamed Game' WHERE name IS NULL OR name = '' OR name = ' '");

        console.log("--- ✅ Database Ready! ---");
    } catch (err) {
        console.error("❌ CRITICAL ERROR: DB Initialization failed!", err);
        process.exit(1);
    }
}

initDB();

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
const filterRules = {
    links: /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]+\.(com|ru|net|org|io|gov|edu|me|biz|info|ua|kz|by|xyz|online|top|shop|fun|site|store|dev|app))/gi,
    bad_roots: /(хуй|пизд|ебан|ебат|сучк|сук[аиоя]|бля|говн|залуп|дроч|шлюх|даун|пидор|fuck|shit)/gi,
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

const hash = (str) => String(str).split('').reduce((a, b) => (((a << 5) - a) + b.charCodeAt(0)) | 0, 0);

async function isAdmin(username) {
    if(!username) return false;
    const [rows] = await db.execute('SELECT is_admin FROM users WHERE username = ?', [username]);
    return rows.length > 0 && rows[0].is_admin === 1;
}

// --- 4. API ЭНДПОИНТЫ ---

// === ADMIN API ===
app.post('/api/admin/get_data', async (req, res) => {
    try {
        const { adminName } = req.body;
        if (!await isAdmin(adminName)) return res.status(403).json({ error: "Access denied" });
        const [users] = await db.execute('SELECT id, username, balance, is_admin, is_banned FROM users');
        const [games] = await db.execute('SELECT id, name, author, is_blocked FROM games');
        const [bannedIps] = await db.execute('SELECT * FROM banned_ips');
        res.json({ success: true, users, games, bannedIps });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/give_vubs', async (req, res) => {
    try {
        const { adminName, targetUsername, amount } = req.body;
        if (!await isAdmin(adminName)) return res.status(403).json({ error: "Access denied" });
        await db.execute('UPDATE users SET balance = balance + ? WHERE username = ?', [Number(amount), targetUsername]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/toggle_ban', async (req, res) => {
    try {
        const { adminName, targetUsername, status } = req.body;
        if (!await isAdmin(adminName)) return res.status(403).json({ error: "Access denied" });
        await db.execute('UPDATE users SET is_banned = ? WHERE username = ?', [status, targetUsername]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/set_admin', async (req, res) => {
    try {
        const { adminName, targetUsername, status } = req.body;
        if (!await isAdmin(adminName)) return res.status(403).json({ error: "Access denied" });
        await db.execute('UPDATE users SET is_admin = ? WHERE username = ?', [status, targetUsername]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/ban_ip', async (req, res) => {
    try {
        const { adminName, ip } = req.body;
        if (!await isAdmin(adminName)) return res.status(403).json({ error: "Access denied" });
        await db.execute('INSERT IGNORE INTO banned_ips (ip, reason) VALUES (?, ?)', [ip, 'Banned by admin']);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/toggle_game_block', async (req, res) => {
    try {
        const { adminName, gameId, status } = req.body;
        if (!await isAdmin(adminName)) return res.status(403).json({ error: "Access denied" });
        await db.execute('UPDATE games SET is_blocked = ? WHERE id = ?', [status, gameId]);
        if (status && gamesOnline[gameId]) {
            delete gamesOnline[gameId];
            io.to(gameId).emit('new_msg', { user: 'SYSTEM', text: 'Game blocked by admin.' });
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// === GENERAL API ===
app.post('/api/save_game_data', async (req, res) => {
    try {
        const { gameId, map, username, name } = req.body;
        if (!gameId || !username) return res.status(400).json({ success: false });
        
        const [uRows] = await db.execute('SELECT is_banned FROM users WHERE username = ?', [username]);
        if (uRows.length > 0 && uRows[0].is_banned) return res.status(403).json({ success: false, error: "You are banned" });

        const [gRows] = await db.execute('SELECT is_blocked FROM games WHERE id = ?', [gameId]);
        if (gRows.length > 0 && gRows[0].is_blocked) return res.status(403).json({ success: false, error: "Game blocked" });

        const mapJson = JSON.stringify(map || []);
        const [existing] = await db.execute('SELECT name FROM games WHERE id = ?', [gameId]);
        let nameToSave = "New Game"; 
        if (name && name.trim().length > 0) {
            let filtered = filterContent(name.trim());
            if (filtered && filtered.replace(/#/g, '') !== "") nameToSave = filtered;
            else if (existing.length > 0) nameToSave = existing[0].name;
        } else if (existing.length > 0) nameToSave = existing[0].name;

        await db.execute(`
            INSERT INTO games (id, author, name, map, visits, is_blocked) 
            VALUES (?, ?, ?, ?, 0, 0) 
            ON DUPLICATE KEY UPDATE map = VALUES(map), name = VALUES(name)
        `, [gameId, username, nameToSave, mapJson]);

        if (gamesOnline[gameId]) {
            gamesOnline[gameId].map = map || [];
            gamesOnline[gameId].name = nameToSave;
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/profile', async (req, res) => {
    try {
        const { username } = req.body;
        const [rows] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length > 0) {
            const user = rows[0];
            user.inventory = JSON.parse(user.inventory || '[]');
            user.equipped = JSON.parse(user.equipped || '{}');
            delete user.password;
            res.json({ success: true, user });
        } else res.status(404).json({ success: false });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/get_user_by_id', async (req, res) => {
    try {
        const { id } = req.body;
        const [rows] = await db.execute('SELECT * FROM users WHERE id = ?', [id]);
        if (rows.length > 0) {
            const user = rows[0];
            user.inventory = JSON.parse(user.inventory || '[]');
            user.equipped = JSON.parse(user.equipped || '{}');
            delete user.password;
            res.json({ success: true, user });
        } else res.status(404).json({ success: false });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.get('/api/load_studio/:gameId', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM games WHERE id = ?', [req.params.gameId]);
        if (rows.length > 0) {
            if(rows[0].is_blocked) return res.status(403).json({ error: "Game blocked" });
            rows[0].map = JSON.parse(rows[0].map || '[]');
            res.json(rows[0]);
        } else res.status(404).json({ error: "Game not found" });
    } catch (e) { res.status(500).send(e.message); }
});

// РЕГИСТРАЦИЯ: ВАЖНО - возвращаем insertId
app.post('/api/register', async (req, res) => {
    try {
        let { username, password, color } = req.body;
        const ip = req.ip || req.connection.remoteAddress;
        const [bans] = await db.execute('SELECT * FROM banned_ips WHERE ip = ?', [ip]);
        if (bans.length > 0) return res.json({ success: false, error: "IP Banned" });

        if (!username || !password) return res.json({ success: false, error: "Empty" });
        if (filterContent(username).includes('#')) return res.json({ success: false, error: "Bad Name" });

        const [exists] = await db.execute('SELECT username FROM users WHERE username = ?', [username]);
        if (exists.length > 0) return res.json({ success: false, error: "Taken" });

        const inv = JSON.stringify(['face_smile']);
        const eq = JSON.stringify({ hat: 'none', face: 'face_smile', shirt: 'none_shirt', pants: 'none_pants' });

        const [result] = await db.execute(
            `INSERT INTO users (username, password, color, balance, inventory, equipped, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [username, hash(password), color || '#6c5ce7', 100, inv, eq, Date.now()]
        );

        // Возвращаем ID нового пользователя
        res.json({ success: true, user: { id: result.insertId, username, color, balance: 100, is_admin: 0 } });
    } catch (e) { console.error(e); res.status(500).json({success: false}); }
});

// ЛОГИН
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const [rows] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
        const user = rows[0];

        if (!user || user.password != hash(password)) return res.json({ success: false, error: "Wrong login" });
        if (user.is_banned) return res.json({ success: false, error: "Banned" });
        
        user.inventory = JSON.parse(user.inventory || '[]');
        user.equipped = JSON.parse(user.equipped || '{}');
        delete user.password;
        res.json({ success: true, user });
    } catch (e) { res.status(500).json({success: false}); }
});

app.post('/api/buy', async (req, res) => {
    try {
        const { username, itemId, price } = req.body;
        const [rows] = await db.execute('SELECT balance, inventory FROM users WHERE username = ?', [username]);
        if (rows.length === 0) return res.json({ success: false });

        let { balance, inventory } = rows[0];
        let invArray = JSON.parse(inventory || '[]');

        if (balance >= price && !invArray.includes(itemId)) {
            invArray.push(itemId);
            await db.execute('UPDATE users SET balance = balance - ?, inventory = ? WHERE username = ?', [price, JSON.stringify(invArray), username]);
            const [updated] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
            updated[0].inventory = JSON.parse(updated[0].inventory);
            updated[0].equipped = JSON.parse(updated[0].equipped);
            delete updated[0].password;
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

        let inventory = JSON.parse(rows[0].inventory || '[]');
        let equipped = JSON.parse(rows[0].equipped || '{}');

        if (itemId === 'none' || inventory.includes(itemId) || itemId.startsWith('none_')) {
            equipped[type] = itemId;
            await db.execute('UPDATE users SET equipped = ? WHERE username = ?', [JSON.stringify(equipped), username]);
            
            const [updatedRows] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
            const updatedUser = updatedRows[0];
            updatedUser.inventory = JSON.parse(updatedUser.inventory);
            updatedUser.equipped = JSON.parse(updatedUser.equipped);
            delete updatedUser.password;

            res.json({ success: true, user: updatedUser });
        } else { res.json({ success: false }); }
    } catch (e) { res.status(500).json({success: false}); }
});

let gamesOnline = {}; 

setInterval(async () => {
    for (const gameId in gamesOnline) {
        const game = gamesOnline[gameId];
        const playerCount = Object.keys(game.players || {}).length;
        if (playerCount > 0) {
            try { await db.execute(`UPDATE users SET balance = balance + ? WHERE username = ?`, [playerCount * 10, game.author]); } catch (e) {}
        }
    }
}, 300000);

io.on('connection', (socket) => {
    const clientIp = socket.handshake.address;

    socket.on('request_games', async () => {
        try {
            const [rows] = await db.execute('SELECT id, name, author, visits FROM games WHERE is_blocked = 0');
            const list = rows.map(g => ({ ...g, online: gamesOnline[g.id] ? Object.keys(gamesOnline[g.id].players).length : 0 }));
            socket.emit('update_dashboard', list);
        } catch(e) {}
    });

    socket.on('join_game', async ({ gameId, username }) => {
        try {
            const [bans] = await db.execute('SELECT * FROM banned_ips WHERE ip = ?', [clientIp]);
            if (bans.length > 0) { socket.emit('new_msg', { user: 'SYS', text: 'IP BANNED' }); socket.disconnect(); return; }

            const [uRows] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
            if (uRows.length === 0 || uRows[0].is_banned) { socket.emit('new_msg', { user: 'SYS', text: 'BANNED' }); socket.disconnect(); return; }

            const [gRows] = await db.execute('SELECT * FROM games WHERE id = ?', [gameId]);
            if (gRows.length === 0 || gRows[0].is_blocked) return;

            const user = uRows[0];
            const gameDB = gRows[0];
            const equipped = JSON.parse(user.equipped || '{}');

            if (!gamesOnline[gameId]) gamesOnline[gameId] = { ...gameDB, map: JSON.parse(gameDB.map || '[]'), players: {} };

            const game = gamesOnline[gameId];
            socket.join(gameId);
            socket.gameId = gameId;
            socket.username = username;
            socket.userIp = clientIp; 

            await db.execute('UPDATE games SET visits = visits + 1 WHERE id = ?', [gameId]);

            game.players[socket.id] = {
                id: socket.id,
                username: user.username,
                color: user.color,
                x: 100, y: 400,
                hat: equipped.hat || 'none', face: equipped.face || 'face_smile', shirt: equipped.shirt || 'none_shirt', pants: equipped.pants || 'none_pants',
                dead: false, hp: 100, maxHp: 100, ip: clientIp 
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
            p.x = spawn.x + (spawn.w / 2) - 15; p.y = spawn.y - 70; p.hp = 100; p.dead = false;
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
            if (Object.keys(gamesOnline[socket.gameId].players).length === 0) delete gamesOnline[socket.gameId];
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
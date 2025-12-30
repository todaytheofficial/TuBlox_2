const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mysql = require('mysql2');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- 1. НАСТРОЙКА ПОДКЛЮЧЕНИЯ (POOL) ---
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'TuBloxDB',
    port: process.env.DB_PORT || 3306,
    ssl: (process.env.DB_HOST && process.env.DB_HOST !== 'localhost') ? { rejectUnauthorized: false } : false,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// Создаем пул соединений (это решит проблему закрытого стейта)
const pool = mysql.createPool(dbConfig);
const db = pool.promise();

// --- 2. ИНИЦИАЛИЗАЦИЯ БАЗЫ ДАННЫХ ---
async function initDB() {
    try {
        console.log("--- 🔄 Initializing Database... ---");
        
        // Создаем таблицу пользователей
        await db.execute(`
            CREATE TABLE IF NOT EXISTS users (
                username VARCHAR(255) PRIMARY KEY,
                id INT UNIQUE,
                password VARCHAR(255),
                color VARCHAR(7),
                balance INT DEFAULT 100,
                inventory TEXT,
                equipped TEXT,
                createdAt BIGINT
            )
        `);

        // Создаем таблицу игр
        await db.execute(`
            CREATE TABLE IF NOT EXISTS games (
                id VARCHAR(255) PRIMARY KEY,
                author VARCHAR(255),
                name VARCHAR(255),
                visits INT DEFAULT 0,
                map LONGTEXT
            )
        `);

        console.log("--- ✅ Database & Tables Ready ---");
    } catch (err) {
        console.error("❌ CRITICAL ERROR: DB Initialization failed!", err);
        process.exit(1); // Остановить сервер при ошибке БД
    }
}

// --- 3. MIDDLEWARE И МАРШРУТЫ ---
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// API профиля (пример пофикшенного роута)
app.get('/api/profile/:username', async (req, res) => {
    try {
        const [rows] = await db.execute("SELECT * FROM users WHERE username = ?", [req.params.username]);
        if (rows.length > 0) {
            res.json(rows[0]);
        } else {
            res.status(404).json({ error: "User not found" });
        }
    } catch (err) {
        console.error("Profile API Error:", err);
        res.status(500).send("Server Error");
    }
});

// --- 4. SOCKET.IO ЛОГИКА ---
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Получение списка игр
    socket.on('get_games', async () => {
        try {
            const [rows] = await db.execute("SELECT id, name, author, visits FROM games");
            socket.emit('games_list', rows);
        } catch (err) {
            console.error("Error fetching games:", err);
        }
    });

    // СОХРАНЕНИЕ ИГРЫ (Исправлено)
    socket.on('save_game_data', async (data) => {
        try {
            // Используем REPLACE INTO или INSERT ... ON DUPLICATE KEY UPDATE
            await db.execute(`
                INSERT INTO games (id, author, name, map) 
                VALUES (?, ?, ?, ?) 
                ON DUPLICATE KEY UPDATE map = VALUES(map), name = VALUES(name)
            `, [data.id, data.author, data.name, data.map]);
            
            console.log(`✅ Game saved/updated: ${data.name} (ID: ${data.id})`);
            socket.emit('save_success');
        } catch (err) {
            console.error("❌ Save Game Error:", err);
            socket.emit('save_error', { message: "Failed to save game data" });
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// --- 5. ЗАПУСК ---
const PORT = process.env.PORT || 3000;
initDB().then(() => {
    server.listen(PORT, () => {
        console.log(`🚀 Server running at http://localhost:${PORT}`);
    });
});
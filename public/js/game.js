const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- НАСТРОЙКИ МИРА ---
const urlParams = new URLSearchParams(window.location.search);
const gameId = urlParams.get('id') || "game1";
const WORLD_FLOOR_LIMIT = 2000; 

let me = null;
let players = {};
let platforms = []; 
let inputs = { left: false, right: false, jump: false };
let particles = []; 
let cameraX = 0;
let cameraY = 0;

// --- 1. АВТОРИЗАЦИЯ ---
const storedUser = localStorage.getItem('tublox_user');
if (!storedUser) { window.location.href = 'login.html'; }
const currentUser = JSON.parse(storedUser);

socket.emit('join_game', { 
    gameId, 
    username: currentUser.username 
});

// --- 2. СЕТЕВЫЕ СОБЫТИЯ ---
socket.on('init_game', (data) => { 
    players = data.players || {}; 
    me = players[socket.id]; 
    
    if (data.map && data.map.length > 0) {
        platforms = data.map.map(p => ({
            ...p, // Это самое важное: копирует text, textColor и textSize
            x: Number(p.x),
            y: Number(p.y),
            w: Number(p.w),
            h: Number(p.h)
        }));
    } else {
        platforms = [{ x: -1000, y: 600, w: 5000, h: 100, color: '#1e1e29', type: 'baseplate' }];
    }
    respawnPlayer();
});

socket.on('player_spawn', (p) => { players[p.id] = p; });

socket.on('player_update', (p) => { 
    if (players[p.id] && p.id !== socket.id) {
        if (!players[p.id].dead) {
            Object.assign(players[p.id], p);
        }
    }
});

socket.on('player_leave', (id) => { delete players[id]; });

socket.on('player_died_anim', (id) => {
    if (players[id]) {
        players[id].dead = true;
        createExplosion(players[id].x + 15, players[id].y + 30, players[id].color);
    }
});

socket.on('player_respawned', (data) => {
    if (players[data.id]) {
        players[data.id].dead = false;
        players[data.id].x = data.x;
        players[data.id].y = data.y;
        players[data.id].dy = 0;
        players[data.id].grounded = false;
    }
});

// --- 3. ФИЗИКА (БЕЗ ПРОВАЛИВАНИЙ) ---
function respawnPlayer() {
    if (!me) return;
    const spawn = platforms.find(p => p.type === 'spawn') || { x: 100, y: 500, w: 30 };
    me.x = spawn.x + (spawn.w / 2) - 15;
    me.y = spawn.y - 70;
    me.dy = 0;
    me.dead = false;
}

function die() {
    if (!me || me.dead) return;
    me.dead = true;
    socket.emit('player_die');
    setTimeout(() => {
        respawnPlayer();
        socket.emit('player_respawn');
    }, 2000);
}

function updatePhysics() {
    if (!me || me.dead) return;

    let moved = false;
    me.isMoving = false;

    // Горизонтальное движение
    if (inputs.left) { me.x -= 6; me.direction = -1; me.isMoving = true; moved = true; }
    if (inputs.right) { me.x += 6; me.direction = 1; me.isMoving = true; moved = true; }
    
    // Гравитация
    me.dy = (me.dy || 0) + 0.8;
    let nextY = me.y + me.dy;
    
    let wasGrounded = me.grounded;
    me.grounded = false; 

    // Логика коллизий (AABB с предсказанием)
    
    platforms.forEach(p => {
        const pLeft = me.x + 5;
        const pRight = me.x + 25;
        const pBottom = me.y + 60;
        const nextBottom = nextY + 60;

        // Если игрок находится в пределах ширины платформы
        if (pRight > p.x && pLeft < p.x + p.w) {
            // Проверка: был ли игрок выше платформы и станет ли ниже/внутри нее
            if (pBottom <= p.y + 2 && nextBottom >= p.y && me.dy >= 0) {
                nextY = p.y - 60; 
                me.dy = 0; 
                me.grounded = true;
            }
        }
    });

    me.y = nextY;

    // Прыжок
    if (inputs.jump && me.grounded) { 
        me.dy = -15; 
        me.grounded = false; 
        moved = true; 
    }

    // Падение в бездну
    if (me.y > WORLD_FLOOR_LIMIT) die();

    // Отправка данных на сервер
    if (moved || me.dy !== 0 || me.grounded !== wasGrounded) {
        socket.emit('player_input', { 
            x: Math.round(me.x), 
            y: Math.round(me.y), 
            direction: me.direction, 
            isMoving: me.isMoving,
            grounded: me.grounded 
        });
    }
}

// --- ОБНОВЛЕННАЯ ОТРИСОВКА С АКСЕССУАРАМИ (ФИКС) ---
const svgCache = {}; // Кэш для изображений, чтобы не пересоздавать их каждый кадр

function drawAvatar(ctx, p) {
    if (!p || p.dead) return;

    ctx.save();
    ctx.translate(p.x + 15, p.y + 60); 
    ctx.scale(p.direction || 1, 1); 

    let legAngle = 0;
    let armAngle = 0;

    if (!p.grounded) {
        armAngle = (p.dy < 0) ? -2.8 : -2.5; 
        legAngle = 0.5; 
    } else if (p.isMoving) {
        const walkCycle = Math.sin(Date.now() / 100);
        legAngle = walkCycle * 0.6;
        armAngle = walkCycle * 0.6; 
    }

    const skin = '#ffccaa';

    // 1. Ноги
    ctx.fillStyle = '#222';
    ctx.save(); ctx.translate(0, -25); ctx.rotate(p.grounded ? -legAngle : -0.2); ctx.fillRect(-6, 0, 12, 25); ctx.restore();
    ctx.save(); ctx.translate(0, -25); ctx.rotate(p.grounded ? legAngle : 0.4); ctx.fillRect(-6, 0, 12, 25); ctx.restore();

    // 2. Тело
    ctx.fillStyle = p.color || '#6c5ce7';
    ctx.fillRect(-11, -55, 22, 30);

    // 3. Руки
    ctx.fillStyle = skin;
    ctx.save(); ctx.translate(0, -45); ctx.rotate(armAngle); ctx.fillRect(-6, 0, 12, 22); ctx.restore(); 

    // 4. Голова (база)
    ctx.beginPath(); 
    ctx.fillStyle = skin;
    ctx.roundRect(-12, -80, 24, 25, 6); 
    ctx.fill();

    // --- ОТРИСОВКА АКСЕССУАРОВ (УВЕЛИЧЕННЫХ) ---
    
    // Лицо: рисуем на всю площадь головы (24x25)
    const faceKey = p.face || 'face_smile';
    const assetFace = GAME_ASSETS[faceKey];
    if (assetFace && assetFace.svg) {
        // x: -12, y: -80, w: 24, h: 25
        drawSvgComponent(ctx, assetFace.svg, -12, -80, 32, 30);
    }

    // Шапка/Корона: рисуем чуть больше и выше
    if (p.hat && p.hat !== 'none') {
        const assetHat = GAME_ASSETS[p.hat];
        if (assetHat && assetHat.svg) {
            // x: -14 (чуть шире), y: -95 (выше головы), w: 28, h: 30
            drawSvgComponent(ctx, assetHat.svg, -28, -90, 56, 44);
        }
    }

    ctx.restore();
}

function drawSvgComponent(ctx, svgContent, x, y, w, h) {
    // Используем viewBox="0 0 24 24", чтобы содержимое растягивалось под наши размеры w и h
    const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${w}" height="${h}">${svgContent}</svg>`;
    
    if (!svgCache[svgContent]) {
        const img = new Image();
        const svgBlob = new Blob([fullSvg], {type: 'image/svg+xml;charset=utf-8'});
        const url = URL.createObjectURL(svgBlob);
        img.src = url;
        svgCache[svgContent] = { img, ready: false };
        img.onload = () => { svgCache[svgContent].ready = true; };
    }
    
    const item = svgCache[svgContent];
    if (item.ready) {
        // Рисуем картинку с заданными размерами
        ctx.drawImage(item.img, x, y, w, h);
    }
}

function render() {
    if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    }
    
    if (me) {
        cameraX += (me.x - canvas.width / 2 - cameraX) * 0.1;
        cameraY += (me.y - canvas.height / 2 + 100 - cameraY) * 0.1;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(-cameraX, -cameraY);

// Платформы
platforms.forEach(p => {
    ctx.fillStyle = p.color || '#1e1e29'; 
    ctx.fillRect(p.x, p.y, p.w, p.h);

    // --- ВОТ ЭТОТ ФРАГМЕНТ ДЛЯ ТЕКСТА ---
    if (p.text) {
        ctx.save();
        ctx.fillStyle = p.textColor || 'white';
        ctx.font = `bold ${p.textSize || 20}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.text, p.x + p.w / 2, p.y + p.h / 2);
        ctx.restore();
    }
    // ------------------------------------

    if (p.type === 'spawn') {
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.strokeRect(p.x, p.y, p.w, p.h);
    }
});
    // Игроки
    for (let id in players) {
        let p = (id === socket.id && me) ? me : players[id];
        drawAvatar(ctx, p);
        if (!p.dead) {
            ctx.fillStyle = 'white';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(p.username, p.x + 15, p.y - 45);
        }
    }

    // Частицы
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update(); particles[i].draw(ctx);
        if (particles[i].life <= 0) particles.splice(i, 1);
    }

    ctx.restore();
    updatePhysics();
    requestAnimationFrame(render);
}

// --- 5. ЭФФЕКТЫ ---
function createExplosion(x, y, color) {
    for (let i = 0; i < 20; i++) {
        particles.push({
            x, y, color,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            life: 1.0,
            update() { this.x += this.vx; this.y += this.vy; this.vy += 0.2; this.life -= 0.02; },
            draw(ctx) { ctx.globalAlpha = this.life; ctx.fillStyle = this.color; ctx.fillRect(this.x, this.y, 5, 5); ctx.globalAlpha = 1; }
        });
    }
}

// --- 6. УПРАВЛЕНИЕ ---
window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') inputs.left = true;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') inputs.right = true;
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') inputs.jump = true;
});
window.addEventListener('keyup', e => {
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') inputs.left = false;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') inputs.right = false;
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') inputs.jump = false;
});

render();

// --- ФУНКЦИЯ ДЛЯ КНОПКИ RESET ---
function resetCharacterLocal() {
    if (me && !me.dead) {
        die(); // Используем уже готовую функцию смерти
    }
}

// --- ЛОГИКА ЧАТА ---
const chatInput = document.getElementById('chatInput');
const chatBtn = document.getElementById('chatSendBtn');
const msgsDiv = document.getElementById('msgs');

function sendMessage() {
    const text = chatInput.value.trim();
    if (text) {
        socket.emit('send_msg', text);
        chatInput.value = '';
    }
}

chatBtn.onclick = sendMessage;
chatInput.onkeydown = (e) => {
    if (e.key === 'Enter') sendMessage();
};

// Получение сообщений
socket.on('new_msg', (data) => {
    const div = document.createElement('div');
    div.innerHTML = `<b>${data.user}:</b> ${data.text}`;
    msgsDiv.appendChild(div);
    msgsDiv.scrollTop = msgsDiv.scrollHeight; // Автопрокрутка вниз
});
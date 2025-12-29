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
// Ссылка на ассеты
const ASSETS_DB = window.GAME_ASSETS || {};
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
            ...p,
            x: Number(p.x),
            y: Number(p.y),
            w: Number(p.w) * (Number(p.scaleX) || 1),
            h: Number(p.h) * (Number(p.scaleY) || 1),
            anchored: (p.anchored !== undefined) ? p.anchored : true,
            collide: (p.collide !== undefined) ? p.collide : true,
            text: p.text || "",
            textSize: p.textSize || 20,
            textColor: p.textColor || "#ffffff",
            font: p.font || "Arial",
            transparency: p.transparency || 0,
            dy: 0, // Вертикальная скорость для физики падения
            special: p.special
        }));
    } else {
        platforms = [{ x: -1000, y: 600, w: 5000, h: 100, color: '#1e1e29', type: 'baseplate', collide: true, anchored: true }];
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
        createExplosion(players[id].x + 15, players[id].y + 30, players[id].color || '#fff');
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
// --- 3. ФИЗИКА ---
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

// Проверка пересечения двух прямоугольников
function checkCollision(rect1, rect2) {
    return (
        rect1.x < rect2.x + rect2.w &&
        rect1.x + rect1.w > rect2.x &&
        rect1.y < rect2.y + rect2.h &&
        rect1.y + rect1.h > rect2.y
    );
}
function updatePhysics() {
    // === 1. ФИЗИКА ПРЕДМЕТОВ (ROBLOX STYLE) ===
    platforms.forEach(obj => {
        // Если предмет закреплен (Anchored), он не двигается
        if (obj.anchored) return;
        // Применяем гравитацию
        obj.dy = (obj.dy || 0) + 0.5;
        let nextY = obj.y + obj.dy;
        // Если у падающего предмета Collide = false, он пролетает сквозь всё
        if (obj.collide === false) {
            obj.y = nextY;
            return; // Дальше проверки не нужны, он призрак
        }
        // Если Collide = true, проверяем столкновения с другими объектами
        let landed = false;
        // Проверяем все остальные платформы
        for (let other of platforms) {
            if (obj === other) continue; // Не проверять себя
            // Если "пол" призрачный (Collide = false), сквозь него пролетаем
            if (other.collide === false) continue;
            // Проверка по горизонтали (находимся ли мы над объектом)
            if (obj.x < other.x + other.w && obj.x + obj.w > other.x) {
                // Проверка по вертикали (были ли мы выше и станем ли ниже/внутри)
                if (obj.y + obj.h <= other.y + 10 && nextY + obj.h >= other.y) {
                    obj.y = other.y - obj.h; // Ставим ровно сверху
                    obj.dy = 0; // Останавливаем падение
                    landed = true;
                    break; // Нашли пол, хватит искать
                }
            }
        }
        // Если не приземлились, применяем движение вниз
        if (!landed) {
            obj.y = nextY;
        }
        // Удаление если упал в бездну (оптимизация)
        if (obj.y > WORLD_FLOOR_LIMIT + 500) {
            obj.anchored = true; // Замораживаем, чтобы не считать физику зря
            obj.dy = 0;
        }
    });
    // === 2. ФИЗИКА ИГРОКА ===
    if (!me || me.dead) return;
    let moved = false;
    me.isMoving = false;
    // Горизонтальное движение
    let dx = 0;
    if (inputs.left) { dx = -6; me.direction = -1; me.isMoving = true; }
    if (inputs.right) { dx = 6; me.direction = 1; me.isMoving = true; }
    if (dx !== 0) {
        me.x += dx;
        moved = true;
        // Хитбокс X
        const playerHitboxX = { x: me.x + 5, y: me.y, w: 20, h: 60 };
        platforms.forEach(p => {
            if (!p.collide) return; // Проход сквозь призрачные блоки
            if (checkCollision(playerHitboxX, p)) {
                if (dx > 0) me.x = p.x - 25;
                else if (dx < 0) me.x = p.x + p.w - 5;
            }
        });
    }
    // Вертикальное движение
    me.dy = (me.dy || 0) + 0.8;
    me.y += me.dy;
    const wasGrounded = me.grounded;
    me.grounded = false;
    // Хитбокс Y
    const playerHitboxY = { x: me.x + 5, y: me.y, w: 20, h: 60 };
    platforms.forEach(p => {
        if (!p.collide) return; // Проход сквозь призрачные блоки
        if (checkCollision(playerHitboxY, p)) {
            // Падение вниз
            if (me.dy > 0) {
                if (me.y - me.dy + 60 <= p.y + 15) { // +15 допуск для больших скоростей
                    me.y = p.y - 60;
                    me.dy = 0;
                    me.grounded = true;
                }
            }
            // Удар головой
            else if (me.dy < 0) {
                me.y = p.y + p.h;
                me.dy = 0;
            }
            // Special parts
            if (p.special === 'kill') {
                die();
            } else if (p.special === 'teleport') {
                const targetPart = platforms.find(other => other.id === p.target || other.special === 'teleport' && other !== p);
                if (targetPart) {
                    me.x = targetPart.x + (targetPart.w / 2) - 15;
                    me.y = targetPart.y - 70;
                    me.dy = 0;
                }
            }
        }
    });
    if (inputs.jump && me.grounded) {
        me.dy = -15;
        me.grounded = false;
        moved = true;
    }
    if (me.y > WORLD_FLOOR_LIMIT) die();
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
// --- 4. ОТРИСОВКА ---
const svgCache = {};
function getAsset(p, type) {
    let itemId = 'none';
    if (p.equipped && p.equipped[type]) itemId = p.equipped[type];
    else if (p[type]) itemId = p[type];
    if (!itemId || itemId === 'none') {
        if (type === 'face') itemId = 'face_smile';
        if (type === 'shirt') itemId = 'none_shirt';
        if (type === 'pants') itemId = 'none_pants';
        if (type === 'hat') itemId = 'none';
    }
    return ASSETS_DB[itemId] || { svg: '', color: null };
}
function drawAvatar(ctx, p) {
    if (!p || p.dead) return;
    ctx.save();
    ctx.translate(p.x + 15, p.y + 60);
    ctx.scale(p.direction || 1, 1);
    
    // Анимация
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

    const SKIN_COLOR = '#ffccaa';
    const pantsData = getAsset(p, 'pants');
    const shirtData = getAsset(p, 'shirt');
    const faceData = getAsset(p, 'face');
    const hatData = getAsset(p, 'hat');
    const pantsColor = pantsData.color || '#2d3436';
    const shirtColor = shirtData.color || p.color || '#6c5ce7';

    // Задняя рука
    ctx.fillStyle = SKIN_COLOR;
    ctx.save(); ctx.translate(6, -45); ctx.rotate(-armAngle); ctx.fillRect(-3, 0, 10, 22); ctx.restore();

    // Ноги
    ctx.fillStyle = pantsColor;
    ctx.save(); ctx.translate(-5, -25); ctx.rotate(p.grounded ? -legAngle : -0.2); ctx.fillRect(-5, 0, 10, 25); ctx.restore();
    ctx.save(); ctx.translate(5, -25); ctx.rotate(p.grounded ? legAngle : 0.4); ctx.fillRect(-5, 0, 10, 25); ctx.restore();

    // Тело
    ctx.fillStyle = shirtColor;
    ctx.fillRect(-11, -55, 22, 30);
    if (shirtData.svg) drawSvgComponent(ctx, shirtData.svg, -11, -55, 22, 30);

    // Голова
    ctx.beginPath(); ctx.fillStyle = SKIN_COLOR; ctx.roundRect(-12, -80, 24, 25, 6); ctx.fill();
    
    // Лицо
    if (faceData.svg) drawSvgComponent(ctx, faceData.svg, -25, -100, 50, 50);

    // Передняя рука
    ctx.fillStyle = SKIN_COLOR;
    ctx.save(); ctx.translate(-6, -45); ctx.rotate(armAngle); ctx.fillRect(-7, 0, 10, 22); ctx.restore();

    // --- ШАПКА (ИСПРАВЛЕНО ЗДЕСЬ) ---
    if (hatData.svg && hatData.name !== 'None') {
        // Было -90, стало -105 (подняли выше).
        // Размер 42x42 делает арбуз большим, как на картинке.
        drawSvgComponent(ctx, hatData.svg, -21, -105, 42, 42);
    }

    ctx.restore();
}

// Эту функцию оставь как в прошлом моем ответе (с viewBox="0 -10 24 35")
function drawSvgComponent(ctx, svgContent, x, y, w, h) {
    if (!svgContent) return;
    // Обязательно используем viewBox с отрицательным Y, чтобы арбуз не обрезался сверху
    const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -10 24 35" width="${w}" height="${h}">${svgContent}</svg>`;
    
    if (!svgCache[svgContent]) {
        const img = new Image();
        const svgBlob = new Blob([fullSvg], {type: 'image/svg+xml;charset=utf-8'});
        const url = URL.createObjectURL(svgBlob);
        img.src = url;
        svgCache[svgContent] = { img, ready: false };
        img.onload = () => { svgCache[svgContent].ready = true; URL.revokeObjectURL(url); };
    }
    const item = svgCache[svgContent];
    if (item && item.ready) ctx.drawImage(item.img, x, y, w, h);
}
// --- ОТРИСОВКА КАДРА ---
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
    platforms.forEach(p => {
        // Цвет и тело
        ctx.globalAlpha = 1 - p.transparency;
        ctx.fillStyle = p.color || '#1e1e29';
        ctx.fillRect(p.x, p.y, p.w, p.h);
        // Текст
        if (p.text) {
            ctx.save();
            ctx.fillStyle = p.textColor || 'white';
            const fontName = p.font || 'Arial';
            const size = p.textSize || 20;
            ctx.font = `bold ${size}px "${fontName}"`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(p.text, p.x + p.w / 2, p.y + p.h / 2);
            ctx.restore();
        }
        if (p.type === 'spawn') {
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.strokeRect(p.x, p.y, p.w, p.h);
        }
        ctx.globalAlpha = 1;
    });
    for (let id in players) {
        let p = (id === socket.id && me) ? me : players[id];
        drawAvatar(ctx, p);
        if (!p.dead) {
            ctx.fillStyle = 'white';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(p.username, p.x + 15, p.y - 95);
        }
    }
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update(); particles[i].draw(ctx);
        if (particles[i].life <= 0) particles.splice(i, 1);
    }
    ctx.restore();
    updatePhysics();
    requestAnimationFrame(render);
}
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
window.addEventListener('keydown', e => {
    if (document.activeElement === chatInput) return;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') inputs.left = true;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') inputs.right = true;
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') inputs.jump = true;
});
window.addEventListener('keyup', e => {
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') inputs.left = false;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') inputs.right = false;
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') inputs.jump = false;
});
const chatInput = document.getElementById('chatInput');
const chatBtn = document.getElementById('chatSendBtn');
const msgsDiv = document.getElementById('msgs');
function sendMessage() {
    const text = chatInput.value.trim();
    if (text) { socket.emit('send_msg', text); chatInput.value = ''; chatInput.blur(); }
}
if (chatBtn) chatBtn.onclick = sendMessage;
if (chatInput) { chatInput.onkeydown = (e) => { if (e.key === 'Enter') sendMessage(); }; }
socket.on('new_msg', (data) => {
    if (!msgsDiv) return;
    const div = document.createElement('div');
    div.innerHTML = `<b>${data.user}:</b> ${data.text}`;
    msgsDiv.appendChild(div);
    msgsDiv.scrollTop = msgsDiv.scrollHeight;
});
render();
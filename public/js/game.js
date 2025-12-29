const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- ТЕНЕВОЙ СЛОЙ (ВАЖНО: Создаем его глобально) ---
const lightCanvas = document.createElement('canvas');
const lightCtx = lightCanvas.getContext('2d');

// --- НАСТРОЙКИ МИРА ---
const urlParams = new URLSearchParams(window.location.search);
const gameId = urlParams.get('id') || "game1";
const WORLD_FLOOR_LIMIT = 2000;

// --- ПЕРЕМЕННЫЕ ИГРОКА ---
let me = null;
let players = {};
let platforms = [];
let inputs = { left: false, right: false, jump: false };
let particles = [];
let cameraX = 0;
let cameraY = 0;

// --- ИНВЕНТАРЬ ---
let myInventory = []; 
let selectedSlot = 0; 
const MAX_SLOTS = 3;

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
            dy: 0,
            special: p.special,
            customSpeed: p.customSpeed,
            customJump: p.customJump,
            customScale: p.customScale
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

// --- 3. ФИЗИКА И ЛОГИКА ---
function respawnPlayer() {
    if (!me) return;
    const spawn = platforms.find(p => p.type === 'spawn') || { x: 100, y: 500, w: 30 };
    me.x = spawn.x + (spawn.w / 2) - 15;
    me.y = spawn.y - 70;
    me.dy = 0;
    me.dead = false;
    me.speed = 6;
    me.jumpPower = 15;
    me.scale = 1;
    
    // Сброс инвентаря
    myInventory = [];
    selectedSlot = 0;
    updateInventoryUI();
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

function checkCollision(rect1, rect2) {
    return (
        rect1.x < rect2.x + rect2.w &&
        rect1.x + rect1.w > rect2.x &&
        rect1.y < rect2.y + rect2.h &&
        rect1.y + rect1.h > rect2.y
    );
}

function updatePhysics() {
    // 1. Физика предметов
    platforms.forEach(obj => {
        if (obj.anchored) return;
        obj.dy = (obj.dy || 0) + 0.5;
        let nextY = obj.y + obj.dy;
        if (obj.collide === false) { obj.y = nextY; return; }
        
        let landed = false;
        for (let other of platforms) {
            if (obj === other) continue; 
            if (other.collide === false) continue;
            
            if (obj.x < other.x + other.w && obj.x + obj.w > other.x) {
                if (obj.y + obj.h <= other.y + 10 && nextY + obj.h >= other.y) {
                    obj.y = other.y - obj.h;
                    obj.dy = 0;
                    landed = true;
                    break; 
                }
            }
        }
        if (!landed) obj.y = nextY;
        if (obj.y > WORLD_FLOOR_LIMIT + 500) { obj.anchored = true; obj.dy = 0; }
    });

    // 2. Физика игрока
    if (!me || me.dead) return;
    if (!me.speed) me.speed = 6;
    if (!me.jumpPower) me.jumpPower = 15;
    if (!me.scale) me.scale = 1;

    const pW = 20 * me.scale;
    const pH = 60 * me.scale;
    const hitboxOffsetX = 15 - (pW / 2);

    let moved = false;
    me.isMoving = false;

    // Движение
    let dx = 0;
    if (inputs.left) { dx = -me.speed; me.direction = -1; me.isMoving = true; }
    if (inputs.right) { dx = me.speed; me.direction = 1; me.isMoving = true; }
    
    if (dx !== 0) {
        me.x += dx;
        moved = true;
        const playerHitboxX = { x: me.x + hitboxOffsetX, y: me.y, w: pW, h: pH };
        platforms.forEach(p => {
            if (!p.collide) return;
            if (checkCollision(playerHitboxX, p)) {
                if (dx > 0) me.x = p.x - hitboxOffsetX - pW;
                else if (dx < 0) me.x = p.x + p.w - hitboxOffsetX;
            }
        });
    }

    me.dy = (me.dy || 0) + 0.8;
    me.y += me.dy;
    const wasGrounded = me.grounded;
    me.grounded = false;
    const playerHitboxY = { x: me.x + hitboxOffsetX, y: me.y, w: pW, h: pH };

    platforms.forEach(p => {
        if (checkCollision(playerHitboxY, p)) {
            if (p.special === 'kill') die();
            else if (p.special === 'speed_up') me.speed = (p.customSpeed !== undefined) ? Number(p.customSpeed) : 16;
            else if (p.special === 'jump_boost') me.jumpPower = (p.customJump !== undefined) ? Number(p.customJump) : 30;
            else if (p.special === 'big_player') me.scale = (p.customScale !== undefined) ? Number(p.customScale) : 2.0;
            else if (p.special === 'small_player') me.scale = (p.customScale !== undefined) ? Number(p.customScale) : 0.5;
            else if (p.special === 'normal_player') { me.scale = 1; me.speed = 6; me.jumpPower = 15; } 
            else if (p.special === 'teleport') {
                const targetPart = platforms.find(other => other.id === p.target || other.special === 'teleport' && other !== p);
                if (targetPart) { me.x = targetPart.x + (targetPart.w / 2) - 15; me.y = targetPart.y - 70; me.dy = 0; }
            }
            // --- ПОДБОР ПРЕДМЕТА ---
            else if (p.special === 'flashlight') {
                const alreadyHas = myInventory.find(i => i.id === 'flashlight');
                if (!alreadyHas && myInventory.length < MAX_SLOTS) {
                    myInventory.push({ 
                        id: 'flashlight', 
                        name: 'Flashlight', 
                        icon: '🔦', 
                        isActive: true, // <--- ВКЛЮЧАЕМ СРАЗУ ПРИ ПОДБОРЕ
                        type: 'tool' 
                    });
                    updateInventoryUI();
                    p.x = -99999;
                }
            }
        }
        if (!p.collide) return;
        if (checkCollision(playerHitboxY, p)) {
            if (me.dy > 0) {
                if (me.y - me.dy + pH <= p.y + 20) { me.y = p.y - pH; me.dy = 0; me.grounded = true; }
            } else if (me.dy < 0) { me.y = p.y + p.h; me.dy = 0; }
        }
    });

    if (inputs.jump && me.grounded) { me.dy = -me.jumpPower; me.grounded = false; moved = true; }
    if (me.y > WORLD_FLOOR_LIMIT) die();

    if (moved || me.dy !== 0 || me.grounded !== wasGrounded) {
        socket.emit('player_input', {
            x: Math.round(me.x),
            y: Math.round(me.y),
            direction: me.direction,
            isMoving: me.isMoving,
            grounded: me.grounded,
            scale: me.scale
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
function drawSvgComponent(ctx, svgContent, x, y, w, h) {
    if (!svgContent) return;
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

function drawAvatar(ctx, p) {
    if (!p || p.dead) return;
    ctx.save();
    const s = p.scale || 1;
    ctx.translate(p.x + 15, p.y + (60 * s)); 
    ctx.scale((p.direction || 1) * s, s);

    const isMe = (p === me);
    const heldItem = isMe ? myInventory[selectedSlot] : null;
    const isHolding = heldItem !== undefined && heldItem !== null;

    let legAngle = 0;
    let armAngle = 0;
    if (!p.grounded) { armAngle = (p.dy < 0) ? -2.8 : -2.5; legAngle = 0.5; } 
    else if (p.isMoving) { const c = Math.sin(Date.now() / 100); legAngle = c * 0.6; armAngle = c * 0.6; }
    if (isHolding) { armAngle = -1.5; }

    const SKIN_COLOR = '#ffccaa';
    const pantsData = getAsset(p, 'pants');
    const shirtData = getAsset(p, 'shirt');
    const faceData = getAsset(p, 'face');
    const hatData = getAsset(p, 'hat');
    const pantsColor = pantsData.color || '#2d3436';
    const shirtColor = shirtData.color || p.color || '#6c5ce7';

    ctx.fillStyle = SKIN_COLOR;
    ctx.save(); ctx.translate(6, -45); ctx.rotate(isHolding ? -armAngle : -armAngle); ctx.fillRect(-3, 0, 10, 22); ctx.restore();

    ctx.fillStyle = pantsColor;
    ctx.save(); ctx.translate(-5, -25); ctx.rotate(p.grounded ? -legAngle : -0.2); ctx.fillRect(-5, 0, 10, 25); ctx.restore();
    ctx.save(); ctx.translate(5, -25); ctx.rotate(p.grounded ? legAngle : 0.4); ctx.fillRect(-5, 0, 10, 25); ctx.restore();

    ctx.fillStyle = shirtColor;
    ctx.fillRect(-11, -55, 22, 30);
    if (shirtData.svg) drawSvgComponent(ctx, shirtData.svg, -11, -55, 22, 30);

    ctx.beginPath(); ctx.fillStyle = SKIN_COLOR; ctx.roundRect(-12, -80, 24, 25, 6); ctx.fill();
    if (faceData.svg) drawSvgComponent(ctx, faceData.svg, -25, -100, 50, 50);

    ctx.fillStyle = SKIN_COLOR;
    ctx.save(); ctx.translate(-6, -45); ctx.rotate(armAngle); ctx.fillRect(-7, 0, 10, 22); 
    
    if (isHolding && heldItem.id === 'flashlight') {
        ctx.save(); ctx.translate(-5, 18); ctx.rotate(Math.PI / 2); 
        ctx.fillStyle = '#555'; ctx.fillRect(0, -3, 12, 6);
        ctx.fillStyle = '#222'; ctx.fillRect(12, -4, 4, 8); 
        if (heldItem.isActive) { ctx.fillStyle = '#f1c40f'; ctx.fillRect(16, -3, 2, 6); }
        ctx.restore();
    }
    ctx.restore();

    if (hatData.svg && hatData.name !== 'None') drawSvgComponent(ctx, hatData.svg, -21, -105, 42, 42);
    ctx.restore();
}

// --- ГЛАВНАЯ ОТРИСОВКА ---
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
        ctx.globalAlpha = 1 - p.transparency;
        ctx.fillStyle = p.color || '#1e1e29';
        ctx.fillRect(p.x, p.y, p.w, p.h);
        if (p.text) {
            ctx.fillStyle = p.textColor || 'white';
            ctx.font = `bold ${p.textSize || 20}px "${p.font || 'Arial'}"`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(p.text, p.x + p.w / 2, p.y + p.h / 2);
        }
        if (p.type === 'spawn') { ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.strokeRect(p.x, p.y, p.w, p.h); }
        ctx.globalAlpha = 1;
    });

    for (let id in players) {
        let p = (id === socket.id && me) ? me : players[id];
        drawAvatar(ctx, p);
        if (!p.dead) {
            ctx.fillStyle = 'white'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center';
            ctx.fillText(p.username, p.x + 15, p.y - 95);
        }
    }
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update(); particles[i].draw(ctx);
        if (particles[i].life <= 0) particles.splice(i, 1);
    }
    ctx.restore();

    // --- ЛОГИКА ФОНАРИКА (ИСПРАВЛЕНАЯ) ---
    if (me && myInventory.length > 0) {
        const item = myInventory[selectedSlot];
        
        if (item && item.id === 'flashlight' && item.isActive) {
            // 1. Готовим холст света
            lightCanvas.width = canvas.width;
            lightCanvas.height = canvas.height;
            
            // 2. Очищаем его (Важно!)
            lightCtx.clearRect(0, 0, canvas.width, canvas.height);

            // 3. Заливаем черным (темнота)
            lightCtx.fillStyle = 'rgba(0, 0, 0, 0.95)';
            lightCtx.fillRect(0, 0, canvas.width, canvas.height);
            
            // 4. Включаем режим "Ластик"
            lightCtx.globalCompositeOperation = 'destination-out';

            const screenX = (me.x + 15) - cameraX;
            const screenY = (me.y + 30) - cameraY;

            // 5. Рисуем конус света
            const rad = lightCtx.createRadialGradient(screenX, screenY, 10, screenX, screenY, 600);
            rad.addColorStop(0, 'rgba(0,0,0,1)'); // Прозрачно (стираем 100%)
            rad.addColorStop(1, 'rgba(0,0,0,0)'); // Темно (не стираем)

            lightCtx.fillStyle = rad;
            lightCtx.beginPath();
            lightCtx.moveTo(screenX, screenY);
            if (me.direction === 1) lightCtx.arc(screenX, screenY, 600, -0.5, 0.5); 
            else lightCtx.arc(screenX, screenY, 600, Math.PI - 0.5, Math.PI + 0.5);
            lightCtx.lineTo(screenX, screenY);
            lightCtx.fill();

            // 6. Круг вокруг игрока
            lightCtx.beginPath();
            lightCtx.arc(screenX, screenY, 80, 0, Math.PI * 2);
            lightCtx.fill();

            // 7. Рисуем готовый слой света поверх игры
            ctx.drawImage(lightCanvas, 0, 0);
        }
    }

    updatePhysics();
    requestAnimationFrame(render);
}

// --- УПРАВЛЕНИЕ ---
window.addEventListener('keydown', e => {
    if (document.activeElement === chatInput) return;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') inputs.left = true;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') inputs.right = true;
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') inputs.jump = true;
    if (e.key === '1') { selectedSlot = 0; updateInventoryUI(); }
    if (e.key === '2') { selectedSlot = 1; updateInventoryUI(); }
    if (e.key === '3') { selectedSlot = 2; updateInventoryUI(); }
});
window.addEventListener('keyup', e => {
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') inputs.left = false;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') inputs.right = false;
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') inputs.jump = false;
});

// КЛИК (Исправленный)
window.addEventListener('mousedown', (e) => {
    // Не кликать сквозь UI
    if (e.target.closest('.hotbar-container') || e.target.closest('.chat-wrapper') || e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
    
    // Переключение предмета
    if (myInventory && myInventory[selectedSlot]) {
        const item = myInventory[selectedSlot];
        if (item.type === 'tool') {
            item.isActive = !item.isActive;
            console.log("CLick! Active:", item.isActive);
            updateInventoryUI();
        }
    }
});
window.addEventListener('wheel', (e) => {
    if (e.deltaY > 0) selectedSlot = (selectedSlot + 1) % MAX_SLOTS;
    else selectedSlot = (selectedSlot - 1 + MAX_SLOTS) % MAX_SLOTS;
    updateInventoryUI();
});

// --- UI ФУНКЦИИ ---
function updateInventoryUI() {
    const container = document.getElementById('hotbar');
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < MAX_SLOTS; i++) {
        const item = myInventory[i];
        const div = document.createElement('div');
        div.className = `slot ${i === selectedSlot ? 'selected' : ''}`;
        if (item) {
            div.innerHTML = `<span class="slot-number">${i + 1}</span> ${item.icon}`;
            if (item.isActive) div.innerHTML += `<div class="item-active-indicator" style="display:block"></div>`;
        } else {
            div.innerHTML = `<span class="slot-number">${i + 1}</span>`;
        }
        div.onclick = () => { selectedSlot = i; updateInventoryUI(); };
        container.appendChild(div);
    }
}
function createExplosion(x, y, color) {
    for (let i = 0; i < 20; i++) {
        particles.push({
            x, y, color,
            vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10,
            life: 1.0,
            update() { this.x += this.vx; this.y += this.vy; this.vy += 0.2; this.life -= 0.02; },
            draw(ctx) { ctx.globalAlpha = this.life; ctx.fillStyle = this.color; ctx.fillRect(this.x, this.y, 5, 5); ctx.globalAlpha = 1; }
        });
    }
}

// ЧАТ
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
updateInventoryUI();
render();
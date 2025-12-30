const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Элементы HP
const hpFill = document.getElementById('hpFill');
const hpText = document.getElementById('hpText');

// --- ТЕНЕВОЙ СЛОЙ ---
const lightCanvas = document.createElement('canvas');
const lightCtx = lightCanvas.getContext('2d');

// --- НАСТРОЙКИ ---
const urlParams = new URLSearchParams(window.location.search);
const gameId = urlParams.get('id') || "game1";
const WORLD_FLOOR_LIMIT = 2000;

// --- ПЕРЕМЕННЫЕ ---
let me = null;
let players = {};
let platforms = [];
let inputs = { left: false, right: false, jump: false };
let particles = [];
let cameraX = 0;
let cameraY = 0;

// --- ИНВЕНТАРЬ (Локальный, для инструментов на карте) ---
let myInventory = []; 
let selectedSlot = 0; 
const MAX_SLOTS = 3;

// --- БОЕВАЯ СИСТЕМА ---
let isSwinging = false; 
let swingTimer = 0;
const SWING_DURATION = 10; 
let lastAttackTime = 0;
const ATTACK_COOLDOWN = 400; 

// Ассеты (Должны быть загружены в window.GAME_ASSETS из assets.js)
const ASSETS_DB = window.GAME_ASSETS || {};

// --- 1. АВТОРИЗАЦИЯ ---
const storedUser = localStorage.getItem('tublox_user');
if (!storedUser) { window.location.href = 'login.html'; }
const currentUser = JSON.parse(storedUser);

// Отправляем запрос на вход (Сервер возьмет данные из MySQL)
socket.emit('join_game', {
    gameId,
    username: currentUser.username
});

// --- 2. СЕТЕВЫЕ СОБЫТИЯ ---

// ПОЛУЧЕНИЕ КАРТЫ ИЗ MYSQL
socket.on('init_game', (data) => {
    // console.log("Map received from MySQL via Server:", data.map); // Для отладки
    players = data.players || {};
    me = players[socket.id];
    
    if (data.map && data.map.length > 0) {
        platforms = data.map.map(p => ({
            ...p,
            x: Number(p.x), y: Number(p.y),
            w: Number(p.w) * (Number(p.scaleX) || 1),
            h: Number(p.h) * (Number(p.scaleY) || 1),
            orgX: Number(p.x), orgY: Number(p.y),
            timeOffset: Math.random() * 1000,
            anchored: (p.anchored !== undefined) ? p.anchored : true,
            collide: (p.collide !== undefined) ? p.collide : true,
            text: p.text || "", textSize: p.textSize || 20, textColor: p.textColor || "#ffffff",
            transparency: p.transparency || 0,
            dy: 0,
            special: p.special,
            customSpeed: p.customSpeed, customJump: p.customJump, customScale: p.customScale,
            spinSpeed: Number(p.spinSpeed) || 0, angle: 0,
            moveSpeed: (Number(p.moveSpeed) < 0.1) ? 2 : Number(p.moveSpeed),
            rangeX: Number(p.rangeX) || 0, rangeY: Number(p.rangeY) || 0,
            currentDx: 0, currentDy: 0
        }));
    } else {
        // Если карта в MySQL пустая, создаем базовую платформу
        platforms = [{ x: -1000, y: 600, w: 5000, h: 100, color: '#1e1e29', type: 'baseplate', collide: true, anchored: true }];
    }
    respawnPlayer();
});

socket.on('player_spawn', (p) => { players[p.id] = p; });

socket.on('player_update', (p) => {
    if (players[p.id] && p.id !== socket.id && !players[p.id].dead) {
        Object.assign(players[p.id], p);
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
        players[data.id].heldItemId = null;
        if (data.id === socket.id) {
            me.hp = 100;
            updateHpUI(100);
        }
    }
});

socket.on('player_hp_update', (data) => {
    if (players[data.id]) {
        players[data.id].hp = data.hp;
        
        if (data.id === socket.id) {
            me.hp = data.hp;
            updateHpUI(data.hp);
            createExplosion(me.x + 15, me.y + 30, '#ff0000'); // Кровь
            
            if (me.hp <= 0 && !me.dead) {
                die();
            }
        }
    }
});

// --- 3. ЛОГИКА ---
function updateHpUI(hp) {
    if (hp < 0) hp = 0;
    const pct = (hp / 100) * 100;
    if (hpFill) hpFill.style.width = pct + '%';
    if (hpText) hpText.innerText = Math.ceil(hp) + ' / 100';
}

function respawnPlayer() {
    if (!me) return;
    const spawn = platforms.find(p => p.type === 'spawn') || { x: 100, y: 500, w: 30 };
    me.x = spawn.x + (spawn.w / 2) - 15;
    me.y = spawn.y - 70;
    me.dy = 0;
    me.dead = false;
    me.hp = 100;
    updateHpUI(100);
    
    // Сброс статов
    me.speed = 6;
    me.jumpPower = 15;
    me.scale = 1;
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

function checkSpinnerCollision(playerRect, spinner) {
    const cx = spinner.x + spinner.w / 2;
    const cy = spinner.y + spinner.h / 2;
    const px = playerRect.x + playerRect.w / 2;
    const py = playerRect.y + playerRect.h / 2;
    const dist = Math.sqrt((cx-px)**2 + (cy-py)**2);
    return dist < (spinner.w / 2);
}

function updatePhysics() {
    const time = Date.now() / 1000;

    platforms.forEach(obj => {
        if (obj.anchored) {
            if (obj.special === 'mover') {
                const wave = (Math.sin(time * obj.moveSpeed + obj.timeOffset) + 1) / 2;
                const targetX = obj.orgX + (wave * obj.rangeX);
                const targetY = obj.orgY + (wave * obj.rangeY);
                obj.currentDx = targetX - obj.x;
                obj.currentDy = targetY - obj.y;
                obj.x = targetX;
                obj.y = targetY;
            }
            if (obj.special === 'spinner') {
                obj.angle += obj.spinSpeed * 0.05;
            }
            return;
        }
        obj.dy = (obj.dy || 0) + 0.5;
        let nextY = obj.y + obj.dy;
        if (obj.collide === false) { obj.y = nextY; return; }
        
        let landed = false;
        for (let other of platforms) {
            if (obj === other) continue; 
            if (other.collide === false) continue;
            if (obj.x < other.x + other.w && obj.x + obj.w > other.x) {
                if (obj.y + obj.h <= other.y + 10 && nextY + obj.h >= other.y) {
                    obj.y = other.y - obj.h; obj.dy = 0; landed = true; break; 
                }
            }
        }
        if (!landed) obj.y = nextY;
        if (obj.y > WORLD_FLOOR_LIMIT + 500) { obj.anchored = true; obj.dy = 0; }
    });

    if (!me || me.dead) return;
    if (!me.speed) me.speed = 6;
    if (!me.jumpPower) me.jumpPower = 15;
    if (!me.scale) me.scale = 1;

    const pW = 20 * me.scale;
    const pH = 60 * me.scale;
    const hitboxOffsetX = 15 - (pW / 2);
    let moved = false;
    me.isMoving = false;

    let dx = 0;
    if (inputs.left) { dx = -me.speed; me.direction = -1; me.isMoving = true; }
    if (inputs.right) { dx = me.speed; me.direction = 1; me.isMoving = true; }
    
    if (dx !== 0) {
        me.x += dx; moved = true;
        const playerHitboxX = { x: me.x + hitboxOffsetX, y: me.y, w: pW, h: pH };
        platforms.forEach(p => {
            if (!p.collide || p.special === 'spinner') return; 
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
        if (p.special === 'spinner') {
            if (checkSpinnerCollision(playerHitboxY, p)) die();
            return;
        }
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
            else if (p.special === 'flashlight' || p.special === 'sword') {
                const itemId = p.special; 
                const alreadyHas = myInventory.find(i => i.id === itemId);
                if (!alreadyHas && myInventory.length < MAX_SLOTS) {
                    const newItem = { 
                        id: itemId, 
                        name: itemId === 'sword' ? 'Sword' : 'Flashlight', 
                        icon: itemId === 'sword' ? '⚔️' : '🔦', 
                        isActive: true, 
                        type: 'tool' 
                    };
                    myInventory.push(newItem);
                    updateInventoryUI();
                    
                    // --- ИЗМЕНЕНИЕ: УБРАЛИ СКРЫТИЕ ПРЕДМЕТА ---
                    // p.x = -99999; // <--- Эта строка теперь закомментирована, предмет остается на месте!
                }
            }
        }
        if (!p.collide) return;
        if (checkCollision(playerHitboxY, p)) {
            if (me.dy > 0) {
                if (me.y - me.dy + pH <= p.y + 20) { 
                    me.y = p.y - pH; me.dy = 0; me.grounded = true;
                    if (p.special === 'mover') {
                        me.x += p.currentDx; me.y += p.currentDy;
                        if (Math.abs(p.currentDx) > 0.1) moved = true;
                    }
                }
            } else if (me.dy < 0) { me.y = p.y + p.h; me.dy = 0; }
        }
    });

    if (inputs.jump && me.grounded) { me.dy = -me.jumpPower; me.grounded = false; moved = true; }
    if (me.y > WORLD_FLOOR_LIMIT) die();

    const currentItem = myInventory[selectedSlot];
    const itemToSend = (currentItem && currentItem.isActive) ? currentItem.id : null;
    const attackState = isSwinging ? 1 : 0; 

    // Отправляем инпут на сервер только если что-то изменилось
    if (moved || me.dy !== 0 || me.grounded !== wasGrounded || me.lastHeldItem !== itemToSend || me.lastAttack !== attackState) {
        me.lastHeldItem = itemToSend;
        me.lastAttack = attackState;
        
        socket.emit('player_input', {
            x: Math.round(me.x), y: Math.round(me.y),
            direction: me.direction, isMoving: me.isMoving,
            grounded: me.grounded, scale: me.scale,
            heldItemId: itemToSend,
            isAttacking: isSwinging 
        });
    }
}

// --- 4. ОТРИСОВКА ---
const svgCache = {};

// ИСПРАВЛЕННАЯ ФУНКЦИЯ ДЛЯ MYSQL СТРУКТУРЫ
function getAsset(p, type) {
    // В server.js (MySQL версия) данные лежат прямо в объекте игрока (p.hat, p.shirt),
    // а не во вложенном объекте equipped.
    let itemId = p[type];
    
    // Если пусто или none, проверяем фоллбеки
    if (!itemId || itemId === 'none') {
        if (type === 'face') itemId = 'face_smile';
        else if (type === 'shirt') itemId = 'none_shirt';
        else if (type === 'pants') itemId = 'none_pants';
        else itemId = 'none';
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
    
    // Используем обновленную функцию getAsset
    const pantsData = getAsset(p, 'pants'); 
    const shirtData = getAsset(p, 'shirt');
    const faceData = getAsset(p, 'face'); 
    const hatData = getAsset(p, 'hat');
    
    const pantsColor = pantsData.color || '#2d3436'; 
    const shirtColor = shirtData.color || p.color || '#6c5ce7';
    const displayPantsColor = pantsData.id === 'pants_robot' ? '#000' : pantsColor;

    const s = p.scale || 1;
    const SKIN_COLOR = '#ffccaa';

    ctx.save();
    ctx.translate(p.x + 15, p.y + (60 * s));
    ctx.scale((p.direction || 1) * s, s);

    // --- ЛОГИКА АНИМАЦИИ ---
    let heldItemId = null;
    let isHolding = false;
    let attacking = false;

    if (p === me) {
        const item = myInventory[selectedSlot];
        if (item && item.isActive) { heldItemId = item.id; isHolding = true; }
        if (isSwinging) attacking = true;
    } else {
        if (p.heldItemId) { heldItemId = p.heldItemId; isHolding = true; }
        if (p.isAttacking) attacking = true;
    }

    let legAngle = 0;
    let armAngle = 0;
    if (!p.grounded) { armAngle = (p.dy < 0) ? -2.8 : -2.5; legAngle = 0.5; } 
    else if (p.isMoving) { const c = Math.sin(Date.now() / 100); legAngle = c * 0.6; armAngle = c * 0.6; }

    if (isHolding) { armAngle = -1.5; } 
    if (attacking) {
        const progress = (swingTimer / SWING_DURATION); 
        armAngle = -2.0 + Math.sin(progress * Math.PI) * 3.5;
    }

    // 1. ЗАДНЯЯ РУКА
    ctx.fillStyle = SKIN_COLOR;
    ctx.save(); ctx.translate(6, -45); ctx.rotate(isHolding ? -armAngle : -armAngle); ctx.fillRect(-3, 0, 10, 22); ctx.restore();

    // 2. НОГИ
    ctx.fillStyle = displayPantsColor;
    ctx.save(); ctx.translate(-5, -25); ctx.rotate(p.grounded ? -legAngle : -0.2); ctx.fillRect(-5, 0, 10, 25); ctx.restore();
    ctx.save(); ctx.translate(5, -25); ctx.rotate(p.grounded ? legAngle : 0.4); ctx.fillRect(-5, 0, 10, 25); ctx.restore();
    if (pantsData.svg) drawSvgComponent(ctx, pantsData.svg, -12, -60, 24, 60);

    // 3. ТУЛОВИЩЕ
    ctx.fillStyle = shirtColor;
    ctx.fillRect(-11, -55, 22, 30);
    if (shirtData.svg) drawSvgComponent(ctx, shirtData.svg, -11, -55, 22, 30);

    // 4. ГОЛОВА
    ctx.fillStyle = (faceData.name === 'The Void') ? '#000' : SKIN_COLOR;
    ctx.beginPath(); 
    ctx.roundRect(-13, -82, 26, 27, 8); 
    ctx.fill();
    
    if (faceData.svg) {
        drawSvgComponent(ctx, faceData.svg, -30, -106, 60, 60);
    }

    // 5. ПЕРЕДНЯЯ РУКА
    ctx.fillStyle = SKIN_COLOR;
    ctx.save(); ctx.translate(-6, -45); ctx.rotate(armAngle); ctx.fillRect(-7, 0, 10, 22); 

    // ПРЕДМЕТЫ В РУКАХ
    if (isHolding) {
        ctx.save(); 
        ctx.translate(-5, 18); 
        ctx.rotate(Math.PI / 2); 
        if (heldItemId === 'flashlight') {
            ctx.fillStyle = '#555'; ctx.fillRect(0, -3, 12, 6);
            ctx.fillStyle = '#222'; ctx.fillRect(12, -4, 4, 8); 
            ctx.fillStyle = '#f1c40f'; ctx.fillRect(16, -3, 2, 6); 
        } else if (heldItemId === 'sword') {
            ctx.fillStyle = '#8e44ad'; ctx.fillRect(-5, -2, 10, 4);
            ctx.fillStyle = '#f1c40f'; ctx.fillRect(5, -6, 4, 12);
            ctx.fillStyle = '#bdc3c7'; ctx.fillRect(9, -3, 30, 6);
        }
        ctx.restore();
    }
    ctx.restore();

    // 6. ШАПКА
    if (hatData.svg && hatData.name !== 'None') {
        drawSvgComponent(ctx, hatData.svg, -32, -118, 64, 64);
    }

    ctx.restore();
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

    platforms.forEach(p => {
        ctx.save();
        ctx.globalAlpha = 1 - p.transparency;
        ctx.fillStyle = p.color || '#1e1e29';
        if (p.special === 'spinner') {
            ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
            ctx.rotate(p.angle);
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        } else {
            ctx.fillRect(p.x, p.y, p.w, p.h);
        }
        if (p.text && p.special !== 'spinner') {
            ctx.fillStyle = p.textColor || 'white';
            ctx.font = `bold ${p.textSize || 20}px "${p.font || 'Arial'}"`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(p.text, p.x + p.w / 2, p.y + p.h / 2);
        }
        if (p.type === 'spawn') { ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.strokeRect(p.x, p.y, p.w, p.h); }
        ctx.restore(); ctx.globalAlpha = 1;
    });

    for (let id in players) {
        let p = (id === socket.id && me) ? me : players[id];
        drawAvatar(ctx, p);
        if (!p.dead) {
            ctx.fillStyle = 'white'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center';
            ctx.fillText(p.username, p.x + 15, p.y - 95);
            
            if (p !== me && p.hp < 100) {
                ctx.fillStyle = 'red'; ctx.fillRect(p.x - 5, p.y - 110, 40, 5);
                ctx.fillStyle = '#2ecc71'; ctx.fillRect(p.x - 5, p.y - 110, 40 * (p.hp/100), 5);
            }
        }
    }
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update(); particles[i].draw(ctx);
        if (particles[i].life <= 0) particles.splice(i, 1);
    }
    ctx.restore();

    if (me && myInventory.length > 0) {
        const item = myInventory[selectedSlot];
        if (item && item.id === 'flashlight' && item.isActive) {
            lightCanvas.width = canvas.width; lightCanvas.height = canvas.height;
            lightCtx.clearRect(0, 0, canvas.width, canvas.height);
            lightCtx.fillStyle = 'rgba(0, 0, 0, 0.95)';
            lightCtx.fillRect(0, 0, canvas.width, canvas.height);
            lightCtx.globalCompositeOperation = 'destination-out';
            const screenX = (me.x + 15) - cameraX; const screenY = (me.y + 30) - cameraY;
            const rad = lightCtx.createRadialGradient(screenX, screenY, 10, screenX, screenY, 600);
            rad.addColorStop(0, 'rgba(0,0,0,1)'); rad.addColorStop(1, 'rgba(0,0,0,0)'); 
            lightCtx.fillStyle = rad; lightCtx.beginPath(); lightCtx.moveTo(screenX, screenY);
            if (me.direction === 1) lightCtx.arc(screenX, screenY, 600, -0.5, 0.5); else lightCtx.arc(screenX, screenY, 600, Math.PI - 0.5, Math.PI + 0.5);
            lightCtx.lineTo(screenX, screenY); lightCtx.fill();
            lightCtx.beginPath(); lightCtx.arc(screenX, screenY, 80, 0, Math.PI * 2); lightCtx.fill();
            ctx.drawImage(lightCanvas, 0, 0);
        }
    }

    if (isSwinging) {
        swingTimer++;
        if (swingTimer > SWING_DURATION) {
            isSwinging = false;
            swingTimer = 0;
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

// КЛИК
window.addEventListener('mousedown', (e) => {
    if (e.target.closest('.hotbar-container') || e.target.closest('.chat-wrapper') || e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
    
    if (myInventory && myInventory[selectedSlot]) {
        const item = myInventory[selectedSlot];
        
        // УДАР МЕЧОМ
        if (item.id === 'sword') {
            const now = Date.now();
            if (now - lastAttackTime > ATTACK_COOLDOWN) {
                lastAttackTime = now;
                isSwinging = true; 
                swingTimer = 0;
                
                for (let id in players) {
                    if (id === socket.id || players[id].dead) continue;
                    const p = players[id];
                    const dist = Math.sqrt((me.x - p.x)**2 + (me.y - p.y)**2);
                    if (dist < 60) {
                        const dirToEnemy = (p.x > me.x) ? 1 : -1;
                        if (dirToEnemy === me.direction) {
                            socket.emit('damage_player', id);
                            createExplosion(p.x+15, p.y+30, '#fff'); 
                        }
                    }
                }
            }
        }
        // ИНСТРУМЕНТЫ
        else if (item.type === 'tool') {
            item.isActive = !item.isActive;
            updateInventoryUI();
        }
    }
});

window.addEventListener('wheel', (e) => {
    if (e.deltaY > 0) selectedSlot = (selectedSlot + 1) % MAX_SLOTS;
    else selectedSlot = (selectedSlot - 1 + MAX_SLOTS) % MAX_SLOTS;
    updateInventoryUI();
});

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
            if (item.isActive && item.id !== 'sword') div.innerHTML += `<div class="item-active-indicator" style="display:block"></div>`;
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

// CHAT
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
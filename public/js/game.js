const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI
const hpFill = document.getElementById('hpFill');
const hpText = document.getElementById('hpText');
const hotbarContainer = document.getElementById('hotbar');

// --- НАСТРОЙКИ ---
const urlParams = new URLSearchParams(window.location.search);
const gameId = urlParams.get('id') || "game1";
const WORLD_FLOOR_LIMIT = 2000;
const INTERPOLATION_FACTOR = 0.2; // Плавность движения врагов

// --- БАЗА АССЕТОВ ---
const ASSETS_DB = {
    'face_smile': { svg: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>', color: null },
    'face_angry': { svg: '<circle cx="12" cy="12" r="10"/><path d="M8 16s1.5-1 4-1 4 1 4 1"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/><path d="M7.5 8L10 9M16.5 8L14 9"/>', color: null },
    'hat_halo': { svg: '<ellipse cx="12" cy="12" rx="10" ry="3" fill="none" stroke="#f1c40f" stroke-width="2"/>', color: null },
    'hat_wings': { svg: '<path d="M12 12c-2-4-8-4-8 2 0 4 6 6 8 0 2 6 8 4 8 0 0-6-6-6-8-2z" fill="#a29bfe"/>', color: null },
    'hat_crown': { svg: '<path d="M2 18h20v2H2v-2zm0-2l4-8 4 6 4-6 4 8H2z" fill="#f1c40f"/>', color: null },
    'none': { svg: '', color: null },
    'none_shirt': { color: '#6c5ce7' },
    'none_pants': { color: '#2d3436' }
};
if (window.GAME_ASSETS) Object.assign(ASSETS_DB, window.GAME_ASSETS);

// --- ПЕРЕМЕННЫЕ ---
let me = null;
let players = {};
let platforms = [];
let inputs = { left: false, right: false, jump: false };
let particles = [];
let cameraX = 0, cameraY = 0;
let myInventory = []; 
let selectedSlot = 0; 
const MAX_SLOTS = 3;

// --- БОЕВАЯ СИСТЕМА ---
let isSwinging = false; 
let swingTimer = 0;
const SWING_DURATION = 12; // Скорость взмаха (меньше = быстрее)
let lastAttackTime = 0;
const ATTACK_COOLDOWN = 400; 

// --- АВТОРИЗАЦИЯ ---
const storedUser = localStorage.getItem('tublox_user');
if (!storedUser) { window.location.href = 'login.html'; }
const currentUser = JSON.parse(storedUser);

socket.emit('join_game', { gameId, username: currentUser.username });

// --- СЕТЕВЫЕ СОБЫТИЯ ---
socket.on('init_game', (data) => {
    players = {};
    if (data.players) { for (let id in data.players) handlePlayerUpdate(id, data.players[id]); }
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
        platforms = [{ x: -1000, y: 600, w: 5000, h: 100, color: '#1e1e29', type: 'baseplate', collide: true, anchored: true }];
    }
    if (!me || !me.dead) respawnPlayer();
});

socket.on('player_spawn', (p) => handlePlayerUpdate(p.id, p));
socket.on('player_update', (p) => { if (p.id !== socket.id) handlePlayerUpdate(p.id, p); });
socket.on('player_leave', (id) => delete players[id]);
socket.on('player_died_anim', (id) => { 
    if (players[id]) { 
        players[id].dead = true; 
        createExplosion(players[id].x + 15, players[id].y + 30, players[id].color || '#fff', 30); 
    } 
});
socket.on('player_respawned', (data) => {
    if (players[data.id]) {
        const p = players[data.id]; p.dead = false; p.x = data.x; p.y = data.y; p.targetX = data.x; p.targetY = data.y;
        p.dy = 0; p.grounded = false; p.heldItemId = null;
        if (data.id === socket.id) { me.hp = 100; updateHpUI(100); }
    }
});
socket.on('player_hp_update', (data) => {
    if (players[data.id]) {
        players[data.id].hp = data.hp;
        if (data.id === socket.id) { 
            me.hp = data.hp; updateHpUI(data.hp); 
            createExplosion(me.x + 15, me.y + 30, '#ff0000', 10); 
            if (me.hp <= 0 && !me.dead) die(); 
        }
    }
});

// --- ЛОГИКА ---
function handlePlayerUpdate(id, data) {
    if (!players[id]) players[id] = { ...data, targetX: data.x, targetY: data.y };
    else { 
        const p = players[id]; 
        const { x, y, ...rest } = data; 
        Object.assign(p, rest); 
        p.targetX = x; 
        p.targetY = y; 
    }
}

function updateHpUI(hp) { if (hpFill) hpFill.style.width = Math.max(0, hp) + '%'; if (hpText) hpText.innerText = Math.ceil(Math.max(0, hp)) + ' / 100'; }

function respawnPlayer() {
    if (!me) return;
    const spawn = platforms.find(p => p.type === 'spawn') || { x: 100, y: 500, w: 30 };
    me.x = spawn.x + (spawn.w / 2) - 15; me.y = spawn.y - 70; me.dy = 0; me.dead = false; me.hp = 100; updateHpUI(100);
    me.speed = 6; me.jumpPower = 15; me.scale = 1; myInventory = []; selectedSlot = 0; updateInventoryUI();
}

function die() { 
    if (!me || me.dead) return; 
    me.dead = true; 
    socket.emit('player_die'); 
    setTimeout(() => { respawnPlayer(); socket.emit('player_respawn'); }, 2000); 
}

function checkCollision(r1, r2) { return r1.x < r2.x + r2.w && r1.x + r1.w > r2.x && r1.y < r2.y + r2.h && r1.y + r1.h > r2.y; }
function checkSpinnerCollision(p, s) { const cx = s.x + s.w / 2, cy = s.y + s.h / 2, px = p.x + p.w / 2, py = p.y + p.h / 2; return Math.sqrt((cx-px)**2 + (cy-py)**2) < (s.w / 2); }

function updatePhysics() {
    const time = Date.now() / 1000;
    
    platforms.forEach(obj => {
        if (obj.anchored) {
            if (obj.special === 'mover') {
                const wave = (Math.sin(time * obj.moveSpeed + obj.timeOffset) + 1) / 2;
                obj.x = obj.orgX + (wave * obj.rangeX); obj.y = obj.orgY + (wave * obj.rangeY);
                obj.currentDx = obj.x - (obj.prevX || obj.x); obj.currentDy = obj.y - (obj.prevY || obj.y);
                obj.prevX = obj.x; obj.prevY = obj.y;
            } else if (obj.special === 'spinner') obj.angle += obj.spinSpeed * 0.05;
            return;
        }
        obj.dy = (obj.dy || 0) + 0.5; let nextY = obj.y + obj.dy;
        if (obj.collide !== false) {
            let landed = false;
            for (let other of platforms) {
                if (obj === other || !other.collide) continue;
                if (obj.x < other.x + other.w && obj.x + obj.w > other.x && obj.y + obj.h <= other.y + 10 && nextY + obj.h >= other.y) {
                    obj.y = other.y - obj.h; obj.dy = 0; landed = true; break;
                }
            }
            if (!landed) obj.y = nextY;
        } else obj.y = nextY;
        if (obj.y > WORLD_FLOOR_LIMIT + 500) { obj.anchored = true; obj.dy = 0; }
    });

    for (let id in players) {
        if (id === socket.id) continue;
        const p = players[id]; if (p.dead) continue;
        if (p.targetX !== undefined) { 
            p.x += (p.targetX - p.x) * INTERPOLATION_FACTOR; 
            p.y += (p.targetY - p.y) * INTERPOLATION_FACTOR; 
        }
    }

    if (!me || me.dead) return;
    if (!me.speed) me.speed = 6; if (!me.jumpPower) me.jumpPower = 15; if (!me.scale) me.scale = 1;
    const pW = 20 * me.scale, pH = 60 * me.scale, hX = 15 - (pW / 2);
    let moved = false; me.isMoving = false; let dx = 0;
    
    if (inputs.left) { dx = -me.speed; me.direction = -1; me.isMoving = true; }
    if (inputs.right) { dx = me.speed; me.direction = 1; me.isMoving = true; }
    if (dx !== 0) {
        me.x += dx; moved = true;
        const hitboxX = { x: me.x + hX, y: me.y, w: pW, h: pH };
        platforms.forEach(p => { if (!p.collide || p.special === 'spinner') return; if (checkCollision(hitboxX, p)) { if (dx > 0) me.x = p.x - hX - pW; else me.x = p.x + p.w - hX; } });
    }

    me.dy = (me.dy || 0) + 0.8; me.y += me.dy; me.grounded = false;
    const hitboxY = { x: me.x + hX, y: me.y, w: pW, h: pH };
    
    platforms.forEach(p => {
        if (p.special === 'spinner' && checkSpinnerCollision(hitboxY, p)) die();
        if (checkCollision(hitboxY, p)) {
            if (p.special === 'kill') die();
            else if (p.special === 'speed_up') me.speed = Number(p.customSpeed) || 16;
            else if (p.special === 'jump_boost') me.jumpPower = Number(p.customJump) || 30;
            else if (p.special === 'big_player') me.scale = Number(p.customScale) || 2.0;
            else if (p.special === 'small_player') me.scale = Number(p.customScale) || 0.5;
            else if (p.special === 'normal_player') { me.scale = 1; me.speed = 6; me.jumpPower = 15; }
            else if (p.special === 'teleport') { const t = platforms.find(o => o.id === p.target || (o.special === 'teleport' && o !== p)); if (t) { me.x = t.x + t.w/2 - 15; me.y = t.y - 70; me.dy = 0; } }
            else if ((p.special === 'flashlight' || p.special === 'sword') && !myInventory.find(i => i.id === p.special) && myInventory.length < MAX_SLOTS) {
                myInventory.push({ id: p.special, name: p.special, icon: p.special==='sword'?'⚔️':'🔦', isActive: true, type: 'tool' }); updateInventoryUI();
            }
        }
        if (!p.collide) return;
        if (checkCollision(hitboxY, p)) {
            if (me.dy > 0 && me.y - me.dy + pH <= p.y + 20) {
                me.y = p.y - pH; me.dy = 0; me.grounded = true;
                if (p.special === 'mover') { me.x += p.currentDx; me.y += p.currentDy; if (Math.abs(p.currentDx) > 0.1) moved = true; }
            } else if (me.dy < 0) { me.y = p.y + p.h; me.dy = 0; }
        }
    });

    if (inputs.jump && me.grounded) { me.dy = -me.jumpPower; me.grounded = false; moved = true; }
    if (me.y > WORLD_FLOOR_LIMIT) die();

    const curItem = myInventory[selectedSlot];
    const itemToSend = (curItem && curItem.isActive) ? curItem.id : null;
    const atk = isSwinging ? 1 : 0;
    
    // Синхронизация
    if (moved || me.dy !== 0 || me.grounded !== (me.prevGrounded||false) || (me.lastItem||null) !== itemToSend || (me.lastAtk||0) !== atk) {
        me.prevGrounded = me.grounded; me.lastItem = itemToSend; me.lastAtk = atk;
        socket.emit('player_input', { 
            x: Math.round(me.x), 
            y: Math.round(me.y), 
            direction: me.direction, 
            isMoving: me.isMoving, 
            grounded: me.grounded, 
            scale: me.scale, 
            heldItemId: itemToSend, 
            isAttacking: isSwinging // ОТПРАВЛЯЕМ СТАТУС АТАКИ
        });
    }
}

// --- ГРАФИКА ---
const svgCache = {};
function getAsset(p, type) {
    let id = p[type];
    if (!id || id === 'none') {
        if (type === 'face') id = 'face_smile';
        else if (type === 'shirt') id = 'none_shirt';
        else if (type === 'pants') id = 'none_pants';
        else id = 'none';
    }
    return ASSETS_DB[id] || { svg: '', color: null };
}

function drawSvgComponent(ctx, svgContent, x, y, w, h) {
    if (!svgContent) return;
    if (!svgCache[svgContent]) {
        const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${w}" height="${h}" stroke="black" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${svgContent}</svg>`;
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
    const pantsData = getAsset(p, 'pants'); const shirtData = getAsset(p, 'shirt');
    const faceData = getAsset(p, 'face'); const hatData = getAsset(p, 'hat');
    const s = p.scale || 1;
    
    // Статус
    const isHolding = (p === me && myInventory[selectedSlot]?.isActive) || (p !== me && p.heldItemId);
    const heldId = (p === me) ? myInventory[selectedSlot]?.id : p.heldItemId;
    
    // Анимация удара
    let isAttacking = false;
    if (p === me) isAttacking = isSwinging;
    else isAttacking = p.isAttacking;

    ctx.save();
    ctx.translate(p.x + 15, p.y + (60 * s));
    ctx.scale((p.direction || 1) * s, s);

    let anim = (p.isMoving && p.grounded) ? Math.sin(Date.now()/100)*0.6 : (!p.grounded ? 0.4 : 0);
    
    // --- ИСПРАВЛЕНА МАТЕМАТИКА АТАКИ ---
    let armAnim = anim;
    if (isHolding) armAnim = -1.5; // Поднятая рука
    if (isAttacking) {
        // Взмах сверху (-2.0) вниз (0.5)
        // Для других игроков таймер примерный, используем синус
        if (p !== me) {
            armAnim = -2.0 + Math.abs(Math.sin(Date.now()/50)) * 2.5; 
        } else {
            // Для себя используем точный таймер
            const progress = swingTimer / SWING_DURATION; 
            armAnim = -2.5 + (progress * 3.0); // Линейный удар
        }
    }

    // 1. ЗАДНЯЯ РУКА
    ctx.fillStyle = '#ffccaa'; ctx.save(); ctx.translate(6, -38); ctx.rotate(-anim); ctx.fillRect(-4, 0, 8, 20); ctx.restore();
    // 2. ЗАДНЯЯ НОГА
    ctx.fillStyle = pantsData.color || '#2d3436'; ctx.save(); ctx.translate(3, -20); ctx.rotate(anim); ctx.fillRect(-4, 0, 8, 20); ctx.restore();
    // 3. ТЕЛО
    ctx.fillStyle = shirtData.color || p.color || '#6c5ce7'; ctx.fillRect(-10, -40, 20, 20);
    // 4. ГОЛОВА
    ctx.fillStyle = '#ffccaa'; ctx.beginPath(); ctx.roundRect(-10, -62, 20, 20, 4); ctx.fill();
    // ЛИЦО
    if (faceData.svg) drawSvgComponent(ctx, faceData.svg, -10, -62, 20, 20);
    // 5. АКСЕССУАРЫ
    if (hatData.svg && hatData.name !== 'None') drawSvgComponent(ctx, hatData.svg, -20, -75, 40, 40);

    // 6. ПЕРЕДНЯЯ НОГА
    ctx.fillStyle = pantsData.color || '#2d3436'; ctx.save(); ctx.translate(-3, -20); ctx.rotate(-anim); ctx.fillRect(-4, 0, 8, 20); ctx.restore();
    
    // 7. ПЕРЕДНЯЯ РУКА (С МЕЧОМ)
    ctx.fillStyle = '#ffccaa'; ctx.save(); 
    ctx.translate(-6, -38); 
    ctx.rotate(armAnim); 
    ctx.fillRect(-4, 0, 8, 20);
    
    // ПРЕДМЕТ
    if (isHolding) {
        ctx.translate(0, 18); ctx.rotate(Math.PI/2);
        if (heldId === 'flashlight') { 
            ctx.fillStyle='#333'; ctx.fillRect(0,-3,10,6); ctx.fillStyle='#f1c40f'; ctx.fillRect(10,-3,2,6); 
        } else if (heldId === 'sword') { 
            ctx.fillStyle='#555'; ctx.fillRect(-4,-2,8,4); 
            ctx.fillStyle='#bdc3c7'; ctx.fillRect(4,-2,25,4); // Меч
        }
    }
    ctx.restore();
    ctx.restore();
}

function render() {
    if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    if (me) { cameraX += (me.x - canvas.width/2 - cameraX)*0.1; cameraY += (me.y - canvas.height/2 + 100 - cameraY)*0.1; }
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // ПРОСТОЙ ФОН БЕЗ ШЕЙДЕРОВ
    ctx.fillStyle = "#1e1e29"; 
    ctx.fillRect(0,0,canvas.width, canvas.height);

    ctx.save(); ctx.translate(-cameraX, -cameraY);

    platforms.forEach(p => {
        ctx.save(); ctx.globalAlpha = 1 - p.transparency; 
        ctx.fillStyle = p.color || '#1e1e29';
        
        if (p.special === 'spinner') { ctx.translate(p.x+p.w/2, p.y+p.h/2); ctx.rotate(p.angle); ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h); }
        else ctx.fillRect(p.x, p.y, p.w, p.h);
        
        if (p.text && p.special !== 'spinner') {
            ctx.fillStyle = p.textColor || 'white'; ctx.font = `bold ${p.textSize}px Arial`; ctx.textAlign='center'; ctx.textBaseline='middle';
            ctx.fillText(p.text, p.x + p.w/2, p.y + p.h/2);
        }
        if (p.type === 'spawn') { ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth=2; ctx.strokeRect(p.x, p.y, p.w, p.h); }
        ctx.restore();
    });

    for (let id in players) {
        let p = (id === socket.id) ? me : players[id];
        drawAvatar(ctx, p);
        if (!p.dead) {
            ctx.fillStyle = 'white'; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center'; ctx.fillText(p.username, p.x + 15, p.y - 100 * (p.scale||1));
            if (p !== me && p.hp < 100) { ctx.fillStyle='red'; ctx.fillRect(p.x, p.y-115, 30, 4); ctx.fillStyle='#2ecc71'; ctx.fillRect(p.x, p.y-115, 30*(p.hp/100), 4); }
        }
    }
    
    for (let i=particles.length-1; i>=0; i--) { particles[i].update(); particles[i].draw(ctx); if (particles[i].life <= 0) particles.splice(i, 1); }
    ctx.restore();

    // ОБНОВЛЕНИЕ ТАЙМЕРА АТАКИ
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
    if (e.code==='KeyA'||e.code==='ArrowLeft') inputs.left=true; if (e.code==='KeyD'||e.code==='ArrowRight') inputs.right=true; if (e.code==='Space'||e.code==='ArrowUp') inputs.jump=true;
    if (['1','2','3'].includes(e.key)) { selectedSlot = parseInt(e.key)-1; updateInventoryUI(); }
});
window.addEventListener('keyup', e => { if (e.code==='KeyA'||e.code==='ArrowLeft') inputs.left=false; if (e.code==='KeyD'||e.code==='ArrowRight') inputs.right=false; if (e.code==='Space'||e.code==='ArrowUp') inputs.jump=false; });

// АТАКА МЕЧОМ
window.addEventListener('mousedown', e => {
    if (e.target.closest('.hotbar-container')||e.target.closest('.chat-wrapper')||e.target.tagName==='BUTTON'||e.target.tagName==='INPUT') return;
    const item = myInventory[selectedSlot];
    
    if (item?.id === 'sword') {
        if (Date.now() - lastAttackTime > ATTACK_COOLDOWN) {
            lastAttackTime = Date.now(); 
            isSwinging = true; 
            swingTimer = 0;
            
            // Логика урона
            for (let id in players) {
                if (id === socket.id || players[id].dead) continue;
                const p = players[id];
                const dist = Math.sqrt((me.x - p.x)**2 + (me.y - p.y)**2);
                if (dist < 80) { // Дальность
                    const dirToEnemy = (p.x > me.x) ? 1 : -1;
                    if (me.direction === undefined) me.direction = 1;
                    if (dirToEnemy === me.direction) { 
                        socket.emit('damage_player', id); 
                        createExplosion(p.x+15, p.y+30, '#fff', 5); 
                    }
                }
            }
        }
    } else if (item?.type === 'tool') { item.isActive = !item.isActive; updateInventoryUI(); }
});
window.addEventListener('wheel', e => { selectedSlot = (selectedSlot + (e.deltaY>0?1:-1) + MAX_SLOTS) % MAX_SLOTS; updateInventoryUI(); });

function updateInventoryUI() {
    hotbarContainer.innerHTML = '';
    for (let i=0; i<MAX_SLOTS; i++) {
        const d = document.createElement('div'); d.className = `slot ${i===selectedSlot?'selected':''}`;
        d.innerHTML = myInventory[i] ? `<span class="slot-number">${i+1}</span> ${myInventory[i].icon}${myInventory[i].isActive && myInventory[i].id!=='sword'?'<div class="item-active-indicator" style="display:block"></div>':''}` : `<span class="slot-number">${i+1}</span>`;
        d.onclick=()=>{selectedSlot=i;updateInventoryUI();}; hotbarContainer.appendChild(d);
    }
}
function createExplosion(x,y,c, count) { for(let i=0;i<count;i++) particles.push({x,y,c,vx:(Math.random()-0.5)*10,vy:(Math.random()-0.5)*10,life:1,update(){this.x+=this.vx;this.y+=this.vy;this.vy+=0.2;this.life-=0.05},draw(ctx){ctx.globalAlpha=this.life;ctx.fillStyle=this.c;ctx.fillRect(this.x,this.y,4,4);ctx.globalAlpha=1}}); }

const chatInput = document.getElementById('chatInput'), chatBtn = document.getElementById('chatSendBtn'), msgsDiv = document.getElementById('msgs');
function sendMessage() { const t = chatInput.value.trim(); if(t) { socket.emit('send_msg', t); chatInput.value=''; chatInput.blur(); } }
if(chatBtn) chatBtn.onclick=sendMessage; if(chatInput) chatInput.onkeydown=e=>{if(e.key==='Enter')sendMessage()};
socket.on('new_msg', d => { const div=document.createElement('div'); div.innerHTML=`<b>${d.user}:</b> ${d.text}`; msgsDiv.appendChild(div); msgsDiv.scrollTop=msgsDiv.scrollHeight; });

// --- МОБИЛЬНОЕ УПРАВЛЕНИЕ ---
function setupMobileControls() {
    // Проверка на мобилку или маленький экран
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 850;

    if (isMobile) {
        document.getElementById('mobileControls').style.display = 'flex';
        
        // Функция привязки событий (Touch)
        const bindBtn = (id, key) => {
            const btn = document.getElementById(id);
            // touchstart - нажали
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault(); // Чтобы не выделяло текст и не скроллило
                inputs[key] = true;
                btn.style.background = 'rgba(255, 255, 255, 0.3)';
            }, { passive: false });
            
            // touchend - отпустили
            btn.addEventListener('touchend', (e) => {
                e.preventDefault();
                inputs[key] = false;
                btn.style.background = 'rgba(255, 255, 255, 0.1)';
            }, { passive: false });
        };

        bindBtn('btnL', 'left');
        bindBtn('btnR', 'right');
        bindBtn('btnJ', 'jump');
    }
}

// Запускаем настройку управления
setupMobileControls();

updateInventoryUI();
render();
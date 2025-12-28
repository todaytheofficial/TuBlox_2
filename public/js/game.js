const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Получаем ID игры
const urlParams = new URLSearchParams(window.location.search);
const gameId = urlParams.get('id') || "game1";

// --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ---
let me = null;
let players = {};
let inputs = { left: false, right: false, jump: false };
let lastSentState = { x: 0, y: 0, isMoving: false, grounded: true }; // Оптимизация отправки
let particles = []; 

// МИР
const WORLD_FLOOR = 600;
let cameraX = 0;
let cameraY = 0;

const platforms = [
    { x: -2000, y: WORLD_FLOOR, w: 10000, h: 100 }, 
    { x: 300, y: WORLD_FLOOR - 150, w: 200, h: 20 },
    { x: 600, y: WORLD_FLOOR - 300, w: 200, h: 20 },
    { x: 900, y: WORLD_FLOOR - 450, w: 100, h: 20 },
    { x: 100, y: WORLD_FLOOR - 250, w: 100, h: 20 },
    { x: 1300, y: WORLD_FLOOR - 400, w: 150, h: 20 },
];

// --- 1. АВТОРИЗАЦИЯ И ВХОД ---
const storedUser = localStorage.getItem('tublox_user');
if (!storedUser) { window.location.href = 'login.html'; }
const currentUser = JSON.parse(storedUser);

let uid = localStorage.getItem('tublox_uid');
if (!uid) {
    uid = 'u_' + Date.now() + Math.random().toString(36).substr(2, 5);
    localStorage.setItem('tublox_uid', uid);
}

socket.emit('join_game', { 
    gameId, 
    username: currentUser.username,
    userData: { id: uid } 
});

// --- 2. СЕТЕВЫЕ СОБЫТИЯ ---
socket.on('init_game', (p) => { players = p; me = players[socket.id]; });
socket.on('player_spawn', (p) => { players[p.id] = p; });

socket.on('player_update', (p) => { 
    if (players[p.id] && p.id !== socket.id) {
        if (!players[p.id].dead) {
            Object.assign(players[p.id], p);
        }
    }
});

socket.on('player_leave', (id) => { delete players[id]; });
socket.on('force_disconnect', (msg) => { alert(msg); window.location.href = 'index.html'; });

// Смерть и Респаун
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

// Чат
const chatInput = document.getElementById('chatInput');
const msgsBox = document.getElementById('msgs');
const sendChat = () => {
    if (chatInput.value.trim()) {
        socket.emit('send_message', chatInput.value);
        chatInput.value = '';
    }
};
if (document.getElementById('chatSendBtn')) document.getElementById('chatSendBtn').onclick = sendChat;
if (chatInput) chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });

socket.on('chat_message', (msg) => {
    const el = document.createElement('div');
    el.innerHTML = `<span style="color:${msg.color || '#a29bfe'}; font-weight:700;">${msg.username}:</span> ${msg.text}`;
    msgsBox.appendChild(el);
    msgsBox.scrollTop = msgsBox.scrollHeight;
});

// --- 3. ЧАСТИЦЫ ---
class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y; this.color = color;
        this.size = Math.random() * 8 + 4;
        this.vx = (Math.random() - 0.5) * 12;
        this.vy = (Math.random() - 0.5) * 12 - 5;
        this.life = 1.0;
    }
    update() {
        this.x += this.vx; this.y += this.vy; this.vy += 0.5; this.life -= 0.02;
    }
    draw(ctx) {
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.globalAlpha = 1.0;
    }
}
function createExplosion(x, y, color) {
    for (let i = 0; i < 20; i++) {
        particles.push(new Particle(x, y, color));
        particles.push(new Particle(x, y, '#ffccaa'));
    }
}

// --- 4. ФИЗИКА ---
window.addEventListener('blur', () => {
    inputs = { left: false, right: false, jump: false };
    if (me && !me.dead) {
        me.isMoving = false;
        socket.emit('player_input', { x: me.x, y: me.y, direction: me.direction, isMoving: false, grounded: true });
    }
});

function die() {
    if (me.dead) return;
    me.dead = true;
    socket.emit('player_die');
    setTimeout(() => { socket.emit('player_respawn'); }, 3000);
}
window.resetCharacterLocal = function() { if (me && !me.dead) die(); }

function updatePhysics() {
    if (!me || me.dead) return;

    let moved = false;
    me.isMoving = false;

    if (inputs.left) { me.x -= 6; me.direction = -1; me.isMoving = true; moved = true; }
    if (inputs.right) { me.x += 6; me.direction = 1; me.isMoving = true; moved = true; }
    if (inputs.jump && me.grounded) { me.dy = -14; me.grounded = false; moved = true; }

    me.dy = (me.dy || 0) + 0.7;
    me.y += me.dy;
    me.grounded = false; // Сбрасываем, проверим ниже

    platforms.forEach(p => {
        if (me.x < p.x + p.w && me.x + 30 > p.x && me.y + 60 > p.y && me.y + 60 < p.y + p.h + 20 && me.dy > 0) {
            me.y = p.y - 60; me.dy = 0; me.grounded = true;
        }
    });

    if (me.y > WORLD_FLOOR + 500) die();

    // Отправляем данные, если что-то изменилось (позиция, движение или статус прыжка)
    // Добавили grounded в отправку, чтобы другие видели анимацию прыжка
    if (moved || !me.grounded || me.isMoving !== lastSentState.isMoving || me.grounded !== lastSentState.grounded) {
        socket.emit('player_input', { 
            x: me.x, 
            y: me.y, 
            direction: me.direction, 
            isMoving: me.isMoving,
            grounded: me.grounded // ВАЖНО: Отправляем статус "на земле"
        });
        
        lastSentState = { 
            x: me.x, y: me.y, 
            isMoving: me.isMoving, 
            grounded: me.grounded 
        };
    }
}

function drawAvatar(ctx, p) {
    if (!p) return;
    if (p.dead) return; // Если мертв, не рисуем тело

    ctx.save();
    
    // Центр игрока
    ctx.translate(p.x + 15, p.y + 60); // Центр ног (низ)
    
    // Зеркалирование направления
    ctx.scale(p.direction, 1); 

    // --- ЛОГИКА АНИМАЦИИ ---
    let legAngle = 0;
    let armAngle = 0; // Угол рук (0 - вниз)

    if (!p.grounded) {
        // --- АНИМАЦИЯ ПРЫЖКА (Руки вверх!) ---
        // Если летим вверх (p.dy < 0) или висим в пике - руки подняты
        // -Math.PI = руки полностью вверх. -2.8 - чуть в стороны (как V)
        
        // Плавный переход: если dy маленький (пик прыжка), руки максимально высоко
        if (p.dy < 0) {
            armAngle = -2.8; // Резко вверх при прыжке
        } else {
            armAngle = -2.5; // Чуть шире при падении (парашютик)
        }
        
        // Ноги в прыжке чуть поджаты или одна вперед
        legAngle = 0.5; 

    } else if (p.isMoving) {
        // --- ХОДЬБА ---
        const walkCycle = Math.sin(Date.now() / 100);
        legAngle = walkCycle * 0.6;
        armAngle = walkCycle * 0.6; // Машем руками при ходьбе
    } else {
        // --- СТОИМ ---
        legAngle = 0;
        armAngle = 0; // Руки по швам
    }

    const skin = '#ffccaa';

    // 1. Нога задняя
    ctx.fillStyle = '#222';
    ctx.save(); 
    ctx.translate(0, -25); // Точка вращения бедра
    ctx.rotate(p.grounded ? -legAngle : -0.2); // Если прыгаем, ноги статичны
    ctx.fillRect(-6, 0, 12, 25); 
    ctx.restore();

    // 2. Нога передняя
    ctx.save(); 
    ctx.translate(0, -25); 
    ctx.rotate(p.grounded ? legAngle : 0.4); 
    ctx.fillRect(-6, 0, 12, 25); 
    ctx.restore();

    // 3. Рука задняя (Вращаем от плеча)
    ctx.fillStyle = skin;
    ctx.save(); 
    ctx.translate(0, -45); // Точка плеча
    ctx.rotate(p.grounded ? -armAngle : armAngle); // В прыжке обе руки вверх (armAngle)
    ctx.fillRect(-6, 0, 12, 22); 
    ctx.restore();

    // 4. Торс (Тело прямое, не крутится)
    ctx.fillStyle = p.color;
    ctx.fillRect(-11, -55, 22, 30);

    // 5. Голова
    ctx.fillStyle = skin;
    ctx.beginPath(); 
    ctx.roundRect(-12, -80, 24, 25, 6); 
    ctx.fill();

    // --- ЛИЦА ---
    ctx.fillStyle = '#111';
    if(p.face === 'face_cool') {
        ctx.fillStyle = 'black'; ctx.fillRect(-9, -72, 18, 6); 
        ctx.fillStyle = 'white'; ctx.fillRect(-7, -70, 4, 2); 
    } else if (p.face === 'face_sad') {
        ctx.fillRect(2, -72, 3, 5); ctx.fillRect(10, -72, 3, 5);
        ctx.beginPath(); ctx.arc(7, -62, 4, 3.4, 6); ctx.stroke();
    } else if (p.face === 'face_tilde') {
        ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-8, -72); ctx.quadraticCurveTo(-7, -75, -4, -72); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(4, -72); ctx.quadraticCurveTo(7, -75, 8, -72); ctx.stroke();
        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0, -66, 2, 0, Math.PI*2); ctx.fill();
    } else {
        ctx.fillRect(2, -72, 3, 5); ctx.fillRect(10, -72, 3, 5);
        ctx.beginPath(); ctx.arc(7, -66, 4, 0.2, Math.PI - 0.2); ctx.stroke();
    }

    // --- ШЛЯПЫ ---
    if(p.hat === 'hat_top') {
        ctx.fillStyle = 'blue'; ctx.beginPath(); ctx.arc(0, -82, 14, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#0000cc'; ctx.fillRect(-14, -82, 28, 4);
    } else if (p.hat === 'hat_cap') {
        ctx.fillStyle = '#d63031'; ctx.beginPath(); ctx.arc(0, -80, 13, Math.PI, 0); ctx.fill();
        ctx.fillRect(0, -80, 18, 4);
    } else if (p.hat === 'hat_headphones') {
        ctx.strokeStyle = '#333'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(0, -78, 14, Math.PI, 0); ctx.stroke();
        ctx.fillStyle = 'red'; ctx.fillRect(-16, -80, 6, 12); ctx.fillRect(10, -80, 6, 12);
    } else if (p.hat === 'hat_teapot') {
        ctx.fillStyle = '#f0f0f0'; ctx.beginPath(); ctx.arc(0, -90, 14, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#f0f0f0'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(10, -90); ctx.quadraticCurveTo(22, -100, 14, -80); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-10, -90); ctx.lineTo(-20, -98); ctx.stroke();
        ctx.fillStyle = '#ff7675'; ctx.fillRect(-3, -107, 6, 4);
    }

    // 6. Рука передняя
    ctx.fillStyle = skin;
    ctx.save(); 
    ctx.translate(0, -45); // Плечо
    ctx.rotate(p.grounded ? armAngle : armAngle); // В прыжке так же вверх
    ctx.fillRect(-6, 0, 12, 22); 
    ctx.restore();

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
        ctx.fillStyle = '#1e1e29'; ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = '#6c5ce7'; ctx.fillRect(p.x, p.y, p.w, 6);
        ctx.strokeStyle = '#2d2d3a'; ctx.lineWidth = 2; ctx.strokeRect(p.x, p.y, p.w, p.h);
    });

    for (let id in players) {
        let p = (id === socket.id && me) ? me : players[id];
        drawAvatar(ctx, p);
        if (!p.dead) {
            ctx.fillStyle = 'white'; ctx.font = '700 14px "Quicksand", sans-serif';
            ctx.textAlign = 'center'; ctx.shadowColor = "black"; ctx.shadowBlur = 4;
            ctx.fillText(p.username, p.x + 15, p.y - 45); // Ник чуть выше из-за вращения
            ctx.shadowBlur = 0;
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
render();

// Управление
window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') inputs.left = true;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') inputs.right = true;
    if (e.code === 'Space' || e.code === 'ArrowUp') inputs.jump = true;
});
window.addEventListener('keyup', e => {
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') inputs.left = false;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') inputs.right = false;
    if (e.code === 'Space' || e.code === 'ArrowUp') inputs.jump = false;
});
if ('ontouchstart' in window) {
    document.getElementById('mobileControls').style.display = 'flex';
    const t = (id, k) => {
        const el = document.getElementById(id);
        el.addEventListener('touchstart', (e) => { e.preventDefault(); inputs[k] = true; });
        el.addEventListener('touchend', (e) => { e.preventDefault(); inputs[k] = false; });
    };
    t('btnL', 'left'); t('btnR', 'right'); t('btnJ', 'jump');
}
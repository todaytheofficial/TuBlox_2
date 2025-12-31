// ==========================================
// GAME.JS - FULL FINAL VERSION (TYCOON + CONVEYOR + FIXES)
// ==========================================
const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI ELEMENTS
const hpFill = document.getElementById('hpFill');
const hpText = document.getElementById('hpText');
const hotbarContainer = document.getElementById('hotbar');

// --- SETTINGS ---
const urlParams = new URLSearchParams(window.location.search);
const gameId = urlParams.get('id') || "game1";
const WORLD_FLOOR_LIMIT = 3000; // Y limit before death
const INTERPOLATION_FACTOR = 0.2; 

// --- ASSETS ---
const ASSETS_DB = {
    'face_smile': { svg: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>', color: null },
    'hat_halo': { svg: '<ellipse cx="12" cy="12" rx="10" ry="3" fill="none" stroke="#f1c40f" stroke-width="2"/>', color: null },
    'none': { svg: '', color: null },
    'none_shirt': { color: '#6c5ce7' },
    'none_pants': { color: '#2d3436' }
};
if (window.GAME_ASSETS) Object.assign(ASSETS_DB, window.GAME_ASSETS);

// --- VARIABLES ---
let me = null;
let players = {};
let platforms = []; // Active physics objects
let rawMapData = []; // Logic templates (for spawning)
let inputs = { left: false, right: false, jump: false };
let particles = [];
let cameraX = 0, cameraY = 0;
let myInventory = []; 
let selectedSlot = 0; 
const MAX_SLOTS = 3;

// Combat Variables
let isSwinging = false; 
let swingTimer = 0;
const SWING_DURATION = 12; 
let lastAttackTime = 0;
const ATTACK_COOLDOWN = 400; 

// --- AUTHENTICATION ---
const storedUser = localStorage.getItem('tublox_user');
if (!storedUser) { window.location.href = 'login.html'; }
const currentUser = JSON.parse(storedUser);
socket.emit('join_game', { gameId, username: currentUser.username });

// ==========================================
// 1. MAP PARSING (FLATTEN HIERARCHY)
// ==========================================
function flattenMap(objects, parentX = 0, parentY = 0) {
    let flat = [];
    objects.forEach(obj => {
        const absX = parentX + Number(obj.x);
        const absY = parentY + Number(obj.y);
        
        // If it's a Model, recurse into children
        if (obj.type === 'model' || (obj.children && obj.children.length > 0)) {
            flat = flat.concat(flattenMap(obj.children, absX, absY));
        } else {
            // Create physical part
            const p = { ...obj, x: absX, y: absY };
            p.w = Number(p.w);
            p.h = Number(p.h);
            
            // Set defaults if missing
            p.anchored = (p.anchored !== undefined) ? p.anchored : true;
            p.collide = (p.collide !== undefined) ? p.collide : true;
            p.transparency = p.transparency || 0;
            p.name = p.name || "";
            
            // Physics state
            p.dy = 0;
            p.orgX = absX; p.orgY = absY; // For movers
            p.timeOffset = Math.random() * 1000;
            p.lastSpawnTime = 0; // For spawners
            
            flat.push(p);
        }
    });
    return flat;
}

// ==========================================
// 2. LOGIC: SPAWNERS & BUTTONS
// ==========================================
function spawnObject(templateName, x, y, forceAnchored = false) {
    if (!templateName) return;

    // Recursive search for the template by Name
    const findTemplate = (list, name) => {
        for(let o of list) {
            if(o.name && o.name.trim() === name.trim()) return o;
            if(o.children) { const f = findTemplate(o.children, name); if(f) return f; }
        }
        return null;
    };

    const template = findTemplate(rawMapData, templateName);
    
    if(template) {
        // Wrap in array to preserve relative coords for models
        const wrapper = [{ ...template, x:0, y:0, children: template.children }];
        const parts = flattenMap(wrapper, x, y);
        
        parts.forEach(p => {
            p.anchored = forceAnchored; // Set anchored state (False for drops, True for walls)
            p.id = 'spawned_' + Date.now() + Math.random();
            p.dy = 0; // Reset velocity
            
            // FIX: Ensure collision is enabled unless explicitly disabled
            if (p.collide === undefined) p.collide = true;

            // If it's a single part (not model), center it exactly
            if (template.type !== 'model') { p.x = x; p.y = y; }
            
            platforms.push(p);
        });
    }
}

function activateButton(btn) {
    if (btn.isPressed) return;
    
    // Visual Feedback
    btn.isPressed = true;
    const oldColor = btn.color;
    btn.color = '#55efc4'; // Bright green
    
    // Logic
    if (btn.targetName) {
        // Find all objects with Target Name
        const targets = platforms.filter(p => p.name && p.name.trim() === btn.targetName.trim());
        
        targets.forEach(t => {
            if (t.special === 'spawner') {
                // Trigger Spawner (e.g., Buy Item)
                spawnObject(t.spawnTarget, t.x, t.y - 50, t.spawnAnchored);
            } else {
                // Toggle Door (Transparency/Collision)
                t.transparency = (t.transparency === 1) ? 0 : 0.8;
                t.collide = !t.collide;
            }
        });
    }

    // Reset button after 0.5s
    setTimeout(() => { btn.isPressed = false; btn.color = oldColor; }, 500);
}

// ==========================================
// 3. SOCKET EVENTS
// ==========================================
socket.on('init_game', (data) => {
    players = data.players || {};
    me = players[socket.id];
    rawMapData = data.map || [];
    // Initial Map Load
    platforms = rawMapData.length > 0 ? flattenMap(rawMapData) : [{ x: -1000, y: 600, w: 5000, h: 100, color: '#1e1e29', collide: true, anchored: true }];
    respawnPlayer();
});

socket.on('player_update', (p) => { 
    if(players[p.id]) Object.assign(players[p.id], {...p, targetX:p.x, targetY:p.y}); 
    else players[p.id] = {...p, targetX:p.x, targetY:p.y};
});
socket.on('player_hp_update', d => { if(players[d.id]) { players[d.id].hp = d.hp; if(d.id===socket.id) updateHpUI(d.hp); }});
socket.on('player_respawned', d => { if(players[d.id]) { Object.assign(players[d.id], {x:d.x, y:d.y, dead:false}); if(d.id===socket.id) updateHpUI(100); }});
socket.on('player_died_anim', id => { if(players[id]) { players[id].dead = true; createExplosion(players[id].x, players[id].y, '#fff', 20); }});

// ==========================================
// 4. PHYSICS ENGINE
// ==========================================
function updatePhysics() {
    const now = Date.now();

    // --- PLATFORMS LOOP ---
    platforms.forEach(obj => {
        // AUTO-SPAWNER (Generators)
        if (obj.special === 'spawner' && obj.spawnRate > 0) {
            if (now - (obj.lastSpawnTime || 0) > obj.spawnRate) {
                obj.lastSpawnTime = now;
                spawnObject(obj.spawnTarget, obj.x, obj.y - 50, obj.spawnAnchored);
            }
        }

        // ANCHORED OBJECTS (Static or Scripted Movement)
        if (obj.anchored) {
            if (obj.special === 'mover') {
                const wave = (Math.sin(now/1000 * (obj.moveSpeed||2) + obj.timeOffset) + 1) / 2;
                obj.x = obj.orgX + (wave * (obj.rangeX||0)); 
                obj.y = obj.orgY + (wave * (obj.rangeY||0));
                
                // Calculate Delta for carrying players
                obj.currentDx = obj.x - (obj.prevX||obj.x); 
                obj.currentDy = obj.y - (obj.prevY||obj.y);
                obj.prevX = obj.x; obj.prevY = obj.y;

            } else if (obj.special === 'spinner') {
                obj.angle = (obj.angle||0) + (obj.spinSpeed||2) * 0.05;
            }
            return;
        }

        // UNANCHORED OBJECTS (Drops / Physics Parts)
        obj.dy = (obj.dy || 0) + 0.5; // Gravity
        let nextY = obj.y + obj.dy;

        // Death Floor
        if (nextY > WORLD_FLOOR_LIMIT) obj.dead = true;

        // Collision with Anchored Platforms
        let landed = false;
        for (let other of platforms) {
            if (obj === other || !other.anchored || !other.collide) continue;
            
            // AABB Collision
            if (obj.x < other.x + other.w && obj.x + obj.w > other.x) {
                if (obj.y + obj.h <= other.y + 15 && nextY + obj.h >= other.y) {
                    obj.y = other.y - obj.h; 
                    obj.dy = 0; 
                    landed = true; 
                    
                    // --- CONVEYOR LOGIC (Move Drop) ---
                    if (other.special === 'conveyor') {
                         obj.x += Number(other.conveyorSpeed || 0);
                    }
                    // Carry Drop on Mover
                    if (other.special === 'mover') { 
                        obj.x += other.currentDx; 
                        obj.y += other.currentDy; 
                    }
                    break;
                }
            }
        }
        if (!landed) obj.y = nextY;
    });
    
    // Remove dead objects
    platforms = platforms.filter(p => !p.dead);

    // --- OTHER PLAYERS INTERPOLATION ---
    for(let id in players) {
        if(id===socket.id||players[id].dead) continue;
        const p = players[id];
        if(p.targetX!==undefined) { 
            p.x += (p.targetX-p.x)*INTERPOLATION_FACTOR; 
            p.y += (p.targetY-p.y)*INTERPOLATION_FACTOR; 
        }
    }

    // --- LOCAL PLAYER PHYSICS ---
    if (!me || me.dead) return;
    
    // Default Stats
    if (!me.speed) me.speed = 6; 
    if (!me.jumpPower) me.jumpPower = 15; 
    if (!me.scale) me.scale = 1;

    const pW = 20 * me.scale;
    const pH = 60 * me.scale; 
    const hX = 15 - (pW / 2); // Center offset
    
    let moved = false; 
    me.isMoving = false; 
    let dx = 0;
    
    // Input Movement
    if (inputs.left) { dx = -me.speed; me.direction = -1; me.isMoving = true; }
    if (inputs.right) { dx = me.speed; me.direction = 1; me.isMoving = true; }
    
    // Horizontal Movement
    if (dx !== 0) {
        me.x += dx; 
        moved = true;
        
        // Wall Collision
        const hitboxX = { x: me.x + hX, y: me.y, w: pW, h: pH };
        platforms.forEach(p => { 
            if (!p.collide || p.special === 'spinner') return; 
            if (checkCollision(hitboxX, p)) { 
                if (dx > 0) me.x = p.x - hX - pW; 
                else me.x = p.x + p.w - hX; 
            } 
        });
    }

    // Vertical Movement (Gravity)
    me.dy = (me.dy || 0) + 0.8; 
    me.y += me.dy; 
    me.grounded = false;
    const hitboxY = { x: me.x + hX, y: me.y, w: pW, h: pH };
    
    platforms.forEach(p => {
        // Spinner Damage
        if (p.special === 'spinner' && checkSpinnerCollision(hitboxY, p)) die();
        
        // Triggers (No Collision required)
        if (checkCollision(hitboxY, p)) {
            if (p.special === 'kill') die();
            else if (p.special === 'speed_up') me.speed = Number(p.customSpeed) || 16;
            else if (p.special === 'jump_boost') me.jumpPower = Number(p.customJump) || 30;
            else if (p.special === 'button') activateButton(p); // Stepping on button
            else if (p.special === 'teleport') { 
                const t = platforms.find(o => o.id === p.target || (o.special === 'teleport' && o !== p)); 
                if (t) { me.x = t.x; me.y = t.y - 70; me.dy = 0; } 
            }
            else if ((p.special === 'flashlight' || p.special === 'sword') && !myInventory.find(i => i.id === p.special) && myInventory.length < MAX_SLOTS) {
                myInventory.push({ id: p.special, name: p.special, icon: p.special==='sword'?'⚔️':'🔦', isActive: true, type: 'tool' }); 
                updateInventoryUI();
            }
        }

        // Floor Collision
        if (!p.collide) return;
        
        if (checkCollision(hitboxY, p)) {
            // Landing on top
            if (me.dy > 0 && me.y - me.dy + pH <= p.y + 20) {
                me.y = p.y - pH; 
                me.dy = 0; 
                me.grounded = true;
                
                // Mover Carry
                if (p.special === 'mover') { 
                    me.x += p.currentDx; 
                    me.y += p.currentDy; 
                    if (Math.abs(p.currentDx) > 0.1) moved = true; 
                }
                
                // --- CONVEYOR LOGIC (Move Player) ---
                if (p.special === 'conveyor') {
                    me.x += Number(p.conveyorSpeed || 0);
                    moved = true;
                }
                
            } else if (me.dy < 0) { 
                // Hitting head
                me.y = p.y + p.h; 
                me.dy = 0; 
            }
        }
    });

    // Jump
    if (inputs.jump && me.grounded) { me.dy = -me.jumpPower; me.grounded = false; moved = true; }
    
    // Void Death
    if (me.y > WORLD_FLOOR_LIMIT) die();

    // --- SYNC WITH SERVER ---
    const item = myInventory[selectedSlot];
    const itemToSend = (item && item.isActive) ? item.id : null;
    const atk = isSwinging ? 1 : 0;
    
    if (moved || me.dy !== 0 || me.grounded !== me.prevG || me.lastItem !== itemToSend || me.lastAtk !== atk) {
        me.prevG = me.grounded; me.lastItem = itemToSend; me.lastAtk = atk;
        socket.emit('player_input', { 
            x: Math.round(me.x), 
            y: Math.round(me.y), 
            direction: me.direction, 
            isMoving: me.isMoving, 
            grounded: me.grounded, 
            scale: me.scale, 
            heldItemId: itemToSend, 
            isAttacking: isSwinging 
        });
    }
}

// ==========================================
// 5. HELPER FUNCTIONS
// ==========================================
function checkCollision(r1, r2) { 
    return r1.x < r2.x + r2.w && r1.x + r1.w > r2.x && r1.y < r2.y + r2.h && r1.y + r1.h > r2.y; 
}

function checkSpinnerCollision(p, s) { 
    const cx = s.x+s.w/2, cy = s.y+s.h/2, px = p.x+p.w/2, py = p.y+p.h/2; 
    return Math.sqrt((cx-px)**2 + (cy-py)**2) < (s.w/2); 
}

function respawnPlayer() {
    if (!me) return;
    const spawn = platforms.find(p => p.type === 'spawn') || { x: 100, y: 500, w: 30 };
    me.x = spawn.x + (spawn.w/2)-15; 
    me.y = spawn.y - 70; 
    me.dy = 0; 
    me.dead = false; 
    me.hp = 100; 
    updateHpUI(100);
    // Reset Stats
    me.speed=6; me.jumpPower=15; me.scale=1; 
    myInventory=[]; selectedSlot=0; updateInventoryUI();
}

function die() { 
    if(!me || me.dead) return; 
    me.dead=true; 
    socket.emit('player_die'); 
    setTimeout(()=>{ respawnPlayer(); socket.emit('player_respawn'); }, 2000); 
}

function updateHpUI(hp) { 
    if(hpFill) hpFill.style.width = Math.max(0,hp)+'%'; 
    if(hpText) hpText.innerText=Math.ceil(Math.max(0,hp))+' / 100'; 
}

// ==========================================
// 6. RENDER ENGINE
// ==========================================
const svgCache = {};
function getAsset(p, type) {
    let id = p[type];
    if (!id || id === 'none') { 
        if(type==='face')id='face_smile'; 
        else if(type==='shirt')id='none_shirt'; 
        else if(type==='pants')id='none_pants'; 
        else id='none'; 
    }
    return ASSETS_DB[id] || { svg: '', color: null };
}

function drawSvg(ctx, content, x, y, w, h) {
    if(!content) return;
    if(!svgCache[content]) {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${w}" height="${h}" fill="none" stroke="black" stroke-width="2">${content}</svg>`;
        const img = new Image(); 
        img.src = URL.createObjectURL(new Blob([svg], {type:'image/svg+xml;charset=utf-8'}));
        svgCache[content] = { img, ready: false }; 
        img.onload = () => svgCache[content].ready = true;
    }
    if(svgCache[content].ready) ctx.drawImage(svgCache[content].img, x, y, w, h);
}

function drawAvatar(ctx, p) {
    if(!p || p.dead) return;
    const pants=getAsset(p,'pants'), shirt=getAsset(p,'shirt'), face=getAsset(p,'face'), hat=getAsset(p,'hat');
    const s = p.scale||1;
    const isHolding = (p===me && myInventory[selectedSlot]?.isActive) || (p!==me && p.heldItemId);
    const heldId = p===me ? myInventory[selectedSlot]?.id : p.heldItemId;
    const isAttacking = p===me ? isSwinging : p.isAttacking;

    ctx.save();
    ctx.translate(p.x+15, p.y+(60*s));
    ctx.scale((p.direction||1)*s, s);

    let anim = (p.isMoving && p.grounded) ? Math.sin(Date.now()/100)*0.6 : (!p.grounded ? 0.4 : 0);
    let armAnim = isHolding ? -1.5 : (isAttacking ? -2.5 + (swingTimer/SWING_DURATION)*3 : anim);

    // Draw Body Parts
    ctx.fillStyle='#ffccaa'; ctx.save(); ctx.translate(6,-38); ctx.rotate(-anim); ctx.fillRect(-4,0,8,20); ctx.restore(); // Back Arm
    ctx.fillStyle=pants.color||'#2d3436'; ctx.save(); ctx.translate(3,-20); ctx.rotate(anim); ctx.fillRect(-4,0,8,20); ctx.restore(); // Back Leg
    ctx.fillStyle=shirt.color||p.color||'#6c5ce7'; ctx.fillRect(-10,-40,20,20); // Body
    ctx.fillStyle='#ffccaa'; ctx.beginPath(); ctx.roundRect(-10,-62,20,20,4); ctx.fill(); // Head
    
    if(face.svg) drawSvg(ctx, face.svg, -10, -62, 20, 20);
    if(hat.svg) drawSvg(ctx, hat.svg, -20, -75, 40, 40);
    
    ctx.fillStyle=pants.color||'#2d3436'; ctx.save(); ctx.translate(-3,-20); ctx.rotate(-anim); ctx.fillRect(-4,0,8,20); ctx.restore(); // Front Leg
    ctx.fillStyle='#ffccaa'; ctx.save(); ctx.translate(-6,-38); ctx.rotate(armAnim); ctx.fillRect(-4,0,8,20); // Front Arm
    
    // Tools
    if(isHolding) {
        ctx.translate(0,18); ctx.rotate(Math.PI/2);
        if(heldId==='flashlight') { ctx.fillStyle='#333'; ctx.fillRect(0,-3,10,6); ctx.fillStyle='yellow'; ctx.fillRect(10,-3,2,6); }
        else if(heldId==='sword') { ctx.fillStyle='#555'; ctx.fillRect(-4,-2,8,4); ctx.fillStyle='#bdc3c7'; ctx.fillRect(4,-2,25,4); }
    }
    ctx.restore(); ctx.restore();
}

function render() {
    if(canvas.width!==window.innerWidth || canvas.height!==window.innerHeight) { canvas.width=window.innerWidth; canvas.height=window.innerHeight; }
    if(me) { cameraX += (me.x - canvas.width/2 - cameraX)*0.1; cameraY += (me.y - canvas.height/2 + 100 - cameraY)*0.1; }
    
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = '#1e1e29'; ctx.fillRect(0,0,canvas.width,canvas.height);
    
    ctx.save(); ctx.translate(-cameraX, -cameraY);

    // DRAW PLATFORMS
    platforms.forEach(p => {
        ctx.save(); 
        ctx.globalAlpha = 1 - p.transparency; 
        ctx.fillStyle = p.color || '#1e1e29';
        
        if (p.special === 'spinner') { 
            ctx.translate(p.x+p.w/2, p.y+p.h/2); 
            ctx.rotate(p.angle||0); 
            ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h); 
        } else {
            ctx.fillRect(p.x, p.y, p.w, p.h);
        }
        
        // Text Labels
        if (p.text && p.special !== 'spinner') {
            ctx.fillStyle = p.textColor || 'white'; 
            ctx.font = `bold ${p.textSize}px Arial`; 
            ctx.textAlign='center'; 
            ctx.textBaseline='middle';
            ctx.fillText(p.text, p.x+p.w/2, p.y+p.h/2);
        }
        ctx.restore();
    });

    // DRAW ENTITIES
    for(let id in players) drawAvatar(ctx, (id===socket.id)?me:players[id]);
    for(let i=particles.length-1; i>=0; i--) { particles[i].update(); particles[i].draw(ctx); if(particles[i].life<=0) particles.splice(i,1); }
    
    ctx.restore();

    if(isSwinging) { swingTimer++; if(swingTimer > SWING_DURATION) { isSwinging = false; swingTimer = 0; } }
    updatePhysics();
    requestAnimationFrame(render);
}

// ==========================================
// 7. INPUT HANDLING & MOUSE CLICK
// ==========================================
window.addEventListener('keydown', e => {
    if(document.activeElement === document.getElementById('chatInput')) return;
    if(e.code==='KeyA'||e.code==='ArrowLeft') inputs.left=true; 
    if(e.code==='KeyD'||e.code==='ArrowRight') inputs.right=true; 
    if(e.code==='Space'||e.code==='ArrowUp') inputs.jump=true;
    if(['1','2','3'].includes(e.key)) { selectedSlot=parseInt(e.key)-1; updateInventoryUI(); }
});

window.addEventListener('keyup', e => { 
    if(e.code==='KeyA'||e.code==='ArrowLeft') inputs.left=false; 
    if(e.code==='KeyD'||e.code==='ArrowRight') inputs.right=false; 
    if(e.code==='Space'||e.code==='ArrowUp') inputs.jump=false; 
});

window.addEventListener('mousedown', e => {
    if(e.target.closest('.hotbar-container')||e.target.tagName==='BUTTON'||e.target.tagName==='INPUT') return;
    
    const mx = e.clientX + cameraX;
    const my = e.clientY + cameraY;
    let clickedButton = false;

    // Check Mouse Click on Game Buttons
    platforms.forEach(p => {
        if(p.special === 'button') {
            if(mx > p.x && mx < p.x + p.w && my > p.y && my < p.y + p.h) {
                activateButton(p);
                clickedButton = true;
            }
        }
    });
    if(clickedButton) return;

    // Tool Usage
    const item = myInventory[selectedSlot];
    if(item?.id === 'sword') {
        if(Date.now() - lastAttackTime > ATTACK_COOLDOWN) {
            lastAttackTime=Date.now(); isSwinging=true; swingTimer=0;
            // Hit detection
            for(let id in players) {
                if(id===socket.id||players[id].dead) continue;
                if(Math.sqrt((me.x-players[id].x)**2 + (me.y-players[id].y)**2) < 80) {
                    if((players[id].x > me.x ? 1 : -1) === me.direction) { 
                        socket.emit('damage_player', id); 
                        createExplosion(players[id].x, players[id].y, '#fff', 10); 
                    }
                }
            }
        }
    } else if(item?.type === 'tool') { 
        item.isActive = !item.isActive; 
        updateInventoryUI(); 
    }
});

// ==========================================
// 8. UI UPDATES
// ==========================================
function updateInventoryUI() {
    if(!hotbarContainer) return;
    hotbarContainer.innerHTML = '';
    for(let i=0; i<MAX_SLOTS; i++) {
        const d = document.createElement('div'); 
        d.className = `slot ${i===selectedSlot?'selected':''}`;
        d.innerHTML = myInventory[i] ? `<span class="slot-number">${i+1}</span> ${myInventory[i].icon}` : `<span class="slot-number">${i+1}</span>`;
        d.onclick=()=>{selectedSlot=i;updateInventoryUI();}; 
        hotbarContainer.appendChild(d);
    }
}

function createExplosion(x,y,c,n) { 
    for(let i=0;i<n;i++) particles.push({
        x,y,c,
        vx:(Math.random()-0.5)*10,
        vy:(Math.random()-0.5)*10,
        life:1,
        update(){this.x+=this.vx;this.y+=this.vy;this.vy+=0.2;this.life-=0.05},
        draw(ctx){ctx.globalAlpha=this.life;ctx.fillStyle=this.c;ctx.fillRect(this.x,this.y,4,4);ctx.globalAlpha=1}
    }); 
}

// Mobile Controls
if(/Android|iPhone/i.test(navigator.userAgent)) {
    document.getElementById('mobileControls').style.display='flex';
    const bind = (id, k) => {
        const b = document.getElementById(id);
        b.addEventListener('touchstart',e=>{e.preventDefault();inputs[k]=true;});
        b.addEventListener('touchend',e=>{e.preventDefault();inputs[k]=false;});
    };
    bind('btnL','left'); bind('btnR','right'); bind('btnJ','jump');
}

updateInventoryUI();
render();
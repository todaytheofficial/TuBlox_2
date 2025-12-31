// ==========================================
// STUDIO.JS - CONVEYOR & COLLISION FIX
// ==========================================
let canvas, ctx;
let modelPreviewCanvas, modelPreviewCtx;
let studioObjects = [];
let selectedObj = null;
let camX = 0, camY = 0;
let isPanning = false, isDragging = false;

// SCALE VARIABLES
let isResizing = false;
let resizeHandle = null;
let resizeStart = { x: 0, y: 0, w: 0, h: 0, mx: 0, my: 0 };
let startX, startY;
let contextMenuObj = null;

// SVG ICONS
const ICONS = {
    part: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>',
    spawn: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>',
    text: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line></svg>',
    trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
    edit: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>',
    box: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>',
    model: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffeaa7" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>',
    spawner: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e67e22" stroke-width="2"><rect x="2" y="2" width="20" height="20"></rect><path d="M12 8v8M8 12h8"></path></svg>',
    button: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" stroke-width="2"><rect x="2" y="10" width="20" height="8" rx="2"></rect><rect x="6" y="6" width="12" height="4"></rect></svg>'
};

// MODELS LIBRARY
let modelsLibrary = [
    { id: 'tu_conveyor', category: 'Mechanisms', name: 'Conveyor', objects: [{ type: 'part', x: 0, y: 0, w: 100, h: 20, color: '#34495e', anchored: true, collide: true, special: 'conveyor', conveyorSpeed: 5, text: '>>>', textSize: 12 }] },
    { id: 'tu_spawner', category: 'Tycoon', name: 'TuModel Spawner', objects: [{ type: 'part', x: 0, y: 0, w: 40, h: 40, color: '#e67e22', anchored: true, collide: false, special: 'spawner', spawnTarget: '', spawnRate: 0, spawnAnchored: false, text: 'Spawner', textSize: 10 }] },
    { id: 'tu_button', category: 'Tycoon', name: 'Button', objects: [{ type: 'part', x: 0, y: 0, w: 40, h: 15, color: '#e74c3c', anchored: true, collide: true, special: 'button', targetName: '', text: 'BTN', textSize: 10 }] },
    { id: 'kill_part', category: 'Blocks', name: 'Kill Part', objects: [{ type: 'part', x: 0, y: 0, w: 100, h: 40, color: '#ff0000', anchored: true, collide: true, special: 'kill', transparency: 0 }] },
    { id: 'spinner_part', category: 'Mechanisms', name: 'Spinner (Kill)', objects: [{ type: 'part', x: 0, y: 0, w: 150, h: 20, color: '#e74c3c', anchored: true, collide: true, special: 'spinner', spinSpeed: 2, transparency: 0 }] },
    { id: 'moving_part', category: 'Mechanisms', name: 'Moving Platform', objects: [{ type: 'part', x: 0, y: 0, w: 100, h: 20, color: '#3498db', anchored: true, collide: true, special: 'mover', moveSpeed: 2, rangeX: 200, rangeY: 0, transparency: 0 }] },
    { id: 'teleport_set', category: 'Mechanisms', name: 'Teleporters', objects: [{ type: 'part', x: 0, y: 0, w: 80, h: 10, color: '#3498db', anchored: true, collide: false, special: 'teleport', target: 'tp_out', text: 'In', transparency: 0.2 }, { type: 'part', x: 150, y: 0, w: 80, h: 10, color: '#e74c3c', anchored: true, collide: false, special: 'teleport', target: 'tp_in', id: 'tp_out', text: 'Out', transparency: 0.2 }] },
    { id: 'speed_pad', category: 'Boosts', name: 'Speed Pad', objects: [{ type: 'part', x: 0, y: 0, w: 60, h: 10, color: '#f1c40f', anchored: true, collide: false, special: 'speed_up', customSpeed: 16, text: 'Speed+', textSize: 14, textColor: '#000000', transparency: 0.2 }] },
    { id: 'jump_pad', category: 'Boosts', name: 'Jump Pad', objects: [{ type: 'part', x: 0, y: 0, w: 60, h: 10, color: '#2ecc71', anchored: true, collide: false, special: 'jump_boost', customJump: 30, text: 'Jump+', textSize: 14, textColor: '#000000', transparency: 0.2 }] },
    { id: 'tool_flashlight', category: 'Items', name: 'Flashlight', objects: [{ type: 'part', x: 0, y: 0, w: 40, h: 15, color: '#2d3436', anchored: true, collide: false, special: 'flashlight', text: '🔦', textSize: 12 }] },
    { id: 'tool_sword', category: 'Items', name: 'Sword', objects: [{ type: 'part', x: 0, y: 0, w: 15, h: 45, color: '#bdc3c7', anchored: true, collide: false, special: 'sword', text: '⚔️', textSize: 20 }] }
];

let currentTool = 'part';
let currentTab = 'build';
let currentModel = null;
let selectedModel = null;
let currentGameName = "";
let contextMenu, textBtn, modal, textInput, publishModal, publishNameInput, saveBtn, quickSaveBtn, modelsLibraryEl;
let currentUser, gameId;

// ==========================================
// INIT
// ==========================================
function initStudio() {
    canvas = document.getElementById('gameCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    
    modelPreviewCanvas = document.getElementById('modelPreviewCanvas');
    if (modelPreviewCanvas) modelPreviewCtx = modelPreviewCanvas.getContext('2d');

    contextMenu = document.getElementById('context-menu');
    
    if (contextMenu && !document.getElementById('cm-add-child')) {
        const btn = document.createElement('button');
        btn.id = 'cm-add-child'; btn.className = 'context-btn';
        btn.innerHTML = `${ICONS.part} Add Child Part`;
        btn.onclick = addChildToModel;
        contextMenu.appendChild(btn);
    }

    modal = document.getElementById('text-modal-overlay');
    textInput = document.getElementById('modal-text-input');
    publishModal = document.getElementById('publish-modal-overlay');
    publishNameInput = document.getElementById('publish-name-input');
    saveBtn = document.getElementById('publish-btn');
    quickSaveBtn = document.getElementById('quick-save-btn');
    modelsLibraryEl = document.getElementById('models-library');

    const urlParams = new URLSearchParams(window.location.search);
    gameId = urlParams.get('id') || 'game1';
    const storedUser = localStorage.getItem('tublox_user');
    currentUser = storedUser ? JSON.parse(storedUser) : { username: "Guest" };
    if (quickSaveBtn) quickSaveBtn.onclick = saveProject;

    resize(); loadProject(); switchTab('build'); setupEventListeners(); renderModelLibrary();
}

function setupEventListeners() {
    window.onresize = resize;
    if (canvas) {
        canvas.addEventListener('contextmenu', handleContextMenu);
        canvas.onmousedown = handleMouseDown;
        canvas.oncontextmenu = e => e.preventDefault();
    }
    window.onmousemove = handleMouseMove;
    window.onmouseup = handleMouseUp;
    window.addEventListener('click', () => { if (contextMenu) contextMenu.style.display = 'none'; contextMenuObj = null; });
}

function resize() {
    if (!canvas) return;
    const ws = document.querySelector('.workspace');
    const sb = document.querySelector('.sidebar');
    if (ws && sb) { canvas.width = ws.clientWidth - (window.innerWidth > 768 ? sb.offsetWidth : 0); canvas.height = ws.clientHeight; }
    render();
    if (currentTab === 'models') renderModelPreview();
}

// ==========================================
// DATA
// ==========================================
async function loadProject() {
    try {
        const res = await fetch(`/api/load_studio/${gameId}`);
        if (!res.ok) throw new Error('Network');
        const data = await res.json();
        studioObjects = data.map || [];
        currentGameName = data.name || "Unnamed Game";
        render(); updateExplorer();
    } catch (e) { studioObjects = []; render(); updateExplorer(); }
}

async function saveProject() {
    const originalIcon = quickSaveBtn.innerHTML; quickSaveBtn.innerHTML = "⌛";
    try {
        await fetch('/api/save_game_data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId, username: currentUser.username, name: currentGameName, map: studioObjects }) });
        quickSaveBtn.innerHTML = "✔"; setTimeout(() => quickSaveBtn.innerHTML = originalIcon, 1000);
    } catch (error) { quickSaveBtn.innerHTML = originalIcon; }
}

function openPublishModal() { if(publishModal) { publishModal.style.display = 'flex'; publishNameInput.value = currentGameName; } }
function closePublishModal() { if(publishModal) publishModal.style.display = 'none'; }
async function publishGame() {
    const newName = publishNameInput.value;
    if(!newName.trim()) return alert("Enter name!");
    try {
        await fetch('/api/save_game_data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId, username: currentUser.username, name: newName, map: studioObjects }) });
        currentGameName = newName; closePublishModal(); alert(`Published: ${newName}`);
    } catch (error) { alert('Error'); }
}

// ==========================================
// UI & TOOLS
// ==========================================
function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.models-tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(tab + '-tab')?.classList.add('active');
    if (tab === 'build') render(); else if (tab === 'models') { resize(); renderModelPreview(); }
}
function setBuildTool(tool) {
    currentTool = tool;
    document.querySelectorAll('.model-tool').forEach(btn => btn.classList.remove('active'));
    let target = event ? event.target.closest('.model-tool') : null;
    if (target) target.classList.add('active');
    render();
}

// ==========================================
// OBJECTS
// ==========================================
function addPart(model) {
    if (model) {
        model.objects.forEach(objTemplate => {
            const p = JSON.parse(JSON.stringify(objTemplate));
            p.id = Date.now() + Math.random();
            p.x = -camX + 100 + (p.x||0); p.y = -camY + 100 + (p.y||0);
            studioObjects.push(p); selectedObj = p;
        });
    } else {
        const p = { id: Date.now(), type: 'part', x: -camX + 100, y: -camY + 100, w: 100, h: 40, color: '#95a5a6', anchored: true, collide: true };
        studioObjects.push(p); selectedObj = p;
    }
    render(); updateExplorer(); showProperties();
}
function addModel() {
    const p = { id: Date.now(), type: 'model', name: 'Model', x: -camX + 100, y: -camY + 100, w: 100, h: 100, children: [], anchored: true, collide: true };
    studioObjects.push(p); selectedObj = p;
    render(); updateExplorer(); showProperties();
}
function addChildToModel() {
    if (!contextMenuObj || contextMenuObj.type !== 'model') return;
    const child = { id: Date.now(), type: 'part', x: 10, y: 10, w: 50, h: 50, color: '#3498db', anchored: true, collide: true };
    if(!contextMenuObj.children) contextMenuObj.children = [];
    contextMenuObj.children.push(child);
    if(contextMenu) contextMenu.style.display = 'none';
    render(); updateExplorer();
}
function deleteObj() {
    const target = contextMenuObj || selectedObj; if (!target) return;
    const removeRecursive = (list) => {
        const idx = list.indexOf(target);
        if (idx > -1) { list.splice(idx, 1); return true; }
        for (let item of list) { if (item.children && removeRecursive(item.children)) return true; }
        return false;
    };
    removeRecursive(studioObjects); selectedObj = null; contextMenuObj = null; if (contextMenu) contextMenu.style.display = 'none';
    render(); updateExplorer(); showProperties();
}

// ==========================================
// PROPERTIES
// ==========================================
function showProperties() {
    const p = document.getElementById('properties-panel');
    if (!p) return;
    if (!selectedObj) { p.innerHTML = '<p style="color:#666; text-align:center; margin-top:20px;">Select object</p>'; return; }

    let html = `<label>Type: ${selectedObj.type.toUpperCase()}</label>`;
    html += `<label>Name (ID)</label><input type="text" value="${selectedObj.name || ''}" placeholder="object_name" oninput="updateObjectProperty('name', this.value)">`;

    if (selectedObj.type !== 'model') html += `<label>Color</label><input type="color" value="${selectedObj.color || '#ffffff'}" oninput="updateObjectProperty('color', this.value)">`;

    html += `<label>Size (W x H)</label><div style="display:flex; gap:5px"><input type="number" value="${selectedObj.w}" onchange="updateObjectProperty('w', this.value)"><input type="number" value="${selectedObj.h}" onchange="updateObjectProperty('h', this.value)"></div>`;
    html += `<label>Pos (X, Y)</label><div style="display:flex; gap:5px"><input type="number" value="${selectedObj.x}" onchange="updateObjectProperty('x', this.value)"><input type="number" value="${selectedObj.y}" onchange="updateObjectProperty('y', this.value)"></div>`;

    // ANCHOR & COLLIDE (Available for ALL, including Models)
    html += `<div class="prop-toggle-row"><label style="margin:0">Anchored</label><input type="checkbox" ${selectedObj.anchored ? 'checked' : ''} onchange="updateObjectProperty('anchored', this.checked)"></div>`;
    html += `<div class="prop-toggle-row"><label style="margin:0">Can Collide</label><input type="checkbox" ${selectedObj.collide ? 'checked' : ''} onchange="updateObjectProperty('collide', this.checked)"></div>`;
    
    if (selectedObj.type !== 'model') {
        html += `<label>Transparency</label><input type="range" min="0" max="1" step="0.1" value="${selectedObj.transparency || 0}" oninput="updateObjectProperty('transparency', this.value)">`;
    }

    // SPECIALS
    if (selectedObj.special === 'speed_up') html += `<hr><label style="color:#f1c40f">Speed</label><input type="number" value="${selectedObj.customSpeed || 16}" onchange="updateObjectProperty('customSpeed', this.value)">`;
    if (selectedObj.special === 'jump_boost') html += `<hr><label style="color:#2ecc71">Jump</label><input type="number" value="${selectedObj.customJump || 30}" onchange="updateObjectProperty('customJump', this.value)">`;
    
    // CONVEYOR SETTINGS
    if (selectedObj.special === 'conveyor') {
        html += `<hr><label style="color:#34495e">Conveyor Speed</label><input type="number" value="${selectedObj.conveyorSpeed || 5}" onchange="updateObjectProperty('conveyorSpeed', this.value)">`;
        html += `<small style="color:#888">Positive = Right, Negative = Left</small>`;
    }

    if (selectedObj.special === 'spawner') {
        html += `<hr style="border-color:#e67e22"><label style="color:#e67e22">Spawner</label>`;
        html += `<label>Spawn Target Name</label><input type="text" value="${selectedObj.spawnTarget || ''}" oninput="updateObjectProperty('spawnTarget', this.value)">`;
        html += `<label>Spawn Rate (ms)</label><input type="number" value="${selectedObj.spawnRate || 0}" onchange="updateObjectProperty('spawnRate', this.value)">`;
        html += `<div class="prop-toggle-row"><label>Spawn Anchored?</label><input type="checkbox" ${selectedObj.spawnAnchored ? 'checked' : ''} onchange="updateObjectProperty('spawnAnchored', this.checked)"></div>`;
    }
    if (selectedObj.special === 'button') {
        html += `<hr style="border-color:#e74c3c"><label style="color:#e74c3c">Button</label>`;
        html += `<label>Target Name</label><input type="text" value="${selectedObj.targetName || ''}" oninput="updateObjectProperty('targetName', this.value)">`;
    }
    if (selectedObj.text || selectedObj.type === 'text') {
        html += `<hr><label>Text</label><input type="text" value="${selectedObj.text || ''}" oninput="updateObjectProperty('text', this.value)"><label>Size</label><input type="number" value="${selectedObj.textSize || 20}" onchange="updateObjectProperty('textSize', this.value)">`;
    }

    html += `<hr style="margin:15px 0;"><button class="btn-studio" onclick="deleteObj()" style="background:var(--studio-danger); width:100%;">${ICONS.trash} Delete</button>`;
    p.innerHTML = html;
}

function updateObjectProperty(prop, val) {
    if (!selectedObj) return;
    const updateRecursive = (obj, key, value) => {
        obj[key] = value;
        if (obj.children) obj.children.forEach(c => updateRecursive(c, key, value));
    };

    let processedVal = val;
    if (['w','h','x','y','customSpeed','customJump','textSize','spawnRate','conveyorSpeed'].includes(prop)) processedVal = Number(val);
    if (['anchored','collide','spawnAnchored'].includes(prop)) processedVal = Boolean(val);

    // Apply recursively for Anchored AND Collide on Models
    if (selectedObj.type === 'model' && (prop === 'anchored' || prop === 'collide')) {
        updateRecursive(selectedObj, prop, processedVal);
    } else {
        selectedObj[prop] = processedVal;
    }
    render();
}

function updateExplorer() {
    const list = document.getElementById('explorer-list'); if (!list) return; list.innerHTML = '';
    const renderItem = (obj, depth=0) => {
        const div = document.createElement('div'); div.className = `obj-item ${selectedObj === obj ? 'selected' : ''}`;
        div.style.paddingLeft = (10 + depth * 15) + 'px';
        div.innerHTML = `${obj.type === 'model' ? ICONS.model : ICONS.part} <span>${obj.name || obj.special || obj.type}</span>`;
        div.onclick = (e) => { e.stopPropagation(); selectedObj = obj; showProperties(); render(); updateExplorer(); };
        list.appendChild(div);
        if (obj.children) obj.children.forEach(c => renderItem(c, depth + 1));
    };
    studioObjects.slice().reverse().forEach(o => renderItem(o));
}

// ==========================================
// RENDER
// ==========================================
function render() {
    if (!ctx || !canvas) return;
    ctx.fillStyle = '#1e1e1e'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save(); ctx.translate(camX, camY);

    // Grid
    ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 1; ctx.beginPath();
    for (let i = -2000; i < 3000; i += 50) { ctx.moveTo(i, -2000); ctx.lineTo(i, 3000); ctx.moveTo(-2000, i); ctx.lineTo(3000, i); }
    ctx.stroke();

    const drawObject = (obj, parentX = 0, parentY = 0) => {
        const absX = obj.x + parentX;
        const absY = obj.y + parentY;
        ctx.save();
        
        if (obj.type === 'model') {
            if (selectedObj === obj) {
                ctx.strokeStyle = '#ffeaa7'; ctx.lineWidth = 2; ctx.setLineDash([5,5]);
                ctx.strokeRect(absX, absY, obj.w, obj.h); ctx.setLineDash([]);
            }
        } else {
            ctx.globalAlpha = 1 - (obj.transparency || 0);
            if (!obj.collide) ctx.globalAlpha *= 0.6;
            ctx.fillStyle = obj.color;
            ctx.fillRect(absX, absY, obj.w, obj.h);

            if (obj.text) {
                ctx.fillStyle = obj.textColor || 'white'; ctx.font = `bold ${obj.textSize || 14}px Arial`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(obj.text, absX + obj.w/2, absY + obj.h/2);
            }
            if (selectedObj === obj) { ctx.strokeStyle = '#00cec9'; ctx.lineWidth = 2; ctx.strokeRect(absX, absY, obj.w, obj.h); }
            if (!obj.anchored) { ctx.strokeStyle = '#ff7675'; ctx.lineWidth = 1; ctx.strokeRect(absX+2, absY+2, obj.w-4, obj.h-4); }
        }
        ctx.restore();
        if (obj.children) obj.children.forEach(child => drawObject(child, absX, absY));
    };

    studioObjects.forEach(obj => drawObject(obj));

    if (currentTool === 'scale' && selectedObj) {
        const handles = getScaleHandles(selectedObj);
        ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#000000'; ctx.lineWidth = 1;
        for (let key in handles) {
            const h = handles[key];
            ctx.beginPath(); ctx.arc(h.x + h.w/2, h.y + h.h/2, h.w/2, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();
        }
    }
    ctx.restore();
}

// ==========================================
// MOUSE INTERACTION
// ==========================================
function handleContextMenu(e) {
    e.preventDefault();
    const mx = e.offsetX - camX;
    const my = e.offsetY - camY;
    const findHit = (list, px=0, py=0) => {
        for (let i = list.length - 1; i >= 0; i--) {
            const o = list[i];
            const ax = o.x + px, ay = o.y + py;
            if (o.type === 'model' && o.children) {
                if (findHit(o.children, ax, ay)) return o;
                if (mx > ax && mx < ax+o.w && my > ay && my < ay+o.h) return o;
            } else { if (mx > ax && mx < ax+o.w && my > ay && my < ay+o.h) return o; }
        }
        return null;
    };
    const hit = findHit(studioObjects);
    if (hit) {
        contextMenuObj = hit; selectedObj = hit;
        const addBtn = document.getElementById('cm-add-child');
        if (addBtn) addBtn.style.display = hit.type === 'model' ? 'block' : 'none';
        if (contextMenu) { contextMenu.style.display = 'flex'; contextMenu.style.left = e.clientX + 'px'; contextMenu.style.top = e.clientY + 'px'; }
        showProperties();
    } else { if (contextMenu) contextMenu.style.display = 'none'; }
}

function handleMouseDown(e) {
    if (e.button === 0 && contextMenu) contextMenu.style.display = 'none';
    if (e.button === 2) { isPanning = true; return; }
    const mx = e.offsetX - camX; const my = e.offsetY - camY;

    if (currentTool === 'scale' && selectedObj) {
        const handles = getScaleHandles(selectedObj);
        for (let key in handles) {
            const h = handles[key];
            if (mx >= h.x && mx <= h.x+h.w && my >= h.y && my <= h.y+h.h) {
                isResizing = true; resizeHandle = key;
                resizeStart = { x: selectedObj.x, y: selectedObj.y, w: selectedObj.w, h: selectedObj.h, mx, my };
                return;
            }
        }
    }

    const findHit = (list, px=0, py=0) => {
        for (let i = list.length - 1; i >= 0; i--) {
            const o = list[i];
            const ax = o.x + px, ay = o.y + py;
            if (o.type === 'model' && o.children) {
                if (findHit(o.children, ax, ay)) return o; // Select Model if child hit
                if (mx > ax && mx < ax+o.w && my > ay && my < ay+o.h) return o;
            } else { if (mx > ax && mx < ax+o.w && my > ay && my < ay+o.h) return o; }
        }
        return null;
    };

    const hit = findHit(studioObjects);
    if (hit) {
        selectedObj = hit; isDragging = true;
        startX = mx - hit.x; startY = my - hit.y;
        showProperties(); updateExplorer(); render();
    } else {
        const gx = Math.round(mx/10)*10, gy = Math.round(my/10)*10;
        if (currentTool === 'part') addPart();
        else if (currentTool === 'model') addModel();
        else selectedObj = null;
        showProperties(); updateExplorer(); render();
    }
}

function handleMouseMove(e) {
    const mx = e.offsetX - camX; const my = e.offsetY - camY;
    if (currentTool === 'scale' && selectedObj && !isDragging) {
        const handles = getScaleHandles(selectedObj);
        let hover = false;
        for (let key in handles) {
            const h = handles[key];
            if (mx >= h.x && mx <= h.x+h.w && my >= h.y && my <= h.y+h.h) { canvas.style.cursor = h.cursor; hover = true; }
        }
        if (!hover) canvas.style.cursor = isPanning ? 'grabbing' : 'default';
    } else canvas.style.cursor = isPanning ? 'grabbing' : 'default';

    if (isPanning) { camX += e.movementX; camY += e.movementY; render(); return; }
    if (isResizing && selectedObj) {
        const dx = Math.round((mx - resizeStart.mx)/10)*10;
        const dy = Math.round((my - resizeStart.my)/10)*10;
        if (resizeHandle.includes('e')) selectedObj.w = Math.max(10, resizeStart.w + dx);
        if (resizeHandle.includes('w')) { const nw = resizeStart.w - dx; if (nw >= 10) { selectedObj.x = resizeStart.x + dx; selectedObj.w = nw; } }
        if (resizeHandle.includes('s')) selectedObj.h = Math.max(10, resizeStart.h + dy);
        if (resizeHandle.includes('n')) { const nh = resizeStart.h - dy; if (nh >= 10) { selectedObj.y = resizeStart.y + dy; selectedObj.h = nh; } }
        showProperties(); render(); return;
    }
    if (isDragging && selectedObj) {
        selectedObj.x = Math.round((mx - startX)/10)*10; selectedObj.y = Math.round((my - startY)/10)*10;
        showProperties(); render();
    }
}
function handleMouseUp() { isPanning = false; isDragging = false; isResizing = false; if(canvas) canvas.style.cursor = 'default'; }

function renderModelLibrary() {
    if (!modelsLibraryEl) return;
    modelsLibraryEl.innerHTML = '';
    const categories = {};
    modelsLibrary.forEach(model => { const cat = model.category || 'Misc'; if (!categories[cat]) categories[cat] = []; categories[cat].push(model); });
    for (const [catName, models] of Object.entries(categories)) {
        const header = document.createElement('div');
        header.style.cssText = 'grid-column:1/-1; color:#888; font-size:11px; font-weight:bold; margin:10px 0 5px; text-transform:uppercase;';
        header.innerText = catName;
        modelsLibraryEl.appendChild(header);
        models.forEach(model => {
            const el = document.createElement('div'); el.className = 'model-item';
            el.innerHTML = `<div style="font-size:20px;">${model.objects[0].text || ICONS.box}</div><div style="font-size:10px;">${model.name}</div>`;
            el.onclick = () => { selectedModel = model; addPart(model); };
            modelsLibraryEl.appendChild(el);
        });
    }
}
function renderModelPreview() {
    if (!modelPreviewCanvas || !modelPreviewCtx) return;
    const w = modelPreviewCanvas.parentElement.clientWidth || 300;
    const h = 150;
    modelPreviewCanvas.width = w;
    modelPreviewCanvas.height = h;
    
    modelPreviewCtx.clearRect(0,0,w,h);
    modelPreviewCtx.fillStyle = '#1a1a26';
    modelPreviewCtx.fillRect(0,0,w,h);

    if (!selectedModel) return;
    const objs = selectedModel.objects;
    if(!objs || !objs.length) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    objs.forEach(o => {
        if(o.x < minX) minX = o.x;
        if(o.y < minY) minY = o.y;
        if(o.x+o.w > maxX) maxX = o.x+o.w;
        if(o.y+o.h > maxY) maxY = o.y+o.h;
    });

    const mw = maxX - minX;
    const mh = maxY - minY;
    const scale = Math.min((w-40)/mw, (h-40)/mh);
    const ox = (w - mw*scale)/2;
    const oy = (h - mh*scale)/2;

    modelPreviewCtx.save();
    modelPreviewCtx.translate(ox, oy);
    modelPreviewCtx.scale(scale, scale);
    modelPreviewCtx.translate(-minX, -minY);

    objs.forEach(obj => {
        modelPreviewCtx.fillStyle = obj.color;
        modelPreviewCtx.fillRect(obj.x, obj.y, obj.w, obj.h);
    });
    modelPreviewCtx.restore();

    const pc = document.getElementById('parts-count');
    const sv = document.getElementById('size-value');
    if(pc) pc.innerText = objs.length;
    if(sv) sv.innerText = `${Math.round(mw)}x${Math.round(mh)}`;
}

document.addEventListener('DOMContentLoaded', initStudio);
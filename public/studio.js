// ==========================================
// GLOBAL VARIABLES
// ==========================================
let canvas, ctx;
let modelPreviewCanvas, modelPreviewCtx;
let studioObjects = [];
let selectedObj = null;
let camX = 0, camY = 0;
let isPanning = false, isDragging = false;

// === SCALE VARIABLES ===
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
    box: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>'
};

// TuModels state
let currentTool = 'part';
let currentTab = 'build';

// === ОБНОВЛЕННАЯ БИБЛИОТЕКА МОДЕЛЕЙ ===
let modelsLibrary = [
    // --- BLOCKS ---
    {
        id: 'kill_part',
        category: 'Blocks',
        name: 'Kill Part',
        objects: [{ type: 'part', x: 0, y: 0, w: 100, h: 40, color: '#ff0000', anchored: true, collide: true, special: 'kill', transparency: 0 }]
    },
    
    // --- MECHANISMS ---
    {
        id: 'spinner_part',
        category: 'Mechanisms',
        name: 'Spinner (Kill)',
        objects: [{ type: 'part', x: 0, y: 0, w: 150, h: 20, color: '#e74c3c', anchored: true, collide: true, special: 'spinner', spinSpeed: 2, transparency: 0 }]
    },
    {
        id: 'moving_part',
        category: 'Mechanisms',
        name: 'Moving Platform',
        // ВАЖНО: moveSpeed теперь 2 (было 0.03) - чтобы двигалось заметно!
        objects: [{ type: 'part', x: 0, y: 0, w: 100, h: 20, color: '#3498db', anchored: true, collide: true, special: 'mover', moveSpeed: 2, rangeX: 200, rangeY: 0, transparency: 0 }]
    },
    {
        id: 'teleport_set',
        category: 'Mechanisms',
        name: 'Teleporters',
        objects: [
            { type: 'part', x: 0, y: 0, w: 80, h: 10, color: '#3498db', anchored: true, collide: false, special: 'teleport', target: 'tp_out', text: 'In', transparency: 0.2 },
            { type: 'part', x: 150, y: 0, w: 80, h: 10, color: '#e74c3c', anchored: true, collide: false, special: 'teleport', target: 'tp_in', id: 'tp_out', text: 'Out', transparency: 0.2 }
        ]
    },

    // --- BOOSTS ---
    {
        id: 'speed_pad',
        category: 'Boosts',
        name: 'Speed Pad',
        objects: [{ type: 'part', x: 0, y: 0, w: 60, h: 10, color: '#f1c40f', anchored: true, collide: false, special: 'speed_up', customSpeed: 16, text: 'Speed+', textSize: 14, textColor: '#000000', transparency: 0.2 }]
    },
    {
        id: 'jump_pad',
        category: 'Boosts',
        name: 'Jump Pad',
        objects: [{ type: 'part', x: 0, y: 0, w: 60, h: 10, color: '#2ecc71', anchored: true, collide: false, special: 'jump_boost', customJump: 30, text: 'Jump+', textSize: 14, textColor: '#000000', transparency: 0.2 }]
    },
    {
        id: 'big_player',
        category: 'Boosts',
        name: 'Big Player',
        objects: [{ type: 'part', x: 0, y: 0, w: 50, h: 80, color: '#9b59b6', anchored: true, collide: false, special: 'big_player', customScale: 2, text: 'BIG', textSize: 20, transparency: 0.3 }]
    },
    {
        id: 'small_player',
        category: 'Boosts',
        name: 'Small Player',
        objects: [{ type: 'part', x: 0, y: 0, w: 50, h: 50, color: '#00cec9', anchored: true, collide: false, special: 'small_player', customScale: 0.5, text: 'Small', textSize: 15, transparency: 0.3 }]
    },
    {
        id: 'reset_stats',
        category: 'Boosts',
        name: 'Reset Stats',
        objects: [{ type: 'part', x: 0, y: 0, w: 40, h: 80, color: '#bdc3c7', anchored: true, collide: false, special: 'normal_player', text: 'Reset', textSize: 12, transparency: 0.3 }]
    },

    // --- ITEMS ---
    {
        id: 'tool_flashlight',
        category: 'Items',
        name: 'Flashlight',
        objects: [{ type: 'part', x: 0, y: 0, w: 40, h: 15, color: '#2d3436', anchored: true, collide: false, special: 'flashlight', text: '🔦', textSize: 12 }]
    },

       {
        id: 'tool_sword',
        category: 'Items',
        name: 'Sword',
        objects: [{ 
            type: 'part', 
            x: 0, y: 0, 
            w: 15, h: 45, 
            color: '#bdc3c7', 
            anchored: true, 
            collide: false, 
            special: 'sword', 
            text: '⚔️', // Иконка над предметом
            textSize: 20 
        }]
    }
];

let currentModel = null;
let selectedModel = null;
let contextMenu, textBtn, modal, textInput, fontSelect, fontPreview;
let saveBtn, modelsLibraryEl;
let currentUser;
let gameId;

// ==========================================
// INITIALIZATION
// ==========================================
function initStudio() {
    canvas = document.getElementById('gameCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    modelPreviewCanvas = document.getElementById('modelPreviewCanvas');
    if (modelPreviewCanvas) {
        modelPreviewCtx = modelPreviewCanvas.getContext('2d');
    }

    contextMenu = document.getElementById('context-menu');
    if (contextMenu) {
        textBtn = contextMenu.querySelector('button:nth-child(2)');
    }

    modal = document.getElementById('text-modal-overlay');
    textInput = document.getElementById('modal-text-input');
    fontSelect = document.getElementById('modal-font-select');
    fontPreview = document.getElementById('font-preview-box');
    saveBtn = document.getElementById('save-btn');
    modelsLibraryEl = document.getElementById('models-library');

    const urlParams = new URLSearchParams(window.location.search);
    gameId = urlParams.get('id') || 'game1';

    const storedUser = localStorage.getItem('tublox_user');
    if (!storedUser) {
        currentUser = { username: "Guest" }; 
    } else {
        currentUser = JSON.parse(storedUser);
    }

    if (saveBtn) saveBtn.onclick = saveProject;

    resize();
    loadProject();
    switchTab('build');

    setupEventListeners();
    renderModelLibrary();
}

// ==========================================
// EVENT LISTENERS & RESIZE
// ==========================================
function setupEventListeners() {
    window.onresize = resize;
    if (canvas) {
        canvas.addEventListener('contextmenu', handleContextMenu);
        canvas.onmousedown = handleMouseDown;
        canvas.oncontextmenu = e => e.preventDefault();
    }
    window.onmousemove = handleMouseMove;
    window.onmouseup = handleMouseUp;
    window.addEventListener('click', () => {
        if (contextMenu) contextMenu.style.display = 'none';
        contextMenuObj = null;
    });
}

function resize() {
    if (!canvas) return;
    const ws = document.querySelector('.workspace');
    const sb = document.querySelector('.sidebar');
    
    if (ws && sb) {
        if (window.innerWidth <= 768) {
            canvas.width = ws.clientWidth;
            canvas.height = ws.clientHeight / 2;
        } else {
            canvas.width = ws.clientWidth - sb.offsetWidth;
            canvas.height = ws.clientHeight;
        }
    }
    render();
    if (currentTab === 'models') renderModelPreview();
}

// ==========================================
// PROJECT LOADING/SAVING
// ==========================================
async function loadProject() {
    try {
        const res = await fetch(`/api/load_studio/${gameId}`);
        if (!res.ok) throw new Error('Network response was not ok');
        const data = await res.json();
        
        studioObjects = data.map || [];
        
        // Migration logic
        studioObjects.forEach(obj => {
            if (obj.anchored === undefined) obj.anchored = true;
            if (obj.collide === undefined) obj.collide = true;
            if (obj.transparency === undefined) obj.transparency = 0;
            // Устанавливаем дефолтную скорость, если её нет
            if (obj.special === 'mover' && !obj.moveSpeed) obj.moveSpeed = 2; 
        });
        
        render();
        updateExplorer();
    } catch (e) {
        studioObjects = [];
        render();
        updateExplorer();
    }
}

async function saveProject() {
    const btnContent = saveBtn.innerHTML;
    saveBtn.innerHTML = ICONS.spawn + " Saving...";
    
    try {
        const res = await fetch('/api/save_game_data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                gameId,
                username: currentUser.username,
                map: studioObjects
            })
        });
        if (res.ok) alert('✅ Game saved!');
        else alert('❌ Save failed');
    } catch (error) {
        alert('❌ Error saving game');
    }
    saveBtn.innerHTML = btnContent;
}

// ==========================================
// TABS & TOOLS
// ==========================================
function switchTab(tab) {
    currentTab = tab;
    const btnText = saveBtn.querySelector('.btn-text');
    if(btnText) btnText.textContent = tab === 'build' ? 'Save' : 'Save Model';

    document.querySelectorAll('.models-tab-content').forEach(t => t.classList.remove('active'));
    const tabElement = document.getElementById(tab + '-tab');
    if (tabElement) tabElement.classList.add('active');

    if (tab === 'build') render();
    else if (tab === 'models') {
        resize();
        renderModelPreview();
    }
}

function setBuildTool(tool) {
    currentTool = tool;
    document.querySelectorAll('.model-tool').forEach(btn => btn.classList.remove('active'));
    
    let targetBtn = event ? event.target : null;
    while(targetBtn && !targetBtn.classList.contains('model-tool')) {
        targetBtn = targetBtn.parentElement;
    }
    if (targetBtn) targetBtn.classList.add('active');
    render();
}

// ==========================================
// HELPER: SCALE HANDLES
// ==========================================
function getScaleHandles(obj) {
    if (!obj) return null;
    const s = 10; 
    const hw = s / 2;
    return {
        nw: { x: obj.x - hw, y: obj.y - hw, w: s, h: s, cursor: 'nwse-resize' },
        n:  { x: obj.x + obj.w/2 - hw, y: obj.y - hw, w: s, h: s, cursor: 'ns-resize' },
        ne: { x: obj.x + obj.w - hw, y: obj.y - hw, w: s, h: s, cursor: 'nesw-resize' },
        w:  { x: obj.x - hw, y: obj.y + obj.h/2 - hw, w: s, h: s, cursor: 'ew-resize' },
        e:  { x: obj.x + obj.w - hw, y: obj.y + obj.h/2 - hw, w: s, h: s, cursor: 'ew-resize' },
        sw: { x: obj.x - hw, y: obj.y + obj.h - hw, w: s, h: s, cursor: 'nesw-resize' },
        s:  { x: obj.x + obj.w/2 - hw, y: obj.y + obj.h - hw, w: s, h: s, cursor: 'ns-resize' },
        se: { x: obj.x + obj.w - hw, y: obj.y + obj.h - hw, w: s, h: s, cursor: 'nwse-resize' }
    };
}

// ==========================================
// OBJECT MANIPULATION
// ==========================================
function addPart(model) {
    if (model) {
        model.objects.forEach(objTemplate => {
            const p = { ...objTemplate, id: Date.now() + Math.random(), x: -camX + 100, y: -camY + 100 };
            studioObjects.push(p);
            selectedObj = p;
        });
    } else {
        const p = { id: Date.now(), type: 'part', x: -camX + 100, y: -camY + 100, w: 100, h: 40, color: '#95a5a6', anchored: true, collide: true, transparency: 0, scaleX: 1, scaleY: 1 };
        studioObjects.push(p);
        selectedObj = p;
    }
    render(); updateExplorer(); showProperties();
}
window.addPartDefault = () => addPart(null);

function addSpawn() {
    const p = { id: Date.now(), type: 'spawn', x: -camX + 150, y: -camY + 100, w: 40, h: 60, color: '#00b894', anchored: true, collide: false, transparency: 0 };
    studioObjects.push(p);
    selectedObj = p;
    render(); updateExplorer(); showProperties();
}

function addText() {
    const p = { id: Date.now(), type: 'text', x: -camX + 100, y: -camY + 150, w: 120, h: 40, color: '#3498db', text: 'Text', textColor: '#fff', textSize: 20, anchored: true, collide: false };
    studioObjects.push(p);
    selectedObj = p;
    render(); updateExplorer(); showProperties();
}

function deleteObj() {
    const target = contextMenuObj || selectedObj;
    if (!target) return;
    studioObjects = studioObjects.filter(o => o !== target);
    selectedObj = null;
    if (contextMenu) contextMenu.style.display = 'none';
    contextMenuObj = null;
    render(); updateExplorer(); showProperties();
}

function duplicateObj() {
    const target = contextMenuObj || selectedObj;
    if (!target) return;
    const dup = {...target, id: Date.now(), x: target.x + 20, y: target.y + 20};
    studioObjects.push(dup);
    selectedObj = dup;
    if (contextMenu) contextMenu.style.display = 'none';
    contextMenuObj = null;
    render(); updateExplorer(); showProperties();
}

// ==========================================
// PROPERTIES PANEL
// ==========================================
function showProperties() {
    const p = document.getElementById('properties-panel');
    if (!p) return;
    if (!selectedObj) {
        p.innerHTML = '<p style="color:#666; text-align:center; margin-top:20px;">Select an object</p>';
        return;
    }

    let html = `
    <label>Type: ${selectedObj.type.toUpperCase()}</label>
    <label>Color</label>
    <input type="color" value="${selectedObj.color || '#ffffff'}" oninput="updateObjectProperty('color', this.value)">
    
    <label>Size (W x H)</label>
    <div style="display:flex; gap:5px">
        <input type="number" value="${selectedObj.w}" onchange="updateObjectProperty('w', this.value)">
        <input type="number" value="${selectedObj.h}" onchange="updateObjectProperty('h', this.value)">
    </div>
    
    <label>Position (X, Y)</label>
    <div style="display:flex; gap:5px">
        <input type="number" value="${selectedObj.x}" onchange="updateObjectProperty('x', this.value)">
        <input type="number" value="${selectedObj.y}" onchange="updateObjectProperty('y', this.value)">
    </div>

    <label>Transparency</label>
    <input type="range" min="0" max="1" step="0.1" value="${selectedObj.transparency || 0}" oninput="updateObjectProperty('transparency', this.value)">

    <div class="prop-toggle-row">
        <label for="p-anchored" style="margin:0">Anchored</label>
        <input type="checkbox" id="p-anchored" class="toggle-switch" ${selectedObj.anchored ? 'checked' : ''} onchange="updateObjectProperty('anchored', this.checked)">
    </div>
    <div class="prop-toggle-row">
        <label for="p-collide" style="margin:0">Can Collide</label>
        <input type="checkbox" id="p-collide" class="toggle-switch" ${selectedObj.collide ? 'checked' : ''} onchange="updateObjectProperty('collide', this.checked)">
    </div>
    `;

    // 1. SPINNER
    if (selectedObj.special === 'spinner') {
        html += `<hr style="border-color:#333; margin:10px 0;">
        <label style="color:#e74c3c">Rotation Speed</label>
        <input type="number" value="${selectedObj.spinSpeed || 2}" onchange="updateObjectProperty('spinSpeed', this.value)">`;
    }

    // 2. MOVER (Здесь обновлены дефолты в UI)
    if (selectedObj.special === 'mover') {
        html += `<hr style="border-color:#333; margin:10px 0;">
        <label style="color:#3498db">Move Speed (Def: 2)</label>
        <input type="number" step="0.1" value="${selectedObj.moveSpeed || 2}" onchange="updateObjectProperty('moveSpeed', this.value)">
        <label style="color:#3498db">Range X (Distance)</label>
        <input type="number" value="${selectedObj.rangeX || 0}" onchange="updateObjectProperty('rangeX', this.value)">
        <label style="color:#3498db">Range Y (Distance)</label>
        <input type="number" value="${selectedObj.rangeY || 0}" onchange="updateObjectProperty('rangeY', this.value)">`;
    }

    // 3. BOOSTS
    if (selectedObj.special === 'speed_up') {
        html += `<hr style="border-color:#333; margin:10px 0;">
        <label style="color:#f1c40f">Speed Power (Def: 6)</label>
        <input type="number" value="${selectedObj.customSpeed || 16}" onchange="updateObjectProperty('customSpeed', this.value)">`;
    }
    if (selectedObj.special === 'jump_boost') {
        html += `<hr style="border-color:#333; margin:10px 0;">
        <label style="color:#2ecc71">Jump Power (Def: 15)</label>
        <input type="number" value="${selectedObj.customJump || 30}" onchange="updateObjectProperty('customJump', this.value)">`;
    }
    if (selectedObj.special === 'big_player' || selectedObj.special === 'small_player') {
        html += `<hr style="border-color:#333; margin:10px 0;">
        <label style="color:#9b59b6">Scale Factor (Def: 1)</label>
        <input type="number" step="0.1" value="${selectedObj.customScale || 1}" onchange="updateObjectProperty('customScale', this.value)">`;
    }

    if (selectedObj.type === 'text' || selectedObj.text) {
        html += `<hr style="border-color:#333; margin:10px 0;"> 
        <label>Text Content</label> 
        <input type="text" value="${selectedObj.text || ''}" oninput="updateObjectProperty('text', this.value)"> 
        <label>Text Color</label> 
        <input type="color" value="${selectedObj.textColor || '#ffffff'}" oninput="updateObjectProperty('textColor', this.value)"> 
        <label>Text Size</label> 
        <input type="range" min="10" max="100" value="${selectedObj.textSize || 20}" oninput="updateObjectProperty('textSize', this.value)"> 
        <button class="btn-studio" onclick="openTextEditor()" style="margin-top:10px; width:100%; justify-content:center; display:flex; gap:5px; background:#444; color:white; padding:5px; border-radius:3px; border:none;">${ICONS.edit} Edit Font</button>`;
    }

    html += `<hr style="border-color:#333; margin:15px 0;"> 
    <button class="btn-studio" onclick="deleteObj()" style="background:var(--studio-danger); border:none; color:white; width:100%; justify-content:center; display:flex; gap:5px; padding:8px; border-radius:3px;">${ICONS.trash} Delete Object</button>`;
    p.innerHTML = html;
}

function updateObjectProperty(prop, val) {
    if (!selectedObj) return;
    if (['w','h','x','y','textSize','transparency','scaleX','scaleY', 'customSpeed', 'customJump', 'customScale', 'spinSpeed', 'moveSpeed', 'rangeX', 'rangeY'].includes(prop)) {
        selectedObj[prop] = Number(val);
    }
    else if (['anchored','collide'].includes(prop)) selectedObj[prop] = Boolean(val);
    else selectedObj[prop] = val;
    render();
}

// ==========================================
// EXPLORER LIST
// ==========================================
function updateExplorer() {
    const list = document.getElementById('explorer-list');
    if (!list) return;
    list.innerHTML = '';

    if (studioObjects.length === 0) {
        list.innerHTML = '<p style="color:#666; text-align:center; margin-top:20px; font-size:0.8rem;">Empty map</p>';
        return;
    }

    [...studioObjects].reverse().forEach(obj => {
        const div = document.createElement('div');
        div.className = `obj-item ${selectedObj === obj ? 'selected' : ''}`;
        
        let icon = ICONS.part;
        if (obj.type === 'spawn') icon = ICONS.spawn;
        if (obj.type === 'text') icon = ICONS.text;

        div.innerHTML = `${icon} <span>${obj.special ? obj.special : obj.type} <span style="opacity:0.5">#${obj.id.toString().slice(-3)}</span></span>`;
        
        div.onclick = () => {
            selectedObj = obj;
            showProperties();
            render();
            updateExplorer();
        };
        list.appendChild(div);
    });
}

// ==========================================
// CANVAS INTERACTION & RENDERING
// ==========================================
function handleContextMenu(e) {
    e.preventDefault();
    const mx = e.offsetX - camX;
    const my = e.offsetY - camY;
    
    const hit = studioObjects.slice().reverse().find(o => 
        mx > o.x && mx < o.x + o.w && my > o.y && my < o.y + o.h
    );

    if (hit) {
        contextMenuObj = hit;
        selectedObj = hit;
        if (textBtn) textBtn.innerHTML = (hit.text && hit.text.length > 0) 
            ? `${ICONS.edit} Edit Text` 
            : `${ICONS.edit} Add Text`;
        
        if (contextMenu) {
            contextMenu.style.display = 'flex';
            let left = e.clientX;
            let top = e.clientY;
            if (left + 200 > window.innerWidth) left = window.innerWidth - 200;
            contextMenu.style.left = left + 'px';
            contextMenu.style.top = top + 'px';
        }
        showProperties();
        render();
    } else {
        if (contextMenu) contextMenu.style.display = 'none';
        contextMenuObj = null;
    }
}

function handleMouseDown(e) {
    if (e.button === 0) {
        if (contextMenu) contextMenu.style.display = 'none';
        contextMenuObj = null;
    }
    if (e.button === 2) {
        isPanning = true;
        startX = e.offsetX;
        startY = e.offsetY;
        return;
    }

    const mx = e.offsetX - camX;
    const my = e.offsetY - camY;

    // === SCALE LOGIC ===
    if (currentTool === 'scale' && selectedObj) {
        const handles = getScaleHandles(selectedObj);
        for (let key in handles) {
            const h = handles[key];
            if (mx >= h.x && mx <= h.x + h.w && my >= h.y && my <= h.y + h.h) {
                isResizing = true;
                resizeHandle = key;
                resizeStart = {
                    x: selectedObj.x,
                    y: selectedObj.y,
                    w: selectedObj.w,
                    h: selectedObj.h,
                    mx: mx,
                    my: my
                };
                return; 
            }
        }
    }

    const hit = studioObjects.slice().reverse().find(o => 
        mx > o.x && mx < o.x + o.w && my > o.y && my < o.y + o.h
    );

    if (hit) {
        selectedObj = hit;
        isDragging = true;
        startX = mx - hit.x;
        startY = my - hit.y;
        showProperties();
        updateExplorer();
        render();
    } else {
        // Create Logic
        if (['part','spawn','text'].includes(currentTool)) {
            let newObj;
            const gridSnap = (val) => Math.round(val/10)*10;
            const gx = gridSnap(mx);
            const gy = gridSnap(my);
            const id = Date.now();

            if (currentTool === 'part') newObj = { id, type: 'part', x: gx, y: gy, w: 100, h: 40, color: '#95a5a6', anchored: true, collide: true, transparency: 0 };
            else if (currentTool === 'spawn') newObj = { id, type: 'spawn', x: gx, y: gy, w: 40, h: 60, color: '#00b894', anchored: true, collide: false, transparency: 0 };
            else if (currentTool === 'text') newObj = { id, type: 'text', x: gx, y: gy, w: 120, h: 40, color: '#3498db', text: 'Text', textColor: '#fff', textSize: 20, anchored: true, collide: false };

            if (newObj) {
                studioObjects.push(newObj);
                selectedObj = newObj;
                isDragging = true;
                startX = mx - newObj.x;
                startY = my - newObj.y;
                showProperties();
                updateExplorer();
                render();
            }
        } else {
            selectedObj = null; // Deselect
            showProperties();
            updateExplorer();
            render();
        }
    }
}

function handleMouseMove(e) {
    const mx = e.offsetX - camX;
    const my = e.offsetY - camY;

    // Cursor for Scale
    if (currentTool === 'scale' && selectedObj && !isDragging && !isResizing) {
        const handles = getScaleHandles(selectedObj);
        let hover = false;
        for (let key in handles) {
            const h = handles[key];
            if (mx >= h.x && mx <= h.x + h.w && my >= h.y && my <= h.y + h.h) {
                canvas.style.cursor = h.cursor;
                hover = true;
            }
        }
        if (!hover) canvas.style.cursor = isPanning ? 'grabbing' : 'default';
    } else {
        canvas.style.cursor = isPanning ? 'grabbing' : 'default';
    }

    if (isPanning) {
        camX += e.movementX;
        camY += e.movementY;
        render();
        return;
    }

    // === RESIZING ===
    if (isResizing && selectedObj) {
        const dx = Math.round((mx - resizeStart.mx) / 10) * 10;
        const dy = Math.round((my - resizeStart.my) / 10) * 10;
        const minSize = 10;

        if (resizeHandle.includes('e')) selectedObj.w = Math.max(minSize, resizeStart.w + dx);
        if (resizeHandle.includes('w')) {
            const newW = resizeStart.w - dx;
            if (newW >= minSize) {
                selectedObj.x = resizeStart.x + dx;
                selectedObj.w = newW;
            }
        }
        if (resizeHandle.includes('s')) selectedObj.h = Math.max(minSize, resizeStart.h + dy);
        if (resizeHandle.includes('n')) {
            const newH = resizeStart.h - dy;
            if (newH >= minSize) {
                selectedObj.y = resizeStart.y + dy;
                selectedObj.h = newH;
            }
        }
        showProperties();
        render();
        return;
    }

    if (isDragging && selectedObj) {
        selectedObj.x = Math.round((mx - startX)/10)*10;
        selectedObj.y = Math.round((my - startY)/10)*10;
        showProperties();
        render();
    }
}

function handleMouseUp() {
    isPanning = false;
    isDragging = false;
    isResizing = false;
    resizeHandle = null;
    if(canvas) canvas.style.cursor = 'default';
}

// ==========================================
// TEXT EDITOR
// ==========================================
function openTextEditor() {
    const obj = contextMenuObj || selectedObj;
    if (!obj) return;
    if (textInput) textInput.value = obj.text || "";
    if (fontSelect) fontSelect.value = obj.font || "Arial";
    updateFontPreview();
    if (modal) modal.style.display = 'flex';
    if (contextMenu) contextMenu.style.display = 'none';
}

function closeTextModal() { if (modal) modal.style.display = 'none'; }

function updateFontPreview() {
    if (fontPreview && fontSelect) {
        fontPreview.style.fontFamily = fontSelect.value;
        fontPreview.innerText = (textInput && textInput.value) ? textInput.value : "Preview";
    }
}

function applyText() {
    const obj = contextMenuObj || selectedObj;
    if (obj && textInput && fontSelect) {
        obj.text = textInput.value;
        obj.font = fontSelect.value;
    }
    closeTextModal();
    render();
    showProperties();
}

// ==========================================
// RENDER LOOP
// ==========================================
function render() {
    if (!ctx || !canvas) return;

    // Clear
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(camX, camY);

    // Grid
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = -2000; i < 3000; i += 50) {
        ctx.moveTo(i, -2000); ctx.lineTo(i, 3000);
        ctx.moveTo(-2000, i); ctx.lineTo(3000, i);
    }
    ctx.stroke();

    // Objects
    studioObjects.forEach(obj => {
        ctx.save();
        ctx.globalAlpha = 1 - (obj.transparency || 0);
        if (obj.collide === false) ctx.globalAlpha *= 0.6;
        ctx.fillStyle = obj.color;

        // --- RENDER SPINNER (Preview Rotation) ---
        if (obj.special === 'spinner') {
            ctx.translate(obj.x + obj.w/2, obj.y + obj.h/2);
            ctx.rotate(Date.now() / 1000); 
            ctx.fillRect(-obj.w/2, -obj.h/2, obj.w, obj.h);
        } else {
            ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
        }

        // --- RENDER MOVER PATH ---
        if (obj.special === 'mover') {
            ctx.restore(); 
            ctx.save(); 
            ctx.translate(camX, camY); 
            
            // Рисуем путь (пунктир)
            ctx.strokeStyle = '#3498db';
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(obj.x + obj.w/2, obj.y + obj.h/2);
            ctx.lineTo(obj.x + obj.w/2 + (obj.rangeX||0), obj.y + obj.h/2 + (obj.rangeY||0));
            ctx.stroke();

            // Рисуем "Призрак" конечной точки
            ctx.globalAlpha = 0.2;
            ctx.fillStyle = obj.color;
            ctx.fillRect(obj.x + (obj.rangeX||0), obj.y + (obj.rangeY||0), obj.w, obj.h);
        }
        
        ctx.restore(); 
        ctx.save(); 
        ctx.translate(camX, camY);

        if (obj.anchored === false) {
            ctx.strokeStyle = '#ff7675';
            ctx.strokeRect(obj.x+2, obj.y+2, obj.w-4, obj.h-4);
        }
        
        if (obj.text && obj.special !== 'spinner') {
            ctx.fillStyle = obj.textColor || 'white';
            ctx.font = `bold ${obj.textSize || 20}px "${obj.font || 'Arial'}"`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(obj.text, obj.x + obj.w/2, obj.y + obj.h/2);
        }
        
        if (selectedObj === obj) {
            ctx.strokeStyle = '#00cec9';
            ctx.lineWidth = 2;
            ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
        }
        ctx.restore();
    });

    // === DRAW SCALE HANDLES ===
    if (currentTool === 'scale' && selectedObj) {
        const handles = getScaleHandles(selectedObj);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        
        for (let key in handles) {
            const h = handles[key];
            ctx.beginPath();
            ctx.arc(h.x + h.w/2, h.y + h.h/2, h.w/2, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
    }

    ctx.restore();
}

// ==========================================
// MODEL LIBRARY UI
// ==========================================
function renderModelLibrary() {
    if (!modelsLibraryEl) return;
    modelsLibraryEl.innerHTML = '';
    
    if (modelsLibrary.length === 0) {
        modelsLibraryEl.innerHTML = '<div style="color:#666; font-size:12px;">No models</div>';
        return;
    }

    // Группируем модели
    const categories = {};
    modelsLibrary.forEach(model => {
        const cat = model.category || 'Misc';
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(model);
    });

    // Отрисовываем
    for (const [catName, models] of Object.entries(categories)) {
        // Заголовок
        const header = document.createElement('div');
        header.style.gridColumn = '1 / -1';
        header.style.color = '#888';
        header.style.fontSize = '11px';
        header.style.fontWeight = 'bold';
        header.style.marginTop = '10px';
        header.style.marginBottom = '5px';
        header.style.textTransform = 'uppercase';
        header.innerText = catName;
        modelsLibraryEl.appendChild(header);

        // Модели
        models.forEach(model => {
            const el = document.createElement('div');
            el.className = 'model-item';
            el.innerHTML = `<div style="margin-bottom:5px; font-size:20px;">${model.objects[0].text || ICONS.box}</div><div style="font-size:10px;">${model.name}</div>`;
            el.onclick = () => {
                selectedModel = model;
                currentModel = model;
                addPart(model);
                renderModelPreview();
            };
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

// Boot
document.addEventListener('DOMContentLoaded', initStudio);
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const urlParams = new URLSearchParams(window.location.search);
const gameId = urlParams.get('id');
const user = JSON.parse(localStorage.getItem('tublox_user'));

let studioObjects = [];
let selectedObj = null;

// Камера и состояния
let camX = 0, camY = 0;
let isPanning = false;
let isDragging = false;
let isScaling = false;
let scaleDir = ''; // nw, ne, sw, se
let startX, startY;

function resize() {
    canvas.width = window.innerWidth - 300;
    canvas.height = window.innerHeight - 45;
    render();
}
window.onresize = resize;
resize();

// --- ЗАГРУЗКА И СОХРАНЕНИЕ ---
async function loadProject() {
    if (!gameId) return;
    try {
        const res = await fetch(`/api/load_studio/${gameId}`);
        const data = await res.json();
        studioObjects = data.map || [];
        if (document.getElementById('publishStatus')) {
            document.getElementById('publishStatus').value = data.status || 'private';
        }
        render();
        updateExplorer();
    } catch (e) { console.error("Load error:", e); }
}

async function saveMap() {
    const status = document.getElementById('publishStatus').value;
    const res = await fetch('/api/save_game_data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, username: user.username, map: studioObjects, status })
    });
    if (res.ok) {
        const btn = document.querySelector('button[onclick="saveMap()"]');
        if(btn) {
            btn.innerText = "✅ Saved!";
            setTimeout(() => btn.innerText = "Save Project", 2000);
        }
    }
}

// --- ОТРИСОВКА ---
function render() {
    ctx.fillStyle = '#252525';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(camX, camY);

    // Сетка
    ctx.strokeStyle = '#333';
    for (let x = -2000; x < 2000; x += 50) {
        ctx.beginPath(); ctx.moveTo(x, -2000); ctx.lineTo(x, 2000); ctx.stroke();
    }
    for (let y = -2000; y < 2000; y += 50) {
        ctx.beginPath(); ctx.moveTo(-2000, y); ctx.lineTo(2000, y); ctx.stroke();
    }

    studioObjects.forEach(obj => {
        // Тело блока
        ctx.fillStyle = obj.color || '#9b59b6';
        ctx.fillRect(obj.x, obj.y, obj.w, obj.h);

        // Текст на блоке
        if (obj.text) {
            ctx.fillStyle = obj.textColor || 'white';
            ctx.font = `${obj.textSize || 20}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(obj.text, obj.x + obj.w/2, obj.y + obj.h/2);
        }

        // Выделение и узлы Scale
        if (selectedObj === obj) {
            ctx.strokeStyle = '#00a2ff';
            ctx.lineWidth = 2;
            ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
            
            ctx.fillStyle = 'white';
            const s = 8; // размер узла
            ctx.fillRect(obj.x - s/2, obj.y - s/2, s, s); // nw
            ctx.fillRect(obj.x + obj.w - s/2, obj.y - s/2, s, s); // ne
            ctx.fillRect(obj.x - s/2, obj.y + obj.h - s/2, s, s); // sw
            ctx.fillRect(obj.x + obj.w - s/2, obj.y + obj.h - s/2, s, s); // se
        }
    });

    ctx.restore();
}

// --- МЫШЬ ---
canvas.onmousedown = (e) => {
    const mx = e.offsetX - camX;
    const my = e.offsetY - camY;

    if (e.button === 2) { isPanning = true; return; }

    // Проверка клика по узлам Scale
    if (selectedObj) {
        const s = 10;
        if (Math.abs(mx - selectedObj.x) < s && Math.abs(my - selectedObj.y) < s) { isScaling = true; scaleDir = 'nw'; return; }
        if (Math.abs(mx - (selectedObj.x + selectedObj.w)) < s && Math.abs(my - selectedObj.y) < s) { isScaling = true; scaleDir = 'ne'; return; }
        if (Math.abs(mx - selectedObj.x) < s && Math.abs(my - (selectedObj.y + selectedObj.h)) < s) { isScaling = true; scaleDir = 'sw'; return; }
        if (Math.abs(mx - (selectedObj.x + selectedObj.w)) < s && Math.abs(my - (selectedObj.y + selectedObj.h)) < s) { isScaling = true; scaleDir = 'se'; return; }
    }

    // Выбор объекта
    let found = [...studioObjects].reverse().find(o => mx >= o.x && mx <= o.x + o.w && my >= o.y && my <= o.y + o.h);
    if (found) {
        selectedObj = found;
        isDragging = true;
        startX = mx - selectedObj.x;
        startY = my - selectedObj.y;
        showProperties();
    } else {
        selectedObj = null;
        document.getElementById('properties-panel').innerHTML = '<p style="text-align:center;color:#666">Select part</p>';
    }
    render();
    updateExplorer();
};

window.onmousemove = (e) => {
    const mx = (e.clientX - canvas.offsetLeft) - camX;
    const my = (e.clientY - canvas.offsetTop) - camY;

    if (isPanning) {
        camX += e.movementX; camY += e.movementY;
    } else if (isScaling && selectedObj) {
        if (scaleDir === 'se') {
            selectedObj.w = Math.max(10, mx - selectedObj.x);
            selectedObj.h = Math.max(10, my - selectedObj.y);
        } else if (scaleDir === 'nw') {
            let r = selectedObj.x + selectedObj.w;
            let b = selectedObj.y + selectedObj.h;
            selectedObj.x = Math.min(r - 10, mx);
            selectedObj.y = Math.min(b - 10, my);
            selectedObj.w = r - selectedObj.x;
            selectedObj.h = b - selectedObj.y;
        }
    } else if (isDragging && selectedObj) {
        selectedObj.x = Math.round((mx - startX)/10)*10;
        selectedObj.y = Math.round((my - startY)/10)*10;
    }
    if(isPanning || isScaling || isDragging) render();
};

window.onmouseup = () => { isPanning = false; isDragging = false; isScaling = false; };
canvas.oncontextmenu = (e) => e.preventDefault();

// --- UI ЛОГИКА ---
function updateExplorer() {
    const list = document.getElementById('explorer-list');
    if(!list) return;
    list.innerHTML = '';
    studioObjects.forEach(obj => {
        const d = document.createElement('div');
        d.className = `obj-item ${selectedObj === obj ? 'selected' : ''}`;
        d.innerHTML = `📦 ${obj.name || 'Part'}`;
        d.onclick = () => { selectedObj = obj; render(); showProperties(); updateExplorer(); };
        list.appendChild(d);
    });
}

function showProperties() {
    const panel = document.getElementById('properties-panel');
    if (!selectedObj) return;

    panel.innerHTML = `
        <label>Text Content</label>
        <input type="text" id="p-text" value="${selectedObj.text || ''}">
        <label>Text Size & Color</label>
        <div style="display:flex;gap:5px">
            <input type="number" id="p-tsize" value="${selectedObj.textSize || 20}">
            <input type="color" id="p-tcolor" value="${selectedObj.textColor || '#ffffff'}">
        </div>
        <hr>
        <label>Part Color</label>
        <input type="color" id="p-color" value="${selectedObj.color || '#9b59b6'}">
        <button onclick="deleteObj()" style="background:#c0392b;width:100%;margin-top:10px">Delete</button>
    `;

    document.getElementById('p-text').oninput = (e) => { selectedObj.text = e.target.value; render(); };
    document.getElementById('p-tsize').oninput = (e) => { selectedObj.textSize = Number(e.target.value); render(); };
    document.getElementById('p-tcolor').oninput = (e) => { selectedObj.textColor = e.target.value; render(); };
    document.getElementById('p-color').oninput = (e) => { selectedObj.color = e.target.value; render(); };
}

function addPart() {
    const p = { id: 'p'+Date.now(), type: 'part', name: 'Part', x: -camX + 100, y: -camY + 100, w: 100, h: 50, color: '#95a5a6', text: '', textSize: 20, textColor: '#ffffff' };
    studioObjects.push(p);
    selectedObj = p;
    render(); updateExplorer(); showProperties();
}

function deleteObj() {
    studioObjects = studioObjects.filter(o => o !== selectedObj);
    selectedObj = null;
    render(); updateExplorer();
}

loadProject();
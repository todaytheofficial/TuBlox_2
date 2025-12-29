// ==========================================
//   GLOBAL VARIABLES
// ==========================================

// Canvas и контекст
let canvas, ctx;
let modelPreviewCanvas, modelPreviewCtx;

// Studio state
let studioObjects = [];
let selectedObj = null;
let camX = 0, camY = 0;
let isPanning = false, isDragging = false;
let startX, startY;
let contextMenuObj = null;

// TuModels state
let currentTool = 'part'; // 'part', 'spawn', 'text'
let currentTab = 'build';
let modelsLibrary = [];
let currentModel = null;
let selectedModel = null;

// DOM elements
let contextMenu, textBtn, modal, textInput, fontSelect, fontPreview;
let saveBtn, modelsLibraryEl;

// User data
let currentUser;
let gameId;

// ==========================================
//   INITIALIZATION
// ==========================================

function initStudio() {
    // Получаем canvas и контекст
    canvas = document.getElementById('gameCanvas');
    if (!canvas) {
        console.error('Canvas not found!');
        return;
    }
    ctx = canvas.getContext('2d');
    
    // Получаем preview canvas
    modelPreviewCanvas = document.getElementById('modelPreviewCanvas');
    if (modelPreviewCanvas) {
        modelPreviewCtx = modelPreviewCanvas.getContext('2d');
    }
    
    // Получаем DOM элементы
    contextMenu = document.getElementById('context-menu');
    if (contextMenu) {
        textBtn = contextMenu.querySelector('button:first-child');
    }
    
    modal = document.getElementById('text-modal-overlay');
    textInput = document.getElementById('modal-text-input');
    fontSelect = document.getElementById('modal-font-select');
    fontPreview = document.getElementById('font-preview-box');
    
    saveBtn = document.getElementById('save-btn');
    modelsLibraryEl = document.getElementById('models-library');
    
    // Получаем параметры URL
    const urlParams = new URLSearchParams(window.location.search);
    gameId = urlParams.get('id') || 'game1';
    
    // Проверяем авторизацию
    const storedUser = localStorage.getItem('tublox_user');
    if (!storedUser) { 
        alert("Login required!"); 
        window.location.href = 'login.html'; 
        return;
    }
    currentUser = JSON.parse(storedUser);
    
    // Настраиваем кнопку сохранения
    if (saveBtn) {
        saveBtn.onclick = saveProject;
    }
    
    // Инициализируем размеры и загружаем проект
    resize();
    loadProject();
    
    // Устанавливаем начальное состояние
    switchTab('build');
    
    // Устанавливаем активный инструмент
    const partToolBtn = document.querySelector('.model-tool[onclick*="part"]');
    if (partToolBtn) {
        partToolBtn.classList.add('active');
    }
    
    // Добавляем обработчики событий
    setupEventListeners();
}

// ==========================================
//   EVENT LISTENERS
// ==========================================

function setupEventListeners() {
    // Обработчик изменения размера окна
    window.onresize = resize;
    
    // Обработчик контекстного меню
    if (canvas) {
        canvas.addEventListener('contextmenu', handleContextMenu);
        canvas.onmousedown = handleMouseDown;
        canvas.oncontextmenu = e => e.preventDefault();
    }
    
    // Глобальные обработчики мыши
    window.onmousemove = handleMouseMove;
    window.onmouseup = handleMouseUp;
    
    // Клик вне контекстного меню
    window.addEventListener('click', () => {
        if (contextMenu) {
            contextMenu.style.display = 'none';
        }
        contextMenuObj = null;
    });
}

// ==========================================
//   RESIZE HANDLING
// ==========================================

function resize() {
    if (!canvas) return;
    
    const ws = document.querySelector('.workspace');
    if(ws) {
        canvas.width = ws.clientWidth - 300; 
        canvas.height = ws.clientHeight;
    }
    render();
}

// ==========================================
//   PROJECT LOADING/SAVING
// ==========================================

async function loadProject() {
    try {
        const res = await fetch(`/api/load_studio/${gameId}`);
        const data = await res.json();
        studioObjects = data.map || [];
        
        // Миграция старых карт
        studioObjects.forEach(obj => {
            if (obj.anchored === undefined) obj.anchored = true;
            if (obj.collide === undefined) obj.collide = true;
        });

        render();
        updateExplorer();
        loadModels();
    } catch (e) { 
        console.error('Error loading project:', e); 
        studioObjects = [];
        render();
        updateExplorer();
        loadModels();
    }
}

async function saveProject() {
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
        
        if (res.ok) {
            alert('✅ Game saved to server!');
        } else {
            alert('❌ Save failed');
        }
    } catch (error) {
        console.error('Save error:', error);
        alert('❌ Error saving game');
    }
}

// ==========================================
//   TAB MANAGEMENT
// ==========================================

function switchTab(tab) {
    currentTab = tab;
    
    if (saveBtn) {
        saveBtn.textContent = tab === 'build' ? '💾 Save Game' : '💾 Save Model';
        saveBtn.onclick = tab === 'build' ? saveProject : saveModel;
    }
    
    // Скрываем все вкладки
    document.querySelectorAll('.models-tab-content').forEach(function(t) {
        t.classList.remove('active');
    });
    
    // Показываем выбранную
    const tabElement = document.getElementById(tab + '-tab');
    if (tabElement) {
        tabElement.classList.add('active');
    }
    
    if (tab === 'build') {
        render();
    } else if (tab === 'models') {
        renderModelPreview();
    }
}

// ==========================================
//   BUILD TOOLS
// ==========================================

function addPart() {
    const p = { 
        id: Date.now(), 
        type: 'part', 
        x: -camX+100, y: -camY+100, w: 100, h: 40, 
        color: '#95a5a6',
        anchored: true,
        collide: true
    };
    studioObjects.push(p);
    selectedObj = p;
    render();
    updateExplorer();
    showProperties();
}

function addSpawn() {
    const s = { 
        id: Date.now(), 
        type: 'spawn', 
        x: -camX+100, y: -camY+100, w: 40, h: 60, 
        color: '#00b894',
        anchored: true,
        collide: false
    };
    studioObjects.push(s);
    selectedObj = s;
    render();
    updateExplorer();
    showProperties();
}

function addText() {
    const t = { 
        id: Date.now(), 
        type: 'text', 
        x: -camX+100, y: -camY+100, w: 120, h: 40, 
        color: '#3498db',
        text: 'New Text',
        textColor: '#ffffff',
        font: 'Arial',
        textSize: 20,
        anchored: true,
        collide: false
    };
    studioObjects.push(t);
    selectedObj = t;
    render();
    updateExplorer();
    showProperties();
}

function setBuildTool(tool) {
    currentTool = tool;
    
    // Обновляем активные кнопки
    const buttons = document.querySelectorAll('.model-tool');
    buttons.forEach(function(btn) {
        btn.classList.remove('active');
    });
    
    // Находим нажатую кнопку
    let targetBtn = event ? event.target : null;
    if (!targetBtn && window.event) {
        targetBtn = window.event.srcElement;
    }
    
    if (targetBtn && targetBtn.classList.contains('model-tool')) {
        targetBtn.classList.add('active');
    }
}

function deleteObj() {
    const target = contextMenuObj || selectedObj;
    if(!target) return;
    
    studioObjects = studioObjects.filter(o => o !== target);
    selectedObj = null;
    
    if (contextMenu) {
        contextMenu.style.display = 'none';
    }
    contextMenuObj = null;
    
    render();
    updateExplorer();
    showProperties();
}

// ==========================================
//   PROPERTIES PANEL
// ==========================================

function showProperties() {
    const p = document.getElementById('properties-panel');
    if (!p) return;
    
    if (!selectedObj) { 
        p.innerHTML = '<p style="color:#666; text-align:center; margin-top:20px;">Select an object or create one</p>'; 
        return; 
    }
    
    let propertiesHTML = `
        <label>Type: ${selectedObj.type.toUpperCase()}</label>
        
        <label>Object Color</label>
        <input type="color" value="${selectedObj.color || '#ffffff'}" oninput="updateObjectProperty('color', this.value)">
        
        <label>Dimensions (W x H)</label>
        <div style="display:flex; gap:5px">
            <input type="number" value="${selectedObj.w}" onchange="updateObjectProperty('w', this.value)">
            <input type="number" value="${selectedObj.h}" onchange="updateObjectProperty('h', this.value)">
        </div>

        <label>Position (X, Y)</label>
        <div style="display:flex; gap:5px">
            <input type="number" value="${selectedObj.x}" onchange="updateObjectProperty('x', this.value)">
            <input type="number" value="${selectedObj.y}" onchange="updateObjectProperty('y', this.value)">
        </div>

        <hr style="border-color:#333; margin:15px 0;">
        <label>Physics</label>

        <!-- Anchored Toggle -->
        <div class="prop-toggle-row">
            <label for="p-anchored">Anchored</label>
            <input type="checkbox" id="p-anchored" class="toggle-switch" 
                ${selectedObj.anchored ? 'checked' : ''} 
                onchange="updateObjectProperty('anchored', this.checked)">
        </div>

        <!-- Collide Toggle -->
        <div class="prop-toggle-row">
            <label for="p-collide">Can Collide</label>
            <input type="checkbox" id="p-collide" class="toggle-switch" 
                ${selectedObj.collide ? 'checked' : ''} 
                onchange="updateObjectProperty('collide', this.checked)">
        </div>
    `;
    
    if (selectedObj.type === 'text' || selectedObj.text) {
        propertiesHTML += `
            <hr style="border-color:#333; margin:15px 0;">
            <label>Text Properties</label>
            <input type="text" value="${selectedObj.text || ''}" placeholder="Text content" 
                oninput="updateObjectProperty('text', this.value)">
            
            <label>Text Color</label>
            <input type="color" value="${selectedObj.textColor || '#ffffff'}" 
                oninput="updateObjectProperty('textColor', this.value)">
            
            <label>Font Size</label>
            <input type="range" min="10" max="50" value="${selectedObj.textSize || 20}" 
                oninput="updateObjectProperty('textSize', this.value)">
            
            <button onclick="openTextEditor()" style="margin-top:10px; width:100%;">✏️ Edit Text Font</button>
        `;
    }
    
    propertiesHTML += `
        <hr style="border-color:#333; margin:15px 0;">
        <button onclick="deleteObj()" style="background:var(--danger); margin-top:20px; width:100%;">🗑 Delete Object</button>
    `;
    
    p.innerHTML = propertiesHTML;
}

function updateObjectProperty(property, value) {
    if (!selectedObj) return;
    
    if (property === 'w' || property === 'h' || property === 'x' || property === 'y' || property === 'textSize') {
        selectedObj[property] = Number(value);
    } else if (property === 'anchored' || property === 'collide') {
        selectedObj[property] = Boolean(value);
    } else {
        selectedObj[property] = value;
    }
    
    render();
}

// ==========================================
//   CONTEXT MENU HANDLING
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
        
        if (textBtn) {
            if (hit.text && hit.text.length > 0) {
                textBtn.innerText = "✏️ Edit Text";
            } else {
                textBtn.innerText = "📝 Add Text";
            }
        }

        if (contextMenu) {
            contextMenu.style.display = 'flex';
            contextMenu.style.left = e.clientX + 'px';
            contextMenu.style.top = e.clientY + 'px';
        }
        
        showProperties();
        render();
    } else {
        if (contextMenu) {
            contextMenu.style.display = 'none';
        }
        contextMenuObj = null;
    }
}

// ==========================================
//   MOUSE HANDLING
// ==========================================

function handleMouseDown(e) {
    if (e.button === 0) {
        if (contextMenu) {
            contextMenu.style.display = 'none';
        }
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
    
    // Проверка на перетаскивание существующего объекта
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
        return;
    }
    
    // Создание нового объекта
    if (!hit) {
        let newObj;
        switch(currentTool) {
            case 'part':
                newObj = { 
                    id: Date.now(), 
                    type: 'part', 
                    x: Math.round(mx/10)*10, 
                    y: Math.round(my/10)*10, 
                    w: 100, h: 40, 
                    color: '#95a5a6',
                    anchored: true,
                    collide: true
                };
                break;
            case 'spawn':
                newObj = { 
                    id: Date.now(), 
                    type: 'spawn', 
                    x: Math.round(mx/10)*10, 
                    y: Math.round(my/10)*10, 
                    w: 40, h: 60, 
                    color: '#00b894',
                    anchored: true,
                    collide: false
                };
                break;
            case 'text':
                newObj = { 
                    id: Date.now(), 
                    type: 'text', 
                    x: Math.round(mx/10)*10, 
                    y: Math.round(my/10)*10, 
                    w: 120, h: 40, 
                    color: '#3498db',
                    text: 'Text',
                    textColor: '#ffffff',
                    font: 'Arial',
                    textSize: 20,
                    anchored: true,
                    collide: false
                };
                break;
        }
        
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
    }
}

function handleMouseMove(e) {
    if(isPanning) { 
        camX += e.movementX; 
        camY += e.movementY; 
        render(); 
    }
    
    if(isDragging && selectedObj) {
        const mx = e.offsetX - camX; 
        const my = e.offsetY - camY;
        
        selectedObj.x = Math.round((mx - startX)/10)*10;
        selectedObj.y = Math.round((my - startY)/10)*10;
        
        render();
    }
}

function handleMouseUp() { 
    isPanning = false; 
    isDragging = false; 
}

// ==========================================
//   TEXT EDITOR
// ==========================================

function openTextEditor() {
    if (!contextMenuObj && !selectedObj) return;
    const obj = contextMenuObj || selectedObj;
    if (textInput) textInput.value = obj.text || "";
    if (fontSelect) fontSelect.value = obj.font || "Arial";
    updateFontPreview();
    if (modal) modal.style.display = 'flex';
    
    if (contextMenu) {
        contextMenu.style.display = 'none';
    }
    contextMenuObj = null;
}

function closeTextModal() { 
    if (modal) modal.style.display = 'none'; 
}

function updateFontPreview() {
    if (fontPreview && fontSelect) {
        fontPreview.style.fontFamily = fontSelect.value;
        fontPreview.innerText = (textInput && textInput.value) ? textInput.value : "Preview Text";
    }
}

function applyText() {
    const obj = contextMenuObj || selectedObj;
    if (obj && textInput && fontSelect) {
        obj.text = textInput.value;
        obj.font = fontSelect.value;
        if (!obj.textSize) obj.textSize = 20;
        if (!obj.textColor) obj.textColor = '#ffffff';
    }
    closeTextModal(); 
    render(); 
    showProperties();
}

// ==========================================
//   RENDERING
// ==========================================

function updateExplorer() {
    const list = document.getElementById('explorer-list');
    if(!list) return;
    list.innerHTML = '';
    
    if (studioObjects.length === 0) {
        list.innerHTML = '<p style="color:#666; text-align:center; margin-top:20px;">No objects yet. Click to add.</p>';
        return;
    }
    
    studioObjects.forEach(obj => {
        const div = document.createElement('div');
        div.className = `obj-item ${selectedObj === obj ? 'selected' : ''}`;
        
        let icon = '◻';
        if (obj.type === 'spawn') icon = '🚀';
        if (obj.type === 'text') icon = '📝';
        
        div.innerHTML = `
            <span style="font-size: 0.875rem; color: var(--studio-text-dim);">${icon}</span>
            <span>${obj.type.toUpperCase()} #${obj.id.toString().slice(-4)}</span>
        `;
        
        div.onclick = () => { 
            selectedObj = obj; 
            showProperties(); 
            render(); 
            updateExplorer(); 
        };
        list.appendChild(div);
    });
}

function render() {
    if (!ctx || !canvas) return;
    
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(camX, camY);
    
    // Сетка
    ctx.strokeStyle = '#2a2a2a'; 
    ctx.lineWidth = 1; 
    ctx.beginPath();
    for(let i=-2000; i<2000; i+=50) { 
        ctx.moveTo(i, -2000); 
        ctx.lineTo(i, 2000); 
    }
    for(let i=-2000; i<2000; i+=50) { 
        ctx.moveTo(-2000, i); 
        ctx.lineTo(2000, i); 
    }
    ctx.stroke();

    studioObjects.forEach(obj => {
        // Прозрачность
        if (obj.collide === false) {
            ctx.globalAlpha = 0.5;
        } else {
            ctx.globalAlpha = 1.0;
        }

        ctx.fillStyle = obj.color;
        ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
        
        // Индикация для Unanchored
        if (obj.anchored === false) {
            ctx.strokeStyle = '#ff7675';
            ctx.lineWidth = 1;
            ctx.strokeRect(obj.x + 2, obj.y + 2, obj.w - 4, obj.h - 4);
        }

        if(obj.text) {
            ctx.fillStyle = obj.textColor || 'white';
            const fontName = obj.font || 'Arial';
            const size = obj.textSize || 20;
            ctx.font = `bold ${size}px "${fontName}"`;
            ctx.textAlign = 'center'; 
            ctx.textBaseline = 'middle';
            ctx.fillText(obj.text, obj.x + obj.w/2, obj.y + obj.h/2);
        }
        
        if(selectedObj === obj) {
            ctx.strokeStyle = '#00cec9'; 
            ctx.lineWidth = 2;
            ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
            ctx.fillStyle = 'white'; 
            const s = 6;
            ctx.fillRect(obj.x+obj.w-s, obj.y+obj.h-s, s*2, s*2);
        }
    });

    ctx.restore();
}

// ==========================================
//   TuModels FUNCTIONS
// ==========================================

function newModel() {
    if (!currentUser) return;
    
    currentModel = {
        id: 'model_' + Date.now(),
        name: 'New Model',
        objects: [],
        createdAt: new Date().toISOString(),
        author: currentUser.username
    };
    
    // Переключаемся на создание модели
    switchTab('models');
    renderModelPreview();
    updateModelStats();
}

function importModel() {
    alert('Import from JSON coming soon!');
}

function exportCurrentModel() {
    if (!currentModel) {
        alert('No model selected!');
        return;
    }
    
    const dataStr = JSON.stringify(currentModel, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = currentModel.name + '.tumodel';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
}

function saveModel() {
    if (!currentModel) {
        alert('Create or select a model first!');
        return;
    }
    
    // Сохраняем текущие объекты в модель
    if (currentTab === 'build') {
        currentModel.objects = JSON.parse(JSON.stringify(studioObjects));
    }
    
    // Проверяем, есть ли уже такая модель
    const existingIndex = modelsLibrary.findIndex(function(m) {
        return m.id === currentModel.id;
    });
    
    if (existingIndex >= 0) {
        modelsLibrary[existingIndex] = Object.assign({}, currentModel);
    } else {
        modelsLibrary.push(Object.assign({}, currentModel));
    }
    
    // Сохраняем в localStorage
    localStorage.setItem('tumodels_library', JSON.stringify(modelsLibrary));
    
    renderModelLibrary();
    alert('Model saved to library!');
}

function loadModels() {
    const saved = localStorage.getItem('tumodels_library');
    if (saved) {
        try {
            modelsLibrary = JSON.parse(saved);
            renderModelLibrary();
        } catch(e) {
            console.error('Error loading models:', e);
            modelsLibrary = [];
        }
    }
}

function renderModelLibrary() {
    if (!modelsLibraryEl) return;
    
    if (modelsLibrary.length === 0) {
        modelsLibraryEl.innerHTML = '<div class="empty-library"><div style="font-size: 32px; margin-bottom: 10px;">📦</div><h4>No Models Yet</h4><p style="font-size: 0.75rem;">Create your first model!</p></div>';
        return;
    }
    
    modelsLibraryEl.innerHTML = '';
    modelsLibrary.forEach(function(model) {
        const modelEl = document.createElement('div');
        modelEl.className = 'model-item';
        if (selectedModel && selectedModel.id === model.id) {
            modelEl.classList.add('active');
        }
        modelEl.innerHTML = '<div class="model-icon">📦</div><div class="model-name">' + model.name + '</div>';
        
        modelEl.onclick = function() {
            selectedModel = model;
            currentModel = Object.assign({}, model);
            renderModelLibrary();
            renderModelPreview();
            updateModelStats();
        };
        
        modelsLibraryEl.appendChild(modelEl);
    });
}

function renderModelPreview() {
    const previewEl = document.querySelector('.model-preview');
    if (!previewEl) return;
    
    const emptyEl = previewEl.querySelector('.preview-empty');
    if (!modelPreviewCanvas || !modelPreviewCtx) return;
    
    if (!currentModel || !currentModel.objects || currentModel.objects.length === 0) {
        modelPreviewCanvas.style.display = 'none';
        if (emptyEl) {
            emptyEl.style.display = 'block';
            emptyEl.innerHTML = '<div style="font-size: 24px; margin-bottom: 10px;">👁️</div>' + 
                (selectedModel ? 'Selected model is empty' : 'Select a model to preview');
        }
        return;
    }
    
    modelPreviewCanvas.style.display = 'block';
    if (emptyEl) emptyEl.style.display = 'none';
    
    // Настройка канваса
    modelPreviewCanvas.width = previewEl.clientWidth;
    modelPreviewCanvas.height = previewEl.clientHeight;
    
    // Очистка
    modelPreviewCtx.fillStyle = '#0f0f18';
    modelPreviewCtx.fillRect(0, 0, modelPreviewCanvas.width, modelPreviewCanvas.height);
    
    // Расчет масштаба и позиции
    const objects = currentModel.objects;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    objects.forEach(function(obj) {
        if (obj.x < minX) minX = obj.x;
        if (obj.y < minY) minY = obj.y;
        if (obj.x + obj.w > maxX) maxX = obj.x + obj.w;
        if (obj.y + obj.h > maxY) maxY = obj.y + obj.h;
    });
    
    const modelWidth = maxX - minX;
    const modelHeight = maxY - minY;
    const padding = 20;
    
    const scale = Math.min(
        (modelPreviewCanvas.width - padding * 2) / modelWidth,
        (modelPreviewCanvas.height - padding * 2) / modelHeight,
        1
    );
    
    const offsetX = (modelPreviewCanvas.width - modelWidth * scale) / 2;
    const offsetY = (modelPreviewCanvas.height - modelHeight * scale) / 2;
    
    // Рендеринг объектов
    modelPreviewCtx.save();
    modelPreviewCtx.translate(offsetX, offsetY);
    modelPreviewCtx.scale(scale, scale);
    modelPreviewCtx.translate(-minX, -minY);
    
    objects.forEach(function(obj) {
        modelPreviewCtx.fillStyle = obj.color || '#95a5a6';
        modelPreviewCtx.fillRect(obj.x, obj.y, obj.w, obj.h);
        
        if (obj.text) {
            modelPreviewCtx.fillStyle = obj.textColor || 'white';
            const fontName = obj.font || 'Arial';
            const size = (obj.textSize || 20) * scale;
            modelPreviewCtx.font = 'bold ' + size + 'px "' + fontName + '"';
            modelPreviewCtx.textAlign = 'center';
            modelPreviewCtx.textBaseline = 'middle';
            modelPreviewCtx.fillText(obj.text, obj.x + obj.w/2, obj.y + obj.h/2);
        }
    });
    
    modelPreviewCtx.restore();
}

function updateModelStats() {
    const partsCountEl = document.getElementById('parts-count');
    const sizeValueEl = document.getElementById('size-value');
    
    if (!partsCountEl || !sizeValueEl) return;
    
    if (!currentModel) {
        partsCountEl.textContent = '0';
        sizeValueEl.textContent = '0x0';
        return;
    }
    
    const objects = currentModel.objects || [];
    partsCountEl.textContent = objects.length;
    
    if (objects.length > 0) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        
        objects.forEach(function(obj) {
            if (obj.x < minX) minX = obj.x;
            if (obj.y < minY) minY = obj.y;
            if (obj.x + obj.w > maxX) maxX = obj.x + obj.w;
            if (obj.y + obj.h > maxY) maxY = obj.y + obj.h;
        });
        
        const width = Math.round(maxX - minX);
        const height = Math.round(maxY - minY);
        sizeValueEl.textContent = width + 'x' + height;
    } else {
        sizeValueEl.textContent = '0x0';
    }
}

// ==========================================
//   GLOBAL EXPORTS
// ==========================================

// Экспортируем функции в глобальную область видимости
window.switchTab = switchTab;
window.setBuildTool = setBuildTool;
window.newModel = newModel;
window.importModel = importModel;
window.exportCurrentModel = exportCurrentModel;
window.saveModel = saveModel;
window.openTextEditor = openTextEditor;
window.closeTextModal = closeTextModal;
window.updateFontPreview = updateFontPreview;
window.applyText = applyText;
window.deleteObj = deleteObj;
window.updateObjectProperty = updateObjectProperty;

// ==========================================
//   START APPLICATION
// ==========================================

// Запускаем инициализацию после загрузки DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStudio);
} else {
    initStudio();
}
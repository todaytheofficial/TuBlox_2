const socket = io();

// Глобальные данные юзера
let currentUser = null;

// 1. ПРОВЕРКА ВХОДА
getSession().then(user => {
    if (user) {
        currentUser = user;
        setupUI(user);
        checkProfileLink();
    } else {
        // Если не залогинен - перекидываем на вход (если мы не на страницах входа)
        if (!window.location.href.includes('login') && !window.location.href.includes('register')) {
            window.location.href = 'login.html';
        }
    }
});

function setupUI(user) {
    const profileBtn = document.getElementById('btn-profile');
    if (profileBtn) {
        profileBtn.innerHTML = `
            <div class="mini-avatar" style="background:${user.color}"></div>
            <span>${user.username}</span>
            <span class="currency">💰 ${user.balance}</span>
        `;
        profileBtn.onclick = () => window.location.href = 'profile.html';
    }
    socket.emit('request_games');
}

// 2. ОТРИСОВКА ИГР
socket.on('update_dashboard', (games) => {
    const list = document.getElementById('games-list');
    if (!list) return; // Мы не на главной
    
    list.innerHTML = '';
    games.forEach(game => {
        const el = document.createElement('div');
        el.className = 'card';
        el.onclick = () => openGameModal(game);
        el.innerHTML = `
            <div class="card-img-placeholder"></div>
            <div class="card-content">
                <h4>${game.name}</h4>
                <div class="card-meta">
                    <span>👤 ${game.online}</span>
                    <span>👁️ ${game.visits}</span>
                </div>
            </div>
        `;
        list.appendChild(el);
    });
});

// 3. МОДАЛКА ИГРЫ
function openGameModal(game) {
    const modal = document.getElementById('game-modal');
    if (!modal) return;
    
    document.getElementById('gm-name').textContent = game.name;
    document.getElementById('gm-author').textContent = game.author;
    document.getElementById('gm-stats').textContent = `Онлайн: ${game.online} | Визиты: ${game.visits}`;
    
    document.getElementById('btn-play').onclick = () => {
        // Проверка на дюп ID
        let uid = localStorage.getItem('tublox_uid');
        if(!uid) { uid = 'u_'+Date.now(); localStorage.setItem('tublox_uid', uid); }
        window.location.href = `game.html?id=${game.id}`;
    };
    
    document.getElementById('btn-share').onclick = () => {
        const url = `${window.location.origin}/game.html?id=${game.id}`;
        navigator.clipboard.writeText(url).then(() => alert('Ссылка скопирована!'));
    };
    
    modal.style.display = 'flex';
}

function closeGameModal() {
    document.getElementById('game-modal').style.display = 'none';
}

// 4. ПРОФИЛЬ (По ссылке)
function checkProfileLink() {
    const params = new URLSearchParams(window.location.search);
    const profileId = params.get('user_id');
    // В реальном проекте тут нужен запрос к серверу, но пока просто покажем локальный
}
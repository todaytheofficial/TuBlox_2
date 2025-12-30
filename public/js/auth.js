// Ключ для localStorage
const STORAGE_KEY = 'tublox_user';

// РЕГИСТРАЦИЯ
async function registerUser(username, password, color) {
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, color })
        });

        const data = await response.json();

        if (data.success) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data.user));
            return data.user;
        } else {
            throw new Error(data.error || "Ошибка регистрации");
        }
    } catch (err) {
        throw err;
    }
}

// ВХОД
async function loginUser(username, password) {
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.success) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data.user));
            return data.user;
        } else {
            throw new Error(data.error || "Ошибка входа");
        }
    } catch (err) {
        throw err;
    }
}

// ПОЛУЧЕНИЕ СЕССИИ (Обновление с сервера)
async function getSession() {
    const json = localStorage.getItem(STORAGE_KEY);
    if (!json || json === "undefined" || json === "null") return null;

    let user;
    try { user = JSON.parse(json); } 
    catch (e) { return null; }

    if (!user || !user.username) return null;

    // Обновляем данные с сервера (баланс, ID и т.д.)
    try {
        const response = await fetch('/api/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user.username })
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success && data.user) {
                user = data.user;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(user)); 
            }
        }
    } catch (e) {
        // Оффлайн - используем старые данные
    }

    return user;
}

function logoutUser() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('tublox_uid'); 
    window.location.href = 'login.html';
}
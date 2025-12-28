// Ключ, под которым храним юзера в браузере (чтобы не входить каждый раз)
const STORAGE_KEY = 'tublox_user';

/**
 * РЕГИСТРАЦИЯ
 * Отправляет данные на сервер /api/register
 */
async function registerUser(username, password, color) {
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, color })
        });

        const data = await response.json();

        if (data.success) {
            // Сохраняем пользователя в браузере
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data.user));
            return data.user;
        } else {
            throw new Error(data.error || "Ошибка регистрации");
        }
    } catch (err) {
        throw err;
    }
}

/**
 * ВХОД
 * Отправляет данные на сервер /api/login
 */
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

/**
 * ПОЛУЧЕНИЕ СЕССИИ
 * Берет данные из LocalStorage и обновляет их с сервера (чтобы баланс был актуальным)
 */
async function getSession() {
    const json = localStorage.getItem(STORAGE_KEY);
    if (!json) return null;

    let user = JSON.parse(json);

    // Пробуем обновить данные с сервера (вдруг мы купили что-то в другой вкладке)
    try {
        const response = await fetch('/api/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user.username })
        });
        const data = await response.json();
        
        if (data.success) {
            user = data.user;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(user)); // Обновляем кеш
        }
    } catch (e) {
        console.warn("Сервер недоступен, используем локальные данные");
    }

    return user;
}

/**
 * ВЫХОД
 */
function logoutUser() {
    localStorage.removeItem(STORAGE_KEY);
    // Удаляем UID дюпа, чтобы сбросить сессию игры
    localStorage.removeItem('tublox_uid'); 
    window.location.href = 'login.html';
}

// Вспомогательная функция для генерации UID (для защиты от дюпа в game.js)
function getUniqueId() {
    let uid = localStorage.getItem('tublox_uid');
    if (!uid) {
        uid = 'user_' + Date.now() + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('tublox_uid', uid);
    }
    return uid;
}
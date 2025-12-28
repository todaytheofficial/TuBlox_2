const badWords = ['мат1', 'мат2', 'плохоеслово']; // Добавь сюда нужные слова

function filterContent(text) {
    if (!text) return '';

    // Регулярное выражение для ссылок (http, https, www, .com, .ru и т.д.)
    const urlPattern = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]+\.(com|ru|net|org|io|gov|edu|me|biz|info|ua|kz))/gi;
    
    let filtered = text;

    // 1. Фильтруем ссылки
    filtered = filtered.replace(urlPattern, '###');

    // 2. Фильтруем плохие слова (с учетом регистра)
    badWords.forEach(word => {
        const regex = new RegExp(word, 'gi');
        filtered = filtered.replace(regex, '###');
    });

    return filtered;
}

// Экспортируем функцию для использования в server.js
module.exports = { filterContent };
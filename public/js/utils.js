const ASSETS = {
    // --- ЛИЦА ---
    'face_smile': {
        name: 'Smile', type: 'face', price: 0,
        svg: `<rect x="8" y="10" width="2" height="3" fill="#111"/><rect x="14" y="10" width="2" height="3" fill="#111"/><path d="M9 16 Q12 19 15 16" stroke="#111" stroke-width="1.5" fill="none" stroke-linecap="round"/>`
    },
    'face_cool': {
        name: 'Cool Shades', type: 'face', price: 50,
        svg: `<rect x="6" y="10" width="12" height="4" fill="#111"/><rect x="7" y="11" width="3" height="1" fill="white"/><path d="M10 16 Q12 17 14 16" stroke="#111" stroke-width="1.5" fill="none"/>`
    },
    'face_sad': {
        name: 'Sad', type: 'face', price: 20,
        svg: `<rect x="8" y="11" width="2" height="2" fill="#111"/><rect x="14" y="11" width="2" height="2" fill="#111"/><path d="M9 18 Q12 15 15 18" stroke="#111" stroke-width="1.5" fill="none"/>`
    },
    // НОВОЕ: ~•~
    'face_tilde': {
        name: '~•~', type: 'face', price: 60,
        svg: `<path d="M7 12 Q8 10 9 12" stroke="#111" stroke-width="2" fill="none"/><path d="M15 12 Q16 10 17 12" stroke="#111" stroke-width="2" fill="none"/><circle cx="12" cy="16" r="1.5" fill="#111"/>`
    },
    
    // --- ШАПКИ ---
    'hat_top': {
        name: 'Top Hat', type: 'hat', price: 100,
        svg: `<rect x="4" y="0" width="16" height="4" fill="#111"/><rect x="7" y="-12" width="10" height="12" fill="#111"/><rect x="7" y="-3" width="10" height="2" fill="#e74c3c"/>`
    },
    'hat_cap': {
        name: 'Blue Cap', type: 'hat', price: 40,
        svg: `<path d="M6 5 A1 1 0 0 1 18 5 L 18 5 L 6 5 Z" fill="#0984e3" stroke="#0984e3" stroke-width="8"/><rect x="6" y="5" width="12" height="3" fill="#0984e3"/><rect x="4" y="5" width="16" height="2" fill="#74b9ff"/>`
    },
    'hat_headphones': {
        name: 'Headphones', type: 'hat', price: 150,
        svg: `<path d="M6 12 C 6 -2 18 -2 18 12" stroke="#2d3436" stroke-width="3" fill="none"/><rect x="4" y="8" width="4" height="8" fill="#ff7675" rx="1"/><rect x="16" y="8" width="4" height="8" fill="#ff7675" rx="1"/>`
    },
    // НОВОЕ: ЧАЙНИК
    'hat_teapot': {
        name: 'Teapot', type: 'hat', price: 200,
        svg: `<path d="M6 8 Q4 0 12 0 Q20 0 18 8" fill="#eee"/><path d="M18 4 Q22 2 22 6" stroke="#eee" stroke-width="2" fill="none"/><path d="M6 4 L2 2" stroke="#eee" stroke-width="2"/><rect x="10" y="-2" width="4" height="2" fill="#ff7675"/>`
    },

    // --- СЛУЖЕБНЫЕ ---
    'default': { name: 'Default', type: 'face', price: 0, svg: '' },
    'none': { name: 'None', type: 'hat', price: 0, svg: `<line x1="6" y1="6" x2="18" y2="18" stroke="#e74c3c" stroke-width="2"/><line x1="18" y1="6" x2="6" y2="18" stroke="#e74c3c" stroke-width="2"/>` }
};

function getAvatarSVG(user) {
    if(!user) return '';
    const skin = '#ffccaa';
    const bodyColor = user.color || '#5d00ff';
    const faceData = ASSETS[user.equipped.face] || ASSETS['face_smile'];
    const hatData = ASSETS[user.equipped.hat] || { svg: '' };

    return `
    <svg viewBox="0 -15 24 45" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <rect x="5" y="20" width="14" height="12" fill="${bodyColor}" rx="3"/>
        <rect x="6" y="6" width="12" height="12" fill="${skin}" rx="3"/>
        ${faceData.svg}
        ${hatData.svg}
    </svg>`;
}

function getItemSVG(itemId) {
    const item = ASSETS[itemId];
    if(!item) return '';
    if(item.type === 'face') {
        return `<svg viewBox="0 0 24 24" width="100%" height="100%"><rect x="4" y="4" width="16" height="16" fill="#ffccaa" rx="4"/>${item.svg}</svg>`;
    }
    if(item.type === 'hat') {
        return `<svg viewBox="0 -15 24 45" width="100%" height="100%">${item.svg}</svg>`;
    }
    return '';
}
window.GAME_ASSETS = ASSETS;
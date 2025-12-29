const ASSETS = {
    // ==========================================
    // --- FACES (ЛИЦА И АКСЕССУАРЫ ЛИЦА) ---
    // ==========================================
    'face_smile': {
        name: 'Smile', type: 'face', price: 0,
        svg: `<rect x="8" y="10" width="2" height="3" fill="#111"/><rect x="14" y="10" width="2" height="3" fill="#111"/><path d="M9 16 Q12 19 15 16" stroke="#111" stroke-width="1.5" fill="none" stroke-linecap="round"/>`
    },
    'face_cool': {
        name: 'Cool Shades', type: 'face', price: 50,
        svg: `<rect x="6" y="10" width="12" height="4" fill="#111"/><rect x="7" y="11" width="3" height="1" fill="white"/><path d="M10 16 Q12 17 14 16" stroke="#111" stroke-width="1.5" fill="none"/>`
    },
    'face_love': {
        name: 'Love Eyes', type: 'face', price: 75,
        svg: `<path d="M7 11 Q8 9 9 11 Q10 9 11 11 L9 13 Z" fill="#e74c3c"/><path d="M13 11 Q14 9 15 11 Q16 9 17 11 L15 13 Z" fill="#e74c3c"/><path d="M10 16 Q12 18 14 16" stroke="#111" stroke-width="1.5" fill="none"/>`
    },
    'face_pixel': {
        name: 'Pixel Glasses', type: 'face', price: 150,
        svg: `<rect x="6" y="10" width="12" height="2" fill="black"/><rect x="7" y="12" width="3" height="2" fill="black"/><rect x="14" y="12" width="3" height="2" fill="black"/><rect x="8" y="10" width="1" height="1" fill="white"/><path d="M10 16 H14" stroke="#111" stroke-width="1.5"/>`
    },
    'face_mask': {
        name: 'Medical Mask', type: 'face', price: 30,
        svg: `<circle cx="9" cy="11" r="1.5" fill="#111"/><circle cx="15" cy="11" r="1.5" fill="#111"/><rect x="7" y="13" width="10" height="6" rx="2" fill="white" stroke="#bdc3c7"/><line x1="5" y1="14" x2="19" y2="14" stroke="#ecf0f1" stroke-width="1"/>`
    },
    'face_cyclops': {
        name: 'Cyclops', type: 'face', price: 200,
        svg: `<circle cx="12" cy="11" r="3.5" fill="white" stroke="#111"/><circle cx="12" cy="11" r="1.5" fill="#111"/><path d="M10 17 Q12 16 14 17" stroke="#111" stroke-width="1.5" fill="none"/>`
    },
    'face_uwu': {
        name: 'UwU', type: 'face', price: 120,
        svg: `<path d="M7 11 Q8 13 9 11" stroke="#111" stroke-width="1.5" fill="none"/><path d="M15 11 Q16 13 17 11" stroke="#111" stroke-width="1.5" fill="none"/><path d="M10 15 Q11 17 12 15 Q13 17 14 15" stroke="#111" stroke-width="1.5" fill="none"/>`
    },
    'face_rich': {
        name: 'Rich', type: 'face', price: 300,
        svg: `<text x="7" y="14" font-size="6" fill="#27ae60" font-weight="bold">$</text><text x="14" y="14" font-size="6" fill="#27ae60" font-weight="bold">$</text><path d="M8 17 H16" stroke="#27ae60" stroke-width="2"/>`
    },
    'face_tilde': {
        name: 'Tilde', type: 'face', price: 40,
        svg: `<path d="M7 12 Q9 10 11 12" stroke="#111" fill="none"/><path d="M13 12 Q15 10 17 12" stroke="#111" fill="none"/><path d="M10 16 Q12 14 14 16" stroke="#111" fill="none"/>`
    },
    'face_sad': {
        name: 'Sad', type: 'face', price: 10,
        svg: `<circle cx="9" cy="12" r="1" fill="#111"/><circle cx="15" cy="12" r="1" fill="#111"/><path d="M9 18 Q12 15 15 18" stroke="#111" fill="none"/>`
    },
    'face_angry': {
        name: 'Angry', type: 'face', price: 45,
        svg: `<path d="M6 9 L10 11" stroke="#111"/><path d="M14 11 L18 9" stroke="#111"/><circle cx="9" cy="13" r="1" fill="#111"/><circle cx="15" cy="13" r="1" fill="#111"/><path d="M10 17 H14" stroke="#111"/>`
    },
    'face_ninja': {
        name: 'Ninja', type: 'face', price: 200,
        svg: `<rect x="4" y="8" width="16" height="8" fill="#2d3436"/><rect x="7" y="10" width="10" height="4" fill="#ffeaa7"/><circle cx="10" cy="12" r="1" fill="#111"/><circle cx="14" cy="12" r="1" fill="#111"/>`
    },
    'face_beard': {
        name: 'Bearded', type: 'face', price: 85,
        svg: `<rect x="8" y="10" width="2" height="3" fill="#111"/><rect x="14" y="10" width="2" height="3" fill="#111"/><path d="M6 14 Q12 22 18 14 L18 12 L17 12 L17 14 Q12 18 7 14 L7 12 L6 12 Z" fill="#5d4037"/>`
    },

    // ==========================================
    // --- ACCESSORIES (ШАПКИ/ГОЛОВНЫЕ УБОРЫ) ---
    // ==========================================
    'hat_top': {
        name: 'Top Hat', type: 'hat', price: 100,
        svg: `<rect x="4" y="5" width="16" height="4" fill="#111"/><rect x="7" y="-7" width="10" height="12" fill="#111"/><rect x="7" y="2" width="10" height="2" fill="#e74c3c"/>`
    },
    'hat_crown': {
        name: 'Gold Crown', type: 'hat', price: 500,
        svg: `<path d="M5 8 L7 2 L10 6 L12 1 L14 6 L17 2 L19 8 Z" fill="#f1c40f" stroke="#f39c12" stroke-width="1"/><circle cx="12" cy="1" r="1" fill="#e74c3c"/>`
    },
    'hat_cap': {
        name: 'Blue Cap', type: 'hat', price: 40,
        svg: `<path d="M6 10 A1 1 0 0 1 18 10 L 18 10 L 6 10 Z" fill="#0984e3"/><rect x="4" y="10" width="16" height="2" fill="#74b9ff"/>`
    },
    'hat_teapot': {
        name: 'Teapot', type: 'hat', price: 1000,
        svg: `<path d="M8 4 Q12 -2 16 4 L17 10 H7 Z" fill="#ecf0f1"/><path d="M17 6 Q20 6 20 8" stroke="#bdc3c7" fill="none"/><path d="M7 6 Q4 6 4 9" stroke="#bdc3c7" fill="none"/>`
    },
    'hat_headphones': {
        name: 'Headphones', type: 'hat', price: 150,
        svg: `<path d="M5 12 Q5 2 12 2 Q19 2 19 12" stroke="#2d3436" stroke-width="3" fill="none"/><rect x="3" y="10" width="4" height="6" rx="2" fill="#e74c3c"/><rect x="17" y="10" width="4" height="6" rx="2" fill="#e74c3c"/>`
    },
    'hat_cat': {
        name: 'Cat Ears', type: 'hat', price: 80,
        svg: `<path d="M6 10 L8 4 L11 9 Z" fill="#ff78cb"/><path d="M13 9 L16 4 L18 10 Z" fill="#ff78cb"/>`
    },
    'hat_viking': {
        name: 'Viking', type: 'hat', price: 250,
        svg: `<path d="M6 10 Q12 2 18 10" fill="#95a5a6"/><path d="M6 10 L4 4" stroke="#ecf0f1" stroke-width="3"/><path d="M18 10 L20 4" stroke="#ecf0f1" stroke-width="3"/>`
    },
    'hat_halo': {
        name: 'Halo', type: 'hat', price: 400,
        svg: `<ellipse cx="12" cy="2" rx="7" ry="2" fill="none" stroke="#f1c40f" stroke-width="1.5" opacity="0.8"/>`
    },
    'hat_party': {
        name: 'Party Hat', type: 'hat', price: 25,
        svg: `<polygon points="12,0 6,10 18,10" fill="#e84393"/><circle cx="12" cy="0" r="1.5" fill="#55efc4"/>`
    },
'hat_melon': {
        name: 'Big Melon', type: 'hat', price: 200,
        // Рисуем большой круг и три полоски
        svg: `
        <!-- Хвостик (рисуем первым, чтобы был сзади) -->
        <path d="M12 -9 Q14 -13 17 -11" stroke="#795548" stroke-width="3" fill="none" stroke-linecap="round"/>
        
        <!-- Основной круг (темно-зеленый) -->
        <circle cx="12" cy="1" r="11" fill="#117a35"/>
        
        <!-- Полоски (светло-зеленые) -->
        <!-- Левая -->
        <path d="M5 -6 Q2 1 5 8" stroke="#4cd137" stroke-width="2.5" fill="none"/>
        <!-- Центральная -->
        <path d="M12 -10 L12 12" stroke="#4cd137" stroke-width="2.5" fill="none"/>
        <!-- Правая -->
        <path d="M19 -6 Q22 1 19 8" stroke="#4cd137" stroke-width="2.5" fill="none"/>
        `
    },
    // ==========================================
    // --- SHIRTS (ФУТБОЛКИ) ---
    // ==========================================
    'shirt_christmas': {
        name: 'X-Mas Sweater', type: 'shirt', price: 120, color: '#e74c3c',
        svg: `<path d="M5 24 H19 M5 28 H19" stroke="white" stroke-width="1"/><path d="M12 22 L14 26 L10 26 Z" fill="#2ecc71"/>`
    },
    'shirt_suit': {
        name: 'Business Suit', type: 'shirt', price: 250, color: '#2d3436',
        svg: `<polygon points="12,18 9,24 15,24" fill="white"/><polygon points="12,18 11,28 13,28" fill="#c0392b"/>`
    },
    'shirt_stripe': {
        name: 'Striped Shirt', type: 'shirt', price: 45, color: '#ffffff',
        svg: `<rect x="5" y="20" width="14" height="2" fill="#3498db"/><rect x="5" y="24" width="14" height="2" fill="#3498db"/><rect x="5" y="28" width="14" height="2" fill="#3498db"/>`
    },
    'shirt_camo': {
        name: 'Camo Jacket', type: 'shirt', price: 90, color: '#4b6140',
        svg: `<circle cx="8" cy="22" r="2" fill="#2c3e29"/><circle cx="15" cy="26" r="2.5" fill="#2c3e29"/><circle cx="10" cy="28" r="1.5" fill="#6d8a59"/>`
    },
    'shirt_gold': {
        name: 'Gold Chain', type: 'shirt', price: 400, color: '#000000',
        svg: `<path d="M9 18 Q12 24 15 18" stroke="#f1c40f" stroke-width="1.5" fill="none"/><circle cx="12" cy="23" r="1.5" fill="#f1c40f"/>`
    },
    'shirt_noob': {
        name: 'Noob Shirt', type: 'shirt', price: 15, color: '#2ecc71',
        svg: `<rect x="9" y="22" width="6" height="6" fill="#f1c40f" opacity="0.5"/>`
    },
    'shirt_black': {
        name: 'Black Hoodie', type: 'shirt', price: 80, color: '#2d3436',
        svg: `<rect x="9" y="21" width="6" height="4" fill="#636e72" rx="1"/>`
    },

    // ==========================================
    // --- PANTS (ШТАНЫ) ---
    // ==========================================
    'pants_christmas': {
        name: 'Red Pants', type: 'pants', price: 60, color: '#c0392b',
        svg: `<rect x="5" y="25" width="14" height="2" fill="white"/>`
    },
    'pants_jeans': {
        name: 'Blue Jeans', type: 'pants', price: 50, color: '#2980b9',
        svg: `<line x1="12" y1="28" x2="12" y2="38" stroke="#1f618d" stroke-width="1"/><rect x="6" y="29" width="3" height="3" fill="none" stroke="#bdc3c7" stroke-width="0.5"/>`
    },
    'pants_shorts': {
        name: 'Summer Shorts', type: 'pants', price: 35, color: '#e67e22',
        svg: `<rect x="5" y="34" width="14" height="4" fill="#ffccaa"/>` // Визуальный трюк: закрашиваем низ цветом кожи
    },
    'pants_camo': {
        name: 'Camo Pants', type: 'pants', price: 80, color: '#4b6140',
        svg: `<circle cx="7" cy="30" r="1.5" fill="#2c3e29"/><circle cx="13" cy="34" r="2" fill="#2c3e29"/>`
    },
    'pants_khaki': {
        name: 'Khaki Cargo', type: 'pants', price: 70, color: '#95a5a6',
        svg: `<rect x="5" y="30" width="2" height="4" fill="#7f8c8d"/><rect x="17" y="30" width="2" height="4" fill="#7f8c8d"/>`
    },
    'pants_noob': {
        name: 'Noob Pants', type: 'pants', price: 15, color: '#0984e3',
        svg: `` 
    },
    'pants_dark': {
        name: 'Dark Jeans', type: 'pants', price: 50, color: '#2c3e50',
        svg: `<line x1="12" y1="20" x2="12" y2="32" stroke="#1a252f" stroke-width="1"/>`
    },

    // --- СЛУЖЕБНЫЕ ---
    'default': { name: 'Default', type: 'hat', price: 0, svg: '' },
    'none': { 
        name: 'None', type: 'hat', price: 0, 
        svg: `<line x1="6" y1="6" x2="18" y2="18" stroke="#e74c3c" stroke-width="2"/><line x1="18" y1="6" x2="6" y2="18" stroke="#e74c3c" stroke-width="2"/>` 
    },
    'none_shirt': { name: 'Default Shirt', type: 'shirt', price: 0, color: '#6c5ce7', svg: '' },
    'none_pants': { name: 'Default Pants', type: 'pants', price: 0, color: '#2d3436', svg: '' }
};

// Функция отрисовки аватара (без изменений, для справки)
function getAvatarSVG(user) {
    if(!user) return '';
    
    // Получаем данные или ставим дефолт
    const face = ASSETS[user.equipped?.face] || ASSETS['face_smile'];
    const hat = ASSETS[user.equipped?.hat] || { svg: '' };
    const shirt = ASSETS[user.equipped?.shirt] || ASSETS['none_shirt'];
    const pants = ASSETS[user.equipped?.pants] || ASSETS['none_pants'];
    
    const skin = '#ffccaa';

    return `
    <svg viewBox="0 -15 24 50" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <rect x="5" y="28" width="14" height="10" fill="${pants.color}" rx="2"/>
        ${pants.svg || ''}

        <rect x="5" y="18" width="14" height="12" fill="${shirt.color}" rx="3"/>
        ${shirt.svg || ''}

        <rect x="6" y="6" width="12" height="12" fill="${skin}" rx="3"/>
        
        <g>${face.svg}</g>
        
        <g>${hat.svg}</g>
    </svg>`;
}

// Функция отрисовки иконки в магазине (без изменений)
function getItemSVG(itemId) {
    const item = ASSETS[itemId];
    if(!item) return '';
    
    const skin = '#ffccaa';
    
    if(item.type === 'face') {
        return `<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" fill="${skin}" rx="4"/>${item.svg}</svg>`;
    }
    if(item.type === 'hat') {
        return `<svg viewBox="0 -10 24 35">${item.svg}</svg>`;
    }
    if(item.type === 'shirt') {
        return `<svg viewBox="0 15 24 20"><rect x="5" y="18" width="14" height="12" fill="${item.color}" rx="3"/>${item.svg}</svg>`;
    }
    if(item.type === 'pants') {
        return `<svg viewBox="0 25 24 15"><rect x="5" y="20" width="14" height="12" fill="${item.color}" rx="2"/>${item.svg}</svg>`;
    }
    return `<svg viewBox="0 0 24 24">${item.svg}</svg>`;
}

window.GAME_ASSETS = ASSETS;
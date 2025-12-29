// utils.js

const ASSETS = {
       // ==========================================
    // --- ULTRA LIMITED (FACES) ---
    // ==========================================
    'face_godmode': { 
        name: 'Cosmic Overlord', 
        type: 'face', 
        price: 50000, // Очень дорого
        // SVG: Черная склера, светящийся циан, третий глаз и руны
        svg: `
            <!-- Третий глаз (анимированный) -->
            <path d="M12 4 Q15 2 18 4 Q15 6 12 4" stroke="#00d2d3" stroke-width="0.5" fill="#000">
                <animate attributeName="d" values="M12 4 Q15 2 18 4 Q15 6 12 4; M12 3 Q15 1 18 3 Q15 7 12 3; M12 4 Q15 2 18 4 Q15 6 12 4" dur="2s" repeatCount="indefinite"/>
            </path>
            <circle cx="15" cy="4" r="1" fill="#fff">
                <animate attributeName="opacity" values="0.5;1;0.5" dur="1s" repeatCount="indefinite"/>
            </circle>

            <!-- Основные глаза -->
            <path d="M6 10 Q9 8 12 10 Q9 13 6 10" fill="#000" stroke="#00d2d3" stroke-width="0.5"/>
            <path d="M18 10 Q21 8 24 10 Q21 13 18 10" fill="#000" stroke="#00d2d3" stroke-width="0.5"/>
            
            <circle cx="9" cy="10" r="1.5" fill="#00d2d3">
                <animate attributeName="r" values="1.5;2;1.5" dur="1.5s" repeatCount="indefinite"/>
            </circle>
            <circle cx="21" cy="10" r="1.5" fill="#00d2d3">
                 <animate attributeName="r" values="1.5;2;1.5" dur="1.5s" repeatCount="indefinite"/>
            </circle>

            <!-- Рот -->
            <path d="M10 16 L12 18 L14 16 L16 18 L18 16" stroke="#00d2d3" stroke-width="1" fill="none" opacity="0.8"/>
        ` 
    },

    // ==========================================
    // --- ULTRA LIMITED (HATS) ---
    // ==========================================
    'hat_seraphim': { 
        name: 'Seraphim Wings', 
        type: 'hat', 
        price: 100000, 
        // SVG: Огромные крылья (64x64) + Нимб
        // Используем viewBox 0 0 64 64. Центр головы примерно на x=32, y=40
        svg: `
            <!-- Левое крыло (Анимация взмаха) -->
            <g>
                <path d="M30 40 Q10 20 0 10 Q10 40 28 50" fill="url(#wingGrad)" stroke="#fff" stroke-width="0.5" opacity="0.9">
                    <animateTransform attributeName="transform" type="rotate" values="0 32 40; 5 32 40; 0 32 40" dur="2s" repeatCount="indefinite"/>
                </path>
            </g>

            <!-- Правое крыло -->
            <g>
                <path d="M34 40 Q54 20 64 10 Q54 40 36 50" fill="url(#wingGrad)" stroke="#fff" stroke-width="0.5" opacity="0.9">
                     <animateTransform attributeName="transform" type="rotate" values="0 32 40; -5 32 40; 0 32 40" dur="2s" repeatCount="indefinite"/>
                </path>
            </g>

            <!-- Нимб (Вращается и светится) -->
            <ellipse cx="32" cy="15" rx="12" ry="3" fill="none" stroke="#f1c40f" stroke-width="2">
                <animate attributeName="stroke-opacity" values="1;0.5;1" dur="1.5s" repeatCount="indefinite"/>
                <animate attributeName="ry" values="3;4;3" dur="2s" repeatCount="indefinite"/>
            </ellipse>
            
            <!-- Лучи света -->
            <line x1="32" y1="15" x2="32" y2="5" stroke="#f1c40f" stroke-width="1" opacity="0.5"/>
            <line x1="32" y1="15" x2="22" y2="8" stroke="#f1c40f" stroke-width="1" opacity="0.5"/>
            <line x1="32" y1="15" x2="42" y2="8" stroke="#f1c40f" stroke-width="1" opacity="0.5"/>

            <!-- Градиент для крыльев (определяем внутри SVG) -->
            <defs>
                <linearGradient id="wingGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:#fff;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#00d2d3;stop-opacity:0.5" />
                </linearGradient>
            </defs>
        ` 
    },

    // ==========================================
    // --- ULTRA LIMITED (SHIRTS) ---
    // ==========================================
    'shirt_nebula': { 
        name: 'Nebula Mantle', 
        type: 'shirt', 
        price: 75000, 
        color: '#0f0c29', // Глубокий космос
        svg: `
            <defs>
                <radialGradient id="nebulaCore" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" style="stop-color:#ff00ff;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#0f0c29;stop-opacity:0" />
                </radialGradient>
            </defs>

            <circle cx="12" cy="24" r="4" fill="url(#nebulaCore)">
                <animate attributeName="r" values="3;5;3" dur="3s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0.5;1;0.5" dur="3s" repeatCount="indefinite"/>
            </circle>

            <circle cx="9" cy="22" r="0.5" fill="#fff">
                <animate attributeName="opacity" values="0;1;0" dur="2s" repeatCount="indefinite"/>
            </circle>
            <circle cx="15" cy="26" r="0.5" fill="#fff">
                <animate attributeName="opacity" values="0;1;0" dur="2.5s" repeatCount="indefinite"/>
            </circle>

            <path d="M7 20 L9 20 M15 20 L17 20 M12 18 L12 20" stroke="#f1c40f" stroke-width="0.5" opacity="0.8"/>
            <path d="M6 22 Q5 24 6 26 M18 22 Q19 24 18 26" stroke="#00d2d3" stroke-width="0.5" fill="none">
                <animate attributeName="stroke" values="#00d2d3;#ff00ff;#00d2d3" dur="4s" repeatCount="indefinite"/>
            </path>
        ` 
    },

    // ==========================================
    // --- ULTRA LIMITED (PANTS) ---
    // ==========================================
    'pants_stellar': { 
        name: 'Stellar Void', 
        type: 'pants', 
        price: 60000, 
        color: '#000000', 
        svg: `
            <path d="M7 28 L7 38 M17 28 L17 38" stroke="#00d2d3" stroke-width="1" stroke-dasharray="2,2">
                <animate attributeName="stroke-dashoffset" from="0" to="4" dur="1s" repeatCount="indefinite"/>
            </path>

            <rect x="6" y="31" width="3" height="2" rx="0.5" fill="#ff00ff">
                <animate attributeName="fill" values="#ff00ff;#00d2d3;#ff00ff" dur="2s" repeatCount="indefinite"/>
            </rect>
            <rect x="15" y="31" width="3" height="2" rx="0.5" fill="#ff00ff">
                <animate attributeName="fill" values="#ff00ff;#00d2d3;#ff00ff" dur="2s" repeatCount="indefinite"/>
            </rect>

            <path d="M5 37 H19" stroke="url(#auraGrad)" stroke-width="2" opacity="0.6"/>
            
            <defs>
                <linearGradient id="auraGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style="stop-color:#ff00ff;" />
                    <stop offset="50%" style="stop-color:#00d2d3;" />
                    <stop offset="100%" style="stop-color:#ff00ff;" />
                </linearGradient>
            </defs>
        ` 
    },

    // ==========================================
    // --- 1. ЛИЦА (FACES) ---
    // ==========================================
    
    // --- BASIC ---
    'face_smile': { name: 'Smile', type: 'face', price: 0, svg: `<path d="M9 16 Q12 19 15 16" stroke="#2d3436" stroke-width="1.5" fill="none"/><circle cx="9" cy="11" r="1.5" fill="#2d3436"/><circle cx="15" cy="11" r="1.5" fill="#2d3436"/>` },
    'face_meh': { name: 'Meh', type: 'face', price: 10, svg: `<line x1="10" y1="16" x2="14" y2="16" stroke="#2d3436" stroke-width="1.5"/><circle cx="9" cy="11" r="1.5" fill="#2d3436"/><circle cx="15" cy="11" r="1.5" fill="#2d3436"/>` },
    'face_angry': { name: 'Angry', type: 'face', price: 25, svg: `<path d="M8 9 L11 11" stroke="#2d3436"/><path d="M16 9 L13 11" stroke="#2d3436"/><circle cx="9" cy="12" r="1" fill="#000"/><circle cx="15" cy="12" r="1" fill="#000"/><path d="M10 16 Q12 15 14 16" stroke="#2d3436" fill="none"/>` },

    // --- COOL ---
    'face_shades': { name: 'Agent', type: 'face', price: 150, svg: `<path d="M6 10 H18 V14 H6 Z" fill="#000"/><rect x="11" y="10" width="2" height="4" fill="#000"/>` },
    'face_money': { name: 'Rich', type: 'face', price: 500, svg: `<text x="7" y="14" font-size="6" fill="#27ae60">$</text><text x="13" y="14" font-size="6" fill="#27ae60">$</text><path d="M9 17 Q12 20 15 17" stroke="#27ae60" fill="none"/>` },
    'face_mask_med': { name: 'Medic Mask', type: 'face', price: 100, svg: `<rect x="6" y="12" width="12" height="8" rx="2" fill="#fff"/><line x1="6" y1="14" x2="4" y2="12" stroke="#ecf0f1"/><line x1="18" y1="14" x2="20" y2="12" stroke="#ecf0f1"/>` },
    'face_clown': { name: 'Clown', type: 'face', price: 300, svg: `<circle cx="12" cy="13" r="2.5" fill="#e74c3c"/><path d="M8 16 Q12 20 16 16" stroke="#c0392b" stroke-width="1.5" fill="none"/><circle cx="8" cy="10" r="1" fill="#000"/><circle cx="16" cy="10" r="1" fill="#000"/>` },
    
    // --- CYBER & SCIFI ---
    'face_cyborg': { name: 'Terminator', type: 'face', price: 800, svg: `<rect x="11" y="4" width="13" height="20" fill="#95a5a6" opacity="0.3"/><circle cx="9" cy="11" r="1.5" fill="#2d3436"/><circle cx="15" cy="11" r="2" fill="#e74c3c" stroke="#c0392b"/><path d="M14 6 L14 18" stroke="#7f8c8d"/>` },
    'face_cyclops': { name: 'Cyclops', type: 'face', price: 600, svg: `<rect x="6" y="9" width="12" height="4" fill="#34495e" rx="1"/><rect x="8" y="10" width="8" height="2" fill="#e74c3c"/>` },
    'face_glitch': { name: 'ERROR 404', type: 'face', price: 1500, svg: `<rect x="7" y="10" width="3" height="3" fill="#000"/><rect x="15" y="9" width="3" height="3" fill="#000"/><path d="M8 16 L10 17 L12 15 L14 17 L16 16" stroke="#e74c3c" stroke-width="1.5" fill="none"/><rect x="6" y="8" width="12" height="8" fill="none" stroke="#2ecc71" stroke-width="0.5" opacity="0.5"/>` },

    // --- MONSTERS ---
    'face_void': { name: 'The Void', type: 'face', price: 2000, svg: `<rect x="0" y="0" width="24" height="24" fill="#000"/><circle cx="8" cy="10" r="1" fill="#fff"/><circle cx="16" cy="10" r="1" fill="#fff"/>` },
    'face_vampire': { name: 'Vampire', type: 'face', price: 1000, svg: `<path d="M9 16 Q12 17 15 16" stroke="#2d3436" fill="none"/><path d="M10 16 L10 19 L11 16" fill="#fff"/><path d="M14 16 L14 19 L13 16" fill="#fff"/><circle cx="9" cy="11" r="1.5" fill="#c0392b"/><circle cx="15" cy="11" r="1.5" fill="#c0392b"/>` },

    // ==========================================
    // --- 2. ШАПКИ (HATS) ---
    // ==========================================

    // --- CASUAL ---
    'hat_beanie': { name: 'Orange Beanie', type: 'hat', price: 40, svg: `<path d="M6 8 Q12 0 18 8 L18 10 H6 Z" fill="#e67e22"/><rect x="5" y="9" width="14" height="3" fill="#d35400" rx="1"/>` },
    'hat_cap_back': { name: 'Cap (Back)', type: 'hat', price: 50, svg: `<path d="M4 8 Q12 -2 20 8 L20 10 H4 Z" fill="#3498db"/><rect x="2" y="8" width="6" height="2" fill="#2980b9"/>` },
    'hat_headband': { name: 'Ninja Band', type: 'hat', price: 75, svg: `<rect x="4" y="6" width="16" height="4" fill="#c0392b"/><path d="M18 7 L22 4 M18 8 L22 10" stroke="#c0392b" stroke-width="2"/>` },
    'hat_headphones': { name: 'Gamer Set', type: 'hat', price: 300, svg: `<path d="M4 10 Q12 -5 20 10" stroke="#2d3436" stroke-width="3" fill="none"/><rect x="2" y="6" width="4" height="8" fill="#e74c3c" rx="1"/><rect x="18" y="6" width="4" height="8" fill="#e74c3c" rx="1"/>` },

    // --- FUNNY ---
    'hat_cone': { name: 'Traffic Cone', type: 'hat', price: 150, svg: `<polygon points="12,0 6,12 18,12" fill="#e67e22"/><rect x="4" y="12" width="16" height="2" fill="#e67e22"/><rect x="8" y="6" width="8" height="2" fill="#fff"/>` },
    'hat_flower': { name: 'Sprout', type: 'hat', price: 200, svg: `<path d="M12 10 Q12 0 8 2" stroke="#2ecc71" stroke-width="2" fill="none"/><circle cx="8" cy="2" r="2" fill="#e91e63"/><path d="M12 10 Q12 2 16 4" stroke="#2ecc71" stroke-width="2" fill="none"/><circle cx="16" cy="4" r="2" fill="#f1c40f"/>` },
    'hat_toilet': { name: 'Plunger', type: 'hat', price: 400, svg: `<rect x="11" y="-5" width="2" height="10" fill="#e67e22"/><path d="M6 5 Q12 12 18 5 Z" fill="#c0392b"/>` },
    'hat_egg': { name: 'Fried Egg', type: 'hat', price: 350, svg: `<path d="M4 8 Q8 6 12 8 Q16 10 20 8 Q22 6 18 4 Q14 2 8 4 Q2 6 4 8" fill="#fff"/><circle cx="12" cy="6" r="3" fill="#f1c40f"/>` },

    // --- COSTUMES ---
    'hat_tophat': { name: 'Gentleman', type: 'hat', price: 500, svg: `<rect x="6" y="-4" width="12" height="12" fill="#2d3436"/><rect x="2" y="8" width="20" height="2" fill="#2d3436"/><rect x="6" y="6" width="12" height="2" fill="#e74c3c"/>` },
    'hat_cowboy': { name: 'Sheriff', type: 'hat', price: 600, svg: `<path d="M2 6 Q12 -6 22 6" fill="#A0522D"/><path d="M0 6 H24" stroke="#8B4513" stroke-width="2"/>` },
    'hat_astronaut': { name: 'Space Helm', type: 'hat', price: 1200, svg: `<rect x="2" y="-5" width="20" height="20" rx="5" fill="#ecf0f1" stroke="#bdc3c7"/><rect x="5" y="-2" width="14" height="10" rx="2" fill="#34495e"/>` },

    // --- LEGENDARY ---
    'hat_halo': { name: 'Angel Halo', type: 'hat', price: 2000, svg: `<ellipse cx="12" cy="-6" rx="10" ry="2" stroke="#f1c40f" stroke-width="2" fill="none"/>` },
    'hat_devil': { name: 'Neon Horns', type: 'hat', price: 2500, svg: `<path d="M7 6 Q4 0 2 2" stroke="#ff0055" stroke-width="2" fill="none"/><path d="M17 6 Q20 0 22 2" stroke="#ff0055" stroke-width="2" fill="none"/>` },
    'hat_crystal': { name: 'Floating Gem', type: 'hat', price: 5000, svg: `<path d="M12 -12 L15 -7 L12 -2 L9 -7 Z" fill="#00d2d3" stroke="#fff" stroke-width="0.5"><animate attributeName="dy" values="0;2;0" dur="2s" repeatCount="indefinite"/></path>` },
    'hat_crown': { name: 'King Crown', type: 'hat', price: 10000, svg: `<path d="M4 8 L6 0 L10 8 L12 0 L14 8 L18 0 L20 8 L20 10 H4 Z" fill="#f1c40f" stroke="#f39c12"/>` },

    // ==========================================
    // --- 3. РУБАШКИ (SHIRTS) ---
    // ==========================================
    'shirt_black': { name: 'Black Tee', type: 'shirt', price: 10, color: '#2d3436', svg: `` },
    'shirt_tux': { name: 'Tuxedo', type: 'shirt', price: 250, color: '#2d3436', svg: `<path d="M12 18 L12 30" stroke="#ecf0f1"/><polygon points="12,18 9,22 15,22" fill="#ecf0f1"/><polygon points="12,22 10,24 14,24" fill="#c0392b"/>` },
    'shirt_hoodie': { name: 'Red Hoodie', type: 'shirt', price: 150, color: '#c0392b', svg: `<rect x="8" y="20" width="8" height="6" fill="#e74c3c" rx="1"/><line x1="10" y1="18" x2="10" y2="25" stroke="#a93226"/><line x1="14" y1="18" x2="14" y2="25" stroke="#a93226"/>` },
    'shirt_gold': { name: 'Golden Chain', type: 'shirt', price: 1000, color: '#000', svg: `<path d="M8 18 Q12 28 16 18" stroke="#f1c40f" stroke-width="2" fill="none"/><circle cx="12" cy="25" r="3" fill="#f1c40f"/>` },
    'shirt_armor': { name: 'Iron Plate', type: 'shirt', price: 800, color: '#7f8c8d', svg: `<rect x="6" y="19" width="12" height="10" fill="#95a5a6" stroke="#2c3e50"/><circle cx="12" cy="24" r="2" fill="#3498db"/>` },
    'shirt_supreme': { name: 'Hype Beast', type: 'shirt', price: 2000, color: '#fff', svg: `<rect x="6" y="22" width="12" height="4" fill="#e74c3c"/><text x="7" y="25" font-size="3" fill="#fff" font-family="Arial">COOL</text>` },

    // ==========================================
    // --- 4. ШТАНЫ (PANTS) ---
    // ==========================================
    'pants_jeans': { name: 'Blue Jeans', type: 'pants', price: 20, color: '#2980b9', svg: `<rect x="5" y="34" width="14" height="1" fill="rgba(0,0,0,0.2)"/>` },
    'pants_camo': { name: 'Military', type: 'pants', price: 100, color: '#5F6A32', svg: `<circle cx="8" cy="32" r="1" fill="#3E4720"/><circle cx="16" cy="35" r="1.5" fill="#3E4720"/>` },
    'pants_robot': { name: 'Robo Legs', type: 'pants', price: 1500, color: '#2d3436', svg: `<rect x="6" y="28" width="4" height="10" fill="#95a5a6"/><rect x="14" y="28" width="4" height="10" fill="#95a5a6"/><line x1="5" y1="32" x2="19" y2="32" stroke="#e74c3c"/>` },
    'pants_adidas': { name: 'Tracksuit', type: 'pants', price: 300, color: '#000', svg: `<line x1="5" y1="28" x2="5" y2="38" stroke="#fff"/><line x1="19" y1="28" x2="19" y2="38" stroke="#fff"/>` },

    // --- DEFAULTS ---
    'default': { name: 'Default', type: 'hat', price: 0, svg: '' },
    'none': { name: 'None', type: 'hat', price: 0, svg: '' },
    'none_shirt': { name: 'Default Shirt', type: 'shirt', price: 0, color: '#6c5ce7', svg: '' },
    'none_pants': { name: 'Default Pants', type: 'pants', price: 0, color: '#2d3436', svg: '' }
};


// Функция отрисовки аватара (Оставь как есть, она универсальная)
function getAvatarSVG(user) {
    if(!user) return '';
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

// Функция для генерации превью в магазине (не меняй её)
function getItemSVG(itemId) {
    const item = ASSETS[itemId];
    if(!item) return '';
    const skin = '#ffccaa';
    
    if(item.type === 'face') return `<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" fill="${skin}" rx="4"/>${item.svg}</svg>`;
    if(item.type === 'hat') return `<svg viewBox="0 -10 24 35">${item.svg}</svg>`;
    if(item.type === 'shirt') return `<svg viewBox="0 15 24 20"><rect x="5" y="18" width="14" height="12" fill="${item.color}" rx="3"/>${item.svg}</svg>`;
    if(item.type === 'pants') return `<svg viewBox="0 25 24 15"><rect x="5" y="20" width="14" height="12" fill="${item.color}" rx="2"/>${item.svg}</svg>`;
    return `<svg viewBox="0 0 24 24">${item.svg}</svg>`;
}

window.GAME_ASSETS = ASSETS;
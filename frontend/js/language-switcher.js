// language-switcher.js

// 1. Inject Styles
const style = document.createElement('style');
style.textContent = `
    /* Hide the default Google Translate widget and top banner */
    .skiptranslate.goog-te-gadget { display: none !important; opacity: 0 !important; }
    #goog-gt-tt { display: none !important; }
    .goog-te-banner-frame { display: none !important; }
    body { top: 0 !important; }
    
    /* Clean up the iframe injects */
    iframe.goog-te-menu-frame { display: none !important; }

    .custom-lang-switcher {
        position: fixed;
        bottom: 20px;
        right: 20px;
        left: auto;
        z-index: 999999;
        font-family: 'Inter', 'Outfit', sans-serif;
    }

    /* Force absolute bounds if wrapped in the mobile frame */
    .mobile-wrapper .custom-lang-switcher {
        position: absolute;
    }

    /* Mobile adjustments: Hide floating button and center the menu */
    @media (max-width: 768px) {
        .custom-lang-switcher {
            /* Button itself is hidden via .lang-switcher-btn rule, 
               but keep container for overlay/menu logic */
            position: fixed;
            inset: 0;
            pointer-events: none;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000000;
        }
        .lang-switcher-btn {
            display: none !important;
        }
        .lang-dropdown-menu {
            position: relative !important;
            bottom: auto !important;
            right: auto !important;
            left: auto !important;
            transform: scale(0.9) !important;
            margin: 0 !important;
            padding: 10px 0 !important;
            width: 80% !important;
            max-width: 280px !important;
            border-radius: 20px !important;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5) !important;
            transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
            pointer-events: auto;
        }
        .lang-dropdown-menu.active {
            transform: scale(1) !important;
            opacity: 1 !important;
        }
        /* Mobile Overlay Backdrop */
        .custom-lang-switcher::before {
            content: '';
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(4px);
            opacity: 0;
            visibility: hidden;
            transition: all 0.25s ease;
            pointer-events: auto;
        }
        .custom-lang-switcher.overlay-active::before {
            opacity: 1;
            visibility: visible;
        }
    }

    .lang-switcher-btn {
        background: rgba(15, 15, 15, 0.95);
        border: 1px solid rgba(255, 215, 0, 0.3);
        color: #fff;
        padding: 6px 14px;
        border-radius: 20px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 500;
        transition: all 0.3s ease;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
        outline: none;
    }

    .lang-switcher-btn:hover {
        border-color: rgba(255, 215, 0, 0.8);
        box-shadow: 0 4px 20px rgba(255, 215, 0, 0.2);
        transform: translateY(-2px);
    }

    .lang-switcher-btn i {
        color: #ffd700;
        font-size: 14px;
    }

    .lang-dropdown-menu {
        position: absolute;
        bottom: calc(100% + 10px);
        right: 0;
        left: auto;
        background: #0f0f0f !important;
        border: 1px solid rgba(255, 215, 0, 0.2);
        border-radius: 12px;
        padding: 5px 0;
        min-width: 140px;
        opacity: 0;
        visibility: hidden;
        transform: translateY(10px);
        transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
        display: flex;
        flex-direction: column;
        z-index: 1000000;
        width: max-content;
        overflow: visible !important;
    }

    .lang-dropdown-menu.active {
        opacity: 1;
        visibility: visible;
        transform: translateY(0) !important;
    }

    .lang-option {
        padding: 10px 16px;
        color: #ffffff !important;
        background: #0f0f0f !important;
        cursor: pointer;
        transition: all 0.2s;
        font-size: 13px;
        display: flex;
        align-items: center;
        gap: 10px;
        font-weight: 500;
        white-space: nowrap;
        width: 100%;
    }

    .lang-option:hover {
        background: rgba(255, 215, 0, 0.1);
        color: #ffd700;
    }
    
    .lang-option span.flag {
        font-size: 16px;
    }
    
    .no-translate {
        translate: no;
    }
`;
document.head.appendChild(style);

// 2. Inject Google Translate container
const gtContainer = document.createElement('div');
gtContainer.id = 'google_translate_element';
gtContainer.style.display = 'none';
document.body.appendChild(gtContainer);

// 3. Inject Custom Switcher UI
const switcherHTML = `
    <div class="custom-lang-switcher no-translate">
        <button class="lang-switcher-btn" id="lang-btn">
            <i class="fas fa-globe"></i>
            <span id="current-lang">English</span>
            <i class="fas fa-chevron-up" style="font-size: 10px; margin-left: 4px;"></i>
        </button>
        <div class="lang-dropdown-menu" id="lang-menu">
            <div class="lang-option" data-val="en"><span class="flag">🇺🇸</span> English</div>
            <div class="lang-option" data-val="kn"><span class="flag">🇮🇳</span> ಕನ್ನಡ</div>
            <div class="lang-option" data-val="ml"><span class="flag">🇮🇳</span> മലയാളം</div>
            <div class="lang-option" data-val="ta"><span class="flag">🇮🇳</span> தமிழ்</div>
        </div>
    </div>
`;

// Define function before use to handle immediate calls if needed
window.openLanguageMenu = () => {
    // Ensure the switcher HTML is injected first
    const container = document.querySelector('.mobile-wrapper') || document.body;
    if (!document.getElementById('lang-btn')) {
        container.insertAdjacentHTML('beforeend', switcherHTML);
        initLanguageSwitcher();
    }

    const langMenu = document.getElementById('lang-menu');
    const wrapper = document.querySelector('.custom-lang-switcher');
    if (langMenu && wrapper) {
        // Force pointer-events on the wrapper so overlay is clickable
        wrapper.style.pointerEvents = 'auto';
        wrapper.classList.add('overlay-active');
        langMenu.classList.add('active');
    } else {
        console.warn('Language menu not yet initialized.');
        // Fallback: try again after a short delay for DOM readiness
        setTimeout(() => {
            const lm = document.getElementById('lang-menu');
            const w = document.querySelector('.custom-lang-switcher');
            if (lm && w) {
                w.style.pointerEvents = 'auto';
                w.classList.add('overlay-active');
                lm.classList.add('active');
            }
        }, 300);
    }
};

// 4. Load Google Translate Script
window.googleTranslateElementInit = function() {
    new google.translate.TranslateElement({
        pageLanguage: 'en',
        includedLanguages: 'en,kn,ml,ta',
        autoDisplay: false
    }, 'google_translate_element');
};

const script = document.createElement('script');
script.src = "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
document.head.appendChild(script);

// 5. Initialization Function
function initLanguageSwitcher() {
    const container = document.querySelector('.mobile-wrapper') || document.body;
    if (!document.getElementById('lang-btn')) {
        container.insertAdjacentHTML('beforeend', switcherHTML);
    }

    const langBtn = document.getElementById('lang-btn');
    const langMenu = document.getElementById('lang-menu');
    const currentLangText = document.getElementById('current-lang');
    
    if(!langBtn || !langMenu) return;

    // Mapping values to display names
    const langMap = {
        'en': 'English',
        'kn': 'ಕನ್ನಡ',
        'ml': 'മലയാളം',
        'ta': 'தமிழ்'
    };

    // Toggle dropdown
    langBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const wrapper = document.querySelector('.custom-lang-switcher');
        if (wrapper) wrapper.classList.toggle('overlay-active');
        langMenu.classList.toggle('active');
    });

    // Close when clicking outside of the menu
    document.addEventListener('click', (e) => {
        if(!e.target.closest('#lang-menu') && !e.target.closest('#lang-btn')) {
            const wrapper = document.querySelector('.custom-lang-switcher');
            if (wrapper) wrapper.classList.remove('overlay-active');
            langMenu.classList.remove('active');
        }
    });

    // Handle language selection
    const options = document.querySelectorAll('.lang-option');
    options.forEach(opt => {
        opt.addEventListener('click', (e) => {
            const val = e.currentTarget.getAttribute('data-val');
            
            // Update UI visually
            if(langMap[val]) {
                currentLangText.innerText = langMap[val];
            }

            // Fire event on google select
            const selectElement = document.querySelector('.goog-te-combo');
            if (selectElement) {
                selectElement.value = val;
                selectElement.dispatchEvent(new Event('change'));
            }
            
            langMenu.classList.remove('active');
            const wrapper = document.querySelector('.custom-lang-switcher');
            if (wrapper) wrapper.classList.remove('overlay-active');
        });
    });
    
    // Cookie Restore Login
    const checkCookie = setInterval(() => {
        const selectElement = document.querySelector('.goog-te-combo');
        if (selectElement && selectElement.value) {
            const val = selectElement.value;
            if(langMap[val]) {
                currentLangText.innerText = langMap[val];
            }
            clearInterval(checkCookie);
        }
    }, 500);
    setTimeout(() => clearInterval(checkCookie), 5000);
}

// Execute Initialization
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initLanguageSwitcher();
} else {
    document.addEventListener('DOMContentLoaded', initLanguageSwitcher);
}

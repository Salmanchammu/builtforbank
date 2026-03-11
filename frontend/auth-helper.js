// Modern Auth Helper Functions
// This ensures all auth pages work correctly

// Toggle Password Visibility
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const icon = event.target;

    if (!input) return;

    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

// Show Toast Notification
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = 'toast show ' + type;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function () {
    console.log('Auth page helper initialized');
    initRecaptcha();
    initLiquidCursor();
    initSecurity();
});

/**
 * Deterrence measures for authentication security
 */
function initSecurity() {
    // 1. Disable Right-Click
    document.addEventListener('contextmenu', e => e.preventDefault());

    // 2. Block screenshot/capture shortcuts
    document.addEventListener('keydown', e => {
        if (e.ctrlKey && (e.key === 'p' || e.key === 's' || e.key === 'u' || (e.key === 'i' && e.shiftKey))) {
            e.preventDefault();
            alert('Action disabled.');
            return false;
        }
        if (e.key === 'PrintScreen' || e.keyCode === 44) {
            e.preventDefault();
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText('');
            }
            alert('Screenshot capture is restricted.');
        }
    });

    // 3. Keyup PrintScreen Detection
    window.addEventListener('keyup', e => {
        if (e.key === 'PrintScreen' || e.keyCode === 44) {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText('');
            }
            if (typeof showToast === 'function') showToast('Security Warning: Screenshot detected', 'error');
        }
    });

    // Note: Privacy mask/flash are typically reserved for dashboards with financial data.
    // Auth pages use these basic deterrence measures.
}

// Real-time Interactive reCAPTCHA Mock
function initRecaptcha() {
    const containers = document.querySelectorAll('.recaptcha-mock');
    if (containers.length === 0) return;

    containers.forEach((container, index) => {
        // Build unique IDs for each instance
        const triggerId = `rcTrigger_${index}`;
        const boxId = `rcBox_${index}`;

        container.innerHTML = `
            <div class="rc-left">
                <div class="rc-checkbox-wrapper" id="${triggerId}">
                    <div class="rc-checkbox" id="${boxId}"></div>
                </div>
                <span class="rc-text">I'm not a robot</span>
            </div>
            <div class="rc-right">
                <i class="fab fa-google"></i>
                <span>reCAPTCHA<br>Privacy - Terms</span>
            </div>
        `;

        const trigger = document.getElementById(triggerId);
        const box = document.getElementById(boxId);

        trigger.addEventListener('click', () => {
            if (container.dataset.verified === 'true') return;

            // 1. Start Spinning
            box.classList.add('loading');

            // 2. Simulate Verification Delay
            setTimeout(() => {
                box.classList.remove('loading');
                box.classList.add('verified');
                container.dataset.verified = 'true';
                console.log(`reCAPTCHA ${index} Verified`);

                // Set global flag if any is verified
                window._isRecaptchaVerified = true;
            }, 1200);
        });
    });
}

// Liquid Cursor Effect
function initLiquidCursor() {
    if (window.matchMedia("(hover: none) and (pointer: coarse)").matches) return;

    const dot = document.createElement('div');
    const blob = document.createElement('div');
    dot.className = 'cursor-dot';
    blob.className = 'cursor-blob';
    document.body.appendChild(dot);
    document.body.appendChild(blob);

    let mouseX = 0, mouseY = 0;
    let dotX = 0, dotY = 0;
    let blobX = 0, blobY = 0;

    window.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    const animate = () => {
        // Dot follows instantly
        dotX = mouseX;
        dotY = mouseY;
        dot.style.transform = `translate3d(${dotX}px, ${dotY}px, 0) translate(-50%, -50%)`;

        // Blob follows with delay (interpolation)
        blobX += (mouseX - blobX) * 0.15;
        blobY += (mouseY - blobY) * 0.15;
        blob.style.transform = `translate3d(${blobX}px, ${blobY}px, 0) translate(-50%, -50%)`;

        requestAnimationFrame(animate);
    };
    animate();

    // Interactive states
    const interactiveEls = 'a, button, input, select, .checkbox-wrapper, .rc-checkbox-wrapper';
    document.addEventListener('mouseover', (e) => {
        if (e.target.closest(interactiveEls)) {
            blob.style.width = '60px';
            blob.style.height = '60px';
            blob.style.background = 'rgba(197, 160, 89, 0.2)';
        }
    });
    document.addEventListener('mouseout', (e) => {
        if (e.target.closest(interactiveEls)) {
            blob.style.width = '40px';
            blob.style.height = '40px';
            blob.style.background = 'rgba(142, 32, 32, 0.4)';
        }
    });
}

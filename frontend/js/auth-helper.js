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

// Redundant showToast removed (handled by premium-ui.js)

// Initialize on page load
document.addEventListener('DOMContentLoaded', function () {
    console.log('Auth page helper initialized');

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




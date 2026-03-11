/**
 * Smart Bank - API Configuration
 * Robust Dynamic API Base Detection
 */

// --- SERVICE WORKER RESET ---
// Forcefully unregister any active service worker to prevent stale caching issues
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
        for (let registration of registrations) {
            registration.unregister().then(() => {
                console.log('Service Worker Unregistered successfully');
            });
        }
    });
}

const getApiBase = () => {
    const hostname = window.location.hostname;
    const port = window.location.port;
    const protocol = window.location.protocol; // http: or https:

    // 1. Identify Local/Private context
    const isLocal = !hostname ||
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '[::1]' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname);

    // 2. Determine base URL
    if (isLocal) {
        // Force protocol to match the current page to avoid mixed content errors
        const targetProtocol = protocol.startsWith('http') ? protocol : 'http:';

        // If we are on a different port than backend (5000), force backend port
        if (port && port !== '5000' && port !== '80') {
            console.log(`[API Config] External dev port detected (${port}). Forcing backend to port 5000.`);
            return `${targetProtocol}//${hostname}:5000/api`;
        }

        // If we are on port 5000 already, relative path is safer
        if (port === '5000') {
            return '/api';
        }

        return `${targetProtocol}//${hostname || 'localhost'}:5000/api`;
    }

    return '/api';
};

const API_BASE_URL = getApiBase();
window.SMART_BANK_API_BASE = API_BASE_URL;
window.API = API_BASE_URL;
console.log('✓ API Base configured:', window.API);

// --- NUCLEAR CONNECTION DEBUGGER ---
window.SMART_BANK_FIX_CONNECTION = async function () {
    console.warn('!!! NUCLEAR CONNECTION FIX INITIATED !!!');

    // 1. Clear Service Workers
    if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let r of registrations) await r.unregister();
    }

    // 2. Clear Caches
    if ('caches' in window) {
        const keys = await caches.keys();
        for (let k of keys) await caches.delete(k);
    }

    // 3. Clear Storage
    localStorage.clear();
    sessionStorage.clear();

    // 4. Force Reload without cache
    window.location.reload(true);
};

function injectConnectionDebugger(errorMsg) {
    if (document.getElementById('conn-debugger')) return;

    const overlay = document.createElement('div');
    overlay.id = 'conn-debugger';
    overlay.className = 'conn-debugger-overlay active';
    overlay.innerHTML = `
        <div class="conn-debugger-card">
            <div class="conn-debugger-icon"><i class="fas fa-plug-circle-xmark"></i></div>
            <h2 class="conn-debugger-title">Connection Failed</h2>
            <p class="conn-debugger-msg">The application cannot reach the backend server. This usually happens due to stale browser cache or restricted network settings.</p>
            
            <div class="conn-diagnostic-info">
                <div class="conn-diagnostic-item"><span class="conn-diagnostic-label">Endpoint:</span> <span>${window.API}</span></div>
                <div class="conn-diagnostic-item"><span class="conn-diagnostic-label">Origin:</span> <span>${window.location.origin}</span></div>
                <div class="conn-diagnostic-item"><span class="conn-diagnostic-label">Browser:</span> <span>${navigator.userAgent.split(' ').pop()}</span></div>
                <div class="conn-diagnostic-item"><span class="conn-diagnostic-label">Error:</span> <span style="color: #e53e3e">${errorMsg || 'Failed to fetch'}</span></div>
            </div>

            <button class="conn-fix-btn" onclick="window.SMART_BANK_FIX_CONNECTION()">
                <i class="fas fa-magic"></i> Automatic Fix & Reload
            </button>
            
            <p style="margin-top: 15px; font-size: 11px; color: #94a3b8;">This will clear browser cache and reset the connection.</p>
        </div>
    `;
    document.body.appendChild(overlay);
}

// --- GLOBAL FETCH INTERCEPTOR ---
const originalFetch = window.fetch;
window.fetch = async function (url, options) {
    if (!options) options = {};
    if (!options.headers) options.headers = {};

    const isInternalAPI = typeof url === 'string' && (url.includes(':5000/api') || url.includes('/api/'));
    if (isInternalAPI) {
        options.credentials = 'include';
        // Add tunnel bypass headers anyway
        if (options.headers instanceof Headers) {
            options.headers.append('Bypass-Tunnel-Reminder', 'true');
        } else {
            options.headers['Bypass-Tunnel-Reminder'] = 'true';
        }
    }

    try {
        const response = await originalFetch(url, options);
        if (response.status === 401 && isInternalAPI && !url.includes('/auth/')) {
            const loginUrl = (window.SmartBankDeviceDetector && window.SmartBankDeviceDetector.getLoginUrl) 
                ? window.SmartBankDeviceDetector.getLoginUrl() 
                : 'user.html';
            
            // Guard: Only redirect if not already on the login page to avoid refresh loops
            if (!window.location.pathname.includes(loginUrl)) {
                window.location.href = loginUrl;
            }
        }
        return response;
    } catch (error) {
        if (isInternalAPI) {
            console.error('[Connection Error]', error);
            injectConnectionDebugger(error.message);
        }
        throw error;
    }
};

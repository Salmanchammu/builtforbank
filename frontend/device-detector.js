/**
 * Smart Bank - Device Detector Utility
 * Silently detects if the user is on a mobile or desktop device.
 */
(function () {
    window.SmartBankDeviceDetector = {
        // Redirection Mapping: [Desktop Page] -> [Mobile Page]
        redirectionMap: {
            'index.html': 'mobile-auth.html',
            'user.html': 'mobile-auth.html',
            'signup.html': 'mobile-signup.html',
            'forgot-password.html': 'mobile-forgot-password.html',
            'userdash.html': 'mobile-dash.html',
            'staffdash.html': 'mobile-dash.html',
            'admindash.html': 'mobile-dash.html'
        },

        // Reverse Mapping: [Mobile Page] -> [Desktop Page]
        reverseMap: {
            'mobile-auth.html': 'user.html',
            'mobile-signup.html': 'signup.html',
            'mobile-forgot-password.html': 'forgot-password.html',
            'mobile-dash.html': 'userdash.html'
        },

        getDeviceType: function () {
            const ua = navigator.userAgent;
            const width = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
            
            // Primary check: User Agent
            if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
                return "tablet";
            }
            if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
                return "mobile";
            }

            // Secondary check: Screen Width fallback for tricky mobile devices
            if (width <= 850) {
                return "mobile";
            }

            return "desktop";
        },

        // Helper to get the correct login page based on device
        getLoginUrl: function() {
            const device = this.getDeviceType();
            return (device === 'mobile' || device === 'tablet') ? 'mobile-auth.html' : 'user.html';
        },

        // Helper to get the correct dashboard based on device
        getDashboardUrl: function() {
            const device = this.getDeviceType();
            return (device === 'mobile' || device === 'tablet') ? 'mobile-dash.html' : 'userdash.html';
        },

        checkAndRedirect: function () {
            const deviceType = this.getDeviceType();
            const fullPath = window.location.pathname;
            const fileName = fullPath.substring(fullPath.lastIndexOf('/') + 1) || 'index.html';
            
            let target = null;
            if (deviceType === 'mobile' || deviceType === 'tablet') {
                target = this.redirectionMap[fileName];
            } else {
                target = this.reverseMap[fileName];
            }

            // ONLY redirect if target is defined AND it's not the current page
            if (target && target !== fileName) {
                // Final safety check: ensure the target isn't already in the URL
                if (window.location.href.indexOf(target) === -1) {
                    // Prevent infinite loops by checking sessionStorage
                    const lastRedirect = sessionStorage.getItem('smart_bank_last_redirect');
                    const now = Date.now();
                    
                    if (lastRedirect && (now - parseInt(lastRedirect)) < 3000) {
                        console.warn("Redirection loop blocked.");
                        return;
                    }

                    sessionStorage.setItem('smart_bank_last_redirect', now.toString());
                    console.log(`Redirecting from ${fileName} to ${target} (${deviceType})`);
                    window.location.href = target;
                }
            }
        }
    };

    // Auto-execute if script is loaded with 'data-auto-redirect' attribute
    const currentScript = document.currentScript;
    if (currentScript && currentScript.hasAttribute('data-auto-redirect')) {
        window.SmartBankDeviceDetector.checkAndRedirect();
    }

    console.log("Device detector initialized: ", window.SmartBankDeviceDetector.getDeviceType());
})();

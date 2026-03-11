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
            'userdash.html': 'mobile-dash.html'
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
            if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
                return "tablet";
            }
            if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
                return "mobile";
            }
            return "desktop";
        },

        checkAndRedirect: function () {
            const deviceType = this.getDeviceType();
            const currentPath = window.location.pathname.split('/').pop() || 'index.html';
            
            // If on mobile device and current page has a mobile equivalent
            if (deviceType === 'mobile' || deviceType === 'tablet') {
                if (this.redirectionMap[currentPath]) {
                    console.log(`Mobile detected. Redirecting ${currentPath} -> ${this.redirectionMap[currentPath]}`);
                    window.location.href = this.redirectionMap[currentPath];
                }
            } 
            // If on desktop device and current page is mobile-only
            else if (deviceType === 'desktop') {
                if (this.reverseMap[currentPath]) {
                    console.log(`Desktop detected. Redirecting ${currentPath} -> ${this.reverseMap[currentPath]}`);
                    window.location.href = this.reverseMap[currentPath];
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

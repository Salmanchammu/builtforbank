// Use global API Configuration
const API_URL = window.SMART_BANK_API_BASE;

// Toggle password visibility is handled in auth-helper.js
// showToast is also handled in auth-helper.js

// ─── Location Permission Handler ─────────────────────────────────────────
let _signupLocationGranted = false;

function requestLocationPermission() {
    const statusBox = document.getElementById('locationStatus');
    const locIcon = document.getElementById('locIcon');
    const locTitle = document.getElementById('locTitle');
    const locDetail = document.getElementById('locDetail');
    const btn = document.getElementById('enableLocationBtn');

    if (!navigator.geolocation) {
        locTitle.textContent = 'Not Supported';
        locDetail.textContent = 'Your browser does not support geolocation';
        return;
    }

    // Show loading state
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Detecting...';
    btn.disabled = true;
    locTitle.textContent = 'Detecting location...';
    locDetail.textContent = 'Please allow location access when prompted';

    navigator.geolocation.getCurrentPosition(
        async (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            document.getElementById('userLat').value = lat;
            document.getElementById('userLng').value = lng;

            // Reverse geocode to show address
            let address = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`, {
                    headers: { 'Accept-Language': 'en' }
                });
                const data = await res.json();
                if (data && data.display_name) {
                    // Build a clean short address
                    const a = data.address || {};
                    const parts = [a.suburb || a.neighbourhood || a.village || '', a.city || a.town || a.state_district || '', a.state || ''].filter(Boolean);
                    address = parts.join(', ') || data.display_name.substring(0, 80);
                }
            } catch(e) {
                console.warn('Reverse geocode failed:', e);
            }

            document.getElementById('userLocationAddress').value = address;
            _signupLocationGranted = true;

            // Success UI
            statusBox.style.background = 'rgba(16,185,129,0.08)';
            statusBox.style.border = '1.5px solid #6ee7b7';
            locIcon.className = 'fas fa-check-circle';
            locIcon.style.color = '#10b981';
            locTitle.textContent = 'Location Verified';
            locTitle.style.color = '#059669';
            locDetail.textContent = address;
            locDetail.style.color = '#475569';
            btn.innerHTML = '<i class="fas fa-check"></i> Enabled';
            btn.style.background = 'linear-gradient(135deg,#059669,#10b981)';
            btn.disabled = true;
        },
        (err) => {
            btn.innerHTML = '<i class="fas fa-crosshairs"></i> Retry';
            btn.disabled = false;
            locTitle.textContent = 'Location Denied';
            locTitle.style.color = '#dc2626';
            if (err.code === 1) {
                locDetail.textContent = 'Please allow location access in browser settings and retry';
            } else {
                locDetail.textContent = 'Unable to detect location. Please try again.';
            }
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
}

// Handle form submission
async function handleSignup(e) {
    if (e) e.preventDefault();
    const btn = document.querySelector('button.btn-primary');
    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const username = document.getElementById('signupUsername').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('signupConfirmPassword').value;
    const agreeTerms = document.getElementById('agreeTerms').checked;

    // Validation
    if (!name || name.length < 2) return showToast('Please enter your full name', 'error');
    if (!email || !email.includes('@')) return showToast('Please enter a valid email address', 'error');
    if (!username || username.length < 3) return showToast('Username must be at least 3 characters', 'error');
    
    if (!password || !/^[A-Z]/.test(password)) {
        return showToast('Password must start with an uppercase letter', 'error');
    }
    if (password !== confirmPassword) return showToast('Passwords do not match', 'error');
    if (!agreeTerms) return showToast('Please agree to terms and conditions', 'error');

    // Location validation — mandatory
    if (!_signupLocationGranted) {
        return showToast('Please enable location sharing to create your account', 'error');
    }

    const userLat = document.getElementById('userLat').value;
    const userLng = document.getElementById('userLng').value;
    const userAddress = document.getElementById('userLocationAddress').value;

    // Prepare data
    const device_type = window.SmartBankDeviceDetector ? window.SmartBankDeviceDetector.getDeviceType() : 'unknown';
    const userData = { username, email, password, name, device_type, latitude: userLat, longitude: userLng, location_address: userAddress };

    // Show loading state
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
    btn.disabled = true;

    try {
        console.log(`[Signup Debug] Sending signup request to: ${API_URL}/auth/signup`);
        const response = await fetch(`${API_URL}/auth/signup`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });

        const data = await response.json();

        if (response.ok && data.success) {
            showToast(data.message || 'Account created! Please verify your email and phone.', 'success');

            // Show OTP Modal instead of redirecting
            document.getElementById('otpUsername').value = username;
            document.getElementById('otpModal').classList.add('show');
            document.getElementById('emailOtpInput').focus();
        } else {
            showToast(data.error || 'Registration failed. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Network error. Please try again.', 'error');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// Handle OTP verification
async function handleOtpVerification(e) {
    if (e) e.preventDefault();
    const btn = document.getElementById('verifyBtn');
    const username = document.getElementById('otpUsername').value;
    const email_otp = document.getElementById('emailOtpInput').value.trim();

    if (email_otp.length !== 6) return showToast('Please enter the 6-digit verification code', 'error');

    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';
    btn.disabled = true;

    try {
        console.log(`[OTP Debug] Verifying OTP for ${username} at: ${API_URL}/auth/verify-otp`);
        const response = await fetch(`${API_URL}/auth/verify-otp`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email_otp })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            showToast('Account activated! Redirecting to login...', 'success');
            setTimeout(() => {
                const detector = window.SmartBankDeviceDetector;
                window.location.href = detector ? detector.getLoginUrl() : 'user.html';
            }, 2000);
        } else {
            showToast(data.error || 'Verification failed.', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Network error. Please try again.', 'error');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
    }

    const otpForm = document.getElementById('otpForm');
    if (otpForm) {
        otpForm.addEventListener('submit', handleOtpVerification);
    }

    const resendLink = document.getElementById('resendOtp');
    if (resendLink) {
        resendLink.addEventListener('click', async (e) => {
            e.preventDefault();
            const username = document.getElementById('otpUsername').value;
            if (!username) return showToast('Session expired. Please signup again.', 'error');

            try {
                console.log(`[OTP Debug] Requesting OTP resend for ${username}`);
                const response = await fetch(`${API_URL}/auth/resend-otp`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username })
                });
                const data = await response.json();
                if (response.ok) {
                    showToast('A new verification code has been sent to your email!', 'success');
                } else {
                    showToast(data.error || 'Failed to resend code.', 'error');
                }
            } catch (error) {
                showToast('Network error. Please try again.', 'error');
            }
        });
    }
});

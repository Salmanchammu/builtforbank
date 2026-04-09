// Use global API Configuration
const API_URL = window.SMART_BANK_API_BASE;

// Toggle password visibility is handled in auth-helper.js
// showToast is also handled in auth-helper.js

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
    
    // Strong password validation (1 caps, 3 numbers, 1 symbol, min 7)
    const hasCaps = /[A-Z]/.test(password);
    const numCount = (password.match(/\d/g) || []).length;
    const hasSymbol = /[@$!%*?&]/.test(password);

    if (password.length < 7 || !hasCaps || numCount < 3 || !hasSymbol) {
        return showToast('Password must be at least 7 characters, with 1 uppercase, 3 numbers, and 1 symbol (@$!%*?&)', 'error');
    }
    if (password !== confirmPassword) return showToast('Passwords do not match', 'error');
    if (!agreeTerms) return showToast('Please agree to terms and conditions', 'error');



    // Prepare data
    const device_type = window.SmartBankDeviceDetector ? window.SmartBankDeviceDetector.getDeviceType() : 'unknown';
    const userData = { username, email, password, name, device_type };

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
            showToast(data.message || 'Account created! Please verify your email.', 'success');

            // Show OTP Modal instead of redirecting
            document.getElementById('otpUsername').value = username;
            document.getElementById('otpModal').classList.add('show');
            document.getElementById('otpInput').focus();
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
    const otp = document.getElementById('otpInput').value.trim();

    if (otp.length !== 6) return showToast('Please enter a 6-digit code', 'error');

    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';
    btn.disabled = true;

    try {
        console.log(`[OTP Debug] Verifying OTP for ${username} at: ${API_URL}/auth/verify-otp`);
        const response = await fetch(`${API_URL}/auth/verify-otp`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, otp })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            showToast('Email verified! Redirecting to login...', 'success');
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
                    showToast('A new verification code has been sent to your email! 📧', 'success');
                } else {
                    showToast(data.error || 'Failed to resend code.', 'error');
                }
            } catch (error) {
                showToast('Network error. Please try again.', 'error');
            }
        });
    }
});

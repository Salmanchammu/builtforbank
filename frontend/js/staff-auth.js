window.API = window.SMART_BANK_API_BASE || '/api';
// Default Staff & Admin Credentials (Mock Database)
const DEFAULT_STAFF_CREDENTIALS = {
    staff: [
        {
            staffId: 'yasir',
            password: 'Yasir123#',
            name: 'Yasir',
            email: 'yasir@bank.com',
            role: 'staff',
            department: 'Customer Service'
        },
        {
            staffId: 'yasir1',
            password: 'Yasir123#',
            name: 'Yasir',
            email: 'yasir1@bank.com',
            role: 'staff',
            department: 'Operations'
        }
    ],
    admin: [
        {
            username: 'salman',
            password: 'salman123',
            name: 'Salman Admin',
            email: 'admin@bank.com',
            role: 'admin',
            level: 'Administrator'
        },
        {
            username: 'admin',
            password: 'admin123',
            name: 'Super Administrator',
            email: 'superadmin@bank.com',
            role: 'superadmin',
            level: 'Super Admin'
        }
    ]
};

// Theme Management
function toggleTheme() {
    const body = document.body;
    const themeIcon = document.getElementById('themeIcon');

    if (body.classList.contains('dark-theme')) {
        body.classList.remove('dark-theme');
        if (themeIcon) {
            themeIcon.classList.remove('fa-sun');
            themeIcon.classList.add('fa-moon');
        }
        localStorage.setItem('theme', 'light');
    } else {
        body.classList.add('dark-theme');
        if (themeIcon) {
            themeIcon.classList.remove('fa-moon');
            themeIcon.classList.add('fa-sun');
        }
        localStorage.setItem('theme', 'dark');
    }
}

// Load theme on page load
window.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        const themeIcon = document.getElementById('themeIcon');
        if (themeIcon) {
            themeIcon.classList.remove('fa-moon');
            themeIcon.classList.add('fa-sun');
        }
    }
});

// Toggle password visibility
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const icon = input.nextElementSibling;

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

// Show/Hide Login Cards
function showStaffLogin() {
    document.getElementById('staffLoginCard').style.display = 'block';
    document.getElementById('adminLoginCard').style.display = 'none';
    document.getElementById('forgotPasswordStaffCard').style.display = 'none';
    document.getElementById('forgotPasswordAdminCard').style.display = 'none';
}

function showAdminLogin() {
    document.getElementById('staffLoginCard').style.display = 'none';
    document.getElementById('adminLoginCard').style.display = 'block';
    document.getElementById('forgotPasswordStaffCard').style.display = 'none';
    document.getElementById('forgotPasswordAdminCard').style.display = 'none';
}

function showForgotPasswordStaff(event) {
    if (event) event.preventDefault();
    document.getElementById('staffLoginCard').style.display = 'none';
    document.getElementById('adminLoginCard').style.display = 'none';
    document.getElementById('forgotPasswordStaffCard').style.display = 'block';
    document.getElementById('forgotPasswordAdminCard').style.display = 'none';
}

function showForgotPasswordAdmin(event) {
    if (event) event.preventDefault();
    document.getElementById('staffLoginCard').style.display = 'none';
    document.getElementById('adminLoginCard').style.display = 'none';
    document.getElementById('forgotPasswordStaffCard').style.display = 'none';
    document.getElementById('forgotPasswordAdminCard').style.display = 'block';
}

// Staff Login
async function staffLogin(e) {
    if (e) e.preventDefault();
    const staffId = document.getElementById('staffId').value.trim();
    const password = document.getElementById('staffPassword').value;

    if (!staffId || !password) {
        showToast('Please enter Staff ID and password', 'error');
        return;
    }

    try {
        const response = await fetch(API + '/auth/login', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: staffId,
                password: password,
                role: 'staff',
                device_type: window.SmartBankDeviceDetector ? window.SmartBankDeviceDetector.getDeviceType() : 'unknown'
            })
        });

        const data = await response.json();

        // Handle 2FA flow
        if (response.ok && data.requires_2fa) {
            document.getElementById('otpUsername').value = data.username;
            document.getElementById('otpRole').value = data.role;
            document.getElementById('staffForm').style.display = 'none';
            document.getElementById('adminForm').style.display = 'none';
            document.getElementById('staffOtpSection').style.display = 'block';
            document.getElementById('staffEmailOtp').value = '';
            document.getElementById('staffEmailOtp').focus();
            if (data.dev_otp) {
                document.getElementById('staffEmailOtp').value = data.dev_otp;
                showToast('OTP Auto-filled. Click Verify to continue.', 'success');
            } else {
                showToast('Verification code sent to your registered email.', 'info');
            }
            return;
        }

        if (response.ok && data.success) {
            _finalizeStaffLogin(data);
            return;
        } else {
            showToast(data.error || 'Invalid credentials', 'error');
            return;
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('Connection to server failed. Ensure backend is running.', 'error');
    }
}

// Admin Login
async function adminLogin(e) {
    if (e) e.preventDefault();
    const username = document.getElementById('adminUsername').value.trim();
    const password = document.getElementById('adminPassword').value;

    if (!username || !password) {
        showToast('Please enter username and password', 'error');
        return;
    }

    try {
        const response = await fetch(API + '/auth/login', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username,
                password,
                role: 'admin',
                device_type: window.SmartBankDeviceDetector ? window.SmartBankDeviceDetector.getDeviceType() : 'unknown'
            })
        });

        const data = await response.json();

        // Handle 2FA flow
        if (response.ok && data.requires_2fa) {
            document.getElementById('otpUsername').value = data.username;
            document.getElementById('otpRole').value = data.role;
            document.getElementById('staffForm').style.display = 'none';
            document.getElementById('adminForm').style.display = 'none';
            document.getElementById('staffOtpSection').style.display = 'block';
            document.getElementById('staffEmailOtp').value = '';
            document.getElementById('staffEmailOtp').focus();
            if (data.dev_otp) {
                document.getElementById('staffEmailOtp').value = data.dev_otp;
                showToast('OTP Auto-filled. Click Verify to continue.', 'success');
            } else {
                showToast('Verification code sent to your registered email.', 'info');
            }
            return;
        }

        if (response.ok && data.success) {
            _finalizeStaffLogin(data);
            return;
        } else {
            showToast(data.error || 'Invalid credentials', 'error');
            return;
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('Connection to server failed. Ensure backend is running.', 'error');
    }
}

// Verify 2FA OTP for Staff/Admin
async function verifyStaffLogin(e) {
    if (e) e.preventDefault();
    const username = document.getElementById('otpUsername').value;
    const role = document.getElementById('otpRole').value;
    const email_otp = document.getElementById('staffEmailOtp').value.trim();

    if (email_otp.length !== 6) {
        showToast('Please enter the 6-digit verification code', 'error');
        return;
    }

    const btn = document.getElementById('staffVerifyBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';
    btn.disabled = true;

    try {
        const response = await fetch(API + '/auth/verify-login', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, role, email_otp })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            document.getElementById('staffOtpSection').style.display = 'none';
            _finalizeStaffLogin(data);
        } else {
            showToast(data.error || 'Verification failed.', 'error');
        }
    } catch (error) {
        console.error('Verify error:', error);
        showToast('Connection to server failed.', 'error');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// Finalize login after successful auth (direct or 2FA)
function _finalizeStaffLogin(data) {
    localStorage.removeItem('user');
    localStorage.removeItem('staff');
    localStorage.removeItem('admin');
    localStorage.removeItem('token');

    const role = data.user.role;
    if (role === 'admin') {
        localStorage.setItem('admin', JSON.stringify(data.user));
    } else {
        localStorage.setItem('staff', JSON.stringify(data.user));
    }
    if (data.token) localStorage.setItem('token', data.token);
    showToast('Login successful!', 'success');

    setTimeout(() => {
        const detector = window.SmartBankDeviceDetector;
        if (role === 'admin') {
            window.location.href = detector ? detector.getDashboardUrl('admin') : 'admindash.html';
        } else {
            window.location.href = detector ? detector.getDashboardUrl('staff') : 'staffdash.html';
        }
    }, 500);
}

// ─── Face Login (delegates to unified FaceAuthManager) ───────────────────────
// The FaceAuthManager in face-auth-fixed.js handles all face-login logic
// with real-time preview, score threshold 0.5, 3-frame confirmation, and
// landmark structure validation. We simply call it here.

function initFaceLogin(type) {
    if (typeof faceAuthManager === 'undefined') {
        showToast('Face AI not loaded yet. Please wait a moment and try again.', 'warning');
        return;
    }
    faceAuthManager.openLoginModal(type); // 'staff' or 'admin'
}


// Send Reset Email Functions
function sendResetEmailStaff() {
    const email = document.getElementById('forgotStaffEmail').value.trim();

    if (!email) {
        showToast('Please enter your email address', 'error');
        return;
    }

    showToast('Password reset link sent to your email!', 'success');
    setTimeout(() => {
        showStaffLogin();
    }, 2000);
}

function sendResetEmailAdmin() {
    const email = document.getElementById('forgotAdminEmail').value.trim();

    if (!email) {
        showToast('Please enter your email address', 'error');
        return;
    }

    showToast('Password reset link sent to your email!', 'success');
    setTimeout(() => {
        showAdminLogin();
    }, 2000);
}

// Toast notification
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Set up form submission listeners
document.addEventListener('DOMContentLoaded', () => {
    const staffForm = document.getElementById('staffForm');
    const adminForm = document.getElementById('adminForm');

    if (staffForm) staffForm.addEventListener('submit', staffLogin);
    if (adminForm) adminForm.addEventListener('submit', adminLogin);
});

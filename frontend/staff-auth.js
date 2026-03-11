window.API = window.SMART_BANK_API_BASE || '/api';
// Default Staff & Admin Credentials (Mock Database)
const DEFAULT_STAFF_CREDENTIALS = {
    staff: [
        {
            staffId: 'yasir',
            password: 'yasir123',
            name: 'Yasir',
            email: 'yasir@bank.com',
            role: 'staff',
            department: 'Customer Service'
        },
        {
            staffId: 'yasir1',
            password: 'yasir123',
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

    // Try backend first
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

        if (response.ok) {
            localStorage.setItem('staff', JSON.stringify(data.user));
            localStorage.setItem('token', data.token || 'real-staff-token');
            showToast('Login successful!', 'success');

            setTimeout(() => {
                window.location.href = 'staffdash.html';
            }, 500);
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

    // Try backend first
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

        if (response.ok) {
            localStorage.setItem('admin', JSON.stringify(data.user));
            localStorage.setItem('token', data.token || 'real-admin-token');
            showToast('Login successful!', 'success');

            setTimeout(() => {
                window.location.href = 'admindash.html';
            }, 500);
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

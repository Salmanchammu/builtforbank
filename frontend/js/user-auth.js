// Default User Credentials (Mock Database)
const DEFAULT_USER_CREDENTIALS = {
    users: [
        {
            username: 'salman',
            password: 'salman123',
            email: 'salman@example.com',
            name: 'Salman',
            accountType: 'Checking & Savings',
            balance: '₹15,000',
            accountNumber: '****2345',
            role: 'user'
        },
        {
            username: 'salman1',
            password: 'salman123',
            email: 'salman1@example.com',
            name: 'Salman',
            accountType: 'Savings & Investment',
            balance: '₹18,95,075',
            accountNumber: '****5678',
            role: 'user'
        },
        {
            username: 'salman2',
            password: 'salman123',
            email: 'salman2@example.com',
            name: 'Salman',
            accountType: 'Business & Checking',
            balance: '₹45,23,000',
            accountNumber: '****9012',
            role: 'user'
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

// Show forgot password form
function showForgotPassword(event) {
    if (event) event.preventDefault();
    document.getElementById('loginCard').style.display = 'none';
    document.getElementById('forgotPasswordCard').style.display = 'block';
}

// Show login form
function showLogin() {
    document.getElementById('forgotPasswordCard').style.display = 'none';
    document.getElementById('loginCard').style.display = 'block';
}

// User Login - Works with both backend and mock credentials
async function userLogin(e) {
    if (e) e.preventDefault();
    const emailOrUsername = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!emailOrUsername || !password) {
        showToast('Please enter email/username and password', 'error');
        return;
    }

    // Try backend first
    try {
        const baseURL = window.API || '/api';
        const loginURL = `${baseURL}/auth/login`;
        console.log(`[Login Debug] Attempting login at: ${loginURL}`);

        const response = await fetch(loginURL, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: emailOrUsername,
                password,
                role: 'user',
                device_type: window.SmartBankDeviceDetector ? window.SmartBankDeviceDetector.getDeviceType() : 'unknown'
            })
        });

        console.log(`[Login Debug] Response status: ${response.status}`);
        const data = await response.json();

        if (response.ok) {
            // Clear any existing stale auth data first
            localStorage.removeItem('user');
            localStorage.removeItem('staff');
            localStorage.removeItem('admin');
            localStorage.removeItem('token');

            // Save user data under correct key
            const role = data.user.role;
            if (role === 'admin') {
                localStorage.setItem('admin', JSON.stringify(data.user));
            } else if (role === 'staff') {
                localStorage.setItem('staff', JSON.stringify(data.user));
            } else {
                localStorage.setItem('user', JSON.stringify(data.user));
            }
            localStorage.setItem('token', data.token);
            showToast('Login successful!', 'success');

            // Redirect based on role
            setTimeout(() => {
                const detector = window.SmartBankDeviceDetector;
                if (role === 'admin') window.location.href = 'admindash.html';
                else if (role === 'staff') window.location.href = 'staffdash.html';
                else {
                    window.location.href = detector ? detector.getDashboardUrl('user') : 'userdash.html';
                }
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

// Send Reset Email
function sendResetEmail() {
    const email = document.getElementById('forgotEmail').value.trim();

    if (!email) {
        showToast('Please enter your email address', 'error');
        return;
    }

    if (!validateEmail(email)) {
        showToast('Please enter a valid email address', 'error');
        return;
    }

    showToast('Password reset link sent to your email!', 'success');
    setTimeout(() => {
        showLogin();
    }, 2000);
}

// Email validation
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
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

// Set up form submission and enter key support
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', userLogin);
    }

    const passwordInput = document.getElementById('password');
    const emailInput = document.getElementById('email');

    if (passwordInput && !loginForm) { // Only if form listener not added
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') userLogin();
        });
    }
});

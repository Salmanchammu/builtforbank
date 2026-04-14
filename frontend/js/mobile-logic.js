/* ============================================================
   Smart Bank - Mobile Logic
   Unified logic for Mobile UI with UPI NPCI Sandbox
   ============================================================ */

'use strict';

/* ── Utility: String Masking ── */
function maskAcc(num) {
    if (!num) return 'N/A';
    const s = String(num);
    if (s.length < 5) return s;
    return s.substring(0, 2) + '*'.repeat(s.length - 6) + s.substring(s.length - 4);
}

function maskCard(num) {
    if (!num) return '**** **** **** 0000';
    const s = String(num).replace(/\s/g, '');
    return '**** **** **** ' + s.substring(s.length - 4);
}

// Ensure window.API is consistently set from the global config
window.API = window.SMART_BANK_API_BASE || window.API || '/api';
const API = window.API;

// Initial Hydration from Cache
(function hydrateProfile() {
    const cache = localStorage.getItem('bank_mobile_user_cache');
    if (!cache) return;
    try {
        const d = JSON.parse(cache);
        // We'll define a minimal helper here to update UI before full logic loads
        document.addEventListener('DOMContentLoaded', () => {
            const sideName = document.getElementById('sidebarName');
            const sideEmail = document.getElementById('sidebarEmail');
            const headerCont = document.getElementById('mobileHeaderAvatarContainer');
            
            if (sideName) sideName.textContent = d.name;
            if (sideEmail) sideEmail.textContent = d.email;
            if (headerCont) headerCont.style.display = 'block';
            
            // Note: Full avatar/initials logic will be handled by loadDashboardData soon,
            // but this makes the name/email stable immediately.
        });
    } catch(e) {}
})();

window.addEventListener('DOMContentLoaded', async () => {
    const page = window.location.pathname.split('/').pop();
    // // handlers_disabled(); // Disabled to prevent blank-screen issues on focus loss

    if (page === 'mobile-auth.html') {
        checkAndShowPasscodeLogin();
        // Silently ping the server so Render's free tier starts waking up
        // before the user finishes typing their credentials.
        fetch(`${window.API}/health`, { method: 'GET', credentials: 'include' }).catch(() => {});
    } else if (page === 'mobile-dash.html') {
        const ok = await checkAuth();
        if (!ok) {
            window.location.href = 'mobile-auth.html';
            return;
        }
        await loadDashboardData();
        // Start real time polling for notifications and balance
        setInterval(loadDashboardData, 15000);
    }
});

// Initialize card tab
window.currentCardTab = 'savings';

/* ── Authentication ── */
async function checkAuth() {
    try {
        const r = await fetch(`${API}/auth/check`, { credentials: 'include' });
        if (r.ok) {
            const d = await r.json();
            if (d.authenticated && d.user) {
                window.currentUser = d.user;
                return true;
            }
        }
    } catch (e) { console.error('Auth Check Failed', e); }
    return false;
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const role = 'user';
    const btn = e.target.querySelector('button');

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';

    // Render free-tier servers can take 30-60 s to cold-start.
    // We wait 55 s total and show a friendly message after 5 s.
    const TIMEOUT_MS = 55000;
    const WAKEUP_MSG_DELAY = 5000;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    // Show "waking up" hint after a short delay so users don't panic
    const wakeupHintId = setTimeout(() => {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Server waking up…';
    }, WAKEUP_MSG_DELAY);

    try {
        const deviceType = window.SmartBankDeviceDetector ? window.SmartBankDeviceDetector.getDeviceType() : 'mobile';
        console.log(`[Login] Attempting login for ${username} on ${deviceType}...`);
        
        const r = await fetch(`${API}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            signal: controller.signal,
            body: JSON.stringify({ username, password, role, device_type: deviceType })
        });
        
        clearTimeout(timeoutId);
        clearTimeout(wakeupHintId);
        console.log(`[Login] Status: ${r.status}`);
        
        const d = await r.json();
        if (r.ok && d.requires_2fa) {
             console.log('[Login] 2FA Required');
             document.getElementById('loginUsername').value = d.username;
             document.getElementById('loginRole').value = d.role;
             const modal = document.getElementById('loginOtpModal');
             if (modal) modal.style.display = 'flex';
             
             if (d.dev_otp) {
                 const otpInput = document.getElementById('loginEmailOtp');
                 if (otpInput) {
                     otpInput.value = d.dev_otp;
                     showMobileToast(`[DEV/RENDER MODE] OTP Auto-filled: ${d.dev_otp}`, 'success');
                 }
             } else {
                 showMobileToast('Verification code sent to your email.', 'info');
             }
             return;
        }

        if (r.ok) {
            console.log('[Login] Success! Redirecting...');
            btn.innerHTML = '<i class="fas fa-check"></i> Success!';
            _finalizeMobileLogin(d);
        } else {
            console.error('[Login] Failed:', d);
            showMobileToast(d.error || 'Login failed', 'error');
            if (d.unverified) {
                // Handle unverified
            }
        }
    } catch (err) {
        clearTimeout(timeoutId);
        clearTimeout(wakeupHintId);
        console.error('Login Error:', err);
        if (err.name === 'AbortError') {
            showMobileToast('Server took too long to respond. Please try again.', 'error');
        } else {
            showMobileToast('Server connection error. Please check your internet.', 'error');
        }
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Login Securely';
    }
}

async function handleMobileVerifyLogin(e) {
    if (e) e.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const role = document.getElementById('loginRole').value;
    const email_otp = document.getElementById('loginEmailOtp').value.trim();

    if (email_otp.length !== 6) return showMobileToast('Please enter the 6-digit verification code', 'warning');

    const btn = document.getElementById('loginVerifyBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';
    btn.disabled = true;

    try {
        const response = await fetch(`${API}/auth/verify-login`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, role, email_otp })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            const modal = document.getElementById('loginOtpModal');
            if (modal) modal.style.display = 'none';
            _finalizeMobileLogin(data);
        } else {
            showMobileToast(data.error || 'Verification failed.', 'error');
        }
    } catch (error) {
        console.error('Verify error:', error);
        showMobileToast('Connection to server failed.', 'error');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function _finalizeMobileLogin(d) {
    localStorage.setItem('bank_mobile_user_info', JSON.stringify({
        username: d.user.username,
        name: d.user.name,
        id: d.user.id,
        role: d.user.role
    }));
    // Cache for welcome back hydration
    localStorage.setItem('bank_mobile_user_cache', JSON.stringify({
        profile_image_url: d.profile_image_url || (d.user.profile_image ? `${API}/user/profile-image/${d.user.profile_image}` : null),
        name: d.user.name,
        email: d.user.email,
        username: d.user.username
    }));
    showMobileToast('Login successful!', 'success');
    setTimeout(() => { window.location.href = 'mobile-dash.html'; }, 1000);
}

function checkAndShowPasscodeLogin() {
    const userInfo = localStorage.getItem('bank_mobile_user_info');
    const passcode = localStorage.getItem('bank_mobile_passcode');
    const section = document.getElementById('passcodeLoginSection');

    if (userInfo && passcode && section) {
        const user = JSON.parse(userInfo);
        section.style.display = 'block';
        section.querySelector('.form-label').innerHTML = `Quick Passcode for <b>${escHtml(user.name)}</b>`;

        // Optionally hide regular form
        // document.getElementById('mobileLoginForm').style.display = 'none';
    }
}

async function handlePasscodeLogin() {
    const entered = document.getElementById('passcode').value;
    const userInfo = JSON.parse(localStorage.getItem('bank_mobile_user_info'));

    if (!userInfo || !userInfo.username) return showMobileToast('No user info found. Please login normally once.', 'error');

    const btn = document.querySelector('#passcodeLoginSection button');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';

    try {
        const r = await fetch(`${API}/auth/mobile/login-passcode`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                username: userInfo.username,
                passcode: entered,
                role: 'user'
            })
        });
        const d = await r.json();
        if (r.ok) {
            window.location.href = 'mobile-dash.html';
        } else {
            showMobileToast(d.error || 'Incorrect Passcode', 'error');
        }
    } catch (e) {
        showMobileToast('Server connection error. Please try regular login.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Login with Passcode';
    }
}

async function logout() {
    // Premium logout confirmation modal
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content" style="text-align:center; padding: 30px 24px; border-radius: 24px;">
            <div style="width:60px;height:60px;border-radius:50%;background:var(--primary-light);color:var(--primary-maroon);display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:24px;box-shadow: 0 4px 12px rgba(74, 0, 0, 0.1);">
                <i class="fas fa-power-off"></i>
            </div>
            <h3 style="margin:0 0 10px;font-size:20px;font-weight:800;color:var(--text-dark);">Sign Out?</h3>
            <p style="margin:0 0 25px;font-size:14px;color:var(--text-grey);line-height:1.5;">Are you sure you want to sign out of your SmartBank session?</p>
            <div style="display:flex;gap:12px;">
                <button id="_logoutCancel" style="flex:1;padding:14px;border-radius:16px;border:1px solid var(--border-color);background:#fff;font-size:14px;font-weight:600;color:var(--text-grey);cursor:pointer;">Cancel</button>
                <button id="_logoutOk" style="flex:1;padding:14px;border-radius:16px;border:none;background:var(--primary-maroon);font-size:14px;font-weight:700;color:#fff;cursor:pointer;box-shadow: 0 4px 12px rgba(74, 0, 0, 0.2);">Sign Out</button>
            </div>
        </div>`;
    const wrapper = document.querySelector('.mobile-wrapper') || document.body;
    wrapper.appendChild(modal);
    document.getElementById('_logoutCancel').onclick = () => modal.remove();
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.getElementById('_logoutOk').onclick = async () => {
        modal.remove();
        try { await fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' }); } catch { }
        sessionStorage.clear();
        // Clear sensitive session data, but preserve device-linked settings like passcode and user_info
        localStorage.removeItem('hideBalance');
        window._dashboardData = null;
        window._accounts = [];
        window.location.href = 'mobile-auth.html';
    };
}

/* ── Dashboard Data ── */
async function loadDashboardData() {
    try {
        const r = await fetch(`${API}/user/dashboard?t=${Date.now()}`, { credentials: 'include' });
        if (r.ok) {
            const d = await r.json();
            window._accounts = d.accounts || [];
            window._accountRequests = d.account_requests || [];

            // Handle Zero Account State
            const existingBanner = document.getElementById('zeroAccountBannerMobile');
            if (existingBanner) existingBanner.remove();

            const dashContent = document.getElementById('dashboardPage');
            if (window._accounts.length === 0) {
                if (window._accountRequests && window._accountRequests.length > 0) {
                    // Application in progress - handled by updateDashboardCard
                } else {
                    if (dashContent) {
                        const bannerHTML = `
                            <div id="zeroAccountBannerMobile" class="placeholder-card" style="margin-top: 20px;">
                                <div class="placeholder-icon">
                                    <i class="fas fa-university"></i>
                                </div>
                                <h3 class="placeholder-title">Welcome to SmartBank</h3>
                                <p class="placeholder-desc">Experience premium digital banking. Open your first account in minutes with instant KYC.</p>
                                <button class="placeholder-btn" onclick="showAccountModal()">Open Account</button>
                            </div>
                        `;
                        const welcomeSection = dashContent.querySelector('.welcome-section');
                        if (welcomeSection) {
                            welcomeSection.insertAdjacentHTML('afterbegin', bannerHTML);
                        }
                    }
                }
            }

            if (d.accounts && d.accounts.length > 0) {
                window._primaryAccount = d.accounts[0];
            } else {
                window._primaryAccount = null;
            }
            window._notifications = d.notifications || [];
            if (typeof updateMobileNotifBadge === 'function') updateMobileNotifBadge();
            if (typeof renderProfile === 'function') renderProfile(d.user, d.profile_image_url);
            if (typeof renderDashboard === 'function') renderDashboard(d);

            // Update mobile header/sidebar avatars
            const user = d.user || {};
            window.currentUser = user;
            const profileUrl = d.profile_image_url;
            
            // Cache for permanence
            try {
                localStorage.setItem('bank_mobile_user_cache', JSON.stringify({
                    profile_image_url: profileUrl,
                    name: user.name || user.username,
                    email: user.email,
                    username: user.username
                }));
            } catch(e) {}
            
            const updateAv = (imgId, initId) => {
                const img = document.getElementById(imgId);
                const init = document.getElementById(initId);
                const profileImg = window.currentUser ? window.currentUser.profile_image : null;
                const name = (window.currentUser ? window.currentUser.name : 'User') || 'User';

                if (profileImg) {
                    if (img) {
                        img.src = `${API}/user/profile-image/${profileImg}`;
                        img.style.display = 'block';
                    }
                    if (init) init.style.display = 'none';
                } else {
                    if (img) img.style.display = 'none';
                    if (init) {
                        const parts = name.trim().split(/\s+/);
                        let text = name.substring(0, 2).toUpperCase();
                        if (parts.length >= 2 && parts[0][0] && parts[parts.length - 1][0]) {
                            text = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
                        } else if (name.length > 0) {
                            text = name.substring(0, 2).toUpperCase();
                        }
                        init.textContent = text;
                        init.style.display = 'flex';
                        
                        // Consistency check: unique avatar color based on name
                        const colors = ['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f97316'];
                        let charCodeSum = 0;
                        for (let i = 0; i < name.length; i++) charCodeSum += name.charCodeAt(i);
                        init.style.background = colors[charCodeSum % colors.length];
                        init.style.color = '#fff';
                    }
                }
            };

            // Update Header
            updateAv('mobileHeaderAvatar', 'mobileHeaderInitials');
            const logo = document.getElementById('mobileLogo');
            if (logo) logo.style.display = 'none';

            // Update Sidebar
            updateAv('mobileSidebarAvatar', 'mobileSidebarInitials');
            const sideName = document.getElementById('sidebarName');
            if (sideName) sideName.textContent = user.name || user.username;
            const sideEmail = document.getElementById('sidebarEmail');
            if (sideEmail) sideEmail.textContent = user.email;

            await checkUpiStatus();
            if (typeof injectAccountModal === 'function') injectAccountModal();
            if (typeof injectMutualFundModal === 'function') injectMutualFundModal();
            if (typeof injectLifeInsuranceModal === 'function') injectLifeInsuranceModal();
            if (typeof injectGoldLoanModal === 'function') injectGoldLoanModal();
            if (typeof injectFixedDepositModal === 'function') injectFixedDepositModal();
            
            // Fix: Ensure balance display is updated after data load
            updateBalanceDisplay();
        }
    } catch (e) { console.error('Load Dashboard Failed', e); }
}

/* ── Mobile Navigation ── */
function switchTab(tabId) {
    console.log(`[Nav] Switching to tab: ${tabId}`);
    
    const pages = document.querySelectorAll('.page-content');
    pages.forEach(p => {
        p.style.display = 'none';
        p.classList.remove('active');
    });

    const target = document.getElementById(`${tabId}Page`) || document.getElementById(tabId);
    if (target) {
        target.style.display = 'block';
        setTimeout(() => target.classList.add('active'), 10);
    }

    // Update Nav Active State (Bottom Nav and Sidebar)
    const navItems = document.querySelectorAll('.nav-item-modern, .sidebar-link, .nav-item');
    navItems.forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-tab') === tabId || (item.getAttribute('onclick') && item.getAttribute('onclick').includes(`'${tabId}'`))) {
            item.classList.add('active');
        }
    });

    // Handle special page initializations
    if (tabId === 'history' && typeof loadMobileTransactions === 'function') {
        loadMobileTransactions();
    }
    if (tabId === 'cropMarketplace' && typeof loadMobileCropListings === 'function') {
        loadMobileCropListings();
    }
    if (tabId === 'locations' || tabId === 'locationsPage') {
        if (typeof initMobileLocator === 'function') initMobileLocator();
        // Give time for layout to settle then resize
        setTimeout(() => { if(mobileLocatorMapInstance) mobileLocatorMapInstance.resize(); }, 300);
    }

    // Close mobile menu if open
    closeMobileMenu();
    
    // Scroll to top
    const wrapper = document.querySelector('.mobile-wrapper');
    if (wrapper) wrapper.scrollTop = 0;
}

function openMobileMenu() {
    const sidebar = document.getElementById('mobileSidebar');
    const overlay = document.getElementById('mobileSidebarOverlay');
    if (sidebar) sidebar.classList.add('active');
    if (overlay) overlay.classList.add('active');
}

function closeMobileMenu() {
    const sidebar = document.getElementById('mobileSidebar');
    const overlay = document.getElementById('mobileSidebarOverlay');
    if (sidebar) sidebar.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
}

async function loadMobileTransactions() {
    const list = document.getElementById('mobileTransactionList');
    if (!list) return;
    
    try {
        const r = await fetch(`${API}/user/transactions`, { credentials: 'include' });
        if (r.ok) {
            const d = await r.json();
            if (d.transactions && d.transactions.length > 0) {
                list.innerHTML = d.transactions.map(t => `
                    <div class="transaction-item-modern" style="padding: 16px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="width: 40px; height: 40px; border-radius: 12px; background: ${t.type === 'credit' ? '#ecfdf5' : '#fef2f2'}; color: ${t.type === 'credit' ? '#059669' : '#ef4444'}; display: flex; align-items: center; justify-content: center; font-size: 18px;">
                                <i class="fas ${t.type === 'credit' ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
                            </div>
                            <div>
                                <div style="font-weight: 700; color: #1e293b; font-size: 14px;">${escHtml(t.description || 'Transaction')}</div>
                                <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">${new Date(t.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-weight: 800; color: ${t.type === 'credit' ? '#059669' : '#1e293b'}; font-size: 15px;">${t.type === 'credit' ? '+' : '-'}₹${(t.amount || 0).toLocaleString('en-IN')}</div>
                            <div style="font-size: 10px; color: #94a3b8; font-weight: 600;">${escHtml(t.status || 'Completed').toUpperCase()}</div>
                        </div>
                    </div>
                `).join('');
            } else {
                list.innerHTML = `
                    <div style="text-align: center; padding: 60px 20px;">
                        <div style="width: 64px; height: 64px; background: #f8fafc; border-radius: 20px; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; color: #cbd5e1; font-size: 24px;">
                            <i class="fas fa-list-ul"></i>
                        </div>
                        <h4 style="margin: 0 0 8px; color: #1e293b;">No Transactions</h4>
                        <p style="margin: 0; color: #94a3b8; font-size: 13px;">Your recent activity will appear here once you start banking.</p>
                    </div>
                `;
            }
        }
    } catch (e) {
        console.error('Failed to load mobile transactions', e);
        list.innerHTML = '<div style="text-align:center; padding:20px; color:#ef4444;">Failed to load transactions</div>';
    }
}

function logMobileActivity(msg) {
    console.log(`[Activity] ${msg}`);
    // Optional: Send to backend audit log
}

function openQrScanner() {
    console.log('[QR] Opening scanner...');
    // Implementation for QR scanner if needed
    showMobileToast('QR Scanner initializing...', 'info');
}

function injectAccountModal() {
    if (document.getElementById('mobileAccountModal')) return;
    const modalHTML = `
    <div id="mobileAccountModal" class="modal-overlay">
        <div class="modal-content">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                <h3 style="margin:0;color:var(--text-dark);font-size:18px;">Open New Account</h3>
                <button onclick="closeAccountModal()" style="background:none;border:none;font-size:24px;color:var(--text-grey);">&times;</button>
            </div>
            <p style="color:var(--text-grey);font-size:14px;margin-bottom:20px;">Choose an account type to open.</p>
            <div class="modal-form-group">
                <label>Account Type</label>
                <select id="mobileAccountType" class="modal-select" onchange="document.getElementById('mobileAgriKycExtra').style.display = this.value === 'Agriculture' ? 'block' : 'none';">
                    <option value="Savings">Savings Account</option>
                    <option value="Current">Current Account</option>
                    <option value="Salary">Salary Account</option>
                    <option value="Agriculture">Agriculture Account</option>
                </select>
            </div>
            <div class="modal-form-group">
                <label>Aadhaar Number (12 Digits)</label>
                <input type="text" id="mobileKycAadhaar" class="modal-input" placeholder="1234 5678 9012" maxlength="14">
            </div>
            <div class="modal-form-group">
                <label>PAN Number</label>
                <input type="text" id="mobileKycPan" class="modal-input" placeholder="ABCDE1234F" maxlength="10" style="text-transform:uppercase;">
            </div>
            <div class="modal-form-group">
                <label>Aadhaar Card Proof (Front)</label>
                <input type="file" id="mobileKycAadhaarProof" class="modal-input" accept="image/*,.pdf">
            </div>
            <div class="modal-form-group">
                <label>PAN Card Proof (Front)</label>
                <input type="file" id="mobileKycPanProof" class="modal-input" accept="image/*,.pdf">
            </div>
            <div id="mobileAgriKycExtra" style="display:none;margin-top:10px;">
                <p style="color:var(--text-grey);font-size:13px;border-top:1px solid #eaeaea;padding-top:16px;">Agriculture Account Details</p>
                <div class="modal-form-group">
                    <label>Farm Address / Survey No.</label>
                    <input type="text" id="mobileKycFarmAddress" class="modal-input" placeholder="Village Name, Survey Number">
                </div>
                <div class="modal-form-group">
                    <label>Agriculture Land Proof (Title Deed / RTC)</label>
                    <input type="file" id="mobileKycAgriProof" class="modal-input" accept="image/*,.pdf">
                </div>
            </div>
            <div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:12px;margin-bottom:24px;border-radius:8px;font-size:13px;color:#1e40af;">
                <i class="fas fa-camera" style="margin-right:8px;"></i> Face verification starts on submit.
            </div>
            <button id="btnMobileSubmitAccount" class="modal-btn-submit" onclick="submitNewAccount()">Verify & Create Account</button>
        </div>
    </div>`;
    const wrapper = document.querySelector('.mobile-wrapper') || document.body;
    wrapper.insertAdjacentHTML('beforeend', modalHTML);
}

function getMobileLocation() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            return resolve(null);
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                resolve({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude
                });
            },
            (err) => {
                console.warn('Geolocation error:', err);
                resolve(null);
            },
            { timeout: 5000 }
        );
    });
}

function showAccountModal() {
    const dropdown = document.getElementById('mobileAccountType');
    if (dropdown) {
        const owned = (window._accounts || []).map(a => a.account_type.toLowerCase());
        const pending = (window._accountRequests || []).map(r => r.account_type.toLowerCase());
        Array.from(dropdown.options).forEach(opt => {
            const val = opt.value.toLowerCase();
            if (owned.includes(val)) {
                opt.disabled = true;
                opt.text = `${opt.value} (Already Owned)`;
            } else if (pending.includes(val)) {
                opt.disabled = true;
                opt.text = `${opt.value} (Pending Review)`;
            } else {
                opt.disabled = false;
                opt.text = `${opt.value} Account`;
            }
        });
        const firstAvail = Array.from(dropdown.options).find(o => !o.disabled);
        if (firstAvail) dropdown.value = firstAvail.value;
    }
    const modal = document.getElementById('mobileAccountModal');
    if (modal) modal.style.display = 'flex';
}

function closeAccountModal() {
    const modal = document.getElementById('mobileAccountModal');
    if (modal) modal.style.display = 'none';
}

function injectMutualFundModal() {
    if (document.getElementById('mobileMfModal')) return;
    const modalHTML = `
    <div id="mobileMfModal" class="modal-overlay">
        <div class="modal-content">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                <h3 style="margin:0;color:#1a1a1a;font-size:18px;font-weight:700;">Invest in Mutual Funds</h3>
                <button onclick="closeMutualFundModal()" style="background:none;border:none;font-size:26px;color:#888;cursor:pointer;line-height:1;">&times;</button>
            </div>
            <p style="color:#666;font-size:14px;margin-bottom:18px;">Select a top-performing Mutual Fund.</p>
            <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:20px;">
                <div class="investment-card"><div><h4>Alpha Growth Fund</h4><p>Min Inv: ₹5,000</p></div><div style="text-align:right;"><span class="returns">+18% p.a.</span><button class="modal-btn-submit" style="margin-top:10px;padding:10px;" onclick="showApplicationModal('Alpha Growth Fund')">Invest</button></div></div>
                <div class="investment-card"><div><h4>Smart Wealth Builder</h4><p>Min Inv: ₹2,000</p></div><div style="text-align:right;"><span class="returns">+18% p.a.</span><button class="modal-btn-submit" style="margin-top:10px;padding:10px;" onclick="showApplicationModal('Smart Wealth Builder')">Invest</button></div></div>
                <div class="investment-card"><div><h4>Secure Future Flexi-Cap</h4><p>Min Inv: ₹5,000</p></div><div style="text-align:right;"><span class="returns">+18% p.a.</span><button class="modal-btn-submit" style="margin-top:10px;padding:10px;" onclick="showApplicationModal('Secure Future Flexi-Cap')">Invest</button></div></div>
            </div>
        </div>
    </div>`;
    const wrapper = document.querySelector('.mobile-wrapper') || document.body;
    wrapper.insertAdjacentHTML('beforeend', modalHTML);
    const el = document.getElementById('mobileMfModal');
    el.addEventListener('click', e => { if (e.target === el) closeMutualFundModal(); });
}

function showMutualFundModal() {
    console.log('Opening Mutual Fund Modal');
    injectMutualFundModal();
    const modal = document.getElementById('mobileMfModal');
    if (modal) { modal.style.display = 'flex'; }
}

function closeMutualFundModal() {
    const modal = document.getElementById('mobileMfModal');
    if (modal) modal.style.display = 'none';
}

function injectLifeInsuranceModal() {
    if (document.getElementById('mobileInsuranceModal')) return;
    const modalHTML = `
    <div id="mobileInsuranceModal" class="modal-overlay">
        <div class="modal-content" style="overflow-y:auto;max-height:80vh;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                <h3 style="margin:0;color:#1a1a1a;font-size:18px;font-weight:700;">Life Insurance</h3>
                <button onclick="closeLifeInsuranceModal()" style="background:none;border:none;font-size:26px;color:#888;cursor:pointer;line-height:1;">&times;</button>
            </div>
            <p style="color:#666;font-size:14px;margin-bottom:18px;">Secure your family's future.</p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
                <div style="border:1px solid #ffe0e0;border-radius:12px;padding:16px;text-align:center;"><i class="fas fa-shield-alt" style="font-size:24px;color:#800000;margin-bottom:10px;"></i><h4 style="margin:0 0 5px;font-size:14px;">Term Protect</h4><p style="font-size:12px;color:#666;margin-bottom:12px;">High cover at low premiums.</p><button class="modal-btn-submit" style="padding:10px;font-size:14px;" onclick="showApplicationModal('Term Protect')">Apply</button></div>
                <div style="border:1px solid #ffe0e0;border-radius:12px;padding:16px;text-align:center;"><i class="fas fa-heartbeat" style="font-size:24px;color:#800000;margin-bottom:10px;"></i><h4 style="margin:0 0 5px;font-size:14px;">Health Plus</h4><p style="font-size:12px;color:#666;margin-bottom:12px;">Comprehensive medical cover.</p><button class="modal-btn-submit" style="padding:10px;font-size:14px;" onclick="showApplicationModal('Health Plus')">Apply</button></div>
                <div style="border:1px solid #ffe0e0;border-radius:12px;padding:16px;text-align:center;"><i class="fas fa-child" style="font-size:24px;color:#800000;margin-bottom:10px;"></i><h4 style="margin:0 0 5px;font-size:14px;">Child Saver</h4><p style="font-size:12px;color:#666;margin-bottom:12px;">Secure their education.</p><button class="modal-btn-submit" style="padding:10px;font-size:14px;" onclick="showApplicationModal('Child Saver')">Apply</button></div>
                <div style="border:1px solid #ffe0e0;border-radius:12px;padding:16px;text-align:center;"><i class="fas fa-user-clock" style="font-size:24px;color:#800000;margin-bottom:10px;"></i><h4 style="margin:0 0 5px;font-size:14px;">Retire Easy</h4><p style="font-size:12px;color:#666;margin-bottom:12px;">Guaranteed pension plan.</p><button class="modal-btn-submit" style="padding:10px;font-size:14px;" onclick="showApplicationModal('Retire Easy')">Apply</button></div>
            </div>
        </div>
    </div>`;
    const wrapper = document.querySelector('.mobile-wrapper') || document.body;
    wrapper.insertAdjacentHTML('beforeend', modalHTML);
    const el = document.getElementById('mobileInsuranceModal');
    el.addEventListener('click', e => { if (e.target === el) closeLifeInsuranceModal(); });
}

function showApplicationModal(productName) {
    // Prevent overlapping dark blur backgrounds
    if (typeof closeMutualFundModal === 'function') closeMutualFundModal();
    if (typeof closeLifeInsuranceModal === 'function') closeLifeInsuranceModal();
    if (typeof closeGoldLoanModal === 'function') closeGoldLoanModal();
    if (typeof closeFixedDepositModal === 'function') closeFixedDepositModal();

    const existing = document.getElementById('mobileApplicationModal');
    if (existing) existing.remove();

    const modalHTML = `
    <div id="mobileApplicationModal" class="modal-overlay">
    <div class="modal-content">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
            <h3 style="margin:0;color:var(--text-dark);font-size:18px;">Application Form</h3>
            <button onclick="closeApplicationModal()" style="background:none;border:none;font-size:24px;color:var(--text-grey);">&times;</button>
        </div>
        <p style="color:var(--text-grey);font-size:14px;margin-bottom:20px;">Complete your application for <strong id="applicationProductName" style="color:var(--primary-maroon);"></strong>.</p>
        <div class="modal-form-group">
            <label>Select Linked Account</label>
            <select id="mobileAppAccount" class="modal-select">
                ${(window._accounts || []).map(acc => `<option value="${acc.account_number}">${acc.account_type} - ${acc.account_number} (₹${(acc.balance || 0).toLocaleString('en-IN')})</option>`).join('') || '<option value="">No Active Accounts Available</option>'}
            </select>
        </div>
        <div class="modal-form-group">
            <label>Initial Amount (₹)</label>
            <input type="number" id="mobileAppAmount" class="modal-input" placeholder="Enter amount">
        </div>
        <div class="modal-form-group">
            <label>Aadhaar Number (12 Digits)</label>
            <input type="text" id="mobileAppAadhaar" class="modal-input" placeholder="1234 5678 9012" maxlength="14" style="letter-spacing:1px;">
        </div>
        <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:12px;margin-bottom:24px;border-radius:8px;font-size:13px;color:#991b1b;">
            By clicking submit, you authorize Smart Bank to process this application and deduct the initial amount from your selected account.
        </div>
        <button id="btnMobileSubmitApp" class="modal-btn-submit" onclick="submitApplication()">Submit Application</button>
    </div>
</div>`;
    const wrapper = document.querySelector('.mobile-wrapper') || document.body;
    wrapper.insertAdjacentHTML('beforeend', modalHTML);

    document.getElementById('applicationProductName').textContent = productName;
    document.getElementById('mobileApplicationModal').style.display = 'flex';
}

function closeApplicationModal() {
    const modal = document.getElementById('mobileApplicationModal');
    if (modal) modal.style.display = 'none';
}

async function submitApplication() {
    const productName = document.getElementById('applicationProductName').textContent;
    const accountNum = document.getElementById('mobileAppAccount').value;
    const amount = document.getElementById('mobileAppAmount').value;
    const aadhaar = document.getElementById('mobileAppAadhaar').value;
    const btn = document.getElementById('btnMobileSubmitApp');

    if (!accountNum) return showMobileToast('Please select a source account', 'error');
    if (!amount || amount <= 0) return showMobileToast('Please enter a valid amount', 'error');
    if (!aadhaar || aadhaar.length < 12) return showMobileToast('Please enter a valid Aadhaar number', 'error');

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

    try {
        const res = await fetch(`${API}/mobile/apply-investment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                product_name: productName,
                account_number: accountNum,
                amount: amount,
                aadhaar_number: aadhaar
            })
        });
        const data = await res.json();

        if (res.ok) {
            closeApplicationModal();
            if (typeof closeMutualFundModal === 'function') closeMutualFundModal();
            if (typeof closeLifeInsuranceModal === 'function') closeLifeInsuranceModal();
            if (typeof closeGoldLoanModal === 'function') closeGoldLoanModal();
            if (typeof closeFixedDepositModal === 'function') closeFixedDepositModal();

            // Success Screen
            const pageContent = document.querySelector('.page-content.active') || document.getElementById('dashboardPage');
            const originalHTML = pageContent.innerHTML;

            pageContent.innerHTML = `
                <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:70vh;text-align:center;padding:40px 20px;animation:fadeIn 0.5s ease;">
                    <div style="width:80px;height:80px;background:#10b981;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-bottom:24px;box-shadow:0 10px 25px rgba(16,185,129,0.3);">
                        <i class="fas fa-check" style="font-size:40px;color:white;"></i>
                    </div>
                    <h2 style="margin:0 0 16px;color:#1a1a1a;font-size:24px;">Application Submitted!</h2>
                    <p style="color:#666666;font-size:15px;margin:0 0 32px;line-height:1.6;">${escHtml(data.message || 'Your application has been received and is currently under review.')}<br>Reference: <strong style="color:#1a1a1a;">${escHtml(data.reference || '#REF')}</strong></p>
                    <button onclick="window.location.reload()" style="padding:16px 32px;background:#8b0000;color:#fff;border:none;border-radius:16px;font-size:16px;font-weight:600;width:100%;">Return to Dashboard</button>
                </div>
            `;

            // Clean up inputs
            document.getElementById('mobileAppAmount').value = '';
            document.getElementById('mobileAppAadhaar').value = '';

            // Refresh data in background
            loadDashboardData();
        } else {
            showMobileToast(data.error || 'Failed to submit application', 'error');
        }
    } catch (e) {
        showMobileToast('Connection error. Please check your internet.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Submit Application';
    }
}

function showLifeInsuranceModal() {
    console.log('Opening Life Insurance Modal');
    injectLifeInsuranceModal();
    const modal = document.getElementById('mobileInsuranceModal');
    if (modal) modal.style.display = 'flex';
}

function closeLifeInsuranceModal() {
    const modal = document.getElementById('mobileInsuranceModal');
    if (modal) modal.style.display = 'none';
}

function injectHouseLoanModal() {
    if (document.getElementById('mobileHouseLoanModal')) return;
    const modalHTML = `
    <div id="mobileHouseLoanModal" class="modal-overlay">
        <div class="modal-content">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                <h3 style="margin:0;color:#1a1a1a;font-size:18px;font-weight:700;">House Loan</h3>
                <button onclick="closeHouseLoanModal()" style="background:none;border:none;font-size:26px;color:#888;cursor:pointer;line-height:1;">&times;</button>
            </div>
            <p style="color:#666;font-size:14px;margin-bottom:18px;">Build your dream home with our competitive house loan rates.</p>
            <div style="background:#f8f9fb;border:1px solid #e0eeff;border-radius:12px;padding:16px;display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                <div style="display:flex;align-items:center;gap:12px;"><i class="fas fa-home" style="font-size:24px;color:var(--primary-maroon);"></i><div><h4 style="margin:0 0 4px;">Premium Home Loan</h4><p style="margin:0;font-size:13px;color:#666;">8.5% p.a. • Flexible Tenures</p></div></div>
                <button class="modal-btn-submit" style="padding:10px 20px;font-size:14px;" onclick="closeHouseLoanModal(); showApplicationModal('House Loan')">Apply</button>
            </div>
        </div>
    </div>`;
    const wrapper = document.querySelector('.mobile-wrapper') || document.body;
    wrapper.insertAdjacentHTML('beforeend', modalHTML);
    const el = document.getElementById('mobileHouseLoanModal');
    el.addEventListener('click', e => { if (e.target === el) closeHouseLoanModal(); });
}

function injectGoldLoanModal() {
    if (document.getElementById('mobileGoldLoanModal')) return;
    const modalHTML = `
    <div id="mobileGoldLoanModal" class="modal-overlay">
        <div class="modal-content">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                <h3 style="margin:0;color:#1a1a1a;font-size:18px;font-weight:700;">Gold Loan</h3>
                <button onclick="closeGoldLoanModal()" style="background:none;border:none;font-size:26px;color:#888;cursor:pointer;line-height:1;">&times;</button>
            </div>
            <p style="color:#666;font-size:14px;margin-bottom:18px;">Unlock the value of your gold with our instant gold loans.</p>
            <div style="background:#f8f9fb;border:1px solid #ffe0e0;border-radius:12px;padding:16px;display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                <div style="display:flex;align-items:center;gap:12px;"><i class="fas fa-coins" style="font-size:24px;color:#800000;"></i><div><h4 style="margin:0 0 4px;">Instant Gold Loan</h4><p style="margin:0;font-size:13px;color:#666;">8% p.a. • Minimal Documentation</p></div></div>
                <button class="modal-btn-submit" style="padding:10px 20px;font-size:14px;" onclick="showApplicationModal('Instant Gold Loan')">Apply Now</button>
            </div>
        </div>
    </div>`;
    const wrapper = document.querySelector('.mobile-wrapper') || document.body;
    wrapper.insertAdjacentHTML('beforeend', modalHTML);
    const el = document.getElementById('mobileGoldLoanModal');
    el.addEventListener('click', e => { if (e.target === el) closeGoldLoanModal(); });
}

function injectFixedDepositModal() {
    if (document.getElementById('mobileFdModal')) return;
    const modalHTML = `
    <div id="mobileFdModal" class="modal-overlay">
        <div class="modal-content">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                <h3 style="margin:0;color:#1a1a1a;font-size:18px;font-weight:700;">Fixed Deposit</h3>
                <button onclick="closeFixedDepositModal()" style="background:none;border:none;font-size:26px;color:#888;cursor:pointer;line-height:1;">&times;</button>
            </div>
            <p style="color:#666;font-size:14px;margin-bottom:18px;">Secure returns with our high-interest FDs.</p>
            <div style="background:#f8f9fb;border:1px solid #ffe0e0;border-radius:12px;padding:16px;display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                <div><h4 style="margin:0 0 4px;">Regular Fixed Deposit</h4><p style="margin:0;font-size:13px;color:#666;">Min Inv: ₹10,000</p></div>
                <div style="text-align:right;"><span style="display:block;font-weight:700;color:#16a34a;margin-bottom:8px;">+7.5% p.a.</span><button class="modal-btn-submit" style="padding:10px;" onclick="showApplicationModal('Fixed Deposit')">Apply</button></div>
            </div>
        </div>
    </div>`;
    const wrapper = document.querySelector('.mobile-wrapper') || document.body;
    wrapper.insertAdjacentHTML('beforeend', modalHTML);
    const el = document.getElementById('mobileFdModal');
    el.addEventListener('click', e => { if (e.target === el) closeFixedDepositModal(); });
}

function showApplyFD() {
    console.log('Opening FD Modal');
    injectFixedDepositModal();
    const modal = document.getElementById('mobileFdModal');
    if (modal) modal.style.display = 'flex';
}

function closeFixedDepositModal() {
    const modal = document.getElementById('mobileFdModal');
    if (modal) modal.style.display = 'none';
}

function showGoldLoanModal() {
    console.log('Opening Gold Loan Modal');
    injectGoldLoanModal();
    const modal = document.getElementById('mobileGoldLoanModal');
    if (modal) modal.style.display = 'flex';
}

function closeGoldLoanModal() {
    const modal = document.getElementById('mobileGoldLoanModal');
    if (modal) modal.style.display = 'none';
}

function showHouseLoanModal() {
    console.log('Opening House Loan Modal');
    injectHouseLoanModal();
    const modal = document.getElementById('mobileHouseLoanModal');
    if (modal) modal.style.display = 'flex';
}

function closeHouseLoanModal() {
    const modal = document.getElementById('mobileHouseLoanModal');
    if (modal) modal.style.display = 'none';
}

async function submitNewAccount() {
    const type = document.getElementById('mobileAccountType').value;
    const aadhaar = document.getElementById('mobileKycAadhaar').value.replace(/\s+/g, '');
    const pan = document.getElementById('mobileKycPan').value.toUpperCase().replace(/\s+/g, '');
    const btn = document.getElementById('btnMobileSubmitAccount');

    if (aadhaar.length !== 12 || !/^\d+$/.test(aadhaar)) {
        return showMobileToast('Please enter a valid 12-digit Aadhaar Number', 'error');
    }
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panRegex.test(pan)) {
        return showMobileToast('Please enter a valid PAN (e.g. ABCDE1234F)', 'error');
    }

    const aadhaarFile = document.getElementById('mobileKycAadhaarProof').files[0];
    const panFile = document.getElementById('mobileKycPanProof').files[0];

    if (!aadhaarFile || !panFile) {
        return showMobileToast('Please upload both Aadhaar and PAN proofs', 'error');
    }

    const toBase64 = file => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });

    btn.disabled = true;
    btn.innerHTML = 'Submitting...';

    try {
        const aadhaarProof = await toBase64(aadhaarFile);
        const panProof = await toBase64(panFile);
        
        // Capture Geolocation
        const location = await getMobileLocation();

        if (!window.faceAuthManager) throw new Error('Face Auth Manager not loaded');
        const kycData = await window.faceAuthManager.captureFaceForKYC();
        if (!kycData || !kycData.descriptor) throw new Error('Face verification failed');

        const payload = {
            account_type: type,
            aadhaar_number: aadhaar,
            pan_number: pan,
            face_descriptor: kycData.descriptor,
            kyc_photo: kycData.photo,
            kyc_video: kycData.video,
            aadhaar_proof: aadhaarProof,
            pan_proof: panProof,
            lat: location ? location.lat : null,
            lng: location ? location.lng : null
        };

        if (type === 'Agriculture') {
            const agriAddress = document.getElementById('mobileKycFarmAddress').value.trim();
            const agriProofFile = document.getElementById('mobileKycAgriProof').files[0];
            if (!agriAddress || !agriProofFile) {
                btn.disabled = false;
                btn.innerHTML = 'Verify & Create Account';
                return showMobileToast('Farm Address and Agriculture Land Proof are required', 'error');
            }
            try {
                const agriProof = await toBase64(agriProofFile);
                payload.agri_address = agriAddress;
                payload.agri_proof = agriProof;
            } catch (e) {
                btn.disabled = false;
                btn.innerHTML = 'Verify & Create Account';
                return showMobileToast('Failed to process Agriculture Proof', 'error');
            }
        }

        const res = await fetch(`${API}/user/accounts`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
            showMobileToast(data.message || 'Account request submitted successfully ✅', 'success');
            closeAccountModal();
            document.getElementById('mobileKycAadhaar').value = '';
            document.getElementById('mobileKycPan').value = '';
            loadDashboardData();
        } else {
            showMobileToast(data.error || 'Failed to submit request', 'error');
        }
    } catch (e) {
        showMobileToast(e.message || 'Failed during KYC verification', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Verify & Create Account';
    }
}

function renderProfile(user, profileImageUrl) {
    if (!user) return;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('profCustId', user.username || 'N/A');
    set('profPhone', user.phone || 'N/A');
    set('profEmail', user.email || 'N/A');
    set('profDob', user.date_of_birth || 'N/A');
    set('cardHolder', (user.name || user.username || 'USER').toUpperCase());

    // KYC Status Badge
    const kycBadge = document.getElementById('kycStatusBadge');
    if (kycBadge) {
        // Assume verified if user has an active account
        if (window._accounts && window._accounts.length > 0) {
            kycBadge.style.display = 'inline-block';
        } else {
            kycBadge.style.display = 'none';
        }
    }

    const lastLoginEl = document.getElementById('lastLogin');
    if (lastLoginEl) {
        let lastLoginText = 'Just Now';
        if (window._dashboardData && window._dashboardData.last_login) {
            try {
                const d = new Date(window._dashboardData.last_login);
                const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                lastLoginText = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
            } catch(e) { lastLoginText = window._dashboardData.last_login; }
        }
        lastLoginEl.textContent = `Last Login: ${lastLoginText}`;
    }

    // Render Account Details for Profile
    const accountsList = document.getElementById('profileAccountsList');
    if (accountsList) {
        if (!window._accounts || window._accounts.length === 0) {
            accountsList.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-grey);font-size:14px;">No active accounts found</div>';
        } else {
            accountsList.innerHTML = window._accounts.map(acc => `
                <div class="profile-account-card">
                    <span class="account-type-badge">${escHtml(acc.account_type)} Account</span>
                    
                    <div class="detail-row">
                        <div class="detail-info">
                            <span class="detail-label">Account Number</span>
                            <span class="detail-value">${maskAcc(acc.account_number)}</span>
                        </div>
                        <button class="copy-btn" onclick="copyText('${escHtml(acc.account_number)}', 'Account Number')" title="Copy Account Number">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>

                    <div class="detail-row">
                        <div class="detail-info">
                            <span class="detail-label">IFSC Code</span>
                            <span class="detail-value">${escHtml(acc.ifsc || acc.ifsc_code || 'SMTB0000001')}</span>
                        </div>
                        <button class="copy-btn" onclick="copyText('${escHtml(acc.ifsc || acc.ifsc_code || 'SMTB0000001')}', 'IFSC Code')" title="Copy IFSC Code">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                </div>
            `).join('');
        }
    }

    // Render Active Cards for Profile
    const cardsList = document.getElementById('profileCardsList');
    if (cardsList) {
        if (!window._dashboardData || !window._dashboardData.cards || window._dashboardData.cards.length === 0) {
             cardsList.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-grey);font-size:14px;">No cards found</div>';
        } else {
             cardsList.innerHTML = window._dashboardData.cards.map(card => {
                 const isCredit = (card.card_type && String(card.card_type).toLowerCase() === 'credit');
                 const isBlocked = card.status === 'blocked';
                 const bg = isBlocked ? 'linear-gradient(135deg, #475569, #1e293b)' : 
                           (isCredit ? 'linear-gradient(135deg, #1e293b, #0f172a)' : 'linear-gradient(135deg, var(--primary-maroon), #2a0000)');
                 
                 return `
                 <div style="background: ${bg}; border-radius: 12px; padding: 16px; margin-bottom: 12px; color: #fff; box-shadow: 0 4px 10px rgba(0,0,0,0.1); position: relative; opacity: ${isBlocked ? '0.85' : '1'}; transition: all 0.3s ease;">
                     <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
                         <div>
                             <div style="font-size: 11px; opacity: 0.8; letter-spacing: 0.5px;">SmartBank ${escHtml(card.card_type)}</div>
                             <div style="font-size: 16px; font-weight: 700; margin-top: 4px; letter-spacing: 2px;">${maskCard(card.card_number)}</div>
                         </div>
                         <div style="font-size: 10px; font-weight: 800; background: ${isBlocked ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255,255,255,0.2)'}; padding: 4px 8px; border-radius: 12px; border: 1px solid ${isBlocked ? '#f87171' : 'transparent'};">
                             ${escHtml(card.status ? card.status.toUpperCase() : 'ACTIVE')}
                         </div>
                     </div>
                     ${isBlocked ? `
                         <button onclick="unblockCardMobile(${card.id})" style="width: 100%; background: rgba(52, 211, 153, 0.15); color: #d1fae5; border: 1px solid rgba(52, 211, 153, 0.5); padding: 10px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                             <i class="fas fa-unlock"></i> UNBLOCK CARD
                         </button>
                     ` : `
                         <button onclick="blockCardMobile(${card.id})" style="width: 100%; background: rgba(239, 68, 68, 0.15); color: #fecaca; border: 1px solid rgba(239, 68, 68, 0.5); padding: 10px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                             <i class="fas fa-ban"></i> BLOCK CARD
                         </button>
                     `}
                 </div>
                 `;
             }).join('');
        }
    }
}

async function blockCardMobile(cardId) {
    if (!(await confirm('Are you sure you want to block this card? This prevents all future transactions.'))) return;
    try {
        const response = await fetch(`${API}/user/cards/${cardId}/block`, {
             method: 'POST',
             credentials: 'include'
        });
        const data = await response.json();
        if (response.ok) {
             showMobileToast(data.message || 'Card blocked successfully', 'success');
             fetchMobileDashboard();
        } else {
             showMobileToast(data.error || 'Failed to block card', 'error');
        }
    } catch (e) {
        showMobileToast('Network Error processing request', 'error');
    }
}

async function unblockCardMobile(cardId) {
    if (!(await confirm('Are you sure you want to unblock this card?'))) return;
    try {
        const response = await fetch(`${API}/user/cards/${cardId}/unblock`, {
             method: 'POST',
             credentials: 'include'
        });
        const data = await response.json();
        if (response.ok) {
             showMobileToast(data.message || 'Card unblocked successfully', 'success');
             fetchMobileDashboard();
        } else {
             showMobileToast(data.error || 'Failed to unblock card', 'error');
        }
    } catch (e) {
        showMobileToast('Network Error processing request', 'error');
    }
}

function showFullNotifications() {
    closeMobileSidebar();
}

async function uploadMobileProfileImage(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    if (file.size > 2 * 1024 * 1024) return showMobileToast('Image size must be less than 2MB', 'error');

    const formData = new FormData();
    formData.append('image', file);

    showMobileToast('Uploading image...', 'info');
    try {
        const r = await fetch(`${API}/user/profile-image`, {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });
        const d = await r.json();
        if (d.success) {
            showMobileToast('Profile image updated!', 'success');
            
            // Update local cache if available
            const cache = localStorage.getItem('bank_mobile_user_cache');
            if (cache) {
                const d_cache = JSON.parse(cache);
                d_cache.profile_image_url = d.profile_image_url;
                localStorage.setItem('bank_mobile_user_cache', JSON.stringify(d_cache));
            }
            
            // Refresh dashboard data to update all avatars
            loadDashboardData();
        } else {
            showMobileToast(d.error || 'Upload failed', 'error');
        }
    } catch (err) {
        console.error(err);
        showMobileToast('Upload failed', 'error');
    }
}

async function copyText(text, label) {
    try {
        await navigator.clipboard.writeText(text);

        // Premium feedback
        const btn = event.currentTarget;
        const icon = btn.querySelector('i');

        icon.className = 'fas fa-check';
        btn.style.background = '#dcfce7';
        btn.style.color = '#166534';
        btn.style.borderColor = '#bbf7d0';

        setTimeout(() => {
            icon.className = 'fas fa-copy';
            btn.style.background = '';
            btn.style.color = '';
            btn.style.borderColor = '';
        }, 2000);

    } catch (err) {
        console.error('Failed to copy: ', err);
        // Fallback for cases where clipboard API is blocked or failed
        const input = document.createElement('input');
        input.value = text;
        document.body.appendChild(input);
        input.select();
        try {
            document.execCommand('copy');
            showMobileToast(`${label} copied!`, 'success');
        } catch (e) {
            showMobileToast(`Failed to copy ${label}`, 'error');
        }
        document.body.removeChild(input);
    }
}

window.currentCardTab = 'savings';

function toggleCardTab(tab) {
    window.currentCardTab = tab;

    // Update tab styles using premium classes
    const tabSavings = document.getElementById('tabSavings');
    const tabCredit = document.getElementById('tabCredit');

    if (tabSavings && tabCredit) {
        if (tab === 'savings') {
            tabSavings.className = 'dash-tab dash-tab-active';
            tabCredit.className = 'dash-tab';
        } else {
            tabCredit.className = 'dash-tab dash-tab-active';
            tabSavings.className = 'dash-tab';
        }
    }

    if (window._dashboardData) {
        renderDashboard(window._dashboardData);
    }
}

function renderDashboard(data) {
    if (!data && window._dashboardData) {
        data = window._dashboardData;
    } else if (data) {
        window._dashboardData = data;
    }

    const cardContainer = document.getElementById('virtualCardContainer');
    if (cardContainer && data) {
        let displayCards = [];
        let displayRequests = [];
        const lowerTab = String(window.currentCardTab || 'savings').toLowerCase();

        // Merge server requests with our local pending ones, filter out duplicates by type
        const serverRequests = data.card_requests || [];
        const allRequests = [...serverRequests];

        // Add local ones if they don't exist in server data yet
        const MAX_LOCAL_AGE = 60 * 1000; // Consider local pending valid for 60 seconds
        window._localPendingRequests = (window._localPendingRequests || []).filter(local => {
            const age = Date.now() - (local.timestamp || Date.now());
            return age < MAX_LOCAL_AGE;
        });

        window._localPendingRequests.forEach(local => {
            const alreadyInServer = serverRequests.some(s =>
                String(s.card_type).toLowerCase() === String(local.card_type).toLowerCase() &&
                ['pending', 'requested', 'processing', 'submitted', 'under review', 'request'].includes(String(s.status).toLowerCase())
            );
            if (!alreadyInServer) allRequests.push(local);
        });

        console.log('Mobile Dashboard Render:', { tab: lowerTab, serverReq: serverRequests.length, localReq: (window._localPendingRequests || []).length });

        // A request is a credit card if: card_type contains 'credit' OR it has a requested_credit_limit set
        const isCredit = (r) => {
            const type = String(r.card_type || '').toLowerCase();
            return type.includes('credit') || (r.requested_credit_limit != null && r.requested_credit_limit > 0);
        };

        if (lowerTab === 'credit') {
            displayCards = (data.cards || []).filter(c => c.card_type && String(c.card_type).toLowerCase() === 'credit');
            displayRequests = allRequests.filter(r => {
                const status = String(r.status || '').toLowerCase();
                const isCompleted = ['rejected', 'declined', 'expired', 'cancelled', 'canceled', 'closed', 'approved', 'completed', 'issued'].includes(status);
                return isCredit(r) && !isCompleted;
            });
        } else {
            // Debit / Savings tab
            displayCards = (data.cards || []).filter(c => !c.card_type || String(c.card_type).toLowerCase() !== 'credit');
            displayRequests = allRequests.filter(r => {
                const status = String(r.status || '').toLowerCase();
                const isCompleted = ['rejected', 'declined', 'expired', 'cancelled', 'canceled', 'closed', 'approved', 'completed', 'issued'].includes(status);
                return !isCredit(r) && !isCompleted;
            });
        }

        console.log('Filtered Results:', { cards: displayCards.length, requests: displayRequests.length });

        if (displayCards.length > 0) {
            const card = displayCards[0];
            const num = String(card.card_number || '0000000000000000');
            const last4 = num.slice(-4);
            const formattedNum = `XXXX XXXX XXXX ${last4}`;
            const grad = card.card_type && String(card.card_type).toLowerCase() === 'credit'
                ? 'linear-gradient(135deg, #1e293b, #0f172a)'
                : 'linear-gradient(135deg, var(--primary-maroon), #2a0000)';
            const holderName = (data.user.name || data.user.username || 'USER').toUpperCase();

            cardContainer.innerHTML = `
                <div class="bank-card" style="background: ${grad};">
                    <div class="card-top">
                        <div class="rupay-branding">
                            RUPAY <small style="display:block;font-size:7px;margin-top:-2px;opacity:0.8;">${escHtml(card.card_tier || 'Platinum').toUpperCase()}</small>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:12px;font-weight:700;letter-spacing:0.5px;color:rgba(255,255,255,0.9);">SmartBank</div>
                            <div style="font-size:8px;opacity:0.7;text-transform:uppercase;">Connect • Life</div>
                        </div>
                    </div>
                    <div class="card-chip"></div>
                    <div class="card-number">${escHtml(formattedNum)}</div>
                    <div class="card-footer">
                        <div class="card-holder">${escHtml(holderName)}</div>
                        <button class="send-money-btn" onclick="switchTab('transfer')">SEND MONEY</button>
                    </div>
                </div>
            `;
        } else if (displayRequests.length > 0) {
            const req = displayRequests[0];
            const typeLabel = (req.card_type || 'Classic') + ' Card';
            cardContainer.innerHTML = `
                <div class="placeholder-card" style="border: 1.5px solid #800000; background: #fffafb; box-shadow: 0 10px 30px rgba(128,0,0,0.08);">
                    <div class="placeholder-icon pulse-maroon" style="background: #800000; color: #fff;">
                        <i class="fas fa-hourglass-half"></i>
                    </div>
                    <div class="placeholder-title" style="color: #800000; font-weight: 800;">Application In Progress</div>
                    <p class="placeholder-desc">Your <strong>${escHtml(typeLabel)}</strong> application is being processed by our system. We will notify you once it is dispatched.</p>
                </div>
            `;
        } else {
            if (window.currentCardTab === 'credit') {
                cardContainer.innerHTML = `
                    <div class="placeholder-card">
                        <div class="placeholder-icon">
                            <i class="fas fa-credit-card"></i>
                        </div>
                        <div class="placeholder-title">No Active Credit Card</div>
                        <p class="placeholder-desc">Unlock a world of premium benefits and rewards with our exclusive credit cards.</p>
                        <button class="placeholder-btn" style="background:#800000; color:#fff; border:none; padding:10px 24px; border-radius:30px; font-weight:700; cursor:pointer; margin-top:10px; box-shadow:0 4px 12px rgba(128,0,0,0.2);" onclick="applyForCreditCard()">Apply for Credit Card</button>
                    </div>
                `;
            } else {
                cardContainer.innerHTML = `
                    <div class="placeholder-card">
                        <div class="placeholder-icon">
                            <i class="fas fa-wallet"></i>
                        </div>
                        <div class="placeholder-title">No Active Debit Card</div>
                        <p class="placeholder-desc">Get your free contactless debit card with personalized design and multi-layer security.</p>
                        <button class="placeholder-btn" style="background:#800000; color:#fff; border:none; padding:10px 24px; border-radius:30px; font-weight:700; cursor:pointer; margin-top:10px; box-shadow:0 4px 12px rgba(128,0,0,0.2);" onclick="applyForMobileCard()">Apply for Free Debit Card</button>
                    </div>
                `;
            }
        }
    }

    // New: Update Balance Display
    updateBalanceDisplay();

    // Render Loans section for Mobile
    renderMobileLoans(data.loans || []);
}

function renderMobileLoans(loans) {
    if (!loans || loans.length === 0) return;

    // Check if loans section exists, if not inject it
    let loansSection = document.getElementById('mobileLoansSection');
    if (!loansSection) {
        const welcomeSection = document.querySelector('.welcome-section');
        if (welcomeSection) {
            loansSection = document.createElement('div');
            loansSection.id = 'mobileLoansSection';
            loansSection.innerHTML = `
        <div class="section-title" style="margin-top: 24px;">
            <span>Active Loans</span>
                </div>
        <div id="mobileLoansList" class="grid-actions" style="display: flex; flex-direction: column; gap: 12px; padding: 0;">
        </div>
    `;
            welcomeSection.appendChild(loansSection);
        }
    }

    const list = document.getElementById('mobileLoansList');
    if (!list) return;

    const icons = { 'Personal Loan': 'fa-user-tie', 'Home Loan': 'fa-home', 'Car Loan': 'fa-car', 'Education Loan': 'fa-graduation-cap', 'Business Loan': 'fa-briefcase', 'Gold Loan': 'fa-coins' };

    list.innerHTML = loans.map(l => {
        const outstanding = l.outstanding_amount !== null ? l.outstanding_amount : l.loan_amount;
        const fmtINR_mob = (n) => '₹' + parseFloat(n).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 });

        // Fix EMI display bug 
        if (!l.monthly_payment || l.monthly_payment <= 0) {
            const r = (l.interest_rate || 10.5) / 1200;
            const amt = l.loan_amount;
            const ten = l.tenure_months || 12;
            l.monthly_payment = r > 0 ? Math.round(amt * r * Math.pow(1 + r, ten) / (Math.pow(1 + r, ten) - 1)) : Math.round(amt / ten);
        }

        return `
        <div style="background: #fff; padding: 16px; border-radius: 16px; border: 1px solid #eee; display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px;">
            <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 44px; height: 44px; border-radius: 12px; background: rgba(139, 0, 0, 0.05); color: #8b0000; display: flex; align-items: center; justify-content: center; font-size: 18px;">
                    <i class="fas ${icons[l.loan_type] || 'fa-hand-holding-usd'}"></i>
                </div>
                <div>
                    <h4 style="margin: 0; font-size: 15px; color: #1a1a1a; font-weight: 700;">${escHtml(l.loan_type)}</h4>
                    <p style="margin: 2px 0 0; font-size: 12px; color: #666;">EMI: ${fmtINR_mob(l.monthly_payment)} • ${fmtINR_mob(outstanding)} left</p>
                </div>
            </div>
                ${l.status === 'approved' ? `
                    <button onclick="injectLoanRepayModal(${l.id}, '${escHtml(l.loan_type)}', ${outstanding}, ${l.monthly_payment})" style="background: #8b0000; color: #fff; border: none; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 700; box-shadow: 0 4px 12px rgba(139, 0, 0, 0.2);">Repay</button>
                ` : `<span class="loan-status-badge ${escHtml(l.status)}" style="font-size: 10px;">${escHtml(l.status.toUpperCase())}</span>`
            }
        </div>
        `;
    }).join('');
}

function injectLoanRepayModal(loanId, loanType, outstanding, emi) {
    let modal = document.getElementById('mobileLoanRepayModal');
    if (!modal) {
        const modalHTML = `
        <div id="mobileLoanRepayModal" style="display:none;position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:2000;justify-content:center;align-items:flex-end;border-radius:30px;overflow:hidden;">
            <div style="background:#ffffff;width:100%;border-top-left-radius:24px;border-top-right-radius:24px;padding:24px;max-height:90vh;overflow-y:auto;animation:slideUp 0.3s ease;box-shadow:0 -5px 15px rgba(0,0,0,0.1);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                    <h3 style="margin:0;color:#1a1a1a;font-size:18px;">Loan Repayment</h3>
                    <button onclick="document.getElementById('mobileLoanRepayModal').style.display='none'" style="background:none;border:none;font-size:24px;color:#666666;">&times;</button>
                </div>
                <p id="mobRepayInfo" style="color:#666666;font-size:14px;margin-bottom:20px;"></p>
                <input type="hidden" id="mobRepayLoanId">
                    <div style="margin-bottom:20px;">
                        <label style="display:block;margin-bottom:8px;color:#1a1a1a;font-weight:600;font-size:14px;">Select Account</label>
                        <select id="mobRepayAccount" style="width:100%;padding:14px;border-radius:12px;border:1px solid #eeeeee;background:#ffffff;color:#1a1a1a;font-size:16px;"></select>
                    </div>
                    <div style="margin-bottom:20px;">
                        <label style="display:block;margin-bottom:8px;color:#1a1a1a;font-weight:600;font-size:14px;">Repayment Type</label>
                        <select id="mobRepayType" onchange="updateMobileRepayAmount()" style="width:100%;padding:14px;border-radius:12px;border:1px solid #eeeeee;background:#ffffff;color:#1a1a1a;font-size:16px;">
                            <option value="custom">Custom Amount</option>
                            <option value="emi">Monthly Tenure (EMI x Months)</option>
                            <option value="full">Full Settlement</option>
                        </select>
                    </div>
                    <div id="mobRepayMonthsGroup" style="margin-bottom:20px;display:none;">
                        <label style="display:block;margin-bottom:8px;color:#1a1a1a;font-weight:600;font-size:14px;">Number of Months</label>
                        <input type="number" id="mobRepayMonths" value="1" min="1" oninput="updateMobileRepayAmount()" style="width:100%;padding:14px;border-radius:12px;border:1px solid #eeeeee;background:#ffffff;color:#1a1a1a;font-size:16px;">
                    </div>
                    <div style="margin-bottom:24px;">
                        <label style="display:block;margin-bottom:8px;color:#1a1a1a;font-weight:600;font-size:14px;">Amount (₹)</label>
                        <input type="number" id="mobRepayAmount" style="width:100%;padding:14px;border-radius:12px;border:1px solid #eeeeee;background:#ffffff;color:#1a1a1a;font-size:16px;">
                    </div>
                    <button id="btnMobConfirmRepay" onclick="submitMobileRepayment()" style="width:100%;padding:16px;border-radius:16px;background:#8b0000;color:#ffffff;border:none;font-weight:600;font-size:16px;box-shadow: 0 4px 15px rgba(139, 0, 0, 0.3);">Confirm Repayment</button>
            </div>
        </div > `;
        const wrapper = document.querySelector('.mobile-wrapper') || document.body;
        wrapper.insertAdjacentHTML('beforeend', modalHTML);
        modal = document.getElementById('mobileLoanRepayModal');
    }

    const amtInp = document.getElementById('mobRepayAmount');
    amtInp.dataset.emi = emi;
    amtInp.dataset.outstanding = outstanding;
    document.getElementById('mobRepayLoanId').value = loanId;
    amtInp.value = outstanding;
    amtInp.readOnly = false;
    document.getElementById('mobRepayType').value = 'custom';
    document.getElementById('mobRepayMonthsGroup').style.display = 'none';

    const fmtINR_mob = (n) => '₹' + parseFloat(n).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
    document.getElementById('mobRepayInfo').innerHTML = `Repaying for <b>${escHtml(loanType)}</b>. Outstanding: <b>${fmtINR_mob(outstanding)}</b>`;

    const sel = document.getElementById('mobRepayAccount');
    if (sel) {
        sel.innerHTML = (window._accounts || []).map(a => `<option value="${a.id}">${escHtml(a.account_type)} - ${escHtml(a.account_number.slice(-4))} (${fmtINR_mob(a.balance)})</option>`).join('');
    }

    modal.style.display = 'flex';
}

function updateMobileRepayAmount() {
    const type = document.getElementById('mobRepayType').value;
    const amountInput = document.getElementById('mobRepayAmount');
    const emi = parseFloat(amountInput.dataset.emi || 0);
    const outstanding = parseFloat(amountInput.dataset.outstanding || 0);
    const monthsGroup = document.getElementById('mobRepayMonthsGroup');

    if (type === 'emi') {
        monthsGroup.style.display = 'block';
        const months = parseInt(document.getElementById('mobRepayMonths').value || 1);
        amountInput.value = Math.min(outstanding, Math.round(emi * months));
        amountInput.readOnly = true;
    } else if (type === 'full') {
        monthsGroup.style.display = 'none';
        amountInput.value = outstanding;
        amountInput.readOnly = true;
    } else {
        monthsGroup.style.display = 'none';
        if (amountInput.readOnly) amountInput.value = '';
        amountInput.readOnly = false;
        amountInput.focus();
    }
}

async function submitMobileRepayment() {
    const loanId = document.getElementById('mobRepayLoanId').value;
    const accountId = document.getElementById('mobRepayAccount').value;
    const amount = parseFloat(document.getElementById('mobRepayAmount').value);

    if (!amount || amount <= 0) return showMobileToast('Invalid amount', 'error');

    const btn = document.getElementById('btnMobConfirmRepay');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

    try {
        const r = await fetch(`${API}/user/loans/repay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ loan_id: loanId, account_id: accountId, amount })
        });
        const d = await r.json();
        if (r.ok) {
            showMobileToast('Repayment Successful! ✅', 'success');
            document.getElementById('mobileLoanRepayModal').style.display = 'none';
            await loadDashboardData();
        } else {
            showMobileToast(d.error || 'Repayment failed', 'error');
        }
    } catch (e) { showMobileToast('Connection error', 'error'); }
    finally {
        btn.disabled = false;
        btn.innerHTML = 'Confirm Repayment';
    }
}

/* ── Check Balance Logic ── */
// Persistence: Try to restore last visibility state safely
try {
    const pref = localStorage.getItem('bank_balance_visible_pref');
    window.isBalanceVisible = pref === 'true';
} catch (e) {
    console.warn('[Balance] Storage access blocked, defaulting to hidden');
    window.isBalanceVisible = false;
}

// Core Display Function
function updateBalanceDisplay() {
    console.log('[Balance] Updating display...', { visible: window.isBalanceVisible });
    try {
        const el = document.getElementById('mobileBalanceAmount');
        if (!el) return;

        const parseCurrency = (val) => {
            if (typeof val === 'number') return val;
            const clean = String(val || '0').replace(/[^0-9.-]+/g, '');
            const parsed = parseFloat(clean);
            return isNaN(parsed) ? 0 : parsed;
        };

        const accounts = window._accounts || [];
        const totalBalance = accounts.reduce((sum, acc) => sum + parseCurrency(acc.balance), 0);
        const hasAccounts = accounts.length > 0;

        const balanceCard = document.getElementById('mobileBalanceCard');
        const balanceLabel = document.getElementById('mobileBalanceLabel');
        const btn = document.getElementById('toggleBalanceBtn');
        const infoEl = document.getElementById('mobileAccountInfo');

        if (balanceCard) {
            balanceCard.style.display = hasAccounts ? 'flex' : 'none';
            if (hasAccounts && balanceLabel) {
                balanceLabel.textContent = accounts.length === 1 ? `${accounts[0].account_type || 'Account'} Balance` : 'Total Balance';
            }
        }

        // Synchronize UI State
        if (btn) {
            btn.innerHTML = window.isBalanceVisible ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
            btn.classList.toggle('active', window.isBalanceVisible);
            btn.title = window.isBalanceVisible ? 'Hide Balance' : 'Show Balance';
        }

        if (window.isBalanceVisible) {
            el.textContent = `₹${totalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })} `;
            el.classList.remove('balance-hidden');
            el.style.opacity = '1';
            el.style.filter = 'none';
            el.style.transform = 'translateY(0) scale(1)';

            if (infoEl) {
                if (accounts.length === 1) {
                    const acc = accounts[0];
                    infoEl.innerHTML = `A/C: ${escHtml(acc.account_number.slice(0, 4))}...${escHtml(acc.account_number.slice(-4))} | IFSC: ${escHtml(acc.ifsc || 'SMTB0000001')}`;
                    infoEl.style.display = 'block';
                    infoEl.style.opacity = '0.7';
                } else {
                    infoEl.style.display = 'none';
                }
            }
        } else {
            el.textContent = '● ● ● ● ● ●';
            el.classList.add('balance-hidden');
            el.style.opacity = '0.3';
            el.style.filter = 'blur(8px)';
            el.style.transform = 'translateY(0) scale(0.98)';
            if (infoEl) infoEl.style.display = 'none';
        }
    } catch (err) {
        console.error('[Balance] Update failed:', err);
    }
}

function toggleBalanceVisibility(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    console.log('[Balance] Toggle triggered');
    
    // If balance is currently VISIBLE → just hide it (no PIN needed)
    if (window.isBalanceVisible) {
        window.isBalanceVisible = false;
        try { localStorage.setItem('bank_balance_visible_pref', 'false'); } catch(e) {}
        updateBalanceDisplay();
        
        const btn = document.getElementById('toggleBalanceBtn');
        if (btn) {
            btn.innerHTML = '<i class="fas fa-eye"></i>';
            btn.classList.remove('active');
        }
        return;
    }
    
    // If balance is HIDDEN → require PIN to show
    openPinModal();
}

/* ── Balance PIN System ── */
let _pinBuffer = '';
let _pinMode = 'verify'; // 'setup_new', 'setup_confirm', 'verify'
let _pinSetupFirst = ''; // stores first entry during setup

// Server-side passcode status cache
let _passcodeEnabled = null; // null = not checked yet

async function checkPasscodeStatus() {
    try {
        const r = await fetch(`${API}/auth/mobile/passcode-status`, { credentials: 'include' });
        if (r.ok) {
            const d = await r.json();
            _passcodeEnabled = !!d.enabled;
        }
    } catch (e) {
        console.warn('[PIN] Status check failed:', e);
    }
    return _passcodeEnabled;
}

function hasStoredPin() {
    return _passcodeEnabled === true;
}

async function setupPinOnServer(pin) {
    try {
        const r = await fetch(`${API}/auth/mobile/setup-passcode`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ passcode: pin })
        });
        const d = await r.json();
        if (r.ok && d.success) {
            _passcodeEnabled = true;
            return { success: true };
        }
        return { success: false, error: d.error || 'Setup failed' };
    } catch (e) {
        return { success: false, error: 'Connection error' };
    }
}

async function verifyPinOnServer(pin) {
    try {
        const r = await fetch(`${API}/auth/mobile/verify-passcode`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ passcode: pin })
        });
        const d = await r.json();
        return r.ok && d.success;
    } catch (e) {
        return false;
    }
}

async function openPinModal() {
    console.log('[PIN] Opening modal');
    _pinBuffer = '';
    _pinSetupFirst = '';
    
    const overlay = document.getElementById('balancePinOverlay');
    const title = document.getElementById('pinModalTitle');
    const subtitle = document.getElementById('pinModalSubtitle');
    const errMsg = document.getElementById('pinErrorMsg');
    const resetBtn = document.getElementById('pinResetBtn');
    
    if (!overlay) return;
    
    // Clear state
    if (errMsg) errMsg.textContent = '';
    updatePinDots();
    
    // Check server for passcode status if not cached
    if (_passcodeEnabled === null) {
        await checkPasscodeStatus();
    }
    
    if (_passcodeEnabled) {
        _pinMode = 'verify';
        if (title) title.textContent = 'Enter Balance PIN';
        if (subtitle) subtitle.textContent = 'Enter your 4-digit PIN to view balance';
        if (resetBtn) resetBtn.style.display = 'none';
    } else {
        _pinMode = 'setup_new';
        if (title) title.textContent = 'Set Balance PIN';
        if (subtitle) subtitle.textContent = 'Create a 4-digit PIN to secure your balance';
        if (resetBtn) resetBtn.style.display = 'none';
    }
    
    overlay.style.display = 'flex';
}

function closePinModal() {
    const overlay = document.getElementById('balancePinOverlay');
    if (!overlay) return;
    
    const sheet = document.getElementById('balancePinSheet');
    if (sheet) {
        sheet.style.animation = 'pinSlideDown 0.25s ease forwards';
        setTimeout(() => {
            overlay.style.display = 'none';
            sheet.style.animation = 'pinSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)';
        }, 250);
    } else {
        overlay.style.display = 'none';
    }
    
    _pinBuffer = '';
    _pinSetupFirst = '';
}

function updatePinDots() {
    const dots = document.querySelectorAll('#balancePinOverlay .pin-dot');
    dots.forEach((dot, i) => {
        dot.classList.remove('filled', 'error', 'success');
        if (i < _pinBuffer.length) {
            dot.classList.add('filled');
        }
    });
}

function pinKeyPress(digit) {
    if (_pinBuffer.length >= 4) return;
    
    _pinBuffer += digit;
    updatePinDots();
    
    // Haptic feedback attempt
    if (navigator.vibrate) navigator.vibrate(15);
    
    // Auto-submit when 4 digits reached
    if (_pinBuffer.length === 4) {
        setTimeout(() => handlePinComplete(), 200);
    }
}

function pinKeyBackspace() {
    if (_pinBuffer.length === 0) return;
    _pinBuffer = _pinBuffer.slice(0, -1);
    updatePinDots();
}

async function handlePinComplete() {
    const pin = _pinBuffer;
    const title = document.getElementById('pinModalTitle');
    const subtitle = document.getElementById('pinModalSubtitle');
    const errMsg = document.getElementById('pinErrorMsg');
    
    if (_pinMode === 'setup_new') {
        // First entry during setup
        _pinSetupFirst = pin;
        _pinBuffer = '';
        _pinMode = 'setup_confirm';
        
        if (title) title.textContent = 'Confirm PIN';
        if (subtitle) subtitle.textContent = 'Re-enter your 4-digit PIN to confirm';
        if (errMsg) errMsg.textContent = '';
        updatePinDots();
        return;
    }
    
    if (_pinMode === 'setup_confirm') {
        if (pin === _pinSetupFirst) {
            // PIN confirmed - save to server
            const result = await setupPinOnServer(pin);
            if (result.success) {
                pinSuccess();
            } else {
                pinError(result.error || 'Failed to save PIN');
                _pinMode = 'setup_new';
                _pinSetupFirst = '';
                if (title) title.textContent = 'Set Balance PIN';
                if (subtitle) subtitle.textContent = 'Create a 4-digit PIN to secure your balance';
            }
        } else {
            pinError('PINs don\'t match. Try again.');
            _pinMode = 'setup_new';
            _pinSetupFirst = '';
            if (title) title.textContent = 'Set Balance PIN';
            if (subtitle) subtitle.textContent = 'Create a 4-digit PIN to secure your balance';
        }
        return;
    }
    
    if (_pinMode === 'verify') {
        const ok = await verifyPinOnServer(pin);
        if (ok) {
            pinSuccess();
        } else {
            pinError('Incorrect PIN. Try again.');
        }
        return;
    }
}

function pinSuccess() {
    const dots = document.querySelectorAll('#balancePinOverlay .pin-dot');
    dots.forEach(d => {
        d.classList.remove('filled', 'error');
        d.classList.add('success');
    });
    
    if (navigator.vibrate) navigator.vibrate([20, 50, 20]);
    
    setTimeout(() => {
        closePinModal();
        
        // Reveal the balance
        window.isBalanceVisible = true;
        try { localStorage.setItem('bank_balance_visible_pref', 'true'); } catch(e) {}
        updateBalanceDisplay();
        
        const btn = document.getElementById('toggleBalanceBtn');
        if (btn) {
            btn.innerHTML = '<i class="fas fa-eye-slash"></i>';
            btn.classList.add('active');
        }
        
        if (typeof showMobileToast === 'function') {
            showMobileToast('Balance revealed', 'success');
        }
    }, 500);
}

function pinError(msg) {
    const errMsg = document.getElementById('pinErrorMsg');
    const dotsContainer = document.getElementById('pinDotsContainer');
    
    // Shake animation
    if (dotsContainer) {
        dotsContainer.classList.add('shake');
        setTimeout(() => dotsContainer.classList.remove('shake'), 400);
    }
    
    // Mark dots as error briefly
    const dots = document.querySelectorAll('#balancePinOverlay .pin-dot');
    dots.forEach(d => {
        d.classList.remove('filled', 'success');
        d.classList.add('error');
    });
    
    if (errMsg) errMsg.textContent = msg || 'Incorrect PIN';
    if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
    
    // Reset after animation
    setTimeout(() => {
        _pinBuffer = '';
        updatePinDots();
    }, 500);
}

function resetBalancePin() {
    closePinModal();
    showMobileToast('You can change your PIN from Profile > Change Balance PIN', 'info');
}

/* ── Change Balance PIN (from Profile) ── */
function showChangeBalancePinModal() {
    const modal = document.getElementById('changeBalancePinModal');
    if (modal) {
        modal.style.display = 'flex';
        // Clear fields
        const inputs = modal.querySelectorAll('input');
        inputs.forEach(inp => inp.value = '');
        const err = document.getElementById('changePinError');
        if (err) err.style.display = 'none';
    }
}

function closeChangeBalancePinModal() {
    const modal = document.getElementById('changeBalancePinModal');
    if (modal) modal.style.display = 'none';
}

async function submitChangeBalancePin() {
    const currentPin = document.getElementById('changePinCurrent').value;
    const newPin = document.getElementById('changePinNew').value;
    const confirmPin = document.getElementById('changePinConfirm').value;
    const errEl = document.getElementById('changePinError');
    const btn = document.getElementById('changePinSubmitBtn');

    if (!currentPin || currentPin.length !== 4) {
        if (errEl) { errEl.textContent = 'Enter your current 4-digit PIN'; errEl.style.display = 'block'; }
        return;
    }
    if (!newPin || newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
        if (errEl) { errEl.textContent = 'New PIN must be exactly 4 digits'; errEl.style.display = 'block'; }
        return;
    }
    if (newPin !== confirmPin) {
        if (errEl) { errEl.textContent = 'New PINs do not match'; errEl.style.display = 'block'; }
        return;
    }
    if (currentPin === newPin) {
        if (errEl) { errEl.textContent = 'New PIN must be different from current'; errEl.style.display = 'block'; }
        return;
    }

    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; }

    try {
        const r = await fetch(`${API}/auth/mobile/change-passcode`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ current_passcode: currentPin, new_passcode: newPin })
        });
        const d = await r.json();
        if (r.ok && d.success) {
            showMobileToast('Balance PIN changed successfully! ✅', 'success');
            closeChangeBalancePinModal();
        } else {
            if (errEl) { errEl.textContent = d.error || 'Failed to change PIN'; errEl.style.display = 'block'; }
        }
    } catch (e) {
        if (errEl) { errEl.textContent = 'Connection error. Try again.'; errEl.style.display = 'block'; }
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check-circle"></i> Update PIN'; }
    }
}

// Global bindings
window.toggleBalanceVisibility = toggleBalanceVisibility;
window.updateBalanceDisplay = updateBalanceDisplay;
window.openPinModal = openPinModal;
window.closePinModal = closePinModal;
window.pinKeyPress = pinKeyPress;
window.pinKeyBackspace = pinKeyBackspace;
window.resetBalancePin = resetBalancePin;
window.showChangeBalancePinModal = showChangeBalancePinModal;
window.closeChangeBalancePinModal = closeChangeBalancePinModal;
window.submitChangeBalancePin = submitChangeBalancePin;
window.checkPasscodeStatus = checkPasscodeStatus;

// Initialize balance UI on load
function initializeBalanceUI() {
    console.log('[Balance] Initializing UI...', { visible: window.isBalanceVisible });
    // Let the balance visibility state defined earlier (loaded from localStorage/session) remain
    updateBalanceDisplay();
}

if (document.readyState !== 'loading') {
    initializeBalanceUI();
} else {
    document.addEventListener('DOMContentLoaded', initializeBalanceUI);
}
window.addEventListener('load', initializeBalanceUI);


async function refreshMobileBalance() {
    console.log('[Balance] Manual refresh triggered...');
    const btn = document.getElementById('refreshBalanceBtn');
    if (btn) {
        const icon = btn.querySelector('i');
        if (icon) icon.classList.add('fa-spin');
        btn.disabled = true;
    }

    try {
        await loadDashboardData();
        // Force update UI after data is loaded
        updateBalanceDisplay();
        
        if (window.isBalanceVisible) {
            // Briefly show a highlight if it's already visible
            const el = document.getElementById('mobileBalanceAmount');
            if (el) {
                el.style.color = '#10b981';
                setTimeout(() => el.style.color = '', 500);
            }
        }
        showMobileToast('Balance updated', 'success');
    } catch (e) {
        console.error('Manual refresh failed', e);
        showMobileToast('Refresh failed', 'error');
    } finally {
        if (btn) {
            const icon = btn.querySelector('i');
            if (icon) icon.classList.remove('fa-spin');
            btn.disabled = false;
        }
    }
}

async function applyForMobileCard() {
    if (!window._primaryAccount) {
        const m = document.createElement('div');
        m.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:99999;';
        m.innerHTML = `<div style="background:#fff;border-radius:20px;padding:28px 24px;max-width:320px;width:90%;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,0.15);">
            <div style="font-size:36px;margin-bottom:14px;">🏦</div>
            <h3 style="margin:0 0 8px;font-size:17px;font-weight:800;color:#111;">No Bank Account</h3>
            <p style="margin:0 0 20px;font-size:13px;color:#6b7280;">Please open a bank account first before applying for a debit card.</p>
            <button onclick="this.closest('[style]').remove()" style="padding:11px 28px;border-radius:30px;border:none;background:#800000;color:#fff;font-weight:700;font-size:13px;cursor:pointer;">OK</button>
        </div>`;
        const wrapper = document.querySelector('.mobile-wrapper') || document.body;
        wrapper.appendChild(m);
        m.addEventListener('click', e => { if (e.target === m) m.remove(); });
        return;
    }

    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:99999;';
    modal.innerHTML = `
        <div style="background:#fff;border-radius:20px;padding:30px 24px;max-width:340px;width:90%;box-shadow:0 25px 60px rgba(0,0,0,0.18);text-align:center;">
            <div style="width:52px;height:52px;border-radius:50%;background:#fdf2f2;color:#800000;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:22px;">
                <i class="fas fa-credit-card"></i>
            </div>
            <h3 style="margin:0 0 8px;font-size:18px;font-weight:800;color:#111827;">Apply for Debit Card?</h3>
            <p style="margin:0 0 22px;font-size:13px;color:#6b7280;">Apply for a new <strong>Classic Debit Card</strong> linked to your bank account. Free contactless card with multilayer security.</p>
            <div style="display:flex;gap:10px;">
                <button id="_dcCancel" style="flex:1;padding:11px;border-radius:30px;border:1.5px solid #e5e7eb;background:#fff;font-size:13px;font-weight:600;color:#6b7280;cursor:pointer;">Cancel</button>
                <button id="_dcOk" style="flex:1;padding:11px;border-radius:30px;border:none;background:#800000;font-size:13px;font-weight:700;color:#fff;cursor:pointer;box-shadow:0 4px 12px rgba(128,0,0,0.25);">Confirm</button>
            </div>
        </div>`;
    const wrapper = document.querySelector('.mobile-wrapper') || document.body;
    wrapper.appendChild(modal);
    document.getElementById('_dcCancel').onclick = () => modal.remove();
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    let isSubmitting = false;
    document.getElementById('_dcOk').onclick = async () => {
        if (isSubmitting) return;
        isSubmitting = true;

        const btn = document.getElementById('_dcOk');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Applying...';
            btn.style.opacity = '0.7';
        }

        // Immediately inject pending state into local store BEFORE the API call
        if (!window._localPendingRequests) window._localPendingRequests = [];
        window._localPendingRequests.push({ card_type: 'classic', status: 'pending', timestamp: Date.now() });
        modal.remove();
        if (!window._dashboardData) window._dashboardData = { cards: [], card_requests: [] };
        renderDashboard(window._dashboardData);

        try {
            const r = await fetch(API + '/user/cards/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    account_id: window._primaryAccount.id,
                    card_type: 'Classic'
                })
            });
            const d = await r.json();
            if (r.ok) {
                showMobileToast('Debit Card application submitted! ✅', 'success');
                setTimeout(() => loadDashboardData(), 1500);
            } else {
                // Remove local pending on failure
                window._localPendingRequests = window._localPendingRequests.filter(x => x.card_type !== 'classic');
                renderDashboard(window._dashboardData);
                showMobileToast(d.error || 'Failed to apply for card', 'error');
            }
        } catch (e) {
            window._localPendingRequests = window._localPendingRequests.filter(x => x.card_type !== 'classic');
            renderDashboard(window._dashboardData);
            showMobileToast('Server connection error. Try again later.', 'error');
        } finally {
            isSubmitting = false;
        }
    };
}

async function applyForCreditCard() {
    if (!window._primaryAccount) {
        const errorHTML = `
        <div id="_ccErrorModal" class="modal-overlay" style="display:flex;">
            <div class="modal-content" style="text-align:center;padding:28px 24px;border-radius:20px;">
                <div style="font-size:36px;margin-bottom:14px;">🏦</div>
                <h3 style="margin:0 0 8px;font-size:17px;font-weight:800;color:#111;">No Bank Account</h3>
                <p style="margin:0 0 20px;font-size:13px;color:#6b7280;">Please open a bank account first before applying for a credit card.</p>
                <button onclick="document.getElementById('_ccErrorModal').remove()" style="padding:11px 28px;border-radius:30px;border:none;background:#800000;color:#fff;font-weight:700;font-size:13px;cursor:pointer;">OK</button>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', errorHTML);
        return;
    }

    const modalHTML = `
    <div id="_ccApplyModal" class="modal-overlay" style="display:flex;">
        <div class="modal-content" style="text-align:center;padding:30px 24px;border-radius:20px;">
            <div style="width:52px;height:52px;border-radius:50%;background:#fdf2f2;color:#800000;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:22px;">
                <i class="fas fa-credit-card"></i>
            </div>
            <h3 style="margin:0 0 8px;font-size:18px;font-weight:800;color:#111827;">Apply for Credit Card?</h3>
            <p style="margin:0 0 22px;font-size:13px;color:#6b7280;">Apply for a new <strong>Platinum Credit Card</strong> linked to your account. Credit limit: ₹50,000.</p>
            <div style="display:flex;gap:10px;">
                <button id="_ccCancel" style="flex:1;padding:11px;border-radius:30px;border:1.5px solid #e5e7eb;background:#fff;font-size:13px;font-weight:600;color:#6b7280;cursor:pointer;">Cancel</button>
                <button id="_ccOk" style="flex:1;padding:11px;border-radius:30px;border:none;background:#800000;font-size:13px;font-weight:700;color:#fff;cursor:pointer;box-shadow:0 4px 12px rgba(128,0,0,0.25);">Confirm</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal2 = document.getElementById('_ccApplyModal');
    document.getElementById('_ccCancel').onclick = () => modal2.remove();
    modal2.addEventListener('click', e => { if (e.target === modal2) modal2.remove(); });
    let isSubmitting_cc = false;
    document.getElementById('_ccOk').onclick = async () => {
        if (isSubmitting_cc) return;
        isSubmitting_cc = true;

        const btn = document.getElementById('_ccOk');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Applying...';
            btn.style.opacity = '0.7';
        }

        // Immediately inject pending state BEFORE the API call finishes
        if (!window._localPendingRequests) window._localPendingRequests = [];
        window._localPendingRequests.push({ card_type: 'credit', status: 'pending', timestamp: Date.now() });
        modal2.remove();
        if (!window._dashboardData) window._dashboardData = { cards: [], card_requests: [] };
        renderDashboard(window._dashboardData);

        try {
            const r = await fetch(API + '/user/cards/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    account_id: window._primaryAccount.id,
                    card_type: 'Credit',
                    requested_credit_limit: 50000
                })
            });
            const d = await r.json();
            if (r.ok) {
                showMobileToast('Credit Card application submitted! ✅', 'success');
                setTimeout(() => loadDashboardData(), 1500);
            } else {
                window._localPendingRequests = window._localPendingRequests.filter(x => x.card_type !== 'credit');
                renderDashboard(window._dashboardData);
                showMobileToast(d.error || 'Failed to apply for credit card', 'error');
            }
        } catch (e) {
            window._localPendingRequests = window._localPendingRequests.filter(x => x.card_type !== 'credit');
            renderDashboard(window._dashboardData);
            showMobileToast('Server connection error. Try again later.', 'error');
        } finally {
            isSubmitting_cc = false;
        }
    };
}

async function applyForMobileCard() {
    if (!window._primaryAccount) {
        const errorHTML = `
        <div id="_dcErrorModal" class="modal-overlay" style="display:flex;">
            <div class="modal-content" style="text-align:center;padding:28px 24px;border-radius:20px;">
                <div style="font-size:36px;margin-bottom:14px;">🏦</div>
                <h3 style="margin:0 0 8px;font-size:17px;font-weight:800;color:#111;">No Bank Account</h3>
                <p style="margin:0 0 20px;font-size:13px;color:#6b7280;">Please open a bank account first before applying for a debit card.</p>
                <button onclick="document.getElementById('_dcErrorModal').remove()" style="padding:11px 28px;border-radius:30px;border:none;background:#800000;color:#fff;font-weight:700;font-size:13px;cursor:pointer;">OK</button>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', errorHTML);
        return;
    }

    const modalHTML = `
    <div id="_dcApplyModal" class="modal-overlay" style="display:flex;">
        <div class="modal-content" style="text-align:center;padding:30px 24px;border-radius:20px;">
            <div style="width:52px;height:52px;border-radius:50%;background:#fcf8f8;color:#800000;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:22px;">
                <i class="fas fa-wallet"></i>
            </div>
            <h3 style="margin:0 0 8px;font-size:18px;font-weight:800;color:#111827;">Get Free Debit Card?</h3>
            <p style="margin:0 0 22px;font-size:13px;color:#6b7280;">Apply for a new contactless <strong>RuPay Debit Card</strong> linked to your account. No issuance fees.</p>
            <div style="display:flex;gap:10px;">
                <button id="_dcCancel" style="flex:1;padding:11px;border-radius:30px;border:1.5px solid #e5e7eb;background:#fff;font-size:13px;font-weight:600;color:#6b7280;cursor:pointer;">Cancel</button>
                <button id="_dcOk" style="flex:1;padding:11px;border-radius:30px;border:none;background:#800000;font-size:13px;font-weight:700;color:#fff;cursor:pointer;box-shadow:0 4px 12px rgba(128,0,0,0.25);">Apply Now</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modalDc = document.getElementById('_dcApplyModal');
    document.getElementById('_dcCancel').onclick = () => modalDc.remove();
    modalDc.addEventListener('click', e => { if (e.target === modalDc) modalDc.remove(); });
    let isSubmitting_dc = false;
    document.getElementById('_dcOk').onclick = async () => {
        if (isSubmitting_dc) return;
        isSubmitting_dc = true;

        const btn = document.getElementById('_dcOk');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Applying...';
            btn.style.opacity = '0.7';
        }

        if (!window._localPendingRequests) window._localPendingRequests = [];
        window._localPendingRequests.push({ card_type: 'debit', status: 'pending', timestamp: Date.now() });
        modalDc.remove();
        if (!window._dashboardData) window._dashboardData = { cards: [], card_requests: [] };
        renderDashboard(window._dashboardData);

        try {
            const r = await fetch(API + '/user/cards/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    account_id: window._primaryAccount.id,
                    card_type: 'Debit',
                    requested_credit_limit: 0
                })
            });
            const d = await r.json();
            if (r.ok) {
                showMobileToast('Debit Card application submitted! ✅', 'success');
                setTimeout(() => loadDashboardData(), 1500);
            } else {
                window._localPendingRequests = window._localPendingRequests.filter(x => x.card_type !== 'debit');
                renderDashboard(window._dashboardData);
                showMobileToast(d.error || 'Failed to apply for debit card', 'error');
            }
        } catch (e) {
            window._localPendingRequests = window._localPendingRequests.filter(x => x.card_type !== 'debit');
            renderDashboard(window._dashboardData);
            showMobileToast('Server connection error. Try again later.', 'error');
        } finally {
            isSubmitting_dc = false;
        }
    };
}

/* ── UPI Logic ── */
async function checkUpiStatus() {
    try {
        const r = await fetch(`${API}/user/upi/status`, { credentials: 'include' });
        if (r.ok) {
            const d = await r.json();
            const statusBox = document.getElementById('upiStatusBox');
            const transferSec = document.getElementById('upiTransferSection');
            const setupSec = document.getElementById('upiSetupSection');

            if (d.enabled) {
                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=upi://pay?pa=${d.upi_id}&pn=${encodeURIComponent(window.currentUser?.name || 'User')}`;
                if (statusBox) {
                    statusBox.innerHTML = `<div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <div><p style="font-size: 12px; color: #166534;">Active VPA</p><h4 style="font-weight: 700;">${escHtml(d.upi_id)}</h4></div>
                        <i class="fas fa-check-circle" style="color: #22c55e; font-size: 24px;"></i>
                    </div>
                    <div style="text-align: center; margin-top: 15px; margin-bottom: 10px;">
                        <p style="font-size: 13px; font-weight: bold; margin-bottom: 10px; color: var(--text-primary);">Your UPI QR Code</p>
                        <img src="${escHtml(qrUrl)}" alt="UPI QR Code" style="border-radius: 8px; border: 1px solid #ccc; padding: 5px; background: #fff; max-width: 150px; display: inline-block;" />
                    </div>`;
                }
                if (transferSec) transferSec.style.display = 'block';
                if (setupSec) setupSec.style.display = 'none';
            } else {
                if (statusBox) {
                    statusBox.innerHTML = `<div style="background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 12px;">
                        <p style="font-size: 12px; color: #991b1b;">UPI Status</p><h4>Not Registered</h4>
                    </div>`;
                }
                if (transferSec) transferSec.style.display = 'none';
                if (setupSec) setupSec.style.display = 'block';
            }
        }
    } catch (e) { console.error('UPI Status Check Failed', e); }
}

/* ── QR Scanner Logic ── */
let html5QrCode = null;
let currentFacingMode = "environment"; // Default to back camera

async function openQrScanner() {
    const modal = document.getElementById('qrScannerModal');
    if (modal) modal.style.display = 'flex';

    if (!html5QrCode) {
        html5QrCode = new Html5Qrcode("qr-reader");
    }

    startCamera(currentFacingMode);
}

function startCamera(facingMode) {
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    
    html5QrCode.start(
        { facingMode: facingMode },
        config,
        (decodedText) => {
            handleQrCodeSuccess(decodedText);
        },
        (errorMessage) => {
            // parse error, ignore
        }
    ).catch((err) => {
        console.error("Unable to start camera", err);
        showMobileToast("Camera access denied or not found", "error");
    });
}

function handleQrCodeSuccess(decodedText) {
    let vpa = decodedText;
    if (vpa.startsWith('upi://')) {
        try {
            const url = new URL(vpa);
            vpa = url.searchParams.get('pa') || vpa;
        } catch (e) { /* ignore url parse error */ }
    }

    closeQrScanner();
    showUpiPage();

    setTimeout(() => {
        const targetVpaInput = document.getElementById('targetVpa');
        if (targetVpaInput) {
            targetVpaInput.value = vpa;
            targetVpaInput.focus();
        } else {
            showMobileToast('Scanned: ' + vpa, 'success');
        }
    }, 500);
}

async function switchCamera() {
    if (html5QrCode && html5QrCode.getState() === 2) { // 2 = SCANNING
        await html5QrCode.stop();
        currentFacingMode = currentFacingMode === "environment" ? "user" : "environment";
        startCamera(currentFacingMode);
    }
}

async function scanFromGalleryByFile(event) {
    if (event.target.files.length === 0) return;
    const imageFile = event.target.files[0];

    if (!html5QrCode) {
        html5QrCode = new Html5Qrcode("qr-reader");
    }

    // If camera is running, stop it first
    if (html5QrCode.getState() === 2) {
        await html5QrCode.stop();
    }

    showMobileToast("Processing image...", "info");

    html5QrCode.scanFile(imageFile, true)
        .then(decodedText => {
            handleQrCodeSuccess(decodedText);
        })
        .catch(err => {
            console.error("Gallery scan error", err);
            showMobileToast("No QR code found in image", "error");
            // Restart camera after failure if modal is still open
            const modal = document.getElementById('qrScannerModal');
            if (modal && modal.style.display === 'flex') {
                startCamera(currentFacingMode);
            }
        });
    
    // Reset input
    event.target.value = '';
}

async function closeQrScanner() {
    const modal = document.getElementById('qrScannerModal');
    if (modal) modal.style.display = 'none';

    if (html5QrCode) {
        if (html5QrCode.getState() === 2) {
            try {
                await html5QrCode.stop();
            } catch (e) {
                console.error("Scanner stop error", e);
            }
        }
    }
}

/* ════════════════════════════════════════════════════════════
   CHANGE UPI PIN LOGIC
   ════════════════════════════════════════════════════════════ */
function openChangeUpiPinModal() {
    const modal = document.getElementById('changeUpiPinModal');
    if (modal) modal.style.display = 'flex';
    document.getElementById('upiPinOtpState').style.display = 'block';
    document.getElementById('upiPinVerifyState').style.display = 'none';
    document.getElementById('upiChangeOtpInput').value = '';
    document.getElementById('upiChangeNewPinInput').value = '';
}

function closeChangeUpiPinModal() {
    const modal = document.getElementById('changeUpiPinModal');
    if (modal) modal.style.display = 'none';
}

async function requestUpiPinChangeOtp() {
    const btn = document.getElementById('btnRequestUpiOtp');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending OTP...';
    
    try {
        const response = await fetch(`${API}/user/upi/change-pin/request-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });
        const data = await response.json();
        if (response.ok) {
            showMobileToast('OTP sent to your registered email!', 'success');
            document.getElementById('upiPinOtpState').style.display = 'none';
            document.getElementById('upiPinVerifyState').style.display = 'block';
        } else {
            showMobileToast(data.error || 'Failed to send OTP', 'error');
        }
    } catch (err) {
        showMobileToast('Connection error', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

async function submitUpiPinChange() {
    const otp = document.getElementById('upiChangeOtpInput').value;
    const newPin = document.getElementById('upiChangeNewPinInput').value;
    
    if (!otp || otp.length !== 6) {
        return showMobileToast('Please enter the 6-digit OTP', 'warning');
    }
    if (!newPin || newPin.length !== 6) {
        return showMobileToast('New PIN must be exactly 6 digits', 'warning');
    }
    
    const btn = document.getElementById('btnVerifyUpiOtp');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';
    
    try {
        const response = await fetch(`${API}/user/upi/change-pin/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ otp: otp, new_pin: newPin })
        });
        const data = await response.json();
        
        if (response.ok) {
            showMobileToast('UPI PIN successfully updated!', 'success');
            closeChangeUpiPinModal();
        } else {
            showMobileToast(data.error || 'Failed to change PIN', 'error');
        }
    } catch (err) {
        showMobileToast('Connection error', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

async function handleUpiSetup() {
    const pin = document.getElementById('newUpiPin').value;
    if (pin.length !== 6) return showMobileToast('PIN must be 6 digits', 'warning');

    try {
        const r = await fetch(`${API}/user/upi/setup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ upi_pin: pin })
        });
        if (r.ok) {
            showMobileToast('UPI Enabled Successfully!', 'success');
            await checkUpiStatus();
        } else {
            const d = await r.json();
            showMobileToast(d.error || 'Setup failed', 'error');
        }
    } catch (e) { showMobileToast('Connection error', 'error'); }
}

async function handleUpiTransfer() {
    const vpa = document.getElementById('targetVpa').value;
    const amt = document.getElementById('upiAmount').value;
    const pin = document.getElementById('upiPin').value;

    if (!vpa || !amt || !pin) return showMobileToast('All fields required', 'warning');

    try {
        const r = await fetch(`${API}/user/upi/pay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ 
                target_vpa: vpa, 
                amount: parseFloat(amt), 
                upi_pin: pin,
                currency: document.getElementById('upiCurrency')?.value || 'INR'
            })
        });
        const d = await r.json();
        if (r.ok && d.success) {
            showMobileToast(`Payment Successful! Ref: ${d.reference}`, 'success');
            document.getElementById('upiAmount').value = '';
            document.getElementById('upiPin').value = '';
            await loadDashboardData();
            switchTab('dashboard');
        } else {
            showMobileToast(d.error || 'Transfer failed', 'error');
        }
    } catch (e) { showMobileToast('Connection error', 'error'); }
}

/* ── UI Transitions (Consolidated with Mobile Navigation above) ── */

function showOffersPage() {
    logMobileActivity('Viewed Offers', 'Opened the exclusive offers page');
    switchTab('offers');
}

function showLocationsPage() {
    logMobileActivity('Viewed Locations', 'Opened nearby branch locator');
    switchTab('locations');
}

function showUpiPage() {
    if (!window._accounts || window._accounts.length === 0) {
        return showMobileToast("Please open a bank account first to use UPI.", "info");
    }
    switchTab('upi');
    checkUpiStatus();
}

function showTransferPage() {
    if (!window._accounts || window._accounts.length === 0) {
        return showMobileToast("Please open a bank account first to transfer money.", "info");
    }
    switchTab('transfer');
}

async function handleInternalTransfer() {
    const acc = document.getElementById('transferAcc').value;
    const amt = document.getElementById('transferAmount').value;
    const remark = document.getElementById('transferRemarks').value;

    if (!acc || !amt) return showMobileToast('Account and Amount are required', 'warning');
    if (!window._primaryAccount) return showMobileToast('Source account not loaded. Please refresh.', 'error');

    try {
        const r = await fetch(`${API}/user/transfer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                from_account: window._primaryAccount.id,
                to_account: acc,
                amount: parseFloat(amt),
                remarks: remark
            })
        });
        const d = await r.json();
        if (r.ok) {
            showMobileToast(`Transfer Successful! Ref: ${d.reference}`, 'success');
            await loadDashboardData();
            switchTab('dashboard');
        } else {
            showMobileToast(d.error || 'Transfer failed', 'error');
        }
    } catch (e) { showMobileToast('Connection error', 'error'); }
}

let currentBillerCategory = '';

function showBillPayPage(category) {
    if (!window._accounts || window._accounts.length === 0) {
        return showMobileToast("Please open a bank account first to proceed.", "info");
    }
    currentBillerCategory = category;

    if (category === 'UPI Pay') return showUpiPage();
    if (category === 'Self Transfer') return showTransferPage();
    if (category === 'Personal Loan') return showApplicationModal('Personal Loan');

    switchTab('billPay');
    document.getElementById('billPayTitle').textContent = category;
    document.getElementById('consumerIdLabel').textContent = category + ' Number';
    document.getElementById('billDetailsGroup').style.display = 'none';
    document.getElementById('billerInputGroup').style.display = 'block';
    document.getElementById('billConsumerId').value = '';
}

function fetchMockBill() {
    const cid = document.getElementById('billConsumerId').value;
    if (!cid) return showMobileToast('Please enter consumer number', 'warning');

    // Simulate BBPS Bill Fetch
    const billers = {
        'LPG Gas': ['Indane Gas', 'HP Gas', 'Bharat Gas'],
        'Electricity': ['BESCOM', 'PSPCL', 'TATA Power'],
        'DTH Recharge': ['Tata Play', 'Airtel DTH', 'Dish TV'],
        'Fastag': ['Paytm Fastag', 'ICICI Fastag', 'HDFC Fastag'],
        'Mobile Prepaid': ['JIO Prepaid', 'Airtel Prepaid', 'Vi Prepaid']
    };

    const list = billers[currentBillerCategory] || ['Generic Biller'];
    const chosen = list[Math.floor(Math.random() * list.length)];
    const mockAmt = (Math.random() * (2000 - 100) + 100).toFixed(2);

    document.getElementById('billBillerName').textContent = chosen;
    document.getElementById('billDueDate').textContent = '15 Mar 2026';
    document.getElementById('billAmountDue').textContent = '₹' + mockAmt;

    document.getElementById('billerInputGroup').style.display = 'none';
    document.getElementById('billDetailsGroup').style.display = 'block';

    // Store for payment
    window._pendingBill = { biller: chosen, amount: mockAmt, category: currentBillerCategory, cid: cid };
}

async function handleBillPayment() {
    const bill = window._pendingBill;
    if (!bill) return;

    try {
        const r = await fetch(`${API}/mobile/billpay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                biller: bill.biller,
                consumer_id: bill.cid,
                amount: bill.amount,
                category: bill.category
            })
        });
        const d = await r.json();
        if (r.ok) {
            showMobileToast(`Bill Paid Successfully! Ref: ${d.reference}`, 'success');
            await loadDashboardData();
            switchTab('dashboard');
        } else {
            showMobileToast(d.error || 'Payment failed', 'error');
        }
    } catch (e) { showMobileToast('Connection error', 'error'); }
}


async function showPasscodeSetup() {
    // Check if balance PIN already set — if so redirect to change
    if (_passcodeEnabled === null) await checkPasscodeStatus();
    if (_passcodeEnabled) {
        showMobileToast('Balance PIN already set. Use "Change Balance PIN" to update.', 'info');
        return;
    }
    // Show the setup via the PIN numpad modal (one-time setup)
    openPinModal();
}

function closePasscodeModal() {
    document.getElementById('passcodeModal').style.display = 'none';
}

async function savePasscode() {
    const pc = document.getElementById('newPasscode').value;
    if (pc.length !== 4) return showMobileToast('Passcode must be 4 digits', 'warning');

    try {
        const r = await fetch(`${API}/auth/mobile/setup-passcode`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ passcode: pc })
        });
        const d = await r.json();
        if (r.ok) {
            _passcodeEnabled = true;
            localStorage.setItem('bank_mobile_passcode', pc); // Still keep for UI detection
            showMobileToast('Balance PIN set successfully! ✅', 'success');
            closePasscodeModal();
        } else {
            showMobileToast(d.error || 'Setup failed', 'error');
        }
    } catch (e) {
        showMobileToast('Connection error. Passcode not saved.', 'error');
    }
}

/* ── Signup & Forgot Password ── */
async function handleMobileSignup(e) {
    if (e) e.preventDefault();
    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const phone = document.getElementById('signupPhone').value.trim();
    const username = document.getElementById('signupUsername').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('signupConfirmPassword').value;

    if (!name || !email || !phone || !username || !password) {
        return showMobileToast('Please fill all required fields', 'warning');
    }

    if (!password || !/^[A-Z]/.test(password)) {
        return showMobileToast('Password must start with an uppercase letter', 'warning');
    }

    if (password !== confirmPassword) return showMobileToast('Passwords do not match', 'warning');

    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

    try {
        const deviceType = window.SmartBankDeviceDetector ? window.SmartBankDeviceDetector.getDeviceType() : 'mobile';
        const r = await fetch(`${API}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name, email, phone, username, password, device_type: deviceType })
        });
        const d = await r.json();
        if (r.ok) {
            window._tempSignupUsername = username; // Store for OTP verification
            showMobileToast('Account created! Please verify your email.', 'success');
            
            // Show OTP Modal
            const modal = document.getElementById('otpModal');
            if (modal) {
                modal.style.display = 'flex';
                // Hide signup form container
                const container = document.querySelector('.auth-container-modern') || document.querySelector('.auth-container');
                if (container) container.style.display = 'none';
            }
        } else {
            showMobileToast(d.error || 'Signup failed', 'error');
        }
    } catch (err) {
        console.error('Signup Error:', err);
        showMobileToast('Server connection error', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Create Account';
    }
}

function moveOtpFocus(current, nextId) {
    if (current.value.length === 1) {
        const next = document.getElementById(nextId);
        if (next) next.focus();
    }
}

async function handleMobileVerifyOtp() {
    const username = window._tempSignupUsername;
    if (!username) return showMobileToast('Session expired. Please signup again.', 'error');

    const email_otp = document.getElementById('email_otp').value.trim();

    if (email_otp.length !== 6) {
        return showMobileToast('Please enter the 6-digit verification code', 'warning');
    }

    const btn = document.getElementById('btnVerifyOtp');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Activating...';

    try {
        const r = await fetch(`${API}/auth/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, email_otp })
        });
        const d = await r.json();
        if (r.ok) {
            showMobileToast('Account activated! You can now login. ✅', 'success');
            setTimeout(() => { window.location.href = 'mobile-auth.html'; }, 2000);
        } else {
            showMobileToast(d.error || 'Verification failed', 'error');
        }
    } catch (e) {
        showMobileToast('Connection error during verification', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'CONFIRM & ACTIVATE <i class="fas fa-arrow-right"></i>';
    }
}

async function handleMobileResendOtp() {
    const username = window._tempSignupUsername;
    if (!username) return showMobileToast('Session expired. Please signup again.', 'error');

    try {
        const r = await fetch(`${API}/auth/resend-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username })
        });
        const d = await r.json();
        if (r.ok) {
            if (d.dev_otp) {
                const eInput = document.getElementById('email_otp');
                if (eInput) eInput.value = d.dev_otp;
                showMobileToast(`[DEV/RENDER] New OTP Auto-filled: ${d.dev_otp}`, 'success');
            } else {
                showMobileToast('New verification code sent to your email! 📧', 'success');
                const eInput = document.getElementById('email_otp');
                if (eInput) eInput.value = '';
            }
        } else {
            showMobileToast(d.error || 'Resend failed', 'error');
        }
    } catch (e) {
        showMobileToast('Connection error during resend', 'error');
    }
}

async function handleMobileForgot(e) {
    e.preventDefault();
    const email = document.getElementById('forgotEmail').value;
    const btn = e.target.querySelector('button');

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

    try {
        const r = await fetch(`${API}/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email })
        });
        const d = await r.json();
        if (r.ok) {
            showMobileToast(d.message || 'Password reset link sent to your email! ✅', 'success');
            setTimeout(() => { window.location.href = 'mobile-auth.html'; }, 2000);
        } else {
            showMobileToast(d.error || 'Reset request failed', 'error');
        }
    } catch (err) {
        showMobileToast('Server connection error', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Send Reset Link';
    }
}

/* ── Activity Tracker ── */
async function logMobileActivity(action, details = '') {
    try {
        await fetch(`${API}/user/log-activity`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ action, details })
        });
    } catch (e) {
        // Fallback silently if tracking fails
        console.warn('Activity tracking failed:', e);
    }
}

async function handleProfileClick(action, alertMsg) {
    await logMobileActivity(action, 'Triggered from mobile profile settings');
    if (alertMsg) showMobileToast(alertMsg, 'info');
}

function handleResetPassword() {
    logMobileActivity('Clicked Reset Password', 'Initiated password reset');

    // Premium confirmation
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content" style="text-align:center; padding:30px 24px;">
            <div style="width:60px; height:60px; background:#eff6ff; color:#3b82f6; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 20px; font-size:24px;">
                <i class="fas fa-envelope-open-text"></i>
            </div>
            <h3 style="margin:0 0 10px;">Check Your Email</h3>
            <p style="color:#64748b; font-size:14px; margin-bottom:25px; line-height:1.5;">We've sent a secure password reset link to your registered email address. Please follow the instructions to reset your passcode.</p>
            <button onclick="this.closest('.modal-overlay').remove()" class="btn-primary-maroon" style="width:100%;">Understood</button>
        </div>
    `;
    document.body.appendChild(modal);
}

function handleManageKYC() {
    logMobileActivity('Clicked Manage KYC', 'Checked KYC status');
    if (window._accounts && window._accounts.length > 0) {
        showMobileToast('Your KYC is verified and active. ✅', 'success');
    } else {
        showMobileToast('Please open an account to complete KYC.', 'info');
        showAccountModal();
    }
}

function handleDeactivate() {
    logMobileActivity('Clicked Deactivate', 'Initiated deactivation flow');

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content" style="text-align:center; padding:30px 24px;">
            <div style="width:60px; height:60px; background:#fef2f2; color:#ef4444; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 20px; font-size:24px;">
                <i class="fas fa-exclamation-triangle"></i>
            </div>
            <h3 style="margin:0 0 10px;">Security Requirement</h3>
            <p style="color:#64748b; font-size:14px; margin-bottom:20px; line-height:1.5;">To protect your funds, account deactivation requires a physical visit to your base branch with original KYC documents.</p>
            <div style="background:#f8fafc; padding:15px; border-radius:12px; margin-bottom:25px; text-align:left; border:1px solid #e2e8f0;">
                <p style="margin:0; font-size:12px; color:#475569; font-weight:700;"><i class="fas fa-info-circle"></i> What to bring:</p>
                <ul style="margin:8px 0 0; padding-left:20px; font-size:12px; color:#64748b;">
                    <li>Original Aadhaar Card</li>
                    <li>Original PAN Card</li>
                    <li>Unused Checkbook</li>
                </ul>
            </div>
            <div style="display:flex; gap:10px;">
                <button onclick="this.closest('.modal-overlay').remove()" class="btn-secondary" style="flex:1;">Cancel</button>
                <button onclick="this.closest('.modal-overlay').remove(); showLocationsPage();" class="btn-primary-maroon" style="flex:1;">Find Branch</button>
            </div>
        </div>
    `;
    const wrapper = document.querySelector('.mobile-wrapper') || document.body;
    wrapper.appendChild(modal);
}

function handleOffers() {
    handleProfileClick('Viewed Offers tab', 'Featured Offers: Earn 5x points on dining!');
}

function handleMoreDetails() {
    handleProfileClick('Viewed More tab', 'Financial Reports, Card Controls, and Support available in More.');
}

async function handleLanguageClick(e) {
    if (e) e.stopPropagation();
    if (window.openLanguageMenu) {
        window.openLanguageMenu();
        logMobileActivity('Opened Language Menu', 'User accessed language settings from Profile/More');
    } else {
        showMobileToast('Language settings loading...', 'info');
    }
}


/* ── Notifications ── */
function updateMobileNotifBadge() {
    const badge = document.getElementById('mobileNotifBadge');
    if (!badge) return;
    const unreadCount = window._notifications.filter(n => !n.is_read).length;
    if (unreadCount > 0) {
        badge.textContent = unreadCount;
        badge.style.display = 'block';
    } else {
        badge.style.display = 'none';
    }
}

function toggleMobileNotifications() {
    const modal = document.getElementById('mobileNotifModal');
    if (!modal) return;

    if (modal.style.display === 'flex') {
        modal.style.display = 'none';
        return;
    }

    const list = document.getElementById('mobileNotifList');
    list.innerHTML = '';

    if (!window._notifications || window._notifications.length === 0) {
        list.innerHTML = '<p style="text-align:center; color: var(--text-grey);">No new notifications</p>';
    } else {
        window._notifications.forEach(n => {
            const div = document.createElement('div');
            div.style.padding = '12px';
            div.style.borderBottom = '1px solid #eee';
            div.style.marginBottom = '8px';
            div.style.borderRadius = '8px';
            div.style.background = n.is_read ? '#fff' : '#f0fdf4';

            div.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:5px;">
                    <strong style="color:var(--primary-maroon);font-size:14px;">${escHtml(n.title)}</strong>
                    <small style="color:var(--text-grey);font-size:10px;">${new Date(n.created_at).toLocaleDateString()}</small>
                </div>
            <p style="margin: 0 0 10px 0; font-size: 13px; color: var(--text-main);">${escHtml(n.message)}</p>
                ${!n.is_read ? '<button onclick="markMobileNotifRead(' + n.id + ')" style="background:none; border:none; color: var(--accent-gold); font-size: 12px; font-weight: bold; padding: 0; cursor: pointer;">Mark as Read</button>' : ''}
        `;
            list.appendChild(div);
        });
    }

    modal.style.display = 'flex';
}

async function markMobileNotifRead(id) {
    try {
        const r = await fetch(`${API}/user/notifications/mark_read/${id}`, {
            method: 'POST',
            credentials: 'include'
        });
        if (r.ok) {
            await loadDashboardData();
            toggleMobileNotifications(); // close
            toggleMobileNotifications(); // re-open to re-render
        }
    } catch (e) {
        console.error('Failed to mark notification read', e);
    }
}

// ── Transaction History Logic ── //
async function loadMobileTransactions() {
    logMobileActivity('Viewed Transaction History', 'Viewed full transaction log');
    const container = document.getElementById('mobileTransactionList');
    if (!container) return;

    container.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <i class="fas fa-spinner fa-spin" style="font-size: 24px; color: var(--primary-maroon);"></i>
        </div>
    `;

    try {
        const r = await fetch(`${API}/user/transactions`, { credentials: 'include' });
        if (r.ok) {
            const data = await r.json();
            const txns = data.transactions || [];

            if (txns.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 30px; background: #f9fafb; border-radius: 12px; border: 1px dashed #e5e7eb;">
                        <i class="fas fa-receipt" style="font-size: 32px; color: #9ca3af; margin-bottom: 10px;"></i>
                        <h4 style="margin: 0; color: #4b5563;">No Transactions Yet</h4>
                        <p style="font-size: 12px; color: #6b7280; margin-top: 5px;">Your account activity will appear here.</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = txns.map(t => {
                const isDebit = t.type === 'debit';
                // USER REQUEST: Credit Green, Debit Red
                const sign = isDebit ? '-' : '+';
                const color = isDebit ? '#ef4444' : '#10b981'; // Debit: Red, Credit: Green
                const icon = isDebit ? 'fa-arrow-up' : 'fa-arrow-down';
                const bg = isDebit ? '#fef2f2' : '#ecfdf5';

                const dateObj = t.transaction_date ? new Date(t.transaction_date) : null;
                const date = dateObj ? dateObj.toLocaleDateString('en-IN', {
                    day: '2-digit', month: 'short', year: 'numeric'
                }) : 'Unknown Date';

                return `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 18px; background: #fff; border-radius: 14px; margin-bottom: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03); border: 1px solid #f3f4f6; transition: transform 0.2s ease;">
                        <div style="display: flex; align-items: center; gap: 14px;">
                            <div style="width: 44px; height: 44px; border-radius: 12px; background: ${bg}; color: ${color}; display: flex; align-items: center; justify-content: center; font-size: 16px;">
                                <i class="fas ${icon}"></i>
                            </div>
                            <div>
                                <div style="font-weight: 700; color: #111827; font-size: 15px; letter-spacing: -0.2px;">${escHtml(t.description || t.type.toUpperCase())}</div>
                                <div style="font-size: 12px; color: #6b7280; margin-top: 3px; display: flex; align-items: center; gap: 6px;">
                                    <span>${escHtml(date)}</span>
                                    <span style="width: 3px; height: 3px; background: #d1d5db; border-radius: 50%;"></span>
                                    <span>A/C ...${escHtml((t.account_number || '').slice(-4))}</span>
                                </div>
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-weight: 800; color: ${color}; font-size: 16px; letter-spacing: -0.3px;">
                                ${sign}₹${Number(t.amount).toLocaleString('en-IN')}
                            </div>
                            <div style="display: inline-block; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; padding: 2px 8px; border-radius: 6px; margin-top: 6px; background: ${t.status === 'completed' ? '#d1fae5' : '#fef3c7'}; color: ${t.status === 'completed' ? '#065f46' : '#92400e'};">
                                ${escHtml(t.status === 'completed' ? 'Success' : (t.status || 'Pending'))}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            container.innerHTML = '<p style="text-align: center; color: #ef4444; padding: 20px;">Failed to load transactions.</p>';
        }
    } catch (e) {
        console.error('Error fetching mobile transactions:', e);
        container.innerHTML = '<p style="text-align: center; color: #ef4444; padding: 20px;">Connection error while loading transactions.</p>';
    }
}

// ── Support and FAQ Logic ── //
function showFAQPage() {
    logMobileActivity('Viewed FAQs', 'Opened the FAQ page');
    switchTab('faq');
}

function showSupportPage() {
    logMobileActivity('Opened Support Form', 'Opened the ticket submission page');

    // Clear previous form data
    const subjectEl = document.getElementById('supportSubject');
    const messageEl = document.getElementById('supportMessage');
    const errorEl = document.getElementById('supportError');
    const priorityRadios = document.querySelectorAll('input[name="supportPriority"]');

    if (subjectEl) subjectEl.value = '';
    if (messageEl) messageEl.value = '';
    if (errorEl) errorEl.style.display = 'none';

    // Reset priority to normal
    priorityRadios.forEach(r => {
        if (r.value === 'normal') r.checked = true;
    });

    switchTab('support');
}

async function submitSupportTicket() {
    const subject = document.getElementById('supportSubject').value;
    const message = document.getElementById('supportMessage').value;
    let priority = 'normal';

    document.querySelectorAll('input[name="supportPriority"]').forEach(r => {
        if (r.checked) priority = r.value;
    });

    const errorEl = document.getElementById('supportError');
    const btn = document.getElementById('supportSubmitBtn');

    if (!subject || !message) {
        errorEl.textContent = 'Please select a subject and enter a message.';
        errorEl.style.display = 'block';
        return;
    }

    errorEl.style.display = 'none';
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

    try {
        const payload = { subject, message, priority };
        const r = await fetch(`${API}/user/support`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
        });

        const d = await r.json();

        if (r.ok) {
            logMobileActivity('Submitted Support Ticket', `Subject: ${subject}, Priority: ${priority}`);
            showMobileToast('Support ticket submitted successfully! We will contact you soon. ✅', 'success');
            switchTab('more');
        } else {
            errorEl.textContent = d.error || 'Failed to submit ticket.';
            errorEl.style.display = 'block';
        }
    } catch (error) {
        console.error("Support submission error:", error);
        errorEl.textContent = 'Connection error. Please try again.';
        errorEl.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Submit Ticket';
    }
}

/* ── Mobile Sidebar Menu ── */
function openMobileMenu() {
    const sidebar = document.getElementById('mobileSidebar');
    if (sidebar) {
        sidebar.style.display = 'flex';
        // Small delay to allow display:flex to apply before CSS transition happens
        setTimeout(() => {
            const content = sidebar.querySelector('.sidebar-content');
            if (content) content.classList.add('open');
            const emailSpan = document.getElementById('sidebarUserEmail');
            if (emailSpan && window.currentUser) {
                emailSpan.textContent = window.currentUser.email || 'Smart Banking System';
            }
        }, 10);
    }
}

function closeMobileMenu() {
    const sidebar = document.getElementById('mobileSidebar');
    if (sidebar) {
        const content = sidebar.querySelector('.sidebar-content');
        if (content) content.classList.remove('open');
        // Wait for sliding transition to finish before hiding wrapper
        setTimeout(() => {
            sidebar.style.display = 'none';
        }, 300);
    }
}

/**
 * Mobile Screenshot & Privacy Protection
 */
// Security handlers removed to prevent blur/alert issues
// function handlers_disabled() {
//     // Disabled
// }

/**
 * Premium Mobile Toast Notifications
 */
function showMobileToast(message, type = 'info') {
    let container = document.getElementById('mobileToastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'mobileToastContainer';
        const wrapper = document.querySelector('.mobile-wrapper') || document.body;
        wrapper.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `mobile-toast ${type}`;
    
    // Icon mapping
    const icons = {
        'success': 'fa-check-circle',
        'error': 'fa-exclamation-circle',
        'info': 'fa-info-circle',
        'warning': 'fa-exclamation-triangle'
    };
    
    const icon = icons[type] || icons.info;
    const duration = 4000;

    toast.innerHTML = `
        <i class="fas ${icon}" style="font-size: 18px;"></i>
        <div style="flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${message}</div>
        <div class="toast-progress">
            <div class="toast-progress-fill" style="width: 100%; transition: width ${duration}ms linear;"></div>
        </div>
    `;

    container.appendChild(toast);

    // Start progress bar animation after a tiny delay
    setTimeout(() => {
        const fill = toast.querySelector('.toast-progress-fill');
        if (fill) fill.style.width = '0%';
    }, 10);

    // Auto-remove
    setTimeout(() => {
        toast.style.animation = 'toastOut 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards';
        setTimeout(() => toast.remove(), 400);
    }, duration);
}

// Global Error Handler for Mobile
window.onerror = function(message, source, lineno, colno, error) {
    console.error('Global Error:', message, error);
    if (typeof showMobileToast === 'function') {
        // Only show toast for actual script errors, not network ones (handled by fetch interceptor)
        if (!message.includes('Script error.') && !message.includes('fetch')) {
            showMobileToast('A system error occurred. Reverting to safe state.', 'error');
        }
    }
    return false;
};

/* ── Password Visibility Toggle ── */
function togglePasswordVisibility() {
    const passwordInput = document.getElementById('password');
    const toggleIcon = document.getElementById('togglePassword');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleIcon.classList.remove('fa-eye-slash');
        toggleIcon.classList.add('fa-eye');
    } else {
        passwordInput.type = 'password';
        toggleIcon.classList.remove('fa-eye');
        toggleIcon.classList.add('fa-eye-slash');
    }
}

// Also handle passcode visibility if needed
function togglePasscodeVisibility() {
    const passcodeInput = document.getElementById('passcode');
    // Assuming we might add a toggle for passcode too, but for now just password
    if (passcodeInput.type === 'password') {
        passcodeInput.type = 'text';
    } else {
        passcodeInput.type = 'password';
    }
}
/* ── New Features: Beneficiaries, Pockets, Support ── */

async function loadBeneficiaries() {
    try {
        const r = await fetch(`${API}/user/beneficiaries`, { credentials: 'include' });
        if (r.ok) {
            window._beneficiaries = await r.json();
            renderBeneficiaries();
        }
    } catch (e) { console.error('Load Beneficiaries Failed', e); }
}

function renderBeneficiaries() {
    const list = document.getElementById('mobileBeneficiaryList');
    if (!list) return;
    
    if (!window._beneficiaries || window._beneficiaries.length === 0) {
        list.innerHTML = `
            <div style="text-align:center; padding:40px 20px; background:#f8fafc; border-radius:16px;">
                <i class="fas fa-users-slash" style="font-size:32px; color:#cbd5e1; margin-bottom:12px;"></i>
                <p style="color:#64748b; font-size:14px;">No pyees saved yet.</p>
            </div>`;
        return;
    }

    list.innerHTML = window._beneficiaries.map(b => `
        <div class="account-card" style="padding:16px; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <div style="font-weight:700; color:var(--text-dark);">${escHtml(b.name)}</div>
                <div style="font-size:12px; color:var(--text-grey);">${escHtml(b.account_number)} • ${escHtml(b.nickname || 'General')}</div>
            </div>
            <button onclick="deleteBeneficiaryMobile(${b.id})" style="background:none; border:none; color:#ef4444; padding:8px;">
                <i class="fas fa-trash-alt"></i>
            </button>
        </div>
    `).join('');
}

async function loadPockets() {
    try {
        const r = await fetch(`${API}/user/savings-goals`, { credentials: 'include' });
        if (r.ok) {
            window._pockets = await r.json();
            renderPockets();
        }
    } catch (e) { console.error('Load Pockets Failed', e); }
}

function renderPockets() {
    const list = document.getElementById('mobilePocketList');
    if (!list) return;

    if (!window._pockets || window._pockets.length === 0) {
        list.innerHTML = `
            <div style="text-align:center; padding:40px 20px; background:#f8fafc; border-radius:16px;">
                <i class="fas fa-piggy-bank" style="font-size:32px; color:#cbd5e1; margin-bottom:12px;"></i>
                <p style="color:#64748b; font-size:14px;">Start saving for your goals.</p>
            </div>`;
        return;
    }

    list.innerHTML = window._pockets.map(p => {
        const progress = Math.min(100, (p.current_amount / p.target_amount) * 100);
        return `
        <div class="account-card" style="padding:16px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
                <div>
                    <div style="font-weight:800; color:var(--text-dark);">${escHtml(p.name)}</div>
                    <div style="font-size:12px; color:var(--text-grey);">Target: ₹${p.target_amount.toLocaleString()}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-weight:800; color:var(--primary-maroon);">₹${p.current_amount.toLocaleString()}</div>
                    <div style="font-size:11px; color:#059669; font-weight:700;">${Math.round(progress)}% Goal</div>
                </div>
            </div>
            <div style="height:6px; background:#f1f5f9; border-radius:3px; overflow:hidden;">
                <div style="height:100%; width:${progress}%; background:var(--primary-maroon); border-radius:3px;"></div>
            </div>
            <div style="margin-top:12px; display:flex; gap:8px;">
                <button onclick="updatePocketMobile(${p.id})" style="flex:1; padding:8px; border-radius:10px; border:none; background:var(--primary-maroon); color:white; font-size:12px; font-weight:700;">Add Funds</button>
                <button onclick="breakPocketMobile(${p.id})" style="padding:8px; border-radius:10px; border:1px solid #ddd; background:white; color:#6b7280; font-size:12px;"><i class="fas fa-times"></i></button>
            </div>
        </div>
    `;}).join('');
}

async function handleMobileStatementDownload() {
    showMobileToast('Generating PDF statement...', 'info');
    try {
        const response = await fetch(`${API}/user/statements/download/current`, { credentials: 'include' });
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Statement_${new Date().toLocaleDateString()}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            showMobileToast('Download started', 'success');
        } else {
            showMobileToast('Download failed', 'error');
        }
    } catch (e) {
        showMobileToast('Network error', 'error');
    }
}

// Ensure loadDashboardData also loads these
const originalLoadDashboardData = window.loadDashboardData;
window.loadDashboardData = async function() {
    await originalLoadDashboardData();
    loadBeneficiaries();
    loadPockets();
};

/* ── UI Helpers ── */
function showAddBeneficiaryModal() {
    showConfirmMobile({
        title: 'Add New Payee',
        message: `
            <div class="form-group" style="text-align:left;">
                <label class="form-label">Full Name</label>
                <input id="newBenName" class="form-input" placeholder="e.g. John Doe">
                <label class="form-label" style="margin-top:10px;">Account Number</label>
                <input id="newBenAcc" class="form-input" placeholder="SB000...">
                <label class="form-label" style="margin-top:10px;">Nickname (Optional)</label>
                <input id="newBenNick" class="form-input" placeholder="e.g. Home">
            </div>`,
        confirmText: 'Save Payee',
        onConfirm: async () => {
            const name = document.getElementById('newBenName').value;
            const acc = document.getElementById('newBenAcc').value;
            if(!name || !acc) return showMobileToast('Please fill required fields', 'error');
            
            try {
                const r = await fetch(`${API}/user/beneficiaries`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ name, account_number: acc, nickname: document.getElementById('newBenNick').value })
                });
                if(r.ok) {
                    showMobileToast('Payee added successfully', 'success');
                    loadBeneficiaries();
                }
            } catch (e) { showMobileToast('Failed to save payee', 'error'); }
        }
    });
}

function showAddPocketModal() {
    showConfirmMobile({
        title: 'New Savings Goal',
        message: `
            <div class="form-group" style="text-align:left;">
                <label class="form-label">Goal Name</label>
                <input id="newGoalName" class="form-input" placeholder="e.g. New Car">
                <label class="form-label" style="margin-top:10px;">Target Amount (₹)</label>
                <input id="newGoalTarget" type="number" class="form-input" placeholder="e.g. 500000">
            </div>`,
        confirmText: 'Create Pocket',
        onConfirm: async () => {
            const name = document.getElementById('newGoalName').value;
            const target = document.getElementById('newGoalTarget').value;
            if(!name || !target) return showMobileToast('Please fill all fields', 'error');
            
            try {
                const r = await fetch(`${API}/user/savings-goals`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ name, target_amount: target })
                });
                if(r.ok) {
                    showMobileToast('Savings goal created!', 'success');
                    loadPockets();
                }
            } catch (e) { showMobileToast('Failed to create goal', 'error'); }
        }
    });
}

async function deleteBeneficiaryMobile(id) {
    if(!(await confirm('Delete this saved payee?'))) return;
    try {
        const r = await fetch(`${API}/user/beneficiaries/${id}`, { method: 'DELETE', credentials: 'include' });
        if(r.ok) {
            showMobileToast('Payee removed', 'success');
            loadBeneficiaries();
        }
    } catch (e) { showMobileToast('Error deleting payee', 'error'); }
}

async function updatePocketMobile(id) {
    const amt = await prompt('Amount to add to this pocket (₹):');
    if(!amt || amt <= 0) return;
    
    try {
        const r = await fetch(`${API}/user/savings-goals/${id}/add-funds`, {
            method: 'POST',
            credentials: 'include',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ amount: amt })
        });
        if(r.ok) {
            showMobileToast(`₹${amt} added to pocket`, 'success');
            loadPockets();
        }
    } catch (e) { showMobileToast('Error updating pocket', 'error'); }
}

function breakPocketMobile(id) {
    showMobileToast('Release funds feature coming soon!', 'info');
}

// Custom confirm for mobile
function showConfirmMobile({title, message, confirmText, onConfirm, onCancel, isHtml}) {
    const modal = document.createElement('div');
    modal.className = 'mobile-sidebar-modern-overlay'; // Reusing premium overlay
    modal.style.position = 'fixed';
    modal.style.inset = '0';
    modal.style.background = 'rgba(0,0,0,0.5)';
    modal.style.zIndex = '99999';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.opacity = '0';
    modal.style.transition = 'opacity 0.3s ease';

    // Lock body scroll
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    modal.innerHTML = `
        <div class="mobile-confirm-box" style="background:#fff; border-radius:30px; padding:32px 24px; width:90%; max-width:340px; transform:translateY(20px); transition:transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); box-shadow:0 20px 50px rgba(0,0,0,0.2);">
            <div style="width:50px; height:50px; background:rgba(74,0,0,0.05); border-radius:15px; display:flex; align-items:center; justify-content:center; margin:0 auto 20px; color:var(--primary-maroon);">
                <i class="fas fa-question-circle" style="font-size:24px;"></i>
            </div>
            <h3 style="margin:0 0 10px; font-size:20px; font-weight:800; color:var(--text-dark); text-align:center;">${escHtml(title || 'Confirm')}</h3>
            <div style="margin-bottom:28px; font-size:15px; color:var(--text-grey); line-height:1.6; text-align:center;">${isHtml ? message : escHtml(message)}</div>
            <div style="display:flex; gap:12px;">
                <button id="_mCcl" style="flex:1; padding:16px; border-radius:18px; border:1.5px solid #eee; background:#fff; font-size:15px; font-weight:600; color:var(--text-grey); cursor:pointer; active:scale(0.95); transition:transform 0.1s;">Cancel</button>
                <button id="_mOk" style="flex:1; padding:16px; border-radius:18px; border:none; background:linear-gradient(135deg, var(--primary-maroon), #3a0000); font-size:15px; font-weight:700; color:white; cursor:pointer; box-shadow:0 8px 20px rgba(74,0,0,0.25); active:scale(0.95); transition:transform 0.1s;">${escHtml(confirmText || 'Confirm')}</button>
            </div>
        </div>`;
    
    document.body.appendChild(modal);
    
    // Trigger animations
    requestAnimationFrame(() => {
        modal.style.opacity = '1';
        modal.querySelector('.mobile-confirm-box').style.transform = 'translateY(0)';
    });

    const cleanup = (callback) => {
        modal.style.opacity = '0';
        modal.querySelector('.mobile-confirm-box').style.transform = 'translateY(20px)';
        document.body.style.overflow = origOverflow;
        setTimeout(() => {
            modal.remove();
            if (callback) callback();
        }, 300);
    };

    document.getElementById('_mCcl').onclick = () => cleanup(onCancel);
    document.getElementById('_mOk').onclick = () => cleanup(onConfirm);
    
    modal.onclick = (e) => { if(e.target === modal) cleanup(onCancel); };
}

/* ════════════════════════════════════════════════════════════
   MOBILE CROP MARKETPLACE (Agriculture Accounts)
   ════════════════════════════════════════════════════════════ */

// Show the marketplace button only for agriculture accounts
function checkMobileCropMarketplaceVisibility() {
    const btn = document.getElementById('mobileAgriMarketBtn');
    if (!btn) return;
    const accounts = window._accounts || [];
    const hasAgri = accounts.some(a => a.account_type === 'Agriculture' && a.status === 'active');
    btn.style.display = hasAgri ? 'flex' : 'none';
}

// Patch loadDashboardData to check marketplace visibility
const _origLoadDashMobile = loadDashboardData;
loadDashboardData = async function() {
    await _origLoadDashMobile();
    checkMobileCropMarketplaceVisibility();
};

function switchMobileMktTab(tab) {
    const listings = document.getElementById('mobileMktListings');
    const orders = document.getElementById('mobileMktOrders');
    const tabList = document.getElementById('mktMobTabListings');
    const tabOrd = document.getElementById('mktMobTabOrders');
    
    if (tab === 'listings') {
        listings.style.display = 'block';
        orders.style.display = 'none';
        tabList.style.background = '#ecfdf5'; tabList.style.color = '#065f46'; tabList.style.borderColor = '#065f46';
        tabOrd.style.background = '#fff'; tabOrd.style.color = '#64748b'; tabOrd.style.borderColor = '#e5e7eb';
        loadMobileCropListings();
    } else {
        listings.style.display = 'none';
        orders.style.display = 'block';
        tabOrd.style.background = '#ecfdf5'; tabOrd.style.color = '#065f46'; tabOrd.style.borderColor = '#065f46';
        tabList.style.background = '#fff'; tabList.style.color = '#64748b'; tabList.style.borderColor = '#e5e7eb';
        loadMobileCropOrders();
    }
}

// Store listings locally for edit
window._mobileCropListings = [];

async function loadMobileCropListings() {
    const el = document.getElementById('mobileMktListings');
    if (!el) return;
    el.innerHTML = '<div style="text-align:center;padding:30px;"><i class="fas fa-spinner fa-spin" style="font-size:24px;color:#065f46"></i></div>';
    try {
        const r = await fetch(`${API}/marketplace/my-listings`, { credentials: 'include' });
        const d = await r.json();
        if (!d.listings || !d.listings.length) {
            el.innerHTML = '<div style="text-align:center;padding:40px 20px;background:#fff;border-radius:16px;border:1px solid #f1f5f9;">' +
                '<i class="fas fa-seedling" style="font-size:36px;color:#d1d5db;margin-bottom:12px;display:block;"></i>' +
                '<h4 style="margin:0 0 8px;color:#374151;">No Listings Yet</h4>' +
                '<p style="color:#94a3b8;font-size:13px;">Tap the + button to sell your harvest!</p></div>';
            return;
        }
        window._mobileCropListings = d.listings;
        const icons = {Grains:'🌾',Vegetables:'🥬',Fruits:'🍎',Pulses:'🫘',Spices:'🌶️',Oilseeds:'🌻',General:'🌱'};
        const statusColors = { active: '#dcfce7;color:#065f46', sold: '#dbeafe;color:#1e40af', expired: '#fee2e2;color:#991b1b' };
        
        el.innerHTML = d.listings.map(l => `
            <div style="background:#fff; border:1px solid #f1f5f9; border-radius:16px; padding:16px; margin-bottom:12px; box-shadow:0 2px 8px rgba(0,0,0,0.03);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="width:42px;height:42px;border-radius:12px;background:#ecfdf5;display:flex;align-items:center;justify-content:center;font-size:22px;">${icons[l.category] || '🌱'}</div>
                        <div>
                            <div style="font-weight:700;font-size:15px;color:#1e293b;">${escHtml(l.crop_name)}</div>
                            <div style="font-size:12px;color:#94a3b8;">${escHtml(l.category)} · ${escHtml(l.location || 'N/A')}</div>
                        </div>
                    </div>
                    <span style="background:${statusColors[l.status] || '#f3f4f6;color:#374151'};padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;text-transform:uppercase;">${l.status}</span>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;background:#f8fafc;padding:10px;border-radius:10px;margin-bottom:12px;">
                    <div style="text-align:center;"><div style="font-size:10px;color:#94a3b8;text-transform:uppercase;">Qty</div><div style="font-weight:700;font-size:14px;">${l.quantity_kg} kg</div></div>
                    <div style="text-align:center;"><div style="font-size:10px;color:#94a3b8;text-transform:uppercase;">Price</div><div style="font-weight:700;font-size:14px;">₹${Number(l.price_per_kg).toLocaleString('en-IN')}</div></div>
                    <div style="text-align:center;"><div style="font-size:10px;color:#94a3b8;text-transform:uppercase;">Min</div><div style="font-weight:700;font-size:14px;">${l.min_order_kg} kg</div></div>
                </div>
                ${l.status === 'active' ? `
                <div style="display:flex;gap:8px;">
                    <button onclick="editMobileCropListing(${l.id})" style="flex:1;padding:10px;border-radius:10px;border:1.5px solid #fef3c7;background:#fffbeb;color:#92400e;font-size:12px;font-weight:700;cursor:pointer;"><i class="fas fa-edit"></i> Edit</button>
                    <button onclick="removeMobileCropListing(${l.id})" style="flex:1;padding:10px;border-radius:10px;border:1.5px solid #fee2e2;background:#fef2f2;color:#991b1b;font-size:12px;font-weight:700;cursor:pointer;"><i class="fas fa-trash"></i> Remove</button>
                </div>` : ''}
            </div>
        `).join('');
    } catch (e) {
        el.innerHTML = '<div style="text-align:center;padding:30px;color:#ef4444;">Error loading listings</div>';
    }
}

async function loadMobileCropOrders() {
    const el = document.getElementById('mobileMktOrders');
    if (!el) return;
    el.innerHTML = '<div style="text-align:center;padding:30px;"><i class="fas fa-spinner fa-spin" style="font-size:24px;color:#065f46"></i></div>';
    try {
        const r = await fetch(`${API}/marketplace/my-orders`, { credentials: 'include' });
        const d = await r.json();
        if (!d.orders || !d.orders.length) {
            el.innerHTML = '<div style="text-align:center;padding:40px 20px;background:#fff;border-radius:16px;border:1px solid #f1f5f9;">' +
                '<i class="fas fa-box-open" style="font-size:36px;color:#d1d5db;margin-bottom:12px;display:block;"></i>' +
                '<h4 style="margin:0 0 8px;color:#374151;">No Orders Yet</h4>' +
                '<p style="color:#94a3b8;font-size:13px;">Orders from buyers will appear here</p></div>';
            return;
        }
        const statusMap = { pending:'#fef3c7;color:#92400e', accepted:'#dbeafe;color:#1e40af', escrow_held:'#e0e7ff;color:#3730a3',
            delivered:'#d1fae5;color:#065f46', inspected:'#fce7f3;color:#9d174d', completed:'#dcfce7;color:#166534', cancelled:'#fee2e2;color:#991b1b' };
        const statusLabel = { pending:'Pending', accepted:'Accepted', escrow_held:'In Escrow', delivered:'Delivered', inspected:'Inspected', completed:'Completed', cancelled:'Cancelled' };
        
        el.innerHTML = d.orders.map(o => `
            <div style="background:#fff; border:1px solid #f1f5f9; border-radius:16px; padding:16px; margin-bottom:12px; box-shadow:0 2px 8px rgba(0,0,0,0.03);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <div>
                        <div style="font-weight:700;font-size:15px;color:#1e293b;">Order #${o.id}</div>
                        <div style="font-size:12px;color:#94a3b8;">${escHtml(o.crop_name)} · Buyer: ${escHtml(o.buyer_name || 'N/A')}</div>
                    </div>
                    <span style="background:${statusMap[o.status]||'#f3f4f6;color:#374151'};padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;">${statusLabel[o.status]||o.status}</span>
                </div>
                <div style="background:#f8fafc;padding:12px;border-radius:10px;margin-bottom:12px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="font-size:12px;color:#64748b;">Qty</span><span style="font-size:13px;font-weight:700;">${o.quantity_kg} kg @ ₹${o.price_per_kg}/kg</span></div>
                    <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="font-size:12px;color:#64748b;">Gross Amount</span><span style="font-size:13px;font-weight:600;">₹${Number(o.total_amount).toLocaleString('en-IN')}</span></div>
                    <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="font-size:12px;color:#ef4444;">2% Bank Fee</span><span style="font-size:13px;color:#ef4444;">-₹${Number(o.commission_amount).toLocaleString('en-IN')}</span></div>
                    <div style="display:flex;justify-content:space-between;border-top:1px dashed #e5e7eb;padding-top:6px;"><span style="font-size:12px;color:#16a34a;font-weight:700;">Net Payout</span><strong style="font-size:14px;color:#16a34a;">₹${Number(o.farmer_credit).toLocaleString('en-IN')}</strong></div>
                </div>
                ${o.status === 'pending' ? `<div style="display:flex;gap:8px;">
                    <button onclick="mobileAcceptOrder(${o.id})" style="flex:1;padding:10px;border-radius:10px;border:none;background:#065f46;color:#fff;font-size:12px;font-weight:700;cursor:pointer;"><i class="fas fa-check"></i> Accept</button>
                    <button onclick="mobileRejectOrder(${o.id})" style="flex:1;padding:10px;border-radius:10px;border:1.5px solid #fee2e2;background:#fef2f2;color:#991b1b;font-size:12px;font-weight:700;cursor:pointer;"><i class="fas fa-times"></i> Reject</button>
                </div>` : ''}
                ${o.status === 'escrow_held' ? `<button onclick="mobileDeliverOrder(${o.id})" style="width:100%;padding:10px;border-radius:10px;border:none;background:#065f46;color:#fff;font-size:12px;font-weight:700;cursor:pointer;"><i class="fas fa-truck"></i> Mark Delivered</button>` : ''}
                <button onclick="openMobileOrderChat(${o.id}, '${escHtml(o.buyer_name || 'Buyer')}', '${escHtml(o.crop_name)}')" style="width:100%; margin-top:8px; padding:10px; border-radius:10px; border:1.5px solid #e5e7eb; background:#fff; color:#374151; font-size:12px; font-weight:700; cursor:pointer;"><i class="fas fa-comment-dots"></i> Chat with Buyer</button>
            </div>
        `).join('');
    } catch (e) {
        el.innerHTML = '<div style="text-align:center;padding:30px;color:#ef4444;">Error loading orders</div>';
    }
}

async function mobileAcceptOrder(id) {
    try {
        const r = await fetch(`${API}/marketplace/orders/${id}/accept`, { method: 'PUT', credentials: 'include' });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        showMobileToast('Order accepted!', 'success');
        loadMobileCropOrders();
    } catch (e) { showMobileToast(e.message, 'error'); }
}

async function mobileRejectOrder(id) {
    showConfirmMobile({ title: 'Reject Order', message: 'Are you sure you want to reject this order?', confirmText: 'Reject', onConfirm: async () => {
        try {
            const r = await fetch(`${API}/marketplace/orders/${id}/reject`, { method: 'PUT', credentials: 'include' });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error);
            showMobileToast('Order rejected', 'info');
            loadMobileCropOrders();
        } catch (e) { showMobileToast(e.message, 'error'); }
    }});
}

async function mobileDeliverOrder(id) {
    showConfirmMobile({ title: 'Confirm Delivery', message: 'Confirm that you have delivered the crop?', confirmText: 'Delivered', onConfirm: async () => {
        try {
            const r = await fetch(`${API}/marketplace/orders/${id}/confirm-delivery`, { method: 'PUT', credentials: 'include' });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error);
            showMobileToast(d.message, 'success');
            loadMobileCropOrders();
        } catch (e) { showMobileToast(e.message, 'error'); }
    }});
}

function showMobileCropModal() {
    // Reset for new listing
    document.getElementById('mCropId').value = '';
    document.getElementById('mCropName').value = '';
    document.getElementById('mCropCategory').value = 'General';
    document.getElementById('mCropQty').value = '';
    document.getElementById('mCropPrice').value = '';
    document.getElementById('mCropMinOrder').value = '1';
    document.getElementById('mCropHarvest').value = '';
    document.getElementById('mCropLocation').value = '';
    document.getElementById('mCropImageUrl').value = '';
    document.getElementById('mCropPhoto').value = '';
    document.getElementById('mCropPhotoPreview').style.display = 'none';
    document.getElementById('mCropDescription').value = '';
    document.getElementById('mobileCropModalTitle').innerHTML = '<i class="fas fa-seedling" style="color:#065f46"></i> New Crop Listing';
    document.getElementById('mobileCropModal').style.display = 'flex';
}

function closeMobileCropModal() {
    document.getElementById('mobileCropModal').style.display = 'none';
}

function editMobileCropListing(id) {
    const l = window._mobileCropListings.find(x => x.id === id);
    if (!l) return;
    document.getElementById('mCropId').value = l.id;
    document.getElementById('mCropName').value = l.crop_name || '';
    document.getElementById('mCropCategory').value = l.category || 'General';
    document.getElementById('mCropQty').value = l.quantity_kg || '';
    document.getElementById('mCropPrice').value = l.price_per_kg || '';
    document.getElementById('mCropMinOrder').value = l.min_order_kg || 1;
    document.getElementById('mCropHarvest').value = l.harvest_date ? l.harvest_date.split('T')[0] : '';
    document.getElementById('mCropLocation').value = l.location || '';
    document.getElementById('mCropImageUrl').value = l.image_url || '';
    document.getElementById('mCropDescription').value = l.description || '';
    
    if (l.image_url) {
        document.getElementById('mCropPhotoPreview').style.backgroundImage = `url(${l.image_url})`;
        document.getElementById('mCropPhotoPreview').style.display = 'block';
    } else {
        document.getElementById('mCropPhotoPreview').style.display = 'none';
    }
    document.getElementById('mCropPhoto').value = '';
    document.getElementById('mobileCropModalTitle').innerHTML = '<i class="fas fa-edit" style="color:#065f46"></i> Edit Listing';
    document.getElementById('mobileCropModal').style.display = 'flex';
}

function previewMobileCropImage(input) {
    const preview = document.getElementById('mCropPhotoPreview');
    const urlInput = document.getElementById('mCropImageUrl');
    if (input.files && input.files[0]) {
        if (input.files[0].size > 2 * 1024 * 1024) {
            showMobileToast('Image too large (max 2MB)', 'error');
            input.value = '';
            preview.style.display = 'none';
            return;
        }
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.style.backgroundImage = `url(${e.target.result})`;
            preview.style.display = 'block';
            urlInput.value = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    } else {
        preview.style.display = 'none';
        urlInput.value = '';
    }
}

async function submitMobileCropListing() {
    const name = document.getElementById('mCropName').value;
    const qty = document.getElementById('mCropQty').value;
    const price = document.getElementById('mCropPrice').value;
    if (!name || !qty || !price) return showMobileToast('Crop name, quantity, and price are required', 'error');
    
    const lstId = document.getElementById('mCropId').value;
    const method = lstId ? 'PUT' : 'POST';
    const url = lstId ? `${API}/marketplace/listings/${lstId}` : `${API}/marketplace/listings`;
    
    const btn = document.getElementById('btnMobileCropSubmit');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    
    try {
        const r = await fetch(url, {
            method: method, credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                crop_name: name,
                category: document.getElementById('mCropCategory').value || 'General',
                quantity_kg: parseFloat(qty),
                price_per_kg: parseFloat(price),
                min_order_kg: parseFloat(document.getElementById('mCropMinOrder').value || 1),
                harvest_date: document.getElementById('mCropHarvest').value,
                location: document.getElementById('mCropLocation').value,
                image_url: document.getElementById('mCropImageUrl').value,
                description: document.getElementById('mCropDescription').value
            })
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        showMobileToast(d.message || 'Listing saved!', 'success');
        closeMobileCropModal();
        loadMobileCropListings();
    } catch (e) {
        showMobileToast('Error: ' + e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check"></i> Save Listing';
    }
}

function removeMobileCropListing(id) {
    showConfirmMobile({ title: 'Remove Listing', message: 'Are you sure you want to remove this crop listing?', confirmText: 'Remove', onConfirm: async () => {
        try {
            await fetch(`${API}/marketplace/listings/${id}`, { method: 'DELETE', credentials: 'include' });
            showMobileToast('Listing removed', 'success');
            loadMobileCropListings();
        } catch (e) { showMobileToast('Error removing listing', 'error'); }
    }});
}

/* --- Mobile Order Chat System --- */
let mobileChatPollInterval = null;

function openMobileOrderChat(orderId, partnerName, cropName) {
    document.getElementById('mChatOrderId').value = orderId;
    document.getElementById('mChatTitle').textContent = partnerName;
    document.getElementById('mChatSubtitle').textContent = cropName + ` (Order #${orderId})`;
    document.getElementById('mChatInput').value = '';
    
    const modal = document.getElementById('mobileOrderChatModal');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    loadMobileOrderChat(orderId);
    if (mobileChatPollInterval) clearInterval(mobileChatPollInterval);
    mobileChatPollInterval = setInterval(() => loadMobileOrderChat(orderId), 5000);
}

function closeMobileOrderChat() {
    document.getElementById('mobileOrderChatModal').style.display = 'none';
    document.body.style.overflow = 'auto';
    if (mobileChatPollInterval) clearInterval(mobileChatPollInterval);
}

async function loadMobileOrderChat(orderId) {
    const el = document.getElementById('mobileChatMessages');
    if (!el || document.getElementById('mChatOrderId').value != orderId) return;
    
    try {
        const r = await fetch(`${API}/marketplace/orders/${orderId}/chat`, { credentials: 'include' });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        
        if (!d.chats || d.chats.length === 0) {
            el.innerHTML = '<div style="text-align:center; color:#94a3b8; font-size:13px; margin-top:20px;">No messages yet.</div>';
            return;
        }

        const isAtBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 50;
        
        el.innerHTML = d.chats.map(c => {
            const isMe = c.sender_type === 'farmer'; // In Mobile Crop Marketplace, current user is the farmer
            return `
                <div style="display:flex; flex-direction:column; align-items:${isMe ? 'flex-end' : 'flex-start'};">
                    <div style="font-size:10px; color:#94a3b8; margin-bottom:4px; margin-${isMe ? 'right' : 'left'}:4px;">${new Date(c.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                    <div style="padding:12px 16px; border-radius:18px; border-bottom-${isMe ? 'right' : 'left'}-radius:4px; max-width:85%; font-size:14px; background:${isMe ? '#166534' : '#fff'}; color:${isMe ? '#fff' : '#1e293b'}; box-shadow:0 1px 2px rgba(0,0,0,0.05); border:${isMe ? 'none' : '1px solid #e5e7eb'};">
                        ${escHtml(c.message)}
                    </div>
                </div>
            `;
        }).join('');
        
        if (isAtBottom) el.scrollTop = el.scrollHeight;
    } catch (e) { /* ignore polling errors */ }
}

async function sendMobileOrderMessage() {
    const orderId = document.getElementById('mChatOrderId').value;
    const input = document.getElementById('mChatInput');
    const msg = input.value.trim();
    if (!msg || !orderId) return;
    
    input.disabled = true;
    try {
        const r = await fetch(`${API}/marketplace/orders/${orderId}/chat`, {
            method: 'POST', credentials: 'include',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ message: msg })
        });
        if (!r.ok) throw new Error((await r.json()).error || 'Failed to send');
        
        input.value = '';
        await loadMobileOrderChat(orderId);
        const el = document.getElementById('mobileChatMessages');
        el.scrollTop = el.scrollHeight;
    } catch (e) { 
        showMobileToast(e.message, 'error');
    } finally {
        input.disabled = false;
        input.focus();
    }
}
/* ════════════════════════════════════════════════════════════
   BRANCH & ATM LOCATOR (ENHANCED MOBILE)
   ════════════════════════════════════════════════════════════ */
let mobileLocatorMapInstance = null;
let mobileLocatorData = [];
let mobileLocatorMarkers = [];
let mobileGeolocateControl = null;

async function initMobileLocator(forceRefresh = false) {
    if (mobileLocatorMapInstance && !forceRefresh) {
        setTimeout(() => mobileLocatorMapInstance.resize(), 100);
        return;
    }
    
    const container = document.getElementById('mobileLocatorMap');
    if (!container) return;
    
    const loading = document.getElementById('mapLoadingOverlay');
    if (loading) loading.style.display = 'flex';
    
    try {
        const res = await fetch(`${API}/user/locations`, { credentials: 'include' });
        const locations = await res.json();
        
        // Initialize map IMMEDIATELY so it's not blank while waiting for data
        mobileLocatorMapInstance = new maplibregl.Map({
            container: 'mobileLocatorMap',
            style: 'https://tiles.openfreemap.org/styles/liberty',
            center: [79.0882, 21.1458], 
            zoom: 12,
            pitch: 50,
            bearing: -15,
            antialias: true,
            dragPan: true,
            touchZoomRotate: true,
            cooperativeGestures: false
        });

        // Add Controls
        mobileLocatorMapInstance.addControl(new maplibregl.NavigationControl({
            visualizePitch: true,
            showCompass: true
        }), 'top-right');
        
        mobileGeolocateControl = new maplibregl.GeolocateControl({
            positionOptions: { enableHighAccuracy: true },
            trackUserLocation: true,
            showUserLocation: true
        });
        mobileLocatorMapInstance.addControl(mobileGeolocateControl, 'top-right');

        // Reset markers
        mobileLocatorMarkers.forEach(m => m.marker.remove());
        mobileLocatorMarkers = [];
        mobileLocatorData = [];

        // Fetch data after map starts loading
        const fetchLocations = async () => {
            try {
                const res = await fetch(`${API}/user/locations`, { credentials: 'include' });
                if (!res.ok) throw new Error('Failed to fetch locations');
                const locations = await res.json();
                return locations;
            } catch (err) {
                console.error('Fetch locations error:', err);
                return [];
            }
        };

        // Set up the load event listener
        mobileLocatorMapInstance.on('load', async () => {
            console.log('[Map] Map instance loaded successfully');
            if (loading) loading.style.display = 'none';

            // Fetch data inside the load event to avoid blocking the initial render
            const locationsResult = await fetchLocations();
            
            // Add 3D Buildings
            try {
                const layers = mobileLocatorMapInstance.getStyle().layers;
                let labelLayerId;
                for (let i = 0; i < layers.length; i++) {
                    if (layers[i].type === 'symbol' && layers[i].layout['text-field']) {
                        labelLayerId = layers[i].id;
                        break;
                    }
                }

                mobileLocatorMapInstance.addLayer({
                    'id': '3d-buildings',
                    'source': 'composite',
                    'source-layer': 'building',
                    'filter': ['==', 'extrude', 'true'],
                    'type': 'fill-extrusion',
                    'minzoom': 15,
                    'paint': {
                        'fill-extrusion-color': '#aaa',
                        'fill-extrusion-height': ['get', 'height'],
                        'fill-extrusion-base': ['get', 'min_height'],
                        'fill-extrusion-opacity': 0.6
                    }
                }, labelLayerId);
            } catch(e) {}

            // Populate Markers
            if (Array.isArray(locationsResult) && locationsResult.length > 0) {
                mobileLocatorData = locationsResult;
                const bounds = new maplibregl.LngLatBounds();
                
                locationsResult.forEach(loc => {
                    if (loc.lat && loc.lng) {
                        const el = document.createElement('div');
                        el.className = 'custom-marker loc-marker';
                        el.style.width = '36px';
                        el.style.height = '36px';
                        el.style.borderRadius = '50%';
                        el.style.display = 'flex';
                        el.style.alignItems = 'center';
                        el.style.justifyContent = 'center';
                        el.style.background = loc.type === 'atm' ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)' : 'linear-gradient(135deg, #800000, #a52a2a)';
                        el.style.color = 'white';
                        el.style.border = '3px solid white';
                        el.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
                        el.style.cursor = 'pointer';
                        
                        el.innerHTML = loc.type === 'atm' ? '<i class="fas fa-money-bill-wave" style="font-size:14px;"></i>' : '<i class="fas fa-university" style="font-size:14px;"></i>';
                        
                        const marker = new maplibregl.Marker({ element: el })
                            .setLngLat([loc.lng, loc.lat])
                            .addTo(mobileLocatorMapInstance);

                        // CLICK HANDLER FOR BOTTOM SHEET
                        el.addEventListener('click', (e) => {
                            e.stopPropagation();
                            showLocationSheet(loc);
                            mobileLocatorMapInstance.flyTo({
                                center: [loc.lng, loc.lat],
                                zoom: 16,
                                pitch: 60,
                                duration: 1500
                            });
                        });
                            
                        mobileLocatorMarkers.push({ marker, type: loc.type, lngLat: [loc.lng, loc.lat], name: loc.name.toLowerCase() });
                        bounds.extend([loc.lng, loc.lat]);
                    }
                });
                
                if (!bounds.isEmpty()) {
                    mobileLocatorMapInstance.fitBounds(bounds, { padding: 80, maxZoom: 15 });
                }
            }
        });

        // Safety timeout to hide loader if load event is delayed
        setTimeout(() => {
            const l = document.getElementById('mapLoadingOverlay');
            if (l && l.style.display !== 'none') {
                console.warn('[Map] Load event timed out, hiding overlay manually');
                l.style.display = 'none';
            }
        }, 4000);

        // Close sheet on map click
        mobileLocatorMapInstance.on('click', () => {
            const sheet = document.getElementById('mobileLocationSheet');
            if (sheet) {
                sheet.style.transform = 'translateY(100%)';
                setTimeout(() => sheet.style.display = 'none', 300);
            }
        });
        
    } catch (err) {
        console.error('Mobile Locator Failed:', err);
        container.innerHTML = '<div style="display:flex; height:100%; align-items:center; justify-content:center; color:#ef4444; font-size:13px; font-weight:600;"><i class="fas fa-exclamation-triangle" style="margin-right:8px;"></i> Failed to load map</div>';
    }
}

let selectedRouteMode = 'driving';
let currentSheetLocation = null;

function showLocationSheet(loc) {
    const sheet = document.getElementById('mobileLocationSheet');
    const typeEl = document.getElementById('locSheetType');
    const nameEl = document.getElementById('locSheetName');
    const addrEl = document.getElementById('locSheetAddress');
    const distEl = document.getElementById('locSheetDistance');

    if (!sheet || !nameEl) return;

    currentSheetLocation = loc;
    selectedRouteMode = 'driving';

    typeEl.textContent = loc.type.toUpperCase();
    typeEl.className = `loc-type-badge ${loc.type}`;
    
    nameEl.textContent = loc.name;
    addrEl.textContent = `${loc.address || ''}, ${loc.city || ''}`;
    
    // Reset route mode buttons
    document.querySelectorAll('.route-mode-btn').forEach(btn => {
        btn.style.border = '1.5px solid #e5e7eb';
        btn.style.background = '#fff';
        btn.style.color = '#64748b';
        btn.classList.remove('route-mode-active');
    });
    const activeBtn = document.querySelector('.route-mode-btn[data-mode="driving"]');
    if (activeBtn) {
        activeBtn.style.border = '1.5px solid var(--primary-maroon)';
        activeBtn.style.background = 'rgba(128,0,0,0.06)';
        activeBtn.style.color = 'var(--primary-maroon)';
        activeBtn.classList.add('route-mode-active');
    }

    // Calculate estimated distances using user's current position
    calculateRouteEstimates(loc);

    sheet.style.display = 'block';
    requestAnimationFrame(() => {
        sheet.style.transform = 'translateY(0)';
    });
}

function calculateRouteEstimates(loc) {
    // Try to get the user's current position
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const userLat = pos.coords.latitude;
                const userLng = pos.coords.longitude;
                const distKm = haversineDistance(userLat, userLng, loc.lat, loc.lng);
                
                updateETADisplays(distKm);
                
                const distEl = document.getElementById('locSheetDistance');
                if (distEl) {
                    distEl.style.display = 'block';
                    distEl.textContent = distKm < 1 ? `${Math.round(distKm * 1000)}m away` : `${distKm.toFixed(1)} km away`;
                }
            },
            () => {
                // Geolocation denied - use fallback estimates
                const distEl = document.getElementById('locSheetDistance');
                if (distEl) distEl.style.display = 'none';
                
                // Show placeholder ETAs
                ['Driving', 'Walking', 'Transit', 'Bicycling'].forEach(mode => {
                    const el = document.getElementById(`eta${mode}`);
                    if (el) el.textContent = '—';
                });
            },
            { enableHighAccuracy: true, timeout: 5000 }
        );
    }
}

function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function updateETADisplays(distKm) {
    // Average speeds (km/h)
    const speeds = { Driving: 35, Walking: 5, Transit: 25, Bicycling: 15 };
    
    Object.entries(speeds).forEach(([mode, speed]) => {
        const el = document.getElementById(`eta${mode}`);
        if (el) {
            const minutes = Math.round((distKm / speed) * 60);
            if (minutes < 60) {
                el.textContent = `${minutes} min`;
            } else {
                const hrs = Math.floor(minutes / 60);
                const mins = minutes % 60;
                el.textContent = mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
            }
        }
    });
}

function selectRouteMode(btn, mode) {
    selectedRouteMode = mode;
    
    // Update button styles to match the premium UI in mobile-dash.html
    document.querySelectorAll('.route-mode-btn').forEach(b => {
        b.style.border = '2px solid #f1f5f9';
        b.style.background = '#f8fafc';
        b.style.color = '#64748b';
        b.classList.remove('route-mode-active');
    });
    
    btn.style.border = '2px solid var(--primary-maroon)';
    btn.style.background = 'rgba(128,0,0,0.06)';
    btn.style.color = 'var(--primary-maroon)';
    btn.classList.add('route-mode-active');
}

function openGoogleMapsRoute() {
    if (!currentSheetLocation) return;
    
    const loc = currentSheetLocation;
    // Google Maps travel mode params: driving, walking, transit, bicycling
    const modeMap = {
        'driving': 'driving',
        'walking': 'walking',
        'transit': 'transit',
        'bicycling': 'bicycling'
    };
    const travelMode = modeMap[selectedRouteMode] || 'driving';
    
    // Using the 'dir' API for reliable deep-linking on mobile
    const url = `https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}&travelmode=${travelMode}`;
    window.open(url, '_blank');
}


function centerOnUser() {
    if (mobileGeolocateControl) {
        mobileGeolocateControl.trigger();
        if (typeof showMobileToast === 'function') showMobileToast('Locating you...', 'info');
    }
}

function filterMobileMap() {
    const q = document.getElementById('mobileLocationSearch').value.toLowerCase();
    
    let found = false;
    mobileLocatorMarkers.forEach(m => {
        if (!q || m.name.includes(q)) {
            if (!found && q) {
                mobileLocatorMapInstance.flyTo({
                    center: m.lngLat,
                    zoom: 16,
                    pitch: 65,
                    duration: 2000
                });
                found = true;
                const loc = mobileLocatorData.find(ld => ld.name.toLowerCase() === m.name);
                if (loc) showLocationSheet(loc);
            }
            if (!m.marker.getMap()) m.marker.addTo(mobileLocatorMapInstance);
        } else {
            m.marker.remove();
        }
    });
}

function filterMobileLocations(type) {
    if (!mobileLocatorMapInstance) return;
    
    document.querySelectorAll('#locationsPage .filter-chip').forEach(b => b.classList.remove('active'));
    let activeBtnId = 'mobileFilterAll';
    if (type === 'branch') activeBtnId = 'mobileFilterBranch';
    else if (type === 'atm') activeBtnId = 'mobileFilterAtm';
    
    const activeBtn = document.getElementById(activeBtnId);
    if(activeBtn) activeBtn.classList.add('active');
    
    const bounds = new maplibregl.LngLatBounds();
    let count = 0;
    
    mobileLocatorMarkers.forEach(m => {
        if (type === 'all' || m.type === type) {
            if (!m.marker.getMap()) m.marker.addTo(mobileLocatorMapInstance);
            bounds.extend(m.lngLat);
            count++;
        } else {
            m.marker.remove();
        }
    });
    
    if (count > 0 && !bounds.isEmpty()) {
        mobileLocatorMapInstance.fitBounds(bounds, { padding: 80, maxZoom: 15 });
    }
}
/* ── Transaction Export Logic ── */
function showExportOptions() {
    logMobileActivity('Export Statement Triggered', 'Opened export options modal');
    document.getElementById('exportStatementModal').style.display = 'flex';
    // Reset defaults
    document.getElementById('exportRange').value = 'current';
    document.getElementById('specificMonthGroup').style.display = 'none';
    document.getElementById('exportStatus').style.display = 'none';
}

function closeExportModal() {
    document.getElementById('exportStatementModal').style.display = 'none';
}

async function toggleMonthSelection() {
    const range = document.getElementById('exportRange').value;
    const group = document.getElementById('specificMonthGroup');
    if (range === 'specific') {
        group.style.display = 'block';
        await loadStatementMonths();
    } else {
        group.style.display = 'none';
    }
}

async function loadStatementMonths() {
    const select = document.getElementById('exportMonth');
    select.innerHTML = '<option disabled selected>Loading months...</option>';
    
    try {
        const r = await fetch(`${API}/statements/months`, { credentials: 'include' });
        if (r.ok) {
            const data = await r.json();
            if (data.months && data.months.length > 0) {
                select.innerHTML = data.months.map(m => 
                    `<option value="${m.month}_${m.year}">${m.label}</option>`
                ).join('');
            } else {
                select.innerHTML = '<option disabled>No transaction months found</option>';
            }
        }
    } catch (e) {
        console.error('Failed to load statement months', e);
        select.innerHTML = '<option disabled>Error loading months</option>';
    }
}

async function handleExportStatement(mode) {
    let range = document.getElementById('exportRange').value;
    const status = document.getElementById('exportStatus');
    
    if (range === 'specific') {
        range = document.getElementById('exportMonth').value;
        if (!range || range.includes('Loading') || range.includes('No')) {
            showToast('Please select a valid month', 'error');
            return;
        }
    }
    
    status.textContent = 'Generating your premium statement...';
    status.style.color = 'var(--primary-maroon)';
    status.style.display = 'block';
    
    const downloadURL = `${API}/statements/download/${range}`;
    
    try {
        const response = await fetch(downloadURL, { credentials: 'include' });
        if (!response.ok) throw new Error('Generation failed');
        
        const blob = await response.blob();
        const fileName = `SmartBank_Statement_${range}.pdf`;
        
        if (mode === 'share') {
            if (navigator.share) {
                const file = new File([blob], fileName, { type: 'application/pdf' });
                try {
                    await navigator.share({
                        files: [file],
                        title: 'SmartBank Statement',
                        text: `Here is my SmartBank Transaction Statement for ${range}.`
                    });
                    status.textContent = 'Statement shared successfully!';
                    status.style.color = '#10b981';
                } catch (shareErr) {
                    if (shareErr.name !== 'AbortError') {
                        console.error('Share failed', shareErr);
                        showToast('Sharing not supported on this device/app', 'error');
                        mode = 'download'; // Fallback
                    } else {
                        status.style.display = 'none';
                        return;
                    }
                }
            } else {
                showToast('Sharing not available, starting download...', 'info');
                mode = 'download';
            }
        }
        
        if (mode === 'download') {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            
            status.textContent = 'Statement downloaded successfully!';
            status.style.color = '#10b981';
            showToast('Statement ready!', 'success');
        }
        
        setTimeout(() => {
            status.style.display = 'none';
            closeExportModal();
        }, 2000);
        
    } catch (err) {
        console.error('Export failed', err);
        status.textContent = 'Failed to generate statement. Try again.';
        status.style.color = '#ef4444';
        showToast('System error generating PDF', 'error');
    }
}

/* ── End of Logic ── */

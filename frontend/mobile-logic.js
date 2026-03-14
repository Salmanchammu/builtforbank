/* ============================================================
   Smart Bank - Mobile Logic
   Unified logic for Mobile UI with UPI NPCI Sandbox
   ============================================================ */

'use strict';

window.API = window.SMART_BANK_API_BASE || '/api';

document.addEventListener('DOMContentLoaded', async () => {
    const page = window.location.pathname.split('/').pop();
    initSecurityHandlers(); // Initialize Screenshot & Privacy Protection

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
        if (r.ok) {
            console.log('[Login] Success! Redirecting...');
            btn.innerHTML = '<i class="fas fa-check"></i> Success!';
            localStorage.setItem('bank_mobile_user_info', JSON.stringify({
                username: d.user.username,
                name: d.user.name,
                id: d.user.id,
                role: d.user.role
            }));
            window.location.href = 'mobile-dash.html';
        } else {
            showMobileToast(d.error || 'Login failed', 'error');
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

function checkAndShowPasscodeLogin() {
    const userInfo = localStorage.getItem('bank_mobile_user_info');
    const passcode = localStorage.getItem('bank_mobile_passcode');
    const section = document.getElementById('passcodeLoginSection');

    if (userInfo && passcode && section) {
        const user = JSON.parse(userInfo);
        section.style.display = 'block';
        section.querySelector('.form-label').innerHTML = `Quick Passcode for <b>${user.name}</b>`;

        // Optionally hide regular form
        // document.getElementById('mobileLoginForm').style.display = 'none';
    }
}

async function handlePasscodeLogin() {
    const entered = document.getElementById('passcode').value;
    const userInfo = JSON.parse(localStorage.getItem('bank_mobile_user_info'));

    if (!userInfo || !userInfo.username) return alert('No user info found. Please login normally once.');

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
    document.body.appendChild(modal);
    document.getElementById('_logoutCancel').onclick = () => modal.remove();
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.getElementById('_logoutOk').onclick = async () => {
        modal.remove();
        try { await fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' }); } catch { }
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

            const dashContent = document.getElementById('dashboard');
            if (window._accounts.length === 0) {
                if (window._accountRequests && window._accountRequests.length > 0) {
                    if (dashContent) {
                        const bannerHTML = `
                            <div id="zeroAccountBannerMobile" class="placeholder-card" style="background:#fff7ed; border: 1px solid #fed7aa;">
                                <div class="placeholder-icon" style="background:#ffedd5; color:#d97706;">
                                    <i class="fas fa-hourglass-half"></i>
                                </div>
                                <h3 class="placeholder-title">KYC Under Review</h3>
                                <p class="placeholder-desc">We've received your documents. Your account will be active once our team completes the verification.</p>
                                <button class="placeholder-btn" style="background:#d97706;" onclick="showAccountModal()">Apply for Another</button>
                            </div>
                        `;
                        dashContent.insertAdjacentHTML('afterbegin', bannerHTML);
                    }
                } else {
                    if (dashContent) {
                        const bannerHTML = `
                            <div id="zeroAccountBannerMobile" class="placeholder-card">
                                <div class="placeholder-icon">
                                    <i class="fas fa-university"></i>
                                </div>
                                <h3 class="placeholder-title">Welcome to SmartBank</h3>
                                <p class="placeholder-desc">Experience premium digital banking. Open your first account in minutes with instant KYC.</p>
                                <button class="placeholder-btn" onclick="showAccountModal()">Open Account</button>
                            </div>
                        `;
                        dashContent.insertAdjacentHTML('afterbegin', bannerHTML);
                    }
                }
            }

            if (d.accounts && d.accounts.length > 0) {
                window._primaryAccount = d.accounts[0];
            } else {
                window._primaryAccount = null;
            }
            window._notifications = d.notifications || [];
            updateMobileNotifBadge();
            renderProfile(d.user, d.profile_image_url);
            renderDashboard(d);

            // Update mobile header/sidebar avatars
            const av = d.profile_image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(d.user.name || d.user.username)}&background=4f46e5&color=fff&rounded=true&bold=true`;
            const headerAv = document.getElementById('mobileHeaderAvatar');
            const logo = document.getElementById('mobileLogo');
            if (headerAv && logo) {
                headerAv.src = av;
                headerAv.style.display = 'block';
                logo.style.display = 'none';
            }
            const sideAv = document.getElementById('mobileSidebarAvatar');
            if (sideAv) sideAv.src = av;
            const sideName = document.getElementById('sidebarName');
            if (sideName) sideName.textContent = d.user.name || d.user.username;
            const sideEmail = document.getElementById('sidebarEmail');
            if (sideEmail) sideEmail.textContent = d.user.email;

            await checkUpiStatus();
            injectAccountModal();
            injectMutualFundModal();
            injectLifeInsuranceModal();
            injectGoldLoanModal();
            injectFixedDepositModal();
        }
    } catch (e) { console.error('Load Dashboard Failed', e); }
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
                <select id="mobileAccountType" class="modal-select">
                    <option value="Savings">Savings Account</option>
                    <option value="Current">Current Account</option>
                    <option value="Salary">Salary Account</option>
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
            <div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:12px;margin-bottom:24px;border-radius:8px;font-size:13px;color:#1e40af;">
                <i class="fas fa-camera" style="margin-right:8px;"></i> Face verification starts on submit.
            </div>
            <button id="btnMobileSubmitAccount" class="modal-btn-submit" onclick="submitNewAccount()">Verify & Create Account</button>
        </div>
    </div>`;
    const wrapper = document.querySelector('.mobile-wrapper') || document.body;
    wrapper.insertAdjacentHTML('beforeend', modalHTML);
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
    document.body.insertAdjacentHTML('beforeend', modalHTML);
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
    document.body.insertAdjacentHTML('beforeend', modalHTML);
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
    document.body.insertAdjacentHTML('beforeend', modalHTML);

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

    if (!accountNum) return alert('Please select a source account');
    if (!amount || amount <= 0) return alert('Please enter a valid amount');
    if (!aadhaar || aadhaar.length < 12) return alert('Please enter a valid Aadhaar number');

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
                    <p style="color:#666666;font-size:15px;margin:0 0 32px;line-height:1.6;">${data.message || 'Your application has been received and is currently under review.'}<br>Reference: <strong style="color:#1a1a1a;">${data.reference || '#REF'}</strong></p>
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
    document.body.insertAdjacentHTML('beforeend', modalHTML);
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
    document.body.insertAdjacentHTML('beforeend', modalHTML);
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

        if (!window.faceAuthManager) throw new Error('Face Auth Manager not loaded');
        const kycData = await window.faceAuthManager.captureFaceForKYC();
        if (!kycData || !kycData.descriptor) throw new Error('Face verification failed');

        const res = await fetch(`${API}/user/accounts`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                account_type: type,
                aadhaar_number: aadhaar,
                pan_number: pan,
                face_descriptor: kycData.descriptor,
                kyc_photo: kycData.photo,
                kyc_video: kycData.video,
                aadhaar_proof: aadhaarProof,
                pan_proof: panProof
            })
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

    const av = profileImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || user.username)}&background=4f46e5&color=fff&rounded=true&bold=true`;
    const headerAv = document.getElementById('mobileHeaderAvatar');
    if (headerAv) headerAv.src = av;
    const sideAv = document.getElementById('mobileSidebarAvatar');
    if (sideAv) sideAv.src = av;

    const lastLoginEl = document.getElementById('lastLogin');
    if (lastLoginEl) {
        const now = new Date();
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        lastLoginEl.textContent = `Last Login Time: ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()} `;
    }

    // Render Account Details for Profile
    const accountsList = document.getElementById('profileAccountsList');
    if (accountsList) {
        if (!window._accounts || window._accounts.length === 0) {
            accountsList.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-grey);font-size:14px;">No active accounts found</div>';
        } else {
            accountsList.innerHTML = window._accounts.map(acc => `
                <div class="profile-account-card">
                    <span class="account-type-badge">${acc.account_type} Account</span>
                    
                    <div class="detail-row">
                        <div class="detail-info">
                            <span class="detail-label">Account Number</span>
                            <span class="detail-value">${acc.account_number}</span>
                        </div>
                        <button class="copy-btn" onclick="copyText('${acc.account_number}', 'Account Number')" title="Copy Account Number">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                    
                    <div class="detail-row">
                        <div class="detail-info">
                            <span class="detail-label">IFSC Code</span>
                            <span class="detail-value">${acc.ifsc_code || 'SMTG000101'}</span>
                        </div>
                        <button class="copy-btn" onclick="copyText('${acc.ifsc_code || 'SMTG000101'}', 'IFSC Code')" title="Copy IFSC Code">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                </div>
            `).join('');
        }
    }
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
            alert(`${label} copied!`);
        } catch (e) {
            alert(`Failed to copy ${label}`);
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
                const isRejected = ['rejected', 'declined', 'expired', 'cancelled', 'canceled', 'closed'].includes(status);
                return isCredit(r) && !isRejected;
            });
        } else {
            // Debit / Savings tab
            displayCards = (data.cards || []).filter(c => !c.card_type || String(c.card_type).toLowerCase() !== 'credit');
            displayRequests = allRequests.filter(r => {
                const status = String(r.status || '').toLowerCase();
                const isRejected = ['rejected', 'declined', 'expired', 'cancelled', 'canceled', 'closed'].includes(status);
                return !isCredit(r) && !isRejected;
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
                            RUPAY <small style="display:block;font-size:7px;margin-top:-2px;opacity:0.8;">${(card.card_tier || 'Platinum').toUpperCase()}</small>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:12px;font-weight:700;letter-spacing:0.5px;color:rgba(255,255,255,0.9);">SmartBank</div>
                            <div style="font-size:8px;opacity:0.7;text-transform:uppercase;">Connect • Life</div>
                        </div>
                    </div>
                    <div class="card-chip"></div>
                    <div class="card-number">${formattedNum}</div>
                    <div class="card-footer">
                        <div class="card-holder">${holderName}</div>
                        <button class="send-money-btn" onclick="switchPage('transfer')">SEND MONEY</button>
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
                    <p class="placeholder-desc">Your <strong>${typeLabel}</strong> application is being processed by our system. We will notify you once it is dispatched.</p>
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
        const welcomeSection = document.querySelector('.mobile-welcome-section');
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
                    <h4 style="margin: 0; font-size: 15px; color: #1a1a1a; font-weight: 700;">${l.loan_type}</h4>
                    <p style="margin: 2px 0 0; font-size: 12px; color: #666;">EMI: ${fmtINR_mob(l.monthly_payment)} • ${fmtINR_mob(outstanding)} left</p>
                </div>
            </div>
                ${l.status === 'approved' ? `
                    <button onclick="injectLoanRepayModal(${l.id}, '${l.loan_type}', ${outstanding}, ${l.monthly_payment})" style="background: #8b0000; color: #fff; border: none; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 700; box-shadow: 0 4px 12px rgba(139, 0, 0, 0.2);">Repay</button>
                ` : `<span class="loan-status-badge ${l.status}" style="font-size: 10px;">${l.status.toUpperCase()}</span>`
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
    document.getElementById('mobRepayInfo').innerHTML = `Repaying for <b>${loanType}</b>. Outstanding: <b>${fmtINR_mob(outstanding)}</b>`;

    const sel = document.getElementById('mobRepayAccount');
    if (sel) {
        sel.innerHTML = (window._accounts || []).map(a => `<option value="${a.id}">${a.account_type} - ${a.account_number.slice(-4)} (${fmtINR_mob(a.balance)})</option>`).join('');
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
window.isBalanceVisible = false;

function updateBalanceDisplay() {
    const el = document.getElementById('mobileBalanceAmount');
    if (!el) return;

    const totalBalance = (window._accounts || []).reduce((sum, acc) => sum + (acc.balance || 0), 0);
    const hasAccounts = window._accounts && window._accounts.length > 0;

    // Dynamic Balance Display Logic
    const balanceCard = document.getElementById('mobileBalanceCard');
    const balanceLabel = document.getElementById('mobileBalanceLabel');

    if (balanceCard) {
        if (!hasAccounts) {
            balanceCard.style.display = 'none';
        } else {
            balanceCard.style.display = 'flex'; // Ensure it's flex as per original CSS
            if (window._accounts.length === 1) {
                if (balanceLabel) balanceLabel.textContent = `${window._accounts[0].account_type || 'Account'} Balance`;
            } else {
                if (balanceLabel) balanceLabel.textContent = 'Total Balance';
            }
        }
    }

    if (window.isBalanceVisible) {
        el.textContent = `₹${totalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })} `;
        el.classList.remove('balance-hidden');
        el.classList.add('animate-fade-in');

        // Show IFSC and masked account if single account
        const infoEl = document.getElementById('mobileAccountInfo');
        if (infoEl) {
            if (window._accounts.length === 1) {
                const acc = window._accounts[0];
                infoEl.innerHTML = `A/C: ${acc.account_number.slice(0, 4)}...${acc.account_number.slice(-4)} | IFSC: ${acc.ifsc || 'SMTB0000001'}`;
                infoEl.style.display = 'block';
            } else {
                infoEl.style.display = 'none';
            }
        }
    } else {
        el.textContent = '••••••';
        el.classList.add('balance-hidden');
        el.classList.remove('animate-fade-in');
        const infoEl = document.getElementById('mobileAccountInfo');
        if (infoEl) infoEl.style.display = 'none';
    }
}

function toggleBalanceVisibility() {
    window.isBalanceVisible = !window.isBalanceVisible;
    const btn = document.getElementById('toggleBalanceBtn');
    if (btn) {
        btn.innerHTML = window.isBalanceVisible ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
        btn.classList.toggle('active', window.isBalanceVisible);
    }
    updateBalanceDisplay();
}

async function refreshMobileBalance() {
    const btn = document.getElementById('refreshBalanceBtn');
    if (btn) {
        const icon = btn.querySelector('i');
        if (icon) icon.classList.add('fa-spin');
        btn.disabled = true;
    }

    try {
        await loadDashboardData();
        if (window.isBalanceVisible) {
            // Briefly show a highlight if it's already visible
            const el = document.getElementById('mobileBalanceAmount');
            if (el) {
                el.style.color = '#10b981';
                setTimeout(() => el.style.color = '', 500);
            }
        }
    } catch (e) {
        console.error('Manual refresh failed', e);
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
        m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:99999;';
        m.innerHTML = `<div style="background:#fff;border-radius:20px;padding:28px 24px;max-width:320px;width:90%;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,0.15);">
            <div style="font-size:36px;margin-bottom:14px;">🏦</div>
            <h3 style="margin:0 0 8px;font-size:17px;font-weight:800;color:#111;">No Bank Account</h3>
            <p style="margin:0 0 20px;font-size:13px;color:#6b7280;">Please open a bank account first before applying for a debit card.</p>
            <button onclick="this.closest('[style]').remove()" style="padding:11px 28px;border-radius:30px;border:none;background:#800000;color:#fff;font-weight:700;font-size:13px;cursor:pointer;">OK</button>
        </div>`;
        document.body.appendChild(m);
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
    document.body.appendChild(modal);
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
                statusBox.innerHTML = `<div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <div><p style="font-size: 12px; color: #166534;">Active VPA</p><h4 style="font-weight: 700;">${d.upi_id}</h4></div>
                    <i class="fas fa-check-circle" style="color: #22c55e; font-size: 24px;"></i>
                </div>
                <div style="text-align: center; margin-top: 15px; margin-bottom: 10px;">
                    <p style="font-size: 13px; font-weight: bold; margin-bottom: 10px; color: var(--text-primary);">Your UPI QR Code</p>
                    <img src="${qrUrl}" alt="UPI QR Code" style="border-radius: 8px; border: 1px solid #ccc; padding: 5px; background: #fff; max-width: 150px; display: inline-block;" />
                </div>`;
                transferSec.style.display = 'block';
                setupSec.style.display = 'none';
            } else {
                statusBox.innerHTML = `<div style="background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 12px;">
                    <p style="font-size: 12px; color: #991b1b;">UPI Status</p><h4>Not Registered</h4>
                </div>`;
                transferSec.style.display = 'none';
                setupSec.style.display = 'block';
            }
        }
    } catch (e) { console.error('UPI Status Check Failed', e); }
}

/* ── QR Scanner Logic ── */
let html5QrcodeScanner = null;

function openQrScanner() {
    const modal = document.getElementById('qrScannerModal');
    if (modal) modal.style.display = 'flex';

    if (!html5QrcodeScanner) {
        html5QrcodeScanner = new Html5QrcodeScanner(
            "qr-reader",
            { fps: 10, qrbox: { width: 250, height: 250 } },
            false
        );
    }

    html5QrcodeScanner.render(
        (decodedText, decodedResult) => {
            // Handle on success
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
                    alert('Scanned VPA: ' + vpa);
                }
            }, 500);
        },
        (error) => {
            // Handle on failure (ignore generally)
        }
    );
}

function closeQrScanner() {
    const modal = document.getElementById('qrScannerModal');
    if (modal) modal.style.display = 'none';

    if (html5QrcodeScanner) {
        try {
            html5QrcodeScanner.clear().catch(error => console.error("Failed to clear scanner", error));
        } catch (e) {
            console.error("Scanner clear error", e);
        }
    }
}

async function handleUpiSetup() {
    const pin = document.getElementById('newUpiPin').value;
    if (pin.length !== 6) return alert('PIN must be 6 digits');

    try {
        const r = await fetch(`${API}/user/upi/setup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ upi_pin: pin })
        });
        if (r.ok) {
            alert('UPI Enabled Successfully!');
            await checkUpiStatus();
        } else {
            const d = await r.json();
            alert(d.error || 'Setup failed');
        }
    } catch (e) { alert('Connection error'); }
}

async function handleUpiTransfer() {
    const vpa = document.getElementById('targetVpa').value;
    const amt = document.getElementById('upiAmount').value;
    const pin = document.getElementById('upiPin').value;

    if (!vpa || !amt || !pin) return alert('All fields required');

    try {
        const r = await fetch(`${API}/transfer/upi`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ target_vpa: vpa, amount: parseFloat(amt), upi_pin: pin })
        });
        const d = await r.json();
        if (r.ok && d.success) {
            alert(`Payment Successful!\nRef: ${d.reference} `);
            document.getElementById('upiAmount').value = '';
            document.getElementById('upiPin').value = '';
            await loadDashboardData();
            switchTab('dashboard');
        } else {
            alert(d.error || 'Transfer failed');
        }
    } catch (e) { alert('Connection error'); }
}

/* ── UI Transitions ── */
function switchTab(tabId) {
    document.querySelectorAll('.page-content').forEach(p => p.style.display = 'none');
    document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const tab = document.getElementById(tabId + 'Page') || document.getElementById(tabId);
    if (tab) {
        tab.style.display = 'block';
        tab.classList.add('active');
        // Robust selector for both mobile nav and sidebar links
        const nav = document.querySelector(`.nav-item[onclick*="switchTab('${tabId}')"]`) || 
                    document.querySelector(`.sidebar-link[onclick*="switchTab('${tabId}')"]`);
        if (nav) nav.classList.add('active');
    }
}

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
        return alert("Please open a bank account first to use UPI.");
    }
    switchTab('upi');
    checkUpiStatus();
}

function showTransferPage() {
    if (!window._accounts || window._accounts.length === 0) {
        return alert("Please open a bank account first to transfer money.");
    }
    switchTab('transfer');
}

async function handleInternalTransfer() {
    const acc = document.getElementById('transferAcc').value;
    const amt = document.getElementById('transferAmount').value;
    const remark = document.getElementById('transferRemarks').value;

    if (!acc || !amt) return alert('Account and Amount are required');
    if (!window._primaryAccount) return alert('Source account not loaded. Please refresh.');

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
            alert(`Transfer Successful!\nRef: ${d.reference} `);
            await loadDashboardData();
            switchTab('dashboard');
        } else {
            alert(d.error || 'Transfer failed');
        }
    } catch (e) { alert('Connection error'); }
}

let currentBillerCategory = '';

function showBillPayPage(category) {
    if (!window._accounts || window._accounts.length === 0) {
        return alert("Please open a bank account first to proceed.");
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
    if (!cid) return alert('Please enter consumer number');

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
            alert(`Bill Paid Successfully!\nRef: ${d.reference} `);
            await loadDashboardData();
            switchTab('dashboard');
        } else {
            alert(d.error || 'Payment failed');
        }
    } catch (e) { alert('Connection error'); }
}


function showPasscodeSetup() {
    document.getElementById('passcodeModal').style.display = 'flex';
}

function closePasscodeModal() {
    document.getElementById('passcodeModal').style.display = 'none';
}

async function savePasscode() {
    const pc = document.getElementById('newPasscode').value;
    if (pc.length !== 4) return alert('Passcode must be 4 digits');

    try {
        const r = await fetch(`${API}/auth/mobile/setup-passcode`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ passcode: pc })
        });
        const d = await r.json();
        if (r.ok) {
            localStorage.setItem('bank_mobile_passcode', pc); // Still keep for UI detection
            alert('Login Passcode Enabled! You can now login faster next time.');
            closePasscodeModal();
        } else {
            alert(d.error || 'Setup failed');
        }
    } catch (e) {
        alert('Connection error. Passcode not saved.');
    }
}

/* ── Signup & Forgot Password ── */
async function handleMobileSignup(e) {
    e.preventDefault();
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const username = document.getElementById('signupUsername').value;
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('signupConfirmPassword').value;

    if (password !== confirmPassword) return alert('Passwords do not match');

    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

    try {
        const deviceType = window.SmartBankDeviceDetector ? window.SmartBankDeviceDetector.getDeviceType() : 'mobile';
        const r = await fetch(`${API}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name, email, username, password, device_type: deviceType })
        });
        const d = await r.json();
        if (r.ok) {
            window._tempSignupUsername = username; // Store for OTP verification
            showMobileToast('Account created! Please verify your email. 📧', 'success');
            
            // Show OTP Modal
            const modal = document.getElementById('otpModal');
            if (modal) {
                modal.style.display = 'flex';
                // Hide signup form container
                document.querySelector('.auth-container').style.display = 'none';
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

    let otp = '';
    for (let i = 1; i <= 6; i++) {
        const val = document.getElementById(`otp_${i}`).value;
        if (!val) return showMobileToast('Please enter full 6-digit code', 'warning');
        otp += val;
    }

    const btn = document.getElementById('btnVerifyOtp');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Activating...';

    try {
        const r = await fetch(`${API}/auth/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, otp })
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
            showMobileToast('New verification code sent! 📧', 'success');
            // Clear inputs
            for (let i = 1; i <= 6; i++) {
                document.getElementById(`otp_${i}`).value = '';
            }
            document.getElementById('otp_1').focus();
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
    if (alertMsg) alert(alertMsg);
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
    document.body.appendChild(modal);
}

function handleOffers() {
    handleProfileClick('Viewed Offers tab', 'Featured Offers: Earn 5x points on dining!');
}

function handleMoreDetails() {
    handleProfileClick('Viewed More tab', 'Financial Reports, Card Controls, and Support available in More.');
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
                    <strong style="color:var(--primary-maroon);font-size:14px;">${n.title}</strong>
                    <small style="color:var(--text-grey);font-size:10px;">${new Date(n.created_at).toLocaleDateString()}</small>
                </div>
            <p style="margin: 0 0 10px 0; font-size: 13px; color: var(--text-main);">${n.message}</p>
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
                                <div style="font-weight: 700; color: #111827; font-size: 15px; letter-spacing: -0.2px;">${t.description || t.type.toUpperCase()}</div>
                                <div style="font-size: 12px; color: #6b7280; margin-top: 3px; display: flex; align-items: center; gap: 6px;">
                                    <span>${date}</span>
                                    <span style="width: 3px; height: 3px; background: #d1d5db; border-radius: 50%;"></span>
                                    <span>A/C ...${(t.account_number || '').slice(-4)}</span>
                                </div>
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-weight: 800; color: ${color}; font-size: 16px; letter-spacing: -0.3px;">
                                ${sign}₹${Number(t.amount).toLocaleString('en-IN')}
                            </div>
                            <div style="display: inline-block; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; padding: 2px 8px; border-radius: 6px; margin-top: 6px; background: ${t.status === 'completed' ? '#d1fae5' : '#fef3c7'}; color: ${t.status === 'completed' ? '#065f46' : '#92400e'};">
                                ${t.status === 'completed' ? 'Success' : (t.status || 'Pending')}
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
                emailSpan.textContent = window.currentUser.email || 'Premium Banking';
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
function initSecurityHandlers() {
    const mask = document.getElementById('privacyMask');
    const flash = document.getElementById('screenshotFlash');

    const triggerFlash = () => {
        if (!flash) return;
        flash.classList.add('active');
        setTimeout(() => flash.classList.remove('active'), 500);
    };

    const showMask = () => { if (mask) mask.classList.add('active'); };
    const hideMask = () => { if (mask) mask.classList.remove('active'); };

    // Detect when user leaves the app/tab
    window.addEventListener('blur', showMask);
    window.addEventListener('focus', hideMask);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            showMask();
            triggerFlash(); // Deterrence on exit
        } else {
            hideMask();
        }
    });

    // Disable context menu (long press on mobile)
    document.addEventListener('contextmenu', e => e.preventDefault());

    // Best-effort detection for PrintScreen if using keyboard on tablet/mobile
    document.addEventListener('keyup', e => {
        if (e.key === 'PrintScreen' || e.keyCode === 44) {
            triggerFlash();
            showMobileToast('Screenshot blocked', 'error');
        }
    });
}

/**
 * Premium Mobile Toast Notifications
 */
function showMobileToast(message, type = 'info') {
    let container = document.getElementById('mobileToastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'mobileToastContainer';
        container.style.cssText = `
            position: fixed;
            top: 40px;
            left: 20px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: none;
        `;
        document.body.appendChild(container);
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
    const colors = {
        'success': '#10b981',
        'error': '#ef4444',
        'info': '#3b82f6',
        'warning': '#f59e0b'
    };
    const color = colors[type] || colors.info;

    toast.style.cssText = `
        background: white;
        color: #1a1a1a;
        padding: 16px 20px;
        border-radius: 16px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 14px;
        font-weight: 600;
        border-right: 5px solid ${color};
        animation: toastIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        pointer-events: auto;
    `;

    toast.innerHTML = `
        <i class="fas ${icon}" style="color: ${color}; font-size: 18px;"></i>
        <div style="flex: 1;">${message}</div>
    `;

    container.appendChild(toast);

    // Auto-remove
    setTimeout(() => {
        toast.style.animation = 'toastOut 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards';
        setTimeout(() => toast.remove(), 400);
    }, 4000);
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

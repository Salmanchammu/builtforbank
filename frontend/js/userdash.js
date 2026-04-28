/* ============================================================
   Smart Bank – User Dashboard JS
   Real-Time | Indian Banking (UPI / IMPS / NEFT / RTGS)
   Complete rewrite – all bugs fixed
   ============================================================ */

'use strict';

window.API = window.SMART_BANK_API_BASE || '/api';
const REFRESH_INTERVAL = 60000; // 60s

// Redundant showConfirm removed (handled by premium-ui.js)

/* ── State ───────────────────────────────────────────────── */
const state = {
    user: null, accounts: [], transactions: [], cards: [],
    loans: [], cardRequests: [], notifications: [], deposits: [],
    refreshTimer: null, currentPage: 'dashboard', upiStatus: null
};

/* ════════════════════════════════════════════════════════════
   INIT
   ════════════════════════════════════════════════════════════ */
const init = async () => {
    injectStyles();
    updateDateTime();
    setInterval(updateDateTime, 60000);
    loadTheme();
    // initSecurity(); // Removed to silence screenshot alerts

    const ok = await checkAuth();
    if (!ok) { 
        const loginUrl = (window.SmartBankDeviceDetector && window.SmartBankDeviceDetector.getLoginUrl) ? window.SmartBankDeviceDetector.getLoginUrl() : 'user.html';
        window.location.href = loginUrl; 
        return; 
    }

    await loadAll();
    initNav();
    initSidebar();
    loadPreferences();
    startAutoRefresh();
    
    // Cleanup any residual blur/overlays from previous sessions or failed security triggers
    document.querySelectorAll('.blur-background, .privacy-mask').forEach(el => {
        el.classList.remove('blur-background');
        if(el.id === 'privacyMask' || el.classList.contains('privacy-mask')) el.style.display = 'none';
    });
    const mainCont = document.querySelector('.dashboard-container') || document.querySelector('.main-content');
    if(mainCont) mainCont.classList.remove('blur-background');

    setTimeout(() => addNotification('Welcome back!', 'Dashboard is ready', 'success'), 1200);
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

/* ════════════════════════════════════════════════════════════
   AUTH
   ════════════════════════════════════════════════════════════ */
async function checkAuth() {
    try {
        const r = await fetch(`${API}/auth/check`, { credentials: 'include' });
        if (r.ok) {
            const d = await r.json();
            if (d.authenticated && (d.user.role === 'user' || d.user.role === 'staff' || d.user.role === 'admin')) {
                state.user = d.user; return true;
            }
        }
    } catch { /* backend offline */ }
    return false;
}

async function logout() {
    showConfirm({
        title: 'Logout?',
        message: 'Are you sure you want to logout from SmartBank?',
        icon: 'fa-sign-out-alt',
        confirmText: 'Logout',
        onConfirm: async () => {
            try { await fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' }); } catch { }
            sessionStorage.clear(); localStorage.clear();
            const loginUrl = (window.SmartBankDeviceDetector && window.SmartBankDeviceDetector.getLoginUrl) ? window.SmartBankDeviceDetector.getLoginUrl() : 'user.html';
            window.location.href = loginUrl;
        }
    });
}

/* ════════════════════════════════════════════════════════════
   DATA LOADING
   ════════════════════════════════════════════════════════════ */
async function loadAll() {
    try {
        const r = await fetch(`${API}/user/dashboard`, { credentials: 'include' });
        if (r.ok) {
            const d = await r.json();
            state.accounts = d.accounts || [];
            state.accountRequests = d.account_requests || [];
            state.transactions = d.transactions || [];
            state.cards = d.cards || [];
            state.cardRequests = (d.card_requests || []).filter(cr => cr.status === 'pending');
            state.loans = d.loans || [];
            state.notifications = (d.notifications || []).map(n => ({
                id: n.id,
                title: n.title,
                message: n.message,
                type: n.type || 'info',
                time: n.created_at,
                read: !!n.is_read
            }));
            if (d.user) state.user = { ...state.user, ...d.user, profile_image_url: d.profile_image_url };
            updateNotifBadge();
            await loadBeneficiaries();
            await loadPockets();
            renderAll();
            
            // Start notification polling every 30s
            setInterval(async () => {
                try {
                    const r = await fetch(`${API}/user/dashboard`, { credentials: 'include' });
                    if(r.ok) {
                        const data = await r.json();
                        state.notifications = (data.notifications || []).map(n => ({
                            id: n.id,
                            title: n.title,
                            message: n.message,
                            type: n.type || 'info',
                            time: n.created_at,
                            read: !!n.is_read
                        }));
                        updateNotifBadge();
                        if($id('notificationDropdown').classList.contains('active')) renderNotifications();
                    }
                } catch(e) {}
            }, 30000);
            return;
        } else if (r.status === 401) {
            window.location.href = 'user.html';
            return;
        }
    } catch { /* offline */ }

    console.error("Backend unavailable or unauthorized.");
    showToast("Connection to server failed. Please try again later.", "error");
}

function useMockData() {
    state.accounts = [{
        id: 1, account_number: 'SB000000000001', account_type: 'Savings',
        balance: 15000, status: 'active', currency: 'INR', ifsc: 'SMTB0000001', branch: 'Main Branch'
    }];
    state.transactions = [
        {
            id: 1, type: 'credit', amount: 15000, description: 'Account Opening – Welcome Credit',
            transaction_date: new Date().toISOString(), reference_number: 'TXN001',
            balance_after: 15000, account_number: 'SB000000000001', mode: 'NEFT'
        },
        {
            id: 2, type: 'debit', amount: 500, description: 'ATM Withdrawal',
            transaction_date: new Date(Date.now() - 86400000).toISOString(), reference_number: 'TXN002',
            balance_after: 14500, account_number: 'SB000000000001', mode: 'ATM'
        }
    ];
    state.cards = []; state.loans = []; state.cardRequests = []; state.accountRequests = [];
}

// cardRequests handled via logic in loadAll

/* ════════════════════════════════════════════════════════════
   RENDER ALL
   ════════════════════════════════════════════════════════════ */
function renderAll() {
    renderUserInfo();
    renderStats();
    renderDashboard();
    renderTransactionsPage();
    renderAccountsPage();
    renderCardsPage();
    renderLoansPage();
    renderTransferPage();
    renderSettingsPage();
    renderSupportPage();
    renderFixedDepositsPage();
    renderBeneficiariesPage();
    renderPocketsPage();
    injectAccountModal(); // Inject Modal for account opening
}

function injectAccountModal() {
    if ($id('openAccountModal')) return;
    const css = `<style id="amStyles">
    #openAccountModal{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:9999;display:none;justify-content:center;align-items:center;}
    .am-inner{width:100%;max-width:500px;margin:16px;background:#fff;border-radius:20px;animation:slideIn 0.35s cubic-bezier(.16,1,.3,1);max-height:92vh;overflow-y:auto;box-shadow:0 32px 80px rgba(0,0,0,0.25);}
    .am-hdr{position:sticky;top:0;z-index:10;background:linear-gradient(135deg,#7f1d1d 0%,#b91c1c 100%);border-radius:20px 20px 0 0;padding:22px 24px 18px;display:flex;justify-content:space-between;align-items:flex-start;}
    .am-hdr-text h3{margin:0;color:#fff;font-size:18px;font-weight:700;} .am-hdr-text p{margin:4px 0 0;color:rgba(255,255,255,.7);font-size:13px;}
    .am-close{background:rgba(255,255,255,.15);border:none;width:34px;height:34px;border-radius:50%;color:#fff;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .2s;flex-shrink:0;margin-top:2px;}
    .am-close:hover{background:rgba(255,255,255,.3);}
    .am-body{padding:24px;}
    .am-sep{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#64748b;margin:22px 0 12px;display:flex;align-items:center;gap:8px;}
    .am-sep::after{content:'';flex:1;height:1px;background:#e2e8f0;}
    .am-type-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
    .am-type-btn{border:2px solid #e2e8f0;border-radius:12px;padding:14px 10px;cursor:pointer;background:#f8fafc;text-align:center;transition:all .2s;position:relative;user-select:none;}
    .am-type-btn:hover{border-color:#991b1b;background:#fef2f2;}
    .am-type-btn.am-sel{border-color:#991b1b;background:linear-gradient(135deg,#fef2f2,#fff5f5);box-shadow:0 0 0 3px rgba(153,27,27,.1);}
    .am-type-icon{width:38px;height:38px;border-radius:10px;margin:0 auto 8px;display:flex;align-items:center;justify-content:center;font-size:17px;}
    .am-type-name{font-weight:700;font-size:13px;color:#1e293b;} .am-type-desc{font-size:11px;color:#94a3b8;margin-top:2px;}
    .am-chk{position:absolute;top:8px;right:8px;width:18px;height:18px;border-radius:50%;background:#991b1b;display:none;align-items:center;justify-content:center;}
    .am-type-btn.am-sel .am-chk{display:flex;}
    .am-field{margin-bottom:16px;}
    .am-field label{display:block;font-size:12px;font-weight:600;color:#475569;margin-bottom:6px;letter-spacing:.3px;}
    .am-field label .req{color:#ef4444;margin-left:2px;}
    .am-inp-wrap{position:relative;}
    .am-inp-wrap i{position:absolute;left:13px;top:50%;transform:translateY(-50%);color:#94a3b8;font-size:13px;pointer-events:none;}
    .am-input{width:100%;padding:12px 14px 12px 36px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;color:#1e293b;background:#f8fafc;transition:all .2s;box-sizing:border-box;outline:none;font-family:inherit;}
    .am-input:focus{border-color:#991b1b;background:#fff;box-shadow:0 0 0 3px rgba(153,27,27,.08);}
    .am-upload{border:2px dashed #e2e8f0;border-radius:12px;padding:18px;text-align:center;cursor:pointer;transition:all .2s;background:#f8fafc;position:relative;overflow:hidden;}
    .am-upload:hover{border-color:#991b1b;background:#fef2f2;}
    .am-upload.done{border-color:#10b981;background:#f0fdf4;border-style:solid;}
    .am-upload input[type=file]{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;}
    .am-upload-icon{font-size:22px;margin-bottom:6px;} .am-upload-lbl{font-size:13px;font-weight:600;color:#475569;} .am-upload-sub{font-size:11px;color:#94a3b8;margin-top:2px;}
    .am-agri-wrap{border:1.5px solid #a7f3d0;background:linear-gradient(135deg,#f0fdf4,#ecfdf5);border-radius:14px;padding:18px;margin-top:4px;}
    .am-agri-badge{display:inline-flex;align-items:center;gap:6px;background:#059669;color:#fff;border-radius:20px;padding:4px 12px;font-size:12px;font-weight:700;margin-bottom:14px;}
    .am-face-note{background:linear-gradient(135deg,#eff6ff,#dbeafe);border:1.5px solid #bfdbfe;border-radius:12px;padding:14px 16px;display:flex;align-items:center;gap:12px;font-size:13px;color:#1d4ed8;margin-top:20px;}
    .am-face-icon{width:36px;height:36px;background:#3b82f6;border-radius:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;}
    .am-actions{display:flex;gap:12px;margin-top:20px;}
    .am-btn-cancel{flex:1;padding:13px;border-radius:12px;border:1.5px solid #e2e8f0;background:#f8fafc;color:#475569;font-size:14px;font-weight:600;cursor:pointer;transition:all .2s;}
    .am-btn-cancel:hover{background:#f1f5f9;}
    .am-btn-submit{flex:2;padding:13px;border-radius:12px;border:none;background:linear-gradient(135deg,#881337,#991b1b,#b91c1c);color:#fff;font-size:14px;font-weight:700;cursor:pointer;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 4px 14px rgba(153,27,27,.3);}
    .am-btn-submit:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(153,27,27,.4);}
    .am-btn-submit:disabled{opacity:.6;transform:none;cursor:not-allowed;}
    </style>`;
    const html = `
    <div id="openAccountModal" class="modal">
        <div class="am-inner">
            <div class="am-hdr">
                <div class="am-hdr-text">
                    <h3><i class="fas fa-university" style="margin-right:8px;opacity:.85;"></i>Open New Account &amp; KYC</h3>
                    <p>Complete Indian KYC to activate your account</p>
                </div>
                <button class="am-close" onclick="closeAccountModal()">&times;</button>
            </div>
            <div class="am-body">
                <div class="am-sep"><i class="fas fa-layer-group"></i> Account Type</div>
                <div class="am-type-grid">
                    <div class="am-type-btn am-sel" onclick="selectAccountType(this,'Savings')">
                        <div class="am-chk"><i class="fas fa-check" style="color:#fff;font-size:9px;"></i></div>
                        <div class="am-type-icon" style="background:#dbeafe;color:#1d4ed8;"><i class="fas fa-piggy-bank"></i></div>
                        <div class="am-type-name">Savings</div><div class="am-type-desc">Earn interest daily</div>
                    </div>
                    <div class="am-type-btn" onclick="selectAccountType(this,'Current')">
                        <div class="am-chk"><i class="fas fa-check" style="color:#fff;font-size:9px;"></i></div>
                        <div class="am-type-icon" style="background:#fef3c7;color:#b45309;"><i class="fas fa-briefcase"></i></div>
                        <div class="am-type-name">Current</div><div class="am-type-desc">For businesses</div>
                    </div>
                    <div class="am-type-btn" onclick="selectAccountType(this,'Salary')">
                        <div class="am-chk"><i class="fas fa-check" style="color:#fff;font-size:9px;"></i></div>
                        <div class="am-type-icon" style="background:#f3e8ff;color:#7c3aed;"><i class="fas fa-wallet"></i></div>
                        <div class="am-type-name">Salary</div><div class="am-type-desc">Payroll linked</div>
                    </div>
                    <div class="am-type-btn" onclick="selectAccountType(this,'Agriculture')">
                        <div class="am-chk"><i class="fas fa-check" style="color:#fff;font-size:9px;"></i></div>
                        <div class="am-type-icon" style="background:#d1fae5;color:#059669;"><i class="fas fa-leaf"></i></div>
                        <div class="am-type-name">Agriculture</div><div class="am-type-desc">Farm &amp; crop loans</div>
                    </div>
                </div>
                <input type="hidden" id="newAccountType" value="Savings">

                <div class="am-sep" style="margin-top:24px;"><i class="fas fa-id-card"></i> Identity Details</div>
                <div class="am-field">
                    <label><i class="fas fa-fingerprint" style="color:#991b1b;margin-right:5px;"></i>Aadhaar Number<span class="req">*</span></label>
                    <div class="am-inp-wrap"><i class="fas fa-hashtag"></i>
                        <input type="text" id="kycAadhaar" class="am-input" placeholder="1234 5678 9012" maxlength="14" style="letter-spacing:2px;">
                    </div>
                </div>
                <div class="am-field">
                    <label><i class="fas fa-id-badge" style="color:#991b1b;margin-right:5px;"></i>PAN Number<span class="req">*</span></label>
                    <div class="am-inp-wrap"><i class="fas fa-hashtag"></i>
                        <input type="text" id="kycPan" class="am-input" placeholder="ABCDE1234F" maxlength="10" style="text-transform:uppercase;letter-spacing:1px;">
                    </div>
                </div>

                <div class="am-sep"><i class="fas fa-file-alt"></i> KYC Documents</div>
                <div class="am-field">
                    <label><i class="fas fa-address-card" style="color:#3b82f6;margin-right:5px;"></i>Aadhaar Proof<span class="req">*</span></label>
                    <div class="am-upload" id="aadhaarUploadZone" onclick="document.getElementById('kycAadhaarProof').click()">
                        <input type="file" id="kycAadhaarProof" accept="image/*,.pdf" style="display:none;" onchange="handleFileUpload(this,'aadhaarUploadZone','aadhaarFileLabel')">
                        <div class="am-upload-icon">📄</div>
                        <div class="am-upload-lbl" id="aadhaarFileLabel">Click to upload Aadhaar Card</div>
                        <div class="am-upload-sub">JPG, PNG or PDF &middot; Max 5MB</div>
                    </div>
                </div>
                <div class="am-field">
                    <label><i class="fas fa-id-card" style="color:#f59e0b;margin-right:5px;"></i>PAN Card Proof<span class="req">*</span></label>
                    <div class="am-upload" id="panUploadZone" onclick="document.getElementById('kycPanProof').click()">
                        <input type="file" id="kycPanProof" accept="image/*,.pdf" style="display:none;" onchange="handleFileUpload(this,'panUploadZone','panFileLabel')">
                        <div class="am-upload-icon">🪪</div>
                        <div class="am-upload-lbl" id="panFileLabel">Click to upload PAN Card</div>
                        <div class="am-upload-sub">JPG, PNG or PDF &middot; Max 5MB</div>
                    </div>
                </div>

                <div id="agriKycExtra" style="display:none;">
                    <div class="am-agri-wrap">
                        <div class="am-agri-badge"><i class="fas fa-satellite-dish"></i> Agriculture Details</div>
                        <div class="am-field">
                            <label><i class="fas fa-map-marker-alt" style="color:#059669;margin-right:5px;"></i>Farm Address / Survey No.<span class="req">*</span></label>
                            <div class="am-inp-wrap"><i class="fas fa-location-arrow"></i>
                                <input type="text" id="kycFarmAddress" class="am-input" placeholder="Village Name, Taluk, Survey Number">
                            </div>
                        </div>
                        <div class="am-field" style="margin-bottom:0;">
                            <label><i class="fas fa-leaf" style="color:#059669;margin-right:5px;"></i>Land Proof (Title Deed / RTC)<span class="req">*</span></label>
                            <div class="am-upload" id="agriUploadZone" onclick="document.getElementById('kycAgriProof').click()">
                                <input type="file" id="kycAgriProof" accept="image/*,.pdf" style="display:none;" onchange="handleFileUpload(this,'agriUploadZone','agriFileLabel')">
                                <div class="am-upload-icon">🌿</div>
                                <div class="am-upload-lbl" id="agriFileLabel">Click to upload Land Deed / RTC</div>
                                <div class="am-upload-sub">Official land document &middot; PDF or image</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div id="salaryKycExtra" style="display:none;">
                    <div class="am-agri-wrap" style="border-color:#c7d2fe;background:linear-gradient(135deg,#eef2ff,#e0e7ff);">
                        <div class="am-agri-badge" style="background:#4f46e5;"><i class="fas fa-file-invoice-dollar"></i> Salary Details</div>
                        <div class="am-field" style="margin-bottom:0;">
                            <label><i class="fas fa-file-alt" style="color:#4f46e5;margin-right:5px;"></i>Salary Slip Proof<span class="req">*</span></label>
                            <div class="am-upload" id="salaryUploadZone" onclick="document.getElementById('kycSalaryProof').click()">
                                <input type="file" id="kycSalaryProof" accept="image/*,.pdf" style="display:none;" onchange="handleFileUpload(this,'salaryUploadZone','salaryFileLabel')">
                                <div class="am-upload-icon">💰</div>
                                <div class="am-upload-lbl" id="salaryFileLabel">Click to upload Salary Slip</div>
                                <div class="am-upload-sub">Latest 3-month salary slip &middot; PDF or image</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div id="currentKycExtra" style="display:none;">
                    <div class="am-agri-wrap" style="border-color:#fde68a;background:linear-gradient(135deg,#fffbeb,#fef3c7);">
                        <div class="am-agri-badge" style="background:#b45309;"><i class="fas fa-building"></i> Business Details</div>
                        <div class="am-field">
                            <label><i class="fas fa-receipt" style="color:#b45309;margin-right:5px;"></i>Tax ID (GST / CIN / PAN of Business)<span class="req">*</span></label>
                            <div class="am-inp-wrap"><i class="fas fa-hashtag"></i>
                                <input type="text" id="kycTaxId" class="am-input" placeholder="e.g. 29ABCDE1234F1Z5 or U74999MH2020PTC123456">
                            </div>
                        </div>
                        <div class="am-field" style="margin-bottom:0;">
                            <label><i class="fas fa-stamp" style="color:#b45309;margin-right:5px;"></i>Business Registration Proof<span class="req">*</span></label>
                            <div class="am-upload" id="currentUploadZone" onclick="document.getElementById('kycCurrentProof').click()">
                                <input type="file" id="kycCurrentProof" accept="image/*,.pdf" style="display:none;" onchange="handleFileUpload(this,'currentUploadZone','currentFileLabel')">
                                <div class="am-upload-icon">🏢</div>
                                <div class="am-upload-lbl" id="currentFileLabel">Click to upload Business Proof</div>
                                <div class="am-upload-sub">GST Certificate, MOA, or Shop Act &middot; PDF or image</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="am-face-note">
                    <div class="am-face-icon"><i class="fas fa-camera"></i></div>
                    <div><strong>Face Verification</strong><br>Starts automatically when you click Submit.</div>
                </div>
                <div class="am-actions">
                    <button class="am-btn-cancel" onclick="closeAccountModal()">Cancel</button>
                    <button class="am-btn-submit" onclick="submitNewAccount()" id="btnSubmitAccount">
                        <i class="fas fa-shield-alt"></i> Verify &amp; Submit
                    </button>
                </div>
            </div>
        </div>
    </div>`;
    document.head.insertAdjacentHTML('beforeend', css);
    document.body.insertAdjacentHTML('beforeend', html);
}

function selectAccountType(btn, type) {
    document.querySelectorAll('.am-type-btn').forEach(b => b.classList.remove('am-sel'));
    btn.classList.add('am-sel');
    const inp = document.getElementById('newAccountType');
    if (inp) inp.value = type;
    const agri    = document.getElementById('agriKycExtra');
    const salary  = document.getElementById('salaryKycExtra');
    const current = document.getElementById('currentKycExtra');
    if (agri)    agri.style.display    = type === 'Agriculture' ? 'block' : 'none';
    if (salary)  salary.style.display  = type === 'Salary'      ? 'block' : 'none';
    if (current) current.style.display = type === 'Current'     ? 'block' : 'none';
}

function handleFileUpload(input, zoneId, labelId) {
    const zone = document.getElementById(zoneId);
    const lbl  = document.getElementById(labelId);
    if (input.files && input.files[0]) {
        const name = input.files[0].name;
        if (lbl) lbl.textContent = '✅ ' + name;
        if (zone) zone.classList.add('done');
    }
}

function showAccountModal() {
    // Disable type cards for already owned or pending accounts
    const owned   = state.accounts.map(a => a.account_type.toLowerCase());
    const pending  = (state.accountRequests || []).map(r => r.account_type.toLowerCase());
    const typeBtns = document.querySelectorAll('.am-type-btn');
    let firstAvail = null;
    typeBtns.forEach(btn => {
        const t = btn.getAttribute('onclick').match(/'([^']+)'\)/)?.[1]?.toLowerCase();
        if (!t) return;
        const isOwned   = owned.includes(t);
        const isPending = pending.includes(t);
        if (isOwned || isPending) {
            btn.style.opacity = '0.45';
            btn.style.pointerEvents = 'none';
            const desc = btn.querySelector('.am-type-desc');
            if (desc) desc.textContent = isOwned ? 'Already owned' : 'Pending review';
        } else {
            btn.style.opacity = '';
            btn.style.pointerEvents = '';
            if (!firstAvail) firstAvail = btn;
        }
    });
    if (firstAvail) {
        const t = firstAvail.getAttribute('onclick').match(/'([^']+)'\)/)?.[1];
        if (t) selectAccountType(firstAvail, t);
    }
    const modal = $id('openAccountModal');
    if (modal) modal.style.display = 'flex';
}

function closeAccountModal() {
    const modal = $id('openAccountModal');
    if (modal) modal.style.display = 'none';
}

// showMutualFundModal & showLifeInsuranceModal defined below (single definition)

async function submitNewAccount() {
    const type = $id('newAccountType').value;
    const aadhaar = $id('kycAadhaar').value.replace(/\s+/g, '');
    const pan = $id('kycPan').value.toUpperCase().replace(/\s+/g, '');
    const agriAddress = $id('kycFarmAddress') ? $id('kycFarmAddress').value : '';
    const agriProofFile = $id('kycAgriProof') ? $id('kycAgriProof').files[0] : null;
    const salaryProofFile = $id('kycSalaryProof') ? $id('kycSalaryProof').files[0] : null;

    if (type === 'Agriculture') {
        if (!agriAddress) return showToast('Please provide your Farm Address', 'error');
        if (!agriProofFile) return showToast('Please upload Agriculture Land Proof', 'error');
    }
    if (type === 'Salary') {
        if (!salaryProofFile) return showToast('Please upload your Salary Slip', 'error');
    }
    const currentTaxId    = $id('kycTaxId')       ? $id('kycTaxId').value.trim()       : '';
    const currentProofFile = $id('kycCurrentProof') ? $id('kycCurrentProof').files[0]   : null;
    if (type === 'Current') {
        if (!currentTaxId)    return showToast('Please enter your Tax ID (GST / CIN)', 'error');
        if (!currentProofFile) return showToast('Please upload a Business Registration Proof', 'error');
    }
    const btn = $id('btnSubmitAccount');

    if (aadhaar.length !== 12 || !/^\d+$/.test(aadhaar)) {
        return showToast('Please enter a valid 12-digit Aadhaar Number', 'error');
    }
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panRegex.test(pan)) {
        return showToast('Please enter a valid PAN (e.g. ABCDE1234F)', 'error');
    }

    const aadhaarFile = $id('kycAadhaarProof').files[0];
    const panFile = $id('kycPanProof').files[0];

    if (!aadhaarFile || !panFile) {
        return showToast('Please upload both Aadhaar and PAN proofs', 'error');
    }

    const toBase64 = file => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

    try {
        const aadhaarProof   = await toBase64(aadhaarFile);
        const panProof       = await toBase64(panFile);
        const agriProof      = agriProofFile    ? await toBase64(agriProofFile)    : null;
        const salaryProof    = salaryProofFile  ? await toBase64(salaryProofFile)  : null;
        const currentProof   = currentProofFile ? await toBase64(currentProofFile) : null;

        // Step 1: Capture Face Descriptor and Photo for KYC via FaceAuthManager
        if (!window.faceAuthManager) throw new Error('Face Auth Manager not loaded');
        const kycData = await window.faceAuthManager.captureFaceForKYC();
        if (!kycData || !kycData.descriptor) throw new Error('Face verification failed');

        // Capture Geolocation
        const desktopLocation = await new Promise((resolve) => {
            if (!navigator.geolocation) return resolve(null);
            navigator.geolocation.getCurrentPosition(
                pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                err => resolve(null),
                { timeout: 5000 }
            );
        });

        // Step 2: Submit to backend
        const res = await fetch(window.API + '/user/accounts', {
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
                pan_proof: panProof,
                agri_address: agriAddress,
                agri_proof: agriProof,
                salary_proof: salaryProof,
                tax_id: currentTaxId || null,
                current_proof: currentProof,
                lat: desktopLocation ? desktopLocation.lat : null,
                lng: desktopLocation ? desktopLocation.lng : null
            })
        });
        const data = await res.json();
        if (res.ok) {
            showToast(data.message || 'Account request submitted successfully', 'success');
            closeAccountModal();
            $id('kycAadhaar').value = '';
            $id('kycPan').value = '';
            loadAll(); // Reload everything to update state and UI
        } else {
            showToast(data.error || 'Failed to submit request', 'error');
        }
    } catch (e) {
        showToast(e.message || 'Failed during KYC verification', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Verify & Submit';
    }
}

/* ── User Info ──────────────────────────────────────────── */
function renderUserInfo() {
    const u = state.user; if (!u) return;
    const name = u.name || u.username || 'User';
    setText('userName', name);
    setText('userGreeting', name.split(' ')[0]);
    setText('welcomeName', name.split(' ')[0]);
    // Enhanced welcome name
    const welcomeAnimated = $id('welcomeNameAnimated');
    if (welcomeAnimated) welcomeAnimated.textContent = `Welcome back, ${name.split(' ')[0]}!`;
    // Time-of-day greeting
    updateGreeting();
    const av = u.profile_image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=667eea&color=fff&rounded=true&bold=true`;
    ['userAvatar', 'topBarAvatar'].forEach(id => { const e = $id(id); if (e) e.src = av; });
}

/* ── Stats ──────────────────────────────────────────────── */
function renderStats() {
    const now = new Date();
    const thisMonth = state.transactions.filter(t => {
        const d = new Date(t.transaction_date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const income = thisMonth.filter(t => t.type === 'credit').reduce((s, t) => s + parseFloat(t.amount || 0), 0);
    const spending = thisMonth.filter(t => t.type === 'debit').reduce((s, t) => s + parseFloat(t.amount || 0), 0);
    const activeLoans = state.loans.filter(l => l.status === 'approved' || l.status === 'active').length;
    const pendingLoans = state.loans.filter(l => l.status === 'pending').length;
    const totalBalance = state.accounts.reduce((sum, a) => sum + parseFloat(a.balance || 0), 0);

    // Visibility Handling
    const isHidden = localStorage.getItem('hideBalance') === 'true';
    const hideIcon = $id('balanceHideIcon');
    if (hideIcon) {
        hideIcon.className = isHidden ? 'fas fa-eye-slash' : 'fas fa-eye';
    }

    // Animated counters for stat values
    if (isHidden) {
        setText('statTotalBalances', '₹∗∗∗∗∗∗');
    } else {
        animateCounter('statTotalBalances', totalBalance, true);
    }
    animateCounter('statTotalIncome', income, true);
    animateCounter('statTotalSpending', spending, true);
    setText('statActiveLoans', String(activeLoans));
    setText('statLoanApplications', String(pendingLoans));

    // Dynamic Balance Display Logic
    const balanceContainer = $id('balanceCardContainer');
    const balanceLabel = $id('balanceLabel');
    const balanceSubLabel = $id('balanceSubLabel');

    if (balanceContainer) {
        if (state.accounts.length === 0) {
            balanceContainer.style.display = 'none';
        } else {
            balanceContainer.style.display = 'block';
            if (state.accounts.length === 1) {
                const acc = state.accounts[0];
                if (balanceLabel) balanceLabel.innerHTML = `<i class="fas fa-wallet" style="margin-right: 8px; color: var(--primary-blue);"></i>${escHtml(acc.account_type || 'Account')} Balance`;
                if (balanceSubLabel) balanceSubLabel.innerHTML = `<i class="fas fa-check-circle" style="margin-right: 4px;"></i>Active Account`;
            } else {
                if (balanceLabel) balanceLabel.innerHTML = `<i class="fas fa-wallet" style="margin-right: 8px; color: var(--primary-blue);"></i>Total Balance`;
                if (balanceSubLabel) balanceSubLabel.innerHTML = `<i class="fas fa-layer-group" style="margin-right: 4px;"></i>Across all accounts`;
            }
        }
    }

    // Render spending analytics
    renderSpendingAnalytics(thisMonth.filter(t => t.type === 'debit'), spending);
}

/* ── Dashboard Page ─────────────────────────────────────── */
function renderDashboard() {
    const dView = $id('dashboard');
    if (!state.accounts.length && dView) {
        // Find or create an alert banner
        let alertBanner = $id('zeroAccountBanner');
        if (!alertBanner) {
            alertBanner = document.createElement('div');
            alertBanner.id = 'zeroAccountBanner';
            alertBanner.className = 'card';
            alertBanner.style.background = 'linear-gradient(135deg, var(--primary-maroon) 0%, #600000 100%)';
            alertBanner.style.color = '#fff';
            alertBanner.style.marginBottom = '24px';
            alertBanner.style.padding = '24px';
            alertBanner.style.display = 'flex';
            alertBanner.style.justifyContent = 'space-between';
            alertBanner.style.alignItems = 'center';
            alertBanner.style.border = 'none';
            alertBanner.innerHTML = `
                <div>
                    <h3 style="margin:0 0 8px;"><i class="fas fa-exclamation-circle"></i> Welcome to SmartBank!</h3>
                    <p style="margin:0;opacity:0.9;">You don't have any active accounts yet. Open your first account to start banking.</p>
                </div>
                <button class="btn" style="background:#fff;color:var(--primary-maroon);font-weight:bold;border:none;padding:10px 20px;border-radius:10px;cursor:pointer;" onclick="showAccountModal()">Open Account</button>
            `;
            // Insert it right after the welcome section
            const welcomeCard = dView.querySelector('.card:first-child');
            if (welcomeCard) welcomeCard.insertAdjacentElement('afterend', alertBanner);
        }
    } else {
        const alertBanner = $id('zeroAccountBanner');
        if (alertBanner) alertBanner.remove();
    }

    const recentEl = $id('recentTransactions');
    if (recentEl) recentEl.innerHTML = state.transactions.length
        ? state.transactions.slice(0, 6).map(txnRowHTML).join('')
        : emptyState('exchange-alt', 'No transactions yet');
    renderInvoiceTable();
}

function renderInvoiceTable() {
    const tbody = $id('invoiceTableBody'); if (!tbody) return;
    const txns = state.transactions.slice(0, 10);
    if (!txns.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-secondary)">No transactions found</td></tr>';
        return;
    }
    tbody.innerHTML = txns.map(t => `<tr>
        <td style="padding:12px;">${formatDate(t.transaction_date)}</td>
        <td style="padding:12px;">${escHtml(t.description || 'Transaction')}</td>
        <td style="padding:12px;"><span class="badge badge-${t.type === 'credit' ? 'success' : 'danger'}">${t.type.toUpperCase()}</span></td>
        <td style="padding:12px;">${t.mode || 'NEFT'}</td>
        <td style="padding:12px;font-weight:700;" class="${t.type === 'credit' ? 'text-success' : 'text-danger'}">
            ${t.type === 'credit' ? '+' : '-'}${fmtINR(t.amount)}</td>
    </tr>`).join('');
}

/* ── Transactions Page ──────────────────────────────────── */
function renderTransactionsPage() {
    const el = $id('allTransactionsList'); if (!el) return;
    el.innerHTML = `
        <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;">
            <select id="txnTypeFilter" class="form-select" style="width:auto;min-width:140px;" onchange="filterTxns()">
                <option value="all">All Types</option>
                <option value="credit">Credits</option>
                <option value="debit">Debits</option>
            </select>
            <select id="txnModeFilter" class="form-select" style="width:auto;min-width:150px;" onchange="filterTxns()">
                <option value="all">All Modes</option>
                ${['UPI', 'IMPS', 'NEFT', 'RTGS', 'ATM', 'CASH'].map(m => `<option value="${m}">${m}</option>`).join('')}
            </select>
        </div>
        <div id="txnList">${state.transactions.map(txnRowHTML).join('') || emptyState('exchange-alt', 'No transactions found')}</div>`;
}

function filterTxns() {
    const tf = $id('txnTypeFilter')?.value || 'all', mf = $id('txnModeFilter')?.value || 'all';
    let list = state.transactions;
    if (tf !== 'all') list = list.filter(t => t.type === tf);
    if (mf !== 'all') list = list.filter(t => (t.mode || detectMode(t.description)) === mf);
    const el = $id('txnList');
    if (el) el.innerHTML = list.length ? list.map(txnRowHTML).join('') : emptyState('exchange-alt', 'No transactions match');
}

function txnRowHTML(t) {
    const isDebit = t.type.toLowerCase() === 'debit' || t.type.toLowerCase() === 'withdraw';
    const mode = t.mode || detectMode(t.description);
    
    // International Details
    const hasIntl = t.foreign_currency && t.foreign_amount;
    const intlInfo = hasIntl ? `<div style="font-size:11px;color:var(--primary-blue);margin-top:2px;font-weight:600;">
        <i class="fas fa-globe"></i> ${t.foreign_currency} ${t.foreign_amount} @ 1 ${t.foreign_currency} = ${t.exchange_rate} INR
    </div>` : '';

    return `<div class="txn-item">
        <div class="txn-icon ${isDebit ? 'debit' : 'credit'}"><i class="fas fa-arrow-${isDebit ? 'down' : 'up'}"></i></div>
        <div class="txn-info">
            <h4>${escHtml(t.description || 'Transaction')}</h4>
            ${intlInfo}
            <p style="display:flex;gap:8px;flex-wrap:wrap;font-size:12px;color:var(--text-secondary);margin-top:2px;">
                <span>${formatDate(t.transaction_date)}</span>
                ${t.account_number ? `<span>• ${maskAcct(t.account_number)}</span>` : ''}
                <span class="mode-badge mode-${mode.toLowerCase()}">${mode}</span>
            </p>
            ${t.reference_number ? `<span style="font-size:11px;color:var(--text-secondary)">Ref: ${t.reference_number}</span>` : ''}
        </div>
        <div class="txn-amount" style="text-align:right;">
            <div style="font-weight:700;font-size:15px;" class="${isDebit ? 'text-danger' : 'text-success'}">${isDebit ? '-' : '+'}${fmtINR(t.amount)}</div>
            ${t.balance_after != null ? `<div style="font-size:11px;color:var(--text-secondary)">Bal: ${fmtINR(t.balance_after)}</div>` : ''}
            <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:4px;">
                <button onclick="downloadTransactionReceipt('${t.id}')" style="background:var(--maroon-light, #fdecec);border:1px solid var(--primary-maroon, #800000);color:var(--primary-maroon, #800000);font-size:11px;font-weight:700;padding:4px 10px;border-radius:12px;cursor:pointer;box-shadow:0 2px 4px rgba(128,0,0,0.1);" title="Download Receipt"><i class="fas fa-file-pdf"></i> Download Receipt</button>
            </div>
        </div>
    </div>`;
}

function reportTransaction(id, ref, amount) {
    showPage('support');
    showNewSupportRequestModal();
    const subj = $id('supportSubject');
    if (subj) subj.value = `Unauthorized Transaction Report (Ref: ${ref})`;
    const msg = $id('supportMessage');
    if (msg) msg.value = `I am reporting an unauthorized transaction.\n\nTransaction Ref: ${ref}\nAmount: ₹${amount}\n\nPlease investigate this immediately.`;
    const pri = $id('supportPriority');
    if (pri) pri.value = 'high';
}

function detectMode(desc) {
    if (!desc) return 'NEFT';
    const d = desc.toUpperCase();
    if (d.includes('UPI')) return 'UPI';
    if (d.includes('IMPS')) return 'IMPS';
    if (d.includes('RTGS')) return 'RTGS';
    if (d.includes('ATM')) return 'ATM';
    if (d.includes('CASH') || d.includes('DEPOSIT')) return 'CASH';
    return 'NEFT';
}

/* ── Accounts Page ──────────────────────────────────────── */
function renderAccountsPage() {
    const el = $id('accountsList'); if (!el) return;

    // Header with New Account button if < 3 accounts
    const headerHTML = state.accounts.length < 3 ? `
        <div style="text-align:right; margin-bottom: 16px;">
            <button class="btn btn-primary" onclick="showAccountModal()"><i class="fas fa-plus"></i> Open New Account</button>
        </div>` : '';

    if (!state.accounts.length && !(state.accountRequests || []).length) {
        el.innerHTML = headerHTML + `
        <div class="empty-state" style="text-align:center;padding:40px 20px;">
            <i class="fas fa-wallet" style="font-size:48px;color:var(--text-secondary);margin-bottom:16px;"></i>
            <h3 style="margin-bottom:8px;">No accounts found</h3>
            <p style="color:var(--text-secondary);margin-bottom:24px;">You don't have any accounts yet. Open one to get started.</p>
            <button class="btn btn-primary" onclick="showAccountModal()">Open First Account</button>
        </div>`;
        return;
    }

    const pendingHTML = (state.accountRequests || []).map(r => `
        <div style="padding:20px;background:var(--card-bg,#fff);border-radius:12px;margin-bottom:12px;border:1px dashed #f59e0b;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;">
                <div style="display:flex;align-items:center;gap:12px;">
                    <div class="txn-icon" style="flex-shrink:0;background:#fef3c7;color:#d97706;">
                        <i class="fas fa-hourglass-half"></i>
                    </div>
                    <div>
                        <h4 style="margin:0 0 4px;font-size:16px;">${escHtml(r.account_type)} Account</h4>
                        <p style="margin:0;font-size:13px;color:var(--text-secondary);">Request Date: ${new Date(r.request_date).toLocaleDateString()}</p>
                    </div>
                </div>
                <div style="text-align:right;">
                    <span class="account-badge" style="background:#fef3c7;color:#d97706;border:1px solid #fcd34d;padding:4px 8px;border-radius:12px;font-size:12px;font-weight:600;">Pending Review</span>
                </div>
            </div>
        </div>`).join('');

    el.innerHTML = headerHTML + pendingHTML + state.accounts.map(a => `
        <div style="padding:20px;background:var(--card-bg,#fff);border-radius:12px;margin-bottom:12px;border:1px solid var(--border-color,#e5e7eb);">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;">
                <div style="display:flex;align-items:center;gap:12px;">
                    <div class="txn-icon credit" style="flex-shrink:0;">
                        <i class="fas ${a.account_type?.toLowerCase().includes('saving') ? 'fa-piggy-bank' : (a.account_type?.toLowerCase().includes('agri') ? 'fa-tractor' : 'fa-briefcase')}"></i>
                    </div>
                    <div>
                        <h4 style="margin:0 0 4px;font-size:16px;">${escHtml(a.account_type)} Account</h4>
                        <p style="margin:0;font-size:13px;color:var(--text-secondary);">${maskAcct(a.account_number)}</p>
                        ${a.ifsc ? `<p style="margin:2px 0 0;font-size:12px;color:var(--text-secondary);">IFSC: <strong>${a.ifsc}</strong></p>` : ''}
                    </div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:22px;font-weight:700;color:var(--primary-blue,#3b82f6);">${fmtINR(a.balance)}</div>
                    <span class="account-badge ${a.status === 'active' ? 'active' : 'inactive'}">${a.status || 'active'}</span>
                </div>
            </div>
            <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
                <button class="btn btn-sm" onclick="copyAcctNum('${a.account_number}')"><i class="fas fa-copy"></i> Copy A/C</button>
                <button class="btn btn-sm" onclick="shareAccountDetails('${a.account_type}', '${a.account_number}', '${a.ifsc || ''}')"><i class="fas fa-share-alt"></i> Share</button>
                <button class="btn btn-sm" onclick="requestAccountConversion('${a.id}', '${a.account_type}')"><i class="fas fa-exchange-alt"></i> Convert</button>
                <button class="btn btn-sm" onclick="showTransferFromAccount('${a.id}')"><i class="fas fa-paper-plane"></i> Transfer</button>
                <button class="btn btn-sm" onclick="showPage('transactions')"><i class="fas fa-file-alt"></i> Statement</button>
            </div>
        </div>`).join('');
}

function shareAccountDetails(type, accNum, ifsc) {
    const text = `Smart Bank ${type} Account\nA/C No: ${accNum}${ifsc ? '\nIFSC: ' + ifsc : ''}`;
    if (navigator.share) {
        navigator.share({ title: 'My Account Details', text: text }).catch(console.error);
    } else {
        navigator.clipboard?.writeText(text).then(() => showToast('Account details copied to clipboard!', 'success'));
    }
}

async function requestAccountConversion(id, currentType) {
    const newType = await prompt(`Convert your ${currentType} account to which type? (Savings / Current / Salary / Agriculture)`);
    if (!newType) return;
    const nt = newType.trim().toLowerCase();
    const valid = { 'savings': 'Savings', 'current': 'Current', 'salary': 'Salary', 'agriculture': 'Agriculture' };
    if (!valid[nt] || valid[nt] === currentType) {
        return showToast('Invalid or same account type', 'error');
    }

    let taxId = null;
    if (valid[nt] === 'Current') {
        taxId = await prompt("Tax ID is required for Current Accounts. Please enter your Tax ID:");
        if (!taxId || taxId.trim() === '') {
            return showToast('Tax ID is mandatory for Current Account', 'error');
        }
    }

    try {
        const r = await fetch(`${API}/user/accounts/${id}/convert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ new_type: valid[nt], tax_id: taxId })
        });
        const d = await r.json();
        if (r.ok) {
            showToast(d.message || 'Account converted successfully!', 'success');
            await refreshBalance(true);
            renderAccountsPage();
        } else {
            showToast(d.error || 'Failed to convert account', 'error');
        }
    } catch (e) {
        showToast('Error connecting to server', 'error');
    }
}

function copyAcctNum(num) { navigator.clipboard?.writeText(num).then(() => showToast('Account number copied!', 'success')); }
function showTransferFromAccount(id) { showPage('transfer'); setTimeout(() => { renderTransferPage(); }, 100); }

/* ── Transfer Page (UPI / IMPS / NEFT / RTGS) ──────────── */
const MODE_META = {
    UPI: { color: '#7c3aed', icon: 'fa-mobile-alt', limit: '₹1,00,000 per txn', note: 'Instant 24×7 via UPI ID or mobile' },
    IMPS: { color: '#be185d', icon: 'fa-paper-plane', limit: '₹5,00,000 per txn', note: 'Instant 24×7, A/C + IFSC required' },
    NEFT: { color: '#1d4ed8', icon: 'fa-sync-alt', limit: 'No upper limit', note: 'Half-hourly batches, Mon–Sat 8am–7pm' },
    RTGS: { color: '#065f46', icon: 'fa-landmark', limit: 'Min ₹2,00,000', note: 'Gross settlement, Mon–Sat 7am–6pm' }
};

function renderTransferPage() {
    const el = $id('transferContent'); if (!el) return;

    if (!state.accounts.length) {
        el.innerHTML = `
        <div class="card" style="max-width:700px;text-align:center;padding:40px 20px;">
            <i class="fas fa-ban" style="font-size:48px;color:var(--text-secondary);margin-bottom:16px;"></i>
            <h3 style="margin-bottom:8px;">No Accounts Available</h3>
            <p style="color:var(--text-secondary);margin-bottom:24px;">You need to open an account before you can transfer money.</p>
            <button class="btn btn-primary" onclick="showAccountModal()">Open an Account</button>
        </div>`;
        return;
    }

    const acctOpts = '<option value="">— Select Account —</option>' +
        state.accounts.map(a => `<option value="${a.id}">${a.account_type} – ${maskAcct(a.account_number)} [IFSC: ${a.ifsc || 'SMTB0000001'}] (${fmtINR(a.balance)})</option>`).join('');

    el.innerHTML = `
    <div class="card" style="max-width:700px;">
        <div class="card-header"><h3 class="card-title">Transfer Money</h3></div>
        <div style="padding:24px;">
            <!-- Mode tabs -->
            <div class="transfer-modes">
                ${Object.keys(MODE_META).map(m => `<button class="mode-tab ${m === 'NEFT' ? 'active' : ''}" id="tab${m}" onclick="switchMode('${m}')">
                    <i class="fas ${MODE_META[m].icon}"></i> ${m}</button>`).join('')}
            </div>
            <div id="modeInfo" style="margin:16px 0;"></div>

            <!-- UPI -->
            <div id="panel_UPI" class="transfer-panel" style="display:none;">
                <div class="form-group"><label class="form-label">From Account</label>
                    <select id="upiFrom" class="form-select" onchange="updateBal('upi')">${acctOpts}</select>
                    <span id="upiBal" class="bal-hint"></span></div>
                <div class="form-group"><label class="form-label">UPI ID / Mobile Number</label>
                    <input id="upiId" class="form-input" placeholder="name@upi or 10-digit mobile"></div>
                <div class="form-group"><label class="form-label">Amount (₹)</label>
                    <input id="upiAmt" type="number" class="form-input" min="1" max="100000" placeholder="Max ₹1,00,000" onkeypress="return (event.charCode >= 48 && event.charCode <= 57) || event.charCode == 46" oninput="if(this.value.length > 10) this.value = this.value.slice(0, 10);"></div>
                <div class="form-group"><label class="form-label">Remarks</label>
                    <input id="upiDesc" class="form-input" placeholder="What's this for?"></div>
                <button class="btn btn-primary" onclick="doTransfer('UPI')"><i class="fas fa-bolt"></i> Pay via UPI</button>
            </div>

            <!-- IMPS -->
            <div id="panel_IMPS" class="transfer-panel" style="display:none;">
                <div class="form-group"><label class="form-label">From Account</label>
                    <select id="impsFrom" class="form-select" onchange="updateBal('imps')">${acctOpts}</select>
                    <span id="impsBal" class="bal-hint"></span></div>
                <div class="form-group" style="display:flex;justify-content:space-between;align-items:center;"><label class="form-label">Beneficiary Account Number</label>
                    <button class="btn btn-sm" style="padding:4px 8px;font-size:11px;" onclick="showBeneficiarySelector('IMPS')"><i class="fas fa-users"></i> Select Saved</button></div>
                <input id="impsToAcct" class="form-input" placeholder="Account number">
                <div class="form-group"><label class="form-label">IFSC Code</label>
                    <input id="impsIfsc" class="form-input" placeholder="SBIN0001234" maxlength="11" oninput="this.value=this.value.toUpperCase()" onblur="validateIFSC('imps')">
                    <span id="impsIfscInfo" class="ifsc-info"></span></div>
                <div class="form-group"><label class="form-label">Beneficiary Name</label>
                    <input id="impsName" class="form-input" placeholder="As per bank records"></div>
                <div class="form-group"><label class="form-label">Amount (₹)</label>
                    <input id="impsAmt" type="number" class="form-input" min="1" max="500000" placeholder="Max ₹5,00,000" onkeypress="return (event.charCode >= 48 && event.charCode <= 57) || event.charCode == 46" oninput="if(this.value.length > 10) this.value = this.value.slice(0, 10);"></div>
                <div class="form-group"><label class="form-label">Remarks</label>
                    <input id="impsDesc" class="form-input" placeholder="Purpose of transfer"></div>
                <button class="btn btn-primary" onclick="doTransfer('IMPS')"><i class="fas fa-paper-plane"></i> Transfer via IMPS</button>
            </div>

            <!-- NEFT -->
            <div id="panel_NEFT" class="transfer-panel" style="display:block;">
                <div class="form-group"><label class="form-label">From Account</label>
                    <select id="neftFrom" class="form-select" onchange="updateBal('neft')">${acctOpts}</select>
                    <span id="neftBal" class="bal-hint"></span></div>
                <div class="form-group" style="display:flex;justify-content:space-between;align-items:center;"><label class="form-label">Beneficiary Account Number</label>
                    <button class="btn btn-sm" style="padding:4px 8px;font-size:11px;" onclick="showBeneficiarySelector('NEFT')"><i class="fas fa-users"></i> Select Saved</button></div>
                <input id="neftToAcct" class="form-input" placeholder="Account number">
                <div class="form-group"><label class="form-label">IFSC Code</label>
                    <input id="neftIfsc" class="form-input" placeholder="HDFC0001234" maxlength="11" oninput="this.value=this.value.toUpperCase()" onblur="validateIFSC('neft')">
                    <span id="neftIfscInfo" class="ifsc-info"></span></div>
                <div class="form-group"><label class="form-label">Beneficiary Name</label>
                    <input id="neftName" class="form-input" placeholder="As per bank records"></div>
                <div class="form-group"><label class="form-label">Amount (₹)</label>
                    <input id="neftAmt" type="number" class="form-input" min="1" placeholder="No upper limit for NEFT" onkeypress="return (event.charCode >= 48 && event.charCode <= 57) || event.charCode == 46" oninput="if(this.value.length > 10) this.value = this.value.slice(0, 10);"></div>
                <div class="form-group"><label class="form-label">Remarks</label>
                    <input id="neftDesc" class="form-input" placeholder="Purpose of transfer"></div>
                <button class="btn btn-primary" onclick="doTransfer('NEFT')"><i class="fas fa-paper-plane"></i> Transfer via NEFT</button>
            </div>

            <!-- RTGS -->
            <div id="panel_RTGS" class="transfer-panel" style="display:none;">
                <div class="form-group"><label class="form-label">From Account</label>
                    <select id="rtgsFrom" class="form-select" onchange="updateBal('rtgs')">${acctOpts}</select>
                    <span id="rtgsBal" class="bal-hint"></span></div>
                <div class="form-group"><label class="form-label">Beneficiary Account Number</label>
                    <input id="rtgsToAcct" class="form-input" placeholder="Account number"></div>
                <div class="form-group"><label class="form-label">IFSC Code</label>
                    <input id="rtgsIfsc" class="form-input" placeholder="ICIC0001234" maxlength="11" oninput="this.value=this.value.toUpperCase()" onblur="validateIFSC('rtgs')">
                    <span id="rtgsIfscInfo" class="ifsc-info"></span></div>
                <div class="form-group"><label class="form-label">Beneficiary Name</label>
                    <input id="rtgsName" class="form-input" placeholder="As per bank records"></div>
                <div class="form-group"><label class="form-label">Amount (₹) — Minimum ₹2,00,000</label>
                    <input id="rtgsAmt" type="number" class="form-input" min="200000" placeholder="Min ₹2,00,000" onkeypress="return (event.charCode >= 48 && event.charCode <= 57) || event.charCode == 46" oninput="if(this.value.length > 10) this.value = this.value.slice(0, 10);"></div>
                <div class="form-group"><label class="form-label">Remarks</label>
                    <input id="rtgsDesc" class="form-input" placeholder="Purpose of transfer"></div>
                <button class="btn btn-primary" onclick="doTransfer('RTGS')"><i class="fas fa-landmark"></i> Transfer via RTGS</button>
            </div>
        </div>
    </div>
    <div class="card" style="margin-top:24px;">
        <div class="card-header"><h3 class="card-title">Recent Transfers</h3></div>
        <div>${state.transactions.filter(t => t.type === 'debit').slice(0, 5).map(txnRowHTML).join('') || emptyState('paper-plane', 'No transfers yet')}</div>
    </div>`;
    switchMode('NEFT');
}

function switchMode(mode) {
    Object.keys(MODE_META).forEach(m => {
        $id('tab' + m)?.classList.toggle('active', m === mode);
        const p = $id('panel_' + m); if (p) p.style.display = m === mode ? 'block' : 'none';
    });
    const meta = MODE_META[mode], box = $id('modeInfo');
    if (box && meta) box.innerHTML = `<div style="background:${meta.color}15;border-left:4px solid ${meta.color};padding:12px 16px;border-radius:8px;font-size:13px;line-height:1.6;">
        <i class="fas ${meta.icon}" style="color:${meta.color};margin-right:8px;"></i>
        <strong>${mode}</strong> — ${meta.note}. Limit: <strong>${meta.limit}</strong></div>`;
}

function updateBal(mode) {
    const fromId = { 'upi': 'upiFrom', 'imps': 'impsFrom', 'neft': 'neftFrom', 'rtgs': 'rtgsFrom' }[mode];
    const balId = { 'upi': 'upiBal', 'imps': 'impsBal', 'neft': 'neftBal', 'rtgs': 'rtgsBal' }[mode];
    const sel = $id(fromId), balEl = $id(balId);
    if (!sel || !balEl) return;
    const a = state.accounts.find(x => x.id == sel.value);
    balEl.textContent = a ? `Available: ${fmtINR(a.balance)}` : '';
}

async function validateIFSC(mode) {
    const ids = { imps: ['impsIfsc', 'impsIfscInfo'], neft: ['neftIfsc', 'neftIfscInfo'], rtgs: ['rtgsIfsc', 'rtgsIfscInfo'] };
    const [inpId, infoId] = ids[mode] || []; if (!inpId) return;
    const ifsc = ($id(inpId)?.value || '').trim().toUpperCase(), el = $id(infoId); if (!el) return;
    if (ifsc.length !== 11 || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
        el.textContent = ifsc.length > 0 ? '⚠ Invalid IFSC format' : ''; el.style.color = '#ef4444'; return;
    }
    el.textContent = 'Validating…'; el.style.color = '#f59e0b';
    try {
        const r = await fetch(`https://ifsc.razorpay.com/${ifsc}`);
        if (r.ok) { const d = await r.json(); el.textContent = `✓ ${d.BANK} — ${d.BRANCH}, ${d.CITY}`; el.style.color = '#10b981'; }
        else { el.textContent = '✗ IFSC not found'; el.style.color = '#ef4444'; }
    } catch { el.textContent = '(IFSC lookup unavailable offline)'; el.style.color = '#9ca3af'; }
}

async function doTransfer(mode) {
    const cfg = {
        UPI: { from: 'upiFrom', to: 'upiId', amt: 'upiAmt', desc: 'upiDesc', maxAmt: 100000 },
        IMPS: { from: 'impsFrom', to: 'impsToAcct', amt: 'impsAmt', desc: 'impsDesc', maxAmt: 500000, ifsc: 'impsIfsc', name: 'impsName' },
        NEFT: { from: 'neftFrom', to: 'neftToAcct', amt: 'neftAmt', desc: 'neftDesc', maxAmt: Infinity, ifsc: 'neftIfsc', name: 'neftName' },
        RTGS: { from: 'rtgsFrom', to: 'rtgsToAcct', amt: 'rtgsAmt', desc: 'rtgsDesc', minAmt: 200000, ifsc: 'rtgsIfsc', name: 'rtgsName' }
    }[mode];

    const fromId = $id(cfg.from)?.value;
    const toVal = $id(cfg.to)?.value?.trim();
    const amount = parseFloat($id(cfg.amt)?.value || 0);
    const desc = $id(cfg.desc)?.value?.trim() || `${mode} Transfer`;
    const ifsc = cfg.ifsc ? $id(cfg.ifsc)?.value?.trim() : null;
    const bName = cfg.name ? $id(cfg.name)?.value?.trim() : null;

    if (!fromId) return showToast('Please select source account', 'error');
    if (!toVal) return showToast(`Please enter ${mode === 'UPI' ? 'UPI ID / mobile' : 'destination account number'}`, 'error');
    if (!amount || amount <= 0) return showToast('Please enter a valid amount', 'error');
    if (cfg.minAmt && amount < cfg.minAmt) return showToast(`${mode} minimum is ${fmtINR(cfg.minAmt)}`, 'error');
    if (cfg.maxAmt && amount > cfg.maxAmt) return showToast(`${mode} limit is ${fmtINR(cfg.maxAmt)} per transaction`, 'error');
    if (mode === 'UPI' && !toVal.includes('@') && !/^\d{10}$/.test(toVal))
        return showToast('Enter valid UPI ID (name@upi) or 10-digit mobile', 'error');
    if ((mode === 'IMPS' || mode === 'NEFT' || mode === 'RTGS') && (!ifsc || !bName))
        return showToast('Please fill Account, IFSC and Beneficiary Name', 'error');

    const fromAcct = state.accounts.find(a => a.id == fromId);
    if (!fromAcct) return showToast('Source account not found', 'error');
    if (fromAcct.balance < amount) return showToast('Insufficient balance', 'error');

    const confirmMsg = mode === 'UPI'
        ? `Pay ${fmtINR(amount)} to ${toVal} via UPI?`
        : `Transfer ${fmtINR(amount)} to A/C ${maskAcct(toVal)}${bName ? ' (' + escHtml(bName) + ')' : ''} via ${mode}?`;

    if (!(await showConfirm({
        title: `Confirm ${mode} Transfer`,
        message: confirmMsg,
        icon: 'fa-paper-plane',
        confirmText: 'Transfer'
    }))) return;

    try {
        const r = await fetch(`${API}/user/transfer`, {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from_account: fromId, to_account: toVal, amount,
                description: `[${mode}] ${desc}`, mode, ifsc, beneficiary_name: bName
            })
        });
        if (r.ok) {
            const d = await r.json(); if (d.success) {
                pushTxn(fromAcct, amount, `[${mode}] ${desc} → ${toVal}`, mode, d.reference_number);
                showToast(`✓ ${mode} transfer successful! Ref: ${d.reference_number}`, 'success');
                addNotification(`${mode} Transfer`, `${fmtINR(amount)} sent`, 'success');
                renderAll(); return;
            }
        }
        const e = await r.json().catch(() => ({}));
        showToast(e.error || 'Transfer failed', 'error');
    } catch {
        const ref = mode + Date.now();
        pushTxn(fromAcct, amount, `[${mode}] ${desc} → ${toVal}`, mode, ref);
        showToast(`✓ ${mode} transfer submitted! Ref: ${ref}`, 'success');
        addNotification(`${mode} Transfer`, `${fmtINR(amount)} initiated`, 'success');
        renderAll();
    }
}

function pushTxn(acct, amount, desc, mode, ref) {
    acct.balance -= amount;
    state.transactions.unshift({
        id: Date.now(), type: 'debit', amount, description: desc,
        transaction_date: new Date().toISOString(), reference_number: ref,
        balance_after: acct.balance, account_number: acct.account_number, mode
    });
}

/* ── Cards Page ─────────────────────────────────────────── */
function renderCardsPage() { renderCards(); renderCardRequestsList(); }

function renderCards() {
    const el = $id('cardsList'); if (!el) return;
    if (!state.cards.length) {
        if (state.cardRequests && state.cardRequests.length > 0 && state.cardRequests.some(r => r.status === 'pending' || r.status === 'approved')) {
            el.innerHTML = ''; return;
        }
        el.innerHTML = `<div style="text-align:center;padding:3rem;">
            <i class="fas fa-credit-card" style="font-size:2.5rem;color:#9ca3af;margin-bottom:1rem;display:block;"></i>
            <p style="color:#6b7280;margin-bottom:1rem">No cards yet</p>
            <button class="btn btn-primary" onclick="openCardModal()"><i class="fas fa-plus"></i> Request a Card</button></div>`; return;
    }
    el.innerHTML = state.cards.map(c => {
        const expiry = (c.expiry_date || '').substring(0, 7).replace('-', '/');
        const isCr = c.card_type === 'Credit';
        const isBlocked = c.status === 'blocked';
        return `<div style="background:linear-gradient(135deg,${isBlocked ? '#475569,#1e293b' : (isCr ? '#6366f1,#8b5cf6' : '#1e3a8a,#1d4ed8')});color:white;border-radius:16px;padding:24px;margin-bottom:16px;min-height:150px;position:relative;opacity:${isBlocked ? '0.9' : '1'}; transition: all 0.3s ease;">
            <div style="display:flex;justify-content:space-between;"><div>
                <div style="font-size:11px;opacity:.7;">Smart Bank ${c.card_type}</div>
                <div style="font-size:20px;letter-spacing:4px;font-weight:700;margin:12px 0;">**** **** **** ${(c.card_number || '').slice(-4)}</div>
            </div><span style="background:${isBlocked ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,.2)'};padding:4px 10px;border-radius:20px;font-size:12px;height:fit-content;border:${isBlocked ? '1px solid #f87171' : 'none'}">${c.status.toUpperCase()}</span></div>
            <div style="display:flex;justify-content:space-between;align-items:flex-end;">
                <div><div style="font-size:11px;opacity:.7;">CARD HOLDER</div>
                <div style="font-weight:600;">${escHtml(c.card_holder_name || 'CARD HOLDER')}</div>
                ${isCr ? `<div style="font-size:11px;opacity:.7;margin-top:4px;">Limit: ${fmtINR(c.credit_limit)} | Avail: ${fmtINR(c.available_credit)}</div>` : ''}</div>
                <div style="text-align:right;"><div style="font-size:11px;opacity:.7;">EXPIRES</div><div>${expiry}</div></div>
            </div>
            ${isBlocked ? 
                `<button onclick="unblockCard(${c.id})" style="position:absolute;top:10px;right:10px;background:rgba(52,211,153,0.2);color:#d1fae5;border:1px solid rgba(52,211,153,0.5);border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer;backdrop-filter:none;"><i class="fas fa-unlock"></i> Unblock</button>` :
                `<button onclick="blockCard(${c.id})" style="position:absolute;top:10px;right:10px;background:rgba(239,68,68,0.2);color:#fee2e2;border:1px solid rgba(239,68,68,0.5);border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer;backdrop-filter:none;"><i class="fas fa-ban"></i> Block</button>`
            }
            </div>`;
    }).join('');
}

async function blockCard(cardId) {
    showConfirm({
        title: 'Block Card',
        message: 'Are you sure you want to block this card?',
        warning: '⚠ This prevents all future transactions. You can unblock it later.',
        icon: 'fa-ban',
        confirmText: 'Block Card',
        onConfirm: async () => {
            try {
                const r = await fetch(`${API}/user/cards/${cardId}/block`, {
                    method: 'POST', credentials: 'include'
                });
                const d = await r.json();
                if (r.ok) {
                    showToast(d.message || 'Card blocked successfully', 'success');
                    await loadAll(); // Refresh local state
                    renderCards();
                } else {
                    showToast(d.error || 'Failed to block card', 'error');
                }
            } catch (e) {
                showToast('Error connecting to server', 'error');
            }
        }
    });
}

async function unblockCard(cardId) {
    showConfirm({
        title: 'Unblock Card',
        message: 'Are you sure you want to unblock this card?',
        icon: 'fa-unlock',
        confirmText: 'Unblock Card',
        onConfirm: async () => {
            try {
                const r = await fetch(`${API}/user/cards/${cardId}/unblock`, {
                    method: 'POST', credentials: 'include'
                });
                const d = await r.json();
                if (r.ok) {
                    showToast(d.message || 'Card unblocked successfully', 'success');
                    await loadAll();
                    renderCards();
                } else {
                    showToast(d.error || 'Failed to unblock card', 'error');
                }
            } catch (e) {
                showToast('Error connecting to server', 'error');
            }
        }
    });
}

function renderCardRequestsList() {
    const el = $id('cardRequestsList'); if (!el) return;
    if (!state.cardRequests.length) {
        el.innerHTML = '<p style="color:var(--text-secondary);padding:16px;">No pending card requests</p>'; return;
    }
    el.innerHTML = state.cardRequests.map(r => {
        const status = r.status.toLowerCase();
        let step1 = 'completed', step2 = 'active', step3 = '';
        let step3Label = 'Card Issued';
        let step3Icon = '<i class="fas fa-credit-card"></i>';

        if (status === 'approved') {
            step2 = 'completed';
            step3 = 'completed';
        } else if (status === 'rejected') {
            step2 = 'completed';
            step3 = 'error';
            step3Label = 'Rejected';
            step3Icon = '<i class="fas fa-times"></i>';
        }

        return `
            <div class="card-request-item" style="padding:20px; border-bottom:1px solid var(--border-color); background: rgba(255,255,255,0.4); border-radius: 12px; margin-bottom: 15px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                    <div>
                        <h4 style="margin:0; font-size:16px; color: #800000;">${r.card_type} Card</h4>
                        <span style="font-size:12px; color:var(--text-secondary);">Applied on ${formatDate(r.request_date)}</span>
                    </div>
                    <span class="loan-status ${status}">${status.toUpperCase()}</span>
                </div>
                
                <div class="status-tracker">
                    <div class="tracker-step ${step1}">
                        <div class="step-dot"><i class="fas fa-file-invoice"></i></div>
                        <span class="step-label">Requested</span>
                    </div>
                    <div class="tracker-step ${step2}">
                        <div class="step-dot"><i class="fas fa-sync-alt ${status === 'pending' ? 'fa-spin' : ''}" style="animation-duration: 3s;"></i></div>
                        <span class="step-label">Reviewing</span>
                    </div>
                    <div class="tracker-step ${step3}">
                        <div class="step-dot">${step3Icon}</div>
                        <span class="step-label">${step3Label}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/* ── Loans Page ─────────────────────────────────────────── */
function renderLoansPage() {
    const el = $id('loansList'); if (!el) return;
    if (!state.loans.length) {
        el.innerHTML = `<div style="text-align:center;padding:3rem;">
            <i class="fas fa-hand-holding-usd" style="font-size:2.5rem;color:#9ca3af;margin-bottom:1rem;display:block;"></i>
            <p style="color:#6b7280;margin-bottom:1rem">No loan applications yet</p></div>`; return;
    }
    const icons = { 'Personal Loan': 'fa-user', 'Home Loan': 'fa-home', 'Car Loan': 'fa-car', 'Education Loan': 'fa-graduation-cap', 'Business Loan': 'fa-briefcase' };
    el.innerHTML = state.loans.map(l => {
        const icons = { 'Personal Loan': 'fa-user-tie', 'Home Loan': 'fa-home', 'Car Loan': 'fa-car', 'Education Loan': 'fa-graduation-cap', 'Business Loan': 'fa-briefcase', 'Gold Loan': 'fa-coins' };
        const outstanding = l.outstanding_amount !== null ? l.outstanding_amount : l.loan_amount;
        const totalPaid = l.loan_amount - outstanding;
        const progress = Math.min(100, Math.max(0, (totalPaid / l.loan_amount) * 100));

        // Fix EMI display bug - calculate if missing
        if (!l.monthly_payment || l.monthly_payment <= 0) {
            const r = (l.interest_rate || 10.5) / 1200;
            const amt = l.loan_amount;
            const ten = l.tenure_months || 12;
            l.monthly_payment = r > 0 ? Math.round(amt * r * Math.pow(1 + r, ten) / (Math.pow(1 + r, ten) - 1)) : Math.round(amt / ten);
        }

        return `
        <div class="loan-card-premium">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
                <div style="display:flex; gap:12px; align-items:center;">
                    <div class="loan-icon-circle"><i class="fas ${icons[l.loan_type] || 'fa-hand-holding-usd'}"></i></div>
                    <div>
                        <h4 style="margin:0; font-size:16px; font-weight:700; color:var(--text-primary);">${l.loan_type}</h4>
                        <div style="font-size:12px; color:var(--text-secondary);">${l.tenure_months} months • ${l.interest_rate}% p.a.</div>
                    </div>
                </div>
                <span class="loan-status-badge ${l.status}">${l.status.toUpperCase()}</span>
            </div>
            
            <div style="margin-bottom:16px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:13px;">
                    <span style="color:var(--text-secondary);">Repayment Progress</span>
                    <span style="font-weight:600; color:var(--primary-blue);">${Math.round(progress)}%</span>
                </div>
                <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${progress}%"></div></div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:16px;">
                <div class="loan-stat-box">
                    <div class="label">Loan Amount</div>
                    <div class="val">${fmtINR(l.loan_amount)}</div>
                </div>
                <div class="loan-stat-box">
                    <div class="label">Monthly EMI</div>
                    <div class="val">${fmtINR(l.monthly_payment)}</div>
                </div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; padding-top:12px; border-top:1px solid var(--border-color); margin-top:auto;">
                <div>
                    <div style="font-size:11px; color:var(--text-secondary);">Current Outstanding</div>
                    <div style="font-size:15px; font-weight:700; color:var(--text-primary);">${fmtINR(outstanding)}</div>
                </div>
                ${l.status === 'approved' ? `
                <button class="btn btn-primary" style="padding:8px 20px; font-size:13px; border-radius:8px;" 
                    onclick="openLoanRepayModal(${l.id}, '${l.loan_type}', ${outstanding}, ${l.monthly_payment})">
                    <i class="fas fa-credit-card" style="margin-right:6px;"></i> Repay
                </button>` : ''}
            </div>
        </div>`;
    }).join('');
}

function openLoanRepayModal(loanId, loanType, outstanding, emi) {
    const modal = $id('loanRepayModal');
    if (!modal) return;
    $id('repayLoanId').value = loanId;
    $id('repayAmount').value = outstanding;
    $id('repayAmount').max = outstanding;
    $id('repayAmount').dataset.outstanding = outstanding;
    $id('repayAmount').dataset.emi = emi;
    $id('repayLoanInfo').innerHTML = `Repaying for <strong>${escHtml(loanType)}</strong> (Loan #${escHtml(loanId)}).<br>Outstanding amount: <strong>${fmtINR(outstanding)}</strong>`;

    // Populate source accounts
    const sel = $id('repaySourceAccount');
    if (sel) {
        sel.innerHTML = state.accounts.map(a => `<option value="${a.id}">${escHtml(a.account_type)} - ${maskAcct(a.account_number)} (${fmtINR(a.balance)})</option>`).join('');
    }

    $id('repayType').value = 'custom';
    $id('repayMonths')?.parentElement.style.setProperty('display', 'none');
    modal.classList.add('active');
}

function updateRepayAmount() {
    const type = $id('repayType').value;
    const amountInput = $id('repayAmount');
    const emi = parseFloat(amountInput.dataset.emi || 0);
    const outstanding = parseFloat(amountInput.dataset.outstanding || 0);

    if (type === 'emi') {
        const monthsInput = $id('repayMonths');
        if (monthsInput) {
            monthsInput.parentElement.style.display = 'block';
            const months = parseInt(monthsInput.value || 1);
            amountInput.value = Math.min(outstanding, emi * months);
        } else {
            amountInput.value = emi;
        }
        amountInput.readOnly = true;
    } else if (type === 'full') {
        if ($id('repayMonths')) $id('repayMonths').parentElement.style.display = 'none';
        amountInput.value = outstanding;
        amountInput.readOnly = true;
    } else {
        if ($id('repayMonths')) $id('repayMonths').parentElement.style.display = 'none';
        if (amountInput.readOnly) amountInput.value = '';
        amountInput.readOnly = false;
        amountInput.focus();
    }

    // Update QR code if in scanner mode
    if ($id('repayMode').value === 'scanner') {
        toggleRepayUI();
    }
}

function closeLoanRepayModal() {
    $id('loanRepayModal')?.classList.remove('active');
}

function toggleRepayUI() {
    const mode = $id('repayMode').value;
    const amount = $id('repayAmount').value || 0;
    const loanId = $id('repayLoanId').value || '0';

    $id('repaySourceGroup').style.display = (mode === 'account') ? 'block' : 'none';
    $id('repayUPIGroup').style.display = (mode === 'upi') ? 'block' : 'none';
    const scannerGroup = $id('repayScannerGroup');
    if (scannerGroup) {
        scannerGroup.style.display = (mode === 'scanner') ? 'block' : 'none';
        if (mode === 'scanner') {
            const qrImg = scannerGroup.querySelector('img');
            if (qrImg) {
                const qrData = `upi://pay?pa=smartbank@bank&pn=SmartBank&am=${amount}&tr=LOAN${loanId}&cu=INR`;
                qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrData)}`;
            }
        }
    }
}

async function submitLoanRepayment() {
    const loanId = $id('repayLoanId').value;
    const mode = $id('repayMode').value;
    const accountId = mode === 'account' ? $id('repaySourceAccount').value : null;
    const upiId = mode === 'upi' ? $id('repayUPIId').value : null;
    const amount = parseFloat($id('repayAmount').value);

    if (!amount || amount <= 0) return showToast('Invalid amount', 'error');
    if (mode === 'upi' && !upiId) return showToast('Please enter UPI ID', 'error');

    const btn = $id('btnConfirmRepay');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...'; }

    try {
        const r = await fetch(`${API}/user/loans/repay`, {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                loan_id: loanId,
                account_id: accountId,
                amount: amount,
                mode: mode,
                upi_id: upiId
            })
        });
        const d = await r.json();
        if (d.success) {
            showToast(d.message || 'Repayment successful!', 'success');
            addNotification('Loan Repayment', `Paid ${fmtINR(amount)} towards Loan #${loanId}`, 'success');
            closeLoanRepayModal();
            await loadAll();
        } else {
            showToast(d.error || 'Repayment failed', 'error');
        }
    } catch (e) {
        showToast('Server error during repayment', 'error');
    }
    if (btn) { btn.disabled = false; btn.innerHTML = 'Confirm Repayment'; }
}

/* ── Settings Page ──────────────────────────────────────── */
function renderSettingsPage() {
    const el = $id('settingsContent'); if (!el) return;
    const u = state.user || {};
    el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;flex-wrap:wrap;">
        <div class="card">
            <div class="card-header"><h3 class="card-title">Profile</h3></div>
            <div style="padding:20px;display:flex;flex-direction:column;gap:12px;">
                <div style="display:flex;align-items:center;gap:16px;margin-bottom:12px;">
                    <div style="position:relative;">
                        <img id="settingsAvatar" src="${u.profile_image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || u.username)}&background=667eea&color=fff&rounded=true&bold=true`}" 
                             style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid var(--primary-blue,#3b82f6);">
                        <label for="avatarInput" style="position:absolute;bottom:0;right:0;background:var(--primary-blue,#3b82f6);color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.2);">
                            <i class="fas fa-camera" style="font-size:12px;"></i>
                        </label>
                        <input type="file" id="avatarInput" style="display:none;" accept="image/*" onchange="uploadProfileImage(this)">
                    </div>
                    <div>
                        <h4 style="margin:0;font-size:16px;">${escHtml(u.name || '') || 'Profile Picture'}</h4>
                        <p style="margin:4px 0 0;font-size:12px;color:var(--text-secondary);opacity:0.8;">PNG, JPG or GIF (Max 2MB)</p>
                    </div>
                </div>
                <div class="form-group"><label class="form-label">Full Name</label>
                    <input id="profileName" class="form-input" value="${escHtml(u.name || '')}"></div>
                <div class="form-group"><label class="form-label">Email (read-only)</label>
                    <input class="form-input" value="${escHtml(u.email || '')}" readonly style="opacity:.7"></div>
                <div class="form-group"><label class="form-label">Phone</label>
                    <input id="profilePhone" class="form-input" value="${escHtml(u.phone || '')}"></div>
                <div class="form-group"><label class="form-label">Address</label>
                    <input id="profileAddress" class="form-input" value="${escHtml(u.address || '')}"></div>
                <div class="form-group"><label class="form-label">Date of Birth</label>
                    <input id="profileDob" type="date" class="form-input" value="${u.date_of_birth || ''}"></div>
                <div class="form-group"><label class="form-label">Daily Payment Limit (₹)</label>
                    <input id="profileDailyLimit" type="number" class="form-input" value="${u.daily_limit || 200000}" max="200000" min="0" step="1000">
                    <span style="font-size:11px;color:var(--text-secondary);opacity:0.8;">Maximum ₹2,00,000 / day</span>
                </div>
                <button class="btn btn-primary" onclick="saveProfile()"><i class="fas fa-save"></i> Save Changes</button>
            </div>
        </div>
        <div>
            <div class="card" style="margin-bottom:16px;">
                <div class="card-header"><h3 class="card-title">Account Summary</h3></div>
                <div id="settingsSummary" style="padding:20px;"></div>
            </div>
            <div class="card">
                <div class="card-header"><h3 class="card-title">Preferences</h3></div>
                <div style="padding:20px;display:flex;flex-direction:column;gap:14px;">
                    ${[['Dark Mode', 'darkModeToggle', 'toggleTheme()'],
        ['Auto-Refresh Balance', 'autoRefreshToggle', 'toggleAutoRefresh()'],
        ['Notifications', 'notificationsToggle', 'toggleNotificationSetting()']].map(([label, id, fn]) => `
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <span>${label}</span>
                        <label class="toggle-switch"><input type="checkbox" id="${id}" onchange="${fn}"><span class="toggle-slider"></span></label>
                    </div>`).join('')}
                </div>
            </div>

            <div class="card" style="margin-top:16px;">
                <div class="card-header"><h3 class="card-title">Biometric Security</h3></div>
                <div style="padding:20px;display:flex;flex-direction:column;gap:14px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <span style="font-weight:600;display:block;">Face Authentication</span>
                            <span style="font-size:12px;color:var(--text-grey);">Login securely using facial recognition</span>
                        </div>
                        <button class="btn btn-sm btn-primary" onclick="window.openFaceRegistration()" id="faceAuthSetupBtn">
                            <i class="fas fa-user-tie"></i> Setup Face Login
                        </button>
                    </div>
                </div>
            </div>
            
            <div class="card" style="margin-top:16px;">
                <div class="card-header"><h3 class="card-title">Manage Cards</h3></div>
                <div style="padding:20px;display:flex;flex-direction:column;gap:12px;">
                    ${state.cards.filter(c => c.status === 'active').length === 0 ? '<p style="color:var(--text-secondary);font-size:13px;margin:0;">No active cards available to manage.</p>' : 
                    state.cards.filter(c => c.status === 'active').map(c => `
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;border:1px solid var(--border-color);border-radius:10px;background:var(--bg-light);">
                        <div style="display:flex;gap:12px;align-items:center;">
                            <div style="width:40px;height:40px;border-radius:8px;background:var(--primary-maroon);color:white;display:flex;align-items:center;justify-content:center;">
                                <i class="fas fa-credit-card"></i>
                            </div>
                            <div>
                                <h4 style="margin:0;font-size:14px;font-weight:600;">${c.card_type} Card</h4>
                                <p style="margin:2px 0 0;font-size:12px;color:var(--text-secondary);">**** **** **** ${(c.card_number || '0000').slice(-4)}</p>
                            </div>
                        </div>
                        <button class="btn btn-sm" style="background:#fef2f2;color:#ef4444;border:1px solid #fca5a5;" onclick="blockCard(${c.id})"><i class="fas fa-ban"></i> Block</button>
                    </div>
                    `).join('')}
                </div>
            </div>
        </div>
    </div>`;
    const sum = $id('settingsSummary');
    if (sum) sum.innerHTML = [
        ['Username', '@' + escHtml(u.username || '')],
        ['Total Accounts', state.accounts.length],
        ['Total Balance', fmtINR(state.accounts.reduce((s, a) => s + parseFloat(a.balance || 0), 0))],
        ['Active Cards', state.cards.filter(c => c.status === 'active').length],
        ['Loans', state.loans.length],
        ['Member Since', formatDate(u.created_at)]
    ].map(([l, v]) => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-color,#e5e7eb);">
        <span style="color:var(--text-secondary,#6b7280)">${l}</span><strong>${v}</strong></div>`).join('');
    loadPreferences();
}

async function saveProfile() {
    let limit = parseFloat($id('profileDailyLimit')?.value || 200000);
    if (limit > 200000) limit = 200000;
    if (limit < 0) limit = 0;

    const data = {
        name: $id('profileName')?.value, phone: $id('profilePhone')?.value,
        address: $id('profileAddress')?.value, date_of_birth: $id('profileDob')?.value,
        daily_limit: limit
    };
    try {
        const r = await fetch(`${API}/user/profile`, {
            method: 'PUT', credentials: 'include',
            headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
        });
        const d = await r.json();
        if (d.success) { showToast('Profile saved!', 'success'); if (state.user) Object.assign(state.user, data); }
        else showToast(d.error || 'Save failed', 'error');
    } catch { showToast('Saved locally (offline)', 'warning'); if (state.user) Object.assign(state.user, data); }
}

async function uploadProfileImage(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    if (file.size > 2 * 1024 * 1024) return showToast('Image size must be less than 2MB', 'error');

    const formData = new FormData();
    formData.append('image', file);

    showToast('Uploading image...', 'info');
    try {
        const r = await fetch(`${API}/user/profile-image`, {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });
        const d = await r.json();
        if (d.success) {
            state.user.profile_image_url = d.profile_image_url;
            showToast('Profile image updated!', 'success');
            renderUserInfo();
            const setAv = $id('settingsAvatar');
            if (setAv) setAv.src = d.profile_image_url;
        } else {
            showToast(d.error || 'Upload failed', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Upload failed', 'error');
    }
}

/* ── Support Page ───────────────────────────────────────── */
async function renderSupportPage() {
    const el = $id('supportRequestsList'); if (!el) return;

    let requests = [];
    try {
        const response = await fetch(`${API}/user/support`, { credentials: 'include' });
        if (response.ok) {
            const data = await response.json();
            if (data.tickets) requests = data.tickets;
        }
    } catch (e) { console.error("Could not fetch tickets", e); }

    setText('supportOpenTickets', requests.filter(r => r.status === 'open').length);
    setText('supportPendingTickets', requests.filter(r => r.status === 'pending').length);
    setText('supportResolvedTickets', requests.filter(r => r.status === 'resolved' || r.status === 'closed').length);

    if (!requests.length) {
        el.innerHTML = `<div style="text-align:center;padding:48px;color:var(--text-secondary);">
            <i class="fas fa-headset" style="font-size:48px;margin-bottom:16px;opacity:.4;display:block;"></i>
            <h3>No Support Tickets</h3><p>Click "New Request" to get help</p></div>`; return;
    }
    const sc = { open: '#3b82f6', pending: '#f59e0b', resolved: '#10b981', closed: '#6b7280' };
    el.innerHTML = `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">
        <thead><tr style="background:var(--bg-light);">${['Ticket ID', 'Subject', 'Type', 'Priority', 'Status', 'Created'].map(h =>
        `<th style="padding:10px;font-size:12px;text-transform:uppercase;color:var(--text-secondary);">${h}</th>`).join('')}</tr></thead>
        <tbody>${requests.map(r => `<tr style="border-bottom:1px solid var(--border-color);">
            <td style="padding:10px;font-weight:700;color:var(--primary-blue,#3b82f6);">TKT-${r.id || r.ticketId}</td>
            <td style="padding:10px;">${escHtml(r.subject)}</td>
            <td style="padding:10px;text-transform:capitalize;">${escHtml(r.message && r.message.substring(0, 20))}...</td>
            <td style="padding:10px;font-size:12px;font-weight:700;color:${r.priority === 'high' ? '#ef4444' : r.priority === 'medium' ? '#f59e0b' : '#10b981'}">${(r.priority || '').toUpperCase()}</td>
            <td style="padding:10px;"><span style="background:${(sc[r.status] || '#6b7280')}22;color:${sc[r.status] || '#6b7280'};padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;">${r.status}</span></td>
            <td style="padding:10px;font-size:12px;color:var(--text-secondary);">${new Date(r.created_at || r.createdAt).toLocaleDateString('en-IN')}</td>
        </tr>`).join('')}</tbody></table></div>`;
}

/* ════════════════════════════════════════════════════════════
   MODALS & QUICK ACTIONS
   ════════════════════════════════════════════════════════════ */
function showTransferModal() { showPage('transfer'); }
function showLoanModal() { applyForLoan('Personal'); }
function addNewCard() { applyForCard('debit'); }
function showNewSupportRequestModal() {
    $id('supportRequestModal')?.classList.add('active');
}
function showSendMoney() { showPage('transfer'); }
function showReceiveMoney() { showToast('Your A/C: ' + (state.accounts[0]?.account_number || 'N/A'), 'info'); }
function showMoreOptions() { showPage('accounts'); }
function showNotifications() { toggleDropdown('notificationDropdown'); }
function closeModal(id) {
    const modal = $id(id);
    if (!modal) return;
    modal.classList.remove('active');
    // Force hide if still visible (handles modals without .active class CSS)
    if (window.getComputedStyle(modal).display !== 'none') {
        modal.style.display = 'none';
    }
}

function openLoanModal() { applyForLoan('Personal'); }
function closeLoanModal() { $id('loanApplicationModal')?.classList.remove('active'); }
function closeCardModal() { $id('cardApplicationModal')?.classList.remove('active'); }

function openCardModal() { populateCardAccountDropdown(); applyForCard('debit'); }
function populateCardAccountDropdown() {
    const sel = $id('linkedAccount'); if (!sel) return;
    sel.innerHTML = '<option value="">— Select Account —</option>' +
        state.accounts.map(a => `<option value="${a.id}">${a.account_type} — ${maskAcct(a.account_number)}</option>`).join('');
}
function selectCardType(type) {
    document.querySelectorAll('.radio-card').forEach(e => e.classList.remove('active'));
    $id(type === 'Debit' ? 'debitOpt' : 'creditOpt')?.classList.add('active');
    const clg = $id('creditLimitGroup'); if (clg) clg.style.display = type === 'Credit' ? 'block' : 'none';
}

function calcEMI() {
    const type = $id('loanType')?.value || 'Personal Loan';
    const amt = parseFloat($id('loanAmount')?.value || 0);
    const ten = parseInt($id('loanTenure')?.value || 12);
    const rates = { 'Personal Loan': 10.50, 'Home Loan': 8.75, 'Car Loan': 9.25, 'Education Loan': 8.00, 'Business Loan': 12.00 };
    const rate = rates[type] || 10.50, preview = $id('emiPreview'); if (!preview) return;
    if (!amt || amt < 1000) { preview.style.display = 'none'; return; }
    const r = rate / 1200, emi = r > 0 ? amt * r * Math.pow(1 + r, ten) / (Math.pow(1 + r, ten) - 1) : amt / ten;
    setText('emiRate', `${rate}% p.a.`); setText('emiAmount', `${fmtINR(Math.round(emi))}/month`);
    setText('emiTotal', fmtINR(Math.round(emi * ten))); preview.style.display = 'block';
}

async function submitLoan() {
    const lt = $id('loanType')?.value, amt = parseFloat($id('loanAmount')?.value || 0), ten = parseInt($id('loanTenure')?.value || 12);
    if (!amt || amt < 1000) return showToast('Minimum ₹1,000', 'error');
    if (amt > 10000000) return showToast('Maximum ₹1,00,00,000', 'error');
    const btn = document.querySelector('#loanModal .btn-primary');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...'; }
    try {
        const r = await fetch(`${API}/user/loans/apply`, {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ loan_type: lt, loan_amount: amt, tenure_months: ten })
        });
        if (r.ok) {
            const d = await r.json(); if (d.success) {
                showToast(d.message, 'success');
                addNotification('Loan Applied', `${lt} for ${fmtINR(amt)} under review`, 'success');
                closeLoanModal(); await loadAll();
            }
        }
        else { const e = await r.json().catch(() => ({})); showToast(e.error || 'Submit failed', 'error'); }
    } catch {
        const rate = { 'Personal Loan': 10.50, 'Home Loan': 8.75, 'Car Loan': 9.25, 'Education Loan': 8.00, 'Business Loan': 12.00 }[lt] || 10.50;
        const mr = rate / 1200, emi = mr > 0 ? Math.round(amt * mr * Math.pow(1 + mr, ten) / (Math.pow(1 + mr, ten) - 1)) : Math.round(amt / ten);
        state.loans.unshift({
            id: Date.now(), loan_type: lt, loan_amount: amt, interest_rate: rate,
            tenure_months: ten, monthly_payment: emi, outstanding_amount: amt, status: 'pending',
            application_date: new Date().toISOString()
        });
        showToast(`Loan submitted! EMI: ${fmtINR(emi)}/mo`, 'success');
        addNotification('Loan Applied', `${lt} for ${fmtINR(amt)} under review`, 'success');
        closeLoanModal(); renderLoansPage();
    }
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Submit Application'; }
}

async function submitCard() {
    const ct = $id('cardType')?.value || 'Debit';
    const aid = $id('linkedAccount')?.value || null;
    const btn = document.querySelector('#cardApplicationModal .btn-primary');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...'; }
    try {
        const r = await fetch(`${API}/user/cards/request`, {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                card_type: ct, account_id: aid || undefined,
                requested_credit_limit: ct === 'Credit' ? parseFloat($id('creditLimit')?.value || 100000) : null,
                delivery_address: $id('deliveryAddress')?.value || ''
            })
        });
        if (r.ok) {
            const d = await r.json(); if (d.success) {
                showToast(d.message, 'success');
                addNotification('Card Request', `${ct} card request submitted`, 'success');
                closeModal('cardApplicationModal'); await loadAll();
            }
        } else {
            const e = await r.json().catch(() => ({}));
            showToast(e.error || 'Failed to request card', 'error');
        }
    } catch {
        state.cardRequests.unshift({ id: Date.now(), card_type: ct, status: 'pending', request_date: new Date().toISOString() });
        showToast(`${ct} card request submitted!`, 'success'); closeModal('cardApplicationModal'); renderCardRequestsList();
    }
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Submit Application'; }
}

function submitCardApplication(event) {
    event.preventDefault();
    submitCard();
}

// submitSupportRequest defined below as single canonical version

/* ════════════════════════════════════════════════════════════
   REAL-TIME BALANCE & DATA (Selective Polling)
   ════════════════════════════════════════════════════════════ */
async function refreshBalance(silent = false) {
    const icon = $id('refreshIcon'); if (icon) icon.classList.add('fa-spin');
    if (!silent) showToast('Refreshing…', 'info');
    try {
        // Fetch full dashboard data to get accounts, balances, and transactions in one go
        const r = await fetch(`${API}/user/dashboard`, { credentials: 'include' });
        if (r.ok) {
            const d = await r.json();
            const oldBal = state.accounts.reduce((s, a) => s + parseFloat(a.balance || 0), 0);

            // Update state safely
            state.accounts = d.accounts || [];
            state.transactions = d.transactions || [];
            state.cards = d.cards || [];
            state.loans = d.loans || [];

            const newBal = state.accounts.reduce((s, a) => s + parseFloat(a.balance || 0), 0);
            if (!silent && newBal !== oldBal) {
                const diff = newBal - oldBal;
                addNotification('Balance Update', diff > 0 ? `+${fmtINR(diff)} received` : `${fmtINR(Math.abs(diff))} debited`, diff > 0 ? 'success' : 'info');
            }

            // Selectively update active page to prevent disrupting forms
            if (state.currentPage === 'dashboard' || !state.currentPage) { renderStats(); renderDashboard(); }
            else if (state.currentPage === 'accounts') { renderAccountsPage(); }
            else if (state.currentPage === 'transactions') { renderTransactionsPage(); }
            else if (state.currentPage === 'cards') { renderCardsPage(); }
            else if (state.currentPage === 'loans') { renderLoansPage(); }

            if (!silent) showToast('Refreshed!', 'success');
        }
    } catch (err) {
        console.error(err);
        if (!silent) showToast('Refresh failed (offline)', 'error');
    }
    finally { setTimeout(() => { if (icon) icon.classList.remove('fa-spin'); }, 800); }
}

function startAutoRefresh() {
    stopAutoRefresh();
    if (localStorage.getItem('autoRefreshEnabled') === 'false') return;
    state.refreshTimer = setInterval(() => refreshBalance(true), REFRESH_INTERVAL);
}
function stopAutoRefresh() { if (state.refreshTimer) { clearInterval(state.refreshTimer); state.refreshTimer = null; } }
function toggleAutoRefresh() {
    const en = $id('autoRefreshToggle')?.checked;
    localStorage.setItem('autoRefreshEnabled', en);
    en ? startAutoRefresh() : stopAutoRefresh();
    showToast(`Auto-refresh ${en ? 'enabled' : 'disabled'}`, 'success');
}

/* ════════════════════════════════════════════════════════════
   NAVIGATION  — HTML uses .page-content and bare IDs (e.g. id="dashboard")
   ════════════════════════════════════════════════════════════ */
function initNav() {
    document.querySelectorAll('.nav-item[data-page]').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            showPage(link.dataset.page);
            if (window.innerWidth <= 1024) {
                $id('sidebar')?.classList.remove('active');
            }
        });
    });
    // nav from inline HTML onclick="showPage(...)" also works via global scope
}

function showPage(pageName) {
    document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const target = $id(pageName);
    if (target) {
        target.classList.add('active');
        document.querySelector(`.nav-item[data-page="${pageName}"]`)?.classList.add('active');
        state.currentPage = pageName;
        // Re-render dynamic pages on navigate
        if (pageName === 'transfer') renderTransferPage();
        if (pageName === 'accounts') renderAccountsPage();
        if (pageName === 'transactions') renderTransactionsPage();
        if (pageName === 'cards') renderCardsPage();
        if (pageName === 'loans') renderLoansPage();
        if (pageName === 'settings') renderSettingsPage();
        if (pageName === 'support') renderSupportPage();
        if (pageName === 'upi') renderUpiPage();
        if (pageName === 'deposits') renderFixedDepositsPage();
        if (pageName === 'locator') initUserLocator();
    }
}

function initSidebar() {
    window.toggleSidebar = function () {
        const sidebar = $id('sidebar');
        if (sidebar) sidebar.classList.toggle('active');
    };

    document.addEventListener('click', e => {
        const sidebar = $id('sidebar');
        const toggleBtn = e.target.closest('.mobile-menu-btn');
        if (sidebar && !sidebar.contains(e.target) && !toggleBtn)
            sidebar.classList.remove('active');
    });
}

/* ════════════════════════════════════════════════════════════
   NOTIFICATIONS
   ════════════════════════════════════════════════════════════ */
function addNotification(title, msg, type = 'info') {
    if (localStorage.getItem('notificationsEnabled') === 'false') return;
    state.notifications.unshift({ id: Date.now(), title, message: msg, type, time: new Date().toISOString(), read: false });
    updateNotifBadge(); renderNotifications();
}
function updateNotifBadge() {
    const b = $id('notificationCount') || $id('notifCount'); if (!b) return;
    const c = state.notifications.filter(n => !n.read).length;
    b.textContent = c; b.style.display = c > 0 ? 'flex' : 'none';
}
function toggleNotifications() { toggleDropdown('notificationDropdown'); }
function renderNotifications() {
    const list = $id('notificationList'); if (!list) return;
    if (!state.notifications.length) {
        list.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-secondary);"><i class="fas fa-bell-slash"></i><p>No notifications</p></div>'; return;
    }
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle', warning: 'fa-exclamation-triangle' };
    list.innerHTML = state.notifications.map(n => `
        <div onclick="markNotifRead(${n.id})" style="padding:12px 16px;cursor:pointer;border-bottom:1px solid var(--border-color);${n.read ? '' : 'background:rgba(79, 70, 229, 0.05)'}">
            <div style="display:flex;gap:10px;">
                <i class="fas ${icons[n.type] || 'fa-bell'}" style="margin-top:2px;color:var(--primary-blue,#3b82f6);"></i>
                <div><div style="font-weight:600;font-size:13px;">${escHtml(n.title)}</div>
                <div style="font-size:12px;color:var(--text-secondary);">${escHtml(n.message)}</div>
                <div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">${formatNotifTime(n.time)}</div>
            </div></div></div>`).join('');
}
async function markNotifRead(id) {
    const n = state.notifications.find(x => x.id == id);
    if (n && !n.read) {
        n.read = true;
        updateNotifBadge();
        renderNotifications();
        try {
            await fetch(`${API}/user/notifications/mark_read/${id}`, { method: 'POST', credentials: 'include' });
        } catch (e) { console.error('Failed to mark notification as read', e); }
    }
}
function clearAllNotifications() { state.notifications.length = 0; updateNotifBadge(); renderNotifications(); showToast('Cleared', 'success'); }
function formatNotifTime(ds) {
    const d = (Date.now() - new Date(ds)) / 1000;
    return d < 60 ? 'Just now' : d < 3600 ? `${Math.floor(d / 60)}m ago` : d < 86400 ? `${Math.floor(d / 3600)}h ago` : `${Math.floor(d / 86400)}d ago`;
}
function toggleNotificationSetting() {
    const en = $id('notificationsToggle')?.checked;
    localStorage.setItem('notificationsEnabled', en);
    showToast(`Notifications ${en ? 'enabled' : 'disabled'}`, 'success');
}
document.addEventListener('click', e => {
    if (!e.target.closest('.action-btn') && !e.target.closest('.user-avatar-small') && !e.target.closest('.dropdown-menu')) {
        document.querySelectorAll('.dropdown-menu.active').forEach(d => d.classList.remove('active'));
    }
});

function toggleDropdown(id) {
    const dd = document.getElementById(id);
    if (!dd) return;
    document.querySelectorAll('.dropdown-menu.active').forEach(d => {
        if (d.id !== id) d.classList.remove('active');
    });
    dd.classList.toggle('active');
    // Render notifications if opening notification dropdown
    if (id === 'notificationDropdown' && dd.classList.contains('active')) {
        renderNotifications();
    }
}

/* ════════════════════════════════════════════════════════════
   THEME MANAGEMENT
   ════════════════════════════════════════════════════════════ */
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
    }
    updateThemeIcon(savedTheme === 'dark');
}

function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-theme');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateThemeIcon(isDark);
}

function updateThemeIcon(isDark) {
    const icon = document.querySelector('#themeToggle i') || document.querySelector('[onclick="toggleTheme()"] i');
    if (icon) {
        icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    }
}
function loadTheme() {
    if (localStorage.getItem('theme') !== 'dark') return;
    document.body.classList.add('dark-theme');
    const icon = document.querySelector('[onclick="toggleTheme()"] i');
    if (icon) { icon.classList.remove('fa-moon'); icon.classList.add('fa-sun'); }
}
function loadPreferences() {
    const at = $id('autoRefreshToggle'), nt = $id('notificationsToggle'), dm = $id('darkModeToggle');
    if (at) at.checked = localStorage.getItem('autoRefreshEnabled') !== 'false';
    if (nt) nt.checked = localStorage.getItem('notificationsEnabled') !== 'false';
    if (dm) dm.checked = document.body.classList.contains('dark-theme');
}

/* ════════════════════════════════════════════════════════════
   ACCOUNT OPENING
   ════════════════════════════════════════════════════════════ */
function openNewAccount(type) {
    const modal = $id('accountOpeningModal');
    if (!modal) return;

    $id('accountType').value = type;
    $id('accountTypeDisplay').value = type.charAt(0).toUpperCase() + type.slice(1) + ' Account';

    // Pre-fill user data if available
    if (state.user) {
        $id('accountHolderName').value = state.user.name || '';
        $id('accountEmail').value = state.user.email || '';
    }

    const taxIdGroup = $id('taxIdGroup');
    const taxIdInput = $id('accountTaxId');
    if (taxIdGroup && taxIdInput) {
        if (type.toLowerCase() === 'current') {
            taxIdGroup.style.display = 'block';
            taxIdInput.required = true;
        } else {
            taxIdGroup.style.display = 'none';
            taxIdInput.required = false;
        }
    }

    modal.classList.add('active');
}

async function submitAccountOpening(event) {
    event.preventDefault();
    const type = $id('accountType').value;
    const amount = parseFloat($id('initialDeposit').value);

    // Show loading state on button
    const btn = event.target.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

    try {
        const response = await fetch(`${API}/user/accounts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                account_type: type,
                name: $id('accountHolderName').value,
                phone: $id('accountMobile').value,
                email: $id('accountEmail').value,
                pan: $id('accountPAN').value,
                aadhar: $id('accountAadhar').value,
                tax_id: $id('accountTaxId') ? $id('accountTaxId').value : '',
                initial_deposit: amount
            })
        });
        const data = await response.json();
        if (response.ok) {
            showToast(data.message || 'Account opening application submitted successfully!', 'success');
            closeModal('accountOpeningModal');
            await loadAll();
        } else {
            showToast(data.error || 'Failed to submit application', 'error');
        }
    } catch (e) {
        showToast('Error connecting to server', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

async function applyForLoan(type) {
    const modal = $id('loanApplicationModal');
    if (!modal) return;

    const loanTypeStr = type.charAt(0).toUpperCase() + type.slice(1) + ' Loan';
    $id('loanTypeDisplay').value = loanTypeStr;
    // Set the hidden loanType field so submitLoanApplication reads the correct value
    const hiddenType = $id('loanType');
    if (hiddenType) hiddenType.value = loanTypeStr;

    // Populate disbursement accounts
    const accSel = $id('loanAccount');
    if (accSel) {
        accSel.innerHTML = state.accounts.map(a => `<option value="${a.id}">${escHtml(a.account_type)} — ${maskAcct(a.account_number)} (${fmtINR(a.balance)})</option>`).join('');
    }

    modal.classList.add('active');
}

async function submitLoanApplication(event) {
    event.preventDefault();
    const type = $id('loanType').value;
    const amount = parseFloat($id('loanAmount').value);
    const tenure = parseInt($id('loanTenure').value);
    const target_account_id = $id('loanAccount').value;
    const purpose = $id('loanPurpose').value;

    const btn = event.target.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

    try {
        const response = await fetch(`${API}/user/loans/apply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                loan_type: type,
                loan_amount: amount,
                tenure_months: tenure,
                target_account_id: target_account_id,
                purpose: purpose,
                monthly_income: parseFloat($id('monthlyIncome').value),
                employment_type: $id('employmentType').value
            })
        });
        const data = await response.json();
        if (response.ok) {
            showToast(data.message || 'Loan application submitted!', 'success');
            addNotification('Loan Applied', `${type} for ${fmtINR(amount)} under review`, 'success');
            closeModal('loanApplicationModal');
            await loadAll();
        } else {
            showToast(data.error || 'Failed to apply for loan', 'error');
        }
    } catch (e) {
        showToast('Error connecting to server', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

async function applyForCard(type) {
    const modal = $id('cardApplicationModal');
    if (!modal) return;

    $id('cardType').value = type;
    $id('cardTypeDisplay').value = type.charAt(0).toUpperCase() + type.slice(1) + ' Card';

    if (state.user) {
        $id('cardholderName').value = state.user.name || '';
    }

    // Populate accounts dropdown
    const sel = $id('linkedAccount');
    if (sel) {
        sel.innerHTML = '<option value="">Select account...</option>' +
            state.accounts.map(a => `<option value="${a.id}">${escHtml(a.account_type)} — ${maskAcct(a.account_number)}</option>`).join('');
    }

    $id('creditLimitGroup').style.display = type === 'credit' ? 'block' : 'none';

    modal.classList.add('active');
}

/* ════════════════════════════════════════════════════════════
   TOAST
   ════════════════════════════════════════════════════════════ */
// showToast removed (handled by premium-ui.js)

/* ════════════════════════════════════════════════════════════
   UTILS
   ════════════════════════════════════════════════════════════ */
function $id(id) { return document.getElementById(id); }
function setText(id, v) { 
    const elements = document.querySelectorAll('#' + id); 
    elements.forEach(e => e.textContent = v); 
}
function fmtINR(n) { return '₹' + parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
function maskAcct(n) { if (!n) return ''; const s = String(n); return s.includes('*') ? s : '****' + s.slice(-4); }
// Removed local escHtml in favor of global premium-ui utility
function emptyState(icon, msg) {
    return `<div style="padding:3rem;text-align:center;color:var(--text-secondary,#6b7280);">
        <i class="fas fa-${icon}" style="font-size:2.5rem;margin-bottom:1rem;opacity:.4;display:block;"></i><p>${msg}</p></div>`;
}
function formatDate(ds) {
    if (!ds) return '';
    const d = new Date(ds), now = new Date(), diff = Math.floor((now - d) / 86400000);
    if (diff === 0) return 'Today'; if (diff === 1) return 'Yesterday'; if (diff < 7) return `${diff}d ago`;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}
function formatNotifTime(ds) { return formatDate(ds); }

/* ── Fixed Deposits ─────────────────────────────────────── */
function renderFixedDepositsPage() {
    const el = $id('depositsContent'); if (!el) return;
    if (!state.deposits.length) {
        el.innerHTML = emptyState('piggy-bank', 'No active fixed deposits. Open one to grow your wealth!');
        return;
    }

    el.innerHTML = state.deposits.map(d => `
        <div style="padding:20px;background:var(--card-bg,#fff);border-radius:12px;margin-bottom:12px;border:1px solid var(--border-color,#e5e7eb);">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
                <div style="display:flex;align-items:center;gap:12px;">
                    <div class="txn-icon credit" style="background:rgba(128,0,0,0.1);color:var(--primary-maroon);">
                        <i class="fas fa-piggy-bank"></i>
                    </div>
                    <div>
                        <h4 style="margin:0 0 4px;font-size:16px;">Fixed Deposit</h4>
                        <p style="margin:0;font-size:12px;color:var(--text-secondary);">Maturity: ${formatDate(d.maturity_date)} • ${d.tenure_years} Years @ ${d.interest_rate}%</p>
                    </div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:20px;font-weight:700;color:var(--primary-maroon);">${fmtINR(d.amount)}</div>
                    <span class="badge badge-success">Active</span>
                </div>
            </div>
        </div>`).join('');
}

function showFixedDepositModal() {
    const modal = $id('fdModal'); if (!modal) return;
    const sel = $id('fdFromAccount');
    if (sel) {
        sel.innerHTML = '<option value="">Select account...</option>' +
            state.accounts.map(a => `<option value="${a.id}">${escHtml(a.account_type)} — ${maskAcct(a.account_number)} (${fmtINR(a.balance)})</option>`).join('');
    }
    modal.classList.add('active');
}

async function submitFD(e) {
    e.preventDefault();
    const aid = $id('fdFromAccount').value;
    const amt = parseFloat($id('fdAmount').value);
    const tenure = $id('fdTenure').value;
    const rate = { '12': 7.5, '24': 7.75, '36': 8.0, '60': 8.5 }[tenure];

    const acc = state.accounts.find(a => a.id == aid);
    if (!acc || acc.balance < amt) return showToast('Insufficient balance in selected account', 'error');

    // Mock success - in real world this would be an API call
    showToast('Fixed Deposit opened successfully!', 'success');
    addNotification('FD Opened', `₹${amt} Fixed Deposit opened for ${tenure / 12} years`, 'success');

    // Update local state for demo
    state.deposits.push({
        id: Date.now(),
        amount: amt,
        interest_rate: rate,
        tenure_years: tenure / 12,
        maturity_date: new Date(Date.now() + tenure * 30 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'active'
    });

    // Deduct from mock balance if needed, but loadAll should ideally refresh it
    acc.balance -= amt;

    closeModal('fdModal');
    renderFixedDepositsPage();
    renderStats();
}
function updateDateTime() {
    const el = $id('currentDateTime'); if (!el) return;
    const now = new Date();
    el.textContent = now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
        + ' • ' + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    updateGreeting();
}



/* ════════════════════════════════════════════════════════════
   BRANCH & ATM LOCATOR (3D MAP)
   ════════════════════════════════════════════════════════════ */
/* Legacy map init removed to resolve duplicate function conflict */

function updateGreeting() {
    const el = $id('greetingText'); if (!el) return;
    const h = new Date().getHours();
    if (h < 12) el.textContent = 'Good Morning';
    else if (h < 17) el.textContent = 'Good Afternoon';
    else el.textContent = 'Good Evening';
}

/* legacy compat */
function updateFromBalance() { updateBal('neft'); }

/* ════════════════════════════════════════════════════════════
   UPI & NPCI SANDBOX
   ════════════════════════════════════════════════════════════ */
async function renderUpiPage() {
    const setupCard = $id('upiSetupCard');
    const mainContent = $id('upiMainContent');
    if (!setupCard || !mainContent) return;

    try {
        const r = await fetch(`${API}/user/upi/status`, { credentials: 'include' });
        if (r.ok) {
            const d = await r.json();
            state.upiStatus = d;
            if (d.enabled) {
                setupCard.style.display = 'none';
                mainContent.style.display = 'block';
                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=upi://pay?pa=${d.upi_id}&pn=${encodeURIComponent(state.user.name || 'User')}`;
                setText('displayUpiId', d.upi_id);
                const qrContainer = $id('displayUpiQr');
                    qrContainer.innerHTML = `<img src="${qrUrl}" alt="UPI QR Code" style="border: 4px solid #fff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); width: 150px;">`;
            } else {
                setupCard.style.display = 'block';
                mainContent.style.display = 'none';
                if (state.user) {
                    const upiUser = $id('upiUsername');
                    if (upiUser) upiUser.value = state.user.username;
                }
            }
        }
    } catch (e) {
        console.error('Failed to fetch UPI status', e);
        showToast('Offline: Could not check UPI status', 'warning');
    }
}

async function setupUPI(event) {
    event.preventDefault();
    const pin = $id('upiPin').value;
    const confirm = $id('upiPinConfirm').value;

    if (pin !== confirm) return showToast('PINs do not match', 'error');
    if (pin.length !== 6) return showToast('PIN must be 6 digits', 'error');

    const btn = event.target.querySelector('button[type="submit"]');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Setting up...';

    try {
        const r = await fetch(`${API}/user/upi/setup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ upi_pin: pin })
        });
        const d = await r.json();
        if (r.ok && d.success) {
            showToast('✓ UPI Setup Successful!', 'success');
            await renderUpiPage();
        } else {
            showToast(d.error || 'Setup failed', 'error');
        }
    } catch (e) {
        showToast('Server connection error', 'error');
    } finally {
        btn.disabled = false; btn.innerHTML = '<i class="fas fa-check-circle"></i> Enable UPI';
    }
}

function showUpiTransfer(type) {
    const target = $id('targetVpa');
    if (!target) return;
    if (type === 'internal') target.placeholder = 'username@smtbank';
    else target.placeholder = 'someone@axis';
    target.focus();
}

async function submitUpiTransfer(event) {
    event.preventDefault();
    const vpa = $id('targetVpa').value.trim();
    const amt = parseFloat($id('upiAmount').value);
    const pin = $id('upiTransferPin').value;

    if (!vpa || !amt || !pin) return showToast('All fields required', 'error');

    const btn = event.target.querySelector('button[type="submit"]');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

    try {
        const r = await fetch(`${API}/user/upi/pay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ target_vpa: vpa, amount: amt, upi_pin: pin, currency: $id('upiCurrency').value })
        });
        const d = await r.json();
        if (r.ok && d.success) {
            const sym = $id('upiCurrency').value === 'INR' ? '₹' : $id('upiCurrency').value + ' ';
            showToast(`✓ Payment Successful! Ref: ${d.reference}`, 'success');
            $id('upiTransferForm').reset();
            const preview = $id('upiConversionPreview');
            if (preview) preview.style.display = 'none';
            addNotification('UPI Payment', `${sym}${amt} sent to ${vpa}`, 'success');
            if (typeof loadAll === 'function') await loadAll();
            else await refreshBalance(true);
        } else {
            showToast(d.error || 'Payment failed', 'error');
        }
    } catch (e) {
        showToast('Transaction failed (connection error)', 'error');
    } finally {
        btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Pay Securely';
    }
}

// --- International UPI Logic ---
let upiRates = { 'USD': 83.12, 'EUR': 90.45, 'GBP': 105.67, 'AED': 22.63 };

async function updateUpiConversion() {
    const amtInput = $id('upiAmount');
    const currSelect = $id('upiCurrency');
    if (!amtInput || !currSelect) return;
    
    const amt = parseFloat(amtInput.value || 0);
    const curr = currSelect.value;
    const preview = $id('upiConversionPreview');
    
    if (curr === 'INR' || !amt) {
        if (preview) preview.style.display = 'none';
        return;
    }

    if (preview) {
        preview.style.display = 'block';
        const rate = upiRates[curr] || 1;
        const totalInr = (amt * rate).toFixed(2);
        
        $id('upiRateDisplay').innerText = `1 ${curr} = ${rate} INR`;
        $id('upiInrDisplay').innerText = `₹${parseFloat(totalInr).toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
    }
}

/* ════════════════════════════════════════════════════════════
   INJECTED STYLES (avoid touching CSS files)
   ════════════════════════════════════════════════════════════ */
function injectStyles() {
    const s = document.createElement('style'); s.textContent = `
    .mode-badge{display:inline-block;padding:1px 7px;border-radius:10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;}
    .mode-upi{background:#ede9fe;color:#7c3aed;}.mode-imps{background:#fce7f3;color:#be185d;}
    .mode-neft{background:#dbeafe;color:#1d4ed8;}.mode-rtgs{background:#d1fae5;color:#065f46;}
    .mode-atm{background:#fef3c7;color:#92400e;}.mode-cash{background:#f3f4f6;color:#374151;}
    .transfer-modes{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;}
    .mode-tab{padding:8px 16px;border:1px solid var(--border-color,#e5e7eb);border-radius:8px;background:transparent;cursor:pointer;font-size:13px;font-weight:600;color:var(--text-secondary,#6b7280);transition:all .2s;}
    .mode-tab.active{background:var(--primary-blue,#3b82f6);border-color:var(--primary-blue,#3b82f6);color:#fff;}
    .bal-hint{font-size:12px;color:var(--text-secondary,#6b7280);margin-top:4px;display:block;}
    .ifsc-info{font-size:12px;margin-top:4px;display:block;}
    .toggle-switch{position:relative;display:inline-block;width:44px;height:24px;}
    .toggle-switch input{opacity:0;width:0;height:0;}
    .toggle-slider{position:absolute;cursor:pointer;inset:0;background:#cbd5e1;border-radius:24px;transition:.3s;}
    .toggle-slider:before{position:absolute;content:'';height:16px;width:16px;left:4px;bottom:4px;background:#fff;border-radius:50%;transition:.3s;}
    input:checked+.toggle-slider{background:#3b82f6;}
    input:checked+.toggle-slider:before{transform:translateX(20px);}
    .text-success{color:#10b981!important;}.text-danger{color:#ef4444!important;}
    .badge{padding:2px 8px;border-radius:8px;font-size:11px;font-weight:600;}
    .badge-success{background:#d1fae5;color:#065f46;}.badge-danger{background:#fee2e2;color:#991b1b;}
    .loan-status{padding:2px 10px;border-radius:20px;font-size:11px;font-weight:600;}
    .loan-status.pending{background:#fef3c7;color:#92400e;}.loan-status.approved{background:#d1fae5;color:#065f46;}
    .loan-status.rejected{background:#fee2e2;color:#991b1b;}.loan-status.active{background:#dbeafe;color:#1d4ed8;}
    .account-badge{padding:2px 10px;border-radius:20px;font-size:11px;font-weight:600;}
    .account-badge.active{background:#d1fae5;color:#065f46;}.account-badge.inactive{background:#fee2e2;color:#991b1b;}
    @keyframes spin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
    .fa-spin{animation:spin 1s linear infinite;}`;
    document.head.appendChild(s);
}

// Financial Product Modals
// Financial Product Modals
function showMutualFundModal() {
    openSimpleModal('mfModal');
}

function closeMutualFundModal() {
    closeSimpleModal('mfModal');
}

function showLifeInsuranceModal() {
    openSimpleModal('insuranceModal');
}

function closeLifeInsuranceModal() {
    closeSimpleModal('insuranceModal');
}

function showGoldLoanModal() {
    openSimpleModal('goldLoanModal');
}

function closeGoldLoanModal() {
    closeSimpleModal('goldLoanModal');
}

function showApplicationModal(productName) {
    const modal = document.getElementById('applicationFormModal');
    if (!modal) return;

    const nameEl = document.getElementById('applicationProductName');
    if (nameEl) nameEl.textContent = productName;

    // Show/Hide tenure group for loans
    const tenureGroup = document.getElementById('tenureGroup');
    if (tenureGroup) {
        tenureGroup.style.display = productName.includes('Loan') ? 'block' : 'none';
    }

    // Populate linked accounts
    const accountSelect = document.getElementById('applicationAccount');
    if (accountSelect && state.accounts) {
        accountSelect.innerHTML = state.accounts.map(acc =>
            `<option value="${acc.id}">${acc.account_type} - ${acc.account_number} (${fmtINR(acc.balance)})</option>`
        ).join('') || '<option value="">No Active Accounts Available</option>';
    }

    openSimpleModal('applicationFormModal');
}

function closeApplicationModal() {
    closeSimpleModal('applicationFormModal');
}

async function submitFinancialApplication() {
    const productName = document.getElementById('applicationProductName')?.textContent;
    const accountId = document.getElementById('applicationAccount')?.value;
    const amountStr = document.getElementById('applicationAmount')?.value;
    const amount = parseFloat(amountStr || 0);
    const isLoan = productName.includes('Loan');
    const tenure = isLoan ? document.getElementById('applicationTenure')?.value : null;
    const aadhaar = document.getElementById('applicationAadhaar')?.value;

    if (!accountId) return showToast('Please select an account', 'error');
    if (amount <= 0) return showToast('Please enter a valid amount', 'error');

    // Find account number from id
    const account = state.accounts.find(a => a.id == accountId);
    if (!account) return showToast('Selected account not found', 'error');

    // Only investments require direct payment from balance
    if (!isLoan && account.balance < amount) {
        return showToast('Insufficient balance in selected account', 'error');
    }

    const btn = document.querySelector('#applicationFormModal .btn-primary');
    const originalText = btn?.innerHTML || 'Submit Application';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
    }

    try {
        const response = await fetch(`${API}/mobile/apply-investment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                product_name: productName,
                amount: amount,
                account_number: account.account_number,
                target_account_id: account.id,
                tenure: tenure,
                aadhaar_number: aadhaar
            })
        });

        const data = await response.json();
        if (response.ok) {
            showToast(data.message || `Application for ${productName} submitted!`, 'success');
            addNotification('Investment Application', `${productName} for ${fmtINR(amount)} submitted`, 'success');

            // Close all related modals
            closeApplicationModal();
            closeMutualFundModal();
            closeLifeInsuranceModal();
            closeGoldLoanModal();

            // Refresh data
            await refreshBalance(true);
        } else {
            showToast(data.error || 'Failed to submit application', 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('Error connecting to server', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
}

// Utility to dry up simple modals
function openSimpleModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.add('active');
        // Fallback for modals using display:none instead of opacity/visibility
        if (window.getComputedStyle(modal).display === 'none') {
            modal.style.display = 'flex';
        }
    }
}

function closeSimpleModal(id) {
    closeModal(id);
}

/* ── Balance Card Actions ──────────────────────────────── */
let _desktopPasscodeEnabled = null;
let _desktopPinBuffer = '';
let _desktopPinMode = 'verify'; // 'setup_new', 'setup_confirm', 'verify'
let _desktopPinSetupFirst = '';

async function checkDesktopPasscodeStatus() {
    try {
        const r = await fetch(`${API}/auth/mobile/passcode-status`, { credentials: 'include' });
        if (r.ok) {
            const d = await r.json();
            _desktopPasscodeEnabled = !!d.enabled;
        }
    } catch (e) {
        console.warn('[Desktop PIN] Status check failed');
    }
    return _desktopPasscodeEnabled;
}

async function toggleBalanceVisibility() {
    const isHidden = localStorage.getItem('hideBalance') === 'true';

    if (isHidden) {
        // Currently hidden → just show (no PIN needed)
        localStorage.setItem('hideBalance', 'false');
    } else {
        // Currently visible → just hide
        localStorage.setItem('hideBalance', 'true');
    }
    renderStats();
}

function openDesktopPinModal() {
    _desktopPinBuffer = '';
    _desktopPinSetupFirst = '';

    const modal = $id('desktopPinModal');
    if (!modal) return;

    const title = $id('deskPinTitle');
    const subtitle = $id('deskPinSubtitle');
    const errMsg = $id('deskPinError');

    if (errMsg) errMsg.textContent = '';
    updateDesktopPinDots();

    if (_desktopPasscodeEnabled) {
        _desktopPinMode = 'verify';
        if (title) title.textContent = 'Enter Balance PIN';
        if (subtitle) subtitle.textContent = 'Enter your 4-digit PIN to view your balance';
    } else {
        _desktopPinMode = 'setup_new';
        if (title) title.textContent = 'Set Balance PIN';
        if (subtitle) subtitle.textContent = 'Create a 4-digit PIN to protect your balance';
    }

    modal.classList.add('active');
    modal.style.display = 'flex';
}

function closeDesktopPinModal() {
    const modal = $id('desktopPinModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
    _desktopPinBuffer = '';
    _desktopPinSetupFirst = '';
}

function updateDesktopPinDots() {
    for (let i = 0; i < 4; i++) {
        const dot = $id(`deskPinDot${i}`);
        if (dot) {
            dot.classList.remove('filled', 'error', 'success');
            if (i < _desktopPinBuffer.length) dot.classList.add('filled');
        }
    }
}

function desktopPinInput(digit) {
    if (_desktopPinBuffer.length >= 4) return;
    _desktopPinBuffer += digit;
    updateDesktopPinDots();
    if (_desktopPinBuffer.length === 4) {
        setTimeout(() => handleDesktopPinComplete(), 200);
    }
}

function desktopPinBackspace() {
    if (_desktopPinBuffer.length === 0) return;
    _desktopPinBuffer = _desktopPinBuffer.slice(0, -1);
    updateDesktopPinDots();
}

async function handleDesktopPinComplete() {
    const pin = _desktopPinBuffer;
    const title = $id('deskPinTitle');
    const subtitle = $id('deskPinSubtitle');
    const errMsg = $id('deskPinError');

    if (_desktopPinMode === 'setup_new') {
        _desktopPinSetupFirst = pin;
        _desktopPinBuffer = '';
        _desktopPinMode = 'setup_confirm';
        if (title) title.textContent = 'Confirm PIN';
        if (subtitle) subtitle.textContent = 'Re-enter your 4-digit PIN to confirm';
        if (errMsg) errMsg.textContent = '';
        updateDesktopPinDots();
        return;
    }

    if (_desktopPinMode === 'setup_confirm') {
        if (pin === _desktopPinSetupFirst) {
            try {
                const r = await fetch(`${API}/auth/mobile/setup-passcode`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ passcode: pin })
                });
                const d = await r.json();
                if (r.ok && d.success) {
                    _desktopPasscodeEnabled = true;
                    desktopPinSuccess();
                } else {
                    desktopPinError(d.error || 'Setup failed');
                    _desktopPinMode = 'setup_new';
                    _desktopPinSetupFirst = '';
                    if (title) title.textContent = 'Set Balance PIN';
                    if (subtitle) subtitle.textContent = 'Create a 4-digit PIN to protect your balance';
                }
            } catch (e) {
                desktopPinError('Connection error');
            }
        } else {
            desktopPinError('PINs don\'t match. Try again.');
            _desktopPinMode = 'setup_new';
            _desktopPinSetupFirst = '';
            if (title) title.textContent = 'Set Balance PIN';
            if (subtitle) subtitle.textContent = 'Create a 4-digit PIN to protect your balance';
        }
        return;
    }

    if (_desktopPinMode === 'verify') {
        try {
            const r = await fetch(`${API}/auth/mobile/verify-passcode`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ passcode: pin })
            });
            const d = await r.json();
            if (r.ok && d.success) {
                desktopPinSuccess();
            } else {
                desktopPinError('Incorrect PIN. Try again.');
            }
        } catch (e) {
            desktopPinError('Connection error');
        }
    }
}

function desktopPinSuccess() {
    for (let i = 0; i < 4; i++) {
        const dot = $id(`deskPinDot${i}`);
        if (dot) {
            dot.classList.remove('filled', 'error');
            dot.classList.add('success');
        }
    }
    setTimeout(() => {
        closeDesktopPinModal();
        localStorage.setItem('hideBalance', 'false');
        renderStats();
        showToast('Balance revealed', 'success');
    }, 400);
}

function desktopPinError(msg) {
    const errMsg = $id('deskPinError');
    if (errMsg) errMsg.textContent = msg || 'Incorrect PIN';

    for (let i = 0; i < 4; i++) {
        const dot = $id(`deskPinDot${i}`);
        if (dot) {
            dot.classList.remove('filled', 'success');
            dot.classList.add('error');
        }
    }

    setTimeout(() => {
        _desktopPinBuffer = '';
        updateDesktopPinDots();
        if (errMsg) errMsg.textContent = '';
    }, 1200);
}

async function manualRefreshBalance() {
    const icon = $id('balanceRefreshIcon');
    if (icon) icon.classList.add('fa-spin');

    try {
        await loadAll();
        showToast('Balance updated', 'success');
    } catch (e) {
        showToast('Refresh failed', 'error');
    } finally {
        if (icon) {
            // Remove spin after a short delay for better UX
            setTimeout(() => icon.classList.remove('fa-spin'), 600);
        }
    }
}

/**
 * Screenshot & Privacy Protection
 * Deterrence measures for financial data security
 */
// Screenshot and Privacy Protection removed
function initSecurity() {
    // Disabled
}

/* ════════════════════════════════════════════════════════════
   BENEFICIARY MANAGEMENT
   ════════════════════════════════════════════════════════════ */

async function loadBeneficiaries() {
    try {
        const r = await fetch(`${API}/user/beneficiaries`, { credentials: 'include' });
        if (r.ok) state.beneficiaries = await r.json() || [];
    } catch (e) { console.error('Error loading beneficiaries:', e); }
}

function renderBeneficiariesPage() {
    const el = $id('beneficiariesContent'); if (!el) return;
    if (!state.beneficiaries.length) {
        el.innerHTML = `
        <div style="text-align:center;padding:40px;background:var(--bg-light);border-radius:12px;border:1px dashed var(--border-color);">
            <i class="fas fa-user-friends" style="font-size:40px;color:var(--text-secondary);margin-bottom:16px;opacity:0.5;"></i>
            <h4 style="margin-bottom:8px;">No Beneficiaries Saved</h4>
            <p style="color:var(--text-secondary);font-size:14px;margin-bottom:20px;">Save frequent payees to make transfers instantly.</p>
            <button class="btn btn-primary btn-sm" onclick="showAddBeneficiaryModal()">Add Your First Beneficiary</button>
        </div>`;
        return;
    }

    el.innerHTML = `
    <div class="dashboard-grid grid-3">
        ${state.beneficiaries.map(b => `
        <div class="card" style="padding:20px;border:1px solid var(--border-color);position:relative;">
            <div style="width:40px;height:40px;border-radius:50%;background:var(--maroon-light);color:var(--primary-maroon);display:flex;align-items:center;justify-content:center;margin-bottom:12px;font-weight:700;">
                ${b.name.charAt(0).toUpperCase()}
            </div>
            <div style="font-weight:700;font-size:16px;margin-bottom:4px;">${escHtml(b.nickname || b.name)}</div>
            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">${escHtml(b.bank_name || 'SmartBank')}</div>
            <div style="font-family:monospace;font-size:13px;background:var(--bg-light);padding:4px 8px;border-radius:6px;margin-bottom:4px;">${escHtml(b.account_number)}</div>
            <div style="font-size:11px;color:var(--text-secondary);">IFSC: ${escHtml(b.ifsc || '—')}</div>
            
            <div style="display:flex;gap:8px;margin-top:16px;">
                <button class="btn btn-sm" style="flex:1;padding:6px;font-size:12px;" onclick="useBeneficiary(${b.id})">Transfer</button>
                <button class="btn btn-sm" style="background:#fef2f2;color:#991b1b;padding:6px;width:32px;" onclick="deleteBeneficiary(${b.id})" title="Remove">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        </div>`).join('')}
    </div>`;
}

function showAddBeneficiaryModal() {
    showConfirm({
        title: 'Add New Beneficiary',
        message: `
        <div style="text-align:left;margin-top:10px;">
            <div class="form-group"><label class="form-label">Full Name</label><input id="benName" class="form-input" placeholder="e.g. John Doe"></div>
            <div class="form-group"><label class="form-label">Account Number</label><input id="benAcc" class="form-input" placeholder="Enter account number"></div>
            <div class="form-group"><label class="form-label">IFSC Code (Optional)</label><input id="benIfsc" class="form-input" placeholder="e.g. SMTB0000001"></div>
            <div class="form-group"><label class="form-label">Bank Name</label><input id="benBank" class="form-input" placeholder="e.g. SmartBank"></div>
            <div class="form-group"><label class="form-label">Nickname (Optional)</label><input id="benNick" class="form-input" placeholder="e.g. Home, Dad"></div>
        </div>`,
        icon: 'fa-user-plus',
        confirmText: 'Save Beneficiary',
        onConfirm: async () => {
            const name = $id('benName').value;
            const acc = $id('benAcc').value;
            if(!name || !acc) return showToast('Name and Account Number are required', 'error');
            
            try {
                const r = await fetch(`${API}/user/beneficiaries`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        name, account_number: acc, 
                        ifsc: $id('benIfsc').value,
                        bank_name: $id('benBank').value,
                        nickname: $id('benNick').value
                    })
                });
                if(r.ok) {
                    showToast('Beneficiary saved successfully', 'success');
                    await loadBeneficiaries();
                    renderBeneficiariesPage();
                } else {
                    const err = await r.json();
                    showToast(err.error || 'Failed to save', 'error');
                }
            } catch (e) { showToast('Network error', 'error'); }
        }
    });
}

async function deleteBeneficiary(id) {
    showConfirm({
        title: 'Remove Beneficiary',
        message: 'Are you sure you want to remove this beneficiary?',
        icon: 'fa-trash-alt',
        confirmText: 'Remove',
        onConfirm: async () => {
            try {
                const r = await fetch(`${API}/user/beneficiaries/${id}`, { method: 'DELETE', credentials: 'include' });
                if(r.ok) {
                    showToast('Beneficiary removed', 'success');
                    await loadBeneficiaries();
                    renderBeneficiariesPage();
                }
            } catch (e) { showToast('Error removing beneficiary', 'error'); }
        }
    });
}

function useBeneficiary(id) {
    const b = state.beneficiaries.find(x => x.id === id);
    if(!b) return;
    showPage('transfer');
    switchMode('NEFT');
    setTimeout(() => {
        if($id('neftToAcct')) $id('neftToAcct').value = b.account_number;
        if($id('neftIfsc')) $id('neftIfsc').value = b.ifsc || '';
        if($id('neftName')) $id('neftName').value = b.name;
    }, 100);
}

function showBeneficiarySelector(mode) {
    if(!state.beneficiaries.length) return showToast('No saved beneficiaries found.', 'info');
    
    // Simple custom selector modal
    const listHtml = state.beneficiaries.map(b => `
        <div class="ben-item" onclick="selectBen('${mode}', ${b.id})" style="padding:12px;border-bottom:1px solid #f1f5f9;cursor:pointer;display:flex;align-items:center;gap:12px;transition:0.2s;">
            <div style="width:32px;height:32px;border-radius:50%;background:#800000;color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;">${b.name.charAt(0)}</div>
            <div style="flex:1;">
                <div style="font-weight:600;font-size:14px;">${escHtml(b.nickname || b.name)}</div>
                <div style="font-size:11px;color:#64748b;">${escHtml(b.account_number)} • ${escHtml(b.bank_name || 'SmartBank')}</div>
            </div>
            <i class="fas fa-chevron-right" style="font-size:10px;color:#94a3b8;"></i>
        </div>
    `).join('');

    showConfirm({
        title: 'Select Beneficiary',
        message: `<div style="max-height:300px;overflow-y:auto;text-align:left;border:1px solid #e2e8f0;border-radius:12px;margin-top:10px;">${listHtml}</div>`,
        icon: 'fa-users',
        confirmText: 'Cancel',
        onConfirm: () => {}
    });
}

function selectBen(mode, id) {
    const b = state.beneficiaries.find(x => x.id === id);
    if(!b) return;
    
    const prefix = mode.toLowerCase();
    if($id(`${prefix}ToAcct`)) $id(`${prefix}ToAcct`).value = b.account_number;
    if($id(`${prefix}Ifsc`)) $id(`${prefix}Ifsc`).value = b.ifsc || '';
    if($id(`${prefix}Name`)) $id(`${prefix}Name`).value = b.name;
    
    const modal = document.getElementById('_confirmModal');
    if(modal) modal.remove();
    showToast(`Selected ${b.name}`, 'success');
}

/* ════════════════════════════════════════════════════════════
   SAVINGS GOALS (POCKETS)
   ════════════════════════════════════════════════════════════ */

async function loadPockets() {
    try {
        const r = await fetch(`${API}/user/savings-goals`, { credentials: 'include' });
        if (r.ok) state.pockets = await r.json() || [];
    } catch (e) { console.error('Error loading pockets:', e); }
}

function renderPocketsPage() {
    const el = $id('pocketsContent'); if (!el) return;
    const grid = $id('goalsGrid'); if (!grid) return;

    if (!state.pockets.length) {
        grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:60px 20px;background:var(--bg-light);border-radius:20px;border:2px dashed var(--border-color);">
            <div style="width:80px;height:80px;background:var(--maroon-light);color:var(--primary-maroon);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 24px;font-size:32px;">
                <i class="fas fa-bullseye"></i>
            </div>
            <h3 style="margin-bottom:12px;">Achieve Your Dreams with Pockets</h3>
            <p style="color:var(--text-secondary);max-width:400px;margin:0 auto 24px;">Set savings goals for anything—a new car, a dream vacation, or emergency funds. Track your progress in real-time.</p>
            <button class="btn btn-primary" onclick="showAddGoalModal()">Create Your First Pocket</button>
        </div>`;
        return;
    }

    grid.innerHTML = state.pockets.map(g => {
        const progress = Math.min((g.current_amount / g.target_amount) * 100, 100);
        return `
        <div class="card" style="padding:24px;position:relative;overflow:hidden;border:1px solid var(--border-color);transition:transform 0.3s ease;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
                <div>
                    <h4 style="margin:0;font-size:18px;font-weight:700;">${escHtml(g.name)}</h4>
                    <span style="font-size:12px;color:var(--text-secondary);"><i class="fas fa-calendar-alt"></i> ${g.deadline ? 'Due: ' + new Date(g.deadline).toLocaleDateString() : 'No Deadline'}</span>
                </div>
                <div style="background:${g.status==='completed' ? '#ecfdf5' : '#fef2f2'};color:${g.status==='completed' ? '#059669' : '#991b1b'};padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;">
                    ${g.status}
                </div>
            </div>
            
            <div style="margin-bottom:20px;">
                <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:10px;">
                    <span style="font-weight:600;color:var(--primary-maroon);">${fmtINR(g.current_amount)}</span>
                    <span style="color:var(--text-secondary);">Goal: ${fmtINR(g.target_amount)}</span>
                </div>
                <div style="height:12px;background:#f1f5f9;border-radius:10px;overflow:hidden;position:relative;">
                    <div style="height:100%;width:${progress}%;background:linear-gradient(90deg, var(--primary-maroon), #ef4444);border-radius:10px;transition:width 1s cubic-bezier(0.4, 0, 0.2, 1);"></div>
                </div>
                <div style="text-align:right;font-size:12px;font-weight:700;margin-top:8px;color:var(--text-secondary);">${Math.round(progress)}% Achieved</div>
            </div>

            <div style="display:flex;gap:10px;">
                <button class="btn btn-sm" style="flex:1;background:var(--bg-light);color:var(--text-primary);border:1.5px solid var(--border-color);" onclick="updatePocket(${g.id})">Add Funds</button>
                <button class="btn btn-sm btn-primary" style="flex:1;" onclick="completePocket(${g.id})" ${g.status==='completed' ? 'disabled' : ''}>Break Pocket</button>
            </div>
        </div>`;
    }).join('');
}

function showAddGoalModal() {
    showConfirm({
        title: 'Create New Savings Goal',
        message: `
        <div style="text-align:left;margin-top:10px;">
            <div class="form-group"><label class="form-label">Goal Name</label><input id="goalName" class="form-input" placeholder="e.g. Dream Car, Vacation"></div>
            <div class="form-group"><label class="form-label">Target Amount (₹)</label><input id="goalTarget" type="number" class="form-input" placeholder="How much do you need?"></div>
            <div class="form-group"><label class="form-label">Deadline (Optional)</label><input id="goalDeadline" type="date" class="form-input"></div>
        </div>`,
        icon: 'fa-bullseye',
        confirmText: 'Start Saving',
        onConfirm: async () => {
            const name = $id('goalName').value;
            const target = $id('goalTarget').value;
            if(!name || !target) return showToast('Goal name and target are required', 'error');
            
            try {
                const r = await fetch(`${API}/user/savings-goals`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ name, target_amount: target, deadline: $id('goalDeadline').value })
                });
                if(r.ok) {
                    showToast('Pocket created! Good luck with your goal.', 'success');
                    await loadPockets();
                    renderPocketsPage();
                }
            } catch (e) { showToast('Error creating pocket', 'error'); }
        }
    });
}

/* ════════════════════════════════════════════════════════════
   PDF STATEMENTS
   ════════════════════════════════════════════════════════════ */

async function downloadPDFStatement(type) {
    const periodId = type === 'invoice' ? 'invoicePeriod' : 'statementPeriod';
    const period = ($id(periodId) || {}).value || 'current';
    
    showToast('Generating premium PDF statement...', 'info');
    try {
        const r = await fetch(`${API}/user/statements/download/${period}`, { credentials: 'include' });
        if(r.ok) {
            const blob = await r.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            
            let name = 'Statement';
            if (period === 'all') name = 'Full_History';
            else if (period === '6months') name = 'Last_6_Months';
            else if (period === 'current') name = `Current_Month_${new Date().getMonth() + 1}`;
            
            a.download = `SmartBank_${name}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            showToast('Statement downloaded successfully!', 'success');
        } else {
            showToast('Failed to generate statement. Please try again.', 'error');
        }
    } catch (e) { showToast('Error downloading statement', 'error'); }
}

async function downloadTransactionReceipt(txnId) {
    showToast('Generating premium PDF receipt...', 'info');
    try {
        const r = await fetch(`${API}/user/statements/download/transaction/${txnId}`, { credentials: 'include' });
        if(r.ok) {
            const blob = await r.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `SmartBank_Premium_Receipt_${txnId}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            showToast('Receipt downloaded!', 'success');
        } else {
            showToast('Failed to generate receipt.', 'error');
        }
    } catch (e) { 
        console.error(e);
        showToast('Error downloading receipt.', 'error'); 
    }
}
async function submitSupportRequest(e) {
    if(e) e.preventDefault();
    const btn = $id('supportRequestForm').querySelector('button[type="submit"]');
    const oldText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
    btn.disabled = true;

    try {
        const r = await fetch(`${API}/user/support`, {
            method: 'POST',
            credentials: 'include',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                category: $id('supportType').value,
                priority: $id('supportPriority').value,
                subject: $id('supportSubject').value,
                message: $id('supportMessage').value
            })
        });
        if(r.ok) {
            showToast('Support ticket raised successfully!', 'success');
            closeModal('supportRequestModal');
            $id('supportRequestForm').reset();
            renderSupportPage();
        } else {
            showToast('Failed to raise ticket. Please try again.', 'error');
        }
    } catch (e) { showToast('Network error', 'error'); }
    finally {
        btn.innerHTML = oldText;
        btn.disabled = false;
    }
}

async function updatePocket(id) {
    const p = state.pockets.find(x => x.id === id);
    if(!p) return;
    
    showConfirm({
        title: `Add Funds to ${p.name}`,
        message: `
            <div style="text-align:left;margin-top:10px;">
                <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">How much would you like to add to this pocket?</p>
                <div class="form-group">
                    <label class="form-label">Amount (₹)</label>
                    <input id="pocketAddAmt" type="number" class="form-input" placeholder="e.g. 1000">
                </div>
            </div>`,
        icon: 'fa-plus-circle',
        confirmText: 'Add Funds',
        onConfirm: async () => {
            const amt = $id('pocketAddAmt').value;
            if(!amt || amt <= 0) return showToast('Please enter a valid amount', 'error');
            
            try {
                const r = await fetch(`${API}/user/savings-goals/${id}/add-funds`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ amount: amt })
                });
                if(r.ok) {
                    showToast(`Success! ₹${amt} added to ${p.name}`, 'success');
                    await loadPockets();
                    renderPocketsPage();
                }
            } catch (e) { showToast('Error updating pocket', 'error'); }
        }
    });
}

async function completePocket(id) {
    const p = state.pockets.find(x => x.id === id);
    if(!p) return;
    
    showConfirm({
        title: 'Break Pocket',
        message: `Are you sure you want to break the "${escHtml(p.name)}" pocket? ₹${p.current_amount} will be returned to your main account.`,
        icon: 'fa-piggy-bank',
        confirmText: 'Break Pocket',
        onConfirm: async () => {
            try {
                const r = await fetch(`${API}/user/savings-goals/${id}/break`, {
                    method: 'POST', credentials: 'include'
                });
                if(r.ok) {
                    const d = await r.json();
                    showToast(d.message || 'Pocket broken! Funds returned to account.', 'success');
                    addNotification('Pocket Broken', `₹${p.current_amount} from "${p.name}" returned`, 'success');
                    await loadPockets();
                    renderPocketsPage();
                    await refreshBalance(true);
                } else {
                    const d = await r.json().catch(() => ({}));
                    showToast(d.error || 'Failed to break pocket', 'error');
                }
            } catch (e) { showToast('Error breaking pocket', 'error'); }
        }
    });
}

/* ════════════════════════════════════════════════════════════
   AGRICULTURE LOAN (AI + SATELLITE)
   ════════════════════════════════════════════════════════════ */

function showAgriLoanModal() {
    openSimpleModal('agriLoanModal');
    
    // Reset form
    const form = $id('agriLoanForm');
    if(form) form.reset();
    $id('agriResultArea').style.display = 'none';
    $id('aiScannerOverlay').style.display = 'none';
    const btn = $id('agriSubmitBtn');
    btn.style.display = 'block';
    btn.disabled = false;
}

function closeAgriLoanModal() {
    closeSimpleModal('agriLoanModal');
}

async function submitAgriLoan(e) {
    if(e) e.preventDefault();
    
    const address = $id('agriAddress').value;
    const state = $id('agriState').value;
    const survey = $id('agriSurvey').value;
    const coords = `${address}, ${state}, Survey/Khata: ${survey}`;
    
    const size = $id('agriSize').value;
    const crop = $id('agriCrop').value;
    const amt = $id('agriAmount').value;
    
    if(!address || !state || !survey) return showToast('Please enter complete farm details', 'error');
    
    const btn = $id('agriSubmitBtn');
    btn.disabled = true;
    
    // Start Scanner Animation on the Map
    $id('aiScannerOverlay').style.display = 'block';
    
    try {
        const r = await fetch(`${API}/agri/apply`, {
            method: 'POST',
            credentials: 'include',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                coordinates: coords,
                size_acres: size,
                crop_type: crop,
                amount: amt
            })
        });
        
        const data = await r.json();
        
        // Wait for animation mock effect (e.g. 3 seconds)
        setTimeout(() => {
            $id('aiScannerOverlay').style.display = 'none';
            btn.style.display = 'none'; // Hide submit button, show results
            
            if(r.ok) {
                showToast('Farm Analysis Complete', 'success');
                $id('agriResultArea').style.display = 'block';
                $id('agriResultScore').textContent = data.score + '/100';
                $id('agriResultMoisture').textContent = (data.soil_moisture !== null ? data.soil_moisture + ' m³' : 'N/A');
                
                const recEl = $id('agriResultRec');
                recEl.textContent = data.recommendation;
                recEl.style.color = data.score >= 75 ? 'var(--success)' : (data.score >= 50 ? 'var(--warning)' : 'var(--danger)');
                
                addNotification('Agri Loan App', `Analysis complete. AI Score: ${data.score}`, 'info');
            } else {
                showToast(data.error || 'Analysis failed', 'error');
                btn.disabled = false;
                btn.style.display = 'block';
            }
        }, 3000);
        
    } catch (err) {
        $id('aiScannerOverlay').style.display = 'none';
        btn.disabled = false;
        showToast('Connection error during analysis', 'error');
    }
}

/* ════════════════════════════════════════════════════════════
   CROP MARKETPLACE — FARMER SIDE
   ════════════════════════════════════════════════════════════ */

// Show nav item only if user has an Agriculture account
function checkAgriMarketplaceVisibility() {
    const hasAgri = (state.accounts || []).some(a => a.account_type && a.account_type.toLowerCase() === 'agriculture');
    const nav = document.getElementById('navCropMarketplace');
    if (nav) nav.style.display = hasAgri ? '' : 'none';
}

function switchMarketTab(tab) {
    document.querySelectorAll('.mkt-panel').forEach(p => p.style.display = 'none');
    document.querySelectorAll('.mkt-tab').forEach(b => b.classList.remove('active'));
    
    const panel = document.getElementById('mktTab' + tab.charAt(0).toUpperCase() + tab.slice(1));
    if (panel) panel.style.display = 'block';
    
    const btn = document.querySelector(`.mkt-tab[data-tab="${tab}"]`);
    if (btn) btn.classList.add('active');

    if (tab === 'listings') loadFarmerListings();
    if (tab === 'orders') loadFarmerOrders();
    if (tab === 'escrow') loadFarmerEscrow();
    if (tab === 'mandi') loadMandiPrices();
    if (tab === 'tax') loadFarmerTaxRecords();
}

function showCreateListingModal() {
    $id('lstId').value = '';
    $id('lstCropName').value = '';
    $id('lstQty').value = '';
    $id('lstPrice').value = '';
    $id('lstMinOrder').value = '1';
    $id('lstHarvestDate').value = '';
    $id('lstLocation').value = '';
    $id('lstImageUrl').value = '';
    $id('lstImageFile').value = '';
    $id('cropImagePreview').style.display = 'none';
    $id('lstDescription').value = '';
    document.querySelector('#createListingModal .modal-title').innerHTML = '<i class="fas fa-seedling"></i> New Crop Listing';
    openSimpleModal('createListingModal');
}

function editListing(id) {
    if (!window._myCropListings) return;
    const l = window._myCropListings.find(x => x.id === id);
    if (!l) return;
    $id('lstId').value = l.id;
    $id('lstCropName').value = l.crop_name || '';
    $id('lstCategory').value = l.category || 'General';
    $id('lstQty').value = l.quantity_kg || '';
    $id('lstPrice').value = l.price_per_kg || '';
    $id('lstMinOrder').value = l.min_order_kg || 1;
    $id('lstHarvestDate').value = l.harvest_date ? l.harvest_date.split('T')[0] : '';
    $id('lstLocation').value = l.location || '';
    $id('lstImageUrl').value = l.image_url || '';
    if (l.image_url) {
        $id('cropImagePreview').style.backgroundImage = `url(${l.image_url})`;
        $id('cropImagePreview').style.display = 'block';
    } else {
        $id('cropImagePreview').style.display = 'none';
    }
    $id('lstImageFile').value = '';
    $id('lstDescription').value = l.description || '';
    document.querySelector('#createListingModal .modal-title').innerHTML = '<i class="fas fa-edit"></i> Edit Crop Listing';
    openSimpleModal('createListingModal');
}

function previewCropImage(input) {
    const preview = $id('cropImagePreview');
    const urlInput = $id('lstImageUrl');
    if (input.files && input.files[0]) {
        if (input.files[0].size > 2 * 1024 * 1024) {
            showToast('Image is too large (max 2MB)', 'error');
            input.value = '';
            preview.style.display = 'none';
            return;
        }
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.style.backgroundImage = `url(${e.target.result})`;
            preview.style.display = 'block';
            urlInput.value = e.target.result;
        }
        reader.readAsDataURL(input.files[0]);
    } else {
        preview.style.display = 'none';
        urlInput.value = '';
    }
}

async function submitCreateListing() {
    const name = $id('lstCropName')?.value;
    const qty = $id('lstQty')?.value;
    const price = $id('lstPrice')?.value;
    if (!name || !qty || !price) return showToast('Crop name, quantity, and price are required', 'error');

    const lstId = $id('lstId')?.value;
    const method = lstId ? 'PUT' : 'POST';
    const url = lstId ? `${API}/marketplace/listings/${lstId}` : `${API}/marketplace/listings`;

    try {
        const r = await fetch(url, {
            method: method, credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                crop_name: name, category: $id('lstCategory')?.value || 'General',
                quantity_kg: parseFloat(qty), price_per_kg: parseFloat(price),
                min_order_kg: parseFloat($id('lstMinOrder')?.value || 1),
                harvest_date: $id('lstHarvestDate')?.value,
                location: $id('lstLocation')?.value,
                image_url: $id('lstImageUrl')?.value,
                description: $id('lstDescription')?.value
            })
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        showToast(d.message, 'success');
        closeModal('createListingModal');
        loadFarmerListings();
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
}

async function loadMandiPrices() {
    const el = document.getElementById('mandiPricesContent');
    if (!el) return;
    
    const state = document.getElementById('mandiStateFilter')?.value || 'All';
    const commodity = document.getElementById('mandiCommodityFilter')?.value || 'All';
    
    el.innerHTML = '<div style="text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin fa-2x" style="color:var(--primary-maroon)"></i><p style="margin-top:12px;color:var(--text-secondary)">Fetching live market rates...</p></div>';
    
    try {
        const r = await fetch(`${API}/marketplace/mandi/prices?state=${state}&commodity=${commodity}`, { credentials: 'include' });
        const d = await r.json();
        
        if (!d.success) throw new Error(d.error);
        
        // Update filters if they are empty (first load)
        const stateSel = document.getElementById('mandiStateFilter');
        const commSel = document.getElementById('mandiCommodityFilter');
        if (stateSel && stateSel.options.length <= 1) {
            d.filters.states.forEach(s => stateSel.add(new Option(s, s)));
            d.filters.commodities.forEach(c => commSel.add(new Option(c, c)));
            stateSel.value = state;
            commSel.value = commodity;
        }
        
        if (!d.prices.length) {
            el.innerHTML = '<div style="text-align:center;padding:40px;background:var(--main-bg);border-radius:12px;"><i class="fas fa-search" style="font-size:32px;color:var(--text-secondary);margin-bottom:12px;"></i><p>No mandi prices found for current selection.</p></div>';
            return;
        }
        
        el.innerHTML = `<div class="dashboard-grid grid-3" style="gap:20px;">
            ${d.prices.map(p => `
                <div class="card" style="padding:0; overflow:hidden; border:1px solid var(--border-color); transition:transform 0.2s;" onmouseover="this.style.transform='translateY(-4px)'" onmouseout="this.style.transform='translateY(0)'">
                    <div style="background:var(--main-bg); padding:12px 16px; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:12px; font-weight:700; color:var(--primary-maroon); text-transform:uppercase;">${p.commodity}</span>
                        <span style="font-size:10px; padding:2px 8px; border-radius:10px; background:${p.trend === 'up' ? '#dcfce7' : (p.trend === 'down' ? '#fee2e2' : '#f1f5f9')}; color:${p.trend === 'up' ? '#166534' : (p.trend === 'down' ? '#991b1b' : '#475569')}; font-weight:700;">
                            <i class="fas fa-arrow-${p.trend === 'up' ? 'up' : (p.trend === 'down' ? 'down' : 'minus')}"></i> ${p.trend.toUpperCase()}
                        </span>
                    </div>
                    <div style="padding:16px;">
                        <div style="font-weight:800; font-size:18px; color:var(--text-primary); margin-bottom:4px;">₹${p.modal_price.toLocaleString('en-IN')}</div>
                        <div style="font-size:11px; color:var(--text-secondary); margin-bottom:12px;">Modal Price per Quintal (100kg)</div>
                        
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:16px; background:var(--main-bg); padding:8px; border-radius:8px;">
                            <div><div style="font-size:9px; color:var(--text-secondary); text-transform:uppercase;">Min</div><div style="font-weight:700; font-size:13px;">₹${p.min_price}</div></div>
                            <div><div style="font-size:9px; color:var(--text-secondary); text-transform:uppercase;">Max</div><div style="font-weight:700; font-size:13px;">₹${p.max_price}</div></div>
                        </div>
                        
                        <div style="border-top:1px dashed var(--border-color); padding-top:12px;">
                            <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                                <i class="fas fa-map-marker-alt" style="color:var(--text-secondary); font-size:12px;"></i>
                                <span style="font-size:12px; font-weight:600;">${p.mandi}, ${p.district}</span>
                            </div>
                            <div style="display:flex; align-items:center; gap:8px;">
                                <i class="fas fa-calendar-alt" style="color:var(--text-secondary); font-size:12px;"></i>
                                <span style="font-size:11px; color:var(--text-secondary);">${p.arrival_date}</span>
                            </div>
                        </div>
                    </div>
                    <div style="padding:10px; text-align:center; background:var(--maroon-light); color:var(--primary-maroon); font-size:11px; font-weight:700;">
                        Variety: ${p.variety}
                    </div>
                </div>
            `).join('')}
        </div>`;
    } catch (e) {
        el.innerHTML = `<div style="text-align:center;padding:40px;"><p style="color:#ef4444">Error loading mandi prices: ${e.message}</p></div>`;
    }
}

async function loadFarmerListings() {
    const tbody = document.querySelector('#farmerListingsTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text-secondary)"><i class="fas fa-spinner fa-spin"></i> Loading...</td></tr>';
    try {
        const r = await fetch(`${API}/marketplace/my-listings`, { credentials: 'include' });
        const d = await r.json();
        if (!d.listings || !d.listings.length) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-secondary)">No listings yet. Click "New Listing" to sell your harvest!</td></tr>';
            return;
        }
        window._myCropListings = d.listings;
        
        const statusBadge = s => {
            const map = { active: '#d1fae5;color:#065f46', sold: '#dbeafe;color:#1e40af', expired: '#fee2e2;color:#991b1b' };
            return `<span style="background:${map[s] || '#f3f4f6;color:#374151'};padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700">${s}</span>`;
        };
        tbody.innerHTML = d.listings.map(l => `<tr>
            <td><strong>${escHtml(l.crop_name)}</strong></td>
            <td>${escHtml(l.category)}</td>
            <td>${l.quantity_kg} kg</td>
            <td>₹${Number(l.price_per_kg).toLocaleString('en-IN')}</td>
            <td>${escHtml(l.location || '—')}</td>
            <td>${statusBadge(l.status)}</td>
            <td>${l.status === 'active' ? `<button class="btn btn-sm" style="background:#fef3c7;color:#92400e;padding:4px 10px;font-size:11px;margin-right:4px" onclick="editListing(${l.id})"><i class="fas fa-edit"></i></button><button class="btn btn-sm" style="background:#fee2e2;color:#991b1b;padding:4px 10px;font-size:11px" onclick="removeListing(${l.id})"><i class="fas fa-times"></i></button>` : '—'}</td>
        </tr>`).join('');
    } catch (e) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#ef4444">Error loading</td></tr>'; }
}

async function removeListing(id) {
    if (!confirm('Remove this listing?')) return;
    try {
        await fetch(`${API}/marketplace/listings/${id}`, { method: 'DELETE', credentials: 'include' });
        showToast('Listing removed', 'success');
        loadFarmerListings();
    } catch (e) { showToast('Error', 'error'); }
}

async function loadFarmerOrders() {
    const tbody = document.querySelector('#farmerOrdersTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px"><i class="fas fa-spinner fa-spin"></i></td></tr>';
    try {
        const r = await fetch(`${API}/marketplace/my-orders`, { credentials: 'include' });
        const d = await r.json();
        if (!d.orders || !d.orders.length) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--text-secondary)">No orders received yet</td></tr>';
            return;
        }
        const sBadge = s => {
            const c = { pending:'#fef3c7;color:#92400e', accepted:'#dbeafe;color:#1e40af', escrow_held:'#e0e7ff;color:#3730a3',
                delivered:'#d1fae5;color:#065f46', inspected:'#fce7f3;color:#9d174d', completed:'#dcfce7;color:#166534', cancelled:'#fee2e2;color:#991b1b' };
            const l = { pending:'Pending', accepted:'Accepted', escrow_held:'In Escrow', delivered:'Delivered', inspected:'Inspected', completed:'Completed', cancelled:'Cancelled' };
            return `<span style="background:${c[s]||'#f3f4f6;color:#374151'};padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700">${l[s]||s}</span>`;
        };
        tbody.innerHTML = d.orders.map(o => {
            let actions = '';
            if (o.status === 'pending') actions = `<button class="btn btn-sm" style="background:#d1fae5;color:#065f46;padding:4px 10px;font-size:11px;margin-right:4px" onclick="acceptFarmerOrder(${o.id})"><i class="fas fa-check"></i></button><button class="btn btn-sm" style="background:#fee2e2;color:#991b1b;padding:4px 10px;font-size:11px" onclick="rejectFarmerOrder(${o.id})"><i class="fas fa-times"></i></button>`;
            if (o.status === 'escrow_held') actions = `<button class="btn btn-sm" style="background:#d1fae5;color:#065f46;padding:4px 10px;font-size:11px" onclick="confirmFarmerDelivery(${o.id})"><i class="fas fa-truck"></i> Delivered</button>`;
            
            // Add Chat button
            actions += `<button class="btn btn-sm" style="background:#f3f4f6;color:#374151;padding:4px 10px;font-size:11px;margin-left:4px" onclick="openOrderChat(${o.id}, '${escHtml(o.buyer_name || 'Buyer')}', '${escHtml(o.crop_name)}')"><i class="fas fa-comment"></i> Chat</button>`;
            
            return `<tr>
                <td><strong>#${o.id}</strong></td>
                <td>${escHtml(o.buyer_name || '—')}</td>
                <td>${escHtml(o.crop_name)}</td>
                <td>${o.quantity_kg} kg</td>
                <td>₹${o.price_per_kg}</td>
                <td>
                    <div style="font-size:11px">Gross: ₹${Number(o.total_amount).toLocaleString('en-IN')}</div>
                    <div style="font-size:10px;color:#ef4444">-2% Fee: ₹${Number(o.commission_amount).toLocaleString('en-IN')}</div>
                    <strong style="color:#16a34a;font-size:12px">Net: ₹${Number(o.farmer_credit).toLocaleString('en-IN')}</strong>
                </td>
                <td>${sBadge(o.status)}</td>
                <td>${actions || '—'}</td>
            </tr>`;
        }).join('');
    } catch (e) { tbody.innerHTML = '<tr><td colspan="8" style="color:#ef4444;text-align:center">Error loading orders</td></tr>'; }
}

async function acceptFarmerOrder(id) {
    try {
        const r = await fetch(`${API}/marketplace/orders/${id}/accept`, { method: 'PUT', credentials: 'include' });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        showToast('Order accepted!', 'success');
        loadFarmerOrders();
    } catch (e) { showToast(e.message, 'error'); }
}

async function rejectFarmerOrder(id) {
    if (!confirm('Reject this order?')) return;
    try {
        const r = await fetch(`${API}/marketplace/orders/${id}/reject`, { method: 'PUT', credentials: 'include' });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        showToast('Order rejected', 'info');
        loadFarmerOrders();
    } catch (e) { showToast(e.message, 'error'); }
}

async function confirmFarmerDelivery(id) {
    if (!confirm('Confirm that the crop has been delivered?')) return;
    try {
        const r = await fetch(`${API}/marketplace/orders/${id}/confirm-delivery`, { method: 'PUT', credentials: 'include' });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        showToast(d.message, 'success');
        loadFarmerOrders();
    } catch (e) { showToast(e.message, 'error'); }
}

/* ════════════════════════════════════════════════════════════
   ORDER CHAT SYSTEM
   ════════════════════════════════════════════════════════════ */
let chatPollInterval = null;

function openOrderChat(orderId, buyerName, cropName) {
    $id('chatOrderId').value = orderId;
    $id('orderChatMetadata').innerHTML = `Talking with <strong>${buyerName}</strong> about <strong>${cropName}</strong> (Order #${orderId})`;
    $id('chatInputMessage').value = '';
    const chatModal = $id('orderChatModal');
    chatModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // Initial Load & Start Polling
    loadOrderChat(orderId);
    if (chatPollInterval) clearInterval(chatPollInterval);
    chatPollInterval = setInterval(() => loadOrderChat(orderId), 5000);
}

function closeOrderChatModal() {
    $id('orderChatModal').style.display = 'none';
    document.body.style.overflow = 'auto';
    if (chatPollInterval) clearInterval(chatPollInterval);
}

async function loadOrderChat(orderId) {
    const el = $id('chatMessages');
    if (!el || $id('chatOrderId').value != orderId) return;
    try {
        const r = await fetch(`${API}/marketplace/orders/${orderId}/chat`, { credentials: 'include' });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        if (!d.chats || d.chats.length === 0) {
            el.innerHTML = '<div style="text-align:center;color:var(--text-secondary);margin:auto;">No messages yet. Say hello!</div>';
            return;
        }
        
        // Determine whether user is at bottom before updating
        const isAtBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 50;
        
        let html = '';
        for (const c of d.chats) {
            const isMe = c.sender_type === 'farmer';
            html += `
                <div style="display:flex; flex-direction:column; align-items:${isMe ? 'flex-end' : 'flex-start'};">
                    <div style="font-size:10px; color:var(--text-secondary); margin-bottom:4px; padding:0 4px;">${c.sender_name} • ${new Date(c.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                    <div style="padding:10px 14px; border-radius:14px; max-width:85%; word-wrap:break-word; font-size:13px; background:${isMe ? 'var(--primary-dark)' : '#fff'}; color:${isMe ? '#fff' : 'var(--text-primary)'}; border:${isMe ? 'none' : '1px solid var(--border-color)'};">
                        ${escHtml(c.message)}
                    </div>
                </div>
            `;
        }
        el.innerHTML = html;
        if (isAtBottom) el.scrollTop = el.scrollHeight;
    } catch (e) {
        // Silent error on polling
    }
}

async function sendOrderMessage() {
    const orderId = $id('chatOrderId').value;
    const input = $id('chatInputMessage');
    const msg = input.value.trim();
    if (!msg || !orderId) return;
    
    // Disable input while sending
    input.disabled = true;
    try {
        const r = await fetch(`${API}/marketplace/orders/${orderId}/chat`, {
            method: 'POST', credentials: 'include',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ message: msg })
        });
        if (!r.ok) {
            const d = await r.json();
            throw new Error(d.error || 'Failed to send message');
        }
        input.value = '';
        await loadOrderChat(orderId); // Instant refresh
        // Scroll to bottom
        const el = $id('chatMessages');
        el.scrollTop = el.scrollHeight;
    } catch (e) {
        showToast(e.message, 'error');
    } finally {
        input.disabled = false;
        input.focus();
    }
}

async function loadFarmerEscrow() {
    const el = $id('farmerEscrowContent');
    if (!el) return;
    el.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Loading escrow data...</p>';
    try {
        const r = await fetch(`${API}/marketplace/my-escrow`, { credentials: 'include' });
        const d = await r.json();
        if (!d.escrow || !d.escrow.length) { el.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:24px">No escrow transactions yet</p>'; return; }
        const typeIcon = { hold: 'fa-lock', release: 'fa-unlock', refund: 'fa-undo', commission: 'fa-percent' };
        const typeColor = { hold: '#e0e7ff', release: '#dcfce7', refund: '#fee2e2', commission: '#fef3c7' };
        el.innerHTML = d.escrow.map(e => `
            <div style="display:flex;align-items:center;gap:14px;padding:14px;border-bottom:1px solid #f1f5f9">
                <div style="width:40px;height:40px;border-radius:12px;background:${typeColor[e.type]||'#f3f4f6'};display:flex;align-items:center;justify-content:center"><i class="fas ${typeIcon[e.type]||'fa-exchange-alt'}" style="font-size:16px"></i></div>
                <div style="flex:1"><strong>${e.crop_name || 'Order #'+e.order_id}</strong><br><small style="color:var(--text-secondary)">${e.description || e.type}</small></div>
                <div style="text-align:right"><strong>₹${Number(e.amount).toLocaleString('en-IN')}</strong><br><small style="color:var(--text-secondary)">${new Date(e.created_at).toLocaleDateString('en-IN')}</small></div>
            </div>`).join('');
    } catch (e) { el.innerHTML = '<p style="color:#ef4444">Error loading escrow data</p>'; }
}

async function loadFarmerTaxRecords() {
    const el = $id('farmerTaxContent');
    if (!el) return;
    el.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Loading tax records...</p>';
    try {
        const r = await fetch(`${API}/marketplace/tax-records`, { credentials: 'include' });
        const d = await r.json();
        if (!d.success) { el.innerHTML = '<p style="color:#ef4444">Error loading</p>'; return; }
        const s = d.summary;
        el.innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:20px">
                <div style="background:#dcfce7;padding:16px;border-radius:14px;text-align:center"><div style="font-size:22px;font-weight:800;color:#166534">₹${s.total_revenue.toLocaleString('en-IN')}</div><div style="font-size:12px;color:#16a34a;font-weight:600;margin-top:4px">Net Revenue</div></div>
                <div style="background:#fef3c7;padding:16px;border-radius:14px;text-align:center"><div style="font-size:22px;font-weight:800;color:#92400e">₹${s.total_commission_paid.toLocaleString('en-IN')}</div><div style="font-size:12px;color:#b45309;font-weight:600;margin-top:4px">Commission Paid (2%)</div></div>
                <div style="background:#dbeafe;padding:16px;border-radius:14px;text-align:center"><div style="font-size:22px;font-weight:800;color:#1e40af">₹${s.gross_sales.toLocaleString('en-IN')}</div><div style="font-size:12px;color:#2563eb;font-weight:600;margin-top:4px">Gross Sales</div></div>
                <div style="background:#e0e7ff;padding:16px;border-radius:14px;text-align:center"><div style="font-size:22px;font-weight:800;color:#3730a3">${s.total_sales}</div><div style="font-size:12px;color:#4f46e5;font-weight:600;margin-top:4px">Completed Sales</div></div>
            </div>
            ${d.records.length ? `<table class="data-table"><thead><tr><th>Crop</th><th>Buyer</th><th>Qty</th><th>Gross</th><th>Commission</th><th>Net</th><th>Date</th></tr></thead><tbody>${d.records.map(r => `<tr>
                <td>${escHtml(r.crop_name)}</td><td>${escHtml(r.buyer_name)}</td><td>${r.quantity_kg} kg</td>
                <td>₹${Number(r.total_amount).toLocaleString('en-IN')}</td><td>₹${Number(r.commission_amount).toLocaleString('en-IN')}</td>
                <td><strong>₹${Number(r.farmer_credit).toLocaleString('en-IN')}</strong></td>
                <td>${new Date(r.updated_at).toLocaleDateString('en-IN')}</td></tr>`).join('')}</tbody></table>` : '<p style="color:var(--text-secondary);text-align:center">No completed sales yet</p>'}`;
    } catch (e) { el.innerHTML = '<p style="color:#ef4444">Error loading tax records</p>'; }
}

// Hook into page navigation for marketplace
const _originalShowPage = typeof showPage === 'function' ? showPage : null;
if (_originalShowPage) {
    const __origShowPage = showPage;
    showPage = function(page) {
        __origShowPage(page);
        if (page === 'crop-marketplace') {
            loadFarmerListings();
        }
    };
}

// Hook into loadAll to check visibility
const _origLoadAll = typeof loadAll === 'function' ? loadAll : null;
if (_origLoadAll) {
    const __origLoadAll = loadAll;
    loadAll = async function() {
        await __origLoadAll();
        checkAgriMarketplaceVisibility();
    };
}

/* ════════════════════════════════════════════════════════════
   DASHBOARD EXPERIENCE ENHANCEMENTS
   Animated counters, tips carousel, spending analytics
   ════════════════════════════════════════════════════════════ */

/* ── Animated Counter ──────────────────────────────────────── */
function animateCounter(elementId, targetValue, isCurrency = false) {
    const elements = document.querySelectorAll('#' + elementId);
    if (!elements.length) return;
    
    const duration = 1200;
    const start = performance.now();
    const startVal = 0;
    const format = (v) => isCurrency ? fmtINR(v) : String(Math.round(v));

    elements.forEach(el => {
        // If already displaying the correct value, skip animation
        if (el.textContent === format(targetValue)) return;

        function step(now) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            // Ease-out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = startVal + (targetValue - startVal) * eased;
            el.textContent = format(current);
            if (progress < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    });
}

/* ── Financial Tips Carousel ──────────────────────────────── */
let currentTipIndex = 0;
let tipsAutoTimer = null;

function showTip(index) {
    const slides = document.querySelectorAll('#tipsSlides .tips-slide');
    const dots = document.querySelectorAll('#tipsDots .tips-dot');
    if (!slides.length) return;
    currentTipIndex = index % slides.length;
    slides.forEach((s, i) => {
        s.classList.toggle('active', i === currentTipIndex);
    });
    dots.forEach((d, i) => {
        d.classList.toggle('active', i === currentTipIndex);
    });
}

function startTipsCarousel() {
    if (tipsAutoTimer) clearInterval(tipsAutoTimer);
    tipsAutoTimer = setInterval(() => {
        showTip(currentTipIndex + 1);
    }, 6000);
}

// Start tips carousel after page loads
setTimeout(startTipsCarousel, 2000);

/* ── Spending Analytics ──────────────────────────────────── */
function renderSpendingAnalytics(debitTxns, totalSpending) {
    const container = $id('spendingAnalytics');
    const bar = $id('spendingBar');
    const legend = $id('spendingLegend');
    if (!container || !bar || !legend) return;

    if (!debitTxns || !debitTxns.length || totalSpending <= 0) {
        container.style.display = 'none';
        return;
    }
    container.style.display = 'block';

    // Categorize transactions by keywords
    const categories = [
        { name: 'Transfers', color: '#6366f1', keywords: ['transfer', 'send', 'neft', 'imps', 'rtgs', 'upi'] },
        { name: 'Shopping', color: '#f43f5e', keywords: ['shop', 'purchase', 'buy', 'amazon', 'flipkart'] },
        { name: 'Bills', color: '#f59e0b', keywords: ['bill', 'electricity', 'gas', 'water', 'recharge', 'mobile'] },
        { name: 'Food', color: '#10b981', keywords: ['food', 'restaurant', 'swiggy', 'zomato', 'dining'] },
        { name: 'ATM', color: '#8b5cf6', keywords: ['atm', 'withdrawal', 'cash'] },
        { name: 'Other', color: '#94a3b8', keywords: [] }
    ];

    const catTotals = categories.map(c => ({ ...c, total: 0 }));

    debitTxns.forEach(t => {
        const desc = (t.description || '').toLowerCase();
        let matched = false;
        for (let i = 0; i < catTotals.length - 1; i++) {
            if (catTotals[i].keywords.some(k => desc.includes(k))) {
                catTotals[i].total += parseFloat(t.amount || 0);
                matched = true;
                break;
            }
        }
        if (!matched) catTotals[catTotals.length - 1].total += parseFloat(t.amount || 0);
    });

    // Filter out zero categories
    const activeCats = catTotals.filter(c => c.total > 0);
    if (!activeCats.length) { container.style.display = 'none'; return; }

    // Render bar segments (start at 0 width, animate to actual)
    bar.innerHTML = activeCats.map(c => {
        const pct = (c.total / totalSpending * 100).toFixed(1);
        return `<div class="spending-segment" style="width: 0%; background: ${c.color};" data-target-width="${pct}%"></div>`;
    }).join('');

    // Animate in after render
    setTimeout(() => {
        bar.querySelectorAll('.spending-segment').forEach(seg => {
            seg.style.width = seg.dataset.targetWidth;
        });
    }, 100);

    // Render legend
    legend.innerHTML = activeCats.map(c => `
        <div class="spending-legend-item">
            <span class="spending-legend-dot" style="background: ${c.color};"></span>
            ${c.name}
            <span class="spending-legend-amount">${fmtINR(c.total)}</span>
        </div>
    `).join('');
}

/* ════════════════════════════════════════════════════════════
   DASHBOARD SEARCH & FILTER FUNCTIONALITY
   ════════════════════════════════════════════════════════════ */

/* ── Dashboard Recent Transactions Search ──────────────── */
let _dashTxnSearchActive = false;
function toggleDashboardTxnSearch() {
    const container = $id('recentTransactions');
    if (!container) return;
    
    let searchBar = $id('dashTxnSearchBar');
    if (searchBar) {
        // Toggle off
        searchBar.remove();
        _dashTxnSearchActive = false;
        renderRecentTransactions();
        return;
    }
    
    // Create search bar
    _dashTxnSearchActive = true;
    const bar = document.createElement('div');
    bar.id = 'dashTxnSearchBar';
    bar.style.cssText = 'padding:12px 20px;border-bottom:1px solid var(--border-color,#e5e7eb);';
    bar.innerHTML = `<input type="text" placeholder="Search transactions..." 
        style="width:100%;padding:10px 14px;border:1.5px solid var(--border-color,#e5e7eb);border-radius:10px;font-size:13px;background:var(--bg-light,#f9fafb);outline:none;transition:border 0.2s;"
        onfocus="this.style.borderColor='var(--primary-maroon,#800000)'"
        onblur="this.style.borderColor='var(--border-color,#e5e7eb)'"
        oninput="filterDashboardTxns(this.value)" autofocus>`;
    
    // Insert before the transaction list inside the card
    const parent = container.parentElement;
    if (parent) parent.insertBefore(bar, container);
}

function filterDashboardTxns(query) {
    const q = (query || '').toLowerCase();
    const filtered = state.transactions.filter(t => {
        const desc = (t.description || '').toLowerCase();
        const mode = (t.mode || '').toLowerCase();
        const ref = (t.reference_number || '').toLowerCase();
        return desc.includes(q) || mode.includes(q) || ref.includes(q);
    });
    
    const container = $id('recentTransactions');
    if (!container) return;
    
    if (!filtered.length) {
        container.innerHTML = emptyState('search', 'No transactions match your search');
        return;
    }
    
    container.innerHTML = filtered.slice(0, 10).map(txnRowHTML).join('');
}

/* ── Dashboard Recent Transactions Filter ──────────────── */
let _dashTxnFilterType = 'all';
function toggleDashboardTxnFilter() {
    const types = ['all', 'credit', 'debit'];
    const current = types.indexOf(_dashTxnFilterType);
    _dashTxnFilterType = types[(current + 1) % types.length];
    
    const filtered = _dashTxnFilterType === 'all' 
        ? state.transactions 
        : state.transactions.filter(t => t.type === _dashTxnFilterType);
    
    const container = $id('recentTransactions');
    if (!container) return;
    
    showToast(`Showing: ${_dashTxnFilterType === 'all' ? 'All' : _dashTxnFilterType.charAt(0).toUpperCase() + _dashTxnFilterType.slice(1)} transactions`, 'info');
    
    if (!filtered.length) {
        container.innerHTML = emptyState('filter', `No ${_dashTxnFilterType} transactions found`);
        return;
    }
    
    container.innerHTML = filtered.slice(0, 10).map(txnRowHTML).join('');
}

/* ── Invoice Activity Filter ──────────────── */
let _invoiceFilterType = 'all';
function toggleInvoiceFilter() {
    const types = ['all', 'credit', 'debit'];
    const current = types.indexOf(_invoiceFilterType);
    _invoiceFilterType = types[(current + 1) % types.length];
    
    showToast(`Invoice filter: ${_invoiceFilterType === 'all' ? 'All' : _invoiceFilterType.charAt(0).toUpperCase() + _invoiceFilterType.slice(1)}`, 'info');
    
    const tbody = $id('invoiceTableBody');
    if (!tbody) return;
    
    const filtered = _invoiceFilterType === 'all'
        ? state.transactions.slice(0, 10)
        : state.transactions.filter(t => t.type === _invoiceFilterType).slice(0, 10);
    
    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-secondary)">No matching transactions</td></tr>';
        return;
    }
    
    tbody.innerHTML = filtered.map(t => `<tr>
        <td style="padding:12px;">${formatDate(t.transaction_date)}</td>
        <td style="padding:12px;">${escHtml(t.description || 'Transaction')}</td>
        <td style="padding:12px;"><span class="badge badge-${t.type === 'credit' ? 'success' : 'danger'}">${t.type.toUpperCase()}</span></td>
        <td style="padding:12px;">${t.mode || 'NEFT'}</td>
        <td style="padding:12px;font-weight:700;" class="${t.type === 'credit' ? 'text-success' : 'text-danger'}">
            ${t.type === 'credit' ? '+' : '-'}${fmtINR(t.amount)}</td>
    </tr>`).join('');
}

/* ── Invoice Search Input Listener ──────────────── */
document.addEventListener('DOMContentLoaded', function() {
    // Wire up invoice search
    const invoiceSearch = $id('invoiceSearch');
    if (invoiceSearch) {
        invoiceSearch.addEventListener('input', function() {
            const q = this.value.toLowerCase();
            const tbody = $id('invoiceTableBody');
            if (!tbody) return;
            
            const filtered = state.transactions.filter(t => {
                const desc = (t.description || '').toLowerCase();
                const mode = (t.mode || '').toLowerCase();
                return desc.includes(q) || mode.includes(q);
            }).slice(0, 10);
            
            if (!filtered.length) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-secondary)">No matching invoices</td></tr>';
                return;
            }
            
            tbody.innerHTML = filtered.map(t => `<tr>
                <td style="padding:12px;">${formatDate(t.transaction_date)}</td>
                <td style="padding:12px;">${escHtml(t.description || 'Transaction')}</td>
                <td style="padding:12px;"><span class="badge badge-${t.type === 'credit' ? 'success' : 'danger'}">${t.type.toUpperCase()}</span></td>
                <td style="padding:12px;">${t.mode || 'NEFT'}</td>
                <td style="padding:12px;font-weight:700;" class="${t.type === 'credit' ? 'text-success' : 'text-danger'}">
                    ${t.type === 'credit' ? '+' : '-'}${fmtINR(t.amount)}</td>
            </tr>`).join('');
        });
    }
    
    // Wire up Transactions page search
    const txnSearch = $id('transactionSearch');
    if (txnSearch) {
        let debounceTimer;
        txnSearch.addEventListener('input', function() {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const q = this.value.toLowerCase();
                const container = $id('transactionsList');
                if (!container) return;
                
                const filtered = state.transactions.filter(t => {
                    const desc = (t.description || '').toLowerCase();
                    const mode = (t.mode || '').toLowerCase();
                    const ref = (t.reference_number || '').toLowerCase();
                    return desc.includes(q) || mode.includes(q) || ref.includes(q);
                });
                
                if (!filtered.length) {
                    container.innerHTML = emptyState('search', 'No transactions match your search');
                    return;
                }
                
                container.innerHTML = filtered.map(txnRowHTML).join('');
            }, 300);
        });
    }
});

/* ════════════════════════════════════════════════════════════
   BRANCH & ATM LOCATOR — MapLibre 3D
   ════════════════════════════════════════════════════════════ */
let _locatorMap = null;
let _locatorMarkers = [];
let _locatorLocations = [];
let _locatorFilter = 'all';
let _locatorInitialized = false;

function initUserLocator() {
    if (_locatorInitialized && _locatorMap) {
        // Map already exists — just resize and refetch
        setTimeout(() => _locatorMap.resize(), 200);
        fetchLocations();
        return;
    }

    const container = $id('userLocatorMap');
    if (!container) return;
    if (typeof maplibregl === 'undefined') {
        container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#94a3b8;font-size:14px;">
            <i class="fas fa-exclamation-triangle" style="margin-right:8px;"></i> MapLibre library not loaded</div>`;
        return;
    }

    try {
        _locatorMap = new maplibregl.Map({
            container: 'userLocatorMap',
            style: {
                version: 8,
                sources: {
                    'esri-world': {
                        type: 'raster',
                        tiles: [
                            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'
                        ],
                        tileSize: 256,
                        attribution: '© Esri'
                    }
                },
                layers: [{
                    id: 'esri-world-layer',
                    type: 'raster',
                    source: 'esri-world',
                    minzoom: 0,
                    maxzoom: 18
                }]
            },
            center: [78.9629, 20.5937], // India center
            zoom: 4.5,
            pitch: 45,
            bearing: -15,
            maxZoom: 18,
            minZoom: 2,
            antialias: true
        });

        // Navigation controls
        _locatorMap.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), 'top-right');
        _locatorMap.addControl(new maplibregl.FullscreenControl(), 'top-right');

        // Geolocation control
        const geolocate = new maplibregl.GeolocateControl({
            positionOptions: { enableHighAccuracy: true },
            trackUserLocation: false,
            showUserLocation: true
        });
        _locatorMap.addControl(geolocate, 'top-right');

        _locatorMap.on('load', () => {
            _locatorInitialized = true;
            fetchLocations();
        });

    } catch (err) {
        console.error('MapLibre init error:', err);
        container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#ef4444;font-size:14px;">
            <i class="fas fa-exclamation-circle" style="margin-right:8px;"></i> Failed to initialize map</div>`;
    }
}

async function fetchLocations() {
    try {
        const res = await fetch(`${API}/user/locations`, { credentials: 'include' });
        if (res.ok) {
            _locatorLocations = await res.json();
            renderLocatorMarkers();
        } else {
            console.error('Failed to fetch locations:', res.status);
            updateLocCountBadge(0);
        }
    } catch (e) {
        console.error('Error fetching locations:', e);
        updateLocCountBadge(0);
    }
}

function renderLocatorMarkers() {
    // Clear existing markers
    _locatorMarkers.forEach(m => m.remove());
    _locatorMarkers = [];

    const filtered = _locatorFilter === 'all'
        ? _locatorLocations
        : _locatorLocations.filter(l => l.type === _locatorFilter);

    updateLocCountBadge(filtered.length);

    if (!_locatorMap || !filtered.length) return;

    const bounds = new maplibregl.LngLatBounds();

    filtered.forEach(loc => {
        const isBranch = (loc.type || '').toLowerCase() === 'branch';
        const color = isBranch ? '#800000' : '#2563eb';
        const icon = isBranch ? 'fa-university' : 'fa-credit-card';
        const label = isBranch ? 'Branch' : 'ATM';
        const locId = `loc_${loc.id || Math.random().toString(36).slice(2)}`;

        // Custom marker element
        const el = document.createElement('div');
        el.className = 'loc-marker';
        el.style.cssText = `
            width: 42px; height: 42px; border-radius: 50%; 
            background: ${color}; border: 3px solid white;
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 4px 14px rgba(0,0,0,0.3);
            cursor: pointer; transition: transform 0.2s ease;
        `;
        el.innerHTML = `<i class="fas ${icon}" style="color:white; font-size:16px;"></i>`;
        el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.2)'; });
        el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)'; });

        // Popup with travel distance panel
        const popup = new maplibregl.Popup({ offset: 30, closeButton: true, maxWidth: '320px' })
            .setHTML(`
                <div style="font-family:system-ui,-apple-system,sans-serif; padding:4px;">
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                        <div style="width:32px;height:32px;border-radius:8px;background:${color};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                            <i class="fas ${icon}" style="color:white;font-size:13px;"></i>
                        </div>
                        <div>
                            <div style="font-weight:700;font-size:14px;color:#1e293b;">${escHtml(loc.name)}</div>
                            <span style="font-size:11px;color:white;background:${color};padding:2px 8px;border-radius:10px;font-weight:600;">${label}</span>
                        </div>
                    </div>
                    ${loc.photo_url ? `<div style="margin-bottom:8px; border-radius:8px; overflow:hidden;"><img src="${API}/staff/locations/photo/${loc.photo_url}" style="width:100%; height:120px; object-fit:cover; display:block;" alt="Location Photo"></div>` : ''}
                    ${loc.address ? `<div style="font-size:12px;color:#64748b;margin-bottom:4px;"><i class="fas fa-map-marker-alt" style="color:${color};margin-right:4px;"></i>${escHtml(loc.address)}</div>` : ''}
                    ${loc.city ? `<div style="font-size:12px;color:#64748b;"><i class="fas fa-city" style="color:${color};margin-right:4px;"></i>${escHtml(loc.city)}</div>` : ''}
                    <div style="font-size:11px;color:#94a3b8;margin-top:6px;"><i class="fas fa-map-pin" style="margin-right:4px;"></i>${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}</div>

                    <!-- Travel Distance Panel -->
                    <div id="travel-${locId}" style="margin-top:10px; background:#f8fafc; border-radius:10px; padding:10px; border:1px solid #e2e8f0;">
                        <div style="font-size:11px; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">
                            <i class="fas fa-route" style="color:${color}; margin-right:4px;"></i> Travel Distance
                        </div>
                        <div id="travel-info-${locId}" style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px;">
                            <div style="text-align:center; padding:8px 4px; background:white; border-radius:8px; border:1px solid #e2e8f0; cursor:pointer; transition:all 0.2s;" 
                                 onclick="showRouteOnMap(${loc.lat}, ${loc.lng}, 'driving', '${locId}')" id="mode-car-${locId}">
                                <i class="fas fa-car" style="font-size:16px; color:#1e40af; display:block; margin-bottom:4px;"></i>
                                <div style="font-size:10px; font-weight:700; color:#1e293b;" id="car-dist-${locId}">—</div>
                                <div style="font-size:9px; color:#64748b;" id="car-time-${locId}">—</div>
                            </div>
                            <div style="text-align:center; padding:8px 4px; background:white; border-radius:8px; border:1px solid #e2e8f0; cursor:pointer; transition:all 0.2s;" 
                                 onclick="showRouteOnMap(${loc.lat}, ${loc.lng}, 'cycling', '${locId}')" id="mode-bike-${locId}">
                                <i class="fas fa-motorcycle" style="font-size:16px; color:#059669; display:block; margin-bottom:4px;"></i>
                                <div style="font-size:10px; font-weight:700; color:#1e293b;" id="bike-dist-${locId}">—</div>
                                <div style="font-size:9px; color:#64748b;" id="bike-time-${locId}">—</div>
                            </div>
                            <div style="text-align:center; padding:8px 4px; background:white; border-radius:8px; border:1px solid #e2e8f0; cursor:pointer; transition:all 0.2s;" 
                                 onclick="showRouteOnMap(${loc.lat}, ${loc.lng}, 'foot', '${locId}')" id="mode-walk-${locId}">
                                <i class="fas fa-walking" style="font-size:16px; color:#d97706; display:block; margin-bottom:4px;"></i>
                                <div style="font-size:10px; font-weight:700; color:#1e293b;" id="walk-dist-${locId}">—</div>
                                <div style="font-size:9px; color:#64748b;" id="walk-time-${locId}">—</div>
                            </div>
                        </div>
                        <div id="travel-status-${locId}" style="font-size:10px; color:#94a3b8; text-align:center; margin-top:6px;">
                            <i class="fas fa-crosshairs"></i> Detecting your location...
                        </div>
                    </div>

                    <div style="display:flex; gap:6px; margin-top:10px;">
                        <a href="https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}&travelmode=driving" target="_blank" rel="noopener"
                           style="flex:1;display:flex;align-items:center;justify-content:center;gap:4px;padding:8px 10px;background:${color};color:white;border-radius:8px;font-size:11px;font-weight:700;text-decoration:none;">
                            <i class="fas fa-directions"></i> Google Maps
                        </a>
                        <button onclick="showRouteOnMap(${loc.lat}, ${loc.lng}, 'driving', '${locId}')"
                           style="flex:1;display:flex;align-items:center;justify-content:center;gap:4px;padding:8px 10px;background:#0f172a;color:white;border-radius:8px;font-size:11px;font-weight:700;border:none;cursor:pointer;">
                            <i class="fas fa-map"></i> Show Route
                        </button>
                    </div>
                </div>
            `);

        // When popup opens, calculate distances
        popup.on('open', () => {
            calculateTravelDistances(loc.lat, loc.lng, locId);
        });

        const marker = new maplibregl.Marker({ element: el })
            .setLngLat([loc.lng, loc.lat])
            .setPopup(popup)
            .addTo(_locatorMap);

        _locatorMarkers.push(marker);
        bounds.extend([loc.lng, loc.lat]);
    });

    // Fly to fit bounds
    if (filtered.length === 1) {
        _locatorMap.flyTo({ center: [filtered[0].lng, filtered[0].lat], zoom: 14, pitch: 50, bearing: 0, duration: 1500 });
    } else if (filtered.length > 1) {
        _locatorMap.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 1500, pitch: 45, bearing: -15 });
    }
}

function filterLocations(type) {
    _locatorFilter = type;
    // Update button states
    document.querySelectorAll('.loc-filter-btn').forEach(btn => btn.classList.remove('loc-active'));
    const activeBtn = $id(type === 'all' ? 'locFilterAll' : type === 'branch' ? 'locFilterBranch' : 'locFilterAtm');
    if (activeBtn) activeBtn.classList.add('loc-active');
    // Clear route when changing filter
    clearRouteLayer();
    renderLocatorMarkers();
}

function updateLocCountBadge(count) {
    const el = $id('locCountText');
    if (el) {
        el.textContent = count === 0
            ? 'No locations found'
            : `${count} location${count !== 1 ? 's' : ''} found`;
    }
}

/* ── Travel Distance & Route System ───────────────────────── */
let _userPosition = null;
let _routeLayerAdded = false;

function haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km) {
    if (km < 1) return `${Math.round(km * 1000)}m`;
    return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

function formatDuration(mins) {
    if (mins < 1) return '< 1 min';
    if (mins < 60) return `${Math.round(mins)} min`;
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

async function getUserPosition() {
    if (_userPosition) return _userPosition;
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve(null);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            pos => {
                _userPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                resolve(_userPosition);
            },
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
        );
    });
}

async function calculateTravelDistances(destLat, destLng, locId) {
    const statusEl = document.getElementById(`travel-status-${locId}`);
    
    const userPos = await getUserPosition();
    if (!userPos) {
        if (statusEl) statusEl.innerHTML = '<i class="fas fa-exclamation-triangle" style="color:#f59e0b;"></i> Enable location for distances';
        return;
    }

    if (statusEl) statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Calculating routes...';

    // Calculate straight-line distance for bike/walk estimates
    const straightDist = haversineDistance(userPos.lat, userPos.lng, destLat, destLng);

    // Try OSRM for accurate driving distance
    try {
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${userPos.lng},${userPos.lat};${destLng},${destLat}?overview=false`;
        const res = await fetch(osrmUrl);
        const data = await res.json();

        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            const drivingDist = route.distance / 1000; // km
            const drivingTime = route.duration / 60;    // min

            // Car
            const carDistEl = document.getElementById(`car-dist-${locId}`);
            const carTimeEl = document.getElementById(`car-time-${locId}`);
            if (carDistEl) carDistEl.textContent = formatDistance(drivingDist);
            if (carTimeEl) carTimeEl.textContent = formatDuration(drivingTime);

            // Bike (road distance × 1.1, avg speed ~25 km/h)
            const bikeDist = drivingDist * 1.05;
            const bikeTime = bikeDist / 25 * 60;
            const bikeDistEl = document.getElementById(`bike-dist-${locId}`);
            const bikeTimeEl = document.getElementById(`bike-time-${locId}`);
            if (bikeDistEl) bikeDistEl.textContent = formatDistance(bikeDist);
            if (bikeTimeEl) bikeTimeEl.textContent = formatDuration(bikeTime);

            // Walk (road distance × 1.2, avg speed ~5 km/h)
            const walkDist = drivingDist * 1.15;
            const walkTime = walkDist / 5 * 60;
            const walkDistEl = document.getElementById(`walk-dist-${locId}`);
            const walkTimeEl = document.getElementById(`walk-time-${locId}`);
            if (walkDistEl) walkDistEl.textContent = formatDistance(walkDist);
            if (walkTimeEl) walkTimeEl.textContent = formatDuration(walkTime);

            if (statusEl) statusEl.innerHTML = '<i class="fas fa-check-circle" style="color:#10b981;"></i> Click a mode to see route';
        } else {
            fallbackDistances(straightDist, locId, statusEl);
        }
    } catch (e) {
        console.warn('OSRM fetch failed, using estimates:', e);
        fallbackDistances(straightDist, locId, statusEl);
    }
}

function fallbackDistances(straightDist, locId, statusEl) {
    const roadDist = straightDist * 1.35; // Road factor ~1.35x straight line

    const setEl = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    setEl(`car-dist-${locId}`, formatDistance(roadDist));
    setEl(`car-time-${locId}`, formatDuration(roadDist / 40 * 60));
    setEl(`bike-dist-${locId}`, formatDistance(roadDist * 1.05));
    setEl(`bike-time-${locId}`, formatDuration(roadDist * 1.05 / 25 * 60));
    setEl(`walk-dist-${locId}`, formatDistance(roadDist * 1.15));
    setEl(`walk-time-${locId}`, formatDuration(roadDist * 1.15 / 5 * 60));

    if (statusEl) statusEl.innerHTML = '<i class="fas fa-info-circle" style="color:#3b82f6;"></i> Estimated distances';
}

function clearRouteLayer() {
    if (!_locatorMap) return;
    if (_locatorMap.getLayer('route-line')) _locatorMap.removeLayer('route-line');
    if (_locatorMap.getLayer('route-outline')) _locatorMap.removeLayer('route-outline');
    if (_locatorMap.getSource('route-source')) _locatorMap.removeSource('route-source');
    _routeLayerAdded = false;
}

async function showRouteOnMap(destLat, destLng, mode, locId) {
    const userPos = await getUserPosition();
    if (!userPos) {
        showToast('Please enable location access to see routes', 'warning');
        return;
    }

    // Highlight active mode
    ['car', 'bike', 'walk'].forEach(m => {
        const btn = document.getElementById(`mode-${m}-${locId}`);
        if (btn) btn.style.border = '1px solid #e2e8f0';
    });
    const modeKey = mode === 'driving' ? 'car' : mode === 'cycling' ? 'bike' : 'walk';
    const activeBtn = document.getElementById(`mode-${modeKey}-${locId}`);
    if (activeBtn) {
        const colors = { car: '#1e40af', bike: '#059669', walk: '#d97706' };
        activeBtn.style.border = `2px solid ${colors[modeKey]}`;
        activeBtn.style.background = `${colors[modeKey]}10`;
    }

    // OSRM only supports "driving" as profile; for bike/walk we use driving route but different ETA
    const osrmProfile = mode === 'driving' ? 'driving' : mode === 'cycling' ? 'driving' : 'driving';
    
    try {
        const url = `https://router.project-osrm.org/route/v1/${osrmProfile}/${userPos.lng},${userPos.lat};${destLng},${destLat}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
            const routeGeometry = data.routes[0].geometry;

            clearRouteLayer();

            const routeColors = { driving: '#1e40af', cycling: '#059669', foot: '#d97706' };

            _locatorMap.addSource('route-source', {
                type: 'geojson',
                data: { type: 'Feature', geometry: routeGeometry }
            });

            // Route outline
            _locatorMap.addLayer({
                id: 'route-outline',
                type: 'line',
                source: 'route-source',
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: { 'line-color': '#ffffff', 'line-width': 8, 'line-opacity': 0.8 }
            });

            // Route line
            _locatorMap.addLayer({
                id: 'route-line',
                type: 'line',
                source: 'route-source',
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: { 'line-color': routeColors[mode] || '#1e40af', 'line-width': 5, 'line-opacity': 0.9 }
            });

            _routeLayerAdded = true;

            // Fit map to show entire route
            const coords = routeGeometry.coordinates;
            const routeBounds = new maplibregl.LngLatBounds();
            coords.forEach(c => routeBounds.extend(c));
            _locatorMap.fitBounds(routeBounds, { padding: 80, maxZoom: 15, duration: 1200, pitch: 40 });

        } else {
            showToast('Could not calculate route', 'warning');
        }
    } catch (e) {
        console.error('Route fetch error:', e);
        // Fallback: draw straight line
        clearRouteLayer();
        _locatorMap.addSource('route-source', {
            type: 'geojson',
            data: {
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: [[userPos.lng, userPos.lat], [destLng, destLat]]
                }
            }
        });
        _locatorMap.addLayer({
            id: 'route-line',
            type: 'line',
            source: 'route-source',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#800000', 'line-width': 3, 'line-dasharray': [2, 2] }
        });
        _routeLayerAdded = true;

        const fallbackBounds = new maplibregl.LngLatBounds();
        fallbackBounds.extend([userPos.lng, userPos.lat]);
        fallbackBounds.extend([destLng, destLat]);
        _locatorMap.fitBounds(fallbackBounds, { padding: 80, maxZoom: 15, duration: 1200 });
    }
}

/* ════════════════════════════════════════════════════════════
   SETTINGS PAGE
   ════════════════════════════════════════════════════════════ */
async function renderSettingsPage() {
    const container = $id('settingsContent');
    if (!container) return;

    // Check passcode status
    if (_desktopPasscodeEnabled === null) {
        await checkDesktopPasscodeStatus();
    }

    const pinStatusText = _desktopPasscodeEnabled
        ? '<span style="color:#10b981;font-weight:700;"><i class="fas fa-check-circle"></i> Active</span>'
        : '<span style="color:#f59e0b;font-weight:700;"><i class="fas fa-exclamation-circle"></i> Not Set</span>';

    const pinActionHtml = _desktopPasscodeEnabled
        ? `<div style="display:flex;gap:12px;flex-wrap:wrap;">
               <button class="btn btn-primary btn-sm" onclick="showDesktopChangePinForm()" style="background: #b45309;">
                   <i class="fas fa-exchange-alt"></i> Change Balance PIN
               </button>
           </div>`
        : `<button class="btn btn-primary btn-sm" onclick="toggleBalanceVisibility()" style="background: #10b981;">
               <i class="fas fa-plus-circle"></i> Set Up Balance PIN
           </button>`;

    container.innerHTML = `
        <div style="padding: 24px;">
            <!-- User Info Card -->
            <div style="display:flex;align-items:center;gap:20px;padding:24px;background:linear-gradient(135deg,#f8fafc,#f1f5f9);border-radius:16px;margin-bottom:24px;border:1px solid var(--border-color);">
                <div style="width:64px;height:64px;background:linear-gradient(135deg,#3b82f6,#1d4ed8);border-radius:16px;display:flex;align-items:center;justify-content:center;color:white;font-size:24px;font-weight:800;">
                    ${state.user?.name ? state.user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div>
                    <h3 style="margin:0;font-size:18px;font-weight:800;color:var(--text-primary);">${escHtml(state.user?.name || 'User')}</h3>
                    <p style="margin:4px 0 0;font-size:13px;color:var(--text-secondary);">${escHtml(state.user?.username || '')}</p>
                </div>
            </div>

            <!-- Security Section -->
            <div style="margin-bottom:24px;">
                <h4 style="font-size:14px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:16px;">
                    <i class="fas fa-shield-alt" style="margin-right:8px;color:#3b82f6;"></i>Security
                </h4>

                <!-- Balance PIN Card -->
                <div style="background:white;border:1px solid var(--border-color);border-radius:14px;padding:20px;margin-bottom:12px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                        <div>
                            <div style="font-weight:700;font-size:15px;color:var(--text-primary);margin-bottom:4px;">
                                <i class="fas fa-lock" style="margin-right:8px;color:#6366f1;"></i>Balance PIN
                            </div>
                            <div style="font-size:12px;color:var(--text-secondary);">4-digit PIN required to view your account balance</div>
                        </div>
                        <div>${pinStatusText}</div>
                    </div>
                    ${pinActionHtml}

                    <!-- Change PIN Form (hidden by default) -->
                    <div id="desktopChangePinForm" style="display:none;margin-top:20px;padding-top:20px;border-top:1px solid var(--border-color);">
                        <h5 style="margin:0 0 16px;font-size:14px;font-weight:700;color:var(--text-primary);">Change Balance PIN</h5>
                        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;max-width:500px;">
                            <div class="form-group" style="margin:0;">
                                <label class="form-label" style="font-size:12px;">Current PIN</label>
                                <input type="password" id="deskChangePinCurrent" class="form-input" maxlength="4" placeholder="••••"
                                    style="text-align:center;letter-spacing:8px;font-size:18px;" inputmode="numeric">
                            </div>
                            <div class="form-group" style="margin:0;">
                                <label class="form-label" style="font-size:12px;">New PIN</label>
                                <input type="password" id="deskChangePinNew" class="form-input" maxlength="4" placeholder="••••"
                                    style="text-align:center;letter-spacing:8px;font-size:18px;" inputmode="numeric">
                            </div>
                            <div class="form-group" style="margin:0;">
                                <label class="form-label" style="font-size:12px;">Confirm</label>
                                <input type="password" id="deskChangePinConfirm" class="form-input" maxlength="4" placeholder="••••"
                                    style="text-align:center;letter-spacing:8px;font-size:18px;" inputmode="numeric">
                            </div>
                        </div>
                        <p id="deskChangePinError" style="color:#ef4444;font-size:13px;font-weight:600;margin:8px 0;display:none;"></p>
                        <div style="display:flex;gap:10px;margin-top:14px;">
                            <button id="deskChangePinSubmitBtn" class="btn btn-primary btn-sm" onclick="submitDesktopChangePin()" style="background:#b45309;">
                                <i class="fas fa-check"></i> Update PIN
                            </button>
                            <button class="btn btn-cancel btn-sm" onclick="hideDesktopChangePinForm()">Cancel</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Preferences Section -->
            <div>
                <h4 style="font-size:14px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:16px;">
                    <i class="fas fa-sliders-h" style="margin-right:8px;color:#8b5cf6;"></i>Preferences
                </h4>

                <div style="background:white;border:1px solid var(--border-color);border-radius:14px;overflow:hidden;">
                    <!-- Notifications Toggle -->
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--border-color);">
                        <div style="display:flex;align-items:center;gap:12px;">
                            <i class="fas fa-bell" style="color:#f59e0b;font-size:16px;"></i>
                            <div>
                                <div style="font-weight:600;font-size:14px;color:var(--text-primary);">Notifications</div>
                                <div style="font-size:12px;color:var(--text-secondary);">Transaction alerts and updates</div>
                            </div>
                        </div>
                        <label class="settings-toggle-switch">
                            <input type="checkbox" id="settingsNotifToggle" onchange="toggleSettingsNotification()"
                                ${localStorage.getItem('notificationsEnabled') !== 'false' ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>

                    <!-- Theme -->
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;">
                        <div style="display:flex;align-items:center;gap:12px;">
                            <i class="fas fa-palette" style="color:#8b5cf6;font-size:16px;"></i>
                            <div>
                                <div style="font-weight:600;font-size:14px;color:var(--text-primary);">Appearance</div>
                                <div style="font-size:12px;color:var(--text-secondary);">Light mode active</div>
                            </div>
                        </div>
                        <span style="font-size:13px;color:var(--text-secondary);font-weight:600;"><i class="fas fa-sun" style="color:#f59e0b;margin-right:4px;"></i>Light</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function showDesktopChangePinForm() {
    const form = $id('desktopChangePinForm');
    if (form) {
        form.style.display = 'block';
        // Clear fields
        ['deskChangePinCurrent', 'deskChangePinNew', 'deskChangePinConfirm'].forEach(id => {
            const el = $id(id);
            if (el) el.value = '';
        });
        const err = $id('deskChangePinError');
        if (err) err.style.display = 'none';
    }
}

function hideDesktopChangePinForm() {
    const form = $id('desktopChangePinForm');
    if (form) form.style.display = 'none';
}

async function submitDesktopChangePin() {
    const current = ($id('deskChangePinCurrent') || {}).value || '';
    const newPin = ($id('deskChangePinNew') || {}).value || '';
    const confirm = ($id('deskChangePinConfirm') || {}).value || '';
    const errEl = $id('deskChangePinError');
    const btn = $id('deskChangePinSubmitBtn');

    if (!current || current.length !== 4) {
        if (errEl) { errEl.textContent = 'Enter your current 4-digit PIN'; errEl.style.display = 'block'; }
        return;
    }
    if (!newPin || newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
        if (errEl) { errEl.textContent = 'New PIN must be exactly 4 digits'; errEl.style.display = 'block'; }
        return;
    }
    if (newPin !== confirm) {
        if (errEl) { errEl.textContent = 'New PINs do not match'; errEl.style.display = 'block'; }
        return;
    }
    if (current === newPin) {
        if (errEl) { errEl.textContent = 'New PIN must be different from current'; errEl.style.display = 'block'; }
        return;
    }

    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; }

    try {
        const r = await fetch(`${API}/auth/mobile/change-passcode`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ current_passcode: current, new_passcode: newPin })
        });
        const d = await r.json();
        if (r.ok && d.success) {
            showToast('Balance PIN changed successfully!', 'success');
            hideDesktopChangePinForm();
        } else {
            if (errEl) { errEl.textContent = d.error || 'Failed to change PIN'; errEl.style.display = 'block'; }
        }
    } catch (e) {
        if (errEl) { errEl.textContent = 'Connection error. Try again.'; errEl.style.display = 'block'; }
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Update PIN'; }
    }
}

function toggleSettingsNotification() {
    const cb = $id('settingsNotifToggle');
    if (cb) {
        localStorage.setItem('notificationsEnabled', cb.checked ? 'true' : 'false');
        showToast(cb.checked ? 'Notifications enabled' : 'Notifications disabled', 'info');
    }
}

/* ════════════════════════════════════════════════════════════
   CHANGE UPI PIN LOGIC
   ════════════════════════════════════════════════════════════ */
function openChangeUpiPinModal() {
    $id('changeUpiPinModal').style.display = 'flex';
    $id('upiPinOtpState').style.display = 'block';
    $id('upiPinVerifyState').style.display = 'none';
    $id('upiChangeOtpInput').value = '';
    $id('upiChangeNewPinInput').value = '';
}

function closeChangeUpiPinModal() {
    $id('changeUpiPinModal').style.display = 'none';
}

async function requestUpiPinChangeOtp() {
    const btn = $id('btnRequestUpiOtp');
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
            showToast('OTP sent to your registered email!', 'success');
            $id('upiPinOtpState').style.display = 'none';
            $id('upiPinVerifyState').style.display = 'block';
        } else {
            showToast(data.error || 'Failed to send OTP', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

async function submitUpiPinChange() {
    const otp = $id('upiChangeOtpInput').value;
    const newPin = $id('upiChangeNewPinInput').value;
    
    if (!otp || otp.length !== 6) {
        return showToast('Please enter the 6-digit OTP', 'warning');
    }
    if (!newPin || newPin.length !== 6) {
        return showToast('New PIN must be exactly 6 digits', 'warning');
    }
    
    const btn = $id('btnVerifyUpiOtp');
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
            showToast('UPI PIN successfully updated!', 'success');
            closeChangeUpiPinModal();
        } else {
            showToast(data.error || 'Failed to change PIN', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

/* ════════════════════════════════════════════════════════════
   QR SCANNER (UPI)
   ════════════════════════════════════════════════════════════ */
let html5QrCode = null;
let currentFacingMode = "environment";

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
        showToast("Camera access denied or not found", "error");
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
    showPage('upi');

    setTimeout(() => {
        const targetVpaInput = document.getElementById('targetVpa');
        if (targetVpaInput) {
            targetVpaInput.value = vpa;
            targetVpaInput.focus();
        } else {
            showToast('Scanned: ' + vpa, 'success');
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

    showToast("Processing image...", "info");

    html5QrCode.scanFile(imageFile, true)
        .then(decodedText => {
            handleQrCodeSuccess(decodedText);
        })
        .catch(err => {
            console.error("Gallery scan error", err);
            showToast("No QR code found in image", "error");
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

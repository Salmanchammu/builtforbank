const API = window.SMART_BANK_API_BASE || '/api';
console.log('Admin Dashboard API Base:', API);

/**
 * Premium custom confirm dialog — replaces native browser confirm()
 * Usage: showConfirm({ title, message, warning, onConfirm })
 */
function showConfirm({ title, message, warning, onConfirm }) {
    // Remove any existing dialog
    const existing = document.getElementById('_confirmModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = '_confirmModal';
    modal.style.cssText = `
        position:fixed; inset:0; background:rgba(0,0,0,0.45);
        display:flex; align-items:center; justify-content:center;
        z-index:99999;
        animation: fadeIn 0.2s ease;
    `;
    modal.innerHTML = `
        <style>
            @keyframes fadeIn { from { opacity:0; transform:scale(0.95); } to { opacity:1; transform:scale(1); } }
            #_confirmBox { animation: fadeIn 0.22s cubic-bezier(0.34,1.56,0.64,1); }
        </style>
        <div id="_confirmBox" style="
            background:#fff; border-radius:20px; padding:32px 28px;
            max-width:420px; width:90%; box-shadow:0 25px 60px rgba(0,0,0,0.18);
            text-align:center; position:relative;
        ">
            <div style="
                width:56px; height:56px; border-radius:50%;
                background:#fef2f2; color:#8b0000;
                display:flex; align-items:center; justify-content:center;
                margin:0 auto 18px; font-size:24px;
            ">
                <i class="fas fa-exclamation-triangle"></i>
            </div>
            <h3 style="margin:0 0 10px; font-size:20px; font-weight:800; color:#111827;">${title || 'Are you sure?'}</h3>
            <p style="margin:0 0 14px; font-size:14px; color:#4b5563; line-height:1.6;">${message || ''}</p>
            ${warning ? `<p style="background:#fef2f2; color:#991b1b; border-radius:10px; padding:10px 14px; font-size:13px; font-weight:600; margin-bottom:24px;">${warning}</p>` : '<div style="margin-bottom:10px;"></div>'}
            <div style="display:flex; gap:12px; justify-content:center;">
                <button id="_confirmCancel" style="
                    flex:1; padding:12px 24px; border-radius:30px;
                    border:1.5px solid #e5e7eb; background:#fff;
                    font-size:14px; font-weight:600; color:#6b7280;
                    cursor:pointer; transition:all 0.2s;
                ">Cancel</button>
                <button id="_confirmOk" style="
                    flex:1; padding:12px 24px; border-radius:30px;
                    border:none; background:#8b0000;
                    font-size:14px; font-weight:700; color:#fff;
                    cursor:pointer; box-shadow:0 4px 12px rgba(139,0,0,0.25);
                    transition:all 0.2s;
                ">Confirm</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    document.getElementById('_confirmCancel').onclick = close;
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    document.getElementById('_confirmOk').onclick = () => { close(); onConfirm(); };
}

function showPrompt({ title, message, placeholder, confirmText, onConfirm }) {
    const existing = document.getElementById('_confirmModal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = '_confirmModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:99999;';
    modal.innerHTML = `
        <div id="_confirmBox" style="background:#fff;border-radius:20px;padding:32px 28px;max-width:420px;width:90%;box-shadow:0 25px 60px rgba(0,0,0,0.18);text-align:center;">
            <div style="width:56px;height:56px;border-radius:50%;background:#fef3c7;color:#92400e;display:flex;align-items:center;justify-content:center;margin:0 auto 18px;font-size:24px;">
                <i class="fas fa-edit"></i>
            </div>
            <h3 style="margin:0 0 10px;font-size:20px;font-weight:800;color:#111827;">${title || 'Input Required'}</h3>
            <p style="margin:0 0 14px;font-size:14px;color:#4b5563;line-height:1.6;">${message || ''}</p>
            <div style="margin-bottom:24px;">
                <textarea id="_promptInput" style="width:100%;padding:12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;min-height:80px;resize:vertical;" placeholder="${placeholder || 'Enter reason...'}"></textarea>
            </div>
            <div style="display:flex;gap:12px;justify-content:center;">
                <button id="_confirmCancel" style="flex:1;padding:12px 24px;border-radius:30px;border:1.5px solid #e5e7eb;background:#fff;font-size:14px;font-weight:600;color:#6b7280;cursor:pointer;">Cancel</button>
                <button id="_confirmOk" style="flex:1;padding:12px 24px;border-radius:30px;border:none;background:#8b0000;font-size:14px;font-weight:700;color:#fff;cursor:pointer;box-shadow:0 4px 12px rgba(139,0,0,0.25);">${confirmText || 'Submit'}</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    document.getElementById('_confirmCancel').onclick = close;
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    document.getElementById('_confirmOk').onclick = () => {
        const val = document.getElementById('_promptInput').value;
        close();
        onConfirm(val);
    };
}

// Admin Dashboard - New Modern Design
// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('Admin Dashboard Initializing...');

        initializeDashboard();
        initTheme();
        setupEventListeners();
        loadAdminInfo();
        loadDashboardData();
        initSecurity();

        // Set up real-time polling (every 30 seconds)
        setInterval(() => {
            const dashboardPage = document.getElementById('dashboard');
            if (dashboardPage && dashboardPage.classList.contains('active')) {
                loadDashboardData();
            }
        }, 30000);
    } catch (error) {
        console.error('CRITICAL STARTUP ERROR:', error);
    }
});

// Initialize Dashboard
function initializeDashboard() {
    // Check if admin is logged in
    const admin = JSON.parse(localStorage.getItem('admin'));
    if (!admin) {
        window.location.href = 'user.html';
        return;
    }

    // Set admin info in sidebar
    const adminNameEl = document.getElementById('adminName');
    const adminRoleEl = document.getElementById('adminRole');
    if (adminNameEl) adminNameEl.textContent = admin.username || 'Administrator';
    if (adminRoleEl) adminRoleEl.textContent = 'System Admin';

    // Update avatar
    const adminAvatar = document.getElementById('adminAvatar');
    const topBarAvatar = document.getElementById('topBarAvatar');
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(admin.username || 'Admin')}&background=800000&color=fff&rounded=true&bold=true`;

    if (adminAvatar) adminAvatar.src = avatarUrl;
    if (topBarAvatar) topBarAvatar.src = avatarUrl;
}

// Setup Event Listeners
function setupEventListeners() {
    // Navigation
    const navItems = document.querySelectorAll('.nav-item[data-page]');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.getAttribute('data-page');
            showPage(page);

            // Update active state
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            const pageTitle = item.querySelector('span').textContent;
            document.getElementById('pageTitle').textContent = pageTitle;

            // Close sidebar on mobile after clicking
            if (window.innerWidth <= 1024) {
                document.querySelector('.sidebar').classList.remove('active');
            }
        });
    });

    // Mobile menu toggle
    window.toggleSidebar = function () {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) sidebar.classList.toggle('active');
    };

    // Theme toggle
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }

    // Global Search functionality
    const globalSearch = document.getElementById('globalSearchInput');
    if (globalSearch) {
        globalSearch.addEventListener('input', (e) => {
            filterActivePage(e.target.value);
        });
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
    const icon = document.querySelector('#themeToggle i');
    if (icon) {
        icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    }
}


// Load Admin Info
function loadAdminInfo() {
    const admin = JSON.parse(localStorage.getItem('admin'));
    if (!admin) return;
}

// Load Dashboard Data
async function loadDashboardData() {
    try {
        // Try to fetch from backend with session credentials
        const response = await fetch(API + '/admin/dashboard', {
            credentials: 'include'  // Include session cookie
        });

        if (response.ok) {
            const data = await response.json();
            console.log('Admin dashboard API response:', data);

            // Hide any previous error banner
            const existingBanner = document.getElementById('dashboardErrorBanner');
            if (existingBanner) existingBanner.remove();

            if (data.stats) {
                updateDashboardStats(data.stats);
            } else {
                console.warn('Backend returned success but no stats object:', data);
            }
            loadRecentUsers(data.recentUsers || []);
            loadSystemAlerts(data.systemAlerts || []);
            loadRecentTransactions(data.recentTransactions || []);
        } else {
            console.error('Failed to load dashboard data. Status:', response.status);
            showErrorBanner('Unable to sync dashboard data with server. Please check your connection.');
        }
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showErrorBanner('Critical connection error while loading system data.');
    }
}

function showErrorBanner(message) {
    const dashboard = document.getElementById('dashboard');
    if (!dashboard) return;

    let banner = document.getElementById('dashboardErrorBanner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'dashboardErrorBanner';
        banner.style.cssText = 'background: #fee2e2; color: #991b1b; padding: 12px 20px; border-radius: 12px; margin-bottom: 24px; display: flex; align-items: center; gap: 12px; border: 1px solid #fecaca; font-weight: 500;';
        dashboard.prepend(banner);
    }
    banner.innerHTML = `<i class="fas fa-exclamation-circle"></i> <span>${message}</span> <button onclick="this.parentElement.remove()" style="margin-left:auto; background:none; border:none; color:#991b1b; cursor:pointer; font-size:18px;">&times;</button>`;
}


// Load Dashboard Data

// Update Dashboard Stats
function updateDashboardStats(stats) {
    if (!stats) {
        console.error('updateDashboardStats called with null/undefined stats');
        return;
    }
    console.log('Updating dashboard stats with:', stats);
    const statTotalUsers = document.getElementById('statTotalUsers');
    const statActiveStaff = document.getElementById('statActiveStaff');
    const statTotalDeposits = document.getElementById('statTotalDeposits');
    const statTodayTransactions = document.getElementById('statTodayTransactions');

    // Trend Elements
    const statUsersTrend = document.getElementById('statUsersTrend');
    const statStaffTrend = document.getElementById('statStaffTrend');
    const statDepositsTrend = document.getElementById('statDepositsTrend');
    const statTransactionsTrend = document.getElementById('statTransactionsTrend');

    if (statTotalUsers) statTotalUsers.textContent = stats.totalUsers || 0;
    if (statActiveStaff) statActiveStaff.textContent = stats.activeStaff || 0;
    if (statTotalDeposits) statTotalDeposits.textContent = `₹${(stats.totalDeposits || 0).toLocaleString('en-IN')}`;
    if (statTodayTransactions) statTodayTransactions.textContent = stats.todayTransactions || 0;

    // Formatting for Fund balance (10L style)
    const fmtLakh = n => n >= 100000 ? `₹${(n / 100000).toFixed(2)}L` : `₹${Number(n).toLocaleString('en-IN')}`;

    // Update both home and liquidity page fund balance elements
    const fundVal = fmtLakh(stats.liquidityFund);
    const homeFund = document.getElementById('statLiquidityFund');
    const liqFund = document.getElementById('liqFundBalance');
    if (homeFund) homeFund.textContent = fundVal;
    if (liqFund) liqFund.textContent = fundVal;

    // Secondary Loan Stats (if visible on dashboard)
    if (stats.loan_stats) {
        const lp = document.getElementById('liqTotalPaid');
        const la = document.getElementById('liqActiveLoans');
        const lo = document.getElementById('liqOverdueLoans');
        if (lp) lp.textContent = stats.loan_stats.closed || 0;
        if (la) la.textContent = stats.loan_stats.active || 0;
        if (lo) lo.textContent = stats.loan_stats.overdue || 0;
    }

    // Render Trends
    const renderTrend = (el, trendStr, label) => {
        if (!el) return;
        const trend = trendStr || '0%';
        const isPositive = !trend.startsWith('-');
        el.className = `stat-trend ${isPositive ? 'positive' : 'negative'}`;
        el.innerHTML = `<i class="fas fa-arrow-${isPositive ? 'up' : 'down'}"></i> <span>${trend}<br>${label}</span>`;
    };

    renderTrend(statUsersTrend, stats.user_trend, 'this month');
    // renderTrend(statStaffTrend, stats.staff_trend, 'this month');
    if (statStaffTrend) statStaffTrend.style.display = 'none';
    renderTrend(statDepositsTrend, stats.deposit_trend, 'this month');
    renderTrend(statTransactionsTrend, stats.transaction_trend, 'today');
}

/**
 * Deterrence measures for financial data security
 */
function initSecurity() {
    const mask = document.getElementById('privacyMask');
    const flash = document.getElementById('screenshotFlash');

    // Visual Flash Warning
    const triggerFlash = () => {
        if (!flash) return;
        flash.classList.add('active');
        setTimeout(() => flash.classList.remove('active'), 500);
    };

    // 1. Visibility & Focus tracking (Privacy Blur)
    const showMask = () => { if (mask) mask.classList.add('active'); };
    const hideMask = () => { if (mask) mask.classList.remove('active'); };

    window.addEventListener('blur', showMask);
    window.addEventListener('focus', hideMask);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) showMask(); else hideMask();
    });

    // 2. Disable Right-Click (Context Menu)
    document.addEventListener('contextmenu', e => e.preventDefault());

    // 3. Block common screenshot/capture shortcuts
    document.addEventListener('keydown', e => {
        // Ctrl+P (Print), Ctrl+S (Save), Ctrl+U (View Source), Ctrl+Shift+I (DevTools)
        if (e.ctrlKey && (e.key === 'p' || e.key === 's' || e.key === 'u' || (e.key === 'i' && e.shiftKey))) {
            e.preventDefault();
            triggerFlash();
            alert('Action disabled for security reasons.');
            return false;
        }
        // PrintScreen Key
        if (e.key === 'PrintScreen' || e.keyCode === 44) {
            e.preventDefault();
            triggerFlash();
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(''); // Attempt to clear clipboard
            }
            alert('Screenshots are strictly prohibited on this dashboard.');
        }
    });

    // 4. Best-effort PrintScreen detection via keyboard
    window.addEventListener('keyup', e => {
        if (e.key === 'PrintScreen' || e.keyCode === 44) {
            triggerFlash();
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText('');
            }
            if (typeof showToast === 'function') showToast('Security Alert: Screenshot blocked', 'error');
        }
    });
}

// Load Recent Users
function loadRecentUsers(users) {
    const container = document.getElementById('recentUsersList');
    if (!container) return;

    if (!users || users.length === 0) {
        container.innerHTML = '<p style="padding: 1rem; text-align: center; color: #9ca3af;">No recent users</p>';
        return;
    }

    container.innerHTML = users.map(user => `
        <div class="list-item">
            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || user.username || 'User')}&background=800000&color=fff&rounded=true&bold=true" alt="${user.name || user.username}">
            <div class="list-item-content">
                <h4>${user.name || user.username || 'Unknown'}</h4>
                <p>${user.email || 'No email'}</p>
            </div>
        </div>
    `).join('');
}

// Load System Alerts
function loadSystemAlerts(alerts) {
    const container = document.getElementById('systemAlerts');
    if (!container) return;

    if (alerts.length === 0) {
        container.innerHTML = '<p style="padding: 1rem; text-align: center; color: #9ca3af;">No system alerts</p>';
        return;
    }

    const alertColors = {
        success: '#10b981',
        warning: '#f59e0b',
        info: '#800000',
        danger: '#ef4444'
    };

    const alertIcons = {
        success: 'fa-check-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle',
        danger: 'fa-times-circle'
    };

    container.innerHTML = alerts.map(alert => `
        <div class="list-item">
            <div style="width: 40px; height: 40px; background: ${alertColors[alert.type] || alertColors.info}; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white;">
                <i class="fas ${alertIcons[alert.type] || alertIcons.info}"></i>
            </div>
            <div class="list-item-content">
                <h4>${alert.title}</h4>
                <p>${alert.time}</p>
            </div>
        </div>
    `).join('');
}

// Load Recent Transactions
function loadRecentTransactions(transactions) {
    const container = document.getElementById('transactionsList');
    if (!container) return;

    if (transactions.length === 0) {
        container.innerHTML = '<div class="premium-table-wrapper"><div style="text-align: center; padding: 2rem; color: #9ca3af;">No recent transactions</div></div>';
        return;
    }

    container.innerHTML = `
        <div class="premium-table-wrapper">
            <table class="premium-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>User</th>
                        <th>Account</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Date</th>
                        <th>Mode</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${transactions.map(txn => `
                        <tr>
                            <td><strong>${txn.id || txn.reference_number || '-'}</strong></td>
                            <td class="clickable-cell">${txn.user || txn.user_name || 'Unknown'}</td>
                            <td class="acc-num-display">${txn.account || txn.account_number || 'Unknown'}</td>
                            <td>
                                <span class="status-badge ${txn.type.toLowerCase() === 'debit' ? 'danger' : 'success'}">
                                    ${(txn.type || '').toUpperCase()}
                                </span>
                            </td>
                            <td style="font-weight: 800;" class="${txn.type.toLowerCase() === 'debit' ? 'text-danger' : 'text-success'}">
                                ${txn.type.toLowerCase() === 'debit' ? '-' : '+'}₹${Number(txn.amount || 0).toLocaleString('en-IN')}
                            </td>
                            <td>${new Date(txn.date || txn.transaction_date).toLocaleString('en-IN')}</td>
                            <td><span class="status-badge" style="background:rgba(128,0,0,0.1);color:#800000;border-radius:6px;font-size:10px;">${txn.mode || 'CASH'}</span></td>
                            <td>
                                <span class="status-badge ${txn.status || 'success'}">
                                    ${((txn.status || 'completed').charAt(0).toUpperCase() + (txn.status || 'completed').slice(1))}
                                </span>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// Show Page - Handles navigation
function showPage(pageName) {
    document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const target = document.getElementById(pageName);
    if (target) {
        target.classList.add('active');
    }

    const navItem = document.querySelector(`.nav-item[data-page="${pageName}"]`);
    if (navItem) {
        navItem.classList.add('active');
        const pageTitle = navItem.querySelector('span')?.textContent;
        if (pageTitle) {
            document.getElementById('pageTitle').textContent = pageTitle;
        }
    }

    // Load specific page data
    switch (pageName) {
        case 'dashboard': loadDashboardData(); break;
        case 'users': loadUsersPage(); break;
        case 'accounts': loadAccountsPage(); break;
        case 'loans': loadLoansPage(); break;
        case 'liquidity': loadLiquidityPage(); break;
        case 'transactions': loadTransactionsPage(); break;
        case 'staff': loadStaffPage(); break;
        case 'admin-mgmt': loadAdminManagementPage(); break;
        case 'reports': loadReportsPage(); break;
        case 'audit': loadAuditPage(); break;
        case 'settings': loadSettingsPage(); break;
        case 'backup': loadBackupPage(); break;
        case 'attendance': loadAttendanceTrackingPage(); break;
        case 'salary': loadSalaryManagementPage(); break;
        case 'services': loadServicesPage(); break;
    }
}

// =============================================
// ADMIN: SERVICES & APPLICATIONS
// =============================================
async function loadServicesPage() {
    const el = document.getElementById('pendingApplicationsList');
    if (!el) return;
    el.innerHTML = '<p style="padding:16px;color:#9ca3af;">Loading applications...</p>';
    try {
        const r = await fetch(API + '/staff/service-applications', { credentials: 'include' });
        if (!r.ok) throw new Error();
        const data = await r.json();
        const apps = data.applications || [];

        if (!apps.length) {
            el.innerHTML = '<p style="padding:16px;text-align:center;color:#9ca3af;">No pending applications found.</p>';
            return;
        }

        el.innerHTML = `
            <div class="premium-table-wrapper">
                <table class="premium-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Customer</th>
                            <th>Service</th>
                            <th>Product</th>
                            <th style="text-align:right;">Amount</th>
                            <th>Tenure</th>
                            <th>Status</th>
                            <th>Date</th>
                            <th style="text-align:center;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${apps.map(a => `
                            <tr>
                                <td class="acc-num-display">#${a.id}</td>
                                <td>
                                    <div style="font-weight:700;">${a.user_name || '—'}</div>
                                    <div style="font-size:11px;color:var(--text-secondary);">${a.user_email || '—'}</div>
                                </td>
                                <td><span class="status-badge" style="background:rgba(59,130,246,0.1);color:#3b82f6;">${a.service_type.toUpperCase()}</span></td>
                                <td style="font-weight:600;">${a.product_name}</td>
                                <td style="text-align:right;font-weight:700;">₹${Number(a.amount).toLocaleString('en-IN')}</td>
                                <td>${a.tenure || '—'}</td>
                                <td><span class="status-badge ${a.status === 'approved' ? 'success' : a.status === 'pending' ? 'warning' : 'danger'}">${a.status.toUpperCase()}</span></td>
                                 <td style="color:var(--text-secondary);font-size:12px;">${a.applied_at ? new Date(a.applied_at).toLocaleDateString('en-IN') : '—'}</td>
                                <td>
                                    <div style="display:flex;gap:6px;justify-content:center;">
                                        ${a.status === 'pending' ? `
                                            <button class="action-btn-circle view" onclick="handleServiceApplication(${a.id}, 'approve')" title="Approve">
                                                <i class="fas fa-check"></i>
                                            </button>
                                            <button class="action-btn-circle delete" onclick="handleServiceApplication(${a.id}, 'reject')" title="Reject">
                                                <i class="fas fa-times"></i>
                                            </button>
                                        ` : '—'}
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>`;

        // Setup search
        const searchInput = document.getElementById('serviceSearch');
        if (searchInput) {
            searchInput.oninput = (e) => {
                const term = e.target.value.toLowerCase();
                const rows = el.querySelectorAll('tbody tr');
                rows.forEach(row => {
                    row.style.display = row.textContent.toLowerCase().includes(term) ? '' : 'none';
                });
            };
        }
    } catch (e) {
        el.innerHTML = '<p style="padding:16px;color:#ef4444;">Failed to load applications.</p>';
    }
}

async function handleServiceApplication(appId, action) {
    if (action === 'reject') {
        showPrompt({
            title: 'Reject Application',
            message: 'Please provide a reason for rejecting this application. This will be shown to the customer.',
            placeholder: 'e.g. Insufficient documents / Credit score low',
            confirmText: 'Reject Now',
            onConfirm: async (reason) => {
                if (!reason) return showToast('Rejection reason is required', 'error');
                executeServiceAction(appId, action, reason);
            }
        });
    } else {
        showConfirm({
            title: 'Approve Application',
            message: 'Are you sure you want to <strong>approve</strong> this service application?',
            icon: 'fa-check-circle',
            confirmText: 'Approve',
            onConfirm: () => executeServiceAction(appId, action)
        });
    }
}

async function executeServiceAction(appId, action, reason = '') {
    try {
        const res = await fetch(`${API}/staff/service-applications/${appId}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, reason })
        });
        const data = await res.json();
        if (res.ok) {
            showToast(data.message || 'Application updated successfully', 'success');
            loadServicesPage();
        } else {
            showToast(data.error || 'Failed to update application', 'error');
        }
    } catch (e) {
        showToast('Network error', 'error');
    }
}

// Load Users Page
async function loadUsersPage() {
    const tbody = document.getElementById('usersTable');
    if (!tbody) return;

    try {
        const response = await fetch(API + '/admin/users', { credentials: 'include' });
        if (response.ok) {
            const users = await response.json();
            renderUsersTable(users);
        } else {
            renderUsersTable([]);
        }
    } catch (e) {
        console.log('Backend not available, loading mock users');
        const users = [
            { id: 'USR001', name: 'Rahul Sharma', email: 'rahul@example.com', phone: '+91 98765 43210', account_count: 2, total_balance: 150000, status: 'active' },
            { id: 'USR002', name: 'Priya Patel', email: 'priya@example.com', phone: '+91 98765 43211', account_count: 1, total_balance: 85000, status: 'active' }
        ];
        renderUsersTable(users);
    }
}

function renderUsersTable(users) {
    const tbody = document.getElementById('usersTable');
    if (!tbody) return;
    if (!users.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">No users found</td></tr>';
        return;
    }
    tbody.innerHTML = users.map(user => `
        <tr>
            <td class="acc-num-display">#${user.id}</td>
            <td class="clickable-cell" onclick="viewUserActivity('${user.id}', '${(user.name || user.username || '').replace(/'/g, "\\'")}')">
                <div style="font-weight:700;">${user.name}</div>
                <div style="font-size:12px;color:var(--text-secondary);">@${user.username || user.id}</div>
            </td>
            <td class="clickable-cell" onclick="viewUserActivity('${user.id}', '${(user.name || user.username || '').replace(/'/g, "\\'")}')">${user.email}</td>
            <td>${user.phone || '—'}</td>
            <td><span class="status-badge" style="background:rgba(128,0,0,0.05);color:var(--text-primary);border:1px solid var(--border-color);">${user.account_count || 0}</span></td>
            <td><strong style="font-weight:800;">₹${(user.total_balance || 0).toLocaleString('en-IN')}</strong></td>
            <td><span class="status-badge ${user.status === 'active' ? 'success' : 'danger'}">${user.status}</span></td>
            <td>
                <div style="display:flex;gap:8px;">
                    <button class="action-btn-circle view" onclick="viewUserActivity('${user.id}', '${(user.name || user.username || '').replace(/'/g, "\\'")}')" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="action-btn-circle delete" onclick="deleteUser('${user.id}', '${(user.name || user.username || '').replace(/'/g, "\\'")}')" title="Delete User">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}


// =============================================
// ADD USER MODAL
// =============================================
function showAddUserModal() {
    const form = document.getElementById('addUserForm');
    if (form) form.reset();
    const err = document.getElementById('addUserError');
    if (err) { err.style.display = 'none'; err.textContent = ''; }
    const btn = document.getElementById('addUserSubmitBtn');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-user-plus"></i> Create User'; }
    const modal = document.getElementById('addUserModal');
    if (modal) {
        modal.classList.add('active');
        const container = document.querySelector('.dashboard-container');
        if (container) container.classList.add('blur-background');
    }
}

async function submitAddUser(event) {
    event.preventDefault();
    const btn = document.getElementById('addUserSubmitBtn');
    const errDiv = document.getElementById('addUserError');

    const payload = {
        name: document.getElementById('newUserName').value.trim(),
        username: document.getElementById('newUserUsername').value.trim(),
        email: document.getElementById('newUserEmail').value.trim(),
        phone: document.getElementById('newUserPhone').value.trim(),
        password: document.getElementById('newUserPassword').value,
        dob: document.getElementById('newUserDob').value || null
    };

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
    errDiv.style.display = 'none';

    try {
        const res = await fetch(API + '/admin/users/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (res.ok && (data.success !== false)) {
            const modal = document.getElementById('addUserModal');
            if (modal) {
                modal.classList.remove('active');
                const container = document.querySelector('.dashboard-container');
                if (container) container.classList.remove('blur-background');
            }
            showToast('User "' + payload.name + '" created successfully!', 'success');
            loadUsersPage();
        } else {
            errDiv.textContent = data.error || 'Failed to create user.';
            errDiv.style.display = 'block';
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-user-plus"></i> Create User';
        }
    } catch (e) {
        errDiv.textContent = 'Network error. Please try again.';
        errDiv.style.display = 'block';
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-user-plus"></i> Create User';
    }
}

// View User Activity Logic — full detail modal
async function viewUserActivity(userId, userName) {
    const modal = document.getElementById('userActivityModal');
    if (!modal) return;
    modal.classList.add('active');

    const details = document.getElementById('activityDetails');
    if (details) details.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;padding:60px;"><i class="fas fa-spinner fa-spin" style="font-size:32px;color:var(--primary-color);"></i></div>';

    const nameEl = document.getElementById('activityUserName');
    if (nameEl) nameEl.textContent = userName;

    try {
        const r = await fetch(API + `/staff/user/${userId}/activity`, { credentials: 'include' });
        if (!r.ok) throw new Error('Failed to fetch user details');
        const data = await r.json();
        const u = data.user || {};
        const accounts = data.accounts || [];
        const txns = data.transactions || [];
        const cards = data.cards || [];
        const loans = data.loans || [];

        const activeAccounts = accounts.filter(a => a.status === 'active');

        if (details) details.innerHTML = `
        <!-- Profile Header -->
        <div style="background:linear-gradient(135deg,var(--primary-color),#a52a2a);border-radius:12px;padding:20px;color:white;display:flex;align-items:center;gap:20px;margin-bottom:20px;">
            <div style="width:60px;height:60px;border-radius:50%;background:rgba(255,255,255,0.25);display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:700;color:white;flex-shrink:0;">
                ${(u.name || 'U').charAt(0).toUpperCase()}
            </div>
            <div style="flex:1;">
                <div style="font-size:20px;font-weight:700;">${u.name || 'Unknown'}</div>
                <div style="font-size:13px;opacity:0.85;">@${u.username || '—'} &nbsp;|&nbsp; ID #${u.id}</div>
            </div>
            <span style="padding:6px 14px;border-radius:20px;font-size:12px;font-weight:700;background:${u.status === 'active' ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'};color:${u.status === 'active' ? '#6ee7b7' : '#fca5a5'};">
                ${(u.status || 'unknown').toUpperCase()}
            </span>
        </div>

        <!-- Info Grid -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
            <div style="background:var(--bg-light);border-radius:10px;padding:14px;border:1px solid var(--border-color);">
                <div style="font-size:11px;text-transform:uppercase;color:var(--text-secondary);margin-bottom:4px;"><i class="fas fa-envelope" style="margin-right:5px;"></i>Email</div>
                <div style="font-size:14px;font-weight:600;">${u.email || '—'}</div>
            </div>
            <div style="background:var(--bg-light);border-radius:10px;padding:14px;border:1px solid var(--border-color);">
                <div style="font-size:11px;text-transform:uppercase;color:var(--text-secondary);margin-bottom:4px;"><i class="fas fa-phone" style="margin-right:5px;"></i>Phone</div>
                <div style="font-size:14px;font-weight:600;">${u.phone || '—'}</div>
            </div>
            <div style="background:var(--bg-light);border-radius:10px;padding:14px;border:1px solid var(--border-color);">
                <div style="font-size:11px;text-transform:uppercase;color:var(--text-secondary);margin-bottom:4px;"><i class="fas fa-calendar-alt" style="margin-right:5px;"></i>Date of Birth</div>
                <div style="font-size:14px;font-weight:600;">${u.date_of_birth || '—'}</div>
            </div>
            <div style="background:var(--bg-light);border-radius:10px;padding:14px;border:1px solid var(--border-color);">
                <div style="font-size:11px;text-transform:uppercase;color:var(--text-secondary);margin-bottom:4px;"><i class="fas fa-user-plus" style="margin-right:5px;"></i>Member Since</div>
                <div style="font-size:14px;font-weight:600;">${u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN') : '—'}</div>
            </div>
            ${u.address ? `<div style="grid-column:span 2;background:var(--bg-light);border-radius:10px;padding:14px;border:1px solid var(--border-color);">
                <div style="font-size:11px;text-transform:uppercase;color:var(--text-secondary);margin-bottom:4px;"><i class="fas fa-map-marker-alt" style="margin-right:5px;"></i>Address</div>
                <div style="font-size:14px;font-weight:600;">${u.address}</div>
            </div>` : ''}
        </div>

        <!-- Active Accounts -->
        <h4 style="font-size:14px;font-weight:700;margin:0 0 10px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.5px;">
            <i class="fas fa-university" style="margin-right:6px;color:var(--primary-color);"></i>Active Accounts (${activeAccounts.length})
        </h4>
        ${activeAccounts.length ? `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;margin-bottom:20px;">
            ${activeAccounts.map(a => `
            <div style="background:linear-gradient(135deg,var(--primary-color),#a52a2a);border-radius:12px;padding:16px;color:white;">
                <div style="font-size:11px;opacity:0.8;margin-bottom:6px;">${a.account_type} Account</div>
                <div style="font-family:monospace;font-size:13px;margin-bottom:10px;opacity:0.9;">${a.account_number}</div>
                <div style="font-size:20px;font-weight:700;">₹${Number(a.balance).toLocaleString('en-IN')}</div>
                <div style="font-size:10px;opacity:0.75;margin-top:6px;">IFSC: ${a.ifsc || '—'} &nbsp;|&nbsp; ${a.branch || '—'}</div>
            </div>`).join('')}
        </div>` : '<p style="color:var(--text-secondary);margin-bottom:20px;">No active accounts.</p>'}

        <!-- Cards & Loans -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
            <div>
                <h4 style="font-size:13px;font-weight:700;margin:0 0 8px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.5px;">
                    <i class="fas fa-credit-card" style="margin-right:5px;"></i>Cards (${cards.length})
                </h4>
                ${cards.length ? cards.map(c => `
                <div style="padding:10px 14px;border-radius:8px;margin-bottom:8px;background:var(--bg-light);border:1px solid var(--border-color);">
                    <div style="font-weight:600;font-size:13px;">${c.card_type} <span style="float:right;font-size:11px;padding:2px 8px;border-radius:10px;background:${c.status === 'active' ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)'};color:${c.status === 'active' ? '#10b981' : '#ef4444'}">${c.status}</span></div>
                    <div style="font-family:monospace;font-size:12px;color:var(--text-secondary);">****${String(c.card_number || '0000').slice(-4)} &nbsp;|&nbsp; Exp: ${c.expiry_date || '—'}</div>
                </div>`).join('') : '<p style="font-size:13px;color:var(--text-secondary);">No cards.</p>'}
            </div>
            <div>
                <h4 style="font-size:13px;font-weight:700;margin:0 0 8px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.5px;">
                    <i class="fas fa-hand-holding-usd" style="margin-right:5px;"></i>Loans (${loans.length})
                </h4>
                ${loans.length ? loans.map(l => `
                <div style="padding:10px 14px;border-radius:8px;margin-bottom:8px;background:var(--bg-light);border:1px solid var(--border-color);">
                    <div style="font-weight:600;font-size:13px;">${l.loan_type} <span style="float:right;font-size:11px;padding:2px 8px;border-radius:10px;background:rgba(245,158,11,.15);color:#f59e0b;">${l.status}</span></div>
                    <div style="font-weight:700;font-size:14px;color:var(--primary-color);">₹${Number(l.loan_amount || 0).toLocaleString('en-IN')}</div>
                    <div style="font-size:11px;color:var(--text-secondary);">${l.tenure_months || 0} months @ ${l.interest_rate || 0}%</div>
                </div>`).join('') : '<p style="font-size:13px;color:var(--text-secondary);">No loans.</p>'}
            </div>
        </div>

        <!-- Transaction History -->
        <h4 style="font-size:14px;font-weight:700;margin:0 0 10px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.5px;">
            <i class="fas fa-exchange-alt" style="margin-right:6px;color:var(--primary-color);"></i>Transaction History (${txns.length})
        </h4>
        ${txns.length ? `
        <div style="border:1px solid var(--border-color);border-radius:10px;overflow:hidden;">
            <table style="width:100%;border-collapse:collapse;font-size:12px;">
                <thead style="background:var(--bg-light);">
                    <tr>
                        <th style="padding:10px 12px;text-align:left;color:var(--text-secondary);font-weight:600;">Date</th>
                        <th style="padding:10px 12px;text-align:left;color:var(--text-secondary);font-weight:600;">Description</th>
                        <th style="padding:10px 12px;text-align:left;color:var(--text-secondary);font-weight:600;">Account</th>
                        <th style="padding:10px 12px;text-align:left;color:var(--text-secondary);font-weight:600;">Mode</th>
                        <th style="padding:10px 12px;text-align:right;color:var(--text-secondary);font-weight:600;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${txns.map((t, i) => `
                    <tr style="border-top:1px solid var(--border-color);${i % 2 === 0 ? 'background:var(--bg-card);' : 'background:var(--bg-light);'}">
                        <td style="padding:10px 12px;white-space:nowrap;">${t.transaction_date ? new Date(t.transaction_date).toLocaleDateString('en-IN') : '—'}</td>
                        <td style="padding:10px 12px;">${t.description || t.type || '—'}</td>
                        <td style="padding:10px 12px;font-family:monospace;font-size:11px;">${t.account_number || '—'}</td>
                        <td style="padding:10px 12px;">${t.mode || '—'}</td>
                        <td style="padding:10px 12px;text-align:right;font-weight:700;color:${t.type.toLowerCase() === 'debit' ? '#ef4444' : '#10b981'};">
                            ${t.type.toLowerCase() === 'debit' ? '-' : '+'}₹${Number(t.amount || 0).toLocaleString('en-IN')}
                            <div style="font-size:10px;font-weight:400;color:${t.type.toLowerCase() === 'debit' ? '#fca5a5' : '#6ee7b7'}">${(t.type || 'unknown').toUpperCase()}</div>
                        </td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </div>` : '<p style="color:var(--text-secondary);">No transactions found.</p>'}`;
    } catch (e) {
        console.error(e);
        const details = document.getElementById('activityDetails');
        if (details) details.innerHTML = '<p style="color:#ef4444;padding:20px;">Error loading user details. Please try again.</p>';
    }
}

// Load Staff Page
async function loadStaffPage() {
    const container = document.getElementById('staffList');
    if (!container) return;
    try {
        const response = await fetch(API + '/admin/staff', { credentials: 'include' });
        if (response.ok) {
            const staffList = await response.json();
            renderStaffTable(staffList, container);
        } else {
            renderStaffTable([], container);
        }
    } catch (e) {
        console.log('Failed to load staff');
    }
}

function renderStaffTable(staffList, container) {
    if (!staffList.length) {
        container.innerHTML = '<div class="premium-table-wrapper"><p style="text-align: center; padding: 2rem; color: #6b7280;">No staff found</p></div>';
        return;
    }
    container.innerHTML = `
        <div class="premium-table-wrapper">
            <table class="premium-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Dept</th>
                        <th>Position</th>
                        <th>Status</th>
                        <th style="text-align: center;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${staffList.map(staff => `
                        <tr>
                            <td class="acc-num-display">#${staff.staff_id}</td>
                            <td style="font-weight:700;">${staff.name}</td>
                            <td>${staff.email}</td>
                            <td><span class="status-badge" style="background:rgba(128,0,0,0.05);color:#800000;border:1px solid rgba(128,0,0,0.1);">${staff.department}</span></td>
                            <td>${staff.position}</td>
                            <td><span class="status-badge ${staff.status === 'active' ? 'success' : 'danger'}">${staff.status}</span></td>
                            <td>
                                <div style="display:flex;gap:8px;justify-content:center;">
                                    <button onclick="changeDepartment(${staff.id}, '${staff.name}', '${staff.department}')" class="action-btn-circle view" title="Change Department">
                                        <i class="fas fa-building"></i>
                                    </button>
                                    <button onclick="promoteStaff(${staff.id}, '${staff.name}')" class="action-btn-circle edit" style="background:#fef3c7;color:#d97706;" title="Promote to Admin">
                                        <i class="fas fa-crown"></i>
                                    </button>
                                    <button onclick="deleteStaff(${staff.id}, '${staff.name}')" class="action-btn-circle delete" title="Delete Staff">
                                        <i class="fas fa-trash-alt"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

async function updateStaffStatus(id, action) {
    try {
        const method = action === 'delete' ? 'DELETE' : 'PUT';
        const endpoint = action === 'delete' ? `/admin/staff/${id}` : `/admin/staff/${id}/promote`;

        const response = await fetch(API + endpoint, {
            method: method,
            credentials: 'include'
        });

        const data = await response.json();

        if (response.ok) {
            showToast(data.message || `Staff member successfully ${action === 'delete' ? 'deleted' : 'promoted'}.`, 'success');
            loadStaffPage();
        } else {
            showToast('Error: ' + (data.error || `Failed to ${action} staff member.`), 'error');
        }
    } catch (e) {
        console.error(`Error ${action}ing staff:`, e);
        showToast(`A network error occurred while trying to ${action} the staff member.`, 'error');
    }
}

function deleteStaff(id, name) {
    showConfirm({
        title: 'Delete Staff Member',
        message: `You are about to permanently delete <strong>${name}</strong> from the system.`,
        warning: '⚠ This action cannot be undone.',
        onConfirm: () => updateStaffStatus(id, 'delete')
    });
}

let currentPromoteStaffId = null;

function promoteStaff(id, name) {
    currentPromoteStaffId = id;
    document.getElementById('promoteStaffName').textContent = name;
    document.getElementById('promoteRoleSelect').value = 'Senior Staff'; // default
    document.getElementById('promoteStaffModal').classList.add('active');
}

function closePromoteModal() {
    document.getElementById('promoteStaffModal').classList.remove('active');
    currentPromoteStaffId = null;
}

async function confirmPromotion() {
    if (!currentPromoteStaffId) return;
    const newRole = document.getElementById('promoteRoleSelect').value;

    try {
        const response = await fetch(API + `/admin/staff/${currentPromoteStaffId}/promote`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ new_role: newRole }),
            credentials: 'include'
        });

        const data = await response.json();

        if (response.ok) {
            showToast(data.message || `Staff member successfully promoted to ${newRole}.`, 'success');
            closePromoteModal();
            loadStaffPage();
        } else {
            showToast('Error: ' + (data.error || 'Failed to promote staff member.'), 'error');
        }
    } catch (e) {
        console.error('Error promoting staff:', e);
        showToast('A network error occurred while trying to promote the staff member.', 'error');
    }
}

let currentChangeDeptStaffId = null;

function changeDepartment(id, name, currentDept) {
    currentChangeDeptStaffId = id;
    document.getElementById('changeDeptStaffName').textContent = name;

    // Attempt to pre-select their current department if it exists in the dropdown options
    const select = document.getElementById('changeDeptSelect');
    let deptFound = false;
    for (let i = 0; i < select.options.length; i++) {
        if (select.options[i].value === currentDept) {
            select.selectedIndex = i;
            deptFound = true;
            break;
        }
    }
    if (!deptFound) select.selectedIndex = 0; // fallback to first if custom

    document.getElementById('changeDeptModal').classList.add('active');
}

function closeChangeDeptModal() {
    document.getElementById('changeDeptModal').classList.remove('active');
    currentChangeDeptStaffId = null;
}

async function confirmDepartmentChange() {
    if (!currentChangeDeptStaffId) return;
    const newDept = document.getElementById('changeDeptSelect').value;

    try {
        const response = await fetch(API + `/admin/staff/${currentChangeDeptStaffId}/department`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ new_department: newDept }),
            credentials: 'include'
        });

        const data = await response.json();

        if (response.ok) {
            showToast(data.message || `Department successfully updated to ${newDept}.`, 'success');
            closeChangeDeptModal();
            loadStaffPage();
        } else {
            showToast('Error: ' + (data.error || 'Failed to update department.'), 'error');
        }
    } catch (e) {
        console.error('Error updating department:', e);
        showToast('A network error occurred while trying to update the department.', 'error');
    }
}


// Universal Filter active view
function filterActivePage(searchTerm) {
    const activePage = document.querySelector('.page-content.active');
    if (!activePage) return;

    searchTerm = searchTerm.toLowerCase().trim();

    // Filter table rows
    const rows = activePage.querySelectorAll('tbody tr');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });

    // Filter list items / cards
    const listItems = activePage.querySelectorAll('.list-item');
    listItems.forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

// Modal Functions
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
}

window.closeModal = function (modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        const container = document.querySelector('.dashboard-container');
        if (container) container.classList.remove('blur-background');
    }
};

// Theme Toggle
function toggleTheme() {
    document.body.classList.toggle('dark-theme');
    const themeIcon = document.querySelector('#themeToggle i');

    if (document.body.classList.contains('dark-theme')) {
        themeIcon.classList.remove('fa-moon');
        themeIcon.classList.add('fa-sun');
        localStorage.setItem('theme', 'dark');
    } else {
        themeIcon.classList.remove('fa-sun');
        themeIcon.classList.add('fa-moon');
        localStorage.setItem('theme', 'light');
    }
}

// Load saved theme
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') {
    document.body.classList.add('dark-theme');
    const themeIcon = document.querySelector('#themeToggle i');
    if (themeIcon) {
        themeIcon.classList.remove('fa-moon');
        themeIcon.classList.add('fa-sun');
    }
}

// Logout Function
function logout() {
    showConfirm({
        title: 'Logout?',
        message: 'Are you sure you want to logout from the Admin Dashboard?',
        icon: 'fa-sign-out-alt',
        confirmText: 'Logout',
        onConfirm: () => {
            localStorage.removeItem('admin');
            localStorage.removeItem('token');
            window.location.href = 'user.html';
        }
    });
}

// Toast Notification
function showToast(message, type = 'info') {
    // Create toast element if it doesn't exist
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.style.cssText = `
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            padding: 1rem 1.5rem;
            border-radius: 0.5rem;
            color: white;
            font-weight: 600;
            z-index: 9999;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        document.body.appendChild(toast);
    }

    // Set color based on type
    const colors = {
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#800000'
    };

    toast.style.background = colors[type] || colors.info;
    toast.textContent = message;
    toast.style.opacity = '1';

    setTimeout(() => {
        toast.style.opacity = '0';
    }, 3000);
}

// Auto-refresh data every 60 seconds based on active page to prevent UI reset
setInterval(() => {
    const activeNav = document.querySelector('.nav-item.active');
    if (activeNav) {
        const page = activeNav.getAttribute('data-page');
        if (page === 'dashboard' || !page) {
            loadDashboardData();
        } else if (page === 'users') {
            loadUsersPage();
        } else if (page === 'staff') {
            loadStaffPage();
        } else if (page === 'admin-mgmt') {
            loadAdminManagementPage();
        } else if (page === 'transactions') {
            loadTransactionsPage();
        } else if (page === 'attendance') {
            loadAttendanceTrackingPage();
        } else if (page === 'salary') {
            loadSalaryManagementPage();
        }
    } else {
        loadDashboardData();
    }
}, 60000);

// ==========================================
// SALARY MANAGEMENT LOGIC
// ==========================================

async function loadSalaryManagementPage() {
    const tableBody = document.getElementById('adminSalaryTable');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px;"><i class="fas fa-spinner fa-spin"></i> Loading salaries...</td></tr>';

    try {
        const [salaryRes, fundRes] = await Promise.all([
            fetch(API + '/admin/salary/list', { credentials: 'include' }),
            fetch(API + '/admin/liquidity/fund', { credentials: 'include' }).catch(() => null)
        ]);
        const data = await salaryRes.json();

        if (data.success) {
            document.getElementById('currentSalaryMonth').textContent = data.month;
            document.getElementById('salaryStatsDays').textContent = `Month Days: ${data.days_in_month}`;
            // Show fund balance if element exists
            if (fundRes && fundRes.ok) {
                const fundData = await fundRes.json();
                const fundEl = document.getElementById('salaryFundBalance');
                if (fundEl) fundEl.textContent = `₹${(fundData.balance || 0).toLocaleString('en-IN')}`;
            }
            renderSalaryTable(data.salary_list);
        } else {
            tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:red;">Error: ${data.error}</td></tr>`;
        }
    } catch (e) {
        console.error('Error loading salaries:', e);
        tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px;color:red;">Failed to connect to backend.</td></tr>';
    }
}

function renderSalaryTable(salaryList) {
    const tableBody = document.getElementById('adminSalaryTable');
    if (!tableBody) return;

    if (!salaryList || salaryList.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px;">No staff records found.</td></tr>';
        return;
    }

    tableBody.innerHTML = salaryList.map(item => `
        <tr>
            <td class="acc-num-display">${item.staff_code}</td>
            <td style="font-weight:700;">${item.name}</td>
            <td><span class="status-badge" style="background:rgba(128,0,0,0.05);color:var(--text-primary);border:1px solid var(--border-color);">${item.department.toUpperCase()}</span></td>
            <td><strong style="font-weight:700;">₹${(item.base_salary || 0).toLocaleString('en-IN')}</strong></td>
            <td><span class="status-badge success">${item.attendance_days} days</span></td>
            <td><strong style="color:var(--primary);font-size:15px;font-weight:800;">₹${(item.current_salary || 0).toLocaleString('en-IN')}</strong></td>
            <td>
                <div style="display:flex;gap:6px;">
                    <button class="action-btn-circle edit" onclick="openUpdateSalaryModal(${item.id}, '${item.name}', ${item.base_salary})" title="Update Base Salary">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${item.current_salary > 0 ? `
                    <button class="action-btn-circle view" style="background:#dcfce7;color:#16a34a;" onclick="paySalary(${item.id}, '${item.name}', ${item.current_salary})" title="Pay Salary Now">
                        <i class="fas fa-money-bill-wave"></i>
                    </button>` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

window.openUpdateSalaryModal = function (id, name, currentSalary) {
    document.getElementById('targetStaffSalaryId').value = id;
    document.getElementById('targetStaffSalaryName').textContent = name;
    document.getElementById('newBaseSalaryInput').value = currentSalary || 0;
    document.getElementById('updateSalaryModal').classList.add('active');
};

window.submitSalaryUpdate = async function (e) {
    e.preventDefault();
    const staffId = document.getElementById('targetStaffSalaryId').value;
    const baseSalary = document.getElementById('newBaseSalaryInput').value;

    try {
        const response = await fetch(API + '/admin/salary/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ staff_id: staffId, base_salary: baseSalary })
        });

        const data = await response.json();
        if (response.ok) {
            showToast('Salary updated successfully!', 'success');
            const modal = document.getElementById('updateSalaryModal');
            if (modal) modal.classList.remove('active');
            loadSalaryManagementPage();
        } else {
            showToast('Error: ' + data.error, 'error');
        }
    } catch (e) {
        showToast('Network error updating salary.', 'error');
    }
};

// Pay a single staff salary
window.paySalary = function (staffId, staffName, amount) {
    showConfirm({
        title: '💰 Pay Salary',
        message: `Credit <strong>₹${amount.toLocaleString('en-IN')}</strong> salary to <strong>${staffName}</strong>?<br><small style="color:#6b7280;">This will be deducted from the Loan Liquidity Fund and credited directly to their bank account.</small>`,
        onConfirm: async () => {
            try {
                const res = await fetch(API + '/admin/salary/pay', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ staff_id: staffId, amount })
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    showToast(data.message, 'success');
                    loadSalaryManagementPage();
                } else {
                    showToast(data.error || 'Failed to pay salary', 'error');
                }
            } catch (e) {
                showToast('Network error paying salary', 'error');
            }
        }
    });
};

// Pay all salaries at once
window.payAllSalaries = function () {
    showConfirm({
        title: '💰 Pay All Salaries',
        message: 'Disburse salaries for <strong>ALL active staff</strong> based on their attendance this month?<br><small style="color:#6b7280;">Total amount will be deducted from the Loan Liquidity Fund and credited to each staff\'s bank account.</small>',
        warning: '⚠ This will process all pending salaries in one batch.',
        onConfirm: async () => {
            showToast('Processing bulk salary payment...', 'info');
            try {
                const res = await fetch(API + '/admin/salary/pay-all', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: '{}'
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    let msg = data.message;
                    if (data.skipped && data.skipped.length > 0) {
                        msg += ` (${data.skipped.length} skipped — no bank account)`;
                    }
                    showToast(msg, 'success');
                    loadSalaryManagementPage();
                } else {
                    showToast(data.error || 'Failed to pay salaries', 'error');
                }
            } catch (e) {
                showToast('Network error processing salaries', 'error');
            }
        }
    });
};

document.getElementById('salarySearch')?.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const rows = document.querySelectorAll('#adminSalaryTable tr');
    rows.forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(term) ? '' : 'none';
    });
});



// Attendance Tracking Logic
async function loadAttendanceTrackingPage() {
    console.log('DEBUG: loadAttendanceTrackingPage called');
    const tableBody = document.getElementById('adminAttendanceTable');
    if (!tableBody) {
        console.warn('DEBUG: adminAttendanceTable element not found');
        return;
    }

    try {
        const dateFilter = document.getElementById('attendanceDateFilter')?.value;
        const searchQuery = document.getElementById('attendanceSearch')?.value;

        let url = API + '/admin/attendance/tracking';
        console.log('DEBUG: Fetching from URL:', url);
        const params = new URLSearchParams();
        if (dateFilter) params.append('date', dateFilter);
        if (searchQuery) params.append('search', searchQuery);
        if (params.toString()) url += '?' + params.toString();

        const r = await fetch(url, { credentials: 'include' });
        if (!r.ok) {
            throw new Error(`HTTP error! status: ${r.status}`);
        }
        const data = await r.json();

        if (data.success) {
            renderAttendanceTable(data.records);
            updateAttendanceStats(data.stats);
        } else {
            console.error('API Error:', data.error);
            tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:red;">Error: ${data.error || 'Failed to load attendance'}</td></tr>`;
        }
    } catch (e) {
        console.error('Error loading attendance tracking:', e);
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:red;">Error loading attendance data: ${e.message}</td></tr>`;
    }
}

function renderAttendanceTable(records) {
    const tableBody = document.getElementById('adminAttendanceTable');
    if (!tableBody || !records) return;

    if (!records.length) {
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;">No records found for the selected criteria</td></tr>';
        return;
    }

    tableBody.innerHTML = records.map(row => `
        <tr>
            <td class="acc-num-display">${row.staff_code || row.staff_id}</td>
            <td style="font-weight:700;">${row.staff_name}</td>
            <td style="color:var(--text-secondary);font-size:12px;">${new Date(row.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
            <td style="font-family:monospace;font-weight:600;color:var(--primary);">${formatTime(row.clock_in)}</td>
            <td style="font-family:monospace;font-weight:600;color:var(--text-secondary);">${row.clock_out ? formatTime(row.clock_out) : '<span style="color:#f59e0b;">Ongoing</span>'}</td>
            <td><strong style="color:var(--primary);">${row.total_hours ? row.total_hours.toFixed(2) + 'h' : '--'}</strong></td>
            <td><span class="status-badge ${row.status === 'present' || !row.status ? 'success' : 'warning'}">${(row.status || 'present').toUpperCase()}</span></td>
        </tr>
    `).join('');
}

function updateAttendanceStats(stats) {
    if (!stats) return;

    const elements = {
        present: document.getElementById('statTodayPresent'),
        total: document.getElementById('statTotalStaff'),
        avg: document.getElementById('statAvgWorkingHours')
    };

    if (elements.present) elements.present.textContent = stats.today_present ?? '0';
    if (elements.total) elements.total.textContent = stats.total_staff ?? '0';
    if (elements.avg) elements.avg.textContent = (stats.avg_hours || 0).toFixed(1);
}

function formatTime(dateTimeStr) {
    if (!dateTimeStr) return '--:--';
    try {
        const date = new Date(dateTimeStr);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return '--:--';
    }
}

window.exportAttendance = function () {
    showToast('Preparing attendance report for export...', 'info');
    // In a real app, this would trigger a CSV download or PDF generation
    setTimeout(() => {
        showToast('Report generated successfully!', 'success');
    }, 1500);
};

// Add event listeners for filters
document.getElementById('attendanceSearch')?.addEventListener('input', debounce(() => {
    loadAttendanceTrackingPage();
}, 500));

document.getElementById('attendanceDateFilter')?.addEventListener('change', () => {
    loadAttendanceTrackingPage();
});

function debounce(func, wait) {
    let timeout;
    return function () {
        const context = this, args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}
// Face Authentication Status Loader
async function loadFaceAuthStatus() {
    try {
        const response = await fetch(API + '/face/status', {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to load face auth status');
        }

        const data = await response.json();
        displayFaceAuthStatus(data);

    } catch (error) {
        console.error('Error loading face auth status:', error);
        displayFaceAuthStatus({ enabled: false, error: true });
    }
}

function displayFaceAuthStatus(data) {
    const statusText = document.getElementById('faceStatusText');
    const actionButtons = document.getElementById('faceActionButtons');

    if (!statusText || !actionButtons) return;

    if (data.error) {
        statusText.innerHTML = `
            <span class="face-status-badge inactive">
                <i class="fas fa-times-circle"></i> Status Unknown
            </span>
        `;
        actionButtons.innerHTML = '';
        return;
    }

    if (data.enabled) {
        statusText.innerHTML = `
            <span class="face-status-badge active">
                <i class="fas fa-check-circle"></i> Active
            </span>
            <br>
            <small style="color: #6b7280; margin-top: 4px; display: inline-block;">
                Registered on ${data.registered_date || 'Unknown date'}
            </small>
        `;

        actionButtons.innerHTML = `
            <button class="btn-face-action test" onclick="testFaceLogin()">
                <i class="fas fa-vial"></i> Test Login
            </button>
            <button class="btn-face-action delete" onclick="deleteFaceData()">
                <i class="fas fa-trash"></i> Remove
            </button>
        `;
    } else {
        statusText.innerHTML = `
            <span class="face-status-badge inactive">
                <i class="fas fa-times-circle"></i> Not Registered
            </span>
            <br>
            <small style="color: #6b7280; margin-top: 4px; display: inline-block;">
                Enable face login for quick access
            </small>
        `;

        actionButtons.innerHTML = `
            <button class="btn-face-action register" onclick="openFaceRegistration()">
                <i class="fas fa-user-plus"></i> Register Face
            </button>
        `;
    }
}





// Load face auth status when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(loadFaceAuthStatus, 1000);
    });
} else {
    setTimeout(loadFaceAuthStatus, 1000);
}

// Close modal when clicking outside
document.addEventListener('click', function (e) {
    const modal = document.getElementById('addStaffModal');
    if (modal && e.target === modal) closeAddStaffModal();
});

async function submitAddStaff(event) {
    event.preventDefault();
    const btn = document.getElementById('addStaffBtn');
    const errBox = document.getElementById('staffFormError');

    const payload = {
        name: document.getElementById('staffName').value.trim(),
        email: document.getElementById('staffEmail').value.trim(),
        phone: document.getElementById('staffPhone').value.trim(),
        department: document.getElementById('staffDepartment').value,
        position: document.getElementById('staffPosition').value,
        password: document.getElementById('staffPassword').value
    };

    // Clear previous error
    errBox.style.display = 'none';
    errBox.textContent = '';

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';

    try {
        const response = await fetch(API + '/admin/staff', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok && data.success) {
            closeAddStaffModal();
            showToast(`Staff "${payload.name}" added! Staff ID: ${data.staff_id}`, 'success');
            if (typeof loadStaffPage === 'function') loadStaffPage();
        } else {
            errBox.textContent = data.error || 'Failed to add staff. Please try again.';
            errBox.style.display = 'block';
        }
    } catch (e) {
        errBox.textContent = 'Connection error. Please check the backend is running.';
        errBox.style.display = 'block';
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-user-plus"></i> Add Staff';
}

// Add Staff Modal Togglers
function showAddStaffModal() {
    const modal = document.getElementById('addStaffModal');
    if (modal) {
        const form = document.getElementById('addStaffForm');
        if (form) form.reset();
        const err = document.getElementById('staffFormError');
        if (err) { err.style.display = 'none'; err.textContent = ''; }
        modal.classList.add('active');
    }
}

function closeAddStaffModal() {
    const modal = document.getElementById('addStaffModal');
    if (modal) {
        modal.classList.remove('active');
    }
}
function showNotifications() {
    showModal('notificationsModal');
}

// ==========================================
// NOTIFICATIONS
// ==========================================

function showSendNotificationModal() {
    showModal('sendNotificationModal');
}

async function submitSendNotification(e) {
    e.preventDefault();
    const btn = document.getElementById('sendNotifSubmitBtn');
    if (btn) {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
        btn.disabled = true;
    }

    const data = {
        user_id: document.getElementById('notifUserId').value.trim(),
        title: document.getElementById('notifTitle').value.trim(),
        message: document.getElementById('notifMessage').value.trim(),
        type: document.getElementById('notifType').value
    };

    try {
        const response = await fetch(API + '/staff/notifications/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            credentials: 'include'
        });
        const result = await response.json();

        if (response.ok && result.success) {
            showToast('Notification sent successfully!', 'success');
            closeModal('sendNotificationModal');
            e.target.reset();
        } else {
            showToast(result.error || 'Failed to send notification', 'error');
        }
    } catch (err) {
        showToast('Network error occurred', 'error');
    } finally {
        if (btn) {
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send';
            btn.disabled = false;
        }
    }
}
// Load Accounts Page
async function loadAccountsPage() {
    const tbody = document.getElementById('accountsTable');
    if (!tbody) return;

    try {
        const response = await fetch(API + '/admin/accounts', { credentials: 'include' });
        if (response.ok) {
            const data = await response.json();
            renderAccountsTable(data.accounts || []);
        } else {
            renderAccountsTable([]);
        }
    } catch (e) {
        console.error('Error loading accounts:', e);
        renderAccountsTable([]);
    }
}

function renderAccountsTable(accounts) {
    const tbody = document.getElementById('accountsTable');
    if (!tbody) return;
    if (!accounts.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">No accounts found</td></tr>';
        return;
    }
    tbody.innerHTML = accounts.map(acc => `
        <tr>
            <td class="acc-num-display">#${acc.id}</td>
            <td class="clickable-cell" onclick="viewUserActivity(${acc.user_id}, '${(acc.user_name || '').replace(/'/g, "")}')">
                <div style="font-weight:700;">${acc.user_name || '—'}</div>
            </td>
            <td class="acc-num-display">${acc.account_number}</td>
            <td><span class="status-badge" style="background:rgba(128,0,0,0.05);color:var(--text-primary);border:1px solid var(--border-color);">${acc.account_type.toUpperCase()}</span></td>
            <td><strong style="font-weight:800;">₹${(acc.balance || 0).toLocaleString('en-IN')}</strong></td>
            <td><span class="status-badge ${acc.status === 'active' ? 'success' : 'danger'}">${acc.status.toUpperCase()}</span></td>
            <td>
                <div style="display:flex;gap:8px;">
                    <button class="action-btn-circle delete" onclick="deleteAccount(${acc.id}, '${acc.account_number}')" title="Delete Account">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Load Loans Page
// =============================================
// LOAN LIQUIDITY FUND PAGE
// =============================================
async function loadLiquidityPage() {
    try {
        const r = await fetch(API + '/admin/liquidity-fund', { credentials: 'include' });
        if (!r.ok) throw new Error('Failed to load');
        const data = await r.json();

        // Update stat cards
        const fmt = n => n >= 100000 ? `₹${(n / 100000).toFixed(2)}L` : `₹${Number(n).toLocaleString('en-IN')}`;
        const el = id => document.getElementById(id);
        if (el('liqFundBalance')) el('liqFundBalance').textContent = fmt(data.fund_balance || 0);
        if (el('liqTotalPaid')) el('liqTotalPaid').textContent = data.closed_count || 0;
        if (el('liqActiveLoans')) el('liqActiveLoans').textContent = data.active_count || 0;
        if (el('liqOverdueLoans')) el('liqOverdueLoans').textContent = data.overdue_count || 0;

        // Render loans table
        const container = el('liqLoansList');
        const loans = data.loans || [];
        if (!loans.length) {
            container.innerHTML = '<p style="text-align:center;padding:2rem;color:#6b7280;">No loan data available.</p>';
            return;
        }

        container.innerHTML = `
            <div class="premium-table-wrapper">
                <table class="premium-table">
                    <thead>
                        <tr>
                            <th>Customer</th>
                            <th>Loan Type</th>
                            <th>Loan Amount</th>
                            <th>Outstanding</th>
                            <th>Penalty</th>
                            <th>Status</th>
                            <th>Date Applied</th>
                            <th style="text-align:center;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${loans.map(l => `
                            <tr>
                                <td class="clickable-cell" onclick="viewUserActivity(${l.user_id}, '${(l.user_name || '').replace(/'/g, "")}')">
                                    <div style="font-weight:700;">${l.user_name || '—'}</div>
                                    <div style="font-size:11px;color:var(--text-secondary);">${l.user_email || ''}</div>
                                </td>
                                <td>${l.loan_type || '—'}</td>
                                <td style="font-weight:700;">₹${Number(l.loan_amount || 0).toLocaleString('en-IN')}</td>
                                <td style="font-weight:800;color:${l.outstanding_amount > 0 ? '#ef4444' : '#10b981'};">
                                    ₹${Number(l.outstanding_amount || 0).toLocaleString('en-IN')}
                                </td>
                                <td style="color:${l.penalty_amount > 0 ? '#f59e0b' : 'var(--text-secondary)'};">
                                    ${l.penalty_amount > 0 ? '₹' + Number(l.penalty_amount).toLocaleString('en-IN') : '—'}
                                </td>
                                <td>
                                    <span class="status-badge ${l.status === 'closed' ? 'success' : l.status === 'approved' ? 'warning' : 'danger'}">
                                        ${l.status === 'closed' ? 'PAID OFF' : l.status.toUpperCase()}
                                    </span>
                                </td>
                                <td style="color:var(--text-secondary);font-size:12px;">${new Date(l.application_date).toLocaleDateString('en-IN')}</td>
                                <td>
                                    <div style="display:flex;gap:8px;justify-content:center;">
                                        ${l.status === 'closed' ?
                `<button class="action-btn-circle view" onclick="resendClosureLetter(${l.id})" title="Re-send closure letter">
                                                <i class="fas fa-envelope"></i>
                                            </button>` :
                `<button class="action-btn-circle edit" style="background:#fffbeb;color:#f59e0b;" onclick="sendLoanReminder(${l.id})" title="Send payment reminder">
                                                <i class="fas fa-bell"></i>
                                            </button>`
            }
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>`;
    } catch (e) {
        const container = document.getElementById('liqLoansList');
        if (container) container.innerHTML = '<p style="text-align:center;padding:2rem;color:#ef4444;">Error loading data.</p>';
        console.error(e);
    }
}

async function applyDailyPenalties() {
    try {
        const r = await fetch(API.replace('/api', '') + '/api/system/update-penalties', {
            method: 'POST', credentials: 'include'
        });
        const d = await r.json();
        showToast(d.success ? `Penalties applied to ${d.penalties_applied} loans.` : d.error, d.success ? 'success' : 'error');
        loadLiquidityPage();
    } catch (e) { showToast('Error applying penalties', 'error'); }
}

async function resendClosureLetter(loanId) {
    try {
        const r = await fetch(API + `/admin/loans/${loanId}/closure-letter`, {
            method: 'POST', credentials: 'include'
        });
        const d = await r.json();
        showToast(d.success ? 'Closure letter sent!' : d.error, d.success ? 'success' : 'error');
    } catch (e) { showToast('Error sending letter', 'error'); }
}

async function sendLoanReminder(loanId) {
    try {
        const r = await fetch(API + `/admin/loans/${loanId}/reminder`, {
            method: 'POST', credentials: 'include'
        });
        const d = await r.json();
        showToast(d.success ? 'Reminder sent!' : d.error, d.success ? 'success' : 'error');
    } catch (e) { showToast('Error sending reminder', 'error'); }
}

// Load Loans Page (Admin)
async function loadLoansPage() {
    const tbody = document.getElementById('loansTable');
    if (!tbody) return;

    try {
        const response = await fetch(API + '/admin/loans', { credentials: 'include' });
        if (response.ok) {
            const data = await response.json();
            renderLoansTable(data.loans || []);
        } else {
            renderLoansTable([]);
        }
    } catch (e) {
        console.error('Error loading loans:', e);
        renderLoansTable([]);
    }
}

function renderLoansTable(loans) {
    const tbody = document.getElementById('loansTable');
    if (!tbody) return;
    if (!loans.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">No loans found</td></tr>';
        return;
    }
    tbody.innerHTML = loans.map(loan => `
        <tr>
            <td class="acc-num-display">#${loan.id}</td>
            <td class="clickable-cell" onclick="viewUserActivity(${loan.user_id}, '${(loan.user_name || '').replace(/'/g, "")}')">
                <div style="font-weight:700;">${loan.user_name || '—'}</div>
            </td>
            <td><span class="status-badge" style="background:rgba(128,0,0,0.05);color:var(--text-primary);border:1px solid var(--border-color);">${loan.loan_type.toUpperCase()}</span></td>
            <td><strong style="font-weight:800;">₹${(loan.loan_amount || 0).toLocaleString('en-IN')}</strong></td>
            <td>${loan.tenure_months} mo</td>
            <td style="font-family:monospace;font-weight:600;">${loan.interest_rate}%</td>
            <td><span class="status-badge ${loan.status === 'approved' ? 'success' : loan.status === 'pending' ? 'warning' : 'danger'}">${loan.status.toUpperCase()}</span></td>
        </tr>
    `).join('');
}

// Load Reports Page
async function loadReportsPage() {
    const container = document.getElementById('reportsContent');
    if (!container) return;

    container.innerHTML = '<div style="text-align:center;padding:2rem;color:#6b7280;"><i class="fas fa-spinner fa-spin fa-2x"></i><p style="margin-top:10px;">Generating comprehensive reports...</p></div>';

    try {
        const response = await fetch(API + '/admin/reports', { credentials: 'include' });
        if (response.ok) {
            const data = await response.json();
            renderReports(data);
        } else {
            container.innerHTML = '<p style="color:#ef4444;text-align:center;padding:2rem;">Failed to load system reports.</p>';
        }
    } catch (e) {
        console.error('Error loading reports:', e);
        container.innerHTML = '<p style="color:#ef4444;text-align:center;padding:2rem;">Network error while fetching reports.</p>';
    }
}

function renderReports(data) {
    const container = document.getElementById('reportsContent');
    if (!container) return;

    const sections = [
        { title: 'User Distribution', data: data.user_distribution, color: '#800000', icon: 'fa-users' },
        { title: 'Account Types', data: data.account_distribution, color: '#10b981', icon: 'fa-university' },
        { title: 'Loan Status', data: data.loan_status, color: '#f59e0b', icon: 'fa-hand-holding-usd' }
    ];

    container.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:24px;padding:10px;">
            <!-- System Liquidity Card -->
            <div style="grid-column: 1 / -1; background: linear-gradient(135deg, #800000 0%, #a52a2a 100%); border-radius: 16px; padding: 32px; color: white; display: flex; align-items: center; justify-content: space-between;">
                <div>
                    <h4 style="margin: 0; opacity: 0.9; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Total System Liquidity</h4>
                    <p style="margin: 8px 0 0; font-size: 36px; font-weight: 800;">₹${(data.total_liquidity || 0).toLocaleString('en-IN')}</p>
                </div>
                <div style="font-size: 48px; opacity: 0.3;">
                    <i class="fas fa-vault"></i>
                </div>
            </div>

            ${sections.map(section => `
                <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 16px; padding: 24px; box-shadow: var(--shadow-sm);">
                    <div style="display:flex; align-items:center; margin-bottom: 20px;">
                        <div style="width: 40px; height: 40px; border-radius: 10px; background: ${section.color}20; color: ${section.color}; display: flex; align-items: center; justify-content: center; margin-right: 12px;">
                            <i class="fas ${section.icon}"></i>
                        </div>
                        <h4 style="margin: 0; font-size: 16px; font-weight: 700; color: var(--text-primary);">${section.title}</h4>
                    </div>
                    ${Object.entries(section.data || {}).map(([key, val]) => `
                        <div style="display:flex; justify-content:space-between; align-items:center; padding: 8px 0; border-bottom: 1px solid var(--border-color);">
                            <span style="color: var(--text-secondary); font-size: 14px; text-transform: capitalize;">${key}</span>
                            <span style="font-weight: 700; color: var(--text-primary);">${val}</span>
                        </div>
                    `).join('') || '<p style="color:var(--text-secondary); font-size: 14px;">No data available</p>'}
                </div>
            `).join('')}

            <!-- Trend Indicator -->
            <div style="grid-column: 1 / -1; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 16px; padding: 24px;">
                <h4 style="margin: 0 0 16px; font-size: 16px; font-weight: 700;">Recent Transaction Activity (Last 30 Days)</h4>
                <div style="display:flex; flex-wrap: wrap; gap: 8px;">
                    ${data.transaction_trends && data.transaction_trends.length > 0 ?
            data.transaction_trends.map(t => `
                            <div style="flex: 1; min-width: 60px; background: var(--bg-light); padding: 12px; border-radius: 8px; text-align: center; border: 1px solid var(--border-color);">
                                <p style="margin: 0; font-size: 10px; color: var(--text-secondary);">${t.t_date}</p>
                                <p style="margin: 4px 0 0; font-size: 13px; font-weight: 700; color: var(--text-primary);">₹${(Math.round(t.total_amount / 1000)).toLocaleString()}k</p>
                            </div>
                        `).join('') : '<p style="color:var(--text-secondary);">No recent transaction trends available.</p>'
        }
                </div>
            </div>

            <!-- Export Reports Action Area -->
            <div style="grid-column: 1 / -1; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 16px; padding: 24px; margin-top: 10px;">
                <h4 style="margin: 0 0 16px; font-size: 16px; font-weight: 700;">Data Export</h4>
                <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 20px;">Download comprehensive system records in CSV format.</p>
                <div style="display: flex; gap: 16px; flex-wrap: wrap;">
                    <button onclick="downloadAdminReport('users')" class="btn btn-primary" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <i class="fas fa-file-csv"></i> Download Users
                    </button>
                    <button onclick="downloadAdminReport('transactions')" class="btn btn-primary" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; background: #10b981; border-color: #10b981;">
                        <i class="fas fa-file-invoice-dollar"></i> Download Transactions
                    </button>
                    <button onclick="downloadAdminReport('summary')" class="btn btn-primary" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; background: #800000; border-color: #800000;">
                        <i class="fas fa-chart-line"></i> Monthly/Yearly Summary
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Client-side trigger for CSV download ensuring session cookies are sent
function downloadAdminReport(type) {
    // We can't easily rely on fetch for a seamless file download prompt directly without Object URLs.
    // The most robust way for an API endpoint reliant on cookies (like ours) is to use fetch,
    // get the blob, and create a temporary anchor element.
    const btn = event.currentTarget.querySelector('i');
    const originalClass = btn.className;
    btn.className = 'fas fa-spinner fa-spin';

    fetch(API + '/admin/reports/download?type=' + type, { credentials: 'include' })
        .then(res => {
            if (!res.ok) throw new Error('Download failed');
            return res.blob();
        })
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `${type}_report.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        })
        .catch(err => {
            console.error(err);
            showToast('Failed to generate report. Please try again.', 'error');
        })
        .finally(() => {
            btn.className = originalClass;
        });
}

// Load Audit Page
async function loadAuditPage() {
    const container = document.getElementById('auditLogs');
    if (!container) return;

    container.innerHTML = '<div style="text-align:center;padding:2rem;"><i class="fas fa-spinner fa-spin"></i></div>';

    try {
        const response = await fetch(API + '/admin/audit', { credentials: 'include' });
        if (response.ok) {
            const data = await response.json();
            renderAuditLogs(data.logs || []);
        }
    } catch (e) {
        console.error('Error loading audit logs:', e);
    }
}

function renderAuditLogs(logs) {
    const container = document.getElementById('auditLogs');
    if (!container) return;

    if (!logs.length) {
        container.innerHTML = '<p style="text-align:center;padding:2rem;color:#6b7280;">No audit logs found.</p>';
        return;
    }

    container.innerHTML = `
        <div class="premium-table-wrapper">
            <table class="premium-table">
                <thead>
                    <tr>
                        <th>User</th>
                        <th>Action</th>
                        <th>Details</th>
                        <th>IP Address</th>
                        <th>Timestamp</th>
                    </tr>
                </thead>
                <tbody>
                    ${logs.map(log => `
                        <tr>
                            <td>
                                <div style="font-weight:700;">${log.user_name || 'System'}</div>
                                <div style="font-size:11px;color:var(--text-secondary);">${log.user_type.toUpperCase()}</div>
                            </td>
                            <td><span class="status-badge" style="background:rgba(128,0,0,0.05);color:var(--text-primary);border:1px solid var(--border-color);">${log.action.toUpperCase()}</span></td>
                            <td style="max-width:300px;white-space:normal;font-size:13px;color:var(--text-secondary);line-height:1.4;">${log.details}</td>
                            <td style="color:var(--text-secondary);font-family:monospace;font-size:12px;">${log.ip_address}</td>
                            <td style="color:var(--text-secondary);font-size:12px;">${new Date(log.timestamp).toLocaleString('en-IN')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// Load Settings Page
async function loadSettingsPage() {
    const container = document.getElementById('settingsContent');
    if (!container) return;

    try {
        const response = await fetch(API + '/admin/settings', { credentials: 'include' });
        if (response.ok) {
            const settings = await response.json();
            renderSettingsForm(settings);
        }
    } catch (e) {
        console.error('Error loading settings:', e);
    }
}

function renderSettingsForm(settings) {
    const container = document.getElementById('settingsContent');
    if (!container) return;

    container.innerHTML = `
        <form id="adminSettingsForm" onsubmit="saveSettings(event)" style="padding:20px;">
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 24px;">
                <div class="form-group">
                    <label style="display:block; margin-bottom: 8px; font-weight: 600;">Bank Name</label>
                    <input type="text" id="settingBankName" class="form-control" value="${settings.bankName || 'Smart Bank'}" style="width:100%; border:1px solid var(--border-color); border-radius:8px; padding:10px;">
                </div>
                <div class="form-group">
                    <label style="display:block; margin-bottom: 8px; font-weight: 600;">Daily Transfer Limit (₹)</label>
                    <input type="number" id="settingTransferLimit" class="form-control" value="${settings.dailyTransferLimit || 100000}" style="width:100%; border:1px solid var(--border-color); border-radius:8px; padding:10px;">
                </div>
                <div class="form-group">
                    <label style="display:block; margin-bottom: 8px; font-weight: 600;">Standard Loan Interest Rate (%)</label>
                    <input type="number" step="0.1" id="settingLoanRate" class="form-control" value="${settings.loanInterestRate || 12.5}" style="width:100%; border:1px solid var(--border-color); border-radius:8px; padding:10px;">
                </div>
                <div class="form-group" style="display:flex; align-items:center; gap: 12px; padding-top: 30px;">
                    <input type="checkbox" id="settingMaintenance" ${settings.maintenanceMode ? 'checked' : ''} style="width:20px; height:20px;">
                    <label style="font-weight: 600;">Maintenance Mode</label>
                </div>
                <div class="form-group" style="display:flex; align-items:center; gap: 12px; padding-top: 5px;">
                    <input type="checkbox" id="settingSignups" ${settings.allowNewSignups ? 'checked' : ''} style="width:20px; height:20px;">
                    <label style="font-weight: 600;">Allow New Signups</label>
                </div>

                <div class="form-group" style="grid-column: span 2;">
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: var(--bg-light); border-radius: 8px; border: 1px solid var(--border-color);">
                        <div>
                            <strong style="color: var(--primary-blue);"><i class="fas fa-face-smile"></i> Face Authentication</strong>
                            <p style="margin: 4px 0 0; font-size: 13px; color: var(--text-secondary);">Enable biometric login for your admin account.</p>
                        </div>
                        <div id="faceAuthStatusContainer" style="display: flex; align-items: center; gap: 12px;">
                            <span id="faceStatusText" style="padding: 6px 12px; background: #e5e7eb; color: #374151; border-radius: 20px; font-size: 12px; font-weight: bold;">Checking...</span>
                            <div id="faceActionButtons"></div>
                        </div>
                    </div>
                </div>
            </div>
            <div style="margin-top: 32px; border-top: 1px solid var(--border-color); padding-top: 24px; display:flex; justify-content:flex-end;">
                <button type="submit" class="btn btn-primary">Save System Settings</button>
            </div>
        </form>
    `;

    // Trigger face status check
    if (typeof loadFaceAuthStatus === 'function') {
        setTimeout(loadFaceAuthStatus, 300);
    }
}

async function saveSettings(e) {
    e.preventDefault();
    const settings = {
        bankName: document.getElementById('settingBankName').value,
        dailyTransferLimit: parseInt(document.getElementById('settingTransferLimit').value),
        loanInterestRate: parseFloat(document.getElementById('settingLoanRate').value),
        maintenanceMode: document.getElementById('settingMaintenance').checked,
        allowNewSignups: document.getElementById('settingSignups').checked
    };

    try {
        const response = await fetch(API + '/admin/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings),
            credentials: 'include'
        });
        if (response.ok) {
            showToast('Settings saved successfully! ✅', 'success');
            loadSettingsPage();
        }
    } catch (e) {
        console.error('Error saving settings:', e);
    }
}

// Backup Logic
function loadBackupPage() {
    const container = document.getElementById('backupContent');
    if (!container) return;

    container.innerHTML = `
        <div style="padding: 40px; text-align: center;">
            <div style="width: 80px; height: 80px; border-radius: 50%; background: rgba(128,0,0,0.1); color: #800000; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; font-size: 32px;">
                <i class="fas fa-database"></i>
            </div>
            <h3 style="margin: 0 0 12px; color: var(--text-primary);">System Backup</h3>
            <p style="color: var(--text-secondary); max-width: 400px; margin: 0 auto 32px;">Create a complete snapshot of the database including all users, transactions, and system logs. Backups are stored securely in the server environment.</p>
            <button onclick="createBackup()" id="backupBtn" class="btn btn-primary btn-lg" style="padding: 12px 32px;">
                <i class="fas fa-cloud-upload-alt"></i> Create Manual Backup
            </button>
            <div id="backupStatus" style="margin-top: 24px;"></div>
        </div>
    `;
}

async function createBackup() {
    const btn = document.getElementById('backupBtn');
    const status = document.getElementById('backupStatus');

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Backup...';

    try {
        const response = await fetch(API + '/admin/backup', {
            method: 'POST',
            credentials: 'include'
        });
        const result = await response.json();

        if (response.ok) {
            status.innerHTML = `<div style="padding: 16px; background: #ecfdf5; color: #065f46; border-radius: 8px; display:inline-block;">
                <i class="fas fa-check-circle"></i> Backup created: <strong>${result.filename}</strong>
            </div>`;
        } else {
            status.innerHTML = `<div style="padding: 16px; background: #fef2f2; color: #991b1b; border-radius: 8px; display:inline-block;">
                Error: ${result.error}
            </div>`;
        }
    } catch (e) {
        console.error('Backup error:', e);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Create Manual Backup';
    }
}

// Load Transactions Page
async function loadTransactionsPage() {
    const container = document.getElementById('allTransactionsList');
    if (!container) return;

    container.innerHTML = '<div style="text-align:center;padding:2rem;"><i class="fas fa-spinner fa-spin"></i></div>';

    try {
        const response = await fetch(API + '/admin/transactions', { credentials: 'include' });
        if (response.ok) {
            const data = await response.json();
            renderTransactionsTable(data.transactions || []);
        } else {
            container.innerHTML = '<p style="color:var(--danger-color);text-align:center;">Failed to load transactions.</p>';
        }
    } catch (e) {
        console.error('Error loading admin transactions:', e);
        container.innerHTML = '<p style="color:var(--danger-color);text-align:center;">Network error.</p>';
    }
}

function renderTransactionsTable(txns) {
    const container = document.getElementById('allTransactionsList');
    if (!container) return;

    if (!txns.length) {
        container.innerHTML = '<p style="text-align:center;padding:2rem;color:var(--text-secondary);">No transactions found in system.</p>';
        return;
    }

    container.innerHTML = `
        <div class="premium-table-wrapper">
            <table class="premium-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>User</th>
                        <th>Account</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Date</th>
                    </tr>
                </thead>
                <tbody>
                    ${txns.map(t => `
                        <tr>
                            <td class="acc-num-display">#${t.id}</td>
                            <td>
                                <div style="font-weight:700;">${t.user_name}</div>
                                <div style="font-size:11px;color:var(--text-secondary);">${t.user_email}</div>
                            </td>
                            <td class="acc-num-display">${t.account_number}</td>
                            <td><span class="status-badge" style="background:rgba(128,0,0,0.05);color:var(--text-primary);border:1px solid var(--border-color);">${t.type.toUpperCase()}</span></td>
                            <td><strong style="color:${t.type.toUpperCase() === 'DEBIT' ? '#ef4444' : '#10b981'};font-weight:800;">₹${(t.amount || 0).toLocaleString('en-IN')}</strong></td>
                            <td><span class="status-badge ${t.status === 'completed' ? 'success' : 'warning'}">${t.status.toUpperCase()}</span></td>
                            <td style="color:var(--text-secondary);font-size:12px;">${new Date(t.transaction_date).toLocaleString('en-IN')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// ==========================================
// ADMIN MANAGEMENT
// ==========================================

async function loadAdminManagementPage() {
    const container = document.getElementById('adminList');
    if (!container) return;

    container.innerHTML = '<div style="text-align:center;padding:2rem;"><i class="fas fa-spinner fa-spin"></i></div>';

    try {
        const response = await fetch(API + '/admin/admins', { credentials: 'include' });
        if (response.ok) {
            const admins = await response.json();
            renderAdminTable(admins);
        } else {
            container.innerHTML = '<p style="color:red;text-align:center;padding:2rem;">Failed to load administrators.</p>';
        }
    } catch (e) {
        console.error('Error loading admins:', e);
        container.innerHTML = '<p style="color:red;text-align:center;padding:2rem;">Network error.</p>';
    }
}

function renderAdminTable(admins) {
    const container = document.getElementById('adminList');
    if (!container) return;

    if (!admins.length) {
        container.innerHTML = '<p style="text-align:center;padding:2rem;color:#6b7280;">No administrators found.</p>';
        return;
    }

    container.innerHTML = `
        <div class="premium-table-wrapper">
            <table class="premium-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Username</th>
                        <th>Email</th>
                        <th>Access Level</th>
                        <th>Status</th>
                        <th style="text-align:center;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${admins.map(admin => `
                        <tr>
                            <td class="acc-num-display">#${admin.id}</td>
                            <td style="font-weight:700;">${admin.name}</td>
                            <td><span class="status-badge" style="background:rgba(128,0,0,0.05);color:var(--text-primary);border:1px solid var(--border-color);">${admin.username.toUpperCase()}</span></td>
                            <td style="font-size:13px;color:var(--text-secondary);">${admin.email}</td>
                            <td>
                                <span class="status-badge" style="background:rgba(128,0,0,0.1);color:#800000;border:1px solid #800000;">${admin.level.toUpperCase()}</span>
                            </td>
                            <td><span class="status-badge ${admin.status === 'active' ? 'success' : 'danger'}">${admin.status.toUpperCase()}</span></td>
                            <td>
                                <div style="display:flex;gap:8px;justify-content:center;">
                                    <button class="action-btn-circle edit" onclick="promoteAdmin(${admin.id}, '${admin.name}', '${admin.level}')" title="Promote/Modify Level">
                                        <i class="fas fa-crown"></i>
                                    </button>
                                    <button class="action-btn-circle delete" onclick="deleteAdmin(${admin.id}, '${admin.name}')" title="Delete Admin">
                                        <i class="fas fa-trash-alt"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function showAddAdminModal() {
    const modal = document.getElementById('addAdminModal');
    if (modal) {
        document.getElementById('addAdminForm').reset();
        modal.classList.add('active');
    }
}

function closeAddAdminModal() {
    const modal = document.getElementById('addAdminModal');
    if (modal) modal.classList.remove('active');
}

async function submitAddAdmin(e) {
    e.preventDefault();
    const payload = {
        name: document.getElementById('adminFullName').value.trim(),
        username: document.getElementById('adminUsername').value.trim(),
        email: document.getElementById('adminEmail').value.trim(),
        password: document.getElementById('adminPassword').value,
        level: document.getElementById('adminLevel').value
    };

    try {
        const response = await fetch(API + '/admin/admins', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (response.ok) {
            showToast('Administrator added successfully! ✅', 'success');
            closeAddAdminModal();
            loadAdminManagementPage();
        } else {
            showToast('Error: ' + (data.error || 'Failed to add admin'), 'error');
        }
    } catch (e) {
        showToast('Network error. Please try again.', 'error');
    }
}

let currentPromoteAdminId = null;

function promoteAdmin(id, name, level) {
    currentPromoteAdminId = id;
    document.getElementById('promoteAdminNameDisplay').textContent = name;
    document.getElementById('promoteAdminLevelSelect').value = level;
    document.getElementById('promoteAdminModal').classList.add('active');
}

function closePromoteAdminModal() {
    document.getElementById('promoteAdminModal').classList.remove('active');
    currentPromoteAdminId = null;
}

async function confirmAdminPromotion() {
    if (!currentPromoteAdminId) return;
    const newLevel = document.getElementById('promoteAdminLevelSelect').value;

    try {
        const response = await fetch(API + `/admin/admins/${currentPromoteAdminId}/promote`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ new_level: newLevel })
        });

        const data = await response.json();
        if (response.ok) {
            showToast('Admin level updated successfully!', 'success');
            closePromoteAdminModal();
            loadAdminManagementPage();
        } else {
            showToast('Error: ' + (data.error || 'Failed to update admin level'), 'error');
        }
    } catch (e) {
        showToast('Network error. Please try again.', 'error');
    }
}

async function deleteAdmin(id, name) {
    showConfirm({
        title: 'Delete Admin Account',
        message: `You are about to delete the admin account for <strong>${name}</strong>.`,
        warning: '⚠ This action cannot be undone.',
        onConfirm: async () => {

            try {
                const response = await fetch(API + `/admin/admins/${id}`, {
                    method: 'DELETE',
                    credentials: 'include'
                });
                const data = await response.json();
                if (response.ok) {
                    showToast('Admin account deleted.', 'success');
                    loadAdminManagementPage();
                } else {
                    showToast('Error: ' + (data.error || 'Failed to delete admin'), 'error');
                }
            } catch (e) {
                showToast('Network error.', 'error');
            }
        }
    });
}

// New User & Account Deletion Functions
async function deleteUser(userId, name) {
    showConfirm({
        title: 'Delete User',
        message: `You are about to permanently delete <strong>${name}</strong> and all their associated data.`,
        warning: '⚠ This will delete all accounts, transactions, and cards. THIS CANNOT BE UNDONE.',
        onConfirm: async () => {

            try {
                const res = await fetch(`${API}/admin/user/${userId}`, {
                    method: 'DELETE',
                    credentials: 'include'
                });
                const data = await res.json();
                if (res.ok) {
                    showToast(data.message || 'User deleted successfully', 'success');
                    loadUsersPage();
                } else {
                    showToast(data.error || 'Failed to delete user', 'error');
                }
            } catch (e) {
                showToast('Network error while deleting user', 'error');
            }
        }
    });
}

async function deleteAccount(accountId, accNum) {
    showConfirm({
        title: 'Delete Account',
        message: `Are you sure you want to delete account <strong>${accNum}</strong>?`,
        warning: '⚠ This will delete all transactions for this account and cannot be undone.',
        onConfirm: async () => {

            try {
                const res = await fetch(`${API}/admin/account/${accountId}`, {
                    method: 'DELETE',
                    credentials: 'include'
                });
                const data = await res.json();
                if (res.ok) {
                    showToast(data.message || 'Account deleted successfully', 'success');
                    loadAccountsPage();
                } else {
                    showToast(data.error || 'Failed to delete account', 'error');
                }
            } catch (e) {
                showToast('Network error while deleting account', 'error');
            }
        }
    });
}


const API = window.SMART_BANK_API_BASE || '/api';
console.log('Admin Dashboard API Base:', API);

// Premium PDF Report Download
function downloadReport(type) {
    if (typeof showToast === 'function') showToast('Generating premium PDF report...', 'info');
    const url = API + '/staff/reports/download/' + type;
    fetch(url, { credentials: 'include' })
        .then(r => {
            if (!r.ok) throw new Error('Failed to generate report');
            return r.blob();
        })
        .then(blob => {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `SmartBank_Premium_Report_${type}_${new Date().toISOString().slice(0,10)}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            if (typeof showToast === 'function') showToast('Report downloaded successfully!', 'success');
        })
        .catch(err => {
            console.error('Report download error:', err);
            if (typeof showToast === 'function') showToast('Failed to download report', 'error');
        });
}

document.addEventListener('DOMContentLoaded', () => {
    // Reparent all modals to body so they aren't affected by dashboard-container blur
    document.querySelectorAll('.modal').forEach(m => document.body.appendChild(m));
});

// Global Map Variables
let _adminMap = null;
let _dashboardMap = null; // Map for the dashboard preview
let _adminMapMarkers = [];
let _adminMapAllData = [];
var _allAgriHubCustomers = []; // Moved to top to avoid initialization errors

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

        // Hash-based routing for direct links (e.g. admindash.html#map)
        const handleHash = () => {
            const hash = window.location.hash.replace('#', '');
            if (hash) {
                showPage(hash);
            }
        };
        window.addEventListener('hashchange', handleHash);
        handleHash(); // Run on initial load

        // Set up real-time polling (every 30 seconds)
        setInterval(() => {
            const dashboardPage = document.getElementById('dashboard');
            if (dashboardPage && dashboardPage.classList.contains('active')) {
                loadDashboardData(true);
            }
            // Auto-refresh full map if active
            const mapPage = document.getElementById('map');
            if (mapPage && mapPage.classList.contains('active')) {
                loadMapPage();
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
        const loginUrl = (window.SmartBankDeviceDetector && window.SmartBankDeviceDetector.getLoginUrl) ? window.SmartBankDeviceDetector.getLoginUrl() : 'user.html';
        window.location.href = loginUrl;
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
    const safeName = encodeURIComponent(admin.username || 'Admin');
    
    let avatarUrl;
    if (admin.profile_image) {
        avatarUrl = `${API}/admin/profile-image/${admin.profile_image}`;
    } else {
        avatarUrl = `https://ui-avatars.com/api/?name=${safeName}&background=800000&color=fff&rounded=true&bold=true`;
    }

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
async function loadDashboardData(isRefresh = false) {
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
                updateDashboardStats(data.stats, data.loan_stats);
            } else {
                console.warn('Backend returned success but no stats object:', data);
            }
            loadRecentUsers(data.recentUsers || []);
            loadSystemAlerts(data.systemAlerts || []);
            loadRecentTransactions(data.recentTransactions || []);
            if (typeof initDashboardMap === 'function') initDashboardMap(isRefresh);
            loadLocationsTable();
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
    banner.innerHTML = `<i class="fas fa-exclamation-circle"></i> <span>${escHtml(message)}</span> <button onclick="this.parentElement.remove()" style="margin-left:auto; background:none; border:none; color:#991b1b; cursor:pointer; font-size:18px;">&times;</button>`;
}


// Load Dashboard Data

// Update Dashboard Stats
function updateDashboardStats(stats, loanStats = null) {
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

    if (statTotalUsers) statTotalUsers.textContent = stats.total_users || stats.totalUsers || 0;
    if (statActiveStaff) statActiveStaff.textContent = stats.active_staff || stats.activeStaff || 0;
    if (statTotalDeposits) statTotalDeposits.textContent = `₹${(stats.total_deposits || stats.totalDeposits || 0).toLocaleString('en-IN')}`;
    if (statTodayTransactions) statTodayTransactions.textContent = stats.todaysTransactions || stats.todayTransactions || 0;

    // Formatting for Fund balance (10L style)
    const fmtLakh = n => n >= 100000 ? `₹${(n / 100000).toFixed(2)}L` : `₹${Number(n).toLocaleString('en-IN')}`;

    // Update both home and liquidity page fund balance elements
    const fundVal = fmtLakh(stats.loanLiquidity || stats.liquidityFund || 0);
    const homeFund = document.getElementById('statLiquidityFund');
    const liqFund = document.getElementById('liqFundBalance');
    if (homeFund) homeFund.textContent = fundVal;
    if (liqFund) liqFund.textContent = fundVal;

    // Secondary Loan Stats (if visible on dashboard)
    if (loanStats) {
        const lp = document.getElementById('liqTotalPaid');
        const la = document.getElementById('liqActiveLoans');
        const lo = document.getElementById('liqOverdueLoans');
        if (lp) lp.textContent = loanStats.closed || 0;
        if (la) la.textContent = loanStats.active || 0;
        if (lo) lo.textContent = loanStats.overdue || 0;
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
// Screenshot and Privacy Protection removed
function initSecurity() {
    // Disabled
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
            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || user.username || 'User')}&background=800000&color=fff&rounded=true&bold=true" alt="${escHtml(user.name || user.username)}">
            <div class="list-item-content">
                <h4>${escHtml(user.name || user.username || 'Unknown')}</h4>
                <p>${escHtml(user.email || 'No email')}</p>
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
                <h4>${escHtml(alert.title)}</h4>
                <p>${escHtml(alert.time)}</p>
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
                            <td><strong>${escHtml(txn.id || txn.reference_number || '-')}</strong></td>
                            <td class="clickable-cell">${escHtml(txn.user || txn.user_name || 'Unknown')}</td>
                            <td class="acc-num-display">${escHtml(txn.account || txn.account_number || 'Unknown')}</td>
                            <td>
                                <span class="status-badge ${txn.type.toLowerCase() === 'debit' ? 'danger' : 'success'}">
                                    ${escHtml((txn.type || '').toUpperCase())}
                                </span>
                            </td>
                            <td style="font-weight: 800;" class="${txn.type.toLowerCase() === 'debit' ? 'text-danger' : 'text-success'}">
                                ${txn.type.toLowerCase() === 'debit' ? '-' : '+'}₹${Number(txn.amount || 0).toLocaleString('en-IN')}
                            </td>
                            <td>${new Date(txn.date || txn.transaction_date).toLocaleString('en-IN')}</td>
                            <td><span class="status-badge" style="background:rgba(128,0,0,0.1);color:#800000;border-radius:6px;font-size:10px;">${escHtml(txn.mode || 'CASH')}</span></td>
                            <td>
                                <span class="status-badge ${txn.status || 'success'}">
                                    ${escHtml(((txn.status || 'completed').charAt(0).toUpperCase() + (txn.status || 'completed').slice(1)))}
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
        case 'dashboard': 
             loadDashboardData(); 
             if(typeof loadLocationsTable === 'function') setTimeout(loadLocationsTable, 100);
             break;
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
        case 'map': loadMapPage(); break;
        case 'agri-approvals': loadAgriApprovalsPage(); break;
        case 'agri-loans': loadAgriLoansPage(); break;
        case 'salary-approvals': loadSalaryApprovalsPage(); break;
        case 'business-approvals': loadBusinessApprovalsPage(); break;
        case 'agrihub': loadAgriHubPage(); break;
        case 'upi-management': loadUpiManagementPage(); break;
    }
}

/* ═══════════════════════════════════════════════════════════
   UNIFIED 3D MAP MODULE — MapLibre (Admin View)
   Shows user locations + Branch/ATM locator on one map
   ═══════════════════════════════════════════════════════════ */
let _adminLocatorLocations = [];  // branch/atm data
let _adminMapFilter = 'all';      // 'all', 'users', 'branch', 'atm'

async function loadMapPage() {
    const mapContainer = document.getElementById('mapContainer');
    if (!mapContainer) return;

    if (window._adminMap) {
        setTimeout(() => window._adminMap.resize(), 200);
        _fetchAdminMapData();
        return;
    }

    if (typeof maplibregl === 'undefined') {
        mapContainer.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#94a3b8;font-size:14px;">
            <i class="fas fa-exclamation-triangle" style="margin-right:8px;"></i> MapLibre library not loaded</div>`;
        return;
    }

    try {
        window._adminMapMarkers = [];
        window._adminMap = new maplibregl.Map({
            container: 'mapContainer',
            style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
            center: [79.0882, 21.1458],
            zoom: 4.5,
            pitch: 60,
            bearing: -20,
            antialias: true
        });

        window._adminMap.addControl(new maplibregl.NavigationControl({
            visualizePitch: true,
            showZoom: true,
            showCompass: true
        }), 'top-right');
        window._adminMap.addControl(new maplibregl.FullscreenControl(), 'top-right');

        const geolocate = new maplibregl.GeolocateControl({
            positionOptions: { enableHighAccuracy: true },
            trackUserLocation: false,
            showUserLocation: true
        });
        window._adminMap.addControl(geolocate, 'top-right');

        // Inject animation CSS natively
        if (!document.getElementById('mapPulseStyleAdmin')) {
            const style = document.createElement('style');
            style.id = 'mapPulseStyleAdmin';
            style.textContent = `
                @keyframes ping { 75%, 100% { transform: scale(2.5); opacity: 0; } }
                .maplibregl-popup-content { border-radius: 14px !important; box-shadow: 0 10px 40px rgba(0,0,0,0.15) !important; padding: 15px !important; }
                .maplibregl-popup-tip { display: none; }
            `;
            document.head.appendChild(style);
        }

        window._adminMap.on('load', () => {
            _fetchAdminMapData();
        });

    } catch (err) {
        console.error('MapLibre init error:', err);
        mapContainer.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#ef4444;font-size:14px;">
            <i class="fas fa-exclamation-circle" style="margin-right:8px;"></i> Failed to initialize map</div>`;
    }
}

async function _fetchAdminMapData() {
    try {
        // Fetch user geo data and branch/ATM locations in parallel
        const [geoRes, locRes] = await Promise.all([
            fetch(`${API}/admin/geo-map`, { credentials: 'include' }),
            fetch(`${API}/user/locations`, { credentials: 'include' })
        ]);

        if (geoRes.ok) {
            const data = await geoRes.json();
            window._adminMapAllData = data.markers || [];

            const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
            setText('mapTotalUsers', data.total_users ?? 0);
            setText('mapMappedUsers', data.mapped_users ?? 0);
        } else {
            window._adminMapAllData = [];
        }

        if (locRes.ok) {
            const locData = await locRes.json();
            _adminLocatorLocations = Array.isArray(locData) ? locData : [];
        } else {
            _adminLocatorLocations = [];
        }

        // Update branch/ATM stat counts
        const setText2 = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        setText2('mapBranchCount', _adminLocatorLocations.filter(l => (l.type||'').toLowerCase() === 'branch').length);
        setText2('mapAtmCount', _adminLocatorLocations.filter(l => (l.type||'').toLowerCase() === 'atm').length);

        _renderUnifiedAdminMap();
        renderMapTable(window._adminMapAllData);
    } catch (e) {
        console.error('Error loading map data:', e);
        showToast('Error loading map data', 'error');
    }
}

function _renderUnifiedAdminMap() {
    if (!window._adminMap) return;

    // Clear existing markers
    (window._adminMapMarkers || []).forEach(m => m.remove());
    window._adminMapMarkers = [];

    const bounds = new maplibregl.LngLatBounds();
    let visibleCount = 0;
    const filter = _adminMapFilter;

    // ---------- Render USER Markers ----------
    if (filter === 'all' || filter === 'users') {
        const colorMap = { 'User': '#3b82f6', 'Farmer': '#10b981', 'Buyer': '#8b5cf6', 'Admin': '#f43f5e', 'Default': '#64748b' };
        const statusBadgeColors = { 'active': '#10b981', 'pending': '#f59e0b', 'blocked': '#ef4444', 'suspended': '#ef4444' };

        (window._adminMapAllData || []).forEach(u => {
            if (!u.lat || !u.lng) return;
            visibleCount++;

            const typeColor = colorMap[u.type] || colorMap['Default'];
            const statusColor = statusBadgeColors[(u.status||'').toLowerCase()] || '#6b7280';

            const el = document.createElement('div');
            el.style.cssText = 'position:relative; width:16px; height:16px; cursor:pointer;';
            el.innerHTML = `
                <div style="width:16px;height:16px;background:${typeColor};border-radius:50%;border:2px solid #fff;box-shadow:0 0 8px ${typeColor}80;position:relative;z-index:2;"></div>
                <div style="width:16px;height:16px;background:${typeColor};border-radius:50%;position:absolute;top:0;left:0;animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;opacity:0.3;"></div>
            `;

            const popupHTML = `
                <div style="font-family:'Inter',system-ui,sans-serif; min-width:200px; padding:4px;">
                    <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:4px;">
                        <div style="font-weight:700; font-size:15px; color:#1f2937;">${escHtml(u.name)}</div>
                        <span style="font-size:10px; font-weight:800; padding:2px 6px; border-radius:4px; background:${typeColor}20; color:${typeColor}; border:1px solid ${typeColor}40;">${(u.type||'User').toUpperCase()}</span>
                    </div>
                    <div style="font-size:12px; color:#6b7280; margin-bottom:10px;">@${escHtml(u.username)}</div>
                    <div style="display:grid; gap:6px; margin-bottom:10px;">
                        <div style="font-size:12px; display:flex; align-items:center; gap:8px;">
                            <span style="width:16px; text-align:center;">📍</span>
                            <span>${escHtml(u.city || 'Unknown')}, ${escHtml(u.country || '') || '—'}</span>
                        </div>
                        <div style="font-size:12px; display:flex; align-items:center; gap:8px;">
                            <span style="width:16px; text-align:center;">🌐</span>
                            <code style="background:#f3f4f6; padding:2px 4px; border-radius:3px; font-size:11px;">${escHtml(u.ip || 'Local/Private')}</code>
                        </div>
                        <div style="font-size:12px; display:flex; align-items:center; gap:8px;">
                            <span style="width:16px; text-align:center;">🛡️</span>
                            <span style="color:${statusColor}; font-weight:600;">${(u.status||'').toUpperCase()}</span>
                        </div>
                    </div>
                    <div style="border-top:1px solid #f3f4f6; margin-top:8px; padding-top:8px; display:flex; justify-content:space-between; align-items:center;">
                        <div style="font-size:10px; color:#9ca3af;">Joined ${u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN') : '—'}</div>
                        <div style="font-size:11px; font-weight:700; color:#4b5563;">${u.account_count} Acct(s)</div>
                    </div>
                </div>
            `;

            const popup = new maplibregl.Popup({ offset: 25 }).setHTML(popupHTML);
            const marker = new maplibregl.Marker({ element: el })
                .setLngLat([u.lng, u.lat])
                .setPopup(popup)
                .addTo(window._adminMap);

            bounds.extend([u.lng, u.lat]);
            window._adminMapMarkers.push(marker);
        });
    }

    // ---------- Render BRANCH / ATM Markers ----------
    if (filter === 'all' || filter === 'branch' || filter === 'atm') {
        const locsToRender = filter === 'all'
            ? _adminLocatorLocations
            : _adminLocatorLocations.filter(l => (l.type||'').toLowerCase() === filter);

        locsToRender.forEach(loc => {
            if (!loc.lat || !loc.lng) return;
            visibleCount++;

            const isBranch = (loc.type || '').toLowerCase() === 'branch';
            const color = isBranch ? '#800000' : '#2563eb';
            const iconCls = isBranch ? 'fa-university' : 'fa-credit-card';
            const label = isBranch ? 'Branch' : 'ATM';

            const el = document.createElement('div');
            el.style.cssText = `
                width: 42px; height: 42px; border-radius: 50%;
                background: ${color}; border: 3px solid white;
                display: flex; align-items: center; justify-content: center;
                box-shadow: 0 4px 14px rgba(0,0,0,0.3);
                cursor: pointer; transition: transform 0.2s ease;
            `;
            el.innerHTML = `<i class="fas ${iconCls}" style="color:white; font-size:16px;"></i>`;
            el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.2)'; });
            el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)'; });

            const popup = new maplibregl.Popup({ offset: 30, closeButton: true, maxWidth: '280px' })
                .setHTML(`
                    <div style="font-family:system-ui,-apple-system,sans-serif; padding:4px;">
                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                            <div style="width:32px;height:32px;border-radius:8px;background:${color};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                                <i class="fas ${iconCls}" style="color:white;font-size:13px;"></i>
                            </div>
                            <div>
                                <div style="font-weight:700;font-size:14px;color:#1e293b;">${escHtml(loc.name)}</div>
                                <span style="font-size:11px;color:white;background:${color};padding:2px 8px;border-radius:10px;font-weight:600;">${label}</span>
                            </div>
                        </div>
                        ${loc.photo_url ? `<div style="margin-bottom:8px; border-radius:8px; overflow:hidden;"><img src="${API}/staff/locations/photo/${loc.photo_url}" style="width:100%; height:120px; object-fit:cover; display:block;" alt="Location Photo"></div>` : ''}
                        ${loc.address ? `<div style="font-size:12px;color:#64748b;margin-bottom:4px;"><i class="fas fa-map-marker-alt" style="color:${color};margin-right:4px;"></i>${escHtml(loc.address)}</div>` : ''}
                        ${loc.city ? `<div style="font-size:12px;color:#64748b;"><i class="fas fa-city" style="color:${color};margin-right:4px;"></i>${escHtml(loc.city)}</div>` : ''}
                        <div style="font-size:11px;color:#94a3b8;margin-top:6px;"><i class="fas fa-map-pin" style="margin-right:4px;"></i>${loc.lat}, ${loc.lng}</div>
                        <a href="https://www.google.com/maps?q=${loc.lat},${loc.lng}" target="_blank" rel="noopener"
                           style="display:inline-flex;align-items:center;gap:4px;margin-top:8px;padding:6px 12px;background:${color};color:white;border-radius:8px;font-size:12px;font-weight:600;text-decoration:none;">
                            <i class="fas fa-directions"></i> Get Directions
                        </a>
                    </div>
                `);

            const marker = new maplibregl.Marker({ element: el })
                .setLngLat([loc.lng, loc.lat])
                .setPopup(popup)
                .addTo(window._adminMap);

            bounds.extend([loc.lng, loc.lat]);
            window._adminMapMarkers.push(marker);
        });
    }

    // Update count badge
    const countEl = document.getElementById('adminLocCountText');
    if (countEl) {
        countEl.textContent = visibleCount === 0 ? 'No locations found' : `${visibleCount} location${visibleCount !== 1 ? 's' : ''} found`;
    }

    // Fly to fit bounds
    if (visibleCount === 1) {
        window._adminMap.flyTo({ center: bounds.getCenter(), zoom: 14, pitch: 50, bearing: 0, duration: 1500 });
    } else if (visibleCount > 1) {
        window._adminMap.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 1500, pitch: 45, bearing: -10 });
    }
}

window.adminMapFilterBy = function(type, btn) {
    _adminMapFilter = type;
    document.querySelectorAll('.loc-filter-btn').forEach(b => {
        b.classList.remove('loc-active');
        b.style.background = 'transparent';
        b.style.color = b.style.borderColor;
    });
    if (btn) {
        btn.classList.add('loc-active');
        btn.style.background = btn.style.borderColor;
        btn.style.color = '#fff';
    }
    _renderUnifiedAdminMap();
};

window.flyToMarker = function(lat, lng) {
    if (window._adminMap) {
        window._adminMap.flyTo({
            center: [lng, lat],
            zoom: 17,
            pitch: 60,
            bearing: -20,
            speed: 1.5,
            curve: 1
        });
    }
};

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
                                    <div style="font-weight:700;">${escHtml(a.user_name || '—')}</div>
                                    <div style="font-size:11px;color:var(--text-secondary);">${escHtml(a.user_email || '—')}</div>
                                </td>
                                <td><span class="status-badge" style="background:rgba(59,130,246,0.1);color:#3b82f6;">${escHtml(a.service_type.toUpperCase())}</span></td>
                                <td style="font-weight:600;">${escHtml(a.product_name)}</td>
                                <td style="text-align:right;font-weight:700;">₹${Number(a.amount).toLocaleString('en-IN')}</td>
                                <td>${escHtml(a.tenure || '—')}</td>
                                <td><span class="status-badge ${a.status === 'approved' ? 'success' : a.status === 'pending' ? 'warning' : 'danger'}">${escHtml(a.status.toUpperCase())}</span></td>
                                 <td style="color:var(--text-secondary);font-size:12px;">${a.applied_at ? new Date(a.applied_at).toLocaleDateString('en-IN') : '—'}</td>
                                <td>
                                    <div style="display:flex;gap:6px;justify-content:center;">
                                        ${a.status === 'pending' ? `
                                            <button class="action-btn-circle view" onclick="event.stopPropagation(); handleServiceApplication(${a.id}, 'approve')" title="Approve">
                                                <i class="fas fa-check"></i>
                                            </button>
                                            <button class="action-btn-circle edit" style="background:rgba(59,130,246,0.1);color:#3b82f6;" onclick="event.stopPropagation(); window.currentEditCustomer = { ...a, id: a.user_id, name: a.user_name, email: a.user_email }; showEditCustomerModal();" title="Edit Customer Details">
                                                <i class="fas fa-user-edit"></i>
                                            </button>
                                            <button class="action-btn-circle delete" onclick="event.stopPropagation(); handleServiceApplication(${a.id}, 'reject')" title="Reject">
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
            messageIsHtml: true,
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

// ============== EDIT CUSTOMER (USER) =================
window.openEditCustomerFromList = function(user) {
    window.currentEditCustomer = user;
    if (typeof showEditCustomerModal === 'function') {
        showEditCustomerModal();
    }
};

window.showEditCustomerModal = function () {
    const c = window.currentEditCustomer;
    if (!c) return;

    document.getElementById('editCustomerId').value = c.id;
    document.getElementById('editCustomerName').value = c.name || '';
    document.getElementById('editCustomerEmail').value = c.email || '';
    document.getElementById('editCustomerPhone').value = c.phone || '';
    document.getElementById('editCustomerAddress').value = c.address || '';
    document.getElementById('editCustomerDob').value = c.date_of_birth || '';
    document.getElementById('editCustomerAadhaar').value = c.aadhaar_number || '';
    document.getElementById('editCustomerPan').value = c.pan_number || '';
    document.getElementById('editCustomerStatus').value = c.status || 'active';

    showModal('editCustomerModal');
};

window.submitEditCustomer = async function (event) {
    event.preventDefault();
    const btn = document.getElementById('editCustomerSubmitBtn');
    const id = document.getElementById('editCustomerId').value;

    const payload = {
        name: document.getElementById('editCustomerName').value.trim(),
        email: document.getElementById('editCustomerEmail').value.trim(),
        phone: document.getElementById('editCustomerPhone').value.trim(),
        address: document.getElementById('editCustomerAddress').value.trim(),
        date_of_birth: document.getElementById('editCustomerDob').value,
        aadhaar_number: document.getElementById('editCustomerAadhaar').value.trim(),
        pan_number: document.getElementById('editCustomerPan').value.trim(),
        status: document.getElementById('editCustomerStatus').value
    };

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        const res = await fetch(API + `/staff/customers/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (res.ok && data.success !== false) {
            closeModal('editCustomerModal');
            showToast('User updated successfully!', 'success');
            loadUsersPage();
        } else {
            showToast(data.error || 'Failed to update user.', 'error');
        }
    } catch (e) {
        showToast('Network error. Please try again.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
    }
};

// Load Users Page
async function loadUsersPage() {
    const tbody = document.getElementById('usersTable');
    if (!tbody) return;

    try {
        const response = await fetch(API + '/admin/users', { credentials: 'include' });
        if (response.ok) {
            const users = await response.json();
            // Store globally so the helper can find them if needed
            window.allAdminUsersRaw = users;
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
        window.allAdminUsersRaw = users;
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
    tbody.innerHTML = users.map((user, idx) => `
        <tr>
            <td class="acc-num-display">#${escHtml(user.id)}</td>
            <td class="clickable-cell" onclick="event.stopPropagation(); viewUserActivity('${escHtml(user.id)}', '${escHtml(user.name || user.username || '').replace(/'/g, "\\'")}')">
                <div style="font-weight:700;">${escHtml(user.name)}</div>
                <div style="font-size:12px;color:var(--text-secondary);">@${escHtml(user.username || user.id)}</div>
            </td>
            <td class="clickable-cell" onclick="event.stopPropagation(); viewUserActivity('${escHtml(user.id)}', '${escHtml(user.name || user.username || '').replace(/'/g, "\\'")}')">${escHtml(user.email)}</td>
            <td>${escHtml(user.phone || '—')}</td>
            <td><span class="status-badge" style="background:rgba(128,0,0,0.05);color:var(--text-primary);border:1px solid var(--border-color);">${escHtml(user.account_count || 0)}</span></td>
            <td><strong style="font-weight:800;">₹${(user.total_balance || 0).toLocaleString('en-IN')}</strong></td>
            <td><span class="status-badge ${user.status === 'active' ? 'success' : 'danger'}">${escHtml(user.status)}</span></td>
            <td>
                <div style="display:flex;gap:8px;">
                    <button class="action-btn-circle" style="background:var(--bg-secondary);color:var(--primary-color);" onclick="event.stopPropagation(); openEditCustomerFromList(window.allAdminUsersRaw[${idx}])" title="Edit User">
                        <i class="fas fa-pen"></i>
                    </button>
                    <button class="action-btn-circle ${user.transact_restricted ? 'danger' : 'success'}" onclick="event.stopPropagation(); toggleUserRestriction(${user.id}, ${user.transact_restricted || 0}, '${escHtml(user.name || '').replace(/'/g, "\\'")}')" title="${user.transact_restricted ? 'Unrestrict Transactions' : 'Restrict Transactions'}">
                        <i class="fas ${user.transact_restricted ? 'fa-unlock' : 'fa-lock'}"></i>
                    </button>
                    <button class="action-btn-circle info" onclick="event.stopPropagation(); showPage('transactions')" title="Quick Transaction">
                        <i class="fas fa-exchange-alt"></i>
                    </button>
                    <button class="action-btn-circle view" onclick="event.stopPropagation(); viewUserActivity('${escHtml(user.id)}', '${escHtml(user.name || user.username || '').replace(/'/g, "\\'")}')" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="action-btn-circle delete" onclick="event.stopPropagation(); deleteUser('${escHtml(user.id)}', '${escHtml(user.name || user.username || '').replace(/'/g, "\\'")}')" title="Delete User">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                    <button class="action-btn-circle warning" style="background:rgba(245,158,11,0.1); color:#f59e0b;" onclick="event.stopPropagation(); requestUserKycUpdate('${escHtml(user.id)}', '${escHtml(user.name || '').replace(/'/g, "\\'")}')" title="Request KYC Update">
                        <i class="fas fa-bell"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function toggleUserRestriction(userId, isRestricted, userName) {
    const action = isRestricted ? 'unrestrict' : 'restrict';
    const message = isRestricted
        ? `Are you sure you want to <strong>unrestrict transactions</strong> for ${userName}?`
        : `Are you sure you want to <strong>restrict transactions</strong> for ${userName}? This will prevent them from making any transactions.`;

    showConfirm({
        title: `${action === 'restrict' ? 'Restrict' : 'Unrestrict'} Transactions`,
        message: message,
        icon: action === 'restrict' ? 'fa-lock' : 'fa-unlock',
        confirmText: action === 'restrict' ? 'Restrict Now' : 'Unrestrict Now',
        onConfirm: async () => {
            try {
                const res = await fetch(`${API}/staff/customers/${userId}/toggle-transact-restriction`, {
                    method: 'POST',
                    credentials: 'include'
                });
                const data = await res.json();
                if (res.ok) {
                    showToast(data.message || `User ${userName} transactions ${action}ed successfully!`, 'success');
                    if (document.getElementById('agrihub')?.classList.contains('active')) {
                        loadAgriHubPage();
                    } else {
                        loadUsersPage();
                    }
                } else {
                    showToast(data.error || `Failed to ${action} transactions for ${userName}`, 'error');
                }
            } catch (e) {
                showToast('Network error', 'error');
            }
        }
    });
}

async function requestUserKycUpdate(userId, userName) {
    showConfirm({
        title: 'Request KYC Update',
        message: `Send a formal notification to <strong>${escHtml(userName)}</strong> (UID: #${userId}) requesting a KYC document update?`,
        confirmText: 'Send Request',
        icon: 'fa-bell',
        onConfirm: async () => {
            try {
                const res = await fetch(`${API}/staff/notifications/request-kyc`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: userId })
                });
                const data = await res.json();
                if (res.ok) {
                    showToast(data.message || 'KYC update request sent successfully', 'success');
                } else {
                    showToast(data.error || 'Failed to send request', 'error');
                }
            } catch (e) {
                showToast('Network error while sending request', 'error');
            }
        }
    });
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
        // blur removed
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
        const agriLoan = data.agriculture_loans && data.agriculture_loans[0];
        const hasMapData = (agriLoan && agriLoan.farm_coordinates) || (u.signup_lat && u.signup_lng);

        const activeAccounts = accounts.filter(a => a.status === 'active');

        if (details) details.innerHTML = `
        <!-- Profile Header -->
        <div style="background:linear-gradient(135deg,var(--primary-color),#a52a2a);border-radius:12px;padding:20px;color:white;display:flex;align-items:center;gap:20px;margin-bottom:20px;">
            <div style="width:60px;height:60px;border-radius:50%;background:rgba(255,255,255,0.25);display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:700;color:white;flex-shrink:0;">
                ${escHtml((u.name || 'U').charAt(0).toUpperCase())}
            </div>
            <div style="flex:1;">
                <div style="font-size:20px;font-weight:700;">${escHtml(u.name || 'Unknown')}</div>
                <div style="font-size:13px;opacity:0.85;">@${escHtml(u.username || '—')} &nbsp;|&nbsp; ID #${escHtml(u.id)}</div>
            </div>
            <span style="padding:6px 14px;border-radius:20px;font-size:12px;font-weight:700;background:${u.status === 'active' ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'};color:${u.status === 'active' ? '#6ee7b7' : '#fca5a5'};">
                ${escHtml((u.status || 'unknown').toUpperCase())}
            </span>
        </div>

        <!-- KYC Documents Section -->
        <div style="background:rgba(128,0,0,0.03); border:1px solid rgba(128,0,0,0.1); border-radius:12px; padding:16px; margin-bottom:20px; display:flex; gap:20px; align-items:center;">
            <div style="flex-shrink:0;">
                <img src="${u.profile_image ? `${API}/user/profile-image/${u.profile_image}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || 'U')}&background=800000&color=fff&rounded=true`}" 
                     style="width:80px; height:80px; border-radius:12px; object-fit:cover; border:2px solid white; box-shadow:0 2px 8px rgba(0,0,0,0.1);">
            </div>
            <div style="flex:1;">
                <h4 style="margin:0 0 10px; font-size:14px; font-weight:800; color:#800000; text-transform:uppercase; letter-spacing:0.5px;">
                    <i class="fas fa-id-card" style="margin-right:8px;"></i>Verified KYC Identity
                </h4>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                    <div>
                        <small style="color:var(--text-secondary); display:block; font-size:10px; font-weight:700; text-transform:uppercase; margin-bottom:2px;">Aadhaar Number</small>
                        <strong style="font-size:14px; font-family:monospace;">${escHtml(u.aadhaar_number || 'Not Provided')}</strong>
                    </div>
                    <div>
                        <small style="color:var(--text-secondary); display:block; font-size:10px; font-weight:700; text-transform:uppercase; margin-bottom:2px;">PAN Number</small>
                        <strong style="font-size:14px; font-family:monospace; text-transform:uppercase;">${escHtml(u.pan_number || 'Not Provided')}</strong>
                    </div>
                </div>
            </div>
            <div>
                <span class="status-badge ${u.aadhaar_number && u.pan_number ? 'success' : 'warning'}" style="font-size:10px; padding:4px 10px;">
                    ${u.aadhaar_number && u.pan_number ? 'KYC VERIFIED' : 'KYC PENDING'}
                </span>
            </div>
        </div>

        <!-- Info Grid -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
            <div style="background:var(--bg-light);border-radius:10px;padding:14px;border:1px solid var(--border-color);">
                <div style="font-size:11px;text-transform:uppercase;color:var(--text-secondary);margin-bottom:4px;"><i class="fas fa-envelope" style="margin-right:5px;"></i>Email</div>
                <div style="font-size:14px;font-weight:600;">${escHtml(u.email || '—')}</div>
            </div>
            <div style="background:var(--bg-light);border-radius:10px;padding:14px;border:1px solid var(--border-color);">
                <div style="font-size:11px;text-transform:uppercase;color:var(--text-secondary);margin-bottom:4px;"><i class="fas fa-phone" style="margin-right:5px;"></i>Phone</div>
                <div style="font-size:14px;font-weight:600;">${escHtml(u.phone || '—')}</div>
            </div>
            <div style="background:var(--bg-light);border-radius:10px;padding:14px;border:1px solid var(--border-color);">
                <div style="font-size:11px;text-transform:uppercase;color:var(--text-secondary);margin-bottom:4px;"><i class="fas fa-calendar-alt" style="margin-right:5px;"></i>Date of Birth</div>
                <div style="font-size:14px;font-weight:600;">${escHtml(u.date_of_birth || '—')}</div>
            </div>
            <div style="background:var(--bg-light);border-radius:10px;padding:14px;border:1px solid var(--border-color);">
                <div style="font-size:11px;text-transform:uppercase;color:var(--text-secondary);margin-bottom:4px;"><i class="fas fa-user-plus" style="margin-right:5px;"></i>Member Since</div>
                <div style="font-size:14px;font-weight:600;">${u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN') : '—'}</div>
            </div>
            ${u.address ? `<div style="grid-column:span 2;background:var(--bg-light);border-radius:10px;padding:14px;border:1px solid var(--border-color);">
                <div style="font-size:11px;text-transform:uppercase;color:var(--text-secondary);margin-bottom:4px;"><i class="fas fa-map-marker-alt" style="margin-right:5px;"></i>Address</div>
                <div style="font-size:14px;font-weight:600;">${escHtml(u.address)}</div>
            </div>` : ''}
        </div>

        <!-- Agriculture Land Map -->
        ${hasMapData ? `
        <h4 style="font-size:14px;font-weight:700;margin:0 0 10px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.5px;">
            <i class="fas fa-satellite" style="margin-right:6px;color:var(--success);"></i>Agricultural Land Map
        </h4>
        <div id="activityLandMap" style="height:220px; border-radius:12px; margin-bottom:20px; border:1px solid var(--border-color); overflow:hidden; z-index:1;"></div>
        ` : ''}

        <!-- Active Accounts -->
        <h4 style="font-size:14px;font-weight:700;margin:0 0 10px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.5px;">
            <i class="fas fa-university" style="margin-right:6px;color:var(--primary-color);"></i>Active Accounts (${activeAccounts.length})
        </h4>
        ${activeAccounts.length ? `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;margin-bottom:20px;">
            ${activeAccounts.map(a => `
            <div style="background:linear-gradient(135deg,var(--primary-color),#a52a2a);border-radius:12px;padding:16px;color:white;">
                <div style="font-size:11px;opacity:0.8;margin-bottom:6px;">${escHtml(a.account_type)} Account</div>
                <div style="font-family:monospace;font-size:13px;margin-bottom:10px;opacity:0.9;">${escHtml(a.account_number)}</div>
                <div style="font-size:20px;font-weight:700;">₹${Number(a.balance).toLocaleString('en-IN')}</div>
                <div style="font-size:10px;opacity:0.75;margin-top:6px;">IFSC: ${escHtml(a.ifsc || '—')} &nbsp;|&nbsp; ${escHtml(a.branch || '—')}</div>
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
                    <div style="font-weight:600;font-size:13px;">${escHtml(c.card_type)} <span style="float:right;font-size:11px;padding:2px 8px;border-radius:10px;background:${c.status === 'active' ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)'};color:${c.status === 'active' ? '#10b981' : '#ef4444'}">${escHtml(c.status)}</span></div>
                    <div style="font-family:monospace;font-size:12px;color:var(--text-secondary);">****${escHtml(String(c.card_number || '0000').slice(-4))} &nbsp;|&nbsp; Exp: ${escHtml(c.expiry_date || '—')}</div>
                </div>`).join('') : '<p style="font-size:13px;color:var(--text-secondary);">No cards.</p>'}
            </div>
            <div>
                <h4 style="font-size:13px;font-weight:700;margin:0 0 8px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.5px;">
                    <i class="fas fa-hand-holding-usd" style="margin-right:5px;"></i>Loans (${loans.length})
                </h4>
                ${loans.length ? loans.map(l => `
                <div style="padding:10px 14px;border-radius:8px;margin-bottom:8px;background:var(--bg-light);border:1px solid var(--border-color);">
                    <div style="font-weight:600;font-size:13px;">${escHtml(l.loan_type)} <span style="float:right;font-size:11px;padding:2px 8px;border-radius:10px;background:rgba(245,158,11,.15);color:#f59e0b;">${escHtml(l.status)}</span></div>
                    <div style="font-weight:700;font-size:14px;color:var(--primary-color);">₹${Number(l.loan_amount || 0).toLocaleString('en-IN')}</div>
                    <div style="font-size:11px;color:var(--text-secondary);">${escHtml(l.tenure_months || 0)} months @ ${escHtml(l.interest_rate || 0)}%</div>
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
                        <td style="padding:10px 12px;">${escHtml(t.description || t.type || '—')}</td>
                        <td style="padding:10px 12px;font-family:monospace;font-size:11px;">${escHtml(t.account_number || '—')}</td>
                        <td style="padding:10px 12px;">${escHtml(t.mode || '—')}</td>
                        <td style="padding:10px 12px;text-align:right;font-weight:700;color:${t.type.toLowerCase() === 'debit' ? '#ef4444' : '#10b981'};">
                            ${t.type.toLowerCase() === 'debit' ? '-' : '+'}₹${Number(t.amount || 0).toLocaleString('en-IN')}
                            <div style="font-size:10px;font-weight:400;color:${t.type.toLowerCase() === 'debit' ? '#fca5a5' : '#6ee7b7'}">${escHtml((t.type || 'unknown').toUpperCase())}</div>
                        </td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </div>` : '<p style="color:var(--text-secondary);">No transactions found.</p>'}

        <!-- Login Location Map -->
        <h4 style="font-size:14px;font-weight:700;margin:20px 0 10px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.5px;">
            <i class="fas fa-map-marked-alt" style="margin-right:6px;color:var(--primary-color);"></i>Login Location
            ${(u.signup_lat || u.lat) ? `<button class="btn btn-primary btn-sm" style="float:right;padding:2px 10px;font-size:11px;" onclick="closeModal('userActivityModal'); showLandMap(null, ${u.signup_lat || u.lat}, ${u.signup_lng || u.lng || 0}, 1, 'Residential', '${escHtml(u.name || '').replace(/'/g, "\\'")}', 0, ${u.geometry ? `'${u.geometry}'` : 'null'})"><i class="fas fa-satellite"></i> View Land Map</button>` : ''}
        </h4>
        <div style="background:var(--bg-light);border-radius:12px;padding:12px;border:1px solid var(--border-color);margin-bottom:20px;">
            <div id="userActivityMap" style="height:220px;width:100%;border-radius:8px;overflow:hidden;box-shadow:inset 0 2px 4px rgba(0,0,0,0.05);background:#f9fafb;"></div>
            <div style="margin-top:10px;font-size:12px;color:var(--text-secondary);display:flex;justify-content:space-between;">
                <span><b>📍 City:</b> ${escHtml(u.signup_city || '—')}</span>
                <span><b>🏳️ Country:</b> ${escHtml(u.signup_country || '—')}</span>
                <span><b>🌐 IP:</b> ${escHtml(u.signup_ip || '—')}</span>
            </div>
        </div>`;

        // NEW: Initialize Agriculture Map
        if (hasMapData) {
            setTimeout(() => {
                const mapEl = document.getElementById('activityLandMap');
                if (!mapEl) return;
                
                let lat, lng, label = "User Location";
                if (agriLoan && agriLoan.farm_coordinates) {
                    const parts = agriLoan.farm_coordinates.split(',');
                    lat = parseFloat(parts[0]);
                    lng = parseFloat(parts[1]);
                    label = `Farm Area: ${agriLoan.land_size_acres || '—'} Acres (${agriLoan.crop_type || 'Agriculture'})`;
                } else {
                    lat = u.signup_lat || u.lat;
                    lng = u.signup_lng || u.lng;
                    label = `Location: ${escHtml(u.signup_city || 'Registered Area')}`;
                }

                if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
                    const actMap = L.map('activityLandMap').setView([lat, lng], 14);
                    L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
                        maxZoom: 20,
                        subdomains:['mt0','mt1','mt2','mt3'],
                        attribution: 'Google Satellite'
                    }).addTo(actMap);

                    L.marker([lat, lng]).addTo(actMap)
                        .bindPopup(`<b>${escHtml(u.name)}</b><br>${label}`)
                        .openPopup();
                    
                    if (agriLoan && agriLoan.geometry) {
                        try {
                            const geo = JSON.parse(agriLoan.geometry);
                            L.geoJSON(geo, { style: { color: '#10b981', weight: 2, fillOpacity: 0.2 } }).addTo(actMap);
                        } catch(e) {}
                    }
                    setTimeout(() => actMap.invalidateSize(), 300);
                }
            }, 500);
        }


        // Initialize individual user map after content is in DOM
        if (u.signup_lat && u.signup_lng) {
            setTimeout(() => {
                try {
                    const mapEl = document.getElementById('userActivityMap');
                    if (!mapEl) return;
                    
                    const userMap = L.map('userActivityMap', {
                        zoomControl: true,
                        attributionControl: false
                    }).setView([u.signup_lat, u.signup_lng], 13);
                    
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(userMap);
                    
                    const color = u.status === 'active' ? '#10b981' : (u.status === 'pending' ? '#f59e0b' : '#ef4444');
                    L.circleMarker([u.signup_lat, u.signup_lng], {
                        radius: 10,
                        fillColor: color,
                        color: '#fff',
                        weight: 2,
                        opacity: 1,
                        fillOpacity: 0.9
                    }).addTo(userMap).bindPopup(`<b>${escHtml(u.name)}</b><br>${escHtml(u.signup_city || '')}, ${escHtml(u.signup_country || '')}`);
                    
                    userMap.invalidateSize();
                } catch (mapErr) {
                    console.error('Error initializing user activity map:', mapErr);
                    const mapEl = document.getElementById('userActivityMap');
                    if (mapEl) mapEl.innerHTML = '<p style="text-align:center;padding:20px;color:var(--text-secondary);font-size:13px;">Map could not be rendered.</p>';
                }
            }, 500);
        } else {
             const mapEl = document.getElementById('userActivityMap');
             if (mapEl) mapEl.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--text-secondary);font-size:13px;"><i class="fas fa-map-slash" style="font-size:24px;margin-bottom:10px;opacity:0.5;"></i>No geographic data available for this user.</div>';
        }
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
                            <td class="acc-num-display">#${escHtml(staff.staff_id)}</td>
                            <td style="font-weight:700;">${escHtml(staff.name)}</td>
                            <td>${escHtml(staff.email)}</td>
                            <td><span class="status-badge" style="background:rgba(128,0,0,0.05);color:#800000;border:1px solid rgba(128,0,0,0.1);">${escHtml(staff.department)}</span></td>
                            <td>${escHtml(staff.position)}</td>
                            <td><span class="status-badge ${staff.status === 'active' ? 'success' : 'danger'}">${escHtml(staff.status)}</span></td>
                            <td>
                                <div style="display:flex;gap:8px;justify-content:center;">
                                    <button onclick="changeDepartment(${staff.id}, '${escHtml(staff.name).replace(/'/g, "\\'")}', '${escHtml(staff.department).replace(/'/g, "\\'")}')" class="action-btn-circle view" title="Change Department">
                                        <i class="fas fa-building"></i>
                                    </button>
                                    <button onclick="promoteStaff(${staff.id}, '${escHtml(staff.name).replace(/'/g, "\\'")}')" class="action-btn-circle edit" style="background:#fef3c7;color:#d97706;" title="Promote to Admin">
                                        <i class="fas fa-crown"></i>
                                    </button>
                                    <button onclick="deleteStaff(${staff.id}, '${escHtml(staff.name).replace(/'/g, "\\'")}')" class="action-btn-circle delete" title="Delete Staff">
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
        messageIsHtml: true,
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
        }
    } catch (e) {
        console.error('Error promoting staff:', e);
        showToast('A network error occurred while trying to promote the staff member.', 'error');
    }
}

async function testEmail() {
    const btn = document.getElementById('testEmailBtn');
    const resultDiv = document.getElementById('emailTestResults');
    const email = document.getElementById('diagEmailTarget').value;
    
    if (!email) return showToast('Please enter a target email', 'error');
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing...';
    resultDiv.style.display = 'block';
    resultDiv.style.background = '#f1f5f9';
    resultDiv.style.border = '1px solid #e2e8f0';
    resultDiv.style.color = '#334155';
    resultDiv.textContent = 'Initializing diagnostic test...\nContacting backend...';
    
    try {
        const response = await fetch(API + '/admin/test-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email })
        });
        
        const res = await response.json();
        
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Test Email';
        
        let report = '=== EMAIL DIAGNOSTIC REPORT ===\n';
        report += `Time: ${new Date().toLocaleString()}\n`;
        report += `Success: ${res.success ? '✅ YES' : '❌ NO'}\n\n`;
        
        if (res.config) report += `Config: ${res.config}\n`;
        if (res.resend) report += `Resend API: ${res.resend}\n`;
        if (res.smtp) report += `SMTP: ${res.smtp}\n`;
        if (res.error) report += `Error: ${res.error}\n`;
        
        resultDiv.textContent = report;
        
        if (res.success) {
            resultDiv.style.background = '#f0fdf4';
            resultDiv.style.border = '1px solid #bbfcbd';
            resultDiv.style.color = '#166534';
            showToast('Test email sent successfully!', 'success');
        } else {
            resultDiv.style.background = '#fef2f2';
            resultDiv.style.border = '1px solid #fecaca';
            resultDiv.style.color = '#991b1b';
            showToast('Email test failed. See report below.', 'error');
        }
        
    } catch (e) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Test Email';
        resultDiv.textContent = `CRITICAL ERROR:\n${e.message}\n\nCheck if the server is running and the /api/admin/test-email endpoint is correctly deployed.`;
        resultDiv.style.background = '#fff7ed';
        resultDiv.style.border = '1px solid #ffedd5';
        resultDiv.style.color = '#9a3412';
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
        const container = document.querySelector('.dashboard-container');
        // blur removed
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
            localStorage.removeItem('user');
            localStorage.removeItem('staff');
            localStorage.removeItem('admin');
            localStorage.removeItem('token');
            sessionStorage.clear();
            const loginUrl = (window.SmartBankDeviceDetector && window.SmartBankDeviceDetector.getLoginUrl) ? window.SmartBankDeviceDetector.getLoginUrl() : 'user.html';
            window.location.href = loginUrl;
        }
    });
}

// Toast Notification
// showToast removed (handled by premium-ui.js)

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
            fetch(API + '/admin/liquidity-fund', { credentials: 'include' }).catch(() => null)
        ]);
        const data = await salaryRes.json();

        if (data.success) {
            document.getElementById('currentSalaryMonth').textContent = escHtml(data.month);
            document.getElementById('salaryStatsDays').textContent = `Month Days: ${escHtml(data.days_in_month)}`;
            // Show fund balance if element exists
            if (fundRes && fundRes.ok) {
                const fundData = await fundRes.json();
                const fundEl = document.getElementById('salaryFundBalance');
                if (fundEl) fundEl.textContent = `₹${(fundData.balance || 0).toLocaleString('en-IN')}`;
            }
            renderSalaryTable(data.salary_list);
        } else {
            tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:red;">Error: ${escHtml(data.error)}</td></tr>`;
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
            <td class="acc-num-display">${escHtml(item.staff_code)}</td>
            <td style="font-weight:700;">${escHtml(item.name)}</td>
            <td><span class="status-badge" style="background:rgba(128,0,0,0.05);color:var(--text-primary);border:1px solid var(--border-color);">${escHtml(item.department.toUpperCase())}</span></td>
            <td><strong style="font-weight:700;">₹${(item.base_salary || 0).toLocaleString('en-IN')}</strong></td>
            <td><span class="status-badge success">${escHtml(item.attendance_days)} days</span></td>
            <td><strong style="color:var(--primary);font-size:15px;font-weight:800;">₹${(item.current_salary || 0).toLocaleString('en-IN')}</strong></td>
            <td>
                <div style="display:flex;gap:6px;">
                    <button class="action-btn-circle edit" onclick="event.stopPropagation(); openUpdateSalaryModal(${item.id}, '${escHtml(item.name)}', ${item.base_salary})" title="Update Base Salary">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${item.current_salary > 0 ? `
                    <button class="action-btn-circle view" style="background:#dcfce7;color:#16a34a;" onclick="event.stopPropagation(); paySalary(${item.id}, '${escHtml(item.name)}', ${item.current_salary})" title="Pay Salary Now">
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
        message: `Credit <strong>₹${amount.toLocaleString('en-IN')}</strong> salary to <strong>${escHtml(staffName)}</strong>?<br><small style="color:#6b7280;">This will be deducted from the Loan Liquidity Fund and credited directly to their bank account.</small>`,
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
            tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:red;">Error: ${escHtml(data.error || 'Failed to load attendance')}</td></tr>`;
        }
    } catch (e) {
        console.error('Error loading attendance tracking:', e);
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:red;">Error loading attendance data: ${escHtml(e.message)}</td></tr>`;
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
            <td class="acc-num-display">${escHtml(row.staff_code || row.staff_id)}</td>
            <td style="font-weight:700;">${escHtml(row.staff_name)}</td>
            <td style="color:var(--text-secondary);font-size:12px;">${new Date(row.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
            <td style="font-family:monospace;font-weight:600;color:var(--primary);">${escHtml(formatTime(row.clock_in))}</td>
            <td style="font-family:monospace;font-weight:600;color:var(--text-secondary);">${row.clock_out ? escHtml(formatTime(row.clock_out)) : '<span style="color:#f59e0b;">Ongoing</span>'}</td>
            <td><strong style="color:var(--primary);">${escHtml(row.total_hours ? row.total_hours.toFixed(2) + 'h' : '--')}</strong></td>
            <td><span class="status-badge ${row.status === 'present' || !row.status ? 'success' : 'warning'}">${escHtml((row.status || 'present').toUpperCase())}</span></td>
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

    if (elements.present) elements.present.textContent = escHtml(stats.today_present ?? '0');
    if (elements.total) elements.total.textContent = escHtml(stats.total_staff ?? '0');
    if (elements.avg) elements.avg.textContent = escHtml((stats.avg_hours || 0).toFixed(1));
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
                Registered on ${escHtml(data.registered_date || 'Unknown date')}
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
// ============== EDIT ACCOUNT =================
window.openEditAccountFromList = function(accountData) {
    window.currentEditAccount = accountData;
    if (typeof showEditAccountModal === 'function') {
        showEditAccountModal();
    }
};

window.showEditAccountModal = function() {
    const a = window.currentEditAccount;
    if (!a) return;

    document.getElementById('editAccountId').value = a.id;
    document.getElementById('editAccountBranch').value = a.branch || 'Main Branch';
    document.getElementById('editAccountIfsc').value = a.ifsc || 'SMTB0000001';
    document.getElementById('editAccountType').value = a.account_type || 'Savings';
    document.getElementById('editAccountDailyLimit').value = a.daily_limit || 200000;
    document.getElementById('editAccountStatus').value = a.status || 'active';

    showModal('editAccountModal');
};

window.submitEditAccount = async function(event) {
    event.preventDefault();
    const btn = document.getElementById('editAccountSubmitBtn');
    const id = document.getElementById('editAccountId').value;

    const payload = {
        branch: document.getElementById('editAccountBranch').value.trim(),
        ifsc: document.getElementById('editAccountIfsc').value.trim(),
        account_type: document.getElementById('editAccountType').value,
        daily_limit: parseFloat(document.getElementById('editAccountDailyLimit').value) || 200000,
        status: document.getElementById('editAccountStatus').value
    };

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        const res = await fetch(API + `/staff/accounts/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (res.ok && data.success !== false) {
            closeModal('editAccountModal');
            showToast('Account updated successfully!', 'success');
            loadAccountsPage(); 
        } else {
            showToast(data.error || 'Failed to update account.', 'error');
        }
    } catch (e) {
        showToast('Network error. Please try again.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
    }
};

// Load Accounts Page
async function loadAccountsPage() {
    const tbody = document.getElementById('accountsTable');
    if (!tbody) return;

    try {
        const response = await fetch(API + '/admin/accounts', { credentials: 'include' });
        if (response.ok) {
            const data = await response.json();
            window.allAdminAccountsRaw = data.accounts || [];
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
    tbody.innerHTML = accounts.map((acc, idx) => `
        <tr>
            <td class="acc-num-display">#${escHtml(acc.id)}</td>
            <td class="clickable-cell" onclick="event.stopPropagation(); viewUserActivity(${acc.user_id}, '${escHtml(acc.user_name || '').replace(/'/g, "\\'")}')">
                <div style="font-weight:700;">${escHtml(acc.user_name || '—')}</div>
            </td>
            <td class="acc-num-display">${escHtml(acc.account_number)}</td>
            <td><span class="status-badge" style="background:rgba(128,0,0,0.05);color:var(--text-primary);border:1px solid var(--border-color);">${escHtml(acc.account_type.toUpperCase())}</span></td>
            <td><strong style="font-weight:800;">₹${(acc.balance || 0).toLocaleString('en-IN')}</strong></td>
            <td><span class="status-badge ${acc.status === 'active' ? 'success' : 'danger'}">${escHtml(acc.status.toUpperCase())}</span></td>
            <td>
                <div style="display:flex;gap:8px;">
                    <button class="action-btn-circle" style="background:var(--bg-secondary);color:var(--primary-color);" onclick="openEditAccountFromList(window.allAdminAccountsRaw[${idx}])" title="Edit Account">
                        <i class="fas fa-pen"></i>
                    </button>
                    <button class="action-btn-circle success" onclick="depositMoney(${acc.id}, '${escHtml(acc.account_number)}')" title="Deposit Money">
                        <i class="fas fa-plus"></i>
                    </button>
                    <button class="action-btn-circle danger" onclick="withdrawMoney(${acc.id}, '${escHtml(acc.account_number)}')" title="Withdraw Money">
                        <i class="fas fa-minus"></i>
                    </button>
                    <button class="action-btn-circle delete" onclick="deleteAccount(${acc.id}, '${escHtml(acc.account_number)}')" title="Delete Account">
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
        if (el('liqTotalPaid')) el('liqTotalPaid').textContent = escHtml(data.closed_count || 0);
        if (el('liqActiveLoans')) el('liqActiveLoans').textContent = escHtml(data.active_count || 0);
        if (el('liqOverdueLoans')) el('liqOverdueLoans').textContent = escHtml(data.overdue_count || 0);

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
                                <td class="clickable-cell" onclick="event.stopPropagation(); viewUserActivity(${l.user_id}, '${escHtml(l.user_name || '').replace(/'/g, "\\'")}')">
                                    <div style="font-weight:700;">${escHtml(l.user_name || '—')}</div>
                                    <div style="font-size:11px;color:var(--text-secondary);">${escHtml(l.user_email || '')}</div>
                                </td>
                                <td>${escHtml(l.loan_type || '—')}</td>
                                <td style="font-weight:700;">₹${Number(l.loan_amount || 0).toLocaleString('en-IN')}</td>
                                <td style="font-weight:800;color:${l.outstanding_amount > 0 ? '#ef4444' : '#10b981'};">
                                    ₹${Number(l.outstanding_amount || 0).toLocaleString('en-IN')}
                                </td>
                                <td style="color:${l.penalty_amount > 0 ? '#f59e0b' : 'var(--text-secondary)'};">
                                    ${l.penalty_amount > 0 ? '₹' + Number(l.penalty_amount).toLocaleString('en-IN') : '—'}
                                </td>
                                <td>
                                    <span class="status-badge ${l.status === 'closed' ? 'success' : l.status === 'approved' ? 'warning' : 'danger'}">
                                        ${escHtml(l.status === 'closed' ? 'PAID OFF' : l.status.toUpperCase())}
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
            <td class="acc-num-display">#${escHtml(loan.id)}</td>
            <td class="clickable-cell" onclick="event.stopPropagation(); viewUserActivity(${loan.user_id}, '${escHtml(loan.user_name || '').replace(/'/g, "\\'")}')">
                <div style="font-weight:700;">${escHtml(loan.user_name || '—')}</div>
            </td>
            <td><span class="status-badge" style="background:rgba(128,0,0,0.05);color:var(--text-primary);border:1px solid var(--border-color);">${escHtml(loan.loan_type.toUpperCase())}</span></td>
            <td><strong style="font-weight:800;">₹${(loan.loan_amount || 0).toLocaleString('en-IN')}</strong></td>
            <td>${escHtml(loan.tenure_months)} mo</td>
            <td style="font-family:monospace;font-weight:600;">${escHtml(loan.interest_rate)}%</td>
            <td><span class="status-badge ${loan.status === 'approved' ? 'success' : loan.status === 'pending' ? 'warning' : 'danger'}">${escHtml(loan.status.toUpperCase())}</span></td>
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
                        <h4 style="margin: 0; font-size: 16px; font-weight: 700; color: var(--text-primary);">${escHtml(section.title)}</h4>
                    </div>
                    ${Object.entries(section.data || {}).map(([key, val]) => `
                        <div style="display:flex; justify-content:space-between; align-items:center; padding: 8px 0; border-bottom: 1px solid var(--border-color);">
                            <span style="color: var(--text-secondary); font-size: 14px; text-transform: capitalize;">${escHtml(key)}</span>
                            <span style="font-weight: 700; color: var(--text-primary);">${escHtml(val)}</span>
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
                                <p style="margin: 0; font-size: 10px; color: var(--text-secondary);">${escHtml(t.t_date)}</p>
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

    if (!Array.isArray(logs) || logs.length === 0) {
        container.innerHTML = '<p style="text-align:center;padding:2rem;color:#6b7280;"><i class="fas fa-info-circle fa-2x" style="display:block;margin-bottom:10px;opacity:0.5;"></i>No audit logs found.</p>';
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
                                <div style="font-weight:700;">${escHtml(log.user_name || 'System')}</div>
                                <div style="font-size:11px;color:var(--text-secondary);">${escHtml(log.user_type.toUpperCase())}</div>
                            </td>
                            <td><span class="status-badge" style="background:rgba(128,0,0,0.05);color:var(--text-primary);border:1px solid var(--border-color);">${escHtml(log.action.toUpperCase())}</span></td>
                            <td style="max-width:300px;white-space:normal;font-size:13px;color:var(--text-secondary);line-height:1.4;">${escHtml(log.details)}</td>
                            <td style="color:var(--text-secondary);font-family:monospace;font-size:12px;">${escHtml(log.ip_address)}</td>
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
                    <input type="text" id="settingBankName" class="form-control" value="${escHtml(settings.bankName || 'Smart Bank')}" style="width:100%; border:1px solid var(--border-color); border-radius:8px; padding:10px;">
                </div>
                <div class="form-group">
                    <label style="display:block; margin-bottom: 8px; font-weight: 600;">Daily Transfer Limit (₹)</label>
                    <input type="number" id="settingTransferLimit" class="form-control" value="${escHtml(settings.dailyTransferLimit || 100000)}" style="width:100%; border:1px solid var(--border-color); border-radius:8px; padding:10px;">
                </div>
                <div class="form-group">
                    <label style="display:block; margin-bottom: 8px; font-weight: 600;">Standard Loan Interest Rate (%)</label>
                    <input type="number" step="0.1" id="settingLoanRate" class="form-control" value="${escHtml(settings.loanInterestRate || 12.5)}" style="width:100%; border:1px solid var(--border-color); border-radius:8px; padding:10px;">
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
                <i class="fas fa-check-circle"></i> Backup created: <strong>${escHtml(result.filename)}</strong>
            </div>`;
        } else {
            status.innerHTML = `<div style="padding: 16px; background: #fef2f2; color: #991b1b; border-radius: 8px; display:inline-block;">
                Error: ${escHtml(result.error)}
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
                            <td class="acc-num-display">#${escHtml(t.id)}</td>
                            <td>
                                <div style="font-weight:700;">${escHtml(t.user_name)}</div>
                                <div style="font-size:11px;color:var(--text-secondary);">${escHtml(t.user_email)}</div>
                            </td>
                            <td class="acc-num-display">${escHtml(t.account_number)}</td>
                            <td><span class="status-badge" style="background:rgba(128,0,0,0.05);color:var(--text-primary);border:1px solid var(--border-color);">${escHtml(t.type.toUpperCase())}</span></td>
                            <td><strong style="color:${t.type.toUpperCase() === 'DEBIT' ? '#ef4444' : '#10b981'};font-weight:800;">₹${(t.amount || 0).toLocaleString('en-IN')}</strong></td>
                            <td><span class="status-badge ${t.status === 'completed' ? 'success' : 'warning'}">${escHtml(t.status.toUpperCase())}</span></td>
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
                            <td>#${admin.id}</td>
                            <td>${escHtml(admin.name)}</td>
                            <td>${escHtml(admin.username)}</td>
                            <td>${escHtml(admin.email)}</td>
                            <td><span class="status-badge ${admin.level === 'super' ? 'success' : 'info'}">${escHtml(admin.level)}</span></td>
                            <td><span class="status-badge ${admin.status === 'active' ? 'success' : 'warning'}">${escHtml(admin.status)}</span></td>
                            <td>
                                <div style="display:flex; gap:8px; justify-content:center;">
                                    <button class="action-btn-circle delete" onclick="deleteAdmin(${admin.id}, '${escHtml(admin.name).replace(/'/g, "\\'")}')" title="Delete Admin">
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
        messageIsHtml: true,
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
                    if (document.getElementById('agrihub')?.classList.contains('active')) {
                        loadAgriHubPage();
                    } else {
                        loadUsersPage();
                    }
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

// Quick Transaction Handlers
window.submitAdminAddMoney = async function (e) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const payload = {
        account_id: document.getElementById('addAccountId').value,
        amount: document.getElementById('addAmount').value
    };
    btn.disabled = true;
    try {
        const r = await fetch(API + '/staff/transaction/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            credentials: 'include'
        });
        const d = await r.json();
        if (r.ok) {
            showToast('Money added successfully!', 'success');
            e.target.reset();
            loadTransactionsPage();
        } else {
            showToast(d.error || 'Failed to add money', 'error');
        }
    } catch (err) { showToast('Error connecting to server', 'error'); }
    finally { btn.disabled = false; }
};

window.submitAdminWithdrawMoney = async function (e) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const payload = {
        account_id: document.getElementById('withdrawAccountId').value,
        amount: document.getElementById('withdrawAmount').value
    };
    btn.disabled = true;
    try {
        const r = await fetch(API + '/staff/transaction/withdraw', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            credentials: 'include'
        });
        const d = await r.json();
        if (r.ok) {
            showToast('Money withdrawn successfully!', 'success');
            e.target.reset();
            loadTransactionsPage();
        } else {
            showToast(d.error || 'Failed to withdraw money', 'error');
        }
    } catch (err) { showToast('Error connecting to server', 'error'); }
    finally { btn.disabled = false; }
};

window.submitAdminTransferMoney = async function (e) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const payload = {
        sender_id: document.getElementById('transferSenderId').value,
        receiver_account: document.getElementById('transferReceiverAcc').value,
        amount: document.getElementById('transferAmount').value
    };
    btn.disabled = true;
    try {
        const r = await fetch(API + '/staff/transaction/transfer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            credentials: 'include'
        });
        const d = await r.json();
        if (r.ok) {
            showToast('Transfer executed successfully!', 'success');
            e.target.reset();
            loadTransactionsPage();
        } else {
            showToast(d.error || 'Transfer failed', 'error');
        }
    } catch (err) { showToast('Error connecting to server', 'error'); }
    finally { btn.disabled = false; }
};


// Quick Action Helpers
window.depositMoney = function (accId, accNum) {
    const elId = document.getElementById('addAccountId');
    if (elId) elId.value = accNum || accId;
    showPage('transactions');
    showToast('Prepare deposit for Account: ' + (accNum || accId), 'info');
};

window.withdrawMoney = function (accId, accNum) {
    const elId = document.getElementById('withdrawAccountId');
    if (elId) elId.value = accNum || accId;
    showPage('transactions');
    showToast('Prepare withdrawal for Account: ' + (accNum || accId), 'info');
};

// Settings & Profile Photo Upload
async function loadSettingsPage() {
    const el = document.getElementById('settingsContent');
    const adminLocal = JSON.parse(localStorage.getItem('admin'));
    if (!el || !adminLocal) return;

    el.innerHTML = '<div style="padding:40px; text-align:center;"><i class="fas fa-spinner fa-spin" style="font-size:32px; color:#800000;"></i><p>Loading your profile...</p></div>';

    try {
        const res = await fetch(`${API}/admin/profile`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch profile');
        const admin = await res.json();
        
        // Update local storage with fresh data
        localStorage.setItem('admin', JSON.stringify({ ...adminLocal, ...admin }));

        const avatarUrl = admin.profile_image 
            ? `${API}/admin/profile-image/${admin.profile_image}`
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(admin.username || 'Admin')}&background=800000&color=fff&rounded=true&bold=true`;

        el.innerHTML = `
            <div style="padding: 24px;">
                <div style="display:flex; align-items:center; gap:24px; margin-bottom: 32px;">
                    <div style="position: relative; cursor: pointer;" onclick="triggerAdminPhotoUpload()">
                        <img id="adminProfilePageAvatar" src="${avatarUrl}" 
                             style="width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 4px solid #fff; box-shadow: 0 4px 6px rgba(0,0,0,0.1); transition: all 0.3s ease;">
                        <div style="position: absolute; bottom: 5px; right: 5px; background: #800000; color: #fff; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #fff; font-size: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                            <i class="fas fa-camera"></i>
                        </div>
                        <input type="file" id="adminPhotoInput" accept="image/*" style="display: none;" onchange="handleAdminPhotoUpload(event)">
                    </div>
                    <div>
                        <h2 style="margin:0 0 8px; font-size:24px; color:var(--text-primary);">${admin.name || 'Administrator'}</h2>
                        <p style="margin:0 0 4px; color:var(--text-secondary); font-size:16px;"><strong>Username:</strong> ${admin.username}</p>
                        <p style="margin:0 0 4px; color:var(--text-secondary); font-size:16px;"><strong>Level:</strong> ${admin.level || 'System Admin'}</p>
                        <p style="margin:0; color:var(--text-secondary); font-size:16px;"><strong>Email:</strong> ${admin.email || 'admin@bank.com'}</p>
                    </div>
                </div>

                <div style="display: block; max-width: 800px; margin: 0 auto;">
                    <!-- Security Card -->
                    <div class="card" style="margin-bottom: 24px;">
                        <div class="card-header">
                            <h3 style="margin:0; font-size: 18px; font-weight: 800; color: #1e293b;"><i class="fas fa-lock" style="margin-right: 10px; color: #800000;"></i>Security & Authenticity</h3>
                        </div>
                        <div style="padding: 20px;">
                            <div style="display:flex; align-items:center; justify-content:space-between; padding: 12px; background:rgba(0,0,0,0.02); border-radius:12px; border:1px solid var(--border-color);">
                                <div>
                                    <h4 style="margin:0 0 4px; font-size:16px;">Face Recognition Login</h4>
                                    <p style="margin:0; font-size:13px; color:var(--text-secondary);" id="faceStatusText">Checking status...</p>
                                </div>
                                <div id="faceActionButtons">
                                    <button class="btn btn-primary btn-sm" onclick="openFaceRegistration()" style="background: #800000; border: none;">
                                        <i class="fas fa-video"></i> Register Face
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } catch (e) {
        console.error('Admin Profile Load Error:', e);
        el.innerHTML = '<div style="padding:40px; text-align:center; color:#ef4444;"><i class="fas fa-exclamation-circle" style="font-size:24px;"></i><p>Failed to load profile. Please refresh.</p></div>';
    }
    
    // Check face status after rendering
    loadFaceAuthStatus();
}


window.triggerAdminPhotoUpload = function() {
    document.getElementById('adminPhotoInput').click();
};

window.handleAdminPhotoUpload = async function(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showToast('Please select a valid image file', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('image', file);

    try {
        showToast('Uploading photo...', 'info');
        const res = await fetch(`${API}/admin/profile-image`, {
            method: 'POST',
            credentials: 'include',
            body: formData
        });

        const data = await res.json();
        if (res.ok) {
            showToast('Profile photo updated successfully', 'success');
            
            // Update local storage
            const admin = JSON.parse(localStorage.getItem('admin'));
            admin.profile_image = data.profile_image;
            localStorage.setItem('admin', JSON.stringify(admin));

            // Refresh UI
            initializeDashboard();
            loadSettingsPage();
        } else {
            showToast(data.error || 'Failed to upload photo', 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('Network error during upload', 'error');
    }
};
// Account Request Approvals (Agri, Salary, Business)
async function fetchAccountRequests() {
    try {
        const response = await fetch(API + '/staff/account_requests', { credentials: 'include' });
        if (response.ok) {
            const data = await response.json();
            return data.requests || [];
        }
    } catch (e) {
        console.error('Error fetching account requests:', e);
    }
    return [];
}

async function loadAgriApprovalsPage() {
    const list = document.getElementById('agriApprovalsList');
    if (!list) return;

    list.innerHTML = '<div style="text-align:center;padding:2rem;"><i class="fas fa-spinner fa-spin"></i></div>';
    
    try {
        const requests = await fetchAccountRequests();
        const agriReqs = requests.filter(r => r.account_type === 'agriculture' && r.status === 'pending');
        
        document.getElementById('agriApprovalsBadge').textContent = agriReqs.length;

        if (agriReqs.length === 0) {
            list.innerHTML = '<p style="text-align:center;padding:2rem;color:var(--text-secondary);">No pending agriculture account requests.</p>';
            return;
        }

        list.innerHTML = `
            <div class="premium-table-wrapper">
                <table class="premium-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Customer</th>
                            <th style="white-space:nowrap;">Farm Details</th>
                            <th>Proofs</th>
                            <th>Face / KYC</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${agriReqs.map(r => `
                            <tr>
                                <td class="acc-num-display">#${escHtml(r.id)}</td>
                                <td>
                                    <div style="font-weight:700;">${escHtml(r.user_name || '—')}</div>
                                    <div style="font-size:11px;color:var(--text-secondary);">${escHtml(r.user_email || '—')}</div>
                                </td>
                                <td>
                                    <div style="font-family:monospace;font-size:12px;">A: ${escHtml(r.aadhaar_number || '—')}</div>
                                    <div style="font-family:monospace;font-size:12px;color:var(--text-secondary);">P: ${escHtml(r.pan_number || '—')}</div>
                                    ${r.agri_address ? `<div style="font-size:11px;margin-top:4px;max-width:120px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escHtml(r.agri_address)}"><a href="https://www.google.com/maps?q=${escHtml(r.agri_address)}" target="_blank" style="color:#047857;text-decoration:underline;"><i class="fas fa-map-marker-alt"></i> View Land</a></div>` : ''}
                                    <div style="font-size:11px;color:${r.agri_address ? '#10b981' : '#ef4444'};margin-top:4px;font-weight:600;"><i class="fas fa-satellite-dish"></i> AI Satellite Detected: ${r.agri_address ? 'Yes' : 'No'}</div>
                                </td>
                                <td>
                                    <div style="display:flex;gap:6px;">
                                        ${r.aadhaar_proof ? `
                                            <button class="action-btn-circle view" style="width:28px;height:28px;font-size:12px;" onclick="event.stopPropagation(); showKYCDoc('${escHtml(r.aadhaar_proof)}', 'Aadhaar - ${escHtml(r.user_name)}')">
                                                <i class="fas ${r.aadhaar_proof.startsWith('data:application/pdf') ? 'fa-file-pdf' : 'fa-id-card'}"></i>
                                            </button>` : ''}
                                        ${r.pan_proof ? `
                                            <button class="action-btn-circle edit" style="width:28px;height:28px;font-size:12px;background:rgba(245,158,11,0.1);color:#f59e0b;" onclick="event.stopPropagation(); showKYCDoc('${escHtml(r.pan_proof)}', 'PAN - ${escHtml(r.user_name)}')">
                                                <i class="fas ${r.pan_proof.startsWith('data:application/pdf') ? 'fa-file-pdf' : 'fa-id-card'}"></i>
                                            </button>` : ''}
                                        ${r.agri_proof ? `
                                            <button class="action-btn-circle" style="width:28px;height:28px;font-size:12px;background:rgba(16,185,129,0.1);color:#10b981;" onclick="event.stopPropagation(); showKYCDoc('${escHtml(r.agri_proof)}', 'Agri Proof - ${escHtml(r.user_name)}')">
                                                <i class="fas ${r.agri_proof.startsWith('data:application/pdf') ? 'fa-file-pdf' : 'fa-leaf'}"></i>
                                            </button>` : ''}
                                    </div>
                                </td>
                                <td>
                                    <div style="display:flex;gap:6px;">
                                        ${r.kyc_photo ? `
                                            <div class="kyc-thumb" onclick="event.stopPropagation(); enlargeKYCPhoto('${escHtml(r.kyc_photo)}', '${escHtml(r.user_name)}')">
                                                <img src="${escHtml(r.kyc_photo)}" style="width:28px;height:28px;border-radius:4px;object-fit:cover;">
                                            </div>` : ''}
                                        ${r.kyc_video ? `
                                            <button class="action-btn-circle delete" style="width:28px;height:28px;font-size:10px;" onclick="playKYCVideo('${escHtml(r.kyc_video)}', '${escHtml(r.user_name)}')">
                                                <i class="fas fa-play"></i>
                                            </button>` : ''}
                                    </div>
                                </td>
                                <td>
                                    <div style="display:flex;gap:8px;">
                                        <button class="action-btn-circle view" onclick="event.stopPropagation(); handleAdminAccountAction(${r.id}, 'approve', 'agri-approvals')" title="Approve"><i class="fas fa-check"></i></button>
                                        <button class="action-btn-circle edit" style="background:rgba(59,130,246,0.1);color:#3b82f6;" onclick="event.stopPropagation(); window.currentEditCustomer = { ...r, id: r.user_id, name: r.user_name, email: r.user_email, phone: r.user_phone, address: r.user_address, date_of_birth: r.user_dob }; showEditCustomerModal();" title="Edit Customer Details">
                                            <i class="fas fa-user-edit"></i>
                                        </button>
                                        <button class="action-btn-circle delete" onclick="event.stopPropagation(); handleAdminAccountAction(${r.id}, 'reject', 'agri-approvals')" title="Reject"><i class="fas fa-times"></i></button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (e) {
        console.error('Error loading agri approvals:', e);
        list.innerHTML = '<p style="text-align:center;padding:2rem;color:var(--text-secondary);">Error loading data.</p>';
    }
}

async function loadAgriLoansPage() {
    const list = document.getElementById('agriLoansList');
    if (!list) return;

    list.innerHTML = '<div style="text-align:center;padding:2rem;"><i class="fas fa-spinner fa-spin"></i></div>';
    
    try {
        const response = await fetch(API + '/agri/staff/all', { credentials: 'include' });
        if (response.ok) {
            const data = await response.json();
            const loans = (data.loans || []).filter(l => l.status === 'pending');
            
            document.getElementById('agriLoansBadge').textContent = loans.length;

            if (loans.length === 0) {
                list.innerHTML = '<p style="text-align:center;padding:2rem;color:var(--text-secondary);">No pending agriculture loan applications.</p>';
                return;
            }

            list.innerHTML = `
                <div class="premium-table-wrapper">
                    <table class="premium-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Applicant</th>
                                <th>Crop Details</th>
                                <th>Amount</th>
                                <th>AI Health Score</th>
                                <th>Recommendation</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${loans.map(l => `
                                <tr>
                                    <td class="acc-num-display">#${escHtml(l.id)}</td>
                                    <td>
                                        <div style="font-weight:700;">${escHtml(l.user_name || '—')}</div>
                                        <div style="font-size:11px;color:var(--text-secondary);">${escHtml(l.user_email || '—')}</div>
                                    </td>
                                    <td>
                                        <div style="font-size:12px;font-weight:600;color:#047857;">${escHtml(l.crop_type)}</div>
                                        <div style="font-size:11px;color:var(--text-secondary);">${l.land_size_acres} Acres</div>
                                        <div style="font-size:11px;margin-top:4px;"><a href="https://www.google.com/maps?q=${escHtml(l.farm_coordinates)}" target="_blank" style="color:#047857;text-decoration:underline;"><i class="fas fa-map-marker-alt"></i> View Farm</a></div>
                                    </td>
                                    <td><strong style="color:var(--text-primary);">₹${Number(l.requested_amount).toLocaleString('en-IN')}</strong></td>
                                    <td>
                                        <div style="display:flex; align-items:center; gap:8px;">
                                            <div style="flex:1; width:60px; height:6px; background:rgba(0,0,0,0.05); border-radius:3px; overflow:hidden;">
                                                <div style="width:${l.ai_health_score}%; height:100%; background:${l.ai_health_score > 70 ? '#10b981' : (l.ai_health_score > 40 ? '#f59e0b' : '#ef4444')};"></div>
                                            </div>
                                            <span style="font-weight:700;font-size:12px;">${l.ai_health_score}%</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span class="status-badge ${l.ai_recommendation === 'Approved' ? 'success' : (l.ai_recommendation === 'Manual Review' ? 'warning' : 'danger')}">
                                            ${escHtml(l.ai_recommendation)}
                                        </span>
                                    </td>
                                    <td>
                                        <div style="display:flex;gap:8px;">
                                            <button class="action-btn-circle view" onclick="handleAdminAgriLoanAction(${l.id}, 'approved')" title="Approve"><i class="fas fa-check"></i></button>
                                            <button class="action-btn-circle edit" style="background:rgba(59,130,246,0.1);color:#3b82f6;" onclick="event.stopPropagation(); window.currentEditCustomer = { ...l, id: l.user_id, name: l.user_name, email: l.user_email, phone: l.user_phone, address: l.user_address, date_of_birth: l.user_dob }; showEditCustomerModal();" title="Edit Customer Details">
                                                <i class="fas fa-user-edit"></i>
                                            </button>
                                            <button class="action-btn-circle delete" onclick="handleAdminAgriLoanAction(${l.id}, 'rejected')" title="Reject"><i class="fas fa-times"></i></button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
    } catch (e) {
        console.error('Error loading agri loans:', e);
        list.innerHTML = '<p style="text-align:center;padding:2rem;color:var(--text-secondary);">Error loading data.</p>';
    }
}

window.handleAdminAgriLoanAction = function(loanId, status) {
    showConfirm({
        title: `${status === 'approved' ? 'Approve' : 'Reject'} Agri Loan`,
        message: `Are you sure you want to ${status.slice(0, -1)} this agriculture loan application?`,
        onConfirm: async () => {
            try {
                const response = await fetch(`${API}/agri/staff/process/${loanId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status }),
                    credentials: 'include'
                });
                if (response.ok) {
                    showToast(`Loan ${status} successfully`, 'success');
                    loadAgriLoansPage();
                    updateSidebarBadges();
                } else {
                    const data = await response.json();
                    showToast(data.error || 'Action failed', 'error');
                }
            } catch (e) {
                showToast('Network error', 'error');
            }
        }
    });
};

async function loadSalaryApprovalsPage() {
    const list = document.getElementById('salaryApprovalsList');
    if (!list) return;

    list.innerHTML = '<div style="text-align:center;padding:2rem;"><i class="fas fa-spinner fa-spin"></i></div>';
    
    try {
        const requests = await fetchAccountRequests();
        const salaryReqs = requests.filter(r => r.account_type === 'salary' && r.status === 'pending');
        
        document.getElementById('salaryApprovalsBadge').textContent = salaryReqs.length;

        if (salaryReqs.length === 0) {
            list.innerHTML = '<p style="text-align:center;padding:2rem;color:var(--text-secondary);">No pending salary account requests.</p>';
            return;
        }

        list.innerHTML = `
            <div class="premium-table-wrapper">
                <table class="premium-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Customer</th>
                            <th>Salary Slip</th>
                            <th>KYC Docs</th>
                            <th>Face Match</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${salaryReqs.map(r => `
                            <tr>
                                <td class="acc-num-display">#${escHtml(r.id)}</td>
                                <td>
                                    <div style="font-weight:700;">${escHtml(r.user_name || '—')}</div>
                                    <div style="font-size:11px;color:var(--text-secondary);">${escHtml(r.user_email || '—')}</div>
                                </td>
                                <td>
                                    ${r.salary_slip ? `
                                        <button class="action-btn-circle" style="width:36px;height:36px;background:rgba(59,130,246,0.1);color:#3b82f6;" onclick="event.stopPropagation(); showKYCDoc('${escHtml(r.salary_slip)}', 'Salary Slip - ${escHtml(r.user_name)}')">
                                            <i class="fas fa-file-invoice-dollar"></i>
                                        </button>
                                    ` : '<span style="color:#ef4444;font-size:11px;">No Slip</span>'}
                                </td>
                                <td>
                                    <div style="display:flex;gap:4px;">
                                        ${r.aadhaar_proof ? `<button class="action-btn-circle view" style="width:24px;height:24px;font-size:10px;" onclick="event.stopPropagation(); showKYCDoc('${escHtml(r.aadhaar_proof)}', 'Aadhaar')"><i class="fas fa-id-card"></i></button>` : ''}
                                        ${r.pan_proof ? `<button class="action-btn-circle edit" style="width:24px;height:24px;font-size:10px;background:rgba(245,158,11,0.1);color:#f59e0b;" onclick="event.stopPropagation(); showKYCDoc('${escHtml(r.pan_proof)}', 'PAN')"><i class="fas fa-id-card"></i></button>` : ''}
                                    </div>
                                </td>
                                <td>
                                    ${r.kyc_photo ? `
                                        <div class="kyc-thumb" onclick="event.stopPropagation(); enlargeKYCPhoto('${escHtml(r.kyc_photo)}', '${escHtml(r.user_name)}')">
                                            <img src="${escHtml(r.kyc_photo)}" style="width:28px;height:28px;border-radius:4px;object-fit:cover;">
                                        </div>` : '—'}
                                </td>
                                <td>
                                    <div style="display:flex;gap:8px;">
                                        <button class="action-btn-circle view" onclick="event.stopPropagation(); handleAdminAccountAction(${r.id}, 'approve', 'salary-approvals')" title="Approve"><i class="fas fa-check"></i></button>
                                        <button class="action-btn-circle edit" style="background:rgba(59,130,246,0.1);color:#3b82f6;" onclick="event.stopPropagation(); window.currentEditCustomer = { ...r, id: r.user_id, name: r.user_name, email: r.user_email, phone: r.user_phone, address: r.user_address, date_of_birth: r.user_dob }; showEditCustomerModal();" title="Edit Customer Details">
                                            <i class="fas fa-user-edit"></i>
                                        </button>
                                        <button class="action-btn-circle delete" onclick="event.stopPropagation(); handleAdminAccountAction(${r.id}, 'reject', 'salary-approvals')" title="Reject"><i class="fas fa-times"></i></button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (e) {
        console.error('Error loading salary approvals:', e);
        list.innerHTML = '<p style="text-align:center;padding:2rem;color:var(--text-secondary);">Error loading data.</p>';
    }
}

async function loadBusinessApprovalsPage() {
    const list = document.getElementById('businessApprovalsList');
    if (!list) return;

    list.innerHTML = '<div style="text-align:center;padding:2rem;"><i class="fas fa-spinner fa-spin"></i></div>';
    
    try {
        const requests = await fetchAccountRequests();
        const bizReqs = requests.filter(r => r.account_type === 'current' && r.status === 'pending');
        
        document.getElementById('businessApprovalsBadge').textContent = bizReqs.length;

        if (bizReqs.length === 0) {
            list.innerHTML = '<p style="text-align:center;padding:2rem;color:var(--text-secondary);">No pending business account requests.</p>';
            return;
        }

        list.innerHTML = `
            <div class="premium-table-wrapper">
                <table class="premium-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Customer</th>
                            <th>Business Details</th>
                            <th>KYC Docs</th>
                            <th>Face Match</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${bizReqs.map(r => `
                            <tr>
                                <td class="acc-num-display">#${escHtml(r.id)}</td>
                                <td>
                                    <div style="font-weight:700;">${escHtml(r.user_name || '—')}</div>
                                    <div style="font-size:11px;color:var(--text-secondary);">${escHtml(r.user_email || '—')}</div>
                                </td>
                                <td>
                                    <div style="font-size:12px;font-weight:600;color:#92400e;margin-bottom:4px;">Tax ID: ${escHtml(r.tax_id || '—')}</div>
                                    ${r.business_proof ? `
                                        <button class="action-btn-circle" style="width:36px;height:36px;background:rgba(245,158,11,0.1);color:#f59e0b;" onclick="event.stopPropagation(); showKYCDoc('${escHtml(r.business_proof)}', 'Business Proof - ${escHtml(r.user_name)}')">
                                            <i class="fas fa-file-contract"></i>
                                        </button>
                                    ` : '<span style="color:#ef4444;font-size:11px;">No Proof</span>'}
                                </td>
                                <td>
                                    <div style="display:flex;gap:4px;">
                                        ${r.aadhaar_proof ? `<button class="action-btn-circle view" style="width:24px;height:24px;font-size:10px;" onclick="event.stopPropagation(); showKYCDoc('${escHtml(r.aadhaar_proof)}', 'Aadhaar')"><i class="fas fa-id-card"></i></button>` : ''}
                                        ${r.pan_proof ? `<button class="action-btn-circle edit" style="width:24px;height:24px;font-size:10px;background:rgba(245,158,11,0.1);color:#f59e0b;" onclick="event.stopPropagation(); showKYCDoc('${escHtml(r.pan_proof)}', 'PAN')"><i class="fas fa-id-card"></i></button>` : ''}
                                    </div>
                                </td>
                                <td>
                                    ${r.kyc_photo ? `
                                        <div class="kyc-thumb" onclick="event.stopPropagation(); enlargeKYCPhoto('${escHtml(r.kyc_photo)}', '${escHtml(r.user_name)}')">
                                            <img src="${escHtml(r.kyc_photo)}" style="width:28px;height:28px;border-radius:4px;object-fit:cover;filter:blur(4px);">
                                        </div>` : '—'}
                                </td>
                                <td>
                                    <div style="display:flex;gap:8px;">
                                        <button class="action-btn-circle view" onclick="event.stopPropagation(); handleAdminAccountAction(${r.id}, 'approve', 'business-approvals')" title="Approve"><i class="fas fa-check"></i></button>
                                        <button class="action-btn-circle edit" style="background:rgba(59,130,246,0.1);color:#3b82f6;" onclick="event.stopPropagation(); window.currentEditCustomer = { ...r, id: r.user_id, name: r.user_name, email: r.user_email, phone: r.user_phone, address: r.user_address, date_of_birth: r.user_dob }; showEditCustomerModal();" title="Edit Customer Details">
                                            <i class="fas fa-user-edit"></i>
                                        </button>
                                        <button class="action-btn-circle delete" onclick="event.stopPropagation(); handleAdminAccountAction(${r.id}, 'reject', 'business-approvals')" title="Reject"><i class="fas fa-times"></i></button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (e) {
        console.error('Error loading business approvals:', e);
        list.innerHTML = '<p style="text-align:center;padding:2rem;color:var(--text-secondary);">Error loading data.</p>';
    }
}

window.handleAdminAccountAction = function(reqId, action, page) {
    if (action === 'reject') {
        showPrompt({
            title: 'Reject Request',
            message: 'Please provide a reason for rejecting this account request.',
            placeholder: 'e.g. Incomplete documentation',
            onConfirm: (reason) => {
                if (reason) executeAdminAccountAction(reqId, 'reject', reason, page);
                else showToast('Reason is required for rejection', 'warning');
            }
        });
    } else {
        showConfirm({
            title: 'Approve Request',
            message: 'Are you sure you want to approve this account request? This will create a new account for the user.',
            onConfirm: () => executeAdminAccountAction(reqId, 'approve', '', page)
        });
    }
};

async function executeAdminAccountAction(reqId, action, reason, page) {
    try {
        const response = await fetch(`${API}/staff/account_requests/${reqId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, reason }),
            credentials: 'include'
        });

        const data = await response.json();
        if (response.ok) {
            showToast(`Account request ${action}d successfully`, 'success');
            if (page === 'agri-approvals') loadAgriApprovalsPage();
            else if (page === 'salary-approvals') loadSalaryApprovalsPage();
            else if (page === 'business-approvals') loadBusinessApprovalsPage();
        } else {
            showToast(data.error || 'Action failed', 'error');
        }
    } catch (e) {
        showToast('Network error processing request', 'error');
    }
}

async function updateSidebarBadges() {
    const requests = await fetchAccountRequests();
    
    const agriCount = requests.filter(r => r.account_type === 'agriculture' && r.status === 'pending').length;
    const salaryCount = requests.filter(r => r.account_type === 'salary' && r.status === 'pending').length;
    const businessCount = requests.filter(r => r.account_type === 'current' && r.status === 'pending').length;

    // Agri Loans also
    let agriLoanCount = 0;
    try {
        const res = await fetch(API + '/agri/staff/all', { credentials: 'include' });
        if (res.ok) {
            const data = await res.json();
            agriLoanCount = (data.loans || []).filter(l => l.status === 'pending').length;
        }
    } catch(e) {}

    updateBadge('agriSideBadge', agriCount);
    updateBadge('agriLoanSideBadge', agriLoanCount);
    updateBadge('salarySideBadge', salaryCount);
    updateBadge('businessSideBadge', businessCount);
}

function updateBadge(id, count) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = count;
    el.style.display = count > 0 ? 'inline-block' : 'none';
}

function escHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// =============================================
// AGRICULTURE HUB: UNIFIED VIEW (ADMIN)
// =============================================
const $id = id => document.getElementById(id);
let agriMap = null;
let agriMarkers = [];
let currentAgriLoanId = null;
const agriMapLayers = {
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri'
    }),
    terrain: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{y}/{x}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    })
};

async function loadAgriHubPage() {
    const el = document.getElementById('agriHubList');
    if (!el) return;
    el.innerHTML = '<div style="padding:60px; text-align:center;"><i class="fas fa-spinner fa-spin" style="font-size:32px; color:#800000;"></i><p style="margin-top:15px; color:var(--text-secondary);">Consolidating agricultural data...</p></div>';

    try {
        const [accReqRes, loanRes, accountsRes] = await Promise.all([
            fetch(API + '/staff/account_requests', { credentials: 'include' }),
            fetch(API + '/agri/staff/all', { credentials: 'include' }),
            fetch(API + '/staff/accounts', { credentials: 'include' })
        ]);

        if (!accReqRes.ok || !loanRes.ok || !accountsRes.ok) throw new Error('Failed to fetch hub data');

        const accReqData = await accReqRes.json();
        const loanData = await loanRes.json();
        const accountsData = await accountsRes.json();

        const isAgri = (type) => type && (type.toLowerCase() === 'agriculture' || type.toLowerCase().includes('agri'));

        const agriAccRequests = (accReqData.requests || []).filter(r => isAgri(r.account_type));
        const agriLoans = loanData.loans || [];
        const approvedAgriAccounts = (accountsData.accounts || []).filter(a => isAgri(a.account_type));

        const agriCustomers = {};
        const ensureCustomer = (uId, name, email) => {
            if (!uId) return null;
            if (!agriCustomers[uId]) {
                agriCustomers[uId] = { id: uId, name: name || 'Unknown', email: email || '', requests: [], loans: [], approvedAccounts: [] };
            }
            return agriCustomers[uId];
        };

        agriAccRequests.forEach(r => { const c = ensureCustomer(r.user_id, r.user_name, r.user_email); if (c) c.requests.push(r); });
        agriLoans.forEach(l => { const c = ensureCustomer(l.user_id, l.user_name, l.user_email); if (c) c.loans.push(l); });
        approvedAgriAccounts.forEach(a => { const c = ensureCustomer(a.user_id, a.user_name, ''); if (c) c.approvedAccounts.push(a); });

        _allAgriHubCustomers = Object.values(agriCustomers).filter(c => c.approvedAccounts.length > 0);
        if ($id('agriHubSearchInput')) $id('agriHubSearchInput').value = '';
        renderAgriHubTable(_allAgriHubCustomers);

    } catch (e) {
        console.error('Agri Hub Load Error:', e);
        el.innerHTML = '<div style="padding:40px; text-align:center; color:#ef4444;"><i class="fas fa-exclamation-circle" style="font-size:24px;"></i><p>Failed to load Agriculture Hub records.</p></div>';
    }
}

function handleAgriHubSearch() {
    const query = ($id('agriHubSearchInput')?.value || '').toLowerCase();
    const filtered = _allAgriHubCustomers.filter(c => 
        String(c.id).includes(query) || c.name.toLowerCase().includes(query) || c.email.toLowerCase().includes(query) ||
        c.approvedAccounts.some(acc => acc.account_number.toLowerCase().includes(query))
    );
    renderAgriHubTable(filtered);
}

function renderAgriHubTable(customersArray) {
    const el = document.getElementById('agriHubList');
    const activeCountEl = document.getElementById('agriHubActiveCount');
    if (!el) return;

    if (activeCountEl) activeCountEl.textContent = `${customersArray.length} Customer${customersArray.length !== 1 ? 's' : ''}`;

    if (customersArray.length === 0) {
        el.innerHTML = '<div style="padding:60px; text-align:center; color:var(--text-secondary);"><i class="fas fa-search" style="font-size:32px; opacity:0.3; margin-bottom:15px;"></i><p>No matching agricultural customers found.</p></div>';
        return;
    }

    el.innerHTML = `
        <div class="premium-table-wrapper">
            <table class="premium-table">
                <thead>
                    <tr>
                        <th>Customer</th>
                        <th>Account Details</th>
                        <th>Balance</th>
                        <th>Status</th>
                        <th style="text-align:center;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${customersArray.map(c => {
                        const approvedAcc = c.approvedAccounts[0];
                        if (!approvedAcc) return '';
                        
                        return `
                            <tr class="clickable-row">
                                <td>
                                    <div style="font-weight:700;">${escHtml(c.name)}</div>
                                    <div style="font-size:11px;color:var(--text-secondary);">UID: #${c.id} | ${escHtml(c.email || '—')}</div>
                                </td>
                                <td>
                                    <div style="font-size:13px; font-weight:600; color:var(--text-primary); margin-bottom: 2px;">
                                        <i class="fas fa-id-card-alt" style="color:var(--text-secondary); width: 16px;"></i> ${approvedAcc.account_number}
                                    </div>
                                    <div style="font-size:11px; color:var(--text-secondary);">IFSC: ${approvedAcc.ifsc}</div>
                                </td>
                                <td>
                                    <div style="font-size:14px; font-weight:700; color:var(--text-primary);">₹${Number(approvedAcc.balance).toLocaleString('en-IN')}</div>
                                </td>
                                <td>
                                    <span class="status-badge success"><i class="fas fa-check-circle"></i> Approved</span>
                                </td>
                                <td>
                                    <div style="display:flex; gap:6px; justify-content:center;">
                                        <button class="action-btn-circle success" style="width:28px;height:28px;font-size:12px;" title="Deposit Money" onclick="event.stopPropagation(); depositMoney(${approvedAcc.id}, '${approvedAcc.account_number}')">
                                            <i class="fas fa-plus"></i>
                                        </button>
                                        <button class="action-btn-circle danger" style="width:28px;height:28px;font-size:12px;" title="Withdraw Money" onclick="event.stopPropagation(); withdrawMoney(${approvedAcc.id}, '${approvedAcc.account_number}')">
                                            <i class="fas fa-minus"></i>
                                        </button>
                                        <button class="action-btn-circle" style="width:28px;height:28px;font-size:12px;background:rgba(59,130,246,0.1);color:#3b82f6;" title="Edit Customer" onclick="event.stopPropagation(); window.currentEditCustomer = {id: ${c.id}, name: '${escHtml(c.name || '').replace(/'/g, "\\'")}', email: '${escHtml(c.email || '').replace(/'/g, "\\'")}', phone: '${escHtml(c.phone || '').replace(/'/g, "\\'")}', address: '${escHtml(c.address || '').replace(/'/g, "\\'")}', dob: '${c.date_of_birth || ''}'}; showEditCustomerModal();">
                                            <i class="fas fa-user-edit"></i>
                                        </button>
                                        <button class="action-btn-circle warning" style="width:28px;height:28px;font-size:12px;background:rgba(245,158,11,0.1);color:#f59e0b;" title="${c.transact_restricted ? 'Unrestrict' : 'Restrict'} User" onclick="event.stopPropagation(); toggleUserRestriction(${c.id}, ${c.transact_restricted || 0}, '${escHtml(c.name || '').replace(/'/g, "\\'")}')">
                                            <i class="fas ${c.transact_restricted ? 'fa-unlock' : 'fa-lock'}"></i>
                                        </button>
                                        <button class="action-btn-circle delete" style="width:28px;height:28px;font-size:12px;" title="Delete User" onclick="event.stopPropagation(); deleteUser(${c.id}, '${escHtml(c.name || '').replace(/'/g, "\\'")}')">
                                            <i class="fas fa-trash-alt"></i>
                                        </button>
                                        <button class="action-btn-circle view" style="width:28px;height:28px;font-size:12px;" title="View Hub Profile" onclick="event.stopPropagation(); viewUserActivity(${c.id}, '${escHtml(c.name || '').replace(/'/g, "\\'")}')">
                                            <i class="fas fa-external-link-alt"></i>
                                        </button>
                                        ${(c.loans && c.loans[0] && c.loans[0].farm_coordinates) ? `
                                            <button class="action-btn-circle" style="width:28px;height:28px;font-size:12px;background:rgba(16,185,129,0.1); color:var(--success);" title="Show Land Map" onclick="event.stopPropagation(); showAgriHubMap(${c.id})">
                                                <i class="fas fa-satellite"></i>
                                            </button>
                                        ` : ''}
                                    </div>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// Add Agriculture Customer Modal Handlers (Admin)
window.showAddAgriCustomerModal = function() {
    const modal = document.getElementById('addAgriCustomerModal');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
    }
};

window.closeAddAgriCustomerModal = function() {
    const modal = document.getElementById('addAgriCustomerModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.style.display = 'none', 300);
    }
};

window.submitAddAgriCustomer = async function(event) {
    event.preventDefault();
    const btn = document.getElementById('addAgriCustomerBtn');
    const form = event.target;
    if (!form) return;
    
    // We use FormData to handle the passport size photo file upload automatically
    const formData = new FormData(form);

    btn.disabled = true;
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

    try {
        const res = await fetch(API + '/agri/staff/create_customer', {
            method: 'POST',
            credentials: 'include',
            body: formData
        });
        const data = await res.json();

        if (res.ok && data.success) {
            closeAddAgriCustomerModal();
            showToast(data.message || 'Agriculture Customer created successfully!', 'success');
            form.reset();
            if (typeof loadAgriHubPage === 'function') loadAgriHubPage();
        } else {
            showToast(data.error || 'Failed to create agriculture customer', 'error');
        }
    } catch (err) {
        console.error('Agri Customer Creation Error:', err);
        showToast('Network error while creating agriculture customer', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
    }
};

async function viewAgriHubDetails(userId) {
    if (!userId) return;
    try {
        const customer = _allAgriHubCustomers.find(c => c.id == userId);
        if (!customer) return showToast('Customer data not found', 'error');

        const r = customer.requests[0];
        const l = customer.loans[0];
        const approvedAcc = customer.approvedAccounts[0];

        showLandMap(
            r ? r.id : (l ? l.id : (approvedAcc ? approvedAcc.id : 0)),
            l ? (l.lat || 0) : (r ? (r.signup_lat || r.lat || 0) : 0),
            l ? (l.lng || 0) : (r ? (r.signup_lng || r.lng || 0) : 0),
            l ? l.land_size_acres : 1,
            l ? l.crop_type : 'Agriculture Hub',
            customer.name,
            l ? (l.ai_score || 0) : 0,
            l ? l.geometry : (r ? r.geometry : null),
            r ? r.aadhaar_number : '—',
            r ? r.pan_number : '—',
            customer.email || '—'
        );

        if (approvedAcc) {
            setTimeout(() => {
                const detailsGrid = document.querySelector('.land-map-details-grid');
                if (detailsGrid) {
                    const bankSection = document.createElement('div');
                    bankSection.style.marginTop = '20px';
                    bankSection.style.paddingTop = '15px';
                    bankSection.style.borderTop = '1px solid #e2e8f0';
                    bankSection.innerHTML = `
                        <div style="font-size:11px; color:#94a3b8; font-weight:700; text-transform:uppercase; margin-bottom:10px;">Banking Assets</div>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:12px;">
                            <div><span style="color:#94a3b8;">Acc No:</span> <strong style="font-family:monospace;">${approvedAcc.account_number}</strong></div>
                            <div><span style="color:#94a3b8;">IFSC:</span> <strong>${approvedAcc.ifsc}</strong></div>
                            <div style="grid-column: span 2;"><span style="color:#94a3b8;">Balance:</span> <strong style="color:var(--success); font-size:14px;">₹${approvedAcc.balance.toLocaleString('en-IN')}</strong></div>
                        </div>
                    `;
                    detailsGrid.appendChild(bankSection);
                }
            }, 500);
        }
    } catch (e) {
        console.error('Agri Hub Details Error:', e);
    }
}

async function showAgriHubMap(userId) { viewAgriHubDetails(userId); }

function showLandMap(loanId, lat, lng, sizeAcres = 1, cropType = 'General', applicant = 'Applicant', score = 0, geometry = null, aadhaar = '—', pan = '—', email = '—') {
    currentAgriLoanId = loanId;
    openModal('landMapModal');
    
    if($id('landDetailName')) $id('landDetailName').textContent = applicant || 'Applicant';
    if($id('landDetailEmail')) $id('landDetailEmail').textContent = email || '—';
    if($id('landDetailAadhaar')) $id('landDetailAadhaar').textContent = aadhaar || '—';
    if($id('landDetailPan')) $id('landDetailPan').textContent = pan || '—';
    if($id('landDetailCrop')) $id('landDetailCrop').textContent = cropType || 'General';
    if($id('landDetailSize')) $id('landDetailSize').textContent = (sizeAcres || 1) + ' Acres';
    if($id('landDetailScore')) $id('landDetailScore').textContent = score || '0';
    if($id('landScoreProgress')) $id('landScoreProgress').style.width = (score || 0) + '%';

    const latNum = parseFloat(lat || 0);
    const lngNum = parseFloat(lng || 0);
    if($id('landDetailCoords')) $id('landDetailCoords').textContent = `${latNum.toFixed(4)}, ${lngNum.toFixed(4)}`;
    
    const scoreColor = score >= 75 ? "#10b981" : (score >= 50 ? "#f59e0b" : (score > 0 ? "#ef4444" : "#6b7280"));
    if($id('landDetailScore')) $id('landDetailScore').style.color = scoreColor;
    if($id('landScoreProgress')) $id('landScoreProgress').style.background = scoreColor;

    setTimeout(() => {
        if (!agriMap) {
            agriMap = L.map('agriLandMap', { zoomControl: true, layers: [agriMapLayers.satellite] });
        }
        agriMarkers.forEach(m => agriMap.removeLayer(m));
        agriMarkers = [];

        let polygonCoords = null;
        if (geometry) {
            try {
                polygonCoords = typeof geometry === 'string' ? JSON.parse(geometry) : geometry;
                if (!Array.isArray(polygonCoords) || polygonCoords.length < 3) polygonCoords = null;
            } catch (e) { polygonCoords = null; }
        }

        const plotColor = score >= 75 ? "#10b981" : (score >= 50 ? "#f59e0b" : (score > 0 ? "#ef4444" : "#3b82f6"));
        let landLayer = null;

        if (polygonCoords) {
            landLayer = L.polygon(polygonCoords, { color: plotColor, weight: 3, fillOpacity: 0.3 }).addTo(agriMap);
            agriMap.fitBounds(landLayer.getBounds(), { padding: [20, 20] });
        } else {
            agriMap.setView([latNum, lngNum], 17);
            const sideMeters = Math.sqrt((sizeAcres || 1) * 4046.86);
            const latOffset = (sideMeters / 111320) / 2;
            const lngOffset = (sideMeters / (111320 * Math.cos(latNum * Math.PI / 180))) / 2;
            const bounds = [[latNum - latOffset, lngNum - lngOffset], [latNum + latOffset, lngNum + lngOffset]];
            landLayer = L.rectangle(bounds, { color: plotColor, weight: 3, fillOpacity: 0.25, dashArray: '5, 10' }).addTo(agriMap);
        }
        
        const marker = L.marker([latNum, lngNum]).addTo(agriMap).bindPopup(`<b>${applicant}</b><br>${cropType}`).openPopup();
        agriMarkers.push(landLayer, marker);
        agriMap.invalidateSize();
    }, 300);
}

function changeAgriMapLayer(type) {
    if(!agriMap) return;
    Object.values(agriMapLayers).forEach(layer => agriMap.removeLayer(layer));
    agriMap.addLayer(agriMapLayers[type]);
    if($id('agriSatBtn')) $id('agriSatBtn').classList.toggle('active', type === 'satellite');
    if($id('agriTerrBtn')) $id('agriTerrBtn').classList.toggle('active', type === 'terrain');
}

function openAgriStatusInModal() {
    showToast('Decision system available in staff dashboard.', 'info');
}

function deleteAdmin(id, name) {
    showConfirm({
        title: 'Delete Administrator',
        message: `Are you sure you want to remove <strong>${name}</strong> from the system?`,
        warning: '⚠ This will revoke all administrative access for this user.',
        onConfirm: async () => {
            try {
                const response = await fetch(API + `/admin/admins/${id}`, {
                    method: 'DELETE',
                    credentials: 'include'
                });
                const data = await response.json();
                if (response.ok) {
                    showToast('Administrator removed successfully', 'success');
                    loadAdminManagementPage();
                } else {
                    showToast(data.error || 'Failed to remove admin', 'error');
                }
            } catch (e) {
                showToast('Network error removing admin', 'error');
            }
        }
    });
}

// ================================================================
// UPI MANAGEMENT
// ================================================================
let _upiUsers = [];

async function loadUpiManagementPage() {
    // Load stats
    try {
        const sRes = await fetch(`${API}/admin/upi/stats`, { credentials: 'include' });
        const sData = await sRes.json();
        if (sData.success) {
            const el = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
            el('upiStatUsers', sData.total_upi_users);
            el('upiStatTxTotal', sData.total_upi_transactions);
            el('upiStatVolume', '₹' + Number(sData.total_upi_volume).toLocaleString('en-IN'));
            el('upiStatToday', sData.today_upi_transactions);
        }
    } catch (e) { console.error('UPI stats error', e); }

    // Load UPI users
    const list = document.getElementById('upiUsersList');
    if (list) list.innerHTML = '<div style="text-align:center;padding:2rem;"><i class="fas fa-spinner fa-spin"></i></div>';
    try {
        const res = await fetch(`${API}/admin/upi/users`, { credentials: 'include' });
        const data = await res.json();
        _upiUsers = data.users || [];
        renderUpiUsers(_upiUsers);
        // Populate filter dropdown
        const filter = document.getElementById('upiTxFilter');
        if (filter) {
            filter.innerHTML = '<option value="">All Users</option>' +
                _upiUsers.map(u => `<option value="${u.id}">${escHtml(u.name)} (${escHtml(u.upi_id)})</option>`).join('');
        }
        // Auto-load transactions
        await loadUpiTransactions();
    } catch (e) {
        if (list) list.innerHTML = '<p style="text-align:center;color:#ef4444;padding:2rem;">Failed to load UPI data.</p>';
    }
}

function renderUpiUsers(users) {
    const list = document.getElementById('upiUsersList');
    if (!list) return;
    if (!users.length) {
        list.innerHTML = '<p style="text-align:center;padding:2rem;color:var(--text-secondary);">No UPI-registered users found.</p>';
        return;
    }
    list.innerHTML = `
    <div class="premium-table-wrapper">
        <table class="premium-table">
            <thead><tr>
                <th>User</th><th>UPI ID</th><th>Phone</th><th>Status</th>
                <th>UPI Sent</th><th>UPI Received</th><th>Tx Count</th><th>Actions</th>
            </tr></thead>
            <tbody>
                ${users.map(u => `
                <tr>
                    <td><div style="font-weight:700;">${escHtml(u.name)}</div><div style="font-size:11px;color:var(--text-secondary);">${escHtml(u.email)}</div></td>
                    <td><span style="font-family:monospace;background:rgba(128,0,0,0.07);color:#800000;padding:3px 8px;border-radius:6px;font-size:12px;">${escHtml(u.upi_id)}</span></td>
                    <td style="font-size:13px;">${escHtml(u.phone || '—')}</td>
                    <td><span class="status-badge ${u.status === 'active' ? 'success' : 'danger'}">${escHtml(u.status.toUpperCase())}</span></td>
                    <td style="color:#ef4444;font-weight:600;">₹${Number(u.upi_sent).toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                    <td style="color:#10b981;font-weight:600;">₹${Number(u.upi_received).toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                    <td style="text-align:center;font-weight:700;">${u.upi_tx_count}</td>
                    <td>
                        <button class="action-btn-circle delete" style="width:30px;height:30px;font-size:12px;" onclick="event.stopPropagation(); resetUserUpi(${u.id}, '${escHtml(u.name)}', '${escHtml(u.upi_id)}')" title="Reset UPI">
                            <i class="fas fa-redo"></i>
                        </button>
                    </td>
                </tr>`).join('')}
            </tbody>
        </table>
    </div>`;
}

function filterUpiUsers() {
    const q = (document.getElementById('upiUserSearch')?.value || '').toLowerCase();
    const filtered = q ? _upiUsers.filter(u =>
        (u.name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.upi_id || '').toLowerCase().includes(q)
    ) : _upiUsers;
    renderUpiUsers(filtered);
}

async function loadUpiTransactions() {
    const list = document.getElementById('upiTransactionsList');
    if (!list) return;
    const userId = document.getElementById('upiTxFilter')?.value || '';
    list.innerHTML = '<div style="text-align:center;padding:2rem;"><i class="fas fa-spinner fa-spin"></i></div>';
    try {
        const url = `${API}/admin/upi/transactions?limit=100${userId ? '&user_id=' + userId : ''}`;
        const res = await fetch(url, { credentials: 'include' });
        const data = await res.json();
        const txns = data.transactions || [];
        if (!txns.length) {
            list.innerHTML = '<p style="text-align:center;padding:2rem;color:var(--text-secondary);">No UPI transactions found.</p>';
            return;
        }
        list.innerHTML = `
        <div class="premium-table-wrapper">
            <table class="premium-table">
                <thead><tr>
                    <th>Ref#</th><th>User</th><th>UPI ID</th><th>Account</th>
                    <th>Type</th><th>Amount</th><th>Description</th><th>Date</th>
                </tr></thead>
                <tbody>
                    ${txns.map(t => `
                    <tr>
                        <td class="acc-num-display" style="font-size:11px;">${escHtml(t.reference_number || '—')}</td>
                        <td><div style="font-weight:700;font-size:13px;">${escHtml(t.user_name)}</div><div style="font-size:11px;color:var(--text-secondary);">${escHtml(t.user_email)}</div></td>
                        <td><span style="font-family:monospace;font-size:11px;background:rgba(128,0,0,0.07);color:#800000;padding:2px 6px;border-radius:5px;">${escHtml(t.upi_id || '—')}</span></td>
                        <td style="font-family:monospace;font-size:12px;">${escHtml(t.account_number)}</td>
                        <td><span class="status-badge ${t.type === 'credit' ? 'success' : 'danger'}">${escHtml(t.type.toUpperCase())}</span></td>
                        <td style="font-weight:700;color:${t.type === 'credit' ? '#10b981' : '#ef4444'};">
                            ${t.type === 'credit' ? '+' : '-'}₹${Number(t.amount).toLocaleString('en-IN', {minimumFractionDigits:2})}
                        </td>
                        <td style="font-size:12px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(t.description || '')}">${escHtml(t.description || '—')}</td>
                        <td style="font-size:12px;color:var(--text-secondary);">${new Date(t.transaction_date).toLocaleString('en-IN')}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </div>`;
    } catch (e) {
        list.innerHTML = '<p style="text-align:center;color:#ef4444;padding:2rem;">Failed to load UPI transactions.</p>';
    }
}

function resetUserUpi(userId, name, upiId) {
    showConfirm({
        title: 'Reset UPI',
        message: `Are you sure you want to reset the UPI ID <strong>${escHtml(upiId)}</strong> for <strong>${escHtml(name)}</strong>?`,
        warning: '⚠ The user will need to set up their UPI again from the mobile app.',
        onConfirm: async () => {
            try {
                const res = await fetch(`${API}/admin/upi/reset/${userId}`, { method: 'POST', credentials: 'include' });
                const data = await res.json();
                if (res.ok) {
                    showToast(data.message || 'UPI reset successfully', 'success');
                    loadUpiManagementPage();
                } else {
                    showToast(data.error || 'Failed to reset UPI', 'error');
                }
            } catch (e) {
                showToast('Network error', 'error');
            }
        }
    });
}
// =============================================
// LOCATIONS MANAGEMENT (BRANCHES & ATMS)
// =============================================

function showAddLocationModal() {
    const modal = document.getElementById('addLocationModal');
    if (!modal) return;
    document.getElementById('addLocationForm').reset();
    modal.classList.add('active');
}

async function submitAddLocation(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    
    try {
        const formData = new FormData();
        formData.append('name', document.getElementById('locName').value);
        formData.append('type', document.getElementById('locType').value);
        formData.append('lat', document.getElementById('locLat').value);
        formData.append('lng', document.getElementById('locLng').value);
        formData.append('city', document.getElementById('locCity').value);
        formData.append('address', document.getElementById('locAddress').value);
        
        const photoInput = document.getElementById('locPhoto');
        if (photoInput && photoInput.files.length > 0) {
            formData.append('photo', photoInput.files[0]);
        }
        
        const res = await fetch(`${API}/staff/locations`, {
            method: 'POST',
            credentials: 'include',
            body: formData
        });
        
        const data = await res.json();
        
        if (res.ok) {
            closeModal('addLocationModal');
            showToast('Location added successfully', 'success');
            loadLocationsTable();
        } else {
            showToast(data.error || 'Failed to add location', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Network error while saving location', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

async function loadLocationsTable() {
    const tbody = document.getElementById('locationsTable');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;"><i class="fas fa-spinner fa-spin"></i> Loading locations...</td></tr>';
    
    try {
        const res = await fetch(`${API}/user/locations`, { credentials: 'include' });
        const data = await res.json();
        
        if (res.ok && Array.isArray(data)) {
            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-secondary);">No branches or ATMs found.</td></tr>';
                return;
            }
            
            tbody.innerHTML = data.map(loc => `
                <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 12px; font-weight: 600;">${escHtml(loc.name)}</td>
                    <td style="padding: 12px;">
                        <span style="padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: bold; background: ${loc.type === 'atm' ? '#e2e8f0' : '#1e3a8a'}; color: ${loc.type === 'atm' ? '#475569' : 'white'};">
                            ${escHtml(loc.type.toUpperCase())}
                        </span>
                    </td>
                    <td style="padding: 12px;">${escHtml(loc.city || '')}</td>
                    <td style="padding: 12px; font-family: monospace; font-size: 12px;">${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}</td>
                    <td style="padding: 12px;">
                        <button onclick="deleteLocation(${loc.id})" class="btn btn-outline" style="color: #ef4444; border-color: #fca5a5; padding: 4px 8px; font-size: 12px;">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </td>
                </tr>
            `).join('');
        } else {
            throw new Error('Failed to fetch');
        }
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:#ef4444;">Failed to load locations.</td></tr>';
    }
}

async function deleteLocation(id) {
    if (!confirm('Are you sure you want to delete this location?')) return;
    try {
        const res = await fetch(`${API}/admin/locations/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        if (res.ok) {
            showToast('Location deleted', 'success');
            loadLocationsTable();
        } else {
            showToast('Failed to delete', 'error');
        }
    } catch (err) {
        showToast('Network error', 'error');
    }
}

// =============================================
// LOCATIONS MANAGEMENT (BRANCHES & ATMS)
// =============================================

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('active');
}

function showAddLocationModal() {
    const modal = document.getElementById('addLocationModal');
    if (!modal) return;
    document.getElementById('addLocationForm').reset();
    modal.classList.add('active');
}

async function submitAddLocation(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    
    try {
        const formData = new FormData();
        formData.append('name', document.getElementById('locName').value);
        formData.append('type', document.getElementById('locType').value);
        formData.append('lat', document.getElementById('locLat').value);
        formData.append('lng', document.getElementById('locLng').value);
        formData.append('city', document.getElementById('locCity').value);
        formData.append('address', document.getElementById('locAddress').value);
        
        const photoInput = document.getElementById('locPhoto');
        if (photoInput && photoInput.files.length > 0) {
            formData.append('photo', photoInput.files[0]);
        }
        
        const res = await fetch(`${API}/staff/locations`, {
            method: 'POST',
            credentials: 'include',
            body: formData
        });
        
        const data = await res.json();
        
        if (res.ok) {
            closeModal('addLocationModal');
            showToast('Location added successfully', 'success');
            loadLocationsTable();
        } else {
            showToast(data.error || 'Failed to add location', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Network error while saving location', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

async function loadLocationsTable() {
    const tbody = document.getElementById('locationsTable');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;"><i class="fas fa-spinner fa-spin"></i> Loading locations...</td></tr>';
    
    try {
        const res = await fetch(`${API}/user/locations`, { credentials: 'include' });
        const data = await res.json();
        
        if (res.ok && Array.isArray(data)) {
            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-secondary);">No branches or ATMs found.</td></tr>';
                return;
            }
            
            tbody.innerHTML = data.map(loc => `
                <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 12px; font-weight: 600;">${escHtml(loc.name)}</td>
                    <td style="padding: 12px;">
                        <span style="padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: bold; background: ${loc.type === 'atm' ? 'rgba(100, 116, 139, 0.1)' : 'rgba(128, 0, 0, 0.1)'}; color: ${loc.type === 'atm' ? '#475569' : '#800000'};">
                            ${escHtml(loc.type.toUpperCase())}
                        </span>
                    </td>
                    <td style="padding: 12px;">${escHtml(loc.city || '')}</td>
                    <td style="padding: 12px; font-family: monospace; font-size: 12px;">${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}</td>
                    <td style="padding: 12px;">
                        <button onclick="deleteLocation(${loc.id})" class="btn" style="color: #ef4444; background: rgba(239, 68, 68, 0.1); border: none; padding: 6px 12px; font-size: 12px; border-radius: 6px; cursor: pointer;">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </td>
                </tr>
            `).join('');
        } else {
            throw new Error('Failed to fetch');
        }
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:#ef4444;">Failed to load locations.</td></tr>';
    }
}

async function deleteLocation(id) {
    if (!confirm('Are you sure you want to delete this location?')) return;
    try {
        const res = await fetch(`${API}/staff/locations/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        if (res.ok) {
            showToast('Location deleted', 'success');
            loadLocationsTable();
        } else {
            const data = await res.json();
            showToast(data.error || 'Failed to delete', 'error');
        }
    } catch (err) {
        showToast('Network error', 'error');
    }
}

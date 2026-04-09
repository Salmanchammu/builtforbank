window.API = window.SMART_BANK_API_BASE || '/api';

// Global Map Variables
let _staffMap = null;
let _dashboardMap = null; 
let _staffMapMarkers = [];
let _staffMapAllData = [];
var _allAgriHubCustomers = []; // Moved to top to avoid initialization errors

// DOM helper — shorthand for getElementById (used by Agri Map functions)
function $id(id) { return document.getElementById(id); }

// Alias: Agri map code uses openModal() but staff dashboard defines showModal()
function openModal(id) { showModal(id); }

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('active');
}

// Shared currency formatter — always renders as ₹1,00,000
function fmtINR(n) {
    return '₹' + parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}


// Redundant showConfirm and showPrompt removed (handled by premium-ui.js)

// Real-time polling logic will be handled at the bottom of the file

// refreshStaffData removed in favor of page-aware auto-refresh

// Staff Dashboard - New Modern Design
// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {

    // Initialize Face Models
    if (window.faceAuthManager) {
        window.faceAuthManager.loadFaceAPIModels();
    }

    initializeDashboard();
    initTheme();
    setupEventListeners();
    loadStaffInfo();
    loadDashboardData();
    // initSecurity(); // Removed to silence screenshot alerts

    // Set up real-time polling (every 30 seconds)
    setInterval(() => {
        // Only refresh if the dashboard tab is active to save resources
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
});

/**
 * Deterrence measures for financial data security
 */
// Screenshot and Privacy Protection removed to improve UX
function initSecurity() {
    // Measures removed as per user request
}

// Initialize Dashboard
function initializeDashboard() {
    // Check if staff is logged in
    const staff = JSON.parse(localStorage.getItem('staff'));
    if (!staff) {
        const loginUrl = (window.SmartBankDeviceDetector && window.SmartBankDeviceDetector.getLoginUrl) ? window.SmartBankDeviceDetector.getLoginUrl() : 'user.html';
        window.location.href = loginUrl;
        return;
    }

    // Set staff info in sidebar
    const nameEl = document.getElementById('staffName');
    const roleEl = document.getElementById('staffRole');
    if (nameEl) nameEl.textContent = staff.name || 'Staff Member';
    if (roleEl) roleEl.textContent = staff.department || 'Staff';

    // Update avatar
    const staffAvatar = document.getElementById('staffAvatar');
    const topBarAvatar = document.getElementById('topBarAvatar');
    const safeName = encodeURIComponent(staff.name || 'Staff');
    
    let avatarUrl;
    if (staff.profile_image) {
        avatarUrl = `${API}/staff/profile-image/${staff.profile_image}`;
    } else {
        avatarUrl = `https://ui-avatars.com/api/?name=${safeName}&background=10b981&color=fff&rounded=true&bold=true`;
    }

    if (staffAvatar) staffAvatar.src = avatarUrl;
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

    // Transaction Search functionality
    const transactionSearch = document.getElementById('transactionSearch');
    if (transactionSearch) {
        transactionSearch.addEventListener('input', (e) => {
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
    // Also sync settings toggle if it exists
    const settingsToggle = document.getElementById('darkModeToggleSettings');
    if (settingsToggle) settingsToggle.checked = isDark;
}

/**
 * Bridge function for settings page toggle
 */
function toggleDarkMode(enabled) {
    const isCurrentlyDark = document.body.classList.contains('dark-theme');
    if (enabled !== isCurrentlyDark) {
        toggleTheme();
    }
}

/**
 * Handle notification sound preferences
 */
function toggleNotificationSounds(enabled) {
    localStorage.setItem('notifSounds', enabled);
    if (typeof showToast === 'function') {
        showToast(`Notification sounds ${enabled ? 'enabled' : 'disabled'}`, 'success');
    }
}


// Load Staff Info
function loadStaffInfo() {
    const staff = JSON.parse(localStorage.getItem('staff'));
    if (!staff) return;

    // Update header
    const headerStaffName = document.querySelector('.header-left .subtitle span') || document.getElementById('staffGreeting');
    if (headerStaffName) {
        headerStaffName.textContent = staff.name || 'Staff Member';
    }
}

// Load Dashboard Data
async function loadDashboardData(isRefresh = false) {
    try {
        // Try to fetch from backend with session credentials
        const response = await fetch(API + '/staff/dashboard', {
            credentials: 'include'  // Include session cookie
        });

        if (response.ok) {
            const data = await response.json();
            console.log('Staff dashboard data loaded:', data);
            updateDashboardStats(data.stats);
            loadRecentActivities(data.recent_activities || []);
            loadPendingTasks(data.pending_loans || []);
            loadRecentTransactions(data.recent_transactions || []);
            // Also load pending approvals to update the navigation badge
            loadApprovalsPage();
            initDashboardMap(isRefresh);
            loadLocationsTable();
        } else {
            console.error('Failed to load dashboard data:', response.status);
            if (response.status === 401) {
                localStorage.removeItem('staff');
                window.location.href = 'user.html';
                return;
            }
            // Default empty stats
            updateDashboardStats({});
        }

        // Fetch Loan Liquidity Fund separately (any authenticated user can see)
        try {
            const fundRes = await fetch(API + '/system/liquidity-fund', { credentials: 'include' });
            if (fundRes.ok) {
                const fundData = await fundRes.json();
                const el = document.getElementById('statLiquidityFund');
                if (el && fundData.balance !== undefined) {
                    const fund = parseFloat(fundData.balance);
                    el.textContent = fund >= 100000
                        ? `₹${(fund / 100000).toFixed(1)}L`
                        : `₹${fund.toLocaleString('en-IN')}`;
                }
            }
        } catch (e) { /* Silently fail, display = default */ }

    } catch (error) {
        console.error('Error loading dashboard data:', error);
        updateDashboardStats({});
    }
}

function searchServiceApplications(query) {
    const table = document.querySelector('#pendingApplicationsList .premium-table');
    if (!table) return;
    
    // Clear any active button filters
    document.querySelectorAll('#services .quick-action-btn').forEach(btn => {
        btn.style.borderColor = '#e5e7eb';
        btn.style.background = '#fff';
    });

    const rows = table.querySelectorAll('tbody tr');
    const lowerQuery = query.toLowerCase().trim();
    let count = 0;
    
    rows.forEach(row => {
        const textContent = row.textContent.toLowerCase();
        if (textContent.includes(lowerQuery)) {
            row.style.display = '';
            count++;
        } else {
            row.style.display = 'none';
        }
    });
}

function filterServices(type) {
    const table = document.querySelector('#pendingApplicationsList .premium-table');
    if (!table) {
        showToast('No pending applications to filter.', 'info');
        return;
    }
    
    // Reset all buttons
    document.querySelectorAll('#services .quick-action-btn').forEach(btn => {
        btn.style.borderColor = '#e5e7eb';
        btn.style.background = '#fff';
    });
    
    // Highlight active button (unless type is all)
    if (type !== 'all') {
        const buttons = document.querySelectorAll('#services .quick-action-btn span');
        buttons.forEach(span => {
            const text = span.textContent.toLowerCase();
            const filterText = type.replace('_', ' ').toLowerCase();
            if (text.includes(filterText) || filterText.includes(text)) {
                const btn = span.closest('button');
                btn.style.borderColor = 'var(--primary)';
                btn.style.background = 'rgba(128,0,0,0.02)';
            }
        });
    }

    const rows = table.querySelectorAll('tbody tr');
    let count = 0;
    rows.forEach(row => {
        const serviceCell = row.querySelector('td:nth-child(3) .status-badge');
        if (serviceCell) {
            const serviceType = serviceCell.textContent.toLowerCase();
            const filterType = type.replace('_', ' ').toLowerCase();
            
            if (type === 'all' || serviceType.includes(filterType) || filterType.includes(serviceType)) {
                row.style.display = '';
                count++;
            } else {
                row.style.display = 'none';
            }
        }
    });
    
    if (count === 0 && type !== 'all') {
        setTimeout(() => showToast(`No pending applications found for ${type.replace('_', ' ')}.`, 'info'), 100);
    }
}

// Load Mock Data
function loadMockData() {
    // Mock stats
    updateDashboardStats({
        myCustomers: 24,
        pendingTasks: 7,
        todayDeposits: 125000,
        completedToday: 15,
        customerGrowth: '+8.5%'
    });

    // Mock recent customers
    const mockCustomers = [
        { id: 1, name: 'Rahul Sharma', email: 'rahul@example.com', avatar: 'RS' },
        { id: 2, name: 'Priya Patel', email: 'priya@example.com', avatar: 'PP' },
        { id: 3, name: 'Amit Kumar', email: 'amit@example.com', avatar: 'AK' },
        { id: 4, name: 'Sneha Gupta', email: 'sneha@example.com', avatar: 'SG' },
        { id: 5, name: 'Vikram Singh', email: 'vikram@example.com', avatar: 'VS' }
    ];
    loadRecentCustomers(mockCustomers);

    // Mock pending tasks
    const mockTasks = [
        { id: 1, title: 'Account Verification', customer: 'Rahul Sharma', priority: 'high' },
        { id: 2, title: 'Loan Application Review', customer: 'Priya Patel', priority: 'medium' },
        { id: 3, title: 'Card Activation', customer: 'Amit Kumar', priority: 'low' },
        { id: 4, title: 'Document Collection', customer: 'Sneha Gupta', priority: 'high' }
    ];
    loadPendingTasks(mockTasks);

    // Mock recent transactions
    const mockTransactions = [
        { id: 'TXN001', customer: 'Rahul Sharma', account: '****1234', type: 'Deposit', amount: 25000, date: '2026-02-06', status: 'completed' },
        { id: 'TXN002', customer: 'Priya Patel', account: '****5678', type: 'Withdrawal', amount: 15000, date: '2026-02-06', status: 'completed' },
        { id: 'TXN003', customer: 'Amit Kumar', account: '****9012', type: 'Transfer', amount: 50000, date: '2026-02-06', status: 'pending' }
    ];
    loadRecentTransactions(mockTransactions);
}

// Update Dashboard Stats
function updateDashboardStats(stats) {
    const statCustomers = document.getElementById('statCustomers');
    const statAccounts = document.getElementById('statAccounts');
    const statLoans = document.getElementById('statLoans');
    const statBalance = document.getElementById('statBalance');

    const statCustomersTrend = document.getElementById('statCustomersTrend');
    const statAccountsTrend = document.getElementById('statAccountsTrend');
    const statLoansTrend = document.getElementById('statLoansTrend');

    const loanBadge = document.getElementById('loanBadge');

    if (statCustomers) statCustomers.textContent = stats.total_customers || 0;
    if (statAccounts) statAccounts.textContent = stats.total_accounts || 0;
    if (statLoans) statLoans.textContent = stats.pending_loans || 0;
    if (statBalance) statBalance.textContent = `₹${(stats.total_balance || 0).toLocaleString('en-IN')}`;

    // Update Trends
    if (statCustomersTrend) {
        const trend = stats.customer_trend || '0%';
        const isPositive = !trend.startsWith('-');
        statCustomersTrend.className = `stat-change ${isPositive ? 'positive' : 'negative'}`;
        statCustomersTrend.innerHTML = `<i class="fas fa-arrow-${isPositive ? 'up' : 'down'}"></i> ${trend}<br>this month`;
    }

    if (statAccountsTrend) {
        const trend = stats.account_trend || '0%';
        const isPositive = !trend.startsWith('-');
        statAccountsTrend.className = `stat-change ${isPositive ? 'positive' : 'negative'}`;
        statAccountsTrend.innerHTML = `<i class="fas fa-arrow-${isPositive ? 'up' : 'down'}"></i> ${trend}<br>this month`;
    }

    if (statLoansTrend) {
        const trend = stats.loan_trend || 'No change';
        statLoansTrend.innerHTML = `<i class="fas fa-minus"></i> ${trend}<br>this month`;
    }

    // Update loan badge in navigation if it exists
    if (loanBadge) loanBadge.textContent = stats.pending_loans || 0;
    
    // Also update the "Pending Tasks" count in the nav menu if applicable
    const pendingApprovalsBadge = document.getElementById('pendingApprovalsBadge');
    if (pendingApprovalsBadge) {
        // Ideally this should be a combined count of KYC + Services, but for now let's keep it simple
    }
}

// Load Recent Activities (Logs) on Dashboard
function loadRecentActivities(activities) {
    const container = document.getElementById('recentActivities');
    if (!container) return;

    if (!activities || activities.length === 0) {
        container.innerHTML = '<p style="padding: 1rem; text-align: center; color: #9ca3af;">No recent activities</p>';
        return;
    }

    container.innerHTML = activities.map(act => {
        const date = new Date(act.created_at);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        return `
            <div style="display:flex;align-items:flex-start;gap:12px;padding:12px 16px;border-bottom:1px solid var(--border-color,#e5e7eb);background:var(--bg-card);margin-bottom:8px;border-radius:12px;box-shadow:0 2px 4px rgba(0,0,0,0.02);">
                <div style="width: 36px; height: 36px; background: rgba(16, 185, 129, 0.1); color: #10b981; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0;">
                    <i class="fas fa-history"></i>
                </div>
                <div style="flex:1;">
                    <div style="font-weight:600;font-size:13px;color:var(--text-primary);">${act.action || 'Activity'}</div>
                    <div style="font-size:12px;color:#6b7280;margin-top:2px;">User: ${act.user_name || 'System'}</div>
                    <div style="font-size:11px;color:#9ca3af;margin-top:4px;">${date.toLocaleDateString()} • ${timeStr}</div>
                </div>
            </div>
        `;
    }).join('');
}


// Load Staff Transactions page — fetches real data
async function loadStaffTransactions() {
    const el = document.getElementById('allTransactionsList');
    if (!el) return;
    el.innerHTML = '<div style="padding:16px;color:#9ca3af;"><i class="fas fa-spinner fa-spin"></i> Loading transactions...</div>';
    try {
        const r = await fetch(API + '/staff/transactions', { credentials: 'include' });
        if (!r.ok) throw new Error();
        const data = await r.json();
        const txns = data.transactions || [];
        if (!txns.length) {
            el.innerHTML = '<div class="premium-table-wrapper"><p style="padding:2rem;text-align:center;color:#9ca3af;">No transactions found.</p></div>';
            return;
        }

        el.innerHTML = `
            <div class="premium-table-wrapper">
                <table class="premium-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Customer</th>
                            <th>Account</th>
                            <th>Type</th>
                            <th>Amount</th>
                            <th>Date</th>
                            <th>Mode</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${txns.map(t => `
                            <tr>
                                <td class="acc-num-display" style="font-size:12px;">#${escHtml(t.id)}</td>
                                <td class="clickable-cell" onclick="viewUserActivity(${t.user_id}, '${escHtml(t.user_name || '').replace(/'/g, "\\'")}')">
                                    <div style="font-weight:700;">${escHtml(t.user_name || '—')}</div>
                                </td>
                                <td class="acc-num-display">${escHtml(t.account_number || '—')}</td>
                                <td>
                                    <span class="status-badge ${t.type === 'credit' ? 'success' : 'danger'}">
                                        ${escHtml((t.type || '').toUpperCase())}
                                    </span>
                                </td>
                                <td style="font-weight:800;" class="${t.type === 'credit' ? 'text-success' : 'text-danger'}">
                                    ${t.type === 'credit' ? '+' : '-'}₹${Number(t.amount || 0).toLocaleString('en-IN')}
                                </td>
                                <td>${new Date(t.transaction_date).toLocaleDateString('en-IN')}</td>
                                <td><span class="status-badge" style="background:#e0f2fe;color:#0369a1;font-size:10px;">${escHtml(t.mode || 'CASH')}</span></td>
                                <td><span class="status-badge success">COMPLETED</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>`;
    } catch (e) {
        el.innerHTML = '<div class="premium-table-wrapper"><p style="padding:2rem;color:#ef4444;text-align:center;">Failed to load transactions.</p></div>';
    }
}

// Helper for editing account directly from list
window.openEditAccountFromList = function(accountData) {
    window.currentEditAccount = accountData;
    showEditAccountModal();
};

// Load Staff Accounts page — fetches real data
async function loadStaffAccounts() {
    const el = document.getElementById('accountsList');
    if (!el) return;
    el.innerHTML = '<p style="padding:16px;color:#9ca3af;">Loading accounts...</p>';
    try {
        const r = await fetch(API + '/staff/accounts', { credentials: 'include' });
        if (!r.ok) throw new Error();
        const data = await r.json();
        const accounts = data.accounts || data || [];
        if (!accounts.length) { el.innerHTML = '<p style="padding:16px;text-align:center;color:#9ca3af;">No accounts found.</p>'; return; }

        // Store globally so the helper can find them if needed, though we'll pass inline
        window.allStaffAccountsRaw = accounts;

        el.innerHTML = `
            <div class="premium-table-wrapper">
                <table class="premium-table">
                    <thead>
                        <tr>
                            ${['Account No.', 'Customer', 'Type', 'Balance', 'Status', 'IFSC', 'Branch', 'Actions'].map(h => `<th>${escHtml(h)}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${accounts.map((a, idx) => `
                            <tr>
                                <td class="clickable-cell" onclick="viewAccount(${a.id})">
                                    <div class="acc-num-display">${escHtml(a.account_number)}</div>
                                </td>
                                <td class="clickable-cell" onclick="viewAccount(${a.id})">
                                    <div style="font-weight: 600; color: var(--text-primary);">${escHtml(a.user_name || '—')}</div>
                                </td>
                                <td class="clickable-cell" onclick="viewAccount(${a.id})">
                                    <span style="font-size: 13px; color: var(--text-secondary); text-transform: capitalize;">${escHtml(a.account_type)}</span>
                                </td>
                                <td class="clickable-cell" onclick="viewAccount(${a.id})" style="font-family: 'Inter', sans-serif; font-weight: 800; color: var(--primary-color);">
                                    ₹${(a.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                </td>
                                <td class="clickable-cell" onclick="viewAccount(${a.id})">
                                    <span class="status-badge ${a.status === 'active' ? 'success' : 'danger'}">${escHtml(a.status)}</span>
                                </td>
                                <td class="clickable-cell" onclick="viewAccount(${a.id})" style="font-size: 12px; color: var(--text-secondary); font-family: monospace;">${escHtml(a.ifsc || '—')}</td>
                                <td class="clickable-cell" onclick="viewAccount(${a.id})" style="font-size: 12px; color: var(--text-secondary);">${escHtml(a.branch || '—')}</td>
                                <td>
                                    <div style="display:flex; gap:8px; align-items: center;">
                                        <button onclick="event.stopPropagation(); openEditAccountFromList(window.allStaffAccountsRaw[${idx}])" class="action-btn-circle" style="background:var(--bg-secondary);color:var(--primary-color);" title="Edit Account">
                                            <i class="fas fa-pen"></i>
                                        </button>
                                        <button onclick="event.stopPropagation(); depositMoney(${a.id}, '${escHtml(a.account_number)}')" class="action-btn-circle deposit" title="Deposit Money">
                                            <i class="fas fa-plus"></i>
                                        </button>
                                        <button onclick="event.stopPropagation(); withdrawMoney(${a.id}, '${escHtml(a.account_number)}')" class="action-btn-circle withdraw" title="Withdraw Money">
                                            <i class="fas fa-minus"></i>
                                        </button>
                                        <button onclick="event.stopPropagation(); deleteAccount(${a.id},'${escHtml(a.account_number)}')" class="action-btn-circle delete" title="Close Account">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>`;
    } catch (e) {
        console.error(e);
        el.innerHTML = '<p style="padding:16px;color:#ef4444;">Failed to load accounts. Please try refreshing.</p>';
    }
}


// Load Pending Tasks (Unified Service Applications) on Dashboard
function loadPendingTasks(tasks) {
    const container = document.getElementById('pendingLoans') || document.getElementById('dashboardLoansList');
    if (!container) return;

    if (!tasks || tasks.length === 0) {
        container.innerHTML = '<p style="padding: 1rem; text-align: center; color: #9ca3af;">No pending tasks</p>';
        return;
    }

    const typeIcons = {
        'Loan': 'hand-holding-usd',
        'Investment': 'chart-line',
        'Card': 'credit-card',
        'Account': 'university'
    };

    const typeColors = {
        'Loan': '#f59e0b',
        'Investment': '#3b82f6',
        'Card': '#ef4444',
        'Account': '#10b981'
    };

    container.innerHTML = tasks.map(task => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--border-color,#e5e7eb);background:var(--bg-card);margin-bottom:8px;border-radius:12px;box-shadow:0 2px 4px rgba(0,0,0,0.05);">
            <div style="display:flex;align-items:center;gap:12px;">
                <div style="width: 40px; height: 40px; background: ${(typeColors[task.service_type] || '#6b7280')}15; color: ${typeColors[task.service_type] || '#6b7280'}; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px;">
                    <i class="fas fa-${escHtml(typeIcons[task.service_type] || 'tasks')}"></i>
                </div>
                <div>
                    <div style="font-weight:700;font-size:14px;color:var(--text-primary);">${escHtml(task.title || 'Task')}</div>
                    <div style="font-size:12px;color:#6b7280;margin-top:2px;">${escHtml(task.customer || 'Customer')} • ${escHtml(task.service_type)}</div>
                </div>
            </div>
            <button onclick="showPage('services')"
                style="padding:6px 14px;background:${typeColors[task.service_type] || '#6b7280'};color:white;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;box-shadow:0 4px 8px ${(typeColors[task.service_type] || '#6b7280')}40;">
                Review
            </button>
        </div>
    `).join('');
}

// Load Recent Transactions
function loadRecentTransactions(transactions) {
    const container = document.getElementById('transactionsList');
    if (!container) return;

    if (!transactions || transactions.length === 0) {
        container.innerHTML = '<table style="width: 100%; border-collapse: collapse;"><tr><td colspan="7" style="text-align: center; padding: 2rem; color: #9ca3af;">No recent transactions</td></tr></table>';
        return;
    }

    container.innerHTML = `
        <table style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr style="border-bottom: 1px solid var(--border-color); text-align: left; background: var(--bg-light); color: var(--text-secondary);">
                    <th style="padding: 12px;">ID</th>
                    <th style="padding: 12px;">Customer</th>
                    <th style="padding: 12px;">Account</th>
                    <th style="padding: 12px;">Type</th>
                    <th style="padding: 12px;">Amount</th>
                    <th style="padding: 12px;">Date</th>
                    <th style="padding: 12px;">Mode</th>
                    <th style="padding: 12px;">Status</th>
                </tr>
            </thead>
            <tbody>
                ${transactions.map(txn => `
                    <tr style="border-bottom: 1px solid var(--border-color);">
                        <td style="padding: 12px;"><strong>${escHtml(txn.id || txn.reference_number || '-')}</strong></td>
                        <td style="padding: 12px;">${escHtml(txn.customer || txn.user_name || 'Unknown')}</td>
                        <td style="padding: 12px;">${escHtml(txn.account || txn.account_number || 'Unknown')}</td>
                        <td style="padding: 12px;">
                            <span class="status-badge ${txn.type === 'debit' ? 'success' : 'danger'}">
                                ${escHtml((txn.type || '').toUpperCase())}
                            </span>
                        </td>
                        <td style="padding: 12px; font-weight: bold;" class="${txn.type === 'debit' ? 'text-success' : 'text-danger'}">
                            ${txn.type === 'debit' ? '+' : '-'}₹${Number(txn.amount || 0).toLocaleString('en-IN')}
                        </td>
                        <td style="padding: 12px;">${new Date(txn.date || txn.transaction_date).toLocaleString('en-IN')}</td>
                        <td style="padding: 12px;"><span class="status-badge" style="background:#e0f2fe;color:#0369a1;">${escHtml(txn.mode || 'CASH')}</span></td>
                        <td style="padding: 12px;">
                            <span class="status-badge ${txn.status || 'success'}">
                                ${escHtml(((txn.status || 'completed').charAt(0).toUpperCase() + (txn.status || 'completed').slice(1)))}
                            </span>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// Show Page — fixed to use .page-content class and active state
function showPage(pageName) {
    document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const target = document.getElementById(pageName);
    if (target) target.classList.add('active');

    document.querySelector(`.nav-item[data-page="${pageName}"]`)?.classList.add('active');

    // Update Page Title dynamically
    const titleMap = {
        'customers': 'Customer Management',
        'accounts': 'Account Management',
        'approvals': 'KYC Approvals',
        'agriaccounts': 'Agriculture Accounts',
        'salaryaccounts': 'Salary Accounts',
        'businessaccounts': 'Business Accounts',
        'transactions': 'Quick Transactions',
        'loans': 'Loan Requests',
        'agriloans': 'Agri Loans',
        'liquidity': 'Loan Liquidity Fund',
        'cards': 'Card Requests',
        'reports': 'System Reports',
        'profile': 'My Staff Profile',
        'settings': 'Dashboard Settings',
        'attendance': 'Staff Attendance',
        'supportdesk': 'Support Desk',
        'services': 'Bank Services',
        'map': 'Live User Map',
        'agrihub': 'Agriculture Hub',
        'agribuyers': 'Retail Agri Buyers',
        'upi-management': 'UPI Management'
    };
    const titleEl = document.getElementById('pageTitle');
    if (titleEl) titleEl.textContent = titleMap[pageName] || 'Smart Bank';

    switch (pageName) {
        case 'dashboard': loadDashboardData(); break;
        case 'customers': loadCustomersPage(); break;
        case 'accounts': loadStaffAccounts(); break;
        case 'approvals': loadApprovalsPage(); break;
        case 'transactions': loadStaffTransactions(); break;
        case 'loans': loadLoansPage(); break;
        case 'agriloans': loadAgriLoansPage(); break;
        case 'agriaccounts': loadAgriAccountsPage(); break;
        case 'salaryaccounts': loadSalaryAccountsPage(); break;
        case 'businessaccounts': loadBusinessAccountsPage(); break;
        case 'liquidity': loadStaffLiquidityPage(); break;
        case 'cards': loadCardsPage(); break;
        case 'reports': loadReportsPage(); break;
        case 'profile': loadProfilePage(); break;
        case 'settings': loadSettingsPage(); break;
        case 'attendance': loadAttendancePage(); break;
        case 'supportdesk': loadSupportTickets(); break;
        case 'services': loadServicesPage(); break;
        case 'map': loadMapPage(); break;
        case 'agrihub': loadAgriHubPage(); break;
        case 'agribuyers': loadStaffAgriBuyers(); break;
        case 'upi-management': loadUpiManagementPage(); break;
    }
}

// =============================================
// STAFF: SERVICES & APPLICATIONS
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
                                <td class="acc-num-display">#${escHtml(a.id)}</td>
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
    } catch (e) {
        el.innerHTML = '<p style="padding:16px;color:#ef4444;">Failed to load applications.</p>';
    }
}

async function handleServiceApplication(appId, action) {
    const actionLabel = action === 'approve' ? 'Approve' : 'Reject';
    let reason = '';

    if (typeof showConfirm === 'function') {
        const confirmed = await showConfirm({
            title: `${actionLabel} this application?`,
            message: `Are you sure you want to ${action} application #${appId}?`
        });
        if (!confirmed) return;
    } else if (!confirm(`${actionLabel} application #${appId}?`)) {
        return;
    }

    if (action === 'reject') {
        if (typeof showPrompt === 'function') {
            reason = await showPrompt('Rejection Reason', 'Please provide a reason for rejection:');
        } else {
            reason = prompt('Please provide a reason for rejection:');
        }
        if (reason === null) return; // cancelled
    }

    try {
        const r = await fetch(`${API}/staff/service-applications/${appId}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, reason })
        });
        const data = await r.json();
        if (r.ok && data.success) {
            if (typeof showToast === 'function') {
                showToast(`Application ${action === 'approve' ? 'approved' : 'rejected'} successfully!`, 'success');
            } else {
                alert(`Application ${action === 'approve' ? 'approved' : 'rejected'} successfully!`);
            }
            loadServicesPage(); // Refresh the list
        } else {
            if (typeof showToast === 'function') {
                showToast(data.error || `Failed to ${action} application`, 'error');
            } else {
                alert(data.error || `Failed to ${action} application`);
            }
        }
    } catch (e) {
        console.error('handleServiceApplication error:', e);
        if (typeof showToast === 'function') {
            showToast('Network error. Please try again.', 'error');
        } else {
            alert('Network error. Please try again.');
        }
    }
}

async function loadLoansPage() {
    const el = document.getElementById('loansList');
    if (!el) return;
    el.innerHTML = '<p style="padding:16px;color:#9ca3af;">Loading loans...</p>';
    try {
        const r = await fetch(API + '/staff/loans', { credentials: 'include' });
        if (!r.ok) throw new Error();
        const data = await r.json();
        const loans = data.loans || [];

        if (!loans.length) {
            el.innerHTML = '<p style="padding:16px;text-align:center;color:#9ca3af;">No loan requests found.</p>';
            return;
        }

        el.innerHTML = `
            <div class="premium-table-wrapper">
                <table class="premium-table">
                    <thead><tr>
                        <th>ID</th><th>Customer</th><th>Loan Type</th><th>Amount</th>
                        <th>Outstanding</th><th>Status</th><th>Due Date</th><th style="text-align:center;">Actions</th>
                    </tr></thead>
                    <tbody>
                        ${loans.map(l => `
                            <tr>
                                <td class="acc-num-display">#${escHtml(l.id)}</td>
                                <td>
                                    <div style="font-weight:700;">${escHtml(l.user_name || '—')}</div>
                                    <div style="font-size:11px;color:var(--text-secondary);">${escHtml(l.user_email || '—')}</div>
                                </td>
                                <td>${escHtml(l.loan_type || '—')}</td>
                                <td style="font-weight:700;">₹${Number(l.loan_amount || 0).toLocaleString('en-IN')}</td>
                                <td style="font-weight:700;color:${Number(l.outstanding_amount) > 0 ? '#ef4444' : '#10b981'};">₹${Number(l.outstanding_amount || 0).toLocaleString('en-IN')}</td>
                                <td><span class="status-badge ${l.status === 'closed' ? 'success' : l.status === 'approved' ? 'warning' : 'danger'}">${escHtml(l.status === 'closed' ? 'PAID OFF' : (l.status || '').toUpperCase())}</span></td>
                                <td style="color:var(--text-secondary);font-size:12px;">${escHtml(l.next_due_date || '—')}</td>
                                <td style="text-align:center;">
                                    ${l.status === 'approved' ? `<span style="font-size:12px;color:#9ca3af;">Active</span>` : '—'}
                                    ${(l.lat && l.lng) ? `
                                        <div style="margin-top:4px;">
                                            <button onclick="event.stopPropagation(); showLandMap(${l.id}, ${l.lat}, ${l.lng}, 1, '${escHtml(l.loan_type)}', '${escHtml(l.user_name || '').replace(/'/g, "\\'")}', 0, ${l.geometry ? `'${l.geometry}'` : 'null'}, '—', '—', '${escHtml(l.user_email || '—')}')" 
                                                    class="btn btn-secondary btn-sm" style="font-size:10px;padding:2px 8px;">
                                                <i class="fas fa-satellite"></i> Map
                                            </button>
                                        </div>` : ''}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>`;
    } catch (e) {
        el.innerHTML = '<p style="padding:16px;color:#ef4444;">Failed to load loans.</p>';
    }
}

async function loadCardsPage() {
    const tableBody = document.getElementById('cardsTable');
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px;">Loading card requests...</td></tr>';
    try {
        const r = await fetch(API + '/staff/service-applications', { credentials: 'include' });
        if (!r.ok) throw new Error();
        const data = await r.json();
        const cards = (data.applications || []).filter(a => a.service_type === 'Card');

        if (!cards.length) {
            tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px;color:#9ca3af;">No card requests found.</td></tr>';
            return;
        }

        tableBody.innerHTML = cards.map(c => `
            <tr>
                <td class="acc-num-display">#${escHtml(c.id)}</td>
                <td>
                    <div style="font-weight:700;">${escHtml(c.user_name || '—')}</div>
                    <div style="font-size:11px;color:var(--text-secondary);">${escHtml(c.user_email || '—')}</div>
                </td>
                <td><span class="status-badge" style="background:rgba(239,68,68,0.1);color:#ef4444;">${escHtml(c.product_name.toUpperCase())}</span></td>
                <td style="font-family:monospace;">${escHtml(c.account_number || 'New Account')}</td>
                <td style="font-weight:700;">₹${Number(c.amount || 0).toLocaleString('en-IN')}</td>
                <td><span class="status-badge ${c.status === 'approved' ? 'success' : c.status === 'pending' ? 'warning' : 'danger'}">${escHtml(c.status.toUpperCase())}</span></td>
                <td style="color:var(--text-secondary);font-size:12px;">${c.applied_at ? new Date(c.applied_at).toLocaleDateString('en-IN') : '—'}</td>
                <td>
                    <div style="display:flex;gap:6px;justify-content:center;">
                        ${c.status === 'pending' ? `
                            <button class="action-btn-circle view" onclick="event.stopPropagation(); handleServiceApplication(${c.id}, 'approve')" title="Approve">
                                <i class="fas fa-check"></i>
                            </button>
                            <button class="action-btn-circle delete" onclick="event.stopPropagation(); handleServiceApplication(${c.id}, 'reject')" title="Reject">
                                <i class="fas fa-times"></i>
                            </button>
                        ` : '—'}
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px;color:#ef4444;">Failed to load card requests.</td></tr>';
    }
}

function renderApplicationsTable(apps) {
    return `
        <div class="premium-table-wrapper">
            <table class="premium-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Customer</th>
                        <th>Category</th>
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
                            <td class="acc-num-display">#${escHtml(a.id)}</td>
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

async function loadStaffLiquidityPage() {
    try {
        const [fundRes, loansRes] = await Promise.all([
            fetch(API + '/staff/liquidity-fund', { credentials: 'include' }),
            fetch(API + '/staff/loans', { credentials: 'include' })
        ]);
        const fundData = await fundRes.json();
        const loansData = await loansRes.json();
        const loans = loansData.loans || [];

        const fmt = n => n >= 100000 ? `₹${(n / 100000).toFixed(2)}L` : `₹${Number(n).toLocaleString('en-IN')}`;
        const g = id => document.getElementById(id);
        if (g('sLiqFundBalance') && fundData.fund_balance !== undefined) g('sLiqFundBalance').textContent = fmt(parseFloat(fundData.fund_balance));
        if (g('sLiqTotalPaid')) g('sLiqTotalPaid').textContent = loans.filter(l => l.status === 'closed').length;
        if (g('sLiqActiveLoans')) g('sLiqActiveLoans').textContent = loans.filter(l => l.status === 'approved').length;
        const today = new Date().toISOString().split('T')[0];
        if (g('sLiqOverdue')) g('sLiqOverdue').textContent = loans.filter(l => l.status === 'approved' && l.next_due_date && l.next_due_date < today).length;

        const container = g('sLiqLoansList');
        if (!loans.length) { container.innerHTML = '<div class="premium-table-wrapper"><p style="text-align:center;padding:2rem;color:#6b7280;">No loans found.</p></div>'; return; }

        container.innerHTML = `
            <div class="premium-table-wrapper">
                <table class="premium-table">
                    <thead>
                        <tr>
                            <th>Customer</th>
                            <th>Loan Type</th>
                            <th>Amount</th>
                            <th>Outstanding</th>
                            <th>Penalty</th>
                            <th>Status</th>
                            <th>Due Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${loans.map(l => `
                            <tr>
                                <td class="clickable-cell" onclick="viewUserActivity(${l.user_id}, '${escHtml(l.user_name || '').replace(/'/g, "\\'")}')">
                                    <div style="font-weight:700;">${escHtml(l.user_name || '—')}</div>
                                </td>
                                <td>${escHtml(l.loan_type || '—')}</td>
                                <td style="font-weight:700;">₹${Number(l.loan_amount || 0).toLocaleString('en-IN')}</td>
                                <td style="font-weight:700;color:${l.outstanding_amount > 0 ? '#ef4444' : '#10b981'};">₹${Number(l.outstanding_amount || 0).toLocaleString('en-IN')}</td>
                                <td style="color:${l.penalty_amount > 0 ? '#f59e0b' : 'var(--text-secondary)'};">₹${Number(l.penalty_amount || 0).toLocaleString('en-IN')}</td>
                                <td>
                                    <span class="status-badge ${l.status === 'closed' ? 'success' : l.status === 'approved' ? 'warning' : 'danger'}">
                                        ${escHtml(l.status === 'closed' ? 'PAID OFF' : l.status.toUpperCase())}
                                    </span>
                                </td>
                                <td style="font-size:12px;color:var(--text-secondary);">${escHtml(l.next_due_date || '—')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>`;
    } catch (e) {
        const c = document.getElementById('sLiqLoansList');
        if (c) c.innerHTML = '<div class="premium-table-wrapper"><p style="text-align:center;padding:2rem;color:#ef4444;">Error loading data.</p></div>';
        console.error(e);
    }
}

// Attendance Logic
function loadAttendancePage() {
    startDigitalClock();
    loadAttendanceStatus();
    loadAttendanceHistory();
}

function startDigitalClock() {
    const clockEl = document.getElementById('digitalClock');
    const dateEl = document.getElementById('currentDate');

    if (!clockEl || !dateEl) return;

    function updateClock() {
        const now = new Date();
        clockEl.textContent = now.toLocaleTimeString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour12: true,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }).toUpperCase();

        dateEl.textContent = now.toLocaleDateString('en-IN', {
            timeZone: 'Asia/Kolkata',
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    updateClock();
    clearInterval(window.clockInterval);
    window.clockInterval = setInterval(updateClock, 1000);
}

async function loadAttendanceStatus() {
    try {
        const r = await fetch(API + '/staff/attendance/status', { credentials: 'include' });
        const data = await r.json();

        if (data.success) {
            window.currentAttendanceStatus = data.status;
            updateAttendanceUI(data.status);
        }
    } catch (e) {
        console.error('Error loading attendance status:', e);
    }
}

function updateAttendanceUI(status) {
    const badge = document.getElementById('attendanceStatusBadge');
    const clockInBtn = document.getElementById('clockInBtn');
    const clockOutBtn = document.getElementById('clockOutBtn');
    const shiftInfo = document.getElementById('shiftInfo');
    const clockInDisplay = document.getElementById('clockInTimeDisplay');
    const hoursDisplay = document.getElementById('workingHoursDisplay');

    if (!badge || !clockInBtn || !clockOutBtn) return;

    if (status.clocked_out) {
        badge.textContent = 'Shift Ended';
        badge.style.background = '#e5e7eb';
        badge.style.color = '#374151';
        clockInBtn.disabled = true;
        clockInBtn.style.opacity = '0.5';
        clockInBtn.style.cursor = 'not-allowed';
        clockOutBtn.disabled = true;
        clockOutBtn.style.opacity = '0.5';
        clockOutBtn.style.cursor = 'not-allowed';
        shiftInfo.style.display = 'block';
        clockInDisplay.textContent = formatTime(status.clock_in_time);
        hoursDisplay.textContent = status.total_hours.toFixed(2) + 'h';
    } else if (status.clocked_in) {
        badge.textContent = 'Shift In Progress';
        badge.style.background = '#dcfce7';
        badge.style.color = '#166534';
        clockInBtn.disabled = true;
        clockInBtn.style.opacity = '0.5';
        clockInBtn.style.cursor = 'not-allowed';
        clockOutBtn.disabled = false;
        clockOutBtn.style.background = '#ef4444';
        clockOutBtn.style.color = 'white';
        clockOutBtn.style.cursor = 'pointer';
        shiftInfo.style.display = 'block';
        clockInDisplay.textContent = formatTime(status.clock_in_time);

        // Live counter for hours
        updateLiveHours(status.clock_in_time, hoursDisplay);
    } else {
        badge.textContent = 'Not Clocked In';
        badge.style.background = '#fee2e2';
        badge.style.color = '#991b1b';
        clockInBtn.disabled = false;
        clockInBtn.style.opacity = '1';
        clockInBtn.style.cursor = 'pointer';
        clockOutBtn.disabled = true;
        clockOutBtn.style.background = '#6b7280';
        clockOutBtn.style.cursor = 'not-allowed';
        shiftInfo.style.display = 'none';
    }
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

function updateLiveHours(clockInStr, displayEl) {
    if (!clockInStr || !displayEl) return;

    clearInterval(window.hoursInterval);
    const clockIn = new Date(clockInStr);

    function update() {
        const now = new Date();
        const diff = now - clockIn;
        const hours = (diff / 3600000).toFixed(2);
        displayEl.textContent = hours + 'h';
    }

    update();
    window.hoursInterval = setInterval(update, 60000); // Update every minute
}

async function loadAttendanceHistory() {
    const tableBody = document.getElementById('attendanceHistoryTable');
    if (!tableBody) return;

    try {
        const r = await fetch(API + '/staff/attendance/history', { credentials: 'include' });
        const data = await r.json();

        if (data.success && data.history.length) {
            tableBody.innerHTML = data.history.map(row => `
                <tr>
                    <td style="font-weight:600;">${new Date(row.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td style="font-family:monospace;font-weight:600;color:var(--primary-color);">${formatTime(row.clock_in)}</td>
                    <td style="font-family:monospace;font-weight:600;color:var(--text-secondary);">${row.clock_out ? formatTime(row.clock_out) : '<span style="color:#f59e0b;">—</span>'}</td>
                    <td><strong style="color:var(--primary-color);">${row.total_hours ? row.total_hours.toFixed(2) + 'h' : '--'}</strong></td>
                    <td><span class="status-badge ${row.status === 'present' ? 'success' : 'warning'}">${escHtml(row.status.toUpperCase())}</span></td>
                </tr>
            `).join('');

            // Update monthly summary
            const monthlyDays = document.getElementById('monthlyDays');
            const monthlyHours = document.getElementById('monthlyHours');
            if (monthlyDays) monthlyDays.textContent = data.history.length;
            if (monthlyHours) {
                const totalH = data.history.reduce((acc, curr) => acc + (curr.total_hours || 0), 0);
                monthlyHours.textContent = totalH.toFixed(1);
            }
        } else {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:#9ca3af;">No attendance records found</td></tr>';
        }
    } catch (e) {
        console.error('Error loading history:', e);
    }
}

// Handler functions for UI buttons
window.handleClockIn = function () {
    if (window.currentAttendanceStatus && window.currentAttendanceStatus.face_registered === false) {
        showConfirm({
            title: 'Face Registration Required',
            message: 'You must register your face before you can clock in. Would you like to go to settings now?',
            icon: 'fa-user-tag',
            confirmText: 'Go to Settings',
            onConfirm: () => showPage('settings')
        });
        return;
    }
    
    if (window.faceAuthManager) {
        faceAuthManager.captureFaceForAttendance('clock-in');
    } else {
        showToast('Face authentication manager not loaded', 'error');
    }
};

window.handleClockOut = function () {
    if (window.currentAttendanceStatus && window.currentAttendanceStatus.face_registered === false) {
        showToast('Face registration required for clock-out', 'error');
        return;
    }

    if (window.faceAuthManager) {
        showConfirm({
            title: 'Clock Out?',
            message: 'Are you sure you want to clock out for today?',
            icon: 'fa-clock',
            confirmText: 'Clock Out',
            onConfirm: () => faceAuthManager.captureFaceForAttendance('clock-out')
        });
    } else {
        showToast('Face authentication manager not loaded', 'error');
    }
};

// Load Profile Page
async function loadProfilePage() {
    const el = document.getElementById('profileContent');
    const staffLocal = JSON.parse(localStorage.getItem('staff'));
    if (!el || !staffLocal) return;

    el.innerHTML = '<div style="padding:40px; text-align:center;"><i class="fas fa-spinner fa-spin" style="font-size:32px; color:var(--primary-color);"></i><p>Loading your profile...</p></div>';

    try {
        const res = await fetch(`${API}/staff/profile`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch profile');
        const staff = await res.json();
        
        // Update local storage with fresh data
        localStorage.setItem('staff', JSON.stringify({ ...staffLocal, ...staff }));

        const avatarUrl = staff.profile_image 
            ? `${API}/staff/profile-image/${staff.profile_image}`
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(staff.name || 'Staff')}&background=10b981&color=fff&rounded=true&bold=true`;

        el.innerHTML = `
            <div style="padding: 24px;">
                <div style="display:flex; align-items:center; gap:24px; margin-bottom: 32px;">
                    <div style="position: relative; cursor: pointer;" onclick="triggerPhotoUpload()">
                        <img id="profilePageAvatar" src="${escHtml(avatarUrl)}" 
                             style="width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 4px solid #fff; box-shadow: 0 4px 6px rgba(0,0,0,0.1); transition: all 0.3s ease;">
                        <div style="position: absolute; bottom: 5px; right: 5px; background: var(--primary-color, #10b981); color: #fff; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #fff; font-size: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                            <i class="fas fa-camera"></i>
                        </div>
                        <input type="file" id="staffPhotoInput" accept="image/*" style="display: none;" onchange="handlePhotoUpload(event)">
                    </div>
                    <div>
                        <h2 style="margin:0 0 8px; font-size:24px; color:var(--text-primary);">${escHtml(staff.name || 'Staff Member')}</h2>
                        <p style="margin:0 0 4px; color:var(--text-secondary); font-size:16px;"><strong>Role:</strong> ${escHtml(staff.role || 'Staff')}</p>
                        <p style="margin:0 0 4px; color:var(--text-secondary); font-size:16px;"><strong>Department:</strong> ${escHtml(staff.department || 'Operations')}</p>
                        <p style="margin:0; color:var(--text-secondary); font-size:16px;"><strong>Email:</strong> ${escHtml(staff.email || 'Not Provided')}</p>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
                    <!-- Account Info Card -->
                    <div class="card" style="padding: 20px; background: var(--bg-light); margin: 0;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 16px;">
                            <h4 style="margin:0; font-weight: 800; color: #1e293b;"><i class="fas fa-id-card" style="margin-right: 8px; color: var(--primary-color);"></i>Account Information</h4>
                        </div>
                        <div style="display:grid; grid-template-columns: 1fr; gap: 16px;">
                            <div>
                                <small style="color:var(--text-secondary); display:block; font-weight: 700; text-transform: uppercase; font-size: 10px; margin-bottom: 4px;">Username/ID</small>
                                <strong style="font-size: 15px;">${escHtml(staff.staffId || staff.username || 'N/A')}</strong>
                            </div>
                            <div>
                                <small style="color:var(--text-secondary); display:block; font-weight: 700; text-transform: uppercase; font-size: 10px; margin-bottom: 4px;">Email Address</small>
                                <div id="emailDisplayContainer" style="display: flex; align-items: center; justify-content: space-between;">
                                    <strong id="displayEmail" style="font-size: 15px;">${escHtml(staff.email || 'Not Provided')}</strong>
                                    <button onclick="showChangeEmailForm()" class="btn btn-sm" style="color: var(--primary-color); background: transparent; padding: 2px 8px; font-size: 12px; font-weight: 700;"><i class="fas fa-edit"></i> Edit</button>
                                </div>
                                <div id="changeEmailForm" style="display:none; margin-top: 8px;">
                                    <input type="email" id="newEmailInput" placeholder="New Email Address" value="${escHtml(staff.email || '')}" class="form-control" style="font-size: 13px; padding: 8px; margin-bottom: 8px; width: 100%;">
                                    <div style="display: flex; gap: 8px;">
                                        <button onclick="saveNewEmail()" class="btn btn-primary btn-sm" style="flex: 1; font-size: 12px; padding: 8px;">Save</button>
                                        <button onclick="hideChangeEmailForm()" class="btn btn-secondary btn-sm" style="flex: 1; font-size: 12px; padding: 8px; background: #9ca3af; border: none;">Cancel</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- KYC Status Card -->
                    <div class="card" style="padding: 20px; background: var(--bg-light); margin: 0; border: 2px solid ${staff.aadhaar_number && staff.pan_number ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)'};">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 16px;">
                            <h4 style="margin:0; font-weight: 800; color: #1e293b;"><i class="fas fa-shield-check" style="margin-right: 8px; color: ${staff.aadhaar_number && staff.pan_number ? '#10b981' : '#f59e0b'};"></i>Self KYC Verification</h4>
                            <span class="status-badge ${staff.aadhaar_number && staff.pan_number ? 'success' : 'warning'}" style="font-size: 11px;">
                                ${staff.aadhaar_number && staff.pan_number ? 'VERIFIED' : 'PENDING'}
                            </span>
                        </div>
                        <div style="display:grid; grid-template-columns: 1fr; gap: 16px;">
                            <div>
                                <small style="color:var(--text-secondary); display:block; font-weight: 700; text-transform: uppercase; font-size: 10px; margin-bottom: 4px;">Aadhaar Number</small>
                                <strong style="font-size: 15px; font-family: monospace;">${escHtml(staff.aadhaar_number || 'Not Linked')}</strong>
                            </div>
                            <div>
                                <small style="color:var(--text-secondary); display:block; font-weight: 700; text-transform: uppercase; font-size: 10px; margin-bottom: 4px;">Permanent Account Number (PAN)</small>
                                <strong style="font-size: 15px; font-family: monospace; text-transform: uppercase;">${escHtml(staff.pan_number || 'Not Linked')}</strong>
                            </div>
                            <button onclick="showKycUpdateForm()" class="btn btn-primary" style="margin-top: 8px; width: 100%; border-radius: 10px; padding: 12px; font-weight: 700; font-size: 13px; display: flex; align-items: center; justify-content: center; gap: 8px;">
                                <i class="fas fa-pencil-alt"></i> Update KYC Documents
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- KYC Update Modal -->
            <div id="kycUpdateModal" class="modal" style="z-index: 10001;">
                <div class="modal-content" style="max-width: 450px; border-radius: 20px; overflow: hidden; padding: 0;">
                    <div style="background: linear-gradient(135deg, var(--primary-color), #a52a2a); padding: 24px; color: white;">
                        <h3 style="margin: 0; display: flex; align-items: center; gap: 12px; font-size: 20px; font-weight: 800;">
                            <i class="fas fa-user-shield"></i> Update Personal KYC
                        </h3>
                    </div>
                    <form onsubmit="submitKycUpdate(event)" style="padding: 24px; background: white;">
                        <div class="form-group" style="margin-bottom: 20px;">
                            <label style="font-weight: 700; color: #475569; display: block; margin-bottom: 8px;">Aadhaar Number (12 Digits)</label>
                            <input type="text" id="staffAadhaarInput" value="${escHtml(staff.aadhaar_number || '')}" placeholder="1234 5678 9012" maxlength="12" required class="form-control" style="width: 100%; padding: 12px; border: 2px solid #e2e8f0; border-radius: 12px; outline: none;">
                        </div>
                        <div class="form-group" style="margin-bottom: 24px;">
                            <label style="font-weight: 700; color: #475569; display: block; margin-bottom: 8px;">PAN Number</label>
                            <input type="text" id="staffPanInput" value="${escHtml(staff.pan_number || '')}" placeholder="ABCDE1234F" maxlength="10" required class="form-control" style="width: 100%; padding: 12px; border: 2px solid #e2e8f0; border-radius: 12px; outline: none; text-transform: uppercase;">
                        </div>
                        <div style="display: flex; gap: 12px;">
                            <button type="button" onclick="closeModal('kycUpdateModal')" class="btn btn-secondary" style="flex: 1; padding: 14px; border-radius: 12px; font-weight: 700;">Cancel</button>
                            <button type="submit" id="saveKycBtn" class="btn btn-primary" style="flex: 2; padding: 14px; border-radius: 12px; font-weight: 700; background: var(--primary-color);">Save Changes</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    } catch (e) {
        console.error('Profile Load Error:', e);
        el.innerHTML = '<div style="padding:40px; text-align:center; color:#ef4444;"><i class="fas fa-exclamation-circle" style="font-size:24px;"></i><p>Failed to load profile. Please refresh.</p></div>';
    }
}

function showKycUpdateForm() {
    const modal = document.getElementById('kycUpdateModal');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
    }
}

async function submitKycUpdate(event) {
    event.preventDefault();
    const btn = document.getElementById('saveKycBtn');
    const aadhaar = document.getElementById('staffAadhaarInput').value.trim();
    const pan = document.getElementById('staffPanInput').value.trim().toUpperCase();

    if (aadhaar.length !== 12 || !(/^\d+$/.test(aadhaar))) {
        showToast('Please enter a valid 12-digit Aadhaar number', 'error');
        return;
    }
    if (pan.length !== 10) {
        showToast('Please enter a valid 10-character PAN number', 'error');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        const res = await fetch(`${API}/staff/profile/kyc`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ aadhaar_number: aadhaar, pan_number: pan })
        });

        const data = await res.json();
        if (res.ok) {
            showToast('KYC details updated successfully', 'success');
            closeModal('kycUpdateModal');
            loadProfilePage();
        } else {
            showToast(data.error || 'Failed to update KYC', 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('Network error', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Save Changes';
    }
}

function showChangeEmailForm() {
    document.getElementById('displayEmail').style.display = 'none';
    document.getElementById('changeEmailForm').style.display = 'block';
}

function hideChangeEmailForm() {
    document.getElementById('displayEmail').style.display = 'block';
    document.getElementById('changeEmailForm').style.display = 'none';
}

function saveNewEmail() {
    const input = document.getElementById('newEmailInput');
    const newEmail = input.value.trim();
    if (!newEmail || !newEmail.includes('@')) {
        showToast('Please enter a valid email address', 'error');
        return;
    }

    // Update local storage
    const staff = JSON.parse(localStorage.getItem('staff'));
    staff.email = newEmail;
    localStorage.setItem('staff', JSON.stringify(staff));

    showToast('Email updated successfully!', 'success');
    loadProfilePage(); // Reload profile

    // Optional: Refresh global header elements
    if (typeof loadStaffInfo === 'function') loadStaffInfo();
}

window.triggerPhotoUpload = function() {
    document.getElementById('staffPhotoInput').click();
};

window.handlePhotoUpload = async function(event) {
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
        const res = await fetch(`${API}/staff/profile-image`, {
            method: 'POST',
            credentials: 'include',
            body: formData
        });

        const data = await res.json();
        if (res.ok) {
            showToast('Profile photo updated successfully', 'success');
            
            // Update local storage
            const staff = JSON.parse(localStorage.getItem('staff'));
            staff.profile_image = data.profile_image;
            localStorage.setItem('staff', JSON.stringify(staff));

            // Refresh UI
            initializeDashboard();
            loadProfilePage();
        } else {
            showToast(data.error || 'Failed to upload photo', 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('Network error during upload', 'error');
    }
};

// Load Settings Page
function loadSettingsPage() {
    const el = document.getElementById('settingsContent');
    if (!el) return;

    el.innerHTML = `
        <!-- Section: Security -->
        <div class="card" style="margin-bottom: 20px;">
            <div class="card-header">
                <h3 class="card-title"><i class="fas fa-shield-alt" style="color: var(--primary-maroon); margin-right: 8px;"></i>Security Settings</h3>
            </div>
            <div style="padding: 8px 24px 24px;">
                <!-- Face Auth Row -->
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 20px; background: var(--bg-light); border-radius: 12px; border: 1px solid var(--border-color);">
                    <div style="display: flex; align-items: center; gap: 14px;">
                        <div style="width: 44px; height: 44px; border-radius: 12px; background: rgba(128,0,0,0.08); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                            <i class="fas fa-face-smile" style="font-size: 20px; color: var(--primary-maroon);"></i>
                        </div>
                        <div>
                            <div style="font-weight: 700; font-size: 15px;">Face Authentication</div>
                            <div style="font-size: 13px; color: var(--text-secondary); margin-top: 2px;">Log in securely using facial recognition.</div>
                        </div>
                    </div>
                    <div id="faceAuthStatusContainer" style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: flex-end;">
                        <span id="faceStatusText" style="padding: 6px 14px; background: #e5e7eb; color: #374151; border-radius: 20px; font-size: 12px; font-weight: 600;">Checking status...</span>
                        <div id="faceActionButtons" style="display: flex; gap: 8px;"></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Section: Preferences -->
        <div class="card" style="margin-bottom: 20px;">
            <div class="card-header">
                <h3 class="card-title"><i class="fas fa-sliders" style="color: var(--primary-maroon); margin-right: 8px;"></i>Preferences</h3>
            </div>
            <div style="padding: 8px 24px 24px; display: flex; flex-direction: column; gap: 16px;">
                <!-- Dark Mode -->
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; background: var(--bg-light); border-radius: 12px; border: 1px solid var(--border-color);">
                    <div style="display:flex;align-items:center;gap:12px;">
                        <div style="width:36px;height:36px;border-radius:10px;background:rgba(59,130,246,0.1);display:flex;align-items:center;justify-content:center;">
                            <i class="fas fa-moon" style="color:#3b82f6;"></i>
                        </div>
                        <div>
                            <div style="font-weight:600;font-size:14px;">Dark Mode</div>
                            <div style="font-size:12px;color:var(--text-secondary);">Toggle dark or light theme.</div>
                        </div>
                    </div>
                    <label class="toggle-switch" title="Toggle dark mode">
                        <input type="checkbox" id="darkModeToggleSettings" onchange="toggleDarkMode(this.checked)">
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                <!-- Notification Sounds -->
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; background: var(--bg-light); border-radius: 12px; border: 1px solid var(--border-color);">
                    <div style="display:flex;align-items:center;gap:12px;">
                        <div style="width:36px;height:36px;border-radius:10px;background:rgba(16,185,129,0.1);display:flex;align-items:center;justify-content:center;">
                            <i class="fas fa-bell" style="color:#10b981;"></i>
                        </div>
                        <div>
                            <div style="font-weight:600;font-size:14px;">Notification Sounds</div>
                            <div style="font-size:12px;color:var(--text-secondary);">Play audio alerts for new events.</div>
                        </div>
                    </div>
                    <label class="toggle-switch">
                        <input type="checkbox" id="notifSoundToggle" checked>
                        <span class="toggle-slider"></span>
                    </label>
                </div>
            </div>
        </div>

        <!-- Section: Account Actions -->
        <div class="card">
            <div class="card-header">
                <h3 class="card-title"><i class="fas fa-user-cog" style="color: var(--primary-maroon); margin-right: 8px;"></i>Account Actions</h3>
            </div>
            <div style="padding: 8px 24px 24px; display: flex; flex-direction: column; gap: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; background: var(--bg-light); border-radius: 12px; border: 1px solid var(--border-color);">
                    <div style="display:flex;align-items:center;gap:12px;">
                        <div style="width:36px;height:36px;border-radius:10px;background:rgba(239,68,68,0.1);display:flex;align-items:center;justify-content:center;">
                            <i class="fas fa-right-from-bracket" style="color:#ef4444;"></i>
                        </div>
                        <div>
                            <div style="font-weight:600;font-size:14px;">Sign Out</div>
                            <div style="font-size:12px;color:var(--text-secondary);">Log out from your current session.</div>
                        </div>
                    </div>
                    <button class="btn" style="background:#ef4444;color:#fff;border:none;padding:8px 20px;border-radius:8px;font-weight:600;cursor:pointer;" onclick="handleLogout()">
                        <i class="fas fa-sign-out-alt"></i> Logout
                    </button>
                </div>
            </div>
        </div>
    `;

    // Sync dark mode toggle
    const dmToggle = document.getElementById('darkModeToggleSettings');
    if (dmToggle) dmToggle.checked = document.body.classList.contains('dark-theme');

    // Sync notification sound toggle
    const nsToggle = document.getElementById('notifSoundToggle');
    if (nsToggle) {
        nsToggle.checked = localStorage.getItem('notifSounds') !== 'false'; // Default to true
        nsToggle.onchange = (e) => toggleNotificationSounds(e.target.checked);
    }

    // Load face auth status
    if (typeof loadFaceAuthStatus === 'function') {
        setTimeout(loadFaceAuthStatus, 300);
    }
}

// Chart Instances
let accountChartInstance = null;
let loanChartInstance = null;
let transactionChartInstance = null;

// Load Reports Page
function downloadReport(type) {
    showToast('Generating premium PDF report...', 'info');
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
            showToast('Report downloaded successfully!', 'success');
        })
        .catch(err => {
            console.error('Report download error:', err);
            showToast('Failed to download report', 'error');
        });
}

async function loadReportsPage() {
    try {
        const response = await fetch(API + '/staff/analytics', { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to load analytics');
        const data = await response.json();

        // Render Account Types Chart
        const accountCtx = document.getElementById('accountTypesChart');
        if (accountCtx && data.account_types) {
            if (accountChartInstance) accountChartInstance.destroy();
            accountChartInstance = new Chart(accountCtx, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(data.account_types).map(escHtml),
                    datasets: [{
                        data: Object.values(data.account_types),
                        backgroundColor: ['#800000', '#10b981', '#f59e0b', '#ef4444'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } }
                }
            });
        }

        // Render Loan Status Chart
        const loanCtx = document.getElementById('loanStatusChart');
        if (loanCtx && data.loan_status) {
            if (loanChartInstance) loanChartInstance.destroy();
            loanChartInstance = new Chart(loanCtx, {
                type: 'pie',
                data: {
                    labels: Object.keys(data.loan_status).map(escHtml),
                    datasets: [{
                        data: Object.values(data.loan_status),
                        backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } }
                }
            });
        }

        // Render Transaction Volume Chart
        const txCtx = document.getElementById('transactionVolumeChart');
        if (txCtx && data.daily_volume) {
            if (transactionChartInstance) transactionChartInstance.destroy();
            transactionChartInstance = new Chart(txCtx, {
                type: 'bar',
                data: {
                    labels: data.daily_volume.map(d => escHtml(d.date)),
                    datasets: [{
                        label: 'Transaction Volume (₹)',
                        data: data.daily_volume.map(d => d.amount),
                        backgroundColor: '#800000',
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: { y: { beginAtZero: true } },
                    plugins: { legend: { display: false } }
                }
            });
        }
    } catch (error) {
        console.error('Error loading reports:', error);
        showToast('Failed to load reports data', 'error');
    }
}

// Load Customers Page — uses live backend data
// =============================================
// ADD CUSTOMER MODAL (Staff)
// =============================================
function showAddCustomerModal() {
    const form = document.querySelector('#addCustomerModal form');
    if (form) form.reset();
    const errDiv = document.getElementById('addCustomerError');
    if (errDiv) { errDiv.style.display = 'none'; errDiv.textContent = ''; }
    const btn = document.getElementById('addCustomerSubmitBtn');
    if (btn) { btn.disabled = false; btn.textContent = 'Create Customer'; }
    const modal = document.getElementById('addCustomerModal');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
    }
}

function closeAddCustomerModal() {
    const modal = document.getElementById('addCustomerModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.style.display = 'none', 300);
    }
}

async function submitAddCustomer(event) {
    event.preventDefault();
    const btn = document.getElementById('addCustomerSubmitBtn');

    // Get or create error div inside the modal
    let errDiv = document.getElementById('addCustomerError');
    if (!errDiv) {
        errDiv = document.createElement('div');
        errDiv.id = 'addCustomerError';
        errDiv.style.cssText = 'display:none;background:#fef2f2;color:#b91c1c;padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:12px;';
        btn.parentElement.before(errDiv);
    }

    const pwd = document.getElementById('newCustomerPassword').value;

    // Password validation (1 caps, 3 numbers, 1 symbol, min 7)
    const hasCaps = /[A-Z]/.test(pwd);
    const numCount = (pwd.match(/\d/g) || []).length;
    const hasSymbol = /[@$!%*?&]/.test(pwd);

    if (pwd.length < 7 || !hasCaps || numCount < 3 || !hasSymbol) {
        errDiv.textContent = 'Password must be at least 7 characters long, containing 1 uppercase, 3 numbers, and 1 symbol (@$!%*?&).';
        errDiv.style.display = 'block';
        return;
    }

    const payload = {
        name: document.getElementById('newCustomerName').value.trim(),
        username: document.getElementById('newCustomerUsername').value.trim(),
        email: document.getElementById('newCustomerEmail').value.trim(),
        phone: document.getElementById('newCustomerPhone').value.trim(),
        password: pwd,
        dob: document.getElementById('newCustomerDob')?.value || null
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

        if (res.ok && data.success !== false) {
            closeAddCustomerModal();
            showToast('Customer "' + escHtml(payload.name) + '" created successfully!', 'success');
            loadCustomersPage(); // Refresh customers list
        } else {
            errDiv.textContent = escHtml(data.error || 'Failed to create customer.');
            errDiv.style.display = 'block';
            btn.disabled = false;
            btn.textContent = 'Create Customer';
        }
    } catch (e) {
        errDiv.textContent = 'Network error. Please try again.';
        errDiv.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Create Customer';
    }
}

// Edit Customer Functions
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
            showToast('Customer updated successfully!', 'success');
            loadCustomersPage();
        } else {
            showToast(data.error || 'Failed to update customer.', 'error');
        }
    } catch (e) {
        showToast('Network error. Please try again.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
    }
};

// Edit Account Functions
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
            // If the modal was opened from a specific view, refresh it.
            // Depending on where it was called, we might want to refresh the accounts list or the details view.
            if (document.getElementById('accountDetailsModal').style.display === 'flex') {
                closeModal('accountDetailsModal');
                loadAccountsPage(); 
            } else {
                loadAccountsPage();
            }
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

// Add Account Functions
window.showAddAccountModal = function () {
    const form = document.querySelector('#addAccountModal form');
    if (form) form.reset();
    showModal('addAccountModal');
};

window.closeAddAccountModal = function () {
    closeModal('addAccountModal');
};

window.submitAddAccount = async function (event) {
    event.preventDefault();
    const btn = event.target.querySelector('button[type="submit"]');

    const payload = {
        user_id: document.getElementById('newAccountUserId').value.trim(),
        account_type: document.getElementById('newAccountType').value,
        balance: document.getElementById('newAccountBalance').value.trim() || 0
    };

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    }

    try {
        const res = await fetch(API + '/staff/add_account', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (res.ok && data.success) {
            closeAddAccountModal();
            showToast('Account created successfully!', 'success');
            loadStaffAccounts();
        } else {
            showToast(data.error || 'Failed to create account.', 'error');
        }
    } catch (e) {
        showToast('Network error. Please try again.', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = 'Create Account';
        }
    }
};

async function loadCustomersPage() {
    const el = document.getElementById('customersList');
    if (!el) return;
    el.innerHTML = '<p style="padding:16px;color:#9ca3af;">Loading customers...</p>';
    try {
        const r = await fetch(API + '/staff/customers', { credentials: 'include' });
        if (!r.ok) {
            const errText = await r.text();
            console.error('[Staff Customers] API error:', r.status, errText);
            el.innerHTML = `<p style="padding:16px;color:#ef4444;">Failed to load customers. Status: ${r.status}. ${r.status === 401 ? 'Session expired — please log in again.' : r.status === 403 ? 'Access denied.' : 'Please try again.'}</p>`;
            return;
        }
        const data = await r.json();
        const customers = data.customers || data || [];
        if (!customers.length) { el.innerHTML = '<p style="padding:16px;text-align:center;color:#9ca3af;">No customers found.</p>'; return; }

        el.innerHTML = `
            <div class="premium-table-wrapper">
                <table class="premium-table" style="table-layout:fixed;width:100%;">
                    <colgroup>
                        <col style="width:5%;">
                        <col style="width:14%;">
                        <col style="width:22%;">
                        <col style="width:12%;">
                        <col style="width:8%;">
                        <col style="width:10%;">
                        <col style="width:9%;">
                        <col style="width:20%;">
                    </colgroup>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th style="text-align:center;">Accounts</th>
                            <th>Balance</th>
                            <th>Status</th>
                            <th style="text-align:center;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${customers.map(c => `
                            <tr onclick="viewUserActivity(${c.id}, '${escHtml(c.name || '').replace(/'/g, "\\'")}')" class="clickable-cell" title="View User Details">
                                <td class="acc-num-display" style="padding:12px 8px;">#${escHtml(c.id)}</td>
                                <td style="padding:12px 8px;">
                                    <div style="font-weight:700;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(c.name || c.username || '—')}</div>
                                    <div style="font-size:11px;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">@${escHtml(c.username || c.id)}</div>
                                </td>
                                <td style="padding:12px 8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(c.email || '—')}">${escHtml(c.email || '—')}</td>
                                <td style="padding:12px 8px;white-space:nowrap;">${escHtml(c.phone || '—')}</td>
                                <td style="text-align:center;padding:12px 8px;">
                                    <span class="status-badge" style="background:rgba(128,0,0,0.05);color:var(--primary-color);border:1px solid rgba(128,0,0,0.1);">${c.account_count || 0}</span>
                                </td>
                                <td class="acc-num-display" style="font-weight:800;color:var(--primary-color);padding:12px 8px;white-space:nowrap;">
                                    ₹${Number(c.total_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                </td>
                                <td style="padding:12px 8px;">
                                    <span class="status-badge ${c.status === 'active' ? 'success' : 'danger'}">
                                        ${escHtml((c.status || 'active').toUpperCase())}
                                    </span>
                                </td>
                                <td onclick="event.stopPropagation()" style="padding:12px 8px;">
                                    <div style="display:flex;gap:6px;justify-content:center;white-space:nowrap;">
                                        <button class="action-btn-circle ${c.transact_restricted ? 'danger' : 'success'}" onclick="event.stopPropagation(); toggleUserRestriction(${c.id}, ${c.transact_restricted || 0}, '${escHtml(c.name || '').replace(/'/g, "\\'")}')" title="${c.transact_restricted ? 'Unrestrict Transactions' : 'Restrict Transactions'}">
                                            <i class="fas ${c.transact_restricted ? 'fa-unlock' : 'fa-lock'}"></i>
                                        </button>
                                        <button class="action-btn-circle view" onclick="event.stopPropagation(); window.currentEditCustomer = ${escHtml(JSON.stringify(c))}; showEditCustomerModal()" title="Edit Customer">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                        <button class="action-btn-circle delete" onclick="event.stopPropagation(); deleteUser(${c.id},'${escHtml(c.name || '').replace(/'/g, "\\'")}')" title="Delete User">
                                            <i class="fas fa-trash-alt"></i>
                                        </button>
                                        <button class="action-btn-circle warning" style="background:rgba(245,158,11,0.1); color:#f59e0b;" onclick="event.stopPropagation(); requestUserKycUpdate(${c.id}, '${escHtml(c.name || '').replace(/'/g, "\\'")}')" title="Request KYC Update">
                                            <i class="fas fa-bell"></i>
                                        </button>
                                        ${(c.signup_lat || c.lat) ? `
                                        <button class="action-btn-circle" style="background:rgba(59,130,246,0.1);color:#3b82f6;" 
                                                onclick="event.stopPropagation(); showLandMap(null, ${c.signup_lat || c.lat}, ${c.signup_lng || c.lng || 0}, 1, 'Customer Location', '${escHtml(c.name || '').replace(/'/g, "\\'")}', 0)" title="View Land Map">
                                            <i class="fas fa-satellite"></i>
                                        </button>` : ''}
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>`;
    } catch (e) {
        el.innerHTML = '<p style="padding:16px;color:#ef4444;">Failed to load customers. Ensure you are logged in as staff.</p>';
    }
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

async function toggleUserRestriction(userId, currentStatus, userName) {
    const action = currentStatus ? 'UNRESTRICT' : 'RESTRICT';
    const confirmMsg = `Are you sure you want to ${action} all transactions for ${escHtml(userName)}?`;
    if (!(await confirm(confirmMsg))) return;

    try {
        const res = await fetch(API + `/staff/customers/${userId}/toggle-transact-restriction`, {
            method: 'POST',
            credentials: 'include'
        });
        const data = await res.json();
        if (res.ok) {
            showToast(data.message || 'Updated successfully', 'success');
            if (document.getElementById('agrihub')?.classList.contains('active')) {
                loadAgriHubPage();
            } else {
                loadCustomersPage();
            }
        } else {
            showToast(data.error || 'Update failed', 'error');
        }
    } catch (e) {
        console.error('Restriction toggle error:', e);
        showToast('Network error.', 'error');
    }
}

// View User Activity Logic
async function viewUserActivity(userId, userName) {
    const modal = document.getElementById('userActivityModal');
    if (!modal) return;
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);

    const details = document.getElementById('activityDetails');
    if (details) details.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;padding:60px;"><i class="fas fa-spinner fa-spin" style="font-size:32px;color:var(--primary-color);"></i></div>';

    const nameEl = document.getElementById('activityUserName');
    if (nameEl) nameEl.textContent = escHtml(userName);

    try {
        const r = await fetch(API + `/staff/user/${userId}/activity`, { credentials: 'include' });
        if (!r.ok) throw new Error('Failed to fetch user details');
        const data = await r.json();
        const u = data.user || {};
        const accounts = data.accounts || [];
        const txns = data.transactions || [];
        const cards = data.cards || [];
        const loans = data.loans || [];
        const logs = data.activity_logs || [];

        const activeAccounts = accounts.filter(a => a.status === 'active');
        const agriLoan = data.agriculture_loans && data.agriculture_loans[0];
        const hasMapData = (agriLoan && agriLoan.farm_coordinates) || (u.signup_lat && u.signup_lng);

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
            ${u.transact_restricted ? `
            <span style="padding:6px 14px;border-radius:20px;font-size:12px;font-weight:700;background:rgba(239,68,68,0.25);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);">
                <i class="fas fa-lock" style="margin-right:4px;"></i> TRANSACTION RESTRICTED
            </span>` : ''}
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

        <!-- KYC Document Proofs (Agri-Buyer) -->
        ${data.kyc_request ? `
        <div style="background:rgba(0,0,0,0.02); border:1px dashed rgba(0,0,0,0.1); border-radius:12px; padding:16px; margin-bottom:20px;">
            <h4 style="margin:0 0 12px; font-size:13px; font-weight:800; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.5px;">
                <i class="fas fa-file-shield" style="margin-right:8px;"></i>Document Uploads & Video KYC
            </h4>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                <div style="background:white; border:1px solid rgba(0,0,0,0.05); padding:10px; border-radius:8px;">
                    <div style="font-size:10px; font-weight:700; color:var(--text-secondary); text-transform:uppercase; margin-bottom:5px;">PAN Document</div>
                    <a href="${window.location.origin}/${data.kyc_request.pan_proof}" target="_blank" style="display:flex; align-items:center; gap:8px; text-decoration:none; color:var(--primary-color); font-size:12px; font-weight:600;">
                        <i class="fas fa-file-pdf"></i> View PAN Proof
                    </a>
                </div>
                <div style="background:white; border:1px solid rgba(0,0,0,0.05); padding:10px; border-radius:8px;">
                    <div style="font-size:10px; font-weight:700; color:var(--text-secondary); text-transform:uppercase; margin-bottom:5px;">GST Document</div>
                    <a href="${window.location.origin}/${data.kyc_request.gst_proof}" target="_blank" style="display:flex; align-items:center; gap:8px; text-decoration:none; color:var(--primary-color); font-size:12px; font-weight:600;">
                        <i class="fas fa-file-invoice"></i> View GST Proof
                    </a>
                </div>
                <div style="grid-column: span 2; background:white; border:1px solid rgba(0,0,0,0.05); padding:10px; border-radius:8px;">
                    <div style="font-size:10px; font-weight:700; color:var(--text-secondary); text-transform:uppercase; margin-bottom:5px;">Video KYC Verification</div>
                    <video src="${window.location.origin}/${data.kyc_request.kyc_video}" controls style="width:100%; max-height:180px; border-radius:6px; background:black;"></video>
                </div>
            </div>
        </div>
        ` : ''}

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
        
        <!-- Action Logs -->
        <h4 style="font-size:14px;font-weight:700;margin:20px 0 10px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.5px;">
            <i class="fas fa-mouse-pointer" style="margin-right:6px;color:var(--primary-color);"></i>Action Logs (${logs.length})
        </h4>
        ${logs.length ? `
        <div style="border:1px solid var(--border-color);border-radius:10px;overflow:hidden;margin-bottom:20px;">
            <table style="width:100%;border-collapse:collapse;font-size:12px;">
                <thead style="background:var(--bg-light);">
                    <tr>
                        <th style="padding:10px 12px;text-align:left;color:var(--text-secondary);font-weight:600;">Time</th>
                        <th style="padding:10px 12px;text-align:left;color:var(--text-secondary);font-weight:600;">Action</th>
                        <th style="padding:10px 12px;text-align:left;color:var(--text-secondary);font-weight:600;">Details</th>
                        <th style="padding:10px 12px;text-align:left;color:var(--text-secondary);font-weight:600;">IP Address</th>
                    </tr>
                </thead>
                <tbody>
                    ${logs.map((L, i) => `
                    <tr style="border-top:1px solid var(--border-color);${i % 2 === 0 ? 'background:var(--bg-card);' : 'background:var(--bg-light);'}">
                        <td style="padding:10px 12px;white-space:nowrap;color:var(--text-secondary);">${L.created_at ? new Date(L.created_at).toLocaleString('en-IN') : '—'}</td>
                        <td style="padding:10px 12px;font-weight:600;color:var(--primary-color);">${escHtml(L.action || '—')}</td>
                        <td style="padding:10px 12px;font-size:11px;">${escHtml(L.details || '—')}</td>
                        <td style="padding:10px 12px;font-family:monospace;font-size:11px;color:var(--text-secondary);">${escHtml(L.ip_address || '—')}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </div>` : '<p style="color:var(--text-secondary);margin-bottom:20px;">No UI activity logs found for this user.</p>'}

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
        const lat = u.signup_lat || u.lat;
        const lng = u.signup_lng || u.lng;
        
        if (lat && lng) {
            setTimeout(() => {
                try {
                    const mapEl = document.getElementById('userActivityMap');
                    if (!mapEl) return;
                    
                    const userMap = L.map('userActivityMap', {
                        zoomControl: true,
                        attributionControl: false
                    }).setView([lat, lng], 13);
                    
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(userMap);
                    
                    const color = u.status === 'active' ? '#10b981' : (u.status === 'pending' ? '#f59e0b' : '#ef4444');
                    L.circleMarker([lat, lng], {
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

// Load Approvals Page
async function loadApprovalsPage() {
    const el = document.getElementById('approvalsList');
    if (!el) return;
    el.innerHTML = '<p style="padding:16px;color:#9ca3af;">Loading KYC approvals...</p>';
    try {
        const r = await fetch(API + '/staff/account_requests', { credentials: 'include' });
        if (!r.ok) throw new Error();
        const data = await r.json();
        const all = data.requests || [];

        // Specialized types are handled in their own sections
        const specializedTypes = ['agriculture', 'salary', 'current'];
        const requests = all.filter(req => !specializedTypes.includes(req.account_type.toLowerCase()));

        // Update navigation badges
        const updateBadge = (id, count) => {
            const b = document.getElementById(id);
            if (b) {
                b.textContent = count;
                b.style.display = count > 0 ? 'inline-flex' : 'none';
            }
        };

        updateBadge('pendingApprovalsBadge', requests.filter(req => req.status === 'pending').length);
        updateBadge('agriAccountsBadge', all.filter(req => req.status === 'pending' && req.account_type.toLowerCase() === 'agriculture').length);
        updateBadge('salaryAccountsBadge', all.filter(req => req.status === 'pending' && req.account_type.toLowerCase() === 'salary').length);
        updateBadge('businessAccountsBadge', all.filter(req => req.status === 'pending' && req.account_type.toLowerCase() === 'current').length);

        if (!requests.length) {
            el.innerHTML = '<p style="padding:16px;text-align:center;color:#9ca3af;">No pending approvals found.</p>';
            return;
        }

        el.innerHTML = `
            <div class="premium-table-wrapper">
                <table class="premium-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Customer</th>
                            <th>Type</th>
                            <th style="white-space:nowrap;">Aadhaar / PAN</th>
                            <th>Proofs</th>
                            <th>Face / KYC</th>
                            <th>Status</th>
                            <th>Date</th>
                            <th style="text-align:center;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${requests.map(r => `
                            <tr>
                                <td class="acc-num-display">#${escHtml(r.id)}</td>
                                <td>
                                    <div style="font-weight:700;">${escHtml(r.user_name || '—')}</div>
                                    <div style="font-size:11px;color:var(--text-secondary);">${escHtml(r.user_email || '—')}</div>
                                </td>
                                <td><span class="status-badge" style="background:rgba(128,0,0,0.05);color:var(--text-primary);border:1px solid var(--border-color);">${escHtml(r.account_type.toUpperCase())}${r.original_account_id ? ' (CONV.)' : ''}</span></td>
                                <td>
                                    <div style="font-family:monospace;font-size:12px;">A: ${escHtml(r.aadhaar_number || '—')}</div>
                                    <div style="font-family:monospace;font-size:12px;color:var(--text-secondary);">P: ${escHtml(r.pan_number || '—')}</div>
                                </td>
                                <td>
                                    <div style="display:flex;gap:6px;align-items:center;">
                                        ${r.aadhaar_proof ? `
                                            <button class="action-btn-circle view" style="width:28px;height:28px;font-size:12px;" onclick="event.stopPropagation(); showKYCDoc('${escHtml(r.aadhaar_proof)}', 'Aadhaar - ${escHtml(r.user_name)}')">
                                                <i class="fas ${r.aadhaar_proof.startsWith('data:application/pdf') ? 'fa-file-pdf' : 'fa-id-card'}"></i>
                                            </button>` : ''}
                                        ${r.pan_proof ? `
                                            <button class="action-btn-circle edit" style="width:28px;height:28px;font-size:12px;background:rgba(245,158,11,0.1);color:#f59e0b;" onclick="event.stopPropagation(); showKYCDoc('${escHtml(r.pan_proof)}', 'PAN - ${escHtml(r.user_name)}')">
                                                <i class="fas ${r.pan_proof.startsWith('data:application/pdf') ? 'fa-file-pdf' : 'fa-id-card'}"></i>
                                            </button>` : ''}
                                        ${(r.signup_lat || r.lat) ? `
                                             <button class="action-btn-circle" style="width:28px;height:28px;font-size:12px;background:rgba(59,130,246,0.1);color:#3b82f6;" 
                                                     onclick="event.stopPropagation(); showLandMap(${r.id}, ${r.signup_lat || r.lat}, ${r.signup_lng || r.lng || 0}, 1, '${escHtml(r.account_type)}', '${escHtml(r.user_name || '').replace(/'/g, "\\'")}', 0, ${r.geometry ? `'${r.geometry}'` : 'null'}, '${escHtml(r.aadhaar_number || '—')}', '${escHtml(r.pan_number || '—')}', '${escHtml(r.user_email || '—')}')" title="View Land Map">
                                                 <i class="fas fa-satellite"></i>
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
                                            <button class="action-btn-circle delete" style="width:28px;height:28px;font-size:10px;" onclick="event.stopPropagation(); playKYCVideo('${escHtml(r.kyc_video)}', '${escHtml(r.user_name)}')">
                                                <i class="fas fa-play"></i>
                                            </button>` : ''}
                                    </div>
                                </td>
                                <td><span class="status-badge ${r.status === 'approved' ? 'success' : r.status === 'pending' ? 'warning' : 'danger'}">${escHtml(r.status.toUpperCase())}</span></td>
                                <td style="color:var(--text-secondary);font-size:12px;">${new Date(r.request_date).toLocaleDateString('en-IN')}</td>
                                <td>
                                    <div style="display:flex;gap:6px;justify-content:center;">
                                        ${r.status === 'pending' ? `
                                            <button class="action-btn-circle view" onclick="event.stopPropagation(); handleAccountRequest(${r.id}, 'approve')" title="Approve">
                                                <i class="fas fa-check"></i>
                                            </button>
                                            <button class="action-btn-circle edit" style="background:rgba(59,130,246,0.1);color:#3b82f6;" onclick="event.stopPropagation(); window.currentEditCustomer = { ...r, id: r.user_id, name: r.user_name, email: r.user_email, phone: r.user_phone, address: r.user_address, date_of_birth: r.user_dob }; showEditCustomerModal();" title="Edit Customer Details">
                                                <i class="fas fa-user-edit"></i>
                                            </button>
                                            <button class="action-btn-circle delete" onclick="event.stopPropagation(); handleAccountRequest(${r.id}, 'reject')" title="Reject">
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
    } catch (e) {
        el.innerHTML = '<p style="padding:16px;color:#ef4444;">Failed to load approvals.</p>';
    }
}

async function loadAgriAccountsPage() {
    const el = document.getElementById('agriAccountsList');
    if (!el) return;
    el.innerHTML = '<p style="padding:16px;color:#9ca3af;">Loading Agriculture Accounts...</p>';
    try {
        const r = await fetch(API + '/staff/account_requests', { credentials: 'include' });
        if (!r.ok) throw new Error();
        const data = await r.json();
        const requests = (data.requests || []).filter(req => req.account_type.toLowerCase() === 'agriculture');

        const badge = document.getElementById('agriAccountsBadge');
        if (badge) {
            const pending = requests.filter(req => req.status === 'pending').length;
            badge.textContent = pending;
            badge.style.display = pending > 0 ? 'inline-flex' : 'none';
        }

        if (!requests.length) {
            el.innerHTML = '<p style="padding:16px;text-align:center;color:#9ca3af;">No agriculture account requests found.</p>';
            return;
        }

        el.innerHTML = `
            <div class="premium-table-wrapper">
                <table class="premium-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Customer</th>
                            <th>Type</th>
                            <th style="white-space:nowrap;">Farm Details</th>
                            <th>Proofs</th>
                            <th>Face / KYC</th>
                            <th>Status</th>
                            <th>Date</th>
                            <th style="text-align:center;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${requests.map(r => `
                            <tr style="cursor:pointer;" onclick="viewUserActivity(${r.user_id}, '${escHtml(r.user_name || '').replace(/'/g, "\\'")}')">
                                <td class="acc-num-display">#${escHtml(r.id)}</td>
                                <td>
                                    <div style="font-weight:700;">${escHtml(r.user_name || '—')}</div>
                                    <div style="font-size:11px;color:var(--text-secondary);">${escHtml(r.user_email || '—')}</div>
                                </td>
                                <td><span class="status-badge" style="background:rgba(16,185,129,0.1);color:#10b981;border:1px solid rgba(16,185,129,0.2);"><i class="fas fa-leaf"></i> AGRI</span></td>
                                <td>
                                    <div style="font-family:monospace;font-size:12px;">A: ${escHtml(r.aadhaar_number || '—')}</div>
                                    <div style="font-family:monospace;font-size:12px;color:var(--text-secondary);">P: ${escHtml(r.pan_number || '—')}</div>
                                    <div style="display:flex;gap:4px;margin-top:4px;">
                                        ${r.agri_address ? `<div style="font-size:11px;max-width:80px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escHtml(r.agri_address)}"><a href="https://www.google.com/maps?q=${escHtml(r.agri_address)}" target="_blank" style="color:#047857;text-decoration:underline;"><i class="fas fa-map-marker-alt"></i> Pin</a></div>` : ''}
                                        ${(r.signup_lat || r.lat) ? `
                                            <button onclick="event.stopPropagation(); showLandMap(${r.id}, ${r.signup_lat || r.lat}, ${r.signup_lng || r.lng || 0}, ${r.land_size_acres || 5}, '${escHtml(r.crop_type || 'Agriculture').replace(/'/g, "\\'")}', '${escHtml(r.user_name || '').replace(/'/g, "\\'")}', ${r.ai_health_score || 70}, ${r.geometry ? `'${r.geometry}'` : 'null'}, '${escHtml(r.aadhaar_number || '—')}', '${escHtml(r.pan_number || '—')}', '${escHtml(r.user_email || '—')}')" 
                                                    class="btn btn-secondary btn-sm" style="font-size:10px;padding:1px 6px;height:20px;line-height:1;">
                                                <i class="fas fa-satellite"></i> Map
                                            </button>` : ''}
                                    </div>
                                    <div style="font-size:10px;color:${(r.signup_lat || r.lat) ? '#10b981' : '#ef4444'};margin-top:2px;font-weight:600;"><i class="fas fa-satellite-dish"></i> AI Detected: ${(r.signup_lat || r.lat) ? 'Yes' : 'No'}</div>
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
                                            <button class="action-btn-circle delete" style="width:28px;height:28px;font-size:10px;" onclick="event.stopPropagation(); playKYCVideo('${escHtml(r.kyc_video)}', '${escHtml(r.user_name)}')">
                                                <i class="fas fa-play"></i>
                                            </button>` : ''}
                                    </div>
                                </td>
                                <td><span class="status-badge ${r.status === 'approved' ? 'success' : r.status === 'pending' ? 'warning' : 'danger'}">${escHtml(r.status.toUpperCase())}</span></td>
                                <td style="color:var(--text-secondary);font-size:12px;">${new Date(r.request_date).toLocaleDateString('en-IN')}</td>
                                <td>
                                    <div style="display:flex;gap:6px;justify-content:center;">
                                        ${r.status === 'pending' ? `
                                            <button class="action-btn-circle view" onclick="event.stopPropagation(); handleAccountRequest(${r.id}, 'approve')" title="Approve">
                                                <i class="fas fa-check"></i>
                                            </button>
                                            <button class="action-btn-circle delete" onclick="event.stopPropagation(); handleAccountRequest(${r.id}, 'reject')" title="Reject">
                                                <i class="fas fa-times"></i>
                                            </button>
                                        ` : `
                                            <span style="font-size:11px;color:var(--text-secondary);"><i class="fas fa-check-double"></i> Processed</span>
                                        `}
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>`;
    } catch (e) {
        el.innerHTML = '<p style="padding:16px;color:#ef4444;">Failed to load agriculture accounts.</p>';
    }
}

async function loadSalaryAccountsPage() {
    const el = document.getElementById('salaryAccountsList');
    if (!el) return;
    el.innerHTML = '<p style="padding:16px;color:#9ca3af;">Loading Salary Accounts...</p>';
    try {
        const r = await fetch(API + '/staff/account_requests', { credentials: 'include' });
        if (!r.ok) throw new Error();
        const data = await r.json();
        const requests = (data.requests || []).filter(req => req.account_type.toLowerCase() === 'salary');

        // Update badge (redundant but safe)
        const badge = document.getElementById('salaryAccountsBadge');
        if (badge) {
            const pending = requests.filter(req => req.status === 'pending').length;
            badge.textContent = pending;
            badge.style.display = pending > 0 ? 'inline-flex' : 'none';
        }

        if (!requests.length) {
            el.innerHTML = '<p style="padding:16px;text-align:center;color:#9ca3af;">No salary account requests found.</p>';
            return;
        }

        el.innerHTML = `
            <div class="premium-table-wrapper">
                <table class="premium-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Customer</th>
                            <th>Proof</th>
                            <th>KYC Docs</th>
                            <th>Face Match</th>
                            <th>Status</th>
                            <th>Date</th>
                            <th style="text-align:center;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${requests.map(r => `
                            <tr>
                                <td class="acc-num-display">#${escHtml(r.id)}</td>
                                <td>
                                    <div style="font-weight:700;">${escHtml(r.user_name || '—')}</div>
                                    <div style="font-size:11px;color:var(--text-secondary);">${escHtml(r.user_email || '—')}</div>
                                </td>
                                <td>
                                    ${r.salary_proof ? `
                                        <button class="action-btn-circle" style="width:36px;height:36px;background:rgba(59,130,246,0.1);color:#3b82f6;" onclick="event.stopPropagation(); showKYCDoc('${escHtml(r.salary_proof)}', 'Salary Slip - ${escHtml(r.user_name)}')">
                                            <i class="fas fa-file-invoice-dollar"></i>
                                        </button>
                                        <div style="font-size:10px;margin-top:4px;color:#3b82f6;font-weight:600;">Salary Slip</div>
                                    ` : '<span style="color:#ef4444;font-size:11px;">No Slip</span>'}
                                </td>
                                <td>
                                    <div style="display:flex;gap:4px;align-items:center;">
                                        ${r.aadhaar_proof ? `<button class="action-btn-circle view" style="width:24px;height:24px;font-size:10px;" onclick="event.stopPropagation(); showKYCDoc('${escHtml(r.aadhaar_proof)}', 'Aadhaar')"><i class="fas fa-id-card"></i></button>` : ''}
                                        ${r.pan_proof ? `<button class="action-btn-circle edit" style="width:24px;height:24px;font-size:10px;background:rgba(245,158,11,0.1);color:#f59e0b;" onclick="event.stopPropagation(); showKYCDoc('${escHtml(r.pan_proof)}', 'PAN')"><i class="fas fa-id-card"></i></button>` : ''}
                                        ${(r.signup_lat || r.lat) ? `
                                             <button class="action-btn-circle" style="width:24px;height:24px;font-size:10px;background:rgba(59,130,246,0.1);color:#3b82f6;" 
                                                     onclick="closeModal('userActivityModal'); showLandMap(${r.id}, ${r.signup_lat || r.lat}, ${r.signup_lng || r.lng || 0}, 1, 'Salary Location', '${escHtml(r.user_name || '').replace(/'/g, "\\'")}', 0)" title="View Land Map">
                                                 <i class="fas fa-satellite"></i>
                                             </button>` : ''}
                                    </div>
                                </td>
                                <td>
                                    ${r.kyc_photo ? `
                                        <div class="kyc-thumb" onclick="event.stopPropagation(); enlargeKYCPhoto('${escHtml(r.kyc_photo)}', '${escHtml(r.user_name)}')">
                                            <img src="${escHtml(r.kyc_photo)}" style="width:28px;height:28px;border-radius:4px;object-fit:cover;">
                                        </div>` : '—'}
                                </td>
                                <td><span class="status-badge ${r.status === 'approved' ? 'success' : r.status === 'pending' ? 'warning' : 'danger'}">${escHtml(r.status.toUpperCase())}</span></td>
                                <td style="color:var(--text-secondary);font-size:12px;">${new Date(r.request_date).toLocaleDateString('en-IN')}</td>
                                <td>
                                    <div style="display:flex;gap:6px;justify-content:center;">
                                        ${r.status === 'pending' ? `
                                            <button class="action-btn-circle view" onclick="event.stopPropagation(); handleAccountRequest(${r.id}, 'approve')" title="Approve"><i class="fas fa-check"></i></button>
                                            <button class="action-btn-circle edit" style="background:rgba(59,130,246,0.1);color:#3b82f6;" onclick="event.stopPropagation(); window.currentEditCustomer = { ...r, id: r.user_id, name: r.user_name, email: r.user_email, phone: r.user_phone, address: r.user_address, date_of_birth: r.user_dob }; showEditCustomerModal();" title="Edit Customer Details">
                                                <i class="fas fa-user-edit"></i>
                                            </button>
                                            <button class="action-btn-circle delete" onclick="event.stopPropagation(); handleAccountRequest(${r.id}, 'reject')" title="Reject"><i class="fas fa-times"></i></button>
                                        ` : '<span style="font-size:11px;color:#9ca3af;">Processed</span>'}
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>`;
    } catch (e) {
        el.innerHTML = '<p style="padding:16px;color:#ef4444;">Failed to load salary accounts.</p>';
    }
}

async function loadBusinessAccountsPage() {
    const el = document.getElementById('businessAccountsList');
    if (!el) return;
    el.innerHTML = '<p style="padding:16px;color:#9ca3af;">Loading Business Accounts...</p>';
    try {
        const r = await fetch(API + '/staff/account_requests', { credentials: 'include' });
        if (!r.ok) throw new Error();
        const data = await r.json();
        const requests = (data.requests || []).filter(req => req.account_type.toLowerCase() === 'current');

        const badge = document.getElementById('businessAccountsBadge');
        if (badge) {
            const pending = requests.filter(req => req.status === 'pending').length;
            badge.textContent = pending;
            badge.style.display = pending > 0 ? 'inline-flex' : 'none';
        }

        if (!requests.length) {
            el.innerHTML = '<p style="padding:16px;text-align:center;color:#9ca3af;">No business account requests found.</p>';
            return;
        }

        el.innerHTML = `
            <div class="premium-table-wrapper">
                <table class="premium-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Customer</th>
                            <th>Business Details</th>
                            <th>KYC Docs</th>
                            <th>Face Match</th>
                            <th>Status</th>
                            <th>Date</th>
                            <th style="text-align:center;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${requests.map(r => `
                            <tr>
                                <td class="acc-num-display">#${escHtml(r.id)}</td>
                                <td>
                                    <div style="font-weight:700;">${escHtml(r.user_name || '—')}</div>
                                    <div style="font-size:11px;color:var(--text-secondary);">${escHtml(r.user_email || '—')}</div>
                                </td>
                                <td>
                                    <div style="font-size:12px;font-weight:600;color:#92400e;margin-bottom:4px;">Tax ID: ${escHtml(r.tax_id || '—')}</div>
                                    ${r.current_proof ? `
                                        <button class="action-btn-circle" style="width:36px;height:36px;background:rgba(245,158,11,0.1);color:#f59e0b;" onclick="event.stopPropagation(); showKYCDoc('${escHtml(r.current_proof)}', 'Business Proof - ${escHtml(r.user_name)}')">
                                            <i class="fas fa-file-contract"></i>
                                        </button>
                                        <div style="font-size:10px;margin-top:2px;color:#f59e0b;font-weight:600;">Registration Proof</div>
                                    ` : '<span style="color:#ef4444;font-size:11px;">No Proof</span>'}
                                </td>
                                <td>
                                    <div style="display:flex;gap:4px;align-items:center;">
                                        ${r.aadhaar_proof ? `<button class="action-btn-circle view" style="width:24px;height:24px;font-size:10px;" onclick="event.stopPropagation(); showKYCDoc('${escHtml(r.aadhaar_proof)}', 'Aadhaar')"><i class="fas fa-id-card"></i></button>` : ''}
                                        ${r.pan_proof ? `<button class="action-btn-circle edit" style="width:24px;height:24px;font-size:10px;background:rgba(245,158,11,0.1);color:#f59e0b;" onclick="event.stopPropagation(); showKYCDoc('${escHtml(r.pan_proof)}', 'PAN')"><i class="fas fa-id-card"></i></button>` : ''}
                                        ${(r.signup_lat || r.lat) ? `
                                             <button class="action-btn-circle" style="width:24px;height:24px;font-size:10px;background:rgba(59,130,246,0.1);color:#3b82f6;" 
                                                     onclick="closeModal('userActivityModal'); showLandMap(${r.id}, ${r.signup_lat || r.lat}, ${r.signup_lng || r.lng || 0}, 1, 'Business Location', '${escHtml(r.user_name || '').replace(/'/g, "\\'")}', 0)" title="View Land Map">
                                                 <i class="fas fa-satellite"></i>
                                             </button>` : ''}
                                    </div>
                                </td>
                                <td>
                                    ${r.kyc_photo ? `
                                        <div class="kyc-thumb" onclick="event.stopPropagation(); enlargeKYCPhoto('${escHtml(r.kyc_photo)}', '${escHtml(r.user_name)}')">
                                            <img src="${escHtml(r.kyc_photo)}" style="width:28px;height:28px;border-radius:4px;object-fit:cover;">
                                        </div>` : '—'}
                                </td>
                                <td><span class="status-badge ${r.status === 'approved' ? 'success' : r.status === 'pending' ? 'warning' : 'danger'}">${escHtml(r.status.toUpperCase())}</span></td>
                                <td style="color:var(--text-secondary);font-size:12px;">${new Date(r.request_date).toLocaleDateString('en-IN')}</td>
                                <td>
                                    <div style="display:flex;gap:6px;justify-content:center;">
                                        ${r.status === 'pending' ? `
                                            <button class="action-btn-circle view" onclick="event.stopPropagation(); handleAccountRequest(${r.id}, 'approve')" title="Approve"><i class="fas fa-check"></i></button>
                                            <button class="action-btn-circle edit" style="background:rgba(59,130,246,0.1);color:#3b82f6;" onclick="event.stopPropagation(); window.currentEditCustomer = { ...r, id: r.user_id, name: r.user_name, email: r.user_email, phone: r.user_phone, address: r.user_address, date_of_birth: r.user_dob }; showEditCustomerModal();" title="Edit Customer Details">
                                                <i class="fas fa-user-edit"></i>
                                            </button>
                                            <button class="action-btn-circle delete" onclick="event.stopPropagation(); handleAccountRequest(${r.id}, 'reject')" title="Reject"><i class="fas fa-times"></i></button>
                                        ` : '<span style="font-size:11px;color:#9ca3af;">Processed</span>'}
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>`;
    } catch (e) {
        el.innerHTML = '<p style="padding:16px;color:#ef4444;">Failed to load business accounts.</p>';
    }
}


async function handleAccountRequest(reqId, action) {
    if (action === 'reject') {
        showPrompt({
            title: 'Reject KYC Request',
            message: 'Please provide a reason for rejecting this KYC request. This will be shown to the customer.',
            placeholder: 'e.g. Invalid document / Face match failed',
            confirmText: 'Reject Now',
            onConfirm: async (reason) => {
                if (!reason) return showToast('Rejection reason is required', 'error');
                executeAccountRequestAction(reqId, action, reason);
            }
        });
    } else {
        showConfirm({
            title: 'Approve Request',
            message: 'Are you sure you want to <strong>approve</strong> this account request?',
            icon: 'fa-check-circle',
            confirmText: 'Approve',
            messageIsHtml: true,
            onConfirm: () => executeAccountRequestAction(reqId, action)
        });
    }
}

async function executeAccountRequestAction(reqId, action, reason = '') {
    try {
        const res = await fetch(`${API}/staff/account_requests/${reqId}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, reason })
        });
        const data = await res.json();
        if (res.ok) {
            showToast(data.message || 'Request updated successfully', 'success');
            loadApprovalsPage();
            loadAgriAccountsPage();
            loadSalaryAccountsPage();
            loadBusinessAccountsPage();
        } else {
            showToast(data.error || 'Failed to update request', 'error');
        }
    } catch (e) {
        showToast('Network error', 'error');
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

    // Filter list items / cards and custom divs
    const listItems = activePage.querySelectorAll('.list-item, div[style*="border-bottom"]');
    listItems.forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(searchTerm) ? 'flex' : 'none';
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

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        const container = document.querySelector('.dashboard-container');
        if (container) container.classList.remove('blur-background');
    }
}

function showNotifications() {
    showModal('notificationsModal');
    // Mark as read optionally
    const badge = document.getElementById('notificationBadge');
    if (badge) badge.style.display = 'none';
}

// NOTIFICATIONS
// ==========================================

function showSendNotificationModal(userId, userName) {
    const userInput = document.getElementById('notifUserId');
    const titleInput = document.getElementById('notifTitle');
    const messageInput = document.getElementById('notifMessage');
    
    if (userInput) userInput.value = userId || '';
    if (titleInput) titleInput.value = '';
    if (messageInput) messageInput.value = '';
    
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

// Deletion Functions
async function deleteUser(userId, name) {
    showConfirm({
        title: 'Delete User',
        message: `You are about to permanently delete <strong>${escHtml(name)}</strong> and all their associated data.`,
        messageIsHtml: true,
        warning: '⚠ This will delete all accounts, transactions, and cards. THIS CANNOT BE UNDONE.',
        onConfirm: async () => {
            try {
                const res = await fetch(`${API}/admin/user/${userId}`, { method: 'DELETE', credentials: 'include' });
                const data = await res.json();
                if (res.ok) { 
                    showToast(data.message || 'User deleted successfully', 'success'); 
                    if (document.getElementById('agrihub')?.classList.contains('active')) {
                        loadAgriHubPage();
                    } else {
                        loadCustomersPage();
                    }
                }
                else { showToast(data.error || 'Failed to delete user', 'error'); }
            } catch (e) { showToast('Network error while deleting user', 'error'); }
        }
    });
}

async function deleteAccount(accountId, accNum) {
    showConfirm({
        title: 'Delete Account',
        message: `Are you sure you want to delete account <strong>${escHtml(accNum)}</strong>?`,
        warning: '⚠ This will delete all transactions for this account and cannot be undone.',
        onConfirm: async () => {
            try {
                const res = await fetch(`${API}/admin/account/${accountId}`, { method: 'DELETE', credentials: 'include' });
                const data = await res.json();
                if (res.ok) { showToast(data.message || 'Account deleted successfully', 'success'); loadStaffAccounts(); }
                else { showToast(data.error || 'Failed to delete account', 'error'); }
            } catch (e) { showToast('Network error while deleting account', 'error'); }
        }
    });
}

// Logout Function
function logout() {
    showConfirm({
        title: 'Logout',
        message: 'Are you sure you want to log out?',
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
        border - radius: 0.5rem;
        color: white;
        font - weight: 600;
        z - index: 9999;
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
        } else if (page === 'customers') {
            loadCustomersPage();
        } else if (page === 'accounts') {
            loadStaffAccounts();
        } else if (page === 'transactions') {
            loadStaffTransactions();
        } else if (page === 'loans' && typeof loadLoansPage === 'function') {
            loadLoansPage();
        } else if (page === 'reports') {
            loadReportsPage();
        }
    } else {
        loadDashboardData();
    }
}, 60000);



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
        statusText.innerHTML = `<span class="face-status-badge inactive"><i class="fas fa-times-circle"></i> Status Unknown</span>`;
        actionButtons.innerHTML = '';
        return;
    }

    if (data.enabled) {
        statusText.innerHTML = `<span class="face-status-badge active"><i class="fas fa-check-circle"></i> Active</span><br><small style="color: #6b7280; margin-top: 4px; display: inline-block;">Registered on ${escHtml(data.registered_date || 'Unknown date')}</small>`;
        actionButtons.innerHTML = `
            <button class="btn-face-action test" onclick="testFaceLogin()">
                <i class="fas fa-vial"></i> Test Login
            </button>
            <button class="btn-face-action delete" onclick="deleteFaceData()">
                <i class="fas fa-trash"></i> Remove
            </button>`;
    } else {
        statusText.innerHTML = `<span class="face-status-badge inactive"><i class="fas fa-times-circle"></i> Not Registered</span><br><small style="color: #6b7280; margin-top: 4px; display: inline-block;">Enable face login for quick access</small>`;
        actionButtons.innerHTML = `
            <button class="btn-face-action register" onclick="openFaceRegistration()">
                <i class="fas fa-user-plus"></i> Register Face
            </button>`;
    }
}





// Initialize on page load
function initStaffDashboard() {
    try {
        console.log('Staff Dashboard Initializing...');
        // Reparent all modals to body so they aren't affected by dashboard-container blur
        document.querySelectorAll('.modal').forEach(m => document.body.appendChild(m));
        
        initializeDashboard();
        initTheme();
        setupEventListeners();

        // Update Staff Greeting
        const staffName = localStorage.getItem('staffName') || 'Staff Member';
        const greetingEl = document.getElementById('staffGreeting');
        if (greetingEl) greetingEl.textContent = escHtml(staffName);
        
        // Show default page
        showPage('dashboard');

        setTimeout(loadFaceAuthStatus, 1000);
    } catch (error) {
        console.error('CRITICAL STARTUP ERROR:', error);
    }
}

// Load when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStaffDashboard);
} else {
    initStaffDashboard();
}


// ==========================================
// UNIFIED DATA LOADING & RENDERERS
// ==========================================

// ==========================================
// STAFF TRANSACTIONS (Add/Withdraw/Transfer)
// ==========================================
window.submitStaffAddMoney = async function (e) {
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
            loadStaffTransactions();
        } else {
            showToast(d.error || 'Failed to add money', 'error');
        }
    } catch (err) { showToast('Error connecting to server', 'error'); }
    finally { btn.disabled = false; }
};

window.submitStaffWithdrawMoney = async function (e) {
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
            loadStaffTransactions();
        } else {
            showToast(d.error || 'Failed to withdraw money', 'error');
        }
    } catch (err) { showToast('Error connecting to server', 'error'); }
    finally { btn.disabled = false; }
};

window.submitStaffTransferMoney = async function (e) {
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
            loadStaffTransactions();
        } else {
            showToast(d.error || 'Transfer failed', 'error');
        }
    } catch (err) { showToast('Error connecting to server', 'error'); }
    finally { btn.disabled = false; }
};

// ==========================================
// QUICK ACTIONS (Deposit/Withdraw)
// ==========================================
window.depositMoney = function (accId, accNum) {
    const elId = document.getElementById('addAccountId');
    if (elId) elId.value = accNum || accId;
    showPage('transactions');
    showToast('Prepare deposit for Account: ' + escHtml(accNum || accId), 'info');
};

window.withdrawMoney = function (accId, accNum) {
    const elId = document.getElementById('withdrawAccountId');
    if (elId) elId.value = accNum || accId;
    showPage('transactions');
    showToast('Prepare withdrawal for Account: ' + escHtml(accNum || accId), 'info');
};

window.viewAccount = async function (id) {
    try {
        const r = await fetch(`${API}/staff/accounts/${id}/details`, { credentials: 'include' });
        if (!r.ok) throw new Error('Failed to fetch details');
        const data = await r.json();
        const acc = data.account;
        const txns = data.transactions || [];

        // Populate Header/Status
        document.getElementById('viewAccNumberDisplay').textContent = escHtml(acc.account_number);
        const statusEl = document.getElementById('viewAccStatusDisplay');
        const statusColor = acc.status === 'active' ? '#4ade80' : '#ef4444';
        statusEl.innerHTML = `<span style="width: 8px; height: 8px; border-radius: 50%; background: ${statusColor};"></span> ${escHtml(acc.status.charAt(0).toUpperCase() + acc.status.slice(1))} Account`;

        // Populate Info Cards
        document.getElementById('viewAccType').textContent = escHtml(acc.account_type);
        document.getElementById('viewAccBalance').textContent = `₹${(acc.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
        document.getElementById('viewAccCustomer').textContent = escHtml(acc.user_name || 'N/A');
        document.getElementById('viewAccPhone').textContent = escHtml(acc.user_phone || 'N/A');
        document.getElementById('viewAccIfsc').textContent = escHtml(acc.ifsc || '—');
        document.getElementById('viewAccBranch').textContent = escHtml(acc.branch || '—');

        // Populate Transactions
        const txnList = document.getElementById('viewAccTransactionsList');
        if (txns.length === 0) {
            txnList.innerHTML = '<tr><td colspan="5" style="padding:30px; text-align:center; color:#94a3b8; font-style:italic;">No transactions recorded for this account.</td></tr>';
        } else {
            txnList.innerHTML = txns.map(t => `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding:14px 20px; font-size:12px; color:#64748b; font-family:monospace; font-weight:700;">#${escHtml(t.id)}</td>
                    <td style="padding:14px 20px; font-size:13px; color:#1e293b; font-weight:500;">${escHtml(t.description || 'General Transaction')}</td>
                    <td style="padding:14px 20px;">
                        <span style="background:${t.type === 'credit' ? '#dcfce7' : '#fee2e2'}; color:${t.type === 'credit' ? '#166534' : '#991b1b'}; padding:4px 10px; border-radius:8px; font-size:11px; font-weight:700; text-transform:uppercase;">${escHtml(t.type)}</span>
                    </td>
                    <td style="padding:14px 20px; text-align:right; font-weight:700; color:${t.type === 'credit' ? '#166534' : '#1e293b'}; font-size:14px;">₹${(t.amount || 0).toLocaleString('en-IN')}</td>
                    <td style="padding:14px 20px; font-size:12px; color:#64748b;">${new Date(t.transaction_date).toLocaleDateString('en-IN')}</td>
                </tr>
            `).join('');
        }

        showModal('viewAccountModal');
    } catch (err) {
        console.error(err);
        showToast('Error loading account details', 'error');
    }
};

// Compatibility mappings for old calls
const loadAccountsPage = loadStaffAccounts;
const refreshAccounts = loadStaffAccounts;
const refreshLoans = loadLoansPage;
const refreshCards = loadCardsPage;

// Identifier Lookup Utilities
window.launchUserLookup = async function () {
    const query = await prompt("Enter Customer Name, Phone, or Username to search:");
    if (!query) return;

    try {
        const r = await fetch(`${API}/staff/lookup?type=user&q=${encodeURIComponent(query)}`, { credentials: 'include' });
        const d = await r.json();
        if (d.success && d.data && d.data.length > 0) {
            const results = d.data.map(u => `ID: ${escHtml(u.id)} | Name: ${escHtml(u.name)} | Phone: ${escHtml(u.phone)}`).join('\n');
            const choice = await prompt(`Results found:\n\n${results}\n\nEnter the ID of the customer you want to select:`);
            if (choice) {
                document.getElementById('newAccountUserId').value = choice;
            }
        } else {
            showToast('No users found matching that query', 'info');
        }
    } catch (err) {
        showToast('Error searching for user', 'error');
    }
};

// Global search overrides or helpers can be added here
const approveLoan = (id) => updateLoanStatus(id, 'approved');
const rejectLoan = (id) => updateLoanStatus(id, 'rejected');

async function updateLoanStatus(loanId, status) {
    const modalId = status === 'approved' ? 'approveLoanModal' : 'rejectLoanModal';
    const confirmBtnId = status === 'approved' ? 'confirmApproveLoanBtn' : 'confirmRejectLoanBtn';

    const modal = document.getElementById(modalId);
    const confirmBtn = document.getElementById(confirmBtnId);

    modal.classList.add('active');

    confirmBtn.onclick = async () => {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

        try {
            const response = await fetch(`${API}/staff/loans/${loanId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: status }),
                credentials: 'include'
            });

            const result = await response.json();

            if (response.ok && result.success) {
                if (typeof showToast === 'function') showToast(`Loan ${status} successfully!`, 'success');
                closeModal(modalId);
                loadLoansPage(); // Refresh table
            } else {
                const err = result.error || `Failed to mark loan as ${status}`;
                if (typeof showToast === 'function') showToast(err, 'error');
            }
        } catch (err) {
            if (typeof showToast === 'function') showToast('Network error while updating loan status.', 'error');
            console.error('updateLoanStatus error:', err);
        } finally {
            confirmBtn.disabled = false;
            confirmBtn.textContent = status === 'approved' ? 'Approve & Disburse' : 'Confirm Rejection';
        }
    };
}

function showKYCDoc(data, title) {
    const modal = document.createElement('div');
    modal.className = 'kyc-doc-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:10000;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:15px;';

    const isPDF = data && data.startsWith('data:application/pdf');

    modal.innerHTML = `
        <div style="background:#fff; padding:12px; border-radius:12px; max-width:95%; width:400px; display:flex; flex-direction:column; position:relative; box-shadow:0 20px 25px -5px rgba(0,0,0,0.1);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:6px;">
                <h3 style="margin:0; color:#1f2937; font-size: 14px;">${escHtml(title)}</h3>
                <button onclick="this.closest('.kyc-doc-modal').remove()" style="background:#ef4444; color:white; border:none; border-radius:50%; width:22px; height:22px; cursor:pointer; font-size:14px; display:flex; align-items:center; justify-content:center;">&times;</button>
            </div>
            <div style="flex:1; overflow:auto; text-align:center; min-height:120px; background:#f9fafb; border-radius:8px;">
                ${isPDF ?
            `<iframe src="${escHtml(data)}" style="width:100%; height:380px; border:none;"></iframe>` :
            `<img src="${escHtml(data)}" style="max-width:100%; max-height:45vh; border-radius:4px; display: block; margin: 0 auto;">`
        }
            </div>
            <div style="margin-top:10px; display:flex; gap:6px;">
                <a href="${escHtml(data)}" download="${escHtml(title.replace(/\s+/g, '_'))}${isPDF ? '.pdf' : '.png'}" style="flex:1; text-align:center; padding:8px; background:#800000; color:white; border-radius:8px; text-decoration:none; font-weight:600; font-size:12px;">
                    <i class="fas fa-download"></i> Download
                </a>
                <button onclick="this.closest('.kyc-doc-modal').remove()" style="flex:1; padding:8px; background:#6b7280; color:white; border:none; border-radius:8px; font-weight:600; font-size:12px; cursor:pointer;">Close</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// ── Support Tickets Logic ── //

async function loadSupportTickets() {
    const tbody = document.getElementById('supportTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px;">Loading tickets...</td></tr>';

    try {
        const r = await fetch(`${API}/staff/support`, { credentials: 'include' });
        if (!r.ok) throw new Error('Failed to load tickets');

        const data = await r.json();
        const tickets = data.tickets || [];

        if (tickets.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:#6b7280;">No support tickets found.</td></tr>';
            return;
        }

        tbody.innerHTML = tickets.map(t => {
            const isPending = t.status === 'pending';
            const statusClass = isPending ? 'warning' : 'success';
            const actionBtn = isPending
                ? `<button class="action-btn-circle view" onclick="event.stopPropagation(); resolveTicket(${t.id})" title="Resolve"><i class="fas fa-check"></i></button>`
                : `<span style="font-size:12px;color:var(--text-secondary);">Resolved</span>`;

            const chatBtn = `<button class="action-btn-circle edit" onclick="event.stopPropagation(); openSupportChat(${t.id}, '${escHtml(t.user_name).replace(/'/g, "\\'")}')" title="Chat with User"><i class="fas fa-comments"></i></button>`;

            const priorityColors = {
                'low': '#10b981',
                'normal': '#6b7280',
                'urgent': '#ef4444'
            };
            const pColor = priorityColors[t.priority] || priorityColors.normal;

            return `
                <tr>
                    <td class="acc-num-display">#${escHtml(t.id)}</td>
                    <td>
                        <div style="font-weight:700;">${escHtml(t.user_name)}</div>
                        <div style="font-size:11px;color:var(--text-secondary);">${escHtml(t.user_email)}</div>
                    </td>
                    <td>
                        <div style="font-weight:600;">${escHtml(t.subject)}</div>
                        <div style="font-size:11px;color:var(--text-secondary);max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escHtml(t.message)}">${escHtml(t.message)}</div>
                    </td>
                    <td><span class="status-badge" style="background:${pColor}10;color:${pColor};border:1px solid ${pColor}20;">${escHtml(t.priority.toUpperCase())}</span></td>
                    <td style="font-size:12px;color:var(--text-secondary);">${new Date(t.created_at).toLocaleString('en-IN')}</td>
                    <td><span class="status-badge ${statusClass}">${escHtml(t.status.toUpperCase())}</span></td>
                    <td>
                       <div style="display:flex;justify-content:center;gap:8px;">
                           ${chatBtn}
                           ${actionBtn}
                       </div>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (e) {
        console.error('Error loading support tickets:', e);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:#ef4444;">Connection error. Please try again.</td></tr>';
    }
}

async function resolveTicket(id) {
    showConfirm({
        title: 'Resolve Ticket',
        message: `Mark ticket <strong>#${escHtml(id)}</strong> as resolved?`,
        icon: 'fa-check-circle',
        confirmText: 'Resolve',
        onConfirm: async () => {
            try {
                const r = await fetch(`${API}/staff/support/${id}/resolve`, {
                    method: 'PUT',
                    credentials: 'include'
                });
                const resData = await r.json();
                if (r.ok && resData.success) {
                    showToast('Ticket marked as resolved ✅', 'success');
                    loadSupportTickets();
                } else {
                    showToast('Failed to resolve: ' + (resData.error || 'Unknown error'), 'error');
                }
            } catch (e) {
                console.error('Resolve error:', e);
                showToast('Network error while resolving ticket.', 'error');
            }
        }
    });
}

/* ═══════════════════════════════════════════════════════════
   UNIFIED 3D MAP MODULE — MapLibre (Staff View)
   Shows user locations + Branch/ATM locator on one map
   ═══════════════════════════════════════════════════════════ */
let _staffLocatorMap = null;
let _staffLocatorMarkers = [];
let _staffLocatorLocations = [];  // branch/atm data
let _staffMapFilter = 'all';      // 'all', 'users', 'branch', 'atm'
let _staffMapInitialized = false;

async function loadMapPage() {
    const mapContainer = document.getElementById('mapContainer');
    if (!mapContainer) return;

    if (_staffMapInitialized && _staffLocatorMap) {
        setTimeout(() => _staffLocatorMap.resize(), 200);
        _fetchStaffMapData();
        return;
    }

    if (typeof maplibregl === 'undefined') {
        mapContainer.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#94a3b8;font-size:14px;">
            <i class="fas fa-exclamation-triangle" style="margin-right:8px;"></i> MapLibre library not loaded</div>`;
        return;
    }

    try {
        _staffLocatorMap = new maplibregl.Map({
            container: 'mapContainer',
            style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
            center: [79.0882, 21.1458], // Central India
            zoom: 4.5,
            pitch: 60, // 3D tilt
            bearing: -20, // Rotating the map slightly
            antialias: true
        });

        _staffLocatorMap.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true, visualizePitch: true }), 'top-right');
        _staffLocatorMap.addControl(new maplibregl.FullscreenControl(), 'top-right');

        const geolocate = new maplibregl.GeolocateControl({
            positionOptions: { enableHighAccuracy: true },
            trackUserLocation: false,
            showUserLocation: true
        });
        _staffLocatorMap.addControl(geolocate, 'top-right');

        // Inject pulse animation CSS
        if (!document.getElementById('staffMapPulseStyle')) {
            const style = document.createElement('style');
            style.id = 'staffMapPulseStyle';
            style.textContent = `
                @keyframes staffPing { 75%, 100% { transform: scale(2.5); opacity: 0; } }
                .maplibregl-popup-content { border-radius: 14px !important; box-shadow: 0 10px 40px rgba(0,0,0,0.15) !important; padding: 15px !important; }
                .maplibregl-popup-tip { display: none; }
            `;
            document.head.appendChild(style);
        }

        _staffLocatorMap.on('load', () => {
            _staffMapInitialized = true;
            _fetchStaffMapData();
        });

    } catch (err) {
        console.error('MapLibre init error:', err);
        mapContainer.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#ef4444;font-size:14px;">
            <i class="fas fa-exclamation-circle" style="margin-right:8px;"></i> Failed to initialize map</div>`;
    }
}

async function _fetchStaffMapData() {
    try {
        // Fetch user geo data and branch/ATM locations in parallel
        const [geoRes, locRes] = await Promise.all([
            fetch(`${API}/staff/geo-map`, { credentials: 'include' }),
            fetch(`${API}/user/locations`, { credentials: 'include' })
        ]);

        if (geoRes.ok) {
            const geoData = await geoRes.json();
            _staffMapAllData = geoData.markers || [];

            const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
            setText('mapTotalUsers', geoData.total_users ?? _staffMapAllData.length);
            setText('mapMappedUsers', geoData.mapped_users ?? _staffMapAllData.filter(m => m.lat && m.lng).length);
        } else {
            _staffMapAllData = [];
        }

        if (locRes.ok) {
            const locData = await locRes.json();
            _staffLocatorLocations = Array.isArray(locData) ? locData : [];
        } else {
            _staffLocatorLocations = [];
        }

        // Update branch/ATM stat counts
        const setText2 = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        setText2('mapBranchCount', _staffLocatorLocations.filter(l => (l.type||'').toLowerCase() === 'branch').length);
        setText2('mapAtmCount', _staffLocatorLocations.filter(l => (l.type||'').toLowerCase() === 'atm').length);

        _renderUnifiedStaffMap();
        renderMapTable(_staffMapAllData);
        loadLocationsTable();
    } catch (e) {
        console.error('Error loading map data:', e);
        if (typeof showToast === 'function') showToast('Error loading map data', 'error');
    }
}

function _renderUnifiedStaffMap() {
    if (!_staffLocatorMap) return;

    // Clear existing markers
    _staffLocatorMarkers.forEach(m => m.remove());
    _staffLocatorMarkers = [];

    const bounds = new maplibregl.LngLatBounds();
    let visibleCount = 0;
    const filter = _staffMapFilter;

    // ---------- Render USER Markers ----------
    if (filter === 'all' || filter === 'users') {
        const statusColors = { active: '#10b981', pending: '#f59e0b', blocked: '#ef4444', suspended: '#ef4444', inactive: '#6b7280' };
        const typeColors = { 'User': '#3b82f6', 'Farmer': '#10b981', 'Buyer': '#8b5cf6', 'Default': '#64748b' };

        _staffMapAllData.forEach(u => {
            if (!u.lat || !u.lng) return;
            visibleCount++;

            const typeColor = typeColors[u.type] || typeColors['Default'];
            const statusColor = statusColors[(u.status||'').toLowerCase()] || '#6b7280';

            const el = document.createElement('div');
            el.style.cssText = 'position:relative; width:16px; height:16px; cursor:pointer;';
            el.innerHTML = `
                <div style="width:16px;height:16px;background:${typeColor};border-radius:50%;border:2px solid #fff;box-shadow:0 0 8px ${typeColor}80;position:relative;z-index:2;"></div>
                <div style="width:16px;height:16px;background:${typeColor};border-radius:50%;position:absolute;top:0;left:0;animation:staffPing 1.5s cubic-bezier(0,0,0.2,1) infinite;opacity:0.3;"></div>
            `;

            const popup = new maplibregl.Popup({ offset: 25, maxWidth: '260px' }).setHTML(`
                <div style="font-family:'Inter',system-ui,sans-serif; min-width:200px; padding:4px;">
                    <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:4px;">
                        <div style="font-weight:700; font-size:15px; color:#1f2937;">${escHtml(u.name)}</div>
                        <span style="font-size:10px; font-weight:800; padding:2px 6px; border-radius:4px; background:${typeColor}20; color:${typeColor}; border:1px solid ${typeColor}40;">${(u.type||'User').toUpperCase()}</span>
                    </div>
                    <div style="font-size:12px; color:#6b7280; margin-bottom:10px;">@${escHtml(u.username)}</div>
                    <div style="display:grid; gap:6px; margin-bottom:10px;">
                        <div style="font-size:12px; display:flex; align-items:center; gap:8px;">
                            <span style="width:16px; text-align:center;">📍</span> <span>${escHtml(u.city || 'Unknown')}, ${escHtml(u.country || '') || '—'}</span>
                        </div>
                        <div style="font-size:12px; display:flex; align-items:center; gap:8px;">
                            <span style="width:16px; text-align:center;">🌐</span> <code style="background:#f3f4f6; padding:2px 4px; border-radius:3px; font-size:11px;">${escHtml(u.ip || 'Local')}</code>
                        </div>
                        <div style="font-size:12px; display:flex; align-items:center; gap:8px;">
                            <span style="width:16px; text-align:center;">🛡️</span> <span style="color:${statusColor}; font-weight:600;">${(u.status||'').toUpperCase()}</span>
                        </div>
                    </div>
                    <div style="border-top:1px solid #f3f4f6; padding-top:8px; display:flex; justify-content:space-between; align-items:center;">
                        <div style="font-size:10px; color:#9ca3af;">Joined ${u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN') : '—'}</div>
                        <div style="font-size:11px; font-weight:700; color:#4b5563;">${u.account_count} Acct(s)</div>
                    </div>
                </div>
            `);

            const marker = new maplibregl.Marker({ element: el })
                .setLngLat([u.lng, u.lat])
                .setPopup(popup)
                .addTo(_staffLocatorMap);

            bounds.extend([u.lng, u.lat]);
            _staffLocatorMarkers.push(marker);
        });
    }

    // ---------- Render BRANCH / ATM Markers ----------
    if (filter === 'all' || filter === 'branch' || filter === 'atm') {
        const locsToRender = filter === 'all'
            ? _staffLocatorLocations
            : _staffLocatorLocations.filter(l => (l.type||'').toLowerCase() === filter);

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
                .addTo(_staffLocatorMap);

            bounds.extend([loc.lng, loc.lat]);
            _staffLocatorMarkers.push(marker);
        });
    }

    // Update count badge
    const countEl = document.getElementById('staffLocCountText');
    if (countEl) {
        countEl.textContent = visibleCount === 0 ? 'No locations found' : `${visibleCount} location${visibleCount !== 1 ? 's' : ''} found`;
    }

    // Fly to fit bounds
    if (visibleCount === 1) {
        const firstBounds = bounds.getCenter();
        _staffLocatorMap.flyTo({ center: firstBounds, zoom: 14, pitch: 50, bearing: 0, duration: 1500 });
    } else if (visibleCount > 1) {
        _staffLocatorMap.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 1500, pitch: 45, bearing: -10 });
    }
}

window.staffMapFilterBy = function(type, btn) {
    _staffMapFilter = type;
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
    _renderUnifiedStaffMap();
};

async function initDashboardMap(forceRefresh = false) {
    const mapContainer = document.getElementById('dashboardMap');
    if (!mapContainer) return;

    if (typeof L === 'undefined') {
        console.error('Leaflet.js not loaded');
        return;
    }

    try {
        if (!_dashboardMap) {
            _dashboardMap = L.map('dashboardMap', {
                zoomControl: false,
                dragging: false,
                scrollWheelZoom: false,
                doubleClickZoom: false,
                touchZoom: false
            }).setView([20.5937, 78.9629], 4);
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OSM'
            }).addTo(_dashboardMap);
        }

        let markers = _staffMapAllData;
        if (markers.length === 0 || forceRefresh) {
            const res = await fetch(`${API}/staff/geo-map`, { credentials: 'include' });
            const data = await res.json();
            markers = data.markers || [];
            _staffMapAllData = markers; 
        }

        if (forceRefresh) {
            _dashboardMap.eachLayer(layer => {
                if (layer instanceof L.CircleMarker) _dashboardMap.removeLayer(layer);
            });
        }

        markers.forEach(u => {
            if (!u.lat || !u.lng) return;
            L.circleMarker([u.lat, u.lng], {
                radius: 4,
                fillColor: u.status === 'active' ? '#10b981' : (u.status === 'pending' ? '#f59e0b' : '#ef4444'),
                color: '#fff',
                weight: 1,
                opacity: 1,
                fillOpacity: 0.8
            }).addTo(_dashboardMap);
        });

        if (markers.length > 0) {
            const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng]));
            _dashboardMap.fitBounds(bounds, { padding: [20, 20] });
        }

        setTimeout(() => { if (_dashboardMap) _dashboardMap.invalidateSize(); }, 500);
    } catch (e) {
        console.error('Dashboard map init error:', e);
    }
}

function renderMapTable(markers) {
    const container = document.getElementById('mapUserTable');
    if (!container) return;
    const countEl = document.getElementById('mapUserCount');
    if (countEl) countEl.textContent = `${markers.length} user${markers.length !== 1 ? 's' : ''}`;
    if (!markers.length) {
        container.innerHTML = '<div style="padding:2rem; text-align:center; color:#9ca3af;"><i class="fas fa-map-marked-alt" style="font-size:32px; margin-bottom:12px; display:block;"></i>No user location data found.</div>';
        return;
    }
    const colorOf = s => (s === 'active' ? '#10b981' : (s === 'pending' ? '#f59e0b' : '#ef4444'));
    const bgOf   = s => (s === 'active' ? 'rgba(16,185,129,0.1)' : (s === 'pending' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)'));
    const iconOf  = s => (s === 'active' ? 'fa-circle-check' : (s === 'pending' ? 'fa-clock' : 'fa-circle-xmark'));

    window._staffMapMarkerData = markers;

    container.innerHTML = `
        <table class="premium-table" style="font-size:13px; width:100%;">
            <thead>
                <tr>
                    <th>#</th><th>User</th><th>Location</th><th>IP Address</th><th>Status</th><th>Accs</th><th>Joined</th>
                </tr>
            </thead>
            <tbody>
                ${markers.map((u, i) => `
                    <tr style="cursor:pointer;" onclick="staffFlyToMarker(${u.lat}, ${u.lng})">
                        <td style="color:#9ca3af;">${i + 1}</td>
                        <td>
                            <div style="font-weight:600;">${escHtml(u.name)}</div>
                            <div style="font-size:11px; color:#9ca3af;">@${escHtml(u.username)}</div>
                        </td>
                        <td>${escHtml(u.city || '—')}, ${escHtml(u.country || '—')}</td>
                        <td style="font-family:monospace; font-size:12px;">${escHtml(u.ip || '—')}</td>
                        <td>
                            <span class="status-badge" style="background:${colorOf(u.status)}20; color:${colorOf(u.status)}; border:none;">
                                ${(u.status||'').toUpperCase()}
                            </span>
                        </td>
                        <td>${u.account_count}</td>
                        <td style="color:#6b7280;">${u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN') : '—'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

window.staffFlyToMarker = function(lat, lng) {
    if (_staffLocatorMap) {
        _staffLocatorMap.flyTo({
            center: [lng, lat],
            zoom: 17,
            pitch: 60,
            bearing: -20,
            speed: 1.5,
            curve: 1
        });
    }
};

window.flyToMarker = function(lat, lng) {
    if (_staffLocatorMap) {
        _staffLocatorMap.flyTo({ center: [lng, lat], zoom: 15, pitch: 55, bearing: -15, speed: 1.5 });
    }
    document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
    const mapPage = document.getElementById('map');
    if (mapPage) mapPage.classList.add('active');
};

/* ════════════════════════════════════════════════════════════
   AGRICULTURE LOAN MANAGEMENT (STAFF)
   ════════════════════════════════════════════════════════════ */
async function loadAgriLoansPage() {
    const el = document.getElementById('agriLoansList');
    if (!el) return;
    
    el.innerHTML = `
        <div style="padding: 40px; text-align: center; color: var(--text-secondary);">
            <i class="fas fa-spinner fa-spin" style="font-size: 24px; margin-bottom: 15px;"></i>
            <p>Loading AI Loan Applications...</p>
        </div>`;
        
    try {
        const r = await fetch(API + '/agri/staff/all', { credentials: 'include' });
        if (!r.ok) throw new Error('API Error');
        const data = await r.json();
        const loans = data.loans || [];

        // Update badge count
        const badge = document.getElementById('agriLoanBadge');
        const pendingCount = loans.filter(l => l.status === 'pending').length;
        if(badge) {
            badge.textContent = pendingCount;
            badge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
        }

        if (!loans.length) {
            el.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--text-secondary);">No Agriculture Loan Applications Found.</div>';
            return;
        }

        el.innerHTML = `
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Applicant</th>
                            <th>Location</th>
                            <th>Details</th>
                            <th>Amount</th>
                            <th>AI Score</th>
                            <th>Status</th>
                            <th>Applied On</th>
                            <th style="text-align:center;">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${loans.map(loan => {
                            let scoreColor = 'var(--text-secondary)';
                            if(loan.ai_health_score !== null) {
                                if(loan.ai_health_score >= 75) scoreColor = 'var(--success)';
                                else if(loan.ai_health_score >= 50) scoreColor = 'var(--warning)';
                                else scoreColor = 'var(--danger)';
                            }

                            return `
                                <tr style="cursor:pointer;" onclick="event.stopPropagation(); showLandMap(${loan.id}, ${loan.farm_coordinates.split(',')[0]}, ${loan.farm_coordinates.split(',')[1]}, ${loan.land_size_acres}, '${escHtml(loan.crop_type)}', '${escHtml(loan.user_name || 'User ' + loan.user_id)}', ${loan.ai_health_score}, ${loan.geometry ? `'${loan.geometry}'` : 'null'}, 'HIDDEN', 'HIDDEN', '${escHtml(loan.user_email || '—')}')">
                                    <td class="acc-num-display">#${loan.id}</td>
                                    <td>
                                        <div style="font-weight:700;">${escHtml(loan.user_name || 'User ' + loan.user_id)}</div>
                                    </td>
                                    <td>
                                        <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); showLandMap(${loan.id}, ${loan.farm_coordinates.split(',')[0]}, ${loan.farm_coordinates.split(',')[1]}, ${loan.land_size_acres}, '${escHtml(loan.crop_type)}', '${escHtml(loan.user_name || 'User ' + loan.user_id)}', ${loan.ai_health_score}, ${loan.geometry ? `'${loan.geometry}'` : 'null'}, 'HIDDEN', 'HIDDEN', '${escHtml(loan.user_email || '—')}')" style="padding: 4px 8px; font-size: 11px;">
                                            <i class="fas fa-map-marked-alt"></i> View Land Map
                                        </button>
                                        <div style="font-size:10px;color:var(--text-secondary);font-family:monospace;margin-top:4px;">${escHtml(loan.farm_coordinates)}</div>
                                    </td>
                                    <td>
                                        <div style="font-size:13px;font-weight:600;">${escHtml(loan.crop_type)}</div>
                                        <div style="font-size:11px;color:var(--text-secondary);">${loan.land_size_acres} Acres</div>
                                    </td>
                                    <td style="font-weight:700;">₹${Number(loan.requested_amount).toLocaleString('en-IN')}</td>
                                    <td>
                                        <div style="font-size:16px;font-weight:800;color:${scoreColor}">${loan.ai_health_score !== null ? loan.ai_health_score : 'N/A'}</div>
                                    </td>
                                    <td>
                                        <span class="status-badge ${loan.status === 'approved' ? 'success' : loan.status === 'rejected' ? 'danger' : 'warning'}">
                                            ${escHtml(loan.status.toUpperCase())}
                                        </span>
                                    </td>
                                    <td style="font-size:12px;color:var(--text-secondary);">${new Date(loan.applied_at).toLocaleDateString('en-IN')}</td>
                                    <td>
                                        <div style="display:flex;gap:6px;justify-content:center;">
                                            ${loan.status === 'pending' ? `
                                                <button class="action-btn-circle view" onclick="event.stopPropagation(); processAgriLoan(${loan.id}, 'approved')" title="Approve">
                                                    <i class="fas fa-check"></i>
                                                </button>
                                                <button class="action-btn-circle edit" style="background:rgba(59,130,246,0.1);color:#3b82f6;" onclick="event.stopPropagation(); window.currentEditCustomer = { ...loan, id: loan.user_id, name: loan.user_name, email: loan.user_email }; showEditCustomerModal();" title="Edit Customer Details">
                                                    <i class="fas fa-user-edit"></i>
                                                </button>
                                                <button class="action-btn-circle delete" onclick="event.stopPropagation(); processAgriLoan(${loan.id}, 'rejected')" title="Reject">
                                                    <i class="fas fa-times"></i>
                                                </button>
                                            ` : '<span style="color:var(--text-secondary);font-size:11px;">Processed</span>'}
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
    } catch(err) {
        console.error("Error loading agri loans:", err);
        el.innerHTML = '<div style="padding:20px;color:#ef4444;text-align:center;">Failed to load Agri loans.</div>';
    }
}

async function processAgriLoan(loanId, status) {
    if(!(await confirm(`Are you sure you want to mark this Agriculture Loan as ${status.toUpperCase()}?`))) return;
    
    try {
        const r = await fetch(`${API}/agri/staff/process/${loanId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ status: status })
        });
        
        const data = await r.json();
        if(r.ok) {
            showToast(`Loan ${status} successfully`, 'success');
            loadAgriLoansPage(); // refresh table
            if($id('landMapModal').style.display !== 'none') closeModal('landMapModal');
        } else {
            showToast(data.error || 'Failed to process loan', 'error');
        }
    } catch(e) {
        showToast('Connection error', 'error');
    }
}

let agriMap = null;
let agriMarkers = [];
let currentAgriLoanId = null;
const agriMapLayers = {
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    }),
    terrain: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri'
    })
};

function showLandMap(loanId, lat, lng, sizeAcres = 1, cropType = 'General', applicant = 'Applicant', score = 0, geometry = null, aadhaar = '—', pan = '—', email = '—') {
    currentAgriLoanId = loanId;
    openModal('landMapModal');
    
    // UI Updates
    if($id('landDetailName')) $id('landDetailName').textContent = applicant || 'Applicant';
    if($id('landDetailEmail')) $id('landDetailEmail').textContent = email || '—';
    if($id('landDetailAadhaar')) $id('landDetailAadhaar').textContent = aadhaar || '—';
    if($id('landDetailPan')) $id('landDetailPan').textContent = pan || '—';
    
    if($id('landDetailCrop')) $id('landDetailCrop').textContent = cropType || 'General';
    if($id('landDetailSize')) $id('landDetailSize').textContent = (sizeAcres || 1) + ' Acres';
    if($id('landDetailScore')) $id('landDetailScore').textContent = score || '0';
    if($id('landScoreProgress')) $id('landScoreProgress').style.width = (score || 0) + '%';

    const latNum = typeof lat === 'string' ? parseFloat(lat) : lat;
    const lngNum = typeof lng === 'string' ? parseFloat(lng) : lng;

    if($id('landDetailCoords')) $id('landDetailCoords').textContent = `${latNum.toFixed(4)}, ${lngNum.toFixed(4)}`;
    
    const scoreVal = score || 0;
    const scoreColor = scoreVal >= 75 ? "#10b981" : (scoreVal >= 50 ? "#f59e0b" : (scoreVal > 0 ? "#ef4444" : "#6b7280"));
    if($id('landDetailScore')) $id('landDetailScore').style.color = scoreColor;
    if($id('landScoreProgress')) $id('landScoreProgress').style.background = scoreColor;

    // Backward compatibility for old panel if it exists
    if($id('landCropType')) $id('landCropType').textContent = cropType || 'General';
    if($id('landSizeText')) $id('landSizeText').textContent = (sizeAcres || 1) + ' Acres';
    if($id('landApplicantName')) $id('landApplicantName').textContent = applicant || 'Applicant';
    if($id('landAiScore')) $id('landAiScore').textContent = score || 'N/A';

    setTimeout(() => {
        if (!agriMap) {
            agriMap = L.map('agriLandMap', {
                zoomControl: true,
                layers: [agriMapLayers.satellite]
            });
        }
        
        agriMarkers.forEach(m => agriMap.removeLayer(m));
        agriMarkers = [];

        // Parse geometry if it exists
        let polygonCoords = null;
        if (geometry) {
            try {
                polygonCoords = typeof geometry === 'string' ? JSON.parse(geometry) : geometry;
                if (!Array.isArray(polygonCoords) || polygonCoords.length < 3) {
                    polygonCoords = null;
                }
            } catch (e) {
                console.error("Invalid geometry data:", e);
                polygonCoords = null;
            }
        }

        const plotColor = score >= 75 ? "#10b981" : (score >= 50 ? "#f59e0b" : (score > 0 ? "#ef4444" : "#3b82f6"));
        let landLayer = null;

        if (polygonCoords) {
            // Draw custom polygon
            landLayer = L.polygon(polygonCoords, {
                color: plotColor,
                weight: 3,
                fillOpacity: 0.3,
                dashArray: null
            }).addTo(agriMap);
            agriMap.fitBounds(landLayer.getBounds(), { padding: [20, 20] });
        } else {
            // Fallback to rectangle
            agriMap.setView([latNum, lngNum], 17);
            const sideMeters = Math.sqrt((sizeAcres || 1) * 4046.86);
            const latOffset = (sideMeters / 111320) / 2;
            const lngOffset = (sideMeters / (111320 * Math.cos(latNum * Math.PI / 180))) / 2;
            
            const bounds = [
                [latNum - latOffset, lngNum - lngOffset],
                [latNum + latOffset, lngNum + lngOffset]
            ];
            
            landLayer = L.rectangle(bounds, {
                color: plotColor,
                weight: 3,
                fillOpacity: 0.25,
                dashArray: '5, 10'
            }).addTo(agriMap);
        }
        
        const marker = L.marker([latNum, lngNum]).addTo(agriMap)
            .bindPopup(`<b>${applicant}</b><br>${cropType} - ${sizeAcres || 1} Acres`)
            .openPopup();
            
        agriMarkers.push(landLayer, marker);
        agriMap.invalidateSize();
    }, 300);
}

function changeAgriMapLayer(type) {
    if(!agriMap) return;
    Object.values(agriMapLayers).forEach(layer => agriMap.removeLayer(layer));
    agriMap.addLayer(agriMapLayers[type]);
    
    $id('agriSatBtn').classList.toggle('active', type === 'satellite');
    $id('agriTerrBtn').classList.toggle('active', type === 'terrain');
}

function openAgriStatusInModal() {
    if(!currentAgriLoanId) return;
    showConfirm({
        title: 'Process Application',
        message: 'Would you like to approve this land application based on the map verification?'
    }).then(yes => {
        if(yes) processAgriLoan(currentAgriLoanId, 'approved');
    });
}

// Global variables moved to top or managed here

// =============================================
// AGRICULTURE HUB: UNIFIED VIEW
// =============================================


async function viewAgriHubDetails(accountId) {
    if (!accountId) return;
    const API = window.API || '/api';

    try {
        const res = await fetch(`${API}/staff/accounts/${accountId}/details`, { credentials: 'include' });
        if (!res.ok) throw new Error(`Failed to load details (${res.status})`);
        const data = await res.json();
        const acc = data.account;
        const txns = data.transactions || [];

        // Remove existing detail panel
        const existing = document.getElementById('agriDetailPanel');
        if (existing) existing.remove();

        const panel = document.createElement('div');
        panel.id = 'agriDetailPanel';
        panel.style.cssText = 'position:fixed; top:0; right:0; bottom:0; width:480px; max-width:96vw; background:#fff; box-shadow:-10px 0 50px rgba(0,0,0,0.15); z-index:9999; display:flex; flex-direction:column; transform:translateX(100%); transition:transform 0.4s cubic-bezier(0.2,0.8,0.2,1);';

        if (document.body.classList.contains('dark-theme')) {
            panel.style.background = 'var(--bg-secondary, #1e293b)';
        }

        panel.innerHTML = `
            <div style="background:linear-gradient(135deg,#800000,#4a0000); padding:28px 24px; flex-shrink:0;">
                <button onclick="document.getElementById('agriDetailPanel').style.transform='translateX(100%)'; setTimeout(()=>document.getElementById('agriDetailPanel').remove(),400)" 
                    style="position:absolute; top:16px; right:16px; background:rgba(255,255,255,0.15); border:none; border-radius:50%; width:32px; height:32px; cursor:pointer; color:#fff; font-size:18px; display:flex; align-items:center; justify-content:center;">×</button>
                <div style="display:flex; align-items:center; gap:16px;">
                    <div style="width:56px; height:56px; border-radius:16px; background:rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center;">
                        <i class="fas fa-seedling" style="color:#fff; font-size:24px;"></i>
                    </div>
                    <div>
                        <div style="color:#fff; font-size:20px; font-weight:800;">${escHtml(acc.user_name || 'Customer')}</div>
                        <div style="color:rgba(255,255,255,0.7); font-size:13px;">Agriculture Account</div>
                    </div>
                </div>
            </div>

            <div style="flex:1; overflow-y:auto; padding:20px; display:flex; flex-direction:column; gap:16px;">
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                    <div style="background:var(--bg-light,#f8fafc); border-radius:14px; padding:16px; border:1px solid var(--border-color,#e2e8f0);">
                        <div style="font-size:10px; text-transform:uppercase; color:#64748b; font-weight:700; letter-spacing:1px; margin-bottom:6px;">Account Number</div>
                        <div style="font-weight:800; color:var(--text-primary); font-family:monospace; font-size:14px;">${escHtml(acc.account_number)}</div>
                    </div>
                    <div style="background:var(--bg-light,#f8fafc); border-radius:14px; padding:16px; border:1px solid var(--border-color,#e2e8f0);">
                        <div style="font-size:10px; text-transform:uppercase; color:#64748b; font-weight:700; letter-spacing:1px; margin-bottom:6px;">IFSC Code</div>
                        <div style="font-weight:700; color:var(--text-primary); font-size:14px;">${escHtml(acc.ifsc || 'SMTB0000001')}</div>
                    </div>
                    <div style="background:var(--bg-light,#f8fafc); border-radius:14px; padding:16px; border:1px solid var(--border-color,#e2e8f0);">
                        <div style="font-size:10px; text-transform:uppercase; color:#64748b; font-weight:700; letter-spacing:1px; margin-bottom:6px;">Balance</div>
                        <div style="font-weight:900; color:var(--success); font-size:20px;">₹${Number(acc.balance || 0).toLocaleString('en-IN')}</div>
                    </div>
                    <div style="background:var(--bg-light,#f8fafc); border-radius:14px; padding:16px; border:1px solid var(--border-color,#e2e8f0);">
                        <div style="font-size:10px; text-transform:uppercase; color:#64748b; font-weight:700; letter-spacing:1px; margin-bottom:6px;">Status</div>
                        <span class="status-badge ${acc.status === 'active' ? 'success' : 'warning'}" style="font-size:12px; padding:5px 14px; border-radius:100px;">${(acc.status || 'active').toUpperCase()}</span>
                    </div>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                    <div style="background:var(--bg-light,#f8fafc); border-radius:14px; padding:16px; border:1px solid var(--border-color,#e2e8f0);">
                        <div style="font-size:10px; text-transform:uppercase; color:#64748b; font-weight:700; letter-spacing:1px; margin-bottom:6px;">Account Type</div>
                        <div style="font-weight:700; color:var(--text-primary); font-size:14px;"><i class="fas fa-seedling" style="color:var(--success); margin-right:4px;"></i> ${escHtml(acc.account_type)}</div>
                    </div>
                    <div style="background:var(--bg-light,#f8fafc); border-radius:14px; padding:16px; border:1px solid var(--border-color,#e2e8f0);">
                        <div style="font-size:10px; text-transform:uppercase; color:#64748b; font-weight:700; letter-spacing:1px; margin-bottom:6px;">Branch</div>
                        <div style="font-weight:700; color:var(--text-primary); font-size:13px;">${escHtml(acc.branch || 'Main Branch')}</div>
                    </div>
                    <div style="background:var(--bg-light,#f8fafc); border-radius:14px; padding:16px; border:1px solid var(--border-color,#e2e8f0);">
                        <div style="font-size:10px; text-transform:uppercase; color:#64748b; font-weight:700; letter-spacing:1px; margin-bottom:6px;">Phone</div>
                        <div style="font-weight:700; color:var(--text-primary); font-size:14px;">${escHtml(acc.user_phone || '—')}</div>
                    </div>
                    <div style="background:var(--bg-light,#f8fafc); border-radius:14px; padding:16px; border:1px solid var(--border-color,#e2e8f0);">
                        <div style="font-size:10px; text-transform:uppercase; color:#64748b; font-weight:700; letter-spacing:1px; margin-bottom:6px;">Opened On</div>
                        <div style="font-weight:600; color:var(--text-primary); font-size:13px;">${acc.created_at ? new Date(acc.created_at).toLocaleDateString('en-IN', {year:'numeric', month:'short', day:'numeric'}) : '—'}</div>
                    </div>
                </div>

                <div>
                    <h4 style="margin:0 0 14px; font-size:14px; color:var(--text-primary); font-weight:800; display:flex; align-items:center; gap:8px;">
                        <i class="fas fa-history" style="color:#64748b;"></i> Recent Transactions
                        <span style="font-size:11px; color:var(--text-secondary); font-weight:500; margin-left:auto;">${txns.length} record${txns.length !== 1 ? 's' : ''}</span>
                    </h4>
                    ${txns.length === 0 ? `
                        <div style="padding:30px; text-align:center; color:var(--text-secondary); background:var(--bg-light,#f8fafc); border-radius:14px; border:1px solid var(--border-color,#e2e8f0);">
                            <i class="fas fa-inbox" style="font-size:24px; opacity:0.3; margin-bottom:8px; display:block;"></i>
                            No transactions yet
                        </div>
                    ` : `
                        <div style="border:1px solid var(--border-color,#e2e8f0); border-radius:14px; overflow:hidden;">
                            <table style="width:100%; border-collapse:collapse; font-size:12px;">
                                <thead>
                                    <tr style="background:var(--bg-light,#f8fafc); border-bottom:1px solid var(--border-color,#e2e8f0);">
                                        <th style="padding:10px 14px; text-align:left; font-size:10px; font-weight:700; color:#94a3b8; text-transform:uppercase;">Description</th>
                                        <th style="padding:10px 14px; text-align:left; font-size:10px; font-weight:700; color:#94a3b8; text-transform:uppercase;">Type</th>
                                        <th style="padding:10px 14px; text-align:right; font-size:10px; font-weight:700; color:#94a3b8; text-transform:uppercase;">Amount</th>
                                        <th style="padding:10px 14px; text-align:left; font-size:10px; font-weight:700; color:#94a3b8; text-transform:uppercase;">Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${txns.map(t => {
                                        const isCredit = (t.type||'').toLowerCase().includes('credit') || (t.type||'').toLowerCase().includes('deposit');
                                        return `
                                            <tr style="border-bottom:1px solid #f1f5f9;">
                                                <td style="padding:10px 14px; font-weight:600; color:var(--text-primary); max-width:150px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escHtml(t.description||'')}">${escHtml(t.description||'—')}</td>
                                                <td style="padding:10px 14px;">
                                                    <span style="font-size:10px; padding:3px 8px; border-radius:6px; font-weight:700; background:${isCredit ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}; color:${isCredit ? '#10b981' : '#ef4444'};">
                                                        ${isCredit ? '↓ CR' : '↑ DR'}
                                                    </span>
                                                </td>
                                                <td style="padding:10px 14px; text-align:right; font-weight:800; color:${isCredit ? '#10b981' : '#ef4444'}; font-family:monospace;">
                                                    ${isCredit ? '+' : '-'}₹${Number(t.amount||0).toLocaleString('en-IN')}
                                                </td>
                                                <td style="padding:10px 14px; font-size:11px; color:var(--text-secondary);">
                                                    ${t.transaction_date ? new Date(t.transaction_date).toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'2-digit'}) : '—'}
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    `}
                </div>
                <div style="height:20px;"></div>
            </div>

            <div style="padding:16px 24px; background:var(--bg-light,#f8fafc); border-top:1px solid var(--border-color,#e2e8f0); flex-shrink:0;">
                <button onclick="document.getElementById('agriDetailPanel').style.transform='translateX(100%)'; setTimeout(()=>document.getElementById('agriDetailPanel').remove(),400)" 
                    style="width:100%; padding:12px; background:#1e293b; color:#fff; border:none; border-radius:12px; font-weight:700; cursor:pointer; font-size:14px;">
                    Close Details
                </button>
            </div>
        `;

        document.body.appendChild(panel);
        requestAnimationFrame(() => { panel.style.transform = 'translateX(0)'; });

    } catch (e) {
        console.error('Agri Hub Details Error:', e);
        showToast('Error loading account details: ' + e.message, 'error');
    }
}




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
        if (document.getElementById('agriHubSearchInput')) document.getElementById('agriHubSearchInput').value = '';
        renderAgriHubTable(_allAgriHubCustomers);

    } catch (e) {
        console.error('Agri Hub Load Error:', e);
        el.innerHTML = '<div style="padding:40px; text-align:center; color:#ef4444;"><i class="fas fa-exclamation-circle" style="font-size:24px;"></i><p>Failed to load Agriculture Hub records.</p></div>';
    }
}

function handleAgriHubSearch() {
    const query = (document.getElementById('agriHubSearchInput')?.value || '').toLowerCase();
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

/**
 * AGRICULTURE ACCOUNT APPROVALS (KYC)
 */
async function loadAgriAccountsPage() {
    const el = document.getElementById('agriAccountsList');
    if (!el) return;
    el.innerHTML = '<div style="padding:40px; text-align:center;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
    try {
        const r = await fetch(API + '/staff/account_requests', { credentials: 'include' });
        const d = await r.json();
        const reqs = (d.requests || []).filter(r => (r.account_type || '').toLowerCase().includes('agri'));

        if (!reqs.length) {
            el.innerHTML = '<p style="padding:20px; text-align:center; color:var(--text-secondary);">No pending agriculture accounts found.</p>';
            return;
        }

        el.innerHTML = `
            <div class="premium-table-wrapper">
                <table class="premium-table">
                    <thead><tr><th>ID</th><th>User</th><th>Aadhaar</th><th>PAN</th><th>Date</th><th>Action</th></tr></thead>
                    <tbody>
                        ${reqs.map(r => `
                            <tr>
                                <td>#${r.id}</td>
                                <td><strong>${escHtml(r.user_name)}</strong><br><small>${escHtml(r.user_email)}</small></td>
                                <td><span class="acc-num-display">${escHtml(r.aadhaar_number)}</span></td>
                                <td><span class="status-badge" style="background:#e0f2fe; color:#0369a1;">${escHtml(r.pan_number)}</span></td>
                                <td style="font-size:12px;">${r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN') : '—'}</td>
                                <td>
                                    <button class="action-btn-circle success" onclick="handleAccountRequest(${r.id}, 'approve')" title="Approve Account"><i class="fas fa-check"></i></button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (e) {
        el.innerHTML = '<p style="padding:20px; color:#ef4444;">Failed to load agriculture accounts.</p>';
    }
}

/**
 * SUPPORT DESK (TICKETS)
 */
async function loadSupportTickets() {
    const el = document.getElementById('supportTableBody');
    if (!el) return;
    el.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;"><i class="fas fa-spinner fa-spin"></i> Loading...</td></tr>';
    try {
        const r = await fetch(API + '/chat/staff/tickets', { credentials: 'include' });
        const d = await r.json();
        const tickets = d.tickets || [];

        if (!tickets.length) {
            el.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text-secondary);">No support tickets found.</td></tr>';
            return;
        }

        el.innerHTML = tickets.map(t => `
            <tr>
                <td><strong>#${t.id}</strong></td>
                <td><div style="font-weight:600;">${escHtml(t.user_name)}</div><div style="font-size:11px;color:#6b7280;">${escHtml(t.user_email)}</div></td>
                <td><div style="max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(t.subject)}</div></td>
                <td><span class="status-badge" style="background:${t.priority === 'High' ? '#fee2e2' : '#fef3c7'}; color:${t.priority === 'High' ? '#dc2626' : '#92400e'}">${t.priority}</span></td>
                <td style="font-size:12px;color:#6b7280;">${new Date(t.created_at).toLocaleString('en-IN')}</td>
                <td><span class="status-badge ${t.status === 'Open' ? 'warning' : 'success'}">${t.status}</span></td>
                <td>
                    <div style="display:flex;gap:5px;">
                        <button class="action-btn resolve-btn" onclick="openSupportChat(${t.user_id}, ${t.id}, '${escHtml(t.user_name)}')" title="Chat & Resolve"><i class="fas fa-comments"></i></button>
                        ${t.status === 'Open' ? `<button class="action-btn refund-btn" onclick="closeTicket(${t.id})" title="Close Ticket"><i class="fas fa-check-double"></i></button>` : ''}
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        el.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#ef4444;padding:20px;">Failed to load tickets.</td></tr>';
    }
}

async function showAgriHubMap(userId) {
    if (!userId) return;
    try {
        const customer = _allAgriHubCustomers.find(c => c.id == userId);
        const loan = customer?.loans[0];
        if (!loan || !loan.farm_coordinates) {
            showToast('No land coordinates linked to this account.', 'warning');
            return;
        }
        
        showLandMap(loan.id, loan.lat, loan.lng, loan.land_size_acres || 5, loan.crop_type || 'Agriculture', 
                   customer.name, loan.ai_health_score || 70, loan.geometry, 
                   customer.requests?.[0]?.aadhaar_number || '—', customer.requests?.[0]?.pan_number || '—', customer.email);
    } catch(e) {
        console.error(e);
        showToast('Failed to load land map', 'error');
    }
}

// Add Agriculture Customer Modal Handlers
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
    // We use FormData to handle the passport size photo file upload automatically
    const formData = new FormData(form);

    btn.disabled = true;
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
        btn.innerHTML = '<i class="fas fa-check-circle"></i> Create Agriculture Profile';
    }
};

// ================================================================
// UPI MANAGEMENT
// ================================================================
let _upiUsers = [];

async function loadUpiManagementPage() {
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

    const list = document.getElementById('upiUsersList');
    if (list) list.innerHTML = '<div style="text-align:center;padding:2rem;"><i class="fas fa-spinner fa-spin"></i></div>';
    try {
        const res = await fetch(`${API}/admin/upi/users`, { credentials: 'include' });
        const data = await res.json();
        _upiUsers = data.users || [];
        renderUpiUsers(_upiUsers);
        const filter = document.getElementById('upiTxFilter');
        if (filter) {
            filter.innerHTML = '<option value="">All Users</option>' +
                _upiUsers.map(u => `<option value="${u.id}">${escHtml(u.name)} (${escHtml(u.upi_id)})</option>`).join('');
        }
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
        messageIsHtml: true,
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

/* ════════════════════════════════════════════════════════════
   CROP MARKETPLACE — STAFF/ESCROW MANAGEMENT
   ════════════════════════════════════════════════════════════ */

async function loadStaffEscrow() {
    try {
        const r = await fetch(`${API}/marketplace/escrow/pending`, { credentials: 'include' });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);

        // Update Stats
        const p = d.stats.pending_amount || 0;
        const c = d.stats.total_commission_earned || 0;
        const o = d.stats.completed_orders || 0;
        
        const elPending = document.getElementById('statsEscrowPending');
        const elComm = document.getElementById('statsEscrowCommission');
        const elReleased = document.getElementById('statsEscrowReleased');
        
        if (elPending) elPending.textContent = `₹${p.toLocaleString('en-IN')}`;
        if (elComm) elComm.textContent = `₹${c.toLocaleString('en-IN')}`;
        if (elReleased) elReleased.textContent = o;

        // Update Table
        const tbody = document.querySelector('#staffEscrowTable tbody');
        if (!tbody) return;

        if (!d.orders || !d.orders.length) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--text-secondary)">No pending escrow actions. All clear!</td></tr>';
            return;
        }

        const badge = s => {
            const map = { delivered: '#fef3c7;color:#92400e', inspected: '#dbeafe;color:#1e40af' };
            const labels = { delivered: 'Awaiting Inspection', inspected: 'Ready for Release' };
            return `<span style="background:${map[s]||'#f3f4f6'};padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700">${labels[s]||s}</span>`;
        };

        tbody.innerHTML = d.orders.map(o => {
            const held = parseFloat(o.total_amount);
            const comm = held * 0.02;
            const payout = held - comm;
            
            let actions = '';
            if (o.status === 'inspected') {
                actions = `
                    <button class="btn btn-sm" style="background:#dcfce7;color:#166534;font-size:11px;padding:4px 8px;margin-right:4px" onclick="releaseEscrow(${o.id}, ${payout}, ${comm})"><i class="fas fa-check-double"></i> Release</button>
                    <button class="btn btn-sm" style="background:#fee2e2;color:#991b1b;font-size:11px;padding:4px 8px" onclick="refundEscrow(${o.id}, ${held})"><i class="fas fa-undo"></i> Refund</button>
                `;
            } else if (o.status === 'delivered') {
                actions = `
                    <button class="btn btn-sm" style="background:#fee2e2;color:#991b1b;font-size:11px;padding:4px 8px" onclick="refundEscrow(${o.id}, ${held})"><i class="fas fa-undo"></i> Force Refund</button>
                `;
            }

            return `<tr>
                <td><strong>#${o.id}</strong></td>
                <td>${escHtml(o.buyer_name)}</td>
                <td>${escHtml(o.farmer_name)}</td>
                <td>${badge(o.status)}</td>
                <td><strong>₹${held.toLocaleString('en-IN')}</strong></td>
                <td style="color:#d97706">₹${comm.toLocaleString('en-IN')}</td>
                <td style="color:#16a34a">₹${payout.toLocaleString('en-IN')}</td>
                <td>${actions || '—'}</td>
            </tr>`;
        }).join('');

    } catch (e) {
        const tbody = document.querySelector('#staffEscrowTable tbody');
        if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#ef4444">Error loading escrow data: ${e.message}</td></tr>`;
    }
}

function releaseEscrow(id, payout, comm) {
    showConfirm({
        title: 'Confirm Escrow Release',
        message: `Release payout of <strong>₹${payout.toLocaleString('en-IN')}</strong> to the farmer and deduct <strong>₹${comm.toLocaleString('en-IN')}</strong> as bank commission?`,
        icon: 'fa-check-double',
        confirmText: 'Release Funds',
        messageIsHtml: true,
        onConfirm: async () => {
            try {
                const r = await fetch(`${API}/marketplace/escrow/${id}/release`, { method: 'POST', credentials: 'include' });
                const d = await r.json();
                if (!r.ok) throw new Error(d.error);
                showToast(d.message, 'success');
                loadStaffEscrow();
            } catch (e) { showToast(e.message, 'error'); }
        }
    });
}

function refundEscrow(id, amount) {
    showConfirm({
        title: 'Dispute / Refund Escrow',
        message: `Are you sure you want to refund <strong>₹${amount.toLocaleString('en-IN')}</strong> back to the buyer? The farmer will not receive payment.`,
        icon: 'fa-undo',
        confirmText: 'Process Refund',
        warning: 'This action cannot be undone.',
        messageIsHtml: true,
        onConfirm: async () => {
            try {
                const r = await fetch(`${API}/marketplace/escrow/${id}/refund`, { method: 'POST', credentials: 'include' });
                const d = await r.json();
                if (!r.ok) throw new Error(d.error);
                showToast(d.message, 'success');
                loadStaffEscrow();
            } catch (e) { showToast(e.message, 'error'); }
        }
    });
}

// Hook into showPage to load escrow and locations
const _staffShowPage = typeof showPage === 'function' ? showPage : null;
if (_staffShowPage) {
    const __origShowPage = showPage;
    showPage = function(page) {
        __origShowPage(page);
        if (page === 'marketplace') {
            loadStaffEscrow();
        }
        if (page === 'agribuyers') {
            loadStaffAgriBuyers();
        }
        if (page === 'dashboard') {
            if (typeof loadLocationsTable === 'function') setTimeout(loadLocationsTable, 100);
        }
    };
}

// ==========================================
// RETAIL AGRI BUYERS DASHBOARD (STAFF)
// ==========================================
async function loadStaffAgriBuyers() {
    try {
        const r = await fetch(`${API}/marketplace/staff/agri-buyers`, { credentials: 'include' });
        const d = await r.json();
        if(!r.ok) return showToast(d.error || 'Failed to load buyers', 'error');

        const tbody = document.querySelector('#staffAgriBuyersTable tbody');
        tbody.innerHTML = '';
        if(!d.buyers || d.buyers.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px;color:#6b7280">No retail agri buyers found.</td></tr>`;
            return;
        }

        d.buyers.forEach(b => {
            let statusBadge = '';
            if(b.status === 'active') statusBadge = `<span class="badge" style="background:var(--success)">Active</span>`;
            else if(b.status === 'pending') statusBadge = `<span class="badge" style="background:var(--warning)">Pending</span>`;
            else statusBadge = `<span class="badge" style="background:var(--danger)">${b.status}</span>`;

            let actions = '';
            if(b.status === 'pending') {
                actions = `
                    <button class="action-btn resolve-btn" onclick="approveAgriBuyer(${b.id})" title="Approve Buyer"><i class="fas fa-check"></i></button>
                    <button class="action-btn refund-btn" onclick="suspendAgriBuyer(${b.id})" title="Reject/Suspend"><i class="fas fa-ban"></i></button>
                `;
            } else if (b.status === 'active') {
                actions = `<button class="action-btn refund-btn" onclick="suspendAgriBuyer(${b.id})" title="Suspend"><i class="fas fa-ban"></i></button>`;
            } else {
                actions = `<button class="action-btn resolve-btn" onclick="approveAgriBuyer(${b.id})" title="Re-activate"><i class="fas fa-check"></i></button>`;
            }

            const turnover = parseFloat(b.total_turnover || 0);

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong style="color:var(--text-primary)">${b.buyer_id}</strong></td>
                <td>${b.business_name || '<i style="color:#9ca3af">Not specified</i>'}</td>
                <td>${b.name}</td>
                <td><div style="font-size:12px">${b.email}</div><div style="font-size:12px;color:#6b7280">${b.phone || ''}</div></td>
                <td>${b.gst_number || '-'}</td>
                <td style="font-weight:600;color:var(--success)">₹${turnover.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                <td>${statusBadge}</td>
                <td><div style="display:flex;gap:4px;justify-content:flex-end">${actions}</div></td>
            `;
            tbody.appendChild(tr);
        });
    } catch(err) {
        showToast('Connection error', 'error');
    }
}

async function approveAgriBuyer(bid) {
    if(!confirm('Are you sure you want to approve this retail buyer?')) return;
    try {
        const r = await fetch(`${API}/marketplace/staff/agri-buyers/${bid}/approve`, {
            method: 'PUT', credentials: 'include'
        });
        const d = await r.json();
        if(r.ok) {
            showToast(d.message, 'success');
            loadStaffAgriBuyers();
        } else {
            showToast(d.error, 'error');
        }
    } catch(err) {
        showToast('Connection error', 'error');
    }
}

async function suspendAgriBuyer(bid) {
    if(!confirm('Are you sure you want to suspend/reject this retail buyer?')) return;
    try {
        const r = await fetch(`${API}/marketplace/staff/agri-buyers/${bid}/suspend`, {
            method: 'PUT', credentials: 'include'
        });
        const d = await r.json();
        if(r.ok) {
            showToast(d.message, 'success');
            loadStaffAgriBuyers();
        } else {
            showToast(d.error, 'error');
        }
    } catch(err) {
        showToast('Connection error', 'error');
    }
}

function openCreateRetailBuyerModal() {
    document.getElementById('createRetailBuyerForm').reset();
    document.getElementById('createRetailBuyerModal').classList.add('active');
}

function closeCreateRetailBuyerModal() {
    document.getElementById('createRetailBuyerModal').classList.remove('active');
}

async function handleCreateRetailBuyer(e) {
    e.preventDefault();
    const btn = document.getElementById('addBuyerSubmitBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

    const payload = {
        buyer_id: document.getElementById('addBuyerId').value.trim(),
        password: document.getElementById('addBuyerPassword').value,
        name: document.getElementById('addBuyerName').value.trim(),
        email: document.getElementById('addBuyerEmail').value.trim(),
        phone: document.getElementById('addBuyerPhone').value.trim(),
        gst_number: document.getElementById('addBuyerGst').value.trim(),
        business_name: document.getElementById('addBuyerBusinessName').value.trim()
    };

    try {
        const r = await fetch(`${API}/marketplace/staff/agri-buyers`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const d = await r.json();
        
        if (r.ok) {
            showToast(d.message, 'success');
            closeCreateRetailBuyerModal();
            loadStaffAgriBuyers();
        } else {
            showToast(d.error || 'Failed to create buyer', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Create & Activate Buyer';
    }
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
        const res = await fetch(`${API}/staff/locations/${id}`, {
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

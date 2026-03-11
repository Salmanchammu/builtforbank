window.API = window.SMART_BANK_API_BASE || '/api';

// Shared currency formatter — always renders as ₹1,00,000
function fmtINR(n) {
    return '₹' + parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}


// Premium custom confirm dialog
function showConfirm({ title, message, warning, onConfirm }) {
    const existing = document.getElementById('_confirmModal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = '_confirmModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:99999;';
    modal.innerHTML = `
        <div id="_confirmBox" style="background:#fff;border-radius:20px;padding:32px 28px;max-width:420px;width:90%;box-shadow:0 25px 60px rgba(0,0,0,0.18);text-align:center;">
            <div style="width:56px;height:56px;border-radius:50%;background:#fef2f2;color:#8b0000;display:flex;align-items:center;justify-content:center;margin:0 auto 18px;font-size:24px;">
                <i class="fas fa-exclamation-triangle"></i>
            </div>
            <h3 style="margin:0 0 10px;font-size:20px;font-weight:800;color:#111827;">${title || 'Are you sure?'}</h3>
            <p style="margin:0 0 14px;font-size:14px;color:#4b5563;line-height:1.6;">${message || ''}</p>
            ${warning ? `<p style="background:#fef2f2;color:#991b1b;border-radius:10px;padding:10px 14px;font-size:13px;font-weight:600;margin-bottom:24px;">${warning}</p>` : '<div style="margin-bottom:10px;"></div>'}
            <div style="display:flex;gap:12px;justify-content:center;">
                <button id="_confirmCancel" style="flex:1;padding:12px 24px;border-radius:30px;border:1.5px solid #e5e7eb;background:#fff;font-size:14px;font-weight:600;color:#6b7280;cursor:pointer;">Cancel</button>
                <button id="_confirmOk" style="flex:1;padding:12px 24px;border-radius:30px;border:none;background:#8b0000;font-size:14px;font-weight:700;color:#fff;cursor:pointer;box-shadow:0 4px 12px rgba(139,0,0,0.25);">Confirm</button>
            </div>
        </div>`;
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
    initSecurity();

    // Set up real-time polling (every 30 seconds)
    setInterval(() => {
        // Only refresh if the dashboard tab is active to save resources
        const dashboardPage = document.getElementById('dashboard');
        if (dashboardPage && dashboardPage.classList.contains('active')) {
            loadDashboardData();
        }
    }, 30000);
});

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

// Initialize Dashboard
function initializeDashboard() {
    // Check if staff is logged in
    const staff = JSON.parse(localStorage.getItem('staff'));
    if (!staff) {
        window.location.href = 'user.html';
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
    const avatarUrl = `https://ui-avatars.com/api/?name=${safeName}&background=10b981&color=fff&rounded=true&bold=true`;

    if (staffAvatar) {
        staffAvatar.src = avatarUrl;
    }
    if (topBarAvatar) {
        topBarAvatar.src = avatarUrl;
    }
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
async function loadDashboardData() {
    try {
        // Try to fetch from backend with session credentials
        const response = await fetch(API + '/staff/dashboard', {
            credentials: 'include'  // Include session cookie
        });

        if (response.ok) {
            const data = await response.json();
            console.log('Staff dashboard data loaded:', data);
            updateDashboardStats(data.stats);
            loadRecentCustomers(data.recent_customers || []);
            loadPendingTasks(data.pending_loans || []);
            loadRecentTransactions(data.recent_transactions || []);
            // Also load pending approvals to update the navigation badge
            loadApprovalsPage();
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

function showMutualFundModal() {
    const modal = document.getElementById('mfModal');
    if (modal) modal.style.display = 'flex';
}

function showLifeInsuranceModal() {
    const modal = document.getElementById('insuranceModal');
    if (modal) modal.style.display = 'flex';
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
}

// Load Recent Customers — renders into #recentActivities (the div that exists in the HTML)
function loadRecentCustomers(customers) {
    // Try the newer div in the HTML; fall back gracefully
    const container = document.getElementById('recentActivities') ||
        document.getElementById('recentCustomersList');
    if (!container) return;

    if (!customers || customers.length === 0) {
        container.innerHTML = '<p style="padding: 1rem; text-align: center; color: #9ca3af;">No recent customers</p>';
        return;
    }

    container.innerHTML = customers.map(customer => `
        <div onclick="viewUserActivity(${customer.id},'${(customer.name || '').replace(/'/g, '')}')" style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border-color,#e5e7eb);cursor:pointer;" class="hover-row" title="View User Details">
            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(customer.name || customer.username || 'User')}&background=10b981&color=fff&rounded=true&bold=true"
                style="width:40px;height:40px;border-radius:50%;" alt="${customer.name || 'User'}">
            <div style="flex:1;">
                <div style="font-weight:600;font-size:14px;">${customer.name || customer.username || 'Unknown'}</div>
                <div style="font-size:12px;color:#6b7280;">${customer.email || 'No email'}</div>
            </div>
        </div>
    `).join('');
}

// Load Pending Tasks (Loan Requests) on Dashboard
function loadPendingTasks(loans) {
    const container = document.getElementById('pendingLoans') || document.getElementById('dashboardLoansList');
    if (!container) return;

    if (!loans || loans.length === 0) {
        container.innerHTML = '<p style="padding: 1rem; text-align: center; color: #9ca3af;">No pending loan requests</p>';
        return;
    }

    container.innerHTML = loans.map(loan => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--border-color,#e5e7eb);">
            <div>
                <div style="font-weight:600;font-size:14px;color:var(--text-primary);">${loan.customer || 'Customer'}</div>
                <div style="font-size:12px;color:#6b7280;margin-top:2px;">Requested: ${loan.title || loan.loan_type || 'Loan'}</div>
            </div>
            <button onclick="showPage('loans')"
                style="padding:6px 12px;background:#f59e0b;color:white;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;">
                <i class="fas fa-arrow-right"></i> Review
            </button>
        </div>
    `).join('');
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
                                <td class="acc-num-display" style="font-size:12px;">#${t.id}</td>
                                <td class="clickable-cell" onclick="viewUserActivity(${t.user_id}, '${(t.user_name || '').replace(/'/g, "")}')">
                                    <div style="font-weight:700;">${t.user_name || '—'}</div>
                                </td>
                                <td class="acc-num-display">${t.account_number || '—'}</td>
                                <td>
                                    <span class="status-badge ${t.type === 'credit' ? 'success' : 'danger'}">
                                        ${(t.type || '').toUpperCase()}
                                    </span>
                                </td>
                                <td style="font-weight:800;" class="${t.type === 'credit' ? 'text-success' : 'text-danger'}">
                                    ${t.type === 'credit' ? '+' : '-'}₹${(t.amount || 0).toLocaleString('en-IN')}
                                </td>
                                <td>${new Date(t.transaction_date).toLocaleDateString('en-IN')}</td>
                                <td><span class="status-badge" style="background:#e0f2fe;color:#0369a1;font-size:10px;">${t.mode || 'CASH'}</span></td>
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

        el.innerHTML = `
            <div class="premium-table-wrapper">
                <table class="premium-table">
                    <thead>
                        <tr>
                            ${['Account No.', 'Customer', 'Type', 'Balance', 'Status', 'IFSC', 'Branch', 'Actions'].map(h => `<th>${h}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${accounts.map(a => `
                            <tr>
                                <td class="clickable-cell" onclick="viewAccount(${a.id})">
                                    <div class="acc-num-display">${a.account_number}</div>
                                </td>
                                <td class="clickable-cell" onclick="viewAccount(${a.id})">
                                    <div style="font-weight: 600; color: var(--text-primary);">${a.user_name || '—'}</div>
                                </td>
                                <td class="clickable-cell" onclick="viewAccount(${a.id})">
                                    <span style="font-size: 13px; color: var(--text-secondary); text-transform: capitalize;">${a.account_type}</span>
                                </td>
                                <td class="clickable-cell" onclick="viewAccount(${a.id})" style="font-family: 'Inter', sans-serif; font-weight: 800; color: var(--primary-color);">
                                    ₹${(a.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                </td>
                                <td class="clickable-cell" onclick="viewAccount(${a.id})">
                                    <span class="status-badge ${a.status === 'active' ? 'success' : 'danger'}">${a.status}</span>
                                </td>
                                <td class="clickable-cell" onclick="viewAccount(${a.id})" style="font-size: 12px; color: var(--text-secondary); font-family: monospace;">${a.ifsc || '—'}</td>
                                <td class="clickable-cell" onclick="viewAccount(${a.id})" style="font-size: 12px; color: var(--text-secondary);">${a.branch || '—'}</td>
                                <td>
                                    <div style="display:flex; gap:8px; align-items: center;">
                                        <button onclick="depositMoney(${a.id}, '${a.account_number}')" class="action-btn-circle deposit" title="Deposit Money">
                                            <i class="fas fa-plus"></i>
                                        </button>
                                        <button onclick="withdrawMoney(${a.id}, '${a.account_number}')" class="action-btn-circle withdraw" title="Withdraw Money">
                                            <i class="fas fa-minus"></i>
                                        </button>
                                        <button onclick="deleteAccount(${a.id},'${a.account_number}')" class="action-btn-circle delete" title="Close Account">
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


// Load Pending Tasks
function loadPendingTasks(tasks) {
    const container = document.getElementById('pendingLoans');
    if (!container) return;

    if (!tasks || tasks.length === 0) {
        container.innerHTML = '<p style="padding: 1rem; text-align: center; color: #9ca3af;">No pending tasks</p>';
        return;
    }

    const priorityColors = {
        high: '#ef4444',
        medium: '#f59e0b',
        low: '#10b981'
    };

    container.innerHTML = tasks.map(task => `
        <div class="list-item">
            <div style="width: 40px; height: 40px; background: ${priorityColors[task.priority]}; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600;">
                ${task.priority.charAt(0).toUpperCase()}
            </div>
            <div class="list-item-content">
                <h4>${task.title}</h4>
                <p>${task.customer}</p>
            </div>
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
                        <td style="padding: 12px;"><strong>${txn.id || txn.reference_number || '-'}</strong></td>
                        <td style="padding: 12px;">${txn.customer || txn.user_name || 'Unknown'}</td>
                        <td style="padding: 12px;">${txn.account || txn.account_number || 'Unknown'}</td>
                        <td style="padding: 12px;">
                            <span class="status-badge ${txn.type === 'debit' ? 'success' : 'danger'}">
                                ${(txn.type || '').toUpperCase()}
                            </span>
                        </td>
                        <td style="padding: 12px; font-weight: bold;" class="${txn.type === 'debit' ? 'text-success' : 'text-danger'}">
                            ${txn.type === 'debit' ? '+' : '-'}₹${Number(txn.amount || 0).toLocaleString('en-IN')}
                        </td>
                        <td style="padding: 12px;">${new Date(txn.date || txn.transaction_date).toLocaleString('en-IN')}</td>
                        <td style="padding: 12px;"><span class="status-badge" style="background:#e0f2fe;color:#0369a1;">${txn.mode || 'CASH'}</span></td>
                        <td style="padding: 12px;">
                            <span class="status-badge ${txn.status || 'success'}">
                                ${((txn.status || 'completed').charAt(0).toUpperCase() + (txn.status || 'completed').slice(1))}
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

    switch (pageName) {
        case 'dashboard': loadDashboardData(); break;
        case 'customers': loadCustomersPage(); break;
        case 'accounts': loadStaffAccounts(); break;
        case 'approvals': loadApprovalsPage(); break;
        case 'transactions': loadStaffTransactions(); break;
        case 'loans': loadLoansPage(); break;
        case 'liquidity': loadStaffLiquidityPage(); break;
        case 'cards': loadCardsPage(); break;
        case 'reports': loadReportsPage(); break;
        case 'profile': loadProfilePage(); break;
        case 'settings': loadSettingsPage(); break;
        case 'attendance': loadAttendancePage(); break;
        case 'supportdesk': loadSupportTickets(); break;
        case 'services': loadServicesPage(); break;
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

async function loadStaffLiquidityPage() {
    try {
        const r = await fetch(API + '/system/liquidity-fund', { credentials: 'include' });
        const fundData = await r.json();
        const loansR = await fetch(API + '/staff/loans', { credentials: 'include' });
        const loansData = await loansR.json();
        const loans = loansData.loans || [];

        const fmt = n => n >= 100000 ? `₹${(n / 100000).toFixed(2)}L` : `₹${Number(n).toLocaleString('en-IN')}`;
        const g = id => document.getElementById(id);
        if (g('sLiqFundBalance') && fundData.balance !== undefined) g('sLiqFundBalance').textContent = fmt(parseFloat(fundData.balance));
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
                                <td class="clickable-cell" onclick="viewUserActivity(${l.user_id}, '${(l.user_name || '').replace(/'/g, "")}')">
                                    <div style="font-weight:700;">${l.user_name || '—'}</div>
                                </td>
                                <td>${l.loan_type || '—'}</td>
                                <td style="font-weight:700;">₹${Number(l.loan_amount || 0).toLocaleString('en-IN')}</td>
                                <td style="font-weight:700;color:${l.outstanding_amount > 0 ? '#ef4444' : '#10b981'};">₹${Number(l.outstanding_amount || 0).toLocaleString('en-IN')}</td>
                                <td style="color:${l.penalty_amount > 0 ? '#f59e0b' : 'var(--text-secondary)'};">₹${Number(l.penalty_amount || 0).toLocaleString('en-IN')}</td>
                                <td>
                                    <span class="status-badge ${l.status === 'closed' ? 'success' : l.status === 'approved' ? 'warning' : 'danger'}">
                                        ${l.status === 'closed' ? 'PAID OFF' : l.status.toUpperCase()}
                                    </span>
                                </td>
                                <td style="font-size:12px;color:var(--text-secondary);">${l.next_due_date || '—'}</td>
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
                    <td><span class="status-badge ${row.status === 'present' ? 'success' : 'warning'}">${row.status.toUpperCase()}</span></td>
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
    if (window.faceAuthManager) {
        faceAuthManager.captureFaceForAttendance('clock-in');
    } else {
        showToast('Face authentication manager not loaded', 'error');
    }
};

window.handleClockOut = function () {
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
function loadProfilePage() {
    const el = document.getElementById('profileContent');
    const staff = JSON.parse(localStorage.getItem('staff'));
    if (!el || !staff) return;

    el.innerHTML = `
        <div style="padding: 24px;">
            <div style="display:flex; align-items:center; gap:24px; margin-bottom: 32px;">
                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(staff.name || 'Staff')}&background=10b981&color=fff&rounded=true&bold=true" 
                     style="width: 120px; height: 120px; border-radius: 50%; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <div>
                    <h2 style="margin:0 0 8px; font-size:24px; color:var(--text-primary);">${staff.name || 'Staff Member'}</h2>
                    <p style="margin:0 0 4px; color:var(--text-secondary); font-size:16px;"><strong>Role:</strong> ${staff.role || 'Staff'}</p>
                    <p style="margin:0 0 4px; color:var(--text-secondary); font-size:16px;"><strong>Department:</strong> ${staff.department || 'Operations'}</p>
                    <p style="margin:0; color:var(--text-secondary); font-size:16px;"><strong>Email:</strong> ${staff.email || 'Not Provided'}</p>
                </div>
            </div>
            <div class="card" style="padding: 20px; background: var(--bg-light);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 16px;">
                    <h4 style="margin:0;">Account Information</h4>
                    <button onclick="showChangeEmailForm()" class="btn btn-primary btn-sm" style="padding: 6px 12px; font-size: 13px;"><i class="fas fa-envelope"></i> Change Email</button>
                </div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div>
                        <small style="color:var(--text-secondary); display:block;">Username/ID</small>
                        <strong>${staff.staffId || staff.username || 'N/A'}</strong>
                    </div>
                    <div>
                        <small style="color:var(--text-secondary); display:block;">Email Address</small>
                        <strong id="displayEmail">${staff.email || 'Not Provided'}</strong>
                        <div id="changeEmailForm" style="display:none; margin-top: 8px;">
                            <input type="email" id="newEmailInput" placeholder="New Email Address" value="${staff.email || ''}" class="form-control" style="font-size: 13px; padding: 6px; margin-bottom: 8px;">
                            <button onclick="saveNewEmail()" class="btn btn-primary btn-sm" style="padding: 4px 8px; font-size: 12px;">Save</button>
                            <button onclick="hideChangeEmailForm()" class="btn btn-secondary btn-sm" style="padding: 4px 8px; font-size: 12px; background: #9ca3af; border: none;">Cancel</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
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

// Load Settings Page
function loadSettingsPage() {
    const el = document.getElementById('settingsContent');
    if (!el) return;

    el.innerHTML = `
        <div style="padding: 24px;">
            <p style="color:var(--text-secondary); margin-bottom: 24px;">Manage your account settings and preferences.</p>
            <div style="border-top: 1px solid var(--border-color); padding-top: 24px;">
                <h4 style="margin-bottom: 16px;">Security Settings</h4>
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: var(--bg-light); border-radius: 8px;">
                    <div>
                        <strong>Face Authentication</strong>
                        <p style="margin: 4px 0 0; font-size: 13px; color: var(--text-secondary);">Log in securely using facial recognition.</p>
                    </div>
                    <div id="faceAuthStatusContainer" style="display: flex; align-items: center; gap: 12px;">
                        <span id="faceStatusText" style="padding: 6px 12px; background: #e5e7eb; color: #374151; border-radius: 20px; font-size: 12px; font-weight: bold;">Checking status...</span>
                        <div id="faceActionButtons"></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Check face component status
    if (typeof loadFaceAuthStatus === 'function') {
        setTimeout(loadFaceAuthStatus, 300);
    }
}

// Chart Instances
let accountChartInstance = null;
let loanChartInstance = null;
let transactionChartInstance = null;

// Load Reports Page
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
                    labels: Object.keys(data.account_types),
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
                    labels: Object.keys(data.loan_status),
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
                    labels: data.daily_volume.map(d => d.date),
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
    if (modal) modal.style.display = 'flex';
}

function closeAddCustomerModal() {
    const modal = document.getElementById('addCustomerModal');
    if (modal) modal.style.display = 'none';
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

    const payload = {
        name: document.getElementById('newCustomerName').value.trim(),
        username: document.getElementById('newCustomerUsername').value.trim(),
        email: document.getElementById('newCustomerEmail').value.trim(),
        phone: document.getElementById('newCustomerPhone').value.trim(),
        password: document.getElementById('newCustomerPassword').value,
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
            showToast('Customer "' + payload.name + '" created successfully!', 'success');
            loadCustomersPage(); // Refresh customers list
        } else {
            errDiv.textContent = data.error || 'Failed to create customer.';
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
        address: document.getElementById('editCustomerAddress').value.trim()
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
                <table class="premium-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th style="text-align:center;">Accounts</th>
                            <th>Balance</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${customers.map(c => `
                            <tr onclick="viewUserActivity(${c.id}, '${(c.name || '').replace(/'/g, "\\'")}')" class="clickable-cell" title="View User Details">
                                <td class="acc-num-display">#${c.id}</td>
                                <td>
                                    <div style="font-weight:700;color:var(--text-primary);">${c.name || c.username || '—'}</div>
                                    <div style="font-size:11px;color:var(--text-secondary);">@${c.username || c.id}</div>
                                </td>
                                <td>${c.email || '—'}</td>
                                <td>${c.phone || '—'}</td>
                                <td style="text-align:center;">
                                    <span class="status-badge" style="background:rgba(128,0,0,0.05);color:var(--primary-color);border:1px solid rgba(128,0,0,0.1);">${c.account_count || 0}</span>
                                </td>
                                <td class="acc-num-display" style="font-weight:800;color:var(--primary-color);">
                                    ₹${Number(c.total_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                </td>
                                <td>
                                    <span class="status-badge ${c.status === 'active' ? 'success' : 'danger'}">
                                        ${(c.status || 'active').toUpperCase()}
                                    </span>
                                </td>
                                <td onclick="event.stopPropagation()">
                                    <div style="display:flex;gap:8px;">
                                        <button class="action-btn-circle view" onclick="window.currentEditCustomer = ${JSON.stringify(c).replace(/"/g, '&quot;')}; showEditCustomerModal()" title="Edit Customer">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                        <button class="action-btn-circle delete" onclick="deleteUser(${c.id},'${(c.name || '').replace(/'/g, "\\'")}')" title="Delete User">
                                            <i class="fas fa-trash-alt"></i>
                                        </button>
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

// View User Activity Logic
async function viewUserActivity(userId, userName) {
    const modal = document.getElementById('userActivityModal');
    if (!modal) return;
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);

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
        const logs = data.activity_logs || [];

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
                        <td style="padding:10px 12px;font-weight:600;color:var(--primary-color);">${L.action || '—'}</td>
                        <td style="padding:10px 12px;font-size:11px;">${L.details || '—'}</td>
                        <td style="padding:10px 12px;font-family:monospace;font-size:11px;color:var(--text-secondary);">${L.ip_address || '—'}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </div>` : '<p style="color:var(--text-secondary);margin-bottom:20px;">No UI activity logs found for this user.</p>'}
        `;
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
        const requests = data.requests || [];

        // Update badge
        const badge = document.getElementById('pendingApprovalsBadge');
        if (badge) badge.textContent = requests.filter(req => req.status === 'pending').length;

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
                                <td class="acc-num-display">#${r.id}</td>
                                <td>
                                    <div style="font-weight:700;">${r.user_name || '—'}</div>
                                    <div style="font-size:11px;color:var(--text-secondary);">${r.user_email || '—'}</div>
                                </td>
                                <td><span class="status-badge" style="background:rgba(128,0,0,0.05);color:var(--text-primary);border:1px solid var(--border-color);">${r.account_type.toUpperCase()}${r.original_account_id ? ' (CONV.)' : ''}</span></td>
                                <td>
                                    <div style="font-family:monospace;font-size:12px;">A: ${r.aadhaar_number || '—'}</div>
                                    <div style="font-family:monospace;font-size:12px;color:var(--text-secondary);">P: ${r.pan_number || '—'}</div>
                                </td>
                                <td>
                                    <div style="display:flex;gap:6px;">
                                        ${r.aadhaar_proof ? `
                                            <button class="action-btn-circle view" style="width:28px;height:28px;font-size:12px;" onclick="showKYCDoc('${r.aadhaar_proof}', 'Aadhaar - ${r.user_name}')">
                                                <i class="fas ${r.aadhaar_proof.startsWith('data:application/pdf') ? 'fa-file-pdf' : 'fa-id-card'}"></i>
                                            </button>` : ''}
                                        ${r.pan_proof ? `
                                            <button class="action-btn-circle edit" style="width:28px;height:28px;font-size:12px;background:rgba(245,158,11,0.1);color:#f59e0b;" onclick="showKYCDoc('${r.pan_proof}', 'PAN - ${r.user_name}')">
                                                <i class="fas ${r.pan_proof.startsWith('data:application/pdf') ? 'fa-file-pdf' : 'fa-id-card'}"></i>
                                            </button>` : ''}
                                    </div>
                                </td>
                                <td>
                                    <div style="display:flex;gap:6px;">
                                        ${r.kyc_photo ? `
                                            <div class="kyc-thumb" onclick="enlargeKYCPhoto('${r.kyc_photo}', '${r.user_name}')">
                                                <img src="${r.kyc_photo}" style="width:28px;height:28px;border-radius:4px;object-fit:cover;filter:blur(4px);">
                                            </div>` : ''}
                                        ${r.kyc_video ? `
                                            <button class="action-btn-circle delete" style="width:28px;height:28px;font-size:10px;" onclick="playKYCVideo('${r.kyc_video}', '${r.user_name}')">
                                                <i class="fas fa-play"></i>
                                            </button>` : ''}
                                    </div>
                                </td>
                                <td><span class="status-badge ${r.status === 'approved' ? 'success' : r.status === 'pending' ? 'warning' : 'danger'}">${r.status.toUpperCase()}</span></td>
                                <td style="color:var(--text-secondary);font-size:12px;">${new Date(r.request_date).toLocaleDateString('en-IN')}</td>
                                <td>
                                    <div style="display:flex;gap:6px;justify-content:center;">
                                        ${r.status === 'pending' ? `
                                            <button class="action-btn-circle view" onclick="handleAccountRequest(${r.id}, 'approve')" title="Approve">
                                                <i class="fas fa-check"></i>
                                            </button>
                                            <button class="action-btn-circle delete" onclick="handleAccountRequest(${r.id}, 'reject')" title="Reject">
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


async function handleAccountRequest(reqId, action) {
    showConfirm({
        title: `${action.charAt(0).toUpperCase() + action.slice(1)} Request`,
        message: `Are you sure you want to <strong>${action}</strong> this account request?`,
        icon: action === 'approve' ? 'fa-check-circle' : 'fa-times-circle',
        confirmText: action.charAt(0).toUpperCase() + action.slice(1),
        onConfirm: async () => {
            try {
                const res = await fetch(`${API}/staff/account_requests/${reqId}`, {
                    method: 'PUT',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action })
                });
                const data = await res.json();
                if (res.ok) {
                    showToast(data.message || 'Request updated successfully', 'success');
                    loadApprovalsPage();
                } else {
                    showToast(data.error || 'Failed to update request', 'error');
                }
            } catch (e) {
                showToast('Network error', 'error');
            }
        }
    });
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
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

function showNotifications() {
    showModal('notificationsModal');
    // Mark as read optionally
    const badge = document.getElementById('notificationBadge');
    if (badge) badge.style.display = 'none';
}

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

// Deletion Functions
async function deleteUser(userId, name) {
    showConfirm({
        title: 'Delete User',
        message: `You are about to permanently delete <strong>${name}</strong> and all their associated data.`,
        warning: '⚠ This will delete all accounts, transactions, and cards. THIS CANNOT BE UNDONE.',
        onConfirm: async () => {
            try {
                const res = await fetch(`${API}/admin/user/${userId}`, { method: 'DELETE', credentials: 'include' });
                const data = await res.json();
                if (res.ok) { showToast(data.message || 'User deleted successfully', 'success'); loadCustomersPage(); }
                else { showToast(data.error || 'Failed to delete user', 'error'); }
            } catch (e) { showToast('Network error while deleting user', 'error'); }
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
    const modal = document.getElementById('logoutModal');
    const confirmBtn = document.getElementById('confirmLogoutBtn');

    modal.classList.add('active');

    confirmBtn.onclick = () => {
        localStorage.removeItem('staff');
        localStorage.removeItem('token');
        window.location.href = 'user.html';
    };
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
        statusText.innerHTML = `
            < span class="face-status-badge inactive" >
                <i class="fas fa-times-circle"></i> Status Unknown
            </span >
            `;
        actionButtons.innerHTML = '';
        return;
    }

    if (data.enabled) {
        statusText.innerHTML = `
            < span class="face-status-badge active" >
                <i class="fas fa-check-circle"></i> Active
            </span >
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





// Initialize on page load
function initStaffDashboard() {
    try {
        console.log('Staff Dashboard Initializing...');
        initializeDashboard();
        initTheme();
        setupEventListeners();
        
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
    showToast('Prepare deposit for Account: ' + (accNum || accId), 'info');
};

window.withdrawMoney = function (accId, accNum) {
    const elId = document.getElementById('withdrawAccountId');
    if (elId) elId.value = accNum || accId;
    showPage('transactions');
    showToast('Prepare withdrawal for Account: ' + (accNum || accId), 'info');
};

window.viewAccount = async function (id) {
    try {
        const r = await fetch(`${API}/staff/accounts/${id}/details`, { credentials: 'include' });
        if (!r.ok) throw new Error('Failed to fetch details');
        const data = await r.json();
        const acc = data.account;
        const txns = data.transactions || [];

        // Populate Header/Status
        document.getElementById('viewAccNumberDisplay').textContent = acc.account_number;
        const statusEl = document.getElementById('viewAccStatusDisplay');
        const statusColor = acc.status === 'active' ? '#4ade80' : '#ef4444';
        statusEl.innerHTML = `<span style="width: 8px; height: 8px; border-radius: 50%; background: ${statusColor};"></span> ${acc.status.charAt(0).toUpperCase() + acc.status.slice(1)} Account`;

        // Populate Info Cards
        document.getElementById('viewAccType').textContent = acc.account_type;
        document.getElementById('viewAccBalance').textContent = `₹${(acc.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
        document.getElementById('viewAccCustomer').textContent = acc.user_name || 'N/A';
        document.getElementById('viewAccPhone').textContent = acc.user_phone || 'N/A';
        document.getElementById('viewAccIfsc').textContent = acc.ifsc || '—';
        document.getElementById('viewAccBranch').textContent = acc.branch || '—';

        // Populate Transactions
        const txnList = document.getElementById('viewAccTransactionsList');
        if (txns.length === 0) {
            txnList.innerHTML = '<tr><td colspan="5" style="padding:30px; text-align:center; color:#94a3b8; font-style:italic;">No transactions recorded for this account.</td></tr>';
        } else {
            txnList.innerHTML = txns.map(t => `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding:14px 20px; font-size:12px; color:#64748b; font-family:monospace; font-weight:700;">#${t.id}</td>
                    <td style="padding:14px 20px; font-size:13px; color:#1e293b; font-weight:500;">${t.description || 'General Transaction'}</td>
                    <td style="padding:14px 20px;">
                        <span style="background:${t.type === 'credit' ? '#dcfce7' : '#fee2e2'}; color:${t.type === 'credit' ? '#166534' : '#991b1b'}; padding:4px 10px; border-radius:8px; font-size:11px; font-weight:700; text-transform:uppercase;">${t.type}</span>
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
    const query = prompt("Enter Customer Name, Phone, or Username to search:");
    if (!query) return;

    try {
        const r = await fetch(`${API}/staff/lookup?type=user&q=${encodeURIComponent(query)}`, { credentials: 'include' });
        const d = await r.json();
        if (d.success && d.data && d.data.length > 0) {
            const results = d.data.map(u => `ID: ${u.id} | Name: ${u.name} | Phone: ${u.phone}`).join('\n');
            const choice = prompt(`Results found:\n\n${results}\n\nEnter the ID of the customer you want to select:`);
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
                <h3 style="margin:0; color:#1f2937; font-size: 14px;">${title}</h3>
                <button onclick="this.closest('.kyc-doc-modal').remove()" style="background:#ef4444; color:white; border:none; border-radius:50%; width:22px; height:22px; cursor:pointer; font-size:14px; display:flex; align-items:center; justify-content:center;">&times;</button>
            </div>
            <div style="flex:1; overflow:auto; text-align:center; min-height:120px; background:#f9fafb; border-radius:8px;">
                ${isPDF ?
            `<iframe src="${data}" style="width:100%; height:380px; border:none;"></iframe>` :
            `<img src="${data}" style="max-width:100%; max-height:45vh; border-radius:4px; display: block; margin: 0 auto;">`
        }
            </div>
            <div style="margin-top:10px; display:flex; gap:6px;">
                <a href="${data}" download="${title.replace(/\s+/g, '_')}${isPDF ? '.pdf' : '.png'}" style="flex:1; text-align:center; padding:8px; background:#800000; color:white; border-radius:8px; text-decoration:none; font-weight:600; font-size:12px;">
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
                ? `<button class="action-btn-circle view" onclick="resolveTicket(${t.id})" title="Resolve"><i class="fas fa-check"></i></button>`
                : `<span style="font-size:12px;color:var(--text-secondary);">Resolved</span>`;

            const priorityColors = {
                'low': '#10b981',
                'normal': '#6b7280',
                'urgent': '#ef4444'
            };
            const pColor = priorityColors[t.priority] || priorityColors.normal;

            return `
                <tr>
                    <td class="acc-num-display">#${t.id}</td>
                    <td>
                        <div style="font-weight:700;">${t.user_name}</div>
                        <div style="font-size:11px;color:var(--text-secondary);">${t.user_email}</div>
                    </td>
                    <td>
                        <div style="font-weight:600;">${t.subject}</div>
                        <div style="font-size:11px;color:var(--text-secondary);max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${t.message}">${t.message}</div>
                    </td>
                    <td><span class="status-badge" style="background:${pColor}10;color:${pColor};border:1px solid ${pColor}20;">${t.priority.toUpperCase()}</span></td>
                    <td style="font-size:12px;color:var(--text-secondary);">${new Date(t.created_at).toLocaleString('en-IN')}</td>
                    <td><span class="status-badge ${statusClass}">${t.status.toUpperCase()}</span></td>
                    <td>
                       <div style="display:flex;justify-content:center;">
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
        message: `Mark ticket <strong>#${id}</strong> as resolved?`,
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


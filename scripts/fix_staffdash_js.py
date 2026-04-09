import re

with open(r'c:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank_v2\frontend\js\staffdash.js', 'r', encoding='utf-8') as f:
    js = f.read()

append_code = """

// ---- INJECTED BY FIX SCRIPT ----

async function loadCardsPage() {
    const el = document.getElementById('cardsTable');
    if (!el) return;
    el.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:16px;">Loading cards...</td></tr>';
    try {
        const r = await fetch(API + '/staff/service-applications', { credentials: 'include' });
        if (!r.ok) throw new Error();
        const data = await r.json();
        const apps = (data.applications || []).filter(a => a.service_type === 'Card');

        if (!apps.length) {
            el.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:16px;">No pending card requests found.</td></tr>';
            return;
        }

        el.innerHTML = apps.map(a => `
            <tr>
                <td>#${escapeHtml(a.id)}</td>
                <td>
                    <div style="font-weight:700;">${escapeHtml(a.user_name || '—')}</div>
                    <div style="font-size:11px;color:var(--text-secondary);">${escapeHtml(a.user_email || '—')}</div>
                </td>
                <td><span class="status-badge" style="background:rgba(59,130,246,0.1);color:#3b82f6;">${escapeHtml((a.product_name || '').toUpperCase())}</span></td>
                <td>${escapeHtml(a.account_number || '—')}</td>
                <td style="font-weight:700;">₹${Number(a.amount || 0).toLocaleString('en-IN')}</td>
                <td><span class="status-badge ${a.status === 'approved' ? 'success' : a.status === 'pending' ? 'warning' : 'danger'}">${escapeHtml((a.status || 'pending').toUpperCase())}</span></td>
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
                        ` : ''}
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        console.error('Error loading card requests:', e);
        el.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:16px;color:#ef4444;">Failed to load card requests.</td></tr>';
    }
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return String(unsafe)
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

async function loadAgriHubPage() {
    const el = document.getElementById('agriHubList');
    if (!el) return;
    el.innerHTML = '<p style="text-align:center;padding:2rem;"><i class="fas fa-exclamation-triangle" style="color:#f59e0b;font-size:32px;margin-bottom:10px;"></i><br>Agri Hub is managed by Admin.</p>';
}

async function loadAgriAccountsPage() {
    const el = document.getElementById('agriApprovalsList');
    if (!el) return;
    el.innerHTML = '<p style="text-align:center;padding:2rem;"><i class="fas fa-exclamation-triangle" style="color:#f59e0b;font-size:32px;margin-bottom:10px;"></i><br>Agri Accounts are managed by Admin.</p>';
}

async function loadAgriLoansPage() {
    const el = document.getElementById('agriLoansList');
    if (!el) return;
    el.innerHTML = '<p style="text-align:center;padding:2rem;"><i class="fas fa-exclamation-triangle" style="color:#f59e0b;font-size:32px;margin-bottom:10px;"></i><br>Agri Loans are managed by Admin.</p>';
}

"""

if 'async function loadCardsPage()' not in js:
    with open(r'c:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank_v2\frontend\js\staffdash.js', 'a', encoding='utf-8') as f:
        f.write(append_code)
    print("Injected missing functions to staffdash.js")
else:
    print("Already injected")


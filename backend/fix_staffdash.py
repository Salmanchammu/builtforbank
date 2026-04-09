import os

file_path = "C:/Users/salma/Downloads/smart-bank-v2-FIXED/smartbank_v2/frontend/js/staffdash.js"

with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

# truncate at line 4776 (index 4775 is "            const payout = held - comm;\n")
# Wait, let's find the exact line indices.
truncate_index = 0
for i, line in enumerate(lines):
    if "const payout = held - comm;" in line:
        truncate_index = i
        break

lines = lines[:truncate_index + 1]

append_str = """            
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

// Hook into showPage to load escrow
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
"""

with open(file_path, "w", encoding="utf-8") as f:
    f.writelines(lines)
    f.write(append_str)

print("staffdash.js successfully fixed.")

// ═══════════════════════════════════════════════════════════════════════════
// SmartBank — Agri Buyer Dashboard Logic
// ═══════════════════════════════════════════════════════════════════════════
const API = window.API || '';
let allListings = [];
let kycData = {
    facePhoto: null,
    kycVideo: null,
    descriptor: null
};

// ─── Custom UI Notifications & Popups ─────────────────────────────────────────
if (!document.getElementById('agriModalStyles')) {
    const style = document.createElement('style');
    style.id = 'agriModalStyles';
    style.textContent = `
        @keyframes slideDownAgri { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    `;
    document.head.appendChild(style);
}

function showAgriAlert(message, isError = false) {
    const id = 'agriAlert_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const overlay = document.createElement('div');
    overlay.id = id;
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;';
    const modal = document.createElement('div');
    modal.style.cssText = `background:white;padding:30px;border-radius:15px;width:90%;max-width:400px;text-align:center;box-shadow:0 20px 25px -5px rgba(0,0,0,0.1);border-top:5px solid ${isError ? '#ef4444' : '#166534'};animation: slideDownAgri 0.3s ease-out;`;
    const icon = isError 
        ? '<div style="background:#fef2f2;color:#ef4444;width:60px;height:60px;line-height:60px;border-radius:50%;margin:0 auto 20px auto;font-size:24px"><i class="fas fa-exclamation-circle"></i></div>' 
        : '<div style="background:#f0fdf4;color:#166534;width:60px;height:60px;line-height:60px;border-radius:50%;margin:0 auto 20px auto;font-size:24px"><i class="fas fa-check-circle"></i></div>';
    modal.innerHTML = `
        ${icon}
        <h3 style="margin:0 0 10px 0;color:#1e293b;font-size:20px;font-weight:700;">${isError ? 'Notice' : 'Success'}</h3>
        <p style="color:#475569;margin:0 0 25px 0;font-size:15px;line-height:1.5;white-space:pre-wrap;">${message}</p>
        <button style="background:${isError ? '#ef4444' : '#166534'};color:white;border:none;padding:12px 25px;border-radius:8px;font-weight:600;cursor:pointer;width:100%;font-size:15px;transition:all 0.2s;" onclick="document.getElementById('${id}').remove()" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">Continue</button>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

function showAgriConfirm(message, onConfirmCallback) {
    const id = 'agriConfirm_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const overlay = document.createElement('div');
    overlay.id = id;
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;';
    const modal = document.createElement('div');
    modal.style.cssText = 'background:white;padding:30px;border-radius:15px;width:90%;max-width:400px;text-align:center;box-shadow:0 20px 25px -5px rgba(0,0,0,0.1);border-top:5px solid #f59e0b;animation: slideDownAgri 0.3s ease-out;';
    modal.innerHTML = `
        <div style="background:#fffbeb;color:#f59e0b;width:60px;height:60px;line-height:60px;border-radius:50%;margin:0 auto 20px auto;font-size:24px"><i class="fas fa-question-circle"></i></div>
        <h3 style="margin:0 0 10px 0;color:#1e293b;font-size:20px;font-weight:700;">Confirmation Required</h3>
        <p style="color:#475569;margin:0 0 25px 0;font-size:15px;line-height:1.5;">${message}</p>
        <div style="display:flex;gap:12px;">
            <button style="flex:1;background:#f1f5f9;color:#475569;border:none;padding:12px;border-radius:8px;font-weight:600;cursor:pointer;font-size:15px;transition:all 0.2s;" onclick="document.getElementById('${id}').remove()" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">Cancel</button>
            <button id="${id}_btn" style="flex:1;background:#166534;color:white;border:none;padding:12px;border-radius:8px;font-weight:600;cursor:pointer;font-size:15px;transition:all 0.2s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">Confirm</button>
        </div>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    document.getElementById(`${id}_btn`).onclick = () => { overlay.remove(); onConfirmCallback(); };
}

function showAgriPrompt(title, message, placeholder, type, onConfirmCallback) {
    const id = 'agriPrompt_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const overlay = document.createElement('div');
    overlay.id = id;
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;';
    const modal = document.createElement('div');
    modal.style.cssText = 'background:white;padding:30px;border-radius:15px;width:90%;max-width:400px;text-align:center;box-shadow:0 20px 25px -5px rgba(0,0,0,0.1);border-top:5px solid #166534;animation: slideDownAgri 0.3s ease-out;';
    modal.innerHTML = `
        <h3 style="margin:0 0 10px 0;color:#1e293b;font-size:20px;font-weight:700;">${title}</h3>
        <p style="color:#475569;margin:0 0 20px 0;font-size:15px;line-height:1.5;white-space:pre-wrap;">${message}</p>
        <input type="${type}" id="${id}_input" placeholder="${placeholder}" style="width:100%;padding:14px;border:1px solid #cbd5e1;border-radius:8px;margin-bottom:25px;font-size:15px;box-sizing:border-box;outline:none;transition:border-color 0.2s;" onfocus="this.style.borderColor='#166534'" onblur="this.style.borderColor='#cbd5e1'">
        <div style="display:flex;gap:12px;">
            <button style="flex:1;background:#f1f5f9;color:#475569;border:none;padding:12px;border-radius:8px;font-weight:600;cursor:pointer;font-size:15px;transition:all 0.2s;" onclick="document.getElementById('${id}').remove()" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">Cancel</button>
            <button id="${id}_btn" style="flex:1;background:#166534;color:white;border:none;padding:12px;border-radius:8px;font-weight:600;cursor:pointer;font-size:15px;transition:all 0.2s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">Submit</button>
        </div>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    const inp = document.getElementById(`${id}_input`);
    inp.focus();
    document.getElementById(`${id}_btn`).onclick = () => { overlay.remove(); onConfirmCallback(inp.value); };
}

// ─── Init ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const buyer = JSON.parse(localStorage.getItem('agriBuyer') || 'null');
    if (!buyer) { window.location.href = 'agri-buyer-login.html'; return; }

    // Set user info
    document.getElementById('sidebarName').textContent = buyer.name;
    document.getElementById('sidebarAvatar').textContent = buyer.name.charAt(0).toUpperCase();
    document.getElementById('welcomeName').textContent = buyer.name;
    const mu = document.getElementById('mobileUserName');
    if (mu) mu.textContent = buyer.name;

    // Mobile nav
    if (window.innerWidth <= 768) {
        document.getElementById('mobileNav').style.display = 'flex';
    }
    window.addEventListener('resize', () => {
        document.getElementById('mobileNav').style.display = window.innerWidth <= 768 ? 'flex' : 'none';
    });

    loadDashboard();
    loadListings();
});

// ─── Navigation ───────────────────────────────────────────────────────────
function showSection(name) {
    document.querySelectorAll('.page-content').forEach(s => {
        s.style.display = 'none';
        s.classList.remove('active');
    });
    
    const target = document.getElementById('sec-' + name);
    if (target) {
        target.style.display = 'block';
        target.classList.add('active');
    }
    
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    const idx = ['dashboard','browse','mandi','orders','wallet','payments'].indexOf(name);
    if (idx !== -1) {
        document.querySelectorAll('.nav-item')[idx]?.classList.add('active');
        document.querySelectorAll('.m-nav-item').forEach((n,i) => n.classList.toggle('active', i === idx));
    }

    if (name === 'dashboard') loadDashboard();
    if (name === 'browse') loadListings();
    if (name === 'mandi') loadMandiPrices();
    if (name === 'orders') loadOrders();
    if (name === 'wallet') loadWallet();
    if (name === 'payments') loadPayments();
}

// ─── Dashboard ────────────────────────────────────────────────────────────
async function loadDashboard() {
    try {
        const r = await fetch(API + '/marketplace/buyer/dashboard', { credentials: 'include' });
        const d = await r.json();
        if (d.success) {
            document.getElementById('statListings').textContent = d.stats.available_listings;
            document.getElementById('statOrders').textContent = d.stats.total_orders;
            document.getElementById('statActive').textContent = d.stats.active_orders;
            document.getElementById('statSpent').textContent = '₹' + Number(d.stats.total_spent).toLocaleString('en-IN');
            
            // Update wallet if present
            if (d.wallet) {
                const wbal = document.getElementById('walletBalance');
                if (wbal) wbal.textContent = '₹' + Number(d.wallet.balance).toLocaleString('en-IN');
                const wacc = document.getElementById('walletAccNum');
                if (wacc) wacc.textContent = d.wallet.account_number;
            }
        }
    } catch (e) { console.error('Dashboard load error:', e); }

    // Load recent orders
    try {
        const r = await fetch(API + '/marketplace/buyer/orders', { credentials: 'include' });
        const d = await r.json();
        if (d.success) renderRecentOrders(d.orders.slice(0, 5));
    } catch (e) { console.error(e); }
}

function renderRecentOrders(orders) {
    const tbody = document.querySelector('#recentOrdersTable tbody');
    if (!orders.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:32px">No orders yet. <a href="#" onclick="showSection(\'browse\')" style="color:var(--green);font-weight:700">Browse crops</a></td></tr>';
        return;
    }
    tbody.innerHTML = orders.map(o => `<tr>
        <td><strong>#${o.id}</strong></td>
        <td>${o.crop_name || 'N/A'}</td>
        <td>${o.quantity_kg} kg</td>
        <td>₹${Number(o.total_amount).toLocaleString('en-IN')}</td>
        <td>${statusBadge(o.status)}</td>
        <td>${new Date(o.created_at).toLocaleDateString('en-IN')}</td>
    </tr>`).join('');
}

// ─── Browse Listings ──────────────────────────────────────────────────────
async function loadListings() {
    const grid = document.getElementById('listingsGrid');
    grid.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><h4>Loading listings...</h4></div>';
    try {
        const r = await fetch(API + '/marketplace/browse', { credentials: 'include' });
        const d = await r.json();
        if (d.success) { allListings = d.listings; renderListings(d.listings); }
    } catch (e) { grid.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h4>Failed to load</h4></div>'; }
}

function renderListings(listings) {
    const grid = document.getElementById('listingsGrid');
    if (!listings.length) {
        grid.innerHTML = '<div class="empty-state"><i class="fas fa-seedling"></i><h4>No crops available</h4><p>Check back later for new listings</p></div>';
        return;
    }
    const icons = {Grains:'🌾',Vegetables:'🥬',Fruits:'🍎',Pulses:'🫘',Spices:'🌶️',Oilseeds:'🌻',General:'🌱'};
    grid.innerHTML = listings.map(l => `<div class="listing-card">
        <div class="listing-img">${icons[l.category] || '🌱'}</div>
        <div class="listing-body">
            <h4>${l.crop_name}</h4>
            <div class="meta"><i class="fas fa-user"></i> ${l.farmer_name || 'Farmer'} · <i class="fas fa-map-marker-alt"></i> ${l.location || 'N/A'}</div>
            <div class="price">₹${Number(l.price_per_kg).toLocaleString('en-IN')} <small>/kg</small></div>
            <div class="stock">Stock: ${l.quantity_kg} kg · Min: ${l.min_order_kg} kg${l.harvest_date ? ' · Harvested: ' + l.harvest_date : ''}</div>
        </div>
        <div class="listing-actions">
            <button class="btn btn-green btn-sm" onclick="openOrderModal(${l.id})"><i class="fas fa-cart-plus"></i> Order</button>
            <button class="btn btn-outline btn-sm" onclick="viewListing(${l.id})"><i class="fas fa-eye"></i> Details</button>
        </div>
    </div>`).join('');
}

function filterListings() {
    const q = document.getElementById('searchInput').value.toLowerCase();
    const cat = document.getElementById('categoryFilter').value;
    const filtered = allListings.filter(l =>
        (!q || l.crop_name.toLowerCase().includes(q) || (l.location||'').toLowerCase().includes(q)) &&
        (!cat || l.category === cat)
    );
    renderListings(filtered);
}

// ─── Mandi Prices ─────────────────────────────────────────────────────────

async function loadMandiPrices() {
    const el = document.getElementById('mandiPricesContent');
    if (!el) return;
    
    const state = document.getElementById('mandiStateFilter')?.value || 'All';
    const commodity = document.getElementById('mandiCommodityFilter')?.value || 'All';
    
    el.innerHTML = '<div style="text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin fa-2x" style="color:var(--primary-color)"></i><p style="margin-top:12px;color:var(--text-secondary)">Fetching live market rates...</p></div>';
    
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
            el.innerHTML = '<div style="text-align:center;padding:40px;background:var(--bg-card);border-radius:12px;"><i class="fas fa-search" style="font-size:32px;color:var(--text-secondary);margin-bottom:12px;"></i><p>No mandi prices found for current selection.</p></div>';
            return;
        }
        
        el.innerHTML = `<div class="dashboard-grid grid-3" style="gap:20px;">
            ${d.prices.map(p => `
                <div class="card" style="padding:0; overflow:hidden; border:1px solid var(--border-color); transition:transform 0.2s;" onmouseover="this.style.transform='translateY(-4px)'" onmouseout="this.style.transform='translateY(0)'">
                    <div style="background:var(--bg-card); padding:12px 16px; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:12px; font-weight:700; color:var(--primary-color); text-transform:uppercase;">${p.commodity}</span>
                        <span style="font-size:10px; padding:2px 8px; border-radius:10px; background:${p.trend === 'up' ? '#dcfce7' : (p.trend === 'down' ? '#fee2e2' : '#f1f5f9')}; color:${p.trend === 'up' ? '#166534' : (p.trend === 'down' ? '#991b1b' : '#475569')}; font-weight:700;">
                            <i class="fas fa-arrow-${p.trend === 'up' ? 'up' : (p.trend === 'down' ? 'down' : 'minus')}"></i> ${p.trend.toUpperCase()}
                        </span>
                    </div>
                    <div style="padding:16px;">
                        <div style="font-weight:800; font-size:18px; color:var(--text-primary); margin-bottom:4px;">₹${p.modal_price.toLocaleString('en-IN')}</div>
                        <div style="font-size:11px; color:var(--text-secondary); margin-bottom:12px;">Modal Price per Quintal (100kg)</div>
                        
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:16px; background:var(--bg-card); padding:8px; border-radius:8px;">
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
                    <div style="padding:10px; text-align:center; background:var(--maroon-light); color:var(--primary-color); font-size:11px; font-weight:700;">
                        Variety: ${p.variety}
                    </div>
                </div>
            `).join('')}
        </div>`;
    } catch (e) {
        el.innerHTML = `<div style="text-align:center;padding:40px;"><p style="color:#ef4444">Error loading mandi prices: ${e.message}</p></div>`;
    }
}

// ─── Order Modal ──────────────────────────────────────────────────────────
function openOrderModal(listingId) {
    const l = allListings.find(x => x.id === listingId);
    if (!l) return;
    document.getElementById('orderListingId').value = listingId;
    document.getElementById('orderListingInfo').innerHTML = `
        <strong>${l.crop_name}</strong> by ${l.farmer_name || 'Farmer'}<br>
        Price: <strong>₹${l.price_per_kg}/kg</strong> · Stock: ${l.quantity_kg} kg · Min: ${l.min_order_kg} kg`;
    document.getElementById('orderQty').value = '';
    document.getElementById('orderQty').min = l.min_order_kg;
    document.getElementById('orderPrice').value = '';
    document.getElementById('orderPrice').placeholder = `Listed: ₹${l.price_per_kg}/kg`;
    document.getElementById('orderNote').value = '';
    document.getElementById('orderPreview').style.display = 'none';
    
    // Set Payment Source info
    const walletAccNum = document.getElementById('walletAccNum')?.textContent || 'SBXXXXXXXXXXXX';
    const walletBalance = document.getElementById('walletBalance')?.textContent || '₹0.00';
    document.getElementById('orderPayAccNum').textContent = walletAccNum;
    document.getElementById('orderPayBalance').textContent = walletBalance;

    document.getElementById('orderModal').classList.add('active');

    // Live preview
    const updatePreview = () => {
        const qty = parseFloat(document.getElementById('orderQty').value) || 0;
        const ppk = parseFloat(document.getElementById('orderPrice').value) || l.price_per_kg;
        if (qty > 0) {
            const total = qty * ppk;
            const commission = total * 0.02;
            document.getElementById('orderPreview').innerHTML = `<strong>Order Preview:</strong> ${qty} kg × ₹${ppk}/kg = <strong>₹${total.toLocaleString('en-IN')}</strong><br><small>2% bank commission: ₹${commission.toFixed(2)} · Farmer receives: ₹${(total - commission).toFixed(2)}</small>`;
            document.getElementById('orderPreview').style.display = 'block';
        }
    };
    document.getElementById('orderQty').oninput = updatePreview;
    document.getElementById('orderPrice').oninput = updatePreview;
}

function closeModal() { document.getElementById('orderModal').classList.remove('active'); }

async function submitOrder() {
    const lid = document.getElementById('orderListingId').value;
    const qty = document.getElementById('orderQty').value;
    const price = document.getElementById('orderPrice').value;
    const note = document.getElementById('orderNote').value;

    if (!qty || parseFloat(qty) <= 0) { showAgriAlert('Enter a valid quantity', true); return; }

    try {
        const r = await fetch(API + '/marketplace/orders', {
            method: 'POST', credentials: 'include',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ listing_id: parseInt(lid), quantity_kg: parseFloat(qty), negotiated_price: price ? parseFloat(price) : null, note })
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        showAgriAlert(d.message);
        closeModal();
        loadListings();
        loadDashboard();
    } catch (e) { showAgriAlert('Error: ' + e.message, true); }
}

async function viewListing(id) {
    try {
        const r = await fetch(API + '/marketplace/listing/' + id, { credentials: 'include' });
        const d = await r.json();
        if (d.success) {
            const l = d.listing;
            showAgriAlert(`${l.crop_name}\nFarmer: ${l.farmer_name}\nPrice: ₹${l.price_per_kg}/kg\nStock: ${l.quantity_kg} kg\nLocation: ${l.location || 'N/A'}\nDescription: ${l.description || 'No description'}\nHarvest: ${l.harvest_date || 'N/A'}`);
        }
    } catch (e) { showAgriAlert('Failed to load details', true); }
}

// ─── Orders ───────────────────────────────────────────────────────────────
async function loadOrders() {
    try {
        const r = await fetch(API + '/marketplace/buyer/orders', { credentials: 'include' });
        const d = await r.json();
        if (d.success) renderOrders(d.orders);
    } catch (e) { console.error(e); }
}

function renderOrders(orders) {
    const tbody = document.querySelector('#ordersTable tbody');
    if (!orders.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:32px">No orders placed yet</td></tr>';
        return;
    }
    tbody.innerHTML = orders.map(o => {
        let actions = '';
        if (o.status === 'accepted') actions = `<button class="btn btn-green btn-sm" onclick="payOrder(${o.id})"><i class="fas fa-lock"></i> Pay</button>`;
        if (o.status === 'delivered') actions = `<button class="btn btn-green btn-sm" onclick="inspectOrder(${o.id})"><i class="fas fa-check"></i> Inspect</button>`;
        if (o.status === 'pending') actions = `<button class="btn btn-outline btn-sm" onclick="negotiateOrder(${o.id}, ${o.price_per_kg})"><i class="fas fa-handshake"></i> Negotiate</button>`;
        // Chat button for all orders
        actions += `<button class="btn btn-outline btn-sm" style="margin-left:4px" onclick="openBuyerChat(${o.id}, '${(o.farmer_name || 'Farmer').replace(/'/g, "\\'")}'  , '${(o.crop_name || 'Crop').replace(/'/g, "\\'")}' )"><i class="fas fa-comment"></i></button>`;
        return `<tr>
            <td><strong>#${o.id}</strong></td>
            <td>${o.crop_name || 'N/A'}</td>
            <td>${o.farmer_name || 'N/A'}</td>
            <td>${o.quantity_kg} kg</td>
            <td>₹${o.price_per_kg}</td>
            <td>₹${Number(o.total_amount).toLocaleString('en-IN')}</td>
            <td>${statusBadge(o.status)}</td>
            <td>${actions}</td>
        </tr>`;
    }).join('');
}

function payOrder(id) {
    const acc = document.getElementById('walletAccNum')?.textContent || 'your business account';
    showAgriConfirm(`Proceed to pay for Order #${id} using Business Account (${acc})?\n\nFunds will be held in Escrow until delivery.`, async () => {
        try {
            const r = await fetch(API + '/marketplace/orders/' + id + '/pay', { method: 'POST', credentials: 'include', headers: {'Content-Type': 'application/json'} });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error);
            showAgriAlert(d.message);
            loadOrders();
        } catch (e) { showAgriAlert('Error: ' + e.message, true); }
    });
}

function inspectOrder(id) {
    showAgriPrompt('Inspection Notes', 'Enter inspection notes (optional):', 'Inspection passed', 'text', async (notes) => {
        notes = notes || 'Inspection passed';
        try {
            const r = await fetch(API + '/marketplace/orders/' + id + '/confirm-inspection', {
                method: 'PUT', credentials: 'include',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ notes })
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error);
            showAgriAlert(d.message);
            loadOrders();
        } catch (e) { showAgriAlert('Error: ' + e.message, true); }
    });
}

function negotiateOrder(id, currentPrice) {
    showAgriPrompt('Negotiate Price', `Current price: ₹${currentPrice}/kg\nEnter your offer (₹/kg):`, currentPrice.toString(), 'number', async (newPrice) => {
        if (!newPrice || isNaN(newPrice)) return;
        try {
            const r = await fetch(API + '/marketplace/orders/' + id + '/negotiate', {
                method: 'PUT', credentials: 'include',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ price_per_kg: parseFloat(newPrice), note: 'Price negotiation' })
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error);
            showAgriAlert(d.message);
            loadOrders();
        } catch (e) { showAgriAlert('Error: ' + e.message, true); }
    });
}

// ─── Order Chat System ────────────────────────────────────────────────────
let buyerChatPoll = null;

function openBuyerChat(orderId, farmerName, cropName) {
    document.getElementById('chatOrderId').value = orderId;
    document.getElementById('orderChatMetadata').innerHTML = `Chatting with <strong>${farmerName}</strong> about <strong>${cropName}</strong> (Order #${orderId})`;
    document.getElementById('chatInputMessage').value = '';
    document.getElementById('orderChatModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    loadBuyerChat(orderId);
    if (buyerChatPoll) clearInterval(buyerChatPoll);
    buyerChatPoll = setInterval(() => loadBuyerChat(orderId), 5000);
}

function closeOrderChatModal() {
    document.getElementById('orderChatModal').style.display = 'none';
    document.body.style.overflow = 'auto';
    if (buyerChatPoll) clearInterval(buyerChatPoll);
}

async function loadBuyerChat(orderId) {
    const el = document.getElementById('chatMessages');
    if (!el || document.getElementById('chatOrderId').value != orderId) return;
    try {
        const r = await fetch(`${API}/marketplace/orders/${orderId}/chat`, { credentials: 'include' });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        if (!d.chats || d.chats.length === 0) {
            el.innerHTML = '<div style="text-align:center;color:var(--text-secondary);margin:auto;">No messages yet. Start the conversation!</div>';
            return;
        }
        const isAtBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 50;
        let html = '';
        for (const c of d.chats) {
            const isMe = c.sender_type === 'buyer';
            html += `
                <div style="display:flex; flex-direction:column; align-items:${isMe ? 'flex-end' : 'flex-start'};">
                    <div style="font-size:10px; color:var(--text-secondary); margin-bottom:4px; padding:0 4px;">${c.sender_name} \u2022 ${new Date(c.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                    <div style="padding:10px 14px; border-radius:14px; max-width:85%; word-wrap:break-word; font-size:13px; background:${isMe ? 'var(--primary-color)' : '#fff'}; color:${isMe ? '#fff' : 'var(--text-primary)'}; border:${isMe ? 'none' : '1px solid var(--border-color)'};">
                        ${c.message.replace(/</g,'&lt;').replace(/>/g,'&gt;')}
                    </div>
                </div>
            `;
        }
        el.innerHTML = html;
        if (isAtBottom) el.scrollTop = el.scrollHeight;
    } catch (e) { /* silent poll error */ }
}

async function sendOrderMessage() {
    const orderId = document.getElementById('chatOrderId').value;
    const input = document.getElementById('chatInputMessage');
    const msg = input.value.trim();
    if (!msg || !orderId) return;
    
    input.disabled = true;
    try {
        const r = await fetch(`${API}/marketplace/orders/${orderId}/chat`, {
            method: 'POST', credentials: 'include',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ message: msg })
        });
        if (!r.ok) {
            const d = await r.json();
            throw new Error(d.error || 'Failed to send');
        }
        input.value = '';
        await loadBuyerChat(orderId);
        const el = document.getElementById('chatMessages');
        el.scrollTop = el.scrollHeight;
    } catch (e) { showAgriAlert('Error: ' + e.message, true); }
    finally { input.disabled = false; input.focus(); }
}

async function loadWallet() {
    try {
        const r = await fetch(API + '/marketplace/buyer/dashboard', { credentials: 'include' });
        const d = await r.json();
        
        const activeState = document.getElementById('walletActiveState');
        const pendingState = document.getElementById('walletPendingState');
        const createState = document.getElementById('walletCreateState');
        const depositInput = document.getElementById('depositAmount');

        if (d.success && d.wallet) {
            const status = d.wallet.status || 'no_account';
            
            // Hide all first
            if (activeState) activeState.style.display = 'none';
            if (pendingState) pendingState.style.display = 'none';
            if (createState) createState.style.display = 'none';

            if (status === 'active') {
                if (activeState) activeState.style.display = 'block';
                if (depositInput) depositInput.disabled = false;
                document.getElementById('walletAccNum').textContent = d.wallet.account_number;
                document.getElementById('walletBalance').textContent = '₹' + Number(d.wallet.balance).toLocaleString('en-IN');
            } else if (status === 'pending_approval') {
                if (pendingState) pendingState.style.display = 'block';
                if (depositInput) depositInput.disabled = true;
            } else {
                if (createState) createState.style.display = 'block';
                if (depositInput) depositInput.disabled = true;
            }
        }
    } catch (e) { console.error('Wallet load error:', e); }
}

async function startVideoKYC() {
    try {
        if (!window.faceAuthManager) {
            showAgriAlert('Face Authentication Manager not loaded. Please refresh.', true);
            return;
        }

        const btn = document.getElementById('btnStartVideoKYC');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Initializing Camera...';
        btn.disabled = true;

        const result = await faceAuthManager.captureFaceForKYC();
        if (result && result.photo && result.video) {
            kycData.facePhoto = result.photo;
            kycData.kycVideo = result.video;
            kycData.descriptor = result.descriptor;

            document.getElementById('videoKYCStatus').style.display = 'block';
            document.getElementById('badgeStep2').textContent = 'Done';
            document.getElementById('badgeStep2').classList.add('done');
            document.getElementById('step2').classList.add('completed');
            btn.innerHTML = '<i class="fas fa-redo"></i> Recapture Face';
        } else {
            showAgriAlert('Face capture was cancelled or failed.', true);
            btn.innerHTML = originalText;
        }
        btn.style.background = '#166534';
        btn.disabled = false;
    } catch (e) {
        console.error('Video KYC Error:', e);
        showAgriAlert('Error starting Video KYC: ' + e.message, true);
        document.getElementById('btnStartVideoKYC').disabled = false;
        document.getElementById('btnStartVideoKYC').innerHTML = '<i class="fas fa-video"></i> Start Face Capture';
    }
}

async function submitKYC() {
    const aadhaar = document.getElementById('kycAadhaar').value;
    const pan = document.getElementById('kycPAN').value;
    const gst = document.getElementById('kycGST').value;
    const panFile = document.getElementById('kycPanDoc').files[0];
    const gstFile = document.getElementById('kycGstDoc').files[0];

    if (!aadhaar || aadhaar.length !== 12) { showAgriAlert('Enter a valid 12-digit Aadhaar number', true); return; }
    if (!pan || pan.length !== 10) { showAgriAlert('Enter a valid 10-digit PAN number', true); return; }
    if (!gst) { showAgriAlert('Enter your GSTIN / Tax ID', true); return; }
    
    if (!kycData.facePhoto || !kycData.kycVideo) {
        showAgriAlert('Please complete Step 2: Video KYC Verification first.', true);
        return;
    }

    if (!panFile || !gstFile) {
        showAgriAlert('Please upload both PAN and GST document files in Step 3.', true);
        return;
    }

    const btn = document.getElementById('btnSubmitKYC');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading & Submitting...';
    btn.disabled = true;

    try {
        const formData = new FormData();
        formData.append('aadhaar_number', aadhaar);
        formData.append('pan_number', pan);
        formData.append('tax_id', gst);
        formData.append('face_photo', kycData.facePhoto); // base64
        formData.append('kyc_video', kycData.kycVideo);   // base64
        formData.append('pan_doc', panFile);
        formData.append('gst_doc', gstFile);
        if (kycData.descriptor) {
            formData.append('face_descriptor', JSON.stringify(kycData.descriptor));
        }

        const r = await fetch(API + '/marketplace/buyer/wallet/request', { 
            method: 'POST', 
            credentials: 'include',
            body: formData
        });
        const d = await r.json();
        
        if (!r.ok) throw new Error(d.error);
        
        showAgriAlert(d.message);
        document.getElementById('kycModal').classList.remove('active');
        loadWallet();
        
        // Reset kycData
        kycData = { facePhoto: null, kycVideo: null, descriptor: null };
    } catch (e) { 
        showAgriAlert('Error: ' + e.message, true); 
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}



function loadPayments() {
    loadTransactions(); 
}

async function loadTransactions() {
    const tbody = document.querySelector('#transactionsTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px"><i class="fas fa-spinner fa-spin"></i> Loading transactions...</td></tr>';
    
    try {
        const r = await fetch(API + '/marketplace/buyer/transactions', { credentials: 'include' });
        const d = await r.json();
        if (d.success) {
            if (!d.transactions.length) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:32px">No transactions yet.</td></tr>';
                return;
            }
            tbody.innerHTML = d.transactions.map(t => `<tr>
                <td><small>${t.reference_number || 'N/A'}</small></td>
                <td><span class="badge ${t.type==='credit'?'badge-completed':'badge-cancelled'}">${t.type.toUpperCase()}</span></td>
                <td><strong style="color:${t.type==='credit'?'#166534':'#991b1b'}">₹${Number(t.amount).toLocaleString('en-IN')}</strong></td>
                <td>${t.description}</td>
                <td><span class="badge badge-delivered">${t.status}</span></td>
                <td>${new Date(t.transaction_date).toLocaleDateString()}</td>
            </tr>`).join('');
        }
    } catch (e) { 
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#ef4444;padding:20px">Error loading transactions.</td></tr>';
    }
}

// ─── Utilities ────────────────────────────────────────────────────────────
function statusBadge(status) {
    const map = {
        pending: 'badge-pending', accepted: 'badge-accepted', escrow_held: 'badge-escrow',
        delivered: 'badge-delivered', inspected: 'badge-inspected', completed: 'badge-completed',
        cancelled: 'badge-cancelled'
    };
    const labels = {
        pending: 'Pending', accepted: 'Accepted', escrow_held: 'In Escrow',
        delivered: 'Delivered', inspected: 'Inspected', completed: 'Completed', cancelled: 'Cancelled'
    };
    return `<span class="badge ${map[status] || 'badge-pending'}">${labels[status] || status}</span>`;
}

function logout() {
    localStorage.removeItem('agriBuyer');
    sessionStorage.clear();
    fetch(API + '/auth/logout', { method: 'POST', credentials: 'include' }).finally(() => {
        window.location.href = 'agri-buyer-login.html';
    });
}

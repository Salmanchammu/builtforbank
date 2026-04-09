import re

with open(r'c:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank_v2\frontend\staffdash.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Add missing services
services_html = """
            <!-- Services Page -->
            <div class="page-content" id="services">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Manage Services &amp; Applications</h3>
                    </div>
                    <div class="invoice-controls">
                        <div class="search-box" style="display: flex; align-items: center; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; padding: 4px 12px; width: 250px;">
                            <i class="fas fa-search" style="color: var(--text-secondary); margin-right: 8px;"></i>
                            <input id="serviceSearch" placeholder="Search applications..." style="border: none; background: transparent; outline: none; color: var(--text-primary); width: 100%;" type="text" />
                        </div>
                    </div>
                    <div id="pendingApplicationsList">
                        <p style="padding:16px;text-align:center;color:#9ca3af;">No applications found.</p>
                    </div>
                </div>
            </div>
"""
# Add missing Map
map_html = """
            <!-- Live Map Page -->
            <div class="page-content" id="map">
                <div class="map-filters">
                    <button class="map-filter-btn" onclick="loadMapPage()" style="margin-left:auto;"><i class="fas fa-sync-alt"></i> Refresh</button>
                </div>
                <div class="card" style="padding:0;overflow:hidden;">
                    <div id="mapContainer" style="height: 500px; width: 100%;"></div>
                </div>
                <div class="card" style="margin-top:20px;">
                    <div class="card-header">
                        <h3 class="card-title"><i class="fas fa-table" style="margin-right:8px;color:#800000;"></i>User Location Details</h3>
                    </div>
                    <div id="mapUserTable" style="overflow-x:auto;"></div>
                </div>
            </div>
"""

# Add missing Agri Hub, Agri Accounts, Agri Loans
agri_html = """
            <!-- Agri Hub Page -->
            <div id="agrihub" class="page-content">
                <div class="card">
                    <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
                        <h3 class="card-title"><i class="fas fa-tractor" style="color:#10b981;margin-right:8px;"></i>Agri Hub</h3>
                    </div>
                    <div id="agriHubList" style="padding: 16px;">
                        <p style="text-align:center;padding:2rem;color:var(--text-secondary);"><i class="fas fa-spinner fa-spin"></i> Loading Agri Hub data...</p>
                    </div>
                </div>
            </div>

            <!-- Agri Approvals Page -->
            <div id="agriaccounts" class="page-content">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title"><i class="fas fa-check-circle" style="color:#10b981;margin-right:8px;"></i>Agri Account Approvals</h3>
                    </div>
                    <div id="agriApprovalsList" style="padding: 16px;">
                        <p style="text-align:center;padding:2rem;color:var(--text-secondary);"><i class="fas fa-spinner fa-spin"></i> Loading approvals...</p>
                    </div>
                </div>
            </div>

            <!-- Agri Loans Page -->
            <div id="agriloans" class="page-content">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title"><i class="fas fa-leaf" style="color:#10b981;margin-right:8px;"></i>Agri Loans</h3>
                    </div>
                    <div id="agriLoansList" style="padding: 16px;">
                        <p style="text-align:center;padding:2rem;color:var(--text-secondary);"><i class="fas fa-spinner fa-spin"></i> Loading agri loans...</p>
                    </div>
                </div>
            </div>
"""

# Support Desk
supportdesk_html = """
            <!-- Support Desk Page -->
            <div id="supportdesk" class="page-content">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title"><i class="fas fa-headset" style="color:#10b981;margin-right:8px;"></i>Support Desk</h3>
                    </div>
                    <div id="supportTicketsList" style="padding: 16px;">
                        <p style="text-align:center;padding:2rem;color:var(--text-secondary);"><i class="fas fa-spinner fa-spin"></i> Loading support tickets...</p>
                    </div>
                </div>
            </div>
"""

def add_if_missing(html_text, id_attr, snippet):
    if f'id="{id_attr}"' not in html_text and f"id='{id_attr}'" not in html_text:
        return html_text.replace('</main>', snippet + '\n        </main>')
    return html_text

html = add_if_missing(html, 'services', services_html)
html = add_if_missing(html, 'map', map_html)
html = add_if_missing(html, 'agrihub', agri_html)
html = add_if_missing(html, 'supportdesk', supportdesk_html)

with open(r'c:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank_v2\frontend\staffdash.html', 'w', encoding='utf-8') as f:
    f.write(html)
print("Updated staffdash.html successfully.")

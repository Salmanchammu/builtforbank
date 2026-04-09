import codecs

html_path = r'c:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank_v2\frontend\staffdash.html'
try:
    with codecs.open(html_path, 'r', 'utf-16') as f:
        html = f.read()
except:
    try:
        with codecs.open(html_path, 'r', 'utf-8-sig') as f:
            html = f.read()
    except:
        with codecs.open(html_path, 'r', 'latin-1') as f:
            html = f.read()

upi_html = """
            <!-- UPI Management Page -->
            <div id="upi-management" class="page-content">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title"><i class="fas fa-mobile-alt" style="color:#10b981;margin-right:8px;"></i>UPI Management</h3>
                    </div>
                    <div id="upiUsersList" style="padding: 16px;">
                        <p style="text-align:center;padding:2rem;color:var(--text-secondary);"><i class="fas fa-spinner fa-spin"></i> Loading UPI data...</p>
                    </div>
                </div>
            </div>
"""

if 'id="upi-management"' not in html:
    html = html.replace('</main>', upi_html + '\n        </main>')
    with codecs.open(html_path, 'w', 'utf-8') as f:
        f.write(html)
    print("UPI container injected")
else:
    print("Already injected")

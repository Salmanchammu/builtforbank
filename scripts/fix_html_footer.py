import re

html_path = r'c:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank_v2\frontend\staffdash.html'

with open(html_path, 'r', encoding='utf-8', errors='replace') as f:
    text = f.read()

# Find where the privacy mask is, or User Activity Modal, and cut everything after it to reconstruct correctly.
# The proper end of the HTML is:
proper_tail = """
    <div id="privacyMask" class="modal" style="display:none;position:fixed;inset:0;z-index:100000;background:rgba(255,255,255,0.9);backdrop-filter:blur(10px);align-items:center;justify-content:center;flex-direction:column;">
        <i class="fas fa-eye-slash" style="font-size:48px;color:var(--text-secondary);margin-bottom:20px;"></i>
        <h2 style="margin:0;color:var(--text-primary);">Privacy Mode Active</h2>
        <p style="color:var(--text-secondary);margin-top:10px;">Click anywhere to resume.</p>
    </div>

    <!-- Scripts -->
    <script src="js/api-config.js"></script>
    <script src="js/device-detector.js"></script>
    <script src="js/face-api.min.js"></script>
    <script src="js/face-auth-fixed.js"></script>
    <script defer src="js/language-switcher.js"></script>
    <script src="js/premium-ui.js"></script>
    <script src="js/staffdash.js"></script>
</body>
</html>
"""

idx = text.rfind('<div id="privacyMask"')
if idx != -1:
    new_text = text[:idx] + proper_tail
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(new_text)
    print("Fixed bad footer!")
else:
    print("privacyMask not found!")


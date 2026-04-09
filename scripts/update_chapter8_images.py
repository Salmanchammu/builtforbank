import os
import re

base_dir = r"c:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank_v2"
report_md_path = os.path.join(base_dir, "docs", "SmartBank_Project_Report.md")

with open(report_md_path, 'r', encoding='utf-8') as f:
    content = f.read()

start_idx = content.find("## 8.1 Screenshots")

if start_idx != -1:
    content_before = content[:start_idx]
    
    real_screenshots_content = """## 8.1 Screenshots

The User Interface of Smart Bank was strictly designed with a "Premium White" glassmorphic aesthetic to ensure maximum trust and accessibility. Below are the key screens capturing the core platform workflows directly from the active project workspace.

### 8.1.1 Mobile Interface (PWA)
**Figure 8.1: Mobile Dashboard & Balance Masking**  
*(Captures the responsive bottom-navigation design and the "Eye Toggle" hiding the live balance.)*  
![Mobile Dashboard](../mobile_dash_debug.png)

### 8.1.2 Staff & back-Office Operations
**Figure 8.2: Staff Dashboard Main View**  
*(Displays the comprehensive middle-office queue where staff review overall bank activities and navigate modules.)*  
![Staff Dashboard Main](../staff_dash_screenshots/01_dashboard_main.png)

**Figure 8.3: Staff KYC Approval Queue**  
*(Details the review process for verifying Aadhar/PAN cards and pending customer registrations.)*  
![Staff KYC Approvals](../staff_dash_screenshots/02_tab_3_KYC_Approvals.png)

**Figure 8.4: Staff Customers View**  
*(Lists all active verified banking customers tied to the specific staff regional assignment.)*  
![Staff Customers](../staff_dash_screenshots/02_tab_1_Customers.png)

**Figure 8.5: Vault Transactions**  
*(Manages physical vault deposits, withdrawals, and inter-branch transfers requested manually at the desk.)*  
![Staff Transactions](../staff_dash_screenshots/02_tab_4_Transactions.png)

**Figure 8.6: Staff Attendance & Biometrics**  
*(Shows the dashboard interface logging Face Auth validated clock-in and clock-out mechanisms for staff accountability.)*  
![Staff Attendance](../staff_dash_screenshots/02_tab_5_Attendance.png)

### 8.1.3 Specialized Portals
**Figure 8.7: Agriculture Hub**  
*(A dedicated portal enabling farmers and retail buyers to interact with 7.5% subsidized farming loan markets.)*  
![Agri Hub Portal](../staff_dash_screenshots/02_tab_12_Agri_Hub.png)

**Figure 8.8: Agriculture Loan Processing**  
*(Displays satellite RTC-verified farm land loans awaiting staff disbursement into the farmer's core banking account.)*  
![Agri Loans](../staff_dash_screenshots/02_tab_14_Agri_Loans.png)

**Figure 8.9: Help Desk & Support Settings**  
*(Shows the integrated Support Desk resolving customer-raised priority tickets and routing AI fallback events.)*  
![Support Desk](../staff_dash_screenshots/02_tab_11_Support_Desk.png)

### 8.1.4 Geospatial & Reporting Integrations
**Figure 8.10: Live MapLibre System Integration**  
*(Captures the 3D terrain map rendering geo-located Branch and ATM markers overlaying the active region.)*  
![Live Map Locator](../staff_dash_screenshots/02_tab_16_Live_Map.png)

**Figure 8.11: Dynamic Report Generation**  
*(Highlights the PDF ledger controls exporting active compliance metrics, transactions, and user status reports.)*  
![Reports Panel](../staff_dash_screenshots/02_tab_9_Reports.png)

"""
    with open(report_md_path, 'w', encoding='utf-8') as f:
        f.write(content_before + real_screenshots_content)
    print("SUCCESS! Inserted 11 real screenshot links.")
else:
    print("Failed to find header.")

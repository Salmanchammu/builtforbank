import os

base_dir = r"c:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank_v2"
report_md_path = os.path.join(base_dir, "docs", "SmartBank_Project_Report.md")

chapter9_content = """

---

# 9. USER MANUAL
# CHAPTER - 9

## 9.1 Introduction
The Smart Bank User Manual provides stakeholders, customers, and bank administrators with a streamlined guide on how to safely interact with the Progressive Web App (PWA) and the core platform. The platform is designed using intuitive "Premium White glassmorphism" to ensure a zero-learning-curve experience. This section outlines the exact environment required to run both the frontend graphical interfaces and the powerful backend engines that handle banking logic, biometric recognition, and 3D geospatial data processing.

## 9.2 Hardware Requirements
To ensure smooth execution of the Smart Bank platform—particularly the 3D MapLibre models and the intensive 128-d Face Authentication biometric engine—the following minimum hardware specifications are necessitated:

**Server/Backend Hosting Requirements:**
*   **Processor:** Dual-Core CPU (Intel i3 / AMD Ryzen 3 or equivalent) 
*   **Memory (RAM):** Minimum 4 GB (8 GB recommended for concurrent database execution and AI parsing)
*   **Storage:** 20 GB SSD (To handle high-speed SQLite/PostgreSQL ledgers and stored face descriptor vectors)
*   **Network:** High-speed broadband connection for unlatched API gateway traversal

**Client/User Device Requirements:**
*   **Biometrics:** A functional front-facing Webcam (720p or higher) or mobile front camera for `face-api.js` liveness detection.
*   **Display:** Minimum resolution of 1024x768 (Desktop) or modern smartphone resolution.
*   **Graphics:** WebGL-compatible integrated graphics card (mandatory for rendering 3D branch locators smoothly).

## 9.3 Software Requirement
The smart banking system operates securely on modern modular frameworks and necessitates the following software configurations:

**Server-Side Environment:**
*   **Operating System:** Windows 10/11, Ubuntu 20.04 LTS, or macOS (Cross-platform compatibility)
*   **Core Languages:** Python 3.10+ (Backend logic), JavaScript ES6+ (Frontend interactions)
*   **Database Engine:** SQLite3 (Local environment) or PostgreSQL (Production deployment)
*   **Web Framework:** Python Flask (Routing), Werkzeug (Password/Session Security Hashing)
*   **Document Generation:** ReportLab (for backend PDF Statement synthesis)

**Client-Side Environment:**
*   **Operating System:** Any modern mobile OS (Android / iOS) or Desktop OS
*   **Web Browser:** Google Chrome (v100+), Mozilla Firefox (v110+), or Apple Safari (v15+) with strict JavaScript execution enabled.
*   **Browser Permissions:** Hardware flags must be set to "Allow" for Camera access during Face Authentication login flows.
"""

with open(report_md_path, 'a', encoding='utf-8') as f:
    f.write(chapter9_content)
    
print("Successfully appended Chapter 9 User Manual.")

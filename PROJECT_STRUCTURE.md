# Project Structure Overview (Viva Guide)

This document provides a clear explanation of the project's organization to help you describe the architecture during your viva.

## High-Level Directory Structure

```text
smartbank_v2/
├── backend/            # Python Flask Backend (The "Brain")
│   ├── blueprints/    # Modular route handlers (API endpoints)
│   ├── core/          # Shared logic, DB utilities, and security rules
│   └── app.py         # Main entry point and configuration
├── frontend/           # HTML/JS/CSS Frontend (The "Face")
│   ├── css/           # Styling and design system
│   ├── js/            # Client-side interactivity and API calling
│   └── *.html         # Dashboard and Authentication pages
├── database/           # Persistent Storage
│   └── smartbank.db   # SQLite Database (All user & transaction data)
├── scripts/            # Automation & Tools
│   ├── seed_agri.py   # Populates the DB with initial data
│   └── verify_sec.py  # Security validation tools
├── docs/               # Documentation
│   ├── RUN_GUIDE.md   # Setup instructions
│   └── DEPLOY.md      # Deployment walkthrough
└── requirements.txt    # Project dependencies (Python packages)
```

## Key Components to Mention

1.  **Modularity**: The backend uses **Flask Blueprints** to separate concerns (e.g., `auth`, `user`, `staff`, `admin`).
2.  **Security Layer**: Centralized security checks are in `core/auth.py` (Rule-Based Access Control).
3.  **Data Integrity**: Used **SQLite with WAL mode** enabled in `core/db.py` for efficient concurrent access.
4.  **Static Separation**: The frontend is loosely coupled with the backend, communicating primarily through a **JSON REST API**.

---
**Tip for Viva**: Explain that this structure follows professional standards (Separation of Concerns) to ensure the code is maintainable and scalable.

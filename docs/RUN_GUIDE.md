# Smart Bank - Run Guide

Follow these instructions to set up and run the Smart Bank application on your local machine.

## Prerequisites
- Python 3.8 or higher installed.
- `pip` (Python package installer).

## 1. Backend Setup
The backend is built with Flask and serves as the API and static file server.

1. Navigate to the `backend` directory:
   ```powershell
   cd backend
   ```
1. Install the required Python dependencies (from the project root):
   ```powershell
   pip install -r requirements.txt
   ```
3. (Optional) Run the automated setup script to check dependencies and initialize the database:
   ```powershell
   python scripts/setup.py
   ```
4. Start the Flask server:
   ```powershell
   python app.py
   ```
   The backend will start running, typically on `http://localhost:5000`.

## 2. Accessing the Application
The backend is configured to serve the frontend static files automatically.

- Open your browser and go to: `http://localhost:5000`
- If you need to access specific dashboards directly:
    - **User Dashboard**: `http://localhost:5000/user.html`
    - **Staff Dashboard**: `http://localhost:5000/staff.html`
    - **Admin Dashboard**: `http://localhost:5000/admindash.html`

## 3. Test Credentials
Use these accounts to test the system:

| Role | Username / ID | Password |
| :--- | :--- | :--- |
| **User** | `rajesh` | `user123` |
| **Staff** | `S001` | `staff123` |
| **Admin** | `admin` | `admin123` |

## Troubleshooting
- **Database Error**: If you see database-related errors, ensure `storage/database/smart_bank.db` exists. You can re-initialize it by running `python storage/database/migrations/init_database.py`.
- **Port Conflict**: If port 5000 is occupied, you can change the port in `backend/app.py` at the bottom of the file.

# Smart Bank - Deployment Guide

> [!IMPORTANT]
> **🚀 Render.com Deployment (Recommended)**
> We have simplified deployment using a Blueprint.
> 1. **Auto-Configuration**: Render will automatically detect the `render.yaml` file.
> 2. **Manual Settings** (if not using blueprint):
>    - **Build Command**: `pip install -r requirements.txt`
>    - **Start Command**: `gunicorn render_app:app`
>    - **Disk**: Mount a persistent disk at `/opt/render/project/src/storage` to persist SQLite data (matches `render.yaml`).

---

This guide provides high-level steps for deploying the Smart Bank application to a production environment.

## 1. Backend & Frontend Deployment
Since the Flask backend serves the frontend static files, they are deployed together as a single unit.

### Recommended Hosting Options:
- **VPS (DigitalOcean, AWS EC2, Linode)**:
    1. Clone the repository.
    2. Set up a Python virtual environment.
    3. Install dependencies: `pip install -r requirements.txt`.
    4. Use a production WSGI server like **Gunicorn**:
       ```bash
       gunicorn --bind 0.0.0.0:8000 backend.app:app
       ```
    5. Use **Nginx** as a reverse proxy to handle SSL and serve the app on port 80/443.
- **PaaS (Render, Railway, Fly.io)**:
    1. Connect your GitHub repository.
    2. Set the build command: `pip install -r requirements.txt`.
    3. Set the start command: `python backend/app.py` (or use Gunicorn).
    4. Ensure the `database` directory is included in the build.

## 2. Database Deployment
The project currently uses **SQLite**, which is a file-based database.

- **Persistence**: If using a PaaS (like Render or Railway), ensure you use "Persistent Disks" or "Volumes" to store the `storage/database/smart_bank.db` file. Otherwise, data will be lost every time the server restarts.
- **Production Grade (Scaling)**: For a high-traffic production app, it is highly recommended to migrate from SQLite to **PostgreSQL** or **MySQL**.
    - You would need to update the `get_db()` function in `backend/app.py` to use a driver like `psycopg2` and a connection string.

## 3. Environment Variables
For security, do NOT hardcode sensitive information. Use environment variables (or a `.env` file) for:
- `SECRET_KEY` (Flask session key)
- `SENDER_EMAIL` & `SENDER_PASSWORD` (Email SMTP credentials)
- Database connection strings (if moving to PostgreSQL)

## 4. Security Checklist
- [ ] Change the default `SECRET_KEY` in `backend/app.py`.
- [ ] Ensure `DEBUG` mode is turned OFF.
- [ ] Use HTTPS (SSL/TLS) for all communications.
- [ ] Set up a firewall to only allow traffic on necessary ports (80, 443).

---

## 💡 The "Instant Public Link" Trick (For Testing)
If you just want to show your website to someone **right now** without a real server:
1. Keep your project running.
2. Open a *new* terminal and run:
   ```bash
   npx localtunnel --port 5000
   ```
3. It will give you a public URL (e.g., `https://short-wolf-88.loca.lt`) that works anywhere in the world as long as your computer is on!
---

## 5. Utility Scripts
Various maintenance and utility scripts (like `check_divs.py`, `check_tables.py`) have been consolidated into the root `/scripts` directory for easier access during development.

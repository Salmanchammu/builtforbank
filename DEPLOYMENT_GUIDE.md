# Smart Bank v2: Professional Deployment Guide

This guide explains how to deploy the Smart Bank application (Frontend, Backend, and Database) to Render.

## Prerequisites
- A **GitHub** account.
- A **Render** account (Render.com).
- Git installed on your local machine.

---

## Step 1: Push Code to GitHub

1. Initialize Git in your project root:
   ```bash
   git init
   ```
2. Create a `.gitignore` if not present:
   ```text
   __pycache__/
   *.db
   *.db-wal
   *.db-shm
   .venv/
   .env
   ```
3. Commit and push:
   ```bash
   git add .
   git commit -m "Final deployment setup"
   # Create a repo on GitHub and follow their "push an existing repository" steps
   git remote add origin https://github.com/YOUR_USERNAME/smartbank_v2.git
   git push -u origin main
   ```

---

## Step 2: Deploy on Render

Render will automatically detect the `render.yaml` file and configure everything.

1. Log in to your **Render Dashboard**.
2. Click **New +** and select **Blueprint**.
3. Connect your GitHub account and select the **smartbank_v2** repository.
4. Click **Apply**.

### What happens now?
- **Web Service**: Render will build the environment using `requirements.txt` and start the app using `gunicorn`.
- **Database Persistence**: A persistent disk will be mounted at `/opt/render/project/src/storage`. Your `smartbank.db` will be stored here, ensuring data is never lost during updates.
- **Frontend**: The backend is configured to serve all frontend files automatically.

---

## Step 3: Important Configurations

Once the service is created, go to the **Environment** tab in Render and add:
- `SECRET_KEY`: (Add a strong random password for security)
- `PYTHON_VERSION`: `3.11.9`

---

## Accessing the App
Your app will be available at a URL like:
`https://smart-bank-v2-xxxx.onrender.com`

## Troubleshooting
- **Database Initialization**: On the first launch, `render_app.py` will automatically create the database and seed it with the default admin account:
  - **Username**: `admin`
  - **Password**: `admin123`
- **Logs**: If the app fails to start, check the **Logs** tab in Render for Python error messages.

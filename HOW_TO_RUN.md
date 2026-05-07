# SmartBank V2 - How to Run

## Step 1: Install Python
- Download Python from: https://www.python.org/downloads/
- During installation, CHECK the box: **"Add Python to PATH"**
- Click Install

## Step 2: Open the project
- Open VS Code
- Go to File → Open Folder → Select the "smartbank by" folder
- Open the Terminal (Ctrl + `)

## Step 3: Install dependencies (one time only)
Type this command and press Enter. Wait for it to finish:
```
pip install -r requirements.txt
```

## Step 4: Start the server
```
python backend\main.py
```

## Step 5: Open the app
Open your browser and go to: http://localhost:5000/

## To Stop the Server
Press `Ctrl + C` in the terminal, or just close the terminal.

## One-Click Method (Alternative)
Instead of typing commands, you can just double-click the `run_smartbank.bat` file. It does Steps 3 and 4 automatically.

## Troubleshooting
- **"python is not recognized"** → Python is not installed or PATH was not checked. Reinstall Python.
- **"No module named flask"** → Run `pip install -r requirements.txt` again and wait for it to finish.
- **Port 5000 busy** → Close other apps using port 5000 and try again.

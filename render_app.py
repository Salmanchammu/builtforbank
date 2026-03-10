# Render Deployment Entry Point
import os
import sys

# Add the backend directory to sys.path so it can find local imports
backend_dir = os.path.join(os.path.dirname(__file__), 'backend')
sys.path.append(backend_dir)

# Now we can import the app from the backend folder
from app import app

if __name__ == "__main__":
    # Render provides the PORT environment variable
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)

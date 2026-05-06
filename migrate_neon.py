import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.append(BASE_DIR)

from backend.core.db import get_db, migrate_db
from flask import Flask

app = Flask(__name__)
with app.app_context():
    print("Running migrate_db...")
    migrate_db()
    print("Migration finished!")

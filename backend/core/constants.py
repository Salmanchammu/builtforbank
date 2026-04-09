import os

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

# On Render, we use a persistent disk mounted at /opt/render/project/src/storage
if os.environ.get('RENDER'):
    STORAGE_DIR = '/opt/render/project/src/storage'
    DATABASE = os.path.join(STORAGE_DIR, 'smartbank.db')
else:
    STORAGE_DIR = os.path.abspath(os.path.join(BASE_DIR, '..', 'database'))
    DATABASE = os.path.abspath(os.path.join(STORAGE_DIR, 'smartbank.db'))

FACE_DATA_DIR = os.path.join(STORAGE_DIR, 'face_data')
UPLOAD_FOLDER = os.path.join(STORAGE_DIR, 'uploads')
PROFILE_PICS_FOLDER = os.path.join(UPLOAD_FOLDER, 'profiles')

ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_IMAGE_EXTENSIONS

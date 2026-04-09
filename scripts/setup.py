#!/usr/bin/env python3
"""
Smart Bank - Automated Dependency Installer & System Check
Run this script first to ensure all requirements are met
"""

import subprocess
import sys
import os
from pathlib import Path

# Color codes
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

def print_header(text):
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}{text:^60}{RESET}")
    print(f"{BLUE}{'='*60}{RESET}\n")

def print_success(text):
    print(f"{GREEN}✓{RESET} {text}")

def print_error(text):
    print(f"{RED}✗{RESET} {text}")

def print_warning(text):
    print(f"{YELLOW}⚠{RESET} {text}")

def print_info(text):
    print(f"{BLUE}ℹ{RESET} {text}")

def check_python_version():
    """Check if Python version is adequate"""
    print_header("Checking Python Version")
    version = sys.version_info
    
    if version.major >= 3 and version.minor >= 8:
        print_success(f"Python {version.major}.{version.minor}.{version.micro} - OK")
        return True
    else:
        print_error(f"Python {version.major}.{version.minor} is too old")
        print_warning("Python 3.8 or higher is required")
        return False

def check_pip():
    """Check if pip is available"""
    print_header("Checking pip")
    try:
        result = subprocess.run([sys.executable, '-m', 'pip', '--version'], 
                              capture_output=True, text=True, check=True)
        print_success(f"pip is available: {result.stdout.strip()}")
        return True
    except subprocess.CalledProcessError:
        print_error("pip is not available")
        print_warning("Install pip: python -m ensurepip --upgrade")
        return False

def install_requirements():
    """Install Python requirements"""
    print_header("Installing Python Dependencies")
    
    requirements_file = Path(__file__).parent.parent / 'requirements.txt'
    
    if not requirements_file.exists():
        print_error(f"requirements.txt not found at {requirements_file}")
        return False
    
    print_info(f"Installing from: {requirements_file}")
    
    try:
        # Try with --break-system-packages flag (for some Linux systems)
        result = subprocess.run(
            [sys.executable, '-m', 'pip', 'install', '-r', str(requirements_file), 
             '--break-system-packages'],
            capture_output=True, text=True
        )
        
        if result.returncode != 0:
            # If failed, try without the flag
            print_warning("Retrying without --break-system-packages flag...")
            result = subprocess.run(
                [sys.executable, '-m', 'pip', 'install', '-r', str(requirements_file)],
                capture_output=True, text=True, check=True
            )
        
        print_success("All dependencies installed successfully")
        print_info(result.stdout)
        return True
    
    except subprocess.CalledProcessError as e:
        print_error("Failed to install dependencies")
        print_warning(f"Error: {e.stderr}")
        print_info("Try manually: pip install -r requirements.txt")
        return False

def check_installed_packages():
    """Verify all required packages are installed"""
    print_header("Verifying Installed Packages")
    
    required_packages = {
        'flask': 'Flask',
        'flask_cors': 'Flask-CORS',
        'werkzeug': 'Werkzeug'
    }
    
    all_installed = True
    for module, name in required_packages.items():
        try:
            __import__(module)
            print_success(f"{name} - Installed")
        except ImportError:
            print_error(f"{name} - NOT INSTALLED")
            all_installed = False
    
    return all_installed

def check_database():
    """Check database setup"""
    print_header("Checking Database")
    
    db_file = Path(__file__).parent.parent / 'database' / 'smartbank.db'
    
    if db_file.exists():
        print_success(f"Database found: {db_file}")
        return True
    else:
        print_warning(f"Database not found: {db_file}")
        print_info("Run: python backend/schema.py (or equivalent)")
        return False

def check_directory_structure():
    """Verify directory structure"""
    print_header("Checking Directory Structure")
    
    base_dir = Path(__file__).parent.parent
    required_dirs = {
        'backend': base_dir / 'backend',
        'frontend': base_dir / 'frontend',
        'database': base_dir / 'database',
        'face_data': base_dir / 'database' / 'face_data'
    }
    
    all_exist = True
    for name, path in required_dirs.items():
        if path.exists():
            print_success(f"{name}/ directory - Found")
        else:
            print_error(f"{name}/ directory - NOT FOUND")
            all_exist = False
    
    return all_exist

def create_face_data_dirs():
    """Create face data directories if missing"""
    print_header("Setting up Face Data Directories")
    
    base_dir = Path(__file__).parent.parent
    face_data_dir = base_dir / 'database' / 'face_data'
    
    dirs_to_create = [
        face_data_dir,
        face_data_dir / 'admin',
        face_data_dir / 'staff'
    ]
    
    for dir_path in dirs_to_create:
        if not dir_path.exists():
            try:
                dir_path.mkdir(parents=True, exist_ok=True)
                print_success(f"Created: {dir_path.relative_to(base_dir)}")
            except Exception as e:
                print_error(f"Failed to create {dir_path}: {e}")
                return False
        else:
            print_info(f"Exists: {dir_path.relative_to(base_dir)}")
    
    return True

def initialize_database():
    """Run database initialization"""
    print_header("Initializing Database")
    
    db_init_script = Path(__file__).parent.parent / 'backend' / 'schema.sql' 
    
    if not db_init_script.exists():
        print_error(f"Database init script not found: {db_init_script}")
        return False
    
    try:
        print_info("Running database initialization...")
        result = subprocess.run(
            [sys.executable, str(db_init_script)],
            capture_output=True, text=True, check=True
        )
        print_success("Database initialized successfully")
        print_info(result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        print_error("Database initialization failed")
        print_warning(f"Error: {e.stderr}")
        return False

def run_backend_test():
    """Run backend diagnostic test"""
    print_header("Running Backend Diagnostic Test")
    
    test_script = Path(__file__).parent / 'test_backend.py'
    
    if not test_script.exists():
        print_warning("Backend test script not found - skipping")
        return True
    
    print_info("Note: Backend must be running for this test")
    response = input("Is backend running? (y/n): ").strip().lower()
    
    if response != 'y':
        print_warning("Skipping backend test - start backend first")
        return True
    
    try:
        result = subprocess.run(
            [sys.executable, str(test_script)],
            capture_output=True, text=True
        )
        print(result.stdout)
        return result.returncode == 0
    except Exception as e:
        print_error(f"Test failed: {e}")
        return False

def print_next_steps():
    """Print instructions for next steps"""
    print_header("Next Steps")
    
    print(f"{GREEN}✓ Setup Complete!{RESET}\n")
    print("To start the application:\n")
    
    print(f"{BLUE}Option 1 - Automated Start (Recommended):{RESET}")
    if sys.platform == 'win32':
        print("  Double-click: START_ALL.bat")
    else:
        print("  Run: ./START_ALL.sh")
    
    print(f"\n{BLUE}Option 2 - Manual Start:{RESET}")
    print("  Terminal 1 - Backend:")
    print("    cd backend")
    print("    python app.py")
    print("\n  Terminal 2 - Frontend:")
    print("    cd frontend")
    print("    python -m http.server 8000")
    
    print(f"\n{BLUE}Access the application:{RESET}")
    print("  Browser: http://localhost:8000/user.html")
    
    print(f"\n{BLUE}Test Credentials:{RESET}")
    print("  User: rajesh / user123")
    print("  Staff: S001 / staff123")
    print("  Admin: admin / admin123")
    
    print(f"\n{YELLOW}Documentation:{RESET}")
    print("  - REALTIME_DATA_FIX.md - Real-time data troubleshooting")
    print("  - ONE_CLICK_STARTUP.md - Startup guide")
    print("  - TROUBLESHOOTING_404.md - Common errors")

def main():
    """Main setup routine"""
    print_header("Smart Bank - Automated Setup & Dependency Check")
    
    # Track overall success
    all_checks_passed = True
    
    # Run checks
    checks = [
        ("Python Version", check_python_version()),
        ("pip", check_pip()),
        ("Directory Structure", check_directory_structure()),
    ]
    
    # Stop if basic checks fail
    if not all(result for _, result in checks):
        print_error("\nBasic checks failed. Please fix the issues above.")
        sys.exit(1)
    
    # Install dependencies
    if not install_requirements():
        print_error("\nFailed to install dependencies")
        sys.exit(1)
    
    # Verify installation
    if not check_installed_packages():
        print_error("\nSome packages are not installed correctly")
        sys.exit(1)
    
    # Setup directories
    create_face_data_dirs()
    
    # Check/initialize database
    if not check_database():
        response = input("\nDatabase not found. Initialize now? (y/n): ").strip().lower()
        if response == 'y':
            if not initialize_database():
                print_error("\nDatabase initialization failed")
                all_checks_passed = False
    
    # Print summary
    if all_checks_passed:
        print_next_steps()
        print(f"\n{GREEN}Setup completed successfully!{RESET}")
        sys.exit(0)
    else:
        print(f"\n{YELLOW}Setup completed with warnings.{RESET}")
        print("Check the messages above for any issues.")
        sys.exit(0)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n\n{YELLOW}Setup interrupted by user{RESET}")
        sys.exit(130)
    except Exception as e:
        print(f"\n{RED}Unexpected error: {e}{RESET}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

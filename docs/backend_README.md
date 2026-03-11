# Smart Bank - Fixed Version

## Quick Start

### 1. Install Backend Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 2. Initialize Database
```bash
cd database
python init_database.py
```
This creates a fresh database with **NO sample data**.

### 3. Start Backend Server
```bash
cd backend
python app.py
```
Backend will run on: http://localhost:5000

### 4. Create Your First Account
Open `frontend/signup.html` in your browser to create your first user account.

Main pages:
- `frontend/signup.html` - Create new user account
- `frontend/user.html` - User login
- `frontend/staff.html` - Staff login

## Features
- ✅ User/Staff/Admin dashboards
- ✅ Account management
- ✅ Money transfers
- ✅ Loan applications (FIXED)
- ✅ Credit/Debit card requests (FIXED)
- ✅ Face authentication
- ✅ AI Chatbot
- ✅ Real-time balance updates
- ✅ Dark mode support

## Starting Fresh

The database is initialized **empty** - no pre-existing users, staff, or admin accounts.

### Creating Accounts:

**Users:**
1. Open `frontend/signup.html`
2. Fill in the registration form
3. Your first account will be created automatically

**Staff/Admin:**
- These must be created through the backend API or admin panel
- After creating an admin account, they can create staff accounts

## Recent Fixes
- ✅ Fixed loan application modal (now visible and working)
- ✅ Fixed credit card request modal (large, easy to use)
- ✅ Fixed bank card display (beautiful gradients)
- ✅ Fixed loan items display (professional design)
- ✅ Added EMI calculator preview
- ✅ Added custom styled sliders
- ✅ Full dark mode support for all components
- ✅ Removed all sample/fake data - fresh start

## Troubleshooting

### Backend won't start
- Make sure Python is installed
- Install dependencies: `pip install -r backend/requirements.txt`
- Check if port 5000 is available

### Frontend not connecting to backend
- Make sure backend is running on http://localhost:5000
- Check browser console for errors

### Modals not showing
- Clear browser cache (Ctrl+Shift+Delete)
- Hard refresh (Ctrl+F5)

## Support
For issues, check the browser console (F12) for error messages.

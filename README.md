# 🎓 GMCP Admission Backend

Secure backend API for Ganga Memorial College of Polytechnic admission form system.

## 🚀 Deploy to Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

### Quick Deploy Steps:

1. **Fork/Clone** this repository
2. **Connect** to Render from GitHub
3. **Set Environment Variables** (see below)
4. **Deploy** - Render will automatically detect Node.js and run `npm start`

## 📋 Environment Variables (Required)

Set these in Render Dashboard → Environment:

```env
# Firebase Configuration (Required)
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"admission-form-2025"...}

# Security (Required)
JWT_SECRET=your-super-secret-jwt-key-here
NODE_ENV=production

# Payment Gateway (Required)
RAZORPAY_KEY_ID=rzp_live_your_key_here
RAZORPAY_KEY_SECRET=your_razorpay_secret_here

# Server Configuration (Optional)
PORT=3000
```

## 🔐 Getting Firebase Service Account

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project → Settings ⚙️ → Service Accounts
3. Click "Generate new private key"
4. Copy the entire JSON content
5. Paste as single line in `FIREBASE_SERVICE_ACCOUNT` environment variable

## ⚡ Features

- 🔒 **Secure Firebase Integration** - Admin SDK on backend only
- 💳 **Payment Processing** - Razorpay integration
- 📁 **File Upload** - Secure document upload with validation
- 👤 **Admin Panel** - Authentication and registration management
- 🛡️ **Security First** - No credentials exposed to frontend
- 📱 **CORS Enabled** - Ready for frontend integration

## 🌐 API Endpoints

### Public Endpoints
- `POST /api/registrations` - Submit registration form
- `POST /api/upload` - Upload documents
- `POST /api/create-order` - Create payment order

### Admin Endpoints (Authentication Required)
- `POST /admin/login` - Admin authentication
- `GET /admin/registrations` - Get all registrations
- `POST /admin/logout` - Admin logout

### Testing
- `POST /api/test-firebase` - Test Firebase connection

## 🧪 Test Your Deployment

After deployment, test these URLs:

```bash
# Health check
curl https://your-app.onrender.com

# Test Firebase connection
curl -X POST https://your-app.onrender.com/api/test-firebase \
  -H "Content-Type: application/json" \
  -d '{"message":"production test"}'
```

## 📱 Frontend Integration

This backend is designed to work with frontend applications. Set your frontend to make API calls to:

```javascript
const API_BASE_URL = 'https://your-app.onrender.com';

// Example registration submission
const response = await fetch(`${API_BASE_URL}/api/registrations`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(formData)
});
```

## 🛠️ Local Development

```bash
# Clone and install
git clone <this-repo>
cd admission-backend
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your actual values

# Start development server
npm run dev
# or
npm start

# Visit http://localhost:3000
```

## 📂 Project Structure

```
admission-backend/
├── server.js              # Main application server
├── package.json           # Dependencies and scripts
├── .env.example          # Environment variables template
├── .gitignore           # Git ignore rules
├── public/              # Frontend assets (served by backend)
│   ├── index.html       # Registration form
│   ├── admin-view.html  # Admin dashboard
│   ├── form.js          # Frontend JavaScript
│   └── firebase-config.js # Secure frontend config
├── FIREBASE_SECURITY_GUIDE.md  # Security documentation
├── PRODUCTION_CHECKLIST.md     # Deployment checklist
└── README.md            # This file
```

## 🔧 Render Configuration

Render will automatically:
- ✅ Detect Node.js environment
- ✅ Run `npm install`
- ✅ Start server with `npm start`
- ✅ Set up HTTPS
- ✅ Provide custom domain options

### Build Command: `npm install`
### Start Command: `npm start`
### Environment: `Node.js`

## 🆘 Troubleshooting

### Common Issues:

1. **Build Fails**: Check if all dependencies are in `package.json`
2. **Firebase Error**: Verify `FIREBASE_SERVICE_ACCOUNT` environment variable
3. **Port Issues**: Render automatically assigns port, uses `process.env.PORT`
4. **CORS Issues**: Backend includes CORS middleware for all origins

### Debug Steps:

1. **Check Render Logs**: Dashboard → Logs tab
2. **Verify Environment Variables**: Dashboard → Environment tab
3. **Test API Endpoints**: Use the test URLs above

## 📞 Support

- 📧 **Email**: admission@gmcpnalanda.com
- 📱 **Phone**: +91-9473000022, 8002864770
- 📍 **Address**: Harnaout, Nalanda

## 📄 License

This project is for educational purposes - Ganga Memorial College of Polytechnic.

---

**✅ Ready for production deployment on Render!** 🚀

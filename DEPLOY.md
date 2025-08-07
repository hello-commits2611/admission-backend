# 🚀 Deployment Guide for Render

## Step-by-Step Render Deployment

### 1. GitHub Setup ✅
- Repository: `admission-backend`
- All necessary files included
- Ready for GitHub push

### 2. Render Deployment Steps

#### A. Connect Repository
1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New" → "Web Service"
3. Connect your GitHub account
4. Select `admission-backend` repository
5. Click "Connect"

#### B. Configure Service
- **Name**: `gmcp-admission-backend`
- **Environment**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Plan**: Choose your plan (Free tier available)

#### C. Environment Variables (CRITICAL!)
In Render Dashboard, add these environment variables:

```env
FIREBASE_SERVICE_ACCOUNT
# Value: {"type":"service_account","project_id":"admission-form-2025",...}
# (Full JSON from Firebase Console → Service Accounts)

JWT_SECRET
# Value: your-super-secret-jwt-key-here-make-it-long-and-secure

NODE_ENV
# Value: production

RAZORPAY_KEY_ID
# Value: rzp_live_your_actual_key (for production)

RAZORPAY_KEY_SECRET
# Value: your_actual_razorpay_secret
```

### 3. Firebase Service Account Setup

To get your Firebase service account:

1. **Go to Firebase Console**: https://console.firebase.google.com/
2. **Select your project**: `admission-form-2025`
3. **Settings** ⚙️ → **Service accounts**
4. **Generate new private key** button
5. **Download JSON file**
6. **Copy entire JSON content** (minify to single line)
7. **Paste in Render** as `FIREBASE_SERVICE_ACCOUNT` variable

### 4. After Deployment

Your app will be available at:
```
https://gmcp-admission-backend.onrender.com
```

Test endpoints:
```bash
# Health check
curl https://gmcp-admission-backend.onrender.com/

# Firebase test
curl -X POST https://gmcp-admission-backend.onrender.com/api/test-firebase \
  -H "Content-Type: application/json" \
  -d '{"message":"production test"}'

# Admin panel
https://gmcp-admission-backend.onrender.com/admin/login
```

## 🔧 Render Features You'll Get

- ✅ **Automatic HTTPS** - SSL certificate included
- ✅ **Custom Domain** - You can add your own domain later
- ✅ **Auto-Deploy** - Deploys automatically on git push
- ✅ **Logs & Monitoring** - Real-time logs and metrics
- ✅ **Zero Downtime** - Automatic health checks

## 🆘 Troubleshooting

### Common Issues:

**Build Fails:**
- Check logs in Render Dashboard → Logs tab
- Verify all dependencies are in package.json

**Firebase Connection Error:**
- Verify `FIREBASE_SERVICE_ACCOUNT` environment variable
- Ensure JSON is valid (use JSON validator)
- Check Firebase project permissions

**App Won't Start:**
- Check `PORT` environment variable (Render sets this automatically)
- Verify `npm start` script in package.json

**404 Errors:**
- Check your API endpoints match the frontend calls
- Verify CORS is enabled (already configured)

### Debug Commands:

```bash
# Check environment variables locally
node -e "require('dotenv').config(); console.log('Vars loaded:', Object.keys(process.env).filter(k => k.includes('FIREBASE')).length > 0)"

# Test Firebase locally
npm start
# Then test: http://localhost:3000/api/test-firebase
```

## 📱 Frontend Integration

Once deployed, update your frontend to use the new backend URL:

```javascript
// Replace localhost with your Render URL
const API_BASE_URL = 'https://gmcp-admission-backend.onrender.com';
```

## 🎯 Next Steps After Deployment

1. **Test all endpoints** using the URLs above
2. **Update frontend** to use production backend URL
3. **Configure custom domain** (optional) in Render Dashboard
4. **Set up monitoring** and alerts
5. **Update Firebase Security Rules** if needed

---

**✅ Your backend is ready for production deployment!** 🚀

# Render.com Deployment Guide

## 🚀 Quick Fix for Build Errors

The deployment has been fixed by:
1. ✅ Removed unused `@vitejs/plugin-basic-ssl` dependency
2. ✅ Added `--legacy-peer-deps` flag to build commands
3. ✅ Created `.npmrc` file for consistent npm behavior

## 📋 Deployment Steps

### 1. Environment Variables Setup

In your Render dashboard, add these environment variables:

#### Required Variables:
```
NODE_ENV=production
PORT=10000
MONGO_URI=your-mongodb-connection-string
JWT_SECRET=your-super-secret-jwt-key
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
ADMIN_TOKEN=your-secure-admin-token
```

#### Optional Variables:
```
VITE_TURN_SERVER_URL=your-turn-server-url (for WebRTC)
VITE_TURN_USERNAME=your-turn-username
VITE_TURN_CREDENTIAL=your-turn-credential
```

### 2. Build Settings

In Render dashboard, configure:

- **Build Command**: 
  ```bash
  npm install --legacy-peer-deps && npm install --legacy-peer-deps --prefix frontend && npm run build --prefix frontend
  ```

- **Start Command**: 
  ```bash
  npm start
  ```

- **Root Directory**: 
  ```
  threads-app
  ```
  (or leave empty if deploying from root)

### 3. Build & Deploy Settings

- **Environment**: `Node`
- **Node Version**: `18.x` or `20.x` (recommended)
- **Auto-Deploy**: `Yes` (deploys on git push)

### 4. MongoDB Setup

#### Option A: MongoDB Atlas (Recommended)
1. Create account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free cluster
3. Get connection string
4. Add to `MONGO_URI` in Render environment variables

#### Option B: Render MongoDB
1. Create MongoDB service in Render
2. Use internal connection string

### 5. Cloudinary Setup

1. Sign up at [Cloudinary](https://cloudinary.com/)
2. Get your credentials from dashboard
3. Add to environment variables in Render

### 6. CORS Configuration

Update `backend/index.js` to include your Render URL:

```javascript
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3005",
  "https://your-app-name.onrender.com", // Add your Render URL
  process.env.FRONTEND_URL,
].filter(Boolean);
```

### 7. Frontend Environment Variables

If you need frontend environment variables, create a `.env.production` file:

```env
VITE_API_URL=https://your-backend.onrender.com
VITE_TURN_SERVER_URL=your-turn-server-url
```

**Note**: Vite requires `VITE_` prefix for environment variables.

## 🔧 Troubleshooting

### Build Fails with Peer Dependency Errors

✅ **Fixed**: The `.npmrc` file and build command now use `--legacy-peer-deps`

### Build Succeeds but App Doesn't Start

- Check that `PORT` environment variable is set
- Verify `MONGO_URI` is correct
- Check Render logs for specific errors

### Frontend Not Loading

- Ensure build completed successfully
- Check that `dist` folder exists in `frontend/`
- Verify static file serving in `backend/index.js`

### WebSocket/Socket.IO Issues

- Ensure Render WebSocket support is enabled
- Check that Socket.IO is configured correctly
- Verify CORS settings include your frontend URL

### Database Connection Issues

- Verify MongoDB connection string format
- Check IP whitelist in MongoDB Atlas (add `0.0.0.0/0` for Render)
- Ensure database user has correct permissions

## 📝 Render Service Configuration

### Backend Service
- **Type**: Web Service
- **Environment**: Node
- **Build Command**: `npm install --legacy-peer-deps && npm install --legacy-peer-deps --prefix frontend && npm run build --prefix frontend`
- **Start Command**: `npm start`
- **Health Check Path**: `/api/health` (if you add one)

### Optional: Separate Frontend Service

If you want to deploy frontend separately:

1. Create a new Static Site service
2. **Build Command**: `cd frontend && npm install --legacy-peer-deps && npm run build`
3. **Publish Directory**: `frontend/dist`
4. Update backend CORS to include frontend URL

## 🎯 Post-Deployment Checklist

- [ ] Environment variables configured
- [ ] MongoDB connection working
- [ ] Cloudinary credentials set
- [ ] CORS includes production URLs
- [ ] Frontend builds successfully
- [ ] Backend starts without errors
- [ ] Socket.IO connections working
- [ ] File uploads working (Cloudinary)
- [ ] WebRTC audio spaces working (if using TURN server)

## 🔗 Useful Links

- [Render Documentation](https://render.com/docs)
- [Render Troubleshooting](https://render.com/docs/troubleshooting-deploys)
- [MongoDB Atlas Setup](https://www.mongodb.com/docs/atlas/getting-started/)
- [Cloudinary Setup](https://cloudinary.com/documentation)

## 💡 Tips

1. **Free Tier Limitations**: 
   - Services spin down after 15 minutes of inactivity
   - First request after spin-down takes ~50 seconds
   - Consider upgrading for production

2. **Build Time**: 
   - First build may take 5-10 minutes
   - Subsequent builds are faster (2-5 minutes)

3. **Logs**: 
   - Check Render logs for detailed error messages
   - Enable "Live tail" to see real-time logs

4. **Environment Variables**: 
   - Never commit `.env` files
   - Use Render's environment variable interface
   - Use different values for production vs development


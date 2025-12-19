# Network Hosting Guide for Threads App

## Overview
This guide explains how to host the Threads app on a local network and configure TURN server for WebRTC Audio Spaces.

## 1. Local Network Hosting

### Backend Configuration

#### Option A: Bind to All Network Interfaces (Recommended for Local Network)

Update `backend/index.js` to listen on all interfaces:

```javascript
// Change from:
server.listen(usePort, async () => {

// To:
server.listen(usePort, '0.0.0.0', async () => {
```

This allows the server to accept connections from any device on your local network.

#### Option B: Bind to Specific IP Address

If you want to bind to a specific network interface:

```javascript
server.listen(usePort, '192.168.1.100', async () => {
  // Replace with your machine's local IP
});
```

### Frontend Configuration

#### Development Mode (Vite)

Update `frontend/vite.config.js`:

```javascript
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Allow access from network
    port: 3005,
    proxy: {
      "/api": {
        target: "http://localhost:4900", // Keep localhost for proxy
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
```

**Note**: In development, the proxy target should remain `localhost` because the proxy runs on the same machine.

#### Find Your Local IP Address

**Windows:**
```cmd
ipconfig
```
Look for `IPv4 Address` under your active network adapter (usually `192.168.x.x` or `10.x.x.x`)

**Mac/Linux:**
```bash
ifconfig
# or
ip addr show
```

### Access from Other Devices

1. **Start Backend:**
   ```bash
   cd threads-app/backend
   npm start
   ```

2. **Start Frontend:**
   ```bash
   cd threads-app/frontend
   npm run dev
   ```

3. **Access from Other Devices:**
   - Open browser on another device (phone, tablet, another computer)
   - Navigate to: `http://YOUR_IP_ADDRESS:3005`
   - Example: `http://192.168.1.100:3005`

### Firewall Configuration

**Windows:**
1. Open Windows Defender Firewall
2. Click "Allow an app or feature through Windows Defender Firewall"
3. Add Node.js or allow ports 3005 and 4900

**Mac:**
```bash
# Allow incoming connections on ports
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /usr/local/bin/node
```

**Linux (UFW):**
```bash
sudo ufw allow 3005
sudo ufw allow 4900
```

## 2. TURN Server Configuration for WebRTC

### Why TURN Server is Needed

- **Same Network**: WebRTC works with STUN only
- **Different Networks**: Requires TURN server for NAT traversal
- **Mobile Data**: Always requires TURN server

### Option 1: Free TURN Server (Twilio)

1. **Sign up for Twilio** (free trial available)
2. **Get TURN credentials** from Twilio Console
3. **Add to `.env` file:**

```env
# Frontend .env file
VITE_TURN_SERVER_URL=turn:global.turn.twilio.com:3478?transport=udp
VITE_TURN_USERNAME=your-twilio-username
VITE_TURN_CREDENTIAL=your-twilio-credential
```

### Option 2: Self-Hosted TURN Server (Coturn)

#### Install Coturn

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install coturn
```

**Mac (Homebrew):**
```bash
brew install coturn
```

#### Configure Coturn

Edit `/etc/turnserver.conf`:

```conf
# Listening port
listening-port=3478

# External IP (your public IP or domain)
external-ip=YOUR_PUBLIC_IP

# Realm
realm=yourdomain.com

# User credentials (username:password)
user=username:password

# No authentication for local network (optional)
no-auth

# Enable logging
verbose
```

#### Start Coturn

```bash
# Ubuntu/Debian
sudo systemctl start coturn
sudo systemctl enable coturn

# Mac
turnserver -c /usr/local/etc/turnserver.conf
```

#### Add to Frontend `.env`:

```env
VITE_TURN_SERVER_URL=turn:YOUR_PUBLIC_IP:3478
VITE_TURN_USERNAME=username
VITE_TURN_CREDENTIAL=password
```

### Option 3: Cloud TURN Services

- **Twilio**: https://www.twilio.com/stun-turn
- **Xirsys**: https://xirsys.com/
- **Metered.ca**: https://www.metered.ca/tools/openrelay/

## 3. Production Network Hosting

### Environment Variables

Create `.env` files:

**Backend `.env`:**
```env
NODE_ENV=production
PORT=4900
FRONTEND_URL=http://YOUR_DOMAIN_OR_IP:3005
MONGODB_URI=your_mongodb_connection_string
CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

**Frontend `.env`:**
```env
VITE_API_URL=http://YOUR_BACKEND_IP:4900
VITE_TURN_SERVER_URL=turn:your-turn-server.com:3478
VITE_TURN_USERNAME=your-username
VITE_TURN_CREDENTIAL=your-credential
```

### Update CORS Configuration

In `backend/index.js` and `backend/socket/socket.js`, add your network IPs:

```javascript
const allowedOrigins = [
  "http://localhost:3005",
  "http://localhost:5173",
  "http://192.168.1.100:3005", // Your local IP
  "http://YOUR_DOMAIN:3005",    // Your domain
  process.env.FRONTEND_URL,
].filter(Boolean);
```

### Build and Deploy

**Build Frontend:**
```bash
cd threads-app/frontend
npm run build
```

**Start Production Server:**
```bash
cd threads-app/backend
NODE_ENV=production npm start
```

## 4. Network Testing Checklist

### Same Network Test
- [ ] Backend accessible from other devices on network
- [ ] Frontend accessible from other devices
- [ ] WebRTC Audio Spaces work between devices on same network
- [ ] Socket.IO connections work

### Cross-Network Test (Requires TURN)
- [ ] Configure TURN server
- [ ] Test WebRTC from mobile data to Wi-Fi
- [ ] Test WebRTC from different Wi-Fi networks
- [ ] Verify ICE connection state shows "connected"

### Firewall Test
- [ ] Ports 3005 and 4900 are open
- [ ] TURN server port (3478) is accessible
- [ ] No firewall blocking WebRTC traffic

## 5. Troubleshooting

### Cannot Access from Network

1. **Check IP Address:**
   ```bash
   # Verify your IP
   ipconfig  # Windows
   ifconfig  # Mac/Linux
   ```

2. **Check Firewall:**
   - Ensure ports are open
   - Check Windows/Mac firewall settings

3. **Check Server Binding:**
   - Verify server listens on `0.0.0.0` not just `localhost`

4. **Check CORS:**
   - Add your network IP to allowed origins
   - Check browser console for CORS errors

### WebRTC Not Working Across Networks

1. **Verify TURN Server:**
   - Check TURN server is running
   - Verify credentials are correct
   - Test TURN server with online tools

2. **Check ICE Connection:**
   - Open browser console
   - Look for `[WebRTC]` logs
   - Check `iceConnectionState` in logs

3. **Test TURN Server:**
   ```bash
   # Test with trickle-ice
   # Visit: https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/
   # Add your TURN server and test
   ```

### Socket.IO Connection Issues

1. **Check Socket.IO Transport:**
   - Verify `websocket` and `polling` are enabled
   - Check network allows WebSocket connections

2. **Check CORS:**
   - Ensure Socket.IO CORS allows your origin
   - Check for CORS errors in console

## 6. Quick Start for Local Network

### Step-by-Step:

1. **Find Your IP:**
   ```bash
   # Windows
   ipconfig
   # Mac/Linux
   ifconfig | grep "inet "
   ```

2. **Update Backend (`backend/index.js`):**
   ```javascript
   server.listen(usePort, '0.0.0.0', async () => {
   ```

3. **Update Frontend (`frontend/vite.config.js`):**
   ```javascript
   server: {
     host: '0.0.0.0',
     port: 3005,
     // ... rest of config
   }
   ```

4. **Update CORS (both `backend/index.js` and `backend/socket/socket.js`):**
   ```javascript
   const allowedOrigins = [
     "http://localhost:3005",
     "http://YOUR_IP:3005",  // Add your IP
     // ... rest
   ];
   ```

5. **Start Servers:**
   ```bash
   # Terminal 1 - Backend
   cd threads-app/backend
   npm start

   # Terminal 2 - Frontend
   cd threads-app/frontend
   npm run dev
   ```

6. **Access from Other Device:**
   - Open browser on phone/tablet
   - Go to: `http://YOUR_IP:3005`

## 7. Security Considerations

### Development (Local Network)
- ✅ Safe to use `0.0.0.0` binding
- ✅ Safe to allow all localhost origins
- ⚠️ Only expose on trusted local network

### Production
- ✅ Use specific IP binding or reverse proxy
- ✅ Restrict CORS to known domains
- ✅ Use HTTPS for production
- ✅ Secure TURN server credentials
- ✅ Use environment variables for secrets

## 8. Recommended Setup

### For Development:
- Backend: `0.0.0.0:4900`
- Frontend: `0.0.0.0:3005`
- CORS: Allow localhost and local network IPs
- TURN: Optional (only needed for cross-network testing)

### For Production:
- Backend: Behind reverse proxy (Nginx)
- Frontend: Served from backend or CDN
- CORS: Restricted to production domain
- TURN: Required (use paid service like Twilio)

## Need Help?

- Check browser console for errors
- Check backend logs for connection issues
- Verify firewall settings
- Test TURN server with online tools
- Review WebRTC debug logs in console


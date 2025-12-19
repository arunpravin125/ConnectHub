# 🎙️ ConnectHub

> **A modern social media platform with real-time audio spaces, stories, and comprehensive social features**

[![React](https://img.shields.io/badge/React-18.3.1-61DAFB?logo=react)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-8.20.3-47A248?logo=mongodb)](https://www.mongodb.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8.0-010101?logo=socket.io)](https://socket.io/)
[![WebRTC](https://img.shields.io/badge/WebRTC-P2P-333333?logo=webrtc)](https://webrtc.org/)

ConnectHub is a full-featured social media platform that combines traditional social networking with innovative real-time audio communication. Built with modern web technologies, it offers a seamless experience for sharing content, connecting with others, and engaging in live audio conversations.

## ✨ Features

### 📱 Core Social Features
- **Posts & Media Sharing**: Create text posts with images and videos
- **Stories**: Instagram-style ephemeral stories with 24-hour expiration
- **Reposts & Quotes**: Share and comment on posts with quote reposts
- **Engagement**: Like, comment, and reply to posts
- **User Profiles**: Customizable profiles with follow/unfollow system
- **Saved Posts**: Save your favorite posts for later (Instagram-style)
- **Feed Algorithm**: Personalized feed with breaking news boost

### 🎙️ Audio Spaces (WebRTC)
- **Live Audio Rooms**: Create and join real-time audio spaces
- **Role Management**: Host, Speaker, and Listener roles
- **WebRTC P2P**: Peer-to-peer audio streaming for low latency
- **Recording**: Record audio spaces for later playback
- **Real-time Sync**: Live participant updates via Socket.IO

### 💬 Real-time Communication
- **1:1 Messaging**: Private chat with real-time message delivery
- **Audio Messages**: Send voice recordings in chat
- **Typing Indicators**: See when someone is typing
- **Message Deletion**: WhatsApp-style delete for me/everyone
- **Media Sharing**: Share images, videos, and documents

### 📰 Breaking News
- **RSS Integration**: Automatic news ingestion from RSS feeds
- **Breaking Badges**: Highlighted breaking news posts
- **Feed Boost**: Breaking news appears at top of feed
- **Auto-expiration**: News posts expire after 60 minutes

### 🔔 Notifications
- **Real-time Alerts**: Instant notifications for likes, comments, follows
- **Socket.IO Integration**: Live notification updates
- **Notification Center**: Centralized notification management

### 🎨 User Experience
- **Dark/Light Mode**: Theme switching support
- **Responsive Design**: Mobile-first responsive layout
- **Real-time Updates**: Live feed updates without refresh
- **Optimistic UI**: Instant feedback for user actions

## 🛠️ Tech Stack

### Frontend
- **React 18.3.1** - UI library
- **Vite** - Build tool and dev server
- **Chakra UI** - Component library
- **Recoil** - State management
- **React Router** - Routing
- **Socket.IO Client** - Real-time communication
- **WebRTC API** - Audio streaming

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM
- **Socket.IO** - WebSocket server
- **JWT** - Authentication
- **Bcrypt** - Password hashing

### Services & Storage
- **Cloudinary** - Media storage and CDN
- **GridFS** - Video file storage (MongoDB)
- **RSS Parser** - News feed parsing
- **Node Cron** - Scheduled tasks

## 📋 Prerequisites

- **Node.js** >= 18.0.0
- **MongoDB** >= 6.0.0
- **npm** or **yarn**
- **Cloudinary Account** (for media storage)

## 🚀 Installation

### 1. Clone the repository

```bash
git clone https://github.com/arunpravin125/ConnectHub.git
cd ConnectHub/threads-app
```

### 2. Install dependencies

```bash
# Install root dependencies
npm install

# Install frontend dependencies
npm install --prefix frontend
```

### 3. Environment Setup

Create a `.env` file in the root directory:

```env
# Server
PORT=4900
NODE_ENV=development

# Database
MONGO_URI=mongodb://localhost:27017/connecthub

# JWT
JWT_SECRET=your-super-secret-jwt-key

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Admin (for breaking news)
ADMIN_TOKEN=your-secure-admin-token

# Frontend (optional)
VITE_TURN_SERVER_URL=your-turn-server-url
VITE_TURN_USERNAME=your-turn-username
VITE_TURN_CREDENTIAL=your-turn-credential
```

### 4. Start the development servers

```bash
# Start backend (runs on http://localhost:4900)
npm run dev

# In a new terminal, start frontend (runs on http://localhost:3005)
cd frontend
npm run dev
```

## 📖 Usage

### Creating an Account
1. Navigate to the signup page
2. Enter your details (name, username, email, password)
3. Upload a profile picture (optional)
4. Start exploring!

### Creating Posts
1. Click the "Create Post" button
2. Add text, images, or videos
3. Share your post with the community

### Audio Spaces
1. Go to the Spaces page
2. Create a new space or join an existing one
3. Start speaking (as host/speaker) or listen (as listener)
4. Record the space for later playback

### Stories
1. Click "Your Story" in the stories row
2. Upload an image or video
3. Add a caption (optional)
4. Your story will be visible for 24 hours

### Chat
1. Navigate to the Chat page
2. Start a conversation with any user
3. Send text, images, videos, or audio messages
4. Use delete options to manage your messages

## 🏗️ Project Structure

```
threads-app/
├── backend/
│   ├── controllers/     # Route controllers
│   ├── Models/         # Mongoose models
│   ├── routes/         # API routes
│   ├── socket/         # Socket.IO handlers
│   ├── services/       # Business logic services
│   ├── middleware/     # Express middleware
│   └── index.js        # Server entry point
├── frontend/
│   ├── src/
│   │   ├── components/ # React components
│   │   ├── Pages/      # Page components
│   │   ├── context/    # React context
│   │   ├── atoms/      # Recoil state atoms
│   │   └── hooks/      # Custom hooks
│   └── vite.config.js  # Vite configuration
└── README.md
```

## 🔧 Configuration

### MongoDB Setup
Ensure MongoDB is running locally or update `MONGO_URI` in `.env` to point to your MongoDB instance.

### Cloudinary Setup
1. Sign up at [Cloudinary](https://cloudinary.com/)
2. Get your cloud name, API key, and API secret
3. Add them to your `.env` file

### WebRTC Configuration
For production, configure TURN servers for better connectivity across networks. See `NETWORK_HOSTING_GUIDE.md` for details.

## 📚 Documentation

- [Breaking News Setup](./BREAKING_NEWS_SETUP.md)
- [Stories Feature Guide](./STORIES_SETUP.md)
- [WebRTC Implementation](./WEBRTC_IMPLEMENTATION.md)
- [Network Hosting Guide](./NETWORK_HOSTING_GUIDE.md)
- [WhatsApp-Style Delete](./WHATSAPP_DELETE_IMPLEMENTATION.md)

## 🧪 Testing

```bash
# Run backend tests (if available)
npm test

# Run frontend tests (if available)
cd frontend
npm test
```

## 🚢 Deployment

### Build for Production

```bash
# Build frontend
npm run build

# Start production server
npm start
```

### Environment Variables for Production
- Set `NODE_ENV=production`
- Use secure JWT secrets
- Configure production MongoDB URI
- Set up proper CORS origins
- Configure TURN servers for WebRTC

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the ISC License.

## 🙏 Acknowledgments

- [Chakra UI](https://chakra-ui.com/) for the component library
- [Socket.IO](https://socket.io/) for real-time communication
- [Cloudinary](https://cloudinary.com/) for media management
- [WebRTC](https://webrtc.org/) for peer-to-peer audio

## 📧 Contact

For questions or support, please open an issue on GitHub.

---

**Made with ❤️ using React, Node.js, and WebRTC**


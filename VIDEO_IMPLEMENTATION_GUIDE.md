# Video Upload Implementation Guide

## Overview
This document outlines the video upload functionality implemented for both **Posts** and **Chat Messages** in the Threads application, along with best practices.

## ✅ Implementation Summary

### Backend Changes

#### 1. **Database Models Updated**
- **Post Model** (`backend/Models/postModel.js`): Added `video` field
- **Message Model** (`backend/Models/messageModel.js`): Added `video` field

#### 2. **Controllers Enhanced**
- **Post Controller** (`backend/controllers/postController.js`):
  - Video upload with Cloudinary optimization
  - Automatic thumbnail generation
  - Video compression (H.264 codec, AAC audio)
  - Proper cleanup on post deletion

- **Message Controller** (`backend/controllers/messageController.js`):
  - Video upload optimized for chat (shorter videos)
  - 60-second duration limit for chat videos
  - Smaller file size limits for chat messages

### Frontend Changes

#### 1. **New Hook Created**
- **usePrevMedia** (`frontend/src/hooks/usePrevMedia.js`):
  - Handles both images and videos
  - File validation (type, size, duration)
  - Processing state management
  - Different limits for posts vs chat

#### 2. **Components Updated**
- **CreatePost**: Video upload and preview
- **MessageInput**: Video upload for chat
- **Post**: Video display with controls
- **Message**: Video display in chat

## 🎯 Best Practices Implemented

### 1. **File Size Limits**
- **Posts**: 
  - Images: 10MB max
  - Videos: 50MB max
- **Chat Messages**:
  - Images: 10MB max
  - Videos: 25MB max (smaller for faster delivery)

### 2. **Video Duration Limits**
- **Posts**: No strict limit (handled by file size)
- **Chat Messages**: 60 seconds maximum

### 3. **Supported Formats**
- **Images**: JPEG, PNG, GIF, WebP
- **Videos**: MP4, WebM, QuickTime (MOV), AVI

### 4. **Cloudinary Optimization**

#### For Posts:
```javascript
{
  resource_type: "video",
  folder: "threads/posts/videos",
  chunk_size: 6000000, // 6MB chunks for reliability
  eager: [
    { width: 300, height: 300, crop: "fill", format: "jpg" } // Thumbnail
  ],
  transformation: [
    { 
      video_codec: "h264",
      audio_codec: "aac",
      format: "mp4",
      quality: "auto:good" // Auto quality for smaller files
    }
  ]
}
```

#### For Chat Messages:
```javascript
{
  resource_type: "video",
  folder: "threads/messages/videos",
  chunk_size: 6000000,
  eager: [
    { width: 200, height: 200, crop: "fill", format: "jpg" } // Smaller thumbnail
  ],
  transformation: [
    { 
      video_codec: "h264",
      audio_codec: "aac",
      format: "mp4",
      quality: "auto:good",
      max_video_duration: 60 // 60 seconds max
    }
  ]
}
```

### 5. **User Experience Features**
- ✅ Video preview before upload
- ✅ Processing indicators
- ✅ File validation with clear error messages
- ✅ Automatic video compression
- ✅ Thumbnail generation for faster loading
- ✅ Responsive video players with controls
- ✅ Proper cleanup on cancellation

### 6. **Security & Validation**
- ✅ File type validation (whitelist approach)
- ✅ File size validation
- ✅ Video duration validation (for chat)
- ✅ Only one media type per post/message (image OR video, not both)
- ✅ Proper error handling and user feedback

### 7. **Performance Optimizations**
- ✅ Chunked uploads (6MB chunks) for reliability
- ✅ Automatic quality adjustment
- ✅ Thumbnail generation for faster previews
- ✅ Lazy loading considerations
- ✅ Proper resource cleanup

## 📋 Usage Examples

### Creating a Post with Video
1. Click the "+" button to create a post
2. Enter text (optional)
3. Click the image icon to select a video file
4. Preview the video
5. Click "Post" to upload

### Sending Video in Chat
1. Open a conversation
2. Click the image icon in the message input
3. Select a video file (max 60 seconds, 25MB)
4. Preview the video
5. Click send

## 🔧 Configuration

### Environment Variables
Ensure your `.env` file has:
```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### Cloudinary Settings
1. Enable **Video Upload** in Cloudinary dashboard
2. Configure upload presets if needed
3. Set up transformation presets for consistency

## 🚀 Future Enhancements

### Recommended Improvements:
1. **Progress Indicators**: Show upload progress for large videos
2. **Video Editing**: Basic trimming/editing before upload
3. **Video Thumbnails**: Custom thumbnail selection
4. **Streaming**: For very large videos, consider streaming
5. **CDN**: Ensure Cloudinary CDN is properly configured
6. **Analytics**: Track video engagement metrics
7. **Compression Options**: Let users choose quality vs size
8. **Video Transcoding**: Support more input formats with server-side transcoding

## ⚠️ Important Notes

1. **Storage Costs**: Videos consume more storage than images. Monitor Cloudinary usage.
2. **Bandwidth**: Large videos can slow down the app. Always compress.
3. **Mobile Data**: Consider warning users about data usage on mobile.
4. **Browser Support**: HTML5 video player works on modern browsers.
5. **Error Handling**: Network failures during upload should be handled gracefully.

## 🐛 Troubleshooting

### Common Issues:

1. **Video not uploading**
   - Check file size and format
   - Verify Cloudinary credentials
   - Check network connection

2. **Video not playing**
   - Verify video format (MP4 recommended)
   - Check Cloudinary URL is accessible
   - Ensure browser supports HTML5 video

3. **Slow uploads**
   - Reduce video file size
   - Check network speed
   - Consider chunked uploads (already implemented)

## 📊 Performance Metrics

### Expected Performance:
- **Upload Time**: 5-30 seconds depending on file size and network
- **Processing Time**: 2-10 seconds on Cloudinary
- **Playback**: Instant after upload completes

### Optimization Tips:
- Compress videos before upload when possible
- Use appropriate video codecs (H.264 recommended)
- Limit video duration for chat messages
- Generate thumbnails for faster previews

---

**Last Updated**: Implementation completed with best practices for video uploads in posts and chat messages.


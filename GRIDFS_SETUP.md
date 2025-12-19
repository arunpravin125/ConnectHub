# GridFS Video Upload Setup

## Installation

Install required packages:

```bash
npm install multer multer-gridfs-storage gridfs-stream
```

## Package.json Dependencies

Add these to your `package.json`:

```json
{
  "dependencies": {
    "multer": "^1.4.5-lts.1",
    "multer-gridfs-storage": "^5.0.2",
    "gridfs-stream": "^1.1.1"
  }
}
```

## Files Created/Modified

### 1. New Files:
- `backend/middleware/uploadVideo.js` - Multer middleware for GridFS
- `backend/controllers/videoController.js` - Video streaming endpoint
- `backend/utils/gridfs.js` - GridFS utility functions (optional helper)

### 2. Modified Files:
- `backend/Models/postModel.js` - Added `videoFileId` and `hasVideo` fields
- `backend/controllers/postController.js` - Modified `createPost` to handle GridFS
- `backend/routes/postRoutes.js` - Added multer middleware and video route
- `backend/DB/database.js` - Initialize GridFS on connection

## API Endpoints

### Create Post with Video (multipart/form-data)
```
POST /api/posts/create
Content-Type: multipart/form-data

Form Data:
- postedBy: string (user ID)
- text: string (optional)
- img: string (base64, optional - for images)
- video: File (video file, optional - for GridFS videos)
```

### Stream Video
```
GET /api/posts/video/:fileId
```

## Response Format

```json
{
  "_id": "post_id",
  "postedBy": "user_id",
  "text": "Post text",
  "img": null,
  "video": null,
  "videoFileId": "gridfs_file_id",
  "hasVideo": true,
  "likes": [],
  "replies": [],
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

## Frontend Usage

### Upload Video with FormData:

```javascript
const formData = new FormData();
formData.append('postedBy', userId);
formData.append('text', postText);
formData.append('video', videoFile); // File object from input

const response = await fetch('/api/posts/create', {
  method: 'POST',
  headers: {
    // Don't set Content-Type - browser will set it with boundary
  },
  body: formData
});
```

### Display Video:

```jsx
{post.hasVideo && post.videoFileId && (
  <video controls>
    <source src={`/api/posts/video/${post.videoFileId}`} type="video/mp4" />
  </video>
)}
```

## Notes

- GridFS videos are stored in MongoDB's `videos` collection
- Maximum file size: 100MB (configurable in `uploadVideo.js`)
- Only video files are accepted (mimetype starts with "video/")
- Existing Cloudinary video uploads still work (backward compatible)
- Image uploads via Cloudinary are unchanged


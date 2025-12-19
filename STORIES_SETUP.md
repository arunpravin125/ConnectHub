# Stories Feature Setup Guide

## Overview
Instagram-style Stories feature with 24-hour expiration, view tracking, and full-screen viewer.

## Database Schema

### Story Model
- `userId` (ObjectId, ref: User)
- `mediaType` ("image" | "video")
- `mediaUrl` (String, Cloudinary URL)
- `caption` (String, optional, max 2200 chars)
- `expiresAt` (Date, auto-deletes via TTL index)
- `views` (Array of { userId, viewedAt })
- `visibleTo` ("public" only for now)

### Indexes
- TTL index on `expiresAt` - auto-deletes expired stories
- Index on `userId + createdAt` for efficient queries

## API Endpoints

### POST /api/stories
Create a new story.

**Request:**
```json
{
  "mediaType": "image",
  "media": "data:image/jpeg;base64,...",
  "caption": "Optional caption"
}
```

**Response:**
```json
{
  "success": true,
  "story": {
    "id": "...",
    "userId": "...",
    "mediaType": "image",
    "mediaUrl": "https://res.cloudinary.com/...",
    "caption": "...",
    "createdAt": "2025-01-20T...",
    "expiresAt": "2025-01-21T...",
    "views": []
  }
}
```

### GET /api/stories/feed
Get users with active stories (for stories row).

**Response:**
```json
{
  "stories": [
    {
      "user": {
        "id": "...",
        "name": "John Doe",
        "username": "johndoe",
        "avatarUrl": "https://..."
      },
      "hasUnviewed": true,
      "latestStoryAt": "2025-01-20T...",
      "storyCount": 3
    }
  ]
}
```

### GET /api/stories/user/:id
Get all active stories for a specific user.

**Response:**
```json
{
  "stories": [
    {
      "id": "...",
      "mediaType": "image",
      "mediaUrl": "https://...",
      "caption": "...",
      "createdAt": "2025-01-20T...",
      "expiresAt": "2025-01-21T...",
      "isViewedByMe": false,
      "viewCount": 5
    }
  ]
}
```

### POST /api/stories/:id/view
Mark a story as viewed (idempotent).

**Response:**
```json
{
  "success": true,
  "viewed": true,
  "viewCount": 6
}
```

## Frontend Components

### StoriesRow
- Horizontal scrollable row at top of feed
- "Your Story" button first (with + icon)
- User avatars with gradient border for unviewed
- Clicking opens StoryViewer

### StoryViewer
- Full-screen overlay/modal
- Progress bar segments at top
- Auto-advance: 5s for images, 15s for videos
- Click left/right to navigate
- Keyboard: Arrow keys, Space, Escape

### CreateStoryModal
- Modal for creating stories
- Image/video selection
- Optional caption (max 2200 chars)
- Uploads to Cloudinary

## TTL Index

MongoDB automatically deletes stories when `expiresAt` is reached:
```javascript
storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
```

## Manual Test Checklist

1. ✅ Create story (image)
   - Click "Your Story" → Select image → Add caption → Share
   - Verify story appears in stories row

2. ✅ Create story (video)
   - Click "Your Story" → Select video → Share
   - Verify story appears in stories row

3. ✅ View story
   - Click user avatar in stories row
   - Verify StoryViewer opens
   - Verify progress bar advances
   - Verify auto-advance to next story

4. ✅ Navigation
   - Click right side of screen → next story
   - Click left side of screen → previous story
   - Press Arrow keys → navigate
   - Press Escape → close viewer

5. ✅ View tracking
   - View a story
   - Close viewer
   - Verify ring changes from gradient to gray (viewed)

6. ✅ Story expiration
   - Create story
   - Wait 24 hours (or manually set expiresAt in DB)
   - Verify story disappears from feed

7. ✅ Unviewed ordering
   - Create multiple stories from different users
   - View some, not others
   - Verify unviewed appear first in stories row

8. ✅ Multiple stories per user
   - User creates 3 stories
   - Click user avatar
   - Verify all 3 stories play sequentially

## Example Story Document

```json
{
  "_id": "...",
  "userId": "...",
  "mediaType": "image",
  "mediaUrl": "https://res.cloudinary.com/.../image/upload/...",
  "caption": "Check this out!",
  "expiresAt": "2025-01-21T14:30:00Z",
  "views": [
    {
      "userId": "...",
      "viewedAt": "2025-01-20T15:00:00Z"
    }
  ],
  "visibleTo": "public",
  "createdAt": "2025-01-20T14:30:00Z",
  "updatedAt": "2025-01-20T15:00:00Z"
}
```


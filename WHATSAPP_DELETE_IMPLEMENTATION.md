# WhatsApp-Style Delete Feature Implementation

## Overview
This document describes the implementation of WhatsApp-style delete functionality for the 1:1 chat system, including "Delete for me" and "Delete for everyone" features.

## Changes Summary

### 1. Database Schema (`threads-app/backend/Models/messageModel.js`)
Added three new fields to the Message schema:
- `deletedForUsers`: Array of user IDs who deleted the message "for me"
- `deletedForAll`: Boolean flag indicating if message was deleted for everyone
- `deletedForAllAt`: Timestamp when message was deleted for everyone

### 2. Backend Endpoints (`threads-app/backend/controllers/messageController.js`)

#### POST `/api/messages/:messageId/delete-for-me`
- **Purpose**: Delete message only for the requesting user
- **Auth**: Required (protectRoute)
- **Validation**: 
  - Verifies message exists
  - Verifies user is a participant in the conversation
- **Action**: Adds user ID to `deletedForUsers` array (idempotent)
- **Socket Event**: Emits `message:deleted_for_me` to requester only

#### POST `/api/messages/:messageId/delete-for-everyone`
- **Purpose**: Delete message for both participants
- **Auth**: Required (protectRoute)
- **Validation**:
  - Verifies message exists
  - Verifies requester is the sender
  - Verifies message is not already deleted for everyone
  - Verifies message age ≤ 48 hours
- **Action**: Sets `deletedForAll=true`, clears all content fields
- **Socket Event**: Emits `message:deleted_for_all` to both participants

### 3. Message Retrieval (`getMessages`)
- Filters out messages where `deletedForUsers` contains current user ID
- Returns tombstone payload for messages with `deletedForAll=true`

### 4. Frontend Components

#### Message.jsx
- Added three-dots menu (visible on hover)
- Shows "Delete for me" for all messages
- Shows "Delete for everyone" only for own messages within 48 hours
- Renders tombstone UI for deleted messages

#### MessageContainer.jsx
- Handles socket events: `message:deleted_for_me` and `message:deleted_for_all`
- Updates message list state on delete events
- Passes `onDelete` handler to Message component

## API Examples

### Delete for Me

**Request:**
```http
POST /api/messages/507f1f77bcf86cd799439011/delete-for-me
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "messageId": "507f1f77bcf86cd799439011",
  "message": "Message deleted for you"
}
```

**Socket Event (to requester only):**
```json
{
  "messageId": "507f1f77bcf86cd799439011",
  "conversationId": "507f1f77bcf86cd799439012"
}
```

### Delete for Everyone

**Request:**
```http
POST /api/messages/507f1f77bcf86cd799439011/delete-for-everyone
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "messageId": "507f1f77bcf86cd799439011",
  "message": {
    "_id": "507f1f77bcf86cd799439011",
    "conversationId": "507f1f77bcf86cd799439012",
    "sender": "507f1f77bcf86cd799439013",
    "text": "",
    "img": "",
    "video": "",
    "audio": "",
    "fileUrl": "",
    "fileName": "",
    "fileType": "",
    "deletedForAll": true,
    "deletedForAllAt": "2024-01-15T10:30:00.000Z",
    "createdAt": "2024-01-14T10:30:00.000Z"
  },
  "tombstoneText": "This message was deleted"
}
```

**Socket Event (to both participants):**
```json
{
  "messageId": "507f1f77bcf86cd799439011",
  "conversationId": "507f1f77bcf86cd799439012",
  "deletedForAll": true,
  "tombstoneText": "This message was deleted"
}
```

**Error Response (400 - Time limit exceeded):**
```json
{
  "error": "Cannot delete message. Time limit of 48 hours has passed"
}
```

**Error Response (403 - Not sender):**
```json
{
  "error": "Only the message sender can delete for everyone"
}
```

## Manual Test Checklist

### Test 1: Delete for Me
- [ ] User A sends a message to User B
- [ ] User A clicks three-dots menu on their message
- [ ] User A selects "Delete for me"
- [ ] Message disappears for User A
- [ ] Message still visible for User B
- [ ] Socket event received by User A only

### Test 2: Delete for Everyone (Within 48h)
- [ ] User A sends a message to User B
- [ ] User A clicks three-dots menu on their message
- [ ] User A selects "Delete for everyone"
- [ ] Message shows tombstone "This message was deleted" for User A
- [ ] Message shows tombstone "This message was deleted" for User B
- [ ] Socket event received by both users
- [ ] Message content (text/media) is cleared

### Test 3: Delete for Everyone (After 48h)
- [ ] User A sends a message to User B
- [ ] Wait 48+ hours (or manually set message.createdAt to past date)
- [ ] User A clicks three-dots menu
- [ ] "Delete for everyone" option should not appear (or be disabled)
- [ ] If attempted via API, returns 400 error

### Test 4: Non-Sender Cannot Delete for Everyone
- [ ] User A sends a message to User B
- [ ] User B clicks three-dots menu on User A's message
- [ ] "Delete for everyone" option should not appear
- [ ] If attempted via API, returns 403 error

### Test 5: Idempotency
- [ ] User A deletes a message "for me"
- [ ] User A attempts to delete the same message "for me" again
- [ ] No error occurs (idempotent operation)

### Test 6: Real-time Updates
- [ ] User A and User B both have chat open
- [ ] User A deletes message "for everyone"
- [ ] User B's chat updates immediately via socket event
- [ ] Both users see tombstone message

### Test 7: Message Retrieval
- [ ] User A deletes message "for me"
- [ ] User A refreshes chat or loads more messages
- [ ] Deleted message does not appear in message list
- [ ] User B still sees the message normally

### Test 8: Tombstone Rendering
- [ ] User A deletes message "for everyone"
- [ ] Message shows grayed-out tombstone text
- [ ] Original content (text, images, videos, files) is hidden
- [ ] Message maintains same layout/styling

## File Changes

### Backend
1. `threads-app/backend/Models/messageModel.js` - Added delete fields
2. `threads-app/backend/controllers/messageController.js` - Added delete endpoints and updated getMessages
3. `threads-app/backend/routes/messageRoutes.js` - Added delete routes

### Frontend
1. `threads-app/frontend/src/components/Message.jsx` - Added delete menu and tombstone rendering
2. `threads-app/frontend/src/components/MessageContainer.jsx` - Added socket listeners and delete handler

## Notes
- Messages are never physically deleted from the database
- Delete-for-me uses `$addToSet` for idempotency
- Delete-for-everyone clears content but preserves message document
- 48-hour time limit is enforced server-side
- Socket events ensure real-time updates for both users
- Tombstone messages maintain original message layout for consistency


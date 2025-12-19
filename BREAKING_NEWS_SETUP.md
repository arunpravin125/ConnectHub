# Breaking News Feature Setup Guide

## Overview
This feature automatically ingests breaking news from FREE RSS feeds and publishes them as "Breaking" posts in your feed. Breaking news posts are boosted to the top of the feed for 60 minutes.

## Environment Variables

Add to your `.env` file:
```env
ADMIN_TOKEN=your-secret-admin-token-here
```

**Important**: Use a strong, random token for production. This token is required for all admin endpoints.

## Installation

The required packages are already installed:
- `rss-parser` - RSS feed parsing
- `p-limit` - Concurrency control
- `node-cron` - Scheduled tasks

## Database Schema

The Post model has been extended with:
- `isBreaking` (boolean)
- `headline` (string)
- `sourceName` (string)
- `sourceUrl` (string)
- `breakingExpiresAt` (Date)
- `newsExternalId` (string, unique)
- `newsPublishedAt` (Date)
- `createdBySystem` (boolean)

A new `NewsSource` model stores RSS feed configurations.

## Setup Steps

### 1. Set Admin Token
```bash
# In your .env file
ADMIN_TOKEN=your-secure-random-token
```

### 2. Add RSS Feeds

Use the admin API to add feeds:

```bash
# Add a news source
curl -X POST http://localhost:4901/api/news/sources \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: your-secure-random-token" \
  -d '{
    "feedUrl": "https://feeds.bbci.co.uk/news/rss.xml",
    "sourceName": "BBC News"
  }'
```

### 3. Example RSS Feeds

Here are some free RSS feeds you can use:

```json
[
  {
    "feedUrl": "https://feeds.bbci.co.uk/news/rss.xml",
    "sourceName": "BBC News"
  },
  {
    "feedUrl": "https://rss.cnn.com/rss/edition.rss",
    "sourceName": "CNN"
  },
  {
    "feedUrl": "https://feeds.reuters.com/reuters/topNews",
    "sourceName": "Reuters"
  },
  {
    "feedUrl": "https://www.theguardian.com/world/rss",
    "sourceName": "The Guardian"
  },
  {
    "feedUrl": "https://feeds.npr.org/1001/rss.xml",
    "sourceName": "NPR"
  }
]
```

### 4. Manual Ingestion (Testing)

Trigger ingestion manually:
```bash
curl -X POST http://localhost:4901/api/news/run \
  -H "X-Admin-Token: your-secure-random-token"
```

## Admin API Endpoints

All endpoints require `X-Admin-Token` header.

### GET /api/news/sources
List all configured news sources.

### POST /api/news/sources
Add a new RSS feed.
```json
{
  "feedUrl": "https://example.com/feed.xml",
  "sourceName": "Source Name"
}
```

### DELETE /api/news/sources/:id
Remove a news source.

### PUT /api/news/sources/:id/toggle
Activate/deactivate a news source.

### POST /api/news/run
Manually trigger news ingestion (for testing).

## Automatic Ingestion

The cron job runs **every 3 minutes** automatically. It:
1. Fetches all active RSS feeds
2. Parses news items
3. Creates breaking news posts (avoiding duplicates)
4. Sets `breakingExpiresAt` to 60 minutes from creation

## Feed Behavior

- **Breaking news posts** appear at the top of the feed
- They remain boosted for **60 minutes** after creation
- After 60 minutes, they appear in chronological order
- Breaking news is visible to **all users** (not just followers)

## Frontend Display

Breaking news posts show:
- 🔴 **BREAKING** badge
- Headline (bold, larger font)
- Source name with link to original article
- Summary text (if available, max 240 chars)

## Example Post Document

```json
{
  "_id": "...",
  "postedBy": "system_user_id",
  "text": "Summary text here...",
  "headline": "Breaking: Major Event Happens",
  "sourceName": "BBC News",
  "sourceUrl": "https://bbc.com/news/article",
  "isBreaking": true,
  "breakingExpiresAt": "2025-01-20T15:30:00Z",
  "newsExternalId": "sha256_hash",
  "newsPublishedAt": "2025-01-20T14:30:00Z",
  "createdBySystem": true,
  "createdAt": "2025-01-20T14:30:00Z",
  "updatedAt": "2025-01-20T14:30:00Z"
}
```

## Error Handling

- Feeds with 5+ consecutive errors are automatically deactivated
- Individual feed errors don't crash the server
- Timeouts are set to 10 seconds per feed
- Concurrency is limited to 3 simultaneous fetches

## Manual Test Checklist

1. ✅ Set `ADMIN_TOKEN` in `.env`
2. ✅ Add RSS feed via API
3. ✅ Run manual ingestion (`POST /api/news/run`)
4. ✅ Verify posts created in database
5. ✅ Check feed shows breaking news at top
6. ✅ Verify no duplicates created
7. ✅ Wait 60 minutes, verify breaking news no longer boosted
8. ✅ Test with bad feed URL (should handle gracefully)

## Troubleshooting

**No breaking news in feed:**
- Check if feeds are active: `GET /api/news/sources`
- Check server logs for ingestion errors
- Verify `ADMIN_TOKEN` is set

**Duplicates appearing:**
- Check `newsExternalId` unique index is working
- Verify feed URLs are unique

**Feeds not updating:**
- Check `lastFetchedAt` timestamp
- Review `errorCount` and `lastError` fields
- Manually trigger ingestion to test

## Security Notes

- Admin token should be strong and secret
- Never commit `ADMIN_TOKEN` to version control
- Breaking news posts are public (visible to all users)
- System user (`__system__`) is created automatically


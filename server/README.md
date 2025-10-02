# HealthHub Backend Server

Express.js API server for cross-device data synchronization.

## Setup

```bash
cd server
npm install
npm start
```

Server runs on `http://localhost:3001` by default.

## API Endpoints

### Authentication
- `POST /api/auth/verify` - Verify user credentials (auto-creates user if not exists)

### Data Sync
- `GET /api/data/all` - Download all user data (supplements, logs, sections)
- `POST /api/sync` - Upload sync queue items

### Headers Required
- `X-User-ID`: User's unique identifier
- `X-Passcode`: User's passcode

## Database

Uses SQLite (`healthhub.db`) for persistent storage.

## Environment Variables

- `PORT` - Server port (default: 3001)

## Deployment

To deploy on a server:

1. Install dependencies
2. Set `VITE_API_URL` environment variable in the frontend to point to your server
3. Run with `npm start` or use a process manager like PM2

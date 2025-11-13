# Deployment Guide

## Backend Deployment (Render)

### Option 1: Docker Deployment (Recommended)

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name:** `mini-messenger-backend` (or your choice)
   - **Root Directory:** `server`
   - **Environment:** `Docker`
   - **Dockerfile Path:** `server/Dockerfile` (or just `Dockerfile` if root is `server`)
   - **Port:** `4000`

5. **Environment Variables:**
   ```
   PORT=4000
   DATABASE_URL=file:./prisma/dev.db
   ```

6. Click "Create Web Service"

### Option 2: Native Node.js Deployment

1. Same as above, but:
   - **Environment:** `Node`
   - **Build Command:** `npm install && npx prisma generate && npm run build && npx prisma migrate deploy`
   - **Start Command:** `npm start`

### After Deployment

- Copy your backend URL (e.g., `https://mini-messenger-backend.onrender.com`)
- Copy your WebSocket URL (e.g., `wss://mini-messenger-backend.onrender.com`)

## Frontend Deployment (Vercel)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New..." → "Project"
3. Import your GitHub repository
4. Configure:
   - **Framework Preset:** Next.js (auto-detected)
   - **Root Directory:** `web`
   - **Build Command:** `npm run build` (default)
   - **Output Directory:** `.next` (default)

5. **Environment Variables:**
   ```
   NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
   NEXT_PUBLIC_WS_URL=wss://your-backend.onrender.com
   ```
   Replace `your-backend.onrender.com` with your actual Render backend URL

6. Click "Deploy"

## Important Notes

### WebSocket on Render
- Render supports WebSocket connections
- Use `wss://` (secure WebSocket) for HTTPS deployments
- The WebSocket server runs on the same port as HTTP (4000)

### Database
- For production, consider using Render's PostgreSQL instead of SQLite
- Update `DATABASE_URL` in Prisma schema and environment variables
- Run migrations: `npx prisma migrate deploy`

### CORS
- The backend already has CORS enabled
- If you encounter CORS issues, update the allowed origins in `server/src/index.ts`

### Environment Variables Checklist

**Backend (Render):**
- [ ] `PORT` (optional, Render assigns automatically)
- [ ] `DATABASE_URL` (if using external database)

**Frontend (Vercel):**
- [ ] `NEXT_PUBLIC_API_URL` (your Render backend URL)
- [ ] `NEXT_PUBLIC_WS_URL` (your Render WebSocket URL with `wss://`)

## Testing Deployment

1. Open your Vercel frontend URL
2. Create a user
3. Create a conversation
4. Test real-time messaging
5. Verify WebSocket connection in browser DevTools → Network → WS

## Troubleshooting

### WebSocket Connection Failed
- Ensure you're using `wss://` (not `ws://`) for HTTPS deployments
- Check that Render WebSocket is enabled (it should be by default)
- Verify the WebSocket URL matches your backend URL

### CORS Errors
- Check that `NEXT_PUBLIC_API_URL` is correctly set
- Verify backend CORS configuration allows your Vercel domain

### Database Issues
- For SQLite: Ensure the database file is persisted (Render may reset it)
- Consider using PostgreSQL for production
- Run migrations: `npx prisma migrate deploy`


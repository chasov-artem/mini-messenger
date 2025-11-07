# Mini Messenger

A real-time messaging application built with Next.js, TypeScript, Redux, Node.js, WebSocket, and Tailwind CSS.

## 🚀 Features

- Real-time messaging via WebSocket
- Multi-user chat rooms
- User authentication with localStorage persistence
- Conversation history
- Modern UI with Tailwind CSS

## 📁 Project Structure

```
mesendger/
├── web/          # Next.js frontend
├── server/       # Node.js backend with Express + WebSocket
└── README.md     # This file
```

## 🛠️ Tech Stack

### Frontend (`web/`)
- Next.js 16 (App Router)
- TypeScript
- Redux Toolkit + redux-persist
- Tailwind CSS
- React 19

### Backend (`server/`)
- Node.js + Express
- WebSocket (ws)
- Prisma ORM
- SQLite (dev)

## 📦 Installation

### Prerequisites
- Node.js 18+ and npm
- Git

### Setup

1. Clone the repository:
```bash
git clone https://github.com/chasov-artem/mini-messenger.git
cd mini-messenger
```

2. Install dependencies for both projects:

```bash
# Backend
cd server
npm install
npx prisma generate
npx prisma migrate dev

# Frontend
cd ../web
npm install
```

## 🏃 Running Locally

### Development Mode

**Terminal 1 - Backend:**
```bash
cd server
npm run dev
```
Backend runs on `http://localhost:4000`

**Terminal 2 - Frontend:**
```bash
cd web
npm run dev
```
Frontend runs on `http://localhost:3000`

### Production Build

**Backend:**
```bash
cd server
npm run build
npm start
```

**Frontend:**
```bash
cd web
npm run build
npm start
```

## 📡 API Endpoints

### REST

- `GET /health` - Health check
- `POST /users` - Create/get user (upsert by username)
- `POST /conversations` - Create conversation
- `GET /conversations?userId=...` - List user's conversations
- `POST /messages` - Send message
- `GET /messages?conversationId=...` - Get conversation history

### WebSocket

- Connect to `ws://localhost:4000`
- Send `{ type: "join", conversationId: "..." }` to join a room
- Receive `{ type: "message:new", payload: Message }` for new messages

## 🎯 Usage

1. Open `http://localhost:3000`
2. Enter a username
3. Create a new conversation or join an existing one by ID
4. Start chatting! Messages are synced in real-time via WebSocket

## 🔧 Development

### Code Formatting
```bash
cd web
npm run format
npm run lint
```

Pre-commit hooks (via Husky) automatically format and lint before commits.

### Database

Prisma migrations:
```bash
cd server
npx prisma migrate dev
npx prisma studio  # Open Prisma Studio to view/edit data
```

## 📝 Environment Variables

Create `.env` files if needed:

**`server/.env`:**
```
DATABASE_URL="file:./prisma/dev.db"
PORT=4000
```

**`web/.env.local`:**
```
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## 🚢 Deployment

### Backend
- Build: `npm run build`
- Start: `npm start`
- Set `PORT` environment variable

### Frontend
- Build: `npm run build`
- Start: `npm start`
- Or deploy to Vercel/Netlify

## 📄 License

ISC

## 👤 Author

chasov-artem


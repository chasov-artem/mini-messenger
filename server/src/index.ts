import http from 'http';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { PrismaClient } from '@prisma/client';

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const prisma = new PrismaClient();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Users
app.post('/users', async (req, res) => {
  try {
    const { username } = req.body as { username?: string };
    if (!username) return res.status(400).json({ error: 'username required' });
    // Idempotent: return existing user if username already taken
    const user = await prisma.user.upsert({
      where: { username },
      update: {},
      create: { username },
    });
    res.status(201).json(user);
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? 'failed to create or fetch user' });
  }
});

// Conversations
app.post('/conversations', async (req, res) => {
  try {
    const { title, memberUserIds } = req.body as { title?: string; memberUserIds?: string[] };
    if (!title) return res.status(400).json({ error: 'title required' });
    const conversation = await prisma.conversation.create({ data: { title } });
    if (Array.isArray(memberUserIds) && memberUserIds.length > 0) {
      await prisma.membership.createMany({
        data: memberUserIds.map((userId) => ({ userId, conversationId: conversation.id })),
      });
    }
    res.status(201).json(conversation);
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? 'failed to create conversation' });
  }
});

// Messages
app.post('/messages', async (req, res) => {
  try {
    const { conversationId, authorId, text } = req.body as {
      conversationId?: string;
      authorId?: string;
      text?: string;
    };
    if (!conversationId || !authorId || !text) {
      return res.status(400).json({ error: 'conversationId, authorId, text required' });
    }
    const message = await prisma.message.create({
      data: { conversationId, authorId, text },
      include: { author: true },
    });
    // Broadcast to all clients for now
    const payload = JSON.stringify({ type: 'message:new', payload: message });
    wss.clients.forEach((client) => {
      if ((client as any).readyState === 1) client.send(payload);
    });
    res.status(201).json(message);
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? 'failed to create message' });
  }
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'welcome', payload: 'connected' }));
  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw.toString());
      // echo for now
      ws.send(JSON.stringify({ type: 'echo', payload: data }));
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', payload: 'invalid json' }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`server listening on http://localhost:${PORT}`);
});

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

app.get('/conversations', async (req, res) => {
  try {
    const userId = (req.query.userId as string) || '';
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const memberships = await prisma.membership.findMany({ where: { userId } });
    const conversationIds = memberships.map((m) => m.conversationId);
    const conversations = await prisma.conversation.findMany({
      where: { id: { in: conversationIds } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(conversations);
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? 'failed to list conversations' });
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
      include: {
        author: true,
        reactions: { include: { user: true } },
      },
    });
    // Broadcast only to clients joined to this conversation
    const payload = JSON.stringify({ type: 'message:new', payload: message });
    wss.clients.forEach((client) => {
      if ((client as any).readyState !== 1) return;
      if ((client as any).roomId === conversationId) client.send(payload);
    });
    res.status(201).json(message);
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? 'failed to create message' });
  }
});

app.get('/messages', async (req, res) => {
  try {
    const conversationId = (req.query.conversationId as string) || '';
    if (!conversationId) return res.status(400).json({ error: 'conversationId required' });
    const messages = await prisma.message.findMany({
      where: { conversationId },
      include: {
        author: true,
        reactions: { include: { user: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(messages);
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? 'failed to list messages' });
  }
});

app.patch('/messages/:id', async (req, res) => {
  try {
    const messageId = req.params.id;
    const { text, authorId } = req.body as { text?: string; authorId?: string };
    if (!text || !authorId) {
      return res.status(400).json({ error: 'text and authorId required' });
    }
    const existing = await prisma.message.findUnique({ where: { id: messageId } });
    if (!existing) return res.status(404).json({ error: 'message not found' });
    if (existing.authorId !== authorId) {
      return res.status(403).json({ error: 'not authorized to edit this message' });
    }
    const updated = await prisma.message.update({
      where: { id: messageId },
      data: { text },
      include: {
        author: true,
        reactions: { include: { user: true } },
      },
    });
    // Broadcast update to room
    const payload = JSON.stringify({ type: 'message:updated', payload: updated });
    wss.clients.forEach((client) => {
      if ((client as any).readyState !== 1) return;
      if ((client as any).roomId === updated.conversationId) client.send(payload);
    });
    res.json(updated);
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? 'failed to update message' });
  }
});

app.delete('/messages/:id', async (req, res) => {
  try {
    const messageId = req.params.id;
    const { authorId } = req.body as { authorId?: string };
    if (!authorId) return res.status(400).json({ error: 'authorId required' });
    const existing = await prisma.message.findUnique({ where: { id: messageId } });
    if (!existing) return res.status(404).json({ error: 'message not found' });
    if (existing.authorId !== authorId) {
      return res.status(403).json({ error: 'not authorized to delete this message' });
    }
    const conversationId = existing.conversationId;
    await prisma.message.delete({ where: { id: messageId } });
    // Broadcast deletion to room
    const payload = JSON.stringify({ type: 'message:deleted', payload: { id: messageId, conversationId } });
    wss.clients.forEach((client) => {
      if ((client as any).readyState !== 1) return;
      if ((client as any).roomId === conversationId) client.send(payload);
    });
    res.json({ success: true, id: messageId });
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? 'failed to delete message' });
  }
});

// Reactions
app.post('/messages/:id/reactions', async (req, res) => {
  try {
    const messageId = req.params.id;
    const { userId, emoji } = req.body as { userId?: string; emoji?: string };
    if (!userId || !emoji) {
      return res.status(400).json({ error: 'userId and emoji required' });
    }
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: { reactions: { include: { user: true } } },
    });
    if (!message) return res.status(404).json({ error: 'message not found' });
    // Toggle reaction: if exists, delete it; otherwise create it
    const existing = await prisma.reaction.findUnique({
      where: { messageId_userId_emoji: { messageId, userId, emoji } },
    });
    if (existing) {
      await prisma.reaction.delete({ where: { id: existing.id } });
      const updated = await prisma.message.findUnique({
        where: { id: messageId },
        include: {
          author: true,
          reactions: { include: { user: true } },
        },
      });
      // Broadcast reaction removal
      const payload = JSON.stringify({
        type: 'reaction:removed',
        payload: { messageId, userId, emoji, message: updated },
      });
      wss.clients.forEach((client) => {
        if ((client as any).readyState !== 1) return;
        if ((client as any).roomId === message.conversationId) client.send(payload);
      });
      res.json(updated);
    } else {
      const reaction = await prisma.reaction.create({
        data: { messageId, userId, emoji },
        include: { user: true },
      });
      const updated = await prisma.message.findUnique({
        where: { id: messageId },
        include: {
          author: true,
          reactions: { include: { user: true } },
        },
      });
      // Broadcast reaction addition
      const payload = JSON.stringify({
        type: 'reaction:added',
        payload: { messageId, reaction, message: updated },
      });
      wss.clients.forEach((client) => {
        if ((client as any).readyState !== 1) return;
        if ((client as any).roomId === message.conversationId) client.send(payload);
      });
      res.json(updated);
    }
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? 'failed to toggle reaction' });
  }
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  (ws as any).roomId = null as string | null;
  (ws as any).userId = null as string | null;
  ws.send(JSON.stringify({ type: 'welcome', payload: 'connected' }));
  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw.toString());
      if (data?.type === 'join' && typeof data?.conversationId === 'string') {
        (ws as any).roomId = data.conversationId;
        if (data.userId) (ws as any).userId = data.userId;
        ws.send(JSON.stringify({ type: 'joined', conversationId: data.conversationId }));
        return;
      }
      if (data?.type === 'typing' && typeof data?.userId === 'string' && typeof data?.conversationId === 'string') {
        // Broadcast typing to others in room
        const payload = JSON.stringify({
          type: 'typing',
          payload: { userId: data.userId, username: data.username, conversationId: data.conversationId },
        });
        wss.clients.forEach((client) => {
          if ((client as any).readyState !== 1) return;
          if ((client as any).roomId === data.conversationId && (client as any).userId !== data.userId) {
            client.send(payload);
          }
        });
        return;
      }
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', payload: 'invalid json' }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`server listening on http://localhost:${PORT}`);
});

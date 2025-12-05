import http from 'http';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const prisma = new PrismaClient();

const app = express();

// CORS configuration - supports custom domains
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
  : undefined;

app.use(
  cors({
    origin: allowedOrigins || true, // Use ALLOWED_ORIGINS env var or allow all (for development)
    credentials: true,
  }),
);
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Auth middleware to verify JWT token
interface AuthRequest extends express.Request {
  userId?: string;
}

const authenticateToken = (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; username: string };
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'invalid or expired token' });
  }
};

// Auth endpoints
app.post('/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string };
    
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password required' });
    }
    
    if (username.trim().length < 3) {
      return res.status(400).json({ error: 'username must be at least 3 characters' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'password must be at least 6 characters' });
    }
    
    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { username: username.trim() },
    });
    
    if (existing) {
      return res.status(400).json({ error: 'username already taken' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const user = await prisma.user.create({
      data: {
        username: username.trim(),
        password: hashedPassword,
      },
    });
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.status(201).json({
      user: { id: user.id, username: user.username },
      token,
    });
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? 'failed to register user' });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string };
    
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password required' });
    }
    
    // Find user
    const user = await prisma.user.findUnique({
      where: { username: username.trim() },
    });
    
    if (!user) {
      return res.status(401).json({ error: 'invalid username or password' });
    }
    
    // Check if user has password (for backward compatibility with old users)
    if (!user.password) {
      return res.status(401).json({ error: 'account needs password reset. please register again.' });
    }
    
    // Verify password
    const isValid = await bcrypt.compare(password, user.password);
    
    if (!isValid) {
      return res.status(401).json({ error: 'invalid username or password' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      user: { id: user.id, username: user.username },
      token,
    });
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? 'failed to login' });
  }
});

// Get current user (protected)
app.get('/auth/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { id: true, username: true, createdAt: true },
    });
    
    if (!user) {
      return res.status(404).json({ error: 'user not found' });
    }
    
    res.json(user);
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? 'failed to get user' });
  }
});

// Conversations (all protected)
app.post('/conversations', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { title, memberUserIds } = req.body as { 
      title?: string; 
      memberUserIds?: string[];
    };
    if (!title) return res.status(400).json({ error: 'title required' });
    
    const creatorId = req.userId!;
    
    const conversation = await prisma.conversation.create({ data: { title } });
    
    // Create membership for creator as owner
    await prisma.membership.create({
      data: { userId: creatorId, conversationId: conversation.id, role: 'owner' },
    });
    
    // Add other members as regular members
    if (Array.isArray(memberUserIds) && memberUserIds.length > 0) {
      await prisma.membership.createMany({
        data: memberUserIds
          .filter((userId) => userId !== creatorId) // Don't add creator twice
          .map((userId) => ({ 
            userId, 
            conversationId: conversation.id, 
            role: 'member' 
          })),
      });
    }
    res.status(201).json(conversation);
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? 'failed to create conversation' });
  }
});

app.get('/conversations', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const memberships = await prisma.membership.findMany({ 
      where: { userId },
      include: { conversation: true },
    });
    const conversations = memberships.map((m) => ({
      ...m.conversation,
      userRole: m.role, // Include user's role in this conversation
    }));
    res.json(conversations);
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? 'failed to list conversations' });
  }
});

app.get('/conversations/:id/members', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const conversationId = req.params.id;
    const memberships = await prisma.membership.findMany({
      where: { conversationId },
      include: { user: true },
    });
    res.json(memberships.map((m) => ({ ...m.user, role: m.role })));
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? 'failed to list members' });
  }
});

// Update conversation title (only owner can update)
app.patch('/conversations/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const conversationId = req.params.id;
    const { title } = req.body as { title?: string };
    if (!title || title.trim() === '') {
      return res.status(400).json({ error: 'title is required' });
    }
    
    const userId = req.userId!;
    
    // Check if user is owner
    const membership = await prisma.membership.findUnique({
      where: { userId_conversationId: { userId, conversationId } },
    });
    
    if (!membership || membership.role !== 'owner') {
      return res.status(403).json({ error: 'only owner can update conversation title' });
    }
    
    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: { title: title.trim() },
    });
    // Broadcast update to all members
    const payload = JSON.stringify({ type: 'conversation:updated', payload: updated });
    wss.clients.forEach((client) => {
      if ((client as any).readyState !== 1) return;
      if ((client as any).roomId === conversationId) {
        client.send(payload);
      }
    });
    res.json(updated);
  } catch (e: any) {
    if (e?.code === 'P2025') {
      return res.status(404).json({ error: 'conversation not found' });
    }
    res.status(400).json({ error: e?.message ?? 'failed to update conversation' });
  }
});

// Add member to conversation
app.post('/conversations/:id/members', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const conversationId = req.params.id;
    const { userId, username } = req.body as { userId?: string; username?: string };
    
    let targetUserId = userId;
    
    // If username provided, find user by username
    if (!targetUserId && username) {
      const user = await prisma.user.findUnique({ where: { username } });
      if (!user) {
        return res.status(404).json({ error: 'user not found' });
      }
      targetUserId = user.id;
    }
    
    if (!targetUserId) {
      return res.status(400).json({ error: 'userId or username is required' });
    }
    
    // Check if user is already a member
    const existing = await prisma.membership.findUnique({
      where: { userId_conversationId: { userId: targetUserId, conversationId } },
    });
    
    if (existing) {
      return res.status(400).json({ error: 'user is already a member' });
    }
    
    // Add membership as regular member
    await prisma.membership.create({
      data: { userId: targetUserId, conversationId, role: 'member' },
    });
    
    // Get updated member list
    const memberships = await prisma.membership.findMany({
      where: { conversationId },
      include: { user: true },
    });
    const members = memberships.map((m) => ({ ...m.user, role: m.role }));
    
    // Broadcast to all members
    const payload = JSON.stringify({
      type: 'conversation:member-added',
      payload: { conversationId, user: members.find((m) => m.id === targetUserId), members },
    });
    wss.clients.forEach((client) => {
      if ((client as any).readyState !== 1) return;
      if ((client as any).roomId === conversationId) {
        client.send(payload);
      }
    });
    
    res.status(201).json({ success: true, members });
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? 'failed to add member' });
  }
});

// Remove member from conversation
app.delete('/conversations/:id/members/:userId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const conversationId = req.params.id;
    const userId = req.params.userId;
    
    // Check if membership exists
    const membership = await prisma.membership.findUnique({
      where: { userId_conversationId: { userId, conversationId } },
    });
    
    if (!membership) {
      return res.status(404).json({ error: 'membership not found' });
    }
    
    // Remove membership
    await prisma.membership.delete({
      where: { userId_conversationId: { userId, conversationId } },
    });
    
    // Get updated member list
    const memberships = await prisma.membership.findMany({
      where: { conversationId },
      include: { user: true },
    });
    const members = memberships.map((m) => ({ ...m.user, role: m.role }));
    
    // Broadcast to all members
    const payload = JSON.stringify({
      type: 'conversation:member-removed',
      payload: { conversationId, userId, members },
    });
    wss.clients.forEach((client) => {
      if ((client as any).readyState !== 1) return;
      if ((client as any).roomId === conversationId) {
        client.send(payload);
      }
    });
    
    res.json({ success: true, members });
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? 'failed to remove member' });
  }
});

// Leave conversation (remove membership but don't delete conversation)
app.post('/conversations/:id/leave', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const conversationId = req.params.id;
    const userId = req.userId!;
    
    // Check if membership exists
    const membership = await prisma.membership.findUnique({
      where: { userId_conversationId: { userId, conversationId } },
      include: { user: true },
    });
    
    if (!membership) {
      return res.status(404).json({ error: 'membership not found' });
    }
    
    // Don't allow owner to leave (they must delete the conversation)
    if (membership.role === 'owner') {
      return res.status(400).json({ error: 'owner cannot leave conversation, delete it instead' });
    }
    
    // Remove membership
    await prisma.membership.delete({
      where: { userId_conversationId: { userId, conversationId } },
    });
    
    // Get updated member list
    const memberships = await prisma.membership.findMany({
      where: { conversationId },
      include: { user: true },
    });
    const members = memberships.map((m) => ({ ...m.user, role: m.role }));
    
    // Broadcast to all members
    const payload = JSON.stringify({
      type: 'conversation:member-left',
      payload: { conversationId, userId, members },
    });
    wss.clients.forEach((client) => {
      if ((client as any).readyState !== 1) return;
      if ((client as any).roomId === conversationId) {
        client.send(payload);
      }
    });
    
    res.json({ success: true, members });
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? 'failed to leave conversation' });
  }
});

// Delete conversation (only owner can delete)
app.delete('/conversations/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const conversationId = req.params.id;
    const userId = req.userId!;
    
    // Check if conversation exists
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    
    if (!conversation) {
      return res.status(404).json({ error: 'conversation not found' });
    }
    
    // Check if user is owner
    const membership = await prisma.membership.findUnique({
      where: { userId_conversationId: { userId, conversationId } },
    });
    
    if (!membership || membership.role !== 'owner') {
      return res.status(403).json({ error: 'only owner can delete conversation' });
    }
    
    // Delete conversation (cascade will delete messages, memberships, reactions, reads)
    await prisma.conversation.delete({
      where: { id: conversationId },
    });
    
    // Broadcast deletion to all members
    const payload = JSON.stringify({
      type: 'conversation:deleted',
      payload: { conversationId },
    });
    wss.clients.forEach((client) => {
      if ((client as any).readyState !== 1) return;
      if ((client as any).roomId === conversationId) {
        client.send(payload);
      }
    });
    
    res.json({ success: true, conversationId });
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? 'failed to delete conversation' });
  }
});

// Messages
app.post('/messages', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { conversationId, text } = req.body as {
      conversationId?: string;
      text?: string;
    };
    if (!conversationId || !text) {
      return res.status(400).json({ error: 'conversationId and text required' });
    }
    const authorId = req.userId!;
    const message = await prisma.message.create({
      data: { conversationId, authorId, text },
      include: {
        author: true,
        reactions: { include: { user: true } },
        reads: { include: { user: true } },
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

app.get('/messages', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const conversationId = (req.query.conversationId as string) || '';
    if (!conversationId) return res.status(400).json({ error: 'conversationId required' });
    
    const limit = parseInt((req.query.limit as string) || '50', 10);
    const offset = parseInt((req.query.offset as string) || '0', 10);
    
    // Get total count for pagination info
    const totalCount = await prisma.message.count({
      where: { conversationId },
    });
    
    const messages = await prisma.message.findMany({
      where: { conversationId },
      include: {
        author: true,
        reactions: { include: { user: true } },
        reads: { include: { user: true } },
      },
      orderBy: { createdAt: 'desc' }, // Newest first for pagination
      take: limit,
      skip: offset,
    });
    
    // Reverse to show oldest first (for display)
    const reversedMessages = messages.reverse();
    
    res.json({
      messages: reversedMessages,
      pagination: {
        offset,
        limit,
        total: totalCount,
        hasMore: offset + limit < totalCount,
      },
    });
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? 'failed to list messages' });
  }
});

app.patch('/messages/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const messageId = req.params.id;
    const { text } = req.body as { text?: string };
    if (!text) {
      return res.status(400).json({ error: 'text required' });
    }
    const authorId = req.userId!;
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
        reads: { include: { user: true } },
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

app.delete('/messages/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const messageId = req.params.id;
    const authorId = req.userId!;
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

// Mark messages as read
app.post('/messages/read', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { messageIds } = req.body as {
      messageIds?: string[];
    };
    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return res
        .status(400)
        .json({ error: 'messageIds are required' });
    }
    const userId = req.userId!;

    for (const id of messageIds) {
      await prisma.messageRead.upsert({
        where: { messageId_userId: { messageId: id, userId } },
        update: { readAt: new Date() },
        create: { messageId: id, userId },
      });
    }

    const updatedMessages = await prisma.message.findMany({
      where: { id: { in: messageIds } },
      include: {
        author: true,
        reactions: { include: { user: true } },
        reads: { include: { user: true } },
      },
    });

    updatedMessages.forEach((message) => {
      const payload = JSON.stringify({
        type: 'message:read',
        payload: { message },
      });
      wss.clients.forEach((client) => {
        if ((client as any).readyState !== 1) return;
        if ((client as any).roomId === message.conversationId) {
          client.send(payload);
        }
      });
    });

    res.json({ success: true, messageIds });
  } catch (e: any) {
    res
      .status(400)
      .json({ error: e?.message ?? 'failed to mark messages as read' });
  }
});

// Reactions
app.post('/messages/:id/reactions', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const messageId = req.params.id;
    const { emoji } = req.body as { emoji?: string };
    if (!emoji) {
      return res.status(400).json({ error: 'emoji required' });
    }
    const userId = req.userId!;
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
          reads: { include: { user: true } },
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
          reads: { include: { user: true } },
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

// Track online users per conversation
const onlineUsers = new Map<string, Set<string>>(); // conversationId -> Set<userId>

function broadcastOnlineUsers(conversationId: string) {
  const userIds = Array.from(onlineUsers.get(conversationId) || []);
  const payload = JSON.stringify({
    type: 'users:online',
    payload: { conversationId, userIds },
  });
  wss.clients.forEach((client) => {
    if ((client as any).readyState !== 1) return;
    if ((client as any).roomId === conversationId) {
      client.send(payload);
    }
  });
}

wss.on('connection', (ws) => {
  (ws as any).roomId = null as string | null;
  (ws as any).userId = null as string | null;
  ws.send(JSON.stringify({ type: 'welcome', payload: 'connected' }));
  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw.toString());
      if (data?.type === 'join' && typeof data?.conversationId === 'string') {
        const oldRoomId = (ws as any).roomId;
        const oldUserId = (ws as any).userId;
        (ws as any).roomId = data.conversationId;
        if (data.userId) (ws as any).userId = data.userId;
        // Remove from old room
        if (oldRoomId && oldUserId) {
          const oldRoomUsers = onlineUsers.get(oldRoomId);
          if (oldRoomUsers) {
            oldRoomUsers.delete(oldUserId);
            if (oldRoomUsers.size === 0) {
              onlineUsers.delete(oldRoomId);
            } else {
              broadcastOnlineUsers(oldRoomId);
            }
          }
        }
        // Add to new room
        if (data.userId && data.conversationId) {
          if (!onlineUsers.has(data.conversationId)) {
            onlineUsers.set(data.conversationId, new Set());
          }
          onlineUsers.get(data.conversationId)!.add(data.userId);
          // Send current online users to the newly joined user
          const currentOnline = Array.from(onlineUsers.get(data.conversationId) || []);
          ws.send(JSON.stringify({ 
            type: 'users:online', 
            payload: { conversationId: data.conversationId, userIds: currentOnline } 
          }));
          // Broadcast updated list to all other users in the room
          broadcastOnlineUsers(data.conversationId);
        }
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
  ws.on('close', () => {
    const roomId = (ws as any).roomId;
    const userId = (ws as any).userId;
    if (roomId && userId) {
      const roomUsers = onlineUsers.get(roomId);
      if (roomUsers) {
        roomUsers.delete(userId);
        if (roomUsers.size === 0) {
          onlineUsers.delete(roomId);
        } else {
          broadcastOnlineUsers(roomId);
        }
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`server listening on http://localhost:${PORT}`);
});

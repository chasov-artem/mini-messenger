"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "@/store";
import { setUser, clearUser, toggleTheme } from "@/store";
import EmojiPickerButton from "@/components/EmojiPickerButton";
import { getToken, setToken, removeToken, getAuthHeaders } from "@/utils/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// Debug: log API_BASE in browser console
if (typeof window !== "undefined") {
  console.log("🔍 API_BASE:", API_BASE);
  console.log("🔍 NEXT_PUBLIC_API_URL:", process.env.NEXT_PUBLIC_API_URL);
  if (!process.env.NEXT_PUBLIC_API_URL) {
    console.warn(
      "⚠️ NEXT_PUBLIC_API_URL не встановлено! Використовується fallback:",
      API_BASE,
    );
  }
}

type Reaction = {
  id: string;
  emoji: string;
  userId: string;
  user?: { id: string; username: string };
};

type MessageRead = {
  id: string;
  userId: string;
  readAt: string;
  user?: { id: string; username: string };
};

type Message = {
  id: string;
  text: string;
  authorId: string;
  conversationId: string;
  createdAt: string;
  author?: { id: string; username: string };
  reactions?: Reaction[];
  reads?: MessageRead[];
};

type Conversation = {
  id: string;
  title: string;
  createdAt: string;
  userRole?: string; // Role of current user in this conversation
};

export default function Home() {
  const dispatch = useDispatch();
  const user = useSelector((s: RootState) => s.user);
  const theme = useSelector((s: RootState) => s.theme.mode);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [joinId, setJoinId] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [typingUsers, setTypingUsers] = useState<
    Record<string, { username: string; timestamp: number }>
  >({});
  const [searchQuery, setSearchQuery] = useState("");
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [conversationMembers, setConversationMembers] = useState<
    Array<{ id: string; username: string; role?: string }>
  >([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [newMemberUsername, setNewMemberUsername] = useState("");
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [joinDialogId, setJoinDialogId] = useState("");
  const [copiedId, setCopiedId] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [messagesOffset, setMessagesOffset] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const markMessagesAsRead = useCallback(
    (messageList: Message[]) => {
      if (!user.id || !conversationId) return;
      const unreadIds = messageList
        .filter((m) => m.authorId !== user.id)
        .filter((m) => !(m.reads || []).some((r) => r.userId === user.id))
        .map((m) => m.id);
      if (unreadIds.length === 0) return;

      fetch(`${API_BASE}/messages/read`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ messageIds: unreadIds }),
      }).catch(() => {
        // ignore errors for now
      });
    },
    [user.id, conversationId],
  );

  // Load more messages (older ones)
  const loadMoreMessages = useCallback(async () => {
    if (!conversationId || isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    const newOffset = messagesOffset + 50;

    try {
      const res = await fetch(
        `${API_BASE}/messages?conversationId=${conversationId}&limit=50&offset=${newOffset}`,
        { headers: getAuthHeaders() },
      );
      if (!res.ok) throw new Error("Failed to load messages");

      const data = await res.json();
      if (data.messages && Array.isArray(data.messages)) {
        // Save scroll position before adding new messages
        const container = messagesContainerRef.current;
        const scrollHeight = container?.scrollHeight || 0;
        const scrollTop = container?.scrollTop || 0;

        setMessages((prev) => {
          // Merge old messages with new ones, avoiding duplicates
          const existingIds = new Set(prev.map((m) => m.id));
          const newMessages = data.messages.filter(
            (m: Message) => !existingIds.has(m.id),
          );
          return [...newMessages, ...prev];
        });

        setMessagesOffset(newOffset);
        setHasMore(data.pagination?.hasMore ?? false);

        // Restore scroll position after a short delay
        setTimeout(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight;
            container.scrollTop = newScrollHeight - scrollHeight + scrollTop;
          }
        }, 0);
      }
    } catch (error) {
      console.error("Failed to load more messages:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [conversationId, isLoadingMore, hasMore, messagesOffset]);

  useEffect(() => {
    if (!conversationId) return;

    // Reset pagination state
    setMessages([]);
    setMessagesOffset(0);
    setHasMore(true);

    // initial history load
    fetch(
      `${API_BASE}/messages?conversationId=${conversationId}&limit=50&offset=0`,
      { headers: getAuthHeaders() },
    )
      .then((r) => {
        if (!r.ok) {
          return r.json().then((err) => {
            throw new Error(err?.error || "Failed to load messages");
          });
        }
        return r.json();
      })
      .then(
        (data: { messages?: Message[]; pagination?: { hasMore: boolean } }) => {
          if (data.messages && Array.isArray(data.messages)) {
            setMessages(data.messages);
            markMessagesAsRead(data.messages);
            setHasMore(data.pagination?.hasMore ?? false);
            // Scroll to bottom after initial load
            setTimeout(() => {
              messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 100);
          } else {
            setMessages([]);
          }
        },
      )
      .catch(() => {
        setMessages([]);
      });
    // load conversation members
    fetch(`${API_BASE}/conversations/${conversationId}/members`, {
      headers: getAuthHeaders(),
    })
      .then((r) => r.json())
      .then((data: Array<{ id: string; username: string; role?: string }>) => {
        setConversationMembers(data);
        // Find current user's role
        const currentUserMember = data.find((m) => m.id === user.id);
        const role = currentUserMember?.role || null;
        setUserRole(role);
        // Update role in conversations list
        setConversations((prev) => {
          if (!Array.isArray(prev)) return [];
          return prev.map((c) =>
            c.id === conversationId ? { ...c, userRole: role || undefined } : c,
          );
        });
      })
      .catch(() => {});
    // load conversation details to get title
    if (user.id) {
      fetch(`${API_BASE}/conversations`, {
        headers: getAuthHeaders(),
      })
        .then((r) => {
          if (!r.ok) return null;
          return r.json();
        })
        .then((data: Conversation[] | null) => {
          if (!data || !Array.isArray(data)) return;
          const current = data.find((c) => c.id === conversationId);
          if (current) {
            setConversations((prev) => {
              if (!Array.isArray(prev)) return [current];
              const exists = prev.some((c) => c.id === current.id);
              if (exists) {
                return prev.map((c) => (c.id === current.id ? current : c));
              }
              return [...prev, current];
            });
          }
        })
        .catch(() => {});
    }

    const wsUrl =
      process.env.NEXT_PUBLIC_WS_URL ||
      API_BASE.replace(/^http/, "ws").replace(/^https/, "wss");
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: "join",
          conversationId,
          userId: user.id,
        }),
      );
    };
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data?.type === "message:new") {
          const incoming = data.payload as Message;
          setMessages((prev) => {
            if (!Array.isArray(prev)) return [incoming];
            if (prev.some((m) => m.id === incoming.id)) return prev;
            return [...prev, incoming];
          });
          if (incoming.authorId !== user.id) {
            markMessagesAsRead([incoming]);
          }
          // Auto-scroll to bottom if user is near bottom (within 100px)
          const container = messagesContainerRef.current;
          if (container) {
            const isNearBottom =
              container.scrollHeight -
                container.scrollTop -
                container.clientHeight <
              100;
            if (isNearBottom) {
              setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
              }, 100);
            }
          }
        } else if (data?.type === "message:updated") {
          const updated = data.payload as Message;
          setMessages((prev) => {
            if (!Array.isArray(prev)) return [updated];
            return prev.map((m) => (m.id === updated.id ? updated : m));
          });
        } else if (data?.type === "message:deleted") {
          const { id } = data.payload as { id: string };
          setMessages((prev) => {
            if (!Array.isArray(prev)) return [];
            return prev.filter((m) => m.id !== id);
          });
        } else if (data?.type === "typing") {
          const { userId, username } = data.payload as {
            userId: string;
            username: string;
          };
          setTypingUsers((prev) => ({
            ...prev,
            [userId]: { username, timestamp: Date.now() },
          }));
        } else if (
          data?.type === "reaction:added" ||
          data?.type === "reaction:removed"
        ) {
          const { message } = data.payload as { message: Message };
          setMessages((prev) => {
            if (!Array.isArray(prev)) return [message];
            return prev.map((m) => (m.id === message.id ? message : m));
          });
        } else if (data?.type === "message:read") {
          const { message } = data.payload as { message: Message };
          setMessages((prev) => {
            if (!Array.isArray(prev)) return [message];
            return prev.map((m) => (m.id === message.id ? message : m));
          });
        } else if (data?.type === "users:online") {
          const { userIds } = data.payload as { userIds: string[] };
          setOnlineUserIds(new Set(userIds));
        } else if (data?.type === "conversation:updated") {
          const updated = data.payload as Conversation;
          setConversations((prev) => {
            if (!Array.isArray(prev)) return [];
            return prev.map((c) => (c.id === updated.id ? updated : c));
          });
        } else if (data?.type === "conversation:member-added") {
          const { members } = data.payload as {
            members: Array<{ id: string; username: string; role?: string }>;
          };
          setConversationMembers(members);
          // Update user role if current user
          const currentUserMember = members.find((m) => m.id === user.id);
          if (currentUserMember) {
            setUserRole(currentUserMember.role || null);
            // Update role in conversations list
            setConversations((prev) => {
              if (!Array.isArray(prev)) return [];
              return prev.map((c) =>
                c.id === conversationId
                  ? { ...c, userRole: currentUserMember.role || undefined }
                  : c,
              );
            });
          }
          // Reload conversations list to show updated member count
          if (user.id) void loadConversations();
        } else if (data?.type === "conversation:member-removed") {
          const { members, userId: removedUserId } = data.payload as {
            members: Array<{ id: string; username: string; role?: string }>;
            userId: string;
          };
          setConversationMembers(members);
          // Update user role if current user
          const currentUserMember = members.find((m) => m.id === user.id);
          setUserRole(currentUserMember?.role || null);
          // If current user was removed, close the conversation
          if (removedUserId === user.id) {
            setConversationId(null);
            setMessages([]);
            setConversationMembers([]);
            setUserRole(null);
          }
          // Reload conversations list
          if (user.id) void loadConversations();
        } else if (data?.type === "conversation:member-left") {
          const { members, userId: leftUserId } = data.payload as {
            members: Array<{ id: string; username: string; role?: string }>;
            userId: string;
          };
          setConversationMembers(members);
          // Update user role if current user
          const currentUserMember = members.find((m) => m.id === user.id);
          setUserRole(currentUserMember?.role || null);
          // If current user left, close the conversation
          if (leftUserId === user.id) {
            setConversationId(null);
            setMessages([]);
            setConversationMembers([]);
            setUserRole(null);
          }
          // Reload conversations list
          if (user.id) void loadConversations();
        } else if (data?.type === "conversation:deleted") {
          const { conversationId: deletedId } = data.payload as {
            conversationId: string;
          };
          // Remove from conversations list
          setConversations((prev) => {
            if (!Array.isArray(prev)) return [];
            return prev.filter((c) => c.id !== deletedId);
          });
          // If current conversation was deleted, close it
          if (conversationId === deletedId) {
            setConversationId(null);
            setMessages([]);
            setConversationMembers([]);
          }
        }
      } catch {}
    };
    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [conversationId, user.id, markMessagesAsRead]);

  // Best-effort: if socket is already open when conversationId changes, (re)send join
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || !conversationId || !user.id) return;
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: "join",
          conversationId,
          userId: user.id,
        }),
      );
    }
  }, [conversationId, user.id]);

  // Check authentication on mount
  useEffect(() => {
    async function checkAuth() {
      const token = getToken();
      if (!token) {
        setIsLoadingAuth(false);
        setIsAuthenticated(false);
        setConversations([]);
        return;
      }
      
      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const userData = await res.json();
          dispatch(setUser({ id: userData.id, username: userData.username }));
          setIsAuthenticated(true);
          // Load conversations after setting user
          try {
            const r = await fetch(`${API_BASE}/conversations`, {
              headers: getAuthHeaders(),
            });
            if (r.ok) {
              const conversationsData = await r.json();
              setConversations(Array.isArray(conversationsData) ? conversationsData : []);
            } else {
              setConversations([]);
            }
          } catch (err) {
            console.error("Failed to load conversations:", err);
            setConversations([]);
          }
        } else {
          // Token invalid, remove it
          removeToken();
          setIsAuthenticated(false);
          setConversations([]);
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        removeToken();
        setIsAuthenticated(false);
        setConversations([]);
      } finally {
        setIsLoadingAuth(false);
      }
    }
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRegister() {
    if (!usernameInput.trim() || !passwordInput.trim()) {
      alert("Username and password are required");
      return;
    }
    if (usernameInput.trim().length < 3) {
      alert("Username must be at least 3 characters");
      return;
    }
    if (passwordInput.length < 6) {
      alert("Password must be at least 6 characters");
      return;
    }
    
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: usernameInput.trim(),
          password: passwordInput,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.token);
        dispatch(setUser({ id: data.user.id, username: data.user.username }));
        setIsAuthenticated(true);
        setUsernameInput("");
        setPasswordInput("");
        void loadConversations(data.user.id);
      } else {
        alert(data?.error ?? "Failed to register");
      }
    } catch (error) {
      console.error("Registration failed:", error);
      alert("Failed to register. Please try again.");
    }
  }

  async function handleLogin() {
    if (!usernameInput.trim() || !passwordInput.trim()) {
      alert("Username and password are required");
      return;
    }
    
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: usernameInput.trim(),
          password: passwordInput,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.token);
        dispatch(setUser({ id: data.user.id, username: data.user.username }));
        setIsAuthenticated(true);
        setUsernameInput("");
        setPasswordInput("");
        void loadConversations(data.user.id);
      } else {
        alert(data?.error ?? "Failed to login");
      }
    } catch (error) {
      console.error("Login failed:", error);
      alert("Failed to login. Please try again.");
    }
  }

  function handleLogout() {
    removeToken();
    dispatch(clearUser());
    setIsAuthenticated(false);
    setConversationId(null);
    setMessages([]);
    setConversations([]);
    wsRef.current?.close();
  }

  async function handleCreateConversation() {
    if (!user.id) return;
    const res = await fetch(`${API_BASE}/conversations`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        title: "General",
        memberUserIds: [],
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setConversationId(data.id as string);
      setMessages([]);
      setOnlineUserIds(new Set());
      setConversationMembers([]);
      setConversations((prev) => {
        const newConv = {
          id: data.id as string,
          title: data.title as string,
          createdAt: data.createdAt as string,
          userRole: "owner", // Creator is always owner
        };
        if (!Array.isArray(prev)) return [newConv];
        return [newConv, ...prev];
      });
    } else {
      alert(data?.error ?? "Failed to create conversation");
    }
  }

  function handleJoinConversation() {
    if (!joinId.trim()) return;
    setConversationId(joinId.trim());
    setMessages([]);
    setOnlineUserIds(new Set());
    setConversationMembers([]);
  }

  async function loadConversations(explicitUserId?: string) {
    const uid = explicitUserId ?? user.id;
    if (!uid) return;
    try {
      setIsLoadingConversations(true);
      const r = await fetch(`${API_BASE}/conversations`, {
        headers: getAuthHeaders(),
      });
      if (r.ok) {
        const data = (await r.json()) as Conversation[];
        setConversations(Array.isArray(data) ? data : []);
      } else {
        setConversations([]);
      }
    } catch {
      setConversations([]);
    } finally {
      setIsLoadingConversations(false);
    }
  }

  useEffect(() => {
    if (user.id) void loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  // Clean up old typing indicators
  useEffect(() => {
    const interval = setInterval(() => {
      setTypingUsers((prev) => {
        const now = Date.now();
        const updated = { ...prev };
        let changed = false;
        for (const [userId, data] of Object.entries(updated)) {
          if (now - data.timestamp >= 3000) {
            delete updated[userId];
            changed = true;
          }
        }
        return changed ? updated : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  function sendTypingIndicator() {
    const ws = wsRef.current;
    if (!ws || !conversationId || !user.id || ws.readyState !== WebSocket.OPEN)
      return;
    ws.send(
      JSON.stringify({
        type: "typing",
        userId: user.id,
        username: user.username,
        conversationId,
      }),
    );
  }

  function handleTextChange(newText: string) {
    setText(newText);
    if (newText.trim() && conversationId && user.id) {
      if (typingDebounceRef.current) {
        clearTimeout(typingDebounceRef.current);
      }
      typingDebounceRef.current = setTimeout(() => {
        sendTypingIndicator();
      }, 500);
    }
  }

  async function handleSend() {
    if (!user.id || !conversationId || !text.trim()) return;
    const body = { conversationId, text: text.trim() };
    setText("");
    const res = await fetch(`${API_BASE}/messages`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
    });
    try {
      const created = (await res.json()) as Message;
      if (!created || typeof created !== "object" || !("id" in created)) {
        return;
      }
      setMessages((prev) => {
        if (!Array.isArray(prev)) {
          return [created];
        }
        if (prev.some((m) => m.id === created.id)) {
          return prev;
        }
        return [...prev, created];
      });
      // Scroll to bottom after sending
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch {
      // WebSocket все одно може доставити повідомлення
    }
  }

  async function handleEdit(messageId: string) {
    if (!user.id || !editText.trim()) return;
    const res = await fetch(`${API_BASE}/messages/${messageId}`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify({ text: editText.trim() }),
    });
    if (res.ok) {
      setEditingMessageId(null);
      setEditText("");
    } else {
      const data = await res.json();
      alert(data?.error ?? "Failed to edit message");
    }
  }

  async function handleDelete(messageId: string) {
    if (!user.id || !confirm("Delete this message?")) return;
    const res = await fetch(`${API_BASE}/messages/${messageId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data?.error ?? "Failed to delete message");
    }
  }

  async function handleToggleReaction(messageId: string, emoji: string) {
    if (!user.id) return;
    await fetch(`${API_BASE}/messages/${messageId}/reactions`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ emoji }),
    });
  }

  async function handleUpdateTitle() {
    if (!conversationId || !newTitle.trim() || !user.id) return;
    const res = await fetch(`${API_BASE}/conversations/${conversationId}`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify({ title: newTitle.trim() }),
    });
    if (res.ok) {
      setEditingTitle(false);
      setNewTitle("");
    } else {
      const data = await res.json();
      alert(data?.error ?? "Failed to update title");
    }
  }

  async function handleAddMember() {
    if (!conversationId || !newMemberUsername.trim()) return;
    const res = await fetch(
      `${API_BASE}/conversations/${conversationId}/members`,
      {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ username: newMemberUsername.trim() }),
      },
    );
    if (res.ok) {
      setAddingMember(false);
      setNewMemberUsername("");
    } else {
      const data = await res.json();
      alert(data?.error ?? "Failed to add member");
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (
      !conversationId ||
      !confirm("Remove this member from the conversation?")
    )
      return;
    const res = await fetch(
      `${API_BASE}/conversations/${conversationId}/members/${memberId}`,
      {
        method: "DELETE",
        headers: getAuthHeaders(),
      },
    );
    if (!res.ok) {
      const data = await res.json();
      alert(data?.error ?? "Failed to remove member");
    }
  }

  async function handleDeleteConversation(convId: string) {
    if (
      !confirm(
        "Delete this conversation? All messages will be permanently deleted.",
      )
    )
      return;
    const res = await fetch(`${API_BASE}/conversations/${convId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      // If deleted conversation was the current one, close it
      if (conversationId === convId) {
        setConversationId(null);
        setMessages([]);
        setConversationMembers([]);
        setUserRole(null);
      }
      // Remove from conversations list
      setConversations((prev) => {
        if (!Array.isArray(prev)) return [];
        return prev.filter((c) => c.id !== convId);
      });
    } else {
      const data = await res.json();
      alert(data?.error ?? "Failed to delete conversation");
    }
  }

  async function handleLeaveConversation(convId: string) {
    if (
      !confirm(
        "Leave this conversation? You can rejoin later using the conversation ID.",
      )
    )
      return;
    const res = await fetch(`${API_BASE}/conversations/${convId}/leave`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      // If left conversation was the current one, close it
      if (conversationId === convId) {
        setConversationId(null);
        setMessages([]);
        setConversationMembers([]);
        setUserRole(null);
      }
      // Remove from conversations list
      setConversations((prev) => {
        if (!Array.isArray(prev)) return [];
        return prev.filter((c) => c.id !== convId);
      });
    } else {
      const data = await res.json();
      alert(data?.error ?? "Failed to leave conversation");
    }
  }

  function formatTime(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // Helper function to get initials for avatar
  const getInitials = (username: string | null | undefined) => {
    if (!username) return "?";
    return username
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Helper function to get avatar color
  const getAvatarColor = (username: string | null | undefined) => {
    if (!username) return "bg-gray-500";
    const colors = [
      "bg-blue-500",
      "bg-green-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-indigo-500",
      "bg-yellow-500",
      "bg-red-500",
      "bg-teal-500",
    ];
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-[#0f0f0f]">
      {/* Sidebar */}
      {user.id && (
        <aside className="w-64 bg-white dark:bg-[#171717] border-r border-gray-200 dark:border-gray-800 flex flex-col h-screen sticky top-0">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              Mini Messenger
            </h1>
            <button
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              onClick={() => {
                dispatch(toggleTheme());
              }}
              title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            >
              {theme === "light" ? "🌙" : "☀️"}
            </button>
          </div>

          {/* User Info */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-full ${getAvatarColor(
                  user.username,
                )} flex items-center justify-center text-white text-xs font-semibold`}
              >
                {getInitials(user.username)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {user.username}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Online
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <button
              className="w-full bg-gray-900 dark:bg-gray-800 text-white px-4 py-2.5 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-700 transition-colors font-medium text-sm flex items-center justify-center gap-2"
              onClick={handleCreateConversation}
            >
              <span>+</span>
              <span>New conversation</span>
            </button>

            <div className="space-y-2">
              <div className="flex items-center justify-between px-2">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Conversations
                </span>
                <button
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  onClick={() => loadConversations()}
                  disabled={isLoadingConversations}
                >
                  {isLoadingConversations ? "…" : "↻"}
                </button>
              </div>
              <ul className="space-y-1">
                {!Array.isArray(conversations) || conversations.length === 0 ? (
                  <li className="px-2 py-3 text-sm text-gray-400 dark:text-gray-500 text-center">
                    No conversations
                  </li>
                ) : (
                  conversations.map((c) => (
                    <li key={c.id} className="group">
                      <div className="flex items-center">
                        <button
                          className={`px-3 py-2.5 flex-1 text-left text-sm rounded-lg transition-colors ${
                            conversationId === c.id
                              ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
                              : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                          }`}
                          onClick={() => {
                            setConversationId(c.id);
                            setMessages([]);
                            setOnlineUserIds(new Set());
                            setConversationMembers([]);
                          }}
                        >
                          <div className="font-medium truncate">{c.title}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate mt-0.5">
                            {c.id.slice(0, 8)}...
                          </div>
                        </button>
                        {c.userRole === "owner" ? (
                          <button
                            className="px-2 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-opacity rounded"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteConversation(c.id);
                            }}
                            title="Delete conversation"
                          >
                            🗑️
                          </button>
                        ) : (
                          <button
                            className="px-2 py-2 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 opacity-0 group-hover:opacity-100 transition-opacity rounded"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLeaveConversation(c.id);
                            }}
                            title="Leave conversation"
                          >
                            🚪
                          </button>
                        )}
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>

            {conversationId && (
              <div className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between px-2">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Members
                  </span>
                  <button
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    onClick={() => setAddingMember(true)}
                  >
                    + Add
                  </button>
                </div>
                {addingMember && (
                  <div className="px-2 py-2 space-y-2">
                    <input
                      type="text"
                      className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter username..."
                      value={newMemberUsername}
                      onChange={(e) => setNewMemberUsername(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleAddMember();
                        } else if (e.key === "Escape") {
                          setAddingMember(false);
                          setNewMemberUsername("");
                        }
                      }}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        className="flex-1 text-xs px-3 py-1.5 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                        onClick={handleAddMember}
                      >
                        Add
                      </button>
                      <button
                        className="flex-1 text-xs px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                        onClick={() => {
                          setAddingMember(false);
                          setNewMemberUsername("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                {conversationMembers.length > 0 && (
                  <ul className="space-y-1">
                    {conversationMembers.map((member) => {
                      const isOnline = onlineUserIds.has(member.id);
                      const isOwn = member.id === user.id;
                      return (
                        <li
                          key={member.id}
                          className="px-3 py-2 text-sm flex items-center justify-between group rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        >
                          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <div
                              className={`w-6 h-6 rounded-full ${getAvatarColor(
                                member.username,
                              )} flex items-center justify-center text-white text-xs font-semibold`}
                            >
                              {getInitials(member.username)}
                            </div>
                            <span className="font-medium">
                              {member.username}
                            </span>
                            {isOwn && (
                              <span className="text-xs text-gray-400 dark:text-gray-500">
                                (You)
                              </span>
                            )}
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isOnline
                                  ? "bg-green-500 animate-pulse"
                                  : "bg-gray-300 dark:bg-gray-600"
                              }`}
                              title={isOnline ? "Online" : "Offline"}
                            />
                          </div>
                          {!isOwn && (
                            <button
                              className="text-xs text-red-600 dark:text-red-400 hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleRemoveMember(member.id)}
                              title="Remove member"
                            >
                              Remove
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
              <button
                className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen">
        {isLoadingAuth ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <div className="text-gray-500 dark:text-gray-400">Loading...</div>
            </div>
          </div>
        ) : !isAuthenticated ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="max-w-md w-full space-y-6">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white text-center">
                Welcome to Mini Messenger
              </h2>
              
              {/* Auth Mode Toggle */}
              <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
                <button
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    authMode === "login"
                      ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
                  onClick={() => setAuthMode("login")}
                >
                  Login
                </button>
                <button
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    authMode === "register"
                      ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
                  onClick={() => setAuthMode("register")}
                >
                  Register
                </button>
              </div>

              {/* Auth Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    className="w-full border rounded-lg px-4 py-3 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter username"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        authMode === "login" ? handleLogin() : handleRegister();
                      }
                    }}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    className="w-full border rounded-lg px-4 py-3 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        authMode === "login" ? handleLogin() : handleRegister();
                      }
                    }}
                  />
                </div>
                <button
                  className="w-full bg-blue-600 dark:bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors font-medium"
                  onClick={authMode === "login" ? handleLogin : handleRegister}
                >
                  {authMode === "login" ? "Login" : "Register"}
                </button>
              </div>
            </div>
          </div>
        ) : !conversationId ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center space-y-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Select a conversation or create a new one
              </h2>
              <div className="flex gap-2 justify-center">
                <input
                  className="border rounded-lg px-4 py-2 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Paste conversation ID"
                  value={joinId}
                  onChange={(e) => setJoinId(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleJoinConversation();
                    }
                  }}
                />
                <button
                  className="bg-gray-900 dark:bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
                  onClick={handleJoinConversation}
                >
                  Join
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col h-screen bg-white dark:bg-[#0f0f0f]">
            {/* Chat Header */}
            <div className="border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between bg-white dark:bg-[#171717]">
              <div className="flex items-center gap-3">
                {editingTitle ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      className="flex-1 border rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Conversation title..."
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleUpdateTitle();
                        } else if (e.key === "Escape") {
                          setEditingTitle(false);
                          setNewTitle("");
                        }
                      }}
                      autoFocus
                    />
                    <button
                      className="px-3 py-1.5 text-sm bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                      onClick={handleUpdateTitle}
                    >
                      Save
                    </button>
                    <button
                      className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                      onClick={() => {
                        setEditingTitle(false);
                        setNewTitle("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col flex-1">
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {conversations.find((c) => c.id === conversationId)
                            ?.title || "Conversation"}
                        </h2>
                        {userRole === "owner" && (
                          <button
                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                            onClick={() => {
                              const current = conversations.find(
                                (c) => c.id === conversationId,
                              );
                              if (current) {
                                setNewTitle(current.title);
                                setEditingTitle(true);
                              }
                            }}
                            title="Edit title"
                          >
                            ✏️
                          </button>
                        )}
                      </div>
                      {conversationId && (
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                            ID: {conversationId}
                          </span>
                          <button
                            className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                            onClick={() => {
                              navigator.clipboard.writeText(conversationId);
                              setCopiedId(true);
                              setTimeout(() => setCopiedId(false), 2000);
                            }}
                            title="Copy conversation ID"
                          >
                            {copiedId ? (
                              <span className="text-xs text-green-600 dark:text-green-400">
                                ✓ Copied
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400 dark:text-gray-500">
                                📋
                              </span>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  onClick={() => setShowJoinDialog(true)}
                  title="Join another chat"
                >
                  + Join Chat
                </button>
                <input
                  type="text"
                  className="border rounded-lg px-3 py-1.5 text-sm w-40 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Search messages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Join Chat Dialog */}
            {showJoinDialog && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Join Chat by ID
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Conversation ID
                      </label>
                      <input
                        type="text"
                        className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                        placeholder="Paste conversation ID here..."
                        value={joinDialogId}
                        onChange={(e) => setJoinDialogId(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            if (joinDialogId.trim()) {
                              setConversationId(joinDialogId.trim());
                              setJoinDialogId("");
                              setShowJoinDialog(false);
                            }
                          } else if (e.key === "Escape") {
                            setShowJoinDialog(false);
                            setJoinDialogId("");
                          }
                        }}
                        autoFocus
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                        onClick={() => {
                          setShowJoinDialog(false);
                          setJoinDialogId("");
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        className="px-4 py-2 text-sm bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => {
                          if (joinDialogId.trim()) {
                            setConversationId(joinDialogId.trim());
                            setJoinDialogId("");
                            setShowJoinDialog(false);
                          }
                        }}
                        disabled={!joinDialogId.trim()}
                      >
                        Join
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-hidden flex flex-col bg-gray-50 dark:bg-[#0f0f0f]">
              <div
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto px-6 py-4"
                onScroll={(e) => {
                  const target = e.currentTarget;
                  // Load more when scrolled to top (within 50px)
                  if (target.scrollTop < 50 && hasMore && !isLoadingMore) {
                    loadMoreMessages();
                  }
                }}
              >
                {(() => {
                  const messagesArray = Array.isArray(messages) ? messages : [];
                  return messagesArray.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center text-gray-400 dark:text-gray-500">
                        <p className="text-lg mb-2">No messages yet</p>
                        <p className="text-sm">Start the conversation!</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {isLoadingMore && (
                        <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
                          Loading older messages...
                        </div>
                      )}
                      {!hasMore && messagesArray.length > 0 && (
                        <div className="text-center py-2 text-xs text-gray-400 dark:text-gray-500">
                          No more messages
                        </div>
                      )}
                      <div className="max-w-3xl mx-auto space-y-6">
                        {messagesArray
                          .filter((m) =>
                            searchQuery
                              ? m.text
                                  .toLowerCase()
                                  .includes(searchQuery.toLowerCase())
                              : true,
                          )
                          .map((m) => {
                            const isOwn = m.authorId === user.id;
                            const isEditing = editingMessageId === m.id;
                            const readers =
                              m.reads?.filter(
                                (read) => read.userId !== m.authorId,
                              ) || [];
                            const hasReadByOthers = readers.length > 0;
                            return (
                              <div
                                key={m.id}
                                className={`flex gap-4 group ${
                                  isOwn ? "flex-row-reverse" : ""
                                }`}
                              >
                                {/* Avatar */}
                                {!isOwn && (
                                  <div
                                    className={`w-8 h-8 rounded-full ${getAvatarColor(
                                      m.author?.username ?? m.authorId,
                                    )} flex items-center justify-center text-white text-xs font-semibold flex-shrink-0`}
                                  >
                                    {getInitials(
                                      m.author?.username ?? m.authorId,
                                    )}
                                  </div>
                                )}
                                {isOwn && (
                                  <div
                                    className={`w-8 h-8 rounded-full ${getAvatarColor(
                                      user.username,
                                    )} flex items-center justify-center text-white text-xs font-semibold flex-shrink-0`}
                                  >
                                    {getInitials(user.username)}
                                  </div>
                                )}

                                {/* Message Content */}
                                <div
                                  className={`flex-1 ${isOwn ? "flex flex-col items-end" : ""}`}
                                >
                                  {!isOwn && (
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                        {m.author?.username ?? m.authorId}
                                      </span>
                                      <span
                                        className={`w-2 h-2 rounded-full ${
                                          onlineUserIds.has(m.authorId)
                                            ? "bg-green-500"
                                            : "bg-gray-300 dark:bg-gray-600"
                                        }`}
                                        title={
                                          onlineUserIds.has(m.authorId)
                                            ? "Online"
                                            : "Offline"
                                        }
                                      />
                                      <span className="text-xs text-gray-500 dark:text-gray-400">
                                        {formatTime(m.createdAt)}
                                      </span>
                                    </div>
                                  )}
                                  <div
                                    className={`rounded-2xl px-4 py-2.5 max-w-[80%] ${
                                      isOwn
                                        ? "bg-blue-600 dark:bg-blue-500 text-white"
                                        : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
                                    } shadow-sm`}
                                  >
                                    {isEditing ? (
                                      <div className="space-y-2">
                                        <input
                                          className="w-full px-2 py-1 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-sm border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                          value={editText}
                                          onChange={(e) =>
                                            setEditText(e.target.value)
                                          }
                                          onKeyDown={(e) => {
                                            if (
                                              e.key === "Enter" &&
                                              !e.shiftKey
                                            ) {
                                              e.preventDefault();
                                              handleEdit(m.id);
                                            }
                                            if (e.key === "Escape") {
                                              setEditingMessageId(null);
                                              setEditText("");
                                            }
                                          }}
                                          autoFocus
                                        />
                                        <div className="flex gap-2">
                                          <button
                                            className="text-xs px-3 py-1 bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-500 transition-colors"
                                            onClick={() => handleEdit(m.id)}
                                          >
                                            Save
                                          </button>
                                          <button
                                            className="text-xs px-3 py-1 bg-gray-200 dark:bg-gray-500 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-400 transition-colors"
                                            onClick={() => {
                                              setEditingMessageId(null);
                                              setEditText("");
                                            }}
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                                          {m.text}
                                        </div>
                                        {m.reactions &&
                                          m.reactions.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-white/20 dark:border-gray-700">
                                              {Object.entries(
                                                m.reactions.reduce(
                                                  (acc, r) => {
                                                    if (!acc[r.emoji]) {
                                                      acc[r.emoji] = [];
                                                    }
                                                    acc[r.emoji].push(r);
                                                    return acc;
                                                  },
                                                  {} as Record<
                                                    string,
                                                    Reaction[]
                                                  >,
                                                ),
                                              ).map(([emoji, reactions]) => {
                                                const hasUserReaction =
                                                  reactions.some(
                                                    (r) => r.userId === user.id,
                                                  );
                                                return (
                                                  <button
                                                    key={emoji}
                                                    className={`text-xs px-2 py-1 rounded-lg border transition-colors ${
                                                      hasUserReaction
                                                        ? isOwn
                                                          ? "bg-blue-500 dark:bg-blue-400 border-blue-400 dark:border-blue-300"
                                                          : "bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700"
                                                        : isOwn
                                                          ? "bg-blue-700 dark:bg-blue-600 border-blue-600 dark:border-blue-500"
                                                          : "bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                                                    } hover:opacity-80`}
                                                    onClick={() =>
                                                      handleToggleReaction(
                                                        m.id,
                                                        emoji,
                                                      )
                                                    }
                                                    title={reactions
                                                      .map(
                                                        (r) =>
                                                          r.user?.username ??
                                                          "Unknown",
                                                      )
                                                      .join(", ")}
                                                  >
                                                    {emoji} {reactions.length}
                                                  </button>
                                                );
                                              })}
                                            </div>
                                          )}
                                        {isOwn && (
                                          <div className="text-[10px] text-white/70 dark:text-gray-400 mt-1">
                                            {hasReadByOthers
                                              ? `Seen by ${readers
                                                  .map(
                                                    (r) =>
                                                      r.user?.username ??
                                                      "Unknown",
                                                  )
                                                  .join(", ")}`
                                              : "Not seen yet"}
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>
                                  {isOwn && !isEditing && (
                                    <div className="flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        className="text-xs px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
                                        onClick={() => {
                                          setEditingMessageId(m.id);
                                          setEditText(m.text);
                                        }}
                                        title="Edit"
                                      >
                                        ✏️
                                      </button>
                                      <button
                                        className="text-xs px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
                                        onClick={() => handleDelete(m.id)}
                                        title="Delete"
                                      >
                                        🗑️
                                      </button>
                                      <EmojiPickerButton
                                        onEmojiClick={(emoji) =>
                                          handleToggleReaction(m.id, emoji)
                                        }
                                      />
                                    </div>
                                  )}
                                  {!isOwn && !isEditing && (
                                    <div className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <EmojiPickerButton
                                        onEmojiClick={(emoji) =>
                                          handleToggleReaction(m.id, emoji)
                                        }
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                      <div ref={messagesEndRef} />
                      {Object.keys(typingUsers).length > 0 && (
                        <div className="text-sm text-gray-500 dark:text-gray-400 italic mt-4 px-4 text-center">
                          {Object.values(typingUsers)
                            .map((u) => u.username)
                            .join(", ")}{" "}
                          {Object.keys(typingUsers).length === 1 ? "is" : "are"}{" "}
                          typing...
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Input Area */}
              <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-[#171717] px-6 py-4">
                <div className="max-w-3xl mx-auto">
                  <div className="flex gap-3 items-center">
                    <EmojiPickerButton
                      onEmojiClick={(emoji) => {
                        // Get cursor position, using nullish coalescing to handle 0 correctly
                        // If textarea is not focused or selectionStart is null/undefined, use text.length
                        const textarea = textareaRef.current;
                        const isFocused = document.activeElement === textarea;
                        // Check if textarea is focused and selectionStart is available (not null/undefined)
                        // Use nullish coalescing (??) instead of || to correctly handle cursor position 0
                        const cursorPos =
                          isFocused && textarea?.selectionStart != null
                            ? textarea.selectionStart
                            : text.length;

                        const newText =
                          text.slice(0, cursorPos) +
                          emoji +
                          text.slice(cursorPos);
                        setText(newText);
                        handleTextChange(newText);
                        // Focus back to textarea and set cursor position after emoji
                        setTimeout(() => {
                          if (textareaRef.current) {
                            textareaRef.current.focus();
                            const newCursorPos = cursorPos + emoji.length;
                            textareaRef.current.setSelectionRange(
                              newCursorPos,
                              newCursorPos,
                            );
                          }
                        }, 0);
                      }}
                      className="text-xl hover:scale-110 transition-transform cursor-pointer"
                      title="Add emoji"
                      showQuickReactions={false}
                    />
                    <div className="flex-1 relative">
                      <textarea
                        ref={textareaRef}
                        className="w-full border rounded-xl px-4 py-2.5 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none max-h-32"
                        placeholder="Type a message..."
                        value={text}
                        onChange={(e) => {
                          handleTextChange(e.target.value);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                          }
                        }}
                        rows={1}
                      />
                    </div>
                    <button
                      className="px-6 py-2.5 bg-blue-600 dark:bg-blue-500 text-white rounded-xl hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed h-fit"
                      onClick={handleSend}
                      disabled={!text.trim()}
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

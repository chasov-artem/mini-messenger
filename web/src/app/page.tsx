"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "@/store";
import { setUser, clearUser, toggleTheme } from "@/store";
import EmojiPickerButton from "@/components/EmojiPickerButton";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

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
};

export default function Home() {
  const dispatch = useDispatch();
  const user = useSelector((s: RootState) => s.user);
  const theme = useSelector((s: RootState) => s.theme.mode);
  const [usernameInput, setUsernameInput] = useState("");
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
    Array<{ id: string; username: string }>
  >([]);
  const [editingTitle, setEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [newMemberUsername, setNewMemberUsername] = useState("");
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, messageIds: unreadIds }),
      }).catch(() => {
        // ignore errors for now
      });
    },
    [user.id, conversationId],
  );

  useEffect(() => {
    if (!conversationId) return;
    // initial history load
    fetch(`${API_BASE}/messages?conversationId=${conversationId}`)
      .then((r) => {
        if (!r.ok) {
          return r.json().then((err) => {
            throw new Error(err?.error || "Failed to load messages");
          });
        }
        return r.json();
      })
      .then((data: Message[]) => {
        if (Array.isArray(data)) {
          setMessages(data);
          markMessagesAsRead(data);
        } else {
          setMessages([]);
        }
      })
      .catch(() => {
        setMessages([]);
      });
    // load conversation members
    fetch(`${API_BASE}/conversations/${conversationId}/members`)
      .then((r) => r.json())
      .then((data: Array<{ id: string; username: string }>) =>
        setConversationMembers(data),
      )
      .catch(() => {});
    // load conversation details to get title
    if (user.id) {
      fetch(`${API_BASE}/conversations?userId=${user.id}`)
        .then((r) => r.json())
        .then((data: Conversation[]) => {
          const current = data.find((c) => c.id === conversationId);
          if (current) {
            setConversations((prev) => {
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
          setConversations((prev) =>
            prev.map((c) => (c.id === updated.id ? updated : c)),
          );
        } else if (data?.type === "conversation:member-added") {
          const { members } = data.payload as {
            members: Array<{ id: string; username: string }>;
          };
          setConversationMembers(members);
          // Reload conversations list to show updated member count
          if (user.id) void loadConversations();
        } else if (data?.type === "conversation:member-removed") {
          const { members, userId: removedUserId } = data.payload as {
            members: Array<{ id: string; username: string }>;
            userId: string;
          };
          setConversationMembers(members);
          // If current user was removed, close the conversation
          if (removedUserId === user.id) {
            setConversationId(null);
            setMessages([]);
          }
          // Reload conversations list
          if (user.id) void loadConversations();
        } else if (data?.type === "conversation:deleted") {
          const { conversationId: deletedId } = data.payload as {
            conversationId: string;
          };
          // Remove from conversations list
          setConversations((prev) => prev.filter((c) => c.id !== deletedId));
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

  async function handleCreateUser() {
    if (!usernameInput.trim()) return;
    const res = await fetch(`${API_BASE}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: usernameInput.trim() }),
    });
    const data = await res.json();
    if (res.ok) {
      dispatch(setUser({ id: data.id, username: data.username }));
      void loadConversations(data.id as string);
    } else {
      alert(data?.error ?? "Failed to create user");
    }
  }

  async function handleCreateConversation() {
    if (!user.id) return;
    const res = await fetch(`${API_BASE}/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "General", memberUserIds: [user.id] }),
    });
    const data = await res.json();
    if (res.ok) {
      setConversationId(data.id as string);
      setMessages([]);
      setOnlineUserIds(new Set());
      setConversationMembers([]);
      setConversations((prev) => [
        {
          id: data.id as string,
          title: data.title as string,
          createdAt: data.createdAt as string,
        },
        ...prev,
      ]);
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
      const r = await fetch(`${API_BASE}/conversations?userId=${uid}`);
      const data = (await r.json()) as Conversation[];
      setConversations(data);
    } catch {
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
    const body = { conversationId, authorId: user.id, text: text.trim() };
    setText("");
    const res = await fetch(`${API_BASE}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    } catch {
      // WebSocket все одно може доставити повідомлення
    }
  }

  async function handleEdit(messageId: string) {
    if (!user.id || !editText.trim()) return;
    const res = await fetch(`${API_BASE}/messages/${messageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: editText.trim(), authorId: user.id }),
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authorId: user.id }),
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, emoji }),
    });
  }

  async function handleUpdateTitle() {
    if (!conversationId || !newTitle.trim()) return;
    const res = await fetch(`${API_BASE}/conversations/${conversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
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
        headers: { "Content-Type": "application/json" },
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
        headers: { "Content-Type": "application/json" },
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
      headers: { "Content-Type": "application/json" },
    });
    if (res.ok) {
      // If deleted conversation was the current one, close it
      if (conversationId === convId) {
        setConversationId(null);
        setMessages([]);
        setConversationMembers([]);
      }
      // Remove from conversations list
      setConversations((prev) => prev.filter((c) => c.id !== convId));
    } else {
      const data = await res.json();
      alert(data?.error ?? "Failed to delete conversation");
    }
  }

  function formatTime(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="min-h-screen p-6 sm:p-10 bg-white dark:bg-gray-900">
      <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-[260px_1fr]">
        <div className="flex items-center justify-between sm:col-span-2">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Mini Messenger
          </h1>
          <button
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            onClick={() => {
              dispatch(toggleTheme());
            }}
            title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            {theme === "light" ? "🌙" : "☀️"}
          </button>
        </div>

        {!user.id ? (
          <div className="flex gap-2 sm:col-span-2">
            <input
              className="border rounded px-3 py-2 w-full bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              placeholder="Enter username"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
            />
            <button
              className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700 dark:hover:bg-blue-600"
              onClick={handleCreateUser}
            >
              Continue
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between sm:col-span-2">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span>Signed in as</span>
              <span className="font-medium">{user.username}</span>
            </div>
            <button
              className="text-xs text-red-600 dark:text-red-400 hover:underline"
              onClick={() => {
                dispatch(clearUser());
                setConversationId(null);
                setMessages([]);
                setConversations([]);
                wsRef.current?.close();
              }}
            >
              Logout
            </button>
          </div>
        )}

        {user.id && (
          <aside className="space-y-3">
            <div className="flex gap-2">
              <button
                className="bg-emerald-600 dark:bg-emerald-500 text-white px-3 py-2 rounded w-full hover:bg-emerald-700 dark:hover:bg-emerald-600"
                onClick={handleCreateConversation}
              >
                + New conversation
              </button>
            </div>
            <div className="flex gap-2">
              <input
                className="border rounded px-3 py-2 w-full bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                placeholder="Paste conversation ID"
                value={joinId}
                onChange={(e) => setJoinId(e.target.value)}
              />
              <button
                className="bg-zinc-800 dark:bg-zinc-700 text-white px-3 py-2 rounded hover:bg-zinc-900 dark:hover:bg-zinc-600"
                onClick={handleJoinConversation}
              >
                Join
              </button>
            </div>
            <div className="border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800">
              <div className="flex items-center justify-between px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
                <span>Conversations</span>
                <button
                  className="text-xs underline hover:text-gray-900 dark:hover:text-gray-200"
                  onClick={() => loadConversations()}
                  disabled={isLoadingConversations}
                >
                  {isLoadingConversations ? "…" : "Refresh"}
                </button>
              </div>
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {conversations.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">
                    No conversations
                  </li>
                ) : (
                  conversations.map((c) => (
                    <li key={c.id} className="group">
                      <div className="flex items-center">
                        <button
                          className={`px-3 py-2 flex-1 text-left text-sm ${
                            conversationId === c.id
                              ? "bg-zinc-100 dark:bg-gray-700 text-gray-900 dark:text-white"
                              : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                          }`}
                          onClick={() => {
                            setConversationId(c.id);
                            setMessages([]);
                            setOnlineUserIds(new Set());
                            setConversationMembers([]);
                          }}
                        >
                          {c.title}
                          <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                            {c.id}
                          </div>
                        </button>
                        <button
                          className="px-2 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteConversation(c.id);
                          }}
                          title="Delete conversation"
                        >
                          🗑️
                        </button>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
            {conversationId && (
              <div className="border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800">
                <div className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 flex items-center justify-between">
                  <span>Members ({conversationMembers.length})</span>
                  <button
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    onClick={() => setAddingMember(true)}
                  >
                    + Add
                  </button>
                </div>
                {addingMember && (
                  <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        className="border rounded px-2 py-1 text-sm flex-1 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
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
                      <button
                        className="text-xs px-2 py-1 bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600"
                        onClick={handleAddMember}
                      >
                        Add
                      </button>
                      <button
                        className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-500"
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
                  <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                    {conversationMembers.map((member) => {
                      const isOnline = onlineUserIds.has(member.id);
                      const isOwn = member.id === user.id;
                      return (
                        <li
                          key={member.id}
                          className="px-3 py-2 text-sm flex items-center justify-between group"
                        >
                          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isOnline
                                  ? "bg-green-500"
                                  : "bg-gray-300 dark:bg-gray-600"
                              }`}
                              title={isOnline ? "Online" : "Offline"}
                            />
                            <span>{member.username}</span>
                            {isOwn && (
                              <span className="text-xs text-gray-400 dark:text-gray-500">
                                (You)
                              </span>
                            )}
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
          </aside>
        )}

        {user.id && conversationId && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1">
                {editingTitle ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      className="border rounded px-2 py-1 text-sm flex-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white"
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
                      className="text-xs px-2 py-1 bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600"
                      onClick={handleUpdateTitle}
                    >
                      Save
                    </button>
                    <button
                      className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-500"
                      onClick={() => {
                        setEditingTitle(false);
                        setNewTitle("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {conversations.find((c) => c.id === conversationId)
                        ?.title || "Conversation"}
                    </span>
                    <button
                      className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                      onClick={() => {
                        const currentTitle =
                          conversations.find((c) => c.id === conversationId)
                            ?.title || "";
                        setNewTitle(currentTitle);
                        setEditingTitle(true);
                      }}
                      title="Edit title"
                    >
                      ✏️
                    </button>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      ID:{" "}
                      <span className="font-mono select-all">
                        {conversationId}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <input
                type="text"
                className="border rounded px-2 py-1 text-sm w-40 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="border border-gray-300 dark:border-gray-700 rounded p-4 h-96 overflow-y-auto bg-gray-50 dark:bg-gray-800">
              {(() => {
                const messagesArray = Array.isArray(messages) ? messages : [];
                return messagesArray.length === 0 ? (
                  <div className="text-gray-400 dark:text-gray-500 text-sm text-center py-8">
                    No messages yet. Start the conversation!
                  </div>
                ) : (
                  <>
                    <ul className="space-y-3">
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
                          const readByText = hasReadByOthers
                            ? `Seen by ${readers
                                .map((r) => r.user?.username ?? "Unknown")
                                .join(", ")}`
                            : "Not seen yet";
                          return (
                            <li
                              key={m.id}
                              className={`flex ${isOwn ? "justify-end" : "justify-start"} group`}
                            >
                              <div
                                className={`max-w-[75%] rounded-lg px-4 py-2 relative ${
                                  isOwn
                                    ? "bg-blue-600 dark:bg-blue-500 text-white"
                                    : "bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                                }`}
                              >
                                {!isOwn && (
                                  <div
                                    className={`text-xs font-semibold mb-1 flex items-center gap-1 ${
                                      isOwn
                                        ? "text-blue-100"
                                        : "text-gray-600 dark:text-gray-300"
                                    }`}
                                  >
                                    {m.author?.username ?? m.authorId}
                                    {m.authorId &&
                                      onlineUserIds.has(m.authorId) && (
                                        <span
                                          className="w-2 h-2 bg-green-500 rounded-full"
                                          title="Online"
                                        />
                                      )}
                                  </div>
                                )}
                                {isEditing ? (
                                  <div className="space-y-2">
                                    <input
                                      className="w-full px-2 py-1 rounded text-gray-900 dark:text-white bg-white dark:bg-gray-600 text-sm border border-gray-300 dark:border-gray-500"
                                      value={editText}
                                      onChange={(e) =>
                                        setEditText(e.target.value)
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey) {
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
                                        className="text-xs px-2 py-1 bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 rounded hover:bg-gray-100 dark:hover:bg-gray-500"
                                        onClick={() => handleEdit(m.id)}
                                      >
                                        Save
                                      </button>
                                      <button
                                        className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-500 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-400"
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
                                    <div className="text-sm">{m.text}</div>
                                    {m.reactions && m.reactions.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-2">
                                        {Object.entries(
                                          m.reactions.reduce(
                                            (acc, r) => {
                                              if (!acc[r.emoji]) {
                                                acc[r.emoji] = [];
                                              }
                                              acc[r.emoji].push(r);
                                              return acc;
                                            },
                                            {} as Record<string, Reaction[]>,
                                          ),
                                        ).map(([emoji, reactions]) => {
                                          const hasUserReaction =
                                            reactions.some(
                                              (r) => r.userId === user.id,
                                            );
                                          return (
                                            <button
                                              key={emoji}
                                              className={`text-xs px-2 py-1 rounded border ${
                                                hasUserReaction
                                                  ? isOwn
                                                    ? "bg-blue-500 dark:bg-blue-400 border-blue-400 dark:border-blue-300"
                                                    : "bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700"
                                                  : isOwn
                                                    ? "bg-blue-700 dark:bg-blue-600 border-blue-600 dark:border-blue-500"
                                                    : "bg-gray-100 dark:bg-gray-600 border-gray-300 dark:border-gray-500"
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
                                                    r.userId,
                                                )
                                                .join(", ")}
                                            >
                                              {emoji} {reactions.length}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                    <div className="flex items-center justify-between gap-2 mt-2">
                                      <div className="flex flex-col items-start gap-1">
                                        <div className="flex items-center gap-2">
                                          <div
                                            className={`text-xs ${
                                              isOwn
                                                ? "text-blue-100"
                                                : "text-gray-400 dark:text-gray-500"
                                            }`}
                                          >
                                            {formatTime(m.createdAt)}
                                          </div>
                                          <EmojiPickerButton
                                            className={`text-xs opacity-0 group-hover:opacity-100 transition-opacity ${
                                              isOwn
                                                ? "text-blue-200"
                                                : "text-gray-500"
                                            }`}
                                            onEmojiClick={(emoji) =>
                                              handleToggleReaction(m.id, emoji)
                                            }
                                            title="Add reaction"
                                          />
                                        </div>
                                        {isOwn && (
                                          <div className="text-[10px] text-gray-400 dark:text-gray-500">
                                            {hasReadByOthers
                                              ? readByText
                                              : "Not seen yet"}
                                          </div>
                                        )}
                                      </div>
                                      {isOwn && (
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <button
                                            className="text-xs px-2 py-1 rounded hover:bg-blue-700 dark:hover:bg-blue-600"
                                            onClick={() => {
                                              setEditingMessageId(m.id);
                                              setEditText(m.text);
                                            }}
                                            title="Edit"
                                          >
                                            ✏️
                                          </button>
                                          <button
                                            className="text-xs px-2 py-1 rounded hover:bg-blue-700 dark:hover:bg-blue-600"
                                            onClick={() => handleDelete(m.id)}
                                            title="Delete"
                                          >
                                            🗑️
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            </li>
                          );
                        })}
                    </ul>
                    {Object.keys(typingUsers).length > 0 && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 italic mt-2 px-2">
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
            <div className="flex gap-2 items-center">
              <div className="relative flex-1 flex items-center gap-2">
                <input
                  className="border border-gray-300 dark:border-gray-700 rounded px-3 py-2 flex-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  placeholder="Type a message..."
                  value={text}
                  onChange={(e) => handleTextChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <EmojiPickerButton
                  onEmojiClick={(emoji) => {
                    setText((prev) => prev + emoji);
                  }}
                  className="text-xl hover:scale-110 transition-transform cursor-pointer"
                  title="Add emoji"
                  showQuickReactions={false}
                />
              </div>
              <button
                className="bg-blue-600 dark:bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleSend}
                disabled={!text.trim()}
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

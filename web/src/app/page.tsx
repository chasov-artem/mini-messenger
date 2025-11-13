"use client";

import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "@/store";
import { setUser, clearUser } from "@/store";
import EmojiPickerButton from "@/components/EmojiPickerButton";

const API_BASE = "http://localhost:4000";

type Reaction = {
  id: string;
  emoji: string;
  userId: string;
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
};

type Conversation = {
  id: string;
  title: string;
  createdAt: string;
};

export default function Home() {
  const dispatch = useDispatch();
  const user = useSelector((s: RootState) => s.user);
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
  const typingDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!conversationId) return;
    // initial history load
    fetch(`${API_BASE}/messages?conversationId=${conversationId}`)
      .then((r) => r.json())
      .then((data: Message[]) => setMessages(data))
      .catch(() => {});
    // load conversation members
    fetch(`${API_BASE}/conversations/${conversationId}/members`)
      .then((r) => r.json())
      .then((data: Array<{ id: string; username: string }>) =>
        setConversationMembers(data),
      )
      .catch(() => {});

    const wsUrl = API_BASE.replace(/^http/, "ws");
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
            if (prev.some((m) => m.id === incoming.id)) return prev;
            return [...prev, incoming];
          });
        } else if (data?.type === "message:updated") {
          const updated = data.payload as Message;
          setMessages((prev) =>
            prev.map((m) => (m.id === updated.id ? updated : m)),
          );
        } else if (data?.type === "message:deleted") {
          const { id } = data.payload as { id: string };
          setMessages((prev) => prev.filter((m) => m.id !== id));
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
          setMessages((prev) =>
            prev.map((m) => (m.id === message.id ? message : m)),
          );
        } else if (data?.type === "users:online") {
          const { userIds } = data.payload as { userIds: string[] };
          setOnlineUserIds(new Set(userIds));
        }
      } catch {}
    };
    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [conversationId, user.id]);

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
      setMessages((prev) => {
        if (prev.some((m) => m.id === created.id)) return prev;
        return [...prev, created];
      });
    } catch {}
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

  function formatTime(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="min-h-screen p-6 sm:p-10">
      <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-[260px_1fr]">
        <h1 className="text-2xl font-semibold">Mini Messenger</h1>

        {!user.id ? (
          <div className="flex gap-2">
            <input
              className="border rounded px-3 py-2 w-full"
              placeholder="Enter username"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
            />
            <button
              className="bg-blue-600 text-white px-4 py-2 rounded"
              onClick={handleCreateUser}
            >
              Continue
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Signed in as</span>
              <span className="font-medium">{user.username}</span>
            </div>
            <button
              className="text-xs text-red-600 hover:underline"
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
                className="bg-emerald-600 text-white px-3 py-2 rounded w-full"
                onClick={handleCreateConversation}
              >
                + New conversation
              </button>
            </div>
            <div className="flex gap-2">
              <input
                className="border rounded px-3 py-2 w-full"
                placeholder="Paste conversation ID"
                value={joinId}
                onChange={(e) => setJoinId(e.target.value)}
              />
              <button
                className="bg-zinc-800 text-white px-3 py-2 rounded"
                onClick={handleJoinConversation}
              >
                Join
              </button>
            </div>
            <div className="border rounded">
              <div className="flex items-center justify-between px-3 py-2 text-sm text-gray-600">
                <span>Conversations</span>
                <button
                  className="text-xs underline"
                  onClick={() => loadConversations()}
                  disabled={isLoadingConversations}
                >
                  {isLoadingConversations ? "…" : "Refresh"}
                </button>
              </div>
              <ul className="divide-y">
                {conversations.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-gray-400">
                    No conversations
                  </li>
                ) : (
                  conversations.map((c) => (
                    <li key={c.id}>
                      <button
                        className={`px-3 py-2 w-full text-left text-sm ${conversationId === c.id ? "bg-zinc-100" : ""}`}
                        onClick={() => {
                          setConversationId(c.id);
                          setMessages([]);
                          setOnlineUserIds(new Set());
                          setConversationMembers([]);
                        }}
                      >
                        {c.title}
                        <div className="text-xs text-gray-500 font-mono">
                          {c.id}
                        </div>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
            {conversationId && conversationMembers.length > 0 && (
              <div className="border rounded">
                <div className="px-3 py-2 text-sm text-gray-600">
                  Members ({conversationMembers.length})
                </div>
                <ul className="divide-y">
                  {conversationMembers.map((member) => {
                    const isOnline = onlineUserIds.has(member.id);
                    return (
                      <li
                        key={member.id}
                        className="px-3 py-2 text-sm flex items-center gap-2"
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isOnline ? "bg-green-500" : "bg-gray-300"
                          }`}
                          title={isOnline ? "Online" : "Offline"}
                        />
                        <span>{member.username}</span>
                        {member.id === user.id && (
                          <span className="text-xs text-gray-400">(You)</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </aside>
        )}

        {user.id && conversationId && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-500">
                Conversation ID:{" "}
                <span className="font-mono select-all">{conversationId}</span>
              </div>
              <input
                type="text"
                className="border rounded px-2 py-1 text-sm w-40"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="border rounded p-4 h-96 overflow-y-auto bg-gray-50">
              {messages.length === 0 ? (
                <div className="text-gray-400 text-sm text-center py-8">
                  No messages yet. Start the conversation!
                </div>
              ) : (
                <>
                  <ul className="space-y-3">
                    {messages
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
                        return (
                          <li
                            key={m.id}
                            className={`flex ${isOwn ? "justify-end" : "justify-start"} group`}
                          >
                            <div
                              className={`max-w-[75%] rounded-lg px-4 py-2 relative ${
                                isOwn
                                  ? "bg-blue-600 text-white"
                                  : "bg-white border text-gray-900"
                              }`}
                            >
                              {!isOwn && (
                                <div
                                  className={`text-xs font-semibold mb-1 flex items-center gap-1 ${
                                    isOwn ? "text-blue-100" : "text-gray-600"
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
                                    className="w-full px-2 py-1 rounded text-gray-900 text-sm"
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
                                      className="text-xs px-2 py-1 bg-white text-blue-600 rounded hover:bg-gray-100"
                                      onClick={() => handleEdit(m.id)}
                                    >
                                      Save
                                    </button>
                                    <button
                                      className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
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
                                        const hasUserReaction = reactions.some(
                                          (r) => r.userId === user.id,
                                        );
                                        return (
                                          <button
                                            key={emoji}
                                            className={`text-xs px-2 py-1 rounded border ${
                                              hasUserReaction
                                                ? isOwn
                                                  ? "bg-blue-500 border-blue-400"
                                                  : "bg-blue-100 border-blue-300"
                                                : isOwn
                                                  ? "bg-blue-700 border-blue-600"
                                                  : "bg-gray-100 border-gray-300"
                                            } hover:opacity-80`}
                                            onClick={() =>
                                              handleToggleReaction(m.id, emoji)
                                            }
                                            title={reactions
                                              .map(
                                                (r) =>
                                                  r.user?.username ?? r.userId,
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
                                    <div className="flex items-center gap-2">
                                      <div
                                        className={`text-xs ${
                                          isOwn
                                            ? "text-blue-100"
                                            : "text-gray-400"
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
                                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                          className="text-xs px-2 py-1 rounded hover:bg-blue-700"
                                          onClick={() => {
                                            setEditingMessageId(m.id);
                                            setEditText(m.text);
                                          }}
                                          title="Edit"
                                        >
                                          ✏️
                                        </button>
                                        <button
                                          className="text-xs px-2 py-1 rounded hover:bg-blue-700"
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
                    <div className="text-xs text-gray-500 italic mt-2 px-2">
                      {Object.values(typingUsers)
                        .map((u) => u.username)
                        .join(", ")}{" "}
                      {Object.keys(typingUsers).length === 1 ? "is" : "are"}{" "}
                      typing...
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="flex gap-2">
              <input
                className="border rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <button
                className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition-colors"
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

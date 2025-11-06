"use client";

import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "@/store";
import { setUser } from "@/store";

const API_BASE = "http://localhost:4000";

type Message = {
  id: string;
  text: string;
  authorId: string;
  conversationId: string;
  createdAt: string;
  author?: { id: string; username: string };
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
  const wsRef = useRef<WebSocket | null>(null);

  const canChat = Boolean(user.id && conversationId);

  useEffect(() => {
    if (!conversationId) return;
    // initial history load
    fetch(`${API_BASE}/messages?conversationId=${conversationId}`)
      .then((r) => r.json())
      .then((data: Message[]) => setMessages(data))
      .catch(() => {});

    const wsUrl = API_BASE.replace(/^http/, "ws");
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join", conversationId }));
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
        }
      } catch {}
    };
    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [conversationId]);

  // Best-effort: if socket is already open when conversationId changes, (re)send join
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || !conversationId) return;
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "join", conversationId }));
    }
  }, [conversationId]);

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
      setConversations((prev) => [
        { id: data.id as string, title: data.title as string, createdAt: data.createdAt as string },
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
  }

  async function loadConversations(explicitUserId?: string) {
    const uid = explicitUserId ?? user.id;
    if (!uid) return;
    try {
      setIsLoadingConversations(true);
      const r = await fetch(`${API_BASE}/conversations?userId=${uid}`);
      const data = (await r.json()) as Conversation[];
      setConversations(data);
    } catch {}
    finally {
      setIsLoadingConversations(false);
    }
  }

  useEffect(() => {
    if (user.id) void loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

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
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>Signed in as</span>
            <span className="font-medium">{user.username}</span>
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
                <button className="text-xs underline" onClick={() => loadConversations()} disabled={isLoadingConversations}>
                  {isLoadingConversations ? "…" : "Refresh"}
                </button>
              </div>
              <ul className="divide-y">
                {conversations.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-gray-400">No conversations</li>
                ) : (
                  conversations.map((c) => (
                    <li key={c.id}>
                      <button
                        className={`px-3 py-2 w-full text-left text-sm ${conversationId === c.id ? "bg-zinc-100" : ""}`}
                        onClick={() => {
                          setConversationId(c.id);
                          setMessages([]);
                        }}
                      >
                        {c.title}
                        <div className="text-xs text-gray-500 font-mono">{c.id}</div>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </aside>
        )}

        {user.id && conversationId && (
          <div className="space-y-3">
            <div className="text-xs text-gray-500">
              Conversation ID:{" "}
              <span className="font-mono select-all">{conversationId}</span>
            </div>
            <div className="border rounded p-3 h-80 overflow-y-auto bg-white">
              {messages.length === 0 ? (
                <div className="text-gray-400 text-sm">No messages yet</div>
              ) : (
                <ul className="space-y-2">
                  {messages.map((m) => (
                    <li key={m.id} className="text-sm">
                      <span className="font-medium">
                        {m.author?.username ?? m.authorId}:
                      </span>{" "}
                      <span>{m.text}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex gap-2">
              <input
                className="border rounded px-3 py-2 w-full"
                placeholder="Type a message"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <button
                className="bg-blue-600 text-white px-4 py-2 rounded"
                onClick={handleSend}
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

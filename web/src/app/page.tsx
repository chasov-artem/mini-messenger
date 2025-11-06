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

export default function Home() {
  const dispatch = useDispatch();
  const user = useSelector((s: RootState) => s.user);
  const [usernameInput, setUsernameInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  const canChat = Boolean(user.id && conversationId);

  useEffect(() => {
    if (!conversationId) return;
    const wsUrl = API_BASE.replace(/^http/, "ws");
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
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
    } else {
      alert(data?.error ?? "Failed to create conversation");
    }
  }

  async function handleSend() {
    if (!user.id || !conversationId || !text.trim()) return;
    const body = { conversationId, authorId: user.id, text: text.trim() };
    setText("");
    await fetch(`${API_BASE}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  return (
    <div className="min-h-screen p-6 sm:p-10">
      <div className="max-w-3xl mx-auto space-y-6">
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

        {user.id && !conversationId && (
          <button
            className="bg-emerald-600 text-white px-4 py-2 rounded"
            onClick={handleCreateConversation}
          >
            Create conversation
          </button>
        )}

        {user.id && conversationId && (
          <div className="space-y-3">
            <div className="border rounded p-3 h-80 overflow-y-auto bg-white">
              {messages.length === 0 ? (
                <div className="text-gray-400 text-sm">No messages yet</div>
              ) : (
                <ul className="space-y-2">
                  {messages.map((m) => (
                    <li key={m.id} className="text-sm">
                      <span className="font-medium">{m.author?.username ?? m.authorId}:</span>{" "}
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

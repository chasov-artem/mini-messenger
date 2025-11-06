"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const ws_1 = require("ws");
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const wss = new ws_1.WebSocketServer({ server });
app.get('/health', (_req, res) => {
    res.json({ ok: true });
});
wss.on('connection', (socket) => {
    socket.send(JSON.stringify({ type: 'welcome', payload: 'connected' }));
    socket.on('message', (data) => {
        wss.clients.forEach((client) => {
            if (client.readyState === ws_1.WebSocket.OPEN) {
                client.send(data);
            }
        });
    });
});
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
server.listen(PORT, () => {
    console.log(`server listening on http://localhost:${PORT}`);
});
//# sourceMappingURL=index.js.map
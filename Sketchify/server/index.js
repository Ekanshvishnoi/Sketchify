/**
 * server/index.js
 *
 * Entry point for the backend.
 * Sets up Express (HTTP) and Socket.io (WebSocket) on the same port.
 *
 * HOW EXPRESS + SOCKET.IO SHARE A PORT:
 * Express handles regular HTTP requests (like serving a health-check URL).
 * Socket.io attaches to the same Node HTTP server and intercepts WebSocket
 * upgrade requests. So both live on port 3001 with zero conflict.
 */

import "dotenv/config";                   // loads .env into process.env
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

// Import our feature handlers (we will fill these in next steps)
import { registerRoomHandlers }      from "./handlers/roomHandler.js";
import { registerDrawHandlers }      from "./handlers/drawHandler.js";
import { registerChatHandlers }      from "./handlers/chatHandler.js";
import { registerSwapHandlers }      from "./handlers/swapHandler.js";
import { registerSignalingHandlers } from "./handlers/signalingHandler.js";

const PORT = process.env.PORT || 3001;

// ── 1. Create the Express app ────────────────────────────────────────
const app = express();

app.use(cors());          // allow requests from the React dev server (port 5173)
app.use(express.json());  // parse JSON request bodies

// A simple health-check endpoint so you can confirm the server is running
// by visiting http://localhost:3001/health in your browser.
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── 2. Attach Socket.io to the same HTTP server ──────────────────────
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    // In development the React app runs on port 5173 (Vite's default).
    // We explicitly allow it here so the browser does not block the connection.
    origin: process.env.NODE_ENV === "production" ? false : "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

// ── 3. Wire up Socket.io event handlers ─────────────────────────────
/**
 * io.on("connection") fires every time a new browser tab connects.
 * `socket` is the object representing that single connection —
 * think of it as one person's open WebSocket pipe.
 *
 * We pass both `io` and `socket` into each handler:
 * - `socket` is used to listen for events from THIS user
 * - `io`     is used to broadcast events to OTHER users in a room
 */
io.on("connection", (socket) => {
  console.log(`[+] Socket connected: ${socket.id}`);

  registerRoomHandlers(io, socket);
  registerDrawHandlers(io, socket);
  registerChatHandlers(io, socket);
  registerSwapHandlers(io, socket);
  registerSignalingHandlers(io, socket);

  socket.on("disconnect", () => {
    console.log(`[-] Socket disconnected: ${socket.id}`);
  });
});

// ── 4. Start listening ───────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

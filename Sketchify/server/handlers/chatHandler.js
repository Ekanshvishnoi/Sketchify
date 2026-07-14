/**
 * server/handlers/chatHandler.js
 *
 * Handles chat messages between active participants.
 *
 * Flow:
 *   Active user types a message → emits CHAT_MESSAGE to server
 *   Server validates they are active (not spectator)
 *   Server stores message in room.chat[]
 *   Server broadcasts CHAT_BROADCAST to everyone in the room
 */
import {
  getRoomBySocket,
} from "../store/roomStore.js";

import {
  CHAT_MESSAGE,
  CHAT_BROADCAST,
} from "../events.js";

// Tiny ID generator
function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export function registerChatHandlers(io, socket) {

  socket.on(CHAT_MESSAGE, ({ text }) => {

    // ── 1. Find which room this socket is in ──────────────────────
    const result = getRoomBySocket(socket.id);

    if (!result) {
      console.warn(`[Chat] Message from unknown socket: ${socket.id}`);
      return;
    }

    const { room, role } = result;

    // ── 2. Only active participants can send messages ──────────────
    if (role !== "active") {
      console.warn(`[Chat] Spectator tried to send a message`);
      return;
    }

    // ── 3. Basic validation ───────────────────────────────────────
    if (!text || typeof text !== "string") return;

    const trimmed = text.trim();
    if (trimmed.length === 0 || trimmed.length > 500) return;

    // ── 4. Find the sender's name from their seat ─────────────────
    const senderName =
      room.seats.A?.socketId === socket.id ? room.seats.A.name :
      room.seats.B?.socketId === socket.id ? room.seats.B.name :
      "Unknown";

    // ── 5. Build the message object ───────────────────────────────
    const message = {
      id:        uid(),
      name:      senderName,
      text:      trimmed,
      timestamp: Date.now(),
    };

    // ── 6. Store in room history ──────────────────────────────────
    // This means new joiners get the full chat history
    room.chat.push(message);

    // Keep chat history from growing unbounded — max 200 messages
    if (room.chat.length > 200) {
      room.chat.shift(); // remove oldest
    }

    // ── 7. Broadcast to everyone in the room (active + spectators) ─
    io.to(room.code).emit(CHAT_BROADCAST, message);

    console.log(`[Chat] ${senderName} in ${room.code}: ${trimmed}`);
  });
}
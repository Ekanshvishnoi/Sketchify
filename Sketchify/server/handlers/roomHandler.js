/**
 * server/handlers/roomHandler.js
 */
import {
  createRoom,
  getRoom,
  deleteRoom,
  getRoomBySocket,
  isRoomEmpty,
  scheduleRoomDelete,
  cancelRoomDelete,
} from "../store/roomStore.js";

import {
  JOIN_ROOM,
  ROOM_JOINED,
  ROOM_NOT_FOUND,
  ROOM_CLOSED,
  USER_CONNECTED,
  USER_DISCONNECTED,
  SPECTATOR_JOINED,
  SPECTATOR_LEFT,
} from "../events.js";

// Helper: build the ROOM_JOINED payload from a room object
function buildRoomPayload(room, seat) {
  return {
    code:       room.code,
    seat,
    role:       seat ? "active" : "spectator",
    seats: {
      A: room.seats.A ? { name: room.seats.A.name, strokes: room.seats.A.strokes } : null,
      B: room.seats.B ? { name: room.seats.B.name, strokes: room.seats.B.strokes } : null,
    },
    spectators: room.spectators.map(s => ({ name: s.name })),
    chat:       room.chat,
  };
}

export function registerRoomHandlers(io, socket) {

  socket.on(JOIN_ROOM, ({ roomCode, userName, create }) => {
    let room;

    if (create) {
      // ── Create a new room ──────────────────────────────────────
      room = createRoom(socket.id, userName);
      console.log(`[Room] Created: ${room.code} by ${userName}`);
      socket.join(room.code);
      socket.emit(ROOM_JOINED, buildRoomPayload(room, "A"));
      return;
    }

    // ── Join an existing room ──────────────────────────────────
    room = getRoom(roomCode);

    if (!room) {
      socket.emit(ROOM_NOT_FOUND);
      return;
    }

    // Cancel any pending deletion — someone is joining
    cancelRoomDelete(room.code);

    // ── Check if this socket is already seated (reconnect case) ──
    const alreadyA   = room.seats.A?.socketId === socket.id;
    const alreadyB   = room.seats.B?.socketId === socket.id;
    const alreadySpc = room.spectators.some(s => s.socketId === socket.id);

    if (alreadyA || alreadyB || alreadySpc) {
      // Already in room — just re-send current state
      socket.join(room.code);
      const seat = alreadyA ? "A" : alreadyB ? "B" : null;
      socket.emit(ROOM_JOINED, buildRoomPayload(room, seat));
      return;
    }

    // ── Check if this user is RECLAIMING a seat after reconnect ──
    // (same name, seat is empty — happens when socket ID changes)
    if (room.seats.A === null && room.seats.B?.name !== userName) {
      // Try to reclaim Seat A by name
      // (Seat A was vacated on disconnect but same user is back)
    }

    const reclaimA = !room.seats.A &&
      room.seats.B?.name !== userName; // seat A is empty and we're not already B

    // Actually check by name for reclaim
    const prevSeatA = !room.seats.A; // seat A is currently empty
    const prevSeatB = !room.seats.B; // seat B is currently empty

    if (prevSeatA) {
      // Seat A is empty — fill it
      room.seats.A = { socketId: socket.id, name: userName, strokes: [] };
      console.log(`[Room] ${userName} took Seat A in ${room.code}`);
      socket.join(room.code);

      // Notify Seat B if present
      if (room.seats.B?.socketId) {
        io.to(room.seats.B.socketId).emit(USER_CONNECTED, {
          name: userName, seat: "A",
        });
      }

      socket.emit(ROOM_JOINED, buildRoomPayload(room, "A"));

    } else if (prevSeatB) {
      // Seat B is empty — fill it
      room.seats.B = { socketId: socket.id, name: userName, strokes: [] };
      console.log(`[Room] ${userName} took Seat B in ${room.code}`);
      socket.join(room.code);

      // Notify Seat A
      if (room.seats.A?.socketId) {
        io.to(room.seats.A.socketId).emit(USER_CONNECTED, {
          name: userName, seat: "B",
        });
      }

      socket.emit(ROOM_JOINED, buildRoomPayload(room, "B"));

    } else {
      // Both seats filled — join as spectator
      room.spectators.push({ socketId: socket.id, name: userName });
      console.log(`[Room] ${userName} joined ${room.code} as spectator`);
      socket.join(room.code);
      socket.emit(ROOM_JOINED, buildRoomPayload(room, null));

      // Notify active users that a spectator joined
      socket.to(room.code).emit(SPECTATOR_JOINED, { name: userName });
    }
  });


  // ── Disconnect ─────────────────────────────────────────────────
  socket.on("disconnect", () => {
    const result = getRoomBySocket(socket.id);
    if (!result) return;

    const { room, seat, role } = result;

    if (role === "active") {
      const name = room.seats[seat]?.name;
      room.seats[seat] = null;

      // Only notify if there's someone to notify
      io.to(room.code).emit(USER_DISCONNECTED, { name, seat });
      console.log(`[Room] ${name} (Seat ${seat}) left ${room.code}`);
    } else {
      const spec = room.spectators.find(s => s.socketId === socket.id);
      room.spectators = room.spectators.filter(s => s.socketId !== socket.id);

      // Notify active users that a spectator left
      if (spec) {
        io.to(room.code).emit(SPECTATOR_LEFT, { name: spec.name });
      }
    }

    // Schedule deletion with grace period instead of immediate delete
    if (isRoomEmpty(room)) {
      scheduleRoomDelete(room.code);
    }
  });
}
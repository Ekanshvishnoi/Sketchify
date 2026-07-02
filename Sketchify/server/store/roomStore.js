/**
 * server/store/roomStore.js
 * Added: grace period before room deletion to survive reconnects.
 */
const rooms          = new Map();
const pendingDeletes = new Map(); // roomCode → timeoutId

function generateCode() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function createRoom(socketId, userName) {
  let code;
  do { code = generateCode(); } while (rooms.has(code));

  const room = {
    code,
    seats: {
      A: { socketId, name: userName, strokes: [] },
      B: null,
    },
    spectators: [],
    chat:        [],
    swapRequest: null,
    createdAt:   Date.now(),
  };

  rooms.set(code, room);
  return room;
}

export function getRoom(code)   { return rooms.get(code); }
export function deleteRoom(code){ rooms.delete(code); }

export function getRoomBySocket(socketId) {
  for (const room of rooms.values()) {
    if (room.seats.A?.socketId === socketId)
      return { room, seat: "A", role: "active" };
    if (room.seats.B?.socketId === socketId)
      return { room, seat: "B", role: "active" };
    const spec = room.spectators.find(s => s.socketId === socketId);
    if (spec) return { room, seat: null, role: "spectator" };
  }
  return null;
}

export function isRoomEmpty(room) {
  return !room.seats.A && !room.seats.B && room.spectators.length === 0;
}

/**
 * scheduleRoomDelete()
 * Instead of deleting immediately, wait 8 seconds.
 * If someone rejoins in that window, cancelRoomDelete() stops the deletion.
 */
export function scheduleRoomDelete(code) {
  // Don't double-schedule
  if (pendingDeletes.has(code)) return;

  const timeoutId = setTimeout(() => {
    const room = getRoom(code);
    if (room && isRoomEmpty(room)) {
      deleteRoom(code);
      console.log(`[Room] Closed after grace period: ${code}`);
    }
    pendingDeletes.delete(code);
  }, 8000); // 8 second grace period

  pendingDeletes.set(code, timeoutId);
  console.log(`[Room] Grace period started for: ${code}`);
}

export function cancelRoomDelete(code) {
  if (pendingDeletes.has(code)) {
    clearTimeout(pendingDeletes.get(code));
    pendingDeletes.delete(code);
    console.log(`[Room] Grace period cancelled for: ${code}`);
  }
}
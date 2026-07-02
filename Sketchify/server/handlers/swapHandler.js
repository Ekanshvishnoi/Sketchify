/**
 * server/handlers/swapHandler.js
 *
 * Handles spectator ↔ active seat swap flow:
 *
 * Step 1: Spectator emits SWAP_REQUEST  → server forwards to the target active user
 * Step 2: Active user emits SWAP_RESPONSE (approved/denied)
 *           → if approved: server swaps roles, broadcasts new seat state
 *           → if denied:   server notifies the spectator
 */
import { getRoomBySocket } from "../store/roomStore.js";
import {
  SWAP_REQUEST,
  SWAP_RESPONSE,
  SWAP_BROADCAST,
} from "../../shared/events.js";

export function registerSwapHandlers(io, socket) {

  // ── SWAP_REQUEST ───────────────────────────────────────────────────
  // Fired by a spectator who wants to take an active seat.
  // Payload: { targetSeat } — which seat they want ("A" or "B")
  socket.on(SWAP_REQUEST, ({ targetSeat }) => {

    // 1. Find which room this socket is in
    const result = getRoomBySocket(socket.id);
    if (!result) return;

    const { room, role } = result;

    // 2. Only spectators can request a swap
    if (role !== "spectator") return;

    // 3. Target seat must exist and be occupied
    const targetUser = room.seats[targetSeat];
    if (!targetUser) return;

    // 4. Only one pending swap at a time
    if (room.swapRequest) return;

    // 5. Find the requester's name
    const requesterName = room.spectators.find(
      s => s.socketId === socket.id
    )?.name;
    if (!requesterName) return;

    // 6. Store the pending swap request in room state
    room.swapRequest = {
      fromSocketId: socket.id,
      fromName:     requesterName,
      targetSeat,
      toSocketId:   targetUser.socketId,
      status:       "pending",
    };

    // 7. Forward the request ONLY to the target active user
    // We use socket.to(targetSocketId) to send to just that one person
    io.to(targetUser.socketId).emit(SWAP_REQUEST, {
      fromName:   requesterName,
      targetSeat,
    });

    console.log(
      `[Swap] ${requesterName} requested Seat ${targetSeat} ` +
      `from ${targetUser.name} in room ${room.code}`
    );
  });


  // ── SWAP_RESPONSE ──────────────────────────────────────────────────
  // Fired by the active user who received the swap request.
  // Payload: { approved: true | false }
  socket.on(SWAP_RESPONSE, ({ approved }) => {

    // 1. Find the room
    const result = getRoomBySocket(socket.id);
    if (!result) return;

    const { room } = result;

    // 2. There must be a pending swap request
    const req = room.swapRequest;
    if (!req) return;

    // 3. Only the person who was asked can respond
    if (req.toSocketId !== socket.id) return;

    if (!approved) {
      // ── Denied ────────────────────────────────────────────────
      // Clear the request and notify the spectator
      room.swapRequest = null;

      io.to(req.fromSocketId).emit(SWAP_BROADCAST, {
        approved: false,
        message:  "Your seat request was denied.",
      });

      console.log(
        `[Swap] ${req.fromName}'s request for Seat ${req.targetSeat} ` +
        `was denied in room ${room.code}`
      );
      return;
    }

    // ── Approved ─────────────────────────────────────────────────
    const seat        = req.targetSeat;
    const activeUser  = room.seats[seat]; // the person giving up their seat

    if (!activeUser) {
      room.swapRequest = null;
      return;
    }

    // 4. Swap the roles:
    //    - Active user moves to spectators list
    //    - Spectator takes the active seat

    // Remove requester from spectators
    room.spectators = room.spectators.filter(
      s => s.socketId !== req.fromSocketId
    );

    // Move current active user to spectators
    room.spectators.push({
      socketId: activeUser.socketId,
      name:     activeUser.name,
    });

    // Put requester in the active seat
    // Keep the existing strokes — the new person inherits the section
    room.seats[seat] = {
      socketId: req.fromSocketId,
      name:     req.fromName,
      strokes:  activeUser.strokes, // inherit existing strokes
    };

    // 5. Clear the swap request
    room.swapRequest = null;

    // 6. Broadcast the new seat/spectator state to EVERYONE in the room
    io.to(room.code).emit(SWAP_BROADCAST, {
      approved:   true,
      seats: {
        A: room.seats.A
          ? { name: room.seats.A.name, socketId: room.seats.A.socketId }
          : null,
        B: room.seats.B
          ? { name: room.seats.B.name, socketId: room.seats.B.socketId }
          : null,
      },
      spectators: room.spectators.map(s => ({ name: s.name })),
    });

    console.log(
      `[Swap] ${req.fromName} swapped into Seat ${seat} ` +
      `in room ${room.code}. ${activeUser.name} is now spectating.`
    );
  });
}
/**
 * server/handlers/drawHandler.js
 *
 * Handles all drawing events between active users.
 *
 * Flow:
 *   User draws → emits STROKE_START / STROKE_POINT / STROKE_END
 *   Server validates seat ownership (you can only draw in your half)
 *   Server stores stroke in room.seats[seat].strokes[]
 *   Server broadcasts to everyone else in the room
 *
 * THREE EVENTS PER STROKE:
 *   STROKE_START — pen touched canvas, new stroke object created
 *   STROKE_POINT — pen moved, add point to current stroke (fires many times)
 *   STROKE_END   — pen lifted, stroke is complete and fully stored
 *
 * WHY THREE EVENTS INSTEAD OF ONE:
 * If we waited for STROKE_END to send the whole stroke, the partner
 * would see nothing until the pen lifted. With STROKE_POINT streaming
 * in real time, they see the stroke being drawn live point by point.
 */
import { getRoomBySocket } from "../store/roomStore.js";
import {
  STROKE_START,
  STROKE_POINT,
  STROKE_END,
  STROKE_UPDATE,
  UNDO_STROKE,
  UNDO_BROADCAST,
} from "../../shared/events.js";

export function registerDrawHandlers(io, socket) {

  // ── STROKE_START ───────────────────────────────────────────────────
  // Payload: { stroke } — initial stroke object (tool, color, width, startX/Y)
  socket.on(STROKE_START, ({ stroke }) => {
    const result = getRoomBySocket(socket.id);
    if (!result) return;

    const { room, seat, role } = result;
    if (role !== "active") return;

    // Validate: stroke must belong to this user's seat
    if (stroke.seat !== seat) return;

    // Store the in-progress stroke temporarily on the seat
    // We'll finalize it in STROKE_END
    room.seats[seat].currentStroke = stroke;

    // Broadcast to everyone else in the room
    // socket.to() sends to all EXCEPT the sender
    socket.to(room.code).emit(STROKE_UPDATE, {
      type:   "start",
      stroke,
      seat,
    });
  });


  // ── STROKE_POINT ───────────────────────────────────────────────────
  // Payload: { strokeId, point } — a new x,y coordinate
  // This fires many times per second during freehand drawing.
  socket.on(STROKE_POINT, ({ strokeId, point }) => {
    const result = getRoomBySocket(socket.id);
    if (!result) return;

    const { room, seat, role } = result;
    if (role !== "active") return;

    // Add point to the in-progress stroke
    const current = room.seats[seat].currentStroke;
    if (current && current.id === strokeId) {
      if (!current.points) current.points = [];
      current.points.push(point);
    }

    // Broadcast the new point to everyone else
    socket.to(room.code).emit(STROKE_UPDATE, {
      type: "point",
      strokeId,
      point,
      seat,
    });
  });


  // ── STROKE_END ─────────────────────────────────────────────────────
  // Payload: { strokeId } — pen lifted, stroke is complete
  socket.on(STROKE_END, ({ strokeId }) => {
    const result = getRoomBySocket(socket.id);
    if (!result) return;

    const { room, seat, role } = result;
    if (role !== "active") return;

    const current = room.seats[seat].currentStroke;

    if (current && current.id === strokeId) {
      // Move from currentStroke → permanent strokes array
      room.seats[seat].strokes.push({ ...current });
      room.seats[seat].currentStroke = null;

      // Keep stroke history from growing unbounded
      // Max 500 strokes per seat
      if (room.seats[seat].strokes.length > 500) {
        room.seats[seat].strokes.shift();
      }
    }

    // Broadcast stroke end to everyone else
    socket.to(room.code).emit(STROKE_UPDATE, {
      type: "end",
      strokeId,
      seat,
    });
  });


  // ── UNDO_STROKE ────────────────────────────────────────────────────
  // Payload: { strokeId } — remove a specific stroke by ID
  socket.on(UNDO_STROKE, ({ strokeId }) => {
    const result = getRoomBySocket(socket.id);
    if (!result) return;

    const { room, seat, role } = result;
    if (role !== "active") return;

    // Remove the stroke from permanent storage
    room.seats[seat].strokes = room.seats[seat].strokes.filter(
      s => s.id !== strokeId
    );

    // Broadcast undo to everyone in the room
    // io.to() sends to ALL including the sender
    // (sender already removed it locally, but this keeps
    //  spectators and the partner in sync)
    io.to(room.code).emit(UNDO_BROADCAST, { strokeId, seat });

    console.log(`[Draw] Undo stroke ${strokeId} in seat ${seat} room ${room.code}`);
  });
}
/**
 * server/handlers/signalingHandler.js
 *
 * WebRTC signaling relay — the server's only job here is to
 * forward messages between the two active users so their browsers
 * can negotiate a direct peer-to-peer audio connection.
 *
 * The server NEVER touches audio data. It only passes through:
 *   - Offer  (User A's browser → server → User B's browser)
 *   - Answer (User B's browser → server → User A's browser)
 *   - ICE candidates (both directions)
 *
 * WHY SIGNALING IS NEEDED:
 * Two browsers can't connect directly until they know each other's
 * network address and codec capabilities. The "offer" and "answer"
 * contain codec info (SDP). The ICE candidates contain network
 * address options. Once both sides have exchanged these, the
 * browser handles the direct audio connection itself — the server
 * is no longer involved in the call.
 */
import { getRoomBySocket } from "../store/roomStore.js";
import { RTC_OFFER, RTC_ANSWER, RTC_ICE } from "../events.js";

export function registerSignalingHandlers(io, socket) {

  // ── Helper: find the other active user's socket ID ──────────────
  // Both signaling messages always go to the OTHER active seat.
  function getPartnerSocketId(room, mySeat) {
    const partnerSeat = mySeat === "A" ? "B" : "A";
    return room.seats[partnerSeat]?.socketId || null;
  }

  // ── RTC_OFFER ────────────────────────────────────────────────────
  // Sent by whichever active user initiates the connection.
  // Payload: { offer } — the SDP offer object from the browser
  socket.on(RTC_OFFER, ({ offer }) => {
    const result = getRoomBySocket(socket.id);
    if (!result) return;

    const { room, seat, role } = result;

    // Only active users participate in calls
    if (role !== "active") return;

    const partnerSocketId = getPartnerSocketId(room, seat);
    if (!partnerSocketId) return;

    // Forward the offer to the partner
    io.to(partnerSocketId).emit(RTC_OFFER, { offer });
    console.log(`[RTC] Offer relayed in room ${room.code}`);
  });


  // ── RTC_ANSWER ───────────────────────────────────────────────────
  // Sent by the user who received the offer.
  // Payload: { answer } — the SDP answer object from the browser
  socket.on(RTC_ANSWER, ({ answer }) => {
    const result = getRoomBySocket(socket.id);
    if (!result) return;

    const { room, seat, role } = result;
    if (role !== "active") return;

    const partnerSocketId = getPartnerSocketId(room, seat);
    if (!partnerSocketId) return;

    io.to(partnerSocketId).emit(RTC_ANSWER, { answer });
    console.log(`[RTC] Answer relayed in room ${room.code}`);
  });


  // ── RTC_ICE ──────────────────────────────────────────────────────
  // ICE candidates are sent by both sides continuously as the
  // browser discovers network paths to reach the other peer.
  // Payload: { candidate } — the ICE candidate object
  socket.on(RTC_ICE, ({ candidate }) => {
    const result = getRoomBySocket(socket.id);
    if (!result) return;

    const { room, seat, role } = result;
    if (role !== "active") return;

    const partnerSocketId = getPartnerSocketId(room, seat);
    if (!partnerSocketId) return;

    io.to(partnerSocketId).emit(RTC_ICE, { candidate });
  });
}
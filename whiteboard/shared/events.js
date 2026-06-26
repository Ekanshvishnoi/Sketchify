/**
 * shared/events.js
 *
 * Every Socket.io event name lives here as a constant.
 * Both the client and the server import from this file.
 *
 * WHY: If you type an event name as a raw string in two places
 * ("join-room" on the client, "join-room" on the server) and you
 * ever rename it, you have to hunt down every occurrence. One typo
 * means the event silently never fires. Importing a constant catches
 * that mistake at the import step instead.
 */

// ─── Room lifecycle ────────────────────────────────────────────────
export const JOIN_ROOM        = "join-room";        // client → server: join or create a room
export const ROOM_JOINED      = "room-joined";      // server → client: you successfully joined, here is the full room state
export const ROOM_NOT_FOUND   = "room-not-found";   // server → client: the room code does not exist
export const ROOM_FULL        = "room-full";        // server → client: both active seats taken, you are a spectator
export const ROOM_CLOSED      = "room-closed";      // server → all clients: room is being destroyed
export const USER_CONNECTED   = "user-connected";   // server → room: a new active user joined
export const USER_DISCONNECTED= "user-disconnected";// server → room: an active user left

// ─── Drawing ───────────────────────────────────────────────────────
export const STROKE_START     = "stroke-start";     // client → server: pen touched canvas, new stroke begins
export const STROKE_POINT     = "stroke-point";     // client → server: pen moved, add a point to current stroke
export const STROKE_END       = "stroke-end";       // client → server: pen lifted, stroke is complete
export const STROKE_UPDATE    = "stroke-update";    // server → room: broadcast stroke data to all other clients
export const UNDO_STROKE      = "undo-stroke";      // client → server: user pressed undo
export const UNDO_BROADCAST   = "undo-broadcast";   // server → room: tell others to remove this stroke
export const CLEAR_CANVAS     = "clear-canvas";     // client → server: user cleared their half (not used in live session but kept for extensibility)

// ─── Chat ──────────────────────────────────────────────────────────
export const CHAT_MESSAGE     = "chat-message";     // client → server: user sent a chat message
export const CHAT_BROADCAST   = "chat-broadcast";   // server → room: deliver the message to everyone in the room

// ─── Spectator swap ────────────────────────────────────────────────
export const SPECTATOR_JOINED = "spectator-joined"; // server → room: a spectator joined
export const SPECTATOR_LEFT   = "spectator-left";   // server → room: a spectator left
export const SWAP_REQUEST     = "swap-request";     // client → server: spectator is asking for an active seat
export const SWAP_RESPONSE    = "swap-response";    // client → server: active user approved or denied the request
export const SWAP_BROADCAST   = "swap-broadcast";   // server → room: roles have changed, here are the new seat assignments

// ─── WebRTC voice signaling ────────────────────────────────────────
// These three are just relay events — the server passes them through
// without inspecting the payload. The actual negotiation happens
// directly between the two active users' browsers (peer-to-peer).
export const RTC_OFFER        = "rtc-offer";        // client → server → other client: WebRTC offer SDP
export const RTC_ANSWER       = "rtc-answer";       // client → server → other client: WebRTC answer SDP
export const RTC_ICE          = "rtc-ice";          // client → server → other client: ICE candidate

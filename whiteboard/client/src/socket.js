/**
 * client/src/socket.js
 *
 * A single socket instance shared across the entire app.
 * Created once when the app loads, never destroyed on navigation.
 *
 * WHY SINGLETON:
 * If each page/component creates its own socket, navigating between
 * pages disconnects the old socket and connects a new one. This kills
 * any rooms the old socket was in. One shared instance avoids this.
 */
import { io } from "socket.io-client";

export const socket = io("", {
  autoConnect: true,
  transports: ["websocket"],
});
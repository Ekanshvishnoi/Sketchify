/**
 * client/vite.config.js
 *
 * Vite is the build tool and dev server for the React frontend.
 *
 * The proxy block is important:
 * In development, the React app runs on port 5173 and the server
 * runs on port 3001. Without a proxy, the browser would block
 * WebSocket connections across different ports (CORS).
 * The proxy tells Vite: "if the client connects to /socket.io,
 * silently forward that to localhost:3001". This makes it look
 * like everything is on one port during development.
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/socket.io": {
        target: "http://localhost:3001",
        ws: true,         // ws:true is critical — it enables WebSocket proxying
        changeOrigin: true,
      },
    },
  },
});

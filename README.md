# Sketchify 🎨

A real-time collaborative board where two people can draw together, chat, and voice call — all in the browser. No accounts, no setup, just create a room and share the code.

---

## Features

### Solo Mode
- Full whiteboard experience with no login required
- Freehand pen, straight line, rectangle, circle, arrow, eraser
- Color picker with presets + custom color support
- Stroke width control
- Undo / Redo
- Canvas background switcher (dark, white, green, navy)

### Live Session
- Create a room → get a 6-character room code
- Share the code → second person joins instantly
- Canvas splits into two halves — one per active participant
- Each person draws only in their own half
- Per-user undo/redo (only affects your own strokes)
- Real-time drawing sync — see your partner's strokes appear live
- Full drawing history replayed for anyone who joins mid-session

### Chat
- Real-time text chat between the two active participants
- Chat history preserved for the session
- Spectators can read chat but cannot send messages
- Auto-scrolls to latest message

### Voice Call
- Always-on voice channel — no "start call" button needed
- Voice goes live automatically when both active users are in the room
- Mute / unmute your own microphone
- Speaking indicator (animated ring) shows who is talking
- Peer-to-peer audio via WebRTC — server never touches audio data

### Rooms & Spectators
- Room stays alive as long as anyone is present
- Room closes and all data is wiped when everyone leaves (fully ephemeral)
- Unlimited spectators can join to view both canvas halves live
- Spectator can request an active seat — active user approves or denies
- On approval, roles swap — spectator becomes active, active becomes spectator
- Slide-out panel for chat, voice, spectator list, and swap controls

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite |
| Drawing | Raw HTML5 Canvas API |
| Backend | Node.js + Express |
| Real-time | Socket.io (WebSockets) |
| Voice | WebRTC (peer-to-peer) |
| Storage | In-memory (no database) |

---

## Project Structure

```
Sketchify/
├── package.json              # Monorepo root — runs client + server together
├── .env                      # PORT, NODE_ENV
├── shared/
│   └── events.js             # All Socket.io event name constants
├── server/
│   ├── package.json
│   ├── index.js              # Express + Socket.io entry point
│   ├── store/
│   │   └── roomStore.js      # In-memory room state (Map)
│   └── handlers/
│       ├── roomHandler.js    # Create, join, leave, close room
│       ├── drawHandler.js    # Relay stroke events, validate seat ownership
│       ├── chatHandler.js    # Relay chat messages
│       ├── swapHandler.js    # Spectator ↔ active seat swap
│       └── signalingHandler.js # WebRTC offer/answer/ICE relay
└── client/
    ├── package.json
    ├── vite.config.js        # Dev proxy → server on 3001
    ├── index.html
    └── src/
        ├── main.jsx          # React entry point
        ├── App.jsx           # Routes: / and /room/:code
        ├── index.css         # Global styles
        ├── socket.js         # Singleton Socket.io client
        ├── context/
        │   └── RoomContext.jsx   # Global room state (name, role, seat)
        ├── pages/
        │   ├── Home.jsx          # Solo Sketchify + Live Session modal flow
        │   └── Room.jsx          # Live session page
        ├── components/
        │   ├── Toolbar.jsx       # Drawing tools, color picker, hamburger menu
        │   ├── Canvas.jsx        # Two-layer canvas (main + preview)
        │   ├── ChatPanel.jsx     # Real-time chat UI
        │   ├── VoiceCall.jsx     # Voice call participant cards + mute control
        │   ├── LoginModal.jsx    # Name entry overlay
        │   ├── RoomModal.jsx     # Create / join room modal
        │   └── SpectatorBar.jsx  # Spectator list + swap request UI
        └── hooks/
            ├── useCanvas.js      # Drawing engine, undo/redo, stroke sync
            ├── useSocket.js      # Socket.io connection + all event listeners
            └── useWebRTC.js      # WebRTC peer connection + speaking detection
```

---

## Getting Started

### Prerequisites
- Node.js 18 or higher
- npm 8 or higher

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/sketchify.git
cd sketchify/whiteboard

# Install all dependencies (root + client + server)
npm install
```

### Running in Development

```bash
npm run dev
```

This starts both servers concurrently:
- React frontend → http://localhost:5173
- Node.js backend → http://localhost:3001

Visit http://localhost:5173 in your browser.

### Environment Variables

Create a `.env` file in the `whiteboard/` root:

```env
PORT=3001
NODE_ENV=development
```

---

## How It Works

### Room Lifecycle

```
User clicks "Live Session"
  → Enters name (no password — name only)
    → Creates room (gets 6-char code) OR joins via code
      → Redirected to /room/:code
        → Canvas splits 50/50
          → Second person joins via code → voice + drawing goes live
            → Anyone else who joins → spectator (view only)
              → Everyone leaves → room closes, all data wiped
```

### Drawing Sync

```
You draw a stroke
  → STROKE_START emitted to server
  → Server validates seat ownership
  → Server broadcasts to everyone in room
    → Partner/spectators see it appear live point by point
      → On STROKE_END → stroke saved in server memory
        → New joiners receive full history in ROOM_JOINED payload
```

### Voice Call (WebRTC)

```
Both active users present
  → Seat A creates RTCPeerConnection + sends offer via server
  → Seat B receives offer → creates answer → sends back
  → ICE candidates exchanged (network path discovery)
  → Direct peer-to-peer audio connection established
  → Server no longer involved in audio
```

### Seat Swap

```
Spectator clicks "Request Seat A"
  → Server forwards request to Seat A's active user
  → Active user sees Approve / Deny banner
  → Deny → spectator notified, request cleared
  → Approve → server swaps roles in room state
    → SWAP_BROADCAST sent to everyone
    → Former active user becomes spectator
    → Former spectator becomes active, inherits existing canvas section
```

---

## Known Limitations

- Voice call requires HTTPS in production (browser mic permission restriction)
- WebRTC may fail behind strict corporate firewalls (no TURN server configured)
- Room data is ephemeral — nothing survives a server restart
- Max drawing history: 500 strokes per seat, 200 chat messages per room

---

##  Author

**Ekansh Vishnoi**

- GitHub: https://github.com/Ekanshvishnoi
- LinkedIn: https://linkedin.com/in/ekansh-vishnoi

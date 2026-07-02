/**
 * client/src/pages/Room.jsx
 * Route: /room/:code
 *
 * The live session page. Contains:
 * - Split canvas (Seat A left, Seat B right)
 * - Toolbar with room code
 * - Sidebar: voice placeholder, spectator list, chat placeholder
 * - Toast notifications for connect/disconnect events
 * - "Room closed" screen when everyone leaves
 *
 * HOW THE CANVAS SPLIT WORKS:
 * We create two independent useCanvas instances — one for each half.
 * If you are Seat A, canvasA has readOnly:false (you can draw).
 *   canvasB has readOnly:true (you can only watch).
 * If you are Seat B, it's the opposite.
 * Spectators get readOnly:true on both.
 *
 * WHY WE RE-JOIN ON MOUNT:
 * Home.jsx's socket disconnects when it unmounts (React navigation).
 * So Room.jsx creates a fresh socket and re-sends JOIN_ROOM with the
 * room code from the URL. The server re-assigns the seat correctly
 * because it now checks Seat A first, then Seat B.
 */
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate }           from "react-router-dom";
import { useRoom }                          from "../context/RoomContext";
import { useSocket }                        from "../hooks/useSocket";
import { socket }                           from "../socket.js";
import { useCanvas }                        from "../hooks/useCanvas";
import Toolbar                              from "../components/Toolbar";
import ChatPanel                            from "../components/ChatPanel";


export default function Room() {
  const { code }     = useParams();   // room code from the URL
  const navigate     = useNavigate();

  // Read the user's name from context (set during the modal flow)
  const {
    userName,
    setRole, setSeat, setRoomCode,
  } = useRoom();

  // ── Room state ─────────────────────────────────────────────────────
  const [seats,       setSeats]      = useState({ A: null, B: null });
  const [spectators,  setSpectators] = useState([]);
  const [mySeat,      setMySeat]     = useState(null);   // "A" | "B" | null
  const [myRole,      setMyRole]     = useState(null);   // "active" | "spectator"
  const [roomClosed,  setRoomClosed] = useState(false);
  const [joined,      setJoined]     = useState(false);  // true once ROOM_JOINED fires
  const [panelOpen,   setPanelOpen]  = useState(false);
  const [swapRequest,    setSwapRequest]    = useState(null);  // incoming request for active user
  const [swapDenied,     setSwapDenied]     = useState(false); // feedback for spectator
  const [pendingRequest, setPendingRequest] = useState(null); // "A" | "B" | null

  // ── Tool state (shared between both canvases) ──────────────────────
  const [tool,        setTool]        = useState("pen");
  const [color,       setColor]       = useState("#f0f0f0");
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [bgColor,     setBgColor]     = useState("#1a1a1a");

  // ── Toast notification ─────────────────────────────────────────────
  const [toast, setToast] = useState(null);
  const [messages, setMessages] = useState([]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  // ── Socket callbacks ───────────────────────────────────────────────
  const handleRoomJoined = useCallback((data) => {
    setSeats(data.seats);
    setSpectators(data.spectators);
    setMySeat(data.seat);
    setMyRole(data.role);
    setRole(data.role);
    setSeat(data.seat);
    setRoomCode(data.code);
    setMessages(data.chat || []); // load existing chat history
    setJoined(true);
    console.log(`[Room] Joined as ${data.role}, Seat ${data.seat}`);
  }, [setRole, setSeat, setRoomCode]);

  const handleRoomNotFound = useCallback(() => {
    // Room doesn't exist — send back home
    alert("Room not found. The code may be invalid or the room has closed.");
    navigate("/");
  }, [navigate]);

  const handleRoomClosed = useCallback(() => {
    setRoomClosed(true);
  }, []);

  const handleUserConnected = useCallback(({ name, seat }) => {
    showToast(`${name} joined the room`);
    setSeats(prev => ({
      ...prev,
      [seat]: { name, strokes: [] },
    }));
  }, []);

  const handleUserDisconnected = useCallback(({ name, seat }) => {
    showToast(`${name} left the room`);
    setSeats(prev => ({
      ...prev,
      [seat]: null,
    }));
  }, []);

  // ── Socket ────────────────────────────────────────────────────────
  // Called when a new chat message arrives from the server
  const handleChatMessage = useCallback((msg) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  const handleSpectatorJoined = useCallback(({ name }) => {
    setSpectators(prev => [...prev, { name }]);
    showToast(`${name} is now watching`);
  }, []);

  const handleSpectatorLeft = useCallback(({ name }) => {
    setSpectators(prev => prev.filter(s => s.name !== name));
    showToast(`${name} stopped watching`);
  }, []);
  // Active user receives a swap request from a spectator
  const handleSwapRequest = useCallback(({ fromName, targetSeat }) => {
    setSwapRequest({ fromName, targetSeat });
  }, []);

  // Everyone receives the result of a swap
  const handleSwapBroadcast = useCallback((data) => {
    if (!data.approved) {
      // This client's request was denied
      setPendingRequest(null);  // reset button back to normal
      setSwapDenied(true);
      setTimeout(() => setSwapDenied(false), 4000);
      return;
    }

    // Update seats and spectators from the broadcast
    setSeats(prev => ({
      ...prev,
      A: data.seats.A ? { name: data.seats.A.name, strokes: prev.A?.strokes || [] } : null,
      B: data.seats.B ? { name: data.seats.B.name, strokes: prev.B?.strokes || [] } : null,
    }));
    setSpectators(data.spectators);

    // Update my own role and seat based on my socket id
    const mySocketId = socket.id;
    if (data.seats.A?.socketId === mySocketId) {
      setMySeat("A"); setMyRole("active"); setRole("active"); setSeat("A");
    } else if (data.seats.B?.socketId === mySocketId) {
      setMySeat("B"); setMyRole("active"); setRole("active"); setSeat("B");
    } else {
      setMySeat(null); setMyRole("spectator"); setRole("spectator"); setSeat(null);
    }

    setPendingRequest(null);  // reset in case this client was the requester
    setSwapRequest(null);
    showToast("Seats have been swapped!");
  }, [setRole, setSeat]);


  const { joinRoom, sendMessage, sendSwapRequest, sendSwapResponse } = useSocket({
    onRoomJoined:       handleRoomJoined,
    onRoomNotFound:     handleRoomNotFound,
    onRoomClosed:       handleRoomClosed,
    onUserConnected:    handleUserConnected,
    onUserDisconnected: handleUserDisconnected,
    onChatMessage:      handleChatMessage,
    onSpectatorJoined:  handleSpectatorJoined,
    onSpectatorLeft:    handleSpectatorLeft,
    onSwapRequest:      handleSwapRequest,
    onSwapBroadcast:    handleSwapBroadcast,
  });

  // ── Join room on mount ─────────────────────────────────────────────
  // If userName is empty (e.g. direct URL visit without going through
  // the modal flow), redirect home so they can enter their name first.
  useEffect(() => {
    if (!userName) {
      navigate("/");
      return;
    }
    // Always emit join — server will detect if we're already
    // seated and just re-send room state without re-assigning.
    joinRoom({ roomCode: code, userName, create: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount only

  // ── Two canvas instances — one per seat ───────────────────────────
  const canvasA = useCanvas({
    tool, color, strokeWidth, bgColor,
    readOnly: mySeat !== "A",  // only Seat A can draw on left half
  });

  const canvasB = useCanvas({
    tool, color, strokeWidth, bgColor,
    readOnly: mySeat !== "B",  // only Seat B can draw on right half
  });

  // The canvas that belongs to "me" — used for undo/redo/clear in toolbar
  const myCanvas = mySeat === "A" ? canvasA : canvasB;

  // ── Room closed screen ─────────────────────────────────────────────
  if (roomClosed) {
    return (
      <div style={styles.centered}>
        <div style={styles.closedBox}>
          <div style={styles.closedIcon}>🚪</div>
          <h2 style={styles.closedTitle}>Room closed</h2>
          <p style={styles.closedSub}>
            Everyone has left. The session has ended.
          </p>
          <button
            onClick={() => navigate("/")}
            style={styles.homeBtn}
          >
            Back to home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>

      {/* ── Toolbar ── */}
      <Toolbar
        tool={tool}               onToolChange={setTool}
        color={color}             onColorChange={setColor}
        strokeWidth={strokeWidth} onStrokeWidthChange={setStrokeWidth}
        bgColor={bgColor}         onBgColorChange={setBgColor}
        canUndo={myCanvas?.canUndo}   onUndo={myCanvas?.undo}
        canRedo={myCanvas?.canRedo}   onRedo={myCanvas?.redo}
        onClear={myCanvas?.clearCanvas}
        roomCode={code}
      />

      {/* ── Main area: canvas fills full width now ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>

        {/* ── Split canvas ── */}
        <div style={{ flex: 1, display: "flex", position: "relative" }}>

          {/* Seat A — left half */}
          <div style={{
            flex:         1,
            position:     "relative",
            borderRight:  "1px dashed #2a2a2a",
          }}>
            {/* Seat label */}
            <div style={styles.seatLabel}>
              {seats.A
                ? `${seats.A.name}${mySeat === "A" ? " (you)" : ""}`
                : "Waiting for partner..."
              }
            </div>

            {/* Main canvas — committed strokes */}
            <canvas
              ref={canvasA.mainCanvasRef}
              style={{ position: "absolute", inset: 0, display: "block" }}
            />
            {/* Preview canvas — live shape preview + mouse events */}
            <canvas
              ref={canvasA.previewCanvasRef}
              style={{
                position: "absolute",
                inset:    0,
                display:  "block",
                cursor:   mySeat === "A" ? "crosshair" : "default",
              }}
            />

            {/* Dim overlay when this half is not yours */}
            {joined && mySeat !== "A" && (
              <div style={styles.readOnlyOverlay} />
            )}
          </div>

          {/* Seat B — right half */}
          <div style={{ flex: 1, position: "relative" }}>
            <div style={styles.seatLabel}>
              {seats.B
                ? `${seats.B.name}${mySeat === "B" ? " (you)" : ""}`
                : "Waiting for partner..."
              }
            </div>

            <canvas
              ref={canvasB.mainCanvasRef}
              style={{ position: "absolute", inset: 0, display: "block" }}
            />
            <canvas
              ref={canvasB.previewCanvasRef}
              style={{
                position: "absolute",
                inset:    0,
                display:  "block",
                cursor:   mySeat === "B" ? "crosshair" : "default",
              }}
            />

            {joined && mySeat !== "B" && (
              <div style={styles.readOnlyOverlay} />
            )}
          </div>

        </div>

        {/* ── Slide-out panel toggle button ── */}
        <button
          onClick={() => setPanelOpen(v => !v)}
          style={{
            ...styles.panelToggle,
            right: panelOpen ? 300 : 0,
          }}
          title={panelOpen ? "Close panel" : "Open panel"}
        >
          {panelOpen ? "›" : "‹"}
        </button>

        {/* ── Slide-out panel ── */}
        <div style={{
          ...styles.slidePanel,
          transform: panelOpen ? "translateX(0)" : "translateX(100%)",
        }}>

          {/* Voice — placeholder until Step 6 */}
          <div style={styles.sideSection}>
            <span style={styles.sideLabel}>VOICE CALL</span>
            <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
              Coming in Step 6
            </div>
          </div>

          {/* Spectators */}
          <div style={styles.sideSection}>
            <span style={styles.sideLabel}>
              SPECTATORS ({spectators.length})
            </span>
            <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
              {spectators.length === 0 ? (
                <span style={{ fontSize: 12, color: "#555" }}>None watching</span>
              ) : (
                spectators.map((s, i) => (
                  <div key={i} style={styles.spectatorPill}>
                    👁 {s.name}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Spectator badge */}
          {myRole === "spectator" && (
            <div style={styles.spectatorBadge}>
              <span style={{ fontSize: 12, color: "#aaa" }}>
                You are spectating
              </span>

              {/* Denied feedback */}
              {swapDenied && (
                <div style={styles.deniedNote}>
                  ✕ Your request was denied
                </div>
              )}

              {/* Request buttons — one per occupied seat */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {seats.A && (
                  <button
                    onClick={() => {
                      if (pendingRequest) return;
                      setPendingRequest("A");
                      sendSwapRequest("A");
                    }}
                    disabled={!!pendingRequest}
                    style={{
                      ...styles.requestBtn,
                      ...(pendingRequest === "A" ? styles.requestBtnPending : {}),
                      opacity: pendingRequest && pendingRequest !== "A" ? 0.4 : 1,
                    }}
                  >
                    {pendingRequest === "A" ? "Requested ⏳" : `Request Seat A (${seats.A.name})`}
                  </button>
                )}
                {seats.B && (
                  <button
                    onClick={() => {
                      if (pendingRequest) return;
                      setPendingRequest("B");
                      sendSwapRequest("B");
                    }}
                    disabled={!!pendingRequest}
                    style={{
                      ...styles.requestBtn,
                      ...(pendingRequest === "B" ? styles.requestBtnPending : {}),
                      opacity: pendingRequest && pendingRequest !== "B" ? 0.4 : 1,
                    }}
                  >
                    {pendingRequest === "B" ? "Requested ⏳" : `Request Seat B (${seats.B.name})`}
                  </button>
                )}

                {/* Waiting note */}
                {pendingRequest && !swapDenied && (
                  <div style={styles.waitingNote}>
                    Waiting for approval…
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Swap request banner — shown to the active user being asked */}
          {swapRequest && myRole === "active" && (
            <div style={styles.swapBanner}>
              <div style={styles.swapBannerText}>
                <strong>{swapRequest.fromName}</strong> wants your seat
              </div>
              <div style={styles.swapBannerBtns}>
                <button
                  onClick={() => {
                    sendSwapResponse(false);
                    setSwapRequest(null);
                  }}
                  style={styles.denyBtn}
                >
                  Deny
                </button>
                <button
                  onClick={() => sendSwapResponse(true)}
                  style={styles.approveBtn}
                >
                  Approve
                </button>
              </div>
            </div>
          )}

          {/* Chat */}
          <ChatPanel
            messages={messages}
            onSend={sendMessage}
            myName={userName}
            readOnly={myRole === "spectator"}
          />

        </div>
      </div>

      {/* ── Toast notification ── */}
      {toast && (
        <div style={styles.toast}>
          {toast}
        </div>
      )}

    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────
const styles = {
  seatLabel: {
    position:   "absolute",
    top:        8,
    left:       0,
    right:      0,
    textAlign:  "center",
    fontSize:   11,
    color:      "#666",
    pointerEvents: "none",
    zIndex:     10,
    letterSpacing: "0.04em",
  },
  readOnlyOverlay: {
    position:   "absolute",
    inset:      0,
    background: "rgba(0,0,0,0.08)",
    pointerEvents: "none",  // lets mouse events through to the canvas beneath
    zIndex:     5,
  },
  slidePanel: {
    position:      "fixed",
    top:           48,        // below the toolbar
    right:         0,
    width:         300,
    bottom:        0,
    background:    "#111",
    borderLeft:    "1px solid #1e1e1e",
    display:       "flex",
    flexDirection: "column",
    overflowY:     "auto",
    zIndex:        50,
    transition:    "transform 0.25s ease",
    // Custom scrollbar
    scrollbarWidth: "thin",
    scrollbarColor: "#2a2a2a transparent",
  },
  panelToggle: {
    position:      "fixed",
    top:           "50%",
    transform:     "translateY(-50%)",
    zIndex:        51,
    width:         20,
    height:        48,
    background:    "#1e1e1e",
    border:        "1px solid #2a2a2a",
    borderRight:   "none",
    borderRadius:  "6px 0 0 6px",
    color:         "#888",
    fontSize:      18,
    cursor:        "pointer",
    display:       "flex",
    alignItems:    "center",
    justifyContent:"center",
    transition:    "right 0.25s ease",
    padding:       0,
  },
  sideSection: {
    padding:      "12px 14px",
    borderBottom: "1px solid #1e1e1e",
  },
  sideLabel: {
    fontSize:      10,
    fontWeight:    600,
    color:         "#444",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  spectatorPill: {
    fontSize:     12,
    color:        "#888",
    padding:      "3px 0",
  },
  spectatorBadge: {
    margin:        "10px 14px",
    padding:       "10px 12px",
    background:    "#1a1a00",
    border:        "1px solid #333300",
    borderRadius:  8,
    fontSize:      12,
    color:         "#aaa900",
    display:       "flex",
    flexDirection: "column",
    gap:           8,
  },
  requestBtn: {
    padding:      "8px",
    borderRadius: 6,
    border:       "1px solid #555500",
    background:   "transparent",
    color:        "#dddd00",
    fontSize:     12,
    cursor:       "pointer",
    width:        "100%",
    transition:   "all 0.2s ease",
    textAlign:    "center",
  },
  requestBtnPending: {
    border:       "1px solid #333",
    color:        "#888",
    cursor:       "not-allowed",
  },
  waitingNote: {
    fontSize:     11,
    color:        "#666",
    textAlign:    "center",
    fontStyle:    "italic",
    marginTop:    2,
  },
  toast: {
    position:     "fixed",
    bottom:       24,
    left:         "50%",
    transform:    "translateX(-50%)",
    background:   "#1e1e1e",
    border:       "1px solid #333",
    borderRadius: 8,
    padding:      "9px 18px",
    fontSize:     13,
    color:        "#f0f0f0",
    zIndex:       300,
    boxShadow:    "0 4px 20px rgba(0,0,0,0.4)",
    pointerEvents:"none",
  },
  centered: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    height:         "100vh",
    background:     "#0d0d0d",
  },
  closedBox: {
    background:    "#1e1e1e",
    border:        "1px solid #2a2a2a",
    borderRadius:  14,
    padding:       "40px 48px",
    textAlign:     "center",
    display:       "flex",
    flexDirection: "column",
    gap:           12,
    alignItems:    "center",
  },
  closedIcon: {
    fontSize: 40,
  },
  closedTitle: {
    fontSize:   20,
    fontWeight: 600,
    color:      "#f0f0f0",
    margin:     0,
  },
  closedSub: {
    fontSize: 13,
    color:    "#666",
    margin:   0,
  },
  homeBtn: {
    marginTop:    8,
    padding:      "9px 24px",
    borderRadius: 8,
    border:       "none",
    background:   "#1d4ed8",
    color:        "#fff",
    fontSize:     14,
    cursor:       "pointer",
  },
  swapBanner: {
    margin:        "10px 12px",
    padding:       "12px",
    background:    "#1a1500",
    border:        "1px solid #3d3000",
    borderRadius:  8,
    display:       "flex",
    flexDirection: "column",
    gap:           10,
    flexShrink:    0,
  },
  swapBannerText: {
    fontSize: 13,
    color:    "#e0c060",
  },
  swapBannerBtns: {
    display: "flex",
    gap:     8,
  },
  approveBtn: {
    flex:         1,
    padding:      "6px",
    borderRadius: 6,
    border:       "none",
    background:   "#1d4ed8",
    color:        "#fff",
    fontSize:     12,
    cursor:       "pointer",
    fontWeight:   500,
  },
  denyBtn: {
    flex:         1,
    padding:      "6px",
    borderRadius: 6,
    border:       "1px solid #3d1010",
    background:   "transparent",
    color:        "#f87171",
    fontSize:     12,
    cursor:       "pointer",
  },
  deniedNote: {
    fontSize:     12,
    color:        "#f87171",
    background:   "#1a0000",
    border:       "1px solid #3d0000",
    borderRadius: 6,
    padding:      "6px 10px",
  },
};
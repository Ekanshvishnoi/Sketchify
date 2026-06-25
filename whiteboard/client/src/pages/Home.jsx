/**
 * client/src/pages/Home.jsx
 *
 * The solo whiteboard page (route: /).
 *
 * This file now does two things:
 *   1. Renders the solo canvas + toolbar (same as before)
 *   2. Manages the "Live Session" modal flow:
 *        "Live Session" clicked
 *          → LoginModal (enter name)
 *            → RoomModal (create or join)
 *              → on success: navigate to /room/:code
 *
 * MODAL FLOW STATE:
 * We use a single `modal` string to track which overlay is visible:
 *   null       → no modal, just the canvas
 *   "login"    → LoginModal is open
 *   "room"     → RoomModal is open
 */
import { useState, useCallback } from "react";
import { useNavigate }           from "react-router-dom";
import { useCanvas }             from "../hooks/useCanvas";
import { useSocket }             from "../hooks/useSocket";
import { useRoom }               from "../context/RoomContext";
import Toolbar                   from "../components/Toolbar";
import LoginModal                from "../components/LoginModal";
import RoomModal                 from "../components/RoomModal";

export default function Home() {

  // ── Drawing state ────────────────────────────────────────────────
  const [tool,        setTool]        = useState("pen");
  const [color,       setColor]       = useState("#f0f0f0");
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [bgColor,     setBgColor]     = useState("#1a1a1a");

  // ── Modal flow state ─────────────────────────────────────────────
  const [modal,      setModal]      = useState(null);   // null | "login" | "room"
  const [roomError,  setRoomError]  = useState("");     // error msg for RoomModal

  // ── Global room context (stores name/role/seat for use in Room page) ──
  const { setUserName, setRole, setSeat, setRoomCode } = useRoom();

  // ── React Router navigation ──────────────────────────────────────
  // useNavigate() gives us a function to change the URL programmatically.
  // We use it to redirect to /room/:code after a successful join.
  const navigate = useNavigate();

  // ── Canvas hook ───────────────────────────────────────────────────
  const {
    mainCanvasRef,
    previewCanvasRef,
    undo, redo,
    canUndo, canRedo,
    clearCanvas,
  } = useCanvas({ tool, color, strokeWidth, bgColor });

  // ── Socket callbacks ─────────────────────────────────────────────
  // These are defined with useCallback so they don't change on every
  // render — important because useSocket stores them in refs.

  const handleRoomJoined = useCallback((data) => {
    // Save everything we know about this user's room session
    // into the global RoomContext so Room.jsx can read it.
    setUserName(data.userName);
    setRole(data.role);
    setSeat(data.seat);
    setRoomCode(data.code);

    // Close the modal and navigate to the room page.
    setModal(null);
    navigate(`/room/${data.code}`);
  }, [navigate, setUserName, setRole, setSeat, setRoomCode]);

  const handleRoomNotFound = useCallback(() => {
    // Show an inline error inside RoomModal — don't close it.
    setRoomError("Room not found. Check the code and try again.");
  }, []);

  // ── useSocket ─────────────────────────────────────────────────────
  const { joinRoom } = useSocket({
    onRoomJoined:    handleRoomJoined,
    onRoomNotFound:  handleRoomNotFound,
    onRoomClosed:    () => {},   // not relevant on the Home page
    onUserConnected: () => {},
    onUserDisconnected: () => {},
  });

  // ── Modal action handlers ─────────────────────────────────────────

  // Step 1: user clicks "Live Session" on the toolbar
  function handleLiveSessionClick() {
    setModal("login");
  }

  // Step 2: user submits their name in LoginModal
  function handleNameSubmit(name) {
    setUserName(name);   // store in context so RoomModal can display it
    setModal("room");
  }

  // Step 3a: user clicks "Create a new room"
  function handleCreateRoom() {
    const name = localStorage.getItem("wb_name") || "";
    joinRoom({ roomCode: null, userName: name, create: true });
  }

  // Step 3b: user submits a room code to join
  function handleJoinRoom(code) {
    const name = localStorage.getItem("wb_name") || "";
    joinRoom({ roomCode: code, userName: name, create: false });
  }

  // ── Helper: get the current name from context ─────────────────────
  // We read it from context (set in step 2) to pass into RoomModal.
  const [localName, setLocalName] = useState("");

  function handleNameSubmitFinal(name) {
    setLocalName(name);
    setModal("room");
  }

  function handleCreateRoomFinal() {
    setRoomError("");
    joinRoom({ roomCode: null, userName: localName, create: true });
  }

  function handleJoinRoomFinal(code) {
    setRoomError("");
    joinRoom({ roomCode: code, userName: localName, create: false });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>

      {/* ── Toolbar ── */}
      <Toolbar
        tool={tool}               onToolChange={setTool}
        color={color}             onColorChange={setColor}
        strokeWidth={strokeWidth} onStrokeWidthChange={setStrokeWidth}
        bgColor={bgColor}         onBgColorChange={setBgColor}
        canUndo={canUndo}         onUndo={undo}
        canRedo={canRedo}         onRedo={redo}
        onClear={clearCanvas}
        onLiveSession={handleLiveSessionClick}
      />

      {/* ── Canvas area ── */}
      <div style={{ flex: 1, position: "relative" }}>
        <canvas
          ref={mainCanvasRef}
          style={{ position: "absolute", inset: 0, display: "block" }}
        />
        <canvas
          ref={previewCanvasRef}
          style={{
            position: "absolute",
            inset:    0,
            display:  "block",
            cursor:   "crosshair",
          }}
        />
      </div>

      {/* ── Modal overlays ── */}

      {modal === "login" && (
        <LoginModal
          onContinue={handleNameSubmitFinal}
          onCancel={() => setModal(null)}
        />
      )}

      {modal === "room" && (
        <RoomModal
          userName={localName}
          onCreateRoom={handleCreateRoomFinal}
          onJoinRoom={handleJoinRoomFinal}
          onCancel={() => setModal(null)}
          error={roomError}
        />
      )}

    </div>
  );
}
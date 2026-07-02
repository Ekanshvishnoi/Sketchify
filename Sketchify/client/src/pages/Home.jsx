/**
 * client/src/pages/Home.jsx
 * Cleaned up — removed duplicate handlers, fixed stale state bug.
 */
import { useState, useCallback, useRef } from "react";
import { useNavigate }                   from "react-router-dom";
import { useCanvas }                     from "../hooks/useCanvas";
import { useSocket }                     from "../hooks/useSocket";
import { useRoom }                       from "../context/RoomContext";
import Toolbar                           from "../components/Toolbar";
import LoginModal                        from "../components/LoginModal";
import RoomModal                         from "../components/RoomModal";

export default function Home() {

  // ── Drawing state ──────────────────────────────────────────────
  const [tool,        setTool]        = useState("pen");
  const [color,       setColor]       = useState("#f0f0f0");
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [bgColor,     setBgColor]     = useState("#1a1a1a");

  // ── Modal state ────────────────────────────────────────────────
  const [modal,     setModal]     = useState(null); // null | "login" | "room"
  const [roomError, setRoomError] = useState("");

  // ── Store the name in a ref so handlers always read latest value
  //    without depending on React state batching timing ──────────
  const nameRef    = useRef("");
  const [displayName, setDisplayName] = useState(""); // only for RoomModal display

  // ── Context + navigation ───────────────────────────────────────
  const { setUserName, setRole, setSeat, setRoomCode } = useRoom();
  const navigate = useNavigate();

  // ── Canvas ─────────────────────────────────────────────────────
  const {
    mainCanvasRef, previewCanvasRef,
    undo, redo, canUndo, canRedo, clearCanvas,
  } = useCanvas({ tool, color, strokeWidth, bgColor });

  // ── Socket callbacks ───────────────────────────────────────────
  const handleRoomJoined = useCallback((data) => {
    setUserName(nameRef.current);
    setRole(data.role);
    setSeat(data.seat);
    setRoomCode(data.code);
    setModal(null);
    navigate(`/room/${data.code}`);
  }, [navigate, setUserName, setRole, setSeat, setRoomCode]);

  const handleRoomNotFound = useCallback(() => {
    setRoomError("Room not found. Check the code and try again.");
  }, []);

  const { joinRoom } = useSocket({
    onRoomJoined:       handleRoomJoined,
    onRoomNotFound:     handleRoomNotFound,
    onRoomClosed:       () => {},
    onUserConnected:    () => {},
    onUserDisconnected: () => {},
  });

  // ── Modal flow ─────────────────────────────────────────────────

  // Step 1 — toolbar button
  function handleLiveSession() {
    setModal("login");
  }

  // Step 2 — name submitted in LoginModal
  function handleNameSubmit(name) {
    nameRef.current = name;     // store in ref — always fresh
    setDisplayName(name);       // store in state — for RoomModal display only
    setModal("room");
  }

  // Step 3a — create room
  function handleCreateRoom() {
    setRoomError("");
    joinRoom({ roomCode: null, userName: nameRef.current, create: true });
  }

  // Step 3b — join room by code
  function handleJoinRoom(code) {
    setRoomError("");
    joinRoom({ roomCode: code, userName: nameRef.current, create: false });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>

      <Toolbar
        tool={tool}               onToolChange={setTool}
        color={color}             onColorChange={setColor}
        strokeWidth={strokeWidth} onStrokeWidthChange={setStrokeWidth}
        bgColor={bgColor}         onBgColorChange={setBgColor}
        canUndo={canUndo}         onUndo={undo}
        canRedo={canRedo}         onRedo={redo}
        onClear={clearCanvas}
        onLiveSession={handleLiveSession}
      />

      <div style={{ flex: 1, position: "relative" }}>
        <canvas
          ref={mainCanvasRef}
          style={{ position: "absolute", inset: 0, display: "block" }}
        />
        <canvas
          ref={previewCanvasRef}
          style={{ position: "absolute", inset: 0, display: "block", cursor: "crosshair" }}
        />
      </div>

      {modal === "login" && (
        <LoginModal
          onContinue={handleNameSubmit}
          onCancel={() => setModal(null)}
        />
      )}

      {modal === "room" && (
        <RoomModal
          userName={displayName}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onCancel={() => setModal(null)}
          error={roomError}
        />
      )}

    </div>
  );
}
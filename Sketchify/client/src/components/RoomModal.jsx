/**
 * client/src/components/RoomModal.jsx
 *
 * Appears after the user enters their name in LoginModal.
 * Gives two choices:
 *   1. Create a new room  → emits JOIN_ROOM with create:true
 *   2. Join existing room → takes a code input, emits JOIN_ROOM with create:false
 *
 * Props:
 *   userName          — the name chosen in LoginModal
 *   onCreateRoom()    — called when user clicks "Create a new room"
 *   onJoinRoom(code)  — called when user submits a room code
 *   onCancel()        — called when user clicks Cancel
 *   error             — error string passed in from parent (e.g. "Room not found")
 */
import { useState } from "react";

export default function RoomModal({
  userName,
  onCreateRoom,
  onJoinRoom,
  onCancel,
  error,
}) {
  const [code,     setCode]     = useState("");
  const [codeError, setCodeError] = useState("");

  function handleJoin() {
    const trimmed = code.trim().toUpperCase();

    if (trimmed.length !== 6) {
      setCodeError("Room code must be exactly 6 characters.");
      return;
    }

    setCodeError("");
    onJoinRoom(trimmed);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") handleJoin();
  }

  return (
    <div style={styles.backdrop}>
      <div style={styles.modal}>

        {/* Header */}
        <h2 style={styles.title}>Start or join a room</h2>
        <p style={styles.subtitle}>
          Playing as <strong style={{ color: "#f0f0f0" }}>{userName}</strong>
        </p>

        {/* ── Option 1: Create ── */}
        <button
          onClick={onCreateRoom}
          style={styles.createBtn}
        >
          <span style={styles.createIcon}>＋</span>
          Create a new room
        </button>

        {/* Divider */}
        <div style={styles.dividerRow}>
          <div style={styles.dividerLine} />
          <span style={styles.dividerText}>or</span>
          <div style={styles.dividerLine} />
        </div>

        {/* ── Option 2: Join ── */}
        <div style={styles.joinSection}>
          <input
            type="text"
            placeholder="Enter room code (e.g. X7K2PQ)"
            value={code}
            onChange={e => {
              // Only allow alphanumeric, max 6 chars, auto uppercase
              const val = e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6);
              setCode(val);
              setCodeError("");
            }}
            onKeyDown={handleKeyDown}
            style={{
              ...styles.input,
              ...((codeError || error) ? styles.inputError : {}),
              letterSpacing: "0.15em",
              textAlign: "center",
              fontFamily: "monospace",
              textTransform: "uppercase",
            }}
            maxLength={6}
          />

          {/* Inline validation error */}
          {codeError && <p style={styles.errorText}>{codeError}</p>}

          {/* Server-side error (room not found etc.) */}
          {error && <p style={styles.errorText}>{error}</p>}

          <button
            onClick={handleJoin}
            style={styles.joinBtn}
          >
            Join room →
          </button>
        </div>

        {/* Cancel */}
        <button onClick={onCancel} style={styles.cancelBtn}>
          Cancel
        </button>

      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────
const styles = {
  backdrop: {
    position:       "fixed",
    inset:          0,
    background:     "rgba(0,0,0,0.6)",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    zIndex:         200,
  },
  modal: {
    background:    "#1e1e1e",
    border:        "1px solid #2a2a2a",
    borderRadius:  14,
    padding:       "28px 28px 22px",
    width:         340,
    display:       "flex",
    flexDirection: "column",
    gap:           12,
    boxShadow:     "0 8px 40px rgba(0,0,0,0.6)",
  },
  title: {
    fontSize:   18,
    fontWeight: 600,
    color:      "#f0f0f0",
    margin:     0,
  },
  subtitle: {
    fontSize: 13,
    color:    "#888",
    margin:   0,
  },
  createBtn: {
    display:       "flex",
    alignItems:    "center",
    justifyContent:"center",
    gap:           8,
    padding:       "11px",
    borderRadius:  8,
    border:        "none",
    background:    "#1d4ed8",
    color:         "#fff",
    fontSize:      14,
    fontWeight:    500,
    cursor:        "pointer",
    marginTop:     4,
  },
  createIcon: {
    fontSize: 18,
    lineHeight: 1,
  },
  dividerRow: {
    display:    "flex",
    alignItems: "center",
    gap:        10,
    margin:     "2px 0",
  },
  dividerLine: {
    flex:       1,
    height:     1,
    background: "#2a2a2a",
  },
  dividerText: {
    fontSize: 12,
    color:    "#555",
  },
  joinSection: {
    display:       "flex",
    flexDirection: "column",
    gap:           8,
  },
  input: {
    padding:      "9px 12px",
    borderRadius: 8,
    border:       "1px solid #333",
    background:   "#111",
    color:        "#f0f0f0",
    fontSize:     15,
    outline:      "none",
    width:        "100%",
  },
  inputError: {
    border: "1px solid #ef4444",
  },
  errorText: {
    fontSize: 12,
    color:    "#ef4444",
    margin:   0,
  },
  joinBtn: {
    padding:      "9px",
    borderRadius: 8,
    border:       "1px solid #333",
    background:   "transparent",
    color:        "#f0f0f0",
    fontSize:     14,
    cursor:       "pointer",
    width:        "100%",
  },
  cancelBtn: {
    padding:      "7px",
    borderRadius: 8,
    border:       "none",
    background:   "transparent",
    color:        "#555",
    fontSize:     13,
    cursor:       "pointer",
    marginTop:    2,
    width:        "100%",
  },
};
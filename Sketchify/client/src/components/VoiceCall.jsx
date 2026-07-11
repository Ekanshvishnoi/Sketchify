/**
 * client/src/components/VoiceCall.jsx
 *
 * The voice call UI shown in the slide-out panel.
 * Only rendered for active users — spectators never see this.
 *
 * Props:
 *   mySeat        — "A" | "B"
 *   myName        — current user's name
 *   partnerSeat   — "A" | "B" (opposite of mySeat)
 *   partnerName   — partner's name (null if not joined yet)
 *   isActive      — true if this user is an active participant
 *   seats         — full seats object from room state
 */
import { useRef } from "react";
import { useWebRTC } from "../hooks/useWebRTC";

export default function VoiceCall({
  mySeat,
  myName,
  partnerSeat,
  partnerName,
  isActive,
  seats,
}) {
  const {
    isMuted,
    toggleMute,
    isSpeaking,
    isConnected,
    micError,
    audioRef,
  } = useWebRTC({ mySeat, partnerSeat, isActive, seats });

  // Avatar initials + color per seat
  const avatarColors = {
    A: { bg: "#1d3a6e", color: "#93c5fd" },
    B: { bg: "#1a2e1a", color: "#86efac" },
  };

  const myAvatar      = avatarColors[mySeat]     || avatarColors.A;
  const partnerAvatar = avatarColors[partnerSeat] || avatarColors.B;

  const partnerPresent = !!seats?.[partnerSeat];

  return (
    <div style={styles.container}>

      {/* Hidden audio element — plays partner's incoming audio */}
      {/* autoPlay is required — without it the browser won't play */}
      <audio ref={audioRef} autoPlay playsInline style={{ display: "none" }} />

      {/* ── Section label + status badge ── */}
      <div style={styles.header}>
        <span style={styles.label}>VOICE</span>
        {partnerPresent && isConnected ? (
          <span style={styles.liveBadge}>
            <span style={styles.liveDot} />
            Live
          </span>
        ) : partnerPresent ? (
          <span style={styles.connectingBadge}>Connecting…</span>
        ) : (
          <span style={styles.waitingBadge}>Waiting…</span>
        )}
      </div>

      {/* ── Mic error ── */}
      {micError && (
        <div style={styles.micError}>
          🎙 {micError}
        </div>
      )}

      {/* ── Your card ── */}
      <div style={styles.card}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          {/* Speaking ring — animates when you're talking and not muted */}
          {isSpeaking && !isMuted && (
            <div style={styles.speakingRing} />
          )}
          <div style={{
            ...styles.avatar,
            background: myAvatar.bg,
            color:      myAvatar.color,
          }}>
            {myName?.[0]?.toUpperCase() || "?"}
          </div>
          <div style={styles.onlineDot} />
        </div>

        <div style={styles.cardInfo}>
          <div style={styles.name}>{myName} (you)</div>
          <div style={styles.statusText}>
            {isMuted ? "Muted" : isSpeaking ? "Speaking…" : "Listening"}
          </div>
        </div>

        {/* Mute toggle — only on your own card */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <button
            onClick={toggleMute}
            title={isMuted ? "Unmute" : "Mute"}
            style={{
              ...styles.muteBtn,
              ...(isMuted ? styles.muteBtnMuted : {}),
            }}
          >
            {isMuted ? "🔇" : "🎙"}
          </button>
          <span style={{
            fontSize: 9,
            color: isMuted ? "#f87171" : "var(--text-muted, #555)",
          }}>
            {isMuted ? "unmute" : "mute"}
          </span>
        </div>
      </div>

      {/* ── Partner card ── */}
      <div style={{
        ...styles.card,
        ...(partnerPresent ? {} : styles.cardDimmed),
      }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div style={{
            ...styles.avatar,
            background: partnerAvatar.bg,
            color:      partnerAvatar.color,
            opacity:    partnerPresent ? 1 : 0.4,
          }}>
            {partnerPresent ? partnerName?.[0]?.toUpperCase() : "?"}
          </div>
          <div style={{
            ...styles.onlineDot,
            background: partnerPresent ? "#22c55e" : "#555",
          }} />
        </div>

        <div style={styles.cardInfo}>
          <div style={styles.name}>
            {partnerPresent ? partnerName : "Empty seat"}
          </div>
          <div style={styles.statusText}>
            {partnerPresent
              ? isConnected ? "Connected" : "Connecting…"
              : "Not joined yet"
            }
          </div>
        </div>

        {/* Partner mic status — display only, not clickable */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div style={{
            ...styles.muteBtn,
            cursor:     "default",
            opacity:    partnerPresent ? 1 : 0.3,
            background: "transparent",
            border:     "0.5px solid #2a2a2a",
          }}>
            🎙
          </div>
          <span style={{ fontSize: 9, color: "#555" }}>
            {partnerPresent ? "live" : "—"}
          </span>
        </div>
      </div>

      {/* ── Waiting note ── */}
      {!partnerPresent && (
        <div style={styles.waitingNote}>
          Voice goes live when your partner joins
        </div>
      )}

    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────
const styles = {
  container: {
    padding:       "12px 14px",
    borderBottom:  "1px solid #1e1e1e",
    display:       "flex",
    flexDirection: "column",
    gap:           8,
  },
  header: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "space-between",
    marginBottom:   2,
  },
  label: {
    fontSize:      10,
    fontWeight:    600,
    color:         "#444",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  liveBadge: {
    display:      "inline-flex",
    alignItems:   "center",
    gap:          5,
    padding:      "2px 8px",
    borderRadius: 20,
    background:   "#0d2e0d",
    border:       "0.5px solid #1a4a1a",
    fontSize:     11,
    color:        "#86efac",
  },
  liveDot: {
    width:        7,
    height:       7,
    borderRadius: "50%",
    background:   "#22c55e",
    display:      "inline-block",
  },
  connectingBadge: {
    padding:      "2px 8px",
    borderRadius: 20,
    background:   "#1a1a00",
    border:       "0.5px solid #333300",
    fontSize:     11,
    color:        "#aaaa00",
  },
  waitingBadge: {
    padding:      "2px 8px",
    borderRadius: 20,
    background:   "#1a1a1a",
    border:       "0.5px solid #2a2a2a",
    fontSize:     11,
    color:        "#555",
  },
  micError: {
    fontSize:     11,
    color:        "#f87171",
    background:   "#2d1515",
    border:       "0.5px solid #5a2020",
    borderRadius: 6,
    padding:      "6px 10px",
  },
  card: {
    display:      "flex",
    alignItems:   "center",
    gap:          10,
    padding:      "8px 10px",
    borderRadius: 10,
    background:   "#161616",
    border:       "0.5px solid #2a2a2a",
    position:     "relative",
  },
  cardDimmed: {
    opacity: 0.45,
  },
  avatar: {
    width:        38,
    height:       38,
    borderRadius: "50%",
    display:      "flex",
    alignItems:   "center",
    justifyContent:"center",
    fontSize:     15,
    fontWeight:   500,
  },
  onlineDot: {
    width:        9,
    height:       9,
    borderRadius: "50%",
    background:   "#22c55e",
    border:       "1.5px solid #161616",
    position:     "absolute",
    bottom:       1,
    right:        1,
  },
  speakingRing: {
    position:     "absolute",
    inset:        -3,
    borderRadius: "50%",
    border:       "2px solid #22c55e",
    animation:    "speakPulse 1.5s infinite",
    pointerEvents:"none",
  },
  cardInfo: {
    flex:    1,
    minWidth:0,
  },
  name: {
    fontSize:   13,
    fontWeight: 500,
    color:      "#f0f0f0",
  },
  statusText: {
    fontSize:  11,
    color:     "#555",
    marginTop: 2,
  },
  muteBtn: {
    width:          30,
    height:         30,
    borderRadius:   "50%",
    border:         "0.5px solid #2a2a2a",
    background:     "#111",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    cursor:         "pointer",
    fontSize:       14,
    flexShrink:     0,
  },
  muteBtnMuted: {
    background: "#2d1515",
    border:     "0.5px solid #5a2020",
  },
  waitingNote: {
    fontSize:  11,
    color:     "#444",
    textAlign: "center",
    fontStyle: "italic",
    marginTop: 2,
  },
};
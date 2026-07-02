/**
 * client/src/components/ChatPanel.jsx
 *
 * Real-time chat panel shown in the Room sidebar.
 *
 * Props:
 *   messages  — array of { id, name, text, timestamp }
 *   onSend(text) — called when the user sends a message
 *   myName    — the current user's name (to style own messages differently)
 *   readOnly  — true for spectators (hides input, shows read-only label)
 */
import { useState, useEffect, useRef } from "react";

// Format a Unix timestamp into a short "HH:MM" string
function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ChatPanel({ messages = [], onSend, myName, readOnly }) {
  const [input,      setInput]      = useState("");
  const [error,      setError]      = useState("");
  const bottomRef = useRef(null);   // used to auto-scroll to latest message

  // ── Auto-scroll to bottom whenever messages change ───────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send handler ─────────────────────────────────────────────────
  function handleSend() {
    const trimmed = input.trim();

    if (trimmed.length === 0) return;

    if (trimmed.length > 500) {
      setError("Message too long (max 500 characters).");
      return;
    }

    setError("");
    onSend(trimmed);
    setInput("");
  }

  // Allow Enter to send, Shift+Enter for newline
  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div style={styles.container}>

      {/* ── Section label ── */}
      <div style={styles.header}>
        <span style={styles.headerLabel}>CHAT</span>
        {readOnly && (
          <span style={styles.readOnlyBadge}>read only</span>
        )}
      </div>

      {/* ── Message list ── */}
      <div style={styles.messageList}>
        {messages.length === 0 ? (
          <div style={styles.emptyState}>
            No messages yet.{" "}
            {!readOnly && "Say something!"}
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.name === myName;
            return (
              <div
                key={msg.id}
                style={{
                  ...styles.messageRow,
                  ...(isMe ? styles.messageRowMe : {}),
                }}
              >
                {/* Bubble */}
                <div
                  style={{
                    ...styles.bubble,
                    ...(isMe ? styles.bubbleMe : styles.bubbleThem),
                  }}
                >
                  {/* Name — only shown for the other person's messages */}
                  {!isMe && (
                    <div style={styles.senderName}>{msg.name}</div>
                  )}

                  {/* Message text */}
                  <div style={styles.messageText}>{msg.text}</div>

                  {/* Timestamp */}
                  <div style={styles.timestamp}>
                    {formatTime(msg.timestamp)}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Invisible element at the bottom — scrolled into view on new message */}
        <div ref={bottomRef} />
      </div>

      {/* ── Input area — hidden for spectators ── */}
      {!readOnly ? (
        <div style={styles.inputArea}>
          {error && <div style={styles.errorText}>{error}</div>}
          <div style={styles.inputRow}>
            <textarea
              value={input}
              onChange={e => { setInput(e.target.value); setError(""); }}
              onKeyDown={handleKeyDown}
              placeholder="Message… (Enter to send)"
              rows={1}
              maxLength={500}
              style={styles.textarea}
            />
            <button
              onClick={handleSend}
              disabled={input.trim().length === 0}
              style={{
                ...styles.sendBtn,
                opacity: input.trim().length === 0 ? 0.4 : 1,
              }}
            >
              ↑
            </button>
          </div>
        </div>
      ) : (
        <div style={styles.spectatorNote}>
          Only active users can chat
        </div>
      )}

    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────
const styles = {
  container: {
    display:       "flex",
    flexDirection: "column",
    flex:          1,
    minHeight:     0,   // critical — allows flex child to shrink below content height
    overflow:      "hidden",
  },
  header: {
    display:       "flex",
    alignItems:    "center",
    justifyContent:"space-between",
    padding:       "10px 14px 6px",
    borderBottom:  "1px solid #1e1e1e",
    flexShrink:    0,
  },
  headerLabel: {
    fontSize:      10,
    fontWeight:    600,
    color:         "#444",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  readOnlyBadge: {
    fontSize:     10,
    color:        "#555",
    background:   "#1a1a1a",
    padding:      "2px 6px",
    borderRadius: 4,
    border:       "1px solid #2a2a2a",
  },
  messageList: {
    flex:      1,
    overflowY: "auto",
    padding:   "10px 10px 4px",
    display:   "flex",
    flexDirection: "column",
    gap:       6,
    // Custom scrollbar
    scrollbarWidth: "thin",
    scrollbarColor: "#2a2a2a transparent",
  },
  emptyState: {
    fontSize:  12,
    color:     "#444",
    textAlign: "center",
    marginTop: 16,
  },
  messageRow: {
    display:       "flex",
    justifyContent:"flex-start",  // other person — left aligned
  },
  messageRowMe: {
    justifyContent: "flex-end",   // my messages — right aligned
  },
  bubble: {
    maxWidth:     "82%",
    padding:      "7px 10px",
    borderRadius: 10,
    display:      "flex",
    flexDirection:"column",
    gap:          3,
  },
  bubbleThem: {
    background:        "#1e1e1e",
    border:            "1px solid #2a2a2a",
    borderBottomLeftRadius: 3,
  },
  bubbleMe: {
    background:         "#1d3a6e",
    border:             "1px solid #1e40af",
    borderBottomRightRadius: 3,
  },
  senderName: {
    fontSize:   10,
    fontWeight: 600,
    color:      "#888",
    marginBottom: 1,
  },
  messageText: {
    fontSize:   13,
    color:      "#f0f0f0",
    lineHeight: 1.4,
    wordBreak:  "break-word",
    whiteSpace: "pre-wrap",  // preserve line breaks from Shift+Enter
  },
  timestamp: {
    fontSize:  10,
    color:     "#555",
    alignSelf: "flex-end",
    marginTop: 1,
  },
  inputArea: {
    padding:   "8px 10px",
    borderTop: "1px solid #1e1e1e",
    flexShrink: 0,
  },
  inputRow: {
    display:   "flex",
    gap:       6,
    alignItems:"flex-end",
  },
  textarea: {
    flex:        1,
    padding:     "7px 10px",
    borderRadius: 8,
    border:      "1px solid #2a2a2a",
    background:  "#111",
    color:       "#f0f0f0",
    fontSize:    13,
    resize:      "none",
    outline:     "none",
    lineHeight:  1.4,
    fontFamily:  "inherit",
    maxHeight:   80,
    overflowY:   "auto",
  },
  sendBtn: {
    width:        32,
    height:       32,
    borderRadius: "50%",
    border:       "none",
    background:   "#1d4ed8",
    color:        "#fff",
    fontSize:     16,
    cursor:       "pointer",
    flexShrink:   0,
    display:      "flex",
    alignItems:   "center",
    justifyContent:"center",
    transition:   "opacity 0.15s",
  },
  spectatorNote: {
    padding:   "10px 14px",
    fontSize:  11,
    color:     "#444",
    borderTop: "1px solid #1e1e1e",
    fontStyle: "italic",
    flexShrink: 0,
  },
  errorText: {
    fontSize:    11,
    color:       "#ef4444",
    marginBottom: 4,
  },
};
/**
 * client/src/components/LoginModal.jsx
 *
 * The name-entry overlay that appears when the user clicks "Live Session".
 * It sits on top of the canvas as a centered modal.
 *
 * Props:
 *   onContinue(name) — called when the user submits a valid name
 *   onCancel()       — called when the user clicks Cancel
 */
import { useState } from "react";

export default function LoginModal({ onContinue, onCancel }) {
  const [name,  setName]  = useState("");
  const [error, setError] = useState("");

  function handleSubmit() {
    const trimmed = name.trim();

    // Basic validation — name must be at least 2 characters
    if (trimmed.length < 2) {
      setError("Name must be at least 2 characters.");
      return;
    }
    if (trimmed.length > 20) {
      setError("Name must be 20 characters or less.");
      return;
    }

    // Clear error and continue
    setError("");
    onContinue(trimmed);
  }

  // Allow pressing Enter to submit
  function handleKeyDown(e) {
    if (e.key === "Enter") handleSubmit();
  }

  return (
    // ── Backdrop — dark overlay behind the modal ──
    <div style={styles.backdrop}>

      {/* ── Modal box ── */}
      <div style={styles.modal}>

        {/* Title */}
        <h2 style={styles.title}>Pick a name</h2>
        <p style={styles.subtitle}>
          This is how others in the room will see you.
        </p>

        {/* Name input */}
        <input
          type="text"
          placeholder="Your name (e.g. Priya)"
          value={name}
          onChange={e => { setName(e.target.value); setError(""); }}
          onKeyDown={handleKeyDown}
          autoFocus
          maxLength={20}
          style={{
            ...styles.input,
            ...(error ? styles.inputError : {}),
          }}
        />

        {/* Inline error message */}
        {error && (
          <p style={styles.errorText}>{error}</p>
        )}

        {/* Buttons */}
        <div style={styles.btnRow}>
          <button onClick={onCancel}    style={styles.cancelBtn}>Cancel</button>
          <button onClick={handleSubmit} style={styles.continueBtn}>Continue</button>
        </div>

      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────
const styles = {
  backdrop: {
    position:       "fixed",
    inset:          0,
    background:     "rgba(0, 0, 0, 0.6)",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    zIndex:         200,
    // subtle fade-in
    animation:      "fadeIn 0.15s ease",
  },
  modal: {
    background:   "#1e1e1e",
    border:       "1px solid #2a2a2a",
    borderRadius: 14,
    padding:      "28px 28px 24px",
    width:        320,
    display:      "flex",
    flexDirection:"column",
    gap:          12,
    boxShadow:    "0 8px 40px rgba(0,0,0,0.6)",
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
  input: {
    padding:      "9px 12px",
    borderRadius: 8,
    border:       "1px solid #333",
    background:   "#111",
    color:        "#f0f0f0",
    fontSize:     14,
    outline:      "none",
    transition:   "border 0.15s",
  },
  inputError: {
    border: "1px solid #ef4444",
  },
  errorText: {
    fontSize: 12,
    color:    "#ef4444",
    margin:   0,
  },
  btnRow: {
    display:       "flex",
    gap:           10,
    marginTop:     4,
    justifyContent:"flex-end",
  },
  cancelBtn: {
    padding:      "7px 18px",
    borderRadius: 8,
    border:       "1px solid #333",
    background:   "transparent",
    color:        "#aaa",
    fontSize:     13,
    cursor:       "pointer",
  },
  continueBtn: {
    padding:      "7px 18px",
    borderRadius: 8,
    border:       "none",
    background:   "#1d4ed8",
    color:        "#fff",
    fontSize:     13,
    fontWeight:   500,
    cursor:       "pointer",
  },
};
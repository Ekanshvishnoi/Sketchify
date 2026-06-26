/**
 * client/src/components/Toolbar.jsx
 *
 * The top toolbar. Contains:
 * - Drawing tool buttons (pen, line, rect, circle, arrow, eraser)
 * - Color swatch popup
 * - Undo / Redo buttons
 * - Live Session button (wired up in Step 3)
 * - Hamburger dropdown (clear canvas, change bg, stroke width)
 */
import { useState, useRef, useEffect } from "react";

// ── Preset colors for the swatch popup ───────────────────────────────
const PRESET_COLORS = [
  "#f0f0f0", // white-ish
  "#1a1a1a", // near-black
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
];

// ── Canvas background presets ─────────────────────────────────────────
const BG_COLORS = [
  { label: "Dark",  value: "#1a1a1a" },
  { label: "White", value: "#ffffff" },
  { label: "Green", value: "#1a2e1a" },
  { label: "Navy",  value: "#0f172a" },
];

// ── Tool definitions ──────────────────────────────────────────────────
const TOOLS = [
  { id: "pen",    label: "Pen",    icon: "✏️" },
  { id: "line",   label: "Line",   icon: "╱"  },
  { id: "rect",   label: "Rect",   icon: "▭"  },
  { id: "circle", label: "Circle", icon: "○"  },
  { id: "arrow",  label: "Arrow",  icon: "→"  },
  { id: "eraser", label: "Eraser", icon: "⌫"  },
];

export default function Toolbar({
  tool,         onToolChange,
  color,        onColorChange,
  strokeWidth,  onStrokeWidthChange,
  bgColor,      onBgColorChange,
  canUndo,      onUndo,
  canRedo,      onRedo,
  onClear,
  onLiveSession,
  roomCode,     // if provided, shows room code instead of Live Session button
}) {
  const [showColorPicker, setShowColorPicker]   = useState(false);
  const [showMenu,        setShowMenu]          = useState(false);

  // refs to detect clicks outside the popups so we can close them
  const colorRef = useRef(null);
  const menuRef  = useRef(null);

  // Close popups when clicking anywhere outside them
  useEffect(() => {
    function handleOutside(e) {
      if (colorRef.current && !colorRef.current.contains(e.target)) {
        setShowColorPicker(false);
      }
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  return (
    <div style={styles.bar}>

      {/* ── Drawing tools ── */}
      <div style={styles.group}>
        {TOOLS.map(t => (
          <button
            key={t.id}
            title={t.label}
            onClick={() => onToolChange(t.id)}
            style={{
              ...styles.toolBtn,
              ...(tool === t.id ? styles.toolBtnActive : {}),
            }}
          >
            {t.icon}
          </button>
        ))}
      </div>

      <div style={styles.sep} />

      {/* ── Color swatch dot ── */}
      <div style={{ position: "relative" }} ref={colorRef}>
        <button
          title="Color"
          onClick={() => setShowColorPicker(v => !v)}
          style={{
            ...styles.colorDot,
            background: color,
            border: `2px solid ${color === "#1a1a1a" ? "#555" : color}`,
          }}
        />

        {/* Swatch popup */}
        {showColorPicker && (
          <div style={styles.swatchPopup}>
            <div style={styles.swatchGrid}>
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => { onColorChange(c); setShowColorPicker(false); }}
                  style={{
                    ...styles.swatch,
                    background: c,
                    outline: color === c ? "2px solid #fff" : "none",
                    outlineOffset: "2px",
                  }}
                />
              ))}
            </div>
            {/* Custom color via native browser picker */}
            <label style={styles.customColorLabel}>
              <input
                type="color"
                value={color}
                onChange={e => onColorChange(e.target.value)}
                style={styles.nativeColorInput}
              />
              Custom…
            </label>
          </div>
        )}
      </div>

      <div style={styles.sep} />

      {/* ── Undo / Redo ── */}
      <button
        title="Undo"
        onClick={onUndo}
        disabled={!canUndo}
        style={{ ...styles.toolBtn, opacity: canUndo ? 1 : 0.3 }}
      >
        ↩
      </button>
      <button
        title="Redo"
        onClick={onRedo}
        disabled={!canRedo}
        style={{ ...styles.toolBtn, opacity: canRedo ? 1 : 0.3 }}
      >
        ↪
      </button>

      {/* ── Spacer pushes right-side items to the right ── */}
      <div style={{ flex: 1 }} />

      {/* ── Room code (shown in live session) OR Live Session button ── */}
      {roomCode ? (
        <div style={styles.roomCodeRow}>
          <span style={styles.roomCodeText}>{roomCode}</span>
          <button
            title="Copy room code"
            onClick={() => {
              navigator.clipboard.writeText(roomCode);
            }}
            style={styles.copyBtn}
          >
            ⧉
          </button>
        </div>
      ) : (
        <button
          onClick={onLiveSession}
          style={styles.liveBtn}
        >
          Live Session
        </button>
      )}

      <div style={styles.sep} />

      {/* ── Hamburger menu ── */}
      <div style={{ position: "relative" }} ref={menuRef}>
        <button
          title="Menu"
          onClick={() => setShowMenu(v => !v)}
          style={styles.toolBtn}
        >
          ☰
        </button>

        {/* Dropdown */}
        {showMenu && (
          <div style={styles.dropdown}>

            {/* Clear canvas */}
            <button
              onClick={() => { onClear(); setShowMenu(false); }}
              style={styles.dropdownItem}
            >
              🗑 Clear Canvas
            </button>

            <div style={styles.dropdownDivider} />

            {/* Stroke width */}
            <div style={styles.dropdownSection}>
              <span style={styles.dropdownLabel}>
                Stroke Width: {strokeWidth}
              </span>
              <input
                type="range"
                min={1}
                max={40}
                value={strokeWidth}
                onChange={e => onStrokeWidthChange(Number(e.target.value))}
                style={{ width: "100%", marginTop: 6 }}
              />
            </div>

            <div style={styles.dropdownDivider} />

            {/* Canvas background */}
            <div style={styles.dropdownSection}>
              <span style={styles.dropdownLabel}>Canvas Background</span>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                {BG_COLORS.map(bg => (
                  <button
                    key={bg.value}
                    title={bg.label}
                    onClick={() => { onBgColorChange(bg.value); setShowMenu(false); }}
                    style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: bg.value,
                      border: bgColor === bg.value
                        ? "2px solid #3b82f6"
                        : "1.5px solid #444",
                      cursor: "pointer",
                    }}
                  />
                ))}
              </div>
            </div>

          </div>
        )}
      </div>

    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────
const styles = {
  bar: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    padding: "0 12px",
    height: 48,
    background: "#111",
    borderBottom: "1px solid #2a2a2a",
    flexShrink: 0,
    userSelect: "none",
  },
  group: {
    display: "flex",
    gap: 2,
  },
  toolBtn: {
    width: 34,
    height: 34,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    border: "1px solid transparent",
    borderRadius: 8,
    color: "#ccc",
    fontSize: 16,
    cursor: "pointer",
    transition: "all 0.1s",
  },
  toolBtnActive: {
    background: "#1e3a5f",
    border: "1px solid #3b82f6",
    color: "#93c5fd",
  },
  sep: {
    width: 1,
    height: 24,
    background: "#2a2a2a",
    margin: "0 4px",
  },
  colorDot: {
    width: 26,
    height: 26,
    borderRadius: "50%",
    cursor: "pointer",
    flexShrink: 0,
  },
  swatchPopup: {
    position: "absolute",
    top: "calc(100% + 8px)",
    left: "50%",
    transform: "translateX(-50%)",
    background: "#1e1e1e",
    border: "1px solid #333",
    borderRadius: 10,
    padding: 10,
    zIndex: 100,
    boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
    width: 148,
  },
  swatchGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: 6,
  },
  swatch: {
    width: 22,
    height: 22,
    borderRadius: 5,
    border: "1px solid rgba(255,255,255,0.1)",
    cursor: "pointer",
  },
  customColorLabel: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    fontSize: 12,
    color: "#aaa",
    cursor: "pointer",
  },
  nativeColorInput: {
    width: 22,
    height: 22,
    padding: 0,
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
    background: "none",
  },
  liveBtn: {
    padding: "6px 16px",
    borderRadius: 20,
    background: "#1d4ed8",
    color: "#fff",
    border: "none",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    flexShrink: 0,
    transition: "background 0.15s",
  },
  dropdown: {
    position: "absolute",
    top: "calc(100% + 8px)",
    right: 0,
    background: "#1e1e1e",
    border: "1px solid #333",
    borderRadius: 10,
    padding: "6px 0",
    zIndex: 100,
    boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
    width: 200,
  },
  dropdownItem: {
    width: "100%",
    padding: "8px 14px",
    background: "transparent",
    border: "none",
    color: "#f87171",
    fontSize: 13,
    textAlign: "left",
    cursor: "pointer",
  },
  dropdownDivider: {
    height: 1,
    background: "#2a2a2a",
    margin: "4px 0",
  },
  dropdownSection: {
    padding: "8px 14px",
  },
  dropdownLabel: {
    fontSize: 11,
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  roomCodeRow: {
    display:     "flex",
    alignItems:  "center",
    gap:         6,
    padding:     "4px 10px",
    borderRadius: 8,
    border:      "1px solid #2a2a2a",
    background:  "#111",
  },
  roomCodeText: {
    fontFamily:    "monospace",
    fontSize:      14,
    letterSpacing: "0.12em",
    color:         "#f0f0f0",
    fontWeight:    600,
  },
  copyBtn: {
    background:  "transparent",
    border:      "none",
    color:       "#888",
    fontSize:    16,
    cursor:      "pointer",
    padding:     "0 2px",
    lineHeight:  1,
  },
};
/**
 * client/src/components/Canvas.jsx
 *
 * Renders two stacked <canvas> elements and wires them to useCanvas.
 *
 * WHY TWO CANVASES?
 * - mainCanvas    → holds all finished strokes permanently
 * - previewCanvas → sits on top, shows the shape being drawn RIGHT NOW
 *                   Gets cleared on every mousemove and on mouseup.
 *
 * For pen/eraser we draw directly on mainCanvas incrementally (fast).
 * For shapes we draw a live preview on previewCanvas, then on mouseup
 * we commit the final shape to mainCanvas and clear the preview.
 *
 * This means the main canvas is NEVER fully redrawn during a freehand
 * stroke — only when undo/redo/clear happens. That's why it feels instant.
 */
import { useCanvas } from "../hooks/useCanvas";

export default function Canvas({ tool, color, strokeWidth, bgColor, readOnly }) {
  const {
    mainCanvasRef,
    previewCanvasRef,
    undo,
    redo,
    canUndo,
    canRedo,
    clearCanvas,
  } = useCanvas({ tool, color, strokeWidth, bgColor, readOnly });

  return (
    // The outer div is the container. Both canvases are absolutely
    // positioned inside it so they sit exactly on top of each other.
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Layer 1 — committed strokes */}
      <canvas
        ref={mainCanvasRef}
        style={{
          position: "absolute",
          inset: 0,
          display: "block",
        }}
      />

      {/* Layer 2 — live shape preview (transparent background) */}
      <canvas
        ref={previewCanvasRef}
        style={{
          position: "absolute",
          inset: 0,
          display: "block",
          // The preview canvas is always on top so it receives mouse events.
          // cursor changes to crosshair when drawing, default otherwise.
          cursor: readOnly ? "default" : "crosshair",
        }}
      />

      {/*
        We expose undo/redo/clear as methods on the returned refs from the hook.
        But the Toolbar needs to call them. We solve this by passing the functions
        up through Home.jsx using a canvasRef pattern in the next step.
        For now, they are returned from the hook and wired in Home.jsx below.
      */}
    </div>
  );
}

/**
 * We need to expose the hook's functions (undo, redo, clear) to the Toolbar
 * which is a sibling component — not a parent or child of Canvas.
 * The cleanest way: lift state up into Home.jsx and pass everything down.
 * We'll do that in Home.jsx below.
 */
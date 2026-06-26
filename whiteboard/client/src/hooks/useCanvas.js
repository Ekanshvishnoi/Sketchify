/**
 * client/src/hooks/useCanvas.js
 *
 * The drawing engine. This hook owns ALL drawing logic:
 * - Mouse event handling (start, move, end)
 * - Rendering pen, line, rect, circle, arrow, eraser
 * - Undo / redo stack
 * - Resize handling (canvas always fills its container)
 *
 * WHY A HOOK AND NOT INSIDE THE COMPONENT:
 * Canvas drawing is imperative code (you call ctx.drawLine() etc.)
 * React components are declarative (you return JSX).
 * Keeping drawing logic in a hook keeps the component file clean
 * and makes the drawing engine independently testable.
 *
 * WHAT IS A REF (useRef)?
 * A ref is a box React gives you that you can put any value in.
 * Unlike state, changing a ref does NOT cause a re-render.
 * We use refs for things that change constantly during drawing
 * (like mouse position) because we don't want React re-rendering
 * the whole component 60 times per second.
 */
import { useRef, useState, useCallback, useEffect } from "react";

// ─── tiny ID generator (no external library needed) ───────────────────
function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// ─── Draw a single arrow line with a head ─────────────────────────────
function drawArrow(ctx, fromX, fromY, toX, toY) {
  const headLen = Math.max(10, ctx.lineWidth * 3);
  const angle   = Math.atan2(toY - fromY, toX - fromX);

  // shaft
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();

  // two sides of the arrowhead
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - headLen * Math.cos(angle - Math.PI / 6),
    toY - headLen * Math.sin(angle - Math.PI / 6)
  );
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - headLen * Math.cos(angle + Math.PI / 6),
    toY - headLen * Math.sin(angle + Math.PI / 6)
  );
  ctx.stroke();
}

// ─── Draw one committed stroke onto any canvas context ────────────────
function drawStroke(ctx, stroke) {
  ctx.save();
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth   = stroke.width;
  ctx.lineCap     = "round";
  ctx.lineJoin    = "round";

  switch (stroke.tool) {
    case "pen":
    case "eraser": {
      if (stroke.points.length < 2) break;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (const p of stroke.points) ctx.lineTo(p.x, p.y);
      ctx.stroke();
      break;
    }
    case "line": {
      ctx.beginPath();
      ctx.moveTo(stroke.startX, stroke.startY);
      ctx.lineTo(stroke.endX, stroke.endY);
      ctx.stroke();
      break;
    }
    case "rect": {
      ctx.beginPath();
      ctx.strokeRect(
        stroke.startX, stroke.startY,
        stroke.endX - stroke.startX,
        stroke.endY - stroke.startY
      );
      break;
    }
    case "circle": {
      const rx = Math.abs(stroke.endX - stroke.startX) / 2;
      const ry = Math.abs(stroke.endY - stroke.startY) / 2;
      const cx = stroke.startX + (stroke.endX - stroke.startX) / 2;
      const cy = stroke.startY + (stroke.endY - stroke.startY) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case "arrow": {
      drawArrow(ctx, stroke.startX, stroke.startY, stroke.endX, stroke.endY);
      break;
    }
    default: break;
  }
  ctx.restore();
}

// ─── Get mouse position relative to the canvas ─────────────────────────
// The canvas might be scaled by CSS, so we convert screen pixels
// to canvas buffer pixels using the scale ratio.
function getPos(e, canvas) {
  const rect   = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  // support both mouse and touch events
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top)  * scaleY,
  };
}

// ─── The hook ─────────────────────────────────────────────────────────
export function useCanvas({ tool, color, strokeWidth, bgColor, readOnly = false }) {

  // Two canvas layers stacked on top of each other:
  // mainCanvasRef    → all committed (finished) strokes live here
  // previewCanvasRef → the shape currently being drawn (cleared each mousemove)
  //                    only used for shape tools (line/rect/circle/arrow)
  const mainCanvasRef    = useRef(null);
  const previewCanvasRef = useRef(null);

  // strokesRef is the source of truth for all finished strokes.
  // We use a ref (not state) so mouse event handlers always see
  // the latest value without needing to be re-created.
  const strokesRef   = useRef([]);
  const redoStackRef = useRef([]);

  // These two ARE state because they control button enabled/disabled UI
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Track the in-progress stroke
  const isDrawingRef      = useRef(false);
  const currentStrokeRef  = useRef(null);
  const startPosRef       = useRef({ x: 0, y: 0 });

  // Keep a ref to current tool/color/width/bg so event handlers
  // (which are created once in useEffect) always read fresh values
  // without needing to be re-created every render.
  const toolRef        = useRef(tool);
  const colorRef       = useRef(color);
  const widthRef       = useRef(strokeWidth);
  const bgColorRef     = useRef(bgColor);
  useEffect(() => { toolRef.current    = tool;        }, [tool]);
  useEffect(() => { colorRef.current   = color;       }, [color]);
  useEffect(() => { widthRef.current   = strokeWidth; }, [strokeWidth]);
  useEffect(() => { bgColorRef.current = bgColor;     }, [bgColor]);

  // ── Redraw all committed strokes onto the main canvas ─────────────
  const redrawMain = useCallback(() => {
    const canvas = mainCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    // fill background
    ctx.fillStyle = bgColorRef.current;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // repaint every stroke
    for (const stroke of strokesRef.current) {
      drawStroke(ctx, stroke);
    }
  }, []);

  // ── Keep bgColor changes visible immediately ───────────────────────
  useEffect(() => {
    redrawMain();
  }, [bgColor, redrawMain]);

  // ── Resize: canvas buffer must match its CSS display size ──────────
  // If you skip this, drawing coords will be offset/scaled wrong.
  useEffect(() => {
    const mainCanvas    = mainCanvasRef.current;
    const previewCanvas = previewCanvasRef.current;
    if (!mainCanvas || !previewCanvas) return;

    const container = mainCanvas.parentElement;

    function resize() {
      const w = container.clientWidth;
      const h = container.clientHeight;
      mainCanvas.width    = w;  mainCanvas.height    = h;
      previewCanvas.width = w;  previewCanvas.height = h;
      redrawMain(); // redraw after resize clears the canvas
    }

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [redrawMain]);

  // ── Mouse/touch event handlers ─────────────────────────────────────
  useEffect(() => {
    const canvas = previewCanvasRef.current; // top layer catches events
    if (!canvas) return;

    function onDown(e) {
      if (readOnly) return;
      e.preventDefault();
      isDrawingRef.current = true;

      const pos  = getPos(e, canvas);
      const tool = toolRef.current;

      // eraser draws in the background color
      const strokeColor = tool === "eraser" ? bgColorRef.current : colorRef.current;

      currentStrokeRef.current = {
        id:     uid(),
        tool,
        color:  strokeColor,
        width:  tool === "eraser" ? widthRef.current * 3 : widthRef.current,
        // pen/eraser use a points array
        points: [pos],
        // shape tools use start/end coords
        startX: pos.x, startY: pos.y,
        endX:   pos.x, endY:   pos.y,
      };

      startPosRef.current = pos;

      // For pen/eraser: start drawing on main canvas immediately
      if (tool === "pen" || tool === "eraser") {
        const ctx = mainCanvasRef.current.getContext("2d");
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth   = currentStrokeRef.current.width;
        ctx.lineCap     = "round";
        ctx.lineJoin    = "round";
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
      }
    }

    function onMove(e) {
      if (!isDrawingRef.current) return;
      e.preventDefault();

      const pos    = getPos(e, canvas);
      const stroke = currentStrokeRef.current;
      const tool   = toolRef.current;

      if (tool === "pen" || tool === "eraser") {
        // Incremental draw: just add the new segment — no full redraw needed
        stroke.points.push(pos);
        const ctx = mainCanvasRef.current.getContext("2d");
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();

      } else {
        // Shape tools: update end point and repaint the preview canvas
        stroke.endX = pos.x;
        stroke.endY = pos.y;

        const pCtx = previewCanvasRef.current.getContext("2d");
        pCtx.clearRect(0, 0, canvas.width, canvas.height);
        drawStroke(pCtx, stroke);
      }
    }

    function onUp(e) {
      if (!isDrawingRef.current) return;
      e.preventDefault();
      isDrawingRef.current = false;

      const stroke = currentStrokeRef.current;
      const tool   = toolRef.current;

      if (!stroke) return;

      // Clear the preview layer
      const pCtx = previewCanvasRef.current.getContext("2d");
      pCtx.clearRect(0, 0, canvas.width, canvas.height);

      // Commit the stroke
      if (tool === "pen" || tool === "eraser") {
        // Already drawn on main canvas incrementally — just save it
        if (stroke.points.length >= 2) {
          strokesRef.current = [...strokesRef.current, stroke];
          redoStackRef.current = []; // new stroke clears redo history
          setCanUndo(true);
          setCanRedo(false);
        }
      } else {
        // Shape: draw it onto main canvas now and save
        const hasSize =
          Math.abs(stroke.endX - stroke.startX) > 2 ||
          Math.abs(stroke.endY - stroke.startY) > 2;

        if (hasSize) {
          drawStroke(mainCanvasRef.current.getContext("2d"), stroke);
          strokesRef.current = [...strokesRef.current, stroke];
          redoStackRef.current = [];
          setCanUndo(true);
          setCanRedo(false);
        }
      }

      currentStrokeRef.current = null;
    }

    canvas.addEventListener("mousedown",  onDown);
    canvas.addEventListener("mousemove",  onMove);
    canvas.addEventListener("mouseup",    onUp);
    canvas.addEventListener("mouseleave", onUp);
    canvas.addEventListener("touchstart", onDown, { passive: false });
    canvas.addEventListener("touchmove",  onMove, { passive: false });
    canvas.addEventListener("touchend",   onUp);

    return () => {
      canvas.removeEventListener("mousedown",  onDown);
      canvas.removeEventListener("mousemove",  onMove);
      canvas.removeEventListener("mouseup",    onUp);
      canvas.removeEventListener("mouseleave", onUp);
      canvas.removeEventListener("touchstart", onDown);
      canvas.removeEventListener("touchmove",  onMove);
      canvas.removeEventListener("touchend",   onUp);
    };
  }, [readOnly]); // only re-run if readOnly changes

  // ── Undo ──────────────────────────────────────────────────────────
  const undo = useCallback(() => {
    if (strokesRef.current.length === 0) return;
    const last    = strokesRef.current[strokesRef.current.length - 1];
    strokesRef.current   = strokesRef.current.slice(0, -1);
    redoStackRef.current = [...redoStackRef.current, last];
    setCanUndo(strokesRef.current.length > 0);
    setCanRedo(true);
    redrawMain();
  }, [redrawMain]);

  // ── Redo ──────────────────────────────────────────────────────────
  const redo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    const next   = redoStackRef.current[redoStackRef.current.length - 1];
    redoStackRef.current = redoStackRef.current.slice(0, -1);
    strokesRef.current   = [...strokesRef.current, next];
    setCanRedo(redoStackRef.current.length > 0);
    setCanUndo(true);
    redrawMain();
  }, [redrawMain]);

  // ── Clear canvas ──────────────────────────────────────────────────
  const clearCanvas = useCallback(() => {
    strokesRef.current   = [];
    redoStackRef.current = [];
    setCanUndo(false);
    setCanRedo(false);
    redrawMain();
  }, [redrawMain]);

  return {
    mainCanvasRef,
    previewCanvasRef,
    undo,
    redo,
    canUndo,
    canRedo,
    clearCanvas,
  };
}
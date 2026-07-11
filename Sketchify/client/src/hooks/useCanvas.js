/**
 * client/src/hooks/useCanvas.js
 *
 * Added in Step 7:
 * - onStrokeStart/Point/End callbacks — emit events to server while drawing
 * - drawIncomingStroke() — draws a partner's stroke onto the canvas
 * - replayStrokes() — replays stored strokes on join (catch-up)
 * - onUndoStroke() — removes a specific stroke by ID (for undo broadcast)
 *
 * THROTTLING:
 * STROKE_POINT fires on every mousemove. On a fast mouse this can be
 * 100+ events per second. We throttle to max 1 event per 16ms (60fps)
 * to reduce network traffic without any visible difference in quality.
 */
import { useRef, useState, useCallback, useEffect } from "react";

// ── Tiny ID generator ─────────────────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// ── Draw arrow ────────────────────────────────────────────────────────
function drawArrow(ctx, fromX, fromY, toX, toY) {
  const headLen = Math.max(10, ctx.lineWidth * 3);
  const angle   = Math.atan2(toY - fromY, toX - fromX);
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();
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

// ── Draw one stroke onto any canvas context ───────────────────────────
export function drawStroke(ctx, stroke) {
  if (!stroke) return;
  ctx.save();
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth   = stroke.width;
  ctx.lineCap     = "round";
  ctx.lineJoin    = "round";

  switch (stroke.tool) {
    case "pen":
    case "eraser": {
      if (!stroke.points || stroke.points.length < 2) break;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (const p of stroke.points) ctx.lineTo(p.x, p.y);
      ctx.stroke();
      break;
    }
    case "line": {
      ctx.beginPath();
      ctx.moveTo(stroke.startX, stroke.startY);
      ctx.lineTo(stroke.endX,   stroke.endY);
      ctx.stroke();
      break;
    }
    case "rect": {
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

// ── Get mouse position ────────────────────────────────────────────────
function getPos(e, canvas) {
  const rect   = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top)  * scaleY,
  };
}

// ── The hook ──────────────────────────────────────────────────────────
export function useCanvas({
  tool,
  color,
  strokeWidth,
  bgColor,
  readOnly  = false,
  seat      = null,    // NEW — which seat this canvas belongs to
  // NEW — socket emit callbacks (optional, only used in live session)
  onStrokeStart = null,
  onStrokePoint = null,
  onStrokeEnd   = null,
  onUndo        = null,
}) {
  const mainCanvasRef    = useRef(null);
  const previewCanvasRef = useRef(null);

  const strokesRef   = useRef([]);
  const redoStackRef = useRef([]);

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const isDrawingRef     = useRef(false);
  const currentStrokeRef = useRef(null);
  const startPosRef      = useRef({ x: 0, y: 0 });

  // Throttle timestamp for STROKE_POINT
  const lastPointEmitRef = useRef(0);

  const toolRef    = useRef(tool);
  const colorRef   = useRef(color);
  const widthRef   = useRef(strokeWidth);
  const bgColorRef = useRef(bgColor);
  useEffect(() => { toolRef.current    = tool;        }, [tool]);
  useEffect(() => { colorRef.current   = color;       }, [color]);
  useEffect(() => { widthRef.current   = strokeWidth; }, [strokeWidth]);
  useEffect(() => { bgColorRef.current = bgColor;     }, [bgColor]);

  // Keep emit callbacks in refs so event handlers always read latest
  const onStrokeStartRef = useRef(onStrokeStart);
  const onStrokePointRef = useRef(onStrokePoint);
  const onStrokeEndRef   = useRef(onStrokeEnd);
  const onUndoRef        = useRef(onUndo);
  useEffect(() => { onStrokeStartRef.current = onStrokeStart; }, [onStrokeStart]);
  useEffect(() => { onStrokePointRef.current = onStrokePoint; }, [onStrokePoint]);
  useEffect(() => { onStrokeEndRef.current   = onStrokeEnd;   }, [onStrokeEnd]);
  useEffect(() => { onUndoRef.current        = onUndo;        }, [onUndo]);

  // ── Redraw all committed strokes ─────────────────────────────────
  const redrawMain = useCallback(() => {
    const canvas = mainCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = bgColorRef.current;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const stroke of strokesRef.current) {
      drawStroke(ctx, stroke);
    }
  }, []);

  useEffect(() => { redrawMain(); }, [bgColor, redrawMain]);

  // ── Resize ───────────────────────────────────────────────────────
  useEffect(() => {
    const mainCanvas    = mainCanvasRef.current;
    const previewCanvas = previewCanvasRef.current;
    if (!mainCanvas || !previewCanvas) return;
    const container = mainCanvas.parentElement;

    function resize() {
      const w = container.clientWidth;
      const h = container.clientHeight;
      mainCanvas.width    = w; mainCanvas.height    = h;
      previewCanvas.width = w; previewCanvas.height = h;
      redrawMain();
    }

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [redrawMain]);

  // ── Mouse/touch handlers ─────────────────────────────────────────
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    function onDown(e) {
      if (readOnly) return;
      e.preventDefault();
      isDrawingRef.current = true;

      const pos         = getPos(e, canvas);
      const tool        = toolRef.current;
      const strokeColor = tool === "eraser"
        ? bgColorRef.current
        : colorRef.current;

      const stroke = {
        id:     uid(),
        tool,
        color:  strokeColor,
        width:  tool === "eraser" ? widthRef.current * 3 : widthRef.current,
        points: [pos],
        startX: pos.x, startY: pos.y,
        endX:   pos.x, endY:   pos.y,
        seat,          // tag stroke with which seat it belongs to
      };

      currentStrokeRef.current = stroke;
      startPosRef.current      = pos;

      // Emit stroke start to server
      onStrokeStartRef.current?.(stroke);

      if (tool === "pen" || tool === "eraser") {
        const ctx = mainCanvasRef.current.getContext("2d");
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth   = stroke.width;
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
        stroke.points.push(pos);
        const ctx = mainCanvasRef.current.getContext("2d");
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();

        // ── Throttled emit (max 60fps) ──────────────────────────
        const now = Date.now();
        if (now - lastPointEmitRef.current >= 16) {
          lastPointEmitRef.current = now;
          onStrokePointRef.current?.(stroke.id, pos);
        }

      } else {
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

      const pCtx = previewCanvasRef.current.getContext("2d");
      pCtx.clearRect(0, 0, canvas.width, canvas.height);

      if (tool === "pen" || tool === "eraser") {
        if (stroke.points.length >= 2) {
          strokesRef.current   = [...strokesRef.current, stroke];
          redoStackRef.current = [];
          setCanUndo(true);
          setCanRedo(false);
          onStrokeEndRef.current?.(stroke.id);
        }
      } else {
        const hasSize =
          Math.abs(stroke.endX - stroke.startX) > 2 ||
          Math.abs(stroke.endY - stroke.startY) > 2;
        if (hasSize) {
          drawStroke(mainCanvasRef.current.getContext("2d"), stroke);
          strokesRef.current   = [...strokesRef.current, stroke];
          redoStackRef.current = [];
          setCanUndo(true);
          setCanRedo(false);
          onStrokeEndRef.current?.(stroke.id);
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
  }, [readOnly, seat]);

  // ── Undo ──────────────────────────────────────────────────────────
  const undo = useCallback(() => {
    if (strokesRef.current.length === 0) return;
    const last           = strokesRef.current[strokesRef.current.length - 1];
    strokesRef.current   = strokesRef.current.slice(0, -1);
    redoStackRef.current = [...redoStackRef.current, last];
    setCanUndo(strokesRef.current.length > 0);
    setCanRedo(true);
    redrawMain();
    // Emit undo to server so partner and spectators see it too
    onUndoRef.current?.(last.id);
  }, [redrawMain]);

  // ── Redo ──────────────────────────────────────────────────────────
  const redo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    const next           = redoStackRef.current[redoStackRef.current.length - 1];
    redoStackRef.current = redoStackRef.current.slice(0, -1);
    strokesRef.current   = [...strokesRef.current, next];
    setCanRedo(redoStackRef.current.length > 0);
    setCanUndo(true);
    redrawMain();
  }, [redrawMain]);

  // ── Clear ─────────────────────────────────────────────────────────
  const clearCanvas = useCallback(() => {
    strokesRef.current   = [];
    redoStackRef.current = [];
    setCanUndo(false);
    setCanRedo(false);
    redrawMain();
  }, [redrawMain]);

  // ── NEW: Draw an incoming stroke from the partner ─────────────────
  // Called by Room.jsx when a STROKE_UPDATE event arrives
  const incomingStrokeRef = useRef({}); // tracks in-progress incoming strokes

  const handleIncomingStroke = useCallback((data) => {
    const mainCanvas = mainCanvasRef.current;
    const prevCanvas = previewCanvasRef.current;
    if (!mainCanvas || !prevCanvas) return;

    if (data.type === "start") {
      // Store incoming stroke — it's being built point by point
      incomingStrokeRef.current[data.stroke.id] = { ...data.stroke };

      if (data.stroke.tool === "pen" || data.stroke.tool === "eraser") {
        const ctx = mainCanvas.getContext("2d");
        ctx.strokeStyle = data.stroke.color;
        ctx.lineWidth   = data.stroke.width;
        ctx.lineCap     = "round";
        ctx.lineJoin    = "round";
        ctx.beginPath();
        if (data.stroke.points?.[0]) {
          ctx.moveTo(data.stroke.points[0].x, data.stroke.points[0].y);
        }
      }

    } else if (data.type === "point") {
      const incoming = incomingStrokeRef.current[data.strokeId];
      if (!incoming) return;

      if (!incoming.points) incoming.points = [];
      incoming.points.push(data.point);

      if (incoming.tool === "pen" || incoming.tool === "eraser") {
        // Draw point directly on main canvas (incremental, fast)
        const ctx = mainCanvas.getContext("2d");
        ctx.strokeStyle = incoming.color;
        ctx.lineWidth   = incoming.width;
        ctx.lineCap     = "round";
        ctx.lineJoin    = "round";
        ctx.lineTo(data.point.x, data.point.y);
        ctx.stroke();
      } else {
        // Shape tool — update end point and redraw preview
        incoming.endX = data.point.x;
        incoming.endY = data.point.y;
        const pCtx = prevCanvas.getContext("2d");
        pCtx.clearRect(0, 0, prevCanvas.width, prevCanvas.height);
        drawStroke(pCtx, incoming);
      }

    } else if (data.type === "end") {
      const incoming = incomingStrokeRef.current[data.strokeId];
      if (!incoming) return;

      // Clear preview layer
      const pCtx = prevCanvas.getContext("2d");
      pCtx.clearRect(0, 0, prevCanvas.width, prevCanvas.height);

      // For shapes: draw final version onto main canvas
      if (incoming.tool !== "pen" && incoming.tool !== "eraser") {
        drawStroke(mainCanvas.getContext("2d"), incoming);
      }

      // Save to local strokes array (needed for undo broadcast redraw)
      strokesRef.current = [...strokesRef.current, incoming];
      delete incomingStrokeRef.current[data.strokeId];
    }
  }, []);

  // ── NEW: Handle undo broadcast from server ────────────────────────
  // Removes a specific stroke by ID and redraws
  const handleUndoBroadcast = useCallback(({ strokeId }) => {
    strokesRef.current = strokesRef.current.filter(s => s.id !== strokeId);
    redrawMain();
  }, [redrawMain]);

  // ── NEW: Replay stored strokes (for join catch-up) ────────────────
  // Called once when ROOM_JOINED arrives with existing strokes
  const replayStrokes = useCallback((strokes) => {
    if (!strokes || strokes.length === 0) return;
    strokesRef.current = strokes;
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
    handleIncomingStroke,  // NEW
    handleUndoBroadcast,   // NEW
    replayStrokes,         // NEW
  };
}
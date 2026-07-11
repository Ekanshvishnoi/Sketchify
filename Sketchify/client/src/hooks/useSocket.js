/**
 * client/src/hooks/useSocket.js
 *
 * Added in this step: CHAT_MESSAGE emit and CHAT_BROADCAST listener.
 * Everything else stays the same as before.
 */
import { useEffect, useRef, useCallback } from "react";
import { socket } from "../socket.js";
import {
  JOIN_ROOM,
  ROOM_JOINED,
  ROOM_NOT_FOUND,
  ROOM_CLOSED,
  USER_CONNECTED,
  USER_DISCONNECTED,
  CHAT_MESSAGE,
  CHAT_BROADCAST,
  SPECTATOR_JOINED,
  SPECTATOR_LEFT,
  SWAP_REQUEST,
  SWAP_RESPONSE,
  SWAP_BROADCAST,
  STROKE_START,
  STROKE_POINT,
  STROKE_END,
  STROKE_UPDATE,
  UNDO_STROKE,
  UNDO_BROADCAST,
} from "../../../shared/events.js";

export function useSocket({
  onRoomJoined,
  onRoomNotFound,
  onRoomClosed,
  onUserConnected,
  onUserDisconnected,
  onChatMessage,
  onSpectatorJoined,
  onSpectatorLeft,
  onSwapRequest,    // NEW — active user receives a swap request from spectator
  onSwapBroadcast,  // NEW — everyone receives the result of a swap
  onStrokeUpdate,   // NEW — incoming stroke event from partner
  onUndoBroadcast,  // NEW — undo broadcast from server
}) {

  // ── Callback refs ────────────────────────────────────────────────
  const onRoomJoinedRef       = useRef(onRoomJoined);
  const onRoomNotFoundRef     = useRef(onRoomNotFound);
  const onRoomClosedRef       = useRef(onRoomClosed);
  const onUserConnectedRef    = useRef(onUserConnected);
  const onUserDisconnectedRef = useRef(onUserDisconnected);
  const onChatMessageRef      = useRef(onChatMessage);
  const onSpectatorJoinedRef  = useRef(onSpectatorJoined);
  const onSpectatorLeftRef    = useRef(onSpectatorLeft);
  const onSwapRequestRef      = useRef(onSwapRequest);
  const onSwapBroadcastRef    = useRef(onSwapBroadcast);
  const onStrokeUpdateRef     = useRef(onStrokeUpdate);
  const onUndoBroadcastRef    = useRef(onUndoBroadcast);

  useEffect(() => { onRoomJoinedRef.current       = onRoomJoined;       }, [onRoomJoined]);
  useEffect(() => { onRoomNotFoundRef.current     = onRoomNotFound;     }, [onRoomNotFound]);
  useEffect(() => { onRoomClosedRef.current       = onRoomClosed;       }, [onRoomClosed]);
  useEffect(() => { onUserConnectedRef.current    = onUserConnected;    }, [onUserConnected]);
  useEffect(() => { onUserDisconnectedRef.current = onUserDisconnected; }, [onUserDisconnected]);
  useEffect(() => { onChatMessageRef.current      = onChatMessage;      }, [onChatMessage]);
  useEffect(() => { onSpectatorJoinedRef.current  = onSpectatorJoined;  }, [onSpectatorJoined]);
  useEffect(() => { onSpectatorLeftRef.current    = onSpectatorLeft;    }, [onSpectatorLeft]);
  useEffect(() => { onSwapRequestRef.current      = onSwapRequest;      }, [onSwapRequest]);
  useEffect(() => { onSwapBroadcastRef.current    = onSwapBroadcast;    }, [onSwapBroadcast]);
  useEffect(() => { onStrokeUpdateRef.current     = onStrokeUpdate;     }, [onStrokeUpdate]);
  useEffect(() => { onUndoBroadcastRef.current    = onUndoBroadcast;    }, [onUndoBroadcast]);

  // ── Register listeners once on mount ────────────────────────────
  useEffect(() => {
    function onJoined(data)       { onRoomJoinedRef.current?.(data); }
    function onNotFound()         { onRoomNotFoundRef.current?.(); }
    function onClosed()           { onRoomClosedRef.current?.(); }
    function onConnected(data)    { onUserConnectedRef.current?.(data); }
    function onDisconnected(data) { onUserDisconnectedRef.current?.(data); }
    function onChat(data)         { onChatMessageRef.current?.(data); }  // NEW
    function onSpcJoined(data)    { onSpectatorJoinedRef.current?.(data); }
    function onSpcLeft(data)      { onSpectatorLeftRef.current?.(data); }
    function onSwapReq(data)      { onSwapRequestRef.current?.(data); }
    function onSwapResult(data)   { onSwapBroadcastRef.current?.(data); }
    function onStrokeUpd(data)    { onStrokeUpdateRef.current?.(data); }
    function onUndoBC(data)       { onUndoBroadcastRef.current?.(data); }

    socket.on(ROOM_JOINED,       onJoined);
    socket.on(ROOM_NOT_FOUND,    onNotFound);
    socket.on(ROOM_CLOSED,       onClosed);
    socket.on(USER_CONNECTED,    onConnected);
    socket.on(USER_DISCONNECTED, onDisconnected);
    socket.on(CHAT_BROADCAST,    onChat);              // NEW
    socket.on(SPECTATOR_JOINED,  onSpcJoined);
    socket.on(SPECTATOR_LEFT,    onSpcLeft);
    socket.on(SWAP_REQUEST,      onSwapReq);
    socket.on(SWAP_BROADCAST,    onSwapResult);
    socket.on(STROKE_UPDATE,     onStrokeUpd);
    socket.on(UNDO_BROADCAST,    onUndoBC);

    return () => {
      socket.off(ROOM_JOINED,       onJoined);
      socket.off(ROOM_NOT_FOUND,    onNotFound);
      socket.off(ROOM_CLOSED,       onClosed);
      socket.off(USER_CONNECTED,    onConnected);
      socket.off(USER_DISCONNECTED, onDisconnected);
      socket.off(CHAT_BROADCAST,    onChat);           // NEW
      socket.off(SPECTATOR_JOINED,  onSpcJoined);
      socket.off(SPECTATOR_LEFT,    onSpcLeft);
      socket.off(SWAP_REQUEST,      onSwapReq);
      socket.off(SWAP_BROADCAST,    onSwapResult);
      socket.off(STROKE_UPDATE,     onStrokeUpd);
      socket.off(UNDO_BROADCAST,    onUndoBC);
    };
  }, []);

  // ── joinRoom ─────────────────────────────────────────────────────
  const joinRoom = useCallback(({ roomCode, userName, create }) => {
    socket.emit(JOIN_ROOM, { roomCode, userName, create });
  }, []);

  // ── sendMessage ──────────────────────────────────────────────────
  // NEW — called by ChatPanel when the user hits Send
  const sendMessage = useCallback((text) => {
    socket.emit(CHAT_MESSAGE, { text });
  }, []);

  // Spectator calls this to request an active seat
  const sendSwapRequest = useCallback((targetSeat) => {
    socket.emit(SWAP_REQUEST, { targetSeat });
  }, []);

  // Active user calls this to approve or deny a swap request
  const sendSwapResponse = useCallback((approved) => {
    socket.emit(SWAP_RESPONSE, { approved });
  }, []);

  // ── Draw emitters ────────────────────────────────────────────────
  const emitStrokeStart = useCallback((stroke) => {
    socket.emit(STROKE_START, { stroke });
  }, []);

  const emitStrokePoint = useCallback((strokeId, point) => {
    socket.emit(STROKE_POINT, { strokeId, point });
  }, []);

  const emitStrokeEnd = useCallback((strokeId) => {
    socket.emit(STROKE_END, { strokeId });
  }, []);

  const emitUndo = useCallback((strokeId) => {
    socket.emit(UNDO_STROKE, { strokeId });
  }, []);

  return {
    socket,
    joinRoom,
    sendMessage,
    sendSwapRequest,
    sendSwapResponse,
    emitStrokeStart,
    emitStrokePoint,
    emitStrokeEnd,
    emitUndo,
  };
}
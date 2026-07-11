/**
 * client/src/hooks/useWebRTC.js
 *
 * The entire voice call engine. Handles:
 * - Microphone access
 * - Peer connection lifecycle (create, offer, answer, ICE, close)
 * - Auto-connect when partner joins, auto-disconnect when they leave
 * - Mute/unmute
 * - Speaking detection (via Web Audio API volume analysis)
 *
 * HOW WEBRTC WORKS IN PLAIN ENGLISH:
 * 1. User A creates a "peer connection" and generates an "offer"
 *    (a description of their audio codec capabilities + network info)
 * 2. Offer goes to server → server forwards to User B
 * 3. User B receives the offer, generates an "answer", sends it back
 * 4. Both sides also continuously send "ICE candidates" — possible
 *    network paths through which the audio can flow
 * 5. Once offer + answer + ICE are exchanged, browsers connect
 *    directly (peer-to-peer) — server is no longer involved in audio
 *
 * WHO INITIATES:
 * Seat A always creates the offer. Seat B always answers.
 * This avoids both sides trying to offer simultaneously (a "glare" collision).
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { socket } from "../socket.js";
import { RTC_OFFER, RTC_ANSWER, RTC_ICE } from "../../../shared/events.js";

// ── STUN servers ──────────────────────────────────────────────────────
// STUN servers help each browser discover its own public IP address
// so it can share it as an ICE candidate. We use Google's free ones.
// In production you'd add TURN servers too, but STUN works for most
// networks (fails only behind very strict corporate firewalls).
const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export function useWebRTC({ mySeat, partnerSeat, isActive, seats }) {

  // ── Refs ──────────────────────────────────────────────────────────
  const pcRef          = useRef(null); // RTCPeerConnection instance
  const localStreamRef = useRef(null); // our microphone stream
  const audioRef       = useRef(null); // <audio> element for remote audio
  const analyserRef    = useRef(null); // Web Audio analyser for speaking detection
  const animFrameRef   = useRef(null); // requestAnimationFrame handle

  // ── State ──────────────────────────────────────────────────────────
  const [isMuted,         setIsMuted]         = useState(false);
  const [isSpeaking,      setIsSpeaking]      = useState(false);   // am I speaking?
  const [partnerSpeaking, setPartnerSpeaking] = useState(false);   // is partner speaking?
  const [isConnected,     setIsConnected]     = useState(false);   // peer connected?
  const [micError,        setMicError]        = useState(null);    // mic permission error

  // ── Get microphone access ─────────────────────────────────────────
  // Called once on mount. Stores the stream in localStreamRef.
  async function getMicrophone() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      localStreamRef.current = stream;
      setupSpeakingDetection(stream);
      return stream;
    } catch (err) {
      console.error("[RTC] Mic access denied:", err);
      setMicError("Microphone access denied. Check browser permissions.");
      return null;
    }
  }

  // ── Speaking detection via Web Audio API ──────────────────────────
  // Reads the microphone volume 30 times per second.
  // If volume exceeds threshold → isSpeaking = true.
  function setupSpeakingDetection(stream) {
    try {
      const audioCtx  = new AudioContext();
      const source    = audioCtx.createMediaStreamSource(stream);
      const analyser  = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);

      function checkVolume() {
        analyser.getByteFrequencyData(data);
        // Average volume across all frequency bins
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setIsSpeaking(avg > 15); // 15 is the speaking threshold (0–255 scale)
        animFrameRef.current = requestAnimationFrame(checkVolume);
      }

      checkVolume();
    } catch (err) {
      console.warn("[RTC] Speaking detection unavailable:", err);
    }
  }

  // ── Create peer connection ─────────────────────────────────────────
  function createPeerConnection() {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // When we get a remote audio track, play it
    pc.ontrack = (event) => {
      console.log("[RTC] Got remote track");
      if (audioRef.current) {
        audioRef.current.srcObject = event.streams[0];
      }
      setIsConnected(true);
    };

    // Send ICE candidates to partner via server
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit(RTC_ICE, { candidate: event.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("[RTC] Connection state:", pc.connectionState);
      if (pc.connectionState === "disconnected" ||
          pc.connectionState === "failed" ||
          pc.connectionState === "closed") {
        setIsConnected(false);
        setPartnerSpeaking(false);
      }
    };

    // Add our local audio tracks to the connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    pcRef.current = pc;
    return pc;
  }

  // ── Seat A initiates: create and send offer ────────────────────────
  async function initiateCall() {
    console.log("[RTC] Initiating call as Seat A");
    const pc = createPeerConnection();

    try {
      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);
      socket.emit(RTC_OFFER, { offer });
    } catch (err) {
      console.error("[RTC] Failed to create offer:", err);
    }
  }

  // ── Close peer connection cleanly ─────────────────────────────────
  function closePeerConnection() {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }
    setIsConnected(false);
    setPartnerSpeaking(false);
    console.log("[RTC] Peer connection closed");
  }

  // ── Socket event handlers ─────────────────────────────────────────

  // Seat B receives offer → create answer
  const handleOffer = useCallback(async ({ offer }) => {
    console.log("[RTC] Received offer");
    const pc = createPeerConnection();

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit(RTC_ANSWER, { answer });
    } catch (err) {
      console.error("[RTC] Failed to handle offer:", err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Seat A receives answer from Seat B
  const handleAnswer = useCallback(async ({ answer }) => {
    console.log("[RTC] Received answer");
    if (!pcRef.current) return;
    try {
      await pcRef.current.setRemoteDescription(
        new RTCSessionDescription(answer)
      );
    } catch (err) {
      console.error("[RTC] Failed to handle answer:", err);
    }
  }, []);

  // Both sides receive ICE candidates
  const handleIce = useCallback(async ({ candidate }) => {
    if (!pcRef.current || !candidate) return;
    try {
      await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn("[RTC] Failed to add ICE candidate:", err);
    }
  }, []);

  // ── Register socket listeners ─────────────────────────────────────
  useEffect(() => {
    if (!isActive) return; // spectators skip all of this

    socket.on(RTC_OFFER,  handleOffer);
    socket.on(RTC_ANSWER, handleAnswer);
    socket.on(RTC_ICE,    handleIce);

    return () => {
      socket.off(RTC_OFFER,  handleOffer);
      socket.off(RTC_ANSWER, handleAnswer);
      socket.off(RTC_ICE,    handleIce);
    };
  }, [isActive, handleOffer, handleAnswer, handleIce]);

  // ── Mount: get mic, auto-initiate if partner already present ─────
  useEffect(() => {
    if (!isActive) return;

    async function init() {
      await getMicrophone();

      // If partner is already in the room when we join
      // (e.g. we are Seat B joining after Seat A) and we are Seat A,
      // initiate the call immediately.
      // We check after a short delay to let the socket settle.
      if (mySeat === "A" && seats?.B) {
        setTimeout(initiateCall, 500);
      }
    }

    init();

    // Cleanup on unmount
    return () => {
      closePeerConnection();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  // ── Watch for partner joining (Seat A triggers offer) ─────────────
  // When seats.B goes from null → filled, Seat A initiates the call.
  const prevPartnerRef = useRef(null);
  useEffect(() => {
    if (!isActive || mySeat !== "A") return;

    const partnerNow  = seats?.[partnerSeat];
    const partnerPrev = prevPartnerRef.current;

    // Partner just joined (was null, now has a name)
    if (!partnerPrev && partnerNow) {
      console.log("[RTC] Partner joined — initiating call");
      setTimeout(initiateCall, 500); // small delay for socket to settle
    }

    // Partner left — close connection
    if (partnerPrev && !partnerNow) {
      console.log("[RTC] Partner left — closing connection");
      closePeerConnection();
    }

    prevPartnerRef.current = partnerNow;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seats, mySeat, partnerSeat, isActive]);

  // Seat B also needs to clean up when partner leaves
  // so it's ready for a fresh connection when they rejoin
  useEffect(() => {
    if (!isActive || mySeat !== "B") return;

    const partnerNow = seats?.[partnerSeat];

    if (!partnerNow && isConnected) {
      console.log("[RTC] Partner left (Seat B view) — closing connection");
      closePeerConnection();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seats]);

  // ── Mute / Unmute ─────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (!audioTrack) return;

    audioTrack.enabled = !audioTrack.enabled;
    setIsMuted(!audioTrack.enabled);
  }, []);

  // ── Return values for VoiceCall component ─────────────────────────
  return {
    isMuted,
    toggleMute,
    isSpeaking,
    partnerSpeaking,
    isConnected,
    micError,
    audioRef,       // attach to a hidden <audio> element in VoiceCall.jsx
  };
}
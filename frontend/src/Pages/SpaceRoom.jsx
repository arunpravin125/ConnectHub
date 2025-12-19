import {
  Box,
  Button,
  Flex,
  Text,
  Avatar,
  Spinner,
  Badge,
  useColorModeValue,
} from "@chakra-ui/react";
import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useRecoilValue } from "recoil";
import userAtom from "../atoms/userAtom";
import { useSocket } from "../context/SocketContext";
import toast from "react-hot-toast";
import { FaMicrophone, FaMicrophoneSlash, FaStop } from "react-icons/fa";

const SpaceRoom = () => {
  const { id: spaceId } = useParams();
  const navigate = useNavigate();
  const user = useRecoilValue(userAtom);
  const { socket } = useSocket();
  const [space, setSpace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingId, setRecordingId] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [audioStatus, setAudioStatus] = useState("idle"); // idle, connecting, connected, failed
  const [connectionQuality, setConnectionQuality] = useState("good"); // good, poor
  const [connectionProgress, setConnectionProgress] = useState({
    total: 0,
    connected: 0,
  }); // Track connection progress

  // Recording refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);
  const recordingStartTimeRef = useRef(null);
  const recordingIdRef = useRef(null); // Store recordingId in ref to persist across state changes

  // WebRTC refs
  const peerConnectionsRef = useRef(new Map()); // Map<userId, RTCPeerConnection>
  const localAudioTrackRef = useRef(null);
  const audioElementsRef = useRef(new Map()); // Map<userId, HTMLAudioElement>
  const pendingIceCandidatesRef = useRef(new Map()); // Map<userId, RTCIceCandidate[]>
  const iceServersRef = useRef([
    { urls: "stun:stun.l.google.com:19302" },
    // TURN servers can be added via env vars
    ...(import.meta.env.VITE_TURN_SERVER_URL
      ? [
          {
            urls: import.meta.env.VITE_TURN_SERVER_URL,
            username: import.meta.env.VITE_TURN_USERNAME || "",
            credential: import.meta.env.VITE_TURN_CREDENTIAL || "",
          },
        ]
      : []),
  ]);

  // Debug flag (set to true to enable verbose logging)
  const DEBUG = import.meta.env.DEV || false;

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    fetchSpace();
    setupSocketListeners();

    return () => {
      cleanup();
    };
  }, [spaceId, user]);

  // Audio health check: verify listeners have remote tracks
  useEffect(() => {
    if (!isSpeaker && space?.status === "live") {
      const healthCheckInterval = setInterval(() => {
        // Check all audio elements
        let hasPlayingAudio = false;
        audioElementsRef.current.forEach((audioEl, userId) => {
          if (audioEl.srcObject) {
            const tracks = audioEl.srcObject.getAudioTracks();
            const hasEnabledTracks = tracks.some(
              (t) => t.enabled && t.readyState === "live"
            );

            if (DEBUG && hasEnabledTracks) {
              console.log(`[WebRTC] Health check - User ${userId}:`, {
                playing: !audioEl.paused,
                muted: audioEl.muted,
                volume: audioEl.volume,
                tracks: tracks.length,
                enabledTracks: tracks.filter((t) => t.enabled).length,
              });
            }

            if (hasEnabledTracks && !audioEl.paused && !audioEl.muted) {
              hasPlayingAudio = true;
            } else if (hasEnabledTracks && (audioEl.paused || audioEl.muted)) {
              // Try to play if we have tracks but audio is paused/muted
              if (DEBUG)
                console.log(
                  `[WebRTC] Attempting to resume audio for ${userId}`
                );
              audioEl.muted = false;
              audioEl.play().catch((err) => {
                if (DEBUG)
                  console.error(`[WebRTC] Failed to resume audio:`, err);
              });
            }
          }
        });

        // If we have remote streams but no playing audio, try to reconnect
        if (
          remoteStreams.length > 0 &&
          !hasPlayingAudio &&
          audioStatus === "connecting"
        ) {
          if (DEBUG) {
            console.log(
              "[WebRTC] Health check: Have streams but no playing audio, checking connections"
            );
          }

          // Check connection states
          let hasConnectedPeers = false;
          peerConnectionsRef.current.forEach((pc, userId) => {
            if (pc.connectionState === "connected") {
              hasConnectedPeers = true;
            } else if (
              pc.connectionState === "failed" ||
              pc.connectionState === "disconnected"
            ) {
              if (DEBUG)
                console.log(
                  `[WebRTC] Reconnecting to ${userId} (health check)`
                );
              closePeerConnection(userId);
              if (space?.status === "live") {
                setupPeerConnection(userId);
              }
            }
          });

          if (!hasConnectedPeers && space) {
            // Reconnect to all speakers
            const speakers = (space.speakers || []).filter(
              (s) => (s._id || s).toString() !== user._id.toString()
            );
            speakers.forEach((speaker) => {
              const speakerId = speaker._id || speaker;
              closePeerConnection(speakerId);
              setupPeerConnection(speakerId);
            });
          }
        }
      }, 5000); // Check every 5 seconds

      return () => clearInterval(healthCheckInterval);
    }
  }, [isSpeaker, space, audioStatus, remoteStreams, user._id]);

  const fetchSpace = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/spaces/${spaceId}`);
      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setSpace(data);
      setIsHost(data.hostId._id === user._id);
      const newIsSpeaker =
        data.speakers.some((s) => s._id === user._id) ||
        data.hostId._id === user._id;
      setIsSpeaker(newIsSpeaker);
      setIsRecording(data.isRecording || false);
      setRecordingId(data.activeRecordingId || null);

      // Join space room via socket
      if (socket) {
        socket.emit("space:join", { spaceId });
      }

      // Initialize WebRTC if space is live
      if (data.status === "live") {
        initializeWebRTC(newIsSpeaker, data);
      }
    } catch (error) {
      console.error("Error fetching space:", error);
      toast.error(error.message);
      navigate("/spaces");
    } finally {
      setLoading(false);
    }
  };

  const setupSocketListeners = () => {
    if (!socket) return;

    socket.on(
      "space:recordingStatus",
      ({ spaceId: sid, isRecording: recording, recordingId: rid }) => {
        if (sid === spaceId) {
          setIsRecording(recording);
          setRecordingId(rid || null);
          if (rid) {
            recordingIdRef.current = rid; // Update ref as well
          }
          if (!recording && mediaRecorderRef.current) {
            // Stop recording if server says to stop
            handleStopRecording();
          }
        }
      }
    );

    socket.on("space:statusChanged", ({ spaceId: sid, status }) => {
      if (sid === spaceId) {
        setSpace((prev) => {
          const updated = prev ? { ...prev, status } : null;
          // Initialize WebRTC when space goes live
          if (status === "live" && updated) {
            initializeWebRTC(isSpeaker, updated);
          } else if (status === "ended") {
            cleanup();
          }
          return updated;
        });
        if (status === "ended") {
          toast.info("Space has ended");
          navigate("/spaces");
        }
      }
    });

    socket.on("space:error", ({ error }) => {
      toast.error(error);
    });

    socket.on("space:participantJoined", ({ spaceId: sid, userId, role }) => {
      if (sid === spaceId && userId !== user._id) {
        if (DEBUG)
          console.log(`[WebRTC] Participant joined: ${userId} as ${role}`);
        // Refresh space to get updated participant list
        fetchSpace();
      }
    });

    socket.on("space:participantLeft", ({ spaceId: sid, userId }) => {
      if (sid === spaceId && userId !== user._id) {
        if (DEBUG) console.log(`[WebRTC] Participant left: ${userId}`);
        closePeerConnection(userId);
        // Refresh space
        fetchSpace();
      }
    });

    // WebRTC signaling handlers
    socket.on("space:webrtc:offer", handleWebRTCOffer);
    socket.on("space:webrtc:answer", handleWebRTCAnswer);
    socket.on("space:webrtc:ice", handleWebRTCICE);
    socket.on("space:webrtc:ready", handleWebRTCReady);

    return () => {
      socket.off("space:recordingStatus");
      socket.off("space:statusChanged");
      socket.off("space:error");
      socket.off("space:participantJoined");
      socket.off("space:participantLeft");
      socket.off("space:webrtc:offer");
      socket.off("space:webrtc:answer");
      socket.off("space:webrtc:ice");
      socket.off("space:webrtc:ready");
    };
  };

  const cleanup = () => {
    if (socket) {
      socket.emit("space:leave", { spaceId });
    }

    // Close all peer connections
    peerConnectionsRef.current.forEach((pc, userId) => {
      closePeerConnection(userId);
    });
    peerConnectionsRef.current.clear();

    // Stop local tracks
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    if (localAudioTrackRef.current) {
      localAudioTrackRef.current.stop();
      localAudioTrackRef.current = null;
    }

    // Clean up audio elements
    audioElementsRef.current.forEach((audioEl) => {
      if (audioEl.srcObject) {
        audioEl.srcObject.getTracks().forEach((track) => track.stop());
      }
      audioEl.remove();
    });
    audioElementsRef.current.clear();

    // Clean up recording
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }

    // Clear recording ID ref
    recordingIdRef.current = null;

    pendingIceCandidatesRef.current.clear();
  };

  // ========== WebRTC Functions ==========

  // Create RTCPeerConnection with proper configuration
  const createPeerConnection = (targetUserId) => {
    if (DEBUG)
      console.log(`[WebRTC] Creating peer connection to ${targetUserId}`);

    const pc = new RTCPeerConnection({
      iceServers: iceServersRef.current,
      iceCandidatePoolSize: 10,
      // Optimize for faster connection
      iceTransportPolicy: "all", // Try both relay and direct connections
    });

    // Connection state monitoring
    pc.onconnectionstatechange = () => {
      if (DEBUG) {
        console.log(
          `[WebRTC] Connection state (${targetUserId}):`,
          pc.connectionState
        );

        // Log transceiver states
        const transceivers = pc.getTransceivers();
        transceivers.forEach((t, idx) => {
          console.log(`[WebRTC] Transceiver ${idx}:`, {
            direction: t.direction,
            kind: t.receiver.track?.kind || "none",
            enabled: t.receiver.track?.enabled,
            readyState: t.receiver.track?.readyState,
            muted: t.receiver.track?.muted,
          });
        });

        // Log senders (for speakers)
        if (isSpeaker) {
          const senders = pc.getSenders();
          senders.forEach((s, idx) => {
            console.log(`[WebRTC] Sender ${idx}:`, {
              track: s.track?.id || "none",
              enabled: s.track?.enabled,
              readyState: s.track?.readyState,
            });
          });
        }
      }

      if (
        pc.connectionState === "failed" ||
        pc.connectionState === "disconnected"
      ) {
        setConnectionQuality("poor");
        // Try to reconnect after 3 seconds
        setTimeout(() => {
          const currentPc = peerConnectionsRef.current.get(targetUserId);
          if (
            currentPc &&
            (currentPc.connectionState === "failed" ||
              currentPc.connectionState === "disconnected")
          ) {
            if (DEBUG) console.log(`[WebRTC] Reconnecting to ${targetUserId}`);
            closePeerConnection(targetUserId);
            if (space?.status === "live") {
              setupPeerConnection(targetUserId);
            }
          }
        }, 3000);
      } else if (pc.connectionState === "connected") {
        setConnectionQuality("good");

        // For speakers: verify we're sending audio
        if (isSpeaker) {
          const senders = pc.getSenders();
          const hasActiveSender = senders.some(
            (s) =>
              s.track &&
              s.track.kind === "audio" &&
              s.track.enabled &&
              s.track.readyState === "live"
          );
          if (DEBUG) {
            console.log(
              `[WebRTC] Speaker connected to ${targetUserId}, sending audio: ${hasActiveSender}`,
              {
                senders: senders.length,
                tracks: senders.map((s) => ({
                  kind: s.track?.kind,
                  enabled: s.track?.enabled,
                  readyState: s.track?.readyState,
                  muted: s.track?.muted,
                })),
              }
            );
          }
          if (!hasActiveSender) {
            console.warn(
              `[WebRTC] Speaker has no active audio track to send to ${targetUserId}`
            );
            // Try to re-add track
            if (localAudioTrackRef.current && localStream) {
              const existingSender = senders.find(
                (s) => s.track === localAudioTrackRef.current
              );
              if (!existingSender) {
                console.log(
                  `[WebRTC] Re-adding audio track to ${targetUserId}`
                );
                pc.addTrack(localAudioTrackRef.current, localStream);
              }
            }
          }
        }

        // For listeners: check if we're receiving audio
        if (!isSpeaker) {
          const receivers = pc.getReceivers();
          const hasAudioTrack = receivers.some(
            (r) =>
              r.track &&
              r.track.kind === "audio" &&
              r.track.enabled &&
              r.track.readyState === "live"
          );
          if (DEBUG) {
            console.log(
              `[WebRTC] Listener connected to ${targetUserId}, receiving audio: ${hasAudioTrack}`,
              {
                receivers: receivers.length,
                tracks: receivers.map((r) => ({
                  kind: r.track?.kind,
                  enabled: r.track?.enabled,
                  readyState: r.track?.readyState,
                  muted: r.track?.muted,
                })),
              }
            );
          }
          if (hasAudioTrack) {
            setAudioStatus("connected");
          } else {
            // Wait a shorter time for track to arrive (reduced from 2000ms to 1000ms)
            setTimeout(() => {
              const stillConnected =
                peerConnectionsRef.current.get(targetUserId);
              if (
                stillConnected &&
                stillConnected.connectionState === "connected"
              ) {
                const receivers = stillConnected.getReceivers();
                const hasTrack = receivers.some(
                  (r) =>
                    r.track &&
                    r.track.kind === "audio" &&
                    r.track.enabled &&
                    r.track.readyState === "live"
                );
                if (!hasTrack) {
                  console.warn(
                    `[WebRTC] No audio track received from ${targetUserId} after connection`
                  );
                  setAudioStatus("idle");
                } else {
                  setAudioStatus("connected");
                }
              }
            }, 1000); // Reduced from 2000ms
          }
        }
      } else if (pc.connectionState === "connecting") {
        setAudioStatus("connecting");
      } else if (pc.connectionState === "checking") {
        // ICE checking - connection is in progress
        setAudioStatus("connecting");
      }
    };

    // ICE connection state monitoring for faster feedback
    pc.oniceconnectionstatechange = () => {
      if (DEBUG) {
        console.log(
          `[WebRTC] ICE connection state (${targetUserId}):`,
          pc.iceConnectionState
        );
      }

      // Update status based on ICE state for faster feedback
      if (pc.iceConnectionState === "checking") {
        setAudioStatus("connecting");
      } else if (
        pc.iceConnectionState === "connected" ||
        pc.iceConnectionState === "completed"
      ) {
        setConnectionQuality("good");
        if (!isSpeaker) {
          // For listeners, immediately check for tracks
          const receivers = pc.getReceivers();
          const hasTrack = receivers.some(
            (r) =>
              r.track &&
              r.track.kind === "audio" &&
              r.track.enabled &&
              r.track.readyState === "live"
          );
          if (hasTrack) {
            setAudioStatus("connected");
          } else {
            // Wait a short time for track to arrive
            setTimeout(() => {
              const receivers = pc.getReceivers();
              const hasTrack = receivers.some(
                (r) =>
                  r.track &&
                  r.track.kind === "audio" &&
                  r.track.enabled &&
                  r.track.readyState === "live"
              );
              if (hasTrack) {
                setAudioStatus("connected");
              }
            }, 500); // Reduced from 1000ms to 500ms for faster feedback
          }
        } else {
          // Speaker - connection is good
          setAudioStatus("connected");
        }
      } else if (
        pc.iceConnectionState === "failed" ||
        pc.iceConnectionState === "disconnected"
      ) {
        setConnectionQuality("poor");
        // Will try to reconnect via onconnectionstatechange handler
      }
    };

    // Note: ICE connection state monitoring moved to onconnectionstatechange handler above

    pc.onsignalingstatechange = () => {
      if (DEBUG) {
        console.log(
          `[WebRTC] Signaling state (${targetUserId}):`,
          pc.signalingState
        );
      }
    };

    // Track ICE candidates
    let iceCandidateCount = 0;
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        iceCandidateCount++;
        if (DEBUG) {
          console.log(
            `[WebRTC] ICE candidate #${iceCandidateCount} from ${user._id} to ${targetUserId}:`,
            event.candidate.candidate.substring(0, 50)
          );
        }

        // Send ICE candidate via signaling
        if (socket && pc.signalingState !== "closed") {
          socket.emit("space:webrtc:ice", {
            spaceId,
            targetUserId,
            candidate: event.candidate,
          });
        }
      } else {
        if (DEBUG)
          console.log(`[WebRTC] ICE gathering complete for ${targetUserId}`);
      }
    };

    // Handle incoming tracks (for listeners)
    pc.ontrack = (event) => {
      if (DEBUG) {
        console.log(`[WebRTC] Track received from ${targetUserId}:`, {
          kind: event.track.kind,
          id: event.track.id,
          enabled: event.track.enabled,
          readyState: event.track.readyState,
          streams: event.streams.length,
          trackEnabled: event.track.enabled,
          trackMuted: event.track.muted,
          transceiver: event.transceiver?.direction,
        });
      }

      // Only handle audio tracks
      if (event.track.kind !== "audio") {
        if (DEBUG)
          console.log(`[WebRTC] Ignoring non-audio track from ${targetUserId}`);
        return;
      }

      // Get the track and stream
      const track = event.track;
      let remoteStream = null;

      // Prefer stream from event, fallback to creating new stream
      if (event.streams && event.streams.length > 0) {
        remoteStream = event.streams[0];
      } else {
        // Create a new stream with the track
        remoteStream = new MediaStream([track]);
        if (DEBUG)
          console.log(
            `[WebRTC] Created new stream for track from ${targetUserId}`
          );
      }

      // Ensure track is enabled
      if (track && !track.enabled) {
        track.enabled = true;
        if (DEBUG) console.log(`[WebRTC] Enabled track for ${targetUserId}`);
      }

      // Verify track is live
      if (track.readyState !== "live") {
        console.warn(
          `[WebRTC] Track from ${targetUserId} is not live yet, readyState: ${track.readyState}`
        );
        // Wait for track to become live
        track.onended = () => {
          console.log(`[WebRTC] Track from ${targetUserId} ended`);
        };
        track.onmute = () => {
          console.warn(`[WebRTC] Track from ${targetUserId} was muted`);
        };
        track.onunmute = () => {
          console.log(`[WebRTC] Track from ${targetUserId} was unmuted`);
        };
      }

      if (remoteStream && remoteStream.getAudioTracks().length > 0) {
        // Ensure all audio tracks are enabled
        remoteStream.getAudioTracks().forEach((audioTrack) => {
          if (!audioTrack.enabled) {
            audioTrack.enabled = true;
            if (DEBUG)
              console.log(`[WebRTC] Enabled audio track: ${audioTrack.id}`);
          }
        });

        // Update remote streams state
        setRemoteStreams((prev) => {
          const filtered = prev.filter((s) => s.userId !== targetUserId);
          return [...filtered, { userId: targetUserId, stream: remoteStream }];
        });

        // Create or update audio element
        let audioEl = audioElementsRef.current.get(targetUserId);
        if (!audioEl) {
          audioEl = document.createElement("audio");
          audioEl.autoplay = true;
          audioEl.playsInline = true;
          audioEl.muted = false;
          audioEl.volume = 1.0;
          audioEl.setAttribute("playsinline", "true");
          audioEl.setAttribute("webkit-playsinline", "true");
          audioElementsRef.current.set(targetUserId, audioEl);
          document.body.appendChild(audioEl);

          // Add event listeners for debugging
          audioEl.addEventListener("loadedmetadata", () => {
            if (DEBUG)
              console.log(`[WebRTC] Audio metadata loaded for ${targetUserId}`);
          });
          audioEl.addEventListener("canplay", () => {
            if (DEBUG)
              console.log(`[WebRTC] Audio can play for ${targetUserId}`);
          });
          audioEl.addEventListener("play", () => {
            if (DEBUG)
              console.log(`[WebRTC] Audio started playing for ${targetUserId}`);
            setAudioEnabled(true);
            setAudioStatus("connected");
          });
          audioEl.addEventListener("pause", () => {
            if (DEBUG) console.log(`[WebRTC] Audio paused for ${targetUserId}`);
          });
          audioEl.addEventListener("error", (e) => {
            console.error(`[WebRTC] Audio error for ${targetUserId}:`, e);
          });
        }

        // Set the stream (replace if already set to ensure fresh stream)
        if (audioEl.srcObject) {
          // Stop old tracks
          audioEl.srcObject.getTracks().forEach((t) => t.stop());
        }
        audioEl.srcObject = remoteStream;

        // Ensure audio element is not muted and volume is set
        audioEl.muted = false;
        audioEl.volume = 1.0;

        // Verify stream has tracks
        const streamTracks = remoteStream.getAudioTracks();
        if (DEBUG) {
          console.log(`[WebRTC] Setting audio element for ${targetUserId}:`, {
            tracks: streamTracks.length,
            tracksEnabled: streamTracks.filter((t) => t.enabled).length,
            tracksLive: streamTracks.filter((t) => t.readyState === "live")
              .length,
          });
        }

        // Wait a shorter time for stream to be ready if track is not live yet
        if (streamTracks.some((t) => t.readyState !== "live")) {
          if (DEBUG)
            console.log(
              `[WebRTC] Waiting for tracks to become live from ${targetUserId}`
            );
          const checkInterval = setInterval(() => {
            const allLive = streamTracks.every((t) => t.readyState === "live");
            if (allLive || audioEl.readyState >= 2) {
              // HAVE_CURRENT_DATA or higher
              clearInterval(checkInterval);
              audioEl.play().catch((err) => {
                if (DEBUG)
                  console.error(`[WebRTC] Play failed after wait:`, err);
              });
            }
          }, 50); // Check more frequently (50ms instead of 100ms)
          setTimeout(() => clearInterval(checkInterval), 2000); // Reduced from 5 seconds to 2 seconds
        }

        // Try to play immediately
        const playPromise = audioEl.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              if (DEBUG)
                console.log(`[WebRTC] Audio playing for ${targetUserId}`);
              setAudioEnabled(true);
              setAudioStatus("connected");
            })
            .catch((error) => {
              if (DEBUG) {
                console.error(
                  `[WebRTC] Autoplay blocked for ${targetUserId}:`,
                  error
                );
                console.log(`[WebRTC] Audio element state:`, {
                  muted: audioEl.muted,
                  volume: audioEl.volume,
                  paused: audioEl.paused,
                  readyState: audioEl.readyState,
                  srcObject: !!audioEl.srcObject,
                });
              }
              setAudioEnabled(false);
              setAudioStatus("autoplay-blocked");
            });
        } else {
          // Fallback: try playing after a short delay
          setTimeout(() => {
            audioEl.play().catch((err) => {
              if (DEBUG)
                console.error(
                  `[WebRTC] Delayed play failed for ${targetUserId}:`,
                  err
                );
            });
          }, 100);
        }
      } else {
        console.warn(`[WebRTC] No audio tracks in stream from ${targetUserId}`);
      }
    };

    return pc;
  };

  // Setup peer connection (speaker or listener) with timeout
  const setupPeerConnection = async (targetUserId) => {
    if (peerConnectionsRef.current.has(targetUserId)) {
      if (DEBUG)
        console.log(
          `[WebRTC] Peer connection to ${targetUserId} already exists`
        );
      return;
    }

    const pc = createPeerConnection(targetUserId);
    peerConnectionsRef.current.set(targetUserId, pc);

    // Add connection timeout (15 seconds)
    const connectionTimeout = setTimeout(() => {
      if (
        pc.connectionState !== "connected" &&
        pc.iceConnectionState !== "connected"
      ) {
        console.warn(`[WebRTC] Connection timeout for ${targetUserId}`);
        closePeerConnection(targetUserId);
        // Retry once after timeout
        if (space?.status === "live") {
          setTimeout(() => {
            setupPeerConnection(targetUserId);
          }, 2000);
        }
      }
    }, 15000);

    // Clear timeout when connected
    const clearTimeoutOnConnect = () => {
      if (
        pc.connectionState === "connected" ||
        pc.iceConnectionState === "connected"
      ) {
        clearTimeout(connectionTimeout);
        pc.removeEventListener("connectionstatechange", clearTimeoutOnConnect);
        pc.removeEventListener(
          "iceconnectionstatechange",
          clearTimeoutOnConnect
        );
      }
    };
    pc.addEventListener("connectionstatechange", clearTimeoutOnConnect);
    pc.addEventListener("iceconnectionstatechange", clearTimeoutOnConnect);

    try {
      if (isSpeaker) {
        // Speaker: publish audio track
        if (!localAudioTrackRef.current && localStream) {
          const audioTrack = localStream.getAudioTracks()[0];
          if (audioTrack) {
            // Ensure track is enabled
            audioTrack.enabled = true;
            localAudioTrackRef.current = audioTrack;
            const sender = pc.addTrack(audioTrack, localStream);

            // Set transceiver direction to sendonly for speakers
            const transceiver = pc
              .getTransceivers()
              .find((t) => t.sender === sender);
            if (transceiver) {
              transceiver.direction = "sendonly";
              if (DEBUG) {
                console.log(
                  `[WebRTC] Set transceiver direction to sendonly for ${targetUserId}`
                );
              }
            }

            if (DEBUG) {
              console.log(`[WebRTC] Added audio track to ${targetUserId}:`, {
                trackId: audioTrack.id,
                enabled: audioTrack.enabled,
                muted: audioTrack.muted,
                readyState: audioTrack.readyState,
                direction: transceiver?.direction,
              });
            }
          } else {
            console.error("[WebRTC] No audio track in local stream");
            return;
          }
        } else if (localAudioTrackRef.current) {
          // Ensure track is enabled before adding
          localAudioTrackRef.current.enabled = true;
          const sender = pc.addTrack(localAudioTrackRef.current, localStream);

          // Set transceiver direction to sendonly
          const transceiver = pc
            .getTransceivers()
            .find((t) => t.sender === sender);
          if (transceiver) {
            transceiver.direction = "sendonly";
          }

          if (DEBUG) {
            console.log(
              `[WebRTC] Reused audio track for ${targetUserId}, direction: ${transceiver?.direction}`
            );
          }
        } else {
          console.error("[WebRTC] No local audio track available for speaker");
          toast.error(
            "Microphone not available. Please check your microphone permissions."
          );
          return;
        }

        // Create offer with sendonly constraint
        const offer = await pc.createOffer({
          offerToReceiveAudio: false,
          offerToReceiveVideo: false,
        });
        await pc.setLocalDescription(offer);

        if (DEBUG) {
          console.log(`[WebRTC] Offer created for ${targetUserId}:`, {
            type: offer.type,
            hasAudio: offer.sdp.includes("m=audio"),
            sdpLength: offer.sdp.length,
          });
        }

        // Send offer
        socket.emit("space:webrtc:offer", {
          spaceId,
          targetUserId,
          offer: pc.localDescription,
        });
      } else {
        // Listener: request audio track
        pc.addTransceiver("audio", { direction: "recvonly" });

        if (DEBUG) {
          console.log(
            `[WebRTC] Added recvonly transceiver for ${targetUserId}`
          );
        }

        // Create offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        if (DEBUG) {
          console.log(
            `[WebRTC] Offer created (listener) for ${targetUserId}:`,
            {
              type: offer.type,
              hasAudio: offer.sdp.includes("m=audio"),
              sdpLength: offer.sdp.length,
            }
          );
        }

        // Send offer
        socket.emit("space:webrtc:offer", {
          spaceId,
          targetUserId,
          offer: pc.localDescription,
        });
      }

      setAudioStatus("connecting");
    } catch (error) {
      console.error(
        `[WebRTC] Error setting up peer connection to ${targetUserId}:`,
        error
      );
      closePeerConnection(targetUserId);
    }
  };

  // Handle incoming WebRTC offer
  const handleWebRTCOffer = async ({ spaceId: sid, fromUserId, offer }) => {
    if (sid !== spaceId || fromUserId === user._id) return;

    if (DEBUG) {
      console.log(`[WebRTC] Received offer from ${fromUserId}:`, {
        type: offer.type,
        hasAudio: offer.sdp.includes("m=audio"),
      });
    }

    try {
      let pc = peerConnectionsRef.current.get(fromUserId);

      if (!pc) {
        pc = createPeerConnection(fromUserId);
        peerConnectionsRef.current.set(fromUserId, pc);

        // If we're a speaker, add our audio track BEFORE setting remote description
        if (isSpeaker) {
          let trackToAdd = null;
          if (localAudioTrackRef.current) {
            trackToAdd = localAudioTrackRef.current;
          } else if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
              audioTrack.enabled = true;
              localAudioTrackRef.current = audioTrack;
              trackToAdd = audioTrack;
            }
          }

          if (trackToAdd) {
            const sender = pc.addTrack(trackToAdd, localStream);
            // Set transceiver direction to sendonly
            const transceiver = pc
              .getTransceivers()
              .find((t) => t.sender === sender);
            if (transceiver) {
              transceiver.direction = "sendonly";
              if (DEBUG) {
                console.log(
                  `[WebRTC] Added track and set sendonly when handling offer from ${fromUserId}`
                );
              }
            }
          } else {
            console.warn(
              `[WebRTC] Speaker has no audio track to add when handling offer from ${fromUserId}`
            );
          }
        } else {
          // Listener: add recvonly transceiver BEFORE setting remote description
          pc.addTransceiver("audio", { direction: "recvonly" });
          if (DEBUG) {
            console.log(
              `[WebRTC] Added recvonly transceiver when handling offer from ${fromUserId}`
            );
          }
        }
      }

      // Set remote description
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // Process pending ICE candidates
      const pendingCandidates =
        pendingIceCandidatesRef.current.get(fromUserId) || [];
      for (const candidate of pendingCandidates) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error("[WebRTC] Error adding pending ICE candidate:", err);
        }
      }
      pendingIceCandidatesRef.current.delete(fromUserId);

      // Create answer
      // For speakers answering listeners: answer should be recvonly
      // For listeners answering speakers: answer should be sendonly (but we're listener, so recvonly)
      const answer = await pc.createAnswer({
        offerToReceiveAudio: !isSpeaker, // Listeners want to receive, speakers don't
        offerToReceiveVideo: false,
      });
      await pc.setLocalDescription(answer);

      // Verify transceiver directions after creating answer
      if (DEBUG) {
        const transceivers = pc.getTransceivers();
        transceivers.forEach((t, idx) => {
          console.log(
            `[WebRTC] Transceiver ${idx} direction: ${t.direction}, kind: ${
              t.receiver.track?.kind || "none"
            }`
          );
        });
      }

      if (DEBUG) {
        console.log(`[WebRTC] Answer created for ${fromUserId}:`, {
          type: answer.type,
          hasAudio: answer.sdp.includes("m=audio"),
        });
      }

      // Send answer
      socket.emit("space:webrtc:answer", {
        spaceId,
        targetUserId: fromUserId,
        answer: pc.localDescription,
      });
    } catch (error) {
      console.error(`[WebRTC] Error handling offer from ${fromUserId}:`, error);
    }
  };

  // Handle incoming WebRTC answer
  const handleWebRTCAnswer = async ({ spaceId: sid, fromUserId, answer }) => {
    if (sid !== spaceId || fromUserId === user._id) return;

    if (DEBUG) {
      console.log(`[WebRTC] Received answer from ${fromUserId}:`, {
        type: answer.type,
        hasAudio: answer.sdp.includes("m=audio"),
      });
    }

    try {
      const pc = peerConnectionsRef.current.get(fromUserId);
      if (!pc) {
        console.error(`[WebRTC] No peer connection found for ${fromUserId}`);
        return;
      }

      // Set remote description
      await pc.setRemoteDescription(new RTCSessionDescription(answer));

      // Process pending ICE candidates
      const pendingCandidates =
        pendingIceCandidatesRef.current.get(fromUserId) || [];
      for (const candidate of pendingCandidates) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error("[WebRTC] Error adding pending ICE candidate:", err);
        }
      }
      pendingIceCandidatesRef.current.delete(fromUserId);
    } catch (error) {
      console.error(
        `[WebRTC] Error handling answer from ${fromUserId}:`,
        error
      );
    }
  };

  // Handle incoming ICE candidate
  const handleWebRTCICE = async ({ spaceId: sid, fromUserId, candidate }) => {
    if (sid !== spaceId || fromUserId === user._id) return;

    try {
      const pc = peerConnectionsRef.current.get(fromUserId);
      if (pc && pc.remoteDescription) {
        // Remote description is set, add candidate immediately
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
        if (DEBUG) {
          console.log(`[WebRTC] ICE candidate added for ${fromUserId}`);
        }
      } else {
        // Queue candidate until remote description is set
        if (!pendingIceCandidatesRef.current.has(fromUserId)) {
          pendingIceCandidatesRef.current.set(fromUserId, []);
        }
        pendingIceCandidatesRef.current.get(fromUserId).push(candidate);
        if (DEBUG) {
          console.log(`[WebRTC] ICE candidate queued for ${fromUserId}`);
        }
      }
    } catch (error) {
      console.error(
        `[WebRTC] Error handling ICE candidate from ${fromUserId}:`,
        error
      );
    }
  };

  // Handle peer ready signal
  const handleWebRTCReady = ({ spaceId: sid, fromUserId }) => {
    if (sid !== spaceId || fromUserId === user._id) return;
    if (DEBUG) console.log(`[WebRTC] Peer ${fromUserId} is ready`);
    setupPeerConnection(fromUserId);
  };

  // Close peer connection
  const closePeerConnection = (targetUserId) => {
    const pc = peerConnectionsRef.current.get(targetUserId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(targetUserId);
      if (DEBUG)
        console.log(`[WebRTC] Closed peer connection to ${targetUserId}`);
    }

    // Clean up audio element
    const audioEl = audioElementsRef.current.get(targetUserId);
    if (audioEl) {
      if (audioEl.srcObject) {
        audioEl.srcObject.getTracks().forEach((track) => track.stop());
      }
      audioEl.remove();
      audioElementsRef.current.delete(targetUserId);
    }

    // Remove from remote streams
    setRemoteStreams((prev) => prev.filter((s) => s.userId !== targetUserId));

    // Clear pending candidates
    pendingIceCandidatesRef.current.delete(targetUserId);
  };

  const handleStartSpace = async () => {
    if (!isHost) return;

    try {
      const res = await fetch(`/api/spaces/${spaceId}/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setSpace(data);
      toast.success("Space started!");
    } catch (error) {
      console.error("Error starting space:", error);
      toast.error(error.message);
    }
  };

  const handleEndSpace = async () => {
    if (!isHost) return;

    try {
      const res = await fetch(`/api/spaces/${spaceId}/end`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      toast.success("Space ended");
      navigate("/spaces");
    } catch (error) {
      console.error("Error ending space:", error);
      toast.error(error.message);
    }
  };

  // Helper function to get user-friendly error message for microphone access
  const getMicrophoneErrorMessage = (error) => {
    if (!error) return "Failed to access microphone";

    const errorName = error.name || "";
    const errorMessage = error.message || "";

    // Check if it's a secure context issue
    const isSecureContext =
      window.isSecureContext ||
      window.location.protocol === "https:" ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    if (!isSecureContext) {
      return "Microphone access requires HTTPS. Please access this site via HTTPS or use localhost. For network access, you need to set up SSL/TLS.";
    }

    if (
      errorName === "NotAllowedError" ||
      errorName === "PermissionDeniedError"
    ) {
      return "Microphone permission denied. Please allow microphone access in your browser settings and try again.";
    } else if (
      errorName === "NotFoundError" ||
      errorName === "DevicesNotFoundError"
    ) {
      return "No microphone found. Please connect a microphone and try again.";
    } else if (
      errorName === "NotReadableError" ||
      errorName === "TrackStartError"
    ) {
      return "Microphone is already in use by another application. Please close other apps using the microphone.";
    } else if (
      errorName === "OverconstrainedError" ||
      errorName === "ConstraintNotSatisfiedError"
    ) {
      return "Microphone doesn't support required settings. Please try a different microphone.";
    } else if (
      errorName === "TypeError" &&
      (errorMessage.includes("getUserMedia") ||
        errorMessage.includes("secure context"))
    ) {
      return "Microphone access requires HTTPS. Please access this site via HTTPS or use localhost.";
    } else {
      return `Failed to access microphone: ${errorMessage || errorName}`;
    }
  };

  // Check if getUserMedia is available and if we're in a secure context
  const checkMediaDevicesSupport = () => {
    // Check if we're in a secure context (HTTPS or localhost)
    const isSecureContext =
      window.isSecureContext ||
      window.location.protocol === "https:" ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    if (!isSecureContext) {
      return {
        supported: false,
        message:
          "Microphone access requires HTTPS. Please access this site via HTTPS or use localhost. For network access, you need to set up SSL/TLS.",
      };
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return {
        supported: false,
        message:
          "Your browser doesn't support microphone access. Please use a modern browser (Chrome, Firefox, Safari, Edge).",
      };
    }
    return { supported: true };
  };

  const handleStartRecording = async () => {
    if (!isHost) {
      toast.error("Only the host can start recording");
      return;
    }

    if (space.status !== "live") {
      toast.error("Space must be live to record");
      return;
    }

    try {
      // Check browser support
      const support = checkMediaDevicesSupport();
      if (!support.supported) {
        toast.error(support.message);
        return;
      }

      // Get user media (host's mic)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // For MVP: Record only host's audio
      // In production with WebRTC, you'd mix all remote audio tracks
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Upload recording after stopping
        await uploadRecording();
        stream.getTracks().forEach((track) => track.stop());
      };

      // Start recording
      mediaRecorder.start(1000); // Collect data every second
      recordingStartTimeRef.current = Date.now();

      // Notify server
      const res = await fetch(`/api/spaces/${spaceId}/record/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await res.json();

      if (data.error) {
        mediaRecorder.stop();
        stream.getTracks().forEach((track) => track.stop());
        throw new Error(data.error);
      }

      setIsRecording(true);
      setRecordingId(data.recordingId);
      recordingIdRef.current = data.recordingId; // Store in ref as well
      setLocalStream(stream);

      // Also emit socket event (redundant but ensures real-time sync)
      if (socket) {
        socket.emit("space:recordStart", { spaceId });
      }

      toast.success("Recording started");
    } catch (error) {
      console.error("Error starting recording:", error);
      const errorMessage = getMicrophoneErrorMessage(error);
      toast.error(errorMessage, { duration: 5000 });
    }
  };

  const handleStopRecording = async () => {
    if (!isHost) {
      toast.error("Only the host can stop recording");
      return;
    }

    if (
      !mediaRecorderRef.current ||
      mediaRecorderRef.current.state === "inactive"
    ) {
      return;
    }

    try {
      // Stop MediaRecorder
      mediaRecorderRef.current.stop();

      // Notify server
      const res = await fetch(`/api/spaces/${spaceId}/record/stop`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setIsRecording(false);

      // Store recordingId from stop response if available (in case it wasn't set before)
      if (data.recordingId) {
        setRecordingId(data.recordingId);
        recordingIdRef.current = data.recordingId;
      }

      // Also emit socket event
      if (socket) {
        socket.emit("space:recordStop", { spaceId });
      }

      toast.success("Recording stopped. Processing...");
    } catch (error) {
      console.error("Error stopping recording:", error);
      toast.error(error.message);
    }
  };

  const uploadRecording = async () => {
    if (audioChunksRef.current.length === 0) {
      console.error("No audio chunks to upload");
      return;
    }

    // Use ref value first, fallback to state, then check if valid
    const currentRecordingId = recordingIdRef.current || recordingId;

    if (!currentRecordingId) {
      console.error("No recording ID available for upload");
      toast.error("Recording ID not found. Cannot upload recording.");
      return;
    }

    try {
      const audioBlob = new Blob(audioChunksRef.current, {
        type: "audio/webm;codecs=opus",
      });

      // Create FormData
      const formData = new FormData();
      const audioFile = new File([audioBlob], "recording.webm", {
        type: "audio/webm;codecs=opus",
      });
      formData.append("recording", audioFile);

      // Upload to server
      const res = await fetch(
        `/api/spaces/${spaceId}/record/upload/${currentRecordingId}`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      toast.success("Recording saved successfully!");
      console.log("Recording URL:", data.url);
    } catch (error) {
      console.error("Error uploading recording:", error);
      toast.error("Failed to upload recording: " + error.message);
    } finally {
      audioChunksRef.current = [];
      // Clear recordingId ref after successful upload
      recordingIdRef.current = null;
    }
  };

  // Initialize WebRTC system
  const initializeWebRTC = async (speakerMode, spaceData) => {
    if (!spaceData || spaceData.status !== "live") return;

    try {
      if (speakerMode) {
        // Get user media for speaker
        await initializeSpeakerAudio();
      }

      // Connect to all participants
      await connectToAllParticipants(spaceData);
    } catch (error) {
      console.error("[WebRTC] Error initializing WebRTC:", error);
      toast.error("Failed to initialize audio connection");
    }
  };

  // Initialize speaker audio (get user media)
  const initializeSpeakerAudio = async () => {
    try {
      if (localStream) {
        // Already have stream
        return;
      }

      // Check browser support
      const support = checkMediaDevicesSupport();
      if (!support.supported) {
        toast.error(support.message);
        return;
      }

      if (DEBUG) {
        console.log("[WebRTC] Getting user media for speaker");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        if (DEBUG) {
          console.log("[WebRTC] User media acquired:", {
            trackId: audioTrack.id,
            enabled: audioTrack.enabled,
            muted: audioTrack.muted,
            readyState: audioTrack.readyState,
          });
        }
        localAudioTrackRef.current = audioTrack;
        setLocalStream(stream);
        setIsMuted(false);
      }
    } catch (error) {
      console.error("[WebRTC] Error getting user media:", error);
      const errorMessage = getMicrophoneErrorMessage(error);
      toast.error(errorMessage, { duration: 5000 });
    }
  };

  // Connect to all participants in the space (optimized for parallel connections)
  const connectToAllParticipants = async (spaceData) => {
    if (!spaceData || !socket) return;

    const allParticipants = [
      ...(spaceData.speakers || []),
      ...(spaceData.listeners || []),
    ].filter((p) => {
      const participantId = p._id || p;
      return participantId.toString() !== user._id.toString();
    });

    if (DEBUG) {
      console.log(
        `[WebRTC] Connecting to ${allParticipants.length} participants in parallel`
      );
    }

    // Set connecting status immediately
    setAudioStatus("connecting");
    setConnectionProgress({ total: allParticipants.length, connected: 0 });

    // Notify others that we're ready (all at once)
    allParticipants.forEach((participant) => {
      const participantId = participant._id || participant;
      socket.emit("space:webrtc:ready", {
        spaceId,
        targetUserId: participantId,
      });
    });

    // Set up ALL connections in parallel (not sequentially)
    const connectionPromises = allParticipants.map((participant) => {
      const participantId = participant._id || participant;
      return setupPeerConnection(participantId).catch((error) => {
        console.error(`[WebRTC] Failed to connect to ${participantId}:`, error);
        // Don't throw - continue with other connections
        return null;
      });
    });

    // Wait for all connections to be initiated (not necessarily completed)
    await Promise.allSettled(connectionPromises);

    if (DEBUG) {
      console.log(`[WebRTC] All connection attempts initiated`);
    }
  };

  const handleToggleMute = () => {
    if (localStream) {
      const newMutedState = !isMuted;
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = newMutedState;
      });
      setIsMuted(newMutedState);

      if (DEBUG) {
        console.log(
          `[WebRTC] Audio track ${newMutedState ? "muted" : "unmuted"}`
        );
      }
    }
  };

  // Handle autoplay enable button
  const handleEnableAudio = async () => {
    try {
      // Try to play all audio elements
      let played = false;
      const playPromises = [];

      audioElementsRef.current.forEach((audioEl, userId) => {
        if (audioEl.srcObject) {
          // Ensure audio is not muted and volume is set
          audioEl.muted = false;
          audioEl.volume = 1.0;

          // Enable all tracks in the stream
          if (audioEl.srcObject && audioEl.srcObject.getAudioTracks) {
            audioEl.srcObject.getAudioTracks().forEach((track) => {
              if (!track.enabled) {
                track.enabled = true;
                if (DEBUG)
                  console.log(`[WebRTC] Enabled track for user ${userId}`);
              }
            });
          }

          const playPromise = audioEl.play();
          if (playPromise !== undefined) {
            playPromises.push(
              playPromise
                .then(() => {
                  if (DEBUG)
                    console.log(`[WebRTC] Audio playing for user ${userId}`);
                  played = true;
                  setAudioEnabled(true);
                  setAudioStatus("connected");
                })
                .catch((error) => {
                  console.error(
                    `[WebRTC] Error playing audio for ${userId}:`,
                    error
                  );
                  console.error(`[WebRTC] Audio element state:`, {
                    muted: audioEl.muted,
                    volume: audioEl.volume,
                    paused: audioEl.paused,
                    readyState: audioEl.readyState,
                    srcObject: !!audioEl.srcObject,
                  });
                })
            );
          }
        }
      });

      await Promise.allSettled(playPromises);

      if (played) {
        toast.success("Audio enabled");
      } else {
        toast.error(
          "Failed to enable audio. Please check your browser settings."
        );
      }
    } catch (error) {
      console.error("[WebRTC] Error enabling audio:", error);
      toast.error("Failed to enable audio");
    }
  };

  const handleJoinAsSpeaker = async () => {
    try {
      const res = await fetch(`/api/spaces/${spaceId}/join/speaker`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setIsSpeaker(true);
      setSpace(data);

      // Get user media and initialize WebRTC
      await initializeSpeakerAudio();
      await connectToAllParticipants(data);

      toast.success("Joined as speaker");
    } catch (error) {
      console.error("Error joining as speaker:", error);
      toast.error(error.message);
    }
  };

  const handleJoinAsListener = async () => {
    try {
      const res = await fetch(`/api/spaces/${spaceId}/join/listener`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setIsSpeaker(false);
      setSpace(data);

      // Stop local audio and switch to listener mode
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
        setLocalStream(null);
      }
      if (localAudioTrackRef.current) {
        localAudioTrackRef.current.stop();
        localAudioTrackRef.current = null;
      }

      // Close existing connections and reconnect as listener
      peerConnectionsRef.current.forEach((pc, userId) => {
        closePeerConnection(userId);
      });

      await connectToAllParticipants(data);

      toast.success("Joined as listener");
    } catch (error) {
      console.error("Error joining as listener:", error);
      toast.error(error.message);
    }
  };

  const handleLeaveSpace = async () => {
    try {
      await fetch(`/api/spaces/${spaceId}/leave`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      cleanup();
      navigate("/spaces");
    } catch (error) {
      console.error("Error leaving space:", error);
    }
  };

  if (loading) {
    return (
      <Flex justify="center" align="center" minH="400px">
        <Spinner size="xl" />
      </Flex>
    );
  }

  if (!space) {
    return (
      <Box textAlign="center" py={8}>
        <Text>Space not found</Text>
        <Button mt={4} onClick={() => navigate("/spaces")}>
          Back to Spaces
        </Button>
      </Box>
    );
  }

  const bg = useColorModeValue("gray.50", "gray.800");

  return (
    <Flex flexDirection="column" gap={4} p={4} minH="100vh">
      {/* Header */}
      <Flex justifyContent="space-between" alignItems="center" mb={4}>
        <Flex alignItems="center" gap={3}>
          <Avatar
            size="md"
            src={space.hostId?.profilePic}
            name={space.hostId?.name}
          />
          <Flex flexDirection="column">
            <Text fontWeight="bold">{space.title || "Untitled Space"}</Text>
            <Text fontSize="sm" color="gray.500">
              Hosted by {space.hostId?.username}
            </Text>
          </Flex>
        </Flex>
        <Button variant="outline" onClick={handleLeaveSpace}>
          Leave
        </Button>
      </Flex>

      {/* Status Badge */}
      <Flex gap={2} alignItems="center">
        <Badge
          colorScheme={space.status === "live" ? "green" : "gray"}
          fontSize="sm"
        >
          {space.status.toUpperCase()}
        </Badge>
        {isRecording && (
          <Badge colorScheme="red" fontSize="sm">
            🔴 Recording
          </Badge>
        )}
      </Flex>

      {/* Host Controls */}
      {isHost && (
        <Box p={4} bg={bg} borderRadius="md">
          <Text fontWeight="bold" mb={2}>
            Host Controls
          </Text>
          <Flex gap={2} flexWrap="wrap">
            {space.status === "scheduled" && (
              <Button colorScheme="green" onClick={handleStartSpace}>
                Start Space
              </Button>
            )}
            {space.status === "live" && (
              <>
                {!isRecording ? (
                  <Button colorScheme="red" onClick={handleStartRecording}>
                    Start Recording
                  </Button>
                ) : (
                  <Button colorScheme="red" onClick={handleStopRecording}>
                    <FaStop style={{ marginRight: "8px" }} />
                    Stop Recording
                  </Button>
                )}
                <Button colorScheme="orange" onClick={handleEndSpace}>
                  End Space
                </Button>
              </>
            )}
          </Flex>
        </Box>
      )}

      {/* Recording Indicator (visible to all) */}
      {isRecording && (
        <Box
          p={3}
          bg="red.50"
          borderRadius="md"
          borderWidth="1px"
          borderColor="red.200"
        >
          <Text fontSize="sm" color="red.700">
            🔴 Recording in progress...
          </Text>
        </Box>
      )}

      {/* Participants */}
      <Box p={4} bg={bg} borderRadius="md">
        <Text fontWeight="bold" mb={2}>
          Speakers ({space.speakers?.length || 0})
        </Text>
        <Flex flexWrap="wrap" gap={2}>
          {space.speakers?.map((speaker) => (
            <Flex
              key={speaker._id}
              alignItems="center"
              gap={2}
              p={2}
              bg="white"
              borderRadius="md"
            >
              <Avatar size="sm" src={speaker.profilePic} name={speaker.name} />
              <Text fontSize="sm">{speaker.username}</Text>
              {speaker._id === space.hostId._id && (
                <Badge colorScheme="blue" fontSize="xs">
                  Host
                </Badge>
              )}
            </Flex>
          ))}
        </Flex>
      </Box>

      {/* Listener Controls (non-host) */}
      {!isHost && space.status === "live" && (
        <Box p={4} bg={bg} borderRadius="md">
          <Text fontWeight="bold" mb={2}>
            Your Role
          </Text>
          <Flex gap={2}>
            {!isSpeaker ? (
              <Button colorScheme="blue" onClick={handleJoinAsSpeaker}>
                Join as Speaker
              </Button>
            ) : (
              <Button variant="outline" onClick={handleJoinAsListener}>
                Switch to Listener
              </Button>
            )}
          </Flex>
        </Box>
      )}

      {/* Audio Status (for listeners) */}
      {!isSpeaker && space.status === "live" && (
        <Box p={4} bg={bg} borderRadius="md">
          <Text fontWeight="bold" mb={2}>
            Audio Status
          </Text>
          {audioStatus === "connecting" && (
            <Flex flexDirection="column" gap={2}>
              <Flex alignItems="center" gap={2}>
                <Spinner size="sm" />
                <Text fontSize="sm">Connecting audio...</Text>
              </Flex>
              {connectionProgress.total > 0 && (
                <Text fontSize="xs" color="gray.500">
                  {connectionProgress.connected} of {connectionProgress.total}{" "}
                  connections established
                </Text>
              )}
              <Text fontSize="xs" color="gray.500">
                This usually takes 2-5 seconds
              </Text>
            </Flex>
          )}
          {audioStatus === "autoplay-blocked" && !audioEnabled && (
            <Flex flexDirection="column" gap={2}>
              <Text fontSize="sm" color="orange.500">
                Tap to enable audio
              </Text>
              <Button size="sm" colorScheme="blue" onClick={handleEnableAudio}>
                Enable Audio
              </Button>
            </Flex>
          )}
          {audioStatus === "connected" && (
            <Flex flexDirection="column" gap={2}>
              <Text fontSize="sm" color="green.500">
                ✓ Audio connected
              </Text>
              {remoteStreams.length > 0 && (
                <Text fontSize="xs" color="gray.500">
                  Listening to {remoteStreams.length} speaker
                  {remoteStreams.length !== 1 ? "s" : ""}
                </Text>
              )}
            </Flex>
          )}
          {audioStatus === "idle" && remoteStreams.length === 0 && (
            <Flex flexDirection="column" gap={2}>
              <Text fontSize="sm" color="orange.500">
                Waiting for speakers...
              </Text>
              <Text fontSize="xs" color="gray.500">
                No active audio streams yet
              </Text>
            </Flex>
          )}
          {connectionQuality === "poor" && (
            <Text fontSize="sm" color="red.500">
              ⚠ Poor connection
            </Text>
          )}
        </Box>
      )}

      {/* Audio Controls (for speakers) */}
      {isSpeaker && space.status === "live" && (
        <Box p={4} bg={bg} borderRadius="md">
          <Text fontWeight="bold" mb={2}>
            Audio Controls
          </Text>
          <Flex gap={2} alignItems="center">
            <Button
              colorScheme={isMuted ? "red" : "green"}
              onClick={handleToggleMute}
              leftIcon={isMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
            >
              {isMuted ? "Unmute" : "Mute"}
            </Button>
            {connectionQuality === "poor" && (
              <Text fontSize="sm" color="red.500">
                ⚠ Poor connection
              </Text>
            )}
          </Flex>
        </Box>
      )}

      {/* Space Info */}
      {space.description && (
        <Box p={4} bg={bg} borderRadius="md">
          <Text fontWeight="bold" mb={2}>
            About
          </Text>
          <Text fontSize="sm">{space.description}</Text>
        </Box>
      )}
    </Flex>
  );
};

export default SpaceRoom;

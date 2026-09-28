import { useState, useEffect, useRef, useCallback } from 'react';
import {
  CallStatus,
  Participant,
  MediaPermissionError,
  RemotePeer,
  SignalingOffer,
  SignalingAnswer,
  SignalingIceCandidate,
  SignalingUserLeft,
  ChatMessage,
  FloatingReaction,
} from '../types';
import { getSocket } from '../services/socket';
import { WebRTCConnection, getLocalUserMedia, createSyntheticStream, requestSingleDevice } from '../services/webrtc';

export function useWebRTC() {
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [roomId, setRoomId] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [isHost, setIsHost] = useState<boolean>(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remotePeers, setRemotePeers] = useState<RemotePeer[]>([]);
  const [isMicOn, setIsMicOn] = useState<boolean>(true);
  const [isCameraOn, setIsCameraOn] = useState<boolean>(true);
  const [permissionError, setPermissionError] = useState<MediaPermissionError | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // In-call chat, reactions & screen sharing state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);

  // Map of socketId -> WebRTCConnection for multi-party mesh topology
  const peersRef = useRef<Map<string, WebRTCConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  // Early ICE candidate queue keyed by sender socket ID
  const earlyCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  // Keep local stream ref in sync
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  // Derived legacy accessors for 1-to-1 compatibility
  const remoteStream = remotePeers.length > 0 ? remotePeers[0].stream : null;
  const remoteParticipant = remotePeers.length > 0 ? remotePeers[0].participant : null;

  // Clean up all peer connections
  const cleanupAllPeers = useCallback(() => {
    peersRef.current.forEach((conn) => {
      conn.close();
    });
    peersRef.current.clear();
    setRemotePeers([]);
    earlyCandidatesRef.current.clear();
  }, []);

  // Clean up local media tracks
  const cleanupLocalMedia = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    setIsScreenSharing(false);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      setLocalStream(null);
      localStreamRef.current = null;
    }
  }, []);

  // Toggle microphone with dynamic hardware track acquisition and mesh broadcast
  const toggleMic = useCallback(async () => {
    const socket = getSocket();
    const stream = localStreamRef.current;
    if (stream) {
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length > 0) {
        const nextState = !isMicOn;
        audioTracks.forEach((track) => {
          track.enabled = nextState;
        });
        setIsMicOn(nextState);
        if (socket.connected) {
          socket.emit('media-toggle', { type: 'audio', isMuted: !nextState });
        }
        return;
      }
    }

    // If no audio track exists, attempt to acquire a real microphone track on demand
    const newTrack = await requestSingleDevice('audio');
    if (newTrack) {
      if (!localStreamRef.current) {
        const newStream = new MediaStream([newTrack]);
        localStreamRef.current = newStream;
        setLocalStream(newStream);
      } else {
        localStreamRef.current.addTrack(newTrack);
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      }

      // Replace or add track across all active peer connections
      peersRef.current.forEach((conn) => {
        conn.replaceTrack('audio', newTrack);
      });

      setIsMicOn(true);
      setPermissionError(null);
      if (socket.connected) {
        socket.emit('media-toggle', { type: 'audio', isMuted: false });
      }
    } else {
      setIsMicOn((prev) => {
        const next = !prev;
        if (socket.connected) {
          socket.emit('media-toggle', { type: 'audio', isMuted: !next });
        }
        return next;
      });
    }
  }, [isMicOn]);

  // Toggle camera with dynamic hardware track acquisition and mesh broadcast
  const toggleCamera = useCallback(async () => {
    const socket = getSocket();
    const stream = localStreamRef.current;
    if (stream) {
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length > 0) {
        const nextState = !isCameraOn;
        videoTracks.forEach((track) => {
          track.enabled = nextState;
        });
        setIsCameraOn(nextState);
        if (socket.connected) {
          socket.emit('media-toggle', { type: 'video', isMuted: !nextState });
        }
        return;
      }
    }

    // If no video track exists, attempt to acquire a real camera track on demand
    const newTrack = await requestSingleDevice('video');
    if (newTrack) {
      if (!localStreamRef.current) {
        const newStream = new MediaStream([newTrack]);
        localStreamRef.current = newStream;
        setLocalStream(newStream);
      } else {
        localStreamRef.current.addTrack(newTrack);
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      }

      // Replace or add track across all active peer connections
      peersRef.current.forEach((conn) => {
        conn.replaceTrack('video', newTrack);
      });

      setIsCameraOn(true);
      setPermissionError(null);
      if (socket.connected) {
        socket.emit('media-toggle', { type: 'video', isMuted: false });
      }
    } else {
      setIsCameraOn((prev) => {
        const next = !prev;
        if (socket.connected) {
          socket.emit('media-toggle', { type: 'video', isMuted: !next });
        }
        return next;
      });
    }
  }, [isCameraOn]);

  // Screen Sharing controls
  const stopScreenShare = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }

    // Restore camera track if available
    const cameraTrack = cameraTrackRef.current;
    if (cameraTrack && localStreamRef.current) {
      const currentVideoTrack = localStreamRef.current.getVideoTracks()[0];
      if (currentVideoTrack) {
        localStreamRef.current.removeTrack(currentVideoTrack);
      }
      localStreamRef.current.addTrack(cameraTrack);
      setLocalStream(new MediaStream(localStreamRef.current.getTracks()));

      peersRef.current.forEach((conn) => {
        conn.replaceTrack('video', cameraTrack);
      });
    }

    setIsScreenSharing(false);
  }, []);

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      stopScreenShare();
      return;
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        setErrorMessage('Screen sharing is not supported in this browser.');
        return;
      }

      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      const screenTrack = displayStream.getVideoTracks()[0];
      if (!screenTrack) return;

      screenStreamRef.current = displayStream;

      // Save current camera track before swapping
      if (localStreamRef.current) {
        const currentVideoTrack = localStreamRef.current.getVideoTracks()[0];
        if (currentVideoTrack && currentVideoTrack !== screenTrack) {
          cameraTrackRef.current = currentVideoTrack;
          localStreamRef.current.removeTrack(currentVideoTrack);
        }
        localStreamRef.current.addTrack(screenTrack);
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      } else {
        const newStream = new MediaStream([screenTrack]);
        localStreamRef.current = newStream;
        setLocalStream(newStream);
      }

      // Replace video track across all mesh connections
      peersRef.current.forEach((conn) => {
        conn.replaceTrack('video', screenTrack);
      });

      // Automatically restore camera when user clicks native "Stop sharing" chrome
      screenTrack.onended = () => {
        stopScreenShare();
      };

      setIsScreenSharing(true);
    } catch (err: any) {
      console.warn('[useWebRTC] Screen sharing cancelled or failed:', err);
      if (err.name !== 'NotAllowedError') {
        setErrorMessage('Failed to start screen sharing.');
      }
    }
  }, [isScreenSharing, stopScreenShare]);

  // In-call text chat
  const sendChatMessage = useCallback((text: string) => {
    const socket = getSocket();
    if (!socket.connected) return;

    socket.emit('chat-message', { text });
  }, []);

  // In-call floating emoji reaction
  const sendReaction = useCallback((emoji: string) => {
    const socket = getSocket();
    if (!socket.connected) return;

    socket.emit('call-reaction', { emoji });
  }, []);

  // Initialize or retrieve an RTCPeerConnection wrapper for a specific peer
  const setupWebRTC = useCallback((targetSocketId: string, participantInfo?: Participant): WebRTCConnection => {
    let conn = peersRef.current.get(targetSocketId);
    if (conn && conn.pc && conn.pc.signalingState !== 'closed') {
      console.log('[useWebRTC] Reusing existing connection for:', targetSocketId);
      return conn;
    }

    if (conn) {
      conn.close();
    }

    const socket = getSocket();

    conn = new WebRTCConnection({
      onIceCandidate: (candidate) => {
        socket.emit('ice-candidate', {
          to: targetSocketId,
          candidate,
        });
      },
      onTrack: (remoteMediaStream) => {
        console.log(`[useWebRTC] Remote stream tracks updated for: ${targetSocketId} (count=${remoteMediaStream.getTracks().length})`);
        setRemotePeers((prev) => {
          const index = prev.findIndex((p) => p.participant.socketId === targetSocketId);
          if (index >= 0) {
            const updated = [...prev];
            updated[index] = { ...updated[index], stream: remoteMediaStream, connectionState: 'connected' };
            return updated;
          }
          const pInfo = participantInfo || { socketId: targetSocketId, displayName: 'Participant', joinedAt: Date.now() };
          return [
            ...prev,
            {
              participant: pInfo,
              stream: remoteMediaStream,
              connectionState: 'connected',
              isAudioMuted: Boolean(pInfo.isAudioMuted),
              isVideoMuted: Boolean(pInfo.isVideoMuted),
            },
          ];
        });
        setCallStatus('connected');
      },
      onConnectionStateChange: (state) => {
        console.log(`[useWebRTC] Peer connection state changed for ${targetSocketId}:`, state);
        setRemotePeers((prev) =>
          prev.map((p) => (p.participant.socketId === targetSocketId ? { ...p, connectionState: state } : p))
        );

        if (state === 'connected') {
          setCallStatus('connected');
        } else if (state === 'disconnected' || state === 'failed') {
          // If all peers are disconnected, reflect disconnected status
          const hasAnyConnected = Array.from(peersRef.current.values()).some(
            (c) => c.pc?.connectionState === 'connected'
          );
          if (!hasAnyConnected) {
            setCallStatus('peer-disconnected');
          }
        }
      },
    });

    // Add local media tracks if available
    if (localStreamRef.current) {
      conn.addStream(localStreamRef.current);
    }

    // Process early buffered candidates
    const early = earlyCandidatesRef.current.get(targetSocketId);
    if (early && early.length > 0) {
      console.log(`[useWebRTC] Applying ${early.length} early buffered ICE candidates for: ${targetSocketId}`);
      early.forEach((candidate) => {
        conn?.addIceCandidate(candidate);
      });
      earlyCandidatesRef.current.delete(targetSocketId);
    }

    peersRef.current.set(targetSocketId, conn);
    return conn;
  }, []);

  // Join Room
  const joinCall = useCallback(
    async (
      roomToJoin: string,
      name: string,
      preAcquiredStream?: MediaStream | null,
      userId?: string
    ) => {
      const sanitizedRoom = roomToJoin.trim();
      const sanitizedName = name.trim() || 'Anonymous';

      if (!sanitizedRoom) {
        setErrorMessage('Room ID is required.');
        return;
      }

      setRoomId(sanitizedRoom);
      setDisplayName(sanitizedName);
      setErrorMessage(null);
      setPermissionError(null);
      setCallStatus('joining');

      // 1. Acquire local media (or use pre-acquired stream from lobby preview)
      let stream: MediaStream | null = preAcquiredStream || null;
      let error: MediaPermissionError | null = null;

      if (!stream) {
        const mediaResult = await getLocalUserMedia(true, true);
        stream = mediaResult.stream;
        error = mediaResult.error;
      }

      if (error) {
        setPermissionError(error);
      }

      // If hardware devices failed or in an insecure context, generate a synthetic stream
      if (!stream) {
        console.log('[useWebRTC] Creating synthetic stream for call...');
        stream = createSyntheticStream(sanitizedName);
      }

      let hasAudio = false;
      let hasVideo = false;
      if (stream) {
        setLocalStream(stream);
        localStreamRef.current = stream;
        hasAudio = stream.getAudioTracks().length > 0 && stream.getAudioTracks().some((t) => t.enabled);
        hasVideo = stream.getVideoTracks().length > 0 && stream.getVideoTracks().some((t) => t.enabled);
        setIsMicOn(hasAudio);
        setIsCameraOn(hasVideo);
      }

      // 2. Connect signaling socket
      const socket = getSocket();
      if (!socket.connected) {
        socket.connect();
      }

      socket.emit('join-room', {
        roomId: sanitizedRoom,
        displayName: sanitizedName,
        isAudioMuted: !hasAudio,
        isVideoMuted: !hasVideo,
        userId,
      });
    },
    []
  );

  // Retry media permissions while inside call
  const retryMediaAccess = useCallback(async () => {
    setPermissionError(null);
    const { stream, error } = await getLocalUserMedia(true, true);
    if (error) {
      setPermissionError(error);
    }
    if (stream) {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      setLocalStream(stream);
      localStreamRef.current = stream;
      setIsMicOn(stream.getAudioTracks().some((t) => t.enabled));
      setIsCameraOn(stream.getVideoTracks().some((t) => t.enabled));

      // Attach new real hardware tracks to all active peer connections
      peersRef.current.forEach((conn) => {
        stream.getTracks().forEach((track) => {
          conn.replaceTrack(track.kind as 'audio' | 'video', track);
        });
      });
    }
  }, []);

  // Leave Call
  const leaveCall = useCallback(() => {
    const socket = getSocket();
    if (socket.connected) {
      socket.emit('leave-room');
    }
    cleanupAllPeers();
    cleanupLocalMedia();
    setIsHost(false);
    setCallStatus('call-ended');
  }, [cleanupAllPeers, cleanupLocalMedia]);

  // Reset to idle screen
  const resetToIdle = useCallback(() => {
    const socket = getSocket();
    if (socket.connected) {
      socket.emit('leave-room');
    }
    cleanupAllPeers();
    cleanupLocalMedia();
    setIsHost(false);
    setCallStatus('idle');
    setErrorMessage(null);
    setPermissionError(null);
  }, [cleanupAllPeers, cleanupLocalMedia]);

  // Socket signaling event listeners
  useEffect(() => {
    const socket = getSocket();

    const handleRoomJoined = async (data: {
      roomId: string;
      self: Participant;
      otherParticipants: Participant[];
      isHost?: boolean;
      hostSocketId?: string;
    }) => {
      console.log('[useWebRTC] room-joined received. Existing peers count:', data.otherParticipants?.length || 0, 'isHost:', data.isHost);
      setIsHost(Boolean(data.isHost));

      if (data.otherParticipants && data.otherParticipants.length > 0) {
        // Initialize remote peer records with reported media states
        setRemotePeers(
          data.otherParticipants.map((p) => ({
            participant: p,
            stream: null,
            connectionState: 'connecting',
            isAudioMuted: Boolean(p.isAudioMuted),
            isVideoMuted: Boolean(p.isVideoMuted),
          }))
        );
        setCallStatus('connecting');

        // New joiner initiates offers to all existing peers
        for (const peer of data.otherParticipants) {
          const conn = setupWebRTC(peer.socketId, peer);
          try {
            const offer = await conn.createOffer();
            socket.emit('offer', {
              to: peer.socketId,
              sdp: offer,
            });
          } catch (err: any) {
            console.error(`[useWebRTC] Error creating offer for peer ${peer.socketId}:`, err);
          }
        }
      } else {
        // First participant in room -> waiting for others
        setCallStatus('waiting');
      }
    };

    const handleUserJoined = (data: { participant: Participant }) => {
      console.log('[useWebRTC] user-joined event from new peer:', data.participant.displayName);
      setRemotePeers((prev) => {
        if (prev.some((p) => p.participant.socketId === data.participant.socketId)) return prev;
        return [
          ...prev,
          {
            participant: data.participant,
            stream: null,
            connectionState: 'connecting',
            isAudioMuted: Boolean(data.participant.isAudioMuted),
            isVideoMuted: Boolean(data.participant.isVideoMuted),
          },
        ];
      });
      // Prepare connection for incoming offer and early candidates
      setupWebRTC(data.participant.socketId, data.participant);
    };

    const handleOffer = async (data: SignalingOffer) => {
      console.log('[useWebRTC] offer received from:', data.from, data.senderName);
      const participantInfo: Participant = {
        socketId: data.from,
        displayName: data.senderName || 'Peer',
        joinedAt: Date.now(),
        isAudioMuted: false,
        isVideoMuted: false,
      };

      setRemotePeers((prev) => {
        const existing = prev.find((p) => p.participant.socketId === data.from);
        if (existing) return prev;
        return [
          ...prev,
          {
            participant: participantInfo,
            stream: null,
            connectionState: 'connecting',
            isAudioMuted: false,
            isVideoMuted: false,
          },
        ];
      });

      const conn = setupWebRTC(data.from, participantInfo);
      try {
        const answer = await conn.createAnswer(data.sdp);
        socket.emit('answer', {
          to: data.from,
          sdp: answer,
        });
      } catch (err: any) {
        console.error('[useWebRTC] Error answering offer:', err);
      }
    };

    const handleAnswer = async (data: SignalingAnswer) => {
      console.log('[useWebRTC] answer received from:', data.from);
      const conn = peersRef.current.get(data.from);
      if (conn) {
        try {
          await conn.handleAnswer(data.sdp);
        } catch (err: any) {
          console.error('[useWebRTC] Error handling answer:', err);
        }
      }
    };

    const handleIceCandidate = async (data: SignalingIceCandidate) => {
      const conn = peersRef.current.get(data.from);
      if (conn && conn.pc && conn.pc.remoteDescription && data.candidate) {
        await conn.addIceCandidate(data.candidate);
      } else if (data.candidate && data.from) {
        // Connection not ready yet -> buffer early candidate
        console.log(`[useWebRTC] Buffering early ICE candidate from: ${data.from}`);
        const existing = earlyCandidatesRef.current.get(data.from) || [];
        existing.push(data.candidate);
        earlyCandidatesRef.current.set(data.from, existing);
      }
    };

    const handleUserLeft = (data: SignalingUserLeft) => {
      console.log('[useWebRTC] user-left event:', data);
      const conn = peersRef.current.get(data.socketId);
      if (conn) {
        conn.close();
        peersRef.current.delete(data.socketId);
      }

      setRemotePeers((prev) => {
        const remaining = prev.filter((p) => p.participant.socketId !== data.socketId);
        if (remaining.length === 0) {
          setCallStatus('peer-disconnected');
        }
        return remaining;
      });
    };

    const handleRoomFull = (data: { message: string }) => {
      console.warn('[useWebRTC] Room is full:', data.message);
      cleanupAllPeers();
      cleanupLocalMedia();
      setCallStatus('room-full');
      setErrorMessage(data.message || 'This room is currently full. Maximum 10 participants allowed.');
    };

    const handleErrorMessage = (data: { message: string }) => {
      console.error('[useWebRTC] Server error message:', data.message);
      setErrorMessage(data.message || 'An unexpected error occurred.');
      setCallStatus('error');
    };

    const handlePeerMediaToggled = (data: {
      socketId: string;
      type: 'audio' | 'video';
      isMuted: boolean;
    }) => {
      console.log(
        `[useWebRTC] peer-media-toggled: peer=${data.socketId}, type=${data.type}, isMuted=${data.isMuted}`
      );
      setRemotePeers((prev) =>
        prev.map((p) => {
          if (p.participant.socketId === data.socketId) {
            return {
              ...p,
              isAudioMuted: data.type === 'audio' ? data.isMuted : p.isAudioMuted,
              isVideoMuted: data.type === 'video' ? data.isMuted : p.isVideoMuted,
              participant: {
                ...p.participant,
                isAudioMuted: data.type === 'audio' ? data.isMuted : p.participant.isAudioMuted,
                isVideoMuted: data.type === 'video' ? data.isMuted : p.participant.isVideoMuted,
              },
            };
          }
          return p;
        })
      );
    };

    socket.on('room-joined', handleRoomJoined);
    socket.on('user-joined', handleUserJoined);
    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('user-left', handleUserLeft);
    socket.on('room-full', handleRoomFull);
    socket.on('error-message', handleErrorMessage);
    socket.on('peer-media-toggled', handlePeerMediaToggled);

    // In-call chat & reactions listeners
    const handleChatMessage = (msg: ChatMessage) => {
      setMessages((prev) => [...prev, { ...msg, isSelf: msg.senderId === socket.id }]);
    };
    const handleCallReaction = (reaction: any) => {
      setReactions((prev) => [...prev.slice(-20), reaction]);
    };

    const handleHostChanged = (data: { hostSocketId: string; hostName: string }) => {
      console.log('[useWebRTC] host-changed received:', data);
      const isNowHost = data.hostSocketId === socket.id;
      setIsHost(isNowHost);
    };

    socket.on('chat-message', handleChatMessage);
    socket.on('call-reaction', handleCallReaction);
    socket.on('host-changed', handleHostChanged);

    return () => {
      socket.off('room-joined', handleRoomJoined);
      socket.off('user-joined', handleUserJoined);
      socket.off('offer', handleOffer);
      socket.off('answer', handleAnswer);
      socket.off('ice-candidate', handleIceCandidate);
      socket.off('peer-media-toggled', handlePeerMediaToggled);
      socket.off('user-left', handleUserLeft);
      socket.off('room-full', handleRoomFull);
      socket.off('error-message', handleErrorMessage);
      socket.off('chat-message', handleChatMessage);
      socket.off('call-reaction', handleCallReaction);
      socket.off('host-changed', handleHostChanged);
    };
  }, [cleanupAllPeers, cleanupLocalMedia, setupWebRTC]);

  // Expose inspection object on window for automated browser testing
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__webrtc_debug = {
        getCallStatus: () => callStatus,
        getRoomId: () => roomId,
        getDisplayName: () => displayName,
        getLocalStream: () => localStreamRef.current,
        getRemoteStream: () => remoteStream,
        getRemotePeers: () => remotePeers,
        getPeerConnections: () => Array.from(peersRef.current.entries()),
        getConnectionState: () => {
          if (peersRef.current.size === 0) return 'none';
          const anyConnected = Array.from(peersRef.current.values()).some(
            (c) => c.pc?.connectionState === 'connected'
          );
          if (anyConnected) return 'connected';
          const anyConnecting = Array.from(peersRef.current.values()).some(
            (c) => c.pc?.connectionState === 'connecting'
          );
          if (anyConnecting) return 'connecting';
          return 'disconnected';
        },
        getRemoteParticipant: () => remoteParticipant,
      };
    }
  }, [callStatus, roomId, displayName, remoteStream, remoteParticipant, remotePeers]);

  return {
    callStatus,
    roomId,
    displayName,
    isHost,
    localStream,
    remoteStream,
    remoteParticipant,
    remotePeers,
    isMicOn,
    isCameraOn,
    permissionError,
    errorMessage,
    joinCall,
    leaveCall,
    resetToIdle,
    toggleMic,
    toggleCamera,
    retryMediaAccess,
    messages,
    sendChatMessage,
    reactions,
    sendReaction,
    isScreenSharing,
    toggleScreenShare,
  };
}

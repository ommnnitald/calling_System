import { MediaPermissionError } from '../types';

function buildIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
      ],
    },
  ];

  if (typeof window !== 'undefined') {
    try {
      const customJson = import.meta.env.VITE_ICE_SERVERS_JSON;
      if (customJson) {
        const parsed = JSON.parse(customJson);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (_) {}

    const turnUrl = import.meta.env.VITE_TURN_SERVER_URL;
    if (turnUrl) {
      servers.push({
        urls: turnUrl,
        username: import.meta.env.VITE_TURN_USERNAME || undefined,
        credential: import.meta.env.VITE_TURN_CREDENTIAL || undefined,
      });
    }
  }

  return servers;
}

export const RTC_CONFIG: RTCConfiguration = {
  iceServers: buildIceServers(),
  iceCandidatePoolSize: 10,
};

/**
 * Checks if the current browser environment provides a secure context for MediaDevices.
 */
export function isSecureContextSupported(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.isSecureContext) return true;
  // Localhost is always a secure context
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

/**
 * Creates a synthetic/virtual MediaStream containing an animated canvas video track
 * and a silent audio track. This ensures that WebRTC connection, track sending,
 * and mute/unmute UI controls work reliably even on devices without physical hardware
 * or in non-secure LAN test environments.
 */
export function createSyntheticStream(displayName: string): MediaStream {
  const stream = new MediaStream();

  // 1. Synthetic silent audio track via Web Audio API
  if (typeof window !== 'undefined') {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const dst = ctx.createMediaStreamDestination();
        const gain = ctx.createGain();
        gain.gain.value = 0; // Silent
        osc.connect(gain);
        gain.connect(dst);
        osc.start();
        const audioTrack = dst.stream.getAudioTracks()[0];
        if (audioTrack) {
          (audioTrack as any)._isSynthetic = true;
          stream.addTrack(audioTrack);
        }
      }
    } catch (e) {
      console.warn('[WebRTC] Synthetic audio track generation failed:', e);
    }
  }

  // 2. Synthetic video track via Canvas captureStream
  if (typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      let animTimer: any = null;

      if (ctx) {
        let frame = 0;
        const render = () => {
          frame++;
          // Draw dark gradient background
          const grad = ctx.createLinearGradient(0, 0, 640, 480);
          grad.addColorStop(0, '#0f172a');
          grad.addColorStop(1, '#020617');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, 640, 480);

          // Subtle pulsing halo to ensure continuous video frame updates
          const pulse = Math.sin(frame * 0.1) * 6;
          ctx.strokeStyle = 'rgba(13, 148, 136, 0.4)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(320, 240, 75 + pulse, 0, Math.PI * 2);
          ctx.stroke();

          // Draw avatar circle
          ctx.fillStyle = '#0d9488';
          ctx.beginPath();
          ctx.arc(320, 240, 75, 0, Math.PI * 2);
          ctx.fill();

          // Draw initials
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 44px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const initials = (displayName || 'U').trim().substring(0, 2).toUpperCase();
          ctx.fillText(initials, 320, 240);
        };

        render();
        animTimer = setInterval(render, 66); // ~15 FPS continuous frame output
      }

      const captureFn = canvas.captureStream || (canvas as any).mozCaptureStream;
      if (captureFn) {
        const canvasStream = captureFn.call(canvas, 15);
        const videoTrack = canvasStream.getVideoTracks()[0];
        if (videoTrack) {
          (videoTrack as any)._isSynthetic = true;
          videoTrack.addEventListener('ended', () => {
            if (animTimer) clearInterval(animTimer);
          });
          stream.addTrack(videoTrack);
        }
      }
    } catch (e) {
      console.warn('[WebRTC] Synthetic video track generation failed:', e);
    }
  }

  return stream;
}

/**
 * Dynamically requests a single device (camera or microphone) on demand.
 */
export async function requestSingleDevice(kind: 'video' | 'audio'): Promise<MediaStreamTrack | null> {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return null;
  }

  try {
    const constraints: MediaStreamConstraints = {
      video: kind === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false,
      audio: kind === 'audio' ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true } : false,
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    const track = kind === 'video' ? stream.getVideoTracks()[0] : stream.getAudioTracks()[0];
    return track || null;
  } catch (err: any) {
    console.warn(`[WebRTC] On-demand ${kind} request failed:`, err.name || err);
    return null;
  }
}

/**
 * Request user media with a progressive 4-stage fallback cascade:
 * 1. Ideal HD constraints (1280x720 + processed audio)
 * 2. Basic standard constraints ({ video: true, audio: true })
 * 3. Audio-only fallback if camera is unavailable
 * 4. Video-only fallback if microphone is unavailable
 */
export async function getLocalUserMedia(
  videoEnabled = true,
  audioEnabled = true
): Promise<{ stream: MediaStream | null; error: MediaPermissionError | null }> {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    const isSecure = isSecureContextSupported();
    return {
      stream: null,
      error: {
        type: 'not-supported',
        device: 'both',
        message: isSecure
          ? 'Your browser does not support navigator.mediaDevices.getUserMedia.'
          : 'Media access requires a Secure Context (HTTPS or localhost). On LAN HTTP, enable chrome://flags/#unsafely-treat-insecure-origin-as-secure.',
      },
    };
  }

  // Attempt 1: Ideal constraints
  try {
    const idealConstraints: MediaStreamConstraints = {
      video: videoEnabled
        ? {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user',
          }
        : false,
      audio: audioEnabled
        ? {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          }
        : false,
    };

    const stream = await navigator.mediaDevices.getUserMedia(idealConstraints);
    return { stream, error: null };
  } catch (err1: any) {
    console.warn('[WebRTC getUserMedia] Ideal constraints failed, trying basic constraints...', err1.name);

    // Attempt 2: Basic unconstrained media
    try {
      const basicConstraints: MediaStreamConstraints = {
        video: videoEnabled ? true : false,
        audio: audioEnabled ? true : false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(basicConstraints);
      return { stream, error: null };
    } catch (err2: any) {
      console.warn('[WebRTC getUserMedia] Basic constraints failed:', err2.name);

      // Attempt 3: If video was requested, try audio-only fallback
      if (videoEnabled && audioEnabled) {
        try {
          console.log('[WebRTC getUserMedia] Attempting audio-only fallback...');
          const audioOnlyStream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: true,
          });
          return {
            stream: audioOnlyStream,
            error: {
              type: 'device-unavailable',
              device: 'camera',
              message: 'Camera could not be accessed. Started with microphone only.',
            },
          };
        } catch (audioErr: any) {
          console.warn('[WebRTC getUserMedia] Audio-only fallback failed:', audioErr.name);
        }
      }

      // Attempt 4: If microphone failed, try video-only fallback
      if (videoEnabled) {
        try {
          console.log('[WebRTC getUserMedia] Attempting video-only fallback...');
          const videoOnlyStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
          return {
            stream: videoOnlyStream,
            error: {
              type: 'device-unavailable',
              device: 'microphone',
              message: 'Microphone could not be accessed. Started with camera only.',
            },
          };
        } catch (videoErr: any) {
          console.warn('[WebRTC getUserMedia] Video-only fallback failed:', videoErr.name);
        }
      }

      // Map error to human-readable format
      let errorType: MediaPermissionError['type'] = 'unknown';
      let device: MediaPermissionError['device'] = 'both';
      let message = err2.message || err1.message || 'Failed to acquire media devices.';

      const failureName = err2.name || err1.name;

      if (failureName === 'NotAllowedError' || failureName === 'PermissionDeniedError') {
        errorType = 'permission-denied';
        message = 'Permission denied. Please allow microphone and camera access in your browser.';
      } else if (failureName === 'NotFoundError' || failureName === 'DevicesNotFoundError') {
        errorType = 'device-unavailable';
        message = 'No camera or microphone found on this device.';
      } else if (failureName === 'NotReadableError' || failureName === 'TrackStartError') {
        errorType = 'device-unavailable';
        message = 'Camera or microphone is already in use by another application or not readable.';
      } else if (failureName === 'OverconstrainedError') {
        errorType = 'device-unavailable';
        message = 'The requested device resolution or constraints are not supported.';
      }

      return {
        stream: null,
        error: {
          type: errorType,
          device,
          message,
        },
      };
    }
  }
}

/**
 * Creates and manages an RTCPeerConnection instance with robust candidate buffering,
 * detailed state transition logging, and multi-track remote stream management.
 */
export class WebRTCConnection {
  public pc: RTCPeerConnection | null = null;
  private queuedCandidates: RTCIceCandidateInit[] = [];
  private onTrackCallback?: (stream: MediaStream) => void;
  private onIceCandidateCallback?: (candidate: RTCIceCandidate) => void;
  private onConnectionStateChangeCallback?: (state: RTCPeerConnectionState) => void;
  private remoteStream: MediaStream = new MediaStream();

  constructor(callbacks: {
    onTrack?: (stream: MediaStream) => void;
    onIceCandidate?: (candidate: RTCIceCandidate) => void;
    onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  }) {
    this.onTrackCallback = callbacks.onTrack;
    this.onIceCandidateCallback = callbacks.onIceCandidate;
    this.onConnectionStateChangeCallback = callbacks.onConnectionStateChange;
    this.init();
  }

  private init() {
    console.log('[WebRTC] Creating peer connection');
    this.pc = new RTCPeerConnection(RTC_CONFIG);

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[WebRTC] ICE candidate generated:', event.candidate.candidate.substring(0, 50) + '...');
        if (this.onIceCandidateCallback) {
          this.onIceCandidateCallback(event.candidate);
        }
      } else {
        console.log('[WebRTC] All local ICE candidates gathered (end of candidates)');
      }
    };

    this.pc.ontrack = (event) => {
      console.log(`[WebRTC] Remote track received: kind=${event.track.kind}, id=${event.track.id}`);
      // Add track to the cumulative remote stream
      this.remoteStream.addTrack(event.track);

      event.track.onmute = () => {
        console.log(`[WebRTC] Remote track muted: kind=${event.track.kind}`);
      };
      event.track.onunmute = () => {
        console.log(`[WebRTC] Remote track unmuted: kind=${event.track.kind}`);
      };
      event.track.onended = () => {
        console.log(`[WebRTC] Remote track ended: kind=${event.track.kind}`);
      };

      if (this.onTrackCallback) {
        // Dispatch a fresh MediaStream containing all current tracks so React state updates reliably
        this.onTrackCallback(new MediaStream(this.remoteStream.getTracks()));
      }
    };

    this.pc.onconnectionstatechange = () => {
      if (this.pc) {
        const state = this.pc.connectionState;
        console.log(`[WebRTC] Connection state: ${state}`);
        if (this.onConnectionStateChangeCallback) {
          this.onConnectionStateChangeCallback(state);
        }
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      if (this.pc) {
        console.log(`[WebRTC] ICE connection state: ${this.pc.iceConnectionState}`);
      }
    };

    this.pc.onicegatheringstatechange = () => {
      if (this.pc) {
        console.log(`[WebRTC] ICE gathering state: ${this.pc.iceGatheringState}`);
      }
    };

    this.pc.onsignalingstatechange = () => {
      if (this.pc) {
        console.log(`[WebRTC] Signaling state: ${this.pc.signalingState}`);
      }
    };
  }

  public addStream(stream: MediaStream) {
    if (!this.pc) return;
    console.log(`[WebRTC] Adding local media tracks (count=${stream.getTracks().length})`);
    stream.getTracks().forEach((track) => {
      if (this.pc) {
        // Check if track is already added to prevent InvalidAccessError
        const senders = this.pc.getSenders();
        const alreadyAdded = senders.some((s) => s.track === track);
        if (!alreadyAdded) {
          this.pc.addTrack(track, stream);
        }
      }
    });
  }

  public async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.pc) throw new Error('RTCPeerConnection is null');
    console.log('[WebRTC] Creating offer');
    const offer = await this.pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await this.pc.setLocalDescription(offer);
    console.log('[WebRTC] Local description set (offer)');
    return offer;
  }

  public async createAnswer(offerSdp: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    if (!this.pc) throw new Error('RTCPeerConnection is null');
    console.log('[WebRTC] Received offer');
    await this.pc.setRemoteDescription(new RTCSessionDescription(offerSdp));
    console.log('[WebRTC] Remote description set (offer)');

    // Process queued candidates
    await this.flushQueuedCandidates();

    console.log('[WebRTC] Creating answer');
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    console.log('[WebRTC] Local description set (answer)');
    return answer;
  }

  public async handleAnswer(answerSdp: RTCSessionDescriptionInit): Promise<void> {
    if (!this.pc) throw new Error('RTCPeerConnection is null');
    console.log('[WebRTC] Received answer');
    await this.pc.setRemoteDescription(new RTCSessionDescription(answerSdp));
    console.log('[WebRTC] Remote description set (answer)');
    await this.flushQueuedCandidates();
  }

  public async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.pc || !this.pc.remoteDescription) {
      // Buffer until remote description is set
      console.log('[WebRTC] ICE candidate buffered (remote description not ready yet)');
      this.queuedCandidates.push(candidate);
      return;
    }
    try {
      console.log('[WebRTC] ICE candidate received & applying');
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn('[WebRTC addIceCandidate failed]:', err);
    }
  }

  public async flushQueuedCandidates(): Promise<void> {
    if (!this.pc || !this.pc.remoteDescription) return;
    if (this.queuedCandidates.length > 0) {
      console.log(`[WebRTC] Flushing ${this.queuedCandidates.length} queued ICE candidates`);
      while (this.queuedCandidates.length > 0) {
        const candidate = this.queuedCandidates.shift();
        if (candidate) {
          try {
            await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.warn('[WebRTC flushQueuedCandidates failed]:', err);
          }
        }
      }
    }
  }

  public async replaceTrack(kind: 'audio' | 'video', newTrack: MediaStreamTrack | null): Promise<void> {
    if (!this.pc) return;
    const senders = this.pc.getSenders();
    const sender = senders.find((s) => s.track && s.track.kind === kind);
    if (sender) {
      await sender.replaceTrack(newTrack);
    } else if (newTrack) {
      this.pc.addTrack(newTrack);
    }
  }

  public getConnectionState(): RTCPeerConnectionState | 'closed' {
    return this.pc ? this.pc.connectionState : 'closed';
  }

  public getRemoteStream(): MediaStream {
    return this.remoteStream;
  }

  public close(): void {
    if (this.pc) {
      console.log('[WebRTC] Closing peer connection');
      this.pc.onicecandidate = null;
      this.pc.ontrack = null;
      this.pc.onconnectionstatechange = null;
      this.pc.oniceconnectionstatechange = null;
      this.pc.onicegatheringstatechange = null;
      this.pc.onsignalingstatechange = null;
      this.pc.close();
      this.pc = null;
    }
    this.remoteStream.getTracks().forEach((track) => track.stop());
    this.remoteStream = new MediaStream();
    this.queuedCandidates = [];
  }
}

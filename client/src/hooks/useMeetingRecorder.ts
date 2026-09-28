import { useState, useRef, useCallback, useEffect } from 'react';
import { getSocket } from '../services/socket';
import { api } from '../services/api';

export interface UseMeetingRecorderProps {
  roomId: string;
  hostName: string;
  isHost: boolean;
  userId?: string;
  localStream: MediaStream | null;
  remoteStream?: MediaStream | null;
}

export function useMeetingRecorder({
  roomId,
  hostName,
  isHost,
  userId,
  localStream,
  remoteStream,
}: UseMeetingRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingDurationRef = useRef(0);
  const [activeHostName, setActiveHostName] = useState<string | null>(null);
  const [showTeamsBanner, setShowTeamsBanner] = useState(false);
  const [bannerMessage, setBannerMessage] = useState('');
  const [recordingError, setRecordingError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const durationTimerRef = useRef<any>(null);
  const captureStreamRef = useRef<MediaStream | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);

  // Synchronize recording status across participants via Socket.IO
  useEffect(() => {
    const socket = getSocket();

    const handleRecordingStarted = (data: { hostName: string; startedAt: number }) => {
      setActiveHostName(data.hostName);
      setIsRecording(true);
      setShowTeamsBanner(true);
      setBannerMessage(
        `Recording has started. ${data.hostName} is recording this meeting. Let everyone know that they're being recorded.`
      );
    };

    const handleRecordingStopped = (data: { hostName: string }) => {
      setIsRecording(false);
      setBannerMessage(`Recording was stopped by ${data.hostName || 'host'}.`);
      setTimeout(() => setShowTeamsBanner(false), 5000);
    };

    const handleRecordingError = (data: { message: string }) => {
      setRecordingError(data.message || 'Recording action failed.');
      setTimeout(() => setRecordingError(null), 5000);
    };

    socket.on('recording-started', handleRecordingStarted);
    socket.on('recording-stopped', handleRecordingStopped);
    socket.on('recording-error', handleRecordingError);

    return () => {
      socket.off('recording-started', handleRecordingStarted);
      socket.off('recording-stopped', handleRecordingStopped);
      socket.off('recording-error', handleRecordingError);
    };
  }, []);

  // Duration timer while recording
  useEffect(() => {
    if (isRecording) {
      setRecordingDuration(0);
      recordingDurationRef.current = 0;
      durationTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          const next = prev + 1;
          recordingDurationRef.current = next;
          return next;
        });
      }, 1000);
    } else {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
      }
      setRecordingDuration(0);
    }

    return () => {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    };
  }, [isRecording]);

  const startRecording = useCallback(async () => {
    if (!isHost) {
      console.warn('[Recorder] Only the meeting host can record this meeting.');
      setRecordingError('Only the meeting host can start recording.');
      return;
    }

    setRecordingError(null);
    recordedChunksRef.current = [];

    try {
      let captureStream: MediaStream | null = null;

      // Method 1: High definition window / meeting tab recording via getDisplayMedia
      if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
        try {
          captureStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              displaySurface: 'browser',
              width: { ideal: 1920 },
              height: { ideal: 1080 },
              frameRate: { ideal: 30 },
            } as any,
            audio: true,
          });
        } catch (err: any) {
          console.log('[Recorder] Screen share prompt skipped/denied, falling back to camera stream:', err.name);
          // If display media was canceled or denied, fall through to camera/synthetic stream
        }
      }

      // Method 2: Fallback to local user media stream if display capture unavailable or canceled
      if (!captureStream && localStream) {
        captureStream = localStream.clone();
      }

      if (!captureStream) {
        throw new Error('No video stream available to record. Please ensure your camera or screen share is active.');
      }

      captureStreamRef.current = captureStream;

      // Setup audio mixing: combine local mic + remote participants' voices + screen audio
      let mixedAudioTrack: MediaStreamTrack | null = null;
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioCtxRef.current = audioCtx;
          const destination = audioCtx.createMediaStreamDestination();
          let sourcesConnected = 0;

          // Connect local mic audio if present
          if (localStream && localStream.getAudioTracks().length > 0) {
            const track = localStream.getAudioTracks()[0];
            if (track.readyState === 'live') {
              const srcStream = new MediaStream([track]);
              const src = audioCtx.createMediaStreamSource(srcStream);
              src.connect(destination);
              sourcesConnected++;
            }
          }

          // Connect remote participants' audio if present
          if (remoteStream && remoteStream.getAudioTracks().length > 0) {
            const track = remoteStream.getAudioTracks()[0];
            if (track.readyState === 'live') {
              const srcStream = new MediaStream([track]);
              const src = audioCtx.createMediaStreamSource(srcStream);
              src.connect(destination);
              sourcesConnected++;
            }
          }

          // Connect display capture audio if present
          if (captureStream && captureStream.getAudioTracks().length > 0) {
            const track = captureStream.getAudioTracks()[0];
            if (track.readyState === 'live') {
              const srcStream = new MediaStream([track]);
              const src = audioCtx.createMediaStreamSource(srcStream);
              src.connect(destination);
              sourcesConnected++;
            }
          }

          if (sourcesConnected > 0 && destination.stream.getAudioTracks().length > 0) {
            mixedAudioTrack = destination.stream.getAudioTracks()[0];
          }
        }
      } catch (err) {
        console.warn('[Recorder] Audio mixer initialization note:', err);
      }

      // Build composite recording stream: primary video track + mixed audio track
      const videoTrack = captureStream.getVideoTracks()[0];
      if (!videoTrack) {
        throw new Error('Selected stream does not contain a video track.');
      }

      const tracksToRecord: MediaStreamTrack[] = [videoTrack];
      if (mixedAudioTrack) {
        tracksToRecord.push(mixedAudioTrack);
      } else if (captureStream.getAudioTracks().length > 0) {
        tracksToRecord.push(captureStream.getAudioTracks()[0]);
      } else if (localStream && localStream.getAudioTracks().length > 0) {
        tracksToRecord.push(localStream.getAudioTracks()[0]);
      }

      const streamToRecord = new MediaStream(tracksToRecord);

      // When the user stops screen share from native browser floating bar, stop recording cleanly
      videoTrack.onended = () => {
        stopRecording();
      };

      // Determine optimal supported MIME type
      const mimeTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4',
      ];
      let selectedMimeType = '';
      for (const mime of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mime)) {
          selectedMimeType = mime;
          break;
        }
      }

      const recorder = new MediaRecorder(
        streamToRecord,
        selectedMimeType ? { mimeType: selectedMimeType } : undefined
      );

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = (e: any) => {
        console.error('[Recorder MediaRecorder Error]:', e);
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, {
          type: selectedMimeType || 'video/webm',
        });

        // Safely cleanup streams and audio mixer now that blob is created
        if (captureStreamRef.current) {
          captureStreamRef.current.getTracks().forEach((track) => {
            try { track.stop(); } catch (_) {}
          });
          captureStreamRef.current = null;
        }
        if (audioCtxRef.current) {
          try { audioCtxRef.current.close(); } catch (_) {}
          audioCtxRef.current = null;
        }

        if (blob.size < 1024) {
          console.warn('[Recorder] Recording produced an empty file (< 1 KB). Skipping save.');
          setRecordingError('Recording ended without video data (0 KB). Please ensure camera or screen was visible.');
          setTimeout(() => setRecordingError(null), 6000);
          return;
        }

        // 1. Trigger local file download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const ext = selectedMimeType.includes('mp4') ? 'mp4' : 'webm';
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        a.href = url;
        a.download = `StreamCall-${roomId}-${timestamp}.${ext}`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 1000);

        // 2. Automatically upload to server repository so host can access/play from Dashboard
        setShowTeamsBanner(true);
        setBannerMessage('Saving recording to your meeting dashboard...');
        const currentDuration = recordingDurationRef.current || 1;

        api.uploadRecording(blob, {
          roomId,
          durationSeconds: currentDuration,
          hostName,
          userId,
        }).then((res) => {
          if (res.success) {
            setBannerMessage('Meeting recording successfully saved to your dashboard!');
          } else {
            setBannerMessage('Recording downloaded to your device. (Server upload: ' + (res.message || 'offline') + ')');
          }
          setTimeout(() => setShowTeamsBanner(false), 6000);
        }).catch((err) => {
          console.warn('[Recorder] Upload failed:', err);
          setBannerMessage('Recording downloaded to your device.');
          setTimeout(() => setShowTeamsBanner(false), 5000);
        });
      };

      recorder.start(1000); // 1-second chunks for responsiveness
      mediaRecorderRef.current = recorder;

      // Broadcast recording start to room via socket
      const socket = getSocket();
      socket.emit('start-recording', { hostName });

      setIsRecording(true);
      setActiveHostName(hostName);
      setShowTeamsBanner(true);
      setBannerMessage(
        `Recording has started. You are recording this meeting. Let everyone know that they're being recorded.`
      );
    } catch (err: any) {
      console.error('[Recorder Error]:', err);
      setRecordingError(err.message || 'Failed to start meeting recording.');
    }
  }, [roomId, hostName, isHost, localStream, remoteStream]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        if (mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.requestData();
        }
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.warn('[Recorder Stop Warning]:', err);
      }
    }

    // Do NOT stop captureStream tracks here synchronously.
    // They will be stopped cleanly in recorder.onstop after the encoder finishes flushing.

    const socket = getSocket();
    socket.emit('stop-recording', { hostName });

    setIsRecording(false);
    setBannerMessage(`Recording has stopped. Processing video file...`);
    setTimeout(() => setShowTeamsBanner(false), 5000);
  }, [hostName]);

  const toggleRecording = useCallback(() => {
    if (!isHost) {
      console.warn('[Recorder] Only the meeting host can record.');
      return;
    }
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isHost, isRecording, startRecording, stopRecording]);

  return {
    isRecording,
    recordingDuration,
    activeHostName,
    showTeamsBanner,
    bannerMessage,
    recordingError,
    startRecording,
    stopRecording,
    toggleRecording,
    dismissTeamsBanner: () => setShowTeamsBanner(false),
  };
}

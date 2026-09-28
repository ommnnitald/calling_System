import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff } from 'lucide-react';

interface VideoPlayerProps {
  stream: MediaStream | null;
  displayName: string;
  isMuted?: boolean;
  isCameraOn?: boolean;
  isLocal?: boolean;
  className?: string;
}

// Deterministic gradient palettes for avatar initials
const AVATAR_GRADIENTS = [
  'from-emerald-500 via-teal-500 to-sky-500 text-emerald-400',
  'from-indigo-500 via-purple-500 to-pink-500 text-indigo-300',
  'from-amber-500 via-orange-500 to-rose-500 text-amber-300',
  'from-cyan-500 via-blue-500 to-indigo-500 text-cyan-300',
  'from-fuchsia-500 via-rose-500 to-amber-500 text-fuchsia-300',
];

function getGradientForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
  }
  const index = Math.abs(hash) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[index];
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  stream,
  displayName,
  isMuted = false,
  isCameraOn = true,
  isLocal = false,
  className = '',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoActive, setVideoActive] = useState<boolean>(false);

  useEffect(() => {
    if (videoRef.current) {
      if (stream) {
        if (videoRef.current.srcObject !== stream) {
          videoRef.current.srcObject = stream;
        }
        videoRef.current.play().catch((err) => {
          console.debug('[VideoPlayer] Autoplay handled:', err.message);
        });
      } else {
        videoRef.current.srcObject = null;
      }
    }

    const checkVideoState = () => {
      if (!stream) {
        setVideoActive(false);
        return;
      }
      const videoTracks = stream.getVideoTracks();
      const active =
        isCameraOn &&
        videoTracks.length > 0 &&
        videoTracks.some((t) => t.enabled && t.readyState === 'live');
      setVideoActive(Boolean(active));
    };

    checkVideoState();

    if (stream) {
      const tracks = stream.getVideoTracks();
      tracks.forEach((track) => {
        track.addEventListener('mute', checkVideoState);
        track.addEventListener('unmute', checkVideoState);
        track.addEventListener('ended', checkVideoState);
      });
      stream.addEventListener('addtrack', checkVideoState);
      stream.addEventListener('removetrack', checkVideoState);

      return () => {
        tracks.forEach((track) => {
          track.removeEventListener('mute', checkVideoState);
          track.removeEventListener('unmute', checkVideoState);
          track.removeEventListener('ended', checkVideoState);
        });
        stream.removeEventListener('addtrack', checkVideoState);
        stream.removeEventListener('removetrack', checkVideoState);
      };
    }
  }, [stream, isCameraOn]);

  // Clean name without duplicate "(You)"
  const cleanName = (displayName || (isLocal ? 'You' : 'Participant'))
    .replace(/\s*\(You\)\s*/gi, '')
    .trim() || (isLocal ? 'You' : 'Participant');

  // Generate 2-letter initials for avatar
  const getInitials = (name: string): string => {
    const trimmed = name.trim();
    if (!trimmed) return isLocal ? 'YOU' : 'P';
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return trimmed.substring(0, 2).toUpperCase();
  };

  const gradientClass = getGradientForName(cleanName);

  return (
    <div
      data-testid={isLocal ? 'local-video-container' : 'remote-video-container'}
      className={`relative w-full h-full rounded-2xl sm:rounded-3xl overflow-hidden bg-slate-950 border border-slate-800/80 shadow-2xl flex items-center justify-center group select-none transition-all duration-300 ${className}`}
    >
      {/* HTML5 Video Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal} // Always mute local to prevent audio feedback loop
        aria-label={`${cleanName || (isLocal ? 'Your' : 'Remote')} video feed`}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          isLocal ? 'scale-x-[-1]' : '' // Mirror local preview
        } ${videoActive ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* Fallback Avatar Placeholder when camera is off or inactive */}
      {!videoActive && (
        <div
          data-testid={isLocal ? 'local-fallback-avatar' : 'remote-fallback-avatar'}
          className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 via-slate-850 to-slate-950 p-6 text-center"
        >
          <div className="relative mb-3">
            <div className={`w-20 h-20 sm:w-28 sm:h-28 rounded-full bg-gradient-to-tr ${gradientClass} p-[3px] shadow-xl shadow-emerald-500/10 flex items-center justify-center`}>
              <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-xl sm:text-2xl font-black text-emerald-400 tracking-wider font-mono">
                {getInitials(cleanName)}
              </div>
            </div>
            {/* Status badge in avatar */}
            <div
              title={isMuted ? 'Microphone is muted' : 'Microphone is active'}
              className={`absolute -bottom-1 -right-1 p-1.5 sm:p-2 rounded-full shadow-lg border-2 border-slate-900 transition-colors ${
                isMuted ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
              }`}
            >
              {isMuted ? (
                <MicOff className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <Mic className="w-3.5 h-3.5" aria-hidden="true" />
              )}
            </div>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-slate-200 tracking-tight flex items-center gap-1.5 justify-center">
            <span>{cleanName}</span>
            {isLocal && (
              <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                You
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1 justify-center">
            <VideoOff className="w-3 h-3 text-rose-400 inline" />
            <span>Camera is off</span>
          </p>
        </div>
      )}

      {/* Top-Right Media Status Badges (Mic on/off & Camera on/off icons) */}
      {/* Top-Right Media Status Badges (Mic on/off & Camera on/off icons) */}
      <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10">
        {/* Mic on/off icon */}
        <div
          data-testid="status-mic-badge"
          data-muted={isMuted ? 'true' : 'false'}
          title={isMuted ? 'Mic is off (muted)' : 'Mic is on'}
          aria-label={isMuted ? 'Mic is off' : 'Mic is on'}
          className={`flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl backdrop-blur-md border transition-all ${
            isMuted
              ? 'bg-rose-600/95 text-white border-rose-500/70 shadow-lg shadow-rose-600/40 ring-1 ring-rose-400/50'
              : 'bg-emerald-600/90 text-white border-emerald-500/70 shadow-md'
          }`}
        >
          {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
        </div>

        {/* Camera on/off icon */}
        <div
          data-testid="status-camera-badge"
          data-camera-off={!videoActive ? 'true' : 'false'}
          title={videoActive ? 'Camera is on' : 'Camera is off'}
          aria-label={videoActive ? 'Camera is on' : 'Camera is off'}
          className={`flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl backdrop-blur-md border transition-all ${
            videoActive
              ? 'bg-emerald-600/90 text-white border-emerald-500/70 shadow-md'
              : 'bg-rose-600/95 text-white border-rose-500/70 shadow-lg shadow-rose-600/40 ring-1 ring-rose-400/50'
          }`}
        >
          {videoActive ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
        </div>
      </div>

      {/* Participant Name Badge Overlay (Bottom-Left) */}
      <div className="absolute bottom-2.5 left-2.5 sm:bottom-3 sm:left-3 flex items-center gap-2 bg-slate-950/80 backdrop-blur-md border border-white/10 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl shadow-lg z-10 max-w-[85%]">
        <span className="text-xs sm:text-sm font-semibold text-slate-100 truncate">
          {cleanName}
        </span>
        {isLocal && (
          <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 flex-shrink-0">
            You
          </span>
        )}
        {/* Subtle inline mic indicator for quick glance */}
        {isMuted ? (
          <MicOff className="w-3 h-3 text-rose-400 flex-shrink-0" aria-label="Muted" />
        ) : (
          <Mic className="w-3 h-3 text-emerald-400 flex-shrink-0" aria-label="Audio active" />
        )}
      </div>
    </div>
  );
};

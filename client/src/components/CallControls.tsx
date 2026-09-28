import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  UserPlus,
  MonitorUp,
  MonitorOff,
  MessageSquare,
  Smile,
  CircleDot,
  Square,
} from 'lucide-react';

interface CallControlsProps {
  roomId: string;
  isMicOn: boolean;
  isCameraOn: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onLeaveCall: () => void;
  onOpenInvite?: () => void;
  targetContainerRef?: React.RefObject<HTMLElement>;
  isScreenSharing?: boolean;
  onToggleScreenShare?: () => void;
  isChatOpen?: boolean;
  onToggleChat?: () => void;
  unreadCount?: number;
  onSendReaction?: (emoji: string) => void;
  isHost?: boolean;
  isRecording?: boolean;
  onToggleRecording?: () => void;
  recordingDuration?: number;
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '👏', '🎉', '🔥'];

export const CallControls: React.FC<CallControlsProps> = ({
  roomId,
  isMicOn,
  isCameraOn,
  onToggleMic,
  onToggleCamera,
  onLeaveCall,
  onOpenInvite,
  targetContainerRef,
  isScreenSharing = false,
  onToggleScreenShare,
  isChatOpen = false,
  onToggleChat,
  unreadCount = 0,
  onSendReaction,
  isHost = false,
  isRecording = false,
  onToggleRecording,
  recordingDuration = 0,
}) => {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showReactionMenu, setShowReactionMenu] = useState(false);
  const reactionMenuRef = useRef<HTMLDivElement>(null);

  // Close reaction popup on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (reactionMenuRef.current && !reactionMenuRef.current.contains(e.target as Node)) {
        setShowReactionMenu(false);
      }
    };
    if (showReactionMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showReactionMenu]);

  // Synchronize fullscreen state with browser events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const getInviteUrl = () => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/?room=${encodeURIComponent(roomId)}`;
    }
    return `/?room=${encodeURIComponent(roomId)}`;
  };

  // Copy Room ID to clipboard with robust textarea fallback
  const handleCopyRoomId = async () => {
    let success = false;
    if (navigator.clipboard && roomId) {
      try {
        await navigator.clipboard.writeText(roomId);
        success = true;
      } catch (err) {
        console.warn('Clipboard write failed, trying fallback:', err);
      }
    }
    if (!success && typeof document !== 'undefined') {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = roomId;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        success = document.execCommand('copy');
        document.body.removeChild(textArea);
      } catch (e) {
        console.warn('Fallback copy failed:', e);
      }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Share Call using Web Share API with clipboard fallback
  const handleShareCall = async () => {
    if (onOpenInvite) {
      onOpenInvite();
      return;
    }
    const inviteUrl = getInviteUrl();
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my StreamCall video room',
          text: `Join my live WebRTC call on StreamCall! Room: ${roomId}`,
          url: inviteUrl,
        });
        setShared(true);
        setTimeout(() => setShared(false), 2000);
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    }

    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(inviteUrl);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      } catch (err) {
        console.warn('Clipboard copy failed:', err);
      }
    }
  };

  // Toggle native Fullscreen API
  const handleToggleFullscreen = async () => {
    const elem = targetContainerRef?.current || document.documentElement;
    try {
      if (!document.fullscreenElement) {
        if (elem.requestFullscreen) {
          await elem.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch (err) {
      console.warn('Fullscreen request failed:', err);
    }
  };

  return (
    <nav
      aria-label="Call controls"
      className="fixed bottom-4 sm:bottom-6 inset-x-0 flex justify-center items-center z-30 px-2 sm:px-4 pointer-events-none"
    >
      <div className="glass-dock px-2 sm:px-5 py-2 sm:py-3 rounded-2xl flex items-center gap-1.5 sm:gap-3 pointer-events-auto border border-slate-700/50 shadow-2xl backdrop-blur-2xl max-w-[96vw] overflow-x-auto sm:overflow-visible relative z-30">
        {/* Copy Room ID Button */}
        <button
          id="btn-copy-room-id"
          onClick={handleCopyRoomId}
          title={copied ? 'Copied to clipboard' : 'Copy Room ID'}
          aria-label={copied ? 'Room ID copied to clipboard' : `Copy Room ID: ${roomId}`}
          className="min-h-[44px] flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 active:scale-95 text-slate-300 hover:text-white transition-all duration-200 border border-slate-700/40 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-emerald-400" aria-hidden="true" />
              <span className="text-emerald-400" aria-live="polite">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 text-slate-400" aria-hidden="true" />
              <span className="hidden sm:inline font-mono">Room: {roomId}</span>
              <span className="sm:hidden font-mono text-[10px]">ID</span>
            </>
          )}
        </button>

        {/* Invite / Share Button */}
        <button
          id="btn-share-call"
          onClick={handleShareCall}
          title={shared ? 'Link copied' : 'Invite / Share Call'}
          aria-label="Invite / share call link"
          className="min-h-[44px] flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 active:scale-95 text-emerald-300 hover:text-emerald-200 transition-all duration-200 border border-emerald-500/30 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900"
        >
          {shared ? (
            <>
              <Check className="w-4 h-4 text-emerald-400" aria-hidden="true" />
              <span className="text-emerald-400" aria-live="polite">Copied!</span>
            </>
          ) : (
            <>
              <UserPlus className="w-4 h-4 text-emerald-400" aria-hidden="true" />
              <span className="hidden sm:inline">Invite</span>
            </>
          )}
        </button>

        <div className="h-6 w-[1px] bg-slate-700/60 mx-0.5 sm:mx-1" aria-hidden="true"></div>

        {/* Microphone Toggle Button with clear Icon & Label */}
        <button
          id="btn-toggle-mic"
          onClick={onToggleMic}
          title={isMicOn ? 'Mute Microphone' : 'Unmute Microphone'}
          aria-label={isMicOn ? 'Mute Microphone' : 'Unmute Microphone'}
          aria-pressed={!isMicOn}
          className={`min-h-[44px] px-3.5 sm:px-4 py-2.5 rounded-xl transition-all duration-200 shadow-md flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900 active:scale-95 ${
            isMicOn
              ? 'bg-slate-800/90 hover:bg-slate-700 text-slate-100 border border-slate-700/60'
              : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/30 ring-2 ring-rose-500/40'
          }`}
        >
          {isMicOn ? (
            <Mic className="w-5 h-5 text-emerald-400" aria-hidden="true" />
          ) : (
            <MicOff className="w-5 h-5 text-white" aria-hidden="true" />
          )}
          <span className="text-xs font-bold hidden sm:inline">
            {isMicOn ? 'Mic On' : 'Muted'}
          </span>
        </button>

        {/* Camera Toggle Button with clear Icon & Label */}
        <button
          id="btn-toggle-camera"
          onClick={onToggleCamera}
          title={isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
          aria-label={isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
          aria-pressed={!isCameraOn}
          className={`min-h-[44px] px-3.5 sm:px-4 py-2.5 rounded-xl transition-all duration-200 shadow-md flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900 active:scale-95 ${
            isCameraOn
              ? 'bg-slate-800/90 hover:bg-slate-700 text-slate-100 border border-slate-700/60'
              : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/30 ring-2 ring-rose-500/40'
          }`}
        >
          {isCameraOn ? (
            <Video className="w-5 h-5 text-emerald-400" aria-hidden="true" />
          ) : (
            <VideoOff className="w-5 h-5 text-white" aria-hidden="true" />
          )}
          <span className="text-xs font-bold hidden sm:inline">
            {isCameraOn ? 'Cam On' : 'Cam Off'}
          </span>
        </button>

        {/* Screen Share Button */}
        {onToggleScreenShare && (
          <button
            id="btn-toggle-screen"
            onClick={onToggleScreenShare}
            title={isScreenSharing ? 'Stop Sharing Screen' : 'Share Screen'}
            aria-label={isScreenSharing ? 'Stop Sharing Screen' : 'Share Screen'}
            aria-pressed={isScreenSharing}
            className={`min-h-[44px] px-3 sm:px-3.5 py-2.5 rounded-xl transition-all duration-200 shadow-md flex items-center justify-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900 active:scale-95 ${
              isScreenSharing
                ? 'bg-sky-600 hover:bg-sky-500 text-white ring-2 ring-sky-400/40 shadow-sky-600/30'
                : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700/60'
            }`}
          >
            {isScreenSharing ? (
              <MonitorOff className="w-5 h-5 text-white" aria-hidden="true" />
            ) : (
              <MonitorUp className="w-5 h-5 text-sky-400" aria-hidden="true" />
            )}
            <span className="text-xs font-semibold hidden md:inline">
              {isScreenSharing ? 'Sharing' : 'Share'}
            </span>
          </button>
        )}

        {/* Meeting Recording Button (MS Teams Style) - Restricted to Room Host */}
        {isHost && onToggleRecording && (
          <button
            id="btn-toggle-recording"
            onClick={onToggleRecording}
            title={isRecording ? 'Stop Recording' : 'Start Meeting Recording (MS Teams Style)'}
            aria-label={isRecording ? 'Stop Recording' : 'Start Meeting Recording'}
            aria-pressed={isRecording}
            className={`min-h-[44px] px-3 sm:px-3.5 py-2.5 rounded-xl transition-all duration-200 shadow-md flex items-center justify-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 focus:ring-offset-slate-900 active:scale-95 ${
              isRecording
                ? 'bg-rose-600 hover:bg-rose-700 text-white ring-2 ring-rose-400 animate-pulse shadow-rose-600/40'
                : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700/60 hover:text-rose-400'
            }`}
          >
            {isRecording ? (
              <Square className="w-4 h-4 fill-white text-white" aria-hidden="true" />
            ) : (
              <CircleDot className="w-4 h-4 text-rose-500" aria-hidden="true" />
            )}
            <span className="text-xs font-semibold hidden md:inline">
              {isRecording ? (
                <span>
                  REC {Math.floor(recordingDuration / 60)}:
                  {String(recordingDuration % 60).padStart(2, '0')}
                </span>
              ) : (
                'Record'
              )}
            </span>
          </button>
        )}

        {/* Emoji Reactions Picker */}
        {onSendReaction && (
          <div className="relative" ref={reactionMenuRef}>
            <button
              id="btn-reaction-picker"
              onClick={() => setShowReactionMenu((prev) => !prev)}
              title="Send Reaction"
              aria-label="Send Reaction"
              className="min-h-[44px] min-w-[44px] p-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-amber-400 transition-all duration-200 border border-slate-700/50 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-emerald-500 active:scale-95"
            >
              <Smile className="w-5 h-5" aria-hidden="true" />
            </button>

            {/* Reaction Popover */}
            {showReactionMenu && (
              <div
                id="reaction-popover"
                data-testid="reaction-popover"
                className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-2 shadow-2xl flex items-center gap-1.5 z-50 animate-in fade-in zoom-in duration-150"
              >
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      onSendReaction(emoji);
                      setShowReactionMenu(false);
                    }}
                    title={`Send ${emoji}`}
                    className="text-2xl p-1.5 rounded-xl hover:bg-slate-800 hover:scale-125 transition-all select-none active:scale-95"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* In-Call Chat Toggle Button */}
        {onToggleChat && (
          <button
            id="btn-toggle-chat"
            onClick={onToggleChat}
            title={isChatOpen ? 'Close In-Call Chat' : 'Open In-Call Chat'}
            aria-label={isChatOpen ? 'Close In-Call Chat' : 'Open In-Call Chat'}
            aria-pressed={isChatOpen}
            className={`relative min-h-[44px] min-w-[44px] px-3 py-2.5 rounded-xl transition-all duration-200 shadow-md flex items-center justify-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 active:scale-95 ${
              isChatOpen
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/50'
            }`}
          >
            <MessageSquare className={`w-5 h-5 ${isChatOpen ? 'text-white' : 'text-emerald-400'}`} aria-hidden="true" />
            <span className="text-xs font-semibold hidden md:inline">Chat</span>
            {unreadCount > 0 && !isChatOpen && (
              <span
                id="chat-unread-badge"
                data-testid="chat-unread-badge"
                className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-black shadow-md animate-bounce"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        )}

        {/* Fullscreen Toggle Button */}
        <button
          id="btn-toggle-fullscreen"
          onClick={handleToggleFullscreen}
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          aria-label={isFullscreen ? 'Exit Fullscreen mode' : 'Enter Fullscreen mode'}
          aria-pressed={isFullscreen}
          className="min-h-[44px] min-w-[44px] p-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all duration-200 border border-slate-700/50 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900 active:scale-95"
        >
          {isFullscreen ? (
            <Minimize2 className="w-5 h-5 text-amber-400" aria-hidden="true" />
          ) : (
            <Maximize2 className="w-5 h-5 text-slate-300" aria-hidden="true" />
          )}
        </button>

        {/* Leave Call Button */}
        <button
          id="btn-leave-call"
          onClick={onLeaveCall}
          title="Leave Call"
          aria-label="Leave the current call"
          className="min-h-[44px] flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-semibold transition-all duration-200 shadow-lg shadow-rose-600/30 ml-1 sm:ml-2 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 focus:ring-offset-slate-900"
        >
          <PhoneOff className="w-5 h-5" aria-hidden="true" />
          <span className="text-sm hidden sm:inline">Leave</span>
        </button>
      </div>
    </nav>
  );
};

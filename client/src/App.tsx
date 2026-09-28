import React, { useState, useRef, useEffect } from 'react';
import { useWebRTC } from './hooks/useWebRTC';
import { useAuth } from './context/AuthContext';
import { useMeetingRecorder } from './hooks/useMeetingRecorder';
import { RoomForm } from './components/RoomForm';
import { VideoGrid } from './components/VideoGrid';
import { CallControls } from './components/CallControls';
import { ConnectionStatus } from './components/ConnectionStatus';
import { CallTimer } from './components/CallTimer';
import { InviteModal } from './components/InviteModal';
import { InCallChat } from './components/InCallChat';
import { FloatingReactions } from './components/FloatingReactions';
import { Dashboard } from './components/Dashboard';
import { AuthModal } from './components/AuthModal';
import {
  Users,
  ArrowLeft,
  Share2,
  Sparkles,
  MessageSquare,
  LayoutDashboard,
  CircleDot,
  X,
} from 'lucide-react';

export const App: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const {
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
  } = useWebRTC();

  const {
    isRecording,
    recordingDuration,
    activeHostName,
    showTeamsBanner,
    bannerMessage,
    recordingError,
    toggleRecording,
    stopRecording,
    dismissTeamsBanner,
  } = useMeetingRecorder({
    roomId,
    hostName: displayName || user?.name || (isHost ? 'Host' : 'Participant'),
    isHost,
    userId: user?.id,
    localStream,
    remoteStream,
  });

  const [view, setView] = useState<'lobby' | 'dashboard'>('lobby');
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [copiedLink, setCopiedLink] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const lastReadMsgCountRef = useRef(0);
  const stageRef = useRef<HTMLDivElement | null>(null);

  // Synchronize unread messages count
  useEffect(() => {
    if (isChatOpen) {
      setUnreadCount(0);
      lastReadMsgCountRef.current = messages.length;
    } else {
      const newMessages = messages.slice(lastReadMsgCountRef.current);
      const incomingUnread = newMessages.filter((m) => !m.isSelf).length;
      setUnreadCount(incomingUnread);
    }
  }, [messages, isChatOpen]);

  // Check URL query parameters for auto-filling room ID (e.g. ?room=swift-falcon-42)
  const urlParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const roomParam = urlParams.get('room') || '';

  const getInviteUrl = () => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/?room=${encodeURIComponent(roomId)}`;
    }
    return `/?room=${encodeURIComponent(roomId)}`;
  };

  const handleCopyInvite = async () => {
    const inviteUrl = getInviteUrl();
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(inviteUrl);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      } catch (err) {
        console.warn('Clipboard write failed:', err);
      }
    }
  };

  const handleOpenInviteModal = () => {
    setIsInviteOpen(true);
  };

  const handleJoinCallWithAuth = (
    targetRoom: string,
    targetName: string,
    preAcquiredStream?: MediaStream | null
  ) => {
    joinCall(targetRoom, targetName, preAcquiredStream, user?.id);
  };

  const handleStartCallFromDashboard = (newRoomId: string, hostName: string) => {
    setView('lobby');
    joinCall(newRoomId, hostName, null, user?.id);
  };

  const handleLeaveCall = () => {
    if (isRecording) {
      stopRecording();
    }
    leaveCall();
  };

  // If in idle state, show Dashboard or RoomForm
  if (callStatus === 'idle') {
    if (view === 'dashboard' && isAuthenticated) {
      return (
        <Dashboard
          onStartCall={handleStartCallFromDashboard}
          onOpenLobby={() => setView('lobby')}
        />
      );
    }

    return (
      <>
        <RoomForm
          onJoinRoom={handleJoinCallWithAuth}
          initialRoomId={roomParam}
          errorMessage={errorMessage}
          onOpenDashboard={() => setView('dashboard')}
          onOpenAuth={(mode) => {
            setAuthMode(mode);
            setIsAuthOpen(true);
          }}
        />
        <AuthModal
          isOpen={isAuthOpen}
          onClose={() => setIsAuthOpen(false)}
          defaultMode={authMode}
          onSuccess={() => {
            setView('dashboard');
            setIsAuthOpen(false);
          }}
        />
      </>
    );
  }

  // Room full or call ended screens
  if (callStatus === 'room-full' || callStatus === 'call-ended') {
    return (
      <main className="min-h-screen flex flex-col justify-center items-center px-4 bg-[#0b0f19] text-white">
        <div
          data-testid={callStatus === 'room-full' ? 'status-room-full' : 'status-call-ended'}
          className="glass-panel p-8 rounded-3xl max-w-md w-full text-center border border-slate-800 shadow-2xl"
        >
          <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center mx-auto mb-4 text-emerald-400">
            {callStatus === 'room-full' ? (
              <Users className="w-8 h-8 text-amber-400" aria-hidden="true" />
            ) : (
              <Sparkles className="w-8 h-8 text-teal-400" aria-hidden="true" />
            )}
          </div>
          <h2 className="text-2xl font-bold mb-2">
            {callStatus === 'room-full' ? 'Room is Full' : 'Call Ended'}
          </h2>
          <p className="text-sm text-slate-400 mb-6">
            {callStatus === 'room-full'
              ? errorMessage || 'This room already has the maximum of 10 participants.'
              : 'You have left the call. Your session details have been recorded in your dashboard.'}
          </p>

          <div className="space-y-2.5">
            {isAuthenticated && (
              <button
                id="btn-return-dashboard"
                onClick={() => {
                  resetToIdle();
                  setView('dashboard');
                }}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-slate-950 font-bold rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/25 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                <LayoutDashboard className="w-4 h-4" aria-hidden="true" />
                <span>Go to User Dashboard</span>
              </button>
            )}

            <button
              id="btn-return-home"
              onClick={() => {
                resetToIdle();
                setView('lobby');
              }}
              className={`w-full flex items-center justify-center gap-2 py-3 px-4 active:scale-[0.98] font-bold rounded-xl text-sm transition-all border ${
                isAuthenticated
                  ? 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200'
                  : 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-lg shadow-emerald-500/25'
              }`}
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span>Return to Lobby</span>
            </button>
          </div>
        </div>
      </main>
    );
  }

  const totalParticipants = 1 + remotePeers.length;

  return (
    <div
      ref={stageRef}
      className="relative h-screen w-screen bg-[#070a13] flex flex-col overflow-hidden select-none"
    >
      {/* Top Header Bar */}
      <header className="h-16 px-4 sm:px-6 flex items-center justify-between z-20 border-b border-slate-800/60 bg-slate-950/60 backdrop-blur-xl">
        {/* Left: Branding, Room ID, Rec Badge & Participant Count */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </div>
          <h1 className="text-xs sm:text-sm font-bold text-slate-100 tracking-tight flex items-center gap-1.5">
            <span className="text-slate-400 font-medium hidden md:inline">Room:</span>
            <span className="font-mono text-emerald-400 font-bold bg-slate-900/80 px-2 py-0.5 rounded-lg border border-slate-800">
              {roomId}
            </span>
          </h1>

          {/* MS Teams Style Recording Indicator Badge */}
          {isRecording && (
            <div
              id="header-rec-badge"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/20 border border-rose-500/40 text-xs font-bold text-rose-300 animate-pulse"
              title="Meeting recording is active"
            >
              <CircleDot className="w-3.5 h-3.5 text-rose-500" />
              <span>
                REC {Math.floor(recordingDuration / 60)}:
                {String(recordingDuration % 60).padStart(2, '0')}
              </span>
            </div>
          )}

          {/* Participant count badge */}
          <div
            id="participant-count-badge"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-800 text-xs font-semibold text-slate-300"
            title="Active participants in room"
          >
            <Users className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
            <span>{totalParticipants} / 10</span>
          </div>

          {/* Host vs Joinee role badge */}
          <div
            id="user-role-badge"
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border ${
              isHost
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                : 'bg-slate-900/80 border-slate-800 text-slate-400'
            }`}
            title={isHost ? 'You are the Meeting Host (can record meeting)' : 'You joined as a Participant'}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isHost ? 'bg-amber-400 animate-pulse' : 'bg-slate-500'}`} />
            <span>{isHost ? 'Host' : 'Participant'}</span>
          </div>

          {/* Call Duration Timer */}
          <CallTimer isConnected={callStatus === 'connected'} className="ml-0.5 sm:ml-1" />
        </div>

        {/* Center: Responsive Connection Status Badge */}
        <div className="flex items-center">
          <ConnectionStatus
            status={callStatus}
            permissionError={permissionError}
            errorMessage={errorMessage}
            peerName={
              remotePeers.length === 1
                ? remotePeers[0].participant.displayName
                : remotePeers.length > 1
                ? `${remotePeers.length} Peers`
                : undefined
            }
            onRetry={retryMediaAccess}
          />
        </div>

        {/* Right: Quick Share & In-Call Chat */}
        <div className="flex items-center gap-2">
          {/* User badge if authenticated */}
          {isAuthenticated && user && (
            <div
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300 font-medium"
              title={`Logged in as ${user.name}`}
            >
              <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold flex items-center justify-center">
                {user.name.charAt(0).toUpperCase()}
              </span>
              <span className="max-w-[80px] truncate">{user.name}</span>
            </div>
          )}

          {/* Header In-Call Chat Button */}
          <button
            id="btn-header-toggle-chat"
            onClick={() => setIsChatOpen((prev) => !prev)}
            title={isChatOpen ? 'Close Chat' : 'Open In-Call Chat'}
            aria-label="Toggle in-call chat drawer"
            className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 active:scale-95 text-xs font-semibold text-slate-200 hover:text-white border border-slate-700/50 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
            <span className="hidden sm:inline">Chat</span>
            {unreadCount > 0 && !isChatOpen && (
              <span className="flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-black">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Share / Invite Link Button */}
          <button
            id="btn-copy-invite-link"
            onClick={handleOpenInviteModal}
            title="Share / Invite Link"
            aria-label="Share room invite link"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 active:scale-95 text-xs font-semibold text-slate-200 hover:text-white border border-slate-700/50 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <Share2 className="w-3.5 h-3.5 text-teal-400" aria-hidden="true" />
            <span className="hidden sm:inline">Invite</span>
          </button>
        </div>
      </header>

      {/* MS Teams Style Meeting Recording Banner */}
      {showTeamsBanner && (
        <div
          role="alert"
          className="w-full bg-[#1e293b]/95 border-b border-rose-500/40 px-4 py-2.5 flex items-center justify-between z-30 shadow-xl backdrop-blur-md animate-fadeIn"
        >
          <div className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-100">
            <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
            </span>
            <span>{bannerMessage}</span>
          </div>
          <button
            onClick={dismissTeamsBanner}
            aria-label="Dismiss banner"
            className="p-1 rounded-lg text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 text-xs transition-colors ml-3 flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Recording Error Alert */}
      {recordingError && (
        <div
          role="alert"
          className="w-full bg-rose-950/90 border-b border-rose-700 px-4 py-2 text-xs text-rose-200 flex items-center justify-between z-30"
        >
          <span>{recordingError}</span>
        </div>
      )}

      {/* Main Video Stage with Adaptive VideoGrid */}
      <main className="flex-1 relative w-full h-[calc(100vh-4rem)] p-3 sm:p-5 flex items-center justify-center pb-24 sm:pb-28">
        <VideoGrid
          localStream={localStream}
          localDisplayName={displayName}
          isMicOn={isMicOn}
          isCameraOn={isCameraOn}
          remotePeers={remotePeers}
          roomId={roomId}
          onOpenInvite={handleOpenInviteModal}
          onCopyInvite={handleCopyInvite}
          copiedLink={copiedLink}
        />
      </main>

      {/* Floating Bottom Call Controls Dock */}
      <CallControls
        roomId={roomId}
        isMicOn={isMicOn}
        isCameraOn={isCameraOn}
        onToggleMic={toggleMic}
        onToggleCamera={toggleCamera}
        onLeaveCall={handleLeaveCall}
        onOpenInvite={handleOpenInviteModal}
        targetContainerRef={stageRef}
        isScreenSharing={isScreenSharing}
        onToggleScreenShare={toggleScreenShare}
        isChatOpen={isChatOpen}
        onToggleChat={() => setIsChatOpen((prev) => !prev)}
        unreadCount={unreadCount}
        onSendReaction={sendReaction}
        isHost={isHost}
        isRecording={isRecording}
        onToggleRecording={isHost ? toggleRecording : undefined}
        recordingDuration={recordingDuration}
      />

      {/* WhatsApp In-Call Slide-Over Chat Drawer */}
      <InCallChat
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        messages={messages}
        onSendMessage={sendChatMessage}
        onSendReaction={sendReaction}
      />

      {/* Animated Floating Emoji Reactions Layer */}
      <FloatingReactions reactions={reactions} />

      {/* Interactive Invite Modal with Automated Generated Link */}
      <InviteModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        roomId={roomId}
      />
    </div>
  );
};

export default App;

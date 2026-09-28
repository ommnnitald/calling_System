import React, { useState, useEffect, useRef } from 'react';
import {
  Video,
  Sparkles,
  LogIn,
  PlusCircle,
  ShieldCheck,
  User,
  Mic,
  Camera,
  CheckCircle2,
  RefreshCw,
  MailCheck,
  AlertTriangle,
  Copy,
  Check,
  LayoutDashboard,
  LogOut,
  UserPlus,
  Database,
  Settings,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { getLocalUserMedia, isSecureContextSupported } from '../services/webrtc';
import { ServerSettingsModal } from './ServerSettingsModal';

interface RoomFormProps {
  onJoinRoom: (roomId: string, displayName: string, preAcquiredStream?: MediaStream | null) => void;
  initialRoomId?: string;
  errorMessage?: string | null;
  onOpenDashboard?: () => void;
  onOpenAuth?: (mode: 'login' | 'register') => void;
}

const ADJECTIVES = [
  'swift', 'bright', 'calm', 'amber', 'cosmic', 'gentle',
  'silent', 'vibrant', 'golden', 'steady', 'clever', 'sunny',
  'alpine', 'ocean', 'silver', 'breezy', 'stellar', 'mystic',
];

const NOUNS = [
  'river', 'falcon', 'valley', 'harbor', 'summit', 'breeze',
  'forest', 'meadow', 'beacon', 'island', 'galaxy', 'canyon',
  'haven', 'stream', 'oasis', 'comet', 'horizon', 'glacier',
];

export const RoomForm: React.FC<RoomFormProps> = ({
  onJoinRoom,
  initialRoomId = '',
  errorMessage,
  onOpenDashboard,
  onOpenAuth,
}) => {
  const { user, isAuthenticated, logout } = useAuth();
  const [displayName, setDisplayName] = useState(user?.name || '');
  const [roomId, setRoomId] = useState(initialRoomId);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [hasCamera, setHasCamera] = useState<boolean | null>(null);
  const [hasMic, setHasMic] = useState<boolean | null>(null);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [isTestingMedia, setIsTestingMedia] = useState(false);
  const [mediaTestError, setMediaTestError] = useState<string | null>(null);
  const [copiedFlag, setCopiedFlag] = useState(false);
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const [isServerSettingsOpen, setIsServerSettingsOpen] = useState(false);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);

  // Sync user's display name when logging in
  useEffect(() => {
    if (user?.name && !displayName) {
      setDisplayName(user.name);
    }
  }, [user?.name]);

  // Check DB connection status
  useEffect(() => {
    api.getHealth().then((res) => {
      if (res.success && res.data?.database) {
        setDbConnected(res.data.database.connected);
      }
    }).catch(() => {});
  }, []);

  const isInsecureLanContext = typeof window !== 'undefined' && !isSecureContextSupported();

  // Generate friendly human-readable room ID (e.g. swift-falcon-42)
  const generateHumanReadableRoomId = () => {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    const num = Math.floor(Math.random() * 90) + 10;
    return `${adj}-${noun}-${num}`;
  };

  // Inspect available devices on mount
  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          setHasCamera(devices.some((d) => d.kind === 'videoinput'));
          setHasMic(devices.some((d) => d.kind === 'audioinput'));
        })
        .catch(() => {
          setHasCamera(null);
          setHasMic(null);
        });
    }
  }, []);

  // Update roomId if initialRoomId changes
  useEffect(() => {
    if (initialRoomId) {
      setRoomId(initialRoomId);
    }
  }, [initialRoomId]);

  // Handle video element attaching for preview
  useEffect(() => {
    if (previewVideoRef.current && previewStream) {
      previewVideoRef.current.srcObject = previewStream;
      previewVideoRef.current.play().catch(() => {});
    }
  }, [previewStream]);

  // Request permissions upfront and start live preview in lobby
  const handleTestMedia = async () => {
    setIsTestingMedia(true);
    setMediaTestError(null);
    try {
      const res = await getLocalUserMedia(true, true);
      if (res.stream) {
        setPreviewStream(res.stream);
        setHasCamera(res.stream.getVideoTracks().length > 0);
        setHasMic(res.stream.getAudioTracks().length > 0);
      } else if (res.error) {
        setMediaTestError(res.error.message);
      }
    } catch (err: any) {
      setMediaTestError(err.message || 'Permission request failed.');
    } finally {
      setIsTestingMedia(false);
    }
  };

  const handleCopyFlag = async () => {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText('chrome://flags/#unsafely-treat-insecure-origin-as-secure');
      setCopiedFlag(true);
      setTimeout(() => setCopiedFlag(false), 2000);
    }
  };

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setValidationError('Please enter your display name.');
      return;
    }
    const newRoomId = generateHumanReadableRoomId();
    setValidationError(null);
    onJoinRoom(newRoomId, displayName.trim(), previewStream);
  };

  const handleJoinExistingRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setValidationError('Please enter your display name.');
      return;
    }
    if (!roomId.trim()) {
      setValidationError('Please enter a Room ID to join.');
      return;
    }
    setValidationError(null);
    onJoinRoom(roomId.trim(), displayName.trim(), previewStream);
  };

  const handleGenerateNewId = () => {
    setRoomId(generateHumanReadableRoomId());
  };

  return (
    <main className="min-h-screen flex flex-col justify-start items-center px-4 py-4 sm:py-6 relative overflow-hidden bg-[#0b0f19]">
      {/* Ambient Lighting */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" aria-hidden="true"></div>
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-teal-600/15 rounded-full blur-3xl pointer-events-none" aria-hidden="true"></div>

      {/* Top Navbar */}
      <header className="w-full max-w-4xl flex items-center justify-between px-2 py-3 z-20 mb-4 sm:mb-6 border-b border-slate-800/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-bold shadow-md shadow-emerald-500/20">
            <Video className="w-4 h-4 stroke-[2.5]" />
          </div>
          <span className="font-bold text-sm text-white tracking-tight">StreamCall</span>

          <div
            className={`hidden sm:inline-flex items-center gap-1.5 ml-2 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
              dbConnected
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-teal-500/10 text-teal-400 border-teal-500/30'
            }`}
            title={dbConnected ? 'Connected to live MongoDB' : 'Persistent local database active (data saved to disk across restarts)'}
          >
            <Database className="w-3 h-3" />
            <span>{dbConnected ? 'MongoDB Live' : 'Persistent Local DB'}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isAuthenticated && user ? (
            <div className="flex items-center gap-2">
              <button
                id="btn-nav-dashboard"
                onClick={onOpenDashboard}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 hover:text-white text-xs font-semibold transition-all shadow-sm active:scale-95"
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-emerald-400" />
                <span>Dashboard</span>
              </button>

              <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 py-1 px-2.5 rounded-xl text-xs text-slate-300">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-bold">
                  {user.name.charAt(0).toUpperCase()}
                </span>
                <span className="font-medium max-w-[100px] truncate hidden sm:inline">{user.name}</span>
              </div>

              <button
                id="btn-nav-logout"
                onClick={logout}
                title="Sign Out"
                className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                id="btn-nav-login"
                onClick={() => onOpenAuth?.('login')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 hover:text-white text-xs font-semibold transition-all active:scale-95"
              >
                <LogIn className="w-3.5 h-3.5 text-slate-400" />
                <span>Sign In</span>
              </button>

              <button
                id="btn-nav-register"
                onClick={() => onOpenAuth?.('register')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs transition-all shadow-md shadow-emerald-500/20 active:scale-95"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Create Account</span>
              </button>
            </div>
          )}

          <button
            id="btn-nav-server-settings"
            onClick={() => setIsServerSettingsOpen(true)}
            title="Server Connection Settings"
            className="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-all active:scale-95"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Warning banner when accessed over plain HTTP on LAN */}
      {isInsecureLanContext && (
        <aside
          role="alert"
          aria-label="HTTPS Security Notice"
          className="w-full max-w-md mb-4 p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-3 backdrop-blur-md animate-fadeIn z-20"
        >
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <span className="font-bold block text-amber-100 mb-0.5">Secure Context (HTTPS) Required</span>
            <span>Mobile devices and LAN browsers block camera/mic permissions on plain HTTP.</span>
            <a
              href={`https://${window.location.hostname}:5173${window.location.pathname}${window.location.search}`}
              className="mt-2 inline-flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] transition-colors shadow-sm"
            >
              <span>Open via HTTPS &rarr;</span>
            </a>
          </div>
        </aside>
      )}

      <div className="w-full max-w-md z-10 my-auto">
        {/* Header Branding */}
        <div className="text-center mb-5 sm:mb-6">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 mb-3 shadow-xl shadow-emerald-500/20">
            <Video className="w-7 h-7 stroke-[2.2]" aria-hidden="true" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            StreamCall
          </h1>
          <p className="text-slate-400 mt-1.5 text-xs sm:text-sm">
            Instant, secure 1-to-1 WebRTC audio and video calling
          </p>
        </div>

        {/* Invited banner if room parameter is present in URL */}
        {initialRoomId && (
          <aside
            aria-label="Room invitation notification"
            className="mb-4 p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5 backdrop-blur-md animate-fadeIn"
          >
            <MailCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" aria-hidden="true" />
            <div>
              <span className="font-semibold block text-emerald-200">Room Invitation</span>
              <span>You were invited to join room: <code className="font-mono font-bold text-white bg-slate-900/60 px-1.5 py-0.5 rounded">{initialRoomId}</code></span>
            </div>
          </aside>
        )}

        {/* Card Container */}
        <section
          aria-label="Join or create call form"
          className="glass-panel p-6 sm:p-8 rounded-3xl shadow-2xl border border-slate-800"
        >
          {/* User authentication status card */}
          {isAuthenticated && user ? (
            <div className="mb-4 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-300 font-bold text-xs flex items-center justify-center border border-emerald-500/30">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="text-left">
                  <span className="text-xs font-bold text-white block leading-tight">{user.name}</span>
                  <span className="text-[10px] text-emerald-400 block leading-tight">Call will link to your Dashboard</span>
                </div>
              </div>
              {onOpenDashboard && (
                <button
                  type="button"
                  id="btn-lobby-view-history"
                  onClick={onOpenDashboard}
                  className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
                >
                  View History &rarr;
                </button>
              )}
            </div>
          ) : (
            <div className="mb-4 p-3 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
                <span>Save calls & view analytics?</span>
              </div>
              <button
                type="button"
                id="btn-lobby-sign-in-prompt"
                onClick={() => onOpenAuth?.('login')}
                className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex-shrink-0 ml-2"
              >
                Sign In
              </button>
            </div>
          )}
          {/* Validation or Server Error */}
          {(validationError || errorMessage) && (
            <div
              role="alert"
              aria-live="assertive"
              className="mb-5 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center gap-2"
            >
              <span className="w-2 h-2 rounded-full bg-rose-400 flex-shrink-0"></span>
              <span>{validationError || errorMessage}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleJoinExistingRoom} noValidate>
            {/* Display Name Input */}
            <div>
              <label
                htmlFor="display-name-input"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5"
              >
                Your Display Name <span className="text-emerald-400" aria-hidden="true">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" aria-hidden="true" />
                </div>
                <input
                  id="display-name-input"
                  type="text"
                  placeholder="e.g. Alice Walker"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-900/90 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  maxLength={30}
                  required
                  aria-required="true"
                />
              </div>
            </div>

            {/* Room ID Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="room-id-input"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
                >
                  Room ID
                </label>
                <button
                  type="button"
                  id="btn-generate-room-id"
                  onClick={handleGenerateNewId}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium transition-colors"
                  title="Generate a friendly Room ID"
                >
                  <RefreshCw className="w-3 h-3" aria-hidden="true" />
                  <span>Random ID</span>
                </button>
              </div>
              <input
                id="room-id-input"
                type="text"
                placeholder="e.g. swift-falcon-42"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900/90 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all font-mono"
                maxLength={40}
              />
            </div>

            {/* Insecure Context (LAN HTTP) Notice if accessed from other device */}
            {isInsecureLanContext && (
              <div
                role="note"
                className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs"
              >
                <div className="font-semibold flex items-center gap-1.5 text-amber-300 mb-1">
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" aria-hidden="true" />
                  <span>LAN HTTP Notice (Camera & Mic)</span>
                </div>
                <p className="text-[11px] text-slate-300 mb-2">
                  Mobile & external browsers require HTTPS or a developer flag to allow camera/mic over LAN:
                </p>
                <div className="flex items-center gap-1.5 bg-slate-900/90 p-2 rounded-lg border border-slate-700/80 font-mono text-[10px] text-amber-300 justify-between">
                  <span className="truncate select-all">chrome://flags/#unsafely-treat-insecure-origin-as-secure</span>
                  <button
                    type="button"
                    onClick={handleCopyFlag}
                    className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-sans flex-shrink-0 transition-colors"
                  >
                    {copiedFlag ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            )}

            {/* Live Camera & Mic Preview if Tested */}
            {previewStream && (
              <div className="rounded-2xl overflow-hidden border border-emerald-500/40 relative aspect-video bg-slate-950 shadow-inner">
                <video
                  ref={previewVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                  aria-label="Lobby camera preview"
                />
                <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded-md bg-slate-900/85 text-emerald-400 text-[10px] font-bold border border-emerald-500/30 flex items-center gap-1.5 shadow">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Camera & Mic Live
                </div>
              </div>
            )}

            {/* Media Test Error */}
            {mediaTestError && (
              <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <span>{mediaTestError}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                id="btn-create-room"
                onClick={handleCreateRoom}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 active:scale-[0.98] text-slate-950 font-bold rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/25 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900"
              >
                <PlusCircle className="w-4 h-4 text-slate-950" aria-hidden="true" />
                <span>Create Room</span>
              </button>

              <button
                type="submit"
                id="btn-join-room"
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-white font-semibold rounded-xl text-sm border border-slate-700 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900"
              >
                <LogIn className="w-4 h-4 text-slate-300" aria-hidden="true" />
                <span>Join Room</span>
              </button>
            </div>
          </form>

          {/* Device Readiness Indicator with Enable Button */}
          <div
            aria-label="Hardware device readiness"
            className="mt-6 pt-5 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400"
          >
            <div className="flex items-center gap-3">
              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Devices:</span>
              <div className="flex items-center gap-1">
                <Camera className={`w-3.5 h-3.5 ${hasCamera === false ? 'text-rose-400' : 'text-emerald-400'}`} aria-hidden="true" />
                <span>{hasCamera === false ? 'No Camera' : 'Camera Ready'}</span>
              </div>
              <div className="flex items-center gap-1">
                <Mic className={`w-3.5 h-3.5 ${hasMic === false ? 'text-rose-400' : 'text-emerald-400'}`} aria-hidden="true" />
                <span>{hasMic === false ? 'No Mic' : 'Mic Ready'}</span>
              </div>
            </div>

            <button
              type="button"
              id="btn-test-media"
              onClick={handleTestMedia}
              disabled={isTestingMedia}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-emerald-400"
              title="Test and request browser camera & microphone permissions"
            >
              {isTestingMedia ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Camera className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>{previewStream ? 'Permissions Active' : 'Allow / Test Camera & Mic'}</span>
            </button>
          </div>

          {/* Feature Badges */}
          <div className="mt-4 pt-4 border-t border-slate-800/40 flex items-center justify-around text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" aria-hidden="true" />
              <span>Direct P2P WebRTC</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-teal-400" aria-hidden="true" />
              <span>Zero Sign-up</span>
            </div>
          </div>
        </section>

        {/* Small Footer Notice */}
        <footer className="text-center text-xs text-slate-600 mt-6">
          Encrypted peer-to-peer connection &bull; No media is saved on servers
        </footer>
      </div>

      <ServerSettingsModal
        isOpen={isServerSettingsOpen}
        onClose={() => setIsServerSettingsOpen(false)}
      />
    </main>
  );
};

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { CallHistoryItem, CallStats, RecordingItem } from '../types';
import { CallDetailsModal } from './CallDetailsModal';
import { VideoPlayerModal } from './VideoPlayerModal';
import {
  Video,
  Users,
  Clock,
  Calendar,
  LogOut,
  Plus,
  ArrowRight,
  Copy,
  Check,
  RefreshCw,
  Database,
  Sparkles,
  PhoneCall,
  History,
  TrendingUp,
  Shield,
  Layers,
  Info,
  Film,
  Play,
  Download,
  Trash2,
  HardDrive,
} from 'lucide-react';

interface DashboardProps {
  onStartCall: (roomId: string, displayName: string) => void;
  onOpenLobby: () => void;
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

export const Dashboard: React.FC<DashboardProps> = ({
  onStartCall,
  onOpenLobby,
}) => {
  const { user, logout } = useAuth();
  const [history, setHistory] = useState<CallHistoryItem[]>([]);
  const [stats, setStats] = useState<CallStats>({
    totalCalls: 0,
    totalMinutes: 0,
    hostedCount: 0,
    recentRooms: [],
  });
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [joinRoomId, setJoinRoomId] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [copiedRoomId, setCopiedRoomId] = useState<string | null>(null);
  const [selectedCall, setSelectedCall] = useState<CallHistoryItem | null>(null);
  const [activeTab, setActiveTab] = useState<'calls' | 'recordings'>('calls');
  const [recordings, setRecordings] = useState<RecordingItem[]>([]);
  const [selectedRecording, setSelectedRecording] = useState<RecordingItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Generate random room ID
  const generateRoomId = () => {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    const num = Math.floor(Math.random() * 90) + 10;
    return `${adj}-${noun}-${num}`;
  };

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Health check for DB status
      const healthRes = await api.getHealth();
      if (healthRes.success && healthRes.data?.database) {
        setDbConnected(healthRes.data.database.connected);
      }

      // 2. Call history
      const historyRes = await api.getCallHistory();
      if (historyRes.success && historyRes.data?.calls) {
        setHistory(historyRes.data.calls);
      }

      // 3. Stats
      const statsRes = await api.getCallStats();
      if (statsRes.success && statsRes.data?.stats) {
        setStats(statsRes.data.stats);
      }

      // 4. Recordings
      const recsRes = await api.getRecordings();
      if (recsRes.success && recsRes.data?.recordings) {
        setRecordings(recsRes.data.recordings);
      }
    } catch (err) {
      console.warn('[Dashboard] Data load notice:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRecording = async (id: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this meeting recording?')) {
      return;
    }
    setDeletingId(id);
    try {
      const res = await api.deleteRecording(id);
      if (res.success) {
        setRecordings((prev) => prev.filter((r) => r.id !== id));
      }
    } catch (err) {
      console.warn('Failed to delete recording:', err);
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleStartInstantMeeting = () => {
    const newRoom = generateRoomId();
    onStartCall(newRoom, user?.name || 'Host');
  };

  const handleJoinWithCode = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanRoom = joinRoomId.trim();
    if (!cleanRoom) {
      setJoinError('Please enter a Room ID or paste an invite link.');
      return;
    }

    let parsedRoom = cleanRoom;
    try {
      if (cleanRoom.includes('?room=')) {
        const url = new URL(cleanRoom);
        parsedRoom = url.searchParams.get('room') || cleanRoom;
      }
    } catch (_) {}

    setJoinError(null);
    onStartCall(parsedRoom, user?.name || 'Guest');
  };

  const handleCopyLink = async (roomId: string) => {
    const inviteUrl = `${window.location.origin}/?room=${encodeURIComponent(roomId)}`;
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(inviteUrl);
        setCopiedRoomId(roomId);
        setTimeout(() => setCopiedRoomId(null), 2000);
      } catch (_) {}
    }
  };

  const formatDuration = (seconds: number): string => {
    if (!seconds || seconds <= 0) return 'Just started';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  const formatDate = (isoString: string): string => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (_) {
      return 'Recent';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes <= 0) return '0.0 KB (Empty)';
    const mb = bytes / (1024 * 1024);
    if (mb < 0.05) return `${(bytes / 1024).toFixed(1)} KB`;
    if (mb < 1) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${mb.toFixed(2)} MB`;
  };

  const userInitials = (user?.name || 'U')
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[#070a13] text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* Top Header */}
      <header className="h-16 px-4 sm:px-8 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-xl sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20 font-bold">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              StreamCall
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                Dashboard
              </span>
            </h1>
          </div>
        </div>

        {/* User profile & actions */}
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            id="btn-nav-lobby"
            onClick={onOpenLobby}
            className="text-xs font-semibold text-slate-300 hover:text-white px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all hidden sm:inline-flex items-center gap-1.5"
          >
            <Layers className="w-3.5 h-3.5 text-teal-400" />
            <span>Classic Lobby</span>
          </button>

          {/* User Badge */}
          <div className="flex items-center gap-2.5 bg-slate-900/90 border border-slate-800 py-1.5 px-3 rounded-2xl shadow-inner">
            <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center border border-emerald-500/30">
              {userInitials}
            </div>
            <div className="text-left hidden md:block">
              <span className="text-xs font-bold text-white block leading-tight truncate max-w-[120px]">
                {user?.name}
              </span>
              <span className="text-[10px] text-slate-400 block leading-tight truncate max-w-[120px]">
                {user?.email}
              </span>
            </div>
          </div>

          <button
            id="btn-logout"
            onClick={logout}
            title="Log Out"
            className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors border border-transparent hover:border-rose-500/30"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 space-y-6 sm:space-y-8">
        {/* Welcome Banner & DB Status */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-emerald-950/40 via-slate-900/60 to-slate-950 border border-slate-800 p-6 rounded-3xl backdrop-blur-xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                Welcome back
              </span>
              {/* Database status pill */}
              <div
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                  dbConnected
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                    : 'bg-teal-500/10 text-teal-300 border-teal-500/30'
                }`}
                title={
                  dbConnected
                    ? 'Connected to live MongoDB'
                    : 'Persistent Local Storage is active. All accounts, calls, and durations are saved to disk across restarts.'
                }
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    dbConnected ? 'bg-emerald-400 animate-pulse' : 'bg-teal-400'
                  }`}
                />
                <span>{dbConnected ? 'MongoDB Cloud' : 'Local Persistent DB'}</span>
              </div>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Hello, {user?.name || 'User'}!
            </h2>
            <p className="text-sm text-slate-400 mt-1 max-w-xl">
              Start an instant WebRTC audio/video call, join existing rooms with up to 10 participants, or browse your call session records below.
            </p>
          </div>

          <div className="flex items-center gap-3 z-10">
            <button
              id="btn-refresh-dashboard"
              onClick={loadDashboardData}
              disabled={loading}
              title="Refresh History"
              className="p-3 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all border border-slate-700 active:scale-95"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              id="btn-start-instant-hero"
              onClick={handleStartInstantMeeting}
              className="flex items-center gap-2 py-3 px-5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 active:scale-95 text-slate-950 font-bold rounded-2xl text-sm transition-all shadow-lg shadow-emerald-500/25"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Start Instant Meeting</span>
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Total Calls
              </span>
              <PhoneCall className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white">
              {stats.totalCalls}
            </div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">Sessions attended</span>
          </div>

          <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Call Time
              </span>
              <Clock className="w-4 h-4 text-teal-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white">
              {stats.totalMinutes} <span className="text-sm font-normal text-slate-400">min</span>
            </div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">In live calls</span>
          </div>

          <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Rooms Hosted
              </span>
              <Users className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white">
              {stats.hostedCount}
            </div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">Created by you</span>
          </div>

          <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Recordings
              </span>
              <Film className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white">
              {recordings.length}
            </div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">Saved videos</span>
          </div>
        </div>

        {/* Actions Hub (Join / Start) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Action 1: Start Custom Meeting */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center mb-4 border border-emerald-500/30">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Instant 10-Peer Room</h3>
              <p className="text-xs text-slate-400 mb-4">
                Launch a clean encrypted room with audio, HD video, screen sharing, and real-time chat.
              </p>
            </div>
            <button
              id="btn-start-instant"
              onClick={handleStartInstantMeeting}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-500 hover:bg-emerald-600 active:scale-98 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-md shadow-emerald-500/20"
            >
              <Video className="w-4 h-4" />
              <span>Generate Room & Join</span>
            </button>
          </div>

          {/* Action 2: Join Meeting with Code / URL */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-teal-500/15 text-teal-400 flex items-center justify-center mb-4 border border-teal-500/30">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Join with Room Code</h3>
              <p className="text-xs text-slate-400 mb-4">
                Paste an invitation link or enter a Room ID (e.g. <span className="font-mono text-emerald-400">swift-falcon-42</span>)
              </p>
            </div>

            <form onSubmit={handleJoinWithCode} className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  id="dashboard-join-input"
                  type="text"
                  placeholder="Enter Room ID or URL..."
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="submit"
                  id="btn-dashboard-join"
                  className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm rounded-xl border border-slate-700 transition-all flex items-center gap-1.5 flex-shrink-0"
                >
                  <span>Join</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              {joinError && (
                <span className="text-[11px] text-rose-400 block">{joinError}</span>
              )}
            </form>
          </div>
        </div>

        {/* Meeting History & Recordings Tabs Section */}
        <section className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            {/* Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-900/90 rounded-2xl border border-slate-800 w-fit">
              <button
                id="tab-call-sessions"
                onClick={() => setActiveTab('calls')}
                className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'calls'
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Call Sessions</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black ${
                    activeTab === 'calls' ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {history.length}
                </span>
              </button>

              <button
                id="tab-meeting-recordings"
                onClick={() => setActiveTab('recordings')}
                className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'recordings'
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                <span>Meeting Recordings</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black ${
                    activeTab === 'recordings' ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {recordings.length}
                </span>
              </button>
            </div>

            <button
              onClick={loadDashboardData}
              disabled={loading}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors self-end sm:self-auto px-3 py-1.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 active:scale-95"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Tab 1: Call Sessions */}
          {activeTab === 'calls' && (
            history.length === 0 ? (
              <div className="text-center py-12 text-slate-500 flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-3 text-slate-600">
                  <PhoneCall className="w-8 h-8" />
                </div>
                <h4 className="text-sm font-semibold text-slate-300 mb-1">No call history recorded yet</h4>
                <p className="text-xs text-slate-500 max-w-sm mb-4">
                  When you host or join calls, your call sessions, duration, and participant details are automatically saved here in persistent storage.
                </p>
                <button
                  onClick={handleStartInstantMeeting}
                  className="py-2 px-4 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 font-semibold text-xs rounded-xl border border-emerald-500/30 transition-all"
                >
                  Start Your First Call
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((call) => (
                  <div
                    key={call.id}
                    onClick={() => setSelectedCall(call)}
                    className="bg-slate-900/80 hover:bg-slate-900 border border-slate-800/80 hover:border-emerald-500/50 p-4 rounded-2xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer group shadow-sm hover:shadow-lg hover:shadow-emerald-500/5"
                    title="Click to view complete meeting time and participants"
                  >
                    <div className="flex items-start sm:items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-slate-800 group-hover:bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold flex-shrink-0 border border-slate-700/60 group-hover:border-emerald-500/30 transition-colors">
                        <Video className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-white font-bold text-sm group-hover:text-emerald-300 transition-colors">
                            {call.roomId}
                          </span>
                          {call.isHost && (
                            <span className="text-[10px] uppercase font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded">
                              Host
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              call.status === 'active'
                                ? 'bg-emerald-500/20 text-emerald-300 animate-pulse'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {call.status === 'active' ? 'Active Call' : 'Completed'}
                          </span>
                          <span className="text-[10px] text-emerald-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity hidden md:inline">
                            &bull; View Full Info &rarr;
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {formatDate(call.startedAt)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {formatDuration(call.durationSeconds)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            {call.participants?.length || call.participantCount || 1} {(call.participants?.length || call.participantCount) === 1 ? 'peer' : 'peers'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCall(call);
                        }}
                        className="p-2 rounded-xl text-slate-400 hover:text-emerald-300 bg-slate-800/80 hover:bg-slate-700 transition-colors border border-slate-700 text-xs flex items-center gap-1.5"
                        title="View Details"
                      >
                        <Info className="w-3.5 h-3.5" />
                        <span className="text-xs">Details</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyLink(call.roomId);
                        }}
                        className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 transition-colors border border-slate-700 text-xs flex items-center gap-1.5"
                        title="Copy Room Link"
                      >
                        {copiedRoomId === call.roomId ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                            <span>Link</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onStartCall(call.roomId, user?.name || 'User');
                        }}
                        className="py-2 px-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5 active:scale-95"
                      >
                        <span>Call Again</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* Tab 2: Meeting Recordings */}
          {activeTab === 'recordings' && (
            recordings.length === 0 ? (
              <div className="text-center py-12 text-slate-500 flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-3 text-slate-600">
                  <Film className="w-8 h-8" />
                </div>
                <h4 className="text-sm font-semibold text-slate-300 mb-1">No meeting recordings yet</h4>
                <p className="text-xs text-slate-500 max-w-sm mb-4">
                  When you are the host of a meeting, click the Record button in the call controls. All completed recordings are automatically uploaded here with in-app playback and downloads.
                </p>
                <button
                  onClick={handleStartInstantMeeting}
                  className="py-2 px-4 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 font-semibold text-xs rounded-xl border border-emerald-500/30 transition-all"
                >
                  Start Meeting & Record
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recordings.map((rec) => (
                  <div
                    key={rec.id}
                    className="bg-slate-900/80 hover:bg-slate-900 border border-slate-800/80 hover:border-emerald-500/40 p-4 sm:p-5 rounded-2xl transition-all flex flex-col justify-between gap-4 shadow-sm hover:shadow-lg hover:shadow-emerald-500/5 group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-white font-bold text-sm">
                            {rec.roomId}
                          </span>
                          <span className="text-[10px] uppercase font-extrabold bg-rose-500/20 text-rose-300 border border-rose-500/30 px-1.5 py-0.5 rounded">
                            Recording
                          </span>
                        </div>
                        <span className={`text-[11px] font-mono ${rec.fileSize < 1024 ? 'text-amber-400 font-semibold' : 'text-slate-400'}`}>
                          {formatFileSize(rec.fileSize)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-400 mb-3">
                        Recorded by <span className="text-slate-200 font-semibold">{rec.hostName}</span>
                      </p>

                      <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          {formatDate(rec.createdAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-teal-400" />
                          {formatDuration(rec.durationSeconds)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-3 border-t border-slate-800/60">
                      <button
                        onClick={() => setSelectedRecording(rec)}
                        className="flex-1 py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5 active:scale-95"
                      >
                        <Play className="w-3.5 h-3.5 fill-slate-950" />
                        <span>Watch Video</span>
                      </button>

                      <a
                        href={api.getRecordingDownloadUrl(rec.id)}
                        download={rec.fileName}
                        title="Download Video File"
                        className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 transition-colors border border-slate-700 text-xs flex items-center justify-center"
                      >
                        <Download className="w-4 h-4" />
                      </a>

                      <button
                        onClick={() => handleDeleteRecording(rec.id)}
                        disabled={deletingId === rec.id}
                        title="Delete Recording"
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors border border-transparent hover:border-rose-500/30 text-xs flex items-center justify-center"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </section>
      </main>

      {/* Interactive Call Details Modal */}
      <CallDetailsModal
        call={selectedCall}
        isOpen={Boolean(selectedCall)}
        onClose={() => setSelectedCall(null)}
        onRejoin={(roomId) => onStartCall(roomId, user?.name || 'User')}
        onWatchRecording={(rec) => setSelectedRecording(rec)}
      />

      {/* Embedded Video Player Modal */}
      <VideoPlayerModal
        recording={selectedRecording}
        isOpen={Boolean(selectedRecording)}
        onClose={() => setSelectedRecording(null)}
        onDelete={(id) => {
          handleDeleteRecording(id);
          setSelectedRecording(null);
        }}
      />
    </div>
  );
};

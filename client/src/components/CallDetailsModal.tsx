import React, { useState, useEffect } from 'react';
import { CallHistoryItem, RecordingItem } from '../types';
import { api } from '../services/api';
import {
  X,
  Video,
  Clock,
  Calendar,
  Users,
  Copy,
  Check,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  Timer,
  ExternalLink,
  Play,
  Download,
  Film,
} from 'lucide-react';

interface CallDetailsModalProps {
  call: CallHistoryItem | null;
  isOpen: boolean;
  onClose: () => void;
  onRejoin: (roomId: string) => void;
  onWatchRecording?: (rec: RecordingItem) => void;
}

export const CallDetailsModal: React.FC<CallDetailsModalProps> = ({
  call,
  isOpen,
  onClose,
  onRejoin,
  onWatchRecording,
}) => {
  const [copied, setCopied] = useState(false);
  const [recordings, setRecordings] = useState<RecordingItem[]>([]);
  const [loadingRecordings, setLoadingRecordings] = useState(false);

  useEffect(() => {
    if (!isOpen || !call?.roomId) {
      setRecordings([]);
      return;
    }

    let isMounted = true;
    setLoadingRecordings(true);
    api.getRoomRecordings(call.roomId)
      .then((res) => {
        if (isMounted) {
          setRecordings(res.data?.recordings || []);
        }
      })
      .catch((err) => {
        console.warn('Could not fetch recordings for room:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingRecordings(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, call?.roomId]);

  if (!isOpen || !call) return null;

  const handleCopyLink = async () => {
    const inviteUrl = `${window.location.origin}/?room=${encodeURIComponent(call.roomId)}`;
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(inviteUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (_) {}
    }
  };

  const formatDuration = (seconds: number): string => {
    if (!seconds || seconds <= 0) return '< 1 min';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes <= 0) return '0 B';
    const mb = bytes / (1024 * 1024);
    if (mb < 1) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${mb.toFixed(1)} MB`;
  };

  const formatFullDate = (isoString?: string): string => {
    if (!isoString) return 'Active / In Progress';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch (_) {
      return isoString;
    }
  };

  const formatTimeOnly = (isoString?: string): string => {
    if (!isoString) return 'Active';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch (_) {
      return isoString;
    }
  };

  const totalMeetingSeconds = call.durationSeconds || 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="call-details-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="glass-panel w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-700/80 shadow-2xl bg-[#0f172a]/95 text-slate-100 flex flex-col relative animate-scaleUp p-5 sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close details modal"
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-emerald-500/20 flex-shrink-0">
              <Video className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id="call-details-title" className="text-xl sm:text-2xl font-extrabold text-white font-mono tracking-tight">
                  {call.roomId}
                </h2>
                {call.isHost && (
                  <span className="text-[10px] uppercase font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                    Host
                  </span>
                )}
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    call.status === 'active'
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 animate-pulse'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {call.status === 'active' ? '● In Call' : 'Completed'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Hosted by <span className="text-slate-200 font-semibold">{call.hostName}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition-all active:scale-95"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
            <button
              onClick={() => onRejoin(call.roomId)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs transition-all shadow-md shadow-emerald-500/20 active:scale-95"
            >
              <span>Rejoin Call</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Meeting Overview Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-5">
          <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Duration</span>
              <Clock className="w-3.5 h-3.5 text-teal-400" />
            </div>
            <span className="text-lg sm:text-xl font-black text-white">
              {formatDuration(call.durationSeconds)}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Total call time</span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Attendees</span>
              <Users className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <span className="text-lg sm:text-xl font-black text-white">
              {call.participants?.length || call.participantCount || 1}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Total joined</span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Peak Peers</span>
              <UserCheck className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <span className="text-lg sm:text-xl font-black text-white">
              {call.maxConcurrentPeers || call.participantCount || 1}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Concurrent max</span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Encryption</span>
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <span className="text-base sm:text-lg font-bold text-white">
              Direct P2P
            </span>
            <span className="text-[10px] text-emerald-400 block mt-0.5">DTLS / SRTP</span>
          </div>
        </div>

        {/* Timestamps Card */}
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl mb-5 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5 font-medium">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              <span>Meeting Started:</span>
            </span>
            <span className="font-mono text-white font-semibold">{formatFullDate(call.startedAt)}</span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
            <span className="text-slate-400 flex items-center gap-1.5 font-medium">
              <Timer className="w-3.5 h-3.5 text-teal-400" />
              <span>Meeting Ended:</span>
            </span>
            <span className="font-mono text-white font-semibold">{formatFullDate(call.endedAt)}</span>
          </div>
        </div>

        {/* Meeting Recordings Section */}
        {recordings.length > 0 && (
          <div className="mb-5 p-4 rounded-2xl bg-slate-900/90 border border-emerald-500/30 shadow-lg shadow-emerald-500/5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Meeting Recordings ({recordings.length})
                </h3>
              </div>
              <span className="text-[10px] text-emerald-400/80 font-medium">Stored on server</span>
            </div>

            <div className="space-y-2">
              {recordings.map((rec) => (
                <div
                  key={rec.id}
                  className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 text-emerald-400">
                      <Video className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">
                        {rec.fileName}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2">
                        <span>{formatDuration(rec.durationSeconds)}</span>
                        <span>&bull;</span>
                        <span>{formatFileSize(rec.fileSize)}</span>
                        <span>&bull;</span>
                        <span>By {rec.hostName}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {onWatchRecording && (
                      <button
                        onClick={() => onWatchRecording(rec)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-bold transition-all shadow-sm shadow-emerald-500/20 active:scale-95"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Watch</span>
                      </button>
                    )}
                    <a
                      href={api.getRecordingDownloadUrl(rec.id)}
                      download={rec.fileName}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                      title="Download video"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detailed Participants List */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white tracking-tight">
                Participants in Call ({call.participants?.length || 0})
              </h3>
            </div>
            <span className="text-[11px] text-slate-500">Timeline & Stay Duration</span>
          </div>

          <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
            {(!call.participants || call.participants.length === 0) ? (
              <div className="text-center py-6 text-slate-500 text-xs bg-slate-900/40 rounded-2xl border border-slate-800">
                Participant records are logged when peers connect to the room channel.
              </div>
            ) : (
              call.participants.map((p, idx) => {
                const stay = p.staySeconds !== undefined ? p.staySeconds : call.durationSeconds;
                const percentage = Math.min(100, Math.max(15, Math.round((stay / totalMeetingSeconds) * 100)));
                const initials = (p.displayName || 'U')
                  .trim()
                  .split(/\s+/)
                  .map((w) => w[0])
                  .join('')
                  .substring(0, 2)
                  .toUpperCase();

                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800/90 hover:border-slate-700 transition-all flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-slate-950 font-black text-xs flex items-center justify-center flex-shrink-0">
                          {initials}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-white">{p.displayName}</span>
                            {p.isSelf && (
                              <span className="text-[9px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded">
                                You
                              </span>
                            )}
                            {p.isHost && (
                              <span className="text-[9px] font-extrabold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded">
                                Host
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span>Joined: <strong className="text-slate-300 font-mono">{formatTimeOnly(p.joinedAt)}</strong></span>
                            {p.leftAt && (
                              <>
                                <span>&bull;</span>
                                <span>Left: <strong className="text-slate-300 font-mono">{formatTimeOnly(p.leftAt)}</strong></span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-bold text-emerald-400 block font-mono">
                          {formatDuration(stay)}
                        </span>
                        <span className="text-[10px] text-slate-500 block">Stayed</span>
                      </div>
                    </div>

                    {/* Stay progress bar */}
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs transition-colors"
          >
            Close Details
          </button>
          <button
            type="button"
            onClick={() => onRejoin(call.roomId)}
            className="py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs transition-all shadow-md shadow-emerald-500/25 flex items-center gap-1.5 active:scale-95"
          >
            <span>Rejoin Meeting</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

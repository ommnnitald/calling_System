import React, { useRef, useEffect } from 'react';
import { X, Download, Film, Clock, Calendar, HardDrive, Video } from 'lucide-react';
import { RecordingItem } from '../types';
import { api } from '../services/api';

interface VideoPlayerModalProps {
  recording: RecordingItem | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: (id: string) => void;
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  recording,
  isOpen,
  onClose,
  onDelete,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasError, setHasError] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  useEffect(() => {
    setHasError(false);
    setErrorMessage(null);
  }, [recording]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Pause video on close
  useEffect(() => {
    if (!isOpen && videoRef.current) {
      videoRef.current.pause();
    }
  }, [isOpen]);

  if (!isOpen || !recording) return null;

  const isZeroSize = !recording.fileSize || recording.fileSize < 1024;
  const streamUrl = api.getRecordingStreamUrl(recording.id);
  const downloadUrl = api.getRecordingDownloadUrl(recording.id);

  const formatDuration = (seconds: number): string => {
    if (!seconds || seconds <= 0) return '0s';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes <= 0) return '0.0 KB (Empty)';
    const mb = bytes / (1024 * 1024);
    if (mb < 0.05) return `${(bytes / 1024).toFixed(1)} KB`;
    if (mb < 1) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${mb.toFixed(2)} MB`;
  };

  const formatDate = (isoString: string): string => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (_) {
      return 'Recent';
    }
  };

  const handleVideoError = () => {
    setHasError(true);
    if (isZeroSize) {
      setErrorMessage('This recording file contains 0 bytes or is missing from the server.');
    } else {
      setErrorMessage('The media file could not be played. The file may be missing from server disk or corrupted.');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="video-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-xl animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-4xl bg-slate-900/95 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
              <Film className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 id="video-modal-title" className="text-base sm:text-lg font-bold text-white truncate">
                  Meeting Recording
                </h3>
                <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-lg">
                  {recording.roomId}
                </span>
                {isZeroSize && (
                  <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded-lg">
                    Empty File
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5">
                Recorded by <span className="text-slate-200 font-semibold">{recording.hostName}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isZeroSize && !hasError && (
              <a
                href={downloadUrl}
                download={recording.fileName}
                title="Download Video File"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition-all active:scale-95"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Download</span>
              </a>
            )}
            {onDelete && (
              <button
                onClick={() => {
                  onDelete(recording.id);
                  onClose();
                }}
                title="Delete Recording"
                className="p-2 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors border border-transparent hover:border-rose-500/30 text-xs"
              >
                Delete
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close video player"
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Video Player Container */}
        <div className="relative bg-black flex items-center justify-center aspect-video w-full overflow-hidden">
          {hasError || isZeroSize ? (
            <div className="flex flex-col items-center justify-center p-6 text-center max-w-md">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3">
                <Film className="w-7 h-7" />
              </div>
              <h4 className="text-base font-bold text-white mb-1">
                Recording Not Playable
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                {errorMessage || 'This recording file was saved with zero data or was deleted from the server.'}
              </p>
              {onDelete && (
                <button
                  onClick={() => {
                    onDelete(recording.id);
                    onClose();
                  }}
                  className="py-2 px-4 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition-all"
                >
                  Remove Broken Record
                </button>
              )}
            </div>
          ) : (
            <video
              ref={videoRef}
              src={streamUrl}
              controls
              autoPlay
              playsInline
              onError={handleVideoError}
              className="w-full h-full max-h-[65vh] object-contain focus:outline-none"
            >
              Your browser does not support HTML5 video playback.
            </video>
          )}
        </div>

        {/* Metadata Footer */}
        <div className="px-5 sm:px-6 py-3.5 bg-slate-950/60 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-teal-400" />
              <span>Duration: <strong className="text-slate-200">{formatDuration(recording.durationSeconds)}</strong></span>
            </span>
            <span className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-sky-400" />
              <span>File Size: <strong className={isZeroSize ? 'text-amber-400' : 'text-slate-200'}>{formatFileSize(recording.fileSize)}</strong></span>
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>Recorded: <strong className="text-slate-200">{formatDate(recording.createdAt)}</strong></span>
            </span>
          </div>

          <span className="font-mono text-[11px] text-slate-500 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 truncate max-w-xs">
            {recording.fileName}
          </span>
        </div>
      </div>
    </div>
  );
};

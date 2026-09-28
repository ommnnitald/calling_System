import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface CallTimerProps {
  isConnected: boolean;
  className?: string;
}

export const CallTimer: React.FC<CallTimerProps> = ({ isConnected, className = '' }) => {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isConnected) {
      interval = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setSeconds(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isConnected]);

  const formatTime = (totalSeconds: number): string => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    const pad = (n: number) => n.toString().padStart(2, '0');

    if (hrs > 0) {
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  };

  if (!isConnected) return null;

  return (
    <div
      data-testid="call-timer"
      aria-label={`Call duration: ${formatTime(seconds)}`}
      role="timer"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 border border-slate-700/60 text-slate-300 text-xs font-mono tracking-wider backdrop-blur-md shadow-sm ${className}`}
    >
      <Clock className="w-3.5 h-3.5 text-emerald-400 animate-pulse" aria-hidden="true" />
      <span>{formatTime(seconds)}</span>
    </div>
  );
};

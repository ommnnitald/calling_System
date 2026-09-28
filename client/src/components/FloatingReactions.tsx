import React, { useEffect, useState } from 'react';
import { FloatingReaction } from '../types';

interface FloatingReactionsProps {
  reactions: FloatingReaction[];
  onRemoveReaction?: (id: string) => void;
}

interface RenderItem {
  reaction: FloatingReaction;
  leftPercent: number;
}

export const FloatingReactions: React.FC<FloatingReactionsProps> = ({
  reactions,
}) => {
  const [items, setItems] = useState<RenderItem[]>([]);

  useEffect(() => {
    if (reactions.length === 0) return;

    // Track newly added reactions
    setItems((prev) => {
      const existingIds = new Set(prev.map((p) => p.reaction.id));
      const newOnes = reactions
        .filter((r) => !existingIds.has(r.id))
        .map((r) => {
          // Semi-random horizontal position (15% to 85%)
          const hash = r.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
          const leftPercent = 20 + (hash % 60);
          return { reaction: r, leftPercent };
        });

      return [...prev, ...newOnes];
    });
  }, [reactions]);

  // Clean up each reaction after 2800ms
  useEffect(() => {
    if (items.length === 0) return;

    const timer = setTimeout(() => {
      const now = Date.now();
      setItems((prev) => {
        const remaining = prev.filter((item) => now - item.reaction.timestamp < 2800);
        return remaining;
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [items]);

  if (items.length === 0) return null;

  return (
    <div
      id="floating-reactions-layer"
      data-testid="floating-reactions-layer"
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
      aria-live="polite"
      aria-atomic="true"
    >
      {items.map(({ reaction, leftPercent }) => (
        <div
          key={reaction.id}
          className="absolute bottom-20 flex flex-col items-center animate-float-reaction"
          style={{
            left: `${leftPercent}%`,
          }}
        >
          <span className="text-4xl sm:text-5xl filter drop-shadow-lg select-none transform hover:scale-125 transition-transform">
            {reaction.emoji}
          </span>
          <span className="text-[10px] font-bold text-white/90 bg-slate-950/80 px-2 py-0.5 rounded-full border border-white/10 mt-1 shadow-md truncate max-w-[100px]">
            {reaction.senderName}
          </span>
        </div>
      ))}
    </div>
  );
};

import React from 'react';
import { UserTier, TIER_LIMITS } from '../types';

interface UsageBannerProps {
  tier: UserTier;
  count: number;
}

export default function UsageBanner({ tier, count }: UsageBannerProps) {
  const limit = TIER_LIMITS[tier];
  if (!isFinite(limit)) return null; // paid / admin — no banner

  const remaining = Math.max(0, limit - count);
  const ratio = count / limit;
  const isLow = remaining <= 2;
  const isExhausted = remaining === 0;

  return (
    <div className={`mx-3 mb-2 px-4 py-2 rounded-xl flex items-center gap-3 text-xs border transition-colors
      ${isExhausted
        ? 'bg-red-500/10 border-red-500/20 text-red-400'
        : isLow
          ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
          : 'bg-white/5 border-white/10 text-white/40'
      }`}
    >
      {/* Progress bar */}
      <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300
            ${isExhausted ? 'bg-red-400' : isLow ? 'bg-amber-400' : 'bg-emerald-400/60'}`}
          style={{ width: `${Math.min(ratio * 100, 100)}%` }}
        />
      </div>

      {/* Count text */}
      <span className="font-medium whitespace-nowrap shrink-0">
        {isExhausted
          ? '오늘 한도 초과'
          : `오늘 ${count}/${limit}회`}
      </span>
    </div>
  );
}

import React from 'react';
import { User } from 'firebase/auth';
import { LogOut } from 'lucide-react';
import { useI18n } from '../contexts/I18nContext';

interface ProfileSectionProps {
  user: User | null;
  onSignOut: () => Promise<void>;
}

export default function ProfileSection({ user, onSignOut }: ProfileSectionProps) {
  const { t } = useI18n();
  if (!user) return null;

  return (
    <div className="px-1 py-1">
      {/* User info row */}
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10">
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.displayName ?? 'Profile'}
            className="w-7 h-7 rounded-full border border-white/20 object-cover shrink-0"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-emerald-500/30 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-black text-emerald-400">
              {user.displayName?.[0] ?? user.email?.[0] ?? 'A'}
            </span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-white/80 truncate leading-tight">
            {user.displayName ?? 'ARHA User'}
          </p>
          <p className="text-[9px] text-white/30 truncate leading-tight font-medium">
            {user.email}
          </p>
        </div>
      </div>

      {/* Sign out button */}
      <button
        onClick={onSignOut}
        className="w-full mt-1.5 flex items-center gap-3 px-3 py-2.5 rounded-xl text-[11px] font-bold text-white/40 hover:text-red-400 hover:bg-red-500/10 active:bg-red-500/10 transition-all"
      >
        <LogOut size={13} className="shrink-0" />
        {t.signOut}
      </button>
    </div>
  );
}

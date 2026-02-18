
import React from 'react';
import { X } from 'lucide-react';

interface GlassSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  side: 'left' | 'right';
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

const GlassSidebar: React.FC<GlassSidebarProps> = ({ isOpen, onClose, side, title, icon, children }) => {
  const sideClasses = side === 'left'
    ? `left-0 border-r ${isOpen ? 'translate-x-0' : '-translate-x-full'}`
    : `right-0 border-l ${isOpen ? 'translate-x-0' : 'translate-x-full'}`;

  return (
    <>
      {/* Overlay (항상 렌더, isOpen일 때만 표시) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[55] bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Sidebar Body - 항상 fixed overlay, 채팅창 너비 영향 없음 */}
      <aside className={`fixed inset-y-0 z-[60] w-[280px] md:w-[300px] flex flex-col arha-sidebar-bg border-white/10 shadow-2xl h-full overflow-hidden transition-transform duration-500 ease-out-expo ${sideClasses}`}>
        <header className="h-16 px-6 border-b border-white/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 text-emerald-400">
            {icon}
            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/90">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all active:scale-95"
          >
            <X size={20} />
          </button>
        </header>
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </aside>
    </>
  );
};

export default GlassSidebar;

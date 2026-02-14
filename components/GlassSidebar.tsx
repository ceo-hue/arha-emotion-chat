
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
  if (!isOpen) return null;

  const sideClasses = side === 'left' 
    ? 'left-0 border-r animate-in slide-in-from-left duration-500 ease-out-expo' 
    : 'right-0 border-l animate-in slide-in-from-right duration-500 ease-out-expo';

  return (
    <>
      {/* Overlay for mobile/tablet */}
      <div 
        className="fixed inset-0 z-[55] bg-black/40 backdrop-blur-sm lg:hidden" 
        onClick={onClose} 
      />
      
      {/* Sidebar Body */}
      <aside className={`fixed lg:static inset-y-0 z-[60] w-[280px] md:w-[300px] flex flex-col arha-sidebar-bg border-white/10 shadow-2xl h-full overflow-hidden ${sideClasses}`}>
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

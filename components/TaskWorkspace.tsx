
import React from 'react';
import { X, Maximize2, Download, Copy, Play, Eye, Code, ImageIcon, Video } from 'lucide-react';
import { Message, TaskType } from '../types';

interface TaskWorkspaceProps {
  type: TaskType;
  activeData: any;
  onClose: () => void;
}

const TaskWorkspace: React.FC<TaskWorkspaceProps> = ({ type, activeData, onClose }) => {
  if (type === 'none') return null;

  const renderContent = () => {
    switch (type) {
      case 'photo':
        return (
          <div className="flex flex-col h-full animate-in fade-in zoom-in-95 duration-500">
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="relative group">
                <img
                  src={activeData?.media?.url}
                  className="max-w-full max-h-[70vh] rounded-[2rem] shadow-xl border-4 border-black/10 dark:border-white/40 object-contain"
                  alt="Workspace Preview"
                />
                <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-all rounded-[2rem] flex items-center justify-center backdrop-blur-[1px]">
                  <button className="p-4 bg-white shadow-xl rounded-full text-indigo-600 hover:scale-110 active:scale-90 transition-transform">
                    <Maximize2 size={24} />
                  </button>
                </div>
              </div>
            </div>
            <div className="p-5 bg-black/5 dark:bg-white/20 border-t border-black/10 dark:border-white/30 backdrop-blur-3xl">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Archive</h4>
                  <p className="text-[9px] text-slate-600 dark:text-white/60 font-black uppercase tracking-widest opacity-60">High-Def</p>
                </div>
                <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-[11px] font-black uppercase text-white shadow-lg active:scale-95 transition-all">
                  <Download size={14} /> Save
                </button>
              </div>
            </div>
          </div>
        );

      case 'video':
        return (
          <div className="flex flex-col h-full animate-in slide-in-from-right-10 duration-500">
            <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6">
              {activeData?.isGeneratingVideo ? (
                <div className="flex flex-col items-center text-center space-y-6">
                  <div className="relative w-28 h-28">
                    <div className="absolute inset-0 border-6 border-indigo-200/30 dark:border-indigo-100/30 rounded-full" />
                    <div className="absolute inset-0 border-6 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <div className="absolute inset-4 bg-black/5 dark:bg-white/40 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg">
                      <Video className="text-indigo-600 animate-pulse" size={28} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tighter">Cinema Render</h3>
                    <p className="text-[11px] text-slate-600 dark:text-white/60 font-medium max-w-[200px]">대화 속 아침을 영상으로 빚어내고 있어요.</p>
                  </div>
                </div>
              ) : (
                <video 
                  src={activeData?.media?.url} 
                  controls 
                  autoPlay
                  className="w-full rounded-[2rem] shadow-xl border-4 border-black/10 dark:border-white/40 aspect-video bg-black"
                />
              )}
            </div>
            <div className="p-6 bg-black/5 dark:bg-white/20 border-t border-black/10 dark:border-white/30 backdrop-blur-3xl">
              <div className="flex items-center justify-between text-[10px] text-slate-700 dark:text-white/70 font-black uppercase tracking-widest">
                <span className="flex items-center gap-1.5"><Play size={12} className="text-indigo-600" /> Presentation</span>
                <span className="opacity-40">Dynamics v1.0</span>
              </div>
            </div>
          </div>
        );

      case 'code':
        return (
          <div className="flex flex-col h-full animate-in fade-in duration-400">
            <div className="flex-1 overflow-y-auto p-5 font-mono text-[13px]">
              <div className="bg-black/5 dark:bg-white/40 backdrop-blur-3xl rounded-3xl border border-black/10 dark:border-white/60 overflow-hidden shadow-lg">
                <div className="px-4 py-2.5 bg-black/5 dark:bg-white/60 border-b border-black/10 dark:border-white/40 flex items-center justify-between">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  </div>
                  <button className="text-slate-400 dark:text-white/40 hover:text-indigo-600 dark:hover:text-indigo-300 transition-all">
                    <Copy size={16} />
                  </button>
                </div>
                <pre className="p-5 text-indigo-950 dark:text-indigo-200 overflow-x-auto selection:bg-indigo-100 dark:selection:bg-indigo-800/40">
                  <code className="leading-relaxed">{activeData?.content}</code>
                </pre>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const getHeaderInfo = () => {
    switch(type) {
      case 'photo': return { icon: <ImageIcon size={18} className="text-sky-500" />, title: 'Studio' };
      case 'video': return { icon: <Video size={18} className="text-orange-500" />, title: 'Cinema' };
      case 'code': return { icon: <Code size={18} className="text-emerald-500" />, title: 'Code' };
      default: return { icon: null, title: '' };
    }
  };

  const header = getHeaderInfo();

  return (
    <div className="h-full flex flex-col bg-black/5 dark:bg-white/10 backdrop-blur-[80px]">
      <header className="px-5 py-4 border-b border-black/10 dark:border-white/20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-black/5 dark:bg-white/40 rounded-xl border border-black/10 dark:border-white/50">{header.icon}</div>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-white">{header.title}</h3>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-black/10 dark:hover:bg-white/40 rounded-full text-slate-400 dark:text-white/40 hover:text-slate-900 dark:hover:text-white transition-all active:scale-90">
          <X size={20} />
        </button>
      </header>
      <div className="flex-1 overflow-hidden">
        {renderContent()}
      </div>
    </div>
  );
};

export default TaskWorkspace;

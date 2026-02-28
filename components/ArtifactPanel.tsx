import React, { useState } from 'react';
import { ArtifactContent } from '../types';
import { X, Copy, Check, Code2, BarChart3, Layout, GitCompare } from 'lucide-react';

interface ArtifactPanelProps {
  artifact: ArtifactContent;
  onClose: () => void;
}

const TYPE_META = {
  analysis: { icon: BarChart3, label: 'Analysis', color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
  code:     { icon: Code2,     label: 'Code',     color: 'text-sky-400',    bg: 'bg-sky-500/10 border-sky-500/20' },
  structure:{ icon: Layout,    label: 'Structure', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  comparison:{ icon: GitCompare, label: 'Comparison', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
};

const CodeBlock: React.FC<{ lang: string; content: string }> = ({ lang, content }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative rounded-xl overflow-hidden border border-black/10 dark:border-white/10 mt-2">
      <div className="flex items-center justify-between px-3 py-1.5 bg-black/5 dark:bg-white/5 border-b border-black/10 dark:border-white/10">
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-white/40">{lang}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1 text-[9px] text-slate-400 dark:text-white/30 hover:text-slate-700 dark:hover:text-white/70 transition-all"
        >
          {copied ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="px-4 py-3 text-[11px] leading-relaxed text-slate-700 dark:text-white/75 overflow-x-auto font-mono bg-slate-100/60 dark:bg-black/30">
        <code>{content}</code>
      </pre>
    </div>
  );
};

const ArtifactPanel: React.FC<ArtifactPanelProps> = ({ artifact, onClose }) => {
  const meta = TYPE_META[artifact.type] ?? TYPE_META.analysis;
  const Icon = meta.icon;

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <header className="h-12 md:h-16 px-4 md:px-5 border-b border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 backdrop-blur-xl flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest shrink-0 ${meta.bg} ${meta.color}`}>
            <Icon size={10} />
            {meta.label}
          </div>
          <h3 className="text-[12px] font-bold text-slate-700 dark:text-white/80 truncate">{artifact.title}</h3>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 dark:text-white/40 hover:text-slate-700 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 active:bg-black/10 dark:active:bg-white/20 transition-all shrink-0 ml-2"
        >
          <X size={16} />
        </button>
      </header>

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4 scroll-hide">
        {artifact.sections.map((section, i) => (
          <div key={i} className="space-y-2">
            {section.heading && (
              <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-white/40 border-b border-black/10 dark:border-white/10 pb-1">
                {section.heading}
              </h4>
            )}
            {section.body && (
              <p className="text-[13px] text-slate-600 dark:text-white/70 leading-relaxed whitespace-pre-wrap">
                {section.body}
              </p>
            )}
            {section.code && (
              <CodeBlock lang={section.code.lang} content={section.code.content} />
            )}
          </div>
        ))}

        {/* 모드 태그 */}
        <div className="flex items-center gap-2 pt-2 border-t border-black/10 dark:border-white/10">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-300 dark:text-white/20">P_MODE</span>
          <div className="w-1.5 h-1.5 rounded-full bg-violet-500/60" />
          <span className="text-[9px] text-slate-300 dark:text-white/20">PROMETHEUS Active</span>
        </div>
      </div>
    </div>
  );
};

export default React.memo(ArtifactPanel);

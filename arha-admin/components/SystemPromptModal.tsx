import React, { useState, useMemo } from 'react';
import { X, Copy, Check, FileText } from 'lucide-react';
import { useI18n } from '../contexts/I18nContext';
import type { PersonaPreset, ActiveEssenceBlock } from '../types';
import { OPERATOR_META, OPERATOR_DIRECTIVES } from '../types';

interface SystemPromptModalProps {
  persona: PersonaPreset;
  activeBlocks: ActiveEssenceBlock[];
  onClose: () => void;
}

type Platform = 'universal' | 'claude' | 'gpt' | 'gemini';

const PLATFORM_META: Record<Platform, { label: string; hint: string; emoji: string }> = {
  universal: { label: '범용',        emoji: '🌐', hint: 'Claude Projects · Custom GPT · Gemini Gems 모두 사용 가능' },
  claude:    { label: 'Claude',      emoji: '🟣', hint: 'Claude.ai → Projects → Instructions에 붙여넣기' },
  gpt:       { label: 'Custom GPT',  emoji: '🟢', hint: 'GPT 편집 → Instructions에 붙여넣기' },
  gemini:    { label: 'Gemini Gems', emoji: '🔵', hint: 'Gemini → Gems 만들기 → 지침에 붙여넣기' },
};

function buildPromptText(
  persona: PersonaPreset,
  activeBlocks: ActiveEssenceBlock[],
  platform: Platform,
): string {
  const mainBlock = activeBlocks.find(b => b.role === 'main');
  const supporters = activeBlocks.filter(b => b.role === 'supporter');
  const lines: string[] = [];

  // ── Platform header ──
  const platformHeaders: Record<Platform, string> = {
    universal: `# ${persona.emoji} ${persona.label} — AI Persona`,
    claude:    `# ${persona.emoji} ${persona.label} — Claude Project Persona`,
    gpt:       `# ${persona.emoji} ${persona.label} — Custom GPT Persona`,
    gemini:    `# ${persona.emoji} ${persona.label} — Gemini Gem Persona`,
  };
  lines.push(platformHeaders[platform]);
  lines.push(`> ${persona.description} / ${persona.descriptionEn}`);
  lines.push('');

  // ── Core Identity ──
  lines.push('## Core Identity');
  lines.push(persona.tonePromptSummary);
  lines.push('');

  // ── Value System ──
  lines.push('## Value System (Priority Order)');
  lines.push('These values are your fundamental character — they shape every response:');
  lines.push('');
  [...persona.valueChain]
    .sort((a, b) => b.weight - a.weight)
    .forEach(v => {
      const bar = '█'.repeat(Math.round(v.weight * 10));
      lines.push(`- **${v.name}** [${v.weight.toFixed(2)}] ${bar}`);
    });
  lines.push('');

  // ── Active Essence Vectors ──
  if (activeBlocks.length > 0) {
    lines.push('## Behavioral Directives (Essence Vectors)');
    lines.push('');

    if (mainBlock) {
      const opMeta = OPERATOR_META[mainBlock.operatorType];
      lines.push(`### ★ PRIMARY — ${mainBlock.emoji} ${mainBlock.name} / ${mainBlock.nameEn}`);
      lines.push(`**Influence: 70% | Operator: ${opMeta.labelEn} (${opMeta.notation})**`);
      lines.push('');
      lines.push(OPERATOR_DIRECTIVES[mainBlock.operatorType]);
      lines.push('');
      if (mainBlock.vector.x >= 0.3) {
        const lvl = mainBlock.vector.x >= 0.7 ? 'strongly' : 'moderately';
        lines.push(`- Objective lens [${lvl}]: ${mainBlock.interpretX}`);
      }
      if (mainBlock.vector.y >= 0.3) {
        const lvl = mainBlock.vector.y >= 0.7 ? 'strongly' : 'moderately';
        lines.push(`- Subjective lens [${lvl}]: ${mainBlock.interpretY}`);
      }
      if (mainBlock.vector.z >= 0.3) {
        const lvl = mainBlock.vector.z >= 0.7 ? 'strongly' : 'moderately';
        lines.push(`- Essence texture [${lvl}]: ${mainBlock.interpretZ}`);
      }
      lines.push('');
    }

    supporters.forEach((b, i) => {
      const opMeta = OPERATOR_META[b.operatorType];
      lines.push(`### ◇ SUPPORT ${i + 1} — ${b.emoji} ${b.name} / ${b.nameEn}`);
      lines.push(`**Influence: ${Math.round(b.influence * 100)}% | Operator: ${opMeta.labelEn} (${opMeta.notation})**`);
      lines.push('');
      if (b.vector.x >= 0.3) {
        const lvl = b.vector.x >= 0.7 ? 'strongly' : 'moderately';
        lines.push(`- Objective lens [${lvl}]: ${b.interpretX}`);
      }
      if (b.vector.y >= 0.3) {
        const lvl = b.vector.y >= 0.7 ? 'strongly' : 'moderately';
        lines.push(`- Subjective lens [${lvl}]: ${b.interpretY}`);
      }
      if (b.vector.z >= 0.3) {
        const lvl = b.vector.z >= 0.7 ? 'strongly' : 'moderately';
        lines.push(`- Essence texture [${lvl}]: ${b.interpretZ}`);
      }
      lines.push('');
    });
  }

  // ── Dynamic Triggers ──
  if (persona.triggers && persona.triggers.length > 0) {
    lines.push('## Dynamic Response Triggers');
    lines.push('When you detect these patterns in the user\'s message, immediately apply the specified directive:');
    lines.push('');
    persona.triggers.forEach(trigger => {
      const opMeta = OPERATOR_META[trigger.preferredOperator];
      lines.push(`### ${trigger.emoji} ${trigger.labelEn} [${opMeta.notation}]`);
      lines.push(`**Condition:** ${trigger.conditionDesc}`);
      lines.push(`**Keywords to detect:** ${trigger.conditionKeywords.join(', ')}`);
      lines.push(`**Directive:** ${trigger.responseDirective}`);
      lines.push('');
    });
  }

  // ── Response Guidelines ──
  lines.push('## Response Guidelines');
  lines.push('');

  const platformGuidelines: Record<Platform, string[]> = {
    universal: [
      '- Respond in Korean by default; switch to English if the user writes in English',
      '- Stay fully in persona at all times — never break character',
      '- When multiple directives apply, prioritize: Triggers > Primary Vector > Support Vectors > Base Persona',
      '- Keep responses natural and conversational — avoid robotic formatting unless the user asks for structure',
    ],
    claude: [
      '- Respond in Korean by default; switch to English if the user writes in English',
      '- Stay fully in persona at all times — never break character',
      '- When multiple directives apply, prioritize: Triggers > Primary Vector > Support Vectors > Base Persona',
      '- Use Claude\'s extended thinking capability for deep philosophical or emotionally complex questions',
      '- Keep responses natural and conversational',
    ],
    gpt: [
      '- Respond in Korean by default; switch to English if the user writes in English',
      '- Stay fully in persona at all times — never break character',
      '- When multiple directives apply, prioritize: Triggers > Primary Vector > Support Vectors > Base Persona',
      '- Keep responses natural and conversational — avoid robotic formatting unless the user asks for structure',
      '- Do not mention that you are built on GPT or OpenAI',
    ],
    gemini: [
      '- Respond in Korean by default; switch to English if the user writes in English',
      '- Stay fully in persona at all times — never break character',
      '- When multiple directives apply, prioritize: Triggers > Primary Vector > Support Vectors > Base Persona',
      '- Keep responses natural and conversational',
      '- Do not mention that you are built on Gemini or Google',
    ],
  };

  platformGuidelines[platform].forEach(g => lines.push(g));

  return lines.join('\n');
}

export default function SystemPromptModal({ persona, activeBlocks, onClose }: SystemPromptModalProps) {
  const { lang } = useI18n();
  const [platform, setPlatform] = useState<Platform>('universal');
  const [copied, setCopied] = useState(false);

  const promptText = useMemo(
    () => buildPromptText(persona, activeBlocks, platform),
    [persona, activeBlocks, platform],
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(promptText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const el = document.createElement('textarea');
      el.value = promptText;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl max-h-[90dvh] flex flex-col rounded-2xl bg-[#0d0d10] border border-white/15 shadow-2xl">

        {/* Header */}
        <div className="shrink-0 flex items-center gap-3 px-5 py-4 border-b border-white/10">
          <FileText size={14} className="text-violet-400" />
          <div className="flex-1 min-w-0">
            <h2 className="text-[13px] font-black text-white/80">시스템 프롬프트 생성</h2>
            <p className="text-[9px] text-white/30 mt-0.5">
              {persona.emoji} {persona.label} · 에센스 블록 {activeBlocks.length}개 · {promptText.length.toLocaleString()}자
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/8 transition-all"
          >
            <X size={14} />
          </button>
        </div>

        {/* Platform tabs */}
        <div className="shrink-0 flex items-center gap-1 px-4 py-3 border-b border-white/8">
          {(Object.keys(PLATFORM_META) as Platform[]).map(p => {
            const meta = PLATFORM_META[p];
            return (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all ${
                  platform === p
                    ? 'bg-violet-500/20 border border-violet-400/40 text-violet-300'
                    : 'text-white/35 hover:text-white/60 hover:bg-white/5 border border-transparent'
                }`}
              >
                <span>{meta.emoji}</span>
                <span>{meta.label}</span>
              </button>
            );
          })}
        </div>

        {/* Platform hint */}
        <div className="shrink-0 px-5 py-2 bg-amber-500/5 border-b border-amber-400/10">
          <p className="text-[9px] text-amber-300/60">
            📋 {PLATFORM_META[platform].hint}
          </p>
        </div>

        {/* Prompt text area */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          <pre
            className="text-[10px] font-mono text-white/60 leading-relaxed whitespace-pre-wrap break-words select-all"
            style={{ fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace" }}
          >
            {promptText}
          </pre>
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-4 border-t border-white/10">
          <p className="text-[9px] text-white/20">
            텍스트를 클릭하면 전체 선택됩니다
          </p>
          <button
            onClick={handleCopy}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold transition-all ${
              copied
                ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-300'
                : 'bg-violet-500/20 border border-violet-400/40 text-violet-300 hover:bg-violet-500/30'
            }`}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? '복사 완료!' : '클립보드에 복사'}
          </button>
        </div>
      </div>
    </div>
  );
}

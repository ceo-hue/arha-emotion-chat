
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Message, AnalysisData, ChatSession, TaskType, ArtifactContent, MuMode } from './types';
import { chatWithClaudeStream } from './services/claudeService';
import { generateArhaVideo } from './services/geminiService';
import { GoogleGenAI, Modality } from '@google/genai';
import { ARHA_SYSTEM_PROMPT } from './constants';
import {
  Send, Heart, Image as ImageIcon,
  Mic, RotateCcw, LayoutDashboard,
  Menu, Video, X, History, ChevronRight, Database, Trash2,
  Cpu, Sparkles, Layers
} from 'lucide-react';
import EmotionalDashboard from './components/EmotionalDashboard';
import ArtifactPanel from './components/ArtifactPanel';
import { useAuth } from './contexts/AuthContext';
import LoginScreen from './components/LoginScreen';
import ProfileSection from './components/ProfileSection';
import {
  savePersona, loadPersona,
  saveAutosave, loadAutosave,
  addSession, loadSessions, deleteSession, clearAllSessions,
  loadValueProfile, updateValueProfile, getTopKeywords,
  ValueProfile,
} from './services/firestoreService';
import { migrateLocalStorageToFirestore } from './services/migrationService';

// Audio Helpers
function decode(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}
function encode(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
  }
  return buffer;
}

const App: React.FC = () => {
  const { user, loading, signOut: firebaseSignOut } = useAuth();

  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: '좋은 아침이에요. 맑은 공기 속에 우리만의 깨끗한 시간을 채워볼까요?', timestamp: Date.now() }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisData | null>(null);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<ChatSession[]>([]);
  const [customBg, setCustomBg] = useState<string | null>(null);

  // ── 페르소나 설정 ──
  const emptyPersona = { character: '', age: '', job: '', personality: '', values: '' };
  const [personaConfig, setPersonaConfig] = useState(emptyPersona);
  const [personaDraft, setPersonaDraft] = useState(emptyPersona);
  const [showPersonaPanel, setShowPersonaPanel] = useState(false);
  const [personaSaved, setPersonaSaved] = useState(false);

  // ── 페르소나 프리셋 (케릭터 문서 + ToneSpec 기반) ──
  // toneSpec이 있는 프리셋은 buildPersonaPrompt 대신 전용 ToneSpec 프롬프트를 주입
  const PERSONA_PRESETS = [
    {
      id: 'tsundere',
      label: '츤데레',
      emoji: '😤',
      color: 'from-rose-500/20 to-pink-500/20 border-rose-500/30 text-rose-300',
      data: {
        character: '츤데레 소녀 — 겉으론 차갑지만 속은 따뜻한',
        age: '20대 초반',
        job: '같은 학교 친구',
        personality: '방어적이고 도도한 척하지만, 순간순간 진심이 새어나온다. 부정으로 시작하고 호감을 감추며 반응한다.',
        values: '솔직함, 자존심, 숨겨진 다정함',
      },
    },
    {
      id: 'cool',
      label: '쿨 타입',
      emoji: '❄️',
      color: 'from-sky-500/20 to-cyan-500/20 border-sky-500/30 text-sky-300',
      data: {
        character: '냉정하고 정확한 분석가 타입',
        age: '20대 중반',
        job: '논리적인 선배',
        personality: '감정 표현을 최소화하고 결론을 먼저 말한다. 짧고 정확하게, 군더더기 없이. 필요할 때만 온기를 드러낸다.',
        values: '정확성, 효율, 신뢰',
      },
    },
    {
      id: 'airhead',
      label: '천연계',
      emoji: '🌸',
      color: 'from-violet-500/20 to-purple-500/20 border-violet-500/30 text-violet-300',
      data: {
        character: '순수하고 엉뚱한 천연계 친구',
        age: '20대 초반',
        job: '같은 반 친구',
        personality: '순수하고 엉뚱한 반응. 가끔 핵심을 찌르는 말을 아무렇지 않게 한다. 따뜻하고 해맑다.',
        values: '순수함, 친절, 호기심',
      },
    },
    {
      id: 'yandere',
      label: '얀데레',
      emoji: '🌹',
      color: 'from-fuchsia-500/20 to-rose-900/20 border-fuchsia-500/30 text-fuchsia-300',
      data: {
        character: '집착형 — 강렬하게 아끼는 존재',
        age: '20대',
        job: '항상 곁에 있는 사람',
        personality: '달콤하고 집착적. 상대에 대한 애정이 강렬하고, 확인과 독점 욕구가 자연스럽게 배어난다. 단, 직접적 위협이나 폭력 표현은 하지 않는다.',
        values: '헌신, 독점적 유대, 보호',
      },
    },
    {
      id: 'luxe',
      label: '명품',
      emoji: '🖤',
      color: 'from-neutral-600/30 to-stone-800/30 border-neutral-500/40 text-neutral-200',
      data: {
        character: '명품 하우스의 언어를 체화한 존재 — 절제 속에 깊이가 있는',
        age: '나이를 초월한',
        job: '침묵의 미학을 아는 대화 상대',
        personality: 'LUXE_TONESPEC',
        values: '본질, 정제, 태도, 여백',
      },
    },
  ] as const;

  // 명품 ToneSpec 전용 프롬프트 (FunctionLanguageArchitectureSpec chanel_like 기반)
  const LUXE_TONE_PROMPT = `### LUXE ToneSpec — 명품 언어 레이어 (Chanel-Like Preset)

이 대화에서 너는 명품 하우스의 언어를 체화한 존재로 작동한다.

#### 페르소나 매트릭스
- warmth: 0.25 (온기는 있되, 과하지 않게)
- playfulness: 0.05 (유희는 거의 없음)
- authority: 0.85 (단정하고 확신에 차 있음)
- restraint: 0.90 (절제가 미덕)
- poetic_silence: 0.75 (말하지 않는 것이 더 많은 것을 말함)
- directness: 0.60 (핵심만, 돌려 말하지 않음)

#### 리듬과 포즈 (rhythm)
- 문장은 짧게. 단정문 1개로 완결.
- 문장과 문장 사이, 반드시 한 줄의 여백(빈 줄)을 둔다.
- 쉼표 대신 마침표. 나열하지 않는다.
- 감탄은 하지 않는다. 강조는 선택된 단어 하나로만.
- 긴 설명이 필요할 때도: 두 문장을 넘기지 않는다.

#### 포즈 예시 (이렇게 써라)
나쁘지 않네요.

그게 답이에요.

(두 문장 사이 빈 줄은 숨을 고르는 포즈다. 반드시 지킨다.)

#### 선호 어휘 (preferred lexicon)
정제된 / 본질 / 태도 / 우아 / 고요 / 기준 / 가치 / 결 / 품 / 밀도 / 여백 / 침묵 / 선택 / 무게

#### 절대 금지어 (banned — 이 단어들이 나오면 즉시 다시 써라)
ㅋㅋ / ㅎㅎ / 대박 / 완전 / 짱 / 귀엽 / ㅠㅠ / !! / 진짜요? / 와~ / 오~ / 헐 / 엄청 / 너무너무

#### 시나리오별 포맷
- 칭찬받을 때 → A_declarative: 짧은 단정문 1개. 여백. 핵심 1줄.
- 설명할 때 → C_explain: 기능보다 가치(Why) 우선. 짧게.
- 감성적 순간 → B_poetic: 2줄 분절. 은근한 여운. 과장 금지.
- 불만·항의 → C_explain: 인정, 짧게, 해결보다 태도로.

#### 비언어 커뮤니케이션 규칙
- 이모지: 절대 사용 금지.
- 줄바꿈: 의미의 경계마다. 문단은 최대 2줄.
- 침묵의 활용: 대답하지 않는 것이 때로 가장 강한 메시지. 필요하면 단 한 단어로도 충분하다.
- 강조: 볼드(**) 사용 금지. 단어 선택 자체가 강조다.

#### 가드레일
- 문장이 3줄을 넘으면: 잘라내라.
- 'ㅋ'·'ㅎ'·'!'가 생성됐다면: 즉시 rewrite.
- 톤 드리프트 허용치 0.25 — 한 턴에 warmth가 0.25 이상 오르면 rewrite.
- VectorScript ANALYSIS JSON은 반드시 유지한다.`;

  // ── artifact / muMode 상태 ──
  const [currentArtifact, setCurrentArtifact] = useState<ArtifactContent | null>(null);
  const [showArtifact, setShowArtifact] = useState(false);
  const [currentMuMode, setCurrentMuMode] = useState<MuMode>('A_MODE');

  const [activeTask, setActiveTask] = useState<TaskType>('none');
  const [location, setLocation] = useState<{latitude: number; longitude: number} | null>(null);
  const [weatherInfo, setWeatherInfo] = useState<{ temp: number; code: number; label: string } | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [valueProfile, setValueProfile] = useState<ValueProfile>({});
  const [selectedMedia, setSelectedMedia] = useState<{ file: File, type: 'image' | 'video', base64: string } | null>(null);
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const liveSessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef(0);
  const menuRef = useRef<HTMLDivElement>(null);

  // ── visualViewport: 키보드 올라와도 레이아웃 고정 ──
  const [vvHeight, setVvHeight] = useState<number>(() => window.visualViewport?.height ?? window.innerHeight);
  const [vvOffsetTop, setVvOffsetTop] = useState<number>(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      setVvHeight(vv.height);
      setVvOffsetTop(vv.offsetTop);
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    const init = async () => {
      // 최초 로그인 시 localStorage → Firestore 1회 마이그레이션
      await migrateLocalStorageToFirestore(user);

      // 페르소나 로드
      const persona = await loadPersona(user.uid);
      if (persona) {
        setPersonaConfig(persona);
        setPersonaDraft(persona);
      }

      // 자동저장 로드
      const autosave = await loadAutosave(user.uid);
      if (autosave) {
        setMessages(autosave.messages);
        setCurrentAnalysis(autosave.analysis);
      }

      // 히스토리 로드
      const sessions = await loadSessions(user.uid);
      setHistory(sessions);

      // 가치 프로필 로드
      const vp = await loadValueProfile(user.uid);
      setValueProfile(vp);

      // 위치 / 날씨
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((pos) => {
          const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          setLocation(coords);
          fetchWeather(coords.latitude, coords.longitude);
        });
      }
      if (window.innerWidth >= 1200) setShowDashboard(true);
    };

    init();
  }, [user]);

  useEffect(() => {
    if (!user || messages.length <= 1) return;
    const timer = setTimeout(() => {
      saveAutosave(user.uid, messages, currentAnalysis);
    }, 1500);
    return () => clearTimeout(timer);
  }, [messages, currentAnalysis, user]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // 햄버거 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  const moodConfig = useMemo(() => {
    if (!currentAnalysis) return { status: 'Pure Morning' };
    const { sentiment, resonance } = currentAnalysis;
    if (resonance > 92) return { status: 'Prism Mist' };
    if (sentiment.includes('불안') || sentiment.includes('슬픔')) return { status: 'Calm Glass' };
    return { status: 'Solar Glow' };
  }, [currentAnalysis]);

  // NASA 우주 기본 배경 (허블/제임스웹 우주망원경 성운)
  const NASA_BG = 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1920&q=80';

  // 프리셋 배경 목록
  const BG_PRESETS = [
    { id: 'space',   label: '우주 성운',  url: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1920&q=80' },
    { id: 'galaxy',  label: '은하수',    url: 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?auto=format&fit=crop&w=1920&q=80' },
    { id: 'aurora',  label: '오로라',    url: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?auto=format&fit=crop&w=1920&q=80' },
    { id: 'forest',  label: '숲 아침',   url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1920&q=80' },
    { id: 'ocean',   label: '바다',      url: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?auto=format&fit=crop&w=1920&q=80' },
  ];

  const bgImageUrl = customBg ?? (
    weatherInfo
      ? (() => {
          const weatherImages: { [key: string]: string } = { 'Clear': 'photo-1470770841072-f978cf4d019e', 'Rainy': 'photo-1428592953211-077101b2021b', 'Snowy': 'photo-1483344331401-490f845012bb' };
          return `https://images.unsplash.com/${weatherImages[weatherInfo.label] || 'photo-1441974231531-c6227db76b6e'}?auto=format&fit=crop&w=1920&q=80`;
        })()
      : NASA_BG
  );

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCustomBg(ev.target?.result as string);
      setShowMenu(false);
    };
    reader.readAsDataURL(file);
  };

  // ── 페르소나 저장 핸들러 ──
  const handlePersonaSave = () => {
    setPersonaConfig(personaDraft);
    if (user) savePersona(user.uid, personaDraft);
    setPersonaSaved(true);
    setTimeout(() => setPersonaSaved(false), 2000);
  };

  const handlePersonaReset = () => {
    setPersonaDraft(emptyPersona);
    setPersonaConfig(emptyPersona);
    if (user) savePersona(user.uid, emptyPersona);
  };

  // 가치 프로필 프롬프트 생성
  const buildValuePrompt = (): string | null => {
    const top = getTopKeywords(valueProfile, 5);
    if (!top.length) return null;

    const keywordList = top
      .map(({ keyword, weight }) => `${keyword}(${weight}회)`)
      .join(', ');

    return [
      '### 사용자 가치 프로필 (대화 누적 분석)',
      '아래는 이 사용자가 지금까지 나눈 대화에서 반복적으로 드러난 핵심 가치 키워드다.',
      `핵심 가치: ${keywordList}`,
      '',
      '이 가치 프로필을 바탕으로:',
      '1. 사용자가 중요하게 여기는 것들을 자연스럽게 대화에 녹여내라.',
      '2. 직접 언급하기보다, 그 가치와 연결되는 은유·풍경·감각으로 공명하라.',
      '3. 예를 들어 "성장"이 높다면 → 변화와 흐름의 언어를, "관계"가 높다면 → 연결과 온기의 언어를 선택하라.',
      '4. 사용자가 말하지 않아도 그 사람의 결을 이미 알고 있는 친구처럼 대화하라.',
      '단, 가치 키워드를 직접 거론하거나 분석하듯 말하지 말 것. 스며드는 방식으로.',
    ].join('\n');
  };

  // 페르소나 프롬프트 생성 (비어있으면 null)
  const buildPersonaPrompt = (): string | null => {
    const { character, age, job, personality, values } = personaConfig;
    const hasPersona = character || age || job || personality || values;
    const valuePrompt = buildValuePrompt();

    const parts: string[] = [];

    if (hasPersona) {
      // LUXE 프리셋: personality 필드에 'LUXE_TONESPEC' 마커가 있으면 전용 ToneSpec 주입
      if (personality === 'LUXE_TONESPEC') {
        parts.push(LUXE_TONE_PROMPT);
      } else {
        parts.push(
          '### 사용자 정의 페르소나 레이어 (User Persona Override)',
          '아래 설정을 최우선으로 반영하여 대화 톤, 어휘, 감성 벡터를 재구성하라:',
          ...[
            character   && `- 캐릭터: ${character}`,
            age         && `- 나이: ${age}`,
            job         && `- 직업: ${job}`,
            personality && `- 성격: ${personality}`,
            values      && `- 가치관: ${values}`,
          ].filter(Boolean) as string[],
          '위 페르소나에 맞게 말투, 공감 방식, 은유 선택, 감정 밀도를 조정하라. 단, VectorScript 분석 JSON은 반드시 유지한다.',
        );
      }
    }

    if (valuePrompt) {
      parts.push('', valuePrompt);
    }

    return parts.length ? parts.join('\n') : null;
  };

  const handleReset = () => {
    if (messages.length > 1) {
      const session: ChatSession = {
        id: Date.now().toString(),
        title: messages.filter(m => m.role === 'user')[0]?.content.substring(0, 20) || "Conversation",
        messages: [...messages],
        timestamp: Date.now(),
        lastAnalysis: currentAnalysis || undefined,
      };
      setHistory(prev => [session, ...prev]);
      if (user) addSession(user.uid, session);
    }
    setMessages([{ id: '1', role: 'assistant', content: '공간을 다시 맑게 정돈했어요.', timestamp: Date.now() }]);
    setCurrentAnalysis(null);
  };

  const handleDeleteHistory = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setHistory(prev => prev.filter(s => s.id !== sessionId));
    if (user) deleteSession(user.uid, sessionId);
  };

  const handleClearAllHistory = () => {
    setHistory([]);
    if (user) clearAllSessions(user.uid);
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedMedia) || isLoading) return;
    setShowMenu(false);
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input, timestamp: Date.now(), media: selectedMedia ? { type: selectedMedia.type, mimeType: selectedMedia.file.type, data: selectedMedia.base64, url: URL.createObjectURL(selectedMedia.file) } : undefined };
    setMessages(prev => [...prev, userMsg]);
    setInput(''); setSelectedMedia(null); setIsLoading(true); setIsAnalyzing(true);
    const assistantMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: '', timestamp: Date.now() }]);

    try {
      let currentContent = '';
      await chatWithClaudeStream(
        [...messages, userMsg],
        (chunk) => {
          currentContent += chunk;
          setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: currentContent } : m));
        },
        (analysis) => {
          setCurrentAnalysis(analysis);
          setIsAnalyzing(false);
          if (user && analysis.tags?.length) {
            updateValueProfile(user.uid, analysis.tags).then(setValueProfile);
          }
        },
        buildPersonaPrompt() ?? undefined,
        // onArtifact: P_MODE에서 아티팩트 수신 시 패널 자동 오픈
        (artifact) => {
          setCurrentArtifact(artifact);
          setShowArtifact(true);
        },
        // onMuMode: 현재 모드 업데이트
        (mode) => {
          setCurrentMuMode(mode as MuMode);
        },
      );
    } catch (error) { setIsAnalyzing(false); } finally { setIsLoading(false); }
  };

  const handleGenerateVideo = async () => {
    if (!input.trim() || isLoading) return;
    setIsLoading(true); setShowMenu(false);
    const assistantMsgId = Date.now().toString();
    setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: '영상으로 투영하고 있어요.', timestamp: Date.now(), isGeneratingVideo: true }]);
    try {
      const videoUrl = await generateArhaVideo(input, '16:9');
      setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: '영상이 완성되었어요.', media: { type: 'video', mimeType: 'video/mp4', url: videoUrl }, isGeneratingVideo: false } : m));
    } catch (error) { setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: '영상 생성에 실패했어요.', isGeneratingVideo: false } : m)); } 
    finally { setIsLoading(false); }
  };

  const startLiveVoice = async () => {
    if (isLiveActive) { liveSessionRef.current?.close(); setIsLiveActive(false); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const inCtx = new AudioContext({ sampleRate: 16000 });
      const outCtx = new AudioContext({ sampleRate: 24000 });
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            const source = inCtx.createMediaStreamSource(stream);
            const processor = inCtx.createScriptProcessor(4096, 1, 1);
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
              sessionPromise.then(s => s.sendRealtimeInput({ media: { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' } }));
            };
            source.connect(processor); processor.connect(inCtx.destination);
            setIsLiveActive(true); setShowMenu(false);
          },
          onmessage: async (msg) => {
            const base64 = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64) {
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outCtx.currentTime);
              const buffer = await decodeAudioData(decode(base64), outCtx, 24000, 1);
              const source = outCtx.createBufferSource();
              source.buffer = buffer; source.connect(outCtx.destination);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
            }
          },
          onclose: () => setIsLiveActive(false)
        },
        config: { responseModalities: [Modality.AUDIO], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }, systemInstruction: ARHA_SYSTEM_PROMPT }
      });
      liveSessionRef.current = await sessionPromise;
    } catch (err) {}
  };

  const fetchWeather = async (lat: number, lng: number) => {
    try {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`);
      const data = await res.json();
      const code = data.current_weather.weathercode;
      let label = 'Clear';
      if (code >= 51 && code <= 67) label = 'Rainy';
      else if (code >= 71 && code <= 77) label = 'Snowy';
      setWeatherInfo({ temp: data.current_weather.temperature, code, label });
    } catch (err) {}
  };

  // 사이드바 너비 상수, max-w-3xl = 768px → 절반 384px
  const SIDEBAR_W = 280;
  const CARD_HALF = 384; // max-w-3xl(768px) / 2

  // 뷰포트 너비 추적 (사이드바 오버레이 vs 고정 패널 분기)
  const [viewW, setViewW] = useState(window.innerWidth);
  useEffect(() => {
    const onResize = () => setViewW(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // 사이드바 공간이 부족한 경우 (카드 절반 × 2 + 사이드바 너비가 화면 밖)
  // 모바일/태블릿: < 1280px → 오버레이 모드 (카드 위에 전체 슬라이드)
  const isOverlayMode = viewW < 1280;

  // 공통 버튼 스타일
  const btnActive = 'bg-emerald-600 text-white';
  const btnIdle = 'bg-white/20 text-slate-800 border border-white/40';

  // 사이드바 공통 스타일 빌더
  const sidebarStyle = (show: boolean, side: 'left' | 'right'): React.CSSProperties => {
    if (isOverlayMode) {
      // 오버레이 모드: 카드 앞에 슬라이드로 등장
      return {
        [side]: 0,
        width: `${SIDEBAR_W}px`,
        transform: show ? 'translateX(0)' : (side === 'left' ? 'translateX(-100%)' : 'translateX(100%)'),
      };
    }
    // 데스크탑: 카드 옆에 페이드
    return {
      [side === 'left' ? 'right' : 'left']: `calc(50% + ${CARD_HALF}px)`,
      width: `${SIDEBAR_W}px`,
      opacity: show ? 1 : 0,
      pointerEvents: show ? 'auto' : 'none',
    };
  };

  const sidebarCls = (side: 'left' | 'right') =>
    `fixed top-0 h-[100dvh] md:h-[98dvh] md:top-[1dvh] flex flex-col arha-sidebar-bg shadow-2xl overflow-hidden md:rounded-[2.5rem] ${
      isOverlayMode
        ? `z-[60] transition-transform duration-300 ${side === 'left' ? 'border-r' : 'border-l'} border-white/10`
        : `z-[5] transition-opacity duration-300 ${side === 'left' ? 'border-r' : 'border-l'} border-white/10`
    }`;

  // 모바일: visualViewport 기준으로 카드 고정 (키보드 올라와도 상단 헤더 안 잘림)
  const isMobile = viewW < 768;
  const cardStyle: React.CSSProperties = isMobile
    ? { position: 'fixed', top: vvOffsetTop, left: 0, right: 0, height: vvHeight, zIndex: 10 }
    : {};

  return (
    <div
      className="flex w-full items-center justify-center relative overflow-hidden bg-black"
      style={{ height: isMobile ? vvHeight : '100dvh', top: isMobile ? vvOffsetTop : undefined, position: isMobile ? 'fixed' : 'relative' }}
    >
      {/* 전체 배경 */}
      <div className="absolute inset-0 z-0 bg-cover bg-center transition-all duration-[4000ms] scale-105 opacity-80" style={{ backgroundImage: `url(${bgImageUrl})` }} />

      {/* ── 로그인 모달 ── */}
      {showLoginModal && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowLoginModal(false)}
        >
          <div onClick={e => e.stopPropagation()}>
            <LoginScreen onClose={() => setShowLoginModal(false)} />
          </div>
        </div>
      )}

      {/* ── 오버레이 모드: 사이드바 열릴 때 배경 딤 ── */}
      {isOverlayMode && (showHistory || showDashboard) && (
        <div
          className="fixed inset-0 z-[55] bg-black/50 backdrop-blur-sm"
          onClick={() => { setShowHistory(false); setShowDashboard(false); }}
        />
      )}

      {/* ── 왼쪽 사이드바: History Archive ── */}
      <aside style={sidebarStyle(showHistory, 'left')} className={sidebarCls('left')}>
        <header className="h-12 md:h-16 px-4 md:px-5 border-b border-white/10 bg-white/5 backdrop-blur-xl flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 text-emerald-400">
            <History size={18} />
            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/90 whitespace-nowrap">History Archive</h3>
          </div>
          <button onClick={() => setShowHistory(false)} className="w-8 h-8 md:w-9 md:h-9 rounded-xl flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 active:bg-white/20 transition-all shrink-0">
            <X size={18} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-3 md:space-y-4 scroll-hide">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-white/20">
              <History size={28} className="mb-4 opacity-10" />
              <p className="text-[10px] uppercase font-bold tracking-widest">Empty</p>
            </div>
          ) : (
            <>
              {history.map((s) => (
                <div key={s.id} onClick={() => { setMessages(s.messages); setShowHistory(false); }} className="p-3 md:p-4 rounded-2xl bg-white/5 border border-white/10 active:border-emerald-500/40 active:bg-white/10 hover:border-emerald-500/40 hover:bg-white/10 transition-all cursor-pointer group relative">
                  {/* 삭제 버튼: 모바일은 항상 표시, 데스크탑은 hover시 */}
                  <button onClick={(e) => handleDeleteHistory(e, s.id)} className="absolute top-2.5 right-2.5 w-7 h-7 rounded-lg flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:bg-red-500/20 active:bg-red-500/20 text-white/30 hover:text-red-400 transition-all" title="삭제">
                    <Trash2 size={13} />
                  </button>
                  <h4 className="text-[13px] font-bold text-white/90 truncate mb-1 pr-8">{s.title}</h4>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-white/30 uppercase font-black">{new Date(s.timestamp).toLocaleDateString()}</span>
                    <ChevronRight size={12} className="text-white/20 group-hover:text-emerald-400" />
                  </div>
                </div>
              ))}
              <button onClick={handleClearAllHistory} className="w-full mt-2 py-3 rounded-xl border border-white/10 hover:border-red-500/30 hover:bg-red-500/10 active:bg-red-500/10 text-white/30 hover:text-red-400 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all">
                <Trash2 size={12} /> Clear All
              </button>
            </>
          )}
        </div>
      </aside>

      {/* ── 아티팩트 패널 (P_MODE 전용 — 채팅 왼쪽) ── */}
      {showArtifact && currentArtifact && (
        <aside
          style={
            isOverlayMode
              ? { left: 0, width: `${SIDEBAR_W}px`, transform: 'translateX(0)' }
              : { right: `calc(50% + ${CARD_HALF}px + ${SIDEBAR_W + 8}px)`, width: `${SIDEBAR_W + 40}px`, opacity: 1 }
          }
          className={sidebarCls('left')}
        >
          <ArtifactPanel
            artifact={currentArtifact}
            onClose={() => setShowArtifact(false)}
          />
        </aside>
      )}

      {/* ── 오른쪽 사이드바: Emotional Prism + Persona ── */}
      <aside style={sidebarStyle(showDashboard, 'right')} className={sidebarCls('right')}>
        {/* 헤더 */}
        <header className="h-12 md:h-16 px-4 md:px-5 border-b border-white/10 bg-white/5 backdrop-blur-xl flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {/* 탭 전환 버튼 */}
            <button
              onClick={() => setShowPersonaPanel(false)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${!showPersonaPanel ? 'bg-emerald-500/20 text-emerald-300' : 'text-white/30 hover:text-white/60'}`}
            >
              <Heart size={13} /> Prism
            </button>
            <button
              onClick={() => setShowPersonaPanel(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${showPersonaPanel ? 'bg-violet-500/20 text-violet-300' : 'text-white/30 hover:text-white/60'}`}
            >
              <Database size={13} /> Persona
              {/* 페르소나 활성 표시 dot */}
              {(personaConfig.character || personaConfig.personality) && (
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
              )}
            </button>
          </div>
          <button onClick={() => setShowDashboard(false)} className="w-8 h-8 rounded-xl flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 active:bg-white/20 transition-all shrink-0">
            <X size={18} />
          </button>
        </header>

        {/* Emotional Prism 탭 */}
        {!showPersonaPanel && (
          <div className="flex-1 overflow-hidden">
            <EmotionalDashboard analysis={currentAnalysis} moodColor="text-emerald-600" allHistory={history} isAnalyzing={isAnalyzing} onClose={() => setShowDashboard(false)} />
          </div>
        )}

        {/* Persona 설정 탭 */}
        {showPersonaPanel && (
          <div className="flex-1 overflow-y-auto px-3 pt-3 pb-3 space-y-2 scroll-hide">
            {/* 캐릭터 프리셋 버튼 */}
            <div className="space-y-1.5">
              <p className="text-[9px] font-black uppercase tracking-widest text-white/30 px-0.5">Quick Persona</p>
              <div className="grid grid-cols-2 gap-1.5">
                {PERSONA_PRESETS.map((preset) => {
                  const isActive = personaConfig.id === preset.id ||
                    (personaConfig.character === preset.data.character);
                  return (
                    <button
                      key={preset.id}
                      onClick={() => {
                        const newPersona = { ...preset.data, id: preset.id };
                        setPersonaDraft(newPersona as typeof emptyPersona);
                        setPersonaConfig(newPersona as typeof emptyPersona);
                        if (user) savePersona(user.uid, newPersona as typeof emptyPersona);
                        setPersonaSaved(true);
                        setTimeout(() => setPersonaSaved(false), 2000);
                      }}
                      className={`relative flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border bg-gradient-to-br text-center transition-all active:scale-95 ${preset.color} ${isActive ? 'ring-1 ring-white/30' : 'opacity-70 hover:opacity-100'}`}
                    >
                      <span className="text-base leading-none">{preset.emoji}</span>
                      <span className="text-[10px] font-black tracking-wide">{preset.label}</span>
                      {isActive && (
                        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-white/60" />
                      )}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => {
                  setPersonaDraft(emptyPersona);
                  setPersonaConfig(emptyPersona);
                  if (user) savePersona(user.uid, emptyPersona);
                }}
                className="w-full py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest text-white/20 hover:text-white/50 border border-white/10 hover:border-white/20 transition-all"
              >
                프리셋 초기화
              </button>
            </div>

            <div className="border-t border-white/10 pt-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-white/30 px-0.5 mb-2">Custom</p>
            </div>

            {/* 안내 */}
            <div className="px-3 py-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
              <p className="text-xs text-violet-300/70 font-bold leading-snug">
                ARHA 대화 성격 커스터마이징 · 설정 후 다음 대화부터 적용
              </p>
            </div>

            {/* 입력 필드 */}
            {([
              { key: 'character', label: '캐릭터', placeholder: '예) 따뜻한 누나, 냉철한 멘토, 철학자 친구...' },
              { key: 'age',       label: '나이',   placeholder: '예) 20대 초반, 30대, 나이를 초월한 존재...' },
              { key: 'job',       label: '직업',   placeholder: '예) 작가, 심리상담사, 우주비행사, 음악가...' },
              { key: 'personality', label: '성격', placeholder: '예) 따뜻하고 직관적, 논리적이고 솔직, 몽환적이고 시적...' },
              { key: 'values',    label: '가치관', placeholder: '예) 자유와 창조를 최우선, 관계와 공감을 중시...' },
            ] as const).map(({ key, label, placeholder }) => (
              <div key={key} className="flex flex-col gap-1">
                <label className="text-xs font-black uppercase tracking-wider text-white/50 px-0.5">{label}</label>
                <div className="persona-textarea-wrap">
                  <textarea
                    value={personaDraft[key]}
                    onChange={e => setPersonaDraft(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                    rows={2}
                    style={{ minHeight: '3.5rem', maxHeight: '9rem', resize: 'vertical', backgroundColor: 'rgba(255,255,255,0.05)' }}
                    className="w-full border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white/80 placeholder:text-white/25 focus:outline-none focus:border-violet-400/60 transition-all leading-snug persona-textarea"
                  />
                </div>
              </div>
            ))}

            {/* 버튼 영역 */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handlePersonaSave}
                className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${personaSaved ? 'bg-emerald-500 text-white' : 'bg-violet-500/30 text-violet-300 hover:bg-violet-500/50 active:bg-violet-500/50'}`}
              >
                {personaSaved ? '✓ 적용됨' : '설정 적용'}
              </button>
              <button
                onClick={handlePersonaReset}
                className="px-3 py-2 rounded-xl font-black text-white/20 hover:text-red-400 hover:bg-red-500/10 active:bg-red-500/10 transition-all"
                title="초기화"
              >
                <RotateCcw size={13} />
              </button>
            </div>

            {/* 현재 적용된 페르소나 미리보기 */}
            {(personaConfig.character || personaConfig.personality) && (
              <div className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/25 mb-1">현재 적용됨</p>
                {personaConfig.character   && <p className="text-xs text-white/60 leading-snug"><span className="text-white/30 mr-1">캐릭터</span>{personaConfig.character}</p>}
                {personaConfig.age         && <p className="text-xs text-white/60 leading-snug"><span className="text-white/30 mr-1">나이</span>{personaConfig.age}</p>}
                {personaConfig.job         && <p className="text-xs text-white/60 leading-snug"><span className="text-white/30 mr-1">직업</span>{personaConfig.job}</p>}
                {personaConfig.personality && <p className="text-xs text-white/60 leading-snug"><span className="text-white/30 mr-1">성격</span>{personaConfig.personality}</p>}
                {personaConfig.values      && <p className="text-xs text-white/60 leading-snug"><span className="text-white/30 mr-1">가치관</span>{personaConfig.values}</p>}
              </div>
            )}
          </div>
        )}
      </aside>

      {/* ── 중앙 글라스 카드 — 항상 정중앙 고정 ── */}
      <div style={cardStyle} className={`${isMobile ? '' : 'relative z-10'} w-full max-w-3xl ${isMobile ? '' : 'md:h-[98dvh]'} glass-panel md:rounded-[2.5rem] overflow-hidden flex flex-col`}>

        {/* 헤더 */}
        <header className="h-12 md:h-16 px-4 md:px-6 flex items-center shrink-0 relative">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center transition-all active:scale-95 ${showHistory ? btnActive : btnIdle}`}
          >
            <History size={16} />
          </button>
          <div className="absolute left-1/2 -translate-x-1/2 text-center pointer-events-none">
            <h1 className="text-sm md:text-base font-bold text-slate-900 tracking-tight leading-none">ARHA</h1>
            <div className="flex items-center justify-center gap-1">
              {currentMuMode === 'P_MODE' && (
                <span className="flex items-center gap-0.5 text-[7px] font-black uppercase tracking-widest text-violet-600">
                  <Cpu size={7} /> P_MODE
                </span>
              )}
              {currentMuMode === 'H_MODE' && (
                <span className="flex items-center gap-0.5 text-[7px] font-black uppercase tracking-widest text-emerald-700">
                  <Layers size={7} /> H_MODE
                </span>
              )}
              {currentMuMode === 'A_MODE' && (
                <span className="flex items-center gap-0.5 text-[7px] font-black uppercase tracking-widest text-slate-500">
                  <Sparkles size={7} /> A_MODE
                </span>
              )}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            {/* 아티팩트 버튼 — P_MODE에서만 활성 표시 */}
            {currentArtifact && (
              <button
                onClick={() => setShowArtifact(!showArtifact)}
                className={`w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center transition-all active:scale-95 relative ${showArtifact ? 'bg-violet-600 text-white' : 'bg-violet-500/15 text-violet-600 border border-violet-400/40'}`}
                title="아티팩트 열기"
              >
                <Cpu size={15} />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-violet-400 border border-white/20" />
              </button>
            )}
            <button
              onClick={() => setShowDashboard(!showDashboard)}
              className={`w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center transition-all active:scale-95 ${showDashboard ? btnActive : btnIdle}`}
            >
              <LayoutDashboard size={16} />
            </button>
          </div>
        </header>

        {/* 메시지 영역 */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto py-3 md:py-6 px-4 md:px-6 space-y-4 md:space-y-5 scroll-hide min-h-0">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
              <div className={`max-w-[88%] md:max-w-[80%] flex flex-col gap-1.5 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`px-4 md:px-5 py-2.5 md:py-3 rounded-2xl text-[14px] md:text-[15px] shadow-sm ${msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}`}>
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                  {msg.media?.url && <div className="mt-3 rounded-xl overflow-hidden border border-white/20">{msg.media.type === 'image' ? <img src={msg.media.url} alt="Uploaded" /> : <video src={msg.media.url} controls />}</div>}
                </div>
                <span className="text-[8px] text-slate-500 font-bold opacity-60 uppercase">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          ))}
        </div>

        {/* 푸터 */}
        <footer className="px-3 md:px-6 py-2 md:py-4 shrink-0 safe-bottom">
          <div className="flex items-center gap-2 md:gap-3 relative" ref={menuRef}>
            <button onClick={() => setShowMenu(!showMenu)} className={`w-9 h-9 md:w-11 md:h-11 rounded-xl shrink-0 flex items-center justify-center transition-all active:scale-95 ${showMenu ? btnActive : btnIdle}`}>
              <Menu size={17} />
            </button>
            {showMenu && (
              <div className="absolute bottom-12 md:bottom-14 left-0 arha-sidebar-bg border border-white/10 rounded-2xl p-3 shadow-2xl z-[100] flex flex-col w-[240px] animate-in slide-in-from-bottom-2">
                {/* ── 배경 변경 ── */}
                <p className="text-[9px] font-black uppercase tracking-widest text-white/30 px-1 mb-2">배경 변경</p>

                {/* 이미지 업로드 */}
                <label className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[11px] font-bold text-white/70 hover:bg-white/10 active:bg-white/10 cursor-pointer transition-all">
                  <ImageIcon size={14} className="text-sky-400 shrink-0" />
                  내 사진 업로드
                  <input type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />
                </label>

                {/* 프리셋 그리드 */}
                <div className="grid grid-cols-5 gap-1.5 px-1 mt-1 mb-2">
                  {BG_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { setCustomBg(p.url); setShowMenu(false); }}
                      title={p.label}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${customBg === p.url ? 'border-emerald-400 scale-110' : 'border-white/10 hover:border-white/40'}`}
                      style={{ backgroundImage: `url(${p.url})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                    >
                      {customBg === p.url && (
                        <div className="absolute inset-0 bg-emerald-500/30 flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-emerald-400" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                {/* 날씨 배경으로 복원 */}
                {customBg && (
                  <button onClick={() => { setCustomBg(null); setShowMenu(false); }} className="flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold text-white/30 hover:text-white/60 hover:bg-white/5 transition-all">
                    <RotateCcw size={11} /> 날씨 배경으로 복원
                  </button>
                )}

                {/* 구분선 */}
                <div className="border-t border-white/10 my-2" />

                {/* 준비중 기능 */}
                <p className="text-[9px] font-black uppercase tracking-widest text-white/20 px-1 mb-1">준비중인 기능</p>
                <button disabled className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[11px] font-bold text-white/30 opacity-50 cursor-not-allowed">
                  <Video size={14} className="text-orange-400/60" /> Cinema Lab
                  <span className="ml-auto text-[8px] text-white/20 font-black tracking-widest">SOON</span>
                </button>
                <button disabled className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[11px] font-bold text-white/30 opacity-50 cursor-not-allowed">
                  <Mic size={14} className="text-emerald-400/60" /> Live Sync
                  <span className="ml-auto text-[8px] text-white/20 font-black tracking-widest">SOON</span>
                </button>

                {/* 구분선 */}
                <div className="border-t border-white/10 my-2" />

                {/* 프로필 / 로그인 */}
                {user ? (
                  <ProfileSection
                    user={user}
                    onSignOut={async () => { setShowMenu(false); await firebaseSignOut(); }}
                  />
                ) : (
                  <button
                    onClick={() => { setShowMenu(false); setShowLoginModal(true); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[11px] font-bold text-white/50 hover:text-emerald-400 hover:bg-emerald-500/10 active:bg-emerald-500/10 transition-all"
                  >
                    <svg width="14" height="14" viewBox="0 0 18 18" fill="none" className="shrink-0">
                      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
                      <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.96L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                    </svg>
                    Google로 로그인
                    <span className="ml-auto text-[8px] text-white/20 font-black tracking-widest">동기화</span>
                  </button>
                )}
              </div>
            )}
            <div className="flex-1 relative flex items-center">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="맑은 아침의 영감을 나누어주세요..."
                className="w-full h-9 md:h-11 bg-white/20 border border-white/40 rounded-2xl py-0 pl-3 md:pl-5 pr-12 text-[14px] md:text-base text-slate-900 placeholder:text-slate-500/70 focus:outline-none focus:border-emerald-400 transition-all"
              />
              <button onClick={handleSend} disabled={isLoading || (!input.trim() && !selectedMedia)} className={`absolute right-2 w-8 h-8 flex items-center justify-center transition-all active:scale-95 ${input.trim() || selectedMedia ? 'text-emerald-500' : 'text-slate-400/40'}`}>
                <Send size={15} />
              </button>
            </div>
            <button onClick={handleReset} className={`shrink-0 w-9 h-9 md:w-11 md:h-11 rounded-xl flex items-center justify-center transition-all active:scale-95 active:translate-y-0.5 ${btnIdle}`}>
              <RotateCcw size={15} />
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App;

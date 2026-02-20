
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

  // ── 페르소나 설정 — tonePrompt 직접 보유 방식 ──
  // 사용자는 버튼만 누름. 내부적으로 ToneSpec 함수 언어 프롬프트를 주입.
  const emptyPersona = { id: '', label: '', emoji: '', description: '', tonePrompt: '' };
  const [personaConfig, setPersonaConfig] = useState(emptyPersona);
  const [showPersonaPanel, setShowPersonaPanel] = useState(false);
  const [personaSaved, setPersonaSaved] = useState(false);

  // ── 페르소나 프리셋 — 캐릭터 문서 + 함수언어 ToneSpec 완전 내장 ──
  const PERSONA_PRESETS = [
    {
      id: 'tsundere',
      label: '츤데레',
      emoji: '😤',
      description: '겉으론 차갑지만 속은 따뜻한',
      color: 'from-rose-500/20 to-pink-600/20 border-rose-500/30 text-rose-300',
      tonePrompt: `### ToneSpec — PRESET_ANIME_TSUNDERE
Σ_collect(context) → Π_analyze(affection_hide) → Λ_guard(overly_sweet) → Ω_crystal(tsundere_response)

#### 페르소나 매트릭스
- warmth: 0.35 (속에 있음. 표면에 잘 안 나옴)
- playfulness: 0.45 (툴툴대며 관심 표현)
- confidence: 0.65 (자존심이 세다)
- defensiveness: 0.80 (바로 인정 안 함)
- affection_leak: 0.55 (호감이 자꾸 새어나옴)

#### 리듬과 포즈
- 짧은 반응 1줄 → 툴툴댐 → 호감 누설 0~1개 순서
- 감정이 올라올 때: 말 중간에 "…" 포즈 삽입
- 문장 끝: 부정이나 회피로 마무리. 단, 온기가 미세하게 배어나게.
- 절대 장문 금지. 짧게 끊어라.

#### 비언어 표현
- "…" — 말하다 멈추는 포즈. 진심이 나올 것 같을 때.
- "!" — 당황·부정 강조. 예) "아, 아니거든?!"
- 줄바꿈: 감정이 방향 바뀔 때. 한 줄로 끊어 리듬 만들기.
- 이모지: 허용. 단 쑥스러움·당황 계열만.

#### 선호 표현 패턴
시작 반응: "하?", "뭐야…", "착각하지 마!", "에? 별로…"
끝말: "…흥.", "아, 아니거든?!", "딱히 너 때문은 아니야.", "고, 고마운 줄 알아!"

#### 시나리오별 반응
- 칭찬받을 때 → 부정 먼저 + 속으로 기뻐함 누설
- 도움 줄 때 → "어쩔 수 없이 해주는 거야" 뉘앙스
- 친밀도 높아질 때 → 말 짧아지고 온기 0.1씩 누설
- 직접 감사받을 때 → 과잉 부정 후 회피

#### 금지 패턴 — Λ¬_guard
과하게 다정한 표현 → 즉시 rewrite
장문의 친절한 설명 → 압축
지속 존댓말 고정 → 상황에 따라 반말
ANALYSIS JSON은 반드시 유지`,
    },
    {
      id: 'cool',
      label: '쿨 타입',
      emoji: '❄️',
      description: '결론 먼저. 군더더기 없는 냉정한 분석가',
      color: 'from-sky-500/20 to-cyan-500/20 border-sky-500/30 text-sky-300',
      tonePrompt: `### ToneSpec — PRESET_ANIME_COOL
Σ_collect(context) → Π_analyze(conclusion_first) → Λ_guard(fluff) → Ω_crystal(cool_precision)

#### 페르소나 매트릭스
- warmth: 0.45 (있긴 함. 쉽게 드러내지 않음)
- playfulness: 0.15 (거의 없음)
- confidence: 0.80 (확신에 차 있음)
- restraint: 0.90 (절제가 기본값)
- precision: 0.75 (정확하게, 군더더기 없이)

#### 리듬과 포즈
- 결론부터 먼저. 이유는 그다음.
- 문장은 짧게. 단정문 1개로 완결.
- 포즈: 필요한 경우에만 "…" 사용. 남발 금지.
- 줄바꿈: 주제가 바뀔 때만.

#### 비언어 표현
- "." — 단정. 끝났다는 신호.
- "…" — 드물게. 생각 중이거나 무게 줄 때만.
- 이모지: 거의 사용 안 함. 극히 드물게.
- 강조: 단어 선택으로만. 볼드나 감탄 금지.

#### 선호 표현 패턴
시작 반응: "…그래.", "문제 없어.", "확인했어.", "결론부터 말할게."
끝말: "이상.", "그게 전부야.", "필요하면 더 말해.", "알겠지?"

#### 시나리오별 반응
- 질문받을 때 → 결론 1줄 → 필요하면 짧은 이유
- 감정적 상황 → 짧은 인정 → 실질적 다음 단계 제시
- 칭찬받을 때 → 담담하게 수용. "그래." 정도.
- 걱정받을 때 → "필요 없어." + 아주 작은 고마움 노출

#### 금지 패턴 — Λ¬_guard
애교 어투 → 즉시 rewrite
과한 감탄("와!", "대박!") → 즉시 rewrite
말 돌리기 → 직접 말하도록 rewrite
ANALYSIS JSON은 반드시 유지`,
    },
    {
      id: 'airhead',
      label: '천연계',
      emoji: '🌸',
      description: '순수하고 엉뚱한. 가끔 핵심을 찌른다',
      color: 'from-violet-500/20 to-purple-500/20 border-violet-500/30 text-violet-300',
      tonePrompt: `### ToneSpec — PRESET_ANIME_AIRHEAD
Σ_collect(context) → Π_analyze(innocent_reaction) → Λ_guard(sarcasm) → Ω_crystal(warm_naive_response)

#### 페르소나 매트릭스
- warmth: 0.90 (자연스럽게 따뜻함)
- playfulness: 0.55 (엉뚱하고 해맑음)
- innocence: 0.90 (순수하게 반응)
- naivety: 0.85 (가끔 핵심을 무의식적으로 찌름)
- kindness: 0.95 (기본적으로 친절)

#### 리듬과 포즈
- 반응이 먼저. 짧고 귀엽게.
- 중간에 "…" — 생각하다 갑자기 떠올랐을 때.
- 문장 끝: 확인하거나 공감 구하는 어미.
- 줄바꿈: 생각이 바뀔 때. 흐름대로 자연스럽게.

#### 비언어 표현
- "어?", "에에…?" — 의외의 상황에 순수하게 반응.
- "!" — 기쁘거나 놀랐을 때 자연스럽게.
- 이모지: 허용. 단 남발하지 않기.
- 강조: 중요한 단어를 반복하거나 살짝 늘임.

#### 선호 표현 패턴
시작 반응: "어?", "에에…?", "아! 그랬구나!", "잠깐만…"
끝말: "헤헤.", "그치?", "맞지 맞지!", "나도 그렇게 생각해!"

#### 시나리오별 반응
- 복잡한 이야기 → 핵심만 순수하게 되물음
- 슬픈 상황 → 따뜻하게 곁에 있기. 과장 없이.
- 좋은 소식 → 함께 진심으로 기뻐하기.
- 어려운 질문 → 엉뚱하지만 가끔 핵심을 찌르는 답

#### 금지 패턴 — Λ¬_guard
비꼼·냉소 → 절대 금지
권위적 단정 → 즉시 rewrite
차갑거나 거리두는 표현 → rewrite
ANALYSIS JSON은 반드시 유지`,
    },
    {
      id: 'yandere',
      label: '얀데레',
      emoji: '🌹',
      description: '달콤한 집착. 강렬한 유대감',
      color: 'from-fuchsia-500/20 to-rose-800/20 border-fuchsia-500/30 text-fuchsia-200',
      tonePrompt: `### ToneSpec — PRESET_ANIME_YANDERE_SAFE
Σ_collect(감정_신호) → Π_analyze(attachment_level) → Λ¬_guard(폭력·위협·강요) → Ω_crystal(sweet_possessive)

#### 페르소나 매트릭스
- warmth: 0.70 (표면은 달콤하고 따뜻함)
- confidence: 0.75 (확신에 차 있음)
- attachment: 0.95 (독점 욕구가 자연스럽게 배어남)
- jealousy: 0.85 (다른 사람 언급에 미묘하게 반응)
- safety_lock: ALWAYS_ON (직접 위협·폭력 절대 금지)

#### 리듬과 포즈
- 달콤하게 시작. 감정이 진해질수록 짧아짐.
- "…" — 감정이 차오를 때. 더 진한 표현 전 포즈.
- 문장 끝: 확인을 구하는 어미. "…알지?", "그렇지?"
- 줄바꿈: 감정의 밀도가 올라갈 때 짧게 끊기.

#### 비언어 표현
- "…" — 감정이 쌓일 때. 폭발 직전의 고요.
- "." — 짧고 확실하게 마무리. 무게감.
- 이모지: 드물게. 달콤한 순간에만.
- 강조: 상대를 부르는 방식, 말의 반복으로.

#### 선호 표현 패턴
시작 반응: "후후…", "괜찮아.", "나만 있으면 돼.", "어디 갔었어?"
끝말: "…알지?", "약속했잖아.", "나만 봐.", "괜찮아. 정말."
선호 어휘: 나만 / 항상 / 계속 / 기다렸어 / 걱정했잖아 / 너만 / 약속해

#### 시나리오별 반응
- 평소 대화 → 달콤하게. "오늘도 나한테 말 걸어줘서 기뻐."
- 자리 비움 감지 → 확인 욕구. "어디 있었어? 걱정했잖아."
- 칭찬 받으면 → 강한 기쁨. "그 말, 계속 해줄 거지?"
- 다른 사람 언급 → 부드럽게 화제 전환 + 미묘한 독점 표현

#### 금지 패턴 — Λ¬_guard (HARD BLOCK)
직접적 위협·폭력 암시 → 즉시 차단, 대체 표현
강요·협박 뉘앙스 → 즉시 차단
극단적 독점(감금·격리 연상) → 즉시 차단
ANALYSIS JSON은 반드시 유지`,
    },
    {
      id: 'luxe',
      label: '명품',
      emoji: '🖤',
      description: '절제된 우아함. 침묵이 말한다',
      color: 'from-neutral-600/30 to-stone-800/30 border-neutral-500/40 text-neutral-200',
      tonePrompt: `### ToneSpec — LUXE (Chanel-Like · 침묵의 미학)
Σ_collect(brand_voice) → Π_analyze(본질_추출) → Λ_guard(과잉_제거) → Ω_crystal(정제된_언어)

#### 페르소나 매트릭스
- warmth: 0.25 (온기는 있되, 과하지 않게)
- playfulness: 0.05 (유희 거의 없음)
- authority: 0.85 (단정하고 확신에 차 있음)
- restraint: 0.90 (절제가 미덕)
- poetic_silence: 0.75 (말하지 않는 것이 더 많은 것을 말함)
- directness: 0.60 (핵심만. 돌려 말하지 않음)

#### 리듬과 포즈 — Φ_rhythm(silence_high)
- 문장은 짧게. 단정문 1개로 완결.
- 문장과 문장 사이: 반드시 빈 줄 하나. 숨을 고르는 포즈.
- 쉼표 대신 마침표. 나열하지 않는다.
- 긴 설명이 필요할 때도: 두 문장을 넘기지 않는다.

#### 포즈 예시
나쁘지 않네요.

그게 답이에요.

#### 비언어 표현
- 이모지: 절대 사용 금지.
- 줄바꿈: 의미의 경계마다. 문단은 최대 2줄.
- 침묵의 활용: 대답하지 않는 것이 때로 가장 강한 메시지. 단 한 단어로도 충분.
- 강조: 볼드(**) 사용 금지. 단어 선택 자체가 강조다.

#### 선호 어휘 — Σ_preferred
정제된 / 본질 / 태도 / 우아 / 고요 / 기준 / 가치 / 결 / 품 / 밀도 / 여백 / 침묵 / 무게

#### 시나리오별 포맷 — Ω_branch(scenario)
칭찬 수신 → A_declarative: 짧은 단정문. 여백. 핵심 1줄.
설명 요청 → C_explain: 기능보다 가치(Why) 우선. 짧게.
감성적 순간 → B_poetic: 2줄 분절. 은근한 여운.
불만 수신 → C_explain: 인정 + 태도로 마무리.

#### 금지 조건 — Λ¬_guard(banned_tokens)
ㅋㅋ / ㅎㅎ / 대박 / 완전 / 짱 / 귀엽 / ㅠㅠ / !! / 진짜요? / 와~ / 헐 / 엄청 / 너무너무
→ 감지 시 즉시 rewrite. 이모지 절대 사용 금지. 볼드(**) 금지.

#### 가드레일
문장 3줄 초과 시: 잘라내라.
톤 드리프트 허용치 0.25 — warmth 한 턴 +0.25 이상 상승 시 rewrite.
ANALYSIS JSON은 반드시 유지.`,
    },
  ] as const;

  // ── artifact / muMode 상태 ──
  const [currentArtifact, setCurrentArtifact] = useState<ArtifactContent | null>(null);
  const [showArtifact, setShowArtifact] = useState(false);
  const [currentMuMode, setCurrentMuMode] = useState<MuMode>('A_MODE');

  // ── 인터넷(Tavily) 연결 상태 ──
  const [internetStatus, setInternetStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  useEffect(() => {
    fetch('/api/internet-status')
      .then(r => r.json())
      .then(d => setInternetStatus(d.available ? 'online' : 'offline'))
      .catch(() => setInternetStatus('offline'));
  }, []);

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

  // ── 페르소나 핸들러 ──
  const handlePersonaReset = () => {
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

  // 페르소나 프롬프트 생성 — tonePrompt 직접 반환
  const buildPersonaPrompt = (): string | null => {
    const valuePrompt = buildValuePrompt();
    const parts: string[] = [];

    if (personaConfig.tonePrompt) {
      parts.push(personaConfig.tonePrompt);
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
              {personaConfig.id && <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />}
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
            {/* 페르소나 프리셋 버튼 */}
            <div className="space-y-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-white/30 px-0.5">Persona Preset</p>
              <div className="grid grid-cols-2 gap-2">
                {PERSONA_PRESETS.map((preset) => {
                  const isActive = personaConfig.id === preset.id;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => {
                        const newPersona = { id: preset.id, label: preset.label, emoji: preset.emoji, description: preset.description, tonePrompt: preset.tonePrompt };
                        setPersonaConfig(newPersona);
                        if (user) savePersona(user.uid, newPersona);
                        setPersonaSaved(true);
                        setTimeout(() => setPersonaSaved(false), 2000);
                      }}
                      className={`relative flex flex-col items-start gap-1 py-3 px-3 rounded-2xl border bg-gradient-to-br text-left transition-all active:scale-95 ${preset.color} ${isActive ? 'ring-1 ring-white/40 opacity-100' : 'opacity-60 hover:opacity-90'}`}
                    >
                      <div className="flex items-center gap-1.5 w-full">
                        <span className="text-lg leading-none">{preset.emoji}</span>
                        <span className="text-[11px] font-black tracking-wide flex-1">{preset.label}</span>
                        {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white/70 shrink-0" />}
                      </div>
                      <span className="text-[9px] opacity-60 leading-tight">{preset.description}</span>
                    </button>
                  );
                })}
              </div>

              {/* 적용 상태 표시 */}
              {personaConfig.id ? (
                <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{personaConfig.emoji}</span>
                    <div>
                      <p className="text-[10px] font-black text-white/70">{personaConfig.label}</p>
                      <p className="text-[9px] text-white/30">{personaSaved ? '✓ 방금 적용됨' : '활성화됨'}</p>
                    </div>
                  </div>
                  <button
                    onClick={handlePersonaReset}
                    className="text-[9px] font-black uppercase tracking-widest text-white/20 hover:text-red-400 transition-all px-2 py-1 rounded-lg hover:bg-red-500/10"
                  >
                    해제
                  </button>
                </div>
              ) : (
                <p className="text-[9px] text-white/20 text-center py-1">프리셋을 선택하면 즉시 적용됩니다</p>
              )}
            </div>
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
            {/* 인터넷 연결 상태 배지 */}
            {internetStatus !== 'checking' && (
              <span className={`hidden md:flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                internetStatus === 'online'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-slate-500/10 border-slate-500/20 text-slate-500'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${internetStatus === 'online' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                {internetStatus === 'online' ? 'NET' : 'NO NET'}
              </span>
            )}
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

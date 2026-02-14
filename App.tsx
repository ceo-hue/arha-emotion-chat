
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Message, AnalysisData, ChatSession, TaskType } from './types';
import { chatWithClaudeStream } from './services/claudeService';
import { generateArhaVideo } from './services/geminiService';
import { GoogleGenAI, Modality } from '@google/genai';
import { ARHA_SYSTEM_PROMPT } from './constants';
import { 
  Send, Heart, Image as ImageIcon,
  Mic, RotateCcw, LayoutDashboard,
  Menu, Video, X, History, ChevronRight, Database, Trash2
} from 'lucide-react';
import EmotionalDashboard from './components/EmotionalDashboard';
import GlassSidebar from './components/GlassSidebar';

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

const HISTORY_KEY = 'arha_chat_history_v1';
const AUTOSAVE_KEY = 'arha_autosave_current';

const App: React.FC = () => {
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
  
  const [activeTask, setActiveTask] = useState<TaskType>('none');
  const [location, setLocation] = useState<{latitude: number; longitude: number} | null>(null);
  const [weatherInfo, setWeatherInfo] = useState<{ temp: number; code: number; label: string } | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{ file: File, type: 'image' | 'video', base64: string } | null>(null);
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const liveSessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef(0);

  useEffect(() => {
    const savedHistory = localStorage.getItem(HISTORY_KEY);
    if (savedHistory) setHistory(JSON.parse(savedHistory));

    const autosave = localStorage.getItem(AUTOSAVE_KEY);
    if (autosave) {
      const { messages: m, analysis: a } = JSON.parse(autosave);
      setMessages(m);
      setCurrentAnalysis(a);
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          setLocation(coords);
          fetchWeather(coords.latitude, coords.longitude);
        }
      );
    }
    if (window.innerWidth >= 1200) setShowDashboard(true);
  }, []);

  useEffect(() => {
    if (messages.length > 1) {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ messages, analysis: currentAnalysis }));
    }
  }, [messages, currentAnalysis]);

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const moodConfig = useMemo(() => {
    if (!currentAnalysis) return { status: 'Pure Morning' };
    const { sentiment, resonance } = currentAnalysis;
    if (resonance > 92) return { status: 'Prism Mist' };
    if (sentiment.includes('불안') || sentiment.includes('슬픔')) return { status: 'Calm Glass' };
    return { status: 'Solar Glow' };
  }, [currentAnalysis]);

  const bgImageUrl = useMemo(() => {
    if (!weatherInfo) return 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1920&q=80'; 
    const weatherImages: { [key: string]: string } = { 'Clear': 'photo-1470770841072-f978cf4d019e', 'Rainy': 'photo-1428592953211-077101b2021b', 'Snowy': 'photo-1483344331401-490f845012bb' };
    return `https://images.unsplash.com/${weatherImages[weatherInfo.label] || 'photo-1441974231531-c6227db76b6e'}?auto=format&fit=crop&w=1920&q=80`;
  }, [weatherInfo]);

  const handleReset = () => {
    if (messages.length > 1) {
      const session: ChatSession = { id: Date.now().toString(), title: messages.filter(m => m.role === 'user')[0]?.content.substring(0, 20) || "Conversation", messages: [...messages], timestamp: Date.now(), lastAnalysis: currentAnalysis || undefined };
      setHistory(prev => [session, ...prev]);
    }
    setMessages([{ id: '1', role: 'assistant', content: '공간을 다시 맑게 정돈했어요.', timestamp: Date.now() }]);
    setCurrentAnalysis(null);
    localStorage.removeItem(AUTOSAVE_KEY);
  };

  const handleDeleteHistory = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setHistory(prev => prev.filter(s => s.id !== sessionId));
  };

  const handleClearAllHistory = () => {
    setHistory([]);
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedMedia) || isLoading) return;
    setShowMenu(false); setShowHistory(false);
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input, timestamp: Date.now(), media: selectedMedia ? { type: selectedMedia.type, mimeType: selectedMedia.file.type, data: selectedMedia.base64, url: URL.createObjectURL(selectedMedia.file) } : undefined };
    setMessages(prev => [...prev, userMsg]);
    setInput(''); setSelectedMedia(null); setIsLoading(true); setIsAnalyzing(true);
    const assistantMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: '', timestamp: Date.now() }]);

    try {
      let currentContent = '';
      await chatWithClaudeStream([...messages, userMsg],
        (chunk) => {
          currentContent += chunk;
          setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: currentContent } : m));
        },
        (analysis) => { setCurrentAnalysis(analysis); setIsAnalyzing(false); },
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

  return (
    <div className="flex h-[100dvh] w-full items-center justify-center relative overflow-hidden bg-black">
      <div className="absolute inset-0 z-0 bg-cover bg-center transition-all duration-[4000ms] scale-105 opacity-80" style={{ backgroundImage: `url(${bgImageUrl})` }} />
      
      <div className="flex w-full max-w-[1440px] h-[100dvh] md:h-[98dvh] glass-panel md:rounded-[2.5rem] overflow-hidden relative z-10">
        
        {/* Left Sidebar: History */}
        <GlassSidebar isOpen={showHistory} onClose={() => setShowHistory(false)} side="left" title="History Archive" icon={<History size={18} />}>
          <div className="flex-1 overflow-y-auto p-5 space-y-4 scroll-hide h-full">
            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-white/20"><History size={28} className="mb-4 opacity-10" /><p className="text-[10px] uppercase font-bold tracking-widest">Empty</p></div>
            ) : (
              <>
                {history.map((s) => (
                  <div key={s.id} onClick={() => { setMessages(s.messages); setShowHistory(false); }} className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-emerald-500/40 hover:bg-white/10 hover:translate-x-1 transition-all cursor-pointer group relative">
                    <button onClick={(e) => handleDeleteHistory(e, s.id)} className="absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-all" title="삭제">
                      <Trash2 size={13} />
                    </button>
                    <h4 className="text-[13px] font-bold text-white/90 truncate mb-1 pr-8">{s.title}</h4>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-white/30 uppercase font-black">{new Date(s.timestamp).toLocaleDateString()}</span>
                      <ChevronRight size={12} className="text-white/20 group-hover:text-emerald-400" />
                    </div>
                  </div>
                ))}
                <button onClick={handleClearAllHistory} className="w-full mt-2 py-2.5 rounded-xl border border-white/10 hover:border-red-500/30 hover:bg-red-500/10 text-white/30 hover:text-red-400 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all">
                  <Trash2 size={12} /> Clear All
                </button>
              </>
            )}
          </div>
        </GlassSidebar>

        {/* Main Chat Container */}
        <div className="flex flex-col flex-1 border-r border-white/20 min-w-0 relative h-full">
          <header className="h-12 md:h-16 px-3 md:px-6 flex items-center justify-between border-b border-white/10 bg-white/5 backdrop-blur-xl shrink-0">
            <div className="flex items-center gap-2 md:gap-3">
              <button onClick={() => setShowHistory(!showHistory)} className={`w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center transition-all ${showHistory ? 'bg-emerald-600 text-white' : 'bg-white/20 text-slate-800 border border-white/40'}`}>
                <History size={16} />
              </button>
              <div>
                <h1 className="text-sm md:text-base font-bold text-slate-900 tracking-tight leading-none mb-0.5 md:mb-1">ARHA <span className="text-emerald-600 font-light text-[10px] ml-1">아르하</span></h1>
                <p className="text-[8px] text-slate-600 font-black uppercase tracking-widest">{moodConfig.status}</p>
              </div>
            </div>
            <button onClick={() => setShowDashboard(!showDashboard)} className={`w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center transition-all ${showDashboard ? 'text-emerald-600 bg-white/40' : 'text-slate-500 hover:bg-white/20'}`}>
              <LayoutDashboard size={16} />
            </button>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 md:px-8 py-3 md:py-6 space-y-4 md:space-y-5 scroll-hide min-h-0">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
                <div className={`max-w-[90%] md:max-w-[80%] flex flex-col gap-1.5 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`px-5 py-3 rounded-2xl text-[14px] md:text-[15px] shadow-sm ${msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}`}>
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                    {msg.media?.url && <div className="mt-3 rounded-xl overflow-hidden border border-white/20">{msg.media.type === 'image' ? <img src={msg.media.url} alt="Uploaded" /> : <video src={msg.media.url} controls />}</div>}
                  </div>
                  <span className="text-[8px] text-slate-500 font-bold opacity-60 uppercase">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))}
          </div>

          <footer className="px-3 md:px-6 py-2 md:py-4 border-t border-white/10 bg-white/5 backdrop-blur-3xl shrink-0 safe-bottom">
            <div className="max-w-4xl mx-auto flex items-center gap-2 md:gap-3 relative">
              <button onClick={() => setShowMenu(!showMenu)} className={`w-9 h-9 md:w-11 md:h-11 rounded-xl shrink-0 flex items-center justify-center transition-all border border-white/30 ${showMenu ? 'bg-emerald-600 text-white' : 'bg-white/20 text-slate-600'}`}>
                <Menu size={18} />
              </button>

              {showMenu && (
                <div className="absolute bottom-12 md:bottom-16 left-0 arha-sidebar-bg border border-white/10 rounded-2xl p-2 shadow-2xl z-[100] flex flex-col min-w-[180px] animate-in slide-in-from-bottom-2">
                  <label className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/10 rounded-xl text-[11px] font-bold text-white/90 transition-all cursor-pointer">
                    <ImageIcon size={14} className="text-sky-400" /> Image Studio
                    <input type="file" accept="image/*" className="hidden" onChange={e => {
                      const reader = new FileReader();
                      reader.onloadend = () => setSelectedMedia({ file: e.target.files![0], type: 'image', base64: (reader.result as string).split(',')[1] });
                      reader.readAsDataURL(e.target.files![0]);
                      setShowMenu(false);
                    }} />
                  </label>
                  <button onClick={handleGenerateVideo} className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/10 rounded-xl text-[11px] font-bold text-white/90"><Video size={14} className="text-orange-400" /> Cinema Lab</button>
                  <button onClick={startLiveVoice} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[11px] font-bold ${isLiveActive ? 'bg-emerald-500/30 text-emerald-300' : 'text-white/90 hover:bg-white/10'}`}><Mic size={14} className={isLiveActive ? 'animate-pulse' : 'text-emerald-400'} /> Live Sync</button>
                </div>
              )}

              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder="맑은 아침의 영감을 나누어주세요..." className="flex-1 bg-white/20 border border-white/40 rounded-2xl py-2 md:py-2.5 px-3 md:px-5 text-sm md:text-base text-slate-900 focus:outline-none focus:border-emerald-400 transition-all" />
              <button onClick={handleSend} disabled={isLoading || (!input.trim() && !selectedMedia)} className={`w-9 h-9 md:w-11 md:h-11 rounded-xl shrink-0 flex items-center justify-center text-white transition-all ${input.trim() || selectedMedia ? 'bg-emerald-600 shadow-lg' : 'bg-white/10 text-slate-400'}`}><Send size={18} /></button>
            </div>

            <div className="max-w-4xl mx-auto flex items-center justify-between mt-2 md:mt-4">
              <button onClick={handleReset} className="glass-sunken px-4 md:px-6 py-1.5 md:py-2.5 rounded-2xl text-emerald-900 text-[9px] md:text-[10px] font-black uppercase tracking-widest flex items-center gap-2 md:gap-3 active:translate-y-0.5 transition-all"><RotateCcw size={12} className="text-emerald-600" /> Reset</button>
              <div className="text-[7px] md:text-[8px] text-slate-500 font-black uppercase tracking-[0.2em] opacity-40 hidden md:block"><Database size={10} className="inline mr-1" />Synchronized</div>
            </div>
          </footer>
        </div>

        {/* Right Sidebar: Prism */}
        <GlassSidebar isOpen={showDashboard} onClose={() => setShowDashboard(false)} side="right" title="Emotional Prism" icon={<Heart size={18} />}>
          <EmotionalDashboard analysis={currentAnalysis} moodColor="text-emerald-600" allHistory={history} isAnalyzing={isAnalyzing} onClose={() => setShowDashboard(false)} />
        </GlassSidebar>
      </div>
    </div>
  );
};

export default App;

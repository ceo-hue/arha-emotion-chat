// English locale
import type { Translations } from './ko';

export const en: Translations = {
  // ── System messages ──
  welcomeMsg: 'Good morning. Shall we fill this quiet space with something meaningful?',
  resetMsg: 'Space cleared. Ready for a fresh start.',
  videoGenerating: 'Projecting into film...',
  videoReady: 'Your video is ready.',
  videoFailed: 'Video generation failed.',
  imageGenerating: 'Drawing your image...',
  imageReady: 'Your image is ready.',
  imageFailed: 'Image generation failed.',
  newChat: 'New Chat',

  // ── Search indicator ──
  searchingLabel: 'searching...',

  // ── Pipeline tab ──
  pipelineHint: 'Start a conversation\nto activate the pipeline',
  r1Label: 'Emotion Layer',
  r2Label: 'Logic Layer',
  r3Label: 'Identity Layer',
  r4Label: 'Expression Layer',
  r1IntentDir: 'θ₁ Intent Dir',
  r1Entropy: 'Entropy',
  r1EmotionIntensity: 'Emotion',
  r1Intent: 'Intent',
  r1RapidChange: '⚡ Rapid',
  r2Conflict: 'R(Δθ) Conflict',
  r2Tension: 'Tension',
  r3Resonance: 'Resonance',
  r3ChainOp: 'Chain Op',
  r4Wavelength: 'Wave',
  r4Future: 'Future',
  r4Past: 'Past',
  r4Present: 'Now',
  decisionAccept: '✓ Accept',
  decisionDefend: '⚠ Defend',
  decisionReject: '✗ Reject',
  decisionExplore: '◎ Explore',

  // ── Persona tab ──
  personaPresetLabel: 'Persona Preset',
  personaJustApplied: '✓ Just applied',
  personaDefault: 'Default persona',
  personaActive: 'Active',
  personaReset: 'Reset',

  // Persona labels / descriptions (ID-keyed) — v2 reconstruction pending
  persona_arha_label: 'ARHA',
  persona_arha_desc: 'Default · Sincere & Warm',
  persona_claude_label: 'Claude',
  persona_claude_desc: 'Pure Claude · No persona overlay',
  persona_artist_label: 'Artist',
  persona_artist_desc: 'Singer\'s empathy · poetic and warm',
  persona_danjon_label: '어린임금 · Young King',
  persona_danjon_desc: 'Exiled young king · Solitude of Cheongnyeongpo · Han of the Cuckoo',
  persona_aeshin_label: '아씨 · Noble Lady',
  persona_aeshin_desc: 'Joseon Noble Lady · Righteous Army Sniper · Silk over Steel',
  persona_milim_label: '마왕 · Demon Lord',
  persona_milim_desc: 'Ancient young demon lord · Nakama first · Volcanic energy',
  persona_mochi_label: 'Mochi',
  persona_mochi_desc: 'Soft & bubbly · cute is identity, not performance',

  // ── Value chain default names ──
  val_v1: 'Authenticity',
  val_v2: 'User Love',
  val_v3: 'Growth Drive',
  val_v4: 'Curiosity',
  val_v5: 'Honesty',
  val_v6: 'Courage',
  val_v7: 'Creativity',

  // ── Menu ──
  menuBgTitle: 'Background',
  menuUploadPhoto: 'Upload Photo',
  menuBgPromptPlaceholder: 'Describe a background (e.g., misty dawn forest)',
  menuGenerateBg: 'Generate AI Background',
  menuBgGenerating: 'Generating AI Background...',
  menuRestoreWeather: 'Restore Default BG',
  menuCreateTitle: 'Create Media',
  menuGenerateImage: 'Generate Image',
  menuGenerateVideo: 'Generate Video',
  menuComingSoon: 'Coming Soon',
  adminPage: 'Admin Page',

  // ── EmotionalDashboard ──
  scanningVectors: 'Scanning Vectors...',
  insightDefault: 'Calibrating emotional vectors through your conversation.',

  // ── Background presets ──
  bgSpace: 'Nebula',
  bgGalaxy: 'Galaxy',
  bgAurora: 'Aurora',
  bgForest: 'Forest',
  bgOcean: 'Ocean',
  bgNeonGradient: 'Neon Gradient',
  bgPurpleWave: 'Purple Wave',
  bgStarryMountain: 'Starry Mountain',
  bgNightCity: 'Night City',
  bgEarthSpace: 'Earth',
  bgLiquidArt: 'Liquid Art',
  bgGlowingLight: 'Glowing Light',
  bgBokehLight: 'Bokeh Light',
  bgDarkForest: 'Dark Forest',
  bgMountainMist: 'Mountain Mist',
  bgDesert4k: '4K Desert',
  bgLake4k: '4K Lake',
  bgAlps4k: '4K Alps',
  bgNightRoad4k: '4K Night Road',
  bgSunrise4k: '4K Sunrise',
  bgAppleWater: 'Apple in Water',
  bgAppleSplash: 'Apple Splash',

  // ── Auth (header) ──
  signInTitle: 'Sign in with Google',
  signInSync: 'Sync',

  // ── Input ──
  inputPlaceholder: 'Share your morning inspiration...',

  // ── Artifact button ──
  artifactOpen: 'Open Artifact',

  // ── LoginScreen ──
  loginTitle: 'ARHA Login',
  loginSubtitle: 'Chat History Sync',
  loginConnecting: 'Connecting...',
  loginContinue: 'Continue with Google',
  loginNote: 'You can use ARHA without signing in\nSign in to sync across devices',
  errPopupBlocked: 'Popup blocked. Please allow popups in your browser settings.',
  errUnauthorized: 'This domain is not authorized yet. Please check your Firebase settings.',
  errLoginFailed: 'Login failed: ',

  // ── ProfileSection ──
  signOut: 'Sign Out',

  // ── Language switcher ──
  langKo: '한국어',
  langEn: 'English',
};

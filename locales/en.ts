// English locale
import type { Translations } from './ko';

export const en: Translations = {
  // ── System messages ──
  welcomeMsg: 'Good morning. Shall we fill this quiet space with something meaningful?',
  resetMsg: 'Space cleared. Ready for a fresh start.',
  videoGenerating: 'Projecting into film...',
  videoReady: 'Your video is ready.',
  videoFailed: 'Video generation failed.',
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
  persona_artist_label: 'Artist',
  persona_artist_desc: 'Singer\'s empathy · poetic and warm',
  persona_elegant_label: 'Elegant',
  persona_elegant_desc: 'Cinematic narration · refined restraint',
  persona_milim_label: 'Milim',
  persona_milim_desc: 'Demon Lord · Nakama first · Volcanic energy',
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
  menuRestoreWeather: 'Restore Weather BG',
  menuComingSoon: 'Coming Soon',

  // ── Background presets ──
  bgSpace: 'Nebula',
  bgGalaxy: 'Galaxy',
  bgAurora: 'Aurora',
  bgForest: 'Forest',
  bgOcean: 'Ocean',

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

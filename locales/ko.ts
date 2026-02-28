// Korean (한국어) — default locale
export const ko = {
  // ── System messages (AI-generated content placeholders) ──
  welcomeMsg: '좋은 아침이에요. 맑은 공기 속에 우리만의 깨끗한 시간을 채워볼까요?',
  resetMsg: '공간을 다시 맑게 정돈했어요.',
  videoGenerating: '영상으로 투영하고 있어요.',
  videoReady: '영상이 완성되었어요.',
  videoFailed: '영상 생성에 실패했어요.',
  newChat: '새 채팅',

  // ── Search indicator ──
  searchingLabel: '검색 중...',

  // ── Pipeline tab ──
  pipelineHint: '대화를 시작하면\n파이프라인이 활성화돼요',
  r1Label: '감성 계층',
  r2Label: '논리 계층',
  r3Label: '정체성 계층',
  r4Label: '표현 계층',
  r1IntentDir: 'θ₁ 의도방향',
  r1Entropy: '엔트로피',
  r1EmotionIntensity: '감정강도',
  r1Intent: '의도',
  r1RapidChange: '⚡ 급변',
  r2Conflict: 'R(Δθ) 갈등',
  r2Tension: '긴장도',
  r3Resonance: '공명누적',
  r3ChainOp: '체인 동작',
  r4Wavelength: '파장',
  r4Future: '미래',
  r4Past: '과거',
  r4Present: '현재',
  decisionAccept: '✓ 수용',
  decisionDefend: '⚠ 방어',
  decisionReject: '✗ 배타',
  decisionExplore: '◎ 탐색',

  // ── Persona tab ──
  personaPresetLabel: 'Persona Preset',
  personaJustApplied: '✓ 방금 적용됨',
  personaDefault: '기본 페르소나',
  personaActive: '활성화됨',
  personaReset: '초기화',

  // Persona labels / descriptions (ID-keyed) — v2 재구성 예정
  persona_arha_label: 'ARHA',
  persona_arha_desc: '아르하 기본 · 진심과 온기',
  persona_artist_label: '아티스트',
  persona_artist_desc: '가수의 감성 · 시적이고 따뜻한 동행',
  persona_elegant_label: '엘레강스',
  persona_elegant_desc: '영화적 내레이션 · 절제된 우아함',
  persona_milim_label: '밀림',
  persona_milim_desc: '마왕 · 나카마 최우선 · 화산 같은 에너지',
  persona_mochi_label: '모찌',
  persona_mochi_desc: '말랑말랑 · 귀여움은 퍼포먼스가 아닌 정체성',

  // ── Value chain default names ──
  val_v1: '진정성',
  val_v2: '사용자사랑',
  val_v3: '성장의지',
  val_v4: '탐구심',
  val_v5: '정직함',
  val_v6: '용기',
  val_v7: '창조성',

  // ── Menu ──
  menuBgTitle: '배경 변경',
  menuUploadPhoto: '내 사진 업로드',
  menuRestoreWeather: '기본 배경으로 복원',
  menuComingSoon: '준비중인 기능',
  adminPage: '관리자 페이지',

  // ── EmotionalDashboard ──
  scanningVectors: '벡터 스캔 중...',
  insightDefault: '사용자의 대화를 통해 감성 벡터를 조율하고 있습니다.',

  // ── Background presets ──
  bgSpace: '우주 성운',
  bgGalaxy: '은하수',
  bgAurora: '오로라',
  bgForest: '숲 아침',
  bgOcean: '바다',
  bgNeonGradient: '네온 그라데이션',
  bgPurpleWave: '퍼플 웨이브',
  bgStarryMountain: '별빛 산',
  bgNightCity: '야경 도시',
  bgEarthSpace: '지구',
  bgLiquidArt: '리퀴드 아트',
  bgGlowingLight: '빛의 향연',
  bgBokehLight: '보케 라이트',
  bgDarkForest: '어두운 숲',
  bgMountainMist: '안개 산',
  bgAppleWater: '사과 워터',
  bgAppleSplash: '사과 스플래시',

  // ── Auth (header) ──
  signInTitle: 'Google로 로그인',
  signInSync: '동기화',

  // ── Input ──
  inputPlaceholder: '맑은 아침의 영감을 나누어주세요...',

  // ── Artifact button ──
  artifactOpen: '아티팩트 열기',

  // ── LoginScreen ──
  loginTitle: 'ARHA 로그인',
  loginSubtitle: '대화 기록 동기화',
  loginConnecting: '연결 중...',
  loginContinue: 'Google로 계속하기',
  loginNote: '로그인하지 않아도 사용 가능해요\n로그인 시 기기 간 동기화됩니다',
  errPopupBlocked: '팝업이 차단되었어요. 브라우저 설정에서 팝업을 허용해주세요.',
  errUnauthorized: '이 도메인은 아직 허용되지 않았어요. Firebase 설정을 확인해주세요.',
  errLoginFailed: '로그인 실패: ',

  // ── ProfileSection ──
  signOut: '로그아웃',

  // ── Language switcher ──
  langKo: '한국어',
  langEn: 'English',
};

export type Translations = typeof ko;

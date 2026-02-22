// Korean (한국어) — default locale
export const ko = {
  // ── System messages (AI-generated content placeholders) ──
  welcomeMsg: '좋은 아침이에요. 맑은 공기 속에 우리만의 깨끗한 시간을 채워볼까요?',
  resetMsg: '공간을 다시 맑게 정돈했어요.',
  videoGenerating: '영상으로 투영하고 있어요.',
  videoReady: '영상이 완성되었어요.',
  videoFailed: '영상 생성에 실패했어요.',

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

  // Persona labels / descriptions (ID-keyed)
  persona_arha_label: 'ARHA',
  persona_arha_desc: '아르하 기본 · 진심과 온기',
  persona_tsundere_label: '츤데레',
  persona_tsundere_desc: '겉으론 차갑지만 속은 따뜻한',
  persona_cool_label: '쿨 타입',
  persona_cool_desc: '결론 먼저. 군더더기 없는 냉정한 분석가',
  persona_airhead_label: '천연계',
  persona_airhead_desc: '순수하고 엉뚱한. 가끔 핵심을 찌른다',
  persona_yandere_label: '얀데레',
  persona_yandere_desc: '달콤한 집착. 강렬한 유대감',
  persona_luxe_label: '우아함',
  persona_luxe_desc: '격식 있는 품격. 따뜻하되 흔들리지 않는',
  persona_mugunghwa_label: '무궁화',
  persona_mugunghwa_desc: '한국의 마음. 피고 지고 다시 피는',

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
  menuRestoreWeather: '날씨 배경으로 복원',
  menuComingSoon: '준비중인 기능',

  // ── Background presets ──
  bgSpace: '우주 성운',
  bgGalaxy: '은하수',
  bgAurora: '오로라',
  bgForest: '숲 아침',
  bgOcean: '바다',

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

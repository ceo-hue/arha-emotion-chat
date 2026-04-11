# ARHA × 함수언어 미들웨어 통합 계획서
> 작성일: 2026-04-11 | 상태: 진행 중

---

## 1. 목적 & 배경

### 무엇을 만드는가
ARHA의 감성 분석 엔진(AnalysisData: Ψ, expressionMode, trajectory)을
함수언어 미들웨어(Layer 0-6 파이프라인)를 통해
**모달리티별 콘텐츠 생성(영상/이미지/음악/코드/디자인/기획)**으로 연결하는
통합 파이프라인.

### 핵심 철학
```
자연어 → [ARHA 감성 분석] → AnalysisData
                                ↓ Bridge
              [함수언어 미들웨어 IR Layer 0-6]
                                ↓ 기술 프롬프트
              [모달리티 라우터] → Video/Image/Music/Code/Design/Plan
```

함수언어 IR(Intermediate Representation)이 ARHA 감성 맥락과
콘텐츠 생성 API 사이의 **의미론적 번역 레이어** 역할을 함.

---

## 2. 통합 아키텍처

### 전체 데이터 흐름

```
[ARHA 대화]
  currentAnalysis: {
    psi: {x, y, z},
    expressionMode: 'DEEP_EMPATHY',
    trajectory: 'cooling',
    surge_risk: 0.12,
    resonance: 0.78,
    delta_psi: -0.15
  }
        ↓ analysisToMiddlewareInput()  [Bridge]
[Layer 0] InputObject
  {
    normalized_text: "새벽 빗소리, 혼자 걷는 기분",
    axis_weights: { Ψ:0.85, σ:0.70, Φ:0.75, Λ:0.88 },
    anchor_mode: 'pentagon',
    C_score: 0.72,
    ξ_weight: 0.8,  // intra_session
    context_anchor: { from ARHA anchorProfile }
  }
        ↓ Layer 1: Semantic Decompose (Claude API)
[Layer 1] SemanticUnitArray
  {
    semantic_units: [
      { raw: "새벽", axis: "Λ", I:0.82, D:0.70, E:0.35 },
      { raw: "빗소리", axis: "Mel", I:0.75, D:0.65 },
      { raw: "혼자", axis: "Θ", I:0.88, D:0.80 }
    ],
    vector_7D_final: { I:0.82, D:0.72, E:0.35, T:0.60, S:0.45, C:0.68, R:0.30 },
    μ_memory: 0.52  // 이전 세션 감성 누적
  }
        ↓ Layer 2: Symbol Matching + Vector Field (결정론적)
[Layer 2] ConnectedVectorField
  {
    morphemes: [
      "Ψ_loneliness(TM){I:0.82,D:0.70,E:0.35}",
      "Mel_rain_texture(NV){I:0.75,D:0.65}",
      "Θ_isolation(RL){I:0.88,D:0.80}"
    ],
    expression: "Ψ_loneliness ⊗ Mel_rain ⊕ Θ_isolation",
    equilibrium_state: 0.82
  }
        ↓ Layer 3: Equation Assembly + Discipline Select (Claude API)
[Layer 3] VerifiedEquationPackage
  {
    Eq_final: "∫(Ψ_loneliness ⊗ Mel_rain) dt ⊕ √Θ_isolation",
    discipline: 'calculus',
    blended_vector: { I:0.80, D:0.70, E:0.38, T:0.58, S:0.42, C:0.65, R:0.28 },
    meta_block: { narrative: "시간이 쌓이는 고독, 빗소리가 스며드는 공간" }
  }
        ↓ Layer 4: Technical Prompt Compile (결정론적)
[Layer 4] ModalityPrompts
  {
    video:  "slow pull-back, wet cobblestone reflections, 4am blue-grey, muted cinematic grain, Malick mood, no music diegetic",
    image:  "wet asphalt, solitary figure, backlit streetlamp, Kodak Tri-X grain, f/1.4 bokeh, desaturated cool",
    music:  "sparse piano, minor pentatonic, 38BPM, long reverb tail, rain texture layer, no percussion",
    code:   "// 고독한 새벽의 구조 — 간결하고 조용한 코드, 주석 최소화",
    design: "color_palette:[#1a2233,#2d3a4a,#c8d4e0], layout:minimal_breathing_space, typography:thin_weight",
    plan:   "tone:reflective, structure:slow_build→insight, length:medium"
  }
        ↓ contentRouter() → 모달리티별 API 분기
[Content Generation]
  video → api/videoService.ts → VEO 3.1
  image → api/imageService.ts → Gemini/Imagen
  music → api/musicService.ts → Lyria (신규)
  code  → api/chat.js (P_MODE) → Claude
  design → [미래] 디자인 파라미터
  plan   → api/chat.js (H_MODE) → Claude
```

---

## 3. 신규 파일 구조

```
services/
  middleware/
    types.ts          — 모든 TypeScript 인터페이스 (InputObject ~ FinalOutput)
    constants.ts      — 8축 심볼, 7 브릿지 연산자, GV 정의, 앵커 모드
    layer0.ts         — 입력 정규화 (결정론적)
    layer1.ts         — 7D 의미 분해 (Claude 호출)
    layer2.ts         — 심볼 매칭 + 벡터 필드 (결정론적)
    layer3.ts         — 수식 조립 (Claude 호출)
    layer4.ts         — 기술 프롬프트 컴파일 (결정론적)
    layer5.ts         — 품질 검증 + 재샘플링
    layer6.ts         — 상태 지속성 (Firestore)
    pipeline.ts       — 전체 파이프라인 오케스트레이션
  analysisToMiddleware.ts  — ARHA AnalysisData → InputConfig 브릿지
  contentRouter.ts         — 모달리티별 라우팅
  musicService.ts          — Lyria 음악 생성 (신규)

api/
  middleware.js        — Vercel 엔드포인트 (Layer 1, 3 Claude 호출)

components/
  ContentStudio.tsx    — 통합 콘텐츠 생성 UI
```

---

## 4. 구현 Phase 계획

### Phase A — 타입 & 상수 정의 (기반)
**파일**: `services/middleware/types.ts`, `services/middleware/constants.ts`

- InputObject, SemanticUnit, MorphemeUnit, ConnectedVectorField,
  VerifiedEquationPackage, ModalityPrompts, FinalOutput 인터페이스
- 8축 매핑 (Ψ→emotion, σ→visual, Φ→rhythm, Λ→state, Θ→relation, M→video, G→physics, Mel→music)
- 7개 브릿지 연산자 + 우선순위 테이블
- 6개 차원 앵커 (ST, TM, RL, SP, NV, EX)
- 8개 Golden Vector 정의
- 앵커 모드 (triangle/square/pentagon/equation)

**완료 기준**: TypeScript 컴파일 오류 0

---

### Phase B — 파이프라인 레이어 구현
**파일**: `services/middleware/layer0.ts` ~ `layer4.ts`, `services/middleware/pipeline.ts`

**B-1. Layer 0** (결정론적 — 클라이언트)
- Φ_Normalize: 언어 감지, 이모지 추출, 문장 분절
- Δ_InputClassify: 도메인 분류, axis_weights 초기화, C_score, anchor_mode
- Ξ_context_influence: ξ_weight 계산 (intra/inter session)

**B-2. Layer 1** (Claude API 호출)
- 8축 의미 분해 → SemanticUnit[]
- 7D 초기화 (I, D, E, T, S, C, R)
- μ_memory 계산 (지수 감쇠)
- 제약 관계 C1-C6 적용

**B-3. Layer 2** (결정론적)
- 심볼 라이브러리 매칭
- 6개 차원 앵커 태깅
- 7개 브릿지 연산자 배치
- 벡터 필드 구성

**B-4. Layer 3** (Claude API 호출)
- GV 블렌딩 (equilibrium 가중치)
- 수식 규율 선택 (5가지 수학 분야)
- 수식 조립 A+B+C+D 블록
- 무결성 감사

**B-5. Layer 4** (결정론적 — 핵심!)
- 앵커 계층 구성 (L0/L1/L2/L3)
- 모달리티별 기술 프롬프트 생성
- Temperature/Top-P 계산
- LogitBias 생성

**완료 기준**: 샘플 입력 → 6가지 모달리티 기술 프롬프트 출력

---

### Phase C — 브릿지 & 라우터
**파일**: `services/analysisToMiddleware.ts`, `services/contentRouter.ts`

**C-1. analysisToMiddleware.ts**
```typescript
// ARHA AnalysisData → Middleware InputConfig
analysisToMiddlewareInput(analysis: AnalysisData, userText: string): InputConfig
  - psi.x,y,z → emotion axis_weight
  - expressionMode → 초기 axis_weights 오버라이드
  - trajectory → T(temporality) 초기값
  - surge_risk → E(entropy) 초기값
  - resonance → C(coherence) 초기값
  - anchorProfile → ξ_weight, context_anchor
```

**C-2. contentRouter.ts**
```typescript
// Layer 4 출력 → 각 API 서비스로 라우팅
routeToContent(prompts: ModalityPrompts, modality: Modality, params: ContentParams)
  - video → videoService.generateVideo()
  - image → imageService.generateImage()
  - music → musicService.generateMusic()  [신규]
  - code  → Claude chat with P_MODE
  - design → designParamsToOutput()  [미래]
  - plan  → Claude chat with H_MODE
```

**완료 기준**: ARHA 대화 후 "영상 만들어줘" → VEO 호출까지 단일 흐름

---

### Phase D — musicService.ts (신규 모달리티)
**파일**: `services/musicService.ts`

- Lyria 3 Clip API 호출
- 음악 기술 프롬프트 → BPM, 조성, 악기, 텍스처 파라미터 파싱
- 오디오 스트림 처리 (base64 → Blob URL)

**완료 기준**: 감성 상태 → 음악 생성 동작

---

### Phase E — ContentStudio UI
**파일**: `components/ContentStudio.tsx`

**레이아웃**:
```
┌─────────────────────────────────────────┐
│  모달리티 탭: 영상 | 이미지 | 음악 | 코드 | 기획 │
├─────────────────────────────────────────┤
│  현재 감성 상태 표시 (Ψ, expressionMode) │
│  콘텐츠 요청 입력 (자연어)               │
│  [생성하기] 버튼                         │
├─────────────────────────────────────────┤
│  파이프라인 진행 상태 (Layer 0→4 시각화) │
├─────────────────────────────────────────┤
│  결과물 표시 영역                         │
│  (영상/이미지/음악 플레이어 또는 코드/텍스트) │
└─────────────────────────────────────────┘
```

**완료 기준**: 전체 플로우 UI에서 동작 확인

---

### Phase F — App.tsx 통합
- ContentStudio 진입점 추가 (VideoStudio 대체 또는 병행)
- currentAnalysis → ContentStudio props 연결
- anchorProfile → 미들웨어 context_anchor 연결

---

## 5. 구현 우선순위 (MVP 범위)

### MVP (Phase A-C) — 핵심 파이프라인
```
Layer 0 → Layer 1(Claude) → Layer 2 → Layer 3(Claude) → Layer 4
→ ModalityPrompts → Video + Image + Music
```

### 2차 (Phase D-F) — UI + 새 모달리티
- ContentStudio UI
- musicService (Lyria)
- App.tsx 통합

### 3차 (미래) — 고급 기능
- Layer 5 품질 게이트 + 재샘플링
- Layer 6 Firestore 지속성
- GV 자동 조정 피드백

---

## 6. 기존 코드 변경 최소화 원칙

| 파일 | 처리 방식 |
|------|----------|
| `services/promptPipeline.ts` | 유지 (Series Video에서 그대로 사용) |
| `components/VideoStudio.tsx` | 유지 + ContentStudio에서 호출 |
| `components/ImageStudio.tsx` | 유지 + ContentStudio에서 호출 |
| `services/videoService.ts` | 유지 (contentRouter에서 호출) |
| `services/imageService.ts` | 유지 (contentRouter에서 호출) |
| `App.tsx` | 최소 변경 (ContentStudio 진입점 추가만) |

---

## 7. 작업 이어받기 기준점

작업이 끊길 경우 이 문서를 참조. 각 Phase는 독립적으로 완료 가능.

**현재 상태**: Phase A 시작 전

**체크포인트**:
- [ ] Phase A: types.ts + constants.ts 완료
- [ ] Phase B-1: Layer 0 완료
- [ ] Phase B-2: Layer 1 완료  
- [ ] Phase B-3,4: Layer 2-3 완료
- [ ] Phase B-5: Layer 4 (핵심 프롬프트 컴파일러) 완료
- [ ] Phase B: pipeline.ts 완료
- [ ] Phase C: Bridge + Router 완료
- [ ] Phase D: musicService 완료
- [ ] Phase E: ContentStudio UI 완료
- [ ] Phase F: App.tsx 통합 완료

---

## 8. 핵심 설계 결정 사항

1. **Layer 1, 3 LLM은 Claude 사용** (기존 ARHA와 통일, Gemini 아님)
2. **Layer 0, 2, 4는 결정론적** — API 호출 없음, 빠르고 안정적
3. **미들웨어 서버 엔드포인트**: `api/middleware.js` 신규 생성
   - Layer 1 + Layer 3 Claude 호출을 서버에서 처리
   - Layer 0, 2, 4는 클라이언트에서 처리 (또는 서버에서 통합)
4. **GV(Golden Vector) MVP**: GV_ARHA_Conversation, GV_Cinematic_Noir_v2, GV_Code_Generation 3개만 구현
5. **모달리티 MVP**: video, image, music (코드/디자인/기획은 2차)

# ARHA 감성 프로필 DB 시스템 설계
**날짜:** 2026-03-31
**상태:** 설계 확정 (구현 대기)

---

## 1. 목표

로그인 회원의 감정/행동 패턴, 친밀도(kappa), 가치사슬(V1-V7) 공명도를 Firestore에 누적 저장하고, 매 세션 시작 시 User Memory Block으로 시스템 프롬프트에 주입해 ARHA가 사용자를 점점 더 깊이 이해하는 연속적·동적 시스템을 구현한다.

### 핵심 해결 문제
1. `kappa`(친밀도)가 세션 시작 때마다 0으로 리셋됨
2. 사용자별 감정·행동 패턴이 대화에 누적되지 않음
3. DB → 시스템 프롬프트 피드백 루프 없음
4. 가치사슬(V1-V7) 공명도가 측정·반영되지 않음

---

## 2. Firestore 스키마

### 기존 구조 (변경 없음)
```
users/{uid}/
  profile/info          — tier, stripe, displayName, email
  usage/monthly         — 메시지 카운트
  sessions/{id}         — 채팅 내역
  valueProfile/keywords — 키워드 가중치 (태그 기반)
  persona/config        — 페르소나 설정
```

### 신규 추가: `emotionProfile/` 서브컬렉션

#### `emotionProfile/lifetime`
전체 통산 누적값 (세션 종료 시 업데이트, 3 writes/session)
```typescript
{
  kappa_lifetime:    number;   // 0.0-1.0, 전 세션 평균 친밀도
  total_turns:       number;   // 전체 누적 턴 수
  psi_centroid:      number;   // Ψ 중심점 (장기 감정 무게 중심)
  surge_history:     Array<{   // 강렬한 감정 폭발 이력 (최대 20개)
    ts: number;                // Unix timestamp
    mode: string;              // expressionMode
    level: number;             // surgeRisk 값
  }>;
  dominant_expression_mode: string;  // 가장 빈번한 expressionMode
  expression_distribution:  Record<string, number>;  // mode → 턴 비율
  updatedAt: Timestamp;
}
```

#### `emotionProfile/sessionStats`
세션별 요약 배열 (세션 종료 시 append)
```typescript
{
  sessions: Array<{
    sessionId:       string;
    date:            string;   // KST YYYY-MM-DD
    turn_count:      number;
    kappa_end:       number;
    dominant_mode:   string;
    topic_cluster:   string;   // 세션 주제 요약 (Claude 생성 or 키워드 조합)
    persona_used:    string;
    active_values:   string[]; // 해당 세션 top 3 active_values
  }>;
  updatedAt: Timestamp;
}
```

#### `emotionProfile/currentSession`
실시간 세션 상태 (매 턴 업데이트, 세션 종료 시 삭제)
```typescript
{
  sessionId:      string;
  turn_count:     number;
  kappa_current:  number;
  psi_current:    number;
  expression_mode_history: string[];  // 이번 세션 턴별 expressionMode
  surge_occurred: boolean;
  updatedAt:      Timestamp;
}
```

#### `emotionProfile/valueChain` ← **핵심 신규**
V1-V7 가치사슬 공명도
```typescript
{
  V1_Authenticity: { resonance: number; hitCount: number; lastSeen: Timestamp };
  V2_UserLove:     { resonance: number; hitCount: number; lastSeen: Timestamp };
  V3_Growth:       { resonance: number; hitCount: number; lastSeen: Timestamp };
  V4_Curiosity:    { resonance: number; hitCount: number; lastSeen: Timestamp };
  V5_Honesty:      { resonance: number; hitCount: number; lastSeen: Timestamp };
  V6_Courage:      { resonance: number; hitCount: number; lastSeen: Timestamp };
  V7_Creativity:   { resonance: number; hitCount: number; lastSeen: Timestamp };
  totalTurnsTracked: number;
  updatedAt: Timestamp;
}
```

**공명도 계산식:** `resonance[Vn] = hitCount[Vn] / totalTurnsTracked`
(0.0-1.0, 자동 정규화)

---

## 3. 데이터 플로우

### 세션 시작
```
App.tsx useEffect(auth)
  → getUserProfile(uid)          // tier, stripe
  → getEmotionProfile(uid)       // lifetime + valueChain
  → buildUserMemoryBlock(...)    // User Memory Block 구성
  → currentSession 초기화 (로컬 state)
  → kappa_effective = max(session_kappa_start=0, lifetime.kappa_lifetime × 0.7)
```

### 매 턴 (handleSend)
```
사용자 메시지 입력
  → POST /api/chat { userMemoryBlock, messages, ... }
    → [PIPELINE] 블록에서 추출:
       - expressionMode, kappa, surgeRisk, active_values
    → 응답 반환
  → currentSession 로컬 업데이트:
       turn_count++, kappa_current, expression_mode_history.push(mode)
       valueHits 로컬 누적 (active_values 파싱)
  → (Firestore write 없음 — 성능 최적화)
```

### 세션 종료 (beforeunload / 명시적 종료)
```
aggregateSession(currentSession)
  → Firestore 배치 업데이트 (3 writes):
     1. emotionProfile/lifetime  — kappa_lifetime EMA, total_turns, psi_centroid
     2. emotionProfile/sessionStats — 세션 요약 append
     3. emotionProfile/valueChain   — hitCount 배치 증가, resonance 재계산
  → currentSession 문서 삭제
```

### kappa_lifetime EMA 계산
```javascript
const alpha = 0.15;  // 학습률 — 새 세션이 과거를 천천히 덮음
kappa_lifetime_new = alpha × kappa_session_end + (1 - alpha) × kappa_lifetime_old;
```

---

## 4. User Memory Block

세션 시작 시 시스템 프롬프트 앞에 주입되는 블록.

### 주입 조건 (total_turns 기준)
| 조건 | 내용 |
|------|------|
| total_turns < 5 | 주입 없음 (데이터 불충분) |
| 5 ≤ total_turns < 28 | Brief 버전 (kappa, dominant_mode, top 1 value) |
| total_turns ≥ 28 | Full 버전 (아래 전체 블록) |

### Full 버전 형식
```
[USER_MEMORY_BLOCK]
── INTIMACY ────────────────────────────
kappa_eff: 0.68  (lifetime: 0.72, session_start: 0.0)
total_turns: 143  |  sessions: 12
last_seen: 2026-03-29

── EXPRESSION ──────────────────────────
dominant_mode: DEEP_EMPATHY (38%)
distribution: { DEEP_EMPATHY:38, REFLECTIVE_GROW:22, SOFT_WARMTH:19, ... }
psi_centroid: 0.31  (양수=따뜻함 중심)

── V_CHAIN ─────────────────────────────
dominant: [Curiosity(0.91), Authenticity(0.82), Creativity(0.78)]
emerging: [Growth(0.74)]
suppressed: [Courage(0.43)]

── TOPICS ──────────────────────────────
recent: ["창작 작업 고민", "자기 표현", "관계 피로감"]
[/USER_MEMORY_BLOCK]
```

---

## 5. 가치사슬(V1-V7) 수집 → 표현 → 적용

### 수집
- 매 턴 `[PIPELINE]` 블록에서 `r3.active_values` 파싱
- 로컬 state에 `valueHits: Record<string, number>` 누적
- 세션 종료 시 Firestore `valueChain.hitCount` 배치 업데이트

**`api/chat.js` 응답에 active_values 포함:**
```javascript
// [PIPELINE] 블록 파싱 후 응답 body에 추가
res.json({ ..., pipeline: { expressionMode, kappa, surgeRisk, active_values } });
```

### 표현 (프로필 페이지 "가치 공명 지도")
```
호기심 ████████████████████ 91%  ★ 1위 (amber)
진정성 ████████████████     82%  ★ 2위 (amber)
창의성 ████████████████     78%  ★ 3위 (amber)
성장   ██████████████       74%     (teal)
사랑   ████████████         61%     (teal)
정직   ███████████          55%     (teal)
용기   ████████             43%     (gray)
```

**색상 규칙:** resonance ≥ 0.75 → amber/gold, 0.5-0.74 → teal, < 0.5 → gray

**ARHA 코멘트:** 상위 2개 V 조합 → 정적 문자열 맵 (API 호출 없음)
```typescript
const VALUE_COMBO_COMMENTS: Record<string, string> = {
  'V4_Curiosity+V1_Authenticity': "지적 호기심과 진정성이 자주 빛나요. 그 조합이 우리 대화를 특별하게 만들어요.",
  'V7_Creativity+V3_Growth': "창의적 성장을 향해 나아가는 에너지가 느껴져요.",
  // ... 21가지 조합 (C(7,2) = 21)
}
```

### 적용 (시스템 프롬프트 피드백)
`USER_MEMORY_BLOCK`의 `V_CHAIN.dominant` → SLIM_CORE `r3.active_values` 선택 시 자연스럽게 해당 값 우선 활성화

**추가 적용 규칙 (`api/chat.js` buildSystemPromptV2):**
```javascript
if (dominantValues.includes('V7_Creativity')) {
  // 메타포/이미지 언어 선호 지시 추가
}
if (dominantValues.includes('V1_Authenticity')) {
  // surgeRisk threshold 상향 (0.65→0.75) — 과장 표현 억제
}
```

---

## 6. UX / 프라이버시 설계

### 온보딩 카드 (첫 로그인 후 표시)
- "ARHA가 대화를 통해 당신을 이해해 나가요" 설명
- 수집 항목 명시: 감정 패턴, 친밀도, 관심 가치
- 체크박스: "감정 프로필 수집 동의" (동의 안 하면 `emotionProfile` 쓰기 스킵)
- consent 값을 `profile/info.emotionConsent: boolean`에 저장

### 프로필 페이지 섹션 구성
1. **기본 정보** — 아바타, 이름, 등급 배지
2. **대화 통계** — 총 턴 수, 세션 수, 첫 대화일
3. **감정 공명** — dominant expressionMode + psi_centroid 시각화
4. **가치 공명 지도** — V1-V7 bar chart + ARHA 코멘트
5. **대화 기록 내보내기** — JSON 다운로드
6. **Danger Zone** — 감정 프로필 초기화 / 계정 삭제

### 게스트 → 로그인 병합
- 게스트 세션은 `localStorage.arha_guest_session`에 임시 저장
- 로그인 시 해당 세션의 `valueHits`를 Firestore에 병합 (1회 한정)

### 삭제권
- "감정 프로필 초기화" → `emotionProfile/` 4개 문서 전체 삭제
- 계정 삭제 → `users/{uid}/` 전체 + Firebase Auth 삭제

---

## 7. 구현 파일 목록

### 신규 파일
| 파일 | 역할 |
|------|------|
| `services/emotionProfileService.ts` | Firestore emotionProfile CRUD + aggregation |
| `components/UserProfilePage.tsx` | 프로필 페이지 (가치 공명 지도 포함) |
| `components/OnboardingCard.tsx` | 첫 로그인 동의 카드 |

### 수정 파일
| 파일 | 변경 내용 |
|------|----------|
| `types.ts` | `EmotionProfile`, `ValueChain`, `UserMemoryBlock` 타입 추가 |
| `api/chat.js` | 응답에 `pipeline.active_values` 포함, User Memory Block 처리 |
| `App.tsx` | emotionProfile 로드, 매 턴 valueHits 누적, 세션 종료 집계, UserProfilePage 라우팅 |
| `components/AccountPage.tsx` | "감정 프로필 보기" 버튼 → UserProfilePage |

---

## 8. 성능 / 비용 최적화

| 전략 | 상세 |
|------|------|
| 턴별 Firestore 쓰기 없음 | currentSession은 로컬 state만, 세션 종료 시에만 write |
| 배치 업데이트 | 세션 종료 시 3 writes로 모든 문서 업데이트 |
| 조건부 주입 | total_turns < 5 → User Memory Block 주입 안 함 |
| 정적 코멘트 맵 | 가치 코멘트 생성에 API 호출 없음 |
| EMA kappa | 전체 이력 저장 대신 지수 이동 평균 1개 값만 유지 |

---

## 9. 검증 체크리스트

- [ ] 첫 로그인 → OnboardingCard 표시 → 동의 시 `emotionConsent: true` 저장
- [ ] 매 턴 후 로컬 `valueHits` 카운트 증가 확인
- [ ] 세션 종료 (새로고침) 시 Firestore `valueChain.hitCount` 업데이트 확인
- [ ] 다음 세션 시작 시 `kappa_effective > 0` 확인 (리셋 방지)
- [ ] `total_turns ≥ 28` 사용자 → User Memory Block 시스템 프롬프트 주입 확인
- [ ] UserProfilePage V1-V7 bar chart 렌더링 확인
- [ ] "감정 프로필 초기화" → Firestore emotionProfile 전체 삭제 확인
- [ ] `npx tsc --noEmit` 통과
- [ ] `npm run build` 통과

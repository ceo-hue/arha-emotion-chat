# @ceo-hue/arha-engine

ARHA Emotion Vector Engine — Self-hosted package
라이선스 키 + 본인 Anthropic API 키로 ARHA 엔진을 직접 구동합니다.

---

## 설치

### 1. GitHub Packages 인증 설정

프로젝트 루트 또는 `~/.npmrc`에 추가:

```
@ceo-hue:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

> GitHub Token은 `Settings → Developer settings → Personal access tokens`에서
> `read:packages` 권한으로 발급합니다.

### 2. 패키지 설치

```bash
npm install @ceo-hue/arha-engine
```

---

## 사용법

```js
import { ArhaEngine } from '@ceo-hue/arha-engine';

const arha = new ArhaEngine({
  anthropicKey: process.env.ANTHROPIC_API_KEY, // 본인 Anthropic 키
  arhaLicense:  process.env.ARHA_LICENSE_KEY,  // ARHA 라이선스 키 (arha_lic_...)
});

const result = await arha.chat({
  persona: {
    summary: '차갑지만 내심 걱정하는 캐릭터. 직접적이고 간결하게 말한다.',
    triggers: [
      {
        conditionKeywords: ['힘들', '지쳐', '울고 싶'],
        labelEn: 'Distress Detected',
        emoji: '😔',
        conditionDesc: '유저가 감정적으로 힘든 상태',
        responseDirective: '차가운 어조를 유지하되 짧게 위로한다',
        preferredOperator: 'amplify',
      },
    ],
  },
  blocks: [
    {
      role: 'main',
      nameEn: 'Cold Distance',
      funcNotation: 'Ψ_cold',
      vector: { x: 0.8, y: 0.2, z: 0.6 },
      influence: 0.7,
      operatorType: 'transform',
      interpretX: '논리적, 분석적, 사실 중심',
      interpretY: '감정 절제, 개인적 감정 숨김',
      interpretZ: '차갑고 거리감 있는 어조',
      essenceProperties: { temperature: -0.7, distance: 0.8 },
      keywords: ['차갑', '거리감', '냉정'],
    },
  ],
  message: '요즘 너무 힘들어',
  history: [], // 이전 대화 [{ role: 'user'|'assistant', content: '...' }]
});

console.log(result.response);
// → "...ARHA 캐릭터 응답..."

console.log(result.conflictIndex);   // 벡터 충돌도 (0~1, 낮을수록 좋음)
console.log(result.vectorDistance);  // 의도 벡터 정합도 (0~1, 높을수록 좋음)
console.log(result.axisBreakdown);   // { x, y, z } 각 축 기여도
console.log(result.activatedTriggers); // 활성화된 트리거 목록
```

---

## 응답 스키마

```ts
interface ArhaResult {
  response: string;          // Claude가 생성한 캐릭터 응답
  conflictIndex: number;     // 0~1, 벡터 키워드 충돌도 (낮을수록 좋음)
  vectorDistance: number;    // 0~1, 의도-실제 벡터 코사인 유사도
  axisBreakdown: {
    x: number;               // X축(객관성) 기여 비율
    y: number;               // Y축(주관성) 기여 비율
    z: number;               // Z축(에센스) 기여 비율
  };
  activatedTriggers: string[]; // 활성화된 트리거 레이블 배열
}
```

---

## 라이선스 키 발급

라이선스 키(`arha_lic_...`)는 ARHA 어드민에서 발급받습니다.
문의: [ceo@onairplanet.com](mailto:ceo@onairplanet.com)

---

## 요구사항

- Node.js 18+
- 본인 Anthropic API 키 ([anthropic.com](https://anthropic.com))
- ARHA 라이선스 키

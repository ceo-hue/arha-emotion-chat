/**
 * ARHA AnalysisData → 미들웨어 입력 브릿지
 * 감성 분석 결과를 미들웨어 설정으로 변환
 */

import type { MiddlewareConfig, ARHAAnalysisInput, ContentModality } from './middleware/types';

/** App.tsx의 AnalysisData 타입 (실제 타입과 호환) */
export interface AnalysisData {
  psi?: { x: number; y: number; z: number };
  expression_mode?: string;
  trajectory?: string;
  surge_risk?: number;
  resonance?: number;
  delta_psi?: number;
  // kappa는 별도 파라미터로 받음
}

/**
 * ARHA 현재 분석 데이터를 미들웨어 설정으로 변환
 */
export function buildMiddlewareConfig(
  analysis: AnalysisData | null | undefined,
  kappa: number,
  targetModalities: ContentModality[],
  harnessState?: MiddlewareConfig['harness_state'],
): MiddlewareConfig {
  const arha_input: ARHAAnalysisInput | undefined = analysis
    ? {
        psi:            analysis.psi ?? { x: 0, y: 0, z: 0 },
        expressionMode: analysis.expression_mode ?? 'SOFT_WARMTH',
        trajectory:     analysis.trajectory ?? 'stable',
        surge_risk:     analysis.surge_risk ?? 0.1,
        resonance:      analysis.resonance ?? 0.5,
        delta_psi:      analysis.delta_psi ?? 0,
        kappa,
        emotion_label:  undefined,
      }
    : undefined;

  return {
    target_modalities:     targetModalities,
    analysis_data:         arha_input,
    harness_state:         harnessState,
    enable_quality_gate:   false, // MVP: 품질 게이트 비활성
    max_resample_attempts: 2,
  };
}

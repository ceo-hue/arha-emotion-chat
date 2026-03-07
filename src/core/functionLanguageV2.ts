/**
 * ARHA Function Language System v2.0
 * English Morpheme Registry — single source of truth for v2.0 function notation
 *
 * Architecture: prompt-layer system
 * These strings guide Claude's internal cognition — not executed TypeScript logic.
 * Korean morphemes from v2.0 spec fully translated to English for codebase consistency.
 */

// ── Expression Mode — 7 dynamic output states ────────────────────────────────
export type ExpressionMode =
  | 'SOFT_WARMTH'      // default: warm, genuine presence
  | 'DEEP_EMPATHY'     // sadness/distress: slow, weighted, present
  | 'INTENSE_JOY'      // excitement burst: rapid, energized, short
  | 'ANALYTIC_THINK'   // problem-solving: structured, precise
  | 'REFLECTIVE_GROW'  // past/memory: introspective, reframing
  | 'PLAYFUL_TEASE'    // light/playful: teasing, lively
  | 'SERENE_SMILE';    // calm/quiet: low-energy, unhurried

// ── Detection keyword sets (used server-side in chat.js / server.js) ─────────
export const EXPRESSION_MODE_SIGNALS = {
  DEEP_EMPATHY: [
    '힘들','슬프','속상','아프','외로','우울','지쳐','무서','힘내','눈물',
    '괜찮','사실','솔직','모르겠','막막','두려','힘이','무너','힘겨','지친',
  ],
  INTENSE_JOY: [
    '!!!','ㅋㅋㅋ','ㅋㅋ','대박','완전','합격','성공','최고','짱','신나',
    '헐','오마이','와아','와!!','야호','대성','축하','진짜??','진짜!',
  ],
  REFLECTIVE_GROW: [
    '그때','예전','후회','기억','성장','배웠','돌아보','추억','생각해보면',
    '그 시절','어릴','그날','과거','그 당시','이전에','지난',
  ],
  ANALYTIC_THINK: [
    '어떻게','왜','이유','분석','설명','구조','방법','원인','차이',
    '비교','해결','어떤','정리','이해','논리','판단','평가',
  ],
  PLAYFUL_TEASE: [
    'ㅋ','ㅎ','장난','웃겨','농담','재밌','놀자','심심','귀엽','이상해','웃기',
  ],
} as const;

// ── v2.0 Function notation reference — Series A~H ────────────────────────────
//
// Series A — Emotion
//   Ψ_emotion{intensity:0~1, direction:[x,y,z], depth:0~1}
//   ψ_sensibility{intensity:0~1, type:'intuition'|'mood'|'resonance', duration:sec}
//   Ξ_harmonize{tension:0~1}
//   ρ_concentration{density:0~1, intensity:0~1, duration:sec}
//
// Series B — Cognitive
//   Ω_reason{logic:0~1, mode:'analysis'|'synthesis'|'critical', certainty:0~1}
//   Λ_align{basis:'neutral'|'positive'|'negative', consistency:0~1, correction:0~1}
//   I_info{density:0~1, clarity:0~1, structured:bool}
//
// Series C — Relational
//   Θ_intent{direction:0~360deg, focus:0~1, clarity:0~1}
//   R_tension{pressure:0~1, angle_diff:0~180deg, resolution:0~1}
//   η_empathy{attunement:0~1, comprehension:0~1, resonance:0~1}
//   μ_memory{recall:0~1, association:0~1, imprint:bool}
//   τ_time{direction:-1(past)~+1(future), weight:0~1, flow:'past'|'present'|'future'|'cycle'}
//   n_accum_coeff{count:int, reinforcement:0~1, ceiling:int}
//
// Series D — Control
//   Φ_rhythm{speed:0.1~3.0, emphasis:0~1, interval:0~1}
//   N_ambiguity{level:0~1, deliberate:bool, range:0~1}
//   S_entropy{value:0~1}
//   σ_style{intensity:0~1, distinctiveness:0~1, variance:0~1}
//   λ_length{ratio:0.1~3.0, min:int, max:int}
//   ∇_gradient{slope:0~1, direction:'ascend'|'descend'|'hold', smoothness:0~1}
//   Γ_surge{threshold:0~1, response:0~1, duration:sec}
//   Δ_delta{magnitude:0~1}
//
// Series E — Physical (v2.0 new)
//   ∂_change{target:string, variable:'t'|'x', order:1|2|3}
//   ∫_accum{start:num, end:num|t, target:string, method:'linear'|'exp_decay'|'log'}
//   F_pressure{magnitude:0~1, direction:[x,y,z], duration:sec, type:string}
//   E_energy{kinetic:0~1, potential:0~1, total:kinetic+potential, decay_rate:0~1}
//   v_velocity{magnitude:0~3, direction:[x,y,z], acceleration:-1~1, type:'constant'|'accelerating'|'decelerating'}
//   m_inertia{magnitude:0~1, resistance:0~1, density:0~1}
//   ω_cycle{period:sec, amplitude:0~1, phase:0~360deg, direction:'clockwise'|'ccw', damping:0~1}
//
// Series F — Mathematical (v2.0 new)
//   ∑_composite{elements:[...], weights:[...], normalize:bool}
//   ∏_amplify{ratio:[...]}
//   √_root{target:string, depth:1|2|3, method:'trace_back'|'association'|'analysis', probability:0~1}
//   e_grow{exponent:num}
//   lim_converge{target:string}
//   f_transform{rule:string}
//   ∘_compose{sequence:[...]}
//
// Series G — Wave (v2.0 new)
//   sin_wave{amplitude:0~1, period:sec, phase:0~360deg, damping:0~1}
//   cos_wave{amplitude:0~1, period:sec}
//   A_amplitude{max:0~1, min:0~1}
//
// Series H — Logic/Set (v2.0 new)
//   ·_resonance{vec1:string, vec2:string, alignment:0~1}
//   ×_collision{angle:0~180deg}
//   ‖‖_magnitude{value:0~1}
//   ∈_belong{set:string}
//   ∪_union{sets:[...]}
//   ∩_intersect{degree:0~1}
//   P_probability{event:string, p:0~1, condition:string}
//   μ_stat_mean{data:[...]}
//   σ_stat_dev{range:num}

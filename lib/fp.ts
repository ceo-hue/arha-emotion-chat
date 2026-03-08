
// ═══════════════════════════════════════════════════════════
//  FP Core — Result<E,A> · pipe · Option · delay
//  함수형 프로그래밍 기반 유틸리티 모음
// ═══════════════════════════════════════════════════════════

/** Either 타입 — 성공(Ok) 또는 실패(Err)를 명시적으로 표현 */
export type Result<E, A> =
  | { readonly _tag: 'Ok';  readonly value: A }
  | { readonly _tag: 'Err'; readonly error: E }

export const ok  = <A>(value: A): Result<never, A>  => ({ _tag: 'Ok',  value })
export const err = <E>(error: E): Result<E, never>  => ({ _tag: 'Err', error })

export const isOk  = <E, A>(r: Result<E, A>): r is { _tag: 'Ok';  value: A } => r._tag === 'Ok'
export const isErr = <E, A>(r: Result<E, A>): r is { _tag: 'Err'; error: E } => r._tag === 'Err'

/** Result를 변환 — 성공 값에 함수 적용 */
export const mapResult = <E, A, B>(f: (a: A) => B) =>
  (r: Result<E, A>): Result<E, B> => {
    switch (r._tag) {
      case 'Ok':  return ok(f(r.value))
      case 'Err': return err(r.error)
    }
  }

/** Result를 체이닝 — 성공 시 다음 Result 반환 */
export const chainResult = <E, A, B>(f: (a: A) => Result<E, B>) =>
  (r: Result<E, A>): Result<E, B> => {
    switch (r._tag) {
      case 'Ok':  return f(r.value)
      case 'Err': return err(r.error)
    }
  }

/** Result를 단일 값으로 폴딩 */
export const foldResult = <E, A, B>(onErr: (e: E) => B, onOk: (a: A) => B) =>
  (r: Result<E, A>): B => {
    switch (r._tag) {
      case 'Ok':  return onOk(r.value)
      case 'Err': return onErr(r.error)
    }
  }

/** 실패 시 기본값 반환 */
export const getOrElse = <A>(defaultValue: A) =>
  <E>(r: Result<E, A>): A =>
    isOk(r) ? r.value : defaultValue

// ── 단방향 파이프라인 합성 ────────────────────────────────

/** pipe — 왼쪽에서 오른쪽으로 함수 합성 (같은 타입 A → A) */
export const pipe = <A>(...fns: ReadonlyArray<(x: A) => A>) =>
  (x: A): A => fns.reduce((v, f) => f(v), x)

/** pipeWith — 다른 타입 간 파이프라인 (A → B → C) */
export const pipeWith = <A, B>(f: (a: A) => B) => f

/** compose2 — 두 함수 합성 */
export const compose2 = <A, B, C>(f: (b: B) => C, g: (a: A) => B) =>
  (a: A): C => f(g(a))

// ── 비동기 유틸리티 ───────────────────────────────────────

/** 지정 시간(ms) 대기 */
export const delay = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms))

// ── 불변 컬렉션 유틸리티 ──────────────────────────────────

/** 리스트 앞에 항목 삽입 + 최대 길이 제한 (불변) */
export const prependCapped = <A>(item: A, maxLen: number) =>
  (list: ReadonlyArray<A>): ReadonlyArray<A> =>
    [item, ...list.slice(0, maxLen - 1)]

/** 리스트에서 중복 제거 (키 함수 기준) */
export const uniqueBy = <A>(keyFn: (a: A) => string) =>
  (list: ReadonlyArray<A>): ReadonlyArray<A> =>
    Array.from(
      new Map(list.map(item => [keyFn(item), item])).values()
    )

// ── 숫자 유틸리티 ─────────────────────────────────────────

/** 값을 [min, max] 범위로 제한 */
export const clamp = (min: number, max: number) =>
  (n: number): number => Math.min(max, Math.max(min, n))

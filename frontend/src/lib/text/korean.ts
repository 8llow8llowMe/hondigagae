/**
 * 한국어 조사 선택.
 *
 * 사용자가 입력한 이름을 문장에 넣을 때 필요하다. 반려견 이름은 "몽실이"(종성 없음)
 * 처럼 모음으로 끝날 수도 "곰"(종성 있음)처럼 자음으로 끝날 수도 있어, 조사를
 * 고정하면 한쪽이 반드시 틀린다 ("몽실이 을 삭제할까요?").
 *
 * **실측에서 발견한 버그다.** 렌더 테스트는 이름이 문구에 들어가는지만 단언해
 * 조사가 틀린 것을 볼 수 없었다 (testing-guide.md §1 이 명시한 한계).
 */

const HANGUL_BASE = 0xac00
const HANGUL_LAST = 0xd7a3
/** 한 초성·중성 조합당 종성 28개 (종성 없음 포함) */
const JONGSEONG_COUNT = 28

/**
 * 마지막 글자에 종성이 있는가.
 *
 * 완성형 한글 음절이 아니면 판정할 수 없어 `null` 을 준다 — 호출부가 기본값을
 * 정한다. 영문·숫자의 발음 기반 판정(예: "7" → "칠" → 종성 있음)은 하지 않는다.
 * 규칙이 커지는데 이 서비스의 이름 입력은 한글이 압도적이다.
 */
function hasJongseong(word: string): boolean | null {
  const last = word.at(-1)
  if (last === undefined) return null

  const code = last.charCodeAt(0)
  if (code < HANGUL_BASE || code > HANGUL_LAST) return null

  return (code - HANGUL_BASE) % JONGSEONG_COUNT !== 0
}

function attach(word: string, withJong: string, withoutJong: string): string {
  // 붙일 대상이 없으면 그대로 돌려준다. 스키마가 빈 이름을 막지만(PET_101)
  // 함수 자체는 총체적이어야 호출부가 방어를 중복하지 않는다
  if (word.trim() === '') return word

  const jong = hasJongseong(word)
  // 판정 불가는 받침 없음으로 본다 — 영문 이름에 "를/가" 가 덜 어색하다
  return `${word}${jong === true ? withJong : withoutJong}`
}

/** 목적격 조사 (을/를) */
export function withObjectParticle(word: string): string {
  return attach(word, '을', '를')
}

/** 주격 조사 (이/가) */
export function withSubjectParticle(word: string): string {
  return attach(word, '이', '가')
}

/**
 * 주제격 조사 (은/는).
 *
 * **주격(이/가)과 바꿔 쓰지 않는다.** 피동문의 주제에는 은/는이 붙는다 —
 * "가세오름은 1일차에 담겨요" 이고 "가세오름이 담겨요" 가 아니다. 목적격을 쓰면
 * "가세오름을 담겨요" 라는 비문이 된다 (담기 시트에서 실제로 났다).
 */
export function withTopicParticle(word: string): string {
  return attach(word, '은', '는')
}

/**
 * 동반격 조사 (와/과).
 *
 * **받침 규칙이 을/를·이/가와 반대다** — 받침이 있으면 "과", 없으면 "와" 다
 * ("초코와" / "곰과"). AI 일정 제목 기본값이 반려견 이름으로 시작한다
 * (`src/lib/ai-plan/draft-title.ts`).
 */
export function withCompanionParticle(word: string): string {
  return attach(word, '과', '와')
}

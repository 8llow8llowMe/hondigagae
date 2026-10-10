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

/**
 * 괄호 주석이 붙은 말에 조사를 붙인다 — `몽실이(소형견)이`.
 *
 * **받침은 괄호 앞이 아니라 괄호 *안* 마지막 글자로 판정한다.** 기준은 소리 내어 읽는
 * 순서다 — 사람도 스크린리더도 괄호 안을 건너뛰지 않고 "몽실이 소형견이" 로 읽으므로,
 * 조사 바로 앞에 오는 소리는 `견` 이지 `이`(이름의 끝)가 아니다. 괄호 앞을 기준으로
 * 잡으면 "…소형견 **가**" 라고 들리는 비문이 된다.
 *
 * **기존 헬퍼를 그대로 못 쓰는 이유**는 `attach` 가 **마지막 글자**를 보기 때문이다.
 * 완성된 `몽실이(소형견)` 의 마지막 글자는 `)` 라 판정 불가(= 받침 없음)로 떨어져
 * 괄호 앞뒤 어느 쪽도 보지 않는다. 그래서 **주석에만** 헬퍼를 먹이고 거기서 붙은 조사를
 * 떼어 괄호 뒤로 옮긴다 — 받침 판정 규칙을 이 파일에 한 벌로 유지하려는 것이다.
 *
 * @param word 괄호 앞에 오는 말 (반려견 이름)
 * @param note 괄호 안 주석 (크기 이름). 받침 판정의 기준이 된다
 * @param withParticle 붙일 조사 헬퍼 — `withSubjectParticle` 처럼 이 파일의 것을 준다
 */
export function withParenthesizedParticle(
  word: string,
  note: string,
  withParticle: (value: string) => string,
): string {
  // 주석이 비면 괄호를 그리지 않는다 — `몽실이()이` 가 나오면 안 되고, 이때는 이름이
  // 조사 바로 앞에 오므로 판정 기준도 이름으로 돌아간다
  if (note.trim() === '') return withParticle(word)

  // `withParticle(note)` 는 `주석+조사` 라 주석 길이만큼 잘라 내면 조사만 남는다
  return `${word}(${note})${withParticle(note).slice(note.length)}`
}

/**
 * 금액 입력칸의 표기와 커서 — 이슈 #986. `AmountInput`(`components/amount-input.tsx`)이 쓴다.
 *
 * **폼 값은 숫자만 든 문자열이다** (`'300000'`, 비우면 `''`). 쉼표는 입력란에 그리는 표기일 뿐
 * 폼 값 · 전송 값에 들어가지 않는다. 그래서 기존 스키마(`/^\d+$/` · 상한 · 빈 값 = "안 정했다")를
 * 한 줄도 바꾸지 않는다.
 *
 * **`Number()` · `toLocaleString` 을 거치지 않는다.** 문자열로만 자른다 — 상한을 넘긴 값은
 * 정밀도를 잃은 수로 바뀌면 안 되고(검증 문구가 "자릿수를 확인해 주세요" 다), 로케일에 따라
 * 구분자가 바뀌는 것도 막는다.
 */

const SEPARATOR = ','
const GROUP = 3

/** 입력 한 번의 결과. `caret` 은 `display` 기준 위치다 */
export type GroupedDigitsEdit = {
  /** 폼 값 — 숫자만 */
  digits: string
  /** 입력란에 그릴 표기 */
  display: string
  caret: number
}

/** 폼 값(숫자 문자열)을 입력란 표기로. 빈 값은 빈 값이다 */
export function formatGroupedDigits(value: string): string {
  const digits = extractDigits(value)
  if (digits === '') return ''

  // 맨 앞 묶음만 1~3자리이고 나머지는 전부 3자리다
  const head = digits.length % GROUP || GROUP
  const groups = [digits.slice(0, head)]
  for (let index = head; index < digits.length; index += GROUP) {
    groups.push(digits.slice(index, index + GROUP))
  }
  return groups.join(SEPARATOR)
}

/**
 * 입력 이벤트 직후의 입력란(`raw` · `caret`)을 다시 그릴 값으로 바꾼다.
 *
 * **커서는 "앞에 숫자가 몇 개 있었나" 로 옮긴다.** 글자 위치로 옮기면 쉼표가 생기거나 사라질
 * 때마다 한 칸씩 어긋난다. 숫자 개수는 표기와 무관해서, 다시 그린 뒤에도 방금 친 숫자 바로
 * 뒤가 같은 자리다.
 *
 * - `previousDigits` — 이 입력 전의 폼 값. 쉼표만 지워진 편집을 알아보는 데 쓴다
 * - `inputType` — `InputEvent.inputType`. 모르면 `null` 이고, 그때는 쉼표만 지운 편집을
 *   되살린다 (어느 쪽 숫자를 지울지 추측하지 않는다)
 */
export function editGroupedDigits({
  raw,
  caret,
  previousDigits,
  inputType,
}: {
  raw: string
  caret: number
  previousDigits: string
  inputType: string | null
}): GroupedDigitsEdit {
  let digits = extractDigits(raw)
  let before = extractDigits(raw.slice(0, caret)).length

  /*
    쉼표만 지워진 편집 — 숫자는 그대로인데 지우기였다. 그대로 두면 다시 그릴 때 쉼표가
    되살아나 "눌렀는데 아무 일도 없다" 가 된다. 쉼표는 사용자가 친 글자가 아니므로 그 옆 숫자를
    지운 것으로 읽는다: 백스페이스는 앞, Delete 는 뒤.
  */
  if (digits === previousDigits) {
    if (inputType === 'deleteContentBackward' && before > 0) {
      digits = digits.slice(0, before - 1) + digits.slice(before)
      before -= 1
    } else if (inputType === 'deleteContentForward' && before < digits.length) {
      digits = digits.slice(0, before) + digits.slice(before + 1)
    }
  }

  // 앞자리 0 은 뗀다 — `0` 하나만은 값("예산 0원")이라 남긴다
  const leadingZeros = digits.length - digits.replace(/^0+/, '').length
  const removed = Math.min(leadingZeros, digits.length - 1)
  if (removed > 0) {
    digits = digits.slice(removed)
    before = Math.max(0, before - removed)
  }

  const display = formatGroupedDigits(digits)
  return { digits, display, caret: caretAfterDigits(display, before) }
}

/**
 * 숫자만 남긴다. **전각 숫자(`３`)도 숫자로 읽는다** — NFKC 가 ASCII 로 접는다. 한국어 IME 의
 * 전각 모드나 문서에서 복사한 금액이 그렇게 온다.
 */
function extractDigits(value: string): string {
  return value.normalize('NFKC').replace(/\D/g, '')
}

/** 표기에서 숫자 `count` 개 **바로 뒤** 위치. 0 이면 맨 앞이다 */
function caretAfterDigits(display: string, count: number): number {
  if (count <= 0) return 0
  let seen = 0
  for (let index = 0; index < display.length; index += 1) {
    if (display[index] !== SEPARATOR) seen += 1
    if (seen === count) return index + 1
  }
  return display.length
}

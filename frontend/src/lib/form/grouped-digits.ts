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
 *   되살리고 앞자리 0 도 떼지 않는다 (추측으로 숫자를 지우지 않는다)
 *
 * **정수만 받는다.** 붙여넣기(`insertFromPaste` · `insertFromDrop`)의 소수부는 버리고, 직접 친
 * `.` 은 여느 글자처럼 무시한다. 천 단위 구분이 `.` 인 로케일 표기(`300.000`)는 이 서비스
 * 대상이 아니라 소수로 읽는다.
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
  const pasted = inputType === 'insertFromPaste' || inputType === 'insertFromDrop'
  const input = pasted ? dropPastedFraction(raw, caret) : { raw, caret }

  let digits = extractDigits(input.raw)
  let before = extractDigits(input.raw.slice(0, input.caret)).length

  /*
    쉼표만 지워진 편집 — 숫자는 그대로인데 지우기였다. 그대로 두면 다시 그릴 때 쉼표가
    되살아나 "눌렀는데 아무 일도 없다" 가 된다. 쉼표는 사용자가 친 글자가 아니므로 그 옆 숫자를
    지운 것으로 읽는다: 백스페이스는 앞, Delete 는 뒤.
  */
  if (digits === previousDigits) {
    // 단어 · 줄 단위 지우기(`deleteWordBackward` 등)도 쉼표만 지웠으면 같은 규칙이다
    if (inputType !== null && /^delete.*Backward$/.test(inputType) && before > 0) {
      digits = digits.slice(0, before - 1) + digits.slice(before)
      before -= 1
    } else if (
      inputType !== null &&
      /^delete.*Forward$/.test(inputType) &&
      before < digits.length
    ) {
      digits = digits.slice(0, before) + digits.slice(before + 1)
    }
  }

  /*
    앞자리 0 은 **치는 편집에서만** 뗀다. 지우기로 생긴 앞자리 0 은 사용자가 지우지 않은 숫자라
    남긴다 — `3|00,000` 에서 3 을 지우고 5 를 치면 `500,000` 이어야 한다(떼면 `0` → `50`).
    남은 `00,000` 은 포커스를 떠날 때 `normalizeGroupedDigits` 가 정리한다. 두 경우 모두
    `Number()` 로 읽은 값은 같다.
  */
  if (inputType?.startsWith('insert') === true) {
    const removed = leadingZerosToDrop(digits)
    if (removed > 0) {
      digits = digits.slice(removed)
      before = Math.max(0, before - removed)
    }
  }

  const display = formatGroupedDigits(digits)
  return { digits, display, caret: caretAfterDigits(display, before) }
}

/**
 * 포커스를 떠날 때의 정리 — 지우기로 남은 앞자리 0 을 뗀다(`00000` → `0`, `000500` → `500`).
 * `0` 하나만은 값("예산 0원")이라 남기고, 빈 값은 빈 값이다. `Number()` 로 읽은 값은 바뀌지 않는다.
 */
export function normalizeGroupedDigits(digits: string): string {
  return digits.slice(leadingZerosToDrop(digits))
}

/** 뗄 앞자리 0 의 개수 — 전부 0 이면 하나를 남긴다 */
function leadingZerosToDrop(digits: string): number {
  const leadingZeros = digits.length - digits.replace(/^0+/, '').length
  return Math.min(leadingZeros, Math.max(0, digits.length - 1))
}

/**
 * 붙여 넣은 글자의 소수부를 버린다. **입력란의 표기에는 `.` 이 없으므로** 첫 `.` 은 방금 붙여 넣은
 * 글자 안에 있고, 붙여 넣은 글자는 커서에서 끝난다 — 그래서 `.` 부터 커서까지만 자른다. 커서 뒤의
 * 원래 숫자는 남는다(`1|,000` 에 `2.5` → `12,000`).
 */
function dropPastedFraction(raw: string, caret: number): { raw: string; caret: number } {
  const dot = raw.search(/[.．]/)
  if (dot === -1 || dot >= caret) return { raw, caret }
  return { raw: raw.slice(0, dot) + raw.slice(caret), caret: dot }
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

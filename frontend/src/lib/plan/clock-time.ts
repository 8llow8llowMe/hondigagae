import { formatStartTime } from '@/lib/plan/start-time'
import type { PlanItemDetail } from '@/types/plan'

/**
 * 전자시계 입력(`PlanItemTimeModal`)의 값 연산 — 이슈 #1028 · `일자편집-세부명세.md` G2.
 *
 * **렌더와 분리한다.** 증감 · 순환 · 두 자리 입력 · 서버 형식 변환은 전부 값으로 검증해야
 * 하는 규칙이고, 이 저장소의 테스트는 DOM 이벤트를 돌리지 못한다 (`testing-guide.md` §1).
 */

/** 시계의 두 칸 */
export type ClockField = 'hour' | 'minute'

export type ClockTime = { hour: number; minute: number }

/** 칸마다 범위. 24시간제라 `00:00`~`23:59` 다 */
export const CLOCK_MAX: Record<ClockField, number> = { hour: 23, minute: 59 }

/**
 * ▲▼ · 방향키 한 번의 폭. **시 1 · 분 5** — 일정표의 시각은 대개 5분 단위라 분을 1씩 올리면
 * `10:30` 까지 서른 번을 눌러야 한다. 5 단위가 아닌 분(`10:07`)은 숫자로 직접 친다.
 */
export const CLOCK_STEP: Record<ClockField, number> = { hour: 1, minute: 5 }

/**
 * 시각이 없고 앞 항목에도 시각이 없을 때 여는 값 (G2).
 *
 * **`10:00` 이다.** 여행 첫 일정이 대개 오전 관람·산책으로 시작하고, 둥근 값이라 어느
 * 방향으로 고치든 누르는 횟수가 적다. 이 값은 **입력의 출발점일 뿐 저장되지 않는다** —
 * 사용자가 `저장` 을 눌러야 서버에 간다.
 */
export const CLOCK_DEFAULT: ClockTime = { hour: 10, minute: 0 }

const SIZE: Record<ClockField, number> = { hour: 24, minute: 60 }

function wrap(field: ClockField, value: number): number {
  const size = SIZE[field]
  return ((value % size) + size) % size
}

/**
 * ▲▼ · 방향키 한 칸. **끝에서 반대편으로 순환한다** (`23 ↑ → 00`) — 자정을 넘는 시각을
 * 고치는 사람이 거꾸로 스물세 번 누르지 않게 한다.
 *
 * **분은 5 의 배수에 붙는다.** `07 ↑` 은 `12` 가 아니라 `10` 이다 — 한 번 누른 뒤로는 계속
 * 5 단위 눈금 위를 걷는다. 네이티브 시간 입력(`step=300`)과 같은 모양이다.
 */
export function stepClock(field: ClockField, value: number, direction: 1 | -1): number {
  const step = CLOCK_STEP[field]
  const onGrid = value % step === 0
  const next =
    direction === 1
      ? Math.floor(value / step) * step + step
      : onGrid
        ? value - step
        : Math.floor(value / step) * step

  return wrap(field, next)
}

/**
 * 키 → 다음 값. 모르는 키는 `null` 이라 호출부가 `preventDefault` 를 하지 않는다 —
 * Tab · Enter(저장) · Esc(닫기) 가 그대로 산다.
 *
 * `Home`/`End` 는 ARIA APG spinbutton 이 권하는 최솟값·최댓값이다.
 */
export function clockKeyValue(field: ClockField, value: number, key: string): number | null {
  if (key === 'ArrowUp') return stepClock(field, value, 1)
  if (key === 'ArrowDown') return stepClock(field, value, -1)
  if (key === 'Home') return 0
  if (key === 'End') return CLOCK_MAX[field]
  return null
}

export type ClockDigitResult = {
  value: number
  /** 두 번째 자리를 기다리는 첫 자리. 끝났으면 `''` */
  buffer: string
  /** 두 자리가 끝났다 — 시 칸이면 분 칸으로 넘어간다 */
  complete: boolean
}

/**
 * 숫자 한 자리를 친다. **두 자리 입력**이고 네이티브 시간 입력과 같은 규칙이다.
 *
 * - 첫 자리가 십의 자리가 될 수 있으면(시 0~2 · 분 0~5) 두 번째를 기다린다
 * - 될 수 없으면(시 3~9 · 분 6~9) 바로 `0X` 로 끝난다 — `3` 을 치고 `30` 을 기다리면 없는 시각이다
 * - 두 자리가 범위를 넘으면(`25`) 방금 친 자리로 다시 시작한다
 *
 * 분은 여기서 **1 단위**다 — 5 단위는 ▲▼ 의 폭일 뿐이다.
 */
export function typeClockDigit(field: ClockField, buffer: string, digit: number): ClockDigitResult {
  const max = CLOCK_MAX[field]

  if (buffer !== '') {
    const combined = Number(buffer) * 10 + digit
    if (combined <= max) return { value: combined, buffer: '', complete: true }
  }

  if (digit * 10 <= max) return { value: digit, buffer: String(digit), complete: false }
  return { value: digit, buffer: '', complete: true }
}

export type ClockInput = { kind: 'digit'; digit: number } | { kind: 'clear' }

/**
 * 입력칸 `onChange` 에서 방금 친 것을 읽는다.
 *
 * **`keydown` 으로 숫자를 읽지 않는다.** 모바일 가상 키보드는 `keydown` 의 `key` 를
 * `Unidentified` 로 보내는 일이 있어, 숫자는 값이 바뀐 결과(`InputEvent`)로 읽어야 한다.
 *
 * **길이로 지우기를 가르지 않는다.** 칸은 열 때·포커스할 때 전체 선택되므로, `10` 위에 `1`
 * 을 치면 원문이 `1` 로 **짧아진다** — 길이만 보면 백스페이스와 구별되지 않는다. 그래서
 * `inputType`(`insertText` · `deleteContentBackward` …)을 먼저 보고, 그것이 없는 환경에서만
 * 커서 바로 앞 글자로 물러선다.
 */
export function readClockInput({
  inputType,
  data,
  raw,
  caret,
}: {
  /** `InputEvent.inputType`. 없으면 `null` */
  inputType: string | null
  /** `InputEvent.data` — 넣은 글자. 지우기면 `null` */
  data: string | null
  /** 입력칸의 새 원문 */
  raw: string
  /** `selectionStart`. 모르면 `null` */
  caret: number | null
}): ClockInput | null {
  if (inputType !== null) {
    if (inputType.startsWith('delete')) return { kind: 'clear' }
    return lastDigit(data ?? raw)
  }

  if (raw === '') return { kind: 'clear' }
  const at = caret === null || caret < 1 ? raw.length - 1 : caret - 1
  return lastDigit(raw.charAt(at))
}

function lastDigit(text: string): ClockInput | null {
  const char = text.charAt(text.length - 1)
  if (!/^\d$/.test(char)) return null
  return { kind: 'digit', digit: Number(char) }
}

/** 두 자리 표시 — `7 → '07'` */
export function formatClockPart(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * 서버 원문 → 시계 값. 정규화는 `formatStartTime()` 하나가 전담한다 (D14-3) — 여기서
 * 정규식을 또 두지 않는다. 형식이 어긋나면 `null` 이다.
 */
export function toClockTime(value: string | null): ClockTime | null {
  const normalized = formatStartTime(value)
  if (normalized === null) return null

  const [hour, minute] = normalized.split(':').map(Number)
  return { hour: hour ?? 0, minute: minute ?? 0 }
}

/**
 * 시계 값 → 요청 본문의 `startTime`. **`HH:mm:ss`** 다 — `PlanItemRequest.startTime` 설명이
 * _"시작 시각 (HH:mm:ss)"_ 로 못박았다 (G1 · 2026-09-18 실호출).
 */
export function toServerStartTime(time: ClockTime): string {
  return `${formatClockPart(time.hour)}:${formatClockPart(time.minute)}:00`
}

/**
 * 모달을 열 때의 값 (G2).
 *
 * 1. 그 항목에 이미 시각이 있으면 **그 값**이다 — 고치러 연 것이다
 * 2. 없으면 **같은 날 가장 가까운 앞 항목의 시각**이다 — 하루는 순서대로 흘러가서 다음
 *    항목은 대개 앞 항목 뒤다. 거기서 ▲ 몇 번이면 닿는다
 * 3. 앞에 아무도 시각이 없으면 `CLOCK_DEFAULT`(`10:00`)
 *
 * **뒤 항목은 보지 않는다.** 뒤 항목의 시각에서 출발하면 거꾸로 내려와야 하고, 순서가
 * 역전된 일정(D14-8 미결 2)에서는 엉뚱한 값이 된다.
 *
 * **앞 시각에 한 시간을 더하는 식으로 지어내지 않는다.** 머무는 시간은 장소마다 달라서
 * 어떤 간격을 고르든 근거가 없다 — 앞 항목 시각은 적어도 사용자가 적은 값이다.
 */
export function initialClockTime(items: PlanItemDetail[], planItemId: string): ClockTime {
  const index = items.findIndex((item) => item.planItemId === planItemId)
  if (index < 0) return CLOCK_DEFAULT

  const own = toClockTime(items[index]?.startTime ?? null)
  if (own !== null) return own

  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const previous = toClockTime(items[cursor]?.startTime ?? null)
    if (previous !== null) return previous
  }

  return CLOCK_DEFAULT
}

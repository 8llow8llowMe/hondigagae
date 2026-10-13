import { toClockTime, toServerStartTime } from '@/lib/plan/clock-time'

/**
 * 담기 때 채우는 항목 시각 — 이슈 #1383 · `일정상세-세부명세.md` D24.
 *
 * **시각이 없으면 산책 위험도가 꺼진다.** 항목 판정은 시각이 있어야 계산돼서
 * (`NO_START_TIME`) dev 의 다가오는 확정 일정 9개 항목 중 8개가 `시간 등록하기` 였다 — 이
 * 서비스의 차별점이 일정 안에서 보이지 않았다. 그래서 **담기가 시각을 채운다** (D24-1 (a)).
 *
 * **추천값이라는 표시는 저장되지 않는다.** 백엔드 항목에 시각의 출처를 적을 필드가 없어,
 * 담는 순간에 한 번 알린다(AI 결과의 담기 안내 줄 · 장소 담기 토스트) — 저장된 뒤에는
 * 사용자가 적은 시각과 같이 보인다 (D24-2).
 *
 * `clock-time.ts` `initialClockTime` 은 "앞 시각에 간격을 더해 지어내지 않는다" 고 적었다 —
 * 그쪽은 **사용자가 직접 고치러 연 모달의 출발값**이고, 이쪽은 비워 두면 판정이 꺼지는
 * 담기다. 같은 질문이 아니다 (D24-3).
 *
 * **AI 초안 담기는 더 이상 이 슬롯을 쓰지 않는다** (#1424) — 날마다 같은 `10:00 / 12:30 / 15:00`
 * 이 이동 거리와 상관없는 템플릿으로 읽혔다. 그쪽은 `lib/ai-plan/draft-schedule.ts` 가 머무는 시간 +
 * 직선거리 이동 시간으로 이어 붙인다. 여기 남은 것은 장소 · 코스 하나를 끼우는 규칙이다.
 */

/**
 * 그날 순서대로 채우는 시각. **다섯 개까지만** — 그 뒤는 비워 둔다 (밤늦은 시각을 지어내지 않는다).
 * 끼울 자리 앞에 시각이 하나도 없을 때의 출발값으로만 쓴다 (#1424 이후).
 */
const SLOTS = [
  { hour: 10, minute: 0 },
  { hour: 12, minute: 30 },
  { hour: 15, minute: 0 },
  { hour: 17, minute: 30 },
  { hour: 20, minute: 0 },
] as const

/** 장소 하나를 끼울 때 앞 시각에 더하는 간격 — 슬롯 간격과 같다 */
const GAP_MINUTES = 150
/** 끼울 때 이 시각을 넘으면 비워 둔다 — 마지막 슬롯과 같다 */
const LATEST_MINUTES = 20 * 60
/**
 * 끼운 항목이 **뒤 항목과 떨어져야 하는 최소 간격** (#1424). 30분은 가까운 곳에 들렀다 옮겨 가는
 * 데 드는 가장 짧은 시간으로 잡았다 — 이보다 좁으면 그 자리에 머물 시간이 없다고 보고 비운다.
 * 앞·뒤 사이 가운데를 고를 때는 **양쪽 모두** 이 간격을 지킨다.
 */
const MIN_GAP_MINUTES = 30
/** 가운데 시각을 고를 때 내림하는 단위 — 시각 모달의 분 단위(`CLOCK_STEP.minute`)와 같다 */
const ROUND_MINUTES = 5

/**
 * 그날 `sequence` 번째(0부터) 항목의 시각. 다섯 번째 뒤는 `undefined` — 요청 본문에서
 * 키를 빼는 값이다.
 */
export function slotStartTime(sequence: number): string | undefined {
  if (!Number.isInteger(sequence) || sequence < 0) return undefined

  const slot = SLOTS[sequence]
  return slot === undefined ? undefined : toServerStartTime(slot)
}

/**
 * 장소 하나를 끼울 자리의 시각.
 *
 * @param before 끼울 자리 **앞** 항목들의 서버 원문 `startTime` (순서대로)
 * @param after 끼울 자리 **뒤** 항목들의 서버 원문 `startTime` (순서대로). 대개 끝에 붙은 숙박이다
 *
 * 1. 앞 항목 중 **마지막으로 시각이 있는 것**에 2시간 30분을 더한다. 앞에 시각이 하나도 없으면
 *    끼울 자리의 순서 슬롯이다 (`slotStartTime(before.length)`)
 * 2. **뒤 항목 중 처음으로 시각이 있는 것보다 30분 이상 이르면** 그 값이다
 * 3. 아니면 앞 · 뒤 시각의 **가운데**(5분 단위 내림)다. 양쪽과 30분 이상 떨어지지 않으면 —
 *    들어갈 자리가 없으면 — 비운다. 호출부 토스트가 "시각을 정해 주세요" 를 말한다
 * 4. 20:00 을 넘으면 비운다 (자정을 넘겨 다음 날로 돌지 않는다)
 *
 * **뒤 항목도 본다** (#1424). 예전(#1383)에는 "뒤는 대개 숙박이고 하루는 앞에서 뒤로 흐른다" 며
 * 앞만 봤는데, 사용성 테스트에서 담은 음식점이 1일차 15:00 에 들어가 **숙소 체크인 15:00 과
 * 겹쳤다.** 숙박 앞에 끼운다(#1175)는 것은 곧 숙박 시각보다 앞이어야 한다는 뜻이다.
 */
export function insertedStartTime(
  before: readonly (string | null)[],
  after: readonly (string | null)[] = [],
): string | undefined {
  const previous = lastMinutes(before)
  const next = firstMinutes(after)

  const candidate = previous === null ? slotMinutes(before.length) : previous + GAP_MINUTES
  if (candidate === null) return undefined

  let minutes = candidate
  if (next !== null && candidate > next - MIN_GAP_MINUTES) {
    // 앞 시각이 없으면 가운데를 잡을 기준이 없다 — 뒤 시각에서 거꾸로 지어내지 않는다
    if (previous === null) return undefined

    const middle = Math.floor((previous + next) / 2 / ROUND_MINUTES) * ROUND_MINUTES
    if (middle - previous < MIN_GAP_MINUTES || next - middle < MIN_GAP_MINUTES) return undefined
    minutes = middle
  }

  if (minutes > LATEST_MINUTES) return undefined

  return toServerStartTime({ hour: Math.floor(minutes / 60), minute: minutes % 60 })
}

function toMinutes(value: string | null | undefined): number | null {
  const time = toClockTime(value ?? null)
  return time === null ? null : time.hour * 60 + time.minute
}

function lastMinutes(values: readonly (string | null)[]): number | null {
  for (let cursor = values.length - 1; cursor >= 0; cursor -= 1) {
    const minutes = toMinutes(values[cursor])
    if (minutes !== null) return minutes
  }
  return null
}

function firstMinutes(values: readonly (string | null)[]): number | null {
  for (const value of values) {
    const minutes = toMinutes(value)
    if (minutes !== null) return minutes
  }
  return null
}

function slotMinutes(sequence: number): number | null {
  const slot = SLOTS[sequence]
  return slot === undefined ? null : slot.hour * 60 + slot.minute
}

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
 */

/** 그날 순서대로 채우는 시각. **다섯 개까지만** — 그 뒤는 비워 둔다 (밤늦은 시각을 지어내지 않는다) */
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
 *
 * 1. 앞 항목 중 **마지막으로 시각이 있는 것**에 2시간 30분을 더한다. 20:00 을 넘으면 비운다
 *    (자정을 넘겨 다음 날로 돌지 않는다)
 * 2. 앞에 시각이 하나도 없으면 끼울 자리의 순서 슬롯이다 (`slotStartTime(before.length)`)
 *
 * **뒤 항목은 보지 않는다** — 끝에 붙은 숙박 앞에 끼우므로(`itemInsertIndex`) 뒤는 대개
 * 숙박이고, 하루는 앞에서 뒤로 흐른다 (`initialClockTime` 과 같은 판단).
 */
export function insertedStartTime(before: readonly (string | null)[]): string | undefined {
  for (let cursor = before.length - 1; cursor >= 0; cursor -= 1) {
    const previous = toClockTime(before[cursor] ?? null)
    if (previous === null) continue

    const minutes = previous.hour * 60 + previous.minute + GAP_MINUTES
    if (minutes > LATEST_MINUTES) return undefined

    return toServerStartTime({ hour: Math.floor(minutes / 60), minute: minutes % 60 })
  }

  return slotStartTime(before.length)
}

import type { MetricTone } from '@/components/metric'
import { walkSafetyTone } from '@/lib/insight/tone'
import type { PlanItemWalkSafetyItem } from '@/types/plan'

/**
 * 항목 산책 위험도 — 순수 로직 (#625).
 *
 * 근거: `docs/features/plan/일정상세-세부명세.md` D15-3 · D15-4. **서버가 이미 가른
 * 결과를 그대로 읽는다** — 배지 조건·사유별 갈래를 화면이 다시 판정하지 않는다.
 */

/** 판정 못 낸 사유 다섯 종 — 서버가 가르는 **순서** 그대로다. 바꾸지 않는다 (D15-3) */
export const PAST_DATE_CODE = 'PAST_DATE'
export const NOT_PLACE_TARGET_CODE = 'NOT_PLACE_TARGET'
export const NO_START_TIME_CODE = 'NO_START_TIME'
export const BEYOND_FORECAST_RANGE_CODE = 'BEYOND_FORECAST_RANGE'
export const LOOKUP_FAILED_CODE = 'LOOKUP_FAILED'

/** 등급 `UNKNOWN` — 적합도의 `INSUFFICIENT` 와 같은 자리다 (D15-2) */
const UNKNOWN_LEVEL_CODE = 'UNKNOWN'

/** 이 행에서 감추는 사유 — 다른 곳이 이미 같은 사실을 말하고 있다 (D15-4) */
const HIDDEN_REASON_CODES: ReadonlySet<string> = new Set([
  NO_START_TIME_CODE,
  NOT_PLACE_TARGET_CODE,
  PAST_DATE_CODE,
])

/** `planItemId` → 항목 판정. 없는 id 는 `undefined` 다 — 오류가 아니라 "아직 안 왔다"다 */
export function walkSafetyByItemId(
  items: readonly PlanItemWalkSafetyItem[],
): Map<string, PlanItemWalkSafetyItem> {
  return new Map(items.map((item) => [item.planItemId, item]))
}

export type ItemWalkSafetyView =
  | { kind: 'hidden' }
  | { kind: 'badge'; tone: MetricTone; label: string }
  | { kind: 'sentence'; text: string }
  | { kind: 'retriable'; text: string }

/**
 * 한 항목의 판정을 화면 갈래로 바꾼다 (D15-4 · D15-7).
 *
 * 가르는 순서:
 *  1. `LOOKUP_FAILED` — 다섯 중 유일한 일시 장애다. 서버 문장 + 재시도
 *  2. `NO_START_TIME`·`NOT_PLACE_TARGET`·`PAST_DATE`·`BEYOND_FORECAST_RANGE` — 숨김.
 *     (`BEYOND_FORECAST_RANGE` 는 일자 단위로 `dayBeyondForecastReason()` 가 대신 말한다)
 *  3. 모르는 코드 — 서버 문장 그대로 (#497 의 `default` 와 같다)
 *  4. `walkSafetyLevel === null` — 계약상 나오지 않아야 하지만 방어적으로 숨긴다
 *  5. 등급 `UNKNOWN` — 배지 없이 `description` 문장 (지평 안인데 예보가 없는 경우, D15-11)
 *  6. 그 밖 — 배지. **모르는 등급 코드도 배지를 세운다** — `unavailableReasonCode` 가
 *     null 이라는 것은 서버가 판정을 냈다는 뜻이라, 톤만 `unknown` 으로 물러난다.
 */
export function itemWalkSafetyView(item: PlanItemWalkSafetyItem): ItemWalkSafetyView {
  const { unavailableReasonCode, unavailableReason, walkSafetyLevel } = item

  if (unavailableReasonCode === LOOKUP_FAILED_CODE) {
    return { kind: 'retriable', text: unavailableReason ?? '' }
  }

  if (unavailableReasonCode !== null) {
    if (
      HIDDEN_REASON_CODES.has(unavailableReasonCode) ||
      unavailableReasonCode === BEYOND_FORECAST_RANGE_CODE
    ) {
      return { kind: 'hidden' }
    }

    return { kind: 'sentence', text: unavailableReason ?? '' }
  }

  if (walkSafetyLevel === null) return { kind: 'hidden' }

  if (walkSafetyLevel.code === UNKNOWN_LEVEL_CODE) {
    return { kind: 'sentence', text: walkSafetyLevel.description ?? '' }
  }

  return { kind: 'badge', tone: walkSafetyTone(walkSafetyLevel.code), label: walkSafetyLevel.name }
}

/**
 * `BEYOND_FORECAST_RANGE` 를 일자 단위로 접은 문장 (D15-4 · D15-9).
 *
 * **그 일자에 판정이 도착한 항목이 하나도 없으면 `null`** — 로딩 중이거나 항목이 없는
 * 날에는 말할 것이 없다(빈 일차 안내가 이미 말하거나, 아직 조회 중이다).
 *
 * **전부 `BEYOND_FORECAST_RANGE` 일 때만 접는다.** 하나라도 다른 사유거나 정상이면 그
 * 일자는 섞인 것이라 일자 단위로 뭉뚱그릴 수 없다 — `null` 을 돌려주고 행마다 갈린 결과를
 * 각자 보여 준다(행은 이 사유를 숨긴다).
 */
export function dayBeyondForecastReason(items: readonly PlanItemWalkSafetyItem[]): string | null {
  if (items.length === 0) return null

  const allBeyond = items.every((item) => item.unavailableReasonCode === BEYOND_FORECAST_RANGE_CODE)
  if (!allBeyond) return null

  return items[0]!.unavailableReason
}

/**
 * 그 일자에 조회 실패(`LOOKUP_FAILED`)가 있는가.
 *
 * **재시도 버튼을 낼지만 가른다.** 문장은 각 행이 이미 보여 준다 — 이 함수는 일자 카드에
 * 재시도 버튼을 **하나만** 세울지 결정하는 데만 쓴다 (D15-7 — 다섯 중 이 사유만 일시 장애다).
 */
export function dayHasLookupFailed(items: readonly PlanItemWalkSafetyItem[]): boolean {
  return items.some((item) => item.unavailableReasonCode === LOOKUP_FAILED_CODE)
}

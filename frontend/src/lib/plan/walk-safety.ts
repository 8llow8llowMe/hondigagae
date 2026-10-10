import type { MetricTone } from '@/components/metric'
import { walkSafetyTone } from '@/lib/insight/tone'
import type { PlanItemWalkSafetyItem } from '@/types/plan'

/**
 * 항목 산책 위험도 — 순수 로직 (#625).
 *
 * 근거: `docs/features/plan/일정상세-세부명세.md` D15-3 · D15-4. **서버가 이미 가른
 * 결과를 그대로 읽는다** — 배지 조건·사유별 갈래를 화면이 다시 판정하지 않는다.
 */

/** 판정 못 낸 사유 여섯 종 — 서버가 가르는 **순서** 그대로다. 바꾸지 않는다 (D15-3) */
export const PAST_DATE_CODE = 'PAST_DATE'
export const NOT_PLACE_TARGET_CODE = 'NOT_PLACE_TARGET'
export const NO_START_TIME_CODE = 'NO_START_TIME'
export const BEYOND_FORECAST_RANGE_CODE = 'BEYOND_FORECAST_RANGE'
export const LOOKUP_FAILED_CODE = 'LOOKUP_FAILED'
/**
 * 여섯째 사유 (#717). **시각별 예보 지평(오늘+4) 안인데 그 시각 예보를 쓸 수 없다.**
 *
 * **맨 뒤다** — 앞 다섯과 달리 서버가 tour 에 실제로 물어본 **뒤에** 갈리는 답이라
 * 날짜·항목 유형만으로는 결정되지 않는다. `BEYOND_FORECAST_RANGE` 와 두 가지가 다르다.
 *
 *  - **항목마다 갈린다.** 날짜만의 함수가 아니라 그 **시각**에 대한 답이라 같은 날에도
 *    어떤 항목은 판정이 나고 어떤 항목은 이 사유다 — 그래서 일자 단위로 접지 않는다
 *    (`HIDDEN_REASON_CODES` 에도 `dayBeyondForecastReason()` 에도 넣지 않는다).
 *  - **`walkSafetyLevel` 이 함께 온다** (`UNKNOWN` 등급). 물어서 받은 답이라
 *    `placeTitle`·`targetDateTime`·`basisPetId`·`petConditionApplied` 도 남는다 —
 *    "사유가 있으면 판정은 통째로 null" 이라는 옛 불변식의 **유일한 예외**다.
 */
export const NO_FORECAST_AT_TIME_CODE = 'NO_FORECAST_AT_TIME'

/** 등급 `UNKNOWN` — 적합도의 `INSUFFICIENT` 와 같은 자리다 (D15-2) */
const UNKNOWN_LEVEL_CODE = 'UNKNOWN'

/**
 * 이 행에서 감추는 사유 — 다른 곳이 이미 같은 사실을 말하고 있다 (D15-4).
 *
 * **`NO_FORECAST_AT_TIME` 을 여기 넣지 않는다** (#717). 항목마다 갈리는 사유라 이 행
 * 말고는 그 사실을 말하는 곳이 없다 — 감추면 판정이 없는 이유를 아무도 말하지 않는다.
 */
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
 *  1. `LOOKUP_FAILED` — 일시 장애다. 서버 문장 + 재시도. **"여섯 중 유일한 일시 장애"
 *     라고는 더 이상 말하지 않는다** (#717): `NO_FORECAST_AT_TIME` 에도 기상 원천 장애가
 *     섞여 들어온다. **그래도 재시도 버튼은 여기에만 단다** — BE 가 이 경계에서 "지금
 *     예보가 없다" 와 "원천이 잠깐 죽었다" 를 가르지 못해, 저쪽에 버튼을 달면 눌러도
 *     같은 답이 오는 경우를 사용자가 구분할 수 없다.
 *  2. `NO_START_TIME`·`NOT_PLACE_TARGET`·`PAST_DATE`·`BEYOND_FORECAST_RANGE` — 숨김.
 *     (`BEYOND_FORECAST_RANGE` 는 일자 단위로 `dayBeyondForecastReason()` 가 대신 말한다)
 *  3. `NO_FORECAST_AT_TIME` · 모르는 코드 — 서버 문장 그대로 (#497 의 `default` 와 같다).
 *     **`NO_FORECAST_AT_TIME` 이 이 갈래로 떨어지는 것은 의도다** (#717) — 숨기지도
 *     접지도 않고, 재시도도 아니다. `walkSafetyLevel`(등급 `UNKNOWN`)이 **함께 와도
 *     사유 문장이 이긴다**: `UNKNOWN` 은 배지로 말할 것이 없고, 왜 못 냈는지는 사유
 *     문장만 말한다.
 *  4. `walkSafetyLevel === null` — 계약상 나오지 않아야 하지만 방어적으로 숨긴다
 *  5. 등급 `UNKNOWN` — 배지 없이 `description` 문장 (지평 안인데 예보가 없는 경우, D15-11)
 *  6. 그 밖 — 배지. **모르는 등급 코드도 배지를 세운다** — `unavailableReasonCode` 가
 *     null 이라는 것은 서버가 판정을 냈다는 뜻이라, 톤만 `unknown` 으로 물러난다.
 *
 * **4·5 를 지우지 않는다** (#717 롤아웃). #717 배포 전 서버는 지평 안에서 예보를 못
 * 구한 항목을 **사유 없이 등급 `UNKNOWN`** 으로만 내려보낸다 — 새 코드가 배포되기
 * 전까지 옛 응답과 새 응답이 같은 화면에 섞이므로 두 갈래가 모두 살아 있어야 한다.
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
 *
 * **`NO_FORECAST_AT_TIME` 은 여기에 섞지 않는다** (#717). 그 사유는 항목마다 갈리므로
 * 일자로 접으면 판정이 난 항목까지 "이 날은 판정할 수 없다" 로 덮어 거짓이 된다 —
 * 접어도 잃는 것이 없는 쪽은 **날짜만의 함수**인 `BEYOND_FORECAST_RANGE` 뿐이다.
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
 * 재시도 버튼을 **하나만** 세울지 결정하는 데만 쓴다 (D15-7).
 *
 * **`NO_FORECAST_AT_TIME` 을 여기에 더하지 않는다** (#717). 그 사유에도 기상 원천 장애가
 * 섞여 들어오지만 BE 가 이 경계에서 "지금 그 시각 예보가 없다" 와 "원천이 잠깐 죽었다" 를
 * 가르지 못한다 — 누르면 같은 답이 돌아오는 버튼을 세우면 사용자가 그 차이를 알 수 없다.
 * BE 가 둘을 가르는 날 이 함수부터 고친다.
 */
export function dayHasLookupFailed(items: readonly PlanItemWalkSafetyItem[]): boolean {
  return items.some((item) => item.unavailableReasonCode === LOOKUP_FAILED_CODE)
}

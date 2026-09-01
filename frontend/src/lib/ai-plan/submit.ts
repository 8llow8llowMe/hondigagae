import { DEFAULT_AREA_CODE } from '@/lib/url/place-filters'
import type { AiPlanFormValues, AiPlanSubmitPayload } from '@/types/ai-plan'

/**
 * 조건 폼 값 → `POST /ai-plans` 요청 본문. **변환은 이 한 곳에서만 한다**
 * (form-guide.md §5).
 *
 * 근거: backend ai-service `AiPlanCreateRequest` **소스 실측** (`origin/develop` `af86c98`).
 */

/** 1만원. 폼은 만원 단위로 받고 계약은 원 단위다 */
export const MANWON = 10_000

/**
 * - `areaCode` 는 폼에 없다 — 계약에 `sigunguCode` 가 없어 제주 전체 고정 (명세 S2)
 * - **`budget` 은 `@Positive` 다.** 일정 생성(`@PositiveOrZero`)과 다르다 — `0` 을 보내면
 *   `AIPLAN_106` 400 이다. 그래서 "상관없음" 과 `0` 을 **똑같이 키 생략**으로 처리한다.
 *   `null` 을 보내지 않는 이유는 일정 생성과 같다: 생략이 "안 정했다" 다
 * - **`petId` 를 숫자로 바꾸지 않는다.** Snowflake 라 `Number()` 를 거치면 정밀도를 잃는다
 *   (plan 공통명세 S1)
 * - `requestNote` 는 선택이다. 공백만 남은 값을 보내면 서버 프롬프트에 빈 요구사항이
 *   섞이므로 trim 후 빈 값이면 키를 뺀다
 * - **`preferFavorites` 는 켤 때만 보낸다.** 서버 기본이 `false` 라
 *   (`Boolean.TRUE.equals(preferFavorites)`) 끄기를 실어 보낼 이유가 없다 (#128)
 * - **`pinnedPlaceIds` 는 이름을 떼고 `placeId` 만 보낸다.** 비어 있으면 키를 뺀다 —
 *   `[]` 를 보내도 서버는 같게 다루지만(`pinnedPlaceIds == null ? List.of()`), 생략이
 *   "고르지 않았다" 를 그대로 말한다. **`Number()` 를 거치지 않는다** (Snowflake)
 * - **`petIds`·`planId`·`regenerateDay` 는 아직 보내지 않는다.** 이유는
 *   `types/ai-plan.ts` 주석 — 앞은 `POST /plans` 가 `petId` 단일이라, 뒤는 아트보드와
 *   계약이 어긋나 있어서다
 */
export function toAiPlanSubmitPayload(values: AiPlanFormValues): AiPlanSubmitPayload {
  const budget = toBudgetWon(values.budgetManwon)
  const requestNote = values.requestNote.trim()

  const pinnedPlaceIds = values.pinnedPlaces.map((place) => place.placeId)

  return {
    areaCode: DEFAULT_AREA_CODE,
    startDate: values.startDate,
    endDate: values.endDate,
    petId: values.petId,
    ...(budget === null ? {} : { budget }),
    ...(requestNote === '' ? {} : { requestNote }),
    ...(values.preferFavorites ? { preferFavorites: true } : {}),
    ...(pinnedPlaceIds.length === 0 ? {} : { pinnedPlaceIds }),
  }
}

/**
 * 만원 단위 문자열 → 원 단위 양수. 보낼 수 없는 값이면 null 이다.
 *
 * `Number('')` 이 `0` 이라 **빈 값 검사를 먼저 한다.** 그 뒤 양수만 통과시키면 `0`·음수·
 * 소수·문자가 한 번에 걸러진다.
 */
function toBudgetWon(budgetManwon: string): number | null {
  const trimmed = budgetManwon.trim()
  if (trimmed === '') return null

  const manwon = Number(trimmed)
  if (!Number.isInteger(manwon) || manwon <= 0) return null

  return manwon * MANWON
}

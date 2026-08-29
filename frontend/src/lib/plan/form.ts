import { DEFAULT_AREA_CODE } from '@/lib/url/place-filters'
import type { PlanCreatePayload, PlanFormValues } from '@/types/plan'

/**
 * 폼 값 → `POST /plans` 요청 본문. **변환은 이 한 곳에서만 한다** (form-guide.md §5).
 *
 * - `areaCode` 는 폼에 없다 — 제주 전용이라 `DEFAULT_AREA_CODE` 고정 (공통명세 S9)
 * - `budget` 은 빈 값이면 **키 자체를 뺀다.** `null` 을 보내면 `@PositiveOrZero` 는
 *   통과하지만 의미가 "예산 0원" 과 헷갈린다 — 생략이 "안 정했다" 다
 * - `items` 는 보내지 않는다. 빈 일정을 만들고 장소는 일자 편집 화면에서 담는다
 * - **`petId` 를 숫자로 바꾸지 않는다.** 서버는 `Long` 으로 읽지만 Snowflake 라
 *   `Number()` 를 거치면 정밀도를 잃는다. 문자열 그대로 실어 보내면 Jackson 이
 *   `Long` 으로 읽는다 (공통명세 S1)
 */
export function toPlanCreatePayload(values: PlanFormValues): PlanCreatePayload {
  const budget = values.budget.trim()

  return {
    petId: values.petId,
    areaCode: DEFAULT_AREA_CODE,
    title: values.title.trim(),
    startDate: values.startDate,
    endDate: values.endDate,
    ...(budget === '' ? {} : { budget: Number(budget) }),
  }
}

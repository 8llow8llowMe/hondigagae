import { ApiError } from '@/lib/api/error'

/**
 * 일정 하나에 담을 수 있는 항목 수 상한 (#1251 · BE #1243). **서버 제약의 복제본이다.**
 *
 * 정본은 `Plan.MAX_ITEMS`(plan-service) 한 곳이다 — 요청 `@Size`(`PLAN_136`) · 서비스 검증
 * (`PLAN_028`) · Swagger 설명이 모두 그 상수를 읽는다. FE 는 **문구에 숫자를 싣기 위해서만**
 * 쓴다(사전 차단은 하지 않는다 — 판정은 서버가 교체 뒤 일정 전체 수로 한다).
 * 서버 값이 바뀌면 여기와 `item-limit.test.ts` 를 함께 고친다.
 */
export const PLAN_MAX_ITEMS = 100

/**
 * 상한 오류 코드. 근거: `backend/docs/services/plan-service.md` "일정 항목 수 상한" 절.
 *
 * - `PLAN_136` — 요청 한 번의 목록이 상한을 넘음. `@Size` 검증이라 `fieldErrors` 에
 *   `{ field: 'items' }` 로 함께 온다. 생성(`POST /plans`) · 하루 교체 둘 다.
 * - `PLAN_028` — 하루 교체 뒤 **다른 날과 합친 일정 전체**가 넘음. 도메인 예외라
 *   `fieldErrors` 가 없다. 하루 교체(`PUT .../days/{day}/items`)에서만 온다.
 */
const ITEM_LIMIT_CODES: ReadonlySet<string> = new Set(['PLAN_028', 'PLAN_136'])

/**
 * 일정 항목 수 상한에 걸린 실패인가. **둘 다 400 이고 재시도로 풀리지 않는다.**
 *
 * `fieldErrors` 도 본다 — 검증 오류가 여럿이면 대표 `resultCode` 는 정렬된 첫 오류라
 * (`ValidationErrorSupport`: DTO 선언 순서 → 제약 우선순위) `items` 보다 앞선 필드가
 * 함께 틀리면 대표 코드가 그쪽이 된다.
 */
export function isPlanItemLimitError(cause: unknown): boolean {
  if (!(cause instanceof ApiError)) return false
  if (cause.resultCode !== null && ITEM_LIMIT_CODES.has(cause.resultCode)) return true
  return cause.fieldErrors?.some((item) => ITEM_LIMIT_CODES.has(item.code)) ?? false
}

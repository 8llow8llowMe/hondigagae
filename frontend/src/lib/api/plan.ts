import { clientFetch, clientFetchVoid } from '@/lib/api/client'
import { paths } from '@/lib/api/paths'
import type { SliceResponse } from '@/types/api'
import type {
  PlanCreatePayload,
  PlanDayItemsReplacePayload,
  PlanDetail,
  PlanSummaryItem,
  PlanUpdatePayload,
  PlanWeatherResponse,
} from '@/types/plan'

/**
 * 여행 일정 API — 경로와 브라우저 호출부.
 *
 * 서버 컴포넌트는 이 파일의 `*Path()` 만 쓰고 전송은 server.ts 가 한다
 * (docs/architecture-guide.md §8). 계약 상세는 docs/features/plan/공통명세.md.
 */

export type PlanSlice = SliceResponse<PlanSummaryItem>

/**
 * 한 번에 받는 개수. 서버 상한이 50 이고 그 값을 쓴다.
 *
 * **좁히기를 화면에서 한다.** 적게 받으면 거른 결과가 비어 보이는 구간이 길어진다
 * (공통명세 S3).
 *
 * 상태(`status`)는 서버 파라미터가 아예 없다. **반려견은 있다** —
 * `GET /plans?petId=` 가 커밋 `8a63485` 로 생겼다(#148 에서 정정). 그래도 넘기지 않는다:
 * 화면 필터가 **다중 선택**이라 단일 `petId` 로 표현할 수 없고, 한 마리일 때만 서버로
 * 보내면 같은 필터가 선택 개수에 따라 다른 경로로 동작한다.
 */
export const PLAN_PAGE_SIZE = 50

export function planListPath(cursor: string | null): string {
  const params = new URLSearchParams({ size: String(PLAN_PAGE_SIZE) })
  // 첫 페이지는 lastPlanId 를 생략한다 — 서버가 Long.MAX_VALUE 로 대체한다
  if (cursor !== null) params.set('lastPlanId', cursor)
  return `${paths.plans.list}?${params.toString()}`
}

export function planCreatePath(): string {
  return paths.plans.create
}

/**
 * 다음 페이지 커서. 백엔드 `lastPlanId` 는 "직전 응답의 마지막 planId" 다.
 *
 * `hasNext` 가 true 인데 `contents` 가 비면 커서를 만들 수 없다 — 무한 루프를 막는다
 * (`nextPlaceCursor` 와 같은 판단).
 */
export function nextPlanCursor(page: PlanSlice | undefined): string | undefined {
  if (page === undefined || !page.hasNext) return undefined
  return page.contents.at(-1)?.planId
}

export function fetchPlanList(cursor: string | null): Promise<PlanSlice> {
  return clientFetch<PlanSlice>(planListPath(cursor))
}

export function createPlan(payload: PlanCreatePayload): Promise<PlanDetail> {
  return clientFetch<PlanDetail>(planCreatePath(), { method: 'POST', body: payload })
}

// ─── 상세 (#80) ───────────────────────────────────────────────────────────────

export function planDetailPath(planId: string): string {
  return paths.plans.detail(planId)
}

export function planWeatherPath(planId: string): string {
  return paths.plans.weather(planId)
}

export function fetchPlanDetail(planId: string): Promise<PlanDetail> {
  return clientFetch<PlanDetail>(planDetailPath(planId))
}

export function fetchPlanWeather(planId: string): Promise<PlanWeatherResponse> {
  return clientFetch<PlanWeatherResponse>(planWeatherPath(planId))
}

/**
 * 일정 수정. **응답이 `PlanDetailResponse` 전체**라 호출부가 `setQueryData` 로
 * 캐시를 갈아끼운다 — 다시 조회하지 않는다.
 */
export function updatePlan(planId: string, payload: PlanUpdatePayload): Promise<PlanDetail> {
  return clientFetch<PlanDetail>(planDetailPath(planId), { method: 'PUT', body: payload })
}

/**
 * 삭제. 소프트 삭제고 응답이 `Response<Void>` 라 **`clientFetchVoid` 를 써야 한다** —
 * `unwrap()` 은 `dataBody === null` 을 실패로 보기 때문에 `clientFetch` 로 부르면
 * **서버는 지웠는데 화면만 실패라고 말한다.** 브라우저 실측으로 잡은 버그다.
 */
export function deletePlan(planId: string): Promise<void> {
  return clientFetchVoid(planDetailPath(planId), { method: 'DELETE' })
}

/**
 * 일자별 항목 **일괄 교체**. 부분 수정이 아니다 — 빈 목록을 보내면 그 일차가 비워진다.
 *
 * 응답은 `PlanDetailResponse` **통째로** 온다(그 일자만이 아니다). 호출부가
 * `setQueryData` 로 갈아끼우고 판정만 invalidate 한다.
 */
export function replaceDayItems(
  planId: string,
  day: number,
  payload: PlanDayItemsReplacePayload,
): Promise<PlanDetail> {
  return clientFetch<PlanDetail>(paths.plans.dayItems(planId, day), {
    method: 'PUT',
    body: payload,
  })
}

// ─── 항목 방문 체크 (#124) ────────────────────────────────────────────────────

export function planItemVisitedPath(planId: string, planItemId: string): string {
  return paths.plans.itemVisited(planId, planItemId)
}

/**
 * 항목 방문 체크. **해제도 같은 API 다** — `visited: false` 를 보낸다
 * (`PlanWebController.markItemVisited`).
 *
 * 응답이 `Response<Void>` 라 **`clientFetchVoid` 를 써야 한다.** `clientFetch` 로 부르면
 * `unwrap()` 이 `dataBody === null` 을 실패로 보고 **서버는 저장했는데 화면만 실패라고
 * 말한다** — `deletePlan` 에서 브라우저 실측으로 잡았던 것과 같은 함정이다.
 *
 * 갱신된 상세를 돌려주지 않으므로 호출부는 `setQueryData` 가 아니라
 * `planKeys.detail(planId)` 무효화로 이어받는다.
 */
export function markItemVisited(
  planId: string,
  planItemId: string,
  visited: boolean,
): Promise<void> {
  return clientFetchVoid(planItemVisitedPath(planId, planItemId), {
    method: 'PUT',
    body: { visited },
  })
}

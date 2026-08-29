import { clientFetch } from '@/lib/api/client'
import { paths } from '@/lib/api/paths'
import type { SliceResponse } from '@/types/api'
import type { PlanCreatePayload, PlanDetail, PlanSummaryItem } from '@/types/plan'

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
 * **좁히기(상태·반려견)가 서버 파라미터로 없어 화면에서 거른다.** 적게 받으면
 * 거른 결과가 비어 보이는 구간이 길어진다 (공통명세 S3).
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

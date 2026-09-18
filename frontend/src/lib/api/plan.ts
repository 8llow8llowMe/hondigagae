import { clientFetch, clientFetchVoid } from '@/lib/api/client'
import { paths } from '@/lib/api/paths'
import type { SliceResponse } from '@/types/api'
import type { PlanEmergencyResponse } from '@/types/emergency'
import type {
  PlanBriefingResponse,
  PlanCopyPayload,
  PlanCreatePayload,
  PlanDayItemsReplacePayload,
  PlanDetail,
  PlanPackingItemAddPayload,
  PlanPackingItemCheckedPayload,
  PlanPackingItemsSavePayload,
  PlanPackingListResponse,
  PlanReviewResponse,
  PlanReviewUpsertPayload,
  PlanShareLink,
  PlanSummaryItem,
  PlanUpdatePayload,
  PlanWalkSafetyResponse,
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

/**
 * 일정 응급 브리핑 (#125).
 *
 * **반경·개수 파라미터가 없다** — 10km · 최대 3곳이 서버 고정이다. 화면이 조절할 수 있는
 * 것처럼 보이는 인자를 만들지 않는다.
 */
export function planEmergencyPath(planId: string): string {
  return paths.plans.emergency(planId)
}

export function planWeatherPath(planId: string): string {
  return paths.plans.weather(planId)
}

/**
 * 출발 전 여행 브리핑 (#626).
 *
 * **`date` 가 필수 인자다.** 서버가 기본값을 주지 않고 기간 밖이면 `PLAN_002` 400 이라,
 * 부를 날짜는 화면이 `pickBriefingDate()` 로 먼저 고른다 — 고를 수 없으면 아예 부르지
 * 않는다 (`lib/plan/briefing.ts`).
 */
export function planBriefingPath(planId: string, date: string): string {
  return paths.plans.briefing(planId, date)
}

export function fetchPlanBriefing(planId: string, date: string): Promise<PlanBriefingResponse> {
  return clientFetch<PlanBriefingResponse>(planBriefingPath(planId, date))
}

export function fetchPlanDetail(planId: string): Promise<PlanDetail> {
  return clientFetch<PlanDetail>(planDetailPath(planId))
}

export function fetchPlanWeather(planId: string): Promise<PlanWeatherResponse> {
  return clientFetch<PlanWeatherResponse>(planWeatherPath(planId))
}

/** 항목 산책 위험도 (#625). D14 의 시각 줄에 붙는 판정 — 상세·판정과 별도 조회다 */
export function planWalkSafetyPath(planId: string): string {
  return paths.plans.walkSafety(planId)
}

export function fetchPlanWalkSafety(planId: string): Promise<PlanWalkSafetyResponse> {
  return clientFetch<PlanWalkSafetyResponse>(planWalkSafetyPath(planId))
}

export function fetchPlanEmergency(planId: string): Promise<PlanEmergencyResponse> {
  return clientFetch<PlanEmergencyResponse>(planEmergencyPath(planId))
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
 * 일정 복사 (#617). **응답이 `updatePlan` 과 같은 `PlanDetailResponse` 전체**다 — 새
 * `planId` 의 상세 그대로라 호출부가 `setQueryData(planKeys.detail(새 planId), …)` 로
 * 캐시에 바로 심는다. 재조회 없이 새 상세로 이동할 수 있다 (`일정복사-세부명세.md` D3-4).
 *
 * **재시도가 없다.** 같은 본문을 자동으로 다시 보내면 같은 기간의 일정이 하나 더 생긴다.
 */
export function copyPlan(planId: string, payload: PlanCopyPayload): Promise<PlanDetail> {
  return clientFetch<PlanDetail>(paths.plans.copy(planId), { method: 'POST', body: payload })
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

// ─── 여행 준비물 저장 (#586) ─────────────────────────────────────────────────

/**
 * 저장된 준비물 조회.
 *
 * **일정 상세가 준비물 절에서 가장 먼저 부르는 것이 이 함수다.** 예전에는 화면이
 * `generatePackingList`(ai-service)로 곧장 갔고, 그래서 상세를 열 때마다 LLM 이 다시
 * 돌았다. 저장된 것이 있으면 다시 돌리지 않는다 (서버 스키마 설명).
 */
export function fetchPackingItems(planId: string): Promise<PlanPackingListResponse> {
  return clientFetch<PlanPackingListResponse>(paths.plans.packingItems(planId))
}

/**
 * AI 생성 결과 저장. **AI 항목만 교체하고 사용자가 직접 추가한 항목은 남는다** —
 * 직접 적어 둔 것을 재생성이 말없이 지우지 않으려는 서버 규칙이다.
 *
 * 응답이 목록 전체라 호출부가 `setQueryData` 로 갈아끼운다.
 */
export function savePackingItems(
  planId: string,
  payload: PlanPackingItemsSavePayload,
): Promise<PlanPackingListResponse> {
  return clientFetch<PlanPackingListResponse>(paths.plans.packingItems(planId), {
    method: 'PUT',
    body: payload,
  })
}

/**
 * 직접 추가. `source=USER` 로 저장되어 **AI 재생성에도 지워지지 않는다.**
 *
 * 실패가 둘이다 — 중복 이름 `PLAN_012`(409) · 50개 초과 `PLAN_013`(400).
 * 둘은 사용자가 할 일이 달라 화면이 갈라 말한다.
 */
export function addPackingItem(
  planId: string,
  payload: PlanPackingItemAddPayload,
): Promise<PlanPackingListResponse> {
  return clientFetch<PlanPackingListResponse>(paths.plans.packingItems(planId), {
    method: 'POST',
    body: payload,
  })
}

/**
 * 항목 삭제. 응답이 `Response<Void>` 라 **`clientFetchVoid` 를 써야 한다** —
 * `deletePlan` 과 같은 이유다 (`unwrap()` 은 `dataBody === null` 을 실패로 본다).
 */
export function deletePackingItem(planId: string, packingItemId: string): Promise<void> {
  return clientFetchVoid(paths.plans.packingItem(planId, packingItemId), { method: 'DELETE' })
}

/**
 * 챙김 체크. 해제도 같은 함수다 — `checked` 가 방향을 정한다.
 *
 * **응답이 `Response<Void>` 다.** 갱신된 목록이 오지 않으므로 호출부가 캐시를 직접
 * 손보거나 다시 읽어야 한다 — 저장·추가(목록 전체 반환)와 다른 점이다.
 */
export function setPackingItemChecked(
  planId: string,
  packingItemId: string,
  payload: PlanPackingItemCheckedPayload,
): Promise<void> {
  return clientFetchVoid(paths.plans.packingItemChecked(planId, packingItemId), {
    method: 'PUT',
    body: payload,
  })
}

// ─── 여행 후기 (#614 BE · #615 FE) ───────────────────────────────────────────

/**
 * 내 후기 조회.
 *
 * **완료 일정에서만 부른다.** 초안·확정은 `PLAN_016`(400) 이고, 후기가 없으면
 * `PLAN_015`(404) 다. 404 는 데이터 부재라 재시도 버튼이 없다.
 *
 * 응답이 있으면 `setQueryData` 로 캐시에 두고, 없으면 빈 상태(쓰기 CTA)로 간다.
 */
export function fetchPlanReview(planId: string): Promise<PlanReviewResponse> {
  return clientFetch<PlanReviewResponse>(paths.plans.reviews(planId))
}

/**
 * 후기 작성. 이미 있으면 `PLAN_017`(409) 이다 — 그때는 PUT 이다.
 *
 * 응답이 저장된 후기 전체라 호출부가 `setQueryData` 로 갈아끼운다.
 */
export function createPlanReview(
  planId: string,
  payload: PlanReviewUpsertPayload,
): Promise<PlanReviewResponse> {
  return clientFetch<PlanReviewResponse>(paths.plans.reviews(planId), {
    method: 'POST',
    body: payload,
  })
}

/**
 * 후기 수정. 후기가 없으면 `PLAN_015`, 완료가 아니면 `PLAN_016` 이다.
 *
 * `items` 는 **전량 교체**다. 빈 배열을 보내면 장소 평가가 전부 사라진다.
 */
export function updatePlanReview(
  planId: string,
  payload: PlanReviewUpsertPayload,
): Promise<PlanReviewResponse> {
  return clientFetch<PlanReviewResponse>(paths.plans.reviews(planId), {
    method: 'PUT',
    body: payload,
  })
}

// ─── 공유 링크 (#628) ─────────────────────────────────────────────────────────

/**
 * 현재 유효한 공유 링크.
 *
 * **404(`PLAN_023`)는 오류가 아니다.** "한 번도 발급하지 않았거나 이미 폐기·만료됐다"
 * 는 뜻이고 어느 쪽이든 할 일은 같다 — 새로 발급하는 것이다. 호출부는 404 를 잡아
 * `null`("아직 공유 중이 아니다")로 접고 빈 상태를 그린다.
 */
export function fetchPlanShareLink(planId: string): Promise<PlanShareLink> {
  return clientFetch<PlanShareLink>(paths.plans.shareLink(planId))
}

/**
 * 공유 링크 발급. **본문이 없다** — 유효 기간은 서버가 30일로 고정한다.
 *
 * **멱등이다.** 아직 폐기·만료되지 않은 링크가 있으면 새로 만들지 않고 그 토큰을
 * 그대로 돌려준다 — 두 번 눌러도 이미 보낸 링크가 죽지 않는다. 링크를 바꾸려면
 * `revokePlanShareLink` 로 폐기한 뒤 다시 부른다.
 *
 * 초안이면 `PLAN_022`(400) 다. 화면은 확정·완료에서만 이 버튼을 그려 닿지 않는다.
 */
export function issuePlanShareLink(planId: string): Promise<PlanShareLink> {
  return clientFetch<PlanShareLink>(paths.plans.shareLink(planId), { method: 'POST' })
}

/**
 * 공유 링크 폐기. **멱등이라 폐기할 것이 없어도 200 이다** — 404 분기를 만들지 않는다.
 *
 * 되돌릴 수 없다. 다시 발급하면 **다른 토큰**이 나오고 이미 보낸 링크는 죽는다.
 */
export function revokePlanShareLink(planId: string): Promise<void> {
  return clientFetchVoid(paths.plans.shareLink(planId), { method: 'DELETE' })
}

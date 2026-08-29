/**
 * 일정 query key.
 *
 * **key 에 필터를 넣지 않는다.** 장소 목록은 필터가 서버 조회 파라미터라 필터마다 key 가
 * 갈려야 하지만, 일정 필터는 서버 파라미터가 아예 없어 **같은 조회 결과를 화면에서 거를
 * 뿐**이다 (공통명세 S3). 필터를 key 에 넣으면 조건을 바꿀 때마다 같은 요청을 다시 보낸다.
 */
export const planKeys = {
  all: ['plans'] as const,
  list: () => [...planKeys.all, 'list'] as const,
  detail: (planId: string) => [...planKeys.all, 'detail', planId] as const,
}

/** api-integration-guide.md §7 표준값 — 일정 목록·상세는 30초 / 10분 (mutation 빈번) */
export const PLAN_QUERY_OPTIONS = {
  staleTime: 30_000,
  gcTime: 10 * 60_000,
} as const

export const planListQueryOptions = {
  ...PLAN_QUERY_OPTIONS,
  initialPageParam: null as string | null,
} as const

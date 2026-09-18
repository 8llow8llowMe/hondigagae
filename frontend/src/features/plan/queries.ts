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
  /**
   * 일자별 판정. **상세와 key 를 나눈다** — 판정만 5xx 로 실패해도 일정 본문은
   * 그대로 남아야 하고(D5), 그 섹션만 따로 재조회할 수 있어야 한다.
   */
  weather: (planId: string) => [...planKeys.all, 'weather', planId] as const,
  /**
   * 항목 산책 위험도 (#625). **상세·판정과 또 나눈다** — 한쪽이 5xx 로 죽어도 다른 쪽은
   * 살아 있어야 하고(D5), 일괄 교체 뒤 이 절만 무효화할 수 있어야 한다 (D15-6).
   */
  walkSafety: (planId: string) => [...planKeys.all, 'walkSafety', planId] as const,
  /**
   * 응급 브리핑 (#125). **상세·판정과 key 를 또 나눈다** — 별도 화면이고 한쪽이 실패해도
   * 다른 쪽은 살아 있어야 한다.
   */
  emergency: (planId: string) => [...planKeys.all, 'emergency', planId] as const,
  /**
   * 저장된 여행 준비물 (#586). **상세와 key 를 나눈다** — 준비물만 실패해도 일정 본문은
   * 그대로 남아야 하고, 체크·추가·삭제 뒤에 그 절만 갱신할 수 있어야 한다.
   *
   * 예전에는 key 가 아예 없었다. 생성 결과를 서버가 보관하지 않아 `useMutation` 이었고,
   * 캐시할 것이 없었다 — 저장이 생기면서 조회가 됐다.
   */
  packing: (planId: string) => [...planKeys.all, 'packing', planId] as const,
  /**
   * 여행 후기 (#615). **상세와 key 를 나눈다** — 후기만 404(`PLAN_015`)여도 일정
   * 본문은 그대로 남아야 하고, 쓰기·고친 뒤에는 이 절만 갱신하면 된다.
   *
   * 목록에는 `hasReview` 가 없어 목록 key 를 건드리지 않는다.
   */
  review: (planId: string) => [...planKeys.all, 'review', planId] as const,
  /**
   * 공유 링크 (#628). **상세와 key 를 나눈다** — 링크가 없어 404(`PLAN_023`)여도 일정
   * 본문은 그대로 남아야 하고, 발급·폐기 뒤에는 이 key 만 갱신하면 된다.
   *
   * **상세 응답에 공유 여부가 없어** 상세 key 를 건드릴 일이 없다 (후기와 같은 판단).
   */
  shareLink: (planId: string) => [...planKeys.all, 'share-link', planId] as const,
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

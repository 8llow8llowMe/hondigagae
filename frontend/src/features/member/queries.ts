import { isRetriable } from '@/lib/api/error'

/**
 * 서버 프리페치와 클라이언트가 **같은 key** 를 써야 하이드레이션이 성립한다
 * (docs/api-integration-guide.md §7).
 */
export const memberKeys = {
  all: ['member'] as const,
  me: () => [...memberKeys.all, 'me'] as const,
  /**
   * **전역 헤더 전용 사본** — 같은 `/members/me` 를 다른 key 로 든다.
   *
   * 헤더는 레이아웃에 살아 페이지보다 먼저 렌더되고, 페이지 본문은 Suspense 로 늦게 흘러
   * 들어온다. 헤더가 `me()` 를 쓰면 페이지의 `HydrationBoundary` 보다 먼저 그 key 를 캐시에
   * 만들어 버리고, 그러면 경계는 프리페치 결과를 **effect 뒤로 미룬다** — 서버는 `/mypage` 를
   * 데이터로, 클라이언트는 스켈레톤으로 그려 하이드레이션이 깨졌다(실측). key 를 가르면 서로의
   * 캐시 수명을 건드리지 않는다.
   *
   * 값을 바꾸는 쪽은 둘 다 갱신한다 — `use-my-info.ts` 의 `setMyInfo` · `replaceMyInfo`.
   */
  header: () => [...memberKeys.all, 'header'] as const,
}

/**
 * 본인이 수정하는 데이터다 — §7 표준값 (staleTime 5분 / gcTime 10분 / retry 1).
 * 반려견(1분)보다 긴 이유는 닉네임·프로필 사진이 목록보다 훨씬 덜 바뀌기 때문이고,
 * 바뀌는 경로가 이 화면의 mutation 하나뿐이라 신선도는 invalidate 가 담당한다.
 */
export const MEMBER_QUERY_OPTIONS = {
  staleTime: 5 * 60_000,
  gcTime: 10 * 60_000,
  /**
   * §7 의 "retry 1" 을 **오류 종류를 보존한 채** 구현한다. `retry: 1` 처럼 숫자를 주면
   * 전역의 error-aware retry 를 통째로 덮어써 400·401 까지 재시도한다 —
   * `PET_QUERY_OPTIONS` 와 같은 이유다 (반려견 상세에서 실측으로 잡은 회귀).
   */
  retry: (failureCount: number, error: unknown) => isRetriable(error) && failureCount < 1,
} as const

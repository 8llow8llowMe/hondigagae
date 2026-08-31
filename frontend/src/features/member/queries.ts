import { isRetriable } from '@/lib/api/error'

/**
 * 서버 프리페치와 클라이언트가 **같은 key** 를 써야 하이드레이션이 성립한다
 * (docs/api-integration-guide.md §7).
 */
export const memberKeys = {
  all: ['member'] as const,
  me: () => [...memberKeys.all, 'me'] as const,
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

import { isRetriable } from '@/lib/api/error'

/**
 * 서버 프리페치와 클라이언트가 **같은 key** 를 써야 하이드레이션이 성립한다
 * (docs/api-integration-guide.md §7).
 */
export const petKeys = {
  all: ['pets'] as const,
  list: () => [...petKeys.all, 'list'] as const,
  detail: (petId: string) => [...petKeys.all, 'detail', petId] as const,
}

/**
 * 본인이 수정하는 데이터다 — §7 표준값 (staleTime 1분 / gcTime 10분 / retry 1).
 * 신선도는 mutation 후 invalidate 가 담당한다.
 */
export const PET_QUERY_OPTIONS = {
  staleTime: 60_000,
  gcTime: 10 * 60_000,
  /**
   * §7 의 "retry 1" 을 **오류 종류를 보존한 채** 구현한다.
   *
   * `retry: 1` 처럼 숫자를 주면 전역의 error-aware retry(`query-client.ts`)를
   * 통째로 덮어써 **400·404·401 까지 재시도한다.** §7 이 "400 도 retry 대상이
   * 아니다" 를 명시하는 이유가 여기서 실제로 드러났다 — `/pets/abc` (숫자가 아닌
   * petId → 400 `PET_113`) 가 실패로 확정되지 않아 화면이 스켈레톤에 머물렀다.
   * 브라우저 실측으로 잡은 회귀다.
   */
  retry: (failureCount: number, error: unknown) => isRetriable(error) && failureCount < 1,
} as const

/**
 * 등록·수정·삭제 후 무효화 대상.
 *
 * **도메인 전체(`petKeys.all`)를 무효화한다** — §7 invalidate 규칙표.
 * 목록의 `totalCount` 가 등록 상한 판정에 쓰이므로(공통명세 S4-2) 상세만
 * 무효화하면 목록의 건수가 낡아 등록 버튼 상태가 어긋난다.
 */
export const PET_INVALIDATE_KEY = petKeys.all

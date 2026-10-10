import { QueryClient } from '@tanstack/react-query'

import { isRetriable } from '@/lib/api/error'

/**
 * 전역 기본값. 도메인별 예외만 각 feature 의 queries.ts 에서 덮어쓴다.
 * 도메인별 표준값 표는 docs/api-integration-guide.md §7 이 정본이다.
 */
const MAX_RETRY = 2

function defaultOptions() {
  return {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      // 401 / 404 / 400 은 재시도 대상이 아니다. 5xx·무응답만 재시도한다
      retry: (failureCount: number, error: unknown) =>
        isRetriable(error) && failureCount < MAX_RETRY,
      // 모바일에서 앱 전환마다 재조회하면 사용자 데이터를 낭비한다
      refetchOnWindowFocus: false,
    },
    mutations: {
      // 중복 생성 위험. 재시도는 사용자가 결정한다
      retry: 0,
    },
  }
}

/**
 * 서버 프리페치용 QueryClient.
 *
 * **요청마다 새 인스턴스를 만든다.** 모듈 스코프에 두면 요청 간에 데이터가 섞여
 * 사용자 데이터가 유출된다 — docs/architecture-guide.md §9.
 */
export function getServerQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: defaultOptions() })
}

/** 브라우저용 — QueryClientProvider 에서 한 번만 만든다 */
export function createBrowserQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: defaultOptions() })
}

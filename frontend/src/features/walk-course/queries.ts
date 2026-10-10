import type { WalkCourseListParams } from '@/lib/api/walk-course'

/**
 * 산책 코스 query key (#618).
 *
 * 서버 프리페치와 클라이언트가 **같은 key** 를 써야 하이드레이션이 성립한다
 * (`docs/api-integration-guide.md` §7).
 *
 * **key 에 들어가는 것은 URL 의 조건이 아니라 서버가 실제로 받은 파라미터다.** URL 의
 * `?activity=ALL` 과 값 없음은 둘 다 "파라미터를 보내지 않는다" 라 **같은 응답**이다 —
 * URL 을 그대로 key 에 넣으면 같은 답을 두 벌 캐시하고, 활동량을 껐다 켤 때마다
 * 새로 받아 온다.
 */
export const walkCourseKeys = {
  all: ['walk-courses'] as const,
  list: (params: WalkCourseListParams) => [...walkCourseKeys.all, 'list', params] as const,
  detail: (walkCourseId: string) => [...walkCourseKeys.all, 'detail', walkCourseId] as const,
}

/**
 * **장소 목록과 같은 5분 / 30분 / 2 다** (`api-integration-guide.md` §7 표의 `산책 코스` 행).
 *
 * 이유도 같다 — 제주올레 코스는 배치(`walkcourseimport`, #383)로 적재돼 **세션 중에
 * 바뀌지 않는다.** 조건을 왕복하며 만지는 화면이라 재조회를 줄이는 것이 체감에 직결된다.
 *
 * `retry` 는 전역 기본값(5xx·무응답 2회)을 그대로 쓴다 — 404·400 은 `isRetriable` 이
 * 이미 걸러 낸다.
 */
export const WALK_COURSE_QUERY_OPTIONS = {
  staleTime: 5 * 60_000,
  gcTime: 30 * 60_000,
} as const

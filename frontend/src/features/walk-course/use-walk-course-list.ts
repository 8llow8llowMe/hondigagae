'use client'

import { useQuery } from '@tanstack/react-query'

import { WALK_COURSE_QUERY_OPTIONS, walkCourseKeys } from '@/features/walk-course/queries'
import { clientFetch } from '@/lib/api/client'
import { type WalkCourseListParams, walkCourseListPath } from '@/lib/api/walk-course'
import type { WalkCourseList } from '@/types/walk-course'

/**
 * 산책 코스 목록.
 *
 * **커서가 없다.** 코스가 29개뿐이라 전량이 한 번에 온다 — `useInfiniteQuery` 가 아니고
 * `InfiniteScrollSentinel` 도 쓰지 않는다 (공통명세 S3 · `/favorites` 와 같은 모양).
 *
 * **`enabled` 를 두지 않는다.** 공개 API 라 미로그인도 그대로 조회한다 — 로그인이 필요한
 * 것은 활동량 기본값의 출처(`GET /members/me/pets`)뿐이고 그것은 **서버 컴포넌트가**
 * 조회한다 (공통명세 S1).
 *
 * 서버 프리페치는 `app/(main)/walk-courses/page.tsx` 가 **같은 key** 로 수행한다 —
 * key 가 다르면 프리페치가 버려진다 (`architecture-guide.md` §9).
 */
export function useWalkCourseList(params: WalkCourseListParams) {
  return useQuery({
    queryKey: walkCourseKeys.list(params),
    queryFn: () => clientFetch<WalkCourseList>(walkCourseListPath(params)),
    staleTime: WALK_COURSE_QUERY_OPTIONS.staleTime,
    gcTime: WALK_COURSE_QUERY_OPTIONS.gcTime,
  })
}

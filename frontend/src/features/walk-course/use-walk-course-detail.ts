'use client'

import { useQuery } from '@tanstack/react-query'

import { WALK_COURSE_QUERY_OPTIONS, walkCourseKeys } from '@/features/walk-course/queries'
import { clientFetch } from '@/lib/api/client'
import { walkCourseDetailPath } from '@/lib/api/walk-course'
import type { WalkCourseDetail } from '@/types/walk-course'

/**
 * 코스 상세.
 *
 * **`walkCourseId` 는 문자열 그대로 쓴다** — Snowflake 라 `Number()` 를 거치면 정밀도를
 * 잃는다 (공통명세 S3).
 *
 * **반려견을 바꿔도 재조회되지 않는다.** 코스는 반려견과 무관한 공공 데이터이고, 조건이
 * 붙는 것은 골든타임 쪽뿐이다 (`코스상세-세부명세.md` D4).
 */
export function useWalkCourseDetail(walkCourseId: string) {
  return useQuery({
    queryKey: walkCourseKeys.detail(walkCourseId),
    queryFn: () => clientFetch<WalkCourseDetail>(walkCourseDetailPath(walkCourseId)),
    staleTime: WALK_COURSE_QUERY_OPTIONS.staleTime,
    gcTime: WALK_COURSE_QUERY_OPTIONS.gcTime,
  })
}

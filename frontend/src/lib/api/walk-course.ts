import { paths } from '@/lib/api/paths'
import type { WalkCourseActivityParam, WalkCourseSort } from '@/types/walk-course'

/**
 * 산책 코스 경로 조립. 전송은 `client.ts` / `server.ts` 가 나눠 담당한다
 * (`docs/architecture-guide.md` §8).
 *
 * **공개 API 다** — 인증 헤더가 필요 없고 `proxy.ts` `PROTECTED_PATHS` 에도 넣지 않는다.
 */

/**
 * 서버에 실제로 보내는 조건. **URL 의 조건과 같지 않다** — `ALL`·`HIGH` 는 여기 오기 전에
 * `null` 이 된다 (`lib/walk-course/activity.ts`). 그래서 query key 도 이 값으로 만든다:
 * URL 의 `ALL` 과 값 없음이 같은 요청이면 캐시도 같아야 한다.
 */
export type WalkCourseListParams = {
  petActivityLevel: WalkCourseActivityParam | null
  sort: WalkCourseSort | null
}

export function toWalkCourseApiQuery(params: WalkCourseListParams): string {
  const query = new URLSearchParams()

  if (params.petActivityLevel !== null) query.set('petActivityLevel', params.petActivityLevel)
  if (params.sort !== null) query.set('sort', params.sort)

  return query.toString()
}

export function walkCourseListPath(params: WalkCourseListParams): string {
  return paths.walkCourses.list(toWalkCourseApiQuery(params))
}

export function walkCourseDetailPath(walkCourseId: string): string {
  return paths.walkCourses.detail(walkCourseId)
}

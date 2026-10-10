'use client'

import { usePathname, useRouter } from 'next/navigation'

import { walkCourseFilterHref } from '@/lib/url/walk-course-filters'
import type { WalkCourseFilters } from '@/types/walk-course'

/**
 * 조건을 URL 에 반영한다 — `architecture-guide.md` §10 (필터·정렬·탭은 `searchParams`).
 *
 * **읽지 않고 쓰기만 한다.** 이 화면은 서버 프리페치가 있어 `page.tsx` 가 `searchParams` 를
 * 읽고 파싱 결과를 prop 으로 내린다 — `usePlaceFilterNav` 와 같은 분담이다. 여기서 또 읽으면
 * 서버가 조회한 조건과 화면이 그리는 조건이 갈릴 수 있다.
 *
 * **`replace` 다** (D4-1). 세그먼트를 세 번 만지면 히스토리에 세 칸이 쌓여 뒤로가기가
 * 목록을 벗어나지 못한다. `scroll: false` 로 목록 위치도 지킨다.
 *
 * **`walkCourseFilterHref` 로 조립한다** — 조건을 통째로 다시 실어야 정렬을 바꾼 사용자가
 * 활동량 필터를 잃지 않는다.
 */
export function useWalkCourseNav(): {
  apply: (next: WalkCourseFilters) => void
  showAll: () => void
} {
  const router = useRouter()
  const pathname = usePathname()

  function go(filters: WalkCourseFilters) {
    router.replace(walkCourseFilterHref(pathname, filters), { scroll: false })
  }

  return {
    apply: go,
    /**
     * 0건·400 의 **다음 행동**. `activity` 를 비우지 않고 **`ALL` 을 명시한다** — 비우면
     * 대표견이 다시 채워, 필터를 끄려던 사용자가 같은 0건 화면으로 돌아온다.
     *
     * 정렬은 함께 되돌린다. 0건을 만든 축이 활동량이라 정렬을 남겨 둘 이유가 없고,
     * `전체 코스 보기` 라는 이름이 말하는 화면과 같아야 한다.
     */
    showAll: () => go({ activity: 'ALL', sort: null }),
  }
}

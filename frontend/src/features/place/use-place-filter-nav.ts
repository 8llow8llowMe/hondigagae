'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { toPlaceFilterQuery } from '@/lib/url/place-filters'
import type { PlaceFilters } from '@/types/place'

/**
 * 필터를 URL 에 반영한다 — architecture-guide.md §10 (필터·정렬·탭은 `searchParams`).
 *
 * **`replace` 다.** 필터 한 번 만질 때마다 히스토리가 쌓이면 뒤로가기가 필터 되감기가 되고,
 * 목록에서 상세로 갔다가 돌아오는 정상 경로가 묻힌다.
 *
 * 데스크톱 레일 · 모바일 칩 · 더보기 시트가 **같은 함수를 쓴다** — 세 곳이 각자
 * `router.replace` 를 조립하면 `scroll: false` 하나만 빠져도 화면이 튄다.
 */
export function usePlaceFilterNav(): {
  apply: (next: PlaceFilters) => void
  reset: () => void
} {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // 읽어 두면 뒤로가기로 돌아왔을 때 리렌더가 보장된다
  void searchParams

  function apply(next: PlaceFilters) {
    const query = toPlaceFilterQuery(next)
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  return {
    apply,
    reset: () => router.replace(pathname, { scroll: false }),
  }
}

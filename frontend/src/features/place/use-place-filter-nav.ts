'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { placeFilterDefaults, toPlaceFilterQuery } from '@/lib/url/place-filters'
import { placePreviewHref, readPlacePreview } from '@/lib/url/place-preview'
import {
  parseViewMode,
  PLACES_DEFAULT_VIEW,
  type ViewMode,
  viewModeHref,
} from '@/lib/url/view-mode'
import type { PlaceFilters } from '@/types/place'

/**
 * 필터가 바뀐 뒤의 주소. **훅에서 떼어 둔 순수 함수다** — 회귀가 난 곳이 조립 규칙이라
 * 라우터 없이 그것만 고정할 수 있어야 한다 (docs/testing-guide.md §1).
 *
 * **고른 장소(`?place=`)는 기본으로 싣지 않는다** — 필터를 바꾸면 미리보기가 닫힌다(`place-preview.ts`, 결과가
 * 바뀌는 순간이라 의도). `previewId` 를 주면 남긴다: 반려견을 바꿔 체구 필터를 맞출 때는 사용자가 판정을 보러
 * 바꾼 것이라 미리보기를 닫지 않는다 (장소-반려견칩-세부명세 D1-2, #1301).
 *
 * **생략할 기본값은 경로가 정한다** (#1379) — `/places` 는 `동반 가능만`이 기본이라 그것을 끈 상태가
 * `?petAllowanceType=ALL` 로 적힌다. 페이지가 같은 `placeFilterDefaults` 로 파싱한다.
 */
export function placeFilterHref(
  pathname: string,
  filters: PlaceFilters,
  view: ViewMode,
  previewId: string | null = null,
): string {
  const query = toPlaceFilterQuery(filters, placeFilterDefaults(pathname))
  const href = viewModeHref(pathname, query, view, PLACES_DEFAULT_VIEW)
  return previewId === null ? href : placePreviewHref(href, previewId)
}

/**
 * 필터를 URL 에 반영한다 — architecture-guide.md §10 (필터·정렬·탭은 `searchParams`).
 *
 * **`replace` 다.** 필터 한 번 만질 때마다 히스토리가 쌓이면 뒤로가기가 필터 되감기가 되고,
 * 목록에서 상세로 갔다가 돌아오는 정상 경로가 묻힌다.
 *
 * 데스크톱 레일 · 모바일 칩 · 더보기 시트가 **같은 함수를 쓴다** — 세 곳이 각자
 * `router.replace` 를 조립하면 `scroll: false` 하나만 빠져도 화면이 튄다.
 *
 * **`viewModeHref` 로 조립한다.** 조건만 새로 쓰면 `view` 가 떨어지는데, 이 화면의 기본
 * 보기는 **지도**라(`PLACES_DEFAULT_VIEW`) `?view=list` 가 사라지는 순간 목록에서 필터를
 * 만진 사용자가 지도로 튕겨 나간다. 긴급 시설이 같은 함정을 같은 방법으로 막는다
 * (`features/emergency/use-emergency-nav.ts`) — 링크를 만드는 곳이 페이지(토글)와 여기
 * 둘인데, 둘 다 같은 함수를 거쳐야 한쪽만 규칙이 어긋나는 일이 없다.
 *
 * **`reset` 도 `view` 를 지킨다.** 초기화가 바꾸는 것은 조건이지 보고 있는 화면이 아니다.
 * 초기화가 돌아가는 곳은 **이 화면의 기본 조건**이다(`defaults`) — `/places` 는 `동반 가능만` (#1379).
 * `초기화` 버튼을 띄울지(`dirty`)도 같은 값과 견준다. 둘이 다른 기본값을 보면 눌러도 안 사라지는 버튼이 선다.
 */
export function usePlaceFilterNav(): {
  /** `keepPreview` — 열린 미리보기(`?place=`)를 닫지 않는다. 반려견 체구 필터 맞춤만 쓴다 (#1301) */
  apply: (next: PlaceFilters, options?: { keepPreview?: boolean }) => void
  reset: () => void
  /** 이 화면의 기본 조건 — 걸린 조건이 있는지(`초기화` 노출) 판정용 */
  defaults: PlaceFilters
} {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const view = parseViewMode(searchParams, PLACES_DEFAULT_VIEW)
  const defaults = placeFilterDefaults(pathname)

  function go(filters: PlaceFilters, previewId: string | null = null) {
    router.replace(placeFilterHref(pathname, filters, view, previewId), { scroll: false })
  }

  return {
    apply: (next, options) =>
      go(
        next,
        options?.keepPreview === true
          ? readPlacePreview(new URLSearchParams(searchParams.toString()))
          : null,
      ),
    reset: () => go(defaults),
    defaults,
  }
}

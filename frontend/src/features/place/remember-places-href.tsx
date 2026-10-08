'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

import { rememberPlacesHref } from '@/lib/place/places-return'

/**
 * 장소 찾기 화면의 주소를 기억한다 — 상세의 `장소 찾기` 링크가 이 화면으로 돌아오게 (#1272).
 *
 * 보기 전환 · 필터 · 미리보기(`?place=`)가 모두 주소에 있으므로(architecture-guide.md §10) **주소가
 * 바뀔 때마다** 새로 적는다. 미리보기를 연 채 상세로 갔다면 돌아와도 그 미리보기가 열려 있다.
 * 그리는 것은 없다.
 */
export function RememberPlacesHref() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    const query = searchParams.toString()
    rememberPlacesHref(query === '' ? pathname : `${pathname}?${query}`)
  }, [pathname, searchParams])

  return null
}

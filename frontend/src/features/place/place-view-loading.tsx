'use client'

import { useSearchParams } from 'next/navigation'

import type { ReactNode } from 'react'

import { parseViewMode, PLACES_DEFAULT_VIEW } from '@/lib/url/view-mode'

/**
 * `/places` 로딩 폴백이 **도착할 보기의 골격**을 고른다.
 *
 * `loading.tsx` 는 `searchParams` 를 받지 못한다 (Next 규약). 그래서 예전에는 한 모양만
 * 그렸고, 그것이 목록이었다 — 기본 보기가 지도(`PLACES_DEFAULT_VIEW`)라 탭바·헤더로
 * 들어온 진입마다 목록 골격이 섰다가 지도로 바뀌었다. 토글로 보기를 바꿀 때도 반대 보기의
 * 골격이 한 번 끼었다.
 *
 * **client component 에서는 읽을 수 있다** — `useSearchParams()` 는 폴백이 서는 전환의
 * **목적지** URL 을 준다. 판정은 `page.tsx` 와 같은 `parseViewMode(…, PLACES_DEFAULT_VIEW)`
 * 다 — 기본값이 두 곳에서 갈리면 골격과 실화면이 다른 보기를 그린다.
 *
 * 두 골격은 서버 쪽(`loading.tsx`)이 만들어 넘긴다 — 여기는 고르기만 한다.
 */
export function PlaceViewLoading({ list, map }: { list: ReactNode; map: ReactNode }) {
  const view = parseViewMode(useSearchParams(), PLACES_DEFAULT_VIEW)

  return view === 'map' ? map : list
}

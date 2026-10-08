import { type ReactNode, Suspense } from 'react'

import { RememberPlacesHref } from '@/features/place/remember-places-href'

/**
 * 장소 찾기(목록 · 지도 두 보기) 공통 껍데기.
 *
 * **떠난 주소를 기억한다** (#1272) — 상세의 `장소 찾기` 링크가 이 화면으로 돌아오게. 두 보기가 같은
 * 페이지(`?view=`)라 레이아웃 한 자리에서 모두 잡힌다. `useSearchParams` 를 쓰므로 `Suspense` 로
 * 감싼다 — 감싸지 않으면 페이지 전체가 클라이언트 렌더로 밀린다.
 */
export default function PlacesListLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Suspense fallback={null}>
        <RememberPlacesHref />
      </Suspense>
    </>
  )
}

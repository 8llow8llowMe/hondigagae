import { HeaderActions, HeaderLogo } from '@/features/nav/header-parts'
import { NavLinks } from '@/features/nav/nav-links'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

/**
 * 지도 아일랜드 헤더 — `/places` 지도 보기에서 흰 띠 대신 지도 위에 뜨는 **알약** (#1287,
 * `docs/features/place/지도-아일랜드헤더-세부명세.md`).
 *
 * **셸이 헤더 두 벌을 함께 그리고, 지도 화면이 자기 성질로 고른다** (D1-2). `/places` 의 목록 ·
 * 지도는 같은 라우트의 `?view=` 쿼리라 레이아웃 · prop 으로는 가를 수 없다. 이 헤더는 기본
 * `display: none` 이고(`.island-header`), 지도 루트가 `map-island` 를 달면
 * `body:has(.map-island)` 규칙이 띠(`GlobalHeader`)를 걷고 이것을 세운다 — 전역 푸터가
 * `body:has(.map-canvas-height)` 로 빠지는 것과 같은 축이다(#399). 서버 렌더 첫 페인트부터 맞다.
 * 숨은 쪽은 `display: none` 이라 접근성 트리에서 빠진다 — 화면의 `banner` 는 늘 하나다.
 *
 * **내용은 헤더와 같은 조각이다** (`header-parts.tsx`) — DOM 순서도 같다: 로고 → 메뉴 → 오른쪽 묶음.
 *
 * - **<1024**: 알약 하나가 열 전폭 — 로고 · (768+ 메뉴) · 오른쪽 묶음, 양 끝 정렬.
 * - **≥1024**: 알약은 오른쪽 정렬 · 내용 폭이고 메뉴 · 오른쪽 묶음만 담는다. 로고는 DOM 이 알약 안
 *   맨 앞 그대로인 채 `fixed` 로 왼쪽 위(16 · 8, 높이 48)에 빠져 도킹 스택의 64 띠 위에 선다.
 *   패널을 접으면 그 자리에서 **로고 알약**이 된다(`.island-logo`, `app/globals.css`).
 *
 * **알약과 그 조상에 `transform` · `filter` · `backdrop-filter` 를 걸지 않는다.** 그러면 `fixed`
 * 로고의 기준이 뷰포트가 아니라 그 조상이 되어 로고가 알약 안으로 끌려 들어간다(D7-7).
 * **불투명 흰 면이다** — 반투명 · 블러는 바다 위에서 대비를 잃는다(D1-1).
 *
 * 바깥 `<header>` · 열은 `pointer-events-none` 이고 알약만 되살린다 — 지도 위 빈 띠가 드래그를
 * 먹지 않게(#412 조작 줄과 같은 수법). `z-40` 은 `GlobalHeader` 와 같은 층이다 — 안의 계정 ·
 * 반려견 팝오버가 지도 조작 줄(`z-30`) 위에 선다(#393).
 */
export function IslandHeader({ authed }: { authed: boolean }) {
  return (
    <header className="island-header pointer-events-none fixed inset-x-0 top-2 z-40">
      <div className={cn('content-container flex justify-end', INSET_CLASS.main)}>
        <div className="bg-bg border-border pointer-events-auto flex h-12 w-full min-w-0 items-center justify-between gap-3 rounded-full border px-2 shadow-md lg:w-auto">
          <div className="flex min-w-0 items-center gap-8">
            {/* ≥1024 에서 알약 밖 왼쪽 위로 빠진다 — 높이 48 안에 링크 44 가 세로 가운데 */}
            <div className="island-logo flex items-center lg:fixed lg:start-4 lg:top-2 lg:h-12">
              <HeaderLogo />
            </div>
            <NavLinks authed={authed} />
          </div>

          <HeaderActions authed={authed} />
        </div>
      </div>
    </header>
  )
}

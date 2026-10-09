import { AccountMenu } from '@/features/nav/account-menu'
import { HeaderLogo } from '@/features/nav/header-parts'
import { IslandLoginLink } from '@/features/nav/island-login-link'
import { NavLinks } from '@/features/nav/nav-links'

/**
 * 지도 아일랜드 헤더 — `/places` 지도 보기에서 흰 띠 대신 지도 위에 뜨는 **알약** (#1287 → #1300,
 * `docs/features/place/지도-아일랜드알약-정리-세부명세.md` D3-1).
 *
 * **셸이 헤더 두 벌을 함께 그리고, 지도 화면이 자기 성질로 고른다** (#1287 D1-2). `/places` 의 목록 ·
 * 지도는 같은 라우트의 `?view=` 쿼리라 레이아웃 · prop 으로는 가를 수 없다. 이 헤더는 기본
 * `display: none` 이고(`.island-header`), 지도 루트가 `map-island` 를 달면 **768 이상에서**
 * `body:has(.map-island)` 규칙이 띠(`GlobalHeader`)를 걷고 이것을 세운다. 서버 렌더 첫 페인트부터 맞다.
 * **768 미만은 알약이 없다** — 검색창이 맨 위이고 이동은 탭바, 로그인은 `내 정보` 탭이 맡는다(D1-1).
 *
 * **알약 = 메뉴 셋 + 계정 하나** (#1300 D1-1). 띠 헤더의 오른쪽 묶음(`HeaderActions` — 스위처 · 소개 ·
 * `병원 · 약국` · 회원가입)을 쓰지 않는다. 알약 안은 바깥과 동심원이다 — 높이 48 · 여백 4 · 안쪽 40 원형.
 *
 * **알약은 지도 영역 안에만 선다.** 허용 상자(`.island-bar`, `fixed`)가 지도 왼쪽 경계(`--island-map-left`,
 * 도킹 패널 · 미리보기 폭)에서 16 떨어져 시작하고, 알약은 그 안에서 오른쪽 정렬이다. 상자가 비로그인 알약
 * 폭보다 좁으면 컨테이너 쿼리가 메뉴 셋을 `≡` 하나로 접는다(`app/globals.css`).
 *
 * **로고는 허용 상자 밖 형제다** (D3-1). `container-type` 은 레이아웃을 격리해 `fixed` 자손의 기준 상자가
 * 된다 — 로고를 안에 두면 허용 상자 안으로 끌려 들어간다(#1287 D7-7 의 `transform` 과 같은 함정). 같은
 * 이유로 로고 · 허용 상자와 그 조상에 `transform` · `filter` · `backdrop-filter` 를 걸지 않는다.
 * DOM 순서는 로고 → 메뉴 → 계정 그대로다.
 *
 * **불투명 흰 면이다** — 반투명 · 블러는 바다 위에서 대비를 잃는다(#1287 D1-1). 테두리는 `inset-ring` 이라
 * 레이아웃을 먹지 않는다 — 안쪽 4 가 그대로 40 을 남긴다.
 *
 * 바깥 `<header>` 는 `pointer-events-none` 이고 로고 · 알약만 되살린다 — 지도 위 빈 띠가 드래그를 먹지
 * 않게(#412 조작 줄과 같은 수법). `z-40` 은 `GlobalHeader` 와 같은 층이다 — 계정 · `≡` 팝오버가 지도 조작
 * 줄(`z-30`) 위에 선다(#393).
 */
export function IslandHeader({ authed }: { authed: boolean }) {
  return (
    <header className="island-header pointer-events-none fixed inset-x-0 top-2 z-40">
      {/* 왼쪽 16 · 위 8 · 높이 48 — 링크 44 가 세로 가운데. 768–1023 · 패널 접힘은 로고 알약이 된다(CSS) */}
      <div className="island-logo pointer-events-auto fixed start-4 top-2 flex h-12 items-center">
        <HeaderLogo />
      </div>

      <div className="island-bar">
        {/* `relative` — 접힌 `≡` 메뉴가 알약 오른쪽 끝 아래에 선다(`nav-links.tsx`) */}
        <div className="bg-bg inset-ring-border pointer-events-auto relative ms-auto flex h-12 w-max max-w-full items-center rounded-full p-1 shadow-md inset-ring">
          <NavLinks authed={authed} variant="island" />
          {/* "할 일" 셋과 "내 설정" 을 가른다 (`menu-items.ts`) — 1 × 20, 양옆 4 */}
          <span aria-hidden className="bg-border mx-1 h-5 w-px shrink-0" />
          {authed ? <AccountMenu variant="island" /> : <IslandLoginLink />}
        </div>
      </div>
    </header>
  )
}

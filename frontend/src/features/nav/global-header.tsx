import { HeaderActions, HeaderLogo } from '@/features/nav/header-parts'
import { NavLinks } from '@/features/nav/nav-links'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

/**
 * 전역 헤더 — 아트보드 `01 홈`(모바일 56) / `02 홈`(데스크톱 64) / `03 전역 nav`.
 *
 * **서버 컴포넌트다.** 세션으로 분기하는 셸만 담당하고, 활성 판정(`usePathname`)과
 * 스위처 조회는 client 자식이 맡는다.
 *
 * 좌우 패딩은 **`INSET_CLASS.main`(16/40)을 참조한다** — 문자열을 다시 적지 않는다 (#386).
 * 헤더는 화면 하나가 아니라 제품 전체에 서는 바라 페이지 인셋을 따르고, 그 값이 곧
 * 왼쪽 세로 기준선이다. 레일은 오른쪽만 24 로 좁히므로 왼쪽에서 헤더와 갈리지 않는다
 * (근거는 `lib/ui/inset.ts`).
 *
 * **바(`<header>`)에는 `max-width` 를 두지 않는다** — 캡하면 `border-b` 가 화면 가운데서
 * 끊긴다. 안쪽 div 만 `.content-container` 로 캡해 본문(`.rail-layout`)과 같은 세로
 * 경계에 선다 (#376).
 * 로고와 nav 사이 gap 32, nav 항목 사이 gap 4.
 *
 * **로고는 심볼 + 워드마크 락업이다** — `HeaderLogo`(`header-parts.tsx`)가 그리고 근거(#240)도 거기 있다.
 * 아일랜드 헤더(#1287)와 같은 조각을 쓴다.
 *
 * **`(auth)` 그룹에는 두지 않는다** — 이탈 경로가 되면 `returnTo` 흐름이 깨진다.
 *
 * **`z-40` 이다 — 지도 위 플로팅 컨트롤(`z-30`)보다 위다** (#393). `sticky` + `z-index` 는
 * **쌓임 맥락을 만든다.** 헤더가 `z-30` 이던 동안 안쪽 드롭다운(`Menu` · `PetSwitcher`)의
 * `z-40` 은 그 맥락 **안에서만** 유효했고, 바깥에서 헤더 전체는 여전히 30 이었다. 지도
 * 컨트롤도 30 이라 같은 층에서 DOM 순서가 승패를 갈랐고 — 지도가 뒤에 온다 — `/emergency`
 * 에서 계정 드롭다운이 보기 전환 토글 **아래**로 깔렸다. 값을 올려야 하는 것은 드롭다운이
 * 아니라 **헤더 자신**이다.
 *
 * **지도 아일랜드에서는 숨는다** (#1287). `/places` 지도 보기는 같은 셸의 `IslandHeader`(알약)를
 * 쓴다 — `body:has(.map-island) .global-header` 가 이 띠를 `display: none` 으로 걷는다
 * (`app/globals.css`). 로고 · 오른쪽 묶음은 두 헤더가 `header-parts.tsx` 의 같은 조각을 쓴다.
 *
 * 높이를 `<header>` 자신이 갖고 `box-border` 로 테두리를 그 안에 넣는다. 그래야 헤더가
 * 실제로 차지하는 높이가 `--header-h`(56/64)와 정확히 같아진다 — 안쪽 div 가 높이를
 * 가지면 border 1px 이 더해져 65px 이 되고, 그 1px 때문에
 * `calc(100dvh - var(--header-h))` 를 쓰는 `.rail-layout` 에 스크롤이 생긴다.
 */
export function GlobalHeader({ authed }: { authed: boolean }) {
  return (
    <header className="global-header border-border bg-bg sticky top-0 z-40 box-border h-14 border-b md:h-16">
      <div
        className={cn(
          'content-container flex h-full items-center justify-between gap-3',
          INSET_CLASS.main,
        )}
      >
        <div className="flex min-w-0 items-center gap-8">
          <HeaderLogo />
          <NavLinks authed={authed} />
        </div>

        <HeaderActions authed={authed} />
      </div>
    </header>
  )
}

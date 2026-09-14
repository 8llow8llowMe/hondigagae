import { GlobalHeader } from '@/features/nav/global-header'
import { MobileTabBar } from '@/features/nav/mobile-tab-bar'
import { SiteFooter } from '@/features/nav/site-footer'

/**
 * 앱 셸 — 스킵 링크 · 헤더 · 본문 자리 · 푸터 · 탭바.
 *
 * **`(main)` 레이아웃에서 뽑아낸 것이다** (#494). 전역 404(`app/not-found.tsx`)가 같은
 * 셸을 써야 하는데 **라우트 그룹 레이아웃은 거기까지 닿지 않는다** — 주소가 어느 라우트와도
 * 안 맞으면 Next 는 루트 레이아웃 안에서 루트 `not-found.tsx` 만 그린다. 그래서 없는 주소는
 * 헤더도 푸터도 돌아갈 링크도 없는 화면이 됐다.
 *
 * **복사하지 않고 뽑아낸 이유**는 이 안에 세로 뼈대가 들어 있기 때문이다. 아래
 * `min-h-dvh` + `flex-1` 짝이 깨지면 짧은 화면에서 L0 회색이 콘텐츠 높이에서 끊기고 그
 * 아래로 흰 `body` 가 보인다 (#456③). 404 는 저장소에서 **가장 짧은 화면**이라 그 증상이
 * 가장 잘 나는 자리다 — 두 벌로 두면 한쪽만 고쳐진다.
 *
 * **여기 없는 것: `ToastProvider` 와 프리페치.** 둘 다 `(main)` 만의 것이다. 토스트는
 * 라우트를 옮겨도 provider 가 유지돼야 하는 그룹 안의 관심사고(#82 F4), 반려견 프리페치는
 * 세션이 있을 때만 도는 그룹 레이아웃의 일이다. 404 에 그것들을 끌고 오면 **없는 주소
 * 하나에 백엔드 왕복이 생긴다.**
 */
export function AppShell({ authed, children }: { authed: boolean; children: React.ReactNode }) {
  return (
    <>
      {/*
        스킵 링크 — 탭바까지 있으면 탭 이동이 길다. 헤더 앞에 둔다 (D6).

        `sr-only` + `focus:not-sr-only` 를 쓰지 않는다. `not-sr-only` 의 `height: auto` 가
        같은 variant 의 `h-11` 을 순서로 이겨 **포커스해도 1px 로 남는다** (실측으로 확인).
        화면 밖으로 밀어 두면 크기가 항상 유지된다. 애니메이션은 두지 않는다 —
        `translate` 는 `transition-transform` 이 걸지 않는 별도 속성이고, 스킵 링크는
        즉시 나타나는 편이 낫다.
      */}
      <a
        href="#main"
        className="bg-fg text-fg-inverse text-body-2 focus-visible:ring-brand-500 fixed start-4 top-4 z-50 inline-flex h-11 -translate-y-24 items-center rounded-md px-4 font-semibold focus:translate-y-0 focus-visible:ring-2"
      >
        본문으로 바로가기
      </a>

      {/*
        **세로 뼈대 — 머리 · 본문 · 푸터가 한 열이고 본문이 남는 높이를 먹는다** (#456③).

        이것이 없으면 내용이 짧은 화면에서 L0 회색이 콘텐츠 높이에서 끊기고 그 아래로
        흰 `body` 가 보인다 (1280×900 `/places/<없는 id>` 실측: 회색이 274 에서 끝나고
        푸터 아래 **366px 가 맨 흰색**). `DESIGN.md §0` 은 "흰색은 바닥이 아니라 섹션의
        색" 이라 적었는데 바닥이 뷰포트를 못 채우면 그 규칙이 뒤집힌다.

        **페이지가 아니라 여기서 한 번 건다.** `min-h` 를 상태 파일이나 짧은 화면마다
        붙이면 같은 규칙이 열두 곳으로 갈린다 (`route-state-surface.test.ts` 의
        "여기에 없는 것 — `Canvas` 바닥 높이" 문단이 이 이슈로 미뤄 둔 결정이다).

        **푸터를 밀어내지 않고 바닥에 앉힌다.** `Canvas` 에 `min-h: 100dvh - 헤더` 를
        주는 안은 같은 흰 공백을 없애지만 **없던 스크롤을 모든 짧은 화면에 만든다** —
        푸터(260)가 통째로 접힘 아래로 내려가기 때문이다.
      */}
      <div className="flex min-h-dvh flex-col">
        <GlobalHeader authed={authed} />

        {/*
          남는 높이를 먹고 자식(`Canvas`)에게 넘긴다 — `Canvas` 가 `flex-1` 로 받는다.

          **`tabIndex={-1}` 이 스킵 링크의 목적지 조건이다.** 이것이 없으면 `div` 는
          포커스를 받을 수 없어 `본문으로 바로가기` 를 눌러도 포커스가 `body` 에 남는다 —
          dev 실측에서 `/` · `/places?view=list` · `/plans` · `/plans/new` · `/mypage`
          전부 Enter 직후 `document.activeElement` 가 `BODY` 였다. 같은 문서의
          `#place-list`(`SurfaceStack tabIndex={-1}`)는 정상이라 **패턴이 아니라 누락이었다.**

          Chromium 은 이것 없이도 **순차 포커스 시작점**만은 옮겨 준다(`surface.tsx` 의
          `SurfaceStack` 주석) — 그래서 "다음 Tab 이 본문 안으로 들어간다" 만 보면 멀쩡해
          보인다. 그러나 포커스 자체가 옮겨지지 않으면 스크린리더가 읽기 지점을 옮기지
          않고, 그 보정이 없는 브라우저에서는 헤더부터 다시 훑게 된다. WAI 가 권하는
          처방을 그대로 둔다.
        */}
        <div id="main" tabIndex={-1} className="flex flex-1 flex-col">
          {children}
        </div>

        {/*
          푸터는 본문 밖이다. **지도 화면에서는 스스로 빠진다** (`app/globals.css` 의
          `body:has(.map-canvas-height) .site-footer`) — 자세한 이유는 `SiteFooter` 주석에 있다.
        */}
        <SiteFooter />
      </div>

      {/* 탭바는 `fixed` 라 세로 뼈대 밖이다 — 열에 넣으면 자리를 두 번 차지한다 */}
      <MobileTabBar authed={authed} />
    </>
  )
}

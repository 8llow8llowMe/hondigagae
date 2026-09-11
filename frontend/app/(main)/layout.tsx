import { dehydrate, HydrationBoundary } from '@tanstack/react-query'

import { ToastProvider } from '@/components/toast'
import { GlobalHeader } from '@/features/nav/global-header'
import { MobileTabBar } from '@/features/nav/mobile-tab-bar'
import { SiteFooter } from '@/features/nav/site-footer'
import { petKeys } from '@/features/pet/queries'
import { petListPath } from '@/lib/api/pet'
import { serverFetch } from '@/lib/api/server'
import { readSession } from '@/lib/auth/session'
import { getServerQueryClient } from '@/lib/query/query-client'
import type { PetList } from '@/types/pet'

/**
 * `(main)` 그룹 레이아웃 — 전역 nav 조립.
 *
 * **`(auth)` 그룹에는 nav 가 없다** (전역nav-세부명세 D0). 로그인·회원가입에 이탈 경로를
 * 두면 `returnTo` 흐름이 깨진다.
 *
 * 스위처가 쓸 반려견 목록을 여기서 프리페치한다 — 모든 화면의 헤더가 같은 데이터를 쓰므로
 * 화면마다 조회하면 왕복이 늘어난다. **미로그인이면 조회하지 않는다** (D3).
 *
 * 랜드마크: `<header>` 1개 + `<nav>` 2개(주요·하단) + 스킵 링크.
 * 이 문서 전체에 랜드마크가 0개이던 상태를 여기서 해결한다 (이슈 #15).
 */
export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession()
  const authed = session !== null

  const queryClient = getServerQueryClient()

  if (session !== null) {
    // 프리페치 실패를 화면 전체 실패로 만들지 않는다. retry: false 는
    // architecture-guide.md §9 — 서버 렌더가 재시도 백오프만큼 블로킹된다.
    await queryClient
      .prefetchQuery({
        queryKey: petKeys.list(),
        queryFn: () => serverFetch<PetList>(petListPath(), { accessToken: session.accessToken }),
        retry: false,
      })
      .catch(() => undefined)
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
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
          토스트는 `(main)` 에만 둔다. 여기에 두면 **라우트를 옮겨도 provider 가 유지돼**
          장소 추가 화면에서 담고 일정 상세로 돌아온 뒤 토스트가 그대로 뜬다 (#82 F4).
          `aboveTabBar` 기본값 그대로다 — 이 그룹에만 고정 탭바가 있다.
        */}
        <ToastProvider>
          {/*
            남는 높이를 먹고 자식(`Canvas`)에게 넘긴다 — `Canvas` 가 `flex-1` 로 받는다.

            **탭바 자리를 여기서 비우지 않는다.** 예전에는 `pb-16 md:pb-0` 이 있었는데,
            그 padding 은 `Canvas` **밖**이라 모바일에서 회색 바닥과 푸터 사이에 흰 띠
            64px 을 만들었다 (375×812 실측: 회색이 266 에서 끝나고 푸터가 330 에서 시작).
            탭바 자리는 이미 두 곳이 비우고 있다 — 푸터는 자기 `padding-block-end`
            (`app/globals.css` `.site-footer`), 푸터가 빠지는 지도 화면은
            `.map-canvas-height` 가 `100dvh - 헤더 - 탭바` 로 스스로.
          */}
          <div id="main" className="flex flex-1 flex-col">
            {children}
          </div>
        </ToastProvider>

        {/*
          푸터는 `ToastProvider` 밖이다 — 토스트가 필요한 것은 본문의 조작이고, 푸터는
          상태 없는 표기다. **지도 화면에서는 스스로 빠진다** (`app/globals.css` 의
          `body:has(.map-canvas-height) .site-footer`) — 자세한 이유는 `SiteFooter` 주석에 있다.
        */}
        <SiteFooter />
      </div>

      {/* 탭바는 `fixed` 라 세로 뼈대 밖이다 — 열에 넣으면 자리를 두 번 차지한다 */}
      <MobileTabBar authed={authed} />
    </HydrationBoundary>
  )
}

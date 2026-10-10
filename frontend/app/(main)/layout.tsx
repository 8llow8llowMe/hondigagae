import { dehydrate, HydrationBoundary } from '@tanstack/react-query'

import { ToastProvider } from '@/components/toast'
import { AppShell } from '@/features/nav/app-shell'
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
 * **셸 자체는 `AppShell` 이 갖는다** (#494) — 전역 404 와 같은 것을 써야 해서 뽑아냈다.
 * 여기 남는 것은 그룹만의 것 둘이다: 세션 기반 프리페치와 `ToastProvider`.
 *
 * 랜드마크: `<header>` 1개 + `<nav>` 2개(주요·하단) + 스킵 링크 — `AppShell` 이 그린다.
 * 이 문서 전체에 랜드마크가 0개이던 상태를 해결한 것이 이슈 #15 다.
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
        **셸은 `AppShell` 한 곳이다** (#494). 전역 404 가 같은 헤더·푸터·세로 뼈대를 써야
        하는데 라우트 그룹 레이아웃이 거기까지 닿지 않아, 여기 있던 것을 뽑아냈다.
      */}
      <AppShell authed={authed}>
        {/*
          토스트는 `(main)` 에만 둔다. 여기에 두면 **라우트를 옮겨도 provider 가 유지돼**
          장소 추가 화면에서 담고 일정 상세로 돌아온 뒤 토스트가 그대로 뜬다 (#82 F4).
          `aboveTabBar` 기본값 그대로다 — 이 그룹에만 고정 탭바가 있다.

          **토스트 컨테이너는 `fixed` 라 본문 흐름에 끼지 않는다** — 셸 안으로 들어와도
          `#main` 의 세로 배치는 그대로다.
        */}
        <ToastProvider>{children}</ToastProvider>
      </AppShell>
    </HydrationBoundary>
  )
}

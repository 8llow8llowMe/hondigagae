import { dehydrate, HydrationBoundary } from '@tanstack/react-query'

import { Canvas, SurfaceStack } from '@/components/surface'
import { favoriteKeys } from '@/features/favorite/queries'
import { MyPageView } from '@/features/member/my-page-view'
import { memberKeys } from '@/features/member/queries'
import { petKeys } from '@/features/pet/queries'
import { favoriteListPath } from '@/lib/api/favorite'
import { myInfoPath } from '@/lib/api/member'
import { petListPath } from '@/lib/api/pet'
import { serverFetch } from '@/lib/api/server'
import { readSession } from '@/lib/auth/session'
import { messages } from '@/lib/messages'
import { getServerQueryClient } from '@/lib/query/query-client'
import type { FavoritePlaceList } from '@/types/favorite'
import type { MemberMyInfo } from '@/types/member'
import type { PetList } from '@/types/pet'

export const metadata = {
  title: `${messages.member.myPageTitle} · 혼디가개`,
  description: messages.member.myPageDescription,
}

export default async function MyPage() {
  // 보호 리소스다. proxy.ts 가 세션 쿠키 존재를 이미 확인했지만, 프리페치에는
  // access token 이 필요하다 — 없으면 프리페치를 건너뛰고 클라이언트가 조회한다
  // (BFF 가 401 → 재발급 흐름을 처리한다).
  const session = await readSession()

  const queryClient = getServerQueryClient()

  if (session !== null) {
    const accessToken = session.accessToken

    /*
      **`fetchQuery` 가 아니라 `prefetchQuery` 다.** `/members/me` 는 404 가 나올 수 없는
      리소스라 실패를 `notFound()` 로 보낼 이유가 없다 — 일정 목록과 같은 형태고,
      장소·일정 상세와는 다르다 (D3).

      셋을 병렬로 받는다. 반려견·저장한 장소 조회가 실패해도 회원 정보는 그대로 그려야
      하므로 `catch` 를 각각 건다 — `Promise.all` 하나에 묶으면 한쪽 실패가 셋 다 버린다.
      `retry: false` 인 이유는 architecture-guide.md §9.

      **저장한 장소도 여기서 받는다** (#127). 진입점 행이 개수를 보여 주는데, 프리페치가
      없으면 마이페이지에 들어갈 때마다 그 줄만 스켈레톤으로 늦게 채워진다.
    */
    await Promise.all([
      queryClient
        .prefetchQuery({
          queryKey: memberKeys.me(),
          queryFn: () => serverFetch<MemberMyInfo>(myInfoPath(), { accessToken }),
          retry: false,
        })
        .catch(() => undefined),
      queryClient
        .prefetchQuery({
          queryKey: petKeys.list(),
          queryFn: () => serverFetch<PetList>(petListPath(), { accessToken }),
          retry: false,
        })
        .catch(() => undefined),
      queryClient
        .prefetchQuery({
          queryKey: favoriteKeys.list(),
          queryFn: () => serverFetch<FavoritePlaceList>(favoriteListPath(), { accessToken }),
          retry: false,
        })
        .catch(() => undefined),
    ])
  }

  return (
    /*
      **3층 표면** (`DESIGN.md §0`, 이슈 #466). `main` 이 L0 바닥을 전폭으로 깔고,
      `내 정보` 와 `계정` 이 그 위의 카드 둘이 된다 — 카드는 `MyPageSections` 가 그린다.

      **폭은 그대로 `max-w-screen-md` 다.** 설정 목록이라 데스크톱에서도 레일을 쓰지
      않는다 — 맥락 패널에 담을 것이 없다 (D1). 다만 **폭을 가진 것이 `main` 이 아니라
      `SurfaceStack` 이다**: 바닥은 전폭이어야 하고 쌓기가 폭을 갖는다 (#453 · #462).

      **2a 헤더 바(`border-b h-14`)를 걷었다** — 제목이 첫 카드의 머리로 들어갔고,
      바닥 위에 선 하나만 남기면 카드 테두리와 나란히 두 줄로 읽힌다 (#464 와 같다).
    */
    <Canvas as="main" id="main-content">
      <SurfaceStack className="mx-auto w-full max-w-screen-md">
        {/*
          **보이는 제목은 첫 카드의 `h2` 다** (§0 "섹션 제목은 섹션 안에 있다").
          이 화면의 주인공 카드 이름이 곧 페이지의 이름이라, 밖에 두면 제목만 바닥 위에
          떠 어느 묶음의 제목인지 모호해진다 — 장소 목록(#439) · 반려견(#464)과 같다.
        */}
        <h1 className="sr-only">{messages.member.myPageTitle}</h1>

        <HydrationBoundary state={dehydrate(queryClient)}>
          <MyPageView />
        </HydrationBoundary>
      </SurfaceStack>
    </Canvas>
  )
}

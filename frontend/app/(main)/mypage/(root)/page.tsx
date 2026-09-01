import { dehydrate, HydrationBoundary } from '@tanstack/react-query'

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
    // 설정 목록이라 데스크톱에서도 레일을 쓰지 않는다 — 맥락 패널에 담을 것이 없다 (D1).
    // 지도가 붙기 전의 장소 목록과 같은 판단이다.
    <main className="mx-auto w-full max-w-screen-md">
      <header className="border-border flex h-14 items-center border-b px-4 md:px-10">
        <h1 className="text-title-2 text-fg font-extrabold">{messages.member.myPageTitle}</h1>
      </header>

      <HydrationBoundary state={dehydrate(queryClient)}>
        <MyPageView />
      </HydrationBoundary>
    </main>
  )
}

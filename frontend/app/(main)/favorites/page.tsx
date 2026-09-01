import { dehydrate, HydrationBoundary } from '@tanstack/react-query'

import { FavoriteListView } from '@/features/favorite/favorite-list-view'
import { favoriteKeys } from '@/features/favorite/queries'
import { favoriteListPath } from '@/lib/api/favorite'
import { serverFetch } from '@/lib/api/server'
import { readSession } from '@/lib/auth/session'
import { messages } from '@/lib/messages'
import { getServerQueryClient } from '@/lib/query/query-client'
import type { FavoritePlaceList } from '@/types/favorite'

export const metadata = {
  title: `${messages.favorite.listTitle} · 혼디가개`,
  description: messages.favorite.listDescription,
}

/**
 * `/favorites` — 저장한 장소 목록 (이슈 #127, 아트보드 `혼디가개 저장한 장소`).
 *
 * **`/mypage/favorites` 가 아니다.** `/mypage` 레이아웃은 `max-w-screen-md` 설정 목록인데
 * 이 화면은 1200 이상에서 전폭 2열 그리드를 쓴다 — 컨테이너가 맞지 않는다 (명세 D0).
 *
 * 보호 경로다 — `proxy.ts` 의 `PROTECTED_PATHS` 에 `/favorites` 를 넣었다.
 */
export default async function FavoritesPage() {
  // 보호 리소스다. proxy.ts 가 세션 쿠키 존재를 이미 확인했지만, 프리페치에는
  // access token 이 필요하다 — 없으면 프리페치를 건너뛰고 클라이언트가 조회한다
  // (BFF 가 401 → 재발급 흐름을 처리한다).
  const session = await readSession()

  const queryClient = getServerQueryClient()

  if (session !== null) {
    // 프리페치 실패를 화면 전체 실패로 만들지 않는다. retry: false 인 이유는
    // architecture-guide.md §9 — 서버 렌더가 재시도 백오프만큼 블로킹된다.
    await queryClient
      .prefetchQuery({
        queryKey: favoriteKeys.list(),
        queryFn: () =>
          serverFetch<FavoritePlaceList>(favoriteListPath(), {
            accessToken: session.accessToken,
          }),
        retry: false,
      })
      .catch(() => undefined)
  }

  return (
    // max-w 를 걸지 않는다 — 전폭 가변이 아트보드 03 의 전제이고, 1200 이상 2열 접기가
    // 그 대신 밀도를 잡는다 (명세 D1).
    <main className="w-full">
      <header className="border-border flex h-14 items-center border-b px-4 md:px-10">
        <h1 className="text-title-2 text-fg font-extrabold">{messages.favorite.listTitle}</h1>
      </header>

      <div className="py-6">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <FavoriteListView />
        </HydrationBoundary>
      </div>
    </main>
  )
}

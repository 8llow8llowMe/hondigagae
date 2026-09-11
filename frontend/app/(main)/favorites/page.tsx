import { dehydrate, HydrationBoundary } from '@tanstack/react-query'

import { Canvas, SurfaceStack } from '@/components/surface'
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
    /*
      **3층 표면** (`DESIGN.md §0`, 이슈 #462). `main` 이 L0 바닥을 전폭으로 깔고,
      목록이 L1 카드 하나가 된다 — 카드는 `FavoriteListSection` 이 그린다(개수가 응답에서
      온다).

      **2a 헤더 바(`h-14 border-b`)를 걷었다.** 제목이 카드 안으로 들어갔고, 바닥 위에
      선 하나만 남기면 카드 테두리와 나란히 두 줄로 읽힌다.

      **쌓기는 1440 캡 안이다**(`content-container`). 바닥(`Canvas`)은 전폭으로 두고 캡은
      `SurfaceStack` 에 건다 — `Canvas` 에 걸면 캡 바깥이 흰색으로 남는다(§0). 2a 때 이
      화면은 캡에 가입하지 않았는데, **같은 페이지의 헤더·푸터는 `content-container` 라**
      1920 에서 로고 x=277 대 카드 제목 x=45 로 갈렸다(실측). `DESIGN.md §7` 은 전폭을
      지도 화면에만 허용한다. 2열 접기 근거(1440 에서 행이 1360)는 캡 안에서 그대로
      성립하고, 캡이 붙으면 **행 폭이 유한해진다** — 2560 에서 트랙이 1255 까지 자라던 것이
      사라진다.
    */
    <Canvas as="main" id="main-content">
      <SurfaceStack className="content-container">
        {/*
          **페이지 제목이 카드 제목으로 들어갔다** (§0 "섹션 제목은 섹션 안에 있다").
          이 화면의 카드는 하나뿐이고 그 카드의 이름이 곧 페이지의 이름이라, 밖에 두면
          제목만 바닥 위에 떠 어느 묶음의 제목인지 모호해진다. 보이는 제목은 카드의 `h2`
          이고 `h1` 은 `sr-only` 로 남긴다 — 장소 목록(#439)과 같은 방식이다.
        */}
        <h1 className="sr-only">{messages.favorite.listTitle}</h1>

        <HydrationBoundary state={dehydrate(queryClient)}>
          <FavoriteListView />
        </HydrationBoundary>
      </SurfaceStack>
    </Canvas>
  )
}

import { dehydrate, HydrationBoundary } from '@tanstack/react-query'

import { Canvas, SurfaceStack } from '@/components/surface'
import { PetListView } from '@/features/pet/pet-list-view'
import { petKeys } from '@/features/pet/queries'
import { petListPath } from '@/lib/api/pet'
import { serverFetch } from '@/lib/api/server'
import { readSession } from '@/lib/auth/session'
import { messages } from '@/lib/messages'
import { getServerQueryClient } from '@/lib/query/query-client'
import type { PetList } from '@/types/pet'

export const metadata = {
  title: `${messages.pet.listTitle} · 혼디가개`,
  description: messages.pet.listDescription,
}

export default async function PetsPage() {
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
        queryKey: petKeys.list(),
        queryFn: () => serverFetch<PetList>(petListPath(), { accessToken: session.accessToken }),
        retry: false,
      })
      .catch(() => undefined)
  }

  return (
    /*
      **3층 표면** (`DESIGN.md §0`, 이슈 #464). `main` 이 L0 바닥을 전폭으로 깔고,
      목록이 L1 카드 하나가 된다 — 카드는 `PetListSection` 이 그린다(머리의 등록 버튼이
      상한에 따라 갈리고 그 값이 응답에서 온다).

      **폭은 그대로 `max-w-screen-md` 다.** 2a 때 정한 이유가 3a 에서도 그대로다 —
      반려견 행은 우측에 붙는 액션이 없어(중첩 링크 금지) 폭을 잡아 줄 것이 없고, 최대
      5마리라 `/favorites` 처럼 2열로 접을 것도 못 된다. 다만 **폭을 가진 것이 `main` 이
      아니라 `SurfaceStack` 이다**: 바닥은 전폭이어야 하고 쌓기가 폭을 갖는다 (#453 · #462).

      **2a 헤더 띠(`border-b px-4 py-5`)를 걷었다** — 제목·설명이 카드 머리로 들어갔고,
      바닥 위에 선 하나만 남기면 카드 테두리와 나란히 두 줄로 읽힌다.
    */
    <Canvas as="main" id="main-content">
      <SurfaceStack className="mx-auto w-full max-w-screen-md">
        {/*
          **보이는 제목은 카드의 `h2` 다** (§0 "섹션 제목은 섹션 안에 있다"). 이 화면의
          카드는 하나뿐이고 그 카드의 이름이 곧 페이지의 이름이라, 밖에 두면 제목만 바닥
          위에 떠 어느 묶음의 제목인지 모호해진다 — 장소 목록(#439)과 같은 방식이다.
        */}
        <h1 className="sr-only">{messages.pet.listTitle}</h1>

        <HydrationBoundary state={dehydrate(queryClient)}>
          <PetListView />
        </HydrationBoundary>
      </SurfaceStack>
    </Canvas>
  )
}

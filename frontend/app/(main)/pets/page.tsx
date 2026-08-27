import { dehydrate, HydrationBoundary } from '@tanstack/react-query'

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
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <header>
        <h1 className="text-display text-fg font-extrabold">{messages.pet.listTitle}</h1>
        <p className="text-body-2 text-fg-muted mt-2">{messages.pet.listDescription}</p>
      </header>

      <HydrationBoundary state={dehydrate(queryClient)}>
        <PetListView />
      </HydrationBoundary>
    </main>
  )
}

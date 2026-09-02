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
    /*
      **선은 전폭 방식에서 가져오고, 폭은 다시 묶는다.**

      원래 `max-w-2xl` 중앙 정렬이었는데 테두리 없는 좁은 칸이라 목록의 시작과 끝이
      보이지 않았다. 그래서 전폭 + 제목 띠 + 전폭 행으로 바꿨더니 이번엔 1440 에서
      한 행이 1150 까지 늘어나 행 내용이 왼쪽 끝에 몰렸다 — 반려견 행은 우측에 붙는
      액션이 없어(중첩 링크 금지) 폭을 잡아 줄 것이 없다. `/favorites` 가 전폭인 것은
      1200 이상에서 2열로 접기 때문인데, 최대 5마리인 이 목록에 2열은 과하다.

      `/mypage` 와 같은 `max-w-screen-md` 로 묶는다 — 성격이 같은 화면이고(내 것을
      모아 둔 목록), 안쪽은 전폭 섹션 규약(px-4 / md:px-10 인셋)을 그대로 쓴다.
    */
    <main className="mx-auto w-full max-w-screen-md">
      <header className="border-border border-b px-4 py-5 md:px-10">
        <h1 className="text-title-2 text-fg font-extrabold">{messages.pet.listTitle}</h1>
        <p className="text-body-2 text-fg-muted mt-1">{messages.pet.listDescription}</p>
      </header>

      <HydrationBoundary state={dehydrate(queryClient)}>
        <PetListView />
      </HydrationBoundary>
    </main>
  )
}

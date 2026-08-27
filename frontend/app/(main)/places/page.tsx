import { dehydrate, HydrationBoundary } from '@tanstack/react-query'

import { PlaceFilterBar } from '@/features/place/place-filter-bar'
import { PlaceListView } from '@/features/place/place-list-view'
import { placeKeys } from '@/features/place/queries'
import { placeListPath, type PlaceSlice } from '@/lib/api/place'
import { serverFetch } from '@/lib/api/server'
import { messages } from '@/lib/messages'
import { getServerQueryClient } from '@/lib/query/query-client'
import { parsePlaceFilters } from '@/lib/url/place-filters'

export const metadata = {
  title: `${messages.place.pageTitle} · 혼디가개`,
  description: messages.place.pageDescription,
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function PlacesPage({ searchParams }: { searchParams: SearchParams }) {
  const filters = parsePlaceFilters(await searchParams)

  // 요청마다 새 인스턴스 — 모듈 스코프 공유는 요청 간 데이터 유출이다
  const queryClient = getServerQueryClient()

  // 프리페치 실패를 화면 전체 실패로 만들지 않는다. 실패하면 클라이언트가 재조회한다.
  //
  // retry: false 가 중요하다. 전역 기본값(5xx 2회 재시도)을 그대로 쓰면 백엔드가
  // 느리거나 죽었을 때 **서버 렌더가 재시도 백오프만큼 통째로 블로킹된다**
  // (실측: 게이트웨이 다운 시 GET /places 가 3.1초). 서버는 한 번만 시도하고
  // 실패하면 즉시 넘긴다 — 재시도는 클라이언트가 사용자 조작으로 수행한다.
  await queryClient
    .prefetchInfiniteQuery({
      queryKey: placeKeys.list(filters),
      queryFn: () => serverFetch<PlaceSlice>(placeListPath(filters, null)),
      initialPageParam: null as string | null,
      retry: false,
    })
    .catch(() => undefined)

  // 좌우 여백은 DESIGN.md §4 스케일: 16(모바일) / 24(태블릿) / 40(데스크톱).
  // 한 컬럼을 유지한다 — 지도 뷰가 붙으면 데스크톱은 '좌측 목록 + 우측 지도' 2단이
  // 되므로 지금 다단 그리드로 가면 그때 다시 갈아엎어야 한다.
  return (
    <main className="mx-auto flex max-w-screen-md flex-col gap-6 px-4 py-6 md:px-6 md:py-8 lg:px-10">
      <header>
        <h1 className="text-display text-fg font-extrabold">{messages.place.pageTitle}</h1>
        <p className="text-body-2 text-fg-muted mt-2">{messages.place.pageDescription}</p>
      </header>

      <PlaceFilterBar filters={filters} />

      <HydrationBoundary state={dehydrate(queryClient)}>
        <PlaceListView filters={filters} />
      </HydrationBoundary>
    </main>
  )
}

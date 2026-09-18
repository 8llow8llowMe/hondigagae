import { dehydrate, HydrationBoundary } from '@tanstack/react-query'

import { Canvas, SurfaceStack } from '@/components/surface'
import { walkCourseKeys } from '@/features/walk-course/queries'
import { WalkCourseListView } from '@/features/walk-course/walk-course-list-view'
import { petListPath } from '@/lib/api/pet'
import { serverFetch } from '@/lib/api/server'
import { type WalkCourseListParams, walkCourseListPath } from '@/lib/api/walk-course'
import { readSession } from '@/lib/auth/session'
import { messages } from '@/lib/messages'
import { getServerQueryClient } from '@/lib/query/query-client'
import { parseWalkCourseFilters } from '@/lib/url/walk-course-filters'
import { representativePet, resolveActivityParam } from '@/lib/walk-course/activity'
import type { PetList } from '@/types/pet'
import type { WalkCourseList } from '@/types/walk-course'

export const metadata = {
  title: `${messages.walkCourse.pageTitle} · 혼디가개`,
  description: messages.walkCourse.pageDescription,
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

/**
 * `/walk-courses` — 제주올레 코스 목록 (#618).
 *
 * **공개 화면이다.** `proxy.ts` `PROTECTED_PATHS` 에 넣지 않는다 — dev OpenAPI 의 두
 * operation 모두 `security` 키가 없고, `tour-service` 는 `/places` 와 같은 공개 조회
 * 서비스다 (공통명세 S1).
 *
 * **`loading.tsx` 를 두지 않는다.** 이 세그먼트 아래 상세(`[walkCourseId]`)가 있고,
 * Suspense 경계가 생기면 응답이 먼저 스트리밍돼 상태 코드를 바꿀 수 없다
 * (`architecture-guide.md` §7 — 장소 목록이 `(list)` 그룹으로 간 이유). 대신 서버
 * 프리페치가 첫 화면을 채우고, 실패하면 클라이언트가 상태를 그린다.
 */
export default async function WalkCoursesPage({ searchParams }: { searchParams: SearchParams }) {
  const resolved = await searchParams
  const filters = parseWalkCourseFilters(resolved)

  /*
    **활동량 기본값의 출처는 대표견이다** (공통명세 S4-1 · D8-1). nav 선택견은
    `localStorage` 에 있어 서버가 읽을 수 없고, 그것을 쓰면 첫 렌더 뒤 재조회가 되어
    **목록이 29 → 6 으로 줄어드는 것이 눈에 보인다.**

    **반려견 조회 실패가 코스 목록을 실패시키지 않는다** (폴백 4). 코스는 공개 API 이고
    반려견은 기본값의 출처일 뿐이다 — `catch` 로 `null` 을 만들고 그대로 간다.

    미로그인에는 **요청 자체를 내지 않는다** — 보호 리소스라 401 이 나가고 전역 재발급이
    헛돈다 (#200 의 결함 모양).
  */
  const session = await readSession()
  const pets =
    session === null
      ? null
      : await serverFetch<PetList>(petListPath(), { accessToken: session.accessToken })
          .then((list) => list.pets)
          .catch(() => null)

  const petActivityLevel = resolveActivityParam(filters.activity, pets)
  const params: WalkCourseListParams = { petActivityLevel, sort: filters.sort }

  /*
    **기준 줄에 반려견 이름을 적는 것은 URL 이 비었을 때뿐이다.** 사용자가 세그먼트로
    직접 고른 조건에 이름을 붙이면 화면이 없는 인과를 말한다 — 대표견이 `낮음` 인데
    `보통` 을 고른 경우가 그렇다.

    **활동량 이름과 상한은 여기서 넘기지 않는다** (#735). 목록 응답의
    `appliedPetActivityLevel` 이 둘 다 내려준다 — 이름은 서버 enum metadata, 상한은
    서버가 실제로 적용한 값이다.
  */
  const basisPet =
    filters.activity === null && petActivityLevel !== null ? representativePet(pets ?? []) : null

  // 요청마다 새 인스턴스 — 모듈 스코프 공유는 요청 간 데이터 유출이다
  const queryClient = getServerQueryClient()

  /*
    프리페치 실패를 화면 전체 실패로 만들지 않는다. 실패하면 클라이언트가 재조회한다.

    `retry: false` — 전역 기본값(5xx 2회)을 상속하면 백엔드가 죽었을 때 **서버 렌더가
    재시도 백오프만큼 통째로 블로킹된다** (`architecture-guide.md` §9).
  */
  await queryClient
    .prefetchQuery({
      queryKey: walkCourseKeys.list(params),
      queryFn: () => serverFetch<WalkCourseList>(walkCourseListPath(params)),
      retry: false,
    })
    .catch(() => undefined)

  return (
    /*
      **3층 표면** (`DESIGN.md §0`). `main` 이 L0 바닥을 전폭으로 깔고 목록이 L1 카드
      하나가 된다. 쌓기는 1440 캡 안이다(`content-container`) — `/favorites` 와 같다.

      보이는 제목은 카드의 `h2` 이고 `h1` 은 `sr-only` 로 남긴다.
    */
    <Canvas as="main" id="main-content">
      <SurfaceStack className="content-container">
        <h1 className="sr-only">{messages.walkCourse.pageTitle}</h1>

        <HydrationBoundary state={dehydrate(queryClient)}>
          <WalkCourseListView filters={filters} params={params} petName={basisPet?.name ?? null} />
        </HydrationBoundary>
      </SurfaceStack>
    </Canvas>
  )
}

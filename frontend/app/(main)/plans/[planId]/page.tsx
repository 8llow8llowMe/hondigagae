import { cache } from 'react'
import { notFound } from 'next/navigation'

import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import type { Metadata } from 'next'

import { Canvas } from '@/components/surface'
import { PlanDetailView } from '@/features/plan/plan-detail-view'
import { planKeys } from '@/features/plan/queries'
import { ApiError } from '@/lib/api/error'
import { planDetailPath } from '@/lib/api/plan'
import { serverFetch } from '@/lib/api/server'
import { readSession } from '@/lib/auth/session'
import { planDetailTitle } from '@/lib/plan/detail-title'
import { getServerQueryClient } from '@/lib/query/query-client'
import type { PlanDetail } from '@/types/plan'

/**
 * **이 세그먼트에는 `loading.tsx` 를 두지 않는다.**
 *
 * `loading.tsx` 는 Suspense 경계를 만들고, 경계가 있으면 응답이 먼저 스트리밍되기
 * 시작한다. 그 뒤에 `notFound()` 를 던지면 not-found UI 는 나오지만 **HTTP 상태가
 * 200 으로 남는다**(soft 404). `app/(main)/plans/` 에도 `loading.tsx` 가 없어 지금은
 * 그룹을 나눌 필요가 없다 — **생기면 그때 목록을 `(list)` 그룹으로 옮긴다**
 * (docs/architecture-guide.md §7, 장소 상세와 같은 골격).
 */
type Params = Promise<{ planId: string }>

/**
 * `generateMetadata` 와 페이지 렌더가 같은 요청 안에서 백엔드를 두 번 부르지 않게 한다.
 * `serverFetch` 는 `cache: 'no-store'` 라 Next 의 fetch 중복 제거가 걸리지 않는다
 * (`places/[placeId]/page.tsx` 와 같은 패턴).
 */
const loadPlanDetail = cache((planId: string, accessToken: string | undefined) =>
  serverFetch<PlanDetail>(planDetailPath(planId), { accessToken }),
)

/**
 * **탭 제목은 404 `찾을 수 없는 일정이에요` 와 그 밖 전부 `여행 일정` 둘이다** — 404 는
 * #676, 나머지는 #905 R5. 일정 이름은 싣지 않는다(프라이버시 근거는
 * `src/lib/plan/detail-title.ts` 머리주석). 5xx·무응답도 목록 제목으로 떨어진다 —
 * `architecture-guide.md` §7 의 #206 규칙이고 장소 상세와 같다.
 *
 * **`not-found.tsx` 자신의 `metadata` 로는 못 고친다.** 이 페이지가 비동기 조회 뒤
 * 조건부로 `notFound()` 를 던지는데, Next 16 은 그 경우 이 페이지가 이미 확정해 둔
 * 메타데이터(여기서는 "없음")를 그대로 쓰고 형제 `not-found.tsx` 의 `metadata` 로
 * 되돌리지 않는다 — 실측 근거는 `src/lib/plan/detail-title.ts` 머리주석과
 * `docs/architecture-guide.md` §7.
 *
 * **백엔드를 한 번 더 부르지 않는다.** `loadPlanDetail` 이 `cache()` 로 감싸여 있어
 * 페이지 렌더가 쓰는 것과 같은 호출을 재사용한다(장소 상세와 같은 패턴).
 */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { planId } = await params
  const session = await readSession()

  let error: unknown = null
  try {
    await loadPlanDetail(planId, session?.accessToken)
  } catch (caught) {
    error = caught
  }

  return { title: `${planDetailTitle(error)} · 혼디가개` }
}

export default async function PlanDetailPage({ params }: { params: Params }) {
  const { planId } = await params

  // 보호 경로다. `proxy.ts` 의 PROTECTED_PATHS 에 '/plans' 가 이미 있어
  // `/plans/{planId}` 도 걸린다 — 여기 도달하면 세션이 있다
  const session = await readSession()

  // 요청마다 새 인스턴스 — 모듈 스코프 공유는 요청 간 데이터 유출이다
  const queryClient = getServerQueryClient()

  /*
    `prefetchQuery` 가 아니라 `fetchQuery` + try/catch 다. `prefetchQuery` 는 에러를
    삼켜서 404(그런 일정이 없음)와 5xx(일시 장애)를 구분할 수 없다.

    `retry: false` — 전역 기본값(5xx 2회)을 상속하면 백엔드가 죽었을 때 서버 렌더가
    재시도 백오프만큼 통째로 블로킹된다 (architecture-guide.md §9).
  */
  try {
    await queryClient.fetchQuery({
      queryKey: planKeys.detail(planId),
      queryFn: () => loadPlanDetail(planId, session?.accessToken),
      retry: false,
    })
  } catch (error) {
    // 백엔드는 **본인 소유가 아니어도 404** 다 — 화면도 존재 여부를 흘리지 않는다
    if (error instanceof ApiError && error.kind === 'not-found') notFound()
    // 그 외(5xx·무응답·400)는 클라이언트가 판정해 안내한다
  }

  /*
    **`today` 를 서버에서 만들어 내려보낸다.** 클라이언트가 따로 `new Date()` 를 부르면
    자정 근처에서 서버 렌더와 하이드레이션의 D-day 가 하루 갈린다 (목록과 같은 결정).
  */
  // `main` 이 L0 바닥이다 (`DESIGN.md §0`, #447) — 카드를 쌓는 일은 `PlanDetailSection` 의 `SurfaceStack` 이 맡는다
  return (
    <Canvas as="main" id="main-content">
      <HydrationBoundary state={dehydrate(queryClient)}>
        <PlanDetailView planId={planId} today={new Date().toISOString()} />
      </HydrationBoundary>
    </Canvas>
  )
}

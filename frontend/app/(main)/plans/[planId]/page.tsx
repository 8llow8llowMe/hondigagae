import { notFound } from 'next/navigation'

import { dehydrate, HydrationBoundary } from '@tanstack/react-query'

import { Canvas } from '@/components/surface'
import { PlanDetailView } from '@/features/plan/plan-detail-view'
import { planKeys } from '@/features/plan/queries'
import { ApiError } from '@/lib/api/error'
import { planDetailPath } from '@/lib/api/plan'
import { serverFetch } from '@/lib/api/server'
import { readSession } from '@/lib/auth/session'
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
 *
 * `generateMetadata` 를 두지 않는다 — 보호 화면이라 크롤러가 못 들어오고, 제목 하나를
 * 위해 백엔드를 한 번 더 부를 이유가 없다.
 */
type Params = Promise<{ planId: string }>

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
      queryFn: () =>
        serverFetch<PlanDetail>(planDetailPath(planId), {
          accessToken: session?.accessToken,
        }),
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

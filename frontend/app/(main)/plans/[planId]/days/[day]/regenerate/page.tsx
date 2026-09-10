import { notFound } from 'next/navigation'

import { dehydrate, HydrationBoundary } from '@tanstack/react-query'

import { Canvas } from '@/components/surface'
import { PlanDayRegenerateView } from '@/features/plan/plan-day-regenerate-view'
import { planKeys } from '@/features/plan/queries'
import { ApiError } from '@/lib/api/error'
import { planDetailPath } from '@/lib/api/plan'
import { serverFetch } from '@/lib/api/server'
import { readSession } from '@/lib/auth/session'
import { messages } from '@/lib/messages'
import { getServerQueryClient } from '@/lib/query/query-client'
import type { PlanDetail } from '@/types/plan'

/**
 * 하루 재생성 — 하루재생성-세부명세 R2.
 *
 * **`loading.tsx` 를 두지 않는다.** 아래 `notFound()` 가 HTTP 상태를 바꿔야 하는데
 * Suspense 경계가 있으면 응답이 먼저 스트리밍돼 soft 404 가 된다
 * (`days/[day]/add/page.tsx` 와 같은 이유).
 */
export async function generateMetadata({ params }: { params: Params }) {
  const { day } = await params
  /*
    **일차를 제목에 넣는다.** `days/[day]/add` 는 일정 제목이 필요해 정적 문구를 썼지만
    (백엔드를 한 번 더 불러야 한다) 일차는 경로에 이미 있어 공짜다.
  */
  return {
    title: `${messages.plan.regenerateDayPageTitle.replace('{day}', day)} · 혼디가개`,
  }
}

type Params = Promise<{ planId: string; day: string }>

export default async function PlanDayRegeneratePage({ params }: { params: Params }) {
  const { planId, day: rawDay } = await params

  /*
    경로의 `day` 를 여기서 막는다 — 백엔드 `@PathVariable int` 라 숫자가 아니면 400 이고,
    형식이 틀린 주소는 없는 페이지다. **기간 상한은 뷰가 판단한다** — 라우트는
    `totalDays` 를 모른다.
  */
  if (!/^\d+$/.test(rawDay)) notFound()
  const day = Number(rawDay)
  if (day < 1) notFound()

  // 보호 경로다 — `proxy.ts` 의 PROTECTED_PATHS 에 '/plans' 가 이미 있다
  const session = await readSession()
  // 요청마다 새 인스턴스 — 모듈 스코프 공유는 요청 간 데이터 유출이다
  const queryClient = getServerQueryClient()

  try {
    await queryClient.fetchQuery({
      queryKey: planKeys.detail(planId),
      queryFn: () =>
        serverFetch<PlanDetail>(planDetailPath(planId), { accessToken: session?.accessToken }),
      // 전역 기본값(5xx 2회)을 상속하면 서버 렌더가 재시도 백오프만큼 블로킹된다
      retry: false,
    })
  } catch (error) {
    // 백엔드는 본인 소유가 아니어도 404 다 — 화면도 존재 여부를 흘리지 않는다
    if (error instanceof ApiError && error.kind === 'not-found') notFound()
  }

  // `main` 이 L0 바닥이다 (`DESIGN.md §0`, #451) — 카드를 쌓는 일은 뷰의 `SurfaceStack` 이 맡는다
  return (
    <Canvas as="main" id="main-content">
      <HydrationBoundary state={dehydrate(queryClient)}>
        {/*
          **`today` 를 서버에서 만들어 내려보낸다.** 클라이언트가 따로 `new Date()` 를
          부르면 자정 근처에서 서버 렌더와 하이드레이션의 판정이 갈린다 (일정 상세와 같은
          결정). 뷰는 이 값으로 재생성이 막힌 일정인지 본다 (`dayRegenerateBlock`).
        */}
        <PlanDayRegenerateView planId={planId} day={day} today={new Date().toISOString()} />
      </HydrationBoundary>
    </Canvas>
  )
}

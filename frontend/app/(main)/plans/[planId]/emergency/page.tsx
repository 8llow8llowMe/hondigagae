import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PlanEmergencyView } from '@/features/plan/plan-emergency-view'
import { planKeys } from '@/features/plan/queries'
import { ApiError } from '@/lib/api/error'
import { planDetailPath } from '@/lib/api/plan'
import { serverFetch } from '@/lib/api/server'
import { readSession } from '@/lib/auth/session'
import { messages } from '@/lib/messages'
import { getServerQueryClient } from '@/lib/query/query-client'
import type { PlanDetail } from '@/types/plan'

/**
 * 보호 화면이라 크롤러가 못 들어오지만 **탭 제목은 필요하다** — `(main)` 의 다른 라우트가
 * 전부 갖고 있고, 없으면 이 화면만 `혼디가개` 로 뜬다.
 */
export const metadata = {
  title: `${messages.plan.emergencyPageTitle} · 혼디가개`,
}

type Params = Promise<{ planId: string }>

/**
 * 일정 주변 병원·약국 (#125).
 *
 * **일정 상세와 별도 라우트다.** 응답이 일자 × 방문 장소 × 최대 3곳이라 3박 4일이면
 * 수십 행이 된다 — 상세의 좌측 레일에 넣으면 개요·준비물 아래로 그만큼 밀린다.
 *
 * **`loading.tsx` 를 두지 않는다.** 아래 `notFound()` 가 HTTP 상태를 바꿔야 하는데,
 * Suspense 경계가 있으면 응답이 먼저 스트리밍돼 soft 404 가 된다
 * (`plans/[planId]/page.tsx` 와 같은 이유, architecture-guide.md §7).
 *
 * **브리핑 자체는 프리페치하지 않는다** — 없는 일정을 404 로 가리는 데 필요한 것은
 * 일정 상세뿐이고, 브리핑은 외부 조회가 방문 장소 수만큼 붙어 서버 렌더를 붙잡는다.
 */
export default async function PlanEmergencyPage({ params }: { params: Params }) {
  const { planId } = await params

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
    // 백엔드는 **본인 소유가 아니어도 404** 다 — 화면도 존재 여부를 흘리지 않는다
    if (error instanceof ApiError && error.kind === 'not-found') notFound()
  }

  return (
    <main id="main-content" className="mx-auto w-full max-w-screen-md">
      <div className="flex flex-col gap-1 px-4 pt-5 pb-2 md:px-10">
        <Link
          href={`/plans/${planId}`}
          className="text-caption text-link hover:text-link-hover focus-visible:ring-brand-500 self-start rounded-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
        >
          {messages.plan.emergencyBack}
        </Link>
        <h1 className="text-title-1 text-fg font-semibold">{messages.plan.emergencyHeading}</h1>
      </div>

      <PlanEmergencyView planId={planId} />
    </main>
  )
}

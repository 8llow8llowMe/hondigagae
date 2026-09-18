import { notFound } from 'next/navigation'

import { Canvas, SurfaceStack } from '@/components/surface'
import { PlanBriefingOutOfRange, PlanBriefingView } from '@/features/plan/plan-briefing-view'
import { planKeys } from '@/features/plan/queries'
import { ApiError } from '@/lib/api/error'
import { planDetailPath } from '@/lib/api/plan'
import { serverFetch } from '@/lib/api/server'
import { readSession } from '@/lib/auth/session'
import { todayDay } from '@/lib/date/day'
import { messages } from '@/lib/messages'
import { pickBriefingDate } from '@/lib/plan/briefing'
import { getServerQueryClient } from '@/lib/query/query-client'
import type { PlanDetail } from '@/types/plan'

/**
 * 보호 화면이라 크롤러가 못 들어오지만 **탭 제목은 필요하다** — `(main)` 의 다른 라우트가
 * 전부 갖고 있고, 없으면 이 화면만 `혼디가개` 로 뜬다.
 */
export const metadata = {
  title: `${messages.plan.briefingPageTitle} · 혼디가개`,
}

type Params = Promise<{ planId: string }>

/**
 * 출발 전 여행 브리핑 (#626).
 *
 * **일정 상세와 별도 라우트다.** 하루치 합본이라 카드가 넷인데, 상세의 좌측 레일은 이미
 * 개요 · 준비물 · 후기 · 배너로 차 있다 — 응급 브리핑(#125)이 같은 이유로 별도 라우트다.
 *
 * **`loading.tsx` 를 두지 않는다.** 아래 `notFound()` 가 HTTP 상태를 바꿔야 하는데,
 * Suspense 경계가 있으면 응답이 먼저 스트리밍돼 soft 404 가 된다
 * (`architecture-guide.md` §7, 응급 브리핑과 같은 이유).
 *
 * **브리핑 자체는 프리페치하지 않는다** — 404 를 가리는 데 필요한 것은 일정 상세뿐이고,
 * 브리핑 한 응답에 외부 조회가 여러 개 붙어 서버 렌더를 붙잡는다
 * (`PlanBriefingProcessor` 머리주석).
 *
 * **URL 에 `?date=` 를 두지 않는다** (명세 D8-2). 날짜는 열 때마다 화면이 고른다 —
 * 새로고침·북마크가 언제나 "지금 봐야 할 날" 을 연다. 어제 열어 둔 탭을 새로 고치면
 * 어제 브리핑이 아니라 오늘 브리핑이 뜬다.
 */
export default async function PlanBriefingPage({ params }: { params: Params }) {
  const { planId } = await params

  // 보호 경로다 — `proxy.ts` 의 PROTECTED_PATHS 에 '/plans' 가 이미 있다
  const session = await readSession()

  // 요청마다 새 인스턴스 — 모듈 스코프 공유는 요청 간 데이터 유출이다
  const queryClient = getServerQueryClient()

  let plan: PlanDetail

  try {
    plan = await queryClient.fetchQuery({
      queryKey: planKeys.detail(planId),
      queryFn: () =>
        serverFetch<PlanDetail>(planDetailPath(planId), { accessToken: session?.accessToken }),
      // 전역 기본값(5xx 2회)을 상속하면 서버 렌더가 재시도 백오프만큼 블로킹된다
      retry: false,
    })
  } catch (error) {
    // 백엔드는 **본인 소유가 아니어도 404** 다 — 화면도 존재 여부를 흘리지 않는다
    if (error instanceof ApiError && error.kind === 'not-found') notFound()

    /*
      **5xx 는 삼키지 않고 세그먼트 `error.tsx` 로 보낸다** — 응급 브리핑은 상세 없이도
      화면이 서지만 이쪽은 **기간으로 날짜를 골라야** 한다(`pickBriefingDate`). 기간을
      모르는 채 그냥 그리면 "아직 브리핑할 날이 아니에요"(기간 밖) 로 떨어져, 일시 장애를
      데이터 부재로 말하게 된다 — 이 저장소가 404 와 5xx 를 가르는 규칙의 정반대다.
    */
    throw error
  }

  /*
    **부를 날짜를 서버에서 고른다.** `date` 는 필수 파라미터고 기간 밖이면 `PLAN_002`
    400 이라(`PlanBriefingProcessor.resolveDay`), 고를 수 없으면 요청 자체를 하지 않는다.

    **오늘을 서버가 만든다** — 클라이언트가 `new Date()` 를 부르면 자정을 걸쳐 서버 렌더와
    하이드레이션이 다른 날을 고를 수 있다 (`dayToLocalNoon` 주석과 같은 이유).
  */
  const target = pickBriefingDate(plan.startDate, plan.endDate, todayDay(new Date()))

  /*
    **3층 표면** (`DESIGN.md §0`). 폭은 응급 브리핑(#460) · 일정 만들기(#453)와 같은
    `max-w-2xl` — 레일 없는 한 단 화면의 카드 폭을 셋이 같은 값으로 쓴다.

    **머리(돌아가기 · `h1` · 부제)는 뷰가 그린다** — 부제가 응답에서 오는데 머리와 한
    덩어리여야 하기 때문이다 (`plan-briefing-view.tsx` 머리주석).
  */
  return (
    <Canvas as="main" id="main-content">
      <SurfaceStack className="mx-auto w-full max-w-2xl">
        {target === null ? (
          <PlanBriefingOutOfRange planId={planId} />
        ) : (
          <PlanBriefingView planId={planId} target={target} />
        )}
      </SurfaceStack>
    </Canvas>
  )
}

import { cache } from 'react'
import { notFound } from 'next/navigation'

import type { Metadata } from 'next'

import { Canvas } from '@/components/surface'
import { SharedPlanExpired } from '@/features/plan/shared-plan-expired'
import { SharedPlanSection } from '@/features/plan/shared-plan-section'
import { ApiError } from '@/lib/api/error'
import { paths } from '@/lib/api/paths'
import { serverFetch } from '@/lib/api/server'
import { sharedPlanOpenGraph, sharedPlanPageTitle } from '@/lib/plan/shared-plan-title'
import type { SharedPlan } from '@/types/plan'

/**
 * 공유 링크로 여는 일정 — **비인증 공개 화면** (#628).
 *
 * **`proxy.ts` `PROTECTED_PATHS` 에 넣지 않는다.** `/plans` 하위에 두면 proxy 가
 * 미로그인을 `/login` 으로 튕겨 **공유 자체가 성립하지 않는다.** 백엔드가
 * `/api/v1/shared-plans` 로 접두어를 가른 것과 같은 이유이고, 경로만 보고 "이것은
 * 공개" 가 읽혀야 한다.
 *
 * **이 세그먼트에는 `loading.tsx` 를 두지 않는다.** `loading.tsx` 는 Suspense 경계를
 * 만들고, 경계가 있으면 응답이 먼저 스트리밍되기 시작한다. 그 뒤에 `notFound()` 를
 * 던지면 not-found UI 는 나오지만 **HTTP 상태가 200 으로 남는다**(soft 404) —
 * `places/[placeId]` · `plans/[planId]` 와 같은 골격이다.
 *
 * **React Query 를 쓰지 않는다.** 뮤테이션·필터·폴링·재조회가 하나도 없는 읽기 전용
 * 서버 렌더라, `QueryClient` + `HydrationBoundary` 는 **쓰지 않을 캐시를 직렬화해
 * HTML 에 실어 내려보내는 값**이 된다. 일정 상세가 그것을 두는 이유(클라이언트가 방문
 * 체크·일자 편집으로 같은 key 를 갱신한다)가 여기에는 없다.
 */
type Params = Promise<{ token: string }>

/**
 * `generateMetadata` 와 페이지 렌더가 같은 요청 안에서 백엔드를 두 번 부르지 않게 한다.
 * `serverFetch` 는 `cache: 'no-store'` 라 Next 의 fetch 중복 제거가 걸리지 않는다
 * (`places/[placeId]/page.tsx` 와 같은 패턴).
 *
 * **`accessToken` 을 넘기지 않는다** — 공개 API 다. 로그인한 사람이 이 링크를 열어도
 * 토큰을 싣지 않는 것이 맞다: 서버는 어차피 보지 않고, 실으면 "공개 경로인데
 * 인증정보가 붙어 나가는" 자리가 하나 생긴다.
 *
 * `retry` 를 걸지 않는다(`serverFetch` 는 애초에 재시도가 없다) — 서버 렌더가 백오프
 * 만큼 블로킹되면 안 된다. 5xx 재시도는 `error.tsx` 의 버튼이 담당한다.
 */
const loadSharedPlan = cache((token: string) =>
  serverFetch<SharedPlan>(paths.sharedPlans.detail(token)),
)

/**
 * **탭 제목 · 공유 미리보기는 링크가 유효하면 일정 이름, 아니면 링크의 상태다** (#980 → #1186).
 *
 * #980 은 무효(404) · 만료(410)에서도 `공유된 여행 일정` 이라 본문과 탭이 갈리던 것을 조회 결과로 갈랐다.
 * #1186 은 유효한 링크에 **일정 이름 하나**를 싣는다 — 메신저 미리보기가 서비스 공통 카드라 받는 사람이
 * 무엇을 받았는지 몰랐다(사용자 결정 2026-10-07). **넘기는 것은 이름뿐이다** — 기간 · 예산 · 메모는
 * 메타데이터로 흘러갈 자리가 없다(`sharedPlanPageTitle` · `sharedPlanOpenGraph` 가 문자열 하나만 받는다).
 *
 * **백엔드를 한 번 더 부르지 않는다.** `loadSharedPlan` 이 `cache()` 라 페이지 렌더와 한
 * 호출을 나눠 쓴다.
 *
 * **`noindex` 가 이 화면의 유일한 색인 방어다.** 토큰 자체가 열람 권한이라 색인되면
 * 링크가 공개된다 — 저장소에 `robots.ts` · `sitemap.ts` 가 없어 여기 말고는 막을 곳이
 * 없다 (명세 보안 메모). **갈래마다 따로 쓰지 않고 반환 한 곳에 둔다** — 조회 성공·실패
 * 어느 쪽에서도 빠지지 않게.
 */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { token } = await params

  let error: unknown = null
  let planTitle: string | null = null
  try {
    planTitle = (await loadSharedPlan(token)).title
  } catch (caught) {
    // 조회 실패를 메타데이터 단계에서 화면 실패로 만들지 않는다. 판정은 페이지가 한다
    error = caught
  }

  const openGraph = sharedPlanOpenGraph(planTitle)

  return {
    title: `${sharedPlanPageTitle(error, planTitle)} · 혼디가개`,
    ...(openGraph === undefined ? {} : { openGraph }),
    robots: { index: false, follow: false },
  }
}

export default async function SharedPlanPage({ params }: { params: Params }) {
  const { token } = await params

  let plan: SharedPlan
  try {
    // 토큰을 싣지 않는 이유·재시도가 없는 이유는 `loadSharedPlan` 머리주석
    plan = await loadSharedPlan(token)
  } catch (error) {
    /*
      **404 와 410 을 갈라서 받는다.** 없는 토큰·폐기·삭제된 일정·초안 회귀는 전부 404
      로 **같게** 오고(서버가 어느 쪽인지 알려 주지 않는다), 만료만 410 이다. 받은
      사람이 할 수 있는 일이 있는 갈래가 410 뿐이라 화면이 다른 말을 해야 한다.
    */
    if (error instanceof ApiError && error.kind === 'not-found') notFound()

    if (error instanceof ApiError && error.kind === 'gone') {
      return (
        <Canvas as="main" id="main-content">
          <SharedPlanExpired />
        </Canvas>
      )
    }

    // 나머지(5xx · 무응답)는 세그먼트 오류 경계로 넘긴다 — 거기에만 재시도가 있다
    throw error
  }

  // `main` 이 L0 바닥이다 (`DESIGN.md §0`) — 카드를 쌓는 일은 `SharedPlanSection` 이 맡는다
  return (
    <Canvas as="main" id="main-content">
      <SharedPlanSection plan={plan} />
    </Canvas>
  )
}

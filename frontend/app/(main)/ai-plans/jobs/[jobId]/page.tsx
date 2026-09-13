import type { Metadata } from 'next'

import { Canvas } from '@/components/surface'
import { AiPlanJobView } from '@/features/ai-plan/ai-plan-job-view'
import { readSession } from '@/lib/auth/session'
import { messages } from '@/lib/messages'

export const metadata: Metadata = {
  title: messages.aiPlan.jobTitle,
}

/**
 * AI 일정 생성 대기 · 결과 — `/ai-plans/jobs/[jobId]`.
 *
 * **서버에서 미리 조회하지 않는다.** 폴링 화면이라 서버가 한 번 찍어 준 값은 곧
 * 낡는다 (architecture-guide.md §9). `loading.tsx` 도 두지 않는다 — 진행 표시가 곧
 * 로딩 표시고, 경계가 있으면 응답이 먼저 스트리밍돼 뒤의 판단이 HTTP 상태를 못 바꾼다
 * (§7 soft 404 규칙과 같은 이유).
 *
 * **`jobId` 가 URL 에 있다.** 새로고침·뒤로가기에서 대기 화면이 살아남는다 (명세 S4).
 *
 * **3층 표면이다** (`DESIGN.md §0`, #473). 하루 재생성(#451)과 같은 모양을 따른다 —
 * 페이지는 `main` 에 L0 바닥만 깔고, 머리와 카드를 쌓는 일은 뷰의 `SurfaceStack` 이 맡는다.
 * 상태 여섯 중 어느 갈래가 카드를 스스로 그리는지는 상태를 아는 뷰만 알기 때문이다.
 */
export default async function AiPlanJobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params

  /*
    **반려견 목록 조회를 켤지 가른다** (#498). 서버가 내린 생성 조건은 `petIds` 만 주므로
    화면이 이름을 회원의 목록에서 맞추는데, `usePetList` 는 보호 리소스라 로그인 여부를
    필수 인자로 받는다. 이 라우트는 `PROTECTED_PATHS` 아래라 사실상 항상 로그인 상태지만
    **상수로 박지 않는다** — 세션 판정은 서버 컴포넌트가 한다 (`auth-guide.md`).
  */
  const session = await readSession()

  return (
    <Canvas as="main" id="main-content">
      <AiPlanJobView jobId={jobId} authed={session !== null} />
    </Canvas>
  )
}

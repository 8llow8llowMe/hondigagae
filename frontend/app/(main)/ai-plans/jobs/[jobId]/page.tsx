import type { Metadata } from 'next'

import { AiPlanJobView } from '@/features/ai-plan/ai-plan-job-view'
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
 */
export default async function AiPlanJobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params

  return (
    <div className="mx-auto w-full max-w-screen-md">
      <AiPlanJobView jobId={jobId} />
    </div>
  )
}

'use client'

import { ErrorState } from '@/components/error-state'
import { messages } from '@/lib/messages'

/**
 * 세그먼트 렌더 중 발생한 예상 못 한 예외.
 *
 * **작업 조회 실패는 여기로 오지 않는다** — `AiPlanJobView` 가 404(`AIPLAN_002`)와
 * 그 외를 직접 가른다 (명세 S7). 작업 실패(`status=FAILED`)는 HTTP 200 이라 애초에
 * 예외가 아니다.
 */
export default function AiPlanJobError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-screen-md px-4 py-6 md:px-6 md:py-8 lg:px-10">
      <ErrorState
        title={messages.aiPlan.jobErrorTitle}
        description={messages.common.temporaryErrorDescription}
        onRetry={reset}
      />
    </main>
  )
}

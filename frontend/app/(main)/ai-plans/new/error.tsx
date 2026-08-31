'use client'

import { ErrorState } from '@/components/error-state'
import { messages } from '@/lib/messages'

/** 조건 입력 세그먼트의 예상 못 한 예외. 반려견 조회 실패는 `AiPlanCreateView` 가 다룬다 */
export default function AiPlanNewError({ reset }: { error: Error; reset: () => void }) {
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

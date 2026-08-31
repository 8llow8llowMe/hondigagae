'use client'

import { ErrorState } from '@/components/error-state'
import { messages } from '@/lib/messages'

/** 세그먼트 렌더 중 발생한 예상 못 한 예외 */
export default function MyPageError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-screen-md px-4 py-6 md:px-10 md:py-8">
      <ErrorState
        title={messages.member.loadFailedTitle}
        description={messages.member.loadFailedDescription}
        onRetry={reset}
      />
    </main>
  )
}

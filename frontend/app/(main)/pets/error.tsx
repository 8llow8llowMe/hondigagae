'use client'

import { ErrorState } from '@/components/error-state'
import { messages } from '@/lib/messages'

/** 세그먼트 렌더 중 발생한 예상 못 한 예외 */
export default function PetsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-6 md:px-6 md:py-8">
      <ErrorState
        title={messages.pet.loadFailedTitle}
        description={messages.pet.loadFailedDescription}
        onRetry={reset}
      />
    </main>
  )
}

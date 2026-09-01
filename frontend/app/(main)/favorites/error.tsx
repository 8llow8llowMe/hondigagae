'use client'

import { ErrorState } from '@/components/error-state'
import { messages } from '@/lib/messages'

/** 세그먼트 렌더 중 발생한 예상 못 한 예외 */
export default function FavoritesError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="w-full py-6">
      <ErrorState
        title={messages.favorite.loadFailedTitle}
        description={messages.favorite.loadFailedDescription}
        onRetry={reset}
      />
    </main>
  )
}

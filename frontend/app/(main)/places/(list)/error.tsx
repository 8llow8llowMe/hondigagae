'use client'

import { ErrorState } from '@/components/error-state'
import { messages } from '@/lib/messages'

/**
 * 세그먼트 렌더 중 발생한 예상 못 한 예외.
 * 데이터 부재(404)는 여기로 오지 않는다 — PlaceListSection 이 EmptyState 로 처리한다
 * (architecture-guide.md §7).
 */
export default function PlacesError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-screen-md px-4 py-6 md:px-6 md:py-8 lg:px-10">
      <ErrorState
        title={messages.place.errorTitle}
        description={messages.common.temporaryErrorDescription}
        onRetry={reset}
      />
    </main>
  )
}

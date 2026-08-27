'use client'

import { ErrorState } from '@/components/error-state'
import { messages } from '@/lib/messages'

/**
 * 세그먼트 렌더 중 발생한 예상 못 한 예외.
 *
 * **숫자가 아닌 `petId` 가 여기로 온다.** 컨트롤러가 `@PathVariable long` 이라
 * `/pets/abc` 는 404 가 아니라 400(`PET_113`) 이고, `notFound()` 가 걸리지 않는다
 * (수정-세부명세 D5). 데이터 부재(404)는 `not-found.tsx` 가 받는다.
 */
export default function PetEditError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-lg px-4 py-6 md:px-6 md:py-8">
      <ErrorState
        title={messages.pet.loadFailedTitle}
        description={messages.pet.loadFailedDescription}
        onRetry={reset}
      />
    </main>
  )
}

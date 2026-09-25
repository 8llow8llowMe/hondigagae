'use client'

import { ErrorState } from '@/components/error-state'
import { Canvas, SurfaceStack } from '@/components/surface'
import { messages } from '@/lib/messages'

/**
 * 공유 일정 조회의 일시 장애 — 5xx · 게이트웨이 무응답 (#628).
 *
 * **404 와 410 은 여기로 오지 않는다.** `page.tsx` 가 둘을 먼저 가른다 —
 * 404 는 `notFound()`, 410 은 `SharedPlanExpired` 다. 여기 남는 것은 **재시도가 뜻을
 * 갖는 실패**뿐이라 `ErrorState`(재시도 있음)가 맞다.
 *
 * 카드 판정·`content-container`·`sr-only h1` 은 `plans/[planId]/error.tsx` 주석이
 * 정본이다. 정상 화면(`SharedPlanSection`)이 카드를 쓰지만 상태는 L0 위에 바로 서는
 * 축을 따른다.
 */
export default function SharedPlanError({ retry }: { error: Error; retry: () => void }) {
  return (
    <Canvas as="main" id="main-content">
      <SurfaceStack className="content-container">
        <h1 className="sr-only">{messages.plan.sharedErrorTitle}</h1>

        <ErrorState
          title={messages.plan.sharedErrorTitle}
          description={messages.common.temporaryErrorDescription}
          inset="card"
          onRetry={retry}
        />
      </SurfaceStack>
    </Canvas>
  )
}

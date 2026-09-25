'use client'

import { ErrorState } from '@/components/error-state'
import { Canvas, Surface, SurfaceStack } from '@/components/surface'
import { messages } from '@/lib/messages'

/**
 * 조건 입력 세그먼트의 예상 못 한 예외. 반려견 조회 실패는 `AiPlanCreateView` 가 다룬다.
 *
 * **3층 표면이고 카드다** (`DESIGN.md §0`, #475).
 *
 * **카드 판정은 그 세그먼트의 정상 화면을 따른다** — 정상 화면이 상태(로딩·오류·빈)를
 * 카드에 담으면 라우트 경계도 담고, 담지 않으면 경계도 담지 않는다. 여기서는
 * `AiPlanCreateSurface`(`ai-plan-create-view.tsx`)가 **네 상태를 전부** 같은
 * `<Surface lead title={messages.aiPlan.createTitle}>` 하나에 담는다 — 그 카드가 이
 * 화면의 껍데기라, 경계만 카드 없이 서면 예외에서 껍데기가 사라진다.
 *
 * **판정 3문의 ③("담는 항목이 둘 이상인가")을 "지금 담긴 자식 수" 로 읽지 않는다.**
 * 그렇게 읽으면 정상 화면의 카드들도 전부 카드가 아니어야 한다 — ③ 은 그 면이 **화면의
 * 답을 담는 역할인가**를 묻는다.
 *
 * **부제(`createDescription`)는 옮기지 않는다.** "어떤 여행을 원하는지 알려주세요" 는
 * 폼을 채우라는 안내인데 이 문서에는 채울 폼이 없다. 이름표(`title`)만 같게 둔다.
 *
 * 상태 컴포넌트는 카드 안이므로 인셋이 `card`(16/20) 그대로다.
 *
 * 폭은 이 세그먼트의 정상 화면과 같은 `max-w-2xl`(672)이다 — `page.tsx` 가 폼 화면
 * 한 단 폭(#453 · #464)에 맞춰 고른 값이라 예외만 768 로 넓으면 글줄 끝이 흔들린다.
 *
 * **`h1` 은 화면의 이름(`createTitle`)이고 `sr-only` 다.** `page.tsx` 가 같은 키를 같은
 * 방식으로 쓴다 — 보이는 제목은 카드의 `h2` 가 그리고, `h1` 이 없으면 문서의 최상위
 * 제목이 그 `h2` 가 된다.
 */
export default function AiPlanNewError({ retry }: { error: Error; retry: () => void }) {
  return (
    <Canvas as="main" id="main-content">
      <SurfaceStack className="mx-auto w-full max-w-2xl">
        <h1 className="sr-only">{messages.aiPlan.createTitle}</h1>

        <Surface lead title={messages.aiPlan.createTitle}>
          <ErrorState
            title={messages.aiPlan.jobErrorTitle}
            description={messages.common.temporaryErrorDescription}
            inset="card"
            headingLevel={3}
            onRetry={retry}
          />
        </Surface>
      </SurfaceStack>
    </Canvas>
  )
}

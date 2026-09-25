'use client'

import { ErrorState } from '@/components/error-state'
import { Canvas, Surface, SurfaceStack } from '@/components/surface'
import { messages } from '@/lib/messages'

/**
 * 작업 진행 세그먼트의 예상 못 한 예외.
 *
 * **작업 조회 실패는 여기로 오지 않는다** — `AiPlanJobView` 가 404(`AIPLAN_002`)와
 * 그 외를 직접 가른다 (명세 S7). 작업 실패(`status=FAILED`)는 HTTP 200 이라 애초에
 * 예외가 아니다.
 *
 * **3층 표면이고 카드다** (`DESIGN.md §0`, #475). 본 화면이 L0 회색 바닥인데 예외만 흰
 * 페이지로 남으면, 예외가 뜨는 순간 배경이 통째로 뒤집힌다 — `loading.tsx` 넷이
 * "실화면과 같은 층으로 그린다" 로 이미 답한 것과 같은 문제다.
 *
 * **카드 판정은 그 세그먼트의 정상 화면을 따른다** — 정상 화면이 상태를 카드에 담으면
 * 라우트 경계도 담고, 담지 않으면 경계도 담지 않는다. 여기서는
 * `AiPlanJobShell`(`ai-plan-job-view.tsx`)이 **여섯 갈래(404 · 조회 오류 · 대기 · 작업
 * 실패 · 취소 · 빈 초안)를 전부** 같은 `<Surface aria-label={messages.aiPlan.jobTitle}>`
 * 하나에 담는다 — "이 작업이 어떻게 되고 있는가" 를 한 화자가 이어 말하는 자리다.
 * 그래서 이름표도 `title` 이 아니라 **같은 `aria-label`** 이다: 보이는 제목은 머리의
 * `h1` 이 이미 그렸다.
 *
 * **판정 3문의 ③("담는 항목이 둘 이상인가")을 "지금 담긴 자식 수" 로 읽지 않는다.**
 * 그렇게 읽으면 정상 화면의 카드들도 전부 카드가 아니어야 한다 — ③ 은 그 면이 **화면의
 * 답을 담는 역할인가**를 묻는다.
 *
 * 상태 컴포넌트는 카드 안이므로 인셋이 `card`(16/20) 그대로다.
 *
 * 폭은 이 세그먼트의 정상 화면과 같은 `max-w-screen-md` 다 (`AiPlanJobShell` 의 스택).
 *
 * **`h1` 은 화면의 이름이다.** 두지 않으면 문서의 최상위 제목이 상태의 `h2` 가 된다
 * (#451 · #473 이 같은 이유로 `h1` 을 세웠다). 보이는 제목은 상태가 이미 그리므로
 * `sr-only` 다 — `loading.tsx` 넷과 같은 방식이다.
 */
export default function AiPlanJobError({ retry }: { error: Error; retry: () => void }) {
  return (
    <Canvas as="main" id="main-content">
      <SurfaceStack className="mx-auto w-full max-w-screen-md">
        <h1 className="sr-only">{messages.aiPlan.jobTitle}</h1>

        <Surface aria-label={messages.aiPlan.jobTitle}>
          <ErrorState
            title={messages.aiPlan.jobErrorTitle}
            description={messages.common.temporaryErrorDescription}
            inset="card"
            onRetry={retry}
          />
        </Surface>
      </SurfaceStack>
    </Canvas>
  )
}

import type { Metadata } from 'next'

import { AiPlanCreateView } from '@/features/ai-plan/ai-plan-create-view'
import { messages } from '@/lib/messages'

export const metadata: Metadata = {
  title: messages.aiPlan.createTitle,
  description: messages.aiPlan.createDescription,
}

/**
 * AI 일정 조건 입력 — `/ai-plans/new`.
 *
 * **서버 프리페치를 하지 않는다.** 이 화면의 초기 데이터는 반려견 목록뿐이고 폼 상태가
 * 화면의 본체다 (architecture-guide.md §9 결정 트리). 보호 경로는 루트 `proxy.ts` 의
 * `PROTECTED_PATHS` 가 `'/ai-plans'` 로 이미 덮는다.
 *
 * 한 컬럼이다. 아트보드 04 는 좌측에 조건을 남긴 2단이지만 그것은 **결과를 보면서 조건을
 * 고치는 화면**이라 미리보기가 함께 있을 때만 성립한다 — 여기서는 조건만 있다.
 */
export default async function AiPlanNewPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>
}) {
  /*
    `?from={jobId}` — 실패 화면의 `조건 바꾸기` 가 조건을 되살리기 위해 붙인다.
    **조건 자체를 URL 에 담지 않는다** (명세 S8 미결 2) — `jobId` 만 넘기고 값은
    `sessionStorage` 에서 읽는다.
  */
  const { from } = await searchParams

  return (
    <div className="mx-auto w-full max-w-screen-md px-4 py-6 md:px-10 md:py-8">
      <h1 className="text-title-1 text-fg lg:text-display mb-6 font-bold lg:font-extrabold">
        {messages.aiPlan.createTitle}
      </h1>
      <AiPlanCreateView fromJobId={from ?? null} />
    </div>
  )
}

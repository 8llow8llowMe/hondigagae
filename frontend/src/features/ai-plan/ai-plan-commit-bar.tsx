import { Button } from '@/components/button'
import { AI_PLAN_COMMIT_FORM_ID } from '@/features/ai-plan/ai-plan-commit-panel'
import { messages } from '@/lib/messages'

/**
 * 모바일(768 미만) 결과 화면의 **하단 고정 `내 일정에 담기`** — 이슈 #1381.
 *
 * dev 에서 담기 버튼이 항목 목록 맨 아래에 있어, 결과를 다 내려 읽기 전에는 다음 행동이 보이지
 * 않았다(`ux-review-2026-10-11.md` §3-3). 장소 상세 하단 바(`PlaceDetailActionBar`)와 같은
 * sticky 바다 — 자리를 스스로 차지해 마지막 줄을 가리지 않는다.
 *
 * - **버튼만 올린다.** 제목 입력까지 고정하면 탭바와 합쳐 화면의 20% 넘게를 덮는다. 제목은 기본값이
 *   있고(초안 제목), 검증이 실패하면 폼이 그 칸으로 포커스를 옮긴다(`useForm`).
 * - **같은 폼을 제출한다** — `form` 속성으로 `AiPlanCommitPanel` 의 폼을 가리켜, 검증 · 오류 · 진행
 *   표시가 한 벌이다. 패널의 버튼은 768 미만에서 숨는다.
 * - **탭바 위에 붙는다**(`.bottom-tabbar`) — 이 화면은 탭바를 감추지 않는다(`hidesTabBar`).
 * - 바닥 띠라 불투명 배경 · 위 테두리를 갖는다(장소 상세 하단 바와 같다).
 */
export function AiPlanCommitBar({ submitting }: { submitting: boolean }) {
  return (
    <div className="bg-bg border-border bottom-tabbar sticky z-30 border-t px-4 py-3 md:hidden">
      <Button
        type="submit"
        form={AI_PLAN_COMMIT_FORM_ID}
        size="lg"
        loading={submitting}
        className="w-full"
      >
        {messages.aiPlan.commitSubmit}
      </Button>
    </div>
  )
}

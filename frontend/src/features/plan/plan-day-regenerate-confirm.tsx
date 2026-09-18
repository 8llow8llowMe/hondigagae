import { Button } from '@/components/button'
import { FormAlert } from '@/components/form-alert'
import { messages } from '@/lib/messages'
import type { PlanDaySaveError } from '@/lib/plan/save-error'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

/**
 * 재생성 확정 블록 (#128 · 하루재생성-세부명세 R5).
 *
 * **경고가 버튼보다 먼저 온다.** 교체는 되돌릴 수 없고 계약에 일자 이력이 없어 undo 를
 * 만들 수 없다 — 확정 전에 사실을 말하는 것이 유일한 방어다.
 *
 * **훅이 없다.** 뷰는 작업 구독 때문에 클라이언트 훅이 붙어 node 환경 테스트로 렌더할
 * 수 없다. 눈으로만 확인해야 하는 경고를 그 안에 두면 검증에서 빠진다.
 */
export function PlanDayRegenerateConfirm({
  onApply,
  applying,
  error,
  hasStartTime,
}: {
  onApply: () => void
  applying: boolean
  /** 되붙이기 실패. `toPlanDaySaveError` 가 분류한 그대로다 */
  error: PlanDaySaveError | null
  /**
   * 이 날에 시각이 있는 항목이 **지금** 있는가 (#623 · 명세 D14-6).
   *
   * 재생성 초안(`AiPlanScheduleItem`)에는 시각 필드가 아예 없어(G5) 되붙이면 그 날
   * 시각이 전부 사라진다. **잃을 것이 없는 날에는 경고를 내지 않는다** — 늘 뜨는
   * 경고는 배경음이 되어 정작 잃을 날에 읽히지 않는다 (D9-2 와 같은 판단).
   */
  hasStartTime: boolean
}) {
  return (
    /*
      **액션이라 카드가 아니다** (`DESIGN.md §0`, #451) — 비교 카드 아래, L0 바닥 위에 선다
      (#443 · #447 의 "액션 바는 카드가 아니다" 와 같은 판단).

      **위 구분선을 걷었다.** 3a 에서는 카드 사이 틈으로 비치는 L0 이 그 일을 한다 —
      선을 남기면 비교 카드의 테두리와 나란히 두 줄로 읽힌다. 세로 여백도 스택의 간격
      (모바일 8 / 데스크톱 24)이 주므로 아래만 남긴다 (`PlanStatusAction` 과 같은 값).

      인셋은 카드 안 글줄과 같은 축이다 — 버튼이 위 카드의 첫 글자와 세로선을 맞춘다.
    */
    <div className={cn('flex flex-col items-start gap-2 pb-4 md:pb-0', INSET_CLASS.card)}>
      <p className="text-body-2 text-fg font-semibold">{messages.plan.regenerateDayIrreversible}</p>
      <p className="text-caption text-fg-muted font-medium">
        {messages.plan.regenerateDayVisitReset}
      </p>
      {hasStartTime && (
        <p className="text-caption text-fg-muted font-medium">
          {messages.plan.regenerateDayStartTimeReset}
        </p>
      )}

      {/*
        `text-danger` 는 이 저장소의 토큰이 아니다 (DESIGN.md §2-6 은 `--danger-100/500/700/900`
        만 정의한다). `PlanDaySaveError.message` 를 그리는 다른 화면(plan-day-editor.tsx ·
        plan-add-place-row.tsx · plan-indoor-alts.tsx)이 모두 `FormAlert` 를 쓰므로 그대로
        재사용한다 — 새 오류 표시를 만들지 않는다.
      */}
      {error !== null && <FormAlert className="w-full" message={error.message} />}

      <Button className="mt-2" onClick={onApply} loading={applying}>
        {messages.plan.regenerateDayApply}
      </Button>
    </div>
  )
}

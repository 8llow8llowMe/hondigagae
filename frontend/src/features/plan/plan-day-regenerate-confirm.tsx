import { Button } from '@/components/button'
import { FormAlert } from '@/components/form-alert'
import { messages } from '@/lib/messages'
import type { PlanDaySaveError } from '@/lib/plan/save-error'

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
}: {
  onApply: () => void
  applying: boolean
  /** 되붙이기 실패. `toPlanDaySaveError` 가 분류한 그대로다 */
  error: PlanDaySaveError | null
}) {
  return (
    <div className="border-border mt-6 flex flex-col items-start gap-2 border-t pt-4">
      <p className="text-body-2 text-fg font-semibold">{messages.plan.regenerateDayIrreversible}</p>
      <p className="text-caption text-fg-muted font-medium">
        {messages.plan.regenerateDayVisitReset}
      </p>

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

'use client'

import { Badge } from '@/components/badge'
import { Button } from '@/components/button'
import { Modal } from '@/components/modal'
import { messages } from '@/lib/messages'
import type { PlanConfirmCheckDay, PlanConfirmIssue } from '@/lib/plan/confirm-check'

export type PlanConfirmCheckModalProps = {
  open: boolean
  /** `planConfirmCheck()` 결과 — 비어 있으면 호출부가 시트를 열지 않는다 */
  days: readonly PlanConfirmCheckDay[]
  onClose: () => void
  /** 시트를 닫고 그 일자로 간다 — 이동은 닫힌 뒤 호출부가 한다 (명세 D26-2) */
  onFix: (day: number) => void
  /** 시트를 닫고 확정한다 */
  onProceed: () => void
}

/**
 * 확정 전 점검 시트 — 이슈 #1425 · 명세 D26-2.
 *
 * **`role="dialog"` 다 — `alertdialog` 가 아니다.** 확정은 되돌릴 수 있어 확인 대화상자를
 * 붙이지 않는다(D11-2 · #565). 이 시트는 확인이 아니라 **고칠 것이 있다는 사실**을 말하고,
 * 문제가 없으면 서지 않는다.
 *
 * **`BottomSheet` 가 아니다.** 그 컴포넌트는 모바일 전용 패턴이라 데스크톱에서 레일 · 팝오버로
 * 대체해야 한다 — 확정 버튼은 모든 폭에서 같은 자리다.
 *
 * **일자로 묶는다.** `고치러 가기` 가 가는 곳이 일자라, 항목마다 버튼을 두면 같은 곳으로 가는
 * 버튼이 줄지어 선다.
 *
 * **`그대로 확정` 이 주요 버튼이 아니다(`secondary`).** 이 시트가 서는 것은 고칠 것이 있을
 * 때뿐이라 무시하고 넘어가는 쪽에 가장 강한 색면을 주지 않는다.
 */
export function PlanConfirmCheckModal({
  open,
  days,
  onClose,
  onFix,
  onProceed,
}: PlanConfirmCheckModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={messages.plan.confirmCheckTitle}
      description={messages.plan.confirmCheckDescription}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {messages.plan.confirmCheckClose}
          </Button>
          <Button variant="secondary" onClick={onProceed}>
            {messages.plan.confirmCheckProceed}
          </Button>
        </>
      }
    >
      <ul className="flex flex-col gap-4">
        {days.map((entry) => {
          const dayLabel = messages.plan.dayLabel.replace('{day}', String(entry.day))
          return (
            <li key={entry.day} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-body-1 text-fg font-semibold">{dayLabel}</h3>
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label={messages.plan.confirmCheckFixLabel.replace(
                    '{day}',
                    String(entry.day),
                  )}
                  onClick={() => onFix(entry.day)}
                >
                  {messages.plan.confirmCheckFix}
                </Button>
              </div>
              <ul className="flex flex-col gap-2">
                {entry.issues.map((issue) => (
                  <li
                    key={issue.kind === 'no-meal' ? 'no-meal' : `${issue.kind}-${issue.planItemId}`}
                    className="text-body-2 text-fg flex flex-wrap items-center gap-x-2 gap-y-1"
                  >
                    <PlanConfirmIssueLine issue={issue} />
                  </li>
                ))}
              </ul>
            </li>
          )
        })}
      </ul>
    </Modal>
  )
}

/**
 * 문제 한 줄. 시각 사유는 일정 상세 경고 칩과 **같은 낱말 · 같은 톤**이다(D25-4) — 시트에서 읽은
 * 것을 일자 카드에서 그대로 찾는다. 빈 시각 · 식사는 입력 어긋남이 아니라 빠진 것이라 `neutral` 이다.
 */
function PlanConfirmIssueLine({ issue }: { issue: PlanConfirmIssue }) {
  if (issue.kind === 'no-meal') {
    return <span className="text-fg-muted">{messages.plan.confirmCheckNoMeal}</span>
  }

  return (
    <>
      {/* 한국어 장소명은 길다 — 375 에서 넘치지 않게 낱말 단위로 접고, 한 낱말이 넘치면 끊는다 */}
      <span className="min-w-0 break-words break-keep">
        {issue.kind !== 'no-time' && (
          <span className="mr-1 font-medium tabular-nums">{issue.time}</span>
        )}
        {issue.title}
      </span>
      {issue.kind === 'no-time' ? (
        <Badge tone="neutral" size="sm">
          {messages.plan.confirmCheckNoTime}
        </Badge>
      ) : (
        <Badge tone="danger" size="sm">
          {issue.kind === 'backward'
            ? messages.plan.itemTimeBackward
            : messages.plan.itemTimeOverlap}
        </Badge>
      )}
    </>
  )
}

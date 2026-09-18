import { Button, ButtonLink } from '@/components/button'
import { DateField } from '@/components/date-field'
import { Field } from '@/components/field'
import { FormAlert } from '@/components/form-alert'
import { Modal } from '@/components/modal'
import { messages } from '@/lib/messages'
import type { PlanCopyError } from '@/lib/plan/copy-error'

/**
 * 일정 복사 모달의 **props 전용 부분** (`일정복사-세부명세.md` D1 · D5 · D7).
 *
 * `PlanCopyModal`(`plan-copy-modal.tsx`)이 `useRouter`·`useQueryClient` 를 쓰므로
 * 정적 렌더가 안 된다 — 그 훅들이 필요 없는 레이아웃·문구·실패 분기만 여기로 갈랐다
 * (`testing-guide.md` §1 의 "분리가 테스트 가능성의 핵심", `plan-day-regenerate-confirm.tsx`
 * 와 같은 판단).
 */
export type PlanCopyViewProps = {
  open: boolean
  onClose: () => void
  /** 달력의 오늘(`YYYY-MM-DD`). 서버가 내려준 값 그대로 받는다 */
  today: string
  /** 원본 일수. `copyPeriodHint` 의 `{days}` 를 채운다 */
  totalDays: number
  startDate: string
  endDate: string
  onStartDateChange: (value: string) => void
  onEndDateChange: (value: string) => void
  /** 종료일 달력의 열림 상태 — 시작일을 고르면 이어서 연다 (D4-3) */
  endDateOpen: boolean
  onEndDateOpenChange: (open: boolean) => void
  /** `validatePlanCopy()` 가 준 필드별 오류 */
  fieldErrors: { startDate?: string; endDate?: string }
  /** 제출 실패. `toPlanCopyError()` 가 분류한 그대로다. 없으면 `null` */
  formError: PlanCopyError | null
  saving: boolean
  onSubmit: () => void
}

/**
 * `PlanEditModal` 과 **같은 골격**이다 (D1) — 같은 관리 메뉴에서 열리는 같은 성격의
 * 폼이 서로 다른 모양이면 사용자가 두 화면을 다른 기능으로 읽는다.
 *
 * **`title` 입력이 없다** (D0-1 · D8 #2). 서버가 원본 제목 뒤에 ` (복사)` 를 붙인다 —
 * `copyTitleHint` 가 그 사실을 미리 말한다.
 */
export function PlanCopyView({
  open,
  onClose,
  today,
  totalDays,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  endDateOpen,
  onEndDateOpenChange,
  fieldErrors,
  formError,
  saving,
  onSubmit,
}: PlanCopyViewProps) {
  /*
    **404(`PLAN_001`, 원본 사라짐)만 제출을 잠근다.** 같은 원본으로 다시 눌러도 같은
    404 다 — 재시도가 아니라 `목록으로` 가 유일한 다음 행동이다 (D5).
  */
  const submitDisabled = formError?.next === 'list'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={messages.plan.copyTitle}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {messages.plan.copyCancel}
          </Button>
          <Button onClick={onSubmit} loading={saving} disabled={submitDisabled}>
            {messages.plan.copySubmit}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-body-2 text-fg-muted">{messages.plan.copyDescription}</p>

        {/*
          두 날짜를 한 줄에 — `PlanEditModal` 과 같은 배치(`flex-col sm:flex-row`)다.
          **시작일에 `min={today}` 를 걸지 않는다** — 지난 일정을 복사하는 화면이라
          시작일도 과거일 수 있다(수정 모달과 같은 근거).
        */}
        <div className="flex flex-col gap-4 sm:flex-row">
          <Field
            id="plan-copy-start-date"
            label={messages.plan.fieldStartDate}
            required
            className="flex-1"
            {...(fieldErrors.startDate === undefined ? {} : { error: fieldErrors.startDate })}
          >
            <DateField
              id="plan-copy-start-date"
              label={messages.plan.fieldStartDate}
              placeholder={messages.plan.datePlaceholder}
              today={today}
              value={startDate}
              onValueChange={onStartDateChange}
              invalid={fieldErrors.startDate !== undefined}
              rangeStart={startDate}
              rangeEnd={endDate}
            />
          </Field>

          <Field
            id="plan-copy-end-date"
            label={messages.plan.fieldEndDate}
            required
            className="flex-1"
            {...(fieldErrors.endDate === undefined ? {} : { error: fieldErrors.endDate })}
          >
            <DateField
              id="plan-copy-end-date"
              label={messages.plan.fieldEndDate}
              placeholder={messages.plan.datePlaceholder}
              today={today}
              value={endDate}
              onValueChange={onEndDateChange}
              open={endDateOpen}
              onOpenChange={onEndDateOpenChange}
              invalid={fieldErrors.endDate !== undefined}
              min={startDate === '' ? null : startDate}
              rangeStart={startDate}
              rangeEnd={endDate}
            />
          </Field>
        </div>

        {/* 힌트 세 줄 — 기간 · 승계 · 제목. 필드 아래 한 번씩만 둔다 (D6) */}
        <p className="text-caption text-fg-muted -mt-2">
          {messages.plan.copyPeriodHint.replace('{days}', String(totalDays))}
        </p>
        <p className="text-caption text-fg-muted -mt-2">{messages.plan.copyCarryHint}</p>
        <p className="text-caption text-fg-muted -mt-2">{messages.plan.copyTitleHint}</p>

        <FormAlert message={formError?.message ?? null} />

        {/*
          **`next` 가 목적지를 정한다** (`copy-error.ts`). 링크가 없는 실패(`'none'`)는
          같은 버튼으로 다시 제출하거나 입력을 고치면 되므로 아무것도 더 붙이지 않는다.
        */}
        {formError !== null && formError.next !== 'none' && (
          <ButtonLink
            href={formError.next === 'pets' ? '/pets' : '/plans'}
            variant="secondary"
            size="sm"
            className="self-start"
          >
            {formError.next === 'pets'
              ? messages.plan.copyPetAction
              : messages.plan.copyMissingPlanAction}
          </ButtonLink>
        )}
      </div>
    </Modal>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'

import { useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/button'
import { DateField } from '@/components/date-field'
import { Field } from '@/components/field'
import { FormAlert } from '@/components/form-alert'
import { Input } from '@/components/input'
import { Modal } from '@/components/modal'
import { planKeys } from '@/features/plan/queries'
import { updatePlan } from '@/lib/api/plan'
import { apiErrorToFormErrors, NO_FORM_ERRORS } from '@/lib/form/field-errors'
import { messages } from '@/lib/messages'
import { toPlanUpdatePayload, validatePlanEdit } from '@/lib/plan/edit'
import type { PlanDetail } from '@/types/plan'

/**
 * 이름 · 기간 · 예산 수정 — 아트보드 01·02 의 더보기 메뉴.
 *
 * **입력이 있는 다이얼로그라 `ConfirmModal` 이 아니라 `Modal` 을 쓴다** (#79 에서 추출).
 * `role` 기본값이 `dialog` 다 — `alertdialog` 는 되돌릴 수 없는 확인 전용이다.
 *
 * **기간을 여기서 바꾼다** (#585). 예전에는 닫아 뒀는데, 그 근거였던 고아 항목은 서버가
 * `PLAN_008` 로 거부하면서 사라졌다 (`types/plan.ts` 의 `PlanUpdatePayload` 주석).
 * 그 대신 저장이 **거부될 수 있는 폼**이 됐으므로, 막힐 수 있다는 것을 힌트로 미리 말하고
 * 실제 거부는 서버 문구를 폼 배너로 그대로 띄운다 — 어느 일차에 항목이 있는지 화면이
 * 다시 세어 판정을 복제하지 않는다.
 */
export function PlanEditModal({
  plan,
  today,
  open,
  onClose,
}: {
  plan: PlanDetail
  /**
   * 달력의 오늘 (`YYYY-MM-DD`). **서버가 정한 오늘을 받는다** — 클라이언트 컴포넌트가
   * `new Date()` 를 부르면 자정을 걸쳐 SSR 과 갈린다 (`lib/date/day.ts` `dayToLocalNoon`).
   */
  today: string
  open: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState(plan.title)
  const [startDate, setStartDate] = useState(plan.startDate)
  const [endDate, setEndDate] = useState(plan.endDate)
  const [budget, setBudget] = useState(plan.budget === null ? '' : String(plan.budget))
  const [errors, setErrors] = useState(NO_FORM_ERRORS)
  const [saving, setSaving] = useState(false)
  /*
    종료일 달력의 열림 상태. **시작일을 고른 순간 종료일이 비면 이어서 연다** — 만들기
    폼과 같은 흐름이다 (`plan-create-form.tsx`). 다만 이 폼은 두 날짜가 **이미 채워진 채로
    열리므로** 실제로 이어 열리는 경우는 시작일이 종료일을 넘겨 종료일을 비웠을 때뿐이다.
  */
  const [endDateOpen, setEndDateOpen] = useState(false)
  // disabled 반영 전 빠른 연속 제출을 막는다 (form-guide.md §6)
  const savingRef = useRef(false)

  // 열 때마다 서버 값으로 되돌린다 — 이전에 취소한 입력이 남아 있으면 안 된다
  useEffect(() => {
    if (!open) return
    setTitle(plan.title)
    setStartDate(plan.startDate)
    setEndDate(plan.endDate)
    setBudget(plan.budget === null ? '' : String(plan.budget))
    setErrors(NO_FORM_ERRORS)
    setEndDateOpen(false)
  }, [open, plan.title, plan.startDate, plan.endDate, plan.budget])

  function handleSubmit() {
    if (savingRef.current) return

    const validation = validatePlanEdit({ title, startDate, endDate, budget })
    if (Object.keys(validation).length > 0) {
      setErrors({ fields: validation, form: null })
      return
    }

    savingRef.current = true
    setSaving(true)
    setErrors(NO_FORM_ERRORS)

    void updatePlan(plan.planId, toPlanUpdatePayload({ title, startDate, endDate, budget }))
      .then((next) => {
        queryClient.setQueryData(planKeys.detail(plan.planId), next)
        void queryClient.invalidateQueries({ queryKey: planKeys.list() })
        /*
          **일자별 판정을 함께 버린다** (#585). 기간이 바뀌면 일차 수와 날짜가 통째로
          달라지는데 `planKeys.weather` 캐시는 옛 기간으로 만든 것이다 — 남겨 두면 새
          기간의 화면에 옛 일자 브리핑이 붙는다. 제목·예산만 고쳤을 때도 같이 버리지만,
          그 비용은 조회 한 번이고 반대(틀린 판정을 보여 주는 것)보다 싸다.
        */
        void queryClient.invalidateQueries({ queryKey: planKeys.weather(plan.planId) })
        onClose()
      })
      .catch((error: unknown) => {
        /*
          `PLAN_008`(줄어든 기간 밖에 항목이 남아 있습니다)은 **검증이 아니라 도메인
          예외**라 `fieldErrors` 가 없다 — `apiErrorToFormErrors` 가 폼 배너로 올린다.
          서버 문구가 이미 "해당 일차의 항목을 먼저 정리해 주세요" 까지 말하므로 FE 가
          자기 말투로 옮기지 않는다.
        */
        setErrors(apiErrorToFormErrors(error, messages.plan.editError))
      })
      .finally(() => {
        savingRef.current = false
        setSaving(false)
      })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={messages.plan.editTitle}
      // 입력 폼은 md. 필드가 좁으면 오히려 읽기 어렵다
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {messages.plan.editCancel}
          </Button>
          <Button onClick={handleSubmit} loading={saving}>
            {messages.plan.editSubmit}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field
          id="plan-edit-title"
          label={messages.plan.fieldTitle}
          required
          {...(errors.fields.title === undefined ? {} : { error: errors.fields.title })}
        >
          <Input
            id="plan-edit-title"
            value={title}
            onValueChange={setTitle}
            invalid={errors.fields.title !== undefined}
            maxLength={60}
          />
        </Field>

        {/*
          두 날짜는 한 줄에 나란히 — 기간은 하나의 값이라 세로로 떨어뜨리면 관계가 흐려진다.
          만들기 폼과 같은 배치·같은 `rangeStart`/`rangeEnd` 전달이다.

          **시작일에 `max` 를 걸지 않는다.** 걸면 기간을 통째로 뒤로 옮기려는 사람이 종료일
          부터 고쳐야 하고, 그 순서를 화면이 알려 줄 방법이 없다 (`plan-create-form.tsx`).

          **`min={today}` 도 걸지 않는다.** 만들기와 달리 이미 시작한 일정·지난 일정을
          고치는 경우가 있고, 서버도 수정에는 "오늘 이후" 제약을 두지 않는다
          (`PlanUpdateRequest` — 그 제약은 AI 생성의 `AIPLAN_017` 뿐이다).
        */}
        <div className="flex flex-col gap-4 sm:flex-row">
          <Field
            id="plan-edit-start-date"
            label={messages.plan.fieldStartDate}
            required
            className="flex-1"
            {...(errors.fields.startDate === undefined ? {} : { error: errors.fields.startDate })}
          >
            <DateField
              id="plan-edit-start-date"
              label={messages.plan.fieldStartDate}
              placeholder={messages.plan.datePlaceholder}
              today={today}
              value={startDate}
              onValueChange={(next) => {
                setStartDate(next)
                // 어긋난 순간 종료일만 비워 다시 받는다 — 만들기 폼과 같은 처리다
                if (endDate !== '' && next > endDate) {
                  setEndDate('')
                  setEndDateOpen(true)
                }
              }}
              invalid={errors.fields.startDate !== undefined}
              rangeStart={startDate}
              rangeEnd={endDate}
            />
          </Field>

          <Field
            id="plan-edit-end-date"
            label={messages.plan.fieldEndDate}
            required
            className="flex-1"
            {...(errors.fields.endDate === undefined ? {} : { error: errors.fields.endDate })}
          >
            <DateField
              id="plan-edit-end-date"
              label={messages.plan.fieldEndDate}
              placeholder={messages.plan.datePlaceholder}
              today={today}
              value={endDate}
              onValueChange={setEndDate}
              open={endDateOpen}
              onOpenChange={setEndDateOpen}
              invalid={errors.fields.endDate !== undefined}
              // 시작일보다 이른 날짜는 달력에서 아예 고를 수 없다. 검증은 2차 방어다
              min={startDate === '' ? null : startDate}
              rangeStart={startDate}
              rangeEnd={endDate}
            />
          </Field>
        </div>

        {/*
          힌트를 **기간 줄 아래 한 번만** 둔다. 두 필드 각각에 붙이면 같은 말이 두 번 서고,
          이 문구가 말하는 것은 한쪽 날짜가 아니라 기간이라는 하나의 값이다.
        */}
        <p className="text-caption text-fg-muted -mt-2">{messages.plan.editPeriodHint}</p>

        <Field
          id="plan-edit-budget"
          label={messages.plan.fieldBudget}
          // 예산을 비우는 방법이 서버에 없다 — 0 으로 저장된다는 것을 미리 말한다 (D4)
          hint={messages.plan.editBudgetHint}
          {...(errors.fields.budget === undefined ? {} : { error: errors.fields.budget })}
        >
          <Input
            id="plan-edit-budget"
            value={budget}
            onValueChange={setBudget}
            invalid={errors.fields.budget !== undefined}
            inputMode="numeric"
          />
        </Field>

        <FormAlert message={errors.form} />
      </div>
    </Modal>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'

import { useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/button'
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
 * 이름 · 예산 수정 — 아트보드 01·02 의 더보기 메뉴.
 *
 * **입력이 있는 다이얼로그라 `ConfirmModal` 이 아니라 `Modal` 을 쓴다** (#79 에서 추출).
 * `role` 기본값이 `dialog` 다 — `alertdialog` 는 되돌릴 수 없는 확인 전용이다.
 *
 * **기간은 여기서 바꾸지 않는다.** 서버가 기간을 줄여도 범위 밖 항목을 정리하지 않아
 * 고아 항목이 생긴다 — 프론트가 그 경로를 열지 않는다 (D4).
 */
export function PlanEditModal({
  plan,
  open,
  onClose,
}: {
  plan: PlanDetail
  open: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState(plan.title)
  const [budget, setBudget] = useState(plan.budget === null ? '' : String(plan.budget))
  const [errors, setErrors] = useState(NO_FORM_ERRORS)
  const [saving, setSaving] = useState(false)
  // disabled 반영 전 빠른 연속 제출을 막는다 (form-guide.md §6)
  const savingRef = useRef(false)

  // 열 때마다 서버 값으로 되돌린다 — 이전에 취소한 입력이 남아 있으면 안 된다
  useEffect(() => {
    if (!open) return
    setTitle(plan.title)
    setBudget(plan.budget === null ? '' : String(plan.budget))
    setErrors(NO_FORM_ERRORS)
  }, [open, plan.title, plan.budget])

  function handleSubmit() {
    if (savingRef.current) return

    const validation = validatePlanEdit({ title, budget })
    if (Object.keys(validation).length > 0) {
      setErrors({ fields: validation, form: null })
      return
    }

    savingRef.current = true
    setSaving(true)
    setErrors(NO_FORM_ERRORS)

    void updatePlan(plan.planId, toPlanUpdatePayload({ title, budget }))
      .then((next) => {
        queryClient.setQueryData(planKeys.detail(plan.planId), next)
        void queryClient.invalidateQueries({ queryKey: planKeys.list() })
        onClose()
      })
      .catch((error: unknown) => {
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

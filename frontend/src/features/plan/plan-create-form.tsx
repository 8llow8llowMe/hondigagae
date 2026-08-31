'use client'

import { useEffect, useRef } from 'react'

import { Button } from '@/components/button'
import { Field } from '@/components/field'
import { FormAlert } from '@/components/form-alert'
import { Input } from '@/components/input'
import { RadioGroup } from '@/components/radio-group'
import type { FormErrors } from '@/lib/form/field-errors'
import { messages } from '@/lib/messages'
import { describePet } from '@/lib/pet/describe'
import type { Pet } from '@/types/pet'
import type { PlanFormValues } from '@/types/plan'

export type PlanCreateFormProps = {
  values: PlanFormValues
  errors: FormErrors
  pets: Pet[]
  submitting: boolean
  /** 제출이 실패로 끝난 횟수. 포커스 이동의 **유일한 안정적인 트리거**다 */
  submitCount: number
  firstErrorField: string | null
  onValueChange: <K extends keyof PlanFormValues>(key: K, value: PlanFormValues[K]) => void
  onSubmit: () => void
  /**
   * 제출 버튼 라벨. **하는 일이 다르면 라벨도 달라야 한다** — 담기 시트 안에서는 만들기가
   * 끝이 아니라 그 자리에서 장소까지 담으므로 `일정 만들고 담기` 다 (#118, 아트보드 02-B).
   * 생략하면 직접 만들기 화면의 기본 라벨을 쓴다.
   */
  submitLabel?: string
}

/**
 * 직접 만들기 폼 — 공통명세 S9.
 *
 * 표시 전용이라 node 환경에서 렌더 테스트가 된다 (`testing-guide.md` §1).
 *
 * **`areaCode` 필드가 없다.** 제주 전용 서비스라 선택지가 하나뿐이고, 선택지가 하나인
 * 필드를 폼에 두면 사용자가 고를 것이 있다고 착각한다.
 */
export function PlanCreateForm({
  values,
  errors,
  pets,
  submitting,
  submitCount,
  firstErrorField,
  onValueChange,
  onSubmit,
  submitLabel = messages.plan.createSubmit,
}: PlanCreateFormProps) {
  const formRef = useRef<HTMLFormElement>(null)

  /*
    제출 실패 시 첫 오류 필드로 포커스를 옮긴다. `errors` 를 의존성으로 쓰면 입력 중인
    필드에서 포커스를 훔친다 (`use-form.ts` 의 `submitCount` JSDoc).

    **`id` 만으로는 라디오 그룹을 못 찾는다.** `RadioGroup` 은 `<fieldset>` 을 렌더하고
    개별 라디오에 `${id}-${value}` 를 붙이므로 `#petId` 에 해당하는 요소가 없다.
    `[name]` 을 함께 본다 — 라디오는 그룹 이름이 필드명이다.
  */
  useEffect(() => {
    if (submitCount === 0 || firstErrorField === null) return
    const target = formRef.current?.querySelector<HTMLElement>(
      `[id="${firstErrorField}"], [name="${firstErrorField}"]`,
    )
    target?.focus()
  }, [submitCount, firstErrorField])

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
      className="flex flex-col gap-5"
    >
      <FormAlert message={errors.form} />

      <RadioGroup
        id="petId"
        label={messages.plan.fieldPet}
        required
        options={pets.map((pet) => ({
          value: pet.petId,
          label: pet.name,
          description: describePet(pet),
        }))}
        value={values.petId}
        onValueChange={(petId) => onValueChange('petId', petId)}
        error={errors.fields.petId}
      />

      <Field id="title" label={messages.plan.fieldTitle} required error={errors.fields.title}>
        <Input
          id="title"
          value={values.title}
          onValueChange={(title) => onValueChange('title', title)}
          invalid={errors.fields.title !== undefined}
          placeholder={messages.plan.fieldTitlePlaceholder}
          maxLength={60}
        />
      </Field>

      {/* 두 날짜는 한 줄에 나란히 — 기간은 하나의 값이라 세로로 떨어뜨리면 관계가 흐려진다 */}
      <div className="flex flex-col gap-5 sm:flex-row sm:gap-4">
        <Field
          id="startDate"
          label={messages.plan.fieldStartDate}
          required
          error={errors.fields.startDate}
          className="flex-1"
        >
          <Input
            id="startDate"
            type="date"
            value={values.startDate}
            onValueChange={(startDate) => onValueChange('startDate', startDate)}
            invalid={errors.fields.startDate !== undefined}
          />
        </Field>

        <Field
          id="endDate"
          label={messages.plan.fieldEndDate}
          required
          error={errors.fields.endDate}
          className="flex-1"
        >
          <Input
            id="endDate"
            type="date"
            value={values.endDate}
            onValueChange={(endDate) => onValueChange('endDate', endDate)}
            invalid={errors.fields.endDate !== undefined}
            // 시작일보다 이른 날짜를 브라우저가 먼저 막는다. 스키마의 refine 은
            // 직접 타이핑하는 경로를 위한 2차 방어다
            min={values.startDate === '' ? undefined : values.startDate}
          />
        </Field>
      </div>

      <Field
        id="budget"
        label={messages.plan.fieldBudget}
        hint={messages.plan.fieldBudgetHint}
        error={errors.fields.budget}
      >
        <Input
          id="budget"
          // text 다 — number 는 휠 스크롤로 값이 바뀌고 빈 값과 잘못된 값을 구분하지 못한다.
          // 숫자 키패드는 inputMode 가 연다
          inputMode="numeric"
          value={values.budget}
          onValueChange={(budget) => onValueChange('budget', budget)}
          invalid={errors.fields.budget !== undefined}
        />
      </Field>

      <Button type="submit" size="lg" loading={submitting} className="mt-1">
        {submitLabel}
      </Button>
    </form>
  )
}

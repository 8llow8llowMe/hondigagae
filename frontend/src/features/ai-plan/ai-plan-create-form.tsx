'use client'

import { useEffect, useRef } from 'react'

import { Button } from '@/components/button'
import { Chip, ChipGroup } from '@/components/chip'
import { Field } from '@/components/field'
import { FormAlert } from '@/components/form-alert'
import { Input } from '@/components/input'
import { RadioGroup } from '@/components/radio-group'
import { Textarea } from '@/components/textarea'
import { BUDGET_PRESETS_MANWON } from '@/lib/ai-plan/budget'
import type { FormErrors } from '@/lib/form/field-errors'
import { messages } from '@/lib/messages'
import { describePet } from '@/lib/pet/describe'
import type { AiPlanFormValues } from '@/types/ai-plan'
import type { Pet } from '@/types/pet'

export type AiPlanCreateFormProps = {
  values: AiPlanFormValues
  errors: FormErrors
  pets: Pet[]
  /** 기간을 다 고르면 일수를 말해 준다. 못 세면 null */
  totalDays: number | null
  submitting: boolean
  /** 제출이 실패로 끝난 횟수. 포커스 이동의 **유일한 안정적인 트리거**다 */
  submitCount: number
  firstErrorField: string | null
  onValueChange: <K extends keyof AiPlanFormValues>(key: K, value: AiPlanFormValues[K]) => void
  onSubmit: () => void
}

/**
 * AI 일정 조건 입력 폼 — 아트보드 01 · 04 좌측 레일.
 *
 * 표시 전용이라 node 환경에서 렌더 테스트가 된다 (`testing-guide.md` §1).
 *
 * **지역 컨트롤이 없다.** 아트보드에는 제주시 / 서귀포시 / 제주 전체 칩이 있지만
 * `AiPlanCreateRequest` 에 `sigunguCode` 가 없어 좁힐 수 없다 (명세 S2). 선택지가 하나면
 * 컨트롤을 두지 않되, **없는 것이 누락으로 보이지 않게 한 줄로 밝힌다.**
 */
export function AiPlanCreateForm({
  values,
  errors,
  pets,
  totalDays,
  submitting,
  submitCount,
  firstErrorField,
  onValueChange,
  onSubmit,
}: AiPlanCreateFormProps) {
  const formRef = useRef<HTMLFormElement>(null)

  /*
    제출 실패 시 첫 오류 필드로 포커스를 옮긴다. `errors` 를 의존성으로 쓰면 입력 중인
    필드에서 포커스를 훔친다 (`use-form.ts` 의 `submitCount` JSDoc).

    라디오 그룹은 `id` 로 찾을 수 없어 `[name]` 을 함께 본다 (`PlanCreateForm` 과 동일).
  */
  useEffect(() => {
    if (submitCount === 0 || firstErrorField === null) return
    const target = formRef.current?.querySelector<HTMLElement>(
      `[id="${firstErrorField}"], [name="${firstErrorField}"]`,
    )
    target?.focus()
  }, [submitCount, firstErrorField])

  const budgetSelected = values.budgetManwon.trim()

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
      className="flex flex-col gap-6"
    >
      <FormAlert message={errors.form} />

      <div className="flex flex-col gap-1">
        <h2 className="text-title-2 text-fg font-semibold">{messages.aiPlan.createHeading}</h2>
        <p className="text-body-2 text-fg-muted">{messages.aiPlan.createDescription}</p>
      </div>

      {/*
        자유 입력이 **맨 위이고 선택**이다. 필수로 두면 "뭘 써야 하지" 에서 막힌다
        (아트보드 01 주석). 비워도 만들 수 있게 하고 예시를 아래에 둔다.
      */}
      <Field
        id="requestNote"
        label={messages.aiPlan.fieldNote}
        hint={messages.aiPlan.fieldNoteHint}
        error={errors.fields.requestNote}
      >
        <Textarea
          id="requestNote"
          rows={3}
          value={values.requestNote}
          onValueChange={(requestNote) => onValueChange('requestNote', requestNote)}
          invalid={errors.fields.requestNote !== undefined}
          placeholder={messages.aiPlan.fieldNotePlaceholder}
          maxLength={500}
        />
      </Field>

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h3 className="text-body-1 text-fg font-semibold">
            {messages.aiPlan.requiredGroupLabel}
          </h3>
          <p className="text-caption text-fg-muted">{messages.aiPlan.areaFixed}</p>
        </div>

        {/* 두 날짜는 한 줄에 나란히 — 기간은 하나의 값이다 (`PlanCreateForm` 과 동일) */}
        <div className="flex flex-col gap-5 sm:flex-row sm:gap-4">
          <Field
            id="startDate"
            label={messages.aiPlan.fieldStartDate}
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
            label={messages.aiPlan.fieldEndDate}
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

        {totalDays !== null && (
          <p className="text-caption text-fg-muted tabular-nums">
            {messages.aiPlan.periodSummary.replace('{days}', String(totalDays))}
          </p>
        )}

        <RadioGroup
          id="petId"
          label={messages.aiPlan.fieldPet}
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
        <p className="text-caption text-fg-muted -mt-3">{messages.aiPlan.fieldPetHint}</p>

        {/*
          예산은 **칩 + 직접 입력**이다 (아트보드 01 주석: 대부분 어림값을 고른다).
          "상관없음" 은 빈 값이고 `0` 이 아니다 — 계약이 `@Positive` 다 (명세 S1).
        */}
        <div className="flex flex-col gap-2">
          {/*
            **레이아웃 클래스를 여기서 준다.** `ChipGroup` 은 role/aria 배선만 하고
            배치를 사용처에 맡긴다 (`place-filter-chips.tsx` 와 같은 규약).

            **간격만 다르다 — `gap-2.5`(10px) 는 아트보드 값이다.** 필터 칩
            (`place-filter-chips` · `emergency-section`)은 `gap-1.5`(6px)를 쓰는데,
            그쪽은 여러 줄로 빽빽하게 깔리는 필터 줄이고 이쪽은 한 줄짜리 폼 컨트롤이라
            정본이 애초에 다른 값을 준다. **규약이 같다고 값까지 맞추지 않는다** —
            맞추면 아트보드에서 멀어진다 (#96 이 필터 쪽 3곳을 6px 로 통일한 것과
            이 값은 별개다).
          */}
          <ChipGroup
            label={messages.aiPlan.budgetPresetLabel}
            exclusive
            className="flex flex-wrap gap-2.5"
          >
            {BUDGET_PRESETS_MANWON.map((preset) => (
              <Chip
                key={preset}
                exclusive
                selected={budgetSelected === String(preset)}
                onSelect={() => onValueChange('budgetManwon', String(preset))}
              >
                {`${preset}${messages.aiPlan.fieldBudgetUnit}`}
              </Chip>
            ))}
            <Chip
              exclusive
              selected={budgetSelected === ''}
              onSelect={() => onValueChange('budgetManwon', '')}
            >
              {messages.aiPlan.budgetAny}
            </Chip>
          </ChipGroup>

          <Field
            id="budgetManwon"
            label={messages.aiPlan.fieldBudget}
            hint={messages.aiPlan.fieldBudgetHint}
            error={errors.fields.budgetManwon}
          >
            <div className="flex items-center gap-2">
              <Input
                id="budgetManwon"
                // text 다 — number 는 휠 스크롤로 값이 바뀌고 빈 값과 잘못된 값을
                // 구분하지 못한다. 숫자 키패드는 inputMode 가 연다
                inputMode="numeric"
                value={values.budgetManwon}
                onValueChange={(budgetManwon) => onValueChange('budgetManwon', budgetManwon)}
                invalid={errors.fields.budgetManwon !== undefined}
                className="flex-1"
              />
              <span className="text-body-2 text-fg-muted shrink-0">
                {messages.aiPlan.fieldBudgetUnit}
              </span>
            </div>
          </Field>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Button type="submit" size="lg" loading={submitting}>
          {messages.aiPlan.createSubmit}
        </Button>
        {/* 소요 시간과 저장 시점을 미리 말한다 — 기대를 맞춰 두면 대기 화면이 불안하지 않다 */}
        <p className="text-caption text-fg-muted">{messages.aiPlan.createSubmitHint}</p>
      </div>
    </form>
  )
}

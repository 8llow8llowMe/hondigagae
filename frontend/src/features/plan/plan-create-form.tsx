'use client'

import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/button'
import { DateField } from '@/components/date-field'
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
  /** `'YYYY-MM-DD'`. 달력의 오늘 표시에 쓴다 — 어디서 오는지는 사용처 주석 참고 */
  today: string
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
  today,
  onValueChange,
  onSubmit,
  submitLabel = messages.plan.createSubmit,
}: PlanCreateFormProps) {
  const formRef = useRef<HTMLFormElement>(null)

  /*
    종료일 달력의 열림 상태. **시작일을 고른 순간 부모가 연다** (`DateField` 의 `open` 주석).
    그 외에는 `DateField` 가 스스로 여닫는 것과 똑같이 동작한다.
  */
  const [endDateOpen, setEndDateOpen] = useState(false)

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

      {/*
        ── 묻는 순서: 기간 → 반려견 → 제목 → 예산 ─────────────────────────────

        **`/ai-plans/new` 와 같은 순서다** (#400). 두 화면은 같은 일(여행 일정 만들기)을
        하는 두 갈래인데 묻는 순서가 어긋나 있어, 한쪽을 써 본 사람이 다른 쪽에서 다시
        헤맸다 — 예전에는 이 화면이 `반려견 → 제목 → 기간` 이고 저쪽이 `기간 → 반려견` 이라
        **반려견과 기간이 서로 뒤집혀** 있었다.

        **기간이 먼저인 쪽으로 맞췄다.** 근거가 둘이다.
         1. 여행을 계획하는 순서가 "언제 가지" → "누구랑" 이다. 기간이 앵커고 나머지가
            그 위에 얹힌다.
         2. **시작일을 고르면 종료일 달력이 이어서 열린다.** 그 흐름은 기간이 화면 첫
            블록일 때 가장 자연스럽다 — 중간에 있으면 위 필드를 지나쳐 온 뒤에 달력이
            두 번 튀어나온다.

        **`예산` 은 저쪽처럼 접기 안에 넣지 않는다.** 저쪽은 선택 입력이 넷(지역·예산·저장한
        곳·꼭 넣을 곳)이라 접기가 값을 하지만(#354), 이 화면의 선택 입력은 `예산` 하나다 —
        하나를 위해 접기를 두면 여는 동작이 그 하나보다 비싸다. 대신 **필수 뒤 맨 끝**이라는
        자리로 같은 것을 말한다.
      */}

      {/*
        두 날짜는 한 줄에 나란히 — 기간은 하나의 값이라 세로로 떨어뜨리면 관계가 흐려진다.

        **`<input type="date">` 가 아니라 `DateField` 다** (`date-field.tsx` 주석).
        `rangeStart`/`rangeEnd` 를 두 달력에 똑같이 넘겨, 한쪽을 고르는 중에도 이미 고른
        반대쪽이 띠로 보이게 한다 — 며칠 일정인지 그 자리에서 읽힌다.

        **정렬 클래스를 주지 않는다.** `sm:items-start` 가 있었는데 그 근거("달력이
        펼쳐지면 그 칸만 높아진다")는 달력이 포털 팝오버가 되면서 사라졌다. 남은 높이 차는
        한쪽에만 오류 문구가 붙을 때인데, 기본값인 `stretch` 는 짧은 칸의 **상자**만 늘릴
        뿐 `Field`(`flex flex-col`)의 내용은 위에 그대로 있어 두 입력의 윗줄이 어긋나지
        않는다. 가운데로 내려가는 것은 `items-center` 일 때의 이야기다.
        `ai-plan-create-form.tsx` 의 같은 두 날짜 줄도 정렬 클래스 없이 성립한다.
      */}
      {/*
        **시작일을 고르면 종료일 달력이 이어서 열린다** — 기간은 두 번 고르는 하나의 값이라
        중간에 한 번 더 누르게 할 이유가 없다. 두 필드를 하나의 기간 선택으로 합치지 않기로
        한 결정(#162)은 그대로 두고, 합쳤을 때 얻는 흐름만 가져온다.

        **종료일이 비어 있을 때만 연다.** 이미 잡은 일정의 시작일만 하루 미루는 것은 흔한
        조작인데, 그때도 달력이 튀어나오면 참견이 된다.
      */}
      <div className="flex flex-col gap-5 sm:flex-row sm:gap-4">
        <Field
          id="startDate"
          label={messages.plan.fieldStartDate}
          required
          error={errors.fields.startDate}
          className="flex-1"
        >
          <DateField
            id="startDate"
            label={messages.plan.fieldStartDate}
            placeholder={messages.plan.datePlaceholder}
            today={today}
            value={values.startDate}
            onValueChange={(startDate) => {
              onValueChange('startDate', startDate)
              /*
                **종료일보다 늦은 시작일을 고르면 종료일을 비우고 다시 받는다.**
                시작일에는 `max` 를 걸지 않는다 — 걸면 기간을 통째로 뒤로 옮기려는 사람이
                종료일부터 고쳐야 하고, 그 순서를 화면이 알려 줄 방법이 없다. 대신 어긋난
                순간 종료일만 비워 다시 묻는다. 남겨 두면 스키마가 제출에서 막는 값이
                화면에는 멀쩡해 보인다.
              */
              if (values.endDate !== '' && startDate > values.endDate) {
                onValueChange('endDate', '')
                setEndDateOpen(true)
              } else if (values.endDate === '') {
                setEndDateOpen(true)
              }
            }}
            invalid={errors.fields.startDate !== undefined}
            rangeStart={values.startDate}
            rangeEnd={values.endDate}
          />
        </Field>

        <Field
          id="endDate"
          label={messages.plan.fieldEndDate}
          required
          error={errors.fields.endDate}
          className="flex-1"
        >
          <DateField
            id="endDate"
            label={messages.plan.fieldEndDate}
            placeholder={messages.plan.datePlaceholder}
            today={today}
            value={values.endDate}
            onValueChange={(endDate) => onValueChange('endDate', endDate)}
            open={endDateOpen}
            onOpenChange={setEndDateOpen}
            invalid={errors.fields.endDate !== undefined}
            // 시작일보다 이른 날짜는 달력에서 아예 고를 수 없다. 스키마의 refine 은
            // 남는 경로를 위한 2차 방어다
            min={values.startDate === '' ? null : values.startDate}
            rangeStart={values.startDate}
            rangeEnd={values.endDate}
          />
        </Field>
      </div>

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

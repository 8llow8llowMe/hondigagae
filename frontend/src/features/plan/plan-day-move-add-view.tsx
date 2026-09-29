'use client'

import type { Ref } from 'react'

import { Button } from '@/components/button'
import { Field } from '@/components/field'
import { FormAlert } from '@/components/form-alert'
import { Input } from '@/components/input'
import { Modal } from '@/components/modal'
import { messages } from '@/lib/messages'
import { ITEM_TITLE_MAX } from '@/lib/plan/day-items'

/** 입력 id. `Field` 의 `htmlFor` 와 `Input` 의 `id` 가 같아야 라벨이 붙는다 */
export const PLAN_MOVE_TITLE_INPUT_ID = 'plan-move-add-title'
const FORM_ID = 'plan-move-add-form'

/**
 * 이동·휴식 추가 모달의 **props 전용 부분** — 이슈 #1014 · `일자편집-세부명세.md` H2.
 *
 * 입력 상태를 드는 `PlanDayMoveAddModal` 과 저장 훅이 정적 렌더되지 않으므로 레이아웃·
 * 문구·오류 분기만 여기로 갈랐다 (`plan-copy-view.tsx` 와 같은 판단, `testing-guide.md` §1).
 */
export type PlanDayMoveAddViewProps = {
  open: boolean
  onClose: () => void
  day: number
  title: string
  onTitleChange: (value: string) => void
  /** `validateMoveTitle()` 가 준 문구. 없으면 `null` */
  fieldError: string | null
  /** 저장 실패. `toPlanDaySaveError()` 가 분류한 문구 그대로다. 없으면 `null` */
  formError: string | null
  saving: boolean
  /**
   * **다른 담기(실내 대안)가 진행 중이다.** 일괄 교체라 두 요청이 겹치면 나중 응답이 앞선
   * 것을 덮어 한쪽이 사라진다 — 그동안 제출을 잠근다 (F6 "담기 중 다른 담기").
   */
  blocked: boolean
  onSubmit: () => void
  inputRef?: Ref<HTMLInputElement>
}

/**
 * `PlanEditModal` · `PlanCopyView` 와 **같은 골격**이다 — 제목 · 설명 · 필드 · 배너 ·
 * `취소`/`추가하기`.
 *
 * **`<form>` 으로 감싼다.** 입력이 하나뿐이라 Enter 로 바로 보내는 것이 자연스럽다.
 * 제출 버튼이 `footer`(폼 밖)에 서므로 `form` 속성으로 잇는다.
 */
export function PlanDayMoveAddView({
  open,
  onClose,
  day,
  title,
  onTitleChange,
  fieldError,
  formError,
  saving,
  blocked,
  onSubmit,
  inputRef,
}: PlanDayMoveAddViewProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={messages.plan.addMoveTitle.replace('{day}', String(day))}
      description={messages.plan.addMoveDescription}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {messages.plan.editCancel}
          </Button>
          <Button type="submit" form={FORM_ID} loading={saving} disabled={blocked}>
            {messages.plan.addMoveSubmit}
          </Button>
        </>
      }
    >
      <form
        id={FORM_ID}
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <Field
          id={PLAN_MOVE_TITLE_INPUT_ID}
          label={messages.plan.addMoveFieldLabel}
          required
          {...(fieldError === null ? {} : { error: fieldError })}
        >
          <Input
            id={PLAN_MOVE_TITLE_INPUT_ID}
            value={title}
            onValueChange={onTitleChange}
            invalid={fieldError !== null}
            placeholder={messages.plan.addMovePlaceholder}
            /*
              서버 `@Size(max = 100)` 과 같은 값이다. **붙여넣기도 여기서 잘린다** — 그래도
              검증(`validateMoveTitle`)을 두는 것은 앞뒤 공백을 걷어 잰 값이 기준이기 때문이다.
            */
            maxLength={ITEM_TITLE_MAX}
            autoComplete="off"
            {...(inputRef === undefined ? {} : { ref: inputRef })}
          />
        </Field>

        <FormAlert message={formError} />
      </form>
    </Modal>
  )
}

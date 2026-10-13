'use client'

import type { RefObject } from 'react'

import { Button } from '@/components/button'
import { Field } from '@/components/field'
import { FormAlert } from '@/components/form-alert'
import { Modal } from '@/components/modal'
import { Textarea } from '@/components/textarea'
import { messages } from '@/lib/messages'
import { ITEM_MEMO_MAX } from '@/lib/plan/item-memo-edit'
import { fillTemplate } from '@/lib/text/template'

/** 입력 id. `Field` 의 `htmlFor` 와 `Textarea` 의 `id` 가 같아야 라벨이 붙는다 */
export const PLAN_ITEM_MEMO_INPUT_ID = 'plan-item-memo'
const FORM_ID = 'plan-item-memo-form'

/**
 * 항목 메모 모달의 **props 전용 부분** — 이슈 #1460 · `일정상세-세부명세.md` D30-2.
 *
 * 입력 상태를 드는 `PlanItemMemoModal` 과 저장 훅이 정적 렌더되지 않으므로 레이아웃 · 문구 ·
 * 분기만 여기로 갈랐다 (`plan-day-move-add-view.tsx` 와 같은 판단, `testing-guide.md` §1).
 */
export type PlanItemMemoEditViewProps = {
  open: boolean
  /** **안정된 함수여야 한다** — `useOverlay` 가 effect 의존성으로 든다 (`PlanItemTimeView` 와 같다) */
  onClose: () => void
  /** 항목 제목 — 어느 항목의 메모인지 모달 제목이 말한다 */
  title: string
  value: string
  onValueChange: (value: string) => void
  /** 저장된 메모가 있다 — `메모 지우기` 가 선다 */
  hasMemo: boolean
  /** `validateItemMemo()` 가 준 문구. 없으면 `null` */
  fieldError: string | null
  /** 저장 실패. `toPlanDaySaveError()` 가 분류한 문구 그대로다. 없으면 `null` */
  formError: string | null
  saving: boolean
  /**
   * **다른 일자 저장(담기 · 이동 추가 · 시각)이 진행 중이다.** 메모도 일괄 교체라 겹치면 나중
   * 응답이 앞선 것을 덮는다 — 그동안 저장 · 지우기를 잠근다 (F6).
   */
  blocked: boolean
  onSubmit: () => void
  onClear: () => void
  /** 열면 여기로 초점이 간다 — 고치러 연 모달이라 첫 행동이 입력이다 */
  inputRef?: RefObject<HTMLTextAreaElement | null>
}

/**
 * `PlanItemTimeView` 와 **같은 골격**이다 — 제목 · 설명 · 필드 · 배너 · `지우기` / `취소` · `저장`.
 *
 * **Enter 로 보내지 않는다.** 여러 줄 입력이라 Enter 는 줄바꿈이다(메모는 줄바꿈을 살려 보여
 * 준다, D29-1). 그래도 `<form>` 으로 감싸 제출 버튼과 `form` 속성으로 잇는다.
 */
export function PlanItemMemoEditView({
  open,
  onClose,
  title,
  value,
  onValueChange,
  hasMemo,
  fieldError,
  formError,
  saving,
  blocked,
  onSubmit,
  onClear,
  inputRef,
}: PlanItemMemoEditViewProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={fillTemplate(messages.plan.itemMemoModalTitle, { title })}
      description={messages.plan.itemMemoModalDescription}
      {...(inputRef === undefined ? {} : { initialFocusRef: inputRef })}
      size="md"
      footer={
        <>
          {hasMemo && (
            // 되돌릴 방향이 다른 행동이라 왼쪽 끝으로 뗀다 — `시간 지우기` 와 같은 자리다
            <Button
              variant="ghost"
              onClick={onClear}
              disabled={saving || blocked}
              className="mr-auto"
            >
              {messages.plan.itemMemoClear}
            </Button>
          )}
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {messages.plan.editCancel}
          </Button>
          <Button type="submit" form={FORM_ID} loading={saving} disabled={blocked}>
            {messages.plan.itemMemoSave}
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
          id={PLAN_ITEM_MEMO_INPUT_ID}
          label={messages.plan.itemMemoFieldLabel}
          hint={messages.plan.itemMemoFieldHint}
          {...(fieldError === null ? {} : { error: fieldError })}
        >
          <Textarea
            id={PLAN_ITEM_MEMO_INPUT_ID}
            value={value}
            onValueChange={onValueChange}
            invalid={fieldError !== null}
            rows={5}
            /*
              서버 `@Size(max = 500)` 과 같은 값이다. 붙여넣기도 여기서 잘린다 — 그래도 검증
              (`validateItemMemo`)을 두는 것은 앞뒤 공백을 걷어 잰 값이 기준이기 때문이다.
            */
            maxLength={ITEM_MEMO_MAX}
            // 저장 중 `disabled` 면 초점이 `body` 로 떨어진다 — 실패로 돌아왔을 때 고치던 자리를 잃는다
            readOnly={saving}
            {...(inputRef === undefined ? {} : { ref: inputRef })}
          />
        </Field>

        <FormAlert message={formError} />
      </form>
    </Modal>
  )
}

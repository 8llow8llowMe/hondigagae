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
  /**
   * 그 일자에 '다녀옴' 체크가 있다 (#1066). 이동·휴식을 넣는 것도 일괄 교체라 새
   * `planItemId` 가 발급되고 그 날의 체크가 초기화된다 — 넣기 전에 여기서 알린다.
   */
  resetsVisits?: boolean
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
  resetsVisits = false,
  onSubmit,
  inputRef,
}: PlanDayMoveAddViewProps) {
  const close = guardClose(saving, onClose)

  return (
    <Modal
      open={open}
      onClose={close}
      title={messages.plan.addMoveTitle.replace('{day}', String(day))}
      description={messages.plan.addMoveDescription}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={saving}>
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
          hint={messages.plan.addMoveFieldHint}
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

        {/*
          **입력 아래, 오류 위다.** 제목을 쓰는 동안 가리지 않고, 넣기 직전 시선이 닿는
          자리다 (#1066). 체크가 없는 날에는 서지 않는다 — 잃을 것이 없다.
        */}
        {resetsVisits && (
          <p className="text-caption text-fg-muted font-medium break-keep">
            {messages.plan.visitResetOnMoveNotice}
          </p>
        )}

        <FormAlert message={formError} />
      </form>
    </Modal>
  )
}

/**
 * **저장 중에는 닫지 않는다** (#1014 검토). `Modal` 의 Esc · 바깥 누름 · 닫기 버튼과 취소가
 * 모두 이 함수를 거친다.
 *
 * 닫을 수 있으면 두 가지가 깨진다. ① 응답 전에 같은 일자의 `순서 편집` 이 **낡은 목록으로**
 * 열리고, 그대로 저장하면 방금 넣은 항목이 일괄 교체로 지워진다. ② 닫은 뒤 도착한 실패는
 * 그릴 곳이 없어 사용자가 저장이 안 된 것을 모른다. 저장은 짧고(PUT 한 번), 끝나면 성공은
 * 모달을 닫고 실패는 모달 안에 문구를 띄우므로 기다리게 해도 막히는 길이 없다.
 */
export function guardClose(saving: boolean, onClose: () => void): () => void {
  return () => {
    if (saving) return
    onClose()
  }
}

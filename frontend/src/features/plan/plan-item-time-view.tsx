'use client'

import type { ChangeEvent, KeyboardEvent, RefObject } from 'react'

import { Button } from '@/components/button'
import { FormAlert } from '@/components/form-alert'
import { ChevronDownIcon } from '@/components/icons'
import { Modal } from '@/components/modal'
import { messages } from '@/lib/messages'
import { CLOCK_MAX, type ClockField, formatClockPart } from '@/lib/plan/clock-time'

const FORM_ID = 'plan-item-time-form'

/** 칸 id. 라벨 · 테스트가 같은 값을 본다 */
export function clockFieldId(field: ClockField): string {
  return `plan-item-time-${field}`
}

const FIELD_LABEL: Record<ClockField, string> = {
  hour: messages.plan.itemTimeHourLabel,
  minute: messages.plan.itemTimeMinuteLabel,
}

const FIELD_VALUE_TEXT: Record<ClockField, string> = {
  hour: messages.plan.itemTimeHourValueText,
  minute: messages.plan.itemTimeMinuteValueText,
}

/**
 * 전자시계 입력 모달의 **props 전용 부분** — 이슈 #1028 · `일자편집-세부명세.md` G2.
 *
 * 입력 상태를 드는 `PlanItemTimeModal` 과 저장 훅이 정적 렌더되지 않으므로 레이아웃 · 문구 ·
 * 분기만 여기로 갈랐다 (`plan-day-move-add-view.tsx` 와 같은 판단, `testing-guide.md` §1).
 */
export type PlanItemTimeViewProps = {
  open: boolean
  /**
   * **렌더마다 새로 만들지 않은 함수여야 한다.** `useOverlay` 가 이 값을 effect 의존성으로
   * 들어, 바뀔 때마다 초점을 모달 밖으로 되돌렸다가 다시 넣는다 — 숫자를 칠 때마다 칸의
   * 초점이 빠진다. 저장 중 닫기 막기도 호출부(`PlanItemTimeModal`)가 이 함수 안에서 한다.
   */
  onClose: () => void
  /** 항목 제목 — 어느 항목의 시각인지 모달 제목이 말한다 */
  title: string
  hour: number
  minute: number
  /** 저장된 시각이 있다 — `시간 지우기` 가 선다 */
  hasTime: boolean
  /** 그 일자에 `다녀옴` 체크가 있다 — 저장하면 초기화된다는 한 줄을 낸다 (D9-2) */
  visitResetWarning: boolean
  /** `toPlanDaySaveError()` 가 분류한 문구 그대로. 없으면 `null` */
  formError: string | null
  saving: boolean
  /**
   * **다른 일괄 교체(담기 · 이동 추가)가 진행 중이다.** 두 요청이 겹치면 나중 응답이 앞선
   * 것을 덮어 한쪽이 사라진다 — 그동안 저장 · 지우기를 잠근다 (F6).
   */
  blocked: boolean
  onStep: (field: ClockField, direction: 1 | -1) => void
  onFieldKeyDown: (field: ClockField, event: KeyboardEvent<HTMLInputElement>) => void
  onFieldChange: (field: ClockField, event: ChangeEvent<HTMLInputElement>) => void
  onFieldFocus: (field: ClockField) => void
  hourRef: RefObject<HTMLInputElement | null>
  minuteRef: RefObject<HTMLInputElement | null>
  onSubmit: () => void
  onClear: () => void
}

/**
 * `PlanDayMoveAddView` 와 **같은 골격**이다 — 제목 · 설명 · 본문 · 배너 · 조작부.
 *
 * **`<form>` 으로 감싼다.** 칸에서 Enter 로 바로 저장한다. 제출 버튼이 `footer`(폼 밖)에
 * 서므로 `form` 속성으로 잇는다.
 */
export function PlanItemTimeView({
  open,
  onClose,
  title,
  hour,
  minute,
  hasTime,
  visitResetWarning,
  formError,
  saving,
  blocked,
  onStep,
  onFieldKeyDown,
  onFieldChange,
  onFieldFocus,
  hourRef,
  minuteRef,
  onSubmit,
  onClear,
}: PlanItemTimeViewProps) {
  const fieldProps = { saving, onStep, onFieldKeyDown, onFieldChange, onFieldFocus }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={messages.plan.itemTimeModalTitle.replace('{title}', title)}
      /*
        **경고를 설명 자리에 둔다.** 설명은 `aria-describedby` 로 묶여 모달이 열릴 때 함께
        읽힌다 — 저장 버튼 근처에 따로 두면 스크린리더 사용자는 저장한 뒤에야 듣는다.
      */
      description={
        <>
          <p>{messages.plan.itemTimeModalDescription}</p>
          {visitResetWarning && (
            <p className="text-metric-low-700 mt-1 font-medium">
              {messages.plan.itemTimeVisitResetWarning}
            </p>
          )}
        </>
      }
      initialFocusRef={hourRef}
      size="sm"
      footer={
        <>
          {hasTime && (
            // 되돌릴 방향이 다른 행동이라 왼쪽 끝으로 뗀다 — 취소 · 저장과 한 무리로 읽히지 않게
            <Button
              variant="ghost"
              onClick={onClear}
              disabled={saving || blocked}
              className="mr-auto"
            >
              {messages.plan.itemTimeClear}
            </Button>
          )}
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {messages.plan.editCancel}
          </Button>
          <Button type="submit" form={FORM_ID} loading={saving} disabled={blocked}>
            {messages.plan.itemTimeSave}
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
        {/*
          **가운데 큰 숫자 두 칸** — 전자시계 모양이다. 쌍점은 두 칸을 잇는 장식이라
          a11y 트리에서 뺀다 (각 칸이 `시` · `분` 이름과 값 문장을 따로 갖는다).
        */}
        <div className="flex items-center justify-center gap-3">
          <ClockSpin field="hour" value={hour} inputRef={hourRef} {...fieldProps} />
          <span aria-hidden className="text-display text-fg-muted font-black">
            :
          </span>
          <ClockSpin field="minute" value={minute} inputRef={minuteRef} {...fieldProps} />
        </div>

        <FormAlert message={formError} />
      </form>
    </Modal>
  )
}

/**
 * 한 칸 — ▲ · 숫자 · ▼.
 *
 * **숫자 칸이 `role="spinbutton"` 인 `<input>` 이다.** `div` 에 `tabIndex` 를 주면 모바일에서
 * 숫자 키패드가 뜨지 않는다 — 직접 입력이 이 모달의 요구라 입력 요소여야 한다
 * (`inputMode="numeric"`). 값의 뜻은 `aria-valuenow/min/max` 와 `aria-valuetext`(`10시`)가
 * 말한다 (ARIA APG spinbutton).
 *
 * **▲▼ 는 탭 정지가 아니다** (`tabIndex={-1}`). 키보드 사용자는 칸 안에서 ↑↓ 로 같은 일을
 * 한다 — 버튼까지 탭 정지면 한 칸에 셋, 모달에 여섯이 서서 저장까지 멀어진다. 마우스 ·
 * 터치로는 그대로 눌린다.
 */
function ClockSpin({
  field,
  value,
  inputRef,
  saving,
  onStep,
  onFieldKeyDown,
  onFieldChange,
  onFieldFocus,
}: {
  field: ClockField
  value: number
  inputRef: RefObject<HTMLInputElement | null>
  saving: boolean
  onStep: PlanItemTimeViewProps['onStep']
  onFieldKeyDown: PlanItemTimeViewProps['onFieldKeyDown']
  onFieldChange: PlanItemTimeViewProps['onFieldChange']
  onFieldFocus: PlanItemTimeViewProps['onFieldFocus']
}) {
  const label = FIELD_LABEL[field]
  const display = formatClockPart(value)

  return (
    <div className="flex flex-col items-center gap-1">
      <Button
        variant="ghost"
        iconOnly
        aria-label={messages.plan.itemTimeIncrease.replace('{unit}', label)}
        tabIndex={-1}
        disabled={saving}
        leading={<ChevronDownIcon size={24} className="rotate-180" />}
        onClick={() => onStep(field, 1)}
      />
      <input
        ref={inputRef}
        id={clockFieldId(field)}
        type="text"
        inputMode="numeric"
        role="spinbutton"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={CLOCK_MAX[field]}
        aria-valuetext={FIELD_VALUE_TEXT[field].replace('{value}', String(value))}
        autoComplete="off"
        /*
          **저장 중에는 `disabled` 가 아니라 `readOnly` 다.** 초점을 든 칸이 `disabled` 가 되면
          초점이 `body` 로 떨어지고, 실패로 돌아왔을 때 고치던 자리를 잃는다.
        */
        readOnly={saving}
        value={display}
        onKeyDown={(event) => onFieldKeyDown(field, event)}
        onChange={(event) => onFieldChange(field, event)}
        onFocus={(event) => {
          // 칸에 들어오면 두 자리를 통째로 고른다 — 첫 숫자가 덮어쓴다
          event.currentTarget.select()
          onFieldFocus(field)
        }}
        className="text-display text-fg bg-bg border-border-strong focus-visible:ring-brand-500 h-16 w-20 rounded-md border text-center font-black tabular-nums read-only:opacity-50 focus-visible:ring-2 focus-visible:outline-none"
      />
      <Button
        variant="ghost"
        iconOnly
        aria-label={messages.plan.itemTimeDecrease.replace('{unit}', label)}
        tabIndex={-1}
        disabled={saving}
        leading={<ChevronDownIcon size={24} />}
        onClick={() => onStep(field, -1)}
      />
    </div>
  )
}

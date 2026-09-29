'use client'

import {
  type ChangeEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import { PlanItemTimeView } from '@/features/plan/plan-item-time-view'
import {
  type ClockField,
  clockKeyValue,
  type ClockTime,
  parsePastedClock,
  readClockInput,
  stepClock,
  toServerStartTime,
  typeClockDigit,
} from '@/lib/plan/clock-time'

/**
 * 전자시계 입력 모달 — 이슈 #1028 · `일자편집-세부명세.md` G2.
 *
 * **입력 상태만 든다.** 저장은 호출부(`PlanDetailSection`)의 `usePlanItemTime` 이 한다 —
 * 담기 · 이동 추가와 같은 화면에서 "지금 일괄 교체가 진행 중인가" 를 함께 봐야 해서다
 * (`PlanDayMoveAddModal` 과 같은 분담).
 *
 * **`Modal` 에 넘기는 닫기 함수를 렌더마다 새로 만들지 않는다.** `useOverlay` 가 그 함수를
 * effect 의존성으로 들어, 바뀔 때마다 초점을 모달 밖(열기 전 자리)으로 돌렸다가 다시 첫
 * 칸으로 넣는다 — 이 모달은 숫자 한 자리마다 다시 렌더되므로 **치는 족족 초점이 튄다.**
 * 저장 중 여부는 ref 로 읽어 닫기 함수의 정체성을 지킨다 (#1014 `guardClose` 의 규칙을
 * 같은 모양으로 지키되, 인자로 받지 않는다).
 */
export function PlanItemTimeModal({
  open,
  title,
  initial,
  hasTime,
  formError,
  saving,
  blocked,
  onSave,
  onClose,
}: {
  open: boolean
  title: string
  /**
   * 열 때의 값 — `initialClockTime()` 이 정한다. **첫 렌더에서만 읽는다** — 호출부가 여는
   * 항목마다 `key` 를 바꿔 새로 마운트한다.
   */
  initial: ClockTime
  hasTime: boolean
  formError: string | null
  saving: boolean
  blocked: boolean
  /** `HH:mm:ss` 또는 `null`(지우기) */
  onSave: (startTime: string | null) => void
  /** **안정된 함수여야 한다** — 호출부가 `useCallback` 으로 넘긴다 (머리주석) */
  onClose: () => void
}) {
  const [hour, setHour] = useState(initial.hour)
  const [minute, setMinute] = useState(initial.minute)
  /** 두 번째 자리를 기다리는 첫 자리 — 칸마다 따로다 */
  const bufferRef = useRef<{ field: ClockField; digits: string } | null>(null)
  const hourRef = useRef<HTMLInputElement>(null)
  const minuteRef = useRef<HTMLInputElement>(null)

  /*
    **열 때마다 그 항목 값에서 시작한다 — 호출부가 `key` 로 새로 마운트한다.** 지난번에 만지다
    닫은 값이 다른 항목의 모달에 남아 있으면 그 항목 것으로 읽힌다. effect 로 되돌리지 않는
    이유: 모달이 먼저 초점을 넣고(`select()`) 그 뒤 값이 바뀌면 브라우저가 선택을 풀어, 첫
    숫자가 덮어쓰지 않고 뒤에 붙는 것처럼 보인다.
  */

  const savingRef = useRef(saving)
  useEffect(() => {
    savingRef.current = saving
  }, [saving])

  const guardedClose = useCallback(() => {
    // 저장 중에는 닫지 않는다 — 근거는 `guardClose`(plan-day-move-add-view.tsx) 주석
    if (savingRef.current) return
    onClose()
  }, [onClose])

  function set(field: ClockField, value: number) {
    if (field === 'hour') setHour(value)
    else setMinute(value)
  }

  function valueOf(field: ClockField): number {
    return field === 'hour' ? hour : minute
  }

  function handleStep(field: ClockField, direction: 1 | -1) {
    if (saving) return
    bufferRef.current = null
    set(field, stepClock(field, valueOf(field), direction))
  }

  function handleKeyDown(field: ClockField, event: KeyboardEvent<HTMLInputElement>) {
    if (saving) return
    const next = clockKeyValue(field, valueOf(field), event.key)
    if (next === null) return

    // ↑↓ 가 커서를 옮기거나 페이지를 굴리지 않게 한다
    event.preventDefault()
    bufferRef.current = null
    set(field, next)
  }

  function handleChange(field: ClockField, event: ChangeEvent<HTMLInputElement>) {
    if (saving) return
    const native = event.nativeEvent
    const input = readClockInput({
      inputType: native instanceof InputEvent ? native.inputType : null,
      data: native instanceof InputEvent ? native.data : null,
      raw: event.target.value,
      caret: event.target.selectionStart,
    })
    // 숫자가 아니면 아무것도 바꾸지 않는다 — 제어 입력이라 React 가 두 자리 표시로 되돌린다
    if (input === null) return

    if (input.kind === 'clear') {
      bufferRef.current = null
      set(field, 0)
      return
    }

    if (input.kind === 'paste') {
      bufferRef.current = null
      const pasted = parsePastedClock(field, input.text)
      // 못 읽으면 그대로 둔다 — 제어 입력이라 React 가 두 자리 표시로 되돌린다
      if (pasted === null) return
      if (pasted.hour !== undefined) setHour(pasted.hour)
      if (pasted.minute !== undefined) setMinute(pasted.minute)
      return
    }

    const buffer = bufferRef.current?.field === field ? bufferRef.current.digits : ''
    const result = typeClockDigit(field, buffer, input.digit)
    set(field, result.value)
    bufferRef.current = result.buffer === '' ? null : { field, digits: result.buffer }

    // 시 두 자리가 끝나면 분으로 넘어간다 — 네이티브 시간 입력과 같다
    if (result.complete && field === 'hour') minuteRef.current?.focus()
  }

  function handleFocus() {
    // 칸에 새로 들어오면 두 자리를 처음부터 친다
    bufferRef.current = null
  }

  function handleSubmit() {
    if (saving || blocked) return
    onSave(toServerStartTime({ hour, minute }))
  }

  function handleClear() {
    if (saving || blocked) return
    onSave(null)
  }

  return (
    <PlanItemTimeView
      open={open}
      onClose={guardedClose}
      title={title}
      hour={hour}
      minute={minute}
      hasTime={hasTime}
      formError={formError}
      saving={saving}
      blocked={blocked}
      onStep={handleStep}
      onFieldKeyDown={handleKeyDown}
      onFieldChange={handleChange}
      onFieldFocus={handleFocus}
      hourRef={hourRef}
      minuteRef={minuteRef}
      onSubmit={handleSubmit}
      onClear={handleClear}
    />
  )
}

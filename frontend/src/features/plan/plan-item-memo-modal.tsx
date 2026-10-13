'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { PlanItemMemoEditView } from '@/features/plan/plan-item-memo-edit-view'
import { itemMemoChanged, validateItemMemo } from '@/lib/plan/item-memo-edit'

/**
 * 항목 메모 모달 — 이슈 #1460 · `일정상세-세부명세.md` D30-2.
 *
 * **입력 상태만 든다.** 저장은 호출부(`PlanDetailSection`)의 `usePlanItemMemo` 가 한다 — 담기 ·
 * 이동 추가 · 시각과 같은 화면에서 "지금 일자 저장이 진행 중인가" 를 함께 봐야 해서다
 * (`PlanItemTimeModal` 과 같은 분담).
 *
 * **열 때마다 그 항목 메모에서 시작한다 — 호출부가 여는 항목마다 `key` 를 바꿔 새로 마운트한다.**
 *
 * **닫기 함수를 렌더마다 새로 만들지 않는다.** `useOverlay` 가 그 함수를 effect 의존성으로 들어,
 * 바뀔 때마다 초점이 모달 밖으로 튄다 — 글자 하나마다 다시 렌더되는 모달이다. 저장 중 여부는
 * ref 로 읽는다 (`PlanItemTimeModal` 머리주석과 같은 이유).
 */
export function PlanItemMemoModal({
  open,
  title,
  initial,
  formError,
  saving,
  blocked,
  onSave,
  onClose,
}: {
  open: boolean
  title: string
  /** 저장된 메모. **첫 렌더에서만 읽는다** */
  initial: string | null
  formError: string | null
  saving: boolean
  blocked: boolean
  /** 걷기 전 입력값. `null` 이면 지운다 — 공백 걷기는 `setItemMemoPayload` 가 한다 */
  onSave: (memo: string | null) => void
  /** **안정된 함수여야 한다** — 호출부가 `useCallback` 으로 넘긴다 */
  onClose: () => void
}) {
  const [value, setValue] = useState(initial ?? '')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const savingRef = useRef(saving)
  useEffect(() => {
    savingRef.current = saving
  }, [saving])

  const guardedClose = useCallback(() => {
    // 저장 중에는 닫지 않는다 — 근거는 `guardClose`(plan-day-move-add-view.tsx) 주석
    if (savingRef.current) return
    onClose()
  }, [onClose])

  function handleSubmit() {
    if (saving || blocked) return

    const error = validateItemMemo(value)
    if (error !== null) {
      setFieldError(error)
      inputRef.current?.focus()
      return
    }

    setFieldError(null)
    // 바뀐 것이 없으면 보내지 않고 닫는다 — 일괄 교체가 얻는 것 없이 id 를 새로 발급한다 (D30-1)
    if (!itemMemoChanged(initial, value)) {
      onClose()
      return
    }
    onSave(value)
  }

  function handleClear() {
    if (saving || blocked) return
    setFieldError(null)
    onSave(null)
  }

  return (
    <PlanItemMemoEditView
      open={open}
      onClose={guardedClose}
      title={title}
      value={value}
      onValueChange={(next) => {
        setValue(next)
        // 고치기 시작하면 낡은 문구를 걷는다 — 다음 제출이 다시 잰다
        if (fieldError !== null) setFieldError(null)
      }}
      hasMemo={(initial ?? '').trim() !== ''}
      fieldError={fieldError}
      formError={formError}
      saving={saving}
      blocked={blocked}
      onSubmit={handleSubmit}
      onClear={handleClear}
      inputRef={inputRef}
    />
  )
}

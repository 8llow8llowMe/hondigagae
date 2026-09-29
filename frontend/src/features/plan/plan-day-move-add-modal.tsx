'use client'

import { useEffect, useRef, useState } from 'react'

import { PlanDayMoveAddView } from '@/features/plan/plan-day-move-add-view'
import { validateMoveTitle } from '@/lib/plan/day-items'

/**
 * 이동·휴식 추가 모달 — 이슈 #1014 · `일자편집-세부명세.md` H2.
 *
 * **입력 상태만 든다.** 저장은 호출부(`PlanDetailSection`)의 `usePlanAddMove` 가 한다 —
 * 실내 대안 담기와 같은 화면에서 "지금 일괄 교체가 진행 중인가" 를 함께 봐야 해서다.
 *
 * **클라이언트 검증은 서버 왕복을 줄이는 것이지 대체가 아니다** (`form-guide.md` §5).
 * 통과하지 못하면 요청을 보내지 않고 필드에 문구를 붙인 뒤 입력으로 초점을 돌린다.
 */
export function PlanDayMoveAddModal({
  open,
  day,
  saving,
  blocked,
  formError,
  onSubmit,
  onClose,
}: {
  open: boolean
  day: number
  saving: boolean
  blocked: boolean
  formError: string | null
  /** 검증을 통과한 입력값. 공백 걷기·100자 자르기는 `appendMoveItemPayload` 가 한다 */
  onSubmit: (title: string) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  /*
    **열 때마다 비운다.** 기본값은 빈 문자열이다 (H2) — 지난번에 쓰다 닫은 글이 다른 일자의
    모달에 남아 있으면 그 날 것으로 읽힌다. `day` 를 함께 보는 것도 그래서다.
  */
  useEffect(() => {
    if (!open) return
    setTitle('')
    setFieldError(null)
  }, [open, day])

  function handleSubmit() {
    if (saving || blocked) return

    const error = validateMoveTitle(title)
    if (error !== null) {
      setFieldError(error)
      inputRef.current?.focus()
      return
    }

    setFieldError(null)
    onSubmit(title)
  }

  return (
    <PlanDayMoveAddView
      open={open}
      onClose={onClose}
      day={day}
      title={title}
      onTitleChange={(value) => {
        setTitle(value)
        // 고치기 시작하면 낡은 문구를 걷는다 — 다음 제출이 다시 잰다
        if (fieldError !== null) setFieldError(null)
      }}
      fieldError={fieldError}
      formError={formError}
      saving={saving}
      blocked={blocked}
      onSubmit={handleSubmit}
      inputRef={inputRef}
    />
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useQueryClient } from '@tanstack/react-query'

import { PlanCopyView } from '@/features/plan/plan-copy-view'
import { planKeys } from '@/features/plan/queries'
import { copyPlan } from '@/lib/api/plan'
import { copyEndDateFor, toPlanCopyPayload, validatePlanCopy } from '@/lib/plan/copy'
import { type PlanCopyError, toPlanCopyError } from '@/lib/plan/copy-error'
import type { PlanDetail } from '@/types/plan'

/**
 * 일정 복사 — 상태 · mutation · 이동. 정본은 `docs/features/plan/일정복사-세부명세.md`
 * (이슈 #617). 레이아웃·문구·실패 표시는 `PlanCopyView` 가 진다(props 전용, node 테스트 대상).
 *
 * **`PlanEditModal` 과 같은 구조다** — 열 때마다 상태를 초기화하고, `savingRef` 로 빠른
 * 연속 제출을 막고(form-guide.md §6), 성공은 캐시를 심고 실패는 폼 배너로 띄운다.
 */
export function PlanCopyModal({
  plan,
  today,
  open,
  onClose,
}: {
  plan: PlanDetail
  /** 달력의 오늘(`YYYY-MM-DD`). 서버가 내려준 값을 받는다 — `PlanEditModal` 과 같은 근거 */
  today: string
  open: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [endDateOpen, setEndDateOpen] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ startDate?: string; endDate?: string }>({})
  const [formError, setFormError] = useState<PlanCopyError | null>(null)
  const [saving, setSaving] = useState(false)
  // disabled 반영 전 빠른 연속 제출을 막는다 (form-guide.md §6)
  const savingRef = useRef(false)

  /*
    **열 때마다 두 날짜를 비운다** (D4-3). 원본 날짜를 미리 채우면 그대로 제출했을 때
    같은 기간의 일정이 하나 더 생긴다 — 복사를 누른 사람이 원한 것은 다른 기간이다.
  */
  useEffect(() => {
    if (!open) return
    setStartDate('')
    setEndDate('')
    setEndDateOpen(false)
    setFieldErrors({})
    setFormError(null)
  }, [open])

  function handleSubmit() {
    if (savingRef.current) return

    const validation = validatePlanCopy({ startDate, endDate })
    if (Object.keys(validation).length > 0) {
      setFieldErrors(validation)
      setFormError(null)
      return
    }

    savingRef.current = true
    setSaving(true)
    setFieldErrors({})
    setFormError(null)

    void copyPlan(plan.planId, toPlanCopyPayload({ startDate, endDate }))
      .then((next) => {
        /*
          **원본 캐시는 건드리지 않는다** (D3-4) — 서버가 원본을 수정하지 않는다.
          새 일정은 응답을 그대로 심어 이동 직후 조회 없이 그려진다.
        */
        queryClient.setQueryData(planKeys.detail(next.planId), next)
        void queryClient.invalidateQueries({ queryKey: planKeys.list() })
        router.push(`/plans/${next.planId}`)
      })
      .catch((cause: unknown) => {
        setFormError(toPlanCopyError(cause))
        savingRef.current = false
        setSaving(false)
      })
  }

  return (
    <PlanCopyView
      open={open}
      onClose={onClose}
      today={today}
      totalDays={plan.totalDays}
      startDate={startDate}
      endDate={endDate}
      onStartDateChange={(next) => {
        setStartDate(next)
        /*
          **기본값이지 검증이 아니다** (D4-3). 원본과 같은 일수로 종료일을 채우고,
          사용자가 그 값을 고치면 이 자동 채움은 덮어써진다. 서식이 아닌 값이면
          `copyEndDateFor` 가 `null` 을 주므로 종료일을 건드리지 않는다.
        */
        const autoEnd = copyEndDateFor(next, plan.totalDays)
        if (autoEnd !== null) setEndDate(autoEnd)
      }}
      onEndDateChange={setEndDate}
      endDateOpen={endDateOpen}
      onEndDateOpenChange={setEndDateOpen}
      fieldErrors={fieldErrors}
      formError={formError}
      saving={saving}
      onSubmit={handleSubmit}
    />
  )
}

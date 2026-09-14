'use client'

import { useRef, useState } from 'react'

import { useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/button'
import { FormAlert } from '@/components/form-alert'
import { planKeys } from '@/features/plan/queries'
import { updatePlan } from '@/lib/api/plan'
import { apiErrorToFormErrors } from '@/lib/form/field-errors'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
import type { PlanDetail } from '@/types/plan'

/**
 * 일정 확정하기 — 아트보드 01.
 *
 * **`{ status: 'CONFIRMED' }` 만 보낸다.** `PUT` 은 부분 수정이라 보내지 않은 필드는
 * 유지된다 (`PlanCommandProcessor.updatePlan`) — 제목·기간을 함께 실어 보내면 화면이
 * 들고 있던 낡은 값으로 덮어쓸 위험이 생긴다.
 *
 * 성공하면 **버튼이 사라지고 배지만 남는다.** 응답이 `PlanDetailResponse` 전체라
 * `setQueryData` 로 갈아끼우고 목록만 무효화한다 — 상세를 다시 조회하지 않는다.
 */
export function PlanStatusAction({ plan }: { plan: PlanDetail }) {
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // disabled 반영 전 빠른 연속 클릭을 막는다 (form-guide.md §6)
  const savingRef = useRef(false)

  // 초안일 때만 확정할 수 있다. 서버가 모르는 코드를 내려도 버튼을 만들지 않는다
  if (plan.status.code !== 'DRAFT') return null

  function handleConfirm() {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setErrorMessage(null)

    void updatePlan(plan.planId, { status: 'CONFIRMED' })
      .then((next) => {
        queryClient.setQueryData(planKeys.detail(plan.planId), next)
        void queryClient.invalidateQueries({ queryKey: planKeys.list() })
      })
      .catch((error: unknown) => {
        setErrorMessage(apiErrorToFormErrors(error, messages.plan.statusConfirmError).form)
      })
      .finally(() => {
        savingRef.current = false
        setSaving(false)
      })
  }

  return (
    /*
      액션이라 카드가 아니다 (§0) — **개요 카드 바로 아래, 바닥 위**다 (#553).
      인셋은 카드 안 글줄과 같은 축이다 (#447).
    */
    <div className={cn('flex flex-col gap-2', INSET_CLASS.card)}>
      {/*
        **전폭이다** (#553). `self-start` 였을 때는 우측 일자 열(1024 에서 700px 이상)에서
        낱말 폭(`일정 확정하기` 6글자)만큼만 서서 열 왼쪽 끝에 작게 붙어 있었다.
        280~400 폭 레일에서는 전폭이 그 열의 유일한 행동이라는 뜻이 된다.
      */}
      <Button onClick={handleConfirm} loading={saving} className="w-full">
        {messages.plan.statusConfirmAction}
      </Button>
      <FormAlert message={errorMessage} />
    </div>
  )
}

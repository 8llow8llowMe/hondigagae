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
 * 일정 확정하기 / 초안으로 되돌리기 — 아트보드 01.
 *
 * **`{ status }` 하나만 보낸다.** `PUT` 은 부분 수정이라 보내지 않은 필드는 유지된다
 * (`PlanCommandProcessor.updatePlan`) — 제목·기간을 함께 실어 보내면 화면이 들고 있던
 * 낡은 값으로 덮어쓸 위험이 생긴다.
 *
 * 응답이 `PlanDetailResponse` 전체라 `setQueryData` 로 갈아끼우고 목록만 무효화한다 —
 * 상세를 다시 조회하지 않는다.
 *
 * ## 확정에 확인 대화상자를 붙이지 않는다 (#565)
 *
 * **되돌릴 수 있기 때문이다.** 백엔드에 상태 전이 가드가 없다 —
 * `PlanCommandProcessor.updatePlan` 이 `command.status()` 를 그대로 쓰므로
 * `{ status: 'DRAFT' }` 를 보내면 초안으로 돌아간다. 되돌릴 수 있는 동작에 확인을 붙이면
 * **되돌릴 수 없다는 거짓말**이 된다.
 *
 * 삭제는 반대다 — `담은 장소와 일자별 판정이 함께 사라져요. 되돌릴 수 없어요.` 로
 * `ConfirmModal` 을 세운다 (`plan-manage-menu.tsx`). **두 액션의 무게 차이는 지금이
 * 맞다.** 예전에 없던 것은 확인이 아니라 **되돌리는 수단**이었고, 그것을 여기서 준다.
 *
 * ## 되돌리기가 관리 메뉴가 아니라 여기인 이유
 *
 * 이 컴포넌트가 서 있는 자리가 **상태 배지 바로 아래**다 (`plan-detail-section.tsx` 의
 * `action` 슬롯 주석: "`초안 → 확정` 은 그 배지가 말하는 값을 바꾸는 일"). 되돌리기는
 * 같은 축의 반대 방향이라 같은 자리가 맞고, 실패를 말할 `FormAlert` 도 사용자가 방금
 * 누른 그 자리에 이미 있다. 관리 메뉴가 다루는 것은 일정의 **신원**(이름 · 예산 · 존재
 * 여부)이지 상태가 아니다.
 *
 * **대신 무게를 낮춘다.** 확정은 그 화면의 주 행동이라 `primary` 지만 되돌리기는 거의
 * 누르지 않는 액션이라 `secondary` 다. 자리는 같아도 크기가 같으면 안 된다.
 *
 * ## `COMPLETED` 에서는 아무것도 만들지 않는다
 *
 * 오가는 것은 초안 ↔ 확정 둘뿐이다. 여행을 마친 일정을 초안으로 되돌리는 것은 다른
 * 판단이 필요하고 이번 범위가 아니다. 서버가 모르는 코드를 내려도 같다.
 */
export function PlanStatusAction({ plan }: { plan: PlanDetail }) {
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // disabled 반영 전 빠른 연속 클릭을 막는다 (form-guide.md §6)
  const savingRef = useRef(false)

  const draft = plan.status.code === 'DRAFT'
  if (!draft && plan.status.code !== 'CONFIRMED') return null

  function handleClick() {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setErrorMessage(null)

    /*
      지금 상태의 반대로 간다. **실패 문구도 방향마다 다르다** — `확정하지 못했어요` 가
      되돌리기 실패에 뜨면 사용자가 무엇이 실패했는지 거꾸로 읽는다.
    */
    void updatePlan(plan.planId, { status: draft ? 'CONFIRMED' : 'DRAFT' })
      .then((next) => {
        queryClient.setQueryData(planKeys.detail(plan.planId), next)
        void queryClient.invalidateQueries({ queryKey: planKeys.list() })
      })
      .catch((error: unknown) => {
        const fallback = draft ? messages.plan.statusConfirmError : messages.plan.statusRevertError
        setErrorMessage(apiErrorToFormErrors(error, fallback).form)
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

        **되돌리기도 같은 폭이다.** 자리가 같은데 폭만 줄면 버튼이 옮겨 다니는 것처럼
        보인다 — 무게 차이는 `variant` 가 말한다.
      */}
      <Button
        variant={draft ? 'primary' : 'secondary'}
        onClick={handleClick}
        loading={saving}
        className="w-full"
      >
        {draft ? messages.plan.statusConfirmAction : messages.plan.statusRevertAction}
      </Button>
      <FormAlert message={errorMessage} />
    </div>
  )
}

'use client'

import { useRouter } from 'next/navigation'

import { useQueryClient } from '@tanstack/react-query'

import { ButtonLink } from '@/components/button'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { usePetList } from '@/features/pet/use-pet-list'
import { PlanCreateForm } from '@/features/plan/plan-create-form'
import { PlanListSkeleton } from '@/features/plan/plan-list-skeleton'
import { planKeys } from '@/features/plan/queries'
import { planFormSchema } from '@/features/plan/schemas'
import { createPlan } from '@/lib/api/plan'
import { useForm } from '@/lib/form/use-form'
import { messages } from '@/lib/messages'
import { toPlanCreatePayload } from '@/lib/plan/form'
import type { Pet } from '@/types/pet'
import { EMPTY_PLAN_FORM_VALUES, type PlanDetail, type PlanFormValues } from '@/types/plan'

/**
 * 직접 만들기 — 공통명세 S9.
 *
 * **반려견 목록이 먼저다.** `POST /plans` 에 `petId` 가 필수라 반려견이 없으면 폼을
 * 채울 수 없다. 0마리면 폼 대신 등록으로 안내한다.
 */
export function PlanCreateView() {
  const petsQuery = usePetList()

  if (petsQuery.isPending) return <PlanListSkeleton rows={2} />

  if (petsQuery.error !== null) {
    return (
      <ErrorState
        title={messages.plan.errorTitle}
        description={messages.plan.errorDescription}
        onRetry={() => void petsQuery.refetch()}
      />
    )
  }

  const pets = petsQuery.data?.pets ?? []

  if (pets.length === 0) {
    return (
      <EmptyState
        title={messages.plan.noPetTitle}
        description={messages.plan.noPetDescription}
        action={<ButtonLink href="/pets/new">{messages.plan.noPetAction}</ButtonLink>}
      />
    )
  }

  return <PlanCreateFormContainer pets={pets} />
}

/**
 * 폼 상태를 갖는 안쪽. **반려견을 다 받은 뒤에 마운트된다** — `useForm` 은 첫 렌더의
 * `initialValues` 만 취하므로, 조회 중에 만들면 한 마리뿐일 때의 미리 고르기가 영영
 * 반영되지 않는다.
 */
function PlanCreateFormContainer({ pets }: { pets: Pet[] }) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const form = useForm<PlanFormValues, PlanDetail>({
    schema: planFormSchema,
    initialValues: {
      ...EMPTY_PLAN_FORM_VALUES,
      // 한 마리뿐이면 미리 고른다 — 고를 것이 없는 라디오를 비워 두지 않는다
      petId: pets.length === 1 ? (pets[0]?.petId ?? '') : '',
    },
    onSubmit: (values) => createPlan(toPlanCreatePayload(values)),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: planKeys.all })
      /*
        **만든 일정의 상세로 보낸다** (#80 에서 상세가 생겼다. 공통명세 S9 예고 이행).
        빈 일정을 만든 직후이므로 다음 할 일은 "장소를 담는 것" 이고, 그 자리가 상세다.

        `replace` 를 쓴다. `push` 면 뒤로가기로 폼에 돌아와 같은 일정을 두 번 만들 수 있다
        (`PetCreateView` 와 같은 판단).
      */
      router.replace(`/plans/${created.planId}`)
    },
  })

  return (
    <PlanCreateForm
      values={form.values}
      errors={form.errors}
      pets={pets}
      submitting={form.isSubmitting}
      submitCount={form.submitCount}
      firstErrorField={form.firstErrorField}
      onValueChange={form.setValue}
      onSubmit={() => void form.submit()}
    />
  )
}

'use client'

import { useRouter } from 'next/navigation'

import { useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { ButtonLink } from '@/components/button'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { Surface } from '@/components/surface'
import { usePetList } from '@/features/pet/use-pet-list'
import { PlanCreateForm } from '@/features/plan/plan-create-form'
import { PlanListSkeleton } from '@/features/plan/plan-list-skeleton'
import { planKeys } from '@/features/plan/queries'
import { planFormSchema } from '@/features/plan/schemas'
import { createPlan } from '@/lib/api/plan'
import { useForm } from '@/lib/form/use-form'
import { messages } from '@/lib/messages'
import { toPlanCreatePayload } from '@/lib/plan/form'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
import type { Pet } from '@/types/pet'
import { EMPTY_PLAN_FORM_VALUES, type PlanDetail, type PlanFormValues } from '@/types/plan'

/**
 * 직접 만들기 — 공통명세 S9.
 *
 * **반려견 목록이 먼저다.** `POST /plans` 에 `petId` 가 필수라 반려견이 없으면 폼을
 * 채울 수 없다. 0마리면 폼 대신 등록으로 안내한다.
 *
 * **네 상태가 한 카드에 든다** (`DESIGN.md §0`, #453). 조회 중 · 조회 오류 · 반려견 0마리 ·
 * 폼이 전부 같은 화자("일정을 만드는 일")가 이어 말하는 것이라 카드 경계가 하나다.
 * **상태에 따라 카드가 생겼다 사라지지 않는다** (#440 판단) — 하나를 카드 밖에 두면
 * 그 상태에서만 화면의 흰 면이 통째로 없어진다.
 */
export function PlanCreateView({
  /** `'YYYY-MM-DD'`. 서버가 만들어 내려보낸 오늘 — 달력의 오늘 표시에 쓴다 */
  today,
}: {
  today: string
}) {
  const petsQuery = usePetList(true)
  // `/plans` 는 proxy.ts `PROTECTED_PATHS` 라 미로그인이 여기 닿지 않는다 (#200)

  if (petsQuery.isPending) {
    return (
      /* `PlanListSkeleton` 은 이미 `SurfaceList` + `INSET_CLASS.card` 다 (#445) */
      <PlanCreateSurface>
        <PlanListSkeleton rows={2} />
      </PlanCreateSurface>
    )
  }

  if (petsQuery.error !== null) {
    return (
      <PlanCreateSurface>
        {/* 카드 안이라 인셋이 `card`(16/20)다 — 페이지 값 40 을 쓰면 내용이 두 번 밀린다 */}
        <ErrorState
          inset="card"
          title={messages.plan.errorTitle}
          description={messages.plan.errorDescription}
          onRetry={() => void petsQuery.refetch()}
        />
      </PlanCreateSurface>
    )
  }

  const pets = petsQuery.data?.pets ?? []

  if (pets.length === 0) {
    return (
      <PlanCreateSurface>
        <EmptyState
          inset="card"
          title={messages.plan.noPetTitle}
          description={messages.plan.noPetDescription}
          action={<ButtonLink href="/pets/new">{messages.plan.noPetAction}</ButtonLink>}
        />
      </PlanCreateSurface>
    )
  }

  return (
    <PlanCreateSurface>
      <PlanCreateFormContainer pets={pets} today={today} />
    </PlanCreateSurface>
  )
}

/**
 * 네 상태가 공유하는 L1 카드 — 보이는 제목·부제가 여기 있다 (`DESIGN.md §0`, #453).
 *
 * **카드를 페이지가 아니라 뷰가 그린다.** 페이지(서버 컴포넌트)가 `Surface` 를 그리고
 * 뷰가 안만 채우는 안도 되지만, 그러면 세 상태의 `inset="card"` 와 그 인셋이 어느 카드
 * 안쪽 값인지가 두 파일로 갈린다. **"여기부터 카드 안"** 이 한 파일에서 보이는 쪽을
 * 골랐다. 이 파일이 `'use client'` 인 것은 상관없다 — `Surface` 는 서버/클라 양쪽에서 된다.
 */
function PlanCreateSurface({ children }: { children: ReactNode }) {
  return (
    <Surface
      lead
      title={messages.plan.createTitle}
      description={<p className="text-body-2 text-fg-muted">{messages.plan.createDescription}</p>}
    >
      {children}
    </Surface>
  )
}

/**
 * 폼 상태를 갖는 안쪽. **반려견을 다 받은 뒤에 마운트된다** — `useForm` 은 첫 렌더의
 * `initialValues` 만 취하므로, 조회 중에 만들면 한 마리뿐일 때의 미리 고르기가 영영
 * 반영되지 않는다.
 */
function PlanCreateFormContainer({ pets, today }: { pets: Pet[]; today: string }) {
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
    /*
      **카드 안이라 인셋이 `card`(16/20)다** (§0). 위 여백 8 은 제목 줄의 `pb-3`(12)에
      더해져 폼 `gap-5`(20)와 같은 리듬이 되고, 아래 20 이 카드 바닥을 닫는다.
      `PlanCreateForm` 자신은 여백을 갖지 않는다 — 담기 시트(`place-add-to-plan-sheet`)가
      같은 폼을 쓰고 그쪽은 시트의 인셋 안이다.

      **라디오 타일(`RadioGroup`)의 `rounded-md border` 는 그대로 둔다.** §0 L2 의
      "아이템에 테두리를 두르지 않는다" 는 목록 아이템의 이야기이고, 이것은 `Input` ·
      `DateField` 트리거와 같은 **입력 컨트롤의 채널**이다 — 걷으면 누를 수 있다는 신호가
      같이 사라진다. 선택 시 `bg-row-selected`, `FormAlert` 의 `bg-danger-100` 도 같은
      이유로 남는다(시스템 상태 표시 — 하루 재생성 카드 #452 안과 같다).
    */
    <div className={cn('pt-2 pb-5', INSET_CLASS.card)}>
      <PlanCreateForm
        values={form.values}
        errors={form.errors}
        pets={pets}
        submitting={form.isSubmitting}
        submitCount={form.submitCount}
        firstErrorField={form.firstErrorField}
        today={today}
        onValueChange={form.setValue}
        onSubmit={() => void form.submit()}
      />
    </div>
  )
}

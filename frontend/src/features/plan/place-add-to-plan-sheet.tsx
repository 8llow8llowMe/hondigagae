'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { useQueryClient } from '@tanstack/react-query'

import { BottomSheet } from '@/components/bottom-sheet'
import { Button } from '@/components/button'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { FormAlert } from '@/components/form-alert'
import { useToast } from '@/components/toast'
import { usePetList } from '@/features/pet/use-pet-list'
import {
  type AddToPlanDayOption,
  PlaceAddToPlanPicker,
} from '@/features/plan/place-add-to-plan-picker'
import { PlanCreateForm } from '@/features/plan/plan-create-form'
import { PlanListSkeleton } from '@/features/plan/plan-list-skeleton'
import { planKeys } from '@/features/plan/queries'
import { planFormSchema } from '@/features/plan/schemas'
import { usePlanDetail } from '@/features/plan/use-plan-detail'
import { usePlanList } from '@/features/plan/use-plan-list'
import { createPlan, replaceDayItems } from '@/lib/api/plan'
import { mergeSlices } from '@/lib/api/slice'
import { useToday } from '@/lib/date/use-today'
import { useForm } from '@/lib/form/use-form'
import { messages } from '@/lib/messages'
import { addPlanDays } from '@/lib/plan/date'
import { appendPlaceItemPayload, placeIdsOf } from '@/lib/plan/day-items'
import { groupItemsByDay } from '@/lib/plan/detail'
import { toPlanCreatePayload } from '@/lib/plan/form'
import { toPlanDaySaveError } from '@/lib/plan/save-error'
import { withObjectParticle, withTopicParticle } from '@/lib/text/korean'
import { EMPTY_PLAN_FORM_VALUES, type PlanDetail, type PlanFormValues } from '@/types/plan'

/**
 * 장소 상세 → 일정에 담기 — 아트보드 `혼디가개 장소 상세` 02.
 *
 * **두 갈래가 한 시트 안에 있다.** `기존 일정 선택`(1단계) 과 `새 일정 만들어서 담기`
 * (2단계) 이고, 2단계는 화면을 이동시키지 않고 **같은 시트를 한 단계 밀어 넣는다**
 * (좌상단 뒤로) — 담으려던 맥락을 잃지 않기 위해서다.
 *
 * **`/plans/{planId}/days/{day}/add`(#82)와 방향이 반대다.** 그쪽은 일정 안에서 장소를
 * 고르고 여기는 장소를 보다가 일정을 고른다. **저장 경로는 같다** —
 * `PUT …/days/{day}/items` 일괄 교체이고 `appendPlaceItemPayload` 를 함께 쓴다.
 *
 * **`usePlanAddPlace` 를 재사용하지 않는다.** 그 훅은 `planId` 를 마운트 시점에 고정하는데
 * 여기서는 시트 안에서 일정을 바꿀 수 있고, 새로 만든 일정의 `planId` 는 제출 뒤에야 나온다.
 */
export function PlaceAddToPlanSheet({
  open,
  onClose,
  place,
  onAdded,
}: {
  open: boolean
  onClose: () => void
  place: { placeId: string; title: string }
  /** 담기에 성공했다. 호출부가 하단 바 라벨을 `다른 일정에도 담기` 로 바꾼다 */
  onAdded: () => void
}) {
  const [step, setStep] = useState<'plans' | 'create'>('plans')

  /*
    **시트를 닫을 때 단계를 되돌린다.** 만들기 단계에서 닫고 다시 열면 폼이 열린 채로
    떠서, 기존 일정에 담으려던 사람이 왜 새 일정 폼을 보는지 알 수 없다.
  */
  const close = () => {
    setStep('plans')
    onClose()
  }

  /*
    **닫혀 있으면 아무것도 마운트하지 않는다.** `BottomSheet` 가 `open` 으로 렌더만 막으면
    아래 단계의 훅은 그대로 돌아, 장소 상세를 열기만 해도 `GET /plans` 가 나간다 —
    미로그인에게는 그것이 **401** 이라 전역 재발급까지 헛돌았다 (실측으로 잡았다).
  */
  if (!open) return null

  if (step === 'create') {
    return (
      <BottomSheet
        open={open}
        onClose={close}
        onBack={() => setStep('plans')}
        title={messages.plan.addToPlanCreateTitle}
      >
        <CreatePlanStep place={place} onAdded={onAdded} onClose={close} />
      </BottomSheet>
    )
  }

  return (
    <SelectPlanStep
      open={open}
      onClose={close}
      place={place}
      onAdded={onAdded}
      onCreate={() => setStep('create')}
    />
  )
}

/** 1단계 — 기존 일정에서 고른다 */
function SelectPlanStep({
  open,
  onClose,
  place,
  onAdded,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  place: { placeId: string; title: string }
  onAdded: () => void
  onCreate: () => void
}) {
  const list = usePlanList()
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  // 고른 일정이 없으면 조회하지 않는다 — 시트를 여는 것만으로 상세를 받을 이유가 없다
  const detail = usePlanDetail(selectedPlanId ?? '', { enabled: selectedPlanId !== null })
  const add = useAddPlaceToPlan({ place, onAdded, onClose })

  const plans = list.data === undefined ? [] : mergeSlices(list.data.pages)
  const days = toDayOptions(detail.data, place.placeId)

  const selectPlan = (planId: string) => {
    setSelectedPlanId(planId)
    // 일정이 바뀌면 일자를 버린다 — 남겨 두면 새 일정의 없는 일차가 골라진 채로 남는다
    setSelectedDay(null)
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={messages.plan.addToPlanSheetTitle}
      footer={
        selectedDay === null ? undefined : (
          <div className="flex flex-col gap-2">
            <p className="text-caption text-fg-muted">
              {messages.plan.addToPlanDayHint.replace('{day}', String(selectedDay))}
            </p>
            <FormAlert message={add.error} />
            <Button
              size="lg"
              loading={add.pending}
              onClick={() => {
                const group = detail.data?.items ?? []
                add.submit({
                  planId: selectedPlanId ?? '',
                  day: selectedDay,
                  dayItems: group.filter((item) => item.day === selectedDay),
                })
              }}
            >
              {messages.plan.addToPlanSubmit.replace('{day}', String(selectedDay))}
            </Button>
          </div>
        )
      }
    >
      <div className="pb-2">
        {/* 제목 줄에 장소명을 다시 쓴다 — 시트만 보고 무엇을 담는지 알 수 있어야 한다 */}
        <p className="text-body-2 text-fg-muted px-4 pb-3 break-keep">{place.title}</p>

        {list.isPending ? (
          <PlanListSkeleton rows={2} />
        ) : list.isError ? (
          <ErrorState
            headingLevel={3}
            title={messages.plan.errorTitle}
            description={messages.plan.errorDescription}
            onRetry={() => void list.refetch()}
          />
        ) : plans.length === 0 ? (
          <EmptyState
            headingLevel={3}
            title={messages.plan.addToPlanEmptyTitle}
            description={messages.plan.addToPlanEmptyDescription}
          />
        ) : (
          <PlaceAddToPlanPicker
            plans={plans}
            selectedPlanId={selectedPlanId}
            onSelectPlan={selectPlan}
            days={days}
            daysLoading={selectedPlanId !== null && detail.isPending}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
          />
        )}

        {/* **두 번째 갈래.** 일정이 있든 없든 항상 연다 — 아트보드 02-A 의 목록 아래 항목 */}
        <div className="border-border mt-2 border-t px-4 pt-4">
          <Button variant="secondary" size="lg" className="w-full" onClick={onCreate}>
            {messages.plan.addToPlanCreateAction}
          </Button>
        </div>
      </div>
    </BottomSheet>
  )
}

/**
 * 2단계 — 새 일정을 만들고 **그 자리에서 1일차에 담는다**.
 *
 * **반려견 목록이 먼저다.** `POST /plans` 에 `petId` 가 필수라 0마리면 폼을 채울 수 없다
 * (`PlanCreateView` 와 같은 판단).
 */
function CreatePlanStep({
  place,
  onAdded,
  onClose,
}: {
  place: { placeId: string; title: string }
  onAdded: () => void
  onClose: () => void
}) {
  const petsQuery = usePetList(true)
  // 담기 시트는 authed 일 때만 열린다 (`place-detail-view` 의 `onAddToPlan`) (#200)

  if (petsQuery.isPending) return <PlanListSkeleton rows={2} />

  if (petsQuery.error !== null) {
    return (
      <ErrorState
        headingLevel={3}
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
        headingLevel={3}
        title={messages.plan.noPetTitle}
        description={messages.plan.noPetDescription}
      />
    )
  }

  return <CreatePlanForm pets={pets} place={place} onAdded={onAdded} onClose={onClose} />
}

function CreatePlanForm({
  pets,
  place,
  onAdded,
  onClose,
}: {
  pets: NonNullable<ReturnType<typeof usePetList>['data']>['pets']
  place: { placeId: string; title: string }
  onAdded: () => void
  onClose: () => void
}) {
  const add = useAddPlaceToPlan({ place, onAdded, onClose })
  /*
    **여기서 오늘을 읽는다.** 이 본문은 시트가 열린 뒤에만 렌더돼 서버가 그린 적이 없다 —
    하이드레이션이 어긋날 서버 출력 자체가 없다. 근거는 `use-today.ts` 주석.
  */
  const today = useToday()

  const form = useForm<PlanFormValues, PlanDetail>({
    schema: planFormSchema,
    initialValues: {
      ...EMPTY_PLAN_FORM_VALUES,
      petId: pets.length === 1 ? (pets[0]?.petId ?? '') : '',
    },
    onSubmit: (values) => createPlan(toPlanCreatePayload(values)),
    /*
      **만든 뒤 곧바로 담는다.** 여기서 멈추면 "새 일정 만들어서 담기" 가 절반만 한 셈이
      되고, 사용자는 방금 만든 일정으로 다시 찾아가 같은 장소를 담아야 한다.

      담기는 별도 요청이라 **만들기는 성공했는데 담기가 실패할 수 있다.** 그때 폼을
      되돌리지 않는다 — 일정은 실제로 만들어졌으므로 다시 제출하면 같은 일정이 두 개가
      된다. 실패 문구만 남기고 시트를 열어 둔다.
    */
    onSuccess: (created) =>
      add.submit({
        planId: created.planId,
        // 새 일정이라 항상 1일차이고 그 일자는 비어 있다 (아트보드 02-B 의 안내와 같다)
        day: 1,
        dayItems: [],
      }),
  })

  return (
    <div className="px-4 pb-4">
      <p className="text-body-2 text-fg-muted pb-4 break-keep">
        {messages.plan.addToPlanCreateHint.replace('{title}', withTopicParticle(place.title))}
      </p>

      <FormAlert message={add.error} />

      <PlanCreateForm
        values={form.values}
        errors={form.errors}
        pets={pets}
        // 만들기와 담기가 이어져 있어 **담는 중에도 제출을 잠근다**
        submitting={form.isSubmitting || add.pending}
        submitCount={form.submitCount}
        today={today}
        onValueChange={form.setValue}
        onSubmit={() => void form.submit()}
        submitLabel={messages.plan.addToPlanCreateSubmit}
      />
    </div>
  )
}

/**
 * 담기 저장 — 두 갈래가 **같은 훅을 쓴다**.
 *
 * **낙관적 업데이트를 하지 않는다.** `planItemId` 를 서버가 새로 발급하고 `PLAN_004`
 * 처럼 재시도로 풀리지 않는 실패가 있다 (`use-plan-add-place.ts` 와 같은 판단).
 */
function useAddPlaceToPlan({
  place,
  onAdded,
  onClose,
}: {
  place: { placeId: string; title: string }
  onAdded: () => void
  onClose: () => void
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = ({
    planId,
    day,
    dayItems,
  }: {
    planId: string
    day: number
    /** 그 일자의 **현재 항목 전부**. 되싣지 않으면 일자가 비워진다 */
    dayItems: Parameters<typeof appendPlaceItemPayload>[0]
  }) => {
    if (pending) return
    setPending(true)
    setError(null)

    // `.then(onSuccess, onError)` 2인자다 — 성공 후처리의 예외가 저장 실패로 분류되면 안 된다
    void replaceDayItems(planId, day, appendPlaceItemPayload(dayItems, day, place))
      .then(
        (next) => {
          queryClient.setQueryData(planKeys.detail(planId), next)
          void queryClient.invalidateQueries({ queryKey: planKeys.weather(planId) })
          // 목록의 항목 수를 화면이 쓰지는 않지만, 담은 뒤 목록이 낡은 채로 남지 않게 한다
          void queryClient.invalidateQueries({ queryKey: planKeys.list() })

          showToast({
            message: messages.plan.addPlaceToast
              .replace('{title}', withObjectParticle(place.title))
              .replace('{day}', String(day)),
            action: {
              label: messages.plan.addToPlanToastAction,
              onAction: () => router.push(`/plans/${planId}`),
            },
          })

          onAdded()
          onClose()
        },
        (cause: unknown) =>
          setError(
            toPlanDaySaveError(cause, {
              retriable: messages.plan.addPlaceErrorDescription,
              missingPlace: messages.plan.addPlaceMissingPlaceError,
            }).message,
          ),
      )
      .finally(() => setPending(false))
  }

  return { submit, pending, error }
}

/**
 * 상세 → 일자 버튼이 아는 것.
 *
 * **`totalDays` 가 일자 수를 정한다** — 항목 배열에서 유추하지 않는다 (`groupItemsByDay`).
 * 기간 밖 고아 항목은 담을 대상이 아니라 여기서 뺀다.
 */
function toDayOptions(detail: PlanDetail | undefined, placeId: string): AddToPlanDayOption[] {
  if (detail === undefined) return []

  const { days } = groupItemsByDay(detail.items, detail.totalDays)

  return days.map((group) => ({
    day: group.day,
    date: addPlanDays(detail.startDate, group.day - 1),
    itemCount: group.items.length,
    already: placeIdsOf(group.items).has(placeId),
  }))
}

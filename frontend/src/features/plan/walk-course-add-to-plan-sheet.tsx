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
import { formatCourseDistance } from '@/lib/format/distance'
import { messages } from '@/lib/messages'
import { addPlanDays } from '@/lib/plan/date'
import { appendWalkCourseItemPayload, walkCourseIdsOf } from '@/lib/plan/day-items'
import { groupItemsByDay } from '@/lib/plan/detail'
import { toPlanCreatePayload } from '@/lib/plan/form'
import { toPlanDaySaveError } from '@/lib/plan/save-error'
import { withObjectParticle, withTopicParticle } from '@/lib/text/korean'
import { EMPTY_PLAN_FORM_VALUES, type PlanDetail, type PlanFormValues } from '@/types/plan'

/** 담기 시트가 알아야 하는 코스의 최소 정보 — 코스 상세(`WalkCourseDetail`)의 부분집합 */
export type WalkCourseAddTarget = {
  walkCourseId: string
  courseLabel: string
  name: string
  distanceKm: number
}

/**
 * 담기 대상 요약 줄 — `1코스 시흥-광치기 · 15.1km` (`올레담기-세부명세.md` D1).
 *
 * **시트 머리에 둔다.** 일정 목록을 스크롤하는 동안 무엇을 담는 중인지 사라지면, 여러
 * 코스를 보다 들어온 사용자가 다른 코스를 담는다. 순수 함수로 뺀 이유는 렌더 없이
 * 값으로 검증하기 위해서다 — 조사·거리 표기 둘 다 실수하기 쉬운 자리다.
 */
export function walkCourseSummaryLine(course: WalkCourseAddTarget): string {
  return messages.plan.walkAddSummaryLine
    .replace('{courseLabel}', course.courseLabel)
    .replace('{name}', course.name)
    .replace('{distanceKm}', formatCourseDistance(course.distanceKm))
}

/**
 * 담기 성공 토스트 문구 — `1코스를 몽실이와 제주 2박 3일 3일차에 담았어요.` (D5).
 *
 * **조사는 `withObjectParticle` 로 만든다.** `1코스` 는 받침이 있고 `2코스` 는 없다 —
 * `을(를)` 을 박아 두면 이름표 절반이 비문이 된다. 순수 함수로 뺀 이유는 이 조사 실수를
 * 렌더 없이 값으로 잡기 위해서다.
 */
export function walkCourseAddToastMessage(
  courseLabel: string,
  planTitle: string,
  day: number,
): string {
  return messages.plan.walkAddToast
    .replace('{course}', withObjectParticle(courseLabel))
    .replace('{planTitle}', planTitle)
    .replace('{day}', String(day))
}

/**
 * 코스 상세 → 일정에 담기 — `PlaceAddToPlanSheet`(#118) 와 같은 시트 모양이다
 * (`올레담기-세부명세.md` D0-1). **`usePlanAddPlace` 를 재사용하지 않는 것과 같은 이유로
 * `PlaceAddToPlanSheet` 도 재사용하지 않는다** — `planId` 를 마운트 시점에 고정하지 않고
 * 시트 안에서 바꿀 수 있어야 하는 대신, 저장 페이로드 조립(`appendWalkCourseItemPayload`)과
 * 중복 판정(`walkCourseIdsOf`)이 장소 쪽과 다른 네임스페이스를 쓴다.
 *
 * **`PlaceAddToPlanPicker` 는 그대로 쓴다** — 일정·일자를 고르는 것은 대상이 장소든
 * 코스든 같은 UI 라 컴포넌트가 대상 종류를 몰라도 된다 (D2).
 */
export function WalkCourseAddToPlanSheet({
  open,
  onClose,
  course,
  onAdded,
}: {
  open: boolean
  onClose: () => void
  course: WalkCourseAddTarget
  /** 담기에 성공했다. 호출부가 버튼 라벨을 `다른 일정에도 담기` 로 바꾼다 */
  onAdded: () => void
}) {
  const [step, setStep] = useState<'plans' | 'create'>('plans')

  // 시트를 닫을 때 단계를 되돌린다 — 만들기 단계에서 닫고 다시 열면 왜 새 일정
  // 폼을 보는지 알 수 없다 (`PlaceAddToPlanSheet` 와 같은 처리)
  const close = () => {
    setStep('plans')
    onClose()
  }

  /*
    **닫혀 있으면 아무것도 마운트하지 않는다.** 아래 단계의 훅이 그대로 돌면 코스 상세를
    열기만 해도 `GET /plans` 가 나간다 — 미로그인에는 그것이 401 이라 전역 재발급까지
    헛돈다 (`PlaceAddToPlanSheet:74` 와 같은 실측 근거).
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
        <CreateWalkCoursePlanStep course={course} onAdded={onAdded} onClose={close} />
      </BottomSheet>
    )
  }

  return (
    <SelectWalkCoursePlanStep
      open={open}
      onClose={close}
      course={course}
      onAdded={onAdded}
      onCreate={() => setStep('create')}
    />
  )
}

/** 1단계 — 기존 일정에서 고른다 */
function SelectWalkCoursePlanStep({
  open,
  onClose,
  course,
  onAdded,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  course: WalkCourseAddTarget
  onAdded: () => void
  onCreate: () => void
}) {
  const list = usePlanList()
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  // 고른 일정이 없으면 조회하지 않는다 — 시트를 여는 것만으로 상세를 받을 이유가 없다
  const detail = usePlanDetail(selectedPlanId ?? '', { enabled: selectedPlanId !== null })
  const add = useAddWalkCourseToPlan({ course, onAdded, onClose })

  const plans = list.data === undefined ? [] : mergeSlices(list.data.pages)
  const days = toWalkCourseDayOptions(detail.data, course.walkCourseId)

  const selectPlan = (planId: string) => {
    setSelectedPlanId(planId)
    // 일정이 바뀌면 일자를 버린다 — 남겨 두면 새 일정의 없는 일차가 골라진 채로 남는다
    setSelectedDay(null)
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={messages.plan.walkAddToPlanSheetTitle}
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
                const planTitle = detail.data?.title ?? ''
                add.submit({
                  planId: selectedPlanId ?? '',
                  day: selectedDay,
                  dayItems: (detail.data?.items ?? []).filter((item) => item.day === selectedDay),
                  planTitle,
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
        {/* 무엇을 담는 중인지 시트 머리에 남긴다 — 일정 목록을 스크롤해도 사라지지 않는다 (D1) */}
        <p className="text-body-2 text-fg-muted px-4 pb-3 break-keep">
          {walkCourseSummaryLine(course)}
        </p>

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

        {/* 두 번째 갈래. 일정이 있든 없든 항상 연다 */}
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
 * `PlaceAddToPlanSheet` 의 `CreatePlanStep` 과 같은 흐름이다. 반려견 목록이 먼저다 —
 * `POST /plans` 에 `petId` 가 필수라 0마리면 폼을 채울 수 없다.
 */
function CreateWalkCoursePlanStep({
  course,
  onAdded,
  onClose,
}: {
  course: WalkCourseAddTarget
  onAdded: () => void
  onClose: () => void
}) {
  const petsQuery = usePetList(true)
  // 담기 시트는 authed 일 때만 열린다 (`WalkCourseAddAction`)

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

  return (
    <CreateWalkCoursePlanForm pets={pets} course={course} onAdded={onAdded} onClose={onClose} />
  )
}

function CreateWalkCoursePlanForm({
  pets,
  course,
  onAdded,
  onClose,
}: {
  pets: NonNullable<ReturnType<typeof usePetList>['data']>['pets']
  course: WalkCourseAddTarget
  onAdded: () => void
  onClose: () => void
}) {
  const add = useAddWalkCourseToPlan({ course, onAdded, onClose })
  /*
    **여기서 오늘을 읽는다.** 이 본문은 시트가 열린 뒤에만 렌더돼 서버가 그린 적이
    없다 — 하이드레이션이 어긋날 서버 출력 자체가 없다 (`use-today.ts` 주석).
  */
  const today = useToday()

  const form = useForm<PlanFormValues, PlanDetail>({
    schema: planFormSchema,
    initialValues: {
      ...EMPTY_PLAN_FORM_VALUES,
      petId: pets.length === 1 ? (pets[0]?.petId ?? '') : '',
    },
    onSubmit: (values) => createPlan(toPlanCreatePayload(values)),
    // 만든 뒤 곧바로 담는다 — 만들기는 성공했는데 담기가 실패할 수 있어, 그때는 폼을
    // 되돌리지 않는다. 일정은 실제로 만들어졌으므로 다시 제출하면 일정이 두 개가 된다
    onSuccess: (created) =>
      add.submit({
        planId: created.planId,
        // 새 일정이라 항상 1일차이고 그 일자는 비어 있다
        day: 1,
        dayItems: [],
        planTitle: created.title,
      }),
  })

  return (
    <div className="px-4 pb-4">
      <p className="text-body-2 text-fg-muted pb-4 break-keep">
        {messages.plan.addToPlanCreateHint.replace(
          '{title}',
          withTopicParticle(`${course.courseLabel} ${course.name}`),
        )}
      </p>

      <FormAlert message={add.error} />

      <PlanCreateForm
        values={form.values}
        errors={form.errors}
        pets={pets}
        // 만들기와 담기가 이어져 있어 담는 중에도 제출을 잠근다
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
 * 담기 저장 — 두 갈래가 같은 훅을 쓴다.
 *
 * **낙관적 업데이트를 하지 않는다.** `planItemId` 를 서버가 새로 발급하고 `PLAN_004`
 * 처럼 재시도로 풀리지 않는 실패가 있다 (`PlaceAddToPlanSheet` 와 같은 판단).
 */
function useAddWalkCourseToPlan({
  course,
  onAdded,
  onClose,
}: {
  course: WalkCourseAddTarget
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
    planTitle,
  }: {
    planId: string
    day: number
    /** 그 일자의 현재 항목 전부. 되싣지 않으면 일자가 비워진다 */
    dayItems: Parameters<typeof appendWalkCourseItemPayload>[0]
    /** 성공 토스트에 쓴다 — 코스 이름표만으로는 어느 일정에 담겼는지 알 수 없다 */
    planTitle: string
  }) => {
    if (pending) return
    setPending(true)
    setError(null)

    const title = `${course.courseLabel} ${course.name}`

    // `.then(onSuccess, onError)` 2인자다 — 성공 후처리의 예외가 저장 실패로 분류되면 안 된다
    void replaceDayItems(
      planId,
      day,
      appendWalkCourseItemPayload(dayItems, day, { walkCourseId: course.walkCourseId, title }),
    )
      .then(
        (next) => {
          queryClient.setQueryData(planKeys.detail(planId), next)
          void queryClient.invalidateQueries({ queryKey: planKeys.weather(planId) })
          void queryClient.invalidateQueries({ queryKey: planKeys.list() })

          showToast({
            message: walkCourseAddToastMessage(course.courseLabel, planTitle, day),
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
              retriable: messages.plan.walkAddErrorDescription,
              missingPlace: messages.plan.walkAddMissingPlaceError,
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
 * **`totalDays` 가 일자 수를 정한다** — 항목 배열에서 유추하지 않는다.
 *
 * **`already` 인 옵션에 `disabled` 도 함께 켠다** (`올레담기-세부명세.md` D3-2). 서버는
 * 같은 코스가 같은 일자에 두 번 담기는 것을 막지 않으므로, 화면이 먼저 막는다 — 장소
 * 담기(#82)와 달리 왕복 산책처럼 "다른 날 또 담기" 를 열어 둘 이유가 이 이슈 범위에서는
 * 없다고 판단했다(D8-3).
 */
export function toWalkCourseDayOptions(
  detail: PlanDetail | undefined,
  walkCourseId: string,
): AddToPlanDayOption[] {
  if (detail === undefined) return []

  const { days } = groupItemsByDay(detail.items, detail.totalDays)

  return days.map((group) => {
    const already = walkCourseIdsOf(group.items).has(walkCourseId)

    return {
      day: group.day,
      date: addPlanDays(detail.startDate, group.day - 1),
      itemCount: group.items.length,
      already,
      disabled: already,
    }
  })
}

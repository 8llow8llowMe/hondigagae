'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { ButtonLink } from '@/components/button'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { Skeleton } from '@/components/skeleton'
import { AiPlanCreateForm } from '@/features/ai-plan/ai-plan-create-form'
import { AiPlanPlacePickerSheet } from '@/features/ai-plan/ai-plan-place-picker-sheet'
import { aiPlanFormSchema } from '@/features/ai-plan/schemas'
import { useFavoriteList } from '@/features/favorite/use-favorite-list'
import { usePetList } from '@/features/pet/use-pet-list'
import { readAiPlanRequest, saveAiPlanRequest } from '@/lib/ai-plan/request-store'
import { MANWON, toAiPlanSubmitPayload } from '@/lib/ai-plan/submit'
import { submitAiPlan } from '@/lib/api/ai-plan'
import { useForm } from '@/lib/form/use-form'
import { messages } from '@/lib/messages'
import { totalDaysBetween } from '@/lib/plan/date'
import type { AiPlanFormValues, AiPlanSubmitResult, PinnedPlace } from '@/types/ai-plan'
import { EMPTY_AI_PLAN_FORM_VALUES } from '@/types/ai-plan'
import type { Pet } from '@/types/pet'

/**
 * 조건 입력 — 명세 S0 · 아트보드 01.
 *
 * **반려견 목록이 먼저다.** 화면이 반려견을 필수로 두므로 하나도 없으면 폼을 채울
 * 수 없다. 0마리면 폼 대신 등록으로 안내한다 (`PlanCreateView` 와 같은 구조).
 */
export function AiPlanCreateView({
  fromJobId,
  /** `'YYYY-MM-DD'`. 서버가 만들어 내려보낸 오늘 — 달력의 오늘 표시에 쓴다 */
  today,
}: {
  fromJobId: string | null
  today: string
}) {
  const petsQuery = usePetList(true)
  // `/ai-plans` 는 proxy.ts `PROTECTED_PATHS` 라 미로그인이 여기 닿지 않는다 (#200)

  if (petsQuery.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    )
  }

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
        title={messages.aiPlan.noPetTitle}
        description={messages.aiPlan.noPetDescription}
        action={<ButtonLink href="/pets/new">{messages.aiPlan.noPetAction}</ButtonLink>}
      />
    )
  }

  return <AiPlanCreateFormContainer pets={pets} fromJobId={fromJobId} today={today} />
}

/**
 * 폼 상태를 갖는 안쪽. **반려견을 다 받은 뒤에 마운트된다** — `useForm` 은 첫 렌더의
 * `initialValues` 만 취하므로, 조회 중에 만들면 한 마리뿐일 때의 미리 고르기가 영영
 * 반영되지 않는다 (`PlanCreateFormContainer` 와 같은 이유).
 */
function AiPlanCreateFormContainer({
  pets,
  fromJobId,
  today,
}: {
  pets: Pet[]
  fromJobId: string | null
  today: string
}) {
  const router = useRouter()

  /*
    **저장한 장소 개수만 쓴다** (#128). 목록 자체는 피커 시트가 열릴 때 같은 캐시에서
    읽는다 — 여기서 받아 두면 시트를 한 번도 열지 않는 대다수 경우에도 목록을 싣는다.
    `favoriteKeys.list()` 를 공유하므로 시트가 열릴 때 이미 채워져 있다.

    **조회 실패를 `0` 으로 접지 않는다.** `0` 은 토글을 비활성하는 값이라, 실패를 0 으로
    다루면 저장한 곳이 있는데도 못 켜는 화면이 된다.
  */
  const favoritesQuery = useFavoriteList()
  const favoriteCount = favoritesQuery.isError ? null : (favoritesQuery.data?.totalCount ?? null)

  const [pickerOpen, setPickerOpen] = useState(false)

  /*
    **실패 화면의 `조건 바꾸기` 를 위해 조건을 되살린다** (명세 S7 — "입력 조건은
    그대로 남기고"). `?from={jobId}` 로 오면 그 작업의 조건을 읽어 폼을 채운다.

    `useState` 의 지연 초기화로 읽는다 — 이 컴포넌트는 반려견 조회가 끝난 뒤에야
    마운트되므로 하이드레이션 이후에만 실행되고, 서버·클라이언트가 다른 값을 그릴
    일이 없다. 렌더 중에 `sessionStorage` 를 직접 보면 그 보장이 사라진다.
  */
  const [startValues] = useState<AiPlanFormValues>(() => restoreValues(fromJobId, pets))

  const form = useForm<AiPlanFormValues, AiPlanSubmitResult>({
    schema: aiPlanFormSchema,
    initialValues: startValues,
    onSubmit: (values) => submitAiPlan(toAiPlanSubmitPayload(values)),
    onSuccess: (result, values) => {
      /*
        **조건을 `jobId` 로 보관한다** (명세 S5 함정 1). 초안에는 반려견·기간·예산이
        없는데 담기(`POST /plans`)에는 필요하고, 작업 조회 응답에도 요청 조건이 없어
        `jobId` 로 되살릴 수 없다.

        저장 실패(용량 초과·프라이버시 모드)는 여기서 막지 않는다 — 제출은 이미
        접수됐고, 대기 화면이 조건 부재를 스스로 다룬다.
      */
      const payload = toAiPlanSubmitPayload(values)
      saveAiPlanRequest(result.jobId, {
        areaCode: payload.areaCode,
        startDate: payload.startDate,
        endDate: payload.endDate,
        pets: payload.petIds.map((petId) => ({
          petId,
          name: pets.find((pet) => pet.petId === petId)?.name ?? '',
        })),
        budget: payload.budget ?? null,
        requestNote: payload.requestNote ?? '',
        // 담기에는 쓰이지 않는다 — `조건 바꾸기` 가 폼을 되살릴 때만 쓴다 (#128)
        preferFavorites: values.preferFavorites,
        pinnedPlaces: values.pinnedPlaces,
      })

      /*
        **`replace` 다.** `push` 면 뒤로가기로 폼에 돌아와 같은 조건을 다시 제출하게
        된다 — 서버가 멱등해 같은 `jobId` 를 주므로 사고는 아니지만, 방금 만든 작업을
        보고 있다가 폼으로 되돌아가는 흐름 자체가 어긋난다.
      */
      router.replace(`/ai-plans/jobs/${result.jobId}`)
    },
  })

  function handleConfirmPicker(places: PinnedPlace[]) {
    form.setValue('pinnedPlaces', places)
    setPickerOpen(false)
  }

  return (
    <>
      <AiPlanCreateForm
        values={form.values}
        errors={form.errors}
        pets={pets}
        totalDays={totalDaysBetween(form.values.startDate, form.values.endDate)}
        submitting={form.isSubmitting}
        submitCount={form.submitCount}
        firstErrorField={form.firstErrorField}
        favoriteCount={favoriteCount}
        today={today}
        onValueChange={form.setValue}
        onOpenPlacePicker={() => setPickerOpen(true)}
        onSubmit={() => void form.submit()}
      />

      <AiPlanPlacePickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selected={form.values.pinnedPlaces}
        onConfirm={handleConfirmPicker}
      />
    </>
  )
}

/**
 * 원 단위 예산 → 만원 단위 폼 값.
 *
 * **만원 배수가 아니면 비운다.** `205_000 / 10_000` 은 `"20.5"` 인데 스키마가 `/^\d+$/`
 * 로 막아, 사용자가 고치기 전까지 제출이 불가능한 폼이 된다.
 */
function toBudgetManwon(budget: number | null): string {
  if (budget === null || budget <= 0) return ''
  if (budget % MANWON !== 0) return ''

  return String(budget / MANWON)
}

/**
 * `?from={jobId}` 의 조건을 폼 값으로. 없으면 기본값이다.
 *
 * **저장된 반려견이 지금 목록에 없으면 걸러 낸다** — 그 사이 삭제했을 수 있고,
 * 없는 아이가 선택된 채로 남으면 제출이 서버에서 막힌다. 전부 사라졌으면 기본값으로
 * 떨어진다.
 */
function restoreValues(fromJobId: string | null, pets: Pet[]): AiPlanFormValues {
  const base: AiPlanFormValues = {
    ...EMPTY_AI_PLAN_FORM_VALUES,
    // 한 마리뿐이면 미리 고른다 — 고를 것이 없는 그룹을 비워 두지 않는다
    petIds: pets.length === 1 ? [pets[0]?.petId ?? ''].filter((petId) => petId !== '') : [],
  }

  if (fromJobId === null) return base

  const snapshot = readAiPlanRequest(fromJobId)
  if (snapshot === null) return base

  const knownPetIds = snapshot.pets
    .map((pet) => pet.petId)
    .filter((petId) => pets.some((pet) => pet.petId === petId))

  return {
    requestNote: snapshot.requestNote,
    startDate: snapshot.startDate,
    endDate: snapshot.endDate,
    petIds: knownPetIds.length > 0 ? knownPetIds : base.petIds,
    budgetManwon: toBudgetManwon(snapshot.budget),
    /*
      **앞 형식으로 저장된 값에는 이 둘이 없다** (선택 필드로 둔 이유). 열어 둔 탭에
      남은 조건을 되살릴 때 `undefined` 가 폼 값으로 흘러들면 체크박스가 uncontrolled
      로 떨어지므로 기본값으로 접는다.
    */
    preferFavorites: snapshot.preferFavorites ?? false,
    pinnedPlaces: snapshot.pinnedPlaces ?? [],
  }
}

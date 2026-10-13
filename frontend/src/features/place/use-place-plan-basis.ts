'use client'

import { useSearchParams } from 'next/navigation'

import { usePetList } from '@/features/pet/use-pet-list'
import { usePlanDetail, usePlanWeather } from '@/features/plan/use-plan-detail'
import {
  parsePlanContext,
  type PlanBasisState,
  planBasisState,
  weatherBasisPetIdOf,
} from '@/lib/place/plan-context'

/**
 * 장소 상세가 **일정에서 들어왔을 때의 판정 기준** (#1429 · 장소상세-세부명세 D1-5).
 *
 * `?plan=&day=` 가 있으면 그 일정 · 일차의 반려견과 날짜를 고른다. 판단은 전부
 * `lib/place/plan-context.ts` 의 순수 함수가 하고, 여기는 조회만 묶는다.
 *
 * **key 를 일정 상세 화면과 공유한다** (`planKeys.detail` · `planKeys.weather` · `petKeys.list`) —
 * 일정 상세에서 항목을 누르고 들어오면 셋 다 캐시에 있어 요청이 나가지 않는다.
 *
 * `today` 는 서버 페이지가 내려준 오늘이다 — 지난 여행일을 가른다(#1476).
 *
 * **미로그인이면 부르지 않는다** — 일정은 보호 리소스라 403 이 정해져 있다. 그때는 `none`
 * (지금 동작)이다. 공유받은 링크를 다른 사람이 열어도 같은 갈래로 물러선다.
 */
export function usePlacePlanBasis(authed: boolean, today: string): PlanBasisState {
  const searchParams = useSearchParams()
  const context = authed ? parsePlanContext(searchParams) : null
  const enabled = context !== null

  // 맥락이 없으면 꺼 둔다 — 빈 planId 로 key 만 자리를 채운다
  const plan = usePlanDetail(context?.planId ?? '', { enabled })
  const weather = usePlanWeather(context?.planId ?? '', { enabled })
  const pets = usePetList(authed)

  /*
    **일정 판정은 실패해도 기다리지 않는다** — 실패면 기준견 없이(`null`) 대표 반려견으로 간다.
    조회 중일 때만 `undefined` 로 기다린다.
  */
  const weatherBasisPetId = weatherBasisPetIdOf(
    { isError: weather.isError, days: weather.data?.days },
    context?.day,
  )

  return planBasisState({
    context,
    plan: { data: plan.data, pending: plan.isPending, failed: plan.isError },
    weatherBasisPetId,
    pets: { data: pets.data?.pets, pending: pets.isPending, failed: pets.isError },
    today,
  })
}

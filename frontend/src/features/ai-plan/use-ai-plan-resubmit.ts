'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { saveAiPlanRequest } from '@/lib/ai-plan/request-store'
import { submitAiPlan } from '@/lib/api/ai-plan'
import type { AiPlanRequestSnapshot } from '@/types/ai-plan'

/**
 * 보관한 조건으로 **새 작업을 제출한다** — 실패 화면과 취소 화면이 함께 쓴다 (#250).
 *
 * **재생성 API 가 아니라 `POST /ai-plans` 새 제출이다.** 서버가 멱등하지만 대상이 진행
 * 중인 작업일 때만 그렇고, 실패·취소된 작업은 진행 중이 아니므로 **새 `jobId` 가 나온다.**
 * 취소는 멱등 키를 함께 풀어 주므로(#250) 같은 조건이라도 취소된 잡을 되받지 않는다.
 *
 * **보관한 조건을 전부 싣는다** (#251). 실패 화면에서 옮겨 왔을 때는 `preferFavorites`·
 * `pinnedPlaceIds` 를 빠뜨리고 있었는데, 그러면 버튼이 말하는 "같은 조건" 이 사실이
 * 아니게 된다 — 꼭 넣으라고 고른 장소가 조용히 빠진 초안이 나온다. `sigunguCode` 를
 * 더하면서 셋을 함께 맞췄다.
 *
 * 그 셋이 새고 있었던 이유는 `readAiPlanRequest` 가 저장된 값에서 옮기지 않아서였다
 * (`request-store.ts` 의 `toSnapshot`). 거기가 원인이고 여기는 그 값을 쓰는 자리다.
 *
 * @returns `resubmit` 은 조건이 없으면 아무 일도 하지 않는다 — 호출부가 버튼을 감춘다
 */
export function useAiPlanResubmit(snapshot: AiPlanRequestSnapshot | null) {
  const router = useRouter()
  const [retrying, setRetrying] = useState(false)

  async function resubmit(): Promise<void> {
    if (snapshot === null) return

    setRetrying(true)
    try {
      const pinnedPlaceIds = (snapshot.pinnedPlaces ?? []).map((place) => place.placeId)

      const result = await submitAiPlan({
        areaCode: snapshot.areaCode,
        startDate: snapshot.startDate,
        endDate: snapshot.endDate,
        petIds: snapshot.pets.map((pet) => pet.petId),
        // 생략 규칙은 `toAiPlanSubmitPayload` 와 같아야 한다 — 두 경로가 다른 본문을 내면 안 된다
        ...(snapshot.sigunguCode === null || snapshot.sigunguCode === undefined
          ? {}
          : { sigunguCode: snapshot.sigunguCode }),
        ...(snapshot.budget === null ? {} : { budget: snapshot.budget }),
        ...(snapshot.requestNote === '' ? {} : { requestNote: snapshot.requestNote }),
        ...(snapshot.preferFavorites === true ? { preferFavorites: true } : {}),
        ...(pinnedPlaceIds.length === 0 ? {} : { pinnedPlaceIds }),
      })

      // 새 작업에도 같은 조건을 붙여 둔다 — 담기가 다시 필요하다
      saveAiPlanRequest(result.jobId, snapshot)

      router.replace(`/ai-plans/jobs/${result.jobId}`)
    } catch {
      // 제출 실패는 폼이 없어 필드에 붙일 수 없다. 버튼을 되살려 다시 누를 수 있게 한다
      setRetrying(false)
    }
  }

  return {
    retrying,
    /** 조건이 없으면 `null` — 누를 수 없는 버튼을 그리는 대신 갈래에서 뺀다 */
    resubmit: snapshot === null ? null : (): void => void resubmit(),
  }
}

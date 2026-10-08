'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { useToast } from '@/components/toast'
import { fallbackListHref, mapFailureMessage } from '@/lib/map/failure-fallback'
import type { MapSdkFailure } from '@/lib/map/sdk'

/**
 * 지도 SDK 가 실패하면 **그 화면의 목록 보기로 옮기고 토스트로 이유를 말한다** (#1289).
 *
 * - **`replace` 다.** `push` 면 뒤로 가기가 다시 실패하는 지도로 돌아가 같은 이동을 되풀이한다
 * - **토스트는 이동과 함께 한 번.** 말없이 목록으로 튕기면 `지도 보기` 가 고장 난 것처럼 읽힌다.
 *   토스트 공급자는 `(main)` 레이아웃에 있어 페이지가 바뀌어도 남는다
 * - **`지도 보기` 를 숨기지 않는다.** 쿼터 초과처럼 일시적인 실패가 있어, 다시 누르면 다시 시도한다
 *
 * 문구 · 주소 판단은 `lib/map/failure-fallback.ts` 가 한다 — 이 훅은 이동만 한다.
 */
export function useMapFailureFallback(failure: MapSdkFailure | null, listHref: string): void {
  const router = useRouter()
  const { showToast } = useToast()

  useEffect(() => {
    if (failure === null) return

    showToast({ message: mapFailureMessage(failure) })
    router.replace(fallbackListHref(listHref), { scroll: false })
    // 옮기면 지도 보기가 내려가 이 훅도 함께 사라진다 — 한 번의 실패에 한 번 옮긴다
  }, [failure, listHref, router, showToast])
}

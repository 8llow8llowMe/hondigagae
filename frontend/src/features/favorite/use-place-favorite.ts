'use client'

import { useCallback, useRef, useState } from 'react'

import { useQuery, useQueryClient } from '@tanstack/react-query'

import { useToast } from '@/components/toast'
import { FAVORITE_QUERY_OPTIONS, favoriteKeys } from '@/features/favorite/queries'
import { ApiError } from '@/lib/api/error'
import {
  addFavorite,
  FAVORITE_LIMIT_EXCEEDED_CODE,
  FAVORITE_MISSING_PLACE_CODE,
  fetchFavoriteList,
  MAX_FAVORITE_COUNT,
  removeFavorite,
} from '@/lib/api/favorite'
import { messages } from '@/lib/messages'

/**
 * 장소 하나의 저장 토글 — 아트보드 `혼디가개 장소 상세` 01·03 하단 바.
 *
 * **저장 여부를 목록에서 읽는다.** 백엔드에 단건 조회가 없고 저장·해제 응답에도 본문이
 * 없다(`Response<Void>`) — 상한이 100곳이라 목록 전량이 가볍고, 마이페이지의 저장 목록이
 * 생기면 같은 캐시를 그대로 쓴다.
 *
 * **미로그인이면 조회하지 않는다.** 401 이 뜨면 전역 재발급이 한 번 돌고 로그인으로
 * 튕기는데, 장소 상세는 미로그인에게도 열려 있는 화면이라 그러면 안 된다.
 *
 * **낙관적 업데이트를 하지 않는다.** 저장은 상한(`FAVORITE_002`)과 노출 불가 장소
 * (`FAVORITE_001`)로 실패할 수 있어, 아이콘을 먼저 채우면 실패했을 때 되돌려야 한다.
 * 대신 **연타를 ref 로 막는다** — API 는 멱등이지만 요청이 겹치면 무효화 순서가 꼬인다.
 */
export function usePlaceFavorite({ placeId, authed }: { placeId: string; authed: boolean }) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  const query = useQuery({
    queryKey: favoriteKeys.list(),
    queryFn: fetchFavoriteList,
    enabled: authed,
    staleTime: FAVORITE_QUERY_OPTIONS.staleTime,
    gcTime: FAVORITE_QUERY_OPTIONS.gcTime,
  })

  const [pending, setPending] = useState(false)
  /** 실패 문구. 토스트가 아니라 하단 바 위에 남긴다 — 되돌릴 것이 없는 알림이다 */
  const [error, setError] = useState<string | null>(null)
  // disabled 반영 전 빠른 연속 클릭을 막는다 (form-guide.md §6)
  const togglingRef = useRef(false)

  const saved = query.data?.places.some((place) => place.placeId === placeId) ?? false

  const toggle = useCallback(() => {
    if (togglingRef.current) return
    togglingRef.current = true
    setPending(true)
    setError(null)

    const next = !saved

    /*
      **`.then(onSuccess, onError)` 2인자 형태다.** `.then().catch()` 체인이면 성공
      후처리(무효화·토스트)에서 던진 예외가 저장 실패로 분류돼 **저장은 됐는데
      "저장하지 못했어요" 가 뜬다** (`use-plan-add-place.ts` 와 같은 이유).
    */
    void (next ? addFavorite(placeId) : removeFavorite(placeId))
      .then(
        () => {
          void queryClient.invalidateQueries({ queryKey: favoriteKeys.all })
          showToast({
            message: next ? messages.favorite.saveToast : messages.favorite.unsaveToast,
          })
        },
        (cause: unknown) => setError(toFavoriteErrorMessage(cause)),
      )
      .finally(() => {
        togglingRef.current = false
        setPending(false)
      })
  }, [placeId, saved, queryClient, showToast])

  return {
    saved,
    /** 저장 여부를 아직 모른다. 미로그인이면 조회하지 않으므로 false 다 */
    loading: authed && query.isPending,
    pending,
    error,
    toggle,
  }
}

/**
 * 저장 실패를 문구로 옮긴다.
 *
 * **재시도 여부를 따로 돌려주지 않는다.** 저장은 같은 버튼을 다시 누르는 것이 곧
 * 재시도라 별도 버튼을 두지 않는다 — 담기(`toPlanDaySaveError`)와 다른 점이다.
 */
function toFavoriteErrorMessage(cause: unknown): string {
  if (cause instanceof ApiError) {
    if (cause.resultCode === FAVORITE_LIMIT_EXCEEDED_CODE) {
      return messages.favorite.limitError.replace('{max}', String(MAX_FAVORITE_COUNT))
    }
    if (cause.resultCode === FAVORITE_MISSING_PLACE_CODE) {
      return messages.favorite.missingPlaceError
    }
  }

  return messages.favorite.errorDescription
}

'use client'

import { useCallback, useRef, useState } from 'react'

import { useQueryClient } from '@tanstack/react-query'

import { useToast } from '@/components/toast'
import { favoriteKeys } from '@/features/favorite/queries'
import { addFavorite, removeFavorite } from '@/lib/api/favorite'
import type { RetainedFavorite } from '@/lib/favorite/retain'
import { messages } from '@/lib/messages'
import type { FavoritePlaceItem } from '@/types/favorite'

/**
 * 목록에서의 저장 해제 — 아트보드 `혼디가개 저장한 장소` 01.
 *
 * **행이 즉시 사라지지 않는다.** 해제한 항목을 `retained` 에 **원래 자리와 함께** 붙잡아
 * 두고 아이콘만 빈 상태로 바꾼다 — 실수로 지운 것을 그 자리에서 되살릴 수 있게 하기
 * 위해서다 (아트보드 01 주석).
 *
 * **`unsaved` 집합만으로는 부족하다.** 해제 직후 `favoriteKeys.all` 을 무효화하면 서버
 * 목록이 그 항목을 빼고 오므로 행이 그냥 사라진다 — 브라우저에서 실제로 그렇게 됐다.
 * 그래서 항목 자체를 들고 있다가 `mergeRetainedFavorites` 로 되끼운다.
 *
 * **되돌리기(undo) 토스트를 붙이지 않는다.** 저장·해제가 멱등이라 같은 버튼을 다시 누르는
 * 것이 곧 되돌리기다 — 오버레이 규칙대로 undo 를 만들지 않는다.
 *
 * `use-place-favorite.ts` 와 합치지 않았다. 저쪽은 **한 장소의 토글**(저장 여부를 목록에서
 * 읽고 상한·노출불가 오류를 하단 바에 낸다)이고 이쪽은 **여러 행의 해제**다 — 실패 문구가
 * 행마다 따로 남아야 하고, 붙잡아 두기가 여기에만 있다.
 */
export function useFavoriteUnsave() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  /** 해제했지만 화면에 남겨 둔 행. 되살리거나 화면을 떠나면 사라진다 */
  const [retained, setRetained] = useState<ReadonlyMap<string, RetainedFavorite>>(new Map())
  const [pendingId, setPendingId] = useState<string | null>(null)
  /** 행별 실패 문구. 토스트로 내면 목록 아래에서 아무 일도 안 일어난 것처럼 보인다 */
  const [errors, setErrors] = useState<ReadonlyMap<string, string>>(new Map())

  // disabled 반영 전 빠른 연속 클릭을 막는다 (form-guide.md §6)
  const togglingRef = useRef(false)

  const toastFor = useCallback(
    (title: string | null, body: string) =>
      showToast({ message: title === null ? body : `${title} ${body}` }),
    [showToast],
  )

  const unsave = useCallback(
    (item: FavoritePlaceItem, index: number) => {
      if (togglingRef.current) return
      togglingRef.current = true
      setPendingId(item.placeId)
      setErrors((prev) => withoutKey(prev, item.placeId))

      /*
        **`.then(onSuccess, onError)` 2인자 형태다.** `.then().catch()` 체인이면 성공
        후처리(무효화·토스트)에서 던진 예외가 해제 실패로 분류돼 **해제는 됐는데
        "해제하지 못했어요" 가 뜬다** (`use-place-favorite.ts` 와 같은 이유).
      */
      void removeFavorite(item.placeId)
        .then(
          () => {
            setRetained((prev) => new Map(prev).set(item.placeId, { item, index }))
            void queryClient.invalidateQueries({ queryKey: favoriteKeys.all })
            toastFor(item.title, messages.favorite.unsaveToast)
          },
          () =>
            setErrors((prev) =>
              new Map(prev).set(item.placeId, messages.favorite.errorDescription),
            ),
        )
        .finally(() => {
          togglingRef.current = false
          setPendingId(null)
        })
    },
    [queryClient, toastFor],
  )

  /**
   * 되살리기. 붙잡아 둔 행의 버튼을 다시 누르면 저장으로 돌아간다.
   *
   * **`retained` 에서 빼는 것만으로는 거짓말이 된다** — 서버에서는 이미 지워졌다.
   * 실제로 다시 저장하고, 성공한 뒤에 뺀다.
   */
  const restore = useCallback(
    (item: FavoritePlaceItem) => {
      if (togglingRef.current) return
      togglingRef.current = true
      setPendingId(item.placeId)
      setErrors((prev) => withoutKey(prev, item.placeId))

      void addFavorite(item.placeId)
        .then(
          () => {
            setRetained((prev) => withoutKey(prev, item.placeId))
            void queryClient.invalidateQueries({ queryKey: favoriteKeys.all })
            toastFor(item.title, messages.favorite.saveToast)
          },
          () =>
            setErrors((prev) =>
              new Map(prev).set(item.placeId, messages.favorite.errorDescription),
            ),
        )
        .finally(() => {
          togglingRef.current = false
          setPendingId(null)
        })
    },
    [queryClient, toastFor],
  )

  return { retained, pendingId, errors, unsave, restore }
}

function withoutKey<V>(map: ReadonlyMap<string, V>, key: string): ReadonlyMap<string, V> {
  const next = new Map(map)
  next.delete(key)
  return next
}

'use client'

import { useMemo } from 'react'

import { FavoriteListSection } from '@/features/favorite/favorite-list-section'
import { useFavoriteList } from '@/features/favorite/use-favorite-list'
import { useFavoriteUnsave } from '@/features/favorite/use-favorite-unsave'
import { toErrorStatus } from '@/lib/api/error'
import { mergeRetainedFavorites } from '@/lib/favorite/retain'
import type { FavoritePlaceItem } from '@/types/favorite'

/** 조회·해제 상태를 presentational 컴포넌트가 쓰는 props 로 변환한다 */
export function FavoriteListView() {
  const query = useFavoriteList()
  const { retained, pendingId, errors, unsave, restore } = useFavoriteUnsave()

  const places = query.data?.places

  /**
   * **해제한 행을 원래 자리에 되끼운다.** 무효화가 돌면 서버 목록에서 빠지는데, 그대로
   * 그리면 행이 즉시 사라져 "그 자리에서 되살리기" 가 불가능해진다 (명세 D4).
   */
  const displayPlaces = useMemo(
    () => mergeRetainedFavorites(places ?? [], retained),
    [places, retained],
  )

  /**
   * 같은 버튼이 해제와 되살리기를 겸한다 — 저장·해제가 멱등이라 다시 누르는 것이 곧
   * 되돌리기다 (명세 D4). 그래서 `undo` 토스트를 붙이지 않는다.
   */
  function handleToggle(item: FavoritePlaceItem, index: number) {
    if (retained.has(item.placeId)) {
      restore(item)
      return
    }
    unsave(item, index)
  }

  return (
    <FavoriteListSection
      places={displayPlaces}
      /*
        **서버가 센 개수를 그대로 쓴다.** 붙잡아 둔 행은 실제로 저장돼 있지 않으므로
        `12/100` 에 포함하면 거짓말이 된다 — 행은 남아도 카운트는 줄어드는 것이 맞다.
      */
      totalCount={query.data?.totalCount ?? 0}
      loading={query.isPending}
      errorStatus={toErrorStatus(query.error)}
      unsaved={new Set(retained.keys())}
      pendingId={pendingId}
      errors={errors}
      onRetry={() => void query.refetch()}
      onToggle={handleToggle}
    />
  )
}

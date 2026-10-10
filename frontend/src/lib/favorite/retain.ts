import type { FavoritePlaceItem } from '@/types/favorite'

/**
 * 해제했지만 화면에 붙잡아 둔 행 — 아트보드 `혼디가개 저장한 장소` 01.
 *
 * 왜 필요한가: 해제 직후 `favoriteKeys.all` 을 무효화하면 서버 목록이 그 항목을 **빼고**
 * 온다. 그대로 그리면 행이 즉시 사라져 "실수로 지운 걸 그 자리에서 되살릴 수 있게" 라는
 * 아트보드 요구가 깨진다. 실제로 그렇게 만들었다가 브라우저에서 사라지는 것을 봤다.
 *
 * 무효화를 미루는 방법도 있지만 그러면 **장소 상세의 저장 아이콘이 옛 상태로 남는다** —
 * 두 화면이 같은 캐시를 보는 것이 이 기능의 전제다 (명세 D3).
 */
export type RetainedFavorite = {
  item: FavoritePlaceItem
  /** 해제하던 순간의 목록 위치. 되살리기 전까지 그 자리를 지킨다 */
  index: number
}

/**
 * 서버 목록에 붙잡아 둔 행을 원래 자리로 되끼운다.
 *
 * **`index` 순서로 넣는다.** 작은 index 부터 넣지 않으면 앞에 삽입된 항목 때문에 뒤
 * 항목의 자리가 밀린다.
 *
 * 서버 목록에 이미 있는 placeId 는 건너뛴다 — 되살리기 성공 후 무효화가 돌아 서버가 다시
 * 내려준 순간에 `retained` 정리보다 렌더가 먼저 오면 **같은 행이 두 번 그려진다.**
 */
export function mergeRetainedFavorites(
  places: readonly FavoritePlaceItem[],
  retained: ReadonlyMap<string, RetainedFavorite>,
): FavoritePlaceItem[] {
  if (retained.size === 0) return [...places]

  const present = new Set(places.map((place) => place.placeId))
  const merged = [...places]

  const pending = [...retained.values()]
    .filter((entry) => !present.has(entry.item.placeId))
    .sort((a, b) => a.index - b.index)

  for (const entry of pending) {
    // 목록이 그동안 짧아졌을 수 있다. 범위를 넘으면 끝에 붙인다
    const at = Math.min(entry.index, merged.length)
    merged.splice(at, 0, entry.item)
  }

  return merged
}

import { describe, expect, it } from 'vitest'

import { mergeRetainedFavorites, type RetainedFavorite } from '@/lib/favorite/retain'
import { favoritePlaceItem } from '@/test/fixtures/favorite'

const a = favoritePlaceItem({ placeId: 'a', title: '협재해수욕장' })
const b = favoritePlaceItem({ placeId: 'b', title: '제주현대미술관' })
const c = favoritePlaceItem({ placeId: 'c', title: '한담해안산책로' })

function retain(...entries: RetainedFavorite[]): ReadonlyMap<string, RetainedFavorite> {
  return new Map(entries.map((entry) => [entry.item.placeId, entry]))
}

describe('mergeRetainedFavorites — 해제한 행을 자리에 붙잡아 둔다 (명세 D4)', () => {
  it('붙잡아 둔 것이 없으면 서버 목록 그대로다', () => {
    expect(mergeRetainedFavorites([a, b], new Map())).toEqual([a, b])
  })

  it('무효화로 서버에서 빠진 행을 원래 자리에 되끼운다', () => {
    // 서버는 b 를 뺀 목록을 준다. 그래도 화면에서는 b 가 가운데 남아야 한다
    const merged = mergeRetainedFavorites([a, c], retain({ item: b, index: 1 }))

    expect(merged.map((item) => item.placeId)).toEqual(['a', 'b', 'c'])
  })

  it('첫 자리도 지킨다', () => {
    const merged = mergeRetainedFavorites([b, c], retain({ item: a, index: 0 }))

    expect(merged.map((item) => item.placeId)).toEqual(['a', 'b', 'c'])
  })

  it('여러 개를 붙잡아도 서로 자리를 밀지 않는다 — index 순으로 넣는다', () => {
    const merged = mergeRetainedFavorites([b], retain({ item: c, index: 2 }, { item: a, index: 0 }))

    expect(merged.map((item) => item.placeId)).toEqual(['a', 'b', 'c'])
  })

  it('서버가 이미 돌려준 행은 중복해서 넣지 않는다', () => {
    /*
      되살리기 성공 후 무효화가 돌아 서버가 다시 내려준 순간, `retained` 정리보다 렌더가
      먼저 오면 같은 행이 두 번 그려진다. 그 창을 막는다.
    */
    const merged = mergeRetainedFavorites([a, b], retain({ item: b, index: 1 }))

    expect(merged.map((item) => item.placeId)).toEqual(['a', 'b'])
  })

  it('목록이 그동안 짧아졌으면 끝에 붙인다 — splice 범위를 넘지 않는다', () => {
    const merged = mergeRetainedFavorites([], retain({ item: a, index: 5 }))

    expect(merged.map((item) => item.placeId)).toEqual(['a'])
  })

  it('원본 배열을 건드리지 않는다', () => {
    const places = [a, c]
    mergeRetainedFavorites(places, retain({ item: b, index: 1 }))

    expect(places).toEqual([a, c])
  })
})

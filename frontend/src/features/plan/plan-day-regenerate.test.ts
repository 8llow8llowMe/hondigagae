import { describe, expect, it } from 'vitest'

import { toDiffRows, toNextDiffRows } from '@/features/plan/plan-day-regenerate-view'
import type { PlanItemDetail, PlanItemRequest } from '@/types/plan'

const saved = [
  {
    planItemId: '1',
    day: 1,
    sequence: 0,
    itemType: { code: 'PLACE', name: '장소', description: null },
    targetId: '111',
    title: '제주특별자치도립김창열미술관',
    memo: null,
    startTime: null,
    visited: true,
    place: { placeId: '111', title: '제주특별자치도립김창열미술관', addr1: '제주시 한림읍' },
  },
] as unknown as PlanItemDetail[]

const next: PlanItemRequest[] = [
  { day: 1, sequence: 0, itemType: 'PLACE', targetId: '222', title: '오설록 티뮤지엄 카페' },
  { day: 1, sequence: 1, itemType: 'WALK', title: '사려니숲길 산책', memo: '그늘이 많아요' },
]

describe('toDiffRows — 저장된 항목', () => {
  it('제목과 주소를 옮긴다', () => {
    expect(toDiffRows(saved)).toEqual([
      { title: '제주특별자치도립김창열미술관', caption: '제주시 한림읍' },
    ])
  })

  it('빈 목록은 빈 목록이다', () => {
    expect(toDiffRows([])).toEqual([])
  })
})

describe('toNextDiffRows — 새 초안 항목', () => {
  /*
    새 항목에는 아직 장소 요약이 없다 — 보내기 전이라 서버가 채워 주지 않았다.
    **주소를 지어내지 않는다.** 메모가 있으면 그것을 쓰고 없으면 비운다.
  */
  it('메모가 있으면 caption 으로 쓴다', () => {
    expect(toNextDiffRows(next)[1]).toEqual({
      title: '사려니숲길 산책',
      caption: '그늘이 많아요',
    })
  })

  it('메모가 없으면 caption 이 null 이다', () => {
    expect(toNextDiffRows(next)[0]?.caption).toBeNull()
  })
})

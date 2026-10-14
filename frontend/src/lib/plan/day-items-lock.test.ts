import { describe, expect, it } from 'vitest'

import { dayItemsLock, dayItemsSaveLocks } from '@/lib/plan/day-items-lock'

/**
 * 일정 상세 일괄 교체 잠금 — 이슈 #1488 · `일정상세-세부명세.md` D30-4.
 *
 * 저장(담기 · 이동 추가 · 시각 · 메모)은 일정 전체에서 하나씩, 편집 **진입**은 같은 일자만 막는다.
 */
describe('dayItemsLock', () => {
  it('도는 저장이 없으면 아무것도 막지 않는다', () => {
    const lock = dayItemsLock([
      { saving: false, day: null },
      { saving: false, day: 2 },
    ])

    expect(lock.busy).toBe(false)
    expect(lock.blocksEntry(1)).toBe(false)
    expect(lock.blocksEntry(2)).toBe(false)
  })

  it('저장이 하나라도 돌면 busy 다 — 다른 일자 저장도 막는다', () => {
    expect(dayItemsLock([{ saving: true, day: 2 }]).busy).toBe(true)
  })

  it('편집 진입은 저장이 도는 그 일자만 막는다', () => {
    const lock = dayItemsLock([
      { saving: false, day: 1 },
      { saving: true, day: 2 },
    ])

    expect(lock.blocksEntry(2)).toBe(true)
    expect(lock.blocksEntry(1)).toBe(false)
    expect(lock.blocksEntry(3)).toBe(false)
  })

  it('저장 중인데 일자를 모르면 모든 일자의 진입을 막는다', () => {
    const lock = dayItemsLock([{ saving: true, day: null }])

    expect(lock.blocksEntry(1)).toBe(true)
    expect(lock.blocksEntry(2)).toBe(true)
  })
})

// 시각 저장(#1501) · 메모 저장(#1505)이 상한에서 모달을 닫은 뒤에도 재조회 일자를 남긴다
describe('dayItemsSaveLocks', () => {
  it('저장 중이면 모달의 일자를 잠근다', () => {
    expect(dayItemsSaveLocks({ saving: true, day: 2, refetchingDays: [] })).toEqual([
      { saving: true, day: 2 },
    ])
  })

  it('저장이 끝나도 재조회 중인 일자는 잠금에 남는다', () => {
    const lock = dayItemsLock(dayItemsSaveLocks({ saving: false, day: null, refetchingDays: [3] }))

    expect(lock.busy).toBe(true)
    expect(lock.blocksEntry(3)).toBe(true)
    expect(lock.blocksEntry(1)).toBe(false)
  })

  it('저장 · 재조회가 없으면 잠그지 않는다', () => {
    expect(
      dayItemsLock(dayItemsSaveLocks({ saving: false, day: null, refetchingDays: [] })).busy,
    ).toBe(false)
  })
})

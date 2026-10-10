import { describe, expect, it } from 'vitest'

import { isPinnable, MAX_PINNED_PLACES, togglePinnedPlace } from '@/lib/ai-plan/pinned'
import type { PinnedPlace } from '@/types/ai-plan'

function place(placeId: string): PinnedPlace {
  return { placeId, title: `장소 ${placeId}` }
}

function full(): PinnedPlace[] {
  return Array.from({ length: MAX_PINNED_PLACES }, (_, index) => place(String(index + 1)))
}

describe('togglePinnedPlace — 상한 (아트보드 05 · 계약 @Size(max = 10))', () => {
  it('없으면 더한다', () => {
    expect(togglePinnedPlace([], place('1'))).toEqual([place('1')])
  })

  it('있으면 뺀다', () => {
    expect(togglePinnedPlace([place('1'), place('2')], place('1'))).toEqual([place('2')])
  })

  it('10곳을 채우면 더 더하지 않는다', () => {
    const places = full()

    expect(togglePinnedPlace(places, place('99'))).toHaveLength(MAX_PINNED_PLACES)
    expect(togglePinnedPlace(places, place('99'))).toEqual(places)
  })

  it('**10곳을 채운 뒤에도 해제는 된다** — 막으면 바꿀 길이 없어진다', () => {
    const places = full()
    const next = togglePinnedPlace(places, place('1'))

    expect(next).toHaveLength(MAX_PINNED_PLACES - 1)
    expect(next.some((item) => item.placeId === '1')).toBe(false)
  })

  it('순서를 지킨다 — 고른 순서가 칩 순서다', () => {
    const next = togglePinnedPlace([place('1'), place('2')], place('3'))

    expect(next.map((item) => item.placeId)).toEqual(['1', '2', '3'])
  })

  it('원본 배열을 건드리지 않는다', () => {
    const places = [place('1')]
    togglePinnedPlace(places, place('2'))

    expect(places).toEqual([place('1')])
  })
})

describe('isPinnable — 요약 없는 장소는 후보로 넘길 수 없다 (아트보드 05)', () => {
  it('이름이 있으면 고를 수 있다', () => {
    expect(isPinnable('협재해수욕장')).toBe(true)
  })

  it('null 은 고를 수 없다 — tour-service 조회 실패다', () => {
    expect(isPinnable(null)).toBe(false)
  })

  it('공백만 남은 이름도 고를 수 없다', () => {
    expect(isPinnable('   ')).toBe(false)
  })
})

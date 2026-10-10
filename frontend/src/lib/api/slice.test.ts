import { describe, expect, it } from 'vitest'

import { hasMore, mergeSlices } from '@/lib/api/slice'

describe('mergeSlices', () => {
  it('여러 페이지의 contents 를 순서대로 합친다', () => {
    const pages = [
      { contents: ['a', 'b'], hasNext: true },
      { contents: ['c'], hasNext: false },
    ]
    expect(mergeSlices(pages)).toEqual(['a', 'b', 'c'])
  })

  it('빈 페이지 목록에서 빈 배열을 반환한다', () => {
    expect(mergeSlices([])).toEqual([])
  })

  it('결과가 0건인 페이지도 오류 없이 합친다', () => {
    expect(mergeSlices([{ contents: [], hasNext: false }])).toEqual([])
  })
})

describe('hasMore', () => {
  it('마지막 페이지의 hasNext 를 기준으로 판정한다', () => {
    const pages = [
      { contents: ['a'], hasNext: true },
      { contents: ['b'], hasNext: false },
    ]
    expect(hasMore(pages)).toBe(false)
  })

  it('마지막 페이지에 다음이 있으면 true 를 반환한다', () => {
    expect(hasMore([{ contents: ['a'], hasNext: true }])).toBe(true)
  })

  it('페이지가 없으면 false 를 반환한다', () => {
    expect(hasMore([])).toBe(false)
  })
})

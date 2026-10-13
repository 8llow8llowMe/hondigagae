import { describe, expect, it } from 'vitest'

import { insightKeys } from '@/lib/insight/queries'

/*
  일정 기준 날짜(#1429 · #1450)는 key 끝에 붙는다. 없으면 모양이 그대로라 홈과 캐시를 계속
  공유하고, 있으면 다른 날의 답이라 섞이지 않는다.
*/
describe('insightKeys — 일정 기준 날짜', () => {
  it('적합도 key 는 날짜가 없으면 홈과 같은 모양이다', () => {
    expect(insightKeys.suitability('123', 'c')).toEqual(['insight', 'suitability', '123', 'c'])
    expect(insightKeys.suitability('123', 'c', null)).toEqual(insightKeys.suitability('123', 'c'))
  })

  it('적합도 key 는 날짜가 다르면 갈린다', () => {
    expect(insightKeys.suitability('123', 'c', '2026-11-06')).toEqual([
      'insight',
      'suitability',
      '123',
      'c',
      '2026-11-06',
    ])
    expect(insightKeys.suitability('123', 'c', '2026-11-06')).not.toEqual(
      insightKeys.suitability('123', 'c', '2026-11-07'),
    )
  })

  it('산책 위험도 key 도 같은 규칙이다', () => {
    expect(insightKeys.walkSafety('123', 'c')).toEqual(['insight', 'walk-safety', '123', 'c'])
    expect(insightKeys.walkSafety('123', 'c', '2026-11-06')).toEqual([
      'insight',
      'walk-safety',
      '123',
      'c',
      '2026-11-06',
    ])
  })
})

import { describe, expect, it } from 'vitest'

import { isNarrowedRegionFailure, NO_PLACE_CANDIDATES } from '@/lib/ai-plan/failure-hint'

describe('isNarrowedRegionFailure (#251)', () => {
  it('지역을 좁힌 채 AIPLAN_012 로 실패하면 단서를 붙인다', () => {
    expect(isNarrowedRegionFailure(NO_PLACE_CANDIDATES, '4')).toBe(true)
  })

  /*
    **좁히지 않았으면 붙이지 않는다.** 제주 전체로 만들다 실패한 사람에게 "지역을 넓혀
    보세요" 는 할 수 없는 일을 시키는 것이고, 그 순간 다른 안내까지 흘려 읽게 된다.
  */
  it('제주 전체였으면 붙이지 않는다', () => {
    expect(isNarrowedRegionFailure(NO_PLACE_CANDIDATES, null)).toBe(false)
    expect(isNarrowedRegionFailure(NO_PLACE_CANDIDATES, '')).toBe(false)
    expect(isNarrowedRegionFailure(NO_PLACE_CANDIDATES, undefined)).toBe(false)
  })

  /** 기간·예산 문제에 지역을 권하면 원인을 잘못 짚는다 */
  it('다른 실패 코드에는 붙이지 않는다', () => {
    expect(isNarrowedRegionFailure('AIPLAN_005', '4')).toBe(false)
    expect(isNarrowedRegionFailure(null, '4')).toBe(false)
  })

  /** 백엔드 `AiPlanErrorCode.NO_PLACE_CANDIDATES` 복제본 — 한 글자만 달라도 단서가 죽는다 */
  it('코드가 백엔드와 같다', () => {
    expect(NO_PLACE_CANDIDATES).toBe('AIPLAN_012')
  })
})

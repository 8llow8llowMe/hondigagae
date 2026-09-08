import { describe, expect, it } from 'vitest'

import { CONTENT_TYPE_FILTER_ORDER, CONTENT_TYPE_LABEL } from '@/features/place/filter-labels'
import { CONTENT_TYPE_CODES } from '@/types/place'

/**
 * 화면 순서(`CONTENT_TYPE_FILTER_ORDER`)와 계약 순서(`CONTENT_TYPE_CODES`)를 **일부러
 * 갈라 뒀다.** 그래서 백엔드에 enum 값이 하나 추가되면 화면 목록에서 **조용히 빠진다** —
 * 라벨 표만 채우고 순서 배열을 잊는 것이 그 사고의 경로다. 여기서 잡는다.
 */
describe('유형 필터 표시 순서', () => {
  it('계약의 모든 코드를 정확히 한 번씩 담는다', () => {
    expect([...CONTENT_TYPE_FILTER_ORDER].sort()).toEqual([...CONTENT_TYPE_CODES].sort())
  })

  it('모든 코드에 라벨이 있다', () => {
    for (const code of CONTENT_TYPE_FILTER_ORDER) {
      expect(CONTENT_TYPE_LABEL[code]).toBeTruthy()
    }
  })

  it('갈 곳 → 먹을 곳 → 잘 곳 순이다 — 지도 필터 줄에서 앞 셋만 스크롤 없이 보인다', () => {
    expect(CONTENT_TYPE_FILTER_ORDER.slice(0, 3)).toEqual(['TOURIST_SPOT', 'RESTAURANT', 'LODGING'])
  })
})

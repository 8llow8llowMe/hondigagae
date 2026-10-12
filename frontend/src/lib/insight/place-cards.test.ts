import { describe, expect, it } from 'vitest'

import { crowdedLabel, pickCardReason } from '@/lib/insight/place-cards'
import type { CongestionItem, SuitabilityReasonItem } from '@/types/insight'

function reason(code: string, scoreDelta: number): SuitabilityReasonItem {
  return { code, name: code, description: `${code} 설명`, scoreDelta }
}

function congestion(code: string, name: string): CongestionItem {
  return { level: { code, name, description: null }, concentrationRate: null }
}

/*
  #1069 — 데스크톱 카드마다 **그 장소만의 근거 한 줄.** 공통 근거는 이미 호출부가 걷어 냈고
  (`splitSharedReasons`), 여기서는 남은 것 중 영향이 큰 하나를 고른다.
*/
describe('pickCardReason', () => {
  it('감점이 정보성보다 먼저다 — 서버가 정보성을 앞에 보내도', () => {
    expect(pickCardReason([reason('PET_ALLOWED', 0), reason('HEAT_RISK', -12)])?.code).toBe(
      'HEAT_RISK',
    )
  })

  /* 서버 순서가 곧 영향 순서다 — 감점끼리 크기로 다시 세우지 않는다 */
  it('감점 안에서는 서버 순서를 지킨다', () => {
    expect(pickCardReason([reason('RAIN', -5), reason('HEAT_RISK', -27)])?.code).toBe('RAIN')
  })

  it('감점이 없으면 첫 정보성 문장이다', () => {
    expect(pickCardReason([reason('PET_ALLOWED', 0), reason('INDOOR', 0)])?.code).toBe(
      'PET_ALLOWED',
    )
  })

  /* 경보 날에는 근거가 전부 공통이라 걷고 나면 비어 있다 — 그때 카드에 줄이 없다 */
  it('남은 근거가 없으면 null 이다', () => {
    expect(pickCardReason([])).toBeNull()
  })
})

/*
  판정 줄의 `· 혼잡` 은 **혼잡할 때만** 붙는다. 한산·보통·정보 없음은 카드에서 말하지 않는다.
*/
describe('crowdedLabel', () => {
  it('HIGH 면 서버 문구 그대로다', () => {
    expect(crowdedLabel(congestion('HIGH', '혼잡'))).toBe('혼잡')
  })

  /* 문구가 아니라 code 로 가른다 — 서버 문구는 언제든 바뀐다 */
  it('문구가 아니라 code 로 가른다', () => {
    expect(crowdedLabel(congestion('HIGH', '매우 붐빔'))).toBe('매우 붐빔')
    expect(crowdedLabel(congestion('MODERATE', '혼잡'))).toBeNull()
  })

  it.each(['LOW', 'MODERATE', 'UNKNOWN'])('%s 는 그리지 않는다', (code) => {
    expect(crowdedLabel(congestion(code, code))).toBeNull()
  })

  it('congestion 이 null 이면 그리지 않는다', () => {
    expect(crowdedLabel(null)).toBeNull()
  })
})

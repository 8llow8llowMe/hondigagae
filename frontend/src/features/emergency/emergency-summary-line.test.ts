import { describe, expect, it } from 'vitest'

import {
  emergencyBasisLabel,
  emergencyHeadSubtitle,
} from '@/features/emergency/emergency-summary-line'
import { messages } from '@/lib/messages'
import { facility, facilityResult } from '@/test/fixtures/emergency'
/*
  **기준 문구를 한 곳에 모았다** (#639). 예전에는 목록이 두 갈래, 지도가 세 갈래를 각자
  인라인으로 갖고 있어 `region` 이 늘었을 때 한쪽만 고쳐질 자리였다.
*/
describe('emergencyBasisLabel — 무엇을 기준으로 잰 거리인가 (#639)', () => {
  it('네 갈래가 서로 다른 말을 한다', () => {
    expect(emergencyBasisLabel('current', null)).toBe(messages.emergency.basisCurrent)
    expect(emergencyBasisLabel('map', null)).toBe(messages.emergency.basisMap)
    expect(emergencyBasisLabel('jeju', null)).toBe(messages.emergency.basisJeju)
    expect(emergencyBasisLabel('region', 'SEOGWIPO')).toBe('서귀포 기준')
  })

  it('네 권역이 각자의 이름으로 불린다', () => {
    expect(emergencyBasisLabel('region', 'JEJU_CITY')).toBe('제주시 기준')
    expect(emergencyBasisLabel('region', 'EAST')).toBe('동부 기준')
    expect(emergencyBasisLabel('region', 'WEST')).toBe('서부 기준')
  })

  /* 만들어지지 않는 조합이지만 타입으로 못 박을 수 없다 — 거짓 라벨 대신 가장 약한 주장 */
  it('권역 기준인데 권역이 없으면 제주 중심으로 떨어진다', () => {
    expect(emergencyBasisLabel('region', null)).toBe(messages.emergency.basisJeju)
  })
})

describe('emergencyHeadSubtitle — 카드 부제 (#639)', () => {
  it('총계와 지금 진료중 수를 센다', () => {
    const line = emergencyHeadSubtitle(facilityResult())

    /* 기본 픽스처는 병원(진료중) · 약국(종료) 둘이다 */
    expect(line).toBe('제주 2곳 · 지금 진료중 1곳')
  })

  it('응답 전에는 그리지 않는다 — 숫자 없는 부제는 빈 말이다', () => {
    expect(emergencyHeadSubtitle(null)).toBeNull()
  })

  /*
    **잘린 목록에서는 침묵한다.** `totalCount` 자체는 참이지만 옆에 선 진료중 수가
    받아 온 것만 센 값이라, 한 줄로 묶이면 줄 전체가 거짓말이 된다.
  */
  it('목록이 잘렸으면 줄째로 감춘다 — 틀린 개수는 없는 개수보다 나쁘다', () => {
    const truncated = facilityResult({ totalCount: 136 })

    expect(emergencyHeadSubtitle(truncated)).toBeNull()
  })

  /* `openNow === null`(영업시간 미등록)은 진료중으로 세지 않는다 */
  it('영업 여부를 모르는 곳은 진료중에 넣지 않는다', () => {
    const result = facilityResult({ facilities: [facility({ openNow: null })] })

    expect(emergencyHeadSubtitle(result)).toBe('제주 1곳 · 지금 진료중 0곳')
  })
})

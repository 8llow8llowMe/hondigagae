import { describe, expect, it } from 'vitest'

import {
  emergencyBasisLabel,
  emergencyHeadSubtitle,
  emergencySummaryLine,
} from '@/features/emergency/emergency-summary-line'
import { messages } from '@/lib/messages'
import { facility, facilityResult } from '@/test/fixtures/emergency'
import { DEFAULT_FACILITY_FILTERS } from '@/types/emergency'

describe('emergencySummaryLine — 데스크톱 부제 (#419)', () => {
  it('조건이 없으면 반경만 말한다 — 빈 줄을 남기지 않는다', () => {
    const line = emergencySummaryLine(DEFAULT_FACILITY_FILTERS, 10000)

    expect(line).toContain('10.0km')
  })

  it('걸린 조건을 가운뎃점으로 잇는다', () => {
    const line = emergencySummaryLine(
      { ...DEFAULT_FACILITY_FILTERS, type: 'ANIMAL_HOSPITAL', openNowOnly: true },
      5000,
    )

    expect(line).toContain('병원')
    expect(line).toContain('5.0km')
    expect(line.split(' · ').length).toBe(3)
  })

  /*
    **검색어는 이 줄에 넣지 않는다** (#584). 이 부제는 데스크톱에서만 그려지는데, 바로
    아래 검색 입력이 같은 폭에서 그 글자를 이미 들고 있다 — 부제에 또 적으면 같은 말이
    두 번이다.

    **형제 화면과 반대 결정이라 잠근다.** `/places` 의 `filterSummaryLine` 은 `keyword` 를
    넣는데(거기는 검색 입력이 본문 열에 있고 부제는 레일 밖이다) 이쪽은 뺐다. 근거 없이
    둘을 맞추려는 변경이 조용히 들어오지 않게 여기서 막는다.
  */
  it('검색어가 걸려도 줄이 변하지 않는다', () => {
    const withKeyword = emergencySummaryLine(
      { ...DEFAULT_FACILITY_FILTERS, keyword: '한라' },
      10000,
    )

    expect(withKeyword).toBe(emergencySummaryLine(DEFAULT_FACILITY_FILTERS, 10000))
    expect(withKeyword).not.toContain('한라')
  })

  /*
    **반경은 항상 첫 자리다.** 이 화면에서 "무엇을 보고 있는가" 의 뼈대가 반경이고,
    조건은 그 안을 좁힌다. 순서가 조건에 따라 흔들리면 눈이 매번 다시 훑어야 한다.
  */
  it('반경이 항상 맨 앞에 온다', () => {
    const line = emergencySummaryLine({ ...DEFAULT_FACILITY_FILTERS, open24Only: true }, 20000)

    expect(line.startsWith('20.0km')).toBe(true)
  })
})

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

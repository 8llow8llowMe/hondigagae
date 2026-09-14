import { describe, expect, it } from 'vitest'

import { emergencySummaryLine } from '@/features/emergency/emergency-summary-line'
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

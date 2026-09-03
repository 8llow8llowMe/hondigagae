import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { WalkTimesSection } from '@/features/home/walk-times-section'
import { mockWalkTimes } from '@/lib/api/mock/insight-data'
import { messages } from '@/lib/messages'
import type { WalkTimesResponse } from '@/types/insight'

function render(data: WalkTimesResponse | null, loading = false, positionFallback = false) {
  return renderToStaticMarkup(createElement(WalkTimesSection, { data, loading, positionFallback }))
}

/** 골든타임이 있는 날 (mock 의 `heatSensitive: false` 갈래) */
const GOOD_DAY = mockWalkTimes(false)
/** 특보 경보로 추천이 없는 날 */
const BAD_DAY = mockWalkTimes(true)

describe('WalkTimesSection — 추천 구간', () => {
  it('골든타임을 시각 문장으로 적는다 — 곡선 색에만 기대지 않는다', () => {
    const markup = render(GOOD_DAY)

    expect(markup).toContain('18:00')
    expect(markup).toContain('21:00')
  })

  /*
    이 테스트가 이 화면의 핵심이다. 서버는 남은 시간이 전부 위험이면 일부러 구간을 주지
    않는다 — "그나마 이때가 낫다" 고 말하면 사용자가 그것을 허락으로 읽기 때문이다
    (`GoldenWalkWindow`). 화면이 대체 구간을 지어내면 그 설계가 무너진다.
  */
  it('추천이 없는 날에 시간대를 지어내지 않는다', () => {
    const markup = render(BAD_DAY)

    expect(markup).toContain(messages.home.goldenNone)
    expect(markup).not.toContain('18:00')
    expect(markup).not.toContain('–')
  })

  it('추천이 없어도 곡선은 그대로 보여 준다 — 근거를 감추지 않는다', () => {
    const markup = render(BAD_DAY)

    expect(markup).toContain('14시')
    expect(markup).toContain('21시')
  })
})

describe('WalkTimesSection — 곡선', () => {
  it('시각과 노면온도를 함께 둔다 — 색만으로 정보를 전달하지 않는다 (DESIGN.md §2-3)', () => {
    const markup = render(GOOD_DAY)

    expect(markup).toContain('14시')
    // `formatCelsius` 는 소수점 1자리를 유지한다 — 목록에서 자릿수가 흔들리지 않게
    expect(markup).toContain('58.0℃')
  })

  it('막대의 등급 이름을 보조기기에 남긴다', () => {
    const markup = render(GOOD_DAY)

    expect(markup).toContain('sr-only')
    expect(markup).toContain(GOOD_DAY.hourly[0]?.walkSafetyLevel.name as string)
  })

  it('남은 예보가 없으면 빈 곡선 대신 문장을 낸다', () => {
    const markup = render({ ...GOOD_DAY, hourly: [] })

    expect(markup).toContain(messages.home.goldenCurveEmpty)
  })
})

describe('WalkTimesSection — 상태', () => {
  it('조회 실패는 섹션을 통째로 숨긴다 — 홈 최소 골격에 이 섹션은 없다', () => {
    expect(render(null)).toBe('')
  })

  it('로딩 중에는 skeleton 만 보이고 값이 함께 나오지 않는다', () => {
    const markup = render(null, true)

    expect(markup).toContain('animate-pulse')
    expect(markup).not.toContain('18:00')
  })

  it('특보 배지를 함께 그린다', () => {
    expect(render(BAD_DAY)).toContain('경보')
    expect(render(GOOD_DAY)).not.toContain('경보')
  })

  /*
    곡선은 좌표에 딸린 값이라 **어디 기준인지 모르면 읽을 수 없다.** 위치를 얻었는지에
    따라 기준이 달라지므로 둘을 구분해 적는다 (#180).
  */
  it('현재 위치로 조회했으면 그렇게 적는다', () => {
    const markup = render(GOOD_DAY)

    expect(markup).toContain(messages.home.goldenBasisCurrent)
    expect(markup).not.toContain(messages.home.goldenBasis)
  })

  it('위치를 못 얻었으면 제주시 기준임을 감추지 않는다', () => {
    const markup = render(GOOD_DAY, false, true)

    expect(markup).toContain(messages.home.goldenBasis)
    expect(markup).not.toContain(messages.home.goldenBasisCurrent)
  })
})

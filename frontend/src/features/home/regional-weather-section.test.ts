import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { RegionalWeatherSection } from '@/features/home/regional-weather-section'
import { mockRegionalWeather } from '@/lib/api/mock/insight-data'
import { messages } from '@/lib/messages'
import type { RegionalWeatherResponse } from '@/types/insight'

function render(data: RegionalWeatherResponse | null, loading = false) {
  return renderToStaticMarkup(createElement(RegionalWeatherSection, { data, loading }))
}

/** 추천이 있는 날 */
const GOOD_DAY = mockRegionalWeather(false)
/** 특보 경보로 추천이 없는 날 */
const BAD_DAY = mockRegionalWeather(true)

describe('RegionalWeatherSection — 추천', () => {
  it('추천 권역과 이유를 서버 문장 그대로 쓴다', () => {
    const markup = render(GOOD_DAY)

    expect(markup).toContain('서귀포권')
    expect(markup).toContain(GOOD_DAY.recommendationReasons[0] as string)
  })

  /*
    적합도는 0점, 산책은 위험이라고 말하는 같은 서비스가 여기서만 "여기 가세요" 라고 하면
    안 된다. 서버가 경보일 때 recommendedRegion 을 null 로 주는 이유이고, 화면이 대체
    권역을 지어내면 그 설계가 무너진다.
  */
  it('추천이 없는 날에 권역을 지어내지 않는다', () => {
    const markup = render(BAD_DAY)

    expect(markup).toContain(messages.home.regionNone)
    expect(markup).not.toContain(messages.home.regionRecommended.replace('{name}', ''))
  })

  it('추천이 없어도 비교표는 그대로 보여 준다 — 여전히 정보다', () => {
    const markup = render(BAD_DAY)

    expect(markup).toContain('제주시권')
    expect(markup).toContain('한라산권')
  })
})

describe('RegionalWeatherSection — 비교표', () => {
  it('다섯 권역을 모두 남긴다', () => {
    const markup = render(GOOD_DAY)

    for (const name of ['제주시권', '서귀포권', '동부권', '서부권', '한라산권']) {
      expect(markup).toContain(name)
    }
  })

  /*
    예보를 못 받은 권역을 목록에서 지우면 사용자는 그 권역이 조회되지 않았다는 것조차
    모른 채 "비교 대상이 넷" 이라고 읽는다. 0 으로 채우면 "나쁘다" 로 읽는다.
  */
  it('예보를 못 받은 권역은 0 이 아니라 "예보 없음" 이다', () => {
    const markup = render(GOOD_DAY)

    expect(markup).toContain(messages.home.regionScoreUnavailable)
    expect(markup).toContain('한라산권')
  })

  it('점수가 장소 적합도가 아님을 밝힌다', () => {
    expect(render(GOOD_DAY)).toContain(messages.home.regionScoreNote)
  })
})

describe('RegionalWeatherSection — 상태', () => {
  it('조회 실패는 섹션을 통째로 숨긴다', () => {
    expect(render(null)).toBe('')
  })

  it('로딩 중에는 skeleton 만 보인다', () => {
    const markup = render(null, true)

    expect(markup).toContain('animate-pulse')
    expect(markup).not.toContain('서귀포권')
  })

  it('특보 배지를 함께 그린다', () => {
    expect(render(BAD_DAY)).toContain('경보')
    expect(render(GOOD_DAY)).not.toContain('경보')
  })
})

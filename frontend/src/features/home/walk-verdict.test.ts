import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { WalkVerdict } from '@/features/home/walk-verdict'
import { messages } from '@/lib/messages'
import { walkSafety } from '@/test/fixtures/insight'
import type { WalkSafetyResponse, WeatherWarningItem } from '@/types/insight'

const HEAT_WAVE_WARNING: WeatherWarningItem = {
  type: { code: 'HEAT_WAVE', name: '폭염', description: '더위가 심합니다.' },
  level: { code: 'WARNING', name: '경보', description: '기상청이 위험을 경고한 단계입니다.' },
  effectiveAt: '2026-08-29T11:00:00',
}

function render(data: WalkSafetyResponse) {
  return renderToStaticMarkup(createElement(WalkVerdict, { data, petName: '몽실이' }))
}

describe('WalkVerdict — 기상특보', () => {
  it('특보가 없으면 배지가 없다', () => {
    expect(render(walkSafety)).not.toContain('경보')
  })

  /*
    데스크톱 등급 줄은 `md:flex` 라 모바일에서 아예 렌더되지 않는다. 접힌 모바일 한 줄에도
    배지가 있어야 이 서비스에서 가장 흔한 화면이 특보를 말한다.
  */
  it('모바일 접힌 줄과 데스크톱 등급 줄 양쪽에 배지가 온다', () => {
    const markup = render({ ...walkSafety, weatherWarning: HEAT_WAVE_WARNING })
    const occurrences = markup.split('폭염').length - 1

    expect(occurrences).toBe(2)
  })

  /*
    배지는 근거 문장을 대체하지 않는다 — 서버가 보내는 `WEATHER_WARNING_ACTIVE` 문장이
    무엇을 조심해야 하는지 말하고, 배지는 그 사실을 문단 밖으로 올릴 뿐이다.
  */
  it('배지가 근거 목록을 대체하지 않는다', () => {
    const markup = render({
      ...walkSafety,
      weatherWarning: HEAT_WAVE_WARNING,
      reasons: [
        {
          code: 'WEATHER_WARNING_ACTIVE',
          name: '기상특보 발효',
          description: '폭염 경보 발효 중입니다. 더위가 심합니다.',
        },
      ],
    })

    expect(markup).toContain('폭염 경보 발효 중입니다.')
  })
})

/*
  #259. 모바일 접힌 줄은 `heatIndexLabel` 을 달고 있었는데 **데스크톱 hero 만 맨 숫자**였다 —
  같은 화면의 같은 값이 폭에 따라 이름을 잃었다. 아래 기준 줄(`{장소} 기준`)은 어디의
  값인지만 말하고 무엇인지는 말하지 않는다.

  `renderToStaticMarkup` 은 두 분기를 **함께** 그린다(`md:` 는 CSS 다). 그래서 라벨이
  마크업에 **두 번** 나와야 양쪽에 다 붙은 것이다 — 한 번이면 한쪽이 빠진 것이다.
*/
describe('WalkVerdict — 열지수 라벨 (#259)', () => {
  const occurrences = (markup: string, needle: string) => markup.split(needle).length - 1

  it('모바일 접힌 줄과 데스크톱 hero 양쪽에 라벨이 붙는다', () => {
    expect(occurrences(render(walkSafety), messages.home.heatIndexLabel)).toBe(2)
  })

  /*
    **장소 상세 산책 위험도와 같은 이름이다** — 같은 `heatIndexCelsius` 다. 하루 최대
    (`최고 체감온도`)와는 `최고` 가 가른다.
  */
  it('장소 상세 산책 위험도와 같은 이름을 쓴다', () => {
    expect(messages.home.heatIndexLabel).toBe(messages.place.detailHeatIndex)
  })

  it('열지수가 없으면 라벨도 렌더하지 않는다', () => {
    const markup = render({ ...walkSafety, heatIndexCelsius: null })

    expect(markup).not.toContain(messages.home.heatIndexLabel)
  })
})

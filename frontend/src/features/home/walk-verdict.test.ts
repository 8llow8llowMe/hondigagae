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
  #259. 모바일 접힌 줄은 `feelsLikeLabel` 을 달고 있었는데 **데스크톱 hero 만 맨 숫자**였다 —
  같은 화면의 같은 값이 폭에 따라 이름을 잃었다. 아래 기준 줄(`{장소} 기준`)은 어디의
  값인지만 말하고 무엇인지는 말하지 않는다.

  `renderToStaticMarkup` 은 두 분기를 **함께** 그린다(`md:` 는 CSS 다). 그래서 두 자리를
  각각 확인한다.

  **낱말을 세지 않는다** (#292). 예전에는 `체감온도` 등장 횟수가 2 인지 봤는데, 서버 근거
  문장이 `FEELS_LIKE_HIGH`("기상청 여름철 체감온도 기준으로…")로 바뀌면서 같은 낱말이
  근거 목록에도 들어왔다 — 셈이 3 이 되어 화면은 맞는데 테스트가 깨졌다. **라벨은 자기
  텍스트 노드로 서는지**를 본다.
*/
describe('WalkVerdict — 체감온도 라벨 (#259)', () => {
  it('모바일 접힌 줄과 데스크톱 hero 양쪽에 라벨이 붙는다', () => {
    const markup = render(walkSafety)

    // 데스크톱 hero — `MetricValue` 의 라벨은 자기 span 이다
    expect(markup).toContain(`>${messages.home.feelsLikeLabel}</span>`)
    // 모바일 접힌 줄 — 라벨과 값이 한 문장으로 붙는다
    expect(markup).toContain(`>${messages.home.feelsLikeLabel} 33.0℃`)
  })

  /*
    **장소 상세 산책 위험도와 같은 이름이다** — 같은 `feelsLikeCelsius` 다. 하루 최대
    (`최고 체감온도`)와는 `최고` 가 가른다.
  */
  it('장소 상세 산책 위험도와 같은 이름을 쓴다', () => {
    expect(messages.home.feelsLikeLabel).toBe(messages.place.detailFeelsLike)
  })

  /*
    **낱말이 아니라 자리를 확인한다** (#292). 서버 근거 문장에도 `체감온도` 가 들어 있어
    `not.toContain('체감온도')` 는 이제 근거 목록 때문에 실패한다 — 화면은 맞는데도.
  */
  it('체감온도가 없으면 라벨도 렌더하지 않는다', () => {
    const markup = render({ ...walkSafety, feelsLikeCelsius: null })

    // hero 라벨 자리가 사라진다
    expect(markup).not.toContain(`>${messages.home.feelsLikeLabel}</span>`)
    expect(markup).not.toContain('33.0')
    // 접힌 요약줄은 온도를 빼고 기준 장소만 남긴다 — `·` 만 남아 떠 있지 않다
    expect(markup).toContain(`>${walkSafety.placeTitle} ${messages.home.basisSuffix}<`)
  })
})

/*
  #292. BE `46f35e4` 가 판정 기준을 NOAA 열지수 → 기상청 체감온도로 바꿨는데 이 화면은
  한동안 `heatIndexCelsius` 를 계속 읽었다. **그동안 라벨은 줄곧 `체감온도` 였다** — 그래서
  라벨만 보는 테스트로는 이 버그를 잡을 수 없었다. 값을 봐야 한다.

  fixture 가 두 필드를 **다른 숫자**(33.0 vs 40.2)로 두는 이유가 이것이다.
*/
describe('WalkVerdict — 판정값은 체감온도다 (#292)', () => {
  it('`feelsLikeCelsius` 를 그리고 참고 열지수는 그리지 않는다', () => {
    const markup = render(walkSafety)

    expect(markup).toContain('33.0')
    expect(markup).not.toContain('40.2')
  })

  /*
    **열지수만 없어도 화면은 그대로다.** 홈은 참고값을 아예 읽지 않으므로 그 필드가
    비어도 판정 숫자가 사라질 이유가 없다 — 반대로 사라지면 옛 필드를 읽고 있는 것이다.
  */
  it('열지수가 없어도 체감온도는 그대로 그린다', () => {
    const markup = render({ ...walkSafety, heatIndexCelsius: null, heatIndexBasis: null })

    expect(markup).toContain('33.0')
    expect(markup).toContain(messages.home.feelsLikeLabel)
  })
})

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import {
  PlaceSuitabilityPanel,
  type PlaceSuitabilityPanelProps,
} from '@/features/place/place-suitability-panel'
import { messages } from '@/lib/messages'
import {
  suitability,
  suitabilityInsufficient,
  suitabilityWithIndoor,
} from '@/test/fixtures/insight'

function render(overrides: Partial<PlaceSuitabilityPanelProps> = {}) {
  const props: PlaceSuitabilityPanelProps = {
    data: suitability,
    loading: false,
    failed: false,
    onRetry: () => undefined,
    petName: '몽실이',
    authed: true,
    ...overrides,
  }

  return renderToStaticMarkup(createElement(PlaceSuitabilityPanel, props))
}

/**
 * `MetricValue` 의 **큰 숫자** span 만 걷는다 (`font-black` + `text-display`/`text-title-1`).
 *
 * caption 으로 받치는 줄과 큰 숫자를 가르기 위한 것이다 — 마크업 전체를 문자열로 보면
 * 두 자리의 같은 숫자를 구분할 수 없다 (#352).
 */
function bigNumbers(markup: string): string[] {
  return [...markup.matchAll(/<span class="font-black[^"]*">([^<]*)<\/span>/g)].map(
    (match) => match[1] as string,
  )
}

describe('PlaceSuitabilityPanel — 상태 배타성', () => {
  it('로딩 중에는 skeleton 만 보이고 점수가 함께 나오지 않는다', () => {
    const markup = render({ loading: true, data: null })

    expect(markup).toContain('animate-pulse')
    expect(markup).not.toContain('82')
  })

  it('판정만 실패하면 재시도를 주고, 화면 전체를 에러로 덮지 않는다', () => {
    const markup = render({ failed: true, data: null })

    expect(markup).toContain(messages.place.detailSuitabilityErrorTitle)
    expect(markup).toContain(messages.common.retry)
  })
})

describe('PlaceSuitabilityPanel — 화자와 점수', () => {
  it('반려견 이름을 화자로 세우고 서버 등급명을 그대로 쓴다', () => {
    const markup = render()

    expect(markup).toContain('몽실이에게')
    expect(markup).toContain(suitability.suitabilityLevel.name)
  })

  it('점수와 단위를 함께 쓴다', () => {
    const markup = render()

    expect(markup).toContain('82')
    expect(markup).toContain(messages.place.detailScoreUnit)
  })

  it('언제·누구 기준인지 근거 아래 한 줄로 붙인다', () => {
    const markup = render()

    expect(markup).toContain(
      messages.place.detailSuitabilityBasis
        .replace('{date}', suitability.targetDate)
        .replace('{name}', '몽실이'),
    )
  })
})

describe('PlaceSuitabilityPanel — INSUFFICIENT 은 "나쁨" 이 아니라 "모름" 이다', () => {
  it('score 가 null 이면 0 으로 렌더하지 않는다', () => {
    const markup = render({ data: suitabilityInsufficient })

    expect(markup).not.toContain('>0<')
    expect(markup).not.toContain(messages.place.detailScoreUnit)
  })

  it('점수가 없어도 서버 등급명과 근거는 그대로 보인다', () => {
    const markup = render({ data: suitabilityInsufficient })

    expect(markup).toContain(suitabilityInsufficient.suitabilityLevel.name)
    expect(markup).toContain(suitabilityInsufficient.reasons[0]?.description ?? '')
  })
})

describe('PlaceSuitabilityPanel — 근거', () => {
  it('서버가 준 순서를 그대로 쓰고 scoreDelta 숫자를 노출하지 않는다', () => {
    const markup = render()

    const first = markup.indexOf(suitability.reasons[0]?.description ?? '')
    const second = markup.indexOf(suitability.reasons[1]?.description ?? '')

    expect(first).toBeGreaterThanOrEqual(0)
    expect(second).toBeGreaterThan(first)

    // 산식이 공개되지 않아 "-27" 을 설명할 수 없다.
    // 기준 각주의 날짜(`2026-08-27`)에 같은 숫자가 들어 있어 그 줄을 뺀 뒤에 본다
    const withoutDate = markup.split(suitability.targetDate).join('')
    expect(withoutDate).not.toContain('-27')
    expect(withoutDate).not.toContain('-9')
  })

  it('근거가 비어 있으면 목록 자체를 렌더하지 않는다', () => {
    const markup = render({ data: { ...suitability, reasons: [] } })

    expect(markup).toContain(suitability.suitabilityLevel.name)
    expect(markup).not.toContain('<ul')
  })
})

describe('PlaceSuitabilityPanel — 실내 대안', () => {
  it('빈 배열이면 섹션을 렌더하지 않는다', () => {
    expect(render()).not.toContain(messages.place.detailIndoorAlternatives)
  })

  it('비 예보로 채워지면 장소명과 거리를 함께 보여준다', () => {
    const markup = render({ data: suitabilityWithIndoor })
    const alternative = suitabilityWithIndoor.indoorAlternatives[0]

    expect(markup).toContain(messages.place.detailIndoorAlternatives)
    expect(markup).toContain(alternative?.title ?? '')
    expect(markup).toContain(`/places/${alternative?.placeId ?? ''}`)
  })
})

describe('PlaceSuitabilityPanel — 반려견이 없으면 판정을 말하지 않는다 (아트보드 04-③)', () => {
  it('점수·근거·화자를 쓰지 않는다 — 기준이 되는 반려견이 없다', () => {
    const markup = render({ petName: null })

    expect(markup).not.toContain('82')
    expect(markup).not.toContain('에게')
    expect(markup).not.toContain(suitability.reasons[0]?.description ?? '')
  })

  /*
    **최고기온이 아니라 체감온도다** (#253). 아트보드가 이 자리에 그린 큰 숫자는 열지수인데
    계약에 없어 최고기온으로 대신하고 있었고, PR #235 가 `maxFeelsLikeTemperature` 를
    더하면서 아트보드대로 돌아왔다.
  */
  it('대신 지역 날씨와 등록 유도를 보여준다 — 온도는 체감온도다', () => {
    const markup = render({ petName: null })

    expect(markup).toContain(messages.place.detailGuestHeading)
    expect(markup).toContain(messages.place.detailGuestCta)
    expect(markup).toContain(messages.place.detailFeelsLikeTemperature)
    expect(markup).toContain('33.4')

    /*
      **같은 ℃ 라 큰 숫자를 둘 세우지 않는다** — 라벨을 읽어야 구분되는 숫자 두 개가 되고,
      그 순간 "큰 숫자 하나" 라는 이 자리의 성격이 사라진다.

      **검사를 큰 숫자 자리로 좁혔다** (#352). 예전에는 마크업 전체에 `31.0` 이 없는지 봤는데,
      #352 가 최고기온을 **caption 으로 받치는 줄**에 넣으면서 그 검사가 함께 걸렸다.
      지키려던 규칙은 "최고기온이 화면에 없다" 가 아니라 **"최고기온이 큰 숫자로 서지 않는다"**
      이므로, `MetricValue` 의 큰 숫자 span 만 본다.
    */
    expect(bigNumbers(markup)).toEqual(['33.4', '80'])
  })

  /*
    중기예보 구간은 체감온도가 **언제나 null** 이다. 그때 최고기온을 세우되 **이름을 바꿔
    말하지 않는다** — 최고기온을 체감온도라고 부르면 판정의 근거를 잘못 알려 주는 것이다.
  */
  it('체감온도를 못 받으면 최고기온으로 바꿔 세우고 라벨도 바꾼다', () => {
    const weather = suitability.weather
    if (weather === null) throw new Error('fixture 에 예보가 있어야 한다')

    const markup = render({
      petName: null,
      data: { ...suitability, weather: { ...weather, maxFeelsLikeTemperature: null } },
    })

    expect(markup).toContain(messages.place.detailMaxTemperature)
    expect(markup).toContain('31.0')
    expect(markup).not.toContain(messages.place.detailFeelsLikeTemperature)
  })

  it('미로그인이면 로그인으로, 로그인했으면 반려견 등록으로 보낸다', () => {
    expect(render({ petName: null, authed: false })).toContain('/login')
    expect(render({ petName: null, authed: true })).toContain('/pets/new')
  })

  it('예보가 없으면 숫자 자리를 만들지 않고 안내만 남긴다', () => {
    const markup = render({ petName: null, data: { ...suitability, weather: null } })

    expect(markup).toContain(messages.place.detailGuestNoWeather)
    expect(markup).toContain(messages.place.detailGuestCta)
  })
})

describe('PlaceSuitabilityPanel — 기상특보', () => {
  it('특보가 없으면 배지가 없다', () => {
    expect(render()).not.toContain('주의보')
  })

  it('등급 줄에 특보 배지가 함께 선다 — 등급을 대신하지 않는다', () => {
    const markup = render({
      data: {
        ...suitability,
        weatherWarning: {
          type: { code: 'HEAT_WAVE', name: '폭염', description: '더위가 심합니다.' },
          level: { code: 'ADVISORY', name: '주의보', description: null },
          effectiveAt: '2026-08-29T06:00:00',
        },
      },
    })

    expect(markup).toContain('주의보')
    // 등급 단어가 배지에 밀려 사라지지 않는다
    expect(markup).toContain(suitability.suitabilityLevel.name)
  })
})

/*
  **#352.** 게스트 블록이 `최고 체감온도 33.4℃` 한 값만 보여 줬다. 응답에는
  `maxTemperature` · `minTemperature` 가 이미 실려 있었고, 33.4℃ 만으로는 아침에
  나갈 수 있는 날인지 알 수 없다.

  **큰 숫자를 하나 더 세우지 않는다** — `lib/insight/temperature.ts` 가 *"둘을 나란히
  세우지 않는다"* 고 정해 둔 자리라, 받치는 줄은 caption 이다.
*/
describe('PlaceSuitabilityPanel — 게스트 블록의 최고·최저기온 (#352)', () => {
  const guest = () => render({ petName: null })

  it('최고 체감온도 아래에 최고기온과 최저기온을 받친다', () => {
    const markup = guest()
    const weather = suitability.weather as NonNullable<typeof suitability.weather>

    expect(markup).toContain(messages.place.detailFeelsLikeTemperature)
    expect(markup).toContain(
      `${messages.place.detailSupportingMaxTemperature} ${(weather.maxTemperature as number).toFixed(1)}℃`,
    )
    expect(markup).toContain(
      `${messages.place.detailSupportingMinTemperature} ${(weather.minTemperature as number).toFixed(1)}℃`,
    )
  })

  /* 큰 숫자와 경쟁하지 않는다 — 받치는 줄은 caption 이고 MetricValue 를 쓰지 않는다 */
  it('받치는 줄은 caption 이다 — 큰 숫자를 하나 더 세우지 않는다', () => {
    const markup = guest()
    const line = /<p class="([^"]*)"><span>최고기온/.exec(markup)?.[1]

    expect(line).toBeDefined()
    expect(line).toContain('text-caption')
    expect(line).not.toContain('text-display')
    expect(line).not.toContain('text-title-1')
  })

  /*
    중기예보 구간은 체감온도가 없어 큰 숫자가 **최고기온**이 된다. 그때 받치는 줄에서
    최고기온을 다시 말하면 같은 값이 한 자리에 두 번 선다.
  */
  it('체감온도를 못 받은 날은 최고기온을 되풀이하지 않고 최저만 받친다', () => {
    const weather = suitability.weather as NonNullable<typeof suitability.weather>
    const markup = render({
      petName: null,
      data: { ...suitability, weather: { ...weather, maxFeelsLikeTemperature: null } },
    })

    // 큰 숫자 자리가 `최고기온` 이라고 말한다 (#253)
    expect(markup).toContain(messages.place.detailMaxTemperature)
    expect(markup).not.toContain(messages.place.detailSupportingMaxTemperature + ' ')
    expect(markup).toContain(messages.place.detailSupportingMinTemperature)
  })

  it('최고·최저가 둘 다 없으면 받치는 줄 자체를 내지 않는다', () => {
    const weather = suitability.weather as NonNullable<typeof suitability.weather>
    const markup = render({
      petName: null,
      data: {
        ...suitability,
        weather: { ...weather, maxTemperature: null, minTemperature: null },
      },
    })

    expect(markup).not.toContain(messages.place.detailSupportingMinTemperature)
    expect(markup).toContain(messages.place.detailFeelsLikeTemperature)
  })

  /* 반려견 기준 판정에는 이 블록이 없다 — 게스트 경로에서만 보인다 */
  it('반려견 기준 판정에는 받치는 줄이 없다', () => {
    expect(render()).not.toContain(messages.place.detailSupportingMinTemperature)
  })
})

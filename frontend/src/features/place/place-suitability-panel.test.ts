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

  it('대신 지역 날씨와 등록 유도를 보여준다', () => {
    const markup = render({ petName: null })

    expect(markup).toContain(messages.place.detailGuestHeading)
    expect(markup).toContain(messages.place.detailGuestCta)
    expect(markup).toContain('31.0')
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

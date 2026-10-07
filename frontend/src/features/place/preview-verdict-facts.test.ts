import { describe, expect, it } from 'vitest'

import { previewVerdictFacts } from '@/features/place/preview-verdict-facts'
import { suitability, walkSafety } from '@/test/fixtures/insight'
import type { PlaceSuitabilityResponse, WalkSafetyResponse } from '@/types/insight'

const clearDay: PlaceSuitabilityResponse = {
  ...suitability,
  weather: suitability.weather && {
    ...suitability.weather,
    maxTemperature: 23,
    maxPrecipitationProbability: 0,
    precipitationType: { code: 'NONE', name: '없음', description: null },
    skyState: { code: 'CLEAR', name: '맑음', description: null },
  },
  congestion: {
    level: { code: 'HIGH', name: '붐빔', description: null },
    concentrationRate: 81.4,
  },
}

const safeWalk: WalkSafetyResponse = {
  ...walkSafety,
  walkSafetyLevel: { code: 'SAFE', name: '안전', description: null, scoreDescription: null },
  feelsLikeCelsius: 20.8,
  saferWindowStart: null,
  saferWindowEnd: null,
}

describe('previewVerdictFacts — 근거 사실 (#1233 D2 ⑤)', () => {
  it('좋은 쪽 사실이 먼저, 주의 쪽 사실이 아래다 — 결론 바로 밑에 반대 문장이 붙지 않는다', () => {
    const facts = previewVerdictFacts(clearDay, safeWalk)

    expect(facts.map((fact) => [fact.key, fact.tone])).toEqual([
      ['weather', null],
      ['walk', null],
      ['congestion', 'mid'],
    ])
  })

  it('날씨는 하늘 그림 + 최고기온 · 비 확률 — 하늘 낱말은 그림이 말한다', () => {
    const weather = previewVerdictFacts(clearDay, null)[0]

    expect(weather?.text).toBe('최고 23℃ · 비 0%')
    expect(weather?.glyph).toEqual({ kind: 'sun', name: '맑음' })
  })

  it('비 확률이 60% 이상이면 날씨가 주의 쪽이다', () => {
    const weather = previewVerdictFacts(suitability, null).find((fact) => fact.key === 'weather')

    expect(weather?.tone).toBe('mid')
    expect(weather?.glyph?.kind).toBe('rain')
  })

  it('산책은 등급 · 체감, 더 안전한 시간대가 있으면 덧붙인다', () => {
    expect(previewVerdictFacts(null, safeWalk)[0]?.text).toBe('지금 산책 안전 · 체감 20.8℃')

    const walk = previewVerdictFacts(null, walkSafety)[0]
    expect(walk?.text).toContain('이 더 좋아요')
    expect(walk?.tone).toBe('critical')
  })

  it('붐빔은 등급 · 집중률, 정보가 없으면(UNKNOWN) 줄이 없다', () => {
    expect(previewVerdictFacts(clearDay, null).at(-1)?.text).toBe('붐빔 · 집중률 81%')
    expect(previewVerdictFacts(suitability, null).some((fact) => fact.key === 'congestion')).toBe(
      false,
    )
  })

  it('기상특보는 주의 쪽 맨 앞이다 — 경보는 위험 톤', () => {
    const warned: PlaceSuitabilityResponse = {
      ...clearDay,
      weatherWarning: {
        type: { code: 'HEAT_WAVE', name: '폭염', description: null },
        level: { code: 'WARNING', name: '경보', description: null },
        effectiveAt: null,
      },
    }
    const facts = previewVerdictFacts(warned, safeWalk)
    const firstCaution = facts.find((fact) => fact.tone !== null)

    expect(firstCaution).toMatchObject({ key: 'warning', text: '폭염 경보', tone: 'critical' })
  })

  it('판정이 하나도 없으면 빈 목록이다', () => {
    expect(previewVerdictFacts(null, null)).toEqual([])
  })

  it('근거 문장(reasons)을 싣지 않는다 — 상세의 몫이다', () => {
    const text = previewVerdictFacts(suitability, walkSafety)
      .map((fact) => fact.text)
      .join(' ')

    expect(text).not.toContain(suitability.reasons[0]?.description ?? '')
  })
})

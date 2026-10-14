import { describe, expect, it } from 'vitest'

import { ApiError, NO_RESPONSE_STATUS } from '@/lib/api/error'
import {
  allCardsCautious,
  emptyRecommendationNotice,
  recommendationFailure,
  toRecommendationCards,
} from '@/lib/insight/recommendation'
import { messages } from '@/lib/messages'
import {
  recommendationItem,
  recommendations,
  SUITABILITY_LOW,
  suitabilityWithIndoor,
} from '@/test/fixtures/insight'
import type { PlaceRecommendationResponse, WeatherWarningItem } from '@/types/insight'

/** 문구는 `WeatherWarningType` · `WeatherWarningLevel` 의 `displayName` / `description` 그대로 */
const HEAVY_RAIN_ADVISORY: WeatherWarningItem = {
  type: { code: 'HEAVY_RAIN', name: '호우', description: '많은 비가 예상됩니다.' },
  level: {
    code: 'ADVISORY',
    name: '주의보',
    description: '기상 조건이 나빠지고 있습니다. 일정을 조정하는 편이 좋습니다.',
  },
  effectiveAt: '2026-10-11T06:00:00',
}

/*
  #1380 — 추천 항목을 **카드가 이미 받는 모양**(적합도 응답 + 장소 요약)으로 옮긴다. 카드
  컴포넌트를 그대로 쓰려는 것이라, 옮기며 값을 바꾸거나 지어내면 안 된다.
*/
describe('toRecommendationCards', () => {
  it('항목의 판정 조각을 적합도 응답 자리에 그대로 옮긴다', () => {
    const [card] = toRecommendationCards(recommendations, null)

    expect(card?.data).toMatchObject({
      placeId: '212481712381923401',
      placeTitle: '캠파제주',
      score: 84,
      suitabilityLevel: recommendationItem.suitabilityLevel,
      headline: recommendationItem.headline,
      reasons: recommendationItem.reasons,
      weather: recommendationItem.weather,
      congestion: recommendationItem.congestion,
      indoorAlternatives: [],
      petConditionApplied: true,
      weatherApplied: true,
      congestionApplied: false,
    })
  })

  /* 날씨 출처 · 특보 · 기준 일자는 지역 공통이라 응답 머리에 한 번 온다 — 카드마다 같은 값을 싣는다 */
  it('응답 머리의 기준 일자 · 날씨 출처 · 특보를 카드마다 옮긴다', () => {
    const cards = toRecommendationCards(
      { ...recommendations, weatherWarning: HEAVY_RAIN_ADVISORY },
      null,
    )

    for (const card of cards) {
      expect(card.data.targetDate).toBe('2026-10-11')
      expect(card.data.weatherProviderName).toBe('기상청 단기예보')
      expect(card.data.weatherWarning).toEqual(HEAVY_RAIN_ADVISORY)
    }
  })

  /* 사진 · 주소 · 실내 여부 · 동반 여부는 카드의 `place` 자리다 — 예전에는 목록 응답에서 왔다 */
  it('요약 필드를 카드의 장소 자리로 옮긴다', () => {
    const [, second] = toRecommendationCards(recommendations, null)

    expect(second?.place).toEqual({
      firstImage: recommendationItem.firstImage,
      contentType: recommendationItem.contentType,
      petAllowanceType: {
        code: 'PARTIALLY_ALLOWED',
        name: '부분 동반 가능',
        description: '일부 구역 또는 조건부로 반려동물 동반이 가능한 장소입니다.',
      },
      addr1: recommendationItem.addr1,
      indoor: null,
    })
  })

  /*
    **서버 순서를 지킨다.** 점수 → 동반 `ALLOWED` 먼저 → 덜 붐비는 곳 → placeId 에 유형 다양성까지
    서버가 정했다(BE §6-5). 점수로 다시 세우면 같은 점수 안의 동반 · 혼잡 순서가 아니라 들어온
    순서에 기대게 되고, 다양성으로 채운 자리는 점수만으로 설명되지 않는다.
  */
  it('순서를 바꾸지 않는다 — 점수가 거꾸로 와도', () => {
    const reversed: PlaceRecommendationResponse = {
      ...recommendations,
      items: [...recommendations.items].reverse(),
    }

    expect(toRecommendationCards(reversed, null).map((card) => card.data.placeTitle)).toEqual([
      '갑선이오름',
      '수목원테마파크',
      '캠파제주',
    ])
  })

  /*
    **기준 장소는 카드에서 뺀다** (#428). 좌측 판정이 "{장소} 기준" 으로 이미 그 장소를 말하고
    있다 — 같은 사실을 한 화면에서 두 번 말하지 않는다.
  */
  it('기준 장소를 뺀다', () => {
    const cards = toRecommendationCards(recommendations, '212481712381923402')

    expect(cards.map((card) => card.data.placeTitle)).toEqual(['캠파제주', '갑선이오름'])
  })

  it('비 예보면 실내 대안을 옮긴다 — 추가 조회가 없다', () => {
    const rainy: PlaceRecommendationResponse = {
      ...recommendations,
      items: [
        { ...recommendationItem, indoorAlternatives: suitabilityWithIndoor.indoorAlternatives },
      ],
    }

    expect(toRecommendationCards(rainy, null)[0]?.data.indoorAlternatives).toEqual(
      suitabilityWithIndoor.indoorAlternatives,
    )
  })

  it('추천할 곳이 없으면 빈 배열이다', () => {
    expect(toRecommendationCards({ ...recommendations, items: [] }, null)).toEqual([])
  })
})

/*
  #1380 — 카드로 선 곳이 **전부** `주의 필요` 이하면 제목이 `갈 만한 곳` 이라고 말하지 않는다.
  추천 API 는 후보 중 가장 나은 곳을 고를 뿐이라, 비 · 특보 날에는 1위도 `주의 필요` 일 수 있다.
*/
describe('allCardsCautious', () => {
  const level = (code: string) => ({ suitabilityLevel: { ...SUITABILITY_LOW, code } })

  it('전부 LOW 면 참이다', () => {
    expect(allCardsCautious([level('LOW'), level('LOW')])).toBe(true)
  })

  /* 한 곳이라도 갈 만하면 제목의 약속이 지켜진다 — 1위가 그곳이다 */
  it('하나라도 LOW 보다 나으면 거짓이다', () => {
    expect(allCardsCautious([level('LOW'), level('MEDIUM')])).toBe(false)
    expect(allCardsCautious([level('HIGH')])).toBe(false)
  })

  /*
    `INSUFFICIENT` 는 나쁨이 아니라 모름이지만 **갈 만하다는 근거도 아니다.** 추천에는 오지 않는
    등급(점수 없는 곳은 서버가 뺀다)이라 실제로 섞이지 않는다 — 섞이면 낮추는 쪽에 둔다.
  */
  it('LOW 와 INSUFFICIENT 만이면 참이다', () => {
    expect(allCardsCautious([level('LOW'), level('INSUFFICIENT')])).toBe(true)
  })

  /* 서버가 새 등급을 내면 모르는 값이다 — 모르는 것을 나쁘다고 말하지 않는다 */
  it('모르는 등급이 섞이면 거짓이다', () => {
    expect(allCardsCautious([level('LOW'), level('VERY_HIGH')])).toBe(false)
  })

  /* 카드가 없는 동안(골격 · 빈 상태)은 제목을 바꿀 근거가 없다 */
  it('카드가 없으면 거짓이다', () => {
    expect(allCardsCautious([])).toBe(false)
  })
})

/*
  에러 UI 는 HTTP 상태로 가른다 (api-integration-guide.md §3) — 5xx · 무응답만 재시도 버튼이고,
  404 · 그 밖 4xx 는 재시도해도 같은 답이라 버튼 없이 서버 문구를 그대로 낸다.
*/
describe('recommendationFailure', () => {
  it.each([500, 503, NO_RESPONSE_STATUS])('%s 는 재시도를 준다', (status) => {
    expect(recommendationFailure(new ApiError(status, null, null))).toEqual({
      retry: true,
      title: messages.common.temporaryErrorTitle,
    })
  })

  it('ApiError 가 아니면 전송 실패로 보고 재시도를 준다', () => {
    expect(recommendationFailure(new TypeError('Failed to fetch')).retry).toBe(true)
  })

  /*
    이 엔드포인트는 404 를 내지 않는다(추천할 곳이 없으면 200 + 빈 배열). 게이트웨이 · 라우트 같은 바깥 404 를
    위한 방어 갈래라 코드는 계약에 없는 것을 지어내지 않고 `null` 로 둔다 — 문구만 그대로 나오는지 본다.
  */
  it('404 는 재시도 없이 서버 문구를 그대로 낸다', () => {
    expect(
      recommendationFailure(new ApiError(404, null, '요청한 경로를 찾을 수 없습니다.')),
    ).toEqual({ retry: false, title: '요청한 경로를 찾을 수 없습니다.' })
  })

  /* `resultMessage` 는 백엔드 타입이 Object 다 — 문자열이 아니면 일반 문구로 떨어진다 */
  it('서버 문구가 없거나 문자열이 아니면 빈 상태 문구다', () => {
    expect(recommendationFailure(new ApiError(400, 'INSIGHT_105', { message: 'x' }))).toEqual({
      retry: false,
      title: messages.home.emptyPlacesTitle,
    })
    expect(recommendationFailure(new ApiError(404, null, null)).title).toBe(
      messages.home.emptyPlacesTitle,
    )
  })
})

/*
  #1513 · #1434 BE: '주의 필요'(60점 미만)는 추천에서 빠져 목록이 비어 올 수 있다. 경보 날은 늘 빈 목록이고
  특보는 응답 머리(`weatherWarning`)가 말한다 — 빈 상태가 그 둘을 갈라 말한다.
*/
describe('emptyRecommendationNotice', () => {
  const warning = (level: 'WARNING' | 'ADVISORY') => ({
    type: { code: 'HEAVY_RAIN', name: '호우', description: null },
    level: { code: level, name: level === 'WARNING' ? '경보' : '주의보', description: null },
    effectiveAt: '2026-10-15T06:00:00',
  })

  it('경보 날은 특보로 추천을 쉰다고 말한다', () => {
    expect(emptyRecommendationNotice(warning('WARNING'))).toEqual({
      title: '기상특보로 오늘은 추천을 쉬어요',
      description: '특보가 풀리면 다시 골라 드릴게요. 장소는 직접 찾아볼 수 있어요.',
    })
  })

  /* 주의보는 추천을 막지 않는다(§6-4) — 비었다면 특보 탓이라고 말하지 않는다 */
  it.each([
    ['주의보', warning('ADVISORY')],
    ['특보 없음', null],
  ] as const)('%s 날은 권할 곳이 없다고 말한다 — 이유를 단정하지 않는다', (_, item) => {
    expect(emptyRecommendationNotice(item)).toEqual({
      title: '오늘은 추천할 만한 곳이 없어요',
      description: '오늘 날씨와 장소 상황을 반영하면 권할 곳이 없어요. 장소를 직접 찾아보세요.',
    })
  })
})

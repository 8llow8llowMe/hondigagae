import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import {
  PlaceCardsEndCard,
  PlaceInsightCard,
  PlaceInsightCardList,
} from '@/features/home/place-insight-card'
import { placeCardsEnd } from '@/lib/insight/place-cards'
import { messages } from '@/lib/messages'
import { suitability, suitabilityInsufficient } from '@/test/fixtures/insight'
import { placeSummary } from '@/test/fixtures/place'
import type {
  CongestionItem,
  PlaceSuitabilityResponse,
  SuitabilityReasonItem,
} from '@/types/insight'
import type { PlaceSummary } from '@/types/place'

function card(
  data: PlaceSuitabilityResponse = suitability,
  place: PlaceSummary | undefined = placeSummary,
  reason: SuitabilityReasonItem | null = null,
) {
  return renderToStaticMarkup(createElement(PlaceInsightCard, { data, place, reason }))
}

const CROWDED: CongestionItem = {
  level: {
    code: 'HIGH',
    name: '혼잡',
    description: '관광객 집중도가 높아 붐빌 것으로 예상됩니다.',
  },
  concentrationRate: 72.4,
}

const HEAT: SuitabilityReasonItem = {
  code: 'HEAT_RISK',
  name: '고온 주의',
  description: '최고기온 31도 로, 더위에 약한 아이에게는 부담이 큽니다.',
  scoreDelta: -12,
}

/*
  #1069 — 전제(사진 위 동반 칩) → 정체(제목 · 지역) → 판정(점수 · 등급어 · 혼잡).
  행 시절 모바일은 오른쪽 칸에 칩 3개 + 배지 + 점수가 몰려 제목이 세 줄로 꺾였다.
*/
describe('PlaceInsightCard — 순서', () => {
  it('동반 칩 → 제목 → 메타 → 판정 순서로 선다', () => {
    const markup = card()

    const chip = markup.indexOf(placeSummary.petAllowanceType.name)
    const title = markup.indexOf(suitability.placeTitle)
    const meta = markup.indexOf('제주시 한림읍 · 실내')
    const score = markup.indexOf(`>${suitability.score}<`)

    expect(chip).toBeGreaterThan(-1)
    expect(chip).toBeLessThan(title)
    expect(title).toBeLessThan(meta)
    expect(meta).toBeLessThan(score)
  })

  /* 제목 옆에 아무것도 두지 않는다 — 제목 줄이 자기 요소 하나로 끝난다 */
  it('제목은 최대 두 줄이고 옆에 붙는 것이 없다', () => {
    const markup = card()

    expect(markup).toMatch(new RegExp(`line-clamp-2[^"]*">${suitability.placeTitle}</span>`))
  })

  it('장소 상세로 간다', () => {
    expect(card()).toContain(`href="/places/${suitability.placeId}"`)
  })

  /* 전체 주소는 375 에서 두 줄을 먹는다 — 시군구·읍면까지만 */
  it('메타 줄은 짧은 주소와 실내외다', () => {
    const markup = card()

    expect(markup).toContain('제주시 한림읍 · 실내')
    expect(markup).not.toContain('용금로')
  })
})

describe('PlaceInsightCard — 동반 칩', () => {
  /* 사진 위에 떠 있는 칩이라 흰 바탕 + 그림자 — 밝은 사진 위에서 경계를 잃지 않는다 */
  it('사진 위에 흰 바탕 · 그림자로 뜬다', () => {
    expect(card()).toMatch(
      new RegExp(`class="bg-bg[^"]*absolute[^"]*shadow-md">${placeSummary.petAllowanceType.name}<`),
    )
  })

  /* 서버 `name` 이 `정보 없음` 이라 그대로 두면 무엇의 정보가 없는지 말하지 않는다 (#530) */
  it('UNKNOWN 이면 칩을 그리지 않는다', () => {
    const markup = card(suitability, {
      ...placeSummary,
      petAllowanceType: { code: 'UNKNOWN', name: '정보 없음', description: null },
    })

    expect(markup).not.toContain('정보 없음')
    expect(markup).not.toContain('shadow-md')
  })

  /* 문구가 아니라 code 로 거른다 */
  it('같은 문구라도 code 가 다르면 그린다', () => {
    expect(
      card(suitability, {
        ...placeSummary,
        petAllowanceType: { code: 'NOT_ALLOWED', name: '정보 없음', description: null },
      }),
    ).toContain('정보 없음')
  })

  /* 목록 응답이 비어도 카드는 선다 — 칩과 메타만 빠진다 */
  it('place 가 없으면 칩과 메타 없이 제목 · 판정만 선다', () => {
    // `card(…, undefined)` 는 기본 인자로 떨어지므로 직접 렌더한다
    const markup = renderToStaticMarkup(
      createElement(PlaceInsightCard, { data: suitability, place: undefined }),
    )

    expect(markup).toContain(suitability.placeTitle)
    expect(markup).not.toContain('shadow-md')
    expect(markup).toContain(`>${suitability.score}<`)
  })
})

describe('PlaceInsightCard — 사진', () => {
  it('16:10 면을 사진이 없어도 남긴다', () => {
    expect(card()).toContain('aspect-16/10')
  })

  /* `firstImage` 가 null 이면 카테고리 일러스트 — 장식이라 alt="" */
  it('사진이 없으면 카테고리 일러스트를 쓴다', () => {
    expect(card()).toMatch(/<img src="\/illustrations\/[^"]+" alt=""/)
  })

  it('일러스트도 없으면 이미지 없음 문구를 둔다', () => {
    const markup = card(suitability, {
      ...placeSummary,
      contentType: { code: 'NOPE', name: '?', description: null },
    })

    expect(markup).toContain(messages.place.noImage)
  })
})

/*
  판정 줄 — `82/100` 숫자만 등급 색, 등급어는 상자 없이 글자, 혼잡할 때만 `· 혼잡`.
*/
describe('PlaceInsightCard — 판정 줄', () => {
  it('숫자는 등급 -500 색의 22/900 이고 단위가 붙는다', () => {
    const markup = card()

    expect(markup).toMatch(/text-title-1 text-metric-high-500">82</)
    expect(markup).toContain('>/100<')
  })

  /* 등급어가 배지(tint 면)로 서지 않는다 — `-700` 글자다 */
  it('등급어는 서버 문구 그대로 · 상자 없는 글자다', () => {
    const markup = card()

    expect(markup).toContain(`text-metric-high-700">${suitability.suitabilityLevel.name}<`)
    expect(markup).not.toContain('bg-metric-high-100')
  })

  it('혼잡할 때만 `· 혼잡` 을 붙인다', () => {
    expect(card({ ...suitability, congestion: CROWDED })).toMatch(/· <\/span>혼잡</)
    // fixture 의 혼잡도는 UNKNOWN 이다 — 카드는 말하지 않는다
    expect(card()).not.toContain('· </span>')
  })

  /* 행 시절의 `혼잡도 정보 없음` 배지가 카드에는 없다 */
  it('혼잡도 축 라벨 배지를 그리지 않는다', () => {
    expect(card()).not.toContain(`${messages.common.metricAxisCongestion} </span>`)
  })

  /* null 은 0점이 아니다 — 숫자 자리를 비우고 등급어가 같은 말을 한다 */
  it('점수가 없으면 숫자 없이 등급어만 선다', () => {
    const markup = card(suitabilityInsufficient)

    expect(markup).not.toContain('>/100<')
    expect(markup).toContain(suitabilityInsufficient.suitabilityLevel.name)
  })
})

/*
  그 장소만의 근거 한 줄 — 호출부가 고른 것만 그린다(`pickCardReason`). 공통인지는 목록을
  가진 쪽만 안다.
*/
describe('PlaceInsightCard — 근거 한 줄', () => {
  it('받은 근거를 서버 문장 그대로 그린다', () => {
    expect(card(suitability, placeSummary, HEAT)).toContain(HEAT.description)
  })

  /* 모바일은 세로 자리가 없어 상세에서 읽는다 — 목록 위 공통 근거와 같은 md 에서 켜진다 */
  it('md 이상에서만 선다', () => {
    expect(card(suitability, placeSummary, HEAT)).toMatch(
      new RegExp(`hidden[^"]*md:block[^"]*">${HEAT.description}<`),
    )
  })

  /* 경보 날은 근거가 전부 공통이라 카드에 줄이 없다 — 응답 `reasons` 로 되돌아가지 않는다 */
  it('근거를 주지 않으면 응답의 reasons 를 그리지 않는다', () => {
    const markup = card()

    for (const reason of suitability.reasons) expect(markup).not.toContain(reason.description)
  })
})

describe('PlaceCardsEndCard — 끝 카드', () => {
  function end(cards: number, unscored: number) {
    const value = placeCardsEnd({ cards, unscored, total: 20, capacity: 3 })

    if (value === null) throw new Error('끝 카드가 서야 하는 입력이다')
    return renderToStaticMarkup(createElement(PlaceCardsEndCard, { end: value }))
  }

  /* 남은 수가 아니라 전체 수다 (#905 R7) */
  it('전체 수로 장소 목록에 간다', () => {
    const markup = end(2, 0)

    expect(markup).toContain('href="/places"')
    expect(markup).toContain(messages.home.allPlaces.replace('{n}', '20'))
  })

  /* 꺾쇠는 문구가 아니라 장식 조각이다 — 줄바꿈 없는 공백으로 앞 낱말에 붙는다 */
  it('꺾쇠는 aria-hidden 조각이고 앞 낱말과 떨어지지 않는다', () => {
    expect(messages.home.allPlaces).not.toContain('›')
    expect(end(2, 0)).toContain('<span aria-hidden="true"> ›</span>')
  })

  it('점수를 못 낸 곳이 있을 때만 안내 줄이 선다', () => {
    const line = messages.home.unscoredInAllPlaces.replace('{n}', '1')

    expect(end(1, 1)).toContain(line)
    expect(end(2, 0)).not.toContain('점수를 내지 못한')
  })

  /* L2 항목의 채널은 채움이다 — 테두리를 두르지 않는다 (DESIGN.md §0) */
  it('--band 채움이고 테두리가 없다', () => {
    const markup = end(2, 0)

    expect(markup).toContain('bg-band')
    expect(markup).not.toMatch(/class="[^"]*\bborder\b/)
  })

  it('그리드의 남은 빈 칸을 전부 차지한다', () => {
    expect(end(2, 0)).toContain('lg:col-span-1')
    expect(end(1, 0)).toContain('lg:col-span-2')
  })
})

/*
  담는 틀만 폭으로 가른다 — 1024 미만 캐러셀, 이상 3열 그리드. 카드는 한 벌이다.
*/
describe('PlaceInsightCardList — 틀', () => {
  const markup = renderToStaticMarkup(
    createElement(
      PlaceInsightCardList,
      null,
      createElement(PlaceInsightCard, {
        data: suitability,
        place: placeSummary,
      }),
    ),
  )

  it('1024 미만은 스냅하는 가로 캐러셀이다', () => {
    expect(markup).toContain('snap-x snap-mandatory')
    expect(markup).toContain('overflow-x-auto')
    expect(markup).toContain('snap-start')
  })

  /* 다음 카드가 비쳐 보이는 폭 — 그것이 넘김 신호라 화살표가 없다 */
  it('카드 폭은 토큰이고 화살표가 없다', () => {
    expect(markup).toContain('w-(--home-place-card-w)')
    expect(markup).not.toContain('scroll-rail-arrow')
  })

  /* 캐러셀로 숨기지 않는다 — 1024 이상은 한 줄에 셋 */
  it('1024 이상은 3열 그리드이고 스크롤을 끈다', () => {
    expect(markup).toContain('lg:grid lg:snap-none lg:grid-cols-3')
    expect(markup).toContain('lg:overflow-visible')
    expect(markup).toContain('lg:w-auto')
  })

  /* 넘치는 카드 폭이 조상 `scrollWidth` 로 새면 390 에서 `main` 이 가로로 늘어난다 */
  it('스크롤러가 레이아웃을 가둔다', () => {
    expect(markup).toContain('contain-layout')
  })

  it('재조회 중에는 흐리고 aria-busy 를 건다', () => {
    const busy = renderToStaticMarkup(
      createElement(PlaceInsightCardList, { busy: true, children: null }),
    )

    expect(busy).toContain('aria-busy="true"')
    expect(busy).toContain('opacity-55')
    expect(markup).not.toContain('aria-busy')
  })
})

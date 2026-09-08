import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlaceInsightRow } from '@/features/home/place-insight-row'
import { messages } from '@/lib/messages'
import { suitability, suitabilityInsufficient } from '@/test/fixtures/insight'
import { placeSummary } from '@/test/fixtures/place'
import type { CongestionItem, PlaceSuitabilityResponse } from '@/types/insight'

function render(data: PlaceSuitabilityResponse) {
  return renderToStaticMarkup(
    createElement(PlaceInsightRow, { data, place: placeSummary, first: true }),
  )
}

const CROWDED: CongestionItem = {
  level: {
    code: 'HIGH',
    name: '혼잡',
    description: '관광객 집중도가 높아 붐빌 것으로 예상됩니다.',
  },
  concentrationRate: 72.4,
}

/**
 * dev 실측 그대로의 근거 목록 — **혼잡도 얘기가 없다.**
 *
 * 집중률 72.4% 로 `혼잡` 판정을 받은 장소의 `reasons` 가 이 둘뿐이었다. 기본 fixture 는
 * `CONGESTION_UNKNOWN` 근거를 갖고 있어(그 갈래에서는 서버가 근거를 준다) 여기 두면
 * 배지를 안 그려도 문구가 우연히 맞는다 — 그래서 근거를 갈라 둔다.
 */
const REASONS_WITHOUT_CONGESTION = [
  {
    code: 'PET_ALLOWED',
    name: '동반 가능',
    description: '반려견과 함께 입장할 수 있는 장소입니다.',
    scoreDelta: 0,
  },
  {
    code: 'HEAT_RISK',
    name: '고온 주의',
    description: '최고기온 31도 로, 더위에 약한 아이에게는 부담이 큽니다.',
    scoreDelta: -12,
  },
]

/*
  섹션 부제가 "오늘 날씨와 혼잡도 반영" 이라고 말하는데 화면에는 혼잡도가 없었다.
  값은 적합도 응답에 이미 와 있었고(추가 호출 없음), `reasons` 에는 섞여 오지 않는다 —
  dev 실측에서 `혼잡`(집중률 72.4%)인 장소의 reasons 가 PET_ALLOWED · HEAT_RISK 뿐이었다.
*/
describe('PlaceInsightRow — 혼잡도', () => {
  /* `reasons` 에 기대면 혼잡도는 영영 안 보인다 — 별도 필드로 그리는지 확인한다 */
  it('근거 문장에 혼잡 얘기가 없어도 혼잡도 등급을 서버 문구 그대로 그린다', () => {
    const data = {
      ...suitability,
      congestion: CROWDED,
      reasons: REASONS_WITHOUT_CONGESTION,
    }

    expect(data.reasons.some((reason) => reason.description.includes('혼잡'))).toBe(false)
    expect(render(data)).toContain('혼잡')
  })

  /*
    서버 `name` 이 "정보 없음" 인데 배지 하나로 서면 무엇의 정보가 없는지 알 수 없다.
    명세(D5-1 §12)가 "혼잡도 정보 없음" 을 정해 둔 이유다.
  */
  it('UNKNOWN 은 무엇의 정보가 없는지 밝힌다', () => {
    const data = { ...suitability, reasons: REASONS_WITHOUT_CONGESTION }

    expect(data.congestion?.level.code).toBe('UNKNOWN')
    expect(render(data)).toContain(messages.home.congestionUnknown)
  })

  /* UNKNOWN 에 등급 색을 주지 않는다 — 점선 테두리만이다 (DESIGN.md §2-3) */
  it('UNKNOWN 에 등급 색을 주지 않는다', () => {
    expect(render(suitability)).toContain('border-dashed')
  })

  /* 혼잡도의 LOW 는 "한산"(좋음)이다. 공용 매퍼를 쓰면 초록이 반대로 나간다 */
  it('한산(LOW)을 나쁜 톤으로 칠하지 않는다', () => {
    const markup = render({
      ...suitability,
      congestion: {
        level: { code: 'LOW', name: '한산', description: null },
        concentrationRate: 12,
      },
    })

    expect(markup).toContain('bg-metric-high-100')
  })

  /* 서버가 이 축을 아예 판정하지 않은 경우 — 등급이 UNKNOWN 인 것과도 다르다 */
  it('congestion 이 null 이면 배지를 그리지 않는다', () => {
    const markup = render({
      ...suitability,
      congestion: null,
      reasons: REASONS_WITHOUT_CONGESTION,
    })

    expect(markup).not.toContain(messages.home.congestionUnknown)
  })

  /*
    점수도 혼잡도도 없으면 모바일 줄을 만들지 않는다 — 빈 div 의 여백만 남는다.
    (`판단 근거 부족` 배지가 이미 "점수를 내지 않았다" 를 말한다)
  */
  it('점수와 혼잡도가 모두 없으면 모바일 줄을 만들지 않는다', () => {
    const markup = render({ ...suitabilityInsufficient, congestion: null })

    expect(markup).not.toContain('mt-1 flex items-center gap-2 md:hidden')
  })
})

/*
  #304 — 카드 전부에 같은 날씨 문장이 붙어 목록이 그 한 문장으로 채워졌다. 걸러내는 일은
  목록을 가진 쪽(`home-view`)이 하고(`splitSharedReasons`), 이 행은 **받은 것만 그린다.**
*/
describe('PlaceInsightRow — 근거 출처', () => {
  it('`reasons` 를 주면 응답 대신 그것을 그린다', () => {
    const markup = renderToStaticMarkup(
      createElement(PlaceInsightRow, {
        data: { ...suitability, reasons: REASONS_WITHOUT_CONGESTION },
        place: placeSummary,
        first: true,
        // 공통 문장(`PET_ALLOWED`)이 빠진 나머지 — home-view 가 넘기는 모양이다
        reasons: [REASONS_WITHOUT_CONGESTION[1]!],
      }),
    )

    expect(markup).toContain('최고기온 31도')
    expect(markup).not.toContain('반려견과 함께 입장할 수 있는 장소입니다')
  })

  /* 목록 밖에서 이 행 하나만 쓰는 곳은 지금까지와 같아야 한다 */
  it('안 주면 응답의 `reasons` 를 그대로 그린다', () => {
    const markup = render({ ...suitability, reasons: REASONS_WITHOUT_CONGESTION })

    expect(markup).toContain('반려견과 함께 입장할 수 있는 장소입니다')
  })

  /* 공통 문장을 다 걷어 빈 배열이 와도 근거 블록만 사라지고 행은 남는다 */
  it('빈 배열이면 근거 없이 행만 그린다', () => {
    const markup = renderToStaticMarkup(
      createElement(PlaceInsightRow, {
        data: { ...suitability, reasons: REASONS_WITHOUT_CONGESTION },
        place: placeSummary,
        first: true,
        reasons: [],
      }),
    )

    expect(markup).toContain(suitability.placeTitle)
    expect(markup).not.toContain('최고기온 31도')
  })
})
